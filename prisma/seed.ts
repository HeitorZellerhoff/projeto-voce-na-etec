import 'dotenv/config';
import { SectorStatus, UserStatus } from '../src/generated/prisma';
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Iniciando seed do banco de dados Neon...');

  // 1. Setores Iniciais
  const sectorsData = [
    { name: 'Farmácia Central', code: 'FARMACIA', status: SectorStatus.ATIVO },
    { name: 'Almoxarifado', code: 'ALMOXARIFADO', status: SectorStatus.ATIVO },
    { name: 'Departamento de Compras', code: 'COMPRAS', status: SectorStatus.ATIVO },
    { name: 'Administração Geral', code: 'ADMINISTRACAO', status: SectorStatus.ATIVO },
  ];

  const sectors = [];
  for (const s of sectorsData) {
    const sector = await prisma.sector.upsert({
      where: { code: s.code },
      update: {},
      create: s,
    });
    sectors.push(sector);
  }
  const admSector = sectors.find(s => s.code === 'ADMINISTRACAO')!;

  // 2. Permissões Granulares
  const permissionsData = [
    { action: 'DASHBOARD_VIEW', module: 'Geral', description: 'Visualizar Dashboard' },
    { action: 'STOCK_VIEW', module: 'Estoque', description: 'Visualizar Estoque' },
    { action: 'STOCK_MANAGE', module: 'Estoque', description: 'Gerenciar Estoque' },
    { action: 'PRODUCT_VIEW', module: 'Produtos', description: 'Visualizar Produtos' },
    { action: 'PRODUCT_MANAGE', module: 'Produtos', description: 'Gerenciar Produtos' },
    { action: 'PURCHASE_VIEW', module: 'Compras', description: 'Visualizar Compras' },
    { action: 'PURCHASE_MANAGE', module: 'Compras', description: 'Gerenciar Compras' },
    { action: 'USER_VIEW', module: 'Usuários', description: 'Visualizar Usuários' },
    { action: 'USER_MANAGE', module: 'Usuários', description: 'Gerenciar Usuários' },
    { action: 'AUDIT_VIEW', module: 'Auditoria', description: 'Visualizar Logs de Auditoria' },
  ];

  const permissions = [];
  for (const p of permissionsData) {
    const perm = await prisma.permission.upsert({
      where: { action: p.action },
      update: {},
      create: p,
    });
    permissions.push(perm);
  }

  // 3. Papéis (Roles)
  const rolesData = [
    { name: 'ADMINISTRADOR' },
    { name: 'FARMACEUTICO' },
    { name: 'ALMOXARIFE' },
    { name: 'COMPRADOR' },
    { name: 'SUPERVISOR' },
  ];

  const roles = [];
  for (const r of rolesData) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: r,
    });
    roles.push(role);
  }

  const adminRole = roles.find(r => r.name === 'ADMINISTRADOR')!;

  // Mapeamento de Permissões para Administrador (Full Access)
  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: perm.id
        }
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: perm.id
      }
    });
  }

  // 4. Usuário Administrador
  const passwordHash = await bcrypt.hash('SenhaSegura123!', 12);
  await prisma.user.upsert({
    where: { email: 'admin@hospital.com' },
    update: {},
    create: {
      name: 'Administrador do Sistema',
      email: 'admin@hospital.com',
      registration: 'ADM-001',
      passwordHash,
      status: UserStatus.ATIVO,
      mustChangePassword: true,
      sectorId: admSector.id,
      roleId: adminRole.id,
    },
  });

  console.log('Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro durante o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
