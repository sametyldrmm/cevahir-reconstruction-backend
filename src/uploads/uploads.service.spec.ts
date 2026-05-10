import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import type { JwtUserShape } from '../access/access-policy.service';
import { S3Service } from '../common/aws/s3/s3.service';
import { type InitImageUploadsDto } from './dto/init-image-uploads.dto';
import { UploadSession, UploadSessionStatus } from './entities/upload-session.entity';
import { UploadsService } from './uploads.service';

describe('UploadsService', () => {
  const fixedNow = new Date('2026-05-03T18:23:22.000Z');
  const uploadUser = {
    id: '4dbcfca0-888d-4581-9329-66733897b4dc',
    email: 'Upload.User@Example.com',
    organizationId: '521887a1-bf05-42d0-a086-d07dd36d9358',
    role: 'UPLOAD',
  } as JwtUserShape;
  const superadminUser = {
    id: '7163af5b-f34f-4924-b443-cff78691646c',
    email: 'Super.Admin@Example.com',
    organizationId: '521887a1-bf05-42d0-a086-d07dd36d9358',
    role: 'SUPERADMIN',
  } as JwtUserShape;

  const createSession = (
    overrides: Partial<UploadSession> = {},
  ): UploadSession => ({
    id: '6de86e45-008d-4197-a5a1-d1f7856dc581',
    userId: uploadUser.id,
    organizationId: uploadUser.organizationId!,
    bucketName: 'uploads-bucket',
    objectKey: 'uploads/org/user/file.zip',
    originalFileName: 'file.zip',
    contentType: 'application/zip',
    fileSize: '1024',
    partSize: 16 * 1024 * 1024,
    uploadId: 'multipart-upload-id',
    status: UploadSessionStatus.UPLOADING,
    expiresAt: new Date(Date.now() + 60_000),
    lastActivityAt: new Date(),
    completedAt: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createService = (config: Record<string, string | number> = {}) => {
    const repo = {
      findOne: jest.fn(),
      save: jest.fn(async (value) => value),
      find: jest.fn(),
      create: jest.fn((value) => value),
    };
    const s3 = {
      abortMultipartUpload: jest.fn(),
      createMultipartUpload: jest.fn(),
      generateUploadPartPresignedUrl: jest.fn(),
    };
    const configService = {
      get: jest.fn((key: string) => config[key]),
    };

    const service = new UploadsService(
      repo as unknown as Repository<UploadSession>,
      s3 as unknown as S3Service,
      configService as unknown as ConfigService,
    );

    return { service, repo, s3, configService };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(fixedNow);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('aborts an active upload session for the current upload user', async () => {
    const { service, repo, s3 } = createService();
    const session = createSession();
    repo.findOne.mockResolvedValue(session);

    const result = await service.abortUpload(uploadUser, {
      sessionId: session.id,
    });

    expect(s3.abortMultipartUpload).toHaveBeenCalledWith({
      key: session.objectKey,
      uploadId: session.uploadId,
    });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: session.id,
        status: UploadSessionStatus.ABORTED,
        errorMessage: 'Upload aborted by user',
        lastActivityAt: expect.any(Date),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        sessionId: session.id,
        status: UploadSessionStatus.ABORTED,
        errorMessage: 'Upload aborted by user',
      }),
    );
  });

  it('rejects abort requests for completed sessions', async () => {
    const { service, repo, s3 } = createService();
    repo.findOne.mockResolvedValue(
      createSession({ status: UploadSessionStatus.COMPLETED }),
    );

    await expect(
      service.abortUpload(uploadUser, {
        sessionId: '6de86e45-008d-4197-a5a1-d1f7856dc581',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(s3.abortMultipartUpload).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('uses the configured signed-part expiry when generating part URLs', async () => {
    const { service, repo, s3 } = createService({
      UPLOADS_PART_URL_EXPIRES_SECONDS: 1200,
    });
    const session = createSession({ status: UploadSessionStatus.INITIATED });
    repo.findOne.mockResolvedValue(session);
    s3.generateUploadPartPresignedUrl.mockResolvedValue('https://signed.example');

    const result = await service.signParts(uploadUser, {
      sessionId: session.id,
      partNumbers: [1, 2],
    });

    expect(s3.generateUploadPartPresignedUrl).toHaveBeenNthCalledWith(1, {
      key: session.objectKey,
      uploadId: session.uploadId,
      partNumber: 1,
      expiresIn: 1200,
    });
    expect(result.urls).toHaveLength(2);
  });

  it('aborts expired sessions using the configured cleanup batch size', async () => {
    const { service, repo, s3 } = createService({
      UPLOADS_CLEANUP_BATCH_SIZE: 2,
    });
    const expiredA = createSession({
      id: 'c2f8ca3c-b860-4d4a-a84e-e90b11c99d57',
      expiresAt: new Date(Date.now() - 10_000),
    });
    const expiredB = createSession({
      id: '524efe48-0b7d-4d17-b855-0e7f6a3010f0',
      uploadId: 'multipart-upload-id-2',
      objectKey: 'uploads/org/user/file-2.zip',
      expiresAt: new Date(Date.now() - 20_000),
      status: UploadSessionStatus.FAILED,
    });
    repo.find.mockResolvedValue([expiredA, expiredB]);

    const result = await service.abortExpiredSessions();

    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
      }),
    );
    expect(s3.abortMultipartUpload).toHaveBeenCalledTimes(2);
    expect(repo.save).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      scannedCount: 2,
      abortedCount: 2,
    });
  });

  it('stores uploads under Construction-Uploads/UserUploads/<normalized-email>/<Date>/<exact-file-name>', async () => {
    const { service, repo, s3 } = createService({
      AWS_S3_BUCKET_NAME: 'uploads-bucket',
      UPLOAD_SESSION_TTL_MS: 60000,
    });
    s3.createMultipartUpload.mockResolvedValue({
      uploadId: 'multipart-upload-id',
      key:
        'Construction-Uploads/UserUploads/upload.user@example.com/2026-05-03/My Report Final.zip',
    });

    const result = await service.initUpload(uploadUser, {
      fileName: 'My Report Final.zip',
      fileSize: 1024,
      contentType: 'application/zip',
      folder: 'ignored-folder',
      metadata: undefined,
    });

    expect(s3.createMultipartUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        key:
          'Construction-Uploads/UserUploads/upload.user@example.com/2026-05-03/My Report Final.zip',
      }),
    );
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey:
          'Construction-Uploads/UserUploads/upload.user@example.com/2026-05-03/My Report Final.zip',
      }),
    );
    expect(result.objectKey).toBe(
      'Construction-Uploads/UserUploads/upload.user@example.com/2026-05-03/My Report Final.zip',
    );
  });

  it('allows superadmin users on the standard upload flow', async () => {
    const { service, repo, s3 } = createService({
      AWS_S3_BUCKET_NAME: 'uploads-bucket',
      UPLOAD_SESSION_TTL_MS: 60000,
    });
    s3.createMultipartUpload.mockResolvedValue({
      uploadId: 'multipart-upload-id',
      key:
        'Construction-Uploads/UserUploads/super.admin@example.com/2026-05-03/My Report Final.zip',
    });

    const result = await service.initUpload(superadminUser, {
      fileName: 'My Report Final.zip',
      fileSize: 1024,
      contentType: 'application/zip',
      folder: 'ignored-folder',
      metadata: undefined,
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey:
          'Construction-Uploads/UserUploads/super.admin@example.com/2026-05-03/My Report Final.zip',
      }),
    );
    expect(result.objectKey).toBe(
      'Construction-Uploads/UserUploads/super.admin@example.com/2026-05-03/My Report Final.zip',
    );
  });

  it('creates superadmin image upload sessions under Construction-Uploads/AdminUploads/<projectName>/<worksiteName>/<blockName>/<Date>/', async () => {
    const { service, repo, s3 } = createService({
      AWS_S3_BUCKET_NAME: 'uploads-bucket',
      UPLOAD_SESSION_TTL_MS: 60000,
    });
    s3.createMultipartUpload
      .mockResolvedValueOnce({
        uploadId: 'multipart-upload-id-1',
        key:
          'Construction-Uploads/AdminUploads/Cevahir-Kuzey/North-Site/Block-A/2026-05-03/image-1.jpg',
      })
      .mockResolvedValueOnce({
        uploadId: 'multipart-upload-id-2',
        key:
          'Construction-Uploads/AdminUploads/Cevahir-Kuzey/North-Site/Block-A/2026-05-03/image-2.png',
      });

    const result = await service.initImageUploadsAsSuperadmin(superadminUser, {
      projectName: 'Cevahir Kuzey',
      worksiteName: 'North Site',
      blockName: 'Block A',
      files: [
        {
          fileName: 'image-1.jpg',
          fileSize: 2048,
          contentType: 'image/jpeg',
        },
        {
          fileName: 'nested/image-2.png',
          fileSize: 4096,
          contentType: 'image/png',
        },
      ],
    });

    expect(s3.createMultipartUpload).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        key:
          'Construction-Uploads/AdminUploads/Cevahir-Kuzey/North-Site/Block-A/2026-05-03/image-1.jpg',
      }),
    );
    expect(s3.createMultipartUpload).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        key:
          'Construction-Uploads/AdminUploads/Cevahir-Kuzey/North-Site/Block-A/2026-05-03/image-2.png',
      }),
    );
    expect(result.count).toBe(2);
    expect(result.uploads).toHaveLength(2);
    expect(result.uploads.map((upload) => upload.objectKey)).toEqual([
      'Construction-Uploads/AdminUploads/Cevahir-Kuzey/North-Site/Block-A/2026-05-03/image-1.jpg',
      'Construction-Uploads/AdminUploads/Cevahir-Kuzey/North-Site/Block-A/2026-05-03/image-2.png',
    ]);
  });

  it('rejects superadmin image upload init when worksiteName is missing', async () => {
    const { service } = createService({
      AWS_S3_BUCKET_NAME: 'uploads-bucket',
      UPLOAD_SESSION_TTL_MS: 60000,
    });

    const body: Partial<InitImageUploadsDto> = {
      projectName: 'Cevahir Kuzey',
      blockName: 'Block A',
      files: [
        {
          fileName: 'image-1.jpg',
          fileSize: 2048,
          contentType: 'image/jpeg',
        },
      ],
    };

    await expect(
      service.initImageUploadsAsSuperadmin(
        superadminUser,
        body as InitImageUploadsDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects superadmin image upload init when blockName is missing', async () => {
    const { service } = createService({
      AWS_S3_BUCKET_NAME: 'uploads-bucket',
      UPLOAD_SESSION_TTL_MS: 60000,
    });

    const body: Partial<InitImageUploadsDto> = {
      projectName: 'Cevahir Kuzey',
      worksiteName: 'North Site',
      files: [
        {
          fileName: 'image-1.jpg',
          fileSize: 2048,
          contentType: 'image/jpeg',
        },
      ],
    };

    await expect(
      service.initImageUploadsAsSuperadmin(
        superadminUser,
        body as InitImageUploadsDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects non-superadmin users for superadmin image uploads', async () => {
    const { service } = createService();

    await expect(
      service.initImageUploadsAsSuperadmin(uploadUser, {
        projectName: 'Cevahir Kuzey',
        worksiteName: 'North Site',
        blockName: 'Block A',
        files: [
          {
            fileName: 'image-1.jpg',
            fileSize: 2048,
            contentType: 'image/jpeg',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
