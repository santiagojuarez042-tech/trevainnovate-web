/**
 * Cloudflare Pages Worker — Trev'ainnovate
 * Proxy server-side para APIs sensibles. Nunca expone tokens al browser.
 * Cache en Cloudflare edge: 1h TTL. Portal funciona aunque Notion caiga.
 */

// NOTION_TOKEN se configura como variable de entorno en Cloudflare Pages
// Dashboard → trevainnovate → Settings → Environment variables → NOTION_TOKEN
const NOTION_DB = '3442a696-1b16-8104-9fd2-eca2a07503e2';

// Estado conocido de último monitoreo (fallback si Notion está caído)
const FALLBACK = {
  'GEC Plastic': {
    cliente:      'GEC Plastic',
    dominio:      'gecplastic.shop',
    dnsScore:     0,
    spf:          'Sin registro',
    dmarc:        'Sin registro',
    dkim:         'Sin registro',
    politicaDmarc: null,
    sslDias:      null,        // Se calcula desde sslVence
    sslVence:     '2026-06-14',
    alertasEsteMes: 2,
    estadoServicio: 'Problema',
    siteOnline:   true,
    ultimoCheck:  '2026-04-16T07:30:00.000Z',
    fromFallback: true
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── API routes (server-side, token nunca llega al browser) ──
    if (url.pathname.startsWith('/api/client/')) {
      return handleClientAPI(url.pathname, request, env);
    }

    // ── Static assets ──
    return env.ASSETS.fetch(request);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
async function handleClientAPI(pathname, request, env) {
  const NOTION_TOKEN = env.NOTION_TOKEN || '';
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, s-maxage=3600'   // Edge cache 1h
  };

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // Extraer nombre de cliente: /api/client/gec-plastic → GEC Plastic
  const slug     = pathname.split('/api/client/')[1] || '';
  const clientId = slugToName(slug);
  const fallback = FALLBACK[clientId];

  if (!clientId || !fallback) {
    return new Response(JSON.stringify({ error: 'Cliente no encontrado' }), { status: 404, headers });
  }

  // ── Intentar Notion ──
  try {
    const notionRes = await fetch(
      `https://api.notion.com/v1/databases/${NOTION_DB}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filter: { property: 'Cliente', title: { equals: clientId } }
        }),
        signal: AbortSignal.timeout(8000)
      }
    );

    if (!notionRes.ok) throw new Error(`Notion HTTP ${notionRes.status}`);

    const data  = await notionRes.json();
    const page  = data.results?.[0];
    if (!page) throw new Error('Cliente no encontrado en Notion');

    const props = page.properties;
    const out   = extractProps(props, clientId);

    return new Response(JSON.stringify(out), { headers });

  } catch (e) {
    // ── Fallback: último estado conocido ──
    console.error('Notion error, usando fallback:', e.message);
    const out = { ...fallback, fromFallback: true };
    // Calcular días SSL en tiempo real aunque sea fallback
    out.sslDias = calcSslDias(out.sslVence);
    return new Response(JSON.stringify(out), {
      headers: { ...headers, 'X-Data-Source': 'fallback' }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
function extractProps(props, cliente) {
  const vence = props['SSL Vence']?.date?.start ?? null;
  return {
    cliente,
    dominio:        props['Dominio']?.rich_text?.[0]?.plain_text ?? '',
    dnsScore:       props['DNS Score']?.number ?? 0,
    spf:            props['SPF']?.select?.name ?? 'Sin registro',
    dmarc:          props['DMARC']?.select?.name ?? 'Sin registro',
    dkim:           props['DKIM']?.select?.name ?? 'Sin registro',
    politicaDmarc:  props['Politica DMARC']?.select?.name ?? null,
    sslDias:        calcSslDias(vence) ?? props['SSL Días']?.number ?? 0,
    sslVence:       vence,
    alertasEsteMes: props['Alertas este mes']?.number ?? 0,
    estadoServicio: props['Estado servicio']?.select?.name ?? 'Activo',
    siteOnline:     props['Sitio online']?.checkbox ?? true,
    ultimoCheck:    props['Ultimo check']?.date?.start ?? new Date().toISOString(),
    fromFallback:   false
  };
}

function calcSslDias(vence) {
  if (!vence) return null;
  try {
    const ms   = new Date(vence).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 86400000));
  } catch { return null; }
}

function slugToName(slug) {
  const map = { 'gec-plastic': 'GEC Plastic' };
  return map[slug] || null;
}
