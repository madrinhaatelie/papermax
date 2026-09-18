/**
 * PAPER MAX - Integrated Financial UI Module (Etapa 6)
 * 
 * Sub-tabs:
 * 1. 📊 Visão Geral (Dashboard, DRE Realizado vs Previsto, KPIs, Gráfico de Despesas)
 * 2. 🛍️ Vendas (Pedidos integrados, Custos Técnicos, Lucro, Margens e Status de Recebimento)
 * 3. 💸 Despesas (Despesas Operacionais com Categorias, Datas, Pagamento e CSV)
 * 4. 📥 Contas a Receber (Controle de Recebíveis, Baixa de Recebimento, Vencidos)
 * 5. 📤 Contas a Pagar (Contas de Compras & Fixas, Baixa de Pagamento, Vencidos)
 * 6. 🧮 Custos & Margens (Estrutura de Custos de Produtos, BOM, Insumos e Pedidos)
 */

import { openContextMenu, switchView, openDrawer, closeDrawer } from '../../app.js';
import { showConfirmDialog } from '../orders/orders.ui.js';
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  FINANCIAL_PERIODS,
  calculateFinancialMetrics,
  getSalesFromOrders,
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  payExpense,
  getReceivables,
  getReceivableById,
  createReceivable,
  receiveReceivable,
  updateReceivable,
  deleteReceivable,
  getPayables,
  getPayableById,
  createPayable,
  payPayable,
  updatePayable,
  deletePayable,
  getDetailedCostsAnalysis,
  exportExpensesCSV,
  exportExpensesCSVTemplate,
  importExpensesCSV,
  exportReceivablesCSV,
  exportReceivablesCSVTemplate,
  importReceivablesCSV,
  exportPayablesCSV,
  exportPayablesCSVTemplate,
  importPayablesCSV,
  exportSalesCSV
} from './finance.engine.js';
import {
  formatCurrency,
  formatDateBR,
  formatDateShortBR,
  escapeHtml,
  generateId
} from '../../utils/sanitize.js';
import { bus, showToast } from '../../core/events.js';

// State variables for Finance module
let currentFinanceTab = 'visao_geral'; // 'visao_geral' | 'vendas' | 'despesas' | 'a_receber' | 'a_pagar' | 'custos'
let currentPeriod = FINANCIAL_PERIODS.ESTE_MES;
let customDateRange = { startDate: '', endDate: '' };
let salesSearchQuery = '';
let expensesSearchQuery = '';
let expensesCategoryFilter = 'todos';
let expensesStatusFilter = 'todos';
let receivablesSearchQuery = '';
let receivablesStatusFilter = 'todos';
let payablesSearchQuery = '';
let payablesStatusFilter = 'todos';
let costsSubFilter = 'produtos'; // 'produtos' | 'componentes' | 'insumos' | 'pedidos'

/**
 * Main render entry point for the Finance module.
 */
export function renderFinanceModule() {
  const container = document.getElementById('view-container');
  if (!container) return;

  const metrics = calculateFinancialMetrics({
    period: currentPeriod,
    customRange: customDateRange
  });

  container.innerHTML = `
    <!-- Top Header & Action Bar -->
    <div class="module-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; margin-bottom: 20px;">
      <div>
        <h2 class="module-title" style="margin: 0; font-size: 1.75rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 10px; letter-spacing: -0.5px;">
          💰 Gestão Financeira Integrada
        </h2>
        <p style="margin: 4px 0 0 0; font-size: 0.875rem; color: var(--text-secondary);">
          Controle de caixa, fluxo previsto, DRE do ateliê e rentabilidade por produto.
        </p>
      </div>

      <div class="header-actions" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
        <!-- Period Filter Dropdown -->
        <div style="display: flex; align-items: center; gap: 8px; background: var(--bg-card); border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <label for="select-finance-period" style="font-size: 0.875rem; font-weight: 700; color: var(--text-primary); margin: 0; white-space: nowrap;">
            📅 Período:
          </label>
          <select id="select-finance-period" class="form-select" style="padding: 6px 12px; font-size: 0.875rem; font-weight: 600; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; color: var(--text-primary); cursor: pointer; min-width: 170px;">
            <option value="${FINANCIAL_PERIODS.ESTE_MES}" ${currentPeriod === FINANCIAL_PERIODS.ESTE_MES ? 'selected' : ''}>Este Mês</option>
            <option value="${FINANCIAL_PERIODS.MES_ANTERIOR}" ${currentPeriod === FINANCIAL_PERIODS.MES_ANTERIOR ? 'selected' : ''}>Mês Anterior</option>
            <option value="${FINANCIAL_PERIODS.ULTIMOS_30}" ${currentPeriod === FINANCIAL_PERIODS.ULTIMOS_30 ? 'selected' : ''}>Últimos 30 Dias</option>
            <option value="${FINANCIAL_PERIODS.TODO_PERIODO}" ${currentPeriod === FINANCIAL_PERIODS.TODO_PERIODO ? 'selected' : ''}>Todo o Período</option>
            <option value="${FINANCIAL_PERIODS.PERSONALIZADO}" ${currentPeriod === FINANCIAL_PERIODS.PERSONALIZADO ? 'selected' : ''}>Personalizado</option>
          </select>
        </div>

        <button class="btn btn-secondary" id="btn-finance-export-csv" title="Exportar dados da aba atual para CSV" style="padding: 8px 14px; font-weight: 600;">
          ⬇ Exportar CSV
        </button>
        <button class="btn btn-secondary" id="btn-finance-import-csv" title="Importar dados via planilha CSV" style="padding: 8px 14px; font-weight: 600;">
          ⬆ Importar CSV
        </button>
        ${currentFinanceTab === 'a_receber' ? `
          <button class="btn btn-primary" id="btn-quick-new-receivable" style="padding: 9px 18px; font-weight: 700; background: var(--border-focus, #db2777); color: #ffffff; border-radius: 8px;">
            + Nova Conta a Receber
          </button>
        ` : currentFinanceTab === 'a_pagar' ? `
          <button class="btn btn-primary" id="btn-quick-new-payable" style="padding: 9px 18px; font-weight: 700; background: var(--border-focus, #db2777); color: #ffffff; border-radius: 8px;">
            + Nova Conta a Pagar
          </button>
        ` : `
          <button class="btn btn-primary" id="btn-quick-new-expense" style="padding: 9px 18px; font-weight: 700; background: var(--border-focus, #db2777); color: #ffffff; border-radius: 8px;">
            + Nova Despesa
          </button>
        `}
      </div>
    </div>

    ${currentPeriod === FINANCIAL_PERIODS.PERSONALIZADO ? `
      <div style="display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-bottom: 20px; padding: 12px 16px; background: #f1f5f9; border-radius: 8px; border: 1px solid #cbd5e1;">
        <span style="font-size: 0.875rem; font-weight: 600; color: var(--text-primary);">Intervalo Personalizado:</span>
        <input type="text" id="custom-start-date" class="form-input" style="width: 130px; padding: 6px 10px; font-size: 0.875rem;" placeholder="DD/MM/AAAA" value="${escapeHtml(customDateRange.startDate)}" />
        <span style="color: var(--text-secondary); font-size: 0.875rem;">até</span>
        <input type="text" id="custom-end-date" class="form-input" style="width: 130px; padding: 6px 10px; font-size: 0.875rem;" placeholder="DD/MM/AAAA" value="${escapeHtml(customDateRange.endDate)}" />
        <button class="btn btn-sm btn-primary" id="btn-apply-custom-date" style="padding: 6px 16px; font-weight: 600;">Aplicar</button>
      </div>
    ` : ''}

    <!-- HORIZONTAL DIVIDER 1 -->
    <div style="height: 1px; background: #e2e8f0; margin: 0 0 24px 0; width: 100%;"></div>

    <!-- Navigation Tabs Bar (Divisórias de Fichário Horizontais Padrão Global) -->
    <div class="finance-tab-bar" style="display: flex; gap: 4px; margin-bottom: 24px; border-bottom: 2px solid #cbd5e1; padding-bottom: 0; overflow-x: auto; align-items: flex-end;">
      ${[
        { id: 'visao_geral', label: '📊 Visão Geral' },
        { id: 'vendas', label: '🛍️ Vendas & Faturamento' },
        { id: 'despesas', label: '💸 Despesas Operacionais' },
        { id: 'a_receber', label: '📥 Contas a Receber' },
        { id: 'a_pagar', label: '📤 Contas a Pagar' },
        { id: 'custos', label: '🧮 Custos & Margens' }
      ].map(tab => {
        const isActive = currentFinanceTab === tab.id;
        return `
          <button class="tab-btn ${isActive ? 'active' : ''}" data-finance-tab="${tab.id}">
            ${tab.label}
          </button>
        `;
      }).join('')}
    </div>

    <!-- Sub-tab Render Container -->
    <div id="finance-subtab-container">
      ${renderActiveFinanceSubtab(metrics)}
    </div>
  `;

  attachFinanceEventListeners();
}

/**
 * Renders the content of the currently active subtab.
 */
function renderActiveFinanceSubtab(metrics) {
  switch (currentFinanceTab) {
    case 'visao_geral':
      return renderVisaoGeralTab(metrics);
    case 'vendas':
      return renderVendasTab();
    case 'despesas':
      return renderDespesasTab();
    case 'a_receber':
      return renderAReceberTab();
    case 'a_pagar':
      return renderAPagarTab();
    case 'custos':
      return renderCustosTab();
    default:
      return renderVisaoGeralTab(metrics);
  }
}

// ==========================================
// 1. SUBTAB: VISÃO GERAL (DASHBOARD & DRE)
// ==========================================

