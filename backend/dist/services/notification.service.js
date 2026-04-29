"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
class NotificationService {
    static async send(userId, notification) {
        try {
            const result = await database_1.db.query('SELECT fcm_token FROM users WHERE id = $1 AND fcm_token IS NOT NULL', [userId]);
            if (!result.rows[0]?.fcm_token)
                return;
            // Firebase Admin SDK push (lazy-init to avoid startup failure if unconfigured)
            const admin = await Promise.resolve().then(() => __importStar(require('firebase-admin')));
            if (!admin.apps.length)
                return;
            await admin.messaging().send({
                token: result.rows[0].fcm_token,
                notification: { title: notification.title, body: notification.message },
                data: notification.data
                    ? Object.fromEntries(Object.entries(notification.data).map(([k, v]) => [k, String(v)]))
                    : undefined,
            });
        }
        catch (err) {
            logger_1.logger.error(`Failed to send notification to user ${userId}:`, err);
        }
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=notification.service.js.map