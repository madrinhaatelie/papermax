/**
 * PAPER MAX - Integrated Financial Core Engine (Etapa 6)
 * 
 * Central Principles:
 * 1. ONE business operation -> Multiple automatic reflections.
 *    - Order -> Sale + Receivable + Lifetime P&L.
 *    - Purchase -> Inventory + Supplier History + Payable.
 * 2. Zero duplicated records.
 * 3. Strict Idempotency (prevent duplicate sales, payables, receivables, cash entries).
 * 4. Technical Cost Engine consumed directly from Products -> Components (BOM) -> Materials.
 * 5. Preservation of Historical Product Snapshots.
 * 6. Explicit separation: REALIZED (Cash Flow) vs PREDICTED (Accrual/Forecast).
 */

import {
  loadOrders,
  saveOrders,
  loadProducts,
  loadPurchases,
  loadMaterials,
  loadComponents,
  loadSuppliers,
  loadExpenses,
  saveExpenses,
  loadReceivables,
  saveReceivables,
  loadPayables,
  savePayables
} from '../../data/storage.js';
import {
  calculateComponentCost,
  expandProductComposition,
  buildMaterialsMap,
  buildComponentsMap
} from '../stock/stock.engine.js';
import {
  formatDateBR,
  formatDateShortBR,
  parseDateBRToISO,
  formatCurrency,
  generateId,
  escapeHtml
} from '../../utils/sanitize.js';
import { bus } from '../../core/events.js';

// ==========================================
// CONSTANTS & CATEGORIES
// ==========================================

export const EXPENSE_CATEGORIES = [
  'Materiais',
  'Equipamentos',
  'Fretes',
  'Serviços',
  'Marketing',
  'Operacional',
  'Pró-labore',
  'Outros'
];

export const PAYMENT_METHODS = [
  'Pix',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Boleto',
  'Dinheiro',
  'Transferência Bancária',
  'Outro'
];

export const FINANCIAL_PERIODS = {
  ESTE_MES: 'este_mes',
  MES_ANTERIOR: 'mes_anterior',
  ULTIMOS_30: 'ultimos_30',
  TODO_PERIODO: 'todo_periodo',
  PERSONALIZADO: 'personalizado'
};

// ==========================================
// DATE & PERIOD HELPERS (Brazilian Format)
// ==========================================

