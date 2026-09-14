/**
 * PAPER MAX - Orders Module
 * Handles order lifecycle, frozen ProductSnapshot, deep validation,
 * status transitions, search, tabs, and CSV import/export.
 */

import {
  loadOrders,
  saveOrders,
  loadProducts,
  loadMaterials,
  saveMaterials,
  loadComponents,
  saveComponents,
  loadMovements,
  saveMovements
} from '../../data/storage.js';
import { bus } from '../../core/events.js';
import { createSnapshotFromProduct } from '../../data/seed.js';
import { formatDateBR, parseDateBRToISO } from '../../utils/sanitize.js';
import { generateCSV, parseCSV } from '../../utils/csv.js';
import { consumeOrderMaterials } from '../stock/stock.engine.js';
import {
  OPERATIONAL_STATUS_MAP,
  STATUS_ALIAS_MAP,
  PRODUCTION_STAGES,
  PRODUCTION_STAGE_ORDER,
  getStatusDefinition,
  ensureOrderProductionState,
  appendProductionHistory,
  approveOrder as engineApproveOrder,
  sendOrderToProduction as engineSendOrderToProduction,
  advanceProductionStage as engineAdvanceProductionStage,
  returnProductionStage as engineReturnProductionStage,
  updateProductionQuantity as engineUpdateProductionQuantity,
  updatePrintJob as engineUpdatePrintJob,
  submitQualityControl as engineSubmitQualityControl,
  updatePackagingStage as engineUpdatePackagingStage,
  markOrderDelivered as engineMarkOrderDelivered,
  generateOperationalLabelData
} from '../production/production.engine.js';

export {
  OPERATIONAL_STATUS_MAP,
  PRODUCTION_STAGES,
  PRODUCTION_STAGE_ORDER,
  getStatusDefinition,
  ensureOrderProductionState,
  generateOperationalLabelData
};

