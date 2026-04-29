"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const ALGORITHM = 'aes-256-gcm';
const KEY_STORAGE = new Map(); // In prod: use KMS (AWS KMS, HashiCorp Vault)
class EncryptionService {
    // ─── Encrypt Buffer ──────────────────────────────────────────
    static async encrypt(data) {
        const keyId = crypto_1.default.randomUUID();
        const key = crypto_1.default.randomBytes(32);
        const iv = crypto_1.default.randomBytes(16);
        // Store key (in production: use KMS)
        KEY_STORAGE.set(keyId, Buffer.concat([key, iv]));
        const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
        const encrypted = Buffer.concat([cipher.update(data), cipher.final(), cipher.getAuthTag()]);
        return { encrypted, keyId };
    }
    // ─── Decrypt Buffer ──────────────────────────────────────────
    static async decrypt(data, keyId) {
        const keyData = KEY_STORAGE.get(keyId);
        if (!keyData)
            throw new Error(`Encryption key not found: ${keyId}`);
        const key = keyData.slice(0, 32);
        const iv = keyData.slice(32, 48);
        const authTag = data.slice(data.length - 16);
        const encrypted = data.slice(0, data.length - 16);
        const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    }
    // ─── Delete Key (for RGPD erasure) ──────────────────────────
    static async deleteKey(keyId) {
        KEY_STORAGE.delete(keyId);
        // In production: delete from KMS
    }
    static generateRandomKey(length = 32) {
        return crypto_1.default.randomBytes(length).toString('hex');
    }
}
exports.EncryptionService = EncryptionService;
//# sourceMappingURL=encryption.service.js.map