import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { AuditService } from '../services/audit.service';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { io } from '../app';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';

type AuthReq = Request & { user: { userId: string; role: string } };

// ─── helpers ─────────────────────────────────────────────────
function auth(req: Request): { userId: string; role: string } {
  return (req as AuthReq).user;
}

function assertRole(req: Request, roles: string[]) {
  if (!roles.includes(auth(req).role)) {
    throw new AppError(`Accès réservé aux rôles : ${roles.join(', ')}`, 403);
  }
}

// ── GET /missions/stats ───────────────────────────────────────
// Données pour le dashboard (StatCards + PieChart)
export async function getDashboardStats(req: Request, res: Response, next: NextFunction) {
  try {
    const today      = new Date();
    const yesterday  = subDays(today, 1);
    const weekAgo    = subDays(today, 7);
    const prevWeekAgo = subDays(today, 14);

    const [statsRow, prevRow, mediaRow, prevMediaRow, breakdownRow, anomaliesRow] =
      await Promise.all([

        // Stats semaine courante
        db.query(`
          SELECT
            COUNT(*) FILTER (WHERE DATE(scheduled_start) = CURRENT_DATE)           AS today_missions,
            COUNT(*) FILTER (WHERE status = 'in_progress')                          AS in_progress,
            ROUND(AVG(quality_score) FILTER (
              WHERE quality_score IS NOT NULL
              AND   completed_at >= NOW() - INTERVAL '30 days'
            ), 1)                                                                    AS avg_quality_score,
            ROUND(
              AVG(EXTRACT(EPOCH FROM (actual_end - started_at)) / 60.0) FILTER (
                WHERE actual_end IS NOT NULL AND started_at IS NOT NULL
                AND   actual_end >= NOW() - INTERVAL '30 days'
              )
            )                                                                        AS avg_duration_minutes,
            ROUND(
              100.0 * COUNT(*) FILTER (WHERE status = 'completed')
              / NULLIF(COUNT(*) FILTER (WHERE status IN ('completed','cancelled','review')), 0)
            )                                                                        AS completion_rate
          FROM missions
        `),

        // Stats semaine précédente (pour calculer le trend %)
        db.query(`
          SELECT
            COUNT(*) FILTER (
              WHERE DATE(scheduled_start) BETWEEN $1 AND $2
            ) AS prev_today,
            ROUND(AVG(quality_score) FILTER (
              WHERE quality_score IS NOT NULL
              AND   completed_at BETWEEN $3 AND $4
            ), 1) AS prev_quality
          FROM missions
        `, [
          format(subDays(yesterday, 1), 'yyyy-MM-dd'),
          format(yesterday, 'yyyy-MM-dd'),
          format(prevWeekAgo, 'yyyy-MM-dd'),
          format(weekAgo, 'yyyy-MM-dd'),
        ]),

        // Médias capturés aujourd'hui
        db.query(`
          SELECT COUNT(*) AS media_today
          FROM   media
          WHERE  created_at >= $1 AND created_at < $2
            AND  deleted_at IS NULL
        `, [startOfDay(today), endOfDay(today)]),

        // Médias hier (trend)
        db.query(`
          SELECT COUNT(*) AS media_yesterday
          FROM   media
          WHERE  created_at >= $1 AND created_at < $2
            AND  deleted_at IS NULL
        `, [startOfDay(yesterday), endOfDay(yesterday)]),

        // Répartition par statut
        db.query(`
          SELECT status, COUNT(*) AS count
          FROM   missions
          GROUP  BY status
          ORDER  BY ARRAY_POSITION(
            ARRAY['in_progress','planned','completed','review','cancelled'],
            status
          )
        `),

        // Anomalies récentes (24 h)
        db.query(`
          SELECT
            med.id,
            med.anomalies,
            med.quality_score,
            m.id AS mission_id,
            s.name AS site_name,
            u.first_name || ' ' || u.last_name AS agent_name
          FROM   media med
          JOIN   missions m ON med.mission_id = m.id
          JOIN   sites    s ON m.site_id      = s.id
          JOIN   users    u ON m.agent_id     = u.id
          WHERE  med.created_at >= NOW() - INTERVAL '24 hours'
            AND  med.anomalies  != '[]'::jsonb
            AND  med.deleted_at IS NULL
          ORDER  BY med.created_at DESC
          LIMIT  9
        `),
      ]);

    const s    = statsRow.rows[0];
    const prev = prevRow.rows[0];

    const todayMissions = parseInt(s.today_missions);
    const prevMissions  = parseInt(prev.prev_today);
    const mediaToday    = parseInt(mediaRow.rows[0].media_today);
    const mediaYest     = parseInt(prevMediaRow.rows[0].media_yesterday);
    const avgQuality       = parseFloat(s.avg_quality_score) || null;
    const prevQuality      = parseFloat(prev.prev_quality) || null;
    const avgDuration      = s.avg_duration_minutes != null ? parseInt(s.avg_duration_minutes) : null;
    const completionRate   = s.completion_rate != null ? parseInt(s.completion_rate) : null;

    const trendPct = (curr: number, previous: number) =>
      previous === 0 ? null : Math.round(((curr - previous) / previous) * 100);

    const STATUS_LABELS: Record<string, string> = {
      in_progress: 'En cours',
      planned:     'Planifiées',
      completed:   'Terminées',
      review:      'En révision',
      cancelled:   'Annulées',
    };

    const anomalies = anomaliesRow.rows.flatMap((row) => {
      const list = (row.anomalies as any[]) ?? [];
      return list.map((a) => ({
        id:          row.id,
        missionId:   row.mission_id,
        siteName:    row.site_name,
        agentName:   row.agent_name,
        severity:    a.severity ?? 'low',
        description: a.description ?? '',
        type:        a.type ?? '',
      }));
    }).slice(0, 9);

    res.json({
      success: true,
      data: {
        todayMissions,
        inProgress:      parseInt(s.in_progress),
        mediaToday,
        avgQualityScore: avgQuality,
        avgDurationMinutes: avgDuration,
        completionRate,
        missionsTrend:   trendPct(todayMissions, prevMissions),
        mediaTrend:      trendPct(mediaToday, mediaYest),
        qualityTrend:    avgQuality && prevQuality
          ? trendPct(avgQuality, prevQuality) : null,
        statusBreakdown: breakdownRow.rows.map((r) => ({
          status: r.status,
          label:  STATUS_LABELS[r.status] ?? r.status,
          count:  parseInt(r.count),
        })),
        recentAnomalies: anomalies,
      },
    });
  } catch (err) { next(err); }
}

