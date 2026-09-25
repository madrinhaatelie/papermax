/**
 * PAPER MAX - Editor Completo de Produto & Molde (product.editor.ui.js)
 * 
 * Estrutura do Wizard em 4 Passos:
 * PASSO 01: PRODUTO (Ativo/Inativo, Nome, Categoria (+), Sub-categoria (+), Descrição, Preview 3D Mockup 3 posições)
 * PASSO 02: PRECIFICAÇÃO (Precificação Inteligente, Dias Produção, Valor De, Valor Por, Histórico de Valor)
 * PASSO 03: PERSONALIZAÇÃO & OPÇÕES (Campos de Personalização + Opções de Alteração unificadas)
 * PASSO 04: PDF + GABARITO (Molde do Produto, Upload PNG/PDF, Apontamento de Áreas de Alteração)
 */

import { getProductById, createProduct, updateProduct, isSmartMold } from './products.js';
import { getCategories, createCategory, createSubcategory, getSubcategories } from '../categories/categories.js';
import { uploadCustomBasePdf } from '../personalization/pdf.engine.js';
import { loadMaterials, loadComponents } from '../../data/storage.js';
import { 
  BASE_UNITS, 
  UNIT_MAP,
  convertUnit, 
  calculateMaterialUnitCosts, 
  calculateComponentCost,
  buildMaterialsMap,
  buildComponentsMap
} from '../stock/stock.engine.js';
import { formatCurrency, escapeHtml, generateId } from '../../utils/sanitize.js';
import { showToast } from '../../core/events.js';
import { fileStorage } from '../../data/filestorage.js';

/**
 * Processa e otimiza um arquivo de imagem utilizando HTML5 Canvas.
 * Redimensiona proporcionalmente para até maxWidth x maxHeight e gera DataURL compactada,
 * persistindo também no IndexedDB via fileStorage.
 */
export async function processImageFile(file, maxWidth = 900, maxHeight = 900, quality = 0.85) {
  if (!file) throw new Error('Nenhum arquivo informado.');
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          let dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          const fileId = 'img_' + generateId('f');

          canvas.toBlob(async (blob) => {
            if (blob) {
              try {
                await fileStorage.saveFile(fileId, blob, {
                  name: file.name,
                  type: blob.type,
                  width,
                  height
                });
              } catch (err) {
                console.warn('[ImageUpload] IndexedDB save warning:', err);
              }
            }
          }, 'image/webp', quality);

          resolve({
            fileId,
            dataUrl,
            name: file.name,
            size: file.size,
            width,
            height
          });
        } catch (procErr) {
          reject(procErr);
        }
      };
      img.onerror = () => reject(new Error('Falha ao decodificar a imagem selecionada.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Erro ao ler os dados do arquivo.'));
    reader.readAsDataURL(file);
  });
}

