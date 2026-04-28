import { Server as SocketServer } from 'socket.io';
import { logger } from '../utils/logger';

export function setupSocketIO(io: SocketServer): void {
  io.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId as string | undefined;
    if (userId) {
      socket.join(`user:${userId}`);
      logger.info(`Socket connected: user ${userId}`);
    }

    socket.on('join:mission', (missionId: string) => {
      socket.join(`mission:${missionId}`);
    });

    socket.on('leave:mission', (missionId: string) => {
      socket.leave(`mission:${missionId}`);
    });

    // ─── WebRTC Signaling Relay ───────────────────────────────
    // Agent → Manager : SDP offer
    socket.on('webrtc:offer', (data: { targetUserId: string; sessionId: string; sdp: Record<string, unknown> }) => {
      logger.info(`WebRTC offer relay → user:${data.targetUserId}`);
      io.to(`user:${data.targetUserId}`).emit('webrtc:offer', {
        fromUserId: userId,
        sessionId: data.sessionId,
        sdp: data.sdp,
      });
    });

    // Manager → Agent : SDP answer
    socket.on('webrtc:answer', (data: { targetUserId: string; sessionId: string; sdp: Record<string, unknown> }) => {
      logger.info(`WebRTC answer relay → user:${data.targetUserId}`);
      io.to(`user:${data.targetUserId}`).emit('webrtc:answer', {
        fromUserId: userId,
        sessionId: data.sessionId,
        sdp: data.sdp,
      });
    });

    // Both directions : ICE candidates
    socket.on('webrtc:ice', (data: { targetUserId: string; sessionId: string; candidate: Record<string, unknown> }) => {
      io.to(`user:${data.targetUserId}`).emit('webrtc:ice', {
        fromUserId: userId,
        sessionId: data.sessionId,
        candidate: data.candidate,
      });
    });

    // Agent signals stream is live (sets session to 'active')
    socket.on('webrtc:live', (data: { sessionId: string; targetUserId: string }) => {
      io.to(`user:${data.targetUserId}`).emit('webrtc:live', {
        sessionId: data.sessionId,
        agentUserId: userId,
      });
    });

    socket.on('disconnect', () => {
      if (userId) logger.info(`Socket disconnected: user ${userId}`);
    });
  });
}
