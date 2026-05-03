import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../jwt/jwt-auth.guard';

export const IS_PUBLIC_KEY = 'isPublic';
export const IS_ADMIN_KEY = 'isAdmin';
export const IS_SUPERADMIN_KEY = 'isSuperAdmin';
export const IS_USER_KEY = 'isUser';
export const IS_UPLOAD_KEY = 'isUpload';
export const PAGE_PERMISSIONS_KEY = 'pagePermissions';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const AdminOnly = () =>
  applyDecorators(
    UseGuards(JwtAuthGuard),
    SetMetadata(IS_ADMIN_KEY, true),
    ApiBearerAuth('JWT'),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Admin token required',
    }),
  );

export const SuperAdminOnly = () =>
  applyDecorators(
    UseGuards(JwtAuthGuard),
    SetMetadata(IS_SUPERADMIN_KEY, true),
    ApiBearerAuth('JWT'),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Superadmin token required',
    }),
  );

export const UserOnly = () =>
  applyDecorators(
    UseGuards(JwtAuthGuard),
    SetMetadata(IS_USER_KEY, true),
    ApiBearerAuth('JWT'),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - User token required',
    }),
  );

export const UploadOnly = () =>
  applyDecorators(
    UseGuards(JwtAuthGuard),
    SetMetadata(IS_UPLOAD_KEY, true),
    ApiBearerAuth('JWT'),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Upload token required',
    }),
  );

export const AuthRequired = () =>
  applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiBearerAuth('JWT'),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing JWT token',
    }),
  );

export const PagePermissions = (...pagePermissions: string[]) =>
  SetMetadata(PAGE_PERMISSIONS_KEY, pagePermissions);
