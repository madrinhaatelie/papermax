/**
 * PAPER MAX - Interface de Personalização em Massa (bulk.ui.js)
 * 
 * Funcionalidades:
 * - Seleção de produto / molde
 * - Modo Lista Rápida (tecla ENTER adiciona nova linha com foco automático)
 * - Modo Importação CSV com download de modelo dinâmico e validação por linha
 * - Tabela dinâmica de colunas conforme o produto selecionado
 * - Motor Único de validação e resumo (Total, Válidos, Com Erro)
 * - Processamento assíncrono em lote sem congelamento da UI
 * - Resultados com download de PDF individual e criação de pedidos
 * - Autosave contínuo com indicador de salvamento
 */

import { getProducts, getProductById } from '../products/products.js';
import { createOrder } from '../orders/orders.js';
import {
  getProductColumns,
  createEmptyItem,
  validateAllItems,
  generateDynamicCSVTemplate,
  parseAndMapCSV,
  runPersonalizationBatch,
  saveBulkDraft,
  loadBulkDraft,
  clearBulkDraft
} from './personalization.engine.js';
import { triggerPdfDownload } from './pdf.engine.js';
import { fileStorage } from '../../data/filestorage.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { showToast } from '../../core/events.js';
import { showConfirmDialog } from '../orders/orders.ui.js';

let activeProduct = null;
let structuredItems = [];
let batchProcessing = false;
let generatedBatchFiles = [];

/**
 * Abre o espaço de trabalho / drawer de Personalização em Massa
 */
