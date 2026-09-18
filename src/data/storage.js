/**
 * PAPER MAX - Centralized Versioned Storage & Real Autosave Layer
 * Strictly adheres to:
 * - Versioned localStorage keys: papermax.*.v1
 * - Debounced persistence ("Você trabalha. O PAPER MAX salva.")
 * - Real status notifications (↻ Salvando..., ✓ Salvo automaticamente, ⚠ Erro)
 * - Safe migration of legacy data
 */

import { 
  SEED_CATEGORIES, 
  SEED_PRODUCTS, 
  SEED_ORDERS, 
  SEED_SUPPLIERS, 
  SEED_MATERIALS, 
  SEED_COMPONENTS, 
  SEED_PURCHASES, 
  SEED_MOVEMENTS, 
  SEED_EXPENSES,
  SEED_RECEIVABLES,
  SEED_PAYABLES,
  createSnapshotFromProduct 
} from './seed.js';
import { ensureOrderProductionState } from '../modules/production/production.engine.js';

export const STORAGE_KEYS = {
  ORDERS: 'papermax.orders.v1',
  PRODUCTS: 'papermax.products.v1',
  CATEGORIES: 'papermax.categories.v1',
  SETTINGS: 'papermax.settings.v1',
  MATERIALS: 'papermax.materials.v1',
  COMPONENTS: 'papermax.components.v1',
  SUPPLIERS: 'papermax.suppliers.v1',
  PURCHASES: 'papermax.purchases.v1',
  MOVEMENTS: 'papermax.movements.v1',
  INVENTORIES: 'papermax.inventories.v1',
  EXPENSES: 'papermax.expenses.v1',
  RECEIVABLES: 'papermax.receivables.v1',
  PAYABLES: 'papermax.payables.v1',
  AUTOMATION_RULES: 'papermax.automation_rules.v1',
  AUTOMATION_LOGS: 'papermax.automation_logs.v1',
  AUTOMATION_EVENTS: 'papermax.automation_events.v1',
  NOTIFICATIONS: 'papermax.notifications.v1',
  PRINT_QUEUE: 'papermax.print_queue.v1',
  AUDIT_LOGS: 'papermax.audit_logs.v1',
  DOC_CONFIGS: 'papermax.doc_configs.v1',
  ALERTS_CONFIG: 'papermax.alerts_config.v1'
};

// Autosave Status: 'idle' | 'saving' | 'saved' | 'error'
let currentSaveStatus = 'saved';
const statusListeners = new Set();
let debounceTimer = null;
const pendingSaves = new Map();

/**
 * PAPER MAX - Safe LocalStorage Access Wrapper
 */
export function getLocalStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Retrieves the raw JSON string for a storage key.
 * First checks pendingSaves (in-memory unpersisted debounce buffer) to guarantee
 * that any read operation immediately following a save gets the most up-to-date data,
 * even before the 350ms persistence debounce expires.
 */
export function getStorageItem(key) {
  if (pendingSaves.has(key)) {
    return pendingSaves.get(key);
  }
  try {
    const storage = getLocalStorage();
    return storage ? storage.getItem(key) : null;
  } catch (e) {
    console.warn('[Storage] Error accessing localStorage for key:', key, e);
    return null;
  }
}

export function onSaveStatusChange(listener) {
  statusListeners.add(listener);
  listener(currentSaveStatus);
  return () => statusListeners.delete(listener);
}

function updateStatus(status) {
  currentSaveStatus = status;
  statusListeners.forEach(fn => {
    try {
      fn(status);
    } catch (e) {
      console.error('[Storage] Error in status listener:', e);
    }
  });
}

function executePendingSaves() {
  if (pendingSaves.size === 0) return;

  try {
    const storage = getLocalStorage();
    if (storage) {
      for (const [key, jsonString] of pendingSaves.entries()) {
        storage.setItem(key, jsonString);
      }
    }
    pendingSaves.clear();
    updateStatus('saved');
  } catch (err) {
    console.error('[Storage] Error persisting data to localStorage:', err);
    updateStatus('error');
  }
}

