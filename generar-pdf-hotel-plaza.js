const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const outputName = `Propuesta_HotelPlazaArmas_Trevainnovate_${new Date().toISOString().slice(0,10)}.pdf`;
const outputPath = path.join(__dirname, outputName);

(async () => {
  console.log('Generando propuesta Hotel Plaza de Armas...');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });
  const page = await browser.newPage();
  const htmlContent = fs.readFileSync(path.join(__dirname, 'propuesta-hotel-plaza.html'), 'utf8');
  await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });
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
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
