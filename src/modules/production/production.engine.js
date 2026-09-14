/**
 * PAPER MAX - Production Engine (Etapa 4)
 * Motor Operacional de Produção Integrada:
 * - Ciclo de vida: Aprovado → Produção → Personalização/PDF → Impressão → Corte → Vinco → Montagem → Acabamento → Conferência → Embalagem → Pronto → Entrega
 * - Status operacionais padronizados com LEDs discretos (🟡 🔵 🟠 🔴 🟢 ⚪)
 * - Fila de impressão funcional com PDFs reais da Etapa 3
 * - Controle de avanço e retorno de etapas com histórico persistente
 * - Controle de quantidade produzida vs pendente
 * - Conferência com identificação operacional (código de barras & QR code vetoriais SVG)
 * - Controle de qualidade com APROVADO / REPROVADO (motivo, quantidade e retorno de etapa)
 * - Embalagem e conclusão
 */

import { formatDateBR } from '../../utils/sanitize.js';

// ===================================================================
// 1. DEFINIÇÃO DAS ETAPAS OFICIAIS DO FLUXO PRODUTIVO
// ===================================================================
export const PRODUCTION_STAGES = [
  { id: 'aprovacao', name: 'Aprovação', icon: '📝', description: 'Validação comercial e de arte com o cliente' },
  { id: 'personalizacao', name: 'Personalização / PDF', icon: '📄', description: 'Conferência de dados variáveis e geração de PDF vetorial' },
  { id: 'impressao', name: 'Impressão', icon: '🖨', description: 'Fila de impressão e plotagem das folhas de produção' },
  { id: 'corte', name: 'Corte', icon: '✂', description: 'Guilhotina e plotter de corte de moldes e apliques' },
  { id: 'vinco', name: 'Vinco', icon: '📐', description: 'Vincagem precisa de dobras e linhas estruturais' },
  { id: 'montagem', name: 'Montagem', icon: '🧩', description: 'Colagem, fixação de alças, ilhós e montagem tridimensional' },
  { id: 'acabamento', name: 'Acabamento', icon: '✨', description: 'Laços, apliques 3D, laminação e detalhes decorativos' },
  { id: 'conferencia', name: 'Conferência & CQ', icon: '🔍', description: 'Inspeção de qualidade e identificação operacional' },
  { id: 'embalagem', name: 'Embalagem', icon: '📦', description: 'Acondicionamento protetor e preparação para entrega' },
  { id: 'pronto', name: 'Pronto', icon: '✓', description: 'Concluído e disponível para envio ou retirada' }
];

export const PRODUCTION_STAGE_ORDER = [
  'aprovacao',
  'personalizacao',
  'impressao',
  'corte',
  'vinco',
  'montagem',
  'acabamento',
  'conferencia',
  'embalagem',
  'pronto'
];

