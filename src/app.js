/**
 * PAPER MAX - Main Application Coordinator (app.js)
 * Manages Views, Drawers, Autosave Sync, Keyboard Shortcuts, Kawaii Loader, and Toasts.
 */

import { bus, showToast } from './core/events.js';
import { onSaveStatusChange, loadSettings, saveSettings } from './data/storage.js';
import { exportBackup, restoreBackup, getLastBackupTimestamp } from './data/backup.engine.js';
import { getAuthenticatedUser, renderLoginScreen } from './data/auth.js';
import { calculateDashboardMetrics } from './modules/dashboard/dashboard.js';
import {
  getAutomationRules,
  updateAutomationRuleStatus,
  getAutomationLogs,
  getNotifications,
  markNotificationAsRead,
  clearAllNotifications
} from './modules/automation/automation.engine.js';
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  duplicateOrder,
  deleteOrder,
  cycleOrderStatus,
  exportOrdersCSV,
  exportOrdersCSVTemplate,
  importOrdersCSV,
  ORDER_STATUS_MAP,
  isOrderActive,
  addGeneratedFileToOrder,
  approveOrderById,
  sendOrderToProductionById,
  advanceOrderStageById,
  returnOrderStageById,
  updateOrderQuantityById,
  updateOrderPrintJobById,
  submitOrderQCById,
  updateOrderPackagingById,
  generateOperationalLabelData,
  PRODUCTION_STAGES
} from './modules/orders/orders.js';
import {
  renderTimelineStepperHtml,
  renderProductionOpsBoxHtml,
  renderProductionHistoryHtml,
  bindProductionOpsEvents,
  openQuantityModal,
  openReturnStageModal,
  openQCModal,
  openOperationalLabelModal
} from './modules/production/production.ui.js';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  duplicateProduct,
  deleteProduct,
  exportProductsCSV,
  exportProductsCSVTemplate,
  importProductsCSV,
  isSmartMold,
  calculateProductIntelligence,
  exportProductIntelligenceCSV,
  renderProductsRankingView,
  renderProductsTrendsView,
  renderProductsCapacityView,
  openProductIntelligenceDrawer,
  INTELLIGENCE_PERIODS
} from './modules/products/products.js';

import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getProductCountForCategory
} from './modules/categories/categories.js';
import { renderStockModule, openPurchaseDrawer } from './modules/stock/stock.ui.js';
import { renderFinanceModule } from './modules/finance/finance.ui.js';
import { openBulkPersonalizationModal } from './modules/personalization/bulk.ui.js';
import { generatePersonalizedPdf, triggerPdfDownload } from './modules/personalization/pdf.engine.js';
import { openProductConfigDrawer } from './modules/products/product.editor.ui.js';
import { fileStorage } from './data/filestorage.js';
import { escapeHtml, formatCurrency, formatDateBR, formatDateShortBR, parseDateBRToISO, generateId } from './utils/sanitize.js';
import { initCopilotUI } from './modules/copilot/copilot.ui.js';

// Application State
let currentView = 'inicio'; // 'inicio' | 'pedidos' | 'produtos' | 'estoque' | 'financeiro' | 'ajustes'
let ordersTab = 'em_andamento'; // 'em_andamento' | 'todos' | 'aguardando' | 'producao' | 'fila_impressao' | 'prontos' | 'entregues' | 'cancelados'
let productsTab = 'todos'; // 'todos' | 'vitrine' | 'ranking' | 'categorias'
let orderSearchTerm = '';
let productSearchTerm = '';

// ==========================================
// TOAST NOTIFICATION (Re-exported from core/events to eliminate duplication)
// ==========================================
export { showToast };

// ==========================================
// KAWAII LOADER (Zero artificial delay)
// ==========================================
export function showKawaiiLoader(show = true, message = 'Organizando seu ateliê...') {
  let loader = document.getElementById('kawaii-loader');
  if (!loader && show) {
    loader = document.createElement('div');
    loader.id = 'kawaii-loader';
    loader.className = 'kawaii-loader-backdrop';
    loader.innerHTML = `
      <div class="kawaii-loader-card">
        <div class="kawaii-icon-anim">✂️ ✨</div>
        <div class="kawaii-text">${escapeHtml(message)}</div>
      </div>
    `;
    document.body.appendChild(loader);
  }
  if (loader) {
    loader.style.display = show ? 'flex' : 'none';
  }
}

// ==========================================
// REAL-TIME CLOCK & DATE
// ==========================================
function initClock() {
  function update() {
    const now = new Date();
    const datetimeDisplay = document.getElementById('datetime-display');
    if (datetimeDisplay) {
      let dateEl = datetimeDisplay.querySelector('#date') || document.getElementById('date');
      let clockEl = datetimeDisplay.querySelector('#clock') || document.getElementById('clock');
      
      if (!dateEl) {
        dateEl = document.createElement('div');
        dateEl.id = 'date';
        dateEl.className = 'date';
        datetimeDisplay.appendChild(dateEl);
      }
      if (!clockEl) {
        clockEl = document.createElement('div');
        clockEl.id = 'clock';
        clockEl.className = 'clock';
        datetimeDisplay.appendChild(clockEl);
      }

      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = String(now.getFullYear()).slice(-2);
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');

      dateEl.textContent = `${day}/${month}/${year}`;
      clockEl.textContent = `${hours}:${minutes}:${seconds}`;
    }
  }

  update();
  setInterval(update, 1000);
}

// ==========================================
// DRAWER CONTROLLER
// ==========================================
export function openDrawer({ title, contentHtml, footerHtml = '', onMount = null }) {
  let drawer = document.getElementById('app-drawer');
  if (!drawer || !drawer.querySelector('#drawer-panel')) {
    if (drawer) drawer.remove();
    drawer = document.createElement('div');
    drawer.id = 'app-drawer';
    drawer.className = 'app-drawer-backdrop';
    drawer.innerHTML = `
      <div class="app-drawer-panel" id="drawer-panel">
        <div class="app-drawer-header">
          <h3 id="drawer-title"></h3>
          <button class="modal-close" id="btn-close-drawer" aria-label="Fechar gaveta">✕</button>
        </div>
        <div class="app-drawer-body" id="drawer-body"></div>
        <div class="app-drawer-footer" id="drawer-footer"></div>
      </div>
    `;
    document.body.appendChild(drawer);
  }

  const titleEl = document.getElementById('drawer-title');
  const bodyEl = document.getElementById('drawer-body');
  const footerEl = document.getElementById('drawer-footer');

  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = contentHtml;
  if (footerEl) footerEl.innerHTML = footerHtml;

  drawer.className = 'app-drawer-backdrop active';
  document.body.style.overflow = 'hidden';

  const closeBtn = drawer.querySelector('#btn-close-drawer');
  if (closeBtn) closeBtn.onclick = closeDrawer;

  drawer.onclick = e => {
    if (e.target === drawer) closeDrawer();
  };

  if (typeof onMount === 'function') {
    onMount(drawer);
  }
}

