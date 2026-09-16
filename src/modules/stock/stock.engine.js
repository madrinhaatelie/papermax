/**
 * PAPER MAX - Intelligent Stock Engine (Etapa 5)
 * Comprehensive Material & Component Management, BOM Expansion,
 * Dynamic Capacity Calculation, Unit Conversion, Rastreable Consumption,
 * Physical Inventory, Purchases and Supplier Comparison.
 */

import { generateId } from '../../utils/sanitize.js';

// ==========================================
// 1. UNITS & AUTOMATIC CONVERSION ENGINE
// ==========================================

export const BASE_UNITS = [
  { key: 'm', label: 'Metros (m)', category: 'length', base: 'm', factorToBase: 1 },
  { key: 'cm', label: 'Centímetros (cm)', category: 'length', base: 'm', factorToBase: 0.01 },
  { key: 'mm', label: 'Milímetros (mm)', category: 'length', base: 'm', factorToBase: 0.001 },
  { key: 'kg', label: 'Quilogramas (kg)', category: 'weight', base: 'kg', factorToBase: 1 },
  { key: 'g', label: 'Gramas (g)', category: 'weight', base: 'kg', factorToBase: 0.001 },
  { key: 'l', label: 'Litros (L)', category: 'volume', base: 'l', factorToBase: 1 },
  { key: 'ml', label: 'Mililitros (mL)', category: 'volume', base: 'l', factorToBase: 0.001 },
  { key: 'folha', label: 'Folhas (fl)', category: 'count', base: 'folha', factorToBase: 1 },
  { key: 'un', label: 'Unidades (un)', category: 'count', base: 'un', factorToBase: 1 },
  { key: 'par', label: 'Pares (par)', category: 'count', base: 'un', factorToBase: 2 },
  { key: 'cento', label: 'Cento (100 un)', category: 'count', base: 'un', factorToBase: 100 },
  { key: 'milhar', label: 'Milhar (1000 un)', category: 'count', base: 'un', factorToBase: 1000 },
  { key: 'pct', label: 'Pacote (pct)', category: 'custom', base: 'un', factorToBase: 1 },
  { key: 'rolo', label: 'Rolo (rolo)', category: 'custom', base: 'm', factorToBase: 1 },
  { key: 'caixa', label: 'Caixa (cx)', category: 'custom', base: 'un', factorToBase: 1 },
  { key: 'placa', label: 'Placa (pl)', category: 'count', base: 'placa', factorToBase: 1 },
  { key: 'tira', label: 'Tiras (tira)', category: 'count', base: 'un', factorToBase: 1 },
  { key: 'bastao', label: 'Bastão (bastão)', category: 'count', base: 'un', factorToBase: 1 }
];

export const UNIT_MAP = Object.fromEntries(BASE_UNITS.map(u => [u.key, u]));

/**
 * Converte uma quantidade entre unidades compatíveis.
 * Exemplo: convertUnit(720, 'cm', 'm') => 7.2
 * Exemplo: convertUnit(5, 'm', 'cm') => 500
 */
export function convertUnit(quantity, fromUnit, toUnit, customPackQty = 1) {
  const qty = Number(quantity) || 0;
  if (qty === 0 || !fromUnit || !toUnit || fromUnit === toUnit) {
    return qty;
  }

  const uFrom = UNIT_MAP[fromUnit];
  const uTo = UNIT_MAP[toUnit];

  // Caso padrão onde conhecemos a categoria (comprimento, peso, volume, contagem direta)
  if (uFrom && uTo && uFrom.category === uTo.category && uFrom.category !== 'custom') {
    const qtyInBase = qty * uFrom.factorToBase;
    return qtyInBase / uTo.factorToBase;
  }

  // Pacote / Rolo / Caixa para unidade base usando o tamanho da embalagem
  if (fromUnit === 'rolo' && (toUnit === 'm' || toUnit === 'cm' || toUnit === 'mm')) {
    const qtyInM = qty * (Number(customPackQty) || 100);
    return convertUnit(qtyInM, 'm', toUnit);
  }
  if ((fromUnit === 'm' || fromUnit === 'cm' || fromUnit === 'mm') && toUnit === 'rolo') {
    const qtyInM = convertUnit(qty, fromUnit, 'm');
    return qtyInM / (Number(customPackQty) || 100);
  }

  if (fromUnit === 'pct' || fromUnit === 'caixa') {
    const qtyInUnits = qty * (Number(customPackQty) || 1);
    return convertUnit(qtyInUnits, 'un', toUnit);
  }
  if (toUnit === 'pct' || toUnit === 'caixa') {
    const qtyInUnits = convertUnit(qty, fromUnit, 'un');
    return qtyInUnits / (Number(customPackQty) || 1);
  }

  // Fallback: retorno direto se não houver regra de conversão incompatível
  return qty;
}

/**
 * Calcula os custos unitários decompostos de um insumo.
 * Exemplo: Rolo de 100m por R$ 25,00 -> R$ 0,25/m, R$ 0,0025/cm
 */
