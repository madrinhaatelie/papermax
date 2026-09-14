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
  NOTIFICATIONS: 'papermax.notifications.v1'
};

// Autosave Status: 'idle' | 'saving' | 'saved' | 'error'
let currentSaveStatus = 'saved';
const statusListeners = new Set();
let debounceTimer = null;
const pendingSaves = new Map();

/**
 * Retrieves the raw JSON string for a storage key.
 * First checks pendingSaves (in-memory unpersisted debounce buffer) to guarantee
 * that any read operation immediately following a save gets the most up-to-date data,
 * even before the 350ms persistence debounce expires.
 */
function getStorageItem(key) {
  if (pendingSaves.has(key)) {
    return pendingSaves.get(key);
  }
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
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
    if (typeof localStorage !== 'undefined') {
      for (const [key, jsonString] of pendingSaves.entries()) {
        localStorage.setItem(key, jsonString);
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
      saveCategories(SEED_CATEGORIES, true);
      return SEED_CATEGORIES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveCategories(SEED_CATEGORIES, true);
      return SEED_CATEGORIES;
    }
    return parsed;
  } catch (e) {
    console.warn('[Storage] Error loading categories, fallback to seed:', e);
    return SEED_CATEGORIES;
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
      saveProducts(SEED_PRODUCTS, true);
      return SEED_PRODUCTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveProducts(SEED_PRODUCTS, true);
      return SEED_PRODUCTS;
    }
    return parsed;
  } catch (e) {
    console.warn('[Storage] Error loading products, fallback to seed:', e);
    return SEED_PRODUCTS;
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
      saveOrders(SEED_ORDERS, true);
      return SEED_ORDERS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveOrders(SEED_ORDERS, true);
      return SEED_ORDERS;
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
      return o;
    });

    return migrated;
  } catch (e) {
    console.warn('[Storage] Error loading orders, fallback to seed:', e);
    return SEED_ORDERS;
  }
}

export function saveOrders(orders, immediate = false) {
  scheduleSave(STORAGE_KEYS.ORDERS, orders, immediate);
}

// ==========================================
// SETTINGS
// ==========================================
const DEFAULT_SETTINGS = {
  atelierName: 'Ateliê Papel',
  ownerName: 'Papelaria Criativa',
  currency: 'BRL',
  theme: 'light',
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
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
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
      saveMaterials(SEED_MATERIALS, true);
      return SEED_MATERIALS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveMaterials(SEED_MATERIALS, true);
      return SEED_MATERIALS;
    }
    return parsed;
  } catch (e) {
    console.warn('[Storage] Error loading materials, fallback to seed:', e);
    return SEED_MATERIALS;
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
      saveComponents(SEED_COMPONENTS, true);
      return SEED_COMPONENTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveComponents(SEED_COMPONENTS, true);
      return SEED_COMPONENTS;
    }
    return parsed;
  } catch (e) {
    console.warn('[Storage] Error loading components, fallback to seed:', e);
    return SEED_COMPONENTS;
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
      saveSuppliers(SEED_SUPPLIERS, true);
      return SEED_SUPPLIERS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveSuppliers(SEED_SUPPLIERS, true);
      return SEED_SUPPLIERS;
    }
    return parsed;
  } catch (e) {
    console.warn('[Storage] Error loading suppliers, fallback to seed:', e);
    return SEED_SUPPLIERS;
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
      savePurchases(SEED_PURCHASES, true);
      return SEED_PURCHASES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      savePurchases(SEED_PURCHASES, true);
      return SEED_PURCHASES;
    }
    return parsed;
  } catch (e) {
    console.warn('[Storage] Error loading purchases, fallback to seed:', e);
    return SEED_PURCHASES;
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
      saveMovements(SEED_MOVEMENTS, true);
      return SEED_MOVEMENTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      saveMovements(SEED_MOVEMENTS, true);
      return SEED_MOVEMENTS;
    }
    return parsed;
  } catch (e) {
    console.warn('[Storage] Error loading movements, fallback to seed:', e);
    return SEED_MOVEMENTS;
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
    if (!Array.isArray(parsed)) {
      saveInventories([], true);
      return [];
    }
    return parsed;
  } catch (e) {
    console.warn('[Storage] Error loading inventories:', e);
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
      saveExpenses(SEED_EXPENSES, true);
      return SEED_EXPENSES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      saveExpenses(SEED_EXPENSES, true);
      return SEED_EXPENSES;
    }
    return parsed;
  } catch (e) {
    console.warn('[Storage] Error loading expenses, fallback to seed:', e);
    return SEED_EXPENSES;
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
      saveReceivables(SEED_RECEIVABLES, true);
      return SEED_RECEIVABLES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      saveReceivables(SEED_RECEIVABLES, true);
      return SEED_RECEIVABLES;
    }
    return parsed;
  } catch (e) {
    console.warn('[Storage] Error loading receivables, fallback to seed:', e);
    return SEED_RECEIVABLES;
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
      savePayables(SEED_PAYABLES, true);
      return SEED_PAYABLES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      savePayables(SEED_PAYABLES, true);
      return SEED_PAYABLES;
    }
    return parsed;
  } catch (e) {
    console.warn('[Storage] Error loading payables, fallback to seed:', e);
    return SEED_PAYABLES;
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
    console.warn('[Storage] Error loading automation rules:', e);
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
    console.warn('[Storage] Error loading automation logs:', e);
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
    console.warn('[Storage] Error loading automation events:', e);
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
    console.warn('[Storage] Error loading notifications:', e);
    return [];
  }
}

export function saveNotifications(notifications, immediate = false) {
  scheduleSave(STORAGE_KEYS.NOTIFICATIONS, notifications, immediate);
}