export function closeDrawer() {
  const drawer = document.getElementById('app-drawer');
  if (drawer) {
    drawer.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// ==========================================
// RENDER: DASHBOARD VIEW
// ==========================================
function renderDashboard() {
  const container = document.getElementById('view-container');
  if (!container) return;

  const metrics = calculateDashboardMetrics();

  container.innerHTML = `
    <!-- Stat Metric Cards -->
    <section class="cards" id="metric-cards-grid">
      <div class="card" id="card-metric-today">
        <div class="card-top">
          <span class="card-label">Pedidos hoje</span>
          <span class="card-icon-badge">📋</span>
        </div>
        <div class="card-value" id="val-orders-today">${metrics.todayCount}</div>
        <div class="card-subtext">Data de criação ou entrega hoje</div>
      </div>

      <div class="card" id="card-metric-prod">
        <div class="card-top">
          <span class="card-label">Em produção</span>
          <span class="card-icon-badge">⚙</span>
        </div>
        <div class="card-value" id="val-orders-prod">${metrics.inProdCount}</div>
        <div class="card-subtext">Pedidos em fase de execução</div>
      </div>

      <div class="card" id="card-metric-pending">
        <div class="card-top">
          <span class="card-label">Pendências</span>
          <span class="card-icon-badge">⚠️</span>
        </div>
        <div class="card-value" id="val-orders-pending">${metrics.pendingCount}</div>
        <div class="card-subtext">Aguardando aprovação ou insumo</div>
      </div>

      <div class="card" id="card-metric-ready">
        <div class="card-top">
          <span class="card-label">Prontos</span>
          <span class="card-icon-badge">✓</span>
        </div>
        <div class="card-value" id="val-orders-ready">${metrics.readyCount}</div>
        <div class="card-subtext">Prontos para envio ou retirada</div>
      </div>
    </section>

    <!-- Operational Production Pipeline: "O que preciso produzir hoje?" (Etapa 4) -->
    <section class="operational-strip" id="sec-operational-pipeline">
      <div class="operational-strip-header">
        <div class="operational-strip-title">
          <span>🏭 O que preciso produzir hoje?</span>
          <span style="font-size: 11px; font-weight: 500; color: var(--text-muted);">Visão operacional diária</span>
        </div>
        <button class="btn btn-sm" id="btn-dash-open-print-queue" style="font-size: 11px; padding: 4px 10px; font-weight: 600;">
          🖨 Abrir Fila de Impressão (${metrics.operational.printQueueCount})
        </button>
      </div>

      <div class="pipeline-grid">
        <div class="pipeline-card" data-dash-tab="aguardando" title="Ver pedidos aguardando">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">🟡 Aguardando</span>
            <span class="status-dot" style="background: var(--status-yellow-dot);"></span>
          </div>
          <div class="pipeline-card-count">${metrics.operational.awaitingCount}</div>
        </div>

        <div class="pipeline-card" data-dash-tab="impressao" title="Ver pedidos em Impressão">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">🖨 Impressão</span>
            <span class="status-dot" style="background: var(--status-blue-dot);"></span>
          </div>
          <div class="pipeline-card-count" style="color: var(--accent-primary);">${metrics.operational.impressaoCount}</div>
        </div>

        <div class="pipeline-card" data-dash-tab="corte" title="Ver pedidos em Corte">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">✂ Corte</span>
            <span class="status-dot" style="background: #2563eb;"></span>
          </div>
          <div class="pipeline-card-count">${metrics.operational.corteCount}</div>
        </div>

        <div class="pipeline-card" data-dash-tab="vinco" title="Ver pedidos em Vinco">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">📐 Vinco</span>
            <span class="status-dot" style="background: #9333ea;"></span>
          </div>
          <div class="pipeline-card-count">${metrics.operational.vincoCount}</div>
        </div>

        <div class="pipeline-card" data-dash-tab="montagem" title="Ver pedidos em Montagem">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">🧩 Montagem</span>
            <span class="status-dot" style="background: #4f46e5;"></span>
          </div>
          <div class="pipeline-card-count">${metrics.operational.montagemCount}</div>
        </div>

        <div class="pipeline-card" data-dash-tab="acabamento" title="Ver pedidos em Acabamento">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">✨ Acabamento</span>
            <span class="status-dot" style="background: #0284c7;"></span>
          </div>
          <div class="pipeline-card-count">${metrics.operational.acabamentoCount}</div>
        </div>

        <div class="pipeline-card" data-dash-tab="conferencia" title="Ver pedidos em CQ / Conferência">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">🔍 CQ</span>
            <span class="status-dot" style="background: #ea580c;"></span>
          </div>
          <div class="pipeline-card-count" style="color: #c2410c;">${metrics.operational.conferenciaCount}</div>
        </div>

        <div class="pipeline-card" data-dash-tab="embalagem" title="Ver pedidos em Embalagem">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">📦 Embalagem</span>
            <span class="status-dot" style="background: #0d9488;"></span>
          </div>
          <div class="pipeline-card-count">${metrics.operational.embalagemCount}</div>
        </div>

        <div class="pipeline-card" data-dash-tab="pronto" title="Ver pedidos Prontos">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">✓ Pronto</span>
            <span class="status-dot" style="background: var(--status-green-dot);"></span>
          </div>
          <div class="pipeline-card-count" style="color: #059669;">${metrics.operational.prontoCount}</div>
        </div>
      </div>
    </section>

    <!-- Two-column Operational Layout -->
    <section class="layout" id="operational-layout">
      <!-- Active Orders Panel -->
      <div class="panel" id="panel-orders">
        <div class="panel-header">
          <h2 class="panel-title" id="title-orders">
            Pedidos ativos
            <span class="badge-count" id="badge-orders-count">${metrics.activeOrders.length} pedidos</span>
          </h2>
          <div class="search-wrapper">
            <span class="search-icon">🔍</span>
            <input class="search" id="input-dashboard-search" placeholder="Buscar pedido ou produto..." value="${escapeHtml(orderSearchTerm)}" />
          </div>
        </div>

        <div class="orders" id="dashboard-orders-list">
          <!-- Rendered below -->
        </div>
      </div>

      <!-- Alerts and Needs Panel -->
      <div class="panel" id="panel-alerts">
        <div class="panel-header">
          <h2 class="panel-title" id="title-alerts">Pendências e Atenção</h2>
        </div>
        <div class="alerts" id="alerts-list">
          ${metrics.commercial?.highestGrowth ? `
            <div class="alert-card alert-blue" style="cursor: pointer;" id="dash-alert-growth" title="Clique para ver o ranking de produtos">
              <div class="alert-title">🚀 Produto em Maior Crescimento: ${escapeHtml(metrics.commercial.highestGrowth.name)} (+${metrics.commercial.highestGrowth.growthQtyPct.toFixed(1)}%)</div>
              <div class="alert-desc">${metrics.commercial.highestGrowth.qty} un vendidas nos últimos 30 dias (${formatCurrency(metrics.commercial.highestGrowth.revenue)}). Clique para ver análise.</div>
            </div>
          ` : ''}
          ${metrics.commercial?.highestMargin ? `
            <div class="alert-card alert-green" style="cursor: pointer;" id="dash-alert-margin" title="Clique para ver produtos">
              <div class="alert-title">💎 Destaque de Rentabilidade: ${escapeHtml(metrics.commercial.highestMargin.name)} (${metrics.commercial.highestMargin.marginPct.toFixed(1)}% de margem)</div>
              <div class="alert-desc">Lucro de ${formatCurrency(metrics.commercial.highestMargin.profit)} com preço de ${formatCurrency(metrics.commercial.highestMargin.price)}.</div>
            </div>
          ` : ''}
          ${metrics.commercial?.stockAlerts?.length > 0 ? `
            <div class="alert-card alert-orange" style="cursor: pointer;" id="dash-alert-stock" title="Clique para ver a capacidade de produção">
              <div class="alert-title">⚠ Alerta de Demanda × Estoque (${metrics.commercial.stockAlerts.length} produto(s))</div>
              <div class="alert-desc">${escapeHtml(metrics.commercial.stockAlerts.map(p => p.name).join(', '))} com estoque abaixo do volume de vendas.</div>
            </div>
          ` : ''}
          ${metrics.operational.qcAlertOrders.length > 0 ? `
            <div class="alert-card alert-red">
              <div class="alert-title">🔴 ${metrics.operational.qcAlertOrders.length} pedido(s) com não conformidade no CQ</div>
              <div class="alert-desc">${escapeHtml(metrics.operational.qcAlertOrders.map(o => `Pedido ${o.number || o.id}`).join(', '))} requer(em) retrabalho na linha de produção.</div>
            </div>
          ` : ''}
          ${metrics.operational.pendingPdfOrders.length > 0 ? `
            <div class="alert-card alert-yellow">
              <div class="alert-title">🟡 ${metrics.operational.pendingPdfOrders.length} pedido(s) sem PDF vetorial gerado</div>
              <div class="alert-desc">Gere o PDF de produção para liberar a fila de impressão.</div>
            </div>
          ` : ''}
          ${metrics.operational.urgentOrders.length > 0 ? `
            <div class="alert-card alert-orange">
              <div class="alert-title">🟠 ${metrics.operational.urgentOrders.length} pedido(s) prioritários ou com entrega para hoje</div>
              <div class="alert-desc">Monitore a conferência final e o empacotamento.</div>
            </div>
          ` : ''}
          <div class="alert-card alert-blue">
            <div class="alert-title">🔵 ${metrics.inProdCount} pedido(s) na linha operacional</div>
            <div class="alert-desc">Plotter de corte, vinco, montagem e acabamento em andamento.</div>
          </div>
          <div class="alert-card alert-green">
            <div class="alert-title">🟢 ${metrics.readyCount} pedido(s) finalizados</div>
            <div class="alert-desc">Conferir embalagem final e liberação para o cliente.</div>
          </div>
        </div>

      </div>
    </section>

    <!-- Summary Lifetime Performance -->
    <section class="panel mother" id="panel-lifetime">
      <div class="panel-header">
        <h2 class="panel-title" id="title-lifetime">O que foi feito até hoje?</h2>
        <span class="card-label">Acumulado histórico real</span>
      </div>
      <div class="lifetime-grid" id="lifetime-metrics">
        <div class="life-card" id="life-card-sales">
          <span class="life-label">Vendas Totais</span>
          <b class="life-val" id="val-lifetime-sales">${formatCurrency(metrics.totalRevenue)}</b>
        </div>
        <div class="life-card" id="life-card-profit">
          <span class="life-label">Lucro Líquido Estimado</span>
          <b class="life-val" id="val-lifetime-profit">${formatCurrency(metrics.estimatedProfit)}</b>
        </div>
        <div class="life-card" id="life-card-prods">
          <span class="life-label">Produtos Cadastrados</span>
          <b class="life-val" id="val-lifetime-products">${metrics.productsCount} itens</b>
        </div>
      </div>
    </section>

    <!-- Sales & Volume Bar Chart -->
    <section class="panel chart-panel" id="panel-chart">
      <div class="panel-header">
        <div>
          <h2 class="panel-title" id="title-chart">Vendas por mês</h2>
          <span class="card-subtext">Evolução do volume de pedidos no ano</span>
        </div>
        <span class="badge-count" id="badge-chart-year">2026</span>
      </div>
      <div class="bars" id="sales-bars-container">
        ${metrics.chartData.map((bar, idx) => {
          const maxVal = Math.max(...metrics.chartData.map(b => b.value), 100);
          const percent = Math.min(100, Math.round((bar.value / maxVal) * 90) + 10);
          const isActive = idx === metrics.chartData.length - 1 ? 'active' : '';
          return `
            <div class="bar-wrap">
              <span class="bar-tooltip">${bar.value} pedidos</span>
              <div class="bar ${isActive}" style="height: ${percent}%"></div>
              <span class="bar-label">${escapeHtml(bar.label)}</span>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;

  // Render orders inside active list
  renderDashboardOrdersList();

  // Search input in dashboard
  const searchInput = document.getElementById('input-dashboard-search');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      orderSearchTerm = e.target.value;
      renderDashboardOrdersList();
    });
  }

  // Pipeline card quick navigation (Etapa 4)
  container.querySelectorAll('[data-dash-tab]').forEach(card => {
    card.addEventListener('click', () => {
      ordersTab = card.dataset.dashTab;
      switchView('pedidos');
    });
  });

  const btnOpenPrintQueue = container.querySelector('#btn-dash-open-print-queue');
  if (btnOpenPrintQueue) {
    btnOpenPrintQueue.addEventListener('click', () => {
      ordersTab = 'fila_impressao';
      switchView('pedidos');
    });
  }

  const alertGrowth = container.querySelector('#dash-alert-growth');
  if (alertGrowth) {
    alertGrowth.addEventListener('click', () => {
      productsTab = 'ranking';
      switchView('produtos');
    });
  }

  const alertMargin = container.querySelector('#dash-alert-margin');
  if (alertMargin) {
    alertMargin.addEventListener('click', () => {
      productsTab = 'ranking';
      switchView('produtos');
    });
  }

  const alertStock = container.querySelector('#dash-alert-stock');
  if (alertStock) {
    alertStock.addEventListener('click', () => {
      productsTab = 'capacidade';
      switchView('produtos');
    });
  }
}


function renderDashboardOrdersList() {
  const container = document.getElementById('dashboard-orders-list');
  if (!container) return;

  const orders = getOrders({ search: orderSearchTerm }).filter(isOrderActive);

  if (orders.length === 0) {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">
        <b style="display: block; color: var(--text-primary); margin-bottom: 4px;">Nenhum pedido ativo encontrado.</b>
        Os pedidos aparecerão aqui quando forem criados e estiverem em andamento na produção.
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(order => {
    const statusDef = ORDER_STATUS_MAP[order.status] || ORDER_STATUS_MAP.yellow;
    const statusClass = `status-${statusDef.colorClass || order.status}`;
    const orderTitleFormatted = `Pedido ${order.number || order.id} · ${escapeHtml(order.productTitle || order.title || 'Personalizado')}`;
    const customer = escapeHtml(order.customer || 'Cliente');
    const qty = order.qty || 1;
    const date = order.deliveryDate || order.date || '--/--/--';

    return `
      <div class="list-row ${statusClass}" data-order-id="${order.id}">
        <div class="list-main" style="cursor: pointer;" data-action="view-order" data-id="${order.id}">
          <div class="list-title" style="display: flex; align-items: center; gap: 8px;">
            ${orderTitleFormatted}
            <span style="font-size: 11px; font-weight: normal; color: var(--text-secondary);">• ${customer}</span>
          </div>
          <div class="list-meta">
            ${qty} un · Entrega: ${date}
          </div>
        </div>
        <div style="text-align: right; min-width: 120px;">
            <span style="font-weight: 600; font-size: 11px; color: var(--text-secondary); cursor: pointer;" data-action="cycle-status" data-id="${order.id}">${escapeHtml(order.statusLabel || statusDef.label)}</span>
        </div>
        <div class="actions">
            <button class="action-btn" data-action="edit-order" data-id="${order.id}" title="Editar pedido">✏️ Editar</button>
            <button class="action-btn" data-action="dup-order" data-id="${order.id}" title="Duplicar pedido">📋 Duplicar</button>
            <button class="action-btn" data-action="del-order" data-id="${order.id}" title="Excluir pedido" style="color: #ef4444;">🗑️ Excluir</button>
            <button class="action-btn" data-action="hide-order" data-id="${order.id}" title="Ocultar pedido">👁️ Ocultar</button>
        </div>
      </div>
    `;
  }).join('');

  // Bind actions
  container.querySelectorAll('[data-action="cycle-status"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      cycleOrderStatus(id);
      renderDashboard();
      showToast('Status atualizado');
    });
  });

  container.querySelectorAll('[data-action="view-order"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      showOrderDetailsDrawer(id);
    });
  });
}

