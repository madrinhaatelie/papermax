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
          <span class="card-subtext">Cálculo determinístico com base nos pedidos reais, custos BOM e imutabilidade dos snapshots</span>
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

              let stockCapHtml = '<span style="color: var(--text-muted); font-size: 11px;">Sem BOM</span>';
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
        <p class="module-subtitle">Diagnósticos explicáveis derivados dos pedidos reais, variações de volume e margens calculadas.</p>
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
          <span class="card-subtext">Datas comemorativas chave mapeadas com base no comportamento dos pedidos</span>
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
        <p class="module-subtitle">Capacidade produtiva máxima com base no estoque disponível e identificação antecipada de gargalos de insumos.</p>
      </div>
    </div>

    <div class="panel" style="margin-top: 12px; padding: 0;">
      <div class="list-group" style="display: flex; flex-direction: column; gap: 8px;">
            ${prodsWithBom.length === 0 ? `
              <div style="text-align: center; padding: 32px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; color: var(--text-secondary);">
                  Nenhum produto com Composição Técnica (BOM) configurada. Cadastre a ficha técnica nos produtos para ativar a inteligência de capacidade.
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
        Capacidade Imediata com Estoque: <b>${p.stockCapacity !== null ? `${p.stockCapacity} unidades` : 'Sem BOM cadastrada'}</b>
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
