import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import type { JwtUserShape } from '../access/access-policy.service';
import { S3Service } from '../common/aws/s3/s3.service';
import { AbortUploadDto } from './dto/abort-upload.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { InitUploadDto } from './dto/init-upload.dto';
import { SignPartDto } from './dto/sign-part.dto';
import {
  UploadSession,
  UploadSessionStatus,
} from './entities/upload-session.entity';

const MEBIBYTE = 1024 * 1024;
const DEFAULT_PART_SIZE = 16 * MEBIBYTE;
const MAX_S3_PARTS = 10_000;
const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PART_URL_EXPIRES_SECONDS = 900;
const DEFAULT_CLEANUP_BATCH_SIZE = 100;

@Injectable()
export class UploadsService {
  constructor(
    @InjectRepository(UploadSession)
    private readonly sessions: Repository<UploadSession>,
    private readonly s3: S3Service,
    private readonly configService: ConfigService,
  ) {}

  async initUpload(user: JwtUserShape, body: InitUploadDto) {
    this.assertUploadUser(user);

    const fileName = body.fileName.trim();
    if (!fileName) {
      throw new BadRequestException('fileName is required');
    }
    if (!body.contentType.trim()) {
      throw new BadRequestException('contentType is required');
    }

    const sessionId = randomUUID();
    const now = new Date();
    const partSize = this.calculatePartSize(body.fileSize);
    const objectKey = this.buildObjectKey(user, body.fileName);
    const bucketName = this.getBucketName();
    if (!bucketName) {
      throw new BadRequestException('AWS_S3_BUCKET_NAME is not configured');
    }

    const multipart = await this.s3.createMultipartUpload({
      key: objectKey,
      contentType: body.contentType,
      metadata: this.normalizeMetadata(body.metadata),
    });

    const session = this.sessions.create({
      id: sessionId,
      userId: user.id,
      organizationId: user.organizationId ?? '',
      bucketName,
      objectKey,
      originalFileName: fileName,
      contentType: body.contentType.trim(),
      fileSize: String(body.fileSize),
      partSize,
      uploadId: multipart.uploadId,
      status: UploadSessionStatus.INITIATED,
      expiresAt: new Date(now.getTime() + this.getSessionTtlMs()),
      lastActivityAt: now,
      completedAt: null,
      errorMessage: null,
    });

    await this.sessions.save(session);

    return {
      sessionId: session.id,
      uploadId: session.uploadId,
      bucket: session.bucketName,
      objectKey: session.objectKey,
      fileName: session.originalFileName,
      contentType: session.contentType,
      fileSize: Number(session.fileSize),
      partSize: session.partSize,
      expiresAt: session.expiresAt,
      status: session.status,
    };
  }

  async signParts(user: JwtUserShape, body: SignPartDto) {
    this.assertUploadUser(user);
    const session = await this.getOwnedSession(user.id, body.sessionId);

    if (this.isTerminalStatus(session.status)) {
      throw new BadRequestException(
        `Upload session is already ${session.status}`,
      );
    }
    this.ensureNotExpired(session);

    const urls = await Promise.all(
      body.partNumbers.map(async (partNumber) => ({
        partNumber,
        url: await this.s3.generateUploadPartPresignedUrl({
          key: session.objectKey,
          uploadId: session.uploadId,
          partNumber,
          expiresIn: this.getPartUrlExpiresSeconds(),
        }),
      })),
    );

    session.status = UploadSessionStatus.UPLOADING;
    session.lastActivityAt = new Date();
    session.errorMessage = null;
    await this.sessions.save(session);

    return {
      sessionId: session.id,
      uploadId: session.uploadId,
      objectKey: session.objectKey,
      partSize: session.partSize,
      urls,
    };
  }

  async completeUpload(user: JwtUserShape, body: CompleteUploadDto) {
    this.assertUploadUser(user);
    const session = await this.getOwnedSession(user.id, body.sessionId);

    if (session.status === UploadSessionStatus.COMPLETED) {
      return this.buildStatusPayload(session, []);
    }
    if (session.status === UploadSessionStatus.ABORTED) {
      throw new BadRequestException('Upload session has been aborted');
    }
    this.ensureNotExpired(session);

    const uniquePartNumbers = new Set(body.parts.map((part) => part.partNumber));
    if (uniquePartNumbers.size !== body.parts.length) {
      throw new BadRequestException('Duplicate partNumber values are not allowed');
    }

    const completed = await this.s3.completeMultipartUpload({
      key: session.objectKey,
      uploadId: session.uploadId,
      parts: body.parts,
    });

    session.status = UploadSessionStatus.COMPLETED;
    session.completedAt = new Date();
    session.lastActivityAt = session.completedAt;
    session.errorMessage = null;
    await this.sessions.save(session);

    return {
      ...this.buildStatusPayload(session, []),
      result: completed,
    };
  }