function scheduleSave(key, data, immediate = false) {
  try {
    const serialized = JSON.stringify(data);
    pendingSaves.set(key, serialized);

    if (immediate) {
      if (debounceTimer) clearTimeout(debounceTimer);
      executePendingSaves();
    } else {
      updateStatus('saving');
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        executePendingSaves();
      }, 350);
    }
  } catch (err) {
    console.error('[Storage] Serialization error:', err);
    updateStatus('error');
  }
}

// ==========================================
// CATEGORIES
// ==========================================
export function loadCategories() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.CATEGORIES);
    if (!raw) {
      saveCategories([], true);
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveCategories(categories, immediate = false) {
  scheduleSave(STORAGE_KEYS.CATEGORIES, categories, immediate);
}

// ==========================================
// PRODUCTS
// ==========================================
export function loadProducts() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.PRODUCTS);
    if (!raw) {
      saveProducts([], true);
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveProducts(products, immediate = false) {
  scheduleSave(STORAGE_KEYS.PRODUCTS, products, immediate);
}

// ==========================================
// ORDERS & MIGRATION
// ==========================================
export function loadOrders() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.ORDERS);
    if (!raw) {
      saveOrders([], true);
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      saveOrders([], true);
      return [];
    }

    // Smooth migration: guarantee every order has required fields & snapshot fallback
    const products = loadProducts();
    const migrated = parsed.map(order => {
      const o = { ...order };
      if (!o.number) {
        o.number = o.id ? Number(o.id) : 1000;
      }
      if (!o.customer) {
        o.customer = 'Cliente Balcão';
      }
      if (!o.productTitle) {
        o.productTitle = o.title ? o.title.replace(/^Pedido\s+\d+\s*·\s*/, '') : 'Item Personalizado';
      }
      if (!o.productSnapshot) {
        const matchingProd = products.find(p => p.id === o.productId || p.name === o.productTitle);
        o.productSnapshot = matchingProd 
          ? createSnapshotFromProduct(matchingProd)
          : {
              productId: o.productId || 'prod_legado',
              productName: o.productTitle,
              configurationVersion: 1,
              personalizationFields: [],
              changeOptions: [],
              editor: { textAreas: [], elementAreas: [], colorAreas: [] },
              snapshotTimestamp: o.createdAt || new Date().toISOString()
            };
      }
      ensureOrderProductionState(o);

      // Hydrate payment history if not already present
      if (!Array.isArray(o.payments)) {
        if (Array.isArray(o.financial?.payments) && o.financial.payments.length > 0) {
          o.payments = o.financial.payments;
        } else if (Array.isArray(o.financial?.paymentMethods) && o.financial.paymentMethods.length > 0) {
          o.payments = o.financial.paymentMethods.map((pm, idx) => ({
            id: 'pay_' + (o.id || o.number) + '_' + idx,
            method: (pm.method || 'PIX').toUpperCase(),
            amount: Number(pm.amount || 0),
            date: o.orderDate || '14/09/26',
            time: '18:00',
            datetime: `${o.orderDate || '14/09/26'} às 18:00`,
            timestamp: o.createdAt || new Date().toISOString()
          })).filter(p => p.amount > 0);
        } else if (Number(o.paidAmount || o.financial?.paidAmount || 0) > 0) {
          const amt = Number(o.paidAmount || o.financial?.paidAmount || 0);
          o.payments = [{
            id: 'pay_' + (o.id || o.number) + '_1',
            method: (o.paymentMethod || o.financial?.paymentMethod || 'PIX').toUpperCase(),
            amount: amt,
            date: o.orderDate || '14/09/26',
            time: '18:00',
            datetime: `${o.orderDate || '14/09/26'} às 18:00`,
            timestamp: o.createdAt || new Date().toISOString()
          }];
        } else {
          o.payments = [];
        }
      }

      return o;
    });

    return migrated;
  } catch (e) {
    return [];
  }
}