// ===================================================================
// 2. STATUS OPERACIONAIS & MAPEAMENTO DE LEDS
// ===================================================================
// LEDs definidos:
// 🟡 Aguardando
// 🟠 Atenção / Conferência
// 🔴 Problema / Bloqueado
// 🔵 Em andamento
// 🟢 Pronto / Concluído
// ⚪ Neutro
export const OPERATIONAL_STATUS_MAP = {
  // 🟡 Aguardando
  aguardando_aprovacao: {
    key: 'aguardando_aprovacao',
    label: 'Aguardando aprovação',
    stageId: 'aprovacao',
    ledColor: 'yellow',
    ledEmoji: '🟡',
    bg: '#fef3c7',
    border: '#fde68a',
    text: '#92400e',
    dot: '#d97706'
  },
  aguardando_impressao: {
    key: 'aguardando_impressao',
    label: 'Aguardando impressão',
    stageId: 'impressao',
    ledColor: 'yellow',
    ledEmoji: '🟡',
    bg: '#fef3c7',
    border: '#fde68a',
    text: '#92400e',
    dot: '#d97706'
  },

  // 🔵 Em andamento
  aprovado: {
    key: 'aprovado',
    label: 'Aprovado',
    stageId: 'aprovacao',
    ledColor: 'blue',
    ledEmoji: '🔵',
    bg: '#eff6ff',
    border: '#bfdbfe',
    text: '#1e40af',
    dot: '#2563eb'
  },
  em_personalizacao: {
    key: 'em_personalizacao',
    label: 'Em personalização',
    stageId: 'personalizacao',
    ledColor: 'blue',
    ledEmoji: '🔵',
    bg: '#eff6ff',
    border: '#bfdbfe',
    text: '#1e40af',
    dot: '#2563eb'
  },
  imprimindo: {
    key: 'imprimindo',
    label: 'Imprimindo',
    stageId: 'impressao',
    ledColor: 'blue',
    ledEmoji: '🔵',
    bg: '#eff6ff',
    border: '#bfdbfe',
    text: '#1e40af',
    dot: '#2563eb'
  },
  em_corte: {
    key: 'em_corte',
    label: 'Em corte',
    stageId: 'corte',
    ledColor: 'blue',
    ledEmoji: '🔵',
    bg: '#eff6ff',
    border: '#bfdbfe',
    text: '#1e40af',
    dot: '#2563eb'
  },
  em_vinco: {
    key: 'em_vinco',
    label: 'Em vinco',
    stageId: 'vinco',
    ledColor: 'blue',
    ledEmoji: '🔵',
    bg: '#eff6ff',
    border: '#bfdbfe',
    text: '#1e40af',
    dot: '#2563eb'
  },
  em_montagem: {
    key: 'em_montagem',
    label: 'Em montagem',
    stageId: 'montagem',
    ledColor: 'blue',
    ledEmoji: '🔵',
    bg: '#eff6ff',
    border: '#bfdbfe',
    text: '#1e40af',
    dot: '#2563eb'
  },
  em_acabamento: {
    key: 'em_acabamento',
    label: 'Em acabamento',
    stageId: 'acabamento',
    ledColor: 'blue',
    ledEmoji: '🔵',
    bg: '#eff6ff',
    border: '#bfdbfe',
    text: '#1e40af',
    dot: '#2563eb'
  },
  em_embalagem: {
    key: 'em_embalagem',
    label: 'Em embalagem',
    stageId: 'embalagem',
    ledColor: 'blue',
    ledEmoji: '🔵',
    bg: '#eff6ff',
    border: '#bfdbfe',
    text: '#1e40af',
    dot: '#2563eb'
  },

  // 🟠 Atenção
  em_conferencia: {
    key: 'em_conferencia',
    label: 'Em conferência',
    stageId: 'conferencia',
    ledColor: 'orange',
    ledEmoji: '🟠',
    bg: '#fff7ed',
    border: '#fed7aa',
    text: '#c2410c',
    dot: '#ea580c'
  },

  // 🔴 Problema / Bloqueado
  bloqueado: {
    key: 'bloqueado',
    label: 'Bloqueado',
    stageId: 'corte',
    ledColor: 'red',
    ledEmoji: '🔴',
    bg: '#fef2f2',
    border: '#fecaca',
    text: '#991b1b',
    dot: '#dc2626'
  },

  // 🟢 Pronto / Concluído
  pronto: {
    key: 'pronto',
    label: 'Pronto',
    stageId: 'pronto',
    ledColor: 'green',
    ledEmoji: '🟢',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    text: '#065f46',
    dot: '#059669'
  },

  // ⚪ Neutro
  entregue: {
    key: 'entregue',
    label: 'Entregue',
    stageId: 'pronto',
    ledColor: 'neutral',
    ledEmoji: '⚪',
    bg: '#f8fafc',
    border: '#e2e8f0',
    text: '#475569',
    dot: '#64748b'
  },
  cancelado: {
    key: 'cancelado',
    label: 'Cancelado',
    stageId: 'aprovacao',
    ledColor: 'neutral',
    ledEmoji: '⚪',
    bg: '#f8fafc',
    border: '#e2e8f0',
    text: '#475569',
    dot: '#64748b'
  }
};

// Aliases para compatibilidade reversa com códigos antigos
export const STATUS_ALIAS_MAP = {
  yellow: 'aguardando_aprovacao',
  blue: 'em_corte',
  orange: 'em_conferencia',
  red: 'bloqueado',
  green: 'pronto',
  neutral: 'entregue'
};

/**
 * Normaliza qualquer chave de status (seja 'blue', 'em_corte', 'Em produção', etc.)
 * para a definição completa de OPERATIONAL_STATUS_MAP.
 */
export function getStatusDefinition(statusKey, statusLabel) {
  if (statusKey && OPERATIONAL_STATUS_MAP[statusKey]) {
    return OPERATIONAL_STATUS_MAP[statusKey];
  }

  // Tenta pelo alias legado (yellow, blue, red, green, orange, neutral)
  if (statusKey && STATUS_ALIAS_MAP[statusKey]) {
    return OPERATIONAL_STATUS_MAP[STATUS_ALIAS_MAP[statusKey]];
  }

  // Busca por match de texto no label
  if (statusLabel) {
    const cleanLbl = statusLabel.toLowerCase();
    for (const item of Object.values(OPERATIONAL_STATUS_MAP)) {
      if (item.label.toLowerCase() === cleanLbl) {
        return item;
      }
    }
    if (cleanLbl.includes('impressão') || cleanLbl.includes('impressao')) return OPERATIONAL_STATUS_MAP.aguardando_impressao;
    if (cleanLbl.includes('corte')) return OPERATIONAL_STATUS_MAP.em_corte;
    if (cleanLbl.includes('vinco')) return OPERATIONAL_STATUS_MAP.em_vinco;
    if (cleanLbl.includes('montagem')) return OPERATIONAL_STATUS_MAP.em_montagem;
    if (cleanLbl.includes('acabamento')) return OPERATIONAL_STATUS_MAP.em_acabamento;
    if (cleanLbl.includes('conferência') || cleanLbl.includes('conferencia')) return OPERATIONAL_STATUS_MAP.em_conferencia;
    if (cleanLbl.includes('embalagem')) return OPERATIONAL_STATUS_MAP.em_embalagem;
    if (cleanLbl.includes('pronto')) return OPERATIONAL_STATUS_MAP.pronto;
    if (cleanLbl.includes('entregue')) return OPERATIONAL_STATUS_MAP.entregue;
    if (cleanLbl.includes('cancelado')) return OPERATIONAL_STATUS_MAP.cancelado;
    if (cleanLbl.includes('bloqueado')) return OPERATIONAL_STATUS_MAP.bloqueado;
  }

  return OPERATIONAL_STATUS_MAP.aguardando_aprovacao;
}

