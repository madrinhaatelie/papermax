/**
 * PAPER MAX - Product Commercial Intelligence Engine (Etapa 7)
 * Real data, deterministic calculations, ranking, growth/drop vs previous period,
 * seasonal analysis, margin intelligence, and stock/production capacity connection.
 * Strictly zero hallucinated metrics or generative AI placeholders.
 */

import { loadOrders, loadProducts, loadMaterials, loadComponents } from '../../data/storage.js';
import {
  expandProductComposition,
  convertUnit,
  buildMaterialsMap,
  buildComponentsMap
} from '../stock/stock.engine.js';
import { parseDateBRToISO, formatDateBR } from '../../utils/sanitize.js';
import { generateCSV } from '../../utils/csv.js';

export const INTELLIGENCE_PERIODS = {
  HOJE: 'hoje',
  DIAS_7: '7d',
  DIAS_30: '30d',
  DIAS_90: '90d',
  MESES_12: '12m',
  TODO_PERIODO: 'todo',
  PERSONALIZADO: 'custom'
};

export const SEASONS_LIST = [
  { id: 'volta_aulas', name: 'Volta às Aulas', months: [1, 2], peakLabel: 'Jan / Fev' },
  { id: 'dia_maes', name: 'Dia das Mães', months: [4, 5], peakLabel: 'Abr / Mai' },
  { id: 'dia_namorados', name: 'Dia dos Namorados', months: [5, 6], peakLabel: 'Mai / Jun' },
  { id: 'festa_junina', name: 'Festa Junina', months: [5, 6, 7], peakLabel: 'Mai / Jun / Jul' },
  { id: 'dia_pais', name: 'Dia dos Pais', months: [7, 8], peakLabel: 'Jul / Ago' },
  { id: 'dia_criancas', name: 'Dia das Crianças', months: [9, 10], peakLabel: 'Set / Out' },
  { id: 'natal', name: 'Natal e Fim de Ano', months: [11, 12], peakLabel: 'Nov / Dez' }
];

/**
 * Calcula quantas unidades de um produto podem ser produzidas com base no estoque disponível dos seus insumos (BOM).
 */
export function calculateProductionCapacity(product, materialsMap = {}, componentsMap = {}) {
  if (!product || !Array.isArray(product.composition) || product.composition.length === 0) {
    return null;
  }

  const expanded = expandProductComposition(product, 1, materialsMap, componentsMap);
  const insumos = expanded.flattenedInsumos || [];
  if (insumos.length === 0) return null;

  let minCapacity = Infinity;

  for (const item of insumos) {
    const mat = materialsMap[item.materialId];
    if (!mat) continue;
    const currentStock = Number(mat.currentStock) || 0;
    const requiredPerUnit = Number(item.requiredQty) || 0;
    if (requiredPerUnit > 0) {
      const possible = Math.floor(currentStock / requiredPerUnit);
      if (possible < minCapacity) {
        minCapacity = possible;
      }
    }
  }

  return minCapacity === Infinity ? 0 : Math.max(0, minCapacity);
}

/**
 * Identifica o insumo que atua como gargalo limitante para a produção do produto.
 */
export function identifyBottleneckMaterial(product, materialsMap = {}, componentsMap = {}) {
  if (!product || !Array.isArray(product.composition) || product.composition.length === 0) {
    return null;
  }

  const expanded = expandProductComposition(product, 1, materialsMap, componentsMap);
  const insumos = expanded.flattenedInsumos || [];
  if (insumos.length === 0) return null;

  let bottleneck = null;
  let minCapacity = Infinity;

  for (const item of insumos) {
    const mat = materialsMap[item.materialId];
    if (!mat) continue;
    const currentStock = Number(mat.currentStock) || 0;
    const requiredPerUnit = Number(item.requiredQty) || 0;
    if (requiredPerUnit > 0) {
      const possible = Math.floor(currentStock / requiredPerUnit);
      if (possible < minCapacity) {
        minCapacity = possible;
        bottleneck = {
          materialId: mat.id,
          materialName: mat.name,
          currentStock,
          requiredPerUnit,
          unit: mat.baseUnit || item.unit,
          maxUnits: Math.max(0, possible)
        };
      }
    }
  }

  return bottleneck;
}


/**
 * Converte data BR (DD/MM/AAAA) ou ISO para objeto Date UTC seguro.
 */
