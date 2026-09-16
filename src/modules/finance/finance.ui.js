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

import { openContextMenu } from '../../app.js';
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
  receiveReceivable,
  updateReceivable,
  deleteReceivable,
  getPayables,
  getPayableById,
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
import { bus } from '../../core/events.js';

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
    <!-- Top Header -->
    <div class="module-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
      <div>
        <h2 class="module-title" style="margin: 0; font-size: 1.625rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
          💰 Gestão Financeira Integrada
        </h2>
      </div>
      <div class="header-actions" style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="btn btn-secondary" id="btn-finance-export-csv" title="Exportar dados da aba atual para CSV" style="padding: 8px 14px;">
          ⬇ Exportar CSV
        </button>
        <button class="btn btn-secondary" id="btn-finance-import-csv" title="Importar dados via planilha CSV" style="padding: 8px 14px;">
          ⬆ Importar CSV
        </button>
        <button class="btn btn-primary" id="btn-quick-new-expense" style="padding: 8px 16px;">
          + Nova Despesa
        </button>
      </div>
    </div>

    <hr style="border: none; border-top: 1px solid var(--border-subtle); margin: 0 0 24px 0;" />

    <!-- Period Filter Toolbar (Select Dropdown) -->
    <div class="card" style="padding: 14px 20px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 10px;">
      <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
        <label for="select-finance-period" style="font-size: 0.875rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px; margin: 0;">
          📅 Período:
        </label>
        <select id="select-finance-period" class="form-select" style="padding: 8px 14px; font-size: 0.875rem; font-weight: 600; border-radius: 8px; border: 1px solid var(--border-subtle); background: var(--bg-surface); color: var(--text-primary); cursor: pointer; min-width: 200px;">
          <option value="${FINANCIAL_PERIODS.ESTE_MES}" ${currentPeriod === FINANCIAL_PERIODS.ESTE_MES ? 'selected' : ''}>Este Mês</option>
          <option value="${FINANCIAL_PERIODS.MES_ANTERIOR}" ${currentPeriod === FINANCIAL_PERIODS.MES_ANTERIOR ? 'selected' : ''}>Mês Anterior</option>
          <option value="${FINANCIAL_PERIODS.ULTIMOS_30}" ${currentPeriod === FINANCIAL_PERIODS.ULTIMOS_30 ? 'selected' : ''}>Últimos 30 Dias</option>
          <option value="${FINANCIAL_PERIODS.TODO_PERIODO}" ${currentPeriod === FINANCIAL_PERIODS.TODO_PERIODO ? 'selected' : ''}>Todo o Período</option>
          <option value="${FINANCIAL_PERIODS.PERSONALIZADO}" ${currentPeriod === FINANCIAL_PERIODS.PERSONALIZADO ? 'selected' : ''}>Personalizado</option>
        </select>
      </div>

      ${currentPeriod === FINANCIAL_PERIODS.PERSONALIZADO ? `
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <input type="text" id="custom-start-date" class="form-input" style="width: 120px; padding: 6px 10px; font-size: 0.8125rem;" placeholder="DD/MM/AAAA" value="${escapeHtml(customDateRange.startDate)}" />
          <span style="color: var(--text-secondary); font-size: 0.8125rem;">até</span>
          <input type="text" id="custom-end-date" class="form-input" style="width: 120px; padding: 6px 10px; font-size: 0.8125rem;" placeholder="DD/MM/AAAA" value="${escapeHtml(customDateRange.endDate)}" />
          <button class="btn btn-sm btn-primary" id="btn-apply-custom-date" style="padding: 6px 14px;">Aplicar</button>
        </div>
      ` : ''}
    </div>

    <!-- Navigation Tabs -->
    <div class="finance-tab-bar" style="display: flex; gap: 10px; margin-bottom: 24px; border-bottom: 2px solid var(--border-subtle); padding-bottom: 12px; overflow-x: auto;">
      <button class="tab-btn ${currentFinanceTab === 'visao_geral' ? 'active' : ''}" data-finance-tab="visao_geral" style="padding: 8px 16px; font-weight: 600;">
        📊 Visão Geral
      </button>
      <button class="tab-btn ${currentFinanceTab === 'vendas' ? 'active' : ''}" data-finance-tab="vendas" style="padding: 8px 16px; font-weight: 600;">
        🛍️ Vendas Integradas
      </button>
      <button class="tab-btn ${currentFinanceTab === 'despesas' ? 'active' : ''}" data-finance-tab="despesas" style="padding: 8px 16px; font-weight: 600;">
        💸 Despesas Operacionais
      </button>
      <button class="tab-btn ${currentFinanceTab === 'a_receber' ? 'active' : ''}" data-finance-tab="a_receber" style="padding: 8px 16px; font-weight: 600;">
        📥 Contas a Receber
        ${metrics.countReceberVencido > 0 ? `<span class="badge-count" style="background: var(--status-red-bg); color: var(--status-red-text); margin-left: 6px;">${metrics.countReceberVencido}</span>` : ''}
      </button>
      <button class="tab-btn ${currentFinanceTab === 'a_pagar' ? 'active' : ''}" data-finance-tab="a_pagar" style="padding: 8px 16px; font-weight: 600;">
        📤 Contas a Pagar
        ${metrics.countPagarVencido > 0 ? `<span class="badge-count" style="background: var(--status-red-bg); color: var(--status-red-text); margin-left: 6px;">${metrics.countPagarVencido}</span>` : ''}
      </button>
      <button class="tab-btn ${currentFinanceTab === 'custos' ? 'active' : ''}" data-finance-tab="custos" style="padding: 8px 16px; font-weight: 600;">
        🧮 Custos & Margens (BOM)
      </button>
    </div>

    <!-- Sub-tab Render Container -->
    <div id="finance-subtab-container" style="padding-top: 4px;">
      ${renderActiveFinanceSubtab(metrics)}
    </div>

    <!-- Modal / Drawer Container -->
    <div id="finance-modal-container"></div>
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
    <div style="display: flex; flex-direction: column; gap: 24px;">
      
      <!-- REALIZADO vs PREVISTO Split Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
        
        <!-- Bloco 1: REALIZADO NO CAIXA -->
        <div class="card" style="padding: 20px 24px; border: 1px solid var(--border-subtle); border-top: 4px solid #10b981; border-radius: 10px; background: var(--bg-card);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.25rem;">💵</span>
              <h3 style="margin: 0; font-size: 1rem; font-weight: 700; color: var(--text-primary);">FLUXO REALIZADO</h3>
            </div>
            <span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #059669; font-size: 0.75rem; font-weight: 600; padding: 4px 10px; border-radius: 12px;">
              Efetivado no Caixa
            </span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px dashed var(--border-subtle);">
            <div>
              <span style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Entradas Recebidas</span>
              <div style="font-size: 1.375rem; font-weight: 700; color: #10b981; margin-top: 4px;">
                ${formatCurrency(metrics.entradasRealizadas)}
              </div>
            </div>
            <div>
              <span style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Saídas Pagas</span>
              <div style="font-size: 1.375rem; font-weight: 700; color: #ef4444; margin-top: 4px;">
                ${formatCurrency(metrics.saidasRealizadas)}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">
                Compras: ${formatCurrency(metrics.saidasCompras)} · Desp: ${formatCurrency(metrics.saidasDespesas)}
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.875rem; font-weight: 600; color: var(--text-primary);">Saldo Realizado:</span>
            <span style="font-size: 1.5rem; font-weight: 800; color: ${isPositiveRealized ? '#10b981' : '#ef4444'};">
              ${formatCurrency(metrics.saldoRealizado)}
            </span>
          </div>
        </div>

        <!-- Bloco 2: VALORES PREVISTOS (A RECEBER / A PAGAR) -->
        <div class="card" style="padding: 20px 24px; border: 1px solid var(--border-subtle); border-top: 4px solid #f59e0b; border-radius: 10px; background: var(--bg-card);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.25rem;">⏳</span>
              <h3 style="margin: 0; font-size: 1rem; font-weight: 700; color: var(--text-primary);">PREVISTO / ABERTO</h3>
            </div>
            <span class="badge" style="background: rgba(245, 158, 11, 0.12); color: #d97706; font-size: 0.75rem; font-weight: 600; padding: 4px 10px; border-radius: 12px;">
              A Vencer / Vencido
            </span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px dashed var(--border-subtle);">
            <div>
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">A Receber Total</span>
                ${metrics.countReceberVencido > 0 ? `<span style="font-size: 0.6875rem; color: #ef4444; font-weight: 600;">(${metrics.countReceberVencido} vencidos)</span>` : ''}
              </div>
              <div style="font-size: 1.375rem; font-weight: 700; color: #f59e0b; margin-top: 4px;">
                ${formatCurrency(metrics.totalAReceber)}
              </div>
            </div>
            <div>
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">A Pagar Total</span>
                ${metrics.countPagarVencido > 0 ? `<span style="font-size: 0.6875rem; color: #ef4444; font-weight: 600;">(${metrics.countPagarVencido} vencidos)</span>` : ''}
              </div>
              <div style="font-size: 1.375rem; font-weight: 700; color: #8b5cf6; margin-top: 4px;">
                ${formatCurrency(metrics.totalAPagar)}
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.875rem; font-weight: 600; color: var(--text-primary);">Resultado Previsto:</span>
            <span style="font-size: 1.5rem; font-weight: 800; color: ${isPositivePredicted ? '#10b981' : '#ef4444'};">
              ${formatCurrency(metrics.resultadoPrevisto)}
            </span>
          </div>
        </div>

        <!-- Bloco 3: DESEMPENHO ECONÔMICO (COMPETÊNCIA) -->
        <div class="card" style="padding: 20px 24px; border: 1px solid var(--border-subtle); border-top: 4px solid #3b82f6; border-radius: 10px; background: var(--bg-card);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.25rem;">📈</span>
              <h3 style="margin: 0; font-size: 1rem; font-weight: 700; color: var(--text-primary);">DRE DO PERÍODO</h3>
            </div>
            <span class="badge" style="background: rgba(59, 130, 246, 0.12); color: #2563eb; font-size: 0.75rem; font-weight: 600; padding: 4px 10px; border-radius: 12px;">
              ${metrics.totalOrdersInPeriod} Pedidos
            </span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px dashed var(--border-subtle);">
            <div>
              <span style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Vendas Faturadas</span>
              <div style="font-size: 1.375rem; font-weight: 700; color: var(--text-primary); margin-top: 4px;">
                ${formatCurrency(metrics.totalVendas)}
              </div>
            </div>
            <div>
              <span style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Margem Média</span>
              <div style="font-size: 1.375rem; font-weight: 700; color: #3b82f6; margin-top: 4px;">
                ${metrics.margemMediaPercent}%
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.875rem; font-weight: 600; color: var(--text-primary);">Lucro Bruto:</span>
            <span style="font-size: 1.5rem; font-weight: 800; color: #10b981;">
              ${formatCurrency(metrics.lucroBrutoVendas)}
            </span>
          </div>
        </div>

      </div>

      <hr style="border: none; border-top: 1px solid var(--border-subtle); margin: 8px 0;" />

      <!-- DRE Simplificado e Detalhamento de Despesas -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px;">
        
        <!-- Demonstrativo de Resultado -->
        <div class="card" style="padding: 20px 24px; border: 1px solid var(--border-subtle); border-radius: 10px; background: var(--bg-card);">
          <h4 style="margin: 0 0 16px 0; font-size: 1rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            📑 DRE Gerencial Sintético (${formatPeriodLabel(metrics.period)})
          </h4>

          <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.875rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-subtle);">
              <span style="font-weight: 600; color: var(--text-primary);">(+) Receita Bruta de Vendas</span>
              <span style="font-weight: 700; color: #10b981;">${formatCurrency(metrics.totalVendas)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-subtle);">
              <span style="color: var(--text-secondary);">(-) Custo das Mercadorias Vendidas (CMV)</span>
              <span style="color: #ef4444;">${formatCurrency(metrics.totalCustoMercadorias)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(59, 130, 246, 0.05); border-radius: 6px;">
              <span style="font-weight: 700; color: var(--text-primary); font-size: 0.9375rem;">(=) Lucro Bruto da Produção</span>
              <span style="font-weight: 800; color: #2563eb; font-size: 0.9375rem;">${formatCurrency(metrics.lucroBrutoVendas)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-subtle);">
              <span style="color: var(--text-secondary);">(-) Despesas Operacionais Realizadas</span>
              <span style="color: #ef4444;">${formatCurrency(metrics.saidasDespesas)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: rgba(16, 185, 129, 0.08); border-radius: 8px; margin-top: 6px;">
              <span style="font-weight: 800; color: var(--text-primary); font-size: 1rem;">(=) Resultado Operacional Líquido</span>
              <span style="font-weight: 800; color: ${metrics.resultadoOperacional >= 0 ? '#059669' : '#ef4444'}; font-size: 1.1875rem;">
                ${formatCurrency(metrics.resultadoOperacional)}
              </span>
            </div>
          </div>

          <!-- Didactic Atelier Explanations (Task 3) -->
          <div style="margin-top: 20px; padding: 14px; background: var(--bg-surface-raised); border-radius: 8px; border: 1px dashed var(--border-subtle); font-size: 0.75rem; color: var(--text-secondary); line-height: 1.6;">
            <b style="color: var(--text-primary); display: block; margin-bottom: 6px; font-size: 0.8125rem;">💡 Entenda os Termos do Ateliê:</b>
            <div>• <b>Receita:</b> Faturamento bruto total obtido com as vendas de pedidos.</div>
            <div>• <b>CMV:</b> Custo dos materiais e papéis utilizados na fabricação dos itens.</div>
            <div>• <b>Lucro Bruto:</b> Quanto sobra das vendas após descontar o custo dos materiais.</div>
            <div>• <b>Despesas:</b> Gastos gerais da operação do ateliê (aluguel, embalagens, manutenção).</div>
            <div>• <b>Margem:</b> Percentual de lucro gerado pela operação sobre o faturamento.</div>
          </div>
        </div>

        <!-- Composição de Despesas Operacionais por Categoria -->
        <div class="card" style="padding: 20px 24px; border: 1px solid var(--border-subtle); border-radius: 10px; background: var(--bg-card);">
          <h4 style="margin: 0 0 16px 0; font-size: 1rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            📊 Despesas por Categoria
          </h4>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${Object.entries(metrics.expensesByCategory).map(([cat, val]) => {
              const totalExp = metrics.saidasDespesas > 0 ? metrics.saidasDespesas : (Object.values(metrics.expensesByCategory).reduce((a, b) => a + b, 0) || 1);
              const pct = ((val / totalExp) * 100).toFixed(0);
              if (val === 0) return '';
              return `
                <div style="margin-bottom: 6px;">
                  <div style="display: flex; justify-content: space-between; font-size: 0.8125rem; margin-bottom: 6px;">
                    <span style="font-weight: 600; color: var(--text-primary);">${cat}</span>
                    <span style="color: var(--text-secondary); font-weight: 600;">${formatCurrency(val)} (${pct}%)</span>
                  </div>
                  <div style="width: 100%; height: 8px; background: var(--border-subtle); border-radius: 4px; overflow: hidden;">
                    <div style="width: ${pct}%; height: 100%; background: #ef4444; border-radius: 4px;"></div>
                  </div>
                </div>
              `;
            }).join('') || `<div style="font-size: 0.875rem; color: var(--text-secondary); text-align: center; padding: 32px 0;"><p style="margin: 0; font-weight: 600;">Nenhuma despesa registrada neste período.</p><p style="margin: 6px 0 0 0; font-size: 0.75rem;">As despesas aparecerão aqui conforme os custos operacionais do ateliê forem lançados.</p></div>`}
          </div>
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
    <div style="display: flex; flex-direction: column; gap: 20px;">
      
      <!-- Toolbar & Search -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; background: var(--bg-card); padding: 14px 20px; border-radius: 10px; border: 1px solid var(--border-subtle);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <input 
            type="text" 
            id="input-search-sales" 
            class="form-input" 
            placeholder="🔍 Buscar por pedido, cliente ou produto..." 
            value="${escapeHtml(salesSearchQuery)}"
            style="width: 280px;"
          />
        </div>
        <div style="display: flex; gap: 20px; align-items: center; font-size: 0.875rem;">
          <div><strong>Total Vendas:</strong> <span style="color: #10b981; font-weight: 700;">${formatCurrency(totalSalesSum)}</span></div>
          <div><strong>Custo Total:</strong> <span style="color: #ef4444; font-weight: 600;">${formatCurrency(totalCostSum)}</span></div>
          <div><strong>Lucro:</strong> <span style="color: #2563eb; font-weight: 700;">${formatCurrency(totalProfitSum)}</span></div>
          <div><strong>Margem:</strong> <span class="badge" style="background: rgba(37, 99, 235, 0.12); color: #2563eb; font-weight: 700;">${avgMargin.toFixed(1)}%</span></div>
        </div>
      </div>

      <hr style="border: none; border-top: 1px solid var(--border-subtle); margin: 4px 0;" />

      <!-- Sales List -->
      <div class="card" style="padding: 0; background: transparent; border: none; box-shadow: none;">
        <div class="list-group" style="display: flex; flex-direction: column; gap: 10px;">
            ${sales.length === 0 ? `
              <div style="text-align: center; padding: 40px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 10px; color: var(--text-secondary);">
                Nenhuma venda encontrada para os critérios selecionados.
              </div>
            ` : sales.map(s => {
              const isReceived = s.receivingStatus === 'recebido';
              const statusClass = isReceived ? 'status-green' : 'status-yellow';
              return `
                <div class="list-row ${statusClass}" style="padding: 14px 18px; border-radius: 8px;">
                  <div class="list-main">
                    <div class="list-title" style="display: flex; align-items: center; gap: 8px; font-weight: 600;">
                      ${s.orderNumber} - ${escapeHtml(s.customer)}
                      ${s.hasSnapshot ? '<span title="Custo e preço fixados no snapshot do pedido" style="font-size: 0.75rem; color: #3b82f6;">📸</span>' : ''}
                    </div>
                    <div class="list-meta" style="margin-top: 4px;">
                      ${escapeHtml(s.productTitle)} · ${s.qty} un · Preço Unit: ${formatCurrency(s.unitPrice)}
                    </div>
                  </div>
                  <div style="text-align: right; min-width: 140px;">
                    <span style="font-weight: 700; font-size: 14px; color: #10b981;">+${formatCurrency(s.totalSale)}</span>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                      Lucro: <span style="color: ${s.profit >= 0 ? '#10b981' : '#ef4444'}; font-weight: 600;">${formatCurrency(s.profit)}</span> (${s.marginPercent.toFixed(1)}%)
                    </div>
                  </div>
                  <div class="actions" onclick="event.stopPropagation();">
                    <button class="action-btn btn-secondary btn-receivable-menu" data-id="${s.receivableId}" style="padding: 6px 10px; font-size: 14px;" title="Ações">⋮</button>
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
                <div class="list-row ${statusClass}" style="padding: 14px 18px; border-radius: 8px;">
                  <div class="list-main" style="cursor: pointer;" data-action="edit-expense" data-id="${e.id}">
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
                <div class="list-row ${statusClass}" style="padding: 14px 18px; border-radius: 8px;">
                  <div class="list-main" style="cursor: pointer;" data-action="edit-receivable" data-id="${r.id}">
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
                <div class="list-row ${statusClass}" style="padding: 14px 18px; border-radius: 8px;">
                  <div class="list-main" style="cursor: pointer;" data-action="edit-payable" data-id="${p.id}">
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
      
      <!-- Sub-filter Switcher -->
      <div style="display: flex; gap: 10px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px; overflow-x: auto;">
        <button class="btn btn-sm ${costsSubFilter === 'produtos' ? 'btn-primary' : 'btn-secondary'}" data-cost-filter="produtos" style="padding: 8px 14px;">
          📦 Custos de Produtos (${analysis.products.length})
        </button>
        <button class="btn btn-sm ${costsSubFilter === 'componentes' ? 'btn-primary' : 'btn-secondary'}" data-cost-filter="componentes" style="padding: 8px 14px;">
          ⚙️ Custos de Componentes BOM (${analysis.components.length})
        </button>
        <button class="btn btn-sm ${costsSubFilter === 'insumos' ? 'btn-primary' : 'btn-secondary'}" data-cost-filter="insumos" style="padding: 8px 14px;">
          🧵 Custo de Insumos Base (${analysis.materials.length})
        </button>
        <button class="btn btn-sm ${costsSubFilter === 'pedidos' ? 'btn-primary' : 'btn-secondary'}" data-cost-filter="pedidos" style="padding: 8px 14px;">
          📋 Lucratividade por Pedido (${analysis.orders.length})
        </button>
      </div>

      <hr style="border: none; border-top: 1px solid var(--border-subtle); margin: 0;" />

      ${costsSubFilter === 'produtos' ? `
        <div class="card" style="padding: 0; overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: 8px;">
          <table class="data-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem;">
            <thead>
              <tr style="background: var(--bg-hover); border-bottom: 1px solid var(--border-subtle);">
                <th style="padding: 10px 14px;">Produto</th>
                <th style="padding: 10px 14px; text-align: center;">Ficha Técnica (BOM)</th>
                <th style="padding: 10px 14px; text-align: right;">Preço de Venda</th>
                <th style="padding: 10px 14px; text-align: right;">Custo Unit. Real</th>
                <th style="padding: 10px 14px; text-align: right;">Margem Contrib. (R$)</th>
                <th style="padding: 10px 14px; text-align: center;">Margem (%)</th>
              </tr>
            </thead>
            <tbody>
              ${analysis.products.map(p => `
                <tr style="border-bottom: 1px solid var(--border-subtle);">
                  <td style="padding: 10px 14px; font-weight: 600; color: var(--text-primary);">
                    ${escapeHtml(p.name)}
                  </td>
                  <td style="padding: 10px 14px; text-align: center;">
                    ${p.hasBOM ? `
                      <span class="badge" style="background: rgba(59, 130, 246, 0.12); color: #2563eb; font-weight: 600;">
                        ✓ BOM (${p.bomItemsCount} itens)
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
                <tr style="border-bottom: 1px solid var(--border-subtle);">
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
                <tr style="border-bottom: 1px solid var(--border-subtle);">
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
                <tr style="border-bottom: 1px solid var(--border-subtle);">
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
 */
function attachSubtabDynamicListeners() {
  document.querySelectorAll('.btn-expense-menu').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const exp = getExpenseById(id);
      if (!exp) return;

      const isPaid = exp.status === 'pago';
      const menuOptions = [];

      if (!isPaid) {
        menuOptions.push({
          label: '💵 Pagar',
          icon: '💵',
          action: () => openPayExpenseModal(id)
        });
      }
      menuOptions.push({ label: '✏️ Editar', icon: '✏️', action: () => openExpenseDrawer(id) });
      menuOptions.push({
        label: '🗑️ Excluir',
        icon: '🗑️',
        danger: true,
        action: () => {
          if (confirm('Excluir esta despesa?')) {
            deleteExpense(id);
            renderFinanceModule();
          }
        }
      });

      openContextMenu(e, menuOptions);
    });
  });

  document.querySelectorAll('.btn-receivable-menu').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const recs = getReceivables();
      const rec = recs.find(x => x.id === id);
      if (!rec) return;

      const isReceived = rec.status === 'recebido' || rec.status === 'recebida';
      const menuOptions = [];

      if (!isReceived) {
        menuOptions.push({
          label: '💵 Receber',
          icon: '💵',
          action: () => openReceiveModal(id)
        });
      }
      menuOptions.push({ label: '✏️ Editar', icon: '✏️', action: () => openReceivableDrawer(id) });
      menuOptions.push({
        label: '🗑️ Excluir',
        icon: '🗑️',
        danger: true,
        action: () => {
          if (confirm('Excluir este recebível?')) {
            deleteReceivable(id);
            renderFinanceModule();
          }
        }
      });

      openContextMenu(e, menuOptions);
    });
  });

  document.querySelectorAll('.btn-payable-menu').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const pays = getPayables();
      const pay = pays.find(x => x.id === id);
      if (!pay) return;

      const isPaid = pay.status === 'pago';
      const menuOptions = [];

      if (!isPaid) {
        menuOptions.push({
          label: '💵 Pagar',
          icon: '💵',
          action: () => openPayPayableModal(id)
        });
      }
      menuOptions.push({ label: '✏️ Editar', icon: '✏️', action: () => openPayableDrawer(id) });
      menuOptions.push({
        label: '🗑️ Excluir',
        icon: '🗑️',
        danger: true,
        action: () => {
          if (confirm('Excluir esta conta a pagar?')) {
            deletePayable(id);
            renderFinanceModule();
          }
        }
      });

      openContextMenu(e, menuOptions);
    });
  });
}

