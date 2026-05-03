import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IMPLICIT_PAGE_PERMISSIONS,
  PAGE_PERMISSIONS,
  UPLOAD_ROLE_IMPLICIT_PAGE_PERMISSIONS,
} from '../access/domain/permission.constants';
import { toStringArray } from '../common/transforms/to-string-array';
import {
  isUploadRole,
  normalizeUserRole,
} from './domain/user-role.constants';
import { User } from './entities/user.entity';

const LEGACY_PAGE_PERMISSION_ALIASES: Record<string, string> = {
  'uploads.manage': PAGE_PERMISSIONS.UPLOADS_VIEW,
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findById(id: string) {
    return this.users.findOne({ where: { id } });
  }

  findByEmailNormalized(email: string) {
    return this.users.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  count() {
    return this.users.count();
  }

  bumpSessionVersion(userId: string) {
    return this.users.increment({ id: userId }, 'sessionVersion', 1);
  }

  normalizePagePermissions(pagePermissions?: string[] | string | null) {
    const values = toStringArray(pagePermissions);
    if (!values.length) {
      return [];
    }

    return [...new Set(
      values
        .map((permission) => this.normalizeStoredPermission(permission))
        .filter((permission): permission is string => Boolean(permission)),
    )].sort((a, b) => a.localeCompare(b));
  }

  getEffectivePagePermissions(
    role: string,
    pagePermissions?: string[] | string | null,
  ) {
    const normalizedRole = normalizeUserRole(role);
    const storedPermissions = this.normalizePagePermissions(pagePermissions);
    const effective = new Set<string>([
      ...IMPLICIT_PAGE_PERMISSIONS,
      ...storedPermissions,
    ]);

    if (isUploadRole(normalizedRole)) {
      for (const permission of UPLOAD_ROLE_IMPLICIT_PAGE_PERMISSIONS) {
        effective.add(permission);
      }
    }

    return [...effective].sort((a, b) => a.localeCompare(b));
  }

  getEffectivePagePermissionsForUser(user: Pick<User, 'role' | 'pagePermissions'>) {
    return this.getEffectivePagePermissions(user.role, user.pagePermissions);
  }

  private normalizeStoredPermission(permission: string | null | undefined) {
    const normalized = permission?.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const canonical =
      LEGACY_PAGE_PERMISSION_ALIASES[normalized] ?? normalized;

    if (canonical === PAGE_PERMISSIONS.SESSION_VIEW) {
      return null;
    }
    if (canonical === PAGE_PERMISSIONS.PROGRESS_VIEW) {
      return null;
    }
    if (canonical === PAGE_PERMISSIONS.UPLOADS_VIEW) {
      return null;
    }

    return canonical;
  }

  async updatePagePermissions(
    userId: string,
    pagePermissions: string[] | string,
  ) {
    const normalizedPermissions = this.normalizePagePermissions(pagePermissions);
    await this.users.update(
      { id: userId },
      { pagePermissions: normalizedPermissions },
    );

    return this.findById(userId);
  }
}
