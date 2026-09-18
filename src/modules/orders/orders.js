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
import { formatDateBR, parseDateBRToISO, generateId } from '../../utils/sanitize.js';
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
  let customerName = (payload.customer || '').trim();
  if (!customerName && payload.customerType === 'PJ') customerName = (payload.customerCompany || '').trim();
  if (!customerName) {
    throw new Error('Informe o Nome/Empresa do cliente.');
  }

  const products = loadProducts();
  const items = Array.isArray(payload.items) && payload.items.length > 0 ? payload.items : [];
  
  if (items.length === 0 && payload.productId) {
    items.push({
      productId: payload.productId,
      qty: parseInt(payload.qty || 1, 10),
      personalization: payload.personalization || {},
      changeOptions: payload.changeOptions || {},
      unitPrice: payload.unitPrice || 0,
      totalPrice: payload.totalPrice || 0,
      notes: payload.notes || ''
    });
  }

  if (items.length === 0) {
    throw new Error('A ordem deve ter pelo menos um item.');
  }

  const processedItems = [];
  let totalCalculated = 0;

  for (const item of items) {
    const qty = parseInt(item.qty, 10);
    if (isNaN(qty) || qty < 1) {
      throw new Error('A quantidade deve ser de no mínimo 1 item para todos os produtos.');
    }
    const selectedProduct = products.find(p => p.id === item.productId);
    if (!selectedProduct) {
      throw new Error('Um dos produtos selecionados não foi encontrado no catálogo.');
    }

    const personalization = item.personalization || {};
    if (Array.isArray(selectedProduct.personalizationFields)) {
      for (const field of selectedProduct.personalizationFields) {
        if (field.required) {
          const val = personalization[field.id];
          if (val === undefined || val === null || String(val).trim() === '') {
            throw new Error(`Informe o campo obrigatório de personalização: "${field.name}" para o produto ${selectedProduct.name}.`);
          }
        }
      }
    }

    const changeOptions = item.changeOptions || {};
    if (Array.isArray(selectedProduct.changeOptions)) {
      for (const opt of selectedProduct.changeOptions) {
        if (opt.required) {
          const val = changeOptions[opt.id];
          if (val === undefined || val === null || String(val).trim() === '') {
            throw new Error(`Selecione a opção obrigatória: "${opt.name}" para o produto ${selectedProduct.name}.`);
          }
        }
      }
    }

    const productSnapshot = createSnapshotFromProduct(selectedProduct);
    const unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : (selectedProduct.price || 0);
    const totalPrice = unitPrice * qty;
    totalCalculated += totalPrice;

    processedItems.push({
      id: generateId('itm'),
      productId: selectedProduct.id,
      productTitle: selectedProduct.name,
      qty,
      personalization,
      changeOptions,
      productSnapshot,
      unitPrice,
      totalPrice,
      notes: (item.notes || '').trim()
    });
  }

  const nextNum = getNextOrderNumber();
  const statusKey = payload.status && ORDER_STATUS_MAP[payload.status] ? payload.status : 'yellow';
  const statusLabel = ORDER_STATUS_MAP[statusKey].label;
  
  const eventDateFormatted = payload.eventDate ? formatDateBR(payload.eventDate) : '';
  const limitDateFormatted = payload.limitDate ? formatDateBR(payload.limitDate) : '';
  const deliveryDateFormatted = formatDateBR(payload.deliveryDate || payload.limitDate || new Date());
  const orderDateFormatted = payload.orderDate ? (typeof payload.orderDate === 'string' && payload.orderDate.includes('/') ? payload.orderDate : formatDateBR(payload.orderDate)) : formatDateBR(new Date());

  const primaryItem = processedItems[0];
  const orderTitle = processedItems.length > 1 ? `Vários Itens (${processedItems.length})` : primaryItem.productTitle;

  const newOrder = {
    id: nextNum,
    number: nextNum,
    
    customerType: payload.customerType || 'PF',
    customer: customerName,
    customerPhone: payload.customerPhone || '',
    customerBirthDate: payload.customerBirthDate || '',
    customerCPF: payload.customerCPF || '',
    customerCNPJ: payload.customerCNPJ || '',
    customerCompany: payload.customerCompany || '',
    
    deliveryCep: payload.deliveryCep || '',
    deliveryAddress: payload.deliveryAddress || '',
    deliveryNumber: payload.deliveryNumber || '',
    deliveryNeighborhood: payload.deliveryNeighborhood || '',
    deliveryCity: payload.deliveryCity || '',
    deliveryState: payload.deliveryState || '',
    deliveryNotes: payload.deliveryNotes || '',

    eventDate: eventDateFormatted,
    limitDate: limitDateFormatted,

    items: processedItems,

    productId: primaryItem.productId,
    productTitle: orderTitle,
    title: `Pedido ${nextNum} · ${orderTitle}`,
    qty: primaryItem.qty,
    personalization: primaryItem.personalization,
    changeOptions: primaryItem.changeOptions,
    productSnapshot: primaryItem.productSnapshot,

    orderDate: orderDateFormatted,
    deliveryDate: deliveryDateFormatted,
    status: statusKey,
    statusLabel,
    
    generatedFiles: Array.isArray(payload.generatedFiles) ? payload.generatedFiles : [],
    notes: (payload.notes || '').trim(),

    payments: Array.isArray(payload.payments)
      ? payload.payments
      : (Array.isArray(payload.financial?.payments)
          ? payload.financial.payments
          : (payload.paymentMethod ? [{
              id: 'pay_' + nextNum + '_1',
              method: payload.paymentMethod.toUpperCase(),
              amount: Number(payload.paidAmount || 0),
              date: orderDateFormatted,
              time: '12:00',
              datetime: `${orderDateFormatted} às 12:00`,
              timestamp: new Date().toISOString()
            }] : [])),
    
    paidAmount: Array.isArray(payload.payments) && payload.payments.length > 0
      ? Number(payload.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0).toFixed(2))
      : Number(payload.paidAmount || payload.financial?.paidAmount || 0),

    remainingAmount: (payload.remainingAmount !== undefined)
      ? Number(payload.remainingAmount)
      : Math.max(0, Number((totalCalculated - (
          Array.isArray(payload.payments) && payload.payments.length > 0
            ? payload.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
            : (payload.paidAmount || 0)
        )).toFixed(2))),

    paymentStatus: (
      (Array.isArray(payload.payments) && payload.payments.length > 0
        ? payload.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
        : (payload.paidAmount || 0)) >= totalCalculated
    ) ? 'pago' : ((Array.isArray(payload.payments) && payload.payments.length > 0
        ? payload.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
        : (payload.paidAmount || 0)) > 0 ? 'parcial' : 'pendente'),

    financial: payload.financial || {
      totalAmount: totalCalculated,
      paidAmount: Array.isArray(payload.payments) && payload.payments.length > 0
        ? Number(payload.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0).toFixed(2))
        : Number(payload.paidAmount || 0),
      remainingAmount: (payload.remainingAmount !== undefined)
        ? Number(payload.remainingAmount)
        : Math.max(0, Number((totalCalculated - (
            Array.isArray(payload.payments) && payload.payments.length > 0
              ? payload.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
              : (payload.paidAmount || 0)
          )).toFixed(2))),
      discount: payload.discount || 0,
      payments: Array.isArray(payload.payments) ? payload.payments : []
    },

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
  const strId = String(id).trim();
  const numId = Number(id);

  const index = orders.findIndex(o => {
    const oIdStr = String(o.id ?? '').trim();
    const oNumStr = String(o.number ?? '').trim();
    if (oIdStr === strId || oNumStr === strId) return true;
    if (!isNaN(numId) && (o.id === numId || o.number === numId)) return true;
    return false;
  });

  if (index === -1) {
    throw new Error('Pedido não encontrado.');
  }

  const existing = orders[index];
  const customer = payload.customer !== undefined ? (payload.customer || '').trim() : existing.customer;
  if (!customer && payload.customerType !== 'PJ') {
    throw new Error('Informe o Nome do cliente.');
  }

  const qty = payload.qty !== undefined ? parseInt(payload.qty, 10) : existing.qty;
  if (isNaN(qty) || qty < 1) {
    throw new Error('A quantidade deve ser de no mínimo 1 item.');
  }

  const statusKey = payload.status && ORDER_STATUS_MAP[payload.status] ? payload.status : existing.status;
  const statusLabel = payload.statusLabel || (ORDER_STATUS_MAP[statusKey] ? ORDER_STATUS_MAP[statusKey].label : existing.statusLabel);

  const productTitle = payload.productTitle || (
    Array.isArray(payload.items) && payload.items.length === 1
      ? payload.items[0].productTitle
      : (Array.isArray(payload.items) && payload.items.length > 1 ? `${payload.items.length} itens no pedido` : existing.productTitle)
  );

  const updatedOrder = {
    ...existing,
    ...payload,
    customer: customer || existing.customer,
    qty,
    productTitle: productTitle || existing.productTitle,
    orderDate: payload.orderDate ? (payload.orderDate.includes('/') ? payload.orderDate : formatDateBR(payload.orderDate)) : existing.orderDate,
    deliveryDate: payload.deliveryDate ? (payload.deliveryDate.includes('/') ? payload.deliveryDate : formatDateBR(payload.deliveryDate)) : existing.deliveryDate,
    eventDate: payload.eventDate ? (payload.eventDate.includes('/') ? payload.eventDate : formatDateBR(payload.eventDate)) : existing.eventDate,
    status: statusKey,
    statusLabel,
    personalization: payload.personalization !== undefined ? payload.personalization : existing.personalization,
    changeOptions: payload.changeOptions !== undefined ? payload.changeOptions : existing.changeOptions,
    generatedFiles: payload.generatedFiles !== undefined ? payload.generatedFiles : (existing.generatedFiles || []),
    production: payload.production !== undefined ? payload.production : existing.production,
    notes: payload.notes !== undefined ? (payload.notes || '').trim() : existing.notes,
    title: `Pedido ${existing.number || existing.id} · ${productTitle || existing.productTitle || 'Itens'}`,
    updatedAt: new Date().toISOString()
  };

  ensureOrderProductionState(updatedOrder);

  orders[index] = updatedOrder;
  saveOrders(orders);
  bus.emit('orders:changed', orders);
  return updatedOrder;
}

