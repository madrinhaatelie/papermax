/**
 * PAPER MAX - Stock CSV Import / Export Engine
 * Full CSV integration for Insumos, Componentes, Fornecedores, Compras e Movimentações.
 */

import { generateCSV, parseCSV } from '../../utils/csv.js';
import { generateId } from '../../utils/sanitize.js';

// ==========================================
// 1. INSUMOS (MATERIAIS) CSV
// ==========================================

export function exportMaterialsCSV(materials = []) {
  const headers = ['id', 'nome', 'unidade_base', 'estoque_atual', 'estoque_minimo', 'custo_embalagem', 'qtd_embalagem', 'unidade_embalagem', 'fornecedor_nome', 'observacoes'];
  const rows = materials.map(m => ({
    id: m.id,
    nome: m.name,
    unidade_base: m.baseUnit || 'un',
    estoque_atual: m.currentStock || 0,
    estoque_minimo: m.minStock || 0,
    custo_embalagem: (m.purchaseCost || 0).toFixed(2),
    qtd_embalagem: m.packQuantity || 1,
    unidade_embalagem: m.purchaseUnit || m.baseUnit || 'un',
    fornecedor_nome: m.supplierName || '',
    observacoes: m.notes || ''
  }));
  return generateCSV(headers, rows);
}

export function importMaterialsCSV(csvText, existingMaterials = []) {
  const { headers, rows } = parseCSV(csvText);
  if (rows.length === 0) {
    return { success: false, errors: ['O arquivo CSV de insumos está vazio ou sem linhas de dados.'], count: 0 };
  }

  const requiredFields = ['nome', 'unidade_base'];
  const missing = requiredFields.filter(f => !headers.includes(f));
  if (missing.length > 0) {
    return {
      success: false,
      errors: [`Colunas obrigatórias ausentes no CSV: ${missing.join(', ')}. Cabeçalhos esperados: ${headers.join(', ')}`],
      count: 0
    };
  }

  const errors = [];
  const importedList = [...existingMaterials];
  let importedCount = 0;

  rows.forEach((row, idx) => {
    const lineNum = row._line || (idx + 2);
    const name = (row.nome || '').trim();
    if (!name) {
      errors.push(`Linha ${lineNum}: O nome do insumo é obrigatório.`);
      return;
    }

    const baseUnit = (row.unidade_base || 'un').trim().toLowerCase();
    const currentStock = Number(row.estoque_atual) || 0;
    const minStock = Number(row.estoque_minimo) || 0;
    const purchaseCost = Number(row.custo_embalagem) || 0;
    const packQuantity = Number(row.qtd_embalagem) || 1;
    const purchaseUnit = (row.unidade_embalagem || baseUnit).trim().toLowerCase();
    const supplierName = (row.fornecedor_nome || '').trim();
    const notes = (row.observacoes || '').trim();

    const existingIdx = importedList.findIndex(m => m.name.toLowerCase() === name.toLowerCase());

    const itemData = {
      id: (row.id && row.id.trim()) || (existingIdx >= 0 ? importedList[existingIdx].id : generateId('mat')),
      name,
      baseUnit,
      currentStock,
      minStock,
      purchaseCost,
      packQuantity,
      purchaseUnit,
      supplierName,
      notes,
      updatedAt: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      importedList[existingIdx] = { ...importedList[existingIdx], ...itemData };
    } else {
      itemData.createdAt = new Date().toISOString();
      importedList.push(itemData);
    }
    importedCount++;
  });

  if (errors.length > 0) {
    return { success: false, errors, count: 0 };
  }

  return { success: true, count: importedCount, materials: importedList };
}

// ==========================================
// 2. COMPONENTES CSV
// ==========================================

export function exportComponentsCSV(components = []) {
  const headers = ['id', 'nome', 'rendimento', 'estoque_atual', 'estoque_minimo', 'itens_ficha_tecnica', 'observacoes'];
  const rows = components.map(c => ({
    id: c.id,
    nome: c.name,
    rendimento: c.yield || 1,
    estoque_atual: c.currentStock || 0,
    estoque_minimo: c.minStock || 0,
    itens_ficha_tecnica: JSON.stringify(c.items || []),
    observacoes: c.notes || ''
  }));
  return generateCSV(headers, rows);
}

// ==========================================
// 3. FORNECEDORES CSV
// ==========================================

export function exportSuppliersCSV(suppliers = []) {
  const headers = ['id', 'nome', 'razao_social', 'contato', 'telefone', 'email', 'loja_url', 'observacoes'];
  const rows = suppliers.map(s => ({
    id: s.id,
    nome: s.name,
    razao_social: s.companyName || '',
    contato: s.contact || '',
    telefone: s.phone || '',
    email: s.email || '',
    loja_url: s.storeUrl || '',
    observacoes: s.notes || ''
  }));
  return generateCSV(headers, rows);
}

export function importSuppliersCSV(csvText, existingSuppliers = []) {
  const { headers, rows } = parseCSV(csvText);
  if (rows.length === 0) {
    return { success: false, errors: ['CSV de fornecedores vazio.'], count: 0 };
  }

  if (!headers.includes('nome')) {
    return { success: false, errors: ['A coluna "nome" é obrigatória para importação de fornecedores.'], count: 0 };
  }

  const errors = [];
  const list = [...existingSuppliers];
  let count = 0;

  rows.forEach((row, idx) => {
    const lineNum = row._line || (idx + 2);
    const name = (row.nome || '').trim();
    if (!name) {
      errors.push(`Linha ${lineNum}: O nome do fornecedor é obrigatório.`);
      return;
    }

    const item = {
      id: (row.id && row.id.trim()) || generateId('sup'),
      name,
      companyName: (row.razao_social || '').trim(),
      contact: (row.contato || '').trim(),
      phone: (row.telefone || '').trim(),
      email: (row.email || '').trim(),
      storeUrl: (row.loja_url || '').trim(),
      notes: (row.observacoes || '').trim(),
      createdAt: new Date().toISOString()
    };

    const existingIdx = list.findIndex(s => s.name.toLowerCase() === name.toLowerCase());
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...item };
    } else {
      list.push(item);
    }
    count++;
  });

  if (errors.length > 0) {
    return { success: false, errors, count: 0 };
  }

  return { success: true, count, suppliers: list };
}

// ==========================================
// 4. MOVIMENTAÇÕES CSV
// ==========================================

export function exportMovementsCSV(movements = []) {
  const headers = ['id', 'data_hora', 'tipo', 'motivo', 'material_nome', 'quantidade', 'unidade', 'estoque_anterior', 'novo_estoque', 'origem', 'operador', 'observacoes'];
  const rows = movements.map(m => ({
    id: m.id,
    data_hora: m.createdAt ? new Date(m.createdAt).toLocaleString('pt-BR') : '',
    tipo: m.type === 'entrada' ? 'Entrada' : 'Saída',
    motivo: m.reason || '',
    material_nome: m.materialName || '',
    quantidade: m.quantity || 0,
    unidade: m.unit || '',
    estoque_anterior: m.previousStock || 0,
    novo_estoque: m.newStock || 0,
    origem: m.origin || '',
    operador: m.operator || '',
    observacoes: m.notes || ''
  }));
  return generateCSV(headers, rows);
}
