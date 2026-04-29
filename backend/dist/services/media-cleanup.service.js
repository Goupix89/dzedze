"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaCleanupService = void 0;
const database_1 = require("../config/database");
const storage_service_1 = require("./storage.service");
const encryption_service_1 = require("./encryption.service");
const audit_service_1 = require("./audit.service");
const logger_1 = require("../utils/logger");
class MediaCleanupService {
    static async cleanExpiredMedia() {
        logger_1.logger.info('Starting media cleanup...');
        const result = await database_1.db.query(`SELECT id, storage_key, thumbnail_key, encryption_key_id 
       FROM media 
       WHERE expires_at < NOW() AND storage_key IS NOT NULL`);
        let cleaned = 0;
        for (const media of result.rows) {
            try {
                await storage_service_1.StorageService.delete(media.storage_key);
                if (media.thumbnail_key)
                    await storage_service_1.StorageService.delete(media.thumbnail_key);
                await encryption_service_1.EncryptionService.deleteKey(media.encryption_key_id);
                await database_1.db.query('UPDATE media SET storage_key = NULL, thumbnail_key = NULL, encryption_key_id = NULL WHERE id = $1', [media.id]);
                await audit_service_1.AuditService.log({
                    action: 'MEDIA_AUTO_DELETED',
                    resourceType: 'media',
                    resourceId: media.id,
                    details: { reason: 'expired', filename: media.filename },
                });
                cleaned++;
            }
            catch (err) {
                logger_1.logger.error(`Failed to cleanup media ${media.id}:`, err);
            }
        }
        logger_1.logger.info(`Cleaned ${cleaned}/${result.rows.length} expired media files`);
    }
}
exports.MediaCleanupService = MediaCleanupService;
//# sourceMappingURL=media-cleanup.service.js.map