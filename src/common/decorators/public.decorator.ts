import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../jwt/jwt-auth.guard';

export const IS_PUBLIC_KEY = 'isPublic';
export const IS_ADMIN_KEY = 'isAdmin';
export const IS_USER_KEY = 'isUser';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const AdminOnly = () =>
  applyDecorators(
    UseGuards(JwtAuthGuard),
    SetMetadata(IS_ADMIN_KEY, true),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Admin token required',
    }),
  );

export const UserOnly = () =>
  applyDecorators(
    UseGuards(JwtAuthGuard),
    SetMetadata(IS_USER_KEY, true),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - User token required',
    }),
  );

export const AuthRequired = () =>
  applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing JWT token',
    }),
  );
