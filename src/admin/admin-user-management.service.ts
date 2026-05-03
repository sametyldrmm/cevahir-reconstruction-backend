import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessPolicyService } from '../access/access-policy.service';
import { PasswordService } from '../common/security/password.service';
import { UserProjectAccess } from '../projects/entities/user-project-access.entity';
import { VisibilityProfile } from '../projects/entities/visibility-profile.entity';
import { User } from '../users/entities/user.entity';
import {
  isAdminLikeRole,
  isUploadRole,
  normalizeUserRole,
  USER_ROLES,
} from '../users/domain/user-role.constants';
import { UsersService } from '../users/users.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserAccountDto } from './dto/update-admin-user-account.dto';

@Injectable()
export class AdminUserManagementService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly usersService: UsersService,
    private readonly passwords: PasswordService,
    private readonly policy: AccessPolicyService,
  ) {}

  async listUsers(adminUserId: string) {
    const admin = await this.usersService.findById(adminUserId);
    if (!admin || !isAdminLikeRole(admin.role)) {
      throw new ForbiddenException('Admin only');
    }

    const rows = await this.users.find({
      where: {
        organizationId: admin.organizationId,
      },
      order: {
        email: 'ASC',
      },
    });

    return rows
      .filter(
        (row) =>
          normalizeUserRole(row.role) === USER_ROLES.USER ||
          normalizeUserRole(row.role) === USER_ROLES.UPLOAD,
      )
      .map((row) => this.serializeUser(row));
  }

  async getUser(adminUserId: string, targetUserId: string) {
    await this.policy.assertAdminCanManageAccount(adminUserId, targetUserId);

    const row = await this.users.findOne({
      where: { id: targetUserId },
    });
    if (!row) {
      throw new NotFoundException('User not found');
    }

    return this.serializeUser(row);
  }

  async createUser(adminUserId: string, body: CreateAdminUserDto) {
    const admin = await this.usersService.findById(adminUserId);
    if (!admin || !isAdminLikeRole(admin.role)) {
      throw new ForbiddenException('Admin only');
    }

    const email = body.email.toLowerCase().trim();
    const role = this.normalizeManageableRole(body.role);
    const pagePermissions = this.usersService.normalizePagePermissions(
      body.pagePermissions,
    );

    if (await this.users.findOne({ where: { email } })) {
      throw new ConflictException('Email is already in use');
    }

    const passwordHash = await this.passwords.hash(body.password);
    const created = await this.users.save(
      this.users.create({
        email,
        passwordHash,
        role,
        organizationId: admin.organizationId,
        pagePermissions,
      }),
    );

    return this.serializeUser(created);
  }

  async updateUserAccount(
    adminUserId: string,
    targetUserId: string,
    body: UpdateAdminUserAccountDto,
  ) {
    const { target } = await this.policy.assertAdminCanManageAccount(
      adminUserId,
      targetUserId,
    );

    const update: Partial<User> = {};
    const nextEmail = body.email?.toLowerCase().trim();
    const nextRole = body.role
      ? this.normalizeManageableRole(body.role)
      : undefined;

    if (nextEmail && nextEmail !== target.email) {
      const duplicate = await this.users.findOne({ where: { email: nextEmail } });
      if (duplicate && duplicate.id !== target.id) {
        throw new ConflictException('Email is already in use');
      }
      update.email = nextEmail;
    }

    if (nextRole && nextRole !== normalizeUserRole(target.role)) {
      update.role = nextRole;
    }

    if (Object.keys(update).length === 0) {
      return this.getUser(adminUserId, targetUserId);
    }

    await this.users.manager.transaction(async (manager) => {
      await manager.getRepository(User).update({ id: targetUserId }, update);

      if (nextRole === USER_ROLES.UPLOAD) {
        await manager.getRepository(User).update(
          { id: targetUserId },
          { pagePermissions: [] },
        );
        await manager.getRepository(UserProjectAccess).delete({ userId: targetUserId });
        await manager.getRepository(VisibilityProfile).delete({ userId: targetUserId });
      }
    });

    await this.usersService.bumpSessionVersion(targetUserId);
    return this.getUser(adminUserId, targetUserId);
  }

  async updateUserPassword(
    adminUserId: string,
    targetUserId: string,
    password: string,
  ) {
    await this.policy.assertAdminCanManageAccount(adminUserId, targetUserId);

    const passwordHash = await this.passwords.hash(password);
    await this.users.update({ id: targetUserId }, { passwordHash });
    await this.usersService.bumpSessionVersion(targetUserId);

    return {
      ok: true,
      userId: targetUserId,
    };
  }

  async deleteUser(adminUserId: string, targetUserId: string) {
    await this.policy.assertAdminCanManageAccount(adminUserId, targetUserId);
    await this.users.delete({ id: targetUserId });

    return {
      ok: true,
      userId: targetUserId,
    };
  }

  private normalizeManageableRole(role?: string) {
    const normalized = normalizeUserRole(role ?? USER_ROLES.USER);
    if (normalized !== USER_ROLES.USER && normalized !== USER_ROLES.UPLOAD) {
      throw new BadRequestException(
        'Admins can only create or assign USER and UPLOAD roles',
      );
    }

    return normalized;
  }

  private serializeUser(row: User) {
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      organizationId: row.organizationId,
      sessionVersion: row.sessionVersion,
      pagePermissions: this.usersService.getEffectivePagePermissionsForUser(row),
    };
  }
}
