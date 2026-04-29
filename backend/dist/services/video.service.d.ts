import { Readable, PassThrough } from 'stream';
interface ProcessedVideo {
    buffer: Buffer;
    thumbnail: Buffer;
    duration: number;
    width: number;
    height: number;
    codec: string;
}
export declare class VideoService {
    private static readonly MAX_DURATION_SECONDS;
    private static readonly TARGET_BITRATE;
    private static readonly TARGET_RESOLUTION;
    static processVideo(inputBuffer: Buffer, mimeType: string): Promise<ProcessedVideo>;
    private static getExtension;
    private static getMetadata;
    private static compressVideo;
    private static generateThumbnail;
    static stripMetadata(buffer: Buffer, mimeType: string): Promise<Buffer>;
    static createHLSStream(inputStream: Readable, outputDir: string): PassThrough;
}
export {};
//# sourceMappingURL=video.service.d.ts.map