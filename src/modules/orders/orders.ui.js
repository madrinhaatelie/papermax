/**
 * PAPER MAX - Orders UI Module
 * Implements:
 * 1. Dedicated Order Registration Page (Slug: #pedidos/novo / view: 'pedidos-novo')
 *    with 4 structured sections: Client, Product & Personalization, BOM Snapshot, Financials.
 * 2. Orders List with Neon LED status borders, 4-digit formatting (0001), financial subtitles,
 *    and three-dots (⋮) kebab quick action dropdowns.
 * 3. Large Consultation Drawer (drawer-large, 860px) with full client details,
 *    quality inspection, partial qty tracking, barcode/QR label, and 58mm thermal receipt.
 * 4. Header CSV Submenu (Modelo | Exportar | Importar | Personalização em Massa).
 */

import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  duplicateOrder,
  updateOrderPrintJobById,
  exportOrdersCSV,
  exportOrdersCSVTemplate,
  ORDER_STATUS_MAP,
  isOrderActive,
  addOrderPayment,
  removeOrderPayment
} from './orders.js';
import { bus, showToast } from '../../core/events.js';
import { loadProducts, loadMaterials, loadComponents } from '../../data/storage.js';
import { getProductById } from '../products/products.js';
import { fileStorage } from '../../data/filestorage.js';
import { formatDateBR, formatDateDayMonthBR, parseDateBRToISO, escapeHtml, formatNumberXX, formatPhone, formatCPF, formatCNPJ } from '../../utils/sanitize.js';
import { downloadCSVFile } from '../../utils/csv.js';
import { generatePersonalizedPdf, triggerPdfDownload } from '../personalization/pdf.engine.js';
import {
  renderTimelineStepperHtml,
  renderProductionOpsBoxHtml,
  renderProductionHistoryHtml,
  bindProductionOpsEvents,
  openOperationalLabelModal
} from '../production/production.ui.js';

let currentOrdersTab = 'em_andamento';
let currentSearchTerm = '';

/**
 * Formats various date representations (DD/MM/YYYY or ISO) into YYYY-MM-DD for HTML5 date inputs
 */
export function formatDateToInput(dateStr) {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const parts = dateStr.split('/');
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(dateStr)) {
    const parts = dateStr.split('/');
    return `20${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return '';
}

/**
 * Accessible in-app confirmation dialog that works seamlessly in sandboxed iframes
 */
export function showConfirmDialog({ title = 'Confirmação', message, confirmText = 'Confirmar', cancelText = 'Cancelar', isDanger = false, onConfirm }) {
  const existing = document.getElementById('app-confirm-dialog-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'app-confirm-dialog-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    padding: 16px;
  `;

  overlay.innerHTML = `
    <div style="background: #ffffff; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.05); max-width: 440px; width: 100%; overflow: hidden; border: 1px solid var(--border-subtle);">
      <div style="padding: 18px 22px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 12px;">
        <div style="width: 38px; height: 38px; border-radius: 50%; background: ${isDanger ? '#fee2e2' : '#e0f2fe'}; color: ${isDanger ? '#dc2626' : '#0284c7'}; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
          ${isDanger ? '⚠️' : 'ℹ️'}
        </div>
        <div>
          <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--text-primary);">${escapeHtml(title)}</h3>
        </div>
      </div>
      <div style="padding: 18px 22px; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
        ${message}
      </div>
      <div style="padding: 14px 22px; background: #f8fafc; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; gap: 10px;">
        <button type="button" id="confirm-dialog-cancel" class="btn btn-secondary" style="padding: 7px 16px; font-size: 13px; font-weight: 600;">
          ${escapeHtml(cancelText)}
        </button>
        <button type="button" id="confirm-dialog-confirm" class="btn" style="padding: 7px 18px; font-size: 13px; font-weight: 700; background: ${isDanger ? '#dc2626' : 'var(--accent-primary)'}; color: #ffffff; border: none; border-radius: 6px; cursor: pointer;">
          ${escapeHtml(confirmText)}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  overlay.querySelector('#confirm-dialog-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      if (!isDanger) close();
    }
  });

  overlay.querySelector('#confirm-dialog-confirm').addEventListener('click', () => {
    close();
    if (typeof onConfirm === 'function') {
      onConfirm();
    }
  });
}

/**
 * Maps order status or stage to specific neon LED CSS class and border color
 */
export function getOrderStatusNeonMeta(order) {
  const status = (order.status || '').toLowerCase();
  const stage = (order.production?.currentStage || '').toLowerCase();

  // 1. Entregues (Card Off Verde Escuro c/ Letras Brancas)
  if (status === 'entregue' || status === 'neutral' || order.statusLabel?.toLowerCase().includes('entregue')) {
    return {
      cssClass: 'status-entregues',
      color: '#22c55e',
      label: 'Entregue',
      isCardOff: true
    };
  }

  // 2. Cancelados (Vermelho)
  if (status === 'cancelado' || order.statusLabel?.toLowerCase().includes('cancelado')) {
    return {
      cssClass: 'status-cancelados',
      color: '#f87171',
      label: 'Cancelado',
      isCardOff: false
    };
  }

  // 3. Bloqueados (Laranja)
  if (status === 'bloqueado' || status === 'red' || stage === 'bloqueado') {
    return {
      cssClass: 'status-bloqueados',
      color: '#fb923c',
      label: 'Bloqueado',
      isCardOff: false
    };
  }

  // 4. Prontos (Verde)
  if (status === 'pronto' || status === 'green' || stage === 'pronto' || stage === 'concluido') {
    return {
      cssClass: 'status-prontos',
      color: '#22c55e',
      label: 'Pronto',
      isCardOff: false
    };
  }

  // 5. Embalagem / CQ (Dourado)
  if (stage === 'embalagem' || status === 'em_embalagem') {
    return {
      cssClass: 'status-embalagem',
      color: '#fbbf24',
      label: 'Embalagem',
      isCardOff: false
    };
  }
  if (stage === 'conferencia' || status === 'em_conferencia' || status === 'orange') {
    return {
      cssClass: 'status-embalagem',
      color: '#fbbf24',
      label: 'Conferência / CQ',
      isCardOff: false
    };
  }

  // 6. Acabamento (Azul Claro)
  if (stage === 'acabamento' || status === 'em_acabamento') {
    return {
      cssClass: 'status-acabamento',
      color: '#38bdf8',
      label: 'Acabamento',
      isCardOff: false
    };
  }

  // 7. Montagem (Turquesa)
  if (stage === 'montagem' || status === 'em_montagem') {
    return {
      cssClass: 'status-montagem',
      color: '#22d3ee',
      label: 'Montagem',
      isCardOff: false
    };
  }

  // 8. Corte & Vinco
  if (stage === 'corte' || status === 'em_corte') {
    return {
      cssClass: 'status-corte',
      color: '#c084fc',
      label: 'Corte',
      isCardOff: false
    };
  }
  if (stage === 'vinco' || status === 'em_vinco') {
    return {
      cssClass: 'status-vinco',
      color: '#818cf8',
      label: 'Vinco',
      isCardOff: false
    };
  }

  // 9. Impressão (Verde Amarelado / Lime)
  if (stage === 'impressao' || status === 'aguardando_impressao' || status === 'imprimindo') {
    return {
      cssClass: 'status-impressao',
      color: '#a3e635',
      label: 'Impressão',
      isCardOff: false
    };
  }

  // 10. Produção (Azul)
  if (status === 'blue' || status === 'aprovado' || status === 'em_personalizacao') {
    return {
      cssClass: 'status-producao',
      color: '#3b82f6',
      label: 'Produção',
      isCardOff: false
    };
  }

  // 11. Aguardando (Amarelo)
  return {
    cssClass: 'status-aguardando',
    color: '#facc15',
    label: order.statusLabel || 'Aguardando',
    isCardOff: false
  };
}

/**
 * Formats order number to 4 digits (e.g. 0001, 0002, 1048)
 */
export function formatOrderNumber(num) {
  const n = parseInt(num, 10);
  if (isNaN(n)) return String(num || '0000');
  return String(n).padStart(4, '0');
}

/**
 * Calculates order financial breakdown (Total, Paid, Remaining)
 */
export function getOrderFinancials(order) {
  const snap = order.productSnapshot || {};
  const unitPrice = Number(snap.price || 0);
  const qty = Number(order.qty || 1);
  
  let totalAmount = 0;
  if (order.totalAmount !== undefined && order.totalAmount !== null) {
    totalAmount = Number(order.totalAmount);
  } else if (order.financial?.totalAmount !== undefined && order.financial?.totalAmount !== null) {
    totalAmount = Number(order.financial.totalAmount);
  } else if (Array.isArray(order.items) && order.items.length > 0) {
    const rawSubtotal = order.items.reduce((s, it) => s + ((Number(it.unitPrice) || Number(it.productSnapshot?.price) || 0) * (Number(it.qty) || 1)), 0);
    const disc = Number(order.discount || order.financial?.discount || 0);
    totalAmount = Math.max(0, rawSubtotal - disc);
  } else {
    totalAmount = unitPrice * qty;
  }

  const payments = Array.isArray(order.payments) 
    ? order.payments 
    : (Array.isArray(order.financial?.payments) 
        ? order.financial.payments 
        : (Array.isArray(order.financial?.paymentMethods) ? order.financial.paymentMethods : []));

  let paidAmount = 0;
  if (payments.length > 0) {
    paidAmount = Number(payments.reduce((sum, p) => sum + Number(p.amount || 0), 0).toFixed(2));
  } else {
    paidAmount = Number(order.paidAmount !== undefined ? order.paidAmount : (order.financial?.paidAmount || 0));
  }

  const remainingAmount = Number(order.remainingAmount !== undefined ? order.remainingAmount : Math.max(0, Number((totalAmount - paidAmount).toFixed(2))));
  const methods = payments.map(p => p.method).filter(Boolean);
  const paymentMethod = methods.length > 0 ? methods.join(', ') : (order.paymentMethod || order.financial?.paymentMethod || 'PIX');

  return {
    unitPrice,
    totalAmount,
    paidAmount,
    remainingAmount,
    payments,
    paymentMethod,
    paymentStatus: order.paymentStatus || (paidAmount >= totalAmount ? 'pago' : paidAmount > 0 ? 'parcial' : 'pendente')
  };
}

/**
 * Main Orders View Renderer
 */
export function renderOrdersView(container, ctx) {
  if (!container) return;
  const { switchView, openDrawer, closeDrawer, showToast, openBulkPersonalizationModal, openImportCSVDrawer } = ctx;

  const orders = getOrders({ tab: currentOrdersTab, search: currentSearchTerm });

  container.innerHTML = `
    <!-- Module Header (Bloco 01) -->
    <div class="module-header" style="margin-bottom: 16px;">
      <div>
        <h2 class="module-title" style="font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0;">Gestão de Pedidos</h2>
      </div>
      <div class="module-actions" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        <button class="btn btn-primary" id="btn-orders-new" style="font-weight: 600;">+ Novo pedido</button>
        
        <!-- CSV & Bulk Dropdown Submenu -->
        <div class="dropdown-csv-wrapper" id="dropdown-csv-wrapper">
          <button class="btn" id="btn-csv-toggle" style="display: inline-flex; align-items: center; gap: 6px;">
            📁 Arquivos & CSV <span style="font-size: 10px;">▼</span>
          </button>
          <div class="dropdown-csv-menu" id="dropdown-csv-menu">
            <button class="dropdown-kebab-item" id="btn-orders-bulk">
              <span>⚡</span> Personalização em massa
            </button>
            <div style="height: 1px; background: var(--border-subtle); margin: 3px 0;"></div>
            <button class="dropdown-kebab-item" id="btn-orders-template">
              <span>📥</span> Baixar Modelo CSV
            </button>
            <button class="dropdown-kebab-item" id="btn-orders-export">
              <span>📤</span> Exportar Pedidos CSV
            </button>
            <button class="dropdown-kebab-item" id="btn-orders-import">
              <span>🔄</span> Importar Pedidos CSV
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Search & Select Filter Bar -->
    <div class="filter-bar" style="display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 8px; min-width: 240px;">
        <label for="select-orders-tab" style="font-size: 13px; font-weight: 700; color: var(--text-primary); white-space: nowrap; display: flex; align-items: center; gap: 4px;">
          <span>🎯 Status:</span>
        </label>
        <select id="select-orders-tab" class="form-select" style="height: 38px; font-size: 13px; font-weight: 600; border-radius: 8px; border: 1px solid var(--border-subtle); background-color: #ffffff; padding: 0 12px; color: var(--text-primary); cursor: pointer; flex: 1; min-width: 190px;">
          ${[
            { id: 'em_andamento', label: '⚡ Em Andamento' },
            { id: 'todos', label: '📋 Todos os Pedidos' },
            { id: 'aguardando', label: '🟡 Aguardando' },
            { id: 'producao', label: '🔵 Em Produção' },
            { id: 'impressao', label: '🟢 Fila Impressão' },
            { id: 'corte', label: '🟣 Corte' },
            { id: 'vinco', label: '🟣 Vinco' },
            { id: 'montagem', label: '🔵 Montagem' },
            { id: 'acabamento', label: '🔵 Acabamento' },
            { id: 'conferencia', label: '🟡 CQ / Conferência' },
            { id: 'embalagem', label: '📦 Embalagem' },
            { id: 'prontos', label: '✓ Prontos' },
            { id: 'bloqueados', label: '🟠 Bloqueados' },
            { id: 'entregues', label: '🚚 Entregues' },
            { id: 'cancelados', label: '❌ Cancelados' }
          ].map(tab => `
            <option value="${tab.id}" ${currentOrdersTab === tab.id ? 'selected' : ''}>${tab.label}</option>
          `).join('')}
        </select>
      </div>

      <div class="search-wrapper" style="flex: 1; min-width: 240px; position: relative;">
        <span class="search-icon" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; color: var(--text-secondary);">🔍</span>
        <input class="search" id="input-orders-search" 
               placeholder="Busca em tempo real por número (ex: 0001, 1048), cliente, produto ou status..." 
               value="${escapeHtml(currentSearchTerm)}" 
               style="width: 100%; padding-left: 36px; height: 38px; border-radius: 8px; font-size: 13px;" />
      </div>
      <span class="badge-count" style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; white-space: nowrap;">
        ${orders.length} ${orders.length === 1 ? 'pedido' : 'pedidos'}
      </span>
    </div>

    <!-- Orders List (Bloco 04) -->
    <div class="panel" style="padding: 0; background: transparent; border: none; box-shadow: none;">
      ${currentOrdersTab === 'impressao' ? renderPrintQueueTableHtml(orders) : renderOrdersCardListHtml(orders)}
    </div>
  `;

  // Bind Events
  // Status Filter Select change
  const selectOrdersTab = container.querySelector('#select-orders-tab');
  if (selectOrdersTab) {
    selectOrdersTab.addEventListener('change', (e) => {
      currentOrdersTab = e.target.value;
      renderOrdersView(container, ctx);
    });
  }

  // Search
  const searchInput = container.querySelector('#input-orders-search');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      currentSearchTerm = e.target.value;
      renderOrdersView(container, ctx);
    });
  }

  // Novo Pedido Button (Nova Página)
  const newBtn = container.querySelector('#btn-orders-new');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      switchView('pedidos-novo');
    });
  }

  // CSV Dropdown Toggle
  const csvToggle = container.querySelector('#btn-csv-toggle');
  const csvMenu = container.querySelector('#dropdown-csv-menu');
  if (csvToggle && csvMenu) {
    csvToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      csvMenu.classList.toggle('active');
    });
    document.addEventListener('click', () => {
      csvMenu.classList.remove('active');
    }, { once: true });
  }

  // Bulk Personalization
  const bulkBtn = container.querySelector('#btn-orders-bulk');
  if (bulkBtn) {
    bulkBtn.addEventListener('click', () => {
      openBulkPersonalizationModal(openDrawer, closeDrawer);
    });
  }

  // CSV Export
  const exportBtn = container.querySelector('#btn-orders-export');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const csv = exportOrdersCSV();
      downloadCSVFile(`pedidos_${Date.now()}.csv`, csv);
      showToast('CSV de Pedidos exportado com sucesso');
    });
  }

  // CSV Template
  const templateBtn = container.querySelector('#btn-orders-template');
  if (templateBtn) {
    templateBtn.addEventListener('click', () => {
      const csv = exportOrdersCSVTemplate();
      downloadCSVFile(`modelo_pedidos.csv`, csv);
      showToast('Modelo CSV baixado com sucesso');
    });
  }

  // CSV Import
  const importBtn = container.querySelector('#btn-orders-import');
  if (importBtn) {
    importBtn.addEventListener('click', () => openImportCSVDrawer('pedidos'));
  }

  // Row / Card Clicks -> Open Large Consultation Drawer
  container.querySelectorAll('[data-action="view-order"]').forEach(el => {
    el.addEventListener('click', (e) => {
      // Don't trigger if clicked on kebab menu or child button
      if (e.target.closest('.dropdown-kebab-wrapper') || (e.target.closest('button') && e.target.closest('button') !== el)) return;
      const id = el.dataset.id;
      showOrderConsultationDrawer(id, ctx);
    });
  });

  // Kebab Dropdown Toggles
  container.querySelectorAll('.action-btn-kebab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = btn.nextElementSibling;
      // Close other menus
      document.querySelectorAll('.dropdown-kebab-menu.active').forEach(m => {
        if (m !== menu) m.classList.remove('active');
      });
      if (menu) menu.classList.toggle('active');
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-kebab-menu.active').forEach(m => m.classList.remove('active'));
  });

  // Kebab Actions
  container.querySelectorAll('[data-action="share-art"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const shareUrl = `${window.location.origin}${window.location.pathname}#/aprovar-arte/${id}`;
      navigator.clipboard?.writeText(shareUrl);
      showToast(`Link de aprovação copiado: ${shareUrl}`, '🔗');
      if (typeof ctx.switchView === 'function') {
        ctx.switchView('aprovar-arte', id);
      }
    });
  });

  container.querySelectorAll('[data-action="edit-order"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      openEditOrderDrawer(id, ctx);
    });
  });

  container.querySelectorAll('[data-action="dup-order"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      try {
        const dup = duplicateOrder(btn.dataset.id);
        showToast(`Pedido ${formatOrderNumber(dup.number)} duplicado com sucesso!`);
        renderOrdersView(container, ctx);
      } catch (err) {
        showToast(err.message, '⚠');
      }
    });
  });

  container.querySelectorAll('[data-action="del-order"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const order = getOrderById(id);
      const orderNum = order ? (order.number || order.id) : id;
      showConfirmDialog({
        title: 'Excluir Pedido',
        message: `Tem certeza que deseja excluir o <b>Pedido ${formatOrderNumber(orderNum)}</b>?<br><br>Esta ação é irreversível e removerá o pedido e todo o seu histórico.`,
        confirmText: 'Sim, Excluir Pedido',
        isDanger: true,
        onConfirm: () => {
          try {
            deleteOrder(id);
            showToast(`Pedido ${formatOrderNumber(orderNum)} excluído com sucesso!`, '✅');
            renderOrdersView(container, ctx);
          } catch (err) {
            showToast(err.message, '⚠');
          }
        }
      });
    });
  });

  // Direct download PDF buttons in list
  container.querySelectorAll('.btn-dl-order-file').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const fileId = btn.dataset.fileId;
      const rec = await fileStorage.getFile(fileId);
      if (rec && rec.blob) {
        triggerPdfDownload(rec.blob, rec.metadata?.name || 'molde.pdf');
      } else {
        showToast('Arquivo não encontrado no armazenamento.', '⚠️');
      }
    });
  });

  // Print Queue Direct Row Actions (▶ Iniciar, ⏸ Pausar, ✓ Concluir)
  container.querySelectorAll('[data-action="print-start"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      try {
        const res = updateOrderPrintJobById(id, 'iniciar', { notes: 'Impressão iniciada na fila de impressão' });
        if (res && res.success) {
          showToast(res.message || 'Impressão iniciada!');
          renderOrdersView(container, ctx);
        } else {
          showToast(res?.message || 'Falha ao iniciar impressão.', '⚠');
        }
      } catch (err) {
        showToast(err.message, '⚠');
      }
    });
  });

  container.querySelectorAll('[data-action="print-pause"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      try {
        const res = updateOrderPrintJobById(id, 'pausar', { notes: 'Impressão pausada na fila de impressão' });
        if (res && res.success) {
          showToast(res.message || 'Impressão pausada.');
          renderOrdersView(container, ctx);
        } else {
          showToast(res?.message || 'Falha ao pausar impressão.', '⚠');
        }
      } catch (err) {
        showToast(err.message, '⚠');
      }
    });
  });

  container.querySelectorAll('[data-action="print-complete"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      try {
        const res = updateOrderPrintJobById(id, 'concluir', { notes: 'Impressão finalizada na fila de impressão' });
        if (res && res.success) {
          showToast(res.message || 'Impressão concluída! Pedido avançado para Corte.');
          renderOrdersView(container, ctx);
        } else {
          showToast(res?.message || 'Falha ao concluir impressão.', '⚠');
        }
      } catch (err) {
        showToast(err.message, '⚠');
      }
    });
  });
}

