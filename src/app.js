/**
 * PAPER MAX - Main Application Coordinator (app.js)
 * Manages Views, Drawers, Autosave Sync, Keyboard Shortcuts, Kawaii Loader, and Toasts.
 */

import { bus, showToast } from './core/events.js';
import { onSaveStatusChange, loadSettings, saveSettings, clearAllSystemData, loadMaterials, loadComponents } from './data/storage.js';
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
  calculateProductionCapacity,
  renderProductsRankingView,
  renderProductsTrendsView,
  renderProductsCapacityView,
  openProductIntelligenceDrawer,
  renderCommercialVitrine,
  openProductCommercialPreviewDrawer,
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
import { buildMaterialsMap, buildComponentsMap } from './modules/stock/stock.engine.js';
import { renderFinanceModule } from './modules/finance/finance.ui.js';
import { renderSettingsView as renderSettingsModule, setActiveSettingsTab } from './modules/settings/settings.ui.js';
import { openBulkPersonalizationModal } from './modules/personalization/bulk.ui.js';
import { generatePersonalizedPdf, triggerPdfDownload } from './modules/personalization/pdf.engine.js';
import { openProductConfigDrawer } from './modules/products/product.editor.ui.js';
import {
  renderOrdersView as renderOrdersModuleView,
  renderNewOrderPage,
  showOrderConsultationDrawer,
  openEditOrderDrawer as openEditOrderDrawerModule,
  showConfirmDialog
} from './modules/orders/orders.ui.js';
import { renderOrderApprovalPage } from './modules/orders/order.approval.ui.js';
import { fileStorage } from './data/filestorage.js';
import { escapeHtml, formatCurrency, formatDateBR, formatDateShortBR, parseDateBRToISO, generateId, formatNumberXX, formatPhone, formatCPF, formatCNPJ, formatCPFOrCNPJ } from './utils/sanitize.js';
import { initCopilotUI } from './modules/copilot/copilot.ui.js';

