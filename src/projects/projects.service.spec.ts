import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Organization } from '../organizations/entities/organization.entity';
import { Project } from './entities/project.entity';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let projects: any;
  let organizations: any;

  beforeEach(async () => {
    projects = {
      exist: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (value) => value),
      create: jest.fn((value) => value),
      delete: jest.fn(),
    };
    organizations = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getRepositoryToken(Project), useValue: projects },
        { provide: getRepositoryToken(Organization), useValue: organizations },
      ],
    }).compile();

    service = module.get(ProjectsService);
  });

  it('creates a project with a unique slug in the organization', async () => {
    organizations.findOne.mockResolvedValueOnce({ id: 'org-1', name: 'Org' });
    projects.exist.mockResolvedValueOnce(false);

    const result = await service.createProject({
      organizationId: 'org-1',
      name: 'Cevahir Ana Kampüs',
      slug: undefined,
    });

    expect(projects.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        name: 'Cevahir Ana Kampüs',
        slug: 'cevahir-ana-kamp-s',
      }),
    );
    expect(result.slug).toBe('cevahir-ana-kamp-s');
  });

  it('rejects creating a project when organization does not exist', async () => {
    organizations.findOne.mockResolvedValueOnce(null);

    await expect(
      service.createProject({
        organizationId: 'org-missing',
        name: 'Name',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('prevents an admin from updating a project in a different organization', async () => {
    projects.findOne.mockResolvedValueOnce({
      id: 'p-1',
      organizationId: 'org-2',
      name: 'P',
      slug: 'p',
    });

    await expect(
      service.updateProject(
        { role: 'ADMIN', organizationId: 'org-1' },
        'p-1',
        { name: 'New' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows superadmin to update a project in any organization', async () => {
    projects.findOne.mockResolvedValueOnce({
      id: 'p-1',
      organizationId: 'org-2',
      name: 'P',
      slug: 'p',
    });

    await expect(
      service.updateProject(
        { role: 'SUPERADMIN', organizationId: 'org-1' },
        'p-1',
        { name: 'New Name' },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        name: 'New Name',
      }),
    );
  });

  it('appends a suffix when the requested slug is already in use', async () => {
    projects.findOne.mockResolvedValueOnce({
      id: 'p-1',
      organizationId: 'org-1',
      name: 'P',
      slug: 'p',
    });
    projects.exist.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    projects.findOne.mockResolvedValueOnce({ id: 'p-2' });

    await expect(
      service.updateProject(
        { role: 'SUPERADMIN', organizationId: 'org-1' },
        'p-1',
        { slug: 'p' },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        slug: 'p-2',
      }),
    );
  });
});
