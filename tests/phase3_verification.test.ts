import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/prisma', () => {
  const mockStock = {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    upsert: vi.fn(),
  };
  const mockStockMovement = {
    create: vi.fn(),
  };
  const mockAuditLog = {
    create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
  };
  const mockSector = {
    findUnique: vi.fn(),
  };
  const mockProduct = {
    findUnique: vi.fn(),
  };
  const mockSectorCategory = {
    count: vi.fn(),
    findUnique: vi.fn(),
  };
  const mockPurchase = {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  };
  const mockUser = {
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  };
  const mockPasswordResetToken = {
    create: vi.fn(),
  };
  const mockRolePermission = {
    findFirst: vi.fn(),
  };

  return {
    prisma: {
      stock: mockStock,
      stockMovement: mockStockMovement,
      auditLog: mockAuditLog,
      sector: mockSector,
      product: mockProduct,
      sectorCategory: mockSectorCategory,
      purchase: mockPurchase,
      user: mockUser,
      passwordResetToken: mockPasswordResetToken,
      rolePermission: mockRolePermission,
      $transaction: vi.fn(async (cb: (tx: any) => any) => {
        return cb({
          stock: mockStock,
          stockMovement: mockStockMovement,
          auditLog: mockAuditLog,
          purchase: mockPurchase,
          user: mockUser,
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

vi.mock('@/lib/auth/crypto', () => {
  return {
    hashPassword: vi.fn().mockResolvedValue('hashed-new-password'),
    verifyPassword: vi.fn().mockResolvedValue(true),
  };
});

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { POST as transferRoute } from '@/app/api/inventory/transfer/route';
import { POST as entryRoute } from '@/app/api/inventory/entry/route';
import { POST as rejectPurchaseRoute } from '@/app/api/purchases/[id]/reject/route';
import { GET as getPurchasesRoute } from '@/app/api/purchases/route';
import { GET as getUsersRoute } from '@/app/api/admin/users/route';
import { POST as firstAccessRoute } from '@/app/api/auth/first-access/route';
import { POST as forgotPasswordRoute } from '@/app/api/auth/forgot-password/route';

describe('Phase 3 Business Rules & Feature Verification Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DEM-011: SectorCategory Compatibility Validation', () => {
    it('rejects transfer if product category is incompatible with destination sector', async () => {
      const userSub = crypto.randomUUID();
      const originSectorId = crypto.randomUUID();
      const destSectorId = crypto.randomUUID();
      const productId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();

      vi.mocked(getSession).mockResolvedValue({
        sub: userSub,
        roleId: crypto.randomUUID(),
        sectorId: originSectorId,
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userSub,
        status: 'ATIVO',
        roleId: 'role-admin',
      } as any);

      vi.mocked(prisma.rolePermission.findFirst).mockResolvedValue({ id: 'rp-1' } as any);

      vi.mocked(prisma.sector.findUnique).mockResolvedValue({
        id: destSectorId,
        name: 'Enfermaria Geral',
        status: 'ATIVO',
      } as any);

      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: productId,
        name: 'Morfina 10mg',
        categoryId: categoryId,
      } as any);

      // Destination sector has allowed categories, but NOT this category
      vi.mocked(prisma.sectorCategory.count).mockResolvedValue(3);
      vi.mocked(prisma.sectorCategory.findUnique).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/inventory/transfer', {
        method: 'POST',
        body: JSON.stringify({
          productId: productId,
          destinationSectorId: destSectorId,
          quantity: 5,
          reason: 'Reposicao',
        }),
      });

      const res = await transferRoute(req, {});
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/incompatibilidade|não permitida/i);
    });

    it('rejects entry if product category is incompatible with current sector', async () => {
      const userSub = crypto.randomUUID();
      const currentSectorId = crypto.randomUUID();
      const productId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();

      vi.mocked(getSession).mockResolvedValue({
        sub: userSub,
        roleId: crypto.randomUUID(),
        sectorId: currentSectorId,
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userSub,
        status: 'ATIVO',
        roleId: 'role-admin',
      } as any);

      vi.mocked(prisma.rolePermission.findFirst).mockResolvedValue({ id: 'rp-1' } as any);

      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: productId,
        name: 'Bisturi Elétrico',
        categoryId: categoryId,
      } as any);

      // Current sector has restrictions, category is not allowed
      vi.mocked(prisma.sectorCategory.count).mockResolvedValue(2);
      vi.mocked(prisma.sectorCategory.findUnique).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/inventory/entry', {
        method: 'POST',
        body: JSON.stringify({
          productId: productId,
          quantity: 10,
          reason: 'Doacao',
        }),
      });

      const res = await entryRoute(req, {});
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/incompatibilidade|não autorizada/i);
    });
  });

  describe('DEM-012: Purchase Order Rejection and Cancellation', () => {
    it('cancels purchase when requested by the creator and logs audit', async () => {
      vi.mocked(getSession).mockResolvedValue({
        sub: 'user-requester',
        roleId: 'role-farmacia',
        sectorId: 'sector-farmacia',
      });

      vi.mocked(prisma.purchase.findUnique).mockResolvedValue({
        id: 'purchase-1',
        status: 'PENDENTE_APROVACAO',
        requestedByUserId: 'user-requester',
        totalAmount: 1500,
        supplier: { name: 'Distribuidora Med' },
      } as any);

      vi.mocked(prisma.purchase.update).mockResolvedValue({
        id: 'purchase-1',
        status: 'CANCELADO',
      } as any);

      const req = new NextRequest('http://localhost:3000/api/purchases/purchase-1/reject', {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cancelado por erro de quantidade' }),
      });

      const params = Promise.resolve({ id: 'purchase-1' });
      const res = await rejectPurchaseRoute(req, { params });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.purchase.status).toBe('CANCELADO');

      expect(prisma.purchase.update).toHaveBeenCalledWith({
        where: { id: 'purchase-1' },
        data: { status: 'CANCELADO' },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PURCHASE_CANCEL',
            entity: 'Purchase',
            entityId: 'purchase-1',
          }),
        })
      );
    });

    it('rejects purchase when authorized user has PURCHASE_APPROVE permission', async () => {
      vi.mocked(getSession).mockResolvedValue({
        sub: 'user-approver',
        roleId: 'role-compras',
        sectorId: 'sector-compras',
      });

      vi.mocked(prisma.purchase.findUnique).mockResolvedValue({
        id: 'purchase-2',
        status: 'PENDENTE_APROVACAO',
        requestedByUserId: 'user-other',
        totalAmount: 5000,
        supplier: { name: 'Hospitalar SA' },
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-approver',
        role: {
          permissions: [{ permission: { action: 'PURCHASE_APPROVE' } }],
        },
      } as any);

      vi.mocked(prisma.purchase.update).mockResolvedValue({
        id: 'purchase-2',
        status: 'CANCELADO',
      } as any);

      const req = new NextRequest('http://localhost:3000/api/purchases/purchase-2/reject', {
        method: 'POST',
        body: JSON.stringify({ reason: 'Preço acima da média de mercado' }),
      });

      const params = Promise.resolve({ id: 'purchase-2' });
      const res = await rejectPurchaseRoute(req, { params });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.purchase.status).toBe('CANCELADO');

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PURCHASE_REJECT',
            entity: 'Purchase',
            entityId: 'purchase-2',
          }),
        })
      );
    });
  });

  describe('DEM-013: GET REST Endpoints for Purchases and Users', () => {
    it('lists purchases with pagination and relations', async () => {
      vi.mocked(getSession).mockResolvedValue({
        sub: 'user-1',
        roleId: 'role-admin',
        sectorId: 'sector-1',
      });

      vi.mocked(prisma.purchase.count).mockResolvedValue(1);
      vi.mocked(prisma.purchase.findMany).mockResolvedValue([
        {
          id: 'purchase-10',
          status: 'PENDENTE_APROVACAO',
          totalAmount: 2000,
          supplier: { name: 'Fornecedor A' },
          items: [{ quantity: 10, unitPrice: 200, product: { name: 'Soro Fisiologico' } }],
        },
      ] as any);

      const req = new NextRequest('http://localhost:3000/api/purchases?page=1&limit=10');
      const res = await getPurchasesRoute(req, {});

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.purchases).toHaveLength(1);
      expect(json.pagination.total).toBe(1);
    });

    it('lists users securely omitting passwordHash', async () => {
      vi.mocked(getSession).mockResolvedValue({
        sub: 'admin-1',
        roleId: 'role-admin',
        sectorId: 'sector-1',
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'admin-1',
        status: 'ATIVO',
        roleId: 'role-admin',
      } as any);

      vi.mocked(prisma.rolePermission.findFirst).mockResolvedValue({ id: 'rp-manage' } as any);

      vi.mocked(prisma.user.count).mockResolvedValue(1);
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: 'user-100',
          name: 'Dr. Silva',
          email: 'silva@hospital.com',
          status: 'ATIVO',
          sector: { name: 'UTI Adulto' },
          role: { name: 'MEDICO' },
        },
      ] as any);

      const req = new NextRequest('http://localhost:3000/api/admin/users?search=silva');
      const res = await getUsersRoute(req, {});

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.users).toHaveLength(1);
      expect(json.users[0].passwordHash).toBeUndefined();
    });
  });

  describe('DEM-008: Password Management & First Access', () => {
    it('updates password on first access and clears mustChangePassword', async () => {
      vi.mocked(getSession).mockResolvedValue({
        sub: 'user-new',
        roleId: 'role-enfermeiro',
        sectorId: 'sector-enfermaria',
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-new',
        email: 'new@hospital.com',
        sectorId: 'sector-enfermaria',
        mustChangePassword: true,
      } as any);

      vi.mocked(prisma.user.update).mockResolvedValue({
        id: 'user-new',
        mustChangePassword: false,
      } as any);

      const req = new NextRequest('http://localhost:3000/api/auth/first-access', {
        method: 'POST',
        body: JSON.stringify({ newPassword: 'SecurePassword123!' }),
      });

      const res = await firstAccessRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-new' },
          data: expect.objectContaining({
            mustChangePassword: false,
            passwordHash: 'hashed-new-password',
          }),
        })
      );
    });

    it('generates password reset token and returns constant 202', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-active',
        email: 'active@hospital.com',
        sectorId: 'sector-1',
        status: 'ATIVO',
      } as any);

      const req = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'active@hospital.com' }),
      });

      const res = await forgotPasswordRoute(req);
      expect(res.status).toBe(202);

      expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-active',
          }),
        })
      );
    });
  });
});