// Application State
let currentView = 'inicio'; // 'inicio' | 'pedidos' | 'produtos' | 'estoque' | 'financeiro' | 'ajustes'
let ordersTab = 'em_andamento'; // 'em_andamento' | 'todos' | 'aguardando' | 'producao' | 'fila_impressao' | 'prontos' | 'entregues' | 'cancelados'
let productsTab = 'todos'; // 'todos' | 'vitrine' | 'ranking' | 'categorias'
let currentSettingsTab = 'prefs'; // 'prefs' | 'autos' | 'logs' | 'notifs'
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
export function openDrawer(arg1, arg2, arg3, arg4) {
  let title = '';
  let contentHtml = '';
  let footerHtml = '';
  let onMount = null;
  let panelClass = '';

  if (typeof arg1 === 'object' && arg1 !== null) {
    title = arg1.title || '';
    contentHtml = arg1.contentHtml || '';
    footerHtml = arg1.footerHtml || '';
    onMount = arg1.onMount || null;
    panelClass = arg1.className || arg1.panelClass || arg1.size || '';
  } else {
    title = typeof arg1 === 'string' ? arg1 : '';
    contentHtml = typeof arg2 === 'string' ? arg2 : '';
    if (typeof arg3 === 'function') {
      onMount = arg3;
      panelClass = typeof arg4 === 'string' ? arg4 : '';
    } else if (typeof arg3 === 'string') {
      footerHtml = arg3;
      if (typeof arg4 === 'function') {
        onMount = arg4;
      } else if (typeof arg4 === 'string') {
        panelClass = arg4;
      }
    } else if (typeof arg4 === 'function') {
      onMount = arg4;
    }
  }

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
  const panelEl = document.getElementById('drawer-panel');

  if (panelEl) {
    panelEl.className = 'app-drawer-panel' + (panelClass ? ` ${panelClass}` : '');
  }

  if (titleEl) titleEl.textContent = title || 'Detalhes';
  if (bodyEl) bodyEl.innerHTML = contentHtml || '';
  if (footerEl) {
    footerEl.innerHTML = footerHtml || '';
    footerEl.style.display = footerHtml ? 'flex' : 'none';
  }

  drawer.className = 'app-drawer-backdrop active';
  document.body.style.overflow = 'hidden';

  const closeBtn = drawer.querySelector('#btn-close-drawer');
  if (closeBtn) closeBtn.onclick = closeDrawer;

  drawer.onclick = e => {
    if (e.target === drawer) closeDrawer();
  };

  if (typeof onMount === 'function') {
    onMount(drawer, closeDrawer);
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
        </div>
        <div class="card-value" id="val-orders-today">${formatNumberXX(metrics.todayCount)}</div>
      </div>

      <div class="card" id="card-metric-prod">
        <div class="card-top">
          <span class="card-label">Em produção</span>
        </div>
        <div class="card-value" id="val-orders-prod">${formatNumberXX(metrics.inProdCount)}</div>
      </div>

      <div class="card" id="card-metric-pending">
        <div class="card-top">
          <span class="card-label">Pendências</span>
        </div>
        <div class="card-value" id="val-orders-pending">${formatNumberXX(metrics.pendingCount)}</div>
      </div>

      <div class="card" id="card-metric-ready">
        <div class="card-top">
          <span class="card-label">Liberado Para Entrega</span>
        </div>
        <div class="card-value" id="val-orders-ready">${formatNumberXX(metrics.readyCount)}</div>
      </div>
    </section>

    <!-- BLOCO 02: Esteira Operacional: "O que vou produzir hoje?" -->
    <section class="operational-strip" id="sec-operational-pipeline">
      <div class="operational-strip-header">
        <div class="operational-strip-title" style="display: flex; align-items: center; gap: 10px;">
          <span>O que vou produzir hoje?</span>
          ${dashboardStageFilter ? `<span style="font-size: 11px; font-weight: 600; color: var(--accent-primary); background: #e0e7ff; padding: 2px 8px; border-radius: 999px;">Filtro: ${escapeHtml(dashboardStageFilter)} · <a href="#" id="link-clear-stage-filter" style="text-decoration: underline; color: inherit;">Limpar</a></span>` : ''}
        </div>
      </div>

      <div class="pipeline-grid">
        <div class="pipeline-card ${dashboardStageFilter === 'aguardando' ? 'active-filter' : ''}" data-dash-tab="aguardando" title="Filtrar pedidos aguardando" style="cursor: pointer; ${dashboardStageFilter === 'aguardando' ? 'border: 2px solid #eab308; background: #fefce8;' : ''}">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">Aguardando</span>
          </div>
          <div class="pipeline-card-count">${formatNumberXX(metrics.operational.awaitingCount)}</div>
        </div>

        <div class="pipeline-card ${dashboardStageFilter === 'impressao' ? 'active-filter' : ''}" data-dash-tab="impressao" title="Filtrar pedidos em Impressão" style="cursor: pointer; ${dashboardStageFilter === 'impressao' ? 'border: 2px solid #3b82f6; background: #eff6ff;' : ''}">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">Impressão</span>
          </div>
          <div class="pipeline-card-count" style="color: var(--accent-primary);">${formatNumberXX(metrics.operational.impressaoCount)}</div>
        </div>

        <div class="pipeline-card ${dashboardStageFilter === 'corte' ? 'active-filter' : ''}" data-dash-tab="corte" title="Filtrar pedidos em Corte" style="cursor: pointer; ${dashboardStageFilter === 'corte' ? 'border: 2px solid #2563eb; background: #eff6ff;' : ''}">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">Corte</span>
          </div>
          <div class="pipeline-card-count">${formatNumberXX(metrics.operational.corteCount)}</div>
        </div>

        <div class="pipeline-card ${dashboardStageFilter === 'vinco' ? 'active-filter' : ''}" data-dash-tab="vinco" title="Filtrar pedidos em Vinco" style="cursor: pointer; ${dashboardStageFilter === 'vinco' ? 'border: 2px solid #9333ea; background: #faf5ff;' : ''}">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">Vinco</span>
          </div>
          <div class="pipeline-card-count">${formatNumberXX(metrics.operational.vincoCount)}</div>
        </div>

        <div class="pipeline-card ${dashboardStageFilter === 'montagem' ? 'active-filter' : ''}" data-dash-tab="montagem" title="Filtrar pedidos em Montagem" style="cursor: pointer; ${dashboardStageFilter === 'montagem' ? 'border: 2px solid #4f46e5; background: #eef2ff;' : ''}">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">Montagem</span>
          </div>
          <div class="pipeline-card-count">${formatNumberXX(metrics.operational.montagemCount)}</div>
        </div>

        <div class="pipeline-card ${dashboardStageFilter === 'acabamento' ? 'active-filter' : ''}" data-dash-tab="acabamento" title="Filtrar pedidos em Acabamento" style="cursor: pointer; ${dashboardStageFilter === 'acabamento' ? 'border: 2px solid #0284c7; background: #f0f9ff;' : ''}">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">Acabamento</span>
          </div>
          <div class="pipeline-card-count">${formatNumberXX(metrics.operational.acabamentoCount)}</div>
        </div>

        <div class="pipeline-card ${dashboardStageFilter === 'conferencia' ? 'active-filter' : ''}" data-dash-tab="conferencia" title="Filtrar pedidos em CQ / Conferência" style="cursor: pointer; ${dashboardStageFilter === 'conferencia' ? 'border: 2px solid #ea580c; background: #fff7ed;' : ''}">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">CQ / Conferência</span>
          </div>
          <div class="pipeline-card-count" style="color: #c2410c;">${formatNumberXX(metrics.operational.conferenciaCount)}</div>
        </div>

        <div class="pipeline-card ${dashboardStageFilter === 'embalagem' ? 'active-filter' : ''}" data-dash-tab="embalagem" title="Filtrar pedidos em Embalagem" style="cursor: pointer; ${dashboardStageFilter === 'embalagem' ? 'border: 2px solid #0d9488; background: #f0fdfa;' : ''}">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">Embalagem</span>
          </div>
          <div class="pipeline-card-count">${formatNumberXX(metrics.operational.embalagemCount)}</div>
        </div>

        <div class="pipeline-card ${dashboardStageFilter === 'pronto' ? 'active-filter' : ''}" data-dash-tab="pronto" title="Filtrar pedidos Prontos" style="cursor: pointer; ${dashboardStageFilter === 'pronto' ? 'border: 2px solid #10b981; background: #ecfdf5;' : ''}">
          <div class="pipeline-card-top">
            <span class="pipeline-card-label">Pronto</span>
          </div>
          <div class="pipeline-card-count" style="color: #059669;">${formatNumberXX(metrics.operational.prontoCount)}</div>
        </div>
      </div>
    </section>

    <!-- BLOCO 03 & BLOCO 04: Two-column Operational Layout -->
    <section class="layout" id="operational-layout">
      <!-- BLOCO 03: Active Orders Panel -->
      <div class="panel" id="panel-orders">
        <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h2 class="panel-title" id="title-orders" style="margin: 0;">Pedidos ativos</h2>
          <span class="badge-count" id="badge-orders-count" style="font-size: 12px; font-weight: 600; color: var(--text-secondary);">(${formatNumberXX(metrics.activeOrders.length)} pedidos)</span>
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
              <div class="alert-title">Maior Crescimento: ${escapeHtml(metrics.commercial.highestGrowth.name)} (+${metrics.commercial.highestGrowth.growthQtyPct.toFixed(1)}%)</div>
              <div class="alert-desc">${metrics.commercial.highestGrowth.qty} un vendidas nos últimos 30 dias (${formatCurrency(metrics.commercial.highestGrowth.revenue)}). Clique para ver ranking.</div>
            </div>
          ` : ''}
          ${metrics.commercial?.highestMargin ? `
            <div class="alert-card alert-green" style="cursor: pointer;" id="dash-alert-margin" title="Clique para ver produtos">
              <div class="alert-title">Destaque de Rentabilidade: ${escapeHtml(metrics.commercial.highestMargin.name)} (${metrics.commercial.highestMargin.marginPct.toFixed(1)}% de margem)</div>
              <div class="alert-desc">Lucro de ${formatCurrency(metrics.commercial.highestMargin.profit)} com preço de ${formatCurrency(metrics.commercial.highestMargin.price)}.</div>
            </div>
          ` : ''}
          ${metrics.commercial?.stockAlerts?.length > 0 ? `
            <div class="alert-card alert-orange" style="cursor: pointer;" id="dash-alert-stock" title="Clique para ver a capacidade de produção">
              <div class="alert-title">Alerta Demanda × Estoque (${metrics.commercial.stockAlerts.length} produto(s) críticos)</div>
              <div class="alert-desc">${escapeHtml(metrics.commercial.stockAlerts.map(p => p.name).join(', '))} com estoque abaixo do volume de vendas.</div>
            </div>
          ` : ''}
          ${metrics.operational.qcAlertOrders.length > 0 ? `
            <div class="alert-card alert-red">
              <div class="alert-title">${metrics.operational.qcAlertOrders.length} pedido(s) com não conformidades no CQ</div>
              <div class="alert-desc">${escapeHtml(metrics.operational.qcAlertOrders.map(o => `${o.number || o.id}`).join(', '))} necessitam de retrabalho na linha de produção.</div>
            </div>
          ` : ''}
          ${metrics.operational.pendingPdfOrders.length > 0 ? `
            <div class="alert-card alert-yellow">
              <div class="alert-title">${metrics.operational.pendingPdfOrders.length} pedido(s) sem PDF gerado</div>
              <div class="alert-desc">Avisos de corte e impressão pendentes de arquivo vetorial.</div>
            </div>
          ` : ''}
          ${metrics.operational.urgentOrders.length > 0 ? `
            <div class="alert-card alert-orange">
              <div class="alert-title">${metrics.operational.urgentOrders.length} pedido(s) urgentes / entrega hoje</div>
              <div class="alert-desc">Prioridades imediatas para conferência final e empacotamento.</div>
            </div>
          ` : ''}
          <div class="alert-card alert-blue">
            <div class="alert-title">${metrics.inProdCount} pedido(s) na linha operacional</div>
            <div class="alert-desc">Impressão, corte, vinco, montagem e acabamento em andamento.</div>
          </div>
          <div class="alert-card alert-green">
            <div class="alert-title">${metrics.readyCount} pedido(s) liberados para entrega</div>
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
          <b class="life-val" id="val-lifetime-products">${formatNumberXX(metrics.soldProductsCount)}</b>
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
    const orderTitleFormatted = `${order.number || order.id} · ${escapeHtml(order.productTitle || order.title || 'Personalizado')}`;
    const customer = escapeHtml(order.customer || 'Cliente');
    const qty = order.qty || 1;
    const date = order.deliveryDate || order.date || '--/--/--';

    return `
      <div class="list-row ${statusClass}" data-order-id="${order.id}" style="cursor: pointer;" title="Clique para abrir consulta do Pedido ${orderTitleFormatted}">
        <div class="list-main" data-action="view-order" data-id="${order.id}">
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
          <div class="dots-dropdown-menu" id="dots-menu-${order.id}" style="display: none; position: absolute; right: 0; top: 100%; margin-top: 4px; background: #ffffff; border: 1px solid var(--border-strong); border-radius: 8px; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.12); z-index: 50; min-width: 140px; padding: 4px 0;">
            <button class="dots-menu-item" data-action="view-order" data-id="${order.id}">📄 Consultar</button>
            <button class="dots-menu-item" data-action="edit-order" data-id="${order.id}">✏️ Editar</button>
            <button class="dots-menu-item" data-action="dup-order" data-id="${order.id}">📋 Duplicar</button>
            <button class="dots-menu-item" data-action="del-order" data-id="${order.id}" style="color: #ef4444;">🗑️ Excluir</button>
            <button class="dots-menu-item" data-action="hide-order" data-id="${order.id}">👁️ Ocultar</button>
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

  container.querySelectorAll('.list-row[data-order-id]').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.actions') || e.target.closest('.dots-dropdown-menu') || e.target.closest('[data-action="cycle-status"]')) {
        return;
      }
      showOrderDetailsDrawer(row.dataset.orderId);
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
      const orderNum = order.number || order.id;
      showConfirmDialog({
        title: 'Excluir Pedido',
        message: `Tem certeza que deseja excluir o <b>Pedido ${orderNum}</b>?<br><br>Esta ação é irreversível e removerá o pedido e todo o seu histórico.`,
        confirmText: 'Sim, Excluir Pedido',
        isDanger: true,
        onConfirm: () => {
          try {
            deleteOrder(btn.dataset.id);
            renderDashboard();
            showToast(`Pedido ${orderNum} excluído com sucesso!`, '✅');
          } catch (err) {
            showToast(err.message, '⚠');
          }
        }
      });
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

  const allProducts = getProducts({ search: productSearchTerm });
  const activeProducts = allProducts.filter(p => p.status !== 'inativo' && p.active !== false);
  const inactiveProducts = allProducts.filter(p => p.status === 'inativo' || p.active === false);

  let displayedProducts = activeProducts;
  if (productsTab === 'inativos') {
    displayedProducts = inactiveProducts;
  } else if (productsTab === 'todos_geral') {
    displayedProducts = allProducts;
  } else {
    displayedProducts = activeProducts;
  }

  const categories = getCategories();

  container.innerHTML = `
    <div class="module-header">
      <div>
        <h2 class="module-title">Catálogo de Produtos</h2>
      </div>
      <div class="module-actions">
        <button class="btn btn-primary" id="btn-products-new">+ Novo produto</button>
      </div>
    </div>

    <!-- Search & Quick Stats -->
    <div class="filter-bar" style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; width: 100%;">
      <div class="search-wrapper flex-1" style="flex: 1 1 200px; min-width: 0; max-width: 100%;">
        <span class="search-icon">🔍</span>
        <input class="search w-full" id="input-products-search" placeholder="Buscar por nome do produto, descrição ou categoria..." value="${escapeHtml(productSearchTerm)}" style="width: 100%; box-sizing: border-box;" />
      </div>
      <span class="badge-count" style="flex-shrink: 0;">${displayedProducts.length} produtos</span>
    </div>

    <!-- Navigation Tabs Bar (Divisórias de Fichário Horizontais) -->
    <div class="products-tab-bar" style="display: flex; gap: 4px; margin: 16px 0 20px 0; border-bottom: 2px solid #cbd5e1; padding-bottom: 0; overflow-x: auto; align-items: flex-end;">
      ${[
        { id: 'todos', label: `Ativos (${activeProducts.length})` },
        { id: 'inativos', label: `Ocultos / Inativos (${inactiveProducts.length})` },
        { id: 'todos_geral', label: `Todos (${allProducts.length})` },
        { id: 'vitrine', label: 'Vitrine' },
        { id: 'ranking', label: '🏆 Ranking' },
        { id: 'tendencias', label: '📈 Tendências' },
        { id: 'capacidade', label: '📦 Capacidade' },
        { id: 'categorias', label: `📁 Categorias (${categories.length})` }
      ].map(tab => {
        const isActive = productsTab === tab.id;
        return `
          <button class="tab-btn ${isActive ? 'active' : ''}" data-products-tab="${tab.id}">
            ${tab.label}
          </button>
        `;
      }).join('')}
    </div>

    <div id="products-tab-content">
      <!-- Rendered by tab -->
    </div>
  `;

  // Render tab content
  const tabContent = document.getElementById('products-tab-content');
  if (productsTab === 'todos' || productsTab === 'inativos' || productsTab === 'todos_geral') {
    renderProductsTable(tabContent, displayedProducts, categories);
  } else if (productsTab === 'vitrine') {
    renderProductsVitrine(tabContent, displayedProducts, categories);
  } else if (productsTab === 'ranking') {
    renderProductsRankingView(tabContent, {
      openDrawer,
      closeDrawer,
      showToast,
      openIntelligenceDrawer: (id) => openProductIntelligenceDrawer({ productId: id, openDrawer, closeDrawer }),
      onPreview: (id) => showProductDetailsDrawer(id)
    });
  } else if (productsTab === 'tendencias') {
    renderProductsTrendsView(tabContent, { openDrawer, closeDrawer, showToast });
  } else if (productsTab === 'capacidade') {
    renderProductsCapacityView(tabContent, {
      openDrawer,
      closeDrawer,
      showToast,
      openIntelligenceDrawer: (id) => openProductIntelligenceDrawer({ productId: id, openDrawer, closeDrawer }),
      onPreview: (id) => showProductDetailsDrawer(id)
    });
  } else if (productsTab === 'categorias') {
    renderCategoriesManagerInline(tabContent, categories);
  }

  // Bind view tabs
  container.querySelectorAll('[data-products-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      productsTab = btn.dataset.productsTab;
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
}

function renderProductsTable(container, products, categories) {
  const catMap = new Map(categories.map(c => [c.id, c.name]));
  const materials = loadMaterials();
  const components = loadComponents();
  const materialsMap = buildMaterialsMap(materials);
  const componentsMap = buildComponentsMap(components);

  if (products.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 48px 24px; color: var(--text-muted); background: #ffffff; border-radius: 12px; border: 1px dashed var(--border-subtle);">
        <div style="font-size: 32px; margin-bottom: 8px;">🛍️</div>
        <b style="display: block; font-size: 14px; color: var(--text-primary); margin-bottom: 6px;">Nenhum produto cadastrado no catálogo.</b>
        <p style="font-size: 12px; margin: 0;">Utilize o botão "+ Novo Produto" acima para cadastrar um novo item no catálogo.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="list-group" id="products-list" style="display: flex; flex-direction: column; gap: 8px;">
      ${products.map(p => {
        const isMold = isSmartMold(p);
        const statusClass = (p.status === 'inativo' || p.active === false) ? 'status-neutral' : 'status-green';
        const catName = catMap.get(p.categoryId) || 'Geral';

        const unitPrice = Number(p.price) || 0;
        const unitCost = Number(p.cost) || 0;
        const unitProfit = Math.max(0, unitPrice - unitCost);
        const marginPct = unitPrice > 0 ? ((unitProfit / unitPrice) * 100).toFixed(0) : 0;

        const capacity = calculateProductionCapacity(p, materialsMap, componentsMap);
        let stockHtml = '';
        if (capacity !== null) {
          if (capacity <= 0) {
            stockHtml = `<span class="badge-count" style="background: #fee2e2; color: #991b1b; font-size: 10.5px; font-weight: 700;" title="Insumos esgotados para produção deste item">⚠ 0 un disp.</span>`;
          } else {
            stockHtml = `<span class="badge-count" style="background: #dcfce7; color: #166534; font-size: 10.5px; font-weight: 700;" title="Capacidade imediata com o estoque atual de insumos">✓ ${capacity} un disp.</span>`;
          }
        } else {
          stockHtml = `<span style="color: var(--text-muted); font-size: 11px; font-weight: 500;">Disponível</span>`;
        }

        return `
          <div class="list-row ${statusClass}" data-product-id="${p.id}" style="cursor: pointer;" title="Clique para abrir consulta completa de ${escapeHtml(p.name)}">
            
            <!-- Coluna 1: Foto, Título, Badges e Metadados -->
            <div class="list-main" data-action="view-product-main" data-id="${p.id}" style="display: flex; align-items: center; gap: 12px; min-width: 0;">
              <!-- Mini Thumbnail -->
              <div style="width: 38px; height: 38px; border-radius: 8px; overflow: hidden; background: #f8fafc; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; border: 1px solid var(--border-subtle);">
                ${p.imageUrl || p.image || p.photo 
                  ? `<img src="${escapeHtml(p.imageUrl || p.image || p.photo)}" alt="${escapeHtml(p.name)}" style="width: 100%; height: 100%; object-fit: cover;" />`
                  : (p.categoryId === 'cat_sacolas' ? '🛍️' : p.categoryId === 'cat_festas' ? '🎉' : p.categoryId === 'cat_caixas' ? '📦' : p.categoryId === 'cat_agendas' ? '📔' : '✨')
                }
              </div>

              <!-- Textos -->
              <div style="flex: 1; min-width: 0;">
                <div class="list-title" style="display: flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  <span style="overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.name)}</span>
                  ${p.isKit ? `<span class="badge-count" style="background: #dcfce7; color: #15803d; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px;" title="Vendido em pacotes">📦 Kit ${(p.kitTiers && p.kitTiers.length > 0) ? `(${p.kitTiers.map(t => t.quantity + ' un').join(', ')})` : ''}</span>` : ''}
                  ${isMold ? `<span class="badge-count" style="background: #e0e7ff; color: #3730a3; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px;">📐 Molde</span>` : ''}
                  ${(p.status === 'inativo' || p.active === false) ? `<span class="badge-count" style="background: #f1f5f9; color: #64748b; font-size: 10px; padding: 1px 6px; border-radius: 4px;">Oculto</span>` : ''}
                </div>

                <div class="list-meta" style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span style="font-weight: 500;">${escapeHtml(catName)}</span>
                  <span style="color: #cbd5e1;">•</span>
                  <span style="color: #16a34a; font-weight: 600;">Lucro: R$ ${unitProfit.toFixed(2)} (${marginPct}%)</span>
                  <span style="color: #cbd5e1;">•</span>
                  <span style="color: var(--text-muted); font-weight: 500;">⏱️ ${p.productionTime || 1}d úteis</span>
                </div>
              </div>
            </div>

            <!-- Coluna 2: Preço & Quantidade Disponível (Compacto) -->
            <div style="text-align: right; min-width: 95px; flex-shrink: 0;" data-action="view-product-pricing" data-id="${p.id}">
              <span style="font-weight: 700; font-size: 13.5px; color: var(--text-primary); display: block;">
                ${p.isKit ? `A partir de ${formatCurrency(p.price)}` : formatCurrency(p.price)}
              </span>
              <div style="font-size: 11px; margin-top: 2px; display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
                ${stockHtml}
              </div>
            </div>

            <!-- Coluna 3: Menu de Ações ⋮ -->
            <div class="actions" style="position: relative;">
              <button class="action-btn btn-dots-menu" data-action="toggle-dots-prod" data-id="${p.id}" title="Ações do produto" style="min-width: 36px; min-height: 36px; display: grid; place-items: center; font-weight: bold; font-size: 16px; line-height: 1; cursor: pointer; padding: 4px;">⋮</button>
              <div class="dots-dropdown-menu" id="dots-prod-menu-${p.id}" style="display: none; position: absolute; right: 0; top: 100%; margin-top: 4px; background: #ffffff; border: 1px solid var(--border-strong); border-radius: 8px; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.12); z-index: 50; min-width: 140px; padding: 4px 0;">
                <button class="dots-menu-item" data-action="view-product" data-id="${p.id}">📄 Consultar</button>
                <button class="dots-menu-item" data-action="edit-product" data-id="${p.id}">✏️ Editar</button>
                <button class="dots-menu-item" data-action="dup-product" data-id="${p.id}">📋 Duplicar</button>
                <button class="dots-menu-item" data-action="intel-product" data-id="${p.id}">📊 Intel</button>
                <button class="dots-menu-item" data-action="bulk-product" data-id="${p.id}">⚡ Lote</button>
                ${(p.status === 'inativo' || p.active === false)
                  ? `<button class="dots-menu-item" data-action="unhide-product" data-id="${p.id}">👁️‍🗨️ Reativar</button>`
                  : `<button class="dots-menu-item" data-action="hide-product" data-id="${p.id}">👁️ Ocultar</button>`
                }
                <div style="height: 1px; background: var(--border-subtle); margin: 4px 0;"></div>
                <button class="dots-menu-item" data-action="del-product" data-id="${p.id}" style="color: #ef4444;">🗑️ Excluir</button>
              </div>
            </div>

          </div>
        `;
      }).join('')}
    </div>
  `;

  // Click on entire row immediately opens product details drawer
  container.querySelectorAll('.list-row[data-product-id]').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.actions') || e.target.closest('.dots-dropdown-menu') || e.target.closest('button')) {
        return;
      }
      showProductDetailsDrawer(row.dataset.productId);
    });
  });

  // Explicit click on main and pricing areas
  container.querySelectorAll('[data-action="view-product-main"], [data-action="view-product-pricing"]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      showProductDetailsDrawer(el.dataset.id);
    });
  });

  // Toggle dots menu
  container.querySelectorAll('[data-action="toggle-dots-prod"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const menu = container.querySelector(`#dots-prod-menu-${id}`);
      const isVisible = menu && menu.style.display === 'block';
      container.querySelectorAll('.dots-dropdown-menu').forEach(m => m.style.display = 'none');
      if (menu && !isVisible) {
        menu.style.display = 'block';
      }
    });
  });

  // Bind Actions inside dots menu
  container.querySelectorAll('[data-action="intel-product"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      container.querySelectorAll('.dots-dropdown-menu').forEach(m => m.style.display = 'none');
      openProductIntelligenceDrawer({ productId: el.dataset.id, openDrawer, closeDrawer });
    });
  });

  container.querySelectorAll('[data-action="bulk-product"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      container.querySelectorAll('.dots-dropdown-menu').forEach(m => m.style.display = 'none');
      openBulkPersonalizationModal(openDrawer, closeDrawer, el.dataset.id);
    });
  });

  container.querySelectorAll('[data-action="view-product"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      container.querySelectorAll('.dots-dropdown-menu').forEach(m => m.style.display = 'none');
      showProductDetailsDrawer(el.dataset.id);
    });
  });

  container.querySelectorAll('[data-action="edit-product"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      container.querySelectorAll('.dots-dropdown-menu').forEach(m => m.style.display = 'none');
      openEditProductDrawer(el.dataset.id);
    });
  });

  container.querySelectorAll('[data-action="dup-product"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      container.querySelectorAll('.dots-dropdown-menu').forEach(m => m.style.display = 'none');
      try {
        const dup = duplicateProduct(el.dataset.id);
        renderProductsView();
        showToast(`Produto "${dup.name}" duplicado com sucesso!`, '📋');
      } catch (err) {
        showToast(err.message, '⚠');
      }
    });
  });

  container.querySelectorAll('[data-action="del-product"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      container.querySelectorAll('.dots-dropdown-menu').forEach(m => m.style.display = 'none');
      const p = getProductById(el.dataset.id);
      if (!p) return;
      showConfirmDialog({
        title: 'Excluir Produto',
        message: `Tem certeza que deseja excluir o produto <b>"${escapeHtml(p.name)}"</b> do catálogo?<br><br>Esta ação não pode ser desfeita.`,
        confirmText: 'Sim, Excluir Produto',
        isDanger: true,
        onConfirm: () => {
          const res = deleteProduct(p.id);
          if (!res.success) {
            showToast(res.message, '⚠');
          } else {
            renderProductsView();
            showToast(res.message || 'Produto excluído com sucesso', '🗑️');
          }
        }
      });
    });
  });

  container.querySelectorAll('[data-action="hide-product"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      container.querySelectorAll('.dots-dropdown-menu').forEach(m => m.style.display = 'none');
      const p = getProductById(el.dataset.id);
      if (p) {
        updateProduct(p.id, { status: 'inativo', active: false });
        renderProductsView();
        showToast(`Produto "${p.name}" ocultado do catálogo com sucesso.`);
      }
    });
  });

  container.querySelectorAll('[data-action="unhide-product"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      container.querySelectorAll('.dots-dropdown-menu').forEach(m => m.style.display = 'none');
      const p = getProductById(el.dataset.id);
      if (p) {
        updateProduct(p.id, { status: 'ativo', active: true });
        renderProductsView();
        showToast(`Produto "${p.name}" reativado no catálogo!`, '✅');
      }
    });
  });
}

