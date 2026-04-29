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
exports.StorageService = void 0;
exports.initializeStorage = initializeStorage;
const Minio = __importStar(require("minio"));
const logger_1 = require("../utils/logger");
const client = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
});
const BUCKET = process.env.MINIO_BUCKET || 'cleaning-supervision';
async function initializeStorage() {
    const exists = await client.bucketExists(BUCKET);
    if (!exists) {
        await client.makeBucket(BUCKET, 'eu-west-1');
        // Set bucket lifecycle: auto-delete after 30 days
        await client.setBucketLifecycle(BUCKET, {
            Rule: [{
                    ID: 'auto-expire',
                    Status: 'Enabled',
                    Expiration: { Days: 30 },
                }],
        });
        logger_1.logger.info(`Created bucket: ${BUCKET}`);
    }
}
class StorageService {
    static async upload(data, key, contentType) {
        await client.putObject(BUCKET, key, data, data.length, {
            'Content-Type': contentType,
            'X-Amz-Server-Side-Encryption': 'AES256',
        });
    }
    static async download(key) {
        const stream = await client.getObject(BUCKET, key);
        return new Promise((resolve, reject) => {
            const chunks = [];
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
        });
    }
    static async delete(key) {
        await client.removeObject(BUCKET, key);
    }
    static async getPresignedUrl(key, expirySeconds = 900) {
        return client.presignedGetObject(BUCKET, key, expirySeconds);
    }
    static async getUploadUrl(key, expirySeconds = 300) {
        return client.presignedPutObject(BUCKET, key, expirySeconds);
    }
}
exports.StorageService = StorageService;
//# sourceMappingURL=storage.service.js.map