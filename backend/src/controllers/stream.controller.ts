import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { AuditService } from '../services/audit.service';
import { NotificationService } from '../services/notification.service';
import { AppError } from '../utils/AppError';
import { io } from '../app';
import crypto from 'crypto';

// ─── Request Stream (Manager → Agent) ────────────────────────
export async function requestStream(req: Request, res: Response, next: NextFunction) {
  try {
    const requesterId = (req as any).user.userId;
    const { missionId, reason, maxDurationMinutes = 15 } = req.body;

    if (!['admin', 'manager'].includes((req as any).user.role)) {
      throw new AppError('Seuls les managers peuvent initier un live', 403);
    }

    const missionResult = await db.query(
      'SELECT m.*, u.id as agent_id, u.first_name, u.last_name FROM missions m JOIN users u ON m.agent_id = u.id WHERE m.id = $1',
      [missionId]
    );
    const mission = missionResult.rows[0];
    if (!mission) throw new AppError('Mission introuvable', 404);
    if (mission.status !== 'in_progress') throw new AppError('La mission n\'est pas en cours', 400);

    // Check if there's already an active stream
    const existing = await db.query(
      'SELECT id FROM stream_sessions WHERE mission_id = $1 AND status IN ($2, $3, $4)',
      [missionId, 'pending', 'accepted', 'active']
    );
    if (existing.rows.length > 0) throw new AppError('Un live est déjà en cours pour cette mission', 409);

    const streamKey = crypto.randomBytes(32).toString('hex');
    const maxDuration = Math.min(Math.max(maxDurationMinutes, 5), 30);

    const result = await db.query(
      `INSERT INTO stream_sessions 
        (mission_id, agent_id, requested_by, stream_key, status, max_duration_minutes, reason)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6)
       RETURNING *`,
      [missionId, mission.agent_id, requesterId, streamKey, maxDuration, reason]
    );

    const session = result.rows[0];

    // Notify agent via WebSocket (MUST give consent)
    io.to(`user:${mission.agent_id}`).emit('stream:requested', {
      sessionId: session.id,
      requesterId,
      missionId,
      reason,
      maxDurationMinutes: maxDuration,
      message: `Votre manager demande un accès live à votre caméra. Durée max: ${maxDuration}min.`,
    });

    // Push notification
    await NotificationService.send(mission.agent_id, {
      type: 'stream_request',
      title: '📹 Demande de live',
      message: `Un manager souhaite accéder à votre caméra en direct (max ${maxDuration} min). Votre accord est requis.`,
      data: { sessionId: session.id, missionId },
    });

    await AuditService.log({
      userId: requesterId,
      action: 'STREAM_REQUESTED',
      resourceType: 'stream',
      resourceId: session.id,
      details: { missionId, agentId: mission.agent_id, maxDuration, reason },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: {
        sessionId: session.id,
        status: 'pending',
        message: 'Demande envoyée à l\'agent. En attente de son accord.',
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Agent Consent Response ───────────────────────────────────
export async function respondToStream(req: Request, res: Response, next: NextFunction) {
  try {
    const agentId = (req as any).user.userId;
    const { sessionId } = req.params;
    const { accept } = req.body;

    const result = await db.query(
      'SELECT * FROM stream_sessions WHERE id = $1 AND agent_id = $2 AND status = $3',
      [sessionId, agentId, 'pending']
    );

    const session = result.rows[0];
    if (!session) throw new AppError('Session introuvable ou déjà traitée', 404);

    const newStatus = accept ? 'accepted' : 'refused';

    await db.query(
      'UPDATE stream_sessions SET status = $1, agent_consent = $2, consent_at = NOW() WHERE id = $3',
      [newStatus, accept, sessionId]
    );

    // Record consent
    await db.query(
      `INSERT INTO consent_records (user_id, consent_type, version, given, ip_address)
       VALUES ($1, 'live_stream', '1.0', $2, $3)`,
      [agentId, accept, req.ip]
    );

    // Notify requester
    io.to(`user:${session.requested_by}`).emit('stream:response', {
      sessionId,
      accepted: accept,
      streamKey: accept ? session.stream_key : null,
    });

    await AuditService.log({
      userId: agentId,
      action: accept ? 'STREAM_ACCEPTED' : 'STREAM_REFUSED',
      resourceType: 'stream',
      resourceId: sessionId,
      ipAddress: req.ip,
    });

    if (accept) {
      // Auto-end stream after max duration
      setTimeout(async () => {
        const current = await db.query('SELECT status FROM stream_sessions WHERE id = $1', [sessionId]);
        if (current.rows[0]?.status === 'active') {
          await endStream(sessionId, 'auto_timeout');
        }
      }, session.max_duration_minutes * 60 * 1000);
    }

    res.json({
      success: true,
      data: {
        accepted: accept,
        streamKey: accept ? session.stream_key : null,
        message: accept ? 'Live démarré. L\'agent a donné son accord.' : 'L\'agent a refusé le live.',
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── End Stream ───────────────────────────────────────────────
export async function stopStream(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.userId;
    const { sessionId } = req.params;

    const result = await db.query(
      'SELECT * FROM stream_sessions WHERE id = $1 AND status IN ($2, $3)',
      [sessionId, 'accepted', 'active']
    );

    const session = result.rows[0];
    if (!session) throw new AppError('Session introuvable ou déjà terminée', 404);

    const user = (req as any).user;
    // Agent can stop their own stream, manager can stop any
    if (user.role === 'agent' && session.agent_id !== userId) {
      throw new AppError('Non autorisé', 403);
    }

    await endStream(sessionId, 'manual_stop');

    io.to(`user:${session.requested_by}`).emit('stream:ended', { sessionId });
    io.to(`user:${session.agent_id}`).emit('stream:ended', { sessionId });

    await AuditService.log({
      userId,
      action: 'STREAM_ENDED',
      resourceType: 'stream',
      resourceId: sessionId,
      details: { stoppedBy: userId },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Live terminé' });
  } catch (err) {
    next(err);
  }
}

async function endStream(sessionId: string, reason: string) {
  await db.query(
    'UPDATE stream_sessions SET status = $1, ended_at = NOW() WHERE id = $2',
    ['ended', sessionId]
  );
}

// ─── Get Stream Info ──────────────────────────────────────────
export async function getStreamSession(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.userId;
    const { sessionId } = req.params;

    const result = await db.query(`
      SELECT ss.*, 
             u_agent.first_name || ' ' || u_agent.last_name as agent_name,
             u_req.first_name || ' ' || u_req.last_name as requester_name
      FROM stream_sessions ss
      JOIN users u_agent ON ss.agent_id = u_agent.id
      JOIN users u_req ON ss.requested_by = u_req.id
      WHERE ss.id = $1
    `, [sessionId]);

    const session = result.rows[0];
    if (!session) throw new AppError('Session introuvable', 404);

    const user = (req as any).user;
    if (user.role === 'agent' && session.agent_id !== userId) throw new AppError('Accès refusé', 403);

    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
}
