/**
 * PAPER MAX - Settings UI Module
 * Renders and controls the ⚙ AJUSTES view:
 * Preferências, Automações, Impressão, Documentos, Alertas, Auditoria e Logs, Backup e Segurança.
 */

import {
  getSettings,
  updateSettings,
  getPrintQueue,
  addPrintQueueItem,
  updatePrintQueueStatus,
  updatePrintQueueItem,
  duplicatePrintQueueItem,
  deletePrintQueueItem,
  clearCompletedPrintQueue,
  getPendingPrintJobsCount,
  getDocumentConfigs,
  updateDocumentConfig,
  generateDocumentHtml,
  getAlertsConfig,
  updateAlertRule,
  evaluateSystemAlerts,
  getAuditLogs,
  exportAuditLogsCSV,
  exportAuditLogsJSON,
  getSystemDataStats,
  exportBackup,
  restoreBackup,
  recordAuditLog
} from './settings.engine.js';
import { loadOrders, loadProducts, loadMaterials, clearAllSystemData } from '../../data/storage.js';
import { showToast, bus } from '../../core/events.js';
import { showConfirmDialog } from '../orders/orders.ui.js';
import { formatDateBR, formatPhone, formatCPFOrCNPJ } from '../../utils/sanitize.js';
import { openDrawer, closeDrawer, switchView } from '../../app.js';

let activeSettingsSubTab = 'preferencias';
let auditFilterModule = 'todos';
let auditSearchQuery = '';
let printQueueFilterStatus = 'todos';
let printQueueSearchQuery = '';

export function setActiveSettingsTab(tabName) {
  if (tabName) {
    activeSettingsSubTab = tabName;
  }
}

export function renderSettingsView(container, options = {}) {
  if (!container || !(container instanceof HTMLElement)) {
    container = document.getElementById('view-container');
  }
  if (!container) return;

  if (options.tab) {
    activeSettingsSubTab = options.tab;
  }

  const settings = getSettings();
  const pendingPrintCount = getPendingPrintJobsCount();
  const liveAlerts = evaluateSystemAlerts();
  const totalLiveAlertsCount = liveAlerts.reduce((acc, a) => acc + (a.count || 1), 0);

  container.innerHTML = `
    <!-- Top Header & Action Bar (Padrão Global Paper Max / Financeiro) -->
    <div class="module-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; margin-bottom: 20px;">
      <div>
        <h2 class="module-title" style="margin: 0; font-size: 1.75rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 10px; letter-spacing: -0.5px;">
          ⚙️ Ajustes do Sistema
        </h2>
        <p style="margin: 4px 0 0 0; font-size: 0.875rem; color: var(--text-secondary);">
          Central de configurações, identidade da marca, automações, impressão térmica/A4, modelos e segurança.
        </p>
      </div>

      <div class="header-actions" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
        <button class="btn btn-secondary" id="btn-quick-export-backup" title="Exportar cópia de segurança em JSON" style="padding: 8px 14px; font-weight: 600;">
          ⬇ Exportar Backup
        </button>
        <button class="btn btn-secondary" id="btn-header-restore-backup" title="Restaurar backup JSON" style="padding: 8px 14px; font-weight: 600;">
          ⬆ Restaurar Backup
        </button>
      </div>
    </div>

    <!-- HORIZONTAL DIVIDER -->
    <div style="height: 1px; background: #e2e8f0; margin: 0 0 24px 0; width: 100%;"></div>

    <!-- Navigation Tabs Bar (Divisórias de Fichário Horizontais Padrão Global) -->
    <div class="finance-tab-bar" id="settings-binder-tabs" style="display: flex; gap: 4px; margin-bottom: 24px; border-bottom: 2px solid #cbd5e1; padding-bottom: 0; overflow-x: auto; align-items: flex-end;">
      ${[
        { id: 'preferencias', label: '🏢 Preferências' },
        { id: 'automacoes', label: '⚡ Automações' },
        { id: 'impressao', label: '🖨️ Impressão & Fila', badge: pendingPrintCount > 0 ? pendingPrintCount : null, badgeColor: '#f59e0b' },
        { id: 'documentos', label: '📄 Central de Documentos' },
        { id: 'alertas', label: '🔔 Alertas & Regras', badge: totalLiveAlertsCount > 0 ? totalLiveAlertsCount : null, badgeColor: '#ef4444' },
        { id: 'auditoria', label: '📋 Auditoria e Logs' },
        { id: 'backup', label: '🛡️ Backup e Segurança' }
      ].map(tab => {
        const isActive = activeSettingsSubTab === tab.id;
        return `
          <button class="tab-btn binder-tab ${isActive ? 'active' : ''}" data-tab="${tab.id}">
            ${tab.label}
            ${tab.badge ? `<span style="margin-left: 6px; padding: 1px 7px; font-size: 11px; border-radius: 999px; background: ${tab.badgeColor}; color: #fff; font-weight: bold;">${tab.badge}</span>` : ''}
          </button>
        `;
      }).join('')}
    </div>

    <!-- Sub-tab Render Container -->
    <div id="settings-tab-content">
      ${renderActiveSubTabContent(activeSettingsSubTab, settings)}
    </div>
  `;

  attachSettingsEvents(container);
}

function renderActiveSubTabContent(subTab, settings) {
  switch (subTab) {
    case 'preferencias':
      return renderPreferenciasTab(settings);
    case 'automacoes':
      return renderAutomacoesTab(settings);
    case 'impressao':
      return renderImpressaoTab(settings);
    case 'documentos':
      return renderDocumentosTab(settings);
    case 'alertas':
      return renderAlertasTab(settings);
    case 'auditoria':
      return renderAuditoriaTab(settings);
    case 'backup':
      return renderBackupTab(settings);
    default:
      return renderPreferenciasTab(settings);
  }
}

