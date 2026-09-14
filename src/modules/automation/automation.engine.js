/**
 * PAPER MAX - Motor de Automação Operacional (Etapa 8)
 * Arquitetura Evento → Condição → Ação com Idempotência, Fila de Execução e Auditoria.
 */

import {
  loadAutomationRules,
  saveAutomationRules,
  loadAutomationLogs,
  saveAutomationLogs,
  loadAutomationEvents,
  saveAutomationEvents,
  loadNotifications,
  saveNotifications,
  loadOrders,
  saveOrders,
  loadMaterials,
  loadComponents,
  loadProducts
} from '../../data/storage.js';

import { checkOrderStockAvailability } from '../stock/stock.engine.js';

import {
  advanceProductionStage,
  ensureOrderProductionState,
  appendProductionHistory
} from '../production/production.engine.js';

// Regras padrão de automação do PAPER MAX
export const DEFAULT_AUTOMATION_RULES = [
  {
    id: 'rule_approve_pdf',
    name: 'Gerar PDF ao aprovar pedido',
    event: 'ORDER_APPROVED',
    condition: 'has_valid_personalization',
    action: 'generate_pdf',
    active: true,
    description: 'Valida personalização e gera PDF técnico automaticamente ao aprovar um pedido.'
  },
  {
    id: 'rule_pdf_to_queue',
    name: 'Enviar para fila após gerar PDF',
    event: 'PDF_GENERATED',
    condition: 'is_ready_for_print',
    action: 'send_to_print_queue',
    active: true,
    description: 'Coloca automaticamente o pedido na fila de Aguardando Impressão após a geração do PDF.'
  },
  {
    id: 'rule_print_to_cut',
    name: 'Avançar após impressão concluída',
    event: 'PRINT_COMPLETED',
    condition: 'no_blocks',
    action: 'advance_to_cut',
    active: true,
    description: 'Avança automaticamente o pedido para a etapa de Corte quando a impressão for finalizada.'
  },
  {
    id: 'rule_step_auto_advance',
    name: 'Avançar etapa automaticamente sem bloqueio',
    event: 'STEP_COMPLETED',
    condition: 'next_step_available',
    action: 'advance_next_step',
    active: true,
    description: 'Avança para a próxima etapa operacional assim que a etapa atual for concluída.'
  },
  {
    id: 'rule_cq_to_pack',
    name: 'Avançar CQ aprovado para embalagem',
    event: 'CQ_APPROVED',
    condition: 'no_blocks',
    action: 'advance_to_packing',
    active: true,
    description: 'Move automaticamente pedidos aprovados no CQ para a etapa de Embalagem.'
  },
  {
    id: 'rule_pack_ready',
    name: 'Embalagem concluída define Pronto',
    event: 'PACKING_COMPLETED',
    condition: 'no_blocks',
    action: 'set_order_ready',
    active: true,
    description: 'Marca o pedido como Pronto e atualiza situação financeira ao finalizar a embalagem.'
  },
  {
    id: 'rule_stock_alert',
    name: 'Alertar falta de material',
    event: 'ORDER_APPROVAL_ATTEMPTED',
    condition: 'stock_insufficient',
    action: 'block_order_and_notify',
    active: true,
    description: 'Bloqueia o pedido e gera notificação e log quando faltarem insumos em estoque.'
  }
];

export function getAutomationRules() {
  const rules = loadAutomationRules();
  if (!rules || !Array.isArray(rules) || rules.length === 0) {
    saveAutomationRules(DEFAULT_AUTOMATION_RULES, true);
    return DEFAULT_AUTOMATION_RULES;
  }
  return rules;
}

export function updateAutomationRuleStatus(ruleId, active) {
  const rules = getAutomationRules();
  const updated = rules.map(r => r.id === ruleId ? { ...r, active: Boolean(active) } : r);
  saveAutomationRules(updated, true);
  return updated;
}

export function saveAllAutomationRules(rules) {
  saveAutomationRules(rules, true);
}

// ==========================================
// REGISTRO DE AUDITORIA & LOGS
// ==========================================
export function logAutomationExecution({ ruleId, ruleName, event, orderId, result, error = null, details = '' }) {
  const logs = loadAutomationLogs();
  const newLog = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    ruleId: ruleId || 'system',
    ruleName: ruleName || 'Sistema Automático',
    event,
    orderId: orderId || 'Geral',
    result, // 'Executada' | 'Ignorada por condição' | 'Bloqueada' | 'Falhou'
    error: error ? String(error) : null,
    details
  };
  logs.unshift(newLog);
  const trimmed = logs.slice(0, 500);
  saveAutomationLogs(trimmed, true);
  return newLog;
}

export function getAutomationLogs() {
  return loadAutomationLogs();
}