export function openBulkPersonalizationModal(openDrawerFn, closeDrawerFn, initialProductId = null) {
  const products = getProducts({ status: 'ativo' });
  if (products.length === 0) {
    showToast('Nenhum produto cadastrado para personalização.', '⚠️');
    return;
  }

  // Define produto inicial (prioriza Sacola M se existir)
  activeProduct = initialProductId
    ? getProductById(initialProductId)
    : (products.find(p => p.name.toLowerCase().includes('sacola')) || products[0]);

  // Carrega rascunho anterior do produto se houver
  const savedDraft = loadBulkDraft(activeProduct.id);
  if (savedDraft && savedDraft.length > 0) {
    structuredItems = savedDraft;
  } else {
    // Inicializa com 2 linhas padrão prontas
    const item1 = createEmptyItem(activeProduct, 1);
    const item2 = createEmptyItem(activeProduct, 2);
    // Pré-preenche exemplo se for Sacola M
    if (activeProduct.id === 'prod_sacola_m' || activeProduct.name.includes('Sacola')) {
      item1.personalization.field_nome = 'Maria';
      item1.personalization.field_idade = '8';
      item2.personalization.field_nome = 'João';
      item2.personalization.field_idade = '10';
    }
    structuredItems = [item1, item2];
  }

  generatedBatchFiles = [];

  const contentHtml = `
    <div class="bulk-workspace" id="bulk-workspace-root">
      <!-- Top Bar: Seleção de Produto e Estatísticas -->
      <div style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px; margin-bottom: 14px;">
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <label class="form-label" style="margin: 0; font-weight: 600;" for="bulk-product-select">Produto / Molde:</label>
            <select class="form-select" id="bulk-product-select" style="min-width: 220px; font-weight: 600;">
              ${products.map(p => `
                <option value="${p.id}" ${p.id === activeProduct.id ? 'selected' : ''}>
                  ${escapeHtml(p.name)} (${(p.personalizationFields || []).length} campos)
                </option>
              `).join('')}
            </select>
            <span class="badge-count" style="background: #e0e7ff; color: #3730a3;" id="bulk-mold-badge">
              ✨ Molde Inteligente
            </span>
          </div>

          <!-- Autosave Indicator -->
          <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-muted);" id="bulk-autosave-status">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #10b981;"></span>
            <span>Rascunho sincronizado</span>
          </div>
        </div>

        <!-- Metric Counter Badges -->
        <div style="display: flex; gap: 10px; margin-top: 10px; font-size: 12px;">
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); padding: 4px 10px; border-radius: 6px;">
            Total de Itens: <b id="bulk-total-count">0</b>
          </div>
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 4px 10px; border-radius: 6px;">
            Válidos: <b id="bulk-valid-count">0</b> 🟢
          </div>
          <div style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 4px 10px; border-radius: 6px;">
            Com Erro: <b id="bulk-error-count">0</b> 🔴
          </div>
        </div>
      </div>

      <!-- Mode Switcher Tabs -->
      <div style="display: flex; gap: 6px; border-bottom: 1px solid var(--border-subtle); margin-bottom: 14px; padding-bottom: 4px;">
        <button class="btn btn-sm btn-primary" id="tab-mode-quick" style="padding: 6px 14px;">
          ⚡ Lista Rápida (com Enter)
        </button>
        <button class="btn btn-sm" id="tab-mode-csv" style="padding: 6px 14px;">
          📄 Importar Planilha CSV
        </button>
        <button class="btn btn-sm" id="btn-show-mold-preview" style="margin-left: auto; font-size: 11px;">
          👁 Ver Gabarito do Molde
        </button>
      </div>

      <!-- Mode 1: Quick List View Container -->
      <div id="container-mode-quick">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="font-size: 12px; color: var(--text-secondary);">
            💡 <b>Dica de agilidade:</b> digite o nome e pressione <b>ENTER</b> para adicionar a próxima linha automaticamente.
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-primary" id="btn-add-item-row" style="font-size: 11px;">+ Adicionar Linha</button>
            <button class="btn btn-sm" id="btn-clear-items" style="font-size: 11px; color: var(--status-red-text);">Limpar Lista</button>
          </div>
        </div>

        <!-- Responsive Table Container with Horizontal Scroll for dynamic columns -->
        <div class="table-container" style="max-height: 380px; overflow: auto; border: 1px solid var(--border-subtle); border-radius: 8px; background: var(--bg-surface);">
          <table class="data-table" id="bulk-items-table" style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead id="bulk-table-head" style="position: sticky; top: 0; background: var(--bg-surface-raised); z-index: 2;">
              <!-- Dynamic Head -->
            </thead>
            <tbody id="bulk-table-body">
              <!-- Dynamic Rows -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mode 2: CSV Import Container (Hidden by default) -->
      <div id="container-mode-csv" style="display: none;">
        <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="font-size: 13px; font-weight: 600;">Importação de CSV / Planilha para ${escapeHtml(activeProduct.name)}</h4>
            <button class="btn btn-sm" id="btn-download-dynamic-csv" style="font-size: 11px; background: #f1f5f9;">
              ⬇ Baixar Modelo CSV deste Produto
            </button>
          </div>

          <div class="file-drop-area" id="bulk-csv-drop-area" style="padding: 20px 16px; margin-bottom: 12px;">
            <div style="font-size: 20px; margin-bottom: 4px;">📊</div>
            <div style="font-weight: 600; font-size: 12px;">Clique ou arraste a planilha .CSV aqui</div>
            <div style="font-size: 11px; color: var(--text-muted);">Colunas aceitas: <span id="bulk-csv-expected-columns"></span></div>
            <input type="file" id="bulk-csv-file-input" accept=".csv,text/csv" style="display: none;" />
          </div>

          <div class="form-group">
            <label class="form-label" for="bulk-csv-raw-textarea">Ou cole o conteúdo CSV:</label>
            <textarea class="form-textarea" id="bulk-csv-raw-textarea" rows="4" placeholder="Cole os dados aqui..."></textarea>
          </div>

          <div id="bulk-csv-feedback-box" style="display: none; margin-top: 10px;"></div>

          <div style="margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px;">
            <button class="btn btn-primary" id="btn-process-bulk-csv">Processar e Enviar para Lista</button>
          </div>
        </div>
      </div>

      <!-- Modal Preview do Gabarito (Inline Container) -->
      <div id="bulk-mold-preview-drawer" style="display: none; margin-top: 14px; background: var(--bg-surface-raised); border: 1px solid var(--border-strong); border-radius: 8px; padding: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <b style="font-size: 13px;">Gabarito Visual de Áreas: ${escapeHtml(activeProduct.name)}</b>
          <button class="btn btn-sm" id="btn-close-mold-preview">✕ Fechar Gabarito</button>
        </div>
        <div id="bulk-mold-preview-stage" style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 16px; text-align: center;">
          <!-- SVG / Canvas representation of the product layout -->
        </div>
      </div>

      <!-- Processing Progress Card (Shown during batch generation) -->
      <div id="bulk-progress-card" style="display: none; margin-top: 14px; background: #f8fafc; border: 1px solid var(--border-strong); border-radius: 8px; padding: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-weight: 600; font-size: 12px;" id="bulk-progress-title">Processando Lote de PDFs...</span>
          <span style="font-size: 12px; font-weight: 700; color: var(--accent-primary);" id="bulk-progress-pct">0%</span>
        </div>
        <div style="background: #e2e8f0; border-radius: 4px; height: 8px; overflow: hidden; margin-bottom: 8px;">
          <div id="bulk-progress-bar" style="background: var(--accent-primary); width: 0%; height: 100%; transition: width 0.15s ease;"></div>
        </div>
        <div style="font-size: 11px; color: var(--text-secondary); display: flex; justify-content: space-between;" id="bulk-progress-sub">
          <span>Iniciando motor de PDF...</span>
          <span>Aguarde</span>
        </div>
      </div>

      <!-- Completed Batch Results Card -->
      <div id="bulk-results-card" style="display: none; margin-top: 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <b style="color: #166534; font-size: 13px;">✓ Lote Concluído com Sucesso!</b>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-primary" id="btn-create-orders-from-batch">Criar Pedidos deste Lote</button>
            <button class="btn btn-sm" id="btn-download-all-batch-pdfs" style="background: #ffffff;">Baixar Todos os PDFs</button>
          </div>
        </div>
        <div id="bulk-results-list" style="max-height: 180px; overflow-y: auto; font-size: 11px; background: #ffffff; border: 1px solid #bbf7d0; border-radius: 6px; padding: 8px;">
          <!-- Links para cada arquivo gerado -->
        </div>
      </div>
    </div>
  `;

  const footerHtml = `
    <button class="btn" id="btn-close-bulk">Fechar</button>
    <button class="btn btn-primary" id="btn-run-bulk-generation" style="padding: 0 18px;">
      🚀 Gerar PDFs em Lote
    </button>
  `;

  openDrawerFn({
    title: `Personalização em Massa · ${escapeHtml(activeProduct.name)}`,
    contentHtml,
    footerHtml,
    onMount: (drawer) => {
      bindBulkEvents(drawer, closeDrawerFn);
      renderTable(drawer);
      updateStats(drawer);
      updateExpectedCsvColumns(drawer);
    }
  });
}

