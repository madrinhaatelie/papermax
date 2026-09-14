/**
 * PAPER MAX - Initial Seed & Fallback Data
 * Establishes real initial catalog, categories, and smooth legacy order migration.
 */

export const SEED_CATEGORIES = [
  { id: 'cat_sacolas', name: 'Sacolas & Embalagens', description: 'Sacolas personalizadas, kraft e alças de cetim', createdAt: '2026-09-01T00:00:00Z' },
  { id: 'cat_festas', name: 'Papelaria de Festa', description: 'Caixas personalizadas, milk, pirâmide e kits decorativos', createdAt: '2026-09-01T00:00:00Z' },
  { id: 'cat_caixas', name: 'Caixas Cartonadas', description: 'Caixas rígidas e cartonagem fina para presentes', createdAt: '2026-09-01T00:00:00Z' },
  { id: 'cat_agendas', name: 'Agendas & Cadernos', description: 'Encadernação artesanal, planners e cadernos com wire-o', createdAt: '2026-09-01T00:00:00Z' },
  { id: 'cat_lembrancas', name: 'Lembrancinhas', description: 'Mimos corporativos e lembrancinhas de aniversário', createdAt: '2026-09-01T00:00:00Z' }
];

export const SEED_PRODUCTS = [
  {
    id: 'prod_sacola_m',
    name: 'Sacola M',
    categoryId: 'cat_sacolas',
    status: 'ativo',
    type: 'personalizado',
    description: 'Sacola M personalizada em papel kraft 180g com alça em fita de cetim ou nylon e reforço estruturado.',
    price: 8.50,
    cost: 3.20,
    productionTime: 2,
    configurationVersion: 1,
    personalizationFields: [
      { id: 'field_nome', name: 'Nome', type: 'text', required: true, defaultValue: '' },
      { id: 'field_idade', name: 'Idade', type: 'number', required: false, defaultValue: '' }
    ],
    changeOptions: [
      { id: 'opt_cor', name: 'Cor', type: 'choice', required: true, defaultValue: 'Rosa', choices: ['Rosa', 'Azul', 'Verde', 'Branco', 'Kraft'] },
      { id: 'opt_elemento', name: 'Elemento', type: 'choice', required: false, defaultValue: 'Flores', choices: ['Flores', 'Estrelas', 'Corações', 'Brasão'] },
      { id: 'opt_lateral', name: 'Lateral da sacola', type: 'choice', required: false, defaultValue: 'Direita', choices: ['Direita', 'Esquerda', 'Ambas'] },
      { id: 'opt_alca', name: 'Alça', type: 'choice', required: true, defaultValue: 'Cetim', choices: ['Cetim', 'Nylon'] }
    ],
    editor: {
      textAreas: [
        { id: 'area_txt_1', name: 'Área do Nome', label: 'Nome Central', page: 1, x: 120, y: 380, width: 350, height: 45, alignment: 'center', fontFamily: 'Cinzel', fontSize: 26, fontWeight: 'bold', color: '#332722', personalizationFieldId: 'field_nome' },
        { id: 'area_txt_2', name: 'Área da Idade', label: 'Idade Subtítulo', page: 1, x: 120, y: 435, width: 350, height: 30, alignment: 'center', fontFamily: 'Montserrat', fontSize: 16, fontWeight: 'normal', color: '#786559', personalizationFieldId: 'field_idade' }
      ],
      elementAreas: [
        { id: 'area_elem_1', name: 'Elemento Decorativo', page: 1, x: 230, y: 310, width: 130, height: 60, changeOptionId: 'opt_elemento' }
      ],
      colorAreas: [
        { id: 'area_col_1', name: 'Fundo da Sacola', page: 1, x: 110, y: 160, width: 375, height: 520, changeOptionId: 'opt_cor' }
      ]
    },
    basePdfMetadata: {
      id: 'base_sacola_m',
      name: 'Sacola M - Base.pdf',
      size: 14500,
      pageCount: 1,
      width: 595,
      height: 842
    },
    composition: [
      { id: 'comp_item_1', type: 'insumo', itemId: 'mat_papel_kraft_180', quantity: 1, unit: 'folha' },
      { id: 'comp_item_2', type: 'componente', itemId: 'comp_alca_cetim', quantity: 1, unit: 'par' },
      { id: 'comp_item_3', type: 'insumo', itemId: 'mat_cola_quente', quantity: 0.1, unit: 'bastao' }
    ],
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'prod_caixa_milk',
    name: 'Caixa Milk Luxo',
    categoryId: 'cat_festas',
    status: 'ativo',
    type: 'personalizado',
    description: 'Caixa milk decorativa em papel fotográfico fosco 230g com apliques em camadas e laço duplo.',
    price: 6.80,
    cost: 2.40,
    productionTime: 2,
    configurationVersion: 1,
    personalizationFields: [
      { id: 'field_nome', name: 'Nome da Criança', type: 'text', required: true, defaultValue: '' },
      { id: 'field_idade', name: 'Idade Comemorativa', type: 'number', required: true, defaultValue: '' }
    ],
    changeOptions: [
      { id: 'opt_laco', name: 'Cor do Laço de Cetim', type: 'choice', required: true, defaultValue: 'Dourado', choices: ['Dourado', 'Rosa Chá', 'Azul Bebê', 'Verde Oliva'] },
      { id: 'opt_aplique', name: 'Camadas do Aplique', type: 'choice', required: true, defaultValue: '3D Duplo', choices: ['3D Simples', '3D Duplo', 'Camadas em Shaker'] }
    ],
    editor: {
      textAreas: [
        { id: 'area_milk_nome', name: 'Nome Frontal', page: 1, x: 50, y: 120, width: 150, height: 35, alignment: 'center', fontFamily: 'Montserrat', fontSize: 18, color: '#4a3b32', personalizationFieldId: 'field_nome' }
      ],
      elementAreas: [],
      colorAreas: []
    },
    basePdfMetadata: {
      id: 'base_caixa_milk',
      name: 'gabarito_caixa_milk.pdf',
      size: 845200,
      pageCount: 1,
      width: 595,
      height: 842
    },
    composition: [
      { id: 'comp_item_4', type: 'insumo', itemId: 'mat_papel_foto_230', quantity: 1, unit: 'folha' },
      { id: 'comp_item_5', type: 'componente', itemId: 'comp_laco_dourado', quantity: 1, unit: 'un' },
      { id: 'comp_item_6', type: 'componente', itemId: 'comp_aplique_3d', quantity: 1, unit: 'un' }
    ],
    createdAt: '2026-09-02T00:00:00Z',
    updatedAt: '2026-09-02T00:00:00Z'
  },
  {
    id: 'prod_agenda_a5',
    name: 'Caderno A5 Wire-o Personalizado',
    categoryId: 'cat_agendas',
    status: 'ativo',
    type: 'personalizado',
    description: 'Capa dura laminada, miolo em papel pólen 90g com 160 páginas e elástico de fechamento.',
    price: 42.00,
    cost: 18.50,
    productionTime: 3,
    configurationVersion: 1,
    personalizationFields: [
      { id: 'field_nome', name: 'Nome na Capa', type: 'text', required: true, defaultValue: '' },
      { id: 'field_frase', name: 'Frase de Abertura / Mensagem', type: 'textarea', required: false, defaultValue: '' }
    ],
    changeOptions: [
      { id: 'opt_laminacao', name: 'Tipo de Laminação', type: 'choice', required: true, defaultValue: 'Fosca Aveludada', choices: ['Fosca Aveludada', 'Brilho Intenso', 'Holográfica Confete'] },
      { id: 'opt_wireo', name: 'Cor do Wire-o', type: 'choice', required: true, defaultValue: 'Bronze', choices: ['Bronze', 'Prata', 'Preto'] }
    ],
    editor: {
      textAreas: [
        { id: 'area_agenda_capa', name: 'Nome da Capa', page: 1, x: 40, y: 200, width: 300, height: 50, alignment: 'center', fontFamily: 'Playfair Display', fontSize: 26, color: '#1a1a1a', personalizationFieldId: 'field_nome' }
      ],
      elementAreas: [],
      colorAreas: []
    },
    basePdfMetadata: {
      id: 'base_agenda_a5',
      name: 'gabarito_agenda_a5.pdf',
      size: 1548000,
      pageCount: 2,
      width: 420,
      height: 595
    },
    composition: [
      { id: 'comp_item_7', type: 'insumo', itemId: 'mat_papelao_cinza', quantity: 0.2, unit: 'placa' },
      { id: 'comp_item_8', type: 'insumo', itemId: 'mat_bopp_fosco', quantity: 0.5, unit: 'm' },
      { id: 'comp_item_9', type: 'insumo', itemId: 'mat_wireo_bronze', quantity: 1, unit: 'tira' }
    ],
    createdAt: '2026-09-03T00:00:00Z',
    updatedAt: '2026-09-03T00:00:00Z'
  }
];