// ===================================================================
// 3. ESTRUTURA DE DADOS DE PRODUÇÃO & SNAPSHOT OPERACIONAL
// ===================================================================
/**
 * Inicializa ou migra a estrutura de produção em um pedido.
 */
export function ensureOrderProductionState(order) {
  if (!order) return null;

  const totalQty = parseInt(order.qty, 10) || 1;
  const existingProd = order.production || {};

  const currentStage = existingProd.currentStage || deriveInitialStageFromStatus(order.status, order.statusLabel);
  const stageStatus = existingProd.stageStatus || order.status || 'aguardando_aprovacao';
  const producedQty = existingProd.producedQty !== undefined 
    ? Math.min(totalQty, Math.max(0, parseInt(existingProd.producedQty, 10) || 0))
    : (order.status === 'green' || order.status === 'pronto' ? totalQty : 0);
  const pendingQty = Math.max(0, totalQty - producedQty);

  const initialHistory = Array.isArray(existingProd.history) && existingProd.history.length > 0
    ? existingProd.history
    : [
        {
          id: `hist_${Date.now()}_init`,
          stage: currentStage,
          status: order.statusLabel || 'Pedido registrado',
          timestamp: order.createdAt || new Date().toISOString(),
          formattedTime: formatDateBR(order.createdAt || new Date()),
          operator: 'Sistema Paper Max',
          notes: order.notes || 'Pedido cadastrado no sistema.'
        }
      ];

  const primaryFile = Array.isArray(order.generatedFiles) && order.generatedFiles.length > 0
    ? order.generatedFiles[0]
    : null;

  const printJob = existingProd.printJob || {
    fileId: primaryFile ? primaryFile.fileId : null,
    fileName: primaryFile ? primaryFile.fileName : null,
    priority: existingProd.priority || 'normal', // 'normal' | 'alta' | 'urgente'
    status: currentStage === 'impressao' ? 'imprimindo' : 'aguardando_impressao',
    startedAt: null,
    completedAt: null
  };

  const qualityControl = existingProd.qualityControl || {
    status: 'pendente', // 'pendente' | 'aprovado' | 'reprovado'
    inspectedAt: null,
    inspectedBy: null,
    defectReason: null,
    defectNotes: null,
    affectedQty: 0
  };

  const packaging = existingProd.packaging || {
    status: 'pendente', // 'pendente' | 'em_andamento' | 'concluido'
    startedAt: null,
    completedAt: null,
    notes: ''
  };

  order.production = {
    active: existingProd.active !== undefined ? existingProd.active : (order.status !== 'yellow' && order.status !== 'aguardando_aprovacao'),
    operationalCode: existingProd.operationalCode || `OP-${order.number || order.id}`,
    currentStage,
    stageStatus,
    totalQty,
    producedQty,
    pendingQty,
    history: initialHistory,
    printJob,
    qualityControl,
    packaging,
    stockDeducted: existingProd.stockDeducted || false,
    stockDeductedAt: existingProd.stockDeductedAt || null,
    stockDeductedBy: existingProd.stockDeductedBy || null
  };

  return order;
}

function deriveInitialStageFromStatus(status, statusLabel) {
  const lbl = (statusLabel || '').toLowerCase();
  if (status === 'green' || status === 'pronto' || lbl.includes('pronto')) return 'pronto';
  if (status === 'neutral' || status === 'entregue' || lbl.includes('entregue')) return 'pronto';
  if (lbl.includes('impress')) return 'impressao';
  if (lbl.includes('corte')) return 'corte';
  if (lbl.includes('vinco')) return 'vinco';
  if (lbl.includes('montagem')) return 'montagem';
  if (lbl.includes('acabamento')) return 'acabamento';
  if (lbl.includes('confer')) return 'conferencia';
  if (lbl.includes('embal')) return 'embalagem';
  if (status === 'blue') return 'corte';
  return 'aprovacao';
}

