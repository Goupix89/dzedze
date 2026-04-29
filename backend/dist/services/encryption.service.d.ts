export declare class EncryptionService {
    static encrypt(data: Buffer): Promise<{
        encrypted: Buffer;
        keyId: string;
    }>;
    static decrypt(data: Buffer, keyId: string): Promise<Buffer>;
    static deleteKey(keyId: string): Promise<void>;
    static generateRandomKey(length?: number): string;
}
//# sourceMappingURL=encryption.service.d.ts.map