function renderProductsVitrine(container, products, categories) {
  renderCommercialVitrine(container, products, categories, {
    onOrder: (productId) => {
      openNewOrderDrawer({ productId });
    },
    onPreview: (productId) => {
      openProductCommercialPreviewDrawer({
        productId,
        openDrawerFn: openDrawer,
        closeDrawerFn: closeDrawer,
        onOrderCreate: (prefill) => openNewOrderDrawer(prefill),
        onEditProduct: (id) => openEditProductDrawer(id)
      });
    },
    onBulk: (productId) => {
      openBulkPersonalizationModal(openDrawer, closeDrawer, productId);
    },
    onIntel: (productId) => {
      openProductIntelligenceDrawer({ productId, openDrawer, closeDrawer });
    }
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
      const catId = btn.dataset.id;
      showConfirmDialog({
        title: 'Excluir Categoria',
        message: 'Tem certeza que deseja excluir esta categoria? Os produtos associados não serão apagados, mas ficarão sem categoria.',
        confirmText: 'Sim, Excluir',
        isDanger: true,
        onConfirm: () => {
          const res = deleteCategory(catId);
          if (!res.success) {
            showToast(res.message, '⚠️');
          } else {
            showToast(res.message, '✓');
            renderProductsView();
          }
        }
      });
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
  switchView('pedidos-novo', prefill);
}

function openEditOrderDrawer(orderId) {
  openEditOrderDrawerModule(orderId, getOrdersContext());
}

// ==========================================
// DRAWERS: PRODUCT DETAILS & EDIT/NEW
// ==========================================
function showProductDetailsDrawer(productId) {
  openProductCommercialPreviewDrawer({
    productId,
    openDrawerFn: openDrawer,
    closeDrawerFn: closeDrawer,
    onOrderCreate: (prefill) => openNewOrderDrawer(prefill),
    onEditProduct: (id) => openEditProductDrawer(id)
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
          showToast(err.message || 'Erro ao salvar categoria.', '⚠️');
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
          showToast('Informe ou carregue o conteúdo CSV.', '⚠️');
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

function renderSettingsView(payload = null) {
  const container = document.getElementById('view-container');
  if (!container) return;
  const tab = (typeof payload === 'string') ? payload : (payload && payload.tab) ? payload.tab : undefined;
  renderSettingsModule(container, { tab });
}

// ==========================================
// VIEW SWITCHER
// ==========================================
export function switchView(viewName, payload = null) {
  currentView = viewName;

  // Update active sidebar nav button
  document.querySelectorAll('#sidebar-nav button').forEach(btn => {
    const isActive = (btn.dataset.view === viewName) || 
      ((viewName === 'pedidos-novo' || viewName === 'pedidos-editar') && btn.dataset.view === 'pedidos');
    btn.classList.toggle('active', isActive);
  });

  // Ações rápidas fixas apenas no Dashboard (Início)
  const quickActionsBar = document.getElementById('quick-actions-bar');
  if (quickActionsBar) {
    quickActionsBar.style.display = (viewName === 'inicio') ? 'flex' : 'none';
  }

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
      renderNewOrderPage(document.getElementById('view-container'), getOrdersContext(), null, payload);
      break;
    case 'pedidos-editar':
      renderNewOrderPage(document.getElementById('view-container'), getOrdersContext(), payload, null);
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
      renderSettingsView(payload);
      break;
    case 'aprovar-arte':
      renderOrderApprovalPage(document.getElementById('view-container'), payload || 1048, () => switchView('pedidos'));
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
  // Garantir que a base inicia limpa e sem dados fictícios para uso real
  try {
    if (!localStorage.getItem('papermax.clean_production_ready.v1')) {
      clearAllSystemData(true);
    }
  } catch (e) {
    console.warn('[Init] LocalStorage access check:', e);
  }

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
  // - Escape closes the topmost open layer in strict hierarchical order:
  //   1. Context menu
  //   2. Three dots dropdown menus
  //   3. Confirmation modal
  //   4. Finance modal container
  //   5. Generic active modal
  //   6. Global App Drawer
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      // 1. Context Menu
      const contextMenu = document.getElementById('app-context-menu');
      if (contextMenu) {
        contextMenu.remove();
        return;
      }

      // 2. Dropdown Dots Menus
      let closedDots = false;
      document.querySelectorAll('.dots-dropdown-menu').forEach(m => {
        if (m.style.display === 'block') {
          m.style.display = 'none';
          closedDots = true;
        }
      });
      if (closedDots) return;

      // 3. Confirmation Dialogs
      const confirmBackdrop = document.querySelector('.confirm-dialog-backdrop, #orders-confirm-backdrop');
      if (confirmBackdrop) {
        const cancelBtn = confirmBackdrop.querySelector('#confirm-cancel-btn') || confirmBackdrop.querySelector('.btn-secondary');
        if (cancelBtn) {
          cancelBtn.click();
        } else {
          confirmBackdrop.remove();
        }
        return;
      }

      // 4. Finance Modal Container
      const finModal = document.getElementById('finance-modal-container');
      if (finModal && finModal.children.length > 0 && finModal.innerHTML.trim() !== '') {
        const closeBtn = finModal.querySelector('.btn-close, #btn-close-drawer, #btn-cancel-drawer, #btn-cancel-receive, #btn-cancel-pay-exp, #btn-cancel-pay-payable, #btn-close-rec-drawer, #btn-cancel-rec-drawer, #btn-close-pay-drawer, #btn-cancel-pay-drawer, #btn-cancel-import');
        if (closeBtn) {
          closeBtn.click();
        } else {
          finModal.innerHTML = '';
        }
        return;
      }

      // 5. Generic Modals / Overlays
      const genericModal = document.querySelector('.modal-backdrop:not(.confirm-dialog-backdrop):not(#orders-confirm-backdrop)');
      if (genericModal) {
        const closeBtn = genericModal.querySelector('.btn-close, .btn-secondary, [data-action="close"], #btn-cancel');
        if (closeBtn) {
          closeBtn.click();
        } else {
          genericModal.remove();
        }
        return;
      }

      // 6. Global App Drawer
      const drawer = document.getElementById('app-drawer');
      if (drawer && drawer.classList.contains('active')) {
        closeDrawer();
        return;
      }
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

  // Hash Routing (ex: #/aprovar-arte/1048)
  function handleHashRoute() {
    const hash = window.location.hash || '';
    if (hash.startsWith('#/aprovar-arte/') || hash.startsWith('#aprovar-arte/')) {
      const parts = hash.split('/');
      const orderId = parts[parts.length - 1];
      switchView('aprovar-arte', orderId);
      return true;
    }
    return false;
  }

  window.addEventListener('hashchange', handleHashRoute);

  // Start at initial view or route
  if (!handleHashRoute()) {
    switchView('inicio');
  }

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log('SW registration note:', err);
    });
  }

  // Global Masking Engine for Contact/WhatsApp, CPF, and CNPJ
  document.addEventListener('input', (e) => {
    const target = e.target;
    if (!target || target.tagName !== 'INPUT') return;
    if (target.type === 'file' || target.type === 'checkbox' || target.type === 'radio' || target.type === 'date' || target.type === 'number') return;
    
    const id = (target.id || '').toLowerCase();
    const name = (target.name || '').toLowerCase();
    const mask = target.getAttribute('data-mask');

    // Telefone / Contato / WhatsApp -> (XX) 9 XXXX-XXXX
    const isPhoneField = mask === 'phone' ||
      target.type === 'tel' ||
      id.includes('contato') ||
      id.includes('phone') ||
      id.includes('whatsapp') ||
      id.includes('telefone') ||
      id === 'tel' || id.startsWith('tel-') || id.endsWith('-tel') ||
      name.includes('phone') ||
      name.includes('contato') ||
      name.includes('telefone') ||
      name.includes('whatsapp');

    if (isPhoneField) {
      const val = target.value;
      const formatted = formatPhone(val);
      if (val !== formatted) {
        const oldCursor = target.selectionStart || 0;
        target.value = formatted;
        const diff = formatted.length - val.length;
        const newCursor = Math.max(0, Math.min(formatted.length, oldCursor + diff));
        try { target.setSelectionRange(newCursor, newCursor); } catch (_) {}
      }
      return;
    }

    // CPF -> XXX.XXX.XXX-XX
    const isCpfField = mask === 'cpf' || (id.includes('cpf') && !id.includes('cnpj')) || (name.includes('cpf') && !name.includes('cnpj'));
    if (isCpfField) {
      const val = target.value;
      const formatted = formatCPF(val);
      if (val !== formatted) {
        const oldCursor = target.selectionStart || 0;
        target.value = formatted;
        const diff = formatted.length - val.length;
        const newCursor = Math.max(0, Math.min(formatted.length, oldCursor + diff));
        try { target.setSelectionRange(newCursor, newCursor); } catch (_) {}
      }
      return;
    }

    // CNPJ -> XX.XXX.XXX/XXXX-XX
    const isCnpjField = mask === 'cnpj' || id.includes('cnpj') || name.includes('cnpj');
    if (isCnpjField) {
      const val = target.value;
      const formatted = formatCNPJ(val);
      if (val !== formatted) {
        const oldCursor = target.selectionStart || 0;
        target.value = formatted;
        const diff = formatted.length - val.length;
        const newCursor = Math.max(0, Math.min(formatted.length, oldCursor + diff));
        try { target.setSelectionRange(newCursor, newCursor); } catch (_) {}
      }
      return;
    }

    // Documento misto (CPF ou CNPJ)
    if (mask === 'doc' || mask === 'document' || id.includes('docnumber') || id.includes('documento')) {
      const val = target.value;
      const formatted = formatCPFOrCNPJ(val);
      if (val !== formatted) {
        const oldCursor = target.selectionStart || 0;
        target.value = formatted;
        const diff = formatted.length - val.length;
        const newCursor = Math.max(0, Math.min(formatted.length, oldCursor + diff));
        try { target.setSelectionRange(newCursor, newCursor); } catch (_) {}
      }
    }
  });
}

// Auto-run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

export function openContextMenu(event, options) {
  event.stopPropagation();
  const existing = document.getElementById('app-context-menu');
  if (existing) {
    if (existing._closeListener) {
      document.removeEventListener('click', existing._closeListener);
    }
    existing.remove();
  }

  const targetEl = event.currentTarget || event.target;
  const rect = targetEl.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'app-context-menu';
  menu.style.position = 'fixed';
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${Math.min(rect.left, window.innerWidth - 200)}px`;
  menu.style.background = '#ffffff';
  menu.style.border = '1px solid var(--border-subtle)';
  menu.style.borderRadius = '8px';
  menu.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)';
  menu.style.zIndex = '99999';
  menu.style.minWidth = '170px';
  menu.style.padding = '4px';
  menu.style.display = 'flex';
  menu.style.flexDirection = 'column';
  menu.style.gap = '2px';

  menu.innerHTML = options.map((opt, idx) => `
    <button class="context-menu-item" data-idx="${idx}" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; background: transparent; border: none; border-radius: 6px; text-align: left; font-size: 13px; font-weight: 500; cursor: pointer; color: ${opt.danger ? '#ef4444' : 'var(--text-primary)'};">
      <span>${opt.icon || ''}</span>
      <span>${opt.label}</span>
    </button>
  `).join('');

  document.body.appendChild(menu);

  const removeMenu = () => {
    if (menu._closeListener) {
      document.removeEventListener('click', menu._closeListener);
    }
    menu.remove();
  };

  menu.querySelectorAll('.context-menu-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeMenu();
      const idx = Number(btn.getAttribute('data-idx'));
      if (options[idx] && typeof options[idx].action === 'function') {
        options[idx].action();
      }
    });
  });

  const closeListener = (e) => {
    if (!menu.contains(e.target)) {
      removeMenu();
    }
  };
  menu._closeListener = closeListener;
  setTimeout(() => document.addEventListener('click', closeListener), 0);
}
