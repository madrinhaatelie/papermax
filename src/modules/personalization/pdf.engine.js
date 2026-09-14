/**
 * PAPER MAX - Motor Profissional de PDF (pdf.engine.js)
 * Baseado em pdf-lib para manipulação vetorial real.
 * 
 * Regras estritas:
 * 1. O PDF BASE É SEMPRE IMUTÁVEL.
 * 2. O arquivo base nunca é sobrescrito.
 * 3. Textos, elementos e opções são aplicados nas coordenadas configuradas.
 * 4. O PDF gerado é um arquivo novo e independente, salvo no fileStorage (IndexedDB).
 * 5. Os arquivos gerados ficam vinculados ao pedido e à personalização com metadados completos.
 */

import { fileStorage } from '../../data/filestorage.js';

// Helper to get PDFLib instance across browser and Node.js
async function getPDFLib() {
  if (typeof window !== 'undefined' && window.PDFLib) {
    return window.PDFLib;
  }
  try {
    const lib = await import('pdf-lib');
    return lib;
  } catch (err) {
    if (typeof window !== 'undefined' && window.PDFLib) {
      return window.PDFLib;
    }
    throw new Error('Biblioteca pdf-lib não encontrada.');
  }
}

/**
 * Converte cor hex (#RRGGBB) para valores rgb normalizados (0-1) do pdf-lib.
 */
function hexToPdfRgb(hex, PDFLib) {
  if (!hex || typeof hex !== 'string') return PDFLib.rgb(0.1, 0.1, 0.1);
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length !== 6) return PDFLib.rgb(0.1, 0.1, 0.1);
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return PDFLib.rgb(
    isNaN(r) ? 0.1 : r,
    isNaN(g) ? 0.1 : g,
    isNaN(b) ? 0.1 : b
  );
}

/**
 * Mapeia fontes padrão do pdf-lib com base na família configurada no produto.
 */
function mapStandardFont(fontFamily, isBold = false, PDFLib) {
  const family = (fontFamily || '').toLowerCase();
  if (family.includes('serif') || family.includes('playfair') || family.includes('cinzel') || family.includes('times')) {
    return isBold ? PDFLib.StandardFonts.TimesRomanBold : PDFLib.StandardFonts.TimesRoman;
  }
  if (family.includes('mono') || family.includes('courier')) {
    return isBold ? PDFLib.StandardFonts.CourierBold : PDFLib.StandardFonts.Courier;
  }
  return isBold ? PDFLib.StandardFonts.HelveticaBold : PDFLib.StandardFonts.Helvetica;
}

/**
 * Gera um PDF Base padrão de alta fidelidade visual (vetorial) para produtos que
 * ainda não possuem arquivo carregado manualmente pelo usuário.
 */
