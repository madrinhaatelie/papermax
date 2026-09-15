/**
 * PAPER MAX - Main Application Coordinator (app.js)
 * Manages Views, Drawers, Autosave Sync, Keyboard Shortcuts, Kawaii Loader, and Toasts.
 */

import { bus, showToast } from './core/events.js';
import { onSaveStatusChange, loadSettings, saveSettings } from './data/storage.js';
import { exportBackup, restoreBackup, getLastBackupTimestamp } from './data/backup.engine.js';
import { getAuthenticatedUser, renderLoginScreen, getGreetingPhrase } from './data/auth.js';
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
import {
  renderOrdersView as renderOrdersModuleView,
  renderNewOrderPage,
  showOrderConsultationDrawer,
  openEditOrderDrawer as openEditOrderDrawerModule
} from './modules/orders/orders.ui.js';
import { fileStorage } from './data/filestorage.js';
import { escapeHtml, formatCurrency, formatDateBR, formatDateShortBR, parseDateBRToISO, generateId } from './utils/sanitize.js';
import { initCopilotUI } from './modules/copilot/copilot.ui.js';

// Application State
let currentView = 'inicio'; // 'inicio' | 'pedidos' | 'produtos' | 'estoque' | 'financeiro' | 'ajustes'
let ordersTab = 'em_andamento'; // 'em_andamento' | 'todos' | 'aguardando' | 'producao' | 'fila_impressao' | 'prontos' | 'entregues' | 'cancelados'
let productsTab = 'todos'; // 'todos' | 'vitrine' | 'ranking' | 'categorias'
let orderSearchTerm = '';
let productSearchTerm = '';
let dashboardStageFilter = null;

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

    const greetingTitle = document.getElementById('greeting-title');
    if (greetingTitle && greetingTitle.textContent !== 'Olá, Diretora Master Julia Aleixo') {
      greetingTitle.textContent = 'Olá, Diretora Master Julia Aleixo';
    }
    const greetingSubtitle = document.getElementById('greeting-subtitle');
    if (greetingSubtitle && !greetingSubtitle.dataset.initialized) {
      greetingSubtitle.textContent = `Hoje o dia está perfeito para ${getGreetingPhrase()}`;
      greetingSubtitle.dataset.initialized = 'true';
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
// RENDER: INÍCIO (DASHBOARD)
// ==========================================
function renderDashboard() {
  const container = document.getElementById('view-container');
  if (!container) return;

  const metrics = calculateDashboardMetrics();

  container.innerHTML = `
    <!-- BLOCO 01: Cards de Métricas Principais (Stat Cards) -->
    <section class="cards" id="metric-cards-grid">
      <div class="card" id="card-metric-today">
        <div class="card-top">
          <span class="card-label">Pedidos hoje</span>
          <span class="card-icon-badge">📋</span>
        </div>
        <div class="card-value" id="val-orders-today">${metrics.todayCount}</div>
      </div>

      <div class="card" id="card-metric-prod">
        <div class="card-top">
          <span class="card-label">Em produção</span>
          <span class="card-icon-badge">⚙</span>
        </div>
        <div class="card-value" id="val-orders-prod">${metrics.inProdCount}</div>
      </div>

      <div class="card" id="card-metric-pending">
        <div class="card-top">
          <span class="card-label">Pendências</span>
          <span class="card-icon-badge">⚠️</span>
        </div>
        <div class="card-value" id="val-orders-pending">${metrics.pendingCount}</div>
      </div>

      <div class="card" id="card-metric-ready">
        <div class="card-top">
          <span class="card-label">Liberado Para Entrega</span>
          <span class="card-icon-badge">✓</span>
        </div>
        <div class="card-value" id="val-orders-ready">${metrics.readyCount}</div>
      </div>
    </section>

    <!-- BLOCO 02: Esteira Operacional: "O que vou produzir hoje?" -->
    <section class="operational-strip" id="sec-operational-pipeline">
      <div class="operational-strip-header">
        <div class="operational-strip-title" style="display: flex; align-items: center; gap: 10px;">
          <span>🏭 O que vou produzir hoje?</span>
          ${dashboardStageFilter ? `<span style="font-size: 11px; font-weight: 600; color: var(--accent-primary); background: #e0e7ff; padding: 2px 8px; border-radius: 999px;">Filtro: ${escapeHtml(dashboardStageFilter)} · <a href="#" id="link-clear-stage-filter" style="text-decoration: underline; color: inherit;">Limpar</a></span>` : ''}
        </div>
        <button class="btn btn-sm" id="btn-dash-open-print-queue" style="font-size: 11px; padding: 4px 10px; font-weight: 600;">
          🖨 Resumo diário (${metrics.operational.printQueueCount})
        </button>
      </div>

      <div class="pipeline-grid">
        <div class="pipeline-card ${dashboardStageFilter === 'aguardando' ? 'active-filter' : ''}" data-dash-tab="aguardando" title="Filtrar pedidos aguardando" style="cursor: pointer; ${dashboardStageFilter === 'aguardando' ? 'border: 2px solid #eab308; background: #fefce8;' : ''}">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">🟡 Aguardando</span>
          </div>
          <div class="pipeline-card-count">${metrics.operational.awaitingCount}</div>
        </div>

        <div class="pipeline-card ${dashboardStageFilter === 'impressao' ? 'active-filter' : ''}" data-dash-tab="impressao" title="Filtrar pedidos em Impressão" style="cursor: pointer; ${dashboardStageFilter === 'impressao' ? 'border: 2px solid #3b82f6; background: #eff6ff;' : ''}">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">🖨 Impressão</span>
          </div>
          <div class="pipeline-card-count" style="color: var(--accent-primary);">${metrics.operational.impressaoCount}</div>
        </div>

        <div class="pipeline-card ${dashboardStageFilter === 'corte' ? 'active-filter' : ''}" data-dash-tab="corte" title="Filtrar pedidos em Corte" style="cursor: pointer; ${dashboardStageFilter === 'corte' ? 'border: 2px solid #2563eb; background: #eff6ff;' : ''}">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">✂ Corte</span>
          </div>
          <div class="pipeline-card-count">${metrics.operational.corteCount}</div>
        </div>

        <div class="pipeline-card ${dashboardStageFilter === 'vinco' ? 'active-filter' : ''}" data-dash-tab="vinco" title="Filtrar pedidos em Vinco" style="cursor: pointer; ${dashboardStageFilter === 'vinco' ? 'border: 2px solid #9333ea; background: #faf5ff;' : ''}">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">📐 Vinco</span>
          </div>
          <div class="pipeline-card-count">${metrics.operational.vincoCount}</div>
        </div>

        <div class="pipeline-card ${dashboardStageFilter === 'montagem' ? 'active-filter' : ''}" data-dash-tab="montagem" title="Filtrar pedidos em Montagem" style="cursor: pointer; ${dashboardStageFilter === 'montagem' ? 'border: 2px solid #4f46e5; background: #eef2ff;' : ''}">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">🧩 Montagem</span>
          </div>
          <div class="pipeline-card-count">${metrics.operational.montagemCount}</div>
        </div>

        <div class="pipeline-card ${dashboardStageFilter === 'acabamento' ? 'active-filter' : ''}" data-dash-tab="acabamento" title="Filtrar pedidos em Acabamento" style="cursor: pointer; ${dashboardStageFilter === 'acabamento' ? 'border: 2px solid #0284c7; background: #f0f9ff;' : ''}">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">✨ Acabamento</span>
          </div>
          <div class="pipeline-card-count">${metrics.operational.acabamentoCount}</div>
        </div>

        <div class="pipeline-card ${dashboardStageFilter === 'conferencia' ? 'active-filter' : ''}" data-dash-tab="conferencia" title="Filtrar pedidos em CQ / Conferência" style="cursor: pointer; ${dashboardStageFilter === 'conferencia' ? 'border: 2px solid #ea580c; background: #fff7ed;' : ''}">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">🔍 CQ / Conferência</span>
          </div>
          <div class="pipeline-card-count" style="color: #c2410c;">${metrics.operational.conferenciaCount}</div>
        </div>

        <div class="pipeline-card ${dashboardStageFilter === 'embalagem' ? 'active-filter' : ''}" data-dash-tab="embalagem" title="Filtrar pedidos em Embalagem" style="cursor: pointer; ${dashboardStageFilter === 'embalagem' ? 'border: 2px solid #0d9488; background: #f0fdfa;' : ''}">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">📦 Embalagem</span>
          </div>
          <div class="pipeline-card-count">${metrics.operational.embalagemCount}</div>
        </div>

        <div class="pipeline-card ${dashboardStageFilter === 'pronto' ? 'active-filter' : ''}" data-dash-tab="pronto" title="Filtrar pedidos Prontos" style="cursor: pointer; ${dashboardStageFilter === 'pronto' ? 'border: 2px solid #10b981; background: #ecfdf5;' : ''}">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">✓ Pronto</span>
          </div>
          <div class="pipeline-card-count" style="color: #059669;">${metrics.operational.prontoCount}</div>
        </div>
      </div>
    </section>

    <!-- BLOCO 03 & BLOCO 04: Two-column Operational Layout -->
    <section class="layout" id="operational-layout">
      <!-- BLOCO 03: Active Orders Panel -->
      <div class="panel" id="panel-orders">
        <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h2 class="panel-title" id="title-orders" style="margin: 0;">Pedidos ativos</h2>
          <span class="badge-count" id="badge-orders-count" style="font-size: 12px; font-weight: 600; color: var(--text-secondary);">(${metrics.activeOrders.length} pedidos)</span>
        </div>

        <div class="orders" id="dashboard-orders-list">
          <!-- Rendered below -->
        </div>
      </div>

      <!-- BLOCO 04: Alerts and Needs Panel -->
      <div class="panel" id="panel-alerts">
        <div class="panel-header">
          <h2 class="panel-title" id="title-alerts">Pendências e Atenção</h2>
        </div>
        <div class="alerts" id="alerts-list">
          ${metrics.commercial?.highestGrowth ? `
            <div class="alert-card alert-blue" style="cursor: pointer;" id="dash-alert-growth" title="Clique para ver o ranking de produtos">
              <div class="alert-title">🚀 Maior Crescimento: ${escapeHtml(metrics.commercial.highestGrowth.name)} (+${metrics.commercial.highestGrowth.growthQtyPct.toFixed(1)}%)</div>
              <div class="alert-desc">${metrics.commercial.highestGrowth.qty} un vendidas nos últimos 30 dias (${formatCurrency(metrics.commercial.highestGrowth.revenue)}). Clique para ver ranking.</div>
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
              <div class="alert-title">⚠ Alerta Demanda × Estoque (${metrics.commercial.stockAlerts.length} produto(s) críticos)</div>
              <div class="alert-desc">${escapeHtml(metrics.commercial.stockAlerts.map(p => p.name).join(', '))} com estoque abaixo do volume de vendas.</div>
            </div>
          ` : ''}
          ${metrics.operational.qcAlertOrders.length > 0 ? `
            <div class="alert-card alert-red">
              <div class="alert-title">🔴 ${metrics.operational.qcAlertOrders.length} pedido(s) com não conformidades no CQ</div>
              <div class="alert-desc">${escapeHtml(metrics.operational.qcAlertOrders.map(o => `Pedido ${o.number || o.id}`).join(', '))} necessitam de retrabalho na linha de produção.</div>
            </div>
          ` : ''}
          ${metrics.operational.pendingPdfOrders.length > 0 ? `
            <div class="alert-card alert-yellow">
              <div class="alert-title">🟡 ${metrics.operational.pendingPdfOrders.length} pedido(s) sem PDF gerado</div>
              <div class="alert-desc">Avisos de corte e impressão pendentes de arquivo vetorial.</div>
            </div>
          ` : ''}
          ${metrics.operational.urgentOrders.length > 0 ? `
            <div class="alert-card alert-orange">
              <div class="alert-title">🟠 ${metrics.operational.urgentOrders.length} pedido(s) urgentes / entrega hoje</div>
              <div class="alert-desc">Prioridades imediatas para conferência final e empacotamento.</div>
            </div>
          ` : ''}
          <div class="alert-card alert-blue">
            <div class="alert-title">🔵 ${metrics.inProdCount} pedido(s) na linha operacional</div>
            <div class="alert-desc">Impressão, corte, vinco, montagem e acabamento em andamento.</div>
          </div>
          <div class="alert-card alert-green">
            <div class="alert-title">🟢 ${metrics.readyCount} pedido(s) liberados para entrega</div>
            <div class="alert-desc">Embalagem final conferida e prontos para liberação ao cliente.</div>
          </div>
        </div>
      </div>
    </section>

    <!-- BLOCO 05: Acumulado Histórico Real -->
    <section class="panel mother" id="panel-lifetime">
      <div class="panel-header">
        <h2 class="panel-title" id="title-lifetime">O que foi feito até hoje</h2>
      </div>
      <div class="lifetime-grid" id="lifetime-metrics" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
        <div class="life-card" id="life-card-sales">
          <span class="life-label">Faturamento</span>
          <b class="life-val" id="val-lifetime-sales">${formatCurrency(metrics.totalRevenue)}</b>
        </div>
        <div class="life-card" id="life-card-profit">
          <span class="life-label">Lucro</span>
          <b class="life-val" id="val-lifetime-profit">${formatCurrency(metrics.profit50)}</b>
        </div>
        <div class="life-card" id="life-card-prods">
          <span class="life-label">Produtos</span>
          <b class="life-val" id="val-lifetime-products">${metrics.soldProductsCount} un</b>
        </div>
        <div class="life-card" id="life-card-invest">
          <span class="life-label">Investimento</span>
          <b class="life-val" id="val-lifetime-invest">${formatCurrency(metrics.totalInvested)}</b>
        </div>
      </div>
    </section>

    <!-- BLOCO 06: Gráfico de Vendas por Mês no ANO ATUAL -->
    <section class="panel chart-panel" id="panel-chart">
      <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h2 class="panel-title" id="title-chart">Vendas de 2026</h2>
        <span class="badge-count" id="badge-chart-year">2026</span>
      </div>

      <div class="chart-container-responsive" style="position: relative; width: 100%; padding-top: 8px;">
        <!-- Responsive Line SVG Overlay -->
        <svg class="chart-line-overlay" viewBox="0 0 600 120" preserveAspectRatio="none" style="position: absolute; top: 18px; left: 0; width: 100%; height: 110px; pointer-events: none; z-index: 5; overflow: visible;">
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#818cf8" stop-opacity="0.6"/>
              <stop offset="70%" stop-color="#c084fc" stop-opacity="0.85"/>
              <stop offset="100%" stop-color="#f472b6" stop-opacity="1"/>
            </linearGradient>
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          ${(() => {
            const data = metrics.chartData;
            const maxVal = Math.max(...data.map(d => d.value), 10);
            const points = data.map((d, i) => {
              const x = (i + 0.5) * (600 / data.length);
              const y = 110 - Math.round((d.value / maxVal) * 85);
              return { x, y, val: d.value, isCurrent: d.isCurrent };
            });
            const dPath = points.reduce((acc, pt, i) => {
              if (i === 0) return `M ${pt.x} ${pt.y}`;
              const prev = points[i - 1];
              const cx = (prev.x + pt.x) / 2;
              return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
            }, '');
            return `
              <path d="${dPath}" fill="none" stroke="url(#lineGrad)" stroke-width="3" stroke-linecap="round" filter="url(#neonGlow)" />
              ${points.map(pt => `
                <circle cx="${pt.x}" cy="${pt.y}" r="${pt.isCurrent ? '5.5' : '3.5'}" fill="${pt.isCurrent ? '#f472b6' : '#818cf8'}" stroke="#ffffff" stroke-width="2" />
              `).join('')}
            `;
          })()}
        </svg>

        <!-- Responsive Bars with Tooltips and Neon Pulse -->
        <div class="bars" id="sales-bars-container" style="position: relative; z-index: 2;">
          ${metrics.chartData.map(bar => {
            const maxVal = Math.max(...metrics.chartData.map(b => b.value), 10);
            const percent = Math.min(100, Math.round((bar.value / maxVal) * 85) + 12);
            const activeClass = bar.isCurrent ? 'active neon-pulse' : '';
            return `
              <div class="bar-wrap">
                <span class="bar-tooltip" style="z-index: 20;">${bar.value} pedidos</span>
                <div class="bar ${activeClass}" style="height: ${percent}%;"></div>
                <span class="bar-label" style="font-size: 11px;">${escapeHtml(bar.label)}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </section>
  `;

  // Render orders inside active list
  renderDashboardOrdersList();

  // Clear stage filter link
  const linkClearFilter = container.querySelector('#link-clear-stage-filter');
  if (linkClearFilter) {
    linkClearFilter.addEventListener('click', e => {
      e.preventDefault();
      dashboardStageFilter = null;
      renderDashboard();
    });
  }

  // Pipeline card quick filter by etapa (Bloco 02)
  container.querySelectorAll('[data-dash-tab]').forEach(card => {
    card.addEventListener('click', () => {
      const stage = card.dataset.dashTab;
      if (dashboardStageFilter === stage) {
        dashboardStageFilter = null;
      } else {
        dashboardStageFilter = stage;
      }
      renderDashboard();
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

  let orders = getOrders({ search: orderSearchTerm }).filter(isOrderActive);

  if (dashboardStageFilter) {
    orders = orders.filter(o => {
      const stage = (o.production?.currentStage || '').toLowerCase();
      const status = (o.status || '').toLowerCase();
      if (dashboardStageFilter === 'aguardando') return stage === 'aprovacao' || stage === 'aguardando' || status === 'yellow';
      if (dashboardStageFilter === 'impressao') return stage === 'impressao' || status === 'blue';
      if (dashboardStageFilter === 'corte') return stage === 'corte';
      if (dashboardStageFilter === 'vinco') return stage === 'vinco';
      if (dashboardStageFilter === 'montagem') return stage === 'montagem';
      if (dashboardStageFilter === 'acabamento') return stage === 'acabamento';
      if (dashboardStageFilter === 'conferencia') return stage === 'conferencia' || stage === 'cq';
      if (dashboardStageFilter === 'embalagem') return stage === 'embalagem';
      if (dashboardStageFilter === 'pronto') return stage === 'pronto' || status === 'green';
      return stage === dashboardStageFilter;
    });
  }

  if (orders.length === 0) {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">
        <b style="display: block; color: var(--text-primary); margin-bottom: 4px;">Nenhum pedido encontrado ${dashboardStageFilter ? `na etapa "${dashboardStageFilter}"` : 'ativo'}.</b>
        ${dashboardStageFilter ? 'Clique no card da etapa para remover o filtro.' : 'Os pedidos aparecerão aqui quando forem criados e estiverem em andamento na produção.'}
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
          <div class="list-title" style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600;">
            ${orderTitleFormatted}
            <span style="font-size: 12px; font-weight: normal; color: var(--text-secondary);">· ${customer}</span>
          </div>
          <div class="list-meta" style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
            Quantidade: ${qty} un · Entrega: ${date}
          </div>
        </div>
        <div style="text-align: right; min-width: 110px;">
          <span class="order-status-badge" style="display: inline-block; font-weight: 600; font-size: 11px; padding: 4px 8px; border-radius: 6px; cursor: pointer; background: #ffffff; border: 1px solid #e2e8f0; color: var(--text-secondary); transition: all 0.15s ease;" data-action="cycle-status" data-id="${order.id}" title="Clique para avançar status">${escapeHtml(order.statusLabel || statusDef.label)}</span>
        </div>
        <div class="actions" style="position: relative;">
          <button class="action-btn btn-dots-menu" data-action="toggle-dots" data-id="${order.id}" title="Ações do pedido" style="padding: 4px 8px; font-weight: bold; font-size: 14px; line-height: 1;">⋮</button>
          <div class="dots-dropdown-menu" id="dots-menu-${order.id}" style="display: none; position: absolute; right: 0; top: 100%; margin-top: 4px; background: #ffffff; border: 1px solid var(--border-strong); border-radius: 8px; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.12); z-index: 50; min-width: 120px; padding: 4px 0;">
            <button class="dots-menu-item" data-action="edit-order" data-id="${order.id}">Editar</button>
            <button class="dots-menu-item" data-action="dup-order" data-id="${order.id}">Duplicar</button>
            <button class="dots-menu-item" data-action="del-order" data-id="${order.id}" style="color: #ef4444;">Excluir</button>
            <button class="dots-menu-item" data-action="hide-order" data-id="${order.id}">Ocultar</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Bind Three Dots menu toggle
  container.querySelectorAll('[data-action="toggle-dots"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const menu = container.querySelector(`#dots-menu-${id}`);
      const isVisible = menu && menu.style.display === 'block';
      container.querySelectorAll('.dots-dropdown-menu').forEach(m => m.style.display = 'none');
      if (menu && !isVisible) {
        menu.style.display = 'block';
      }
    });
  });

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

  container.querySelectorAll('[data-action="edit-order"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      container.querySelectorAll('.dots-dropdown-menu').forEach(m => m.style.display = 'none');
      openEditOrderDrawer(btn.dataset.id);
    });
  });

  container.querySelectorAll('[data-action="dup-order"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      container.querySelectorAll('.dots-dropdown-menu').forEach(m => m.style.display = 'none');
      try {
        const dup = duplicateOrder(btn.dataset.id);
        renderDashboard();
        showToast(`Pedido ${dup.number} duplicado com sucesso`);
      } catch (err) {
        showToast(err.message, '⚠');
      }
    });
  });

  container.querySelectorAll('[data-action="del-order"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      container.querySelectorAll('.dots-dropdown-menu').forEach(m => m.style.display = 'none');
      const order = getOrderById(btn.dataset.id);
      if (!order) return;
      if (confirm(`Tem certeza que deseja excluir o Pedido ${order.number || order.id}?`)) {
        deleteOrder(btn.dataset.id);
        renderDashboard();
        showToast('Pedido excluído');
      }
    });
  });

  container.querySelectorAll('[data-action="hide-order"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      container.querySelectorAll('.dots-dropdown-menu').forEach(m => m.style.display = 'none');
      const row = btn.closest('.list-row');
      if (row) {
        row.style.display = 'none';
      }
      showToast('Pedido ocultado da visualização.');
    });
  });
}