// ===================================================================
// 4. MUDANÇAS DE ETAPA & HISTÓRICO PERSISTENTE
// ===================================================================
/**
 * Registra um evento de histórico de produção imutável.
 */
export function appendProductionHistory(order, { stage, status, operator = 'Operador Produção', notes = '' }) {
  ensureOrderProductionState(order);
  const now = new Date();
  const entry = {
    id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    stage: stage || order.production.currentStage,
    status: status || order.statusLabel,
    timestamp: now.toISOString(),
    formattedTime: formatDateWithHoursBR(now),
    operator,
    notes: (notes || '').trim()
  };

  order.production.history.push(entry);
  return entry;
}

/**
 * Ação: Aprovar Pedido
 */
export function approveOrder(order, { operator = 'Comercial', notes = 'Pedido aprovado pelo cliente.' } = {}) {
  ensureOrderProductionState(order);
  const def = OPERATIONAL_STATUS_MAP.aprovado;
  order.status = def.key;
  order.statusLabel = def.label;
  order.production.stageStatus = def.key;
  order.production.currentStage = 'aprovacao';
  order.production.approvedAt = new Date().toISOString();

  appendProductionHistory(order, {
    stage: 'aprovacao',
    status: 'Pedido aprovado',
    operator,
    notes
  });

  order.updatedAt = new Date().toISOString();
  return { success: true, order };
}

/**
 * Ação: "Enviar para produção"
 * Verifica se já existe PDF gerado vinculado. Se não houver, indica claramente a pendência.
 */
export function sendOrderToProduction(order, { operator = 'Operador Produção', notes = '' } = {}) {
  ensureOrderProductionState(order);

  const hasPdf = Array.isArray(order.generatedFiles) && order.generatedFiles.length > 0;
  order.production.active = true;
  order.production.startedAt = new Date().toISOString();

  let nextStatus;
  let nextStage;
  let eventNotes;

  if (hasPdf) {
    nextStage = 'impressao';
    nextStatus = OPERATIONAL_STATUS_MAP.aguardando_impressao;
    eventNotes = notes || 'Enviado para produção. PDF vetorial pronto na fila de impressão.';
    order.production.printJob.fileId = order.generatedFiles[0].fileId;
    order.production.printJob.fileName = order.generatedFiles[0].fileName;
    order.production.printJob.status = 'aguardando_impressao';
  } else {
    // Pendência clara de PDF
    nextStage = 'personalizacao';
    nextStatus = OPERATIONAL_STATUS_MAP.em_personalizacao;
    eventNotes = notes || 'Enviado para produção. Pendência: PDF do pedido precisa ser gerado antes da impressão.';
  }

  order.status = nextStatus.key;
  order.statusLabel = nextStatus.label;
  order.production.currentStage = nextStage;
  order.production.stageStatus = nextStatus.key;

  appendProductionHistory(order, {
    stage: nextStage,
    status: nextStatus.label,
    operator,
    notes: eventNotes
  });

  order.updatedAt = new Date().toISOString();
  return { order, hasPdf, pendingPdf: !hasPdf };
}

/**
 * Ação: Avançar etapa de produção controlada
 */
export function advanceProductionStage(order, { operator = 'Operador Produção', notes = '' } = {}) {
  ensureOrderProductionState(order);
  const currentStage = order.production.currentStage;
  const currentIndex = PRODUCTION_STAGE_ORDER.indexOf(currentStage);

  if (currentIndex === -1 || currentIndex >= PRODUCTION_STAGE_ORDER.length - 1) {
    return { success: false, message: 'O pedido já está na última etapa da produção.' };
  }

  const nextStage = PRODUCTION_STAGE_ORDER[currentIndex + 1];
  let nextStatusKey;

  switch (nextStage) {
    case 'personalizacao':
      nextStatusKey = 'em_personalizacao';
      break;
    case 'impressao':
      nextStatusKey = 'aguardando_impressao';
      break;
    case 'corte':
      nextStatusKey = 'em_corte';
      break;
    case 'vinco':
      nextStatusKey = 'em_vinco';
      break;
    case 'montagem':
      nextStatusKey = 'em_montagem';
      break;
    case 'acabamento':
      nextStatusKey = 'em_acabamento';
      break;
    case 'conferencia':
      nextStatusKey = 'em_conferencia';
      break;
    case 'embalagem':
      nextStatusKey = 'em_embalagem';
      break;
    case 'pronto':
      nextStatusKey = 'pronto';
      // Conclui quantidade se não foi preenchida
      if (order.production.producedQty < order.qty) {
        order.production.producedQty = order.qty;
        order.production.pendingQty = 0;
      }
      break;
    default:
      nextStatusKey = 'em_corte';
  }

  const statusDef = OPERATIONAL_STATUS_MAP[nextStatusKey] || OPERATIONAL_STATUS_MAP.em_corte;
  order.status = statusDef.key;
  order.statusLabel = statusDef.label;
  order.production.currentStage = nextStage;
  order.production.stageStatus = statusDef.key;

  const stageObj = PRODUCTION_STAGES.find(s => s.id === nextStage);
  const defaultNote = `Avançado para ${stageObj ? stageObj.name : nextStage}.`;

  appendProductionHistory(order, {
    stage: nextStage,
    status: statusDef.label,
    operator,
    notes: notes || defaultNote
  });

  order.updatedAt = new Date().toISOString();
  return { success: true, nextStage, statusLabel: statusDef.label };
}

