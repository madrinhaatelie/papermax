import { 
  Order, 
  Product, 
  MaterialItem, 
  StockMovement, 
  ProductionJob, 
  FinancialTransaction, 
  AtelierSettings 
} from '../types';

const STORAGE_KEYS = {
  ORDERS: 'papermax_orders',
  PRODUCTS: 'papermax_products',
  MATERIALS: 'papermax_materials',
  MOVEMENTS: 'papermax_stock_movements',
  PRODUCTION: 'papermax_production_jobs',
  TRANSACTIONS: 'papermax_transactions',
  SETTINGS: 'papermax_settings',
};

export const DEFAULT_SETTINGS: AtelierSettings = {
  name: 'PAPER MAX • Ateliê Criativo',
  slogan: 'Papelaria Personalizada, Cartonagem & Festas dos Sonhos',
  document: '42.189.330/0001-92',
  phone: '(11) 98765-4321',
  email: 'contato@papermaxatelie.com.br',
  address: 'Rua das Flores, 450 - São Paulo, SP',
  pixKey: 'pix@papermaxatelie.com.br',
  instagram: '@papermax.atelie',
  logoUrl: '',
  hourlyLaborRate: 35.00, // R$ 35/h
  defaultMarkup: 2.6,
  daysForArt: 3,
  daysForProduction: 7,
  termsAndConditions: 'O prazo de produção inicia após a aprovação formal da arte digital e pagamento do sinal (mínimo 50%). Cores podem sofrer pequenas variações de acordo com cada monitor ou lote de papel.',
};