function parseDateSafe(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  
  if (typeof dateStr === 'string' && dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      return new Date(y, m, d, 12, 0, 0);
    }
  }

  const iso = new Date(dateStr);
  return isNaN(iso.getTime()) ? null : iso;
}

/**
 * Calcula os limites de datas para o período atual e o período anterior correspondente.
 */
export function getPeriodDateRanges(period = INTELLIGENCE_PERIODS.DIAS_30, customStart = null, customEnd = null) {
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  
  let currentStart = null;
  let currentEnd = todayEnd;
  let previousStart = null;
  let previousEnd = null;
  let daysSpan = 30;

  if (period === INTELLIGENCE_PERIODS.HOJE) {
    currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    daysSpan = 1;
    previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - 1);
    previousEnd = new Date(currentStart.getTime() - 1);
  } else if (period === INTELLIGENCE_PERIODS.DIAS_7) {
    daysSpan = 7;
    currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    previousEnd = new Date(currentStart.getTime() - 1);
    previousStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13, 0, 0, 0, 0);
  } else if (period === INTELLIGENCE_PERIODS.DIAS_30) {
    daysSpan = 30;
    currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
    previousEnd = new Date(currentStart.getTime() - 1);
    previousStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 59, 0, 0, 0, 0);
  } else if (period === INTELLIGENCE_PERIODS.DIAS_90) {
    daysSpan = 90;
    currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89, 0, 0, 0, 0);
    previousEnd = new Date(currentStart.getTime() - 1);
    previousStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 179, 0, 0, 0, 0);
  } else if (period === INTELLIGENCE_PERIODS.MESES_12) {
    daysSpan = 365;
    currentStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 0, 0, 0, 0);
    previousEnd = new Date(currentStart.getTime() - 1);
    previousStart = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate(), 0, 0, 0, 0);
  } else if (period === INTELLIGENCE_PERIODS.PERSONALIZADO && customStart && customEnd) {
    const cs = parseDateSafe(customStart);
    const ce = parseDateSafe(customEnd);
    if (cs && ce) {
      currentStart = new Date(cs.getFullYear(), cs.getMonth(), cs.getDate(), 0, 0, 0, 0);
      currentEnd = new Date(ce.getFullYear(), ce.getMonth(), ce.getDate(), 23, 59, 59, 999);
      const diffMs = currentEnd.getTime() - currentStart.getTime();
      daysSpan = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      previousEnd = new Date(currentStart.getTime() - 1);
      previousStart = new Date(currentStart.getTime() - (daysSpan * 24 * 60 * 60 * 1000));
    }
  } else {
    // TODO_PERIODO: sem data de início
    currentStart = null;
    currentEnd = todayEnd;
    previousStart = null;
    previousEnd = null;
    daysSpan = null;
  }

  return {
    period,
    daysSpan,
    currentStart,
    currentEnd,
    previousStart,
    previousEnd
  };
}

/**
 * Calcula a análise de ranking, crescimento e tendências comerciais de todos os produtos.
 */
