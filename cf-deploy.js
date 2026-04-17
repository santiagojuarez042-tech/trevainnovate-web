const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const PROJECT = 'trevainnovate';
const DIR = __dirname;

const FILES = ['index.html','presentacion.html','favicon.png','logo-icon.svg','logo-wordmark.svg'];

function getMime(f) {
  if (f.endsWith('.html')) return 'text/html';
  if (f.endsWith('.svg'))  return 'image/svg+xml';
  if (f.endsWith('.png'))  return 'image/png';
  return 'application/octet-stream';
}

const manifest = {};
const fileData = {};
FILES.forEach(f => {
  const fullPath = path.join(DIR, f);
  if (fs.existsSync(fullPath)) {
    const buf = fs.readFileSync(fullPath);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    manifest['/' + f] = hash;
    fileData[f] = { buf, mime: getMime(f) };
  }
});

console.log('Files:', Object.keys(manifest));

// Build multipart/form-data manually
const boundary = '----CFPagesBoundary' + crypto.randomBytes(8).toString('hex');
const CRLF = '\r\n';

function fieldPart(name, value) {
  return Buffer.concat([
    Buffer.from(`--${boundary}${CRLF}`),
    Buffer.from(`Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}`),
    Buffer.from(value),
    Buffer.from(CRLF)
  ]);
}

function filePart(name, filename, mime, buf) {
  return Buffer.concat([
    Buffer.from(`--${boundary}${CRLF}`),
    Buffer.from(`Content-Disposition: form-data; name="${name}"; filename="${filename}"${CRLF}`),
    Buffer.from(`Content-Type: ${mime}${CRLF}${CRLF}`),
    buf,
    Buffer.from(CRLF)
  ]);
}

const parts = [];
parts.push(fieldPart('branch', 'main'));
parts.push(fieldPart('manifest', JSON.stringify(manifest)));
Object.entries(fileData).forEach(([name, {buf, mime}]) => {
  parts.push(filePart(name, name, mime, buf));
});
parts.push(Buffer.from(`--${boundary}--${CRLF}`));

const body = Buffer.concat(parts);

const opts = {
  hostname: 'api.cloudflare.com',
  path: `/client/v4/accounts/${ACCOUNT}/pages/projects/${PROJECT}/deployments`,
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + TOKEN,
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length
  }
};

console.log('Uploading...');
const req = https.request(opts, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const result = JSON.parse(data);
    if (result.success) {
      console.log('✅ Deploy OK!');
      console.log('URL:', result.result.url);
      console.log('ID:', result.result.id);
    } else {
      console.error('❌ Errors:', JSON.stringify(result.errors, null, 2));
    }
  });
});
req.on('error', e => console.error('Request error:', e.message));
req.write(body);
req.end();
