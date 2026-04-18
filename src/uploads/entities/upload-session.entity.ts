import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UploadSessionStatus {
  INITIATED = 'initiated',
  UPLOADING = 'uploading',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ABORTED = 'aborted',
}

@Entity('upload_sessions')
export class UploadSession {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'bucket_name' })
  bucketName: string;

  @Column({ name: 'object_key' })
  objectKey: string;

  @Column({ name: 'original_file_name' })
  originalFileName: string;

  @Column({ name: 'content_type' })
  contentType: string;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize: string;

  @Column({ name: 'part_size', type: 'int' })
  partSize: number;

  @Column({ name: 'upload_id' })
  uploadId: string;

  @Column({
    type: 'varchar',
    length: 32,
    default: UploadSessionStatus.INITIATED,
  })
  status: UploadSessionStatus;

  @Column({ name: 'expires_at', type: 'timestamp without time zone' })
  expiresAt: Date;

  @Column({ name: 'last_activity_at', type: 'timestamp without time zone' })
  lastActivityAt: Date;

  @Column({
    name: 'completed_at',
    type: 'timestamp without time zone',
    nullable: true,
  })
  completedAt: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp without time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp without time zone' })
  updatedAt: Date;
}
