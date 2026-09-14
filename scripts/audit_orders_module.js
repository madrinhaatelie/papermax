import {
  getOrders, getOrderById, getNextOrderNumber,
  createOrder, updateOrder, deleteOrder, duplicateOrder,
  cycleOrderStatus, isOrderActive,
  approveOrderById, sendOrderToProductionById,
  advanceOrderStageById, returnOrderStageById,
  updateOrderQuantityById, updateOrderPrintJobById,
  submitOrderQCById, updateOrderPackagingById,
  addGeneratedFileToOrder, exportOrdersCSV, importOrdersCSV
} from '../src/modules/orders/orders.js';

import {
  loadOrders, saveOrders, loadProducts, saveProducts,
  loadMaterials, saveMaterials, loadReceivables
} from '../src/data/storage.js';

import {
  generateOperationalLabelData,
  generateBarcodeSvg,
  generateQrCodeSvg
} from '../src/modules/production/production.engine.js';

import { generatePersonalizedPdf } from '../src/modules/personalization/pdf.engine.js';
import { syncReceivablesWithOrders } from '../src/modules/finance/finance.engine.js';
import { consumeOrderMaterials } from '../src/modules/stock/stock.engine.js';
import { processAutomationEvent } from '../src/modules/automation/automation.engine.js';

// Setup Mock Environment
const memoryStore = new Map();
globalThis.localStorage = {
  getItem: (key) => memoryStore.get(key) || null,
  setItem: (key, val) => memoryStore.set(key, String(val)),
  removeItem: (key) => memoryStore.delete(key),
  clear: () => memoryStore.clear()
};

let passedCount = 0;
let failedCount = 0;
const failures = [];

function check(cond, name, detail = '') {
  if (cond) {
    passedCount++;
    console.log(`  ✓ [PASS] ${name}`);
  } else {
    failedCount++;
    console.error(`  ✗ [FAIL] ${name} ${detail ? '— ' + detail : ''}`);
    failures.push({ name, detail });
  }
}

