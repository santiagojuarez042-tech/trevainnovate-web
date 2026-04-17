const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'propuesta-hotel-plaza.html');
const html = fs.readFileSync(file, 'utf8');

// Split into: [before-first-page, page1, page2, ..., pageN, after-last-page]
// Pages are wrapped in <div class="page">...</div>
const parts = html.split(/(?=<div class="page">)/);

const head = parts[0]; // everything before first page (doctype, styles, etc.)

// Each remaining part starts with <div class="page">
// Last item may have </body></html> at the end
const rawPages = parts.slice(1);

// Separate trailing </body></html> from last page
const lastPage = rawPages[rawPages.length - 1];
const closingMatch = lastPage.match(/(<\/body>\s*<\/html>\s*)$/);
const closing = closingMatch ? closingMatch[1] : '';
rawPages[rawPages.length - 1] = lastPage.replace(closing, '');

console.log(`Total páginas encontradas: ${rawPages.length}`);
rawPages.forEach((p, i) => {
  const titleMatch = p.match(/<!-- ══(.+?)══/);
  console.log(`  P${i+1}: ${titleMatch ? titleMatch[1].trim() : '(sin título)'}`);
});

// Índices base-0:
// 0 = Portada
// 1 = Diagnóstico DNS
// 2 = Oportunidades digitales
// 3 = Riesgo BEC
// 4 = Solución (tres módulos)
// 5 = Módulo Web detalle
// 6 = Inversión
// 7 = Timeline
// 8 = Portal
// 9 = Garantía

// Nuevo orden: Portada, Oportunidades, Solución, Web, Inversión, Timeline, DNS, BEC, Portal, Garantía
const newOrder = [0, 2, 4, 5, 6, 7, 1, 3, 8, 9];

const reordered = newOrder.map(i => rawPages[i]);

// Update page numbers in footers: replace "X / 10" with correct number
const updated = reordered.map((page, idx) => {
  return page.replace(/(\d+) \/ 10/, `${idx + 1} / 10`);
});

// Rebuild file
const newHtml = head + updated.join('') + closing;
fs.writeFileSync(file, newHtml, 'utf8');
console.log('\n✅ Páginas reordenadas y numeradas correctamente.');