function renderVisaoGeralTab(metrics) {
  const isPositiveRealized = metrics.saldoRealizado >= 0;
  const isPositivePredicted = metrics.resultadoPrevisto >= 0;

  return `
    <div style="display: flex; flex-direction: column; gap: 28px;">
      
      <!-- REALIZADO vs PREVISTO Split Cards (2 Colunas) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 24px;">
        
        <!-- Bloco 1: FLUXO DE CAIXA -->
        <div class="card" style="padding: 24px 28px; border: 1px solid #cbd5e1; border-top: 5px solid #10b981; border-radius: 12px; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.5rem;">💵</span>
              <div>
                <h3 style="margin: 0; font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px;">FLUXO DE CAIXA</h3>
                <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">(Entradas − Saídas = Saldo Total)</span>
              </div>
            </div>
            <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #047857; font-size: 0.8125rem; font-weight: 700; padding: 5px 12px; border-radius: 16px;">
              Efetivado no Caixa
            </span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px dashed #cbd5e1;">
            <div style="background: #f8fafc; padding: 12px 14px; border-radius: 8px;">
              <span style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Entradas</span>
              <div style="font-size: 1.5rem; font-weight: 800; color: #059669; margin-top: 6px;">
                ${formatCurrency(metrics.entradasRealizadas)}
              </div>
            </div>
            <div style="background: #f8fafc; padding: 12px 14px; border-radius: 8px;">
              <span style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Saídas</span>
              <div style="font-size: 1.5rem; font-weight: 800; color: #dc2626; margin-top: 6px;">
                ${formatCurrency(metrics.saidasRealizadas)}
              </div>
              <div style="font-size: 0.75rem; color: #64748b; margin-top: 6px; font-weight: 600;">
                Compras: ${formatCurrency(metrics.saidasCompras)} · Desp: ${formatCurrency(metrics.saidasDespesas)}
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; background: #f0fdf4; padding: 14px 18px; border-radius: 10px; border: 1px solid #bbf7d0;">
            <span style="font-size: 0.9375rem; font-weight: 700; color: #166534;">Saldo Total:</span>
            <span style="font-size: 1.625rem; font-weight: 900; color: ${isPositiveRealized ? '#047857' : '#dc2626'};">
              ${formatCurrency(metrics.saldoRealizado)}
            </span>
          </div>
        </div>

        <!-- Bloco 2: PREVISTO -->
        <div class="card" style="padding: 24px 28px; border: 1px solid #cbd5e1; border-top: 5px solid #f59e0b; border-radius: 12px; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.5rem;">⏳</span>
              <div>
                <h3 style="margin: 0; font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px;">PREVISTO</h3>
                <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">(A Receber − A Pagar = Previsto)</span>
              </div>
            </div>
            <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #b45309; font-size: 0.8125rem; font-weight: 700; padding: 5px 12px; border-radius: 16px;">
              A Vencer / Vencido
            </span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px dashed #cbd5e1;">
            <div style="background: #f8fafc; padding: 12px 14px; border-radius: 8px;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">A Receber</span>
                ${metrics.countReceberVencido > 0 ? `<span style="font-size: 0.6875rem; color: #dc2626; font-weight: 700;">(${metrics.countReceberVencido} venc.)</span>` : ''}
              </div>
              <div style="font-size: 1.5rem; font-weight: 800; color: #d97706; margin-top: 6px;">
                ${formatCurrency(metrics.totalAReceber)}
              </div>
            </div>
            <div style="background: #f8fafc; padding: 12px 14px; border-radius: 8px;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">A Pagar</span>
                ${metrics.countPagarVencido > 0 ? `<span style="font-size: 0.6875rem; color: #dc2626; font-weight: 700;">(${metrics.countPagarVencido} venc.)</span>` : ''}
              </div>
              <div style="font-size: 1.5rem; font-weight: 800; color: #7c3aed; margin-top: 6px;">
                ${formatCurrency(metrics.totalAPagar)}
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; background: #fffbe6; padding: 14px 18px; border-radius: 10px; border: 1px solid #fde68a;">
            <span style="font-size: 0.9375rem; font-weight: 700; color: #92400e;">Previsto:</span>
            <span style="font-size: 1.625rem; font-weight: 900; color: ${isPositivePredicted ? '#047857' : '#dc2626'};">
              ${formatCurrency(metrics.resultadoPrevisto)}
            </span>
          </div>
        </div>

      </div>

      <!-- HORIZONTAL DIVIDER 2 -->
      <div style="height: 1px; background: #e2e8f0; margin: 8px 0; width: 100%;"></div>

      <!-- Demonstrativo de Resultado (DRE Gerencial Sintético) & Guia / Glossário -->
      <div class="card" style="padding: 24px 28px; border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <h4 style="margin: 0 0 20px 0; font-size: 1.125rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 8px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">
          📑 DRE Gerencial Sintético (${formatPeriodLabel(metrics.period)})
        </h4>

        <div style="display: flex; flex-direction: column; gap: 14px; font-size: 0.9375rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <span style="font-weight: 700; color: var(--text-primary);">(+) Receita Bruta de Vendas</span>
            <span style="font-weight: 800; color: #059669; font-size: 1.0625rem;">${formatCurrency(metrics.totalVendas)}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <span style="color: #475569; font-weight: 600;">(-) Custo das Mercadorias Vendidas (CMV dos papéis e insumos)</span>
            <span style="color: #dc2626; font-weight: 700; font-size: 1.0625rem;">${formatCurrency(metrics.totalCustoMercadorias)}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
            <span style="font-weight: 800; color: #1e40af; font-size: 1rem;">(=) Lucro Bruto da Produção</span>
            <span style="font-weight: 900; color: #2563eb; font-size: 1.125rem;">${formatCurrency(metrics.lucroBrutoVendas)}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <span style="color: #475569; font-weight: 600;">(-) Despesas Operacionais Realizadas</span>
            <span style="color: #dc2626; font-weight: 700; font-size: 1.0625rem;">${formatCurrency(metrics.saidasDespesas)}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; background: #f0fdf4; border-radius: 10px; border: 2px solid #86efac; margin-top: 8px;">
            <span style="font-weight: 900; color: #166534; font-size: 1.0625rem;">(=) Resultado Operacional Líquido</span>
            <span style="font-weight: 900; color: ${metrics.resultadoOperacional >= 0 ? '#047857' : '#dc2626'}; font-size: 1.375rem;">
              ${formatCurrency(metrics.resultadoOperacional)}
            </span>
          </div>
        </div>

        <!-- HORIZONTAL DIVIDER 3 -->
        <div style="height: 1px; background: #e2e8f0; margin: 24px 0 20px 0; width: 100%;"></div>

        <!-- Guia / Glossário: Explicação Didática dos Termos Financeiros do Ateliê -->
        <div style="padding: 18px 20px; background: #f8fafc; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 0.875rem; color: #475569; line-height: 1.7;">
          <b style="color: #0f172a; display: block; margin-bottom: 10px; font-size: 0.9375rem;">💡 Guia / Glossário — Termos Financeiros do Ateliê:</b>
          <div style="margin-bottom: 6px;">• <b>(+) Receita Bruta de Vendas:</b> Faturamento bruto total obtido com as vendas de pedidos no período.</div>
          <div style="margin-bottom: 6px;">• <b>(-) Custo das Mercadorias Vendidas (CMV):</b> Custo direto dos materiais, papéis, acrílicos e insumos utilizados na fabricação dos produtos.</div>
          <div style="margin-bottom: 6px;">• <b>(=) Lucro Bruto da Produção:</b> Sobra financeira direta das vendas após abater o custo dos materiais.</div>
          <div style="margin-bottom: 6px;">• <b>(-) Despesas Operacionais Realizadas:</b> Gastos fixos e operacionais do ateliê (aluguel, energia, sistemas, manutenção, embalagens).</div>
          <div>• <b>(=) Resultado Operacional Líquido:</b> O lucro real do ateliê que sobra para o negócio após cobrir todos os custos e despesas.</div>
        </div>
      </div>

    </div>
  `;
}

function formatPeriodLabel(periodKey) {
  switch (periodKey) {
    case FINANCIAL_PERIODS.ESTE_MES: return 'Este Mês';
    case FINANCIAL_PERIODS.MES_ANTERIOR: return 'Mês Anterior';
    case FINANCIAL_PERIODS.ULTIMOS_30: return 'Últimos 30 Dias';
    case FINANCIAL_PERIODS.TODO_PERIODO: return 'Todo o Período';
    case FINANCIAL_PERIODS.PERSONALIZADO: return 'Personalizado';
    default: return 'Período Atual';
  }
}

// ==========================================
// 2. SUBTAB: VENDAS (DERIVADAS DE PEDIDOS)
// ==========================================