// ==========================================
// 8. DRAWERS & MODALS
// ==========================================

function openExpenseDrawer(expenseId = null) {
  const modalContainer = document.getElementById('finance-modal-container');
  if (!modalContainer) return;

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

  modalContainer.innerHTML = `
    <div class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 1000; display: flex; justify-content: flex-end;">
      <div class="drawer" style="width: 100%; max-width: 460px; height: 100%; background: var(--bg-card); padding: 24px; box-shadow: -4px 0 24px rgba(0,0,0,0.2); display: flex; flex-direction: column; justify-content: space-between; overflow-y: auto;">
        
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">
              ${isEdit ? '✏️ Editar Despesa' : '➕ Nova Despesa'}
            </h3>
            <button class="btn-close" id="btn-close-drawer" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary);">&times;</button>
          </div>

          <div class="binder-tabs">
            <div class="binder-tab active">1. Dados da Despesa</div>
          </div>
          <div class="binder-panel" style="margin-bottom: 0;">
            <form id="form-expense" style="display: flex; flex-direction: column; gap: 14px;">
              <div>
                <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Descrição da Despesa *</label>
                <input type="text" id="exp-desc" class="form-input" required placeholder="Ex: Energia do ateliê, internet, frete..." value="${escapeHtml(expense.description)}" />
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Categoria</label>
                  <select id="exp-cat" class="form-select">
                    ${EXPENSE_CATEGORIES.map(cat => `
                      <option value="${cat}" ${expense.category === cat ? 'selected' : ''}>${cat}</option>
                    `).join('')}
                  </select>
                </div>

                <div>
                  <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Valor (R$) *</label>
                  <input type="number" step="0.01" min="0.01" id="exp-amount" class="form-input" required placeholder="0.00" value="${expense.amount || ''}" />
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Data Emissão</label>
                  <input type="text" id="exp-date" class="form-input" placeholder="DD/MM/AAAA" value="${escapeHtml(expense.date || '')}" />
                </div>

                <div>
                  <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Data Vencimento</label>
                  <input type="text" id="exp-duedate" class="form-input" placeholder="DD/MM/AAAA" value="${escapeHtml(expense.dueDate || '')}" />
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Status</label>
                  <select id="exp-status" class="form-select">
                    <option value="aberto" ${expense.status === 'aberto' ? 'selected' : ''}>Em Aberto</option>
                    <option value="pago" ${expense.status === 'pago' ? 'selected' : ''}>Pago</option>
                  </select>
                </div>

                <div>
                  <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Forma Pagamento</label>
                  <select id="exp-method" class="form-select">
                    ${PAYMENT_METHODS.map(m => `
                      <option value="${m}" ${expense.paymentMethod === m ? 'selected' : ''}>${m}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div>
                <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Observações</label>
                <textarea id="exp-notes" class="form-input" rows="3" placeholder="Informações adicionais...">${escapeHtml(expense.notes || '')}</textarea>
              </div>
            </form>
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 24px;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-drawer" style="flex: 1;">Cancelar</button>
          <button type="submit" form="form-expense" class="btn btn-primary" style="flex: 2;">
            ${isEdit ? 'Salvar Alterações' : 'Cadastrar Despesa'}
          </button>
        </div>

      </div>
    </div>
  `;

  // Close handlers
  const close = () => { modalContainer.innerHTML = ''; };
  document.getElementById('btn-close-drawer')?.addEventListener('click', close);
  document.getElementById('btn-cancel-drawer')?.addEventListener('click', close);

  // Submit Handler
  document.getElementById('form-expense')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      description: document.getElementById('exp-desc').value,
      category: document.getElementById('exp-cat').value,
      amount: parseFloat(document.getElementById('exp-amount').value),
      date: document.getElementById('exp-date').value,
      dueDate: document.getElementById('exp-duedate').value,
      status: document.getElementById('exp-status').value,
      paymentMethod: document.getElementById('exp-method').value,
      notes: document.getElementById('exp-notes').value
    };

    if (isEdit) {
      updateExpense(expenseId, data);
    } else {
      createExpense(data);
    }

    close();
    renderFinanceModule();
  });
}

function openReceiveModal(recId) {
  const modalContainer = document.getElementById('finance-modal-container');
  if (!modalContainer) return;

  const rec = getReceivableById(recId);
  if (!rec) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px;">
      <div class="card modal-content" style="max-width: 440px; width: 100%; background: var(--bg-card); padding: 24px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
        
        <h3 style="margin: 0 0 12px 0; font-size: 1.125rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
          ✓ Confirmar Recebimento
        </h3>

        <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 16px;">
          Confirmar o recebimento de <strong>${formatCurrency(rec.amount)}</strong> referente a: <br/>
          <em style="color: var(--text-primary);">${escapeHtml(rec.description)} (${escapeHtml(rec.customer)})</em>
        </p>

        <form id="form-receive" style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Data do Recebimento</label>
            <input type="text" id="rec-paid-date" class="form-input" value="${formatDateBR(new Date())}" />
          </div>

          <div>
            <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Forma de Pagamento</label>
            <select id="rec-paid-method" class="form-select">
              ${PAYMENT_METHODS.map(m => `
                <option value="${m}" ${rec.paymentMethod === m ? 'selected' : ''}>${m}</option>
              `).join('')}
            </select>
          </div>

          <div>
            <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Observação do Recebimento</label>
            <input type="text" id="rec-paid-notes" class="form-input" placeholder="Ex: Comprovante enviado no WhatsApp..." />
          </div>

          <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-receive">Cancelar</button>
            <button type="submit" class="btn btn-primary">Confirmar Recebimento</button>
          </div>
        </form>

      </div>
    </div>
  `;

  const close = () => { modalContainer.innerHTML = ''; };
  document.getElementById('btn-cancel-receive')?.addEventListener('click', close);

  document.getElementById('form-receive')?.addEventListener('submit', (e) => {
    e.preventDefault();
    receiveReceivable(recId, {
      paidDate: document.getElementById('rec-paid-date').value,
      paymentMethod: document.getElementById('rec-paid-method').value,
      notes: document.getElementById('rec-paid-notes').value
    });
    close();
    renderFinanceModule();
  });
}

