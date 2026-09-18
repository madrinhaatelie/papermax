/**
 * PAPER MAX - Settings Engine
 * Manages Atelier Identity, Print Queue, Audit Logging, Document Configuration,
 * Real-time Alerts Evaluation, and Data Security.
 */

import {
  loadSettings,
  saveSettings,
  loadPrintQueue,
  savePrintQueue,
  loadAuditLogs,
  saveAuditLogs,
  loadDocConfigs,
  saveDocConfigs,
  loadAlertsConfig,
  saveAlertsConfig,
  loadOrders,
  loadProducts,
  loadMaterials,
  loadComponents,
  loadSuppliers,
  loadPurchases,
  loadMovements,
  loadExpenses,
  loadReceivables,
  loadPayables,
  getLocalStorage,
  STORAGE_KEYS
} from '../../data/storage.js';
import { bus } from '../../core/events.js';
import { generateId, formatDateBR } from '../../utils/sanitize.js';
import { exportBackup, restoreBackup, getLastBackupTimestamp } from '../../data/backup.engine.js';

// ==========================================
// 1. SETTINGS & ATELIER PREFERENCES
// ==========================================

export function getSettings() {
  return loadSettings();
}

export function updateSettings(partial) {
  const current = loadSettings();
  const updated = {
    ...current,
    ...partial,
    docVisibility: {
      ...(current.docVisibility || {}),
      ...(partial.docVisibility || {})
    },
    printer: {
      ...(current.printer || {}),
      ...(partial.printer || {})
    },
    printBehavior: {
      ...(current.printBehavior || {}),
      ...(partial.printBehavior || {})
    },
    automationSwitches: {
      ...(current.automationSwitches || {}),
      ...(partial.automationSwitches || {})
    }
  };

  saveSettings(updated, true);
  bus.emit('settings:updated', updated);

  recordAuditLog({
    module: 'Sistema',
    action: 'Atualização de Configurações',
    target: 'Ajustes do Sistema',
    user: 'Operador',
    operation: 'Configurações do ateliê e preferências atualizadas.',
    details: Object.keys(partial).join(', ')
  });

  return updated;
}

// ==========================================
// 2. AUDIT LOGS ENGINE
// ==========================================

export function recordAuditLog({ module = 'Sistema', action = 'Operação', target = '-', user = 'Operador', operation = '', details = '' }) {
  try {
    const logs = loadAuditLogs();
    const newLog = {
      id: generateId('audit_'),
      timestamp: new Date().toISOString(),
      module,
      action,
      target,
      user,
      operation: operation || `${action} em ${target}`,
      details
    };

    // Keep up to 500 logs, prepending newest
    const updatedLogs = [newLog, ...logs.slice(0, 499)];
    saveAuditLogs(updatedLogs, true);
    bus.emit('audit:logged', newLog);
    return newLog;
  } catch (err) {
    console.error('[AuditEngine] Failed to record audit log:', err);
    return null;
  }
}

export function getAuditLogs(filter = {}) {
  let logs = loadAuditLogs();

  if (filter.module && filter.module !== 'todos') {
    logs = logs.filter(l => (l.module || '').toLowerCase() === filter.module.toLowerCase());
  }

  if (filter.search) {
    const s = filter.search.toLowerCase();
    logs = logs.filter(l =>
      (l.operation || '').toLowerCase().includes(s) ||
      (l.target || '').toLowerCase().includes(s) ||
      (l.action || '').toLowerCase().includes(s) ||
      (l.user || '').toLowerCase().includes(s) ||
      (l.details || '').toLowerCase().includes(s)
    );
  }

  return logs;
}

