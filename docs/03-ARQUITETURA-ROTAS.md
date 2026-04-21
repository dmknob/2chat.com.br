# Arquitetura de Rotas e Workers — 2chat.com.br

> **Versão:** 0.3 — Revisão para arquitetura com Cloudflare Workers
> **Última atualização:** 2026-04-20

---

## Visão Geral do Fluxo de Requisição

```
Usuário digita ou clica em 2chat.com.br/zebra-box/form01
│
▼
Cloudflare DNS
│
├─ Rota começa com /  (raiz) → Proxy para VPS (Nginx)
│   ├─ GET  /                   → Landing page (HTML estático)
│   ├─ GET  /termos-de-uso      → Página estática
│   ├─ GET  /politica-de-privacidade → Página estática
│   ├─ POST /api/leads          → Node.js API
│   ├─ POST /api/waitlist       → Node.js API
│   └─ GET  /api/health         → Node.js health check
│
└─ Rota começa com /{slug} → Cloudflare Worker
    ├─ GET  /{slug}             → Hub do tenant (lista de forms)
    └─ GET  /{slug}/{form-id}   → Formulário de qualificação
```

---

## 🟠 Cloudflare Worker

### Responsabilidades
1. Identificar tenant e formulário pela URL
2. Carregar configuração (v0: hardcoded | v1: KV)
3. Renderizar HTML do formulário diretamente na resposta
4. Processar submit do formulário
5. Redirecionar para WhatsApp com mensagem montada
6. Logging do lead com fallback resiliente

### Lógica de Roteamento (Worker)

```javascript
// Pseudocódigo do roteamento no Worker
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  // parts[0] = slug do tenant (ex: "zebra-box")
  // parts[1] = form-id (ex: "form01") — opcional

  // Rotas que passam para o VPS são tratadas antes:
  // /api/*, /termos-de-uso, /politica-de-privacidade, /
  // Essas são configuradas no Cloudflare Routes para NÃO bater no Worker.

  const slug   = parts[0]; // "zebra-box"
  const formId = parts[1]; // "form01" ou undefined

  const tenant = await getTenantConfig(slug); // KV ou hardcoded
  if (!tenant) return new Response('Not Found', { status: 404 });

  if (!formId) {
    // Hub: lista de formulários disponíveis
    return renderHub(tenant);
  }

  const form = tenant.forms[formId];
  if (!form) return new Response('Not Found', { status: 404 });

  if (request.method === 'GET') {
    return renderForm(tenant, form);
  }

  if (request.method === 'POST') {
    return handleSubmit(request, tenant, form);
  }
}
```

### Fluxo de Submit do Formulário

```javascript
async function handleSubmit(request, tenant, form) {
  const formData = await request.formData();

  // 1. Validação mínima (campos required)
  for (const field of form.fields) {
    if (field.required && !formData.get(field.id)) {
      return renderForm(tenant, form, { error: `Campo "${field.label}" é obrigatório.` });
    }
  }

  // 2. Montar payload do lead
  const payload = {};
  for (const field of form.fields) {
    payload[field.id] = formData.get(field.id) || '';
  }

  // 3. Montar mensagem WhatsApp
  const message = renderTemplate(form.message_template, payload);
  const waUrl   = `https://wa.me/${tenant.whatsapp}?text=${encodeURIComponent(message)}`;

  // 4. Logging assíncrono com fallback KV (NÃO bloqueia o redirect)
  event.waitUntil(logLead(tenant, form, payload, request));
  // (event.waitUntil garante que o fetch roda mesmo após a resposta ser enviada)

  // 5. Redirecionar imediatamente para WhatsApp
  return Response.redirect(waUrl, 302);
}

