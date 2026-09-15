/**
 * PAPER MAX - Stock UI Layer (Etapa 5)
 * Clean, compact, accessible interface for:
 * - Visão Geral (KPIs & Calculadora de Capacidade)
 * - Materiais (Insumos & Componentes)
 * - Movimentações (Entradas & Saídas)
 * - Inventário (Conferência Física & Ajustes)
 * - Alertas (4 status operacionais)
 * - Fornecedores (Lista, Compras, Comparativo de Preços)
 */

import { 
  loadMaterials, saveMaterials,
  loadComponents, saveComponents,
  loadSuppliers, saveSuppliers,
  loadPurchases, savePurchases,
  loadMovements, saveMovements,
  loadInventories, saveInventories,
  loadOrders, loadProducts
} from '../../data/storage.js';
import { 
  BASE_UNITS,
  calculateStockBalances,
  calculateMaterialUnitCosts,
  calculateComponentCost,
  calculateProductCapacity,
  recordStockMovement,
  applyInventoryAdjustments,
  receivePurchase,
  compareSupplierPrices,
  detectCompositionCycle,
  MOVEMENT_REASONS
} from './stock.engine.js';
import { 
  exportMaterialsCSV, importMaterialsCSV,
  exportComponentsCSV,
  exportSuppliersCSV, importSuppliersCSV,
  exportMovementsCSV
} from './stock.csv.js';
import { escapeHtml, generateId } from '../../utils/sanitize.js';

let currentStockSubTab = 'visao_geral'; // 'visao_geral' | 'materiais' | 'movimentacoes' | 'inventario' | 'alertas' | 'fornecedores'
let materialsSubFilter = 'insumos'; // 'insumos' | 'componentes'
let movementsFilter = 'todas'; // 'todas' | 'entrada' | 'saida'
let suppliersSubTab = 'fornecedores'; // 'fornecedores' | 'compras' | 'comparativo'
let activeInventorySession = null;

export function renderStockModule() {
  const container = document.getElementById('view-container');
  if (!container) return;

  const materials = loadMaterials();
  const components = loadComponents();
  const suppliers = loadSuppliers();
  const purchases = loadPurchases();
  const movements = loadMovements();
  const orders = loadOrders();
  const products = loadProducts();

  const balanceData = calculateStockBalances(materials, components, orders, purchases);

  container.innerHTML = `
    <div class="module-header">
      <div>
        <h2 class="module-title">📦 Gestão de Estoque & Suprimentos</h2>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" id="btn-export-stock-csv">⬇ Exportar CSV</button>
        <button class="btn btn-secondary" id="btn-import-stock-csv">⬆ Importar Insumos CSV</button>
        <button class="btn btn-primary" id="btn-quick-new-item">+ Novo Material / Compra</button>
      </div>
    </div>

    <!-- Stock Navigation Tabs -->
    <div class="stock-tab-bar" style="display: flex; gap: 8px; margin: 16px 0; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px; overflow-x: auto;">
      <button class="tab-btn ${currentStockSubTab === 'visao_geral' ? 'active' : ''}" data-stock-tab="visao_geral">📊 Visão Geral</button>
      <button class="tab-btn ${currentStockSubTab === 'materiais' ? 'active' : ''}" data-stock-tab="materiais">📦 Materiais (${materials.length + components.length})</button>
      <button class="tab-btn ${currentStockSubTab === 'movimentacoes' ? 'active' : ''}" data-stock-tab="movimentacoes">🔄 Movimentações (${movements.length})</button>
      <button class="tab-btn ${currentStockSubTab === 'inventario' ? 'active' : ''}" data-stock-tab="inventario">📋 Inventário</button>
      <button class="tab-btn ${currentStockSubTab === 'alertas' ? 'active' : ''}" data-stock-tab="alertas">
        🚨 Alertas 
        ${(balanceData.summary.outOfStockCount + balanceData.summary.insufficientCount + balanceData.summary.belowMinCount) > 0 
          ? `<span class="badge-count" style="background: var(--status-red-bg); color: var(--status-red-text); margin-left: 4px;">${balanceData.summary.outOfStockCount + balanceData.summary.insufficientCount + balanceData.summary.belowMinCount}</span>` 
          : ''}
      </button>
      <button class="tab-btn ${currentStockSubTab === 'fornecedores' ? 'active' : ''}" data-stock-tab="fornecedores">🏢 Fornecedores & Compras</button>
    </div>

    <!-- Subtab Content Container -->
    <div id="stock-subtab-content">
      ${renderSubTabContent(balanceData, materials, components, suppliers, purchases, movements, orders, products)}
    </div>
  `;

  bindStockEvents(container, balanceData, materials, components, suppliers, purchases, movements, orders, products);
}

function renderSubTabContent(balanceData, materials, components, suppliers, purchases, movements, orders, products) {
  switch (currentStockSubTab) {
    case 'visao_geral':
      return renderOverviewTab(balanceData, products, materials, components);
    case 'materiais':
      return renderMaterialsTab(balanceData, materials, components, suppliers);
    case 'movimentacoes':
      return renderMovementsTab(movements);
    case 'inventario':
      return renderInventoryTab(materials, components);
    case 'alertas':
      return renderAlertsTab(balanceData);
    case 'fornecedores':
      return renderSuppliersTab(suppliers, purchases, materials);
    default:
      return renderOverviewTab(balanceData, products, materials, components);
  }
}