// ==========================================
// SEED SUPPLIERS (FORNECEDORES)
// ==========================================
export const SEED_SUPPLIERS = [
  {
    id: 'sup_casa_fita',
    name: 'Casa da Fita & Aviamentos',
    companyName: 'Casa da Fita Aviamentos EIRELI',
    contact: 'Fernanda Lima',
    phone: '(11) 98765-4321',
    email: 'vendas@casadafita.com.br',
    storeUrl: 'https://casadafita.exemplo.com.br',
    notes: 'Fornecedor principal de fitas de cetim, gorgurão e elásticos.',
    createdAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'sup_papeis_cia',
    name: 'Papéis & Cia Distribuidora',
    companyName: 'Papéis & Cia Papelaria Atacadista Ltda',
    contact: 'Carlos Eduardo',
    phone: '(11) 99887-1122',
    email: 'comercial@papeiscia.com.br',
    storeUrl: 'https://papeiscia.exemplo.com.br',
    notes: 'Papéis fotográficos, papéis offset, kraft 180g e papelão cinza.',
    createdAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'sup_arte_bambu',
    name: 'Arte & Bambu Embalagens',
    companyName: 'Arte & Bambu Distribuidora',
    contact: 'Rodrigo Alves',
    phone: '(11) 97711-2233',
    email: 'contato@artebambu.com.br',
    storeUrl: 'https://artebambu.exemplo.com.br',
    notes: 'Palitos para mimos, cola quente e adereços.',
    createdAt: '2026-09-01T00:00:00Z'
  }
];