export function calculateMaterialUnitCosts(material) {
  if (!material) return { baseUnitCost: 0, formattedSubCosts: [] };

  const packCost = Number(material.purchaseCost) || 0;
  const packQty = Number(material.packQuantity) || 1;
  const packUnit = material.purchaseUnit || material.baseUnit || 'un';
  const baseUnit = material.baseUnit || packUnit;

  let baseUnitCost = 0;
  if (packQty > 0) {
    baseUnitCost = packCost / packQty;
  }

  const subCosts = [];
  if (baseUnit === 'm' || packUnit === 'm') {
    const costPerMeter = packUnit === 'm' ? (packCost / packQty) : (baseUnitCost);
    const costPerCm = costPerMeter / 100;
    const costPerMm = costPerMeter / 1000;
    subCosts.push({ unit: 'm', cost: costPerMeter, label: `R$ ${costPerMeter.toFixed(4).replace('.', ',')}/m` });
    subCosts.push({ unit: 'cm', cost: costPerCm, label: `R$ ${costPerCm.toFixed(6).replace('.', ',')}/cm` });
    subCosts.push({ unit: 'mm', cost: costPerMm, label: `R$ ${costPerMm.toFixed(6).replace('.', ',')}/mm` });
  } else if (baseUnit === 'kg' || packUnit === 'kg') {
    const costPerKg = packUnit === 'kg' ? (packCost / packQty) : baseUnitCost;
    const costPerGram = costPerKg / 1000;
    subCosts.push({ unit: 'kg', cost: costPerKg, label: `R$ ${costPerKg.toFixed(2).replace('.', ',')}/kg` });
    subCosts.push({ unit: 'g', cost: costPerGram, label: `R$ ${costPerGram.toFixed(4).replace('.', ',')}/g` });
  } else if (baseUnit === 'l' || packUnit === 'l') {
    const costPerL = packUnit === 'l' ? (packCost / packQty) : baseUnitCost;
    const costPerMl = costPerL / 1000;
    subCosts.push({ unit: 'l', cost: costPerL, label: `R$ ${costPerL.toFixed(2).replace('.', ',')}/L` });
    subCosts.push({ unit: 'ml', cost: costPerMl, label: `R$ ${costPerMl.toFixed(4).replace('.', ',')}/mL` });
  } else if (baseUnit === 'folha' || baseUnit === 'un' || baseUnit === 'placa') {
    subCosts.push({ unit: baseUnit, cost: baseUnitCost, label: `R$ ${baseUnitCost.toFixed(4).replace('.', ',')}/${baseUnit}` });
  }

  return {
    baseUnitCost,
    unitCost: baseUnitCost,
    subUnitCost: (subCosts.find(s => s.unit === 'cm' || s.unit === 'g' || s.unit === 'ml') || {}).cost || baseUnitCost,
    subCosts
  };
}

/**
 * Normaliza array ou objeto de materiais em um mapa { [id]: material }.
 */
export function buildMaterialsMap(materials) {
  if (!materials) return {};
  if (materials instanceof Map) return Object.fromEntries(materials);
  if (Array.isArray(materials)) return Object.fromEntries(materials.map(m => [m.id, m]));
  return typeof materials === 'object' ? materials : {};
}

/**
 * Normaliza array ou objeto de componentes em um mapa { [id]: componente }.
 */
export function buildComponentsMap(components) {
  if (!components) return {};
  if (components instanceof Map) return Object.fromEntries(components);
  if (Array.isArray(components)) return Object.fromEntries(components.map(c => [c.id, c]));
  return typeof components === 'object' ? components : {};
}

// ==========================================
// 2. COMPONENT COST & RECIPE ENGINE
// ==========================================

/**
 * Detecta ciclos de composição (ex: A -> B -> A ou A -> A) recursivamente.
 */
export function detectCompositionCycle(targetId, items = [], componentsMap = {}, visited = new Set()) {
  if (!targetId) return { hasCycle: false };
  if (visited.has(targetId)) {
    return {
      hasCycle: true,
      cycleId: targetId,
      message: `Ciclo detectado na composição: referência circular identificada no componente "${componentsMap[targetId]?.name || targetId}".`
    };
  }

  const nextVisited = new Set(visited);
  nextVisited.add(targetId);

  for (const item of items) {
    const rawId = item.itemId || item.componentId || item.materialId;
    const isComponent = item.type === 'componente' || (componentsMap && componentsMap[rawId] !== undefined);

    if (isComponent && componentsMap && componentsMap[rawId]) {
      if (nextVisited.has(rawId)) {
        return {
          hasCycle: true,
          cycleId: rawId,
          message: `Ciclo detectado na composição: "${componentsMap[targetId]?.name || targetId}" faz referência circular a "${componentsMap[rawId]?.name || rawId}".`
        };
      }
      const subComp = componentsMap[rawId];
      const cycleCheck = detectCompositionCycle(rawId, subComp.items || [], componentsMap, nextVisited);
      if (cycleCheck.hasCycle) return cycleCheck;
    }
  }

  return { hasCycle: false };
}

/**
 * Calcula o custo unitário de fabricação de um componente a partir de seus insumos e sub-componentes.
 */
export function calculateComponentCost(component, materialsMap = {}, componentsMap = {}, visited = new Set()) {
  if (!component || !Array.isArray(component.items) || component.items.length === 0) {
    return 0;
  }

  if (component.id && visited.has(component.id)) {
    console.warn(`[StockEngine] Ciclo detectado ao calcular custo de ${component.id}`);
    return 0;
  }

  const nextVisited = new Set(visited);
  if (component.id) nextVisited.add(component.id);

  const yieldQty = Number(component.yield) || 1;
  let totalCost = 0;

  for (const item of component.items) {
    const rawId = item.itemId || item.componentId || item.materialId;
    const isComponent = item.type === 'componente' || (componentsMap && componentsMap[rawId] !== undefined);

    if (isComponent && componentsMap && componentsMap[rawId]) {
      const subComp = componentsMap[rawId];
      const subCompUnitCost = calculateComponentCost(subComp, materialsMap, componentsMap, nextVisited);
      const itemQty = Number(item.quantity) || 1;
      totalCost += (subCompUnitCost * itemQty);
      continue;
    }

    const material = materialsMap[rawId];
    if (!material) continue;

    const itemQty = Number(item.quantity) || 0;
    const itemUnit = item.unit || material.baseUnit || 'un';

    // Custo base por unidade de compra do insumo
    const packCost = Number(material.purchaseCost) || 0;
    const packQty = Number(material.packQuantity) || 1;
    const packUnit = material.purchaseUnit || material.baseUnit || 'un';
    const unitCost = packQty > 0 ? packCost / packQty : 0;

    // Converter quantidade do componente para a unidade do insumo
    const qtyInPackUnit = convertUnit(itemQty, itemUnit, packUnit, packQty);
    const itemTotalCost = qtyInPackUnit * unitCost;
    totalCost += itemTotalCost;
  }

  return yieldQty > 0 ? totalCost / yieldQty : totalCost;
}

