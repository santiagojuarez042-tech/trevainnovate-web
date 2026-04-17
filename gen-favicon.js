const puppeteer = require('./node_modules/puppeteer-core');
const path = require('path');
const fs = require('fs');
const os = require('os');

(async () => {
  const chromePath = path.join(os.homedir(), '.cache/puppeteer/chrome-headless-shell/win64-146.0.7680.153/chrome-headless-shell-win64/chrome-headless-shell.exe');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  const svgPath = path.resolve(__dirname, 'logo-icon.svg');
  const fileUrl = 'file:///' + svgPath.split(path.sep).join('/');
  const svgContent = fs.readFileSync(path.join(__dirname, 'logo-icon.svg'), 'utf8');
  await page.setViewport({ width: 400, height: 400 });
  await page.setContent(`<!DOCTYPE html><html><head><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body{width:400px;height:400px;background:#05050e;overflow:hidden;}
    svg{width:400px;height:400px;display:block;}
  </style></head><body>${svgContent}</body></html>`);
  await new Promise(r => setTimeout(r, 400));
  const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 400, height: 400 } });
  fs.writeFileSync(path.join(__dirname, 'favicon.png'), buf);
  console.log('favicon.png OK — bytes:', buf.length);
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