// ==========================================
// SEED INSUMOS (MATERIAIS BRUTOS)
// ==========================================
export const SEED_MATERIALS = [
  {
    id: 'mat_papel_kraft_180',
    name: 'Papel Kraft 180g A4',
    baseUnit: 'folha',
    currentStock: 120,
    minStock: 40,
    purchasePackType: 'pacote',
    packQuantity: 50,
    purchaseUnit: 'folha',
    purchaseCost: 25.00,
    supplierId: 'sup_papeis_cia',
    supplierName: 'Papéis & Cia Distribuidora',
    notes: 'Usado para sacolas e caixas rústicas.',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'mat_papel_foto_230',
    name: 'Papel Fotográfico Fosco 230g A4',
    baseUnit: 'folha',
    currentStock: 80,
    minStock: 30,
    purchasePackType: 'pacote',
    packQuantity: 50,
    purchaseUnit: 'folha',
    purchaseCost: 35.00,
    supplierId: 'sup_papeis_cia',
    supplierName: 'Papéis & Cia Distribuidora',
    notes: 'Usado para caixa milk, topo de bolo e apliques.',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'mat_fita_cetim_rosa_22',
    name: 'Fita de Cetim Rosa 22mm',
    baseUnit: 'm',
    currentStock: 250,
    minStock: 60,
    purchasePackType: 'rolo',
    packQuantity: 100,
    purchaseUnit: 'm',
    purchaseCost: 25.00,
    supplierId: 'sup_casa_fita',
    supplierName: 'Casa da Fita & Aviamentos',
    notes: 'R$ 0,25/m = R$ 0,0025/cm. Usada para flores de cetim e alças.',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'mat_fita_cetim_dourada_15',
    name: 'Fita de Cetim Dourada 15mm',
    baseUnit: 'm',
    currentStock: 40,
    minStock: 20,
    purchasePackType: 'rolo',
    packQuantity: 50,
    purchaseUnit: 'm',
    purchaseCost: 18.00,
    supplierId: 'sup_casa_fita',
    supplierName: 'Casa da Fita & Aviamentos',
    notes: 'Usada para laços luxo e fechamentos.',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'mat_fita_verde_10',
    name: 'Fita Verde 10mm',
    baseUnit: 'm',
    currentStock: 35,
    minStock: 15,
    purchasePackType: 'rolo',
    packQuantity: 50,
    purchaseUnit: 'm',
    purchaseCost: 12.00,
    supplierId: 'sup_casa_fita',
    supplierName: 'Casa da Fita & Aviamentos',
    notes: 'Usada no acabamento do caule das flores.',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'mat_palito_bambu',
    name: 'Palito de Bambu 25cm',
    baseUnit: 'un',
    currentStock: 600,
    minStock: 150,
    purchasePackType: 'pacote',
    packQuantity: 500,
    purchaseUnit: 'un',
    purchaseCost: 40.00,
    supplierId: 'sup_arte_bambu',
    supplierName: 'Arte & Bambu Embalagens',
    notes: 'Haste para flores e topos.',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'mat_cola_quente',
    name: 'Bastão de Cola Quente Fina',
    baseUnit: 'bastao',
    currentStock: 18,
    minStock: 8,
    purchasePackType: 'pacote',
    packQuantity: 40,
    purchaseUnit: 'bastao',
    purchaseCost: 32.00,
    supplierId: 'sup_arte_bambu',
    supplierName: 'Arte & Bambu Embalagens',
    notes: 'Cola para montagem estrutural.',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'mat_papelao_cinza',
    name: 'Papelão Cinza Roller 2mm',
    baseUnit: 'placa',
    currentStock: 12,
    minStock: 5,
    purchasePackType: 'placa',
    packQuantity: 1,
    purchaseUnit: 'placa',
    purchaseCost: 12.00,
    supplierId: 'sup_papeis_cia',
    supplierName: 'Papéis & Cia Distribuidora',
    notes: 'Cartonagem para capas de agenda.',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'mat_wireo_bronze',
    name: 'Wire-o Bronze 5/8',
    baseUnit: 'tira',
    currentStock: 30,
    minStock: 10,
    purchasePackType: 'caixa',
    packQuantity: 50,
    purchaseUnit: 'tira',
    purchaseCost: 45.00,
    supplierId: 'sup_papeis_cia',
    supplierName: 'Papéis & Cia Distribuidora',
    notes: 'Garras de encadernação para 120 folhas.',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'mat_bopp_fosco',
    name: 'Película BOPP Fosca Aveludada',
    baseUnit: 'm',
    currentStock: 45,
    minStock: 15,
    purchasePackType: 'rolo',
    packQuantity: 100,
    purchaseUnit: 'm',
    purchaseCost: 65.00,
    supplierId: 'sup_papeis_cia',
    supplierName: 'Papéis & Cia Distribuidora',
    notes: 'Laminação a quente para capas.',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  }
];

