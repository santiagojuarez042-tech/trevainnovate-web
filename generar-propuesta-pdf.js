const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

// Configura los parámetros de la propuesta aquí o pásalos como args
// Uso: node generar-propuesta-pdf.js "Empresa X" "Juan García" "empresa.com" "fail" "fail" "ok" "30" "combo"
const [,, cliente, contacto, dominio, spf, dmarc, dkim, score, servicio] = process.argv;

const params = new URLSearchParams({
  cliente:  cliente  || 'Empresa Demo',
  contacto: contacto || 'Gerente General',
  dominio:  dominio  || 'empresademo.com',
  spf:      spf      || 'fail',
  dmarc:    dmarc    || 'fail',
  dkim:     dkim     || 'ok',
  score:    score    || '30',
  servicio: servicio || 'combo',
  fecha:    new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
});

const clienteSlug = (cliente || 'demo').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
const outputName  = `Propuesta_Trevainnovate_${clienteSlug}_${new Date().toISOString().slice(0,10)}.pdf`;
const outputPath  = path.join(__dirname, outputName);

(async () => {
  console.log('Generando propuesta para:', cliente || 'Empresa Demo');
  console.log('Parámetros:', Object.fromEntries(params));

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();

  // Read and inject params into HTML via base tag + query string simulation
  let htmlContent = fs.readFileSync(path.join(__dirname, 'propuesta.html'), 'utf8');

  // Inject a script before </head> to pre-set window.location.search
  const injection = `<script>
    // Simula URL params para generación offline
    Object.defineProperty(window, '__PDF_PARAMS__', { value: '${params.toString()}' });
  </script>`;
  htmlContent = htmlContent.replace('</head>', injection + '\n</head>');

  // Patch URLSearchParams usage: replace new URLSearchParams(window.location.search)
  // with new URLSearchParams(window.__PDF_PARAMS__ || window.location.search)
  htmlContent = htmlContent.replace(
    /new URLSearchParams\(window\.location\.search\)/g,
    'new URLSearchParams(window.__PDF_PARAMS__ || window.location.search)'
  );

  await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });

  // Extra wait for fonts + JS rendering
  await new Promise(r => setTimeout(r, 3000));

  await page.pdf({
    path: outputPath,
    format: 'A4',
    landscape: false,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  await browser.close();
  console.log('✅ PDF generado:', outputPath);
})().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
