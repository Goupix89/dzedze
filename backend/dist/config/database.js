"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.connectDatabase = connectDatabase;
const pg_1 = require("pg");
const logger_1 = require("../utils/logger");
exports.db = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});
exports.db.on('error', (err) => logger_1.logger.error('Unexpected database error:', err));
async function connectDatabase() {
    const client = await exports.db.connect();
    client.release();
    logger_1.logger.info('Database connected');
}
//# sourceMappingURL=database.js.map