export const ORDER_STATUS_MAP = {
  // Legacy keys
  yellow: { label: 'Aguardando aprovação', bg: '#fef3c7', border: '#fde68a', text: '#92400e', dot: '#d97706' },
  blue: { label: 'Em produção', bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', dot: '#2563eb' },
  orange: { label: 'Em conferência', bg: '#fff7ed', border: '#fed7aa', text: '#c2410c', dot: '#ea580c' },
  red: { label: 'Bloqueado por material', bg: '#fef2f2', border: '#fecaca', text: '#991b1b', dot: '#dc2626' },
  green: { label: 'Pronto', bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', dot: '#059669' },
  neutral: { label: 'Entregue / Concluído', bg: '#f8fafc', border: '#e2e8f0', text: '#475569', dot: '#64748b' },
  // Operational statuses
  ...OPERATIONAL_STATUS_MAP
};

/**
 * Unified rule for Active Orders:
 * Determines if an order is active in the operational workflow.
 * Excludes completed, delivered, and cancelled orders.
 */
export function isOrderActive(order) {
  if (!order) return false;
  const s = (order.status || '').toLowerCase();
  const lbl = (order.statusLabel || '').toLowerCase();
  return s !== 'neutral' && s !== 'entregue' && s !== 'cancelado' && !lbl.includes('cancelado') && !lbl.includes('entregue');
}

const STATUS_CYCLE = ['yellow', 'blue', 'orange', 'red', 'green', 'neutral'];

export function getOrders(filter = {}) {
  let list = loadOrders();

  if (filter.tab && filter.tab !== 'todos') {
    switch (filter.tab) {
      case 'aguardando':
        list = list.filter(o => {
          const s = (o.status || '').toLowerCase();
          return s === 'yellow' || s === 'aguardando_aprovacao' || s === 'aguardando_impressao';
        });
        break;
      case 'em_andamento':
        list = list.filter(isOrderActive);
        break;
      case 'producao':
        list = list.filter(o => {
          const s = (o.status || '').toLowerCase();
          return s === 'blue' || s === 'orange' || s === 'red' ||
            s === 'aprovado' || s === 'em_personalizacao' || s === 'aguardando_impressao' ||
            s === 'imprimindo' || s === 'em_corte' || s === 'em_vinco' || s === 'em_montagem' ||
            s === 'em_acabamento' || s === 'em_conferencia' || s === 'em_embalagem' || s === 'bloqueado';
        });
        break;
      case 'impressao':
        list = list.filter(o => {
          const s = (o.status || '').toLowerCase();
          const stage = (o.production?.currentStage || '').toLowerCase();
          return stage === 'impressao' || s === 'aguardando_impressao' || s === 'imprimindo';
        });
        break;
      case 'corte':
        list = list.filter(o => {
          const stage = (o.production?.currentStage || '').toLowerCase();
          const s = (o.status || '').toLowerCase();
          return stage === 'corte' || s === 'em_corte';
        });
        break;
      case 'vinco':
        list = list.filter(o => {
          const stage = (o.production?.currentStage || '').toLowerCase();
          const s = (o.status || '').toLowerCase();
          return stage === 'vinco' || s === 'em_vinco';
        });
        break;
      case 'montagem':
        list = list.filter(o => {
          const stage = (o.production?.currentStage || '').toLowerCase();
          const s = (o.status || '').toLowerCase();
          return stage === 'montagem' || s === 'em_montagem';
        });
        break;
      case 'acabamento':
        list = list.filter(o => {
          const stage = (o.production?.currentStage || '').toLowerCase();
          const s = (o.status || '').toLowerCase();
          return stage === 'acabamento' || s === 'em_acabamento';
        });
        break;
      case 'conferencia':
        list = list.filter(o => {
          const stage = (o.production?.currentStage || '').toLowerCase();
          const s = (o.status || '').toLowerCase();
          return stage === 'conferencia' || s === 'em_conferencia' || s === 'orange';
        });
        break;
      case 'embalagem':
        list = list.filter(o => {
          const stage = (o.production?.currentStage || '').toLowerCase();
          const s = (o.status || '').toLowerCase();
          return stage === 'embalagem' || s === 'em_embalagem';
        });
        break;
      case 'pronto':
      case 'prontos':
        list = list.filter(o => {
          const stage = (o.production?.currentStage || '').toLowerCase();
          const s = (o.status || '').toLowerCase();
          return stage === 'pronto' || s === 'green' || s === 'pronto';
        });
        break;
      case 'entregues':
        list = list.filter(o => (o.status === 'neutral' || o.status === 'entregue') && !o.statusLabel?.toLowerCase().includes('cancelado'));
        break;
      case 'bloqueados':
        list = list.filter(o => o.status === 'red' || o.status === 'bloqueado');
        break;
      case 'cancelados':
        list = list.filter(o => o.status === 'cancelado' || o.statusLabel?.toLowerCase().includes('cancelado'));
        break;
    }
  }

  if (filter.search) {
    const term = filter.search.toLowerCase().trim();
    list = list.filter(o => {
      const orderNumStr = String(o.number || o.id || '');
      const orderTitle = (o.title || `Pedido ${o.number} · ${o.productTitle}`).toLowerCase();
      const customer = (o.customer || '').toLowerCase();
      const product = (o.productTitle || '').toLowerCase();
      const statusLbl = (o.statusLabel || '').toLowerCase();
      return (
        orderNumStr.includes(term) ||
        orderTitle.includes(term) ||
        customer.includes(term) ||
        product.includes(term) ||
        statusLbl.includes(term)
      );
    });
  }

  return list;
}

export function getOrderById(id) {
  const numId = Number(id);
  return loadOrders().find(o => o.id === id || o.id === numId || o.number === numId) || null;
}

export function getNextOrderNumber() {
  const orders = loadOrders();
  if (orders.length === 0) return 1001;
  const maxNum = orders.reduce((max, o) => {
    const n = Number(o.number || o.id) || 0;
    return n > max ? n : max;
  }, 1000);
  return maxNum + 1;
}

export function createOrder(payload) {
  // 1. Validation
  const customer = (payload.customer || '').trim();
  if (!customer) {
    throw new Error('Informe o Nome do cliente.');
  }

  const qty = parseInt(payload.qty, 10);
  if (isNaN(qty) || qty < 1) {
    throw new Error('A quantidade deve ser de no mínimo 1 item.');
  }

  const products = loadProducts();
  const selectedProduct = products.find(p => p.id === payload.productId);
  if (!selectedProduct) {
    throw new Error('Selecione um produto cadastrado no catálogo.');
  }

  // 2. Validate required personalization fields defined in product
  const personalization = payload.personalization || {};
  if (Array.isArray(selectedProduct.personalizationFields)) {
    for (const field of selectedProduct.personalizationFields) {
      if (field.required) {
        const val = personalization[field.id];
        if (val === undefined || val === null || String(val).trim() === '') {
          throw new Error(`Informe o campo obrigatório de personalização: "${field.name}".`);
        }
      }
    }
  }

  // 3. Validate required change options defined in product
  const changeOptions = payload.changeOptions || {};
  if (Array.isArray(selectedProduct.changeOptions)) {
    for (const opt of selectedProduct.changeOptions) {
      if (opt.required) {
        const val = changeOptions[opt.id];
        if (val === undefined || val === null || String(val).trim() === '') {
          throw new Error(`Selecione a opção obrigatória: "${opt.name}".`);
        }
      }
    }
  }

  // 4. Create frozen ProductSnapshot (Critical rule!)
  const productSnapshot = createSnapshotFromProduct(selectedProduct);

  const nextNum = getNextOrderNumber();
  const statusKey = payload.status && ORDER_STATUS_MAP[payload.status] ? payload.status : 'yellow';
  const statusLabel = ORDER_STATUS_MAP[statusKey].label;

  const deliveryDateFormatted = formatDateBR(payload.deliveryDate || new Date());
  const orderDateFormatted = formatDateBR(payload.orderDate || new Date());

  const newOrder = {
    id: nextNum,
    number: nextNum,
    customer,
    productId: selectedProduct.id,
    productTitle: selectedProduct.name,
    title: `Pedido ${nextNum} · ${selectedProduct.name}`,
    qty,
    orderDate: orderDateFormatted,
    deliveryDate: deliveryDateFormatted,
    status: statusKey,
    statusLabel,
    personalization,
    changeOptions,
    productSnapshot, // Frozen snapshot: product modifications will NEVER change this
    generatedFiles: Array.isArray(payload.generatedFiles) ? payload.generatedFiles : [],
    notes: (payload.notes || '').trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  ensureOrderProductionState(newOrder);

  const orders = loadOrders();
  orders.unshift(newOrder);
  saveOrders(orders);
  bus.emit('orders:changed', orders);
  return newOrder;
}

export function updateOrder(id, payload) {
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === id || o.id === Number(id) || o.number === Number(id));
  if (index === -1) {
    throw new Error('Pedido não encontrado.');
  }

  const existing = orders[index];
  const customer = payload.customer !== undefined ? (payload.customer || '').trim() : existing.customer;
  if (!customer) {
    throw new Error('Informe o Nome do cliente.');
  }

  const qty = payload.qty !== undefined ? parseInt(payload.qty, 10) : existing.qty;
  if (isNaN(qty) || qty < 1) {
    throw new Error('A quantidade deve ser de no mínimo 1 item.');
  }

  const statusKey = payload.status && ORDER_STATUS_MAP[payload.status] ? payload.status : existing.status;
  const statusLabel = payload.statusLabel || (ORDER_STATUS_MAP[statusKey] ? ORDER_STATUS_MAP[statusKey].label : existing.statusLabel);

  const updatedOrder = {
    ...existing,
    customer,
    qty,
    deliveryDate: payload.deliveryDate ? formatDateBR(payload.deliveryDate) : existing.deliveryDate,
    status: statusKey,
    statusLabel,
    personalization: payload.personalization !== undefined ? payload.personalization : existing.personalization,
    changeOptions: payload.changeOptions !== undefined ? payload.changeOptions : existing.changeOptions,
    generatedFiles: payload.generatedFiles !== undefined ? payload.generatedFiles : (existing.generatedFiles || []),
    production: payload.production !== undefined ? payload.production : existing.production,
    notes: payload.notes !== undefined ? (payload.notes || '').trim() : existing.notes,
    title: `Pedido ${existing.number || existing.id} · ${existing.productTitle}`,
    updatedAt: new Date().toISOString()
  };

  ensureOrderProductionState(updatedOrder);

  orders[index] = updatedOrder;
  saveOrders(orders);
  bus.emit('orders:changed', orders);
  return updatedOrder;
}

function triggerOrderStockConsumptionIfPending(order, operator = 'Operador Produção') {
  if (!order || !order.production || order.production.stockDeducted) {
    return;
  }

  // Se o snapshot não tiver composição direta mas o produto do catálogo tiver, hidratar composição
  if ((!order.productSnapshot?.composition || order.productSnapshot.composition.length === 0) && order.productId) {
    const products = loadProducts();
    const prod = products.find(p => p.id === order.productId);
    if (prod && Array.isArray(prod.composition) && prod.composition.length > 0) {
      if (!order.productSnapshot) {
        order.productSnapshot = { id: prod.id, name: prod.name, composition: prod.composition };
      } else {
        order.productSnapshot.composition = prod.composition;
      }
    }
  }

  const materials = loadMaterials();
  const components = loadComponents();
  const movements = loadMovements();

  const res = consumeOrderMaterials(order, { materials, components, movements, operator });
  if (res.success && !res.alreadyDeducted && res.movements?.length > 0) {
    saveMaterials(materials);
    saveComponents(components);
    saveMovements(movements);
    bus.emit('materials:changed', materials);
    bus.emit('movements:changed', movements);
  }
}

// ==========================================
// OPERATIONAL PRODUCTION FLOW ACTIONS
// ==========================================
export function approveOrderById(id, options = {}) {
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === id || o.id === Number(id) || o.number === Number(id));
  if (index === -1) throw new Error('Pedido não encontrado.');
  const order = orders[index];
  engineApproveOrder(order, options);
  saveOrders(orders);
  bus.emit('orders:changed', orders);
  return order;
}

export function sendOrderToProductionById(id, options = {}) {
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === id || o.id === Number(id) || o.number === Number(id));
  if (index === -1) throw new Error('Pedido não encontrado.');
  const order = orders[index];
  const res = engineSendOrderToProduction(order, options);

  // Baixar materiais quando entra na esteira de produção
  triggerOrderStockConsumptionIfPending(order, options.operator || 'Operador Produção');

  saveOrders(orders);
  bus.emit('orders:changed', orders);
  return res;
}