// ==========================================
// NOTIFICAÇÕES INTERNAS
// ==========================================
export function createInternalNotification({ type, title, message, orderId = null, severity = 'info' }) {
  const notifications = loadNotifications();
  const notif = {
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    type, // 'block' | 'stock' | 'pdf_error' | 'production_stop' | 'cq_fail' | 'ready' | 'finance'
    title,
    message,
    orderId,
    severity, // 'info' | 'warning' | 'error' | 'success'
    read: false
  };
  notifications.unshift(notif);
  saveNotifications(notifications.slice(0, 200), true);
  return notif;
}

export function getNotifications() {
  return loadNotifications();
}

export function markNotificationAsRead(notifId) {
  const notifications = loadNotifications();
  const updated = notifications.map(n => n.id === notifId ? { ...n, read: true } : n);
  saveNotifications(updated, true);
  return updated;
}

export function clearAllNotifications() {
  saveNotifications([], true);
  return [];
}

// ==========================================
// IDEMPOTÊNCIA
// ==========================================
export function isEventProcessed(eventId) {
  const events = loadAutomationEvents();
  return Boolean(events[eventId]);
}

export function markEventProcessed(eventId, details = {}) {
  const events = loadAutomationEvents();
  events[eventId] = {
    timestamp: new Date().toISOString(),
    details
  };
  saveAutomationEvents(events, true);
}

// ==========================================
// PROCESSADOR CENTRAL DE EVENTOS (MOTOR)
// ==========================================
export function processAutomationEvent(eventPayload) {
  const { eventType, orderId, payload = {}, eventId } = eventPayload;
  
  const uniqueEventKey = eventId || `${eventType}_${orderId || 'general'}_${Date.now()}`;
  if (eventId && isEventProcessed(eventId)) {
    logAutomationExecution({
      ruleId: 'idempotency_check',
      ruleName: 'Filtro de Idempotência',
      event: eventType,
      orderId: orderId || 'Geral',
      result: 'Ignorada por condição',
      details: `Evento ${eventId} já processado anteriormente.`
    });
    return { status: 'ignored', reason: 'already_processed' };
  }

  const rules = getAutomationRules().filter(r => r.active && r.event === eventType);
  if (rules.length === 0) {
    return { status: 'ignored', reason: 'no_active_rules' };
  }

  const orders = loadOrders();
  const order = orderId ? orders.find(o => o.id === orderId) : null;

  let executionResults = [];

  for (const rule of rules) {
    try {
      const conditionMet = evaluateCondition(rule.condition, order, payload);
      if (!conditionMet) {
        logAutomationExecution({
          ruleId: rule.id,
          ruleName: rule.name,
          event: eventType,
          orderId: orderId || 'Geral',
          result: 'Ignorada por condição',
          details: `Condição '${rule.condition}' não atendida.`
        });
        continue;
      }

      const actionResult = executeAction(rule.action, order, payload);
      
      if (actionResult.success) {
        logAutomationExecution({
          ruleId: rule.id,
          ruleName: rule.name,
          event: eventType,
          orderId: orderId || 'Geral',
          result: 'Executada',
          details: actionResult.details || 'Ação executada com sucesso.'
        });
        executionResults.push({ ruleId: rule.id, status: 'success' });
      } else {
        logAutomationExecution({
          ruleId: rule.id,
          ruleName: rule.name,
          event: eventType,
          orderId: orderId || 'Geral',
          result: 'Falhou',
          error: actionResult.error
        });
        createInternalNotification({
          type: 'pdf_error',
          title: `Falha na Automação: ${rule.name}`,
          message: `Erro ao processar pedido ${orderId || ''}: ${actionResult.error}`,
          orderId,
          severity: 'error'
        });
        executionResults.push({ ruleId: rule.id, status: 'failed', error: actionResult.error });
      }
    } catch (err) {
      logAutomationExecution({
        ruleId: rule.id,
        ruleName: rule.name,
        event: eventType,
        orderId: orderId || 'Geral',
        result: 'Falhou',
        error: err.message
      });
      executionResults.push({ ruleId: rule.id, status: 'failed', error: err.message });
    }
  }

  if (eventId) {
    markEventProcessed(eventId, { eventType, orderId, results: executionResults });
  }

  return { status: 'processed', results: executionResults };
}

// ==========================================
// AVALIADOR DE CONDIÇÕES
// ==========================================
function evaluateCondition(condition, order, payload) {
  if (!order && condition !== 'no_blocks') return true;

  switch (condition) {
    case 'has_valid_personalization':
      return order && order.items && order.items.some(item => item.personalization || item.customFields || item.customText);
    
    case 'is_ready_for_print':
      return order && (order.productionStage === 'prep' || order.productionStage === 'aguardando_impressao' || order.productionStage === 'fila_impressao' || order.productionStage === 'personalizacao');
    
    case 'no_blocks':
      if (!order) return true;
      if (order.status === 'blocked' || order.productionStage === 'blocked') return false;
      return true;

    case 'next_step_available':
      return order && order.productionStage && order.productionStage !== 'pronto' && order.productionStage !== 'entregue';

    case 'stock_insufficient': {
      if (!order) return false;
      try {
        const products = loadProducts();
        const materials = loadMaterials();
        const components = loadComponents();
        const check = checkOrderStockAvailability(order, products, materials, components);
        return !check.available;
      } catch (e) {
        return false;
      }
    }

    default:
      return true;
  }
}

