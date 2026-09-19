import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger(UploadsService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor() {
    this.endpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9100';
    this.bucket = process.env.S3_BUCKET ?? 'gymbros-uploads';
    this.s3 = new S3Client({
      endpoint: this.endpoint,
      region: process.env.S3_REGION ?? 'eu-west-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? 'gymbros',
        secretAccessKey: process.env.S3_SECRET_KEY ?? 'gymbros123',
      },
      forcePathStyle: true, // MinIO
    });
  }

  /** Local convenience: make sure the dev bucket exists in MinIO. */
  async onModuleInit() {
    if (process.env.NODE_ENV === 'production') return;
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created bucket ${this.bucket}`);
      } catch (error) {
        this.logger.warn(`Could not ensure bucket ${this.bucket} (S3 offline?)`, error as Error);
      }
    }
  }

  async presign(userId: string, kind: 'avatar' | 'chat', contentType: string) {
    const key = `${kind}/${userId}/${randomUUID()}.${EXT_BY_TYPE[contentType] ?? 'bin'}`;
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: 300 },
    );
    return { uploadUrl, fileUrl: `${this.endpoint}/${this.bucket}/${key}`, key, expiresIn: 300 };
  }
}
