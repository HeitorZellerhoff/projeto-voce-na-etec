import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies before importing routes/guards
vi.mock('@/lib/prisma', () => {
  const mockUser = {
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  const mockAuditLog = {
    create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
  };
  const mockRolePermission = {
    findFirst: vi.fn(),
  };
  return {
    prisma: {
      user: mockUser,
      auditLog: mockAuditLog,
      rolePermission: mockRolePermission,
      $transaction: vi.fn(async (cb: (tx: any) => any) => {
        return cb({
          user: mockUser,
          auditLog: mockAuditLog,
        });
      }),
    },
  };
});

vi.mock('@/lib/auth/session', () => {
  return {
    getSession: vi.fn(),
    destroySession: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@/lib/auth/jwt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/jwt')>();
  return {
    ...actual,
    verifyToken: vi.fn(),
  };
});

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { withPermission } from '@/lib/security/guards';
import { POST as blockRoute } from '@/app/api/admin/users/[id]/block/route';
import { POST as logoutPostRoute, GET as logoutGetRoute } from '@/app/api/auth/logout/route';

describe('Phase 2 Security & IAM Hardening Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DEM-004 & DEM-006: Real-time User Status Validation in withPermission', () => {
    it('rejects access if user is BLOCKED even if JWT is valid', async () => {
      vi.mocked(getSession).mockResolvedValue({
        sub: 'user-1',
        roleId: 'role-admin',
        sectorId: 'sector-1',
      });

      // DB returns user as BLOQUEADO
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        status: 'BLOQUEADO',
        roleId: 'role-admin',
        sectorId: 'sector-1',
      } as any);

      const protectedHandler = withPermission('inventory:view', async () => {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      });

      const req = new NextRequest('http://localhost:3000/api/inventory');
      const res = await protectedHandler(req, {});

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/bloqueada/i);
    });

    it('rejects access if user is INATIVO', async () => {
      vi.mocked(getSession).mockResolvedValue({
        sub: 'user-2',
        roleId: 'role-farmacia',
        sectorId: 'sector-1',
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-2',
        status: 'INATIVO',
        roleId: 'role-farmacia',
        sectorId: 'sector-1',
      } as any);

      const protectedHandler = withPermission('inventory:view', async () => {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      });

      const req = new NextRequest('http://localhost:3000/api/inventory');
      const res = await protectedHandler(req, {});

      expect(res.status).toBe(403);
    });

    it('allows access if user is ATIVO and has required permission', async () => {
      vi.mocked(getSession).mockResolvedValue({
        sub: 'user-3',
        roleId: 'role-admin',
        sectorId: 'sector-1',
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-3',
        status: 'ATIVO',
        roleId: 'role-admin',
        sectorId: 'sector-1',
      } as any);

      vi.mocked(prisma.rolePermission.findFirst).mockResolvedValue({
        id: 'rp-1',
        roleId: 'role-admin',
        permissionId: 'perm-1',
      } as any);

      const protectedHandler = withPermission('inventory:view', async () => {
        return new Response(JSON.stringify({ ok: true, data: 'inventory_data' }), { status: 200 });
      });

      const req = new NextRequest('http://localhost:3000/api/inventory');
      const res = await protectedHandler(req, {});

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBe('inventory_data');
    });
  });

  describe('DEM-010: Admin User Block / Unblock API', () => {
    it('blocks an active user and creates audit log USER_BLOCK', async () => {
      vi.mocked(getSession).mockResolvedValue({
        sub: 'admin-1',
        roleId: 'role-admin',
        sectorId: 'sector-admin',
      });

      // Handle user lookups: first for guard validation (admin-1), then for target user
      vi.mocked(prisma.user.findUnique).mockImplementation((async ({ where }: any) => {
        if (where.id === 'admin-1') {
          return { id: 'admin-1', status: 'ATIVO', roleId: 'role-admin', sectorId: 'sector-admin' };
        }
        if (where.id === 'target-user') {
          return {
            id: 'target-user',
            name: 'Target User',
            email: 'target@test.com',
            status: 'ATIVO',
            roleId: 'role-enfermeiro',
          };
        }
        return null;
      }) as any);

      vi.mocked(prisma.rolePermission.findFirst).mockResolvedValue({
        id: 'rp-admin',
        roleId: 'role-admin',
        permissionId: 'perm-manage',
      } as any);

      vi.mocked(prisma.user.update).mockResolvedValue({
        id: 'target-user',
        status: 'BLOQUEADO',
      } as any);

      const req = new NextRequest('http://localhost:3000/api/admin/users/target-user/block', {
        method: 'POST',
        body: JSON.stringify({ action: 'BLOCK', reason: 'Security violation' }),
      });

      const params = Promise.resolve({ id: 'target-user' });
      const res = await blockRoute(req, { params });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.status).toBe('BLOQUEADO');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'target-user' },
        data: { status: 'BLOQUEADO' },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'USER_BLOCK',
            entity: 'User',
            entityId: 'target-user',
          }),
        })
      );
    });

    it('unblocks a blocked user and creates audit log USER_UNBLOCK', async () => {
      vi.mocked(getSession).mockResolvedValue({
        sub: 'admin-1',
        roleId: 'role-admin',
        sectorId: 'sector-admin',
      });

      vi.mocked(prisma.user.findUnique).mockImplementation((async ({ where }: any) => {
        if (where.id === 'admin-1') {
          return { id: 'admin-1', status: 'ATIVO', roleId: 'role-admin', sectorId: 'sector-admin' };
        }
        if (where.id === 'target-user') {
          return {
            id: 'target-user',
            name: 'Target User',
            email: 'target@test.com',
            status: 'BLOQUEADO',
            roleId: 'role-enfermeiro',
          };
        }
        return null;
      }) as any);

      vi.mocked(prisma.rolePermission.findFirst).mockResolvedValue({
        id: 'rp-admin',
        roleId: 'role-admin',
        permissionId: 'perm-manage',
      } as any);

      vi.mocked(prisma.user.update).mockResolvedValue({
        id: 'target-user',
        status: 'ATIVO',
      } as any);

      const req = new NextRequest('http://localhost:3000/api/admin/users/target-user/block', {
        method: 'POST',
        body: JSON.stringify({ action: 'UNBLOCK', reason: 'Resolved' }),
      });

      const params = Promise.resolve({ id: 'target-user' });
      const res = await blockRoute(req, { params });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.status).toBe('ATIVO');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'target-user' },
        data: { status: 'ATIVO' },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'USER_UNBLOCK',
            entity: 'User',
            entityId: 'target-user',
          }),
        })
      );
    });
  });

  describe('DEM-014: Logout Audit Logging', () => {
    it('logs AUTH_LOGOUT on POST logout when session exists', async () => {
      vi.mocked(getSession).mockResolvedValue({
        sub: 'user-logged-in',
        userId: 'user-logged-in',
        roleId: 'role-medico',
        sectorId: 'sector-emergency',
      });

      const req = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
      });

      const res = await logoutPostRoute(req);
      expect(res.status).toBe(200);

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-logged-in',
            action: 'AUTH_LOGOUT',
            entity: 'USER',
            entityId: 'user-logged-in',
          }),
        })
      );
    });

    it('logs AUTH_LOGOUT on GET logout and redirects to login', async () => {
      vi.mocked(getSession).mockResolvedValue({
        sub: 'user-logged-in',
        userId: 'user-logged-in',
        roleId: 'role-medico',
        sectorId: 'sector-emergency',
      });

      const req = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'GET',
      });

      const res = await logoutGetRoute(req);
      expect(res.status).toBe(303);

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-logged-in',
            action: 'AUTH_LOGOUT',
            entity: 'USER',
            entityId: 'user-logged-in',
          }),
        })
      );
    });
  });
});

