const puppeteer = require('puppeteer-core');
const path = require('path');

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background: #05050e;
    font-family: 'Inter', system-ui, sans-serif;
    display: flex; align-items: center; justify-content: center;
    position: relative;
  }

  /* Grid lines */
  .grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(0,229,160,.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,229,160,.04) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  /* Glow blobs */
  .blob1 {
    position: absolute; width: 500px; height: 500px; border-radius: 50%;
    background: radial-gradient(circle, rgba(0,229,160,.12) 0%, transparent 70%);
    top: -100px; left: -100px;
  }
  .blob2 {
    position: absolute; width: 400px; height: 400px; border-radius: 50%;
    background: radial-gradient(circle, rgba(59,130,246,.10) 0%, transparent 70%);
    bottom: -80px; right: -80px;
  }

  .content {
    position: relative; z-index: 10;
    display: flex; flex-direction: column;
    align-items: flex-start; padding: 0 80px; width: 100%;
  }

  .badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(0,229,160,.1); border: 1px solid rgba(0,229,160,.3);
    border-radius: 100px; padding: 6px 16px;
    font-size: 13px; font-weight: 600; color: #00e5a0;
    margin-bottom: 28px; letter-spacing: .04em;
  }
  .badge-dot { width: 7px; height: 7px; border-radius: 50%; background: #00e5a0; }

  h1 {
    font-size: 62px; font-weight: 900; line-height: 1.05;
    color: #f1f5f9; margin-bottom: 24px; max-width: 700px;
  }
  h1 span {
    background: linear-gradient(135deg, #00e5a0, #3b82f6, #8b5cf6);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  p {
    font-size: 20px; color: #8892a4; line-height: 1.5;
    max-width: 620px; margin-bottom: 40px;
  }

  .pills { display: flex; gap: 12px; flex-wrap: wrap; }
  .pill {
    background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
    border-radius: 8px; padding: 8px 18px;
    font-size: 14px; font-weight: 600; color: #cbd5e1;
  }

  .domain {
    position: absolute; bottom: 36px; right: 80px;
    font-size: 15px; font-weight: 700; color: rgba(255,255,255,.3);
    letter-spacing: .08em;
  }
</style>
</head>
<body>
<div class="grid"></div>
<div class="blob1"></div>
<div class="blob2"></div>
<div class="content">
  <div class="badge"><div class="badge-dot"></div> México · Automatización &amp; Seguridad</div>
  <h1>Su empresa trabaja.<br><span>Su correo está blindado.</span></h1>
  <p>Automatizamos procesos y protegemos el correo corporativo contra suplantación y phishing. Diagnóstico DNS gratuito en 60 segundos.</p>
  <div class="pills">
    <div class="pill">SPF · DKIM · DMARC</div>
    <div class="pill">n8n Automatización</div>
    <div class="pill">Monitor 24/7</div>
    <div class="pill">Reporte semanal</div>
  </div>
</div>
<div class="domain">trevainnovate.com</div>
</body>
</html>`;

(async () => {
  console.log('Generando og-image.png...');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({
    path: path.join(__dirname, 'og-image.png'),
    type: 'png',
    clip: { x: 0, y: 0, width: 1200, height: 630 }
  });
  await browser.close();
  console.log('✅ og-image.png generada');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