export function parseAnyDateToDateObj(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;

  const str = String(dateInput).trim();
  if (!str) return null;

  // DD/MM/YYYY or DD/MM/YYYY HH:mm:ss
  if (str.includes('/')) {
    const parts = str.split(' ')[0].split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  // ISO or YYYY-MM-DD
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function isDateInSelectedPeriod(dateInput, period = FINANCIAL_PERIODS.ESTE_MES, customRange = {}) {
  if (period === FINANCIAL_PERIODS.TODO_PERIODO) return true;

  const d = parseAnyDateToDateObj(dateInput);
  if (!d) return true; // If no date, include conservatively

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  if (period === FINANCIAL_PERIODS.ESTE_MES) {
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  }

  if (period === FINANCIAL_PERIODS.MES_ANTERIOR) {
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
  }

  if (period === FINANCIAL_PERIODS.ULTIMOS_30) {
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    return d >= thirtyDaysAgo && d <= now;
  }

  if (period === FINANCIAL_PERIODS.PERSONALIZADO) {
    const start = customRange.startDate ? parseAnyDateToDateObj(customRange.startDate) : null;
    const end = customRange.endDate ? parseAnyDateToDateObj(customRange.endDate) : null;

    if (start && d < start) return false;
    if (end) {
      // Include whole end date (until 23:59:59)
      const endOfDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59);
      if (d > endOfDay) return false;
    }
    return true;
  }

  return true;
}

// ==========================================
// 1. SALES DERIVED FROM ORDERS
// ==========================================

/**
 * Derives sales directly from real registered orders.
 * NEVER duplicates data. Preserves historical Product Snapshots.
 */
export function getSalesFromOrders(options = {}) {
  const orders = options.orders || loadOrders();
  const products = options.products || loadProducts();
  const receivables = options.receivables || loadReceivables();
  const materials = options.materials || loadMaterials();
  const components = options.components || loadComponents();

  const materialsMap = buildMaterialsMap(materials);
  const componentsMap = buildComponentsMap(components);
  const productsMap = new Map(products.map(p => [p.id, p]));
  const receivablesMapByOrder = new Map();
  receivables.forEach(r => {
    if (r.orderId) receivablesMapByOrder.set(String(r.orderId), r);
  });

  const period = options.period || FINANCIAL_PERIODS.TODO_PERIODO;
  const customRange = options.customRange || {};
  const search = (options.search || '').toLowerCase().trim();

  const sales = orders.map(order => {
    const orderIdStr = String(order.id || order.number);
    const qty = Number(order.qty) || 1;

    // 1. Unit Price derivation (Snapshot -> Product -> Fallback)
    let unitPrice = 0;
    if (order.productSnapshot && typeof order.productSnapshot.price === 'number') {
      unitPrice = order.productSnapshot.price;
    } else {
      const prod = productsMap.get(order.productId) || products.find(p => p.name === order.productTitle);
      unitPrice = prod?.price ?? 8.50;
    }

    // 2. Unit Cost derivation (Snapshot -> Technical BOM calculation -> Product -> Fallback)
    let unitCost = 0;
    if (order.productSnapshot && typeof order.productSnapshot.cost === 'number' && order.productSnapshot.cost > 0) {
      unitCost = order.productSnapshot.cost;
    } else {
      const prod = productsMap.get(order.productId) || products.find(p => p.name === order.productTitle);
      if (prod) {
        if (Array.isArray(prod.composition) && prod.composition.length > 0) {
          const bom = expandProductComposition(prod, materialsMap, componentsMap);
          unitCost = bom.totalCost > 0 ? bom.totalCost : (prod.cost || 3.20);
        } else {
          unitCost = prod.cost || 3.20;
        }
      } else {
        unitCost = 3.20;
      }
    }

    const totalSale = qty * unitPrice;
    const totalCost = qty * unitCost;
    const profit = totalSale - totalCost;
    const marginPercent = totalSale > 0 ? (profit / totalSale) * 100 : 0;

    // 3. Status of receiving from linked accounts receivable
    const linkedRec = receivablesMapByOrder.get(orderIdStr);
    let receivingStatus = 'aberto';
    let paidDate = null;
    let paymentMethod = 'Pix';

    if (linkedRec) {
      receivingStatus = linkedRec.status || 'aberto';
      paidDate = linkedRec.paidDate || null;
      paymentMethod = linkedRec.paymentMethod || 'Pix';
    } else if (order.status === 'entregue' || order.status === 'pronto' || order.status === 'green') {
      // Legacy fallback
      receivingStatus = 'recebido';
      paidDate = order.updatedAt ? formatDateBR(order.updatedAt) : order.orderDate;
    }

    const saleDate = order.orderDate || formatDateBR(order.createdAt || new Date());

    return {
      id: `sale_${orderIdStr}`,
      orderId: order.id || order.number,
      orderNumber: order.number || order.id,
      customer: order.customer || 'Cliente Balcão',
      productId: order.productId || 'prod_custom',
      productTitle: order.productTitle || order.title || 'Item Personalizado',
      qty,
      unitPrice,
      totalSale,
      unitCost,
      totalCost,
      profit,
      marginPercent,
      date: saleDate,
      deliveryDate: order.deliveryDate || '--/--/----',
      orderStatus: order.status,
      receivingStatus,
      paidDate,
      paymentMethod,
      receivableId: linkedRec?.id || null,
      notes: order.notes || '',
      hasSnapshot: !!order.productSnapshot
    };
  });

  // Filter by period & search
  return sales.filter(s => {
    if (!isDateInSelectedPeriod(s.date, period, customRange)) return false;

    if (search) {
      const matchText = `${s.orderNumber} ${s.customer} ${s.productTitle} ${s.receivingStatus}`.toLowerCase();
      if (!matchText.includes(search)) return false;
    }

    return true;
  });
}

// ==========================================
// 2. AUTOMATIC SYNC: ORDERS -> RECEIVABLES
// ==========================================

/**
 * Guarantees every order has a corresponding single Account Receivable.
 * Strictly Idempotent: Never duplicates receivables.
 */
export function syncReceivablesWithOrders() {
  const orders = loadOrders();
  const receivables = loadReceivables();
  const products = loadProducts();
  let modified = false;

  const recMap = new Map();
  receivables.forEach(r => {
    if (r.orderId) recMap.set(String(r.orderId), r);
  });

  orders.forEach(order => {
    const orderIdStr = String(order.id || order.number);
    if (!recMap.has(orderIdStr)) {
      const qty = Number(order.qty) || 1;
      const unitPrice = order.productSnapshot?.price ?? (products.find(p => p.id === order.productId)?.price ?? 8.50);
      const amount = qty * unitPrice;

      // Status derivation
      const isAlreadyDone = order.status === 'entregue' || order.status === 'green';
      const status = isAlreadyDone ? 'recebido' : 'aberto';
      const paidDate = isAlreadyDone ? (order.updatedAt ? formatDateBR(order.updatedAt) : order.orderDate) : null;

      const newRec = {
        id: `rec_${orderIdStr}`,
        orderId: order.id || order.number,
        saleId: `sale_${orderIdStr}`,
        customer: order.customer || 'Cliente Balcão',
        description: `Pedido ${order.number || order.id} · ${qty}x ${order.productTitle || 'Item'}`,
        amount: Number(amount.toFixed(2)),
        dueDate: order.deliveryDate || order.orderDate || formatDateBR(new Date()),
        paidDate,
        status,
        paymentMethod: 'Pix',
        notes: order.notes ? `Vínculo com Pedido ${order.number}: ${order.notes}` : `Origem: Pedido ${order.number}`,
        createdAt: order.createdAt || new Date().toISOString()
      };

      receivables.push(newRec);
      recMap.set(orderIdStr, newRec);
      modified = true;
    }
  });

  if (modified) {
    saveReceivables(receivables, true);
  }

  return receivables;
}

// ==========================================
// 3. AUTOMATIC SYNC: PURCHASES -> PAYABLES
// ==========================================

/**
 * Guarantees every purchase order has a corresponding single Account Payable.
 * Strictly Idempotent: Never duplicates payables.
 */
export function syncPayablesWithPurchases() {
  const purchases = loadPurchases();
  const payables = loadPayables();
  let modified = false;

  const payMap = new Map();
  payables.forEach(p => {
    if (p.purchaseId) payMap.set(String(p.purchaseId), p);
  });

  purchases.forEach(pur => {
    const purIdStr = String(pur.id);
    if (!payMap.has(purIdStr)) {
      const isReceived = pur.status === 'recebido' || pur.status === 'recebida';
      const amount = Number(pur.totalAmount) || 0;
      const purDateBR = pur.date ? formatDateBR(pur.date) : formatDateBR(new Date());

      const newPay = {
        id: `pay_${purIdStr}`,
        purchaseId: pur.id,
        supplierId: pur.supplierId || null,
        supplierName: pur.supplierName || 'Fornecedor',
        description: `Compra ${pur.code || pur.id} · ${pur.supplierName || 'Fornecedor'}`,
        amount: Number(amount.toFixed(2)),
        dueDate: pur.dueDate ? formatDateBR(pur.dueDate) : purDateBR,
        paidDate: isReceived ? (pur.receivedAt ? formatDateBR(pur.receivedAt) : purDateBR) : null,
        status: isReceived ? 'pago' : 'aberto',
        paymentMethod: 'Pix',
        notes: pur.notes ? `Origem Compra ${pur.code}: ${pur.notes}` : `Origem Compra ${pur.code}`,
        createdAt: pur.createdAt || pur.date || new Date().toISOString()
      };

      payables.push(newPay);
      payMap.set(purIdStr, newPay);
      modified = true;
    }
  });

  if (modified) {
    savePayables(payables, true);
  }

  return payables;
}

// ==========================================
// 4. FINANCIAL METRICS & DRE CALCULATION
// ==========================================

/**
 * Calculates complete financial indicators, strictly separating REALIZED vs PREDICTED.
 */
export function calculateFinancialMetrics(options = {}) {
  // Ensure sync first
  const receivables = syncReceivablesWithOrders();
  const payables = syncPayablesWithPurchases();
  const expenses = loadExpenses();
  const sales = getSalesFromOrders({ receivables });

  const period = options.period || FINANCIAL_PERIODS.ESTE_MES;
  const customRange = options.customRange || {};

  // 1. Filtered data according to chosen period
  const periodReceivables = receivables.filter(r => {
    const targetDate = r.paidDate || r.dueDate || r.createdAt;
    return isDateInSelectedPeriod(targetDate, period, customRange);
  });

  const periodPayables = payables.filter(p => {
    const targetDate = p.paidDate || p.dueDate || p.createdAt;
    return isDateInSelectedPeriod(targetDate, period, customRange);
  });

  const periodExpenses = expenses.filter(e => {
    const targetDate = e.paidDate || e.date || e.dueDate || e.createdAt;
    return isDateInSelectedPeriod(targetDate, period, customRange);
  });

  const periodSales = sales.filter(s => {
    return isDateInSelectedPeriod(s.date, period, customRange);
  });

  // 2. Realized Cash Entries (Recebimentos Efetivados)
  let entradasRealizadas = 0;
  periodReceivables.forEach(r => {
    if (r.status === 'recebido') {
      entradasRealizadas += Number(r.amount) || 0;
    }
  });

  // 3. Realized Cash Outflows (Pagamentos de Compras + Despesas Operacionais Efetivados)
  let saidasRealizadasCompras = 0;
  periodPayables.forEach(p => {
    if (p.status === 'pago') {
      saidasRealizadasCompras += Number(p.amount) || 0;
    }
  });

  let saidasRealizadasDespesas = 0;
  periodExpenses.forEach(e => {
    if (e.status === 'pago') {
      saidasRealizadasDespesas += Number(e.amount) || 0;
    }
  });

  const totalSaidasRealizadas = saidasRealizadasCompras + saidasRealizadasDespesas;
  const saldoRealizado = entradasRealizadas - totalSaidasRealizadas;

  // 4. Predicted / Pending Values (A Receber e A Pagar)
  let aReceberPrevisto = 0;
  let aReceberVencido = 0;
  let countReceberAberto = 0;
  let countReceberVencido = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  periodReceivables.forEach(r => {
    if (r.status === 'aberto' || r.status === 'vencido') {
      const amt = Number(r.amount) || 0;
      const due = parseAnyDateToDateObj(r.dueDate);
      if (due && due < today) {
        aReceberVencido += amt;
        countReceberVencido++;
      } else {
        aReceberPrevisto += amt;
        countReceberAberto++;
      }
    }
  });
  const totalAReceber = aReceberPrevisto + aReceberVencido;

  let aPagarPrevisto = 0;
  let aPagarVencido = 0;
  let countPagarAberto = 0;
  let countPagarVencido = 0;

  // Payables
  periodPayables.forEach(p => {
    if (p.status === 'aberto' || p.status === 'vencido') {
      const amt = Number(p.amount) || 0;
      const due = parseAnyDateToDateObj(p.dueDate);
      if (due && due < today) {
        aPagarVencido += amt;
        countPagarVencido++;
      } else {
        aPagarPrevisto += amt;
        countPagarAberto++;
      }
    }
  });

  // Open Expenses
  periodExpenses.forEach(e => {
    if (e.status === 'aberto' || e.status === 'vencido') {
      const amt = Number(e.amount) || 0;
      const due = parseAnyDateToDateObj(e.dueDate || e.date);
      if (due && due < today) {
        aPagarVencido += amt;
        countPagarVencido++;
      } else {
        aPagarPrevisto += amt;
        countPagarAberto++;
      }
    }
  });
  const totalAPagar = aPagarPrevisto + aPagarVencido;

  // 5. Sales & Economic Performance (Competência)
  let totalVendas = 0;
  let totalCustoMercadorias = 0;
  periodSales.forEach(s => {
    totalVendas += s.totalSale;
    totalCustoMercadorias += s.totalCost;
  });

  const lucroBrutoVendas = totalVendas - totalCustoMercadorias;
  const margemMediaPercent = totalVendas > 0 ? (lucroBrutoVendas / totalVendas) * 100 : 0;
  const resultadoOperacional = lucroBrutoVendas - saidasRealizadasDespesas;

  // 6. Breakdown by Category of Expenses
  const expensesByCategory = {};
  EXPENSE_CATEGORIES.forEach(cat => { expensesByCategory[cat] = 0; });
  periodExpenses.forEach(e => {
    const cat = e.category || 'Outros';
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + (Number(e.amount) || 0);
  });

  return {
    period,
    // REALIZED (Caixa)
    entradasRealizadas: Number(entradasRealizadas.toFixed(2)),
    saidasRealizadas: Number(totalSaidasRealizadas.toFixed(2)),
    saidasCompras: Number(saidasRealizadasCompras.toFixed(2)),
    saidasDespesas: Number(saidasRealizadasDespesas.toFixed(2)),
    saldoRealizado: Number(saldoRealizado.toFixed(2)),
    
    // PREDICTED (Aberto / Vencido)
    totalAReceber: Number(totalAReceber.toFixed(2)),
    aReceberPrevisto: Number(aReceberPrevisto.toFixed(2)),
    aReceberVencido: Number(aReceberVencido.toFixed(2)),
    countReceberAberto,
    countReceberVencido,
    
    totalAPagar: Number(totalAPagar.toFixed(2)),
    aPagarPrevisto: Number(aPagarPrevisto.toFixed(2)),
    aPagarVencido: Number(aPagarVencido.toFixed(2)),
    countPagarAberto,
    countPagarVencido,

    resultadoPrevisto: Number((saldoRealizado + totalAReceber - totalAPagar).toFixed(2)),

    // ECONOMIC (Competência)
    totalVendas: Number(totalVendas.toFixed(2)),
    totalCustoMercadorias: Number(totalCustoMercadorias.toFixed(2)),
    lucroBrutoVendas: Number(lucroBrutoVendas.toFixed(2)),
    margemMediaPercent: Number(margemMediaPercent.toFixed(1)),
    resultadoOperacional: Number(resultadoOperacional.toFixed(2)),
    totalOrdersInPeriod: periodSales.length,

    // CATEGORIES
    expensesByCategory
  };
}

// ==========================================
// 5. CRUD: EXPENSES (DESPESAS OPERACIONAIS)
// ==========================================

export function getExpenses(filter = {}) {
  const expenses = loadExpenses();
  const search = (filter.search || '').toLowerCase().trim();
  const category = filter.category || 'todos';
  const status = filter.status || 'todos';
  const period = filter.period || FINANCIAL_PERIODS.TODO_PERIODO;
  const customRange = filter.customRange || {};

  return expenses.filter(e => {
    if (category !== 'todos' && e.category !== category) return false;
    if (status !== 'todos' && e.status !== status) return false;
    if (!isDateInSelectedPeriod(e.paidDate || e.date || e.dueDate, period, customRange)) return false;

    if (search) {
      const match = `${e.description} ${e.category} ${e.notes || ''}`.toLowerCase();
      if (!match.includes(search)) return false;
    }
    return true;
  });
}

export function getExpenseById(id) {
  const expenses = loadExpenses();
  return expenses.find(e => e.id === id) || null;
}

export function createExpense(data) {
  if (!data.description || !data.description.trim()) {
    throw new Error('Descrição da despesa é obrigatória.');
  }
  const amount = Number(data.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Valor da despesa deve ser maior que zero.');
  }

  const expenses = loadExpenses();
  const newExpense = {
    id: data.id || `exp_${generateId()}`,
    description: data.description.trim(),
    category: data.category || 'Operacional',
    amount: Number(amount.toFixed(2)),
    date: data.date || formatDateBR(new Date()),
    dueDate: data.dueDate || data.date || formatDateBR(new Date()),
    paidDate: data.status === 'pago' ? (data.paidDate || formatDateBR(new Date())) : null,
    status: data.status || 'aberto',
    paymentMethod: data.paymentMethod || 'Pix',
    notes: data.notes ? data.notes.trim() : '',
    createdAt: new Date().toISOString()
  };

  expenses.unshift(newExpense);
  saveExpenses(expenses, true);
  bus.emit('finance:changed', { type: 'expense_created', expense: newExpense });
  return newExpense;
}

export function updateExpense(id, data) {
  const expenses = loadExpenses();
  const idx = expenses.findIndex(e => e.id === id);
  if (idx === -1) {
    throw new Error('Despesa não encontrada.');
  }

  const amount = data.amount !== undefined ? Number(data.amount) : expenses[idx].amount;
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Valor da despesa deve ser maior que zero.');
  }

  expenses[idx] = {
    ...expenses[idx],
    ...data,
    amount: Number(amount.toFixed(2)),
    updatedAt: new Date().toISOString()
  };

  saveExpenses(expenses, true);
  bus.emit('finance:changed', { type: 'expense_updated', expense: expenses[idx] });
  return expenses[idx];
}

