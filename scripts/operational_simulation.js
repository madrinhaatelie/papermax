import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import {
  loadProducts,
  saveProducts,
  loadOrders,
  saveOrders,
  loadMaterials,
  saveMaterials,
  loadComponents,
  saveComponents,
  loadMovements,
  saveMovements,
  loadReceivables,
  saveReceivables,
  loadExpenses,
  saveExpenses,
  loadPayables,
  savePayables
} from '../src/data/storage.js';

import {
  createProduct,
  updateProduct,
  getProductById,
  getProducts
} from '../src/modules/products/products.js';

import {
  createOrder,
  getOrderById,
  updateOrder,
  approveOrderById,
  sendOrderToProductionById,
  advanceOrderStageById,
  updateOrderPrintJobById,
  submitOrderQCById,
  markOrderDeliveredById,
  addGeneratedFileToOrder,
  PRODUCTION_STAGES
} from '../src/modules/orders/orders.js';

import {
  generatePersonalizedPdf
} from '../src/modules/personalization/pdf.engine.js';

import {
  calculateStockBalances,
  consumeOrderMaterials,
  checkOrderStockAvailability,
  calculateProductCapacity
} from '../src/modules/stock/stock.engine.js';

import {
  calculateFinancialMetrics,
  getSalesFromOrders,
  receiveReceivable,
  syncReceivablesWithOrders
} from '../src/modules/finance/finance.engine.js';

import {
  calculateDashboardMetrics
} from '../src/modules/dashboard/dashboard.js';

