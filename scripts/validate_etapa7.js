/**
 * PAPER MAX - Script de Validação Etapa 7
 * Inteligência Comercial de Produtos, Ranking, Tendências, Sazonalidade,
 * Margem Real, Diagnóstico Determinístico e Capacidade Operacional.
 */

import {
  calculateProductIntelligence,
  detectProductSeasonality,
  generateProductDiagnostic,
  exportProductIntelligenceCSV,
  INTELLIGENCE_PERIODS
} from '../src/modules/products/products.intelligence.js';

import {
  calculateDashboardMetrics
} from '../src/modules/dashboard/dashboard.js';

import {
  SEED_ORDERS,
  SEED_PRODUCTS,
  SEED_MATERIALS,
  SEED_COMPONENTS,
  SEED_PURCHASES,
  SEED_EXPENSES
} from '../src/data/seed.js';

import {
  saveOrders,
  saveProducts,
  saveMaterials,
  saveComponents,
  savePurchases,
  saveExpenses,
  loadOrders,
  loadProducts,
  loadMaterials,
  loadComponents
} from '../src/data/storage.js';

// Setup Mock for localStorage in Node environment
const memoryStore = new Map();
global.localStorage = {
  getItem: (key) => memoryStore.get(key) || null,
  setItem: (key, val) => memoryStore.set(key, String(val)),
  removeItem: (key) => memoryStore.delete(key),
  clear: () => memoryStore.clear()
};

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    passedTests++;
    console.log(`✓ [PASS] ${message}`);
  }
}

