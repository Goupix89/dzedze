import { Server as SocketServer } from 'socket.io';
import { logger } from '../utils/logger';
import { redis } from './redis';

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

    socket.on('disconnect', () => {
      if (userId) logger.info(`Socket disconnected: user ${userId}`);
    });
  });
}
