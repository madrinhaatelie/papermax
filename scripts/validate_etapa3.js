/**
 * PAPER MAX - Script de Validação Operacional Etapa 3.1
 * Executa testes rigorosos de todos os componentes do Motor de PDF e Personalização
 */

import { PDFDocument } from 'pdf-lib';
import crypto from 'crypto';
import { SEED_PRODUCTS, SEED_ORDERS, createSnapshotFromProduct } from '../src/data/seed.js';
import {
  getProductColumns,
  createEmptyItem,
  validateItem,
  validateAllItems,
  generateDynamicCSVTemplate,
  parseAndMapCSV,
  runPersonalizationBatch,
  saveBulkDraft,
  loadBulkDraft,
  clearBulkDraft,
  BULK_DRAFT_KEY
} from '../src/modules/personalization/personalization.engine.js';
import {
  createDefaultBasePdfBytes,
  ensureProductBasePdf,
  generatePersonalizedPdf
} from '../src/modules/personalization/pdf.engine.js';
import { parseCSV } from '../src/utils/csv.js';

// Setup Mock for fileStorage and localStorage in Node environment
const memoryStore = new Map();
globalThis.localStorage = {
  getItem: (key) => memoryStore.get(key) || null,
  setItem: (key, val) => memoryStore.set(key, String(val)),
  removeItem: (key) => memoryStore.delete(key),
  clear: () => memoryStore.clear()
};

const testFileStorage = new Map();
const mockFileStorage = {
  async saveFile(id, blob, metadata) {
    testFileStorage.set(id, { id, blob, metadata });
    return { id, metadata };
  },
  async getFile(id) {
    return testFileStorage.get(id) || null;
  },
  async listFiles() {
    return Array.from(testFileStorage.values());
  }
};

