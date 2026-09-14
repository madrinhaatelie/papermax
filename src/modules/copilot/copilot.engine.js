/**
 * PAPER MAX - Copilot Engine (Etapa 9)
 * Coleta e estrutura dados reais do sistema para alimentar o Copiloto de IA
 * com restrições estritas de segurança, separação de dados e transparência.
 */

import {
  loadOrders,
  loadProducts,
  loadMaterials,
  loadComponents,
  loadSuppliers,
  loadPurchases,
  loadReceivables,
  loadPayables,
  loadExpenses,
  loadAutomationRules,
  loadAutomationLogs,
  loadNotifications
} from '../../data/storage.js';
import { calculateDashboardMetrics } from '../dashboard/dashboard.js';
import { calculateFinancialMetrics } from '../finance/finance.engine.js';
import { calculateStockBalances, checkOrderStockAvailability, calculateProductCapacity } from '../stock/stock.engine.js';
import { calculateProductIntelligence, INTELLIGENCE_PERIODS } from '../products/products.intelligence.js';

export function getProductionStatusData() {
  const metrics = calculateDashboardMetrics();
  return metrics.operational || {};
}

export function getBlockedOrdersData() {
  const orders = loadOrders();
  return orders.filter(o => (o.status || '').toLowerCase() === 'bloqueado' || (o.production?.currentStage || '') === 'blocked');
}

export function getStockAlertsData() {
  const materials = loadMaterials();
  const components = loadComponents();
  const alerts = [];

  materials.forEach(m => {
    const stock = Number(m.stockQty) || 0;
    const min = Number(m.minStock) || 5;
    if (stock <= min) {
      alerts.push({
        type: 'material',
        name: m.name,
        stock,
        unit: m.unit || 'un',
        minStock: min,
        status: stock === 0 ? 'critico' : 'baixo'
      });
    }
  });

  components.forEach(c => {
    const stock = Number(c.stockQty) || 0;
    const min = Number(c.minStock) || 5;
    if (stock <= min) {
      alerts.push({
        type: 'component',
        name: c.name,
        stock,
        unit: 'un',
        minStock: min,
        status: stock === 0 ? 'critico' : 'baixo'
      });
    }
  });

  return alerts;
}

export function getProductionCapacityData() {
  const products = loadProducts();
  const materials = loadMaterials();
  const components = loadComponents();

  return products.map(p => {
    try {
      const cap = calculateProductCapacity(p, materials, components, true);
      return {
        productId: p.id,
        productName: p.name,
        maxCapacity: cap.maxCapacity,
        limitingItem: cap.limitingItem ? cap.limitingItem.name : 'Nenhum'
      };
    } catch (e) {
      return {
        productId: p.id,
        productName: p.name,
        maxCapacity: 0,
        limitingItem: 'Erro de cálculo'
      };
    }
  });
}

export function getProductRankingData() {
  try {
    const intel = calculateProductIntelligence({ period: INTELLIGENCE_PERIODS.DIAS_30 });
    return {
      ranking: intel.ranking.slice(0, 5),
      highlights: intel.highlights
    };
  } catch (e) {
    return { ranking: [], highlights: {} };
  }
}

export function getFinancialSummaryData() {
  try {
    const metrics = calculateFinancialMetrics();
    return metrics;
  } catch (e) {
    return {};
  }
}

export function getReceivablesData() {
  const receivables = loadReceivables();
  return receivables.filter(r => r.status === 'pendente' || r.status === 'vencido');
}

export function getPayablesData() {
  const payables = loadPayables();
  return payables.filter(p => p.status === 'pendente' || p.status === 'vencido');
}

export function getProductCostData() {
  const products = loadProducts();
  return products.map(p => ({
    name: p.name,
    price: p.price,
    cost: p.cost || 0,
    marginPct: p.price > 0 ? Math.round(((p.price - (p.cost || 0)) / p.price) * 100) : 0
  }));
}

export function getPurchaseSuggestionsData() {
  const alerts = getStockAlertsData();
  const suppliers = loadSuppliers();
  return alerts.map(alert => {
    const supplier = suppliers.find(s => s.id === alert.preferredSupplierId) || suppliers[0];
    return {
      item: alert.name,
      type: alert.type,
      currentStock: alert.stock,
      recommendedQty: Math.max(10, alert.minStock * 2 - alert.stock),
      suggestedSupplier: supplier ? supplier.name : 'Fornecedor padrão'
    };
  });
}

export function buildCopilotContextSnapshot() {
  return {
    timestamp: new Date().toISOString(),
    productionStatus: getProductionStatusData(),
    blockedOrders: getBlockedOrdersData().map(o => ({
      id: o.id,
      code: o.code,
      clientName: o.clientName,
      blockReason: o.blockReason || 'Sem motivo detalhado'
    })),
    stockAlerts: getStockAlertsData(),
    productionCapacity: getProductionCapacityData(),
    productRanking: getProductRankingData(),
    financialSummary: getFinancialSummaryData(),
    pendingReceivables: getReceivablesData().length,
    pendingPayables: getPayablesData().length,
    productCosts: getProductCostData(),
    purchaseSuggestions: getPurchaseSuggestionsData()
  };
}
