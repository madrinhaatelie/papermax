/**
 * PAPER MAX - Motor Único de Dados e Personalização (personalization.engine.js)
 * 
 * Unifica e padroniza a entrada de dados para:
 * 1. Formulário Individual de Pedido
 * 2. Entrada Rápida em Lista (com suporte a tecla Enter)
 * 3. Importação de CSV / Planilha
 * 
 * Todas as fontes convergem para a mesma Lista Estruturada e passam pelas mesmas
 * regras de validação e geração de lotes assíncronos.
 */

import { generatePersonalizedPdf } from './pdf.engine.js';
import { parseCSV, generateCSV } from '../../utils/csv.js';

export const BULK_DRAFT_KEY = 'papermax.draft.bulk.v1';

/**
 * Normaliza um identificador de coluna para comparação segura (case insensitive e sem acentos).
 */
export function normalizeKey(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Retorna as colunas oficiais exigidas e suportadas por um produto:
 * - Campos de personalização (ex: NOME, IDADE)
 * - Opções de alteração (ex: COR, ELEMENTO, LATERAL, ALÇA)
 */
export function getProductColumns(product) {
  if (!product) return [];

  const columns = [];

  // 1. Personalization fields
  const pFields = product.personalizationFields || [];
  pFields.forEach(f => {
    columns.push({
      id: f.id,
      key: normalizeKey(f.name || f.id),
      label: f.name || f.label || f.id,
      category: 'personalization',
      type: f.type || 'text',
      required: Boolean(f.required),
      defaultValue: f.defaultValue || '',
      choices: null
    });
  });

  // 2. Change options
  const cOpts = product.changeOptions || [];
  cOpts.forEach(opt => {
    columns.push({
      id: opt.id,
      key: normalizeKey(opt.name || opt.id),
      label: opt.name || opt.id,
      category: 'change_option',
      type: 'choice',
      required: Boolean(opt.required),
      defaultValue: opt.defaultValue || (opt.choices && opt.choices[0]) || '',
      choices: opt.choices || []
    });
  });

  return columns;
}

/**
 * Cria uma nova linha vazia preenchida com valores padrão do produto.
 */
export function createEmptyItem(product, index = 1) {
  const columns = getProductColumns(product);
  const personalization = {};
  const changeOptions = {};

  columns.forEach(col => {
    if (col.category === 'personalization') {
      personalization[col.id] = col.defaultValue || '';
    } else {
      changeOptions[col.id] = col.defaultValue || '';
    }
  });

  return {
    id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    index,
    personalization,
    changeOptions,
    status: 'pending', // 'valid' | 'error' | 'pending' | 'processing' | 'success'
    errors: [],
    generatedFile: null
  };
}

/**
 * Valida uma linha individual de personalização contra as regras do produto.
 */
export function validateItem(item, product) {
  const errors = [];
  const columns = getProductColumns(product);

  columns.forEach(col => {
    const isP = col.category === 'personalization';
    const val = isP ? item.personalization?.[col.id] : item.changeOptions?.[col.id];
    const strVal = val !== undefined && val !== null ? String(val).trim() : '';

    // Validação de obrigatoriedade
    if (col.required && !strVal) {
      errors.push(`Campo obrigatório ausente: "${col.label}"`);
    }

    // Validação de opções de alteração com escolhas fixas
    if (col.type === 'choice' && col.choices && col.choices.length > 0 && strVal) {
      const match = col.choices.some(choice => normalizeKey(choice) === normalizeKey(strVal));
      if (!match) {
        errors.push(`Opção "${col.label}" contém valor inválido ("${strVal}"). Opções permitidas: [${col.choices.join(', ')}]`);
      }
    }

    // Validação de número
    if (col.type === 'number' && strVal) {
      if (isNaN(Number(strVal))) {
        errors.push(`Campo "${col.label}" deve ser numérico.`);
      }
    }
  });

  const isValid = errors.length === 0;
  return {
    ...item,
    isValid,
    status: isValid ? 'valid' : 'error',
    errors
  };
}

/**
 * Valida todo o conjunto de itens da lista estruturada.
 */
export function validateAllItems(items, product) {
  const validated = items.map((item, idx) => {
    return validateItem({ ...item, index: idx + 1 }, product);
  });

  const validCount = validated.filter(i => i.isValid).length;
  const errorCount = validated.length - validCount;

  return {
    items: validated,
    total: validated.length,
    validCount,
    errorCount,
    allValid: errorCount === 0 && validated.length > 0
  };
}

/**
 * Gera um modelo dinâmico CSV customizado estritamente para os campos do produto informado.
 * Exemplo Sacola M:
 * NOME;IDADE;COR;ELEMENTO;LATERAL;ALCA
 */
export function generateDynamicCSVTemplate(product) {
  const columns = getProductColumns(product);
  const headers = columns.map(c => c.label.toUpperCase());

  // Gera 2 linhas de exemplo realistas
  const exampleRow1 = {};
  const exampleRow2 = {};

  columns.forEach(col => {
    const k = col.label.toUpperCase();
    if (col.key.includes('nome')) {
      exampleRow1[k] = 'Maria';
      exampleRow2[k] = 'João';
    } else if (col.key.includes('idade')) {
      exampleRow1[k] = '8';
      exampleRow2[k] = '10';
    } else if (col.key.includes('cor')) {
      exampleRow1[k] = col.choices?.[0] || 'Rosa';
      exampleRow2[k] = col.choices?.[1] || 'Azul';
    } else if (col.key.includes('elemento')) {
      exampleRow1[k] = col.choices?.[0] || 'Flores';
      exampleRow2[k] = col.choices?.[1] || 'Estrelas';
    } else if (col.key.includes('lateral')) {
      exampleRow1[k] = col.choices?.[0] || 'Direita';
      exampleRow2[k] = col.choices?.[1] || 'Esquerda';
    } else if (col.key.includes('alca')) {
      exampleRow1[k] = col.choices?.[0] || 'Cetim';
      exampleRow2[k] = col.choices?.[1] || 'Nylon';
    } else {
      exampleRow1[k] = col.defaultValue || 'Exemplo 1';
      exampleRow2[k] = col.defaultValue || 'Exemplo 2';
    }
  });

  return generateCSV(headers, [exampleRow1, exampleRow2]);
}

/**
 * Importa texto CSV e mapeia dinamicamente para os campos e opções do produto.
 */
export function parseAndMapCSV(csvText, product) {
  if (!csvText || !csvText.trim()) {
    throw new Error('Conteúdo CSV vazio.');
  }

  const { headers, rows } = parseCSV(csvText);
  if (!headers || headers.length === 0 || rows.length === 0) {
    throw new Error('Nenhuma linha de dados encontrada no CSV.');
  }

  const columns = getProductColumns(product);

  // Cria mapa de cabeçalhos CSV normalizados para as colunas do produto
  const headerToColMap = new Map();
  headers.forEach(h => {
    const normH = normalizeKey(h);
    // Tenta correspondência exata ou aproximada
    const matchedCol = columns.find(col => {
      const normColKey = normalizeKey(col.key);
      const normColLabel = normalizeKey(col.label);
      return normColKey === normH || normColLabel === normH || normColKey.includes(normH) || normH.includes(normColKey);
    });
    if (matchedCol) {
      headerToColMap.set(h, matchedCol);
    }
  });

  const items = [];
  rows.forEach((row, idx) => {
    const personalization = {};
    const changeOptions = {};

    // Preenche inicialmente com padrões
    columns.forEach(col => {
      if (col.category === 'personalization') {
        personalization[col.id] = col.defaultValue || '';
      } else {
        changeOptions[col.id] = col.defaultValue || '';
      }
    });

    // Mapeia valores presentes no CSV
    Object.entries(row).forEach(([csvHeader, cellValue]) => {
      if (csvHeader === '_line') return;
      const matchedCol = headerToColMap.get(csvHeader);
      if (matchedCol) {
        if (matchedCol.category === 'personalization') {
          personalization[matchedCol.id] = cellValue;
        } else {
          // Se for opção com escolhas, tenta encontrar a melhor correspondência de escolha
          if (matchedCol.choices && matchedCol.choices.length > 0) {
            const bestChoice = matchedCol.choices.find(
              ch => normalizeKey(ch) === normalizeKey(cellValue)
            );
            changeOptions[matchedCol.id] = bestChoice || cellValue;
          } else {
            changeOptions[matchedCol.id] = cellValue;
          }
        }
      }
    });

    const item = {
      id: `csv_item_${idx + 1}_${Date.now()}`,
      index: idx + 1,
      personalization,
      changeOptions,
      status: 'pending',
      errors: [],
      generatedFile: null
    };

    items.push(item);
  });

  return validateAllItems(items, product);
}

/**
 * PROCESSADOR DE LOTE ASSÍNCRONO (MOTOR ÚNICO)
 * 
 * Executa a geração em lotes pequenos (ex: 3 por frame) com yields
 * para que a interface NÃO TRAVE em 100+ itens.
 * 
 * Atualiza o progresso em tempo real:
 * - total
 * - processed
 * - successCount
 * - errorCount
 * - currentItem
 */
export async function runPersonalizationBatch({
  product,
  items,
  orderId = null,
  orderNumber = null,
  onProgress = null
}) {
  if (!product) throw new Error('Produto não informado.');
  if (!items || items.length === 0) throw new Error('Nenhum item na lista para gerar.');

  const results = [];
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  const total = items.length;

  for (let i = 0; i < total; i++) {
    const item = items[i];

    // Valida o item antes de tentar gerar
    const validated = validateItem(item, product);
    if (!validated.isValid) {
      errorCount++;
      const errDetail = {
        itemIndex: item.index || i + 1,
        name: item.personalization?.field_nome || item.personalization?.nome || `Linha ${i + 1}`,
        message: validated.errors.join('; ')
      };
      errors.push(errDetail);
      results.push({
        itemIndex: item.index || i + 1,
        success: false,
        error: validated.errors.join('; '),
        item
      });

      if (typeof onProgress === 'function') {
        onProgress({
          total,
          processed: i + 1,
          pending: total - (i + 1),
          successCount,
          errorCount,
          currentName: errDetail.name,
          currentStatus: 'error'
        });
      }
      continue;
    }

    try {
      // Notifica início do item
      if (typeof onProgress === 'function') {
        onProgress({
          total,
          processed: i,
          pending: total - i,
          successCount,
          errorCount,
          currentName: item.personalization?.field_nome || item.personalization?.nome || `Item ${i + 1}`,
          currentStatus: 'processing'
        });
      }

      // Pequeno yield no event loop para manter a renderização dos 60fps no DOM
      await new Promise(resolve => setTimeout(resolve, 30));

      const customer = item.personalization?.field_nome || item.personalization?.nome || `Item ${i + 1}`;

      const generated = await generatePersonalizedPdf({
        product,
        personalizationData: item.personalization,
        changeOptionsData: item.changeOptions,
        orderId,
        orderNumber,
        customerName: customer,
        itemIndex: item.index || i + 1
      });

      successCount++;
      results.push({
        itemIndex: item.index || i + 1,
        success: true,
        file: generated,
        item
      });

      if (typeof onProgress === 'function') {
        onProgress({
          total,
          processed: i + 1,
          pending: total - (i + 1),
          successCount,
          errorCount,
          currentName: customer,
          currentStatus: 'success',
          lastGenerated: generated
        });
      }
    } catch (err) {
      errorCount++;
      const errDetail = {
        itemIndex: item.index || i + 1,
        name: item.personalization?.field_nome || `Linha ${i + 1}`,
        message: err.message || 'Falha ao processar PDF'
      };
      errors.push(errDetail);
      results.push({
        itemIndex: item.index || i + 1,
        success: false,
        error: err.message,
        item
      });

      if (typeof onProgress === 'function') {
        onProgress({
          total,
          processed: i + 1,
          pending: total - (i + 1),
          successCount,
          errorCount,
          currentName: errDetail.name,
          currentStatus: 'error'
        });
      }
    }
  }

  return {
    total,
    successCount,
    errorCount,
    results,
    errors,
    allSucceeded: errorCount === 0
  };
}

/**
 * Persiste rascunho de personalização em massa para recuperação automática (Autosave).
 */
export function saveBulkDraft(productId, items) {
  try {
    const payload = {
      productId,
      items: items.map(item => ({
        id: item.id,
        index: item.index,
        personalization: item.personalization,
        changeOptions: item.changeOptions
      })),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(BULK_DRAFT_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('[PersonalizationEngine] Autosave draft error:', e);
  }
}

/**
 * Carrega rascunho salvo anteriormente para o produto.
 */
export function loadBulkDraft(productId) {
  try {
    const raw = localStorage.getItem(BULK_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.productId === productId && Array.isArray(parsed.items)) {
      return parsed.items;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Limpa o rascunho de personalização em massa após conclusão com sucesso.
 */
export function clearBulkDraft() {
  try {
    localStorage.removeItem(BULK_DRAFT_KEY);
  } catch {}
}
