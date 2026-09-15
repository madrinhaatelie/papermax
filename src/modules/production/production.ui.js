/**
 * PAPER MAX - Production Operational UI Module (Etapa 4)
 * Handles Stepper rendering, Operational controls, Quality Control (CQ) modal,
 * Quantity adjustments, Stage returns, and Operational Label inspection with SVG barcode/QR.
 */

import {
  PRODUCTION_STAGES,
  PRODUCTION_STAGE_ORDER,
  DEFECT_REASONS,
  DISPLAY_PRODUCTION_STAGES,
  getStageTimelineData,
  generateOperationalLabelData
} from './production.engine.js';
import {
  approveOrderById,
  sendOrderToProductionById,
  advanceOrderStageById,
  returnOrderStageById,
  updateOrderQuantityById,
  updateOrderPrintJobById,
  submitOrderQCById,
  updateOrderPackagingById,
  markOrderDeliveredById
} from '../orders/orders.js';
import { escapeHtml, formatDateBR } from '../../utils/sanitize.js';

/**
 * Generates the visual Production Stepper HTML (Vertical Timeline with Date and Time History)
 */
export function renderTimelineStepperHtml(order) {
  const prod = order.production || {};
  const currentStage = prod.currentStage || 'aprovacao';

  const timelineStages = getStageTimelineData(order);
  const isReady = order.status === 'pronto' || order.status === 'green' || currentStage === 'pronto' || currentStage === 'concluido' || order.status === 'entregue' || order.status === 'entregues';
  const currentStageDef = DISPLAY_PRODUCTION_STAGES.find(s => s.id === currentStage);

  return `
    <div class="prod-stepper-wrap vertical-stepper-wrap" id="order-stepper-wrap">
      <div class="prod-stepper-title">
        <span style="display: flex; align-items: center; gap: 6px;">
          <span>📋</span> Linha do Tempo de Produção
        </span>
        <span style="font-size: 11px; font-weight: 600; color: var(--accent-primary); background: #fdf2f8; padding: 2px 8px; border-radius: 999px;">
          ${isReady ? '✓ Concluído' : (currentStageDef ? currentStageDef.label : 'Em Produção')}
        </span>
      </div>
      <div class="prod-stepper-vertical">
        ${timelineStages.map((stage, idx) => {
          const stateClass = stage.state; // 'done' | 'current' | 'pending'
          const badgeText = stage.state === 'done' ? 'Concluída' : (stage.state === 'current' ? 'Em Andamento' : 'Pendente');
          const isLast = idx === timelineStages.length - 1;

          return `
            <div class="prod-step-vertical-item ${stateClass}">
              <div class="prod-step-vertical-left">
                <div class="prod-step-dot ${stateClass}">
                  ${stateClass === 'done' ? '✓' : stage.icon}
                </div>
                ${!isLast ? '<div class="prod-step-vertical-line"></div>' : ''}
              </div>
              <div class="prod-step-vertical-content">
                <div class="prod-step-vertical-header">
                  <span class="prod-step-label">${escapeHtml(stage.label)}</span>
                  <span class="prod-step-vertical-badge ${stateClass}">${badgeText}</span>
                </div>

                <!-- Histórico Detalhado com Horário e Data de Cada Alteração -->
                <div class="prod-step-timeline-box">
                  <div class="prod-timeline-row">
                    <span class="timeline-row-label">Início</span>
                    <span class="timeline-row-date ${stage.startDate === '—' ? 'text-muted' : ''}">${escapeHtml(stage.startDate)}</span>
                    <span class="timeline-row-time ${stage.startTime === '—' ? 'text-muted' : ''}">${escapeHtml(stage.startTime)}</span>
                  </div>
                  <div class="prod-timeline-row">
                    <span class="timeline-row-label">Concluída</span>
                    <span class="timeline-row-date ${stage.completedDate === '—' ? 'text-muted' : ''}">${escapeHtml(stage.completedDate)}</span>
                    <span class="timeline-row-time ${stage.completedTime === '—' ? 'text-muted' : ''}">${escapeHtml(stage.completedTime)}</span>
                  </div>
                  ${stage.durationText ? `
                    <div class="prod-timeline-duration">
                      <span>⏱</span>
                      <span>${escapeHtml(stage.durationText)}</span>
                    </div>
                  ` : ''}
                </div>

                <div class="prod-step-vertical-desc">${escapeHtml(stage.desc)}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/**
 * Generates the Operational Production Box HTML
 */
export function renderProductionOpsBoxHtml(order) {
  const prod = order.production || {};
  const currentStage = prod.currentStage || 'aprovacao';
  const stageDef = PRODUCTION_STAGES[currentStage] || { label: currentStage, step: 1 };
  const producedQty = prod.producedQty || 0;
  const totalQty = order.qty || 1;
  const pendingQty = Math.max(0, totalQty - producedQty);

  const statusKey = order.status || 'yellow';
  const printJob = prod.printJob || {};
  const qc = prod.qualityControl || {};

  return `
    <div class="drawer-detail-section" style="background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 8px; padding: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
        <div>
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">
            Controle Operacional de Produção
          </span>
          <h4 style="margin: 4px 0 0 0; font-size: 15px; font-weight: 700; color: var(--text-primary);">
            Etapa Atual: <span style="color: var(--accent-primary);">${stageDef.label}</span>
          </h4>
        </div>
        <button class="btn btn-sm" id="btn-ops-view-label" style="font-size: 11px; padding: 3px 8px;">
          🏷 Etiqueta Operacional
        </button>
      </div>

      <!-- Quantity Tracking Strip -->
      <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: 12px;">
        <div>
          <span>Produzido: <b style="color: var(--accent-primary);">${producedQty}</b> / ${totalQty} un</span>
          ${pendingQty > 0 ? `
            <span style="color: #ea580c; margin-left: 8px;">(Pendentes: <b>${pendingQty}</b>)</span>
          ` : `
            <span style="color: #059669; margin-left: 8px;">(✓ 100% Produzido)</span>
          `}
        </div>
        <button class="btn btn-sm" id="btn-ops-adjust-qty" style="font-size: 11px; padding: 2px 8px;">
          🔢 Ajustar Qtd
        </button>
      </div>

      <!-- Stock Deduction Status (Task 1) -->
      <div style="background: ${prod.stockDeducted ? '#f0fdf4' : '#eff6ff'}; border: 1px solid ${prod.stockDeducted ? '#bbf7d0' : '#bfdbfe'}; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: 12px; color: ${prod.stockDeducted ? '#166534' : '#1e40af'}; display: flex; align-items: center; justify-content: space-between;">
        <span style="display: flex; align-items: center; gap: 6px;">
          <span>📦</span>
          <span><b>Estoque:</b> ${prod.stockDeducted ? 'Baixa automática realizada' : 'Os materiais serão baixados automaticamente nesta etapa.'}</span>
        </span>
        ${prod.stockDeducted && prod.stockDeductedAt ? `
          <span style="font-size: 10px; opacity: 0.8;">(${formatDateBR(prod.stockDeductedAt)})</span>
        ` : ''}
      </div>

      <!-- Quality Control Banner (if inspected) -->
      ${qc.status === 'reprovado' ? `
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 10px; margin-bottom: 12px; font-size: 12px;">
          <div style="color: #991b1b; font-weight: 700; display: flex; justify-content: space-between;">
            <span>🔴 Reprovado no CQ (${escapeHtml(qc.reasonName || 'Defeito')})</span>
            <span>${qc.affectedQty || 0} un afetadas</span>
          </div>
          <div style="color: #7f1d1d; margin-top: 4px; font-size: 11px;">
            ${escapeHtml(qc.notes || 'Necessário retrabalho técnico.')}
          </div>
        </div>
      ` : (qc.status === 'aprovado' ? `
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: 12px; color: #065f46; display: flex; align-items: center; gap: 6px;">
          <span>✓ Aprovado no Controle de Qualidade por <b>${escapeHtml(qc.inspectedBy || 'CQ')}</b></span>
        </div>
      ` : '')}

      <!-- Dynamic Context Actions based on Stage -->
      <div class="prod-ops-actions">
        ${statusKey === 'aguardando_aprovacao' || statusKey === 'yellow' ? `
          <button class="btn btn-primary" id="btn-ops-approve" style="font-size: 12px; font-weight: 600;">
            ✓ Aprovar Pedido
          </button>
        ` : ''}

        ${statusKey === 'aprovado' ? `
          <button class="btn btn-primary" id="btn-ops-send-prod" style="font-size: 12px; font-weight: 600;">
            🚀 Enviar para Produção
          </button>
        ` : ''}

        ${currentStage === 'impressao' ? `
          ${printJob.status !== 'imprimindo' && printJob.status !== 'concluida' ? `
            <button class="btn btn-primary" id="btn-ops-print-start" style="font-size: 12px;">
              ▶ Iniciar Impressão
            </button>
          ` : ''}
          ${printJob.status === 'imprimindo' ? `
            <button class="btn" id="btn-ops-print-pause" style="font-size: 12px;">
              ⏸ Pausar Impressão
            </button>
            <button class="btn btn-primary" id="btn-ops-print-complete" style="font-size: 12px;">
              ✓ Concluir Impressão (Ir p/ Corte)
            </button>
          ` : ''}
        ` : ''}

        ${['corte', 'vinco', 'montagem', 'acabamento'].includes(currentStage) ? `
          <button class="btn btn-primary" id="btn-ops-advance-stage" style="font-size: 12px; font-weight: 600;">
            ⏭ Avançar Etapa
          </button>
        ` : ''}

        ${currentStage === 'conferencia' ? `
          <button class="btn btn-primary" id="btn-ops-open-qc" style="font-size: 12px; font-weight: 600; background: #0f172a;">
            🔍 Inspecionar (Aprovar / Reprovar CQ)
          </button>
          <button class="btn" id="btn-ops-advance-stage" style="font-size: 12px;">
            ⏭ Liberar p/ Embalagem
          </button>
        ` : ''}

        ${currentStage === 'embalagem' ? `
          <button class="btn btn-primary" id="btn-ops-finish-packaging" style="font-size: 12px; font-weight: 600;">
            📦 Finalizar Embalagem (Marcar Pronto)
          </button>
        ` : ''}

        ${currentStage === 'pronto' || statusKey === 'pronto' || statusKey === 'green' ? `
          <button class="btn" id="btn-ops-mark-delivered" style="font-size: 12px; font-weight: 600;">
            🚚 Marcar como Entregue
          </button>
        ` : ''}

        <!-- Return stage button (available for any stage after initial) -->
        ${currentStage !== 'aprovacao' && currentStage !== 'pronto' && statusKey !== 'entregue' ? `
          <button class="btn" id="btn-ops-return-stage" style="font-size: 12px; color: #b91c1c;">
            ⏮ Retornar Etapa
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Generates the Production History Timeline HTML
 */
export function renderProductionHistoryHtml(order) {
  const history = Array.isArray(order.production?.history) ? order.production.history : [];

  return `
    <div class="drawer-detail-section">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h4 class="drawer-subtitle" style="margin: 0;">Histórico Operacional de Produção</h4>
        <span class="badge-count">${history.length} eventos</span>
      </div>

      ${history.length === 0 ? `
        <div style="font-size: 11px; color: var(--text-muted); font-style: italic;">
          Nenhum evento registrado ainda.
        </div>
      ` : `
        <div class="history-timeline">
          ${history.map(item => `
            <div class="history-item">
              <div class="history-dot"></div>
              <div class="history-body">
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                  <span class="history-status">${escapeHtml(item.statusLabel || item.stage || 'Atualização')}</span>
                  <span class="history-time">${formatDateBR(item.timestamp)}</span>
                </div>
                ${item.notes ? `
                  <div class="history-notes">${escapeHtml(item.notes)}</div>
                ` : ''}
                ${item.producedQty !== undefined ? `
                  <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">
                    Qtd: ${item.producedQty}/${order.qty} un
                  </div>
                ` : ''}
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">
                  Operador: <b>${escapeHtml(item.operator || 'Sistema')}</b>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

/**
 * Binds all operational events inside the Order Drawer
 */
export function bindProductionOpsEvents({ drawer, order, refreshDrawer, showToast, openDrawer, closeDrawer }) {
  if (!drawer || !order) return;

  // 1. Aprovar Pedido
  drawer.querySelector('#btn-ops-approve')?.addEventListener('click', () => {
    try {
      approveOrderById(order.id, { notes: 'Aprovado pelo operador' });
      showToast(`Pedido ${order.number} aprovado com sucesso!`);
      refreshDrawer(order.id);
    } catch (err) {
      showToast(err.message, '⚠');
    }
  });

  // 2. Enviar para Produção
  drawer.querySelector('#btn-ops-send-prod')?.addEventListener('click', () => {
    try {
      sendOrderToProductionById(order.id, { notes: 'Enviado para linha operacional' });
      showToast(`Pedido ${order.number} enviado para produção!`);
      refreshDrawer(order.id);
    } catch (err) {
      showToast(err.message, '⚠');
    }
  });

  // 3. Print actions
  drawer.querySelector('#btn-ops-print-start')?.addEventListener('click', () => {
    try {
      const res = updateOrderPrintJobById(order.id, 'iniciar', { notes: 'Impressão iniciada na máquina' });
      if (res && res.success) {
        showToast(res.message || 'Impressão iniciada!');
        refreshDrawer(order.id);
      } else {
        showToast(res?.message || 'Falha ao iniciar impressão.', '⚠');
      }
    } catch (err) {
      showToast(err.message, '⚠');
    }
  });

  drawer.querySelector('#btn-ops-print-pause')?.addEventListener('click', () => {
    try {
      const res = updateOrderPrintJobById(order.id, 'pausar', { notes: 'Impressão pausada' });
      if (res && res.success) {
        showToast(res.message || 'Impressão pausada.');
        refreshDrawer(order.id);
      } else {
        showToast(res?.message || 'Falha ao pausar impressão.', '⚠');
      }
    } catch (err) {
      showToast(err.message, '⚠');
    }
  });

  drawer.querySelector('#btn-ops-print-complete')?.addEventListener('click', () => {
    try {
      const res = updateOrderPrintJobById(order.id, 'concluir', { notes: 'Impressão finalizada com sucesso' });
      if (res && res.success) {
        showToast(res.message || 'Impressão concluída! Pedido avançado para Corte.');
        refreshDrawer(order.id);
      } else {
        showToast(res?.message || 'Falha ao concluir impressão.', '⚠');
      }
    } catch (err) {
      showToast(err.message, '⚠');
    }
  });

  // 4. Advance stage
  drawer.querySelector('#btn-ops-advance-stage')?.addEventListener('click', () => {
    try {
      const res = advanceOrderStageById(order.id, { notes: 'Avanço de etapa de acabamento' });
      if (res && res.success) {
        const targetStageId = res.nextStage || res.order?.production?.currentStage;
        const stageObj = PRODUCTION_STAGES.find(s => s.id === targetStageId);
        const stageLabel = stageObj ? stageObj.name : (res.statusLabel || 'próxima etapa');
        showToast(`Avançado para ${stageLabel}!`);
        refreshDrawer(order.id);
      } else {
        showToast(res?.message || 'Não foi possível avançar a etapa.', '⚠');
      }
    } catch (err) {
      showToast(err.message, '⚠');
    }
  });

  // 5. Finalizar Embalagem
  drawer.querySelector('#btn-ops-finish-packaging')?.addEventListener('click', () => {
    try {
      const res = updateOrderPackagingById(order.id, { notes: 'Embalagem conferida e selada com sucesso' });
      if (res && (res.success || res.order)) {
        showToast(`Pedido ${order.number} está pronto para entrega!`);
        refreshDrawer(order.id);
      } else {
        showToast(res?.message || 'Não foi possível finalizar a embalagem.', '⚠');
      }
    } catch (err) {
      showToast(err.message, '⚠');
    }
  });

  // 6. Marcar como Entregue
  drawer.querySelector('#btn-ops-mark-delivered')?.addEventListener('click', () => {
    try {
      const res = markOrderDeliveredById(order.id, { notes: 'Pedido entregue ao cliente / despachado' });
      if (res && res.success) {
        showToast(res.message || `Pedido ${order.number || order.id} marcado como Entregue!`);
        refreshDrawer(order.id);
      } else {
        showToast(res?.message || 'Não foi possível marcar como entregue.', '⚠');
      }
    } catch (err) {
      showToast(err.message, '⚠');
    }
  });

  // 7. Ajustar Quantidade Modal
  drawer.querySelector('#btn-ops-adjust-qty')?.addEventListener('click', () => {
    openQuantityModal({
      order,
      onSave: (newQty, notes) => {
        updateOrderQuantityById(order.id, newQty, { notes });
        showToast('Quantidade produzida atualizada com sucesso!');
        refreshDrawer(order.id);
      },
      openDrawer,
      closeDrawer
    });
  });

  // 8. Retornar Etapa Modal
  drawer.querySelector('#btn-ops-return-stage')?.addEventListener('click', () => {
    openReturnStageModal({
      order,
      onConfirm: (targetStageId, notes) => {
        returnOrderStageById(order.id, targetStageId, { notes });
        showToast('Etapa retornada com sucesso!');
        refreshDrawer(order.id);
      },
      openDrawer,
      closeDrawer
    });
  });

  // 9. Abrir Controle de Qualidade Modal
  drawer.querySelector('#btn-ops-open-qc')?.addEventListener('click', () => {
    openQCModal({
      order,
      onSubmit: (qcPayload) => {
        submitOrderQCById(order.id, qcPayload);
        showToast(qcPayload.decision === 'aprovado' ? 'Pedido aprovado no CQ!' : 'Bloqueio de CQ registrado com sucesso!');
        refreshDrawer(order.id);
      },
      openDrawer,
      closeDrawer
    });
  });

  // 10. Ver Etiqueta Operacional
  drawer.querySelector('#btn-ops-view-label')?.addEventListener('click', () => {
    openOperationalLabelModal({ order, openDrawer, closeDrawer });
  });
}

/**
 * Modal to adjust produced quantity
 */
export function openQuantityModal({ order, onSave, openDrawer, closeDrawer }) {
  const currentProduced = order.production?.producedQty || 0;
  const total = order.qty || 1;

  const contentHtml = `
    <div style="padding: 10px 0;">
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
        Acompanhe e registre quantas unidades foram produzidas fisicamente na fábrica.
      </p>

      <div style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px; margin-bottom: 16px; text-align: center;">
        <span style="font-size: 12px; color: var(--text-muted);">Progresso Atual</span>
        <div style="font-size: 24px; font-weight: 800; color: var(--accent-primary); margin: 4px 0;">
          <span id="qty-modal-display">${currentProduced}</span> / ${total} un
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 14px;">
        <label class="form-label">Unidades Produzidas</label>
        <div style="display: flex; gap: 8px;">
          <input type="number" class="form-input" id="input-modal-produced-qty" min="0" max="${total}" value="${currentProduced}" style="font-size: 16px; font-weight: 700; width: 120px;" />
          <button class="btn btn-sm" id="btn-qty-all" style="font-size: 12px;">Todas (${total})</button>
          <button class="btn btn-sm" id="btn-qty-add-1">+1</button>
          <button class="btn btn-sm" id="btn-qty-add-5">+5</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Observações da Produção (Opcional)</label>
        <textarea class="form-textarea" id="input-modal-qty-notes" rows="2" placeholder="Ex: Primeiro lote concluído perfeitamente."></textarea>
      </div>
    </div>
  `;

  const footerHtml = `
    <button class="btn" id="btn-qty-modal-cancel">Cancelar</button>
    <button class="btn btn-primary" id="btn-qty-modal-save">Salvar Quantidade</button>
  `;

  openDrawer({
    title: `Ajustar Quantidade · Pedido ${order.number}`,
    contentHtml,
    footerHtml,
    onMount: (d) => {
      const input = d.querySelector('#input-modal-produced-qty');
      const display = d.querySelector('#qty-modal-display');
      const notesInput = d.querySelector('#input-modal-qty-notes');

      const updateVal = (v) => {
        const clamped = Math.max(0, Math.min(total, v));
        input.value = clamped;
        display.textContent = clamped;
      };

      input.addEventListener('input', () => updateVal(parseInt(input.value, 10) || 0));
      d.querySelector('#btn-qty-all')?.addEventListener('click', () => updateVal(total));
      d.querySelector('#btn-qty-add-1')?.addEventListener('click', () => updateVal((parseInt(input.value, 10) || 0) + 1));
      d.querySelector('#btn-qty-add-5')?.addEventListener('click', () => updateVal((parseInt(input.value, 10) || 0) + 5));

      d.querySelector('#btn-qty-modal-cancel').addEventListener('click', closeDrawer);
      d.querySelector('#btn-qty-modal-save').addEventListener('click', () => {
        const val = parseInt(input.value, 10) || 0;
        const notes = notesInput.value.trim();
        closeDrawer();
        onSave(val, notes);
      });
    }
  });
}

/**
 * Modal to return production stage
 */
export function openReturnStageModal({ order, onConfirm, openDrawer, closeDrawer }) {
  const currentStage = order.production?.currentStage || 'aprovacao';
  const currentIndex = PRODUCTION_STAGE_ORDER.indexOf(currentStage);

  // Allow returning to any stage before current stage
  const priorStages = PRODUCTION_STAGE_ORDER.slice(0, Math.max(0, currentIndex)).map(id => ({
    id,
    label: PRODUCTION_STAGES[id]?.label || id
  }));

  const contentHtml = `
    <div style="padding: 10px 0;">
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
        Selecione a etapa anterior para a qual o pedido deve retroceder na linha de produção.
      </p>

      <div class="form-group" style="margin-bottom: 14px;">
        <label class="form-label">Retornar para a Etapa:</label>
        <select class="form-select" id="select-return-stage">
          ${priorStages.map(s => `
            <option value="${s.id}">${escapeHtml(s.label)}</option>
          `).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Motivo do Retorno (Obrigatório)</label>
        <textarea class="form-textarea" id="textarea-return-notes" rows="3" placeholder="Ex: Necessário reimprimir capa devido a falha no alinhamento do vinco."></textarea>
      </div>
    </div>
  `;

  const footerHtml = `
    <button class="btn" id="btn-return-modal-cancel">Cancelar</button>
    <button class="btn btn-primary" id="btn-return-modal-confirm" style="background: #b91c1c; border-color: #991b1b;">Confirmar Retorno</button>
  `;

  openDrawer({
    title: `Retornar Etapa · Pedido ${order.number}`,
    contentHtml,
    footerHtml,
    onMount: (d) => {
      d.querySelector('#btn-return-modal-cancel').addEventListener('click', closeDrawer);
      d.querySelector('#btn-return-modal-confirm').addEventListener('click', () => {
        const select = d.querySelector('#select-return-stage');
        const notes = d.querySelector('#textarea-return-notes').value.trim();
        if (!notes) {
          alert('Por favor, informe o motivo do retorno da etapa para rastreabilidade.');
          return;
        }
        closeDrawer();
        onConfirm(select.value, notes);
      });
    }
  });
}

/**
 * Modal for Quality Control (Conferência / CQ)
 */
export function openQCModal({ order, onSubmit, openDrawer, closeDrawer }) {
  const contentHtml = `
    <div style="padding: 10px 0;">
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px;">
        Realize a inspeção técnica das peças produzidas e da personalização antes do fechamento do pedido.
      </p>

      <!-- Inspection Decision Selector -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
        <label style="border: 2px solid #10b981; background: #ecfdf5; border-radius: 8px; padding: 12px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
          <input type="radio" name="qc_decision" value="aprovado" checked />
          <div>
            <div style="font-weight: 700; color: #065f46; font-size: 13px;">✓ APROVADO</div>
            <div style="font-size: 11px; color: #047857;">Tudo de acordo com o pedido</div>
          </div>
        </label>

        <label style="border: 2px solid #ef4444; background: #fef2f2; border-radius: 8px; padding: 12px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
          <input type="radio" name="qc_decision" value="reprovado" />
          <div>
            <div style="font-weight: 700; color: #991b1b; font-size: 13px;">🔴 REPROVADO</div>
            <div style="font-size: 11px; color: #b91c1c;">Bloquear para retrabalho</div>
          </div>
        </label>
      </div>

      <!-- Reproval details (hidden by default) -->
      <div id="qc-reproval-details" style="display: none; background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px; margin-bottom: 14px;">
        <div class="form-group" style="margin-bottom: 10px;">
          <label class="form-label">Motivo da Não Conformidade:</label>
          <select class="form-select" id="select-qc-defect">
            ${DEFECT_REASONS.map(r => `
              <option value="${r.id}">${escapeHtml(r.label)}</option>
            `).join('')}
          </select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
          <div class="form-group">
            <label class="form-label">Qtd Afetada (un):</label>
            <input type="number" class="form-input" id="input-qc-qty" min="1" max="${order.qty}" value="${order.qty}" />
          </div>
          <div class="form-group">
            <label class="form-label">Retornar para Etapa:</label>
            <select class="form-select" id="select-qc-return-stage">
              <option value="impressao">🖨 Impressão</option>
              <option value="corte">✂ Corte</option>
              <option value="vinco">📐 Vinco</option>
              <option value="montagem">🧩 Montagem</option>
              <option value="acabamento">✨ Acabamento</option>
            </select>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Observações da Inspeção</label>
        <textarea class="form-textarea" id="textarea-qc-notes" rows="2" placeholder="Ex: Conferido alinhamento do nome, dobras perfeitas e gramatura."></textarea>
      </div>
    </div>
  `;

  const footerHtml = `
    <button class="btn" id="btn-qc-modal-cancel">Cancelar</button>
    <button class="btn btn-primary" id="btn-qc-modal-confirm">Registrar Inspeção</button>
  `;

  openDrawer({
    title: `Conferência & Controle de Qualidade · Pedido ${order.number}`,
    contentHtml,
    footerHtml,
    onMount: (d) => {
      const radios = d.querySelectorAll('input[name="qc_decision"]');
      const reprovalBox = d.querySelector('#qc-reproval-details');
      const notes = d.querySelector('#textarea-qc-notes');

      radios.forEach(r => {
        r.addEventListener('change', () => {
          reprovalBox.style.display = r.value === 'reprovado' ? 'block' : 'none';
        });
      });

      d.querySelector('#btn-qc-modal-cancel').addEventListener('click', closeDrawer);
      d.querySelector('#btn-qc-modal-confirm').addEventListener('click', () => {
        const decision = d.querySelector('input[name="qc_decision"]:checked').value;
        const payload = {
          decision,
          notes: notes.value.trim(),
          operator: 'Inspetor CQ'
        };

        if (decision === 'reprovado') {
          payload.reasonId = d.querySelector('#select-qc-defect').value;
          payload.affectedQty = parseInt(d.querySelector('#input-qc-qty').value, 10) || 1;
          payload.returnStageId = d.querySelector('#select-qc-return-stage').value;
        }

        closeDrawer();
        onSubmit(payload);
      });
    }
  });
}

/**
 * Modal to view and print the Operational Production Label
 */
export function openOperationalLabelModal(arg1, arg2, arg3) {
  let order, openDrawer, closeDrawer;
  if (arg1 && typeof arg1 === 'object' && 'order' in arg1) {
    order = arg1.order;
    openDrawer = arg1.openDrawer;
    closeDrawer = arg1.closeDrawer;
  } else {
    order = arg1;
    openDrawer = arg2;
    closeDrawer = arg3;
  }

  if (!order) return;
  const labelData = generateOperationalLabelData(order);

  const contentHtml = `
    <div style="padding: 10px 0;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 12px; color: var(--text-muted);">Ficha de Acompanhamento Operacional da Fábrica</span>
        <button class="btn btn-primary btn-sm" id="btn-print-op-label" style="font-size: 12px; padding: 4px 12px;">
          🖨 Imprimir Ficha
        </button>
      </div>

      <!-- Printable Operational Sheet Card -->
      <div class="label-sheet" id="printable-label-sheet">
        <div class="label-header">
          <div>
            <div class="label-brand">PAPER MAX</div>
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase;">Ordem de Produção</div>
          </div>
          <div class="label-op-code">${escapeHtml(labelData.operationalCode)}</div>
        </div>

        <div class="label-grid">
          <div>
            <div class="label-info-item"><b>Cliente:</b> ${escapeHtml(labelData.customer)}</div>
            <div class="label-info-item"><b>Produto:</b> ${escapeHtml(labelData.product)}</div>
            <div class="label-info-item"><b>Quantidade:</b> ${labelData.qty} un</div>
            <div class="label-info-item"><b>Entrega:</b> <b>${labelData.deliveryDate}</b></div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; font-weight: 700; margin-bottom: 4px;">QR Operacional</div>
            ${labelData.qrCodeSvg}
          </div>
        </div>

        <!-- Barcode -->
        <div style="text-align: center; margin: 12px 0; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 8px 0;">
          ${labelData.barcodeSvg}
          <div style="font-family: monospace; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; margin-top: 2px;">
            ${escapeHtml(labelData.operationalCode)}
          </div>
        </div>

        <!-- Personalization Fields -->
        <div style="margin-bottom: 12px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 4px;">Especificações de Personalização:</div>
          <div style="font-size: 11px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 10px;">
            ${Object.keys(labelData.personalization).length === 0 ? `
              <i>Nenhum texto adicional.</i>
            ` : Object.entries(labelData.personalization).map(([k, v]) => `
              <div><b>${escapeHtml(k)}:</b> ${escapeHtml(v)}</div>
            `).join('')}
          </div>
        </div>

        <!-- Operational Checklist -->
        <div class="label-checklist">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px;">Checklist da Fábrica:</div>
          ${labelData.checklist.map(item => `
            <div class="label-check-item">
              <span style="display: inline-block; width: 14px; height: 14px; border: 1.5px solid #0f172a; border-radius: 2px;"></span>
              <span>${escapeHtml(item)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  const footerHtml = `
    <button class="btn btn-primary" id="btn-close-label-modal">Fechar</button>
  `;

  openDrawer({
    title: `Ficha Operacional · ${labelData.operationalCode}`,
    contentHtml,
    footerHtml,
    onMount: (d) => {
      d.querySelector('#btn-close-label-modal').addEventListener('click', closeDrawer);
      d.querySelector('#btn-print-op-label').addEventListener('click', () => {
        window.print();
      });
    }
  });
}

export const openLabelPrintModal = openOperationalLabelModal;