function renderVendasTab() {
  const sales = getSalesFromOrders({
    period: currentPeriod,
    customRange: customDateRange,
    search: salesSearchQuery
  });

  let totalSalesSum = 0;
  let totalCostSum = 0;
  let totalProfitSum = 0;

  sales.forEach(s => {
    totalSalesSum += s.totalSale;
    totalCostSum += s.totalCost;
    totalProfitSum += s.profit;
  });

  const avgMargin = totalSalesSum > 0 ? (totalProfitSum / totalSalesSum) * 100 : 0;

  return `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      
      <!-- Toolbar & Search -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; background: #ffffff; padding: 18px 24px; border-radius: 12px; border: 1px solid #cbd5e1; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <input 
            type="text" 
            id="input-search-sales" 
            class="form-input" 
            placeholder="🔍 Buscar por pedido, cliente ou produto..." 
            value="${escapeHtml(salesSearchQuery)}"
            style="width: 300px; padding: 8px 14px; font-size: 0.875rem;"
          />
        </div>
        <div style="display: flex; gap: 24px; align-items: center; font-size: 0.9375rem;">
          <div><strong>Total Vendas:</strong> <span style="color: #059669; font-weight: 800; font-size: 1.0625rem;">${formatCurrency(totalSalesSum)}</span></div>
          <div><strong>Custo Total:</strong> <span style="color: #dc2626; font-weight: 700;">${formatCurrency(totalCostSum)}</span></div>
          <div><strong>Lucro:</strong> <span style="color: #2563eb; font-weight: 800; font-size: 1.0625rem;">${formatCurrency(totalProfitSum)}</span></div>
          <div><strong>Margem:</strong> <span class="badge" style="background: rgba(37, 99, 235, 0.15); color: #1d4ed8; font-weight: 800; padding: 6px 12px; font-size: 0.875rem; border-radius: 12px;">${avgMargin.toFixed(1)}%</span></div>
        </div>
      </div>

      <!-- HORIZONTAL DIVIDER -->
      <div style="height: 1px; background: #e2e8f0; margin: 4px 0; width: 100%;"></div>

      <!-- Sales List -->
      <div class="card" style="padding: 0; background: transparent; border: none; box-shadow: none;">
        <div class="list-group" style="display: flex; flex-direction: column; gap: 12px;">
            ${sales.length === 0 ? `
              <div style="text-align: center; padding: 48px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; color: var(--text-secondary);">
                Nenhuma venda encontrada para os critérios selecionados.
              </div>
            ` : sales.map(s => {
              const isReceived = s.receivingStatus === 'recebido';
              const statusClass = isReceived ? 'status-green' : 'status-yellow';
              return `
                <div class="list-row ${statusClass}" style="padding: 16px 20px; border-radius: 10px; border: 1px solid #e2e8f0; cursor: pointer;" data-action="view-sale" data-id="${s.orderNumber}">
                  <div class="list-main">
                    <div class="list-title" style="display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 0.9375rem;">
                      ${s.orderNumber} - ${escapeHtml(s.customer)}
                      ${s.hasSnapshot ? '<span title="Custo e preço fixados no snapshot do pedido" style="font-size: 0.8125rem; color: #2563eb;">📸</span>' : ''}
                    </div>
                    <div class="list-meta" style="margin-top: 6px; color: #64748b; font-size: 0.875rem;">
                      ${escapeHtml(s.productTitle)} · ${s.qty} un · Preço Unit: ${formatCurrency(s.unitPrice)}
                    </div>
                  </div>
                  <div style="text-align: right; min-width: 150px;">
                    <span style="font-weight: 800; font-size: 1.0625rem; color: #059669;">+${formatCurrency(s.totalSale)}</span>
                    <div style="font-size: 0.8125rem; color: var(--text-muted); margin-top: 4px;">
                      Lucro: <span style="color: ${s.profit >= 0 ? '#059669' : '#dc2626'}; font-weight: 700;">${formatCurrency(s.profit)}</span> (${s.marginPercent.toFixed(1)}%)
                    </div>
                  </div>
                  <div class="actions" onclick="event.stopPropagation();">
                    <button class="action-btn btn-secondary btn-sale-menu" data-id="${s.orderNumber}" data-rec-id="${s.receivableId || ''}" style="padding: 6px 12px; font-size: 14px;" title="Ações">⋮</button>
                  </div>
                </div>
              `;
            }).join('')}
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 3. SUBTAB: DESPESAS OPERACIONAIS
// ==========================================

function renderDespesasTab() {
  const expenses = getExpenses({
    period: currentPeriod,
    customRange: customDateRange,
    search: expensesSearchQuery,
    category: expensesCategoryFilter,
    status: expensesStatusFilter
  });

  let totalExpensesSum = 0;
  let paidExpensesSum = 0;
  let openExpensesSum = 0;

  expenses.forEach(e => {
    const amt = Number(e.amount) || 0;
    totalExpensesSum += amt;
    if (e.status === 'pago') paidExpensesSum += amt;
    else openExpensesSum += amt;
  });

  return `
    <div style="display: flex; flex-direction: column; gap: 20px;">
      
      <!-- Toolbar & Filters -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; background: var(--bg-card); padding: 14px 20px; border-radius: 10px; border: 1px solid var(--border-subtle);">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <input 
            type="text" 
            id="input-search-expenses" 
            class="form-input" 
            placeholder="🔍 Buscar despesa..." 
            value="${escapeHtml(expensesSearchQuery)}"
            style="width: 200px;"
          />
          <select id="select-category-expenses" class="form-select" style="width: 160px;">
            <option value="todos" ${expensesCategoryFilter === 'todos' ? 'selected' : ''}>Todas Categorias</option>
            ${EXPENSE_CATEGORIES.map(cat => `
              <option value="${cat}" ${expensesCategoryFilter === cat ? 'selected' : ''}>${cat}</option>
            `).join('')}
          </select>
          <select id="select-status-expenses" class="form-select" style="width: 140px;">
            <option value="todos" ${expensesStatusFilter === 'todos' ? 'selected' : ''}>Todos Status</option>
            <option value="aberto" ${expensesStatusFilter === 'aberto' ? 'selected' : ''}>Aberto</option>
            <option value="pago" ${expensesStatusFilter === 'pago' ? 'selected' : ''}>Pago</option>
          </select>
        </div>

        <div style="display: flex; gap: 20px; align-items: center; font-size: 0.875rem;">
          <div><strong>Total:</strong> <span style="color: var(--text-primary); font-weight: 700;">${formatCurrency(totalExpensesSum)}</span></div>
          <div><strong>Pago:</strong> <span style="color: #ef4444; font-weight: 700;">${formatCurrency(paidExpensesSum)}</span></div>
          <div><strong>A Pagar:</strong> <span style="color: #f59e0b; font-weight: 700;">${formatCurrency(openExpensesSum)}</span></div>
        </div>
      </div>

      <hr style="border: none; border-top: 1px solid var(--border-subtle); margin: 4px 0;" />

      <!-- Expenses List -->
      <div class="card" style="padding: 0; background: transparent; border: none; box-shadow: none;">
        <div class="list-group" style="display: flex; flex-direction: column; gap: 10px;">
            ${expenses.length === 0 ? `
              <div style="text-align: center; padding: 40px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 10px; color: var(--text-secondary);">
                Nenhuma despesa encontrada.
              </div>
            ` : expenses.map(e => {
              const isPaid = e.status === 'pago';
              const statusClass = isPaid ? 'status-green' : 'status-yellow';
              
              return `
                <div class="list-row ${statusClass}" style="padding: 14px 18px; border-radius: 8px; cursor: pointer;" data-action="view-expense" data-id="${e.id}">
                  <div class="list-main">
                    <div class="list-title" style="display: flex; align-items: center; gap: 8px; font-weight: 600;">
                      ${escapeHtml(e.description)}
                      <span class="badge-count" style="background: rgba(100, 116, 139, 0.12); color: var(--text-secondary); font-size: 11px; padding: 2px 8px;">${escapeHtml(e.category || 'Operacional')}</span>
                    </div>
                    <div class="list-meta" style="margin-top: 4px;">
                      Emissão: ${e.date || '--/--/----'} · Vencimento: ${e.dueDate || '--/--/----'}
                    </div>
                  </div>
                  <div style="text-align: right; min-width: 140px;">
                    <span style="font-weight: 700; font-size: 14px; color: #ef4444;">${formatCurrency(e.amount)}</span>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${isPaid ? `✓ Pago (${escapeHtml(e.paymentMethod || 'Pix')})` : '⏳ Em Aberto'}</div>
                  </div>
                  <div class="actions" onclick="event.stopPropagation();">
                    <button class="action-btn btn-secondary btn-expense-menu" data-id="${e.id}" style="padding: 6px 10px; font-size: 14px;" title="Ações">⋮</button>
                  </div>
                </div>
              `;
            }).join('')}
        </div>
      </div>

    </div>
  `;
}

// ==========================================
// 4. SUBTAB: CONTAS A RECEBER
// ==========================================

function renderAReceberTab() {
  const receivables = getReceivables({
    period: currentPeriod,
    customRange: customDateRange,
    search: receivablesSearchQuery,
    status: receivablesStatusFilter
  });

  let totalRecSum = 0;
  let receivedSum = 0;
  let pendingRecSum = 0;

  receivables.forEach(r => {
    const amt = Number(r.amount) || 0;
    totalRecSum += amt;
    if (r.status === 'recebido') receivedSum += amt;
    else pendingRecSum += amt;
  });

  return `
    <div style="display: flex; flex-direction: column; gap: 20px;">
      
      <!-- Toolbar & Filters -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; background: var(--bg-card); padding: 14px 20px; border-radius: 10px; border: 1px solid var(--border-subtle);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <input 
            type="text" 
            id="input-search-receivables" 
            class="form-input" 
            placeholder="🔍 Buscar por cliente ou descrição..." 
            value="${escapeHtml(receivablesSearchQuery)}"
            style="width: 260px;"
          />
          <select id="select-status-receivables" class="form-select" style="width: 150px;">
            <option value="todos" ${receivablesStatusFilter === 'todos' ? 'selected' : ''}>Todos Status</option>
            <option value="aberto" ${receivablesStatusFilter === 'aberto' ? 'selected' : ''}>Em Aberto</option>
            <option value="recebido" ${receivablesStatusFilter === 'recebido' ? 'selected' : ''}>Recebido</option>
          </select>
        </div>

        <div style="display: flex; gap: 20px; align-items: center; font-size: 0.875rem;">
          <div><strong>Total:</strong> <span style="color: var(--text-primary); font-weight: 700;">${formatCurrency(totalRecSum)}</span></div>
          <div><strong>Recebido:</strong> <span style="color: #10b981; font-weight: 700;">${formatCurrency(receivedSum)}</span></div>
          <div><strong>A Receber:</strong> <span style="color: #f59e0b; font-weight: 700;">${formatCurrency(pendingRecSum)}</span></div>
        </div>
      </div>

      <hr style="border: none; border-top: 1px solid var(--border-subtle); margin: 4px 0;" />

      <!-- Receivables List -->
      <div class="card" style="padding: 0; background: transparent; border: none; box-shadow: none;">
        <div class="list-group" style="display: flex; flex-direction: column; gap: 10px;">
            ${receivables.length === 0 ? `
              <div style="text-align: center; padding: 40px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 10px; color: var(--text-secondary);">
                Nenhuma conta a receber encontrada.
              </div>
            ` : receivables.map(r => {
              const isReceived = r.status === 'recebido';
              const statusClass = isReceived ? 'status-green' : 'status-yellow';
              
              return `
                <div class="list-row ${statusClass}" style="padding: 14px 18px; border-radius: 8px; cursor: pointer;" data-action="view-receivable" data-id="${r.id}">
                  <div class="list-main">
                    <div class="list-title" style="display: flex; align-items: center; gap: 8px; font-weight: 600;">
                      ${escapeHtml(r.customer || 'Cliente')}
                      ${r.orderId ? `<span class="badge-count" style="background: rgba(59, 130, 246, 0.12); color: #3b82f6; font-size: 11px; padding: 2px 8px;">Pedido ${r.orderId}</span>` : ''}
                    </div>
                    <div class="list-meta" style="margin-top: 4px;">
                      ${escapeHtml(r.description)} · Vencimento: ${r.dueDate || '--/--/----'}
                    </div>
                  </div>
                  <div style="text-align: right; min-width: 140px;">
                    <span style="font-weight: 700; font-size: 14px; color: #10b981;">${formatCurrency(r.amount)}</span>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${isReceived ? `✓ Recebido (${escapeHtml(r.paymentMethod || 'Pix')})` : '⏳ Em Aberto'}</div>
                  </div>
                  <div class="actions" onclick="event.stopPropagation();">
                    <button class="action-btn btn-secondary btn-receivable-menu" data-id="${r.id}" style="padding: 6px 10px; font-size: 14px;" title="Ações">⋮</button>
                  </div>
                </div>
              `;
            }).join('')}
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 5. SUBTAB: CONTAS A PAGAR
// ==========================================

function renderAPagarTab() {
  const payables = getPayables({
    period: currentPeriod,
    customRange: customDateRange,
    search: payablesSearchQuery,
    status: payablesStatusFilter
  });

  let totalPaySum = 0;
  let paidSum = 0;
  let pendingPaySum = 0;

  payables.forEach(p => {
    const amt = Number(p.amount) || 0;
    totalPaySum += amt;
    if (p.status === 'pago') paidSum += amt;
    else pendingPaySum += amt;
  });

  return `
    <div style="display: flex; flex-direction: column; gap: 20px;">
      
      <!-- Toolbar & Filters -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; background: var(--bg-card); padding: 14px 20px; border-radius: 10px; border: 1px solid var(--border-subtle);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <input 
            type="text" 
            id="input-search-payables" 
            class="form-input" 
            placeholder="🔍 Buscar por fornecedor ou descrição..." 
            value="${escapeHtml(payablesSearchQuery)}"
            style="width: 260px;"
          />
          <select id="select-status-payables" class="form-select" style="width: 150px;">
            <option value="todos" ${payablesStatusFilter === 'todos' ? 'selected' : ''}>Todos Status</option>
            <option value="aberto" ${payablesStatusFilter === 'aberto' ? 'selected' : ''}>Em Aberto</option>
            <option value="pago" ${payablesStatusFilter === 'pago' ? 'selected' : ''}>Pago</option>
          </select>
        </div>

        <div style="display: flex; gap: 20px; align-items: center; font-size: 0.875rem;">
          <div><strong>Total:</strong> <span style="color: var(--text-primary); font-weight: 700;">${formatCurrency(totalPaySum)}</span></div>
          <div><strong>Pago:</strong> <span style="color: #ef4444; font-weight: 700;">${formatCurrency(paidSum)}</span></div>
          <div><strong>A Pagar:</strong> <span style="color: #f59e0b; font-weight: 700;">${formatCurrency(pendingPaySum)}</span></div>
        </div>
      </div>

      <hr style="border: none; border-top: 1px solid var(--border-subtle); margin: 4px 0;" />

      <!-- Payables List -->
      <div class="card" style="padding: 0; background: transparent; border: none; box-shadow: none;">
        <div class="list-group" style="display: flex; flex-direction: column; gap: 10px;">
            ${payables.length === 0 ? `
              <div style="text-align: center; padding: 40px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 10px; color: var(--text-secondary);">
                Nenhuma conta a pagar encontrada.
              </div>
            ` : payables.map(p => {
              const isPaid = p.status === 'pago';
              const statusClass = isPaid ? 'status-green' : 'status-yellow';
              return `
                <div class="list-row ${statusClass}" style="padding: 14px 18px; border-radius: 8px; cursor: pointer;" data-action="view-payable" data-id="${p.id}">
                  <div class="list-main">
                    <div class="list-title" style="display: flex; align-items: center; gap: 8px; font-weight: 600;">
                      ${escapeHtml(p.supplierName || 'Fornecedor')}
                      ${p.purchaseId ? `<span class="badge-count" style="background: rgba(139, 92, 246, 0.12); color: #8b5cf6; font-size: 11px; padding: 2px 8px;">Compra ${p.purchaseId}</span>` : ''}
                    </div>
                    <div class="list-meta" style="margin-top: 4px;">
                      ${escapeHtml(p.description)} · Vencimento: ${p.dueDate || '--/--/----'}
                    </div>
                  </div>
                  <div style="text-align: right; min-width: 140px;">
                    <span style="font-weight: 700; font-size: 14px; color: #ef4444;">${formatCurrency(p.amount)}</span>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${isPaid ? `✓ Pago (${escapeHtml(p.paymentMethod || 'Pix')})` : '⏳ Em Aberto'}</div>
                  </div>
                  <div class="actions" onclick="event.stopPropagation();">
                    <button class="action-btn btn-secondary btn-payable-menu" data-id="${p.id}" style="padding: 6px 10px; font-size: 14px;" title="Ações">⋮</button>
                  </div>
                </div>
              `;
            }).join('')}
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 6. SUBTAB: CUSTOS & MARGENS (BOM)
// ==========================================

function renderCustosTab() {
  const analysis = getDetailedCostsAnalysis();

  return `
    <div style="display: flex; flex-direction: column; gap: 20px;">
      
      <!-- Sub-filter Switcher (Divisórias de Fichário Horizontais Padrão) -->
      <div class="subtabs-binder" style="display: flex; gap: 4px; border-bottom: 2px solid #cbd5e1; padding-bottom: 0; overflow-x: auto; align-items: flex-end; margin-bottom: 8px;">
        <button class="tab-btn ${costsSubFilter === 'produtos' ? 'active' : ''}" data-cost-filter="produtos">
          📦 Custos de Produtos (${analysis.products.length})
        </button>
        <button class="tab-btn ${costsSubFilter === 'componentes' ? 'active' : ''}" data-cost-filter="componentes">
          ⚙️ Custos de Componentes (${analysis.components.length})
        </button>
        <button class="tab-btn ${costsSubFilter === 'insumos' ? 'active' : ''}" data-cost-filter="insumos">
          🧵 Insumos Base (${analysis.materials.length})
        </button>
        <button class="tab-btn ${costsSubFilter === 'pedidos' ? 'active' : ''}" data-cost-filter="pedidos">
          📋 Lucratividade por Pedido (${analysis.orders.length})
        </button>
      </div>

      ${costsSubFilter === 'produtos' ? `
        <div class="card" style="padding: 0; overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: 8px;">
          <table class="data-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem;">
            <thead>
              <tr style="background: var(--bg-hover); border-bottom: 1px solid var(--border-subtle);">
                <th style="padding: 10px 14px;">Produto</th>
                <th style="padding: 10px 14px; text-align: center;">Ficha Técnica</th>
                <th style="padding: 10px 14px; text-align: right;">Preço de Venda</th>
                <th style="padding: 10px 14px; text-align: right;">Custo Unit. Real</th>
                <th style="padding: 10px 14px; text-align: right;">Margem Contrib. (R$)</th>
                <th style="padding: 10px 14px; text-align: center;">Margem (%)</th>
              </tr>
            </thead>
            <tbody>
              ${analysis.products.map(p => `
                <tr class="cost-row-clickable" data-cost-type="product" data-item-id="${p.id}" style="border-bottom: 1px solid var(--border-subtle); cursor: pointer;" title="Clique para ver o detalhamento técnico e margens deste produto">
                  <td style="padding: 10px 14px; font-weight: 600; color: var(--text-primary);">
                    ${escapeHtml(p.name)}
                  </td>
                  <td style="padding: 10px 14px; text-align: center;">
                    ${p.hasBOM ? `
                      <span class="badge" style="background: rgba(59, 130, 246, 0.12); color: #2563eb; font-weight: 600;">
                        ✓ Ficha Técnica (${p.bomItemsCount} itens)
                      </span>
                    ` : `
                      <span class="badge" style="background: rgba(100, 116, 139, 0.12); color: var(--text-secondary);">
                        Custo Fixo
                      </span>
                    `}
                  </td>
                  <td style="padding: 10px 14px; text-align: right; font-weight: 700; color: #10b981;">
                    ${formatCurrency(p.price)}
                  </td>
                  <td style="padding: 10px 14px; text-align: right; font-weight: 600; color: #ef4444;">
                    ${formatCurrency(p.cost)}
                  </td>
                  <td style="padding: 10px 14px; text-align: right; font-weight: 700; color: ${p.marginAmount >= 0 ? '#10b981' : '#ef4444'};">
                    ${formatCurrency(p.marginAmount)}
                  </td>
                  <td style="padding: 10px 14px; text-align: center;">
                    <span class="badge" style="background: ${p.marginPercent >= 50 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; color: ${p.marginPercent >= 50 ? '#059669' : '#d97706'}; font-weight: 700;">
                      ${p.marginPercent.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${costsSubFilter === 'componentes' ? `
        <div class="card" style="padding: 0; overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: 8px;">
          <table class="data-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem;">
            <thead>
              <tr style="background: var(--bg-hover); border-bottom: 1px solid var(--border-subtle);">
                <th style="padding: 10px 14px;">Componente</th>
                <th style="padding: 10px 14px; text-align: center;">Rendimento</th>
                <th style="padding: 10px 14px; text-align: center;">Estoque Físico</th>
                <th style="padding: 10px 14px; text-align: right;">Custo Unitário Calculado</th>
              </tr>
            </thead>
            <tbody>
              ${analysis.components.map(c => `
                <tr class="cost-row-clickable" data-cost-type="component" data-item-id="${c.id}" style="border-bottom: 1px solid var(--border-subtle); cursor: pointer;" title="Clique para ver a ficha técnica e insumos deste componente">
                  <td style="padding: 10px 14px; font-weight: 600; color: var(--text-primary);">
                    ${escapeHtml(c.name)}
                  </td>
                  <td style="padding: 10px 14px; text-align: center;">
                    ${c.yield} un
                  </td>
                  <td style="padding: 10px 14px; text-align: center; font-weight: 600;">
                    ${c.currentStock} un
                  </td>
                  <td style="padding: 10px 14px; text-align: right; font-weight: 700; color: #2563eb;">
                    ${formatCurrency(c.unitCost)} / un
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${costsSubFilter === 'insumos' ? `
        <div class="card" style="padding: 0; overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: 8px;">
          <table class="data-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem;">
            <thead>
              <tr style="background: var(--bg-hover); border-bottom: 1px solid var(--border-subtle);">
                <th style="padding: 10px 14px;">Insumo</th>
                <th style="padding: 10px 14px;">Embalagem Compra</th>
                <th style="padding: 10px 14px; text-align: right;">Custo da Embalagem</th>
                <th style="padding: 10px 14px; text-align: right;">Custo Unitário Base</th>
                <th style="padding: 10px 14px; text-align: center;">Estoque Atual</th>
              </tr>
            </thead>
            <tbody>
              ${analysis.materials.map(m => `
                <tr class="cost-row-clickable" data-cost-type="material" data-item-id="${m.id}" style="border-bottom: 1px solid var(--border-subtle); cursor: pointer;" title="Clique para ver o histórico e ficha deste insumo">
                  <td style="padding: 10px 14px; font-weight: 600; color: var(--text-primary);">
                    ${escapeHtml(m.name)}
                  </td>
                  <td style="padding: 10px 14px; color: var(--text-secondary);">
                    ${m.packType} c/ ${m.packQty} ${m.baseUnit}
                  </td>
                  <td style="padding: 10px 14px; text-align: right; font-weight: 600;">
                    ${formatCurrency(m.packCost)}
                  </td>
                  <td style="padding: 10px 14px; text-align: right; font-weight: 700; color: #2563eb;">
                    ${formatCurrency(m.unitCost)} / ${m.baseUnit}
                  </td>
                  <td style="padding: 10px 14px; text-align: center; font-weight: 600;">
                    ${m.currentStock} ${m.baseUnit}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${costsSubFilter === 'pedidos' ? `
        <div class="card" style="padding: 0; overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: 8px;">
          <table class="data-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem;">
            <thead>
              <tr style="background: var(--bg-hover); border-bottom: 1px solid var(--border-subtle);">
                <th style="padding: 10px 14px;">Pedido</th>
                <th style="padding: 10px 14px;">Cliente</th>
                <th style="padding: 10px 14px;">Produto</th>
                <th style="padding: 10px 14px; text-align: right;">Receita</th>
                <th style="padding: 10px 14px; text-align: right;">Custo</th>
                <th style="padding: 10px 14px; text-align: right;">Lucro</th>
                <th style="padding: 10px 14px; text-align: center;">Margem</th>
              </tr>
            </thead>
            <tbody>
              ${analysis.orders.map(o => `
                <tr class="cost-row-clickable" data-cost-type="order" data-item-id="${o.orderNumber}" style="border-bottom: 1px solid var(--border-subtle); cursor: pointer;" title="Clique para ver a lucratividade e composição de custos deste pedido">
                  <td style="padding: 10px 14px; font-weight: 700; color: var(--text-primary);">${o.orderNumber}</td>
                  <td style="padding: 10px 14px;">${escapeHtml(o.customer)}</td>
                  <td style="padding: 10px 14px;">${o.qty}x ${escapeHtml(o.productTitle)}</td>
                  <td style="padding: 10px 14px; text-align: right; font-weight: 600; color: #10b981;">${formatCurrency(o.totalSale)}</td>
                  <td style="padding: 10px 14px; text-align: right; color: #ef4444;">${formatCurrency(o.totalCost)}</td>
                  <td style="padding: 10px 14px; text-align: right; font-weight: 700; color: ${o.profit >= 0 ? '#10b981' : '#ef4444'};">${formatCurrency(o.profit)}</td>
                  <td style="padding: 10px 14px; text-align: center;">
                    <span class="badge" style="background: ${o.marginPercent >= 50 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; color: ${o.marginPercent >= 50 ? '#059669' : '#d97706'}; font-weight: 700;">
                      ${o.marginPercent.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

    </div>
  `;
}

// ==========================================
// 7. EVENT LISTENERS & ACTIONS
// ==========================================

function attachFinanceEventListeners() {
  // Navigation Tabs
  document.querySelectorAll('[data-finance-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      currentFinanceTab = e.currentTarget.dataset.financeTab;
      renderFinanceModule();
    });
  });

  // Period Select Dropdown
  const selectPeriod = document.getElementById('select-finance-period');
  if (selectPeriod) {
    selectPeriod.addEventListener('change', (e) => {
      currentPeriod = e.target.value;
      renderFinanceModule();
    });
  }

  // Apply Custom Date Range
  const btnApplyDate = document.getElementById('btn-apply-custom-date');
  if (btnApplyDate) {
    btnApplyDate.addEventListener('click', () => {
      const start = document.getElementById('custom-start-date')?.value || '';
      const end = document.getElementById('custom-end-date')?.value || '';
      customDateRange = { startDate: start, endDate: end };
      renderFinanceModule();
    });
  }

  // Cost Sub Filter
  document.querySelectorAll('[data-cost-filter]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      costsSubFilter = e.currentTarget.dataset.costFilter;
      renderFinanceModule();
    });
  });

  // Search Inputs
  const searchSalesInput = document.getElementById('input-search-sales');
  if (searchSalesInput) {
    searchSalesInput.addEventListener('input', (e) => {
      salesSearchQuery = e.target.value;
      const subContainer = document.getElementById('finance-subtab-container');
      if (subContainer) subContainer.innerHTML = renderVendasTab();
      attachSubtabDynamicListeners();
    });
  }

  const searchExpensesInput = document.getElementById('input-search-expenses');
  if (searchExpensesInput) {
    searchExpensesInput.addEventListener('input', (e) => {
      expensesSearchQuery = e.target.value;
      const subContainer = document.getElementById('finance-subtab-container');
      if (subContainer) subContainer.innerHTML = renderDespesasTab();
      attachSubtabDynamicListeners();
    });
  }

  const selectCatExpenses = document.getElementById('select-category-expenses');
  if (selectCatExpenses) {
    selectCatExpenses.addEventListener('change', (e) => {
      expensesCategoryFilter = e.target.value;
      const subContainer = document.getElementById('finance-subtab-container');
      if (subContainer) subContainer.innerHTML = renderDespesasTab();
      attachSubtabDynamicListeners();
    });
  }

  const selectStatusExpenses = document.getElementById('select-status-expenses');
  if (selectStatusExpenses) {
    selectStatusExpenses.addEventListener('change', (e) => {
      expensesStatusFilter = e.target.value;
      const subContainer = document.getElementById('finance-subtab-container');
      if (subContainer) subContainer.innerHTML = renderDespesasTab();
      attachSubtabDynamicListeners();
    });
  }

  const searchRecInput = document.getElementById('input-search-receivables');
  if (searchRecInput) {
    searchRecInput.addEventListener('input', (e) => {
      receivablesSearchQuery = e.target.value;
      const subContainer = document.getElementById('finance-subtab-container');
      if (subContainer) subContainer.innerHTML = renderAReceberTab();
      attachSubtabDynamicListeners();
    });
  }

  const selectStatusRec = document.getElementById('select-status-receivables');
  if (selectStatusRec) {
    selectStatusRec.addEventListener('change', (e) => {
      receivablesStatusFilter = e.target.value;
      const subContainer = document.getElementById('finance-subtab-container');
      if (subContainer) subContainer.innerHTML = renderAReceberTab();
      attachSubtabDynamicListeners();
    });
  }

  const searchPayInput = document.getElementById('input-search-payables');
  if (searchPayInput) {
    searchPayInput.addEventListener('input', (e) => {
      payablesSearchQuery = e.target.value;
      const subContainer = document.getElementById('finance-subtab-container');
      if (subContainer) subContainer.innerHTML = renderAPagarTab();
      attachSubtabDynamicListeners();
    });
  }

  const selectStatusPay = document.getElementById('select-status-payables');
  if (selectStatusPay) {
    selectStatusPay.addEventListener('change', (e) => {
      payablesStatusFilter = e.target.value;
      const subContainer = document.getElementById('finance-subtab-container');
      if (subContainer) subContainer.innerHTML = renderAPagarTab();
      attachSubtabDynamicListeners();
    });
  }

  // Quick Action: New Expense
  const btnNewExpense = document.getElementById('btn-quick-new-expense');
  if (btnNewExpense) {
    btnNewExpense.addEventListener('click', () => {
      openExpenseDrawer();
    });
  }

  // Quick Action: New Receivable
  const btnNewReceivable = document.getElementById('btn-quick-new-receivable');
  if (btnNewReceivable) {
    btnNewReceivable.addEventListener('click', () => {
      openReceivableDrawer();
    });
  }

  // Quick Action: New Payable
  const btnNewPayable = document.getElementById('btn-quick-new-payable');
  if (btnNewPayable) {
    btnNewPayable.addEventListener('click', () => {
      openPayableDrawer();
    });
  }

  // CSV Export & Import
  const btnExportCSV = document.getElementById('btn-finance-export-csv');
  if (btnExportCSV) {
    btnExportCSV.addEventListener('click', handleExportCurrentTabCSV);
  }

  const btnImportCSV = document.getElementById('btn-finance-import-csv');
  if (btnImportCSV) {
    btnImportCSV.addEventListener('click', openImportCSVModal);
  }

  attachSubtabDynamicListeners();
}

/**
 * Attaches event listeners to rows and dynamic action buttons inside subtabs.
 * Strictly respects global PAPER MAX rules:
 * - Clicking row opens Consultation Drawer
 * - ⋮ menu items have 100% functional implementations (Resumo, Editar, Duplicar, Pagar/Receber, Excluir)
 * - Click propagation on actions is blocked
 */
function attachSubtabDynamicListeners() {
  const container = document.getElementById('finance-subtab-container');
  if (!container) return;

  container.onclick = (e) => {
    // 1. Menu options (⋮) for Sales
    const saleMenuBtn = e.target.closest('.btn-sale-menu');
    if (saleMenuBtn) {
      e.stopPropagation();
      const orderNumber = saleMenuBtn.getAttribute('data-id');
      const recId = saleMenuBtn.getAttribute('data-rec-id');
      const menuOptions = [
        {
          label: '📄 Resumo da Venda',
          icon: '📄',
          action: () => showSaleConsultationDrawer(orderNumber)
        }
      ];

      if (recId) {
        const rec = getReceivableById(recId);
        if (rec && rec.status !== 'recebido') {
          menuOptions.push({
            label: '💵 Dar Baixa / Receber',
            icon: '💵',
            action: () => openReceiveModal(recId)
          });
        }
      }

      menuOptions.push({
        label: '📦 Ver nos Pedidos',
        icon: '📦',
        action: () => switchView('pedidos')
      });

      openContextMenu(e, menuOptions);
      return;
    }

    // 2. Menu options (⋮) for Expenses
    const expenseMenuBtn = e.target.closest('.btn-expense-menu');
    if (expenseMenuBtn) {
      e.stopPropagation();
      const id = expenseMenuBtn.getAttribute('data-id');
      const exp = getExpenseById(id);
      if (!exp) return;

      const isPaid = exp.status === 'pago';
      const menuOptions = [
        {
          label: '📄 Resumo da Despesa',
          icon: '📄',
          action: () => showExpenseConsultationDrawer(id)
        }
      ];

      if (!isPaid) {
        menuOptions.push({
          label: '💵 Pagar Despesa',
          icon: '💵',
          action: () => openPayExpenseModal(id)
        });
      }

      menuOptions.push({
        label: '📋 Duplicar',
        icon: '📋',
        action: () => duplicateExpense(id)
      });

      menuOptions.push({
        label: '✏️ Editar',
        icon: '✏️',
        action: () => openExpenseDrawer(id)
      });

      menuOptions.push({
        label: '🗑️ Excluir',
        icon: '🗑️',
        danger: true,
        action: () => {
          showConfirmDialog({
            title: 'Excluir Despesa',
            message: `Tem certeza que deseja excluir a despesa "${exp.description}"?`,
            confirmText: 'Excluir',
            isDanger: true,
            onConfirm: () => {
              deleteExpense(id);
              renderFinanceModule();
            }
          });
        }
      });

      openContextMenu(e, menuOptions);
      return;
    }

    // 3. Menu options (⋮) for Receivables
    const receivableMenuBtn = e.target.closest('.btn-receivable-menu');
    if (receivableMenuBtn) {
      e.stopPropagation();
      const id = receivableMenuBtn.getAttribute('data-id');
      const rec = getReceivableById(id);
      if (!rec) return;

      const isReceived = rec.status === 'recebido' || rec.status === 'recebida';
      const menuOptions = [
        {
          label: '📄 Resumo da Conta',
          icon: '📄',
          action: () => showReceivableConsultationDrawer(id)
        }
      ];

      if (!isReceived) {
        menuOptions.push({
          label: '💵 Receber',
          icon: '💵',
          action: () => openReceiveModal(id)
        });
      }

      menuOptions.push({
        label: '📋 Duplicar',
        icon: '📋',
        action: () => duplicateReceivable(id)
      });

      menuOptions.push({
        label: '✏️ Editar',
        icon: '✏️',
        action: () => openReceivableDrawer(id)
      });

      menuOptions.push({
        label: '🗑️ Excluir',
        icon: '🗑️',
        danger: true,
        action: () => {
          showConfirmDialog({
            title: 'Excluir Conta a Receber',
            message: `Tem certeza que deseja excluir este recebível de "${rec.customer}"?`,
            confirmText: 'Excluir',
            isDanger: true,
            onConfirm: () => {
              deleteReceivable(id);
              renderFinanceModule();
            }
          });
        }
      });

      openContextMenu(e, menuOptions);
      return;
    }

    // 4. Menu options (⋮) for Payables
    const payableMenuBtn = e.target.closest('.btn-payable-menu');
    if (payableMenuBtn) {
      e.stopPropagation();
      const id = payableMenuBtn.getAttribute('data-id');
      const pay = getPayableById(id);
      if (!pay) return;

      const isPaid = pay.status === 'pago';
      const menuOptions = [
        {
          label: '📄 Resumo da Conta',
          icon: '📄',
          action: () => showPayableConsultationDrawer(id)
        }
      ];

      if (!isPaid) {
        menuOptions.push({
          label: '💵 Pagar',
          icon: '💵',
          action: () => openPayPayableModal(id)
        });
      }

      menuOptions.push({
        label: '📋 Duplicar',
        icon: '📋',
        action: () => duplicatePayable(id)
      });

      menuOptions.push({
        label: '✏️ Editar',
        icon: '✏️',
        action: () => openPayableDrawer(id)
      });

      menuOptions.push({
        label: '🗑️ Excluir',
        icon: '🗑️',
        danger: true,
        action: () => {
          showConfirmDialog({
            title: 'Excluir Conta a Pagar',
            message: `Tem certeza que deseja excluir esta conta a pagar para "${pay.supplierName}"?`,
            confirmText: 'Excluir',
            isDanger: true,
            onConfirm: () => {
              deletePayable(id);
              renderFinanceModule();
            }
          });
        }
      });

      openContextMenu(e, menuOptions);
      return;
    }

    // 5. Click on List Row -> Open Consultation Drawer (RULE 1)
    const cardRow = e.target.closest('.list-row');
    if (cardRow) {
      const id = cardRow.getAttribute('data-id');
      const action = cardRow.getAttribute('data-action');
      if (action === 'view-sale' || currentFinanceTab === 'vendas') {
        if (id) showSaleConsultationDrawer(id);
        return;
      }
      if (action === 'view-expense' || currentFinanceTab === 'despesas') {
        if (id) showExpenseConsultationDrawer(id);
        return;
      }
      if (action === 'view-receivable' || currentFinanceTab === 'receber') {
        if (id) showReceivableConsultationDrawer(id);
        return;
      }
      if (action === 'view-payable' || currentFinanceTab === 'pagar') {
        if (id) showPayableConsultationDrawer(id);
        return;
      }
    }

    // 6. Click on Cost Row -> Open Cost Breakdown Drawer (RULE 1)
    const costRow = e.target.closest('.cost-row-clickable');
    if (costRow) {
      const costType = costRow.getAttribute('data-cost-type');
      const itemId = costRow.getAttribute('data-item-id');
      if (costType && itemId) {
        showCostDetailDrawer(costType, itemId);
        return;
      }
    }
  };
}

// ==========================================
// 8. DRAWERS & MODALS (STANDARDIZED VIA GLOBAL openDrawer)
// ==========================================

function duplicateExpense(id) {
  const exp = getExpenseById(id);
  if (!exp) return;
  const newExp = createExpense({
    description: `${exp.description} (Cópia)`,
    category: exp.category,
    amount: exp.amount,
    date: formatDateBR(new Date()),
    dueDate: formatDateBR(new Date()),
    status: 'aberto',
    paymentMethod: exp.paymentMethod,
    notes: exp.notes
  });
  showToast(`Despesa duplicada com sucesso! (${newExp.id})`);
  renderFinanceModule();
}

function duplicateReceivable(id) {
  const rec = getReceivableById(id);
  if (!rec) return;
  const newRec = createReceivable({
    customer: rec.customer,
    description: `${rec.description} (Cópia)`,
    amount: rec.amount,
    dueDate: formatDateBR(new Date()),
    status: 'aberto',
    paymentMethod: rec.paymentMethod,
    notes: rec.notes
  });
  showToast(`Conta a receber duplicada com sucesso! (${newRec.id})`);
  renderFinanceModule();
}

function duplicatePayable(id) {
  const pay = getPayableById(id);
  if (!pay) return;
  const newPay = createPayable({
    supplierName: pay.supplierName,
    description: `${pay.description} (Cópia)`,
    amount: pay.amount,
    dueDate: formatDateBR(new Date()),
    status: 'aberto',
    paymentMethod: pay.paymentMethod,
    notes: pay.notes
  });
  showToast(`Conta a pagar duplicada com sucesso! (${newPay.id})`);
  renderFinanceModule();
}

// ----------------------------------------------------
// CONSULTATION DRAWERS (RULE 1: Click on Card/Row opens consultation)
// ----------------------------------------------------

function showExpenseConsultationDrawer(expenseId) {
  const exp = getExpenseById(expenseId);
  if (!exp) return;
  const isPaid = exp.status === 'pago';
  const statusColor = isPaid ? '#10b981' : '#f59e0b';
  const statusBg = isPaid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)';
  const statusLabel = isPaid ? '✓ Pago' : '⏳ Em Aberto';

  const contentHtml = `
    <div style="display: flex; flex-direction: column; gap: 16px; padding: 4px 0;">
      <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px 16px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div>
            <h4 style="font-size: 16px; font-weight: 800; margin: 0 0 4px 0; color: var(--text-primary);">${escapeHtml(exp.description)}</h4>
            <div style="font-size: 12px; color: var(--text-secondary);">
              Categoria: <strong>${escapeHtml(exp.category || 'Operacional')}</strong> · ID: <span style="font-family: monospace;">${exp.id}</span>
            </div>
          </div>
          <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; background: ${statusBg}; color: ${statusColor};">
            ${statusLabel}
          </span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Valor da Despesa</div>
          <div style="font-size: 20px; font-weight: 800; color: #ef4444; margin-top: 2px;">${formatCurrency(exp.amount)}</div>
        </div>
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Forma de Pagamento</div>
          <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-top: 4px;">${escapeHtml(exp.paymentMethod || 'Pix')}</div>
        </div>
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Data de Emissão</div>
          <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-top: 2px;">${exp.date || '--/--/----'}</div>
        </div>
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Vencimento</div>
          <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-top: 2px;">${exp.dueDate || '--/--/----'}</div>
        </div>
      </div>

      ${isPaid ? `
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 12px 14px; font-size: 13px; color: #065f46;">
          ✓ <strong>Pagamento Realizado:</strong> Baixa efetuada em <b>${exp.paidDate || '--/--/----'}</b> via <b>${escapeHtml(exp.paymentMethod || 'Pix')}</b>.
        </div>
      ` : ''}

      <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
        <div style="font-size: 12px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">Observações & Notas</div>
        <div style="font-size: 13px; color: ${exp.notes ? 'var(--text-primary)' : 'var(--text-muted)'}; white-space: pre-wrap;">${escapeHtml(exp.notes) || 'Nenhuma observação registrada.'}</div>
      </div>
    </div>
  `;

  const footerHtml = `
    <div style="display: flex; gap: 8px; width: 100%; justify-content: flex-end; flex-wrap: wrap;">
      ${!isPaid ? `
        <button type="button" class="btn btn-sm btn-primary" id="btn-consult-exp-pay" style="padding: 8px 14px;">
          💵 Pagar Despesa
        </button>
      ` : ''}
      <button type="button" class="btn btn-sm btn-secondary" id="btn-consult-exp-dup" style="padding: 8px 14px;">
        📋 Duplicar
      </button>
      <button type="button" class="btn btn-sm btn-secondary" id="btn-consult-exp-edit" style="padding: 8px 14px;">
        ✏️ Editar
      </button>
      <button type="button" class="btn btn-sm btn-danger" id="btn-consult-exp-del" style="padding: 8px 14px;">
        🗑️ Excluir
      </button>
    </div>
  `;

  openDrawer({
    title: '📄 Resumo da Despesa',
    contentHtml,
    footerHtml,
    onMount: (drawer, close) => {
      drawer.querySelector('#btn-consult-exp-pay')?.addEventListener('click', () => {
        close();
        openPayExpenseModal(exp.id);
      });
      drawer.querySelector('#btn-consult-exp-dup')?.addEventListener('click', () => {
        close();
        duplicateExpense(exp.id);
      });
      drawer.querySelector('#btn-consult-exp-edit')?.addEventListener('click', () => {
        close();
        openExpenseDrawer(exp.id);
      });
      drawer.querySelector('#btn-consult-exp-del')?.addEventListener('click', () => {
        close();
        showConfirmDialog({
          title: 'Excluir Despesa',
          message: `Deseja realmente excluir a despesa "${exp.description}"?`,
          confirmText: 'Excluir',
          isDanger: true,
          onConfirm: () => {
            deleteExpense(exp.id);
            renderFinanceModule();
          }
        });
      });
    }
  });
}

function showReceivableConsultationDrawer(recId) {
  const rec = getReceivableById(recId);
  if (!rec) return;
  const isReceived = rec.status === 'recebido' || rec.status === 'recebida';
  const statusColor = isReceived ? '#10b981' : '#f59e0b';
  const statusBg = isReceived ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)';
  const statusLabel = isReceived ? '✓ Recebido' : '⏳ Em Aberto';

  const contentHtml = `
    <div style="display: flex; flex-direction: column; gap: 16px; padding: 4px 0;">
      <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px 16px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div>
            <h4 style="font-size: 16px; font-weight: 800; margin: 0 0 4px 0; color: var(--text-primary);">${escapeHtml(rec.customer || 'Cliente Avulso')}</h4>
            <div style="font-size: 12px; color: var(--text-secondary);">
              ${escapeHtml(rec.description)} · ID: <span style="font-family: monospace;">${rec.id}</span>
              ${rec.orderId ? ` · <strong style="color: #2563eb;">Pedido ${rec.orderId}</strong>` : ''}
            </div>
          </div>
          <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; background: ${statusBg}; color: ${statusColor};">
            ${statusLabel}
          </span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Valor a Receber</div>
          <div style="font-size: 20px; font-weight: 800; color: #10b981; margin-top: 2px;">${formatCurrency(rec.amount)}</div>
        </div>
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Forma de Pagamento</div>
          <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-top: 4px;">${escapeHtml(rec.paymentMethod || 'Pix')}</div>
        </div>
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Data de Vencimento</div>
          <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-top: 2px;">${rec.dueDate || '--/--/----'}</div>
        </div>
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Status Atual</div>
          <div style="font-size: 14px; font-weight: 600; color: ${statusColor}; margin-top: 2px;">${statusLabel}</div>
        </div>
      </div>

      ${isReceived ? `
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 12px 14px; font-size: 13px; color: #065f46;">
          ✓ <strong>Recebimento Confirmado:</strong> Baixa registrada em <b>${rec.paidDate || '--/--/----'}</b> via <b>${escapeHtml(rec.paymentMethod || 'Pix')}</b>.
        </div>
      ` : ''}

      <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
        <div style="font-size: 12px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">Observações & Notas</div>
        <div style="font-size: 13px; color: ${rec.notes ? 'var(--text-primary)' : 'var(--text-muted)'}; white-space: pre-wrap;">${escapeHtml(rec.notes) || 'Nenhuma observação cadastrada.'}</div>
      </div>
    </div>
  `;

  const footerHtml = `
    <div style="display: flex; gap: 8px; width: 100%; justify-content: flex-end; flex-wrap: wrap;">
      ${!isReceived ? `
        <button type="button" class="btn btn-sm btn-primary" id="btn-consult-rec-pay" style="padding: 8px 14px;">
          💵 Confirmar Recebimento
        </button>
      ` : ''}
      <button type="button" class="btn btn-sm btn-secondary" id="btn-consult-rec-dup" style="padding: 8px 14px;">
        📋 Duplicar
      </button>
      <button type="button" class="btn btn-sm btn-secondary" id="btn-consult-rec-edit" style="padding: 8px 14px;">
        ✏️ Editar
      </button>
      <button type="button" class="btn btn-sm btn-danger" id="btn-consult-rec-del" style="padding: 8px 14px;">
        🗑️ Excluir
      </button>
    </div>
  `;

  openDrawer({
    title: '📄 Resumo da Conta a Receber',
    contentHtml,
    footerHtml,
    onMount: (drawer, close) => {
      drawer.querySelector('#btn-consult-rec-pay')?.addEventListener('click', () => {
        close();
        openReceiveModal(rec.id);
      });
      drawer.querySelector('#btn-consult-rec-dup')?.addEventListener('click', () => {
        close();
        duplicateReceivable(rec.id);
      });
      drawer.querySelector('#btn-consult-rec-edit')?.addEventListener('click', () => {
        close();
        openReceivableDrawer(rec.id);
      });
      drawer.querySelector('#btn-consult-rec-del')?.addEventListener('click', () => {
        close();
        showConfirmDialog({
          title: 'Excluir Conta a Receber',
          message: `Deseja realmente excluir o recebível de "${rec.customer}"?`,
          confirmText: 'Excluir',
          isDanger: true,
          onConfirm: () => {
            deleteReceivable(rec.id);
            renderFinanceModule();
          }
        });
      });
    }
  });
}

function showPayableConsultationDrawer(payId) {
  const pay = getPayableById(payId);
  if (!pay) return;
  const isPaid = pay.status === 'pago';
  const statusColor = isPaid ? '#10b981' : '#f59e0b';
  const statusBg = isPaid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)';
  const statusLabel = isPaid ? '✓ Pago' : '⏳ Em Aberto';

  const contentHtml = `
    <div style="display: flex; flex-direction: column; gap: 16px; padding: 4px 0;">
      <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px 16px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div>
            <h4 style="font-size: 16px; font-weight: 800; margin: 0 0 4px 0; color: var(--text-primary);">${escapeHtml(pay.supplierName || 'Fornecedor Avulso')}</h4>
            <div style="font-size: 12px; color: var(--text-secondary);">
              ${escapeHtml(pay.description)} · ID: <span style="font-family: monospace;">${pay.id}</span>
              ${pay.purchaseId ? ` · <strong style="color: #8b5cf6;">Compra ${pay.purchaseId}</strong>` : ''}
            </div>
          </div>
          <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; background: ${statusBg}; color: ${statusColor};">
            ${statusLabel}
          </span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Valor da Conta</div>
          <div style="font-size: 20px; font-weight: 800; color: #ef4444; margin-top: 2px;">${formatCurrency(pay.amount)}</div>
        </div>
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Forma de Pagamento</div>
          <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-top: 4px;">${escapeHtml(pay.paymentMethod || 'Boleto')}</div>
        </div>
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Data de Vencimento</div>
          <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-top: 2px;">${pay.dueDate || '--/--/----'}</div>
        </div>
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Status Atual</div>
          <div style="font-size: 14px; font-weight: 600; color: ${statusColor}; margin-top: 2px;">${statusLabel}</div>
        </div>
      </div>

      ${isPaid ? `
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 12px 14px; font-size: 13px; color: #065f46;">
          ✓ <strong>Pagamento Realizado:</strong> Baixa registrada em <b>${pay.paidDate || '--/--/----'}</b> via <b>${escapeHtml(pay.paymentMethod || 'Boleto')}</b>.
        </div>
      ` : ''}

      <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
        <div style="font-size: 12px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">Observações & Notas</div>
        <div style="font-size: 13px; color: ${pay.notes ? 'var(--text-primary)' : 'var(--text-muted)'}; white-space: pre-wrap;">${escapeHtml(pay.notes) || 'Nenhuma observação cadastrada.'}</div>
      </div>
    </div>
  `;

  const footerHtml = `
    <div style="display: flex; gap: 8px; width: 100%; justify-content: flex-end; flex-wrap: wrap;">
      ${!isPaid ? `
        <button type="button" class="btn btn-sm btn-primary" id="btn-consult-pay-pay" style="padding: 8px 14px;">
          💵 Confirmar Pagamento
        </button>
      ` : ''}
      <button type="button" class="btn btn-sm btn-secondary" id="btn-consult-pay-dup" style="padding: 8px 14px;">
        📋 Duplicar
      </button>
      <button type="button" class="btn btn-sm btn-secondary" id="btn-consult-pay-edit" style="padding: 8px 14px;">
        ✏️ Editar
      </button>
      <button type="button" class="btn btn-sm btn-danger" id="btn-consult-pay-del" style="padding: 8px 14px;">
        🗑️ Excluir
      </button>
    </div>
  `;

  openDrawer({
    title: '📄 Resumo da Conta a Pagar',
    contentHtml,
    footerHtml,
    onMount: (drawer, close) => {
      drawer.querySelector('#btn-consult-pay-pay')?.addEventListener('click', () => {
        close();
        openPayPayableModal(pay.id);
      });
      drawer.querySelector('#btn-consult-pay-dup')?.addEventListener('click', () => {
        close();
        duplicatePayable(pay.id);
      });
      drawer.querySelector('#btn-consult-pay-edit')?.addEventListener('click', () => {
        close();
        openPayableDrawer(pay.id);
      });
      drawer.querySelector('#btn-consult-pay-del')?.addEventListener('click', () => {
        close();
        showConfirmDialog({
          title: 'Excluir Conta a Pagar',
          message: `Deseja realmente excluir a conta a pagar para "${pay.supplierName}"?`,
          confirmText: 'Excluir',
          isDanger: true,
          onConfirm: () => {
            deletePayable(pay.id);
            renderFinanceModule();
          }
        });
      });
    }
  });
}

function showSaleConsultationDrawer(orderNumber) {
  const sales = getSalesFromOrders();
  const s = sales.find(x => x.orderNumber === orderNumber);
  if (!s) return;

  const isReceived = s.receivingStatus === 'recebido';
  const statusColor = isReceived ? '#10b981' : '#f59e0b';
  const statusBg = isReceived ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)';
  const statusLabel = isReceived ? '✓ Recebido' : '⏳ Pendente';

  const contentHtml = `
    <div style="display: flex; flex-direction: column; gap: 16px; padding: 4px 0;">
      <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px 16px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div>
            <h4 style="font-size: 16px; font-weight: 800; margin: 0 0 4px 0; color: var(--text-primary);">${s.orderNumber} · ${escapeHtml(s.customer)}</h4>
            <div style="font-size: 12px; color: var(--text-secondary);">
              Produto: <strong>${escapeHtml(s.productTitle)}</strong> · Quantidade: <strong>${s.qty} un</strong>
              ${s.hasSnapshot ? ' · <span style="color: #2563eb; font-weight: 600;">📸 Snapshot Ativo</span>' : ''}
            </div>
          </div>
          <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; background: ${statusBg}; color: ${statusColor};">
            ${statusLabel}
          </span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Receita Total Venda</div>
          <div style="font-size: 20px; font-weight: 800; color: #10b981; margin-top: 2px;">${formatCurrency(s.totalSale)}</div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Preço unitário: ${formatCurrency(s.unitPrice)}</div>
        </div>
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Custo Técnico Total</div>
          <div style="font-size: 20px; font-weight: 800; color: #ef4444; margin-top: 2px;">${formatCurrency(s.totalCost)}</div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Custo unitário: ${formatCurrency(s.unitCost)}</div>
        </div>
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Lucro Real Bruto</div>
          <div style="font-size: 18px; font-weight: 800; color: ${s.profit >= 0 ? '#10b981' : '#ef4444'}; margin-top: 2px;">${formatCurrency(s.profit)}</div>
        </div>
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Margem de Contribuição</div>
          <div style="font-size: 18px; font-weight: 800; color: ${s.marginPercent >= 50 ? '#10b981' : '#f59e0b'}; margin-top: 2px;">${s.marginPercent.toFixed(1)}%</div>
        </div>
      </div>

      <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
        <div style="font-size: 12px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">Recebimento & Integração</div>
        <div style="font-size: 13px; color: var(--text-secondary);">
          Forma de pagamento vinculada: <strong>${escapeHtml(s.paymentMethod || 'Pix')}</strong><br/>
          Status de baixa no fluxo de caixa: <strong style="color: ${statusColor};">${statusLabel}</strong>
          ${s.receivableId ? `<br/>ID do Título a Receber: <span style="font-family: monospace;">${s.receivableId}</span>` : ''}
        </div>
      </div>
    </div>
  `;

  const footerHtml = `
    <div style="display: flex; gap: 8px; width: 100%; justify-content: flex-end; flex-wrap: wrap;">
      ${(!isReceived && s.receivableId) ? `
        <button type="button" class="btn btn-sm btn-primary" id="btn-consult-sale-receive" style="padding: 8px 14px;">
          💵 Confirmar Recebimento
        </button>
      ` : ''}
      <button type="button" class="btn btn-sm btn-secondary" id="btn-consult-sale-orders" style="padding: 8px 14px;">
        📦 Ver Pedido nos Pedidos
      </button>
    </div>
  `;

  openDrawer({
    title: `📄 Resumo da Venda · Pedido ${s.orderNumber}`,
    contentHtml,
    footerHtml,
    onMount: (drawer, close) => {
      drawer.querySelector('#btn-consult-sale-receive')?.addEventListener('click', () => {
        close();
        if (s.receivableId) openReceiveModal(s.receivableId);
      });
      drawer.querySelector('#btn-consult-sale-orders')?.addEventListener('click', () => {
        close();
        switchView('pedidos');
      });
    }
  });
}

function showCostDetailDrawer(costType, itemId) {
  const analysis = getDetailedCostsAnalysis();

  if (costType === 'product') {
    const p = analysis.products.find(x => String(x.id) === String(itemId));
    if (!p) return;

    const contentHtml = `
      <div style="display: flex; flex-direction: column; gap: 16px; padding: 4px 0;">
        <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px 16px;">
          <h4 style="font-size: 16px; font-weight: 800; margin: 0 0 4px 0; color: var(--text-primary);">${escapeHtml(p.name)}</h4>
          <div style="font-size: 12px; color: var(--text-secondary);">
            Estrutura Técnica: <strong>${p.hasBOM ? `Engenharia de Produto (${p.bomItemsCount} itens no BOM)` : 'Estimativa Direta de Custo'}</strong>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Preço de Venda</div>
            <div style="font-size: 18px; font-weight: 800; color: #10b981; margin-top: 2px;">${formatCurrency(p.price)}</div>
          </div>
          <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Custo Técnico Real</div>
            <div style="font-size: 18px; font-weight: 800; color: #ef4444; margin-top: 2px;">${formatCurrency(p.cost)}</div>
          </div>
          <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Margem em R$</div>
            <div style="font-size: 18px; font-weight: 800; color: ${p.marginAmount >= 0 ? '#10b981' : '#ef4444'}; margin-top: 2px;">${formatCurrency(p.marginAmount)}</div>
          </div>
          <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Margem %</div>
            <div style="font-size: 18px; font-weight: 800; color: ${p.marginPercent >= 50 ? '#10b981' : '#f59e0b'}; margin-top: 2px;">${p.marginPercent.toFixed(1)}%</div>
          </div>
        </div>

        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
          <div style="font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px;">
            Composição Detalhada de Insumos e Componentes (BOM)
          </div>
          ${(!p.bomItems || p.bomItems.length === 0) ? `
            <div style="font-size: 12px; color: var(--text-muted);">Este produto não possui itens vinculados na ficha técnica.</div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${p.bomItems.map(item => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f8fafc; border-radius: 6px; font-size: 12px;">
                  <div>
                    <strong style="color: var(--text-primary);">${escapeHtml(item.name)}</strong>
                    <div style="color: var(--text-secondary); font-size: 11px;">Consumo: ${item.quantity} ${escapeHtml(item.unit || 'un')} · Custo unitário: ${formatCurrency(item.unitCost)}</div>
                  </div>
                  <strong style="color: #ef4444; font-size: 13px;">${formatCurrency(item.subtotalCost)}</strong>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    openDrawer({
      title: '🧮 Detalhamento Técnico · Produto',
      contentHtml,
      onMount: () => {}
    });
    return;
  }

  if (costType === 'component') {
    const c = analysis.components.find(x => String(x.id) === String(itemId));
    if (!c) return;

    const contentHtml = `
      <div style="display: flex; flex-direction: column; gap: 16px; padding: 4px 0;">
        <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px 16px;">
          <h4 style="font-size: 16px; font-weight: 800; margin: 0 0 4px 0; color: var(--text-primary);">${escapeHtml(c.name)}</h4>
          <div style="font-size: 12px; color: var(--text-secondary);">
            Componente Intermediário · Rendimento: <strong>${c.yield} un</strong>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Custo Unitário Calculado</div>
            <div style="font-size: 18px; font-weight: 800; color: #ef4444; margin-top: 2px;">${formatCurrency(c.unitCost)}</div>
          </div>
          <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Saldo em Estoque</div>
            <div style="font-size: 18px; font-weight: 800; color: var(--text-primary); margin-top: 2px;">${c.currentStock} un</div>
          </div>
        </div>

        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
          <div style="font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">Insumos Consumidos no Lote</div>
          ${(!c.items || c.items.length === 0) ? `
            <div style="font-size: 12px; color: var(--text-muted);">Nenhum insumo associado na receita do componente.</div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${c.items.map(it => `
                <div style="display: flex; justify-content: space-between; padding: 6px 10px; background: #f8fafc; border-radius: 6px; font-size: 12px;">
                  <span>${escapeHtml(it.materialName || it.name || 'Insumo')}</span>
                  <strong>${it.quantity} ${escapeHtml(it.unit || 'un')}</strong>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    openDrawer({
      title: '🧮 Detalhamento Técnico · Componente',
      contentHtml,
      onMount: () => {}
    });
    return;
  }

  if (costType === 'material') {
    const m = analysis.materials.find(x => String(x.id) === String(itemId));
    if (!m) return;

    const contentHtml = `
      <div style="display: flex; flex-direction: column; gap: 16px; padding: 4px 0;">
        <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px 16px;">
          <h4 style="font-size: 16px; font-weight: 800; margin: 0 0 4px 0; color: var(--text-primary);">${escapeHtml(m.name)}</h4>
          <div style="font-size: 12px; color: var(--text-secondary);">
            Insumo de Produção · Unidade Base: <strong>${escapeHtml(m.baseUnit)}</strong>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Custo Base Unitário</div>
            <div style="font-size: 18px; font-weight: 800; color: #ef4444; margin-top: 2px;">${formatCurrency(m.baseUnitCost)}</div>
          </div>
          <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Custo Embalagem Compra</div>
            <div style="font-size: 18px; font-weight: 800; color: var(--text-primary); margin-top: 2px;">${formatCurrency(m.packCost)}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Pacote com ${m.packQuantity} ${escapeHtml(m.baseUnit)}</div>
          </div>
          <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Estoque Atual</div>
            <div style="font-size: 18px; font-weight: 800; color: var(--text-primary); margin-top: 2px;">${m.currentStock} ${escapeHtml(m.baseUnit)}</div>
          </div>
          <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Valor Total em Estoque</div>
            <div style="font-size: 18px; font-weight: 800; color: #0284c7; margin-top: 2px;">${formatCurrency(m.totalStockValue)}</div>
          </div>
        </div>
      </div>
    `;

    openDrawer({
      title: '🧮 Detalhamento Técnico · Insumo',
      contentHtml,
      onMount: () => {}
    });
    return;
  }

  if (costType === 'order') {
    showSaleConsultationDrawer(itemId);
  }
}

// ----------------------------------------------------
// EDIT & CREATION DRAWERS (STANDARDIZED VIA GLOBAL openDrawer)
// ----------------------------------------------------

function openExpenseDrawer(expenseId = null) {
  const isEdit = !!expenseId;
  const expense = isEdit ? getExpenseById(expenseId) : {
    description: '',
    category: 'Operacional',
    amount: '',
    date: formatDateBR(new Date()),
    dueDate: formatDateBR(new Date()),
    status: 'aberto',
    paymentMethod: 'Pix',
    notes: ''
  };

  const title = isEdit ? '✏️ Editar Despesa' : '➕ Nova Despesa';

  const contentHtml = `
    <div style="padding: 4px 0;">
      <div class="binder-tabs">
        <div class="binder-tab active">1. Dados da Despesa</div>
      </div>
      <div class="binder-panel" style="margin-bottom: 0;">
        <form id="form-expense-drawer" style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Descrição da Despesa *</label>
            <input type="text" id="exp-drawer-desc" class="form-input" required placeholder="Ex: Energia do ateliê, internet, frete..." value="${escapeHtml(expense.description)}" />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Categoria</label>
              <select id="exp-drawer-cat" class="form-select">
                ${EXPENSE_CATEGORIES.map(cat => `
                  <option value="${cat}" ${expense.category === cat ? 'selected' : ''}>${cat}</option>
                `).join('')}
              </select>
            </div>

            <div>
              <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Valor (R$) *</label>
              <input type="number" step="0.01" min="0.01" id="exp-drawer-amount" class="form-input" required placeholder="0.00" value="${expense.amount || ''}" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Data Emissão</label>
              <input type="text" id="exp-drawer-date" class="form-input" placeholder="DD/MM/AAAA" value="${escapeHtml(expense.date || '')}" />
            </div>

            <div>
              <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Data Vencimento</label>
              <input type="text" id="exp-drawer-duedate" class="form-input" placeholder="DD/MM/AAAA" value="${escapeHtml(expense.dueDate || '')}" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Status</label>
              <select id="exp-drawer-status" class="form-select">
                <option value="aberto" ${expense.status === 'aberto' ? 'selected' : ''}>Em Aberto</option>
                <option value="pago" ${expense.status === 'pago' ? 'selected' : ''}>Pago</option>
              </select>
            </div>

            <div>
              <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Forma Pagamento</label>
              <select id="exp-drawer-method" class="form-select">
                ${PAYMENT_METHODS.map(m => `
                  <option value="${m}" ${expense.paymentMethod === m ? 'selected' : ''}>${m}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div>
            <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Observações</label>
            <textarea id="exp-drawer-notes" class="form-input" rows="3" placeholder="Informações adicionais...">${escapeHtml(expense.notes || '')}</textarea>
          </div>
        </form>
      </div>
    </div>
  `;

  const footerHtml = `
    <div style="display: flex; gap: 10px; width: 100%; justify-content: flex-end;">
      <button type="button" class="btn btn-secondary" id="btn-cancel-expense-drawer" style="flex: 1;">Cancelar</button>
      <button type="submit" form="form-expense-drawer" class="btn btn-primary" style="flex: 2;">
        ${isEdit ? 'Salvar Alterações' : 'Cadastrar Despesa'}
      </button>
    </div>
  `;

  openDrawer({
    title,
    contentHtml,
    footerHtml,
    onMount: (drawer, close) => {
      drawer.querySelector('#btn-cancel-expense-drawer')?.addEventListener('click', close);
      drawer.querySelector('#form-expense-drawer')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
          description: drawer.querySelector('#exp-drawer-desc').value,
          category: drawer.querySelector('#exp-drawer-cat').value,
          amount: parseFloat(drawer.querySelector('#exp-drawer-amount').value),
          date: drawer.querySelector('#exp-drawer-date').value,
          dueDate: drawer.querySelector('#exp-drawer-duedate').value,
          status: drawer.querySelector('#exp-drawer-status').value,
          paymentMethod: drawer.querySelector('#exp-drawer-method').value,
          notes: drawer.querySelector('#exp-drawer-notes').value
        };

        if (isEdit) {
          updateExpense(expenseId, data);
          showToast('Despesa atualizada com sucesso!');
        } else {
          createExpense(data);
          showToast('Despesa cadastrada com sucesso!');
        }

        close();
        renderFinanceModule();
      });
    }
  });
}

function openReceiveModal(recId) {
  const rec = getReceivableById(recId);
  if (!rec) return;

  const contentHtml = `
    <div style="display: flex; flex-direction: column; gap: 14px; padding: 4px 0;">
      <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
        <div style="font-size: 0.8125rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">Conta a Receber</div>
        <div style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary); margin-top: 2px;">
          ${escapeHtml(rec.customer || 'Cliente Geral')}
        </div>
        <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 2px;">
          ${escapeHtml(rec.description)}
        </div>
        <div style="font-size: 1.25rem; font-weight: 800; color: #10b981; margin-top: 6px;">
          ${formatCurrency(rec.amount)}
        </div>
      </div>

      <form id="form-receive-drawer" style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Data do Recebimento *</label>
          <input type="text" id="rec-drawer-paid-date" class="form-input" required value="${formatDateBR(new Date())}" />
        </div>

        <div>
          <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Forma de Pagamento</label>
          <select id="rec-drawer-paid-method" class="form-select">
            ${PAYMENT_METHODS.map(m => `
              <option value="${m}" ${rec.paymentMethod === m ? 'selected' : ''}>${m}</option>
            `).join('')}
          </select>
        </div>

        <div>
          <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Observação do Recebimento</label>
          <input type="text" id="rec-drawer-paid-notes" class="form-input" placeholder="Ex: Comprovante enviado via WhatsApp..." />
        </div>
      </form>
    </div>
  `;

  const footerHtml = `
    <div style="display: flex; gap: 8px; width: 100%; justify-content: flex-end;">
      <button type="button" class="btn btn-secondary" id="btn-cancel-receive-drawer" style="flex: 1;">Cancelar</button>
      <button type="submit" form="form-receive-drawer" class="btn btn-primary" style="flex: 2;">Confirmar Recebimento</button>
    </div>
  `;

  openDrawer({
    title: '✓ Confirmar Recebimento',
    contentHtml,
    footerHtml,
    onMount: (drawer, close) => {
      drawer.querySelector('#btn-cancel-receive-drawer')?.addEventListener('click', close);
      drawer.querySelector('#form-receive-drawer')?.addEventListener('submit', (e) => {
        e.preventDefault();
        receiveReceivable(recId, {
          paidDate: drawer.querySelector('#rec-drawer-paid-date').value,
          paymentMethod: drawer.querySelector('#rec-drawer-paid-method').value,
          notes: drawer.querySelector('#rec-drawer-paid-notes').value
        });
        showToast('Recebimento confirmado com sucesso!');
        close();
        renderFinanceModule();
      });
    }
  });
}

function openPayExpenseModal(expId) {
  const exp = getExpenseById(expId);
  if (!exp) return;

  const contentHtml = `
    <div style="display: flex; flex-direction: column; gap: 14px; padding: 4px 0;">
      <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
        <div style="font-size: 0.8125rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">Despesa Operacional</div>
        <div style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary); margin-top: 2px;">
          ${escapeHtml(exp.description)}
        </div>
        <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 2px;">
          Categoria: ${escapeHtml(exp.category || 'Geral')}
        </div>
        <div style="font-size: 1.25rem; font-weight: 800; color: #ef4444; margin-top: 6px;">
          ${formatCurrency(exp.amount)}
        </div>
      </div>

      <form id="form-pay-exp-drawer" style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Data do Pagamento *</label>
          <input type="text" id="exp-drawer-paid-date" class="form-input" required value="${formatDateBR(new Date())}" />
        </div>

        <div>
          <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Forma de Pagamento</label>
          <select id="exp-drawer-paid-method" class="form-select">
            ${PAYMENT_METHODS.map(m => `
              <option value="${m}" ${exp.paymentMethod === m ? 'selected' : ''}>${m}</option>
            `).join('')}
          </select>
        </div>
      </form>
    </div>
  `;

  const footerHtml = `
    <div style="display: flex; gap: 8px; width: 100%; justify-content: flex-end;">
      <button type="button" class="btn btn-secondary" id="btn-cancel-pay-exp-drawer" style="flex: 1;">Cancelar</button>
      <button type="submit" form="form-pay-exp-drawer" class="btn btn-primary" style="flex: 2;">Confirmar Baixa</button>
    </div>
  `;

  openDrawer({
    title: '✓ Confirmar Pagamento de Despesa',
    contentHtml,
    footerHtml,
    onMount: (drawer, close) => {
      drawer.querySelector('#btn-cancel-pay-exp-drawer')?.addEventListener('click', close);
      drawer.querySelector('#form-pay-exp-drawer')?.addEventListener('submit', (e) => {
        e.preventDefault();
        payExpense(expId, {
          paidDate: drawer.querySelector('#exp-drawer-paid-date').value,
          paymentMethod: drawer.querySelector('#exp-drawer-paid-method').value
        });
        showToast('Pagamento de despesa confirmado com sucesso!');
        close();
        renderFinanceModule();
      });
    }
  });
}

function openPayPayableModal(payId) {
  const pay = getPayableById(payId);
  if (!pay) return;

  const contentHtml = `
    <div style="display: flex; flex-direction: column; gap: 14px; padding: 4px 0;">
      <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
        <div style="font-size: 0.8125rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">Conta a Pagar</div>
        <div style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary); margin-top: 2px;">
          ${escapeHtml(pay.supplierName || 'Fornecedor')}
        </div>
        <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 2px;">
          ${escapeHtml(pay.description)}
        </div>
        <div style="font-size: 1.25rem; font-weight: 800; color: #ef4444; margin-top: 6px;">
          ${formatCurrency(pay.amount)}
        </div>
      </div>

      <form id="form-pay-pay-drawer" style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Data do Pagamento *</label>
          <input type="text" id="pay-drawer-paid-date" class="form-input" required value="${formatDateBR(new Date())}" />
        </div>

        <div>
          <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Forma de Pagamento</label>
          <select id="pay-drawer-paid-method" class="form-select">
            ${PAYMENT_METHODS.map(m => `
              <option value="${m}" ${pay.paymentMethod === m ? 'selected' : ''}>${m}</option>
            `).join('')}
          </select>
        </div>
      </form>
    </div>
  `;

  const footerHtml = `
    <div style="display: flex; gap: 8px; width: 100%; justify-content: flex-end;">
      <button type="button" class="btn btn-secondary" id="btn-cancel-pay-pay-drawer" style="flex: 1;">Cancelar</button>
      <button type="submit" form="form-pay-pay-drawer" class="btn btn-primary" style="flex: 2;">Confirmar Pagamento</button>
    </div>
  `;

  openDrawer({
    title: '✓ Confirmar Pagamento de Conta',
    contentHtml,
    footerHtml,
    onMount: (drawer, close) => {
      drawer.querySelector('#btn-cancel-pay-pay-drawer')?.addEventListener('click', close);
      drawer.querySelector('#form-pay-pay-drawer')?.addEventListener('submit', (e) => {
        e.preventDefault();
        payPayable(payId, {
          paidDate: drawer.querySelector('#pay-drawer-paid-date').value,
          paymentMethod: drawer.querySelector('#pay-drawer-paid-method').value
        });
        showToast('Pagamento registrado com sucesso!');
        close();
        renderFinanceModule();
      });
    }
  });
}

function openReceivableDrawer(recId = null) {
  const isEdit = !!recId;
  const rec = isEdit ? getReceivableById(recId) : {
    customer: '',
    description: '',
    amount: '',
    dueDate: formatDateBR(new Date()),
    status: 'aberto',
    paymentMethod: 'Pix',
    notes: ''
  };

  const title = isEdit ? '✏️ Editar Conta a Receber' : '➕ Nova Conta a Receber';

  const contentHtml = `
    <div style="padding: 4px 0;">
      <div class="binder-tabs">
        <div class="binder-tab active">1. Dados da Conta</div>
      </div>
      <div class="binder-panel" style="margin-bottom: 0;">
        <form id="form-rec-drawer" style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Cliente / Pagador *</label>
            <input type="text" id="rec-drawer-customer" class="form-input" required placeholder="Nome do cliente" value="${escapeHtml(rec.customer || '')}" />
          </div>

          <div>
            <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Descrição da Conta *</label>
            <input type="text" id="rec-drawer-desc" class="form-input" required placeholder="Ex: Encomenda de cadernos, entrada..." value="${escapeHtml(rec.description || '')}" />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Valor (R$) *</label>
              <input type="number" step="0.01" min="0.01" id="rec-drawer-amount" class="form-input" required placeholder="0.00" value="${rec.amount || ''}" />
            </div>

            <div>
              <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Vencimento</label>
              <input type="text" id="rec-drawer-duedate" class="form-input" placeholder="DD/MM/AAAA" value="${escapeHtml(rec.dueDate || '')}" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Status</label>
              <select id="rec-drawer-status" class="form-select">
                <option value="aberto" ${rec.status === 'aberto' ? 'selected' : ''}>Em Aberto</option>
                <option value="recebido" ${rec.status === 'recebido' ? 'selected' : ''}>Recebido</option>
              </select>
            </div>

            <div>
              <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Forma Pagamento</label>
              <select id="rec-drawer-method" class="form-select">
                ${PAYMENT_METHODS.map(m => `
                  <option value="${m}" ${rec.paymentMethod === m ? 'selected' : ''}>${m}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div>
            <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Observações</label>
            <textarea id="rec-drawer-notes" class="form-input" rows="3" placeholder="Detalhes ou condições...">${escapeHtml(rec.notes || '')}</textarea>
          </div>
        </form>
      </div>
    </div>
  `;

  const footerHtml = `
    <div style="display: flex; gap: 10px; width: 100%; justify-content: flex-end;">
      <button type="button" class="btn btn-secondary" id="btn-cancel-rec-drawer" style="flex: 1;">Cancelar</button>
      <button type="submit" form="form-rec-drawer" class="btn btn-primary" style="flex: 2;">
        ${isEdit ? 'Salvar Alterações' : 'Cadastrar Recebível'}
      </button>
    </div>
  `;

  openDrawer({
    title,
    contentHtml,
    footerHtml,
    onMount: (drawer, close) => {
      drawer.querySelector('#btn-cancel-rec-drawer')?.addEventListener('click', close);
      drawer.querySelector('#form-rec-drawer')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
          customer: drawer.querySelector('#rec-drawer-customer').value,
          description: drawer.querySelector('#rec-drawer-desc').value,
          amount: parseFloat(drawer.querySelector('#rec-drawer-amount').value),
          dueDate: drawer.querySelector('#rec-drawer-duedate').value,
          status: drawer.querySelector('#rec-drawer-status').value,
          paymentMethod: drawer.querySelector('#rec-drawer-method').value,
          notes: drawer.querySelector('#rec-drawer-notes').value
        };

        if (isEdit) {
          updateReceivable(recId, data);
          showToast('Conta a receber atualizada com sucesso!');
        } else {
          createReceivable(data);
          showToast('Conta a receber cadastrada com sucesso!');
        }

        close();
        renderFinanceModule();
      });
    }
  });
}

function openPayableDrawer(payId = null) {
  const isEdit = !!payId;
  const pay = isEdit ? getPayableById(payId) : {
    supplierName: '',
    description: '',
    amount: '',
    dueDate: formatDateBR(new Date()),
    status: 'aberto',
    paymentMethod: 'Boleto',
    notes: ''
  };

  const title = isEdit ? '✏️ Editar Conta a Pagar' : '➕ Nova Conta a Pagar';

  const contentHtml = `
    <div style="padding: 4px 0;">
      <div class="binder-tabs">
        <div class="binder-tab active">1. Dados da Conta</div>
      </div>
      <div class="binder-panel" style="margin-bottom: 0;">
        <form id="form-pay-drawer" style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Fornecedor / Favorecido *</label>
            <input type="text" id="pay-drawer-supplier" class="form-input" required placeholder="Nome do fornecedor" value="${escapeHtml(pay.supplierName || '')}" />
          </div>

          <div>
            <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Descrição da Conta *</label>
            <input type="text" id="pay-drawer-desc" class="form-input" required placeholder="Ex: Compra de papéis especiais, tinta..." value="${escapeHtml(pay.description || '')}" />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Valor (R$) *</label>
              <input type="number" step="0.01" min="0.01" id="pay-drawer-amount" class="form-input" required placeholder="0.00" value="${pay.amount || ''}" />
            </div>

            <div>
              <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Vencimento</label>
              <input type="text" id="pay-drawer-duedate" class="form-input" placeholder="DD/MM/AAAA" value="${escapeHtml(pay.dueDate || '')}" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Status</label>
              <select id="pay-drawer-status" class="form-select">
                <option value="aberto" ${pay.status === 'aberto' ? 'selected' : ''}>Em Aberto</option>
                <option value="pago" ${pay.status === 'pago' ? 'selected' : ''}>Pago</option>
              </select>
            </div>

            <div>
              <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Forma Pagamento</label>
              <select id="pay-drawer-method" class="form-select">
                ${PAYMENT_METHODS.map(m => `
                  <option value="${m}" ${pay.paymentMethod === m ? 'selected' : ''}>${m}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div>
            <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Observações</label>
            <textarea id="pay-drawer-notes" class="form-input" rows="3" placeholder="Informações adicionais...">${escapeHtml(pay.notes || '')}</textarea>
          </div>
        </form>
      </div>
    </div>
  `;

  const footerHtml = `
    <div style="display: flex; gap: 10px; width: 100%; justify-content: flex-end;">
      <button type="button" class="btn btn-secondary" id="btn-cancel-pay-drawer" style="flex: 1;">Cancelar</button>
      <button type="submit" form="form-pay-drawer" class="btn btn-primary" style="flex: 2;">
        ${isEdit ? 'Salvar Alterações' : 'Cadastrar Conta'}
      </button>
    </div>
  `;

  openDrawer({
    title,
    contentHtml,
    footerHtml,
    onMount: (drawer, close) => {
      drawer.querySelector('#btn-cancel-pay-drawer')?.addEventListener('click', close);
      drawer.querySelector('#form-pay-drawer')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
          supplierName: drawer.querySelector('#pay-drawer-supplier').value,
          description: drawer.querySelector('#pay-drawer-desc').value,
          amount: parseFloat(drawer.querySelector('#pay-drawer-amount').value),
          dueDate: drawer.querySelector('#pay-drawer-duedate').value,
          status: drawer.querySelector('#pay-drawer-status').value,
          paymentMethod: drawer.querySelector('#pay-drawer-method').value,
          notes: drawer.querySelector('#pay-drawer-notes').value
        };

        if (isEdit) {
          updatePayable(payId, data);
          showToast('Conta a pagar atualizada com sucesso!');
        } else {
          createPayable(data);
          showToast('Conta a pagar cadastrada com sucesso!');
        }

        close();
        renderFinanceModule();
      });
    }
  });
}

// ==========================================
// 9. CSV ACTIONS (EXPORT & IMPORT MODAL)
// ==========================================

function handleExportCurrentTabCSV() {
  let csvContent = '';
  let fileName = `financeiro_papermax_${new Date().toISOString().slice(0, 10)}.csv`;

  if (currentFinanceTab === 'despesas') {
    csvContent = exportExpensesCSV();
    fileName = `despesas_papermax_${new Date().toISOString().slice(0, 10)}.csv`;
  } else if (currentFinanceTab === 'a_receber') {
    csvContent = exportReceivablesCSV();
    fileName = `contas_receber_papermax_${new Date().toISOString().slice(0, 10)}.csv`;
  } else if (currentFinanceTab === 'a_pagar') {
    csvContent = exportPayablesCSV();
    fileName = `contas_pagar_papermax_${new Date().toISOString().slice(0, 10)}.csv`;
  } else {
    csvContent = exportSalesCSV();
    fileName = `vendas_papermax_${new Date().toISOString().slice(0, 10)}.csv`;
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function openImportCSVModal() {
  const contentHtml = `
    <div style="display: flex; flex-direction: column; gap: 14px; padding: 4px 0;">
      <div>
        <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Tipo de Importação</label>
        <select id="select-import-type" class="form-select">
          <option value="despesas">💸 Despesas Operacionais</option>
          <option value="receber">📥 Contas a Receber</option>
          <option value="pagar">📤 Contas a Pagar</option>
        </select>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.8125rem; color: var(--text-secondary);">Precisa do modelo?</span>
        <button class="btn btn-sm btn-secondary" id="btn-download-template" type="button">⬇ Baixar Modelo CSV</button>
      </div>

      <div style="border: 2px dashed var(--border-subtle); padding: 20px; border-radius: 8px; text-align: center; background: var(--bg-hover);">
        <input type="file" id="csv-file-input" accept=".csv" style="display: none;" />
        <button class="btn btn-secondary" id="btn-browse-csv" type="button">Selecionar Arquivo .CSV</button>
        <div id="csv-file-name" style="margin-top: 8px; font-size: 0.8125rem; color: var(--text-secondary);">Nenhum arquivo selecionado</div>
      </div>

      <div id="import-errors-log" style="display: none; background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; color: #ef4444; padding: 10px; border-radius: 6px; font-size: 0.8125rem; max-height: 120px; overflow-y: auto;"></div>
    </div>
  `;

  const footerHtml = `
    <div style="display: flex; gap: 8px; width: 100%; justify-content: flex-end;">
      <button type="button" class="btn btn-secondary" id="btn-cancel-import" style="flex: 1;">Cancelar</button>
      <button type="button" class="btn btn-primary" id="btn-execute-import" disabled style="flex: 2;">Importar Dados</button>
    </div>
  `;

  openDrawer({
    title: '⬆ Importar CSV Financeiro',
    contentHtml,
    footerHtml,
    onMount: (drawer, close) => {
      let selectedCSVText = '';
      drawer.querySelector('#btn-cancel-import')?.addEventListener('click', close);

      // Download template
      drawer.querySelector('#btn-download-template')?.addEventListener('click', () => {
        const type = drawer.querySelector('#select-import-type').value;
        let templateContent = '';
        let templateName = 'modelo_despesas.csv';

        if (type === 'despesas') {
          templateContent = exportExpensesCSVTemplate();
          templateName = 'modelo_despesas.csv';
        } else if (type === 'receber') {
          templateContent = exportReceivablesCSVTemplate();
          templateName = 'modelo_contas_a_receber.csv';
        } else if (type === 'pagar') {
          templateContent = exportPayablesCSVTemplate();
          templateName = 'modelo_contas_a_pagar.csv';
        }

        const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', templateName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });

      // Browse file
      const fileInput = drawer.querySelector('#csv-file-input');
      drawer.querySelector('#btn-browse-csv')?.addEventListener('click', () => fileInput.click());

      fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          drawer.querySelector('#csv-file-name').textContent = `Arquivo: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
          const reader = new FileReader();
          reader.onload = (event) => {
            selectedCSVText = event.target.result;
            drawer.querySelector('#btn-execute-import').removeAttribute('disabled');
          };
          reader.readAsText(file);
        }
      });

      // Execute import
      drawer.querySelector('#btn-execute-import')?.addEventListener('click', () => {
        if (!selectedCSVText) return;
        const type = drawer.querySelector('#select-import-type').value;
        let result = null;

        if (type === 'despesas') {
          result = importExpensesCSV(selectedCSVText);
        } else if (type === 'receber') {
          result = importReceivablesCSV(selectedCSVText);
        } else if (type === 'pagar') {
          result = importPayablesCSV(selectedCSVText);
        }

        if (result && result.success) {
          showToast(`✓ Sucesso! ${result.count} registros importados com êxito.`, '✓');
          close();
          renderFinanceModule();
        } else {
          const errLog = drawer.querySelector('#import-errors-log');
          if (errLog) {
            errLog.style.display = 'block';
            errLog.innerHTML = `<strong>Falha na importação:</strong><br/>${(result?.errors || ['Erro desconhecido']).join('<br/>')}`;
          }
        }
      });
    }
  });
}
