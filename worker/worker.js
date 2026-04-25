/**
 * 2chat.com.br — Cloudflare Worker v0
 * Parceiro: Zebra Box (hardcoded)
 *
 * Fluxo:
 *   GET  /{slug}           → Renderiza hub do parceiro (lista de formulários)
 *   GET  /{slug}/{form-id} → Renderiza formulário de qualificação
 *   POST /{slug}/{form-id} → Processa submit: valida → log → redirect WhatsApp
 *   *                      → Pass-through para o VPS/Nginx (landing, /api, estáticos)
 */

// ─── CONFIGURAÇÃO v0 — ZEBRA BOX HARDCODED ────────────────────────────────────

const PARCEIROS = {
  "zebra-box": {
    slug: "zebra-box",
    name: "Zebra Box",
    whatsapp: "5551993668728",
    forms: {
      "container": {  // Alinhado com o slug do banco (seed)
        id: "container",
        title: "Solicite aluguel de um Container",
        description: "Responda 3 perguntas rápidas e fale com o especialista.",
        fields: [
          {
            id: "location",
            label: "Para qual cidade?",
            type: "text",
            placeholder: "Ex: Porto Alegre",
            required: true,
          },
          {
            id: "period",
            label: "Por quanto tempo?",
            type: "select",
            options: ["1 mês", "2 meses", "3 meses", "4 meses", "6 meses", "Mais de 6 meses"],
            required: true,
          },
          {
            id: "purpose",
            label: "Qual a finalidade?",
            type: "select",
            options: ["Obra", "Armazenagem", "Outro"],
            required: true,
          },
        ],
        message_template:
          "Olá! Vim pelo 2chat. Tenho interesse em container para {{purpose}} em {{location}} por {{period}}.",
      },
    },
  },
};


// ─── ROTAS DE PASS-THROUGH → VPS/Nginx ────────────────────────────────────────
// Qualquer URL que corresponda a esses padrões será repassada direto ao VPS.
// O Worker não renderiza nada para essas rotas.

const PASSTHROUGH_PATTERNS = [
  /^\/$/,                                               // Landing page
  /^\/api\//,                                           // API endpoints
  /^\/termos-de-uso(\/|$)/,
  /^\/politica-de-privacidade(\/|$)/,
  /^\/dist\//,                                          // Assets compilados
  /^\/favicon/,
  /\.(html|css|js|png|jpg|jpeg|svg|ico|webp|json|txt|xml)$/i, // Arquivos estáticos
];

// ─── HANDLER PRINCIPAL ────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. Verificar se é rota de pass-through
    for (const pattern of PASSTHROUGH_PATTERNS) {
      if (pattern.test(pathname)) {
        return fetch(request); // Proxy transparente para o VPS
      }
    }

    // 2. Parse da rota de parceiro: /{slug} ou /{slug}/{form-id}
    const parts = pathname.split("/").filter(Boolean);
    const slug = parts[0];
    const formId = parts[1]; // undefined se apenas /{slug}

    // Rotas com mais de 2 segmentos são desconhecidas → pass-through
    if (!slug || parts.length > 2) {
      return fetch(request);
    }

    // 3. Carregar config do parceiro (v0: hardcoded | v1: KV)
    const parceiro = await getParceiroConfig(slug, env);
    if (!parceiro) {
      return fetch(request); // Parceiro não encontrado → VPS decide (ex: 404 personalizado)
    }

    // 4. GET /{slug} → Hub do parceiro
    if (!formId && request.method === "GET") {
      return renderHub(parceiro);
    }

    // 5. GET /{slug}/{form-id} → Formulário
    if (formId && request.method === "GET") {
      const form = parceiro.forms[formId];
      if (!form) return new Response("Formulário não encontrado.", { status: 404 });
      return renderForm(parceiro, form);
    }

    // 6. POST /{slug}/{form-id} → Submit do formulário
    if (formId && request.method === "POST") {
      const form = parceiro.forms[formId];
      if (!form) return new Response("Not Found", { status: 404 });
      return handleSubmit(request, parceiro, form, env, ctx);
    }

    return fetch(request);
  },
};