export async function createDefaultBasePdfBytes(product) {
  const PDFLib = await getPDFLib();
  const { PDFDocument, rgb, StandardFonts } = PDFLib;

  const doc = await PDFDocument.create();
  // Standard A4 portrait: 595.28 x 841.89 points (210 x 297 mm)
  const width = product.basePdfMetadata?.width || 595.28;
  const height = product.basePdfMetadata?.height || 841.89;
  const page = doc.addPage([width, height]);

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontTitle = await doc.embedFont(StandardFonts.TimesRomanBold);

  // Background subtle tint
  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: height - 40,
    borderColor: rgb(0.85, 0.82, 0.78),
    borderWidth: 1,
    color: rgb(0.99, 0.985, 0.97)
  });

  // Header banner
  page.drawRectangle({
    x: 35,
    y: height - 90,
    width: width - 70,
    height: 55,
    color: rgb(0.95, 0.93, 0.90)
  });

  page.drawText('PAPER MAX · GABARITO OFICIAL DE PRODUÇÃO', {
    x: 50,
    y: height - 60,
    size: 14,
    font: fontBold,
    color: rgb(0.35, 0.25, 0.20)
  });

  page.drawText(`Produto Base: ${product.name.toUpperCase()} (v${product.configurationVersion || 1})`, {
    x: 50,
    y: height - 78,
    size: 10,
    font: fontRegular,
    color: rgb(0.50, 0.45, 0.40)
  });

  // Mock template frame representing the physical product (e.g. Sacola M)
  const bagX = (width - 360) / 2;
  const bagY = 160;
  const bagW = 360;
  const bagH = 500;

  // Bag shape outline
  page.drawRectangle({
    x: bagX,
    y: bagY,
    width: bagW,
    height: bagH,
    borderColor: rgb(0.70, 0.60, 0.50),
    borderWidth: 1.5,
    color: rgb(0.98, 0.96, 0.93)
  });

  // Bag top fold / crease guideline
  page.drawLine({
    start: { x: bagX, y: bagY + bagH - 45 },
    end: { x: bagX + bagW, y: bagY + bagH - 45 },
    thickness: 1,
    color: rgb(0.80, 0.75, 0.70),
    dashArray: [4, 4]
  });

  // Bag bottom reinforcement guideline
  page.drawLine({
    start: { x: bagX, y: bagY + 60 },
    end: { x: bagX + bagW, y: bagY + 60 },
    thickness: 1,
    color: rgb(0.80, 0.75, 0.70),
    dashArray: [4, 4]
  });

  // Handle placement markers
  page.drawCircle({
    x: bagX + 90,
    y: bagY + bagH - 25,
    size: 5,
    borderColor: rgb(0.6, 0.5, 0.4),
    borderWidth: 1.5,
    color: rgb(0.9, 0.85, 0.8)
  });
  page.drawCircle({
    x: bagX + bagW - 90,
    y: bagY + bagH - 25,
    size: 5,
    borderColor: rgb(0.6, 0.5, 0.4),
    borderWidth: 1.5,
    color: rgb(0.9, 0.85, 0.8)
  });

  // Decorative border in center
  page.drawRectangle({
    x: bagX + 30,
    y: bagY + 120,
    width: bagW - 60,
    height: 250,
    borderColor: rgb(0.82, 0.78, 0.72),
    borderWidth: 0.8
  });

  // Footer metadata
  page.drawText('PAPER MAX · Sistema Operacional da Papelaria Personalizada · Impressão Profissional', {
    x: 45,
    y: 35,
    size: 8,
    font: fontRegular,
    color: rgb(0.6, 0.6, 0.6)
  });

  return await doc.save();
}

/**
 * Garante que o arquivo base do produto existe no fileStorage.
 * Se ainda não existir, cria e salva o gabarito original.
 * O PDF BASE NUNCA É SOBRESCRITO.
 */
export async function ensureProductBasePdf(product) {
  const prodId = product.id || product.productId || 'default';
  const baseId = product.basePdfMetadata?.id || `base_${prodId}`;
  const existing = await fileStorage.getFile(baseId);

  if (existing && existing.blob) {
    const arrayBuffer = await existing.blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  // Gera o PDF base padrão e armazena no IndexedDB de forma imutável
  const baseBytes = await createDefaultBasePdfBytes(product);
  const blob = new Blob([baseBytes], { type: 'application/pdf' });
  const fileName = product.basePdfMetadata?.name || `gabarito_base_${prodId}.pdf`;

  await fileStorage.saveFile(baseId, blob, {
    name: fileName,
    productId: prodId,
    isBaseTemplate: true,
    immutable: true,
    createdAt: new Date().toISOString()
  });

  return baseBytes;
}

/**
 * Salva um PDF base enviado pelo usuário (upload de arquivo .pdf)
 * Preservando o nome e metadados no IndexedDB.
 */
export async function uploadCustomBasePdf(product, file) {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('O arquivo base deve ser um arquivo em formato PDF.');
  }

  const baseId = `base_${product.id}_${Date.now()}`;
  const blob = file instanceof Blob ? file : new Blob([file], { type: 'application/pdf' });

  const PDFLib = await getPDFLib();
  const arrayBuffer = await blob.arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(new Uint8Array(arrayBuffer));
  const pages = doc.getPages();
  const firstPage = pages[0];
  const { width, height } = firstPage.getSize();

  await fileStorage.saveFile(baseId, blob, {
    name: file.name,
    productId: product.id,
    isBaseTemplate: true,
    immutable: true,
    pageCount: pages.length,
    width,
    height,
    createdAt: new Date().toISOString()
  });

  return {
    id: baseId,
    name: file.name,
    size: blob.size,
    pageCount: pages.length,
    width,
    height,
    uploadedAt: new Date().toISOString()
  };
}

