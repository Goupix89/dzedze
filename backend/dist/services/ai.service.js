"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const axios_1 = __importDefault(require("axios"));
const storage_service_1 = require("./storage.service");
const encryption_service_1 = require("./encryption.service");
const logger_1 = require("../utils/logger");
const database_1 = require("../config/database");
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:8000';
class AIService {
    // ─── Analyze Photo/Video ────────────────────────────────────
    static async analyzeMedia(mediaId, storageKey) {
        try {
            // Get encrypted media
            const encryptedBuffer = await storage_service_1.StorageService.download(storageKey);
            // Get encryption key
            const mediaResult = await database_1.db.query('SELECT encryption_key_id FROM media WHERE id = $1', [mediaId]);
            const { encryption_key_id } = mediaResult.rows[0];
            // Decrypt
            const buffer = await encryption_service_1.EncryptionService.decrypt(encryptedBuffer, encryption_key_id);
            // Send to AI microservice as base64
            const base64 = buffer.toString('base64');
            const response = await axios_1.default.post(`${AI_SERVICE_URL}/analyze`, {
                mediaId,
                imageData: base64,
                analysisTypes: ['quality', 'cleanliness', 'anomalies', 'completeness'],
            }, {
                timeout: 30000,
                maxBodyLength: 50 * 1024 * 1024, // 50MB
            });
            return response.data;
        }
        catch (error) {
            logger_1.logger.error(`AI analysis failed for media ${mediaId}:`, error);
            return null;
        }
    }
    // ─── Batch Quality Report for Mission ───────────────────────
    static async generateMissionQualityReport(missionId) {
        try {
            const mediaResult = await database_1.db.query(`SELECT id, phase, type, ai_analysis, quality_score, anomalies 
         FROM media WHERE mission_id = $1 AND ai_analysis IS NOT NULL ORDER BY phase, created_at`, [missionId]);
            const response = await axios_1.default.post(`${AI_SERVICE_URL}/mission-report`, {
                missionId,
                mediaItems: mediaResult.rows,
            }, { timeout: 60000 });
            return response.data;
        }
        catch (error) {
            logger_1.logger.error(`Mission report generation failed for ${missionId}:`, error);
            return {
                overallScore: 0,
                beforeAfterComparison: null,
                issues: ['Analyse non disponible'],
                recommendation: 'Veuillez réessayer ultérieurement',
            };
        }
    }
    // ─── Real-time Frame Analysis (for live stream) ─────────────
    static async analyzeFrame(frameData) {
        try {
            const response = await axios_1.default.post(`${AI_SERVICE_URL}/analyze-frame`, {
                frame: frameData.toString('base64'),
            }, { timeout: 5000 });
            return response.data;
        }
        catch {
            return { qualityScore: 0, anomalies: [], alerts: [] };
        }
    }
    // ─── Compute Agent Score ─────────────────────────────────────
    static async computeAgentQualityScore(agentId, periodDays = 30) {
        const result = await database_1.db.query(`SELECT AVG(m.quality_score) as avg_score,
              COUNT(DISTINCT ms.id) as total_missions,
              AVG(CASE WHEN me.anomalies != '[]'::jsonb THEN 1 ELSE 0 END) as anomaly_rate
       FROM media me
       JOIN missions ms ON me.mission_id = ms.id
       JOIN media m ON me.mission_id = m.mission_id
       WHERE ms.agent_id = $1 
         AND ms.completed_at > NOW() - INTERVAL '${periodDays} days'
         AND me.ai_analysis IS NOT NULL`, [agentId]);
        const data = result.rows[0];
        const score = Math.round((data.avg_score || 0) * 10) / 10;
        return {
            score,
            trend: 'stable',
            details: {
                totalMissions: data.total_missions,
                anomalyRate: Math.round(data.anomaly_rate * 100),
                periodDays,
            },
        };
    }
}
exports.AIService = AIService;
//# sourceMappingURL=ai.service.js.map