// ==========================================
// SEED COMPONENTES (BOM / FICHA TÉCNICA)
// ==========================================
export const SEED_COMPONENTS = [
  {
    id: 'comp_flor_cetim_rosa',
    name: 'Flor de Cetim Rosa',
    yield: 1,
    currentStock: 45,
    minStock: 20,
    items: [
      { materialId: 'mat_fita_cetim_rosa_22', quantity: 720, unit: 'cm' }, // 7.2 m
      { materialId: 'mat_palito_bambu', quantity: 1, unit: 'un' },
      { materialId: 'mat_fita_verde_10', quantity: 10, unit: 'cm' } // 0.1 m
    ],
    notes: 'Flor artesanal feita à mão para sacolas e topos.',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'comp_flores_pitchula',
    name: 'Flores Pitchula',
    yield: 1,
    currentStock: 25,
    minStock: 10,
    items: [
      { materialId: 'mat_fita_cetim_rosa_22', quantity: 300, unit: 'cm' }, // 3 m
      { materialId: 'mat_palito_bambu', quantity: 1, unit: 'un' }
    ],
    notes: 'Flor compacta para caixas e lembrancinhas.',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'comp_laco_dourado',
    name: 'Laço Duplo de Cetim Dourado',
    yield: 1,
    currentStock: 50,
    minStock: 15,
    items: [
      { materialId: 'mat_fita_cetim_dourada_15', quantity: 40, unit: 'cm' }
    ],
    notes: 'Laço pronto com fita e nó centralizado.',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'comp_aplique_3d',
    name: 'Kit Aplique 3D em Camadas',
    yield: 1,
    currentStock: 30,
    minStock: 10,
    items: [
      { materialId: 'mat_papel_foto_230', quantity: 0.5, unit: 'folha' }
    ],
    notes: 'Camadas cortadas na plotter com fita banana.',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'comp_alca_cetim',
    name: 'Par de Alças em Fita de Cetim',
    yield: 1,
    currentStock: 40,
    minStock: 12,
    items: [
      { materialId: 'mat_fita_cetim_rosa_22', quantity: 60, unit: 'cm' }
    ],
    notes: 'Par de alças com pontas chanfradas e seladas.',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  }
];

