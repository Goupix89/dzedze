"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketIO = setupSocketIO;
const logger_1 = require("../utils/logger");
function setupSocketIO(io) {
    io.on('connection', (socket) => {
        const userId = socket.handshake.auth?.userId;
        if (userId) {
            socket.join(`user:${userId}`);
            logger_1.logger.info(`Socket connected: user ${userId}`);
        }
        socket.on('join:mission', (missionId) => {
            socket.join(`mission:${missionId}`);
        });
        socket.on('leave:mission', (missionId) => {
            socket.leave(`mission:${missionId}`);
        });
        // ─── WebRTC Signaling Relay ───────────────────────────────
        // Agent → Manager : SDP offer
        socket.on('webrtc:offer', (data) => {
            logger_1.logger.info(`WebRTC offer relay → user:${data.targetUserId}`);
            io.to(`user:${data.targetUserId}`).emit('webrtc:offer', {
                fromUserId: userId,
                sessionId: data.sessionId,
                sdp: data.sdp,
            });
        });
        // Manager → Agent : SDP answer
        socket.on('webrtc:answer', (data) => {
            logger_1.logger.info(`WebRTC answer relay → user:${data.targetUserId}`);
            io.to(`user:${data.targetUserId}`).emit('webrtc:answer', {
                fromUserId: userId,
                sessionId: data.sessionId,
                sdp: data.sdp,
            });
        });
        // Both directions : ICE candidates
        socket.on('webrtc:ice', (data) => {
            io.to(`user:${data.targetUserId}`).emit('webrtc:ice', {
                fromUserId: userId,
                sessionId: data.sessionId,
                candidate: data.candidate,
            });
        });
        // Agent signals stream is live (sets session to 'active')
        socket.on('webrtc:live', (data) => {
            io.to(`user:${data.targetUserId}`).emit('webrtc:live', {
                sessionId: data.sessionId,
                agentUserId: userId,
            });
        });
        socket.on('disconnect', () => {
            if (userId)
                logger_1.logger.info(`Socket disconnected: user ${userId}`);
        });
    });
}
//# sourceMappingURL=socket.js.map