/**
 * Adds a payment record to an existing order and updates financial balances
 */
export function addOrderPayment(orderId, paymentInput) {
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === orderId || o.id === Number(orderId) || o.number === Number(orderId));
  if (index === -1) {
    throw new Error('Pedido não encontrado.');
  }

  const amount = Number(paymentInput.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Informe um valor de pagamento válido maior que zero.');
  }

  const method = (paymentInput.method || 'PIX').trim().toUpperCase();
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const formattedDateTime = paymentInput.datetime || `${day}/${month}/${year} às ${hours}:${minutes}`;

  const paymentRecord = {
    id: 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    method,
    amount: Number(amount.toFixed(2)),
    date: `${day}/${month}/${year}`,
    time: `${hours}:${minutes}`,
    datetime: formattedDateTime,
    timestamp: now.toISOString(),
    notes: paymentInput.notes || ''
  };

  const order = orders[index];
  if (!Array.isArray(order.payments)) {
    order.payments = [];
    const prevPaid = Number(order.paidAmount || order.financial?.paidAmount || 0);
    if (prevPaid > 0) {
      order.payments.push({
        id: 'pay_init_' + (order.id || order.number),
        method: (order.paymentMethod || order.financial?.paymentMethod || 'PIX').toUpperCase(),
        amount: prevPaid,
        date: order.orderDate || `${day}/${month}/${year}`,
        time: '12:00',
        datetime: `${order.orderDate || `${day}/${month}/${year}`} às 12:00`,
        timestamp: order.createdAt || now.toISOString()
      });
    }
  }

  order.payments.push(paymentRecord);

  // Recalculate financial breakdown
  const totalAmount = Number(
    order.financial?.totalAmount !== undefined 
      ? order.financial.totalAmount 
      : (order.totalAmount !== undefined ? order.totalAmount : ((order.qty || 1) * (order.productSnapshot?.price || 0)))
  );
  const paidAmount = Number(order.payments.reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(2));
  const remainingAmount = Math.max(0, Number((totalAmount - paidAmount).toFixed(2)));
  const paymentStatus = paidAmount >= totalAmount ? 'pago' : (paidAmount > 0 ? 'parcial' : 'pendente');

  order.financial = {
    ...(order.financial || {}),
    totalAmount,
    paidAmount,
    remainingAmount,
    payments: order.payments,
    paymentMethods: order.payments
  };
  order.paidAmount = paidAmount;
  order.remainingAmount = remainingAmount;
  order.paymentStatus = paymentStatus;
  order.updatedAt = now.toISOString();

  orders[index] = order;
  saveOrders(orders);
  bus.emit('orders:changed', orders);

  return { order, payment: paymentRecord };
}