export function exportAuditLogsCSV() {
  const logs = loadAuditLogs();
  if (!logs || logs.length === 0) {
    return { success: false, message: 'Nenhum log para exportar.' };
  }

  const headers = ['Data/Hora', 'Módulo', 'Ação', 'Registro Afetado', 'Usuário', 'Operação', 'Detalhes'];
  const rows = logs.map(l => [
    new Date(l.timestamp).toLocaleString('pt-BR'),
    `"${(l.module || '').replace(/"/g, '""')}"`,
    `"${(l.action || '').replace(/"/g, '""')}"`,
    `"${(l.target || '').replace(/"/g, '""')}"`,
    `"${(l.user || '').replace(/"/g, '""')}"`,
    `"${(l.operation || '').replace(/"/g, '""')}"`,
    `"${(l.details || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PAPER-MAX-Auditoria-Logs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { success: true, count: logs.length };
}

export function exportAuditLogsJSON() {
  const logs = loadAuditLogs();
  const jsonString = JSON.stringify(logs, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PAPER-MAX-Auditoria-Logs-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { success: true, count: logs.length };
}

// ==========================================
// 3. PRINT QUEUE ENGINE (FILA DE IMPRESSÃO)
// ==========================================

export function getPrintQueue(filter = {}) {
  let queue = loadPrintQueue();

  if (filter.status && filter.status !== 'todos') {
    queue = queue.filter(item => (item.status || '').toLowerCase() === filter.status.toLowerCase());
  }

  if (filter.search) {
    const s = filter.search.toLowerCase();
    queue = queue.filter(item =>
      (item.documentType || '').toLowerCase().includes(s) ||
      (item.orderNumber || '').toLowerCase().includes(s) ||
      (item.orderTitle || '').toLowerCase().includes(s) ||
      (item.customer || '').toLowerCase().includes(s)
    );
  }

  return queue;
}

export function getPendingPrintJobsCount() {
  const queue = loadPrintQueue();
  return queue.filter(item => {
    const s = (item.status || '').toLowerCase();
    return s === 'aguardando' || s === 'em processamento' || s === 'pendente';
  }).length;
}

export function addPrintQueueItem({
  documentType = 'Ordem de Serviço (O.S.)',
  orderId = null,
  orderNumber = '',
  orderTitle = '',
  customer = '',
  qty = 1,
  format = 'A4',
  notes = '',
  details = {}
}) {
  const queue = loadPrintQueue();
  const newItem = {
    id: generateId('pq_'),
    documentType,
    orderId,
    orderNumber: orderNumber || (orderId ? `Pedido ${orderId}` : 'Documento Avulso'),
    orderTitle,
    customer,
    qty: Number(qty) || 1,
    format,
    status: 'Aguardando',
    createdAt: new Date().toISOString(),
    printedAt: null,
    notes,
    details
  };

  const updated = [newItem, ...queue];
  savePrintQueue(updated, true);
  bus.emit('print:enqueued', newItem);

  recordAuditLog({
    module: 'Impressão',
    action: 'Fila de Impressão',
    target: newItem.orderNumber,
    user: 'Operador',
    operation: `${newItem.documentType} adicionado à fila de impressão (${newItem.qty} un).`,
    details: notes || `Formato: ${format}`
  });

  return newItem;
}

export function updatePrintQueueStatus(itemId, status, notes = '') {
  const queue = loadPrintQueue();
  const index = queue.findIndex(q => q.id === itemId);
  if (index === -1) return null;

  const item = queue[index];
  item.status = status;
  if (status === 'Impresso') {
    item.printedAt = new Date().toISOString();
  }
  if (notes) {
    item.notes = notes;
  }

  queue[index] = item;
  savePrintQueue(queue, true);
  bus.emit('print:status_changed', item);

  recordAuditLog({
    module: 'Impressão',
    action: 'Status da Fila',
    target: item.orderNumber,
    user: 'Operador',
    operation: `Item da fila (${item.documentType}) atualizado para: ${status}.`,
    details: item.printedAt ? `Impresso em ${new Date(item.printedAt).toLocaleTimeString('pt-BR')}` : ''
  });

  return item;
}

export function duplicatePrintQueueItem(itemId) {
  const queue = loadPrintQueue();
  const target = queue.find(q => q.id === itemId);
  if (!target) return null;

  const newItem = {
    ...target,
    id: generateId('pq_'),
    status: 'Aguardando',
    createdAt: new Date().toISOString(),
    printedAt: null,
    notes: target.notes ? `${target.notes} (Cópia)` : 'Trabalho duplicado'
  };

  const updated = [newItem, ...queue];
  savePrintQueue(updated, true);
  bus.emit('print:enqueued', newItem);

  recordAuditLog({
    module: 'Impressão',
    action: 'Duplicação na Fila',
    target: newItem.orderNumber,
    user: 'Operador',
    operation: `Item duplicado na fila de impressão: ${newItem.documentType}.`,
    details: `Novo ID: ${newItem.id}`
  });

  return newItem;
}

export function updatePrintQueueItem(itemId, partial = {}) {
  const queue = loadPrintQueue();
  const index = queue.findIndex(q => q.id === itemId);
  if (index === -1) return null;

  const updatedItem = {
    ...queue[index],
    ...partial
  };

  queue[index] = updatedItem;
  savePrintQueue(queue, true);
  bus.emit('print:status_changed', updatedItem);

  recordAuditLog({
    module: 'Impressão',
    action: 'Edição na Fila',
    target: updatedItem.orderNumber,
    user: 'Operador',
    operation: `Item da fila (${updatedItem.documentType}) atualizado.`
  });

  return updatedItem;
}

export function deletePrintQueueItem(itemId) {
  const queue = loadPrintQueue();
  const target = queue.find(q => q.id === itemId);
  const updated = queue.filter(q => q.id !== itemId);
  savePrintQueue(updated, true);

  if (target) {
    recordAuditLog({
      module: 'Impressão',
      action: 'Exclusão da Fila',
      target: target.orderNumber,
      user: 'Operador',
      operation: `Item (${target.documentType}) removido da fila de impressão.`
    });
  }

  return true;
}

export function clearCompletedPrintQueue() {
  const queue = loadPrintQueue();
  const kept = queue.filter(q => {
    const s = (q.status || '').toLowerCase();
    return s === 'aguardando' || s === 'em processamento';
  });

  const removedCount = queue.length - kept.length;
  savePrintQueue(kept, true);

  if (removedCount > 0) {
    recordAuditLog({
      module: 'Impressão',
      action: 'Limpeza da Fila',
      target: 'Fila de Impressão',
      user: 'Operador',
      operation: `${removedCount} itens impressos ou cancelados foram limpos da fila.`
    });
  }

  return removedCount;
}

// ==========================================
// 4. DOCUMENT CONFIGURATIONS & TEMPLATE RENDERER
// ==========================================

export function getDocumentConfigs() {
  return loadDocConfigs();
}

export function updateDocumentConfig(docKey, partial) {
  const configs = loadDocConfigs();
  const current = configs[docKey] || {};
  configs[docKey] = { ...current, ...partial };
  saveDocConfigs(configs, true);
  bus.emit('docs:config_updated', { docKey, config: configs[docKey] });

  recordAuditLog({
    module: 'Documentos',
    action: 'Configuração de Documento',
    target: docKey.toUpperCase(),
    user: 'Operador',
    operation: `Configurações do modelo de ${docKey} foram atualizadas.`
  });

  return configs[docKey];
}

/**
 * Generate formatted HTML for print preview or physical printing
 */
export function generateDocumentHtml(docType, targetRecord = null, customOptions = {}) {
  const settings = loadSettings();
  const docConfigs = loadDocConfigs();
  const orders = loadOrders();
  const products = loadProducts();
  const materials = loadMaterials();

  // Pick sample or real record if not provided
  let order = null;
  let product = null;
  let material = null;

  if (targetRecord) {
    if (targetRecord.customer || targetRecord.number) order = targetRecord;
    if (targetRecord.categoryId || targetRecord.price) product = targetRecord;
    if (targetRecord.baseUnit || targetRecord.minStock) material = targetRecord;
  }

  if (!order) order = orders[0] || {
    id: 1048,
    number: 1048,
    customer: 'Juliana Ferreira',
    customerPhone: '(11) 98765-4321',
    productId: 'prod_sacola_m',
    productTitle: 'Sacola M Kraft Personalizada',
    qty: 30,
    orderDate: '05/09/2026',
    deliveryDate: '19/09/2026',
    statusLabel: 'Em produção',
    paidAmount: 255.00,
    payments: [{ method: 'PIX', amount: 255.00, datetime: '05/09/26 às 10:30' }],
    notes: 'Tema Jardim Encantado com laço de cetim rosa.',
    personalization: { field_nome: 'Maria Eduarda', field_idade: '7 anos' },
    changeOptions: { opt_cor: 'Rosa Chá', opt_alca: 'Cetim' }
  };

  if (!product) product = products[0] || {
    id: 'prod_sacola_m',
    name: 'Sacola M Kraft',
    price: 8.50,
    cost: 3.20,
    description: 'Sacola personalizada papel kraft 180g'
  };

  if (!material) material = materials[0] || {
    id: 'mat_papel_kraft_180',
    name: 'Papel Kraft 180g A4',
    baseUnit: 'folha',
    currentStock: 120,
    minStock: 40,
    purchaseCost: 0.50,
    supplierName: 'Papéis & Cia Distribuidora'
  };

  const atelier = {
    name: settings.docVisibility?.atelierName ? settings.atelierName : '',
    owner: settings.docVisibility?.ownerName ? settings.ownerName : '',
    phone: settings.docVisibility?.phone ? settings.phone : '',
    whatsapp: settings.docVisibility?.whatsapp ? settings.whatsapp : '',
    email: settings.docVisibility?.email ? settings.email : '',
    address: settings.docVisibility?.address ? settings.address : '',
    instagram: settings.docVisibility?.instagram ? settings.instagram : '',
    docNumber: settings.docVisibility?.docNumber ? settings.docNumber : '',
    logo: settings.docVisibility?.logo ? settings.logo : ''
  };

  switch (docType) {
    case 'os': {
      const cfg = docConfigs.os || {};
      const persList = Object.entries(order.personalization || {})
        .map(([k, v]) => `<li><strong>${k.replace('field_', '')}:</strong> ${v}</li>`)
        .join('');
      const optsList = Object.entries(order.changeOptions || {})
        .map(([k, v]) => `<li><strong>${k.replace('opt_', '')}:</strong> ${v}</li>`)
        .join('');

      return `
        <div style="font-family: 'Montserrat', sans-serif; color: #1e293b; padding: 24px; max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
            <div>
              <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a;">${atelier.name || 'PAPER MAX'}</h2>
              <div style="font-size: 11px; color: #64748b; line-height: 1.4;">
                ${atelier.owner ? `<span>${atelier.owner} · </span>` : ''}
                ${atelier.docNumber ? `<span>CNPJ/CPF: ${atelier.docNumber} · </span>` : ''}
                ${atelier.phone ? `<span>Tel: ${atelier.phone}</span>` : ''}
              </div>
              ${atelier.address ? `<div style="font-size: 11px; color: #64748b;">${atelier.address}</div>` : ''}
            </div>
            <div style="text-align: right;">
              <div style="background: #0f172a; color: #fff; padding: 4px 10px; font-size: 12px; font-weight: bold; border-radius: 4px; display: inline-block;">
                ${cfg.title || 'ORDEM DE SERVIÇO'}
              </div>
              <div style="font-size: 18px; font-weight: bold; margin-top: 4px; color: #0284c7;">
                ${order.number || order.id}
              </div>
              <div style="font-size: 11px; color: #64748b;">Emissão: ${formatDateBR(new Date().toISOString())}</div>
            </div>
          </div>

          <!-- DADOS DO CLIENTE & DATAS -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; padding: 12px; border-radius: 6px; margin-bottom: 16px; font-size: 12px;">
            <div>
              <div style="font-weight: 600; color: #475569; margin-bottom: 4px;">DADOS DO CLIENTE</div>
              <div><strong>Nome:</strong> ${order.customer || 'Cliente'}</div>
              ${order.customerPhone ? `<div><strong>Contato:</strong> ${order.customerPhone}</div>` : ''}
              ${order.customerEmail ? `<div><strong>E-mail:</strong> ${order.customerEmail}</div>` : ''}
            </div>
            <div>
              <div style="font-weight: 600; color: #475569; margin-bottom: 4px;">CRONOGRAMA OPERACIONAL</div>
              <div><strong>Data do Pedido:</strong> ${order.orderDate || '-'}</div>
              <div><strong>Data de Entrega:</strong> <span style="color: #dc2626; font-weight: bold;">${order.deliveryDate || '-'}</span></div>
              <div><strong>Status:</strong> ${order.statusLabel || 'Em produção'}</div>
            </div>
          </div>

          <!-- ESPECIFICAÇÕES DO PRODUTO -->
          <div style="margin-bottom: 16px;">
            <div style="font-size: 13px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px;">
              PRODUTO & QUANTIDADE
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background: #f1f5f9; text-align: left;">
                  <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">Item</th>
                  <th style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center; width: 80px;">Qtd</th>
                  <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">Especificações / Variações</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: 600;">${order.productTitle || 'Produto Personalizado'}</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; font-size: 14px; font-weight: bold; color: #0f172a;">${order.qty || 1} un</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0;">
                    ${optsList ? `<ul style="margin: 0; padding-left: 16px; font-size: 11px;">${optsList}</ul>` : 'Sem variações registradas'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- PERSONALIZAÇÃO -->
          ${persList ? `
            <div style="margin-bottom: 16px; background: #fff7ed; border: 1px solid #fed7aa; padding: 10px; border-radius: 6px;">
              <div style="font-size: 12px; font-weight: bold; color: #9a3412; margin-bottom: 4px;">CAMPOS DE PERSONALIZAÇÃO (ARTE & TEXTO):</div>
              <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #7c2d12;">${persList}</ul>
            </div>
          ` : ''}

          <!-- OBSERVAÇÕES -->
          ${order.notes ? `
            <div style="margin-bottom: 16px; font-size: 12px; border: 1px solid #e2e8f0; padding: 8px; border-radius: 6px;">
              <strong>Observações da Produção:</strong> ${order.notes}
            </div>
          ` : ''}

          <!-- LINHA DE ASSINATURA -->
          ${cfg.showSignatureLine !== false ? `
            <div style="margin-top: 32px; padding-top: 24px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 11px; color: #64748b;">
              <div style="text-align: center; width: 45%;">
                <div style="border-top: 1px solid #475569; margin-bottom: 4px;"></div>
                <span>${atelier.owner || 'Responsável Técnico / Produção'}</span>
              </div>
              <div style="text-align: center; width: 45%;">
                <div style="border-top: 1px solid #475569; margin-bottom: 4px;"></div>
                <span>${cfg.signatureText || 'Assinatura do Cliente / Retirada'}</span>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }

    case 'receipt': {
      const cfg = docConfigs.receipt || {};
      const width = cfg.format === '80mm' ? '300px' : '230px';
      const total = (order.qty || 1) * (product.price || 8.50);
      const paid = order.paidAmount || total;
      const remaining = Math.max(0, total - paid);

      return `
        <div style="font-family: 'Courier New', Courier, monospace; width: ${width}; margin: 0 auto; background: #fff; padding: 14px 10px; border: 1px solid #cbd5e1; color: #000; font-size: 11px; line-height: 1.3;">
          <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
            <div style="font-weight: bold; font-size: 13px;">${settings.printer?.customHeader || atelier.name || 'PAPER MAX ATELIÊ'}</div>
            ${atelier.owner ? `<div>${atelier.owner}</div>` : ''}
            ${atelier.docNumber ? `<div>CNPJ: ${atelier.docNumber}</div>` : ''}
            ${atelier.phone ? `<div>Tel/WhatsApp: ${atelier.phone}</div>` : ''}
            ${atelier.instagram ? `<div>Insta: ${atelier.instagram}</div>` : ''}
          </div>

          <div style="text-align: center; margin-bottom: 8px;">
            <div style="font-weight: bold;">*** COMPROVANTE NÃO FISCAL ***</div>
            <div>PEDIDO ${order.number || order.id}</div>
            <div>Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</div>
          </div>

          <div style="border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
            <div><strong>Cliente:</strong> ${order.customer || 'Consumidor'}</div>
            <div><strong>Entrega:</strong> ${order.deliveryDate || '-'}</div>
          </div>

          <div style="border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
            <div style="font-weight: bold;">ITEM / DESCRIÇÃO</div>
            <div style="display: flex; justify-content: space-between;">
              <span>${order.qty || 1}x ${order.productTitle || 'Produto'}</span>
              <span>R$ ${total.toFixed(2)}</span>
            </div>
            ${order.notes ? `<div style="font-size: 10px; color: #333;">Obs: ${order.notes}</div>` : ''}
          </div>

          <div style="border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
              <span>TOTAL DO PEDIDO:</span>
              <span>R$ ${total.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #166534;">
              <span>VALOR PAGO:</span>
              <span>R$ ${paid.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: ${remaining > 0 ? '#991b1b' : '#333'};">
              <span>SALDO A RECEBER:</span>
              <span>R$ ${remaining.toFixed(2)}</span>
            </div>
          </div>

          <div style="text-align: center; font-size: 10px; margin-top: 8px;">
            <div>${settings.printer?.customFooter || cfg.footerMessage || 'Obrigado pela preferência!'}</div>
            <div style="margin-top: 4px;">*** PAPER MAX v1.0 ***</div>
          </div>
        </div>
      `;
    }

    case 'productLabel': {
      const cfg = docConfigs.productLabel || {};
      return `
        <div style="font-family: 'Montserrat', sans-serif; width: 220px; height: 130px; border: 1px dashed #64748b; background: #fff; padding: 8px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            <div style="font-size: 10px; font-weight: 700; color: #0f172a; text-transform: uppercase;">
              ${atelier.name || 'PAPER MAX'}
            </div>
            <div style="font-size: 9px; font-weight: 600; color: #0284c7; background: #e0f2fe; padding: 1px 4px; border-radius: 2px;">
              ${order.number || '1048'}
            </div>
          </div>

          <div style="margin: 2px 0;">
            <div style="font-size: 11px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${product.name || order.productTitle || 'Sacola M Kraft'}
            </div>
            <div style="font-size: 10px; color: #475569;">
              Cliente: <strong>${order.customer || 'Juliana F.'}</strong>
            </div>
            <div style="font-size: 9px; color: #64748b;">
              Qtd: <strong>${order.qty || 1} un</strong> · Entrega: ${order.deliveryDate || '-'}
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; pt: 2px;">
            <div style="font-family: monospace; font-size: 8px; letter-spacing: 1px; color: #334155;">
              ||| | |||| || ||| |
            </div>
            <div style="font-size: 9px; font-weight: 700; color: #166534;">
              R$ ${(product.price || 8.50).toFixed(2)}
            </div>
          </div>
        </div>
      `;
    }

    case 'materialLabel': {
      const cfg = docConfigs.materialLabel || {};
      return `
        <div style="font-family: 'Montserrat', sans-serif; width: 220px; height: 130px; border: 1px dashed #475569; background: #fff; padding: 8px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">
              CONTROLE DE INSUMO
            </div>
            <div style="font-size: 9px; font-weight: 600; color: #475569; background: #f1f5f9; padding: 1px 4px; border-radius: 2px;">
              ${material.id || 'MAT-101'}
            </div>
          </div>

          <div style="margin: 2px 0;">
            <div style="font-size: 11px; font-weight: 700; color: #0f172a; line-height: 1.2;">
              ${material.name || 'Papel Kraft 180g A4'}
            </div>
            <div style="font-size: 9px; color: #475569; margin-top: 2px;">
              Estoque: <strong>${material.currentStock || 0} ${material.baseUnit || 'un'}</strong> (Mín: ${material.minStock || 0})
            </div>
            <div style="font-size: 9px; color: #64748b;">
              Local: <strong>${cfg.defaultLocation || 'Armário 02 · Gaveta 04'}</strong>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 2px;">
            <div style="font-family: monospace; font-size: 8px; letter-spacing: 1px; color: #334155;">
              || ||| | ||| |||| |
            </div>
            <div style="font-size: 8px; color: #64748b;">
              ${material.supplierName ? material.supplierName.slice(0, 15) : 'Fornecedor Padrão'}
            </div>
          </div>
        </div>
      `;
    }

    default:
      return `<div style="padding: 16px; font-family: sans-serif;">Modelo de documento não localizado.</div>`;
  }
}

// ==========================================
// 5. REAL-TIME ALERTS ENGINE
// ==========================================

export function getAlertsConfig() {
  return loadAlertsConfig();
}

export function updateAlertRule(alertId, updates) {
  const configs = loadAlertsConfig();
  const index = configs.findIndex(a => a.id === alertId);
  if (index === -1) return null;

  configs[index] = { ...configs[index], ...updates };
  saveAlertsConfig(configs, true);
  bus.emit('alerts:config_updated', configs[index]);

  recordAuditLog({
    module: 'Alertas',
    action: 'Regra de Alerta',
    target: configs[index].name,
    user: 'Operador',
    operation: `Regra de alerta "${configs[index].name}" atualizada (Ativo: ${configs[index].active}).`
  });

  return configs[index];
}

/**
 * Computes live active alerts by analyzing real orders, inventory, print queue and payments
 */
export function evaluateSystemAlerts() {
  const rules = loadAlertsConfig();
  const orders = loadOrders();
  const materials = loadMaterials();
  const queue = loadPrintQueue();

  const activeAlerts = [];
  const now = new Date();

  for (const rule of rules) {
    if (!rule.active) continue;

    switch (rule.type) {
      case 'stock_min': {
        const belowMin = materials.filter(m => Number(m.currentStock || 0) <= Number(m.minStock || 0));
        if (belowMin.length > 0) {
          activeAlerts.push({
            ruleId: rule.id,
            title: rule.name,
            type: rule.type,
            priority: rule.priority,
            count: belowMin.length,
            message: `${belowMin.length} insumo(s) com estoque igual ou abaixo do mínimo.`,
            items: belowMin.map(m => ({
              id: m.id,
              name: m.name,
              stock: `${m.currentStock} / ${m.minStock} ${m.baseUnit}`,
              targetView: 'estoque'
            }))
          });
        }
        break;
      }

      case 'delivery_near': {
        const daysAdv = rule.daysAdvance || 2;
        const urgent = orders.filter(o => {
          if (!o.deliveryDate) return false;
          const s = (o.status || '').toLowerCase();
          if (s === 'green' || s === 'neutral' || s === 'pronto' || s === 'entregue' || s === 'cancelado') return false;

          const parts = o.deliveryDate.split('/');
          if (parts.length === 3) {
            const delDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            const diffDays = Math.ceil((delDate - now) / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= daysAdv;
          }
          return false;
        });

        if (urgent.length > 0) {
          activeAlerts.push({
            ruleId: rule.id,
            title: rule.name,
            type: rule.type,
            priority: rule.priority,
            count: urgent.length,
            message: `${urgent.length} pedido(s) com entrega prevista nos próximos ${daysAdv} dias.`,
            items: urgent.map(o => ({
              id: o.id,
              name: `Pedido ${o.number || o.id} - ${o.customer}`,
              detail: `Entrega: ${o.deliveryDate}`,
              targetView: 'pedidos'
            }))
          });
        }
        break;
      }

      case 'delivery_overdue': {
        const overdue = orders.filter(o => {
          if (!o.deliveryDate) return false;
          const s = (o.status || '').toLowerCase();
          if (s === 'green' || s === 'neutral' || s === 'pronto' || s === 'entregue' || s === 'cancelado') return false;

          const parts = o.deliveryDate.split('/');
          if (parts.length === 3) {
            const delDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            const diffDays = Math.floor((delDate - now) / (1000 * 60 * 60 * 24));
            return diffDays < 0;
          }
          return false;
        });

        if (overdue.length > 0) {
          activeAlerts.push({
            ruleId: rule.id,
            title: rule.name,
            type: rule.type,
            priority: rule.priority,
            count: overdue.length,
            message: `${overdue.length} pedido(s) com data de entrega vencida!`,
            items: overdue.map(o => ({
              id: o.id,
              name: `Pedido ${o.number || o.id} - ${o.customer}`,
              detail: `Venceu em: ${o.deliveryDate}`,
              targetView: 'pedidos'
            }))
          });
        }
        break;
      }

      case 'print_pending': {
        const pendingQueue = queue.filter(q => {
          const s = (q.status || '').toLowerCase();
          return s === 'aguardando' || s === 'em processamento';
        });

        if (pendingQueue.length > 0) {
          activeAlerts.push({
            ruleId: rule.id,
            title: rule.name,
            type: rule.type,
            priority: rule.priority,
            count: pendingQueue.length,
            message: `${pendingQueue.length} documento(s) aguardando emissão na fila de impressão.`,
            items: pendingQueue.map(q => ({
              id: q.id,
              name: `${q.documentType} - ${q.orderNumber}`,
              detail: `Qtd: ${q.qty} · ${q.format}`,
              targetView: 'ajustes'
            }))
          });
        }
        break;
      }

      case 'production_block': {
        const blocked = orders.filter(o => {
          const s = (o.status || '').toLowerCase();
          return s === 'red' || s === 'bloqueado' || (o.production && o.production.stageStatus === 'bloqueado');
        });

        if (blocked.length > 0) {
          activeAlerts.push({
            ruleId: rule.id,
            title: rule.name,
            type: rule.type,
            priority: rule.priority,
            count: blocked.length,
            message: `${blocked.length} pedido(s) bloqueados na produção.`,
            items: blocked.map(o => ({
              id: o.id,
              name: `Pedido ${o.number || o.id} - ${o.customer}`,
              detail: o.notes || 'Aguardando material ou aprovação',
              targetView: 'producao'
            }))
          });
        }
        break;
      }

      case 'payment_pending': {
        const pendingPay = orders.filter(o => {
          const s = (o.status || '').toLowerCase();
          if (s === 'cancelado') return false;
          const total = (o.qty || 1) * (o.productSnapshot?.price || 10);
          const paid = o.paidAmount || 0;
          return total > paid && (s === 'blue' || s === 'green' || s === 'neutral' || s === 'entregue');
        });

        if (pendingPay.length > 0) {
          activeAlerts.push({
            ruleId: rule.id,
            title: rule.name,
            type: rule.type,
            priority: rule.priority,
            count: pendingPay.length,
            message: `${pendingPay.length} pedido(s) em produção ou entregues com saldo a receber.`,
            items: pendingPay.map(o => ({
              id: o.id,
              name: `Pedido ${o.number || o.id} - ${o.customer}`,
              detail: `Pago: R$ ${(o.paidAmount || 0).toFixed(2)}`,
              targetView: 'pedidos'
            }))
          });
        }
        break;
      }
    }
  }

  return activeAlerts;
}

// ==========================================
// 6. BACKUP & SYSTEM DATA STATS
// ==========================================

export function getSystemDataStats() {
  const storage = getLocalStorage();
  let totalBytes = 0;

  if (storage) {
    for (const key of Object.values(STORAGE_KEYS)) {
      const val = storage.getItem(key);
      if (val) totalBytes += val.length * 2; // Approx UTF-16 bytes
    }
  }

  return {
    ordersCount: loadOrders().length,
    productsCount: loadProducts().length,
    materialsCount: loadMaterials().length,
    componentsCount: loadComponents().length,
    suppliersCount: loadSuppliers().length,
    purchasesCount: loadPurchases().length,
    movementsCount: loadMovements().length,
    expensesCount: loadExpenses().length,
    receivablesCount: loadReceivables().length,
    payablesCount: loadPayables().length,
    printQueueCount: loadPrintQueue().length,
    auditLogsCount: loadAuditLogs().length,
    estimatedStorageKB: (totalBytes / 1024).toFixed(1),
    lastBackup: getLastBackupTimestamp(),
    systemVersion: 'PAPER MAX v1.0'
  };
}

export { exportBackup, restoreBackup };
