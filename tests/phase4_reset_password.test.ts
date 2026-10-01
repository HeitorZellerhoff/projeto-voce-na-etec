import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';

// Mock dependencies
vi.mock('@/lib/prisma', () => {
  const mockUser = {
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  const mockPasswordResetToken = {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const mockAuditLog = {
    create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
  };

  return {
    prisma: {
      user: mockUser,
      passwordResetToken: mockPasswordResetToken,
      auditLog: mockAuditLog,
      $transaction: vi.fn(async (cb: (tx: any) => any) => {
        return cb({
          user: mockUser,
          passwordResetToken: mockPasswordResetToken,
          auditLog: mockAuditLog,
        });
      }),
    },
  };
});

vi.mock('@/lib/auth/crypto', () => {
  return {
    hashPassword: vi.fn().mockImplementation(async (pw: string) => `hashed:${pw}`),
    verifyPassword: vi.fn().mockImplementation(async (plain: string, hash: string) => hash === `hashed:${plain}`),
  };
});

import { prisma } from '@/lib/prisma';
import { POST as forgotPasswordRoute } from '@/app/api/auth/forgot-password/route';
import { POST as resetPasswordRoute } from '@/app/api/auth/reset-password/route';
import { verifyPassword } from '@/lib/auth/crypto';

describe('DEM-018: Password Reset Complete Lifecycle Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Forgot Password Request & Token Generation', () => {
    it('creates SHA-256 hashed token with 1h expiration for active user and returns 202', async () => {
      const userUuid = crypto.randomUUID();
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userUuid,
        email: 'medico@hospital.com',
        sectorId: crypto.randomUUID(),
        status: 'ATIVO',
      } as any);

      vi.mocked(prisma.passwordResetToken.create).mockResolvedValue({
        id: 'token-id-1',
        tokenHash: 'some-hash',
        userId: userUuid,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      } as any);

      const req = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'medico@hospital.com' }),
      });

      const res = await forgotPasswordRoute(req);
      expect(res.status).toBe(202);
      const json = await res.json();
      expect(json.success).toBe(true);

      // Garante que tokens anteriores foram invalidados preventivamente
      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: userUuid,
          usedAt: null,
        },
        data: {
          usedAt: expect.any(Date),
        },
      });

      expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: userUuid,
            tokenHash: expect.any(String),
          }),
        })
      );

      // Verify that stored tokenHash is a 64-character SHA-256 hex string (not raw plaintext)
      const tokenHashArg = (prisma.passwordResetToken.create as any).mock.calls[0][0].data.tokenHash;
      expect(tokenHashArg).toMatch(/^[a-f0-9]{64}$/);
    });

    it('returns constant 202 even if user does not exist (anti-enumeration)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'inexistente@hospital.com' }),
      });

      const res = await forgotPasswordRoute(req);
      expect(res.status).toBe(202);
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(prisma.passwordResetToken.updateMany).not.toHaveBeenCalled();
    });

    it('returns constant 202 for blocked or inactive user without creating reset token', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'blocked-user',
        email: 'bloqueado@hospital.com',
        status: 'BLOQUEADO',
      } as any);

      const req = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'bloqueado@hospital.com' }),
      });

      const res = await forgotPasswordRoute(req);
      expect(res.status).toBe(202);
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid email format', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'formato-invalido' }),
      });

      const res = await forgotPasswordRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/e-mail inválido/i);
    });
  });

  describe('2. Reset Password Execution & Token Invalidation', () => {
    it('successfully resets password, invalidates token with usedAt, invalidates other tokens and logs audit', async () => {
      const rawToken = 'sample-plain-recovery-token-1234567890';
      const expectedTokenHash = createHash('sha256').update(rawToken).digest('hex');
      const userUuid = crypto.randomUUID();
      const sectorUuid = crypto.randomUUID();

      vi.mocked(prisma.passwordResetToken.findFirst).mockResolvedValue({
        id: 'reset-record-1',
        tokenHash: expectedTokenHash,
        userId: userUuid,
        expiresAt: new Date(Date.now() + 1800000), // Valid for 30 more minutes
        usedAt: null, // Not used yet
        user: {
          id: userUuid,
          email: 'medico@hospital.com',
          sectorId: sectorUuid,
          status: 'ATIVO',
        },
      } as any);

      let savedPasswordHash = '';
      vi.mocked(prisma.user.update).mockImplementation(async ({ data }: any) => {
        savedPasswordHash = data.passwordHash;
        return { id: userUuid, ...data };
      });

      const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: rawToken,
          newPassword: 'NewSecurePassword123!',
        }),
      });

      const res = await resetPasswordRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      // Verify token search queried by SHA-256 hash
      expect(prisma.passwordResetToken.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenHash: expectedTokenHash },
        })
      );

      // Verify user password updated with new hash
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userUuid },
          data: expect.objectContaining({
            passwordHash: 'hashed:NewSecurePassword123!',
            mustChangePassword: false,
          }),
        })
      );

      // Verify token was marked as usedAt (single-use enforcement)
      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reset-record-1' },
          data: expect.objectContaining({
            usedAt: expect.any(Date),
          }),
        })
      );

      // Verify other pending tokens for the user were also invalidated
      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: userUuid,
            usedAt: null,
          },
          data: expect.objectContaining({
            usedAt: expect.any(Date),
          }),
        })
      );

      // Verify audit log created
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'AUTH_PASSWORD_RESET_SUCCESS',
            entity: 'User',
            entityId: userUuid,
          }),
        })
      );

      // Verify user can now authenticate with the new password
      const canLoginWithNewPw = await verifyPassword('NewSecurePassword123!', savedPasswordHash);
      expect(canLoginWithNewPw).toBe(true);
      const cannotLoginWithOldPw = await verifyPassword('OldPassword123!', savedPasswordHash);
      expect(cannotLoginWithOldPw).toBe(false);
    });

    it('rejects reset if token was already used (replay attack prevention)', async () => {
      const rawToken = 'already-used-token-1234567890';
      const expectedTokenHash = createHash('sha256').update(rawToken).digest('hex');

      vi.mocked(prisma.passwordResetToken.findFirst).mockResolvedValue({
        id: 'reset-record-2',
        tokenHash: expectedTokenHash,
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 1800000),
        usedAt: new Date(Date.now() - 60000), // Already used 1 minute ago
        user: { id: 'user-1', status: 'ATIVO' },
      } as any);

      const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: rawToken,
          newPassword: 'NewSecurePassword123!',
        }),
      });

      const res = await resetPasswordRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/já foi utilizado/i);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects reset if token is expired', async () => {
      const rawToken = 'expired-token-1234567890';
      const expectedTokenHash = createHash('sha256').update(rawToken).digest('hex');

      vi.mocked(prisma.passwordResetToken.findFirst).mockResolvedValue({
        id: 'reset-record-3',
        tokenHash: expectedTokenHash,
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 10000), // Expired 10 seconds ago
        usedAt: null,
        user: { id: 'user-1', status: 'ATIVO' },
      } as any);

      const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: rawToken,
          newPassword: 'NewSecurePassword123!',
        }),
      });

      const res = await resetPasswordRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/expirou/i);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects reset if user is BLOQUEADO or INATIVO', async () => {
      const rawToken = 'token-para-bloqueado-12345';
      const expectedTokenHash = createHash('sha256').update(rawToken).digest('hex');

      vi.mocked(prisma.passwordResetToken.findFirst).mockResolvedValue({
        id: 'reset-record-blocked',
        tokenHash: expectedTokenHash,
        userId: 'user-blocked',
        expiresAt: new Date(Date.now() + 1800000),
        usedAt: null,
        user: { id: 'user-blocked', status: 'BLOQUEADO' },
      } as any);

      const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: rawToken,
          newPassword: 'NewSecurePassword123!',
        }),
      });

      const res = await resetPasswordRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/BLOQUEADO/i);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects reset if token does not exist or is invalid', async () => {
      vi.mocked(prisma.passwordResetToken.findFirst).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: 'invalid-non-existent-token-12345',
          newPassword: 'NewSecurePassword123!',
        }),
      });

      const res = await resetPasswordRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/inválido ou inexistente/i);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects reset if new password is too short (< 8 chars)', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: 'some-valid-length-token-12345',
          newPassword: '123',
        }),
      });

      const res = await resetPasswordRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/8 caracteres/i);
      expect(prisma.passwordResetToken.findFirst).not.toHaveBeenCalled();
    });
  });
});