// ==========================================
// 1. SUBABA: PREFERÊNCIAS
// ==========================================
function renderPreferenciasTab(settings) {
  const vis = settings.docVisibility || {};

  return `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <!-- CARD 1: IDENTIDADE DO ATELIÊ -->
      <div class="card" style="padding: 24px 28px; border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.6rem;">🏢</span>
            <div>
              <h3 style="margin: 0; font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px;">IDENTIDADE DO ATELIÊ</h3>
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Dados cadastrais da marca que aparecem em orçamentos, comprovantes e etiquetas</span>
            </div>
          </div>
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #047857; font-size: 0.8125rem; font-weight: 700; padding: 5px 12px; border-radius: 16px;">
            ✓ Autosave Ativo
          </span>
        </div>

        <form id="form-settings-identity" style="display: flex; flex-direction: column; gap: 20px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Nome do Ateliê *</label>
              <input type="text" id="set-atelierName" class="form-input" style="width: 100%; padding: 8px 12px; font-size: 0.875rem;" value="${escapeHtml(settings.atelierName || '')}" required />
            </div>

            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Nome do Responsável</label>
              <input type="text" id="set-ownerName" class="form-input" style="width: 100%; padding: 8px 12px; font-size: 0.875rem;" value="${escapeHtml(settings.ownerName || '')}" />
            </div>

            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Telefone Principal</label>
              <input type="text" id="set-phone" data-mask="phone" class="form-input" style="width: 100%; padding: 8px 12px; font-size: 0.875rem;" value="${escapeHtml(formatPhone(settings.phone || ''))}" placeholder="(XX) 9 XXXX-XXXX" />
            </div>

            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">WhatsApp Comercial</label>
              <input type="text" id="set-whatsapp" data-mask="phone" class="form-input" style="width: 100%; padding: 8px 12px; font-size: 0.875rem;" value="${escapeHtml(formatPhone(settings.whatsapp || ''))}" placeholder="(XX) 9 XXXX-XXXX" />
            </div>

            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">E-mail de Contato</label>
              <input type="email" id="set-email" class="form-input" style="width: 100%; padding: 8px 12px; font-size: 0.875rem;" value="${escapeHtml(settings.email || '')}" />
            </div>

            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Instagram (@atelie)</label>
              <input type="text" id="set-instagram" class="form-input" style="width: 100%; padding: 8px 12px; font-size: 0.875rem;" value="${escapeHtml(settings.instagram || '')}" placeholder="@seuperfil" />
            </div>

            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">CPF ou CNPJ</label>
              <input type="text" id="set-docNumber" data-mask="doc" class="form-input" style="width: 100%; padding: 8px 12px; font-size: 0.875rem;" value="${escapeHtml(formatCPFOrCNPJ(settings.docNumber || ''))}" placeholder="XX.XXX.XXX/XXXX-XX ou XXX.XXX.XXX-XX" />
            </div>

            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Logotipo (URL ou Imagem)</label>
              <div style="display: flex; gap: 8px;">
                <input type="text" id="set-logo" class="form-input" style="flex: 1; padding: 8px 12px; font-size: 0.875rem;" value="${escapeHtml(settings.logo || '')}" placeholder="https://exemplo.com/logo.png" />
                <button type="button" id="btn-upload-logo-fake" class="btn btn-secondary" style="padding: 8px 14px; font-size: 0.8125rem; white-space: nowrap;">Carregar</button>
              </div>
            </div>

            <div style="grid-column: 1 / -1;">
              <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Endereço Completo</label>
              <input type="text" id="set-address" class="form-input" style="width: 100%; padding: 8px 12px; font-size: 0.875rem;" value="${escapeHtml(settings.address || '')}" placeholder="Rua, Número, Bairro, Cidade - UF, CEP" />
            </div>
          </div>

          <!-- CHECKLIST: EXIBIR NOS DOCUMENTOS -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin-top: 4px;">
            <h4 style="margin: 0 0 12px 0; font-size: 0.8125rem; font-weight: 800; color: #334155; display: flex; align-items: center; gap: 8px; text-transform: uppercase; letter-spacing: 0.3px;">
              <span>📋</span> Exibir estas informações nos documentos e comprovantes gerados:
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; font-size: 0.8125rem; color: #475569;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="vis-atelierName" class="form-checkbox" ${vis.atelierName !== false ? 'checked' : ''} />
                <span style="font-weight: 600;">Nome do Ateliê</span>
              </label>

              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="vis-ownerName" class="form-checkbox" ${vis.ownerName !== false ? 'checked' : ''} />
                <span style="font-weight: 600;">Responsável</span>
              </label>

              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="vis-phone" class="form-checkbox" ${vis.phone !== false ? 'checked' : ''} />
                <span style="font-weight: 600;">Telefone</span>
              </label>

              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="vis-whatsapp" class="form-checkbox" ${vis.whatsapp !== false ? 'checked' : ''} />
                <span style="font-weight: 600;">WhatsApp</span>
              </label>

              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="vis-email" class="form-checkbox" ${vis.email !== false ? 'checked' : ''} />
                <span style="font-weight: 600;">E-mail</span>
              </label>

              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="vis-instagram" class="form-checkbox" ${vis.instagram !== false ? 'checked' : ''} />
                <span style="font-weight: 600;">Instagram</span>
              </label>

              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="vis-address" class="form-checkbox" ${vis.address !== false ? 'checked' : ''} />
                <span style="font-weight: 600;">Endereço</span>
              </label>

              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="vis-docNumber" class="form-checkbox" ${vis.docNumber !== false ? 'checked' : ''} />
                <span style="font-weight: 600;">CPF / CNPJ</span>
              </label>

              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="vis-logo" class="form-checkbox" ${vis.logo !== false ? 'checked' : ''} />
                <span style="font-weight: 600;">Logo do Ateliê</span>
              </label>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; padding-top: 6px;">
            <button type="submit" class="btn btn-primary" style="padding: 10px 22px; font-weight: 700; background: var(--border-focus, #db2777); color: #ffffff; border-radius: 8px;">
              💾 Salvar Identidade do Ateliê
            </button>
          </div>
        </form>
      </div>

      <!-- CARD 2: CONFIGURAÇÕES DE INTERFACE & FORMATOS -->
      <div class="card" style="padding: 24px 28px; border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.6rem;">🖥️</span>
            <div>
              <h3 style="margin: 0; font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px;">INTERFACE & FORMATOS REGIONAIS</h3>
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Tema, densidade visual, exibição de LEDs operacionais e formato de datas</span>
            </div>
          </div>
          <span class="badge" style="background: rgba(59, 130, 246, 0.12); color: #1d4ed8; font-size: 0.8125rem; font-weight: 700; padding: 5px 12px; border-radius: 16px;">
            Padrão do Sistema
          </span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
          <div>
            <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Tema da Interface</label>
            <select id="ui-theme" class="form-select" style="width: 100%; padding: 8px 12px; font-size: 0.875rem; border-radius: 8px; border: 1px solid #cbd5e1;">
              <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>☀️ Claro (Padrão)</option>
              <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>🌙 Escuro</option>
              <option value="system" ${settings.theme === 'system' ? 'selected' : ''}>💻 Seguir Sistema</option>
            </select>
          </div>

          <div>
            <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Densidade Visual</label>
            <select id="ui-density" class="form-select" style="width: 100%; padding: 8px 12px; font-size: 0.875rem; border-radius: 8px; border: 1px solid #cbd5e1;">
              <option value="compact" ${settings.density === 'compact' ? 'selected' : ''}>Compacta (Alta densidade)</option>
              <option value="default" ${settings.density === 'default' ? 'selected' : ''}>Padrão</option>
              <option value="comfortable" ${settings.density === 'comfortable' ? 'selected' : ''}>Confortável</option>
            </select>
          </div>

          <div>
            <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Exibição dos LEDs Operacionais</label>
            <select id="ui-showLeds" class="form-select" style="width: 100%; padding: 8px 12px; font-size: 0.875rem; border-radius: 8px; border: 1px solid #cbd5e1;">
              <option value="true" ${settings.showLeds !== false ? 'selected' : ''}>🟢 LEDs Ativos e Visíveis</option>
              <option value="false" ${settings.showLeds === false ? 'selected' : ''}>⚪ LEDs Ocultos</option>
            </select>
          </div>

          <div>
            <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Formato de Data Padrão</label>
            <select id="ui-dateFormat" class="form-select" style="width: 100%; padding: 8px 12px; font-size: 0.875rem; border-radius: 8px; border: 1px solid #cbd5e1;">
              <option value="dd/mm/aaaa" ${settings.dateFormat === 'dd/mm/aaaa' ? 'selected' : ''}>dd/mm/aaaa (Ex: 18/09/2026)</option>
              <option value="dd/mm" ${settings.dateFormat === 'dd/mm' ? 'selected' : ''}>dd/mm (Ex: 18/09)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 2. SUBABA: AUTOMAÇÕES
// ==========================================
function renderAutomacoesTab(settings) {
  const sw = settings.automationSwitches || {};

  return `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <!-- CARD 1: REGRAS E DIRETRIZES DE AUTOMAÇÃO -->
      <div class="card" style="padding: 24px 28px; border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.6rem;">⚡</span>
            <div>
              <h3 style="margin: 0; font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px;">CENTRAL DE AUTOMAÇÕES E FLUXO</h3>
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Regras automáticas de emissão de documentos, baixa de estoque e lançamentos contábeis</span>
            </div>
          </div>
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #047857; font-size: 0.8125rem; font-weight: 700; padding: 5px 12px; border-radius: 16px;">
            ✓ Motor Ativo
          </span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
          <!-- GRUPO: PEDIDOS -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
              <span style="font-size: 1.2rem;">📦</span>
              <h4 style="margin: 0; font-size: 0.8125rem; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.4px;">Automações de Pedidos</h4>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.8125rem;">
              <label style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; cursor: pointer;">
                <div>
                  <span style="font-weight: 700; color: #1e293b; display: block;">Gerar documentos ao cadastrar pedido</span>
                  <span style="color: #64748b; font-size: 0.75rem;">Cria O.S. e ficha técnica no ato do cadastro.</span>
                </div>
                <input type="checkbox" data-group="automationSwitches" data-key="autoDocOnCreate" class="form-checkbox" ${sw.autoDocOnCreate !== false ? 'checked' : ''} />
              </label>

              <label style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; cursor: pointer;">
                <div>
                  <span style="font-weight: 700; color: #1e293b; display: block;">Gerar documentos ao aprovar</span>
                  <span style="color: #64748b; font-size: 0.75rem;">Dispara emissão ao mudar status para aprovado.</span>
                </div>
                <input type="checkbox" data-group="automationSwitches" data-key="autoDocOnApprove" class="form-checkbox" ${sw.autoDocOnApprove !== false ? 'checked' : ''} />
              </label>

              <label style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; cursor: pointer;">
                <div>
                  <span style="font-weight: 700; color: #1e293b; display: block;">Gerar O.S. técnica automaticamente</span>
                  <span style="color: #64748b; font-size: 0.75rem;">Formata a Ordem de Serviço vetorial.</span>
                </div>
                <input type="checkbox" data-group="automationSwitches" data-key="autoOS" class="form-checkbox" ${sw.autoOS !== false ? 'checked' : ''} />
              </label>

              <label style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; cursor: pointer;">
                <div>
                  <span style="font-weight: 700; color: #1e293b; display: block;">Gerar etiquetas de produto</span>
                  <span style="color: #64748b; font-size: 0.75rem;">Gera etiquetas baseadas na tiragem.</span>
                </div>
                <input type="checkbox" data-group="automationSwitches" data-key="autoLabels" class="form-checkbox" ${sw.autoLabels !== false ? 'checked' : ''} />
              </label>

              <label style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; cursor: pointer;">
                <div>
                  <span style="font-weight: 700; color: #1e293b; display: block;">Gerar cupom térmico</span>
                  <span style="color: #64748b; font-size: 0.75rem;">Gera comprovante não fiscal na finalização.</span>
                </div>
                <input type="checkbox" data-group="automationSwitches" data-key="autoReceipt" class="form-checkbox" ${sw.autoReceipt !== false ? 'checked' : ''} />
              </label>

              <label style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; cursor: pointer; padding-top: 8px; border-top: 1px dashed #cbd5e1;">
                <div>
                  <span style="font-weight: 700; color: var(--border-focus, #db2777); display: block;">Enviar direto para fila de impressão</span>
                  <span style="color: #64748b; font-size: 0.75rem;">Enfileira automaticamente os documentos criados.</span>
                </div>
                <input type="checkbox" data-group="automationSwitches" data-key="autoSendToPrintQueue" class="form-checkbox" ${sw.autoSendToPrintQueue !== false ? 'checked' : ''} />
              </label>
            </div>
          </div>

          <!-- GRUPO: ESTOQUE -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
              <span style="font-size: 1.2rem;">📊</span>
              <h4 style="margin: 0; font-size: 0.8125rem; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.4px;">Automações de Estoque</h4>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.8125rem;">
              <label style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; cursor: pointer;">
                <div>
                  <span style="font-weight: 700; color: #1e293b; display: block;">Alertar estoque mínimo</span>
                  <span style="color: #64748b; font-size: 0.75rem;">Avisa quando um insumo atinge o ponto de reposição.</span>
                </div>
                <input type="checkbox" data-group="automationSwitches" data-key="alertMinStock" class="form-checkbox" ${sw.alertMinStock !== false ? 'checked' : ''} />
              </label>

              <label style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; cursor: pointer;">
                <div>
                  <span style="font-weight: 700; color: #1e293b; display: block;">Alertar falta de material</span>
                  <span style="color: #64748b; font-size: 0.75rem;">Compara o BOM com o saldo disponível antes de produzir.</span>
                </div>
                <input type="checkbox" data-group="automationSwitches" data-key="alertMissingMaterial" class="form-checkbox" ${sw.alertMissingMaterial !== false ? 'checked' : ''} />
              </label>

              <label style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; cursor: pointer;">
                <div>
                  <span style="font-weight: 700; color: #1e293b; display: block;">Reservar estoque ao aprovar</span>
                  <span style="color: #64748b; font-size: 0.75rem;">Bloqueia insumos para evitar dupla alocação.</span>
                </div>
                <input type="checkbox" data-group="automationSwitches" data-key="reserveStockOnApprove" class="form-checkbox" ${sw.reserveStockOnApprove !== false ? 'checked' : ''} />
              </label>

              <div style="padding-top: 8px; border-top: 1px dashed #cbd5e1; display: flex; flex-direction: column; gap: 6px;">
                <span style="font-weight: 700; color: #1e293b;">Baixar estoque na etapa de produção:</span>
                <select id="auto-deduct-stage" data-group="automationSwitches" data-key="deductStockStage" class="form-select" style="padding: 7px 10px; font-size: 0.8125rem; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff;">
                  <option value="impressao" ${sw.deductStockStage === 'impressao' ? 'selected' : ''}>Etapa 1: Impressão</option>
                  <option value="corte" ${sw.deductStockStage === 'corte' ? 'selected' : ''}>Etapa 2: Corte</option>
                  <option value="embalagem" ${sw.deductStockStage === 'embalagem' || !sw.deductStockStage ? 'selected' : ''}>Etapa 5: Embalagem / Pronto (Recomendado)</option>
                  <option value="entregue" ${sw.deductStockStage === 'entregue' ? 'selected' : ''}>Na entrega do pedido</option>
                </select>
              </div>
            </div>
          </div>

          <!-- GRUPO: PRODUÇÃO -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
              <span style="font-size: 1.2rem;">⚙️</span>
              <h4 style="margin: 0; font-size: 0.8125rem; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.4px;">Automações de Produção</h4>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.8125rem;">
              <label style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; cursor: pointer;">
                <div>
                  <span style="font-weight: 700; color: #1e293b; display: block;">Avançar etapa automaticamente</span>
                  <span style="color: #64748b; font-size: 0.75rem;">Avança de fase ao atingir 100% da quantidade da etapa.</span>
                </div>
                <input type="checkbox" data-group="automationSwitches" data-key="autoAdvanceStage" class="form-checkbox" ${sw.autoAdvanceStage !== false ? 'checked' : ''} />
              </label>

              <label style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; cursor: pointer;">
                <div>
                  <span style="font-weight: 700; color: #1e293b; display: block;">Criar pendência ao bloquear</span>
                  <span style="color: #64748b; font-size: 0.75rem;">Gera registro com motivo ao marcar pedido como bloqueado.</span>
                </div>
                <input type="checkbox" data-group="automationSwitches" data-key="createBlockPendency" class="form-checkbox" ${sw.createBlockPendency !== false ? 'checked' : ''} />
              </label>

              <label style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; cursor: pointer;">
                <div>
                  <span style="font-weight: 700; color: #1e293b; display: block;">Criar retrabalho no CQ</span>
                  <span style="color: #64748b; font-size: 0.75rem;">Retorna unidades reprovadas para a impressão.</span>
                </div>
                <input type="checkbox" data-group="automationSwitches" data-key="createReworkOnQCFail" class="form-checkbox" ${sw.createReworkOnQCFail !== false ? 'checked' : ''} />
              </label>
            </div>
          </div>

          <!-- GRUPO: FINANCEIRO -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
              <span style="font-size: 1.2rem;">💰</span>
              <h4 style="margin: 0; font-size: 0.8125rem; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.4px;">Automações Financeiras</h4>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.8125rem;">
              <label style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; cursor: pointer;">
                <div>
                  <span style="font-weight: 700; color: #1e293b; display: block;">Conta a receber na venda</span>
                  <span style="color: #64748b; font-size: 0.75rem;">Gera título a receber com o saldo pendente.</span>
                </div>
                <input type="checkbox" data-group="automationSwitches" data-key="createReceivableOnSale" class="form-checkbox" ${sw.createReceivableOnSale !== false ? 'checked' : ''} />
              </label>

              <label style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; cursor: pointer;">
                <div>
                  <span style="font-weight: 700; color: #1e293b; display: block;">Conta a pagar na compra de insumos</span>
                  <span style="color: #64748b; font-size: 0.75rem;">Gera título financeiro ao registrar compra.</span>
                </div>
                <input type="checkbox" data-group="automationSwitches" data-key="createPayableOnPurchase" class="form-checkbox" ${sw.createPayableOnPurchase !== false ? 'checked' : ''} />
              </label>

              <label style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; cursor: pointer;">
                <div>
                  <span style="font-weight: 700; color: #1e293b; display: block;">Atualizar fluxo de caixa contínuo</span>
                  <span style="color: #64748b; font-size: 0.75rem;">Computa entradas e saídas no saldo operacional.</span>
                </div>
                <input type="checkbox" data-group="automationSwitches" data-key="autoCashFlow" class="form-checkbox" ${sw.autoCashFlow !== false ? 'checked' : ''} />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 3. SUBABA: IMPRESSÃO & FILA DE IMPRESSÃO
// ==========================================
function renderImpressaoTab(settings) {
  const p = settings.printer || {};
  const pb = settings.printBehavior || {};
  const queue = getPrintQueue({ status: printQueueFilterStatus, search: printQueueSearchQuery });
  const pendingCount = getPendingPrintJobsCount();

  return `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <!-- CARD 1: CONFIGURAÇÃO DA IMPRESSORA -->
      <div class="card" style="padding: 24px 28px; border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.6rem;">🖨️</span>
            <div>
              <h3 style="margin: 0; font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px;">CONFIGURAÇÕES DE IMPRESSÃO TÉRMICA E A4</h3>
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Definições de equipamento padrão, larguras de bobina, margens e rodapés</span>
            </div>
          </div>
          <span class="badge" style="background: rgba(59, 130, 246, 0.12); color: #1d4ed8; font-size: 0.8125rem; font-weight: 700; padding: 5px 12px; border-radius: 16px;">
            ESC/POS & PDF
          </span>
        </div>

        <form id="form-settings-printer" style="display: flex; flex-direction: column; gap: 16px; font-size: 0.8125rem;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
            <div>
              <label style="display: block; font-weight: 700; color: #334155; margin-bottom: 4px;">Impressora Padrão</label>
              <input type="text" id="prn-defaultPrinter" class="form-input w-full" value="${escapeHtml(p.defaultPrinter || 'Térmica 58mm (Padrão)')}" />
            </div>

            <div>
              <label style="display: block; font-weight: 700; color: #334155; margin-bottom: 4px;">Formato / Largura Térmica</label>
              <select id="prn-thermalWidth" class="form-input w-full">
                <option value="58mm" ${p.thermalWidth === '58mm' ? 'selected' : ''}>58 mm (Bobina estreita)</option>
                <option value="80mm" ${p.thermalWidth === '80mm' ? 'selected' : ''}>80 mm (Bobina padrão)</option>
                <option value="A4" ${p.thermalWidth === 'A4' ? 'selected' : ''}>A4 (Impressora laser / jato de tinta)</option>
              </select>
            </div>

            <div>
              <label style="display: block; font-weight: 700; color: #334155; margin-bottom: 4px;">Margens de Impressão</label>
              <input type="text" id="prn-margins" class="form-input w-full" value="${escapeHtml(p.margins || '3mm')}" placeholder="Ex: 3mm ou 5mm" />
            </div>

            <div style="grid-column: span 2;">
              <label style="display: block; font-weight: 700; color: #334155; margin-bottom: 4px;">Cabeçalho Personalizado do Cupom</label>
              <input type="text" id="prn-customHeader" class="form-input w-full" value="${escapeHtml(p.customHeader || '')}" placeholder="PAPER MAX · ATELIÊ DE PAPELARIA" />
            </div>

            <div>
              <label style="display: block; font-weight: 700; color: #334155; margin-bottom: 4px;">Logo no Comprovante</label>
              <select id="prn-printLogo" class="form-input w-full">
                <option value="true" ${p.printLogo !== false ? 'selected' : ''}>Sim, imprimir logo</option>
                <option value="false" ${p.printLogo === false ? 'selected' : ''}>Não, apenas texto</option>
              </select>
            </div>

            <div style="grid-column: 1 / -1;">
              <label style="display: block; font-weight: 700; color: #334155; margin-bottom: 4px;">Rodapé Personalizado do Comprovante</label>
              <input type="text" id="prn-customFooter" class="form-input w-full" value="${escapeHtml(p.customFooter || '')}" placeholder="Obrigado pela preferência! Feito com amor." />
            </div>
          </div>

          <!-- COMPORTAMENTO OPERACIONAL -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin-top: 4px;">
            <h4 style="margin: 0 0 10px 0; font-size: 0.8125rem; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.3px;">Comportamento Operacional da Fila:</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; font-size: 0.8125rem; color: #475569;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="pb-autoSendToQueue" class="form-checkbox" ${pb.autoSendToQueue !== false ? 'checked' : ''} />
                <span>Enviar automático para fila</span>
              </label>

              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="pb-autoPrintWhenAvailable" class="form-checkbox" ${pb.autoPrintWhenAvailable ? 'checked' : ''} />
                <span>Imprimir automaticamente</span>
              </label>

              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="pb-askBeforePrint" class="form-checkbox" ${pb.askBeforePrint !== false ? 'checked' : ''} />
                <span>Perguntar antes de imprimir</span>
              </label>

              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="pb-allowReprint" class="form-checkbox" ${pb.allowReprint !== false ? 'checked' : ''} />
                <span>Permitir reimpressão</span>
              </label>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; padding-top: 6px;">
            <button type="submit" class="btn btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-xs">
              <span>💾</span> Salvar Configurações de Impressão
            </button>
          </div>
        </form>
      </div>

      <!-- CARD 2: FILA DE IMPRESSÃO (PRINT QUEUE) -->
      <div class="card" style="padding: 24px 28px; border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <div style="display: flex; flex-direction: column; sm:flex-direction: row; justify-content: space-between; align-items: flex-start; sm:align-items: center; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.6rem;">📑</span>
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h3 style="margin: 0; font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px;">FILA CENTRAL DE IMPRESSÃO</h3>
                <span class="badge" style="background: ${pendingCount > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(100, 116, 139, 0.12)'}; color: ${pendingCount > 0 ? '#b45309' : '#475569'}; font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 12px;">
                  ${pendingCount} pendente(s)
                </span>
              </div>
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Monitoramento e disparo de trabalhos para impressão física e térmica</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <button id="btn-batch-print-queue" class="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 text-slate-700">
              <span>🖨️</span> Imprimir Pendentes
            </button>
            <button id="btn-clear-completed-queue" class="btn btn-secondary text-xs px-2.5 py-1.5 text-slate-600" title="Limpar itens impressos">
              <span>🗑️</span> Limpar Concluídos
            </button>
            <button id="btn-open-add-queue" class="btn btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
              <span>+</span> Adicionar à Fila
            </button>
          </div>
        </div>

        <!-- FILTROS DA FILA -->
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 14px; font-size: 0.8125rem;">
          <div style="flex: 1; min-width: 240px; position: relative;" class="search-wrapper">
            <span class="search-icon" style="position: absolute; left: 10px; font-size: 13px; color: #94a3b8; pointer-events: none; z-index: 2;">🔍</span>
            <input type="text" id="queue-search" class="search" style="width: 100%; padding-left: 30px; font-size: 0.8125rem; height: 34px; box-sizing: border-box;" placeholder="Buscar por documento, pedido ou cliente..." value="${escapeHtml(printQueueSearchQuery)}" />
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="color: #64748b; white-space: nowrap;">Status:</label>
            <select id="queue-filter-status" class="form-select text-xs" style="padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff;">
              <option value="todos" ${printQueueFilterStatus === 'todos' ? 'selected' : ''}>Todos os status</option>
              <option value="aguardando" ${printQueueFilterStatus === 'aguardando' ? 'selected' : ''}>Aguardando</option>
              <option value="impresso" ${printQueueFilterStatus === 'impresso' ? 'selected' : ''}>Impressos</option>
              <option value="cancelado" ${printQueueFilterStatus === 'cancelado' ? 'selected' : ''}>Cancelados</option>
            </select>
          </div>
        </div>

        <!-- TABELA DE FILA DE IMPRESSÃO -->
        <div class="table-responsive" style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; background: #ffffff;">
          <table class="table" style="width: 100%; border-collapse: collapse; font-size: 0.8125rem; text-align: left;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1; color: #475569; font-weight: 700;">
                <th style="padding: 10px 14px;">Documento</th>
                <th style="padding: 10px 14px;">Referência / Pedido</th>
                <th style="padding: 10px 14px; text-align: center;">Qtd</th>
                <th style="padding: 10px 14px;">Formato</th>
                <th style="padding: 10px 14px;">Status</th>
                <th style="padding: 10px 14px;">Data Envio</th>
                <th style="padding: 10px 14px; text-align: right;">Ações</th>
              </tr>
            </thead>
            <tbody style="divide-y: 1px solid #f1f5f9;">
              ${queue.length === 0 ? `
                <tr>
                  <td colspan="7" style="padding: 32px; text-align: center; color: #94a3b8;">
                    Nenhum item na fila de impressão.
                  </td>
                </tr>
              ` : queue.map(item => {
                const statusColors = {
                  'Aguardando': 'background: rgba(245, 158, 11, 0.12); color: #b45309; border: 1px solid #fde68a;',
                  'Em processamento': 'background: rgba(59, 130, 246, 0.12); color: #1d4ed8; border: 1px solid #bfdbfe;',
                  'Impresso': 'background: rgba(16, 185, 129, 0.12); color: #047857; border: 1px solid #a7f3d0;',
                  'Cancelado': 'background: rgba(100, 116, 139, 0.12); color: #475569; border: 1px solid #e2e8f0;',
                  'Erro': 'background: rgba(244, 63, 94, 0.12); color: #be123c; border: 1px solid #fecdd3;'
                };
                const badgeStyle = statusColors[item.status] || 'background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;';

                return `
                  <tr style="border-bottom: 1px solid #f1f5f9; transition: background-color 0.15s ease; cursor: pointer;" class="hover:bg-slate-50" data-action="view-queue-row" data-id="${item.id}">
                    <td style="padding: 10px 14px; font-weight: 700; color: #1e293b;">
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <span>${getDocumentIcon(item.documentType)}</span>
                        <span>${escapeHtml(item.documentType)}</span>
                      </div>
                    </td>
                    <td style="padding: 10px 14px;">
                      <div style="font-weight: 600; color: #1e293b;">${escapeHtml(item.orderNumber || '-')}</div>
                      ${item.customer ? `<div style="font-size: 0.75rem; color: #64748b;">${escapeHtml(item.customer)}</div>` : ''}
                    </td>
                    <td style="padding: 10px 14px; text-align: center; font-weight: 700; color: #334155;">
                      ${item.qty || 1} un
                    </td>
                    <td style="padding: 10px 14px; font-family: monospace; font-size: 0.75rem; color: #475569;">
                      ${escapeHtml(item.format || 'A4')}
                    </td>
                    <td style="padding: 10px 14px;">
                      <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; ${badgeStyle}">
                        ${escapeHtml(item.status)}
                      </span>
                    </td>
                    <td style="padding: 10px 14px; color: #64748b; font-size: 0.75rem;">
                      ${new Date(item.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style="padding: 10px 14px; text-align: right;" onclick="event.stopPropagation()">
                      <div style="display: inline-block; position: relative;">
                        <!-- Botão Menu Três Pontinhos [ REGRA GLOBAL 2 ] -->
                        <button class="action-btn btn-dots-menu" data-action="toggle-dots-queue" data-id="${item.id}" title="Mais ações" style="padding: 4px 8px; font-weight: bold; font-size: 14px; line-height: 1; cursor: pointer;">
                          ⋮
                        </button>
                        
                        <!-- Dropdown Menu ⋮ Armazenando todas as ações rápidas -->
                        <div id="dots-queue-menu-${item.id}" class="dots-dropdown-menu" style="display: none; position: absolute; right: 0; top: 100%; margin-top: 4px; background: #ffffff; border: 1px solid var(--border-strong, #cbd5e1); border-radius: 8px; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.15); z-index: 50; min-width: 150px; padding: 4px 0; text-align: left;">
                          <button type="button" class="dots-menu-item" data-action="preview-queue" data-id="${item.id}">
                            <span>👁️</span> Visualizar
                          </button>
                          <button type="button" class="dots-menu-item" data-action="view-queue-row" data-id="${item.id}">
                            <span>📄</span> Resumo
                          </button>
                          <button type="button" class="dots-menu-item" data-action="print-queue-item" data-id="${item.id}">
                            <span>🖨️</span> Imprimir
                          </button>
                          <button type="button" class="dots-menu-item" data-action="reprint-queue-item" data-id="${item.id}">
                            <span>🔄</span> Reimprimir
                          </button>
                          <button type="button" class="dots-menu-item" data-action="duplicate-queue-item" data-id="${item.id}">
                            <span>📋</span> Duplicar
                          </button>
                          ${item.status === 'Aguardando' ? `
                            <button type="button" class="dots-menu-item" style="color: #d97706;" data-action="cancel-queue-item" data-id="${item.id}">
                              <span>❌</span> Cancelar
                            </button>
                          ` : ''}
                          <div style="border-top: 1px solid #f1f5f9; margin: 4px 0;"></div>
                          <button type="button" class="dots-menu-item" style="color: #ef4444;" data-action="delete-queue-item" data-id="${item.id}">
                            <span>🗑️</span> Excluir
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 4. SUBABA: CENTRAL DE DOCUMENTOS
// ==========================================
function renderDocumentosTab(settings) {
  const cfg = getDocumentConfigs();

  return `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <!-- CARD: MODELOS DE DOCUMENTOS OPERACIONAIS -->
      <div class="card" style="padding: 24px 28px; border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.6rem;">📄</span>
            <div>
              <h3 style="margin: 0; font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px;">MODELOS E FORMATOS DE DOCUMENTOS</h3>
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Personalize os campos, dimensões e dados de O.S., Cupons e Etiquetas</span>
            </div>
          </div>
          <span class="badge" style="background: rgba(219, 39, 119, 0.12); color: var(--border-focus, #db2777); font-size: 0.8125rem; font-weight: 700; padding: 5px 12px; border-radius: 16px;">
            4 Modelos Ativos
          </span>
        </div>

        <!-- SELEÇÃO DE MODELOS EM GRADE [ REGRA GLOBAL 1 ] -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
          <!-- 1. ORDEM DE SERVIÇO (O.S.) -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; cursor: pointer;" data-action="open-doc-card" data-doc-type="os">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.3rem;">📋</span>
                <div>
                  <h4 style="margin: 0; font-size: 0.8125rem; font-weight: 800; color: #334155; text-transform: uppercase;">Ordem de Serviço (O.S.)</h4>
                  <span style="font-size: 0.75rem; color: #64748b;">Ficha técnica e produção</span>
                </div>
              </div>
              <button type="button" data-preview-doc="os" class="btn btn-secondary text-xs px-2.5 py-1 flex items-center gap-1" onclick="event.stopPropagation()">
                <span>👁️</span> Visualizar
              </button>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.8125rem; color: #475569;" onclick="event.stopPropagation()">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" data-doc-type="os" data-key="showCustomer" class="form-checkbox" ${cfg.os?.showCustomer !== false ? 'checked' : ''} />
                <span>Exibir contato do cliente</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" data-doc-type="os" data-key="showPersonalization" class="form-checkbox" ${cfg.os?.showPersonalization !== false ? 'checked' : ''} />
                <span>Exibir campos de arte & personalização</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" data-doc-type="os" data-key="showSignatureLine" class="form-checkbox" ${cfg.os?.showSignatureLine !== false ? 'checked' : ''} />
                <span>Exibir linha para assinatura de retirada</span>
              </label>
            </div>
          </div>

          <!-- 2. CUPOM NÃO FISCAL -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; cursor: pointer;" data-action="open-doc-card" data-doc-type="receipt">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.3rem;">🧾</span>
                <div>
                  <h4 style="margin: 0; font-size: 0.8125rem; font-weight: 800; color: #334155; text-transform: uppercase;">Cupom Não Fiscal (Térmico)</h4>
                  <span style="font-size: 0.75rem; color: #64748b;">Comprovante e entrega</span>
                </div>
              </div>
              <button type="button" data-preview-doc="receipt" class="btn btn-secondary text-xs px-2.5 py-1 flex items-center gap-1" onclick="event.stopPropagation()">
                <span>👁️</span> Visualizar
              </button>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.8125rem; color: #475569;" onclick="event.stopPropagation()">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span>Largura do Cupom:</span>
                <select data-doc-type="receipt" data-key="format" class="form-select text-xs" style="padding: 4px 8px; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff;">
                  <option value="58mm" ${cfg.receipt?.format === '58mm' ? 'selected' : ''}>58 mm</option>
                  <option value="80mm" ${cfg.receipt?.format === '80mm' ? 'selected' : ''}>80 mm</option>
                </select>
              </div>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" data-doc-type="receipt" data-key="showFinancial" class="form-checkbox" ${cfg.receipt?.showFinancial !== false ? 'checked' : ''} />
                <span>Exibir resumo financeiro (Valor e saldo)</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" data-doc-type="receipt" data-key="showFooterMsg" class="form-checkbox" ${cfg.receipt?.showFooterMsg !== false ? 'checked' : ''} />
                <span>Exibir agradecimento no rodapé</span>
              </label>
            </div>
          </div>

          <!-- 3. ETIQUETA DE PRODUTO -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; cursor: pointer;" data-action="open-doc-card" data-doc-type="productLabel">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.3rem;">🏷️</span>
                <div>
                  <h4 style="margin: 0; font-size: 0.8125rem; font-weight: 800; color: #334155; text-transform: uppercase;">Etiqueta de Produto</h4>
                  <span style="font-size: 0.75rem; color: #64748b;">Identificação de embalagem</span>
                </div>
              </div>
              <button type="button" data-preview-doc="productLabel" class="btn btn-secondary text-xs px-2.5 py-1 flex items-center gap-1" onclick="event.stopPropagation()">
                <span>👁️</span> Visualizar
              </button>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.8125rem; color: #475569;" onclick="event.stopPropagation()">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span>Dimensão:</span>
                <select data-doc-type="productLabel" data-key="size" class="form-select text-xs" style="padding: 4px 8px; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff;">
                  <option value="50x30mm" ${cfg.productLabel?.size === '50x30mm' ? 'selected' : ''}>50 x 30 mm</option>
                  <option value="40x25mm" ${cfg.productLabel?.size === '40x25mm' ? 'selected' : ''}>40 x 25 mm</option>
                  <option value="60x40mm" ${cfg.productLabel?.size === '60x40mm' ? 'selected' : ''}>60 x 40 mm</option>
                </select>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" data-doc-type="productLabel" data-key="showCode" class="form-checkbox" ${cfg.productLabel?.showCode !== false ? 'checked' : ''} />
                  <span>Código</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" data-doc-type="productLabel" data-key="showName" class="form-checkbox" ${cfg.productLabel?.showName !== false ? 'checked' : ''} />
                  <span>Nome</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" data-doc-type="productLabel" data-key="showCustomer" class="form-checkbox" ${cfg.productLabel?.showCustomer !== false ? 'checked' : ''} />
                  <span>Cliente</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" data-doc-type="productLabel" data-key="showBarcode" class="form-checkbox" ${cfg.productLabel?.showBarcode !== false ? 'checked' : ''} />
                  <span>Cód. Barras</span>
                </label>
              </div>
            </div>
          </div>

          <!-- 4. ETIQUETA DE INSUMO -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; cursor: pointer;" data-action="open-doc-card" data-doc-type="materialLabel">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.3rem;">📦</span>
                <div>
                  <h4 style="margin: 0; font-size: 0.8125rem; font-weight: 800; color: #334155; text-transform: uppercase;">Etiqueta de Insumo</h4>
                  <span style="font-size: 0.75rem; color: #64748b;">Almoxarifado e estoque</span>
                </div>
              </div>
              <button type="button" data-preview-doc="materialLabel" class="btn btn-secondary text-xs px-2.5 py-1 flex items-center gap-1" onclick="event.stopPropagation()">
                <span>👁️</span> Visualizar
              </button>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.8125rem; color: #475569;" onclick="event.stopPropagation()">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                <span>Local Padrão:</span>
                <input type="text" data-doc-type="materialLabel" data-key="defaultLocation" class="form-input text-xs py-1" style="width: 160px;" value="${escapeHtml(cfg.materialLabel?.defaultLocation || 'Armário 02 · Gaveta 04')}" />
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" data-doc-type="materialLabel" data-key="showStock" class="form-checkbox" ${cfg.materialLabel?.showStock !== false ? 'checked' : ''} />
                  <span>Estoque/Mín</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" data-doc-type="materialLabel" data-key="showLocation" class="form-checkbox" ${cfg.materialLabel?.showLocation !== false ? 'checked' : ''} />
                  <span>Localização</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 5. SUBABA: ALERTAS & REGRAS
// ==========================================
function renderAlertasTab(settings) {
  const rules = getAlertsConfig();
  const liveAlerts = evaluateSystemAlerts();

  return `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <!-- CARD 1: PAINEL DE ALERTAS ATIVOS NO MOMENTO -->
      <div class="card" style="padding: 24px 28px; border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.6rem;">🔔</span>
            <div>
              <h3 style="margin: 0; font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px;">SUPERVISÃO OPERACIONAL E CONDIÇÕES REAIS</h3>
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Monitoramento de rupturas de estoque, atrasos de produção e inadimplências</span>
            </div>
          </div>
          <span class="badge" style="background: ${liveAlerts.length > 0 ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.12)'}; color: ${liveAlerts.length > 0 ? '#be123c' : '#047857'}; font-size: 0.8125rem; font-weight: 700; padding: 5px 12px; border-radius: 16px;">
            ${liveAlerts.length} Ocorrência(s)
          </span>
        </div>

        ${liveAlerts.length === 0 ? `
          <div style="padding: 28px; text-align: center; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; font-size: 0.8125rem; color: #166534;">
            <div style="font-size: 1.5rem; margin-bottom: 4px;">✅</div>
            <strong>Tudo em ordem!</strong> Nenhuma inconsistência operacional ou pendência crítica detectada no momento.
          </div>
        ` : `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
            ${liveAlerts.map(alert => `
              <div style="background: #ffffff; border: 1px solid #cbd5e1; border-left: 4px solid ${alert.priority === 'alta' ? '#f43f5e' : '#f59e0b'}; border-radius: 10px; padding: 16px 18px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-weight: 800; font-size: 0.8125rem; color: #1e293b;">${escapeHtml(alert.title)}</span>
                  <span style="padding: 2px 8px; border-radius: 12px; font-size: 0.6875rem; font-weight: 700; background: ${alert.priority === 'alta' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; color: ${alert.priority === 'alta' ? '#be123c' : '#b45309'};">
                    ${alert.count} caso(s)
                  </span>
                </div>
                <p style="margin: 0; font-size: 0.75rem; color: #475569;">${escapeHtml(alert.message)}</p>
                <div style="max-height: 90px; overflow-y: auto; background: #f8fafc; padding: 8px 10px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 0.75rem; display: flex; flex-direction: column; gap: 4px;">
                  ${alert.items.slice(0, 4).map(item => `
                    <div style="display: flex; justify-content: space-between; align-items: center; color: #334155;">
                      <span>• ${escapeHtml(item.name)}</span>
                      <span style="font-family: monospace; color: #64748b;">${escapeHtml(item.stock || item.detail || '')}</span>
                    </div>
                  `).join('')}
                  ${alert.items.length > 4 ? `
                    <div style="font-size: 0.6875rem; color: #94a3b8; font-style: italic; text-align: center;">+ ${alert.items.length - 4} outro(s)</div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- CARD 2: CONFIGURAÇÃO DE REGRAS DE ALERTAS -->
      <div class="card" style="padding: 24px 28px; border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.6rem;">⚙️</span>
            <div>
              <h3 style="margin: 0; font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px;">REGRAS E GATILHOS DO SISTEMA</h3>
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Ativação e ajuste de sensibilidade dos alertas automáticos</span>
            </div>
          </div>
        </div>

        <div style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; divide-y: 1px solid #f1f5f9;">
          ${rules.map(rule => `
            <div style="padding: 14px 18px; display: flex; flex-direction: column; sm:flex-direction: row; justify-content: space-between; align-items: flex-start; sm:align-items: center; gap: 12px; border-bottom: 1px solid #f1f5f9; background: #ffffff; font-size: 0.8125rem;">
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-weight: 700; color: #1e293b;">${escapeHtml(rule.name)}</span>
                  <span style="padding: 2px 8px; border-radius: 10px; font-size: 0.6875rem; font-weight: 700; background: ${rule.priority === 'alta' ? 'rgba(244, 63, 94, 0.12)' : 'rgba(245, 158, 11, 0.12)'}; color: ${rule.priority === 'alta' ? '#be123c' : '#b45309'};">
                    Prioridade ${escapeHtml(rule.priority)}
                  </span>
                </div>
                <p style="margin: 0; color: #64748b; font-size: 0.75rem;">${escapeHtml(rule.message)}</p>
                <div style="color: #94a3b8; font-family: monospace; font-size: 0.6875rem;">Condição: ${escapeHtml(rule.condition)}</div>
              </div>

              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 700; color: #334155;">
                <span>Ativo</span>
                <input type="checkbox" data-alert-id="${rule.id}" class="form-checkbox" ${rule.active ? 'checked' : ''} />
              </label>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 6. SUBABA: AUDITORIA E LOGS
// ==========================================
function renderAuditoriaTab(settings) {
  const logs = getAuditLogs({ module: auditFilterModule, search: auditSearchQuery });

  return `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <!-- CARD 1: AUDITORIA & REGISTROS INALTERÁVEIS -->
      <div class="card" style="padding: 24px 28px; border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <div style="display: flex; flex-direction: column; sm:flex-direction: row; justify-content: space-between; align-items: flex-start; sm:align-items: center; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.6rem;">📋</span>
            <div>
              <h3 style="margin: 0; font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px;">HISTÓRICO DE AUDITORIA & LOGS</h3>
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Registro cronológico detalhado de eventos operacionais, cadastros e exclusões</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <button id="btn-export-audit-csv" class="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
              <span>⬇</span> Exportar CSV
            </button>
            <button id="btn-export-audit-json" class="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
              <span>⬇</span> Exportar JSON
            </button>
          </div>
        </div>

        <!-- FILTROS DE AUDITORIA -->
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 14px; font-size: 0.8125rem;">
          <div style="flex: 1; min-width: 240px; position: relative;" class="search-wrapper">
            <span class="search-icon" style="position: absolute; left: 10px; font-size: 13px; color: #94a3b8; pointer-events: none; z-index: 2;">🔍</span>
            <input type="text" id="audit-search" class="search" style="width: 100%; padding-left: 30px; font-size: 0.8125rem; height: 34px; box-sizing: border-box;" placeholder="Filtrar por ação, registro, usuário ou texto..." value="${escapeHtml(auditSearchQuery)}" />
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="color: #64748b; white-space: nowrap;">Módulo:</label>
            <select id="audit-filter-module" class="form-select text-xs" style="padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff;">
              <option value="todos" ${auditFilterModule === 'todos' ? 'selected' : ''}>Todos os Módulos</option>
              <option value="Pedidos" ${auditFilterModule === 'Pedidos' ? 'selected' : ''}>Pedidos</option>
              <option value="Produção" ${auditFilterModule === 'Produção' ? 'selected' : ''}>Produção</option>
              <option value="Estoque" ${auditFilterModule === 'Estoque' ? 'selected' : ''}>Estoque</option>
              <option value="Financeiro" ${auditFilterModule === 'Financeiro' ? 'selected' : ''}>Financeiro</option>
              <option value="Impressão" ${auditFilterModule === 'Impressão' ? 'selected' : ''}>Impressão</option>
              <option value="Documentos" ${auditFilterModule === 'Documentos' ? 'selected' : ''}>Documentos</option>
              <option value="Sistema" ${auditFilterModule === 'Sistema' ? 'selected' : ''}>Sistema</option>
            </select>
          </div>
        </div>

        <!-- TABELA DE LOGS -->
        <div class="table-responsive" style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; background: #ffffff;">
          <div style="max-height: 480px; overflow-y: auto;">
            <table class="table" style="width: 100%; border-collapse: collapse; font-size: 0.8125rem; text-align: left;">
              <thead style="position: sticky; top: 0; background: #f8fafc; border-bottom: 1px solid #cbd5e1; z-index: 10;">
                <tr style="color: #475569; font-weight: 700;">
                  <th style="padding: 10px 14px;">Data / Hora</th>
                  <th style="padding: 10px 14px;">Módulo</th>
                  <th style="padding: 10px 14px;">Ação / Operação</th>
                  <th style="padding: 10px 14px;">Registro</th>
                  <th style="padding: 10px 14px;">Usuário</th>
                  <th style="padding: 10px 14px;">Detalhes</th>
                </tr>
              </thead>
              <tbody style="divide-y: 1px solid #f1f5f9;">
                ${logs.length === 0 ? `
                  <tr>
                    <td colspan="6" style="padding: 32px; text-align: center; color: #94a3b8;">
                      Nenhum log de auditoria encontrado com os filtros atuais.
                    </td>
                  </tr>
                ` : logs.map(l => `
                  <tr style="border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background-color 0.15s ease;" class="hover:bg-slate-50" data-action="view-audit-row" data-id="${l.id}" title="Clique para ver detalhes do evento">
                    <td style="padding: 10px 14px; font-family: monospace; font-size: 0.75rem; color: #64748b; white-space: nowrap;">
                      ${new Date(l.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td style="padding: 10px 14px;">
                      <span style="padding: 2px 8px; border-radius: 8px; font-size: 0.6875rem; font-weight: 700; background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0;">
                        ${escapeHtml(l.module)}
                      </span>
                    </td>
                    <td style="padding: 10px 14px; font-weight: 700; color: #1e293b;">
                      ${escapeHtml(l.operation || l.action)}
                    </td>
                    <td style="padding: 10px 14px; font-weight: 600; color: var(--border-focus, #db2777);">
                      ${escapeHtml(l.target || '-')}
                    </td>
                    <td style="padding: 10px 14px; color: #475569;">
                      ${escapeHtml(l.user || 'Operador')}
                    </td>
                    <td style="padding: 10px 14px; color: #64748b; font-size: 0.75rem;">
                      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px;">${escapeHtml(l.details || '-')}</span>
                        <span style="color: #94a3b8; font-weight: 700;">→</span>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 7. SUBABA: BACKUP E SEGURANÇA
// ==========================================
function renderBackupTab(settings) {
  const stats = getSystemDataStats();

  return `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <!-- CARD 1: ESTATÍSTICAS E VOLUMETRIA -->
      <div class="card" style="padding: 24px 28px; border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.6rem;">🛡️</span>
            <div>
              <h3 style="margin: 0; font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px;">BACKUP, RESTAURAÇÃO E SEGURANÇA</h3>
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Download de backups estruturados em JSON, validação de integridade e autosave</span>
            </div>
          </div>
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #047857; font-size: 0.8125rem; font-weight: 700; padding: 5px 12px; border-radius: 16px;">
            v1.0 · Integridade OK
          </span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 24px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center;">
            <div style="font-size: 1.25rem; font-weight: 800; color: #1e293b;">${stats.ordersCount}</div>
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Pedidos</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center;">
            <div style="font-size: 1.25rem; font-weight: 800; color: #1e293b;">${stats.productsCount}</div>
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Produtos</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center;">
            <div style="font-size: 1.25rem; font-weight: 800; color: #1e293b;">${stats.materialsCount}</div>
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Insumos</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center;">
            <div style="font-size: 1.25rem; font-weight: 800; color: #1e293b;">${stats.suppliersCount}</div>
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Fornecedores</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center;">
            <div style="font-size: 1.25rem; font-weight: 800; color: #1e293b;">${stats.purchasesCount}</div>
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Compras</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center;">
            <div style="font-size: 1.25rem; font-weight: 800; color: #1e293b;">${stats.printQueueCount}</div>
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Fila Impressão</div>
          </div>
        </div>

        <!-- AÇÕES DE EXPORTAR E RESTAURAR -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
          <!-- EXPORTAR BACKUP -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.4rem;">⬇</span>
              <div>
                <h4 style="margin: 0; font-size: 0.8125rem; font-weight: 800; color: #334155; text-transform: uppercase;">Exportar Backup Completo</h4>
                <span style="font-size: 0.75rem; color: #64748b;">Gera arquivo JSON com todas as coleções</span>
              </div>
            </div>

            <p style="margin: 0; font-size: 0.75rem; color: #475569;">
              Recomenda-se realizar o download do backup ao final do expediente ou antes de grandes movimentações.
            </p>

            <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 0.75rem;">
              <span style="color: #64748b;">
                Último: <strong>${stats.lastBackup ? new Date(stats.lastBackup).toLocaleString('pt-BR') : 'Nenhum'}</strong>
              </span>
              <button id="btn-export-full-backup" class="btn btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-xs">
                <span>⬇</span> Baixar JSON
              </button>
            </div>
          </div>

          <!-- RESTAURAR BACKUP -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.4rem;">⬆</span>
              <div>
                <h4 style="margin: 0; font-size: 0.8125rem; font-weight: 800; color: #334155; text-transform: uppercase;">Restaurar Dados</h4>
                <span style="font-size: 0.75rem; color: #64748b;">Carregar arquivo JSON previamente exportado</span>
              </div>
            </div>

            <p style="margin: 0; font-size: 0.75rem; color: #475569;">
              A restauração substitui as coleções atuais e valida a integridade antes de aplicar com rollback.
            </p>

            <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid #e2e8f0;">
              <input type="file" id="input-restore-file" accept=".json" class="hidden" />
              <span style="font-size: 0.75rem; color: #64748b; font-family: monospace;">${stats.systemVersion}</span>
              <button id="btn-trigger-restore" class="btn btn-secondary text-xs px-4 py-2 flex items-center gap-1.5 text-slate-700">
                <span>⬆</span> Selecionar JSON
              </button>
            </div>
          </div>
        </div>

        <!-- CARD 2: LIMPEZA DE DADOS / INICIAR PRODUÇÃO REAL -->
        <div style="margin-top: 24px; padding: 20px 24px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; display: flex; flex-direction: column; gap: 14px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.5rem;">🧹</span>
            <div>
              <h4 style="margin: 0; font-size: 0.875rem; font-weight: 800; color: #9f1239; text-transform: uppercase; letter-spacing: -0.2px;">Limpar Dados e Iniciar Uso Real</h4>
              <span style="font-size: 0.75rem; color: #be123c;">Remove todos os pedidos, produtos, insumos, compras e movimentações de teste, deixando o sistema 100% zerado e pronto para a sua produção diária.</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 12px; border-top: 1px solid #ffe4e6; flex-wrap: wrap; gap: 10px;">
            <span style="font-size: 0.75rem; color: #9f1239; font-weight: 600;">⚠️ Esta ação não apaga seus dados cadastrais de ateliê e empresa.</span>
            <button id="btn-wipe-system-data" class="btn text-xs px-4 py-2 flex items-center gap-1.5 font-bold shadow-xs" style="background: #e11d48; color: #ffffff; border: none; border-radius: 6px; cursor: pointer;">
              <span>🗑️</span> Limpar Dados do Sistema
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// EVENT HANDLERS & BINDINGS
// ==========================================

function attachSettingsEvents(container) {
  // 1. Alternância de Subabas [ REGRA GLOBAL 4 ]
  const tabsContainer = container.querySelector('#settings-binder-tabs');
  const binderTabButtons = tabsContainer 
    ? tabsContainer.querySelectorAll('.binder-tab[data-tab]') 
    : container.querySelectorAll('.binder-tab[data-tab], .settings-subtab[data-tab]');

  binderTabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const targetTab = btn.getAttribute('data-tab');
      if (targetTab && targetTab !== activeSettingsSubTab) {
        activeSettingsSubTab = targetTab;
        renderSettingsView(container);
      }
    });
  });

  // 2. Botão Rápido de Backup no Header
  const btnQuickBackup = container.querySelector('#btn-quick-export-backup');
  if (btnQuickBackup) {
    btnQuickBackup.addEventListener('click', () => {
      const res = exportBackup();
      if (res.success) {
        showToast('Backup JSON exportado com sucesso!', 'success');
      } else {
        showToast('Erro ao exportar backup.', 'error');
      }
    });
  }

  // 3. Salvar Identidade do Ateliê (Preferências)
  const formIdentity = container.querySelector('#form-settings-identity');
  if (formIdentity) {
    formIdentity.addEventListener('submit', (e) => {
      e.preventDefault();
      const updates = {
        atelierName: container.querySelector('#set-atelierName')?.value || '',
        ownerName: container.querySelector('#set-ownerName')?.value || '',
        phone: formatPhone(container.querySelector('#set-phone')?.value || ''),
        whatsapp: formatPhone(container.querySelector('#set-whatsapp')?.value || ''),
        email: container.querySelector('#set-email')?.value || '',
        instagram: container.querySelector('#set-instagram')?.value || '',
        docNumber: formatCPFOrCNPJ(container.querySelector('#set-docNumber')?.value || ''),
        logo: container.querySelector('#set-logo')?.value || '',
        address: container.querySelector('#set-address')?.value || '',
        docVisibility: {
          atelierName: container.querySelector('#vis-atelierName')?.checked !== false,
          ownerName: container.querySelector('#vis-ownerName')?.checked !== false,
          phone: container.querySelector('#vis-phone')?.checked !== false,
          whatsapp: container.querySelector('#vis-whatsapp')?.checked !== false,
          email: container.querySelector('#vis-email')?.checked !== false,
          instagram: container.querySelector('#vis-instagram')?.checked !== false,
          address: container.querySelector('#vis-address')?.checked !== false,
          docNumber: container.querySelector('#vis-docNumber')?.checked !== false,
          logo: container.querySelector('#vis-logo')?.checked !== false
        }
      };

      updateSettings(updates);
      showToast('Preferências e identidade do ateliê salvas!', 'success');
    });

    const btnUploadLogo = container.querySelector('#btn-upload-logo-fake');
    if (btnUploadLogo) {
      btnUploadLogo.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (ev) => {
          const file = ev.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (re) => {
              const url = re.target.result;
              const setLogoInput = container.querySelector('#set-logo');
              if (setLogoInput) {
                setLogoInput.value = url;
                updateSettings({ logo: url });
                showToast('Logo carregada com sucesso!', 'success');
              }
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      });
    }
  }

  // 4. Configurações de UI
  const themeSelect = container.querySelector('#ui-theme');
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      updateSettings({ theme: e.target.value });
      showToast(`Tema alterado para: ${e.target.value}`, 'info');
    });
  }

  const densitySelect = container.querySelector('#ui-density');
  if (densitySelect) {
    densitySelect.addEventListener('change', (e) => {
      updateSettings({ density: e.target.value });
      showToast(`Densidade visual ajustada para: ${e.target.value}`, 'info');
    });
  }

  const ledsSelect = container.querySelector('#ui-showLeds');
  if (ledsSelect) {
    ledsSelect.addEventListener('change', (e) => {
      updateSettings({ showLeds: e.target.value === 'true' });
      showToast('Configuração de LEDs operacionais atualizada!', 'info');
    });
  }

  const dateSelect = container.querySelector('#ui-dateFormat');
  if (dateSelect) {
    dateSelect.addEventListener('change', (e) => {
      updateSettings({ dateFormat: e.target.value });
      showToast('Formato de data salvo!', 'info');
    });
  }

  // 5. Switches de Automações
  container.querySelectorAll('input[data-group="automationSwitches"], select[data-group="automationSwitches"]').forEach(el => {
    el.addEventListener('change', (e) => {
      const key = e.target.getAttribute('data-key');
      const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      const cur = getSettings().automationSwitches || {};
      cur[key] = val;
      updateSettings({ automationSwitches: cur });
      showToast('Regra de automação atualizada!', 'success');
    });
  });

  // 6. Configurações de Impressora
  const formPrinter = container.querySelector('#form-settings-printer');
  if (formPrinter) {
    formPrinter.addEventListener('submit', (e) => {
      e.preventDefault();
      const updates = {
        printer: {
          defaultPrinter: container.querySelector('#prn-defaultPrinter')?.value || '',
          thermalWidth: container.querySelector('#prn-thermalWidth')?.value || '58mm',
          margins: container.querySelector('#prn-margins')?.value || '3mm',
          customHeader: container.querySelector('#prn-customHeader')?.value || '',
          customFooter: container.querySelector('#prn-customFooter')?.value || '',
          printLogo: container.querySelector('#prn-printLogo')?.value === 'true'
        },
        printBehavior: {
          autoSendToQueue: container.querySelector('#pb-autoSendToQueue')?.checked !== false,
          autoPrintWhenAvailable: container.querySelector('#pb-autoPrintWhenAvailable')?.checked === true,
          askBeforePrint: container.querySelector('#pb-askBeforePrint')?.checked !== false,
          allowReprint: container.querySelector('#pb-allowReprint')?.checked !== false
        }
      };

      updateSettings(updates);
      showToast('Configurações de impressão salvas com sucesso!', 'success');
    });
  }

  // 7. Ações da Fila de Impressão
  const btnOpenAddQueue = container.querySelector('#btn-open-add-queue');
  if (btnOpenAddQueue) {
    btnOpenAddQueue.addEventListener('click', () => {
      openAddPrintQueueDrawer(container);
    });
  }

  // Fechar dropdowns de três pontinhos ao clicar em qualquer lugar da tela
  const closeAllDotsMenus = () => {
    container.querySelectorAll('.dots-dropdown-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  };
  window.addEventListener('click', closeAllDotsMenus);

  // Ações em itens e linhas da fila [ REGRA GLOBAL 1 e 2 ]
  container.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', (e) => {
      const action = el.getAttribute('data-action');
      const itemId = el.getAttribute('data-id');

      if (action === 'toggle-dots-queue') {
        e.stopPropagation();
        const menu = container.querySelector(`#dots-queue-menu-${itemId}`);
        if (menu) {
          const isHidden = menu.style.display === 'none' || !menu.style.display;
          closeAllDotsMenus();
          if (isHidden) {
            menu.style.display = 'block';
          }
        }
        return;
      }

      if (action === 'view-queue-row') {
        e.stopPropagation();
        closeAllDotsMenus();
        const queue = getPrintQueue();
        const item = queue.find(q => q.id === itemId);
        if (item) {
          openPrintQueueItemDrawer(item, container);
        }
      } else if (action === 'preview-queue') {
        e.stopPropagation();
        closeAllDotsMenus();
        const queue = getPrintQueue();
        const item = queue.find(q => q.id === itemId);
        if (item) {
          openDocPreviewDrawer(getDocTypeFromLabel(item.documentType), item);
        }
      } else if (action === 'print-queue-item') {
        e.stopPropagation();
        closeAllDotsMenus();
        updatePrintQueueStatus(itemId, 'Impresso');
        showToast('Enviado para a impressora!', 'success');
        renderSettingsView(container);
        window.print();
      } else if (action === 'reprint-queue-item') {
        e.stopPropagation();
        closeAllDotsMenus();
        updatePrintQueueStatus(itemId, 'Impresso', 'Reimpresso');
        showToast('Reimpressão disparada!', 'info');
        renderSettingsView(container);
        window.print();
      } else if (action === 'duplicate-queue-item') {
        e.stopPropagation();
        closeAllDotsMenus();
        const duplicated = duplicatePrintQueueItem(itemId);
        if (duplicated) {
          showToast('Item duplicado com sucesso na fila!', 'success');
          renderSettingsView(container);
        }
      } else if (action === 'cancel-queue-item') {
        e.stopPropagation();
        closeAllDotsMenus();
        updatePrintQueueStatus(itemId, 'Cancelado');
        showToast('Item cancelado na fila.', 'info');
        renderSettingsView(container);
      } else if (action === 'delete-queue-item') {
        e.stopPropagation();
        closeAllDotsMenus();
        showConfirmDialog({
          title: 'Excluir da Fila',
          message: 'Deseja realmente remover este item da fila de impressão?',
          confirmText: 'Excluir',
          onConfirm: () => {
            deletePrintQueueItem(itemId);
            showToast('Item removido da fila.', 'info');
            renderSettingsView(container);
          }
        });
      } else if (action === 'view-audit-row') {
        e.stopPropagation();
        const logs = getAuditLogs({ module: auditFilterModule, search: auditSearchQuery });
        const log = logs.find(l => l.id === itemId);
        if (log) {
          openAuditLogDrawer(log);
        }
      } else if (action === 'open-doc-card') {
        e.stopPropagation();
        const docType = el.getAttribute('data-doc-type');
        if (docType) {
          openDocConfigDrawer(docType, container);
        }
      }
    });
  });

  // Imprimir todos pendentes
  const btnBatchPrint = container.querySelector('#btn-batch-print-queue');
  if (btnBatchPrint) {
    btnBatchPrint.addEventListener('click', () => {
      const queue = getPrintQueue();
      const pending = queue.filter(q => q.status === 'Aguardando');
      if (pending.length === 0) {
        showToast('Nenhum documento pendente na fila.', 'info');
        return;
      }

      pending.forEach(p => updatePrintQueueStatus(p.id, 'Impresso'));
      showToast(`${pending.length} documento(s) marcados como impressos!`, 'success');
      renderSettingsView(container);
      window.print();
    });
  }

  // Limpar concluídos
  const btnClearCompleted = container.querySelector('#btn-clear-completed-queue');
  if (btnClearCompleted) {
    btnClearCompleted.addEventListener('click', () => {
      const count = clearCompletedPrintQueue();
      showToast(`${count} item(ns) limpos da fila.`, 'info');
      renderSettingsView(container);
    });
  }

  // Filtros da Fila
  const queueSearchInput = container.querySelector('#queue-search');
  if (queueSearchInput) {
    queueSearchInput.addEventListener('input', (e) => {
      printQueueSearchQuery = e.target.value;
      renderSettingsView(container);
    });
  }

  const queueStatusFilter = container.querySelector('#queue-filter-status');
  if (queueStatusFilter) {
    queueStatusFilter.addEventListener('change', (e) => {
      printQueueFilterStatus = e.target.value;
      renderSettingsView(container);
    });
  }

  // 8. Visualização de Modelos de Documentos [ REGRA GLOBAL 3 ]
  container.querySelectorAll('[data-preview-doc]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const docType = btn.getAttribute('data-preview-doc');
      openDocPreviewDrawer(docType);
    });
  });

  // Modificação de configurações de documentos
  container.querySelectorAll('[data-doc-type]').forEach(el => {
    el.addEventListener('change', (e) => {
      const docType = e.target.getAttribute('data-doc-type');
      const key = e.target.getAttribute('data-key');
      const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;

      updateDocumentConfig(docType, { [key]: val });
      showToast('Configuração do modelo atualizada!', 'success');
    });
  });

  // 9. Regras de Alertas
  container.querySelectorAll('[data-alert-id]').forEach(el => {
    el.addEventListener('change', (e) => {
      const alertId = e.target.getAttribute('data-alert-id');
      const active = e.target.checked;
      updateAlertRule(alertId, { active });
      showToast(`Regra de alerta ${active ? 'ativada' : 'desativada'}!`, 'info');
    });
  });

  // 10. Auditoria e Logs Filtros & Exportações
  const auditSearchInput = container.querySelector('#audit-search');
  if (auditSearchInput) {
    auditSearchInput.addEventListener('input', (e) => {
      auditSearchQuery = e.target.value;
      renderSettingsView(container);
    });
  }

  const auditModuleFilter = container.querySelector('#audit-filter-module');
  if (auditModuleFilter) {
    auditModuleFilter.addEventListener('change', (e) => {
      auditFilterModule = e.target.value;
      renderSettingsView(container);
    });
  }

  const btnExportAuditCsv = container.querySelector('#btn-export-audit-csv');
  if (btnExportAuditCsv) {
    btnExportAuditCsv.addEventListener('click', () => {
      exportAuditLogsCSV();
      showToast('Logs exportados em CSV!', 'success');
    });
  }

  const btnExportAuditJson = container.querySelector('#btn-export-audit-json');
  if (btnExportAuditJson) {
    btnExportAuditJson.addEventListener('click', () => {
      exportAuditLogsJSON();
      showToast('Logs exportados em JSON!', 'success');
    });
  }

  // 11. Backup & Restauração
  const btnExportFull = container.querySelector('#btn-export-full-backup');
  if (btnExportFull) {
    btnExportFull.addEventListener('click', () => {
      const res = exportBackup();
      if (res.success) {
        showToast('Backup completo gerado e salvo!', 'success');
        renderSettingsView(container);
      } else {
        showToast('Erro ao exportar backup.', 'error');
      }
    });
  }

  const btnTriggerRestore = container.querySelector('#btn-trigger-restore');
  const inputRestoreFile = container.querySelector('#input-restore-file');
  if (btnTriggerRestore && inputRestoreFile) {
    btnTriggerRestore.addEventListener('click', () => {
      inputRestoreFile.click();
    });

    inputRestoreFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (re) => {
        const jsonContent = re.target.result;
        showConfirmDialog({
          title: 'Restaurar Dados do Sistema',
          message: 'ATENÇÃO: A restauração substituirá os registros atuais pelos dados contidos no arquivo de backup. Deseja prosseguir?',
          confirmText: 'Restaurar Backup',
          onConfirm: () => {
            const res = restoreBackup(jsonContent);
            if (res.success) {
              recordAuditLog({
                module: 'Sistema',
                action: 'Restauração de Backup',
                target: file.name,
                user: 'Operador',
                operation: `Backup "${file.name}" restaurado com sucesso.`
              });
              showToast('Dados restaurados com sucesso!', 'success');
              setTimeout(() => window.location.reload(), 800);
            } else {
              showToast(`Erro na restauração: ${res.error}`, 'error');
            }
          }
        });
      };
      reader.readAsText(file);
    });
  }

  // 12. Limpar Dados para Produção Real
  const btnWipeSystem = container.querySelector('#btn-wipe-system-data');
  if (btnWipeSystem) {
    btnWipeSystem.addEventListener('click', () => {
      showConfirmDialog({
        title: 'Limpar Dados e Iniciar Uso Real',
        message: 'Tem certeza que deseja apagar todos os pedidos, produtos, insumos, compras e movimentações de demonstração? Seus dados cadastrais de ateliê serão mantidos e o sistema ficará pronto para o seu uso real.',
        confirmText: 'Sim, Limpar Dados',
        danger: true,
        onConfirm: () => {
          clearAllSystemData(true);
          recordAuditLog({
            module: 'Sistema',
            action: 'Limpeza de Dados',
            target: 'Sistema',
            user: 'Administrador',
            operation: 'Base de dados inicializada para uso real em produção.'
          });
          bus.emit('orders:changed');
          bus.emit('products:changed');
          bus.emit('categories:changed');
          bus.emit('finance:changed');
          bus.emit('materials:changed');
          bus.emit('purchases:changed');
          showToast('Sistema limpo com sucesso! Pronto para produção.', 'success');
          renderSettingsView(container);
        }
      });
    });
  }
}