/**
 * Removes a payment record from an existing order and recalculates balances
 */
export function removeOrderPayment(orderId, paymentId) {
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === orderId || o.id === Number(orderId) || o.number === Number(orderId));
  if (index === -1) {
    throw new Error('Pedido não encontrado.');
  }

  const order = orders[index];
  if (!Array.isArray(order.payments)) {
    return order;
  }

  order.payments = order.payments.filter(p => p.id !== paymentId);

  const now = new Date();
  const totalAmount = Number(
    order.financial?.totalAmount !== undefined 
      ? order.financial.totalAmount 
      : (order.totalAmount !== undefined ? order.totalAmount : ((order.qty || 1) * (order.productSnapshot?.price || 0)))
  );
  const paidAmount = Number(order.payments.reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(2));
  const remainingAmount = Math.max(0, Number((totalAmount - paidAmount).toFixed(2)));
  const paymentStatus = paidAmount >= totalAmount ? 'pago' : (paidAmount > 0 ? 'parcial' : 'pendente');

  order.financial = {
    ...(order.financial || {}),
    totalAmount,
    paidAmount,
    remainingAmount,
    payments: order.payments,
    paymentMethods: order.payments
  };
  order.paidAmount = paidAmount;
  order.remainingAmount = remainingAmount;
  order.paymentStatus = paymentStatus;
  order.updatedAt = now.toISOString();

  orders[index] = order;
  saveOrders(orders);
  bus.emit('orders:changed', orders);

  return order;
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
  const strId = String(id).trim();
  const numId = Number(id);

  orders = orders.filter(o => {
    const oIdStr = String(o.id ?? '').trim();
    const oNumStr = String(o.number ?? '').trim();
    if (oIdStr === strId || oNumStr === strId) return false;
    if (!isNaN(numId) && (o.id === numId || o.number === numId)) return false;
    return true;
  });

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
