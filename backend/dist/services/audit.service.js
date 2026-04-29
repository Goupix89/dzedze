"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
class AuditService {
    static async log(entry) {
        try {
            await database_1.db.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                entry.userId ?? null,
                entry.action,
                entry.resourceType,
                entry.resourceId ?? null,
                entry.details ? JSON.stringify(entry.details) : null,
                entry.ipAddress ?? null,
                entry.userAgent ?? null,
            ]);
        }
        catch (err) {
            logger_1.logger.error('Failed to write audit log:', err);
        }
    }
}
exports.AuditService = AuditService;
//# sourceMappingURL=audit.service.js.map