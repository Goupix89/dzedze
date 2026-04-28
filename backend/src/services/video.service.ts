import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from 'stream';
import { logger } from '../utils/logger';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

interface ProcessedVideo {
  buffer: Buffer;
  thumbnail: Buffer;
  duration: number;
  width: number;
  height: number;
  codec: string;
}

export class VideoService {
  private static readonly MAX_DURATION_SECONDS = 90; // 60-90 sec max
  private static readonly TARGET_BITRATE = '1500k';
  private static readonly TARGET_RESOLUTION = '1280x720';

  static async processVideo(inputBuffer: Buffer, mimeType: string): Promise<ProcessedVideo> {
    const tmpDir = os.tmpdir();
    const tmpId = crypto.randomBytes(8).toString('hex');
    const inputPath = path.join(tmpDir, `input_${tmpId}.${this.getExtension(mimeType)}`);
    const outputPath = path.join(tmpDir, `output_${tmpId}.mp4`);
    const thumbPath = path.join(tmpDir, `thumb_${tmpId}.jpg`);

    try {
      await fs.writeFile(inputPath, inputBuffer);

      // Get metadata
      const metadata = await this.getMetadata(inputPath);
      const duration = Math.min(metadata.duration || 0, this.MAX_DURATION_SECONDS);

      logger.info(`Processing video: ${metadata.duration}s, ${metadata.width}x${metadata.height}`);

      // Compress & normalize
      await this.compressVideo(inputPath, outputPath, duration);

      // Generate thumbnail at 1s
      await this.generateThumbnail(inputPath, thumbPath);

      const [videoBuffer, thumbBuffer] = await Promise.all([
        fs.readFile(outputPath),
        fs.readFile(thumbPath),
      ]);

      return {
        buffer: videoBuffer,
        thumbnail: thumbBuffer,
        duration,
        width: parseInt(this.TARGET_RESOLUTION.split('x')[0]),
        height: parseInt(this.TARGET_RESOLUTION.split('x')[1]),
        codec: 'h264',
      };
    } finally {
      // Cleanup temp files
      await Promise.allSettled([
        fs.unlink(inputPath),
        fs.unlink(outputPath),
        fs.unlink(thumbPath),
      ]);
    }
  }

  private static getExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/x-msvideo': 'avi',
      'video/webm': 'webm',
    };
    return map[mimeType] || 'mp4';
  }

  private static getMetadata(filePath: string): Promise<{ duration: number; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(err);
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        resolve({
          duration: metadata.format.duration || 0,
          width: videoStream?.width || 1280,
          height: videoStream?.height || 720,
        });
      });
    });
  }

  private static compressVideo(inputPath: string, outputPath: string, maxDuration: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',
          '-crf 23',             // Quality factor (18-28, lower = better)
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
        .on('start', (cmd) => logger.debug(`FFmpeg: ${cmd}`))
        .on('progress', (p) => logger.debug(`Video processing: ${p.percent?.toFixed(1)}%`))
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  private static generateThumbnail(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: ['1'],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '640x360',
        })
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });
  }

  // ─── Strip video metadata (RGPD: remove GPS, device info) ──
  static async stripMetadata(buffer: Buffer, mimeType: string): Promise<Buffer> {
    const tmpDir = os.tmpdir();
    const tmpId = crypto.randomBytes(8).toString('hex');
    const inputPath = path.join(tmpDir, `strip_in_${tmpId}`);
    const outputPath = path.join(tmpDir, `strip_out_${tmpId}.mp4`);

    try {
      await fs.writeFile(inputPath, buffer);
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions(['-map_metadata -1', '-c copy'])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', reject)
          .run();
      });
      return fs.readFile(outputPath);
    } finally {
      await Promise.allSettled([fs.unlink(inputPath), fs.unlink(outputPath)]);
    }
  }

  // ─── Create HLS stream for live preview ──────────────────
  static createHLSStream(inputStream: Readable, outputDir: string): PassThrough {
    const output = new PassThrough();
    ffmpeg(inputStream)
      .inputFormat('mp4')
      .outputOptions([
        '-c:v libx264', '-c:a aac',
        '-f hls',
        '-hls_time 2',
        '-hls_list_size 3',
        '-hls_flags delete_segments',
      ])
      .output(path.join(outputDir, 'stream.m3u8'))
      .on('error', (err) => logger.error('HLS stream error:', err))
      .pipe(output);
    return output;
  }
}