/**
 * Ação: Retornar etapa anterior de produção
 */
export function returnProductionStage(order, targetStageId, { operator = 'Operador Produção', reason = '', notes = '' } = {}) {
  ensureOrderProductionState(order);

  const targetStage = PRODUCTION_STAGES.find(s => s.id === targetStageId);
  if (!targetStage) {
    throw new Error('Etapa de destino inválida para retorno.');
  }

  let targetStatusKey;
  switch (targetStageId) {
    case 'aprovacao':
      targetStatusKey = 'aprovado';
      break;
    case 'personalizacao':
      targetStatusKey = 'em_personalizacao';
      break;
    case 'impressao':
      targetStatusKey = 'aguardando_impressao';
      break;
    case 'corte':
      targetStatusKey = 'em_corte';
      break;
    case 'vinco':
      targetStatusKey = 'em_vinco';
      break;
    case 'montagem':
      targetStatusKey = 'em_montagem';
      break;
    case 'acabamento':
      targetStatusKey = 'em_acabamento';
      break;
    case 'conferencia':
      targetStatusKey = 'em_conferencia';
      break;
    case 'embalagem':
      targetStatusKey = 'em_embalagem';
      break;
    default:
      targetStatusKey = 'em_corte';
  }

  const statusDef = OPERATIONAL_STATUS_MAP[targetStatusKey] || OPERATIONAL_STATUS_MAP.em_corte;
  order.status = statusDef.key;
  order.statusLabel = statusDef.label;
  order.production.currentStage = targetStageId;
  order.production.stageStatus = statusDef.key;

  const reasonDesc = reason ? `Motivo: ${reason}. ` : '';
  const fullNote = `Retornado para ${targetStage.name}. ${reasonDesc}${notes || ''}`.trim();

  appendProductionHistory(order, {
    stage: targetStageId,
    status: `Retorno para ${targetStage.name}`,
    operator,
    notes: fullNote
  });

  order.updatedAt = new Date().toISOString();
  return { success: true, targetStage: targetStage.name };
}

// ===================================================================
// 5. CONTROLE DE QUANTIDADE PRODUZIDA VS PENDENTE
// ===================================================================
export function updateProductionQuantity(order, producedQty, { operator = 'Operador Produção', notes = '' } = {}) {
  ensureOrderProductionState(order);
  const total = order.qty || 1;
  const numProduced = Math.min(total, Math.max(0, parseInt(producedQty, 10) || 0));
  const numPending = Math.max(0, total - numProduced);

  const prevProduced = order.production.producedQty;
  order.production.producedQty = numProduced;
  order.production.pendingQty = numPending;
  order.production.totalQty = total;

  if (prevProduced !== numProduced) {
    appendProductionHistory(order, {
      stage: order.production.currentStage,
      status: `Contagem: ${numProduced}/${total} un produzidas`,
      operator,
      notes: notes || `Produzidas: ${numProduced} un | Pendentes: ${numPending} un.`
    });
  }

  order.updatedAt = new Date().toISOString();
  return { producedQty: numProduced, pendingQty: numPending, totalQty: total };
}

// ===================================================================
// 6. FILA DE IMPRESSÃO INTEGRADA
// ===================================================================
export const PRINT_ACTIONS = {
  START: 'start',
  PAUSE: 'pause',
  COMPLETE: 'complete',
  RETURN: 'return',
  INICIAR: 'start',
  PAUSAR: 'pause',
  CONCLUIR: 'complete',
  RETORNAR: 'return'
};