export function deleteExpense(id) {
  const expenses = loadExpenses();
  const filtered = expenses.filter(e => e.id !== id);
  if (filtered.length === expenses.length) {
    throw new Error('Despesa não encontrada.');
  }
  saveExpenses(filtered, true);
  bus.emit('finance:changed', { type: 'expense_deleted', id });
  return true;
}

export function payExpense(id, paymentData = {}) {
  const expenses = loadExpenses();
  const exp = expenses.find(e => e.id === id);
  if (!exp) throw new Error('Despesa não encontrada.');

  // Idempotent
  if (exp.status === 'pago' && !paymentData.forceUpdate) {
    return { success: true, alreadyPaid: true, expense: exp };
  }

  exp.status = 'pago';
  exp.paidDate = paymentData.paidDate || formatDateBR(new Date());
  if (paymentData.paymentMethod) exp.paymentMethod = paymentData.paymentMethod;
  if (paymentData.notes) exp.notes = `${exp.notes ? exp.notes + ' · ' : ''}${paymentData.notes}`;
  exp.updatedAt = new Date().toISOString();

  saveExpenses(expenses, true);
  bus.emit('finance:changed', { type: 'expense_paid', expense: exp });
  return { success: true, alreadyPaid: false, expense: exp };
}

// ==========================================
// 6. CRUD & ACTIONS: RECEIVABLES (CONTAS A RECEBER)
// ==========================================

