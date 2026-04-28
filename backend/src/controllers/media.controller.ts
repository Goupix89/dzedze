import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { db } from '../config/database';
import { StorageService } from '../services/storage.service';
import { VideoService } from '../services/video.service';
import { AIService } from '../services/ai.service';
import { AuditService } from '../services/audit.service';
import { EncryptionService } from '../services/encryption.service';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { addDays } from 'date-fns';
import { io } from '../app';

// Multer config - memory storage for processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Type de fichier non autorisé'));
  },
});

export const uploadMiddleware = upload.single('file');

// ─── Upload Media ─────────────────────────────────────────────
export async function uploadMedia(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.userId;
    const { missionId, type, phase, retentionDays = 30 } = req.body;

    if (!req.file) throw new AppError('Aucun fichier fourni', 400);

    // Verify mission exists and agent is assigned
    const missionResult = await db.query(
      'SELECT id, agent_id, status FROM missions WHERE id = $1',
      [missionId]
    );
    const mission = missionResult.rows[0];
    if (!mission) throw new AppError('Mission introuvable', 404);
    
    const user = (req as any).user;
    if (user.role === 'agent' && mission.agent_id !== userId) {
      throw new AppError('Non autorisé pour cette mission', 403);
    }

    let fileBuffer = req.file.buffer;
    const isVideo = req.file.mimetype.startsWith('video/');
    const isPhoto = req.file.mimetype.startsWith('image/');

    // ─── Photo Processing ───────────────────────────────────
    if (isPhoto) {
      const sharp = (await import('sharp')).default;
      fileBuffer = await sharp(fileBuffer)
        .rotate() // auto-rotate from EXIF
        .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .withMetadata({ exif: {} }) // strip GPS data for privacy
        .toBuffer();
    }

    // ─── Video Processing ───────────────────────────────────
    let thumbnailBuffer: Buffer | null = null;
    let duration = 0;
    if (isVideo) {
      const processed = await VideoService.processVideo(fileBuffer, req.file.mimetype);
      fileBuffer = processed.buffer;
      thumbnailBuffer = processed.thumbnail;
      duration = processed.duration;
    }

    // ─── Encrypt ────────────────────────────────────────────
    const { encrypted, keyId } = await EncryptionService.encrypt(fileBuffer);
    const filename = `${Date.now()}_${path.basename(req.file.originalname)}`;
    const storageKey = `missions/${missionId}/${type}/${phase || 'during'}/${filename}`;

    // Upload encrypted file
    await StorageService.upload(encrypted, storageKey, 'application/octet-stream');

    // Upload thumbnail if video
    let thumbnailKey: string | null = null;
    if (thumbnailBuffer) {
      thumbnailKey = `${storageKey}_thumb.jpg`;
      await StorageService.upload(thumbnailBuffer, thumbnailKey, 'image/jpeg');
    }

    const expiresAt = addDays(new Date(), Math.min(Math.max(retentionDays, 7), 30));

    const mediaResult = await db.query(
      `INSERT INTO media 
        (mission_id, uploaded_by, type, phase, filename, storage_key, storage_bucket, 
         size_bytes, duration_seconds, thumbnail_key, mime_type, is_encrypted, 
         encryption_key_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        missionId, userId, type, phase, filename, storageKey,
        process.env.MINIO_BUCKET, encrypted.byteLength,
        duration, thumbnailKey, req.file.mimetype, true, keyId, expiresAt
      ]
    );

    const media = mediaResult.rows[0];

    // ─── Async AI Analysis ──────────────────────────────────
    if (isPhoto) {
      AIService.analyzeMedia(media.id, storageKey).then(async (analysis) => {
        if (analysis) {
          await db.query(
            'UPDATE media SET ai_analysis = $1, quality_score = $2, anomalies = $3 WHERE id = $4',
            [analysis, analysis.qualityScore, JSON.stringify(analysis.anomalies), media.id]
          );
          // Notify via WebSocket
          io.to(`mission:${missionId}`).emit('media:analyzed', { mediaId: media.id, analysis });
        }
      }).catch((err) => logger.error('AI analysis failed:', err));
    }

    await AuditService.log({
      userId,
      action: 'MEDIA_UPLOADED',
      resourceType: 'media',
      resourceId: media.id,
      details: { missionId, type, phase, size: req.file.size, encrypted: true },
      ipAddress: req.ip,
    });

    io.to(`mission:${missionId}`).emit('media:new', {
      id: media.id,
      type,
      phase,
      createdAt: media.created_at,
    });

    res.status(201).json({
      success: true,
      data: {
        id: media.id,
        type: media.type,
        phase: media.phase,
        filename: media.filename,
        expiresAt: media.expires_at,
        thumbnailUrl: thumbnailKey ? `/api/v1/media/${media.id}/thumbnail` : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Get Media (with access logging) ─────────────────────────
export async function getMedia(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    const result = await db.query(
      `SELECT m.*, ms.agent_id, ms.manager_id 
       FROM media m 
       JOIN missions ms ON m.mission_id = ms.id 
       WHERE m.id = $1 AND m.storage_key IS NOT NULL`,
      [id]
    );

    const media = result.rows[0];
    if (!media) throw new AppError('Média introuvable ou expiré', 404);

    // Access control
    const user = (req as any).user;
    if (user.role === 'agent' && media.agent_id !== userId) {
      throw new AppError('Accès refusé', 403);
    }

    // Log access (RGPD requirement)
    await db.query(
      `INSERT INTO media_access_logs (media_id, accessed_by, access_type, ip_address)
       VALUES ($1, $2, 'view', $3)`,
      [id, userId, req.ip]
    );

    // Generate presigned URL (valid 15 minutes)
    const url = await StorageService.getPresignedUrl(media.storage_key, 900);
    
    // Decrypt on-the-fly if needed for streaming
    res.json({
      success: true,
      data: {
        id: media.id,
        type: media.type,
        phase: media.phase,
        url,
        expiresAt: media.expires_at,
        aiAnalysis: media.ai_analysis,
        qualityScore: media.quality_score,
        anomalies: media.anomalies,
        duration: media.duration_seconds,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Get Mission Media List ───────────────────────────────────
export async function getMissionMedia(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.userId;
    const { missionId } = req.params;
    const { type, phase } = req.query;

    const user = (req as any).user;
    
    // Verify access
    const missionResult = await db.query('SELECT agent_id, manager_id FROM missions WHERE id = $1', [missionId]);
    const mission = missionResult.rows[0];
    if (!mission) throw new AppError('Mission introuvable', 404);
    if (user.role === 'agent' && mission.agent_id !== userId) throw new AppError('Accès refusé', 403);

    let query = `
      SELECT id, type, phase, filename, size_bytes, duration_seconds, 
             thumbnail_key, quality_score, ai_analysis, anomalies, expires_at, created_at
      FROM media 
      WHERE mission_id = $1 AND storage_key IS NOT NULL
    `;
    const params: any[] = [missionId];

    if (type) { query += ` AND type = $${params.length + 1}`; params.push(type); }
    if (phase) { query += ` AND phase = $${params.length + 1}`; params.push(phase); }
    query += ' ORDER BY created_at ASC';

    const result = await db.query(query, params);

    // Generate thumbnail URLs
    const media = await Promise.all(result.rows.map(async (m: Record<string, unknown>) => ({
      ...m,
      thumbnailUrl: m.thumbnail_key ? await StorageService.getPresignedUrl(m.thumbnail_key as string, 3600) : null,
    })));

    res.json({ success: true, data: media });
  } catch (err) {
    next(err);
  }
}

// ─── Delete Media (RGPD) ─────────────────────────────────────
export async function deleteMedia(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;
    const user = (req as any).user;

    if (!['admin', 'manager'].includes(user.role)) {
      throw new AppError('Seuls les managers et admins peuvent supprimer des médias', 403);
    }

    const result = await db.query('SELECT * FROM media WHERE id = $1', [id]);
    const media = result.rows[0];
    if (!media) throw new AppError('Média introuvable', 404);

    // Delete from storage
    await StorageService.delete(media.storage_key);
    if (media.thumbnail_key) await StorageService.delete(media.thumbnail_key);

    // Nullify storage key (keep record for audit)
    await db.query(
      'UPDATE media SET storage_key = NULL, thumbnail_key = NULL WHERE id = $1',
      [id]
    );

    await AuditService.log({
      userId,
      action: 'MEDIA_DELETED',
      resourceType: 'media',
      resourceId: id,
      details: { filename: media.filename, missionId: media.mission_id },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Média supprimé avec succès' });
  } catch (err) {
    next(err);
  }
}