export const INITIAL_MATERIALS: MaterialItem[] = [
  {
    id: 'mat_1',
    code: 'PAP-OFF180',
    name: 'Papel Offset 180g A4 (Pct 500fls)',
    category: 'papeis_especiais',
    unit: 'fl',
    currentStock: 340,
    minStock: 100,
    unitCost: 0.18,
    supplier: 'Chamex / Papeis Brasil',
    location: 'Gaveta A1',
    lastRestocked: '2026-09-10'
  },
  {
    id: 'mat_2',
    code: 'PAP-FOT180',
    name: 'Papel Fotográfico Glossy 180g A4',
    category: 'papeis_fotograficos',
    unit: 'fl',
    currentStock: 85,
    minStock: 50,
    unitCost: 0.52,
    supplier: 'Masterprint',
    location: 'Gaveta A2',
    lastRestocked: '2026-09-12'
  },
  {
    id: 'mat_3',
    code: 'PAP-LAM-DOU',
    name: 'Papel Lamicote Dourado 250g A4',
    category: 'papeis_especiais',
    unit: 'fl',
    currentStock: 24,
    minStock: 30, // Alerta de baixo estoque
    unitCost: 1.85,
    supplier: 'Tex Papéis',
    location: 'Gaveta A3',
    lastRestocked: '2026-08-28'
  },
  {
    id: 'mat_4',
    code: 'PAP-COLOR180',
    name: 'Papel Color Plus 180g Cores Variadas A4',
    category: 'papeis_especiais',
    unit: 'fl',
    currentStock: 160,
    minStock: 80,
    unitCost: 0.45,
    supplier: 'Fedrigoni',
    location: 'Gaveta B1',
    lastRestocked: '2026-09-01'
  },
  {
    id: 'mat_5',
    code: 'BOPP-HOLO',
    name: 'Filme BOPP Holográfico Caquinhos (Rolo 30cm x 100m)',
    category: 'laminacao_bopp',
    unit: 'm',
    currentStock: 68,
    minStock: 20,
    unitCost: 1.20,
    supplier: 'Marpax',
    location: 'Prateleira 1',
    lastRestocked: '2026-08-15'
  },
  {
    id: 'mat_6',
    code: 'FITA-BANANA',
    name: 'Fita Banana Dupla Face Espuma 3D (Rolo 5m)',
    category: 'colas_adesivos',
    unit: 'rl',
    currentStock: 8,
    minStock: 4,
    unitCost: 8.50,
    supplier: 'Adere / 3M',
    location: 'Gaveteiro C',
    lastRestocked: '2026-09-05'
  },
  {
    id: 'mat_7',
    code: 'FITA-CETIM-N3',
    name: 'Fita de Cetim nº 3 (15mm) Cores Diversas',
    category: 'fitas_aviamentos',
    unit: 'm',
    currentStock: 95,
    minStock: 30,
    unitCost: 0.35,
    supplier: 'Progresso',
    location: 'Cesto 2',
    lastRestocked: '2026-09-02'
  },
  {
    id: 'mat_8',
    code: 'PED-CHATON',
    name: 'Chatons / Strass / Meia Pérola 10mm (Pct 100un)',
    category: 'pedrarias_shakers',
    unit: 'un',
    currentStock: 320,
    minStock: 100,
    unitCost: 0.15,
    supplier: 'Armarinhos Fernando',
    location: 'Gaveta D',
    lastRestocked: '2026-09-18'
  },
  {
    id: 'mat_9',
    code: 'WIRE-O-58',
    name: 'Garra Wire-o 5/8" Branco (Passo 2x1)',
    category: 'ferragens_encadernacao',
    unit: 'un',
    currentStock: 42,
    minStock: 20,
    unitCost: 2.10,
    supplier: 'Lassane',
    location: 'Prateleira 3',
    lastRestocked: '2026-08-20'
  },
  {
    id: 'mat_10',
    code: 'PAP-PAR-19',
    name: 'Papelão Paraná / Cinza 1.9mm (Placa 80x100cm)',
    category: 'papeis_especiais',
    unit: 'un',
    currentStock: 18,
    minStock: 10,
    unitCost: 6.90,
    supplier: 'Hörlle Formatos',
    location: 'Apoio Chão',
    lastRestocked: '2026-09-15'
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod_1',
    sku: 'TB-LUXO-01',
    name: 'Topo de Bolo Luxo Shaker Camadas 3D',
    category: 'topos_de_bolo',
    description: 'Topo de bolo sofisticado em camadas de papel lamicote dourado, glitter, papel color plus 180g e visor shaker com miçangas.',
    basePrice: 48.00,
    costPrice: 11.20,
    productionTimeMinutes: 35,
    minQuantity: 1,
    suggestedMarkup: 3.0,
    active: true,
    materials: [
      { materialId: 'mat_3', materialName: 'Papel Lamicote Dourado 250g A4', quantityNeeded: 1, unit: 'fl', estimatedCost: 1.85 },
      { materialId: 'mat_4', materialName: 'Papel Color Plus 180g Cores Variadas A4', quantityNeeded: 2, unit: 'fl', estimatedCost: 0.90 },
      { materialId: 'mat_2', materialName: 'Papel Fotográfico Glossy 180g A4', quantityNeeded: 1, unit: 'fl', estimatedCost: 0.52 },
      { materialId: 'mat_6', materialName: 'Fita Banana Dupla Face Espuma 3D', quantityNeeded: 0.2, unit: 'rl', estimatedCost: 1.70 },
      { materialId: 'mat_8', materialName: 'Chatons / Strass / Meia Pérola', quantityNeeded: 6, unit: 'un', estimatedCost: 0.90 }
    ]
  },
  {
    id: 'prod_2',
    sku: 'CX-MILK-LUX',
    name: 'Caixa Milk Luxo com Laço Duplo e Tag 3D',
    category: 'caixas_luxo',
    description: 'Caixa modelo Milk com corte especial, aplique em camadas, laço de cetim estruturado e chaton de pedraria.',
    basePrice: 14.50,
    costPrice: 3.40,
    productionTimeMinutes: 15,
    minQuantity: 10,
    suggestedMarkup: 2.8,
    active: true,
    materials: [
      { materialId: 'mat_1', materialName: 'Papel Offset 180g A4', quantityNeeded: 1, unit: 'fl', estimatedCost: 0.18 },
      { materialId: 'mat_3', materialName: 'Papel Lamicote Dourado 250g A4', quantityNeeded: 0.3, unit: 'fl', estimatedCost: 0.55 },
      { materialId: 'mat_7', materialName: 'Fita de Cetim nº 3 (15mm)', quantityNeeded: 0.6, unit: 'm', estimatedCost: 0.21 },
      { materialId: 'mat_8', materialName: 'Chatons / Strass / Meia Pérola', quantityNeeded: 1, unit: 'un', estimatedCost: 0.15 },
      { materialId: 'mat_6', materialName: 'Fita Banana Dupla Face Espuma 3D', quantityNeeded: 0.05, unit: 'rl', estimatedCost: 0.42 }
    ]
  },
  {
    id: 'prod_3',
    sku: 'AGN-PER-2027',
    name: 'Agenda / Planner Personalizado Capa Dura A5',
    category: 'agendas_planners',
    description: 'Planner anual personalizado com capa dura laminada holográfica ou fosca, miolo offset 90g, elástico e wire-o metálico.',
    basePrice: 89.90,
    costPrice: 24.50,
    productionTimeMinutes: 50,
    minQuantity: 1,
    suggestedMarkup: 2.5,
    active: true,
    materials: [
      { materialId: 'mat_10', materialName: 'Papelão Paraná / Cinza 1.9mm', quantityNeeded: 0.25, unit: 'un', estimatedCost: 1.72 },
      { materialId: 'mat_2', materialName: 'Papel Fotográfico Glossy 180g A4', quantityNeeded: 2, unit: 'fl', estimatedCost: 1.04 },
      { materialId: 'mat_5', materialName: 'Filme BOPP Holográfico Caquinhos', quantityNeeded: 0.8, unit: 'm', estimatedCost: 0.96 },
      { materialId: 'mat_9', materialName: 'Garra Wire-o 5/8" Branco', quantityNeeded: 1, unit: 'un', estimatedCost: 2.10 },
      { materialId: 'mat_1', materialName: 'Papel Offset 180g A4', quantityNeeded: 80, unit: 'fl', estimatedCost: 14.40 }
    ]
  },
  {
    id: 'prod_4',
    sku: 'KIT-FESTA-50',
    name: 'Kit Festa Clássico (50 Peças Variadas)',
    category: 'kits_festa',
    description: 'Kit composto por 10 Caixas Milk, 10 Caixas Pirâmide/Cone, 10 Caixas Sushi, 10 Porta Tubetes e 10 Caixas Bala.',
    basePrice: 380.00,
    costPrice: 88.00,
    productionTimeMinutes: 240,
    minQuantity: 1,
    suggestedMarkup: 2.9,
    active: true,
    materials: [
      { materialId: 'mat_1', materialName: 'Papel Offset 180g A4', quantityNeeded: 55, unit: 'fl', estimatedCost: 9.90 },
      { materialId: 'mat_4', materialName: 'Papel Color Plus 180g Cores Variadas A4', quantityNeeded: 20, unit: 'fl', estimatedCost: 9.00 },
      { materialId: 'mat_7', materialName: 'Fita de Cetim nº 3 (15mm)', quantityNeeded: 25, unit: 'm', estimatedCost: 8.75 },
      { materialId: 'mat_6', materialName: 'Fita Banana Dupla Face Espuma 3D', quantityNeeded: 2, unit: 'rl', estimatedCost: 17.00 }
    ]
  },
  {
    id: 'prod_5',
    sku: 'TAG-AGRAD-100',
    name: 'Cento de Tags de Agradecimento Recortadas',
    category: 'adesivos_tags',
    description: '100 tags 5x5cm com furo para lembrancinhas em papel offset 240g ou fotográfico matte.',
    basePrice: 45.00,
    costPrice: 7.50,
    productionTimeMinutes: 20,
    minQuantity: 1,
    suggestedMarkup: 3.5,
    active: true,
    materials: [
      { materialId: 'mat_1', materialName: 'Papel Offset 180g A4', quantityNeeded: 9, unit: 'fl', estimatedCost: 1.62 }
    ]
  }
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord_101',
    orderNumber: 'PED-2026-089',
    customerName: 'Mariana Silveira',
    customerWhatsapp: '(11) 97123-8899',
    customerEmail: 'mariana.silveira@email.com',
    eventDate: '2026-10-15',
    deliveryDeadline: '2026-10-08',
    deliveryMethod: 'pickup',
    shippingCost: 0,
    status: 'in_production',
    paymentStatus: 'partial',
    paymentMethod: 'pix',
    amountPaid: 150.00,
    discount: 0,
    subtotal: 285.00,
    totalAmount: 285.00,
    notes: 'Tema Jardim Encantado / Borboletas Douradas. Cores: Rosa bebê, verde menta e detalhes em lamicote dourado.',
    items: [
      {
        id: 'item_1',
        productId: 'prod_1',
        productName: 'Topo de Bolo Luxo Shaker Camadas 3D',
        theme: 'Jardim Encantado',
        customizationText: 'Helena - 1 Aninho',
        quantity: 1,
        unitPrice: 48.00,
        totalPrice: 48.00,
        finishings: ['Lamicote Dourado', 'Shaker com Glitter', 'Flores em Papel']
      },
      {
        id: 'item_2',
        productId: 'prod_2',
        productName: 'Caixa Milk Luxo com Laço Duplo e Tag 3D',
        theme: 'Jardim Encantado',
        customizationText: 'Helena - 1 Aninho',
        quantity: 15,
        unitPrice: 14.50,
        totalPrice: 217.50,
        finishings: ['Laço Rosa Bebê Duplo', 'Chaton Meia Pérola']
      },
      {
        id: 'item_3',
        productId: 'prod_5',
        productName: 'Cento de Tags de Agradecimento Recortadas',
        theme: 'Jardim Encantado',
        customizationText: 'Obrigado pela presença!',
        quantity: 1,
        unitPrice: 19.50,
        totalPrice: 19.50,
        finishings: ['Furo 3mm']
      }
    ],
    artRevisions: [
      {
        id: 'rev_1',
        date: '2026-09-22',
        version: 1,
        imageUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=60',
        feedback: 'Cliente aprovou com entusiasmo a paleta de cores!',
        approved: true,
        status: 'approved'
      }
    ],
    currentArtStatus: 'approved',
    publicApprovalToken: 'art_tok_89a7f3',
    createdAt: '2026-09-20T14:30:00Z',
    updatedAt: '2026-09-23T10:00:00Z'
  },
  {
    id: 'ord_102',
    orderNumber: 'PED-2026-090',
    customerName: 'Rodrigo Medeiros (Escola Sonho Feliz)',
    customerWhatsapp: '(11) 98344-1212',
    customerEmail: 'contato@escolasonhofeliz.com.br',
    eventDate: '2026-10-30',
    deliveryDeadline: '2026-10-20',
    deliveryMethod: 'motoboy',
    shippingCost: 35.00,
    status: 'art_approval',
    paymentStatus: 'paid',
    paymentMethod: 'pix',
    amountPaid: 484.50,
    discount: 0,
    subtotal: 449.50,
    totalAmount: 484.50,
    notes: 'Lembrancinhas Dia dos Professores. Planners personalizados com o nome de cada professor.',
    items: [
      {
        id: 'item_4',
        productId: 'prod_3',
        productName: 'Agenda / Planner Personalizado Capa Dura A5',
        theme: 'Floral Delicado - Dia dos Professores',
        customizationText: 'Lista de 5 Professores (Ana, Carlos, Beatriz, Juliana, Renato)',
        quantity: 5,
        unitPrice: 89.90,
        totalPrice: 449.50,
        finishings: ['Laminação Holográfica Caquinhos', 'Elástico Dourado']
      }
    ],
    artRevisions: [
      {
        id: 'rev_2',
        date: '2026-09-24',
        version: 1,
        imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=60',
        feedback: 'Aguardando validação da grafia do nome dos professores.',
        approved: false,
        status: 'pending'
      }
    ],
    currentArtStatus: 'waiting_client',
    publicApprovalToken: 'art_tok_90b8e2',
    createdAt: '2026-09-23T09:15:00Z',
    updatedAt: '2026-09-24T16:00:00Z'
  },
  {
    id: 'ord_103',
    orderNumber: 'PED-2026-091',
    customerName: 'Fernanda Paiva',
    customerWhatsapp: '(11) 99876-0011',
    eventDate: '2026-11-05',
    deliveryDeadline: '2026-10-28',
    deliveryMethod: 'pickup',
    shippingCost: 0,
    status: 'pending_payment',
    paymentStatus: 'unpaid',
    paymentMethod: 'pix',
    amountPaid: 0,
    discount: 20.00,
    subtotal: 380.00,
    totalAmount: 360.00,
    notes: 'Kit Festa Tema Astronauta / Galáxia para Lorenzo - 4 Anos. Cliente pediu envio da chave pix para confirmar reserva da data.',
    items: [
      {
        id: 'item_5',
        productId: 'prod_4',
        productName: 'Kit Festa Clássico (50 Peças Variadas)',
        theme: 'Astronauta / Galáxia 3D',
        customizationText: 'Lorenzo - 4 Anos',
        quantity: 1,
        unitPrice: 380.00,
        totalPrice: 380.00,
        finishings: ['Papel Color Plus Azul Escuro e Laranja', 'Laço Cetim Prata']
      }
    ],
    artRevisions: [],
    currentArtStatus: 'none',
    createdAt: '2026-09-25T08:00:00Z',
    updatedAt: '2026-09-25T08:00:00Z'
  }
];