// ==========================================
// 3. BOM EXPANSION & PRODUCT COST ENGINE
// ==========================================

/**
 * Expande recursivamente uma cadeia de componentes em insumos diretos consolidados.
 */
function expandComponentItemsRecursive(comp, compMultiplier, materialsMap, componentsMap, totalInsumosMap, visited = new Set()) {
  if (!comp || (comp.id && visited.has(comp.id))) return [];
  const nextVisited = new Set(visited);
  if (comp.id) nextVisited.add(comp.id);

  const compYield = Number(comp.yield) || 1;
  const subInsumos = [];

  for (const rawItem of (comp.items || [])) {
    const rawId = rawItem.itemId || rawItem.componentId || rawItem.materialId;
    const isSubComp = rawItem.type === 'componente' || (componentsMap && componentsMap[rawId] !== undefined);

    if (isSubComp && componentsMap && componentsMap[rawId]) {
      const nestedComp = componentsMap[rawId];
      const nestedQty = ((Number(rawItem.quantity) || 1) / compYield) * compMultiplier;
      expandComponentItemsRecursive(nestedComp, nestedQty, materialsMap, componentsMap, totalInsumosMap, nextVisited);
      continue;
    }

    const mat = materialsMap[rawId];
    if (!mat) continue;

    const rawItemUnit = rawItem.unit || mat.baseUnit || 'un';
    const singleCompQty = (Number(rawItem.quantity) || 0) / compYield;
    const totalRawQty = singleCompQty * compMultiplier;

    const packCost = Number(mat.purchaseCost) || 0;
    const packQty = Number(mat.packQuantity) || 1;
    const packUnit = mat.purchaseUnit || mat.baseUnit || 'un';
    const costPerPackUnit = packQty > 0 ? packCost / packQty : 0;

    const rawQtyInPackUnit = convertUnit(totalRawQty, rawItemUnit, packUnit, packQty);
    const rawCost = rawQtyInPackUnit * costPerPackUnit;

    subInsumos.push({
      materialId: mat.id,
      name: mat.name,
      quantity: totalRawQty,
      unit: rawItemUnit,
      totalCost: rawCost
    });

    // Acumular no consolidado total de insumos
    if (!totalInsumosMap[mat.id]) {
      totalInsumosMap[mat.id] = {
        material: mat,
        materialId: mat.id,
        name: mat.name,
        quantity: 0,
        requiredQty: 0,
        unit: mat.baseUnit || rawItemUnit,
        baseUnit: mat.baseUnit,
        totalCost: 0
      };
    }
    const rawQtyInBase = convertUnit(totalRawQty, rawItemUnit, mat.baseUnit || rawItemUnit, packQty);
    totalInsumosMap[mat.id].quantity += rawQtyInBase;
    totalInsumosMap[mat.id].requiredQty += rawQtyInBase;
    totalInsumosMap[mat.id].totalCost += rawCost;
  }

  return subInsumos;
}

/**
 * Expande uma composição de produto (insumos + componentes) recursivamente.
 * Exemplo: 20 Flores de Cetim Rosa -> 14.400 cm de fita, 20 palitos, 200 cm fita verde
 */
