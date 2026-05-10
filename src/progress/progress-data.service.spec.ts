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
    const row = {
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
    } satisfies Partial<ProjectProgressBlock>;

    blocks.find.mockResolvedValueOnce([row]).mockResolvedValueOnce([row]);

    const summary = await service.loadSummary('project-1');

    expect(summary.required.A.total_all_elements).toBe(10);
    expect(summary.built.A.total_all_elements).toBe(4);
    expect(summary.totals.required.total_all_elements).toBe(10);
    expect(summary.totals.built.total_all_elements).toBe(4);
    expect(blocks.find).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { projectId: 'project-1' },
      }),
    );
    expect(blocks.find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { projectId: 'project-1' },
      }),
    );
  });

  it('keeps required totals unchanged and aggregates only built rows inside the selected date range', async () => {
    blocks.find
      .mockResolvedValueOnce([
        {
          projectId: 'project-1',
          blockName: 'A',
          dataDate: '2026-05-10',
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
      ])
      .mockResolvedValueOnce([
        {
          projectId: 'project-1',
          blockName: 'A',
          dataDate: '2026-05-10',
          requiredData: null,
          builtData: {
            total_all_elements: 2,
            concrete_m3: 3,
            steel_kg: 4,
            steel_ton: 0.004,
            by_type: {
              IfcSlab: {
                count: 2,
                concrete_m3: 3,
                steel_kg: 4,
                steel_ton: 0.004,
              },
            },
          },
        } satisfies Partial<ProjectProgressBlock>,
        {
          projectId: 'project-1',
          blockName: 'A',
          dataDate: '2026-05-09',
          requiredData: null,
          builtData: {
            total_all_elements: 1,
            concrete_m3: 1,
            steel_kg: 2,
            steel_ton: 0.002,
            by_type: {
              IfcSlab: {
                count: 1,
                concrete_m3: 1,
                steel_kg: 2,
                steel_ton: 0.002,
              },
            },
          },
        } satisfies Partial<ProjectProgressBlock>,
      ]);

    const summary = await service.loadSummary('project-1', {
      dateRange: {
        from: '2026-05-09',
        to: '2026-05-10',
      },
    });

    expect(summary.required.A.total_all_elements).toBe(10);
    expect(summary.totals.required.total_all_elements).toBe(10);
    expect(summary.built.A.total_all_elements).toBe(3);
    expect(summary.built.A.concrete_m3).toBe(4);
    expect(summary.totals.built.total_all_elements).toBe(3);
    expect(blocks.find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: 'project-1',
          dataDate: expect.any(Object),
        }),
      }),
    );
  });

  it('returns zeroed built totals when a date filter has no matching rows', async () => {
    blocks.find.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    jest.spyOn<any, any>(service as any, 'loadSummaryRoot').mockReturnValue({
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
          total_all_elements: 5,
          concrete_m3: 6,
          steel_kg: 7,
          steel_ton: 0.007,
          by_type: {},
        },
      },
      totals: {
        required: {
          total_all_elements: 10,
          concrete_m3: 20,
          steel_kg: 30,
          steel_ton: 0.03,
          by_type: {},
        },
        built: {
          total_all_elements: 5,
          concrete_m3: 6,
          steel_kg: 7,
          steel_ton: 0.007,
          by_type: {},
        },
      },
    });

    const summary = await service.loadSummary('project-1', {
      dateRange: {
        from: '2026-05-01',
        to: '2026-05-02',
      },
    });

    expect(summary.required.A.total_all_elements).toBe(10);
    expect(summary.built.A.total_all_elements).toBe(0);
    expect(summary.totals.built.total_all_elements).toBe(0);
  });

  it('keeps legacy built rows for blocks that do not yet have dated rows', async () => {
    blocks.find
      .mockResolvedValueOnce([
        {
          projectId: 'project-1',
          blockName: 'A',
          dataDate: '2026-05-10',
          requiredData: {
            total_all_elements: 10,
            concrete_m3: 20,
            steel_kg: 30,
            steel_ton: 0.03,
            by_type: {},
          },
          builtData: null,
        } satisfies Partial<ProjectProgressBlock>,
        {
          projectId: 'project-1',
          blockName: 'B',
          dataDate: null,
          requiredData: {
            total_all_elements: 5,
            concrete_m3: 6,
            steel_kg: 7,
            steel_ton: 0.007,
            by_type: {},
          },
          builtData: null,
        } satisfies Partial<ProjectProgressBlock>,
      ])
      .mockResolvedValueOnce([
        {
          projectId: 'project-1',
          blockName: 'A',
          dataDate: '2026-05-10',
          requiredData: null,
          builtData: {
            total_all_elements: 2,
            concrete_m3: 3,
            steel_kg: 4,
            steel_ton: 0.004,
            by_type: {},
          },
        } satisfies Partial<ProjectProgressBlock>,
        {
          projectId: 'project-1',
          blockName: 'B',
          dataDate: null,
          requiredData: null,
          builtData: {
            total_all_elements: 1,
            concrete_m3: 1,
            steel_kg: 1,
            steel_ton: 0.001,
            by_type: {},
          },
        } satisfies Partial<ProjectProgressBlock>,
      ]);

    const summary = await service.loadSummary('project-1');

    expect(summary.built.A.total_all_elements).toBe(2);
    expect(summary.built.B.total_all_elements).toBe(1);
    expect(summary.totals.built.total_all_elements).toBe(3);
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
        dataDate: null,
      }),
      expect.objectContaining({
        projectId: 'project-1',
        blockName: 'B',
        dataDate: null,
      }),
    ]);
  });

  it('replaces only the matching date slice during dated import', async () => {
    const count = await service.replaceProjectBlocks(
      'project-1',
      {
        required: {},
        built: {
          A: {
            total_all_elements: 1,
            concrete_m3: 2,
            steel_kg: 3,
            steel_ton: 0.003,
            by_type: {},
          },
        },
      },
      '2026-05-10',
    );

    expect(count).toBe(1);
    expect(blocks.delete).toHaveBeenCalledWith({
      projectId: 'project-1',
      dataDate: '2026-05-10',
    });
    expect(blocks.save).toHaveBeenCalledWith([
      expect.objectContaining({
        projectId: 'project-1',
        blockName: 'A',
        dataDate: '2026-05-10',
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
      '2026-05-10',
    );

    expect(result).toEqual({
      importedBlockCount: 1,
      sourceFileName: 'data.json',
    });
    expect(blocks.delete).toHaveBeenCalledWith({
      projectId: 'project-1',
      dataDate: '2026-05-10',
    });
    expect(blocks.save).toHaveBeenCalledWith([
      expect.objectContaining({
        projectId: 'project-1',
        blockName: 'A',
        dataDate: '2026-05-10',
      }),
    ]);
  });
});