function openPayExpenseModal(expId) {
  const modalContainer = document.getElementById('finance-modal-container');
  if (!modalContainer) return;

  const exp = getExpenseById(expId);
  if (!exp) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px;">
      <div class="card modal-content" style="max-width: 440px; width: 100%; background: var(--bg-card); padding: 24px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
        
        <h3 style="margin: 0 0 12px 0; font-size: 1.125rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
          ✓ Confirmar Pagamento de Despesa
        </h3>

        <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 16px;">
          Confirmar o pagamento de <strong>${formatCurrency(exp.amount)}</strong> para:<br/>
          <em style="color: var(--text-primary);">${escapeHtml(exp.description)}</em>
        </p>

        <form id="form-pay-exp" style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Data do Pagamento</label>
            <input type="text" id="exp-paid-date" class="form-input" value="${formatDateBR(new Date())}" />
          </div>

          <div>
            <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Forma de Pagamento</label>
            <select id="exp-paid-method" class="form-select">
              ${PAYMENT_METHODS.map(m => `
                <option value="${m}" ${exp.paymentMethod === m ? 'selected' : ''}>${m}</option>
              `).join('')}
            </select>
          </div>

          <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-pay-exp">Cancelar</button>
            <button type="submit" class="btn btn-primary">Confirmar Baixa</button>
          </div>
        </form>

      </div>
    </div>
  `;

  const close = () => { modalContainer.innerHTML = ''; };
  document.getElementById('btn-cancel-pay-exp')?.addEventListener('click', close);

  document.getElementById('form-pay-exp')?.addEventListener('submit', (e) => {
    e.preventDefault();
    payExpense(expId, {
      paidDate: document.getElementById('exp-paid-date').value,
      paymentMethod: document.getElementById('exp-paid-method').value
    });
    close();
    renderFinanceModule();
  });
}

function openPayPayableModal(payId) {
  const modalContainer = document.getElementById('finance-modal-container');
  if (!modalContainer) return;

  const pay = getPayableById(payId);
  if (!pay) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px;">
      <div class="card modal-content" style="max-width: 440px; width: 100%; background: var(--bg-card); padding: 24px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
        
        <h3 style="margin: 0 0 12px 0; font-size: 1.125rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
          ✓ Confirmar Pagamento de Conta
        </h3>

        <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 16px;">
          Confirmar o pagamento de <strong>${formatCurrency(pay.amount)}</strong> para:<br/>
          <em style="color: var(--text-primary);">${escapeHtml(pay.description)} (${escapeHtml(pay.supplierName)})</em>
        </p>

        <form id="form-pay-payable" style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Data do Pagamento</label>
            <input type="text" id="payable-paid-date" class="form-input" value="${formatDateBR(new Date())}" />
          </div>

          <div>
            <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Forma de Pagamento</label>
            <select id="payable-paid-method" class="form-select">
              ${PAYMENT_METHODS.map(m => `
                <option value="${m}" ${pay.paymentMethod === m ? 'selected' : ''}>${m}</option>
              `).join('')}
            </select>
          </div>

          <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-pay-payable">Cancelar</button>
            <button type="submit" class="btn btn-primary">Confirmar Pagamento</button>
          </div>
        </form>

      </div>
    </div>
  `;

  const close = () => { modalContainer.innerHTML = ''; };
  document.getElementById('btn-cancel-pay-payable')?.addEventListener('click', close);

  document.getElementById('form-pay-payable')?.addEventListener('submit', (e) => {
    e.preventDefault();
    payPayable(payId, {
      paidDate: document.getElementById('payable-paid-date').value,
      paymentMethod: document.getElementById('payable-paid-method').value
    });
    close();
    renderFinanceModule();
  });
}