export function expandProductComposition(product, p2 = 1, p3 = [], p4 = []) {
  let orderQty = 1;
  let materials = [];
  let components = [];

  if (typeof p2 === 'number') {
    orderQty = p2;
    materials = p3 || [];
    components = p4 || [];
  } else {
    materials = p2 || [];
    components = p3 || [];
    orderQty = typeof p4 === 'number' ? p4 : 1;
  }

  const qtyMultiplier = Number(orderQty) || 1;
  const materialsMap = Array.isArray(materials) 
    ? Object.fromEntries(materials.map(m => [m.id, m]))
    : (materials || {});
  const componentsMap = Array.isArray(components) 
    ? Object.fromEntries(components.map(c => [c.id, c]))
    : (components || {});

  const composition = Array.isArray(product?.composition) ? product.composition : [];

  const directInsumos = [];
  const expandedComponents = [];
  const totalInsumosMap = {}; // materialId -> { material, requiredQty, unit, unitCost, totalCost }

  let totalUnitCost = 0;

  for (const compItem of composition) {
    const itemQty = (Number(compItem.quantity) || 1) * qtyMultiplier;
    const unitQty = Number(compItem.quantity) || 1;

    if (compItem.type === 'insumo') {
      const mat = materialsMap[compItem.itemId || compItem.materialId];
      if (!mat) continue;

      const itemUnit = compItem.unit || mat.baseUnit || 'un';
      const packCost = Number(mat.purchaseCost) || 0;
      const packQty = Number(mat.packQuantity) || 1;
      const packUnit = mat.purchaseUnit || mat.baseUnit || 'un';
      const costPerPackUnit = packQty > 0 ? packCost / packQty : 0;

      const qtyInPackUnit = convertUnit(itemQty, itemUnit, packUnit, packQty);
      const itemCost = qtyInPackUnit * costPerPackUnit;

      const unitCostPortion = (convertUnit(unitQty, itemUnit, packUnit, packQty) * costPerPackUnit);
      totalUnitCost += unitCostPortion;

      directInsumos.push({
        materialId: mat.id,
        name: mat.name,
        quantity: itemQty,
        unit: itemUnit,
        unitCost: costPerPackUnit,
        totalCost: itemCost
      });

      // Acumular no consolidado total de insumos
      if (!totalInsumosMap[mat.id]) {
        totalInsumosMap[mat.id] = {
          material: mat,
          materialId: mat.id,
          name: mat.name,
          quantity: 0,
          requiredQty: 0,
          unit: mat.baseUnit || itemUnit,
          baseUnit: mat.baseUnit,
          totalCost: 0
        };
      }
      const qtyInBase = convertUnit(itemQty, itemUnit, mat.baseUnit || itemUnit, packQty);
      totalInsumosMap[mat.id].quantity += qtyInBase;
      totalInsumosMap[mat.id].requiredQty += qtyInBase;
      totalInsumosMap[mat.id].totalCost += itemCost;

    } else if (compItem.type === 'componente') {
      const comp = componentsMap[compItem.itemId || compItem.componentId];
      if (!comp) continue;

      const compCost = calculateComponentCost(comp, materialsMap, componentsMap);
      const compTotalCost = compCost * itemQty;
      totalUnitCost += (compCost * unitQty);

      const subInsumos = expandComponentItemsRecursive(comp, itemQty, materialsMap, componentsMap, totalInsumosMap);

      expandedComponents.push({
        componentId: comp.id,
        name: comp.name,
        quantity: itemQty,
        unit: 'un',
        unitCost: compCost,
        totalCost: compTotalCost,
        subInsumos
      });
    }
  }

  const flattenedInsumos = Object.values(totalInsumosMap);

  return {
    orderQty: qtyMultiplier,
    directInsumos,
    expandedComponents,
    flattenedInsumos,
    materials: totalInsumosMap,
    unitCost: Number(totalUnitCost.toFixed(4)),
    totalCost: Number((totalUnitCost * qtyMultiplier).toFixed(2))
  };
}

// ==========================================
// 4. STOCK BALANCES & 4 ALERT CONDITIONS
// ==========================================

/**
 * Calcula saldos físicos, comprometidos, disponíveis, compras em andamento
 * e projeta os 4 alertas oficiais:
 * 🟠 Estoque insuficiente para pedidos abertos
 * 🟡 Estoque abaixo do mínimo
 * 🔴 Sem estoque / produção bloqueada
 * 🔵 Reposição em andamento
 */
