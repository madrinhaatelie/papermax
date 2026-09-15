/**
 * PAPER MAX - Dashboard Module (Etapa 4)
 * Derives operational metrics, active orders, lifetime stats, monthly chart,
 * and the operational production pipeline: "O que preciso produzir hoje?".
 * Strictly from real persisted data. Zero invented or static numbers.
 */

import { loadOrders, loadProducts, loadPurchases, loadExpenses } from '../../data/storage.js';
import { formatDateBR } from '../../utils/sanitize.js';
import { calculateProductIntelligence, INTELLIGENCE_PERIODS } from '../products/products.intelligence.js';
import { isOrderActive } from '../orders/orders.js';

export function calculateDashboardMetrics(customOrders = null) {

  const orders = customOrders || loadOrders();
  const products = loadProducts();
  const todayBR = formatDateBR(new Date());

  // 1. Stat cards
  let todayCount = 0;
  let inProdCount = 0;
  let pendingCount = 0;
  let readyCount = 0;

  // 2. Operational production pipeline: "O que preciso produzir hoje?"
  let awaitingCount = 0;
  let impressaoCount = 0;
  let corteCount = 0;
  let vincoCount = 0;
  let montagemCount = 0;
  let acabamentoCount = 0;
  let conferenciaCount = 0;
  let embalagemCount = 0;
  let prontoCount = 0;
  let blockedCount = 0;

  const pendingPdfOrders = [];
  const qcAlertOrders = [];
  const urgentOrders = [];

  orders.forEach(o => {
    // Orders today: either created today or delivery date is today
    const orderCreatedBR = o.createdAt ? formatDateBR(o.createdAt) : o.orderDate;
    if (o.orderDate === todayBR || o.deliveryDate === todayBR || orderCreatedBR === todayBR) {
      todayCount++;
    }

    const s = (o.status || '').toLowerCase();
    const stage = (o.production?.currentStage || '').toLowerCase();
    const hasPdf = Array.isArray(o.generatedFiles) && o.generatedFiles.length > 0;

    // Stat cards summary
    if (s === 'blue' || s === 'orange' || s === 'imprimindo' || s === 'em_corte' || s === 'em_vinco' || s === 'em_montagem' || s === 'em_acabamento' || s === 'em_conferencia' || s === 'em_embalagem' || s === 'em_personalizacao') {
      inProdCount++;
    } else if (s === 'yellow' || s === 'red' || s === 'aguardando_aprovacao' || s === 'aguardando_impressao' || s === 'bloqueado') {
      pendingCount++;
    } else if (s === 'green' || s === 'pronto') {
      readyCount++;
    }

    // Operational stages
    if (s === 'aguardando_aprovacao' || s === 'yellow' || stage === 'aprovacao') {
      awaitingCount++;
    }
    if (stage === 'impressao' || s === 'aguardando_impressao' || s === 'imprimindo') {
      impressaoCount++;
    }
    if (stage === 'corte' || s === 'em_corte') {
      corteCount++;
    }
    if (stage === 'vinco' || s === 'em_vinco') {
      vincoCount++;
    }
    if (stage === 'montagem' || s === 'em_montagem') {
      montagemCount++;
    }
    if (stage === 'acabamento' || s === 'em_acabamento') {
      acabamentoCount++;
    }
    if (stage === 'conferencia' || s === 'em_conferencia' || s === 'orange') {
      conferenciaCount++;
    }
    if (stage === 'embalagem' || s === 'em_embalagem') {
      embalagemCount++;
    }
    if (stage === 'pronto' || s === 'green' || s === 'pronto') {
      prontoCount++;
    }

    if (s === 'bloqueado' || s === 'red') {
      blockedCount++;
    }

    // Operational alerts & pendencies
    if ((s !== 'aguardando_aprovacao' && s !== 'yellow' && s !== 'pronto' && s !== 'entregue' && s !== 'cancelado') && !hasPdf) {
      pendingPdfOrders.push(o);
    }

    if (o.production?.qualityControl?.status === 'reprovado' || s === 'bloqueado') {
      qcAlertOrders.push(o);
    }

    if (o.deliveryDate === todayBR || o.production?.printJob?.priority === 'urgente' || o.status === 'orange') {
      urgentOrders.push(o);
    }
  });

  // 3. Lifetime performance strictly from real records
  let totalRevenue = 0;
  let totalCost = 0;
  let soldProductsCount = 0;

  orders.forEach(o => {
    const qty = Number(o.qty) || 1;
    const price = Number(o.productSnapshot?.price ?? o.price ?? 0);
    const cost = Number(o.productSnapshot?.cost ?? o.cost ?? 0);
    totalRevenue += qty * price;
    totalCost += qty * cost;

    const s = (o.status || '').toLowerCase();
    const stage = (o.production?.currentStage || '').toLowerCase();
    if (s === 'green' || s === 'pronto' || s === 'entregue' || s === 'concluido' || stage === 'pronto' || stage === 'expedicao') {
      soldProductsCount += qty;
    }
  });

  // Bloco 05: Lucro como 50% da receita total acumulada
  const profit50 = totalRevenue * 0.5;
  const estimatedProfit = Math.max(0, totalRevenue - totalCost);
  const productsCount = products.length;

  // Bloco 05: Total investido na empresa (compras de insumos e despesas operacionais)
  let totalInvested = 0;
  try {
    const purchases = loadPurchases();
    if (Array.isArray(purchases)) {
      purchases.forEach(p => {
        totalInvested += Number(p.totalAmount ?? p.total ?? 0);
      });
    }
  } catch (e) {}
  try {
    const expenses = loadExpenses();
    if (Array.isArray(expenses)) {
      expenses.forEach(ex => {
        totalInvested += Number(ex.amount ?? 0);
      });
    }
  } catch (e) {}

  // 4. Active orders - Unified rule with orders list
  const activeOrders = orders.filter(isOrderActive);

  // 5. Monthly chart volumes (Real 12 months for current year)
  const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();
  
  const all12Months = [];
  for (let m = 0; m < 12; m++) {
    all12Months.push({
      year: currentYear,
      monthIdx: m,
      label: monthLabels[m],
      isCurrent: m === currentMonthIdx
    });
  }

  const monthVolumes = {};
  all12Months.forEach(m => {
    monthVolumes[`${m.year}-${m.monthIdx}`] = 0;
  });

  orders.forEach(o => {
    let orderDateObj = null;
    if (o.orderDate) {
      const parts = o.orderDate.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        orderDateObj = new Date(year, month, day);
      }
    } else if (o.createdAt) {
      orderDateObj = new Date(o.createdAt);
    }

    if (orderDateObj && !isNaN(orderDateObj.getTime())) {
      const key = `${orderDateObj.getFullYear()}-${orderDateObj.getMonth()}`;
      if (monthVolumes[key] !== undefined) {
        monthVolumes[key] += (Number(o.qty) || 1);
      }
    }
  });

  const chartData = all12Months.map(m => ({
    label: m.label,
    value: monthVolumes[`${m.year}-${m.monthIdx}`] || 0,
    isCurrent: m.isCurrent
  }));

  // 6. Product Commercial Intelligence Highlights (Etapa 7)
  let commercial = {
    bestSeller: null,
    highestGrowth: null,
    highestMargin: null,
    stockAlerts: []
  };

  try {
    const intel = calculateProductIntelligence({ period: INTELLIGENCE_PERIODS.DIAS_30 });
    commercial = intel.highlights;
  } catch (err) {
    // Graceful fallback
  }

  return {
    todayCount,
    inProdCount,
    pendingCount,
    readyCount,
    totalRevenue,
    profit50,
    soldProductsCount,
    totalInvested,
    estimatedProfit,
    productsCount,
    activeOrders,
    chartData,
    commercial,
    // Evolved Operational Pipeline
    operational: {
      awaitingCount,
      impressaoCount,
      printQueueCount: impressaoCount,
      corteCount,
      finishingCount: corteCount,
      vincoCount,
      montagemCount,
      acabamentoCount,
      conferenciaCount,
      embalagemCount,
      prontoCount,
      readyCount: prontoCount,
      blockedCount,
      pendingPdfOrders,
      qcAlertOrders,
      urgentOrders
    }
  };
}

