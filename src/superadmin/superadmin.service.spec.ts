import { BadRequestException, ConflictException } from '@nestjs/common';
import { USER_ROLES } from '../users/domain/user-role.constants';
import { SuperadminService } from './superadmin.service';

describe('SuperadminService', () => {
  let service: SuperadminService;
  let users: any;
  let organizations: any;
  let projects: any;
  let worksites: any;
  let passwords: any;
  let usersService: any;

  beforeEach(() => {
    users = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((value) => value),
      count: jest.fn(),
      delete: jest.fn(),
    };
    organizations = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((value) => value),
    };
    projects = {
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn((value) => value),
      exist: jest.fn(),
    };
    worksites = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((value) => value),
      exist: jest.fn(),
    };
    passwords = {
      hash: jest.fn().mockResolvedValue('hashed-password'),
    };
    usersService = {
      normalizePagePermissions: jest
        .fn()
        .mockImplementation((values) => values ?? []),
      getEffectivePagePermissionsForUser: jest
        .fn()
        .mockImplementation((user) => user.pagePermissions ?? []),
      bumpSessionVersion: jest.fn(),
    };

    service = new SuperadminService(
      users as any,
      organizations as any,
      projects as any,
      { delete: jest.fn() } as any,
      { delete: jest.fn() } as any,
      worksites as any,
      usersService,
      passwords,
      {
        listAccess: jest.fn().mockResolvedValue([]),
        listVisibilityProfiles: jest.fn().mockResolvedValue([]),
        buildPermissionMapForUser: jest.fn().mockResolvedValue({
          organizationIds: [],
          pagePermissions: [],
          projects: [],
          visibilityProfiles: [],
        }),
      } as any,
    );

    jest.spyOn(service, 'getUser').mockResolvedValue({
      user: { id: 'user-1', email: 'new@example.com' },
    } as any);
  });

  it('creates a user with normalized email and page permissions', async () => {
    users.findOne.mockResolvedValueOnce(null);
    organizations.findOne.mockResolvedValueOnce({
      id: 'org-1',
      name: 'Org',
    });
    users.save.mockResolvedValueOnce({ id: 'user-1' });

    await service.createUser({
      email: ' New@Example.com ',
      password: 'Password123',
      role: USER_ROLES.ADMIN,
      organizationId: 'org-1',
      pagePermissions: ['Dashboard.View'],
    });

    expect(passwords.hash).toHaveBeenCalledWith('Password123');
    expect(usersService.normalizePagePermissions).toHaveBeenCalledWith([
      'Dashboard.View',
    ]);
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        role: USER_ROLES.ADMIN,
        organizationId: 'org-1',
      }),
    );
  });

  it('creates an organization when name is unique', async () => {
    organizations.findOne.mockResolvedValueOnce(null);
    organizations.save.mockResolvedValueOnce({
      id: 'org-2',
      name: 'New Org',
    });

    const result = await service.createOrganization(' New Org ');

    expect(organizations.create).toHaveBeenCalledWith({ name: 'New Org' });
    expect(result).toEqual({ id: 'org-2', name: 'New Org' });
  });

  it('rejects duplicate organization names', async () => {
    organizations.findOne.mockResolvedValueOnce({ id: 'org-1', name: 'Org' });

    await expect(service.createOrganization('Org')).rejects.toThrow(
      new ConflictException('Organization name is already in use'),
    );
  });

  it('rejects deleting the last superadmin user', async () => {
    users.findOne.mockResolvedValueOnce({
      id: 'super-1',
      role: USER_ROLES.SUPERADMIN,
    });
    users.count.mockResolvedValueOnce(1);

    await expect(service.deleteUser('super-1')).rejects.toThrow(
      new BadRequestException('You cannot remove the last SUPERADMIN user'),
    );
  });

  it('creates a project when upload input projectName is not found', async () => {
    projects.find.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    organizations.findOne.mockResolvedValueOnce({
      id: 'org-1',
      name: 'Org',
    });
    projects.exist.mockResolvedValueOnce(false);
    projects.save.mockResolvedValueOnce({
      id: 'project-1',
      organizationId: 'org-1',
      name: 'Cevahir Kuzey',
      slug: 'cevahir-kuzey',
    });

    const result = await service.findOrCreateProjectByInput(
      {
        id: 'super-1',
        email: 'super@example.com',
        role: USER_ROLES.SUPERADMIN,
        organizationId: 'org-1',
      },
      'Cevahir Kuzey',
    );

    expect(projects.create).toHaveBeenCalledWith({
      organizationId: 'org-1',
      name: 'Cevahir Kuzey',
      slug: 'cevahir-kuzey',
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'project-1',
        name: 'Cevahir Kuzey',
        slug: 'cevahir-kuzey',
      }),
    );
  });

  it('creates the default Merkez Şantiye worksite when missing', async () => {
    worksites.findOne.mockResolvedValueOnce(null);
    worksites.exist.mockResolvedValueOnce(false);
    worksites.save.mockResolvedValueOnce({
      id: 'ws-1',
      projectId: 'project-1',
      code: 'WS-01',
      name: 'Merkez Şantiye',
    });

    const result = await service.ensureDefaultWorksite('project-1');

    expect(worksites.create).toHaveBeenCalledWith({
      projectId: 'project-1',
      code: 'WS-01',
      name: 'Merkez Şantiye',
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'ws-1',
        code: 'WS-01',
        name: 'Merkez Şantiye',
      }),
    );
  });
});