// Replace fileStorage in imported module if possible or test directly
async function runValidationSuite() {
  console.log('=====================================================');
  console.log('  PAPER MAX — VALIDAÇÃO TÉCNICA OPERACIONAL (ETAPA 3.1)');
  console.log('=====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      throw new Error(`Falha no teste: ${message}`);
    }
  }

  // ---------------------------------------------------------------
  // 1. TESTE REAL DO PDF E ESTRUTURA VETORIAL
  // ---------------------------------------------------------------
  console.log('\n--- 1. TESTE REAL DO PDF (VETORIAL & ESTRUTURA) ---');
  const productSacola = SEED_PRODUCTS.find(p => p.id === 'prod_sacola_m');
  assert(productSacola, 'Produto Sacola M encontrado no catálogo base.');

  const defaultBaseBytes = await createDefaultBasePdfBytes(productSacola);
  const pdfHeader = Buffer.from(defaultBaseBytes.slice(0, 5)).toString('ascii');
  assert(pdfHeader.startsWith('%PDF-'), `Estrutura de arquivo válida: cabeçalho "${pdfHeader}" confirmado.`);

  // Carrega e valida páginas e dimensões físicas
  const baseDoc = await PDFDocument.load(defaultBaseBytes);
  const pages = baseDoc.getPages();
  assert(pages.length === 1, `Documento base possui exatamente 1 página (encontradas: ${pages.length}).`);

  const { width, height } = pages[0].getSize();
  assert(Math.round(width) === 595 && Math.round(height) === 842,
    `Dimensões A4 corretas em pontos (Points): ${width} x ${height} pt (~210 x 297 mm).`);

  // ---------------------------------------------------------------
  // 2. PDF BASE IMUTÁVEL (PRESERVAÇÃO DO ARQUIVO ORIGINAL)
  // ---------------------------------------------------------------
  console.log('\n--- 2. PDF BASE IMUTÁVEL & PRESERVAÇÃO DE BYTES ---');
  const baseHashBefore = crypto.createHash('sha256').update(defaultBaseBytes).digest('hex');
  console.log(`  Hash SHA-256 do Gabarito Base Original: ${baseHashBefore.slice(0, 16)}...`);

  // Gera PDF personalizado 1 (Maria, Rosa, Cetim)
  const genResult1 = await generatePersonalizedPdf({
    product: productSacola,
    personalizationData: { field_nome: 'Maria', field_idade: '8' },
    changeOptionsData: { opt_cor: 'Rosa', opt_alca: 'Cetim' },
    orderNumber: 1048,
    customerName: 'Juliana Silva',
    itemIndex: 1
  });

  assert(genResult1.bytes && genResult1.bytes.length > 0, 'PDF 1 (Maria) gerado com sucesso.');
  assert(genResult1.fileId.startsWith('gen_'), `ID único do PDF gerado 1: ${genResult1.fileId}`);
  assert(genResult1.fileName.includes('Maria'), `Nome do arquivo gerado contém dados do cliente: ${genResult1.fileName}`);

  // Verifica se os bytes originais permaneceram 100% inalterados
  const baseHashAfter1 = crypto.createHash('sha256').update(defaultBaseBytes).digest('hex');
  assert(baseHashBefore === baseHashAfter1, 'PDF BASE INTOCADO: Bytes originais permanecem 100% idênticos após gerar item 1.');

  // Gera PDF personalizado 2 (João, Azul, Nylon)
  const genResult2 = await generatePersonalizedPdf({
    product: productSacola,
    personalizationData: { field_nome: 'João', field_idade: '10' },
    changeOptionsData: { opt_cor: 'Azul', opt_alca: 'Nylon' },
    orderNumber: 1049,
    customerName: 'Carlos Eduardo',
    itemIndex: 2
  });

  assert(genResult2.fileId !== genResult1.fileId, 'Cada geração produz um arquivo com ID único e independente.');
  assert(genResult2.fileName !== genResult1.fileName, 'Nomes de arquivo diferenciam pedidos e clientes.');

  const baseHashAfter2 = crypto.createHash('sha256').update(defaultBaseBytes).digest('hex');
  assert(baseHashBefore === baseHashAfter2, 'PDF BASE INTOCADO: Bytes originais permanecem 100% idênticos após gerar item 2.');
  assert(genResult1.bytes.length !== defaultBaseBytes.length, 'PDF Base ≠ PDF Gerado (arquivos e tamanhos distintos).');

  // ---------------------------------------------------------------
  // 3. MOTOR ÚNICO: COLUNAS E REGRAS DO PRODUTO
  // ---------------------------------------------------------------
  console.log('\n--- 3. MOTOR ÚNICO DE DADOS & COLUNAS ---');
  const columns = getProductColumns(productSacola);
  const columnLabels = columns.map(c => c.label);
  console.log('  Colunas oficiais mapeadas:', columnLabels.join(' | '));

  assert(columns.some(c => c.id === 'field_nome' && c.required === true), 'Coluna obrigatória "Nome" mapeada.');
  assert(columns.some(c => c.id === 'field_idade'), 'Coluna "Idade" mapeada.');
  assert(columns.some(c => c.id === 'opt_cor'), 'Opção de alteração "Cor" mapeada.');
  assert(columns.some(c => c.id === 'opt_alca'), 'Opção de alteração "Alça" mapeada.');

  // ---------------------------------------------------------------
  // 4. LISTA RÁPIDA: CRIAÇÃO DINÂMICA & VALIDAÇÃO
  // ---------------------------------------------------------------
  console.log('\n--- 4. LISTA RÁPIDA (FLUXO ENTER & VALIDAÇÃO) ---');
  // Simula digitação sequencial de itens (Maria, João, Ana)
  const item1 = createEmptyItem(productSacola, 1);
  item1.personalization.field_nome = 'Maria';
  item1.personalization.field_idade = '8';
  item1.changeOptions.opt_cor = 'Rosa';
  item1.changeOptions.opt_alca = 'Cetim';

  const item2 = createEmptyItem(productSacola, 2);
  item2.personalization.field_nome = 'João';
  item2.personalization.field_idade = '10';
  item2.changeOptions.opt_cor = 'Azul';
  item2.changeOptions.opt_alca = 'Nylon';

  const item3 = createEmptyItem(productSacola, 3);
  item3.personalization.field_nome = 'Ana';
  item3.personalization.field_idade = '6';
  item3.changeOptions.opt_cor = 'Branco';
  item3.changeOptions.opt_alca = 'Cetim';

  // Item 4 propositalmente inválido (Nome vazio e Opção de cor inválida)
  const item4Invalid = createEmptyItem(productSacola, 4);
  item4Invalid.personalization.field_nome = ''; // Faltando obrigatório
  item4Invalid.changeOptions.opt_cor = 'CorInexistenteRoxa'; // Opção inválida

  const valItem1 = validateItem(item1, productSacola);
  assert(valItem1.isValid === true && valItem1.errors.length === 0, 'Item 1 (Maria) válido.');

  const valItem4 = validateItem(item4Invalid, productSacola);
  assert(valItem4.isValid === false && valItem4.errors.length >= 2,
    `Item 4 inválido detectou ${valItem4.errors.length} erros corretamente (campo obrigatório e opção inválida).`);

  const batchValidation = validateAllItems([item1, item2, item3, item4Invalid], productSacola);
  assert(batchValidation.total === 4, 'Total de 4 itens contabilizados.');
  assert(batchValidation.validCount === 3, '3 itens válidos contabilizados.');
  assert(batchValidation.errorCount === 1, '1 item com erro identificado.');

  // ---------------------------------------------------------------
  // 5. IMPORTAÇÃO E PROCESSAMENTO CSV (PONTO E VÍRGULA, VÍRGULA E BOM)
  // ---------------------------------------------------------------
  console.log('\n--- 5. CSV ENGINE: DELIMITADORES & CABEÇALHOS ---');
  // Modelo dinâmico gerado
  const csvTemplate = generateDynamicCSVTemplate(productSacola);
  assert(csvTemplate.includes('NOME') && csvTemplate.includes('COR'), 'Modelo CSV dinâmico contém cabeçalhos corretos.');

  // CSV brasileiro padrão com ponto e vírgula e BOM
  const rawCsvSemicolon = '\uFEFF' +
    'NOME;IDADE;COR;ELEMENTO;LATERAL DA SACOLA;ALÇA\r\n' +
    'Lucas;7;Kraft;Estrelas;Direita;Cetim\r\n' +
    'Beatriz;9;Rosa;Flores;Ambas;Nylon\r\n';

  const parsedCsv1 = parseAndMapCSV(rawCsvSemicolon, productSacola);
  assert(parsedCsv1.total === 2, `CSV com ";" e BOM parseou 2 linhas (obtido: ${parsedCsv1.total}).`);
  assert(parsedCsv1.validCount === 2, 'Todas as 2 linhas mapeadas com sucesso.');
  assert(parsedCsv1.items[0].personalization.field_nome === 'Lucas', 'Mapeamento de "Lucas" correto.');
  assert(parsedCsv1.items[1].changeOptions.opt_alca === 'Nylon', 'Mapeamento de opção "Nylon" correto.');

  // CSV com vírgula padrão internacional
  const rawCsvComma = 
    'Nome,Idade,Cor,Elemento,Lateral,Alça\n' +
    'Gabriel,5,Azul,Corações,Esquerda,Cetim\n' +
    ',12,Rosa,Flores,Direita,Cetim\n'; // Linha 2 sem nome (deve dar erro)

  const parsedCsv2 = parseAndMapCSV(rawCsvComma, productSacola);
  assert(parsedCsv2.total === 2, 'CSV com "," parseou 2 linhas.');
  assert(parsedCsv2.validCount === 1, 'Linha 1 válida.');
  assert(parsedCsv2.errorCount === 1, 'Linha 2 com erro detectada (Nome vazio).');

  // ---------------------------------------------------------------
  // 6. PROCESSAMENTO ASSÍNCRONO EM LOTE (BATCH PROCESSOR)
  // ---------------------------------------------------------------
  console.log('\n--- 6. PROCESSADOR DE LOTE ASSÍNCRONO ---');
  let progressUpdates = 0;
  const batchResult = await runPersonalizationBatch({
    product: productSacola,
    items: [item1, item2],
    orderNumber: 2001,
    onProgress: (prog) => {
      progressUpdates++;
    }
  });

  assert(batchResult.successCount === 2, `Lote processou com sucesso 2 de 2 itens.`);
  assert(progressUpdates > 0, `Progresso reportado em tempo real (${progressUpdates} eventos disparados).`);
  assert(batchResult.results[0].file.fileName.includes('Maria'), 'Arquivo 1 vinculado a Maria.');
  assert(batchResult.results[1].file.fileName.includes('João'), 'Arquivo 2 vinculado a João.');

  // ---------------------------------------------------------------
  // 7. PRODUCT SNAPSHOT (BLINDAGEM HISTÓRICA)
  // ---------------------------------------------------------------
  console.log('\n--- 7. PRODUCT SNAPSHOT (BLINDAGEM HISTÓRICA) ---');
  const originalProduct = JSON.parse(JSON.stringify(productSacola));
  const snapshot = createSnapshotFromProduct(originalProduct);

  assert(snapshot.productId === originalProduct.id, 'Snapshot armazena ID do produto.');
  assert(snapshot.price === originalProduct.price, 'Snapshot armazena preço congelado.');
  assert(snapshot.editor.textAreas.length === originalProduct.editor.textAreas.length, 'Snapshot congela áreas do molde.');

  // Simula alteração drástica no catálogo
  originalProduct.name = 'Sacola M Super Atualizada 2027';
  originalProduct.price = 99.90;
  originalProduct.editor.textAreas = []; // Removeu áreas do editor

  // O snapshot deve permanecer exatamente como foi gerado
  assert(snapshot.productName === 'Sacola M', 'Nome no snapshot permanece intacto após edição do produto.');
  assert(snapshot.price === 8.50, 'Preço no snapshot permanece R$ 8,50 intacto.');
  assert(snapshot.editor.textAreas.length === 2, 'Áreas do molde no snapshot permanecem intactas (2 áreas).');

  // ---------------------------------------------------------------
  // 8. AUTOSAVE E PERSISTÊNCIA DE RASCUNHOS
  // ---------------------------------------------------------------
  console.log('\n--- 8. AUTOSAVE E DRAFT DO LOTE ---');
  saveBulkDraft(productSacola.id, [item1, item2]);
  const loadedDraft = loadBulkDraft(productSacola.id);
  assert(loadedDraft !== null && loadedDraft.length === 2, 'Rascunho salvo e recuperado com sucesso.');
  assert(loadedDraft[0].personalization.field_nome === 'Maria', 'Dados do rascunho preservados.');

  clearBulkDraft();
  const clearedDraft = loadBulkDraft(productSacola.id);
  assert(clearedDraft === null, 'Rascunho limpo com sucesso.');

  // ---------------------------------------------------------------
  // RESUMO FINAL DOS TESTES
  // ---------------------------------------------------------------
  console.log('\n=====================================================');
  console.log(`  RESULTADO: ${passedTests} de ${totalTests} testes PASSARAM com 100% de sucesso.`);
  console.log('=====================================================\n');
}

runValidationSuite().catch(err => {
  console.error('\n❌ ERRO DURANTE OS TESTES:', err);
  process.exit(1);
});
