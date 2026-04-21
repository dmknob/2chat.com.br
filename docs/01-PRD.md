# PRD: 2chat.com.br — Produto e Arquitetura

> **Versão:** 0.3 — Revisão pós-alinhamento de arquitetura
> **Última atualização:** 2026-04-20

---

## 1. Visão do Produto

### 1.1 O Problema

Pequenos negócios que operam 100% via WhatsApp perdem tempo atendendo leads não-qualificados. Um corretor, dentista, mecânico ou consultor gasta 10 minutos conversando com alguém que não pode contratar o serviço — e esse tempo não volta.

### 1.2 A Solução: Qualificador de Conversas

O **2chat** é um **Redirecionador de Conversão (Conversion Gatekeeper)**. Não é um chat, não é um CRM, não é um linktree.

O fluxo é simples e direto:
1. O dono do negócio cria um link: `2chat.com.br/meu-negocio/orcamento`
2. Esse link mostra uma tela leve com 2–4 perguntas de qualificação
3. O usuário responde e é redirecionado para o WhatsApp **com a mensagem já montada**
4. O lead chega quente, contextualizado, com informação que importa

### 1.3 Para quem

| Perfil | Motivo |
|--------|--------|
| **Pequeno Vendedor** | Não vai usar Pipedrive ou RD Station. Precisa de algo que funcione em 30 segundos no celular. |
| **Agência de Social Media** | Configura o 2chat para múltiplos clientes e garante que o lead chegue qualificado para o dono. |

### 1.4 O Valor Real

> "Não é encurtar link. É devolver tempo para o dono do negócio."

---

## 2. Versões do MVP

### v0 — Zebra Box (Interno, Hardcoded)
- Cloudflare Worker com configuração embutida
- Apenas Zebra Box como tenant
- Sem área de admin, sem login
- **Objetivo:** Validar o fluxo completo em produção

### v1 — Multi-tenant Parametrizado (Interno)
- Configuração lida do Cloudflare KV
- Onboarding manual via admin (CLI ou painel simples)
- Múltiplos projetos internos como tenants de teste
- **Objetivo:** Validar escalabilidade e operação do KV

### v2 — Beta Fechado (Externo)
- Primeiro clientes externos (beta fechado, lista de espera)
- Modelo freemium começa a ser desenhado
- Dashboard básico para o tenant ver leads

---

## 3. Arquitetura do Sistema

### 3.1 Visão Geral

```
                ┌──────────────────────────────────┐
                │       Cloudflare Edge            │
                │                                  │
 Usuário ──────►│  Worker: 2chat.com.br/{slug}     │
                │   ├─ Renderiza HTML do formulário│
                │   ├─ Lê config (v0: hardcoded,   │
                │   │           v1: KV)             │
                │   └─ Processa submit do form      │
                │      ├─ POST /api/leads → VPS     │
                │      │   ├─ OK: lead no SQLite    │
                │      │   └─ Falha: lead no KV     │
                │      └─ Redirect → WhatsApp       │
                └──────────┬───────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   VPS       │
                    │   Node.js   │
                    │   SQLite    │
                    │   PM2       │
                    │             │
                    │  /api/leads │   ← POST do Worker
                    │  /api/health│
                    │  KV drain   │   ← Cron: sincroniza KV → SQLite
                    └─────────────┘

Rota especial:
  2chat.com.br/     → Landing page estática (CDN/VPS)
  2chat.com.br/api/ → VPS (passthrough pelo Cloudflare)
```

### 3.2 Cloudflare Workers (Camada de Borda)

**Responsabilidade:** Interceptar requisições de tenant, renderizar formulários, processar submits, garantir resiliência.

**Por que Workers:**
- Mesmo que o VPS fique offline, o formulário é exibido e o redirect para WhatsApp acontece
- Latência de borda (~50ms globalmente vs. ~200ms do VPS no Brasil)
- Zero custo no tier gratuito para o volume do MVP

**Rotas gerenciadas pelo Worker:**
```
GET  /{slug}           → Hub do tenant (lista de formulários)
GET  /{slug}/{form-id} → Formulário de qualificação
POST /{slug}/{form-id} → Submit do formulário (Worker processa)
```

**Rotas que passam pelo VPS (não tratadas pelo Worker):**
```
GET  /                              → Landing page (estática)
GET  /termos-de-uso                 → Página estática
GET  /politica-de-privacidade       → Página estática
POST /api/leads                     → Endpoint de coleta
POST /api/waitlist                  → Endpoint de waitlist
GET  /api/health                    → Health check
```

### 3.3 Estratégia de Captura de Lead (Resiliência Sem Espera)

**Princípio:** Zero espera para o usuário final. Garantia de eventual persistência do lead.

**Fluxo no Worker ao receber submit do formulário:**

