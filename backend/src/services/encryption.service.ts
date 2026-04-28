import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_STORAGE = new Map<string, Buffer>(); // In prod: use KMS (AWS KMS, HashiCorp Vault)

export class EncryptionService {
  // ─── Encrypt Buffer ──────────────────────────────────────────
  static async encrypt(data: Buffer): Promise<{ encrypted: Buffer; keyId: string }> {
    const keyId = crypto.randomUUID();
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    // Store key (in production: use KMS)
    KEY_STORAGE.set(keyId, Buffer.concat([key, iv]));

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final(), cipher.getAuthTag()]);

    return { encrypted, keyId };
  }

  // ─── Decrypt Buffer ──────────────────────────────────────────
  static async decrypt(data: Buffer, keyId: string): Promise<Buffer> {
    const keyData = KEY_STORAGE.get(keyId);
    if (!keyData) throw new Error(`Encryption key not found: ${keyId}`);

    const key = keyData.slice(0, 32);
    const iv = keyData.slice(32, 48);
    const authTag = data.slice(data.length - 16);
    const encrypted = data.slice(0, data.length - 16);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  // ─── Delete Key (for RGPD erasure) ──────────────────────────
  static async deleteKey(keyId: string): Promise<void> {
    KEY_STORAGE.delete(keyId);
    // In production: delete from KMS
  }

  static generateRandomKey(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}