// ==========================================
// SEED PURCHASES (COMPRAS)
// ==========================================
export const SEED_PURCHASES = [
  {
    id: 'pur_101',
    code: 'COM-101',
    supplierId: 'sup_casa_fita',
    supplierName: 'Casa da Fita & Aviamentos',
    date: '2026-09-04T10:00:00Z',
    status: 'recebida',
    items: [
      { materialId: 'mat_fita_cetim_rosa_22', materialType: 'insumo', name: 'Fita de Cetim Rosa 22mm', quantity: 200, unit: 'm', packCost: 25.00, packQuantity: 100, unitCost: 0.25, totalCost: 50.00 },
      { materialId: 'mat_fita_cetim_dourada_15', materialType: 'insumo', name: 'Fita de Cetim Dourada 15mm', quantity: 50, unit: 'm', packCost: 18.00, packQuantity: 50, unitCost: 0.36, totalCost: 18.00 }
    ],
    totalAmount: 68.00,
    notes: 'Pedido emergencial de fitas para produção de Setembro.',
    receivedAt: '2026-09-06T14:30:00Z',
    receivedBy: 'Almoxarife'
  },
  {
    id: 'pur_102',
    code: 'COM-102',
    supplierId: 'sup_papeis_cia',
    supplierName: 'Papéis & Cia Distribuidora',
    date: '2026-09-08T11:00:00Z',
    status: 'pedida',
    items: [
      { materialId: 'mat_papel_kraft_180', materialType: 'insumo', name: 'Papel Kraft 180g A4', quantity: 100, unit: 'folha', packCost: 25.00, packQuantity: 50, unitCost: 0.50, totalCost: 50.00 },
      { materialId: 'mat_papel_foto_230', materialType: 'insumo', name: 'Papel Fotográfico Fosco 230g A4', quantity: 50, unit: 'folha', packCost: 35.00, packQuantity: 50, unitCost: 0.70, totalCost: 35.00 }
    ],
    totalAmount: 85.00,
    notes: 'Reposição programada de papéis para linha de festas.'
  }
];

// ==========================================
// SEED MOVEMENTS (MOVIMENTAÇÕES)
// ==========================================
export const SEED_MOVEMENTS = [
  {
    id: 'mov_init_1',
    materialId: 'mat_papel_kraft_180',
    materialName: 'Papel Kraft 180g A4',
    materialType: 'insumo',
    type: 'entrada',
    reason: 'compra',
    quantity: 100,
    unit: 'folha',
    previousStock: 20,
    newStock: 120,
    origin: 'Compra #COM-099 · Papéis & Cia',
    operator: 'Almoxarife',
    notes: 'Entrada de lote inicial',
    createdAt: '2026-09-01T09:00:00Z'
  },
  {
    id: 'mov_init_2',
    materialId: 'mat_fita_cetim_rosa_22',
    materialName: 'Fita de Cetim Rosa 22mm',
    materialType: 'insumo',
    type: 'entrada',
    reason: 'compra',
    quantity: 200,
    unit: 'm',
    previousStock: 50,
    newStock: 250,
    origin: 'Compra #COM-101 · Casa da Fita',
    operator: 'Almoxarife',
    notes: 'Entrada de rolos para flores',
    createdAt: '2026-09-06T14:30:00Z'
  }
];

export function createSnapshotFromProduct(product) {
  if (!product) return null;
  return {
    productId: product.id,
    productName: product.name,
    name: product.name,
    configurationVersion: product.configurationVersion || 1,
    price: product.price || 0,
    cost: product.cost || 0,
    categoryId: product.categoryId || '',
    personalizationFields: JSON.parse(JSON.stringify(product.personalizationFields || [])),
    changeOptions: JSON.parse(JSON.stringify(product.changeOptions || [])),
    editor: JSON.parse(JSON.stringify(product.editor || { textAreas: [], elementAreas: [], colorAreas: [] })),
    basePdfMetadata: product.basePdfMetadata ? { ...product.basePdfMetadata } : null,
    composition: JSON.parse(JSON.stringify(product.composition || [])),
    snapshotTimestamp: new Date().toISOString()
  };
}

