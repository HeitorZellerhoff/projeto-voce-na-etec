import 'dotenv/config';
import { SectorStatus, UserStatus, ProductStatus, SupplierStatus } from '../src/generated/prisma';
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Iniciando seed completo do banco de dados Neon...');

  // 1. Setores Iniciais
  const sectorsData = [
    { name: 'Farmácia Central', code: 'FARMACIA', status: SectorStatus.ATIVO },
    { name: 'Almoxarifado Geral', code: 'ALMOXARIFADO', status: SectorStatus.ATIVO },
    { name: 'Departamento de Compras', code: 'COMPRAS', status: SectorStatus.ATIVO },
    { name: 'Administração Geral', code: 'ADMINISTRACAO', status: SectorStatus.ATIVO },
  ];

  const sectors = [];
  for (const s of sectorsData) {
    const sector = await prisma.sector.upsert({
      where: { code: s.code },
      update: { name: s.name },
      create: s,
    });
    sectors.push(sector);
  }
  const farmSector = sectors.find(s => s.code === 'FARMACIA')!;
  const almoxSector = sectors.find(s => s.code === 'ALMOXARIFADO')!;
  const compSector = sectors.find(s => s.code === 'COMPRAS')!;
  const admSector = sectors.find(s => s.code === 'ADMINISTRACAO')!;

  // 2. Permissões Granulares
  const permissionsData = [
    { action: 'DASHBOARD_VIEW', module: 'Geral', description: 'Visualizar Dashboard' },
    { action: 'STOCK_VIEW', module: 'Estoque', description: 'Visualizar Estoque' },
    { action: 'STOCK_MANAGE', module: 'Estoque', description: 'Gerenciar Estoque' },
    { action: 'STOCK_ADJUST', module: 'Estoque', description: 'Ajustar Saldos de Estoque' },
    { action: 'PRODUCT_VIEW', module: 'Produtos', description: 'Visualizar Produtos' },
    { action: 'PRODUCT_MANAGE', module: 'Produtos', description: 'Gerenciar Produtos' },
    { action: 'PURCHASE_VIEW', module: 'Compras', description: 'Visualizar Compras' },
    { action: 'PURCHASE_MANAGE', module: 'Compras', description: 'Gerenciar Compras' },
    { action: 'PURCHASE_APPROVE', module: 'Compras', description: 'Aprovar Pedidos de Compra' },
    { action: 'USER_VIEW', module: 'Usuários', description: 'Visualizar Usuários' },
    { action: 'USER_MANAGE', module: 'Usuários', description: 'Gerenciar Usuários' },
    { action: 'AUDIT_VIEW', module: 'Auditoria', description: 'Visualizar Logs de Auditoria' },
  ];

  const permissions = [];
  for (const p of permissionsData) {
    const perm = await prisma.permission.upsert({
      where: { action: p.action },
      update: { description: p.description, module: p.module },
      create: p,
    });
    permissions.push(perm);
  }

  // 3. Papéis (Roles)
  const rolesData = [
    { name: 'ADMINISTRADOR', description: 'Acesso irrestrito a governança, IAM e todos os módulos' },
    { name: 'FARMACEUTICO', description: 'Gestão de medicamentos, lotes, dispensação e estoques da farmácia' },
    { name: 'ALMOXARIFE', description: 'Gestão de cargas, transferências e armazém geral' },
    { name: 'COMPRADOR', description: 'Gestão de fornecedores, cotações e ordens de compra' },
    { name: 'SUPERVISOR', description: 'Supervisão técnica operacional e aprovações setoriais' },
  ];

  const roles = [];
  for (const r of rolesData) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: r,
    });
    roles.push(role);
  }

  const adminRole = roles.find(r => r.name === 'ADMINISTRADOR')!;
  const farmRole = roles.find(r => r.name === 'FARMACEUTICO')!;
  const almoxRole = roles.find(r => r.name === 'ALMOXARIFE')!;
  const compRole = roles.find(r => r.name === 'COMPRADOR')!;
  const supRole = roles.find(r => r.name === 'SUPERVISOR')!;

  // Mapeamento RBAC Completo
  const rolePermissionsMap: Record<string, string[]> = {
    ADMINISTRADOR: permissions.map(p => p.action), // Full access
    FARMACEUTICO: ['DASHBOARD_VIEW', 'STOCK_VIEW', 'STOCK_MANAGE', 'STOCK_ADJUST', 'PRODUCT_VIEW', 'PURCHASE_VIEW', 'AUDIT_VIEW'],
    ALMOXARIFE: ['DASHBOARD_VIEW', 'STOCK_VIEW', 'STOCK_MANAGE', 'STOCK_ADJUST', 'PRODUCT_VIEW', 'PRODUCT_MANAGE', 'PURCHASE_VIEW', 'AUDIT_VIEW'],
    COMPRADOR: ['DASHBOARD_VIEW', 'PURCHASE_VIEW', 'PURCHASE_MANAGE', 'PRODUCT_VIEW', 'AUDIT_VIEW'],
    SUPERVISOR: ['DASHBOARD_VIEW', 'STOCK_VIEW', 'STOCK_MANAGE', 'PURCHASE_VIEW', 'PURCHASE_APPROVE', 'AUDIT_VIEW'],
  };

  for (const role of roles) {
    const allowedActions = rolePermissionsMap[role.name] || ['DASHBOARD_VIEW'];
    for (const action of allowedActions) {
      const perm = permissions.find(p => p.action === action);
      if (perm) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: perm.id
            }
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: perm.id
          }
        });
      }
    }
  }

  // 4. Usuários Iniciais
  const defaultPasswordHash = await bcrypt.hash('SenhaSegura123!', 12);

  const initialUsers = [
    {
      name: 'Administrador do Sistema',
      email: 'admin@hospital.com',
      registration: 'ADM-001',
      sectorId: admSector.id,
      roleId: adminRole.id,
    },
    {
      name: 'Dra. Camila Farmacêutica',
      email: 'farmacia@hospital.com',
      registration: 'FAR-001',
      sectorId: farmSector.id,
      roleId: farmRole.id,
    },
    {
      name: 'Sr. Roberto Almoxarife',
      email: 'almoxarife@hospital.com',
      registration: 'ALM-001',
      sectorId: almoxSector.id,
      roleId: almoxRole.id,
    },
    {
      name: 'Marcos Comprador',
      email: 'compras@hospital.com',
      registration: 'COM-001',
      sectorId: compSector.id,
      roleId: compRole.id,
    }
  ];

  for (const u of initialUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { sectorId: u.sectorId, roleId: u.roleId },
      create: {
        ...u,
        passwordHash: defaultPasswordHash,
        status: UserStatus.ATIVO,
        mustChangePassword: false, // Permitir login direto para contas de teste
      }
    });
  }

  // 5. Categorias de Produtos
  const categoriesData = [
    { name: 'Medicamentos & Soluções', code: 'MEDICAMENTOS', description: 'Fármacos controlados, antibióticos e soluções parenterais' },
    { name: 'Materiais Hospitalares', code: 'MATERIAIS', description: 'Insumos de enfermagem, curativos e descartáveis' },
    { name: 'Equipamentos de Proteção (EPI)', code: 'EPI', description: 'Luvas cirúrgicas, máscaras N95 e aventais descartáveis' },
  ];

  const categories = [];
  for (const c of categoriesData) {
    const cat = await prisma.category.upsert({
      where: { code: c.code },
      update: { name: c.name },
      create: c,
    });
    categories.push(cat);
  }
  const catMeds = categories.find(c => c.code === 'MEDICAMENTOS')!;
  const catMat = categories.find(c => c.code === 'MATERIAIS')!;
  const catEpi = categories.find(c => c.code === 'EPI')!;

  // 6. Produtos Hospitalares
  const productsData = [
    {
      code: 'MED-001',
      name: 'Dipirona Sódica 500mg/ml (Ampola 2ml)',
      description: 'Analgésico e antipirético de uso hospitalar',
      categoryId: catMeds.id,
      unit: 'Ampola',
      minimumStock: 100,
      maximumStock: 2000,
      status: ProductStatus.ATIVO
    },
    {
      code: 'MED-002',
      name: 'Amoxicilina + Clavulanato 500/125mg',
      description: 'Antibiótico de amplo espectro',
      categoryId: catMeds.id,
      unit: 'Caixa',
      minimumStock: 50,
      maximumStock: 500,
      status: ProductStatus.ATIVO
    },
    {
      code: 'MED-003',
      name: 'Cloreto de Sódio 0,9% Solução Fisiológica 500ml',
      description: 'Solução injetável isotônica intravenosa',
      categoryId: catMeds.id,
      unit: 'Bolsa',
      minimumStock: 80,
      maximumStock: 1500,
      status: ProductStatus.ATIVO
    },
    {
      code: 'MAT-001',
      name: 'Seringa Descartável 10ml sem Agulha (Luer Lock)',
      description: 'Seringa estéril de uso único',
      categoryId: catMat.id,
      unit: 'Unidade',
      minimumStock: 300,
      maximumStock: 5000,
      status: ProductStatus.ATIVO
    },
    {
      code: 'MAT-002',
      name: 'Cateter Intravenoso Periférico 20G',
      description: 'Dispositivo intravenoso radiopaco',
      categoryId: catMat.id,
      unit: 'Unidade',
      minimumStock: 100,
      maximumStock: 1000,
      status: ProductStatus.ATIVO
    },
    {
      code: 'EPI-001',
      name: 'Luva de Procedimento Látex (Tamanho M)',
      description: 'Caixa com 100 luvas não estéreis',
      categoryId: catEpi.id,
      unit: 'Caixa',
      minimumStock: 40,
      maximumStock: 600,
      status: ProductStatus.ATIVO
    }
  ];

  const products = [];
  for (const p of productsData) {
    const prod = await prisma.product.upsert({
      where: { code: p.code },
      update: { name: p.name, minimumStock: p.minimumStock, maximumStock: p.maximumStock },
      create: p,
    });
    products.push(prod);
  }

  // 7. Fornecedores Homologados
  const suppliersData = [
    {
      name: 'MedSupply Distribuidora Hospitalar Ltda',
      cnpj: '12.345.678/0001-90',
      email: 'contato@medsupply.com.br',
      phone: '(11) 3456-7890',
      status: SupplierStatus.ATIVO
    },
    {
      name: 'FarmaLog Logística Farmacêutica S.A.',
      cnpj: '98.765.432/0001-10',
      email: 'comercial@farmalog.com.br',
      phone: '(11) 4002-8922',
      status: SupplierStatus.ATIVO
    }
  ];

  for (const s of suppliersData) {
    await prisma.supplier.upsert({
      where: { cnpj: s.cnpj },
      update: { name: s.name, email: s.email, phone: s.phone },
      create: s,
    });
  }

  // 8. Lotes e Estoque Inicial
  for (const prod of products) {
    // Criar lote válido de 12 meses
    const batchNumber = `L-2026-${prod.code.replace('-', '')}`;
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + 14);

    let batch = await prisma.productBatch.findFirst({
      where: { productId: prod.id, batchNumber }
    });

    if (!batch) {
      batch = await prisma.productBatch.create({
        data: {
          productId: prod.id,
          batchNumber,
          expirationDate,
          manufacturer: 'Laboratório Farmacêutico Nacional',
        }
      });
    }

    // Farmácia
    await prisma.stock.upsert({
      where: {
        productId_sectorId_batchId: {
          productId: prod.id,
          sectorId: farmSector.id,
          batchId: batch.id
        }
      },
      update: { quantity: Math.floor(prod.minimumStock * 1.8) },
      create: {
        productId: prod.id,
        sectorId: farmSector.id,
        batchId: batch.id,
        quantity: Math.floor(prod.minimumStock * 1.8),
      }
    });

    // Almoxarifado
    await prisma.stock.upsert({
      where: {
        productId_sectorId_batchId: {
          productId: prod.id,
          sectorId: almoxSector.id,
          batchId: batch.id
        }
      },
      update: { quantity: Math.floor(prod.minimumStock * 3.5) },
      create: {
        productId: prod.id,
        sectorId: almoxSector.id,
        batchId: batch.id,
        quantity: Math.floor(prod.minimumStock * 3.5),
      }
    });
  }

  console.log('Seed completo executado com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro durante o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