export const INITIAL_PRODUCTION_JOBS: ProductionJob[] = [
  {
    id: 'job_1',
    orderId: 'ord_101',
    orderNumber: 'PED-2026-089',
    customerName: 'Mariana Silveira',
    productName: 'Topo de Bolo Luxo Shaker (Helena 1 Ano)',
    theme: 'Jardim Encantado',
    quantity: 1,
    machine: 'plotter_corte',
    step: 'corte',
    priority: 'urgent',
    estimatedMinutes: 25,
    assignedTo: 'Amanda (Corte)',
    deadline: '2026-10-06'
  },
  {
    id: 'job_2',
    orderId: 'ord_101',
    orderNumber: 'PED-2026-089',
    customerName: 'Mariana Silveira',
    productName: '15 Caixas Milk Luxo (Helena 1 Ano)',
    theme: 'Jardim Encantado',
    quantity: 15,
    machine: 'plotter_corte',
    step: 'montagem',
    priority: 'urgent',
    estimatedMinutes: 60,
    assignedTo: 'Letícia (Montagem)',
    deadline: '2026-10-07'
  },
  {
    id: 'job_3',
    orderId: 'ord_102',
    orderNumber: 'PED-2026-090',
    customerName: 'Rodrigo Medeiros',
    productName: '5 Planners Capa Dura Professores',
    theme: 'Floral Delicado',
    quantity: 5,
    machine: 'laminadora',
    step: 'arte',
    priority: 'normal',
    estimatedMinutes: 90,
    assignedTo: 'Paula (Design)',
    deadline: '2026-10-18'
  }
];

