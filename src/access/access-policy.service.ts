import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { Project } from '../projects/entities/project.entity';
import { UserProjectAccess } from '../projects/entities/user-project-access.entity';
import { VisibilityProfile } from '../projects/entities/visibility-profile.entity';
import { Worksite } from '../projects/entities/worksite.entity';
import {
  ADMIN_VISIBILITY,
  DEFAULT_VISIBILITY,
  type EffectiveVisibility,
  mergeVisibility,
} from './domain/visibility.types';

export interface JwtUserShape {
  id: string;
  email: string;
  role: string;
  organizationId?: string;
}

export interface SessionProjectDto {
  id: string;
  slug: string;
  name: string;
  worksiteCodes: string[];
}

export interface SessionBootstrapDto {
  user: {
    id: string;
    email: string;
    role: string;
    sessionVersion: number;
  };
  organizationId: string;
  projects: SessionProjectDto[];
}

@Injectable()
export class AccessPolicyService {
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(UserProjectAccess)
    private readonly access: Repository<UserProjectAccess>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(Worksite)
    private readonly worksites: Repository<Worksite>,
    @InjectRepository(VisibilityProfile)
    private readonly profiles: Repository<VisibilityProfile>,
  ) {}

  async buildSession(user: JwtUserShape): Promise<SessionBootstrapDto> {
    const row = await this.usersService.findById(user.id);
    if (!row) {
      throw new ForbiddenException('User not found');
    }
    const projectDtos = await this.getAccessibleProjects(row.id);
    return {
      user: {
        id: row.id,
        email: row.email,
        role: row.role,
        sessionVersion: row.sessionVersion,
      },
      organizationId: row.organizationId,
      projects: projectDtos,
    };
  }

  private async getAccessibleProjects(userId: string): Promise<SessionProjectDto[]> {
    const rows = await this.access.find({
      where: { userId },
      relations: ['project', 'project.worksites', 'worksite'],
    });
    if (rows.length === 0) {
      return [];
    }

    const byProject = new Map<
      string,
      { project: Project; codes: string[] | null }
    >();

    for (const r of rows) {
      const pid = r.projectId;
      const proj = r.project;
      if (!proj) continue;
      const prev = byProject.get(pid);

      if (!r.worksite) {
        byProject.set(pid, { project: proj, codes: null });
        continue;
      }

      if (prev?.codes === null) {
        continue;
      }

      const code = r.worksite.code;
      const arr = prev?.codes ? [...prev.codes] : [];
      if (!arr.includes(code)) {
        arr.push(code);
      }
      byProject.set(pid, { project: proj, codes: arr });
    }

    const out: SessionProjectDto[] = [];
    for (const { project, codes } of byProject.values()) {
      const allCodes = project.worksites?.map((w) => w.code) ?? [];
      const allowed =
        codes === null ? allCodes : allCodes.filter((c) => codes.includes(c));
      out.push({
        id: project.id,
        slug: project.slug,
        name: project.name,
        worksiteCodes: allowed.sort((a, b) => a.localeCompare(b, 'tr')),
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }

  async assertWorksiteInProject(
    userId: string,
    role: string,
    organizationId: string | undefined,
    projectId: string,
    worksiteCode: string,
  ): Promise<{ project: Project; worksite: Worksite; user: User }> {
    const userRow = await this.usersService.findById(userId);
    if (!userRow) throw new ForbiddenException('User not found');
    if (organizationId && userRow.organizationId !== organizationId) {
      throw new ForbiddenException('Organization mismatch');
    }

    const project = await this.projects.findOne({
      where: { id: projectId },
      relations: ['worksites'],
    });
    if (!project) throw new NotFoundException('Project not found');
    if (userRow.organizationId !== project.organizationId) {
      throw new ForbiddenException('Project not in organization');
    }

    const worksite = project.worksites?.find((w) => w.code === worksiteCode);
    if (!worksite) {
      throw new NotFoundException('Worksite not found in project');
    }

    if (String(role).toUpperCase() === 'ADMIN') {
      if (userRow.organizationId !== project.organizationId) {
        throw new ForbiddenException('Admin cannot cross organization');
      }
      return { project, worksite, user: userRow };
    }

    const accesses = await this.access.find({
      where: { userId, projectId },
      relations: ['worksite'],
    });
    if (accesses.length === 0) {
      throw new ForbiddenException('No access to project');
    }

    const full = accesses.some((a) => !a.worksite);
    if (!full) {
      const ok = accesses.some((a) => a.worksite?.code === worksiteCode);
      if (!ok) throw new ForbiddenException('No access to worksite');
    }

    return { project, worksite, user: userRow };
  }

  async getEffectiveVisibility(
    userId: string,
    role: string,
    projectId: string,
    worksiteId: string | null,
  ): Promise<EffectiveVisibility> {
    if (String(role).toUpperCase() === 'ADMIN') {
      return { ...ADMIN_VISIBILITY };
    }

    const orClause: object[] = [{ userId, projectId, worksite: IsNull() }];
    if (worksiteId) {
      orClause.push({ userId, projectId, worksite: { id: worksiteId } });
    }

    const list = await this.profiles.find({
      where: orClause,
      relations: ['worksite'],
    });

    let effective: EffectiveVisibility = { ...DEFAULT_VISIBILITY };
    const projectScoped = list.filter((p) => !p.worksite);
    const siteScoped = list.filter((p) => p.worksite?.id === worksiteId);

    for (const pr of projectScoped) {
      effective = mergeVisibility(
        effective,
        pr.featureFlags,
        pr.visibleBlockIds,
        pr.hiddenBlockIds,
      );
    }
    for (const pr of siteScoped) {
      effective = mergeVisibility(
        effective,
        pr.featureFlags,
        pr.visibleBlockIds,
        pr.hiddenBlockIds,
      );
    }
    return effective;
  }

  async bumpSessionVersion(targetUserId: string) {
    await this.usersService.bumpSessionVersion(targetUserId);
  }

  async assertAdminSameOrg(
    adminUserId: string,
    targetUserId: string,
  ): Promise<{ admin: User; target: User }> {
    const admin = await this.usersService.findById(adminUserId);
    const target = await this.usersService.findById(targetUserId);
    if (!admin || !target) throw new NotFoundException('User not found');
    if (String(admin.role).toUpperCase() !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    if (admin.organizationId !== target.organizationId) {
      throw new ForbiddenException('Different organization');
    }
    return { admin, target };
  }

  async listAccess(targetUserId: string) {
    return this.access.find({
      where: { userId: targetUserId },
      relations: ['project', 'worksite'],
    });
  }

  async listVisibilityProfiles(targetUserId: string) {
    return this.profiles.find({
      where: { userId: targetUserId },
      relations: ['project', 'worksite'],
    });
  }

  async replaceProjectAccess(
    targetUserId: string,
    projectId: string,
    worksiteIds: string[] | null,
  ) {
    const project = await this.projects.findOne({
      where: { id: projectId },
      relations: ['worksites'],
    });
    if (!project) throw new NotFoundException('Project not found');

    await this.access.delete({ userId: targetUserId, projectId });

    if (worksiteIds === null || worksiteIds.length === 0) {
      await this.access.save(
        this.access.create({ userId: targetUserId, projectId }),
      );
      await this.bumpSessionVersion(targetUserId);
      return;
    }

    for (const wid of worksiteIds) {
      const ws = project.worksites?.find((w) => w.id === wid);
      if (!ws) continue;
      await this.access.save(
        this.access.create({
          userId: targetUserId,
          projectId,
          worksite: ws,
        }),
      );
    }
    await this.bumpSessionVersion(targetUserId);
  }

  async upsertVisibility(
    targetUserId: string,
    projectId: string,
    worksiteId: string | null,
    body: {
      featureFlags?: Record<string, boolean>;
      visibleBlockIds?: string[] | null;
      hiddenBlockIds?: string[];
    },
  ) {
    const whereClause = worksiteId
      ? {
          userId: targetUserId,
          projectId,
          worksite: { id: worksiteId },
        }
      : {
          userId: targetUserId,
          projectId,
          worksite: IsNull(),
        };

    let existing = await this.profiles.findOne({
      where: whereClause,
      relations: ['worksite'],
    });

    if (!existing) {
      const created = this.profiles.create({
        userId: targetUserId,
        projectId,
        featureFlags: body.featureFlags ?? {},
        visibleBlockIds:
          body.visibleBlockIds !== undefined ? body.visibleBlockIds : null,
        hiddenBlockIds: body.hiddenBlockIds ?? [],
      });
      if (worksiteId) {
        const ws = await this.worksites.findOne({
          where: { id: worksiteId, projectId },
        });
        if (ws) created.worksite = ws;
      }
      await this.profiles.save(created);
      await this.bumpSessionVersion(targetUserId);
      return created;
    }

    if (body.featureFlags !== undefined) {
      existing.featureFlags = {
        ...existing.featureFlags,
        ...body.featureFlags,
      };
    }
    if (body.visibleBlockIds !== undefined) {
      existing.visibleBlockIds = body.visibleBlockIds;
    }
    if (body.hiddenBlockIds !== undefined) {
      existing.hiddenBlockIds = body.hiddenBlockIds;
    }

    await this.profiles.save(existing);
    await this.bumpSessionVersion(targetUserId);
    return existing;
  }

  async patchVisibilityFeatures(
    targetUserId: string,
    projectId: string,
    worksiteId: string | null,
    patch: Record<string, boolean>,
  ) {
    const row = await this.upsertVisibility(targetUserId, projectId, worksiteId, {
      featureFlags: patch,
    });
    return row;
  }
}
