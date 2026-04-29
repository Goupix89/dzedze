"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const { combine, timestamp, errors, json, colorize, simple } = winston_1.default.format;
const fileTransport = new winston_daily_rotate_file_1.default({
    filename: 'logs/app-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d',
    maxSize: '50m',
    format: combine(timestamp(), errors({ stack: true }), json()),
});
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports: [
        fileTransport,
        new winston_1.default.transports.Console({
            format: combine(colorize(), simple()),
            silent: process.env.NODE_ENV === 'test',
        }),
    ],
});
//# sourceMappingURL=logger.js.map