// ============================================================================
// PADRONIZAÇÃO DE DRAWERS [ REGRA GLOBAL 1, 2, 3 e 4 - AGENTS.md ]
// ============================================================================

/**
 * 1. DRAWER: Adicionar Item à Fila de Impressão
 */
export function openAddPrintQueueDrawer(container) {
  const orders = loadOrders();

  const contentHtml = `
    <form id="form-drawer-add-print-queue" class="space-y-5 text-xs">
      <div>
        <label class="block font-semibold text-slate-700 mb-1.5">Tipo de Documento</label>
        <select id="drawer-queue-input-doctype" class="form-input w-full" required>
          <option value="Ordem de Serviço (O.S.)">Ordem de Serviço (O.S.) - A4</option>
          <option value="Cupom Não Fiscal">Cupom Não Fiscal - Térmico</option>
          <option value="Etiquetas de Embalagem">Etiquetas de Embalagem</option>
          <option value="Etiquetas de Produto">Etiquetas de Produto</option>
          <option value="PDF Técnico & Gabarito">PDF Técnico & Gabarito</option>
        </select>
      </div>

      <div>
        <label class="block font-semibold text-slate-700 mb-1.5">Vincular a Pedido Existente</label>
        <select id="drawer-queue-input-order" class="form-input w-full">
          <option value="">Documento Avulso (Sem pedido vinculado)</option>
          ${orders.map(o => `
            <option value="${o.id}">Pedido ${o.number || o.id} - ${escapeHtml(o.customer || 'Cliente')} (${escapeHtml(o.productTitle || 'Item')})</option>
          `).join('')}
        </select>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block font-semibold text-slate-700 mb-1.5">Quantidade de Cópias / Vias</label>
          <input type="number" id="drawer-queue-input-qty" class="form-input w-full" value="1" min="1" max="500" required />
        </div>
        <div>
          <label class="block font-semibold text-slate-700 mb-1.5">Formato de Saída</label>
          <select id="drawer-queue-input-format" class="form-input w-full">
            <option value="A4">A4 Padrão</option>
            <option value="Térmico 58mm">Térmico 58mm</option>
            <option value="Térmico 80mm">Térmico 80mm</option>
            <option value="Etiqueta 50x30mm">Etiqueta 50x30mm</option>
            <option value="Etiqueta 100x150mm">Etiqueta 100x150mm</option>
          </select>
        </div>
      </div>

      <div>
        <label class="block font-semibold text-slate-700 mb-1.5">Observações Operacionais do Envio</label>
        <textarea id="drawer-queue-input-notes" class="form-input w-full" rows="3" placeholder="Ex: Impressão prioritária para bancada de corte e acabamento..."></textarea>
      </div>
    </form>
  `;

  const footerHtml = `
    <button type="button" id="btn-cancel-add-queue-drawer" class="btn btn-secondary text-xs px-4 py-2">
      Cancelar
    </button>
    <button type="button" id="btn-submit-add-queue-drawer" class="btn btn-primary text-xs px-4 py-2 flex items-center gap-1.5 font-semibold">
      <span>+</span> Enfileirar Documento
    </button>
  `;

  openDrawer({
    title: '🖨️ Adicionar à Fila de Impressão',
    contentHtml,
    footerHtml,
    onMount: (drawerBody) => {
      drawerBody.querySelector('#btn-cancel-add-queue-drawer')?.addEventListener('click', closeDrawer);

      drawerBody.querySelector('#btn-submit-add-queue-drawer')?.addEventListener('click', () => {
        const docType = drawerBody.querySelector('#drawer-queue-input-doctype')?.value;
        const orderId = drawerBody.querySelector('#drawer-queue-input-order')?.value;
        const qty = drawerBody.querySelector('#drawer-queue-input-qty')?.value;
        const format = drawerBody.querySelector('#drawer-queue-input-format')?.value;
        const notes = drawerBody.querySelector('#drawer-queue-input-notes')?.value;

        if (!docType) {
          showToast('Selecione o tipo de documento.', 'error');
          return;
        }

        let orderNumber = 'Documento Avulso';
        let orderTitle = '';
        let customer = '';

        if (orderId) {
          const targetOrder = orders.find(o => String(o.id) === String(orderId));
          if (targetOrder) {
            orderNumber = `Pedido ${targetOrder.number || targetOrder.id}`;
            orderTitle = targetOrder.productTitle || '';
            customer = targetOrder.customer || '';
          }
        }

        addPrintQueueItem({
          documentType: docType,
          orderId: orderId || null,
          orderNumber,
          orderTitle,
          customer,
          qty,
          format,
          notes
        });

        closeDrawer();
        showToast('Documento enfileirado com sucesso!', 'success');
        if (container) renderSettingsView(container);
      });
    }
  });
}