export const INITIAL_TRANSACTIONS: FinancialTransaction[] = [
  {
    id: 'trans_1',
    description: 'Sinal 50% Pedido PED-2026-089 (Mariana Silveira)',
    type: 'income',
    category: 'sinal_pedido',
    amount: 150.00,
    date: '2026-09-21',
    paymentMethod: 'pix',
    orderId: 'ord_101',
    customerOrSupplier: 'Mariana Silveira',
    status: 'completed'
  },
  {
    id: 'trans_2',
    description: 'Pagamento Integral Pedido PED-2026-090 (Escola Sonho Feliz)',
    type: 'income',
    category: 'venda_produtos',
    amount: 484.50,
    date: '2026-09-23',
    paymentMethod: 'pix',
    orderId: 'ord_102',
    customerOrSupplier: 'Rodrigo Medeiros',
    status: 'completed'
  },
  {
    id: 'trans_3',
    description: 'Compra de Papéis Especiais & Lamicote Dourado',
    type: 'expense',
    category: 'compra_materia_prima',
    amount: 215.80,
    date: '2026-09-12',
    paymentMethod: 'credit_card',
    customerOrSupplier: 'Tex Papéis & Gráfica',
    status: 'completed'
  },
  {
    id: 'trans_4',
    description: 'Reposição Lâminas de Corte Silhouette & Base de Corte',
    type: 'expense',
    category: 'equipamentos_manutencao',
    amount: 145.00,
    date: '2026-09-08',
    paymentMethod: 'pix',
    customerOrSupplier: 'Silhouette Brasil',
    status: 'completed'
  },
  {
    id: 'trans_5',
    description: 'Energia Elétrica & Internet do Ateliê',
    type: 'expense',
    category: 'energia_internet',
    amount: 180.00,
    date: '2026-09-15',
    paymentMethod: 'pix',
    customerOrSupplier: 'Enel / Vivo Fibra',
    status: 'completed'
  }
];