export const SEED_ORDERS = [
  {
    id: 1048,
    number: 1048,
    customer: 'Juliana Silva',
    productId: 'prod_sacola_m',
    productTitle: 'Sacola M',
    qty: 12,
    orderDate: '05/09/2026',
    deliveryDate: '09/09/2026',
    status: 'yellow',
    statusLabel: 'Aguardando aprovação',
    personalization: {
      field_nome: 'Maria',
      field_idade: '8'
    },
    changeOptions: {
      opt_cor: 'Rosa',
      opt_elemento: 'Flores',
      opt_lateral: 'Direita',
      opt_alca: 'Cetim'
    },
    notes: 'Aguardando confirmação de arte pelo cliente.',
    productSnapshot: createSnapshotFromProduct(SEED_PRODUCTS[0]),
    createdAt: '2026-09-05T10:30:00Z',
    updatedAt: '2026-09-05T10:30:00Z'
  },
  {
    id: 1049,
    number: 1049,
    customer: 'Ana Paula Ramos',
    productId: 'prod_caixa_milk',
    productTitle: 'Caixa Milk Luxo',
    qty: 30,
    orderDate: '07/09/2026',
    deliveryDate: '12/09/2026',
    status: 'blue',
    statusLabel: 'Em produção',
    personalization: {
      field_nome: 'Gabriel',
      field_idade: '5'
    },
    changeOptions: {
      opt_laco: 'Dourado',
      opt_aplique: '3D Duplo'
    },
    notes: 'Impressão concluída, em fase de corte e vinco na plotter.',
    productSnapshot: createSnapshotFromProduct(SEED_PRODUCTS[1]),
    createdAt: '2026-09-07T14:15:00Z',
    updatedAt: '2026-09-07T14:15:00Z'
  },
  {
    id: 1050,
    number: 1050,
    customer: 'Camila Duarte',
    productId: 'prod_sacola_m',
    productTitle: 'Sacola M Kraft',
    qty: 50,
    orderDate: '08/09/2026',
    deliveryDate: '11/09/2026',
    status: 'red',
    statusLabel: 'Bloqueado por material',
    personalization: {
      field_nome: 'Isabela',
      field_idade: '15 Anos',
      field_data: '2026-09-25'
    },
    changeOptions: {
      opt_cor: 'Rosa Pastel',
      opt_alca: 'Fita de Cetim',
      opt_acabamento: 'Brilho'
    },
    notes: 'Fita de cetim rosa em falta no estoque físico.',
    productSnapshot: createSnapshotFromProduct(SEED_PRODUCTS[0]),
    createdAt: '2026-09-08T09:00:00Z',
    updatedAt: '2026-09-08T09:00:00Z'
  },
  {
    id: 1051,
    number: 1051,
    customer: 'Mariana Costa',
    productId: 'prod_agenda_a5',
    productTitle: 'Caderno A5 Wire-o Personalizado',
    qty: 5,
    orderDate: '06/09/2026',
    deliveryDate: '09/09/2026',
    status: 'green',
    statusLabel: 'Pronto',
    personalization: {
      field_nome: 'Dra. Mariana Costa',
      field_frase: 'Planeje seus dias com propósito e delicadeza.'
    },
    changeOptions: {
      opt_laminacao: 'Fosca Aveludada',
      opt_wireo: 'Bronze'
    },
    notes: 'Embalado e pronto para envio/retirada.',
    productSnapshot: createSnapshotFromProduct(SEED_PRODUCTS[2]),
    createdAt: '2026-09-06T16:20:00Z',
    updatedAt: '2026-09-06T16:20:00Z'
  }
];

// ==========================================
// SEED FINANCIAL ENTITIES (ETAPA 6)
// ==========================================

