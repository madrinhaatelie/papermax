/**
 * PAPER MAX - Script de Validação Operacional Etapa 4
 * Valida a máquina de estados de Produção Operacional, esteira de etapas,
 * fila de impressão, controle de qualidade, embalagem, etiquetas e métricas do dashboard.
 */

import {
  PRODUCTION_STAGES,
  PRODUCTION_STAGE_ORDER,
  OPERATIONAL_STATUS_MAP,
  PRINT_ACTIONS,
  DEFECT_REASONS,
  ensureOrderProductionState,
  approveOrder,
  sendOrderToProduction,
  advanceProductionStage,
  returnProductionStage,
  updateProductionQuantity,
  updatePrintJob,
  submitQualityControl,
  updatePackagingStage,
  generateBarcodeSvg,
  generateQrCodeSvg,
  generateOperationalLabelData
} from '../src/modules/production/production.engine.js';

import { calculateDashboardMetrics } from '../src/modules/dashboard/dashboard.js';

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
  console.log('  PAPER MAX — VALIDAÇÃO OPERACIONAL (ETAPA 4)');
  console.log('  Produção Real, Esteira de Etapas e Fila de Impressão');
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
  // GRUPO 1: Inicialização e Blindagem do Estado de Produção
  // -------------------------------------------------------------
  console.log('1. INICIALIZAÇÃO E BLINDAGEM DO ESTADO DE PRODUÇÃO');

  const rawOrder = {
    id: 'ord-test-101',
    number: 1048,
    customer: 'Empresa Papel & Arte Ltda',
    qty: 50,
    status: 'yellow',
    statusLabel: 'Aguardando aprovação'
  };

  const initialized = ensureOrderProductionState(rawOrder);

  assert(initialized.production !== undefined, 'order.production criado com sucesso');
  assert(initialized.production.operationalCode === 'OP-1048', 'Código operacional formatado corretamente (OP-1048)');
  assert(initialized.production.currentStage === 'aprovacao', 'Estágio inicial mapeado para "aprovacao"');
  assert(initialized.production.totalQty === 50, 'Quantidade total inicializada com 50 un');
  assert(initialized.production.producedQty === 0, 'Quantidade produzida inicializada com 0');
  assert(initialized.production.pendingQty === 50, 'Quantidade pendente calculada com 50 un');
  assert(initialized.production.printJob.status === 'aguardando_impressao', 'Fila de impressão inicializada em "aguardando_impressao"');
  assert(Array.isArray(initialized.production.history) && initialized.production.history.length >= 1, 'Histórico operacional com evento de criação');

  // Idempotência: rodar novamente não deve resetar campos
  initialized.production.producedQty = 25;
  const reInitialized = ensureOrderProductionState(initialized);
  assert(reInitialized.production.producedQty === 25, 'Idempotência preserva valores já existentes');

  // -------------------------------------------------------------
  // GRUPO 2: Aprovação e Envio para Produção
  // -------------------------------------------------------------
  console.log('\n2. FLUXO DE APROVAÇÃO E ENVIO PARA PRODUÇÃO');

  const appResult = approveOrder(initialized, { operator: 'Carlos M.', notes: 'Aprovado pelo cliente por WhatsApp' });
  assert(appResult.success === true, 'Aprovação executada com sucesso');
  assert(initialized.production.approvedAt !== null, 'Data/hora de aprovação gravada');
  assert(initialized.status === 'aprovado', 'Status do pedido atualizado para "aprovado"');
  assert(initialized.production.history.length >= 2, 'Evento de aprovação registrado no histórico');

  const prodResult = sendOrderToProduction(initialized, {
    operator: 'Juliana S.',
    notes: 'Prioridade alta para entrega na sexta'
  });
  assert(prodResult.pendingPdf === true, 'Detectada pendência de geração de PDF do molde');
  assert(initialized.production.currentStage === 'personalizacao', 'Avançou para estágio "personalizacao" para gerar PDF');
  assert(initialized.status === 'em_personalizacao', 'Status alterado para "em_personalizacao"');

  // Adicionando arquivo gerado para simular liberação para impressão
  initialized.generatedFiles = [{ fileId: 'pdf-1048', fileName: 'pedido_1048.pdf', size: 104800 }];
  const prodWithPdf = sendOrderToProduction(initialized, { operator: 'Juliana S.', notes: 'PDF gerado, liberando para impressão' });
  assert(prodWithPdf.hasPdf === true, 'PDF detectado');
  assert(initialized.production.currentStage === 'impressao', 'Com PDF, pedido avança diretamente para fila de impressão');
  assert(initialized.status === 'aguardando_impressao', 'Status alterado para "aguardando_impressao"');

  // -------------------------------------------------------------
  // GRUPO 3: Fila de Impressão Operacional
  // -------------------------------------------------------------
  console.log('\n3. FILA DE IMPRESSÃO OPERACIONAL');

  // Iniciar impressão
  const startPrint = updatePrintJob(initialized, PRINT_ACTIONS.START, { operator: 'Marcio T.' });
  assert(startPrint.printJob.status === 'imprimindo', 'Status de impressão alterado para "imprimindo"');
  assert(startPrint.printJob.startedAt !== null, 'Data de início da impressão registrada');
  assert(initialized.status === 'imprimindo', 'Status do pedido reflete "imprimindo"');

  // Pausar impressão
  const pausePrint = updatePrintJob(initialized, PRINT_ACTIONS.PAUSE, { operator: 'Marcio T.' });
  assert(pausePrint.printJob.status === 'pausada', 'Impressão pausada com sucesso');

  // Retomar e Concluir impressão
  updatePrintJob(initialized, PRINT_ACTIONS.START, { operator: 'Marcio T.' });
  const completePrint = updatePrintJob(initialized, PRINT_ACTIONS.COMPLETE, { operator: 'Marcio T.' });
  assert(completePrint.printJob.status === 'concluida', 'Status de impressão marcado como "concluida"');
  assert(completePrint.printJob.completedAt !== null, 'Data de conclusão da impressão registrada');
  assert(initialized.production.currentStage === 'corte', 'Ao concluir impressão, avança automaticamente para corte');
  assert(initialized.status === 'em_corte', 'Status do pedido atualizado para "em_corte"');

  // -------------------------------------------------------------
  // GRUPO 4: Avanço e Retorno da Esteira de Etapas
  // -------------------------------------------------------------
  console.log('\n4. ESTEIRA DE ETAPAS OPERACIONAIS');

  // Avançar: corte -> vinco
  const adv1 = advanceProductionStage(initialized, { operator: 'Ana P.' });
  assert(adv1.nextStage === 'vinco', 'Avançou de corte para vinco');
  assert(initialized.production.currentStage === 'vinco', 'Estágio atualizado para vinco');

  // Avançar: vinco -> montagem
  const adv2 = advanceProductionStage(initialized, { operator: 'Ana P.' });
  assert(adv2.nextStage === 'montagem', 'Avançou de vinco para montagem');

  // Avançar: montagem -> acabamento
  const adv3 = advanceProductionStage(initialized, { operator: 'Roberto K.' });
  assert(adv3.nextStage === 'acabamento', 'Avançou de montagem para acabamento');

  // Avançar: acabamento -> conferencia
  const adv4 = advanceProductionStage(initialized, { operator: 'Roberto K.' });
  assert(adv4.nextStage === 'conferencia', 'Avançou de acabamento para conferência (CQ)');
  assert(initialized.status === 'em_conferencia', 'Status em conferência reflete "em_conferencia"');

  // Retorno de etapa (ex: refazer corte)
  const retResult = returnProductionStage(initialized, 'corte', {
    reason: 'Folha cortada fora do gabarito de sangria',
    operator: 'Inspetor CQ'
  });
  assert(retResult.success === true, 'Retorno para corte realizado com sucesso');
  assert(initialized.production.currentStage === 'corte', 'Pedido retornado para "corte"');
  const returnLog = initialized.production.history[initialized.production.history.length - 1];
  assert(returnLog.notes.includes('Folha cortada fora do gabarito de sangria'), 'Justificativa do operador gravada no histórico');

  // Re-avançar de volta para conferencia
  advanceProductionStage(initialized); // para vinco
  advanceProductionStage(initialized); // para montagem
  advanceProductionStage(initialized); // para acabamento
  advanceProductionStage(initialized); // para conferencia
  assert(initialized.production.currentStage === 'conferencia', 'Re-avançado até conferência');

  // -------------------------------------------------------------
  // GRUPO 5: Controle de Qualidade (CQ) e Não Conformidade
  // -------------------------------------------------------------
  console.log('\n5. CONTROLE DE QUALIDADE (CQ)');

  // Teste de reprovação / não conformidade
  const failedQc = submitQualityControl(initialized, {
    decision: 'reprovado',
    reasonId: 'impressao_incorreta',
    affectedQty: 5,
    returnStageId: 'impressao',
    operator: 'Inspetora Clara',
    notes: 'Reimprimir 5 unidades devido a mancha na aba'
  });
  assert(failedQc.decision === 'reprovado', 'CQ reprovado registrado');
  assert(initialized.production.qualityControl.status === 'reprovado', 'Status de qualidade marcado como reprovado');
  assert(initialized.production.qualityControl.affectedQty === 5, 'Quantidade afetada registrada (5 un)');
  assert(initialized.status === 'bloqueado', 'Status alterado para "bloqueado"');

  // Re-avançar e Teste de aprovação no CQ
  initialized.production.currentStage = 'conferencia';
  initialized.status = 'em_conferencia';

  const approvedQc = submitQualityControl(initialized, {
    decision: 'aprovado',
    operator: 'Inspetora Clara',
    notes: 'Todas as especificações aprovadas com 100% de precisão'
  });
  assert(approvedQc.decision === 'aprovado', 'CQ aprovado');
  assert(initialized.production.qualityControl.status === 'aprovado', 'Qualidade status aprovado');
  assert(initialized.production.currentStage === 'embalagem', 'Ao aprovar no CQ, avança para embalagem');
  assert(initialized.status === 'em_embalagem', 'Status atualizado para "em_embalagem"');

  // -------------------------------------------------------------
  // GRUPO 6: Apontamento de Quantidades Produzidas
  // -------------------------------------------------------------
  console.log('\n6. APONTAMENTO DE QUANTIDADES PRODUZIDAS');

  const qtyResult = updateProductionQuantity(initialized, 48, {
    operator: 'Lucas N.',
    notes: '48 unidades concluídas e inspecionadas'
  });
  assert(qtyResult.producedQty === 48, 'Quantidade produzida atualizada para 48');
  assert(qtyResult.pendingQty === 2, 'Quantidade pendente atualizada para 2');
  const qtyLog = initialized.production.history[initialized.production.history.length - 1];
  assert(qtyLog.status.includes('48/50 un produzidas'), 'Evento de apontamento registrado no histórico');

  // -------------------------------------------------------------
  // GRUPO 7: Embalagem e Conclusão (Pronto)
  // -------------------------------------------------------------
  console.log('\n7. EMBALAGEM E FINALIZAÇÃO DO PEDIDO');

  // Iniciar embalagem
  updatePackagingStage(initialized, { action: 'start', operator: 'Lucas N.' });
  assert(initialized.production.packaging.status === 'em_andamento', 'Embalagem em andamento');

  // Concluir embalagem e finalizar pedido
  const pkgComplete = updatePackagingStage(initialized, {
    action: 'complete',
    operator: 'Lucas N.',
    notes: 'Embalado em caixa protetora com plástico bolha e cantoneiras'
  });
  assert(pkgComplete.packaging.status === 'concluido', 'Embalagem concluída');
  assert(initialized.production.currentStage === 'pronto', 'Estágio finalizado como "pronto"');
  assert(initialized.status === 'pronto', 'Status atualizado para "pronto"');
  assert(initialized.production.producedQty === 50, 'Ao concluir, total de 50 un atingido');

  // -------------------------------------------------------------
  // GRUPO 8: Geração de Etiqueta Operacional, Barcode e QR Code
  // -------------------------------------------------------------
  console.log('\n8. GERAÇÃO DE ETIQUETA OPERACIONAL COM CÓDIGO DE BARRAS');

  const labelData = generateOperationalLabelData(initialized);
  assert(labelData.opCode === 'OP-1048', 'Etiqueta contém código operacional OP-1048');
  assert(labelData.customer === 'Empresa Papel & Arte Ltda', 'Etiqueta contém dados do cliente');
  assert(labelData.qty === 50, 'Etiqueta reflete quantidade do pedido (50)');
  assert(typeof labelData.barcodeSvg === 'string' && labelData.barcodeSvg.includes('<svg'), 'Código de barras vetorial SVG gerado');
  assert(typeof labelData.qrCodeSvg === 'string' && labelData.qrCodeSvg.includes('<svg'), 'QR Code vetorial SVG gerado');
  assert(Array.isArray(labelData.checklist) && labelData.checklist.length === 6, 'Checklist de conferência presente na etiqueta');

  // -------------------------------------------------------------
  // GRUPO 9: Métricas do Pipeline Operacional do Dashboard
  // -------------------------------------------------------------
  console.log('\n9. PIPELINE OPERACIONAL DO DASHBOARD');

  // Criar conjunto de pedidos simulados
  const testOrders = [
    ensureOrderProductionState({ id: '1', number: 1001, status: 'yellow', qty: 10 }),
    ensureOrderProductionState({ id: '2', number: 1002, status: 'blue', qty: 20 }),
    ensureOrderProductionState({ id: '3', number: 1003, status: 'blue', qty: 30 }),
    ensureOrderProductionState({ id: '4', number: 1004, status: 'green', qty: 15 }),
    ensureOrderProductionState({ id: '5', number: 1005, status: 'red', qty: 5 })
  ];

  // Configurar estágios específicos
  testOrders[1].production.currentStage = 'impressao';
  testOrders[1].production.printJob.status = 'aguardando_impressao';

  testOrders[2].production.currentStage = 'corte';

  testOrders[4].production.currentStage = 'conferencia';
  testOrders[4].production.qualityControl = { status: 'reprovado' };

  const dashMetrics = calculateDashboardMetrics(testOrders);
  assert(dashMetrics.operational !== undefined, 'Métricas operacionais calculadas no dashboard');
  assert(dashMetrics.operational.awaitingCount === 1, 'Contagem correta de aguardando (1)');
  assert(dashMetrics.operational.printQueueCount === 1, 'Contagem correta da fila de impressão (1)');
  assert(dashMetrics.operational.finishingCount === 1, 'Contagem correta de acabamento/corte (1)');
  assert(dashMetrics.operational.readyCount === 1, 'Contagem correta de prontos (1)');
  assert(dashMetrics.operational.qcAlertOrders.length === 1, 'Alerta de CQ detecta 1 pedido com não conformidade');

  // -------------------------------------------------------------
  // RESUMO FINAL
  // -------------------------------------------------------------
  console.log('\n=====================================================');
  console.log(`  RESULTADO: ${passedTests} DE ${totalTests} TESTES APROVADOS!`);
  console.log('  PAPER MAX ETAPA 4 100% OPERACIONAL E VALIDADO!');
  console.log('=====================================================\n');
}

runValidationSuite().catch(err => {
  console.error('\n❌ ERRO NA EXECUÇÃO DOS TESTES DA ETAPA 4:', err);
  process.exit(1);
});