export function calculateStockBalances(materials = [], components = [], orders = [], purchases = []) {
  const materialsMap = Object.fromEntries(materials.map(m => [m.id, m]));
  const componentsMap = Object.fromEntries(components.map(c => [c.id, c]));

  // 1. Calcular consumo comprometido em pedidos ativos não finalizados e que ainda não baixaram estoque
  const committedMaterialsMap = {}; // materialId -> committedQty (in base unit)
  const committedComponentsMap = {}; // componentId -> committedQty

  const activeOrders = orders.filter(o => 
    o.status !== 'green' && 
    o.status !== 'pronto' && 
    o.status !== 'cancelado' &&
    !o.production?.stockDeducted
  );

  for (const order of activeOrders) {
    const product = order.productSnapshot || order.product || (order.composition ? order : {});
    const orderQty = Number(order.qty) || 1;
    const expanded = expandProductComposition(product, orderQty, materials, components);

    for (const item of expanded.flattenedInsumos) {
      const mat = materialsMap[item.materialId];
      const baseUnit = mat?.baseUnit || item.unit;
      const convertedQty = convertUnit(item.requiredQty, item.unit, baseUnit, mat?.packQuantity || 1);
      committedMaterialsMap[item.materialId] = (committedMaterialsMap[item.materialId] || 0) + convertedQty;
    }

    for (const compItem of expanded.expandedComponents) {
      committedComponentsMap[compItem.componentId] = (committedComponentsMap[compItem.componentId] || 0) + compItem.quantity;
    }
  }

  // 2. Calcular compras em andamento (pedidas / planejadas)
  const pendingPurchasesMap = {}; // materialId -> pendingQty (in base unit)
  const pendingPurchases = purchases.filter(p => p.status === 'pedida' || p.status === 'planejada');

  for (const purchase of pendingPurchases) {
    for (const item of (purchase.items || [])) {
      const mat = materialsMap[item.materialId];
      const baseUnit = mat?.baseUnit || item.unit || 'un';
      const convertedQty = convertUnit(item.quantity, item.unit || baseUnit, baseUnit, mat?.packQuantity || 1);
      pendingPurchasesMap[item.materialId] = (pendingPurchasesMap[item.materialId] || 0) + convertedQty;
    }
  }

  // 3. Construir balanço completo de Insumos
  const materialBalances = materials.map(mat => {
    const current = Number(mat.currentStock) || 0;
    const minStock = Number(mat.minStock) || 0;
    const committed = Number(committedMaterialsMap[mat.id] || 0);
    const available = current - committed;
    const onOrder = Number(pendingPurchasesMap[mat.id] || 0);
    const projected = current - committed + onOrder;

    let alertType = 'normal';
    let alertBadge = 'green';
    let alertLabel = 'Estoque Regular';

    if (current <= 0) {
      alertType = 'sem_estoque';
      alertBadge = 'red';
      alertLabel = 'Sem estoque / Produção bloqueada';
    } else if (available < 0) {
      if (onOrder > 0 && projected >= 0) {
        alertType = 'em_reposicao';
        alertBadge = 'blue';
        alertLabel = 'Reposição em andamento';
      } else {
        alertType = 'insuficiente';
        alertBadge = 'orange';
        alertLabel = 'Insuficiente para pedidos';
      }
    } else if (current < minStock) {
      if (onOrder > 0 && projected >= minStock) {
        alertType = 'em_reposicao';
        alertBadge = 'blue';
        alertLabel = 'Reposição em andamento';
      } else {
        alertType = 'abaixo_minimo';
        alertBadge = 'yellow';
        alertLabel = 'Abaixo do mínimo';
      }
    }

    const { baseUnitCost } = calculateMaterialUnitCosts(mat);
    const stockValue = current * baseUnitCost;

    return {
      id: mat.id,
      name: mat.name,
      type: 'insumo',
      baseUnit: mat.baseUnit || 'un',
      currentStock: current,
      minStock,
      committedStock: Number(committed.toFixed(2)),
      availableStock: Number(available.toFixed(2)),
      pendingPurchasesStock: Number(onOrder.toFixed(2)),
      projectedStock: Number(projected.toFixed(2)),
      unitCost: baseUnitCost,
      stockValue: Number(stockValue.toFixed(2)),
      supplierId: mat.supplierId || '',
      supplierName: mat.supplierName || 'Diversos',
      alertType,
      alertBadge,
      alertLabel
    };
  });

  // 4. Construir balanço completo de Componentes
  const componentBalances = components.map(comp => {
    const current = Number(comp.currentStock) || 0;
    const minStock = Number(comp.minStock) || 0;
    const committed = Number(committedComponentsMap[comp.id] || 0);
    const available = current - committed;
    const onOrder = 0; // Componentes são fabricados internamente
    const projected = current - committed;

    let alertType = 'normal';
    let alertBadge = 'green';
    let alertLabel = 'Estoque Regular';

    if (current <= 0) {
      alertType = 'sem_estoque';
      alertBadge = 'red';
      alertLabel = 'Sem estoque em prateleira';
    } else if (available < 0) {
      alertType = 'insuficiente';
      alertBadge = 'orange';
      alertLabel = 'Insuficiente para pedidos';
    } else if (current < minStock) {
      alertType = 'abaixo_minimo';
      alertBadge = 'yellow';
      alertLabel = 'Abaixo do estoque mínimo';
    }

    const unitCost = calculateComponentCost(comp, materialsMap);
    const stockValue = current * unitCost;

    return {
      id: comp.id,
      name: comp.name,
      type: 'componente',
      baseUnit: 'un',
      currentStock: current,
      minStock,
      committedStock: Number(committed.toFixed(2)),
      availableStock: Number(available.toFixed(2)),
      pendingPurchasesStock: onOrder,
      projectedStock: Number(projected.toFixed(2)),
      unitCost: Number(unitCost.toFixed(4)),
      stockValue: Number(stockValue.toFixed(2)),
      alertType,
      alertBadge,
      alertLabel
    };
  });

  const allBalances = [...materialBalances, ...componentBalances];

  const summary = {
    totalItems: allBalances.length,
    totalStockValue: allBalances.reduce((sum, item) => sum + (item.stockValue || 0), 0),
    outOfStockCount: allBalances.filter(i => i.alertType === 'sem_estoque').length,
    insufficientCount: allBalances.filter(i => i.alertType === 'insuficiente').length,
    belowMinCount: allBalances.filter(i => i.alertType === 'abaixo_minimo').length,
    replenishingCount: allBalances.filter(i => i.alertType === 'em_reposicao').length,
    regularCount: allBalances.filter(i => i.alertType === 'normal').length,
    pendingPurchasesCount: pendingPurchases.length
  };

  return {
    materials: materialBalances,
    components: componentBalances,
    all: allBalances,
    summary
  };
}

// ==========================================
// 5. CAPACITY CALCULATION ("Quantos consigo produzir?")
// ==========================================

/**
 * Calcula quantos produtos é possível produzir com o estoque atual ou disponível.
 * Identifica também os materiais limitantes (gargalos).
 */
export function calculateProductCapacity(product, materials = [], components = [], useAvailableStock = true) {
  if (!product) {
    return { maxUnits: 0, limitingMaterials: [], totalInsumosNeeded: [] };
  }

  const materialsMap = Object.fromEntries(materials.map(m => [m.id, m]));
  const componentsMap = Object.fromEntries(components.map(c => [c.id, c]));

  // Expandir composição para 1 unidade
  const expanded = expandProductComposition(product, 1, materials, components);

  if (expanded.flattenedInsumos.length === 0) {
    return {
      maxUnits: 9999,
      isUnlimited: true,
      limitingMaterials: [],
      breakdown: []
    };
  }

  let minCapacity = Infinity;
  const breakdown = [];

  for (const item of expanded.flattenedInsumos) {
    const mat = materialsMap[item.materialId];
    if (!mat) continue;

    const baseUnit = mat.baseUnit || item.unit;
    const requiredPerUnit = convertUnit(item.requiredQty, item.unit, baseUnit, mat.packQuantity || 1);

    const stockQty = useAvailableStock 
      ? Math.max(0, (Number(mat.currentStock) || 0) - (Number(mat.committedStock) || 0))
      : (Number(mat.currentStock) || 0);

    let maxForThis = 0;
    if (requiredPerUnit > 0) {
      maxForThis = Math.floor(stockQty / requiredPerUnit);
    }

    if (maxForThis < minCapacity) {
      minCapacity = maxForThis;
    }

    breakdown.push({
      materialId: mat.id,
      name: mat.name,
      requiredPerUnit,
      unit: baseUnit,
      stockAvailable: stockQty,
      capacityUnits: maxForThis
    });
  }

  if (minCapacity === Infinity) minCapacity = 0;

  // Identificar materiais gargalo (aqueles que limitam a capacidade máxima)
  const limitingMaterials = breakdown
    .filter(b => b.capacityUnits === minCapacity)
    .map(b => ({
      id: b.materialId,
      ...b,
      missingForTarget: (target) => Math.max(0, (target * b.requiredPerUnit) - b.stockAvailable)
    }));

  return {
    productName: product.name,
    maxUnits: minCapacity,
    limitingMaterials,
    breakdown
  };
}

