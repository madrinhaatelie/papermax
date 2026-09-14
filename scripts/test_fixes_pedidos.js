import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  loadOrders,
  saveOrders
} from '../src/data/storage.js';
import {
  createOrder,
  getOrderById,
  updateOrderPrintJobById,
  markOrderDeliveredById,
  advanceOrderStageById,
  approveOrderById,
  sendOrderToProductionById,
  PRODUCTION_STAGES
} from '../src/modules/orders/orders.js';
import {
  updatePrintJob,
  markOrderDelivered,
  PRINT_ACTIONS
} from '../src/modules/production/production.engine.js';

describe('Correção das 3 Inconsistências do Módulo Pedidos', () => {
  it('1. Fila de Impressão: Aceita iniciar, pausar, concluir e start, pause, complete uniformemente', () => {
    saveOrders([], true);
    const order = createOrder({
      customer: 'Cliente Impressão',
      productId: 'prod_sacola_m',
      qty: 10,
      personalization: { field_nome: 'Teste', field_idade: '5' },
      changeOptions: { opt_cor: 'Rosa Bebê', opt_alca: 'Cordão Gorgurão' }
    });

    approveOrderById(order.id);
    sendOrderToProductionById(order.id);

    // Testar com "iniciar" (português vindo da UI)
    const resStartPT = updateOrderPrintJobById(order.id, 'iniciar');
    assert.equal(resStartPT.success, true);
    assert.match(resStartPT.message, /iniciada/i);
    assert.equal(getOrderById(order.id).status, 'imprimindo');

    // Testar com "pausar"
    const resPausePT = updateOrderPrintJobById(order.id, 'pausar');
    assert.equal(resPausePT.success, true);
    assert.equal(getOrderById(order.id).status, 'aguardando_impressao');

    // Testar com "start" (inglês)
    const resStartEN = updateOrderPrintJobById(order.id, 'start');
    assert.equal(resStartEN.success, true);
    assert.equal(getOrderById(order.id).status, 'imprimindo');

    // Testar com "concluir" (avança para corte)
    const resCompletePT = updateOrderPrintJobById(order.id, 'concluir');
    assert.equal(resCompletePT.success, true);
    assert.match(resCompletePT.message, /concluída/i);
    const updated = getOrderById(order.id);
    assert.equal(updated.production.currentStage, 'corte');
    assert.equal(updated.status, 'em_corte');
  });

  it('2. Marcar como Entregue: Transiciona pedido pronto para entregue/neutral e registra histórico', () => {
    saveOrders([], true);
    const order = createOrder({
      customer: 'Cliente Entrega',
      productId: 'prod_sacola_m',
      qty: 5,
      personalization: { field_nome: 'Entrega', field_idade: '10' },
      changeOptions: { opt_cor: 'Rosa Bebê', opt_alca: 'Cordão Gorgurão' }
    });

    // Colocar pedido em estado pronto
    order.status = 'pronto';
    order.statusLabel = 'Pronto';
    order.production.currentStage = 'pronto';
    order.production.stageStatus = 'pronto';
    const orders = loadOrders();
    orders[0] = order;
    saveOrders(orders, true);

    const res = markOrderDeliveredById(order.id, { notes: 'Entregue em mãos ao cliente' });
    assert.equal(res.success, true);
    assert.equal(res.statusLabel, 'Entregue');

    const deliveredOrder = getOrderById(order.id);
    assert.equal(deliveredOrder.status, 'entregue');
    assert.equal(deliveredOrder.statusLabel, 'Entregue');
    assert.equal(deliveredOrder.production.stageStatus, 'entregue');

    const lastEvent = deliveredOrder.production.history[deliveredOrder.production.history.length - 1];
    assert.equal(lastEvent.status, 'Entregue');
    assert.match(lastEvent.notes, /Entregue/);
  });

  it('3. Toast de Avanço: Resolução correta da próxima etapa a partir do array PRODUCTION_STAGES', () => {
    saveOrders([], true);
    const order = createOrder({
      customer: 'Cliente Avanço',
      productId: 'prod_sacola_m',
      qty: 2,
      personalization: { field_nome: 'Avanço', field_idade: '1' },
      changeOptions: { opt_cor: 'Rosa Bebê', opt_alca: 'Cordão Gorgurão' }
    });

    // Simular pedido em corte
    order.production.currentStage = 'corte';
    order.status = 'em_corte';
    const orders = loadOrders();
    orders[0] = order;
    saveOrders(orders);

    const res = advanceOrderStageById(order.id);
    assert.equal(res.success, true);
    assert.equal(res.nextStage, 'vinco');

    // Resolução que a UI faz:
    const stageObj = PRODUCTION_STAGES.find(s => s.id === res.nextStage);
    assert.ok(stageObj, 'Objeto da etapa deve ser encontrado no array');
    assert.equal(stageObj.name, 'Vinco');
  });
});