export function advanceOrderStageById(id, options = {}) {
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === id || o.id === Number(id) || o.number === Number(id));
  if (index === -1) throw new Error('Pedido não encontrado.');
  const order = orders[index];
  const res = engineAdvanceProductionStage(order, options);

  // Se avançou para corte/vinco/montagem e ainda não baixou estoque
  triggerOrderStockConsumptionIfPending(order, options.operator || 'Operador Produção');

  saveOrders(orders);
  bus.emit('orders:changed', orders);
  return res;
}

export function returnOrderStageById(id, targetStageId, options = {}) {
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === id || o.id === Number(id) || o.number === Number(id));
  if (index === -1) throw new Error('Pedido não encontrado.');
  const order = orders[index];
  const res = engineReturnProductionStage(order, targetStageId, options);
  saveOrders(orders);
  bus.emit('orders:changed', orders);
  return res;
}

export function updateOrderQuantityById(id, producedQty, options = {}) {
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === id || o.id === Number(id) || o.number === Number(id));
  if (index === -1) throw new Error('Pedido não encontrado.');
  const order = orders[index];
  const res = engineUpdateProductionQuantity(order, producedQty, options);
  saveOrders(orders);
  bus.emit('orders:changed', orders);
  return res;
}

export function updateOrderPrintJobById(id, action, options = {}) {
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === id || o.id === Number(id) || o.number === Number(id));
  if (index === -1) throw new Error('Pedido não encontrado.');
  const order = orders[index];
  const res = engineUpdatePrintJob(order, action, options);
  saveOrders(orders);
  bus.emit('orders:changed', orders);
  return res;
}

