import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { LinkReceiptData } from './payment-link.service';

// Server-side comprobante for a paid link. pdfkit is used over a headless
// browser so the receipt has no runtime browser dependency on Railway. The
// document is rendered typographically in the Park Lofts palette: no remote
// logo fetch on the request path, so a receipt never fails because an asset CDN
// is slow. Built-in Helvetica covers the Latin-1 set (accents and the enie), so
// "Autorización" and "número" render correctly without bundling a font.
const CHARCOAL = '#1A1A1A';
const CHARCOAL_500 = '#4A4A4A';
const CHARCOAL_400 = '#6B6B6B';
const GOLD = '#C4A96B';
const STONE = '#E2DDD4';
const CREAM = '#FDFBF8';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const pyg = new Intl.NumberFormat('es-PY', {
  style: 'currency',
  currency: 'PYG',
  maximumFractionDigits: 0
});

export function buildReceiptPdf(data: LinkReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const contentWidth = right - left;

    const paidAt = new Date(data.paidAt);
    const fecha = format(paidAt, "d 'de' MMMM 'de' yyyy", { locale: es });
    const hora = format(paidAt, "HH:mm 'hs'");

    doc.rect(left, 56, 28, 3).fill(GOLD);

    doc
      .fillColor(CHARCOAL)
      .font('Helvetica-Bold')
      .fontSize(22)
      .text('PARK LOFTS', left, 72, { characterSpacing: 4 });

    doc
      .fillColor(GOLD)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('COMPROBANTE DE PAGO', left, 102, { characterSpacing: 3 });

    doc
      .fillColor(CHARCOAL_400)
      .font('Helvetica')
      .fontSize(9)
      .text('Pago aprobado vía Bancard', right - 200, 76, { width: 200, align: 'right' })
      .text(`${fecha}`, right - 200, 90, { width: 200, align: 'right' })
      .text(`${hora}`, right - 200, 102, { width: 200, align: 'right' });

    doc
      .moveTo(left, 128)
      .lineTo(right, 128)
      .lineWidth(1)
      .strokeColor(STONE)
      .stroke();

    let y = 156;

    doc
      .fillColor(CHARCOAL_400)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('CONCEPTO', left, y, { characterSpacing: 2 });
    doc
      .fillColor(CHARCOAL)
      .font('Helvetica')
      .fontSize(14)
      .text(data.concept, left, y + 14, { width: contentWidth });

    y += 56;

    const boxTop = y;
    const boxHeight = 96;
    doc.rect(left, boxTop, contentWidth, boxHeight).fillAndStroke(CREAM, STONE);

    doc
      .fillColor(CHARCOAL_400)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('TOTAL PAGADO', left + 24, boxTop + 22, { characterSpacing: 2 });

    doc
      .fillColor(CHARCOAL)
      .font('Helvetica-Bold')
      .fontSize(30)
      .text(usd.format(data.amountUsd), left + 24, boxTop + 36);

    doc
      .fillColor(CHARCOAL_500)
      .font('Helvetica')
      .fontSize(10)
      .text(
        `Cobrado en guaraníes: ${pyg.format(data.amountPyg)}`,
        left + 24,
        boxTop + boxHeight - 24
      );

    y = boxTop + boxHeight + 40;

    doc
      .fillColor(CHARCOAL_400)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('DETALLE DE LA TRANSACCIÓN', left, y, { characterSpacing: 2 });

    y += 22;

    const rows: Array<[string, string]> = [
      ['Número de autorización', data.authorizationNumber || '—'],
      ['Ticket Bancard', data.ticketNumber || '—'],
      ['ID de proceso', data.shopProcessId || '—'],
      ['Referencia', data.bancardProcessId || '—'],
      ['Estado', 'Aprobado']
    ];

    for (const [label, value] of rows) {
      doc
        .fillColor(CHARCOAL_400)
        .font('Helvetica')
        .fontSize(10)
        .text(label, left, y, { width: contentWidth * 0.5 });
      doc
        .fillColor(label === 'Estado' ? GOLD : CHARCOAL)
        .font(label === 'Estado' ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(10)
        .text(value, left + contentWidth * 0.5, y, {
          width: contentWidth * 0.5,
          align: 'right'
        });

      y += 16;
      doc
        .moveTo(left, y)
        .lineTo(right, y)
        .lineWidth(0.5)
        .strokeColor('#EDEAE4')
        .stroke();
      y += 10;
    }

    // Footer is positioned from the page bottom but well inside the bottom
    // margin so pdfkit never auto-advances to a second page. lineBreak:false on
    // the last write is the belt-and-braces guard against an overflow page.
    const footerY = doc.page.height - doc.page.margins.bottom - 56;
    doc
      .moveTo(left, footerY)
      .lineTo(right, footerY)
      .lineWidth(1)
      .strokeColor(STONE)
      .stroke();

    doc
      .fillColor(CHARCOAL_400)
      .font('Helvetica')
      .fontSize(8)
      .text(
        'Este comprobante certifica un pago aprobado procesado de forma segura por Bancard. No contiene datos de la tarjeta. Conservalo para tus registros.',
        left,
        footerY + 12,
        { width: contentWidth, align: 'left', lineGap: 2 }
      );

    doc
      .fillColor(GOLD)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('PARK LOFTS RENT', left, footerY + 40, {
        characterSpacing: 2,
        lineBreak: false
      });

    doc.end();
  });
}
