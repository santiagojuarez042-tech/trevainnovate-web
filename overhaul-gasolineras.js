#!/usr/bin/env node
/**
 * Trev'ainnovate — Overhaul completo Notion Gasolineras Diagnóstico
 * Ejecutar: node overhaul-gasolineras.js
 */

const https = require('https');

const TOKEN = process.env.NOTION_TOKEN;
const PAGE_ID = '3422a6961b16812aafd4e86bbacddf0d';

const TOGGLE_IDS = [
  '2b2ae62f-ca3c-41db-94cb-e223a48f75a5', // BLOQUE 1 — Ventas y Caja
  '9342181c-37d0-430f-9085-198b03f95d29', // BLOQUE 2 — Inventarios
  '2da8dd10-48e3-4ef4-b6a9-095ed74ab9d1', // BLOQUE 3 — Administración
  'a395dc5b-91c2-407f-abbc-05beb07ffb3c', // BLOQUE 4 — Personal
  '53810c41-9a40-4956-8802-74f77ee15fb0', // BLOQUE 5 — Experiencia Cliente
  '958e6ef1-8df1-4b61-8d8b-7288eb9446c4', // BLOQUE 6 — Tecnología
];

// Blocks to fix "Treva Innovate" typo
const TYPO_QUOTE_ID   = '07ee8b5f-e364-4c62-88fa-ce908359c127'; // "Treva Innovate diseña..."
const TYPO_LIST4_ID   = '06364a5b-2f3d-4dfd-8ee0-cbea7b0acce3'; // "Arranque con Treva Innovate"
const FOOTER_PARA_ID  = '102c1ae4-5b09-457d-b5b7-9ed9f44f637d'; // footer paragraph
const LAST_EMPTY_ID   = '3422a696-1b16-8015-a55c-ca51e67ce067'; // empty para at end

// Blocks to insert client data BEFORE (the first quote block)
const FIRST_QUOTE_ID  = 'fc8a334a-f669-4994-8ab0-c1345eb90b71';

function notionReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.notion.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve(d); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('🔧 Iniciando overhaul Gasolineras Notion...\n');

  // 1. Set page icon ⛽
  console.log('1️⃣  Configurando icono de página ⛽...');
  let r = await notionReq('PATCH', `/v1/pages/${PAGE_ID}`, {
    icon: { type: 'emoji', emoji: '⛽' }
  });
  console.log(r.object === 'page' ? '   ✅ Icono configurado' : '   ⚠️  ' + JSON.stringify(r));
  await sleep(300);

  // 2. Add client data callout at very top (before first quote)
  console.log('\n2️⃣  Agregando sección de datos del cliente al inicio...');
  r = await notionReq('PATCH', `/v1/blocks/${PAGE_ID}/children`, {
    children: [
      {
        type: 'callout',
        callout: {
          icon: { type: 'emoji', emoji: '📋' },
          color: 'blue_background',
          rich_text: [
            { type: 'text', text: { content: 'DATOS DEL CLIENTE' }, annotations: { bold: true } }
          ],
          children: [
            {
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: 'Empresa / Razón Social: ' }, annotations: { bold: true } },
                  { type: 'text', text: { content: '_________________________________' } }
                ]
              }
            },
            {
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: 'Nombre del responsable: ' }, annotations: { bold: true } },
                  { type: 'text', text: { content: '_________________________________' } }
                ]
              }
            },
            {
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: 'Teléfono / WhatsApp: ' }, annotations: { bold: true } },
                  { type: 'text', text: { content: '_________________________________' } }
                ]
              }
            },
            {
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: 'Número de estaciones: ' }, annotations: { bold: true } },
                  { type: 'text', text: { content: '_________________________________' } }
                ]
              }
            },
            {
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: 'Fecha de llenado: ' }, annotations: { bold: true } },
                  { type: 'text', text: { content: '_________________________________' } }
                ]
              }
            }
          ]
        }
      }
    ]
  });
  // Note: Notion PATCH /children appends to end. We'll need to reorder manually or accept at bottom approach.
  // Actually Notion API doesn't support inserting before a block — only appending.
  // The "after" property on each block in the children array can specify the block to insert after.
  console.log(r.object === 'list' ? '   ✅ Sección cliente creada (al final, mover manualmente al inicio si se desea)' : '   ⚠️  ' + JSON.stringify(r).slice(0, 200));
  await sleep(300);

  // 3. Process each toggle: find severity paragraph, archive it, add 3 to_do blocks
  console.log('\n3️⃣  Convirtiendo severidad a checkboxes en los 6 bloques...');
  for (let i = 0; i < TOGGLE_IDS.length; i++) {
    const toggleId = TOGGLE_IDS[i];
    process.stdout.write(`   Bloque ${i + 1}/6... `);

    // Fetch children of toggle
    const children = await notionReq('GET', `/v1/blocks/${toggleId}/children?page_size=50`);
    await sleep(200);

    // Find the severity paragraph (last paragraph containing "Crítico")
    const severityBlock = children.results?.find(b =>
      b.type === 'paragraph' &&
      b.paragraph?.rich_text?.some(rt => rt.plain_text?.includes('Crítico'))
    );

    if (!severityBlock) {
      console.log('⚠️  Bloque de severidad no encontrado, saltando');
      continue;
    }

    // Archive (delete) the severity paragraph
    await notionReq('PATCH', `/v1/blocks/${severityBlock.id}`, { archived: true });
    await sleep(200);

    // Add 3 to_do checkbox blocks inside toggle
    await notionReq('PATCH', `/v1/blocks/${toggleId}/children`, {
      children: [
        {
          type: 'to_do',
          to_do: {
            checked: false,
            color: 'red_background',
            rich_text: [{ type: 'text', text: { content: '🔴 Crítico — esto me afecta directamente y de forma frecuente' } }]
          }
        },
        {
          type: 'to_do',
          to_do: {
            checked: false,
            color: 'yellow_background',
            rich_text: [{ type: 'text', text: { content: '🟡 Moderado — existe pero podría mejorar' } }]
          }
        },
        {
          type: 'to_do',
          to_do: {
            checked: false,
            color: 'green_background',
            rich_text: [{ type: 'text', text: { content: '🟢 No aplica — esto no es un problema en mi operación' } }]
          }
        }
      ]
    });
    await sleep(300);
    console.log('✅');
  }

  // 4. Fix "Treva Innovate" → "Trev'ainnovate" in quote block
  console.log('\n4️⃣  Corrigiendo nombre "Treva Innovate" → "Trev\'ainnovate"...');

  await notionReq('PATCH', `/v1/blocks/${TYPO_QUOTE_ID}`, {
    quote: {
      rich_text: [
        { type: 'text', text: { content: 'Con base en este diagnóstico, ' } },
        { type: 'text', text: { content: "Trev'ainnovate" }, annotations: { bold: true } },
        { type: 'text', text: { content: ' diseña una solución a la medida de tu operación.' } }
      ]
    }
  });
  await sleep(300);
  console.log('   ✅ Quote corregido');

  // Fix numbered list item 4
  await notionReq('PATCH', `/v1/blocks/${TYPO_LIST4_ID}`, {
    numbered_list_item: {
      rich_text: [{ type: 'text', text: { content: "Arranque del proyecto con acompañamiento de Trev'ainnovate" } }]
    }
  });
  await sleep(300);
  console.log("   ✅ Lista corregida: 'Trev'ainnovate'");

  // Fix footer paragraph
  await notionReq('PATCH', `/v1/blocks/${FOOTER_PARA_ID}`, {
    paragraph: {
      rich_text: [
        { type: 'text', text: { content: "Documento preparado por Trev'ainnovate — Automatizaciones a la medida para operaciones que quieren crecer." }, annotations: { italic: true } }
      ]
    }
  });
  await sleep(300);
  console.log("   ✅ Footer corregido: 'Trev'ainnovate'");

  // 5. Add submission instructions and contact block at bottom
  console.log('\n5️⃣  Agregando instrucciones de envío y datos de contacto...');
  r = await notionReq('PATCH', `/v1/blocks/${PAGE_ID}/children`, {
    children: [
      { type: 'divider', divider: {} },
      {
        type: 'callout',
        callout: {
          icon: { type: 'emoji', emoji: '📬' },
          color: 'gray_background',
          rich_text: [
            { type: 'text', text: { content: '¿Cómo devolver este diagnóstico?' }, annotations: { bold: true } }
          ],
          children: [
            {
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: 'Una vez que hayas completado los 6 bloques, envía esta página a:' } }
                ]
              }
            },
            {
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: '📧 ' } },
                  { type: 'text', text: { content: 'contacto@trevainnovate.com' }, annotations: { bold: true, code: true } }
                ]
              }
            },
            {
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: 'O comparte directamente el enlace de esta página de Notion con nosotros.' } }
                ]
              }
            },
            {
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: 'En menos de 48 horas te contactaremos con una propuesta personalizada basada en lo que marcaste.' } }
                ]
              }
            }
          ]
        }
      },
      {
        type: 'callout',
        callout: {
          icon: { type: 'emoji', emoji: '📞' },
          color: 'default',
          rich_text: [
            { type: 'text', text: { content: 'Contacto directo' }, annotations: { bold: true } }
          ],
          children: [
            {
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: '🌐 trevainnovate.com' } }
                ]
              }
            },
            {
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: '📧 contacto@trevainnovate.com' } }
                ]
              }
            },
            {
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: '💬 WhatsApp disponible en trevainnovate.com' } }
                ]
              }
            }
          ]
        }
      }
    ]
  });
  console.log(r.object === 'list' ? '   ✅ Bloque de envío y contacto agregados' : '   ⚠️  ' + JSON.stringify(r).slice(0, 200));

  console.log('\n✅ Overhaul completo. Abre la página en Notion para revisar.');
  console.log('   https://www.notion.so/' + PAGE_ID.replace(/-/g, ''));
  console.log('\n⚠️  NOTA: El bloque de datos del cliente y los de contacto se agregaron al FINAL.');
  console.log('   En Notion, arrástralos manualmente al inicio y al final donde corresponda.');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
