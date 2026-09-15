const fs = require('fs');
const file = fs.readFileSync('src/modules/orders/orders.ui.js', 'utf8');

const startIndex = file.indexOf('export function renderNewOrderPage(');
if (startIndex === -1) throw new Error("Could not find renderNewOrderPage");

// Find the end of the function by looking for the next top-level export
const nextExportIndex = file.indexOf('export function showOrderConsultationDrawer(', startIndex);
if (nextExportIndex === -1) throw new Error("Could not find next export");

const before = file.substring(0, startIndex);
const after = file.substring(nextExportIndex);

const newFunction = `export function renderNewOrderPage(container, ctx) {
  if (!container) return;
  const { switchView, showToast, openDrawer, closeDrawer } = ctx;

  const products = loadProducts().filter(p => p.status === 'ativo');
  const allMaterials = loadMaterials();
  const allComponents = loadComponents();

  // Local state
  let orderData = {
    customerType: 'PF', // PF | PJ
    customer: '',
    customerPhone: '',
    customerBirthDate: '',
    customerCPF: '',
    customerCNPJ: '',
    customerCompany: '',
    
    deliveryCep: '',
    deliveryAddress: '',
    deliveryNumber: '',
    deliveryNeighborhood: '',
    deliveryCity: '',
    deliveryState: '',
    deliveryNotes: '',

    eventDate: '',
    limitDate: '',

    items: [],
    
    discount: 0,
    paymentMethods: [{ method: 'PIX', amount: 0 }],
    
    notes: ''
  };

  // Helper to calculate BOM for all items
  function calculateTotalBOM() {
    let totalCost = 0;
    const allBOM = [];

    for (const item of orderData.items) {
      if (!item.productSnapshot || !Array.isArray(item.productSnapshot.composition)) continue;
      
      for (const comp of item.productSnapshot.composition) {
        let name = 'Item';
        let unitCost = 0;
        let unit = comp.unit || 'un';

        if (comp.type === 'componente') {
          const c = allComponents.find(x => x.id === comp.itemId);
          name = c ? c.name : comp.itemId;
          unitCost = c ? (c.cost || 0) : 0;
        } else {
          const m = allMaterials.find(x => x.id === comp.itemId);
          name = m ? m.name : comp.itemId;
          unitCost = m ? (m.purchaseCost / (m.packQuantity || 1)) : 0;
        }
        
        const totalQty = (comp.quantity || 1) * item.qty;
        const subtotal = totalQty * unitCost;
        totalCost += subtotal;
        
        // Group similar materials
        const existing = allBOM.find(b => b.name === name && b.unit === unit);
        if (existing) {
          existing.totalQty += totalQty;
          existing.subtotal += subtotal;
        } else {
          allBOM.push({ name, type: comp.type, totalQty, unit, unitCost, subtotal });
        }
      }
    }
    
    return { items: allBOM, totalCost };
  }

  function getCalculatedTotal() {
    const subtotal = orderData.items.reduce((sum, it) => sum + (it.unitPrice * it.qty), 0);
    return Math.max(0, subtotal - orderData.discount);
  }

  function render() {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Auto calculate limit date (3 days before event)
    let autoLimitDate = '';
    if (orderData.eventDate) {
      const d = new Date(orderData.eventDate + 'T12:00:00');
      d.setDate(d.getDate() - 3);
      autoLimitDate = d.toISOString().split('T')[0];
      orderData.limitDate = autoLimitDate;
    }

    const html = \`
      <div style="max-width: 100%; margin: 0 auto; padding-bottom: 32px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">📝 Novo Pedido</h2>
            <div style="font-size: 0.875rem; color: var(--text-secondary);">Cadastre um novo pedido com múltiplos produtos e personalizações</div>
          </div>
          <button class="btn btn-secondary" id="btn-cancel-order">Voltar</button>
        </div>

        <form id="form-new-order-page" style="display: flex; flex-direction: column; gap: 0;">
          <div class="binder-tabs" id="new-order-tabs">
            <button type="button" class="binder-tab active" data-target="section-cliente">1. Dados do Cliente & Entrega</button>
            <button type="button" class="binder-tab" data-target="section-produto">2. Produtos & Personalização</button>
            <button type="button" class="binder-tab" data-target="section-insumos">3. Ficha Técnica</button>
            <button type="button" class="binder-tab" data-target="section-financeiro">4. Financeiro & Conclusão</button>
          </div>

          <!-- TAB 1: CLIENTE E ENTREGA -->
          <div class="binder-panel active" id="section-cliente" style="margin-top: 0;">
            <div class="panel">
              <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 14px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">👤 Perfil do Cliente</h3>
              
              <div style="display: flex; gap: 16px; margin-bottom: 14px;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 14px;">
                  <input type="radio" name="customerType" value="PF" \${orderData.customerType === 'PF' ? 'checked' : ''}> Pessoa Física (PF)
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 14px;">
                  <input type="radio" name="customerType" value="PJ" \${orderData.customerType === 'PJ' ? 'checked' : ''}> Pessoa Jurídica (PJ)
                </label>
              </div>

              \${orderData.customerType === 'PF' ? \`
                <!-- PF Fields -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                  <div>
                    <label class="form-label">Nome *</label>
                    <input class="form-input" id="inp-cli-nome" required value="\${orderData.customer}">
                  </div>
                  <div>
                    <label class="form-label">Contato (WhatsApp)</label>
                    <input class="form-input" id="inp-cli-contato" value="\${orderData.customerPhone}">
                  </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                  <div>
                    <label class="form-label">Data de Nascimento</label>
                    <input type="date" class="form-input" id="inp-cli-nasc" value="\${orderData.customerBirthDate}">
                  </div>
                  <div>
                    <label class="form-label">CPF</label>
                    <input class="form-input" id="inp-cli-cpf" value="\${orderData.customerCPF}">
                  </div>
                </div>
              \` : \`
                <!-- PJ Fields -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                  <div>
                    <label class="form-label">Empresa *</label>
                    <input class="form-input" id="inp-cli-empresa" required value="\${orderData.customerCompany}">
                  </div>
                  <div>
                    <label class="form-label">Contato (WhatsApp)</label>
                    <input class="form-input" id="inp-cli-contato" value="\${orderData.customerPhone}">
                  </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                  <div>
                    <label class="form-label">CNPJ</label>
                    <input class="form-input" id="inp-cli-cnpj" value="\${orderData.customerCNPJ}">
                  </div>
                  <div></div>
                </div>
              \`}

              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px; background: var(--bg-surface-raised); padding: 10px; border-radius: 8px;">
                <div>
                  <label class="form-label">Data do Pedido</label>
                  <input type="date" class="form-input" value="\${todayStr}" disabled style="background: #e5e7eb; cursor: not-allowed;">
                </div>
                <div>
                  <label class="form-label">Data do Evento</label>
                  <input type="date" class="form-input" id="inp-cli-evento" value="\${orderData.eventDate}">
                </div>
                <div>
                  <label class="form-label">Data Limite (Auto: -3 dias)</label>
                  <input type="date" class="form-input" value="\${orderData.limitDate}" disabled style="background: #e5e7eb; cursor: not-allowed;">
                </div>
              </div>

              <div>
                <label class="form-label">Observações Internas (Cliente)</label>
                <textarea class="form-input" id="inp-cli-obs" rows="2">\${orderData.notes}</textarea>
              </div>
            </div>

            <div class="panel" style="margin-top: 16px;">
              <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 14px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">🚚 Entrega</h3>
              
              <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px; margin-bottom: 12px;">
                <div>
                  <label class="form-label">CEP</label>
                  <div style="display: flex; gap: 6px;">
                    <input class="form-input" id="inp-ent-cep" value="\${orderData.deliveryCep}" placeholder="00000-000">
                    <button type="button" class="btn btn-secondary" id="btn-busca-cep" style="padding: 0 10px;">🔍</button>
                  </div>
                </div>
                <div>
                  <label class="form-label">Endereço</label>
                  <input class="form-input" id="inp-ent-endereco" value="\${orderData.deliveryAddress}">
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 12px; margin-bottom: 12px;">
                <div>
                  <label class="form-label">Número</label>
                  <input class="form-input" id="inp-ent-numero" value="\${orderData.deliveryNumber}">
                </div>
                <div>
                  <label class="form-label">Bairro</label>
                  <input class="form-input" id="inp-ent-bairro" value="\${orderData.deliveryNeighborhood}">
                </div>
                <div>
                  <label class="form-label">Cidade / Estado</label>
                  <div style="display: flex; gap: 6px;">
                    <input class="form-input" id="inp-ent-cidade" value="\${orderData.deliveryCity}" style="flex: 2;">
                    <input class="form-input" id="inp-ent-estado" value="\${orderData.deliveryState}" style="flex: 1;" placeholder="UF">
                  </div>
                </div>
              </div>
              
              <div>
                <label class="form-label">Observações de Entrega</label>
                <textarea class="form-input" id="inp-ent-obs" rows="2">\${orderData.deliveryNotes}</textarea>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
              <button type="button" class="btn btn-primary btn-next-tab" data-next="section-produto">Próximo Passo ➔</button>
            </div>
          </div>

          <!-- TAB 2: PRODUTOS E PERSONALIZAÇÃO -->
          <div class="binder-panel" id="section-produto" style="margin-top: 0; display: none;">
            <div class="panel" style="background: var(--bg-surface-raised);">
              <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 14px;">🛍️ Adicionar Produto</h3>
              <div style="display: grid; grid-template-columns: 3fr 1fr auto; gap: 12px; align-items: end;">
                <div>
                  <label class="form-label">Seleção do Produto</label>
                  <select class="form-input" id="inp-prod-select">
                    \${products.map(p => \`<option value="\${p.id}">\${p.name} - R$ \${Number(p.price || 0).toFixed(2)}</option>\`).join('')}
                  </select>
                </div>
                <div>
                  <label class="form-label">Quantidade</label>
                  <input type="number" class="form-input" id="inp-prod-qty" value="1" min="1">
                </div>
                <button type="button" class="btn btn-primary" id="btn-add-product" style="margin-bottom: 2px;">+ Inserir</button>
              </div>
            </div>

            <div class="panel" style="margin-top: 16px;">
              <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 14px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">🛒 Listagem de Produtos & Personalização</h3>
              
              <div id="order-items-list" style="display: flex; flex-direction: column; gap: 16px;">
                \${orderData.items.length === 0 ? 
                  '<div style="text-align: center; padding: 24px; color: var(--text-secondary); font-size: 14px;">Nenhum produto adicionado ainda.</div>' 
                  : orderData.items.map((item, index) => {
                    
                    // Render personalizations fields based on productSnapshot
                    const prod = item.productSnapshot;
                    let persHtml = '';
                    
                    if (Array.isArray(prod.personalizationFields) && prod.personalizationFields.length > 0) {
                      persHtml += '<div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-subtle);">';
                      persHtml += '<div style="font-size: 11px; font-weight: 700; color: var(--accent-primary); margin-bottom: 8px; text-transform: uppercase;">Campos Dinâmicos de Personalização</div>';
                      persHtml += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">';
                      prod.personalizationFields.forEach(field => {
                        const val = item.personalization[field.id] || '';
                        const req = field.required ? ' *' : '';
                        persHtml += \`
                          <div>
                            <label class="form-label" style="font-size: 11px;">\${field.name}\${req}</label>
                            \${field.type === 'longText' 
                              ? \`<textarea class="form-input item-pers-field" data-index="\${index}" data-field="\${field.id}" rows="2" style="font-size: 12px;">\${val}</textarea>\`
                              : \`<input class="form-input item-pers-field" data-index="\${index}" data-field="\${field.id}" value="\${val}" style="font-size: 12px;">\`
                            }
                          </div>
                        \`;
                      });
                      persHtml += '</div></div>';
                    }

                    if (Array.isArray(prod.changeOptions) && prod.changeOptions.length > 0) {
                      persHtml += '<div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-subtle);">';
                      persHtml += '<div style="font-size: 11px; font-weight: 700; color: var(--accent-primary); margin-bottom: 8px; text-transform: uppercase;">Opções de Alteração</div>';
                      persHtml += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">';
                      prod.changeOptions.forEach(opt => {
                        const val = item.changeOptions[opt.id] || '';
                        const req = opt.required ? ' *' : '';
                        persHtml += \`
                          <div>
                            <label class="form-label" style="font-size: 11px;">\${opt.name}\${req}</label>
                            <select class="form-input item-opt-field" data-index="\${index}" data-field="\${opt.id}" style="font-size: 12px;">
                              <option value="">Selecione...</option>
                              \${opt.options.map(o => \`<option value="\${o}" \${val === o ? 'selected' : ''}>\${o}</option>\`).join('')}
                            </select>
                          </div>
                        \`;
                      });
                      persHtml += '</div></div>';
                    }

                    return \`
                      <div style="border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px; background: #fff;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                          <div style="flex: 1;">
                            <div style="font-weight: 700; font-size: 14px;">\${item.qty}x \${item.productTitle}</div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">Preço Un: R$ \${Number(item.unitPrice).toFixed(2)} | Subtotal: R$ \${Number(item.qty * item.unitPrice).toFixed(2)}</div>
                          </div>
                          <button type="button" class="btn btn-secondary btn-remove-item" data-index="\${index}" style="padding: 4px 8px; font-size: 11px; color: #dc2626; border-color: #fca5a5;">Remover</button>
                        </div>
                        \${persHtml}
                        <div style="margin-top: 10px;">
                          <label class="form-label" style="font-size: 11px;">Observações Específicas do Item (Instruções de produção)</label>
                          <textarea class="form-input item-notes-field" data-index="\${index}" rows="2" style="font-size: 12px;">\${item.notes}</textarea>
                        </div>
                      </div>
                    \`;
                  }).join('')
                }
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 16px;">
              <button type="button" class="btn btn-secondary btn-prev-tab" data-prev="section-cliente">⬅ Voltar</button>
              <button type="button" class="btn btn-primary btn-next-tab" data-next="section-insumos">Próximo Passo ➔</button>
            </div>
          </div>

          <!-- TAB 3: FICHA TÉCNICA E BOM SNAPSHOT -->
          <div class="binder-panel" id="section-insumos" style="margin-top: 0; display: none;">
            <div class="panel">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <h3 style="font-size: 1rem; font-weight: 700;">🧩 Insumos / Estoque (BOM Snapshot)</h3>
              </div>
              <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">
                O sistema calcula automaticamente todos os materiais que serão gastos com base nos produtos escolhidos e quantidades. 
                Os custos ficam "congelados" nesta cópia (snapshot) para não sofrerem impacto caso os preços mudem futuramente.
              </p>

              <div style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 8px; overflow: hidden;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <thead>
                    <tr style="background: rgba(0,0,0,0.02); text-align: left; border-bottom: 1px solid var(--border-subtle);">
                      <th style="padding: 10px 12px; font-weight: 600;">Insumo / Componente</th>
                      <th style="padding: 10px 12px; font-weight: 600; text-align: center;">Qtd Necessária</th>
                      <th style="padding: 10px 12px; font-weight: 600; text-align: right;">Custo Est.</th>
                    </tr>
                  </thead>
                  <tbody>
                    \${(() => {
                      const bom = calculateTotalBOM();
                      if (bom.items.length === 0) return '<tr><td colspan="3" style="padding: 16px; text-align: center; color: var(--text-secondary);">Nenhum insumo configurado nos produtos selecionados.</td></tr>';
                      return bom.items.map(b => \`
                        <tr style="border-bottom: 1px solid var(--border-subtle);">
                          <td style="padding: 10px 12px;">\${b.name} <span style="font-size: 10px; color: var(--text-secondary); padding: 2px 4px; background: #e5e7eb; border-radius: 4px; margin-left: 6px;">\${b.type}</span></td>
                          <td style="padding: 10px 12px; text-align: center; font-variant-numeric: tabular-nums;">\${b.totalQty} \${b.unit}</td>
                          <td style="padding: 10px 12px; text-align: right; color: var(--accent-primary); font-weight: 500;">R$ \${b.subtotal.toFixed(2)}</td>
                        </tr>
                      \`).join('') + \`
                        <tr style="background: rgba(219, 39, 119, 0.05);">
                          <td colspan="2" style="padding: 12px; font-weight: 700; text-align: right; color: var(--text-primary);">Custo de Material Previsto:</td>
                          <td style="padding: 12px; font-weight: 700; text-align: right; color: var(--accent-primary);">R$ \${bom.totalCost.toFixed(2)}</td>
                        </tr>
                      \`;
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 16px;">
              <button type="button" class="btn btn-secondary btn-prev-tab" data-prev="section-produto">⬅ Voltar</button>
              <button type="button" class="btn btn-primary btn-next-tab" data-next="section-financeiro">Próximo Passo ➔</button>
            </div>
          </div>

          <!-- TAB 4: FINANCEIRO & NOTA FISCAL -->
          <div class="binder-panel" id="section-financeiro" style="margin-top: 0; display: none;">
            <div class="panel" style="background: #fff; border: 1px solid var(--border-subtle); box-shadow: 0 4px 12px rgba(0,0,0,0.03);" id="invoice-printable-area">
              
              <!-- Cabeçalho NF -->
              <div style="text-align: center; border-bottom: 2px dashed var(--border-subtle); padding-bottom: 16px; margin-bottom: 16px;">
                <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); text-transform: uppercase; letter-spacing: 1px;">RESUMO DO PEDIDO</h2>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Ateliê Paper Max · Emissão: \${todayStr.split('-').reverse().join('/')}</div>
              </div>

              <!-- Cliente NF -->
              <div style="margin-bottom: 16px; font-size: 13px;">
                <div style="font-weight: 700; margin-bottom: 4px; color: var(--text-primary);">DADOS DO CLIENTE</div>
                <div><strong>Nome/Razão:</strong> \${orderData.customerType === 'PJ' ? (orderData.customerCompany || orderData.customer) : orderData.customer}</div>
                <div><strong>Documento:</strong> \${orderData.customerType === 'PJ' ? orderData.customerCNPJ : orderData.customerCPF}</div>
                <div><strong>Contato:</strong> \${orderData.customerPhone}</div>
              </div>

              <!-- Itens NF -->
              <div style="margin-bottom: 16px;">
                <div style="font-weight: 700; margin-bottom: 8px; color: var(--text-primary); font-size: 13px;">INFORMAÇÕES INDIVIDUAIS (ITENS)</div>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                  <thead>
                    <tr style="border-bottom: 1px solid var(--border-subtle); text-align: left;">
                      <th style="padding: 6px 0;">Qtd</th>
                      <th style="padding: 6px 0;">Produto / Descrição</th>
                      <th style="padding: 6px 0; text-align: right;">V. Unit</th>
                      <th style="padding: 6px 0; text-align: right;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    \${orderData.items.map(item => \`
                      <tr style="border-bottom: 1px solid #f3f4f6;">
                        <td style="padding: 8px 0; font-weight: 600;">\${item.qty}x</td>
                        <td style="padding: 8px 0;">
                          \${item.productTitle}
                          \${item.notes ? \`<div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">Obs: \${item.notes}</div>\` : ''}
                        </td>
                        <td style="padding: 8px 0; text-align: right;">R$ \${Number(item.unitPrice).toFixed(2)}</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: 600;">R$ \${(item.unitPrice * item.qty).toFixed(2)}</td>
                      </tr>
                    \`).join('')}
                  </tbody>
                </table>
              </div>

              <!-- Totais NF -->
              <div style="border-top: 2px dashed var(--border-subtle); padding-top: 16px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                  <span>Subtotal:</span>
                  <span>R$ \${orderData.items.reduce((sum, it) => sum + (it.unitPrice * it.qty), 0).toFixed(2)}</span>
                </div>
                
                <!-- Campos Interativos (Não impressos na NF final visual, mas controlam o estado) -->
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; margin-bottom: 4px; padding: 4px 0;" class="no-print-interactive">
                  <span>Desconto (R$):</span>
                  <input type="number" step="0.01" min="0" class="form-input" id="inp-fin-discount" value="\${orderData.discount}" style="width: 100px; text-align: right; padding: 4px 8px; font-size: 12px;">
                </div>
                
                <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; margin-top: 8px; color: var(--accent-primary);">
                  <span>VALOR TOTAL:</span>
                  <span>R$ \${getCalculatedTotal().toFixed(2)}</span>
                </div>
              </div>

              <!-- Pagamentos -->
              <div style="background: #f9fafb; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb;">
                <div style="font-weight: 700; margin-bottom: 8px; color: var(--text-primary); font-size: 12px; text-transform: uppercase;">Condições de Pagamento</div>
                
                <div id="payment-methods-list" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;" class="no-print-interactive">
                  \${orderData.paymentMethods.map((pm, idx) => \`
                    <div style="display: flex; gap: 8px; align-items: center;">
                      <select class="form-input pay-method-select" data-index="\${idx}" style="flex: 1; padding: 4px 8px; font-size: 12px;">
                        \${['Dinheiro', 'PIX', 'Crédito', 'Débito', 'Permuta'].map(m => \`<option value="\${m}" \${pm.method === m ? 'selected' : ''}>\${m}</option>\`).join('')}
                      </select>
                      <input type="number" step="0.01" min="0" class="form-input pay-method-amount" data-index="\${idx}" value="\${pm.amount}" style="width: 100px; text-align: right; padding: 4px 8px; font-size: 12px;" placeholder="Valor R$">
                      <button type="button" class="btn btn-secondary btn-remove-pay" data-index="\${idx}" style="padding: 4px; color: #dc2626;">✖</button>
                    </div>
                  \`).join('')}
                </div>
                <button type="button" class="btn btn-secondary no-print-interactive" id="btn-add-pay" style="font-size: 11px; padding: 4px 8px; margin-bottom: 12px;">+ Adicionar Forma de Pagamento (Ex: Permuta + PIX)</button>

                \${(() => {
                  const totalPaid = orderData.paymentMethods.reduce((sum, p) => sum + Number(p.amount), 0);
                  const total = getCalculatedTotal();
                  const remaining = Math.max(0, total - totalPaid);
                  return \`
                    <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                      <span>Valor Entrada/Pago:</span>
                      <span style="font-weight: 600; color: #16a34a;">R$ \${totalPaid.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700;">
                      <span>Valor Restante:</span>
                      <span style="color: \${remaining > 0 ? '#dc2626' : '#16a34a'};">R$ \${remaining.toFixed(2)}</span>
                    </div>
                  \`;
                })()}
              </div>

              <!-- Action buttons on NF -->
              <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;" class="no-print-interactive">
                <button type="button" class="btn btn-secondary" id="btn-print-nf">🖨️ Salvar PDF / Imprimir</button>
              </div>

            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 24px; border-top: 1px solid var(--border-subtle); padding-top: 16px;">
              <button type="button" class="btn btn-secondary btn-prev-tab" data-prev="section-insumos">⬅ Voltar</button>
              <button type="submit" class="btn btn-primary" style="font-size: 1.1rem; padding: 10px 24px;">✅ Concluir e Salvar Pedido</button>
            </div>
          </div>

        </form>
      </div>
    \`;

    container.innerHTML = html;

    // Attach Tab Events
    const tabs = container.querySelectorAll('.binder-tab');
    const panels = container.querySelectorAll('.binder-panel');

    function activateTab(targetId) {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      const activeTab = container.querySelector(\`.binder-tab[data-target="\${targetId}"]\`);
      const activePanel = document.getElementById(targetId);
      if (activeTab) activeTab.classList.add('active');
      if (activePanel) {
        activePanel.classList.add('active');
        activePanel.style.display = 'block';
      }
      panels.forEach(p => { if (p.id !== targetId) p.style.display = 'none'; });
    }

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        saveCurrentState();
        activateTab(tab.dataset.target);
        render(); // re-render to update dynamic sections (BOM, Finance) based on new state
        activateTab(tab.dataset.target); // restore active tab after render
      });
    });

    container.querySelectorAll('.btn-next-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        saveCurrentState();
        const next = btn.dataset.next;
        activateTab(next);
        render();
        activateTab(next);
      });
    });

    container.querySelectorAll('.btn-prev-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        saveCurrentState();
        const prev = btn.dataset.prev;
        activateTab(prev);
        render();
        activateTab(prev);
      });
    });

    // Helper: Save form inputs to orderData before re-rendering
    function saveCurrentState() {
      // Cliente & Entrega
      if(document.querySelector('input[name="customerType"]:checked')) orderData.customerType = document.querySelector('input[name="customerType"]:checked').value;
      if(document.getElementById('inp-cli-nome')) orderData.customer = document.getElementById('inp-cli-nome').value;
      if(document.getElementById('inp-cli-empresa')) orderData.customerCompany = document.getElementById('inp-cli-empresa').value;
      if(document.getElementById('inp-cli-contato')) orderData.customerPhone = document.getElementById('inp-cli-contato').value;
      if(document.getElementById('inp-cli-nasc')) orderData.customerBirthDate = document.getElementById('inp-cli-nasc').value;
      if(document.getElementById('inp-cli-cpf')) orderData.customerCPF = document.getElementById('inp-cli-cpf').value;
      if(document.getElementById('inp-cli-cnpj')) orderData.customerCNPJ = document.getElementById('inp-cli-cnpj').value;
      if(document.getElementById('inp-cli-evento')) orderData.eventDate = document.getElementById('inp-cli-evento').value;
      if(document.getElementById('inp-cli-obs')) orderData.notes = document.getElementById('inp-cli-obs').value;
      
      if(document.getElementById('inp-ent-cep')) orderData.deliveryCep = document.getElementById('inp-ent-cep').value;
      if(document.getElementById('inp-ent-endereco')) orderData.deliveryAddress = document.getElementById('inp-ent-endereco').value;
      if(document.getElementById('inp-ent-numero')) orderData.deliveryNumber = document.getElementById('inp-ent-numero').value;
      if(document.getElementById('inp-ent-bairro')) orderData.deliveryNeighborhood = document.getElementById('inp-ent-bairro').value;
      if(document.getElementById('inp-ent-cidade')) orderData.deliveryCity = document.getElementById('inp-ent-cidade').value;
      if(document.getElementById('inp-ent-estado')) orderData.deliveryState = document.getElementById('inp-ent-estado').value;
      if(document.getElementById('inp-ent-obs')) orderData.deliveryNotes = document.getElementById('inp-ent-obs').value;

      // Items personalization & options
      container.querySelectorAll('.item-pers-field').forEach(el => {
        const idx = el.dataset.index;
        const fieldId = el.dataset.field;
        if(orderData.items[idx]) {
          if(!orderData.items[idx].personalization) orderData.items[idx].personalization = {};
          orderData.items[idx].personalization[fieldId] = el.value;
        }
      });
      container.querySelectorAll('.item-opt-field').forEach(el => {
        const idx = el.dataset.index;
        const fieldId = el.dataset.field;
        if(orderData.items[idx]) {
          if(!orderData.items[idx].changeOptions) orderData.items[idx].changeOptions = {};
          orderData.items[idx].changeOptions[fieldId] = el.value;
        }
      });
      container.querySelectorAll('.item-notes-field').forEach(el => {
        const idx = el.dataset.index;
        if(orderData.items[idx]) {
          orderData.items[idx].notes = el.value;
        }
      });

      // Financeiro
      if(document.getElementById('inp-fin-discount')) orderData.discount = Number(document.getElementById('inp-fin-discount').value) || 0;
      
      const newPayments = [];
      container.querySelectorAll('.pay-method-select').forEach((sel, i) => {
        const amtInput = container.querySelectorAll('.pay-method-amount')[i];
        if(sel && amtInput) {
          newPayments.push({ method: sel.value, amount: Number(amtInput.value) || 0 });
        }
      });
      if (newPayments.length > 0) orderData.paymentMethods = newPayments;
    }

    // Interactive Actions
    container.querySelectorAll('input[name="customerType"]').forEach(r => {
      r.addEventListener('change', () => {
        saveCurrentState();
        render();
        activateTab('section-cliente');
      });
    });

    const btnBuscaCep = document.getElementById('btn-busca-cep');
    if (btnBuscaCep) {
      btnBuscaCep.addEventListener('click', async () => {
        const cep = document.getElementById('inp-ent-cep').value.replace(/\D/g, '');
        if (cep.length !== 8) { showToast('CEP inválido'); return; }
        try {
          const res = await fetch(\`https://viacep.com.br/ws/\${cep}/json/\`);
          const data = await res.json();
          if (data.erro) throw new Error();
          document.getElementById('inp-ent-endereco').value = data.logradouro || '';
          document.getElementById('inp-ent-bairro').value = data.bairro || '';
          document.getElementById('inp-ent-cidade').value = data.localidade || '';
          document.getElementById('inp-ent-estado').value = data.uf || '';
          document.getElementById('inp-ent-numero').focus();
        } catch(e) {
          showToast('Erro ao buscar CEP', '🔴');
        }
      });
    }

    const btnAddProduct = document.getElementById('btn-add-product');
    if (btnAddProduct) {
      btnAddProduct.addEventListener('click', () => {
        saveCurrentState();
        const pid = document.getElementById('inp-prod-select').value;
        const pqty = Number(document.getElementById('inp-prod-qty').value) || 1;
        const prod = products.find(p => p.id === pid);
        if (prod) {
          orderData.items.push({
            productId: prod.id,
            productTitle: prod.name,
            qty: pqty,
            unitPrice: prod.price || 0,
            personalization: {},
            changeOptions: {},
            productSnapshot: JSON.parse(JSON.stringify(prod)),
            notes: ''
          });
          // Also set default payment amount to total
          if (orderData.paymentMethods.length === 1) {
            orderData.paymentMethods[0].amount = getCalculatedTotal();
          }
          render();
          activateTab('section-produto');
        }
      });
    }

    container.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        saveCurrentState();
        const idx = Number(e.currentTarget.dataset.index);
        orderData.items.splice(idx, 1);
        render();
        activateTab('section-produto');
      });
    });

    const btnAddPay = document.getElementById('btn-add-pay');
    if (btnAddPay) {
      btnAddPay.addEventListener('click', () => {
        saveCurrentState();
        orderData.paymentMethods.push({ method: 'Dinheiro', amount: 0 });
        render();
        activateTab('section-financeiro');
      });
    }

    container.querySelectorAll('.btn-remove-pay').forEach(btn => {
      btn.addEventListener('click', (e) => {
        saveCurrentState();
        const idx = Number(e.currentTarget.dataset.index);
        orderData.paymentMethods.splice(idx, 1);
        render();
        activateTab('section-financeiro');
      });
    });

    const btnPrintNf = document.getElementById('btn-print-nf');
    if (btnPrintNf) {
      btnPrintNf.addEventListener('click', () => {
        // Simple print
        const styles = \`
          <style>
            body { font-family: sans-serif; padding: 20px; }
            .no-print-interactive { display: none !important; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }
          </style>
        \`;
        const printContent = document.getElementById('invoice-printable-area').innerHTML;
        const win = window.open('', '_blank');
        win.document.write('<html><head><title>Nota do Pedido</title>' + styles + '</head><body>' + printContent + '</body></html>');
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 500);
      });
    }

    // Refresh calculations when amount inputs change
    container.querySelectorAll('.pay-method-amount, #inp-fin-discount').forEach(inp => {
      inp.addEventListener('blur', () => {
        saveCurrentState();
        render();
        activateTab('section-financeiro');
      });
    });

    // Form Submit (Save Order)
    const form = document.getElementById('form-new-order-page');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveCurrentState();

        if (orderData.items.length === 0) {
          showToast('Adicione pelo menos um produto ao pedido.', '🔴');
          activateTab('section-produto');
          return;
        }
        
        try {
          const { createOrder } = await import('./orders.js');
          
          const totalPaid = orderData.paymentMethods.reduce((sum, p) => sum + Number(p.amount), 0);
          const totalAmount = getCalculatedTotal();
          
          const primaryMethod = orderData.paymentMethods.length > 0 ? orderData.paymentMethods[0].method : 'PIX';

          const newOrder = createOrder({
            customerType: orderData.customerType,
            customer: orderData.customer,
            customerCompany: orderData.customerCompany,
            customerPhone: orderData.customerPhone,
            customerBirthDate: orderData.customerBirthDate,
            customerCPF: orderData.customerCPF,
            customerCNPJ: orderData.customerCNPJ,
            
            deliveryCep: orderData.deliveryCep,
            deliveryAddress: orderData.deliveryAddress,
            deliveryNumber: orderData.deliveryNumber,
            deliveryNeighborhood: orderData.deliveryNeighborhood,
            deliveryCity: orderData.deliveryCity,
            deliveryState: orderData.deliveryState,
            deliveryNotes: orderData.deliveryNotes,
            
            eventDate: orderData.eventDate,
            limitDate: orderData.limitDate,
            orderDate: new Date(),

            items: orderData.items,
            
            notes: orderData.notes,
            
            financial: {
              totalAmount,
              paidAmount: totalPaid,
              remainingAmount: Math.max(0, totalAmount - totalPaid),
              discount: orderData.discount,
              paymentMethods: orderData.paymentMethods
            },
            
            paymentMethod: primaryMethod
          });
          
          showToast(\`Pedido \${newOrder.number} cadastrado com sucesso!\`);
          switchView('pedidos');
        } catch (err) {
          showToast(err.message, '🔴');
        }
      });
    }

    const btnCancel = document.getElementById('btn-cancel-order');
    if (btnCancel) {
      btnCancel.addEventListener('click', () => switchView('pedidos'));
    }
  }

  // Initial render
  render();
}
`

fs.writeFileSync('src/modules/orders/orders.ui.js', before + newFunction + after);
console.log('Successfully patched orders.ui.js');