/**
 * 2. DRAWER: Consulta & Gestão do Item da Fila de Impressão [ REGRA GLOBAL 1 e 2 ]
 */
export function openPrintQueueItemDrawer(item, container) {
  let activeTab = 'resumo';
  const docTypeKey = getDocTypeFromLabel(item.documentType);

  const renderContent = () => `
    <div class="space-y-4">
      <!-- SUBMENU FICHÁRIO INTERNO DO DRAWER [ REGRA GLOBAL 4 ] -->
      <div class="binder-tabs" style="margin-bottom: 0;">
        <button id="queue-drawer-tab-resumo" class="binder-tab ${activeTab === 'resumo' ? 'active' : ''}">
          📄 Resumo do Trabalho
        </button>
        <button id="queue-drawer-tab-preview" class="binder-tab ${activeTab === 'preview' ? 'active' : ''}">
          👁️ Pré-visualização
        </button>
        <button id="queue-drawer-tab-edit" class="binder-tab ${activeTab === 'edit' ? 'active' : ''}">
          ✏️ Editar Registro
        </button>
      </div>

      <!-- PAINEL DA ABA ATIVA -->
      <div class="binder-panel bg-white p-5 rounded-b-xl border border-slate-200">
        ${activeTab === 'resumo' ? `
          <div class="space-y-4 text-xs">
            <div class="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
              <div>
                <span class="text-slate-400 block text-[11px]">Status Atual</span>
                <span class="font-bold text-slate-800 text-sm">${escapeHtml(item.status)}</span>
              </div>
              <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${item.status === 'Impresso' ? 'bg-emerald-100 text-emerald-800' : item.status === 'Aguardando' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}">
                ${escapeHtml(item.status)}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <span class="text-slate-400 block text-[11px]">Tipo de Documento</span>
                <span class="font-semibold text-slate-800">${escapeHtml(item.documentType)}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[11px]">Formato / Mídia</span>
                <span class="font-mono text-slate-700">${escapeHtml(item.format || 'A4')}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[11px]">Quantidade de Cópias</span>
                <span class="font-semibold text-slate-800">${item.qty || 1} via(s)</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[11px]">Data / Hora de Enfileiramento</span>
                <span class="text-slate-600">${new Date(item.createdAt).toLocaleString('pt-BR')}</span>
              </div>
            </div>

            <div class="border-t border-slate-100 pt-3">
              <span class="text-slate-400 block text-[11px] mb-1">Vínculo com Pedido</span>
              <div class="p-3 bg-blue-50/50 border border-blue-100 rounded-lg flex items-center justify-between">
                <div>
                  <div class="font-bold text-blue-900">${escapeHtml(item.orderNumber || 'Documento Avulso')}</div>
                  ${item.customer ? `<div class="text-slate-600 text-[11px]">Cliente: ${escapeHtml(item.customer)}</div>` : ''}
                  ${item.orderTitle ? `<div class="text-slate-500 text-[11px]">Item: ${escapeHtml(item.orderTitle)}</div>` : ''}
                </div>
                ${item.orderId ? `
                  <button id="btn-goto-order" class="btn btn-secondary text-xs px-2.5 py-1 text-blue-700 hover:bg-blue-100">
                    Ver Pedido →
                  </button>
                ` : ''}
              </div>
            </div>

            ${item.notes ? `
              <div class="border-t border-slate-100 pt-3">
                <span class="text-slate-400 block text-[11px] mb-1">Observações Operacionais</span>
                <p class="text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-100 leading-relaxed">${escapeHtml(item.notes)}</p>
              </div>
            ` : ''}
          </div>
        ` : activeTab === 'preview' ? `
          <div class="space-y-3">
            <div class="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span>Pré-visualização gerada a partir das configurações ativas do modelo:</span>
              <button id="btn-inner-print" class="btn btn-secondary text-xs px-2.5 py-1 flex items-center gap-1">
                <span>🖨️</span> Imprimir
              </button>
            </div>
            <div class="p-4 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto flex justify-center">
              <div class="bg-white shadow-md p-4 max-w-full rounded">
                ${generateDocumentHtml(docTypeKey, item)}
              </div>
            </div>
          </div>
        ` : `
          <!-- ABA EDITAR -->
          <form id="form-edit-queue-item" class="space-y-4 text-xs">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Status da Fila</label>
              <select id="edit-queue-status" class="form-input w-full">
                <option value="Aguardando" ${item.status === 'Aguardando' ? 'selected' : ''}>Aguardando</option>
                <option value="Em processamento" ${item.status === 'Em processamento' ? 'selected' : ''}>Em processamento</option>
                <option value="Impresso" ${item.status === 'Impresso' ? 'selected' : ''}>Impresso</option>
                <option value="Cancelado" ${item.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
              </select>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Cópias</label>
                <input type="number" id="edit-queue-qty" class="form-input w-full" value="${item.qty || 1}" min="1" max="500" />
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Formato</label>
                <select id="edit-queue-format" class="form-input w-full">
                  <option value="A4" ${item.format === 'A4' ? 'selected' : ''}>A4 Padrão</option>
                  <option value="Térmico 58mm" ${item.format === 'Térmico 58mm' ? 'selected' : ''}>Térmico 58mm</option>
                  <option value="Térmico 80mm" ${item.format === 'Térmico 80mm' ? 'selected' : ''}>Térmico 80mm</option>
                  <option value="Etiqueta 50x30mm" ${item.format === 'Etiqueta 50x30mm' ? 'selected' : ''}>Etiqueta 50x30mm</option>
                  <option value="Etiqueta 100x150mm" ${item.format === 'Etiqueta 100x150mm' ? 'selected' : ''}>Etiqueta 100x150mm</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Observações</label>
              <textarea id="edit-queue-notes" class="form-input w-full" rows="3">${escapeHtml(item.notes || '')}</textarea>
            </div>

            <div class="pt-2 flex justify-end">
              <button type="submit" class="btn btn-primary text-xs px-4 py-2">
                Salvar Alterações
              </button>
            </div>
          </form>
        `}
      </div>
    </div>
  `;

  const footerHtml = `
    <div class="flex items-center justify-between w-full">
      <button type="button" id="btn-drawer-delete-queue" class="btn btn-secondary text-xs px-3 py-1.5 text-rose-600 hover:bg-rose-50 border-rose-200 flex items-center gap-1">
        <span>🗑️</span> Excluir
      </button>

      <div class="flex items-center gap-2">
        <button type="button" id="btn-drawer-duplicate-queue" class="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
          <span>📋</span> Duplicar
        </button>
        <button type="button" id="btn-drawer-print-queue" class="btn btn-primary text-xs px-4 py-1.5 flex items-center gap-1">
          <span>🖨️</span> Imprimir Agora
        </button>
      </div>
    </div>
  `;

  const setupEvents = (drawerBody) => {
    // Subabas fichário
    drawerBody.querySelector('#queue-drawer-tab-resumo')?.addEventListener('click', () => {
      activeTab = 'resumo';
      updateDrawerContent();
    });
    drawerBody.querySelector('#queue-drawer-tab-preview')?.addEventListener('click', () => {
      activeTab = 'preview';
      updateDrawerContent();
    });
    drawerBody.querySelector('#queue-drawer-tab-edit')?.addEventListener('click', () => {
      activeTab = 'edit';
      updateDrawerContent();
    });

    // Ações internas
    drawerBody.querySelector('#btn-goto-order')?.addEventListener('click', () => {
      closeDrawer();
      switchView('pedidos');
    });

    drawerBody.querySelector('#btn-inner-print')?.addEventListener('click', () => {
      updatePrintQueueStatus(item.id, 'Impresso');
      if (container) renderSettingsView(container);
      window.print();
    });

    // Form de edição
    drawerBody.querySelector('#form-edit-queue-item')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const status = drawerBody.querySelector('#edit-queue-status')?.value;
      const qty = parseInt(drawerBody.querySelector('#edit-queue-qty')?.value, 10) || 1;
      const format = drawerBody.querySelector('#edit-queue-format')?.value;
      const notes = drawerBody.querySelector('#edit-queue-notes')?.value;

      updatePrintQueueItem(item.id, { status, qty, format, notes });
      item.status = status;
      item.qty = qty;
      item.format = format;
      item.notes = notes;

      showToast('Registro da fila atualizado com sucesso!', 'success');
      activeTab = 'resumo';
      updateDrawerContent();
      if (container) renderSettingsView(container);
    });

    // Footer actions
    drawerBody.querySelector('#btn-drawer-delete-queue')?.addEventListener('click', () => {
      showConfirmDialog({
        title: 'Excluir da Fila',
        message: 'Deseja realmente remover este item da fila de impressão?',
        confirmText: 'Excluir',
        onConfirm: () => {
          deletePrintQueueItem(item.id);
          closeDrawer();
          showToast('Item removido da fila.', 'info');
          if (container) renderSettingsView(container);
        }
      });
    });

    drawerBody.querySelector('#btn-drawer-duplicate-queue')?.addEventListener('click', () => {
      const duplicated = duplicatePrintQueueItem(item.id);
      if (duplicated) {
        closeDrawer();
        showToast('Item duplicado com sucesso na fila!', 'success');
        if (container) renderSettingsView(container);
      }
    });

    drawerBody.querySelector('#btn-drawer-print-queue')?.addEventListener('click', () => {
      updatePrintQueueStatus(item.id, 'Impresso');
      showToast('Impressão disparada!', 'success');
      if (container) renderSettingsView(container);
      window.print();
    });
  };

  const updateDrawerContent = () => {
    const bodyEl = document.getElementById('drawer-body');
    const drawer = document.getElementById('app-drawer');
    if (bodyEl) {
      bodyEl.innerHTML = renderContent();
      if (drawer) setupEvents(drawer);
    }
  };

  openDrawer({
    title: `${getDocumentIcon(item.documentType)} Detalhes da Impressão: ${item.documentType}`,
    contentHtml: renderContent(),
    footerHtml,
    onMount: (drawerBody) => {
      setupEvents(drawerBody);
    }
  });
}

