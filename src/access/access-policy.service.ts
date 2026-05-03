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
import { Organization } from '../organizations/entities/organization.entity';
import {
  ADMIN_VISIBILITY,
  DEFAULT_VISIBILITY,
  type EffectiveVisibility,
  mergeVisibility,
} from './domain/visibility.types';
import {
  isAdminLikeRole,
  isUserRole,
  isUploadRole,
  isSuperAdminRole,
  normalizeUserRole,
} from '../users/domain/user-role.constants';

export interface JwtUserShape {
  id: string;
  email: string;
  role: string;
  organizationId?: string;
  pagePermissions?: string[];
}

export interface SessionProjectDto {
  id: string;
  slug: string;
  name: string;
  organizationId: string;
  fullProjectAccess: boolean;
  worksiteCodes: string[];
}

export interface SessionVisibilityProfileDto {
  projectId: string;
  projectSlug: string;
  worksiteId: string | null;
  worksiteCode: string | null;
  featureFlags: Record<string, boolean>;
  visibleBlockIds: string[] | null;
  hiddenBlockIds: string[];
}

export interface SessionPermissionMapDto {
  organizationIds: string[];
  pagePermissions: string[];
  projects: SessionProjectDto[];
  visibilityProfiles: SessionVisibilityProfileDto[];
  roleCapabilities: SessionRoleCapabilitiesDto;
}

export interface SessionRoleCapabilitiesDto {
  canAccessAllPages: boolean;
  canAccessAllData: boolean;
  canAccessSuperadminRoutes: boolean;
  canAccessAdminRoutes: boolean;
  canAccessUploadRoutes: boolean;
  uploadRoutesOnly: boolean;
  usesAssignedPagePermissions: boolean;
  usesAssignedProjectAccess: boolean;
  usesAssignedVisibilityProfiles: boolean;
}

