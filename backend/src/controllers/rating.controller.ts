import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { AuditService } from '../services/audit.service';
import { AppError } from '../utils/AppError';

type UserPayload = { userId: string; role: string };

function auth(req: Request): UserPayload {
  return (req as Request & { user?: UserPayload }).user as UserPayload;
}

function assertRole(req: Request, roles: string[]) {
  if (!roles.includes(auth(req).role)) {
    throw new AppError(`Accès réservé aux rôles : ${roles.join(', ')}`, 403);
  }
}

export async function submitMissionRating(req: Request, res: Response, next: NextFunction) {
  try {
    assertRole(req, ['admin', 'manager']);
    const { userId } = auth(req);
    const { id } = req.params;
    const { score, comment } = req.body as { score?: number; comment?: string };

    if (score == null || score < 1 || score > 5) {
      throw new AppError('Score invalide : 1 à 5', 400);
    }

    const result = await db.query('SELECT * FROM missions WHERE id = $1', [id]);
    const mission = result.rows[0];
    if (!mission) throw new AppError('Mission introuvable', 404);

    if (!['in_progress', 'review'].includes(mission.status)) {
      throw new AppError('La mission doit être en cours ou en revue pour être notée', 400);
    }

    await db.query(`
      UPDATE missions
      SET status        = 'completed',
          quality_score = $1,
          notes         = COALESCE($2, notes)
      WHERE id = $3
    `, [score, comment ?? null, id]);

    await db.query('SELECT fn_update_agent_quality_score($1)', [mission.agent_id]);

    await AuditService.log({
      userId,
      action: 'MISSION_RATED',
      resourceType: 'mission',
      resourceId: id,
      details: { score, comment },
    });

    res.json({ success: true, message: 'Note enregistrée', data: { score } });
  } catch (err) {
    next(err);
  }
}

export async function getAgentRatings(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = auth(req);
    const { id } = req.params;

    if (role === 'agent' && id !== userId) {
      throw new AppError('Accès refusé', 403);
    }

    const result = await db.query(`
      SELECT
        m.id AS mission_id,
        m.title,
        m.scheduled_start,
        m.completed_at,
        m.quality_score AS score,
        m.notes AS feedback,
        u.first_name || ' ' || u.last_name AS manager_name
      FROM missions m
      LEFT JOIN users u ON u.id = m.manager_id
      WHERE m.agent_id = $1
        AND m.quality_score IS NOT NULL
      ORDER BY m.completed_at DESC
      LIMIT 50
    `, [id]);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}
