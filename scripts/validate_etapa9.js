/**
 * Validation Script for Etapa 9 - Copiloto Inteligente PAPER MAX
 */

import { buildCopilotContextSnapshot, getStockAlertsData, getProductionStatusData } from '../src/modules/copilot/copilot.engine.js';

console.log('=== VALIDANDO ETAPA 9: COPILOTO INTELIGENTE ===');

try {
  const snapshot = buildCopilotContextSnapshot();
  console.log('✓ Snapshot do contexto gerado com sucesso.');

  assert(snapshot.timestamp, 'Timestamp presente');
  assert(snapshot.productionStatus !== undefined, 'Production status presente');
  assert(Array.isArray(snapshot.blockedOrders), 'Blocked orders é array');
  assert(Array.isArray(snapshot.stockAlerts), 'Stock alerts é array');
  assert(Array.isArray(snapshot.productionCapacity), 'Production capacity é array');
  assert(snapshot.financialSummary !== undefined, 'Financial summary presente');
  assert(Array.isArray(snapshot.productCosts), 'Product costs é array');
  assert(Array.isArray(snapshot.purchaseSuggestions), 'Purchase suggestions é array');

  console.log(`- Alertas de estoque detectados: ${snapshot.stockAlerts.length}`);
  console.log(`- Pedidos bloqueados detectados: ${snapshot.blockedOrders.length}`);
  console.log(`- Capacidades de produtos calculadas: ${snapshot.productionCapacity.length}`);

  console.log('\n✅ TODAS AS VALIDAÇÕES DA ETAPA 9 PASSARAM COM SUCESSO!');
  process.exit(0);
} catch (err) {
  console.error('\n❌ ERRO NA VALIDAÇÃO DA ETAPA 9:', err);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}