export function saveOrders(orders, immediate = false) {
  scheduleSave(STORAGE_KEYS.ORDERS, orders, immediate);
}

// ==========================================
// SETTINGS
// ==========================================
export const DEFAULT_SETTINGS = {
  // Identidade do Ateliê
  atelierName: 'Ateliê Papel',
  ownerName: 'Papelaria Criativa',
  logo: '',
  phone: '(11) 9 8765-4321',
  whatsapp: '(11) 9 8765-4321',
  email: 'contato@ateliepapel.com.br',
  address: 'Rua das Flores, 123 - Centro - São Paulo/SP - CEP: 01001-000',
  instagram: '@ateliepapelmax',
  docNumber: '12.345.678/0001-90',
  docVisibility: {
    atelierName: true,
    ownerName: true,
    logo: true,
    phone: true,
    whatsapp: true,
    email: true,
    address: true,
    instagram: true,
    docNumber: true
  },
  // Interface
  theme: 'light',
  density: 'compact',
  showLeds: true,
  dateFormat: 'dd/mm/aaaa',
  // Impressão
  printer: {
    defaultPrinter: 'Térmica 58mm (Padrão)',
    thermalWidth: '58mm',
    margins: '3mm',
    customHeader: 'PAPER MAX · ATELIÊ DE PAPELARIA PERSONALIZADA',
    customFooter: 'Obrigado pela preferência! Feito com amor e carinho.',
    printLogo: true
  },
  printBehavior: {
    autoSendToQueue: true,
    autoPrintWhenAvailable: false,
    askBeforePrint: true,
    allowReprint: true
  },
  // Automações
  automationSwitches: {
    // Pedidos
    autoDocOnCreate: true,
    autoDocOnApprove: true,
    autoOS: true,
    autoLabels: true,
    autoReceipt: true,
    autoSendToPrintQueue: true,
    // Estoque
    alertMinStock: true,
    alertMissingMaterial: true,
    reserveStockOnApprove: true,
    deductStockStage: 'embalagem',
    // Produção
    autoAdvanceStage: true,
    createBlockPendency: true,
    createReworkOnQCFail: true,
    // Financeiro
    createReceivableOnSale: true,
    createPayableOnPurchase: true,
    autoCashFlow: true
  },
  currency: 'BRL',
  motivationalPhrases: [
    'criar projetos encantadores com carinho',
    'organizar produções e fidelizar clientes',
    'entregar pedidos impecáveis e pontuais',
    'encantar clientes em cada detalhe personalizado'
  ]
};

export function loadSettings() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      saveSettings(DEFAULT_SETTINGS, true);
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      docVisibility: { ...DEFAULT_SETTINGS.docVisibility, ...(parsed.docVisibility || {}) },
      printer: { ...DEFAULT_SETTINGS.printer, ...(parsed.printer || {}) },
      printBehavior: { ...DEFAULT_SETTINGS.printBehavior, ...(parsed.printBehavior || {}) },
      automationSwitches: { ...DEFAULT_SETTINGS.automationSwitches, ...(parsed.automationSwitches || {}) }
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings, immediate = false) {
  scheduleSave(STORAGE_KEYS.SETTINGS, settings, immediate);
}

