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
  exportOrdersCSV,
  exportOrdersCSVTemplate,
  ORDER_STATUS_MAP,
  isOrderActive
} from './orders.js';
import { loadProducts, loadMaterials, loadComponents } from '../../data/storage.js';
import { getProductById } from '../products/products.js';
import { fileStorage } from '../../data/filestorage.js';
import { formatDateBR, parseDateBRToISO, escapeHtml } from '../../utils/sanitize.js';
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
  const totalAmount = Number(order.totalAmount !== undefined ? order.totalAmount : (unitPrice * qty));
  const paidAmount = Number(order.paidAmount || 0);
  const remainingAmount = Number(order.remainingAmount !== undefined ? order.remainingAmount : Math.max(0, totalAmount - paidAmount));

  return {
    unitPrice,
    totalAmount,
    paidAmount,
    remainingAmount,
    paymentMethod: order.paymentMethod || 'PIX',
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

    <!-- Orders Filter Select (Substitui as abas em formato Select conforme solicitado) -->
    <div class="orders-filter-row" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 280px; max-width: 460px;">
        <label for="select-orders-tab" style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); white-space: nowrap; display: inline-flex; align-items: center; gap: 5px;">
          <span>🎯</span> Filtrar Status / Etapa:
        </label>
        <select class="form-select" id="select-orders-tab" style="flex: 1; height: 38px; font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 8px; border: 1.5px solid var(--border-strong); background-color: #ffffff; color: var(--text-primary); cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
          <option value="em_andamento" ${currentOrdersTab === 'em_andamento' ? 'selected' : ''}>⚡ Em Andamento (Ativos)</option>
          <option value="todos" ${currentOrdersTab === 'todos' ? 'selected' : ''}>📋 Todos os Pedidos</option>
          <option value="aguardando" ${currentOrdersTab === 'aguardando' ? 'selected' : ''}>🟡 Aguardando Aprovação</option>
          <option value="producao" ${currentOrdersTab === 'producao' ? 'selected' : ''}>🔵 Em Produção Geral</option>
          <option value="impressao" ${currentOrdersTab === 'impressao' ? 'selected' : ''}>🟢 Fila de Impressão</option>
          <option value="corte" ${currentOrdersTab === 'corte' ? 'selected' : ''}>🟣 Corte</option>
          <option value="vinco" ${currentOrdersTab === 'vinco' ? 'selected' : ''}>🟣 Vinco</option>
          <option value="montagem" ${currentOrdersTab === 'montagem' ? 'selected' : ''}>🔵 Montagem</option>
          <option value="acabamento" ${currentOrdersTab === 'acabamento' ? 'selected' : ''}>🔵 Acabamento</option>
          <option value="conferencia" ${currentOrdersTab === 'conferencia' ? 'selected' : ''}>🟡 CQ / Conferência</option>
          <option value="embalagem" ${currentOrdersTab === 'embalagem' ? 'selected' : ''}>📦 Embalagem</option>
          <option value="prontos" ${currentOrdersTab === 'prontos' ? 'selected' : ''}>✓ Prontos p/ Retirada</option>
          <option value="bloqueados" ${currentOrdersTab === 'bloqueados' ? 'selected' : ''}>🟠 Bloqueados</option>
          <option value="entregues" ${currentOrdersTab === 'entregues' ? 'selected' : ''}>🚚 Entregues</option>
          <option value="cancelados" ${currentOrdersTab === 'cancelados' ? 'selected' : ''}>❌ Cancelados</option>
        </select>
      </div>
    </div>

    <!-- Search & Filters (Bloco 03) -->
    <div class="filter-bar" style="display: flex; gap: 12px; align-items: center; margin-bottom: 14px;">
      <div class="search-wrapper" style="flex: 1; position: relative;">
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
  // Select Tab
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
      // Don't trigger if clicked on kebab menu or button
      if (e.target.closest('.dropdown-kebab-wrapper') || e.target.closest('button')) return;
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
      if (confirm(`Tem certeza que deseja excluir o pedido ${formatOrderNumber(id)}?`)) {
        try {
          deleteOrder(id);
          showToast('Pedido excluído com sucesso');
          renderOrdersView(container, ctx);
        } catch (err) {
          showToast(err.message, '⚠');
        }
      }
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
        alert('Arquivo não encontrado no armazenamento.');
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
                  #${orderNum}
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
                ${order.qty} <span style="font-size: 11px; font-weight: 500; color: var(--text-secondary);">un</span>
              </span>
            </div>

            <!-- Actions: Three-Dots (⋮) Kebab Dropdown Menu -->
            <div class="dropdown-kebab-wrapper" style="position: relative;">
              <button class="action-btn-kebab" title="Opções do Pedido" aria-label="Ações do pedido">
                ⋮
              </button>
              <div class="dropdown-kebab-menu">
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
                  <b>#${orderNum}</b>
                  <div style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(order.customer || 'Cliente')}</div>
                </td>
                <td style="padding: 10px 14px;">${escapeHtml(order.productTitle || 'Item')}</td>
                <td style="padding: 10px 14px;"><b>${order.qty}</b> un</td>
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
export function renderNewOrderPage(container, ctx) {
  if (!container) return;
  const { switchView, showToast, openDrawer, closeDrawer } = ctx;

  const products = loadProducts().filter(p => p.status === 'ativo');
  const allMaterials = loadMaterials();
  const allComponents = loadComponents();

  // Local state
  let orderData = {
    customerType: 'PF', // PF | PJ
    customer: '',
    customerPhone: '',
    customerBirthDate: '',
    customerCPF: '',
    customerCNPJ: '',
    customerCompany: '',
    
    deliveryCep: '',
    deliveryAddress: '',
    deliveryNumber: '',
    deliveryNeighborhood: '',
    deliveryCity: '',
    deliveryState: '',
    deliveryNotes: '',

    eventDate: '',
    limitDate: '',

    items: [],
    
    discount: 0,
    paymentMethods: [{ method: 'PIX', amount: 0 }],
    
    notes: ''
  };

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
        
        const totalQty = (comp.quantity || 1) * item.qty;
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
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Auto calculate limit date (3 days before event)
    let autoLimitDate = '';
    if (orderData.eventDate) {
      const d = new Date(orderData.eventDate + 'T12:00:00');
      d.setDate(d.getDate() - 3);
      autoLimitDate = d.toISOString().split('T')[0];
      orderData.limitDate = autoLimitDate;
    }

    const html = `
      <div style="max-width: 100%; margin: 0 auto; padding-bottom: 32px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">📝 Novo Pedido</h2>
            <div style="font-size: 0.875rem; color: var(--text-secondary);">Cadastre um novo pedido com múltiplos produtos e personalizações</div>
          </div>
          <button class="btn btn-secondary" id="btn-cancel-order">Voltar</button>
        </div>

        <form id="form-new-order-page" style="display: flex; flex-direction: column; gap: 0;">
          <div class="binder-tabs" id="new-order-tabs">
            <button type="button" class="binder-tab active" data-target="section-cliente">1. Dados do Cliente & Entrega</button>
            <button type="button" class="binder-tab" data-target="section-produto">2. Produtos & Personalização</button>
            <button type="button" class="binder-tab" data-target="section-insumos">3. Ficha Técnica</button>
            <button type="button" class="binder-tab" data-target="section-financeiro">4. Financeiro & Conclusão</button>
          </div>

          <!-- TAB 1: CLIENTE E ENTREGA -->
          <div class="binder-panel active" id="section-cliente" style="margin-top: 0;">
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
                    <input class="form-input" id="inp-cli-nome" required value="${orderData.customer}">
                  </div>
                  <div>
                    <label class="form-label">Contato (WhatsApp)</label>
                    <input class="form-input" id="inp-cli-contato" value="${orderData.customerPhone}">
                  </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                  <div>
                    <label class="form-label">Data de Nascimento</label>
                    <input type="date" class="form-input" id="inp-cli-nasc" value="${orderData.customerBirthDate}">
                  </div>
                  <div>
                    <label class="form-label">CPF</label>
                    <input class="form-input" id="inp-cli-cpf" value="${orderData.customerCPF}">
                  </div>
                </div>
              ` : `
                <!-- PJ Fields -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                  <div>
                    <label class="form-label">Empresa *</label>
                    <input class="form-input" id="inp-cli-empresa" required value="${orderData.customerCompany}">
                  </div>
                  <div>
                    <label class="form-label">Contato (WhatsApp)</label>
                    <input class="form-input" id="inp-cli-contato" value="${orderData.customerPhone}">
                  </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                  <div>
                    <label class="form-label">CNPJ</label>
                    <input class="form-input" id="inp-cli-cnpj" value="${orderData.customerCNPJ}">
                  </div>
                  <div></div>
                </div>
              `}

              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px; background: var(--bg-surface-raised); padding: 10px; border-radius: 8px;">
                <div>
                  <label class="form-label">Data do Pedido</label>
                  <input type="date" class="form-input" value="${todayStr}" disabled style="background: #e5e7eb; cursor: not-allowed;">
                </div>
                <div>
                  <label class="form-label">Data do Evento</label>
                  <input type="date" class="form-input" id="inp-cli-evento" value="${orderData.eventDate}">
                </div>
                <div>
                  <label class="form-label">Data Limite (Auto: -3 dias)</label>
                  <input type="date" class="form-input" value="${orderData.limitDate}" disabled style="background: #e5e7eb; cursor: not-allowed;">
                </div>
              </div>

              <div>
                <label class="form-label">Observações Internas (Cliente)</label>
                <textarea class="form-input" id="inp-cli-obs" rows="2">${orderData.notes}</textarea>
              </div>
            </div>

            <div class="panel" style="margin-top: 16px;">
              <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 14px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">🚚 Entrega</h3>
              
              <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px; margin-bottom: 12px;">
                <div>
                  <label class="form-label">CEP</label>
                  <div style="display: flex; gap: 6px;">
                    <input class="form-input" id="inp-ent-cep" value="${orderData.deliveryCep}" placeholder="00000-000">
                    <button type="button" class="btn btn-secondary" id="btn-busca-cep" style="padding: 0 10px;">🔍</button>
                  </div>
                </div>
                <div>
                  <label class="form-label">Endereço</label>
                  <input class="form-input" id="inp-ent-endereco" value="${orderData.deliveryAddress}">
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 12px; margin-bottom: 12px;">
                <div>
                  <label class="form-label">Número</label>
                  <input class="form-input" id="inp-ent-numero" value="${orderData.deliveryNumber}">
                </div>
                <div>
                  <label class="form-label">Bairro</label>
                  <input class="form-input" id="inp-ent-bairro" value="${orderData.deliveryNeighborhood}">
                </div>
                <div>
                  <label class="form-label">Cidade / Estado</label>
                  <div style="display: flex; gap: 6px;">
                    <input class="form-input" id="inp-ent-cidade" value="${orderData.deliveryCity}" style="flex: 2;">
                    <input class="form-input" id="inp-ent-estado" value="${orderData.deliveryState}" style="flex: 1;" placeholder="UF">
                  </div>
                </div>
              </div>
              
              <div>
                <label class="form-label">Observações de Entrega</label>
                <textarea class="form-input" id="inp-ent-obs" rows="2">${orderData.deliveryNotes}</textarea>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
              <button type="button" class="btn btn-primary btn-next-tab" data-next="section-produto">Próximo Passo ➔</button>
            </div>
          </div>

          <!-- TAB 2: PRODUTOS E PERSONALIZAÇÃO -->
          <div class="binder-panel" id="section-produto" style="margin-top: 0; display: none;">
            <div class="panel" style="background: var(--bg-surface-raised);">
              <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 14px;">🛍️ Adicionar Produto</h3>
              <div style="display: grid; grid-template-columns: 3fr 1fr auto; gap: 12px; align-items: end;">
                <div>
                  <label class="form-label">Seleção do Produto</label>
                  <select class="form-input" id="inp-prod-select">
                    ${products.map(p => `<option value="${p.id}">${p.name} - R$ ${Number(p.price || 0).toFixed(2)}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label class="form-label">Quantidade</label>
                  <input type="number" class="form-input" id="inp-prod-qty" value="1" min="1">
                </div>
                <button type="button" class="btn btn-primary" id="btn-add-product" style="margin-bottom: 2px;">+ Inserir</button>
              </div>
            </div>

            <div class="panel" style="margin-top: 16px;">
              <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 14px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">🛒 Listagem de Produtos & Personalização</h3>
              
              <div id="order-items-list" style="display: flex; flex-direction: column; gap: 16px;">
                ${orderData.items.length === 0 ? 
                  '<div style="text-align: center; padding: 24px; color: var(--text-secondary); font-size: 14px;">Nenhum produto adicionado ainda.</div>' 
                  : orderData.items.map((item, index) => {
                    
                    // Render personalizations fields based on productSnapshot
                    const prod = item.productSnapshot;
                    let persHtml = '';
                    
                    if (Array.isArray(prod.personalizationFields) && prod.personalizationFields.length > 0) {
                      persHtml += '<div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-subtle);">';
                      persHtml += '<div style="font-size: 11px; font-weight: 700; color: var(--accent-primary); margin-bottom: 8px; text-transform: uppercase;">Campos Dinâmicos de Personalização</div>';
                      persHtml += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">';
                      prod.personalizationFields.forEach(field => {
                        const val = item.personalization[field.id] || '';
                        const req = field.required ? ' *' : '';
                        persHtml += `
                          <div>
                            <label class="form-label" style="font-size: 11px;">${field.name}${req}</label>
                            ${field.type === 'longText' 
                              ? `<textarea class="form-input item-pers-field" data-index="${index}" data-field="${field.id}" rows="2" style="font-size: 12px;">${val}</textarea>`
                              : `<input class="form-input item-pers-field" data-index="${index}" data-field="${field.id}" value="${val}" style="font-size: 12px;">`
                            }
                          </div>
                        `;
                      });
                      persHtml += '</div></div>';
                    }

                    if (Array.isArray(prod.changeOptions) && prod.changeOptions.length > 0) {
                      persHtml += '<div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-subtle);">';
                      persHtml += '<div style="font-size: 11px; font-weight: 700; color: var(--accent-primary); margin-bottom: 8px; text-transform: uppercase;">Opções de Alteração</div>';
                      persHtml += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">';
                      prod.changeOptions.forEach(opt => {
                        const val = item.changeOptions[opt.id] || '';
                        const req = opt.required ? ' *' : '';
                        persHtml += `
                          <div>
                            <label class="form-label" style="font-size: 11px;">${opt.name}${req}</label>
                            <select class="form-input item-opt-field" data-index="${index}" data-field="${opt.id}" style="font-size: 12px;">
                              <option value="">Selecione...</option>
                              ${opt.options.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('')}
                            </select>
                          </div>
                        `;
                      });
                      persHtml += '</div></div>';
                    }

                    return `
                      <div style="border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px; background: #fff;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                          <div style="flex: 1;">
                            <div style="font-weight: 700; font-size: 14px;">${item.qty}x ${item.productTitle}</div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">Preço Un: R$ ${Number(item.unitPrice).toFixed(2)} | Subtotal: R$ ${Number(item.qty * item.unitPrice).toFixed(2)}</div>
                          </div>
                          <button type="button" class="btn btn-secondary btn-remove-item" data-index="${index}" style="padding: 4px 8px; font-size: 11px; color: #dc2626; border-color: #fca5a5;">Remover</button>
                        </div>
                        ${persHtml}
                        <div style="margin-top: 10px;">
                          <label class="form-label" style="font-size: 11px;">Observações Específicas do Item (Instruções de produção)</label>
                          <textarea class="form-input item-notes-field" data-index="${index}" rows="2" style="font-size: 12px;">${item.notes}</textarea>
                        </div>
                      </div>
                    `;
                  }).join('')
                }
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 16px;">
              <button type="button" class="btn btn-secondary btn-prev-tab" data-prev="section-cliente">⬅ Voltar</button>
              <button type="button" class="btn btn-primary btn-next-tab" data-next="section-insumos">Próximo Passo ➔</button>
            </div>
          </div>

          <!-- TAB 3: FICHA TÉCNICA E BOM SNAPSHOT -->
          <div class="binder-panel" id="section-insumos" style="margin-top: 0; display: none;">
            <div class="panel">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <h3 style="font-size: 1rem; font-weight: 700;">🧩 Insumos / Estoque (BOM Snapshot)</h3>
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

            <div style="display: flex; justify-content: space-between; margin-top: 16px;">
              <button type="button" class="btn btn-secondary btn-prev-tab" data-prev="section-produto">⬅ Voltar</button>
              <button type="button" class="btn btn-primary btn-next-tab" data-next="section-financeiro">Próximo Passo ➔</button>
            </div>
          </div>

          <!-- TAB 4: FINANCEIRO & NOTA FISCAL -->
          <div class="binder-panel" id="section-financeiro" style="margin-top: 0; display: none;">
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
                
                <!-- Campos Interativos (Não impressos na NF final visual, mas controlam o estado) -->
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; margin-bottom: 4px; padding: 4px 0;" class="no-print-interactive">
                  <span>Desconto (R$):</span>
                  <input type="number" step="0.01" min="0" class="form-input" id="inp-fin-discount" value="${orderData.discount}" style="width: 100px; text-align: right; padding: 4px 8px; font-size: 12px;">
                </div>
                
                <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; margin-top: 8px; color: var(--accent-primary);">
                  <span>VALOR TOTAL:</span>
                  <span>R$ ${getCalculatedTotal().toFixed(2)}</span>
                </div>
              </div>

              <!-- Pagamentos -->
              <div style="background: #f9fafb; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb;">
                <div style="font-weight: 700; margin-bottom: 8px; color: var(--text-primary); font-size: 12px; text-transform: uppercase;">Condições de Pagamento</div>
                
                <div id="payment-methods-list" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;" class="no-print-interactive">
                  ${orderData.paymentMethods.map((pm, idx) => `
                    <div style="display: flex; gap: 8px; align-items: center;">
                      <select class="form-input pay-method-select" data-index="${idx}" style="flex: 1; padding: 4px 8px; font-size: 12px;">
                        ${['Dinheiro', 'PIX', 'Crédito', 'Débito', 'Permuta'].map(m => `<option value="${m}" ${pm.method === m ? 'selected' : ''}>${m}</option>`).join('')}
                      </select>
                      <input type="number" step="0.01" min="0" class="form-input pay-method-amount" data-index="${idx}" value="${pm.amount}" style="width: 100px; text-align: right; padding: 4px 8px; font-size: 12px;" placeholder="Valor R$">
                      <button type="button" class="btn btn-secondary btn-remove-pay" data-index="${idx}" style="padding: 4px; color: #dc2626;">✖</button>
                    </div>
                  `).join('')}
                </div>
                <button type="button" class="btn btn-secondary no-print-interactive" id="btn-add-pay" style="font-size: 11px; padding: 4px 8px; margin-bottom: 12px;">+ Adicionar Forma de Pagamento (Ex: Permuta + PIX)</button>

                ${(() => {
                  const totalPaid = orderData.paymentMethods.reduce((sum, p) => sum + Number(p.amount), 0);
                  const total = getCalculatedTotal();
                  const remaining = Math.max(0, total - totalPaid);
                  return `
                    <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                      <span>Valor Entrada/Pago:</span>
                      <span style="font-weight: 600; color: #16a34a;">R$ ${totalPaid.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700;">
                      <span>Valor Restante:</span>
                      <span style="color: ${remaining > 0 ? '#dc2626' : '#16a34a'};">R$ ${remaining.toFixed(2)}</span>
                    </div>
                  `;
                })()}
              </div>

              <!-- Action buttons on NF -->
              <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;" class="no-print-interactive">
                <button type="button" class="btn btn-secondary" id="btn-print-nf">🖨️ Salvar PDF / Imprimir</button>
              </div>

            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 24px; border-top: 1px solid var(--border-subtle); padding-top: 16px;">
              <button type="button" class="btn btn-secondary btn-prev-tab" data-prev="section-insumos">⬅ Voltar</button>
              <button type="submit" class="btn btn-primary" style="font-size: 1.1rem; padding: 10px 24px;">✅ Concluir e Salvar Pedido</button>
            </div>
          </div>

        </form>
      </div>
    `;

    container.innerHTML = html;

    // Attach Tab Events
    const tabs = container.querySelectorAll('.binder-tab');
    const panels = container.querySelectorAll('.binder-panel');

    function activateTab(targetId) {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      const activeTab = container.querySelector(`.binder-tab[data-target="${targetId}"]`);
      const activePanel = document.getElementById(targetId);
      if (activeTab) activeTab.classList.add('active');
      if (activePanel) {
        activePanel.classList.add('active');
        activePanel.style.display = 'block';
      }
      panels.forEach(p => { if (p.id !== targetId) p.style.display = 'none'; });
    }

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        saveCurrentState();
        activateTab(tab.dataset.target);
        render(); // re-render to update dynamic sections (BOM, Finance) based on new state
        activateTab(tab.dataset.target); // restore active tab after render
      });
    });

    container.querySelectorAll('.btn-next-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        saveCurrentState();
        const next = btn.dataset.next;
        activateTab(next);
        render();
        activateTab(next);
      });
    });

    container.querySelectorAll('.btn-prev-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        saveCurrentState();
        const prev = btn.dataset.prev;
        activateTab(prev);
        render();
        activateTab(prev);
      });
    });

    // Helper: Save form inputs to orderData before re-rendering
    function saveCurrentState() {
      // Cliente & Entrega
      if(document.querySelector('input[name="customerType"]:checked')) orderData.customerType = document.querySelector('input[name="customerType"]:checked').value;
      if(document.getElementById('inp-cli-nome')) orderData.customer = document.getElementById('inp-cli-nome').value;
      if(document.getElementById('inp-cli-empresa')) orderData.customerCompany = document.getElementById('inp-cli-empresa').value;
      if(document.getElementById('inp-cli-contato')) orderData.customerPhone = document.getElementById('inp-cli-contato').value;
      if(document.getElementById('inp-cli-nasc')) orderData.customerBirthDate = document.getElementById('inp-cli-nasc').value;
      if(document.getElementById('inp-cli-cpf')) orderData.customerCPF = document.getElementById('inp-cli-cpf').value;
      if(document.getElementById('inp-cli-cnpj')) orderData.customerCNPJ = document.getElementById('inp-cli-cnpj').value;
      if(document.getElementById('inp-cli-evento')) orderData.eventDate = document.getElementById('inp-cli-evento').value;
      if(document.getElementById('inp-cli-obs')) orderData.notes = document.getElementById('inp-cli-obs').value;
      
      if(document.getElementById('inp-ent-cep')) orderData.deliveryCep = document.getElementById('inp-ent-cep').value;
      if(document.getElementById('inp-ent-endereco')) orderData.deliveryAddress = document.getElementById('inp-ent-endereco').value;
      if(document.getElementById('inp-ent-numero')) orderData.deliveryNumber = document.getElementById('inp-ent-numero').value;
      if(document.getElementById('inp-ent-bairro')) orderData.deliveryNeighborhood = document.getElementById('inp-ent-bairro').value;
      if(document.getElementById('inp-ent-cidade')) orderData.deliveryCity = document.getElementById('inp-ent-cidade').value;
      if(document.getElementById('inp-ent-estado')) orderData.deliveryState = document.getElementById('inp-ent-estado').value;
      if(document.getElementById('inp-ent-obs')) orderData.deliveryNotes = document.getElementById('inp-ent-obs').value;

      // Items personalization & options
      container.querySelectorAll('.item-pers-field').forEach(el => {
        const idx = el.dataset.index;
        const fieldId = el.dataset.field;
        if(orderData.items[idx]) {
          if(!orderData.items[idx].personalization) orderData.items[idx].personalization = {};
          orderData.items[idx].personalization[fieldId] = el.value;
        }
      });
      container.querySelectorAll('.item-opt-field').forEach(el => {
        const idx = el.dataset.index;
        const fieldId = el.dataset.field;
        if(orderData.items[idx]) {
          if(!orderData.items[idx].changeOptions) orderData.items[idx].changeOptions = {};
          orderData.items[idx].changeOptions[fieldId] = el.value;
        }
      });
      container.querySelectorAll('.item-notes-field').forEach(el => {
        const idx = el.dataset.index;
        if(orderData.items[idx]) {
          orderData.items[idx].notes = el.value;
        }
      });

      // Financeiro
      if(document.getElementById('inp-fin-discount')) orderData.discount = Number(document.getElementById('inp-fin-discount').value) || 0;
      
      const newPayments = [];
      container.querySelectorAll('.pay-method-select').forEach((sel, i) => {
        const amtInput = container.querySelectorAll('.pay-method-amount')[i];
        if(sel && amtInput) {
          newPayments.push({ method: sel.value, amount: Number(amtInput.value) || 0 });
        }
      });
      if (newPayments.length > 0) orderData.paymentMethods = newPayments;
    }

    // Interactive Actions
    container.querySelectorAll('input[name="customerType"]').forEach(r => {
      r.addEventListener('change', () => {
        saveCurrentState();
        render();
        activateTab('section-cliente');
      });
    });

    const btnBuscaCep = document.getElementById('btn-busca-cep');
    if (btnBuscaCep) {
      btnBuscaCep.addEventListener('click', async () => {
        const cep = document.getElementById('inp-ent-cep').value.replace(/D/g, '');
        if (cep.length !== 8) { showToast('CEP inválido'); return; }
        try {
          const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
          const data = await res.json();
          if (data.erro) throw new Error();
          document.getElementById('inp-ent-endereco').value = data.logradouro || '';
          document.getElementById('inp-ent-bairro').value = data.bairro || '';
          document.getElementById('inp-ent-cidade').value = data.localidade || '';
          document.getElementById('inp-ent-estado').value = data.uf || '';
          document.getElementById('inp-ent-numero').focus();
        } catch(e) {
          showToast('Erro ao buscar CEP', '🔴');
        }
      });
    }

    const btnAddProduct = document.getElementById('btn-add-product');
    if (btnAddProduct) {
      btnAddProduct.addEventListener('click', () => {
        saveCurrentState();
        const pid = document.getElementById('inp-prod-select').value;
        const pqty = Number(document.getElementById('inp-prod-qty').value) || 1;
        const prod = products.find(p => p.id === pid);
        if (prod) {
          orderData.items.push({
            productId: prod.id,
            productTitle: prod.name,
            qty: pqty,
            unitPrice: prod.price || 0,
            personalization: {},
            changeOptions: {},
            productSnapshot: JSON.parse(JSON.stringify(prod)),
            notes: ''
          });
          // Also set default payment amount to total
          if (orderData.paymentMethods.length === 1) {
            orderData.paymentMethods[0].amount = getCalculatedTotal();
          }
          render();
          activateTab('section-produto');
        }
      });
    }

    container.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        saveCurrentState();
        const idx = Number(e.currentTarget.dataset.index);
        orderData.items.splice(idx, 1);
        render();
        activateTab('section-produto');
      });
    });

    const btnAddPay = document.getElementById('btn-add-pay');
    if (btnAddPay) {
      btnAddPay.addEventListener('click', () => {
        saveCurrentState();
        orderData.paymentMethods.push({ method: 'Dinheiro', amount: 0 });
        render();
        activateTab('section-financeiro');
      });
    }

    container.querySelectorAll('.btn-remove-pay').forEach(btn => {
      btn.addEventListener('click', (e) => {
        saveCurrentState();
        const idx = Number(e.currentTarget.dataset.index);
        orderData.paymentMethods.splice(idx, 1);
        render();
        activateTab('section-financeiro');
      });
    });

    const btnPrintNf = document.getElementById('btn-print-nf');
    if (btnPrintNf) {
      btnPrintNf.addEventListener('click', () => {
        // Simple print
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

    // Refresh calculations when amount inputs change
    container.querySelectorAll('.pay-method-amount, #inp-fin-discount').forEach(inp => {
      inp.addEventListener('blur', () => {
        saveCurrentState();
        render();
        activateTab('section-financeiro');
      });
    });

    // Form Submit (Save Order)
    const form = document.getElementById('form-new-order-page');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveCurrentState();

        if (orderData.items.length === 0) {
          showToast('Adicione pelo menos um produto ao pedido.', '🔴');
          activateTab('section-produto');
          return;
        }
        
        try {
          const { createOrder } = await import('./orders.js');
          
          const totalPaid = orderData.paymentMethods.reduce((sum, p) => sum + Number(p.amount), 0);
          const totalAmount = getCalculatedTotal();
          
          const primaryMethod = orderData.paymentMethods.length > 0 ? orderData.paymentMethods[0].method : 'PIX';

          const newOrder = createOrder({
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
            orderDate: new Date(),

            items: orderData.items,
            
            notes: orderData.notes,
            
            financial: {
              totalAmount,
              paidAmount: totalPaid,
              remainingAmount: Math.max(0, totalAmount - totalPaid),
              discount: orderData.discount,
              paymentMethods: orderData.paymentMethods
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

  const items = (order.items && order.items.length > 0) ? order.items : [{
    productTitle: order.productTitle,
    qty: order.qty,
    personalization: order.personalization || {},
    changeOptions: order.changeOptions || {},
    productSnapshot: order.productSnapshot || {}
  }];

  const contentHtml = `
    <!-- Top Summary Badge Bar -->
    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 14px 18px; margin-bottom: 16px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-family: monospace; font-size: 16px; font-weight: 700; color: var(--accent-primary);">
            #${orderNum}
          </span>
          <span class="status-pill" style="border-left: 4px solid ${neon.color}; font-size: 12px; padding: 4px 10px;">
            ${escapeHtml(neon.label)}
          </span>
        </div>
        <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-top: 4px;">
          ${escapeHtml(order.title || order.productTitle || 'Vários Itens')}
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11px; color: var(--text-secondary);">Data do Pedido: <b>${order.orderDate || '--/--/----'}</b></div>
        <div style="font-size: 12px; color: var(--text-primary); margin-top: 2px;">
          Entrega Prevista: <b style="color: #0284c7;">${order.deliveryDate || '--/--/----'}</b>
        </div>
      </div>
    </div>

    <!-- Production Stage Timeline Stepper -->
    <!-- (Timeline temporariamente desabilitada) -->

    <!-- Production Operations Action Box (Apontamento & CQ) -->
    <!-- (Ações de produção temporariamente desabilitadas) -->

    <!-- 2-Column Grid: Dados do Cliente & Condições Financeiras -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
      
      <!-- Dados do Cliente -->
      <div class="drawer-detail-section" style="margin: 0; padding: 14px; background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 10px;">
        <h4 class="drawer-subtitle" style="margin-top: 0; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
          👤 Dados do Cliente / Entrega
        </h4>
        <div class="detail-grid" style="display: flex; flex-direction: column; gap: 8px;">
          <div class="detail-item">
            <span class="detail-label" style="font-size: 11px; color: var(--text-secondary);">Cliente:</span>
            <span class="detail-val" style="font-size: 13px; font-weight: 600;">${escapeHtml(order.customerType === 'PJ' ? (order.customerCompany || order.customer) : order.customer || '—')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label" style="font-size: 11px; color: var(--text-secondary);">Contato:</span>
            <span class="detail-val">${escapeHtml(order.customerPhone || '—')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label" style="font-size: 11px; color: var(--text-secondary);">Endereço Entrega:</span>
            <span class="detail-val">${escapeHtml(order.deliveryAddress ? order.deliveryAddress + ', ' + order.deliveryNumber : '—')}</span>
          </div>
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

  openDrawer(`Consulta: Pedido #${orderNum}`, contentHtml, (drawer, close) => {
    // Eventos de edição serão configurados aqui futuramente
  }, 'drawer-large');
}

export function openEditOrderDrawer(orderId, ctx) {
  ctx.showToast('Edição de pedidos com múltiplos itens está em desenvolvimento.', 'ℹ');
}
