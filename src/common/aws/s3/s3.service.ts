import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import { AwsClientFactory } from '../common/aws-client.factory';

@Injectable()
export class S3Service {
  private readonly s3: AWS.S3;
  private readonly logger = new Logger(S3Service.name);
  private readonly bucketName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly awsClientFactory: AwsClientFactory,
  ) {
    const awsRegion = process.env.AWS_REGION;
    const awsAccessKey = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
    const awsBucketName = process.env.AWS_S3_BUCKET_NAME;

    this.logger.debug('AWS S3 Configuration');
    this.logger.debug(`AWS_REGION: ${awsRegion}`);
    this.logger.debug(
      `AWS_ACCESS_KEY_ID: ${
        awsAccessKey ? `${awsAccessKey.substring(0, 4)}****` : 'NOT_SET'
      }`,
    );
    this.logger.debug(
      `AWS_SECRET_ACCESS_KEY: ${awsSecretKey ? '****' : 'NOT_SET'}`,
    );
    this.logger.debug(`AWS_S3_BUCKET_NAME: ${awsBucketName}`);

    this.s3 = this.awsClientFactory.createS3Client();
    this.bucketName = awsBucketName || '';
  }

  async generatePresignedUrl(options: {
    folder?: string;
    fileName: string;
    contentType: string;
    expiresIn?: number;
  }): Promise<{ uploadUrl: string; key: string }> {
    try {
      const { folder = '', fileName, contentType, expiresIn = 300 } = options;

      const key = folder ? `${folder}/${fileName}` : fileName;

      const params = {
        Bucket: this.bucketName,
        Key: key,
        Expires: expiresIn,
        ContentType: contentType,
      };

      const uploadUrl = await this.s3.getSignedUrlPromise('putObject', params);
      this.logger.log(`Generated presigned URL for key: ${key}`);

      return {
        uploadUrl,
        key,
      };
    } catch (error: any) {
      this.logger.error(
        `Error generating presigned URL: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getPresignedUrlImage(options: {
    folder?: string;
    fileName: string;
    contentType?: string;
    expiresIn?: number;
  }): Promise<{ uploadUrl: string; key: string }> {
    try {
      const {
        folder = '',
        fileName,
        contentType = 'image/jpeg',
        expiresIn = 300,
      } = options;

      const key = folder ? `${folder}/${fileName}` : fileName;
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Expires: expiresIn,
        ContentType: contentType,
      };

      const uploadUrl = await this.s3.getSignedUrlPromise('putObject', params);
      this.logger.log(`Generated image presigned URL for key: ${key}`);

      return {
        uploadUrl,
        key,
      };
    } catch (error: any) {
      this.logger.error(
        `Error generating image presigned URL: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3
        .deleteObject({
          Bucket: this.bucketName,
          Key: key,
        })
        .promise();

      this.logger.log(`Deleted file with key: ${key}`);
    } catch (error: any) {
      this.logger.error(`Error deleting file: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getFileUrl(key: string): Promise<string> {
    const region = this.configService.get<string>('AWS_REGION');
    return `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      await this.s3
        .headObject({
          Bucket: this.bucketName,
          Key: key,
        })
        .promise();
      return true;
    } catch (error: any) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async createMultipartUpload(options: {
    key: string;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<{ uploadId: string; key: string }> {
    try {
      const result = await this.s3
        .createMultipartUpload({
          Bucket: this.bucketName,
          Key: options.key,
          ContentType: options.contentType,
          Metadata: options.metadata,
        })
        .promise();

      if (!result.UploadId) {
        throw new Error('S3 did not return an uploadId');
      }

      this.logger.log(`Created multipart upload for key: ${options.key}`);
      return {
        uploadId: result.UploadId,
        key: options.key,
      };
    } catch (error: any) {
      this.logger.error(
        `Error creating multipart upload: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async generateUploadPartPresignedUrl(options: {
    key: string;
    uploadId: string;
    partNumber: number;
    expiresIn?: number;
  }): Promise<string> {
    try {
      return await this.s3.getSignedUrlPromise('uploadPart', {
        Bucket: this.bucketName,
        Key: options.key,
        UploadId: options.uploadId,
        PartNumber: options.partNumber,
        Expires: options.expiresIn ?? 900,
      });
    } catch (error: any) {
      this.logger.error(
        `Error generating upload part URL: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async listUploadedParts(options: {
    key: string;
    uploadId: string;
  }): Promise<
    Array<{
      partNumber: number;
      etag: string;
      size: number;
      lastModified: Date | null;
    }>
  > {
    const out: Array<{
      partNumber: number;
      etag: string;
      size: number;
      lastModified: Date | null;
    }> = [];

    let partNumberMarker: number | undefined;

    try {
      do {
        const result = await this.s3
          .listParts({
            Bucket: this.bucketName,
            Key: options.key,
            UploadId: options.uploadId,
            PartNumberMarker: partNumberMarker,
          })
          .promise();

        for (const part of result.Parts ?? []) {
          if (!part.PartNumber || !part.ETag) {
            continue;
          }
          out.push({
            partNumber: part.PartNumber,
            etag: part.ETag,
            size: part.Size ?? 0,
            lastModified: part.LastModified ?? null,
          });
        }

        partNumberMarker = result.IsTruncated
          ? result.NextPartNumberMarker
          : undefined;
      } while (partNumberMarker);

      return out.sort((a, b) => a.partNumber - b.partNumber);
    } catch (error: any) {
      this.logger.error(
        `Error listing multipart upload parts: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async completeMultipartUpload(options: {
    key: string;
    uploadId: string;
    parts: Array<{ partNumber: number; etag: string }>;
  }): Promise<{ bucket: string; key: string; etag?: string; location?: string }> {
    try {
      const result = await this.s3
        .completeMultipartUpload({
          Bucket: this.bucketName,
          Key: options.key,
          UploadId: options.uploadId,
          MultipartUpload: {
            Parts: options.parts
              .slice()
              .sort((a, b) => a.partNumber - b.partNumber)
              .map((part) => ({
                PartNumber: part.partNumber,
                ETag: part.etag,
              })),
          },
        })
        .promise();

      this.logger.log(`Completed multipart upload for key: ${options.key}`);
      return {
        bucket: this.bucketName,
        key: options.key,
        etag: result.ETag,
        location: result.Location,
      };
    } catch (error: any) {
      this.logger.error(
        `Error completing multipart upload: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async abortMultipartUpload(options: {
    key: string;
    uploadId: string;
  }): Promise<void> {
    try {
      await this.s3
        .abortMultipartUpload({
          Bucket: this.bucketName,
          Key: options.key,
          UploadId: options.uploadId,
        })
        .promise();

      this.logger.log(`Aborted multipart upload for key: ${options.key}`);
    } catch (error: any) {
      this.logger.error(
        `Error aborting multipart upload: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Download için presigned URL oluştur
   */
  async generateDownloadPresignedUrl(
    key: string,
    expiresIn: number = 3600, // 1 saat varsayılan
  ): Promise<string> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Expires: expiresIn,
      };

      const downloadUrl = await this.s3.getSignedUrlPromise(
        'getObject',
        params,
      );
      this.logger.log(`Generated download presigned URL for key: ${key}`);

      return downloadUrl;
    } catch (error: any) {
      this.logger.error(
        `Error generating download presigned URL: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Dosyayı S3'e yükle
   */
  async uploadFile(
    key: string,
    body: Buffer | string,
    contentType: string = 'application/octet-stream',
  ): Promise<void> {
    try {
      await this.s3
        .putObject({
          Bucket: this.bucketName,
          Key: key,
          Body: body,
          ContentType: contentType,
        })
        .promise();

      this.logger.log(`Uploaded file to S3 with key: ${key}`);
    } catch (error: any) {
      this.logger.error(
        `Error uploading file to S3: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Dosyayı S3'ten indir
   */
  async downloadFile(key: string): Promise<Buffer> {
    try {
      const result = await this.s3
        .getObject({
          Bucket: this.bucketName,
          Key: key,
        })
        .promise();

      if (!result.Body) {
        throw new Error('File body is empty');
      }

      const buffer = Buffer.isBuffer(result.Body)
        ? result.Body
        : Buffer.from(result.Body as string);

      this.logger.log(
        `Downloaded file from S3 with key: ${key}, size: ${buffer.length} bytes`,
      );
      return buffer;
    } catch (error: any) {
      this.logger.error(
        `Error downloading file from S3: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