/**
 * Verifica se um pedido possui estoque suficiente para todos os seus materiais.
 */
export function checkOrderStockAvailability(order, products = [], materials = [], components = []) {
  if (!order) return { sufficient: true, missingMaterials: [] };

  const items = (order.items && order.items.length > 0) ? order.items : [{
    productSnapshot: order.productSnapshot || products.find(p => p.id === order.productId),
    qty: Number(order.qty) || 1
  }];

  const materialsMap = Object.fromEntries(materials.map(m => [m.id, m]));
  const requiredMaterialsMap = {};

  for (const item of items) {
    if (!item.productSnapshot) continue;
    const expanded = expandProductComposition(item.productSnapshot, item.qty, materials, components);
    for (const matItem of expanded.flattenedInsumos) {
      const mat = materialsMap[matItem.materialId];
      if (!mat) continue;
      const baseUnit = mat.baseUnit || matItem.unit;
      const required = convertUnit(matItem.requiredQty, matItem.unit, baseUnit, mat.packQuantity || 1);
      requiredMaterialsMap[matItem.materialId] = (requiredMaterialsMap[matItem.materialId] || 0) + required;
    }
  }

  const missingMaterials = [];

  for (const [materialId, requiredQty] of Object.entries(requiredMaterialsMap)) {
    const mat = materialsMap[materialId];
    if (!mat) continue;
    const current = Number(mat.currentStock) || 0;
    if (current < requiredQty) {
      missingMaterials.push({
        materialId: mat.id,
        name: mat.name,
        requiredQty: Number(requiredQty.toFixed(2)),
        currentStock: current,
        missingQty: Number((requiredQty - current).toFixed(2)),
        unit: mat.baseUnit || mat.unit
      });
    }
  }

  return {
    sufficient: missingMaterials.length === 0,
    missingMaterials
  };
}

// ==========================================
// 6. TRACEABLE STOCK CONSUMPTION
// ==========================================

/**
 * Realiza a baixa de estoque rastreável para um pedido.
 * Evita baixa duplicada usando flag `order.production.stockDeducted`.
 */
export function consumeOrderMaterials(order, { materials = [], components = [], movements = [], operator = 'Operador Produção', notes = '' } = {}) {
  if (!order) {
    throw new Error('Pedido inválido para consumo de estoque.');
  }

  if (order.production?.stockDeducted) {
    return {
      success: true,
      alreadyDeducted: true,
      message: `Estoque já foi baixado para o Pedido ${order.number} em ${order.production.stockDeductedAt || 'etapa anterior'}.`,
      movements: []
    };
  }

  const items = (order.items && order.items.length > 0) ? order.items : [{
    productSnapshot: order.productSnapshot || order.product || (order.composition ? order : {}),
    qty: Number(order.qty) || 1
  }];

  const createdMovements = [];
  const materialsMap = Object.fromEntries(materials.map(m => [m.id, m]));
  const requiredMaterialsMap = {};

  for (const item of items) {
    if (!item.productSnapshot) continue;
    const expanded = expandProductComposition(item.productSnapshot, item.qty, materials, components);
    for (const matItem of expanded.flattenedInsumos) {
      const mat = materialsMap[matItem.materialId];
      if (!mat) continue;
      const baseUnit = mat.baseUnit || matItem.unit;
      const deductQty = convertUnit(matItem.requiredQty, matItem.unit, baseUnit, mat.packQuantity || 1);
      requiredMaterialsMap[matItem.materialId] = (requiredMaterialsMap[matItem.materialId] || 0) + deductQty;
    }
  }

  for (const [materialId, deductQty] of Object.entries(requiredMaterialsMap)) {
    const mat = materialsMap[materialId];
    if (!mat) continue;

    const prevStock = Number(mat.currentStock) || 0;
    const newStock = Math.max(0, prevStock - deductQty);
    mat.currentStock = Number(newStock.toFixed(2));
    mat.updatedAt = new Date().toISOString();

    const movement = {
      id: generateId('mov'),
      materialId: mat.id,
      materialName: mat.name,
      materialType: 'insumo',
      type: 'saida',
      reason: 'producao',
      quantity: Number(deductQty.toFixed(2)),
      unit: mat.baseUnit || mat.unit,
      previousStock: prevStock,
      newStock: Number(newStock.toFixed(2)),
      origin: `Pedido ${order.number} · ${order.customer || 'Cliente'}`,
      orderId: order.id,
      productId: order.productId,
      operator,
      notes: notes || `Consumo de produção para itens do Pedido ${order.number}`,
      createdAt: new Date().toISOString()
    };

    movements.unshift(movement);
    createdMovements.push(movement);
  }

  if (!order.production) {
    order.production = {};
  }
  order.production.stockDeducted = true;
  order.production.stockDeductedAt = new Date().toISOString();
  order.production.stockDeductedBy = operator;

  return {
    success: true,
    alreadyDeducted: false,
    message: `${createdMovements.length} insumos baixados com sucesso para o Pedido ${order.number}.`,
    movements: createdMovements
  };
}

// ==========================================
// 7. STOCK MOVEMENTS (ENTRADAS & SAÍDAS)
// ==========================================

