import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/security/guards';
import { hashPassword } from '@/lib/auth/crypto';
import { UserStatus } from '@/generated/prisma';

const createUserSchema = z.object({
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('E-mail corporativo inválido'),
  registration: z.string().min(3, 'A matrícula deve ter pelo menos 3 caracteres'),
  password: z.string().min(8, 'A senha provisória deve ter no mínimo 8 caracteres'),
  sectorId: z.string().uuid('Setor inválido'),
  roleId: z.string().uuid('Cargo/Perfil inválido'),
});

export const POST = withPermission('USER_MANAGE', async (request, context, session) => {
  try {
    const body = await request.json();
    const result = createUserSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: (result.error as any).errors[0].message }, { status: 400 });
    }

    const { name, email, registration, password, sectorId, roleId } = result.data;

    // Verificar unicidade de e-mail e matrícula
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { registration: registration.toUpperCase() }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.email.toLowerCase() === email.toLowerCase()) {
        return NextResponse.json({ error: 'Já existe um colaborador cadastrado com este e-mail' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Já existe um colaborador com esta matrícula' }, { status: 400 });
    }

    // Validar existência do setor e role
    const [sectorExists, roleExists] = await Promise.all([
      prisma.sector.findUnique({ where: { id: sectorId } }),
      prisma.role.findUnique({ where: { id: roleId } })
    ]);

    if (!sectorExists) {
      return NextResponse.json({ error: 'Setor informado não existe' }, { status: 400 });
    }
    if (!roleExists) {
      return NextResponse.json({ error: 'Cargo informado não existe' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          registration: registration.toUpperCase(),
          passwordHash,
          status: UserStatus.ATIVO,
          mustChangePassword: true,
          sectorId,
          roleId,
        },
        include: {
          sector: true,
          role: true,
        }
      });

      await tx.auditLog.create({
        data: {
          userId: session.sub,
          sectorId: session.sectorId,
          action: 'USER_CREATE',
          entity: 'User',
          entityId: user.id,
          metadata: {
            createdUserName: user.name,
            createdUserEmail: user.email,
            createdUserRegistration: user.registration,
            assignedSector: sectorExists.name,
            assignedRole: roleExists.name,
          }
        }
      });

      return user;
    });

    return NextResponse.json({ success: true, user: newUser }, { status: 201 });

  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Erro interno ao criar colaborador' }, { status: 500 });
  }
});