/**
 * MOTOR DE GERAÇÃO PROFISSIONAL DE PDF
 * 
 * Carrega o PDF base (NUNCA o sobrescreve).
 * Aplica:
 * - Áreas de texto (com alinhamento, fonte, tamanho, cor, quebra/dimensão)
 * - Informações de opções de alteração (cor, alça, acabamento, etc.)
 * - Metadados da personalização
 * 
 * Gera um NOVO arquivo e o salva no fileStorage.
 */
export async function generatePersonalizedPdf({
  product,
  personalizationData = {},
  changeOptionsData = {},
  orderId = null,
  orderNumber = null,
  customerName = '',
  itemIndex = 1
}) {
  if (!product) throw new Error('Produto não informado para geração de PDF.');

  const PDFLib = await getPDFLib();
  const { PDFDocument, rgb } = PDFLib;

  // 1. Carrega bytes do PDF Base (arquivo original imutável)
  const baseBytes = await ensureProductBasePdf(product);

  // 2. Cria documento independente a partir dos bytes originais (sem alterar o original)
  const doc = await PDFDocument.load(baseBytes);
  const pages = doc.getPages();
  if (pages.length === 0) throw new Error('O PDF base não contém páginas.');

  const targetPage = pages[0];
  const { width: pageWidth, height: pageHeight } = targetPage.getSize();

  // 3. Aplica áreas de texto configuradas no produto
  const textAreas = product.editor?.textAreas || [];
  const fields = product.personalizationFields || [];

  for (const area of textAreas) {
    // Resolve o valor a partir do personalizationFieldId ou id/name
    let textValue = '';
    if (area.personalizationFieldId && personalizationData[area.personalizationFieldId] !== undefined) {
      textValue = String(personalizationData[area.personalizationFieldId]);
    } else if (personalizationData[area.id] !== undefined) {
      textValue = String(personalizationData[area.id]);
    } else if (personalizationData[area.name] !== undefined) {
      textValue = String(personalizationData[area.name]);
    } else {
      // Procura pelo nome ou label correspondente no fields
      const matchingField = fields.find(f => f.id === area.personalizationFieldId || f.name === area.name);
      if (matchingField && personalizationData[matchingField.id] !== undefined) {
        textValue = String(personalizationData[matchingField.id]);
      } else if (matchingField && personalizationData[matchingField.name] !== undefined) {
        textValue = String(personalizationData[matchingField.name]);
      }
    }

    if (!textValue || !textValue.trim()) continue;

    const isBold = area.fontWeight === 'bold' || area.isBold === true;
    const fontName = mapStandardFont(area.fontFamily, isBold, PDFLib);
    const font = await doc.embedFont(fontName);
    const fontSize = Number(area.fontSize) || 18;
    const fontColor = hexToPdfRgb(area.color || '#1e293b', PDFLib);

    // Converte coordenadas se configuradas a partir do topo
    // Suporta sistema top-down com base no pageHeight
    const areaX = Number(area.x) || 50;
    const areaYTop = Number(area.y) || 200;
    const areaW = Number(area.width) || 300;
    const areaH = Number(area.height) || 40;

    // Em PDF-Lib: y=0 é na base inferior. Se y configurado for no estilo topo da página:
    const pdfY = area.isPdfNativeCoords
      ? areaYTop
      : pageHeight - areaYTop - (fontSize * 0.9);

    const textWidth = font.widthOfTextAtSize(textValue, fontSize);

    let drawX = areaX;
    if (area.alignment === 'center') {
      drawX = areaX + (areaW - textWidth) / 2;
    } else if (area.alignment === 'right') {
      drawX = areaX + areaW - textWidth;
    }

    // Desenha o texto principal personalizado
    targetPage.drawText(textValue, {
      x: Math.max(10, drawX),
      y: Math.max(10, pdfY),
      size: fontSize,
      font,
      color: fontColor
    });
  }

  // 4. Se o produto não tiver textAreas configuradas mas tiver campos de personalização preenchidos,
  // desenha automaticamente na área central do produto para garantir que o texto seja impresso
  if (textAreas.length === 0) {
    const fontBold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const fontRegular = await doc.embedFont(PDFLib.StandardFonts.Helvetica);

    let currentY = pageHeight - 340;
    for (const field of fields) {
      const val = personalizationData[field.id] || personalizationData[field.name];
      if (val) {
        const text = String(val);
        const fontSize = field.id.includes('nome') ? 24 : 16;
        const font = field.id.includes('nome') ? fontBold : fontRegular;
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const centeredX = (pageWidth - textWidth) / 2;

        targetPage.drawText(text, {
          x: Math.max(20, centeredX),
          y: currentY,
          size: fontSize,
          font,
          color: rgb(0.2, 0.15, 0.12)
        });

        currentY -= (fontSize + 12);
      }
    }
  }

  // 5. Aplica selo discreto de especificações técnicas das Opções de Alteração na lateral
  const changeOptions = product.changeOptions || [];
  const optionsEntries = Object.entries(changeOptionsData);

  if (optionsEntries.length > 0) {
    const fontSmall = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const fontSmallBold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);

    // Caixa de especificações técnicas do acabamento (rodapé lateral)
    const boxX = 35;
    const boxY = 55;
    const boxW = pageWidth - 70;
    const boxH = 34;

    targetPage.drawRectangle({
      x: boxX,
      y: boxY,
      width: boxW,
      height: boxH,
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 0.8,
      color: rgb(0.97, 0.97, 0.97)
    });

    targetPage.drawText('ESPECIFICAÇÕES DE ACABAMENTO / PRODUÇÃO:', {
      x: boxX + 8,
      y: boxY + boxH - 12,
      size: 7,
      font: fontSmallBold,
      color: rgb(0.4, 0.4, 0.4)
    });

    const optTexts = optionsEntries.map(([optId, optVal]) => {
      const optDef = changeOptions.find(o => o.id === optId || o.name === optId);
      const optName = optDef ? optDef.name : optId;
      return `${optName}: ${optVal}`;
    }).join('  |  ');

    targetPage.drawText(optTexts, {
      x: boxX + 8,
      y: boxY + 8,
      size: 8,
      font: fontSmall,
      color: rgb(0.2, 0.2, 0.2)
    });
  }

  // 6. Cabeçalho de identificação com número do pedido e cliente
  const fontMeta = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const orderDisplay = orderNumber ? `Pedido ${orderNumber}` : (orderId ? `Pedido ${orderId}` : 'Produção Avulsa');
  const clientDisplay = customerName ? `Cliente: ${customerName}` : '';
  const itemDisplay = `Item ${itemIndex}`;
  const metaString = `${orderDisplay} · ${clientDisplay} · ${itemDisplay} · Gerado em ${new Date().toLocaleDateString('pt-BR')}`;

  targetPage.drawText(metaString, {
    x: 35,
    y: pageHeight - 30,
    size: 8,
    font: fontMeta,
    color: rgb(0.5, 0.5, 0.5)
  });

  // 7. Salva o PDF novo gerado
  const generatedPdfBytes = await doc.save();
  const generatedBlob = new Blob([generatedPdfBytes], { type: 'application/pdf' });

  // 8. Cria metadados e armazena no fileStorage com chave única
  const prodId = product.id || product.productId || 'default';
  const baseFileId = product.basePdfMetadata?.id || `base_${prodId}`;
  const safeName = (personalizationData.field_nome || personalizationData.nome || customerName || `Item_${itemIndex}`)
    .toString().replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚãõÃÕâêîôûÂÊÎÔÛçÇ\-_]/g, '_');
  const fileName = `${orderDisplay} - ${product.name} - ${safeName}.pdf`;
  const generatedFileId = `gen_${prodId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  await fileStorage.saveFile(generatedFileId, generatedBlob, {
    name: fileName,
    size: generatedBlob.size,
    productId: prodId,
    productName: product.name,
    originalBaseFileId: baseFileId,
    orderId: orderId || null,
    orderNumber: orderNumber || null,
    customerName: customerName || '',
    personalizationData,
    changeOptionsData,
    createdAt: new Date().toISOString()
  });

  return {
    fileId: generatedFileId,
    fileName,
    blob: generatedBlob,
    size: generatedBlob.size,
    bytes: generatedPdfBytes,
    originalBaseFileId: baseFileId,
    createdAt: new Date().toISOString()
  };
}

/**
 * Dispara o download de um PDF gerado diretamente no navegador do usuário.
 */
export function triggerPdfDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'documento_personalizado.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
