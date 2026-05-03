import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../organizations/entities/organization.entity';
import { Project } from './entities/project.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
  ) {}

  async createProject(input: {
    organizationId: string;
    name: string;
    slug?: string | null;
  }) {
    const organizationId = input.organizationId.trim();
    const name = input.name.trim();
    const requestedSlug = input.slug?.trim() ?? '';
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }
    if (!name) {
      throw new BadRequestException('name is required');
    }

    const org = await this.organizations.findOne({ where: { id: organizationId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const baseSlug = this.slugify(requestedSlug || name) || 'project';
    const slug = await this.ensureUniqueProjectSlug(organizationId, baseSlug);

    const created = await this.projects.save(
      this.projects.create({
        organizationId,
        name,
        slug,
      }),
    );

    return created;
  }

  async updateProject(
    actor: { role: string; organizationId?: string },
    projectId: string,
    patch: { name?: string; slug?: string | null },
  ) {
    const row = await this.projects.findOne({ where: { id: projectId } });
    if (!row) {
      throw new NotFoundException('Project not found');
    }

    const actorOrgId = actor.organizationId?.trim();
    const isSuperadmin = String(actor.role).toUpperCase() === 'SUPERADMIN';
    if (!isSuperadmin && actorOrgId && row.organizationId !== actorOrgId) {
      throw new ForbiddenException('Project not in organization');
    }

    const nextName = patch.name?.trim();
    const nextSlugInput = patch.slug?.trim();

    if (!nextName && nextSlugInput === undefined) {
      return row;
    }

    if (nextName !== undefined && !nextName) {
      throw new BadRequestException('name cannot be empty');
    }

    if (nextSlugInput !== undefined && !nextSlugInput) {
      throw new BadRequestException('slug cannot be empty');
    }

    if (nextName !== undefined) {
      row.name = nextName;
    }

    if (nextSlugInput !== undefined) {
      const baseSlug = this.slugify(nextSlugInput) || 'project';
      const unique = await this.ensureUniqueProjectSlug(
        row.organizationId,
        baseSlug,
        row.id,
      );
      row.slug = unique;
    }

    try {
      return await this.projects.save(row);
    } catch (error: any) {
      throw new ConflictException('Project slug is already in use');
    }
  }

  async deleteProject(actor: { role: string; organizationId?: string }, projectId: string) {
    const row = await this.projects.findOne({ where: { id: projectId } });
    if (!row) {
      throw new NotFoundException('Project not found');
    }

    const actorOrgId = actor.organizationId?.trim();
    const isSuperadmin = String(actor.role).toUpperCase() === 'SUPERADMIN';
    if (!isSuperadmin && actorOrgId && row.organizationId !== actorOrgId) {
      throw new ForbiddenException('Project not in organization');
    }

    await this.projects.delete({ id: projectId });
    return { ok: true, projectId };
  }

  private async ensureUniqueProjectSlug(
    organizationId: string,
    baseSlug: string,
    ignoreProjectId?: string,
  ) {
    let candidate = baseSlug;
    let suffix = 1;

    while (await this.projects.exist({ where: { organizationId, slug: candidate } })) {
      if (ignoreProjectId) {
        const existing = await this.projects.findOne({
          where: { organizationId, slug: candidate },
        });
        if (existing?.id === ignoreProjectId) {
          return candidate;
        }
      }

      suffix += 1;
      candidate = `${baseSlug}-${suffix}`;
    }

    return candidate;
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }
}
