const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('Iniciando Puppeteer...');

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();

  // Load HTML directly as content to avoid file:// CORS issues with Google Fonts
  const htmlContent = fs.readFileSync(path.join(__dirname, 'presentacion.html'), 'utf8');
  await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait extra for fonts to load
  await new Promise(r => setTimeout(r, 2000));

  const outputPath = path.join(__dirname, 'Trevainnovate_Automatizacion_2026.pdf');

  await page.pdf({
    path: outputPath,
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  await browser.close();
  console.log('PDF generado en:', outputPath);
})().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
