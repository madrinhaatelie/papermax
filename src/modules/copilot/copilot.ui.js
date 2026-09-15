/**
 * PAPER MAX - Copilot UI & Drawer Module (Etapa 9)
 * Drawer compacto com Glassmorphism, histórico de chat, sugestões rápidas
 * e diferenciação clara entre DADO, ANÁLISE e SUGESTÃO.
 */

import { buildCopilotContextSnapshot } from './copilot.engine.js';
import { escapeHtml } from '../../utils/sanitize.js';

let chatHistory = [];
let isGenerating = false;

export function initCopilotUI() {
  // Remove any legacy trigger button from topbar if present
  const topbarBtn = document.querySelector('.topbar-right #btn-copilot-trigger');
  if (topbarBtn) {
    topbarBtn.remove();
  }

  // Inject discrete floating trigger button at bottom right (FAB) with star icon
  let floatingBtn = document.getElementById('btn-copilot-trigger');
  if (!floatingBtn) {
    floatingBtn = document.createElement('button');
    floatingBtn.id = 'btn-copilot-trigger';
    floatingBtn.className = 'btn-copilot-floating';
    floatingBtn.title = 'Copiloto IA';
    floatingBtn.setAttribute('aria-label', 'Copiloto IA');
    floatingBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="display:block;">
        <path d="M12 2l2.6 5.8 6.4.7-4.8 4.3 1.4 6.2L12 16.2 6.4 19.5l1.4-6.2-4.8-4.3 6.4-.7L12 2z"/>
      </svg>
    `;
    floatingBtn.addEventListener('click', openCopilotDrawer);
    floatingBtn.dataset.listenerAttached = 'true';
    document.body.appendChild(floatingBtn);
  } else {
    floatingBtn.className = 'btn-copilot-floating';
    floatingBtn.title = 'Copiloto IA';
    floatingBtn.setAttribute('aria-label', 'Copiloto IA');
    floatingBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="display:block;">
        <path d="M12 2l2.6 5.8 6.4.7-4.8 4.3 1.4 6.2L12 16.2 6.4 19.5l1.4-6.2-4.8-4.3 6.4-.7L12 2z"/>
      </svg>
    `;
    if (!floatingBtn.dataset.listenerAttached) {
      floatingBtn.addEventListener('click', openCopilotDrawer);
      floatingBtn.dataset.listenerAttached = 'true';
    }
  }

  // Inject Drawer HTML if not present
  if (!document.getElementById('copilot-drawer')) {
    const backdrop = document.createElement('div');
    backdrop.id = 'copilot-drawer';
    backdrop.className = 'app-drawer-backdrop';
    backdrop.innerHTML = `
      <div class="app-drawer-panel" style="max-width: 480px;">
        <div class="app-drawer-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">✨</span>
            <div>
              <h3 style="font-size:14px; font-weight:700;">Copiloto Inteligente PAPER MAX</h3>
              <p style="font-size:11px; color:var(--text-secondary);">Assistente operacional baseado nos dados reais do sistema</p>
            </div>
          </div>
          <button class="modal-close" id="copilot-close-btn">&times;</button>
        </div>
        
        <div class="app-drawer-body" id="copilot-chat-body" style="display:flex; flex-direction:column; gap:12px; background:var(--bg-canvas);">
          <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:10px; padding:14px; font-size:12px; color:var(--text-secondary); line-height:1.5;">
            <strong style="color:var(--text-primary); display:block; margin-bottom:4px;">Olá! Sou o seu copiloto operacional.</strong>
            Posso analisar pedidos, produção, estoque e financeiro em tempo real para responder suas dúvidas. Como posso ajudar hoje?
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:4px;">
            <button class="copilot-chip" data-query="O que preciso produzir hoje?">📦 O que preciso produzir hoje?</button>
            <button class="copilot-chip" data-query="Quais pedidos estão bloqueados?">🚫 Pedidos bloqueados</button>
            <button class="copilot-chip" data-query="Tenho material suficiente para hoje?">⚠️ Alertas de estoque</button>
            <button class="copilot-chip" data-query="Qual o resumo financeiro atual?">💰 Resumo financeiro</button>
          </div>

          <div id="copilot-messages" style="display:flex; flex-direction:column; gap:10px; flex:1; overflow-y:auto;"></div>
        </div>

        <div class="app-drawer-footer" style="background:var(--bg-surface); padding:12px 16px; display:flex; flex-direction:column; gap:8px;">
          <form id="copilot-form" style="display:flex; gap:8px; width:100%;">
            <input type="text" id="copilot-input" class="form-input" placeholder="Ex: Por que esse pedido está parado?..." style="flex:1; font-size:12px;" autocomplete="off" />
            <button type="submit" class="btn btn-primary" id="copilot-send-btn" style="padding:8px 14px;">Enviar</button>
          </form>
          <div style="font-size:10px; color:var(--text-muted); text-align:center;">
            A IA analisa dados reais e sugere ações. Não executa operações críticas automaticamente.
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    // Event listeners
    document.getElementById('copilot-close-btn').addEventListener('click', closeCopilotDrawer);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeCopilotDrawer();
    });

    document.getElementById('copilot-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('copilot-input');
      const text = input.value.trim();
      if (!text || isGenerating) return;
      input.value = '';
      sendCopilotMessage(text);
    });

    document.querySelectorAll('.copilot-chip').forEach(chip => {
      chip.style.cssText = 'background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:999px; padding:5px 10px; font-size:11px; color:var(--text-secondary); cursor:pointer; transition:all 0.15s ease;';
      chip.addEventListener('mouseenter', () => { chip.style.background = '#eef2ff'; chip.style.color = 'var(--accent-primary);'; });
      chip.addEventListener('mouseleave', () => { chip.style.background = 'var(--bg-surface)'; chip.style.color = 'var(--text-secondary);'; });
      chip.addEventListener('click', () => {
        const query = chip.getAttribute('data-query');
        if (query && !isGenerating) {
          sendCopilotMessage(query);
        }
      });
    });
  }
}

export function openCopilotDrawer() {
  const drawer = document.getElementById('copilot-drawer');
  if (drawer) {
    drawer.classList.add('active');
    const input = document.getElementById('copilot-input');
    if (input) input.focus();
  }
}

export function closeCopilotDrawer() {
  const drawer = document.getElementById('copilot-drawer');
  if (drawer) {
    drawer.classList.remove('active');
  }
}

async function sendCopilotMessage(text) {
  const messagesContainer = document.getElementById('copilot-messages');
  if (!messagesContainer) return;

  // Append user message
  const userMsgDiv = document.createElement('div');
  userMsgDiv.style.cssText = 'align-self:flex-end; background:var(--accent-primary); color:#ffffff; padding:10px 14px; border-radius:12px 12px 0 12px; max-width:85%; font-size:12px; line-height:1.4;';
  userMsgDiv.textContent = text;
  messagesContainer.appendChild(userMsgDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  chatHistory.push({ role: 'user', text });

  // Append loading bubble
  isGenerating = true;
  const sendBtn = document.getElementById('copilot-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'copilot-loading';
  loadingDiv.style.cssText = 'align-self:flex-start; background:var(--bg-surface); border:1px solid var(--border-subtle); color:var(--text-secondary); padding:10px 14px; border-radius:12px 12px 12px 0; font-size:12px; display:flex; align-items:center; gap:8px;';
  loadingDiv.innerHTML = `<span class="save-dot-saving">⏳</span> Analisando dados do sistema...`;
  messagesContainer.appendChild(loadingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    const contextData = buildCopilotContextSnapshot();

    const response = await fetch('/api/copilot/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: chatHistory.slice(0, -1), // previous history
        contextData
      })
    });

    const data = await response.json();
    loadingDiv.remove();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Erro ao comunicar com o servidor');
    }

    const replyText = data.reply || 'Sem resposta.';
    chatHistory.push({ role: 'model', text: replyText });

    const modelMsgDiv = document.createElement('div');
    modelMsgDiv.style.cssText = 'align-self:flex-start; background:var(--bg-surface); border:1px solid var(--border-subtle); color:var(--text-primary); padding:12px 16px; border-radius:12px 12px 12px 0; max-width:92%; font-size:12px; line-height:1.5; box-shadow:0 2px 6px rgba(15,23,42,0.03);';
    
    // Format response text with nice styling for DADO, ANÁLISE, SUGESTÃO
    let formattedHtml = escapeHtml(replyText)
      .replace(/📌 DADO:/g, '<strong style="color:var(--accent-primary); display:block; margin-top:6px;">📌 DADO:</strong>')
      .replace(/🔍 ANÁLISE:/g, '<strong style="color:#2563eb; display:block; margin-top:6px;">🔍 ANÁLISE:</strong>')
      .replace(/💡 SUGESTÃO:/g, '<strong style="color:#059669; display:block; margin-top:6px;">💡 SUGESTÃO:</strong>')
      .replace(/\n/g, '<br>');

    modelMsgDiv.innerHTML = formattedHtml;
    messagesContainer.appendChild(modelMsgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

  } catch (err) {
    if (document.getElementById('copilot-loading')) {
      document.getElementById('copilot-loading').remove();
    }
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'align-self:flex-start; background:#fef2f2; border:1px solid #fecaca; color:#991b1b; padding:10px 14px; border-radius:12px; font-size:12px; max-width:90%;';
    errorDiv.innerHTML = `<strong>Aviso do Copiloto:</strong> ${escapeHtml(err.message)}`;
    messagesContainer.appendChild(errorDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  } finally {
    isGenerating = false;
    if (sendBtn) sendBtn.disabled = false;
  }
}