async function runOrdersAudit() {
  console.log('=====================================================');
  console.log('  PAPER MAX — AUDITORIA COMPLETA DO MÓDULO PEDIDOS');
  console.log('=====================================================\n');

  // --- 1. CRUD BÁSICO, SNAPSHOT E VALIDAÇÃO DE CAMPOS ---
  console.log('--- 1. CRUD BÁSICO, SNAPSHOT E VALIDAÇÕES ---');
  const prods = loadProducts();
  const baseProd = prods.find(p => p.id === 'prod_sacola_m');
  check(!!baseProd, 'Produto de teste (prod_sacola_m) existe no catálogo');

  // Validação: falta de cliente
  let errNoCustomer = false;
  try {
    createOrder({ productId: 'prod_sacola_m', qty: 10, personalization: { field_nome: 'Teste' }, changeOptions: { opt_cor: 'Rosa', opt_alca: 'Cetim' } });
  } catch (e) {
    errNoCustomer = true;
  }
  check(errNoCustomer, 'Validação impede criação sem nome de cliente');

  // Validação: falta de produto
  let errNoProd = false;
  try {
    createOrder({ customer: 'Maria', qty: 10 });
  } catch (e) {
    errNoProd = true;
  }
  check(errNoProd, 'Validação impede criação sem produto selecionado');

  // Validação: campo obrigatório de personalização faltante
  let errNoPersonalization = false;
  try {
    createOrder({ customer: 'Maria', productId: 'prod_sacola_m', qty: 10, personalization: {}, changeOptions: { opt_cor: 'Rosa', opt_alca: 'Cetim' } });
  } catch (e) {
    errNoPersonalization = true;
  }
  check(errNoPersonalization, 'Validação impede criação sem campo de personalização obrigatório (field_nome)');

  // Validação: opção de alteração obrigatória faltante
  let errNoChangeOption = false;
  try {
    createOrder({ customer: 'Maria', productId: 'prod_sacola_m', qty: 10, personalization: { field_nome: 'Teste' }, changeOptions: { opt_alca: 'Cetim' } });
  } catch (e) {
    errNoChangeOption = true;
  }
  check(errNoChangeOption, 'Validação impede criação sem opção de alteração obrigatória (opt_cor)');

  // Criação bem-sucedida
  const createdOrder = createOrder({
    customer: 'Ana Beatriz Fonseca',
    productId: 'prod_sacola_m',
    qty: 20,
    unitPrice: 9.50,
    orderDate: '14/09/26',
    deliveryDate: '20/09/26',
    status: 'yellow',
    notes: 'Entregar com embalagem especial',
    personalization: {
      field_nome: 'Ana Beatriz',
      field_idade: '5'
    },
    changeOptions: {
      opt_cor: 'Rosa',
      opt_alca: 'Cetim'
    }
  });

  check(!!createdOrder && !!createdOrder.id, 'Pedido criado com ID único gerado');
  check(createdOrder.customer === 'Ana Beatriz Fonseca', 'Cliente gravado corretamente');
  check(createdOrder.productSnapshot && createdOrder.productSnapshot.productId === 'prod_sacola_m', 'Product Snapshot congelado gerado na criação');

  // Teste de Imutabilidade do Product Snapshot
  const originalPriceInSnapshot = createdOrder.productSnapshot.price;
  // Altera o produto no catálogo
  const modifiedProds = prods.map(p => p.id === 'prod_sacola_m' ? { ...p, price: 999.00 } : p);
  saveProducts(modifiedProds, true);

  const orderFromStorage = getOrderById(createdOrder.id);
  check(orderFromStorage.productSnapshot.price === originalPriceInSnapshot, 'Product Snapshot permaneceu congelado após alteração no catálogo', `Preço no snapshot: ${orderFromStorage.productSnapshot.price}`);
  // Restaura catálogo
  saveProducts(prods, true);

  // Edição
  const updatedOrder = updateOrder(createdOrder.id, {
    customer: 'Ana Beatriz Fonseca Silva',
    notes: 'Nota atualizada com urgência'
  });
  check(updatedOrder.customer === 'Ana Beatriz Fonseca Silva', 'updateOrder atualizou cliente');
  check(updatedOrder.notes === 'Nota atualizada com urgência', 'updateOrder atualizou observações');

  // Duplicação
  const dupOrder = duplicateOrder(createdOrder.id);
  check(dupOrder && dupOrder.id !== createdOrder.id, 'duplicateOrder criou pedido com novo ID');
  check(dupOrder.customer.includes('Ana Beatriz'), 'duplicateOrder herdou dados do cliente');
  check(dupOrder.production && dupOrder.production.currentStage === 'aprovacao', 'duplicateOrder resetou esteira para aprovação');

  // Exclusão
  const deleteResult = deleteOrder(dupOrder.id);
  check(deleteResult && deleteResult.success === true, 'deleteOrder retornou sucesso');
  check(!getOrderById(dupOrder.id), 'deleteOrder removeu pedido do armazenamento');


  // --- 2. CICLO COMPLETO DE ESTEIRA DE PRODUÇÃO ---
  console.log('\n--- 2. FLUXO COMPLETO DA ESTEIRA DE PRODUÇÃO ---');
  let flowOrder = getOrderById(createdOrder.id);
  check(flowOrder.production.currentStage === 'aprovacao', 'Estágio inicial é aprovação');

  // Geração de PDF do molde
  const pdfResult = await generatePersonalizedPdf({
    product: baseProd,
    personalizationData: flowOrder.personalization,
    changeOptionsData: flowOrder.changeOptions,
    orderId: flowOrder.id,
    orderNumber: flowOrder.number,
    customerName: flowOrder.customer
  });
  check(!!pdfResult && !!pdfResult.fileId && pdfResult.size > 0, 'PDF vetorial personalizado gerado com sucesso');

  // Adiciona arquivo gerado ao pedido
  flowOrder = addGeneratedFileToOrder(flowOrder.id, {
    fileId: pdfResult.fileId,
    fileName: pdfResult.fileName,
    type: 'cut_print_pdf',
    createdAt: pdfResult.createdAt,
    size: pdfResult.size
  });
  check(flowOrder.generatedFiles && flowOrder.generatedFiles.length >= 1, 'addGeneratedFileToOrder vinculou arquivo PDF');

  // Aprovação
  approveOrderById(flowOrder.id);
  flowOrder = getOrderById(flowOrder.id);
  check(flowOrder.status === 'aprovado' && flowOrder.production.currentStage === 'aprovacao', 'approveOrderById registrou aprovação comercial');

  // Enviar para Produção
  sendOrderToProductionById(flowOrder.id);
  flowOrder = getOrderById(flowOrder.id);
  check(flowOrder.production.currentStage === 'impressao', 'Pedido aprovado avançou para fila de impressão');
  check(flowOrder.status === 'aguardando_impressao', 'Status operacional reflete fila de impressão');

  // Impressão: Iniciar
  updateOrderPrintJobById(flowOrder.id, 'start');
  flowOrder = getOrderById(flowOrder.id);
  check(flowOrder.production.printJob.status === 'imprimindo', 'Impressão iniciada com status "imprimindo"');

  // Impressão: Concluir
  updateOrderPrintJobById(flowOrder.id, 'complete');
  flowOrder = getOrderById(flowOrder.id);
  check(flowOrder.production.printJob.status === 'concluida', 'Impressão concluída');
  check(flowOrder.production.currentStage === 'corte', 'Avançou automaticamente para corte após impressão');

  // Avanço: Corte -> Vinco
  advanceOrderStageById(flowOrder.id);
  flowOrder = getOrderById(flowOrder.id);
  check(flowOrder.production.currentStage === 'vinco', 'Avançou de corte para vinco');

  // Avanço: Vinco -> Montagem
  advanceOrderStageById(flowOrder.id);
  flowOrder = getOrderById(flowOrder.id);
  check(flowOrder.production.currentStage === 'montagem', 'Avançou de vinco para montagem');

  // Avanço: Montagem -> Acabamento
  advanceOrderStageById(flowOrder.id);
  flowOrder = getOrderById(flowOrder.id);
  check(flowOrder.production.currentStage === 'acabamento', 'Avançou de montagem para acabamento');

  // Avanço: Acabamento -> Conferência (CQ)
  advanceOrderStageById(flowOrder.id);
  flowOrder = getOrderById(flowOrder.id);
  check(flowOrder.production.currentStage === 'conferencia', 'Avançou de acabamento para conferência (CQ)');

  // CQ: Teste de Rejeição e Bloqueio
  submitOrderQCById(flowOrder.id, {
    decision: 'reprovado',
    reasonId: 'mancha_impressao',
    affectedQty: 5,
    returnStageId: 'corte',
    notes: 'Mancha na impressão detectada no CQ'
  });
  flowOrder = getOrderById(flowOrder.id);
  check(flowOrder.production.qualityControl.status === 'reprovado', 'CQ registrou não conformidade (reprovado)');
  check(flowOrder.status === 'bloqueado', 'Pedido reprovado no CQ mudou status para bloqueado');

  // CQ: Retorno Operacional para retrabalho
  returnOrderStageById(flowOrder.id, 'corte', {
    reason: 'Retrabalho de peças manchadas',
    operator: 'Operador Produção'
  });
  flowOrder = getOrderById(flowOrder.id);
  check(flowOrder.production.currentStage === 'corte', 'Pedido retornado com sucesso para etapa de corte com justificativa');

  // Re-avança até conferência
  advanceOrderStageById(flowOrder.id); // vinco
  advanceOrderStageById(flowOrder.id); // montagem
  advanceOrderStageById(flowOrder.id); // acabamento
  advanceOrderStageById(flowOrder.id); // conferencia
  flowOrder = getOrderById(flowOrder.id);
  check(flowOrder.production.currentStage === 'conferencia', 'Pedido re-avançou até conferência');

  // CQ: Aprovação
  submitOrderQCById(flowOrder.id, {
    decision: 'aprovado',
    operator: 'Inspetor Chefe'
  });
  flowOrder = getOrderById(flowOrder.id);
  check(flowOrder.production.qualityControl.status === 'aprovado', 'CQ aprovado');
  check(flowOrder.production.currentStage === 'embalagem', 'Avançou automaticamente para embalagem após aprovação no CQ');

  // Apontamento de quantidades parciais
  updateOrderQuantityById(flowOrder.id, 15);
  flowOrder = getOrderById(flowOrder.id);
  check(flowOrder.production.producedQty === 15, 'Apontamento de 15 un produzidas registrado');
  check(flowOrder.production.pendingQty === 5, 'Quantidade pendente atualizada para 5 un (20 - 15)');

  // Concluir produção e embalagem
  updateOrderPackagingById(flowOrder.id, { action: 'complete' });
  flowOrder = getOrderById(flowOrder.id);
  check(flowOrder.production.currentStage === 'pronto', 'Estágio de produção finalizado como "pronto"');
  check(flowOrder.status === 'pronto', 'Status do pedido marcado como pronto');

  // Transição de ciclo de status até entregue
  let cyclingOrder = flowOrder;
  let attempts = 0;
  while (cyclingOrder.status !== 'neutral' && attempts < 10) {
    cyclingOrder = cycleOrderStatus(cyclingOrder.id);
    attempts++;
  }
  check(cyclingOrder.status === 'neutral', 'Transição para status final entregue (neutral)');
  check(!isOrderActive(cyclingOrder), 'isOrderActive retorna false para pedido entregue/neutral');


  // --- 3. INTEGRAÇÃO COM ESTOQUE (BAIXA DE MATERIAIS) ---
  console.log('\n--- 3. INTEGRAÇÃO COM ESTOQUE ---');
  const materialsBefore = loadMaterials();
  const kraftBefore = materialsBefore.find(m => m.id === 'mat_papel_kraft_180');
  const initialStock = kraftBefore ? kraftBefore.stock : 0;

  const targetFinishedOrder = cyclingOrder;

  // Baixa de estoque para o pedido
  const liveMaterials = [...materialsBefore];
  const liveMovements = [];
  const stockDeductionResult = consumeOrderMaterials(targetFinishedOrder, {
    materials: liveMaterials,
    components: [],
    movements: liveMovements,
    operator: 'Produção'
  });
  check(stockDeductionResult && stockDeductionResult.success, 'Baixa de estoque realizada com sucesso');
  check(targetFinishedOrder.production.stockDeducted === true, 'Ordem marcada com stockDeducted: true');

  // Teste de Idempotência da baixa de estoque
  const secondDeduction = consumeOrderMaterials(targetFinishedOrder, {
    materials: liveMaterials,
    components: [],
    movements: liveMovements,
    operator: 'Produção'
  });
  check(secondDeduction.alreadyDeducted === true || secondDeduction.success === false, 'Idempotência protegeu contra dupla baixa de estoque');


  // --- 4. INTEGRAÇÃO FINANCEIRA ---
  console.log('\n--- 4. INTEGRAÇÃO FINANCEIRA ---');
  const syncResult = syncReceivablesWithOrders();
  check(Array.isArray(syncResult), 'Sincronização financeira de contas a receber executada');

  const allReceivables = loadReceivables();
  const orderReceivable = allReceivables.find(r => r.orderId === targetFinishedOrder.id || r.originId === targetFinishedOrder.id);
  check(!!orderReceivable, 'Título de conta a receber gerado para o pedido');
  if (orderReceivable) {
    const expectedValue = targetFinishedOrder.qty * (targetFinishedOrder.productSnapshot?.price || 8.50);
    check(Math.abs(orderReceivable.amount - expectedValue) < 0.01, `Valor do título (${orderReceivable.amount}) corresponde ao total do pedido calculado pelo snapshot (${expectedValue})`);
  }


  // --- 5. BUSCA, FILTROS E HISTÓRICO ---
  console.log('\n--- 5. BUSCA, FILTROS E HISTÓRICO ---');
  const allOrders = getOrders({ tab: 'todos' });
  check(allOrders.some(o => o.id === targetFinishedOrder.id), 'Filtro "todos" contém o pedido');

  const deliveredOrders = getOrders({ tab: 'entregues' });
  check(deliveredOrders.some(o => o.id === targetFinishedOrder.id), 'Filtro "entregues" contém o pedido finalizado');

  const history = targetFinishedOrder.production.history || [];
  check(history.length >= 5, `Histórico operacional registrou ${history.length} eventos ao longo da esteira`);
  check(history.some(h => h.stage === 'aprovacao'), 'Histórico contém evento de aprovação');
  check(history.some(h => h.stage === 'conferencia'), 'Histórico contém evento de CQ');


  // --- 6. ETIQUETA OPERACIONAL ---
  console.log('\n--- 6. ETIQUETA OPERACIONAL COM CÓDIGO DE BARRAS ---');
  const labelData = generateOperationalLabelData(targetFinishedOrder);
  check(!!labelData, 'generateOperationalLabelData gerou dados da etiqueta');
  check(labelData.customer === targetFinishedOrder.customer, 'Etiqueta contém o nome do cliente');
  check(!!labelData.barcodeSvg && labelData.barcodeSvg.includes('<svg'), 'Etiqueta gerou código de barras vetorial SVG');
  check(!!labelData.qrCodeSvg && labelData.qrCodeSvg.includes('<svg'), 'Etiqueta gerou QR Code vetorial SVG');


  // --- 7. VERIFICAÇÃO DE INCONSISTÊNCIAS UI VS DADOS ---
  console.log('\n--- 7. AUDITORIA DE INCONSISTÊNCIAS UI VS DADOS REAIS ---');
  // Verifica sincronia de isOrderActive
  const activeOrders = getOrders().filter(isOrderActive);
  check(activeOrders.every(o => o.status !== 'neutral' && o.status !== 'entregue' && o.status !== 'cancelado'), 'Nenhum pedido entregue/cancelado consta como ativo');

  // Verifica coerência de total de itens e contadores
  const totalInDb = loadOrders().length;
  const totalFromGet = getOrders({ tab: 'todos' }).length;
  check(totalInDb === totalFromGet, `Total de pedidos no storage (${totalInDb}) é idêntico a getOrders (${totalFromGet})`);

  console.log('\n=====================================================');
  console.log(`RESULTADO DA AUDITORIA: ${passedCount} APROVADOS | ${failedCount} FALHAS`);
  console.log('=====================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runOrdersAudit().catch(e => {
  console.error('Erro fatal na auditoria:', e);
  process.exit(1);
});