/**
 * 3. DRAWER: Pré-visualização de Modelo de Documento [ REGRA GLOBAL 3 ]
 */
export function openDocPreviewDrawer(docType, record = null) {
  const titles = {
    os: 'Ordem de Serviço (O.S.)',
    receipt: 'Cupom Não Fiscal (Térmico)',
    productLabel: 'Etiqueta de Produto',
    materialLabel: 'Etiqueta de Insumo'
  };

  const icons = {
    os: '📋',
    receipt: '🧾',
    productLabel: '🏷️',
    materialLabel: '📦'
  };

  const title = titles[docType] || 'Documento';
  const icon = icons[docType] || '📄';
  const renderedHtml = generateDocumentHtml(docType, record);

  const contentHtml = `
    <div class="space-y-4">
      <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center justify-between">
        <span>Visualização fiel ao layout de impressão gerado pelo motor do PAPER MAX.</span>
        <span class="font-mono font-semibold text-slate-700">${docType === 'os' ? 'A4' : docType === 'receipt' ? 'Bobina Térmica' : 'Etiqueta Adesiva'}</span>
      </div>

      <div class="p-6 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto flex items-center justify-center">
        <div class="bg-white shadow-xl p-4 max-w-full rounded">
          ${renderedHtml}
        </div>
      </div>
    </div>
  `;

  const footerHtml = `
    <button type="button" id="btn-drawer-doc-preview-close" class="btn btn-secondary text-xs px-4 py-2">
      Fechar
    </button>
    <button type="button" id="btn-drawer-doc-preview-print" class="btn btn-primary text-xs px-4 py-2 flex items-center gap-1.5 font-semibold">
      <span>🖨️</span> Imprimir Teste
    </button>
  `;

  openDrawer({
    title: `${icon} Pré-visualização: ${title}`,
    contentHtml,
    footerHtml,
    onMount: (drawerBody) => {
      drawerBody.querySelector('#btn-drawer-doc-preview-close')?.addEventListener('click', closeDrawer);
      drawerBody.querySelector('#btn-drawer-doc-preview-print')?.addEventListener('click', () => {
        window.print();
      });
    }
  });
}