export function submitOrderQCById(id, qcPayload) {
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === id || o.id === Number(id) || o.number === Number(id));
  if (index === -1) throw new Error('Pedido não encontrado.');
  const order = orders[index];
  const res = engineSubmitQualityControl(order, qcPayload);
  saveOrders(orders);
  bus.emit('orders:changed', orders);
  return res;
}

export function updateOrderPackagingById(id, options = {}) {
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === id || o.id === Number(id) || o.number === Number(id));
  if (index === -1) throw new Error('Pedido não encontrado.');
  const order = orders[index];
  const res = engineUpdatePackagingStage(order, options);
  saveOrders(orders);
  bus.emit('orders:changed', orders);
  return res;
}

export function markOrderDeliveredById(id, options = {}) {
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === id || o.id === Number(id) || o.number === Number(id));
  if (index === -1) throw new Error('Pedido não encontrado.');
  const order = orders[index];
  const res = engineMarkOrderDelivered(order, options);
  saveOrders(orders);
  bus.emit('orders:changed', orders);
  return res.order || order;
}

export function addGeneratedFileToOrder(orderId, fileInfo) {
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === orderId || o.id === Number(orderId) || o.number === Number(orderId));
  if (index === -1) return null;
  const order = orders[index];
  const list = Array.isArray(order.generatedFiles) ? order.generatedFiles : [];
  list.unshift(fileInfo);
  order.generatedFiles = list;
  order.updatedAt = new Date().toISOString();
  orders[index] = order;
  saveOrders(orders);
  bus.emit('orders:changed', orders);
  return order;
}