function bindBulkEvents(drawer, closeDrawerFn) {
  // Troca de produto
  const productSelect = drawer.querySelector('#bulk-product-select');
  productSelect.addEventListener('change', e => {
    const nextProduct = getProductById(e.target.value);
    if (nextProduct) {
      activeProduct = nextProduct;
      // Reinicializa itens para o novo produto
      const savedDraft = loadBulkDraft(activeProduct.id);
      if (savedDraft && savedDraft.length > 0) {
        structuredItems = savedDraft;
      } else {
        structuredItems = [
          createEmptyItem(activeProduct, 1),
          createEmptyItem(activeProduct, 2)
        ];
      }
      renderTable(drawer);
      updateStats(drawer);
      updateExpectedCsvColumns(drawer);
      showToast(`Produto alterado para ${activeProduct.name}`);
    }
  });

  // Tab: Lista Rápida
  const tabQuick = drawer.querySelector('#tab-mode-quick');
  const tabCsv = drawer.querySelector('#tab-mode-csv');
  const containerQuick = drawer.querySelector('#container-mode-quick');
  const containerCsv = drawer.querySelector('#container-mode-csv');

  tabQuick.addEventListener('click', () => {
    tabQuick.classList.add('btn-primary');
    tabCsv.classList.remove('btn-primary');
    containerQuick.style.display = 'block';
    containerCsv.style.display = 'none';
  });

  tabCsv.addEventListener('click', () => {
    tabCsv.classList.add('btn-primary');
    tabQuick.classList.remove('btn-primary');
    containerQuick.style.display = 'none';
    containerCsv.style.display = 'block';
  });

  // Gabarito visual
  const btnShowPreview = drawer.querySelector('#btn-show-mold-preview');
  const moldDrawer = drawer.querySelector('#bulk-mold-preview-drawer');
  const btnCloseMold = drawer.querySelector('#btn-close-mold-preview');

  btnShowPreview.addEventListener('click', () => {
    const isShown = moldDrawer.style.display === 'block';
    moldDrawer.style.display = isShown ? 'none' : 'block';
    if (!isShown) renderMoldPreview(drawer);
  });

  btnCloseMold.addEventListener('click', () => {
    moldDrawer.style.display = 'none';
  });

  // Adicionar linha
  drawer.querySelector('#btn-add-item-row').addEventListener('click', () => {
    addNewRow(drawer, true);
  });

  // Limpar lista
  drawer.querySelector('#btn-clear-items').addEventListener('click', () => {
    showConfirmDialog({
      title: 'Limpar Lista',
      message: 'Deseja realmente limpar toda a lista?',
      confirmText: 'Limpar Lista',
      isDanger: true,
      onConfirm: () => {
        structuredItems = [createEmptyItem(activeProduct, 1)];
        clearBulkDraft();
        renderTable(drawer);
        updateStats(drawer);
        showToast('Lista limpa com sucesso.', '✓');
      }
    });
  });

  // Download modelo dinâmico CSV
  drawer.querySelector('#btn-download-dynamic-csv').addEventListener('click', () => {
    const csvContent = generateDynamicCSVTemplate(activeProduct);
    const filename = `modelo_${activeProduct.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Modelo CSV baixado com sucesso!');
  });

  // Importar CSV
  const csvDropArea = drawer.querySelector('#bulk-csv-drop-area');
  const csvFileInput = drawer.querySelector('#bulk-csv-file-input');
  const csvRawTextarea = drawer.querySelector('#bulk-csv-raw-textarea');
  const csvFeedback = drawer.querySelector('#bulk-csv-feedback-box');

  csvDropArea.addEventListener('click', () => csvFileInput.click());
  csvFileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => {
        csvRawTextarea.value = ev.target.result;
      };
      reader.readAsText(file);
    }
  });

  drawer.querySelector('#btn-process-bulk-csv').addEventListener('click', () => {
    const csvContent = csvRawTextarea.value.trim();
    if (!csvContent) {
      showToast('Informe o conteúdo do CSV.', '⚠️');
      return;
    }

    try {
      const result = parseAndMapCSV(csvContent, activeProduct);
      if (result.errorCount > 0) {
        csvFeedback.style.display = 'block';
        csvFeedback.innerHTML = `
          <div class="alert-card alert-red" style="font-size: 11px;">
            <b>Validação do CSV (${result.errorCount} erros encontrados):</b>
            <ul style="margin-top: 4px; padding-left: 16px;">
              ${result.items.filter(i => !i.isValid).slice(0, 5).map(i => `
                <li>Linha ${i.index}: ${i.errors.join(', ')}</li>
              `).join('')}
              ${result.errorCount > 5 ? `<li>... e mais ${result.errorCount - 5} erros</li>` : ''}
            </ul>
            <div style="margin-top: 6px;">
              <button class="btn btn-sm" id="btn-force-import-csv">Importar mesmo com avisos para corrigir na tabela</button>
            </div>
          </div>
        `;

        drawer.querySelector('#btn-force-import-csv')?.addEventListener('click', () => {
          structuredItems = result.items;
          tabQuick.click();
          renderTable(drawer);
          updateStats(drawer);
          csvFeedback.style.display = 'none';
          showToast(`${result.items.length} itens carregados na lista para revisão.`);
        });
        return;
      }

      structuredItems = result.items;
      tabQuick.click();
      renderTable(drawer);
      updateStats(drawer);
      showToast(`${result.items.length} linhas importadas com sucesso!`);
    } catch (err) {
      csvFeedback.style.display = 'block';
      csvFeedback.innerHTML = `
        <div class="alert-card alert-red" style="font-size: 12px;">
          ${escapeHtml(err.message)}
        </div>
      `;
    }
  });

  // Fechar
  drawer.querySelector('#btn-close-bulk').addEventListener('click', closeDrawerFn);

  // Executar Geração em Lote
  const btnRun = drawer.querySelector('#btn-run-bulk-generation');
  btnRun.addEventListener('click', () => {
    executeBatch(drawer);
  });
}

function updateExpectedCsvColumns(drawer) {
  const labelSpan = drawer.querySelector('#bulk-csv-expected-columns');
  if (!labelSpan) return;
  const columns = getProductColumns(activeProduct);
  labelSpan.textContent = columns.map(c => c.label.toUpperCase()).join('; ');
}

/**
 * Adiciona uma nova linha e foca no primeiro campo de texto (Nome)
 */
function addNewRow(drawer, focusFirst = true) {
  const nextIdx = structuredItems.length + 1;
  const newItem = createEmptyItem(activeProduct, nextIdx);
  structuredItems.push(newItem);
  saveBulkDraft(activeProduct.id, structuredItems);
  renderTable(drawer);
  updateStats(drawer);

  if (focusFirst) {
    setTimeout(() => {
      const inputs = drawer.querySelectorAll(`input[data-item-id="${newItem.id}"]`);
      if (inputs.length > 0) {
        inputs[0].focus();
        inputs[0].select();
      }
    }, 50);
  }
}

/**
 * Renderiza a tabela dinâmica conforme as colunas do produto
 */
function renderTable(drawer) {
  const thead = drawer.querySelector('#bulk-table-head');
  const tbody = drawer.querySelector('#bulk-table-body');
  if (!thead || !tbody) return;

  const columns = getProductColumns(activeProduct);

  // Cabeçalho dinâmico
  thead.innerHTML = `
    <tr>
      <th style="width: 32px; padding: 6px 8px; text-align: center;">#</th>
      ${columns.map(col => `
        <th style="padding: 6px 8px; text-align: left; white-space: nowrap;">
          ${escapeHtml(col.label)}
          ${col.required ? '<span style="color: #dc2626;">*</span>' : ''}
        </th>
      `).join('')}
      <th style="width: 70px; padding: 6px 8px; text-align: center;">Status</th>
      <th style="width: 45px; padding: 6px 8px; text-align: center;">Ações</th>
    </tr>
  `;

  // Linhas
  if (structuredItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${columns.length + 3}" style="text-align: center; padding: 24px; color: var(--text-muted);">
          Nenhum item na lista. Clique em "+ Adicionar Linha" para começar.
        </td>
      </tr>
    `;
    return;
  }

  const validatedResult = validateAllItems(structuredItems, activeProduct);
  structuredItems = validatedResult.items;

  tbody.innerHTML = structuredItems.map((item, idx) => {
    const isErr = !item.isValid;
    const rowBg = isErr ? '#fff5f5' : (idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-surface-raised)');

    return `
      <tr style="background: ${rowBg}; border-bottom: 1px solid var(--border-subtle);" data-row-id="${item.id}">
        <td style="text-align: center; padding: 6px 8px; font-weight: 600; color: var(--text-muted);">
          ${idx + 1}
        </td>

        ${columns.map((col, colIdx) => {
          const isP = col.category === 'personalization';
          const val = isP ? (item.personalization[col.id] || '') : (item.changeOptions[col.id] || '');

          if (col.type === 'choice' && col.choices && col.choices.length > 0) {
            return `
              <td style="padding: 4px 6px;">
                <select 
                  class="form-select" 
                  style="width: 100%; padding: 4px 8px; font-size: 11px; height: 28px;"
                  data-item-id="${item.id}"
                  data-col-id="${col.id}"
                  data-category="${col.category}"
                >
                  ${col.choices.map(ch => `
                    <option value="${escapeHtml(ch)}" ${ch === val ? 'selected' : ''}>
                      ${escapeHtml(ch)}
                    </option>
                  `).join('')}
                </select>
              </td>
            `;
          }

          return `
            <td style="padding: 4px 6px;">
              <input 
                type="${col.type === 'number' ? 'number' : 'text'}" 
                class="form-input bulk-cell-input" 
                style="width: 100%; padding: 4px 8px; font-size: 11px; height: 28px; border-color: ${isErr && col.required && !val ? '#fca5a5' : 'var(--border-subtle)'};"
                value="${escapeHtml(String(val))}"
                placeholder="${col.required ? 'Obrigatório' : ''}"
                data-item-id="${item.id}"
                data-col-id="${col.id}"
                data-category="${col.category}"
                data-first-cell="${colIdx === 0 ? 'true' : 'false'}"
              />
            </td>
          `;
        }).join('')}

        <td style="text-align: center; padding: 4px 6px;">
          ${isErr 
            ? `<span title="${escapeHtml(item.errors.join('\n'))}" style="cursor: help; color: #dc2626; font-size: 12px; font-weight: 700;">🔴 Erro</span>`
            : `<span style="color: #059669; font-size: 12px; font-weight: 700;">🟢 OK</span>`
          }
        </td>

        <td style="text-align: center; padding: 4px 6px;">
          <button 
            class="btn btn-sm btn-del-row" 
            style="padding: 2px 6px; font-size: 11px; color: #dc2626; background: transparent; border: none; cursor: pointer;"
            data-item-id="${item.id}"
            title="Excluir Linha"
          >
            🗑
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Eventos das células
  tbody.querySelectorAll('.bulk-cell-input, select').forEach(input => {
    input.addEventListener('input', e => {
      const itemId = e.target.dataset.itemId;
      const colId = e.target.dataset.colId;
      const category = e.target.dataset.category;
      const targetItem = structuredItems.find(i => i.id === itemId);
      if (targetItem) {
        if (category === 'personalization') {
          targetItem.personalization[colId] = e.target.value;
        } else {
          targetItem.changeOptions[colId] = e.target.value;
        }
        saveBulkDraft(activeProduct.id, structuredItems);
        updateStats(drawer);
      }
    });

    // TECLA ENTER: Adiciona nova linha com foco automático na primeira célula
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addNewRow(drawer, true);
      }
    });
  });

  // Botões de excluir linha
  tbody.querySelectorAll('.btn-del-row').forEach(btn => {
    btn.addEventListener('click', e => {
      const itemId = e.target.dataset.itemId;
      structuredItems = structuredItems.filter(i => i.id !== itemId);
      saveBulkDraft(activeProduct.id, structuredItems);
      renderTable(drawer);
      updateStats(drawer);
    });
  });
}

/**
 * Atualiza contadores de validação no cabeçalho
 */
function updateStats(drawer) {
  const valResult = validateAllItems(structuredItems, activeProduct);
  drawer.querySelector('#bulk-total-count').textContent = valResult.total;
  drawer.querySelector('#bulk-valid-count').textContent = valResult.validCount;
  drawer.querySelector('#bulk-error-count').textContent = valResult.errorCount;

  const btnRun = drawer.querySelector('#btn-run-bulk-generation');
  if (btnRun) {
    btnRun.disabled = valResult.total === 0 || batchProcessing;
  }
}

/**
 * Renderiza prévia interativa do gabarito em SVG
 */
function renderMoldPreview(drawer) {
  const stage = drawer.querySelector('#bulk-mold-preview-stage');
  if (!stage) return;

  const textAreas = activeProduct.editor?.textAreas || [];
  const pWidth = activeProduct.basePdfMetadata?.width || 595;
  const pHeight = activeProduct.basePdfMetadata?.height || 842;

  // Escala para caber em 400px de altura
  const scale = 360 / pHeight;
  const svgW = pWidth * scale;
  const svgH = 360;

  stage.innerHTML = `
    <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
      Dimensões da Folha: ${pWidth} × ${pHeight} pt · ${textAreas.length} área(s) de texto mapeada(s)
    </div>
    <div style="display: flex; justify-content: center;">
      <svg width="${svgW}" height="${svgH}" viewBox="0 0 ${pWidth} ${pHeight}" style="border: 1px solid #cbd5e1; background: #fafaf9; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <!-- Fundo simulado da sacola/produto -->
        <rect x="110" y="160" width="375" height="520" fill="#f5ede3" stroke="#d6c5b2" stroke-width="2" rx="4" />
        
        <!-- Dobras e vincos -->
        <line x1="110" y1="210" x2="485" y2="210" stroke="#c4b09b" stroke-dasharray="4,4" stroke-width="1.5" />
        <line x1="110" y1="620" x2="485" y2="620" stroke="#c4b09b" stroke-dasharray="4,4" stroke-width="1.5" />
        
        <!-- Alças -->
        <circle cx="200" cy="185" r="8" fill="#8c7764" />
        <circle cx="395" cy="185" r="8" fill="#8c7764" />

        <!-- Áreas de texto mapeadas -->
        ${textAreas.map(area => {
          return `
            <g>
              <rect 
                x="${area.x}" 
                y="${area.y}" 
                width="${area.width}" 
                height="${area.height}" 
                fill="rgba(79, 70, 229, 0.12)" 
                stroke="#4f46e5" 
                stroke-width="1.5" 
                stroke-dasharray="3,3" 
                rx="3"
              />
              <text 
                x="${area.x + area.width / 2}" 
                y="${area.y + area.height / 2 + 5}" 
                text-anchor="middle" 
                font-family="sans-serif" 
                font-size="12" 
                font-weight="bold" 
                fill="#4338ca"
              >
                ${escapeHtml(area.name || area.id)} (${area.fontSize}pt)
              </text>
            </g>
          `;
        }).join('')}
      </svg>
    </div>
  `;
}

/**
 * Executa geração em lote com motor assíncrono e barra de progresso
 */
async function executeBatch(drawer) {
  if (batchProcessing) return;

  const validation = validateAllItems(structuredItems, activeProduct);
  if (validation.errorCount > 0) {
    showConfirmDialog({
      title: 'Itens com Inconsistências',
      message: `A lista possui ${validation.errorCount} item(ns) com erro. Deseja prosseguir gerando apenas os válidos?`,
      confirmText: 'Prosseguir com Válidos',
      onConfirm: () => startBatchProcessing(drawer)
    });
    return;
  }

  startBatchProcessing(drawer);
}

async function startBatchProcessing(drawer) {
  const validItems = structuredItems.filter(i => i.isValid);
  if (validItems.length === 0) {
    showToast('Não há itens válidos para gerar.', '⚠️');
    return;
  }

  batchProcessing = true;
  updateStats(drawer);

  const progressCard = drawer.querySelector('#bulk-progress-card');
  const resultsCard = drawer.querySelector('#bulk-results-card');
  const progressBar = drawer.querySelector('#bulk-progress-bar');
  const progressPct = drawer.querySelector('#bulk-progress-pct');
  const progressTitle = drawer.querySelector('#bulk-progress-title');
  const progressSub = drawer.querySelector('#bulk-progress-sub');

  progressCard.style.display = 'block';
  resultsCard.style.display = 'none';

  try {
    const batchResult = await runPersonalizationBatch({
      product: activeProduct,
      items: validItems,
      onProgress: (prog) => {
        const pct = Math.round((prog.processed / prog.total) * 100);
        progressBar.style.width = `${pct}%`;
        progressPct.textContent = `${pct}%`;
        progressTitle.textContent = `Processando: ${prog.processed} de ${prog.total} (${pct}%)`;
        progressSub.innerHTML = `
          <span>Item: <b>${escapeHtml(prog.currentName)}</b></span>
          <span>Sucesso: ${prog.successCount} 🟢 · Erros: ${prog.errorCount} 🔴</span>
        `;
      }
    });

    batchProcessing = false;
    updateStats(drawer);

    // Salva arquivos gerados
    generatedBatchFiles = batchResult.results
      .filter(r => r.success && r.file)
      .map(r => r.file);

    progressCard.style.display = 'none';
    resultsCard.style.display = 'block';

    const resultsList = drawer.querySelector('#bulk-results-list');
    resultsList.innerHTML = generatedBatchFiles.map((file, idx) => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 4px; border-bottom: 1px solid #e2e8f0;">
        <div>
          <b>${idx + 1}.</b> 📄 ${escapeHtml(file.fileName)}
          <span style="color: var(--text-muted); font-size: 10px;">(${(file.size / 1024).toFixed(1)} KB)</span>
        </div>
        <button class="btn btn-sm btn-dl-single" data-file-id="${file.fileId}" style="font-size: 11px; padding: 2px 8px;">
          ⬇ Baixar
        </button>
      </div>
    `).join('');

    // Listener para download individual
    resultsList.querySelectorAll('.btn-dl-single').forEach(btn => {
      btn.addEventListener('click', async e => {
        const fileId = e.target.dataset.fileId;
        const target = generatedBatchFiles.find(f => f.fileId === fileId);
        if (target) {
          triggerPdfDownload(target.blob, target.fileName);
        } else {
          const rec = await fileStorage.getFile(fileId);
          if (rec) triggerPdfDownload(rec.blob, rec.metadata?.name);
        }
      });
    });

    // Listener para baixar todos
    drawer.querySelector('#btn-download-all-batch-pdfs').onclick = () => {
      generatedBatchFiles.forEach((file, i) => {
        setTimeout(() => {
          triggerPdfDownload(file.blob, file.fileName);
        }, i * 350);
      });
      showToast(`Iniciando download de ${generatedBatchFiles.length} arquivos...`);
    };

    // Listener para criar pedidos automaticamente a partir do lote
    drawer.querySelector('#btn-create-orders-from-batch').onclick = () => {
      showConfirmDialog({
        title: 'Criar Pedidos a Partir do Lote',
        message: `Deseja criar ${validItems.length} novo(s) pedido(s) no sistema vinculando estes PDFs gerados?`,
        confirmText: 'Criar Pedidos',
        onConfirm: () => {
          let created = 0;
          validItems.forEach((item, i) => {
            const genFile = generatedBatchFiles[i];
            const cust = item.personalization.field_nome || item.personalization.nome || `Cliente ${i + 1}`;
            createOrder({
              customer: cust,
              productId: activeProduct.id,
              qty: 1,
              personalization: item.personalization,
              changeOptions: item.changeOptions,
              generatedFiles: genFile ? [{
                fileId: genFile.fileId,
                fileName: genFile.fileName,
                size: genFile.size,
                createdAt: genFile.createdAt
              }] : [],
              notes: `Gerado via Personalização em Massa (${activeProduct.name})`
            });
            created++;
          });

          clearBulkDraft();
          showToast(`${created} pedidos criados com sucesso!`, '✓');
        }
      });
    };

    showToast(`Geração concluída: ${batchResult.successCount} PDFs gerados com sucesso!`);
  } catch (err) {
    batchProcessing = false;
    progressCard.style.display = 'none';
    showToast(`Erro no processamento do lote: ${err.message}`, '⚠️');
  }
}