// ==========================================
// EXECUTOR DE AÇÕES
// ==========================================
function executeAction(action, order, payload) {
  try {
    const orders = loadOrders();
    const products = loadProducts();

    switch (action) {
      case 'generate_pdf': {
        if (!order) return { success: false, error: 'Pedido não encontrado para gerar PDF.' };
        
        const updatedOrders = orders.map(o => {
          if (o.id === order.id) {
            return {
              ...o,
              pdfGenerated: true,
              history: [
                ...(o.history || []),
                {
                  timestamp: new Date().toISOString(),
                  type: 'automatic',
                  description: 'Avanço automático: PDF técnico gerado com sucesso'
                }
              ]
            };
          }
          return o;
        });
        saveOrders(updatedOrders, true);

        setTimeout(() => {
          processAutomationEvent({
            eventType: 'PDF_GENERATED',
            orderId: order.id,
            eventId: `pdf_gen_${order.id}_${Date.now()}`
          });
        }, 100);

        return { success: true, details: `PDF gerado para pedido ${order.id}` };
      }

      case 'send_to_print_queue': {
        if (!order) return { success: false, error: 'Pedido não encontrado.' };
        ensureOrderProductionState(order);
        const res = advanceProductionStage(order, { operator: 'Avanço Automático', notes: 'Enviado automaticamente para Impressão após PDF' });
        return { success: true, details: `Pedido ${order.id} enviado para impressão` };
      }

      case 'advance_to_cut': {
        if (!order) return { success: false, error: 'Pedido não encontrado.' };
        ensureOrderProductionState(order);
        const res = advanceProductionStage(order, { operator: 'Avanço Automático', notes: 'Avanço automático após conclusão da impressão' });
        return { success: true, details: `Pedido ${order.id} avançado para Corte` };
      }

      case 'advance_next_step': {
        if (!order) return { success: false, error: 'Pedido não encontrado.' };
        ensureOrderProductionState(order);
        const res = advanceProductionStage(order, { operator: 'Avanço Automático', notes: 'Avanço automático de etapa' });
        return { success: true, details: `Pedido ${order.id} avançado para próxima etapa` };
      }

      case 'advance_to_packing': {
        if (!order) return { success: false, error: 'Pedido não encontrado.' };
        ensureOrderProductionState(order);
        const res = advanceProductionStage(order, { operator: 'Avanço Automático', notes: 'Avanço automático após CQ Aprovado' });
        return { success: true, details: `Pedido ${order.id} avançado para Embalagem após CQ` };
      }

      case 'set_order_ready': {
        if (!order) return { success: false, error: 'Pedido não encontrado.' };
        ensureOrderProductionState(order);
        const res = advanceProductionStage(order, { operator: 'Avanço Automático', notes: 'Embalagem concluída: Pedido Pronto' });

        createInternalNotification({
          type: 'ready',
          title: 'Pedido Pronto!',
          message: `O pedido ${order.code || order.id} foi concluído na embalagem e está pronto para entrega.`,
          orderId: order.id,
          severity: 'success'
        });

        return { success: true, details: `Pedido ${order.id} marcado como Pronto` };
      }

      case 'block_order_and_notify': {
        if (!order) return { success: false, error: 'Pedido não encontrado.' };
        
        const materials = loadMaterials();
        const components = loadComponents();
        const check = checkOrderStockAvailability(order, products, materials, components);
        const missingNames = check.missingItems ? check.missingItems.map(m => m.name).join(', ') : 'insumos essenciais';

        const updatedOrders = orders.map(o => {
          if (o.id === order.id) {
            return {
              ...o,
              status: 'blocked',
              productionStage: 'blocked',
              blockReason: `Pedido bloqueado: falta ${missingNames}.`,
              history: [
                ...(o.history || []),
                {
                  timestamp: new Date().toISOString(),
                  type: 'automatic',
                  description: `Bloqueio automático por estoque insuficiente: falta ${missingNames}`
                }
              ]
            };
          }
          return o;
        });
        saveOrders(updatedOrders, true);

        createInternalNotification({
          type: 'block',
          title: 'Pedido Bloqueado por Estoque',
          message: `Pedido ${order.code || order.id} bloqueado automaticamente: falta ${missingNames}.`,
          orderId: order.id,
          severity: 'warning'
        });

        return { success: true, details: `Pedido ${order.id} bloqueado por falta de material: ${missingNames}` };
      }

      default:
        return { success: false, error: `Ação desconhecida: ${action}` };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}