  async abortUpload(user: JwtUserShape, body: AbortUploadDto) {
    this.assertUploadUser(user);
    const session = await this.getOwnedSession(user.id, body.sessionId);

    if (session.status === UploadSessionStatus.COMPLETED) {
      throw new BadRequestException('Completed upload sessions cannot be aborted');
    }
    if (session.status === UploadSessionStatus.ABORTED) {
      return this.buildAbortPayload(session);
    }

    await this.abortSessionOnS3(session);

    session.status = UploadSessionStatus.ABORTED;
    session.lastActivityAt = new Date();
    session.errorMessage = 'Upload aborted by user';
    await this.sessions.save(session);

    return this.buildAbortPayload(session);
  }

  async getStatus(user: JwtUserShape, sessionId: string) {
    this.assertUploadUser(user);
    const session = await this.getOwnedSession(user.id, sessionId);

    if (session.status === UploadSessionStatus.COMPLETED) {
      return this.buildStatusPayload(session, []);
    }

    const uploadedParts = this.isTerminalStatus(session.status)
      ? []
      : await this.s3.listUploadedParts({
          key: session.objectKey,
          uploadId: session.uploadId,
        });

    session.lastActivityAt = new Date();
    await this.sessions.save(session);

    return this.buildStatusPayload(session, uploadedParts);
  }

  async listActiveUploads(user: JwtUserShape) {
    this.assertUploadUser(user);
    const sessions = await this.sessions.find({
      where: {
        userId: user.id,
        status: In([
          UploadSessionStatus.INITIATED,
          UploadSessionStatus.UPLOADING,
          UploadSessionStatus.FAILED,
        ]),
      },
      order: { updatedAt: 'DESC' },
    });

    return sessions.map((session) => ({
      sessionId: session.id,
      uploadId: session.uploadId,
      objectKey: session.objectKey,
      fileName: session.originalFileName,
      contentType: session.contentType,
      fileSize: Number(session.fileSize),
      partSize: session.partSize,
      status: session.status,
      expiresAt: session.expiresAt,
      lastActivityAt: session.lastActivityAt,
      completedAt: session.completedAt,
      errorMessage: session.errorMessage,
    }));
  }

  async abortExpiredSessions() {
    const now = new Date();
    const candidates = await this.sessions.find({
      where: {
        status: In([
          UploadSessionStatus.INITIATED,
          UploadSessionStatus.UPLOADING,
          UploadSessionStatus.FAILED,
        ]),
        expiresAt: LessThanOrEqual(now),
      },
      order: { expiresAt: 'ASC' },
      take: this.getCleanupBatchSize(),
    });

    let abortedCount = 0;

    for (const session of candidates) {
      await this.abortSessionOnS3(session);
      session.status = UploadSessionStatus.ABORTED;
      session.lastActivityAt = now;
      session.errorMessage = 'Upload session expired and was aborted';
      await this.sessions.save(session);
      abortedCount += 1;
    }

    return {
      scannedCount: candidates.length,
      abortedCount,
    };
  }

  private async getOwnedSession(userId: string, sessionId: string) {
    const session = await this.sessions.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Upload session not found');
    }

