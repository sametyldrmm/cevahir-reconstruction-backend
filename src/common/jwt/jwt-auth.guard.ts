import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import {
  IS_ADMIN_KEY,
  IS_PUBLIC_KEY,
  IS_UPLOAD_KEY,
  IS_USER_KEY,
} from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, _info: any, context: ExecutionContext) {
    if (err || !user) {
      throw err || new ForbiddenException('Access denied');
    }

    const isAdminOnly = this.reflector.getAllAndOverride<boolean>(
      IS_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isAdminOnly && String(user.role).toUpperCase() !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    const isUserOnly = this.reflector.getAllAndOverride<boolean>(IS_USER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isUserOnly && String(user.role).toUpperCase() !== 'USER') {
      throw new ForbiddenException('User access required');
    }

    const isUploadOnly = this.reflector.getAllAndOverride<boolean>(
      IS_UPLOAD_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isUploadOnly && String(user.role).toUpperCase() !== 'UPLOAD') {
      throw new ForbiddenException('Upload access required');
    }

    return user;
  }
}
