import { jsPDF } from 'jspdf';
import { Order, AtelierSettings, BulkTagItem } from '../types';

export function generateOrderPdf(order: Order, settings: AtelierSettings) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Header Banner
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, 210, 38, 'F');

  // Title & Atelier Name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.name.toUpperCase(), 14, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text(`${settings.slogan} | Tel: ${settings.phone} | Instagram: ${settings.instagram}`, 14, 23);
  doc.text(`CNPJ/CPF: ${settings.document} | Chave Pix: ${settings.pixKey}`, 14, 29);

  // Badge Order Number
  doc.setFillColor(99, 102, 241); // Indigo 500
  doc.roundedRect(145, 10, 52, 18, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEM DE SERVIÇO', 148, 16);
  doc.setFontSize(13);
  doc.text(order.orderNumber, 148, 24);

  // Customer Information Box
  let y = 48;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, 182, 28, 2, 2, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('DADOS DO CLIENTE & ENTREGA', 18, y + 6);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Cliente: ${order.customerName}`, 18, y + 13);
  doc.text(`WhatsApp: ${order.customerWhatsapp}`, 18, y + 19);
  doc.text(`Email: ${order.customerEmail || 'Não informado'}`, 18, y + 25);

  doc.text(`Data do Evento: ${order.eventDate ? new Date(order.eventDate).toLocaleDateString('pt-BR') : 'Não informada'}`, 110, y + 13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(225, 29, 72); // Red
  doc.text(`Prazo de Entrega: ${new Date(order.deliveryDeadline).toLocaleDateString('pt-BR')}`, 110, y + 19);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Forma de Envio: ${order.deliveryMethod.toUpperCase()}`, 110, y + 25);

  // Items Table Header
  y = 84;
  doc.setFillColor(79, 70, 229);
  doc.rect(14, y, 182, 8, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('PRODUTO / PERSONALIZAÇÃO', 18, y + 5.5);
  doc.text('QTD', 135, y + 5.5);
  doc.text('UNIT (R$)', 152, y + 5.5);
  doc.text('TOTAL (R$)', 175, y + 5.5);

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);

  order.items.forEach((item, index) => {
    // Zebra background
    if (index % 2 === 0) {
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, 14, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.text(item.productName, 18, y + 5);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const detail = `Tema: ${item.theme || 'Geral'} | Texto: ${item.customizationText || '-'} ${item.finishings.length > 0 ? '| ' + item.finishings.join(', ') : ''}`;
    doc.text(doc.splitTextToSize(detail, 110), 18, y + 10);

    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(item.quantity.toString(), 138, y + 7);
    doc.text(item.unitPrice.toFixed(2), 154, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.text(item.totalPrice.toFixed(2), 178, y + 7);

    y += 15;
  });

  // Financial Summary Box
  y += 6;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(110, y, 86, 38, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal:', 115, y + 7);
  doc.text(`R$ ${order.subtotal.toFixed(2)}`, 175, y + 7);

  doc.text('Frete / Envio:', 115, y + 13);
  doc.text(`R$ ${order.shippingCost.toFixed(2)}`, 175, y + 13);

  if (order.discount > 0) {
    doc.text('Desconto:', 115, y + 19);
    doc.text(`- R$ ${order.discount.toFixed(2)}`, 175, y + 19);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL DO PEDIDO:', 115, y + 26);
  doc.text(`R$ ${order.totalAmount.toFixed(2)}`, 168, y + 26);

  doc.setFontSize(9);
  doc.setTextColor(16, 185, 129); // Green
  doc.text(`Valor Pago: R$ ${order.amountPaid.toFixed(2)} (${order.paymentStatus.toUpperCase()})`, 115, y + 33);

  // Observations & Notes
  if (order.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('OBSERVAÇÕES DO PEDIDO:', 14, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const splitNotes = doc.splitTextToSize(order.notes, 90);
    doc.text(splitNotes, 14, y + 13);
  }

  // Terms and Signature at Bottom
  const bottomY = 250;
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('TERMOS E CONDIÇÕES:', 14, bottomY);
  doc.text(doc.splitTextToSize(settings.termsAndConditions, 182), 14, bottomY + 4);

  doc.setDrawColor(203, 213, 225);
  doc.line(14, bottomY + 22, 90, bottomY + 22);
  doc.line(110, bottomY + 22, 196, bottomY + 22);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Assinatura do Ateliê', 35, bottomY + 27);
  doc.text('Assinatura / Visto do Cliente', 135, bottomY + 27);

  // Download trigger
  doc.save(`OS_${order.orderNumber}_${order.customerName.replace(/\s+/g, '_')}.pdf`);
}

export function generateTagsPdf(items: BulkTagItem[], settings: AtelierSettings) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  let x = 15;
  let y = 15;
  const tagWidth = 55;
  const tagHeight = 35;
  const marginX = 6;
  const marginY = 6;
  let count = 0;

  items.forEach((item) => {
    for (let i = 0; i < (item.quantity || 1); i++) {
      if (count > 0 && count % 21 === 0) {
        doc.addPage();
        x = 15;
        y = 15;
      }

      // Draw tag container with rounded dash
      doc.setDrawColor(199, 210, 254);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, tagWidth, tagHeight, 3, 3, 'FD');

      // Small punch hole guide
      doc.setDrawColor(203, 213, 225);
      doc.circle(x + tagWidth / 2, y + 4, 1.5, 'S');

      // Atelier watermark or icon
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(165, 180, 252);
      doc.text(settings.name, x + tagWidth / 2, y + 10, { align: 'center' });

      // Name / Main Text
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(item.name, x + tagWidth / 2, y + 19, { align: 'center' });

      // Subtitle / Table / Group
      if (item.subtitle || item.tableOrGroup) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        const sub = item.tableOrGroup ? `${item.subtitle || ''} [${item.tableOrGroup}]` : item.subtitle || '';
        doc.text(sub, x + tagWidth / 2, y + 25, { align: 'center' });
      }

      // Cut marks guide
      doc.setDrawColor(226, 232, 240);
      doc.line(x - 2, y, x + 2, y);
      doc.line(x, y - 2, x, y + 2);

      // Advance
      x += tagWidth + marginX;
      if (x + tagWidth > 200) {
        x = 15;
        y += tagHeight + marginY;
      }
      count++;
    }
  });

  doc.save(`Tags_Personalizadas_PaperMax_${Date.now()}.pdf`);
}
