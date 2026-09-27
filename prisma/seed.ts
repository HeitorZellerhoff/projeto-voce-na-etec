import 'dotenv/config';
import { SectorStatus, UserStatus, ProductStatus, SupplierStatus } from '../src/generated/prisma';
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Iniciando seed completo do banco de dados hospitalar...');

  // 1. Carga Inicial de Setores Hospitalares Estruturados
  const sectorsData = [
    // ASSISTÊNCIA
    { name: 'Pronto-Socorro', code: 'PRONTO_SOCORRO', description: 'Atendimento de emergência e urgência clínica/cirúrgica', status: SectorStatus.ATIVO },
    { name: 'Enfermaria Geral', code: 'ENFERMARIA', description: 'Internação geral de pacientes e cuidados de média complexidade', status: SectorStatus.ATIVO },
    { name: 'UTI Adulto', code: 'UTI_ADULTO', description: 'Unidade de Terapia Intensiva Adulto', status: SectorStatus.ATIVO },
    { name: 'UTI Pediátrica', code: 'UTI_PEDIATRICA', description: 'Unidade de Terapia Intensiva Pediátrica', status: SectorStatus.ATIVO },
    { name: 'UTI Neonatal', code: 'UTI_NEONATAL', description: 'Unidade de Terapia Intensiva Neonatal', status: SectorStatus.ATIVO },
    { name: 'Centro Cirúrgico', code: 'CENTRO_CIRURGICO', description: 'Salas de operações de alta e média complexidade', status: SectorStatus.ATIVO },
    { name: 'Centro Obstétrico', code: 'CENTRO_OBSTETRICO', description: 'Salas de parto e assistência obstétrica', status: SectorStatus.ATIVO },

    // DIAGNÓSTICO
    { name: 'Laboratório de Análises Clínicas', code: 'LABORATORIO', description: 'Exames laboratoriais e análises biológicas', status: SectorStatus.ATIVO },
    { name: 'Radiologia', code: 'RADIOLOGIA', description: 'Exames de raio-X diagnósticos', status: SectorStatus.ATIVO },
    { name: 'Ultrassonografia', code: 'ULTRASSONOGRAFIA', description: 'Exames ecográficos e ultrassom', status: SectorStatus.ATIVO },
    { name: 'Tomografia', code: 'TOMOGRAFIA', description: 'Tomografia computadorizada', status: SectorStatus.ATIVO },
    { name: 'Ressonância Magnética', code: 'RESSONANCIA', description: 'Ressonância magnética de alta resolução', status: SectorStatus.ATIVO },
    { name: 'Endoscopia', code: 'ENDOSCOPIA', description: 'Exames endoscópicos e colonoscopias', status: SectorStatus.ATIVO },

    // MEDICAMENTOS
    { name: 'Farmácia Central', code: 'FARMACIA', description: 'Farmácia Hospitalar Central e fracionamento', status: SectorStatus.ATIVO },
    { name: 'Farmácia Satélite', code: 'FARMACIA_SATELITE', description: 'Dispensação rápida nos blocos cirúrgicos e UTIs', status: SectorStatus.ATIVO },

    // MATERIAIS
    { name: 'Almoxarifado Geral', code: 'ALMOXARIFADO', description: 'Armazém geral de suprimentos, insumos e logística interna', status: SectorStatus.ATIVO },
    { name: 'Central de Material e Esterilização', code: 'CME', description: 'Esterilização e controle de kits cirúrgicos e instrumentais', status: SectorStatus.ATIVO },

    // ATENDIMENTO
    { name: 'Recepção Central', code: 'RECEPCAO', description: 'Triagem, acolhimento e admissão de pacientes', status: SectorStatus.ATIVO },
    { name: 'Ambulatório de Especialidades', code: 'AMBULATORIO', description: 'Consultas eletivas e retornos ambulatoriais', status: SectorStatus.ATIVO },
    { name: 'Internação', code: 'INTERNACAO', description: 'Regulação de leitos e internação hospitalar', status: SectorStatus.ATIVO },

    // APOIO ASSISTENCIAL
    { name: 'Nutrição e Dietética', code: 'NUTRICAO', description: 'Produção de dietas enterais, parenterais e refeições', status: SectorStatus.ATIVO },
    { name: 'Fisioterapia', code: 'FISIOTERAPIA', description: 'Reabilitação motora e respiratória', status: SectorStatus.ATIVO },
    { name: 'Serviço Social', code: 'SERVICO_SOCIAL', description: 'Assistência social a pacientes e acompanhantes', status: SectorStatus.ATIVO },

    // ADMINISTRAÇÃO
    { name: 'Administração Geral', code: 'ADMINISTRACAO', description: 'Diretoria executiva e governança institucional', status: SectorStatus.ATIVO },
    { name: 'Financeiro', code: 'FINANCEIRO', description: 'Faturamento, contas a pagar e receber', status: SectorStatus.ATIVO },
    { name: 'Departamento de Compras', code: 'COMPRAS', description: 'Aquisições, cotações e gestão de fornecedores', status: SectorStatus.ATIVO },
    { name: 'Recursos Humanos', code: 'RH', description: 'Gestão de pessoas e departamento pessoal', status: SectorStatus.ATIVO },

    // GESTÃO
    { name: 'Controle de Estoque', code: 'CONTROLE_ESTOQUE', description: 'Auditoria de inventário e reposições críticas', status: SectorStatus.ATIVO },
    { name: 'Gestão de Suprimentos', code: 'GESTAO_SUPRIMENTOS', description: 'Planejamento e cadeia de suprimentos', status: SectorStatus.ATIVO },

    // APOIO OPERACIONAL
    { name: 'Higienização e Limpeza', code: 'HIGIENIZACAO', description: 'Controle de infecção ambiental e desinfecção', status: SectorStatus.ATIVO },
    { name: 'Lavanderia Hospitalar', code: 'LAVANDERIA', description: 'Processamento e higienização de enxoval hospitalar', status: SectorStatus.ATIVO },
    { name: 'Manutenção e Engenharia Clínica', code: 'MANUTENCAO', description: 'Manutenção predial e calibração de equipamentos biomédicos', status: SectorStatus.ATIVO },
    { name: 'Segurança Patrimonial', code: 'SEGURANCA', description: 'Portaria, vigilância e controle de acessos', status: SectorStatus.ATIVO },

    // ESPECIALIDADES
    { name: 'Banco de Sangue / Hemoterapia', code: 'HEMOTERAPIA', description: 'Transfusões e fracionamento de hemocomponentes', status: SectorStatus.ATIVO },
    { name: 'Oncologia', code: 'ONCOLOGIA', description: 'Quimioterapia e assistência oncológica', status: SectorStatus.ATIVO },
    { name: 'Hemodiálise', code: 'HEMODIALISE', description: 'Diálise renal e tratamento nefrológico', status: SectorStatus.ATIVO },
    { name: 'Anatomia Patológica', code: 'ANATOMIA_PATOLOGICA', description: 'Biópsias e análises anatomopatológicas', status: SectorStatus.ATIVO },
  ];

  const sectorMap = new Map<string, any>();
  for (const s of sectorsData) {
    const sector = await prisma.sector.upsert({
      where: { code: s.code },
      update: { name: s.name, description: s.description, status: s.status },
      create: s,
    });
    sectorMap.set(s.code, sector);
  }

  const farmSector = sectorMap.get('FARMACIA')!;
  const almoxSector = sectorMap.get('ALMOXARIFADO')!;
  const compSector = sectorMap.get('COMPRAS')!;
  const admSector = sectorMap.get('ADMINISTRACAO')!;
  const enfSector = sectorMap.get('ENFERMARIA')!;
  const ccSector = sectorMap.get('CENTRO_CIRURGICO')!;

  // 2. Classificação de Categorias de Itens
  const categoriesData = [
    { name: 'Medicamento', code: 'MEDICAMENTOS', description: 'Fármacos controlados, antibióticos, anestésicos e soluções parenterais' },
    { name: 'Material Médico', code: 'MATERIAIS_MEDICOS', description: 'Cateteres, seringas, agulhas, curativos e descartáveis clínicos' },
    { name: 'Material Cirúrgico', code: 'MATERIAIS_CIRURGICOS', description: 'Fios de sutura, lâminas de bisturi, drenos e campos estéreis' },
    { name: 'Material Hospitalar Geral', code: 'MATERIAIS_HOSPITALARES', description: 'Insumos de apoio hospitalar, fraldas, gases e algodão' },
    { name: 'Utensílio', code: 'UTENSILIOS', description: 'Cubas rim, comadres, papagaios, bandejas inox e recipientes' },
    { name: 'Equipamento', code: 'EQUIPAMENTOS', description: 'Bombas de infusão, monitores multiparâmetros, oxímetros' },
    { name: 'Material de Limpeza', code: 'MATERIAIS_LIMPEZA', description: 'Desinfetantes hospitalares, hipoclorito e saneantes' },
    { name: 'Material Administrativo', code: 'MATERIAIS_ADMINISTRATIVOS', description: 'Papel A4, prontuários físicos, canetas e formulários' },
    { name: 'Material de Higiene', code: 'MATERIAIS_HIGIENE', description: 'Papel toalha, papel higiênico, sabonete líquido hospitalar' },
    { name: 'Material de Manutenção', code: 'MATERIAIS_MANUTENCAO', description: 'Peças de reposição, ferramentas e conectores' },
    { name: 'EPI', code: 'EPI', description: 'Luvas estéreis/procedimento, máscaras N95, aventais impermeáveis' },
    { name: 'Outros', code: 'OUTROS', description: 'Materiais especiais e diversos' },
  ];

  const categoryMap = new Map<string, any>();
  for (const c of categoriesData) {
    const cat = await prisma.category.upsert({
      where: { code: c.code },
      update: { name: c.name, description: c.description },
      create: c,
    });
    categoryMap.set(c.code, cat);
  }

  // 3. Regras de Compatibilidade Setorial Configuráveis (SectorCategory)
  const sectorCompatibility: Record<string, string[]> = {
    FARMACIA: ['MEDICAMENTOS', 'MATERIAIS_MEDICOS', 'MATERIAIS_CIRURGICOS', 'EPI'],
    ALMOXARIFADO: categoriesData.map(c => c.code), // Almoxarifado central armazena todas as categorias
    ENFERMARIA: ['MEDICAMENTOS', 'MATERIAIS_MEDICOS', 'MATERIAIS_HOSPITALARES', 'UTENSILIOS', 'MATERIAIS_HIGIENE', 'EPI'],
    CENTRO_CIRURGICO: ['MATERIAIS_CIRURGICOS', 'MATERIAIS_MEDICOS', 'MEDICAMENTOS', 'EQUIPAMENTOS', 'EPI'],
    UTI_ADULTO: ['MEDICAMENTOS', 'MATERIAIS_MEDICOS', 'MATERIAIS_CIRURGICOS', 'EQUIPAMENTOS', 'EPI'],
  };

  for (const [sectorCode, catCodes] of Object.entries(sectorCompatibility)) {
    const sector = sectorMap.get(sectorCode);
    if (!sector) continue;
    for (const catCode of catCodes) {
      const cat = categoryMap.get(catCode);
      if (!cat) continue;
      await prisma.sectorCategory.upsert({
        where: {
          sectorId_categoryId: {
            sectorId: sector.id,
            categoryId: cat.id,
          }
        },
        update: {},
        create: {
          sectorId: sector.id,
          categoryId: cat.id,
        }
      });
    }
  }

  // 4. Permissões Granulares
  const permissionsData = [
    { action: 'DASHBOARD_VIEW', module: 'Geral', description: 'Visualizar Dashboard' },
    { action: 'STOCK_VIEW', module: 'Estoque', description: 'Visualizar Estoque' },
    { action: 'STOCK_MANAGE', module: 'Estoque', description: 'Gerenciar Estoque' },
    { action: 'STOCK_ADJUST', module: 'Estoque', description: 'Ajustar Saldos de Estoque' },
    { action: 'REQUEST_VIEW', module: 'Solicitações', description: 'Visualizar Solicitações de Materiais' },
    { action: 'REQUEST_CREATE', module: 'Solicitações', description: 'Criar Solicitações de Materiais entre Setores' },
    { action: 'REQUEST_ATTEND', module: 'Solicitações', description: 'Atender/Aprovar Solicitações de Materiais' },
    { action: 'PRODUCT_VIEW', module: 'Produtos', description: 'Visualizar Produtos' },
    { action: 'PRODUCT_MANAGE', module: 'Produtos', description: 'Gerenciar Produtos' },
    { action: 'PURCHASE_VIEW', module: 'Compras', description: 'Visualizar Compras' },
    { action: 'PURCHASE_MANAGE', module: 'Compras', description: 'Gerenciar Compras' },
    { action: 'PURCHASE_APPROVE', module: 'Compras', description: 'Aprovar Pedidos de Compra' },
    { action: 'USER_VIEW', module: 'Usuários', description: 'Visualizar Usuários' },
    { action: 'USER_MANAGE', module: 'Usuários', description: 'Gerenciar Usuários' },
    { action: 'SECTOR_MANAGE', module: 'Setores', description: 'Gerenciar e Configurar Setores' },
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

  // 5. Papéis (Roles)
  const rolesData = [
    { name: 'ADMINISTRADOR', description: 'Acesso irrestrito a governança, IAM e todos os módulos' },
    { name: 'FARMACEUTICO', description: 'Gestão de medicamentos, lotes, dispensação e estoques da farmácia' },
    { name: 'ALMOXARIFE', description: 'Gestão de cargas, transferências e armazém geral' },
    { name: 'ENFERMEIRO', description: 'Gestão assistencial de enfermagem, estoque setorial e requisições' },
    { name: 'MEDICO_CIRURGIAO', description: 'Operações cirúrgicas e solicitações de materiais cirúrgicos' },
    { name: 'COMPRADOR', description: 'Gestão de fornecedores, cotações e ordens de compra' },
    { name: 'SUPERVISOR', description: 'Supervisão técnica operacional e aprovações setoriais' },
  ];

  const roleMap = new Map<string, any>();
  for (const r of rolesData) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: r,
    });
    roleMap.set(r.name, role);
  }

  const rolePermissionsMap: Record<string, string[]> = {
    ADMINISTRADOR: permissions.map(p => p.action),
    FARMACEUTICO: ['DASHBOARD_VIEW', 'STOCK_VIEW', 'STOCK_MANAGE', 'STOCK_ADJUST', 'REQUEST_VIEW', 'REQUEST_CREATE', 'REQUEST_ATTEND', 'PRODUCT_VIEW', 'PURCHASE_VIEW', 'AUDIT_VIEW'],
    ALMOXARIFE: ['DASHBOARD_VIEW', 'STOCK_VIEW', 'STOCK_MANAGE', 'STOCK_ADJUST', 'REQUEST_VIEW', 'REQUEST_CREATE', 'REQUEST_ATTEND', 'PRODUCT_VIEW', 'PRODUCT_MANAGE', 'PURCHASE_VIEW', 'AUDIT_VIEW'],
    ENFERMEIRO: ['DASHBOARD_VIEW', 'STOCK_VIEW', 'STOCK_MANAGE', 'REQUEST_VIEW', 'REQUEST_CREATE', 'PRODUCT_VIEW'],
    MEDICO_CIRURGIAO: ['DASHBOARD_VIEW', 'STOCK_VIEW', 'REQUEST_VIEW', 'REQUEST_CREATE', 'PRODUCT_VIEW'],
    COMPRADOR: ['DASHBOARD_VIEW', 'PURCHASE_VIEW', 'PURCHASE_MANAGE', 'PRODUCT_VIEW', 'AUDIT_VIEW'],
    SUPERVISOR: ['DASHBOARD_VIEW', 'STOCK_VIEW', 'STOCK_MANAGE', 'REQUEST_VIEW', 'REQUEST_CREATE', 'REQUEST_ATTEND', 'PURCHASE_VIEW', 'PURCHASE_APPROVE', 'AUDIT_VIEW'],
  };

  for (const [roleName, actions] of Object.entries(rolePermissionsMap)) {
    const role = roleMap.get(roleName);
    if (!role) continue;
    for (const action of actions) {
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

  // 6. Usuários Iniciais Vinculados a Seus Respectivos Setores
  const defaultPasswordHash = await bcrypt.hash('SenhaSegura123!', 12);

  const initialUsers = [
    {
      name: 'Administrador do Sistema',
      email: 'admin@hospital.com',
      registration: 'ADM-001',
      sectorId: admSector.id,
      roleId: roleMap.get('ADMINISTRADOR')!.id,
    },
    {
      name: 'Dra. Camila Farmacêutica',
      email: 'farmacia@hospital.com',
      registration: 'FAR-001',
      sectorId: farmSector.id,
      roleId: roleMap.get('FARMACEUTICO')!.id,
    },
    {
      name: 'Sr. Roberto Almoxarife',
      email: 'almoxarife@hospital.com',
      registration: 'ALM-001',
      sectorId: almoxSector.id,
      roleId: roleMap.get('ALMOXARIFE')!.id,
    },
    {
      name: 'Enf. Juliana Enfermaria',
      email: 'enfermaria@hospital.com',
      registration: 'ENF-001',
      sectorId: enfSector.id,
      roleId: roleMap.get('ENFERMEIRO')!.id,
    },
    {
      name: 'Dr. Lucas Cirurgião',
      email: 'cirurgico@hospital.com',
      registration: 'CIR-001',
      sectorId: ccSector.id,
      roleId: roleMap.get('MEDICO_CIRURGIAO')!.id,
    },
    {
      name: 'Marcos Comprador',
      email: 'compras@hospital.com',
      registration: 'COM-001',
      sectorId: compSector.id,
      roleId: roleMap.get('COMPRADOR')!.id,
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
        mustChangePassword: false,
      }
    });
  }

  // 7. Catálogo de Produtos Hospitalares
  const productsData = [
    {
      code: 'MED-001',
      name: 'Dipirona Sódica 500mg/ml (Ampola 2ml)',
      description: 'Analgésico e antipirético de uso hospitalar',
      categoryId: categoryMap.get('MEDICAMENTOS')!.id,
      unit: 'Ampola',
      minimumStock: 100,
      maximumStock: 2000,
      status: ProductStatus.ATIVO
    },
    {
      code: 'MED-002',
      name: 'Amoxicilina + Clavulanato 500/125mg',
      description: 'Antibiótico de amplo espectro',
      categoryId: categoryMap.get('MEDICAMENTOS')!.id,
      unit: 'Caixa',
      minimumStock: 50,
      maximumStock: 500,
      status: ProductStatus.ATIVO
    },
    {
      code: 'MED-003',
      name: 'Cloreto de Sódio 0,9% Solução Fisiológica 500ml',
      description: 'Solução injetável isotônica intravenosa',
      categoryId: categoryMap.get('MEDICAMENTOS')!.id,
      unit: 'Bolsa',
      minimumStock: 80,
      maximumStock: 1500,
      status: ProductStatus.ATIVO
    },
    {
      code: 'MAT-001',
      name: 'Seringa Descartável 10ml sem Agulha (Luer Lock)',
      description: 'Seringa estéril de uso único',
      categoryId: categoryMap.get('MATERIAIS_MEDICOS')!.id,
      unit: 'Unidade',
      minimumStock: 300,
      maximumStock: 5000,
      status: ProductStatus.ATIVO
    },
    {
      code: 'MAT-002',
      name: 'Cateter Intravenoso Periférico 20G',
      description: 'Dispositivo intravenoso radiopaco',
      categoryId: categoryMap.get('MATERIAIS_MEDICOS')!.id,
      unit: 'Unidade',
      minimumStock: 100,
      maximumStock: 1000,
      status: ProductStatus.ATIVO
    },
    {
      code: 'CIR-001',
      name: 'Fio de Sutura Nylon 3-0 com Agulha 24mm',
      description: 'Fio monofilamentar não absorvível estéril',
      categoryId: categoryMap.get('MATERIAIS_CIRURGICOS')!.id,
      unit: 'Caixa',
      minimumStock: 40,
      maximumStock: 400,
      status: ProductStatus.ATIVO
    },
    {
      code: 'EPI-001',
      name: 'Luva de Procedimento Látex (Tamanho M)',
      description: 'Caixa com 100 luvas não estéreis',
      categoryId: categoryMap.get('EPI')!.id,
      unit: 'Caixa',
      minimumStock: 40,
      maximumStock: 600,
      status: ProductStatus.ATIVO
    },
    {
      code: 'HIG-001',
      name: 'Papel Toalha Hospitalar Interfolhado',
      description: 'Fardo de papel toalha 100% celulose virgem',
      categoryId: categoryMap.get('MATERIAIS_HIGIENE')!.id,
      unit: 'Fardo',
      minimumStock: 50,
      maximumStock: 500,
      status: ProductStatus.ATIVO
    }
  ];

  const productMap = new Map<string, any>();
  for (const p of productsData) {
    const prod = await prisma.product.upsert({
      where: { code: p.code },
      update: { name: p.name, minimumStock: p.minimumStock, maximumStock: p.maximumStock, categoryId: p.categoryId },
      create: p,
    });
    productMap.set(p.code, prod);
  }

  // 8. Fornecedores Homologados
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

  // 9. Lotes Ativos
  const batchMap = new Map<string, any>();
  for (const prod of productMap.values()) {
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
    batchMap.set(prod.code, batch);
  }

  // 10. ESTOQUES ISOLADOS POR SETOR (Regra Fundamental: Setor + Item = Estoque Único)
  // Demonstrando que o mesmo item possui estoques e quantidades 100% independentes em cada setor:
  const stockSeedDefinitions = [
    // DIPIRONA (MED-001)
    { productCode: 'MED-001', sectorCode: 'FARMACIA', quantity: 500, min: 100, max: 1000 },
    { productCode: 'MED-001', sectorCode: 'ALMOXARIFADO', quantity: 1500, min: 200, max: 3000 },
    { productCode: 'MED-001', sectorCode: 'ENFERMARIA', quantity: 30, min: 20, max: 100 },
    { productCode: 'MED-001', sectorCode: 'CENTRO_CIRURGICO', quantity: 50, min: 15, max: 80 },

    // SERINGA 10ML (MAT-001)
    { productCode: 'MAT-001', sectorCode: 'ALMOXARIFADO', quantity: 2000, min: 500, max: 5000 },
    { productCode: 'MAT-001', sectorCode: 'FARMACIA', quantity: 400, min: 100, max: 800 },
    { productCode: 'MAT-001', sectorCode: 'ENFERMARIA', quantity: 80, min: 50, max: 200 },
    { productCode: 'MAT-001', sectorCode: 'CENTRO_CIRURGICO', quantity: 250, min: 100, max: 500 },

    // CLORETO DE SÓDIO 0,9% (MED-003)
    { productCode: 'MED-003', sectorCode: 'ALMOXARIFADO', quantity: 800, min: 200, max: 2000 },
    { productCode: 'MED-003', sectorCode: 'FARMACIA', quantity: 250, min: 60, max: 600 },
    { productCode: 'MED-003', sectorCode: 'ENFERMARIA', quantity: 45, min: 25, max: 100 },
    { productCode: 'MED-003', sectorCode: 'CENTRO_CIRURGICO', quantity: 60, min: 20, max: 120 },

    // FIO DE SUTURA (CIR-001)
    { productCode: 'CIR-001', sectorCode: 'ALMOXARIFADO', quantity: 300, min: 50, max: 500 },
    { productCode: 'CIR-001', sectorCode: 'FARMACIA', quantity: 40, min: 10, max: 100 },
    { productCode: 'CIR-001', sectorCode: 'CENTRO_CIRURGICO', quantity: 85, min: 30, max: 150 },

    // LUVAS DE PROCEDIMENTO (EPI-001)
    { productCode: 'EPI-001', sectorCode: 'ALMOXARIFADO', quantity: 600, min: 100, max: 1000 },
    { productCode: 'EPI-001', sectorCode: 'FARMACIA', quantity: 50, min: 20, max: 100 },
    { productCode: 'EPI-001', sectorCode: 'ENFERMARIA', quantity: 100, min: 30, max: 150 },
    { productCode: 'EPI-001', sectorCode: 'CENTRO_CIRURGICO', quantity: 150, min: 50, max: 300 },

    // PAPEL TOALHA (HIG-001)
    { productCode: 'HIG-001', sectorCode: 'ALMOXARIFADO', quantity: 500, min: 100, max: 1000 },
    { productCode: 'HIG-001', sectorCode: 'ENFERMARIA', quantity: 40, min: 10, max: 60 },
  ];

  for (const s of stockSeedDefinitions) {
    const prod = productMap.get(s.productCode);
    const sector = sectorMap.get(s.sectorCode);
    const batch = batchMap.get(s.productCode);

    if (prod && sector) {
      await prisma.stock.upsert({
        where: {
          productId_sectorId_batchId: {
            productId: prod.id,
            sectorId: sector.id,
            batchId: batch?.id || null,
          }
        },
        update: {
          quantity: s.quantity,
          minimumQuantity: s.min,
          maximumQuantity: s.max,
        },
        create: {
          productId: prod.id,
          sectorId: sector.id,
          batchId: batch?.id || null,
          quantity: s.quantity,
          minimumQuantity: s.min,
          maximumQuantity: s.max,
        }
      });
    }
  }

  console.log('Seed completo executado com sucesso: Setores hospitalares, categorias, papéis, permissões e estoques independentes gerados!');
}

main()
  .catch((e) => {
    console.error('Erro durante o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