export function duplicateOrder(id) {
  const original = getOrderById(id);
  if (!original) {
    throw new Error('Pedido não encontrado para duplicação.');
  }

  const nextNum = getNextOrderNumber();
  const duplicatedOrder = {
    ...JSON.parse(JSON.stringify(original)),
    id: nextNum,
    number: nextNum,
    customer: `${original.customer} (Cópia)`,
    title: `Pedido ${nextNum} · ${original.productTitle}`,
    status: 'yellow',
    statusLabel: ORDER_STATUS_MAP.yellow.label,
    orderDate: formatDateBR(new Date()),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const orders = loadOrders();
  orders.unshift(duplicatedOrder);
  saveOrders(orders);
  bus.emit('orders:changed', orders);
  return duplicatedOrder;
}

export function deleteOrder(id) {
  let orders = loadOrders();
  const initialLength = orders.length;
  orders = orders.filter(o => o.id !== id && o.id !== Number(id) && o.number !== Number(id));

  if (orders.length === initialLength) {
    return { success: false, message: 'Pedido não encontrado.' };
  }

  saveOrders(orders);
  bus.emit('orders:changed', orders);
  return { success: true, message: 'Pedido excluído com sucesso.' };
}

export function cycleOrderStatus(id) {
  const order = getOrderById(id);
  if (!order) return null;

  const currentIndex = STATUS_CYCLE.indexOf(order.status);
  const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
  const nextStatusKey = STATUS_CYCLE[nextIndex];
  const nextStatusLabel = ORDER_STATUS_MAP[nextStatusKey].label;

  return updateOrder(id, { status: nextStatusKey, statusLabel: nextStatusLabel });
}

// ==========================================
// CSV IMPORT & EXPORT
// ==========================================
export function exportOrdersCSV() {
  const orders = loadOrders();
  const headers = ['numero', 'cliente', 'produto', 'quantidade', 'data_pedido', 'data_entrega', 'status', 'observacoes'];
  const rows = orders.map(o => ({
    numero: `Pedido ${o.number || o.id}`,
    cliente: o.customer || '',
    produto: o.productTitle || '',
    quantidade: o.qty || 1,
    data_pedido: o.orderDate || '',
    data_entrega: o.deliveryDate || '',
    status: o.statusLabel || o.status || '',
    observacoes: o.notes || ''
  }));
  return generateCSV(headers, rows);
}

export function exportOrdersCSVTemplate() {
  const headers = ['cliente', 'produto', 'quantidade', 'data_entrega', 'observacoes'];
  const rows = [
    {
      cliente: 'Mariana Silva',
      produto: 'Sacola M Kraft',
      quantidade: '25',
      data_entrega: '20/09/2026',
      observacoes: 'Laço dourado, tema realeza'
    }
  ];
  return generateCSV(headers, rows);
}

export function importOrdersCSV(csvText) {
  const parsed = parseCSV(csvText);
  if (!parsed || !parsed.rows || parsed.rows.length === 0) {
    throw new Error('O arquivo CSV não possui linhas de dados ou está vazio.');
  }

  const products = loadProducts();
  const errors = [];
  const validOrders = [];

  let nextNum = getNextOrderNumber();

  parsed.rows.forEach(row => {
    const line = row._line;
    const customer = row['cliente'] || row['customer'];
    if (!customer || !customer.trim()) {
      errors.push(`Linha ${line}: Nome do cliente é obrigatório.`);
      return;
    }

    const prodName = (row['produto'] || row['product'] || '').trim();
    // Match product or fallback to first product
    let product = products.find(p => p.name.toLowerCase() === prodName.toLowerCase());
    if (!product && products.length > 0) {
      product = products[0];
    }

    const qty = parseInt(row['quantidade'] || row['qty'] || '1', 10);
    if (isNaN(qty) || qty < 1) {
      errors.push(`Linha ${line}: Quantidade inválida.`);
      return;
    }

    const deliveryRaw = row['data_entrega'] || row['delivery_date'] || '';
    const deliveryFormatted = formatDateBR(deliveryRaw || new Date());

    const num = nextNum++;
    validOrders.push({
      id: num,
      number: num,
      customer: customer.trim(),
      productId: product ? product.id : 'prod_avulso',
      productTitle: product ? product.name : (prodName || 'Item Personalizado'),
      title: `Pedido ${num} · ${product ? product.name : (prodName || 'Item')}`,
      qty,
      orderDate: formatDateBR(new Date()),
      deliveryDate: deliveryFormatted,
      status: 'yellow',
      statusLabel: ORDER_STATUS_MAP.yellow.label,
      personalization: {},
      changeOptions: {},
      productSnapshot: product ? createSnapshotFromProduct(product) : null,
      notes: (row['observacoes'] || row['notes'] || '').trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  if (errors.length > 0 && validOrders.length === 0) {
    return { success: false, errors, count: 0 };
  }

  if (validOrders.length > 0) {
    const current = loadOrders();
    const combined = [...validOrders, ...current];
    saveOrders(combined);
    bus.emit('orders:changed', combined);
  }

  return { success: true, count: validOrders.length, errors };
}