// ==========================================
// MATERIALS (INSUMOS)
// ==========================================
export function loadMaterials() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.MATERIALS);
    if (!raw) {
      saveMaterials([], true);
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveMaterials(materials, immediate = false) {
  scheduleSave(STORAGE_KEYS.MATERIALS, materials, immediate);
}

// ==========================================
// COMPONENTS (COMPONENTES)
// ==========================================
export function loadComponents() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.COMPONENTS);
    if (!raw) {
      saveComponents([], true);
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveComponents(components, immediate = false) {
  scheduleSave(STORAGE_KEYS.COMPONENTS, components, immediate);
}

// ==========================================
// SUPPLIERS (FORNECEDORES)
// ==========================================
export function loadSuppliers() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.SUPPLIERS);
    if (!raw) {
      saveSuppliers([], true);
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveSuppliers(suppliers, immediate = false) {
  scheduleSave(STORAGE_KEYS.SUPPLIERS, suppliers, immediate);
}

// ==========================================
// PURCHASES (COMPRAS)
// ==========================================
export function loadPurchases() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.PURCHASES);
    if (!raw) {
      savePurchases([], true);
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function savePurchases(purchases, immediate = false) {
  scheduleSave(STORAGE_KEYS.PURCHASES, purchases, immediate);
}

// ==========================================
// MOVEMENTS (MOVIMENTAÇÕES)
// ==========================================
export function loadMovements() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.MOVEMENTS);
    if (!raw) {
      saveMovements([], true);
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveMovements(movements, immediate = false) {
  scheduleSave(STORAGE_KEYS.MOVEMENTS, movements, immediate);
}

// ==========================================
// INVENTORIES (INVENTÁRIOS)
// ==========================================
export function loadInventories() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.INVENTORIES);
    if (!raw) {
      saveInventories([], true);
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveInventories(inventories, immediate = false) {
  scheduleSave(STORAGE_KEYS.INVENTORIES, inventories, immediate);
}

// ==========================================
// EXPENSES (DESPESAS OPERACIONAIS)
// ==========================================
export function loadExpenses() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.EXPENSES);
    if (!raw) {
      saveExpenses([], true);
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveExpenses(expenses, immediate = false) {
  scheduleSave(STORAGE_KEYS.EXPENSES, expenses, immediate);
}

// ==========================================
// RECEIVABLES (CONTAS A RECEBER)
// ==========================================
export function loadReceivables() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.RECEIVABLES);
    if (!raw) {
      saveReceivables([], true);
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveReceivables(receivables, immediate = false) {
  scheduleSave(STORAGE_KEYS.RECEIVABLES, receivables, immediate);
}

// ==========================================
// PAYABLES (CONTAS A PAGAR)
// ==========================================
export function loadPayables() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.PAYABLES);
    if (!raw) {
      savePayables([], true);
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function savePayables(payables, immediate = false) {
  scheduleSave(STORAGE_KEYS.PAYABLES, payables, immediate);
}

// ==========================================
// AUTOMATION RULES
// ==========================================
export function loadAutomationRules() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.AUTOMATION_RULES);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

export function saveAutomationRules(rules, immediate = false) {
  scheduleSave(STORAGE_KEYS.AUTOMATION_RULES, rules, immediate);
}

// ==========================================
// AUTOMATION LOGS (AUDITORIA)
// ==========================================
export function loadAutomationLogs() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.AUTOMATION_LOGS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveAutomationLogs(logs, immediate = false) {
  scheduleSave(STORAGE_KEYS.AUTOMATION_LOGS, logs, immediate);
}

// ==========================================
// AUTOMATION PROCESSED EVENTS (IDEMPOTÊNCIA)
// ==========================================
export function loadAutomationEvents() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.AUTOMATION_EVENTS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (e) {
    return {};
  }
}

export function saveAutomationEvents(events, immediate = false) {
  scheduleSave(STORAGE_KEYS.AUTOMATION_EVENTS, events, immediate);
}

// ==========================================
// NOTIFICATIONS (CENTRAL DE ALERTAS INTERNOS)
// ==========================================
export function loadNotifications() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.NOTIFICATIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveNotifications(notifications, immediate = false) {
  scheduleSave(STORAGE_KEYS.NOTIFICATIONS, notifications, immediate);
}

// ==========================================
// PRINT QUEUE (FILA DE IMPRESSÃO)
// ==========================================
export const SEED_PRINT_QUEUE = [];