describe('TESTE OPERACIONAL REAL DO PAPER MAX (FLUXO ATELIÊ PONTA A PONTA)', () => {

  let testProductId = '';
  let testOrderId = '';
  let initialStockMatPapel = 0;
  let initialStockMatCola = 0;

  before(() => {
    // Garantir materiais no storage
    const materials = loadMaterials();
    const matPapel = materials.find(m => m.id === 'mat_papel_kraft_180') || materials[0];
    const matCola = materials.find(m => m.id === 'mat_cola_quente') || materials[1];
    initialStockMatPapel = Number(matPapel.currentStock) || 100;
    initialStockMatCola = Number(matCola?.currentStock) || 50;
  });

  // ----------------------------------------------------
  // ETAPA 1 & 2: CADASTRO E CONFIGURAÇÃO DE PRODUTO
  // ----------------------------------------------------
  it('1 & 2. Cadastrar produto personalizado com personalizações obrigatórias e opcionais', () => {
    const newProductPayload = {
      name: 'Kit Lembrancinha Festa Luxo Real',
      categoryId: 'cat_festas',
      description: 'Caixas personalizadas com aplique 3D e laço de cetim',
      price: 45.00,
      cost: 15.00,
      productionTime: 3,
      composition: [
        { id: 'comp_1', type: 'insumo', itemId: 'mat_papel_kraft_180', quantity: 2, unit: 'folha' },
        { id: 'comp_2', type: 'insumo', itemId: 'mat_cola_quente', quantity: 0.2, unit: 'bastao' }
      ],
      changeOptions: [
        {
          id: 'opt_cor_laco',
          name: 'Cor do Laço',
          type: 'choice',
          required: true,
          choices: ['Rosa Bebê', 'Azul Tiffany', 'Dourado']
        },
        {
          id: 'opt_acabamento_extra',
          name: 'Tag Especial',
          type: 'choice',
          required: false,
          choices: ['Sem tag extra', 'Tag com foil dourado']
        }
      ],
      personalizationFields: [
        {
          id: 'field_nome',
          name: 'Nome da Criança',
          type: 'text',
          required: true,
          defaultValue: 'Alice'
        },
        {
          id: 'field_idade',
          name: 'Idade',
          type: 'text',
          required: true,
          defaultValue: '5 anos'
        },
        {
          id: 'field_mensagem',
          name: 'Mensagem Opcional',
          type: 'text',
          required: false,
          defaultValue: 'Obrigado pela presença!'
        }
      ],
      editor: {
        textAreas: [
          {
            id: 'area_nome',
            label: 'Nome Central',
            page: 1,
            x: 100,
            y: 200,
            fontSize: 24,
            fontFamily: 'HelveticaBold',
            color: '#db2777',
            personalizationFieldId: 'field_nome'
          },
          {
            id: 'area_idade',
            label: 'Idade',
            page: 1,
            x: 100,
            y: 160,
            fontSize: 16,
            fontFamily: 'Helvetica',
            color: '#831843',
            personalizationFieldId: 'field_idade'
          }
        ]
      }
    };

    const created = createProduct(newProductPayload);
    assert.ok(created.id, 'Produto deve ser criado com ID');
    assert.equal(created.name, 'Kit Lembrancinha Festa Luxo Real');
    assert.equal(created.changeOptions.length, 2);
    assert.equal(created.personalizationFields.length, 3);
    testProductId = created.id;

    // Verificar se recupera do catálogo
    const retrieved = getProductById(testProductId);
    assert.ok(retrieved, 'Produto deve ser recuperado do storage');
    assert.equal(retrieved.price, 45.00);
  });

  // ----------------------------------------------------
  // TESTE DE BORDA: VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS
  // ----------------------------------------------------
  it('Validação: Bloqueia criação de pedido se personalização obrigatória estiver vazia', () => {
    // Tentativa 1: Faltando field_nome
    assert.throws(() => {
      createOrder({
        customer: 'Mariana Silva',
        productId: testProductId,
        qty: 5,
        personalization: {
          field_idade: '5 anos'
        },
        changeOptions: {
          opt_cor_laco: 'Rosa Bebê'
        }
      });
    }, /Informe o campo obrigatório de personalização/i);

    // Tentativa 2: Faltando opt_cor_laco
    assert.throws(() => {
      createOrder({
        customer: 'Mariana Silva',
        productId: testProductId,
        qty: 5,
        personalization: {
          field_nome: 'Helena',
          field_idade: '3 anos'
        },
        changeOptions: {}
      });
    }, /Selecione a opção obrigatória/i);
  });

  // ----------------------------------------------------
  // ETAPA 3: CRIAR PEDIDO REAL
  // ----------------------------------------------------
  it('3. Criar pedido real com cliente, quantidade e personalização válida', () => {
    const orderPayload = {
      customer: 'Mariana Silva',
      productId: testProductId,
      qty: 10,
      notes: 'Entregar com caixas montadas e laços passados',
      personalization: {
        field_nome: 'Helena',
        field_idade: '3 Anos',
        field_mensagem: 'Com carinho, Helena!'
      },
      changeOptions: {
        opt_cor_laco: 'Rosa Bebê',
        opt_acabamento_extra: 'Tag com foil dourado'
      }
    };

    const order = createOrder(orderPayload);
    assert.ok(order.id, 'Pedido deve ser gerado com ID único');
    assert.equal(order.customer, 'Mariana Silva');
    assert.equal(order.qty, 10);
    assert.equal(order.status, 'yellow', 'Status inicial deve ser yellow (aguardando aprovação)');
    assert.ok(order.productSnapshot, 'Pedido deve conter ProductSnapshot congelado');
    assert.equal(order.productSnapshot.name, 'Kit Lembrancinha Festa Luxo Real');
    assert.equal(order.productSnapshot.price, 45.00);
    testOrderId = order.id;
  });

  // ----------------------------------------------------
  // ETAPA 4: GERAR PDF PERSONALIZADO
  // ----------------------------------------------------
  it('4. Gerar PDF personalizado vetorial e validar metadados e integridade', async () => {
    const order = getOrderById(testOrderId);
    const pdfResult = await generatePersonalizedPdf({
      product: order.productSnapshot,
      personalizationData: order.personalization,
      changeOptionsData: order.changeOptions,
      orderId: order.id,
      orderNumber: order.number,
      customerName: order.customer
    });

    assert.ok(pdfResult, 'Resultado do PDF deve ser retornado');
    assert.ok(pdfResult.fileId, 'Deve conter fileId gerado');
    assert.ok(pdfResult.bytes, 'Deve gerar bytes do PDF');
    assert.ok(pdfResult.bytes.length > 100, 'Tamanho do PDF deve ser consistente');
    assert.equal(pdfResult.originalBaseFileId, `base_${order.productSnapshot.productId}`);

    // Vincular arquivo gerado ao pedido
    addGeneratedFileToOrder(order.id, {
      fileId: pdfResult.fileId,
      fileName: pdfResult.fileName || `pedido_${order.number}.pdf`
    });
  });

  // ----------------------------------------------------
  // ETAPA 5 & 6: APROVAR E AVANÇAR PRODUÇÃO
  // ----------------------------------------------------
  it('5 & 6. Aprovar pedido e avançar por todas as etapas da esteira operacional', () => {
    // 5. Aprovar
    const approved = approveOrderById(testOrderId);
    assert.equal(approved.status, 'aprovado', 'Status deve mudar para aprovado');

    // 6. Enviar para Produção (com PDF anexado -> vai para fila de impressão)
    sendOrderToProductionById(testOrderId);
    let current = getOrderById(testOrderId);
    assert.equal(current.production.currentStage, 'impressao');
    assert.equal(current.status, 'aguardando_impressao');

    // Iniciar Impressão na fila
    const printStart = updateOrderPrintJobById(testOrderId, 'iniciar');
    assert.equal(printStart.success, true);
    assert.equal(getOrderById(testOrderId).status, 'imprimindo');

    // Concluir Impressão -> Avança automaticamente para Corte
    const printComplete = updateOrderPrintJobById(testOrderId, 'concluir');
    assert.equal(printComplete.success, true);
    current = getOrderById(testOrderId);
    assert.equal(current.production.currentStage, 'corte');

    // Avançar: Corte -> Vinco
    advanceOrderStageById(testOrderId);
    current = getOrderById(testOrderId);
    assert.equal(current.production.currentStage, 'vinco');

    // Avançar: Vinco -> Montagem
    advanceOrderStageById(testOrderId);
    current = getOrderById(testOrderId);
    assert.equal(current.production.currentStage, 'montagem');

    // Avançar: Montagem -> Acabamento
    advanceOrderStageById(testOrderId);
    current = getOrderById(testOrderId);
    assert.equal(current.production.currentStage, 'acabamento');

    // Avançar: Acabamento -> Conferência (CQ)
    advanceOrderStageById(testOrderId);
    current = getOrderById(testOrderId);
    assert.equal(current.production.currentStage, 'conferencia');
  });

  // ----------------------------------------------------
  // ETAPA 7: CONSUMO E RASTREAMENTO DE ESTOQUE
  // ----------------------------------------------------
  it('7. Consumir materiais do estoque de forma rastreável sem duplicação', () => {
    const order = getOrderById(testOrderId);
    assert.equal(order.production.stockDeducted, true, 'Estoque deve estar marcado como baixado');

    const movements = loadMovements();
    const orderMovements = movements.filter(m => m.orderId === order.id);
    assert.ok(orderMovements.length >= 2, 'Deve registrar movimentos de saída dos 2 insumos');

    // Verificar se os insumos tiveram saída correspondente
    const kraftMov = orderMovements.find(m => m.materialId === 'mat_papel_kraft_180');
    assert.ok(kraftMov, 'Movimento de papel kraft deve existir');
    assert.equal(kraftMov.quantity, 20); // 10 un * 2 folhas

    const colaMov = orderMovements.find(m => m.materialId === 'mat_cola_quente');
    assert.ok(colaMov, 'Movimento de cola quente deve existir');
    assert.equal(colaMov.quantity, 2); // 10 un * 0.2 bastão

    // Testar idempotência
    const idempotentTry = consumeOrderMaterials(order, {
      materials: loadMaterials(),
      components: loadComponents(),
      movements: loadMovements()
    });
    assert.equal(idempotentTry.alreadyDeducted, true, 'Não deve permitir baixa repetida no mesmo pedido');
  });

  // ----------------------------------------------------
  // ETAPA 8: SINCRONIZAÇÃO E BAIXA FINANCEIRA
  // ----------------------------------------------------
  it('8. Registrar venda no Financeiro, verificar Contas a Receber, DRE e efetivar recebimento', () => {
    // Sincronizar financeiro com pedidos
    const receivables = syncReceivablesWithOrders();
    const orderRec = receivables.find(r => String(r.orderId) === String(testOrderId));

    assert.ok(orderRec, 'Conta a receber gerada automaticamente a partir do pedido');
    assert.equal(orderRec.amount, 450.00); // 10 * 45
    assert.equal(orderRec.status, 'aberto');

    // Verificar DRE e Métricas antes do recebimento
    let metrics = calculateFinancialMetrics({ period: 'este_mes' });
    assert.ok(metrics.totalVendas >= 450.00, 'Total de vendas inclui o pedido');
    assert.ok(metrics.aReceberPrevisto >= 450.00, 'Saldo a receber previsto inclui o pedido');

    // Efetivar recebimento (Cliente pagou via Pix)
    const payResult = receiveReceivable(orderRec.id, {
      paidDate: '14/09/2026',
      paymentMethod: 'Pix'
    });

    assert.equal(payResult.success, true);
    assert.equal(payResult.receivable.status, 'recebido');

    // Verificar métricas após recebimento
    metrics = calculateFinancialMetrics({ period: 'este_mes' });
    assert.ok(metrics.entradasRealizadas >= 450.00, 'Entradas realizadas contabilizadas no caixa');
  });

  // ----------------------------------------------------
  // ETAPA 9 & 10: CONTROLE DE QUALIDADE, EMBALAGEM E ENTREGA
  // ----------------------------------------------------
  it('9 & 10. Concluir CQ com aprovação, embalar e marcar pedido como Entregue', () => {
    // 9. CQ aprovado -> avança automaticamente para etapa 'embalagem'
    const qcResult = submitOrderQCById(testOrderId, {
      decision: 'aprovado',
      operator: 'Inspetor Carlos',
      notes: 'Tudo perfeito, cores vivas e laços alinhados'
    });
    assert.equal(qcResult.success, true);
    assert.equal(qcResult.decision, 'aprovado');
    
    let current = getOrderById(testOrderId);
    assert.equal(current.production.currentStage, 'embalagem');

    // Concluir Embalagem -> Avança para Pronto
    advanceOrderStageById(testOrderId);
    current = getOrderById(testOrderId);
    assert.equal(current.production.currentStage, 'pronto');
    assert.equal(current.status, 'pronto');

    // 10. Marcar como Entregue
    const delivered = markOrderDeliveredById(testOrderId);
    assert.equal(delivered.status, 'entregue');
    assert.equal(delivered.statusLabel, 'Entregue');
    assert.ok(delivered.deliveredAt, 'Data de entrega registrada');
  });

  // ----------------------------------------------------
  // ETAPA 11: CONFERÊNCIA GLOBAL DO DASHBOARD
  // ----------------------------------------------------
  it('11. Conferir métricas do Dashboard e integridade global de dados', () => {
    const dashboard = calculateDashboardMetrics();

    assert.ok(dashboard.totalRevenue >= 450.00, 'Receita total do dashboard correta');
    assert.ok(dashboard.todayCount >= 1, 'Contagem de pedidos de hoje consolidada');
  });

  // ----------------------------------------------------
  // TESTES ADICIONAIS DE BORDA E RESILIÊNCIA
  // ----------------------------------------------------
  it('Resiliência: Product Snapshot permanece inalterado se o catálogo for modificado', () => {
    // Alterar o produto no catálogo (aumentar preço e mudar nome)
    updateProduct(testProductId, {
      name: 'Nome Modificado no Futuro',
      price: 99.90
    });

    const catalogProduct = getProductById(testProductId);
    assert.equal(catalogProduct.name, 'Nome Modificado no Futuro');
    assert.equal(catalogProduct.price, 99.90);

    // O pedido passado DEVE manter o snapshot original intacto
    const pastOrder = getOrderById(testOrderId);
    assert.equal(pastOrder.productSnapshot.name, 'Kit Lembrancinha Festa Luxo Real');
    assert.equal(pastOrder.productSnapshot.price, 45.00);
  });

  it('Resiliência: Bloqueio por estoque insuficiente detectado pelo motor', () => {
    const product = getProductById(testProductId);
    const materials = loadMaterials();

    // Simular pedido com quantidade gigantesca (10.000 unidades)
    const hugeOrder = {
      productId: testProductId,
      qty: 10000,
      productSnapshot: product
    };

    const stockCheck = checkOrderStockAvailability(hugeOrder, [product], materials, []);
    assert.equal(stockCheck.sufficient, false, 'Deve acusar falta de estoque');
    assert.ok(stockCheck.missingMaterials.length > 0, 'Deve listar os insumos faltantes');
  });

  it('Resiliência: Atualização de quantidade e cancelamento de pedido', () => {
    const orderPayload = {
      customer: 'Cliente Teste Cancelamento',
      productId: testProductId,
      qty: 2,
      personalization: {
        field_nome: 'Lucas',
        field_idade: '1 ano'
      },
      changeOptions: {
        opt_cor_laco: 'Dourado'
      }
    };

    const newOrder = createOrder(orderPayload);
    assert.equal(newOrder.qty, 2);

    // Atualizar quantidade para 5
    const updated = updateOrder(newOrder.id, { qty: 5 });
    assert.equal(updated.qty, 5);

    // Cancelar pedido via updateOrder
    const cancelled = updateOrder(newOrder.id, { status: 'neutral', statusLabel: 'Cancelado' });
    assert.equal(cancelled.status, 'neutral');
    assert.equal(cancelled.statusLabel, 'Cancelado');
  });

  it('Resiliência: Persistência após recarregar aplicação', () => {
    // Carregar diretamente do storage simulando reload
    const persistedOrders = loadOrders();
    const order = persistedOrders.find(o => String(o.id) === String(testOrderId));

    assert.ok(order, 'Pedido persistido no storage');
    assert.equal(order.customer, 'Mariana Silva');
    assert.equal(order.status, 'entregue');
    assert.equal(order.production.stockDeducted, true);
  });
});
