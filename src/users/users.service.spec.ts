import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const createRepo = () => ({
    findOne: jest.fn(),
    count: jest.fn(),
    increment: jest.fn(),
    update: jest.fn(),
  });

  it('normalizes page permissions before persisting them', async () => {
    const repo = createRepo();
    repo.findOne.mockResolvedValue({
      id: 'user-1',
      role: 'USER',
      pagePermissions: ['dashboard.view', 'reports.view'],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: repo,
        },
      ],
    }).compile();

    const service = module.get(UsersService);
    const result = await service.updatePagePermissions('user-1', [
      ' Reports.View ',
      'dashboard.view',
      'reports.view',
      'DASHBOARD.VIEW',
      'session.view',
      'progress.view',
      '',
    ]);

    expect(repo.update).toHaveBeenCalledWith(
      { id: 'user-1' },
      { pagePermissions: ['dashboard.view', 'reports.view'] },
    );
    expect(result).toEqual({
      id: 'user-1',
      role: 'USER',
      pagePermissions: ['dashboard.view', 'reports.view'],
    });
  });

  it('strips implicit and upload-default permissions from persisted values', async () => {
    const repo = createRepo();
    repo.findOne.mockResolvedValue({
      id: 'user-1',
      role: 'UPLOAD',
      pagePermissions: [],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: repo,
        },
      ],
    }).compile();

    const service = module.get(UsersService);
    const result = await service.updatePagePermissions(
      'user-1',
      '["session.view", "progress.view", "uploads.view", "uploads.manage"]',
    );

    expect(repo.update).toHaveBeenCalledWith(
      { id: 'user-1' },
      { pagePermissions: [] },
    );
    expect(result).toEqual({
      id: 'user-1',
      role: 'UPLOAD',
      pagePermissions: [],
    });
  });

  it('builds effective permissions with implicit defaults and upload defaults', async () => {
    const repo = createRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: repo,
        },
      ],
    }).compile();

    const service = module.get(UsersService);

    expect(
      service.getEffectivePagePermissions('USER', ['dashboard.view']),
    ).toEqual(['dashboard.view', 'progress.view', 'session.view']);
    expect(
      service.getEffectivePagePermissions('UPLOAD', ['uploads.manage']),
    ).toEqual(['progress.view', 'session.view', 'uploads.view']);
  });
});