/**
 * 4. DRAWER: Consulta & Configuração de Modelo de Documento
 */
export function openDocConfigDrawer(docType, container) {
  const configs = getDocumentConfigs();
  const cfg = configs[docType] || {};

  const titles = {
    os: 'Ordem de Serviço (O.S.)',
    receipt: 'Cupom Não Fiscal (Térmico)',
    productLabel: 'Etiqueta de Produto',
    materialLabel: 'Etiqueta de Insumo'
  };

  const icons = {
    os: '📋',
    receipt: '🧾',
    productLabel: '🏷️',
    materialLabel: '📦'
  };

  let activeSubTab = 'parametros';

  const renderContent = () => `
    <div class="space-y-4">
      <div class="binder-tabs" style="margin-bottom: 0;">
        <button id="doc-tab-parametros" class="binder-tab ${activeSubTab === 'parametros' ? 'active' : ''}">
          ⚙️ Parâmetros do Modelo
        </button>
        <button id="doc-tab-preview" class="binder-tab ${activeSubTab === 'preview' ? 'active' : ''}">
          👁️ Pré-visualização em Tempo Real
        </button>
      </div>

      <div class="binder-panel bg-white p-5 rounded-b-xl border border-slate-200">
        ${activeSubTab === 'parametros' ? `
          <div class="space-y-5 text-xs text-slate-700">
            ${docType === 'os' ? `
              <div class="space-y-3">
                <h4 class="font-bold text-slate-800 uppercase tracking-wide text-[11px]">Opções de Exibição na O.S.</h4>
                <label class="flex items-center gap-2.5 p-2.5 bg-slate-50 border border-slate-100 rounded-lg cursor-pointer hover:bg-slate-100/70">
                  <input type="checkbox" id="cfg-showCustomer" class="form-checkbox" ${cfg.showCustomer !== false ? 'checked' : ''} />
                  <span>Exibir dados de contato e endereço do cliente</span>
                </label>
                <label class="flex items-center gap-2.5 p-2.5 bg-slate-50 border border-slate-100 rounded-lg cursor-pointer hover:bg-slate-100/70">
                  <input type="checkbox" id="cfg-showPersonalization" class="form-checkbox" ${cfg.showPersonalization !== false ? 'checked' : ''} />
                  <span>Exibir bloco técnico de arte & personalização gráfica</span>
                </label>
                <label class="flex items-center gap-2.5 p-2.5 bg-slate-50 border border-slate-100 rounded-lg cursor-pointer hover:bg-slate-100/70">
                  <input type="checkbox" id="cfg-showSignatureLine" class="form-checkbox" ${cfg.showSignatureLine !== false ? 'checked' : ''} />
                  <span>Exibir linha para assinatura no termo de retirada</span>
                </label>
              </div>
            ` : docType === 'receipt' ? `
              <div class="space-y-3">
                <div>
                  <label class="block font-semibold mb-1">Largura da Bobina Térmica:</label>
                  <select id="cfg-format" class="form-input w-full">
                    <option value="58mm" ${cfg.format === '58mm' ? 'selected' : ''}>58 mm (Estreita)</option>
                    <option value="80mm" ${cfg.format === '80mm' ? 'selected' : ''}>80 mm (Padrão)</option>
                  </select>
                </div>
                <label class="flex items-center gap-2.5 p-2.5 bg-slate-50 border border-slate-100 rounded-lg cursor-pointer hover:bg-slate-100/70">
                  <input type="checkbox" id="cfg-showFinancial" class="form-checkbox" ${cfg.showFinancial !== false ? 'checked' : ''} />
                  <span>Exibir demonstrativo financeiro (Valor pago e saldo restante)</span>
                </label>
                <label class="flex items-center gap-2.5 p-2.5 bg-slate-50 border border-slate-100 rounded-lg cursor-pointer hover:bg-slate-100/70">
                  <input type="checkbox" id="cfg-showFooterMsg" class="form-checkbox" ${cfg.showFooterMsg !== false ? 'checked' : ''} />
                  <span>Exibir mensagem institucional no rodapé</span>
                </label>
              </div>
            ` : docType === 'productLabel' ? `
              <div class="space-y-3">
                <div>
                  <label class="block font-semibold mb-1">Dimensão da Etiqueta:</label>
                  <select id="cfg-size" class="form-input w-full">
                    <option value="50x30mm" ${cfg.size === '50x30mm' ? 'selected' : ''}>50 x 30 mm</option>
                    <option value="40x25mm" ${cfg.size === '40x25mm' ? 'selected' : ''}>40 x 25 mm</option>
                    <option value="60x40mm" ${cfg.size === '60x40mm' ? 'selected' : ''}>60 x 40 mm</option>
                  </select>
                </div>
                <div class="grid grid-cols-2 gap-2 pt-2">
                  <label class="flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded cursor-pointer">
                    <input type="checkbox" id="cfg-showCode" class="form-checkbox" ${cfg.showCode !== false ? 'checked' : ''} />
                    <span>Código</span>
                  </label>
                  <label class="flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded cursor-pointer">
                    <input type="checkbox" id="cfg-showName" class="form-checkbox" ${cfg.showName !== false ? 'checked' : ''} />
                    <span>Nome</span>
                  </label>
                  <label class="flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded cursor-pointer">
                    <input type="checkbox" id="cfg-showCustomer" class="form-checkbox" ${cfg.showCustomer !== false ? 'checked' : ''} />
                    <span>Cliente</span>
                  </label>
                  <label class="flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded cursor-pointer">
                    <input type="checkbox" id="cfg-showBarcode" class="form-checkbox" ${cfg.showBarcode !== false ? 'checked' : ''} />
                    <span>Código de Barras</span>
                  </label>
                </div>
              </div>
            ` : `
              <div class="space-y-3">
                <div>
                  <label class="block font-semibold mb-1">Dimensão da Etiqueta:</label>
                  <select id="cfg-size" class="form-input w-full">
                    <option value="50x30mm" ${cfg.size === '50x30mm' ? 'selected' : ''}>50 x 30 mm</option>
                    <option value="100x50mm" ${cfg.size === '100x50mm' ? 'selected' : ''}>100 x 50 mm</option>
                  </select>
                </div>
                <div class="grid grid-cols-2 gap-2 pt-2">
                  <label class="flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded cursor-pointer">
                    <input type="checkbox" id="cfg-showSKU" class="form-checkbox" ${cfg.showSKU !== false ? 'checked' : ''} />
                    <span>Código SKU</span>
                  </label>
                  <label class="flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded cursor-pointer">
                    <input type="checkbox" id="cfg-showSupplier" class="form-checkbox" ${cfg.showSupplier !== false ? 'checked' : ''} />
                    <span>Fornecedor</span>
                  </label>
                </div>
              </div>
            `}
          </div>
        ` : `
          <div class="space-y-3">
            <div class="p-4 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto flex justify-center">
              <div class="bg-white shadow p-3 rounded">
                ${generateDocumentHtml(docType)}
              </div>
            </div>
          </div>
        `}
      </div>
    </div>
  `;

  const footerHtml = `
    <button type="button" id="btn-save-doc-cfg" class="btn btn-primary text-xs px-4 py-2 font-semibold">
      Salvar Preferências
    </button>
  `;

  const setupEvents = (drawerBody) => {
    drawerBody.querySelector('#doc-tab-parametros')?.addEventListener('click', () => {
      activeSubTab = 'parametros';
      updateContent();
    });
    drawerBody.querySelector('#doc-tab-preview')?.addEventListener('click', () => {
      activeSubTab = 'preview';
      updateContent();
    });

    drawerBody.querySelector('#btn-save-doc-cfg')?.addEventListener('click', () => {
      const updates = {};
      if (docType === 'os') {
        updates.showCustomer = drawerBody.querySelector('#cfg-showCustomer')?.checked;
        updates.showPersonalization = drawerBody.querySelector('#cfg-showPersonalization')?.checked;
        updates.showSignatureLine = drawerBody.querySelector('#cfg-showSignatureLine')?.checked;
      } else if (docType === 'receipt') {
        updates.format = drawerBody.querySelector('#cfg-format')?.value;
        updates.showFinancial = drawerBody.querySelector('#cfg-showFinancial')?.checked;
        updates.showFooterMsg = drawerBody.querySelector('#cfg-showFooterMsg')?.checked;
      } else if (docType === 'productLabel') {
        updates.size = drawerBody.querySelector('#cfg-size')?.value;
        updates.showCode = drawerBody.querySelector('#cfg-showCode')?.checked;
        updates.showName = drawerBody.querySelector('#cfg-showName')?.checked;
        updates.showCustomer = drawerBody.querySelector('#cfg-showCustomer')?.checked;
        updates.showBarcode = drawerBody.querySelector('#cfg-showBarcode')?.checked;
      } else if (docType === 'materialLabel') {
        updates.size = drawerBody.querySelector('#cfg-size')?.value;
        updates.showSKU = drawerBody.querySelector('#cfg-showSKU')?.checked;
        updates.showSupplier = drawerBody.querySelector('#cfg-showSupplier')?.checked;
      }

      updateDocumentConfig(docType, updates);
      showToast('Configurações do modelo salvas!', 'success');
      closeDrawer();
      if (container) renderSettingsView(container);
    });
  };

  const updateContent = () => {
    const bodyEl = document.getElementById('drawer-body');
    const drawer = document.getElementById('app-drawer');
    if (bodyEl) {
      bodyEl.innerHTML = renderContent();
      if (drawer) setupEvents(drawer);
    }
  };

  openDrawer({
    title: `${icons[docType] || '📄'} Modelo: ${titles[docType] || 'Documento'}`,
    contentHtml: renderContent(),
    footerHtml,
    onMount: (drawerBody) => {
      setupEvents(drawerBody);
    }
  });
}

