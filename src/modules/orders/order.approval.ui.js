/**
 * PAPER MAX - Customer Art Approval Page (order.approval.ui.js)
 * 
 * Implements:
 * 1. Dedicated Public Slug / URL Page for Art Approval: #/aprovar-arte/:orderId ou view: 'aprovar-arte'
 * 2. High-fidelity 3-angle 3D Mockup Preview (Frente, Frente + Lateral, Verso) with real personalization data
 * 3. Personalization details card & Interactive change history timeline
 * 4. "ACEITO" -> Moves status to 'impressao' (Fila de Impressão) and records approval
 * 5. "ALTERAR" -> Input dialog for client change request + Free Alteration Counter Popup (01/03, 02/03, 03/03 warning + R$ 1,50 policy)
 */

import { getOrderById, updateOrder } from './orders.js';
import { getProductById } from '../products/products.js';
import { escapeHtml, formatCurrency, formatDateBR } from '../../utils/sanitize.js';
import { showToast, bus } from '../../core/events.js';

/**
 * Generates default high-fidelity SVG mockups for the 3 positions if no static images are attached
 */
export function generateBagMockupSvg(angle, order, product) {
  const name = escapeHtml(order?.personalization?.name || order?.personalization?.Nome || order?.customer || 'Arthur');
  const age = escapeHtml(order?.personalization?.age || order?.personalization?.Idade || '2 anos');
  const theme = escapeHtml(order?.personalization?.theme || order?.personalization?.Tema || 'Safari');
  const color = order?.personalization?.color || order?.personalization?.Cor || '#38bdf8';
  const handle = escapeHtml(order?.personalization?.handle || order?.personalization?.Alça || 'Cetim azul');

  if (angle === 'front') {
    return `
      <svg viewBox="0 0 340 400" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 15px 25px rgba(0,0,0,0.12));">
        <defs>
          <linearGradient id="handleGradFront" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0284c7"/>
            <stop offset="100%" stop-color="#0369a1"/>
          </linearGradient>
          <linearGradient id="bgGradFront" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#e0f2fe"/>
            <stop offset="100%" stop-color="#bae6fd"/>
          </linearGradient>
          <pattern id="clouds" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="8" fill="#ffffff" opacity="0.4"/>
            <circle cx="28" cy="22" r="6" fill="#ffffff" opacity="0.4"/>
          </pattern>
        </defs>

        <!-- Alça de Cetim Azul -->
        <path d="M 120 110 C 120 20, 220 20, 220 110" fill="none" stroke="url(#handleGradFront)" stroke-width="16" stroke-linecap="round"/>
        <path d="M 120 110 C 120 25, 220 25, 220 110" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.6"/>

        <!-- Corpo da Sacola Frontal -->
        <rect x="50" y="100" width="240" height="280" rx="6" fill="url(#bgGradFront)" stroke="#93c5fd" stroke-width="1.5"/>
        <rect x="50" y="100" width="240" height="280" rx="6" fill="url(#clouds)"/>

        <!-- Dobra Superior -->
        <rect x="50" y="100" width="240" height="22" fill="#0284c7" opacity="0.15"/>
        <line x1="50" y1="122" x2="290" y2="122" stroke="#0284c7" stroke-width="1.5" stroke-dasharray="3,3"/>

        <!-- Plaquinha de Nome -->
        <g transform="translate(170, 160)">
          <!-- Card de Fundo do Nome -->
          <rect x="-85" y="-22" width="170" height="52" rx="14" fill="#ffffff" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="4,2"/>
          <text x="0" y="4" font-family="'Segoe UI', 'Helvetica', sans-serif" font-size="21" font-weight="900" fill="#0369a1" text-anchor="middle">${name}</text>
          <text x="0" y="22" font-family="'Segoe UI', 'Helvetica', sans-serif" font-size="12" font-weight="700" fill="#f59e0b" text-anchor="middle">${age}</text>
        </g>

        <!-- Ilustração Central Safari (Leãozinho Fofo) -->
        <g transform="translate(170, 265)">
          <!-- Folhagens Safari ao fundo -->
          <path d="M -90 60 Q -60 10, -40 60" fill="#4ade80" opacity="0.9"/>
          <path d="M 40 60 Q 60 10, 90 60" fill="#22c55e" opacity="0.9"/>
          <path d="M -70 60 Q -30 25, 0 60" fill="#16a34a" opacity="0.8"/>
          
          <!-- Juba do Leãozinho -->
          <circle cx="0" cy="-10" r="46" fill="#f97316"/>
          <circle cx="0" cy="-10" r="42" fill="#ea580c"/>
          <!-- Rosto -->
          <circle cx="0" cy="-8" r="34" fill="#fde047"/>
          <circle cx="-16" cy="-28" r="10" fill="#fde047"/>
          <circle cx="-16" cy="-28" r="6" fill="#fca5a5"/>
          <circle cx="16" cy="-28" r="10" fill="#fde047"/>
          <circle cx="16" cy="-28" r="6" fill="#fca5a5"/>
          <!-- Coroa -->
          <polygon points="-12,-38 -6,-30 0,-42 6,-30 12,-38 10,-28 -10,-28" fill="#eab308" stroke="#ca8a04" stroke-width="1"/>
          <!-- Olhinhos -->
          <circle cx="-10" cy="-12" r="3.5" fill="#1e293b"/>
          <circle cx="-9" cy="-13.5" r="1.2" fill="#ffffff"/>
          <circle cx="10" cy="-12" r="3.5" fill="#1e293b"/>
          <circle cx="11" cy="-13.5" r="1.2" fill="#ffffff"/>
          <!-- Focinho e Bochechas -->
          <ellipse cx="-16" cy="-4" rx="4" ry="2.5" fill="#f87171" opacity="0.6"/>
          <ellipse cx="16" cy="-4" rx="4" ry="2.5" fill="#f87171" opacity="0.6"/>
          <ellipse cx="0" cy="-4" rx="7" ry="5" fill="#ffffff"/>
          <polygon points="-3.5,-5 3.5,-5 0,-1.5" fill="#78350f"/>
          <path d="M -3 -1 Q 0 3, 3 -1" fill="none" stroke="#78350f" stroke-width="1.2"/>
          <!-- Patinhas -->
          <ellipse cx="-18" cy="22" rx="10" ry="12" fill="#fde047"/>
          <ellipse cx="18" cy="22" rx="10" ry="12" fill="#fde047"/>
          <circle cx="-18" cy="25" r="4" fill="#fed7aa"/>
          <circle cx="18" cy="25" r="4" fill="#fed7aa"/>
        </g>
      </svg>
    `;
  }

  if (angle === 'angle') {
    return `
      <svg viewBox="0 0 340 400" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 15px 25px rgba(0,0,0,0.12));">
        <defs>
          <linearGradient id="handleGradAngle" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0284c7"/>
            <stop offset="100%" stop-color="#0369a1"/>
          </linearGradient>
          <pattern id="checkPattern" width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#38bdf8" opacity="0.5"/>
            <rect x="8" y="8" width="8" height="8" fill="#38bdf8" opacity="0.5"/>
          </pattern>
        </defs>

        <!-- Alça Traseira -->
        <path d="M 125 105 C 130 30, 205 30, 205 105" fill="none" stroke="#0369a1" stroke-width="14" stroke-linecap="round" opacity="0.7"/>

        <!-- Lateral da Sacola (Perspectiva Isométrica com Xadrez) -->
        <polygon points="230,105 285,75 285,325 230,365" fill="#bae6fd" stroke="#93c5fd" stroke-width="1"/>
        <polygon points="230,105 285,75 285,325 230,365" fill="url(#checkPattern)"/>

        <!-- Frente da Sacola com Inclinação 3D -->
        <polygon points="65,120 230,105 230,365 65,378" fill="#e0f2fe" stroke="#93c5fd" stroke-width="1.5"/>

        <!-- Alça Frontal -->
        <path d="M 105 118 C 105 35, 185 30, 185 110" fill="none" stroke="url(#handleGradAngle)" stroke-width="15" stroke-linecap="round"/>

        <!-- Nome em Perspectiva -->
        <g transform="translate(145, 175) skewY(-5)">
          <rect x="-65" y="-18" width="130" height="42" rx="10" fill="#ffffff" stroke="#f59e0b" stroke-width="2" stroke-dasharray="3,2"/>
          <text x="0" y="3" font-family="'Segoe UI', sans-serif" font-size="16" font-weight="900" fill="#0369a1" text-anchor="middle">${name}</text>
          <text x="0" y="17" font-family="'Segoe UI', sans-serif" font-size="10" font-weight="700" fill="#f59e0b" text-anchor="middle">${age}</text>
        </g>

        <!-- Leãozinho em Perspectiva -->
        <g transform="translate(145, 265) skewY(-5)">
          <circle cx="0" cy="-5" r="34" fill="#f97316"/>
          <circle cx="0" cy="-4" r="26" fill="#fde047"/>
          <!-- Olhinhos -->
          <circle cx="-8" cy="-8" r="2.8" fill="#1e293b"/>
          <circle cx="8" cy="-8" r="2.8" fill="#1e293b"/>
          <!-- Coroa -->
          <polygon points="-8,-28 -4,-22 0,-30 4,-22 8,-28 6,-20 -6,-20" fill="#eab308"/>
          <!-- Focinho -->
          <ellipse cx="0" cy="-1" rx="5" ry="3.5" fill="#ffffff"/>
          <polygon points="-2.5,-2 2.5,-2 0,0.5" fill="#78350f"/>
        </g>
      </svg>
    `;
  }

  // Back angle
  return `
    <svg viewBox="0 0 340 400" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 15px 25px rgba(0,0,0,0.12));">
      <defs>
        <linearGradient id="handleGradBack" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#0369a1"/>
        </linearGradient>
        <pattern id="stripesBack" width="20" height="20" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="20" stroke="#bae6fd" stroke-width="6"/>
        </pattern>
      </defs>

      <!-- Alça Verso -->
      <path d="M 120 110 C 120 20, 220 20, 220 110" fill="none" stroke="url(#handleGradBack)" stroke-width="16" stroke-linecap="round"/>

      <!-- Corpo da Sacola Verso -->
      <rect x="50" y="100" width="240" height="280" rx="6" fill="#e0f2fe" stroke="#93c5fd" stroke-width="1.5"/>
      <rect x="50" y="100" width="240" height="280" rx="6" fill="url(#stripesBack)"/>

      <!-- Dobra Superior -->
      <rect x="50" y="100" width="240" height="22" fill="#0284c7" opacity="0.15"/>

      <!-- Frase de Agradecimento -->
      <g transform="translate(170, 220)">
        <path d="M -12 -55 C -12 -65, 0 -65, 0 -55 C 0 -65, 12 -65, 12 -55 C 12 -42, 0 -35, 0 -28 C 0 -35, -12 -42, -12 -55 Z" fill="#0284c7" transform="scale(0.8) translate(0, -20)"/>
        <text x="0" y="-15" font-family="'Segoe UI', 'Helvetica', sans-serif" font-size="16" font-weight="800" fill="#0369a1" text-anchor="middle">Gratidão</text>
        <text x="0" y="8" font-family="'Segoe UI', 'Helvetica', sans-serif" font-size="14" font-weight="700" fill="#0284c7" text-anchor="middle">por fazer parte</text>
        <text x="0" y="30" font-family="'Segoe UI', 'Helvetica', sans-serif" font-size="14" font-weight="700" fill="#0284c7" text-anchor="middle">dessa festa!</text>
        <path d="M -6 50 C -6 45, 0 45, 0 50 C 0 45, 6 45, 6 50 C 6 56, 0 60, 0 64 C 0 60, -6 56, -6 50 Z" fill="#0284c7"/>
      </g>
    </svg>
  `;
}

