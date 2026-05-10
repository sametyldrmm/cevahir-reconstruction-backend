import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccessPolicyService } from '../access/access-policy.service';
import { S3Service } from '../common/aws/s3/s3.service';
import { ProgressController } from './progress.controller';
import { ProgressDataService } from './progress-data.service';
import { ProgressFilterService } from './progress-filter.service';

describe('ProgressController', () => {
  const createController = () => {
    const policy = {
      assertBlockVisible: jest.fn(),
      getEffectiveVisibility: jest.fn(),
    };
    const data = {
      loadDetailBlock: jest.fn(),
    };
    const filter = {
      filterDetailBlock: jest.fn(),
    };
    const s3 = {
      listObjectKeysByPrefix: jest.fn(),
      generateDownloadPresignedUrl: jest.fn(),
    };

    const controller = new ProgressController(
      policy as unknown as AccessPolicyService,
      data as unknown as ProgressDataService,
      filter as unknown as ProgressFilterService,
      s3 as unknown as S3Service,
    );

    return { controller, policy, data, filter, s3 };
  };

  it('returns image urls alongside block detail data', async () => {
    const { controller, policy, data, filter, s3 } = createController();

    policy.assertBlockVisible.mockResolvedValue({
      project: {
        id: 'project-1',
        slug: 'cevahir-kuzey',
        name: 'Cevahir Kuzey',
      },
      worksite: {
        id: 'worksite-1',
        code: 'WS-01',
        name: 'North Site',
      },
      visibility: {
        showElementLevelDetail: true,
        visibleBlockIds: null,
        hiddenBlockIds: [],
      },
    });
    data.loadDetailBlock.mockResolvedValue({
      required: {
        'Block A': {
          total_all_elements: 1,
          concrete_m3: 2,
          steel_kg: 3,
          steel_ton: 0.003,
          by_type: {},
        },
      },
      built: {
        'Block A': {
          total_all_elements: 1,
          concrete_m3: 2,
          steel_kg: 3,
          steel_ton: 0.003,
          by_type: {},
        },
      },
    });
    filter.filterDetailBlock.mockReturnValue({
      required: {
        'Block A': {
          total_all_elements: 1,
          concrete_m3: 2,
          steel_kg: 3,
          steel_ton: 0.003,
          by_type: {},
        },
      },
      built: {
        'Block A': {
          total_all_elements: 1,
          concrete_m3: 2,
          steel_kg: 3,
          steel_ton: 0.003,
          by_type: {},
        },
      },
    });
    s3.listObjectKeysByPrefix.mockResolvedValue([
      'Construction-Uploads/AdminUploads/Cevahir-Kuzey/WS-01/Block-A/2026-05-03/image-1.jpg',
      'Construction-Uploads/AdminUploads/Cevahir-Kuzey/WS-01/Block-A/2026-05-04/image-2.png',
    ]);
    s3.generateDownloadPresignedUrl
      .mockResolvedValueOnce('https://signed.example/image-1.jpg')
      .mockResolvedValueOnce('https://signed.example/image-2.png');

    const result = await controller.detail(
      { id: 'user-1', role: 'ADMIN', organizationId: 'org-1' } as any,
      'WS-01',
      'project-1',
      'Block A',
    );

    expect(s3.listObjectKeysByPrefix).toHaveBeenCalledWith(
      'Construction-Uploads/AdminUploads/Cevahir-Kuzey/WS-01/Block-A/',
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        imageUrls: [
          'https://signed.example/image-1.jpg',
          'https://signed.example/image-2.png',
        ],
      }),
    );
  });

  it('rejects blank block ids', async () => {
    const { controller } = createController();

    await expect(
      controller.detail(
        { id: 'user-1', role: 'ADMIN', organizationId: 'org-1' } as any,
        'WS-01',
        'project-1',
        '   ',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when the block is missing or hidden', async () => {
    const { controller, policy, data, filter } = createController();

    policy.assertBlockVisible.mockResolvedValue({
      project: {
        id: 'project-1',
        slug: 'cevahir-kuzey',
        name: 'Cevahir Kuzey',
      },
      worksite: {
        id: 'worksite-1',
        code: 'WS-01',
        name: 'North Site',
      },
      visibility: {
        showElementLevelDetail: true,
        visibleBlockIds: null,
        hiddenBlockIds: [],
      },
    });
    data.loadDetailBlock.mockResolvedValue(null);
    filter.filterDetailBlock.mockReturnValue(null);

    await expect(
      controller.detail(
        { id: 'user-1', role: 'ADMIN', organizationId: 'org-1' } as any,
        'WS-01',
        'project-1',
        'Block A',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});