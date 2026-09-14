/**
 * PAPER MAX - Editor Completo de Produto & Molde Inteligente (product.editor.ui.js)
 * 
 * Fornece interface em Drawer com 5 seções/abas:
 * 1. Dados Gerais (Nome, Categoria, Preço, Custo, Margem, Tempo de Produção, Status, Descrição)
 * 2. Campos de Personalização (Nome, Idade, Data, Frase - Adicionar/Remover/Editar)
 * 3. Opções de Alteração (Cor, Elemento, Lateral, Alça - Adicionar/Remover/Editar com opções)
 * 4. Áreas de Texto & Gabarito (Coordenadas X, Y, W, H, Fonte, Tamanho, Alinhamento, Cor, Vínculo)
 * 5. PDF Base (Upload de PDF original imutável, metadados e gabarito)
 */

import { getProductById, createProduct, updateProduct, isSmartMold } from './products.js';
import { getCategories } from '../categories/categories.js';
import { uploadCustomBasePdf } from '../personalization/pdf.engine.js';
import { formatCurrency, escapeHtml } from '../../utils/sanitize.js';
import { showToast } from '../../core/events.js';

export function openProductConfigDrawer({
  productId = null,
  openDrawerFn,
  closeDrawerFn,
  onSaved = null
}) {
  const isEdit = Boolean(productId);
  let product = isEdit ? getProductById(productId) : null;

  if (isEdit && !product) {
    alert('Produto não encontrado.');
    return;
  }

  // Se for novo produto, cria estrutura inicial padrão
  if (!product) {
    product = {
      name: '',
      categoryId: '',
      status: 'ativo',
      type: 'personalizado',
      description: '',
      price: 10.00,
      cost: 4.00,
      productionTime: 2,
      configurationVersion: 1,
      personalizationFields: [
        { id: 'field_nome', name: 'Nome', type: 'text', required: true, defaultValue: '' },
        { id: 'field_idade', name: 'Idade', type: 'number', required: false, defaultValue: '' }
      ],
      changeOptions: [
        { id: 'opt_cor', name: 'Cor', type: 'choice', required: true, defaultValue: 'Rosa', choices: ['Rosa', 'Azul', 'Branco', 'Kraft'] },
        { id: 'opt_alca', name: 'Alça', type: 'choice', required: true, defaultValue: 'Cetim', choices: ['Cetim', 'Nylon'] }
      ],
      editor: {
        textAreas: [
          { id: 'area_txt_1', name: 'Área do Nome', label: 'Nome Central', page: 1, x: 120, y: 380, width: 350, height: 45, alignment: 'center', fontFamily: 'Helvetica', fontSize: 24, fontWeight: 'bold', color: '#1e293b', personalizationFieldId: 'field_nome' }
        ],
        elementAreas: [],
        colorAreas: []
      },
      basePdfMetadata: null
    };
  } else {
    // Clona para evitar mutações diretas antes de salvar
    product = JSON.parse(JSON.stringify(product));
  }

  let activeTab = 'geral'; // 'geral' | 'personalizacao' | 'alteracoes' | 'gabarito' | 'pdfbase'

  function renderDrawerContent() {
    const categories = getCategories();
    const margin = (product.price || 0) - (product.cost || 0);
    const marginPct = (product.price || 0) > 0 ? ((margin / product.price) * 100).toFixed(1) : 0;
    const isMold = isSmartMold(product);

    return `
      <div>
        <!-- Cabeçalho de Status e Versão -->
        <div style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            ${isMold ? `
              <span class="badge-count" style="background: #e0e7ff; color: #3730a3; font-weight: 700;">
                ✨ Molde Inteligente Ativo
              </span>
            ` : `
              <span class="badge-count">Produto Padrão</span>
            `}
            <span style="font-size: 11px; color: var(--text-muted);">
              Versão: <b>v${product.configurationVersion || 1}</b>
            </span>
          </div>
          <div style="font-size: 11px; color: var(--text-secondary);">
            Margem Estimada: <b style="color: ${margin >= 0 ? '#059669' : '#dc2626'}">${formatCurrency(margin)} (${marginPct}%)</b>
          </div>
        </div>

        <!-- Abas de Navegação -->
        <div style="display: flex; gap: 4px; border-bottom: 1px solid var(--border-subtle); margin-bottom: 14px; overflow-x: auto; padding-bottom: 2px;">
          <button class="btn btn-sm ${activeTab === 'geral' ? 'btn-primary' : ''}" data-tab-btn="geral" style="font-size: 11px; padding: 5px 10px; white-space: nowrap;">
            1. Geral & Preço
          </button>
          <button class="btn btn-sm ${activeTab === 'personalizacao' ? 'btn-primary' : ''}" data-tab-btn="personalizacao" style="font-size: 11px; padding: 5px 10px; white-space: nowrap;" title="Textos e dados fornecidos pelo cliente (Ex: Nome, Idade, Frase)">
            2. Personalização: Textos (${(product.personalizationFields || []).length})
          </button>
          <button class="btn btn-sm ${activeTab === 'alteracoes' ? 'btn-primary' : ''}" data-tab-btn="alteracoes" style="font-size: 11px; padding: 5px 10px; white-space: nowrap;" title="Acabamentos e opções físicas de produção (Ex: Cor, Material, Alça)">
            3. Alterações: Variações (${(product.changeOptions || []).length})
          </button>
          <button class="btn btn-sm ${activeTab === 'gabarito' ? 'btn-primary' : ''}" data-tab-btn="gabarito" style="font-size: 11px; padding: 5px 10px; white-space: nowrap;">
            4. Áreas / Gabarito (${(product.editor?.textAreas || []).length})
          </button>
          <button class="btn btn-sm ${activeTab === 'pdfbase' ? 'btn-primary' : ''}" data-tab-btn="pdfbase" style="font-size: 11px; padding: 5px 10px; white-space: nowrap;">
            5. PDF Base
          </button>
        </div>

        <!-- Conteúdo da Aba Ativa -->
        <div id="product-editor-tab-body">
          ${renderActiveTab(categories)}
        </div>
      </div>
    `;
  }

  function renderActiveTab(categories) {
    if (activeTab === 'geral') {
      return `
        <div class="form-group">
          <label class="form-label" for="inp-pcfg-name">Nome do Produto *</label>
          <input class="form-input" id="inp-pcfg-name" value="${escapeHtml(product.name || '')}" placeholder="Ex: Sacola M Kraft" required />
        </div>

        <div class="form-group">
          <label class="form-label" for="inp-pcfg-cat">Categoria</label>
          <select class="form-select" id="inp-pcfg-cat">
            <option value="">Sem Categoria</option>
            ${categories.map(c => `
              <option value="${c.id}" ${c.id === product.categoryId ? 'selected' : ''}>${escapeHtml(c.name)}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="inp-pcfg-desc">Descrição do Produto</label>
          <textarea class="form-textarea" id="inp-pcfg-desc" rows="2" placeholder="Gramatura do papel, medidas em cm, especificações...">${escapeHtml(product.description || '')}</textarea>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
          <div class="form-group">
            <label class="form-label" for="inp-pcfg-price">Preço Venda (R$)</label>
            <input type="number" step="0.50" class="form-input" id="inp-pcfg-price" value="${product.price || 0}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="inp-pcfg-cost">Custo Base (R$)</label>
            <input type="number" step="0.50" class="form-input" id="inp-pcfg-cost" value="${product.cost || 0}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="inp-pcfg-time">Dias Produção</label>
            <input type="number" class="form-input" id="inp-pcfg-time" value="${product.productionTime || 1}" min="1" />
          </div>
        </div>

        <div class="form-group" style="margin-top: 10px;">
          <label class="form-label" for="inp-pcfg-status">Status no Catálogo</label>
          <select class="form-select" id="inp-pcfg-status">
            <option value="ativo" ${product.status === 'ativo' ? 'selected' : ''}>Ativo</option>
            <option value="inativo" ${product.status === 'inativo' ? 'selected' : ''}>Inativo</option>
          </select>
        </div>
      `;
    }

    if (activeTab === 'personalizacao') {
      const fields = product.personalizationFields || [];
      return `
        <div>
          <!-- Didactic Concept Card -->
          <div style="background: rgba(219, 39, 119, 0.06); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 14px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 12px; color: var(--accent-primary);">
              <span>✍️ O que é Personalização?</span>
            </div>
            <p style="font-size: 11px; color: var(--text-secondary); margin: 4px 0 0 0; line-height: 1.4;">
              São os <b>textos e informações variáveis</b> que a sua cliente fornece para estampar ou imprimir no produto.<br/>
              <b>Exemplos:</b> <i>"Nome da Criança"</i>, <i>"Idade"</i>, <i>"Data do Evento"</i>, <i>"Frase / Dedicatória"</i>.
            </p>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div>
              <h4 style="font-size: 13px; font-weight: 700; color: var(--text-primary);">Campos de Personalização (Textos)</h4>
              <p style="font-size: 11px; color: var(--text-muted);">Defina quais dados o cliente deve preencher ao fazer o pedido.</p>
            </div>
            <button class="btn btn-sm btn-primary" id="btn-add-pfield">+ Adicionar Campo</button>
          </div>

          ${fields.length === 0 ? `
            <div style="background: var(--bg-surface-raised); padding: 18px; border-radius: 8px; text-align: center; color: var(--text-muted); font-size: 12px; border: 1px dashed var(--border-subtle);">
              Nenhum texto personalizado configurado. O pedido não solicitará Nome, Idade ou textos variáveis.
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${fields.map((f, idx) => `
                <div style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <b>${escapeHtml(f.name || f.id)}</b>
                      <span class="badge-count" style="font-size: 10px;">${f.type || 'text'}</span>
                      ${f.required ? '<span style="color: #dc2626; font-size: 10px; font-weight: 700; background: #fee2e2; padding: 1px 6px; border-radius: 4px;">Obrigatório</span>' : '<span style="color: var(--text-muted); font-size: 10px; background: #f1f5f9; padding: 1px 6px; border-radius: 4px;">Opcional</span>'}
                    </div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                      Identificador: <code>${escapeHtml(f.id)}</code> · Padrão: "${escapeHtml(f.defaultValue || 'nenhum')}"
                    </div>
                  </div>
                  <button class="btn btn-sm btn-del-pfield" data-index="${idx}" style="color: #dc2626; background: transparent; border: none; font-size: 14px; cursor: pointer;" title="Excluir campo">
                    🗑
                  </button>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;
    }

    if (activeTab === 'alteracoes') {
      const opts = product.changeOptions || [];
      return `
        <div>
          <!-- Didactic Concept Card -->
          <div style="background: rgba(99, 102, 241, 0.06); border: 1px solid #c7d2fe; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 12px; color: #4338ca;">
              <span>🎨 O que são Opções de Alteração / Variações?</span>
            </div>
            <p style="font-size: 11px; color: #3730a3; margin: 4px 0 0 0; line-height: 1.4;">
              São as <b>escolhas de materiais, acabamentos e cores físicas</b> que afetam a montagem ou o visual do produto.<br/>
              <b>Exemplos:</b> <i>"Cor da Sacola (Rosa Bebê, Azul Céu)"</i>, <i>"Tipo de Alça (Cetim, Gorgurão, Cordão)"</i>, <i>"Acabamento (Fosco, Brilho, Holográfico)"</i>.
            </p>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div>
              <h4 style="font-size: 13px; font-weight: 700; color: var(--text-primary);">Opções de Alteração / Acabamento</h4>
              <p style="font-size: 11px; color: var(--text-muted);">Defina listas de opções para a cliente ou atendente escolher.</p>
            </div>
            <button class="btn btn-sm btn-primary" id="btn-add-copt">+ Adicionar Opção</button>
          </div>

          ${opts.length === 0 ? `
            <div style="background: var(--bg-surface-raised); padding: 18px; border-radius: 8px; text-align: center; color: var(--text-muted); font-size: 12px; border: 1px dashed var(--border-subtle);">
              Nenhuma opção de alteração cadastrada. O produto será produzido sempre na versão padrão única.
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${opts.map((opt, idx) => `
                <div style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <b>${escapeHtml(opt.name || opt.id)}</b>
                      ${opt.required ? '<span style="color: #dc2626; font-size: 10px; font-weight: 700; background: #fee2e2; padding: 1px 6px; border-radius: 4px;">Obrigatório</span>' : '<span style="color: var(--text-muted); font-size: 10px; background: #f1f5f9; padding: 1px 6px; border-radius: 4px;">Opcional</span>'}
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                      Opções disponíveis: <b>${(opt.choices || []).join(', ')}</b>
                    </div>
                  </div>
                  <button class="btn btn-sm btn-del-copt" data-index="${idx}" style="color: #dc2626; background: transparent; border: none; font-size: 14px; cursor: pointer;" title="Excluir opção">
                    🗑
                  </button>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;
    }

    if (activeTab === 'gabarito') {
      const textAreas = product.editor?.textAreas || [];
      return `
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div>
              <h4 style="font-size: 13px; font-weight: 700;">Áreas de Texto no Gabarito</h4>
              <p style="font-size: 11px; color: var(--text-secondary);">Posições (X, Y) e regras de tipografia impressas no PDF final.</p>
            </div>
            <button class="btn btn-sm btn-primary" id="btn-add-textarea">+ Nova Área de Texto</button>
          </div>

          ${textAreas.length === 0 ? `
            <div style="background: var(--bg-surface-raised); padding: 18px; border-radius: 8px; text-align: center; color: var(--text-muted); font-size: 12px;">
              Nenhuma área de texto mapeada. O motor posicionará os textos automaticamente na área central.
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${textAreas.map((area, idx) => `
                <div style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 10px 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <b>${escapeHtml(area.name || area.id)}</b>
                    <button class="btn btn-sm btn-del-textarea" data-index="${idx}" style="color: #dc2626; background: transparent; border: none; font-size: 12px; cursor: pointer;">
                      🗑
                    </button>
                  </div>
                  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; font-size: 11px; color: var(--text-secondary);">
                    <div>Pos X: <b>${area.x} pt</b></div>
                    <div>Pos Y: <b>${area.y} pt</b></div>
                    <div>Largura: <b>${area.width} pt</b></div>
                    <div>Tamanho: <b>${area.fontSize} pt</b></div>
                    <div>Fonte: <b>${area.fontFamily || 'Helvetica'}</b></div>
                    <div>Alinhamento: <b>${area.alignment || 'center'}</b></div>
                    <div>Cor: <b>${area.color || '#1e293b'}</b></div>
                    <div>Campo: <b>${area.personalizationFieldId || 'Geral'}</b></div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;
    }

    if (activeTab === 'pdfbase') {
      const baseMeta = product.basePdfMetadata;
      return `
        <div>
          <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 4px;">PDF Base Imutável do Produto</h4>
          <p style="font-size: 11px; color: var(--text-secondary); margin-bottom: 12px;">
            O PDF base é sempre preservado de forma 100% imutável. Cada personalização gera um novo PDF vetorial independente.
          </p>

          <div style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px; margin-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="font-size: 28px;">📄</div>
              <div>
                <b>${baseMeta ? escapeHtml(baseMeta.name) : 'Gabarito Vetorial Nativo do PAPER MAX'}</b>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                  Dimensões: ${baseMeta?.width || 595} × ${baseMeta?.height || 842} pt (A4) · Páginas: ${baseMeta?.pageCount || 1}
                </div>
              </div>
            </div>
          </div>

          <div class="file-drop-area" id="pcfg-pdf-drop-area" style="padding: 24px 16px;">
            <div style="font-size: 24px; margin-bottom: 6px;">📤</div>
            <div style="font-weight: 600; font-size: 12px;">Carregar PDF Base Próprio (.pdf)</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
              Substitui o arquivo base por um arquivo de molde personalizado criado no CorelDRAW, Illustrator ou Canva.
            </div>
            <input type="file" id="pcfg-pdf-file-input" accept=".pdf,application/pdf" style="display: none;" />
          </div>
          <div id="pcfg-pdf-feedback" style="margin-top: 8px; font-size: 12px;"></div>
        </div>
      `;
    }
  }

  function bindTabEvents(drawer) {
    // Abas
    drawer.querySelectorAll('[data-tab-btn]').forEach(btn => {
      btn.addEventListener('click', () => {
        saveCurrentTabInputs(drawer);
        activeTab = btn.dataset.tabBtn;
        drawer.querySelector('#drawer-dynamic-content').innerHTML = renderDrawerContent();
        bindTabEvents(drawer);
      });
    });

    // Eventos específicos por aba
    if (activeTab === 'personalizacao') {
      drawer.querySelector('#btn-add-pfield')?.addEventListener('click', () => {
        const name = prompt('Nome / Rótulo do campo (ex: Nome do Aniversariante, Data, Frase):');
        if (!name || !name.trim()) return;
        const id = 'field_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const isRequired = confirm('Este campo é obrigatório no pedido?');
        product.personalizationFields = product.personalizationFields || [];
        product.personalizationFields.push({
          id,
          name: name.trim(),
          type: 'text',
          required: isRequired,
          defaultValue: ''
        });
        drawer.querySelector('#drawer-dynamic-content').innerHTML = renderDrawerContent();
        bindTabEvents(drawer);
      });

      drawer.querySelectorAll('.btn-del-pfield').forEach(btn => {
        btn.addEventListener('click', e => {
          const idx = parseInt(e.target.dataset.index, 10);
          product.personalizationFields.splice(idx, 1);
          drawer.querySelector('#drawer-dynamic-content').innerHTML = renderDrawerContent();
          bindTabEvents(drawer);
        });
      });
    }

    if (activeTab === 'alteracoes') {
      drawer.querySelector('#btn-add-copt')?.addEventListener('click', () => {
        const name = prompt('Nome da opção de alteração (ex: Tipo de Alça, Cor da Sacola):');
        if (!name || !name.trim()) return;
        const choicesStr = prompt('Opções separadas por vírgula (ex: Cetim, Nylon, Gorgurão):', 'Cetim, Nylon');
        const choices = (choicesStr || '').split(',').map(s => s.trim()).filter(Boolean);
        const id = 'opt_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        product.changeOptions = product.changeOptions || [];
        product.changeOptions.push({
          id,
          name: name.trim(),
          type: 'choice',
          required: true,
          defaultValue: choices[0] || '',
          choices: choices.length > 0 ? choices : ['Opção 1', 'Opção 2']
        });
        drawer.querySelector('#drawer-dynamic-content').innerHTML = renderDrawerContent();
        bindTabEvents(drawer);
      });

      drawer.querySelectorAll('.btn-del-copt').forEach(btn => {
        btn.addEventListener('click', e => {
          const idx = parseInt(e.target.dataset.index, 10);
          product.changeOptions.splice(idx, 1);
          drawer.querySelector('#drawer-dynamic-content').innerHTML = renderDrawerContent();
          bindTabEvents(drawer);
        });
      });
    }

    if (activeTab === 'gabarito') {
      drawer.querySelector('#btn-add-textarea')?.addEventListener('click', () => {
        const name = prompt('Nome da Área de Texto (ex: Área do Nome Central):', 'Área de Texto');
        if (!name) return;
        const posX = parseInt(prompt('Posição X (em pontos, ex: 120):', '120'), 10) || 100;
        const posY = parseInt(prompt('Posição Y (em pontos, ex: 380):', '380'), 10) || 300;
        const fSize = parseInt(prompt('Tamanho da Fonte (em pt, ex: 24):', '24'), 10) || 20;

        product.editor = product.editor || { textAreas: [], elementAreas: [], colorAreas: [] };
        product.editor.textAreas = product.editor.textAreas || [];
        product.editor.textAreas.push({
          id: 'area_txt_' + Date.now(),
          name,
          label: name,
          page: 1,
          x: posX,
          y: posY,
          width: 350,
          height: 40,
          alignment: 'center',
          fontFamily: 'Helvetica',
          fontSize: fSize,
          fontWeight: 'bold',
          color: '#1e293b',
          personalizationFieldId: product.personalizationFields?.[0]?.id || ''
        });

        drawer.querySelector('#drawer-dynamic-content').innerHTML = renderDrawerContent();
        bindTabEvents(drawer);
      });

      drawer.querySelectorAll('.btn-del-textarea').forEach(btn => {
        btn.addEventListener('click', e => {
          const idx = parseInt(e.target.dataset.index, 10);
          product.editor.textAreas.splice(idx, 1);
          drawer.querySelector('#drawer-dynamic-content').innerHTML = renderDrawerContent();
          bindTabEvents(drawer);
        });
      });
    }

    if (activeTab === 'pdfbase') {
      const dropArea = drawer.querySelector('#pcfg-pdf-drop-area');
      const fileInput = drawer.querySelector('#pcfg-pdf-file-input');
      const feedback = drawer.querySelector('#pcfg-pdf-feedback');

      if (dropArea && fileInput) {
        dropArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async e => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            feedback.innerHTML = '<span style="color: #4f46e5;">Processando e validando PDF base...</span>';
            const meta = await uploadCustomBasePdf(product, file);
            product.basePdfMetadata = meta;
            feedback.innerHTML = `<span style="color: #059669;">✓ PDF base "${escapeHtml(meta.name)}" carregado e salvo com sucesso!</span>`;
            setTimeout(() => {
              drawer.querySelector('#drawer-dynamic-content').innerHTML = renderDrawerContent();
              bindTabEvents(drawer);
            }, 800);
          } catch (err) {
            feedback.innerHTML = `<span style="color: #dc2626;">⚠ ${escapeHtml(err.message)}</span>`;
          }
        });
      }
    }
  }

  function saveCurrentTabInputs(drawer) {
    if (activeTab === 'geral') {
      const nameInp = drawer.querySelector('#inp-pcfg-name');
      if (nameInp) product.name = nameInp.value.trim();
      const catInp = drawer.querySelector('#inp-pcfg-cat');
      if (catInp) product.categoryId = catInp.value;
      const descInp = drawer.querySelector('#inp-pcfg-desc');
      if (descInp) product.description = descInp.value;
      const priceInp = drawer.querySelector('#inp-pcfg-price');
      if (priceInp) product.price = parseFloat(priceInp.value) || 0;
      const costInp = drawer.querySelector('#inp-pcfg-cost');
      if (costInp) product.cost = parseFloat(costInp.value) || 0;
      const timeInp = drawer.querySelector('#inp-pcfg-time');
      if (timeInp) product.productionTime = parseInt(timeInp.value, 10) || 1;
      const statusInp = drawer.querySelector('#inp-pcfg-status');
      if (statusInp) product.status = statusInp.value;
    }
  }

  const footerHtml = `
    <button class="btn" id="btn-cancel-pcfg">Cancelar</button>
    <button class="btn btn-primary" id="btn-save-pcfg">Salvar Configurações</button>
  `;

  openDrawerFn({
    title: isEdit ? `Configurar Molde / Produto · ${escapeHtml(product.name)}` : 'Cadastrar Novo Molde / Produto',
    contentHtml: `<div id="drawer-dynamic-content">${renderDrawerContent()}</div>`,
    footerHtml,
    onMount: (drawer) => {
      bindTabEvents(drawer);

      drawer.querySelector('#btn-cancel-pcfg').addEventListener('click', closeDrawerFn);

      drawer.querySelector('#btn-save-pcfg').addEventListener('click', () => {
        saveCurrentTabInputs(drawer);

        // Clear previous errors
        drawer.querySelectorAll('.input-invalid').forEach(el => el.classList.remove('input-invalid'));
        drawer.querySelectorAll('.field-error-msg').forEach(el => el.remove());

        if (!product.name || !product.name.trim()) {
          activeTab = 'geral';
          drawer.querySelector('#drawer-dynamic-content').innerHTML = renderDrawerContent();
          bindTabEvents(drawer);

          const nameInp = drawer.querySelector('#inp-pcfg-name');
          if (nameInp) {
            nameInp.classList.add('input-invalid');
            const errSpan = document.createElement('div');
            errSpan.className = 'field-error-msg';
            errSpan.innerHTML = '⚠ Informe o Nome do produto na aba Geral.';
            nameInp.parentNode.appendChild(errSpan);
            nameInp.focus();
            nameInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }

        try {
          let savedProduct;
          if (isEdit) {
            savedProduct = updateProduct(product.id, product);
            showToast(`Produto "${savedProduct.name}" atualizado com sucesso!`);
          } else {
            savedProduct = createProduct(product);
            showToast(`Produto "${savedProduct.name}" cadastrado com sucesso!`);
          }

          closeDrawerFn();
          if (typeof onSaved === 'function') onSaved(savedProduct);
        } catch (err) {
          alert(err.message);
        }
      });
    }
  });
}