export const MOVEMENT_REASONS = {
  ENTRADA: [
    { key: 'compra', label: 'Compra de Fornecedor' },
    { key: 'devolucao', label: 'Devolução de Produção / Cliente' },
    { key: 'ajuste', label: 'Ajuste de Inventário' },
    { key: 'outros', label: 'Outros / Entrada Avulsa' }
  ],
  SAIDA: [
    { key: 'producao', label: 'Consumo de Produção' },
    { key: 'perda', label: 'Perda / Descarte' },
    { key: 'dano', label: 'Avaria / Dano' },
    { key: 'uso_interno', label: 'Uso Interno / Testes' },
    { key: 'ajuste', label: 'Ajuste de Inventário' }
  ]
};

/**
 * Registra movimentação de estoque manual (entrada ou saída) sem alteração silenciosa.
 */
export function recordStockMovement({
  materialId,
  materialType = 'insumo',
  type = 'entrada', // 'entrada' | 'saida'
  reason = 'compra',
  quantity,
  unit,
  origin = '',
  operator = 'Operador',
  notes = '',
  materials = [],
  components = [],
  movements = []
}) {
  const qty = Number(quantity);
  if (!qty || qty <= 0) {
    throw new Error('Informe uma quantidade válida e positiva.');
  }

  const targetList = materialType === 'componente' ? components : materials;
  const item = targetList.find(i => i.id === materialId);
  if (!item) {
    throw new Error('Material ou componente não encontrado.');
  }

  const baseUnit = item.baseUnit || unit || 'un';
  const convertedQty = convertUnit(qty, unit || baseUnit, baseUnit, item.packQuantity || 1);

  const prevStock = Number(item.currentStock) || 0;
  let newStock;

  if (type === 'entrada') {
    newStock = prevStock + convertedQty;
  } else {
    newStock = Math.max(0, prevStock - convertedQty);
  }

  item.currentStock = Number(newStock.toFixed(2));
  item.updatedAt = new Date().toISOString();

  const movement = {
    id: generateId('mov'),
    materialId: item.id,
    materialName: item.name,
    materialType,
    type,
    reason,
    quantity: Number(convertedQty.toFixed(2)),
    unit: baseUnit,
    previousStock: prevStock,
    newStock: Number(newStock.toFixed(2)),
    origin: origin || (type === 'entrada' ? 'Entrada Manual' : 'Saída Manual'),
    operator,
    notes,
    createdAt: new Date().toISOString()
  };

  movements.unshift(movement);

  return {
    success: true,
    movement,
    updatedStock: item.currentStock
  };
}

// ==========================================
// 8. PHYSICAL INVENTORY CONFERENCES
// ==========================================

/**
 * Aplica os ajustes de uma conferência física de inventário.
 */
export function applyInventoryAdjustments(inventorySession, countedItems = [], { materials = [], components = [], movements = [], operator = 'Auditor Estoque', reason = 'Ajuste de inventário físico' } = {}) {
  if (!inventorySession) {
    throw new Error('Sessão de inventário inválida.');
  }

  if (inventorySession.status === 'concluido') {
    return {
      success: true,
      alreadyApplied: true,
      totalAdjusted: 0,
      adjustments: inventorySession.adjustments || [],
      message: 'Esta sessão de inventário já foi aplicada anteriormente.'
    };
  }

  const materialsMap = Object.fromEntries(materials.map(m => [m.id, m]));
  const componentsMap = Object.fromEntries(components.map(c => [c.id, c]));

  const adjustmentLogs = [];

  for (const count of countedItems) {
    const isComponent = count.materialType === 'componente';
    const item = isComponent ? componentsMap[count.materialId] : materialsMap[count.materialId];
    if (!item) continue;

    const systemStock = Number(item.currentStock) || 0;
    const physicalStock = Number(count.physicalCount);

    if (isNaN(physicalStock)) continue;

    const diff = Number((physicalStock - systemStock).toFixed(2));
    if (diff === 0) continue;

    const type = diff > 0 ? 'entrada' : 'saida';
    const adjustQty = Math.abs(diff);

    item.currentStock = physicalStock;
    item.updatedAt = new Date().toISOString();

    const movement = {
      id: generateId('mov'),
      materialId: item.id,
      materialName: item.name,
      materialType: isComponent ? 'componente' : 'insumo',
      type,
      reason: 'ajuste',
      quantity: adjustQty,
      unit: item.baseUnit || 'un',
      previousStock: systemStock,
      newStock: physicalStock,
      origin: `Inventário ${inventorySession.code || inventorySession.id}`,
      operator,
      notes: `${reason} · Diferença apurada: ${diff > 0 ? '+' : ''}${diff} ${item.baseUnit || 'un'}. ${count.notes || ''}`.trim(),
      createdAt: new Date().toISOString()
    };

    movements.unshift(movement);
    adjustmentLogs.push({
      materialId: item.id,
      name: item.name,
      systemStock,
      physicalStock,
      diff,
      movementId: movement.id
    });
  }

  inventorySession.status = 'concluido';
  inventorySession.completedAt = new Date().toISOString();
  inventorySession.operator = operator;
  inventorySession.adjustments = adjustmentLogs;

  return {
    success: true,
    totalAdjusted: adjustmentLogs.length,
    adjustments: adjustmentLogs
  };
}

// ==========================================
// 9. PURCHASES & SUPPLIER COMPARISON
// ==========================================

/**
 * Conclui e recebe uma compra, gerando entradas no estoque e histórico do fornecedor.
 */