export function loadPrintQueue() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.PRINT_QUEUE);
    if (!raw) {
      savePrintQueue([], true);
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function savePrintQueue(queue, immediate = false) {
  scheduleSave(STORAGE_KEYS.PRINT_QUEUE, queue, immediate);
}

// ==========================================
// AUDIT LOGS (AUDITORIA E LOGS)
// ==========================================
export const SEED_AUDIT_LOGS = [];

export function loadAuditLogs() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.AUDIT_LOGS);
    if (!raw) {
      saveAuditLogs([], true);
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveAuditLogs(logs, immediate = false) {
  scheduleSave(STORAGE_KEYS.AUDIT_LOGS, logs, immediate);
}

// ==========================================
// LIMPEZA TOTAL DE DADOS (USO REAL)
// ==========================================
export function clearAllSystemData(keepSettings = true) {
  saveOrders([], true);
  saveProducts([], true);
  saveCategories([], true);
  saveMaterials([], true);
  saveComponents([], true);
  saveSuppliers([], true);
  savePurchases([], true);
  saveMovements([], true);
  saveInventories([], true);
  saveExpenses([], true);
  saveReceivables([], true);
  savePayables([], true);
  savePrintQueue([], true);
  saveNotifications([], true);
  saveAutomationLogs([], true);
  saveAutomationEvents({}, true);
  saveAuditLogs([], true);

  const storage = getLocalStorage();
  if (storage) {
    storage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]));
    storage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify([]));
    storage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify([]));
    storage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify([]));
    storage.setItem(STORAGE_KEYS.COMPONENTS, JSON.stringify([]));
    storage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify([]));
    storage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify([]));
    storage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify([]));
    storage.setItem(STORAGE_KEYS.INVENTORIES, JSON.stringify([]));
    storage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify([]));
    storage.setItem(STORAGE_KEYS.RECEIVABLES, JSON.stringify([]));
    storage.setItem(STORAGE_KEYS.PAYABLES, JSON.stringify([]));
    storage.setItem(STORAGE_KEYS.PRINT_QUEUE, JSON.stringify([]));
    storage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
    storage.setItem(STORAGE_KEYS.AUTOMATION_LOGS, JSON.stringify([]));
    storage.setItem(STORAGE_KEYS.AUTOMATION_EVENTS, JSON.stringify({}));
    storage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([]));
    storage.setItem('papermax.clean_production_ready.v1', 'true');
  }
}

// ==========================================
// DOCUMENT CONFIGURATIONS (DOCUMENTOS)
// ==========================================
export const DEFAULT_DOC_CONFIGS = {
  os: {
    title: 'Ordem de Serviço (O.S.)',
    showCustomer: true,
    showDeliveryDate: true,
    showEventDate: true,
    showAddress: true,
    showItems: true,
    showPersonalization: true,
    showFinancial: true,
    showObservations: true,
    showSignatureLine: true,
    signatureText: 'Assinatura do Responsável / Retirada',
    paperSize: 'A4',
    fontSize: '12px'
  },
  receipt: {
    title: 'Cupom Não Fiscal',
    format: '58mm',
    showHeader: true,
    showItems: true,
    showFinancial: true,
    showCustomer: true,
    showFooterMsg: true,
    footerMessage: 'Agradecemos a confiança! Feito com carinho.'
  },
  summary: {
    title: 'Resumo do Pedido',
    showItems: true,
    showPhotos: true,
    showProductionStage: true,
    showFinancial: true
  },
  packageLabel: {
    title: 'Etiqueta de Embalagem',
    size: '100x150mm',
    showSender: true,
    showRecipient: true,
    showOrderNumber: true,
    showQty: true,
    showFragileWarning: true,
    showQrCode: true,
    showBarcode: true
  },
  techPdf: {
    title: 'PDF Técnico & Gabarito',
    showBleedMarks: true,
    showCutLines: true,
    showCreaseLines: true,
    showColorPalettes: true,
    showDimensions: true
  },
  productLabel: {
    title: 'Etiqueta de Produto',
    size: '50x30mm',
    model: 'Padrao',
    perSheet: 24,
    showCode: true,
    showName: true,
    showOrder: true,
    showCustomer: true,
    showQty: true,
    showQrCode: true,
    showBarcode: true,
    showPrice: true
  },
  materialLabel: {
    title: 'Etiqueta de Controle Interno de Insumo',
    size: '50x30mm',
    showName: true,
    showInternalCode: true,
    showCategory: true,
    showUnit: true,
    showSupplier: true,
    showBatch: true,
    showEntryDate: true,
    showCost: true,
    showStock: true,
    showLocation: true,
    defaultLocation: 'Armário 02 · Gaveta 04',
    showBarcode: true
  }
};