```
Usuário clica "Enviar para WhatsApp"
│
├─ [1] Worker monta mensagem WhatsApp (instantâneo)
│
├─ [2] Worker inicia fetch para VPS: POST /api/leads
│       Timeout: 400ms
│       (não bloqueia o fluxo do usuário)
│
├─ [3] Worker responde ao navegador com redirect → WhatsApp
│       (acontece independente do resultado do fetch)
│
└─ [4] Resolução assíncrona do fetch:
        ├─ VPS respondeu OK? → Lead no SQLite ✅
        └─ Timeout ou erro? → Worker grava no KV ✅
                              (buffer de fallback)

VPS (quando online):
└─ Cron a cada 5min → drena KV → insere no SQLite
```

**Garantia:** O lead nunca é perdido. O usuário nunca espera.

> ⚠️ **Nota v0:** O drain do KV no VPS é implementação crítica da v1. No v0, o KV pode ser drenado manualmente via Wrangler CLI. Aceite de risco controlado para cliente interno.

### 3.4 Configuração de Tenant

**v0 — Hardcoded no Worker:**
```javascript
// worker.js
const TENANTS = {
  "zebra-box": {
    name: "Zebra Box",
    whatsapp: "5551993668728",
    forms: {
      "form01": {
        title: "Solicite um Container",
        description: "Responda 3 perguntas rápidas e conecte-se com nosso especialista.",
        fields: [
          { id: "location", label: "Qual a sua cidade?", type: "text", required: true },
          { id: "period",   label: "Período de uso?",    type: "select",
            options: ["1 mês", "2 meses", "3 meses", "4 meses", "6 meses", "Mais de 6 meses"],
            required: true },
          { id: "purpose",  label: "Qual é a finalidade?", type: "select",
            options: ["Obra", "Armazenagem", "Outro"],
            required: true }
        ],
        message_template: "Olá, vim pelo 2chat. Tenho interesse em container para {{purpose}} em {{location}} por {{period}}."
      }
    }
  }
};
```

**v1 — Cloudflare KV:**
```javascript
// worker.js
const config = await env.TENANTS_KV.get("zebra-box", { type: "json" });
```

Estrutura do KV: chave = `{slug}`, valor = JSON com mesmo schema acima.

### 3.5 Backend VPS (Node.js / SQLite)

**Responsabilidade:** Persistência de dados, drain do KV, waitlist da landing page.

**Endpoints:**

```
POST /api/leads
  Body: { tenant, form_id, payload_json, ip_hash, created_at }
  Response: 201 Created | 400 Bad Request
  Timeout esperado pelo Worker: 400ms

POST /api/waitlist
  Body: { email }
  Response: 201 Created

GET /api/health
  Response: 200 OK (< 50ms)
```

**SLA do VPS:**
- Response de `/api/leads`: < 200ms (happy path)
- Qualquer resposta > 400ms = timeout do Worker → KV fallback ativa

---

## 4. Especificações — MVP v0 Zebra Box

### 4.1 Tenant Zebra Box

```
Slug:      zebra-box
Nome:      Zebra Box
WhatsApp:  +55 51 993668728  (wa.me: 5551993668728)
Negócio:   Locação de containers (obra e armazenagem)
```

### 4.2 Formulário form01 — Solicite um Container

| Campo | Tipo | Obrigatório | Opções |
|-------|------|-------------|--------|
| `location` | text | ✅ | — |
| `period` | select | ✅ | 1 mês / 2 meses / 3 meses / 4 meses / 6 meses / Mais de 6 meses |
| `purpose` | select | ✅ | Obra / Armazenagem / Outro |

> **Campo email removido:** Não aparece no formulário operacional. Email é coletado apenas na landing page para a waitlist do 2chat (beta). Leads do formulário chegam sem email — dado desnecessário neste fluxo.

### 4.3 Mensagem WhatsApp Gerada