    return session;
  }

  private buildStatusPayload(
    session: UploadSession,
    uploadedParts: Array<{
      partNumber: number;
      etag: string;
      size: number;
      lastModified: Date | null;
    }>,
  ) {
    const uploadedBytes =
      session.status === UploadSessionStatus.COMPLETED
        ? Number(session.fileSize)
        : uploadedParts.reduce((sum, part) => sum + part.size, 0);

    return {
      sessionId: session.id,
      uploadId: session.uploadId,
      bucket: session.bucketName,
      objectKey: session.objectKey,
      fileName: session.originalFileName,
      contentType: session.contentType,
      fileSize: Number(session.fileSize),
      partSize: session.partSize,
      status: session.status,
      expiresAt: session.expiresAt,
      lastActivityAt: session.lastActivityAt,
      completedAt: session.completedAt,
      errorMessage: session.errorMessage,
      uploadedBytes,
      uploadedParts,
    };
  }

  private buildAbortPayload(session: UploadSession) {
    return {
      sessionId: session.id,
      uploadId: session.uploadId,
      objectKey: session.objectKey,
      status: session.status,
      lastActivityAt: session.lastActivityAt,
      errorMessage: session.errorMessage,
    };
  }

  private buildObjectKey(
    user: JwtUserShape,
    fileName: string,
  ) {
    const normalizedEmail = this.normalizeUploaderEmail(user.email);
    const exactFileName = this.normalizeObjectFileName(fileName);

    return `Construction-Uploads/${normalizedEmail}/${exactFileName}`;
  }

  private calculatePartSize(fileSize: number) {
    const minimumForPartLimit = Math.ceil(fileSize / MAX_S3_PARTS);
    const rawSize = Math.max(DEFAULT_PART_SIZE, minimumForPartLimit);
    return Math.ceil(rawSize / MEBIBYTE) * MEBIBYTE;
  }

  private normalizeMetadata(metadata?: Record<string, string>) {
    if (!metadata) {
      return undefined;
    }

    return Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => [
        this.sanitizePathSegment(key),
        String(value),
      ]),
    );
  }

  private sanitizePathSegment(value: string) {
    return value
      .trim()
      .replace(/[^\w\-./]+/g, '-')
      .replace(/\/+/g, '/')
      .replace(/^\//, '')
      .replace(/\/$/, '')
      .slice(0, 120);
  }

  private ensureNotExpired(session: UploadSession) {
    if (session.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Upload session has expired');
    }
  }

  private getBucketName() {
    return (
      this.configService.get<string>('AWS_S3_BUCKET_NAME') ??
      process.env.AWS_S3_BUCKET_NAME ??
      ''
    ).trim();
  }

  private getSessionTtlMs() {
    return this.getPositiveIntegerFromConfig(
      'UPLOAD_SESSION_TTL_MS',
      DEFAULT_SESSION_TTL_MS,
    );
  }

  private getPartUrlExpiresSeconds() {
    return this.getPositiveIntegerFromConfig(
      'UPLOADS_PART_URL_EXPIRES_SECONDS',
      DEFAULT_PART_URL_EXPIRES_SECONDS,
    );
  }

  private getCleanupBatchSize() {
    return this.getPositiveIntegerFromConfig(
      'UPLOADS_CLEANUP_BATCH_SIZE',
      DEFAULT_CLEANUP_BATCH_SIZE,
    );
  }

  private getPositiveIntegerFromConfig(key: string, fallback: number) {
    const raw =
      this.configService.get<string | number>(key) ?? process.env[key] ?? '';
    const parsed = Number(raw);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.floor(parsed);
  }

  private normalizeUploaderEmail(email: string) {
    return email.trim().toLowerCase().replace(/[\\/]+/g, '-');
  }

  private normalizeObjectFileName(fileName: string) {
    return fileName
      .trim()
      .split(/[\\/]+/)
      .filter(Boolean)
      .pop()
      ?.trim() || 'unnamed-file';
  }

  private async abortSessionOnS3(session: UploadSession) {
    try {
      await this.s3.abortMultipartUpload({
        key: session.objectKey,
        uploadId: session.uploadId,
      });
    } catch (error: any) {
      const code = error?.code ?? error?.name;
      if (code === 'NoSuchUpload' || code === 'NotFound') {
        return;
      }
      throw error;
    }
  }

  private isTerminalStatus(status: UploadSessionStatus) {
    return (
      status === UploadSessionStatus.COMPLETED ||
      status === UploadSessionStatus.ABORTED
    );
  }

  private assertUploadUser(user: JwtUserShape) {
    if (String(user.role).toUpperCase() !== 'UPLOAD') {
      throw new ForbiddenException('Upload access required');
    }
    if (!user.email?.trim()) {
      throw new ForbiddenException('Email is required for uploads');
    }
    if (!user.organizationId) {
      throw new ForbiddenException('Organization is required for uploads');
    }
  }
}
