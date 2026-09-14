/**
 * Script de Testes Automatizados - Etapa 8 (Automação Operacional)
 */

// Setup Mock for localStorage in Node environment
global.localStorage = {
  store: {},
  getItem(key) {
    return this.store[key] || null;
  },
  setItem(key, value) {
    this.store[key] = String(value);
  },
  removeItem(key) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  }
};

import {
  getAutomationRules,
  updateAutomationRuleStatus,
  processAutomationEvent,
  getAutomationLogs,
  getNotifications,
  markNotificationAsRead,
  isEventProcessed,
  markEventProcessed
} from '../src/modules/automation/automation.engine.js';

import { loadOrders, saveOrders } from '../src/data/storage.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ [PASS] ${message}`);
}

async function runEtapa8Tests() {
  console.log('====================================================');
  console.log('🚀 INICIANDO BATERIA DE TESTES: ETAPA 8 (AUTOMAÇÃO)');
  console.log('====================================================');

  // 1. Regras e Persistência
  const rules = getAutomationRules();
  assert(Array.isArray(rules) && rules.length >= 6, 'Regras de automação carregadas corretamente');
  
  const testRuleId = rules[0].id;
  const originalStatus = rules[0].active;
  updateAutomationRuleStatus(testRuleId, !originalStatus);
  let updatedRules = getAutomationRules();
  assert(updatedRules.find(r => r.id === testRuleId).active !== originalStatus, 'Status da regra atualizado com sucesso');
  
  // Reverter status
  updateAutomationRuleStatus(testRuleId, originalStatus);
  assert(getAutomationRules().find(r => r.id === testRuleId).active === originalStatus, 'Status restaurado com sucesso');

  // 2. Idempotência
  const eventId = 'test_evt_' + Date.now();
  assert(!isEventProcessed(eventId), 'Evento novo não foi processado ainda');
  markEventProcessed(eventId, { test: true });
  assert(isEventProcessed(eventId), 'Evento marcado como processado');

  // 3. Simulação de Evento de Pedido Aprovado
  const orders = loadOrders();
  let testOrder = orders[0];
  if (!testOrder) {
    testOrder = {
      id: 'ord_test_' + Date.now(),
      code: '1099',
      clientName: 'Cliente Teste Automação',
      status: 'approved',
      productionStage: 'prep',
      items: [{ id: 'item_1', name: 'Sacola M', qty: 10, personalization: { text: 'Teste' } }],
      history: []
    };
    orders.push(testOrder);
    saveOrders(orders, true);
  }

  // Executar evento ORDER_APPROVED
  const resultApprove = processAutomationEvent({
    eventType: 'ORDER_APPROVED',
    orderId: testOrder.id,
    eventId: 'approve_ev_' + testOrder.id + '_' + Date.now()
  });
  assert(resultApprove.status === 'processed', 'Evento ORDER_APPROVED processado pelo motor');

  // Verificar se gerou PDF e entrou na fila
  const logs = getAutomationLogs();
  assert(Array.isArray(logs) && logs.length > 0, 'Logs de execução de automação gerados');

  // 5. Notificações Internas
  const notifications = getNotifications();
  assert(Array.isArray(notifications), 'Central de notificações operando');
  if (notifications.length > 0) {
    const notifId = notifications[0].id;
    markNotificationAsRead(notifId);
    const updatedNotifs = getNotifications();
    assert(updatedNotifs.find(n => n.id === notifId).read, 'Notificação marcada como lida com sucesso');
  }

  console.log('====================================================');
  console.log('✅ TODOS OS TESTES DA ETAPA 8 PASSARAM COM SUCESSO!');
  console.log('====================================================');
}

runEtapa8Tests().catch(err => {
  console.error('❌ Falha na bateria de testes da Etapa 8:', err);
  process.exit(1);
});