// ==========================================
// RENDER: PEDIDOS VIEW (FULL MODULE)
// ==========================================
export function getOrdersContext() {
  return {
    switchView,
    openDrawer,
    closeDrawer,
    showToast,
    openBulkPersonalizationModal,
    openImportCSVDrawer
  };
}

function renderOrdersView() {
  const container = document.getElementById('view-container');
  if (!container) return;
  renderOrdersModuleView(container, getOrdersContext());
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
  showOrderConsultationDrawer(orderId, getOrdersContext());
}

function openNewOrderDrawer(prefill = {}) {
  switchView('pedidos-novo');
}

function openEditOrderDrawer(orderId) {
  openEditOrderDrawerModule(orderId, getOrdersContext());
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
    <div class="binder-tabs" style="margin-top: 10px;">
      <div class="binder-tab active">1. Dados da Categoria</div>
    </div>
    <div class="binder-panel" style="margin-bottom: 0;">
      <form id="form-cat">
        <div class="form-group">
          <label class="form-label" for="inp-cat-name">Nome da Categoria *</label>
          <input class="form-input" id="inp-cat-name" value="${cat ? escapeHtml(cat.name) : ''}" required placeholder="Ex: Topos de Bolo" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="inp-cat-desc">Descrição</label>
          <textarea class="form-textarea" id="inp-cat-desc" rows="2" placeholder="Finalidade ou tipo de produtos...">${cat ? escapeHtml(cat.description || '') : ''}</textarea>
        </div>
      </form>
    </div>
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
    case 'pedidos-novo':
      document.querySelectorAll('#sidebar-nav button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === 'pedidos');
      });
      renderNewOrderPage(document.getElementById('view-container'), getOrdersContext());
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

  // Real-time Global Search Input
  const globalSearch = document.getElementById('input-global-search');
  if (globalSearch) {
    globalSearch.addEventListener('input', e => {
      orderSearchTerm = e.target.value;
      if (currentView === 'inicio') {
        renderDashboardOrdersList();
      } else if (currentView === 'pedidos') {
        renderOrdersView();
      }
    });
  }

  // Close three dots dropdown menus on global click
  window.addEventListener('click', () => {
    document.querySelectorAll('.dots-dropdown-menu').forEach(m => m.style.display = 'none');
  });

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
