import { ApiProperty } from '@nestjs/swagger';
import { UploadSessionStatus } from '../entities/upload-session.entity';

export class SignedPartUrlDto {
  @ApiProperty({ example: 1 })
  partNumber: number;

  @ApiProperty({
    example:
      'https://uploads-bucket.s3.eu-central-1.amazonaws.com/uploads/...&partNumber=1',
  })
  url: string;
}

export class UploadedPartDto {
  @ApiProperty({ example: 1 })
  partNumber: number;

  @ApiProperty({ example: '"6d80eb0c50b49a509b49f2424e8c805a"' })
  etag: string;

  @ApiProperty({ example: 16777216 })
  size: number;

  @ApiProperty({
    example: '2026-04-17T10:15:00.000Z',
    nullable: true,
    type: String,
  })
  lastModified: Date | null;
}

export class MultipartCompleteResultDto {
  @ApiProperty({ example: 'uploads-bucket' })
  bucket: string;

  @ApiProperty({
    example:
      'Construction-Uploads/uploader@example.com/site-report-001.zip',
  })
  key: string;

  @ApiProperty({
    example: '"3858f62230ac3c915f300c664312c63f-3"',
    required: false,
  })
  etag?: string;

  @ApiProperty({
    example:
      'https://uploads-bucket.s3.eu-central-1.amazonaws.com/Construction-Uploads/uploader@example.com/site-report-001.zip',
    required: false,
  })
  location?: string;
}

export class UploadInitResponseDto {
  @ApiProperty({ format: 'uuid' })
  sessionId: string;

  @ApiProperty({ example: 'multipart-upload-id' })
  uploadId: string;

  @ApiProperty({ example: 'uploads-bucket' })
  bucket: string;

  @ApiProperty({
    example:
      'Construction-Uploads/uploader@example.com/site-report-001.zip',
  })
  objectKey: string;

  @ApiProperty({ example: 'site-report-001.zip' })
  fileName: string;

  @ApiProperty({ example: 'application/zip' })
  contentType: string;

  @ApiProperty({ example: 524288000 })
  fileSize: number;

  @ApiProperty({ example: 16777216 })
  partSize: number;

  @ApiProperty({
    enum: UploadSessionStatus,
    example: UploadSessionStatus.INITIATED,
  })
  status: UploadSessionStatus;

  @ApiProperty({ example: '2026-04-18T10:00:00.000Z' })
  expiresAt: Date;
}

export class UploadSignPartResponseDto {
  @ApiProperty({ format: 'uuid' })
  sessionId: string;

  @ApiProperty({ example: 'multipart-upload-id' })
  uploadId: string;

  @ApiProperty({
    example:
      'Construction-Uploads/uploader@example.com/site-report-001.zip',
  })
  objectKey: string;

  @ApiProperty({ example: 16777216 })
  partSize: number;

  @ApiProperty({ type: [SignedPartUrlDto] })
  urls: SignedPartUrlDto[];
}

export class UploadAbortResponseDto {
  @ApiProperty({ format: 'uuid' })
  sessionId: string;

  @ApiProperty({ example: 'multipart-upload-id' })
  uploadId: string;

  @ApiProperty({
    example:
      'Construction-Uploads/uploader@example.com/site-report-001.zip',
  })
  objectKey: string;

  @ApiProperty({
    enum: UploadSessionStatus,
    example: UploadSessionStatus.ABORTED,
  })
  status: UploadSessionStatus;

  @ApiProperty({ example: '2026-04-17T10:30:00.000Z' })
  lastActivityAt: Date;

  @ApiProperty({
    example: 'Upload aborted by user',
    nullable: true,
    type: String,
  })
  errorMessage: string | null;
}

export class UploadStatusResponseDto {
  @ApiProperty({ format: 'uuid' })
  sessionId: string;

  @ApiProperty({ example: 'multipart-upload-id' })
  uploadId: string;

  @ApiProperty({ example: 'uploads-bucket' })
  bucket: string;

  @ApiProperty({
    example:
      'Construction-Uploads/uploader@example.com/site-report-001.zip',
  })
  objectKey: string;

  @ApiProperty({ example: 'site-report-001.zip' })
  fileName: string;

  @ApiProperty({ example: 'application/zip' })
  contentType: string;

  @ApiProperty({ example: 524288000 })
  fileSize: number;

  @ApiProperty({ example: 16777216 })
  partSize: number;

  @ApiProperty({
    enum: UploadSessionStatus,
    example: UploadSessionStatus.UPLOADING,
  })
  status: UploadSessionStatus;

  @ApiProperty({ example: '2026-04-18T10:00:00.000Z' })
  expiresAt: Date;

  @ApiProperty({ example: '2026-04-17T10:20:00.000Z' })
  lastActivityAt: Date;

  @ApiProperty({
    example: '2026-04-17T10:40:00.000Z',
    nullable: true,
    type: String,
  })
  completedAt: Date | null;

  @ApiProperty({
    example: null,
    nullable: true,
    type: String,
  })
  errorMessage: string | null;

  @ApiProperty({ example: 33554432 })
  uploadedBytes: number;

  @ApiProperty({ type: [UploadedPartDto] })
  uploadedParts: UploadedPartDto[];
}

export class UploadCompleteResponseDto extends UploadStatusResponseDto {
  @ApiProperty({ type: MultipartCompleteResultDto })
  result: MultipartCompleteResultDto;
}

export class ActiveUploadItemDto {
  @ApiProperty({ format: 'uuid' })
  sessionId: string;

  @ApiProperty({ example: 'multipart-upload-id' })
  uploadId: string;

  @ApiProperty({
    example:
      'Construction-Uploads/uploader@example.com/site-report-001.zip',
  })
  objectKey: string;

  @ApiProperty({ example: 'site-report-001.zip' })
  fileName: string;

  @ApiProperty({ example: 'application/zip' })
  contentType: string;

  @ApiProperty({ example: 524288000 })
  fileSize: number;

  @ApiProperty({ example: 16777216 })
  partSize: number;

  @ApiProperty({
    enum: UploadSessionStatus,
    example: UploadSessionStatus.UPLOADING,
  })
  status: UploadSessionStatus;

  @ApiProperty({ example: '2026-04-18T10:00:00.000Z' })
  expiresAt: Date;

  @ApiProperty({ example: '2026-04-17T10:20:00.000Z' })
  lastActivityAt: Date;

  @ApiProperty({
    example: null,
    nullable: true,
    type: String,
  })
  completedAt: Date | null;

  @ApiProperty({
    example: null,
    nullable: true,
    type: String,
  })
  errorMessage: string | null;
}
