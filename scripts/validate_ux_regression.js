import { readFileSync } from 'fs';
import { resolve } from 'path';

console.log('=====================================================');
console.log('🚀 PAPER MAX - VALIDAÇÃO DE REGRESSÃO UX & ESTRUTURAL');
console.log('=====================================================');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

// 1. Validar Estrutura Unificada de Drawers em stock.ui.js e app.js
console.log('\n--- 1. UNIFICAÇÃO DE DRAWERS & DOM ---');
const stockUiContent = readFileSync(resolve('src/modules/stock/stock.ui.js'), 'utf-8');
const appContent = readFileSync(resolve('src/app.js'), 'utf-8');
const indexHtmlContent = readFileSync(resolve('index.html'), 'utf-8');

assert(
  !stockUiContent.includes("drawer.id = 'app-drawer';\n    drawer.className = 'drawer';"),
  'stock.ui.js não cria mais estrutura conflitante de drawer paralela'
);
assert(
  stockUiContent.includes("drawer.className = 'app-drawer-backdrop'"),
  'stock.ui.js utiliza a classe padrão app-drawer-backdrop'
);
assert(
  stockUiContent.includes('export function openPurchaseDrawer'),
  'openPurchaseDrawer exportada corretamente para integração com ações rápidas'
);
assert(
  appContent.includes("import { renderStockModule, openPurchaseDrawer } from './modules/stock/stock.ui.js';"),
  'app.js importa openPurchaseDrawer do módulo de estoque'
);
assert(
  appContent.includes("quickPurchase.addEventListener('click', () => {") &&
  appContent.includes("switchView('estoque');") &&
  appContent.includes("openPurchaseDrawer();"),
  'Botão "+ Nova compra" redireciona para Estoque e abre o drawer de compra diretamente'
);

// 2. Validar Limpeza de Modais Legados no HTML e ESC Handler
console.log('\n--- 2. REMOÇÃO DE MODAIS LEGADOS & ATALHOS ---');
assert(!indexHtmlContent.includes('id="modal-order"'), 'Modal legado #modal-order removido do HTML');
assert(!indexHtmlContent.includes('id="modal-view-order"'), 'Modal legado #modal-view-order removido do HTML');
assert(!appContent.includes("document.getElementById('modal-order')"), 'app.js limpo de referências a modais legados no keydown');
assert(appContent.includes("if (e.key === 'Escape') {\n      closeDrawer();\n    }"), 'Atalho ESC configurado de forma limpa para closeDrawer()');

// 3. Validar Padronização Glassmorphism em Financeiro
console.log('\n--- 3. PADRONIZAÇÃO GLASSMORPHISM NO FINANCEIRO ---');
const financeUiContent = readFileSync(resolve('src/modules/finance/finance.ui.js'), 'utf-8');
assert(!financeUiContent.includes('background: rgba(0,0,0,0.5);'), 'Nenhum backdrop opaco cru remanescente no financeiro');
assert(financeUiContent.includes('backdrop-filter: blur(4px);'), 'Backdrops do financeiro padronizados com Glassmorphism blur');

// 4. Validar Responsividade Mobile (< 768px)
console.log('\n--- 4. RESPONSIVIDADE MOBILE (< 768px) ---');
assert(indexHtmlContent.includes('@media (max-width: 768px)'), 'Media query para mobile < 768px presente');
assert(indexHtmlContent.includes('inset: auto 0 0 0;'), 'Sidebar reposicionada na base no mobile');
assert(indexHtmlContent.includes('margin-left: 0 !important;'), 'Conteúdo principal ocupa 100% da largura no mobile');
assert(indexHtmlContent.includes('padding: 14px 12px 76px;'), 'Padding inferior previne sobreposição da barra móvel com o conteúdo');

// 5. Validar Contraste de Texto
console.log('\n--- 5. CONTRASTE DE TEXTO & DESIGN ---');
assert(indexHtmlContent.includes('--text-muted: #9f1239;'), 'Variável --text-muted ajustada para excelente contraste em micro-textos');

console.log('\n=====================================================');
console.log(`RESULTADO: ${passedTests} / ${totalTests} validações passaram com sucesso (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
console.log('=====================================================');