/**
 * Standard Order Cards List HTML (Bloco 04)
 */
function renderOrdersCardListHtml(orders) {
  if (orders.length === 0) {
    return `
      <div style="text-align: center; padding: 48px 24px; color: var(--text-muted); background: #ffffff; border-radius: 12px; border: 1px solid var(--border-subtle);">
        <div style="font-size: 28px; margin-bottom: 8px;">📦</div>
        <b style="display: block; font-size: 14px; color: var(--text-primary); margin-bottom: 6px;">Nenhum pedido encontrado nesta visualização.</b>
        <p style="font-size: 12px; margin: 0;">Utilize o botão "+ Novo pedido" acima para cadastrar um novo pedido ou selecione outra aba de filtro.</p>
      </div>
    `;
  }

  return `
    <div class="list-group" style="display: flex; flex-direction: column; gap: 10px;">
      ${orders.map(order => {
        const neon = getOrderStatusNeonMeta(order);
        const orderNum = formatOrderNumber(order.number || order.id);
        const fin = getOrderFinancials(order);

        return `
          <div class="list-row ${neon.cssClass}" data-action="view-order" data-id="${order.id}" 
               style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 10px; cursor: pointer; transition: all 0.18s ease; gap: 14px;"
               title="Clique para abrir consulta completa do Pedido ${orderNum}">
            
            <!-- Left Info Block -->
            <div class="list-main" style="flex: 1; min-width: 0;">
              <!-- Line 1: Order Num + Customer + Product + Delivery Date -->
              <div class="list-title" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; font-weight: 700;">
                <span style="font-family: monospace; font-size: 13px; background: rgba(15,23,42,0.06); padding: 2px 6px; border-radius: 4px; color: var(--text-primary);">
                  ${orderNum}
                </span>
                <span style="color: var(--text-primary); font-weight: 600;">${escapeHtml(order.customer || 'Cliente sem nome')}</span>
                <span style="color: var(--text-secondary); font-weight: 400;">• ${escapeHtml(order.productTitle || 'Item')}</span>
                ${order.deliveryDate ? `
                  <span style="font-size: 11px; font-weight: 500; color: var(--text-secondary); background: rgba(15,23,42,0.04); padding: 2px 6px; border-radius: 4px;">
                    📅 Entrega: <b>${order.deliveryDate}</b>
                  </span>
                ` : ''}
              </div>

              <!-- Line 2: Financial Subtitle (Total, Pago, Restante) -->
              <div class="list-meta" style="margin-top: 4px; display: flex; align-items: center; gap: 12px; font-size: 11px; color: var(--text-secondary); flex-wrap: wrap;">
                <span>Total: <b style="color: var(--text-primary);">R$ ${fin.totalAmount.toFixed(2)}</b></span>
                <span style="color: var(--border-subtle);">|</span>
                <span>Pago: <b style="color: #16a34a;">R$ ${fin.paidAmount.toFixed(2)}</b></span>
                <span style="color: var(--border-subtle);">|</span>
                <span>Restante: <b style="color: ${fin.remainingAmount > 0 ? '#ea580c' : '#16a34a'};">R$ ${fin.remainingAmount.toFixed(2)}</b></span>
                <span style="color: var(--border-subtle);">|</span>
                <span style="font-weight: 600; text-transform: uppercase; font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(15,23,42,0.05);">
                  ${escapeHtml(neon.label)}
                </span>
              </div>
            </div>

            <!-- Qty Highlight -->
            <div style="text-align: right; white-space: nowrap; padding: 0 8px;">
              <span style="font-size: 15px; font-weight: 700; color: var(--text-primary); display: block;">
                ${formatNumberXX(order.qty)} <span style="font-size: 11px; font-weight: 500; color: var(--text-secondary);">un</span>
              </span>
            </div>

            <!-- Actions: Three-Dots (⋮) Kebab Dropdown Menu -->
            <div class="dropdown-kebab-wrapper" style="position: relative;">
              <button class="action-btn-kebab" title="Opções do Pedido" aria-label="Ações do pedido">
                ⋮
              </button>
              <div class="dropdown-kebab-menu">
                <button class="dropdown-kebab-item" data-action="share-art" data-id="${order.id}">
                  <span style="color: #2563eb;">🔗</span> Compartilhar / Aprovar Arte
                </button>
                <button class="dropdown-kebab-item" data-action="edit-order" data-id="${order.id}">
                  <span>✏️</span> Editar dados
                </button>
                <button class="dropdown-kebab-item" data-action="dup-order" data-id="${order.id}">
                  <span>📋</span> Duplicar pedido
                </button>
                <div style="height: 1px; background: var(--border-subtle); margin: 3px 0;"></div>
                <button class="dropdown-kebab-item text-danger" data-action="del-order" data-id="${order.id}">
                  <span>🗑️</span> Excluir pedido
                </button>
              </div>
            </div>

          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Print Queue specialized table HTML (Fila de Impressão)
 */
function renderPrintQueueTableHtml(orders) {
  return `
    <div class="table-responsive" style="background: #ffffff; border-radius: 10px; border: 1px solid var(--border-subtle); overflow: hidden;">
      <table class="data-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: var(--bg-canvas); text-align: left; font-size: 12px; color: var(--text-secondary); border-bottom: 1px solid var(--border-subtle);">
            <th style="padding: 10px 14px;">Identificação</th>
            <th style="padding: 10px 14px;">Produto</th>
            <th style="padding: 10px 14px;">Qtd</th>
            <th style="padding: 10px 14px;">Arquivo (PDF)</th>
            <th style="padding: 10px 14px;">Status Plotter</th>
            <th style="padding: 10px 14px;">Prioridade</th>
            <th style="padding: 10px 14px;">Data Entrega</th>
            <th style="padding: 10px 14px; text-align: right;">Ações de Impressão</th>
          </tr>
        </thead>
        <tbody>
          ${orders.length === 0 ? `
            <tr>
              <td colspan="8" style="text-align: center; padding: 42px; color: var(--text-muted);">
                <b style="display: block; color: var(--text-primary); margin-bottom: 4px;">Nenhum pedido aguardando impressão na plotter.</b>
                Pedidos aprovados com molde gerado aparecerão aqui.
              </td>
            </tr>
          ` : orders.map(order => {
            const printJob = order.production?.printJob || {};
            const pStatus = printJob.status || 'aguardando_impressao';
            const pPriority = printJob.priority || 'normal';
            const files = order.generatedFiles || [];
            const latestFile = files[0];
            const orderNum = formatOrderNumber(order.number || order.id);

            return `
              <tr style="border-bottom: 1px solid var(--border-subtle); font-size: 12px;">
                <td style="padding: 10px 14px;">
                  <b>${orderNum}</b>
                  <div style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(order.customer || 'Cliente')}</div>
                </td>
                <td style="padding: 10px 14px;">${escapeHtml(order.productTitle || 'Item')}</td>
                <td style="padding: 10px 14px;"><b>${formatNumberXX(order.qty)}</b> un</td>
                <td style="padding: 10px 14px;">
                  ${latestFile ? `
                    <button class="btn btn-sm btn-dl-order-file" data-file-id="${latestFile.fileId}" style="font-size: 11px; padding: 3px 8px;">
                      📄 PDF Pronto
                    </button>
                  ` : `
                    <span style="font-size: 11px; color: #ea580c; font-weight: 500;">⚠ Sem PDF</span>
                  `}
                </td>
                <td style="padding: 10px 14px;">
                  <span class="status-pill ${pStatus === 'imprimindo' ? 'status-blue' : pStatus === 'concluida' ? 'status-green' : 'status-yellow'}" style="font-size: 11px; padding: 2px 8px;">
                    ${pStatus === 'imprimindo' ? 'Imprimindo' : pStatus === 'concluida' ? 'Concluída' : 'Aguardando'}
                  </span>
                </td>
                <td style="padding: 10px 14px;">
                  <span class="priority-badge priority-${pPriority}" style="font-size: 10px; text-transform: uppercase;">
                    ${pPriority}
                  </span>
                </td>
                <td style="padding: 10px 14px;">${order.deliveryDate || '--/--/----'}</td>
                <td style="padding: 10px 14px; text-align: right;">
                  <div class="action-btn-group" style="display: inline-flex; gap: 4px;">
                    ${pStatus !== 'imprimindo' && pStatus !== 'concluida' ? `
                      <button class="btn btn-sm btn-primary" data-action="print-start" data-id="${order.id}" style="font-size: 11px; padding: 3px 8px;">▶ Iniciar</button>
                    ` : ''}
                    ${pStatus === 'imprimindo' ? `
                      <button class="btn btn-sm" data-action="print-pause" data-id="${order.id}" style="font-size: 11px; padding: 3px 8px;">⏸ Pausar</button>
                      <button class="btn btn-sm btn-primary" data-action="print-complete" data-id="${order.id}" style="font-size: 11px; padding: 3px 8px;">✓ Concluir</button>
                    ` : ''}
                    <button class="btn btn-sm" data-action="view-order" data-id="${order.id}" style="font-size: 11px; padding: 3px 8px;">Consultar</button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Dedicated New Order Full Page (Slug: #pedidos/novo / view: 'pedidos-novo')
 */
export function renderNewOrderPage(container, ctx, editOrderId = null, prefill = null) {
  if (!container) return;
  const { switchView, showToast, openDrawer, closeDrawer } = ctx;

  // Support prefill passed as 3rd parameter
  if (editOrderId && typeof editOrderId === 'object' && !editOrderId.id && (editOrderId.productId || editOrderId.productTitle)) {
    prefill = editOrderId;
    editOrderId = null;
  }

  const products = loadProducts().filter(p => p.status === 'ativo');
  const allMaterials = loadMaterials();
  const allComponents = loadComponents();

  const editingOrder = editOrderId ? getOrderById(editOrderId) : null;
  const isEditing = Boolean(editingOrder);

  const prefillPid = typeof prefill === 'string' ? prefill : (prefill?.productId || null);

  // Local state
  let activeDivisoria = (!isEditing && prefillPid) ? 'section-produto' : 'section-cliente';

  let initialItems = [];
  if (editingOrder && Array.isArray(editingOrder.items) && editingOrder.items.length > 0) {
    initialItems = JSON.parse(JSON.stringify(editingOrder.items)).map(it => {
      if (!it.productSnapshot && it.productId) {
        it.productSnapshot = products.find(p => p.id === it.productId) || {};
      }
      if (!it.productSnapshot) {
        it.productSnapshot = products.find(p => p.name === it.productTitle) || {};
      }
      if (!it.personalization) it.personalization = {};
      if (!it.changeOptions) it.changeOptions = {};
      return it;
    });
  } else if (editingOrder) {
    initialItems = [{
      productId: editingOrder.productId || null,
      productTitle: editingOrder.productTitle || editingOrder.title || 'Item',
      qty: editingOrder.qty || 1,
      unitPrice: editingOrder.unitPrice || (editingOrder.productSnapshot?.price) || (editingOrder.financial?.totalAmount ? Number((editingOrder.financial.totalAmount / (editingOrder.qty || 1)).toFixed(2)) : 0),
      personalization: editingOrder.personalization ? JSON.parse(JSON.stringify(editingOrder.personalization)) : {},
      changeOptions: editingOrder.changeOptions ? JSON.parse(JSON.stringify(editingOrder.changeOptions)) : {},
      productSnapshot: editingOrder.productSnapshot || products.find(p => p.name === editingOrder.productTitle) || {},
      notes: editingOrder.notes || ''
    }];
  } else if (!isEditing && prefillPid) {
    const allCatalogProds = loadProducts();
    const prefillProd = allCatalogProds.find(p => p.id === prefillPid);
    if (prefillProd) {
      initialItems = [{
        productId: prefillProd.id,
        productTitle: prefillProd.name,
        qty: Number(prefill?.qty) || 1,
        unitPrice: Number(prefillProd.price) || 0,
        personalization: prefill?.personalization ? JSON.parse(JSON.stringify(prefill.personalization)) : {},
        changeOptions: prefill?.changeOptions ? JSON.parse(JSON.stringify(prefill.changeOptions)) : {},
        productSnapshot: JSON.parse(JSON.stringify(prefillProd)),
        notes: prefill?.notes || ''
      }];
    }
  }

  let orderData = {
    customerType: editingOrder?.customerType || 'PF', // PF | PJ
    customer: editingOrder?.customer || editingOrder?.customerName || '',
    customerPhone: editingOrder?.customerPhone || '',
    customerBirthDate: editingOrder?.customerBirthDate || '',
    customerCPF: editingOrder?.customerCPF || '',
    customerCNPJ: editingOrder?.customerCNPJ || '',
    customerCompany: editingOrder?.customerCompany || '',
    
    deliveryCep: editingOrder?.deliveryCep || '',
    deliveryAddress: editingOrder?.deliveryAddress || '',
    deliveryNumber: editingOrder?.deliveryNumber || '',
    deliveryNeighborhood: editingOrder?.deliveryNeighborhood || '',
    deliveryCity: editingOrder?.deliveryCity || '',
    deliveryState: editingOrder?.deliveryState || '',
    deliveryNotes: editingOrder?.deliveryNotes || '',

    orderDate: editingOrder?.orderDate
      ? (formatDateToInput(editingOrder.orderDate) || (editingOrder.orderDate.includes('-') ? editingOrder.orderDate : ''))
      : new Date().toISOString().split('T')[0],
    eventDate: editingOrder ? formatDateToInput(editingOrder.eventDate) : '',
    limitDate: editingOrder ? formatDateToInput(editingOrder.deliveryDate || editingOrder.limitDate) : '',

    items: initialItems,
    
    discount: editingOrder?.discount || editingOrder?.financial?.discount || 0,
    payments: (editingOrder && Array.isArray(editingOrder.payments) && editingOrder.payments.length > 0)
      ? JSON.parse(JSON.stringify(editingOrder.payments))
      : (editingOrder && Array.isArray(editingOrder.financial?.payments) && editingOrder.financial.payments.length > 0
          ? JSON.parse(JSON.stringify(editingOrder.financial.payments))
          : (editingOrder && editingOrder.financial?.paidAmount > 0
              ? [{
                  id: 'pay_init',
                  method: editingOrder.paymentMethod || 'PIX',
                  amount: Number(editingOrder.financial.paidAmount),
                  datetime: editingOrder.orderDate ? `${editingOrder.orderDate} às 12:00` : 'Inicial'
                }]
              : [])),
    
    notes: editingOrder?.notes || ''
  };

  let currentSelectedProdId = products[0]?.id || '';
  let currentSelectedKitTierId = '';
  const initialSelProd = products.find(p => p.id === currentSelectedProdId);
  if (initialSelProd && initialSelProd.isKit && Array.isArray(initialSelProd.kitTiers) && initialSelProd.kitTiers.length > 0) {
    const defTier = initialSelProd.kitTiers.find(t => t.isDefault) || initialSelProd.kitTiers[0];
    currentSelectedKitTierId = defTier ? defTier.id : '';
  }

  // Helper to calculate BOM for all items
  function calculateTotalBOM() {
    let totalCost = 0;
    const allBOM = [];

    for (const item of orderData.items) {
      if (!item.productSnapshot || !Array.isArray(item.productSnapshot.composition)) continue;
      
      for (const comp of item.productSnapshot.composition) {
        let name = 'Item';
        let unitCost = 0;
        let unit = comp.unit || 'un';

        if (comp.type === 'componente') {
          const c = allComponents.find(x => x.id === comp.itemId);
          name = c ? c.name : comp.itemId;
          unitCost = c ? (c.cost || 0) : 0;
        } else {
          const m = allMaterials.find(x => x.id === comp.itemId);
          name = m ? m.name : comp.itemId;
          unitCost = m ? (m.purchaseCost / (m.packQuantity || 1)) : 0;
        }
        
        const itemMultiplier = (item.kitQuantity && item.kitQuantity > 1) ? (item.qty * item.kitQuantity) : item.qty;
        const totalQty = (comp.quantity || 1) * itemMultiplier;
        const subtotal = totalQty * unitCost;
        totalCost += subtotal;
        
        // Group similar materials
        const existing = allBOM.find(b => b.name === name && b.unit === unit);
        if (existing) {
          existing.totalQty += totalQty;
          existing.subtotal += subtotal;
        } else {
          allBOM.push({ name, type: comp.type, totalQty, unit, unitCost, subtotal });
        }
      }
    }
    
    return { items: allBOM, totalCost };
  }

  function getCalculatedTotal() {
    const subtotal = orderData.items.reduce((sum, it) => sum + (it.unitPrice * it.qty), 0);
    return Math.max(0, subtotal - orderData.discount);
  }

  function render() {
    const todayStr = orderData.orderDate || (editingOrder && editingOrder.orderDate 
      ? formatDateToInput(editingOrder.orderDate) || new Date().toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]);
    
    // Auto calculate limit date (3 days before event) only if not already set
    if (orderData.eventDate && !orderData.limitDate) {
      const d = new Date(orderData.eventDate + 'T12:00:00');
      d.setDate(d.getDate() - 3);
      orderData.limitDate = d.toISOString().split('T')[0];
    }

    const isD1 = (activeDivisoria === 'section-cliente');
    const isD2 = (activeDivisoria === 'section-produto');
    const isD3 = (activeDivisoria === 'section-insumos');
    const isD4 = (activeDivisoria === 'section-financeiro');

    const html = `
      <div style="max-width: 100%; margin: 0 auto; padding-bottom: 32px;">
        <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0;">
              ${isEditing ? `✏️ Editar Pedido ${formatOrderNumber(editingOrder.number || editingOrder.id)}` : '📝 Novo Pedido'}
            </h2>
            ${isEditing ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">Atualize dados do cliente, itens, ficha técnica e pagamentos</div>` : ''}
          </div>
          <button type="button" class="btn btn-secondary" id="btn-back-to-orders" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
            ⬅ Voltar para Pedidos
          </button>
        </div>

        <form id="form-new-order-page" style="display: flex; flex-direction: column; gap: 0;">
          <!-- Abas Superiores -->
          <div class="binder-tabs" id="new-order-tabs">
            <button type="button" class="binder-tab ${isD1 ? 'active' : ''}" data-target="section-cliente">1. Dados do Cliente & Entrega</button>
            <button type="button" class="binder-tab ${isD2 ? 'active' : ''}" data-target="section-produto">2. Produtos & Personalização</button>
            <button type="button" class="binder-tab ${isD3 ? 'active' : ''}" data-target="section-insumos">3. Ficha Técnica</button>
            <button type="button" class="binder-tab ${isD4 ? 'active' : ''}" data-target="section-financeiro">4. Financeiro & Conclusão</button>
          </div>

          <div class="binder-panel" style="background: #ffffff; border: 1px solid var(--border-subtle); border-top: none; border-radius: 0 0 12px 12px; padding: 20px; box-shadow: 0 2px 12px rgba(15, 23, 42, 0.04); margin-bottom: 24px;">
            <!-- ETAPA 1: CLIENTE E ENTREGA -->
            <div id="section-cliente" style="display: ${isD1 ? 'block' : 'none'};">
              <div class="panel">
                <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 14px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">👤 Perfil do Cliente</h3>
                
                <div style="display: flex; gap: 16px; margin-bottom: 14px;">
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 14px;">
                    <input type="radio" name="customerType" value="PF" ${orderData.customerType === 'PF' ? 'checked' : ''}> Pessoa Física (PF)
                  </label>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 14px;">
                    <input type="radio" name="customerType" value="PJ" ${orderData.customerType === 'PJ' ? 'checked' : ''}> Pessoa Jurídica (PJ)
                  </label>
                </div>

                ${orderData.customerType === 'PF' ? `
                  <!-- PF Fields -->
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div>
                      <label class="form-label">Nome *</label>
                      <input class="form-input" id="inp-cli-nome" value="${escapeHtml(orderData.customer || '')}" placeholder="Nome do cliente">
                    </div>
                    <div>
                      <label class="form-label">Contato (WhatsApp)</label>
                      <input class="form-input" id="inp-cli-contato" data-mask="phone" value="${formatPhone(orderData.customerPhone || '')}" placeholder="(XX) 9 XXXX-XXXX">
                    </div>
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div>
                      <label class="form-label">Data de Nascimento</label>
                      <input type="date" class="form-input" id="inp-cli-nasc" value="${orderData.customerBirthDate || ''}">
                    </div>
                    <div>
                      <label class="form-label">CPF</label>
                      <input class="form-input" id="inp-cli-cpf" data-mask="cpf" value="${formatCPF(orderData.customerCPF || '')}" placeholder="XXX.XXX.XXX-XX">
                    </div>
                  </div>
                ` : `
                  <!-- PJ Fields -->
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div>
                      <label class="form-label">Empresa / Razão Social *</label>
                      <input class="form-input" id="inp-cli-empresa" value="${escapeHtml(orderData.customerCompany || '')}" placeholder="Nome da empresa">
                    </div>
                    <div>
                      <label class="form-label">Contato (WhatsApp)</label>
                      <input class="form-input" id="inp-cli-contato" data-mask="phone" value="${formatPhone(orderData.customerPhone || '')}" placeholder="(XX) 9 XXXX-XXXX">
                    </div>
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div>
                      <label class="form-label">CNPJ</label>
                      <input class="form-input" id="inp-cli-cnpj" data-mask="cnpj" value="${formatCNPJ(orderData.customerCNPJ || '')}" placeholder="XX.XXX.XXX/XXXX-XX">
                    </div>
                    <div></div>
                  </div>
                `}

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px; background: var(--bg-surface-raised); padding: 10px; border-radius: 8px;">
                  <div>
                    <label class="form-label" style="display: flex; align-items: center; justify-content: space-between;">
                      <span>📅 Data do Pedido *</span>
                      <span style="font-size: 10px; color: var(--accent-primary); font-weight: 600;">(retroativo / editável)</span>
                    </label>
                    <input type="date" class="form-input" id="inp-cli-data-pedido" value="${orderData.orderDate || todayStr}">
                  </div>
                  <div>
                    <label class="form-label">Data do Evento</label>
                    <input type="date" class="form-input" id="inp-cli-evento" value="${orderData.eventDate || ''}">
                  </div>
                  <div>
                    <label class="form-label">Data de Entrega / Limite</label>
                    <input type="date" class="form-input" id="inp-cli-limite" value="${orderData.limitDate || ''}">
                  </div>
                </div>

                <div>
                  <label class="form-label">Observações Internas (Cliente)</label>
                  <input type="text" class="form-input" id="inp-cli-obs" value="${escapeHtml(orderData.notes || '')}" placeholder="Digite observações internas sobre o cliente ou pedido...">
                </div>
              </div>

              <div class="panel" style="margin-top: 16px;">
                <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 14px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">🚚 Entrega</h3>
                
                <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px; margin-bottom: 12px;">
                  <div>
                    <label class="form-label">CEP</label>
                    <div style="display: flex; gap: 6px;">
                      <input class="form-input" id="inp-ent-cep" value="${escapeHtml(orderData.deliveryCep || '')}" placeholder="00000-000">
                      <button type="button" class="btn btn-secondary" id="btn-busca-cep" style="padding: 0 10px;">🔍</button>
                    </div>
                  </div>
                  <div>
                    <label class="form-label">Endereço</label>
                    <input class="form-input" id="inp-ent-endereco" value="${escapeHtml(orderData.deliveryAddress || '')}">
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 12px; margin-bottom: 12px;">
                  <div>
                    <label class="form-label">Número</label>
                    <input class="form-input" id="inp-ent-numero" value="${escapeHtml(orderData.deliveryNumber || '')}">
                  </div>
                  <div>
                    <label class="form-label">Bairro</label>
                    <input class="form-input" id="inp-ent-bairro" value="${escapeHtml(orderData.deliveryNeighborhood || '')}">
                  </div>
                  <div>
                    <label class="form-label">Cidade / Estado</label>
                    <div style="display: flex; gap: 6px;">
                      <input class="form-input" id="inp-ent-cidade" value="${escapeHtml(orderData.deliveryCity || '')}" style="flex: 2;">
                      <input class="form-input" id="inp-ent-estado" value="${escapeHtml(orderData.deliveryState || '')}" style="flex: 1;" placeholder="UF">
                    </div>
                  </div>
                </div>
                
                <div>
                  <label class="form-label">Observações de Entrega</label>
                  <input type="text" class="form-input" id="inp-ent-obs" value="${escapeHtml(orderData.deliveryNotes || '')}" placeholder="Digite observações sobre o local ou instruções de entrega...">
                </div>
              </div>

              <!-- Rodapé da Etapa 1: Avançar para a próxima etapa -->
              <div style="display: flex; justify-content: flex-end; margin-top: 20px; border-top: 1px solid var(--border-subtle); padding-top: 16px;">
                <button type="button" class="btn btn-primary btn-next-divisoria" data-next="section-produto" style="font-weight: 600; padding: 10px 22px;">
                  Próxima: Produtos & Personalização ➔
                </button>
              </div>
            </div>

            <!-- ETAPA 2: PRODUTOS E PERSONALIZAÇÃO -->
            <div id="section-produto" style="display: ${isD2 ? 'block' : 'none'};">
              <div class="panel" style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 12px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                  🛍️ Adicionar Produto ao Pedido
                </h3>
                ${(() => {
                  const activeSelectedProd = products.find(p => p.id === currentSelectedProdId) || products[0];
                  const isKitProd = Boolean(activeSelectedProd?.isKit && Array.isArray(activeSelectedProd?.kitTiers) && activeSelectedProd?.kitTiers.length > 0);

                  return `
                    <div style="display: grid; grid-template-columns: minmax(200px, 3fr) ${isKitProd ? 'minmax(220px, 2.5fr)' : ''} minmax(100px, 1fr) auto; gap: 12px; align-items: flex-end;">
                      <div>
                        <label class="form-label" style="font-weight: 600;">Produto do Catálogo</label>
                        <select class="form-input" id="inp-prod-select" style="width: 100%;">
                          ${products.length === 0 
                            ? '<option value="">Nenhum produto cadastrado no catálogo</option>' 
                            : products.map(p => `
                                <option value="${p.id}" ${p.id === currentSelectedProdId ? 'selected' : ''}>
                                  ${escapeHtml(p.name)} ${p.isKit ? '📦 [Kit/Lote]' : ''} - R$ ${Number(p.price || 0).toFixed(2)}
                                </option>
                              `).join('')
                          }
                        </select>
                      </div>

                      ${isKitProd ? `
                        <div>
                          <label class="form-label" style="font-weight: 600; color: #166534; display: flex; align-items: center; gap: 4px;">
                            <span>📦 Opção de Quantidade / Pacote</span>
                          </label>
                          <select class="form-input" id="inp-prod-kit-tier" style="width: 100%; border-color: #86efac; background: #f0fdf4; font-weight: 600; color: #166534;">
                            ${activeSelectedProd.kitTiers.map(tier => `
                              <option value="${tier.id}" ${tier.id === currentSelectedKitTierId ? 'selected' : ''}>
                                ${escapeHtml(tier.name || (tier.quantity + ' unidades'))} — R$ ${Number(tier.price).toFixed(2)} (${formatCurrency(tier.price / tier.quantity)}/un)
                              </option>
                            `).join('')}
                            <option value="custom" ${currentSelectedKitTierId === 'custom' ? 'selected' : ''}>Quantidade Personalizada (avulsa)</option>
                          </select>
                        </div>
                      ` : ''}

                      <div>
                        <label class="form-label" style="font-weight: 600;">
                          ${isKitProd && currentSelectedKitTierId !== 'custom' ? 'Qtd de Pacotes' : 'Quantidade'}
                        </label>
                        <input type="number" class="form-input" id="inp-prod-qty" value="1" min="1" style="width: 100%; text-align: center; font-weight: 600;">
                      </div>

                      <div>
                        <button type="button" class="btn btn-primary" id="btn-add-product" style="padding: 9px 18px; font-weight: 600; white-space: nowrap; width: 100%;">
                          + Adicionar Item
                        </button>
                      </div>
                    </div>

                    ${isKitProd ? `
                      <div style="margin-top: 10px; font-size: 11.5px; color: #15803d; background: #dcfce7; padding: 6px 12px; border-radius: 6px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-weight: 600;">
                        <span>📦 Produto vendido em lotes de quantidades. Escolha o pacote acima para cálculo exato de insumos e preço unitário.</span>
                        <span>Pacotes disponíveis: ${activeSelectedProd.kitTiers.map(t => t.quantity + ' un').join(', ')}</span>
                      </div>
                    ` : ''}
                  `;
                })()}
              </div>

              <div class="panel" style="border: 1px solid var(--border-subtle); border-radius: 8px; padding: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
                  <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                    🛒 Itens do Pedido & Detalhes de Produção
                  </h3>
                  <span style="font-size: 12px; color: var(--text-secondary); font-weight: 600;">
                    ${orderData.items.length} ${orderData.items.length === 1 ? 'item adicionado' : 'itens adicionados'}
                  </span>
                </div>
                
                <div id="order-items-list" style="display: flex; flex-direction: column; gap: 14px;">
                  ${orderData.items.length === 0 ? 
                    '<div style="text-align: center; padding: 32px 16px; color: var(--text-secondary); font-size: 14px; background: #f8fafc; border-radius: 8px; border: 1px dashed var(--border-subtle);">Nenhum produto adicionado ainda.<br><span style="font-size: 12px; color: var(--text-muted);">Selecione um produto no formulário acima e clique em <b>+ Adicionar Item</b>.</span></div>' 
                    : orderData.items.map((item, index) => {
                      
                      const prod = item.productSnapshot || {};
                      const itemPers = item.personalization || {};
                      const itemOpts = item.changeOptions || {};
                      let persHtml = '';
                      
                      if (Array.isArray(prod.personalizationFields) && prod.personalizationFields.length > 0) {
                        persHtml += '<div style="margin-top: 12px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">';
                        persHtml += '<div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;"><span class="badge-count" style="font-size: 10px; font-weight: 700; background: #e0e7ff; color: #3730a3;">✏️ EDITÁVEL: TEXTOS & INFORMAÇÕES</span></div>';
                        persHtml += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">';
                        prod.personalizationFields.forEach(field => {
                          const val = itemPers[field.id] || '';
                          const req = field.required ? ' *' : '';
                          persHtml += `
                            <div>
                              <label class="form-label" style="font-size: 11px; font-weight: 600; margin-bottom: 4px;">${escapeHtml(field.name)}${req}</label>
                              ${field.type === 'longText' 
                                ? `<textarea class="form-input item-pers-field" data-index="${index}" data-field="${field.id}" rows="2" style="font-size: 12px; width: 100%;" placeholder="Digite ${escapeHtml(field.name)}...">${escapeHtml(val)}</textarea>`
                                : `<input type="text" class="form-input item-pers-field" data-index="${index}" data-field="${field.id}" value="${escapeHtml(val)}" style="font-size: 12px; width: 100%;" placeholder="Digite ${escapeHtml(field.name)}...">`
                              }
                            </div>
                          `;
                        });
                        persHtml += '</div></div>';
                      }

                      if (Array.isArray(prod.changeOptions) && prod.changeOptions.length > 0) {
                        persHtml += '<div style="margin-top: 12px; padding: 12px; background: #fefce8; border: 1px solid #fef08a; border-radius: 6px;">';
                        persHtml += '<div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;"><span class="badge-count" style="font-size: 10px; font-weight: 700; background: #fef08a; color: #854d0e;">🎨 PERSONALIZÁVEL: CORES & ACABAMENTOS</span></div>';
                        persHtml += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">';
                        prod.changeOptions.forEach(opt => {
                          const val = itemOpts[opt.id] || '';
                          const req = opt.required ? ' *' : '';
                          const choices = opt.choices || opt.options || [];
                          persHtml += `
                            <div>
                              <label class="form-label" style="font-size: 11px; font-weight: 600; margin-bottom: 4px;">${escapeHtml(opt.name)}${req}</label>
                              <select class="form-input item-opt-field" data-index="${index}" data-field="${opt.id}" style="font-size: 12px; width: 100%;">
                                <option value="">Selecione uma opção...</option>
                                ${choices.map(o => `<option value="${escapeHtml(o)}" ${val === o ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
                              </select>
                            </div>
                          `;
                        });
                        persHtml += '</div></div>';
                      }

                      const itemQty = Number(item.qty) || 1;
                      const itemUnitPrice = Number(item.unitPrice) || 0;
                      const itemSubtotal = itemQty * itemUnitPrice;

                      return `
                        <div style="border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                              <span style="background: var(--accent-primary); color: #fff; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;">
                                ${index + 1}
                              </span>
                              <div>
                                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                  <span>${escapeHtml(item.productTitle || 'Item')}</span>
                                  ${item.isKit && item.kitQuantity > 1 ? `
                                    <span class="badge-count" style="background: #dcfce7; color: #15803d; font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
                                      📦 Kit (${item.kitQuantity} un/pacote)
                                    </span>
                                  ` : ''}
                                </div>
                                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                                  Preço: <b>R$ ${itemUnitPrice.toFixed(2)}</b>
                                  ${item.isKit && item.kitQuantity > 1 ? `
                                    <span style="color: var(--text-muted); margin-left: 4px;">(R$ ${(itemUnitPrice / item.kitQuantity).toFixed(2)} / un)</span>
                                    <span style="margin-left: 8px; color: #15803d; font-weight: 600; background: #f0fdf4; padding: 1px 6px; border-radius: 4px;">
                                      • Total a produzir: <b>${itemQty * item.kitQuantity} unidades</b>
                                    </span>
                                  ` : ''}
                                </div>
                              </div>
                            </div>

                            <div style="display: flex; align-items: center; gap: 14px;">
                              <div style="display: flex; align-items: center; gap: 4px; background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 2px 4px;">
                                <button type="button" class="btn-item-qty-dec" data-index="${index}" style="border: none; background: transparent; cursor: pointer; padding: 2px 6px; font-weight: 700; color: var(--text-primary); font-size: 14px;">-</button>
                                <input type="number" class="item-qty-input" data-index="${index}" value="${itemQty}" min="1" style="width: 44px; text-align: center; font-size: 13px; font-weight: 700; border: none; background: transparent; outline: none;">
                                <button type="button" class="btn-item-qty-inc" data-index="${index}" style="border: none; background: transparent; cursor: pointer; padding: 2px 6px; font-weight: 700; color: var(--text-primary); font-size: 14px;">+</button>
                              </div>

                              <div style="text-align: right; min-width: 90px;">
                                <span style="font-size: 10px; text-transform: uppercase; color: var(--text-secondary); display: block;">Subtotal</span>
                                <span style="font-size: 14px; font-weight: 700; color: var(--accent-primary);">R$ ${itemSubtotal.toFixed(2)}</span>
                              </div>

                              <button type="button" class="btn btn-secondary btn-remove-item" data-index="${index}" style="padding: 4px 10px; font-size: 12px; color: #dc2626; border-color: #fca5a5; display: inline-flex; align-items: center; gap: 4px;" title="Remover item do pedido">
                                🗑️ Remover
                              </button>
                            </div>
                          </div>

                          ${persHtml}

                          <div style="margin-top: 10px;">
                            <label class="form-label" style="font-size: 11px; font-weight: 600; margin-bottom: 4px;">Observações Específicas do Item (Instruções de produção)</label>
                            <input type="text" class="form-input item-notes-field" data-index="${index}" value="${escapeHtml(item.notes || '')}" style="font-size: 12px; width: 100%;" placeholder="Ex: Nome da criança, tema, detalhes de corte ou acabamento...">
                          </div>
                        </div>
                      `;
                    }).join('')
                  }
                </div>
              </div>

              <!-- Rodapé da Etapa 2 -->
              <div style="display: flex; justify-content: space-between; margin-top: 20px; border-top: 1px solid var(--border-subtle); padding-top: 16px;">
                <button type="button" class="btn btn-secondary btn-prev-divisoria" data-prev="section-cliente">⬅ Anterior (Cliente & Entrega)</button>
                <button type="button" class="btn btn-primary btn-next-divisoria" data-next="section-insumos" style="font-weight: 600; padding: 10px 22px;">Próxima: Ficha Técnica ➔</button>
              </div>
            </div>

            <!-- ETAPA 3: FICHA TÉCNICA E BOM SNAPSHOT -->
            <div id="section-insumos" style="display: ${isD3 ? 'block' : 'none'};">
              <div class="panel">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                  <h3 style="font-size: 1rem; font-weight: 700;">🧩 Insumos e Materiais Necessários</h3>
                </div>
                <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">
                  O sistema calcula automaticamente todos os materiais que serão gastos com base nos produtos escolhidos e quantidades. 
                  Os custos ficam "congelados" nesta cópia (snapshot) para não sofrerem impacto caso os preços mudem futuramente.
                </p>

                <div style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 8px; overflow: hidden;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                      <tr style="background: rgba(0,0,0,0.02); text-align: left; border-bottom: 1px solid var(--border-subtle);">
                        <th style="padding: 10px 12px; font-weight: 600;">Insumo / Componente</th>
                        <th style="padding: 10px 12px; font-weight: 600; text-align: center;">Qtd Necessária</th>
                        <th style="padding: 10px 12px; font-weight: 600; text-align: right;">Custo Est.</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${(() => {
                        const bom = calculateTotalBOM();
                        if (bom.items.length === 0) return '<tr><td colspan="3" style="padding: 16px; text-align: center; color: var(--text-secondary);">Nenhum insumo configurado nos produtos selecionados.</td></tr>';
                        return bom.items.map(b => `
                          <tr style="border-bottom: 1px solid var(--border-subtle);">
                            <td style="padding: 10px 12px;">${b.name} <span style="font-size: 10px; color: var(--text-secondary); padding: 2px 4px; background: #e5e7eb; border-radius: 4px; margin-left: 6px;">${b.type}</span></td>
                            <td style="padding: 10px 12px; text-align: center; font-variant-numeric: tabular-nums;">${b.totalQty} ${b.unit}</td>
                            <td style="padding: 10px 12px; text-align: right; color: var(--accent-primary); font-weight: 500;">R$ ${b.subtotal.toFixed(2)}</td>
                          </tr>
                        `).join('') + `
                          <tr style="background: rgba(219, 39, 119, 0.05);">
                            <td colspan="2" style="padding: 12px; font-weight: 700; text-align: right; color: var(--text-primary);">Custo de Material Previsto:</td>
                            <td style="padding: 12px; font-weight: 700; text-align: right; color: var(--accent-primary);">R$ ${bom.totalCost.toFixed(2)}</td>
                          </tr>
                        `;
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Rodapé da Etapa 3 -->
              <div style="display: flex; justify-content: space-between; margin-top: 20px; border-top: 1px solid var(--border-subtle); padding-top: 16px;">
                <button type="button" class="btn btn-secondary btn-prev-divisoria" data-prev="section-produto">⬅ Anterior (Produtos & Personalização)</button>
                <button type="button" class="btn btn-primary btn-next-divisoria" data-next="section-financeiro" style="font-weight: 600; padding: 10px 22px;">Próxima: Financeiro & Conclusão ➔</button>
              </div>
            </div>

            <!-- ETAPA 4: FINANCEIRO & NOTA FISCAL -->
            <div id="section-financeiro" style="display: ${isD4 ? 'block' : 'none'};">
              <div class="panel" style="background: #fff; border: 1px solid var(--border-subtle); box-shadow: 0 4px 12px rgba(0,0,0,0.03);" id="invoice-printable-area">
                
                <!-- Cabeçalho NF -->
                <div style="text-align: center; border-bottom: 2px dashed var(--border-subtle); padding-bottom: 16px; margin-bottom: 16px;">
                  <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); text-transform: uppercase; letter-spacing: 1px;">RESUMO DO PEDIDO</h2>
                  <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Ateliê Paper Max · Emissão: ${todayStr.split('-').reverse().join('/')}</div>
                </div>

                <!-- Cliente NF -->
                <div style="margin-bottom: 16px; font-size: 13px;">
                  <div style="font-weight: 700; margin-bottom: 4px; color: var(--text-primary);">DADOS DO CLIENTE</div>
                  <div><strong>Nome/Razão:</strong> ${orderData.customerType === 'PJ' ? (orderData.customerCompany || orderData.customer) : orderData.customer}</div>
                  <div><strong>Documento:</strong> ${orderData.customerType === 'PJ' ? orderData.customerCNPJ : orderData.customerCPF}</div>
                  <div><strong>Contato:</strong> ${orderData.customerPhone}</div>
                </div>

                <!-- Itens NF -->
                <div style="margin-bottom: 16px;">
                  <div style="font-weight: 700; margin-bottom: 8px; color: var(--text-primary); font-size: 13px;">INFORMAÇÕES INDIVIDUAIS (ITENS)</div>
                  <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                      <tr style="border-bottom: 1px solid var(--border-subtle); text-align: left;">
                        <th style="padding: 6px 0;">Qtd</th>
                        <th style="padding: 6px 0;">Produto / Descrição</th>
                        <th style="padding: 6px 0; text-align: right;">V. Unit</th>
                        <th style="padding: 6px 0; text-align: right;">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${orderData.items.map(item => `
                        <tr style="border-bottom: 1px solid #f3f4f6;">
                          <td style="padding: 8px 0; font-weight: 600;">${item.qty}x</td>
                          <td style="padding: 8px 0;">
                            ${item.productTitle}
                            ${item.notes ? `<div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">Obs: ${item.notes}</div>` : ''}
                          </td>
                          <td style="padding: 8px 0; text-align: right;">R$ ${Number(item.unitPrice).toFixed(2)}</td>
                          <td style="padding: 8px 0; text-align: right; font-weight: 600;">R$ ${(item.unitPrice * item.qty).toFixed(2)}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>

                <!-- Totais NF -->
                <div style="border-top: 2px dashed var(--border-subtle); padding-top: 16px; margin-bottom: 16px;">
                  <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                    <span>Subtotal:</span>
                    <span>R$ ${orderData.items.reduce((sum, it) => sum + (it.unitPrice * it.qty), 0).toFixed(2)}</span>
                  </div>
                  
                  <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; margin-bottom: 4px; padding: 4px 0;" class="no-print-interactive">
                    <span>Desconto (R$):</span>
                    <input type="number" step="0.01" min="0" class="form-input" id="inp-fin-discount" value="${orderData.discount}" style="width: 100px; text-align: right; padding: 4px 8px; font-size: 12px;">
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; margin-top: 8px; color: var(--accent-primary);">
                    <span>VALOR TOTAL:</span>
                    <span>R$ ${getCalculatedTotal().toFixed(2)}</span>
                  </div>
                </div>

                <!-- Histórico de Pagamento no Pedido -->
                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid var(--border-subtle); margin-top: 16px;">
                  <div style="font-weight: 700; margin-bottom: 12px; color: var(--text-primary); font-size: 13px; text-transform: uppercase; display: flex; align-items: center; justify-content: space-between;">
                    <span>💳 Histórico de Pagamentos</span>
                    <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: none;">Lançamento e registro por data/hora</span>
                  </div>

                  <!-- Linha de inserção: TIPO DE PAGAMENTO (SELECT) | R$ [INPUT] | + -->
                  <div class="no-print-interactive" style="display: grid; grid-template-columns: 1fr 140px auto; gap: 10px; align-items: end; background: #ffffff; padding: 12px; border: 1px solid var(--border-subtle); border-radius: 8px; margin-bottom: 14px;">
                    <div>
                      <label style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 4px;">Tipo de Pagamento</label>
                      <select class="form-input" id="inp-new-pay-method" style="height: 38px; font-size: 13px; font-weight: 600; text-transform: uppercase;">
                        <option value="DINHEIRO">DINHEIRO</option>
                        <option value="PIX" selected>PIX</option>
                        <option value="CRÉDITO">CRÉDITO</option>
                        <option value="DÉBITO">DÉBITO</option>
                        <option value="PERMUTA">PERMUTA</option>
                        <option value="BOLETO">BOLETO</option>
                        <option value="TRANSFERÊNCIA">TRANSFERÊNCIA</option>
                      </select>
                    </div>
                    <div>
                      <label style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 4px;">R$ Valor</label>
                      <input type="number" step="0.01" min="0.01" class="form-input" id="inp-new-pay-amount" placeholder="0,00" value="${(() => {
                        const paidSoFar = orderData.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
                        const rem = Math.max(0, getCalculatedTotal() - paidSoFar);
                        return rem > 0 ? rem.toFixed(2) : '';
                      })()}" style="height: 38px; font-size: 14px; font-weight: 700; text-align: right;">
                    </div>
                    <div>
                      <button type="button" class="btn btn-primary" id="btn-add-pay-entry" style="height: 38px; padding: 0 16px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 4px;" title="Adicionar Pagamento ao Histórico">
                        <span style="font-size: 18px; line-height: 1;">+</span>
                      </button>
                    </div>
                  </div>

                  <!-- Tabela do Histórico de Pagamentos -->
                  <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; overflow: hidden; margin-bottom: 12px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                      <thead>
                        <tr style="background: #f1f5f9; border-bottom: 1px solid var(--border-subtle); text-align: left;">
                          <th style="padding: 9px 12px; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Tipo de Pagamento</th>
                          <th style="padding: 9px 12px; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; text-align: right;">Valor</th>
                          <th style="padding: 9px 12px; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; text-align: center;">Data / Hora</th>
                          <th style="padding: 9px 12px; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; text-align: center; width: 44px;" class="no-print-interactive"></th>
                        </tr>
                      </thead>
                      <tbody>
                        ${orderData.payments.length === 0 ? `
                          <tr>
                            <td colspan="4" style="padding: 16px; text-align: center; color: var(--text-secondary); font-size: 12px;">
                              Nenhum pagamento registrado ainda. Selecione o tipo de pagamento, digite o valor e clique em <b>+</b>.
                            </td>
                          </tr>
                        ` : orderData.payments.map((p, idx) => `
                          <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 10px 12px; font-weight: 700; color: var(--text-primary); text-transform: uppercase;">
                              ${escapeHtml(p.method)}
                            </td>
                            <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #16a34a; font-variant-numeric: tabular-nums;">
                              R$ ${Number(p.amount).toFixed(2)}
                            </td>
                            <td style="padding: 10px 12px; text-align: center; color: var(--text-secondary); font-size: 12px; font-variant-numeric: tabular-nums;">
                              ${escapeHtml(p.datetime || (p.date + (p.time ? ` às ${p.time}` : '')))}
                            </td>
                            <td style="padding: 10px 12px; text-align: center;" class="no-print-interactive">
                              <button type="button" class="btn-remove-pay-entry" data-index="${idx}" style="background: none; border: none; cursor: pointer; color: #dc2626; font-size: 14px; padding: 2px 6px; border-radius: 4px;" title="Remover lançamento">
                                ✖
                              </button>
                            </td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>

                  <!-- Resumo Financeiro da Entrada e Saldo -->
                  ${(() => {
                    const totalPaid = orderData.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
                    const total = getCalculatedTotal();
                    const remaining = Math.max(0, total - totalPaid);
                    return `
                      <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                        <span>Valor Entrada/Pago:</span>
                        <span style="font-weight: 700; color: #16a34a;">R$ ${totalPaid.toFixed(2)}</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700;">
                        <span>Valor Restante:</span>
                        <span style="color: ${remaining > 0 ? '#dc2626' : '#16a34a'}; font-weight: 700;">
                          ${remaining > 0 ? `R$ ${remaining.toFixed(2)}` : '✅ Totalmente Quitado'}
                        </span>
                      </div>
                    `;
                  })()}
                </div>

                <!-- Action buttons on NF -->
                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;" class="no-print-interactive">
                  <button type="button" class="btn btn-secondary" id="btn-print-nf">🖨️ Salvar PDF / Imprimir</button>
                </div>

              </div>

              <!-- Rodapé da Etapa 4 -->
              <div style="display: flex; justify-content: space-between; margin-top: 24px; border-top: 1px solid var(--border-subtle); padding-top: 16px;">
                <button type="button" class="btn btn-secondary btn-prev-divisoria" data-prev="section-insumos">⬅ Anterior (Ficha Técnica)</button>
                <button type="submit" class="btn btn-primary" style="font-size: 1.1rem; padding: 10px 26px; font-weight: 700;">
                  ${isEditing ? '💾 Salvar Alterações no Pedido' : '✅ Concluir e Salvar Pedido'}
                </button>
              </div>
            </div>
          </div>

        </form>
      </div>
    `;

    container.innerHTML = html;

    // Helper: Save form inputs to orderData before re-rendering or switching divisórias
    function saveCurrentState() {
      // Cliente & Entrega
      const custTypeEl = container.querySelector('input[name="customerType"]:checked');
      if (custTypeEl) orderData.customerType = custTypeEl.value;

      const inpCliNome = container.querySelector('#inp-cli-nome');
      if (inpCliNome) orderData.customer = inpCliNome.value;

      const inpCliEmpresa = container.querySelector('#inp-cli-empresa');
      if (inpCliEmpresa) orderData.customerCompany = inpCliEmpresa.value;

      const inpCliContato = container.querySelector('#inp-cli-contato');
      if (inpCliContato) orderData.customerPhone = inpCliContato.value;

      const inpCliNasc = container.querySelector('#inp-cli-nasc');
      if (inpCliNasc) orderData.customerBirthDate = inpCliNasc.value;

      const inpCliCpf = container.querySelector('#inp-cli-cpf');
      if (inpCliCpf) orderData.customerCPF = inpCliCpf.value;

      const inpCliCnpj = container.querySelector('#inp-cli-cnpj');
      if (inpCliCnpj) orderData.customerCNPJ = inpCliCnpj.value;

      const inpCliDataPed = container.querySelector('#inp-cli-data-pedido');
      if (inpCliDataPed && inpCliDataPed.value) orderData.orderDate = inpCliDataPed.value;

      const inpCliEvento = container.querySelector('#inp-cli-evento');
      if (inpCliEvento) orderData.eventDate = inpCliEvento.value;

      const inpCliLimite = container.querySelector('#inp-cli-limite');
      if (inpCliLimite) orderData.limitDate = inpCliLimite.value;

      const inpCliObs = container.querySelector('#inp-cli-obs');
      if (inpCliObs) orderData.notes = inpCliObs.value;
      
      const inpEntCep = container.querySelector('#inp-ent-cep');
      if (inpEntCep) orderData.deliveryCep = inpEntCep.value;

      const inpEntEnd = container.querySelector('#inp-ent-endereco');
      if (inpEntEnd) orderData.deliveryAddress = inpEntEnd.value;

      const inpEntNum = container.querySelector('#inp-ent-numero');
      if (inpEntNum) orderData.deliveryNumber = inpEntNum.value;

      const inpEntBairro = container.querySelector('#inp-ent-bairro');
      if (inpEntBairro) orderData.deliveryNeighborhood = inpEntBairro.value;

      const inpEntCidade = container.querySelector('#inp-ent-cidade');
      if (inpEntCidade) orderData.deliveryCity = inpEntCidade.value;

      const inpEntEstado = container.querySelector('#inp-ent-estado');
      if (inpEntEstado) orderData.deliveryState = inpEntEstado.value;

      const inpEntObs = container.querySelector('#inp-ent-obs');
      if (inpEntObs) orderData.deliveryNotes = inpEntObs.value;

      // Items personalization & options
      container.querySelectorAll('.item-pers-field').forEach(el => {
        const idx = el.dataset.index;
        const fieldId = el.dataset.field;
        if (orderData.items[idx]) {
          if (!orderData.items[idx].personalization) orderData.items[idx].personalization = {};
          orderData.items[idx].personalization[fieldId] = el.value;
        }
      });
      container.querySelectorAll('.item-opt-field').forEach(el => {
        const idx = el.dataset.index;
        const fieldId = el.dataset.field;
        if (orderData.items[idx]) {
          if (!orderData.items[idx].changeOptions) orderData.items[idx].changeOptions = {};
          orderData.items[idx].changeOptions[fieldId] = el.value;
        }
      });
      container.querySelectorAll('.item-notes-field').forEach(el => {
        const idx = el.dataset.index;
        if (orderData.items[idx]) {
          orderData.items[idx].notes = el.value;
        }
      });

      // Financeiro
      const inpFinDisc = container.querySelector('#inp-fin-discount');
      if (inpFinDisc) orderData.discount = Number(inpFinDisc.value) || 0;
    }

    // Function to switch active divisória: Highlights target and expands page, collapses others in gray
    function switchDivisoria(targetId) {
      saveCurrentState();
      activeDivisoria = targetId;
      render();
      const newOrderTabs = container.querySelector('#new-order-tabs');
      if (newOrderTabs) {
        newOrderTabs.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    // Real-time synchronization of all form inputs so state is never lost
    container.addEventListener('input', (e) => {
      const t = e.target;
      if (!t) return;
      if (t.id === 'inp-cli-nome') orderData.customer = t.value;
      else if (t.id === 'inp-cli-empresa') orderData.customerCompany = t.value;
      else if (t.id === 'inp-cli-contato') orderData.customerPhone = t.value;
      else if (t.id === 'inp-cli-nasc') orderData.customerBirthDate = t.value;
      else if (t.id === 'inp-cli-cpf') orderData.customerCPF = t.value;
      else if (t.id === 'inp-cli-cnpj') orderData.customerCNPJ = t.value;
      else if (t.id === 'inp-cli-data-pedido') orderData.orderDate = t.value;
      else if (t.id === 'inp-cli-evento') orderData.eventDate = t.value;
      else if (t.id === 'inp-cli-limite') orderData.limitDate = t.value;
      else if (t.id === 'inp-cli-obs') orderData.notes = t.value;
      else if (t.id === 'inp-ent-cep') orderData.deliveryCep = t.value;
      else if (t.id === 'inp-ent-endereco') orderData.deliveryAddress = t.value;
      else if (t.id === 'inp-ent-numero') orderData.deliveryNumber = t.value;
      else if (t.id === 'inp-ent-bairro') orderData.deliveryNeighborhood = t.value;
      else if (t.id === 'inp-ent-cidade') orderData.deliveryCity = t.value;
      else if (t.id === 'inp-ent-estado') orderData.deliveryState = t.value;
      else if (t.id === 'inp-ent-obs') orderData.deliveryNotes = t.value;
      else if (t.classList.contains('item-pers-field')) {
        const idx = t.dataset.index;
        const fid = t.dataset.field;
        if (orderData.items[idx]) {
          if (!orderData.items[idx].personalization) orderData.items[idx].personalization = {};
          orderData.items[idx].personalization[fid] = t.value;
        }
      } else if (t.classList.contains('item-opt-field')) {
        const idx = t.dataset.index;
        const fid = t.dataset.field;
        if (orderData.items[idx]) {
          if (!orderData.items[idx].changeOptions) orderData.items[idx].changeOptions = {};
          orderData.items[idx].changeOptions[fid] = t.value;
        }
      } else if (t.classList.contains('item-notes-field')) {
        const idx = t.dataset.index;
        if (orderData.items[idx]) {
          orderData.items[idx].notes = t.value;
        }
      }
    });

    // Prevent Enter key in text inputs from triggering unwanted form submits
    container.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT' && e.target.type !== 'submit') {
        e.preventDefault();
      }
    });

    // Attach click events on top binder tabs
    container.querySelectorAll('.binder-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        switchDivisoria(tab.dataset.target);
      });
    });

    // Next Divisória buttons
    container.querySelectorAll('.btn-next-divisoria').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        switchDivisoria(btn.dataset.next);
      });
    });

    // Previous Divisória buttons
    container.querySelectorAll('.btn-prev-divisoria').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        switchDivisoria(btn.dataset.prev);
      });
    });

    // Customer Type change
    container.querySelectorAll('input[name="customerType"]').forEach(r => {
      r.addEventListener('change', () => {
        saveCurrentState();
        activeDivisoria = 'section-cliente';
        render();
      });
    });

    const btnBuscaCep = document.getElementById('btn-busca-cep');
    if (btnBuscaCep) {
      btnBuscaCep.addEventListener('click', async () => {
        const cep = document.getElementById('inp-ent-cep').value.replace(/\D/g, '');
        if (cep.length !== 8) { showToast('CEP inválido (digite 8 dígitos)', '⚠️'); return; }
        try {
          const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
          const data = await res.json();
          if (data.erro) throw new Error();
          document.getElementById('inp-ent-endereco').value = data.logradouro || '';
          document.getElementById('inp-ent-bairro').value = data.bairro || '';
          document.getElementById('inp-ent-cidade').value = data.localidade || '';
          document.getElementById('inp-ent-estado').value = data.uf || '';
          document.getElementById('inp-ent-numero').focus();
          saveCurrentState();
        } catch(e) {
          showToast('Erro ao buscar CEP', '🔴');
        }
      });
    }

    const inpProdSelect = document.getElementById('inp-prod-select');
    if (inpProdSelect) {
      inpProdSelect.addEventListener('change', (e) => {
        currentSelectedProdId = e.target.value;
        const p = products.find(x => x.id === currentSelectedProdId);
        if (p && p.isKit && Array.isArray(p.kitTiers) && p.kitTiers.length > 0) {
          const defT = p.kitTiers.find(t => t.isDefault) || p.kitTiers[0];
          currentSelectedKitTierId = defT ? defT.id : '';
        } else {
          currentSelectedKitTierId = '';
        }
        saveCurrentState();
        activeDivisoria = 'section-produto';
        render();
      });
    }

    const inpKitTier = document.getElementById('inp-prod-kit-tier');
    if (inpKitTier) {
      inpKitTier.addEventListener('change', (e) => {
        currentSelectedKitTierId = e.target.value;
      });
    }

    const btnAddProduct = document.getElementById('btn-add-product');
    if (btnAddProduct) {
      btnAddProduct.addEventListener('click', () => {
        saveCurrentState();
        const pid = document.getElementById('inp-prod-select')?.value;
        const pqty = Number(document.getElementById('inp-prod-qty')?.value) || 1;
        const prod = products.find(p => p.id === pid);
        if (prod) {
          let itemTitle = prod.name;
          let itemPrice = Number(prod.price) || 0;
          let isKit = Boolean(prod.isKit);
          let kitTierId = null;
          let kitTierName = null;
          let kitQty = 1;
          let itemNotes = '';

          if (isKit && Array.isArray(prod.kitTiers) && prod.kitTiers.length > 0) {
            const tierSelect = document.getElementById('inp-prod-kit-tier');
            const chosenTierId = tierSelect ? tierSelect.value : currentSelectedKitTierId;
            if (chosenTierId && chosenTierId !== 'custom') {
              const tier = prod.kitTiers.find(t => t.id === chosenTierId) || prod.kitTiers[0];
              if (tier) {
                kitTierId = tier.id;
                kitTierName = tier.name || `Kit ${tier.quantity} unidades`;
                kitQty = Number(tier.quantity) || 1;
                itemPrice = Number(tier.price) || itemPrice;
                itemTitle = `${prod.name} (${kitTierName})`;
                itemNotes = `Pacote com ${kitQty} unidades`;
              }
            } else if (chosenTierId === 'custom') {
              kitQty = 1;
              kitTierName = 'Quantidade Personalizada';
            }
          }

          orderData.items.push({
            productId: prod.id,
            productTitle: itemTitle,
            qty: pqty,
            unitPrice: itemPrice,
            isKit: isKit,
            kitTierId: kitTierId,
            kitTierName: kitTierName,
            kitQuantity: kitQty,
            totalUnits: pqty * kitQty,
            personalization: {},
            changeOptions: {},
            productSnapshot: JSON.parse(JSON.stringify(prod)),
            notes: itemNotes
          });
          activeDivisoria = 'section-produto';
          render();
          showToast(`"${itemTitle}" adicionado ao pedido!`, '🛍️');
        }
      });
    }

    container.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        saveCurrentState();
        const idx = Number(e.currentTarget.dataset.index);
        orderData.items.splice(idx, 1);
        activeDivisoria = 'section-produto';
        render();
      });
    });

    // Item Quantity Steppers and Direct Input
    container.querySelectorAll('.btn-item-qty-inc').forEach(btn => {
      btn.addEventListener('click', (e) => {
        saveCurrentState();
        const idx = Number(e.currentTarget.dataset.index);
        if (orderData.items[idx]) {
          orderData.items[idx].qty = (Number(orderData.items[idx].qty) || 1) + 1;
          activeDivisoria = 'section-produto';
          render();
        }
      });
    });

    container.querySelectorAll('.btn-item-qty-dec').forEach(btn => {
      btn.addEventListener('click', (e) => {
        saveCurrentState();
        const idx = Number(e.currentTarget.dataset.index);
        if (orderData.items[idx]) {
          const currentQty = Number(orderData.items[idx].qty) || 1;
          if (currentQty > 1) {
            orderData.items[idx].qty = currentQty - 1;
            activeDivisoria = 'section-produto';
            render();
          }
        }
      });
    });

    container.querySelectorAll('.item-qty-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        saveCurrentState();
        const idx = Number(e.currentTarget.dataset.index);
        const val = Math.max(1, Number(e.currentTarget.value) || 1);
        if (orderData.items[idx]) {
          orderData.items[idx].qty = val;
          activeDivisoria = 'section-produto';
          render();
        }
      });
    });

    const btnAddPayEntry = document.getElementById('btn-add-pay-entry');
    if (btnAddPayEntry) {
      btnAddPayEntry.addEventListener('click', () => {
        saveCurrentState();
        const selMethod = document.getElementById('inp-new-pay-method');
        const inpAmount = document.getElementById('inp-new-pay-amount');
        const amount = Number(inpAmount?.value);

        if (isNaN(amount) || amount <= 0) {
          showToast('Informe um valor de pagamento válido maior que zero.', '⚠️');
          if (inpAmount) inpAmount.focus();
          return;
        }

        const method = (selMethod?.value || 'PIX').trim().toUpperCase();
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = String(now.getFullYear()).slice(-2);
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const datetimeStr = `${day}/${month}/${year} às ${hours}:${minutes}`;

        orderData.payments.push({
          id: 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          method,
          amount: Number(amount.toFixed(2)),
          date: `${day}/${month}/${year}`,
          time: `${hours}:${minutes}`,
          datetime: datetimeStr,
          timestamp: now.toISOString()
        });

        activeDivisoria = 'section-financeiro';
        render();
        showToast(`Pagamento de R$ ${amount.toFixed(2)} (${method}) adicionado ao histórico!`, '✅');
      });
    }

    container.querySelectorAll('.btn-remove-pay-entry').forEach(btn => {
      btn.addEventListener('click', (e) => {
        saveCurrentState();
        const idx = Number(e.currentTarget.dataset.index);
        orderData.payments.splice(idx, 1);
        activeDivisoria = 'section-financeiro';
        render();
      });
    });

    const btnPrintNf = document.getElementById('btn-print-nf');
    if (btnPrintNf) {
      btnPrintNf.addEventListener('click', () => {
        const styles = `
          <style>
            body { font-family: sans-serif; padding: 20px; }
            .no-print-interactive { display: none !important; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }
          </style>
        `;
        const printContent = document.getElementById('invoice-printable-area').innerHTML;
        const win = window.open('', '_blank');
        win.document.write('<html><head><title>Nota do Pedido</title>' + styles + '</head><body>' + printContent + '</body></html>');
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 500);
      });
    }

    // Refresh calculations when discount changes without re-rendering DOM
    const inpDiscount = container.querySelector('#inp-fin-discount');
    if (inpDiscount) {
      const updateDiscountCalculations = () => {
        orderData.discount = Number(inpDiscount.value) || 0;
        const total = getCalculatedTotal();
        const totalValEl = container.querySelector('#invoice-printable-area b, #invoice-printable-area span[style*="font-size: 15px"] + span');
        if (totalValEl) totalValEl.textContent = `R$ ${total.toFixed(2)}`;
      };
      inpDiscount.addEventListener('input', updateDiscountCalculations);
      inpDiscount.addEventListener('change', updateDiscountCalculations);
    }

    // Form Submit (Save Order)
    const form = document.getElementById('form-new-order-page');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveCurrentState();

        if (orderData.customerType === 'PF' && (!orderData.customer || !orderData.customer.trim())) {
          showToast('Por favor, informe o Nome do Cliente na Divisória 1.', '⚠️');
          switchDivisoria('section-cliente');
          const inp = container.querySelector('#inp-cli-nome');
          if (inp) inp.focus();
          return;
        }

        if (orderData.customerType === 'PJ' && (!orderData.customerCompany || !orderData.customerCompany.trim())) {
          showToast('Por favor, informe a Empresa / Razão Social na Divisória 1.', '⚠️');
          switchDivisoria('section-cliente');
          const inp = container.querySelector('#inp-cli-empresa');
          if (inp) inp.focus();
          return;
        }

        if (orderData.items.length === 0) {
          showToast('Adicione pelo menos um produto ao pedido na Divisória 2.', '⚠️');
          switchDivisoria('section-produto');
          return;
        }
        
        try {
          const totalPaid = Number(orderData.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0).toFixed(2));
          const totalAmount = getCalculatedTotal();
          const remainingAmount = Math.max(0, Number((totalAmount - totalPaid).toFixed(2)));
          const primaryMethod = orderData.payments.length > 0 ? orderData.payments[0].method : 'PIX';

          if (isEditing) {
            const updated = updateOrder(editingOrder.id, {
              orderDate: orderData.orderDate,
              customerType: orderData.customerType,
              customer: orderData.customer,
              customerCompany: orderData.customerCompany,
              customerPhone: orderData.customerPhone,
              customerBirthDate: orderData.customerBirthDate,
              customerCPF: orderData.customerCPF,
              customerCNPJ: orderData.customerCNPJ,
              
              deliveryCep: orderData.deliveryCep,
              deliveryAddress: orderData.deliveryAddress,
              deliveryNumber: orderData.deliveryNumber,
              deliveryNeighborhood: orderData.deliveryNeighborhood,
              deliveryCity: orderData.deliveryCity,
              deliveryState: orderData.deliveryState,
              deliveryNotes: orderData.deliveryNotes,
              
              eventDate: orderData.eventDate,
              deliveryDate: orderData.limitDate,
              limitDate: orderData.limitDate,

              items: orderData.items,
              qty: orderData.items.reduce((sum, it) => sum + (Number(it.qty) || 1), 0),
              
              notes: orderData.notes,
              
              payments: orderData.payments,
              paidAmount: totalPaid,
              remainingAmount,
              discount: orderData.discount,
              financial: {
                totalAmount,
                paidAmount: totalPaid,
                remainingAmount,
                discount: orderData.discount,
                payments: orderData.payments
              },
              
              paymentMethod: primaryMethod
            });

            showToast(`Pedido ${formatOrderNumber(updated.number || updated.id)} atualizado com sucesso!`, '✅');
            switchView('pedidos');
            return;
          }

          const newOrder = createOrder({
            orderDate: orderData.orderDate || new Date().toISOString().split('T')[0],
            customerType: orderData.customerType,
            customer: orderData.customer,
            customerCompany: orderData.customerCompany,
            customerPhone: orderData.customerPhone,
            customerBirthDate: orderData.customerBirthDate,
            customerCPF: orderData.customerCPF,
            customerCNPJ: orderData.customerCNPJ,
            
            deliveryCep: orderData.deliveryCep,
            deliveryAddress: orderData.deliveryAddress,
            deliveryNumber: orderData.deliveryNumber,
            deliveryNeighborhood: orderData.deliveryNeighborhood,
            deliveryCity: orderData.deliveryCity,
            deliveryState: orderData.deliveryState,
            deliveryNotes: orderData.deliveryNotes,
            
            eventDate: orderData.eventDate,
            limitDate: orderData.limitDate,

            items: orderData.items,
            
            notes: orderData.notes,
            
            payments: orderData.payments,
            paidAmount: totalPaid,
            remainingAmount,
            financial: {
              totalAmount,
              paidAmount: totalPaid,
              remainingAmount,
              discount: orderData.discount,
              payments: orderData.payments
            },
            
            paymentMethod: primaryMethod
          });
          
          showToast(`Pedido ${newOrder.number} cadastrado com sucesso!`);
          switchView('pedidos');
        } catch (err) {
          showToast(err.message, '🔴');
        }
      });
    }

    const btnCancel = document.getElementById('btn-cancel-order');
    if (btnCancel) {
      btnCancel.addEventListener('click', () => switchView('pedidos'));
    }

    const btnBack = container.querySelector('#btn-back-to-orders');
    if (btnBack) {
      btnBack.addEventListener('click', () => switchView('pedidos'));
    }
  }

  // Initial render
  render();
}
export function showOrderConsultationDrawer(orderId, ctx) {
  const { openDrawer, closeDrawer, showToast, switchView } = ctx;
  const order = getOrderById(orderId);
  if (!order) {
    showToast('Pedido não encontrado', '⚠');
    return;
  }

  const neon = getOrderStatusNeonMeta(order);
  const fin = getOrderFinancials(order);
  const orderNum = formatOrderNumber(order.number || order.id);

  const items = (Array.isArray(order.items) && order.items.length > 0) ? order.items : [{
    productTitle: order.productTitle || order.title || 'Item',
    qty: order.qty || 1,
    unitPrice: order.unitPrice || (order.productSnapshot?.price) || 0,
    personalization: order.personalization || {},
    changeOptions: order.changeOptions || {},
    productSnapshot: order.productSnapshot || {},
    notes: order.notes || ''
  }];

  const contentHtml = `
    <!-- Top Summary Badge Bar -->
    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 14px 18px; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
      <div>
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span style="font-family: monospace; font-size: 16px; font-weight: 700; color: var(--accent-primary);">
            ${orderNum}
          </span>
          <span class="status-pill" style="border-left: 4px solid ${neon.color}; font-size: 12px; padding: 4px 10px;">
            ${escapeHtml(neon.label)}
          </span>
          <div style="display: inline-flex; align-items: center; gap: 6px;">
            <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">Alterar Status:</label>
            <select class="form-input" id="drawer-inp-order-status" style="height: 28px; padding: 2px 8px; font-size: 11px; font-weight: 700;">
              <option value="yellow" ${order.status === 'yellow' || order.status === 'aguardando' ? 'selected' : ''}>Aguardando Aprovação</option>
              <option value="em_personalizacao" ${order.status === 'em_personalizacao' ? 'selected' : ''}>Em Personalização</option>
              <option value="aguardando_impressao" ${order.status === 'aguardando_impressao' ? 'selected' : ''}>Aguardando Impressão</option>
              <option value="blue" ${order.status === 'blue' || order.status === 'producao' ? 'selected' : ''}>Em Produção</option>
              <option value="orange" ${order.status === 'orange' || order.status === 'em_conferencia' ? 'selected' : ''}>Em Conferência</option>
              <option value="red" ${order.status === 'red' || order.status === 'bloqueado' ? 'selected' : ''}>Bloqueado</option>
              <option value="green" ${order.status === 'green' || order.status === 'pronto' ? 'selected' : ''}>Pronto</option>
              <option value="neutral" ${order.status === 'neutral' || order.status === 'entregue' ? 'selected' : ''}>Entregue / Concluído</option>
              <option value="cancelado" ${order.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
            </select>
          </div>
        </div>
        <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-top: 6px;">
          ${escapeHtml(order.title || order.productTitle || 'Vários Itens')}
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11px; color: var(--text-secondary);">Data do Pedido: <b>${order.orderDate || '--/--/----'}</b></div>
        <div style="font-size: 12px; color: var(--text-primary); margin-top: 2px;">
          Entrega Prevista: <b style="color: #0284c7;">${order.deliveryDate || order.limitDate || '--/--/----'}</b>
        </div>
        ${order.eventDate ? `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Data do Evento: <b>${order.eventDate}</b></div>` : ''}
      </div>
    </div>

    <!-- 2-Column Grid: Dados do Cliente & Condições Financeiras -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
      
      <!-- Dados do Cliente -->
      <div class="drawer-detail-section" style="margin: 0; padding: 14px; background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 10px;">
        <h4 class="drawer-subtitle" style="margin-top: 0; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
          👤 Dados do Cliente / Entrega
        </h4>
        <div class="detail-grid" style="display: flex; flex-direction: column; gap: 8px;">
          <div class="detail-item">
            <span class="detail-label" style="font-size: 11px; color: var(--text-secondary);">Tipo / Nome:</span>
            <span class="detail-val" style="font-size: 13px; font-weight: 600;">
              ${order.customerType === 'PJ' ? `[PJ] ${escapeHtml(order.customerCompany || order.customer || '—')}` : `[PF] ${escapeHtml(order.customer || '—')}`}
            </span>
          </div>
          ${order.customerPhone ? `
            <div class="detail-item">
              <span class="detail-label" style="font-size: 11px; color: var(--text-secondary);">WhatsApp / Contato:</span>
              <span class="detail-val" style="font-weight: 600; color: #0284c7;">${escapeHtml(formatPhone(order.customerPhone))}</span>
            </div>
          ` : ''}
          ${order.customerCPF || order.customerCNPJ ? `
            <div class="detail-item">
              <span class="detail-label" style="font-size: 11px; color: var(--text-secondary);">Documento:</span>
              <span class="detail-val">${escapeHtml(order.customerCPF ? formatCPF(order.customerCPF) : formatCNPJ(order.customerCNPJ))}</span>
            </div>
          ` : ''}
          ${order.customerBirthDate ? `
            <div class="detail-item">
              <span class="detail-label" style="font-size: 11px; color: var(--text-secondary);">Nascimento:</span>
              <span class="detail-val">${escapeHtml(order.customerBirthDate)}</span>
            </div>
          ` : ''}
          <div class="detail-item">
            <span class="detail-label" style="font-size: 11px; color: var(--text-secondary);">Endereço Entrega:</span>
            <span class="detail-val">
              ${escapeHtml([order.deliveryAddress, order.deliveryNumber, order.deliveryNeighborhood, order.deliveryCity, order.deliveryState].filter(Boolean).join(', ') || 'Retirada no balcão / Não informado')}
              ${order.deliveryCep ? ` (CEP: ${escapeHtml(order.deliveryCep)})` : ''}
            </span>
          </div>
          ${order.deliveryNotes ? `
            <div class="detail-item">
              <span class="detail-label" style="font-size: 11px; color: var(--text-secondary);">Obs. Entrega:</span>
              <span class="detail-val" style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(order.deliveryNotes)}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Resumo Financeiro -->
      <div class="drawer-detail-section" style="margin: 0; padding: 14px; background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 10px;">
        <h4 class="drawer-subtitle" style="margin-top: 0; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
          💳 Resumo Financeiro
        </h4>
        <div class="detail-grid" style="display: flex; flex-direction: column; gap: 8px;">
          <div class="detail-item" style="display: flex; justify-content: space-between;">
            <span class="detail-label" style="font-size: 11px; color: var(--text-secondary);">Valor Total:</span>
            <span class="detail-val" style="font-size: 14px; font-weight: 700;">R$ ${fin.totalAmount.toFixed(2)}</span>
          </div>
          <div class="detail-item" style="display: flex; justify-content: space-between;">
            <span class="detail-label" style="font-size: 11px; color: var(--text-secondary);">Valor Pago / Entrada:</span>
            <span class="detail-val" style="color: #16a34a; font-weight: 600;">R$ ${fin.paidAmount.toFixed(2)}</span>
          </div>
          <div class="detail-item" style="display: flex; justify-content: space-between;">
            <span class="detail-label" style="font-size: 11px; color: var(--text-secondary);">Restante a Pagar:</span>
            <span class="detail-val" style="color: ${fin.remainingAmount > 0 ? '#ea580c' : '#16a34a'}; font-weight: 700;">
              R$ ${fin.remainingAmount.toFixed(2)}
            </span>
          </div>
          <div class="detail-item" style="display: flex; justify-content: space-between;">
            <span class="detail-label" style="font-size: 11px; color: var(--text-secondary);">Forma de Pagamento:</span>
            <span class="detail-val">${escapeHtml(fin.paymentMethod || (order.financial?.paymentMethods?.[0]?.method || '—'))}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Histórico de Pagamentos no Pedido (Consultation Drawer) -->
    <div class="drawer-detail-section" style="margin-bottom: 16px; padding: 14px; background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 10px;" id="drawer-payment-history-box">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h4 class="drawer-subtitle" style="margin: 0; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--text-primary);">
          💳 Histórico de Pagamentos do Pedido
        </h4>
        <span style="font-size: 11px; font-weight: 700; color: ${fin.remainingAmount > 0 ? '#dc2626' : '#16a34a'};">
          ${fin.remainingAmount > 0 ? `Restante: R$ ${fin.remainingAmount.toFixed(2)}` : '✅ Totalmente Quitado'}
        </span>
      </div>

      <!-- Inserção de Novo Pagamento: TIPO DE PAGAMENTO (SELECT) | R$ [INPUT] | + -->
      <div style="display: grid; grid-template-columns: 1fr 130px auto; gap: 8px; align-items: end; background: #f8fafc; padding: 10px 12px; border: 1px solid var(--border-subtle); border-radius: 8px; margin-bottom: 12px;">
        <div>
          <label style="display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 4px;">Tipo de Pagamento</label>
          <select class="form-input" id="drawer-inp-pay-method" style="height: 34px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
            <option value="DINHEIRO">DINHEIRO</option>
            <option value="PIX" selected>PIX</option>
            <option value="CRÉDITO">CRÉDITO</option>
            <option value="DÉBITO">DÉBITO</option>
            <option value="PERMUTA">PERMUTA</option>
            <option value="BOLETO">BOLETO</option>
            <option value="TRANSFERÊNCIA">TRANSFERÊNCIA</option>
          </select>
        </div>
        <div>
          <label style="display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 4px;">R$ Valor</label>
          <input type="number" step="0.01" min="0.01" class="form-input" id="drawer-inp-pay-amount" placeholder="0,00" value="${fin.remainingAmount > 0 ? fin.remainingAmount.toFixed(2) : ''}" style="height: 34px; font-size: 13px; font-weight: 700; text-align: right;">
        </div>
        <div>
          <button type="button" class="btn btn-primary" id="drawer-btn-add-pay" style="height: 34px; padding: 0 14px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 4px;" title="Adicionar Pagamento ao Histórico">
            <span style="font-size: 16px; line-height: 1;">+</span>
          </button>
        </div>
      </div>

      <!-- Tabela do Histórico de Pagamentos -->
      <div style="border: 1px solid var(--border-subtle); border-radius: 8px; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 1px solid var(--border-subtle); text-align: left;">
              <th style="padding: 8px 12px; font-size: 10px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Tipo de Pagamento</th>
              <th style="padding: 8px 12px; font-size: 10px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; text-align: right;">Valor</th>
              <th style="padding: 8px 12px; font-size: 10px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; text-align: center;">Data / Hora</th>
              <th style="padding: 8px 12px; font-size: 10px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; text-align: center; width: 36px;"></th>
            </tr>
          </thead>
          <tbody>
            ${(!fin.payments || fin.payments.length === 0) ? `
              <tr>
                <td colspan="4" style="padding: 14px; text-align: center; color: var(--text-secondary); font-size: 12px;">
                  Nenhum pagamento registrado ainda. Selecione o tipo de pagamento, digite o valor e clique em <b>+</b>.
                </td>
              </tr>
            ` : fin.payments.map((p) => `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 9px 12px; font-weight: 700; color: var(--text-primary); text-transform: uppercase;">
                  ${escapeHtml(p.method)}
                </td>
                <td style="padding: 9px 12px; text-align: right; font-weight: 700; color: #16a34a; font-variant-numeric: tabular-nums;">
                  R$ ${Number(p.amount).toFixed(2)}
                </td>
                <td style="padding: 9px 12px; text-align: center; color: var(--text-secondary); font-size: 11px; font-variant-numeric: tabular-nums;">
                  ${escapeHtml(p.datetime || (p.date + (p.time ? ` às ${p.time}` : '')))}
                </td>
                <td style="padding: 9px 12px; text-align: center;">
                  <button type="button" class="drawer-btn-remove-pay" data-pay-id="${escapeHtml(p.id)}" style="background: none; border: none; cursor: pointer; color: #dc2626; font-size: 13px; padding: 2px 4px; border-radius: 4px;" title="Remover lançamento">
                    ✖
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Lista de Itens e Personalização -->
    <div style="margin-bottom: 16px;">
      <h4 class="drawer-subtitle" style="margin-top: 0; margin-bottom: 10px;">🛒 Itens e Personalização</h4>
      ${items.map(item => {
        const snap = item.productSnapshot || {};
        const pFields = snap.personalizationFields || [];
        const cOpts = snap.changeOptions || [];
        const pValues = item.personalization || {};
        const cValues = item.changeOptions || {};
        
        let customHtml = '';
        if (pFields.length > 0) {
          customHtml += '<div style="margin-top: 8px;"><div style="font-size: 11px; font-weight: 700; color: var(--text-secondary);">Campos:</div>';
          customHtml += pFields.map(f => `<div style="font-size: 12px; margin-left: 8px;"><span style="color: var(--text-secondary);">${escapeHtml(f.name)}:</span> <b>${escapeHtml(pValues[f.id] || '—')}</b></div>`).join('');
          customHtml += '</div>';
        }
        if (cOpts.length > 0) {
          customHtml += '<div style="margin-top: 8px;"><div style="font-size: 11px; font-weight: 700; color: var(--text-secondary);">Opções:</div>';
          customHtml += cOpts.map(o => `<div style="font-size: 12px; margin-left: 8px;"><span style="color: var(--text-secondary);">${escapeHtml(o.name)}:</span> <b>${escapeHtml(cValues[o.id] || '—')}</b></div>`).join('');
          customHtml += '</div>';
        }

        return `
          <div style="background: #fff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 13px; margin-bottom: 4px;">
              <span>${item.qty}x ${escapeHtml(item.productTitle)}</span>
              <span>R$ ${(Number(item.unitPrice || 0) * item.qty).toFixed(2)}</span>
            </div>
            ${customHtml}
            ${item.notes ? `<div style="margin-top: 8px; font-size: 12px;"><span style="color: var(--text-secondary);">Obs:</span> ${escapeHtml(item.notes)}</div>` : ''}
          </div>
        `;
      }).join('')}
    </div>

    <!-- Notas Internas -->
    ${order.notes ? `
      <div class="drawer-detail-section" style="margin: 0; padding: 14px; background: #fffcf8; border: 1px dashed #fcd34d; border-radius: 10px; margin-bottom: 16px;">
        <h4 class="drawer-subtitle" style="margin-top: 0; margin-bottom: 6px; color: #b45309;">📝 Observações Internas (Pedido)</h4>
        <div style="font-size: 13px; color: #92400e; white-space: pre-wrap;">${escapeHtml(order.notes)}</div>
      </div>
    ` : ''}
  `;

  openDrawer({
    title: `Consulta de Pedido ${orderNum}`,
    contentHtml,
    footerHtml: `
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; flex-wrap: wrap; gap: 8px;">
        <span style="font-size: 12px; color: var(--text-secondary);">ID do Pedido: <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${escapeHtml(order.id)}</code></span>
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary" id="drawer-btn-share-art" style="padding: 8px 14px; font-weight: 700; color: #2563eb; background: #eff6ff; border-color: #bfdbfe; display: inline-flex; align-items: center; gap: 4px;">
            🔗 Compartilhar Arte
          </button>
          <button type="button" class="btn btn-secondary" id="drawer-btn-dup-order" style="padding: 8px 14px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
            📋 Duplicar
          </button>
          <button type="button" class="btn btn-secondary" id="drawer-btn-edit-order" style="padding: 8px 14px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
            ✏️ Editar Pedido
          </button>
          <button type="button" class="btn btn-secondary" id="drawer-btn-del-order" style="padding: 8px 14px; font-weight: 600; color: #dc2626; border-color: #fca5a5; display: inline-flex; align-items: center; gap: 4px;">
            🗑️ Excluir
          </button>
          <button type="button" class="btn btn-secondary" id="btn-close-consultation-drawer" style="padding: 8px 18px; font-weight: 600;">Fechar</button>
        </div>
      </div>
    `,
    className: 'drawer-large',
    onMount: (drawer) => {
      const closeBtn = drawer.querySelector('#btn-close-consultation-drawer');
      if (closeBtn) closeBtn.onclick = closeDrawer;

      // Dynamic Order Status Change
      const selStatus = drawer.querySelector('#drawer-inp-order-status');
      if (selStatus) {
        selStatus.addEventListener('change', (e) => {
          const newStatus = e.target.value;
          try {
            updateOrder(order.id, { status: newStatus });
            showToast(`Status do Pedido ${orderNum} atualizado!`, '✅');
            showOrderConsultationDrawer(order.id, ctx);
            if (typeof ctx.renderOrdersView === 'function') {
              ctx.renderOrdersView();
            }
          } catch (err) {
            showToast(err.message, '🔴');
          }
        });
      }

      const shareBtn = drawer.querySelector('#drawer-btn-share-art');
      if (shareBtn) {
        shareBtn.addEventListener('click', () => {
          closeDrawer();
          const shareUrl = `${window.location.origin}${window.location.pathname}#/aprovar-arte/${order.id}`;
          navigator.clipboard?.writeText(shareUrl);
          showToast(`Link de aprovação copiado: ${shareUrl}`, '🔗');
          if (typeof ctx.switchView === 'function') {
            ctx.switchView('aprovar-arte', order.id);
          }
        });
      }

      const dupBtn = drawer.querySelector('#drawer-btn-dup-order');
      if (dupBtn) {
        dupBtn.addEventListener('click', () => {
          try {
            const duplicated = duplicateOrder(order.id);
            closeDrawer();
            showToast(`Pedido ${duplicated.number} duplicado com sucesso!`, '📋');
            if (typeof ctx.switchView === 'function') {
              ctx.switchView('pedidos');
            } else if (typeof ctx.renderOrdersView === 'function') {
              ctx.renderOrdersView();
            }
          } catch (err) {
            showToast(err.message, '🔴');
          }
        });
      }

      const editBtn = drawer.querySelector('#drawer-btn-edit-order');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          closeDrawer();
          openEditOrderDrawer(order.id, ctx);
        });
      }

      const delBtn = drawer.querySelector('#drawer-btn-del-order');
      if (delBtn) {
        delBtn.addEventListener('click', () => {
          showConfirmDialog({
            title: 'Excluir Pedido',
            message: `Tem certeza que deseja excluir o <b>Pedido ${orderNum}</b>?<br><br>Esta ação é irreversível e removerá o pedido e todo o seu histórico.`,
            confirmText: 'Sim, Excluir Pedido',
            isDanger: true,
            onConfirm: () => {
              try {
                deleteOrder(order.id);
                closeDrawer();
                showToast(`Pedido ${orderNum} excluído com sucesso!`, '✅');
                if (typeof ctx.renderOrdersView === 'function') {
                  ctx.renderOrdersView();
                } else if (typeof ctx.switchView === 'function') {
                  ctx.switchView('pedidos');
                }
              } catch (err) {
                showToast(err.message, '⚠');
              }
            }
          });
        });
      }

      // Add payment from consultation drawer
      const btnAddPay = drawer.querySelector('#drawer-btn-add-pay');
      if (btnAddPay) {
        btnAddPay.addEventListener('click', () => {
          const selMethod = drawer.querySelector('#drawer-inp-pay-method');
          const inpAmt = drawer.querySelector('#drawer-inp-pay-amount');
          const amt = Number(inpAmt?.value);

          if (isNaN(amt) || amt <= 0) {
            showToast('Informe um valor de pagamento válido maior que zero.', '⚠️');
            if (inpAmt) inpAmt.focus();
            return;
          }

          const method = (selMethod?.value || 'PIX').trim().toUpperCase();
          try {
            addOrderPayment(order.id, { method, amount: amt });
            showToast(`Pagamento de R$ ${amt.toFixed(2)} (${method}) registrado no histórico!`, '✅');
            showOrderConsultationDrawer(order.id, ctx);
          } catch (err) {
            showToast(err.message, '🔴');
          }
        });
      }

      // Remove payment from consultation drawer
      drawer.querySelectorAll('.drawer-btn-remove-pay').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const payId = e.currentTarget.dataset.payId;
          if (!payId) return;
          try {
            removeOrderPayment(order.id, payId);
            showToast('Lançamento de pagamento removido do histórico.', 'ℹ️');
            showOrderConsultationDrawer(order.id, ctx);
          } catch (err) {
            showToast(err.message, '🔴');
          }
        });
      });
    }
  });
}

export function openEditOrderDrawer(orderId, ctx) {
  if (ctx && typeof ctx.switchView === 'function') {
    ctx.switchView('pedidos-editar', orderId);
  } else {
    const container = document.getElementById('view-container');
    if (container) {
      renderNewOrderPage(container, ctx, orderId);
    }
  }
}