export function receivePurchase(purchase, { materials = [], components = [], movements = [], operator = 'Almoxarife', notes = '' } = {}) {
  if (!purchase) {
    throw new Error('Compra inválida.');
  }

  if (purchase.status === 'recebido' || purchase.status === 'recebida') {
    return {
      success: true,
      alreadyReceived: true,
      message: `A Compra ${purchase.code || purchase.id} já foi recebida anteriormente.`,
      movements: []
    };
  }

  const materialsMap = Object.fromEntries(materials.map(m => [m.id, m]));
  const componentsMap = Object.fromEntries(components.map(c => [c.id, c]));

  const createdMovements = [];

  for (const item of (purchase.items || [])) {
    const isComponent = item.materialType === 'componente';
    const mat = isComponent ? componentsMap[item.materialId] : materialsMap[item.materialId];
    if (!mat) continue;

    const baseUnit = mat.baseUnit || item.unit || 'un';
    const qtyReceived = convertUnit(item.quantity, item.unit || baseUnit, baseUnit, mat.packQuantity || 1);

    const prevStock = Number(mat.currentStock) || 0;
    const newStock = prevStock + qtyReceived;
    mat.currentStock = Number(newStock.toFixed(2));

    // Atualizar custo de compra se fornecido
    if (item.packCost && item.packQuantity) {
      mat.purchaseCost = Number(item.packCost);
      mat.packQuantity = Number(item.packQuantity);
    }
    mat.updatedAt = new Date().toISOString();

    const movement = {
      id: generateId('mov'),
      materialId: mat.id,
      materialName: mat.name,
      materialType: isComponent ? 'componente' : 'insumo',
      type: 'entrada',
      reason: 'compra',
      quantity: Number(qtyReceived.toFixed(2)),
      unit: baseUnit,
      previousStock: prevStock,
      newStock: Number(newStock.toFixed(2)),
      origin: `Compra ${purchase.code || purchase.id} · ${purchase.supplierName || 'Fornecedor'}`,
      operator,
      notes: notes || `Entrada de compra realizada em ${new Date().toLocaleDateString('pt-BR')}`,
      createdAt: new Date().toISOString()
    };

    movements.unshift(movement);
    createdMovements.push(movement);
  }

  purchase.status = 'recebido';
  purchase.receivedAt = new Date().toISOString();
  purchase.receivedBy = operator;

  return {
    success: true,
    message: `Compra ${purchase.code || purchase.id} recebida com sucesso. ${createdMovements.length} itens adicionados ao estoque.`,
    movements: createdMovements
  };
}

/**
 * Compara preços de fornecedores normalizando para a unidade base equivalente (ex: R$/m, R$/un, R$/folha).
 */
export function compareSupplierPrices(materials = [], suppliers = [], purchases = []) {
  const suppliersMap = Object.fromEntries(suppliers.map(s => [s.id, s]));

  // Agrupar insumos por similaridade ou categoria/nome normalizado
  const grouped = {};

  for (const mat of materials) {
    const key = mat.name.trim().toLowerCase();
    if (!grouped[key]) {
      grouped[key] = {
        name: mat.name,
        baseUnit: mat.baseUnit || 'un',
        entries: []
      };
    }

    const { baseUnitCost } = calculateMaterialUnitCosts(mat);
    const sup = suppliersMap[mat.supplierId];

    grouped[key].entries.push({
      materialId: mat.id,
      supplierId: mat.supplierId,
      supplierName: sup ? sup.name : (mat.supplierName || 'Diversos'),
      supplierUrl: sup ? sup.storeUrl : '',
      packType: mat.purchasePackType || 'embalagem',
      packQuantity: mat.packQuantity || 1,
      packUnit: mat.purchaseUnit || mat.baseUnit || 'un',
      packCost: mat.purchaseCost || 0,
      normalizedUnitCost: baseUnitCost,
      baseUnit: mat.baseUnit || 'un'
    });
  }

  // Também analisar histórico de compras para enriquecer o comparativo
  for (const purchase of purchases) {
    const sup = suppliersMap[purchase.supplierId];
    for (const item of (purchase.items || [])) {
      const key = (item.name || '').trim().toLowerCase();
      if (grouped[key]) {
        const normalizedUnitCost = item.unitCost || (item.packCost && item.packQuantity ? item.packCost / item.packQuantity : 0);
        
        const existing = grouped[key].entries.find(e => e.supplierId === purchase.supplierId);
        if (!existing && normalizedUnitCost > 0) {
          grouped[key].entries.push({
            materialId: item.materialId || 'hist',
            supplierId: purchase.supplierId,
            supplierName: sup ? sup.name : (purchase.supplierName || 'Histórico'),
            supplierUrl: sup ? sup.storeUrl : '',
            packType: item.packType || 'compra',
            packQuantity: item.packQuantity || item.quantity || 1,
            packUnit: item.unit || grouped[key].baseUnit,
            packCost: item.totalCost || item.packCost || 0,
            normalizedUnitCost,
            baseUnit: grouped[key].baseUnit,
            fromHistory: true
          });
        }
      }
    }
  }

  // Identificar melhor preço em cada grupo
  const comparisons = Object.values(grouped).map(group => {
    const sorted = [...group.entries].sort((a, b) => a.normalizedUnitCost - b.normalizedUnitCost);
    const bestPrice = sorted[0]?.normalizedUnitCost || 0;

    const entriesWithDiff = sorted.map((entry, idx) => {
      const diffPercent = bestPrice > 0 ? ((entry.normalizedUnitCost - bestPrice) / bestPrice) * 100 : 0;
      return {
        ...entry,
        isBest: idx === 0,
        diffPercent: Number(diffPercent.toFixed(1))
      };
    });

    return {
      name: group.name,
      baseUnit: group.baseUnit,
      bestPrice,
      entries: entriesWithDiff
    };
  });

  return comparisons;
}
