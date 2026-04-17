#!/usr/bin/env node
/**
 * Trev'ainnovate — Generador de artículos SEO con Claude
 * Uso: node generar-articulo.js "tema del artículo"
 * Ejemplo: node generar-articulo.js "DMARC para empresas en México 2026"
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const GROQ_KEY = process.env.GROQ_KEY;
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_BLOG_DB = '3422a696-1b16-814f-9926-c628b9a3ee7d';
const BLOG_DIR = path.join(__dirname, 'blog');
const ARTICLES_FILE = path.join(BLOG_DIR, 'articles.json');

function addToNotion(article) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      parent: { database_id: NOTION_BLOG_DB },
      properties: {
        'Titulo': { title: [{ text: { content: article.title } }] },
        'Slug': { rich_text: [{ text: { content: article.slug } }] },
        'URL': { url: 'https://trevainnovate.com/blog/' + article.slug },
        'Estado': { select: { name: 'Por revisar' } },
        'Tags': { multi_select: article.tags.map(t => ({ name: t })) },
        'Fecha': { date: { start: article.date } },
        'Tiempo de lectura': { number: article.readTime }
      }
    });
    const req = https.request({
      hostname: 'api.notion.com', path: '/v1/pages', method: 'POST',
      headers: { 'Authorization': 'Bearer ' + NOTION_TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => { let d = ''; res.on('data', c => d += c).on('end', () => { const r = JSON.parse(d); resolve(r.id ? true : false); }); });
    req.on('error', () => resolve(false));
    req.write(body); req.end();
  });
}
const topic = process.argv[2];
if (!topic) {
  console.error('❌ Falta el tema. Uso:\n  node generar-articulo.js "DMARC para empresas en México"');
  process.exit(1);
}

function callGroq(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });
    const req = https.request({
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(d);
          if (r.error) return reject(new Error(r.error.message));
          resolve(r.choices[0].message.content);
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function buildArticleHTML({ title, slug, description, date, readTime, tags, intro, sections, cta_text }) {
  const tagsHTML = tags.map(t => `<span class="tag">${t}</span>`).join('');
  const sectionsHTML = sections.map(s => `
    <h2>${s.heading}</h2>
    ${s.paragraphs.map(p => `<p>${p}</p>`).join('\n    ')}
    ${s.list ? `<ul>${s.list.map(i => `<li>${i}</li>`).join('')}</ul>` : ''}
  `).join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} | Trev'ainnovate</title>
<meta name="description" content="${description}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://trevainnovate.com/blog/${slug}">
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="https://trevainnovate.com/blog/${slug}">
<meta property="og:image" content="https://trevainnovate.com/og-image.png">
<meta property="og:site_name" content="Trev'ainnovate">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "${title}",
  "description": "${description}",
  "datePublished": "${date}",
  "author": { "@type": "Organization", "name": "Trev'ainnovate", "url": "https://trevainnovate.com" },
  "publisher": { "@type": "Organization", "name": "Trev'ainnovate", "logo": { "@type": "ImageObject", "url": "https://trevainnovate.com/favicon.png" } },
  "mainEntityOfPage": "https://trevainnovate.com/blog/${slug}"
}
</script>
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#05050e;--bg2:#0b0b1c;--bg3:#111128;--green:#00e5a0;--blue:#3b82f6;--purple:#8b5cf6;--white:#f1f5f9;--muted:#8892a4;--border:rgba(255,255,255,0.07)}
html{scroll-behavior:smooth}
body{background:var(--bg);font-family:'Inter',sans-serif;color:var(--white);-webkit-font-smoothing:antialiased;line-height:1.7}
a{color:var(--green);text-decoration:none}
a:hover{text-decoration:underline}

.nav{padding:20px 0;border-bottom:1px solid var(--border);margin-bottom:0}
.nav-inner{max-width:760px;margin:0 auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between}
.nav-logo{font-size:15px;font-weight:800;color:var(--white);text-decoration:none}
.nav-logo span{color:var(--green)}
.nav-back{font-size:13px;color:var(--muted);display:flex;align-items:center;gap:6px}
.nav-back:hover{color:var(--white);text-decoration:none}

.hero{background:linear-gradient(180deg,var(--bg2) 0%,var(--bg) 100%);padding:52px 0 40px;border-bottom:1px solid var(--border)}
.hero-inner{max-width:760px;margin:0 auto;padding:0 24px}
.tags{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}
.tag{font-size:11px;font-weight:600;padding:4px 12px;border-radius:100px;background:rgba(0,229,160,.1);border:1px solid rgba(0,229,160,.2);color:var(--green);text-transform:uppercase;letter-spacing:.06em}
h1{font-size:clamp(26px,4vw,40px);font-weight:900;line-height:1.1;margin-bottom:16px;color:var(--white)}
.meta{font-size:13px;color:var(--muted);display:flex;gap:16px;flex-wrap:wrap}
.meta span{display:flex;align-items:center;gap:5px}

.content{max-width:760px;margin:0 auto;padding:48px 24px 80px}
.intro{font-size:18px;line-height:1.7;color:#cbd5e1;margin-bottom:40px;padding-bottom:32px;border-bottom:1px solid var(--border)}
h2{font-size:22px;font-weight:800;margin:40px 0 14px;color:var(--white);line-height:1.2}
p{font-size:16px;color:#94a3b8;margin-bottom:18px;line-height:1.75}
ul,ol{margin:0 0 20px 24px}
li{font-size:16px;color:#94a3b8;margin-bottom:10px;line-height:1.65}
strong{color:var(--white);font-weight:600}

.highlight{background:var(--bg2);border:1px solid var(--border);border-left:3px solid var(--green);border-radius:8px;padding:20px 24px;margin:28px 0}
.highlight p{margin:0;color:#cbd5e1}

.cta-box{background:linear-gradient(135deg,rgba(0,229,160,.08),rgba(59,130,246,.06));border:1px solid rgba(0,229,160,.2);border-radius:14px;padding:36px;text-align:center;margin-top:52px}
.cta-box h3{font-size:20px;font-weight:800;margin-bottom:10px}
.cta-box p{font-size:15px;color:var(--muted);margin-bottom:24px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:700;background:linear-gradient(135deg,#00e5a0,#00c48c);color:#05050e;text-decoration:none;transition:all .2s}
.btn:hover{transform:translateY(-2px);box-shadow:0 0 30px rgba(0,229,160,.3);text-decoration:none}

.footer-sep{border-top:1px solid var(--border);margin-top:60px;padding-top:32px;text-align:center}
.footer-sep a{color:var(--muted);font-size:13px}

@media(max-width:600px){h1{font-size:26px}.hero-inner,.content{padding-left:18px;padding-right:18px}}
</style>
</head>
<body>

<nav class="nav">
  <div class="nav-inner">
    <a href="/" class="nav-logo">TREV'<span>A</span>INNOVATE</a>
    <a href="/blog" class="nav-back">← Blog</a>
  </div>
</nav>

<div class="hero">
  <div class="hero-inner">
    <div class="tags">${tagsHTML}</div>
    <h1>${title}</h1>
    <div class="meta">
      <span>📅 ${new Date(date).toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})}</span>
      <span>⏱ ${readTime} min de lectura</span>
      <span>✍️ Trev'ainnovate</span>
    </div>
  </div>
</div>

<div class="content">
  <p class="intro">${intro}</p>
  ${sectionsHTML}

  <div class="cta-box">
    <h3>${cta_text}</h3>
    <p>Diagnóstico DNS gratuito — resultado en 60 segundos, sin registro.</p>
    <a href="https://trevainnovate.com" class="btn">Auditar mi dominio gratis →</a>
  </div>

  <div class="footer-sep">
    <a href="/blog">← Ver todos los artículos</a>
  </div>
</div>

</body>
</html>`;
}

function buildIndexHTML(articles) {
  const cards = articles.map(a => `
    <a href="/blog/${a.slug}" class="card">
      <div class="card-tags">${a.tags.slice(0,2).map(t=>`<span class="tag">${t}</span>`).join('')}</div>
      <h2>${a.title}</h2>
      <p>${a.description}</p>
      <div class="card-meta">
        <span>${new Date(a.date).toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})}</span>
        <span>${a.readTime} min</span>
      </div>
    </a>`).join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Blog — Automatización y Seguridad Digital | Trev'ainnovate</title>
<meta name="description" content="Artículos sobre seguridad de correo empresarial, protección DMARC, automatización con n8n y ciberseguridad para empresas en México.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://trevainnovate.com/blog">
<meta property="og:title" content="Blog Trev'ainnovate — Seguridad y Automatización">
<meta property="og:description" content="Guías, análisis y casos reales de seguridad de correo y automatización para empresas en México.">
<meta property="og:image" content="https://trevainnovate.com/og-image.png">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#05050e;--bg2:#0b0b1c;--green:#00e5a0;--white:#f1f5f9;--muted:#8892a4;--border:rgba(255,255,255,0.07)}
body{background:var(--bg);font-family:'Inter',sans-serif;color:var(--white);-webkit-font-smoothing:antialiased}
a{text-decoration:none;color:inherit}

.nav{padding:20px 0;border-bottom:1px solid var(--border)}
.nav-inner{max-width:900px;margin:0 auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between}
.nav-logo{font-size:15px;font-weight:800;color:var(--white)}
.nav-logo span{color:var(--green)}
.nav-home{font-size:13px;color:var(--muted)}
.nav-home:hover{color:var(--white)}

.hero{padding:52px 0 40px;border-bottom:1px solid var(--border);background:linear-gradient(180deg,var(--bg2),var(--bg))}
.hero-inner{max-width:900px;margin:0 auto;padding:0 24px}
.hero-inner h1{font-size:clamp(28px,4vw,42px);font-weight:900;margin-bottom:10px}
.hero-inner p{font-size:16px;color:var(--muted);max-width:520px}

.grid{max-width:900px;margin:48px auto;padding:0 24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px}
.empty{max-width:900px;margin:80px auto;padding:0 24px;text-align:center;color:var(--muted)}

.card{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:24px;transition:all .2s;display:block}
.card:hover{border-color:rgba(0,229,160,.25);transform:translateY(-2px)}
.card-tags{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.tag{font-size:10px;font-weight:700;padding:3px 10px;border-radius:100px;background:rgba(0,229,160,.1);border:1px solid rgba(0,229,160,.2);color:var(--green);text-transform:uppercase;letter-spacing:.06em}
.card h2{font-size:17px;font-weight:800;line-height:1.3;margin-bottom:10px;color:var(--white)}
.card p{font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:16px}
.card-meta{display:flex;justify-content:space-between;font-size:12px;color:#475569}

.footer{border-top:1px solid var(--border);margin-top:40px;padding:32px 24px;text-align:center}
.footer a{color:var(--muted);font-size:13px}
.footer a:hover{color:var(--white)}
</style>
</head>
<body>

<nav class="nav">
  <div class="nav-inner">
    <a href="/" class="nav-logo">TREV'<span>A</span>INNOVATE</a>
    <a href="/" class="nav-home">← Inicio</a>
  </div>
</nav>

<div class="hero">
  <div class="hero-inner">
    <h1>Blog</h1>
    <p>Seguridad de correo, automatización y ciberseguridad para empresas en México.</p>
  </div>
</div>

${articles.length > 0
  ? `<div class="grid">${cards}</div>`
  : `<div class="empty"><p>Próximamente — primer artículo en camino.</p></div>`
}

<div class="footer">
  <a href="/">← Volver a trevainnovate.com</a>
</div>

</body>
</html>`;
}

async function main() {
  console.log(`\n🤖 Generando artículo: "${topic}"\n`);

  const prompt = `Eres un experto en ciberseguridad y automatización empresarial para el mercado mexicano. Escribe un artículo SEO de alta calidad para el blog de Trev'ainnovate.

TEMA: ${topic}

La empresa Trev'ainnovate ofrece:
- Seguridad de correo empresarial: implementación y monitoreo de SPF, DKIM, DMARC
- Automatización de procesos con n8n
- Protección contra BEC (Business Email Compromise) y phishing
- Diagnóstico DNS gratuito en trevainnovate.com
- Precios: DNS Shield $4,990 MXN/mes, AI Shield $9,990 MXN/mes

INSTRUCCIONES:
- Audiencia: directores, gerentes y dueños de empresas medianas en México
- Tono: experto pero accesible, directo, sin jerga innecesaria
- Longitud: artículo completo, 800-1200 palabras
- SEO: incluir keywords naturales relacionadas con el tema
- Incluir datos reales o estadísticas relevantes cuando sea posible

Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta (sin markdown, sin texto extra):
{
  "title": "título SEO del artículo (60-70 chars)",
  "slug": "url-slug-en-minusculas-con-guiones",
  "description": "meta description SEO (150-160 chars)",
  "readTime": 5,
  "tags": ["Tag1", "Tag2", "Tag3"],
  "intro": "párrafo introductorio impactante (2-3 oraciones)",
  "sections": [
    {
      "heading": "Título de sección H2",
      "paragraphs": ["párrafo 1", "párrafo 2"],
      "list": ["item 1", "item 2", "item 3"]
    }
  ],
  "cta_text": "texto del llamado a la acción final (una línea)"
}

Genera 4-5 secciones. El "list" en cada sección es opcional — inclúyelo solo cuando tenga sentido.`;

  let rawResponse;
  try {
    rawResponse = await callGroq(prompt);
  } catch(e) {
    console.error('❌ Error llamando a Claude:', e.message);
    process.exit(1);
  }

  let article;
  try {
    const clean = rawResponse.replace(/```json\n?|\n?```/g, '').trim();
    article = JSON.parse(clean);
  } catch(e) {
    console.error('❌ Error parseando respuesta de Claude:');
    console.error(rawResponse.slice(0, 500));
    process.exit(1);
  }

  article.date = new Date().toISOString().slice(0, 10);
  console.log(`✅ Artículo generado: "${article.title}"`);
  console.log(`   Slug: ${article.slug}`);
  console.log(`   Secciones: ${article.sections.length}`);

  // Generar HTML del artículo
  const articleHTML = buildArticleHTML(article);
  const articlePath = path.join(BLOG_DIR, `${article.slug}.html`);
  fs.writeFileSync(articlePath, articleHTML);
  console.log(`✅ HTML guardado: blog/${article.slug}.html`);

  // Actualizar articles.json
  const articles = JSON.parse(fs.readFileSync(ARTICLES_FILE, 'utf8'));
  const existing = articles.findIndex(a => a.slug === article.slug);
  const meta = { title: article.title, slug: article.slug, description: article.description, date: article.date, readTime: article.readTime, tags: article.tags };
  if (existing >= 0) articles[existing] = meta;
  else articles.unshift(meta);
  fs.writeFileSync(ARTICLES_FILE, JSON.stringify(articles, null, 2));

  // Regenerar índice
  const indexHTML = buildIndexHTML(articles);
  fs.writeFileSync(path.join(BLOG_DIR, 'index.html'), indexHTML);
  console.log(`✅ Índice actualizado (${articles.length} artículos)`);

  // Actualizar sitemap
  const sitemapPath = path.join(__dirname, 'sitemap.xml');
  let sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  const blogEntry = `  <url>\n    <loc>https://trevainnovate.com/blog/${article.slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>yearly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
  if (!sitemap.includes(`/blog/${article.slug}`)) {
    sitemap = sitemap.replace('</urlset>', blogEntry + '\n</urlset>');
    // Also add blog index if not present
    if (!sitemap.includes('/blog<')) {
      const blogIndex = `  <url>\n    <loc>https://trevainnovate.com/blog</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`;
      sitemap = sitemap.replace('</urlset>', blogIndex + '\n</urlset>');
    }
    fs.writeFileSync(sitemapPath, sitemap);
    console.log(`✅ Sitemap actualizado`);
  }

  // Agregar a Notion
  const notionOk = await addToNotion(article);
  console.log(notionOk ? '✅ Agregado a Notion (estado: Por revisar)' : '⚠️ Error al agregar a Notion');

  // Deploy
  console.log('\n🚀 Desplegando a Cloudflare Pages...');
  try {
    execSync(
      `npx wrangler pages deploy . --project-name=trevainnovate --branch=main`,
      {
        stdio: 'inherit',
        timeout: 60000,
        cwd: __dirname,
        env: { ...process.env }
      }
    );
    console.log(`\n✅ Artículo publicado: https://trevainnovate.com/blog/${article.slug}`);
  } catch(e) {
    console.error('⚠️ Error en deploy:', e.message);
    console.log(`Puedes desplegar manualmente con cf-deploy.js`);
  }
}

main();
