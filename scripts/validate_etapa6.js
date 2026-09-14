/**
 * PAPER MAX - Script de Validação Etapa 6.1
 * Validação, Integridade, Idempotência e Fechamento do Módulo Financeiro Integrado
 * Cobrindo todos os fluxos: Pedido->Venda->Recebimento, Compra->Estoque->Contas a Pagar,
 * Motor de Custos (BOM), Product Snapshot, Realizado x Previsto, DRE Operacional,
 * Idempotência, Despesas, CSVs, Persistência e Dashboard.
 */

import {
  calculateFinancialMetrics,
  getSalesFromOrders,
  syncReceivablesWithOrders,
  syncPayablesWithPurchases,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  payExpense,
  getReceivables,
  receiveReceivable,
  updateReceivable,
  deleteReceivable,
  getPayables,
  payPayable,
  updatePayable,
  deletePayable,
  getDetailedCostsAnalysis,
  exportExpensesCSV,
  importExpensesCSV,
  exportReceivablesCSV,
  importReceivablesCSV,
  exportPayablesCSV,
  importPayablesCSV,
  exportSalesCSV,
  FINANCIAL_PERIODS
} from '../src/modules/finance/finance.engine.js';

import {
  calculateComponentCost,
  expandProductComposition,
  buildMaterialsMap,
  buildComponentsMap,
  receivePurchase
} from '../src/modules/stock/stock.engine.js';

import {
  SEED_ORDERS,
  SEED_PRODUCTS,
  SEED_MATERIALS,
  SEED_COMPONENTS,
  SEED_SUPPLIERS,
  SEED_PURCHASES,
  SEED_EXPENSES
} from '../src/data/seed.js';

import { calculateDashboardMetrics } from '../src/modules/dashboard/dashboard.js';
import { formatDateBR } from '../src/utils/sanitize.js';

// Setup Mock for localStorage in Node environment
const memoryStore = new Map();
globalThis.localStorage = {
  getItem: (key) => memoryStore.get(key) || null,
  setItem: (key, val) => memoryStore.set(key, String(val)),
  removeItem: (key) => memoryStore.delete(key),
  clear: () => memoryStore.clear()
};