export function getReceivables(filter = {}) {
  const receivables = syncReceivablesWithOrders();
  const search = (filter.search || '').toLowerCase().trim();
  const status = filter.status || 'todos';
  const period = filter.period || FINANCIAL_PERIODS.TODO_PERIODO;
  const customRange = filter.customRange || {};

  return receivables.filter(r => {
    if (status !== 'todos' && r.status !== status) return false;
    if (!isDateInSelectedPeriod(r.paidDate || r.dueDate || r.createdAt, period, customRange)) return false;

    if (search) {
      const match = `${r.customer} ${r.description} ${r.orderId || ''} ${r.notes || ''}`.toLowerCase();
      if (!match.includes(search)) return false;
    }
    return true;
  });
}

export function getReceivableById(id) {
  const receivables = loadReceivables();
  return receivables.find(r => r.id === id) || null;
}

export function receiveReceivable(id, receiveData = {}) {
  const receivables = loadReceivables();
  const rec = receivables.find(r => r.id === id);
  if (!rec) throw new Error('Conta a receber não encontrada.');

  // Idempotent
  if (rec.status === 'recebido' && !receiveData.forceUpdate) {
    return { success: true, alreadyReceived: true, receivable: rec };
  }

  rec.status = 'recebido';
  rec.paidDate = receiveData.paidDate || formatDateBR(new Date());
  if (receiveData.paymentMethod) rec.paymentMethod = receiveData.paymentMethod;
  if (receiveData.notes) rec.notes = `${rec.notes ? rec.notes + ' · ' : ''}${receiveData.notes}`;
  rec.updatedAt = new Date().toISOString();

  saveReceivables(receivables, true);
  bus.emit('finance:changed', { type: 'receivable_received', receivable: rec });
  return { success: true, alreadyReceived: false, receivable: rec };
}

