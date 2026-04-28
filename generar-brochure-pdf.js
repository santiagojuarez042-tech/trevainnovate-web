const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('Generando brochure Trev\'ainnovate...');

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();

  const htmlContent = fs.readFileSync(path.join(__dirname, 'brochure.html'), 'utf8');
  await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });

  // Esperar fonts
  await new Promise(r => setTimeout(r, 2500));

  const outputPath = path.join(__dirname, 'Trevainnovate_Brochure_2026.pdf');

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
