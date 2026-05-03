import { ConfigService } from '@nestjs/config';
import { ProgressDataService } from './progress-data.service';
import { ProjectProgressBlock } from './entities/project-progress-block.entity';

describe('ProgressDataService', () => {
  let service: ProgressDataService;
  let blocks: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(() => {
    blocks = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(),
      delete: jest.fn(),
    };

    service = new ProgressDataService(
      {
        get: jest.fn(),
      } as unknown as ConfigService,
      blocks as any,
    );
  });

  it('loads summary from project block rows when the database has data', async () => {
    blocks.find.mockResolvedValue([
      {
        projectId: 'project-1',
        blockName: 'A',
        requiredData: {
          total_all_elements: 10,
          concrete_m3: 12,
          steel_kg: 14,
          steel_ton: 0.014,
          by_type: {
            IfcSlab: {
              count: 10,
              concrete_m3: 12,
              steel_kg: 14,
              steel_ton: 0.014,
            },
          },
        },
        builtData: {
          total_all_elements: 4,
          concrete_m3: 5,
          steel_kg: 6,
          steel_ton: 0.006,
          by_type: {
            IfcSlab: {
              count: 4,
              concrete_m3: 5,
              steel_kg: 6,
              steel_ton: 0.006,
            },
          },
        },
      } satisfies Partial<ProjectProgressBlock>,
    ]);

    const summary = await service.loadSummary('project-1');

    expect(summary.required.A.total_all_elements).toBe(10);
    expect(summary.built.A.total_all_elements).toBe(4);
    expect(summary.totals.required.total_all_elements).toBe(10);
    expect(summary.totals.built.total_all_elements).toBe(4);
    expect(blocks.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'project-1' },
      }),
    );
  });

  it('replaces all project blocks during import', async () => {
    const imported = {
      required: {
        A: {
          total_all_elements: 10,
          concrete_m3: 20,
          steel_kg: 30,
          steel_ton: 0.03,
          by_type: {},
        },
      },
      built: {
        A: {
          total_all_elements: 1,
          concrete_m3: 2,
          steel_kg: 3,
          steel_ton: 0.003,
          by_type: {},
        },
        B: {
          total_all_elements: 4,
          concrete_m3: 5,
          steel_kg: 6,
          steel_ton: 0.006,
          by_type: {},
        },
      },
    };

    const count = await service.replaceProjectBlocks('project-1', imported);

    expect(count).toBe(2);
    expect(blocks.delete).toHaveBeenCalledWith({ projectId: 'project-1' });
    expect(blocks.save).toHaveBeenCalledWith([
      expect.objectContaining({
        projectId: 'project-1',
        blockName: 'A',
      }),
      expect.objectContaining({
        projectId: 'project-1',
        blockName: 'B',
      }),
    ]);
  });

  it('imports uploaded json data into the database', async () => {
    const fileBuffer = Buffer.from(
      JSON.stringify({
        required: {
          A: {
            total_all_elements: 10,
            concrete_m3: 20,
            steel_kg: 30,
            steel_ton: 0.03,
            by_type: {},
          },
        },
        built: {},
      }),
      'utf8',
    );

    const result = await service.replaceProjectBlocksFromUploadedJson(
      'project-1',
      fileBuffer,
      'data.json',
    );

    expect(result).toEqual({
      importedBlockCount: 1,
      sourceFileName: 'data.json',
    });
    expect(blocks.delete).toHaveBeenCalledWith({ projectId: 'project-1' });
    expect(blocks.save).toHaveBeenCalledWith([
      expect.objectContaining({
        projectId: 'project-1',
        blockName: 'A',
      }),
    ]);
  });
});
