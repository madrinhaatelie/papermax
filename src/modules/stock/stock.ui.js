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
  getCategories, 
  createCategory, 
  getSubcategories, 
  createSubcategory 
} from '../categories/categories.js';
import { 
  exportMaterialsCSV, importMaterialsCSV,
  exportComponentsCSV,
  exportSuppliersCSV, importSuppliersCSV,
  exportMovementsCSV
} from './stock.csv.js';
import { escapeHtml, generateId, formatNumberXX, formatDateBR, formatPhone } from '../../utils/sanitize.js';
import { showConfirmDialog } from '../orders/orders.ui.js';
import { showToast } from '../../core/events.js';

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
        <button class="btn btn-primary" id="btn-quick-new-item">+ Novo Insumo</button>
      </div>
    </div>

    <!-- Stock Navigation Tabs Bar (Divisórias de Fichário Horizontais Padrão Global) -->
    <div class="stock-tab-bar" style="display: flex; gap: 4px; margin: 16px 0 20px 0; border-bottom: 2px solid #cbd5e1; padding-bottom: 0; overflow-x: auto; align-items: flex-end;">
      ${[
        { id: 'visao_geral', label: '📊 Visão Geral' },
        { id: 'materiais', label: '📦 Materiais' },
        { id: 'movimentacoes', label: '🔄 Movimentações' },
        { id: 'inventario', label: '📋 Inventário' },
        { id: 'alertas', label: '🚨 Alertas' },
        { id: 'fornecedores', label: '🏢 Fornecedores & Compras' }
      ].map(tab => {
        const isActive = currentStockSubTab === tab.id;
        return `
          <button class="tab-btn ${isActive ? 'active' : ''}" data-stock-tab="${tab.id}">
            ${tab.label}
          </button>
        `;
      }).join('')}
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
    <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
      <button class="btn btn-secondary" onclick="window.print()" style="font-size: 12px;">🖨️ Relatório / Exportar PDF</button>
    </div>

    <!-- Mini Card de Valor Imobilizado -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 320px)); gap: 12px; margin-bottom: 20px;">
      <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px 18px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
        <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted);">Valor Imobilizado em Estoque</span>
        <b style="font-size: 24px; font-weight: 800; color: var(--text-primary);">R$ ${(Number(s.totalStockValue) || 0).toFixed(2).replace('.', ',')}</b>
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

    <!-- Tabela Rápida de Materiais com LED Intenso e 3 Pontinhos -->
    <div class="panel" style="padding-top: 8px;">
      <div class="table-container" style="overflow-x: auto;">
        <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border-subtle); text-align: left;">
              <th style="padding: 10px 8px;">Material / Componente</th>
              <th style="padding: 10px 8px;">Tipo</th>
              <th style="padding: 10px 8px;">Disponível</th>
              <th style="padding: 10px 8px; text-align: right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${balanceData.all.slice(0, 15).map(item => {
              const isCrit = item.alertBadge === 'red';
              const isWarn = item.alertBadge === 'yellow' || item.alertBadge === 'orange';
              const ledColor = isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#22c55e';
              const ledGlow = isCrit ? '0 0 10px rgba(239, 68, 68, 0.95), 0 0 4px #dc2626' : isWarn ? '0 0 10px rgba(245, 158, 11, 0.95), 0 0 4px #d97706' : '0 0 10px rgba(34, 197, 94, 0.95), 0 0 4px #16a34a';

              return `
                <tr style="border-bottom: 1px solid var(--border-subtle); cursor: pointer;" class="btn-open-item-summary" data-id="${item.id}" data-type="${item.type}">
                  <td style="padding: 10px 8px; font-weight: 600;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <span style="display: inline-block; width: 9px; height: 9px; min-width: 9px; border-radius: 50%; background: ${ledColor}; box-shadow: ${ledGlow};" title="Status: ${escapeHtml(item.alertLabel)}"></span>
                      <span>${escapeHtml(item.name)}</span>
                    </div>
                  </td>
                  <td style="padding: 10px 8px;">
                    <span class="badge-count" style="font-size: 11px;">${item.type === 'insumo' ? 'Insumo' : 'Componente'}</span>
                  </td>
                  <td style="padding: 10px 8px; font-weight: 700; color: ${item.availableStock < 0 ? 'var(--status-red-text)' : 'inherit'};">
                    ${formatNumberXX(item.availableStock)}
                  </td>
                  <td style="padding: 10px 8px; text-align: right;" onclick="event.stopPropagation();">
                    <button class="btn btn-secondary btn-mat-summary-btn" data-id="${item.id}" data-type="${item.type}" style="padding: 4px 8px; font-size: 16px; line-height: 1; border-radius: 6px;" title="Ver Resumo Completo">
                      ⋮
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 2. Materiais (Insumos, Reposição/Maquinário & Componentes)
function renderMaterialsTab(balanceData, materials, components, suppliers) {
  const producaoList = balanceData.materials.filter(m => m.category !== 'reposicao');
  const reposicaoList = balanceData.materials.filter(m => m.category === 'reposicao');
  const componentesList = balanceData.components;

  let list = producaoList;
  if (materialsSubFilter === 'reposicao') list = reposicaoList;
  else if (materialsSubFilter === 'componentes') list = componentesList;
  else if (materialsSubFilter === 'todos') list = balanceData.all;

  return `
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; border-bottom: 2px solid #cbd5e1; padding-bottom: 0;">
      <!-- Categorias / Filtros de Insumos (Divisórias de Fichário Horizontais) -->
      <div style="display: flex; gap: 4px; overflow-x: auto; align-items: flex-end;">
        <button class="tab-btn ${materialsSubFilter === 'insumos' ? 'active' : ''}" id="btn-sub-insumos">
          🌿 Insumos de Produção
        </button>
        <button class="tab-btn ${materialsSubFilter === 'reposicao' ? 'active' : ''}" id="btn-sub-reposicao">
          ⚙️ Reposição & Maquinário
        </button>
        <button class="tab-btn ${materialsSubFilter === 'componentes' ? 'active' : ''}" id="btn-sub-componentes">
          🧩 Componentes Fabricados
        </button>
        <button class="tab-btn ${materialsSubFilter === 'todos' ? 'active' : ''}" id="btn-sub-todos">
          📦 Todos
        </button>
      </div>

      <div style="display: flex; gap: 8px; margin-bottom: 6px;">
        <button class="btn btn-secondary" onclick="window.print()" style="font-size: 12px;">🖨️ PDF</button>
        <button class="btn btn-primary" id="btn-new-stock-item" style="font-weight: 700;">
          + Novo
        </button>
      </div>
    </div>

    <div class="panel" style="padding: 0; background: transparent; border: none; box-shadow: none;">
        <div class="list-group" style="display: flex; flex-direction: column; gap: 8px;">
            ${list.length === 0 ? `
              <div style="text-align: center; padding: 28px; background: var(--bg-surface); border: 1px dashed var(--border-subtle); border-radius: 8px; color: var(--text-muted); font-size: 13px;">
                Nenhum item encontrado nesta categoria.
              </div>
            ` : list.map(item => {
              const statusClass = `status-${item.alertBadge || 'neutral'}`;
              const isRep = item.category === 'reposicao';
              const isComp = item.type === 'component' || item.type === 'componente';

              return `
                <div class="list-row ${statusClass}">
                  <div class="list-main" style="cursor: pointer;" data-action="view-material-summary" data-id="${item.id}" data-type="${item.type}">
                    <div class="list-title" style="display: flex; align-items: center; gap: 8px;">
                      <span>${escapeHtml(item.name)}</span>
                      ${isComp ? '<span class="badge-count" style="background: #fdf2f8; color: #db2777; font-size: 10px;">🧩 Componente Fabricado</span>' : ''}
                      ${isRep ? '<span class="badge-count" style="background: #e0f2fe; color: #0369a1; font-size: 10px;">⚙️ Reposição / Máquina</span>' : ''}
                      ${!isComp && !isRep ? '<span class="badge-count" style="background: #f1f5f9; color: #475569; font-size: 10px;">🌿 Insumo</span>' : ''}
                    </div>
                  </div>
                  <div style="text-align: right; min-width: 130px;">
                      <span style="font-weight: 700; font-size: 13px;">${formatNumberXX(item.availableStock)}</span>
                      <div style="font-size: 11px; color: var(--text-muted);">Disponível</div>
                  </div>
                  <div class="actions">
                      <button class="action-btn btn-secondary btn-mat-summary-btn" data-id="${item.id}" data-type="${item.type}" style="padding: 4px 8px; font-size: 14px; line-height: 1; border-radius: 6px;" title="Ações">⋮</button>
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
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-secondary" id="btn-export-movements-pdf">🖨️ Relatório / Exportar PDF</button>
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
              <div class="list-row ${statusClass} btn-open-movement-summary" data-id="${m.id}" style="cursor: pointer;" title="Clique para ver resumo">
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
                  <span style="font-weight: 700; font-size: 13px; color: ${isEntry ? '#10b981' : '#ef4444'};">${isEntry ? '+' : '-'}${formatNumberXX(m.quantity)} ${m.unit}</span>
                  <div style="font-size: 11px; color: var(--text-muted);">Estoque: ${formatNumberXX(m.previousStock)} ➔ <b>${formatNumberXX(m.newStock)}</b></div>
                </div>
                <div class="actions" onclick="event.stopPropagation();">
                  <button class="action-btn btn-secondary btn-movement-summary-btn" data-id="${m.id}" style="padding: 4px 8px; font-size: 14px;">⋮</button>
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
  const inventories = loadInventories() || [];
  return `
    <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
      <button class="btn btn-secondary" onclick="window.print()" style="font-size: 12px;">🖨️ Relatório / Exportar PDF</button>
    </div>

    <div class="panel" style="margin-bottom: 16px;">
      <div class="panel-header">
        <div>
          <h3 class="panel-title">Sessão de Contagem & Inventário Físico</h3>
        </div>
        <button class="btn btn-primary" id="btn-start-inventory-session">Iniciar Nova Conferência</button>
      </div>
      <div id="active-inventory-container" style="margin-top: 16px;">
        <p style="font-size: 13px; color: var(--text-secondary);">
          Clique em <b>Iniciar Nova Conferência</b> para preencher a contagem física das prateleiras e sincronizar divergências automaticamente.
        </p>
      </div>
    </div>

    <!-- Histórico de Inventários Concluídos -->
    <div class="panel">
      <div class="panel-header" style="margin-bottom: 12px;">
        <h4 style="font-size: 14px; font-weight: 700;">Histórico de Conferências Realizadas</h4>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${inventories.length === 0 ? `
          <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px;">
            Nenhum inventário concluído registrado no histórico.
          </div>
        ` : inventories.map(inv => `
          <div style="border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px; background: #fff;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div>
                <b>${escapeHtml(inv.code || 'Inventário')}</b>
                <span style="font-size: 11px; color: var(--text-muted); margin-left: 8px;">Operador: ${escapeHtml(inv.operator || 'Auditor')}</span>
              </div>
              <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">
                Data/Hora: ${inv.completedAt ? new Date(inv.completedAt).toLocaleString('pt-BR') : '-'}
              </span>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">
              Ajustes Aplicados: <b>${(inv.adjustments || []).length}</b> itens alterados
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              ${(inv.adjustments || []).map(adj => `
                <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 6px 10px; background: #fdf2f2; border: 1px solid #fecaca; border-radius: 4px;">
                  <span style="font-weight: 600; color: #991b1b;">${escapeHtml(adj.name || adj.materialName || 'Item')}</span>
                  <span style="font-weight: 700; color: #ef4444;">
                    Sistema: ${formatNumberXX(adj.previousStock)} ➔ Físico: ${formatNumberXX(adj.newStock)} (${adj.diff > 0 ? '+' : ''}${formatNumberXX(adj.diff)})
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// 5. Alertas & Reposição Sugerida
function renderAlertsTab(balanceData) {
  const critical = balanceData.all.filter(i => i.alertType !== 'normal');

  return `
    <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
      <button class="btn btn-secondary" onclick="window.print()" style="font-size: 12px;">🖨️ Relatório / Exportar PDF</button>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div>
          <h3 class="panel-title">🚨 Painel de Alertas & Reposição</h3>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 16px;">
        ${critical.length === 0 ? `
          <div class="alert-card alert-green">
            <div class="alert-title">✓ Todos os materiais estão com estoque regular!</div>
            <div class="alert-desc">Nenhum insumo ou componente está abaixo do mínimo ou insuficiente para os pedidos em fila.</div>
          </div>
        ` : ''}
        ${critical.map(item => {
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

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; margin-top: 10px; background: rgba(0,0,0,0.03); padding: 8px 12px; border-radius: 6px;">
                  <div>
                    <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Estoque Atual</div>
                    <div style="font-size: 13px; font-weight: 700; color: ${item.currentStock <= 0 ? '#dc2626' : 'var(--text-primary)'};">
                      ${formatNumberXX(item.currentStock)} ${item.baseUnit}
                    </div>
                  </div>
                  <div>
                    <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Mínimo / Necessário</div>
                    <div style="font-size: 13px; font-weight: 700;">
                      ${formatNumberXX(item.minStock)} ${item.baseUnit}
                    </div>
                  </div>
                  <div>
                    <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Qtd Sugerida Compra</div>
                    <div style="font-size: 13px; font-weight: 800; color: #4338ca;">
                      + ${formatNumberXX(suggestedQty)} ${item.baseUnit}
                    </div>
                  </div>
                </div>

                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 6px;">
                  Comprometido em pedidos: <b>${formatNumberXX(item.committedStock)} ${item.baseUnit}</b> | 
                  Disponível real: <b style="color: ${item.availableStock < 0 ? '#dc2626' : 'inherit'};">${formatNumberXX(item.availableStock)} ${item.baseUnit}</b>
                </div>
              </div>

              <div>
                <button class="btn btn-primary btn-quick-buy" data-id="${item.id}" data-type="${item.type}" data-name="${escapeHtml(item.name)}" data-suggested-qty="${suggestedQty}" data-unit="${item.baseUnit}" style="white-space: nowrap; font-weight: 600;">
                  🛒 Comprar o que falta (+${formatNumberXX(suggestedQty)} ${item.baseUnit})
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
        <button class="btn ${suppliersSubTab === 'fornecedores' ? 'btn-primary' : 'btn-secondary'}" data-sup-tab="fornecedores">🏢 Fornecedores</button>
        <button class="btn ${suppliersSubTab === 'compras' ? 'btn-primary' : 'btn-secondary'}" data-sup-tab="compras">🛒 Ordens de Compra</button>
        <button class="btn ${suppliersSubTab === 'comparativo' ? 'btn-primary' : 'btn-secondary'}" data-sup-tab="comparativo">⚖ Comparativo de Preços</button>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-secondary" onclick="window.print()" style="font-size: 12px;">🖨️ PDF</button>
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
        <div class="list-row status-neutral btn-open-supplier-summary" data-id="${s.id}" style="cursor: pointer;" title="Clique para ver resumo">
          <div class="list-main" data-action="edit-supplier" data-id="${s.id}">
            <div class="list-title" style="display: flex; align-items: center; gap: 8px;">
              ${escapeHtml(s.name)}
              ${s.companyName ? `<span style="font-size: 11px; color: var(--text-secondary); font-weight: normal;">• ${escapeHtml(s.companyName)}</span>` : ''}
            </div>
            <div class="list-meta">
              Contato: ${escapeHtml(s.contact || '-')} · Tel: ${escapeHtml(formatPhone(s.phone) || '-')} · Email: ${escapeHtml(s.email || '-')}
            </div>
          </div>
          <div style="text-align: right; min-width: 120px;">
              ${s.storeUrl ? `<a href="${escapeHtml(s.storeUrl)}" target="_blank" style="font-weight: 600; font-size: 11px; color: var(--accent-primary); text-decoration: none;" onclick="event.stopPropagation();">Loja ↗</a>` : ''}
          </div>
          <div class="actions" onclick="event.stopPropagation();">
              <button class="action-btn btn-secondary btn-supplier-summary-btn" data-id="${s.id}" style="padding: 4px 8px; font-size: 14px;" title="Ações">⋮</button>
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
        const isReceived = p.status === 'recebido' || p.status === 'recebida';
        const statusClass = isReceived ? 'status-green' : 'status-blue';
        return `
        <div class="list-row ${statusClass} btn-open-purchase-summary" data-id="${p.id}" style="cursor: pointer;" title="Clique para ver resumo">
          <div class="list-main">
            <div class="list-title" style="display: flex; align-items: center; gap: 8px;">
              ${escapeHtml(p.code || p.id)}
              <span style="font-size: 11px; color: var(--text-secondary); font-weight: normal;">• ${escapeHtml(p.supplierName || 'Fornecedor')}</span>
            </div>
            <div class="list-meta">
              Data: ${new Date(p.date || p.createdAt).toLocaleDateString('pt-BR')} · Itens: ${(p.items || []).length} ${p.hasDamage === 'sim' ? '· ⚠️ Avariada' : ''}
            </div>
          </div>
          <div style="text-align: right; min-width: 120px;">
              <span style="font-weight: 700; font-size: 13px;">R$ ${(Number(p.totalAmount) || 0).toFixed(2).replace('.', ',')}</span>
              <div style="font-size: 11px; color: var(--text-muted);">${isReceived ? '✓ Recebido' : '⏳ Em Trânsito'}</div>
          </div>
          <div class="actions" onclick="event.stopPropagation();">
              <button class="action-btn btn-secondary btn-purchase-summary-btn" data-id="${p.id}" style="padding: 4px 8px; font-size: 14px;" title="Ações">⋮</button>
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
      <h4 style="font-size: 14px; font-weight: 700;">⚖ Comparativo de Preços</h4>
      <p style="font-size: 12px; color: var(--text-secondary);">Lista de insumos cadastrados. Clique em qualquer insumo para consultar o ranking de preços.</p>
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${comparisons.length === 0 ? `
        <div style="text-align: center; padding: 32px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; color: var(--text-secondary);">
          Nenhum insumo disponível para comparativo.
        </div>
      ` : comparisons.map(group => `
        <div class="btn-open-comp-group" data-name="${escapeHtml(group.name)}" style="border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 16px; cursor: pointer; background: #fff; display: flex; justify-content: space-between; align-items: center; transition: all 0.15s ease;" title="Clique para consultar comparativo">
          <div style="font-weight: 700; font-size: 14px; color: var(--text-primary);">
            ${escapeHtml(group.name)}
          </div>
          <div style="font-size: 12px; color: var(--accent-primary); font-weight: 600;">
            Ver Comparativo ↗
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
  const btnReposicao = container.querySelector('#btn-sub-reposicao');
  if (btnReposicao) {
    btnReposicao.addEventListener('click', () => {
      materialsSubFilter = 'reposicao';
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
  const btnTodos = container.querySelector('#btn-sub-todos');
  if (btnTodos) {
    btnTodos.addEventListener('click', () => {
      materialsSubFilter = 'todos';
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
  const btnNewStockItem = container.querySelector('#btn-new-stock-item');
  if (btnNewStockItem) {
    btnNewStockItem.addEventListener('click', () => {
      const defaultType = materialsSubFilter === 'componentes' ? 'component' : 'material';
      const defaultCategory = materialsSubFilter === 'reposicao' ? 'reposicao' : 'producao';
      openStockItemDrawer({ itemType: defaultType, suppliers, materials, defaultCategory });
    });
  }

  const btnNewMat = container.querySelector('#btn-new-material');
  if (btnNewMat) btnNewMat.addEventListener('click', () => openStockItemDrawer({ itemType: 'material', suppliers, materials, defaultCategory: 'producao' }));

  const btnNewMatRep = container.querySelector('#btn-new-material-rep');
  if (btnNewMatRep) btnNewMatRep.addEventListener('click', () => openStockItemDrawer({ itemType: 'material', suppliers, materials, defaultCategory: 'reposicao' }));

  const btnNewComp = container.querySelector('#btn-new-component');
  if (btnNewComp) btnNewComp.addEventListener('click', () => openStockItemDrawer({ itemType: 'component', suppliers, materials }));

  const btnNewSup = container.querySelector('#btn-new-supplier');
  if (btnNewSup) btnNewSup.addEventListener('click', () => openSupplierDrawer(null));

  const btnNewPur = container.querySelector('#btn-new-purchase');
  if (btnNewPur) btnNewPur.addEventListener('click', () => openPurchaseDrawer(null, suppliers, materials));

  const btnQuickNew = container.querySelector('#btn-quick-new-item');
  if (btnQuickNew) {
    btnQuickNew.addEventListener('click', () => {
      const defaultType = materialsSubFilter === 'componentes' ? 'component' : 'material';
      const defaultCategory = materialsSubFilter === 'reposicao' ? 'reposicao' : 'producao';
      openStockItemDrawer({ itemType: defaultType, suppliers, materials, defaultCategory });
    });
  }

  const btnManualMov = container.querySelector('#btn-new-manual-movement');
  if (btnManualMov) btnManualMov.addEventListener('click', () => openManualMovementDrawer(materials, components));

  // Supplier edit/view/del/dup
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
      const id = btn.getAttribute('data-id');
      const s = suppliers.find(x => x.id === id);
      if (s) {
        const list = loadSuppliers();
        list.push({ ...s, id: generateId('sup'), name: `${s.name} (Cópia)` });
        saveSuppliers(list);
        renderStockModule();
      }
    });
  });

  container.querySelectorAll('[data-action="del-supplier"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const s = suppliers.find(x => x.id === id);
      if (s) {
        showConfirmDialog({
          title: 'Excluir Fornecedor',
          message: `Deseja realmente excluir o fornecedor <b>${escapeHtml(s.name)}</b>?`,
          confirmText: 'Excluir',
          isDanger: true,
          onConfirm: () => {
            let list = loadSuppliers();
            list = list.filter(x => x.id !== id);
            saveSuppliers(list);
            renderStockModule();
          }
        });
      }
    });
  });

  // Purchase edit/view/del/dup
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
      const id = btn.getAttribute('data-id');
      const p = purchases.find(x => x.id === id);
      if (p) {
        const list = loadPurchases();
        list.push({
          ...p,
          id: generateId('pur'),
          code: `${p.code || 'COM'}-DUP`,
          date: new Date().toISOString(),
          status: 'pedida'
        });
        savePurchases(list);
        renderStockModule();
      }
    });
  });

  container.querySelectorAll('[data-action="del-purchase"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const p = purchases.find(x => x.id === id);
      if (p) {
        showConfirmDialog({
          title: 'Excluir Ordem de Compra',
          message: `Deseja realmente excluir a ordem de compra <b>${escapeHtml(p.code || p.id)}</b>?`,
          confirmText: 'Excluir',
          isDanger: true,
          onConfirm: () => {
            let list = loadPurchases();
            list = list.filter(x => x.id !== id);
            savePurchases(list);
            renderStockModule();
          }
        });
      }
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
      const id = btn.getAttribute('data-id');
      const type = btn.getAttribute('data-type') || 'insumo';
      if (type === 'componente' || type === 'component') {
        const comps = loadComponents();
        const comp = comps.find(c => c.id === id);
        if (comp) {
          comps.push({ ...comp, id: generateId('comp'), name: `${comp.name} (Cópia)` });
          saveComponents(comps);
          renderStockModule();
        }
      } else {
        const mats = loadMaterials();
        const mat = mats.find(m => m.id === id);
        if (mat) {
          mats.push({ ...mat, id: generateId('mat'), name: `${mat.name} (Cópia)` });
          saveMaterials(mats);
          renderStockModule();
        }
      }
    });
  });

  // Delete Material
  container.querySelectorAll('[data-action="del-material"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const type = btn.getAttribute('data-type') || 'insumo';
      showConfirmDialog({
        title: 'Excluir Item do Estoque',
        message: 'Tem certeza que deseja excluir este item? Esta ação é irreversível.',
        confirmText: 'Excluir',
        isDanger: true,
        onConfirm: () => {
          if (type === 'componente' || type === 'component') {
            let comps = loadComponents();
            comps = comps.filter(c => c.id !== id);
            saveComponents(comps);
          } else {
            let mats = loadMaterials();
            mats = mats.filter(m => m.id !== id);
            saveMaterials(mats);
          }
          renderStockModule();
        }
      });
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



  // Quick Buy Action from Alerts / Stock items
  container.querySelectorAll('.btn-quick-buy').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const suggestedQty = Number(btn.getAttribute('data-suggested-qty')) || 1;
      const unit = btn.getAttribute('data-unit') || 'un';
      openPurchaseDrawer(null, suppliers, materials, { materialId: id, quantity: suggestedQty, unit });
    });
  });

  // Row Click -> Open Material Summary Drawer
  container.querySelectorAll('.list-row, [data-action="view-material-summary"]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.actions') || e.target.closest('button') || e.target.closest('.btn-mat-summary-btn') || e.target.closest('.btn-quick-buy')) {
        return;
      }
      const row = el.closest('.list-row') || el;
      const id = row.getAttribute('data-id') || el.getAttribute('data-id');
      const item = balanceData.all.find(it => it.id === id);
      if (item) {
        openMaterialSummaryDrawer(item, balanceData, materials, components, orders, purchases, suppliers, products);
      }
    });
  });

  // 3-Dots Summary & Action Menu
  container.querySelectorAll('.btn-mat-summary-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = el.getAttribute('data-id');
      const type = el.getAttribute('data-type');
      const item = balanceData.all.find(it => it.id === id);
      if (!item) return;

      openContextMenu(e, [
        { label: '📄 Ver Resumo / Detalhes', icon: '📄', action: () => openMaterialSummaryDrawer(item, balanceData, materials, components, orders, purchases, suppliers, products) },
        { label: '✏️ Editar', icon: '✏️', action: () => {
            if (item.type === 'componente' || item.type === 'component') {
              const comp = components.find(c => c.id === id);
              openComponentDrawer(comp, materials);
            } else {
              const mat = materials.find(m => m.id === id);
              openMaterialDrawer(mat, suppliers);
            }
          }
        },
        { label: '📋 Duplicar', icon: '📋', action: () => {
            if (item.type === 'componente' || item.type === 'component') {
              const comps = loadComponents();
              const comp = comps.find(c => c.id === id);
              if (comp) {
                const dup = { ...comp, id: generateId('comp'), name: `${comp.name} (Cópia)` };
                comps.push(dup);
                saveComponents(comps);
                renderStockModule();
              }
            } else {
              const mats = loadMaterials();
              const mat = mats.find(m => m.id === id);
              if (mat) {
                const dup = { ...mat, id: generateId('mat'), name: `${mat.name} (Cópia)` };
                mats.push(dup);
                saveMaterials(mats);
                renderStockModule();
              }
            }
          }
        },
        { label: '🗑️ Excluir', icon: '🗑️', danger: true, action: () => {
            showConfirmDialog({
              title: 'Excluir Item',
              message: `Deseja realmente excluir "<b>${escapeHtml(item.name)}</b>"?`,
              confirmText: 'Excluir',
              isDanger: true,
              onConfirm: () => {
                if (item.type === 'componente' || item.type === 'component') {
                  let comps = loadComponents();
                  comps = comps.filter(c => c.id !== id);
                  saveComponents(comps);
                } else {
                  let mats = loadMaterials();
                  mats = mats.filter(m => m.id !== id);
                  saveMaterials(mats);
                }
                renderStockModule();
              }
            });
          }
        }
      ]);
    });
  });

  // Movement Action Menu
  container.querySelectorAll('.btn-movement-summary-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = el.getAttribute('data-id');
      const m = movements.find(x => x.id === id);
      if (!m) return;

      openContextMenu(e, [
        { label: '📄 Ver Resumo', icon: '📄', action: () => openMovementSummaryDrawer(m) },
        { label: '🗑️ Excluir Registro', icon: '🗑️', danger: true, action: () => {
            showConfirmDialog({
              title: 'Excluir Registro de Movimentação',
              message: 'Deseja excluir este registro de movimentação?',
              confirmText: 'Excluir',
              isDanger: true,
              onConfirm: () => {
                let list = loadMovements();
                list = list.filter(x => x.id !== id);
                saveMovements(list);
                renderStockModule();
              }
            });
          }
        }
      ]);
    });
  });

  // Supplier Action Menu
  container.querySelectorAll('.btn-supplier-summary-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = el.getAttribute('data-id');
      const s = suppliers.find(x => x.id === id);
      if (!s) return;

      openContextMenu(e, [
        { label: '📄 Ver Resumo', icon: '📄', action: () => openSupplierSummaryDrawer(s, purchases) },
        { label: '✏️ Editar', icon: '✏️', action: () => openSupplierDrawer(s) },
        { label: '📋 Duplicar', icon: '📋', action: () => {
            const list = loadSuppliers();
            const dup = {
              ...s,
              id: generateId('sup'),
              name: `${s.name} (Cópia)`
            };
            list.push(dup);
            saveSuppliers(list);
            renderStockModule();
          }
        },
        { label: '🗑️ Excluir', icon: '🗑️', danger: true, action: () => {
            showConfirmDialog({
              title: 'Excluir Fornecedor',
              message: `Deseja excluir o fornecedor <b>${escapeHtml(s.name)}</b>?`,
              confirmText: 'Excluir',
              isDanger: true,
              onConfirm: () => {
                let list = loadSuppliers();
                list = list.filter(x => x.id !== id);
                saveSuppliers(list);
                renderStockModule();
              }
            });
          }
        }
      ]);
    });
  });

  // Purchase Action Menu
  container.querySelectorAll('.btn-purchase-summary-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = el.getAttribute('data-id');
      const p = purchases.find(x => x.id === id);
      if (!p) return;

      const isReceived = p.status === 'recebido' || p.status === 'recebida';
      const menuOptions = [
        { label: '📄 Ver Resumo', icon: '📄', action: () => openPurchaseSummaryDrawer(p, suppliers, materials) },
      ];

      if (!isReceived) {
        menuOptions.push({
          label: '📥 Receber', icon: '📥', action: () => {
            showConfirmDialog({
              title: 'Confirmar Recebimento de Compra',
              message: `Confirmar o recebimento da Compra <b>${escapeHtml(p.code || p.id)}</b>? O estoque físico dos itens será atualizado.`,
              confirmText: 'Confirmar Recebimento',
              isDanger: false,
              onConfirm: () => {
                const res = receivePurchase(p, { materials, components, movements, operator: 'Almoxarife' });
                if (res.success) {
                  savePurchases(purchases);
                  saveMaterials(materials);
                  saveComponents(components);
                  saveMovements(movements);
                  renderStockModule();
                }
              }
            });
          }
        });
      }

      menuOptions.push(
        { label: '✏️ Editar', icon: '✏️', action: () => openPurchaseDrawer(p, suppliers, materials) },
        { label: '📋 Duplicar', icon: '📋', action: () => {
            const list = loadPurchases();
            const dup = {
              ...p,
              id: generateId('pur'),
              code: `${p.code || 'COM'}-DUP`,
              date: new Date().toISOString(),
              status: 'pedida'
            };
            list.push(dup);
            savePurchases(list);
            renderStockModule();
          }
        },
        { label: '🗑️ Excluir', icon: '🗑️', danger: true, action: () => {
            showConfirmDialog({
              title: 'Excluir Ordem de Compra',
              message: `Deseja excluir a ordem de compra <b>${escapeHtml(p.code || p.id)}</b>?`,
              confirmText: 'Excluir',
              isDanger: true,
              onConfirm: () => {
                let list = loadPurchases();
                list = list.filter(x => x.id !== id);
                savePurchases(list);
                renderStockModule();
              }
            });
          }
        }
      );

      openContextMenu(e, menuOptions);
    });
  });

  // Price Comparison Group Drawer
  container.querySelectorAll('.btn-open-comp-group').forEach(el => {
    el.addEventListener('click', () => {
      const name = el.getAttribute('data-name');
      const comparisons = compareSupplierPrices(materials, suppliers, purchases);
      const group = comparisons.find(g => g.name === name);
      if (group) openPriceComparisonGroupDrawer(group, suppliers, purchases);
    });
  });

  // Export Movements PDF / Print
  const btnExpMovPdf = container.querySelector('#btn-export-movements-pdf');
  if (btnExpMovPdf) {
    btnExpMovPdf.addEventListener('click', () => {
      window.print();
    });
  }

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

// ==========================================
// DRAWER DE RESUMO DO MATERIAL / INSUMO
// ==========================================
function openMaterialSummaryDrawer(item, balanceData, materials, components, orders, purchases, suppliers, products) {
  const isComponent = item.type === 'componente' || item.type === 'component';
  const sup = (suppliers || []).find(s => s.id === item.supplierId);

  // Status and intense LED colors
  const isCrit = item.alertBadge === 'red';
  const isWarn = item.alertBadge === 'yellow' || item.alertBadge === 'orange';
  const ledColor = isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#22c55e';
  const ledGlow = isCrit ? '0 0 10px rgba(239, 68, 68, 0.95), 0 0 4px #dc2626' : isWarn ? '0 0 10px rgba(245, 158, 11, 0.95), 0 0 4px #d97706' : '0 0 10px rgba(34, 197, 94, 0.95), 0 0 4px #16a34a';

  // Find linked products using this item in their composition (BOM)
  const linkedProducts = (products || []).filter(p => {
    if (!p.composition || !Array.isArray(p.composition)) return false;
    return p.composition.some(c => c.itemId === item.id || c.materialId === item.id || c.componentId === item.id);
  });

  // Recent purchases of this material
  const recentPurchases = (purchases || []).filter(p => {
    if (!p.items || !Array.isArray(p.items)) return false;
    return p.items.some(it => it.materialId === item.id);
  }).slice(0, 3);

  const content = `
    <div style="display: flex; flex-direction: column; gap: 16px; padding: 4px 0;">
      <!-- Header Card with LED -->
      <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px 16px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${ledColor}; box-shadow: ${ledGlow};"></span>
              <h4 style="font-size: 16px; font-weight: 800; margin: 0; color: var(--text-primary);">${escapeHtml(item.name)}</h4>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-left: 20px;">
              ${isComponent ? '🧩 Componente Fabricado' : (item.category === 'reposicao' ? '⚙️ Peça de Reposição / Maquinário' : '🌿 Insumo de Produção')} · Unidade Base: <b>${escapeHtml(item.baseUnit || 'un')}</b>
            </div>
          </div>
          <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; background: ${isCrit ? '#fee2e2' : isWarn ? '#fef3c7' : '#dcfce7'}; color: ${isCrit ? '#b91c1c' : isWarn ? '#b45309' : '#15803d'};">
            ${escapeHtml(item.alertLabel || 'Regular')}
          </span>
        </div>
      </div>

      <!-- Quick Metrics Grid -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 14px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Estoque</div>
          <div style="font-size: 18px; font-weight: 800; color: var(--text-primary); margin-top: 2px;">${formatNumberXX(item.currentStock)}</div>
        </div>
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 14px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Reservado</div>
          <div style="font-size: 18px; font-weight: 800; color: #ea580c; margin-top: 2px;">${(item.committedStock && item.committedStock > 0) ? formatNumberXX(item.committedStock) : '-'}</div>
        </div>
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 14px; border-left: 3px solid ${item.availableStock < 0 ? '#ef4444' : '#22c55e'};">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Disponível</div>
          <div style="font-size: 18px; font-weight: 800; color: ${item.availableStock < 0 ? '#ef4444' : '#15803d'}; margin-top: 2px;">${formatNumberXX(item.availableStock)}</div>
        </div>
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 14px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Alerta Mínimo</div>
          <div style="font-size: 18px; font-weight: 800; color: var(--text-secondary); margin-top: 2px;">${formatNumberXX(item.minStock || 0)}</div>
        </div>
      </div>

      <!-- Ficha Financeira & Custos -->
      <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
        <div style="font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px;">
          Informações Financeiras & Fornecedor
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
          <div>
            <span style="color: var(--text-muted);">Custo Base / un:</span>
            <div style="font-weight: 700; color: var(--text-primary); font-size: 14px;">R$ ${Number(item.unitCost || item.purchaseCost || 0).toFixed(2).replace('.', ',')} / ${escapeHtml(item.baseUnit || 'un')}</div>
          </div>
          <div>
            <span style="color: var(--text-muted);">Valor Total em Saldo:</span>
            <div style="font-weight: 700; color: #0284c7; font-size: 14px;">R$ ${(Number(item.currentStock || 0) * Number(item.unitCost || item.purchaseCost || 0)).toFixed(2).replace('.', ',')}</div>
          </div>
          <div>
            <span style="color: var(--text-muted);">Fornecedor Principal:</span>
            <div style="font-weight: 600; color: var(--text-primary);">${escapeHtml(sup?.name || item.supplierName || 'Não informado')}</div>
          </div>
          <div>
            <span style="color: var(--text-muted);">Embalagem Comercial:</span>
            <div style="font-weight: 600; color: var(--text-primary);">${formatNumberXX(item.packQuantity || 1)} ${escapeHtml(item.purchaseUnit || item.baseUnit || 'un')}</div>
          </div>
        </div>
      </div>

      <!-- Onde é Usado (Produtos Vinculados) -->
      <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
        <div style="font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span>Produtos Vinculados (Onde é Usado)</span>
          <span class="badge-count" style="font-size: 10px;">${formatNumberXX(linkedProducts.length)} produtos</span>
        </div>
        ${linkedProducts.length === 0 ? `
          <div style="font-size: 12px; color: var(--text-muted); padding: 6px 0;">Nenhum produto cadastrado utiliza este insumo ainda.</div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 6px; max-height: 160px; overflow-y: auto;">
            ${linkedProducts.map(p => {
              const compItem = (p.composition || []).find(c => c.itemId === item.id || c.materialId === item.id || c.componentId === item.id);
              const qtyPerProd = compItem?.quantity || 1;
              const unitPerProd = compItem?.unit || item.baseUnit || 'un';
              return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #f8fafc; border-radius: 6px; font-size: 12px;">
                  <span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(p.name)}</span>
                  <span style="color: var(--text-secondary); font-size: 11px;">Consome: <b>${formatNumberXX(qtyPerProd)} ${escapeHtml(unitPerProd)} / un</b></span>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- Histórico de Compras Recentes -->
      ${recentPurchases.length > 0 ? `
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
          <div style="font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">
            Compras Recentes
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${recentPurchases.map(p => `
              <div class="recent-purchase-card" data-id="${p.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: #f8fafc; border-radius: 6px; font-size: 12px; cursor: pointer; transition: background 0.2s;" title="Clique para abrir resumo da compra">
                <div>
                  <b style="color: var(--text-primary);">${escapeHtml(p.supplierName || 'Fornecedor')}</b>
                  <span style="color: var(--text-muted); font-size: 11px; margin-left: 6px;">${formatDateBR(p.date || p.createdAt)} · ${escapeHtml(p.code || '')}</span>
                </div>
                <span class="badge-count" style="font-size: 10px;">${escapeHtml(p.status || 'Recebido')}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Ações Rápidas -->
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;">
        <button class="btn btn-secondary btn-drawer-edit-item" style="flex: 1; font-size: 12px; justify-content: center;" data-id="${item.id}" data-type="${item.type}">
          ✏️ Editar Cadastro
        </button>
        <button class="btn btn-secondary btn-drawer-quick-mov" style="flex: 1; font-size: 12px; justify-content: center;" data-id="${item.id}" data-type="${item.type}">
          ➕ Ajustar Saldo
        </button>
        <button class="btn btn-primary btn-drawer-quick-buy" style="flex: 1; font-size: 12px; justify-content: center;" data-id="${item.id}" data-type="${item.type}">
          🛒 Comprar
        </button>
      </div>
    </div>
  `;

  openDrawer(`Resumo · ${item.name}`, content, (drawer, close) => {
    // Action: Edit
    drawer.querySelector('.btn-drawer-edit-item')?.addEventListener('click', () => {
      close();
      if (isComponent) {
        const comp = components.find(c => c.id === item.id);
        openComponentDrawer(comp, materials);
      } else {
        const mat = materials.find(m => m.id === item.id);
        openMaterialDrawer(mat, suppliers);
      }
    });

    // Action: Adjust / Quick movement
    drawer.querySelector('.btn-drawer-quick-mov')?.addEventListener('click', () => {
      close();
      openManualMovementDrawer(materials, components, item.id, item.type);
    });

    // Action: Quick Buy
    drawer.querySelector('.btn-drawer-quick-buy')?.addEventListener('click', () => {
      close();
      openPurchaseDrawer(null, suppliers, materials, { materialId: item.id, quantity: item.packQuantity || 1, unit: item.purchaseUnit || item.baseUnit || 'un' });
    });

    // Action: Click Recent Purchase Card to open purchase drawer
    drawer.querySelectorAll('.recent-purchase-card').forEach(card => {
      card.addEventListener('click', () => {
        const pId = card.getAttribute('data-id');
        const pObj = purchases.find(pur => pur.id === pId);
        if (pObj) {
          close();
          openPurchaseDrawer(pObj, suppliers, materials);
        }
      });
    });
  });
}

// ==========================================
// DRAWER UNIFICADO DE CADASTRO: INSUMO | COMPONENTE
// ==========================================
export function openStockItemDrawer({ item = null, itemType = 'material', suppliers = null, materials = null, defaultCategory = 'producao' } = {}) {
  const isEdit = !!item;
  const currentSuppliers = (suppliers && suppliers.length > 0) ? suppliers : loadSuppliers();
  const currentMaterials = (materials && materials.length > 0) ? materials : loadMaterials();
  const currentComponents = loadComponents();

  let activeType = itemType;
  if (isEdit) {
    const isComp = (item.type === 'componente' || item.type === 'component' || Array.isArray(item.items));
    activeType = isComp ? 'component' : 'material';
  }

  const matItem = (isEdit && activeType === 'material') ? item : null;
  const compItem = (isEdit && activeType === 'component') ? item : null;

  const itemCategory = matItem?.category || defaultCategory || 'producao';
  let compItems = compItem?.items ? JSON.parse(JSON.stringify(compItem.items)) : [];
  if (!isEdit && compItems.length === 0 && currentMaterials.length > 0) {
    compItems.push({ materialId: currentMaterials[0].id, quantity: 1, unit: currentMaterials[0].baseUnit || 'un' });
  }

  const drawerTitle = isEdit 
    ? (activeType === 'component' 
        ? `Editar Componente · ${escapeHtml(item.name)}` 
        : (itemCategory === 'reposicao' ? `Editar Maquinário · ${escapeHtml(item.name)}` : `Editar Insumo · ${escapeHtml(item.name)}`))
    : '+ Novo Item';

  const content = `
    <div style="display: flex; flex-direction: column; gap: 14px;">
      
      <!-- SELETOR DE TIPO: INSUMO | COMPONENTE -->
      <div style="background: #f8fafc; border: 1.5px solid var(--border-subtle); border-radius: 8px; padding: 10px 12px;">
        <div style="font-weight: 700; color: var(--text-primary); font-size: 13px; margin-bottom: 8px;">
          TIPO DE CADASTRO *
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <label id="lbl-type-material" style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 12px; border: 2px solid ${activeType === 'material' ? '#16a34a' : 'var(--border-subtle)'}; background: ${activeType === 'material' ? '#f0fdf4' : '#ffffff'}; border-radius: 6px; cursor: ${isEdit ? 'default' : 'pointer'}; font-weight: 700; font-size: 13px; color: ${activeType === 'material' ? '#15803d' : 'var(--text-primary)'}; transition: all 0.15s ease;">
            <input type="radio" name="stock_item_kind" id="radio-kind-material" value="material" ${activeType === 'material' ? 'checked' : ''} ${isEdit ? 'disabled' : ''} style="margin: 0; accent-color: #16a34a;" />
            <span>🌿 INSUMO</span>
          </label>

          <label id="lbl-type-component" style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 12px; border: 2px solid ${activeType === 'component' ? '#db2777' : 'var(--border-subtle)'}; background: ${activeType === 'component' ? '#fdf2f8' : '#ffffff'}; border-radius: 6px; cursor: ${isEdit ? 'default' : 'pointer'}; font-weight: 700; font-size: 13px; color: ${activeType === 'component' ? '#be185d' : 'var(--text-primary)'}; transition: all 0.15s ease;">
            <input type="radio" name="stock_item_kind" id="radio-kind-component" value="component" ${activeType === 'component' ? 'checked' : ''} ${isEdit ? 'disabled' : ''} style="margin: 0; accent-color: #db2777;" />
            <span>🧩 COMPONENTE</span>
          </label>
        </div>
      </div>

      <!-- FORMULÁRIO: INSUMO / MATÉRIA-PRIMA & MAQUINÁRIO -->
      <form id="form-stock-material" style="display: ${activeType === 'material' ? 'flex' : 'none'}; flex-direction: column; gap: 14px;">
        
        <!-- CATEGORIA: INSUMO | MAQUINÁRIO -->
        <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <span style="font-size: 12.5px; font-weight: 700; color: var(--text-primary);">CATEGORIA DO ITEM:</span>
          <div style="display: flex; gap: 14px; align-items: center;">
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">
              <input type="radio" name="inp_mat_category" id="cat-insumo" value="producao" ${itemCategory !== 'reposicao' ? 'checked' : ''} style="accent-color: #16a34a; width: 16px; height: 16px;" />
              🌿 Insumo
            </label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">
              <input type="radio" name="inp_mat_category" id="cat-maquinario" value="reposicao" ${itemCategory === 'reposicao' ? 'checked' : ''} style="accent-color: #0284c7; width: 16px; height: 16px;" />
              ⚙️ Maquinário
            </label>
          </div>
        </div>

        <!-- ============================================== -->
        <!-- CAMPOS EXCLUSIVOS QUANDO FOR: 🌿 INSUMO        -->
        <!-- ============================================== -->
        <div id="box-insumo-fields" style="display: ${itemCategory !== 'reposicao' ? 'flex' : 'none'}; flex-direction: column; gap: 14px;">
          <div class="form-group">
            <label class="form-label">Nome do Insumo *</label>
            <input class="form-input" id="inp-mat-name" ${itemCategory !== 'reposicao' ? 'required' : ''} value="${escapeHtml(matItem?.name || '')}" placeholder="Ex: Papel Kraft 180g A4, Fita de Cetim Rosa 22mm" />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label">Unidade Base *</label>
              <select class="form-input" id="inp-mat-unit">
                ${BASE_UNITS.map(u => `<option value="${u.key}" ${matItem?.baseUnit === u.key ? 'selected' : ''}>${escapeHtml(u.label)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Fornecedor</label>
              <select class="form-input" id="inp-mat-supplier">
                <option value="">Nenhum / Diversos</option>
                ${currentSuppliers.map(s => `<option value="${s.id}" ${matItem?.supplierId === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- ESTOQUE | ALERTA MÍNIMO -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">Estoque *</label>
              <input type="number" step="any" class="form-input" id="inp-mat-stock" value="${matItem?.currentStock ?? 0}" />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">Alerta Mínimo</label>
              <input type="number" step="any" class="form-input" id="inp-mat-min" value="${matItem?.minStock ?? 0}" />
            </div>
          </div>

          <!-- BLOCO DE CUSTO DE COMPRA & PRECIFICAÇÃO -->
          <div class="panel" style="background: var(--bg-surface-raised); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle);">
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 10px; color: var(--text-primary);">💰 CUSTO DE COMPRA & PRECIFICAÇÃO</div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
              <div>
                <label class="form-label" style="font-size: 11.5px; font-weight: 600;">VALOR COMPRA (R$) *</label>
                <input type="number" step="any" min="0" class="form-input" id="inp-mat-cost" value="${matItem?.purchaseCost ?? 0}" placeholder="Valor total pago" />
              </div>
              <div>
                <label class="form-label" style="font-size: 11.5px; font-weight: 600;">Qtd por Embalagem</label>
                <input type="number" step="any" min="0.0001" class="form-input" id="inp-mat-pack-qty" value="${matItem?.packQuantity ?? 1}" placeholder="Ex: 50, 100, 1" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <label class="form-label" style="font-size: 11.5px; font-weight: 600; color: #15803d;">VALOR POR UNID (Calculado)</label>
                <input type="text" class="form-input" id="inp-mat-unit-cost-display" readonly style="background: #f0fdf4; font-weight: 700; color: #15803d; border-color: #bbf7d0; cursor: default;" value="R$ 0,00" />
              </div>
              <div>
                <label class="form-label" style="font-size: 11.5px; font-weight: 600; color: #4338ca;">VALOR VENDA (R$)</label>
                <input type="number" step="any" min="0" class="form-input" id="inp-mat-sell-price" value="${matItem?.sellingPrice ?? matItem?.salePrice ?? 0}" placeholder="Valor a cobrar" style="font-weight: 600;" />
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Observações</label>
            <textarea class="form-input" id="inp-mat-notes" rows="2">${escapeHtml(matItem?.notes || '')}</textarea>
          </div>
        </div>

        <!-- ============================================== -->
        <!-- CAMPOS EXCLUSIVOS QUANDO FOR: ⚙️ MAQUINÁRIO    -->
        <!-- APENAS: NOME, VIDA UTIL, CATEGORIA,            -->
        <!-- SUBCATEGORIA, VALOR COMPRA, VALOR VENDA (AUTO) -->
        <!-- ============================================== -->
        <div id="box-maquinario-fields" style="display: ${itemCategory === 'reposicao' ? 'flex' : 'none'}; flex-direction: column; gap: 14px;">
          <!-- 1. NOME -->
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">Nome *</label>
            <input class="form-input" id="inp-maq-name" ${itemCategory === 'reposicao' ? 'required' : ''} value="${escapeHtml(matItem?.name || '')}" placeholder="Ex: Lâmina Silhouette AutoBlade, Base de Corte 30x30, Prensa Térmica" />
          </div>

          <!-- 2. VIDA UTIL -->
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">Vida Útil *</label>
            <input type="number" step="any" min="1" class="form-input" id="inp-maq-lifespan" ${itemCategory === 'reposicao' ? 'required' : ''} value="${matItem?.lifespan || matItem?.usefulLife || matItem?.packQuantity || 1000}" placeholder="Ex: 1000 (usos / cortes / folhas)" />
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Capacidade total estimada de utilizações/cortes desta peça ou equipamento.</div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <!-- 3. CATEGORIA (SELECT + CRIAR) -->
            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label class="form-label" style="font-weight: 700; margin: 0;">Categoria *</label>
                <button type="button" id="btn-add-maq-cat" style="font-size: 11.5px; color: #0284c7; font-weight: 700; cursor: pointer; background: none; border: none; padding: 0;">+ Criar</button>
              </div>
              <select class="form-input" id="inp-maq-category">
                <option value="">Selecione a Categoria...</option>
              </select>
            </div>

            <!-- 4. SUBCATEGORIA (SELECT + CRIAR) -->
            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label class="form-label" style="font-weight: 700; margin: 0;">Subcategoria</label>
                <button type="button" id="btn-add-maq-subcat" style="font-size: 11.5px; color: #0284c7; font-weight: 700; cursor: pointer; background: none; border: none; padding: 0;">+ Criar</button>
              </div>
              <select class="form-input" id="inp-maq-subcategory">
                <option value="">Selecione ou crie...</option>
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <!-- 5. VALOR COMPRA -->
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">Valor Compra (R$) *</label>
              <input type="number" step="any" min="0" class="form-input" id="inp-maq-cost" value="${matItem?.purchaseCost ?? 0}" placeholder="Valor total pago" />
            </div>

            <!-- 6. VALOR VENDA [DIVIDIR AUTOMATICAMENTE: VALOR DE COMPRA / VIDA UTIL] -->
            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label class="form-label" style="font-weight: 700; color: #4338ca; margin: 0;">Valor Venda (R$ por uso) *</label>
                <span id="maq-calc-badge" style="font-size: 10.5px; font-weight: 700; color: #15803d; background: #dcfce7; padding: 1px 6px; border-radius: 4px;">Automático</span>
              </div>
              <input type="number" step="any" min="0" class="form-input" id="inp-maq-sell-price" value="${matItem?.sellingPrice ?? matItem?.salePrice ?? 0}" placeholder="0.00" style="font-weight: 700; background: #eef2ff; color: #4338ca; border-color: #c7d2fe;" />
            </div>
          </div>
          
          <div id="maq-cost-formula-preview" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 8px 12px; font-size: 12px; color: #15803d; font-weight: 600;">
            📊 <b>Cálculo Automático:</b> Valor Compra ÷ Vida Útil
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
          <button type="button" class="btn btn-secondary btn-cancel-drawer">Cancelar</button>
          <button type="submit" id="btn-submit-mat" class="btn btn-primary" style="background: ${itemCategory === 'reposicao' ? '#0284c7' : '#16a34a'}; border-color: ${itemCategory === 'reposicao' ? '#0284c7' : '#16a34a'};">
            ${itemCategory === 'reposicao' ? 'Salvar Maquinário' : 'Salvar Insumo'}
          </button>
        </div>
      </form>

      <!-- FORMULÁRIO: COMPONENTE FABRICADO (BOM) -->
      <form id="form-stock-component" style="display: ${activeType === 'component' ? 'flex' : 'none'}; flex-direction: column; gap: 14px;">
        <div class="form-group">
          <label class="form-label">Nome do Componente *</label>
          <input class="form-input" id="inp-comp-name" required value="${escapeHtml(compItem?.name || '')}" placeholder="Ex: Flor de Cetim Rosa, Laço Duplo com Strass, Par de Alças" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label class="form-label">Rendimento por Lote</label>
            <input type="number" step="any" min="1" class="form-input" id="inp-comp-yield" required value="${compItem?.yield || 1}" />
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">Estoque *</label>
            <input type="number" step="any" min="0" class="form-input" id="inp-comp-stock" required value="${compItem?.currentStock || 0}" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">Alerta Mínimo</label>
          <input type="number" step="any" min="0" class="form-input" id="inp-comp-min" value="${compItem?.minStock || 10}" />
        </div>

        <!-- Ficha Técnica / Receita Interativa -->
        <div class="panel" style="background: var(--bg-surface-raised); padding: 12px; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
            <div>
              <div style="font-weight: 700; font-size: 13px; color: var(--text-primary);">🧩 Ficha Técnica (Insumos Consumidos)</div>
              <div style="font-size: 11px; color: var(--text-muted);">Insumos que compõem este componente.</div>
            </div>
            <button type="button" class="btn btn-secondary" id="btn-add-comp-insumo" style="font-size: 11px; padding: 4px 10px;">+ Adicionar Insumo</button>
          </div>

          <div id="comp-items-container" style="display: flex; flex-direction: column; gap: 8px;"></div>
          
          <div id="comp-cost-total" style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border-subtle); font-weight: 700; font-size: 13px; color: #be185d; text-align: right;"></div>
        </div>

        <div class="form-group">
          <label class="form-label">Observações de Fabricação</label>
          <textarea class="form-input" id="inp-comp-notes" rows="2" placeholder="Instruções de corte, montagem ou cola...">${escapeHtml(compItem?.notes || '')}</textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
          <button type="button" class="btn btn-secondary btn-cancel-drawer">Cancelar</button>
          <button type="submit" class="btn btn-primary" style="background: #db2777; border-color: #db2777;">Salvar Componente</button>
        </div>
      </form>
    </div>
  `;

  openDrawer(drawerTitle, content, (drawer, close) => {
    drawer.querySelectorAll('.btn-cancel-drawer').forEach(btn => btn.addEventListener('click', close));

    const formMat = drawer.querySelector('#form-stock-material');
    const formComp = drawer.querySelector('#form-stock-component');
    const lblMat = drawer.querySelector('#lbl-type-material');
    const lblComp = drawer.querySelector('#lbl-type-component');
    const radioMat = drawer.querySelector('#radio-kind-material');
    const radioComp = drawer.querySelector('#radio-kind-component');

    const boxInsumo = drawer.querySelector('#box-insumo-fields');
    const boxMaquinario = drawer.querySelector('#box-maquinario-fields');
    const inpMatName = drawer.querySelector('#inp-mat-name');
    const inpMaqName = drawer.querySelector('#inp-maq-name');
    const btnSubmitMat = drawer.querySelector('#btn-submit-mat');

    const catSelect = drawer.querySelector('#inp-maq-category');
    const subcatSelect = drawer.querySelector('#inp-maq-subcategory');

    const setKind = (kind) => {
      activeType = kind;
      if (kind === 'material') {
        formMat.style.display = 'flex';
        formComp.style.display = 'none';
        lblMat.style.borderColor = '#16a34a';
        lblMat.style.background = '#f0fdf4';
        lblMat.style.color = '#15803d';
        lblComp.style.borderColor = 'var(--border-subtle)';
        lblComp.style.background = '#ffffff';
        lblComp.style.color = 'var(--text-primary)';
        radioMat.checked = true;
      } else {
        formMat.style.display = 'none';
        formComp.style.display = 'flex';
        lblComp.style.borderColor = '#db2777';
        lblComp.style.background = '#fdf2f8';
        lblComp.style.color = '#be185d';
        lblMat.style.borderColor = 'var(--border-subtle)';
        lblMat.style.background = '#ffffff';
        lblMat.style.color = 'var(--text-primary)';
        radioComp.checked = true;
      }
    };

    if (!isEdit) {
      lblMat?.addEventListener('click', () => setKind('material'));
      lblComp?.addEventListener('click', () => setKind('component'));
      radioMat?.addEventListener('change', () => setKind('material'));
      radioComp?.addEventListener('change', () => setKind('component'));
    }

    // Material Cost Preview & Automatic Unit Price Calculation (for Insumos)
    const updateCostPreview = () => {
      const cost = Number(drawer.querySelector('#inp-mat-cost')?.value) || 0;
      const qty = Number(drawer.querySelector('#inp-mat-pack-qty')?.value) || 1;
      const baseUnit = drawer.querySelector('#inp-mat-unit')?.value || 'un';
      const displayInput = drawer.querySelector('#inp-mat-unit-cost-display');
      if (displayInput) {
        if (qty > 0) {
          const unitCost = cost / qty;
          displayInput.value = `R$ ${unitCost.toFixed(4).replace('.', ',')} / ${baseUnit}`;
        } else {
          displayInput.value = 'R$ 0,00';
        }
      }
    };

    drawer.querySelector('#inp-mat-cost')?.addEventListener('input', updateCostPreview);
    drawer.querySelector('#inp-mat-pack-qty')?.addEventListener('input', updateCostPreview);
    drawer.querySelector('#inp-mat-unit')?.addEventListener('change', updateCostPreview);
    updateCostPreview();

    // Machinery: Automatic Sale Price Calculation (VALOR COMPRA / VIDA UTIL)
    const updateMaqCalc = () => {
      const cost = Number(drawer.querySelector('#inp-maq-cost')?.value) || 0;
      const lifespan = Number(drawer.querySelector('#inp-maq-lifespan')?.value) || 1;
      const sellPriceInput = drawer.querySelector('#inp-maq-sell-price');
      const previewDiv = drawer.querySelector('#maq-cost-formula-preview');
      
      if (lifespan > 0) {
        const valPerUse = cost / lifespan;
        if (sellPriceInput) {
          sellPriceInput.value = Number(valPerUse.toFixed(4));
        }
        if (previewDiv) {
          previewDiv.innerHTML = `📊 <b>Cálculo Automático:</b> R$ ${cost.toFixed(2).replace('.', ',')} ÷ ${lifespan} vida útil = <b>R$ ${valPerUse.toFixed(4).replace('.', ',')} por uso</b>`;
        }
      } else {
        if (previewDiv) {
          previewDiv.innerHTML = `Informe a vida útil (maior que 0) para calcular o valor de venda por uso.`;
        }
      }
    };

    drawer.querySelector('#inp-maq-cost')?.addEventListener('input', updateMaqCalc);
    drawer.querySelector('#inp-maq-lifespan')?.addEventListener('input', updateMaqCalc);
    updateMaqCalc();

    // Machinery Categories & Subcategories Management (Select + Criar)
    const populateSubcategories = (categoryId, selectedSub = null) => {
      if (!subcatSelect) return;
      const subs = getSubcategories(categoryId);
      let targetSub = selectedSub || matItem?.subcategory || '';
      
      let html = `<option value="">(Sem subcategoria)</option>`;
      subs.forEach(s => {
        html += `<option value="${escapeHtml(s)}" ${s === targetSub ? 'selected' : ''}>${escapeHtml(s)}</option>`;
      });
      subcatSelect.innerHTML = html;
    };

    const populateCategories = (selectedId = null) => {
      let allCats = getCategories();
      if (allCats.length === 0) {
        try {
          createCategory({ name: 'Lâminas & Facas' });
          createCategory({ name: 'Bases de Corte' });
          createCategory({ name: 'Equipamentos & Máquinas' });
          allCats = getCategories();
        } catch (e) {
          // ignore duplicate
        }
      }
      
      let targetId = selectedId || matItem?.categoryId || (allCats.length > 0 ? allCats[0].id : '');
      
      if (catSelect) {
        catSelect.innerHTML = `
          <option value="">Selecione a Categoria...</option>
          ${allCats.map(c => `<option value="${c.id}" ${c.id === targetId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        `;
      }
      
      populateSubcategories(targetId, matItem?.subcategory);
    };

    catSelect?.addEventListener('change', () => {
      populateSubcategories(catSelect.value);
    });

    drawer.querySelector('#btn-add-maq-cat')?.addEventListener('click', () => {
      const name = window.prompt('Nome da nova categoria de maquinário / equipamento:');
      if (!name || !name.trim()) return;
      try {
        const created = createCategory({ name: name.trim() });
        populateCategories(created.id);
        showToast('Categoria criada com sucesso.', '✓');
      } catch (err) {
        showToast(err.message || 'Erro ao criar categoria.', '⚠️');
      }
    });

    drawer.querySelector('#btn-add-maq-subcat')?.addEventListener('click', () => {
      const catId = catSelect?.value;
      if (!catId) {
        showToast('Selecione uma categoria primeiro antes de criar uma subcategoria.', '⚠️');
        return;
      }
      const subName = window.prompt('Nome da nova subcategoria:');
      if (!subName || !subName.trim()) return;
      try {
        const createdSub = createSubcategory(catId, subName.trim());
        populateSubcategories(catId, createdSub);
        showToast('Subcategoria criada com sucesso.', '✓');
      } catch (err) {
        showToast(err.message || 'Erro ao criar subcategoria.', '⚠️');
      }
    });

    populateCategories(matItem?.categoryId);

    // Switch between 🌿 Insumo and ⚙️ Maquinário
    const switchMaterialKind = (kind) => {
      if (kind === 'reposicao') {
        if (boxInsumo) boxInsumo.style.display = 'none';
        if (boxMaquinario) boxMaquinario.style.display = 'flex';
        if (inpMatName && inpMaqName && !inpMaqName.value && inpMatName.value) {
          inpMaqName.value = inpMatName.value;
        }
        if (inpMatName) inpMatName.removeAttribute('required');
        if (inpMaqName) inpMaqName.setAttribute('required', 'required');
        if (btnSubmitMat) {
          btnSubmitMat.innerText = 'Salvar Maquinário';
          btnSubmitMat.style.background = '#0284c7';
          btnSubmitMat.style.borderColor = '#0284c7';
        }
        updateMaqCalc();
      } else {
        if (boxInsumo) boxInsumo.style.display = 'flex';
        if (boxMaquinario) boxMaquinario.style.display = 'none';
        if (inpMatName && inpMaqName && !inpMatName.value && inpMaqName.value) {
          inpMatName.value = inpMaqName.value;
        }
        if (inpMatName) inpMatName.setAttribute('required', 'required');
        if (inpMaqName) inpMaqName.removeAttribute('required');
        if (btnSubmitMat) {
          btnSubmitMat.innerText = 'Salvar Insumo';
          btnSubmitMat.style.background = '#16a34a';
          btnSubmitMat.style.borderColor = '#16a34a';
        }
        updateCostPreview();
      }
    };

    drawer.querySelector('#cat-insumo')?.addEventListener('change', () => switchMaterialKind('producao'));
    drawer.querySelector('#cat-maquinario')?.addEventListener('change', () => switchMaterialKind('reposicao'));

    // Component BOM Editor
    const compContainer = drawer.querySelector('#comp-items-container');
    const materialsMap = Object.fromEntries(currentMaterials.map(m => [m.id, m]));

    const renderCompItems = () => {
      if (!compContainer) return;
      if (compItems.length === 0) {
        compContainer.innerHTML = `
          <div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 12px; background: #ffffff; border: 1px dashed var(--border-subtle); border-radius: 6px;">
            Nenhum insumo adicionado à ficha técnica ainda.
          </div>
        `;
      } else {
        compContainer.innerHTML = compItems.map((it, idx) => `
          <div style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 6px; align-items: center; background: #ffffff; padding: 6px; border: 1px solid var(--border-subtle); border-radius: 6px;">
            <select class="form-input comp-item-mat" data-idx="${idx}" style="font-size: 12px; padding: 4px 6px;">
              ${currentMaterials.map(m => `<option value="${m.id}" ${it.materialId === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
            </select>
            <input type="number" step="any" min="0" class="form-input comp-item-qty" data-idx="${idx}" value="${it.quantity}" placeholder="Qtd" style="font-size: 12px; padding: 4px 6px;" />
            <input class="form-input comp-item-unit" data-idx="${idx}" value="${it.unit || 'un'}" placeholder="Unidade" style="font-size: 12px; padding: 4px 6px;" />
            <button type="button" class="btn-icon btn-remove-item" data-idx="${idx}" style="color: var(--status-red-text); font-weight: 700; padding: 4px 8px;" title="Remover Insumo">✕</button>
          </div>
        `).join('');
      }

      // recalculate cost preview
      const tempComp = { items: compItems, yield: Number(drawer.querySelector('#inp-comp-yield')?.value) || 1 };
      const unitCost = calculateComponentCost(tempComp, materialsMap);
      const totalBox = drawer.querySelector('#comp-cost-total');
      if (totalBox) {
        totalBox.innerHTML = `Custo Unitário de Fabricação: <b>R$ ${unitCost.toFixed(4).replace('.', ',')} / unidade</b>`;
      }

      // bind row events
      compContainer.querySelectorAll('.comp-item-mat').forEach(el => {
        el.addEventListener('change', () => {
          const idx = Number(el.getAttribute('data-idx'));
          compItems[idx].materialId = el.value;
          const mat = materialsMap[el.value];
          if (mat) compItems[idx].unit = mat.baseUnit;
          renderCompItems();
        });
      });
      compContainer.querySelectorAll('.comp-item-qty').forEach(el => {
        el.addEventListener('input', () => {
          const idx = Number(el.getAttribute('data-idx'));
          compItems[idx].quantity = Number(el.value) || 0;
          renderCompItems();
        });
      });
      compContainer.querySelectorAll('.comp-item-unit').forEach(el => {
        el.addEventListener('input', () => {
          const idx = Number(el.getAttribute('data-idx'));
          compItems[idx].unit = el.value.trim();
          renderCompItems();
        });
      });
      compContainer.querySelectorAll('.btn-remove-item').forEach(el => {
        el.addEventListener('click', () => {
          const idx = Number(el.getAttribute('data-idx'));
          compItems.splice(idx, 1);
          renderCompItems();
        });
      });
    };

    drawer.querySelector('#btn-add-comp-insumo')?.addEventListener('click', () => {
      if (currentMaterials.length === 0) {
        showToast('Cadastre ao menos um insumo primeiro.', '⚠️');
        return;
      }
      compItems.push({ materialId: currentMaterials[0].id, quantity: 1, unit: currentMaterials[0].baseUnit || 'un' });
      renderCompItems();
    });

    drawer.querySelector('#inp-comp-yield')?.addEventListener('input', renderCompItems);
    renderCompItems();

    // SUBMIT: Material (Insumo ou Maquinário)
    formMat?.addEventListener('submit', (e) => {
      e.preventDefault();
      const allMaterials = loadMaterials();
      const categoryRadio = drawer.querySelector('input[name="inp_mat_category"]:checked');
      const isMaquinario = categoryRadio ? categoryRadio.value === 'reposicao' : false;

      let itemData;

      if (isMaquinario) {
        const name = drawer.querySelector('#inp-maq-name').value.trim();
        const lifespan = Number(drawer.querySelector('#inp-maq-lifespan').value) || 1;
        const categoryId = drawer.querySelector('#inp-maq-category').value;
        const catObj = getCategories().find(c => c.id === categoryId);
        const categoryName = catObj ? catObj.name : '';
        const subcategory = drawer.querySelector('#inp-maq-subcategory').value;
        const purchaseCost = Number(drawer.querySelector('#inp-maq-cost').value) || 0;
        const calculatedSellPrice = lifespan > 0 ? (purchaseCost / lifespan) : 0;
        const sellingPrice = Number(drawer.querySelector('#inp-maq-sell-price').value) || calculatedSellPrice;

        itemData = {
          id: matItem?.id || generateId('mat'),
          name,
          category: 'reposicao',
          categoryId,
          categoryName,
          subcategory,
          lifespan,
          usefulLife: lifespan,
          baseUnit: 'uso',
          currentStock: matItem?.currentStock ?? 1,
          minStock: 0,
          purchaseCost,
          packQuantity: lifespan,
          sellingPrice,
          salePrice: sellingPrice,
          purchaseUnit: 'un',
          notes: `Vida útil: ${lifespan} usos. Categoria: ${categoryName}${subcategory ? ' / ' + subcategory : ''}`,
          updatedAt: new Date().toISOString()
        };
      } else {
        const name = drawer.querySelector('#inp-mat-name').value.trim();
        const baseUnit = drawer.querySelector('#inp-mat-unit').value;
        const supplierId = drawer.querySelector('#inp-mat-supplier').value;
        const supObj = currentSuppliers.find(s => s.id === supplierId);
        const currentStock = Number(drawer.querySelector('#inp-mat-stock').value) || 0;
        const minStock = Number(drawer.querySelector('#inp-mat-min').value) || 0;
        const purchaseCost = Number(drawer.querySelector('#inp-mat-cost').value) || 0;
        const packQuantity = Number(drawer.querySelector('#inp-mat-pack-qty').value) || 1;
        const sellingPrice = Number(drawer.querySelector('#inp-mat-sell-price').value) || 0;
        const notes = drawer.querySelector('#inp-mat-notes').value.trim();

        itemData = {
          id: matItem?.id || generateId('mat'),
          name,
          category: 'producao',
          baseUnit,
          supplierId,
          supplierName: supObj ? supObj.name : '',
          currentStock,
          minStock,
          purchaseCost,
          packQuantity,
          sellingPrice,
          salePrice: sellingPrice,
          purchaseUnit: baseUnit,
          notes,
          updatedAt: new Date().toISOString()
        };
      }

      if (isEdit) {
        const idx = allMaterials.findIndex(m => m.id === matItem.id);
        if (idx >= 0) allMaterials[idx] = { ...allMaterials[idx], ...itemData };
      } else {
        itemData.createdAt = new Date().toISOString();
        allMaterials.push(itemData);
      }

      saveMaterials(allMaterials);
      close();
      renderStockModule();
    });

    // SUBMIT: Component
    formComp?.addEventListener('submit', (e) => {
      e.preventDefault();
      const allComponents = loadComponents();
      const name = drawer.querySelector('#inp-comp-name').value.trim();
      const yieldQty = Number(drawer.querySelector('#inp-comp-yield').value) || 1;
      const currentStock = Number(drawer.querySelector('#inp-comp-stock').value) || 0;
      const minStock = Number(drawer.querySelector('#inp-comp-min').value) || 0;
      const notes = drawer.querySelector('#inp-comp-notes').value.trim();

      const compId = compItem?.id || generateId('comp');
      const componentsMap = Object.fromEntries(allComponents.map(c => [c.id, c]));
      const cycleCheck = detectCompositionCycle(compId, compItems, componentsMap);
      if (cycleCheck.hasCycle) {
        showToast(cycleCheck.message || 'Ciclo de composição detectado. Um componente não pode conter a si próprio direta ou indiretamente.', '⚠️');
        return;
      }

      const itemData = {
        id: compId,
        name,
        yield: yieldQty,
        currentStock,
        minStock,
        items: compItems,
        notes,
        updatedAt: new Date().toISOString()
      };

      if (isEdit) {
        const idx = allComponents.findIndex(c => c.id === compItem.id);
        if (idx >= 0) allComponents[idx] = { ...allComponents[idx], ...itemData };
      } else {
        itemData.createdAt = new Date().toISOString();
        allComponents.push(itemData);
      }

      saveComponents(allComponents);
      close();
      renderStockModule();
    });
  });
}

// Wrapper backward-compatible functions
export function openMaterialDrawer(material = null, suppliers = [], defaultCategory = 'producao') {
  openStockItemDrawer({ item: material, itemType: 'material', suppliers, defaultCategory });
}

export function openComponentDrawer(component = null, materials = []) {
  openStockItemDrawer({ item: component, itemType: 'component', materials });
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
            ${materials.map(m => `<option value="insumo:${m.id}" ${preselectedId === m.id ? 'selected' : ''}>${escapeHtml(m.name)} (Atual: ${formatNumberXX(m.currentStock)} ${m.baseUnit})</option>`).join('')}
          </optgroup>
          <optgroup label="Componentes">
            ${components.map(c => `<option value="componente:${c.id}" ${preselectedId === c.id ? 'selected' : ''}>${escapeHtml(c.name)} (Atual: ${formatNumberXX(c.currentStock)} un)</option>`).join('')}
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
            <input class="form-input" id="inp-sup-phone" data-mask="phone" value="${escapeHtml(formatPhone(supplier?.phone || ''))}" placeholder="(XX) 9 XXXX-XXXX" />
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
        phone: formatPhone(drawer.querySelector('#inp-sup-phone').value.trim()),
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
      if (materials.length === 0) {
        showToast('Cadastre materiais primeiro.', '⚠️');
        return;
      }
      const m = materials[0];
      items.push({ materialId: m.id, materialType: 'insumo', name: m.name, quantity: 1, unit: m.baseUnit, packCost: m.purchaseCost });
      renderItems();
    });

    renderItems();

    drawer.querySelector('#form-purchase').addEventListener('submit', (e) => {
      e.preventDefault();
      if (items.length === 0) {
        showToast('Adicione pelo menos um item à compra.', '⚠️');
        return;
      }

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
                <td style="padding: 6px;">${formatNumberXX(it.systemStock)} ${it.unit}</td>
                <td style="padding: 6px;">
                  <input type="number" step="any" class="form-input inv-count-inp" data-idx="${idx}" value="${it.physicalCount}" style="width: 90px; padding: 4px;" />
                </td>
                <td style="padding: 6px; font-weight: 700;" id="diff-cell-${idx}">00</td>
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
            ? `<span style="color: var(--text-muted);">00</span>` 
            : `<span style="color: ${diff > 0 ? 'var(--status-green-text)' : 'var(--status-red-text)'};">${diff > 0 ? '+' : ''}${formatNumberXX(diff)} ${it.unit}</span>`;
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
        showToast(`Inventário concluído com sucesso! ${res.totalAdjusted} ajustes registrados.`, '✓');
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
      if (!text) {
        showToast('Informe o conteúdo CSV.', '⚠️');
        return;
      }

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
      showToast(`${res.count} insumos importados com sucesso!`, '✓');
      close();
      renderStockModule();
    });
  });
}

// ==========================================
// SUMMARY DRAWERS & RANKING DRAWERS
// ==========================================

function openSupplierSummaryDrawer(supplier, purchases) {
  const supPurchases = purchases.filter(p => p.supplierId === supplier.id);
  const content = `
    <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;">
      <div style="background: var(--bg-surface-raised); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
        <h4 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">${escapeHtml(supplier.name)}</h4>
        ${supplier.companyName ? `<div style="color: var(--text-secondary); margin-bottom: 4px;">Razão Social: <b>${escapeHtml(supplier.companyName)}</b></div>` : ''}
        ${supplier.contact ? `<div style="color: var(--text-secondary); margin-bottom: 4px;">Contato: <b>${escapeHtml(supplier.contact)}</b></div>` : ''}
        ${supplier.phone ? `<div style="color: var(--text-secondary); margin-bottom: 4px;">Telefone: <b>${escapeHtml(formatPhone(supplier.phone))}</b></div>` : ''}
        ${supplier.email ? `<div style="color: var(--text-secondary); margin-bottom: 4px;">Email: <b>${escapeHtml(supplier.email)}</b></div>` : ''}
        ${supplier.storeUrl ? `<div style="margin-top: 6px;"><a href="${escapeHtml(supplier.storeUrl)}" target="_blank" style="color: var(--accent-primary); font-weight: 600;">🔗 Acessar Loja / Link ↗</a></div>` : ''}
        ${supplier.notes ? `<div style="margin-top: 8px; font-style: italic; color: var(--text-secondary);">Obs: ${escapeHtml(supplier.notes)}</div>` : ''}
      </div>

      <div>
        <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 8px;">Ordens de Compra com este Fornecedor (${supPurchases.length})</h4>
        ${supPurchases.length === 0 ? `<div style="color: var(--text-muted);">Nenhuma ordem de compra registrada para este fornecedor.</div>` : `
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${supPurchases.map(p => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: #f8fafc; border-radius: 6px; border: 1px solid var(--border-subtle);">
                <div>
                  <b>${escapeHtml(p.code || 'Compra')}</b>
                  <span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">${new Date(p.date || p.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
                <span style="font-weight: 700; color: var(--accent-primary);">R$ ${(Number(p.totalAmount) || 0).toFixed(2).replace('.', ',')}</span>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;
  openDrawer(`Resumo do Fornecedor: ${supplier.name}`, content);
}

function openPurchaseSummaryDrawer(purchase, suppliers, materials) {
  const sup = suppliers.find(s => s.id === purchase.supplierId);
  const content = `
    <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;">
      <div style="background: var(--bg-surface-raised); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h4 style="font-size: 16px; font-weight: 700;">Ordem: ${escapeHtml(purchase.code || purchase.id)}</h4>
          <span class="badge-count" style="font-size: 11px;">${escapeHtml(purchase.status || 'pedida')}</span>
        </div>
        <div style="color: var(--text-secondary); margin-bottom: 4px;">Fornecedor: <b>${escapeHtml(sup?.name || purchase.supplierName || 'Fornecedor')}</b></div>
        <div style="color: var(--text-secondary); margin-bottom: 4px;">Data: <b>${new Date(purchase.date || purchase.createdAt).toLocaleDateString('pt-BR')}</b></div>
        <div style="color: var(--text-secondary); margin-bottom: 4px;">Houve Avaria?: <b style="color: ${purchase.hasDamage === 'sim' ? '#ef4444' : 'inherit'};">${purchase.hasDamage === 'sim' ? 'Sim' : 'Não'}</b></div>
        ${purchase.notes ? `<div style="margin-top: 6px; color: var(--text-secondary);">Obs: ${escapeHtml(purchase.notes)}</div>` : ''}
      </div>

      <div>
        <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 8px;">Itens da Compra</h4>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${(purchase.items || []).map(it => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: #f8fafc; border-radius: 6px; border: 1px solid var(--border-subtle);">
              <div>
                <b>${escapeHtml(it.name)}</b>
                <span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">${formatNumberXX(it.quantity)} ${it.unit}</span>
              </div>
              <span style="font-weight: 700;">R$ ${(Number(it.packCost) || 0).toFixed(2).replace('.', ',')}</span>
            </div>
          `).join('')}
        </div>
        <div style="margin-top: 10px; text-align: right; font-size: 15px; font-weight: 800; color: var(--accent-primary);">
          Total: R$ ${(Number(purchase.totalAmount) || 0).toFixed(2).replace('.', ',')}
        </div>
      </div>
    </div>
  `;
  openDrawer(`Resumo da Compra: ${purchase.code || purchase.id}`, content);
}

function openMovementSummaryDrawer(m) {
  const isEntry = m.type === 'entrada';
  const content = `
    <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;">
      <div style="background: var(--bg-surface-raised); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
        <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">${escapeHtml(m.materialName)}</h4>
        <div style="margin-bottom: 6px;">Tipo: <span class="badge-count" style="background: ${isEntry ? '#dcfce7' : '#fee2e2'}; color: ${isEntry ? '#166534' : '#dc2626'};">${isEntry ? '⬇ Entrada' : '⬆ Saída'}</span></div>
        <div style="color: var(--text-secondary); margin-bottom: 4px;">Quantidade: <b style="color: ${isEntry ? '#10b981' : '#ef4444'};">${isEntry ? '+' : '-'}${formatNumberXX(m.quantity)} ${m.unit}</b></div>
        <div style="color: var(--text-secondary); margin-bottom: 4px;">Estoque Anterior: <b>${formatNumberXX(m.previousStock)}</b> ➔ Novo Estoque: <b>${formatNumberXX(m.newStock)}</b></div>
        <div style="color: var(--text-secondary); margin-bottom: 4px;">Motivo: <b>${escapeHtml(m.reason || '-')}</b></div>
        <div style="color: var(--text-secondary); margin-bottom: 4px;">Origem: <b>${escapeHtml(m.origin || '-')}</b></div>
        <div style="color: var(--text-muted); font-size: 11px; margin-top: 8px;">Data/Hora: ${new Date(m.createdAt).toLocaleString('pt-BR')}</div>
      </div>
    </div>
  `;
  openDrawer(`Resumo da Movimentação`, content);
}

function openPriceComparisonGroupDrawer(group, suppliers, purchases) {
  const content = `
    <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;">
      <div style="margin-bottom: 4px;">
        <h4 style="font-size: 15px; font-weight: 700;">Item: ${escapeHtml(group.name)}</h4>
        <span style="font-size: 12px; color: var(--text-secondary);">Unidade Base: <b>${group.baseUnit}</b></span>
      </div>

      <div style="margin-top: 4px;">
        <h5 style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">Ranking de Preços (Mais Barato para o Mais Caro)</h5>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${group.entries.map((e, idx) => `
            <div style="background: ${e.isBest ? '#f0fdf4' : '#ffffff'}; border: 1px solid ${e.isBest ? '#bbf7d0' : 'var(--border-subtle)'}; border-radius: 8px; padding: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <div style="font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                  <span>${idx + 1}º · ${escapeHtml(e.supplierName)}</span>
                  ${e.isBest ? '<span style="color: #166534; background: #dcfce7; padding: 2px 6px; border-radius: 4px; font-size: 10px;">🏆 Melhor Preço</span>' : ''}
                </div>
                <div style="font-weight: 800; font-size: 14px; color: ${e.isBest ? '#166534' : 'var(--text-primary)'};">
                  R$ ${Number(e.normalizedUnitCost).toFixed(4).replace('.', ',')} / ${group.baseUnit}
                </div>
              </div>
              <div style="font-size: 12px; color: var(--text-secondary); display: flex; justify-content: space-between;">
                <span>Embalagem: ${e.packQuantity} ${e.packUnit} por R$ ${Number(e.packCost).toFixed(2).replace('.', ',')}</span>
                <span>Data: ${e.date ? new Date(e.date).toLocaleDateString('pt-BR') : 'Recente'}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  openDrawer(`Ranking Comparativo: ${group.name}`, content);
}

function openContextMenu(event, options) {
  event.stopPropagation();
  const existing = document.getElementById('app-context-menu');
  if (existing) existing.remove();

  const rect = event.currentTarget.getBoundingClientRect();
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
      <span>${escapeHtml(opt.label)}</span>
    </button>
  `).join('');

  document.body.appendChild(menu);

  menu.querySelectorAll('.context-menu-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.remove();
      const idx = Number(btn.getAttribute('data-idx'));
      if (options[idx] && typeof options[idx].action === 'function') {
        options[idx].action();
      }
    });
  });

  const closeListener = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeListener);
    }
  };
  setTimeout(() => document.addEventListener('click', closeListener), 0);
}