export function updatePrintJob(order, action, { operator = 'Operador de Impressão', notes = '' } = {}) {
  ensureOrderProductionState(order);
  const pj = order.production.printJob;

  const normalizedAction = {
    iniciar: PRINT_ACTIONS.START,
    start: PRINT_ACTIONS.START,
    pausar: PRINT_ACTIONS.PAUSE,
    pause: PRINT_ACTIONS.PAUSE,
    concluir: PRINT_ACTIONS.COMPLETE,
    complete: PRINT_ACTIONS.COMPLETE,
    retornar: PRINT_ACTIONS.RETURN,
    return: PRINT_ACTIONS.RETURN
  }[action] || action;

  let actionMessage = 'Operação de impressão realizada com sucesso.';

  switch (normalizedAction) {
    case PRINT_ACTIONS.START:
      pj.status = 'imprimindo';
      pj.startedAt = new Date().toISOString();
      order.status = 'imprimindo';
      order.statusLabel = OPERATIONAL_STATUS_MAP.imprimindo.label;
      order.production.currentStage = 'impressao';
      order.production.stageStatus = 'imprimindo';

      appendProductionHistory(order, {
        stage: 'impressao',
        status: 'Impressão iniciada',
        operator,
        notes: notes || 'Arquivo enviado para a impressora / plotter.'
      });
      actionMessage = 'Impressão iniciada!';
      break;

    case PRINT_ACTIONS.PAUSE:
      pj.status = 'pausada';
      order.status = 'aguardando_impressao';
      order.statusLabel = 'Impressão pausada';
      order.production.stageStatus = 'aguardando_impressao';

      appendProductionHistory(order, {
        stage: 'impressao',
        status: 'Impressão pausada',
        operator,
        notes: notes || 'Impressão colocada em espera temporária.'
      });
      actionMessage = 'Impressão pausada.';
      break;

    case PRINT_ACTIONS.COMPLETE:
      pj.status = 'concluida';
      pj.completedAt = new Date().toISOString();

      // Avança para Corte
      order.status = 'em_corte';
      order.statusLabel = OPERATIONAL_STATUS_MAP.em_corte.label;
      order.production.currentStage = 'corte';
      order.production.stageStatus = 'em_corte';

      appendProductionHistory(order, {
        stage: 'impressao',
        status: 'Impressão concluída',
        operator,
        notes: notes || 'Impressão das folhas finalizada com sucesso. Enviado para corte.'
      });
      actionMessage = 'Impressão concluída! Pedido avançado para Corte.';
      break;

    case PRINT_ACTIONS.RETURN:
      pj.status = 'aguardando_impressao';
      pj.startedAt = null;
      order.status = 'aguardando_impressao';
      order.statusLabel = OPERATIONAL_STATUS_MAP.aguardando_impressao.label;
      order.production.stageStatus = 'aguardando_impressao';

      appendProductionHistory(order, {
        stage: 'impressao',
        status: 'Retornado para fila de impressão',
        operator,
        notes: notes || 'Retornado para aguardando impressão.'
      });
      actionMessage = 'Retornado para fila de impressão.';
      break;

    default:
      throw new Error(`Ação de impressão desconhecida: ${action}`);
  }

  order.updatedAt = new Date().toISOString();
  return { success: true, message: actionMessage, order, printJob: pj };
}

/**
 * Ação: Marcar pedido como Entregue (neutral)
 */
export function markOrderDelivered(order, { operator = 'Operador Expedição', notes = '' } = {}) {
  ensureOrderProductionState(order);

  const statusDef = OPERATIONAL_STATUS_MAP.entregue;
  order.status = statusDef.key;
  order.statusLabel = statusDef.label;
  order.deliveredAt = new Date().toISOString();
  order.production.stageStatus = statusDef.key;

  // Garante contagem integral produzida
  if (order.production.producedQty < order.qty) {
    order.production.producedQty = order.qty;
    order.production.pendingQty = 0;
  }

  appendProductionHistory(order, {
    stage: 'pronto',
    status: statusDef.label,
    operator,
    notes: notes || 'Pedido entregue ao cliente / despachado com sucesso.'
  });

  order.updatedAt = new Date().toISOString();
  return { success: true, order, statusLabel: statusDef.label, message: `Pedido ${order.number || order.id} marcado como Entregue!` };
}

// ===================================================================
// 7. CONTROLE DE QUALIDADE (CQ / CONFERÊNCIA)
// ===================================================================
export const DEFECT_REASONS = [
  { id: 'impressao_incorreta', name: 'Impressão incorreta / Falha de tinta', label: 'Impressão incorreta / Falha de tinta', returnStage: 'impressao' },
  { id: 'corte_incorreto', name: 'Corte incorreto / Desalinhado', label: 'Corte incorreto / Desalinhado', returnStage: 'corte' },
  { id: 'personalizacao_incorreta', name: 'Personalização incorreta / Erro de grafia', label: 'Personalização incorreta / Erro de grafia', returnStage: 'personalizacao' },
  { id: 'material_danificado', name: 'Material danificado / Amassado / Manchado', label: 'Material danificado / Amassado / Manchado', returnStage: 'impressao' },
  { id: 'montagem_incorreta', name: 'Montagem incorreta / Colagem irregular', label: 'Montagem incorreta / Colagem irregular', returnStage: 'montagem' },
  { id: 'outro', name: 'Outro problema de qualidade', label: 'Outro problema de qualidade', returnStage: 'corte' }
];