export const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [
  {
    id: 'mov_1',
    materialId: 'mat_3',
    materialName: 'Papel Lamicote Dourado 250g A4',
    type: 'in',
    quantity: 30,
    previousStock: 4,
    newStock: 34,
    reason: 'Compra NF 4589 Tex Papéis',
    date: '2026-08-28'
  },
  {
    id: 'mov_2',
    materialId: 'mat_3',
    materialName: 'Papel Lamicote Dourado 250g A4',
    type: 'order_consumed',
    quantity: 10,
    previousStock: 34,
    newStock: 24,
    reason: 'Consumo para Pedido PED-2026-088 e PED-2026-089',
    orderId: 'ord_101',
    date: '2026-09-22'
  }
];

class StorageService {
  private get<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error(`Error reading ${key} from storage:`, e);
      return defaultValue;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Error writing ${key} to storage:`, e);
    }
  }

  // Orders
  getOrders(): Order[] {
    return this.get<Order[]>(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
  }

  saveOrders(orders: Order[]): void {
    this.set(STORAGE_KEYS.ORDERS, orders);
  }

  saveOrder(order: Order): void {
    const orders = this.getOrders();
    const index = orders.findIndex(o => o.id === order.id);
    if (index >= 0) {
      orders[index] = order;
    } else {
      orders.unshift(order);
    }
    this.saveOrders(orders);
  }

  deleteOrder(id: string): void {
    const orders = this.getOrders().filter(o => o.id !== id);
    this.saveOrders(orders);
  }

  // Products
  getProducts(): Product[] {
    return this.get<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
  }

  saveProducts(products: Product[]): void {
    this.set(STORAGE_KEYS.PRODUCTS, products);
  }

  saveProduct(product: Product): void {
    const products = this.getProducts();
    const index = products.findIndex(p => p.id === product.id);
    if (index >= 0) {
      products[index] = product;
    } else {
      products.unshift(product);
    }
    this.saveProducts(products);
  }

  deleteProduct(id: string): void {
    const products = this.getProducts().filter(p => p.id !== id);
    this.saveProducts(products);
  }

  // Materials & Stock
  getMaterials(): MaterialItem[] {
    return this.get<MaterialItem[]>(STORAGE_KEYS.MATERIALS, INITIAL_MATERIALS);
  }

  saveMaterials(materials: MaterialItem[]): void {
    this.set(STORAGE_KEYS.MATERIALS, materials);
  }

  saveMaterial(material: MaterialItem): void {
    const materials = this.getMaterials();
    const index = materials.findIndex(m => m.id === material.id);
    if (index >= 0) {
      materials[index] = material;
    } else {
      materials.unshift(material);
    }
    this.saveMaterials(materials);
  }

  deleteMaterial(id: string): void {
    const materials = this.getMaterials().filter(m => m.id !== id);
    this.saveMaterials(materials);
  }

  // Stock Movements
  getStockMovements(): StockMovement[] {
    return this.get<StockMovement[]>(STORAGE_KEYS.MOVEMENTS, INITIAL_STOCK_MOVEMENTS);
  }

  addStockMovement(movement: Omit<StockMovement, 'id' | 'date'>): StockMovement {
    const movements = this.getStockMovements();
    const newMovement: StockMovement = {
      ...movement,
      id: 'mov_' + Date.now(),
      date: new Date().toISOString()
    };
    movements.unshift(newMovement);
    this.set(STORAGE_KEYS.MOVEMENTS, movements);
    return newMovement;
  }

  // Production Jobs
  getProductionJobs(): ProductionJob[] {
    return this.get<ProductionJob[]>(STORAGE_KEYS.PRODUCTION, INITIAL_PRODUCTION_JOBS);
  }

  saveProductionJobs(jobs: ProductionJob[]): void {
    this.set(STORAGE_KEYS.PRODUCTION, jobs);
  }

  saveProductionJob(job: ProductionJob): void {
    const jobs = this.getProductionJobs();
    const index = jobs.findIndex(j => j.id === job.id);
    if (index >= 0) {
      jobs[index] = job;
    } else {
      jobs.unshift(job);
    }
    this.saveProductionJobs(jobs);
  }

  deleteProductionJob(id: string): void {
    const jobs = this.getProductionJobs().filter(j => j.id !== id);
    this.saveProductionJobs(jobs);
  }

  // Financial Transactions
  getTransactions(): FinancialTransaction[] {
    return this.get<FinancialTransaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
  }

  saveTransactions(transactions: FinancialTransaction[]): void {
    this.set(STORAGE_KEYS.TRANSACTIONS, transactions);
  }

  saveTransaction(transaction: FinancialTransaction): void {
    const transactions = this.getTransactions();
    const index = transactions.findIndex(t => t.id === transaction.id);
    if (index >= 0) {
      transactions[index] = transaction;
    } else {
      transactions.unshift(transaction);
    }
    this.saveTransactions(transactions);
  }

  deleteTransaction(id: string): void {
    const transactions = this.getTransactions().filter(t => t.id !== id);
    this.saveTransactions(transactions);
  }

  // Settings
  getSettings(): AtelierSettings {
    return this.get<AtelierSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  }

  saveSettings(settings: AtelierSettings): void {
    this.set(STORAGE_KEYS.SETTINGS, settings);
  }

  // Full Backup and Restore
  exportFullBackup(): string {
    const payload = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      orders: this.getOrders(),
      products: this.getProducts(),
      materials: this.getMaterials(),
      movements: this.getStockMovements(),
      production: this.getProductionJobs(),
      transactions: this.getTransactions(),
      settings: this.getSettings()
    };
    return JSON.stringify(payload, null, 2);
  }

  importFullBackup(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr);
      if (data.orders) this.saveOrders(data.orders);
      if (data.products) this.saveProducts(data.products);
      if (data.materials) this.saveMaterials(data.materials);
      if (data.movements) this.set(STORAGE_KEYS.MOVEMENTS, data.movements);
      if (data.production) this.saveProductionJobs(data.production);
      if (data.transactions) this.saveTransactions(data.transactions);
      if (data.settings) this.saveSettings(data.settings);
      return true;
    } catch (e) {
      console.error('Failed to import backup:', e);
      return false;
    }
  }

  resetToDefaultSeed(): void {
    this.saveOrders(INITIAL_ORDERS);
    this.saveProducts(INITIAL_PRODUCTS);
    this.saveMaterials(INITIAL_MATERIALS);
    this.set(STORAGE_KEYS.MOVEMENTS, INITIAL_STOCK_MOVEMENTS);
    this.saveProductionJobs(INITIAL_PRODUCTION_JOBS);
    this.saveTransactions(INITIAL_TRANSACTIONS);
    this.saveSettings(DEFAULT_SETTINGS);
  }
}

export const storage = new StorageService();