// ==========================================
// RENDER: PEDIDOS VIEW (FULL MODULE)
// ==========================================
function renderOrdersView() {
  const container = document.getElementById('view-container');
  if (!container) return;

  const orders = getOrders({ tab: ordersTab, search: orderSearchTerm });

  container.innerHTML = `
    <div class="module-header">
      <div>
        <h2 class="module-title">Gestão de Pedidos</h2>
        <p class="module-subtitle">Acompanhe todos os pedidos, prazos de entrega e personalizações do cliente.</p>
      </div>
      <div class="module-actions">
        <button class="btn btn-primary" id="btn-orders-new">+ Novo pedido</button>
        <button class="btn" id="btn-orders-bulk" style="font-weight: 600;">⚡ Personalização em massa</button>
        <button class="btn" id="btn-orders-export">Exportar CSV</button>
        <button class="btn" id="btn-orders-template">Modelo CSV</button>
        <button class="btn" id="btn-orders-import">Importar CSV</button>
      </div>
    </div>

    <!-- Orders Tabs Submenu -->
    <div class="subtabs" id="orders-subtabs">
      <button class="subtab-btn ${ordersTab === 'em_andamento' ? 'active' : ''}" data-tab="em_andamento">⚡ Em Andamento (Ativos)</button>
      <button class="subtab-btn ${ordersTab === 'todos' ? 'active' : ''}" data-tab="todos">Todos</button>
      <button class="subtab-btn ${ordersTab === 'aguardando' ? 'active' : ''}" data-tab="aguardando">🟡 Aguardando</button>
      <button class="subtab-btn ${ordersTab === 'producao' ? 'active' : ''}" data-tab="producao">🔵 Produção</button>
      <button class="subtab-btn ${ordersTab === 'impressao' ? 'active' : ''}" data-tab="impressao">🖨 Impressão</button>
      <button class="subtab-btn ${ordersTab === 'corte' ? 'active' : ''}" data-tab="corte">✂ Corte</button>
      <button class="subtab-btn ${ordersTab === 'vinco' ? 'active' : ''}" data-tab="vinco">📐 Vinco</button>
      <button class="subtab-btn ${ordersTab === 'montagem' ? 'active' : ''}" data-tab="montagem">🧩 Montagem</button>
      <button class="subtab-btn ${ordersTab === 'acabamento' ? 'active' : ''}" data-tab="acabamento">✨ Acabamento</button>
      <button class="subtab-btn ${ordersTab === 'conferencia' ? 'active' : ''}" data-tab="conferencia">🔍 CQ</button>
      <button class="subtab-btn ${ordersTab === 'embalagem' ? 'active' : ''}" data-tab="embalagem">📦 Embalagem</button>
      <button class="subtab-btn ${ordersTab === 'prontos' ? 'active' : ''}" data-tab="prontos">🟢 Prontos</button>
      <button class="subtab-btn ${ordersTab === 'entregues' ? 'active' : ''}" data-tab="entregues">⚪ Entregues</button>
      <button class="subtab-btn ${ordersTab === 'bloqueados' ? 'active' : ''}" data-tab="bloqueados">🔴 Bloqueados</button>
      <button class="subtab-btn ${ordersTab === 'cancelados' ? 'active' : ''}" data-tab="cancelados">Cancelados</button>
    </div>

    <!-- Search & Filters -->
    <div class="filter-bar">
      <div class="search-wrapper flex-1">
        <span class="search-icon">🔍</span>
        <input class="search w-full" id="input-orders-search" placeholder="Buscar por número (ex: Pedido 1048), cliente, produto ou status..." value="${escapeHtml(orderSearchTerm)}" />
      </div>
      <span class="badge-count">${orders.length} pedidos</span>
    </div>

    <!-- Orders Table Panel -->
    <div class="panel" style="margin-top: 12px; padding: 0;">
      <div class="table-responsive">
        ${ordersTab === 'fila_impressao' ? `
          <!-- Specialized Print Queue Table (Etapa 4) -->
          <table class="data-table">
            <thead>
              <tr>
                <th>Identificação</th>
                <th>Produto</th>
                <th>Qtd</th>
                <th>Arquivo (PDF)</th>
                <th>Status Impressão</th>
                <th>Prioridade</th>
                <th>Data Entrega</th>
                <th style="text-align: right;">Ações de Impressão</th>
              </tr>
            </thead>
            <tbody>
              ${orders.length === 0 ? `
                <tr>
                  <td colspan="8" style="text-align: center; padding: 36px; color: var(--text-muted);">
                    <b style="display: block; color: var(--text-primary); margin-bottom: 4px;">Nenhum pedido na fila de impressão no momento.</b>
                    Os pedidos aprovados aparecerão aqui aguardando liberação para a plotter.
                  </td>
                </tr>
              ` : orders.map(order => {
                const printJob = order.production?.printJob || {};
                const pStatus = printJob.status || 'aguardando_impressao';
                const pPriority = printJob.priority || 'normal';
                const files = order.generatedFiles || [];
                const latestFile = files[0];

                let pBadgeClass = 'status-yellow';
                let pLabel = 'Aguardando';
                if (pStatus === 'imprimindo') {
                  pBadgeClass = 'status-blue';
                  pLabel = 'Imprimindo';
                } else if (pStatus === 'pausada') {
                  pBadgeClass = 'status-neutral';
                  pLabel = 'Pausada';
                } else if (pStatus === 'concluida') {
                  pBadgeClass = 'status-green';
                  pLabel = 'Concluída';
                }

                return `
                  <tr>
                    <td>
                      <b>Pedido ${order.number || order.id}</b>
                      <div style="font-size: 10px; color: var(--text-muted);">${escapeHtml(order.production?.operationalCode || `OP-${order.number}`)}</div>
                    </td>
                    <td>${escapeHtml(order.productTitle || 'Item')}</td>
                    <td><b>${order.qty}</b> un</td>
                    <td>
                      ${latestFile ? `
                        <button class="btn btn-sm btn-dl-order-file" data-file-id="${latestFile.fileId}" style="font-size: 11px; padding: 2px 8px;" title="${escapeHtml(latestFile.fileName)}">
                          📄 PDF Pronto
                        </button>
                      ` : `
                        <span style="font-size: 11px; color: #ea580c; font-weight: 500;">⚠ Sem PDF</span>
                      `}
                    </td>
                    <td>
                      <span class="status-pill ${pBadgeClass}">
                        ${pLabel}
                      </span>
                    </td>
                    <td>
                      <span class="priority-badge priority-${pPriority}">
                        ${pPriority}
                      </span>
                    </td>
                    <td>${order.deliveryDate || '--/--/----'}</td>
                    <td style="text-align: right;">
                      <div class="action-btn-group">
                        ${pStatus !== 'imprimindo' && pStatus !== 'concluida' ? `
                          <button class="btn-action btn-primary" data-action="print-start" data-id="${order.id}" title="Iniciar impressão na máquina">▶ Iniciar</button>
                        ` : ''}
                        ${pStatus === 'imprimindo' ? `
                          <button class="btn-action" data-action="print-pause" data-id="${order.id}" title="Pausar impressão">⏸ Pausar</button>
                          <button class="btn-action btn-primary" data-action="print-complete" data-id="${order.id}" title="Concluir impressão e enviar para corte">✓ Concluir</button>
                        ` : ''}
                        <button class="btn-action" data-action="view-order" data-id="${order.id}" title="Abrir detalhes operacionais">Abrir</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        ` : `
          <!-- Standard Orders List -->
          <div class="list-group" style="display: flex; flex-direction: column; gap: 8px;">
              ${orders.length === 0 ? `
                  <div style="text-align: center; padding: 36px; color: var(--text-muted); background: var(--bg-surface); border-radius: 8px; border: 1px solid var(--border-subtle);">
                    <b style="display: block; color: var(--text-primary); margin-bottom: 4px;">Nenhum pedido encontrado nesta visualização.</b>
                    Utilize o botão "+ Novo pedido" acima para registrar um pedido ou selecione outra aba de filtro.
                  </div>
              ` : orders.map(order => {
                const statusDef = ORDER_STATUS_MAP[order.status] || ORDER_STATUS_MAP.yellow;
                const statusClass = `status-${statusDef.colorClass || order.status}`;
                const orderIdDisplay = `Pedido ${order.number || order.id}`;

                return `
                  <div class="list-row ${statusClass}">
                    <div class="list-main" style="cursor: pointer;" data-action="view-order" data-id="${order.id}">
                      <div class="list-title" style="display: flex; align-items: center; gap: 8px;">
                          ${orderIdDisplay}
                          <span style="font-size: 11px; font-weight: normal; color: var(--text-secondary);">• ${escapeHtml(order.customer || 'Cliente')}</span>
                      </div>
                      <div class="list-meta">
                          ${escapeHtml(order.productTitle || 'Item')} 
                          ${order.deliveryDate ? ` • Entrega: ${order.deliveryDate}` : ''}
                      </div>
                    </div>
                    <div style="text-align: right; min-width: 120px;">
                        <span style="font-weight: 600; font-size: 13px;">${order.qty} un</span>
                    </div>
                    <div class="actions">
                        <button class="action-btn" data-action="edit-order" data-id="${order.id}" title="Editar pedido">✏️ Editar</button>
                        <button class="action-btn" data-action="dup-order" data-id="${order.id}" title="Duplicar pedido">📋 Duplicar</button>
                        <button class="action-btn" data-action="del-order" data-id="${order.id}" title="Excluir pedido" style="color: #ef4444;">🗑️ Excluir</button>
                    </div>
                  </div>
                `;
              }).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  // Bind subtabs
  container.querySelectorAll('#orders-subtabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      ordersTab = btn.dataset.tab;
      renderOrdersView();
    });
  });

  // Search input
  const searchInput = document.getElementById('input-orders-search');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      orderSearchTerm = e.target.value;
      renderOrdersView();
    });
  }

  // Action Buttons
  const newBtn = document.getElementById('btn-orders-new');
  if (newBtn) newBtn.addEventListener('click', () => openNewOrderDrawer());

  const bulkBtn = document.getElementById('btn-orders-bulk');
  if (bulkBtn) {
    bulkBtn.addEventListener('click', () => {
      openBulkPersonalizationModal(openDrawer, closeDrawer);
    });
  }

  const exportBtn = document.getElementById('btn-orders-export');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const csv = exportOrdersCSV();
      downloadCSVFile(`pedidos_${Date.now()}.csv`, csv);
      showToast('CSV de Pedidos exportado com sucesso');
    });
  }

  const templateBtn = document.getElementById('btn-orders-template');
  if (templateBtn) {
    templateBtn.addEventListener('click', () => {
      const csv = exportOrdersCSVTemplate();
      downloadCSVFile(`modelo_pedidos.csv`, csv);
      showToast('Modelo CSV baixado com sucesso');
    });
  }

  const importBtn = document.getElementById('btn-orders-import');
  if (importBtn) {
    importBtn.addEventListener('click', () => openImportCSVDrawer('pedidos'));
  }

  // Row action buttons
  container.querySelectorAll('[data-action="cycle-status"]').forEach(el => {
    el.addEventListener('click', () => {
      cycleOrderStatus(el.dataset.id);
      renderOrdersView();
      showToast('Status atualizado');
    });
  });

  container.querySelectorAll('[data-action="view-order"]').forEach(el => {
    el.addEventListener('click', () => showOrderDetailsDrawer(el.dataset.id));
  });

  // Print Queue Action Listeners (Etapa 4)
  container.querySelectorAll('[data-action="print-start"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const res = updateOrderPrintJobById(btn.dataset.id, 'iniciar');
      if (res.success) {
        showToast(res.message);
        renderOrdersView();
      } else {
        showToast(res.message, '⚠');
      }
    });
  });

  container.querySelectorAll('[data-action="print-pause"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const res = updateOrderPrintJobById(btn.dataset.id, 'pausar');
      if (res.success) {
        showToast(res.message);
        renderOrdersView();
      } else {
        showToast(res.message, '⚠');
      }
    });
  });

  container.querySelectorAll('[data-action="print-complete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const res = updateOrderPrintJobById(btn.dataset.id, 'concluir');
      if (res.success) {
        showToast(res.message);
        renderOrdersView();
      } else {
        showToast(res.message, '⚠');
      }
    });
  });

  // Download PDF buttons in table
  container.querySelectorAll('.btn-dl-order-file').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const fileId = btn.dataset.fileId;
      const rec = await fileStorage.getFile(fileId);
      if (rec && rec.blob) {
        triggerPdfDownload(rec.blob, rec.metadata?.name || 'impressao.pdf');
      } else {
        showToast('Arquivo não encontrado no armazenamento local.', '⚠');
      }
    });
  });

  container.querySelectorAll('[data-action="edit-order"]').forEach(el => {
    el.addEventListener('click', () => openEditOrderDrawer(el.dataset.id));
  });

  container.querySelectorAll('[data-action="dup-order"]').forEach(el => {
    el.addEventListener('click', () => {
      try {
        const dup = duplicateOrder(el.dataset.id);
        renderOrdersView();
        showToast(`Pedido ${dup.number} duplicado com sucesso`);
      } catch (err) {
        showToast(err.message, '⚠');
      }
    });
  });

  container.querySelectorAll('[data-action="del-order"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const order = getOrderById(el.dataset.id);
      if (!order) return;
      if (confirm(`Tem certeza que deseja excluir o Pedido ${order.number || order.id}?`)) {
        deleteOrder(el.dataset.id);
        renderOrdersView();
        showToast('Pedido excluído');
      }
    });
  });

  container.querySelectorAll('[data-action="hide-order"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      showToast('Item ocultado da visualização.');
    });
  });
}

// ==========================================
// RENDER: PRODUTOS VIEW (FULL MODULE)
// ==========================================
function renderProductsView() {
  const container = document.getElementById('view-container');
  if (!container) return;

  const products = getProducts({ search: productSearchTerm });
  const categories = getCategories();

  container.innerHTML = `
    <div class="module-header">
      <div>
        <h2 class="module-title">Catálogo de Produtos</h2>
        <p class="module-subtitle">Configure produtos, campos de personalização, opções de alteração e regras do ateliê.</p>
      </div>
      <div class="module-actions">
        <button class="btn btn-primary" id="btn-products-new">+ Novo produto</button>
        <button class="btn" id="btn-products-bulk" style="font-weight: 600;">⚡ Personalização em massa</button>
        <button class="btn" id="btn-manage-categories">Gerenciar Categorias</button>
        <button class="btn" id="btn-products-export">Exportar CSV</button>
        <button class="btn" id="btn-products-template">Modelo CSV</button>
        <button class="btn" id="btn-products-import">Importar CSV</button>
      </div>
    </div>

    <!-- Products Tabs Submenu -->
    <div class="subtabs" id="products-subtabs">
      <button class="subtab-btn ${productsTab === 'todos' ? 'active' : ''}" data-tab="todos">Todos</button>
      <button class="subtab-btn ${productsTab === 'vitrine' ? 'active' : ''}" data-tab="vitrine">Vitrine</button>
      <button class="subtab-btn ${productsTab === 'ranking' ? 'active' : ''}" data-tab="ranking">🏆 Ranking</button>
      <button class="subtab-btn ${productsTab === 'tendencias' ? 'active' : ''}" data-tab="tendencias">📈 Tendências</button>
      <button class="subtab-btn ${productsTab === 'capacidade' ? 'active' : ''}" data-tab="capacidade">📦 Capacidade</button>
      <button class="subtab-btn ${productsTab === 'categorias' ? 'active' : ''}" data-tab="categorias">Categorias (${categories.length})</button>
    </div>

    <!-- Search & Filters -->
    <div class="filter-bar">
      <div class="search-wrapper flex-1">
        <span class="search-icon">🔍</span>
        <input class="search w-full" id="input-products-search" placeholder="Buscar por nome do produto, descrição ou categoria..." value="${escapeHtml(productSearchTerm)}" />
      </div>
      <span class="badge-count">${products.length} produtos</span>
    </div>

    <div id="products-tab-content">
      <!-- Rendered by tab -->
    </div>
  `;

  // Render tab content
  const tabContent = document.getElementById('products-tab-content');
  if (productsTab === 'todos') {
    renderProductsTable(tabContent, products, categories);
  } else if (productsTab === 'vitrine') {
    renderProductsVitrine(tabContent, products, categories);
  } else if (productsTab === 'ranking') {
    renderProductsRankingView(tabContent, { openDrawer, closeDrawer, showToast });
  } else if (productsTab === 'tendencias') {
    renderProductsTrendsView(tabContent, { openDrawer, closeDrawer, showToast });
  } else if (productsTab === 'capacidade') {
    renderProductsCapacityView(tabContent, { openDrawer, closeDrawer, showToast });
  } else if (productsTab === 'categorias') {
    renderCategoriesManagerInline(tabContent, categories);
  }


  // Bind subtabs
  container.querySelectorAll('#products-subtabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      productsTab = btn.dataset.tab;
      renderProductsView();
    });
  });

  // Search
  const searchInput = document.getElementById('input-products-search');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      productSearchTerm = e.target.value;
      renderProductsView();
    });
  }

  // Action Buttons
  document.getElementById('btn-products-new').addEventListener('click', () => openNewProductDrawer());
  
  const prodBulkBtn = document.getElementById('btn-products-bulk');
  if (prodBulkBtn) {
    prodBulkBtn.addEventListener('click', () => {
      openBulkPersonalizationModal(openDrawer, closeDrawer);
    });
  }

  document.getElementById('btn-manage-categories').addEventListener('click', () => {
    productsTab = 'categorias';
    renderProductsView();
  });

  document.getElementById('btn-products-export').addEventListener('click', () => {
    const csv = exportProductsCSV();
    downloadCSVFile(`produtos_${Date.now()}.csv`, csv);
    showToast('CSV de Produtos exportado com sucesso');
  });

  document.getElementById('btn-products-template').addEventListener('click', () => {
    const csv = exportProductsCSVTemplate();
    downloadCSVFile(`modelo_produtos.csv`, csv);
    showToast('Modelo CSV baixado');
  });

  document.getElementById('btn-products-import').addEventListener('click', () => {
    openImportCSVDrawer('produtos');
  });
}

function renderProductsTable(container, products, categories) {
  const catMap = new Map(categories.map(c => [c.id, c.name]));

  container.innerHTML = `
    <div class="list-group" style="display: flex; flex-direction: column; gap: 8px;">
      ${products.length === 0 ? `
        <div style="text-align: center; padding: 36px; color: var(--text-muted); background: var(--bg-surface); border-radius: 8px; border: 1px solid var(--border-subtle);">
          Nenhum produto cadastrado no catálogo.
        </div>
      ` : products.map(p => {
        const catName = catMap.get(p.categoryId) || 'Geral';
        const pFieldsCount = (p.personalizationFields || []).length;
        const cOptsCount = (p.changeOptions || []).length;
        const isMold = isSmartMold(p);
        const statusClass = p.status === 'ativo' ? 'status-green' : 'status-neutral';
        const statusLabel = p.status === 'ativo' ? 'Ativo' : 'Inativo';

        return `
          <div class="list-row ${statusClass}">
            <div class="list-main" style="cursor: pointer;" data-action="view-product" data-id="${p.id}">
              <div class="list-title" style="display: flex; align-items: center; gap: 8px;">
                ${escapeHtml(p.name)}
                ${isMold ? '<span class="badge-count" style="background: #e0e7ff; color: #3730a3; font-size: 10px;">✨ Molde</span>' : ''}
              </div>
              <div class="list-meta">
                ${escapeHtml(catName)} · ${pFieldsCount} campos · ${cOptsCount} opções
              </div>
            </div>
            <div style="text-align: right; min-width: 120px;">
                <span style="font-weight: 600; font-size: 13px;">${formatCurrency(p.price)}</span>
                <div style="font-size: 11px; color: var(--text-muted);">${statusLabel}</div>
            </div>
            <div class="actions">
                <button class="action-btn" data-action="intel-product" data-id="${p.id}" title="Inteligência Comercial" style="color: #4f46e5;">📊 Intel</button>
                <button class="action-btn" data-action="bulk-product" data-id="${p.id}" title="Personalização em Massa" style="color: var(--accent-primary);">⚡ Lote</button>
                <button class="action-btn" data-action="edit-product" data-id="${p.id}" title="Editar produto">✏️ Editar</button>
                <button class="action-btn" data-action="dup-product" data-id="${p.id}" title="Duplicar produto">📋 Duplicar</button>
                <button class="action-btn btn-danger" data-action="del-product" data-id="${p.id}" title="Excluir produto" style="color: #ef4444;">🗑️ Excluir</button>
                <button class="action-btn" data-action="hide-product" data-id="${p.id}" title="Ocultar produto">👁️ Ocultar</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Bind Actions
  container.querySelectorAll('[data-action="intel-product"]').forEach(el => {
    el.addEventListener('click', () => openProductIntelligenceDrawer({ productId: el.dataset.id, openDrawer, closeDrawer }));
  });

  container.querySelectorAll('[data-action="bulk-product"]').forEach(el => {
    el.addEventListener('click', () => openBulkPersonalizationModal(openDrawer, closeDrawer, el.dataset.id));
  });


  container.querySelectorAll('[data-action="view-product"]').forEach(el => {
    el.addEventListener('click', () => showProductDetailsDrawer(el.dataset.id));
  });

  container.querySelectorAll('[data-action="edit-product"]').forEach(el => {
    el.addEventListener('click', () => openEditProductDrawer(el.dataset.id));
  });

  container.querySelectorAll('[data-action="dup-product"]').forEach(el => {
    el.addEventListener('click', () => {
      try {
        const dup = duplicateProduct(el.dataset.id);
        renderProductsView();
        showToast(`Produto "${dup.name}" duplicado`);
      } catch (err) {
        showToast(err.message, '⚠');
      }
    });
  });

  container.querySelectorAll('[data-action="del-product"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = getProductById(el.dataset.id);
      if (!p) return;
      if (confirm(`Deseja excluir o produto "${p.name}"?`)) {
        const res = deleteProduct(p.id);
        if (!res.success) {
          alert(res.message);
        } else {
          renderProductsView();
          showToast(res.message);
        }
      }
    });
  });

  container.querySelectorAll('[data-action="hide-product"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      showToast('Produto ocultado da visualização.');
    });
  });
}

function renderProductsVitrine(container, products, categories) {
  const catMap = new Map(categories.map(c => [c.id, c.name]));
  
  // Calculate intelligence for tags
  let intelMap = new Map();
  try {
    const intel = calculateProductIntelligence({ period: INTELLIGENCE_PERIODS.DIAS_30 });
    intel.ranking.forEach(r => intelMap.set(r.productId, r));
  } catch (err) {
    // Graceful fallback
  }

  container.innerHTML = `
    <div class="vitrine-grid">
      ${products.map(p => {
        const catName = catMap.get(p.categoryId) || 'Geral';
        const rData = intelMap.get(p.id);
        const topBadge = rData?.position === 1 ? '🏆 Mais Vendido' :
                         (rData?.marginPct >= 60 ? '💎 Alta Margem' :
                         (rData?.growthQtyPct > 20 ? '📈 Em Alta' : null));

        return `
          <div class="vitrine-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
              <div class="vitrine-tag">${escapeHtml(catName)}</div>
              ${topBadge ? `<span class="diag-badge diag-growth">${topBadge}</span>` : ''}
            </div>
            <h3 class="vitrine-title">${escapeHtml(p.name)}</h3>
            <p class="vitrine-desc">${escapeHtml(p.description || 'Produto personalizado com acabamento profissional.')}</p>
            <div class="vitrine-meta">
              <span class="vitrine-price">${formatCurrency(p.price)}</span>
              <span class="vitrine-time">⏱ ${p.productionTime || 1} dias</span>
            </div>
            <div class="vitrine-footer" style="display: flex; gap: 6px;">
              <button class="btn btn-primary" style="flex: 1;" data-action="order-from-vitrine" data-id="${p.id}">
                + Criar Pedido
              </button>
              <button class="btn" data-action="intel-from-vitrine" data-id="${p.id}" title="Inteligência Comercial" style="padding: 6px 10px;">
                📊
              </button>
              <button class="btn" data-action="bulk-from-vitrine" data-id="${p.id}" title="Personalização em Massa" style="font-weight: 600;">
                ⚡ Lote
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  container.querySelectorAll('[data-action="order-from-vitrine"]').forEach(btn => {
    btn.addEventListener('click', () => {
      openNewOrderDrawer({ productId: btn.dataset.id });
    });
  });

  container.querySelectorAll('[data-action="intel-from-vitrine"]').forEach(btn => {
    btn.addEventListener('click', () => {
      openProductIntelligenceDrawer({ productId: btn.dataset.id, openDrawer, closeDrawer });
    });
  });

  container.querySelectorAll('[data-action="bulk-from-vitrine"]').forEach(btn => {
    btn.addEventListener('click', () => {
      openBulkPersonalizationModal(openDrawer, closeDrawer, btn.dataset.id);
    });
  });
}

function renderCategoriesManagerInline(container, categories) {
  container.innerHTML = `
    <div class="panel" style="margin-top: 12px; background: transparent; border: none; box-shadow: none; padding: 0;">
      <div class="panel-header" style="margin-bottom: 12px; padding: 0;">
        <h3 class="panel-title">Categorias Cadastradas</h3>
        <button class="btn btn-primary" id="btn-add-category">+ Nova Categoria</button>
      </div>
      <div class="list-group" style="display: flex; flex-direction: column; gap: 8px;">
            ${categories.map(c => {
              const count = getProductCountForCategory(c.id);
              return `
                <div class="list-row status-neutral">
                  <div class="list-main" style="cursor: pointer;" data-action="edit-cat" data-id="${c.id}">
                    <div class="list-title" style="display: flex; align-items: center; gap: 8px;">
                      ${escapeHtml(c.name)}
                    </div>
                    <div class="list-meta">
                      ${escapeHtml(c.description || 'Nenhuma descrição.')}
                    </div>
                  </div>
                  <div style="text-align: right; min-width: 120px;">
                    <span class="badge-count">${count} produtos</span>
                  </div>
                  <div class="actions">
                    <button class="action-btn" data-action="edit-cat" data-id="${c.id}">✏️ Editar</button>
                    <button class="action-btn" data-action="del-cat" data-id="${c.id}" style="color: #ef4444;">🗑️ Excluir</button>
                  </div>
                </div>
              `;
            }).join('')}
      </div>
    </div>
  `;

  document.getElementById('btn-add-category').addEventListener('click', () => {
    openCategoryEditDrawer();
  });

  container.querySelectorAll('[data-action="edit-cat"]').forEach(btn => {
    btn.addEventListener('click', () => {
      openCategoryEditDrawer(btn.dataset.id);
    });
  });

  container.querySelectorAll('[data-action="del-cat"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const res = deleteCategory(btn.dataset.id);
      if (!res.success) {
        alert(res.message);
      } else {
        showToast(res.message);
        renderProductsView();
      }
    });
  });
}

// ==========================================
// DRAWERS: ORDER DETAILS & EDIT/NEW
// ==========================================
function showOrderDetailsDrawer(orderId) {
  const order = getOrderById(orderId);
  if (!order) {
    showToast('Pedido não encontrado', '⚠');
    return;
  }

  const statusDef = ORDER_STATUS_MAP[order.status] || ORDER_STATUS_MAP.yellow;
  const snap = order.productSnapshot || {};

  const pFields = snap.personalizationFields || [];
  const cOpts = snap.changeOptions || [];
  const pValues = order.personalization || {};
  const cValues = order.changeOptions || {};

  const contentHtml = `
    <div class="drawer-detail-section">
      <div class="detail-badge-row">
        <span class="status-pill status-${statusDef.colorClass || order.status}">
          ${escapeHtml(order.statusLabel || statusDef.label)}
        </span>
        <span class="badge-count">Criado em: ${order.orderDate || '--/--/----'}</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 700; margin: 12px 0 4px 0;">Pedido ${order.number || order.id}</h2>
      <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 16px;">
        Item: <b>${escapeHtml(order.productTitle || 'Item')}</b> · Quantidade: <b>${order.qty} un</b>
      </div>
    </div>

    <!-- Production Stage Timeline Stepper (Etapa 4) -->
    ${renderTimelineStepperHtml(order)}

    <!-- Production Operational Controls & Action Box (Etapa 4) -->
    ${renderProductionOpsBoxHtml(order)}

    <div class="drawer-detail-section">
      <h4 class="drawer-subtitle">Dados do Cliente</h4>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Nome do Cliente</span>
          <span class="detail-val">${escapeHtml(order.customer || '—')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Data de Entrega</span>
          <span class="detail-val"><b>${order.deliveryDate || '--/--/----'}</b></span>
        </div>
      </div>
    </div>

    <div class="drawer-detail-section">
      <h4 class="drawer-subtitle">Personalização do Pedido</h4>
      ${pFields.length === 0 && Object.keys(pValues).length === 0 ? `
        <div class="text-muted" style="font-size: 13px;">Nenhum campo de texto personalizado.</div>
      ` : `
        <div class="detail-grid">
          ${pFields.map(f => `
            <div class="detail-item">
              <span class="detail-label">${escapeHtml(f.name)}</span>
              <span class="detail-val">${escapeHtml(pValues[f.id] || '—')}</span>
            </div>
          `).join('')}
          ${Object.entries(pValues).filter(([k]) => !pFields.some(f => f.id === k)).map(([k, v]) => `
            <div class="detail-item">
              <span class="detail-label">${escapeHtml(k)}</span>
              <span class="detail-val">${escapeHtml(v || '—')}</span>
            </div>
          `).join('')}
        </div>
      `}
    </div>

    <div class="drawer-detail-section">
      <h4 class="drawer-subtitle">Opções de Alteração</h4>
      ${cOpts.length === 0 && Object.keys(cValues).length === 0 ? `
        <div class="text-muted" style="font-size: 13px;">Nenhuma opção de acabamento selecionada.</div>
      ` : `
        <div class="detail-grid">
          ${cOpts.map(opt => `
            <div class="detail-item">
              <span class="detail-label">${escapeHtml(opt.name)}</span>
              <span class="detail-val">${escapeHtml(cValues[opt.id] || '—')}</span>
            </div>
          `).join('')}
          ${Object.entries(cValues).filter(([k]) => !cOpts.some(o => o.id === k)).map(([k, v]) => `
            <div class="detail-item">
              <span class="detail-label">${escapeHtml(k)}</span>
              <span class="detail-val">${escapeHtml(v || '—')}</span>
            </div>
          `).join('')}
        </div>
      `}
    </div>

    ${order.notes ? `
      <div class="drawer-detail-section">
        <h4 class="drawer-subtitle">Observações do Pedido</h4>
        <p style="font-size: 13px; color: var(--text-secondary); background: var(--bg-surface-raised); padding: 10px; border-radius: 6px;">
          ${escapeHtml(order.notes)}
        </p>
      </div>
    ` : ''}

    <!-- Motor Profissional de PDF & Arquivos Gerados (Etapa 3) -->
    <div class="drawer-detail-section" style="background: var(--bg-surface-raised); border: 1px solid var(--border-strong); border-radius: 8px; padding: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div>
          <h4 class="drawer-subtitle" style="margin: 0; color: var(--accent-primary);">📄 Motor Profissional de PDF</h4>
          <span style="font-size: 11px; color: var(--text-muted);">PDF vetorial de alta resolução pronto para impressão</span>
        </div>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-sm" id="btn-view-order-mold" style="font-size: 11px;">👁 Ver Gabarito</button>
          <button class="btn btn-sm btn-primary" id="btn-generate-order-pdf" style="font-size: 11px;">🚀 Gerar PDF</button>
        </div>
      </div>

      <div id="order-mold-preview-box" style="display: none; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; margin-bottom: 10px; text-align: center;"></div>

      <div id="order-pdf-feedback" style="display: none; margin-bottom: 8px; font-size: 11px;"></div>

      <div style="margin-top: 8px;">
        <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">Arquivos Gerados deste Pedido:</span>
        <div id="order-generated-files-list" style="margin-top: 6px;">
          ${(order.generatedFiles || []).length === 0 ? `
            <div style="font-size: 11px; color: var(--text-muted); font-style: italic;">
              Nenhum PDF gerado ainda. Clique em "Gerar PDF" para produzir o arquivo vetorial final.
            </div>
          ` : (order.generatedFiles || []).map((file, idx) => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 6px 10px; margin-bottom: 4px; font-size: 11px;">
              <div>
                <b>${idx + 1}.</b> 📄 ${escapeHtml(file.fileName)}
                <span style="color: var(--text-muted); font-size: 10px;">(${file.size ? (file.size / 1024).toFixed(1) + ' KB' : 'PDF'})</span>
              </div>
              <button class="btn btn-sm btn-dl-order-file" data-file-id="${file.fileId}" style="font-size: 11px; padding: 2px 8px;">
                ⬇ Baixar
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="drawer-detail-section">
      <h4 class="drawer-subtitle">Product Snapshot (Blindagem Histórica)</h4>
      <div style="font-size: 12px; color: var(--text-muted); line-height: 1.6;">
        <div>Produto Base: <b>${escapeHtml(snap.productName || order.productTitle)}</b></div>
        <div>Versão de Configuração Utilizada: <b>v${snap.configurationVersion || 1}</b></div>
        <div>Timestamp do Snapshot: <b>${formatDateBR(snap.snapshotTimestamp)}</b></div>
        <div style="margin-top: 4px; font-style: italic;">
          🔒 Esta configuração está congelada. Alterações futuras no catálogo de produtos não alteram este pedido.
        </div>
      </div>
    </div>

    <!-- Production History Timeline (Etapa 4) -->
    ${renderProductionHistoryHtml(order)}
  `;

  const footerHtml = `
    <button class="btn" id="btn-drawer-edit-order">Editar Pedido</button>
    <button class="btn btn-primary" id="btn-drawer-close-ok">Fechar</button>
  `;

  openDrawer({
    title: `Detalhes · Pedido ${order.number || order.id}`,
    contentHtml,
    footerHtml,
    onMount: (drawer) => {
      // Bind Etapa 4 Operational Production Events
      bindProductionOpsEvents({
        drawer,
        order,
        refreshDrawer: showOrderDetailsDrawer,
        showToast,
        openDrawer,
        closeDrawer
      });

      drawer.querySelector('#btn-drawer-close-ok').addEventListener('click', closeDrawer);
      drawer.querySelector('#btn-drawer-edit-order').addEventListener('click', () => {
        closeDrawer();
        openEditOrderDrawer(order.id);
      });

      // Ver gabarito visual
      const previewBtn = drawer.querySelector('#btn-view-order-mold');
      const previewBox = drawer.querySelector('#order-mold-preview-box');
      previewBtn?.addEventListener('click', () => {
        const isShown = previewBox.style.display === 'block';
        previewBox.style.display = isShown ? 'none' : 'block';
        if (!isShown) {
          const prod = (order.productSnapshot && order.productSnapshot.productId) ? {
            ...order.productSnapshot,
            id: order.productSnapshot.productId || order.productId,
            name: order.productSnapshot.productName || order.productTitle
          } : (getProductById(order.productId) || snap);
          const textAreas = prod.editor?.textAreas || [];
          const nameVal = order.personalization?.field_nome || order.personalization?.nome || order.customer || 'Nome';
          previewBox.innerHTML = `
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">Posicionamento das Áreas no Molde:</div>
            <svg width="240" height="240" viewBox="0 0 595 842" style="border: 1px solid #cbd5e1; background: #fafaf9; border-radius: 4px;">
              <rect x="110" y="160" width="375" height="520" fill="#f5ede3" stroke="#d6c5b2" stroke-width="2" rx="4" />
              <line x1="110" y1="210" x2="485" y2="210" stroke="#c4b09b" stroke-dasharray="4,4" stroke-width="2" />
              <circle cx="200" cy="185" r="8" fill="#8c7764" />
              <circle cx="395" cy="185" r="8" fill="#8c7764" />
              ${textAreas.map(a => `
                <rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" fill="rgba(79, 70, 229, 0.15)" stroke="#4f46e5" stroke-width="2" stroke-dasharray="3,3" />
                <text x="${a.x + a.width/2}" y="${a.y + a.height/2 + 6}" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="#4338ca">${escapeHtml(nameVal)}</text>
              `).join('')}
            </svg>
          `;
        }
      });

      // Download de arquivos já gerados
      drawer.querySelectorAll('.btn-dl-order-file').forEach(btn => {
        btn.addEventListener('click', async e => {
          const fileId = e.target.dataset.fileId;
          const rec = await fileStorage.getFile(fileId);
          if (rec && rec.blob) {
            triggerPdfDownload(rec.blob, rec.metadata?.name || `pedido_${order.number}.pdf`);
          } else {
            alert('Arquivo não encontrado no armazenamento local.');
          }
        });
      });

      // Gerar PDF do Pedido
      const genBtn = drawer.querySelector('#btn-generate-order-pdf');
      const feedback = drawer.querySelector('#order-pdf-feedback');
      genBtn?.addEventListener('click', async () => {
        try {
          genBtn.disabled = true;
          genBtn.textContent = 'Gerando...';
          feedback.style.display = 'block';
          feedback.innerHTML = '<span style="color: #4f46e5;">Injetando personalização vetorial e gerando PDF...</span>';

          const prod = (order.productSnapshot && order.productSnapshot.productId) ? {
            ...order.productSnapshot,
            id: order.productSnapshot.productId || order.productId,
            name: order.productSnapshot.productName || order.productTitle
          } : (getProductById(order.productId) || {
            ...snap,
            id: order.productId,
            name: snap.productName || order.productTitle
          });

          const file = await generatePersonalizedPdf({
            product: prod,
            personalizationData: order.personalization || {},
            changeOptionsData: order.changeOptions || {},
            orderId: order.id,
            orderNumber: order.number,
            customerName: order.customer
          });

          addGeneratedFileToOrder(order.id, file);
          triggerPdfDownload(file.blob, file.fileName);

          feedback.innerHTML = `<span style="color: #059669; font-weight: 600;">✓ PDF "${escapeHtml(file.fileName)}" gerado com sucesso!</span>`;
          showToast('PDF gerado e salvo com sucesso!');

          // Atualiza gaveta após 600ms para exibir na lista
          setTimeout(() => {
            showOrderDetailsDrawer(order.id);
          }, 600);
        } catch (err) {
          genBtn.disabled = false;
          genBtn.textContent = '🚀 Gerar PDF';
          feedback.style.display = 'block';
          feedback.innerHTML = `<span style="color: #dc2626;">⚠ Erro ao gerar PDF: ${escapeHtml(err.message)}</span>`;
        }
      });
    }
  });
}

function openNewOrderDrawer(prefill = {}) {
  const products = getProducts({ status: 'ativo' });
  if (products.length === 0) {
    alert('Cadastre pelo menos um produto antes de criar um pedido.');
    return;
  }

  const defaultProd = products.find(p => p.id === prefill.productId) || products[0];

  const contentHtml = `
    <form id="form-new-order">
      <div class="form-group">
        <label class="form-label" for="inp-order-customer">Nome do Cliente *</label>
        <input class="form-input" id="inp-order-customer" required placeholder="Ex: Juliana Silva" />
      </div>

      <div class="form-group">
        <label class="form-label" for="inp-order-product">Selecionar Produto do Catálogo *</label>
        <select class="form-select" id="inp-order-product">
          ${products.map(p => `
            <option value="${p.id}" ${p.id === defaultProd.id ? 'selected' : ''}>
              ${escapeHtml(p.name)} (${formatCurrency(p.price)})
            </option>
          `).join('')}
        </select>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-group">
          <label class="form-label" for="inp-order-qty">Quantidade *</label>
          <input type="number" class="form-input" id="inp-order-qty" value="10" min="1" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="inp-order-status">Status Inicial</label>
          <select class="form-select" id="inp-order-status">
            <option value="yellow" selected>🟡 Aguardando aprovação</option>
            <option value="blue">🔵 Em produção</option>
            <option value="orange">🟠 Atenção</option>
            <option value="red">🔴 Bloqueado por material</option>
            <option value="green">🟢 Pronto</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="inp-order-delivery">Data de Entrega *</label>
        <input type="date" class="form-input" id="inp-order-delivery" required />
      </div>

      <!-- Dynamic Product Customization Fields -->
      <div id="dynamic-product-fields">
        <!-- Rendered on product select change -->
      </div>

      <div class="form-group">
        <label class="form-label" for="inp-order-notes">Observações</label>
        <textarea class="form-textarea" id="inp-order-notes" rows="2" placeholder="Instruções de envio, detalhes especiais..."></textarea>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn" id="btn-cancel-drawer">Cancelar</button>
    <button class="btn btn-primary" id="btn-submit-order">Salvar Pedido</button>
  `;

  openDrawer({
    title: 'Cadastrar Novo Pedido',
    contentHtml,
    footerHtml,
    onMount: (drawer) => {
      const prodSelect = drawer.querySelector('#inp-order-product');
      const dynamicContainer = drawer.querySelector('#dynamic-product-fields');

      // Set default delivery date to 3 days from now
      const d = new Date();
      d.setDate(d.getDate() + 3);
      drawer.querySelector('#inp-order-delivery').value = d.toISOString().split('T')[0];

      function updateDynamicFields(productId) {
        const prod = getProductById(productId);
        if (!prod) return;

        const pFields = prod.personalizationFields || [];
        const cOpts = prod.changeOptions || [];

        dynamicContainer.innerHTML = `
          <div style="margin: 14px 0; display: flex; flex-direction: column; gap: 12px;">
            <!-- Box 1: Personalização (Textos) -->
            <div style="background: rgba(219, 39, 119, 0.05); border: 1px solid rgba(219, 39, 119, 0.2); border-radius: 8px; padding: 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <h4 style="font-size: 12px; font-weight: 700; color: var(--accent-primary); text-transform: uppercase; margin: 0; display: flex; align-items: center; gap: 4px;">
                  ✍️ Personalização do Pedido (Textos)
                </h4>
                <span style="font-size: 10px; color: var(--text-muted);">Ex: Nome, Idade, Frase</span>
              </div>
              ${pFields.length === 0 ? `
                <p style="font-size: 12px; color: var(--text-muted); margin: 0;">Este produto não requer textos personalizados da cliente.</p>
              ` : pFields.map(f => `
                <div class="form-group" style="margin-bottom: 8px;">
                  <label class="form-label" for="field_${f.id}">
                    ${escapeHtml(f.name)} ${f.required ? '<span style="color: #dc2626; font-weight: 700;">*</span>' : '<span style="color: var(--text-muted); font-weight: 400; font-size: 11px;">(opcional)</span>'}
                  </label>
                  ${f.type === 'textarea' ? `
                    <textarea class="form-textarea" id="field_${f.id}" data-type="p-field" data-id="${f.id}" ${f.required ? 'data-required="true"' : ''} placeholder="${escapeHtml(f.defaultValue || 'Preencha o texto...')}" rows="2"></textarea>
                  ` : `
                    <input type="${f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}" class="form-input" id="field_${f.id}" data-type="p-field" data-id="${f.id}" ${f.required ? 'data-required="true"' : ''} value="${escapeHtml(f.defaultValue || '')}" placeholder="${escapeHtml(f.defaultValue || 'Preencha o campo...')}" />
                  `}
                </div>
              `).join('')}
            </div>

            <!-- Box 2: Opções de Alteração (Variações Físicas) -->
            <div style="background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 8px; padding: 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <h4 style="font-size: 12px; font-weight: 700; color: #4338ca; text-transform: uppercase; margin: 0; display: flex; align-items: center; gap: 4px;">
                  🎨 Opções de Alteração (Acabamentos)
                </h4>
                <span style="font-size: 10px; color: #6366f1;">Ex: Cor, Alça, Material</span>
              </div>
              ${cOpts.length === 0 ? `
                <p style="font-size: 12px; color: var(--text-muted); margin: 0;">Este produto é confeccionado em padrão único de material.</p>
              ` : cOpts.map(opt => `
                <div class="form-group" style="margin-bottom: 8px;">
                  <label class="form-label" for="opt_${opt.id}">
                    ${escapeHtml(opt.name)} ${opt.required ? '<span style="color: #dc2626; font-weight: 700;">*</span>' : ''}
                  </label>
                  <select class="form-select" id="opt_${opt.id}" data-type="c-opt" data-id="${opt.id}">
                    ${(opt.choices || []).map(choice => `
                      <option value="${escapeHtml(choice)}" ${choice === opt.defaultValue ? 'selected' : ''}>
                        ${escapeHtml(choice)}
                      </option>
                    `).join('')}
                  </select>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      prodSelect.addEventListener('change', e => {
        updateDynamicFields(e.target.value);
      });

      updateDynamicFields(prodSelect.value);

      drawer.querySelector('#btn-cancel-drawer').addEventListener('click', closeDrawer);

      drawer.querySelector('#btn-submit-order').addEventListener('click', e => {
        e.preventDefault();

        // Clear previous validation errors
        drawer.querySelectorAll('.input-invalid').forEach(el => el.classList.remove('input-invalid'));
        drawer.querySelectorAll('.field-error-msg').forEach(el => el.remove());

        let firstInvalidField = null;

        function markInvalid(inputEl, msg) {
          if (!inputEl) return;
          inputEl.classList.add('input-invalid');
          const errDiv = document.createElement('div');
          errDiv.className = 'field-error-msg';
          errDiv.innerHTML = `⚠ ${escapeHtml(msg)}`;
          inputEl.parentNode.appendChild(errDiv);
          if (!firstInvalidField) firstInvalidField = inputEl;
        }

        const customerInp = drawer.querySelector('#inp-order-customer');
        const customer = customerInp ? customerInp.value.trim() : '';
        if (!customer) {
          markInvalid(customerInp, 'O nome do cliente é obrigatório.');
        }

        const productId = prodSelect ? prodSelect.value : '';
        if (!productId) {
          markInvalid(prodSelect, 'Selecione um produto.');
        }

        const qtyInp = drawer.querySelector('#inp-order-qty');
        const qtyVal = Number(qtyInp ? qtyInp.value : 0);
        if (!qtyVal || qtyVal <= 0) {
          markInvalid(qtyInp, 'A quantidade deve ser maior que zero.');
        }

        const deliveryInp = drawer.querySelector('#inp-order-delivery');
        const deliveryDate = deliveryInp ? deliveryInp.value : '';
        if (!deliveryDate) {
          markInvalid(deliveryInp, 'A data de entrega é obrigatória.');
        }

        const status = drawer.querySelector('#inp-order-status').value;
        const notes = drawer.querySelector('#inp-order-notes').value;

        const personalization = {};
        const selectedProd = getProductById(productId);
        const reqPFields = (selectedProd?.personalizationFields || []).filter(f => f.required);

        drawer.querySelectorAll('[data-type="p-field"]').forEach(input => {
          personalization[input.dataset.id] = input.value;
          const isReq = reqPFields.some(f => f.id === input.dataset.id);
          if (isReq && (!input.value || !input.value.trim())) {
            const fDef = reqPFields.find(f => f.id === input.dataset.id);
            markInvalid(input, `O campo "${fDef?.name || 'Personalização'}" é obrigatório.`);
          }
        });

        const changeOptions = {};
        drawer.querySelectorAll('[data-type="c-opt"]').forEach(select => {
          changeOptions[select.dataset.id] = select.value;
        });

        if (firstInvalidField) {
          firstInvalidField.focus();
          firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
          showToast('Preencha os campos obrigatórios destacados em vermelho.', '⚠');
          return;
        }

        try {
          const newOrder = createOrder({
            customer,
            productId,
            qty: qtyVal,
            status,
            deliveryDate,
            notes,
            personalization,
            changeOptions
          });

          closeDrawer();
          if (currentView === 'pedidos') {
            renderOrdersView();
          } else {
            renderDashboard();
          }
          showToast(`Pedido ${newOrder.number} cadastrado com sucesso!`);
        } catch (err) {
          alert(err.message);
        }
      });
    }
  });
}

function openEditOrderDrawer(orderId) {
  const order = getOrderById(orderId);
  if (!order) return;

  const contentHtml = `
    <form id="form-edit-order">
      <div class="form-group">
        <label class="form-label">Identificação</label>
        <input class="form-input" disabled value="Pedido ${order.number || order.id} · ${escapeHtml(order.productTitle)}" />
      </div>

      <div class="form-group">
        <label class="form-label" for="inp-edit-customer">Nome do Cliente *</label>
        <input class="form-input" id="inp-edit-customer" value="${escapeHtml(order.customer || '')}" required />
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-group">
          <label class="form-label" for="inp-edit-qty">Quantidade *</label>
          <input type="number" class="form-input" id="inp-edit-qty" value="${order.qty || 1}" min="1" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="inp-edit-status">Status</label>
          <select class="form-select" id="inp-edit-status">
            <option value="yellow" ${order.status === 'yellow' ? 'selected' : ''}>🟡 Aguardando aprovação</option>
            <option value="blue" ${order.status === 'blue' ? 'selected' : ''}>🔵 Em produção</option>
            <option value="orange" ${order.status === 'orange' ? 'selected' : ''}>🟠 Atenção / Urgente</option>
            <option value="red" ${order.status === 'red' ? 'selected' : ''}>🔴 Bloqueado por material</option>
            <option value="green" ${order.status === 'green' ? 'selected' : ''}>🟢 Pronto</option>
            <option value="neutral" ${order.status === 'neutral' ? 'selected' : ''}>⚪ Entregue / Concluído</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="inp-edit-delivery">Data de Entrega</label>
        <input type="date" class="form-input" id="inp-edit-delivery" value="${parseDateBRToISO(order.deliveryDate)}" />
      </div>

      <!-- Campos de Personalização e Opções de Alteração do Pedido (Snapshot) -->
      ${(() => {
        const snap = order.productSnapshot || {};
        const pFields = snap.personalizationFields || (getProductById(order.productId)?.personalizationFields) || [];
        const cOpts = snap.changeOptions || (getProductById(order.productId)?.changeOptions) || [];
        const persData = order.personalization || {};
        const optsData = order.changeOptions || {};

        if (pFields.length === 0 && cOpts.length === 0) return '';

        return `
          <div style="background: var(--bg-surface-raised); padding: 12px; border-radius: 8px; margin: 12px 0; border: 1px solid var(--border-subtle);">
            ${pFields.length > 0 ? `
              <h4 style="font-size: 12px; font-weight: 700; margin-bottom: 8px; color: var(--accent-primary); text-transform: uppercase;">
                Personalização do Pedido
              </h4>
              ${pFields.map(f => {
                const currentVal = persData[f.id] !== undefined ? persData[f.id] : (f.defaultValue || '');
                return `
                  <div class="form-group" style="margin-bottom: 8px;">
                    <label class="form-label" for="edit_field_${f.id}">
                      ${escapeHtml(f.name)} ${f.required ? '*' : ''}
                    </label>
                    ${f.type === 'textarea' ? `
                      <textarea class="form-textarea" id="edit_field_${f.id}" data-type="edit-p-field" data-id="${f.id}" ${f.required ? 'required' : ''}>${escapeHtml(String(currentVal))}</textarea>
                    ` : `
                      <input type="${f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}" class="form-input" id="edit_field_${f.id}" data-type="edit-p-field" data-id="${f.id}" ${f.required ? 'required' : ''} value="${escapeHtml(String(currentVal))}" />
                    `}
                  </div>
                `;
              }).join('')}
            ` : ''}

            ${cOpts.length > 0 ? `
              <h4 style="font-size: 12px; font-weight: 700; margin: ${pFields.length > 0 ? '12px' : '0'} 0 8px 0; color: var(--accent-primary); text-transform: uppercase;">
                Opções de Alteração
              </h4>
              ${cOpts.map(opt => {
                const currentVal = optsData[opt.id] !== undefined ? optsData[opt.id] : (opt.defaultValue || '');
                return `
                  <div class="form-group" style="margin-bottom: 8px;">
                    <label class="form-label" for="edit_opt_${opt.id}">
                      ${escapeHtml(opt.name)} ${opt.required ? '*' : ''}
                    </label>
                    <select class="form-select" id="edit_opt_${opt.id}" data-type="edit-c-opt" data-id="${opt.id}">
                      ${(opt.choices || []).map(choice => `
                        <option value="${escapeHtml(choice)}" ${choice === currentVal ? 'selected' : ''}>
                          ${escapeHtml(choice)}
                        </option>
                      `).join('')}
                    </select>
                  </div>
                `;
              }).join('')}
            ` : ''}
          </div>
        `;
      })()}

      <div class="form-group">
        <label class="form-label" for="inp-edit-notes">Observações</label>
        <textarea class="form-textarea" id="inp-edit-notes" rows="3">${escapeHtml(order.notes || '')}</textarea>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn" id="btn-cancel-edit-order">Cancelar</button>
    <button class="btn btn-primary" id="btn-save-edit-order">Salvar Alterações</button>
  `;

  openDrawer({
    title: `Editar Pedido ${order.number || order.id}`,
    contentHtml,
    footerHtml,
    onMount: (drawer) => {
      drawer.querySelector('#btn-cancel-edit-order').addEventListener('click', closeDrawer);
      drawer.querySelector('#btn-save-edit-order').addEventListener('click', e => {
        e.preventDefault();

        // Clear previous validation errors
        drawer.querySelectorAll('.input-invalid').forEach(el => el.classList.remove('input-invalid'));
        drawer.querySelectorAll('.field-error-msg').forEach(el => el.remove());

        let firstInvalidField = null;

        function markInvalid(inputEl, msg) {
          if (!inputEl) return;
          inputEl.classList.add('input-invalid');
          const errDiv = document.createElement('div');
          errDiv.className = 'field-error-msg';
          errDiv.innerHTML = `⚠ ${escapeHtml(msg)}`;
          inputEl.parentNode.appendChild(errDiv);
          if (!firstInvalidField) firstInvalidField = inputEl;
        }

        const customerInp = drawer.querySelector('#inp-edit-customer');
        const customer = customerInp ? customerInp.value.trim() : '';
        if (!customer) {
          markInvalid(customerInp, 'O nome do cliente é obrigatório.');
        }

        const qtyInp = drawer.querySelector('#inp-edit-qty');
        const qtyVal = Number(qtyInp ? qtyInp.value : 0);
        if (!qtyVal || qtyVal <= 0) {
          markInvalid(qtyInp, 'A quantidade deve ser maior que zero.');
        }

        const status = drawer.querySelector('#inp-edit-status').value;
        const deliveryDate = drawer.querySelector('#inp-edit-delivery').value;
        const notes = drawer.querySelector('#inp-edit-notes').value;

        const personalization = {};
        const snap = order.productSnapshot || {};
        const prod = getProductById(order.productId);
        const pFields = snap.personalizationFields || (prod?.personalizationFields) || [];
        const reqPFields = pFields.filter(f => f.required);

        drawer.querySelectorAll('[data-type="edit-p-field"]').forEach(input => {
          personalization[input.dataset.id] = input.value;
          const isReq = reqPFields.some(f => f.id === input.dataset.id);
          if (isReq && (!input.value || !input.value.trim())) {
            const fDef = reqPFields.find(f => f.id === input.dataset.id);
            markInvalid(input, `O campo "${fDef?.name || 'Personalização'}" é obrigatório.`);
          }
        });

        const changeOptions = {};
        drawer.querySelectorAll('[data-type="edit-c-opt"]').forEach(select => {
          changeOptions[select.dataset.id] = select.value;
        });

        if (firstInvalidField) {
          firstInvalidField.focus();
          firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
          showToast('Preencha os campos obrigatórios destacados em vermelho.', '⚠');
          return;
        }

        try {
          updateOrder(order.id, {
            customer,
            qty: qtyVal,
            status,
            deliveryDate,
            notes,
            personalization,
            changeOptions
          });
          closeDrawer();
          if (currentView === 'pedidos') {
            renderOrdersView();
          } else {
            renderDashboard();
          }
          showToast(`Pedido ${order.number || order.id} atualizado com sucesso`);
        } catch (err) {
          alert(err.message);
        }
      });
    }
  });
}

// ==========================================
// DRAWERS: PRODUCT DETAILS & EDIT/NEW
// ==========================================
function showProductDetailsDrawer(productId) {
  const p = getProductById(productId);
  if (!p) return;

  const categories = getCategories();
  const cat = categories.find(c => c.id === p.categoryId);

  const contentHtml = `
    <div class="drawer-detail-section">
      <span class="badge-count">${cat ? escapeHtml(cat.name) : 'Geral'}</span>
      <h2 style="font-size: 20px; font-weight: 700; margin: 8px 0 4px 0;">${escapeHtml(p.name)}</h2>
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
        ${escapeHtml(p.description || 'Sem descrição cadastrada.')}
      </p>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Preço de Venda</span>
          <span class="detail-val"><b>${formatCurrency(p.price)}</b></span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Custo Base Estimado</span>
          <span class="detail-val">${formatCurrency(p.cost)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Tempo de Produção</span>
          <span class="detail-val">${p.productionTime || 1} dias</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Versão de Configuração</span>
          <span class="detail-val">v${p.configurationVersion || 1}</span>
        </div>
      </div>
    </div>

    <div class="drawer-detail-section">
      <h4 class="drawer-subtitle">Campos de Personalização (${(p.personalizationFields || []).length})</h4>
      ${(p.personalizationFields || []).length === 0 ? `
        <div style="font-size: 13px; color: var(--text-muted);">Nenhum campo configurado.</div>
      ` : `
        <div class="detail-grid">
          ${p.personalizationFields.map(f => `
            <div class="detail-item">
              <span class="detail-label">${escapeHtml(f.name)} (${f.type})</span>
              <span class="detail-val">${f.required ? 'Obrigatório' : 'Opcional'}</span>
            </div>
          `).join('')}
        </div>
      `}
    </div>

    <div class="drawer-detail-section">
      <h4 class="drawer-subtitle">Opções de Alteração (${(p.changeOptions || []).length})</h4>
      ${(p.changeOptions || []).length === 0 ? `
        <div style="font-size: 13px; color: var(--text-muted);">Nenhuma opção configurada.</div>
      ` : `
        <div class="detail-grid">
          ${p.changeOptions.map(opt => `
            <div class="detail-item">
              <span class="detail-label">${escapeHtml(opt.name)}</span>
              <span class="detail-val">${(opt.choices || []).join(', ')}</span>
            </div>
          `).join('')}
        </div>
      `}
    </div>

    <div class="drawer-detail-section">
      <h4 class="drawer-subtitle">Estrutura do Molde Inteligente</h4>
      <div style="font-size: 12px; color: var(--text-muted); line-height: 1.6;">
        <div>Áreas de Texto vinculadas: <b>${(p.editor?.textAreas || []).length}</b></div>
        <div>Áreas de Cor / Elemento: <b>${((p.editor?.elementAreas || []).length + (p.editor?.colorAreas || []).length)}</b></div>
        <div>Gabarito Base PDF: <b>${p.basePdfMetadata ? escapeHtml(p.basePdfMetadata.name) : 'Gabarito Padrão'}</b></div>
      </div>
    </div>
  `;

  const footerHtml = `
    <button class="btn" id="btn-prod-intel-drawer" style="color: #4f46e5; font-weight: 600;">📊 Inteligência Comercial</button>
    <button class="btn" id="btn-prod-bulk-drawer" style="font-weight: 600;">⚡ Personalização em Massa</button>
    <button class="btn" id="btn-edit-prod-drawer">⚙ Configurar Molde</button>
    <button class="btn btn-primary" id="btn-close-prod-drawer">Fechar</button>
  `;

  openDrawer({
    title: `Detalhes do Produto · ${p.name}`,
    contentHtml,
    footerHtml,
    onMount: (drawer) => {
      drawer.querySelector('#btn-close-prod-drawer').addEventListener('click', closeDrawer);
      drawer.querySelector('#btn-prod-intel-drawer').addEventListener('click', () => {
        closeDrawer();
        openProductIntelligenceDrawer({ productId: p.id, openDrawer, closeDrawer });
      });
      drawer.querySelector('#btn-prod-bulk-drawer').addEventListener('click', () => {
        closeDrawer();
        openBulkPersonalizationModal(openDrawer, closeDrawer, p.id);
      });
      drawer.querySelector('#btn-edit-prod-drawer').addEventListener('click', () => {
        closeDrawer();
        openEditProductDrawer(p.id);
      });
    }
  });

}

function openNewProductDrawer() {
  openProductConfigDrawer({
    productId: null,
    openDrawerFn: openDrawer,
    closeDrawerFn: closeDrawer,
    onSaved: () => renderProductsView()
  });
}

function openEditProductDrawer(productId) {
  openProductConfigDrawer({
    productId,
    openDrawerFn: openDrawer,
    closeDrawerFn: closeDrawer,
    onSaved: () => renderProductsView()
  });
}

function openCategoryEditDrawer(catId = null) {
  const isEdit = Boolean(catId);
  const cat = isEdit ? getCategories().find(c => c.id === catId) : null;

  const contentHtml = `
    <form id="form-cat">
      <div class="form-group">
        <label class="form-label" for="inp-cat-name">Nome da Categoria *</label>
        <input class="form-input" id="inp-cat-name" value="${cat ? escapeHtml(cat.name) : ''}" required placeholder="Ex: Topos de Bolo" />
      </div>
      <div class="form-group">
        <label class="form-label" for="inp-cat-desc">Descrição</label>
        <textarea class="form-textarea" id="inp-cat-desc" rows="2" placeholder="Finalidade ou tipo de produtos...">${cat ? escapeHtml(cat.description || '') : ''}</textarea>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn" id="btn-cancel-cat">Cancelar</button>
    <button class="btn btn-primary" id="btn-save-cat">${isEdit ? 'Salvar Alterações' : 'Criar Categoria'}</button>
  `;

  openDrawer({
    title: isEdit ? `Editar Categoria · ${cat.name}` : 'Nova Categoria',
    contentHtml,
    footerHtml,
    onMount: (drawer) => {
      drawer.querySelector('#btn-cancel-cat').addEventListener('click', closeDrawer);
      drawer.querySelector('#btn-save-cat').addEventListener('click', e => {
        e.preventDefault();
        try {
          const name = drawer.querySelector('#inp-cat-name').value;
          const description = drawer.querySelector('#inp-cat-desc').value;

          if (isEdit) {
            updateCategory(catId, { name, description });
            showToast('Categoria atualizada com sucesso');
          } else {
            createCategory({ name, description });
            showToast('Categoria criada com sucesso');
          }

          closeDrawer();
          renderProductsView();
        } catch (err) {
          alert(err.message);
        }
      });
    }
  });
}

// ==========================================
// DRAWER: CSV IMPORT WITH PREVIEW & VALIDATION
// ==========================================
function openImportCSVDrawer(type = 'pedidos') {
  const typeLabel = type === 'pedidos' ? 'Pedidos' : 'Produtos';

  const contentHtml = `
    <div>
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
        Selecione ou cole o conteúdo do arquivo CSV para importar ${typeLabel.toLowerCase()} em lote.
      </p>

      <div class="file-drop-area" id="csv-drop-area">
        <div style="font-size: 24px; margin-bottom: 8px;">📄</div>
        <div style="font-weight: 600; font-size: 13px;">Arraste e solte o arquivo .CSV aqui</div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">ou clique para selecionar do seu computador</div>
        <input type="file" id="csv-file-input" accept=".csv,text/csv" style="display: none;" />
      </div>

      <div class="form-group" style="margin-top: 14px;">
        <label class="form-label" for="csv-raw-textarea">Ou cole o texto CSV diretamente:</label>
        <textarea class="form-textarea" id="csv-raw-textarea" rows="5" placeholder="cliente;produto;quantidade;data_entrega..."></textarea>
      </div>

      <div id="csv-validation-box" style="display: none; margin-top: 12px;"></div>
    </div>
  `;

  const footerHtml = `
    <button class="btn" id="btn-cancel-csv">Cancelar</button>
    <button class="btn btn-primary" id="btn-process-csv">Processar e Importar</button>
  `;

  openDrawer({
    title: `Importar CSV de ${typeLabel}`,
    contentHtml,
    footerHtml,
    onMount: (drawer) => {
      const dropArea = drawer.querySelector('#csv-drop-area');
      const fileInput = drawer.querySelector('#csv-file-input');
      const rawTextarea = drawer.querySelector('#csv-raw-textarea');
      const validationBox = drawer.querySelector('#csv-validation-box');

      dropArea.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = ev => {
            rawTextarea.value = ev.target.result;
          };
          reader.readAsText(file);
        }
      });

      drawer.querySelector('#btn-cancel-csv').addEventListener('click', closeDrawer);

      drawer.querySelector('#btn-process-csv').addEventListener('click', () => {
        const csvContent = rawTextarea.value.trim();
        if (!csvContent) {
          alert('Informe ou carregue o conteúdo CSV.');
          return;
        }

        try {
          let result;
          if (type === 'pedidos') {
            result = importOrdersCSV(csvContent);
          } else {
            result = importProductsCSV(csvContent);
          }

          if (!result.success) {
            validationBox.style.display = 'block';
            validationBox.innerHTML = `
              <div class="alert-card alert-red">
                <b>Erros na validação do CSV:</b>
                <ul style="margin-top: 6px; padding-left: 16px; font-size: 12px;">
                  ${result.errors.map(err => `<li>${escapeHtml(err)}</li>`).join('')}
                </ul>
              </div>
            `;
            return;
          }

          closeDrawer();
          if (type === 'pedidos') {
            if (currentView === 'pedidos') renderOrdersView();
            else renderDashboard();
          } else {
            renderProductsView();
          }

          showToast(`${result.count} ${typeLabel.toLowerCase()} importados com sucesso!`);
        } catch (err) {
          validationBox.style.display = 'block';
          validationBox.innerHTML = `
            <div class="alert-card alert-red">
              ${escapeHtml(err.message)}
            </div>
          `;
        }
      });
    }
  });
}

function downloadCSVFile(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ==========================================
// RENDER: ESTOQUE, FINANCEIRO & AJUSTES
// ==========================================
function renderStockView() {
  renderStockModule();
}

function renderFinanceView() {
  renderFinanceModule();
}

function renderSettingsView() {
  const container = document.getElementById('view-container');
  if (!container) return;

  const settings = loadSettings();
  const rules = getAutomationRules();
  const logs = getAutomationLogs();
  const notifications = getNotifications();

  container.innerHTML = `
    <div class="module-header">
      <div>
        <h2 class="module-title">⚙ Ajustes & Automação Operacional</h2>
        <p class="module-subtitle">Preferências do ateliê, regras automáticas (Evento → Condição → Ação) e auditoria.</p>
      </div>
    </div>

    <div style="display: flex; gap: 8px; margin-top: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
      <button class="btn btn-sm btn-primary" id="set-tab-prefs" style="font-size: 12px;">⚙ Preferências</button>
      <button class="btn btn-sm" id="set-tab-automations" style="font-size: 12px; background: #ffffff;">⚡ Automações (${rules.filter(r => r.active).length} ativas)</button>
      <button class="btn btn-sm" id="set-tab-logs" style="font-size: 12px; background: #ffffff;">📋 Auditoria e Logs (${logs.length})</button>
      <button class="btn btn-sm" id="set-tab-notifs" style="font-size: 12px; background: #ffffff;">🔔 Alertas (${notifications.filter(n => !n.read).length})</button>
    </div>

    <!-- TAB 1: PREFERÊNCIAS -->
    <div id="settings-content-prefs" class="panel" style="margin-top: 16px; max-width: 650px;">
      <form id="form-settings">
        <div class="form-group">
          <label class="form-label" for="inp-set-name">Nome do Ateliê</label>
          <input class="form-input" id="inp-set-name" value="${escapeHtml(settings.atelierName)}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="inp-set-owner">Responsável / Proprietário</label>
          <input class="form-input" id="inp-set-owner" value="${escapeHtml(settings.ownerName)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Persistência Operacional</label>
          <div style="font-size: 12px; color: var(--text-muted); background: var(--bg-surface-raised); padding: 12px; border-radius: 6px;">
            ✓ Armazenamento local versionado ativo (<code>papermax.*.v1</code>)<br />
            ✓ Autosave ativo com debounce de 350ms<br />
            ✓ FileStorage IndexedDB preparado para motor PDF
          </div>
        </div>
        <button class="btn btn-primary" id="btn-save-settings" style="margin-top: 12px;">Salvar Preferências</button>
      </form>

      <!-- Backup e Segurança dos Dados -->
      <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-color);">
        <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 6px;">💾 Backup e segurança dos dados</h3>
        <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">
          Exporte todos os dados operacionais em formato JSON seguro ou restaure um backup anterior caso necessário.
        </p>
        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
          Último backup realizado: <b>${getLastBackupTimestamp() ? new Date(getLastBackupTimestamp()).toLocaleString('pt-BR') : 'Nenhum backup recente registrado'}</b>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-primary" id="btn-export-backup" style="font-size: 12px;">⬇ Exportar backup</button>
          <button class="btn btn-secondary" id="btn-import-backup-trigger" style="font-size: 12px;">⬆ Restaurar backup</button>
          <input type="file" id="inp-restore-file" accept=".json" style="display: none;" />
        </div>
      </div>
    </div>

    <!-- TAB 2: AUTOMAÇÕES -->
    <div id="settings-content-automations" class="panel" style="margin-top: 16px; display: none; max-width: 850px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="font-size: 14px; font-weight: 600;">Regras de Automação Operacional (Evento → Condição → Ação)</h3>
        <span style="font-size: 11px; color: var(--text-muted);">“O PAPER MAX trabalha. Você acompanha.”</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${rules.map(rule => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-surface-raised); border-radius: 8px; border: 1px solid var(--border-color);">
            <div>
              <div style="font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                <span>${rule.active ? '🟢' : '⚪'}</span> ${escapeHtml(rule.name)}
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                <b>Evento:</b> ${rule.event} | <b>Condição:</b> ${rule.condition} | <b>Ação:</b> ${rule.action}
              </div>
              <div style="font-size: 11px; color: var(--text-main); margin-top: 4px;">
                ${escapeHtml(rule.description || '')}
              </div>
            </div>
            <div>
              <label class="switch" style="cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600;">
                <input type="checkbox" data-rule-toggle="${rule.id}" ${rule.active ? 'checked' : ''} style="cursor: pointer;" />
                <span>${rule.active ? 'Ativa' : 'Inativa'}</span>
              </label>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- TAB 3: LOGS DE AUDITORIA -->
    <div id="settings-content-logs" class="panel" style="margin-top: 16px; display: none; max-width: 900px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="font-size: 14px; font-weight: 600;">Histórico Centralizado de Execuções e Auditoria</h3>
        <span style="font-size: 11px; color: var(--text-muted);">Registro automático vs intervenção manual</span>
      </div>
      <div style="max-height: 450px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; background: #ffffff;">
        <table class="table" style="font-size: 12px; width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: var(--bg-surface-raised); text-align: left; border-bottom: 1px solid var(--border-color);">
              <th style="padding: 8px;">Data / Hora</th>
              <th style="padding: 8px;">Regra / Evento</th>
              <th style="padding: 8px;">Pedido</th>
              <th style="padding: 8px;">Resultado</th>
              <th style="padding: 8px;">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            ${logs.length === 0 ? '<tr><td colspan="5" style="padding: 16px; text-align: center; color: var(--text-muted);">Nenhum log de automação registrado ainda.</td></tr>' : logs.map(log => `
              <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 8px; white-space: nowrap;">${formatDateBR(log.timestamp)}</td>
                <td style="padding: 8px;"><b>${escapeHtml(log.ruleName)}</b><br><span style="font-size: 10px; color: var(--text-muted);">${log.event}</span></td>
                <td style="padding: 8px;">${log.orderId}</td>
                <td style="padding: 8px;">
                  <span class="badge ${log.result === 'Executada' ? 'badge-success' : log.result === 'Falhou' ? 'badge-danger' : 'badge-warning'}" style="font-size: 10px;">
                    ${log.result}
                  </span>
                </td>
                <td style="padding: 8px; font-size: 11px; color: var(--text-muted);">${escapeHtml(log.details || log.error || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 4: NOTIFICAÇÕES INTERNAS -->
    <div id="settings-content-notifs" class="panel" style="margin-top: 16px; display: none; max-width: 800px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="font-size: 14px; font-weight: 600;">Central de Notificações Operacionais Internas</h3>
        <button class="btn btn-sm" id="btn-clear-notifs" style="font-size: 11px; background: #ffffff;">Limpar Notificações</button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px; max-height: 450px; overflow-y: auto;">
        ${notifications.length === 0 ? '<div style="padding: 24px; text-align: center; color: var(--text-muted); background: var(--bg-surface-raised); border-radius: 8px;">Nenhuma notificação interna no momento. Tudo operando perfeitamente.</div>' : notifications.map(notif => `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 12px; background: ${notif.read ? 'var(--bg-surface-raised)' : '#eff6ff'}; border-radius: 8px; border: 1px solid ${notif.read ? 'var(--border-color)' : '#bfdbfe'};">
            <div>
              <div style="font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                <span>${notif.severity === 'success' ? '🟢' : notif.severity === 'warning' ? '🟠' : notif.severity === 'error' ? '🔴' : '🔵'}</span>
                ${escapeHtml(notif.title)}
              </div>
              <div style="font-size: 12px; color: var(--text-main); margin-top: 4px;">
                ${escapeHtml(notif.message)}
              </div>
              <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">
                ${formatDateBR(notif.timestamp)} ${notif.orderId ? `• Pedido: ${notif.orderId}` : ''}
              </div>
            </div>
            <div>
              ${!notif.read ? `<button class="btn btn-sm" data-notif-read="${notif.id}" style="font-size: 11px; background: #ffffff;">Marcar Lida</button>` : '<span style="font-size: 11px; color: var(--text-muted);">Lida</span>'}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Bind Tab Switching
  const tabPrefs = container.querySelector('#set-tab-prefs');
  const tabAutos = container.querySelector('#set-tab-automations');
  const tabLogs = container.querySelector('#set-tab-logs');
  const tabNotifs = container.querySelector('#set-tab-notifs');

  const contentPrefs = container.querySelector('#settings-content-prefs');
  const contentAutos = container.querySelector('#settings-content-automations');
  const contentLogs = container.querySelector('#settings-content-logs');
  const contentNotifs = container.querySelector('#settings-content-notifs');

  if (tabPrefs && tabAutos && tabLogs && tabNotifs && contentPrefs && contentAutos && contentLogs && contentNotifs) {
    function switchTab(tab) {
      tabPrefs.className = `btn btn-sm ${tab === 'prefs' ? 'btn-primary' : ''}`;
      if (tab !== 'prefs') tabPrefs.style.background = '#ffffff';

      tabAutos.className = `btn btn-sm ${tab === 'autos' ? 'btn-primary' : ''}`;
      if (tab !== 'autos') tabAutos.style.background = '#ffffff';

      tabLogs.className = `btn btn-sm ${tab === 'logs' ? 'btn-primary' : ''}`;
      if (tab !== 'logs') tabLogs.style.background = '#ffffff';

      tabNotifs.className = `btn btn-sm ${tab === 'notifs' ? 'btn-primary' : ''}`;
      if (tab !== 'notifs') tabNotifs.style.background = '#ffffff';

      contentPrefs.style.display = tab === 'prefs' ? 'block' : 'none';
      contentAutos.style.display = tab === 'autos' ? 'block' : 'none';
      contentLogs.style.display = tab === 'logs' ? 'block' : 'none';
      contentNotifs.style.display = tab === 'notifs' ? 'block' : 'none';
    }

    tabPrefs.onclick = () => switchTab('prefs');
    tabAutos.onclick = () => switchTab('autos');
    tabLogs.onclick = () => switchTab('logs');
    tabNotifs.onclick = () => switchTab('notifs');
  }

  // Bind Rule Toggles
  container.querySelectorAll('input[data-rule-toggle]').forEach(chk => {
    chk.onchange = e => {
      const ruleId = e.target.dataset.ruleToggle;
      const active = e.target.checked;
      updateAutomationRuleStatus(ruleId, active);
      showToast('Status da regra atualizado com sucesso');
      renderSettingsView();
    };
  });

  // Bind Notifications Read
  container.querySelectorAll('button[data-notif-read]').forEach(btn => {
    btn.onclick = e => {
      const notifId = e.target.dataset.notifRead;
      markNotificationAsRead(notifId);
      renderSettingsView();
    };
  });

  const clearNotifsBtn = container.querySelector('#btn-clear-notifs');
  if (clearNotifsBtn) {
    clearNotifsBtn.onclick = () => {
      clearAllNotifications();
      showToast('Notificações limpas');
      renderSettingsView();
    };
  }

  const btnExport = container.querySelector('#btn-export-backup');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const res = exportBackup();
      if (res.success) {
        showToast('Backup exportado com sucesso!', '💾');
        renderSettingsView();
      } else {
        showToast(`Erro ao exportar backup: ${res.error}`, '⚠');
      }
    });
  }

  const btnImportTrigger = container.querySelector('#btn-import-backup-trigger');
  const inpRestoreFile = container.querySelector('#inp-restore-file');
  if (btnImportTrigger && inpRestoreFile) {
    btnImportTrigger.addEventListener('click', () => {
      inpRestoreFile.click();
    });

    inpRestoreFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const confirmRestore = confirm('Atenção: A restauração de um backup irá substituir TODOS os dados atuais do PAPER MAX pelos dados do arquivo. Deseja prosseguir?');
      if (!confirmRestore) {
        inpRestoreFile.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const jsonContent = event.target.result;
        const res = restoreBackup(jsonContent);
        if (res.success) {
          showToast('Dados restaurados com sucesso! Recarregando aplicação...', '✓');
          setTimeout(() => {
            window.location.reload();
          }, 800);
        } else {
          alert(`Falha ao restaurar backup: ${res.error}`);
          showToast('Falha na restauração do backup.', '⚠');
        }
        inpRestoreFile.value = '';
      };
      reader.onerror = () => {
        alert('Erro ao ler o arquivo selecionado.');
        inpRestoreFile.value = '';
      };
      reader.readAsText(file);
    });
  }

  const saveBtn = container.querySelector('#btn-save-settings');
  if (saveBtn) {
    saveBtn.addEventListener('click', e => {
      e.preventDefault();
      const atelierName = document.getElementById('inp-set-name').value;
      const ownerName = document.getElementById('inp-set-owner').value;
      saveSettings({ atelierName, ownerName });
      showToast('Preferências salvas com sucesso');
    });
  }
}

// ==========================================
// VIEW SWITCHER
// ==========================================
export function switchView(viewName) {
  currentView = viewName;

  // Update active sidebar nav button
  document.querySelectorAll('#sidebar-nav button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Switch rendering
  switch (viewName) {
    case 'inicio':
      renderDashboard();
      break;
    case 'pedidos':
      ordersTab = 'em_andamento';
      renderOrdersView();
      break;
    case 'produtos':
      renderProductsView();
      break;
    case 'estoque':
      renderStockView();
      break;
    case 'financeiro':
      renderFinanceView();
      break;
    case 'ajustes':
      renderSettingsView();
      break;
    default:
      renderDashboard();
  }
}

// ==========================================
// APP INITIALIZATION
// ==========================================
export function initApp() {
  const user = getAuthenticatedUser();
  if (!user) {
    renderLoginScreen((authenticatedUser) => {
      showToast(`Bem-vinda, ${authenticatedUser.name}!`, '✨');
      initAppAfterAuth();
    });
    return;
  }
  initAppAfterAuth();
}

function initAppAfterAuth() {
  initClock();
  initCopilotUI();

  // Close sidebar when clicking main content
  const sidebar = document.getElementById('main-sidebar');
  const mainContent = document.getElementById('main-content');
  if (sidebar && mainContent) {
    mainContent.addEventListener('click', () => {
      sidebar.classList.remove('expanded');
    });
  }

  // Navigation click listeners
  const sidebarNav = document.getElementById('sidebar-nav');
  if (sidebarNav) {
    sidebarNav.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-view]');
      if (btn && btn.dataset.view) {
        if (sidebar) sidebar.classList.remove('expanded');
        switchView(btn.dataset.view);
      }
    });
  }

  // Quick Action Buttons
  const quickNewOrder = document.getElementById('btn-quick-new-order');
  if (quickNewOrder) {
    quickNewOrder.addEventListener('click', () => openNewOrderDrawer());
  }

  const quickNewProduct = document.getElementById('btn-quick-new-product');
  if (quickNewProduct) {
    quickNewProduct.addEventListener('click', () => openNewProductDrawer());
  }

  const quickBulk = document.getElementById('btn-quick-bulk');
  if (quickBulk) {
    quickBulk.addEventListener('click', () => {
      openBulkPersonalizationModal(openDrawer, closeDrawer);
    });
  }

  const quickPurchase = document.getElementById('btn-quick-purchase');
  if (quickPurchase) {
    quickPurchase.addEventListener('click', () => {
      switchView('estoque');
      openPurchaseDrawer();
    });
  }

  const quickImport = document.getElementById('btn-quick-import');
  if (quickImport) {
    quickImport.addEventListener('click', () => openImportCSVDrawer('pedidos'));
  }

  // Keyboard Shortcuts:
  // - Escape closes open drawer
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeDrawer();
    }
  });

  // Reactive listeners for external updates
  bus.on('orders:changed', () => {
    if (currentView === 'inicio') renderDashboard();
    if (currentView === 'pedidos') renderOrdersView();
  });

  bus.on('products:changed', () => {
    if (currentView === 'produtos') renderProductsView();
    if (currentView === 'inicio') renderDashboard();
  });

  bus.on('categories:changed', () => {
    if (currentView === 'produtos') renderProductsView();
  });

  bus.on('finance:changed', () => {
    if (currentView === 'financeiro') renderFinanceView();
    if (currentView === 'inicio') renderDashboard();
  });

  bus.on('purchases:changed', () => {
    if (currentView === 'estoque') renderStockView();
    if (currentView === 'financeiro') renderFinanceView();
    if (currentView === 'inicio') renderDashboard();
  });

  bus.on('materials:changed', () => {
    if (currentView === 'estoque') renderStockView();
    if (currentView === 'financeiro') renderFinanceView();
  });

  bus.on('components:changed', () => {
    if (currentView === 'estoque') renderStockView();
    if (currentView === 'financeiro') renderFinanceView();
  });

  // Start at initial view
  switchView('inicio');

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log('SW registration note:', err);
    });
  }
}

// Auto-run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