export const QC_DEFECT_REASONS = DEFECT_REASONS;

export function submitQualityControl(order, { decision, reasonId, affectedQty = 1, returnStageId, operator = 'Inspetor CQ', notes = '' }) {
  ensureOrderProductionState(order);

  if (decision === 'aprovado') {
    order.production.qualityControl = {
      status: 'aprovado',
      inspectedAt: new Date().toISOString(),
      inspectedBy: operator,
      notes: notes || 'Aprovado no controle de qualidade.'
    };

    // Avança para embalagem
    order.status = 'em_embalagem';
    order.statusLabel = OPERATIONAL_STATUS_MAP.em_embalagem.label;
    order.production.currentStage = 'embalagem';
    order.production.stageStatus = 'em_embalagem';

    appendProductionHistory(order, {
      stage: 'conferencia',
      status: 'Controle de Qualidade: APROVADO',
      operator,
      notes: notes || 'Todas as especificações técnicas e visuais foram validadas. Liberado para embalagem.'
    });

    order.updatedAt = new Date().toISOString();
    return { success: true, decision: 'aprovado', nextStage: 'embalagem' };
  }

  if (decision === 'reprovado') {
    const reasonObj = DEFECT_REASONS.find(r => r.id === reasonId) || DEFECT_REASONS[0];
    const targetStage = returnStageId || reasonObj.returnStage || 'impressao';

    order.production.qualityControl = {
      status: 'reprovado',
      defectReason: reasonObj.name,
      defectReasonId: reasonObj.id,
      affectedQty: Math.max(1, parseInt(affectedQty, 10) || 1),
      returnStage: targetStage,
      inspectedAt: new Date().toISOString(),
      inspectedBy: operator,
      defectNotes: notes || ''
    };

    // Bloqueia e retorna para a etapa necessária
    returnProductionStage(order, targetStage, {
      operator,
      reason: `CQ Reprovado: ${reasonObj.name} (${order.production.qualityControl.affectedQty} un afetadas)`,
      notes: notes || 'Necessário refazer ou corrigir as peças afetadas.'
    });

    // O status fica como bloqueado ou na etapa com alerta
    order.status = 'bloqueado';
    order.statusLabel = `Bloqueado: CQ Reprovado (${reasonObj.name})`;

    order.updatedAt = new Date().toISOString();
    return {
      success: true,
      decision: 'reprovado',
      targetStage,
      reason: reasonObj.name,
      affectedQty: order.production.qualityControl.affectedQty
    };
  }

  throw new Error('Decisão de controle de qualidade inválida (esperado "aprovado" ou "reprovado").');
}

// ===================================================================
// 8. EMBALAGEM & CONCLUSÃO
// ===================================================================
export function updatePackagingStage(order, { action = 'complete', operator = 'Operador Embalagem', notes = '' } = {}) {
  ensureOrderProductionState(order);
  const pkg = order.production.packaging;

  if (action === 'start') {
    pkg.status = 'em_andamento';
    pkg.startedAt = new Date().toISOString();
    order.status = 'em_embalagem';
    order.statusLabel = OPERATIONAL_STATUS_MAP.em_embalagem.label;
    order.production.currentStage = 'embalagem';

    appendProductionHistory(order, {
      stage: 'embalagem',
      status: 'Embalagem iniciada',
      operator,
      notes: notes || 'Itens em processo de acondicionamento final.'
    });
  } else if (action === 'complete') {
    pkg.status = 'concluido';
    pkg.completedAt = new Date().toISOString();
    pkg.notes = notes || '';

    // Finaliza pedido para PRONTO
    order.status = 'pronto';
    order.statusLabel = OPERATIONAL_STATUS_MAP.pronto.label;
    order.production.currentStage = 'pronto';
    order.production.stageStatus = 'pronto';
    order.production.producedQty = order.qty;
    order.production.pendingQty = 0;

    appendProductionHistory(order, {
      stage: 'embalagem',
      status: 'Embalagem concluída',
      operator,
      notes: notes || 'Pedido embalado, etiquetado e pronto para entrega/retirada.'
    });

    appendProductionHistory(order, {
      stage: 'pronto',
      status: 'Pronto para entrega',
      operator,
      notes: 'Fluxo produtivo 100% concluído com sucesso.'
    });
  }

  order.updatedAt = new Date().toISOString();
  return { order, packaging: pkg };
}

// ===================================================================
// 9. CONFERÊNCIA: ETIQUETA OPERACIONAL, CÓDIGO DE BARRAS & QR CODE VETORIAL
// ===================================================================
/**
 * Gera um SVG vetorial de código de barras limpo (Padrão visual Code 128 / Code 39)
 */
