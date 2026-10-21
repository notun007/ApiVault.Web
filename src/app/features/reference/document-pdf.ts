import { jsPDF } from 'jspdf';
import { documentBlocks } from './api-document';

export function createDocumentPdf(document: Record<string, any>): Blob {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const title = String(document['info']['title']);
  const version = String(document['info']['version']);
  pdf.setProperties({ title: `${title} - ${version}`, subject: 'API release documentation', author: 'ApiVault', creator: 'ApiVault' });
  let y = 30;
  const pageHeight = 297;
  const addPage = () => { pdf.addPage(); y = 30; };
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(21);
  const titleLines = pdf.splitTextToSize(title, 172) as string[];
  pdf.setTextColor(21, 42, 61);
  for (const line of titleLines) { pdf.text(line, 19, y); y += 9; }
  pdf.setFontSize(11);
  pdf.setTextColor(13, 118, 110);
  pdf.text(`API documentation | Release ${version}`, 19, y + 1);
  y += 15;
  for (const block of documentBlocks(document)) {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12);
    const heading = pdf.splitTextToSize(block.title, 172) as string[];
    if (y + heading.length * 6 + 14 > pageHeight - 22) addPage();
    pdf.setTextColor(13, 118, 110);
    for (const line of heading) { pdf.text(line, 19, y); y += 6; }
    y += 2;
    pdf.setFont(block.code ? 'courier' : 'helvetica', 'normal');
    pdf.setFontSize(block.code ? 8 : 10);
    pdf.setTextColor(40, 55, 68);
    const lines = pdf.splitTextToSize(block.text, 172) as string[];
    const lineHeight = block.code ? 3.8 : 4.8;
    for (const line of lines) {
      if (y + lineHeight > pageHeight - 22) addPage();
      pdf.text(line, 19, y); y += lineHeight;
    }
    y += 9;
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(100, 116, 130);
    pdf.text(pdf.splitTextToSize(`${title} | ${version}`, 170)[0], 19, 15);
    pdf.setDrawColor(220, 229, 235); pdf.line(19, 19, 191, 19); pdf.line(19, 280, 191, 280);
    pdf.text('ApiVault | Catalog-generated reference', 19, 286);
    pdf.text(`${page} / ${pages}`, 191, 286, { align: 'right' });
  }
  return pdf.output('blob');
}
