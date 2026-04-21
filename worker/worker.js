/**
 * 2chat.com.br — Cloudflare Worker v0
 * Tenant: Zebra Box (hardcoded)
 *
 * Fluxo:
 *   GET  /{slug}           → Renderiza hub do tenant (lista de formulários)
 *   GET  /{slug}/{form-id} → Renderiza formulário de qualificação
 *   POST /{slug}/{form-id} → Processa submit: valida → log → redirect WhatsApp
 *   *                      → Pass-through para o VPS/Nginx (landing, /api, estáticos)
 */

// ─── CONFIGURAÇÃO v0 — ZEBRA BOX HARDCODED ────────────────────────────────────

const TENANTS = {
  "zebra-box": {
    slug: "zebra-box",
    name: "Zebra Box",
    whatsapp: "5551993668728",
    forms: {
      "form01": {
        id: "form01",
        title: "Solicite aluguel de um Container",
        description: "Responda 3 perguntas rápidas e fale com o especialista.",
        fields: [
          {
            id: "location",
            label: "Qual a sua cidade?",
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
        // {{campo}} será substituído pelo valor escolhido pelo usuário
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

    // 2. Parse da rota de tenant: /{slug} ou /{slug}/{form-id}
    const parts = pathname.split("/").filter(Boolean);
    const slug = parts[0];
    const formId = parts[1]; // undefined se apenas /{slug}

    // Rotas com mais de 2 segmentos são desconhecidas → pass-through
    if (!slug || parts.length > 2) {
      return fetch(request);
    }

    // 3. Carregar config do tenant (v0: hardcoded | v1: KV)
    const tenant = await getTenantConfig(slug, env);
    if (!tenant) {
      return fetch(request); // Tenant não encontrado → VPS decide (ex: 404 personalizado)
    }

    // 4. GET /{slug} → Hub do tenant
    if (!formId && request.method === "GET") {
      return renderHub(tenant);
    }

    // 5. GET /{slug}/{form-id} → Formulário
    if (formId && request.method === "GET") {
      const form = tenant.forms[formId];
      if (!form) return new Response("Formulário não encontrado.", { status: 404 });
      return renderForm(tenant, form);
    }

    // 6. POST /{slug}/{form-id} → Submit do formulário
    if (formId && request.method === "POST") {
      const form = tenant.forms[formId];
      if (!form) return new Response("Not Found", { status: 404 });
      return handleSubmit(request, tenant, form, env, ctx);
    }

    return fetch(request);
  },
};

// ─── TENANT CONFIG ────────────────────────────────────────────────────────────

async function getTenantConfig(slug, env) {
  // v1: Lê config do Cloudflare KV (TENANTS_KV) → chave = "tenant:{slug}"
  // Descomentar após criar o namespace e adicionar ao wrangler.toml
  // if (env?.TENANTS_KV) {
  //   try {
  //     const config = await env.TENANTS_KV.get(`tenant:${slug}`, { type: "json" });
  //     if (config) return config; // KV tem prioridade sobre hardcoded
  //   } catch {
  //     // KV indisponível — cai no fallback abaixo
  //   }
  // }

  // v0 fallback: configuração hardcoded (Zebra Box)
  return TENANTS[slug] || null;
}

// ─── HANDLER DE SUBMIT ────────────────────────────────────────────────────────

async function handleSubmit(request, tenant, form, env, ctx) {
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
    return Response.redirect(`https://wa.me/${tenant.whatsapp}`, 302);
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
    return renderForm(tenant, form, {
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
  const waUrl = `https://wa.me/${tenant.whatsapp}?text=${encodeURIComponent(message)}`;

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
    tenant:       tenant.slug,
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
  const VPS_ENDPOINT = "https://2chat.com.br/api/leads";

  try {
    // Tentativa síncrona no VPS com timeout de 400ms
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), 400);

    const response = await fetch(VPS_ENDPOINT, {
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
    if (env?.LEADS_KV) {
      const kvKey = `lead:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
      await env.LEADS_KV.put(kvKey, JSON.stringify(leadData), {
        expirationTtl: 60 * 60 * 24 * 7, // TTL: 7 dias (auto-expiração)
      });
      // ✅ Lead inclui city/region/country mesmo no buffer
      // v0: drenar manualmente:
      //   wrangler kv:key list --namespace-id=3408aa729e1e40e497db872ad9380905 --prefix=lead:
      // v1: cron automático no VPS drena para SQLite
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

const SHARED_HEAD = `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body  { font-family: 'Inter', sans-serif; }
    select option { background-color: #111111; }
    .card-form  { transition: border-color 0.2s, box-shadow 0.2s; }
    .card-form:hover { box-shadow: 0 0 0 1px rgba(37,99,235,0.4); }
    .btn-wa {
      transition: background-color 0.2s, transform 0.15s, box-shadow 0.2s;
    }
    .btn-wa:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 24px rgba(37, 99, 235, 0.35);
    }
    .btn-wa:active { transform: translateY(0); }
    .field-ctrl:focus {
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.45);
    }
  </style>
`;

const LOGO = `
  <a href="/" aria-label="2chat — página inicial"
     class="text-xl font-extrabold tracking-tight text-white hover:opacity-80 transition-opacity">
    2chat<span class="text-blue-500">.</span>
  </a>
`;

function baseLayout({ title, metaDesc, content, backHref = null, backLabel = null }) {
  const backLink = backHref
    ? `<a href="${backHref}"
          class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-6">
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
<body class="bg-[#0a0a0a] text-gray-200 min-h-screen flex flex-col">

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
    <p class="text-xs text-gray-600">
      Powered by <a href="/" class="text-blue-500 hover:underline">2chat</a>
    </p>
  </footer>

</body>
</html>`;
}

// ─── RENDERIZADORES ───────────────────────────────────────────────────────────

/** Hub: lista os formulários disponíveis do tenant */
function renderHub(tenant) {
  const formCards = Object.values(tenant.forms)
    .map(
      (form) => `
      <a href="/${tenant.slug}/${form.id}"
         class="card-form block bg-gray-900 border border-gray-800 rounded-2xl p-5 group">
        <h2 class="text-base font-semibold text-white mb-1
                   group-hover:text-blue-400 transition-colors">
          ${form.title}
        </h2>
        <p class="text-sm text-gray-400 mb-3">${form.description}</p>
        <span class="text-blue-500 text-sm font-semibold">Abrir formulário →</span>
      </a>`
    )
    .join("\n");

  const content = `
    <div class="mb-7">
      <h1 class="text-2xl font-extrabold text-white mb-1">${tenant.name}</h1>
      <p class="text-sm text-gray-500">Selecione o atendimento que você precisa:</p>
    </div>
    <div class="flex flex-col gap-4">
      ${formCards}
    </div>`;

  return new Response(
    baseLayout({
      title: tenant.name,
      metaDesc: `Formulários de atendimento – ${tenant.name}`,
      content,
    }),
    { headers: { "Content-Type": "text/html;charset=UTF-8" } }
  );
}

/** Formulário: renderiza os campos + botão de submit */
function renderForm(tenant, form, { error = null, values = {} } = {}) {
  const fieldClass =
    "field-ctrl w-full bg-[#111] border border-gray-700 text-white p-3 rounded-xl " +
    "focus:outline-none focus:border-blue-500 transition-all placeholder-gray-600 text-sm";

  const fieldHtml = form.fields
    .map((field) => {
      const val = values[field.id] ?? "";

      if (field.type === "text") {
        return `
          <div>
            <label for="${field.id}"
                   class="block text-sm font-medium text-gray-300 mb-2">
              ${field.label}${field.required ? ' <span class="text-red-500">*</span>' : ""}
            </label>
            <input id="${field.id}" name="${field.id}" type="text"
                   placeholder="${field.placeholder ?? ""}"
                   value="${escHtml(val)}"
                   ${field.required ? "required" : ""}
                   class="${fieldClass}">
          </div>`;
      }

      if (field.type === "select") {
        const options = field.options
          .map(
            (opt) =>
              `<option value="${escHtml(opt)}" ${val === opt ? "selected" : ""}>
                 ${escHtml(opt)}
               </option>`
          )
          .join("\n");

        return `
          <div>
            <label for="${field.id}"
                   class="block text-sm font-medium text-gray-300 mb-2">
              ${field.label}${field.required ? ' <span class="text-red-500">*</span>' : ""}
            </label>
            <select id="${field.id}" name="${field.id}"
                    ${field.required ? "required" : ""}
                    class="${fieldClass}">
              <option value="">Selecione...</option>
              ${options}
            </select>
          </div>`;
      }

      return ""; // tipo não suportado
    })
    .join("\n");

  const errorBanner = error
    ? `<div role="alert"
            class="bg-red-500/10 border border-red-500/40 text-red-400
                   text-sm rounded-xl p-3">
         ⚠️ ${escHtml(error)}
       </div>`
    : "";

  const content = `
    <div class="mb-6">
      <h1 class="text-xl font-bold text-white mb-1">${form.title}</h1>
      <p class="text-sm text-gray-400">${form.description}</p>
    </div>

    <form method="POST"
          action="/${tenant.slug}/${form.id}"
          class="flex flex-col gap-4"
          novalidate>

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
      backHref: `/${tenant.slug}`,
      backLabel: tenant.name,
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