export const SEED_EXPENSES = [
  {
    id: 'exp_101',
    description: 'Energia Elétrica Ateliê & Plotters',
    category: 'Operacional',
    amount: 145.80,
    date: '02/09/2026',
    dueDate: '10/09/2026',
    paidDate: '08/09/2026',
    status: 'pago',
    paymentMethod: 'Pix',
    notes: 'Conta de luz da oficina de corte e impressão.',
    createdAt: '2026-09-02T10:00:00Z'
  },
  {
    id: 'exp_102',
    description: 'Internet Fibra 300MB',
    category: 'Serviços',
    amount: 99.90,
    date: '03/09/2026',
    dueDate: '15/09/2026',
    paidDate: null,
    status: 'aberto',
    paymentMethod: 'Boleto',
    notes: 'Conexão para envio de arquivos de clientes.',
    createdAt: '2026-09-03T11:00:00Z'
  },
  {
    id: 'exp_103',
    description: 'Anúncios Instagram / Meta Ads',
    category: 'Marketing',
    amount: 60.00,
    date: '04/09/2026',
    dueDate: '04/09/2026',
    paidDate: '04/09/2026',
    status: 'pago',
    paymentMethod: 'Cartão',
    notes: 'Campanha de lembrancinhas de aniversário infantil.',
    createdAt: '2026-09-04T15:00:00Z'
  },
  {
    id: 'exp_104',
    description: 'Lâmina de reposição Silhouette Cameo 4',
    category: 'Equipamentos',
    amount: 85.00,
    date: '06/09/2026',
    dueDate: '20/09/2026',
    paidDate: null,
    status: 'aberto',
    paymentMethod: 'Pix',
    notes: 'Manutenção preventiva da máquina de corte.',
    createdAt: '2026-09-06T09:30:00Z'
  }
];

export const SEED_RECEIVABLES = [
  {
    id: 'rec_1048',
    orderId: 1048,
    saleId: 'sale_1048',
    customer: 'Juliana Silva',
    description: 'Pedido 1048 · 12x Sacola M',
    amount: 102.00, // 12 * 8.50
    dueDate: '09/09/2026',
    paidDate: null,
    status: 'aberto',
    paymentMethod: 'Pix',
    notes: '50% na aprovação e 50% na retirada.',
    createdAt: '2026-09-05T10:30:00Z'
  },
  {
    id: 'rec_1049',
    orderId: 1049,
    saleId: 'sale_1049',
    customer: 'Ana Paula Ramos',
    description: 'Pedido 1049 · 30x Caixa Milk Luxo',
    amount: 204.00, // 30 * 6.80
    dueDate: '12/09/2026',
    paidDate: '07/09/2026',
    status: 'recebido',
    paymentMethod: 'Pix',
    notes: 'Pagamento total antecipado via Pix.',
    createdAt: '2026-09-07T14:15:00Z'
  },
  {
    id: 'rec_1050',
    orderId: 1050,
    saleId: 'sale_1050',
    customer: 'Camila Duarte',
    description: 'Pedido 1050 · 50x Sacola M Kraft',
    amount: 425.00, // 50 * 8.50
    dueDate: '11/09/2026',
    paidDate: null,
    status: 'aberto',
    paymentMethod: 'Cartão de Crédito',
    notes: 'Aguardando aprovação de insumo.',
    createdAt: '2026-09-08T09:00:00Z'
  },
  {
    id: 'rec_1051',
    orderId: 1051,
    saleId: 'sale_1051',
    customer: 'Mariana Costa',
    description: 'Pedido 1051 · 5x Caderno A5 Wire-o Personalizado',
    amount: 210.00, // 5 * 42.00
    dueDate: '09/09/2026',
    paidDate: '06/09/2026',
    status: 'recebido',
    paymentMethod: 'Pix',
    notes: 'Pago no momento do pedido.',
    createdAt: '2026-09-06T16:20:00Z'
  }
];

export const SEED_PAYABLES = [
  {
    id: 'pay_pur_101',
    purchaseId: 'pur_101',
    supplierId: 'sup_casa_fita',
    supplierName: 'Casa da Fita & Aviamentos',
    description: 'Compra COM-101 · Fitas de Cetim',
    amount: 68.00,
    dueDate: '15/09/2026',
    paidDate: '06/09/2026',
    status: 'pago',
    paymentMethod: 'Pix',
    notes: 'Compra recebida em 06/09/2026.',
    createdAt: '2026-09-04T10:00:00Z'
  },
  {
    id: 'pay_pur_102',
    purchaseId: 'pur_102',
    supplierId: 'sup_papeis_cia',
    supplierName: 'Papéis & Cia Distribuidora',
    description: 'Compra COM-102 · Papéis Kraft e Fotográfico',
    amount: 85.00,
    dueDate: '18/09/2026',
    paidDate: null,
    status: 'aberto',
    paymentMethod: 'Boleto 14 dias',
    notes: 'Compra programada / pedida.',
    createdAt: '2026-09-08T11:00:00Z'
  }
];
