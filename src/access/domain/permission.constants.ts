export const PAGE_PERMISSIONS = {
  SESSION_VIEW: 'session.view',
  PROGRESS_VIEW: 'progress.view',
  DASHBOARD_VIEW: 'dashboard.view',
  ELEMENT_CLASSES_VIEW: 'element-classes.view',
  PROJECTS_VIEW: 'projects.view',
  PROJECTS_MANAGE: 'projects.manage',
  BLOCKS_VIEW: 'blocks.view',
  BLOCKS_MANAGE: 'blocks.manage',
  ORGANIZATIONS_VIEW: 'organizations.view',
  ORGANIZATIONS_MANAGE: 'organizations.manage',
  UPLOADS_VIEW: 'uploads.view',
  ADMIN_MANAGE: 'admin.manage',
  SYSTEM_MAIL: 'system.mail',
  SYSTEM_QUEUES: 'system.queues',
  SYSTEM_SQS: 'system.sqs',
  SYSTEM_EVENTBRIDGE: 'system.eventbridge',
  SYSTEM_STORAGE: 'system.storage',
  SYSTEM_CLOUDFRONT: 'system.cloudfront',
} as const;

export type PagePermission =
  (typeof PAGE_PERMISSIONS)[keyof typeof PAGE_PERMISSIONS];

export const IMPLICIT_PAGE_PERMISSIONS = [
  PAGE_PERMISSIONS.SESSION_VIEW,
  PAGE_PERMISSIONS.PROGRESS_VIEW,
] as const;

export const USER_SELECTABLE_PAGE_PERMISSIONS = [
  PAGE_PERMISSIONS.DASHBOARD_VIEW,
  PAGE_PERMISSIONS.BLOCKS_VIEW,
  PAGE_PERMISSIONS.ELEMENT_CLASSES_VIEW,
] as const;

export const UPLOAD_ROLE_IMPLICIT_PAGE_PERMISSIONS = [
  PAGE_PERMISSIONS.UPLOADS_VIEW,
] as const;
