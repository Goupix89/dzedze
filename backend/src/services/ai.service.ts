import axios from 'axios';
import { StorageService } from './storage.service';
import { EncryptionService } from './encryption.service';
import { logger } from '../utils/logger';
import { db } from '../config/database';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:8000';

export interface MediaAnalysis {
  qualityScore: number;         // 0-10
  cleanliness: number;          // 0-10
  completeness: number;         // 0-10
  anomalies: Anomaly[];
  tags: string[];
  brightness: number;
  blurScore: number;
  recommendation: string;
}

export interface Anomaly {
  type: string;
  confidence: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
  bbox?: [number, number, number, number]; // x, y, w, h
}

export class AIService {
  // ─── Analyze Photo/Video ────────────────────────────────────
  static async analyzeMedia(mediaId: string, storageKey: string): Promise<MediaAnalysis | null> {
    try {
      // Get encrypted media
      const encryptedBuffer = await StorageService.download(storageKey);
      
      // Get encryption key
      const mediaResult = await db.query('SELECT encryption_key_id FROM media WHERE id = $1', [mediaId]);
      const { encryption_key_id } = mediaResult.rows[0];
      
      // Decrypt
      const buffer = await EncryptionService.decrypt(encryptedBuffer, encryption_key_id);
      
      // Send to AI microservice as base64
      const base64 = buffer.toString('base64');
      const response = await axios.post(`${AI_SERVICE_URL}/analyze`, {
        mediaId,
        imageData: base64,
        analysisTypes: ['quality', 'cleanliness', 'anomalies', 'completeness'],
      }, {
        timeout: 30000,
        maxBodyLength: 50 * 1024 * 1024, // 50MB
      });

      return response.data as MediaAnalysis;
    } catch (error) {
      logger.error(`AI analysis failed for media ${mediaId}:`, error);
      return null;
    }
  }

  // ─── Batch Quality Report for Mission ───────────────────────
  static async generateMissionQualityReport(missionId: string): Promise<{
    overallScore: number;
    beforeAfterComparison: any;
    issues: string[];
    recommendation: string;
  }> {
    try {
      const mediaResult = await db.query(
        `SELECT id, phase, type, ai_analysis, quality_score, anomalies 
         FROM media WHERE mission_id = $1 AND ai_analysis IS NOT NULL ORDER BY phase, created_at`,
        [missionId]
      );

      const response = await axios.post(`${AI_SERVICE_URL}/mission-report`, {
        missionId,
        mediaItems: mediaResult.rows,
      }, { timeout: 60000 });

      return response.data;
    } catch (error) {
      logger.error(`Mission report generation failed for ${missionId}:`, error);
      return {
        overallScore: 0,
        beforeAfterComparison: null,
        issues: ['Analyse non disponible'],
        recommendation: 'Veuillez réessayer ultérieurement',
      };
    }
  }

  // ─── Real-time Frame Analysis (for live stream) ─────────────
  static async analyzeFrame(frameData: Buffer): Promise<{
    qualityScore: number;
    anomalies: Anomaly[];
    alerts: string[];
  }> {
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/analyze-frame`, {
        frame: frameData.toString('base64'),
      }, { timeout: 5000 });
      return response.data;
    } catch {
      return { qualityScore: 0, anomalies: [], alerts: [] };
    }
  }

  // ─── Compute Agent Score ─────────────────────────────────────
  static async computeAgentQualityScore(agentId: string, periodDays: number = 30): Promise<{
    score: number;
    trend: 'up' | 'down' | 'stable';
    details: any;
  }> {
    const result = await db.query(
      `SELECT AVG(m.quality_score) as avg_score,
              COUNT(DISTINCT ms.id) as total_missions,
              AVG(CASE WHEN me.anomalies != '[]'::jsonb THEN 1 ELSE 0 END) as anomaly_rate
       FROM media me
       JOIN missions ms ON me.mission_id = ms.id
       JOIN media m ON me.mission_id = m.mission_id
       WHERE ms.agent_id = $1 
         AND ms.completed_at > NOW() - INTERVAL '${periodDays} days'
         AND me.ai_analysis IS NOT NULL`,
      [agentId]
    );

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
