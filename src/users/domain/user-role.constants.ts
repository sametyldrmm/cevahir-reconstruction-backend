export const USER_ROLES = {
  SUPERADMIN: 'SUPERADMIN',
  ADMIN: 'ADMIN',
  USER: 'USER',
  UPLOAD: 'UPLOAD',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export function normalizeUserRole(role?: string | null): string {
  return String(role ?? '')
    .trim()
    .toUpperCase();
}

export function isSuperAdminRole(role?: string | null): boolean {
  return normalizeUserRole(role) === USER_ROLES.SUPERADMIN;
}

export function isAdminLikeRole(role?: string | null): boolean {
  const normalized = normalizeUserRole(role);
  return (
    normalized === USER_ROLES.SUPERADMIN || normalized === USER_ROLES.ADMIN
  );
}

export function isUserRole(role?: string | null): boolean {
  return normalizeUserRole(role) === USER_ROLES.USER;
}

export function isUploadRole(role?: string | null): boolean {
  return normalizeUserRole(role) === USER_ROLES.UPLOAD;
}