// ── GET /missions/quality-trend ───────────────────────────────
// Données pour le AreaChart du dashboard
export async function getQualityTrend(req: Request, res: Response, next: NextFunction) {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 14, 90);

    const result = await db.query(`
      SELECT
        DATE(m.completed_at)                                         AS day,
        ROUND(AVG(m.quality_score), 1)                               AS score,
        COUNT(med.id) FILTER (WHERE med.anomalies != '[]'::jsonb)    AS anomalies
      FROM   missions m
      LEFT JOIN media med ON med.mission_id = m.id
      WHERE  m.completed_at >= NOW() - ($1 || ' days')::INTERVAL
        AND  m.quality_score IS NOT NULL
      GROUP  BY DATE(m.completed_at)
      ORDER  BY day
    `, [days]);

    // Remplir les jours sans données avec score null
    const data = result.rows.map((r) => ({
      date:      format(new Date(r.day), 'dd MMM', { locale: fr }),
      score:     parseFloat(r.score),
      anomalies: parseInt(r.anomalies),
    }));

    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── GET /missions ─────────────────────────────────────────────
export async function listMissions(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = auth(req);
    const {
      status, site_id, agent_id,
      limit = '20', offset = '0',
      from, to,
    } = req.query as Record<string, string>;

    const conditions: string[] = [];
    const params: unknown[]    = [];

    // Filtre rôle : un agent ne voit que ses missions
    if (role === 'agent') {
      params.push(userId);
      conditions.push(`m.agent_id = $${params.length}`);
    } else if (agent_id) {
      params.push(agent_id);
      conditions.push(`m.agent_id = $${params.length}`);
    }

    if (status) {
      // Support multi-status : "in_progress,planned"
      const statuses = status.split(',').map(s => s.trim());
      params.push(statuses);
      conditions.push(`m.status = ANY($${params.length}::text[])`);
    }
    if (site_id) {
      params.push(site_id);
      conditions.push(`m.site_id = $${params.length}`);
    }
    if (from) {
      params.push(from);
      conditions.push(`m.scheduled_start >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`m.scheduled_start <= $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(parseInt(limit));
    params.push(parseInt(offset));

    const result = await db.query(`
      SELECT
        m.id, m.title, m.description, m.status,
        m.scheduled_start,
        m.scheduled_end,
        m.started_at,
        m.completed_at,
        m.quality_score,
        m.checklist,
        m.notes,
        s.id         AS site_id,
        s.name       AS site_name,
        s.address    AS site_address,
        s.city       AS site_city,
        s.latitude,
        s.longitude,
        a.id         AS agent_id,
        a.first_name || ' ' || a.last_name AS agent_name,
        a.phone      AS agent_phone,
        a.status     AS agent_status,
        a.quality_score AS agent_quality_score,
        mg.first_name || ' ' || mg.last_name AS manager_name,
        (SELECT COUNT(*) FROM media WHERE mission_id = m.id AND deleted_at IS NULL) AS media_count
      FROM   missions m
      JOIN   sites    s   ON m.site_id    = s.id
      LEFT JOIN users a   ON m.agent_id   = a.id
      LEFT JOIN users mg  ON m.manager_id = mg.id
      ${where}
      ORDER  BY m.scheduled_start DESC
      LIMIT  $${params.length - 1}
      OFFSET $${params.length}
    `, params);

    const countResult = await db.query(
      `SELECT COUNT(*) FROM missions m ${where}`,
      params.slice(0, -2)
    );

    res.json({
      success: true,
      data:    result.rows,
      meta: {
        total:  parseInt(countResult.rows[0].count),
        limit:  parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (err) { next(err); }
}

// ── POST /missions ────────────────────────────────────────────
export async function createMission(req: Request, res: Response, next: NextFunction) {
  try {
    assertRole(req, ['admin', 'manager']);
    const { userId } = auth(req);
    const {
      siteId, agentId, title, description,
      scheduledStart, scheduledEnd, checklist, notes,
    } = req.body;

    if (!siteId || !title || !scheduledStart || !scheduledEnd) {
      throw new AppError('Champs obligatoires manquants : siteId, title, scheduledStart, scheduledEnd', 400);
    }

    // Vérifier que l'agent n'a pas déjà une mission chevauchante (seulement si agent assigné)
    if (agentId) {
      const overlap = await db.query(`
        SELECT id FROM missions
        WHERE agent_id = $1
          AND status   NOT IN ('completed', 'cancelled')
          AND tstzrange(scheduled_start, scheduled_end) && tstzrange($2::timestamptz, $3::timestamptz)
      `, [agentId, scheduledStart, scheduledEnd]);

      if (overlap.rows.length > 0) {
        throw new AppError('L\'agent a déjà une mission planifiée sur ce créneau', 409);
      }
    }

    // Récupérer le template de checklist du site si non fourni
    let checklistData = checklist;
    if (!checklistData) {
      const site = await db.query(
        'SELECT checklist_template FROM sites WHERE id = $1', [siteId]
      );
      checklistData = site.rows[0]?.checklist_template ?? '[]';
    }

    const result = await db.query(`
      INSERT INTO missions
        (site_id, agent_id, manager_id, title, description,
         scheduled_start, scheduled_end, checklist, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      siteId, agentId, userId, title, description,
      scheduledStart, scheduledEnd,
      JSON.stringify(checklistData), notes,
    ]);

    const mission = result.rows[0];

    await AuditService.log({
      userId,
      action: 'MISSION_CREATED',
      resourceType: 'mission',
      resourceId: mission.id,
      details: { title, agentId, siteId },
    });

    // Notifier l'agent via WebSocket
    io.to(`user:${agentId}`).emit('mission:assigned', {
      missionId: mission.id,
      title,
      scheduledStart,
    });

    res.status(201).json({ success: true, data: mission });
  } catch (err) { next(err); }
}

// ── GET /missions/:id ─────────────────────────────────────────
export async function getMission(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = auth(req);
    const { id } = req.params;

    const result = await db.query(`
      SELECT
        m.*,
        s.name       AS site_name,
        s.address    AS site_address,
        s.city       AS site_city,
        s.latitude,
        s.longitude,
        a.first_name || ' ' || a.last_name AS agent_name,
        a.phone      AS agent_phone,
        a.quality_score AS agent_quality_score,
        mg.first_name || ' ' || mg.last_name AS manager_name,
        (
          SELECT json_agg(json_build_object(
            'id',           med.id,
            'type',         med.type,
            'phase',        med.phase,
            'filename',     med.filename,
            'thumbnailKey', med.thumbnail_key,
            'qualityScore', med.quality_score,
            'anomalies',    med.anomalies,
            'createdAt',    med.created_at
          ) ORDER BY med.created_at)
          FROM media med
          WHERE med.mission_id = m.id AND med.deleted_at IS NULL
        ) AS media_items
      FROM   missions m
      JOIN   sites    s  ON m.site_id    = s.id
      JOIN   users    a  ON m.agent_id   = a.id
      LEFT   JOIN users mg ON m.manager_id = mg.id
      WHERE  m.id = $1
    `, [id]);

    const mission = result.rows[0];
    if (!mission) throw new AppError('Mission introuvable', 404);

    if (role === 'agent' && mission.agent_id !== userId) {
      throw new AppError('Accès refusé', 403);
    }

    res.json({ success: true, data: mission });
  } catch (err) { next(err); }
}

// ── PUT /missions/:id ─────────────────────────────────────────
export async function updateMission(req: Request, res: Response, next: NextFunction) {
  try {
    assertRole(req, ['admin', 'manager']);
    const { userId } = auth(req);
    const { id } = req.params;
    const { title, description, scheduledStart, scheduledEnd, notes, checklist } = req.body;

    const existing = await db.query(
      'SELECT * FROM missions WHERE id = $1', [id]
    );
    if (!existing.rows[0]) throw new AppError('Mission introuvable', 404);

    if (['completed', 'cancelled'].includes(existing.rows[0].status)) {
      throw new AppError('Impossible de modifier une mission terminée ou annulée', 400);
    }

    const result = await db.query(`
      UPDATE missions SET
        title           = COALESCE($1, title),
        description     = COALESCE($2, description),
        scheduled_start = COALESCE($3, scheduled_start),
        scheduled_end   = COALESCE($4, scheduled_end),
        notes           = COALESCE($5, notes),
        checklist       = COALESCE($6, checklist)
      WHERE id = $7
      RETURNING *
    `, [title, description, scheduledStart, scheduledEnd, notes,
        checklist ? JSON.stringify(checklist) : null, id]);

    await AuditService.log({
      userId,
      action: 'MISSION_UPDATED',
      resourceType: 'mission',
      resourceId: id,
      details: { changes: req.body },
    });

    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
}

// ── DELETE /missions/:id ──────────────────────────────────────
export async function deleteMission(req: Request, res: Response, next: NextFunction) {
  try {
    assertRole(req, ['admin', 'manager']);
    const { userId } = auth(req);
    const { id } = req.params;

    const existing = await db.query('SELECT * FROM missions WHERE id = $1', [id]);
    if (!existing.rows[0]) throw new AppError('Mission introuvable', 404);

    if (existing.rows[0].status === 'in_progress') {
      throw new AppError('Impossible de supprimer une mission en cours', 400);
    }

    await db.query(
      "UPDATE missions SET status = 'cancelled' WHERE id = $1", [id]
    );

    await AuditService.log({
      userId,
      action: 'MISSION_CANCELLED',
      resourceType: 'mission',
      resourceId: id,
    });

    res.json({ success: true, message: 'Mission annulée' });
  } catch (err) { next(err); }
}

// ── POST /missions/:id/start ──────────────────────────────────
// Agent démarre la mission (status → in_progress)
export async function startMission(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = auth(req);
    const { id } = req.params;

    const result = await db.query('SELECT * FROM missions WHERE id = $1', [id]);
    const mission = result.rows[0];
    if (!mission) throw new AppError('Mission introuvable', 404);

    if (role === 'agent' && mission.agent_id !== userId) {
      throw new AppError('Cette mission ne vous est pas assignée', 403);
    }
    if (mission.status !== 'planned') {
      throw new AppError(`Impossible de démarrer une mission au statut "${mission.status}"`, 400);
    }

    const { latitude, longitude } = req.body as { latitude?: number; longitude?: number };

    await db.query(`
      UPDATE missions
      SET status      = 'in_progress',
          started_at  = NOW(),
          checkin_lat = $2,
          checkin_lon = $3
      WHERE id = $1
    `, [id, latitude ?? null, longitude ?? null]);

    await AuditService.log({
      userId,
      action: 'MISSION_STARTED',
      resourceType: 'mission',
      resourceId: id,
    });

    if (mission.manager_id) {
      io.to(`user:${mission.manager_id}`).emit('mission:started', {
        missionId: id,
        agentId: mission.agent_id,
      });
    }

    res.json({ success: true, message: 'Mission démarrée' });
  } catch (err) { next(err); }
}

// ── POST /missions/:id/complete ───────────────────────────────
// Agent termine la mission + checklist validée
export async function completeMission(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = auth(req);
    const { id } = req.params;
    const { checklist, notes, latitude, longitude } = req.body;

    const result = await db.query('SELECT * FROM missions WHERE id = $1', [id]);
    const mission = result.rows[0];
    if (!mission) throw new AppError('Mission introuvable', 404);

    if (role === 'agent' && mission.agent_id !== userId) {
      throw new AppError('Cette mission ne vous est pas assignée', 403);
    }
    if (mission.status !== 'in_progress') {
      throw new AppError('La mission n\'est pas en cours', 400);
    }

    // Vérifier les items obligatoires de la checklist
    if (checklist) {
      const required = (checklist as any[]).filter(i => i.required && !i.done);
      if (required.length > 0) {
        throw new AppError(
          `${required.length} point(s) obligatoire(s) non complété(s) : ${required.map((i: any) => i.label).join(', ')}`,
          400
        );
      }
    }

    // Auto-score from AI media analysis (best-effort, non-blocking)
    const mediaScoreRes = await db.query(
      `SELECT ROUND(AVG(quality_score)::numeric, 1) AS ai_score
       FROM media
       WHERE mission_id = $1 AND quality_score IS NOT NULL AND deleted_at IS NULL`,
      [id]
    );
    const aiScore = mediaScoreRes.rows[0]?.ai_score ?? null;

    await db.query(`
      UPDATE missions
      SET status        = 'review',
          completed_at  = NOW(),
          actual_end    = NOW(),
          checklist     = COALESCE($1, checklist),
          notes         = COALESCE($2, notes),
          quality_score = COALESCE($4, quality_score),
          checkout_lat  = $5,
          checkout_lon  = $6
      WHERE id = $3
    `, [checklist ? JSON.stringify(checklist) : null, notes, id, aiScore,
        latitude ?? null, longitude ?? null]);

    await AuditService.log({
      userId,
      action: 'MISSION_COMPLETED',
      resourceType: 'mission',
      resourceId: id,
    });

    if (mission.manager_id) {
      io.to(`user:${mission.manager_id}`).emit('mission:completed', {
        missionId: id,
        agentId: mission.agent_id,
      });
    }

    res.json({ success: true, message: 'Mission terminée, en attente de validation manager' });
  } catch (err) { next(err); }
}

// ── POST /missions/:id/score ──────────────────────────────────
// Manager valide et note la mission
export async function scoreMission(req: Request, res: Response, next: NextFunction) {
  try {
    assertRole(req, ['admin', 'manager']);
    const { userId } = auth(req);
    const { id } = req.params;
    const { score, notes } = req.body;

    if (score === undefined || score < 0 || score > 10) {
      throw new AppError('Score invalide (0–10)', 400);
    }

    const result = await db.query('SELECT * FROM missions WHERE id = $1', [id]);
    const mission = result.rows[0];
    if (!mission) throw new AppError('Mission introuvable', 404);

    if (!['review', 'in_progress'].includes(mission.status)) {
      throw new AppError('La mission n\'est pas en attente de validation', 400);
    }

    await db.query(`
      UPDATE missions
      SET status        = 'completed',
          quality_score = $1,
          notes         = COALESCE($2, notes)
      WHERE id = $3
    `, [score, notes, id]);

    // Recalculer le score agent
    await db.query(
      'SELECT fn_update_agent_quality_score($1)', [mission.agent_id]
    );

    await AuditService.log({
      userId,
      action: 'MISSION_SCORED',
      resourceType: 'mission',
      resourceId: id,
      details: { score, agentId: mission.agent_id },
    });

    io.to(`user:${mission.agent_id}`).emit('mission:scored', {
      missionId: id,
      score,
    });

    res.json({ success: true, message: 'Mission validée', data: { score } });
  } catch (err) { next(err); }
}

// ── PATCH /missions/:id/checklist ─────────────────────────────
// Agent coche/décoche des items en temps réel
export async function updateChecklist(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = auth(req);
    const { id } = req.params;
    const { checklist } = req.body;

    if (!Array.isArray(checklist)) throw new AppError('checklist doit être un tableau', 400);

    const result = await db.query('SELECT * FROM missions WHERE id = $1', [id]);
    const mission = result.rows[0];
    if (!mission) throw new AppError('Mission introuvable', 404);

    if (role === 'agent' && mission.agent_id !== userId) {
      throw new AppError('Accès refusé', 403);
    }
    if (mission.status !== 'in_progress') {
      throw new AppError('La mission n\'est pas en cours', 400);
    }

    await db.query(
      'UPDATE missions SET checklist = $1 WHERE id = $2',
      [JSON.stringify(checklist), id]
    );

    // Notifier le manager en temps réel
    if (mission.manager_id) {
      io.to(`user:${mission.manager_id}`).emit('mission:checklist_updated', {
        missionId: id,
        checklist,
      });
    }

    res.json({ success: true });
  } catch (err) { next(err); }
}