function runAllTests() {
  console.log('====================================================');
  console.log('🚀 INICIANDO BATERIA DE TESTES: ETAPA 7 (INTELIGÊNCIA COMERCIAL)');
  console.log('====================================================\n');

  // Inicializa Storage com dados reais
  saveOrders(SEED_ORDERS);
  saveProducts(SEED_PRODUCTS);
  saveMaterials(SEED_MATERIALS);
  saveComponents(SEED_COMPONENTS);
  savePurchases(SEED_PURCHASES);
  saveExpenses(SEED_EXPENSES);

  // ----------------------------------------------------
  // TESTE 1: Cálculo e Métricas do Ranking de Produtos
  // ----------------------------------------------------
  console.log('\n--- 1. RANKING DE PRODUTOS & CONSOLIDAÇÃO ---');
  const intel30d = calculateProductIntelligence({ period: INTELLIGENCE_PERIODS.DIAS_30 });
  
  assert(Array.isArray(intel30d.ranking), 'Ranking deve retornar um array de produtos');
  assert(intel30d.ranking.length === SEED_PRODUCTS.length, 'Ranking deve conter todos os produtos do catálogo');
  assert(intel30d.ranking[0].position === 1, 'Primeiro item deve ter posição 1');
  assert(intel30d.ranking[0].qty >= intel30d.ranking[1].qty, 'Ranking padrão por volume deve ser decrescente');

  // Validar colunas financeiras e de custo histórico via snapshot
  intel30d.ranking.forEach(r => {
    assert(r.revenue >= 0, `Receita deve ser >= 0 (Produto: ${r.name})`);
    assert(r.cost >= 0, `Custo deve ser >= 0 (Produto: ${r.name})`);
    assert(r.marginPct >= 0 && r.marginPct <= 100, `Margem % deve estar entre 0 e 100% (Produto: ${r.name}, Margem: ${r.marginPct}%)`);
    assert(typeof r.growthQtyPct === 'number', `Variação de crescimento deve ser numérica (Produto: ${r.name})`);
    assert(typeof r.diagnostic === 'object' && r.diagnostic.headline, `Diagnóstico deve ser gerado (Produto: ${r.name})`);
  });

  // ----------------------------------------------------
  // TESTE 2: Filtros de Período (Hoje, 7d, 30d, 90d, 12m, Todo)
  // ----------------------------------------------------
  console.log('\n--- 2. FILTROS TEMPORAIS E COMPARATIVO COM PERÍODO ANTERIOR ---');
  const periods = [
    INTELLIGENCE_PERIODS.HOJE,
    INTELLIGENCE_PERIODS.DIAS_7,
    INTELLIGENCE_PERIODS.DIAS_30,
    INTELLIGENCE_PERIODS.DIAS_90,
    INTELLIGENCE_PERIODS.MESES_12,
    INTELLIGENCE_PERIODS.TODO_PERIODO
  ];

  periods.forEach(p => {
    const res = calculateProductIntelligence({ period: p });
    assert(res && res.ranking.length > 0, `Cálculo com período ${p} deve ser executado com sucesso`);
  });

  // ----------------------------------------------------
  // TESTE 3: Ordenações Alternativas (Receita, Margem, Lucro, Crescimento, Queda)
  // ----------------------------------------------------
  console.log('\n--- 3. CRITÉRIOS DE ORDENAÇÃO ---');
  const byRevenue = calculateProductIntelligence({ sortBy: 'revenue', sortOrder: 'desc' });
  assert(byRevenue.ranking[0].revenue >= byRevenue.ranking[1].revenue, 'Ordenação por receita deve funcionar');

  const byMargin = calculateProductIntelligence({ sortBy: 'margin', sortOrder: 'desc' });
  assert(byMargin.ranking[0].marginPct >= byMargin.ranking[1].marginPct, 'Ordenação por margem deve funcionar');

  const byProfit = calculateProductIntelligence({ sortBy: 'profit', sortOrder: 'desc' });
  assert(byProfit.ranking[0].profit >= byProfit.ranking[1].profit, 'Ordenação por lucro deve funcionar');

  const byGrowth = calculateProductIntelligence({ sortBy: 'growth', sortOrder: 'desc' });
  assert(byGrowth.ranking[0].growthQtyPct >= byGrowth.ranking[1].growthQtyPct, 'Ordenação por maior crescimento deve funcionar');

  const byDrop = calculateProductIntelligence({ sortBy: 'growth', sortOrder: 'asc' });
  assert(byDrop.ranking[0].growthQtyPct <= byDrop.ranking[1].growthQtyPct, 'Ordenação por maior queda deve funcionar');

  // ----------------------------------------------------
  // TESTE 4: Detecção Determinística de Sazonalidade
  // ----------------------------------------------------
  console.log('\n--- 4. DETECÇÃO DE TENDÊNCIA E SAZONALIDADE ---');
  const allOrders = loadOrders();
  const testProduct = SEED_PRODUCTS[0];
  const seasonality = detectProductSeasonality(testProduct.id, allOrders);

  assert(typeof seasonality.detected === 'boolean', 'Sazonalidade deve conter flag booleana explicável');
  assert(Array.isArray(seasonality.monthlyHistory), 'Histórico mensal deve ser array');
  assert(seasonality.monthlyHistory.length === 12, 'Histórico mensal deve cobrir os 12 meses do ano');
  assert(seasonality.explanations.length > 0, 'Sazonalidade deve ter explicações determinísticas baseadas em dados');

  // ----------------------------------------------------
  // TESTE 5: Integração com Estoque e Capacidade Máxima
  // ----------------------------------------------------
  console.log('\n--- 5. ESTOQUE, CAPACIDADE DE PRODUÇÃO E GARGALO ---');
  intel30d.ranking.forEach(r => {
    assert(typeof r.capacity.maxUnits === 'number', `Capacidade máxima deve ser calculada (Produto: ${r.name})`);
    assert(typeof r.capacity.limitingMaterialName === 'string' || r.capacity.limitingMaterialName === null, `Insumo limitante deve ser identificado (Produto: ${r.name})`);
  });

  // ----------------------------------------------------
  // TESTE 6: Diagnóstico Automatizado e Explicável
  // ----------------------------------------------------
  console.log('\n--- 6. DIAGNÓSTICO DETERMINÍSTICO DE PRODUTO ---');
  const diag = generateProductDiagnostic(intel30d.ranking[0]);
  assert(diag.status !== undefined, 'Diagnóstico deve possuir status comercial');
  assert(diag.recommendation && diag.recommendation.length > 0, 'Diagnóstico deve fornecer recomendação prática');
  assert(Array.isArray(diag.indicators), 'Diagnóstico deve conter lista de indicadores');

  // ----------------------------------------------------
  // TESTE 7: Exportação de CSV da Inteligência Comercial
  // ----------------------------------------------------
  console.log('\n--- 7. EXPORTAÇÃO CSV ---');
  const csvOutput = exportProductIntelligenceCSV(intel30d);
  assert(typeof csvOutput === 'string' && csvOutput.includes('Posição') && csvOutput.includes('Produto'), 'CSV de Inteligência Comercial deve ser gerado com cabeçalhos corretos');


  // ----------------------------------------------------
  // TESTE 8: Integração e Destaques no Dashboard
  // ----------------------------------------------------
  console.log('\n--- 8. DESTAQUES COMERCIAIS NO DASHBOARD ---');
  const dashMetrics = calculateDashboardMetrics();
  assert(dashMetrics.commercial !== undefined, 'Dashboard metrics deve incluir objeto commercial');
  assert(dashMetrics.commercial.bestSeller !== undefined, 'Dashboard deve conter produto mais vendido');
  assert(dashMetrics.commercial.highestGrowth !== undefined, 'Dashboard deve conter produto em maior crescimento');
  assert(dashMetrics.commercial.highestMargin !== undefined, 'Dashboard deve conter produto de maior margem');

  console.log('\n====================================================');
  console.log(`✅ TODOS OS ${passedTests}/${totalTests} TESTES DA ETAPA 7 PASSARAM COM SUCESSO!`);
  console.log('====================================================\n');
}

try {
  runAllTests();
} catch (err) {
  console.error('\n❌ Falha na bateria de testes:', err);
  process.exit(1);
}