async function logLead(tenant, form, payload, request) {
  const leadData = {
    tenant:      tenant.slug,
    form_id:     form.id,
    payload_json: JSON.stringify(payload),
    ip_hash:     await hashIP(request.headers.get('CF-Connecting-IP')),
    created_at:  new Date().toISOString()
  };

  try {
    // Tentativa síncrona no VPS, timeout agressivo de 400ms
    const response = await fetch('https://2chat.com.br/api/leads', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(leadData),
      signal:  AbortSignal.timeout(400)
    });

    if (!response.ok) throw new Error(`VPS error: ${response.status}`);
    // Lead gravado no SQLite ✅

  } catch (err) {
    // VPS offline ou timeout → grava no KV como buffer
    const kvKey = `lead:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    await env.LEADS_KV.put(kvKey, JSON.stringify(leadData), {
      expirationTtl: 60 * 60 * 24 * 7 // 7 dias de TTL no KV
    });
    // Lead no buffer ✅ — será drenado pelo cron do VPS
  }
}
```

### Configuração do Worker — v0 Hardcoded (Zebra Box)

```javascript
// wrangler.toml
// name = "2chat-worker"
// main = "worker.js"
// compatibility_date = "2024-01-01"
//
// [[kv_namespaces]]
// binding = "LEADS_KV"
// id = "..."   ← criar via Wrangler
//
// [[kv_namespaces]]
// binding = "TENANTS_KV"
// id = "..."   ← para v1

const TENANTS_V0 = {
  "zebra-box": {
    slug:      "zebra-box",
    name:      "Zebra Box",
    whatsapp:  "5551993668728",
    forms: {
      "form01": {
        id:          "form01",
        title:       "Solicite um Container",
        description: "Responda 3 perguntas rápidas e conecte-se com o especialista.",
        fields: [
          {
            id:       "location",
            label:    "Qual a sua cidade?",
            type:     "text",
            required: true
          },
          {
            id:       "period",
            label:    "Período de uso?",
            type:     "select",
            options:  ["1 mês", "2 meses", "3 meses", "4 meses", "6 meses", "Mais de 6 meses"],
            required: true
          },
          {
            id:       "purpose",
            label:    "Qual a finalidade?",
            type:     "select",
            options:  ["Obra", "Armazenagem", "Outro"],
            required: true
          }
        ],
        message_template: "Olá, vim pelo 2chat. Tenho interesse em container para {{purpose}} em {{location}} por {{period}}."
      }
    }
  }
};
```

### Configuração do Worker — v1 via KV

```javascript
async function getTenantConfig(slug) {
  // v0: return TENANTS_V0[slug] || null;

  // v1:
  return await env.TENANTS_KV.get(slug, { type: 'json' });
}
```

Criar entrada no KV (v1, via Wrangler CLI):
```bash
wrangler kv:key put --namespace-id=<ID> "zebra-box" "$(cat zebra-box.json)"
```

---

## 🔵 VPS — Node.js API

### Endpoints

#### `POST /api/leads`
```
Headers:
  Content-Type: application/json
  Origin: 2chat.com.br (validado no CORS)

Body:
  {
    "tenant":      "zebra-box",
    "form_id":     "form01",
    "payload_json": "{\"location\":\"Porto Alegre\",\"period\":\"3 meses\",\"purpose\":\"Obra\"}",
    "ip_hash":     "sha256_do_ip",
    "created_at":  "2026-04-20T22:00:00.000Z"
  }

Response:
  201 Created  → Lead gravado no SQLite
  400 Bad Request → Payload inválido
  (Qualquer erro 5xx é capturado pelo Worker e aciona o KV fallback)
```

**SLA crítico:** Resposta em < 400ms. Se passar disso, o Worker já garantiu o lead via KV.

#### `POST /api/waitlist`
```
Body: { "email": "user@example.com" }
Response: 201 Created | 409 Conflict (email duplicado)
```

#### `GET /api/health`
```
Response: 200 OK
Body: { "status": "ok", "uptime": 12345.6, "db": "connected" }
```

### Drain do KV (Cron)

```javascript
// Executado a cada 5 minutos via PM2 ou cron do sistema
// scripts/drain-kv.js

async function drainKV() {
  const cfApi = new CloudflareKVApi(process.env.CF_API_TOKEN, KV_NAMESPACE_ID);

  // Lista todas as chaves com prefixo "lead:"
  const keys = await cfApi.listKeys({ prefix: 'lead:' });

  for (const key of keys.result) {
    const lead = await cfApi.getValue(key.name);
    if (!lead) continue;

    try {
      // Insere no SQLite
      await db.run(
        'INSERT INTO leads (tenant_slug, form_id, payload_json, ip_hash, created_at, source) VALUES (?,?,?,?,?,?)',
        [lead.tenant, lead.form_id, lead.payload_json, lead.ip_hash, lead.created_at, 'kv_buffer']
      );
      // Remove do KV
      await cfApi.deleteKey(key.name);
    } catch (err) {
      console.error(`Erro ao drenar ${key.name}:`, err.message);
      // Mantém no KV para próxima tentativa
    }
  }
}
```

> **v0 — Drain manual:** `wrangler kv:key list --namespace-id=<ID> --prefix=lead:`
> O drain automático via cron é entregue na v1.

---

## 📋 Resumo das Rotas

| Rota | Método | Servidor | Conteúdo / Ação |
|------|--------|----------|----------------|
| `/` | GET | VPS (Nginx) | Landing page 2chat (HTML estático) |
| `/termos-de-uso` | GET | VPS (Nginx) | Termos de uso |
| `/politica-de-privacidade` | GET | VPS (Nginx) | Política de privacidade |
| `/api/waitlist` | POST | VPS (Node.js) | Captura email de waitlist |
| `/api/leads` | POST | VPS (Node.js) | Persistência de lead |
| `/api/health` | GET | VPS (Node.js) | Health check |
| `/{slug}` | GET | Worker | Hub do tenant (lista de formulários) |
| `/{slug}/{form-id}` | GET | Worker | Formulário de qualificação |
| `/{slug}/{form-id}` | POST | Worker | Submit → log + redirect WhatsApp |

---

## 🔄 Fluxos de Usuário Completos

### Fluxo 1 — Lead Zebra Box (caminho principal)

```
URL compartilhada: 2chat.com.br/zebra-box/form01
(em bio do Instagram, stories, Google Ads, etc.)
│
GET /zebra-box/form01 → Worker renderiza formulário
│
Usuário preenche:
  Cidade: Porto Alegre
  Período: 3 meses
  Finalidade: Obra
│
POST /zebra-box/form01 (submit)
│
├─ Worker valida campos
├─ Monta mensagem: "Olá, vim pelo 2chat. Tenho interesse em container para Obra em Porto Alegre por 3 meses."
├─ [evento assíncrono] → POST /api/leads no VPS (400ms timeout)
│   ├─ OK → SQLite ✅
│   └─ Timeout → KV buffer ✅
└─ Redirect 302 → https://wa.me/5551993668728?text=...
   (instantâneo, não aguarda o log)

Leandro (Zebra Box) recebe no WhatsApp:
  "Olá, vim pelo 2chat. Tenho interesse em container para Obra em Porto Alegre por 3 meses."
  → Lead quente, contextualizado ✅
```

### Fluxo 2 — Acesso via link genérico do tenant

```
URL: 2chat.com.br/zebra-box
│
GET /zebra-box → Worker verifica tenant
│
Renderiza Hub (mínimo):
  ─────────────────────
  Zebra Box
  ─────────────────────
  [ Solicite um Container → /zebra-box/form01 ]
  [ Orçamento Transportadora → /zebra-box/form02 ] (futuro)
  ─────────────────────
  Powered by 2chat.
│
Usuário clica no formulário desejado
│
→ Fluxo 1 (acima)
```

### Fluxo 3 — Interessado no produto 2chat (Landing Page)

```
URL: 2chat.com.br/
│
GET / → Nginx serve HTML estático (nunca cai com Workers)
│
Usuário preenche email de interesse
│
POST /api/waitlist → VPS Node.js → SQLite (tabela: waitlist)
│
Modal: "Obrigado! Você está na lista de espera."
[sem redirect, usuário permanece na landing]
```

---

## 🔧 Operação v0

### Comandos Wrangler
```bash
# Instalar Wrangler
npm install -g wrangler

# Autenticar
wrangler login

# Criar namespaces KV
wrangler kv:namespace create "LEADS_KV"
wrangler kv:namespace create "TENANTS_KV"  # para v1

# Deploy do Worker
wrangler deploy

# Ver logs em tempo real
wrangler tail

# Inspecionar KV buffer manualmente
wrangler kv:key list --namespace-id=<LEADS_KV_ID> --prefix=lead:

# Ler um lead do buffer
wrangler kv:key get --namespace-id=<LEADS_KV_ID> "lead:1713654321000:abc123"
```

### Configuração Cloudflare Routes
```
# Em Workers & Pages → Triggers → Routes
# Worker intercepta:
2chat.com.br/*

# EXCETO (configurados como passthrough antes do Worker):
# /api/*
# /termos-de-uso
# /politica-de-privacidade
# /
# Isso é configurado via Cloudflare Page Rules ou no wrangler.toml
```
