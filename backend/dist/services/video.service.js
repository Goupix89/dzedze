"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoService = void 0;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const stream_1 = require("stream");
const logger_1 = require("../utils/logger");
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const crypto_1 = __importDefault(require("crypto"));
class VideoService {
    static async processVideo(inputBuffer, mimeType) {
        const tmpDir = os_1.default.tmpdir();
        const tmpId = crypto_1.default.randomBytes(8).toString('hex');
        const inputPath = path_1.default.join(tmpDir, `input_${tmpId}.${this.getExtension(mimeType)}`);
        const outputPath = path_1.default.join(tmpDir, `output_${tmpId}.mp4`);
        const thumbPath = path_1.default.join(tmpDir, `thumb_${tmpId}.jpg`);
        try {
            await promises_1.default.writeFile(inputPath, inputBuffer);
            // Get metadata
            const metadata = await this.getMetadata(inputPath);
            const duration = Math.min(metadata.duration || 0, this.MAX_DURATION_SECONDS);
            logger_1.logger.info(`Processing video: ${metadata.duration}s, ${metadata.width}x${metadata.height}`);
            // Compress & normalize
            await this.compressVideo(inputPath, outputPath, duration);
            // Generate thumbnail at 1s
            await this.generateThumbnail(inputPath, thumbPath);
            const [videoBuffer, thumbBuffer] = await Promise.all([
                promises_1.default.readFile(outputPath),
                promises_1.default.readFile(thumbPath),
            ]);
            return {
                buffer: videoBuffer,
                thumbnail: thumbBuffer,
                duration,
                width: parseInt(this.TARGET_RESOLUTION.split('x')[0]),
                height: parseInt(this.TARGET_RESOLUTION.split('x')[1]),
                codec: 'h264',
            };
        }
        finally {
            // Cleanup temp files
            await Promise.allSettled([
                promises_1.default.unlink(inputPath),
                promises_1.default.unlink(outputPath),
                promises_1.default.unlink(thumbPath),
            ]);
        }
    }
    static getExtension(mimeType) {
        const map = {
            'video/mp4': 'mp4',
            'video/quicktime': 'mov',
            'video/x-msvideo': 'avi',
            'video/webm': 'webm',
        };
        return map[mimeType] || 'mp4';
    }
    static getMetadata(filePath) {
        return new Promise((resolve, reject) => {
            fluent_ffmpeg_1.default.ffprobe(filePath, (err, metadata) => {
                if (err)
                    return reject(err);
                const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                resolve({
                    duration: metadata.format.duration || 0,
                    width: videoStream?.width || 1280,
                    height: videoStream?.height || 720,
                });
            });
        });
    }
    static compressVideo(inputPath, outputPath, maxDuration) {
        return new Promise((resolve, reject) => {
            let command = (0, fluent_ffmpeg_1.default)(inputPath)
                .outputOptions([
                '-c:v libx264',
                '-crf 23', // Quality factor (18-28, lower = better)
                `-b:v ${this.TARGET_BITRATE}`,
                '-maxrate 2000k',
                '-bufsize 4000k',
                '-preset fast',
                '-c:a aac',
                '-b:a 128k',
                '-movflags +faststart', // Web optimized
                '-vf', `scale=${this.TARGET_RESOLUTION}:force_original_aspect_ratio=decrease,pad=${this.TARGET_RESOLUTION}:(ow-iw)/2:(oh-ih)/2`,
                // Strip metadata for privacy
                '-map_metadata -1',
            ]);
            if (maxDuration < 90) {
                command = command.duration(maxDuration);
            }
            command
                .output(outputPath)
                .on('start', (cmd) => logger_1.logger.debug(`FFmpeg: ${cmd}`))
                .on('progress', (p) => logger_1.logger.debug(`Video processing: ${p.percent?.toFixed(1)}%`))
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });
    }
    static generateThumbnail(inputPath, outputPath) {
        return new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)(inputPath)
                .screenshots({
                timestamps: ['1'],
                filename: path_1.default.basename(outputPath),
                folder: path_1.default.dirname(outputPath),
                size: '640x360',
            })
                .on('end', () => resolve())
                .on('error', (err) => reject(err));
        });
    }
    // ─── Strip video metadata (RGPD: remove GPS, device info) ──
    static async stripMetadata(buffer, mimeType) {
        const tmpDir = os_1.default.tmpdir();
        const tmpId = crypto_1.default.randomBytes(8).toString('hex');
        const inputPath = path_1.default.join(tmpDir, `strip_in_${tmpId}`);
        const outputPath = path_1.default.join(tmpDir, `strip_out_${tmpId}.mp4`);
        try {
            await promises_1.default.writeFile(inputPath, buffer);
            await new Promise((resolve, reject) => {
                (0, fluent_ffmpeg_1.default)(inputPath)
                    .outputOptions(['-map_metadata -1', '-c copy'])
                    .output(outputPath)
                    .on('end', () => resolve())
                    .on('error', reject)
                    .run();
            });
            return promises_1.default.readFile(outputPath);
        }
        finally {
            await Promise.allSettled([promises_1.default.unlink(inputPath), promises_1.default.unlink(outputPath)]);
        }
    }
    // ─── Create HLS stream for live preview ──────────────────
    static createHLSStream(inputStream, outputDir) {
        const output = new stream_1.PassThrough();
        (0, fluent_ffmpeg_1.default)(inputStream)
            .inputFormat('mp4')
            .outputOptions([
            '-c:v libx264', '-c:a aac',
            '-f hls',
            '-hls_time 2',
            '-hls_list_size 3',
            '-hls_flags delete_segments',
        ])
            .output(path_1.default.join(outputDir, 'stream.m3u8'))
            .on('error', (err) => logger_1.logger.error('HLS stream error:', err))
            .pipe(output);
        return output;
    }
}
exports.VideoService = VideoService;
VideoService.MAX_DURATION_SECONDS = 90; // 60-90 sec max
VideoService.TARGET_BITRATE = '1500k';
VideoService.TARGET_RESOLUTION = '1280x720';
//# sourceMappingURL=video.service.js.map