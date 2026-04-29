export declare function initializeStorage(): Promise<void>;
export declare class StorageService {
    static upload(data: Buffer, key: string, contentType: string): Promise<void>;
    static download(key: string): Promise<Buffer>;
    static delete(key: string): Promise<void>;
    static getPresignedUrl(key: string, expirySeconds?: number): Promise<string>;
    static getUploadUrl(key: string, expirySeconds?: number): Promise<string>;
}
//# sourceMappingURL=storage.service.d.ts.map