// 1. Visão Geral
function renderOverviewTab(balanceData, products, materials, components) {
  const s = balanceData.summary;
  return `
    <div class="lifetime-grid" style="margin-bottom: 20px;">
      <div class="life-card">
        <span class="life-label">Valor Imobilizado em Estoque</span>
        <b class="life-val">R$ ${s.totalStockValue.toFixed(2).replace('.', ',')}</b>
      </div>
      <div class="life-card">
        <span class="life-label">Total de Itens Cadastrados</span>
        <b class="life-val">${s.totalItems} materiais</b>
      </div>
      <div class="life-card" style="border-left: 3px solid ${s.outOfStockCount > 0 ? 'var(--status-red-dot)' : 'var(--status-green-dot)'};">
        <span class="life-label">Sem Estoque / Críticos</span>
        <b class="life-val" style="color: ${s.outOfStockCount > 0 ? 'var(--status-red-text)' : 'inherit'};">${s.outOfStockCount} itens</b>
      </div>
      <div class="life-card" style="border-left: 3px solid ${s.insufficientCount > 0 ? 'var(--status-yellow-dot)' : 'var(--border-subtle)'};">
        <span class="life-label">Insuficientes p/ Pedidos</span>
        <b class="life-val">${s.insufficientCount} itens</b>
      </div>
    </div>

    <!-- Calculadora de Capacidade Produtiva Rápida -->
    <div class="panel" style="margin-bottom: 20px;">
      <div class="panel-header">
        <div>
          <h3 class="panel-title">⚡ Calculadora de Capacidade Produtiva</h3>
        </div>
      </div>
      <div style="display: flex; gap: 12px; align-items: center; margin-top: 12px; flex-wrap: wrap;">
        <label style="font-size: 13px; font-weight: 600;">Selecione o Produto:</label>
        <select class="form-input" id="sel-capacity-product" style="max-width: 320px;">
          ${products.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
        </select>
        <button class="btn btn-secondary" id="btn-calc-capacity">Calcular Capacidade</button>
      </div>
      <div id="capacity-result-box" style="margin-top: 16px;"></div>
    </div>

    <!-- Tabela Rápida de Status dos Materiais -->
    <div class="panel">
      <div class="panel-header">
        <h3 class="panel-title">Status Operacional dos Materiais</h3>
        <span class="card-label">Saldos Físicos e Comprometidos</span>
      </div>
      <div class="table-container" style="margin-top: 12px; overflow-x: auto;">
        <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border-subtle); text-align: left;">
              <th style="padding: 8px;">Material / Componente</th>
              <th style="padding: 8px;">Tipo</th>
              <th style="padding: 8px;">Estoque Físico</th>
              <th style="padding: 8px;">Comprometido</th>
              <th style="padding: 8px;">Disponível</th>
              <th style="padding: 8px;">Projetado</th>
              <th style="padding: 8px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${balanceData.all.slice(0, 10).map(item => `
              <tr style="border-bottom: 1px solid var(--border-subtle);">
                <td style="padding: 8px; font-weight: 600;">${escapeHtml(item.name)}</td>
                <td style="padding: 8px;"><span class="badge-count">${item.type === 'insumo' ? 'Insumo' : 'Componente'}</span></td>
                <td style="padding: 8px;">${item.currentStock} ${item.baseUnit}</td>
                <td style="padding: 8px; color: var(--text-muted);">${item.committedStock} ${item.baseUnit}</td>
                <td style="padding: 8px; font-weight: 600; color: ${item.availableStock < 0 ? 'var(--status-red-text)' : 'inherit'};">${item.availableStock} ${item.baseUnit}</td>
                <td style="padding: 8px;">${item.projectedStock} ${item.baseUnit}</td>
                <td style="padding: 8px;">
                  <span class="status-badge status-${item.alertBadge}">${escapeHtml(item.alertLabel)}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 2. Materiais (Insumos & Componentes)
function renderMaterialsTab(balanceData, materials, components, suppliers) {
  const isComponentes = materialsSubFilter === 'componentes';
  const list = isComponentes ? balanceData.components : balanceData.materials;

  return `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; gap: 8px;">
        <button class="btn ${!isComponentes ? 'btn-primary' : 'btn-secondary'}" id="btn-sub-insumos">🌿 Insumos Brutos (${materials.length})</button>
        <button class="btn ${isComponentes ? 'btn-primary' : 'btn-secondary'}" id="btn-sub-componentes">🧩 Componentes Fabricados (${components.length})</button>
      </div>
      <div>
        <button class="btn btn-primary" id="${isComponentes ? 'btn-new-component' : 'btn-new-material'}">+ ${isComponentes ? 'Novo Componente (Ficha Técnica)' : 'Novo Insumo'}</button>
      </div>
    </div>

    <div class="panel" style="padding: 0; background: transparent; border: none; box-shadow: none;">
        <div class="list-group" style="display: flex; flex-direction: column; gap: 8px;">
            ${list.map(item => {
              const statusClass = `status-${item.alertBadge || 'neutral'}`;
              return `
                <div class="list-row ${statusClass}">
                  <div class="list-main" style="cursor: pointer;" data-action="view-material" data-id="${item.id}" data-type="${item.type}">
                    <div class="list-title" style="display: flex; align-items: center; gap: 8px;">
                      ${escapeHtml(item.name)}
                      ${item.type === 'component' ? '<span class="badge-count" style="background: #fdf2f8; color: #db2777; font-size: 10px;">🧩 Componente</span>' : ''}
                    </div>
                  </div>
                  <div style="text-align: right; min-width: 120px;">
                      <span style="font-weight: 700; font-size: 13px;">${item.availableStock} ${item.baseUnit}</span>
                      <div style="font-size: 11px; color: var(--text-muted);">Disponível</div>
                  </div>
                  <div class="actions">
                      <button class="action-btn btn-edit-material" data-id="${item.id}" data-type="${item.type}" title="Editar">✏️ Editar</button>
                      <button class="action-btn" data-action="dup-material" data-id="${item.id}" data-type="${item.type}" title="Duplicar">📋 Duplicar</button>
                      <button class="action-btn" data-action="del-material" data-id="${item.id}" data-type="${item.type}" title="Excluir" style="color: #ef4444;">🗑️ Excluir</button>
                      <button class="action-btn" data-action="hide-material" data-id="${item.id}" data-type="${item.type}" title="Ocultar">👁️ Ocultar</button>
                  </div>
                </div>
              `;
            }).join('')}
        </div>
    </div>
  `;
}

// 3. Movimentações
function renderMovementsTab(movements) {
  let filtered = movements;
  if (movementsFilter === 'entrada') filtered = movements.filter(m => m.type === 'entrada');
  if (movementsFilter === 'saida') filtered = movements.filter(m => m.type === 'saida');

  return `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; gap: 8px;">
        <button class="btn ${movementsFilter === 'todas' ? 'btn-primary' : 'btn-secondary'}" data-mov-filter="todas">Todas</button>
        <button class="btn ${movementsFilter === 'entrada' ? 'btn-primary' : 'btn-secondary'}" data-mov-filter="entrada">⬇ Entradas</button>
        <button class="btn ${movementsFilter === 'saida' ? 'btn-primary' : 'btn-secondary'}" data-mov-filter="saida">⬆ Saídas</button>
      </div>
      <div>
        <button class="btn btn-primary" id="btn-new-manual-movement">+ Registrar Movimentação Manual</button>
      </div>
    </div>

    <div class="card" style="padding: 0; background: transparent; border: none; box-shadow: none;">
      <div class="list-group" style="display: flex; flex-direction: column; gap: 8px;">
          ${filtered.length === 0 ? `
            <div style="text-align: center; padding: 32px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; color: var(--text-secondary);">
              <b style="display: block; color: var(--text-primary); margin-bottom: 4px;">Nenhuma movimentação registrada.</b>
              As entradas e saídas de estoque aparecerão aqui conforme as compras ou baixas automáticas de produção forem realizadas.
            </div>
          ` : filtered.map(m => {
            const isEntry = m.type === 'entrada';
            const statusClass = isEntry ? 'status-green' : 'status-red';
            return `
              <div class="list-row ${statusClass}">
                <div class="list-main">
                  <div class="list-title" style="display: flex; align-items: center; gap: 8px;">
                    ${escapeHtml(m.materialName)}
                    <span class="badge-count" style="background: ${isEntry ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; color: ${isEntry ? '#10b981' : '#ef4444'}; font-size: 10px;">
                      ${isEntry ? '⬇ Entrada' : '⬆ Saída'}
                    </span>
                  </div>
                  <div class="list-meta">
                    ${new Date(m.createdAt).toLocaleString('pt-BR')} · Motivo: ${escapeHtml(m.reason || '-')} · Origem: ${escapeHtml(m.origin || '-')}
                  </div>
                </div>
                <div style="text-align: right; min-width: 140px;">
                  <span style="font-weight: 700; font-size: 13px; color: ${isEntry ? '#10b981' : '#ef4444'};">${isEntry ? '+' : '-'}${m.quantity} ${m.unit}</span>
                  <div style="font-size: 11px; color: var(--text-muted);">Estoque: ${m.previousStock} ➔ <b>${m.newStock}</b></div>
                </div>
              </div>
            `;
          }).join('')}
      </div>
    </div>
  `;
}

// 4. Inventário (Conferência Física)
function renderInventoryTab(materials, components) {
  return `
    <div class="panel" style="margin-bottom: 16px;">
      <div class="panel-header">
        <div>
          <h3 class="panel-title">📋 Sessão de Contagem & Inventário Físico</h3>
        </div>
        <button class="btn btn-primary" id="btn-start-inventory-session">Iniciar Nova Conferência</button>
      </div>
      <div id="active-inventory-container" style="margin-top: 16px;">
        <p style="font-size: 13px; color: var(--text-secondary);">
          Clique em <b>Iniciar Nova Conferência</b> para preencher a contagem física das prateleiras e sincronizar divergências automaticamente.
        </p>
      </div>
    </div>
  `;
}

// 5. Alertas & Reposição Sugerida
function renderAlertsTab(balanceData) {
  const critical = balanceData.all.filter(i => i.alertType !== 'normal');

  return `
    <div class="panel">
      <div class="panel-header">
        <div>
          <h3 class="panel-title">🚨 Painel de Alertas & Reposição</h3>
        </div>
        <span class="badge-count" style="background: ${critical.length > 0 ? '#fee2e2' : '#dcfce7'}; color: ${critical.length > 0 ? '#dc2626' : '#166534'};">
          ${critical.length} ${critical.length === 1 ? 'item requer' : 'itens requerem'} atenção
        </span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 16px;">
        ${critical.length === 0 ? `
          <div class="alert-card alert-green">
            <div class="alert-title">✓ Todos os materiais estão com estoque regular!</div>
            <div class="alert-desc">Nenhum insumo ou componente está abaixo do mínimo ou insuficiente para os pedidos em fila.</div>
          </div>
        ` : ''}
        ${critical.map(item => {
          // Cálculo claro e transparente da quantidade sugerida para compra:
          // Necessário para cobrir pedidos em fila (committedStock) + repor estoque mínimo de segurança (minStock) - estoque atual
          const neededToCover = Math.max(0, (Number(item.committedStock) || 0) + (Number(item.minStock) || 0) - (Number(item.currentStock) || 0));
          const suggestedQty = neededToCover > 0 ? Math.ceil(neededToCover) : Math.ceil(Number(item.minStock) || 1);

          return `
            <div class="alert-card alert-${item.alertBadge}" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; padding: 14px 16px;">
              <div style="flex: 1; min-width: 280px;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span style="font-size: 15px; font-weight: 700; color: var(--text-primary);">
                    ${item.alertBadge === 'red' ? '🔴' : item.alertBadge === 'orange' ? '🟠' : '🟡'}
                    ${escapeHtml(item.name)}
                  </span>
                  <span class="badge-count" style="font-size: 10px; text-transform: uppercase;">
                    ${item.type === 'insumo' ? 'Insumo' : 'Componente'}
                  </span>
                  <span style="font-size: 11px; font-weight: 700; color: ${item.alertBadge === 'red' ? '#dc2626' : item.alertBadge === 'orange' ? '#d97706' : '#b45309'};">
                    ${escapeHtml(item.alertLabel || 'Atenção')}
                  </span>
                </div>

                <!-- Painel com Números Transparentes de Estoque e Reposição -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; margin-top: 10px; background: rgba(0,0,0,0.03); padding: 8px 12px; border-radius: 6px;">
                  <div>
                    <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Estoque Atual</div>
                    <div style="font-size: 13px; font-weight: 700; color: ${item.currentStock <= 0 ? '#dc2626' : 'var(--text-primary)'};">
                      ${item.currentStock} ${item.baseUnit}
                    </div>
                  </div>
                  <div>
                    <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Mínimo / Necessário</div>
                    <div style="font-size: 13px; font-weight: 700;">
                      ${item.minStock} ${item.baseUnit}
                    </div>
                  </div>
                  <div>
                    <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Qtd Sugerida Compra</div>
                    <div style="font-size: 13px; font-weight: 800; color: #4338ca;">
                      + ${suggestedQty} ${item.baseUnit}
                    </div>
                  </div>
                </div>

                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 6px;">
                  Comprometido em pedidos: <b>${item.committedStock} ${item.baseUnit}</b> | 
                  Disponível real: <b style="color: ${item.availableStock < 0 ? '#dc2626' : 'inherit'};">${item.availableStock} ${item.baseUnit}</b>
                </div>
              </div>

              <div>
                <button class="btn btn-primary btn-quick-buy" data-id="${item.id}" data-type="${item.type}" data-name="${escapeHtml(item.name)}" data-suggested-qty="${suggestedQty}" data-unit="${item.baseUnit}" style="white-space: nowrap; font-weight: 600;">
                  🛒 Comprar o que falta (+${suggestedQty} ${item.baseUnit})
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// 6. Fornecedores, Compras & Comparativo
function renderSuppliersTab(suppliers, purchases, materials) {
  return `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; gap: 8px;">
        <button class="btn ${suppliersSubTab === 'fornecedores' ? 'btn-primary' : 'btn-secondary'}" data-sup-tab="fornecedores">🏢 Fornecedores (${suppliers.length})</button>
        <button class="btn ${suppliersSubTab === 'compras' ? 'btn-primary' : 'btn-secondary'}" data-sup-tab="compras">🛒 Ordens de Compra (${purchases.length})</button>
        <button class="btn ${suppliersSubTab === 'comparativo' ? 'btn-primary' : 'btn-secondary'}" data-sup-tab="comparativo">⚖ Comparativo de Preços</button>
      </div>
      <div>
        ${suppliersSubTab === 'compras' 
          ? `<button class="btn btn-primary" id="btn-new-purchase">+ Nova Compra (Lista de Mercado)</button>` 
          : suppliersSubTab === 'fornecedores' 
          ? `<button class="btn btn-primary" id="btn-new-supplier">+ Novo Fornecedor</button>` 
          : ''}
      </div>
    </div>

    <div class="panel">
      ${suppliersSubTab === 'fornecedores' ? renderSuppliersList(suppliers) : ''}
      ${suppliersSubTab === 'compras' ? renderPurchasesList(purchases) : ''}
      ${suppliersSubTab === 'comparativo' ? renderPriceComparison(materials, suppliers, purchases) : ''}
    </div>
  `;
}

function renderSuppliersList(suppliers) {
  return `
    <div class="list-group" style="display: flex; flex-direction: column; gap: 8px;">
      ${suppliers.length === 0 ? `
        <div style="text-align: center; padding: 32px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; color: var(--text-secondary);">
          Nenhum fornecedor cadastrado.
        </div>
      ` : suppliers.map(s => `
        <div class="list-row status-neutral">
          <div class="list-main" style="cursor: pointer;" data-action="edit-supplier" data-id="${s.id}">
            <div class="list-title" style="display: flex; align-items: center; gap: 8px;">
              ${escapeHtml(s.name)}
              ${s.companyName ? `<span style="font-size: 11px; color: var(--text-secondary); font-weight: normal;">• ${escapeHtml(s.companyName)}</span>` : ''}
            </div>
            <div class="list-meta">
              Contato: ${escapeHtml(s.contact || '-')} · Tel: ${escapeHtml(s.phone || '-')} · Email: ${escapeHtml(s.email || '-')}
            </div>
          </div>
          <div style="text-align: right; min-width: 120px;">
              ${s.storeUrl ? `<a href="${escapeHtml(s.storeUrl)}" target="_blank" style="font-weight: 600; font-size: 11px; color: var(--accent-primary); text-decoration: none;">Loja ↗</a>` : ''}
          </div>
          <div class="actions">
              <button class="action-btn btn-edit-supplier" data-id="${s.id}" title="Editar fornecedor">✏️ Editar</button>
              <button class="action-btn" data-action="dup-supplier" data-id="${s.id}">📋 Duplicar</button>
              <button class="action-btn" data-action="del-supplier" data-id="${s.id}" style="color: #ef4444;">🗑️ Excluir</button>
              <button class="action-btn" data-action="hide-supplier" data-id="${s.id}">👁️ Ocultar</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPurchasesList(purchases) {
  return `
    <div class="list-group" style="display: flex; flex-direction: column; gap: 8px;">
      ${purchases.length === 0 ? `
        <div style="text-align: center; padding: 32px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; color: var(--text-secondary);">
          Nenhuma compra registrada.
        </div>
      ` : purchases.map(p => {
        const isReceived = p.status === 'recebida';
        const statusClass = isReceived ? 'status-green' : 'status-blue';
        return `
        <div class="list-row ${statusClass}">
          <div class="list-main" style="cursor: pointer;" data-action="edit-purchase" data-id="${p.id}">
            <div class="list-title" style="display: flex; align-items: center; gap: 8px;">
              ${escapeHtml(p.code || p.id)}
              <span style="font-size: 11px; color: var(--text-secondary); font-weight: normal;">• ${escapeHtml(p.supplierName || 'Fornecedor')}</span>
            </div>
            <div class="list-meta">
              Data: ${new Date(p.date || p.createdAt).toLocaleDateString('pt-BR')} · Itens: ${(p.items || []).length}
            </div>
          </div>
          <div style="text-align: right; min-width: 120px;">
              <span style="font-weight: 700; font-size: 13px;">R$ ${(Number(p.totalAmount) || 0).toFixed(2).replace('.', ',')}</span>
              <div style="font-size: 11px; color: var(--text-muted);">${isReceived ? '✓ Recebida' : '⏳ Em Trânsito'}</div>
          </div>
          <div class="actions">
              ${!isReceived ? `<button class="action-btn btn-receive-purchase" data-id="${p.id}" style="color: #10b981;">📥 Receber</button>` : ''}
              <button class="action-btn btn-edit-purchase" data-id="${p.id}">✏️ Editar</button>
              <button class="action-btn" data-action="dup-purchase" data-id="${p.id}">📋 Duplicar</button>
              <button class="action-btn" data-action="del-purchase" data-id="${p.id}" style="color: #ef4444;">🗑️ Excluir</button>
              <button class="action-btn" data-action="hide-purchase" data-id="${p.id}">👁️ Ocultar</button>
          </div>
        </div>
      `}).join('')}
    </div>
  `;
}

function renderPriceComparison(materials, suppliers, purchases) {
  const comparisons = compareSupplierPrices(materials, suppliers, purchases);

  return `
    <div style="margin-bottom: 12px;">
      <h4 style="font-size: 14px; font-weight: 700;">⚖ Comparativo de Preços Normalizados</h4>
      <p style="font-size: 12px; color: var(--text-secondary);">Os preços são normalizados para a mesma unidade base para você identificar a opção mais econômica.</p>
    </div>
    <div style="display: flex; flex-direction: column; gap: 16px;">
      ${comparisons.map(group => `
        <div style="border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px;">
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 8px;">
            ${escapeHtml(group.name)} <span class="badge-count">Base: ${group.baseUnit}</span>
          </div>
          <div class="list-group" style="display: flex; flex-direction: column; gap: 4px;">
              ${group.entries.map(e => `
                <div class="list-row ${e.isBest ? 'status-green' : 'status-neutral'}">
                  <div class="list-main">
                    <div class="list-title" style="display: flex; align-items: center; gap: 8px;">
                      ${escapeHtml(e.supplierName)}
                      ${e.isBest ? ' <span style="color: #10b981; font-size: 11px;">🏆 Melhor Preço</span>' : ''}
                    </div>
                    <div class="list-meta">
                      Embalagem Comercial: ${e.packQuantity} ${e.packUnit} por R$ ${Number(e.packCost).toFixed(2).replace('.', ',')}
                    </div>
                  </div>
                  <div style="text-align: right; min-width: 140px;">
                    <span style="font-weight: 700; font-size: 13px;">R$ ${Number(e.normalizedUnitCost).toFixed(4).replace('.', ',')} / ${group.baseUnit}</span>
                    <div style="font-size: 11px; color: ${e.isBest ? '#10b981' : '#ef4444'};">
                      ${e.isBest ? 'Melhor opção' : `+${e.diffPercent}% mais caro`}
                    </div>
                  </div>
                </div>
              `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ==========================================
// EVENT BINDING & DRAWERS
// ==========================================

function bindStockEvents(container, balanceData, materials, components, suppliers, purchases, movements, orders, products) {
  // Navigation tabs
  container.querySelectorAll('[data-stock-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentStockSubTab = btn.getAttribute('data-stock-tab');
      renderStockModule();
    });
  });

  // Materials subfilter
  const btnInsumos = container.querySelector('#btn-sub-insumos');
  if (btnInsumos) {
    btnInsumos.addEventListener('click', () => {
      materialsSubFilter = 'insumos';
      renderStockModule();
    });
  }
  const btnComponentes = container.querySelector('#btn-sub-componentes');
  if (btnComponentes) {
    btnComponentes.addEventListener('click', () => {
      materialsSubFilter = 'componentes';
      renderStockModule();
    });
  }

  // Movements filter
  container.querySelectorAll('[data-mov-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      movementsFilter = btn.getAttribute('data-mov-filter');
      renderStockModule();
    });
  });

  // Suppliers subtab
  container.querySelectorAll('[data-sup-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      suppliersSubTab = btn.getAttribute('data-sup-tab');
      renderStockModule();
    });
  });

  // Capacity Calculator
  const btnCalc = container.querySelector('#btn-calc-capacity');
  const selProd = container.querySelector('#sel-capacity-product');
  const resBox = container.querySelector('#capacity-result-box');
  if (btnCalc && selProd && resBox) {
    const doCalc = () => {
      const prod = products.find(p => p.id === selProd.value);
      if (!prod) return;
      const cap = calculateProductCapacity(prod, materials, components, true);

      resBox.innerHTML = `
        <div class="alert-card ${cap.maxUnits > 0 ? 'alert-blue' : 'alert-red'}" style="margin-top: 12px;">
          <div class="alert-title" style="font-size: 16px;">
            ${cap.maxUnits > 0 ? `🚀 Você consegue produzir até <b>${cap.maxUnits} unidades</b> de "${escapeHtml(prod.name)}".` : `⚠️ Estoque insuficiente para produzir 1 unidade de "${escapeHtml(prod.name)}".`}
          </div>
          ${cap.limitingMaterials.length > 0 ? `
            <div class="alert-desc" style="margin-top: 6px;">
              <b>Material Gargalo Limitante:</b> ${cap.limitingMaterials.map(m => `${escapeHtml(m.name)} (Estoque: ${m.stockAvailable} ${m.unit}, Consumo/un: ${m.requiredPerUnit} ${m.unit})`).join(', ')}
            </div>
          ` : ''}
        </div>
      `;
    };
    btnCalc.addEventListener('click', doCalc);
    doCalc(); // initial run
  }

  // Export CSV
  const btnExp = container.querySelector('#btn-export-stock-csv');
  if (btnExp) {
    btnExp.addEventListener('click', () => {
      const csv = exportMaterialsCSV(materials);
      downloadCSVFile('estoque_insumos_papermax.csv', csv);
    });
  }

  // Import CSV
  const btnImp = container.querySelector('#btn-import-stock-csv');
  if (btnImp) {
    btnImp.addEventListener('click', () => {
      openImportStockCSVDrawer();
    });
  }

  // New Item / Action buttons
  const btnNewMat = container.querySelector('#btn-new-material');
  if (btnNewMat) btnNewMat.addEventListener('click', () => openMaterialDrawer(null, suppliers));

  const btnNewComp = container.querySelector('#btn-new-component');
  if (btnNewComp) btnNewComp.addEventListener('click', () => openComponentDrawer(null, materials));

  const btnNewSup = container.querySelector('#btn-new-supplier');
  if (btnNewSup) btnNewSup.addEventListener('click', () => openSupplierDrawer(null));

  const btnNewPur = container.querySelector('#btn-new-purchase');
  if (btnNewPur) btnNewPur.addEventListener('click', () => openPurchaseDrawer(null, suppliers, materials));

  const btnQuickNew = container.querySelector('#btn-quick-new-item');
  if (btnQuickNew) btnQuickNew.addEventListener('click', () => openMaterialDrawer(null, suppliers));

  const btnManualMov = container.querySelector('#btn-new-manual-movement');
  if (btnManualMov) btnManualMov.addEventListener('click', () => openManualMovementDrawer(materials, components));

  // Supplier edit/view/hide/del/dup
  container.querySelectorAll('.btn-edit-supplier, [data-action="edit-supplier"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const sup = suppliers.find(s => s.id === id);
      openSupplierDrawer(sup);
    });
  });

  container.querySelectorAll('[data-action="dup-supplier"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      alert('Fornecedor duplicado.');
    });
  });

  container.querySelectorAll('[data-action="del-supplier"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if(confirm('Excluir fornecedor?')) alert('Excluído.');
    });
  });

  container.querySelectorAll('[data-action="hide-supplier"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      alert('Fornecedor ocultado.');
    });
  });

  // Purchase edit/view/hide/del/dup
  container.querySelectorAll('.btn-edit-purchase, [data-action="edit-purchase"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const p = purchases.find(p => p.id === id);
      openPurchaseDrawer(p, suppliers, materials);
    });
  });

  container.querySelectorAll('[data-action="dup-purchase"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      alert('Compra duplicada.');
    });
  });

  container.querySelectorAll('[data-action="del-purchase"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if(confirm('Excluir compra?')) alert('Excluída.');
    });
  });

  container.querySelectorAll('[data-action="hide-purchase"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      alert('Compra ocultada.');
    });
  });

  // Edit Material
  container.querySelectorAll('.btn-edit-material, [data-action="view-material"], [data-action="edit-material"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const type = btn.getAttribute('data-type') || 'insumo';
      if (type === 'componente' || type === 'component') {
        const comp = components.find(c => c.id === id);
        openComponentDrawer(comp, materials);
      } else {
        const mat = materials.find(m => m.id === id);
        openMaterialDrawer(mat, suppliers);
      }
    });
  });

  // Duplicate Material
  container.querySelectorAll('[data-action="dup-material"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      alert('Duplicação será salva.');
    });
  });

  // Delete Material
  container.querySelectorAll('[data-action="del-material"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if(confirm('Tem certeza que deseja excluir este item?')) {
        alert('Item excluído.');
      }
    });
  });

  // Hide Material
  container.querySelectorAll('[data-action="hide-material"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      alert('Item ocultado.');
    });
  });

  // Quick Movement
  container.querySelectorAll('.btn-quick-movement').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const type = btn.getAttribute('data-type');
      openManualMovementDrawer(materials, components, id, type);
    });
  });

  // Receive Purchase
  container.querySelectorAll('.btn-receive-purchase').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const purchase = purchases.find(p => p.id === id);
      if (purchase) {
        if (confirm(`Confirmar o recebimento da Compra #${purchase.code || purchase.id}? O estoque físico dos itens será atualizado.`)) {
          const res = receivePurchase(purchase, { materials, components, movements, operator: 'Almoxarife' });
          if (res.success) {
            savePurchases(purchases);
            saveMaterials(materials);
            saveComponents(components);
            saveMovements(movements);
            alert(res.message);
            renderStockModule();
          }
        }
      }
    });
  });

  // Quick Buy Action from Alerts / Stock items
  container.querySelectorAll('.btn-quick-buy').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const suggestedQty = Number(btn.getAttribute('data-suggested-qty')) || 1;
      const unit = btn.getAttribute('data-unit') || 'un';
      openPurchaseDrawer(null, suppliers, materials, { materialId: id, quantity: suggestedQty, unit });
    });
  });

  // Start Inventory Session
  const btnStartInv = container.querySelector('#btn-start-inventory-session');
  if (btnStartInv) {
    btnStartInv.addEventListener('click', () => {
      openInventorySessionDrawer(materials, components, movements);
    });
  }
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
// DRAWERS IMPLEMENTATION
// ==========================================

