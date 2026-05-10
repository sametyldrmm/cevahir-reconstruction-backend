import { ConfigService } from '@nestjs/config';
import { AwsClientFactory } from '../common/aws-client.factory';
import { S3Service } from './s3.service';

describe('S3Service', () => {
  const createService = () => {
    const listObjectsV2 = jest.fn();
    const s3 = {
      listObjectsV2,
    };

    const awsClientFactory = {
      createS3Client: jest.fn(() => s3),
    };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'AWS_REGION') return 'eu-central-1';
        return undefined;
      }),
    };

    const service = new S3Service(
      configService as unknown as ConfigService,
      awsClientFactory as unknown as AwsClientFactory,
    );

    return { service, listObjectsV2 };
  };

  it('lists and sorts object keys by prefix across paginated responses', async () => {
    const { service, listObjectsV2 } = createService();
    listObjectsV2
      .mockReturnValueOnce({
        promise: async () => ({
          IsTruncated: true,
          NextContinuationToken: 'token-1',
          Contents: [
            { Key: 'Construction-Uploads/AdminUploads/P/W/B/2026-05-04/b.jpg' },
            { Key: 'Construction-Uploads/AdminUploads/P/W/B/' },
          ],
        }),
      })
      .mockReturnValueOnce({
        promise: async () => ({
          IsTruncated: false,
          Contents: [
            { Key: 'Construction-Uploads/AdminUploads/P/W/B/2026-05-03/a.jpg' },
            { Key: undefined },
          ],
        }),
      });

    const keys = await service.listObjectKeysByPrefix(
      'Construction-Uploads/AdminUploads/P/W/B/',
    );

    expect(listObjectsV2).toHaveBeenNthCalledWith(1, {
      Bucket: '',
      Prefix: 'Construction-Uploads/AdminUploads/P/W/B/',
      ContinuationToken: undefined,
    });
    expect(listObjectsV2).toHaveBeenNthCalledWith(2, {
      Bucket: '',
      Prefix: 'Construction-Uploads/AdminUploads/P/W/B/',
      ContinuationToken: 'token-1',
    });
    expect(keys).toEqual([
      'Construction-Uploads/AdminUploads/P/W/B/2026-05-03/a.jpg',
      'Construction-Uploads/AdminUploads/P/W/B/2026-05-04/b.jpg',
    ]);
  });

  it('returns an empty list for a blank prefix', async () => {
    const { service, listObjectsV2 } = createService();

    await expect(service.listObjectKeysByPrefix('   ')).resolves.toEqual([]);
    expect(listObjectsV2).not.toHaveBeenCalled();
  });
});