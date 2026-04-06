import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_ADMIN_KEY, IS_USER_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAdmin = this.reflector.getAllAndOverride<boolean>(
      IS_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredUser = this.reflector.getAllAndOverride<boolean>(
      IS_USER_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredAdmin && !requiredUser) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (requiredAdmin && user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    if (requiredUser && user.role !== 'user') {
      throw new ForbiddenException('User access required');
    }

    return true;
  }
}
