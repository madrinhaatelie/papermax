/**
 * PAPER MAX - Product Commercial Intelligence UI (Etapa 7)
 * Renders ranking, trends & seasonality, margin/stock capacity views,
 * enriched vitrine badges, and commercial insights drawer.
 */

import {
  calculateProductIntelligence,
  exportProductIntelligenceCSV,
  INTELLIGENCE_PERIODS,
  SEASONS_LIST,
  getPeriodLabel
} from './products.intelligence.js';
import { getCategories } from '../categories/categories.js';
import { formatCurrency, formatDateBR, escapeHtml } from '../../utils/sanitize.js';

// Global state for Products sub-navigation and filters
export const productsUIState = {
  currentSubtab: 'todos', // 'todos', 'vitrine', 'ranking', 'tendencias', 'capacidade', 'categorias'
  rankingPeriod: INTELLIGENCE_PERIODS.DIAS_30,
  rankingSort: 'quantity', // 'quantity', 'revenue', 'profit', 'margin', 'growth', 'drop'
  rankingCategory: '',
  customStartDate: '',
  customEndDate: ''
};

/**
 * Renderiza a aba de Ranking Comercial de Produtos
 */
export function renderProductsRankingView(container, options = {}) {
  const categories = getCategories();
  const state = { ...productsUIState, ...options };

  const analysis = calculateProductIntelligence({
    period: state.rankingPeriod,
    sortBy: state.rankingSort,
    categoryId: state.rankingCategory || null,
    customStart: state.customStartDate || null,
    customEnd: state.customEndDate || null
  });

  container.innerHTML = `
    <!-- Filtros de Período e Ordenação do Ranking -->
    <div class="panel" style="margin-top: 12px; padding: 14px 16px;">
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px;">
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px;">
          <span style="font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Período:</span>
          <div class="btn-group" id="ranking-period-group">
            <button class="btn btn-sm ${state.rankingPeriod === INTELLIGENCE_PERIODS.HOJE ? 'btn-primary' : ''}" data-period="${INTELLIGENCE_PERIODS.HOJE}">Hoje</button>
            <button class="btn btn-sm ${state.rankingPeriod === INTELLIGENCE_PERIODS.DIAS_7 ? 'btn-primary' : ''}" data-period="${INTELLIGENCE_PERIODS.DIAS_7}">7 dias</button>
            <button class="btn btn-sm ${state.rankingPeriod === INTELLIGENCE_PERIODS.DIAS_30 ? 'btn-primary' : ''}" data-period="${INTELLIGENCE_PERIODS.DIAS_30}">30 dias</button>
            <button class="btn btn-sm ${state.rankingPeriod === INTELLIGENCE_PERIODS.DIAS_90 ? 'btn-primary' : ''}" data-period="${INTELLIGENCE_PERIODS.DIAS_90}">90 dias</button>
            <button class="btn btn-sm ${state.rankingPeriod === INTELLIGENCE_PERIODS.MESES_12 ? 'btn-primary' : ''}" data-period="${INTELLIGENCE_PERIODS.MESES_12}">12 meses</button>
            <button class="btn btn-sm ${state.rankingPeriod === INTELLIGENCE_PERIODS.TODO_PERIODO ? 'btn-primary' : ''}" data-period="${INTELLIGENCE_PERIODS.TODO_PERIODO}">Todo Histórico</button>
          </div>
        </div>

        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px;">
          <select class="form-select" id="sel-ranking-sort" style="width: auto; font-size: 12px; padding: 4px 10px;">
            <option value="quantity" ${state.rankingSort === 'quantity' ? 'selected' : ''}>Classificar: Mais Vendidos (Qtd)</option>
            <option value="revenue" ${state.rankingSort === 'revenue' ? 'selected' : ''}>Classificar: Maior Receita (R$)</option>
            <option value="profit" ${state.rankingSort === 'profit' ? 'selected' : ''}>Classificar: Maior Lucro (R$)</option>
            <option value="margin" ${state.rankingSort === 'margin' ? 'selected' : ''}>Classificar: Maior Margem (%)</option>
            <option value="growth" ${state.rankingSort === 'growth' ? 'selected' : ''}>Classificar: Maior Crescimento (%)</option>
            <option value="drop" ${state.rankingSort === 'drop' ? 'selected' : ''}>Classificar: Maior Queda (%)</option>
          </select>

          <select class="form-select" id="sel-ranking-cat" style="width: auto; font-size: 12px; padding: 4px 10px;">
            <option value="">Todas as Categorias</option>
            ${categories.map(c => `<option value="${c.id}" ${state.rankingCategory === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>

          <button class="btn btn-sm" id="btn-export-ranking-csv" title="Exportar Ranking em Planilha CSV">
            📥 Exportar CSV
          </button>
        </div>
      </div>
    </div>

    <!-- Cards de Resumo Comercial do Período -->
    <div class="lifetime-grid" style="margin-top: 12px;">
      <div class="life-card">
        <span class="life-label">Volume Total de Vendas</span>
        <b class="life-val">${analysis.totalQtySold} un</b>
        <span style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">no período (${analysis.periodLabel})</span>
      </div>
      <div class="life-card">
        <span class="life-label">Faturamento Total Bruto</span>
        <b class="life-val">${formatCurrency(analysis.totalRevenue)}</b>
        <span style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">preço real dos pedidos</span>
      </div>
      <div class="life-card">
        <span class="life-label">Lucro Bruto dos Produtos</span>
        <b class="life-val">${formatCurrency(analysis.totalProfit)}</b>
        <span style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Margem Média: ${analysis.overallMargin.toFixed(1)}%</span>
      </div>
      <div class="life-card">
        <span class="life-label">Produto Mais Vendido</span>
        <b class="life-val" style="font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${analysis.highlights.bestSeller ? escapeHtml(analysis.highlights.bestSeller.name) : '—'}
        </b>
        <span style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
          ${analysis.highlights.bestSeller ? `${analysis.highlights.bestSeller.qty} un (${formatCurrency(analysis.highlights.bestSeller.revenue)})` : 'Sem pedidos no período'}
        </span>
      </div>
    </div>

    <!-- Tabela Estruturada do Ranking de Produtos -->
    <div class="panel" style="margin-top: 12px; padding: 0;">
      <div class="panel-header" style="padding: 12px 16px; border-bottom: 1px solid var(--border-subtle);">
        <div>
          <h3 class="panel-title">Ranking Comercial de Desempenho</h3>
        </div>
      </div>

      <div class="list-group" style="display: flex; flex-direction: column; gap: 8px;">
            ${analysis.products.length === 0 ? `
              <div style="text-align: center; padding: 32px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; color: var(--text-secondary);">
                  <b style="display: block; color: var(--text-primary); margin-bottom: 4px;">Nenhum produto encontrado para os filtros selecionados.</b>
                  Cadastre produtos no catálogo ou ajuste os filtros de busca.
              </div>
            ` : analysis.products.map((p, idx) => {
              const posBadgeClass = idx === 0 ? 'pos-gold' : idx === 1 ? 'pos-silver' : idx === 2 ? 'pos-bronze' : 'pos-default';
              
              let growthHtml = '<span style="color: var(--text-muted); font-size: 11px;">—</span>';
              if (p.hasSufficientComparisonData) {
                if (p.growthQtyPct > 0) {
                  growthHtml = `<span style="color: #059669; font-weight: 600; font-size: 11px;">▲ +${p.growthQtyPct.toFixed(1)}%</span>`;
                } else if (p.growthQtyPct < 0) {
                  growthHtml = `<span style="color: #dc2626; font-weight: 600; font-size: 11px;">▼ ${p.growthQtyPct.toFixed(1)}%</span>`;
                } else {
                  growthHtml = `<span style="color: var(--text-muted); font-size: 11px;">0.0%</span>`;
                }
              }

              let stockCapHtml = '<span style="color: var(--text-muted); font-size: 11px;">Sem Ficha Técnica</span>';
              if (p.stockCapacity !== null) {
                const isShortage = p.qty > 0 && p.stockCapacity < p.qty;
                if (isShortage) {
                  stockCapHtml = `<span class="badge-count" style="background: #fee2e2; color: #991b1b; font-size: 10px;" title="Gargalo: ${p.bottleneck ? p.bottleneck.materialName : 'insumos'}">⚠ ${p.stockCapacity} un</span>`;
                } else {
                  stockCapHtml = `<span class="badge-count" style="background: #dcfce7; color: #166534; font-size: 10px;">✓ ${p.stockCapacity} un</span>`;
                }
              }

              let marginBadgeClass = 'status-neutral';
              if (p.margin >= 55) marginBadgeClass = 'status-green';
              else if (p.margin < 25 && p.margin > 0) marginBadgeClass = 'status-orange';

              return `
                <div class="list-row status-neutral">
                  <div class="list-main" style="display: flex; gap: 12px; align-items: center; cursor: pointer;" data-action="view-intelligence" data-id="${p.id}">
                    <div style="flex: 0 0 40px; text-align: center;">
                      <span class="ranking-pos-badge ${posBadgeClass}" style="display: inline-block;">${idx + 1}º</span>
                    </div>
                    <div style="flex: 1;">
                      <div class="list-title" style="display: flex; align-items: center; gap: 8px;">
                        ${escapeHtml(p.name)}
                        ${p.diagnostic.badges.map(b => `<span class="diag-badge diag-${b.type}">${escapeHtml(b.label)}</span>`).join('')}
                      </div>
                      <div class="list-meta" style="display: flex; gap: 12px; flex-wrap: wrap;">
                        <span>Preço: ${formatCurrency(p.avgPrice)} · Custo: ${formatCurrency(p.avgCost)}</span>
                        <span>Pedidos: ${p.orderCount} · Crescimento: ${growthHtml}</span>
                        <span>Estoque: ${stockCapHtml}</span>
                      </div>
                    </div>
                  </div>
                  <div style="text-align: right; min-width: 140px;">
                    <span style="font-weight: 700; font-size: 14px;">${p.qty} un</span>
                    <div style="font-size: 11px; color: var(--text-muted);">
                      Vendas: ${formatCurrency(p.revenue)} · Lucro: <span style="color: #10b981; font-weight: 600;">${formatCurrency(p.profit)}</span>
                    </div>
                  </div>
                  <div class="actions">
                    <button class="action-btn" data-action="view-intelligence" data-id="${p.id}">💡 Inteligência Comercial</button>
                  </div>
                </div>
              `;
            }).join('')}
      </div>
    </div>
  `;

  // Bind Period Buttons
  container.querySelectorAll('#ranking-period-group button').forEach(btn => {
    btn.addEventListener('click', () => {
      productsUIState.rankingPeriod = btn.dataset.period;
      renderProductsRankingView(container, options);
    });
  });

  // Bind Sort Selector
  const sortSelect = container.querySelector('#sel-ranking-sort');
  if (sortSelect) {
    sortSelect.addEventListener('change', e => {
      productsUIState.rankingSort = e.target.value;
      renderProductsRankingView(container, options);
    });
  }

  // Bind Category Filter
  const catSelect = container.querySelector('#sel-ranking-cat');
  if (catSelect) {
    catSelect.addEventListener('change', e => {
      productsUIState.rankingCategory = e.target.value;
      renderProductsRankingView(container, options);
    });
  }

  // Bind CSV Export
  const exportBtn = container.querySelector('#btn-export-ranking-csv');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const csv = exportProductIntelligenceCSV({
        period: productsUIState.rankingPeriod,
        sortBy: productsUIState.rankingSort,
        categoryId: productsUIState.rankingCategory || null
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ranking_produtos_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  // Bind Intelligence Details Action
  container.querySelectorAll('[data-action="view-intelligence"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof options.openIntelligenceDrawer === 'function') {
        options.openIntelligenceDrawer(btn.dataset.id);
      }
    });
  });
}

/**
 * Renderiza a aba de Tendências & Sazonalidade
 */
export function renderProductsTrendsView(container, options = {}) {
  const analysis = calculateProductIntelligence({
    period: INTELLIGENCE_PERIODS.DIAS_90
  });

  const growingProds = analysis.products.filter(p => p.hasSufficientComparisonData && p.growthQtyPct >= 20);
  const droppingProds = analysis.products.filter(p => p.hasSufficientComparisonData && p.growthQtyPct <= -15);
  const highMarginProds = analysis.products.filter(p => p.qty > 0 && p.margin >= 55);
  const highVolLowMarginProds = analysis.products.filter(p => p.qty >= 20 && p.margin < 30);
  const seasonalProds = analysis.products.filter(p => p.seasonalInsight.hasSeasonality);

  container.innerHTML = `
    <div class="module-header" style="margin-top: 12px; margin-bottom: 12px;">
      <div>
        <h3 class="panel-title" style="font-size: 16px;">📈 Tendências de Mercado e Padrões de Demanda</h3>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px;">
      <!-- Card: Em Forte Crescimento -->
      <div class="panel" style="margin: 0; padding: 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <h4 style="font-size: 14px; font-weight: 700; color: #059669; margin: 0;">🚀 Produtos em Crescimento</h4>
          <span class="badge-count" style="background: #dcfce7; color: #166534;">${growingProds.length} produtos</span>
        </div>
        <p style="font-size: 11px; color: var(--text-muted); margin-bottom: 10px;">
          Aumento acima de 20% no volume de pedidos em relação ao período anterior equivalente.
        </p>
        ${growingProds.length === 0 ? `
          <div style="font-size: 12px; color: var(--text-muted); font-style: italic;">Nenhum produto com aceleração expressiva no momento.</div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${growingProds.map(p => `
              <div style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <b>${escapeHtml(p.name)}</b>
                  <span style="color: #059669; font-weight: 700; font-size: 12px;">+${p.growthQtyPct.toFixed(1)}%</span>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                  ${p.qty} un vendidas (vs ${p.prevQty} un anteriores) · Lucro: ${formatCurrency(p.profit)}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Card: Em Queda de Demanda -->
      <div class="panel" style="margin: 0; padding: 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <h4 style="font-size: 14px; font-weight: 700; color: #dc2626; margin: 0;">📉 Produtos em Queda Recente</h4>
          <span class="badge-count" style="background: #fee2e2; color: #991b1b;">${droppingProds.length} produtos</span>
        </div>
        <p style="font-size: 11px; color: var(--text-muted); margin-bottom: 10px;">
          Redução superior a 15% nas vendas em relação ao ciclo anterior.
        </p>
        ${droppingProds.length === 0 ? `
          <div style="font-size: 12px; color: var(--text-muted); font-style: italic;">Nenhum produto em queda acentuada nos dados atuais.</div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${droppingProds.map(p => `
              <div style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <b>${escapeHtml(p.name)}</b>
                  <span style="color: #dc2626; font-weight: 700; font-size: 12px;">${p.growthQtyPct.toFixed(1)}%</span>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                  Caiu de ${p.prevQty} para ${p.qty} un · Sugestão: revisar fotos ou criar kits.
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Card: Alta Margem de Contribuição -->
      <div class="panel" style="margin: 0; padding: 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <h4 style="font-size: 14px; font-weight: 700; color: var(--accent-primary); margin: 0;">💎 Alta Margem (> 55%)</h4>
          <span class="badge-count">${highMarginProds.length} produtos</span>
        </div>
        <p style="font-size: 11px; color: var(--text-muted); margin-bottom: 10px;">
          Produtos com excelente retorno líquido por unidade produzida.
        </p>
        ${highMarginProds.length === 0 ? `
          <div style="font-size: 12px; color: var(--text-muted); font-style: italic;">Nenhum produto acima de 55% de margem no período.</div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${highMarginProds.map(p => `
              <div style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <b>${escapeHtml(p.name)}</b>
                  <span class="status-pill status-green" style="font-size: 11px;">${p.margin.toFixed(1)}% margem</span>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                  Preço: ${formatCurrency(p.avgPrice)} · Custo: ${formatCurrency(p.avgCost)} · Lucro: ${formatCurrency(p.profit)}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Card: Alto Volume com Baixa Margem -->
      <div class="panel" style="margin: 0; padding: 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <h4 style="font-size: 14px; font-weight: 700; color: #d97706; margin: 0;">⚖ Alto Volume / Baixa Margem</h4>
          <span class="badge-count" style="background: #fef3c7; color: #92400e;">${highVolLowMarginProds.length} produtos</span>
        </div>
        <p style="font-size: 11px; color: var(--text-muted); margin-bottom: 10px;">
          Itens de giro elevado, porém com margem de contribuição inferior a 30%.
        </p>
        ${highVolLowMarginProds.length === 0 ? `
          <div style="font-size: 12px; color: var(--text-muted); font-style: italic;">Nenhum desbalanceamento crítico de margem identificado.</div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${highVolLowMarginProds.map(p => `
              <div style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <b>${escapeHtml(p.name)}</b>
                  <span class="status-pill status-orange" style="font-size: 11px;">${p.margin.toFixed(1)}% margem</span>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                  Vendeu ${p.qty} un · Recomendação: renegociar insumos ou reajustar tabela.
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>

    <!-- Seção de Sazonalidade do Ateliê de Papelaria -->
    <div class="panel" style="margin-top: 14px;">
      <div class="panel-header" style="margin-bottom: 12px;">
        <div>
          <h3 class="panel-title">🗓 Calendário e Picos Sazonais de Papelaria Personalizada</h3>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">
        ${SEASONS_LIST.map(season => {
          const matchedProds = analysis.products.filter(p => p.seasonalInsight.hasSeasonality && p.seasonalInsight.seasonName === season.name);
          return `
            <div style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px;">
              <div style="font-size: 11px; font-weight: 700; color: var(--accent-primary); text-transform: uppercase;">
                ${season.peakLabel}
              </div>
              <div style="font-size: 13px; font-weight: 700; margin: 2px 0 4px 0;">${escapeHtml(season.name)}</div>
              <div style="font-size: 11px; color: var(--text-muted);">
                ${matchedProds.length > 0 ? `
                  <span style="color: #059669; font-weight: 600;">${matchedProds.length} produto(s) correlacionado(s)</span>
                ` : `
                  <span>Histórico insuficiente</span>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/**
 * Renderiza a aba de Capacidade de Estoque & Gargalos de Produção
 */
export function renderProductsCapacityView(container, options = {}) {
  const analysis = calculateProductIntelligence({
    period: INTELLIGENCE_PERIODS.DIAS_30,
    sortBy: 'quantity'
  });

  const prodsWithBom = analysis.products.filter(p => p.compositionCount > 0);

  container.innerHTML = `
    <div class="module-header" style="margin-top: 12px; margin-bottom: 12px;">
      <div>
        <h3 class="panel-title" style="font-size: 16px;">📦 Inteligência de Estoque vs. Demanda de Produtos</h3>
      </div>
    </div>

    <div class="panel" style="margin-top: 12px; padding: 0;">
      <div class="list-group" style="display: flex; flex-direction: column; gap: 8px;">
            ${prodsWithBom.length === 0 ? `
              <div style="text-align: center; padding: 32px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; color: var(--text-secondary);">
                  Nenhum produto com Ficha Técnica de Insumos configurada. Cadastre os insumos nos produtos para ativar a inteligência de capacidade.
              </div>
            ` : prodsWithBom.map(p => {
              const isShortage = p.stockCapacity !== null && p.qty > 0 && p.stockCapacity < p.qty;
              return `
                <div class="list-row ${isShortage ? 'status-red' : 'status-green'}">
                  <div class="list-main">
                    <div class="list-title" style="display: flex; align-items: center; gap: 8px;">
                      ${escapeHtml(p.name)}
                      <span class="badge-count" style="font-size: 10px;">${p.compositionCount} itens vinculados</span>
                    </div>
                    <div class="list-meta" style="display: flex; gap: 12px; flex-wrap: wrap;">
                      <span>Demanda Recente (30d): <b>${p.qty} un</b></span>
                      <span>
                      ${p.bottleneck ? `
                          Gargalo: <b style="color: #dc2626;">${escapeHtml(p.bottleneck.materialName)}</b> (Disp: ${p.bottleneck.stockAvailable} ${p.bottleneck.unit} · Req: ${p.bottleneck.requiredPerUnit} ${p.bottleneck.unit}/un)
                      ` : `
                        <span style="color: #059669;">✓ Nenhum limitante crítico</span>
                      `}
                      </span>
                    </div>
                  </div>
                  <div style="text-align: right; min-width: 140px;">
                    <span style="font-weight: 700; font-size: 14px; color: ${isShortage ? '#dc2626' : '#059669'};">${p.stockCapacity !== null ? `${p.stockCapacity} unidades` : '—'}</span>
                    <div style="font-size: 11px; color: var(--text-muted);">Capacidade Máxima</div>
                  </div>
                  <div class="actions">
                    <button class="action-btn" data-action="view-intelligence" data-id="${p.id}">💡 Inteligência</button>
                  </div>
                </div>
              `;
            }).join('')}
      </div>
    </div>
  `;

  // Bind Actions
  container.querySelectorAll('[data-action="view-intelligence"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof options.openIntelligenceDrawer === 'function') {
        options.openIntelligenceDrawer(btn.dataset.id);
      }
    });
  });
}

/**
 * Abre o Drawer com Raio-X Completo de Inteligência do Produto
 */
export function openProductIntelligenceDrawer(productId, openDrawerFn, closeDrawerFn) {
  const analysis = calculateProductIntelligence({
    period: INTELLIGENCE_PERIODS.DIAS_90
  });

  const p = analysis.products.find(prod => prod.id === productId);
  if (!p) return;

  const contentHtml = `
    <div class="drawer-detail-section">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <span class="badge-count">Inteligência Comercial</span>
          <h2 style="font-size: 20px; font-weight: 700; margin: 8px 0 4px 0;">${escapeHtml(p.name)}</h2>
          <div style="font-size: 12px; color: var(--text-muted);">
            Preço de Tabela: <b>${formatCurrency(p.price)}</b> · Custo Base: <b>${formatCurrency(p.catalogCost)}</b>
          </div>
        </div>
        <div style="text-align: right;">
          <span class="status-pill ${p.margin >= 50 ? 'status-green' : p.margin < 25 ? 'status-orange' : 'status-blue'}" style="font-size: 12px;">
            ${p.margin.toFixed(1)}% Margem Real
          </span>
        </div>
      </div>
    </div>

    <!-- Grid de Métricas de Performance -->
    <div class="drawer-detail-section">
      <h4 class="drawer-subtitle">Desempenho Comercial (Últimos 90 dias)</h4>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Quantidade Vendida</span>
          <span class="detail-val"><b>${p.qty} un</b></span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Pedidos Computados</span>
          <span class="detail-val">${p.orderCount} pedidos</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Faturamento Total</span>
          <span class="detail-val"><b>${formatCurrency(p.revenue)}</b></span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Lucro Líquido Apurado</span>
          <span class="detail-val" style="color: #059669; font-weight: 700;">${formatCurrency(p.profit)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Comparativo com Período Anterior</span>
          <span class="detail-val">${p.comparisonLabel}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Preço Médio Praticado</span>
          <span class="detail-val">${formatCurrency(p.avgPrice)}</span>
        </div>
      </div>
    </div>

    <!-- Conexão com Estoque e Capacidade -->
    <div class="drawer-detail-section" style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px;">
      <h4 class="drawer-subtitle" style="margin-top: 0; color: var(--accent-primary);">📦 Capacidade Produtiva & Estoque</h4>
      <div style="font-size: 13px; margin-bottom: 8px;">
        Capacidade Imediata com Estoque: <b>${p.stockCapacity !== null ? `${p.stockCapacity} unidades` : 'Sem Ficha Técnica cadastrada'}</b>
      </div>
      ${p.bottleneck ? `
        <div style="background: #fee2e2; color: #991b1b; padding: 8px 10px; border-radius: 6px; font-size: 12px;">
          <b>⚠ Insumo Limitante:</b> ${escapeHtml(p.bottleneck.materialName)}<br>
          <span style="font-size: 11px;">Estoque Físico: ${p.bottleneck.stockAvailable} ${p.bottleneck.unit} (necessário ${p.bottleneck.requiredPerUnit} ${p.bottleneck.unit}/un).</span>
        </div>
      ` : `
        <div style="color: #059669; font-size: 12px; font-weight: 600;">
          ✓ Todos os insumos da composição possuem estoque suficiente.
        </div>
      `}
    </div>

    <!-- Diagnóstico e Conselhos Operacionais -->
    <div class="drawer-detail-section">
      <h4 class="drawer-subtitle">Diagnóstico Determinístico do PAPER MAX</h4>
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; font-size: 13px; line-height: 1.5;">
        <p style="margin: 0 0 6px 0; font-weight: 600; color: var(--text-primary);">
          ${escapeHtml(p.diagnostic.summary)}
        </p>
        <p style="margin: 0; font-size: 12px; color: var(--text-secondary);">
          ${escapeHtml(p.diagnostic.actionAdvice || 'Manter monitoramento contínuo das vendas.')}
        </p>
      </div>
    </div>
  `;

  const footerHtml = `
    <button class="btn btn-primary" id="btn-close-intel-drawer">Fechar</button>
  `;

  openDrawerFn({
    title: `Inteligência Comercial · ${p.name}`,
    contentHtml,
    footerHtml,
    onMount: (drawer) => {
      drawer.querySelector('#btn-close-intel-drawer').addEventListener('click', closeDrawerFn);
    }
  });
}

/**
 * Renderiza a Vitrine Comercial Completa (Vitrine Profissional do Ateliê)
 */
export function renderCommercialVitrine(container, products, categories, options = {}) {
  const catMap = new Map(categories.map(c => [c.id, c.name]));
  const { onOrder, onPreview, onBulk, onIntel } = options;

  // Filtra apenas produtos ativos
  const activeProducts = products.filter(p => p.status !== 'inativo' && p.active !== false);

  // Calcula inteligência comercial para enriquecer a vitrine
  let intelMap = new Map();
  try {
    const intel = calculateProductIntelligence({ period: INTELLIGENCE_PERIODS.DIAS_30 });
    intel.products.forEach(r => intelMap.set(r.id, r));
  } catch (err) {
    // Fallback seguro
  }

  if (activeProducts.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 48px 24px; background: var(--bg-surface); border: 1px dashed var(--border-subtle); border-radius: 12px; margin-top: 16px;">
        <div style="font-size: 36px; margin-bottom: 8px;">🛍️</div>
        <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0 0 4px 0;">Vitrine Vazia no Momento</h3>
        <p style="font-size: 13px; color: var(--text-secondary); max-width: 480px; margin: 0 auto 16px auto;">
          Não há produtos ativos no catálogo público. Cadastre novos produtos ou reative produtos existentes para exibi-los aqui.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="vitrine-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; margin-top: 14px;">
      ${activeProducts.map(p => {
        const catName = catMap.get(p.categoryId) || 'Geral';
        const rData = intelMap.get(p.id);
        const price = Number(p.price) || 0;
        const priceFrom = Number(p.priceFrom) || price;
        const hasDiscount = priceFrom > price;
        
        // Badges inteligentes
        let topBadge = null;
        if (rData?.rankingPosition === 1 || rData?.orderCount >= 10) {
          topBadge = '<span class="diag-badge diag-growth" style="font-size: 10px; padding: 2px 7px;">🏆 Mais Vendido</span>';
        } else if (rData?.margin >= 55) {
          topBadge = '<span class="diag-badge diag-profit" style="font-size: 10px; padding: 2px 7px;">💎 Alta Margem</span>';
        } else if (rData?.growthQtyPct > 20) {
          topBadge = '<span class="diag-badge diag-growth" style="font-size: 10px; padding: 2px 7px;">📈 Em Alta</span>';
        }

        // Informações de fotos / mockups
        const mockups = p.mockups || {};
        const mainPhoto = mockups.front || p.imageUrl || p.image || p.photo || '';
        const hasMultipleAngles = Boolean(mockups.angle || mockups.back);

        // Contagem de regras de personalização
        const editableCount = (p.personalizationFields || []).length;
        const optionsCount = (p.changeOptions || []).length;
        const reqFieldsCount = (p.personalizationFields || []).filter(f => f.required).length;

        // Capacidade
        const stockCap = rData?.stockCapacity !== null && rData?.stockCapacity !== undefined ? rData.stockCapacity : null;

        return `
          <div class="vitrine-card" style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04); transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease; position: relative; cursor: pointer;" data-product-card-id="${p.id}" data-action="view-product-card" data-id="${p.id}" title="Clique para abrir consulta completa deste produto">
            
            <!-- Topo do Card: Foto & Badges -->
            <div>
              <div style="position: relative; height: 160px; background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; cursor: pointer;" data-action="preview-product" data-id="${p.id}">
                ${mainPhoto ? `
                  <img src="${escapeHtml(mainPhoto)}" alt="${escapeHtml(p.name)}" style="max-height: 100%; max-width: 100%; object-fit: contain; padding: 6px;" />
                ` : `
                  <div style="text-align: center; color: var(--text-muted);">
                    <div style="font-size: 38px; margin-bottom: 4px;">🛍️</div>
                    <span style="font-size: 11px; font-weight: 600;">PAPER MAX 3D Mockup</span>
                  </div>
                `}

                <!-- Tags Superiores -->
                <div style="position: absolute; top: 8px; left: 8px; display: flex; gap: 4px; flex-wrap: wrap;">
                  <span class="badge-count" style="background: rgba(255, 255, 255, 0.92); color: var(--text-primary); backdrop-filter: blur(4px); font-size: 10px; font-weight: 700; border: 1px solid rgba(0,0,0,0.06);">${escapeHtml(catName)}</span>
                  ${p.isKit ? `
                    <span class="badge-count" style="background: #16a34a; color: #ffffff; font-size: 10px; font-weight: 800; border: 1px solid #15803d; box-shadow: 0 1px 3px rgba(0,0,0,0.12);">
                      📦 KIT ${(p.kitTiers && p.kitTiers.length > 0) ? `(${p.kitTiers.map(t => t.quantity + ' un').join(', ')})` : ''}
                    </span>
                  ` : ''}
                </div>

                <div style="position: absolute; top: 8px; right: 8px; display: flex; gap: 4px;">
                  ${topBadge || ''}
                </div>

                <!-- Indicador de Ângulos 3D -->
                <div style="position: absolute; bottom: 6px; right: 8px; background: rgba(15, 23, 42, 0.75); color: #ffffff; font-size: 9.5px; font-weight: 600; padding: 2px 6px; border-radius: 4px; backdrop-filter: blur(4px); display: flex; align-items: center; gap: 4px;">
                  <span>📐 3 Posições</span>
                </div>
              </div>

              <!-- Identificação do Produto -->
              <div style="cursor: pointer;" data-action="preview-product" data-id="${p.id}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 4px;">
                  <h3 class="vitrine-title" style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1.3;">
                    ${escapeHtml(p.name)}
                  </h3>
                </div>

                <p class="vitrine-desc" style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin: 0 0 10px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 34px;">
                  ${escapeHtml(p.description || 'Produto personalizado com acabamento profissional e molde inteligente.')}
                </p>
              </div>

              <!-- Tags de Personalização & Disponibilidade -->
              <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
                <span class="badge-count" style="font-size: 10px; background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0;">
                  ⏱ ${p.productionTime || 1} dias úteis
                </span>
                ${p.isKit ? `
                  <span class="badge-count" style="font-size: 10px; background: #dcfce7; color: #15803d; border: 1px solid #86efac; font-weight: 700;" title="Vendido em pacotes de quantidades fechadas">
                    📦 Kit (${(p.kitTiers || []).length} opções de lotes)
                  </span>
                ` : ''}
                ${editableCount > 0 ? `
                  <span class="badge-count" style="font-size: 10px; background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe;" title="${reqFieldsCount} campo(s) obrigatório(s)">
                    ✏️ ${editableCount} campo(s) texto
                  </span>
                ` : ''}
                ${optionsCount > 0 ? `
                  <span class="badge-count" style="font-size: 10px; background: #fef3c7; color: #92400e; border: 1px solid #fde68a;">
                    🎨 ${optionsCount} opções/cores
                  </span>
                ` : ''}
                ${stockCap !== null ? `
                  <span class="badge-count" style="font-size: 10px; background: ${stockCap > 0 ? '#f1f5f9' : '#fee2e2'}; color: ${stockCap > 0 ? '#475569' : '#991b1b'};">
                    📦 ${stockCap > 0 ? `${stockCap} un disp.` : 'Esgotado'}
                  </span>
                ` : ''}
              </div>
            </div>

            <!-- Rodapé com Preço e Ações Comerciais -->
            <div style="border-top: 1px solid var(--border-subtle); padding-top: 10px; margin-top: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
                <div>
                  <span style="font-size: 10px; text-transform: uppercase; color: var(--text-muted); font-weight: 600; display: block;">
                    ${p.isKit ? 'Valor do Kit (a partir de)' : 'Preço Unitário'}
                  </span>
                  <div style="display: flex; align-items: baseline; gap: 6px;">
                    <span style="font-size: 18px; font-weight: 800; color: #059669;">${formatCurrency(price)}</span>
                    ${hasDiscount ? `<span style="font-size: 12px; color: var(--text-muted); text-decoration: line-through;">${formatCurrency(priceFrom)}</span>` : ''}
                  </div>
                </div>
                <div style="text-align: right;">
                  <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">v${p.configurationVersion || 1}</span>
                </div>
              </div>

              <!-- Botões de Ação Comercial -->
              <div style="display: grid; grid-template-columns: 2fr 1fr auto; gap: 6px;">
                <button type="button" class="btn btn-primary" data-action="order-from-vitrine" data-id="${p.id}" style="font-weight: 700; font-size: 12px; padding: 8px 10px; white-space: nowrap;">
                  + Criar Pedido
                </button>
                <button type="button" class="btn btn-secondary" data-action="preview-product" data-id="${p.id}" title="Visualizar Detalhes e Personalização" style="font-weight: 600; font-size: 11.5px; padding: 8px 8px; white-space: nowrap;">
                  🔍 Consultar
                </button>
                <button type="button" class="btn btn-secondary" data-action="bulk-from-vitrine" data-id="${p.id}" title="Personalização em Lote / Massa" style="font-weight: 600; font-size: 12px; padding: 8px 10px;">
                  ⚡
                </button>
              </div>
            </div>

          </div>
        `;
      }).join('')}
    </div>
  `;

  // Bind Clicks
  // 1. Click directly on the entire card immediately opens consultation drawer
  container.querySelectorAll('.vitrine-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Prevent opening drawer if an interactive child button was clicked
      if (e.target.closest('button') || e.target.closest('.btn') || e.target.closest('a')) {
        return;
      }
      const prodId = card.dataset.productCardId || card.dataset.id;
      if (typeof onPreview === 'function' && prodId) {
        onPreview(prodId);
      }
    });
  });

  container.querySelectorAll('[data-action="order-from-vitrine"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof onOrder === 'function') {
        onOrder(btn.dataset.id);
      }
    });
  });

  container.querySelectorAll('[data-action="preview-product"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof onPreview === 'function') {
        onPreview(el.dataset.id);
      }
    });
  });

  container.querySelectorAll('[data-action="bulk-from-vitrine"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof onBulk === 'function') {
        onBulk(btn.dataset.id);
      }
    });
  });
}

/**
 * Abre o Drawer de Preview Comercial & Consulta Profissional do Produto
 * Estrutura:
 * - Área de Fotos em 3 Posições (Frente, Frente/Lateral, Verso) com destaque visual
 * - Informações completas do produto (preço, descrição, prazo, categoria)
 * - Separação clara: EDITÁVEL (Textos/Nomes) vs PERSONALIZÁVEL (Cores/Acabamentos/Alças)
 * - Histórico de alterações & versões de molde
 * - Botão direto de conversão: "+ Criar Pedido com este Produto" (com pré-preenchimento)
 */
export function openProductCommercialPreviewDrawer({
  productId,
  openDrawerFn,
  closeDrawerFn,
  onOrderCreate,
  onEditProduct
}) {
  const p = getProductById(productId);
  if (!p) return;

  const categories = getCategories();
  const cat = categories.find(c => c.id === p.categoryId);
  const price = Number(p.price) || 0;
  const priceFrom = Number(p.priceFrom) || price;
  const cost = Number(p.cost) || 0;
  const profit = Math.max(0, price - cost);
  const marginPct = price > 0 ? ((profit / price) * 100).toFixed(0) : 0;
  const history = p.priceHistory || [{ price: price, date: formatDateBR(new Date().toISOString()) }];

  let currentAngle = 'front';
  const mockups = p.mockups || {
    front: p.imageUrl || p.image || p.photo || '',
    angle: '',
    back: ''
  };

  // State local de teste de personalização
  const sandboxPers = {};
  (p.personalizationFields || []).forEach(f => {
    sandboxPers[f.id] = f.defaultValue || '';
  });

  const sandboxOpts = {};
  (p.changeOptions || []).forEach(opt => {
    const choices = opt.choices || opt.options || [];
    sandboxOpts[opt.id] = opt.defaultValue || (choices.length > 0 ? choices[0] : '');
  });

  function getMockupViewerHtml(angle) {
    const angleLabels = { front: 'Frente', angle: 'Frente / Lateral', back: 'Verso' };
    const photo = mockups[angle] || (angle === 'front' ? (p.imageUrl || p.image || p.photo) : '');

    return `
      <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 10px; padding: 14px; margin-bottom: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 12px; font-weight: 700; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.04em;">
            📐 Visualização 3D do Produto (${angleLabels[angle]})
          </span>
          <span class="badge-count" style="font-size: 10px; background: #e0e7ff; color: #4338ca; font-weight: 700;">
            Posição: ${angleLabels[angle]}
          </span>
        </div>

        <!-- Seletor das 3 Posições -->
        <div class="btn-group" style="display: flex; gap: 6px; margin-bottom: 12px;">
          <button type="button" class="btn btn-sm ${angle === 'front' ? 'btn-primary' : ''}" data-view-angle="front" style="flex: 1; font-size: 11.5px; font-weight: 600;">
            1. Frente
          </button>
          <button type="button" class="btn btn-sm ${angle === 'angle' ? 'btn-primary' : ''}" data-view-angle="angle" style="flex: 1; font-size: 11.5px; font-weight: 600;">
            2. Frente / Lateral
          </button>
          <button type="button" class="btn btn-sm ${angle === 'back' ? 'btn-primary' : ''}" data-view-angle="back" style="flex: 1; font-size: 11.5px; font-weight: 600;">
            3. Verso
          </button>
        </div>

        <!-- Moldura da Foto em Destaque Visual -->
        <div style="height: 200px; background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative;">
          ${photo ? `
            <img src="${escapeHtml(photo)}" alt="${escapeHtml(p.name)} - ${angleLabels[angle]}" style="max-height: 100%; max-width: 100%; object-fit: contain; padding: 8px;" />
          ` : `
            <div style="text-align: center; color: var(--text-muted); padding: 16px;">
              <div style="font-size: 42px; margin-bottom: 4px;">${angle === 'front' ? '🛍️' : angle === 'angle' ? '📦' : '✨'}</div>
              <div style="font-size: 12px; font-weight: 700; color: var(--text-primary);">Preview de Molde: ${angleLabels[angle]}</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Foto não anexada para este ângulo.</div>
            </div>
          `}
        </div>
      </div>
    `;
  }

  function getCommercialDrawerHtml() {
    const editableFields = p.personalizationFields || [];
    const customizableOptions = p.changeOptions || [];

    return `
      <!-- Galeria 3 Posições -->
      <div id="commercial-preview-mockup-wrapper">
        ${getMockupViewerHtml(currentAngle)}
      </div>

      <!-- Informações Comerciais Principais -->
      <div class="drawer-detail-section" style="padding-top: 0;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
          <span class="badge-count" style="background: #e0e7ff; color: #4338ca; font-weight: 700;">${cat ? escapeHtml(cat.name) : 'Geral'}</span>
          ${p.subcategoryId ? `<span class="badge-count" style="background: #f1f5f9; color: #475569;">${escapeHtml(p.subcategoryId)}</span>` : ''}
          <span class="badge-count" style="background: ${p.status === 'ativo' ? '#dcfce7' : '#f1f5f9'}; color: ${p.status === 'ativo' ? '#15803d' : '#64748b'};">
            ${p.status === 'ativo' ? '✓ Ativo no Catálogo' : 'Oculto'}
          </span>
        </div>

        <h2 style="font-size: 20px; font-weight: 800; color: var(--text-primary); margin: 4px 0 6px 0;">${escapeHtml(p.name)}</h2>
        
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.5;">
          ${escapeHtml(p.description || 'Produto personalizado com acabamento profissional e molde inteligente configurado.')}
        </p>

        <!-- Grid de Métricas Comerciais -->
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Preço de Venda</span>
            <span class="detail-val"><b style="color: #059669; font-size: 16px;">${formatCurrency(price)}</b></span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Preço Sugerido (De)</span>
            <span class="detail-val" style="text-decoration: ${priceFrom > price ? 'line-through' : 'none'}; color: var(--text-muted);">${formatCurrency(priceFrom)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Prazo de Produção</span>
            <span class="detail-val"><b>⏱ ${p.productionTime || 1} dias úteis</b></span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Margem Base Estimada</span>
            <span class="detail-val"><b style="color: #059669;">${marginPct}% (${formatCurrency(profit)})</b></span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Versão do Molde</span>
            <span class="detail-val">v${p.configurationVersion || 1} (Ficha Técnica)</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Gabarito Base</span>
            <span class="detail-val">${p.basePdfMetadata ? escapeHtml(p.basePdfMetadata.name) : 'Gabarito Padrão'}</span>
          </div>
        </div>

        ${p.isKit ? `
          <!-- Tabela de Pacotes do Kit -->
          <div style="margin-top: 14px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
              <span style="font-weight: 700; font-size: 13px; color: #166534; display: flex; align-items: center; gap: 6px;">
                <span>📦 Pacotes e Opções de Quantidades do Kit</span>
                <span class="badge-count" style="background: #22c55e; color: #ffffff; font-size: 10px; font-weight: 700;">PRODUTO EM KIT</span>
              </span>
              <span style="font-size: 11px; color: #15803d; font-weight: 600;">
                Mínimo: ${p.kitMinQuantity || 10} unidades
              </span>
            </div>
            <div style="font-size: 11.5px; color: #166534; margin-bottom: 10px;">
              Este produto é vendido em múltiplos e pacotes fechados. Selecione o lote desejado ao emitir pedidos ou orçamentos.
            </div>

            <div style="background: #ffffff; border: 1px solid #bbf7d0; border-radius: 6px; overflow: hidden;">
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                  <tr style="background: #e8f5e9; border-bottom: 1px solid #c8e6c9; text-align: left;">
                    <th style="padding: 6px 10px; color: #1b5e20; font-weight: 700;">Pacote</th>
                    <th style="padding: 6px 10px; color: #1b5e20; font-weight: 700; text-align: center;">Qtd</th>
                    <th style="padding: 6px 10px; color: #1b5e20; font-weight: 700; text-align: right;">Preço do Kit</th>
                    <th style="padding: 6px 10px; color: #1b5e20; font-weight: 700; text-align: right;">Valor Unitário</th>
                    <th style="padding: 6px 10px; color: #1b5e20; font-weight: 700; text-align: center;">Status</th>
                    <th style="padding: 6px 10px; color: #1b5e20; font-weight: 700; text-align: center;">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  ${(p.kitTiers || []).map(tier => `
                    <tr style="border-bottom: 1px solid #f1f5f9; background: ${tier.isDefault ? '#f0fdf4' : 'transparent'};">
                      <td style="padding: 6px 10px; font-weight: 700; color: var(--text-primary);">
                        ${escapeHtml(tier.name || (tier.quantity + ' unidades'))}
                      </td>
                      <td style="padding: 6px 10px; text-align: center; color: var(--text-secondary); font-weight: 600;">
                        ${tier.quantity} un
                      </td>
                      <td style="padding: 6px 10px; text-align: right; font-weight: 700; color: #15803d; font-size: 13px;">
                        ${formatCurrency(tier.price)}
                      </td>
                      <td style="padding: 6px 10px; text-align: right; color: var(--text-secondary);">
                        ${formatCurrency(tier.price / (tier.quantity || 1))}/un
                      </td>
                      <td style="padding: 6px 10px; text-align: center;">
                        ${tier.isDefault ? '<span class="badge-count" style="background: #22c55e; color: #ffffff; font-size: 9px; font-weight: 700;">★ PADRÃO</span>' : '<span style="color: var(--text-muted); font-size: 10px;">Opção</span>'}
                      </td>
                      <td style="padding: 6px 10px; text-align: center;">
                        <button type="button" class="btn btn-sm btn-primary" data-action="order-kit-tier" data-tier-qty="${tier.quantity}" data-tier-price="${tier.price}" style="font-size: 11px; padding: 3px 8px; font-weight: 700; white-space: nowrap;">
                          + Pedir ${tier.quantity} un
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- SEÇÃO 1: EDITÁVEL (Textos, Nomes, Idades e Datas) -->
      <div class="drawer-detail-section" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div>
            <span class="badge-count" style="background: #e0e7ff; color: #3730a3; font-weight: 700; font-size: 10px;">
              ✏️ EDITÁVEL: TEXTOS & INFORMAÇÕES
            </span>
          </div>
          <span style="font-size: 11px; color: var(--text-muted);">
            ${editableFields.length} campo(s) configurado(s)
          </span>
        </div>

        ${editableFields.length === 0 ? `
          <div style="font-size: 12px; color: var(--text-muted); font-style: italic;">
            Este produto não exige campos de texto editáveis.
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${editableFields.map(f => {
              const req = f.required ? '<span style="color: #dc2626; font-weight: 700;">*</span>' : '<span style="color: var(--text-muted); font-size: 10px;">(Opcional)</span>';
              return `
                <div>
                  <label class="form-label" style="font-size: 11.5px; font-weight: 600; margin-bottom: 3px; display: flex; justify-content: space-between;">
                    <span>${escapeHtml(f.name)} ${req}</span>
                    <span style="font-size: 10px; color: var(--text-muted);">Tipo: ${f.type || 'text'}</span>
                  </label>
                  <input type="text" class="form-input sandbox-pers-input" data-field-id="${f.id}" value="${escapeHtml(sandboxPers[f.id] || '')}" placeholder="Exemplo de ${escapeHtml(f.name)}..." style="font-size: 12px; background: #ffffff;">
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- SEÇÃO 2: PERSONALIZÁVEL (Cores, Acabamentos, Alças, Elementos) -->
      <div class="drawer-detail-section" style="background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 14px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div>
            <span class="badge-count" style="background: #fef08a; color: #854d0e; font-weight: 700; font-size: 10px;">
              🎨 PERSONALIZÁVEL: CORES & ACABAMENTOS
            </span>
          </div>
          <span style="font-size: 11px; color: var(--text-muted);">
            ${customizableOptions.length} opção(ões) de variação
          </span>
        </div>

        ${customizableOptions.length === 0 ? `
          <div style="font-size: 12px; color: var(--text-muted); font-style: italic;">
            Este produto utiliza acabamento padrão sem opções adicionais.
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${customizableOptions.map(opt => {
              const choices = opt.choices || opt.options || [];
              const req = opt.required ? '<span style="color: #dc2626; font-weight: 700;">*</span>' : '';
              return `
                <div>
                  <label class="form-label" style="font-size: 11.5px; font-weight: 600; margin-bottom: 3px; display: flex; justify-content: space-between;">
                    <span>${escapeHtml(opt.name)} ${req}</span>
                    <span style="font-size: 10px; color: var(--text-muted);">${choices.length} opções disponíveis</span>
                  </label>
                  <select class="form-input sandbox-opt-select" data-opt-id="${opt.id}" style="font-size: 12px; background: #ffffff;">
                    ${choices.map(c => `
                      <option value="${escapeHtml(c)}" ${sandboxOpts[opt.id] === c ? 'selected' : ''}>${escapeHtml(c)}</option>
                    `).join('')}
                  </select>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- SEÇÃO 3: HISTÓRICO DE SOLICITAÇÕES / ALTERAÇÕES -->
      <div class="drawer-detail-section">
        <h4 class="drawer-subtitle">Histórico de Alterações & Versões do Molde</h4>
        <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 10px 12px; font-size: 11.5px; display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border-subtle); padding-bottom: 4px;">
            <span><b>Versão Atual do Molde:</b> v${p.configurationVersion || 1}</span>
            <span style="color: var(--text-muted);">Atualizado em ${formatDateBR(p.updatedAt || p.createdAt)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span><b>Tabela de Preço Vigente:</b> ${formatCurrency(price)}</span>
            <span style="color: #059669; font-weight: 600;">Ativo</span>
          </div>
          ${history.slice(-3).map((h, i) => `
            <div style="display: flex; justify-content: space-between; align-items: center; color: var(--text-secondary); font-size: 11px;">
              <span>• Histórico de Tabela: R$ ${Number(h.price || 0).toFixed(2).replace('.', ',')}</span>
              <span>${escapeHtml(h.date || '')}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  const footerHtml = `
    <button type="button" class="btn" id="btn-edit-prod-from-preview" style="font-weight: 600;">
      ⚙ Editar Produto
    </button>
    <button type="button" class="btn btn-primary" id="btn-create-order-from-preview" style="font-weight: 700; flex: 1;">
      + Criar Pedido com este Produto ➔
    </button>
  `;

  openDrawerFn({
    title: `Preview do Produto · ${p.name}`,
    contentHtml: `<div id="commercial-preview-body">${getCommercialDrawerHtml()}</div>`,
    footerHtml,
    onMount: (drawer) => {
      const bindAngleButtons = () => {
        drawer.querySelectorAll('[data-view-angle]').forEach(btn => {
          btn.addEventListener('click', () => {
            currentAngle = btn.dataset.viewAngle;
            const container = drawer.querySelector('#commercial-preview-mockup-wrapper');
            if (container) {
              container.innerHTML = getMockupViewerHtml(currentAngle);
              bindAngleButtons();
            }
          });
        });
      };
      bindAngleButtons();

      // Monitor sandbox inputs
      drawer.querySelectorAll('.sandbox-pers-input').forEach(inp => {
        inp.addEventListener('input', e => {
          sandboxPers[e.target.dataset.fieldId] = e.target.value;
        });
      });

      drawer.querySelectorAll('.sandbox-opt-select').forEach(sel => {
        sel.addEventListener('change', e => {
          sandboxOpts[e.target.dataset.optId] = e.target.value;
        });
      });

      // Actions
      drawer.querySelectorAll('[data-action="order-kit-tier"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tierQty = Number(btn.dataset.tierQty) || 1;
          const tierPrice = Number(btn.dataset.tierPrice) || price;
          closeDrawerFn();
          if (typeof onOrderCreate === 'function') {
            onOrderCreate({
              productId: p.id,
              qty: tierQty,
              isKit: true,
              kitTierQuantity: tierQty,
              kitTierPrice: tierPrice,
              unitPrice: tierPrice / tierQty,
              price: tierPrice,
              personalization: sandboxPers,
              changeOptions: sandboxOpts
            });
          }
        });
      });

      drawer.querySelector('#btn-edit-prod-from-preview').addEventListener('click', () => {
        closeDrawerFn();
        if (typeof onEditProduct === 'function') {
          onEditProduct(p.id);
        }
      });

      drawer.querySelector('#btn-create-order-from-preview').addEventListener('click', () => {
        closeDrawerFn();
        if (typeof onOrderCreate === 'function') {
          onOrderCreate({
            productId: p.id,
            personalization: sandboxPers,
            changeOptions: sandboxOpts
          });
        }
      });
    }
  });
}

