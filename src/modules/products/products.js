/**
 * PAPER MAX - Products Module
 * Handles catalog, product configuration, versioning, snapshots, CSV import/export.
 */

import { loadProducts, saveProducts, loadOrders } from '../../data/storage.js';
import { bus } from '../../core/events.js';
import { generateId } from '../../utils/sanitize.js';
import { createSnapshotFromProduct } from '../../data/seed.js';
import { generateCSV, parseCSV } from '../../utils/csv.js';

export function getProducts(filter = {}) {
  let list = loadProducts();

  if (filter.categoryId) {
    list = list.filter(p => p.categoryId === filter.categoryId);
  }

  if (filter.status) {
    list = list.filter(p => p.status === filter.status);
  }

  if (filter.search) {
    const term = filter.search.toLowerCase().trim();
    list = list.filter(p => 
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.description && p.description.toLowerCase().includes(term))
    );
  }

  return list;
}

export function getProductById(id) {
  return loadProducts().find(p => p.id === id) || null;
}

/**
 * Checks if a product is a Smart Mold (molde inteligente)
 * Identifies products that have customized editor areas or base PDF templates.
 */
export function isSmartMold(product) {
  if (!product) return false;
  return Boolean(
    product.type === 'molde_inteligente' ||
    product.isSmartMold ||
    (product.editor && Array.isArray(product.editor.textAreas) && product.editor.textAreas.length > 0) ||
    Boolean(product.basePdfMetadata)
  );
}

