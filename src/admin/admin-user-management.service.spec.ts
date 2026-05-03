import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdminUserManagementService } from './admin-user-management.service';

describe('AdminUserManagementService', () => {
  let service: AdminUserManagementService;
  let users: any;
  let usersService: any;
  let passwords: any;
  let policy: any;

  beforeEach(() => {
    const manager = {
      transaction: jest.fn(async (cb) =>
        cb({
          getRepository: jest.fn((entity) => ({
            update: jest.fn(),
            delete: jest.fn(),
            entity,
          })),
        }),
      ),
    };

    users = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((value) => value),
      update: jest.fn(),
      delete: jest.fn(),
      manager,
    };
    usersService = {
      findById: jest.fn(),
      normalizePagePermissions: jest
        .fn()
        .mockImplementation((values) => values ?? []),
      getEffectivePagePermissionsForUser: jest.fn((user) => {
        const base = ['progress.view', 'session.view'];
        const extras = user.role === 'UPLOAD' ? ['uploads.view'] : [];
        return [...new Set([...(user.pagePermissions ?? []), ...base, ...extras])].sort();
      }),
      bumpSessionVersion: jest.fn(),
    };
    passwords = {
      hash: jest.fn().mockResolvedValue('hashed-password'),
    };
    policy = {
      assertAdminCanManageAccount: jest.fn(),
    };

    service = new AdminUserManagementService(
      users,
      usersService,
      passwords,
      policy,
    );
  });

  it('creates USER accounts in the admin organization', async () => {
    usersService.findById.mockResolvedValue({
      id: 'admin-1',
      role: 'ADMIN',
      organizationId: 'org-1',
    });
    users.findOne.mockResolvedValueOnce(null);
    users.save.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      role: 'USER',
      organizationId: 'org-1',
      sessionVersion: 1,
      pagePermissions: ['dashboard.view'],
    });

    const result = await service.createUser('admin-1', {
      email: ' User@Example.com ',
      password: 'Password123',
      role: 'USER',
      pagePermissions: ['dashboard.view'],
    });

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        role: 'USER',
        organizationId: 'org-1',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'user-1',
        role: 'USER',
        organizationId: 'org-1',
        pagePermissions: ['dashboard.view', 'progress.view', 'session.view'],
      }),
    );
  });

  it('rejects creating ADMIN accounts', async () => {
    usersService.findById.mockResolvedValue({
      id: 'admin-1',
      role: 'ADMIN',
      organizationId: 'org-1',
    });

    await expect(
      service.createUser('admin-1', {
        email: 'admin@example.com',
        password: 'Password123',
        role: 'ADMIN',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Admins can only create or assign USER and UPLOAD roles',
      ),
    );
  });

  it('clears page and data permissions when switching a managed user to UPLOAD', async () => {
    const updateRepo = jest.fn();
    const deleteRepo = jest.fn();
    users.manager.transaction.mockImplementationOnce(async (cb) =>
      cb({
        getRepository: jest.fn(() => ({
          update: updateRepo,
          delete: deleteRepo,
        })),
      }),
    );
    policy.assertAdminCanManageAccount.mockResolvedValue({
      admin: { id: 'admin-1', role: 'ADMIN' },
      target: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'USER',
      },
    });
    users.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: 'UPLOAD',
      organizationId: 'org-1',
      sessionVersion: 2,
      pagePermissions: [],
    });

    await service.updateUserAccount('admin-1', 'user-1', {
      role: 'UPLOAD',
    });

    expect(updateRepo).toHaveBeenCalled();
    expect(deleteRepo).toHaveBeenCalled();
    expect(usersService.bumpSessionVersion).toHaveBeenCalledWith('user-1');
  });

  it('returns uploads.view implicitly for UPLOAD accounts', async () => {
    usersService.findById.mockResolvedValue({
      id: 'admin-1',
      role: 'ADMIN',
      organizationId: 'org-1',
    });
    users.findOne.mockResolvedValueOnce(null);
    users.save.mockResolvedValueOnce({
      id: 'user-2',
      email: 'upload@example.com',
      role: 'UPLOAD',
      organizationId: 'org-1',
      sessionVersion: 1,
      pagePermissions: [],
    });

    const result = await service.createUser('admin-1', {
      email: 'upload@example.com',
      password: 'Password123',
      role: 'UPLOAD',
      pagePermissions: [],
    });

    expect(result.pagePermissions).toEqual([
      'progress.view',
      'session.view',
      'uploads.view',
    ]);
  });

  it('rejects duplicate email updates', async () => {
    policy.assertAdminCanManageAccount.mockResolvedValue({
      admin: { id: 'admin-1', role: 'ADMIN' },
      target: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'USER',
      },
    });
    users.findOne.mockResolvedValue({
      id: 'other-user',
      email: 'taken@example.com',
    });

    await expect(
      service.updateUserAccount('admin-1', 'user-1', {
        email: 'taken@example.com',
      }),
    ).rejects.toThrow(new ConflictException('Email is already in use'));
  });
});
