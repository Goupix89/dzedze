import { db } from '../config/database';
import { StorageService } from './storage.service';
import { EncryptionService } from './encryption.service';
import { AuditService } from './audit.service';
import { logger } from '../utils/logger';

export class MediaCleanupService {
  static async cleanExpiredMedia(): Promise<void> {
    logger.info('Starting media cleanup...');

    const result = await db.query(
      `SELECT id, storage_key, thumbnail_key, encryption_key_id 
       FROM media 
       WHERE expires_at < NOW() AND storage_key IS NOT NULL`,
    );

    let cleaned = 0;
    for (const media of result.rows) {
      try {
        await StorageService.delete(media.storage_key);
        if (media.thumbnail_key) await StorageService.delete(media.thumbnail_key);
        await EncryptionService.deleteKey(media.encryption_key_id);

        await db.query(
          'UPDATE media SET storage_key = NULL, thumbnail_key = NULL, encryption_key_id = NULL WHERE id = $1',
          [media.id]
        );

        await AuditService.log({
          action: 'MEDIA_AUTO_DELETED',
          resourceType: 'media',
          resourceId: media.id,
          details: { reason: 'expired', filename: media.filename },
        });

        cleaned++;
      } catch (err) {
        logger.error(`Failed to cleanup media ${media.id}:`, err);
      }
    }

    logger.info(`Cleaned ${cleaned}/${result.rows.length} expired media files`);
  }
}
