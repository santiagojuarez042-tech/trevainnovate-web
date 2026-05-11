/**
 * Cloudflare Pages Worker — Trev'ainnovate
 * Proxy server-side para APIs sensibles. Nunca expone tokens al browser.
 * Cache en Cloudflare edge: 1h TTL. Portal funciona aunque Notion caiga.
 *
 * Extensiones agregadas:
 * - Short links: /s/:code (KV → URL larga)
 * - API para generar short links: /api/generate-link
 */

// NOTION_TOKEN se configura como variable de entorno en Cloudflare Pages
// Dashboard → trevainnovate → Settings → Environment variables → NOTION_TOKEN
const NOTION_DB = '3442a696-1b16-8104-9fd2-eca2a07503e2';

// Estado conocido de último monitoreo (fallback si Notion está caído)
const FALLBACK = {
  'GEC Plastic': {
    cliente: 'GEC Plastic',
    dominio: 'gecplastic.shop',
    dnsScore: 0,
    spf: 'Sin registro',
    dmarc: 'Sin registro',
    dkim: 'Sin registro',
    politicaDmarc: null,
    sslDias: null, // Se calcula desde sslVence
    sslVence: '2026-06-14',
    alertasEsteMes: 2,
    estadoServicio: 'Problema',
    siteOnline: true,
    ultimoCheck: '2026-04-16T07:30:00.000Z',
    spamhaus: 'En blacklist',
    erp: null,
    benford: null,
    openAlerts: [],
    recentInvoices: [],
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

    if (url.pathname === '/api/generate-link') {
      return handleGenerateLinkAPI(request, env, url);
    }

    // ── Short links: /s/:code ──
    if (url.pathname.startsWith('/s/')) {
      return handleShortLinkRedirect(url, env);
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
    'Cache-Control': 'public, s-maxage=3600' // Edge cache 1h
  };

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // Extraer nombre de cliente: /api/client/gec-plastic → GEC Plastic
  const slug = pathname.split('/api/client/')[1] || '';
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
          Authorization: `Bearer ${NOTION_TOKEN}`,
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

    const data = await notionRes.json();
    const page = data.results?.[0];
    if (!page) throw new Error('Cliente no encontrado en Notion');

    const props = page.properties;
    const out = extractProps(props, clientId);

    const sbData = await fetchSupabaseData(clientId, env);
    if (sbData) Object.assign(out, sbData);

    return new Response(JSON.stringify(out), { headers });
  } catch (e) {
    // ── Fallback: último estado conocido ──
    console.error('Notion error, usando fallback:', e.message);
    const out = { ...fallback, fromFallback: true };
    // Calcular días SSL en tiempo real aunque sea fallback
    out.sslDias = calcSslDias(out.sslVence);
    const sbData = await fetchSupabaseData(clientId, env);
    if (sbData) Object.assign(out, sbData);
    return new Response(JSON.stringify(out), {
      headers: { ...headers, 'X-Data-Source': 'fallback' }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
async function handleGenerateLinkAPI(request, env, url) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers });
  }

  const kv = getShortLinksKV(env);
  if (!kv) {
    return new Response(
      JSON.stringify({ error: 'KV no configurado. Define binding SHORT_LINKS en Cloudflare Pages.' }),
      { status: 500, headers }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body JSON inválido' }), { status: 400, headers });
  }

  const cliente = String(payload?.cliente || '').trim();
  const propuestaPathRaw = String(payload?.propuestaPath || '/propuesta.html').trim();
  const params = isPlainObject(payload?.params) ? payload.params : {};
  const redirectStatus = Number(payload?.redirectStatus) === 301 ? 301 : 302;

  if (!cliente) {
    return new Response(JSON.stringify({ error: 'El campo "cliente" es obligatorio' }), { status: 400, headers });
  }

  const propuestaPath = propuestaPathRaw.startsWith('/') ? propuestaPathRaw : `/${propuestaPathRaw}`;

  const targetUrl = new URL(propuestaPath, url.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    targetUrl.searchParams.set(key, String(value));
  }

  const baseCode = slugify(cliente) || 'propuesta';
  const shortCode = await getAvailableCode(kv, baseCode, targetUrl.toString());

  const record = {
    targetUrl: targetUrl.toString(),
    redirectStatus,
    cliente,
    propuestaPath,
    params,
    createdAt: new Date().toISOString()
  };

  await kv.put(shortCode, JSON.stringify(record));

  return new Response(
    JSON.stringify({
      ok: true,
      code: shortCode,
      shortLink: `${url.origin}/s/${shortCode}`,
      targetUrl: targetUrl.toString(),
      redirectStatus
    }),
    { status: 201, headers }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
async function handleShortLinkRedirect(url, env) {
  const kv = getShortLinksKV(env);
  if (!kv) {
    return new Response('KV no configurado', { status: 500 });
  }

  const code = extractCodeFromPath(url.pathname);
  if (!code) {
    return new Response('Código corto inválido', { status: 400 });
  }

  const raw = await kv.get(code);
  if (!raw) {
    return new Response('Short link no encontrado', { status: 404 });
  }

  const { targetUrl, redirectStatus } = parseKvRecord(raw);
  if (!targetUrl) {
    return new Response('Short link corrupto', { status: 500 });
  }

  const status = redirectStatus === 301 ? 301 : 302;
  return Response.redirect(targetUrl, status);
}

// ─────────────────────────────────────────────────────────────────────────────
function extractProps(props, cliente) {
  const vence = props['SSL Vence']?.date?.start ?? null;
  return {
    cliente,
    dominio: props['Dominio']?.rich_text?.[0]?.plain_text ?? '',
    dnsScore: props['DNS Score']?.number ?? 0,
    spf: props['SPF']?.select?.name ?? 'Sin registro',
    dmarc: props['DMARC']?.select?.name ?? 'Sin registro',
    dkim: props['DKIM']?.select?.name ?? 'Sin registro',
    politicaDmarc: props['Politica DMARC']?.select?.name ?? null,
    sslDias: calcSslDias(vence) ?? props['SSL Días']?.number ?? 0,
    sslVence: vence,
    alertasEsteMes: props['Alertas este mes']?.number ?? 0,
    estadoServicio: props['Estado servicio']?.select?.name ?? 'Activo',
    siteOnline: props['Sitio online']?.checkbox ?? true,
    ultimoCheck: props['Ultimo check']?.date?.start ?? new Date().toISOString(),
    spamhaus: props['Spamhaus']?.select?.name ?? 'En blacklist',
    fromFallback: false
  };
}

async function fetchSupabaseData(companyName, env) {
  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;

  const h = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  try {
    // Get client_id by nombre
    const compRes = await fetch(
      `${SUPABASE_URL}/rest/v1/clientes_activos?nombre=eq.${encodeURIComponent(companyName)}&select=client_id&limit=1`,
      { headers: h, signal: AbortSignal.timeout(5000) }
    );
    if (!compRes.ok) return null;
    const compData = await compRes.json();
    const companyId = compData?.[0]?.client_id;
    if (!companyId) return null;

    // Parallel queries
    const [alertsRes, benfordRes, erpRes, invRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/sentinel_alerts?client_id=eq.${companyId}&status=eq.abierta&order=created_at.desc&limit=20&select=id,alert_type,severity,title,description,created_at`, { headers: h, signal: AbortSignal.timeout(5000) }),
      fetch(`${SUPABASE_URL}/rest/v1/benford_analysis?client_id=eq.${companyId}&order=created_at.desc&limit=1&select=risk_score,risk_level,chi_square,p_value,total_invoices,periodo_fin,digit_counts,observed_pct,expected_pct`, { headers: h, signal: AbortSignal.timeout(5000) }),
      fetch(`${SUPABASE_URL}/rest/v1/erp_connections?client_id=eq.${companyId}&select=erp_type,sync_status,last_sync_at,sync_error&limit=1`, { headers: h, signal: AbortSignal.timeout(5000) }),
      fetch(`${SUPABASE_URL}/rest/v1/invoices?client_id=eq.${companyId}&order=created_at.desc&limit=10&select=folio,emisor_rfc,receptor_rfc,monto,moneda,fecha_emision,tipo,estatus`, { headers: h, signal: AbortSignal.timeout(5000) })
    ]);

    const alerts   = alertsRes.ok  ? await alertsRes.json()  : [];
    const benford  = benfordRes.ok ? await benfordRes.json() : [];
    const erp      = erpRes.ok     ? await erpRes.json()     : [];
    const invoices = invRes.ok     ? await invRes.json()     : [];

    const b = benford?.[0] ?? null;
    const e = erp?.[0] ?? null;

    return {
      erp: e ? {
        type:        e.erp_type ?? 'microsip',
        syncStatus:  e.sync_status ?? 'pending',
        lastSyncAt:  e.last_sync_at ?? null,
        syncError:   e.sync_error ?? null
      } : null,
      benford: b ? {
        riskScore:    b.risk_score,
        riskLevel:    b.risk_level,
        chiSquare:    b.chi_square,
        pValue:       b.p_value,
        totalInvoices: b.total_invoices,
        periodoFin:   b.periodo_fin,
        digitCounts:  b.digit_counts,
        observedPct:  b.observed_pct,
        expectedPct:  b.expected_pct
      } : null,
      openAlerts:      Array.isArray(alerts)   ? alerts   : [],
      recentInvoices:  Array.isArray(invoices) ? invoices : []
    };
  } catch (e) {
    console.error('Supabase error:', e.message);
    return null;
  }
}

function calcSslDias(vence) {
  if (!vence) return null;
  try {
    const ms = new Date(vence).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 86400000));
  } catch {
    return null;
  }
}

function slugToName(slug) {
  const map = { 'gec-plastic': 'GEC Plastic' };
  return map[slug] || null;
}

function getShortLinksKV(env) {
  // Fallbacks para facilitar despliegues donde el binding tenga otro nombre.
  return env.SHORT_LINKS || env.LINKS_KV || env.SHORTLINKS || null;
}

function extractCodeFromPath(pathname) {
  // /s/:code
  const maybeCode = pathname.replace(/^\/s\//, '').split('/')[0].trim();
  return maybeCode || null;
}

function slugify(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

async function getAvailableCode(kv, baseCode, targetUrl) {
  // Si existe el mismo destino, reutiliza el código.
  const existing = await kv.get(baseCode);
  if (!existing) return baseCode;

  const parsed = parseKvRecord(existing);
  if (parsed.targetUrl === targetUrl) return baseCode;

  // Resolver colisiones: base, base-2, base-3...
  for (let i = 2; i <= 9999; i++) {
    const candidate = `${baseCode}-${i}`;
    const value = await kv.get(candidate);
    if (!value) return candidate;

    const record = parseKvRecord(value);
    if (record.targetUrl === targetUrl) return candidate;
  }

  throw new Error('No fue posible asignar un código corto único');
}

function parseKvRecord(raw) {
  // Compatibilidad: valor plano URL o JSON con metadatos.
  try {
    const maybeObj = JSON.parse(raw);
    if (typeof maybeObj === 'string') {
      return { targetUrl: maybeObj, redirectStatus: 302 };
    }

    return {
      targetUrl: String(maybeObj?.targetUrl || '').trim(),
      redirectStatus: Number(maybeObj?.redirectStatus) === 301 ? 301 : 302
    };
  } catch {
    return { targetUrl: String(raw || '').trim(), redirectStatus: 302 };
  }
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
