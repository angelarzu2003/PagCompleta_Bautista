/**
 * Generador mínimo de PDF (texto plano, Helvetica) sin dependencias externas.
 * Se usa para crear los documentos semilla y las constancias descargables.
 */

const esc = s =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // la fuente base no trae acentos: se transliteran
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

function wrap(text, width = 92) {
  const out = [];
  for (const paragraph of String(text).split('\n')) {
    if (!paragraph.trim()) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if ((line + ' ' + word).trim().length > width) {
        out.push(line);
        line = word;
      } else {
        line = (line + ' ' + word).trim();
      }
    }
    if (line) out.push(line);
  }
  return out;
}

/**
 * @param {string} title
 * @param {string[]|string} body  Párrafos del documento
 * @returns {Buffer}
 */
export function buildPdf(title, body) {
  const lines = [
    { text: title, size: 15, bold: true },
    { text: '', size: 10 },
    ...wrap(Array.isArray(body) ? body.join('\n') : body).map(t => ({ text: t, size: 10 })),
  ];

  // Paginación a ~60 líneas por página
  const pages = [];
  for (let i = 0; i < lines.length; i += 60) pages.push(lines.slice(i, i + 60));

  const objects = [];
  const add = content => {
    objects.push(content);
    return objects.length;
  };

  const catalogId = add(null);
  const pagesId = add(null);
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBoldId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const pageIds = [];
  pages.forEach((pageLines, idx) => {
    let y = 800;
    let stream = 'BT\n';
    for (const l of pageLines) {
      stream += `/${l.bold ? 'F2' : 'F1'} ${l.size} Tf 1 0 0 1 50 ${y} Tm (${esc(l.text)}) Tj\n`;
      y -= l.size + 4;
    }
    stream += `/F1 8 Tf 1 0 0 1 50 30 Tm (URPMP - Plataforma de Proyectos de Investigacion - Pagina ${idx + 1} de ${pages.length}) Tj\nET`;
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    const pageId = add(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