function openReceivableDrawer(recId) {
  const modalContainer = document.getElementById('finance-modal-container');
  if (!modalContainer) return;

  const rec = getReceivableById(recId);
  if (!rec) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 1000; display: flex; justify-content: flex-end;">
      <div class="drawer" style="width: 100%; max-width: 440px; height: 100%; background: var(--bg-card); padding: 24px; box-shadow: -4px 0 24px rgba(0,0,0,0.2); display: flex; flex-direction: column; justify-content: space-between; overflow-y: auto;">
        
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">
              ✏️ Editar Conta a Receber
            </h3>
            <button class="btn-close" id="btn-close-rec-drawer" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary);">&times;</button>
          </div>

          <div class="binder-tabs">
            <div class="binder-tab active">1. Dados da Conta</div>
          </div>
          <div class="binder-panel" style="margin-bottom: 0;">
            <form id="form-edit-rec" style="display: flex; flex-direction: column; gap: 14px;">
              <div>
                <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Cliente</label>
                <input type="text" id="rec-customer" class="form-input" value="${escapeHtml(rec.customer)}" />
              </div>

              <div>
                <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Descrição</label>
                <input type="text" id="rec-description" class="form-input" value="${escapeHtml(rec.description)}" />
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Valor (R$)</label>
                  <input type="number" step="0.01" min="0.01" id="rec-amount" class="form-input" value="${rec.amount}" />
                </div>

                <div>
                  <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Vencimento</label>
                  <input type="text" id="rec-duedate" class="form-input" value="${escapeHtml(rec.dueDate || '')}" />
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Status</label>
                  <select id="rec-status" class="form-select">
                    <option value="aberto" ${rec.status === 'aberto' ? 'selected' : ''}>Em Aberto</option>
                    <option value="recebido" ${rec.status === 'recebido' ? 'selected' : ''}>Recebido</option>
                  </select>
                </div>

                <div>
                  <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Forma Pagamento</label>
                  <select id="rec-method" class="form-select">
                    ${PAYMENT_METHODS.map(m => `
                      <option value="${m}" ${rec.paymentMethod === m ? 'selected' : ''}>${m}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div>
                <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Observações</label>
                <textarea id="rec-notes" class="form-input" rows="3">${escapeHtml(rec.notes || '')}</textarea>
              </div>
            </form>
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 24px;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-rec-drawer" style="flex: 1;">Cancelar</button>
          <button type="submit" form="form-edit-rec" class="btn btn-primary" style="flex: 2;">Salvar</button>
        </div>

      </div>
    </div>
  `;

  const close = () => { modalContainer.innerHTML = ''; };
  document.getElementById('btn-close-rec-drawer')?.addEventListener('click', close);
  document.getElementById('btn-cancel-rec-drawer')?.addEventListener('click', close);

  document.getElementById('form-edit-rec')?.addEventListener('submit', (e) => {
    e.preventDefault();
    updateReceivable(recId, {
      customer: document.getElementById('rec-customer').value,
      description: document.getElementById('rec-description').value,
      amount: parseFloat(document.getElementById('rec-amount').value),
      dueDate: document.getElementById('rec-duedate').value,
      status: document.getElementById('rec-status').value,
      paymentMethod: document.getElementById('rec-method').value,
      notes: document.getElementById('rec-notes').value
    });
    close();
    renderFinanceModule();
  });
}

function openPayableDrawer(payId) {
  const modalContainer = document.getElementById('finance-modal-container');
  if (!modalContainer) return;

  const pay = getPayableById(payId);
  if (!pay) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 1000; display: flex; justify-content: flex-end;">
      <div class="drawer" style="width: 100%; max-width: 440px; height: 100%; background: var(--bg-card); padding: 24px; box-shadow: -4px 0 24px rgba(0,0,0,0.2); display: flex; flex-direction: column; justify-content: space-between; overflow-y: auto;">
        
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">
              ✏️ Editar Conta a Pagar
            </h3>
            <button class="btn-close" id="btn-close-pay-drawer" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary);">&times;</button>
          </div>

          <form id="form-edit-pay" style="display: flex; flex-direction: column; gap: 14px;">
            <div>
              <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Fornecedor</label>
              <input type="text" id="pay-supplier" class="form-input" value="${escapeHtml(pay.supplierName || '')}" />
            </div>

            <div>
              <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Descrição</label>
              <input type="text" id="pay-description" class="form-input" value="${escapeHtml(pay.description)}" />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Valor (R$)</label>
                <input type="number" step="0.01" min="0.01" id="pay-amount" class="form-input" value="${pay.amount}" />
              </div>

              <div>
                <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Vencimento</label>
                <input type="text" id="pay-duedate" class="form-input" value="${escapeHtml(pay.dueDate || '')}" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Status</label>
                <select id="pay-status" class="form-select">
                  <option value="aberto" ${pay.status === 'aberto' ? 'selected' : ''}>Em Aberto</option>
                  <option value="pago" ${pay.status === 'pago' ? 'selected' : ''}>Pago</option>
                </select>
              </div>

              <div>
                <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Forma Pagamento</label>
                <select id="pay-method" class="form-select">
                  ${PAYMENT_METHODS.map(m => `
                    <option value="${m}" ${pay.paymentMethod === m ? 'selected' : ''}>${m}</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div>
              <label class="form-label" style="font-weight: 600; font-size: 0.875rem;">Observações</label>
              <textarea id="pay-notes" class="form-input" rows="3">${escapeHtml(pay.notes || '')}</textarea>
            </div>
          </form>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 24px;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-pay-drawer" style="flex: 1;">Cancelar</button>
          <button type="submit" form="form-edit-pay" class="btn btn-primary" style="flex: 2;">Salvar</button>
        </div>

      </div>
    </div>
  `;

  const close = () => { modalContainer.innerHTML = ''; };
  document.getElementById('btn-close-pay-drawer')?.addEventListener('click', close);
  document.getElementById('btn-cancel-pay-drawer')?.addEventListener('click', close);

  document.getElementById('form-edit-pay')?.addEventListener('submit', (e) => {
    e.preventDefault();
    updatePayable(payId, {
      supplierName: document.getElementById('pay-supplier').value,
      description: document.getElementById('pay-description').value,
      amount: parseFloat(document.getElementById('pay-amount').value),
      dueDate: document.getElementById('pay-duedate').value,
      status: document.getElementById('pay-status').value,
      paymentMethod: document.getElementById('pay-method').value,
      notes: document.getElementById('pay-notes').value
    });
    close();
    renderFinanceModule();
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
  const modalContainer = document.getElementById('finance-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px;">
      <div class="card modal-content" style="max-width: 500px; width: 100%; background: var(--bg-card); padding: 24px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
        
        <h3 style="margin: 0 0 12px 0; font-size: 1.125rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
          ⬆ Importar CSV Financeiro
        </h3>

        <div style="display: flex; flex-direction: column; gap: 14px;">
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
            <button class="btn btn-sm btn-secondary" id="btn-download-template">⬇ Baixar Modelo CSV</button>
          </div>

          <div style="border: 2px dashed var(--border-subtle); padding: 20px; border-radius: 8px; text-align: center; background: var(--bg-hover);">
            <input type="file" id="csv-file-input" accept=".csv" style="display: none;" />
            <button class="btn btn-secondary" id="btn-browse-csv">Selecionar Arquivo .CSV</button>
            <div id="csv-file-name" style="margin-top: 8px; font-size: 0.8125rem; color: var(--text-secondary);">Nenhum arquivo selecionado</div>
          </div>

          <div id="import-errors-log" style="display: none; background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; color: #ef4444; padding: 10px; border-radius: 6px; font-size: 0.8125rem; max-height: 120px; overflow-y: auto;"></div>

          <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-import">Cancelar</button>
            <button type="button" class="btn btn-primary" id="btn-execute-import" disabled>Importar Dados</button>
          </div>
        </div>

      </div>
    </div>
  `;

  let selectedCSVText = '';
  const close = () => { modalContainer.innerHTML = ''; };
  document.getElementById('btn-cancel-import')?.addEventListener('click', close);

  // Download template
  document.getElementById('btn-download-template')?.addEventListener('click', () => {
    const type = document.getElementById('select-import-type').value;
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
  const fileInput = document.getElementById('csv-file-input');
  document.getElementById('btn-browse-csv')?.addEventListener('click', () => fileInput.click());

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      document.getElementById('csv-file-name').textContent = `Arquivo: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      const reader = new FileReader();
      reader.onload = (event) => {
        selectedCSVText = event.target.result;
        document.getElementById('btn-execute-import').removeAttribute('disabled');
      };
      reader.readAsText(file);
    }
  });

  // Execute import
  document.getElementById('btn-execute-import')?.addEventListener('click', () => {
    if (!selectedCSVText) return;
    const type = document.getElementById('select-import-type').value;
    let result = null;

    if (type === 'despesas') {
      result = importExpensesCSV(selectedCSVText);
    } else if (type === 'receber') {
      result = importReceivablesCSV(selectedCSVText);
    } else if (type === 'pagar') {
      result = importPayablesCSV(selectedCSVText);
    }

    if (result && result.success) {
      alert(`✓ Sucesso! ${result.count} registros importados com êxito.`);
      close();
      renderFinanceModule();
    } else {
      const errLog = document.getElementById('import-errors-log');
      if (errLog) {
        errLog.style.display = 'block';
        errLog.innerHTML = `<strong>Falha na importação:</strong><br/>${(result?.errors || ['Erro desconhecido']).join('<br/>')}`;
      }
    }
  });
}