async function runValidationSuite() {
  console.log('=====================================================');
  console.log('  PAPER MAX — VALIDAÇÃO ETAPA 6.1');
  console.log('  Integridade, Idempotência e Fechamento Financeiro');
  console.log('=====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✓ [PASS] ${message}`);
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      throw new Error(`Falha no teste: ${message}`);
    }
  }

  // Helper to initialize fresh data in memoryStore
  function resetStorage(initialData = {}) {
    memoryStore.clear();
    memoryStore.set('papermax_orders', JSON.stringify(initialData.orders || JSON.parse(JSON.stringify(SEED_ORDERS))));
    memoryStore.set('papermax_products', JSON.stringify(initialData.products || JSON.parse(JSON.stringify(SEED_PRODUCTS))));
    memoryStore.set('papermax_materials', JSON.stringify(initialData.materials || JSON.parse(JSON.stringify(SEED_MATERIALS))));
    memoryStore.set('papermax_components', JSON.stringify(initialData.components || JSON.parse(JSON.stringify(SEED_COMPONENTS))));
    memoryStore.set('papermax_suppliers', JSON.stringify(initialData.suppliers || JSON.parse(JSON.stringify(SEED_SUPPLIERS))));
    memoryStore.set('papermax_purchases', JSON.stringify(initialData.purchases || JSON.parse(JSON.stringify(SEED_PURCHASES))));
    memoryStore.set('papermax_expenses', JSON.stringify(initialData.expenses || JSON.parse(JSON.stringify(SEED_EXPENSES))));
    memoryStore.set('papermax_receivables', JSON.stringify(initialData.receivables || []));
    memoryStore.set('papermax_payables', JSON.stringify(initialData.payables || []));
  }

  // -------------------------------------------------------------
  // TESTE 1: PEDIDO → VENDA → RECEBIMENTO
  // -------------------------------------------------------------
  console.log('--- TESTE 1: Pedido → Venda → Recebimento ---');
  resetStorage();

  const salesInitial = getSalesFromOrders();
  assert(salesInitial.length === SEED_ORDERS.length, 'Vendas derivadas de pedidos com quantidade correta');

  // Sync receivables
  const recs = syncReceivablesWithOrders();
  assert(recs.length === SEED_ORDERS.length, 'Contas a receber criadas para todos os pedidos');

  // Encontrar um pedido em aberto e receber
  const openRec = recs.find(r => r.status === 'aberto');
  assert(!!openRec, 'Encontrada conta a receber com status aberto');
  
  const recResult = receiveReceivable(openRec.id, {
    paidDate: '10/09/2026',
    paymentMethod: 'Pix',
    notes: 'Recebido via Pix à vista'
  });
  assert(recResult.success && !recResult.alreadyReceived, 'Baixa de recebimento realizada com sucesso');

  const updatedRec = getReceivables().find(r => r.id === openRec.id);
  assert(updatedRec.status === 'recebido', 'Status da conta a receber atualizado para "recebido"');
  assert(updatedRec.paidDate === '10/09/2026', 'Data do recebimento gravada corretamente');

  // Testar idempotência de recebimento
  const recSecond = receiveReceivable(openRec.id, { paidDate: '10/09/2026' });
  assert(recSecond.alreadyReceived === true, 'Segunda tentativa de recebimento é estritamente idempotente');

  // -------------------------------------------------------------
  // TESTE 2: COMPRA → ESTOQUE → CONTAS A PAGAR
  // -------------------------------------------------------------
  console.log('\n--- TESTE 2: Compra → Estoque → Contas a Pagar ---');
  resetStorage();

  const payables = syncPayablesWithPurchases();
  assert(payables.length === SEED_PURCHASES.length, 'Contas a pagar sincronizadas com compras existentes');

  const openPay = payables.find(p => p.status === 'aberto');
  assert(!!openPay, 'Encontrada conta a pagar vinculada à compra em aberto');

  const payResult = payPayable(openPay.id, {
    paidDate: '11/09/2026',
    paymentMethod: 'Boleto',
    notes: 'Boleto pago pelo banco'
  });
  assert(payResult.success && !payResult.alreadyPaid, 'Pagamento de conta a pagar registrado com sucesso');

  const updatedPay = getPayables().find(p => p.id === openPay.id);
  assert(updatedPay.status === 'pago', 'Status atualizado para pago');
  assert(updatedPay.paidDate === '11/09/2026', 'Data de pagamento gravada');

  // Idempotência do pagamento
  const paySecond = payPayable(openPay.id);
  assert(paySecond.alreadyPaid === true, 'Segunda tentativa de pagamento de conta a pagar é idempotente');

  // -------------------------------------------------------------
  // TESTE 3: MOTOR DE CUSTOS (Produto → Componente → Insumo)
  // -------------------------------------------------------------
  console.log('\n--- TESTE 3: Motor de Custos Técnico (BOM) ---');
  
  const materials = JSON.parse(memoryStore.get('papermax_materials'));
  const components = JSON.parse(memoryStore.get('papermax_components'));
  const products = JSON.parse(memoryStore.get('papermax_products'));

  const matMap = buildMaterialsMap(materials);
  const compMap = buildComponentsMap(components);

  // Teste de cálculo do componente Flor de Cetim
  const florComp = components.find(c => c.name.includes('Flor'));
  assert(!!florComp, 'Componente Flor encontrado');
  const compCost = calculateComponentCost(florComp, matMap, compMap);
  assert(compCost > 0, `Custo do componente calculado via motor de estoque: R$ ${compCost.toFixed(3)}`);

  // Teste de produto com composição técnica BOM
  const prodWithBom = products.find(p => Array.isArray(p.composition) && p.composition.length > 0);
  assert(!!prodWithBom, 'Produto com composição BOM encontrado');
  const bomDetails = expandProductComposition(prodWithBom, matMap, compMap);
  assert(bomDetails.totalCost > 0, `Custo total do produto calculado via BOM recursivo: R$ ${bomDetails.totalCost.toFixed(2)}`);

  const detailedAnalysis = getDetailedCostsAnalysis();
  assert(detailedAnalysis.products.length === products.length, 'Análise detalhada de custos de produtos gerada');
  assert(detailedAnalysis.components.length === components.length, 'Análise de componentes gerada');
  assert(detailedAnalysis.materials.length === materials.length, 'Análise de insumos gerada');

  // -------------------------------------------------------------
  // TESTE 4: PRODUCT SNAPSHOT (Imutabilidade Histórica)
  // -------------------------------------------------------------
  console.log('\n--- TESTE 4: Product Snapshot Histórico ---');
  resetStorage();

  // Pedido 1048 possui snapshot com price: 8.50 e cost: 3.20
  const orders = JSON.parse(memoryStore.get('papermax_orders'));
  const targetOrder = orders.find(o => o.number === 1048 || o.number === '1048');
  assert(!!targetOrder, 'Pedido 1048 encontrado');
  assert(targetOrder.productSnapshot.price === 8.50, 'Snapshot original tem preço R$ 8,50');
  assert(targetOrder.productSnapshot.cost === 3.20, 'Snapshot original tem custo R$ 3,20');

  // Simular alteração drástica no cadastro atual do produto
  const prods = JSON.parse(memoryStore.get('papermax_products'));
  const prodIdx = prods.findIndex(p => p.id === targetOrder.productId);
  if (prodIdx !== -1) {
    prods[prodIdx].price = 999.00;
    prods[prodIdx].cost = 500.00;
    memoryStore.set('papermax_products', JSON.stringify(prods));
  }

  // Recalcular vendas a partir dos pedidos
  const salesAfterProductChange = getSalesFromOrders();
  const sale1048 = salesAfterProductChange.find(s => s.orderNumber === 1048 || s.orderNumber === '1048');
  assert(sale1048.unitPrice === 8.50, 'Preço da venda histórica continua R$ 8,50 pelo Snapshot');
  assert(sale1048.unitCost === 3.20, 'Custo da venda histórica continua R$ 3,20 pelo Snapshot');
  assert(sale1048.totalSale === sale1048.qty * 8.50, 'Total da venda histórica permanece inalterado');
  assert(sale1048.profit === (sale1048.qty * 8.50) - (sale1048.qty * 3.20), 'Lucro histórico preservado com precisão');

  // -------------------------------------------------------------
  // TESTE 5: REALIZADO × PREVISTO
  // -------------------------------------------------------------
  console.log('\n--- TESTE 5: Separação Realizado × Previsto ---');
  resetStorage();

  const metricsAll = calculateFinancialMetrics({ period: FINANCIAL_PERIODS.TODO_PERIODO });
  
  assert(typeof metricsAll.entradasRealizadas === 'number', 'Entradas realizadas apuradas');
  assert(typeof metricsAll.saidasRealizadas === 'number', 'Saídas realizadas apuradas');
  assert(typeof metricsAll.totalAReceber === 'number', 'Total a receber apurado');
  assert(typeof metricsAll.totalAPagar === 'number', 'Total a pagar apurado');
  assert(typeof metricsAll.saldoRealizado === 'number', 'Saldo realizado apurado');

  // Título em aberto NÃO pode compor entradas realizadas
  const recList = getReceivables();
  const openReceivablesSum = recList.filter(r => r.status === 'aberto').reduce((sum, r) => sum + r.amount, 0);
  const paidReceivablesSum = recList.filter(r => r.status === 'recebido').reduce((sum, r) => sum + r.amount, 0);
  
  assert(Math.abs(metricsAll.entradasRealizadas - paidReceivablesSum) < 0.01, 'Entradas realizadas contabilizam SOMENTE recebidos');
  assert(Math.abs(metricsAll.totalAReceber - openReceivablesSum) < 0.01, 'Total a receber contabiliza SOMENTE em aberto/vencido');

  // -------------------------------------------------------------
  // TESTE 6: DRE OPERACIONAL E FILTROS DE PERÍODO
  // -------------------------------------------------------------
  console.log('\n--- TESTE 6: DRE Operacional ---');
  
  assert(metricsAll.totalVendas >= 0, 'Receita bruta calculada');
  assert(metricsAll.totalCustoMercadorias >= 0, 'Custo de Mercadorias (CPV/CMV) calculado');
  assert(Math.abs(metricsAll.lucroBrutoVendas - (metricsAll.totalVendas - metricsAll.totalCustoMercadorias)) < 0.01, 'Lucro Bruto = Receita - CPV');
  assert(Math.abs(metricsAll.resultadoOperacional - (metricsAll.lucroBrutoVendas - metricsAll.saidasDespesas)) < 0.01, 'Resultado Operacional = Lucro Bruto - Despesas');

  // Filtro por período
  const metricsEsteMes = calculateFinancialMetrics({ period: FINANCIAL_PERIODS.ESTE_MES });
  assert(metricsEsteMes !== null, 'DRE com filtro "Este Mês" apurada com sucesso');

  // -------------------------------------------------------------
  // TESTE 7: FLUXO FINANCEIRO & ATUALIZAÇÃO AUTOMÁTICA
  // -------------------------------------------------------------
  console.log('\n--- TESTE 7: Fluxo Financeiro e Reatividade ---');
  resetStorage();

  const metricsBeforeExpense = calculateFinancialMetrics({ period: FINANCIAL_PERIODS.TODO_PERIODO });
  
  // Criar uma despesa paga de R$ 50,00
  createExpense({
    description: 'Teste Taxa de Cartão',
    category: 'Operacional',
    amount: 50.00,
    status: 'pago',
    paidDate: formatDateBR(new Date()),
    paymentMethod: 'Pix'
  });

  const metricsAfterExpense = calculateFinancialMetrics({ period: FINANCIAL_PERIODS.TODO_PERIODO });
  assert(
    Math.abs(metricsAfterExpense.saidasRealizadas - (metricsBeforeExpense.saidasRealizadas + 50.00)) < 0.01,
    'Saídas realizadas aumentaram exatamente R$ 50,00 com nova despesa paga'
  );
  assert(
    Math.abs(metricsAfterExpense.saldoRealizado - (metricsBeforeExpense.saldoRealizado - 50.00)) < 0.01,
    'Saldo realizado reduziu exatamente R$ 50,00'
  );

  // -------------------------------------------------------------
  // TESTE 8: DUPLICIDADE / IDEMPOTÊNCIA COMPLETA
  // -------------------------------------------------------------
  console.log('\n--- TESTE 8: Duplicidade e Idempotência Geral ---');
  resetStorage();

  // Executar sincronização de contas a receber 5 vezes seguidas
  for (let i = 0; i < 5; i++) {
    syncReceivablesWithOrders();
  }
  const recsAfterMultiple = getReceivables();
  assert(recsAfterMultiple.length === SEED_ORDERS.length, 'Sincronização repetida de pedidos NÃO duplicou contas a receber');

  // Executar sincronização de compras 5 vezes seguidas
  for (let i = 0; i < 5; i++) {
    syncPayablesWithPurchases();
  }
  const paysAfterMultiple = getPayables();
  assert(paysAfterMultiple.length === SEED_PURCHASES.length, 'Sincronização repetida de compras NÃO duplicou contas a pagar');

  // -------------------------------------------------------------
  // TESTE 9: DESPESAS MANUAIS (CRUD & VÍNCULO)
  // -------------------------------------------------------------
  console.log('\n--- TESTE 9: Despesas Manuais ---');
  resetStorage();

  const expCreated = createExpense({
    description: 'Assinatura Software Gráfico',
    category: 'Serviços',
    amount: 120.00,
    status: 'aberto',
    dueDate: '20/09/2026'
  });
  assert(expCreated.id.startsWith('exp_'), 'Despesa criada com ID válido');
  assert(expCreated.amount === 120.00, 'Valor de despesa gravado');

  const expUpdated = updateExpense(expCreated.id, { amount: 135.50 });
  assert(expUpdated.amount === 135.50, 'Despesa atualizada com sucesso');

  const payExpResult = payExpense(expCreated.id, { paidDate: '15/09/2026' });
  assert(payExpResult.success && !payExpResult.alreadyPaid, 'Despesa quitada com sucesso');

  const expDeleted = deleteExpense(expCreated.id);
  assert(expDeleted === true, 'Despesa excluída com sucesso');

  // -------------------------------------------------------------
  // TESTE 10: IMPORTAÇÃO E EXPORTAÇÃO CSV
  // -------------------------------------------------------------
  console.log('\n--- TESTE 10: CSV (Despesas, Receber, Pagar, Vendas) ---');
  resetStorage();

  // 10.1 CSV Despesas
  const expCSV = exportExpensesCSV();
  assert(expCSV.startsWith('\uFEFF'), 'Exportação de Despesas inclui UTF-8 BOM');
  assert(expCSV.includes('descricao') && expCSV.includes('valor'), 'Cabeçalhos corretos no CSV de Despesas');

  const csvTestExpenses = `descricao;categoria;valor;data;vencimento;data_pagamento;status;forma_pagamento;observacao
"Lâmina de Corte Silhouette";"Operacional";"45,00";"01/09/2026";"05/09/2026";"05/09/2026";"pago";"Pix";"Reposição lâmina"
"Embalagens Plásticas";"Operacional";"30,00";"02/09/2026";"10/09/2026";;"aberto";"Boleto";"Pacote com 100 un"`;

  const importExpRes = importExpensesCSV(csvTestExpenses);
  assert(importExpRes.success === true, 'Importação de Despesas CSV bem-sucedida');
  assert(importExpRes.count === 2, '2 despesas importadas do CSV');

  // 10.2 CSV Contas a Receber
  const recCSV = exportReceivablesCSV();
  assert(recCSV.startsWith('\uFEFF'), 'Exportação de Contas a Receber inclui UTF-8 BOM');

  const csvTestReceivables = `cliente;descricao;valor;vencimento;data_recebimento;status;forma_pagamento;observacao
"Fernanda Lima";"Topo de Bolo Casamento";"75,00";"12/09/2026";;"aberto";"Pix";"50% sinal"
"Carlos Eduardo";"Kit Festa Dinossauro";"180,00";"08/09/2026";"08/09/2026";"recebido";"Cartão de Crédito";"Pago no cartão"`;

  const importRecRes = importReceivablesCSV(csvTestReceivables);
  assert(importRecRes.success === true, 'Importação de Contas a Receber CSV bem-sucedida');
  assert(importRecRes.count === 2, '2 contas a receber importadas do CSV');

  // 10.3 CSV Contas a Pagar
  const payCSV = exportPayablesCSV();
  assert(payCSV.startsWith('\uFEFF'), 'Exportação de Contas a Pagar inclui UTF-8 BOM');

  const csvTestPayables = `fornecedor;descricao;valor;vencimento;data_pagamento;status;forma_pagamento;observacao
"Papéis Especiais";"Papel Lamicote Dourado";"95,00";"15/09/2026";;"aberto";"Boleto";"10 pacotes"`;

  const importPayRes = importPayablesCSV(csvTestPayables);
  assert(importPayRes.success === true, 'Importação de Contas a Pagar CSV bem-sucedida');
  assert(importPayRes.count === 1, '1 conta a pagar importada do CSV');

  // 10.4 CSV Vendas
  const salesCSV = exportSalesCSV();
  assert(salesCSV.startsWith('\uFEFF'), 'Exportação de Vendas inclui UTF-8 BOM');
  assert(salesCSV.includes('pedido;cliente;produto;quantidade;valor_venda'), 'Cabeçalho de vendas estruturado');

  // -------------------------------------------------------------
  // TESTE 11: PERSISTÊNCIA E AUTOSAVE
  // -------------------------------------------------------------
  console.log('\n--- TESTE 11: Persistência e Autosave ---');
  
  const currentExpensesInStorage = JSON.parse(memoryStore.get('papermax_expenses'));
  assert(Array.isArray(currentExpensesInStorage), 'Despesas salvas em storage persistente');

  const currentReceivablesInStorage = JSON.parse(memoryStore.get('papermax_receivables'));
  assert(Array.isArray(currentReceivablesInStorage), 'Contas a receber salvas em storage');

  const currentPayablesInStorage = JSON.parse(memoryStore.get('papermax_payables'));
  assert(Array.isArray(currentPayablesInStorage), 'Contas a pagar salvas em storage');

  // -------------------------------------------------------------
  // TESTE 12: DASHBOARD SINCRONIZADO COM O FINANCEIRO
  // -------------------------------------------------------------
  console.log('\n--- TESTE 12: Dashboard Sincronizado ---');
  resetStorage();

  const dashMetrics = calculateDashboardMetrics();
  assert(dashMetrics.totalRevenue > 0, `Dashboard calcula receita total dos pedidos: R$ ${dashMetrics.totalRevenue.toFixed(2)}`);
  assert(dashMetrics.estimatedProfit >= 0, `Dashboard calcula margem líquida dos pedidos: R$ ${dashMetrics.estimatedProfit.toFixed(2)}`);
  assert(dashMetrics.productsCount === SEED_PRODUCTS.length, 'Dashboard reflete quantidade de produtos cadastrados');

  console.log('\n=====================================================');
  console.log(`  RESUMO DA VALIDAÇÃO ETAPA 6.1:`);
  console.log(`  Total de Testes: ${totalTests}`);
  console.log(`  Testes Aprovados: ${passedTests}`);
  console.log(`  Taxa de Sucesso: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log('=====================================================\n');
}

runValidationSuite().catch(err => {
  console.error('ERRO FATAL NA VALIDAÇÃO:', err);
  process.exit(1);
});
