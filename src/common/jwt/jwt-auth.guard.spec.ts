jest.mock('@nestjs/passport', () => ({
  AuthGuard: () =>
    class {
      async canActivate() {
        return true;
      }
    },
}));

import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const createExecutionContext = (
    user: any = { id: 'user-1', role: 'USER' },
    path = '/me/session',
  ) => {
    const request = { user };
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          ...request,
          path,
          route: { path },
        }),
      }),
    } as any;
  };

  const createGuard = (options?: {
    requiredPagePermissions?: string[];
    user?: any;
    currentUser?: any;
    metadata?: Record<string, boolean>;
    path?: string;
  }) => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === 'isPublic') return false;
        if (key === 'pagePermissions') {
          return options?.requiredPagePermissions ?? undefined;
        }
        if (key === 'isSuperAdmin') return options?.metadata?.isSuperAdmin ?? false;
        if (key === 'isAdmin') return options?.metadata?.isAdmin ?? false;
        if (key === 'isUser') return options?.metadata?.isUser ?? false;
        if (key === 'isUpload') return options?.metadata?.isUpload ?? false;
        return false;
      }),
    } as unknown as Reflector;

    const usersService = {
      findById: jest.fn().mockResolvedValue(
        options?.currentUser ?? {
          id: 'user-1',
          role: 'USER',
          pagePermissions: [],
        },
      ),
      getEffectivePagePermissionsForUser: jest.fn((user) => {
        const base = ['progress.view', 'session.view'];
        const extras = user.role === 'UPLOAD' ? ['uploads.view'] : [];
        return [...new Set([...(user.pagePermissions ?? []), ...base, ...extras])].sort();
      }),
    };
    const moduleRef = {
      get: jest.fn().mockReturnValue(usersService),
    };

    const guard = new JwtAuthGuard(reflector, moduleRef as any);
    const context = createExecutionContext(options?.user, options?.path);

    return { guard, context, usersService, moduleRef };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows access when the user has the required implicit page permission', async () => {
    const { guard, context } = createGuard({
      requiredPagePermissions: ['progress.view'],
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('allows access when the user has wildcard page permission', async () => {
    const { guard, context } = createGuard({
      requiredPagePermissions: ['admin.dashboard'],
      currentUser: {
        id: 'user-1',
        role: 'USER',
        pagePermissions: ['*'],
      },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('allows access when the user has a configurable effective page permission', async () => {
    const { guard, context } = createGuard({
      requiredPagePermissions: ['dashboard.view'],
      currentUser: {
        id: 'user-1',
        role: 'USER',
        pagePermissions: ['dashboard.view'],
      },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects access when the required page permission is missing', async () => {
    const { guard, context } = createGuard({
      requiredPagePermissions: ['admin.dashboard'],
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('Page permission required'),
    );
  });

  it('allows admin access even without explicit page permissions', async () => {
    const { guard, context } = createGuard({
      requiredPagePermissions: ['system.mail'],
      currentUser: {
        id: 'user-1',
        role: 'ADMIN',
        pagePermissions: [],
        organizationId: 'org-1',
      },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects upload users outside upload routes', async () => {
    const { guard, context } = createGuard({
      user: { id: 'user-1', role: 'UPLOAD' },
      currentUser: {
        id: 'user-1',
        role: 'UPLOAD',
        pagePermissions: [],
        organizationId: 'org-1',
      },
      path: '/me/session',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('Upload users can only access upload routes'),
    );
  });

  it('allows upload users on upload routes', async () => {
    const { guard, context } = createGuard({
      user: { id: 'user-1', role: 'UPLOAD' },
      currentUser: {
        id: 'user-1',
        role: 'UPLOAD',
        pagePermissions: [],
        organizationId: 'org-1',
      },
      path: '/uploads/init',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('allows superadmin users on upload-only routes', () => {
    const { guard, context } = createGuard({
      user: { id: 'user-1', role: 'SUPERADMIN' },
      metadata: { isUpload: true },
    });

    expect(() =>
      guard.handleRequest(
        null,
        { id: 'user-1', role: 'SUPERADMIN' },
        null,
        context,
      ),
    ).not.toThrow();
  });

  it('rejects superadmin-only routes for non-superadmin users', () => {
    const { guard, context } = createGuard({
      user: { id: 'user-1', role: 'ADMIN' },
      metadata: { isSuperAdmin: true },
    });

    expect(() => guard.handleRequest(null, { id: 'user-1', role: 'ADMIN' }, null, context)).toThrow(
      new ForbiddenException('Superadmin access required'),
    );
  });

  it('only applies user-only restriction when the decorator is present', () => {
    const { guard, context } = createGuard({
      user: { id: 'user-1', role: 'ADMIN' },
    });

    expect(() =>
      guard.handleRequest(null, { id: 'user-1', role: 'ADMIN' }, null, context),
    ).not.toThrow();
  });

  it('only applies upload-only restriction when the decorator is present', () => {
    const { guard, context } = createGuard({
      user: { id: 'user-1', role: 'USER' },
    });

    expect(() =>
      guard.handleRequest(null, { id: 'user-1', role: 'USER' }, null, context),
    ).not.toThrow();
  });
});
