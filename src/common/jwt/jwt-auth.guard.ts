import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from '../../users/users.service';
import {
  IS_ADMIN_KEY,
  IS_PUBLIC_KEY,
  PAGE_PERMISSIONS_KEY,
  IS_SUPERADMIN_KEY,
  IS_UPLOAD_KEY,
  IS_USER_KEY,
} from '../decorators/public.decorator';
import {
  isAdminLikeRole,
  isSuperAdminRole,
  normalizeUserRole,
} from '../../users/domain/user-role.constants';

const UPLOAD_ROUTE_PREFIX = '/uploads';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const activated = await super.canActivate(context);
    if (!activated) {
      return false;
    }

    const requiredPagePermissions = this.reflector.getAllAndOverride<string[]>(
      PAGE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.id) {
      throw new ForbiddenException('Access denied');
    }

    const normalizedRole = normalizeUserRole(user.role);
    const isUploadOnlyRoute = this.reflector.getAllAndOverride<boolean>(
      IS_UPLOAD_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      normalizedRole === 'UPLOAD' &&
      !isUploadOnlyRoute &&
      !String(request.route?.path ?? request.path ?? '').startsWith(
        UPLOAD_ROUTE_PREFIX,
      )
    ) {
      throw new ForbiddenException('Upload users can only access upload routes');
    }

    if (!requiredPagePermissions?.length) {
      return true;
    }

    const usersService = this.moduleRef.get(UsersService, { strict: false });
    const currentUser = await usersService.findById(user.id);
    if (!currentUser) {
      throw new ForbiddenException('User not found');
    }

    const currentPermissions =
      usersService.getEffectivePagePermissionsForUser(currentUser);
    request.user = {
      ...user,
      role: currentUser.role,
      organizationId: currentUser.organizationId,
      pagePermissions: currentPermissions,
    };

    if (isSuperAdminRole(currentUser.role)) {
      return true;
    }

    if (normalizeUserRole(currentUser.role) === 'ADMIN') {
      return true;
    }

    if (normalizeUserRole(currentUser.role) === 'UPLOAD') {
      throw new ForbiddenException('Page permission required');
    }

    if (currentPermissions.includes('*')) {
      return true;
    }

    const hasAllPermissions = requiredPagePermissions.every((permission) =>
      currentPermissions.includes(permission.toLowerCase().trim()),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException('Page permission required');
    }

    return true;
  }

  handleRequest(err: any, user: any, _info: any, context: ExecutionContext) {
    if (err || !user) {
      throw err || new ForbiddenException('Access denied');
    }

    const isAdminOnly = this.reflector.getAllAndOverride<boolean>(
      IS_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isAdminOnly && !isAdminLikeRole(user.role)) {
      throw new ForbiddenException('Admin access required');
    }

    const isSuperAdminOnly = this.reflector.getAllAndOverride<boolean>(
      IS_SUPERADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isSuperAdminOnly && !isSuperAdminRole(user.role)) {
      throw new ForbiddenException('Superadmin access required');
    }

    const isUserOnly = this.reflector.getAllAndOverride<boolean>(IS_USER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isUserOnly && normalizeUserRole(user.role) !== 'USER') {
      throw new ForbiddenException('User access required');
    }

    const isUploadOnly = this.reflector.getAllAndOverride<boolean>(
      IS_UPLOAD_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      isUploadOnly &&
      normalizeUserRole(user.role) !== 'UPLOAD' &&
      !isAdminLikeRole(user.role)
    ) {
      throw new ForbiddenException('Upload access required');
    }

    return user;
  }
}
