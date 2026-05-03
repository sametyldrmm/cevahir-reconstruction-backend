import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { AccessPolicyService } from '../access/access-policy.service';
import type { JwtUserShape } from '../access/access-policy.service';
import { PasswordService } from '../common/security/password.service';
import { Organization } from '../organizations/entities/organization.entity';
import { Project } from '../projects/entities/project.entity';
import { UserProjectAccess } from '../projects/entities/user-project-access.entity';
import { VisibilityProfile } from '../projects/entities/visibility-profile.entity';
import { Worksite } from '../projects/entities/worksite.entity';
import { User } from '../users/entities/user.entity';
import {
  isSuperAdminRole,
  normalizeUserRole,
  USER_ROLES,
} from '../users/domain/user-role.constants';
import { UsersService } from '../users/users.service';
import { CreateSuperadminUserDto } from './dto/create-superadmin-user.dto';
import { ListSuperadminUsersDto } from './dto/list-superadmin-users.dto';
import { UpdateSuperadminUserAccountDto } from './dto/update-superadmin-user-account.dto';

@Injectable()
export class SuperadminService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(UserProjectAccess)
    private readonly access: Repository<UserProjectAccess>,
    @InjectRepository(VisibilityProfile)
    private readonly profiles: Repository<VisibilityProfile>,
    @InjectRepository(Worksite)
    private readonly worksites: Repository<Worksite>,
    private readonly usersService: UsersService,
    private readonly passwords: PasswordService,
    private readonly policy: AccessPolicyService,
  ) {}

  async listUsers(query: ListSuperadminUsersDto) {
    const where: Record<string, unknown> = {};

    if (query.organizationId?.trim()) {
      where.organizationId = query.organizationId.trim();
    }
    if (query.role?.trim()) {
      where.role = normalizeUserRole(query.role);
    }
    if (query.search?.trim()) {
      where.email = ILike(`%${query.search.trim().toLowerCase()}%`);
    }

    const rows = await this.users.find({
      where,
      relations: ['organization'],
      order: {
        email: 'ASC',
      },
    });

    return rows.map((row) => this.serializeUser(row));
  }

  async listOrganizations() {
    return this.organizations.find({
      order: {
        name: 'ASC',
      },
    });
  }

  async createOrganization(name: string) {
    const normalized = name.trim();
    if (!normalized) {
      throw new BadRequestException('Organization name is required');
    }

    const existing = await this.organizations.findOne({
      where: { name: ILike(normalized) },
    });
    if (existing) {
      throw new ConflictException('Organization name is already in use');
    }

    return this.organizations.save(
      this.organizations.create({
        name: normalized,
      }),
    );
  }

  async listProjects(organizationId?: string) {
    const where = organizationId?.trim()
      ? { organizationId: organizationId.trim() }
      : undefined;

    const rows = await this.projects.find({
      where,
      relations: ['organization', 'worksites'],
      order: {
        name: 'ASC',
        worksites: {
          code: 'ASC',
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      organizationId: row.organizationId,
      organizationName: row.organization?.name ?? null,
      worksites: (row.worksites ?? []).map((worksite) => ({
        id: worksite.id,
        code: worksite.code,
        name: worksite.name,
      })),
    }));
  }

  async findOrCreateProjectByInput(user: JwtUserShape, projectName: string) {
    const normalized = projectName.trim();
    if (!normalized) {
      throw new BadRequestException('projectName is required');
    }
    if (!user.organizationId?.trim()) {
      throw new BadRequestException(
        'Superadmin organizationId is required to create a project',
      );
    }

    const organizationId = user.organizationId.trim();
    const exactNameMatches = await this.projects.find({
      where: {
        organizationId,
        name: ILike(normalized),
      },
      order: { name: 'ASC' },
    });
    if (exactNameMatches.length === 1) {
      return exactNameMatches[0];
    }
    if (exactNameMatches.length > 1) {
      throw new BadRequestException(
        'More than one project matches this projectName; use a unique project name',
      );
    }

    const slugMatches = await this.projects.find({
      where: {
        organizationId,
        slug: ILike(normalized),
      },
      order: { name: 'ASC' },
    });
    if (slugMatches.length === 1) {
      return slugMatches[0];
    }
    if (slugMatches.length > 1) {
      throw new BadRequestException(
        'More than one project matches this projectName; use a unique project name',
      );
    }

    const organization = await this.organizations.findOne({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const created = await this.projects.save(
      this.projects.create({
        organizationId,
        name: normalized,
        slug: await this.ensureUniqueProjectSlug(organizationId, normalized),
      }),
    );

    return created;
  }

  async ensureDefaultWorksite(projectId: string) {
    const existingByName = await this.worksites.findOne({
      where: {
        projectId,
        name: 'Merkez Şantiye',
      },
    });
    if (existingByName) {
      return existingByName;
    }

    const code = await this.ensureUniqueWorksiteCode(projectId, 'WS-01');
    return this.worksites.save(
      this.worksites.create({
        projectId,
        code,
        name: 'Merkez Şantiye',
      }),
    );
  }

  private async ensureUniqueProjectSlug(
    organizationId: string,
    projectName: string,
  ) {
    const baseSlug = this.slugify(projectName) || 'imported-project';
    let candidate = baseSlug;
    let suffix = 1;

    while (
      await this.projects.exist({
        where: { organizationId, slug: candidate },
      })
    ) {
      suffix += 1;
      candidate = `${baseSlug}-${suffix}`;
    }

    return candidate;
  }

  private async ensureUniqueWorksiteCode(projectId: string, baseCode: string) {
    let candidate = baseCode || 'WS-IMPORTED';
    let suffix = 1;

    while (
      await this.worksites.exist({
        where: { projectId, code: candidate },
      })
    ) {
      suffix += 1;
      candidate = `${baseCode}-${suffix}`;
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

  async getUser(userId: string) {
    const row = await this.users.findOne({
      where: { id: userId },
      relations: ['organization'],
    });
    if (!row) {
      throw new NotFoundException('User not found');
    }

    const projectAccess = await this.policy.listAccess(userId);
    const visibilityProfiles = await this.policy.listVisibilityProfiles(userId);

    return {
      user: this.serializeUser(row),
      projectAccess: projectAccess.map((entry) => ({
        projectId: entry.projectId,
        projectName: entry.project?.name ?? null,
        worksiteId: entry.worksite?.id ?? null,
        worksiteCode: entry.worksite?.code ?? null,
      })),
      visibilityProfiles: visibilityProfiles.map((entry) => ({
        id: entry.id,
        projectId: entry.projectId,
        projectName: entry.project?.name ?? null,
        worksiteId: entry.worksite?.id ?? null,
        worksiteCode: entry.worksite?.code ?? null,
        featureFlags: entry.featureFlags ?? {},
        visibleBlockIds: entry.visibleBlockIds ?? null,
        hiddenBlockIds: entry.hiddenBlockIds ?? [],
      })),
      permissions: await this.policy.buildPermissionMapForUser(userId),
    };
  }

  async createUser(body: CreateSuperadminUserDto) {
    const email = body.email.toLowerCase().trim();
    const role = normalizeUserRole(body.role);
    const organizationId = body.organizationId.trim();

    if (await this.users.findOne({ where: { email } })) {
      throw new ConflictException('Email is already in use');
    }

    const organization = await this.organizations.findOne({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const passwordHash = await this.passwords.hash(body.password);
    const pagePermissions = this.usersService.normalizePagePermissions(
      body.pagePermissions,
    );

    const created = await this.users.save(
      this.users.create({
        email,
        passwordHash,
        role,
        organizationId,
        pagePermissions,
      }),
    );

    return this.getUser(created.id);
  }

  async updateUserAccount(
    userId: string,
    body: UpdateSuperadminUserAccountDto,
  ) {
    const row = await this.users.findOne({ where: { id: userId } });
    if (!row) {
      throw new NotFoundException('User not found');
    }

    const update: Partial<User> = {};
    const nextEmail = body.email?.toLowerCase().trim();
    const nextRole = body.role ? normalizeUserRole(body.role) : undefined;
    const nextOrganizationId = body.organizationId?.trim();

    if (nextEmail && nextEmail !== row.email) {
      const duplicate = await this.users.findOne({ where: { email: nextEmail } });
      if (duplicate && duplicate.id !== row.id) {
        throw new ConflictException('Email is already in use');
      }
      update.email = nextEmail;
    }

    if (nextRole && !Object.values(USER_ROLES).includes(nextRole as any)) {
      throw new BadRequestException('Invalid role');
    }

    if (nextRole && nextRole !== row.role) {
      await this.assertSuperadminWillRemain(row, nextRole);
      update.role = nextRole;
    }

    const organizationChanged =
      Boolean(nextOrganizationId) && nextOrganizationId !== row.organizationId;

    if (organizationChanged) {
      const org = await this.organizations.findOne({
        where: { id: nextOrganizationId },
      });
      if (!org) {
        throw new NotFoundException('Organization not found');
      }
      update.organizationId = nextOrganizationId;
    }

    if (Object.keys(update).length > 0 || organizationChanged) {
      await this.users.manager.transaction(async (manager) => {
        if (organizationChanged) {
          await manager.getRepository(UserProjectAccess).delete({ userId });
          await manager.getRepository(VisibilityProfile).delete({ userId });
        }

        if (Object.keys(update).length > 0) {
          await manager.getRepository(User).update({ id: userId }, update);
        }
      });
      await this.usersService.bumpSessionVersion(userId);
    }

    return this.getUser(userId);
  }

  async updateUserPassword(userId: string, password: string) {
    const row = await this.users.findOne({ where: { id: userId } });
    if (!row) {
      throw new NotFoundException('User not found');
    }

    const passwordHash = await this.passwords.hash(password);
    await this.users.update({ id: userId }, { passwordHash });
    await this.usersService.bumpSessionVersion(userId);

    return {
      ok: true,
      userId,
    };
  }

  async deleteUser(userId: string) {
    const row = await this.users.findOne({ where: { id: userId } });
    if (!row) {
      throw new NotFoundException('User not found');
    }

    await this.assertSuperadminWillRemain(row, USER_ROLES.USER);
    await this.users.delete({ id: userId });

    return {
      ok: true,
      userId,
    };
  }

  private async assertSuperadminWillRemain(currentUser: User, nextRole: string) {
    if (!isSuperAdminRole(currentUser.role) || isSuperAdminRole(nextRole)) {
      return;
    }

    const superadminCount = await this.users.count({
      where: { role: USER_ROLES.SUPERADMIN },
    });
    if (superadminCount <= 1) {
      throw new BadRequestException(
        'You cannot remove the last SUPERADMIN user',
      );
    }
  }

  private serializeUser(row: User & { organization?: Organization | null }) {
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      organizationId: row.organizationId,
      organizationName: row.organization?.name ?? null,
      sessionVersion: row.sessionVersion,
      pagePermissions: this.usersService.getEffectivePagePermissionsForUser(row),
    };
  }
}