// ─── PARCEIRO CONFIG ────────────────────────────────────────────────────────────

async function getParceiroConfig(slug, env) {
  // v1: Lê config do Cloudflare KV (TENANTS_KV) → chave = "parceiro:{slug}"
  if (env?.TENANTS_KV) {
    try {
      const config = await env.TENANTS_KV.get(`parceiro:${slug}`, { type: "json" });
      if (config) return config; // KV tem prioridade sobre hardcoded
    } catch {
      // KV indisponível — cai no fallback abaixo
    }
  }

  // v0 fallback: configuração hardcoded (Zebra Box)
  return PARCEIROS[slug] || null;
}

// ─── HANDLER DE SUBMIT ────────────────────────────────────────────────────────

async function handleSubmit(request, parceiro, form, env, ctx) {
  const contentType = request.headers.get("Content-Type") || "";

  // Suporte a application/x-www-form-urlencoded (submit nativo HTML)
  let formData;
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body = await request.text();
    formData = new URLSearchParams(body);
  } else {
    formData = await request.formData();
  }

  const getValue = (key) =>
    (formData.get ? formData.get(key) : formData.getAll(key)?.[0]) ?? "";

  // Honeypot anti-bot: campo "website" deve estar vazio
  if (getValue("website")?.trim()) {
    // Bot detectado — redirect silencioso, sem registrar
    return Response.redirect(`https://wa.me/${parceiro.whatsapp}`, 302);
  }

  // Validação dos campos obrigatórios
  const errors = [];
  for (const field of form.fields) {
    if (field.required && !getValue(field.id)?.trim()) {
      errors.push(field.label);
    }
  }

  if (errors.length > 0) {
    const values = {};
    for (const field of form.fields) {
      values[field.id] = getValue(field.id);
    }
    return renderForm(parceiro, form, {
      error: `Por favor, preencha: ${errors.join(", ")}.`,
      values,
    });
  }

  // Montar payload com os valores submetidos
  const payload = {};
  for (const field of form.fields) {
    payload[field.id] = getValue(field.id).trim();
  }

  // Montar mensagem e URL do WhatsApp
  const message = renderTemplate(form.message_template, payload);
  const waUrl = `https://wa.me/${parceiro.whatsapp}?text=${encodeURIComponent(message)}`;

  // ─── GEOCODING + PSEUDONIMIZAÇÃO (LGPD) ──────────────────────────────────────
  // ORDEM OBRIGATÓRIA para conformidade com LGPD:
  //   1. Extrair localização geográfica ENQUANTO o IP está disponível
  //      city/region/country são dados agregados, NÃO PII individuais
  //   2. Hashear o IP (pseudonimização SHA-256)
  //   3. IP bruto NUNCA sai do Worker — VPS recebe apenas { ip_hash, city, region, country }
  const rawIP  = request.headers.get("CF-Connecting-IP") || "unknown";
  const city    = request.cf?.city    ?? null;  // Ex: "Porto Alegre"
  const region  = request.cf?.region  ?? null;  // Ex: "Rio Grande do Sul"
  const country = request.cf?.country ?? null;  // Ex: "BR"
  const ip_hash = await hashString(rawIP);       // SHA-256(ip + salt)
  // ─────────────────────────────────────────────────────────────────────────────

  const leadData = {
    parceiro:     parceiro.slug,
    form_id:      form.id,
    payload_json: JSON.stringify(payload),
    ip_hash,      // pseudonimizado — raw IP descartado
    city,
    region,
    country,
    created_at:   new Date().toISOString(),
  };

  // ctx.waitUntil: garante que o log roda mesmo após o redirect ser enviado
  ctx.waitUntil(logLead(leadData, env));

  // Redirect imediato para WhatsApp (não aguarda o log)
  return Response.redirect(waUrl, 302);
}

// ─── LOGGING DO LEAD → VPS com fallback KV ────────────────────────────────────