export function updateReceivable(id, data) {
  const receivables = loadReceivables();
  const idx = receivables.findIndex(r => r.id === id);
  if (idx === -1) throw new Error('Conta a receber não encontrada.');

  receivables[idx] = {
    ...receivables[idx],
    ...data,
    amount: data.amount !== undefined ? Number(Number(data.amount).toFixed(2)) : receivables[idx].amount,
    updatedAt: new Date().toISOString()
  };

  saveReceivables(receivables, true);
  bus.emit('finance:changed', { type: 'receivable_updated', receivable: receivables[idx] });
  return receivables[idx];
}

export function createReceivable(data) {
  const receivables = loadReceivables();
  const newRec = {
    id: data.id || generateId('REC'),
    orderId: data.orderId || null,
    customer: data.customer || 'Cliente Avulso',
    description: data.description || 'Recebimento Avulso',
    amount: Number(Number(data.amount || 0).toFixed(2)),
    dueDate: data.dueDate || formatDateBR(new Date()),
    status: data.status || 'aberto',
    paymentMethod: data.paymentMethod || 'Pix',
    paidDate: data.status === 'recebido' ? (data.paidDate || formatDateBR(new Date())) : null,
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  receivables.unshift(newRec);
  saveReceivables(receivables, true);
  bus.emit('finance:changed', { type: 'receivable_created', receivable: newRec });
  return newRec;
}

export function deleteReceivable(id) {
  const receivables = loadReceivables();
  const rec = receivables.find(r => r.id === id);
  if (!rec) throw new Error('Conta a receber não encontrada.');

  const filtered = receivables.filter(r => r.id !== id);
  saveReceivables(filtered, true);
  bus.emit('finance:changed', { type: 'receivable_deleted', id });
  return true;
}

// ==========================================
// 7. CRUD & ACTIONS: PAYABLES (CONTAS A PAGAR)
// ==========================================

export function getPayables(filter = {}) {
  const payables = syncPayablesWithPurchases();
  const search = (filter.search || '').toLowerCase().trim();
  const status = filter.status || 'todos';
  const period = filter.period || FINANCIAL_PERIODS.TODO_PERIODO;
  const customRange = filter.customRange || {};

  return payables.filter(p => {
    if (status !== 'todos' && p.status !== status) return false;
    if (!isDateInSelectedPeriod(p.paidDate || p.dueDate || p.createdAt, period, customRange)) return false;

    if (search) {
      const match = `${p.supplierName || ''} ${p.description} ${p.purchaseId || ''} ${p.notes || ''}`.toLowerCase();
      if (!match.includes(search)) return false;
    }
    return true;
  });
}

export function getPayableById(id) {
  const payables = loadPayables();
  return payables.find(p => p.id === id) || null;
}

export function payPayable(id, payData = {}) {
  const payables = loadPayables();
  const pay = payables.find(p => p.id === id);
  if (!pay) throw new Error('Conta a pagar não encontrada.');

  // Idempotent
  if (pay.status === 'pago' && !payData.forceUpdate) {
    return { success: true, alreadyPaid: true, payable: pay };
  }

  pay.status = 'pago';
  pay.paidDate = payData.paidDate || formatDateBR(new Date());
  if (payData.paymentMethod) pay.paymentMethod = payData.paymentMethod;
  if (payData.notes) pay.notes = `${pay.notes ? pay.notes + ' · ' : ''}${payData.notes}`;
  pay.updatedAt = new Date().toISOString();

  savePayables(payables, true);
  bus.emit('finance:changed', { type: 'payable_paid', payable: pay });
  return { success: true, alreadyPaid: false, payable: pay };
}

export function updatePayable(id, data) {
  const payables = loadPayables();
  const idx = payables.findIndex(p => p.id === id);
  if (idx === -1) throw new Error('Conta a pagar não encontrada.');

  payables[idx] = {
    ...payables[idx],
    ...data,
    amount: data.amount !== undefined ? Number(Number(data.amount).toFixed(2)) : payables[idx].amount,
    updatedAt: new Date().toISOString()
  };

  savePayables(payables, true);
  bus.emit('finance:changed', { type: 'payable_updated', payable: payables[idx] });
  return payables[idx];
}

export function createPayable(data) {
  const payables = loadPayables();
  const newPay = {
    id: data.id || generateId('PAY'),
    purchaseId: data.purchaseId || null,
    supplierId: data.supplierId || null,
    supplierName: data.supplierName || 'Fornecedor Avulso',
    description: data.description || 'Conta a Pagar Avulsa',
    amount: Number(Number(data.amount || 0).toFixed(2)),
    dueDate: data.dueDate || formatDateBR(new Date()),
    status: data.status || 'aberto',
    paymentMethod: data.paymentMethod || 'Boleto',
    paidDate: data.status === 'pago' ? (data.paidDate || formatDateBR(new Date())) : null,
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  payables.unshift(newPay);
  savePayables(payables, true);
  bus.emit('finance:changed', { type: 'payable_created', payable: newPay });
  return newPay;
}

export function deletePayable(id) {
  const payables = loadPayables();
  const filtered = payables.filter(p => p.id !== id);
  if (filtered.length === payables.length) throw new Error('Conta a pagar não encontrada.');
  savePayables(filtered, true);
  bus.emit('finance:changed', { type: 'payable_deleted', id });
  return true;
}

// ==========================================
// 8. DETAILED COSTS & MARGINS BREAKDOWN
// ==========================================

export function getDetailedCostsAnalysis() {
  const products = loadProducts();
  const components = loadComponents();
  const materials = loadMaterials();
  const sales = getSalesFromOrders();

  const materialsMap = buildMaterialsMap(materials);
  const componentsMap = buildComponentsMap(components);

  // 1. Products Cost Breakdown
  const productsAnalysis = products.map(p => {
    const isBom = Array.isArray(p.composition) && p.composition.length > 0;
    const bomDetails = isBom ? expandProductComposition(p, materialsMap, componentsMap) : { totalCost: p.cost || 3.20, items: [] };
    const cost = bomDetails.totalCost > 0 ? bomDetails.totalCost : (p.cost || 3.20);
    const price = p.price || 8.50;
    const marginAmount = price - cost;
    const marginPercent = price > 0 ? (marginAmount / price) * 100 : 0;

    return {
      id: p.id,
      name: p.name,
      price,
      cost,
      marginAmount,
      marginPercent,
      hasBOM: isBom,
      bomItemsCount: (p.composition || []).length,
      bomItems: bomDetails.items || []
    };
  });

  // 2. Components Cost Breakdown
  const componentsAnalysis = components.map(c => {
    const unitCost = calculateComponentCost(c, materialsMap, componentsMap);
    return {
      id: c.id,
      name: c.name,
      yield: c.yield || 1,
      unitCost,
      currentStock: c.currentStock || 0,
      minStock: c.minStock || 0,
      items: c.items || []
    };
  });

  // 3. Materials Cost Breakdown
  const materialsAnalysis = materials.map(m => {
    const packCost = Number(m.purchaseCost) || 0;
    const packQty = Number(m.packQuantity) || 1;
    const unitCost = packQty > 0 ? packCost / packQty : 0;

    return {
      id: m.id,
      name: m.name,
      baseUnit: m.baseUnit,
      packType: m.purchasePackType || 'un',
      packQty,
      packCost,
      unitCost,
      currentStock: m.currentStock || 0,
      minStock: m.minStock || 0
    };
  });

  // 4. Orders Real Profitability
  const ordersProfitability = sales.map(s => ({
    orderNumber: s.orderNumber,
    customer: s.customer,
    productTitle: s.productTitle,
    qty: s.qty,
    totalSale: s.totalSale,
    totalCost: s.totalCost,
    profit: s.profit,
    marginPercent: s.marginPercent,
    date: s.date
  }));

  return {
    products: productsAnalysis,
    components: componentsAnalysis,
    materials: materialsAnalysis,
    orders: ordersProfitability
  };
}

// ==========================================
// 9. CSV EXPORT & IMPORT ENGINES
// ==========================================

// Helper: Parse currency from string
function parseCSVCurrency(valStr) {
  if (!valStr) return 0;
  const cleaned = String(valStr).replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// ------------------------------------------
// 9.1 DESPESAS CSV
// ------------------------------------------

export function exportExpensesCSV(expenses = null) {
  const list = expenses || loadExpenses();
  const BOM = '\uFEFF';
  const header = 'id;descricao;categoria;valor;data;vencimento;data_pagamento;status;forma_pagamento;observacao\n';
  const rows = list.map(e => [
    `"${e.id}"`,
    `"${(e.description || '').replace(/"/g, '""')}"`,
    `"${(e.category || 'Operacional').replace(/"/g, '""')}"`,
    `"${Number(e.amount || 0).toFixed(2).replace('.', ',')}"`,
    `"${e.date || ''}"`,
    `"${e.dueDate || ''}"`,
    `"${e.paidDate || ''}"`,
    `"${e.status || 'aberto'}"`,
    `"${(e.paymentMethod || 'Pix').replace(/"/g, '""')}"`,
    `"${(e.notes || '').replace(/"/g, '""')}"`
  ].join(';')).join('\n');

  return BOM + header + rows;
}

export function exportExpensesCSVTemplate() {
  const BOM = '\uFEFF';
  const header = 'descricao;categoria;valor;data;vencimento;data_pagamento;status;forma_pagamento;observacao\n';
  const example1 = 'Energia Elétrica Ateliê;Operacional;150,00;02/09/2026;10/09/2026;08/09/2026;pago;Pix;Conta de luz da oficina\n';
  const example2 = 'Fita banana para apliques;Materiais;45,00;05/09/2026;15/09/2026;;aberto;Boleto;Compra no armarinho local\n';
  return BOM + header + example1 + example2;
}

export function importExpensesCSV(csvText, currentExpenses = null) {
  if (!csvText || typeof csvText !== 'string') {
    return { success: false, errors: ['Arquivo CSV vazio ou inválido.'] };
  }

  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    return { success: false, errors: ['O CSV deve conter cabeçalho e pelo menos uma linha de dados.'] };
  }

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].replace(/^\uFEFF/, '').split(delimiter).map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());

  const colDesc = header.findIndex(h => h.includes('desc'));
  const colCat = header.findIndex(h => h.includes('cat'));
  const colVal = header.findIndex(h => h.includes('val'));
  const colData = header.findIndex(h => h === 'data' || h.includes('dt'));
  const colVenc = header.findIndex(h => h.includes('venc'));
  const colPag = header.findIndex(h => h.includes('pagamento') || h.includes('data_pag'));
  const colStatus = header.findIndex(h => h.includes('status'));
  const colForma = header.findIndex(h => h.includes('forma') || h.includes('metodo'));
  const colObs = header.findIndex(h => h.includes('obs') || h.includes('nota'));

  if (colDesc === -1 || colVal === -1) {
    return { success: false, errors: ['Colunas obrigatórias ausentes: "descricao" e "valor" são necessárias.'] };
  }

  const errors = [];
  const importedList = [];
  const existingExpenses = currentExpenses ? [...currentExpenses] : loadExpenses();
  const existingDescMap = new Set(existingExpenses.map(e => e.description.toLowerCase().trim()));

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    const cols = rawLine.split(delimiter).map(c => c.replace(/^["']|["']$/g, '').trim());
    const desc = cols[colDesc];
    const valRaw = cols[colVal];

    if (!desc) {
      errors.push(`Linha ${i + 1}: Descrição vazia.`);
      continue;
    }

    const val = parseCSVCurrency(valRaw);
    if (val <= 0) {
      errors.push(`Linha ${i + 1} ("${desc}"): Valor inválido ou zerado.`);
      continue;
    }

    const category = colCat !== -1 && cols[colCat] ? cols[colCat] : 'Operacional';
    const date = colData !== -1 && cols[colData] ? cols[colData] : formatDateBR(new Date());
    const dueDate = colVenc !== -1 && cols[colVenc] ? cols[colVenc] : date;
    const paidDate = colPag !== -1 && cols[colPag] ? cols[colPag] : null;
    const status = colStatus !== -1 && cols[colStatus] ? cols[colStatus].toLowerCase() : (paidDate ? 'pago' : 'aberto');
    const paymentMethod = colForma !== -1 && cols[colForma] ? cols[colForma] : 'Pix';
    const notes = colObs !== -1 && cols[colObs] ? cols[colObs] : '';

    const newExp = {
      id: `exp_${generateId()}`,
      description: desc,
      category,
      amount: Number(val.toFixed(2)),
      date,
      dueDate,
      paidDate: status === 'pago' ? (paidDate || date) : null,
      status: ['pago', 'aberto', 'vencido', 'cancelado'].includes(status) ? status : 'aberto',
      paymentMethod,
      notes,
      createdAt: new Date().toISOString()
    };

    importedList.push(newExp);
  }

  if (errors.length > 0 && importedList.length === 0) {
    return { success: false, errors };
  }

  const updatedExpenses = [...importedList, ...existingExpenses];
  if (!currentExpenses) {
    saveExpenses(updatedExpenses, true);
    bus.emit('finance:changed', { type: 'expenses_imported', count: importedList.length });
  }

  return {
    success: true,
    count: importedList.length,
    expenses: updatedExpenses,
    errors
  };
}

// ------------------------------------------
// 9.2 CONTAS A RECEBER CSV
// ------------------------------------------

export function exportReceivablesCSV(receivables = null) {
  const list = receivables || loadReceivables();
  const BOM = '\uFEFF';
  const header = 'id;pedido_origem;cliente;descricao;valor;vencimento;data_recebimento;status;forma_pagamento;observacao\n';
  const rows = list.map(r => [
    `"${r.id}"`,
    `"${r.orderId || ''}"`,
    `"${(r.customer || '').replace(/"/g, '""')}"`,
    `"${(r.description || '').replace(/"/g, '""')}"`,
    `"${Number(r.amount || 0).toFixed(2).replace('.', ',')}"`,
    `"${r.dueDate || ''}"`,
    `"${r.paidDate || ''}"`,
    `"${r.status || 'aberto'}"`,
    `"${(r.paymentMethod || 'Pix').replace(/"/g, '""')}"`,
    `"${(r.notes || '').replace(/"/g, '""')}"`
  ].join(';')).join('\n');

  return BOM + header + rows;
}

export function exportReceivablesCSVTemplate() {
  const BOM = '\uFEFF';
  const header = 'cliente;descricao;valor;vencimento;data_recebimento;status;forma_pagamento;observacao\n';
  const ex1 = 'Juliana Silva;Pedido 1048 · 12x Sacola M;102,00;09/09/2026;;aberto;Pix;50% na aprovação e 50% na entrega\n';
  const ex2 = 'Mariana Costa;Caderno Wire-o A5;210,00;06/09/2026;06/09/2026;recebido;Pix;Pago integralmente\n';
  return BOM + header + ex1 + ex2;
}

export function importReceivablesCSV(csvText, currentReceivables = null) {
  if (!csvText || typeof csvText !== 'string') {
    return { success: false, errors: ['Arquivo CSV vazio ou inválido.'] };
  }

  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    return { success: false, errors: ['O CSV deve conter cabeçalho e pelo menos uma linha de dados.'] };
  }

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].replace(/^\uFEFF/, '').split(delimiter).map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());

  const colCli = header.findIndex(h => h.includes('cli'));
  const colDesc = header.findIndex(h => h.includes('desc'));
  const colVal = header.findIndex(h => h.includes('val'));
  const colVenc = header.findIndex(h => h.includes('venc'));
  const colRec = header.findIndex(h => h.includes('rec') || h.includes('pag'));
  const colStatus = header.findIndex(h => h.includes('status'));
  const colForma = header.findIndex(h => h.includes('forma') || h.includes('metodo'));
  const colObs = header.findIndex(h => h.includes('obs') || h.includes('nota'));

  if (colDesc === -1 || colVal === -1) {
    return { success: false, errors: ['Colunas obrigatórias ausentes: "descricao" e "valor" são necessárias.'] };
  }

  const errors = [];
  const importedList = [];
  const existingReceivables = currentReceivables ? [...currentReceivables] : loadReceivables();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].trim().split(delimiter).map(c => c.replace(/^["']|["']$/g, '').trim());
    const desc = cols[colDesc];
    const valRaw = cols[colVal];

    if (!desc) {
      errors.push(`Linha ${i + 1}: Descrição vazia.`);
      continue;
    }

    const val = parseCSVCurrency(valRaw);
    if (val <= 0) {
      errors.push(`Linha ${i + 1} ("${desc}"): Valor inválido ou zerado.`);
      continue;
    }

    const customer = colCli !== -1 && cols[colCli] ? cols[colCli] : 'Cliente Balcão';
    const dueDate = colVenc !== -1 && cols[colVenc] ? cols[colVenc] : formatDateBR(new Date());
    const paidDate = colRec !== -1 && cols[colRec] ? cols[colRec] : null;
    const status = colStatus !== -1 && cols[colStatus] ? cols[colStatus].toLowerCase() : (paidDate ? 'recebido' : 'aberto');
    const paymentMethod = colForma !== -1 && cols[colForma] ? cols[colForma] : 'Pix';
    const notes = colObs !== -1 && cols[colObs] ? cols[colObs] : '';

    const newRec = {
      id: `rec_${generateId()}`,
      customer,
      description: desc,
      amount: Number(val.toFixed(2)),
      dueDate,
      paidDate: status === 'recebido' ? (paidDate || dueDate) : null,
      status: ['recebido', 'aberto', 'vencido', 'cancelado'].includes(status) ? status : 'aberto',
      paymentMethod,
      notes,
      createdAt: new Date().toISOString()
    };

    importedList.push(newRec);
  }

  if (errors.length > 0 && importedList.length === 0) {
    return { success: false, errors };
  }

  const updated = [...importedList, ...existingReceivables];
  if (!currentReceivables) {
    saveReceivables(updated, true);
    bus.emit('finance:changed', { type: 'receivables_imported', count: importedList.length });
  }

  return { success: true, count: importedList.length, receivables: updated, errors };
}

// ------------------------------------------
// 9.3 CONTAS A PAGAR CSV
// ------------------------------------------

export function exportPayablesCSV(payables = null) {
  const list = payables || loadPayables();
  const BOM = '\uFEFF';
  const header = 'id;compra_origem;fornecedor;descricao;valor;vencimento;data_pagamento;status;forma_pagamento;observacao\n';
  const rows = list.map(p => [
    `"${p.id}"`,
    `"${p.purchaseId || ''}"`,
    `"${(p.supplierName || '').replace(/"/g, '""')}"`,
    `"${(p.description || '').replace(/"/g, '""')}"`,
    `"${Number(p.amount || 0).toFixed(2).replace('.', ',')}"`,
    `"${p.dueDate || ''}"`,
    `"${p.paidDate || ''}"`,
    `"${p.status || 'aberto'}"`,
    `"${(p.paymentMethod || 'Pix').replace(/"/g, '""')}"`,
    `"${(p.notes || '').replace(/"/g, '""')}"`
  ].join(';')).join('\n');

  return BOM + header + rows;
}

export function exportPayablesCSVTemplate() {
  const BOM = '\uFEFF';
  const header = 'fornecedor;descricao;valor;vencimento;data_pagamento;status;forma_pagamento;observacao\n';
  const ex1 = 'Papéis & Cia;Compra COM-102 · Papéis Kraft;85,00;18/09/2026;;aberto;Boleto 14 dias;Reposição estoque\n';
  const ex2 = 'Casa da Fita;Compra COM-101 · Fitas;68,00;15/09/2026;06/09/2026;pago;Pix;Compra recebida e conferida\n';
  return BOM + header + ex1 + ex2;
}

export function importPayablesCSV(csvText, currentPayables = null) {
  if (!csvText || typeof csvText !== 'string') {
    return { success: false, errors: ['Arquivo CSV vazio ou inválido.'] };
  }

  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    return { success: false, errors: ['O CSV deve conter cabeçalho e pelo menos uma linha de dados.'] };
  }

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].replace(/^\uFEFF/, '').split(delimiter).map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());

  const colForn = header.findIndex(h => h.includes('forn'));
  const colDesc = header.findIndex(h => h.includes('desc'));
  const colVal = header.findIndex(h => h.includes('val'));
  const colVenc = header.findIndex(h => h.includes('venc'));
  const colPag = header.findIndex(h => h.includes('pag'));
  const colStatus = header.findIndex(h => h.includes('status'));
  const colForma = header.findIndex(h => h.includes('forma') || h.includes('metodo'));
  const colObs = header.findIndex(h => h.includes('obs') || h.includes('nota'));

  if (colDesc === -1 || colVal === -1) {
    return { success: false, errors: ['Colunas obrigatórias ausentes: "descricao" e "valor" são necessárias.'] };
  }

  const errors = [];
  const importedList = [];
  const existingPayables = currentPayables ? [...currentPayables] : loadPayables();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].trim().split(delimiter).map(c => c.replace(/^["']|["']$/g, '').trim());
    const desc = cols[colDesc];
    const valRaw = cols[colVal];

    if (!desc) {
      errors.push(`Linha ${i + 1}: Descrição vazia.`);
      continue;
    }

    const val = parseCSVCurrency(valRaw);
    if (val <= 0) {
      errors.push(`Linha ${i + 1} ("${desc}"): Valor inválido ou zerado.`);
      continue;
    }

    const supplierName = colForn !== -1 && cols[colForn] ? cols[colForn] : 'Fornecedor';
    const dueDate = colVenc !== -1 && cols[colVenc] ? cols[colVenc] : formatDateBR(new Date());
    const paidDate = colPag !== -1 && cols[colPag] ? cols[colPag] : null;
    const status = colStatus !== -1 && cols[colStatus] ? cols[colStatus].toLowerCase() : (paidDate ? 'pago' : 'aberto');
    const paymentMethod = colForma !== -1 && cols[colForma] ? cols[colForma] : 'Pix';
    const notes = colObs !== -1 && cols[colObs] ? cols[colObs] : '';

    const newPay = {
      id: `pay_${generateId()}`,
      supplierName,
      description: desc,
      amount: Number(val.toFixed(2)),
      dueDate,
      paidDate: status === 'pago' ? (paidDate || dueDate) : null,
      status: ['pago', 'aberto', 'vencido', 'cancelado'].includes(status) ? status : 'aberto',
      paymentMethod,
      notes,
      createdAt: new Date().toISOString()
    };

    importedList.push(newPay);
  }

  if (errors.length > 0 && importedList.length === 0) {
    return { success: false, errors };
  }

  const updated = [...importedList, ...existingPayables];
  if (!currentPayables) {
    savePayables(updated, true);
    bus.emit('finance:changed', { type: 'payables_imported', count: importedList.length });
  }

  return { success: true, count: importedList.length, payables: updated, errors };
}

// ------------------------------------------
// 9.4 VENDAS CSV
// ------------------------------------------

export function exportSalesCSV(sales = null) {
  const list = sales || getSalesFromOrders();
  const BOM = '\uFEFF';
  const header = 'pedido;cliente;produto;quantidade;valor_venda;custo_total;lucro;margem_percentual;status_recebimento;data;entrega\n';
  const rows = list.map(s => [
    `"${s.orderNumber}"`,
    `"${(s.customer || '').replace(/"/g, '""')}"`,
    `"${(s.productTitle || '').replace(/"/g, '""')}"`,
    `"${s.qty}"`,
    `"${Number(s.totalSale || 0).toFixed(2).replace('.', ',')}"`,
    `"${Number(s.totalCost || 0).toFixed(2).replace('.', ',')}"`,
    `"${Number(s.profit || 0).toFixed(2).replace('.', ',')}"`,
    `"${Number(s.marginPercent || 0).toFixed(1).replace('.', ',')}%"`,
    `"${s.receivingStatus || 'aberto'}"`,
    `"${s.date || ''}"`,
    `"${s.deliveryDate || ''}"`
  ].join(';')).join('\n');

  return BOM + header + rows;
}