export function createProduct(payload) {
  const name = (payload.name || '').trim();
  if (!name) {
    throw new Error('Informe o Nome do produto.');
  }

  const products = loadProducts();
  const id = payload.id ? payload.id.trim() : generateId('prod');

  // Verify unique ID
  if (products.some(p => p.id === id)) {
    throw new Error('Já existe um produto cadastrado com este identificador.');
  }

  const newProduct = {
    id,
    name,
    categoryId: payload.categoryId || '',
    subcategoryId: payload.subcategoryId || '',
    status: payload.status || 'ativo',
    active: (payload.status || 'ativo') === 'ativo',
    type: payload.type || 'personalizado',
    description: (payload.description || '').trim(),
    price: Number(payload.price) || 0,
    priceFrom: Number(payload.priceFrom) || 0,
    cost: Number(payload.cost) || 0,
    machineWearRate: Number(payload.machineWearRate) || 0,
    productionTime: Number(payload.productionTime) || 1,
    configurationVersion: 1,
    imageUrl: payload.imageUrl || (payload.mockups?.front) || (Array.isArray(payload.images) && payload.images[0]?.url) || '',
    images: Array.isArray(payload.images) ? payload.images : [],
    mockups: payload.mockups || { front: payload.imageUrl || '', angle: '', back: '' },
    priceHistory: Array.isArray(payload.priceHistory) ? payload.priceHistory : [],
    personalizationFields: Array.isArray(payload.personalizationFields) ? payload.personalizationFields : [],
    changeOptions: Array.isArray(payload.changeOptions) ? payload.changeOptions : [],
    editor: payload.editor || { textAreas: [], elementAreas: [], colorAreas: [] },
    basePdfMetadata: payload.basePdfMetadata || null,
    composition: Array.isArray(payload.composition) ? payload.composition : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  products.push(newProduct);
  saveProducts(products);
  bus.emit('products:changed', products);
  return newProduct;
}

export function updateProduct(id, payload) {
  const products = loadProducts();
  const index = products.findIndex(p => p.id === id);
  if (index === -1) {
    throw new Error('Produto não encontrado.');
  }

  const existing = products[index];
  const name = payload.name !== undefined ? (payload.name || '').trim() : existing.name;
  if (!name) {
    throw new Error('Informe o Nome do produto.');
  }

  // Check if configuration changed (fields, options or editor) to increment configurationVersion
  let configChanged = false;
  if (payload.personalizationFields && JSON.stringify(payload.personalizationFields) !== JSON.stringify(existing.personalizationFields)) {
    configChanged = true;
  }
  if (payload.changeOptions && JSON.stringify(payload.changeOptions) !== JSON.stringify(existing.changeOptions)) {
    configChanged = true;
  }
  if (payload.editor && JSON.stringify(payload.editor) !== JSON.stringify(existing.editor)) {
    configChanged = true;
  }
  if (payload.composition && JSON.stringify(payload.composition) !== JSON.stringify(existing.composition)) {
    configChanged = true;
  }

  const nextVersion = configChanged ? (existing.configurationVersion || 1) + 1 : (existing.configurationVersion || 1);

  const updatedProduct = {
    ...existing,
    name,
    categoryId: payload.categoryId !== undefined ? payload.categoryId : existing.categoryId,
    subcategoryId: payload.subcategoryId !== undefined ? payload.subcategoryId : existing.subcategoryId,
    status: payload.status !== undefined ? payload.status : (payload.active !== undefined ? (payload.active ? 'ativo' : 'inativo') : existing.status),
    active: payload.active !== undefined ? payload.active : (payload.status !== undefined ? payload.status === 'ativo' : (existing.active !== undefined ? existing.active : existing.status === 'ativo')),
    type: payload.type !== undefined ? payload.type : existing.type,
    description: payload.description !== undefined ? payload.description : existing.description,
    price: payload.price !== undefined ? Number(payload.price) || 0 : existing.price,
    priceFrom: payload.priceFrom !== undefined ? Number(payload.priceFrom) || 0 : (existing.priceFrom || 0),
    cost: payload.cost !== undefined ? Number(payload.cost) || 0 : existing.cost,
    machineWearRate: payload.machineWearRate !== undefined ? Number(payload.machineWearRate) || 0 : (existing.machineWearRate || 0),
    productionTime: payload.productionTime !== undefined ? Number(payload.productionTime) || 1 : existing.productionTime,
    configurationVersion: nextVersion,
    imageUrl: payload.imageUrl !== undefined ? payload.imageUrl : (payload.mockups?.front || existing.imageUrl || ''),
    images: payload.images !== undefined ? payload.images : (existing.images || []),
    mockups: payload.mockups !== undefined ? payload.mockups : (existing.mockups || { front: existing.imageUrl || '', angle: '', back: '' }),
    priceHistory: payload.priceHistory !== undefined ? payload.priceHistory : (existing.priceHistory || []),
    personalizationFields: payload.personalizationFields !== undefined ? payload.personalizationFields : existing.personalizationFields,
    changeOptions: payload.changeOptions !== undefined ? payload.changeOptions : existing.changeOptions,
    editor: payload.editor !== undefined ? payload.editor : existing.editor,
    basePdfMetadata: payload.basePdfMetadata !== undefined ? payload.basePdfMetadata : existing.basePdfMetadata,
    composition: payload.composition !== undefined ? payload.composition : (existing.composition || []),
    updatedAt: new Date().toISOString()
  };

  products[index] = updatedProduct;
  saveProducts(products);
  bus.emit('products:changed', products);
  return updatedProduct;
}

export function duplicateProduct(id) {
  const original = getProductById(id);
  if (!original) {
    throw new Error('Produto original não encontrado para duplicação.');
  }

  const duplicatedData = {
    ...JSON.parse(JSON.stringify(original)),
    id: generateId('prod'),
    name: `${original.name} (Cópia)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    configurationVersion: 1
  };

  const products = loadProducts();
  products.push(duplicatedData);
  saveProducts(products);
  bus.emit('products:changed', products);
  return duplicatedData;
}

export function deleteProduct(id) {
  const orders = loadOrders();
  const linkedOrders = orders.filter(o => 
    o.productId === id || 
    (Array.isArray(o.items) && o.items.some(it => it.productId === id))
  );

  if (linkedOrders.length > 0) {
    return {
      success: false,
      message: `Não é possível excluir: existem ${linkedOrders.length} pedido(s) associado(s) a este produto. Recomendamos ocultar/inativar o produto para preservar o histórico dos pedidos.`
    };
  }

  let products = loadProducts();
  const initialLength = products.length;
  products = products.filter(p => p.id !== id);

  if (products.length === initialLength) {
    return { success: false, message: 'Produto não encontrado.' };
  }

  saveProducts(products);
  bus.emit('products:changed', products);
  return { success: true, message: 'Produto excluído com sucesso.' };
}

export function getProductSnapshot(product) {
  return createSnapshotFromProduct(product);
}

// Re-export Commercial Intelligence Functions (Etapa 7)
export * from './products.intelligence.js';
export * from './products.ui.js';

export function exportProductsCSV() {
  const products = loadProducts();
  const headers = ['id', 'nome', 'categoria_id', 'status', 'tipo', 'preco', 'custo', 'tempo_producao_dias', 'versao_config', 'descricao'];
  const rows = products.map(p => ({
    id: p.id,
    nome: p.name,
    categoria_id: p.categoryId || '',
    status: p.status || 'ativo',
    tipo: p.type || 'personalizado',
    preco: (p.price || 0).toFixed(2),
    custo: (p.cost || 0).toFixed(2),
    tempo_producao_dias: p.productionTime || 1,
    versao_config: p.configurationVersion || 1,
    descricao: p.description || ''
  }));
  return generateCSV(headers, rows);
}

export function exportProductsCSVTemplate() {
  const headers = ['nome', 'categoria_id', 'tipo', 'preco', 'custo', 'tempo_producao_dias', 'descricao'];
  const rows = [
    {
      nome: 'Caixa Cone Pirâmide',
      categoria_id: 'cat_festas',
      tipo: 'personalizado',
      preco: '5.50',
      custo: '1.80',
      tempo_producao_dias: '2',
      descricao: 'Caixa pirâmide com aplique e laço'
    }
  ];
  return generateCSV(headers, rows);
}

export function importProductsCSV(csvText) {
  const parsed = parseCSV(csvText);
  if (!parsed || !parsed.rows || parsed.rows.length === 0) {
    throw new Error('O arquivo CSV não possui dados ou está vazio.');
  }

  const errors = [];
  const validProducts = [];

  parsed.rows.forEach(row => {
    const line = row._line;
    const name = row['nome'] || row['name'];
    if (!name || !name.trim()) {
      errors.push(`Linha ${line}: Nome do produto é obrigatório.`);
      return;
    }

    validProducts.push({
      id: generateId('prod'),
      name: name.trim(),
      categoryId: row['categoria_id'] || row['categoria'] || '',
      status: 'ativo',
      type: row['tipo'] || 'personalizado',
      price: parseFloat((row['preco'] || '0').replace(',', '.')) || 0,
      cost: parseFloat((row['custo'] || '0').replace(',', '.')) || 0,
      productionTime: parseInt(row['tempo_producao_dias'] || '1', 10) || 1,
      description: row['descricao'] || '',
      configurationVersion: 1,
      personalizationFields: [
        { id: 'field_nome', name: 'Nome do Cliente / Aniversariante', type: 'text', required: true, defaultValue: '' }
      ],
      changeOptions: [],
      editor: { textAreas: [], elementAreas: [], colorAreas: [] },
      basePdfMetadata: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  if (errors.length > 0 && validProducts.length === 0) {
    return { success: false, errors, count: 0 };
  }

  if (validProducts.length > 0) {
    const current = loadProducts();
    const combined = [...current, ...validProducts];
    saveProducts(combined);
    bus.emit('products:changed', combined);
  }

  return { success: true, count: validProducts.length, errors };
}

// Re-export Commercial Intelligence & Vitrine helpers
export {
  calculateProductIntelligence,
  exportProductIntelligenceCSV,
  INTELLIGENCE_PERIODS
} from './products.intelligence.js';

export {
  renderProductsRankingView,
  renderProductsTrendsView,
  renderProductsCapacityView,
  openProductIntelligenceDrawer,
  renderCommercialVitrine,
  openProductCommercialPreviewDrawer
} from './products.ui.js';