export function openProductConfigDrawer({
  productId = null,
  openDrawerFn,
  closeDrawerFn,
  onSaved = null
}) {
  const isEdit = Boolean(productId);
  let product = isEdit ? getProductById(productId) : null;

  if (isEdit && !product) {
    showToast('Produto não encontrado.', '⚠');
    return;
  }

  // Se for novo produto, cria estrutura inicial completa
  if (!product) {
    product = {
      name: '',
      categoryId: '',
      subcategoryId: '',
      status: 'ativo',
      type: 'personalizado',
      isKit: false,
      kitMinQuantity: 10,
      kitTiers: [],
      description: '',
      price: 30.00,
      priceFrom: 35.00,
      cost: 12.50,
      productionTime: 2,
      configurationVersion: 1,
      priceHistory: [
        { price: 30.00, date: new Date().toLocaleDateString('pt-BR') }
      ],
      imageUrl: '',
      images: [],
      mockups: {
        front: '',
        angle: '',
        back: ''
      },
      composition: [],
      personalizationFields: [
        { id: 'field_nome', name: 'Nome da Criança', type: 'text', required: true, defaultValue: '' },
        { id: 'field_idade', name: 'Idade', type: 'number', required: false, defaultValue: '' }
      ],
      changeOptions: [
        { id: 'opt_cor', name: 'Cor da Sacola', type: 'choice', required: true, defaultValue: 'Rosa', choices: ['Rosa', 'Azul', 'Branco', 'Kraft'] },
        { id: 'opt_alca', name: 'Tipo de Alça', type: 'choice', required: true, defaultValue: 'Cetim', choices: ['Cetim', 'Nylon', 'Gorgurão'] }
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
    // Clona para evitar mutações diretas
    product = JSON.parse(JSON.stringify(product));
    if (!product.priceHistory || !Array.isArray(product.priceHistory)) {
      product.priceHistory = [
        { price: product.price || 30.00, date: new Date().toLocaleDateString('pt-BR') }
      ];
    }
    if (!product.mockups) {
      product.mockups = { front: product.imageUrl || '', angle: '', back: '' };
    }
    if (!product.images || !Array.isArray(product.images)) {
      product.images = [];
      if (product.mockups?.front || product.imageUrl) {
        product.images.push({
          id: 'img_' + generateId('i'),
          url: product.mockups?.front || product.imageUrl,
          angle: 'front',
          name: 'Foto Principal'
        });
      }
      if (product.mockups?.angle && product.mockups.angle !== (product.mockups?.front || product.imageUrl)) {
        product.images.push({
          id: 'img_' + generateId('i'),
          url: product.mockups.angle,
          angle: 'angle',
          name: 'Foto Lateral'
        });
      }
      if (product.mockups?.back && product.mockups.back !== (product.mockups?.front || product.imageUrl) && product.mockups.back !== product.mockups.angle) {
        product.images.push({
          id: 'img_' + generateId('i'),
          url: product.mockups.back,
          angle: 'back',
          name: 'Foto Verso'
        });
      }
    }
    if (!product.composition || !Array.isArray(product.composition)) {
      product.composition = [];
    }
    if (product.isKit === undefined) product.isKit = false;
    if (!product.kitTiers || !Array.isArray(product.kitTiers)) product.kitTiers = [];
    if (!product.kitMinQuantity) product.kitMinQuantity = product.isKit && product.kitTiers.length > 0 ? product.kitTiers[0].quantity : 10;
  }

  let activeStep = 1; // 1: Produto | 2: Insumos & Componentes | 3: Precificação | 4: Personalização | 5: PDF + Gabarito
  let activeMockupTab = 'front'; // 'front' | 'angle' | 'back'
  
  // UI inline form toggle states
  let isAddingCategory = false;
  let isAddingSubcategory = false;
  let isAddingCompositionItem = false;
  let isAddingField = false;
  let isAddingOption = false;
  let isAddingPriceHistory = false;
  let isAddingArea = false;
  let isAddingKitTier = false;

  // Helper to generate smart kit packages
  function generateDefaultKitTiers(preset = 'standard') {
    const pPrice = Number(product.price) || 30.00;
    // Estimate unit price if price currently reflects a kit or unit
    let baseUnit = pPrice > 25 ? (pPrice / 10) : (pPrice > 0 ? pPrice : 3.00);
    if (baseUnit < 0.50) baseUnit = 3.00;

    let quantities = [10, 25, 50, 100];
    if (preset === 'party') {
      quantities = [15, 20, 30, 50];
    }

    const discountRates = [1.0, 0.92, 0.86, 0.80];

    product.kitTiers = quantities.map((qty, idx) => {
      const rate = discountRates[idx] || 0.80;
      const unitP = Math.max(0.10, Math.round(baseUnit * rate * 100) / 100);
      const tierPrice = Math.round(qty * unitP * 100) / 100;
      return {
        id: 'tier_' + Date.now() + '_' + qty,
        name: `Kit ${qty} unidades`,
        quantity: qty,
        price: tierPrice,
        unitPrice: unitP,
        isDefault: idx === 1 || (quantities.length === 1 && idx === 0)
      };
    });

    if (!product.kitTiers.some(t => t.isDefault) && product.kitTiers.length > 0) {
      product.kitTiers[0].isDefault = true;
    }

    const defaultTier = product.kitTiers.find(t => t.isDefault) || product.kitTiers[0];
    if (defaultTier) {
      product.price = defaultTier.price;
      product.kitMinQuantity = quantities[0];
    }
  }

  // Selected item type in composition form ('insumo' | 'componente')
  let selectedCompItemType = 'insumo';

  function getCompositionSummary() {
    const materials = loadMaterials();
    const components = loadComponents();
    const materialsMap = buildMaterialsMap(materials);
    const componentsMap = buildComponentsMap(components);

    const composition = product.composition || [];
    let totalCost = 0;
    const detailedItems = [];

    for (const item of composition) {
      const rawId = item.itemId || item.materialId || item.componentId;
      const isComp = item.type === 'componente' || (!materialsMap[rawId] && componentsMap[rawId]);
      const qty = Number(item.quantity) || 0;

      if (isComp) {
        const comp = componentsMap[rawId];
        const unitCost = comp ? calculateComponentCost(comp, materialsMap, componentsMap) : 0;
        const subtotal = unitCost * qty;
        totalCost += subtotal;
        detailedItems.push({
          id: item.id || rawId,
          type: 'componente',
          itemId: rawId,
          name: comp ? comp.name : 'Componente desconhecido',
          quantity: qty,
          unit: item.unit || 'un',
          unitCost,
          subtotal,
          stock: comp ? comp.stock || 0 : 0
        });
      } else {
        const mat = materialsMap[rawId];
        let unitCost = 0;
        let subtotal = 0;
        if (mat) {
          const packCost = Number(mat.purchaseCost) || 0;
          const packQty = Number(mat.packQuantity) || 1;
          const packUnit = mat.purchaseUnit || mat.baseUnit || 'un';
          const costPerPack = packQty > 0 ? packCost / packQty : 0;
          const itemUnit = item.unit || mat.baseUnit || 'un';
          const qtyInPack = convertUnit(qty, itemUnit, packUnit, packQty);
          subtotal = qtyInPack * costPerPack;
          unitCost = qty > 0 ? subtotal / qty : 0;
        }
        totalCost += subtotal;
        detailedItems.push({
          id: item.id || rawId,
          type: 'insumo',
          itemId: rawId,
          name: mat ? mat.name : 'Insumo desconhecido',
          category: mat ? mat.category : '',
          quantity: qty,
          unit: item.unit || (mat ? mat.baseUnit : 'un'),
          unitCost,
          subtotal,
          stock: mat ? mat.currentStock || mat.stock || 0 : 0
        });
      }
    }

    return { totalCost, detailedItems, materials, components, materialsMap, componentsMap };
  }

  function renderDrawerContent() {
    const categories = getCategories();
    if (!product.categoryId && categories.length > 0) {
      product.categoryId = categories[0].id;
    }
    const currentSubcategories = getSubcategories(product.categoryId);
    const compSummary = getCompositionSummary();

    const price = Number(product.price) || 0;
    const cost = Number(product.cost) || compSummary.totalCost || 0;
    const profit = Math.max(0, price - cost);
    const marginPct = price > 0 ? ((profit / price) * 100).toFixed(0) : 0;

    return `
      <div class="product-wizard-container">
        <!-- Barra de Progresso / Passos (5 Passos Completos) -->
        <div class="wizard-steps-header" style="display: flex; gap: 4px; overflow-x: auto; flex-wrap: nowrap; margin-bottom: 16px; -webkit-overflow-scrolling: touch; scrollbar-width: none;">
          <button type="button" class="wizard-step-btn ${activeStep === 1 ? 'active' : ''}" data-step="1" style="flex: 1 1 90px; min-width: 80px; flex-shrink: 0; padding: 8px 4px; font-size: 11px; font-weight: 600; border-radius: 6px; border: 1px solid ${activeStep === 1 ? '#4f46e5' : 'var(--border-subtle)'}; background: ${activeStep === 1 ? '#eef2ff' : '#ffffff'}; color: ${activeStep === 1 ? '#4338ca' : 'var(--text-secondary)'}; cursor: pointer; text-align: center;">
            1. Produto
          </button>
          <button type="button" class="wizard-step-btn ${activeStep === 2 ? 'active' : ''}" data-step="2" style="flex: 1 1 90px; min-width: 80px; flex-shrink: 0; padding: 8px 4px; font-size: 11px; font-weight: 600; border-radius: 6px; border: 1px solid ${activeStep === 2 ? '#4f46e5' : 'var(--border-subtle)'}; background: ${activeStep === 2 ? '#eef2ff' : '#ffffff'}; color: ${activeStep === 2 ? '#4338ca' : 'var(--text-secondary)'}; cursor: pointer; text-align: center;">
            2. Insumos (${product.composition?.length || 0})
          </button>
          <button type="button" class="wizard-step-btn ${activeStep === 3 ? 'active' : ''}" data-step="3" style="flex: 1 1 90px; min-width: 80px; flex-shrink: 0; padding: 8px 4px; font-size: 11px; font-weight: 600; border-radius: 6px; border: 1px solid ${activeStep === 3 ? '#4f46e5' : 'var(--border-subtle)'}; background: ${activeStep === 3 ? '#eef2ff' : '#ffffff'}; color: ${activeStep === 3 ? '#4338ca' : 'var(--text-secondary)'}; cursor: pointer; text-align: center;">
            3. Precificação
          </button>
          <button type="button" class="wizard-step-btn ${activeStep === 4 ? 'active' : ''}" data-step="4" style="flex: 1 1 90px; min-width: 80px; flex-shrink: 0; padding: 8px 4px; font-size: 11px; font-weight: 600; border-radius: 6px; border: 1px solid ${activeStep === 4 ? '#4f46e5' : 'var(--border-subtle)'}; background: ${activeStep === 4 ? '#eef2ff' : '#ffffff'}; color: ${activeStep === 4 ? '#4338ca' : 'var(--text-secondary)'}; cursor: pointer; text-align: center;">
            4. Personalização
          </button>
          <button type="button" class="wizard-step-btn ${activeStep === 5 ? 'active' : ''}" data-step="5" style="flex: 1 1 90px; min-width: 80px; flex-shrink: 0; padding: 8px 4px; font-size: 11px; font-weight: 600; border-radius: 6px; border: 1px solid ${activeStep === 5 ? '#4f46e5' : 'var(--border-subtle)'}; background: ${activeStep === 5 ? '#eef2ff' : '#ffffff'}; color: ${activeStep === 5 ? '#4338ca' : 'var(--text-secondary)'}; cursor: pointer; text-align: center;">
            5. PDF + Molde
          </button>
        </div>

        <!-- Conteúdo do Passo Ativo -->
        <div id="wizard-step-content">
          ${renderActiveStepContent(categories, currentSubcategories, { price, cost, profit, marginPct }, compSummary)}
        </div>
      </div>
    `;
  }

  function renderActiveStepContent(categories, subcategories, fin, compSummary) {
    // =========================================================================
    // PASSO 01: PRODUTO
    // =========================================================================
    if (activeStep === 1) {
      const isActive = product.status === 'ativo';

      return `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          
          <!-- Toggle / Checkbox Ativo / Desativado -->
          <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-weight: 700; font-size: 13px; color: var(--text-primary);">Status do Produto</div>
              <div style="font-size: 11.5px; color: var(--text-muted);">Defina se o produto está ativo e disponível para novos pedidos</div>
            </div>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;">
              <input type="checkbox" id="chk-pcfg-active" ${isActive ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #16a34a; cursor: pointer;" />
              <span id="lbl-pcfg-status" style="font-weight: 700; font-size: 12.5px; color: ${isActive ? '#16a34a' : '#64748b'};">
                ${isActive ? 'Ativo' : 'Desativado'}
              </span>
            </label>
          </div>

          <!-- Bloco: Venda em Kit / Lote de Quantidades -->
          <div style="background: ${product.isKit ? '#f0fdf4' : '#f8fafc'}; border: 1px solid ${product.isKit ? '#86efac' : 'var(--border-subtle)'}; border-radius: 8px; padding: 12px 14px; transition: all 0.2s ease;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
              <div style="flex: 1; min-width: 200px;">
                <div style="font-weight: 700; font-size: 13px; color: ${product.isKit ? '#166534' : 'var(--text-primary)'}; display: flex; align-items: center; gap: 6px;">
                  <span>📦 Vender este produto em Kit / Pacotes de Quantidades</span>
                  ${product.isKit ? '<span class="badge-count" style="background: #22c55e; color: #ffffff; font-size: 10px; font-weight: 700;">ATIVO</span>' : ''}
                </div>
                <div style="font-size: 11.5px; color: ${product.isKit ? '#15803d' : 'var(--text-muted)'}; margin-top: 2px;">
                  Para produtos que só vendem em mais quantidades (ex: <b>Tubolata, Tubete, Balinha personalizada, Latinhas, Caixas em lote</b>). Permite incluir diferentes quantidades (10 un, 25 un, 100 un...) com preços progressivos.
                </div>
              </div>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; background: #ffffff; padding: 6px 12px; border-radius: 6px; border: 1px solid ${product.isKit ? '#86efac' : 'var(--border-subtle)'};">
                <input type="checkbox" id="chk-pcfg-iskit" ${product.isKit ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #16a34a; cursor: pointer;" />
                <span id="lbl-pcfg-iskit" style="font-weight: 700; font-size: 12.5px; color: ${product.isKit ? '#15803d' : '#64748b'};">
                  ${product.isKit ? 'Sim, criar Kit' : 'Unidade Avulsa'}
                </span>
              </label>
            </div>
            ${product.isKit ? `
              <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #bbf7d0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                <span style="font-size: 11.5px; color: #166534; font-weight: 600;">
                  ✓ ${(product.kitTiers || []).length} opção(ões) de quantidade configurada(s): ${(product.kitTiers || []).map(t => t.quantity + ' un').join(', ') || 'Nenhuma ainda'}
                </span>
                <button type="button" class="btn btn-sm btn-outline" id="btn-goto-step3-kits" style="font-size: 11px; font-weight: 600; padding: 3px 10px; background: #ffffff; border-color: #86efac; color: #166534;">
                  ⚙️ Gerenciar Quantidades & Preços no Passo 3 ➔
                </button>
              </div>
            ` : ''}
          </div>

          <!-- Nome do Produto -->
          <div class="form-group">
            <label class="form-label" for="inp-pcfg-name"><b>Nome do Produto *</b></label>
            <input class="form-input" id="inp-pcfg-name" value="${escapeHtml(product.name || '')}" placeholder="Ex: Sacola M Kraft com Alça Cetim" required />
          </div>

          <!-- Categoria com botão (+) de criar -->
          <div class="form-group">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <label class="form-label" for="inp-pcfg-cat" style="margin: 0;"><b>Categoria</b></label>
              <button type="button" class="btn btn-sm" id="btn-toggle-add-cat" style="padding: 2px 8px; font-size: 11px; font-weight: 600; color: #4f46e5; background: #eef2ff; border: 1px solid #c7d2fe;">
                + Nova Categoria
              </button>
            </div>
            
            ${isAddingCategory ? `
              <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 6px; padding: 10px; margin-bottom: 8px;">
                <div style="font-size: 11px; font-weight: 700; color: #4338ca; margin-bottom: 4px;">Criar Nova Categoria:</div>
                <div style="display: flex; gap: 6px;">
                  <input type="text" id="inp-new-cat-name" class="form-input" placeholder="Nome da categoria (ex: Caixas)" style="flex: 1;" />
                  <button type="button" class="btn btn-sm btn-primary" id="btn-save-new-cat">Salvar</button>
                  <button type="button" class="btn btn-sm" id="btn-cancel-new-cat">✕</button>
                </div>
              </div>
            ` : ''}

            <select class="form-select" id="inp-pcfg-cat">
              ${categories.length === 0 ? `<option value="">Nenhuma categoria cadastrada</option>` : ''}
              ${categories.map(c => `
                <option value="${c.id}" ${c.id === product.categoryId ? 'selected' : ''}>${escapeHtml(c.name)}</option>
              `).join('')}
            </select>
          </div>

          <!-- Sub-categoria com botão (+) de criar -->
          <div class="form-group">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <label class="form-label" for="inp-pcfg-subcat" style="margin: 0;"><b>Sub-categoria</b></label>
              <button type="button" class="btn btn-sm" id="btn-toggle-add-subcat" style="padding: 2px 8px; font-size: 11px; font-weight: 600; color: #4f46e5; background: #eef2ff; border: 1px solid #c7d2fe;">
                + Nova Sub-categoria
              </button>
            </div>

            ${isAddingSubcategory ? `
              <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 6px; padding: 10px; margin-bottom: 8px;">
                <div style="font-size: 11px; font-weight: 700; color: #4338ca; margin-bottom: 4px;">Criar Nova Sub-categoria:</div>
                <div style="display: flex; gap: 6px;">
                  <input type="text" id="inp-new-subcat-name" class="form-input" placeholder="Nome da sub-categoria (ex: Kraft Luxo)" style="flex: 1;" />
                  <button type="button" class="btn btn-sm btn-primary" id="btn-save-new-subcat">Salvar</button>
                  <button type="button" class="btn btn-sm" id="btn-cancel-new-subcat">✕</button>
                </div>
              </div>
            ` : ''}

            <select class="form-select" id="inp-pcfg-subcat">
              <option value="">Sem sub-categoria específica</option>
              ${subcategories.map(s => `
                <option value="${escapeHtml(s)}" ${s === product.subcategoryId ? 'selected' : ''}>${escapeHtml(s)}</option>
              `).join('')}
            </select>
          </div>

          <!-- Descrição -->
          <div class="form-group">
            <label class="form-label" for="inp-pcfg-desc"><b>Descrição</b></label>
            <textarea class="form-textarea" id="inp-pcfg-desc" rows="3" placeholder="Gramatura do papel, especificações técnicas, acabamento e dimensões em cm...">${escapeHtml(product.description || '')}</textarea>
          </div>

          <!-- Bloco: Upload de Fotos e Galeria do Produto -->
          <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
              <div>
                <div style="font-size: 13px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                  <span>📸</span>
                  <span>Fotos e Galeria do Produto</span>
                </div>
                <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                  Adicione fotos do produto. A foto principal será exibida na vitrine, catálogo e pedidos.
                </div>
              </div>
              <span class="badge-count" style="font-size: 10.5px; background: #f1f5f9; color: #475569;">
                ${(product.images || []).length} ${(product.images || []).length === 1 ? 'foto' : 'fotos'}
              </span>
            </div>

            <!-- Input Oculto de Seleção de Imagens -->
            <input type="file" id="inp-pcfg-gallery-upload" accept="image/png,image/jpeg,image/webp,image/jpg" multiple style="display: none;" />

            <!-- Dropzone com Drag & Drop e Clique -->
            <div id="pcfg-dropzone-gallery" style="border: 2px dashed #cbd5e1; border-radius: 8px; padding: 18px 14px; text-align: center; background: #f8fafc; cursor: pointer; transition: all 0.2s ease;">
              <div style="font-size: 30px; line-height: 1; margin-bottom: 6px;">☁️</div>
              <div style="font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
                Arraste e solte fotos aqui ou <span style="color: #4f46e5; text-decoration: underline;">clique para selecionar</span>
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 10px;">
                Formatos aceitos: PNG, JPG, JPEG, WEBP (suporta seleção múltipla)
              </div>
              <button type="button" class="btn btn-sm btn-primary" id="btn-trigger-gallery-upload" style="pointer-events: none;">
                📁 Selecionar Fotos
              </button>
            </div>

            <div id="pcfg-upload-feedback" style="margin-top: 6px; font-size: 11.5px; text-align: center;"></div>

            <!-- Miniaturas da Galeria de Fotos Carregadas -->
            ${(product.images && product.images.length > 0) ? `
              <div style="margin-top: 14px; border-top: 1px solid var(--border-subtle); padding-top: 12px;">
                <div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;">
                  Fotos Adicionadas (${product.images.length})
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(135px, 1fr)); gap: 10px;">
                  ${product.images.map((img, idx) => {
                    const isFront = img.url === product.mockups?.front || img.url === product.imageUrl;
                    const isAngle = !isFront && img.url === product.mockups?.angle;
                    const isBack = !isFront && !isAngle && img.url === product.mockups?.back;
                    
                    let roleBadge = '<span class="badge-count" style="font-size: 9.5px; background: #f1f5f9; color: #475569;">Galeria</span>';
                    if (isFront) roleBadge = '<span class="badge-count" style="font-size: 9.5px; background: #dcfce7; color: #15803d; font-weight: 700;">⭐ Principal</span>';
                    else if (isAngle) roleBadge = '<span class="badge-count" style="font-size: 9.5px; background: #dbeafe; color: #1d4ed8; font-weight: 700;">📐 Lateral</span>';
                    else if (isBack) roleBadge = '<span class="badge-count" style="font-size: 9.5px; background: #ede9fe; color: #6d28d9; font-weight: 700;">🔄 Verso</span>';

                    return `
                      <div class="product-gallery-card" style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; position: relative; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                        <div style="height: 100px; background: #f8fafc; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative;">
                          <img src="${escapeHtml(img.url)}" alt="Foto ${idx + 1}" style="width: 100%; height: 100%; object-fit: cover;" />
                          <div style="position: absolute; top: 4px; left: 4px;">
                            ${roleBadge}
                          </div>
                          <button type="button" class="btn-del-gallery-img" data-img-idx="${idx}" title="Excluir esta foto" style="position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border-radius: 50%; background: rgba(220,38,38,0.9); color: #ffffff; border: none; font-size: 11px; display: flex; align-items: center; justify-content: center; cursor: pointer; line-height: 1; transition: transform 0.1s;">
                            ✕
                          </button>
                        </div>
                        <div style="padding: 6px 8px; display: flex; flex-direction: column; gap: 4px; background: #ffffff; border-top: 1px solid var(--border-subtle);">
                          <div style="font-size: 10px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(img.name || `Foto ${idx + 1}`)}">
                            ${escapeHtml(img.name || `Foto ${idx + 1}`)}
                          </div>
                          <div style="display: flex; gap: 3px; flex-wrap: wrap;">
                            <button type="button" class="btn btn-sm btn-set-img-angle" data-img-idx="${idx}" data-angle="front" title="Definir como Frente (Principal)" style="flex: 1; padding: 2px 4px; font-size: 9.5px; ${isFront ? 'background: #dcfce7; color: #15803d; font-weight: bold;' : ''}">
                              ${isFront ? '✓ Frente' : 'Frente'}
                            </button>
                            <button type="button" class="btn btn-sm btn-set-img-angle" data-img-idx="${idx}" data-angle="angle" title="Definir como Lateral" style="flex: 1; padding: 2px 4px; font-size: 9.5px; ${isAngle ? 'background: #dbeafe; color: #1d4ed8; font-weight: bold;' : ''}">
                              ${isAngle ? '✓ Lat' : 'Lat'}
                            </button>
                            <button type="button" class="btn btn-sm btn-set-img-angle" data-img-idx="${idx}" data-angle="back" title="Definir como Verso" style="flex: 1; padding: 2px 4px; font-size: 9.5px; ${isBack ? 'background: #ede9fe; color: #6d28d9; font-weight: bold;' : ''}">
                              ${isBack ? '✓ Verso' : 'Verso'}
                            </button>
                          </div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Preview 3D Mockup Estático (03 Posições) -->
          <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div>
                <div style="font-size: 12.5px; font-weight: 700; color: var(--text-primary);">Preview Mockup 3D Estático (03 Posições)</div>
                <div style="font-size: 11px; color: var(--text-muted);">Visualização e fotos do produto em 3 ângulos fotográficos</div>
              </div>
              <span class="badge-count" style="font-size: 10px; background: #e0e7ff; color: #4338ca;">3 Posições</span>
            </div>

            <!-- Abas das 3 posições -->
            <div style="display: flex; gap: 6px; margin-bottom: 12px;">
              <button type="button" class="btn btn-sm ${activeMockupTab === 'front' ? 'btn-primary' : ''}" data-mockup-tab="front" style="flex: 1; font-size: 11px;">
                1. Frente (Principal)
              </button>
              <button type="button" class="btn btn-sm ${activeMockupTab === 'angle' ? 'btn-primary' : ''}" data-mockup-tab="angle" style="flex: 1; font-size: 11px;">
                2. Frente / Lateral
              </button>
              <button type="button" class="btn btn-sm ${activeMockupTab === 'back' ? 'btn-primary' : ''}" data-mockup-tab="back" style="flex: 1; font-size: 11px;">
                3. Verso
              </button>
            </div>

            <!-- Visualização da Posição Selecionada -->
            <div style="background: #f8fafc; border: 1px dashed var(--border-subtle); border-radius: 8px; padding: 16px; text-align: center;">
              ${renderMockupAnglePreview(activeMockupTab, product)}
            </div>

            <!-- Info de compartilhamento para o cliente -->
            <div style="margin-top: 10px; padding: 8px 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 11px; color: #166534; display: flex; align-items: center; gap: 6px;">
              <span>🔗</span>
              <span><b>Link para o cliente:</b> O link interativo de visualização 3D é gerado automaticamente no Pedido após o preenchimento.</span>
            </div>
          </div>

        </div>
      `;
    }

    // =========================================================================
    // PASSO 02: INSUMOS & COMPONENTES (FICHA TÉCNICA / COMPOSIÇÃO)
    // =========================================================================
    if (activeStep === 2) {
      const items = compSummary.detailedItems || [];
      const totalCompositionCost = compSummary.totalCost || 0;
      const materials = compSummary.materials || [];
      const components = compSummary.components || [];

      return `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          
          <!-- Card de Destaque / Custo da Composição -->
          <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
              <div>
                <span style="font-weight: 700; font-size: 13px; color: var(--text-primary);">🧩 Ficha Técnica & Composição de Materiais</span>
                <div style="font-size: 11px; color: var(--text-muted);">Insumos e componentes consumidos por cada unidade produzida</div>
              </div>
              <button type="button" class="btn btn-sm btn-primary" id="btn-sync-comp-cost" style="font-size: 11px; padding: 4px 10px;">
                ⚡ Aplicar ao Custo Base (${formatCurrency(totalCompositionCost)})
              </button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
              <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px; text-align: center;">
                <div style="font-size: 10.5px; color: var(--text-muted);">Itens na Ficha</div>
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-top: 2px;">${items.length} itens</div>
              </div>
              <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px; text-align: center;">
                <div style="font-size: 10.5px; color: var(--text-muted);">Custo Total Insumos</div>
                <div style="font-weight: 700; font-size: 14px; color: #16a34a; margin-top: 2px;">${formatCurrency(totalCompositionCost)}</div>
              </div>
              <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px; text-align: center;">
                <div style="font-size: 10.5px; color: var(--text-muted);">Custo Base Atual</div>
                <div style="font-weight: 700; font-size: 14px; color: #4f46e5; margin-top: 2px;">${formatCurrency(product.cost || 0)}</div>
              </div>
            </div>
          </div>

          <!-- Ações e Formulário de Inclusão de Insumo/Componente -->
          <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div>
                <div style="font-weight: 700; font-size: 13px; color: var(--text-primary);">Materiais & Componentes Utilizados</div>
                <div style="font-size: 11px; color: var(--text-muted);">Papéis, fitas, colas, ilhós, apliques e itens pré-montados</div>
              </div>
              <button type="button" class="btn btn-sm btn-primary" id="btn-toggle-add-comp-item">
                + Adicionar Material / Insumo
              </button>
            </div>

            <!-- Formulário Inline para Incluir Insumo / Componente -->
            ${isAddingCompositionItem ? `
              <div style="background: #f8fafc; border: 1px solid #c7d2fe; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                <div style="font-size: 12px; font-weight: 700; color: #4338ca; margin-bottom: 8px;">Adicionar à Composição do Produto:</div>
                
                <!-- Tipo de Item (Insumo ou Componente) -->
                <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                  <button type="button" class="btn btn-sm ${selectedCompItemType === 'insumo' ? 'btn-primary' : ''}" id="btn-sel-type-insumo" style="flex: 1; font-size: 11px;">
                    📦 Insumo Básico
                  </button>
                  <button type="button" class="btn btn-sm ${selectedCompItemType === 'componente' ? 'btn-primary' : ''}" id="btn-sel-type-componente" style="flex: 1; font-size: 11px;">
                    🧩 Componente Pré-montado
                  </button>
                </div>

                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                  <div>
                    <label style="font-size: 10.5px; font-weight: 600; color: var(--text-secondary);">
                      ${selectedCompItemType === 'insumo' ? 'Selecione o Insumo *' : 'Selecione o Componente *'}
                    </label>
                    <select id="sel-comp-item-id" class="form-select">
                      ${selectedCompItemType === 'insumo' ? (
                        materials.length === 0 ? '<option value="">Nenhum insumo cadastrado</option>' :
                        materials.map(m => {
                          const costs = calculateMaterialUnitCosts(m);
                          return `<option value="${m.id}" data-unit="${m.baseUnit || 'un'}" data-cost="${costs.baseUnitCost || 0}">${escapeHtml(m.name)} (Saldo: ${m.currentStock || m.stock || 0} ${m.baseUnit || 'un'} · R$ ${(costs.baseUnitCost || 0).toFixed(4).replace('.', ',')}/${m.baseUnit || 'un'})</option>`;
                        }).join('')
                      ) : (
                        components.length === 0 ? '<option value="">Nenhum componente cadastrado</option>' :
                        components.map(c => {
                          const unitCost = calculateComponentCost(c, compSummary.materialsMap, compSummary.componentsMap);
                          return `<option value="${c.id}" data-unit="un" data-cost="${unitCost}">${escapeHtml(c.name)} (Custo: R$ ${unitCost.toFixed(2).replace('.', ',')} · Saldo: ${c.stock || 0} un)</option>`;
                        }).join('')
                      )}
                    </select>
                  </div>

                  <div>
                    <label style="font-size: 10.5px; font-weight: 600; color: var(--text-secondary);">Quantidade Consumida *</label>
                    <input type="number" step="0.01" min="0.001" id="inp-comp-item-qty" class="form-input" value="1" placeholder="Ex: 1 ou 0.40" />
                  </div>

                  <div>
                    <label style="font-size: 10.5px; font-weight: 600; color: var(--text-secondary);">Unidade</label>
                    <select id="sel-comp-item-unit" class="form-select">
                      <option value="un">un (Unidades)</option>
                      <option value="folha">folha (Folhas)</option>
                      <option value="m">m (Metros)</option>
                      <option value="cm">cm (Centímetros)</option>
                      <option value="mm">mm (Milímetros)</option>
                      <option value="g">g (Gramas)</option>
                      <option value="kg">kg (Quilos)</option>
                      <option value="ml">ml (Mililitros)</option>
                      <option value="placa">placa (Placas)</option>
                      <option value="tira">tira (Tiras)</option>
                    </select>
                  </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 6px;">
                  <button type="button" class="btn btn-sm" id="btn-cancel-comp-item">Cancelar</button>
                  <button type="button" class="btn btn-sm btn-primary" id="btn-save-comp-item">Adicionar à Ficha</button>
                </div>
              </div>
            ` : ''}

            <!-- Lista de Itens da Composição -->
            ${items.length === 0 ? `
              <div style="background: #f8fafc; padding: 18px; border-radius: 6px; text-align: center; color: var(--text-muted); font-size: 11.5px; border: 1px dashed var(--border-subtle);">
                <div style="font-size: 24px; margin-bottom: 4px;">📦</div>
                Nenhum insumo ou componente adicionado a este produto.<br/>
                Clique em <b>"+ Adicionar Material / Insumo"</b> para montar a ficha técnica e calcular o custo automático.
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${items.map((item, idx) => `
                  <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="font-size: 16px;">${item.type === 'componente' ? '🧩' : '📦'}</span>
                      <div>
                        <div style="font-weight: 700; font-size: 12.5px; color: var(--text-primary);">
                          ${escapeHtml(item.name)}
                          <span class="badge-count" style="font-size: 9.5px; margin-left: 4px; background: ${item.type === 'componente' ? '#e0e7ff' : '#f1f5f9'}; color: ${item.type === 'componente' ? '#4338ca' : '#475569'};">
                            ${item.type === 'componente' ? 'Componente' : 'Insumo'}
                          </span>
                        </div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 1px;">
                          Consumo: <b>${item.quantity} ${item.unit}</b> · Custo: <b>R$ ${item.unitCost.toFixed(4).replace('.', ',')}/${item.unit}</b> · Saldo em estoque: <b>${item.stock} ${item.unit}</b>
                        </div>
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <span style="font-weight: 700; font-size: 12.5px; color: #16a34a;">
                        ${formatCurrency(item.subtotal)}
                      </span>
                      <button type="button" class="btn-del-comp-item" data-index="${idx}" style="color: #ef4444; background: transparent; border: none; font-size: 14px; cursor: pointer; padding: 4px;" title="Remover da Composição">
                        🗑️
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

        </div>
      `;
    }

    // =========================================================================
    // PASSO 03: PRECIFICAÇÃO
    // =========================================================================
    if (activeStep === 3) {
      const priceFrom = Number(product.priceFrom) || Number(product.price) || 0;
      const priceTo = Number(product.price) || 0;
      const days = Number(product.productionTime) || 1;
      const machineWearRate = Number(product.machineWearRate) || 0;
      const totalCompositionCost = compSummary.totalCost || 0;
      const totalCalculatedProductionCost = Number((totalCompositionCost + machineWearRate).toFixed(2));
      const cost = Number(product.cost) || totalCalculatedProductionCost || 0;
      const unitProfit = Math.max(0, priceTo - cost);
      const marginPct = priceTo > 0 ? ((unitProfit / priceTo) * 100).toFixed(1) : 0;
      const history = product.priceHistory || [];

      return `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          
          <!-- Banner de Vínculo com a Ficha Técnica de Insumos & Reposição -->
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <div style="font-size: 12px; color: #166534;">
              <div style="font-weight: 700; font-size: 13px;">🧩 Ficha Técnica: Insumos (R$ ${totalCompositionCost.toFixed(2).replace('.', ',')}) + Desgaste de Máquina (R$ ${machineWearRate.toFixed(2).replace('.', ',')})</div>
              <div style="font-size: 11px; color: #15803d; margin-top: 2px;">Custo Total de Produção Sugerido: <b>${formatCurrency(totalCalculatedProductionCost)}</b> (${product.composition?.length || 0} insumos cadastrados)</div>
            </div>
            <button type="button" class="btn btn-sm" id="btn-sync-cost-step3" style="font-size: 11px; padding: 4px 10px; background: #ffffff; border: 1px solid #86efac; color: #166534; font-weight: 700; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
              ⚡ Aplicar Custo Sugerido (${formatCurrency(totalCalculatedProductionCost)})
            </button>
          </div>

          <!-- Precificação Completa Inteligente -->
          <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div>
                <span style="font-weight: 700; font-size: 13px; color: var(--text-primary);">📊 Precificação Completa Inteligente</span>
                <div style="font-size: 11px; color: var(--text-muted);">Cálculo em tempo real baseado em insumos, reposição/desgaste e margem de lucro</div>
              </div>
              <span id="disp-margin-badge" class="badge-count" style="background: ${marginPct >= 30 ? '#dcfce7' : marginPct >= 15 ? '#fef3c7' : '#fee2e2'}; color: ${marginPct >= 30 ? '#15803d' : marginPct >= 15 ? '#b45309' : '#dc2626'}; font-size: 10.5px; font-weight: 700;">
                ${marginPct >= 30 ? 'Margem Saudável' : marginPct >= 15 ? 'Margem Média' : 'Margem Baixa'}
              </span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
              <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px; text-align: center;">
                <div style="font-size: 10.5px; color: var(--text-muted);">Insumos e Materiais</div>
                <div style="font-weight: 700; font-size: 13.5px; color: #0284c7; margin-top: 2px;">${formatCurrency(totalCompositionCost)}</div>
              </div>
              <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px; text-align: center;">
                <div style="font-size: 10.5px; color: var(--text-muted);">Desgaste Máquina</div>
                <div style="font-weight: 700; font-size: 13.5px; color: #854d0e; margin-top: 2px;" id="disp-wear-val">${formatCurrency(machineWearRate)}</div>
              </div>
              <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px; text-align: center;">
                <div style="font-size: 10.5px; color: var(--text-muted);">Custo Base Unitário</div>
                <div style="font-weight: 700; font-size: 13.5px; color: var(--text-primary); margin-top: 2px;" id="disp-cost-val">${formatCurrency(cost)}</div>
              </div>
              <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px; text-align: center;">
                <div style="font-size: 10.5px; color: var(--text-muted);">Lucro Líquido</div>
                <div style="font-weight: 700; font-size: 13.5px; color: #16a34a; margin-top: 2px;" id="disp-profit-val">${formatCurrency(unitProfit)} (${marginPct}%)</div>
              </div>
            </div>
          </div>

          <!-- Seção de Desgaste de Máquina & Ferramentas (Reposição) -->
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
              <div>
                <span style="font-weight: 700; font-size: 12.5px; color: #92400e;">⚙️ Taxa de Desgaste de Máquinas & Ferramentas (Reposição)</span>
                <div style="font-size: 11px; color: #78350f;">
                  Rateio estimado para reposição de lâminas de corte, bases, refis de guilhotina e manutenção.
                </div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; margin-top: 6px;">
              <div>
                <label class="form-label" for="inp-pcfg-machinewear" style="font-size: 11px; color: #92400e;"><b>Taxa de Desgaste por Unidade Produzida (R$)</b></label>
                <input type="number" step="0.05" min="0" class="form-input" id="inp-pcfg-machinewear" value="${machineWearRate}" placeholder="Ex: 0.50" style="background: #ffffff;" />
              </div>
              <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 14px;">
                <button type="button" class="btn btn-sm btn-wear-preset" data-wear="0.30" style="font-size: 10.5px; padding: 3px 8px; background: #ffffff; border: 1px solid #fcd34d; color: #92400e;">+ R$ 0,30 (Corte Simples)</button>
                <button type="button" class="btn btn-sm btn-wear-preset" data-wear="0.60" style="font-size: 10.5px; padding: 3px 8px; background: #ffffff; border: 1px solid #fcd34d; color: #92400e;">+ R$ 0,60 (Corte + Vinco)</button>
                <button type="button" class="btn btn-sm btn-wear-preset" data-wear="1.20" style="font-size: 10.5px; padding: 3px 8px; background: #ffffff; border: 1px solid #fcd34d; color: #92400e;">+ R$ 1,20 (Laminação + Plotter)</button>
                <button type="button" class="btn btn-sm btn-wear-preset" data-wear="0.00" style="font-size: 10.5px; padding: 3px 8px; background: #ffffff; border: 1px solid #cbd5e1; color: #64748b;">Zerar</button>
              </div>
            </div>
          </div>

          <!-- Campos de Valores e Produção -->
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="inp-pcfg-time"><b>Dias de Produção</b></label>
              <input type="number" class="form-input" id="inp-pcfg-time" value="${days}" min="1" />
            </div>
            <div class="form-group">
              <label class="form-label" for="inp-pcfg-pricefrom"><b>Valor "DE" (R$)</b></label>
              <input type="number" step="0.50" class="form-input" id="inp-pcfg-pricefrom" value="${priceFrom}" placeholder="35.00" />
            </div>
            <div class="form-group">
              <label class="form-label" for="inp-pcfg-price"><b>Valor "POR" (R$) *</b></label>
              <input type="number" step="0.50" class="form-input" id="inp-pcfg-price" value="${priceTo}" placeholder="30.00" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="inp-pcfg-cost"><b>Custo Base de Produção (R$)</b></label>
            <input type="number" step="0.50" class="form-input" id="inp-pcfg-cost" value="${cost}" placeholder="12.50" />
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
              Total consolidado de insumos e custos que será abatido no cálculo de lucro do produto.
            </div>
          </div>

          <!-- Bloco do Kit e Pacotes de Quantidade -->
          <div style="background: ${product.isKit ? '#f0fdf4' : '#ffffff'}; border: 1px solid ${product.isKit ? '#86efac' : 'var(--border-subtle)'}; border-radius: 8px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
              <div>
                <div style="font-size: 13px; font-weight: 700; color: ${product.isKit ? '#166534' : 'var(--text-primary)'}; display: flex; align-items: center; gap: 6px;">
                  <span>📦 Opções de Quantidades / Pacotes do Kit</span>
                  ${product.isKit ? '<span class="badge-count" style="background: #22c55e; color: #ffffff; font-size: 10px; font-weight: 700;">KIT ATIVO</span>' : ''}
                </div>
                <div style="font-size: 11px; color: ${product.isKit ? '#15803d' : 'var(--text-muted)'}; margin-top: 2px;">
                  Cadastre as opções de quantidades para venda (ex: 10 un, 25 un, 50 un, 100 un) com preços e margens específicas.
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 8px;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; background: #ffffff; padding: 5px 10px; border-radius: 6px; border: 1px solid ${product.isKit ? '#86efac' : 'var(--border-subtle)'}; font-size: 11.5px; font-weight: 600;">
                  <input type="checkbox" id="chk-pcfg-iskit-step3" ${product.isKit ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #16a34a; cursor: pointer;" />
                  <span style="color: ${product.isKit ? '#166534' : 'var(--text-primary)'};">${product.isKit ? 'Ativado como Kit' : 'Ativar Modo Kit'}</span>
                </label>
              </div>
            </div>

            ${!product.isKit ? `
              <div style="text-align: center; padding: 14px; background: #f8fafc; border: 1px dashed var(--border-subtle); border-radius: 6px; color: var(--text-muted); font-size: 12px;">
                Este produto está configurado para venda por unidade avulsa.<br>
                Para vender apenas em pacotes de quantidades (ex: tubetes, tubolatas, balinhas), marque a opção <b>Ativar Modo Kit</b> acima.
              </div>
            ` : `
              <!-- Ações Rápidas de Pacotes -->
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                  <button type="button" class="btn btn-sm btn-outline" id="btn-suggest-kit-tiers" style="font-size: 11px; font-weight: 600; padding: 4px 10px; background: #ffffff; border-color: #86efac; color: #166534;" title="Gera pacotes de 10, 25, 50 e 100 unidades aplicando descontos progressivos saudáveis">
                    ⚡ Sugerir Pacotes (10, 25, 50 e 100 un)
                  </button>
                  <button type="button" class="btn btn-sm btn-outline" id="btn-suggest-kit-tiers-party" style="font-size: 11px; font-weight: 600; padding: 4px 10px; background: #ffffff; border-color: #86efac; color: #166534;" title="Gera pacotes típicos para festas infantis">
                    ⚡ Sugerir Pacotes (15, 20, 30 e 50 un)
                  </button>
                </div>
                <button type="button" class="btn btn-sm btn-primary" id="btn-toggle-add-tier" style="font-size: 11px; font-weight: 600; padding: 4px 10px;">
                  + Adicionar Quantidade
                </button>
              </div>

              <!-- Formulário Inline de Adição de Pacote -->
              ${isAddingKitTier ? `
                <div style="background: #ffffff; border: 2px solid #86efac; border-radius: 8px; padding: 12px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                  <div style="font-size: 12px; font-weight: 700; color: #166534; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                    <span>➕ Novo Pacote de Quantidade</span>
                  </div>
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; align-items: flex-end;">
                    <div>
                      <label class="form-label" style="font-size: 11px; font-weight: 600; margin-bottom: 2px;">Qtd (unidades) *</label>
                      <input type="number" id="inp-new-tier-qty" class="form-input" placeholder="Ex: 25" min="1" value="25" style="font-size: 12px; font-weight: 700; text-align: center;" />
                    </div>
                    <div>
                      <label class="form-label" style="font-size: 11px; font-weight: 600; margin-bottom: 2px;">Nome / Rótulo</label>
                      <input type="text" id="inp-new-tier-name" class="form-input" placeholder="Ex: Kit 25 unidades" value="Kit 25 unidades" style="font-size: 12px;" />
                    </div>
                    <div>
                      <label class="form-label" style="font-size: 11px; font-weight: 600; margin-bottom: 2px;">Preço Total (R$) *</label>
                      <input type="number" step="0.50" id="inp-new-tier-price" class="form-input" placeholder="Ex: 75.00" value="${((cost * 25 * 2) || 75).toFixed(2)}" style="font-size: 12px; font-weight: 700;" />
                    </div>
                    <div>
                      <button type="button" class="btn btn-sm btn-primary" id="btn-save-new-tier" style="height: 34px; padding: 0 14px; font-weight: 700;">
                        Salvar Pacote
                      </button>
                    </div>
                    <div>
                      <button type="button" class="btn btn-sm btn-secondary" id="btn-cancel-new-tier" style="height: 34px; padding: 0 10px;">
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ` : ''}

              <!-- Tabela / Lista dos Pacotes Cadastrados -->
              <div style="background: #ffffff; border: 1px solid #bbf7d0; border-radius: 8px; overflow: hidden;">
                ${(!product.kitTiers || product.kitTiers.length === 0) ? `
                  <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;">
                    Nenhum pacote de quantidade cadastrado ainda.<br>
                    Clique em <b>⚡ Sugerir Pacotes (10, 25, 50 e 100 un)</b> para criar rapidamente ou adicione um manualmente acima.
                  </div>
                ` : `
                  <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                      <tr style="background: #f0fdf4; border-bottom: 1px solid #bbf7d0; text-align: left;">
                        <th style="padding: 8px 10px; font-weight: 700; color: #166534;">Pacote / Quantidade</th>
                        <th style="padding: 8px 10px; font-weight: 700; color: #166534; text-align: right;">Preço do Kit</th>
                        <th style="padding: 8px 10px; font-weight: 700; color: #166534; text-align: right;">Preço / Un</th>
                        <th style="padding: 8px 10px; font-weight: 700; color: #166534; text-align: right;">Custo Est.</th>
                        <th style="padding: 8px 10px; font-weight: 700; color: #166534; text-align: right;">Lucro Líquido</th>
                        <th style="padding: 8px 10px; font-weight: 700; color: #166534; text-align: center;">Padrão</th>
                        <th style="padding: 8px 10px; font-weight: 700; color: #166534; text-align: center; width: 40px;"></th>
                      </tr>
                    </thead>
                    <tbody>
                      ${product.kitTiers.map(tier => {
                        const tierQty = Number(tier.quantity) || 1;
                        const tierPrice = Number(tier.price) || 0;
                        const tierUnitPrice = tierQty > 0 ? (tierPrice / tierQty) : 0;
                        const tierCost = (Number(cost) || 0) * tierQty;
                        const tierProfit = Math.max(0, tierPrice - tierCost);
                        const tierMargin = tierPrice > 0 ? ((tierProfit / tierPrice) * 100).toFixed(0) : 0;

                        return `
                          <tr style="border-bottom: 1px solid #f0fdf4; background: ${tier.isDefault ? 'rgba(34, 197, 94, 0.05)' : 'transparent'};">
                            <td style="padding: 8px 10px; font-weight: 700; color: var(--text-primary);">
                              ${escapeHtml(tier.name || (tierQty + ' unidades'))}
                              <span style="font-size: 11px; color: var(--text-secondary); font-weight: normal; margin-left: 4px;">(${tierQty} un)</span>
                            </td>
                            <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: #15803d; font-size: 13px;">
                              ${formatCurrency(tierPrice)}
                            </td>
                            <td style="padding: 8px 10px; text-align: right; color: var(--text-secondary);">
                              ${formatCurrency(tierUnitPrice)}/un
                            </td>
                            <td style="padding: 8px 10px; text-align: right; color: var(--text-muted); font-size: 11px;">
                              ${formatCurrency(tierCost)}
                            </td>
                            <td style="padding: 8px 10px; text-align: right; font-weight: 600; color: ${tierMargin >= 30 ? '#15803d' : '#b45309'};">
                              ${formatCurrency(tierProfit)} <span style="font-size: 10px;">(${tierMargin}%)</span>
                            </td>
                            <td style="padding: 8px 10px; text-align: center;">
                              ${tier.isDefault ? `
                                <span class="badge-count" style="background: #22c55e; color: #ffffff; font-size: 9.5px; font-weight: 700;">★ PADRÃO</span>
                              ` : `
                                <button type="button" class="btn btn-sm btn-set-default-tier" data-tier-id="${tier.id}" style="padding: 1px 6px; font-size: 10px; background: #f8fafc; border: 1px solid #cbd5e1; color: #475569; border-radius: 4px;" title="Definir como pacote padrão de venda">
                                  Tornar Padrão
                                </button>
                              `}
                            </td>
                            <td style="padding: 8px 10px; text-align: center;">
                              <button type="button" class="btn-del-tier" data-tier-id="${tier.id}" style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 13px;" title="Excluir este pacote de quantidade">
                                🗑️
                              </button>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                `}
              </div>
            `}
          </div>

          <!-- Histórico de Valor -->
          <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div>
                <div style="font-size: 12.5px; font-weight: 700; color: var(--text-primary);">Histórico de Valor</div>
                <div style="font-size: 11px; color: var(--text-muted);">Registro cronológico de evolução de preços do produto</div>
              </div>
              <button type="button" class="btn btn-sm" id="btn-toggle-add-hist" style="padding: 2px 8px; font-size: 11px; font-weight: 600; color: #4f46e5; background: #eef2ff; border: 1px solid #c7d2fe;">
                + Novo Registro
              </button>
            </div>

            ${isAddingPriceHistory ? `
              <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 6px; padding: 10px; margin-bottom: 10px;">
                <div style="font-size: 11px; font-weight: 700; color: #4338ca; margin-bottom: 6px;">Adicionar Registro Histórico de Preço:</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr auto auto; gap: 6px;">
                  <input type="number" step="0.50" id="inp-hist-price" class="form-input" placeholder="Valor (ex: 25.00)" />
                  <input type="text" id="inp-hist-date" class="form-input" placeholder="Data (ex: 10/06/2026)" value="${new Date().toLocaleDateString('pt-BR')}" />
                  <button type="button" class="btn btn-sm btn-primary" id="btn-save-hist-price">Salvar</button>
                  <button type="button" class="btn btn-sm" id="btn-cancel-hist-price">✕</button>
                </div>
              </div>
            ` : ''}

            <!-- Lista Formatada Exata -->
            <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 10px 12px; font-family: monospace; font-size: 12px; display: flex; flex-direction: column; gap: 6px;">
              ${history.length === 0 ? `
                <div style="color: var(--text-muted); font-size: 11px;">Nenhum histórico registrado ainda.</div>
              ` : history.map((h, i) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: ${i < history.length - 1 ? '1px dashed var(--border-subtle)' : 'none'};">
                  <span style="font-weight: 700; color: #16a34a;">- R$ ${Number(h.price || 0).toFixed(2).replace('.', ',')}</span>
                  <span style="color: var(--text-secondary);">${escapeHtml(h.date || '')}</span>
                </div>
              `).join('')}
            </div>
          </div>

        </div>
      `;
    }

    // =========================================================================
    // PASSO 04: PERSONALIZAÇÃO & OPÇÕES
    // =========================================================================
    if (activeStep === 4) {
      const fields = product.personalizationFields || [];
      const opts = product.changeOptions || [];

      return `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          
          <!-- SEÇÃO 1: CAMPOS DE PERSONALIZAÇÃO (TEXTOS/DADOS) -->
          <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div>
                <h4 style="font-size: 13px; font-weight: 700; color: var(--text-primary); margin: 0;">✍️ Campos de Personalização (Textos & Dados)</h4>
                <p style="font-size: 11px; color: var(--text-muted); margin: 2px 0 0 0;">Informações que o cliente preenche ao pedir (ex: Nome da Criança, Idade, Data, Frase)</p>
              </div>
              <button type="button" class="btn btn-sm btn-primary" id="btn-toggle-add-pfield">+ Adicionar Campo</button>
            </div>

            <!-- FORMULÁRIO INLINE PARA ADICIONAR CAMPO (SEM PROMPT!) -->
            ${isAddingField ? `
              <div style="background: #f8fafc; border: 1px solid #c7d2fe; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                <div style="font-size: 12px; font-weight: 700; color: #4338ca; margin-bottom: 8px;">Novo Campo de Personalização:</div>
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                  <div>
                    <label style="font-size: 10.5px; font-weight: 600; color: var(--text-secondary);">Rótulo / Nome do Campo *</label>
                    <input type="text" id="inp-new-pfield-name" class="form-input" placeholder="Ex: Nome da Criança" />
                  </div>
                  <div>
                    <label style="font-size: 10.5px; font-weight: 600; color: var(--text-secondary);">Tipo de Dado</label>
                    <select id="sel-new-pfield-type" class="form-select">
                      <option value="text">Texto Curto</option>
                      <option value="number">Número</option>
                      <option value="date">Data</option>
                      <option value="textarea">Texto Longo</option>
                    </select>
                  </div>
                  <div>
                    <label style="font-size: 10.5px; font-weight: 600; color: var(--text-secondary);">Valor Padrão</label>
                    <input type="text" id="inp-new-pfield-default" class="form-input" placeholder="Opcional" />
                  </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; cursor: pointer;">
                    <input type="checkbox" id="chk-new-pfield-req" checked />
                    <span>Campo Obrigatório</span>
                  </label>
                  <div style="display: flex; gap: 6px;">
                    <button type="button" class="btn btn-sm" id="btn-cancel-new-pfield">Cancelar</button>
                    <button type="button" class="btn btn-sm btn-primary" id="btn-save-new-pfield">Adicionar Campo</button>
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- Lista de Campos Configurados -->
            ${fields.length === 0 ? `
              <div style="background: #f8fafc; padding: 14px; border-radius: 6px; text-align: center; color: var(--text-muted); font-size: 11.5px; border: 1px dashed var(--border-subtle);">
                Nenhum texto personalizado configurado. Clique em "+ Adicionar Campo" acima para incluir.
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${fields.map((f, idx) => `
                  <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
                    <div>
                      <span style="font-weight: 700; font-size: 12.5px; color: var(--text-primary);">${escapeHtml(f.name || f.id)}</span>
                      <span class="badge-count" style="font-size: 9.5px; margin-left: 6px;">${f.type || 'text'}</span>
                      ${f.required ? '<span style="color: #dc2626; font-size: 9.5px; font-weight: 700; background: #fee2e2; padding: 1px 5px; border-radius: 4px; margin-left: 4px;">Obrigatório</span>' : '<span style="color: var(--text-muted); font-size: 9.5px; background: #f1f5f9; padding: 1px 5px; border-radius: 4px; margin-left: 4px;">Opcional</span>'}
                      ${f.defaultValue ? `<span style="font-size: 10.5px; color: var(--text-muted); margin-left: 6px;">(Padrão: "${escapeHtml(f.defaultValue)}")</span>` : ''}
                    </div>
                    <button type="button" class="btn-del-pfield" data-index="${idx}" style="color: #ef4444; background: transparent; border: none; font-size: 14px; cursor: pointer; padding: 4px;" title="Excluir Campo">
                      🗑️
                    </button>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- SEÇÃO 2: OPÇÕES DE ALTERAÇÃO / VARIAÇÕES (MATERIAIS, CORES, ALÇAS) -->
          <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div>
                <h4 style="font-size: 13px; font-weight: 700; color: var(--text-primary); margin: 0;">🎨 Opções de Alteração / Variações Físicas</h4>
                <p style="font-size: 11px; color: var(--text-muted); margin: 2px 0 0 0;">Escolhas de materiais, cores e acabamentos (ex: Cor da Sacola, Tipo de Alça, Laminação)</p>
              </div>
              <button type="button" class="btn btn-sm btn-primary" id="btn-toggle-add-copt">+ Adicionar Opção</button>
            </div>

            <!-- FORMULÁRIO INLINE PARA ADICIONAR OPÇÃO DE ALTERAÇÃO (SEM PROMPT!) -->
            ${isAddingOption ? `
              <div style="background: #f8fafc; border: 1px solid #c7d2fe; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                <div style="font-size: 12px; font-weight: 700; color: #4338ca; margin-bottom: 8px;">Nova Opção de Alteração:</div>
                <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 8px; margin-bottom: 8px;">
                  <div>
                    <label style="font-size: 10.5px; font-weight: 600; color: var(--text-secondary);">Nome da Opção *</label>
                    <input type="text" id="inp-new-copt-name" class="form-input" placeholder="Ex: Cor da Sacola" />
                  </div>
                  <div>
                    <label style="font-size: 10.5px; font-weight: 600; color: var(--text-secondary);">Escolhas (separadas por vírgula) *</label>
                    <input type="text" id="inp-new-copt-choices" class="form-input" placeholder="Ex: Rosa, Azul, Branco, Kraft" />
                  </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; cursor: pointer;">
                    <input type="checkbox" id="chk-new-copt-req" checked />
                    <span>Escolha Obrigatória</span>
                  </label>
                  <div style="display: flex; gap: 6px;">
                    <button type="button" class="btn btn-sm" id="btn-cancel-new-copt">Cancelar</button>
                    <button type="button" class="btn btn-sm btn-primary" id="btn-save-new-copt">Adicionar Opção</button>
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- Lista de Opções Configuradas -->
            ${opts.length === 0 ? `
              <div style="background: #f8fafc; padding: 14px; border-radius: 6px; text-align: center; color: var(--text-muted); font-size: 11.5px; border: 1px dashed var(--border-subtle);">
                Nenhuma opção de alteração cadastrada. O produto será produzido sempre na versão padrão única.
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${opts.map((opt, idx) => `
                  <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
                    <div>
                      <span style="font-weight: 700; font-size: 12.5px; color: var(--text-primary);">${escapeHtml(opt.name || opt.id)}</span>
                      <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                        Escolhas: <b>${(opt.choices || []).join(', ')}</b>
                      </div>
                    </div>
                    <button type="button" class="btn-del-copt" data-index="${idx}" style="color: #ef4444; background: transparent; border: none; font-size: 14px; cursor: pointer; padding: 4px;" title="Excluir Opção">
                      🗑️
                    </button>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

        </div>
      `;
    }

    // =========================================================================
    // PASSO 05: PDF + GABARITO (MOLDE DO PRODUTO UNIFICADO)
    // =========================================================================
    if (activeStep === 5) {
      const baseMeta = product.basePdfMetadata;
      const textAreas = product.editor?.textAreas || [];
      const fields = product.personalizationFields || [];

      return `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          
          <!-- UPLOAD PNG DA IMAGEM / GABARITO BASE PDF -->
          <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
            <div style="font-weight: 700; font-size: 13px; color: var(--text-primary); margin-bottom: 2px;">📄 PNG / Gabarito Base do Produto</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 10px;">Adicione o PNG da imagem ou arquivo PDF do gabarito base do molde</div>

            <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 22px;">🖼️</span>
                <div>
                  <div style="font-weight: 700; font-size: 12px;">${baseMeta ? escapeHtml(baseMeta.name) : 'Gabarito Base Padrão'}</div>
                  <div style="font-size: 10.5px; color: var(--text-muted);">
                    ${baseMeta ? `${baseMeta.width || 595} × ${baseMeta.height || 842} pt · Imutável` : 'Formatado para Impressão e Corte A4'}
                  </div>
                </div>
              </div>
              <button type="button" class="btn btn-sm btn-primary" id="btn-trigger-upload-pdf">
                📤 Carregar PNG / PDF
              </button>
              <input type="file" id="pcfg-pdf-file-input" accept=".pdf,image/png,image/jpeg,application/pdf" style="display: none;" />
            </div>
            <div id="pcfg-pdf-feedback" style="font-size: 11.5px;"></div>
          </div>

          <!-- APONTAMENTO DE LUGARES DE ALTERAÇÕES / PERSONALIZAÇÃO -->
          <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div>
                <div style="font-weight: 700; font-size: 13px; color: var(--text-primary);">🎯 Apontamento de Áreas de Alteração / Personalização</div>
                <div style="font-size: 11px; color: var(--text-muted);">Mapeie onde no gabarito os textos e acabamentos serão aplicados</div>
              </div>
              <button type="button" class="btn btn-sm btn-primary" id="btn-toggle-add-area">+ Apontar Nova Área</button>
            </div>

            <!-- FORMULÁRIO INLINE PARA APONTAR ÁREA -->
            ${isAddingArea ? `
              <div style="background: #f8fafc; border: 1px solid #c7d2fe; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                <div style="font-size: 12px; font-weight: 700; color: #4338ca; margin-bottom: 8px;">Apontar Nova Área no Gabarito:</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                  <div>
                    <label style="font-size: 10.5px; font-weight: 600; color: var(--text-secondary);">Nome da Área *</label>
                    <input type="text" id="inp-new-area-name" class="form-input" placeholder="Ex: Área do Nome Central" />
                  </div>
                  <div>
                    <label style="font-size: 10.5px; font-weight: 600; color: var(--text-secondary);">Vincular ao Campo do Passo 04</label>
                    <select id="sel-new-area-field" class="form-select">
                      <option value="">Texto Geral</option>
                      ${fields.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('')}
                    </select>
                  </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 8px;">
                  <div>
                    <label style="font-size: 10px; font-weight: 600; color: var(--text-secondary);">Pos X (pt)</label>
                    <input type="number" id="inp-new-area-x" class="form-input" value="120" />
                  </div>
                  <div>
                    <label style="font-size: 10px; font-weight: 600; color: var(--text-secondary);">Pos Y (pt)</label>
                    <input type="number" id="inp-new-area-y" class="form-input" value="380" />
                  </div>
                  <div>
                    <label style="font-size: 10px; font-weight: 600; color: var(--text-secondary);">Largura (pt)</label>
                    <input type="number" id="inp-new-area-w" class="form-input" value="350" />
                  </div>
                  <div>
                    <label style="font-size: 10px; font-weight: 600; color: var(--text-secondary);">Tamanho Fonte</label>
                    <input type="number" id="inp-new-area-font" class="form-input" value="24" />
                  </div>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 6px;">
                  <button type="button" class="btn btn-sm" id="btn-cancel-new-area">Cancelar</button>
                  <button type="button" class="btn btn-sm btn-primary" id="btn-save-new-area">Salvar Área Apontada</button>
                </div>
              </div>
            ` : ''}

            <!-- Lista de Áreas Apontadas -->
            ${textAreas.length === 0 ? `
              <div style="background: #f8fafc; padding: 14px; border-radius: 6px; text-align: center; color: var(--text-muted); font-size: 11.5px; border: 1px dashed var(--border-subtle);">
                Nenhuma área apontada ainda. O gerador aplicará a personalização na área padrão central.
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${textAreas.map((area, idx) => `
                  <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 10px 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <span style="font-weight: 700; font-size: 12px; color: var(--text-primary);">📍 ${escapeHtml(area.name || area.id)}</span>
                      <button type="button" class="btn-del-area" data-index="${idx}" style="color: #ef4444; background: transparent; border: none; font-size: 14px; cursor: pointer;" title="Excluir Área">
                        🗑️
                      </button>
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary); display: flex; gap: 12px; flex-wrap: wrap;">
                      <span>Posição: <b>(${area.x}, ${area.y})</b></span>
                      <span>Largura: <b>${area.width} pt</b></span>
                      <span>Fonte: <b>${area.fontSize || 24}pt</b></span>
                      <span>Campo: <b style="color: #4f46e5;">${escapeHtml(area.personalizationFieldId || 'Geral')}</b></span>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

        </div>
      `;
    }
  }

  function renderMockupAnglePreview(angle, prod) {
    const angleLabels = {
      front: 'Frente (Principal)',
      angle: 'Frente / Lateral',
      back: 'Verso'
    };
    const currentPhoto = prod.mockups?.[angle] || (angle === 'front' ? prod.imageUrl : '');

    return `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
        <div id="pcfg-mockup-dropzone" style="width: 170px; height: 170px; background: #ffffff; border: 2px dashed ${currentPhoto ? 'var(--border-subtle)' : '#cbd5e1'}; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; position: relative; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: all 0.2s ease;">
          ${currentPhoto ? `
            <img src="${escapeHtml(currentPhoto)}" alt="Mockup ${angleLabels[angle]}" style="width: 100%; height: 100%; object-fit: contain; padding: 4px;" />
            <div style="position: absolute; bottom: 6px; right: 6px; display: flex; gap: 4px;">
              <button type="button" class="btn btn-sm" id="btn-change-angle-photo" title="Trocar foto deste ângulo" style="padding: 3px 8px; font-size: 11px; background: rgba(255,255,255,0.95); backdrop-filter: blur(4px); box-shadow: 0 1px 4px rgba(0,0,0,0.15); border: 1px solid var(--border-subtle); border-radius: 4px; cursor: pointer;">
                🔄 Trocar
              </button>
              <button type="button" class="btn btn-sm" id="btn-remove-angle-photo" title="Remover foto deste ângulo" style="padding: 3px 8px; font-size: 11px; color: #dc2626; background: rgba(255,255,255,0.95); backdrop-filter: blur(4px); box-shadow: 0 1px 4px rgba(0,0,0,0.15); border: 1px solid #fecaca; border-radius: 4px; cursor: pointer;">
                🗑️
              </button>
            </div>
          ` : `
            <div style="text-align: center; color: var(--text-muted); padding: 12px;">
              <div style="font-size: 36px; margin-bottom: 4px;">
                ${angle === 'front' ? '🛍️' : angle === 'angle' ? '📦' : '✨'}
              </div>
              <div style="font-size: 11.5px; font-weight: 700; color: var(--text-primary);">
                ${angleLabels[angle]}
              </div>
              <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px; margin-bottom: 8px;">
                Arraste uma foto aqui ou
              </div>
              <button type="button" class="btn btn-sm btn-primary" id="btn-upload-angle-photo" style="font-size: 11px; padding: 3px 10px;">
                + Carregar Foto
              </button>
            </div>
          `}
        </div>

        <input type="file" id="inp-pcfg-angle-upload" accept="image/png,image/jpeg,image/webp,image/jpg" style="display: none;" />

        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: 280px; font-size: 11.5px; color: var(--text-secondary);">
          <span>Posição: <b>${angleLabels[angle]}</b></span>
          ${currentPhoto ? `<span style="color: #16a34a; font-weight: 600;">✓ Foto vinculada</span>` : `<span style="color: var(--text-muted);">Sem foto</span>`}
        </div>
      </div>
    `;
  }

  function saveCurrentStepInputs(drawer) {
    if (!drawer) return;
    
    const activeChk = drawer.querySelector('#chk-pcfg-active');
    if (activeChk) product.status = activeChk.checked ? 'ativo' : 'inativo';
    
    const nameInp = drawer.querySelector('#inp-pcfg-name');
    if (nameInp) product.name = nameInp.value;
    
    const catInp = drawer.querySelector('#inp-pcfg-cat');
    if (catInp) product.categoryId = catInp.value;
    
    const subcatInp = drawer.querySelector('#inp-pcfg-subcat');
    if (subcatInp) product.subcategoryId = subcatInp.value;
    
    const descInp = drawer.querySelector('#inp-pcfg-desc');
    if (descInp) product.description = descInp.value;

    const timeInp = drawer.querySelector('#inp-pcfg-time');
    if (timeInp) product.productionTime = parseInt(timeInp.value, 10) || 1;
    
    const priceFromInp = drawer.querySelector('#inp-pcfg-pricefrom');
    if (priceFromInp) product.priceFrom = parseFloat(priceFromInp.value) || 0;
    
    const priceInp = drawer.querySelector('#inp-pcfg-price');
    if (priceInp) product.price = parseFloat(priceInp.value) || 0;
    
    const wearInp = drawer.querySelector('#inp-pcfg-machinewear');
    if (wearInp) product.machineWearRate = parseFloat(wearInp.value) || 0;
    
    const costInp = drawer.querySelector('#inp-pcfg-cost');
    if (costInp) product.cost = parseFloat(costInp.value) || 0;

    const isKitChk = drawer.querySelector('#chk-pcfg-iskit') || drawer.querySelector('#chk-pcfg-iskit-step3');
    if (isKitChk) product.isKit = Boolean(isKitChk.checked);
  }

  function reRender(drawer) {
    saveCurrentStepInputs(drawer);
    const contentEl = drawer.querySelector('#drawer-dynamic-content');
    if (contentEl) {
      contentEl.innerHTML = renderDrawerContent();
    }
    bindEvents(drawer);
  }

  function bindEvents(drawer) {
    // Real-time synchronization of step 1 inputs
    const nameInp = drawer.querySelector('#inp-pcfg-name');
    if (nameInp) {
      nameInp.addEventListener('input', (e) => {
        product.name = e.target.value;
      });
    }

    const descInp = drawer.querySelector('#inp-pcfg-desc');
    if (descInp) {
      descInp.addEventListener('input', (e) => {
        product.description = e.target.value;
      });
    }

    const catInp = drawer.querySelector('#inp-pcfg-cat');
    if (catInp) {
      catInp.addEventListener('change', (e) => {
        product.categoryId = e.target.value;
      });
    }

    const subcatInp = drawer.querySelector('#inp-pcfg-subcat');
    if (subcatInp) {
      subcatInp.addEventListener('change', (e) => {
        product.subcategoryId = e.target.value;
      });
    }

    // Step 3 inputs real-time sync
    const timeInp = drawer.querySelector('#inp-pcfg-time');
    if (timeInp) {
      timeInp.addEventListener('input', (e) => {
        product.productionTime = parseInt(e.target.value, 10) || 1;
      });
    }

    const priceFromInp = drawer.querySelector('#inp-pcfg-pricefrom');
    if (priceFromInp) {
      priceFromInp.addEventListener('input', (e) => {
        product.priceFrom = parseFloat(e.target.value) || 0;
      });
    }

    // Prevent Enter key in text inputs from triggering unwanted clicks or form submits
    drawer.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && inp.type !== 'submit') {
          if (inp.id === 'inp-new-cat-name') {
            e.preventDefault();
            drawer.querySelector('#btn-save-new-cat')?.click();
          } else if (inp.id === 'inp-new-subcat-name') {
            e.preventDefault();
            drawer.querySelector('#btn-save-new-subcat')?.click();
          } else if (inp.id === 'inp-new-pfield-name' || inp.id === 'inp-new-pfield-default') {
            e.preventDefault();
            drawer.querySelector('#btn-save-new-pfield')?.click();
          } else if (inp.id === 'inp-new-copt-name' || inp.id === 'inp-new-copt-choices') {
            e.preventDefault();
            drawer.querySelector('#btn-save-new-copt')?.click();
          }
        }
      });
    });

    // 1. Step Navigation Buttons
    drawer.querySelectorAll('[data-step]').forEach(btn => {
      btn.addEventListener('click', () => {
        saveCurrentStepInputs(drawer);
        activeStep = parseInt(btn.dataset.step, 10);
        reRender(drawer);
      });
    });

    // 2. Mockup Angle Tabs (Step 1)
    drawer.querySelectorAll('[data-mockup-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeMockupTab = btn.dataset.mockupTab;
        reRender(drawer);
      });
    });

    // 3. Status Toggle (Step 1)
    const activeChk = drawer.querySelector('#chk-pcfg-active');
    if (activeChk) {
      activeChk.addEventListener('change', () => {
        product.status = activeChk.checked ? 'ativo' : 'inativo';
        const lbl = drawer.querySelector('#lbl-pcfg-status');
        if (lbl) {
          lbl.textContent = activeChk.checked ? 'Ativo' : 'Desativado';
          lbl.style.color = activeChk.checked ? '#16a34a' : '#64748b';
        }
      });
    }

    // 3.1. Upload de Fotos e Mockup 3D (Step 1)
    const galleryInput = drawer.querySelector('#inp-pcfg-gallery-upload');
    const galleryDropzone = drawer.querySelector('#pcfg-dropzone-gallery');
    const uploadFeedback = drawer.querySelector('#pcfg-upload-feedback');

    async function handleUploadFiles(files, targetAngle = null) {
      if (!files || files.length === 0) return;
      const validFiles = Array.from(files).filter(f => f.type && f.type.startsWith('image/'));
      if (validFiles.length === 0) {
        showToast('Selecione arquivos de imagem válidos (PNG, JPG, WEBP).', '⚠');
        return;
      }
      if (uploadFeedback) {
        uploadFeedback.innerHTML = `<span style="color: #4f46e5; font-weight: 600;">⏳ Processando e otimizando ${validFiles.length} foto(s)...</span>`;
      }
      try {
        product.images = product.images || [];
        product.mockups = product.mockups || { front: '', angle: '', back: '' };

        let addedCount = 0;
        for (let i = 0; i < validFiles.length; i++) {
          const file = validFiles[i];
          const processed = await processImageFile(file, 900, 900, 0.85);

          let assignedAngle = targetAngle;
          if (!assignedAngle) {
            if (!product.mockups.front && !product.imageUrl) {
              assignedAngle = 'front';
            } else if (!product.mockups.angle) {
              assignedAngle = 'angle';
            } else if (!product.mockups.back) {
              assignedAngle = 'back';
            } else {
              assignedAngle = 'gallery';
            }
          }

          if (assignedAngle === 'front') {
            product.mockups.front = processed.dataUrl;
            product.imageUrl = processed.dataUrl;
          } else if (assignedAngle === 'angle') {
            product.mockups.angle = processed.dataUrl;
          } else if (assignedAngle === 'back') {
            product.mockups.back = processed.dataUrl;
          }

          product.images.push({
            id: 'img_' + generateId('i'),
            fileId: processed.fileId,
            url: processed.dataUrl,
            name: processed.name,
            angle: assignedAngle,
            uploadedAt: new Date().toISOString()
          });
          addedCount++;
        }

        saveCurrentStepInputs(drawer);
        showToast(`${addedCount} foto(s) adicionada(s) ao produto!`, '📸');
        reRender(drawer);
      } catch (err) {
        console.error('Image upload error:', err);
        if (uploadFeedback) {
          uploadFeedback.innerHTML = `<span style="color: #dc2626; font-weight: 600;">⚠ ${escapeHtml(err.message)}</span>`;
        }
        showToast(err.message, '⚠');
      }
    }

    if (galleryDropzone && galleryInput) {
      galleryDropzone.addEventListener('click', () => galleryInput.click());

      galleryDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        galleryDropzone.style.borderColor = '#4f46e5';
        galleryDropzone.style.background = '#eef2ff';
      });

      galleryDropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        galleryDropzone.style.borderColor = '#cbd5e1';
        galleryDropzone.style.background = '#f8fafc';
      });

      galleryDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        galleryDropzone.style.borderColor = '#cbd5e1';
        galleryDropzone.style.background = '#f8fafc';
        if (e.dataTransfer && e.dataTransfer.files) {
          handleUploadFiles(e.dataTransfer.files);
        }
      });

      galleryInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleUploadFiles(e.target.files);
        }
      });
    }

    // Upload direto no card do Mockup 3D
    const angleDropzone = drawer.querySelector('#pcfg-mockup-dropzone');
    const angleFileInput = drawer.querySelector('#inp-pcfg-angle-upload');
    const btnUploadAngle = drawer.querySelector('#btn-upload-angle-photo');
    const btnChangeAngle = drawer.querySelector('#btn-change-angle-photo');
    const btnRemoveAngle = drawer.querySelector('#btn-remove-angle-photo');

    if (btnUploadAngle && angleFileInput) {
      btnUploadAngle.addEventListener('click', () => angleFileInput.click());
    }
    if (btnChangeAngle && angleFileInput) {
      btnChangeAngle.addEventListener('click', () => angleFileInput.click());
    }
    if (angleFileInput) {
      angleFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleUploadFiles(e.target.files, activeMockupTab);
        }
      });
    }

    if (angleDropzone) {
      angleDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        angleDropzone.style.borderColor = '#4f46e5';
        angleDropzone.style.background = '#eef2ff';
      });

      angleDropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        angleDropzone.style.borderColor = '#cbd5e1';
        angleDropzone.style.background = '#ffffff';
      });

      angleDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        angleDropzone.style.borderColor = '#cbd5e1';
        angleDropzone.style.background = '#ffffff';
        if (e.dataTransfer && e.dataTransfer.files) {
          handleUploadFiles(e.dataTransfer.files, activeMockupTab);
        }
      });
    }

    if (btnRemoveAngle) {
      btnRemoveAngle.addEventListener('click', () => {
        const removedUrl = product.mockups?.[activeMockupTab] || '';
        if (product.mockups) {
          product.mockups[activeMockupTab] = '';
        }
        if (activeMockupTab === 'front') {
          const nextImg = (product.images || []).find(img => img.url !== removedUrl);
          product.imageUrl = nextImg ? nextImg.url : '';
        }
        (product.images || []).forEach(img => {
          if (img.url === removedUrl) {
            img.angle = 'gallery';
          }
        });
        saveCurrentStepInputs(drawer);
        showToast(`Foto de ${activeMockupTab === 'front' ? 'Frente' : activeMockupTab === 'angle' ? 'Lateral' : 'Verso'} removida.`, '🗑️');
        reRender(drawer);
      });
    }

    // Ações de cada foto na galeria (Excluir e Definir Ângulo)
    drawer.querySelectorAll('.btn-del-gallery-img').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.imgIdx, 10);
        const img = product.images?.[idx];
        if (!img) return;

        if (product.mockups?.front === img.url) product.mockups.front = '';
        if (product.mockups?.angle === img.url) product.mockups.angle = '';
        if (product.mockups?.back === img.url) product.mockups.back = '';
        if (product.imageUrl === img.url) {
          product.imageUrl = product.mockups?.front || '';
        }

        if (img.fileId) {
          fileStorage.deleteFile(img.fileId).catch(() => {});
        }

        product.images.splice(idx, 1);
        saveCurrentStepInputs(drawer);
        showToast('Foto excluída da galeria.', '🗑️');
        reRender(drawer);
      });
    });

    drawer.querySelectorAll('.btn-set-img-angle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.imgIdx, 10);
        const targetAngle = btn.dataset.angle; // 'front', 'angle', 'back'
        const img = product.images?.[idx];
        if (!img) return;

        product.mockups = product.mockups || { front: '', angle: '', back: '' };

        if (targetAngle === 'front') {
          product.mockups.front = img.url;
          product.imageUrl = img.url;
          showToast('Foto definida como Principal (Frente)!', '⭐');
        } else if (targetAngle === 'angle') {
          product.mockups.angle = img.url;
          showToast('Foto definida como Frente / Lateral!', '📐');
        } else if (targetAngle === 'back') {
          product.mockups.back = img.url;
          showToast('Foto definida como Verso!', '🔄');
        }

        product.images.forEach((item, i) => {
          if (i === idx) {
            item.angle = targetAngle;
          } else if (item.angle === targetAngle) {
            item.angle = 'gallery';
          }
        });

        activeMockupTab = targetAngle;
        saveCurrentStepInputs(drawer);
        reRender(drawer);
      });
    });

    // 4. Category Inline Creation (+)
    const btnToggleCat = drawer.querySelector('#btn-toggle-add-cat');
    if (btnToggleCat) {
      btnToggleCat.addEventListener('click', () => {
        isAddingCategory = !isAddingCategory;
        reRender(drawer);
      });
    }
    const btnCancelCat = drawer.querySelector('#btn-cancel-new-cat');
    if (btnCancelCat) {
      btnCancelCat.addEventListener('click', () => {
        isAddingCategory = false;
        reRender(drawer);
      });
    }
    const btnSaveCat = drawer.querySelector('#btn-save-new-cat');
    if (btnSaveCat) {
      btnSaveCat.addEventListener('click', () => {
        const inp = drawer.querySelector('#inp-new-cat-name');
        const catName = inp ? inp.value.trim() : '';
        if (!catName) {
          showToast('Informe o nome da categoria.', '⚠');
          return;
        }
        try {
          const newCat = createCategory({ name: catName });
          product.categoryId = newCat.id;
          isAddingCategory = false;
          showToast(`Categoria "${newCat.name}" criada!`, '📁');
          reRender(drawer);
        } catch (err) {
          showToast(err.message, '⚠');
        }
      });
    }

    // 5. Sub-category Inline Creation (+)
    const btnToggleSubcat = drawer.querySelector('#btn-toggle-add-subcat');
    if (btnToggleSubcat) {
      btnToggleSubcat.addEventListener('click', () => {
        isAddingSubcategory = !isAddingSubcategory;
        reRender(drawer);
      });
    }
    const btnCancelSubcat = drawer.querySelector('#btn-cancel-new-subcat');
    if (btnCancelSubcat) {
      btnCancelSubcat.addEventListener('click', () => {
        isAddingSubcategory = false;
        reRender(drawer);
      });
    }
    const btnSaveSubcat = drawer.querySelector('#btn-save-new-subcat');
    if (btnSaveSubcat) {
      btnSaveSubcat.addEventListener('click', () => {
        const inp = drawer.querySelector('#inp-new-subcat-name');
        const subName = inp ? inp.value.trim() : '';
        if (!subName) {
          showToast('Informe o nome da sub-categoria.', '⚠');
          return;
        }
        try {
          createSubcategory(product.categoryId, subName);
          product.subcategoryId = subName;
          isAddingSubcategory = false;
          showToast(`Sub-categoria "${subName}" criada!`, '📁');
          reRender(drawer);
        } catch (err) {
          showToast(err.message, '⚠');
        }
      });
    }

    // =========================================================================
    // 6. COMPOSITION / INSUMOS & COMPONENTES (Step 2)
    // =========================================================================
    const btnToggleComp = drawer.querySelector('#btn-toggle-add-comp-item');
    if (btnToggleComp) {
      btnToggleComp.addEventListener('click', () => {
        isAddingCompositionItem = !isAddingCompositionItem;
        reRender(drawer);
      });
    }

    const btnCancelComp = drawer.querySelector('#btn-cancel-comp-item');
    if (btnCancelComp) {
      btnCancelComp.addEventListener('click', () => {
        isAddingCompositionItem = false;
        reRender(drawer);
      });
    }

    const btnSelInsumo = drawer.querySelector('#btn-sel-type-insumo');
    if (btnSelInsumo) {
      btnSelInsumo.addEventListener('click', () => {
        selectedCompItemType = 'insumo';
        reRender(drawer);
      });
    }

    const btnSelComp = drawer.querySelector('#btn-sel-type-componente');
    if (btnSelComp) {
      btnSelComp.addEventListener('click', () => {
        selectedCompItemType = 'componente';
        reRender(drawer);
      });
    }

    // Salvar Insumo/Componente na Composição
    const btnSaveComp = drawer.querySelector('#btn-save-comp-item');
    if (btnSaveComp) {
      btnSaveComp.addEventListener('click', () => {
        const itemSel = drawer.querySelector('#sel-comp-item-id');
        const qtyInp = drawer.querySelector('#inp-comp-item-qty');
        const unitSel = drawer.querySelector('#sel-comp-item-unit');

        const itemId = itemSel?.value;
        const quantity = parseFloat(qtyInp?.value) || 0;
        const unit = unitSel?.value || 'un';

        if (!itemId) {
          showToast('Selecione um insumo ou componente.', '⚠');
          return;
        }

        if (quantity <= 0) {
          showToast('Informe uma quantidade válida consumida.', '⚠');
          return;
        }

        product.composition = product.composition || [];
        product.composition.push({
          type: selectedCompItemType,
          itemId,
          materialId: selectedCompItemType === 'insumo' ? itemId : undefined,
          componentId: selectedCompItemType === 'componente' ? itemId : undefined,
          quantity,
          unit
        });

        // Recalcular e atualizar custo do produto se for 0 ou se desejar manter atualizado
        const materials = getMaterials();
        const components = getComponents();
        const materialsMap = buildMaterialsMap(materials);
        const componentsMap = buildComponentsMap(components);
        const compSummary = getCompositionSummary(product, materials, components, materialsMap, componentsMap);
        product.cost = compSummary.totalCost;

        isAddingCompositionItem = false;
        showToast('Item adicionado à ficha técnica!', '🧩');
        reRender(drawer);
      });
    }

    // Excluir Item da Composição
    drawer.querySelectorAll('.btn-del-comp-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        product.composition = product.composition || [];
        product.composition.splice(idx, 1);

        // Recalcular custo
        const materials = getMaterials();
        const components = getComponents();
        const materialsMap = buildMaterialsMap(materials);
        const componentsMap = buildComponentsMap(components);
        const compSummary = getCompositionSummary(product, materials, components, materialsMap, componentsMap);
        product.cost = compSummary.totalCost;

        reRender(drawer);
      });
    });

    // Sincronizar custo da Composição com o Custo Base
    const btnSyncComp = drawer.querySelector('#btn-sync-comp-cost');
    if (btnSyncComp) {
      btnSyncComp.addEventListener('click', () => {
        const materials = getMaterials();
        const components = getComponents();
        const materialsMap = buildMaterialsMap(materials);
        const componentsMap = buildComponentsMap(components);
        const compSummary = getCompositionSummary(product, materials, components, materialsMap, componentsMap);
        product.cost = compSummary.totalCost;
        showToast(`Custo base atualizado para ${formatCurrency(product.cost)}!`, '⚡');
        reRender(drawer);
      });
    }

    const updatePricingCalculationsLive = () => {
      const priceInp = drawer.querySelector('#inp-pcfg-price');
      const costInp = drawer.querySelector('#inp-pcfg-cost');
      const wearInp = drawer.querySelector('#inp-pcfg-machinewear');
      
      const price = parseFloat(priceInp?.value) || 0;
      const cost = parseFloat(costInp?.value) || 0;
      const wear = parseFloat(wearInp?.value) || 0;
      
      const profit = Math.max(0, price - cost);
      const margin = price > 0 ? ((profit / price) * 100).toFixed(1) : 0;
      
      const dispProfit = drawer.querySelector('#disp-profit-val');
      if (dispProfit) dispProfit.textContent = `${formatCurrency(profit)} (${margin}%)`;
      
      const dispWear = drawer.querySelector('#disp-wear-val');
      if (dispWear) dispWear.textContent = formatCurrency(wear);

      const dispCost = drawer.querySelector('#disp-cost-val');
      if (dispCost) dispCost.textContent = formatCurrency(cost);

      const badge = drawer.querySelector('#disp-margin-badge');
      if (badge) {
        badge.textContent = margin >= 30 ? 'Margem Saudável' : margin >= 15 ? 'Margem Média' : 'Margem Baixa';
        badge.style.background = margin >= 30 ? '#dcfce7' : margin >= 15 ? '#fef3c7' : '#fee2e2';
        badge.style.color = margin >= 30 ? '#15803d' : margin >= 15 ? '#b45309' : '#dc2626';
      }
    };

    const btnSyncStep3 = drawer.querySelector('#btn-sync-cost-step3');
    if (btnSyncStep3) {
      btnSyncStep3.addEventListener('click', () => {
        const materials = getMaterials();
        const components = getComponents();
        const materialsMap = buildMaterialsMap(materials);
        const componentsMap = buildComponentsMap(components);
        const compSummary = getCompositionSummary(product, materials, components, materialsMap, componentsMap);
        const wearInp = drawer.querySelector('#inp-pcfg-machinewear');
        const wearRate = parseFloat(wearInp ? wearInp.value : product.machineWearRate) || 0;
        product.machineWearRate = wearRate;
        product.cost = Number((compSummary.totalCost + wearRate).toFixed(2));
        showToast(`Custo atualizado para ${formatCurrency(product.cost)} (Insumos + Desgaste)!`, '⚡');
        reRender(drawer);
      });
    }

    // Presets de Desgaste
    drawer.querySelectorAll('.btn-wear-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const wearVal = parseFloat(btn.dataset.wear) || 0;
        const wearInp = drawer.querySelector('#inp-pcfg-machinewear');
        if (wearInp) {
          wearInp.value = wearVal;
          product.machineWearRate = wearVal;
          updatePricingCalculationsLive();
        }
      });
    });

    // Live update on input
    drawer.querySelector('#inp-pcfg-machinewear')?.addEventListener('input', (e) => {
      product.machineWearRate = parseFloat(e.target.value) || 0;
      updatePricingCalculationsLive();
    });
    drawer.querySelector('#inp-pcfg-cost')?.addEventListener('input', (e) => {
      product.cost = parseFloat(e.target.value) || 0;
      updatePricingCalculationsLive();
    });
    drawer.querySelector('#inp-pcfg-price')?.addEventListener('input', (e) => {
      product.price = parseFloat(e.target.value) || 0;
      updatePricingCalculationsLive();
    });

    // =========================================================================
    // KIT / PACOTES DE QUANTIDADES (Steps 1 & 3)
    // =========================================================================
    const handleKitToggle = (checked) => {
      product.isKit = checked;
      if (product.isKit && (!product.kitTiers || product.kitTiers.length === 0)) {
        generateDefaultKitTiers('standard');
      }
      reRender(drawer);
    };

    const isKitChk = drawer.querySelector('#chk-pcfg-iskit');
    if (isKitChk) {
      isKitChk.addEventListener('change', (e) => {
        handleKitToggle(e.target.checked);
      });
    }

    const isKitStep3Chk = drawer.querySelector('#chk-pcfg-iskit-step3');
    if (isKitStep3Chk) {
      isKitStep3Chk.addEventListener('change', (e) => {
        handleKitToggle(e.target.checked);
      });
    }

    const btnGotoStep3Kits = drawer.querySelector('#btn-goto-step3-kits');
    if (btnGotoStep3Kits) {
      btnGotoStep3Kits.addEventListener('click', () => {
        saveCurrentStepInputs(drawer);
        activeStep = 3;
        reRender(drawer);
      });
    }

    const btnSuggestKits = drawer.querySelector('#btn-suggest-kit-tiers');
    if (btnSuggestKits) {
      btnSuggestKits.addEventListener('click', () => {
        generateDefaultKitTiers('standard');
        showToast('Pacotes de 10, 25, 50 e 100 unidades gerados!', '📦');
        reRender(drawer);
      });
    }

    const btnSuggestKitsParty = drawer.querySelector('#btn-suggest-kit-tiers-party');
    if (btnSuggestKitsParty) {
      btnSuggestKitsParty.addEventListener('click', () => {
        generateDefaultKitTiers('party');
        showToast('Pacotes de festa (15, 20, 30 e 50 un) gerados!', '🎉');
        reRender(drawer);
      });
    }

    const btnToggleAddTier = drawer.querySelector('#btn-toggle-add-tier');
    if (btnToggleAddTier) {
      btnToggleAddTier.addEventListener('click', () => {
        isAddingKitTier = !isAddingKitTier;
        reRender(drawer);
      });
    }

    const btnCancelAddTier = drawer.querySelector('#btn-cancel-new-tier');
    if (btnCancelAddTier) {
      btnCancelAddTier.addEventListener('click', () => {
        isAddingKitTier = false;
        reRender(drawer);
      });
    }

    // Auto calculate name when changing quantity in new tier form
    const inpNewTierQty = drawer.querySelector('#inp-new-tier-qty');
    const inpNewTierName = drawer.querySelector('#inp-new-tier-name');
    const inpNewTierPrice = drawer.querySelector('#inp-new-tier-price');
    if (inpNewTierQty && inpNewTierName) {
      inpNewTierQty.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (val && (!inpNewTierName.value || inpNewTierName.value.startsWith('Kit '))) {
          inpNewTierName.value = `Kit ${val} unidades`;
        }
        if (val && inpNewTierPrice) {
          const currentUnit = (Number(product.price) || 30) / 10;
          inpNewTierPrice.value = (val * (currentUnit > 0 ? currentUnit : 3)).toFixed(2);
        }
      });
    }

    const btnSaveNewTier = drawer.querySelector('#btn-save-new-tier');
    if (btnSaveNewTier) {
      btnSaveNewTier.addEventListener('click', () => {
        const qty = parseInt(drawer.querySelector('#inp-new-tier-qty')?.value, 10) || 0;
        const price = parseFloat(drawer.querySelector('#inp-new-tier-price')?.value) || 0;
        let name = drawer.querySelector('#inp-new-tier-name')?.value?.trim() || '';

        if (qty <= 0) {
          showToast('Informe uma quantidade válida para o pacote (mínimo 1 unidade).', '⚠');
          return;
        }

        if (price <= 0) {
          showToast('Informe um preço total válido para o pacote.', '⚠');
          return;
        }

        if (!name) {
          name = `Kit ${qty} unidades`;
        }

        if (!product.kitTiers) product.kitTiers = [];

        const existingIdx = product.kitTiers.findIndex(t => t.quantity === qty);
        if (existingIdx >= 0) {
          product.kitTiers[existingIdx].name = name;
          product.kitTiers[existingIdx].price = price;
          product.kitTiers[existingIdx].unitPrice = price / qty;
          showToast(`Pacote de ${qty} unidades atualizado!`, '✅');
        } else {
          product.kitTiers.push({
            id: 'tier_' + Date.now() + '_' + qty,
            name,
            quantity: qty,
            price,
            unitPrice: price / qty,
            isDefault: product.kitTiers.length === 0
          });
          showToast(`Pacote de ${qty} unidades adicionado!`, '✅');
        }

        product.kitTiers.sort((a, b) => a.quantity - b.quantity);
        if (!product.kitTiers.some(t => t.isDefault)) {
          product.kitTiers[0].isDefault = true;
        }

        product.kitMinQuantity = product.kitTiers[0]?.quantity || qty;
        isAddingKitTier = false;
        reRender(drawer);
      });
    }

    drawer.querySelectorAll('.btn-del-tier').forEach(btn => {
      btn.addEventListener('click', () => {
        const tierId = btn.dataset.tierId;
        if (!product.kitTiers) return;
        const wasDefault = product.kitTiers.find(t => t.id === tierId)?.isDefault;
        product.kitTiers = product.kitTiers.filter(t => t.id !== tierId);
        if (wasDefault && product.kitTiers.length > 0) {
          product.kitTiers[0].isDefault = true;
          product.price = product.kitTiers[0].price;
        }
        if (product.kitTiers.length > 0) {
          product.kitMinQuantity = product.kitTiers[0].quantity;
        }
        showToast('Pacote removido.', '🗑️');
        reRender(drawer);
      });
    });

    drawer.querySelectorAll('.btn-set-default-tier').forEach(btn => {
      btn.addEventListener('click', () => {
        const tierId = btn.dataset.tierId;
        if (!product.kitTiers) return;
        let selected = null;
        product.kitTiers.forEach(t => {
          if (t.id === tierId) {
            t.isDefault = true;
            selected = t;
          } else {
            t.isDefault = false;
          }
        });
        if (selected) {
          product.price = selected.price;
          showToast(`Pacote "${selected.name}" definido como padrão!`, '★');
        }
        reRender(drawer);
      });
    });

    // 7. Price History Inline (+) (Step 3)
    const btnToggleHist = drawer.querySelector('#btn-toggle-add-hist');
    if (btnToggleHist) {
      btnToggleHist.addEventListener('click', () => {
        isAddingPriceHistory = !isAddingPriceHistory;
        reRender(drawer);
      });
    }
    const btnCancelHist = drawer.querySelector('#btn-cancel-hist-price');
    if (btnCancelHist) {
      btnCancelHist.addEventListener('click', () => {
        isAddingPriceHistory = false;
        reRender(drawer);
      });
    }
    const btnSaveHist = drawer.querySelector('#btn-save-hist-price');
    if (btnSaveHist) {
      btnSaveHist.addEventListener('click', () => {
        const priceInp = drawer.querySelector('#inp-hist-price');
        const dateInp = drawer.querySelector('#inp-hist-date');
        const priceVal = parseFloat(priceInp?.value) || 0;
        const dateVal = dateInp?.value.trim() || new Date().toLocaleDateString('pt-BR');
        if (priceVal <= 0) {
          showToast('Informe um valor válido.', '⚠');
          return;
        }
        product.priceHistory = product.priceHistory || [];
        product.priceHistory.unshift({ price: priceVal, date: dateVal });
        isAddingPriceHistory = false;
        reRender(drawer);
      });
    }

    // 8. Personalization Fields (+) (Step 4)
    const btnToggleField = drawer.querySelector('#btn-toggle-add-pfield');
    if (btnToggleField) {
      btnToggleField.addEventListener('click', () => {
        isAddingField = !isAddingField;
        reRender(drawer);
      });
    }
    const btnCancelField = drawer.querySelector('#btn-cancel-new-pfield');
    if (btnCancelField) {
      btnCancelField.addEventListener('click', () => {
        isAddingField = false;
        reRender(drawer);
      });
    }
    const btnSaveField = drawer.querySelector('#btn-save-new-pfield');
    if (btnSaveField) {
      btnSaveField.addEventListener('click', () => {
        const nameInp = drawer.querySelector('#inp-new-pfield-name');
        const typeSel = drawer.querySelector('#sel-new-pfield-type');
        const defInp = drawer.querySelector('#inp-new-pfield-default');
        const reqChk = drawer.querySelector('#chk-new-pfield-req');

        const fieldName = nameInp ? nameInp.value.trim() : '';
        if (!fieldName) {
          showToast('Informe o nome do campo de personalização.', '⚠');
          return;
        }

        const id = 'field_' + generateId('f');
        product.personalizationFields = product.personalizationFields || [];
        product.personalizationFields.push({
          id,
          name: fieldName,
          type: typeSel ? typeSel.value : 'text',
          required: reqChk ? reqChk.checked : true,
          defaultValue: defInp ? defInp.value.trim() : ''
        });

        isAddingField = false;
        showToast(`Campo "${fieldName}" adicionado com sucesso!`, '✍️');
        reRender(drawer);
      });
    }

    drawer.querySelectorAll('.btn-del-pfield').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = parseInt(btn.dataset.index, 10);
        product.personalizationFields.splice(idx, 1);
        reRender(drawer);
      });
    });

    // 9. Change Options (+) (Step 4)
    const btnToggleOpt = drawer.querySelector('#btn-toggle-add-copt');
    if (btnToggleOpt) {
      btnToggleOpt.addEventListener('click', () => {
        isAddingOption = !isAddingOption;
        reRender(drawer);
      });
    }
    const btnCancelOpt = drawer.querySelector('#btn-cancel-new-copt');
    if (btnCancelOpt) {
      btnCancelOpt.addEventListener('click', () => {
        isAddingOption = false;
        reRender(drawer);
      });
    }
    const btnSaveOpt = drawer.querySelector('#btn-save-new-copt');
    if (btnSaveOpt) {
      btnSaveOpt.addEventListener('click', () => {
        const nameInp = drawer.querySelector('#inp-new-copt-name');
        const choicesInp = drawer.querySelector('#inp-new-copt-choices');
        const reqChk = drawer.querySelector('#chk-new-copt-req');

        const optName = nameInp ? nameInp.value.trim() : '';
        const choicesStr = choicesInp ? choicesInp.value.trim() : '';

        if (!optName) {
          showToast('Informe o nome da opção de alteração.', '⚠');
          return;
        }

        const choices = choicesStr ? choicesStr.split(',').map(s => s.trim()).filter(Boolean) : ['Opção 1'];
        const id = 'opt_' + generateId('o');

        product.changeOptions = product.changeOptions || [];
        product.changeOptions.push({
          id,
          name: optName,
          type: 'choice',
          required: reqChk ? reqChk.checked : true,
          defaultValue: choices[0] || '',
          choices
        });

        isAddingOption = false;
        showToast(`Opção "${optName}" adicionada com sucesso!`, '🎨');
        reRender(drawer);
      });
    }

    drawer.querySelectorAll('.btn-del-copt').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = parseInt(btn.dataset.index, 10);
        product.changeOptions.splice(idx, 1);
        reRender(drawer);
      });
    });

    // 10. Area Customization Mapping (+) (Step 5)
    const btnToggleArea = drawer.querySelector('#btn-toggle-add-area');
    if (btnToggleArea) {
      btnToggleArea.addEventListener('click', () => {
        isAddingArea = !isAddingArea;
        reRender(drawer);
      });
    }
    const btnCancelArea = drawer.querySelector('#btn-cancel-new-area');
    if (btnCancelArea) {
      btnCancelArea.addEventListener('click', () => {
        isAddingArea = false;
        reRender(drawer);
      });
    }
    const btnSaveArea = drawer.querySelector('#btn-save-new-area');
    if (btnSaveArea) {
      btnSaveArea.addEventListener('click', () => {
        const nameInp = drawer.querySelector('#inp-new-area-name');
        const fieldSel = drawer.querySelector('#sel-new-area-field');
        const xInp = drawer.querySelector('#inp-new-area-x');
        const yInp = drawer.querySelector('#inp-new-area-y');
        const wInp = drawer.querySelector('#inp-new-area-w');
        const fontInp = drawer.querySelector('#inp-new-area-font');

        const areaName = nameInp ? nameInp.value.trim() : 'Área de Personalização';

        product.editor = product.editor || { textAreas: [], elementAreas: [], colorAreas: [] };
        product.editor.textAreas = product.editor.textAreas || [];
        product.editor.textAreas.push({
          id: 'area_' + generateId('a'),
          name: areaName,
          label: areaName,
          page: 1,
          x: parseInt(xInp?.value, 10) || 120,
          y: parseInt(yInp?.value, 10) || 380,
          width: parseInt(wInp?.value, 10) || 350,
          height: 45,
          alignment: 'center',
          fontFamily: 'Helvetica',
          fontSize: parseInt(fontInp?.value, 10) || 24,
          fontWeight: 'bold',
          color: '#1e293b',
          personalizationFieldId: fieldSel?.value || ''
        });

        isAddingArea = false;
        showToast(`Área "${areaName}" apontada no gabarito!`, '🎯');
        reRender(drawer);
      });
    }

    drawer.querySelectorAll('.btn-del-area').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = parseInt(btn.dataset.index, 10);
        product.editor.textAreas.splice(idx, 1);
        reRender(drawer);
      });
    });

    // 11. Base PDF / PNG Upload (Step 5)
    const btnUpload = drawer.querySelector('#btn-trigger-upload-pdf');
    const fileInput = drawer.querySelector('#pcfg-pdf-file-input');
    const feedback = drawer.querySelector('#pcfg-pdf-feedback');

    if (btnUpload && fileInput) {
      btnUpload.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          if (feedback) feedback.innerHTML = '<span style="color: #4f46e5;">Carregando imagem/PDF do gabarito base...</span>';
          const meta = await uploadCustomBasePdf(product, file);
          product.basePdfMetadata = meta;
          if (feedback) feedback.innerHTML = `<span style="color: #059669; font-weight: 600;">✓ Arquivo "${escapeHtml(meta.name)}" carregado com sucesso!</span>`;
          setTimeout(() => reRender(drawer), 700);
        } catch (err) {
          if (feedback) feedback.innerHTML = `<span style="color: #dc2626;">⚠ ${escapeHtml(err.message)}</span>`;
        }
      });
    }
  }

  const footerHtml = `
    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
      <button class="btn" id="btn-cancel-pcfg">Cancelar</button>
      <div style="display: flex; gap: 8px;">
        <button class="btn" id="btn-prev-pcfg" style="display: none;">← Voltar</button>
        <button class="btn" id="btn-next-pcfg">Avançar →</button>
        <button class="btn btn-primary" id="btn-save-pcfg">Salvar Produto</button>
      </div>
    </div>
  `;

  openDrawerFn({
    title: isEdit ? `Configurar Produto · ${escapeHtml(product.name || 'Sem Nome')}` : 'Cadastrar Novo Produto',
    contentHtml: `<div id="drawer-dynamic-content">${renderDrawerContent()}</div>`,
    footerHtml,
    onMount: (drawer) => {
      bindEvents(drawer);

      const updateNavButtons = () => {
        const btnPrev = drawer.querySelector('#btn-prev-pcfg');
        const btnNext = drawer.querySelector('#btn-next-pcfg');
        if (btnPrev) btnPrev.style.display = activeStep > 1 ? 'inline-block' : 'none';
        if (btnNext) btnNext.style.display = activeStep < 5 ? 'inline-block' : 'none';
      };
      updateNavButtons();

      drawer.querySelector('#btn-cancel-pcfg').addEventListener('click', closeDrawerFn);

      drawer.querySelector('#btn-prev-pcfg')?.addEventListener('click', () => {
        saveCurrentStepInputs(drawer);
        if (activeStep > 1) {
          activeStep--;
          reRender(drawer);
          updateNavButtons();
        }
      });

      drawer.querySelector('#btn-next-pcfg')?.addEventListener('click', () => {
        saveCurrentStepInputs(drawer);
        if (activeStep < 5) {
          activeStep++;
          reRender(drawer);
          updateNavButtons();
        }
      });

      drawer.querySelector('#btn-save-pcfg').addEventListener('click', () => {
        saveCurrentStepInputs(drawer);

        if (!product.name || !product.name.trim()) {
          activeStep = 1;
          reRender(drawer);
          updateNavButtons();
          showToast('Informe o Nome do Produto no Passo 01.', '⚠');
          const nameInp = drawer.querySelector('#inp-pcfg-name');
          if (nameInp) nameInp.focus();
          return;
        }

        // Sincroniza foto principal e mockups antes de persistir
        product.mockups = product.mockups || { front: '', angle: '', back: '' };
        if (!product.imageUrl && product.mockups.front) {
          product.imageUrl = product.mockups.front;
        }
        if (!product.mockups.front && product.imageUrl) {
          product.mockups.front = product.imageUrl;
        }
        if (!product.imageUrl && product.images && product.images.length > 0) {
          product.imageUrl = product.images[0].url;
          if (!product.mockups.front) product.mockups.front = product.images[0].url;
        }

        // Automatic price history register if price changed
        const currentPrice = Number(product.price) || 0;
        product.priceHistory = product.priceHistory || [];
        const lastHist = product.priceHistory[0];
        if (!lastHist || Math.abs(Number(lastHist.price) - currentPrice) > 0.01) {
          product.priceHistory.unshift({
            price: currentPrice,
            date: new Date().toLocaleDateString('pt-BR')
          });
        }

        if (product.isKit) {
          if (!product.kitTiers || product.kitTiers.length === 0) {
            generateDefaultKitTiers('standard');
          }
          const defaultTier = product.kitTiers.find(t => t.isDefault) || product.kitTiers[0];
          if (defaultTier) {
            product.price = defaultTier.price;
            product.kitMinQuantity = product.kitTiers[0].quantity;
          }
        }

        try {
          let savedProduct;
          if (isEdit) {
            savedProduct = updateProduct(product.id, product);
            showToast(`Produto "${savedProduct.name}" atualizado com sucesso!`, '✅');
          } else {
            savedProduct = createProduct(product);
            showToast(`Produto "${savedProduct.name}" cadastrado com sucesso!`, '🎉');
          }

          closeDrawerFn();
          if (typeof onSaved === 'function') onSaved(savedProduct);
        } catch (err) {
          showToast(err.message, '⚠');
        }
      });
    }
  });
}