export interface SessionBootstrapDto {
  user: {
    id: string;
    email: string;
    role: string;
    sessionVersion: number;
    pagePermissions: string[];
  };
  organizationId: string;
  projects: SessionProjectDto[];
  visibilityProfiles: SessionVisibilityProfileDto[];
  permissions: SessionPermissionMapDto;
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
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
  ) {}

  async buildSession(user: JwtUserShape): Promise<SessionBootstrapDto> {
    const row = await this.usersService.findById(user.id);
    if (!row) {
      throw new ForbiddenException('User not found');
    }
    const organizationIds = await this.getAccessibleOrganizationIds(row);
    const projectDtos = await this.getAccessibleProjects(row);
    const visibilityProfiles = await this.getVisibilityProfilesForSession(row);
    const roleCapabilities = this.buildRoleCapabilities(row.role);
    const effectivePagePermissions =
      this.usersService.getEffectivePagePermissionsForUser(row);
    return {
      user: {
        id: row.id,
        email: row.email,
        role: row.role,
        sessionVersion: row.sessionVersion,
        pagePermissions: effectivePagePermissions,
      },
      organizationId: row.organizationId,
      projects: projectDtos,
      visibilityProfiles,
      permissions: {
        organizationIds,
        pagePermissions: effectivePagePermissions,
        projects: projectDtos,
        visibilityProfiles,
        roleCapabilities,
      },
    };
  }

  private buildRoleCapabilities(role: string): SessionRoleCapabilitiesDto {
    if (isSuperAdminRole(role)) {
      return {
        canAccessAllPages: true,
        canAccessAllData: true,
        canAccessSuperadminRoutes: true,
        canAccessAdminRoutes: true,
        canAccessUploadRoutes: true,
        uploadRoutesOnly: false,
        usesAssignedPagePermissions: false,
        usesAssignedProjectAccess: false,
        usesAssignedVisibilityProfiles: false,
      };
    }

    if (normalizeUserRole(role) === 'ADMIN') {
      return {
        canAccessAllPages: true,
        canAccessAllData: true,
        canAccessSuperadminRoutes: false,
        canAccessAdminRoutes: true,
        canAccessUploadRoutes: true,
        uploadRoutesOnly: false,
        usesAssignedPagePermissions: false,
        usesAssignedProjectAccess: false,
        usesAssignedVisibilityProfiles: false,
      };
    }

    if (normalizeUserRole(role) === 'UPLOAD') {
      return {
        canAccessAllPages: false,
        canAccessAllData: false,
        canAccessSuperadminRoutes: false,
        canAccessAdminRoutes: false,
        canAccessUploadRoutes: true,
        uploadRoutesOnly: true,
        usesAssignedPagePermissions: false,
        usesAssignedProjectAccess: false,
        usesAssignedVisibilityProfiles: false,
      };
    }

    return {
      canAccessAllPages: false,
      canAccessAllData: false,
      canAccessSuperadminRoutes: false,
      canAccessAdminRoutes: false,
      canAccessUploadRoutes: false,
      uploadRoutesOnly: false,
      usesAssignedPagePermissions: true,
      usesAssignedProjectAccess: true,
      usesAssignedVisibilityProfiles: true,
    };
  }

  private async getAccessibleOrganizationIds(user: User): Promise<string[]> {
    if (isSuperAdminRole(user.role)) {
      const rows = await this.organizations.find({
        order: {
          name: 'ASC',
        },
      });

      return rows.map((row) => row.id);
    }

    return [user.organizationId];
  }

  private async getAccessibleProjects(user: User): Promise<SessionProjectDto[]> {
    if (isUploadRole(user.role)) {
      return [];
    }

    if (isAdminLikeRole(user.role)) {
      const rows = await this.projects.find({
        where: isSuperAdminRole(user.role)
          ? undefined
          : { organizationId: user.organizationId },
        relations: ['worksites'],
      });

      return rows
        .map((project) => ({
          id: project.id,
          slug: project.slug,
          name: project.name,
          organizationId: project.organizationId,
          fullProjectAccess: true,
          worksiteCodes: (project.worksites ?? [])
            .map((worksite) => worksite.code)
            .sort((a, b) => a.localeCompare(b, 'tr')),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    }

    const userId = user.id;
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
        organizationId: project.organizationId,
        fullProjectAccess: codes === null,
        worksiteCodes: allowed.sort((a, b) => a.localeCompare(b, 'tr')),
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }

  private async getVisibilityProfilesForSession(
    user: User,
  ): Promise<SessionVisibilityProfileDto[]> {
    if (isAdminLikeRole(user.role) || isUploadRole(user.role)) {
      return [];
    }

    const rows = await this.profiles.find({
      where: { userId: user.id },
      relations: ['project', 'worksite'],
    });

    return rows
      .map((row) => ({
        projectId: row.projectId,
        projectSlug: row.project?.slug ?? '',
        worksiteId: row.worksite?.id ?? null,
        worksiteCode: row.worksite?.code ?? null,
        featureFlags: row.featureFlags ?? {},
        visibleBlockIds: row.visibleBlockIds ?? null,
        hiddenBlockIds: row.hiddenBlockIds ?? [],
      }))
      .sort((a, b) => {
        const byProject = a.projectSlug.localeCompare(b.projectSlug, 'tr');
        if (byProject !== 0) {
          return byProject;
        }

        return (a.worksiteCode ?? '').localeCompare(b.worksiteCode ?? '', 'tr');
      });
  }

  async buildPermissionMap(user: JwtUserShape): Promise<SessionPermissionMapDto> {
    const session = await this.buildSession(user);

    return session.permissions;
  }

  async buildPermissionMapForUser(targetUserId: string): Promise<SessionPermissionMapDto> {
    const row = await this.usersService.findById(targetUserId);
    if (!row) {
      throw new NotFoundException('User not found');
    }

    return this.buildPermissionMap({
      id: row.id,
      email: row.email,
      role: row.role,
      organizationId: row.organizationId,
      pagePermissions: row.pagePermissions ?? [],
    });
  }

  async assertProjectAccess(
    userId: string,
    role: string,
    organizationId: string | undefined,
    projectId: string,
  ): Promise<{
    project: Project;
    user: User;
    fullProjectAccess: boolean;
    worksiteCodes: string[];
  }> {
    const userRow = await this.usersService.findById(userId);
    if (!userRow) {
      throw new ForbiddenException('User not found');
    }
    if (isUploadRole(role)) {
      throw new ForbiddenException('Upload users cannot access project data');
    }
    if (
      organizationId &&
      userRow.organizationId !== organizationId &&
      !isSuperAdminRole(role)
    ) {
      throw new ForbiddenException('Organization mismatch');
    }

    const project = await this.projects.findOne({
      where: { id: projectId },
      relations: ['worksites'],
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (
      userRow.organizationId !== project.organizationId &&
      !isSuperAdminRole(role)
    ) {
      throw new ForbiddenException('Project not in organization');
    }

    if (isAdminLikeRole(role)) {
      return {
        project,
        user: userRow,
        fullProjectAccess: true,
        worksiteCodes: (project.worksites ?? [])
          .map((worksite) => worksite.code)
          .sort((a, b) => a.localeCompare(b, 'tr')),
      };
    }

    const accesses = await this.access.find({
      where: { userId, projectId },
      relations: ['worksite'],
    });
    if (accesses.length === 0) {
      throw new ForbiddenException('No access to project');
    }

    const fullProjectAccess = accesses.some((access) => !access.worksite);
    const worksiteCodes = fullProjectAccess
      ? (project.worksites ?? []).map((worksite) => worksite.code)
      : accesses
          .map((access) => access.worksite?.code)
          .filter((code): code is string => Boolean(code));

    return {
      project,
      user: userRow,
      fullProjectAccess,
      worksiteCodes: [...new Set(worksiteCodes)].sort((a, b) =>
        a.localeCompare(b, 'tr'),
      ),
    };
  }

  async assertWorksiteInProject(
    userId: string,
    role: string,
    organizationId: string | undefined,
    projectId: string,
    worksiteCode: string,
  ): Promise<{ project: Project; worksite: Worksite; user: User }> {
    const { project, user: userRow, fullProjectAccess, worksiteCodes } =
      await this.assertProjectAccess(userId, role, organizationId, projectId);
    const worksite = project.worksites?.find((w) => w.code === worksiteCode);
    if (!worksite) {
      throw new NotFoundException('Worksite not found in project');
    }

    if (!fullProjectAccess && !worksiteCodes.includes(worksiteCode)) {
      throw new ForbiddenException('No access to worksite');
    }

    return { project, worksite, user: userRow };
  }

  isBlockVisible(visibility: EffectiveVisibility, blockId: string) {
    const normalizedBlockId = blockId.trim();
    if (!normalizedBlockId) {
      return false;
    }

    if (
      visibility.visibleBlockIds !== null &&
      !visibility.visibleBlockIds.includes(normalizedBlockId)
    ) {
      return false;
    }

    return !visibility.hiddenBlockIds.includes(normalizedBlockId);
  }

  async assertBlockVisible(
    userId: string,
    role: string,
    organizationId: string | undefined,
    projectId: string,
    worksiteCode: string,
    blockId: string,
  ) {
    const { project, worksite, user } = await this.assertWorksiteInProject(
      userId,
      role,
      organizationId,
      projectId,
      worksiteCode,
    );
    const visibility = await this.getEffectiveVisibility(
      userId,
      role,
      projectId,
      worksite.id,
    );

    if (!this.isBlockVisible(visibility, blockId)) {
      throw new ForbiddenException('No access to block');
    }

    return { project, worksite, user, visibility };
  }

  async getEffectiveVisibility(
    userId: string,
    role: string,
    projectId: string,
    worksiteId: string | null,
  ): Promise<EffectiveVisibility> {
    if (isAdminLikeRole(role)) {
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
    if (!isAdminLikeRole(admin.role)) {
      throw new ForbiddenException('Admin only');
    }
    if (
      normalizeUserRole(admin.role) === 'ADMIN' &&
      admin.organizationId !== target.organizationId
    ) {
      throw new ForbiddenException('Different organization');
    }
    return { admin, target };
  }

  async assertAdminCanManageAccount(
    adminUserId: string,
    targetUserId: string,
  ): Promise<{ admin: User; target: User }> {
    const { admin, target } = await this.assertAdminSameOrg(adminUserId, targetUserId);

    if (!isUserRole(target.role) && !isUploadRole(target.role)) {
      throw new ForbiddenException('Admins can only manage USER and UPLOAD accounts');
    }

    return { admin, target };
  }

  async assertAdminCanManageUserPermissions(
    adminUserId: string,
    targetUserId: string,
  ): Promise<{ admin: User; target: User }> {
    const { admin, target } = await this.assertAdminCanManageAccount(
      adminUserId,
      targetUserId,
    );

    if (!isUserRole(target.role)) {
      throw new ForbiddenException('Only USER accounts can receive page and data permissions');
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

  async deleteVisibilityProfile(targetUserId: string, profileId: string) {
    const existing = await this.profiles.findOne({
      where: { id: profileId, userId: targetUserId },
    });
    if (!existing) {
      throw new NotFoundException('Visibility profile not found');
    }

    await this.profiles.delete({ id: profileId });
    await this.bumpSessionVersion(targetUserId);
    return { ok: true, userId: targetUserId, profileId };
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

  async getPagePermissions(targetUserId: string) {
    const row = await this.usersService.findById(targetUserId);
    if (!row) {
      throw new NotFoundException('User not found');
    }

    return this.usersService.getEffectivePagePermissionsForUser(row);
  }

  async updatePagePermissions(targetUserId: string, pagePermissions: string[]) {
    const row = await this.usersService.updatePagePermissions(
      targetUserId,
      pagePermissions,
    );
    if (!row) {
      throw new NotFoundException('User not found');
    }

    await this.bumpSessionVersion(targetUserId);
    return this.usersService.getEffectivePagePermissionsForUser(row);
  }
}