/**
 * 5. DRAWER: Consulta Detalhada do Registro de Auditoria & Log [ REGRA GLOBAL 1 ]
 */
export function openAuditLogDrawer(log) {
  const contentHtml = `
    <div class="space-y-4 text-xs">
      <div class="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between">
        <div>
          <span class="text-slate-400 block text-[11px]">ID do Evento</span>
          <span class="font-mono text-slate-700 font-semibold">${escapeHtml(log.id)}</span>
        </div>
        <span class="px-2.5 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
          ${escapeHtml(log.module)}
        </span>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <span class="text-slate-400 block text-[11px]">Operação</span>
          <span class="font-bold text-slate-800">${escapeHtml(log.operation || log.action)}</span>
        </div>
        <div>
          <span class="text-slate-400 block text-[11px]">Data / Hora</span>
          <span class="font-mono text-slate-700">${new Date(log.timestamp).toLocaleString('pt-BR')}</span>
        </div>
        <div>
          <span class="text-slate-400 block text-[11px]">Registro Afetado</span>
          <span class="font-semibold text-blue-700">${escapeHtml(log.target || '-')}</span>
        </div>
        <div>
          <span class="text-slate-400 block text-[11px]">Usuário Executor</span>
          <span class="text-slate-700">${escapeHtml(log.user || 'Operador')}</span>
        </div>
      </div>

      <div class="border-t border-slate-100 pt-3">
        <span class="text-slate-400 block text-[11px] mb-1">Detalhamento Completo da Ação</span>
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap">
${escapeHtml(log.details || 'Sem detalhes adicionais gravados.')}
        </div>
      </div>
    </div>
  `;

  const footerHtml = `
    <button type="button" id="btn-copy-audit-log" class="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
      <span>📋</span> Copiar Dados
    </button>
    <button type="button" id="btn-close-audit-drawer" class="btn btn-primary text-xs px-4 py-1.5 font-semibold">
      Fechar
    </button>
  `;

  openDrawer({
    title: `📋 Detalhes do Evento de Auditoria`,
    contentHtml,
    footerHtml,
    onMount: (drawerBody) => {
      drawerBody.querySelector('#btn-close-audit-drawer')?.addEventListener('click', closeDrawer);
      drawerBody.querySelector('#btn-copy-audit-log')?.addEventListener('click', () => {
        navigator.clipboard.writeText(JSON.stringify(log, null, 2));
        showToast('Dados do evento copiados para a área de transferência!', 'success');
      });
    }
  });
}

function getDocumentIcon(docType) {
  if (!docType) return '📄';
  const d = docType.toLowerCase();
  if (d.includes('ordem') || d.includes('o.s')) return '📋';
  if (d.includes('cupom')) return '🧾';
  if (d.includes('etiqueta')) return '🏷️';
  if (d.includes('técnico') || d.includes('pdf')) return '📐';
  return '📄';
}

function getDocTypeFromLabel(label) {
  if (!label) return 'os';
  const l = label.toLowerCase();
  if (l.includes('ordem') || l.includes('o.s')) return 'os';
  if (l.includes('cupom')) return 'receipt';
  if (l.includes('produto')) return 'productLabel';
  if (l.includes('insumo') || l.includes('material')) return 'materialLabel';
  return 'os';
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