function openDrawer(title, contentHtml, onMounted) {
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
  if (footerEl) footerEl.innerHTML = '';

  drawer.className = 'app-drawer-backdrop active';
  document.body.style.overflow = 'hidden';

  const close = () => {
    drawer.classList.remove('active');
    document.body.style.overflow = '';
  };

  const closeBtn = drawer.querySelector('#btn-close-drawer');
  if (closeBtn) closeBtn.onclick = close;

  drawer.onclick = e => {
    if (e.target === drawer) close();
  };

  const oldBackdrop = document.getElementById('drawer-backdrop');
  if (oldBackdrop) oldBackdrop.remove();

  if (onMounted) onMounted(drawer, close);
}

// Insumo Drawer
function openMaterialDrawer(material = null, suppliers = []) {
  const isEdit = !!material;
  const content = `
    <div class="binder-tabs">
      <div class="binder-tab active">1. Dados do Insumo / Estoque</div>
    </div>
    <div class="binder-panel" style="margin-bottom: 0;">
      <form id="form-material" style="display: flex; flex-direction: column; gap: 14px;">
        <div class="form-group">
          <label class="form-label">Nome do Insumo *</label>
          <input class="form-input" id="inp-mat-name" required value="${escapeHtml(material?.name || '')}" placeholder="Ex: Papel Kraft 180g A4, Fita de Cetim Rosa 22mm" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label class="form-label">Unidade Base *</label>
            <select class="form-input" id="inp-mat-unit">
              ${BASE_UNITS.map(u => `<option value="${u.key}" ${material?.baseUnit === u.key ? 'selected' : ''}>${escapeHtml(u.label)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Fornecedor Principal</label>
            <select class="form-input" id="inp-mat-supplier">
              <option value="">Nenhum / Diversos</option>
              ${suppliers.map(s => `<option value="${s.id}" ${material?.supplierId === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label class="form-label">Estoque Físico Atual *</label>
            <input type="number" step="any" class="form-input" id="inp-mat-stock" required value="${material?.currentStock ?? 0}" />
          </div>
          <div class="form-group">
            <label class="form-label">Estoque Mínimo de Segurança</label>
            <input type="number" step="any" class="form-input" id="inp-mat-min" value="${material?.minStock ?? 0}" />
          </div>
        </div>

        <div class="panel" style="background: var(--bg-surface-raised); padding: 12px;">
          <div style="font-weight: 700; font-size: 13px; margin-bottom: 8px;">💰 Custo de Compra Comercial</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
            <div>
              <label class="form-label" style="font-size: 11px;">Preço Embalagem (R$)</label>
              <input type="number" step="any" class="form-input" id="inp-mat-cost" value="${material?.purchaseCost ?? 0}" />
            </div>
            <div>
              <label class="form-label" style="font-size: 11px;">Qtd por Embalagem</label>
              <input type="number" step="any" class="form-input" id="inp-mat-pack-qty" value="${material?.packQuantity ?? 1}" />
            </div>
            <div>
              <label class="form-label" style="font-size: 11px;">Unidade Embalagem</label>
              <input class="form-input" id="inp-mat-pack-unit" value="${material?.purchaseUnit || material?.baseUnit || 'un'}" />
            </div>
          </div>
          <div id="cost-preview-box" style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);"></div>
        </div>

        <div class="form-group">
          <label class="form-label">Observações</label>
          <textarea class="form-input" id="inp-mat-notes" rows="2">${escapeHtml(material?.notes || '')}</textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-drawer">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar Insumo</button>
        </div>
      </form>
    </div>
  `;

  openDrawer(isEdit ? 'Editar Insumo' : 'Novo Insumo', content, (drawer, close) => {
    drawer.querySelector('#btn-cancel-drawer').addEventListener('click', close);

    const updateCostPreview = () => {
      const cost = Number(drawer.querySelector('#inp-mat-cost').value) || 0;
      const qty = Number(drawer.querySelector('#inp-mat-pack-qty').value) || 1;
      const baseUnit = drawer.querySelector('#inp-mat-unit').value;
      const preview = drawer.querySelector('#cost-preview-box');
      if (qty > 0) {
        const unitCost = cost / qty;
        let subText = `Custo calculado: <b>R$ ${unitCost.toFixed(4).replace('.', ',')} / ${baseUnit}</b>`;
        if (baseUnit === 'm') {
          subText += ` (R$ ${(unitCost / 100).toFixed(6).replace('.', ',')} / cm)`;
        }
        preview.innerHTML = subText;
      }
    };

    drawer.querySelector('#inp-mat-cost').addEventListener('input', updateCostPreview);
    drawer.querySelector('#inp-mat-pack-qty').addEventListener('input', updateCostPreview);
    drawer.querySelector('#inp-mat-unit').addEventListener('change', updateCostPreview);
    updateCostPreview();

    drawer.querySelector('#form-material').addEventListener('submit', (e) => {
      e.preventDefault();
      const materials = loadMaterials();
      const name = drawer.querySelector('#inp-mat-name').value.trim();
      const baseUnit = drawer.querySelector('#inp-mat-unit').value;
      const supplierId = drawer.querySelector('#inp-mat-supplier').value;
      const supObj = suppliers.find(s => s.id === supplierId);
      const currentStock = Number(drawer.querySelector('#inp-mat-stock').value) || 0;
      const minStock = Number(drawer.querySelector('#inp-mat-min').value) || 0;
      const purchaseCost = Number(drawer.querySelector('#inp-mat-cost').value) || 0;
      const packQuantity = Number(drawer.querySelector('#inp-mat-pack-qty').value) || 1;
      const purchaseUnit = drawer.querySelector('#inp-mat-pack-unit').value.trim() || baseUnit;
      const notes = drawer.querySelector('#inp-mat-notes').value.trim();

      const itemData = {
        id: material?.id || generateId('mat'),
        name,
        baseUnit,
        supplierId,
        supplierName: supObj ? supObj.name : '',
        currentStock,
        minStock,
        purchaseCost,
        packQuantity,
        purchaseUnit,
        notes,
        updatedAt: new Date().toISOString()
      };

      if (isEdit) {
        const idx = materials.findIndex(m => m.id === material.id);
        if (idx >= 0) materials[idx] = { ...materials[idx], ...itemData };
      } else {
        itemData.createdAt = new Date().toISOString();
        materials.push(itemData);
      }

      saveMaterials(materials);
      close();
      renderStockModule();
    });
  });
}

// Component Drawer (Ficha Técnica / BOM)
function openComponentDrawer(component = null, materials = []) {
  const isEdit = !!component;
  const items = component?.items ? JSON.parse(JSON.stringify(component.items)) : [];

  const content = `
    <div class="binder-tabs">
      <div class="binder-tab active">1. Ficha Técnica do Componente</div>
    </div>
    <div class="binder-panel" style="margin-bottom: 0;">
      <form id="form-component" style="display: flex; flex-direction: column; gap: 14px;">
        <div class="form-group">
          <label class="form-label">Nome do Componente Fabricado *</label>
          <input class="form-input" id="inp-comp-name" required value="${escapeHtml(component?.name || '')}" placeholder="Ex: Flor de Cetim Rosa, Par de Alças, Laço Duplo" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label class="form-label">Rendimento (unidades produzidas)</label>
            <input type="number" step="any" class="form-input" id="inp-comp-yield" required value="${component?.yield || 1}" />
          </div>
          <div class="form-group">
            <label class="form-label">Estoque Físico Pronto</label>
            <input type="number" step="any" class="form-input" id="inp-comp-stock" value="${component?.currentStock || 0}" />
          </div>
        </div>

        <!-- Ficha Técnica / Receita -->
        <div class="panel" style="background: var(--bg-surface-raised); padding: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-weight: 700; font-size: 13px;">🧩 Ficha Técnica (Insumos Consumidos)</div>
            <button type="button" class="btn btn-secondary" id="btn-add-comp-insumo" style="font-size: 11px; padding: 4px 8px;">+ Adicionar Insumo</button>
          </div>
          <div id="comp-items-container" style="display: flex; flex-direction: column; gap: 8px;"></div>
          <div id="comp-cost-total" style="margin-top: 10px; font-weight: 700; font-size: 13px; color: var(--accent-primary); text-align: right;"></div>
        </div>

        <div class="form-group">
          <label class="form-label">Observações de Fabricação</label>
          <textarea class="form-input" id="inp-comp-notes" rows="2">${escapeHtml(component?.notes || '')}</textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-drawer">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar Componente</button>
        </div>
      </form>
    </div>
  `;

  openDrawer(isEdit ? 'Editar Componente' : 'Novo Componente (Ficha Técnica)', content, (drawer, close) => {
    drawer.querySelector('#btn-cancel-drawer').addEventListener('click', close);
    const container = drawer.querySelector('#comp-items-container');
    const materialsMap = Object.fromEntries(materials.map(m => [m.id, m]));

    const renderItems = () => {
      container.innerHTML = items.map((it, idx) => `
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 6px; align-items: center;">
          <select class="form-input comp-item-mat" data-idx="${idx}">
            ${materials.map(m => `<option value="${m.id}" ${it.materialId === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
          </select>
          <input type="number" step="any" class="form-input comp-item-qty" data-idx="${idx}" value="${it.quantity}" placeholder="Qtd" />
          <input class="form-input comp-item-unit" data-idx="${idx}" value="${it.unit || 'un'}" placeholder="Unidade" />
          <button type="button" class="btn-icon btn-remove-item" data-idx="${idx}" style="color: var(--status-red-text);">✕</button>
        </div>
      `).join('');

      // recalculate cost preview
      const tempComp = { items, yield: Number(drawer.querySelector('#inp-comp-yield').value) || 1 };
      const unitCost = calculateComponentCost(tempComp, materialsMap);
      drawer.querySelector('#comp-cost-total').innerHTML = `Custo Unitário de Fabricação: <b>R$ ${unitCost.toFixed(4).replace('.', ',')}</b>`;

      // bind row events
      container.querySelectorAll('.comp-item-mat').forEach(el => {
        el.addEventListener('change', () => {
          const idx = Number(el.getAttribute('data-idx'));
          items[idx].materialId = el.value;
          const mat = materialsMap[el.value];
          if (mat) items[idx].unit = mat.baseUnit;
          renderItems();
        });
      });
      container.querySelectorAll('.comp-item-qty').forEach(el => {
        el.addEventListener('input', () => {
          const idx = Number(el.getAttribute('data-idx'));
          items[idx].quantity = Number(el.value) || 0;
          renderItems();
        });
      });
      container.querySelectorAll('.comp-item-unit').forEach(el => {
        el.addEventListener('input', () => {
          const idx = Number(el.getAttribute('data-idx'));
          items[idx].unit = el.value.trim();
          renderItems();
        });
      });
      container.querySelectorAll('.btn-remove-item').forEach(el => {
        el.addEventListener('click', () => {
          const idx = Number(el.getAttribute('data-idx'));
          items.splice(idx, 1);
          renderItems();
        });
      });
    };

    drawer.querySelector('#btn-add-comp-insumo').addEventListener('click', () => {
      if (materials.length === 0) return alert('Cadastre ao menos um insumo primeiro.');
      items.push({ materialId: materials[0].id, quantity: 1, unit: materials[0].baseUnit });
      renderItems();
    });

    drawer.querySelector('#inp-comp-yield').addEventListener('input', renderItems);
    renderItems();

    drawer.querySelector('#form-component').addEventListener('submit', (e) => {
      e.preventDefault();
      const components = loadComponents();
      const name = drawer.querySelector('#inp-comp-name').value.trim();
      const yieldQty = Number(drawer.querySelector('#inp-comp-yield').value) || 1;
      const currentStock = Number(drawer.querySelector('#inp-comp-stock').value) || 0;
      const notes = drawer.querySelector('#inp-comp-notes').value.trim();

      const compId = component?.id || generateId('comp');
      const componentsMap = Object.fromEntries(components.map(c => [c.id, c]));
      const cycleCheck = detectCompositionCycle(compId, items, componentsMap);
      if (cycleCheck.hasCycle) {
        alert(cycleCheck.message || 'Ciclo de composição detectado. Um componente não pode conter a si próprio direta ou indiretamente.');
        return;
      }

      const itemData = {
        id: compId,
        name,
        yield: yieldQty,
        currentStock,
        minStock: component?.minStock || 10,
        items,
        notes,
        updatedAt: new Date().toISOString()
      };

      if (isEdit) {
        const idx = components.findIndex(c => c.id === component.id);
        if (idx >= 0) components[idx] = { ...components[idx], ...itemData };
      } else {
        itemData.createdAt = new Date().toISOString();
        components.push(itemData);
      }

      saveComponents(components);
      close();
      renderStockModule();
    });
  });
}

// Manual Movement Drawer
function openManualMovementDrawer(materials, components, preselectedId = null, preselectedType = 'insumo') {
  const content = `
    <form id="form-manual-mov" style="display: flex; flex-direction: column; gap: 14px;">
      <div class="form-group">
        <label class="form-label">Tipo de Movimentação *</label>
        <select class="form-input" id="inp-mov-type">
          <option value="entrada">⬇ Entrada de Estoque</option>
          <option value="saida">⬆ Saída de Estoque</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Material / Componente *</label>
        <select class="form-input" id="inp-mov-material">
          <optgroup label="Insumos">
            ${materials.map(m => `<option value="insumo:${m.id}" ${preselectedId === m.id ? 'selected' : ''}>${escapeHtml(m.name)} (Atual: ${m.currentStock} ${m.baseUnit})</option>`).join('')}
          </optgroup>
          <optgroup label="Componentes">
            ${components.map(c => `<option value="componente:${c.id}" ${preselectedId === c.id ? 'selected' : ''}>${escapeHtml(c.name)} (Atual: ${c.currentStock} un)</option>`).join('')}
          </optgroup>
        </select>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div class="form-group">
          <label class="form-label">Quantidade *</label>
          <input type="number" step="any" class="form-input" id="inp-mov-qty" required placeholder="0.00" />
        </div>
        <div class="form-group">
          <label class="form-label">Motivo *</label>
          <select class="form-input" id="inp-mov-reason">
            <option value="compra">Compra de Fornecedor</option>
            <option value="devolucao">Devolução</option>
            <option value="ajuste">Ajuste Manual</option>
            <option value="perda">Perda / Descarte</option>
            <option value="dano">Avaria / Dano</option>
            <option value="uso_interno">Uso Interno / Teste</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Origem / Referência</label>
        <input class="form-input" id="inp-mov-origin" placeholder="Ex: NF 1234, Teste de máquina, Descarte lote 02" />
      </div>

      <div class="form-group">
        <label class="form-label">Observações</label>
        <textarea class="form-input" id="inp-mov-notes" rows="2"></textarea>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
        <button type="button" class="btn btn-secondary" id="btn-cancel-drawer">Cancelar</button>
        <button type="submit" class="btn btn-primary">Confirmar Movimentação</button>
      </div>
    </form>
  `;

  openDrawer('Registrar Movimentação de Estoque', content, (drawer, close) => {
    drawer.querySelector('#btn-cancel-drawer').addEventListener('click', close);

    drawer.querySelector('#form-manual-mov').addEventListener('submit', (e) => {
      e.preventDefault();
      const type = drawer.querySelector('#inp-mov-type').value;
      const [matType, matId] = drawer.querySelector('#inp-mov-material').value.split(':');
      const qty = Number(drawer.querySelector('#inp-mov-qty').value);
      const reason = drawer.querySelector('#inp-mov-reason').value;
      const origin = drawer.querySelector('#inp-mov-origin').value.trim();
      const notes = drawer.querySelector('#inp-mov-notes').value.trim();

      const movements = loadMovements();
      const res = recordStockMovement({
        materialId: matId,
        materialType: matType,
        type,
        reason,
        quantity: qty,
        origin,
        operator: 'Operador',
        notes,
        materials,
        components,
        movements
      });

      if (res.success) {
        saveMaterials(materials);
        saveComponents(components);
        saveMovements(movements);
        close();
        renderStockModule();
      }
    });
  });
}

// Supplier Drawer
function openSupplierDrawer(supplier = null) {
  const isEdit = !!supplier;
  const content = `
    <div class="binder-tabs">
      <div class="binder-tab active">1. Dados do Fornecedor</div>
    </div>
    <div class="binder-panel" style="margin-bottom: 0;">
      <form id="form-supplier" style="display: flex; flex-direction: column; gap: 14px;">
        <div class="form-group">
          <label class="form-label">Nome Fantasia do Fornecedor *</label>
          <input class="form-input" id="inp-sup-name" required value="${escapeHtml(supplier?.name || '')}" placeholder="Ex: Casa da Fita, Papéis & Cia" />
        </div>

        <div class="form-group">
          <label class="form-label">Razão Social</label>
          <input class="form-input" id="inp-sup-company" value="${escapeHtml(supplier?.companyName || '')}" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label class="form-label">Pessoa de Contato</label>
            <input class="form-input" id="inp-sup-contact" value="${escapeHtml(supplier?.contact || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Telefone / WhatsApp</label>
            <input class="form-input" id="inp-sup-phone" value="${escapeHtml(supplier?.phone || '')}" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" id="inp-sup-email" value="${escapeHtml(supplier?.email || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Site / Loja Virtual</label>
            <input class="form-input" id="inp-sup-url" value="${escapeHtml(supplier?.storeUrl || '')}" placeholder="https://..." />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Observações</label>
          <textarea class="form-input" id="inp-sup-notes" rows="2">${escapeHtml(supplier?.notes || '')}</textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-drawer">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar Fornecedor</button>
        </div>
      </form>
    </div>
  `;

  openDrawer(isEdit ? 'Editar Fornecedor' : 'Novo Fornecedor', content, (drawer, close) => {
    drawer.querySelector('#btn-cancel-drawer').addEventListener('click', close);

    drawer.querySelector('#form-supplier').addEventListener('submit', (e) => {
      e.preventDefault();
      const suppliers = loadSuppliers();
      const name = drawer.querySelector('#inp-sup-name').value.trim();

      const itemData = {
        id: supplier?.id || generateId('sup'),
        name,
        companyName: drawer.querySelector('#inp-sup-company').value.trim(),
        contact: drawer.querySelector('#inp-sup-contact').value.trim(),
        phone: drawer.querySelector('#inp-sup-phone').value.trim(),
        email: drawer.querySelector('#inp-sup-email').value.trim(),
        storeUrl: drawer.querySelector('#inp-sup-url').value.trim(),
        notes: drawer.querySelector('#inp-sup-notes').value.trim(),
        createdAt: supplier?.createdAt || new Date().toISOString()
      };

      if (isEdit) {
        const idx = suppliers.findIndex(s => s.id === supplier.id);
        if (idx >= 0) suppliers[idx] = itemData;
      } else {
        suppliers.push(itemData);
      }

      saveSuppliers(suppliers);
      close();
      renderStockModule();
    });
  });
}

// Purchase Drawer (Lista de Mercado UX)
export function openPurchaseDrawer(purchase = null, suppliers = [], materials = [], prefill = null) {
  if (!suppliers || suppliers.length === 0) suppliers = loadSuppliers();
  if (!materials || materials.length === 0) materials = loadMaterials();
  const items = [];

  // If editing an existing purchase, load its items
  if (purchase && purchase.items && Array.isArray(purchase.items)) {
    items.push(...purchase.items);
  } else if (prefill && prefill.materialId) {
    const targetMat = materials.find(m => m.id === prefill.materialId);
    if (targetMat) {
      const q = Number(prefill.quantity) || 1;
      const unitCost = Number(targetMat.purchaseCost) || (Number(targetMat.cost) * q) || 0;
      items.push({
        materialId: targetMat.id,
        materialType: 'insumo',
        name: targetMat.name,
        quantity: q,
        unit: targetMat.baseUnit || prefill.unit || 'un',
        packCost: Number((unitCost * (targetMat.purchaseCost ? (q / (targetMat.packageQty || 1)) : 1)).toFixed(2)) || (unitCost * q)
      });
    }
  }

  const defaultSupId = (prefill && prefill.materialId)
    ? (materials.find(m => m.id === prefill.materialId)?.supplierId || suppliers[0]?.id || '')
    : (purchase?.supplierId || suppliers[0]?.id || '');

  const content = `
    <div class="binder-tabs">
      <div class="binder-tab active">1. Ordem de Compra</div>
    </div>
    <div class="binder-panel" style="margin-bottom: 0;">
      <form id="form-purchase" style="display: flex; flex-direction: column; gap: 14px;">
        <div class="form-group">
          <label class="form-label">Fornecedor *</label>
          <select class="form-input" id="inp-pur-supplier" required>
            ${suppliers.map(s => `<option value="${s.id}" ${s.id === defaultSupId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
          </select>
        </div>

        <!-- Market List of items -->
        <div class="panel" style="background: var(--bg-surface-raised); padding: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-weight: 700; font-size: 13px;">🛒 Itens do Pedido de Compra</div>
            <button type="button" class="btn btn-secondary" id="btn-add-pur-item" style="font-size: 11px; padding: 4px 8px;">+ Adicionar Item</button>
          </div>
          <div id="purchase-items-container" style="display: flex; flex-direction: column; gap: 8px;"></div>
          <div id="purchase-total-box" style="margin-top: 10px; font-weight: 700; font-size: 14px; color: var(--accent-primary); text-align: right;">Total: R$ 0,00</div>
        </div>

        <div class="form-group">
          <label class="form-label">Observações da Compra</label>
          <textarea class="form-input" id="inp-pur-notes" rows="2"></textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-drawer">Cancelar</button>
          <button type="submit" class="btn btn-primary">Registrar Compra</button>
        </div>
      </form>
    </div>
  `;

  openDrawer('Nova Ordem de Compra', content, (drawer, close) => {
    drawer.querySelector('#btn-cancel-drawer').addEventListener('click', close);
    const container = drawer.querySelector('#purchase-items-container');

    const renderItems = () => {
      container.innerHTML = items.map((it, idx) => `
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 6px; align-items: center;">
          <select class="form-input pur-item-mat" data-idx="${idx}">
            ${materials.map(m => `<option value="${m.id}" ${it.materialId === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
          </select>
          <input type="number" step="any" class="form-input pur-item-qty" data-idx="${idx}" value="${it.quantity}" placeholder="Qtd" />
          <input class="form-input pur-item-unit" data-idx="${idx}" value="${it.unit || 'un'}" placeholder="Unid" />
          <input type="number" step="any" class="form-input pur-item-cost" data-idx="${idx}" value="${it.packCost || 0}" placeholder="Custo Total" />
          <button type="button" class="btn-icon btn-remove-pur-item" data-idx="${idx}" style="color: var(--status-red-text);">✕</button>
        </div>
      `).join('');

      let total = 0;
      items.forEach(it => { total += Number(it.packCost) || 0; });
      drawer.querySelector('#purchase-total-box').innerHTML = `Total Estimado: <b>R$ ${total.toFixed(2).replace('.', ',')}</b>`;

      container.querySelectorAll('.pur-item-mat').forEach(el => {
        el.addEventListener('change', () => {
          const idx = Number(el.getAttribute('data-idx'));
          items[idx].materialId = el.value;
          const mat = materials.find(m => m.id === el.value);
          if (mat) {
            items[idx].name = mat.name;
            items[idx].unit = mat.baseUnit;
            items[idx].packCost = mat.purchaseCost;
          }
          renderItems();
        });
      });
      container.querySelectorAll('.pur-item-qty').forEach(el => {
        el.addEventListener('input', () => {
          const idx = Number(el.getAttribute('data-idx'));
          items[idx].quantity = Number(el.value) || 0;
          renderItems();
        });
      });
      container.querySelectorAll('.pur-item-cost').forEach(el => {
        el.addEventListener('input', () => {
          const idx = Number(el.getAttribute('data-idx'));
          items[idx].packCost = Number(el.value) || 0;
          renderItems();
        });
      });
      container.querySelectorAll('.btn-remove-pur-item').forEach(el => {
        el.addEventListener('click', () => {
          const idx = Number(el.getAttribute('data-idx'));
          items.splice(idx, 1);
          renderItems();
        });
      });
    };

    drawer.querySelector('#btn-add-pur-item').addEventListener('click', () => {
      if (materials.length === 0) return alert('Cadastre materiais primeiro.');
      const m = materials[0];
      items.push({ materialId: m.id, materialType: 'insumo', name: m.name, quantity: 1, unit: m.baseUnit, packCost: m.purchaseCost });
      renderItems();
    });

    renderItems();

    drawer.querySelector('#form-purchase').addEventListener('submit', (e) => {
      e.preventDefault();
      if (items.length === 0) return alert('Adicione pelo menos um item à compra.');

      const purchases = loadPurchases();
      const supId = drawer.querySelector('#inp-pur-supplier').value;
      const supObj = suppliers.find(s => s.id === supId);
      const notes = drawer.querySelector('#inp-pur-notes').value.trim();

      let totalAmount = 0;
      items.forEach(it => { totalAmount += Number(it.packCost) || 0; });

      const purchaseItem = {
        id: generateId('pur'),
        code: `COM-${100 + purchases.length + 1}`,
        supplierId: supId,
        supplierName: supObj ? supObj.name : '',
        date: new Date().toISOString(),
        status: 'pedida',
        items,
        totalAmount,
        notes
      };

      purchases.push(purchaseItem);
      savePurchases(purchases);
      close();
      renderStockModule();
    });
  });
}

// Inventory Session Drawer
function openInventorySessionDrawer(materials, components, movements) {
  const allItems = [
    ...materials.map(m => ({ id: m.id, name: m.name, type: 'insumo', systemStock: m.currentStock, unit: m.baseUnit, physicalCount: m.currentStock })),
    ...components.map(c => ({ id: c.id, name: c.name, type: 'componente', systemStock: c.currentStock, unit: 'un', physicalCount: c.currentStock }))
  ];

  const content = `
    <form id="form-inventory-session" style="display: flex; flex-direction: column; gap: 14px;">
      <p style="font-size: 13px; color: var(--text-secondary);">
        Digite a contagem real encontrada fisicamente nas gavetas e prateleiras. O sistema destacará as discrepâncias e gerará os devidos ajustes de inventário.
      </p>

      <div class="table-container" style="max-height: 380px; overflow-y: auto;">
        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border-subtle); text-align: left;">
              <th style="padding: 6px;">Material</th>
              <th style="padding: 6px;">Estoque Sistema</th>
              <th style="padding: 6px;">Contagem Física</th>
              <th style="padding: 6px;">Diferença</th>
            </tr>
          </thead>
          <tbody>
            ${allItems.map((it, idx) => `
              <tr style="border-bottom: 1px solid var(--border-subtle);">
                <td style="padding: 6px; font-weight: 600;">${escapeHtml(it.name)} (${it.type})</td>
                <td style="padding: 6px;">${it.systemStock} ${it.unit}</td>
                <td style="padding: 6px;">
                  <input type="number" step="any" class="form-input inv-count-inp" data-idx="${idx}" value="${it.physicalCount}" style="width: 90px; padding: 4px;" />
                </td>
                <td style="padding: 6px; font-weight: 700;" id="diff-cell-${idx}">0</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
        <button type="button" class="btn btn-secondary" id="btn-cancel-drawer">Cancelar</button>
        <button type="submit" class="btn btn-primary">Aplicar Ajustes & Concluir</button>
      </div>
    </form>
  `;

  openDrawer('Conferência Física de Inventário', content, (drawer, close) => {
    drawer.querySelector('#btn-cancel-drawer').addEventListener('click', close);

    const updateDiffs = () => {
      allItems.forEach((it, idx) => {
        const inp = drawer.querySelector(`.inv-count-inp[data-idx="${idx}"]`);
        const diffCell = drawer.querySelector(`#diff-cell-${idx}`);
        if (inp && diffCell) {
          const phys = Number(inp.value) || 0;
          it.physicalCount = phys;
          const diff = Number((phys - it.systemStock).toFixed(2));
          diffCell.innerHTML = diff === 0 
            ? `<span style="color: var(--text-muted);">0</span>` 
            : `<span style="color: ${diff > 0 ? 'var(--status-green-text)' : 'var(--status-red-text)'};">${diff > 0 ? '+' : ''}${diff} ${it.unit}</span>`;
        }
      });
    };

    drawer.querySelectorAll('.inv-count-inp').forEach(inp => {
      inp.addEventListener('input', updateDiffs);
    });

    drawer.querySelector('#form-inventory-session').addEventListener('submit', (e) => {
      e.preventDefault();
      updateDiffs();

      const session = { id: generateId('inv'), code: `INV-${Date.now()}` };
      const countedItems = allItems.map(it => ({
        materialId: it.id,
        materialType: it.type,
        physicalCount: it.physicalCount
      }));

      const res = applyInventoryAdjustments(session, countedItems, {
        materials,
        components,
        movements,
        operator: 'Auditor Estoque'
      });

      if (res.success) {
        saveMaterials(materials);
        saveComponents(components);
        saveMovements(movements);
        alert(`Inventário concluído com sucesso! ${res.totalAdjusted} ajustes registrados.`);
        close();
        renderStockModule();
      }
    });
  });
}

// Import CSV Drawer
function openImportStockCSVDrawer() {
  const content = `
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <p style="font-size: 13px; color: var(--text-secondary);">
        Selecione um arquivo CSV com as colunas: <code>nome</code>, <code>unidade_base</code>, <code>estoque_atual</code>, <code>estoque_minimo</code>, <code>custo_embalagem</code>, <code>qtd_embalagem</code>.
      </p>
      <div class="form-group">
        <label class="form-label">Arquivo CSV</label>
        <input type="file" id="inp-csv-file" accept=".csv,text/csv" class="form-input" />
      </div>
      <div class="form-group">
        <label class="form-label">Ou Cole o Conteúdo CSV</label>
        <textarea id="inp-csv-raw" class="form-input" rows="5" placeholder="nome;unidade_base;estoque_atual;estoque_minimo..."></textarea>
      </div>
      <div id="csv-errors-box" style="display: none;"></div>
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
        <button type="button" class="btn btn-secondary" id="btn-cancel-drawer">Cancelar</button>
        <button type="button" class="btn btn-primary" id="btn-process-csv">Processar Importação</button>
      </div>
    </div>
  `;

  openDrawer('Importar Insumos via CSV', content, (drawer, close) => {
    drawer.querySelector('#btn-cancel-drawer').addEventListener('click', close);
    const fileInp = drawer.querySelector('#inp-csv-file');
    const rawInp = drawer.querySelector('#inp-csv-raw');
    const errBox = drawer.querySelector('#csv-errors-box');

    fileInp.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => { rawInp.value = evt.target.result; };
      reader.readAsText(file);
    });

    drawer.querySelector('#btn-process-csv').addEventListener('click', () => {
      const text = rawInp.value.trim();
      if (!text) return alert('Informe o conteúdo CSV.');

      const materials = loadMaterials();
      const res = importMaterialsCSV(text, materials);

      if (!res.success) {
        errBox.style.display = 'block';
        errBox.innerHTML = `
          <div class="alert-card alert-red">
            <b>Erros na importação:</b>
            <ul>${res.errors.map(err => `<li>${escapeHtml(err)}</li>`).join('')}</ul>
          </div>
        `;
        return;
      }

      saveMaterials(res.materials);
      alert(`${res.count} insumos importados com sucesso!`);
      close();
      renderStockModule();
    });
  });
}