async function logLead(leadData, env) {
  // Em produção usa a URL real; em dev usa o local-upstream (Express)
  const API_ENDPOINT = env.ENVIRONMENT === 'production'
    ? 'https://2chat.com.br/api/leads'
    : 'http://localhost:3010/api/leads';

  try {
    // Tentativa síncrona no VPS com timeout de 400ms
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), 400);

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-2chat-Source": "worker-v0",
      },
      body: JSON.stringify(leadData),
      signal: controller.signal,
    });

    clearTimeout(timerId);

    if (response.ok) {
      // ✅ Lead registrado no SQLite do VPS
      return;
    }

    throw new Error(`VPS respondeu ${response.status}`);

  } catch {
    // VPS offline, timeout (> 400ms) ou erro → buffer no 2CHAT_LEADS_KV
    if (env?.['2CHAT_LEADS_KV']) {
      const kvKey = `lead:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
      await env['2CHAT_LEADS_KV'].put(kvKey, JSON.stringify(leadData), {
        expirationTtl: 60 * 60 * 24 * 7, // TTL: 7 dias (auto-expiração)
      });
    }
  }
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

/** Substitui {{campo}} pelos valores do payload */
function renderTemplate(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? "");
}

/** SHA-256 do IP com salt estático — LGPD-safe (pseudonimização) */
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str + "2chat-salt-v0-immutable");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── HTML BASE ────────────────────────────────────────────────────────────────
// CSS Utilitário embutido para máximo desempenho (Zero requisições externas bloqueantes)

const SHARED_HEAD = `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  
  <!-- Carregamento de fonte não-bloqueante (técnica de alta performance) -->
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" 
        media="print" onload="this.media='all'">
  <noscript>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap">
  </noscript>

  <style>
    /* Reset & Base */
    *, *::before, *::after { box-sizing: border-box; }
    body { 
      font-family: 'Inter', system-ui, -apple-system, sans-serif; 
      background-color: #0a0a0a; color: #e5e7eb; 
      margin: 0; -webkit-font-smoothing: antialiased; line-height: 1.5;
    }
    a { color: inherit; text-decoration: none; }
    
    /* Typography & Contrast Fixes */
    .text-blue-500 { color: #60a5fa !important; text-decoration: underline; text-underline-offset: 4px; text-decoration-color: rgba(96, 165, 250, 0.3); }
    .text-blue-400 { color: #60a5fa !important; }
    .text-gray-200 { color: #e5e7eb !important; }
    .text-gray-300 { color: #d1d5db !important; }
    .text-gray-400 { color: #9ca3af !important; }
    .text-gray-500 { color: #9ca3af !important; }
    .text-gray-600 { color: #d1d5db !important; }
    .text-white { color: #ffffff !important; }
    .text-red-500 { color: #ef4444 !important; }
    .text-red-400 { color: #f87171 !important; }
    
    /* Layout Utilities */
    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .items-center { align-items: center; }
    .items-start { align-items: flex-start; }
    .justify-center { justify-content: center; }
    .justify-between { justify-content: space-between; }
    .text-center { text-align: center; }
    .mx-auto { margin-left: auto; margin-right: auto; }
    .w-full { width: 100%; }
    .max-w-md { max-width: 28rem; }
    .min-h-screen { min-height: 100vh; }
    
    /* Spacing */
    .p-3 { padding: 0.75rem; } .p-4 { padding: 1rem; } .p-5 { padding: 1.25rem; } 
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .py-4 { padding-top: 1rem; padding-bottom: 1rem; } .py-5 { padding-top: 1.25rem; padding-bottom: 1.25rem; }
    .py-10 { padding-top: 2.5rem; padding-bottom: 2.5rem; }
    .mb-1 { margin-bottom: 0.25rem; } .mb-2 { margin-bottom: 0.5rem; } .mb-3 { margin-bottom: 0.75rem; }
    .mb-4 { margin-bottom: 1rem; } .mb-6 { margin-bottom: 1.5rem; } .mb-7 { margin-bottom: 1.75rem; }
    .mt-1 { margin-top: 0.25rem; } .-mt-1 { margin-top: -0.25rem; }
    .gap-1 { gap: 0.25rem; } .gap-4 { gap: 1rem; }
    
    /* Typography Size & Weight */
    .text-xs { font-size: 0.75rem; } .text-sm { font-size: 0.875rem; } .text-base { font-size: 1rem; }
    .text-xl { font-size: 1.25rem; } .text-2xl { font-size: 1.5rem; }
    .font-medium { font-weight: 500; } .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; } .font-extrabold { font-weight: 800; }
    .tracking-tight { letter-spacing: -0.025em; }
    
    /* Borders & Rounding */
    .border { border: 1px solid #374151; }
    .border-b { border-bottom: 1px solid #1f2937; }
    .border-t { border-top: 1px solid #1f2937; }
    .border-gray-700 { border-color: #374151; }
    .border-gray-800 { border-color: #1f2937; }
    .border-red-500\/40 { border-color: rgba(239, 68, 68, 0.4); }
    .rounded-xl { border-radius: 0.75rem; }
    .rounded-2xl { border-radius: 1rem; }
    
    /* Interactive Components */
    .card-form { background: #111; cursor: pointer; border: 1px solid #1f2937; }
    .card-form:hover { box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.5); border-color: #60a5fa; }
    .field-ctrl { background: #000; outline: none; border: 1px solid #374151; }
    .field-ctrl:focus { border-color: #60a5fa; box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.3); }
    .btn-wa { background: #2563eb; color: white; border: none; cursor: pointer; transition: transform 0.15s, background-color 0.2s; }
    .btn-wa:hover { background: #1d4ed8; transform: translateY(-1px); }
    .btn-wa:active { transform: translateY(0); }
    .bg-red-500\/10 { background-color: rgba(239, 68, 68, 0.1); }
    
    .transition-all { transition: all 0.2s; }
    .hover\:opacity-80:hover { opacity: 0.8; }
    .hover\:underline:hover { text-decoration: underline; }
    select option { background-color: #000; color: white; }
  </style>
`;

const LOGO = `
  <a href="/" aria-label="2chat — página inicial"
     class="text-xl font-extrabold tracking-tight text-white hover:opacity-80 transition-all">
    2chat<span class="text-blue-400">.</span>
  </a>
`;

function baseLayout({ title, metaDesc, content, backHref = null, backLabel = null }) {
  const backLink = backHref
    ? `<a href="${backHref}"
          class="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-all mb-6"
          style="text-decoration: underline; text-underline-offset: 4px;">
          ← ${backLabel || "Voltar"}
       </a>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title>${title} | 2chat</title>
  <meta name="description" content="${metaDesc}">
  ${SHARED_HEAD}
</head>
<body class="min-h-screen flex flex-col">

  <header class="border-b border-gray-800 py-4 px-4">
    <div class="max-w-md mx-auto">${LOGO}</div>
  </header>

  <main class="flex-1 flex flex-col items-start justify-start px-4 py-10">
    <div class="w-full max-w-md mx-auto">
      ${backLink}
      ${content}
    </div>
  </main>

  <footer class="border-t border-gray-800 py-5 px-4 text-center">
    <p class="text-xs text-gray-500">
      Powered by <a href="/" class="text-blue-400 hover:underline" style="text-decoration: underline; text-underline-offset: 2px;">2chat</a>
    </p>
  </footer>

</body>
</html>`;
}


// ─── RENDERIZADORES ───────────────────────────────────────────────────────────

function renderHub(parceiro) {
  const formCards = Object.values(parceiro.forms)
    .map(
      (form) => `
      <a href="/${parceiro.slug}/${form.id}"
         class="card-form block border border-gray-800 rounded-2xl p-5 group flex flex-col gap-1 transition-all">
        <h2 class="text-base font-semibold text-white group-hover:text-blue-400 transition-all">
          ${form.title}
        </h2>
        <p class="text-sm text-gray-400 mb-2">${form.description}</p>
        <span class="text-blue-500 text-sm font-semibold">Abrir formulário →</span>
      </a>`
    )
    .join("\n");

  const content = `
    <div class="mb-7">
      <h1 class="text-2xl font-extrabold text-white mb-1">${parceiro.name}</h1>
      <p class="text-sm text-gray-400">Selecione o atendimento que você precisa:</p>
    </div>
    <div class="flex flex-col gap-4">
      ${formCards}
    </div>`;

  return new Response(
    baseLayout({
      title: parceiro.name,
      metaDesc: `Formulários de atendimento – ${parceiro.name}`,
      content,
    }),
    { headers: { "Content-Type": "text/html;charset=UTF-8" } }
  );
}

function renderForm(parceiro, form, { error = null, values = {} } = {}) {
  const fieldClass = "field-ctrl w-full border border-gray-700 text-white p-3 rounded-xl transition-all text-sm";

  const fieldHtml = form.fields
    .map((field) => {
      const val = values[field.id] ?? "";
      const fieldTitle = `<div><label for="${field.id}" class="block text-sm font-medium text-gray-300 mb-2">${field.label}${field.required ? ' <span class="text-red-500">*</span>' : ""}</label>`;

      if (field.type === "text") {
        // Inteligência para autocomplete em mobile (melhora drástica de conversão)
        let autocomplete = "";
        if (field.autocomplete) {
            autocomplete = `autocomplete="${escHtml(field.autocomplete)}"`;
        } else if (field.id === 'nome' || field.id === 'name') {
            autocomplete = `autocomplete="name"`;
        } else if (field.id === 'whatsapp' || field.id === 'telefone' || field.id === 'phone' || field.type === 'tel') {
            autocomplete = `autocomplete="tel"`;
        } else if (field.id === 'email' || field.type === 'email') {
            autocomplete = `autocomplete="email"`;
        }
        
        // Se o id for whatsapp, sugerimos o type="tel" para abrir o teclado numérico
        const inputType = (field.id === 'whatsapp' || field.id === 'telefone' || field.type === 'tel') ? 'tel' : 'text';

        return `${fieldTitle}<input id="${field.id}" name="${field.id}" type="${inputType}" placeholder="${field.placeholder ?? ""}" value="${escHtml(val)}" ${autocomplete} ${field.required ? "required" : ""} class="${fieldClass}"></div>`;
      }

      if (field.type === "select") {
        const options = field.options
          .map((opt) => `<option value="${escHtml(opt)}" ${val === opt ? "selected" : ""}>${escHtml(opt)}</option>`)
          .join("\n");
        return `${fieldTitle}<select id="${field.id}" name="${field.id}" ${field.required ? "required" : ""} class="${fieldClass}"><option value="">Selecione...</option>${options}</select></div>`;
      }
      return "";
    })
    .join("\n");

  const errorBanner = error ? `<div role="alert" class="bg-red-500/10 border border-red-500/40 text-red-400 text-sm rounded-xl p-3">⚠️ ${escHtml(error)}</div>` : "";

  const content = `
    <div class="mb-6">
      <h1 class="text-xl font-bold text-white mb-1">${form.title}</h1>
      <p class="text-sm text-gray-400">${form.description}</p>
    </div>
    <form method="POST" action="/${parceiro.slug}/${form.id}" class="flex flex-col gap-4" novalidate>
      ${errorBanner}
      ${fieldHtml}

      <!-- Honeypot: invisível para humanos, armadilha para bots -->
      <input type="text" name="website"
             style="position:absolute;left:-9999px;opacity:0;pointer-events:none"
             tabindex="-1" autocomplete="off" aria-hidden="true">

      <button type="submit"
              class="btn-wa w-full bg-blue-600 hover:bg-blue-500 text-white
                     font-bold py-4 rounded-xl text-base mt-1">
        Enviar para WhatsApp →
      </button>

      <p class="text-xs text-center text-gray-600 -mt-1">
        Ao continuar, você será redirecionado para o WhatsApp.
      </p>
    </form>`;

  return new Response(
    baseLayout({
      title: form.title,
      metaDesc: form.description,
      content,
      backHref: `/${parceiro.slug}`,
      backLabel: parceiro.name,
    }),
    { headers: { "Content-Type": "text/html;charset=UTF-8" } }
  );
}

/** Escapa caracteres HTML para evitar XSS nos valores do formulário */
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
