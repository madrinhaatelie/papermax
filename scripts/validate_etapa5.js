/**
 * PAPER MAX - Script de Validação Etapa 5
 * Valida Estoque Inteligente, Insumos, Componentes (Ficha Técnica / BOM),
 * Movimentações, Inventário, Alertas, Fornecedores, Compras e CSV.
 */

import {
  BASE_UNITS,
  convertUnit,
  convertUnit as convertQuantity,
  calculateMaterialUnitCosts,
  calculateComponentCost,
  expandProductComposition,
  calculateStockBalances,
  calculateProductCapacity,
  recordStockMovement,
  consumeOrderMaterials,
  receivePurchase,
  applyInventoryAdjustments,
  compareSupplierPrices,
  detectCompositionCycle
} from '../src/modules/stock/stock.engine.js';

import {
  exportMaterialsCSV, importMaterialsCSV,
  exportComponentsCSV,
  exportSuppliersCSV, importSuppliersCSV,
  exportMovementsCSV
} from '../src/modules/stock/stock.csv.js';

import {
  SEED_MATERIALS,
  SEED_COMPONENTS,
  SEED_SUPPLIERS,
  SEED_PURCHASES,
  SEED_MOVEMENTS,
  SEED_PRODUCTS
} from '../src/data/seed.js';

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
  console.log('  PAPER MAX — VALIDAÇÃO ETAPA 5');
  console.log('  Estoque Inteligente + Insumos + Componentes + Compras');
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

  // -------------------------------------------------------------
  // GRUPO 1: Conversão de Unidades e Normalização de Custos
  // -------------------------------------------------------------
  console.log('--- GRUPO 1: Conversão de Unidades e Custos ---');
  
  // 720 cm = 7.2 m
  assert(convertQuantity(720, 'cm', 'm') === 7.2, 'Converte 720cm para 7.2m corretamente');
  assert(convertQuantity(2.5, 'm', 'cm') === 250, 'Converte 2.5m para 250cm corretamente');
  assert(convertQuantity(500, 'g', 'kg') === 0.5, 'Converte 500g para 0.5kg corretamente');
  assert(convertQuantity(100, 'folha', 'folha') === 100, 'Mesma unidade retorna quantidade exata');

  // Teste de cálculo de custo unitário de rolo de fita
  const ribbonMat = {
    id: 'mat_ribbon',
    name: 'Fita Cetim 22mm',
    baseUnit: 'm',
    purchasePackType: 'rolo',
    packQuantity: 100,
    purchaseCost: 25.00
  };
  const unitCosts = calculateMaterialUnitCosts(ribbonMat);
  assert(unitCosts.unitCost === 0.25, 'Custo unitário base é R$ 0,25/m');
  assert(unitCosts.subUnitCost === 0.0025, 'Custo sub-unitário é R$ 0,0025/cm');

  // -------------------------------------------------------------
  // GRUPO 2: Ficha Técnica (BOM) e Custo de Componentes
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 2: Ficha Técnica de Componentes (BOM) ---');

  const materialsMap = {
    'mat_fita_rosa': { id: 'mat_fita_rosa', name: 'Fita Cetim Rosa', baseUnit: 'm', purchaseCost: 25.00, packQuantity: 100 }, // R$ 0.25/m
    'mat_palito': { id: 'mat_palito', name: 'Palito Bambu', baseUnit: 'un', purchaseCost: 40.00, packQuantity: 500 },       // R$ 0.08/un
    'mat_fita_verde': { id: 'mat_fita_verde', name: 'Fita Verde', baseUnit: 'm', purchaseCost: 12.00, packQuantity: 50 }       // R$ 0.24/m
  };

  // Flor de cetim: 720cm fita rosa (7.2m * 0.25 = 1.80), 1 palito (0.08), 10cm fita verde (0.1m * 0.24 = 0.024)
  // Total = 1.80 + 0.08 + 0.024 = 1.904
  const florCetimComp = {
    id: 'comp_flor',
    name: 'Flor de Cetim Rosa',
    yield: 1,
    items: [
      { materialId: 'mat_fita_rosa', quantity: 720, unit: 'cm' },
      { materialId: 'mat_palito', quantity: 1, unit: 'un' },
      { materialId: 'mat_fita_verde', quantity: 10, unit: 'cm' }
    ]
  };

  const compCost = calculateComponentCost(florCetimComp, materialsMap);
  assert(Math.abs(compCost - 1.904) < 0.001, `Custo calculado do componente Flor de Cetim é R$ 1,904 (obtido: ${compCost})`);

  // Teste de Multi-nível: Arranjo de 3 Flores (usa 3x comp_flor)
  const arranjoComp = {
    id: 'comp_arranjo',
    name: 'Arranjo com 3 Flores',
    yield: 1,
    items: [
      { type: 'componente', itemId: 'comp_flor', quantity: 3, unit: 'un' }
    ]
  };
  const compsMapForMulti = { 'comp_flor': florCetimComp, 'comp_arranjo': arranjoComp };
  const arranjoCost = calculateComponentCost(arranjoComp, materialsMap, compsMapForMulti);
  assert(Math.abs(arranjoCost - (1.904 * 3)) < 0.001, `Custo multi-nível do Arranjo de 3 Flores é R$ ${(1.904 * 3).toFixed(3)} (obtido: ${arranjoCost.toFixed(3)})`);

  // Teste de Prevenção de Ciclos em Ficha Técnica (A -> B -> A)
  const compA = { id: 'comp_a', name: 'Componente A', items: [{ type: 'componente', itemId: 'comp_b', quantity: 1 }] };
  const compB = { id: 'comp_b', name: 'Componente B', items: [{ type: 'componente', itemId: 'comp_a', quantity: 1 }] };
  const cycleMap = { 'comp_a': compA, 'comp_b': compB };

  const directCycle = detectCompositionCycle('comp_a', [{ type: 'componente', itemId: 'comp_a' }], cycleMap);
  assert(directCycle.hasCycle === true, 'Prevenção de ciclo direto (A -> A) detectada com sucesso');

  const indirectCycle = detectCompositionCycle('comp_a', [{ type: 'componente', itemId: 'comp_b' }], cycleMap);
  assert(indirectCycle.hasCycle === true, 'Prevenção de ciclo indireto (A -> B -> A) detectada com sucesso');

  // -------------------------------------------------------------
  // GRUPO 3: Expansão Recursiva de Produto com Componentes
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 3: Expansão Recursiva de Composição (BOM) ---');

  const componentsMap = {
    'comp_flor': florCetimComp
  };

  const sacolaProduct = {
    id: 'prod_sacola',
    name: 'Sacola Luxo com Flores',
    composition: [
      { type: 'insumo', itemId: 'mat_fita_rosa', quantity: 1, unit: 'm' }, // 1m fita
      { type: 'componente', itemId: 'comp_flor', quantity: 2, unit: 'un' }   // 2 flores = 2 * (7.2m fita rosa + 1 palito + 0.1m fita verde)
    ]
  };

  const expandedBOM = expandProductComposition(sacolaProduct, materialsMap, componentsMap, 1);
  // Total fita rosa = 1m + 2 * 7.2m = 15.4m
  // Total palito = 2 * 1 = 2 un
  // Total fita verde = 2 * 0.1m = 0.2m
  assert(expandedBOM.materials['mat_fita_rosa'].quantity === 15.4, 'Expansão recursiva acumulou 15.4m de fita rosa');
  assert(expandedBOM.materials['mat_palito'].quantity === 2, 'Expansão recursiva acumulou 2 palitos');
  assert(expandedBOM.materials['mat_fita_verde'].quantity === 0.2, 'Expansão recursiva acumulou 0.2m de fita verde');

  // -------------------------------------------------------------
  // GRUPO 4: Saldos de Estoque e Matriz de Alertas
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 4: Saldos e 4 Alertas Operacionais ---');

  const testMats = [
    { id: 'm1', name: 'Material Normal', baseUnit: 'un', currentStock: 100, minStock: 20 },
    { id: 'm2', name: 'Material Abaixo Mínimo', baseUnit: 'un', currentStock: 15, minStock: 20 },
    { id: 'm3', name: 'Material Insuficiente Pedido', baseUnit: 'un', currentStock: 50, minStock: 10 },
    { id: 'm4', name: 'Material Sem Estoque', baseUnit: 'un', currentStock: 0, minStock: 10 }
  ];

  const testOrders = [
    {
      id: 'ord_1',
      status: 'blue',
      qty: 60,
      production: { stockDeducted: false },
      composition: [{ type: 'insumo', itemId: 'm3', quantity: 1, unit: 'un' }] // precisa de 60 de m3 (estoque é 50)
    }
  ];

  const testPurchases = [
    {
      id: 'pur_1',
      status: 'pedida',
      items: [{ materialId: 'm4', quantity: 50, unit: 'un' }]
    }
  ];

  const balances = calculateStockBalances(testMats, [], testOrders, testPurchases);
  const m1Bal = balances.materials.find(m => m.id === 'm1');
  const m2Bal = balances.materials.find(m => m.id === 'm2');
  const m3Bal = balances.materials.find(m => m.id === 'm3');
  const m4Bal = balances.materials.find(m => m.id === 'm4');

  assert(m1Bal.alertType === 'normal', 'm1 está com status Normal');
  assert(m2Bal.alertType === 'abaixo_minimo', 'm2 está com status Abaixo do Mínimo');
  assert(m3Bal.alertType === 'insuficiente', 'm3 está com status Insuficiente para pedidos em fila');
  assert(m3Bal.availableStock === -10, 'm3 disponível é -10');
  assert(m4Bal.alertType === 'sem_estoque', 'm4 está com status Sem Estoque');
  assert(m4Bal.projectedStock === 50, 'm4 projetado contabiliza 50 da ordem de compra');

  // -------------------------------------------------------------
  // GRUPO 5: Movimentações Rastreáveis
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 5: Registro de Movimentações Rastreáveis ---');

  const liveMats = [{ id: 'mat_papel', name: 'Papel Offset', baseUnit: 'folha', currentStock: 100 }];
  const liveMovs = [];

  const movIn = recordStockMovement({
    materialId: 'mat_papel',
    materialType: 'insumo',
    type: 'entrada',
    reason: 'compra',
    quantity: 50,
    origin: 'NF 1234',
    operator: 'Operador A',
    materials: liveMats,
    components: [],
    movements: liveMovs
  });

  assert(movIn.success === true, 'Entrada registrada com sucesso');
  assert(liveMats[0].currentStock === 150, 'Estoque físico atualizado para 150');
  assert(liveMovs.length === 1 && liveMovs[0].type === 'entrada', 'Histórico de movimentação persistido');

  const movOut = recordStockMovement({
    materialId: 'mat_papel',
    materialType: 'insumo',
    type: 'saida',
    reason: 'perda',
    quantity: 10,
    origin: 'Folha amassada',
    operator: 'Operador B',
    materials: liveMats,
    components: [],
    movements: liveMovs
  });

  assert(movOut.success === true, 'Saída registrada com sucesso');
  assert(liveMats[0].currentStock === 140, 'Estoque físico atualizado para 140');
  assert(liveMovs.length === 2 && liveMovs[0].reason === 'perda', 'Histórico registra motivo de perda');

  // -------------------------------------------------------------
  // GRUPO 6: Baixa de Produção (Consumo Rastreável & Idempotência)
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 6: Baixa de Produção e Idempotência ---');

  const orderToConsume = {
    id: 'ord_prod_1',
    number: '1001',
    status: 'blue',
    qty: 10,
    production: { stockDeducted: false },
    composition: [{ type: 'insumo', itemId: 'mat_papel', quantity: 2, unit: 'folha' }]
  };

  const consumeRes = consumeOrderMaterials(orderToConsume, {
    materials: liveMats,
    components: [],
    movements: liveMovs,
    operator: 'Produção'
  });

  assert(consumeRes.success === true, 'Baixa de materiais da ordem realizada com sucesso');
  assert(orderToConsume.production.stockDeducted === true, 'Ordem marcada com stockDeducted: true');
  assert(liveMats[0].currentStock === 120, 'Estoque debitado em 20 folhas (10 un * 2 folhas)');

  // Teste de idempotência (chamar novamente não pode duplicar a baixa)
  const duplicateConsumeRes = consumeOrderMaterials(orderToConsume, {
    materials: liveMats,
    components: [],
    movements: liveMovs,
    operator: 'Produção'
  });
  assert(duplicateConsumeRes.success === true && duplicateConsumeRes.alreadyDeducted === true, 'Segunda tentativa de baixa respeita idempotência sem duplicar');
  assert(liveMats[0].currentStock === 120, 'Estoque permanece inalterado em 120 folhas');

  // -------------------------------------------------------------
  // GRUPO 7: Recebimento de Compras
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 7: Recebimento de Compras de Fornecedor ---');

  const purchaseOrder = {
    id: 'pur_501',
    code: 'COM-501',
    supplierName: 'Papéis & Cia',
    status: 'pedida',
    items: [
      { materialId: 'mat_papel', materialType: 'insumo', name: 'Papel Offset', quantity: 200, unit: 'folha' }
    ]
  };

  const recRes = receivePurchase(purchaseOrder, {
    materials: liveMats,
    components: [],
    movements: liveMovs,
    operator: 'Almoxarife'
  });

  assert(recRes.success === true, 'Compra recebida com sucesso');
  assert(purchaseOrder.status === 'recebida', 'Status da compra alterado para recebida');
  assert(liveMats[0].currentStock === 320, 'Estoque físico recebeu 200 folhas (total 320)');

  // Teste de Idempotência no Recebimento de Compra
  const duplicateRecRes = receivePurchase(purchaseOrder, {
    materials: liveMats,
    components: [],
    movements: liveMovs,
    operator: 'Almoxarife'
  });
  assert(duplicateRecRes.success === true && duplicateRecRes.alreadyReceived === true, 'Segunda tentativa de recebimento de compra respeita idempotência');
  assert(liveMats[0].currentStock === 320, 'Estoque físico não é incrementado novamente');

  // -------------------------------------------------------------
  // GRUPO 8: Ajustes de Inventário Físico
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 8: Ajustes de Inventário Físico ---');

  const invSession = { id: 'inv_01', code: 'INV-01' };
  const countedItems = [
    { materialId: 'mat_papel', materialType: 'insumo', physicalCount: 315 } // Divergência de -5 folhas
  ];

  const invRes = applyInventoryAdjustments(invSession, countedItems, {
    materials: liveMats,
    components: [],
    movements: liveMovs,
    operator: 'Auditor'
  });

  assert(invRes.success === true && invRes.totalAdjusted === 1, 'Ajuste de inventário aplicado com sucesso');
  assert(liveMats[0].currentStock === 315, 'Estoque físico corrigido para 315');

  // Teste de Idempotência no Ajuste de Inventário
  const duplicateInvRes = applyInventoryAdjustments(invSession, countedItems, {
    materials: liveMats,
    components: [],
    movements: liveMovs,
    operator: 'Auditor'
  });
  assert(duplicateInvRes.success === true && duplicateInvRes.alreadyApplied === true, 'Segunda tentativa de aplicar inventário respeita idempotência');
  assert(liveMats[0].currentStock === 315, 'Estoque permanece em 315');

  // -------------------------------------------------------------
  // GRUPO 9: Calculadora de Capacidade Produtiva e Gargalo
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 9: Capacidade Produtiva e Gargalos ---');

  const capMats = [
    { id: 'm_cap_1', name: 'Papel', baseUnit: 'folha', currentStock: 100 },
    { id: 'm_cap_2', name: 'Fita', baseUnit: 'm', currentStock: 10 } // Gargalo: cada produto usa 2m => máx 5 unidades
  ];

  const capProd = {
    id: 'prod_caixa',
    name: 'Caixa Presente',
    composition: [
      { type: 'insumo', itemId: 'm_cap_1', quantity: 1, unit: 'folha' },
      { type: 'insumo', itemId: 'm_cap_2', quantity: 2, unit: 'm' }
    ]
  };

  const capacity = calculateProductCapacity(capProd, capMats, [], true);
  assert(capacity.maxUnits === 5, `Capacidade máxima calculada é 5 unidades (obtido: ${capacity.maxUnits})`);
  assert(capacity.limitingMaterials.length > 0 && capacity.limitingMaterials[0].id === 'm_cap_2', 'Fita identificada como o material gargalo limitante');

  // -------------------------------------------------------------
  // GRUPO 10: Comparativo de Preços Normalizados
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 10: Comparativo de Preços de Fornecedores ---');

  const compSuppliers = [
    { id: 's1', name: 'Fornecedor Barato' },
    { id: 's2', name: 'Fornecedor Caro' }
  ];

  const compMaterials = [
    { id: 'm_rib', name: 'Fita 15mm', baseUnit: 'm', supplierId: 's1', purchaseCost: 15.00, packQuantity: 100, purchaseUnit: 'm' } // R$ 0.15/m
  ];

  const compPurchases = [
    {
      id: 'p_hist_1',
      supplierId: 's2',
      supplierName: 'Fornecedor Caro',
      status: 'recebida',
      items: [
        { materialId: 'm_rib', name: 'Fita 15mm', quantity: 50, unit: 'm', packCost: 12.50, packQuantity: 50, unitCost: 0.25 } // R$ 0.25/m
      ]
    }
  ];

  const comparisons = compareSupplierPrices(compMaterials, compSuppliers, compPurchases);
  assert(comparisons.length === 1, 'Comparativo gerado para o material');
  assert(comparisons[0].entries[0].supplierName === 'Fornecedor Barato' && comparisons[0].entries[0].isBest === true, 'Fornecedor Barato identificado como o melhor preço');

  // -------------------------------------------------------------
  // GRUPO 11: Importação e Exportação CSV de Estoque
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 11: Importação e Exportação CSV ---');

  const csvContent = exportMaterialsCSV(SEED_MATERIALS);
  assert(csvContent.includes('Papel Kraft 180g A4'), 'Exportação de materiais CSV contém dados corretos');

  const sampleCsvToImport = `nome;unidade_base;estoque_atual;estoque_minimo;custo_embalagem;qtd_embalagem;fornecedor
Papel Offset 180g;folha;200;50;45.00;100;Papéis & Cia
Fita Gorgurão 38mm;m;50;10;20.00;50;Casa da Fita`;

  const importRes = importMaterialsCSV(sampleCsvToImport, []);
  assert(importRes.success === true && importRes.count === 2, 'Importação de 2 insumos via CSV bem-sucedida');
  assert(importRes.materials[0].currentStock === 200, 'Estoque importado corretamente');

  // Teste de CSV de Componentes
  const csvComps = exportComponentsCSV(SEED_COMPONENTS);
  assert(csvComps.includes('Flor de Cetim Rosa') || csvComps.includes('Laço'), 'Exportação de componentes CSV funcional');

  // Teste de CSV de Fornecedores
  const csvSups = exportSuppliersCSV(SEED_SUPPLIERS);
  assert(csvSups.includes('Papéis & Cia') || csvSups.includes('Casa da Fita'), 'Exportação de fornecedores CSV funcional');

  const sampleSupsCsv = `nome;razao_social;contato;telefone;email
Distribuidora Nacional;Dist Nac LTDA;Carlos;11999998888;contato@distnac.com.br`;
  const importSupsRes = importSuppliersCSV(sampleSupsCsv, []);
  assert(importSupsRes.success === true && importSupsRes.count === 1, 'Importação de fornecedor via CSV funcional');
  assert(importSupsRes.suppliers[0].name === 'Distribuidora Nacional', 'Nome de fornecedor importado com sucesso');

  // Teste de CSV de Movimentações
  const csvMovs = exportMovementsCSV(liveMovs);
  assert(csvMovs.includes('Entrada') && csvMovs.includes('Saída'), 'Exportação de movimentações CSV reflete entradas e saídas');

  console.log('\n=====================================================');
  console.log(`  RESUMO DA VALIDAÇÃO ETAPA 5:`);
  console.log(`  Total de Testes: ${totalTests}`);
  console.log(`  Testes Aprovados: ${passedTests}`);
  console.log(`  Taxa de Sucesso: ${(passedTests / totalTests * 100).toFixed(1)}%`);
  console.log('=====================================================\n');
}

runValidationSuite().catch(err => {
  console.error(err);
  process.exit(1);
});