export function loadDocConfigs() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.DOC_CONFIGS);
    if (!raw) {
      saveDocConfigs(DEFAULT_DOC_CONFIGS, true);
      return DEFAULT_DOC_CONFIGS;
    }
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_DOC_CONFIGS, ...parsed };
  } catch (e) {
    console.warn('[Storage] Error loading doc configs:', e);
    return DEFAULT_DOC_CONFIGS;
  }
}

export function saveDocConfigs(configs, immediate = false) {
  scheduleSave(STORAGE_KEYS.DOC_CONFIGS, configs, immediate);
}

// ==========================================
// ALERTS CONFIGURATION (ALERTAS)
// ==========================================
export const DEFAULT_ALERTS_CONFIG = [
  {
    id: 'alert_min_stock',
    name: 'Estoque mínimo atingido',
    type: 'stock_min',
    active: true,
    priority: 'alta',
    condition: 'Estoque atual <= Estoque mínimo',
    message: 'Insumo com estoque abaixo ou igual ao limite mínimo.'
  },
  {
    id: 'alert_missing_material',
    name: 'Falta de material para pedido',
    type: 'stock_missing',
    active: true,
    priority: 'alta',
    condition: 'Materiais insuficientes para pedidos ativos',
    message: 'Falta de insumos para produção do pedido.'
  },
  {
    id: 'alert_delivery_near',
    name: 'Pedido próximo da entrega',
    type: 'delivery_near',
    active: true,
    priority: 'media',
    daysAdvance: 2,
    condition: 'Prazo de entrega em até 2 dias',
    message: 'Pedido próximo do prazo final de entrega.'
  },
  {
    id: 'alert_delivery_overdue',
    name: 'Pedido com entrega atrasada',
    type: 'delivery_overdue',
    active: true,
    priority: 'alta',
    condition: 'Data limite expirada e pedido não entregue',
    message: 'Pedido atrasado necessitando prioridade máxima.'
  },
  {
    id: 'alert_pending_payment',
    name: 'Pagamento pendente em pedido',
    type: 'payment_pending',
    active: true,
    priority: 'media',
    condition: 'Valor restante > 0',
    message: 'Saldo em aberto pendente de recebimento.'
  },
  {
    id: 'alert_print_queue_pending',
    name: 'Documento aguardando impressão',
    type: 'print_pending',
    active: true,
    priority: 'baixa',
    condition: 'Documentos na fila com status Aguardando',
    message: 'Documentos na fila de impressão prontos para emissão.'
  },
  {
    id: 'alert_production_blocked',
    name: 'Problema / Bloqueio na produção',
    type: 'production_block',
    active: true,
    priority: 'alta',
    condition: 'Status Bloqueado ou Não Conformidade no CQ',
    message: 'Interrupção na linha de produção requer intervenção.'
  }
];

export function loadAlertsConfig() {
  try {
    const raw = getStorageItem(STORAGE_KEYS.ALERTS_CONFIG);
    if (!raw) {
      saveAlertsConfig(DEFAULT_ALERTS_CONFIG, true);
      return DEFAULT_ALERTS_CONFIG;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_ALERTS_CONFIG;
  } catch (e) {
    console.warn('[Storage] Error loading alerts config:', e);
    return DEFAULT_ALERTS_CONFIG;
  }
}

export function saveAlertsConfig(config, immediate = false) {
  scheduleSave(STORAGE_KEYS.ALERTS_CONFIG, config, immediate);
}