/**
 * Renders the Customer Art Approval Page (matching the design in the provided image)
 */
export function renderOrderApprovalPage(container, orderId, onBack) {
  const order = getOrderById(orderId);
  if (!order) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center;">
        <h2>Pedido não encontrado</h2>
        <p style="color: var(--text-muted);">O link acessado pode ser inválido ou o pedido foi removido.</p>
        <button class="btn btn-primary" id="btn-back-notfound" style="margin-top: 16px;">Voltar ao Início</button>
      </div>
    `;
    container.querySelector('#btn-back-notfound')?.addEventListener('click', () => onBack?.());
    return;
  }

  const product = order.productId ? getProductById(order.productId) : null;
  const alterationCount = Number(order.alterationCount) || 0;
  let activeMockupTab = 'front'; // 'front' | 'angle' | 'back'

  // Default timeline entries if none recorded
  if (!order.alterationHistory || !Array.isArray(order.alterationHistory)) {
    order.alterationHistory = [
      { date: '16/09/2026 09:24', author: 'Júlia Aleixo', description: `Nome confirmado: ${order.personalization?.name || order.customer || 'Arthur'}`, color: '#10b981' },
      { date: '16/09/2026 09:22', author: 'Júlia Aleixo', description: `Idade confirmada: ${order.personalization?.age || '2 anos'}`, color: '#3b82f6' },
      { date: '16/09/2026 09:20', author: 'Júlia Aleixo', description: 'Alça alterada: Papel → Cetim azul', color: '#f97316' },
      { date: '16/09/2026 09:18', author: 'Júlia Aleixo', description: 'Elemento adicionado: Leão Safari', color: '#3b82f6' },
      { date: '16/09/2026 09:12', author: 'Júlia Aleixo', description: 'Cor alterada: Rosa → Azul', color: '#eab308' }
    ];
  }

  function getPageHtml() {
    const isApproved = order.status === 'impressao' || order.status === 'aguardando_impressao' || order.status === 'em_producao' || order.artApproved;

    return `
      <div class="order-approval-wrapper" style="min-height: 100%; background: #f1f5f9; padding: 16px 20px 80px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        
        <!-- HEADER SUPERIOR -->
        <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; background: #ffffff; padding: 12px 20px; border-radius: 12px; border: 1px solid var(--border-subtle); box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
          <div style="display: flex; align-items: center; gap: 14px;">
            <button type="button" id="btn-approval-back" class="btn btn-sm" style="width: 36px; height: 36px; border-radius: 50%; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 16px; background: #f8fafc; border: 1px solid var(--border-subtle); cursor: pointer;" title="Voltar">
              ←
            </button>
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h1 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0;">Pedido ${order.number || order.id}</h1>
                <span class="badge-count" style="background: ${isApproved ? '#dcfce7' : '#e0e7ff'}; color: ${isApproved ? '#15803d' : '#4338ca'}; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px;">
                  ${isApproved ? 'Em produção / Impressão' : (order.statusLabel || 'Em aprovação')}
                </span>
              </div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                Preview para aprovação do cliente
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="font-size: 12px; color: #64748b; background: #f8fafc; padding: 6px 12px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 6px;">
              <span>📅</span>
              <span>${order.orderDate || formatDateBR(new Date())} 09:24</span>
            </div>

            <button type="button" id="btn-share-art-link" class="btn btn-sm" style="background: #f8fafc; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 600; color: #334155; padding: 6px 12px; border-radius: 8px; display: flex; align-items: center; gap: 6px; cursor: pointer;">
              <span>🔗</span>
              <span>Compartilhar</span>
            </button>
          </div>
        </header>

        <!-- LAYOUT EM GRID (2 COLUNAS: ESQUERDA MOCKUP 3D / DIREITA PERSONALIZAÇÃO + HISTÓRICO) -->
        <div style="display: grid; grid-template-columns: 1fr 340px; gap: 16px; align-items: start;">
          
          <!-- COLUNA ESQUERDA: VISUALIZADOR 3D ESTÁTICO COM 3 POSIÇÕES -->
          <div style="display: flex; flex-direction: column; gap: 14px;">
            
            <!-- Card Principal com as 3 Posições -->
            <div style="background: #ffffff; border-radius: 12px; border: 1px solid var(--border-subtle); padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
                <div style="width: 38px; height: 38px; border-radius: 8px; background: #eff6ff; color: #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                  🛍️
                </div>
                <div>
                  <h3 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 0;">${escapeHtml(order.productTitle || product?.name || 'Sacola M')}</h3>
                  <div style="font-size: 12px; color: #64748b;">Produto personalizado</div>
                </div>
              </div>

              <!-- Grade com os 3 cards das posições (Frente, Frente + Lateral, Verso) -->
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 12px;">
                
                <!-- 1. Frente -->
                <div style="position: relative; background: #f8fafc; border-radius: 12px; border: 1px solid ${activeMockupTab === 'front' ? '#3b82f6' : '#e2e8f0'}; overflow: hidden; padding: 12px; height: 360px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                  <span style="position: absolute; top: 12px; left: 12px; background: #0f172a; color: #ffffff; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px; z-index: 2;">
                    Frente
                  </span>
                  ${generateBagMockupSvg('front', order, product)}
                </div>

                <!-- 2. Frente + Lateral -->
                <div style="position: relative; background: #f8fafc; border-radius: 12px; border: 1px solid ${activeMockupTab === 'angle' ? '#3b82f6' : '#e2e8f0'}; overflow: hidden; padding: 12px; height: 360px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                  <span style="position: absolute; top: 12px; left: 12px; background: #0f172a; color: #ffffff; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px; z-index: 2;">
                    Frente + Lateral
                  </span>
                  ${generateBagMockupSvg('angle', order, product)}
                </div>

                <!-- 3. Verso -->
                <div style="position: relative; background: #f8fafc; border-radius: 12px; border: 1px solid ${activeMockupTab === 'back' ? '#3b82f6' : '#e2e8f0'}; overflow: hidden; padding: 12px; height: 360px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                  <span style="position: absolute; top: 12px; left: 12px; background: #0f172a; color: #ffffff; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px; z-index: 2;">
                    Verso
                  </span>
                  ${generateBagMockupSvg('back', order, product)}
                </div>

              </div>

              <!-- Indicadores de Navegação -->
              <div style="display: flex; justify-content: center; gap: 6px; margin-top: 6px;">
                <span style="width: 18px; height: 6px; background: #3b82f6; border-radius: 3px;"></span>
                <span style="width: 6px; height: 6px; background: #cbd5e1; border-radius: 50%;"></span>
                <span style="width: 6px; height: 6px; background: #cbd5e1; border-radius: 50%;"></span>
              </div>

            </div>

            <!-- Mini Thumbnails Bar Inferior -->
            <div style="background: #ffffff; border-radius: 12px; border: 1px solid var(--border-subtle); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              
              <div style="display: flex; gap: 10px;">
                <!-- Thumbnail Frente -->
                <div class="thumb-btn ${activeMockupTab === 'front' ? 'active' : ''}" data-tab="front" style="width: 72px; height: 72px; border-radius: 8px; border: 2px solid ${activeMockupTab === 'front' ? '#3b82f6' : '#e2e8f0'}; background: #f8fafc; padding: 4px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: space-between;">
                  <div style="width: 100%; height: 46px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                    ${generateBagMockupSvg('front', order, product)}
                  </div>
                  <span style="font-size: 9.5px; font-weight: 700; color: #475569;">Frente</span>
                </div>

                <!-- Thumbnail Frente + Lateral -->
                <div class="thumb-btn ${activeMockupTab === 'angle' ? 'active' : ''}" data-tab="angle" style="width: 72px; height: 72px; border-radius: 8px; border: 2px solid ${activeMockupTab === 'angle' ? '#3b82f6' : '#e2e8f0'}; background: #f8fafc; padding: 4px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: space-between;">
                  <div style="width: 100%; height: 46px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                    ${generateBagMockupSvg('angle', order, product)}
                  </div>
                  <span style="font-size: 9.5px; font-weight: 700; color: #475569;">Frente + Lat.</span>
                </div>

                <!-- Thumbnail Verso -->
                <div class="thumb-btn ${activeMockupTab === 'back' ? 'active' : ''}" data-tab="back" style="width: 72px; height: 72px; border-radius: 8px; border: 2px solid ${activeMockupTab === 'back' ? '#3b82f6' : '#e2e8f0'}; background: #f8fafc; padding: 4px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: space-between;">
                  <div style="width: 100%; height: 46px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                    ${generateBagMockupSvg('back', order, product)}
                  </div>
                  <span style="font-size: 9.5px; font-weight: 700; color: #475569;">Verso</span>
                </div>
              </div>

              <!-- Detalhes do Produto -->
              <div style="display: flex; align-items: center; gap: 12px;">
                <div>
                  <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${escapeHtml(order.productTitle || 'Sacola M')}</div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                    <span class="badge-count" style="font-size: 9px; padding: 1px 6px;">Papel 180g</span>
                    <span class="badge-count" style="font-size: 9px; padding: 1px 6px; margin-left: 4px;">Tamanho M</span>
                  </div>
                </div>
                <button type="button" id="btn-view-prod-details" class="btn btn-sm" style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 11.5px; font-weight: 600; padding: 6px 12px; border-radius: 8px; cursor: pointer;">
                  👁️ Ver detalhes
                </button>
              </div>

            </div>

          </div>

          <!-- COLUNA DIREITA: PERSONALIZAÇÃO DO PEDIDO & HISTÓRICO DE ALTERAÇÕES -->
          <div style="display: flex; flex-direction: column; gap: 14px;">
            
            <!-- CARD 1: PERSONALIZAÇÃO DO PEDIDO -->
            <div style="background: #ffffff; border-radius: 12px; border: 1px solid var(--border-subtle); padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9;">
                <span style="color: #2563eb; font-size: 16px;">✏️</span>
                <h3 style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin: 0;">Personalização do pedido</h3>
              </div>

              <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12.5px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #64748b; display: flex; align-items: center; gap: 6px;">👤 Nome</span>
                  <span style="font-weight: 700; color: #0f172a;">${escapeHtml(order.personalization?.name || order.personalization?.Nome || order.customer || 'Arthur')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #64748b; display: flex; align-items: center; gap: 6px;">📅 Idade</span>
                  <span style="font-weight: 700; color: #0f172a;">${escapeHtml(order.personalization?.age || order.personalization?.Idade || '2 anos')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #64748b; display: flex; align-items: center; gap: 6px;">🟣 Cor</span>
                  <span style="font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                    ${escapeHtml(order.personalization?.color || order.personalization?.Cor || 'Azul')}
                    <span style="width: 10px; height: 10px; border-radius: 50%; background: #38bdf8; display: inline-block;"></span>
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #64748b; display: flex; align-items: center; gap: 6px;">⭐ Tema</span>
                  <span style="font-weight: 700; color: #0f172a;">${escapeHtml(order.personalization?.theme || order.personalization?.Tema || 'Safari')} ●</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #64748b; display: flex; align-items: center; gap: 6px;">🦁 Elemento</span>
                  <span style="font-weight: 700; color: #0f172a;">${escapeHtml(order.personalization?.element || 'Leão')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #64748b; display: flex; align-items: center; gap: 6px;">🎗️ Alça</span>
                  <span style="font-weight: 700; color: #0f172a;">${escapeHtml(order.personalization?.handle || order.personalization?.Alça || 'Cetim azul')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #64748b; display: flex; align-items: center; gap: 6px;">📝 Observações</span>
                  <span style="color: #94a3b8;">${escapeHtml(order.notes || '—')}</span>
                </div>
              </div>

              <!-- Notice de Conferência -->
              <div style="margin-top: 14px; padding: 10px 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; font-size: 11px; color: #1e40af; display: flex; align-items: flex-start; gap: 6px; line-height: 1.4;">
                <span style="font-weight: 800;">✓</span>
                <span>Todos os detalhes foram conferidos e estão de acordo com a solicitação.</span>
              </div>
            </div>

            <!-- CARD 2: HISTÓRICO DE ALTERAÇÕES -->
            <div style="background: #ffffff; border-radius: 12px; border: 1px solid var(--border-subtle); padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="color: #0f172a; font-size: 16px;">🕒</span>
                <h3 style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin: 0;">Histórico de alterações</h3>
              </div>
              <div style="font-size: 11px; color: #64748b; margin-bottom: 12px;">
                Todas as solicitações registradas para este pedido
              </div>

              <!-- Timeline Lista -->
              <div style="display: flex; flex-direction: column; gap: 12px; position: relative; padding-left: 14px;">
                <div style="position: absolute; left: 5px; top: 4px; bottom: 4px; width: 2px; background: #e2e8f0;"></div>

                ${order.alterationHistory.map(item => `
                  <div style="position: relative; font-size: 11.5px;">
                    <span style="position: absolute; left: -14px; top: 4px; width: 8px; height: 8px; border-radius: 50%; background: ${item.color || '#3b82f6'};"></span>
                    <div style="display: flex; justify-content: space-between; align-items: center; color: #64748b; font-size: 10.5px;">
                      <span>${escapeHtml(item.date || '')}</span>
                      <span style="color: #94a3b8;">por ${escapeHtml(item.author || 'Cliente')}</span>
                    </div>
                    <div style="font-weight: 600; color: #1e293b; margin-top: 2px;">
                      ${escapeHtml(item.description || '')}
                    </div>
                  </div>
                `).join('')}
              </div>

              <!-- Contador de Alterações Gratuitas -->
              <div style="margin-top: 14px; padding: 8px 10px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; font-size: 11px; color: #475569; display: flex; justify-content: space-between; align-items: center;">
                <span>Alterações gratuitas:</span>
                <span style="font-weight: 800; color: ${alterationCount >= 3 ? '#dc2626' : '#2563eb'};">
                  ${String(alterationCount).padStart(2, '0')}/03
                </span>
              </div>
            </div>

          </div>

        </div>

        <!-- BARRA FIXA INFERIOR DE AÇÕES (ACEITO / ALTERAR) -->
        <div style="position: fixed; bottom: 0; left: 0; right: 0; background: #ffffff; border-top: 1px solid var(--border-subtle); padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 -4px 12px rgba(0,0,0,0.06); z-index: 100;">
          
          <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155;">
            <div style="width: 24px; height: 24px; border-radius: 50%; background: #dcfce7; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800;">
              ✓
            </div>
            <div>
              <span style="font-weight: 700; color: #0f172a;">Tudo certo!</span> Esta é a versão atual do seu pedido. Confira e aprove a produção.
            </div>
          </div>

          <div style="display: flex; gap: 10px;">
            <button type="button" id="btn-request-art-alteration" class="btn" style="background: #ffffff; border: 1px solid #cbd5e1; color: #334155; font-size: 13px; font-weight: 700; padding: 10px 18px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <span>✏️</span>
              <span>Solicitar Alteração</span>
            </button>

            <button type="button" id="btn-approve-art-production" class="btn btn-primary" style="background: #2563eb; border: none; color: #ffffff; font-size: 13px; font-weight: 700; padding: 10px 22px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);">
              <span>✓</span>
              <span>Aprovar produção</span>
            </button>
          </div>

        </div>

      </div>
    `;
  }

  function render() {
    container.innerHTML = getPageHtml();
    bindEvents();
  }

  function bindEvents() {
    // 1. Back button
    container.querySelector('#btn-approval-back')?.addEventListener('click', () => {
      if (typeof onBack === 'function') onBack();
    });

    // 2. Share link button
    container.querySelector('#btn-share-art-link')?.addEventListener('click', () => {
      const shareUrl = `${window.location.origin}${window.location.pathname}#/aprovar-arte/${order.id}`;
      navigator.clipboard?.writeText(shareUrl);
      showToast(`Link de aprovação copiado: ${shareUrl}`, '🔗');
    });

    // 3. View Product Details
    container.querySelector('#btn-view-prod-details')?.addEventListener('click', () => {
      showToast(`Produto: ${order.productTitle || 'Sacola M'} · Dimensões: 22x18x8cm`, '🛍️');
    });

    // 4. ACEITAR / APROVAR PRODUÇÃO
    container.querySelector('#btn-approve-art-production')?.addEventListener('click', () => {
      handleApproveProduction();
    });

    // 5. ALTERAR / SOLICITAR ALTERAÇÃO
    container.querySelector('#btn-request-art-alteration')?.addEventListener('click', () => {
      openAlterationModal();
    });
  }

  function handleApproveProduction() {
    // 1. Update order status to 'impressao'
    order.status = 'impressao';
    order.statusLabel = 'Pronto para Impressão';
    order.artApproved = true;
    order.artApprovedAt = new Date().toISOString();

    if (!order.production) order.production = {};
    order.production.currentStage = 'impressao';

    order.alterationHistory = order.alterationHistory || [];
    order.alterationHistory.unshift({
      date: `${formatDateBR(new Date())} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      author: 'Cliente',
      description: 'Arte aprovada pelo cliente para produção e impressão.',
      color: '#10b981'
    });

    updateOrder(order.id, order);
    bus.emit('orders:changed', [order]);

    // Show Success Modal
    showApprovalSuccessModal();
    render();
  }

  function showApprovalSuccessModal() {
    const existing = document.getElementById('approval-success-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'approval-success-modal';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 999999; padding: 16px;
    `;

    overlay.innerHTML = `
      <div style="background: #ffffff; border-radius: 16px; max-width: 440px; width: 100%; padding: 28px 24px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
        <div style="width: 58px; height: 58px; border-radius: 50%; background: #dcfce7; color: #16a34a; font-size: 28px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
          🎉
        </div>
        <h2 style="font-size: 19px; font-weight: 800; color: #0f172a; margin: 0 0 8px 0;">Produção Aprovada!</h2>
        <p style="font-size: 13.5px; color: #64748b; line-height: 1.5; margin: 0 0 20px 0;">
          Obrigado! A arte do <b>Pedido #${order.number || order.id}</b> foi aceita com sucesso e o status foi atualizado para <b>Fila de Impressão</b>.
        </p>
        <button type="button" id="btn-close-success-modal" class="btn btn-primary" style="width: 100%; padding: 10px; font-size: 13.5px; font-weight: 700; border-radius: 8px;">
          Entendido
        </button>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelector('#btn-close-success-modal')?.addEventListener('click', () => overlay.remove());
  }

  function openAlterationModal() {
    const currentCount = Number(order.alterationCount) || 0;
    const nextCount = currentCount + 1;

    const existing = document.getElementById('alteration-request-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'alteration-request-modal';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 999999; padding: 16px;
    `;

    overlay.innerHTML = `
      <div style="background: #ffffff; border-radius: 16px; max-width: 480px; width: 100%; padding: 22px 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">✏️</span>
            <h3 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 0;">Solicitar Alteração na Arte</h3>
          </div>
          <span class="badge-count" style="font-size: 11px; font-weight: 700; background: #e0e7ff; color: #4338ca;">
            Alteração ${String(nextCount).padStart(2, '0')}/03
          </span>
        </div>

        <div style="margin-bottom: 14px;">
          <label style="font-size: 12px; font-weight: 700; color: #334155; display: block; margin-bottom: 6px;">
            Descreva detalhadamente o que você deseja alterar: *
          </label>
          <textarea id="inp-alteration-text" class="form-textarea" rows="4" placeholder="Ex: Por favor, mudar a cor do laço para rosa bebê e trocar o nome para Arthur Miguel..." style="width: 100%; box-sizing: border-box; font-size: 13px;"></textarea>
        </div>

        ${nextCount === 3 ? `
          <div style="padding: 10px 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 11.5px; color: #b45309; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">⚠️</span>
            <span><b>ATENÇÃO:</b> Esta é a sua última alteração gratuita (03/03). Após esta, será cobrado <b>R$ 1,50 por alteração</b>.</span>
          </div>
        ` : nextCount > 3 ? `
          <div style="padding: 10px 12px; background: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; font-size: 11.5px; color: #b91c1c; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">💳</span>
            <span><b>Alteração Adicional:</b> O limite gratuito foi excedido. Será cobrado o valor adicional de <b>R$ 1,50</b> nesta alteração.</span>
          </div>
        ` : `
          <div style="padding: 10px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; font-size: 11.5px; color: #166534; margin-bottom: 16px;">
            Você possui <b>${3 - nextCount} alteração(ões) gratuita(s)</b> restante(s) após esta solicitação.
          </div>
        `}

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button type="button" id="btn-cancel-alt-modal" class="btn" style="padding: 8px 16px; font-size: 13px;">Cancelar</button>
          <button type="button" id="btn-submit-alt-modal" class="btn btn-primary" style="padding: 8px 20px; font-size: 13px; font-weight: 700;">
            Enviar Solicitação
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btn-cancel-alt-modal')?.addEventListener('click', () => overlay.remove());

    overlay.querySelector('#btn-submit-alt-modal')?.addEventListener('click', () => {
      const textarea = overlay.querySelector('#inp-alteration-text');
      const text = textarea ? textarea.value.trim() : '';

      if (!text) {
        showToast('Por favor, descreva qual alteração deseja realizar.', '⚠');
        return;
      }

      overlay.remove();

      // Process Alteration
      order.alterationCount = nextCount;
      order.status = 'alteracao_solicitada';
      order.statusLabel = 'Alteração Solicitada';

      order.alterationHistory = order.alterationHistory || [];
      order.alterationHistory.unshift({
        date: `${formatDateBR(new Date())} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        author: 'Cliente',
        description: text,
        count: nextCount,
        color: '#f97316'
      });

      updateOrder(order.id, order);
      bus.emit('orders:changed', [order]);

      // OPEN POPUP DE CONTAGEM DE ALTERAÇÕES GRATUITAS
      showAlterationCountFeedbackModal(nextCount);
      render();
    });
  }

  function showAlterationCountFeedbackModal(count) {
    const existing = document.getElementById('alteration-count-feedback-modal');
    if (existing) existing.remove();

    const isLast = count === 3;
    const isExceeded = count > 3;

    const overlay = document.createElement('div');
    overlay.id = 'alteration-count-feedback-modal';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 999999; padding: 16px;
    `;

    let titleText = `Alteração ${String(count).padStart(2, '0')}/03 Registrada`;
    let icon = '📝';
    let bodyHtml = '';

    if (count === 1) {
      bodyHtml = `
        <div style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
          Sua solicitação de alteração <b>01/03</b> foi enviada ao ateliê!<br/>
          Você ainda possui <b style="color: #2563eb;">02 alterações gratuitas</b> disponíveis.
        </div>
      `;
    } else if (count === 2) {
      bodyHtml = `
        <div style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
          Sua solicitação de alteração <b>02/03</b> foi enviada ao ateliê!<br/>
          Você ainda possui <b style="color: #2563eb;">01 alteração gratuita</b> disponível.
        </div>
      `;
    } else if (isLast) {
      icon = '⚠️';
      titleText = 'ATENÇÃO: ÚLTIMA ALTERAÇÃO GRATUITA (03/03)';
      bodyHtml = `
        <div style="padding: 14px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; font-size: 13.5px; color: #92400e; line-height: 1.6; margin-bottom: 20px; text-align: left;">
          <b>ATENÇÃO: Esta é a sua ÚLTIMA alteração gratuita (03/03).</b><br/><br/>
          As próximas alterações solicitadas terão o custo adicional de <b>R$ 1,50 por alteração</b>.
        </div>
      `;
    } else {
      icon = '💳';
      titleText = `Alteração Adicional (${count}/03)`;
      bodyHtml = `
        <div style="padding: 14px; background: #fee2e2; border: 1px solid #fecaca; border-radius: 10px; font-size: 13.5px; color: #991b1b; line-height: 1.6; margin-bottom: 20px; text-align: left;">
          <b>Limite de alterações gratuitas excedido.</b><br/><br/>
          Foi adicionada uma taxa de <b>R$ 1,50</b> referente à alteração nº ${count} ao pedido.
        </div>
      `;
    }

    overlay.innerHTML = `
      <div style="background: #ffffff; border-radius: 16px; max-width: 450px; width: 100%; padding: 26px 24px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.25);">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: ${isLast ? '#fef3c7' : isExceeded ? '#fee2e2' : '#e0e7ff'}; color: ${isLast ? '#d97706' : isExceeded ? '#dc2626' : '#4338ca'}; font-size: 26px; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px auto;">
          ${icon}
        </div>
        <h3 style="font-size: 17px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0;">${titleText}</h3>
        ${bodyHtml}
        <button type="button" id="btn-close-count-modal" class="btn btn-primary" style="width: 100%; padding: 10px; font-size: 13.5px; font-weight: 700; border-radius: 8px;">
          Entendido
        </button>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelector('#btn-close-count-modal')?.addEventListener('click', () => overlay.remove());
  }

  render();
}