export function calculateProductIntelligence(options = {}) {
  const {
    period = INTELLIGENCE_PERIODS.DIAS_30,
    customStart = null,
    customEnd = null,
    sortBy = 'quantity', // 'quantity', 'revenue', 'profit', 'margin', 'growth', 'drop'
    sortOrder = 'desc',
    categoryId = null
  } = options;

  const orders = loadOrders();
  const products = loadProducts();
  const materials = loadMaterials();
  const components = loadComponents();

  const materialsMap = buildMaterialsMap(materials);
  const componentsMap = buildComponentsMap(components);

  const ranges = getPeriodDateRanges(period, customStart, customEnd);

  // Mapear vendas por produto no período atual e no período anterior
  const currentSalesByProd = new Map();
  const previousSalesByProd = new Map();
  const lifetimeSalesByProd = new Map();

  // Inicializar acumuladores para todos os produtos existentes
  products.forEach(p => {
    const initialStats = () => ({
      qty: 0,
      orderCount: 0,
      revenue: 0,
      cost: 0,
      dates: []
    });
    currentSalesByProd.set(p.id, initialStats());
    previousSalesByProd.set(p.id, initialStats());
    lifetimeSalesByProd.set(p.id, initialStats());
  });

  // Processar cada pedido real
  orders.forEach(o => {
    // Ignorar pedidos cancelados
    if (o.status === 'cancelado') return;

    const prodId = o.productId || (products.find(p => p.name === o.productTitle)?.id);
    if (!prodId || !currentSalesByProd.has(prodId)) return;

    const orderDate = parseDateSafe(o.orderDate || o.createdAt);
    if (!orderDate) return;

    const qty = Number(o.qty) || 1;
    // Utiliza estritamente o Product Snapshot preservado no pedido
    const snap = o.productSnapshot || {};
    const unitPrice = Number(snap.price) !== undefined && !isNaN(Number(snap.price))
      ? Number(snap.price)
      : (Number(o.price) || Number(products.find(p => p.id === prodId)?.price) || 0);

    const unitCost = Number(snap.cost) !== undefined && !isNaN(Number(snap.cost))
      ? Number(snap.cost)
      : (Number(products.find(p => p.id === prodId)?.cost) || 0);

    const totalRevenue = qty * unitPrice;
    const totalCost = qty * unitCost;

    // Lifetime
    const lt = lifetimeSalesByProd.get(prodId);
    lt.qty += qty;
    lt.orderCount += 1;
    lt.revenue += totalRevenue;
    lt.cost += totalCost;
    lt.dates.push(orderDate);

    // Período Atual
    const inCurrent = ranges.currentStart === null || (orderDate >= ranges.currentStart && orderDate <= ranges.currentEnd);
    if (inCurrent) {
      const cur = currentSalesByProd.get(prodId);
      cur.qty += qty;
      cur.orderCount += 1;
      cur.revenue += totalRevenue;
      cur.cost += totalCost;
      cur.dates.push(orderDate);
    }

    // Período Anterior
    const inPrevious = ranges.previousStart !== null && (orderDate >= ranges.previousStart && orderDate <= ranges.previousEnd);
    if (inPrevious) {
      const prev = previousSalesByProd.get(prodId);
      prev.qty += qty;
      prev.orderCount += 1;
      prev.revenue += totalRevenue;
      prev.cost += totalCost;
      prev.dates.push(orderDate);
    }
  });

  // Calcular métricas, capacidade de estoque e diagnósticos para cada produto
  let analyzedProducts = products.map(product => {
    const cur = currentSalesByProd.get(product.id) || { qty: 0, orderCount: 0, revenue: 0, cost: 0, dates: [] };
    const prev = previousSalesByProd.get(product.id) || { qty: 0, orderCount: 0, revenue: 0, cost: 0, dates: [] };
    const lt = lifetimeSalesByProd.get(product.id) || { qty: 0, orderCount: 0, revenue: 0, cost: 0, dates: [] };

    const qty = cur.qty;
    const orderCount = cur.orderCount;
    const revenue = cur.revenue;
    const cost = cur.cost;
    const profit = revenue - cost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const avgPrice = qty > 0 ? (revenue / qty) : (Number(product.price) || 0);
    const avgCost = qty > 0 ? (cost / qty) : (Number(product.cost) || 0);

    // Comparativo com período anterior
    const prevQty = prev.qty;
    const prevRevenue = prev.revenue;
    let growthQtyPct = 0;
    let growthRevenuePct = 0;
    let hasSufficientComparisonData = false;
    let comparisonLabel = 'Sem histórico comparativo';

    if (ranges.period === INTELLIGENCE_PERIODS.TODO_PERIODO) {
      hasSufficientComparisonData = false;
      comparisonLabel = 'Visão de todo o histórico';
    } else if (prevQty > 0) {
      hasSufficientComparisonData = true;
      growthQtyPct = ((qty - prevQty) / prevQty) * 100;
      growthRevenuePct = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
      const sign = growthQtyPct >= 0 ? '+' : '';
      comparisonLabel = `${sign}${growthQtyPct.toFixed(1)}% vs período anterior`;
    } else if (qty > 0 && prevQty === 0) {
      hasSufficientComparisonData = true;
      growthQtyPct = 100; // Novo no período
      comparisonLabel = 'Novo / Primeiro volume no período';
    } else {
      hasSufficientComparisonData = false;
      comparisonLabel = 'Sem vendas em ambos períodos';
    }

    // Integração com Estoque Inteligente e Capacidade Produtiva (Etapa 5)
    let stockCapacity = null;
    let bottleneck = null;
    let compositionCount = 0;

    if (Array.isArray(product.composition) && product.composition.length > 0) {
      compositionCount = product.composition.length;
      try {
        const expanded = expandProductComposition(product, materialsMap, componentsMap);
        stockCapacity = calculateProductionCapacity(product, materialsMap, componentsMap);
        bottleneck = identifyBottleneckMaterial(product, materialsMap, componentsMap);
      } catch (err) {
        stockCapacity = null;
        bottleneck = null;
      }
    }

    // Análise de Sazonalidade do Ateliê
    const seasonalInsight = detectProductSeasonality(product, lt.dates);

    // Diagnósticos e Explicações Determinísticas
    const diagnostic = generateProductDiagnostic({
      qty,
      prevQty,
      growthQtyPct,
      margin,
      profit,
      revenue,
      hasComparison: hasSufficientComparisonData,
      stockCapacity,
      bottleneck,
      daysSpan: ranges.daysSpan,
      period: ranges.period
    });

    return {
      id: product.id,
      productId: product.id,
      name: product.name,
      categoryId: product.categoryId || '',
      status: product.status || 'ativo',
      price: Number(product.price) || 0,
      catalogCost: Number(product.cost) || 0,
      compositionCount,
      // Métricas do Período
      qty,
      orderCount,
      revenue,
      cost,
      profit,
      margin,
      marginPct: margin,
      avgPrice,
      avgCost,
      // Comparativo
      prevQty,
      prevRevenue,
      growthQtyPct,
      growthRevenuePct,
      hasSufficientComparisonData,
      comparisonLabel,
      // Estoque & Produção
      stockCapacity,
      bottleneck,
      capacity: {
        maxUnits: stockCapacity !== null ? stockCapacity : 0,
        limitingMaterialName: bottleneck ? bottleneck.materialName : null
      },
      // Sazonalidade
      seasonalInsight,
      // Diagnóstico
      diagnostic
    };
  });

  // Filtro por Categoria se solicitado
  if (categoryId) {
    analyzedProducts = analyzedProducts.filter(p => p.categoryId === categoryId);
  }

  // Ordenação
  analyzedProducts.sort((a, b) => {
    let valA = 0;
    let valB = 0;

    switch (sortBy) {
      case 'quantity':
        valA = a.qty;
        valB = b.qty;
        break;
      case 'revenue':
        valA = a.revenue;
        valB = b.revenue;
        break;
      case 'profit':
        valA = a.profit;
        valB = b.profit;
        break;
      case 'margin':
        valA = a.margin;
        valB = b.margin;
        break;
      case 'growth':
        valA = a.growthQtyPct;
        valB = b.growthQtyPct;
        break;
      case 'drop':
        // Menor crescimento / maior queda primeiro
        valA = a.growthQtyPct;
        valB = b.growthQtyPct;
        return valA - valB;
      default:
        valA = a.qty;
        valB = b.qty;
    }

    return sortOrder === 'asc' ? valA - valB : valB - valA;
  });

  // Atribuir posições no ranking
  analyzedProducts.forEach((p, idx) => {
    p.position = idx + 1;
  });

  // Resumo Geral da Análise
  const totalQtySold = analyzedProducts.reduce((sum, p) => sum + p.qty, 0);
  const totalRevenue = analyzedProducts.reduce((sum, p) => sum + p.revenue, 0);
  const totalCost = analyzedProducts.reduce((sum, p) => sum + p.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Destaques Inteligentes
  const bestSeller = [...analyzedProducts].sort((a, b) => b.qty - a.qty)[0] || null;
  const highestGrowth = [...analyzedProducts].filter(p => p.qty > 0).sort((a, b) => b.growthQtyPct - a.growthQtyPct)[0] || null;
  const highestMargin = [...analyzedProducts].filter(p => p.qty > 0).sort((a, b) => b.margin - a.margin)[0] || null;
  const stockAlerts = analyzedProducts.filter(p => p.stockCapacity !== null && p.qty > 0 && p.stockCapacity < p.qty);

  return {
    period: ranges.period,
    periodLabel: getPeriodLabel(ranges.period),
    daysSpan: ranges.daysSpan,
    totalQtySold,
    totalRevenue,
    totalCost,
    totalProfit,
    overallMargin,
    productsCount: analyzedProducts.length,
    ranking: analyzedProducts,
    products: analyzedProducts,
    highlights: {
      bestSeller: bestSeller && bestSeller.qty > 0 ? bestSeller : null,
      highestGrowth: highestGrowth && highestGrowth.growthQtyPct > 0 ? highestGrowth : null,
      highestMargin: highestMargin && highestMargin.margin > 0 ? highestMargin : null,
      stockAlerts
    }
  };
}

/**
 * Detecta correlações sazonais reais do ateliê a partir de datas de pedidos ou histórico.
 */
export function detectProductSeasonality(productOrId, datesOrOrders = []) {
  let datesArray = [];
  if (Array.isArray(datesOrOrders)) {
    if (datesOrOrders.length > 0 && typeof datesOrOrders[0] === 'object' && !(datesOrOrders[0] instanceof Date)) {
      // É uma lista de pedidos
      const targetId = typeof productOrId === 'string' ? productOrId : productOrId?.id;
      const targetName = typeof productOrId === 'object' ? productOrId?.name : null;
      const filtered = datesOrOrders.filter(o => 
        (targetId && (o.productId === targetId || o.id === targetId)) ||
        (targetName && o.productTitle === targetName)
      );
      datesArray = filtered.map(o => parseDateSafe(o.date || o.createdAt)).filter(Boolean);
    } else {
      // É uma lista de datas
      datesArray = datesOrOrders.map(d => parseDateSafe(d)).filter(Boolean);
    }
  }

  // Agrupar contagem de vendas por mês (1 a 12)
  const monthCounts = new Array(13).fill(0);
  datesArray.forEach(d => {
    if (d instanceof Date && !isNaN(d.getTime())) {
      const m = d.getMonth() + 1; // 1-12
      monthCounts[m]++;
    }
  });

  const monthlyHistory = [];
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  for (let m = 1; m <= 12; m++) {
    monthlyHistory.push({
      month: m,
      monthName: monthNames[m - 1],
      ordersCount: monthCounts[m]
    });
  }

  if (datesArray.length < 3) {
    return {
      detected: false,
      hasSeasonality: false,
      confidence: 'insuficiente',
      seasonName: null,
      monthlyHistory,
      explanations: ['Histórico com menos de 3 pedidos para cálculo de sazonalidade estatística.'],
      description: 'Histórico insuficiente para comprovar sazonalidade estatística.'
    };
  }

  const totalOrders = datesArray.length;
  let topSeason = null;
  let topPercentage = 0;

  SEASONS_LIST.forEach(season => {
    const sumSeason = season.months.reduce((sum, m) => sum + monthCounts[m], 0);
    const pct = (sumSeason / totalOrders) * 100;
    if (pct > 40 && pct > topPercentage && sumSeason >= 2) {
      topPercentage = pct;
      topSeason = season;
    }
  });

  if (topSeason) {
    const explanations = [
      `Concentração de ${Math.round(topPercentage)}% dos pedidos no período de ${topSeason.name} (${topSeason.peakLabel}).`,
      `Padrão identificado com ${datesArray.length} pedidos analisados historicamente.`
    ];
    return {
      detected: true,
      hasSeasonality: true,
      confidence: topPercentage > 60 ? 'alta' : 'moderada',
      seasonName: topSeason.name,
      peakLabel: topSeason.peakLabel,
      percentage: Math.round(topPercentage),
      monthlyHistory,
      explanations,
      description: `Apresenta concentração histórica de ${Math.round(topPercentage)}% dos pedidos no período de ${topSeason.name} (${topSeason.peakLabel}).`
    };
  }

  return {
    detected: false,
    hasSeasonality: false,
    confidence: 'neutra',
    seasonName: null,
    monthlyHistory,
    explanations: ['Demanda distribuída ao longo dos meses sem pico sazonal isolado.'],
    description: 'Demanda com distribuição linear contínua ao longo dos meses.'
  };
}

/**
 * Gera diagnóstico determinístico, objetivo e explicável.
 */
export function generateProductDiagnostic(params) {
  const p = params || {};
  const qty = p.qty !== undefined ? p.qty : (p.quantity || 0);
  const prevQty = p.prevQty || 0;
  const growthQtyPct = p.growthQtyPct || 0;
  const margin = p.margin !== undefined ? p.margin : (p.marginPct || 0);
  const hasComparison = p.hasComparison !== undefined ? p.hasComparison : (p.hasSufficientComparisonData || false);
  const stockCapacity = p.stockCapacity !== undefined ? p.stockCapacity : (p.capacity?.maxUnits ?? null);
  const bottleneck = p.bottleneck || null;

  const badges = [];
  const indicators = [];
  let headline = 'Produto Ativo';
  let summary = '';
  let recommendation = '';
  let actionAdvice = '';
  let alertLevel = 'normal'; // 'normal', 'success', 'warning', 'danger'
  let status = 'normal';

  // 1. Diagnóstico de Demanda e Volume
  if (qty === 0) {
    badges.push({ label: 'Sem Vendas no Período', type: 'neutral' });
    indicators.push('Sem pedidos recentes');
    headline = 'Sem Vendas no Período';
    summary = 'Nenhum pedido registrado no período analisado.';
    recommendation = 'Avalie promoções, combos ou destaque na vitrine para reativar o interesse do cliente.';
    actionAdvice = recommendation;
    status = 'inativo_recente';
  } else if (hasComparison && growthQtyPct >= 25) {
    badges.push({ label: `Em Alta (+${growthQtyPct.toFixed(0)}%)`, type: 'growth' });
    indicators.push(`Crescimento de +${growthQtyPct.toFixed(1)}%`);
    headline = `Forte Crescimento (+${growthQtyPct.toFixed(0)}%)`;
    summary = `Vendeu ${qty} un (+${growthQtyPct.toFixed(1)}% em relação às ${prevQty} un do período anterior).`;
    recommendation = 'Garantir disponibilidade de insumos e manter posições de destaque comercial.';
    actionAdvice = recommendation;
    alertLevel = 'success';
    status = 'em_alta';
  } else if (hasComparison && growthQtyPct <= -20) {
    badges.push({ label: `Em Queda (${growthQtyPct.toFixed(0)}%)`, type: 'drop' });
    indicators.push(`Queda de ${growthQtyPct.toFixed(1)}%`);
    headline = `Queda de Demanda (${growthQtyPct.toFixed(0)}%)`;
    summary = `Vendas reduziram para ${qty} un (-${Math.abs(growthQtyPct).toFixed(1)}% vs ${prevQty} un anteriores).`;
    recommendation = 'Verificar se houve aumento de preço ou sazonalidade desfavorável no período.';
    actionAdvice = recommendation;
    alertLevel = 'warning';
    status = 'em_queda';
  } else if (hasComparison && Math.abs(growthQtyPct) < 10) {
    badges.push({ label: 'Volume Estável', type: 'stable' });
    indicators.push('Volume estável');
    headline = 'Demanda Estável';
    summary = `Demanda estável com ${qty} un vendidas (~${growthQtyPct >= 0 ? '+' : ''}${growthQtyPct.toFixed(0)}%).`;
    recommendation = 'Manter rotina padrão de reposição de insumos.';
    actionAdvice = recommendation;
    status = 'estavel';
  } else {
    badges.push({ label: 'Ativo', type: 'neutral' });
    indicators.push('Volume ativo');
    summary = `Registrou ${qty} un vendidas no período selecionado.`;
    recommendation = 'Acompanhar evolução nas próximas semanas.';
    actionAdvice = recommendation;
  }

  // 2. Diagnóstico de Margem de Lucro
  if (qty > 0) {
    if (margin >= 55) {
      badges.push({ label: `Alta Margem (${margin.toFixed(0)}%)`, type: 'high_margin' });
      indicators.push(`Margem excelente (${margin.toFixed(1)}%)`);
      if (!recommendation) {
        recommendation = `Excelente margem de contribuição (${margin.toFixed(1)}%). Produto rentável com alto retorno.`;
      }
      actionAdvice = recommendation;
    } else if (margin < 25 && margin > 0) {
      badges.push({ label: `Baixa Margem (${margin.toFixed(0)}%)`, type: 'low_margin' });
      indicators.push(`Margem baixa (${margin.toFixed(1)}%)`);
      alertLevel = alertLevel === 'danger' ? 'danger' : 'warning';
      recommendation = `Atenção à margem reduzida (${margin.toFixed(1)}%). Recomenda-se revisar custos de insumos ou reajustar preço de venda.`;
      actionAdvice = recommendation;
    }
  }

  // 3. Conexão com Estoque & Capacidade de Produção
  if (stockCapacity !== null && qty > 0) {
    if (stockCapacity < qty) {
      badges.push({ label: 'Gargalo de Estoque', type: 'stock_shortage' });
      indicators.push('Estoque abaixo do volume de vendas');
      alertLevel = 'danger';
      const botName = bottleneck ? bottleneck.materialName : 'insumos';
      recommendation = `⚠ Capacidade atual (${stockCapacity} un) é insuficiente para a demanda recente (${qty} un). Gargalo: ${botName}. Providenciar compra de reposição.`;
      actionAdvice = recommendation;
    } else {
      badges.push({ label: `Estoque p/ ${stockCapacity} un`, type: 'stock_ok' });
      indicators.push(`Capacidade: ${stockCapacity} un`);
    }
  }

  return {
    status,
    headline,
    recommendation,
    indicators,
    badges,
    summary,
    actionAdvice,
    alertLevel
  };
}

/**
 * Retorna rótulo amigável para o período.
 */
export function getPeriodLabel(period) {

  switch (period) {
    case INTELLIGENCE_PERIODS.HOJE: return 'Hoje';
    case INTELLIGENCE_PERIODS.DIAS_7: return 'Últimos 7 dias';
    case INTELLIGENCE_PERIODS.DIAS_30: return 'Últimos 30 dias';
    case INTELLIGENCE_PERIODS.DIAS_90: return 'Últimos 90 dias';
    case INTELLIGENCE_PERIODS.MESES_12: return 'Últimos 12 meses';
    case INTELLIGENCE_PERIODS.TODO_PERIODO: return 'Todo o Período';
    case INTELLIGENCE_PERIODS.PERSONALIZADO: return 'Período Personalizado';
    default: return 'Últimos 30 dias';
  }
}

/**
 * Exporta o Ranking Comercial de Produtos e Análise de Tendências em formato CSV.
 */
export function exportProductIntelligenceCSV(options = {}) {
  const result = calculateProductIntelligence({
    ...options,
    period: options.period || INTELLIGENCE_PERIODS.TODO_PERIODO
  });

  const headers = [
    { key: 'posicao', label: 'Posição' },
    { key: 'produto', label: 'Produto' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'quantidade', label: 'Qtd Vendida (un)' },
    { key: 'pedidos', label: 'Nº Pedidos' },
    { key: 'receita', label: 'Receita Total (R$)' },
    { key: 'custo', label: 'Custo Total (R$)' },
    { key: 'lucro', label: 'Lucro Líquido (R$)' },
    { key: 'margem', label: 'Margem (%)' },
    { key: 'preco_medio', label: 'Preço Médio (R$)' },
    { key: 'crescimento_pct', label: 'Crescimento Qtd (%)' },
    { key: 'capacidade_estoque', label: 'Capacidade Produtiva Estoque (un)' },
    { key: 'gargalo_estoque', label: 'Material Gargalo' },
    { key: 'sazonalidade', label: 'Pico Sazonal' },
    { key: 'diagnostico', label: 'Diagnóstico Comercial' }
  ];

  const rows = result.products.map((p, idx) => ({
    posicao: `${idx + 1}º`,
    produto: p.name,
    categoria: p.categoryId || 'Geral',
    quantidade: p.qty,
    pedidos: p.orderCount,
    receita: p.revenue.toFixed(2).replace('.', ','),
    custo: p.cost.toFixed(2).replace('.', ','),
    lucro: p.profit.toFixed(2).replace('.', ','),
    margem: `${p.margin.toFixed(1)}%`,
    preco_medio: p.avgPrice.toFixed(2).replace('.', ','),
    crescimento_pct: p.hasSufficientComparisonData ? `${p.growthQtyPct.toFixed(1)}%` : '—',
    capacidade_estoque: p.stockCapacity !== null ? p.stockCapacity : 'N/A',
    gargalo_estoque: p.bottleneck ? p.bottleneck.materialName : 'Nenhum',
    sazonalidade: p.seasonalInsight.hasSeasonality ? `${p.seasonalInsight.seasonName} (${p.seasonalInsight.peakLabel})` : 'Linear',
    diagnostico: p.diagnostic.summary
  }));

  return generateCSV(headers, rows, ';');
}