export function generateBarcodeSvg(codeText, { width = 220, height = 48 } = {}) {
  const safeText = String(codeText || 'OP-1000').toUpperCase().replace(/[^A-Z0-9-]/g, '');
  // Converte caracteres em sequência pseudo-aleatória determinística de barras
  let hash = 0;
  for (let i = 0; i < safeText.length; i++) {
    hash = (hash << 5) - hash + safeText.charCodeAt(i);
    hash |= 0;
  }

  // Gera 45 barras verticais com espessuras variadas (1, 2, 3px)
  let bars = [];
  let currentX = 10;
  const barHeight = height - 16;

  for (let i = 0; i < 42; i++) {
    const bit = Math.abs((hash ^ (i * 37) ^ (i << 2)) % 7);
    const barWidth = bit < 2 ? 2 : bit < 5 ? 3 : 4;
    const space = (bit % 3) + 2;

    bars.push(`<rect x="${currentX}" y="4" width="${barWidth}" height="${barHeight}" fill="#0f172a" />`);
    currentX += barWidth + space;
  }

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${currentX + 10} ${height}" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">
      <rect width="100%" height="100%" fill="#ffffff" />
      ${bars.join('')}
      <text x="${(currentX + 10) / 2}" y="${height - 2}" font-family="monospace" font-size="11" font-weight="bold" fill="#0f172a" text-anchor="middle" letter-spacing="2">${safeText}</text>
    </svg>
  `;
}

/**
 * Gera um SVG vetorial de QR Code proporcional estilizado
 */
export function generateQrCodeSvg(dataText, { size = 100 } = {}) {
  const safeData = String(dataText || 'PAPERMAX');
  const gridSize = 21; // QR Code Version 1 standard 21x21 matrix
  const cellSize = (size - 8) / gridSize;

  // Gerador determinístico de matriz 21x21 baseado em hash do texto
  const matrix = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));

  // 1. Finder patterns (cantos superiores esquerdo/direito e inferior esquerdo)
  function drawFinder(rStart, cStart) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[rStart + r][cStart + c] = 1;
        }
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(0, 14);
  drawFinder(14, 0);

  // 2. Timing patterns
  for (let i = 8; i < 13; i++) {
    matrix[6][i] = i % 2 === 0 ? 1 : 0;
    matrix[i][6] = i % 2 === 0 ? 1 : 0;
  }

  // 3. Preenchimento de dados baseado em hash
  let charSum = 0;
  for (let i = 0; i < safeData.length; i++) {
    charSum += safeData.charCodeAt(i) * (i + 1);
  }

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      // Ignora finders
      const inFinder1 = r < 8 && c < 8;
      const inFinder2 = r < 8 && c >= 13;
      const inFinder3 = r >= 13 && c < 8;
      if (!inFinder1 && !inFinder2 && !inFinder3 && matrix[r][c] === 0) {
        const val = ((r * 17 + c * 31 + charSum) ^ (r << 1)) % 11;
        if (val < 5) matrix[r][c] = 1;
      }
    }
  }

  const cells = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (matrix[r][c] === 1) {
        cells.push(`<rect x="${4 + c * cellSize}" y="${4 + r * cellSize}" width="${cellSize - 0.2}" height="${cellSize - 0.2}" fill="#0f172a" />`);
      }
    }
  }

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff;">
      <rect width="${size}" height="${size}" fill="#ffffff" rx="4" />
      ${cells.join('')}
    </svg>
  `;
}

/**
 * Gera os dados completos e HTML renderizado da Etiqueta Operacional de Conferência
 */
export function generateOperationalLabelData(order) {
  ensureOrderProductionState(order);
  const snap = order.productSnapshot || {};
  const opCode = order.production.operationalCode || `OP-${order.number || order.id}`;
  const qrData = `PAPERMAX|${opCode}|PED-${order.number}|CLI-${order.customer}|PROD-${order.productTitle}|QTD-${order.qty}`;

  return {
    opCode,
    orderNumber: order.number || order.id,
    customer: order.customer,
    productTitle: order.productTitle,
    qty: order.qty,
    deliveryDate: order.deliveryDate,
    personalization: order.personalization || {},
    changeOptions: order.changeOptions || {},
    barcodeSvg: generateBarcodeSvg(opCode),
    qrCodeSvg: generateQrCodeSvg(qrData),
    checklist: [
      { id: 'chk_impressao', label: 'Impressão Vetorial (300 DPI)' },
      { id: 'chk_corte', label: 'Corte e Margens de Sangria' },
      { id: 'chk_vinco', label: 'Vincagem e Dobradura' },
      { id: 'chk_montagem', label: 'Montagem e Fixação' },
      { id: 'chk_personalizacao', label: 'Conferência de Grafia e Dados' },
      { id: 'chk_acabamento', label: 'Laços / Ilhós / Acabamentos' }
    ]
  };
}

// ===================================================================
// UTILITÁRIO DE DATA COM HORÁRIO
// ===================================================================
function formatDateWithHoursBR(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '--/--/---- --:--';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}`;
}
