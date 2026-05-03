import { AccessPolicyService } from './access-policy.service';
import { DEFAULT_VISIBILITY } from './domain/visibility.types';

describe('AccessPolicyService', () => {
  const usersService = {
    findById: jest.fn(),
    getEffectivePagePermissionsForUser: jest.fn((user) => {
      const base = ['progress.view', 'session.view'];
      const extras = user.role === 'UPLOAD' ? ['uploads.view'] : [];
      return [...new Set([...(user.pagePermissions ?? []), ...base, ...extras])].sort();
    }),
  };
  const service = new AccessPolicyService(
    usersService as any,
    { find: jest.fn() } as any,
    { find: jest.fn() } as any,
    { find: jest.fn() } as any,
    { find: jest.fn() } as any,
    { find: jest.fn() } as any,
  );

  it('allows a block when there is no block restriction', () => {
    expect(service.isBlockVisible(DEFAULT_VISIBILITY, 'D2')).toBe(true);
  });

  it('rejects a block outside the visible block allowlist', () => {
    expect(
      service.isBlockVisible(
        {
          ...DEFAULT_VISIBILITY,
          visibleBlockIds: ['A1', 'B2'],
        },
        'D2',
      ),
    ).toBe(false);
  });

  it('rejects a block that is explicitly hidden', () => {
    expect(
      service.isBlockVisible(
        {
          ...DEFAULT_VISIBILITY,
          hiddenBlockIds: ['D2'],
        },
        'D2',
      ),
    ).toBe(false);
  });

  it('builds superadmin role capabilities with full access', () => {
    expect((service as any).buildRoleCapabilities('SUPERADMIN')).toEqual({
      canAccessAllPages: true,
      canAccessAllData: true,
      canAccessSuperadminRoutes: true,
      canAccessAdminRoutes: true,
      canAccessUploadRoutes: true,
      uploadRoutesOnly: false,
      usesAssignedPagePermissions: false,
      usesAssignedProjectAccess: false,
      usesAssignedVisibilityProfiles: false,
    });
  });

  it('builds upload role capabilities as upload-route-only', () => {
    expect((service as any).buildRoleCapabilities('UPLOAD')).toEqual({
      canAccessAllPages: false,
      canAccessAllData: false,
      canAccessSuperadminRoutes: false,
      canAccessAdminRoutes: false,
      canAccessUploadRoutes: true,
      uploadRoutesOnly: true,
      usesAssignedPagePermissions: false,
      usesAssignedProjectAccess: false,
      usesAssignedVisibilityProfiles: false,
    });
  });

  it('returns effective page permissions in the session payload', async () => {
    usersService.findById.mockResolvedValueOnce({
      id: 'upload-1',
      email: 'upload@example.com',
      role: 'UPLOAD',
      sessionVersion: 3,
      organizationId: 'org-1',
      pagePermissions: [],
    });

    const session = await service.buildSession({
      id: 'upload-1',
      email: 'upload@example.com',
      role: 'UPLOAD',
      organizationId: 'org-1',
    });

    expect(session.user.pagePermissions).toEqual([
      'progress.view',
      'session.view',
      'uploads.view',
    ]);
    expect(session.permissions.pagePermissions).toEqual([
      'progress.view',
      'session.view',
      'uploads.view',
    ]);
  });
});