```javascript
const template = `Olá, vim pelo 2chat. Tenho interesse em container para ${purpose} em ${location} por ${period}.`;
// Exemplo: "Olá, vim pelo 2chat. Tenho interesse em container para Obra em Porto Alegre por 3 meses."

const waUrl = `https://wa.me/5551993668728?text=${encodeURIComponent(template)}`;
```

### 4.4 Schema SQLite (VPS)

```sql
-- Leads dos formulários
CREATE TABLE leads (
    id           INTEGER  PRIMARY KEY AUTOINCREMENT,
    tenant_slug  TEXT     NOT NULL,
    form_id      TEXT     NOT NULL,
    payload_json TEXT     NOT NULL,  -- campos do formulário em JSON
    ip_hash      TEXT,               -- SHA256 do IP (LGPD-safe)
    source       TEXT DEFAULT 'form',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tenant_form  ON leads(tenant_slug, form_id);
CREATE INDEX idx_created_at   ON leads(created_at);

-- Waitlist da landing page (separada dos leads operacionais)
CREATE TABLE waitlist (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    email      TEXT     NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Buffer do KV fallback (drain cron)
CREATE TABLE kv_buffer (
    id          INTEGER  PRIMARY KEY AUTOINCREMENT,
    kv_key      TEXT     NOT NULL UNIQUE,  -- chave no KV do CF
    payload     TEXT     NOT NULL,
    processed   BOOLEAN  DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME
);
```

> **IP hash (LGPD):** O IP bruto não é armazenado. O Worker faz `SHA256(ip + salt)` antes de enviar ao VPS, tornando o dado pseudonimizado e em conformidade com a LGPD.

---

## 5. Rotas e Páginas — Estrutura Completa

| Rota | Servidor | Tipo | Descrição |
|------|----------|------|-----------|
| `GET /` | VPS/CDN (estático) | Landing Page | Apresentação + waitlist email |
| `GET /termos-de-uso` | VPS/CDN (estático) | Página legal | Termos de uso |
| `GET /politica-de-privacidade` | VPS/CDN (estático) | Página legal | Política de privacidade LGPD |
| `POST /api/waitlist` | VPS | API | Captura email waitlist |
| `GET /{slug}` | Worker | Hub tenant | Lista de formulários do cliente |
| `GET /{slug}/{form-id}` | Worker | Formulário | Qualificação do lead |
| `POST /api/leads` | VPS | API | Persistência do lead |
| `GET /api/health` | VPS | Status | Health check |

---

## 6. Hub do Tenant (`/{slug}`)

### Propósito
Fallback para links genéricos (`2chat.com.br/zebra-box`). Não é a URL principal que o cliente divulga — essa é sempre a URL do formulário específico (`2chat.com.br/zebra-box/form01`).

### Conteúdo Mínimo
- Nome do negócio
- Lista de formulários disponíveis (cards clicáveis com título e descrição)
- Branding do 2chat

**Sem bio, sem links extras, sem redes sociais.** O usuário que cai aqui precisa escolher um formulário e avançar — nada mais.

---

## 7. Landing Page (`/`)

### Objetivo
Converter interessados no **produto 2chat** (B2B), não qualificar leads de clientes.

### Conteúdo
- Explicação da proposta de valor
- Captura de email para beta waitlist
- Links para termos e política

### Dados Coletados
```json
{ "email": "interessado@empresa.com" }
```
Honeypot anti-bot: campo hidden `name="website"`.

---

## 8. LGPD e Conformidade

### Banner de Consentimento (GTAG4)
- Aparece em: `/`, `/zebra-box`, `/zebra-box/form01` e todos os formulários
- Bloqueia GTAG4 até consentimento explícito
- Armazenamento: `localStorage['cookie_consent'] = 'accepted' | 'rejected'`

### Dados e Base Legal
| Dado | Onde coletado | Base legal LGPD |
|------|--------------|-----------------|
| Email | Landing waitlist | Consentimento explícito |
| Cidade, Período, Finalidade | Formulário operacional | Legítimo interesse (qualificação) |
| IP (hasheado) | Log do Worker | Segurança / fraude |
| User-Agent | Log do Worker | Segurança / fraude |

---

## 9. Roadmap

### v0 (Atual — Zebra Box hardcoded)
- [x] Worker com config embutida
- [x] Formulário Zebra Box form01
- [x] Redirect WhatsApp com mensagem pré-preenchida
- [x] Log assíncrono no VPS com fallback KV
- [x] Landing page com waitlist

### v1 (Multi-tenant parametrizado)
- [ ] Config no Cloudflare KV
- [ ] Lifecycle de admin (criar/editar tenant via CLI ou painel mínimo)
- [ ] Drain automático KV → SQLite (cron no VPS)
- [ ] Múltiplos formulários por tenant
- [ ] Dashboard simples de leads (autenticado por magic link)

### v2 (Beta Externo)
- [ ] Onboarding self-service
- [ ] Modelo freemium (Powered by 2chat no tier gratuito)
- [ ] Exportação de leads (CSV)
- [ ] Analytics de conversão por formulário
- [ ] Webhooks para parceiros

---

## 10. Infraestrutura

### Deploy v0
| Componente | Onde | Como |
|-----------|------|------|
| Worker | Cloudflare Workers | `wrangler deploy` |
| Landing Page | VPS (Nginx, HTML estático) | Deploy manual ou Git |
| API (`/api/*`) | VPS (Node.js + PM2) | `pm2 restart` |
| Banco de dados | VPS (SQLite WAL mode) | Local no VPS |

### Monitoramento
- Health check: `GET /api/health` (Uptime Robot ou similar)
- KV buffer: alertar se acumular > 50 entradas não drenadas
- Logs do Worker: Cloudflare Dashboard → Workers → Logs