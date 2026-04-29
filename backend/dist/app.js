"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const node_cron_1 = __importDefault(require("node-cron"));
const logger_1 = require("./utils/logger");
const database_1 = require("./config/database");
const redis_1 = require("./config/redis");
const storage_1 = require("./config/storage");
const rateLimiter_1 = require("./middleware/rateLimiter");
const errorHandler_1 = require("./middleware/errorHandler");
const socket_1 = require("./config/socket");
const routes_1 = __importDefault(require("./routes"));
const media_cleanup_service_1 = require("./services/media-cleanup.service");
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
// ─── Socket.IO Setup ──────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map(o => o.trim())
    .concat(['http://localhost:5174', 'http://localhost:5175']); // Flutter web
exports.io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket', 'polling'],
});
// ─── Security Middleware ──────────────────────────────────────
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            mediaSrc: ["'self'", 'blob:', 'data:'],
        },
    },
}));
app.use((0, cors_1.default)({
    origin: ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));
// ─── General Middleware ───────────────────────────────────────
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, morgan_1.default)('combined', { stream: { write: (msg) => logger_1.logger.http(msg.trim()) } }));
app.use(rateLimiter_1.rateLimiter);
// ─── Request ID ───────────────────────────────────────────────
app.use((req, _res, next) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || crypto.randomUUID();
    next();
});
// ─── Health Check ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString(), version: '1.0.0' });
});
// ─── API Routes ───────────────────────────────────────────────
app.use('/api/v1', routes_1.default);
// ─── Error Handler ────────────────────────────────────────────
app.use(errorHandler_1.errorHandler);
// ─── Cron Jobs ────────────────────────────────────────────────
// Clean expired media daily at 2 AM
node_cron_1.default.schedule('0 2 * * *', async () => {
    logger_1.logger.info('Running media cleanup cron job...');
    await media_cleanup_service_1.MediaCleanupService.cleanExpiredMedia();
});
// ─── Boot ─────────────────────────────────────────────────────
async function bootstrap() {
    try {
        await (0, database_1.connectDatabase)();
        await (0, redis_1.connectRedis)();
        await (0, storage_1.initializeStorage)();
        (0, socket_1.setupSocketIO)(exports.io);
        const PORT = parseInt(process.env.PORT || '3000', 10);
        httpServer.listen(PORT, () => {
            logger_1.logger.info(`🚀 Server running on port ${PORT}`);
            logger_1.logger.info(`📦 Environment: ${process.env.NODE_ENV}`);
            logger_1.logger.info(`🔒 RGPD compliance: enabled`);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
process.on('SIGTERM', async () => {
    logger_1.logger.info('SIGTERM received, shutting down gracefully...');
    httpServer.close(() => {
        logger_1.logger.info('HTTP server closed');
        process.exit(0);
    });
});
bootstrap();
exports.default = app;
//# sourceMappingURL=app.js.map