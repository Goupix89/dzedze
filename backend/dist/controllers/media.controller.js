"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMiddleware = void 0;
exports.uploadMedia = uploadMedia;
exports.getMedia = getMedia;
exports.getMissionMedia = getMissionMedia;
exports.deleteMedia = deleteMedia;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const database_1 = require("../config/database");
const storage_service_1 = require("../services/storage.service");
const video_service_1 = require("../services/video.service");
const ai_service_1 = require("../services/ai.service");
const audit_service_1 = require("../services/audit.service");
const encryption_service_1 = require("../services/encryption.service");
const AppError_1 = require("../utils/AppError");
const logger_1 = require("../utils/logger");
const date_fns_1 = require("date-fns");
const app_1 = require("../app");
// Multer config - memory storage for processing
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
        if (allowed.includes(file.mimetype))
            cb(null, true);
        else
            cb(new Error('Type de fichier non autorisé'));
    },
});
exports.uploadMiddleware = upload.single('file');
// ─── Upload Media ─────────────────────────────────────────────
async function uploadMedia(req, res, next) {
    try {
        const userId = req.user.userId;
        const { missionId, type, phase, retentionDays = 30 } = req.body;
        if (!req.file)
            throw new AppError_1.AppError('Aucun fichier fourni', 400);
        // Verify mission exists and agent is assigned
        const missionResult = await database_1.db.query('SELECT id, agent_id, status FROM missions WHERE id = $1', [missionId]);
        const mission = missionResult.rows[0];
        if (!mission)
            throw new AppError_1.AppError('Mission introuvable', 404);
        const user = req.user;
        if (user.role === 'agent' && mission.agent_id !== userId) {
            throw new AppError_1.AppError('Non autorisé pour cette mission', 403);
        }
        let fileBuffer = req.file.buffer;
        const isVideo = req.file.mimetype.startsWith('video/');
        const isPhoto = req.file.mimetype.startsWith('image/');
        // ─── Photo Processing ───────────────────────────────────
        if (isPhoto) {
            const sharp = (await Promise.resolve().then(() => __importStar(require('sharp')))).default;
            fileBuffer = await sharp(fileBuffer)
                .rotate() // auto-rotate from EXIF
                .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 85, progressive: true })
                .withMetadata({ exif: {} }) // strip GPS data for privacy
                .toBuffer();
        }
        // ─── Video Processing ───────────────────────────────────
        let thumbnailBuffer = null;
        let duration = 0;
        if (isVideo) {
            const processed = await video_service_1.VideoService.processVideo(fileBuffer, req.file.mimetype);
            fileBuffer = processed.buffer;
            thumbnailBuffer = processed.thumbnail;
            duration = processed.duration;
        }
        // ─── Encrypt ────────────────────────────────────────────
        const { encrypted, keyId } = await encryption_service_1.EncryptionService.encrypt(fileBuffer);
        const filename = `${Date.now()}_${path_1.default.basename(req.file.originalname)}`;
        const storageKey = `missions/${missionId}/${type}/${phase || 'during'}/${filename}`;
        // Upload encrypted file
        await storage_service_1.StorageService.upload(encrypted, storageKey, 'application/octet-stream');
        // Upload thumbnail if video
        let thumbnailKey = null;
        if (thumbnailBuffer) {
            thumbnailKey = `${storageKey}_thumb.jpg`;
            await storage_service_1.StorageService.upload(thumbnailBuffer, thumbnailKey, 'image/jpeg');
        }
        const expiresAt = (0, date_fns_1.addDays)(new Date(), Math.min(Math.max(retentionDays, 7), 30));
        const mediaResult = await database_1.db.query(`INSERT INTO media 
        (mission_id, uploaded_by, type, phase, filename, storage_key, storage_bucket, 
         size_bytes, duration_seconds, thumbnail_key, mime_type, is_encrypted, 
         encryption_key_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`, [
            missionId, userId, type, phase, filename, storageKey,
            process.env.MINIO_BUCKET, encrypted.byteLength,
            duration, thumbnailKey, req.file.mimetype, true, keyId, expiresAt
        ]);
        const media = mediaResult.rows[0];
        // ─── Async AI Analysis ──────────────────────────────────
        if (isPhoto) {
            ai_service_1.AIService.analyzeMedia(media.id, storageKey).then(async (analysis) => {
                if (analysis) {
                    await database_1.db.query('UPDATE media SET ai_analysis = $1, quality_score = $2, anomalies = $3 WHERE id = $4', [analysis, analysis.qualityScore, JSON.stringify(analysis.anomalies), media.id]);
                    // Notify via WebSocket
                    app_1.io.to(`mission:${missionId}`).emit('media:analyzed', { mediaId: media.id, analysis });
                }
            }).catch((err) => logger_1.logger.error('AI analysis failed:', err));
        }
        await audit_service_1.AuditService.log({
            userId,
            action: 'MEDIA_UPLOADED',
            resourceType: 'media',
            resourceId: media.id,
            details: { missionId, type, phase, size: req.file.size, encrypted: true },
            ipAddress: req.ip,
        });
        app_1.io.to(`mission:${missionId}`).emit('media:new', {
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
    }
    catch (err) {
        next(err);
    }
}
// ─── Get Media (with access logging) ─────────────────────────
async function getMedia(req, res, next) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const result = await database_1.db.query(`SELECT m.*, ms.agent_id, ms.manager_id 
       FROM media m 
       JOIN missions ms ON m.mission_id = ms.id 
       WHERE m.id = $1 AND m.storage_key IS NOT NULL`, [id]);
        const media = result.rows[0];
        if (!media)
            throw new AppError_1.AppError('Média introuvable ou expiré', 404);
        // Access control
        const user = req.user;
        if (user.role === 'agent' && media.agent_id !== userId) {
            throw new AppError_1.AppError('Accès refusé', 403);
        }
        // Log access (RGPD requirement)
        await database_1.db.query(`INSERT INTO media_access_logs (media_id, accessed_by, access_type, ip_address)
       VALUES ($1, $2, 'view', $3)`, [id, userId, req.ip]);
        // Generate presigned URL (valid 15 minutes)
        const url = await storage_service_1.StorageService.getPresignedUrl(media.storage_key, 900);
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
    }
    catch (err) {
        next(err);
    }
}
// ─── Get Mission Media List ───────────────────────────────────
async function getMissionMedia(req, res, next) {
    try {
        const userId = req.user.userId;
        const { missionId } = req.params;
        const { type, phase } = req.query;
        const user = req.user;
        // Verify access
        const missionResult = await database_1.db.query('SELECT agent_id, manager_id FROM missions WHERE id = $1', [missionId]);
        const mission = missionResult.rows[0];
        if (!mission)
            throw new AppError_1.AppError('Mission introuvable', 404);
        if (user.role === 'agent' && mission.agent_id !== userId)
            throw new AppError_1.AppError('Accès refusé', 403);
        let query = `
      SELECT id, type, phase, filename, size_bytes, duration_seconds, 
             thumbnail_key, quality_score, ai_analysis, anomalies, expires_at, created_at
      FROM media 
      WHERE mission_id = $1 AND storage_key IS NOT NULL
    `;
        const params = [missionId];
        if (type) {
            query += ` AND type = $${params.length + 1}`;
            params.push(type);
        }
        if (phase) {
            query += ` AND phase = $${params.length + 1}`;
            params.push(phase);
        }
        query += ' ORDER BY created_at ASC';
        const result = await database_1.db.query(query, params);
        // Generate thumbnail URLs
        const media = await Promise.all(result.rows.map(async (m) => ({
            ...m,
            thumbnailUrl: m.thumbnail_key ? await storage_service_1.StorageService.getPresignedUrl(m.thumbnail_key, 3600) : null,
        })));
        res.json({ success: true, data: media });
    }
    catch (err) {
        next(err);
    }
}
// ─── Delete Media (RGPD) ─────────────────────────────────────
async function deleteMedia(req, res, next) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const user = req.user;
        if (!['admin', 'manager'].includes(user.role)) {
            throw new AppError_1.AppError('Seuls les managers et admins peuvent supprimer des médias', 403);
        }
        const result = await database_1.db.query('SELECT * FROM media WHERE id = $1', [id]);
        const media = result.rows[0];
        if (!media)
            throw new AppError_1.AppError('Média introuvable', 404);
        // Delete from storage
        await storage_service_1.StorageService.delete(media.storage_key);
        if (media.thumbnail_key)
            await storage_service_1.StorageService.delete(media.thumbnail_key);
        // Nullify storage key (keep record for audit)
        await database_1.db.query('UPDATE media SET storage_key = NULL, thumbnail_key = NULL WHERE id = $1', [id]);
        await audit_service_1.AuditService.log({
            userId,
            action: 'MEDIA_DELETED',
            resourceType: 'media',
            resourceId: id,
            details: { filename: media.filename, missionId: media.mission_id },
            ipAddress: req.ip,
        });
        res.json({ success: true, message: 'Média supprimé avec succès' });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=media.controller.js.map