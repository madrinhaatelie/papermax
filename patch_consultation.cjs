const fs = require('fs');
const file = fs.readFileSync('src/modules/orders/orders.ui.js', 'utf8');

const startIndex = file.indexOf('export function showOrderConsultationDrawer(');
if (startIndex === -1) throw new Error("Could not find showOrderConsultationDrawer");

const nextExportIndex = file.indexOf('export function generateOrderPdf(', startIndex);
const before = file.substring(0, startIndex);
const after = nextExportIndex === -1 ? '' : file.substring(nextExportIndex);

// Define the updated function
const newFunction = `export function showOrderConsultationDrawer(orderId, ctx) {
  const { openDrawer, closeDrawer, showToast, switchView } = ctx;
  const order = getOrderById(orderId);
  if (!order) {
    showToast('Pedido não encontrado', '⚠');
    return;
  }

  const neon = getOrderStatusNeonMeta(order);
  const fin = getOrderFinancials(order);
  const orderNum = formatOrderNumber(order.number || order.id);

  const items = (order.items && order.items.length > 0) ? order.items : [{
    productTitle: order.productTitle,
    qty: order.qty,
    personalization: order.personalization || {},
    changeOptions: order.changeOptions || {},
    productSnapshot: order.productSnapshot || {}
  }];

  const contentHtml = \`
    <!-- Top Summary Badge Bar -->
    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 14px 18px; margin-bottom: 16px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-family: monospace; font-size: 16px; font-weight: 700; color: var(--accent-primary);">
            #\${orderNum}
          </span>
          <span class="status-pill" style="border-left: 4px solid \${neon.color}; font-size: 12px; padding: 4px 10px;">
            \${escapeHtml(neon.label)}
          </span>
        </div>
        <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-top: 4px;">
          \${escapeHtml(order.title || order.productTitle || 'Vários Itens')}
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11px; color: var(--text-secondary);">Data do Pedido: <b>\${order.orderDate || '--/--/----'}</b></div>
        <div style="font-size: 12px; color: var(--text-primary); margin-top: 2px;">
          Entrega Prevista: <b style="color: #0284c7;">\${order.deliveryDate || '--/--/----'}</b>
        </div>
      </div>
    </div>

    <!-- Production Stage Timeline Stepper -->
    \${renderTimelineStepperHtml(order)}

    <!-- Production Operations Action Box (Apontamento & CQ) -->
    \${renderProductionOpsBoxHtml(order)}

    <!-- 2-Column Grid: Dados do Cliente & Condições Financeiras -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
      
      <!-- Dados do Cliente -->
      <div class="drawer-detail-section" style="margin: 0; padding: 14px; background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 10px;">
        <h4 class="drawer-subtitle" style="margin-top: 0; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
          👤 Dados do Cliente / Entrega
        </h4>
        <div class="detail-grid" style="display: flex; flex-direction: column; gap: 8px;">
          <div class="detail-item">
            <span class="detail-label" style="font-size: 11px; color: var(--text-secondary);">Cliente:</span>
            <span class="detail-val" style="font-size: 13px; font-weight: 600;">\${escapeHtml(order.customerType === 'PJ' ? (order.customerCompany || order.customer) : order.customer || '—')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label" style="font-size: 11px; color: var(--text-secondary);">Contato:</span>
            <span class="detail-val">\${escapeHtml(order.customerPhone || '—')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label" style="font-size: 11px; color: var(--text-secondary);">Endereço Entrega:</span>
            <span class="detail-val">\${escapeHtml(order.deliveryAddress ? order.deliveryAddress + ', ' + order.deliveryNumber : '—')}</span>
          </div>
        </div>
      </div>

      <!-- Resumo Financeiro -->
      <div class="drawer-detail-section" style="margin: 0; padding: 14px; background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 10px;">
        <h4 class="drawer-subtitle" style="margin-top: 0; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
          💳 Resumo Financeiro
        </h4>
        <div class="detail-grid" style="display: flex; flex-direction: column; gap: 8px;">
          <div class="detail-item" style="display: flex; justify-content: space-between;">
            <span class="detail-label" style="font-size: 11px; color: var(--text-secondary);">Valor Total:</span>
            <span class="detail-val" style="font-size: 14px; font-weight: 700;">R$ \${fin.totalAmount.toFixed(2)}</span>
          </div>
          <div class="detail-item" style="display: flex; justify-content: space-between;">
            <span class="detail-label" style="font-size: 11px; color: var(--text-secondary);">Valor Pago / Entrada:</span>
            <span class="detail-val" style="color: #16a34a; font-weight: 600;">R$ \${fin.paidAmount.toFixed(2)}</span>
          </div>
          <div class="detail-item" style="display: flex; justify-content: space-between;">
            <span class="detail-label" style="font-size: 11px; color: var(--text-secondary);">Restante a Pagar:</span>
            <span class="detail-val" style="color: \${fin.remainingAmount > 0 ? '#ea580c' : '#16a34a'}; font-weight: 700;">
              R$ \${fin.remainingAmount.toFixed(2)}
            </span>
          </div>
          <div class="detail-item" style="display: flex; justify-content: space-between;">
            <span class="detail-label" style="font-size: 11px; color: var(--text-secondary);">Forma de Pagamento:</span>
            <span class="detail-val">\${escapeHtml(fin.paymentMethod || (order.financial?.paymentMethods?.[0]?.method || '—'))}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Lista de Itens e Personalização -->
    <div style="margin-bottom: 16px;">
      <h4 class="drawer-subtitle" style="margin-top: 0; margin-bottom: 10px;">🛒 Itens e Personalização</h4>
      \${items.map(item => {
        const snap = item.productSnapshot || {};
        const pFields = snap.personalizationFields || [];
        const cOpts = snap.changeOptions || [];
        const pValues = item.personalization || {};
        const cValues = item.changeOptions || {};
        
        let customHtml = '';
        if (pFields.length > 0) {
          customHtml += '<div style="margin-top: 8px;"><div style="font-size: 11px; font-weight: 700; color: var(--text-secondary);">Campos:</div>';
          customHtml += pFields.map(f => \`<div style="font-size: 12px; margin-left: 8px;"><span style="color: var(--text-secondary);">\${escapeHtml(f.name)}:</span> <b>\${escapeHtml(pValues[f.id] || '—')}</b></div>\`).join('');
          customHtml += '</div>';
        }
        if (cOpts.length > 0) {
          customHtml += '<div style="margin-top: 8px;"><div style="font-size: 11px; font-weight: 700; color: var(--text-secondary);">Opções:</div>';
          customHtml += cOpts.map(o => \`<div style="font-size: 12px; margin-left: 8px;"><span style="color: var(--text-secondary);">\${escapeHtml(o.name)}:</span> <b>\${escapeHtml(cValues[o.id] || '—')}</b></div>\`).join('');
          customHtml += '</div>';
        }

        return \`
          <div style="background: #fff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 13px; margin-bottom: 4px;">
              <span>\${item.qty}x \${escapeHtml(item.productTitle)}</span>
              <span>R$ \${(Number(item.unitPrice || 0) * item.qty).toFixed(2)}</span>
            </div>
            \${customHtml}
            \${item.notes ? \`<div style="margin-top: 8px; font-size: 12px;"><span style="color: var(--text-secondary);">Obs:</span> \${escapeHtml(item.notes)}</div>\` : ''}
          </div>
        \`;
      }).join('')}
    </div>

    <!-- Notas Internas -->
    \${order.notes ? \`
      <div class="drawer-detail-section" style="margin: 0; padding: 14px; background: #fffcf8; border: 1px dashed #fcd34d; border-radius: 10px; margin-bottom: 16px;">
        <h4 class="drawer-subtitle" style="margin-top: 0; margin-bottom: 6px; color: #b45309;">📝 Observações Internas (Pedido)</h4>
        <div style="font-size: 13px; color: #92400e; white-space: pre-wrap;">\${escapeHtml(order.notes)}</div>
      </div>
    \` : ''}
  \`;

  openDrawer(\`Consulta: Pedido #\${orderNum}\`, contentHtml, (drawer, close) => {
    // Apontamentos events
    setupProductionOpsEvents(drawer, order, ctx);
  }, 'drawer-large');
}
`;

fs.writeFileSync('src/modules/orders/orders.ui.js', before + newFunction + after);
console.log('Successfully patched showOrderConsultationDrawer');
