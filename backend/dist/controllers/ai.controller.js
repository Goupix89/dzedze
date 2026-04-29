"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMissionReport = getMissionReport;
exports.getAgentAIScore = getAgentAIScore;
const database_1 = require("../config/database");
const ai_service_1 = require("../services/ai.service");
const AppError_1 = require("../utils/AppError");
// ── GET /ai/mission/:missionId/report ─────────────────────────
async function getMissionReport(req, res, next) {
    try {
        const { missionId } = req.params;
        const user = req.user;
        const missionRes = await database_1.db.query(`SELECT m.*, s.name as site_name,
              u_a.first_name as agent_first, u_a.last_name as agent_last,
              u_m.first_name as manager_first, u_m.last_name as manager_last
       FROM missions m
       LEFT JOIN sites s ON m.site_id = s.id
       LEFT JOIN users u_a ON m.agent_id = u_a.id
       LEFT JOIN users u_m ON m.manager_id = u_m.id
       WHERE m.id = $1`, [missionId]);
        if (!missionRes.rows.length)
            throw new AppError_1.AppError('Mission introuvable', 404);
        const mission = missionRes.rows[0];
        if (user.role === 'agent' && mission.agent_id !== user.userId) {
            throw new AppError_1.AppError('Non autorisé', 403);
        }
        // Aggregate from stored ai_analysis — no external dependency
        const mediaRes = await database_1.db.query(`SELECT id, phase, type, quality_score, anomalies, ai_analysis, created_at
       FROM media
       WHERE mission_id = $1
       ORDER BY phase, created_at`, [missionId]);
        const media = mediaRes.rows;
        if (!media.length) {
            return res.json({
                success: true,
                data: {
                    mission: { id: missionId, site: mission.site_name, status: mission.status },
                    overallScore: mission.quality_score ? parseFloat(mission.quality_score) : null,
                    mediaCount: 0,
                    phases: {},
                    anomalies: [],
                    issues: ['Aucun média disponible pour cette mission'],
                    recommendation: 'Ajoutez des photos/vidéos via l\'application mobile.',
                    generatedAt: new Date().toISOString(),
                },
            });
        }
        // Score by phase
        const byPhase = {};
        const allAnomalies = [];
        for (const m of media) {
            const phase = m.phase || 'unknown';
            if (!byPhase[phase])
                byPhase[phase] = { count: 0, avgScore: 0, anomalies: [] };
            byPhase[phase].count++;
            if (m.quality_score)
                byPhase[phase].avgScore += parseFloat(m.quality_score);
            const anomalies = Array.isArray(m.anomalies) ? m.anomalies : [];
            byPhase[phase].anomalies.push(...anomalies);
            allAnomalies.push(...anomalies.map((a) => ({ ...a, phase, mediaId: m.id })));
        }
        for (const phase of Object.keys(byPhase)) {
            const p = byPhase[phase];
            p.avgScore = p.count > 0 ? Math.round((p.avgScore / p.count) * 10) / 10 : 0;
        }
        const scored = media.filter(m => m.quality_score !== null);
        const overallScore = scored.length
            ? Math.round(scored.reduce((s, m) => s + parseFloat(m.quality_score), 0) / scored.length * 10) / 10
            : null;
        const highAnomalies = allAnomalies.filter(a => a.severity === 'high');
        const issues = highAnomalies.map((a) => `[${a.phase?.toUpperCase() ?? ''}] ${a.description ?? a.type} (confiance: ${Math.round((a.confidence ?? 0) * 100)}%)`);
        let recommendation = 'Qualité satisfaisante.';
        if (overallScore !== null) {
            if (overallScore < 5)
                recommendation = 'Score insuffisant — une vérification sur site est recommandée.';
            else if (overallScore < 7)
                recommendation = 'Quelques points à améliorer, suivre les anomalies identifiées.';
            else if (overallScore >= 9)
                recommendation = 'Excellent travail, aucune action requise.';
        }
        // Try AI microservice for richer report (optional, non-blocking)
        let aiEnhancement = null;
        try {
            const hasAnalyzed = media.some(m => m.ai_analysis);
            if (hasAnalyzed) {
                aiEnhancement = await Promise.race([
                    ai_service_1.AIService.generateMissionQualityReport(missionId),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
                ]);
            }
        }
        catch {
            // silently ignore — DB data is sufficient
        }
        res.json({
            success: true,
            data: {
                mission: {
                    id: missionId,
                    site: mission.site_name,
                    status: mission.status,
                    agent: mission.agent_first ? `${mission.agent_first} ${mission.agent_last}` : null,
                    scheduledStart: mission.scheduled_start,
                    completedAt: mission.completed_at,
                },
                overallScore: aiEnhancement?.overallScore ?? overallScore,
                mediaCount: media.length,
                phases: byPhase,
                anomalies: allAnomalies,
                issues: aiEnhancement?.issues ?? issues,
                recommendation: aiEnhancement?.recommendation ?? recommendation,
                beforeAfterComparison: aiEnhancement?.beforeAfterComparison ?? null,
                generatedAt: new Date().toISOString(),
            },
        });
    }
    catch (err) {
        next(err);
    }
}
// ── GET /ai/agent/:agentId/score ──────────────────────────────
async function getAgentAIScore(req, res, next) {
    try {
        const { agentId } = req.params;
        const { days = '30' } = req.query;
        const periodDays = Math.min(365, Math.max(1, parseInt(days)));
        const user = req.user;
        if (user.role === 'agent' && user.userId !== agentId) {
            throw new AppError_1.AppError('Non autorisé', 403);
        }
        const agentRes = await database_1.db.query('SELECT id, first_name, last_name, role, quality_score FROM users WHERE id = $1', [agentId]);
        if (!agentRes.rows.length)
            throw new AppError_1.AppError('Agent introuvable', 404);
        const agent = agentRes.rows[0];
        // Per-mission scores + anomaly counts
        const statsRes = await database_1.db.query(`SELECT
         m.id, m.quality_score, m.completed_at,
         COUNT(DISTINCT me.id) FILTER (WHERE me.id IS NOT NULL) as media_count,
         COUNT(DISTINCT me.id) FILTER (WHERE me.anomalies != '[]'::jsonb AND me.anomalies IS NOT NULL) as anomaly_media_count,
         AVG(me.quality_score) FILTER (WHERE me.quality_score IS NOT NULL) as media_avg_score
       FROM missions m
       LEFT JOIN media me ON me.mission_id = m.id
       WHERE m.agent_id = $1
         AND m.status = 'completed'
         AND m.completed_at > NOW() - INTERVAL '${periodDays} days'
       GROUP BY m.id, m.quality_score, m.completed_at
       ORDER BY m.completed_at DESC`, [agentId]);
        const missions = statsRes.rows;
        const scored = missions.filter(m => m.quality_score !== null);
        const avgScore = scored.length
            ? Math.round(scored.reduce((s, m) => s + parseFloat(m.quality_score), 0) / scored.length * 10) / 10
            : null;
        // Trend: compare first half vs second half of period
        const half = Math.floor(missions.length / 2);
        const recent = missions.slice(0, half);
        const older = missions.slice(half);
        const avgRecent = recent.filter(m => m.quality_score).length
            ? recent.filter(m => m.quality_score).reduce((s, m) => s + parseFloat(m.quality_score), 0) / recent.filter(m => m.quality_score).length
            : null;
        const avgOlder = older.filter(m => m.quality_score).length
            ? older.filter(m => m.quality_score).reduce((s, m) => s + parseFloat(m.quality_score), 0) / older.filter(m => m.quality_score).length
            : null;
        let trend = 'stable';
        if (avgRecent !== null && avgOlder !== null) {
            if (avgRecent > avgOlder + 0.5)
                trend = 'up';
            else if (avgRecent < avgOlder - 0.5)
                trend = 'down';
        }
        const totalAnomaly = missions.reduce((s, m) => s + parseInt(m.anomaly_media_count), 0);
        const totalMedia = missions.reduce((s, m) => s + parseInt(m.media_count), 0);
        const anomalyRate = totalMedia > 0 ? Math.round(totalAnomaly / totalMedia * 100) : 0;
        // Score evolution for chart (last 10 completed missions)
        const evolution = missions
            .filter(m => m.quality_score !== null)
            .slice(0, 10)
            .reverse()
            .map((m) => ({
            date: m.completed_at,
            score: parseFloat(m.quality_score),
        }));
        res.json({
            success: true,
            data: {
                agent: {
                    id: agentId,
                    name: `${agent.first_name} ${agent.last_name}`,
                    role: agent.role,
                    globalScore: agent.quality_score ? parseFloat(agent.quality_score) : null,
                },
                periodDays,
                computedScore: avgScore,
                trend,
                details: {
                    totalMissions: missions.length,
                    scoredMissions: scored.length,
                    totalMedia,
                    anomalyRate,
                },
                evolution,
            },
        });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=ai.controller.js.map