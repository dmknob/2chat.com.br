-- =============================================================================
-- 2chat.com.br — Schema SQLite
-- Padrão Corpo Digital: snake_case, tabelas no plural, sempre TEXT para telefone
-- =============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- Parceiros: clientes do 2chat
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parceiros (
    id          INTEGER  PRIMARY KEY AUTOINCREMENT,
    slug        TEXT     UNIQUE NOT NULL,   -- "zebra-box" (kebab-case, URL-safe)
    name        TEXT     NOT NULL,          -- "Zebra Box"
    whatsapp    TEXT     NOT NULL,          -- "5551993668728" (SEMPRE TEXT — gotcha brindaria)
    plan        TEXT     DEFAULT 'free',    -- free | pro
    is_active   BOOLEAN  DEFAULT 1,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Forms: formulários de qualificação por parceiro
-- slug é gerado via slugify(title) e bloqueado após o 1° lead
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS forms (
    id               INTEGER  PRIMARY KEY AUTOINCREMENT,
    parceiro_id      INTEGER  NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
    slug             TEXT     NOT NULL,        -- "container" (kebab-case, URL-safe)
    slug_locked      BOOLEAN  DEFAULT 0,       -- 1 após o 1° lead → imutável
    title            TEXT     NOT NULL,        -- "Solicite aluguel de um Container"
    description      TEXT,
    fields_json      TEXT     NOT NULL,        -- JSON: array de Field objects
    message_template TEXT     NOT NULL,        -- "Olá! Vim pelo 2chat. {{purpose}} em {{location}}..."
    is_active        BOOLEAN  DEFAULT 1,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(parceiro_id, slug)                    -- slug único por parceiro
);

-- -----------------------------------------------------------------------------
-- Leads: qualificações capturadas pelos formulários
-- ip_hash: SHA-256(ip + salt) — IP bruto nunca chega ao VPS (LGPD)
-- city/region/country: geocoding nativo do Cloudflare Worker (não é PII)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
    id           INTEGER  PRIMARY KEY AUTOINCREMENT,
    parceiro_id  INTEGER  REFERENCES parceiros(id),
    form_id      INTEGER  REFERENCES forms(id),
    payload_json TEXT     NOT NULL,    -- {"location":"POA","period":"3 meses","purpose":"Obra"}
    ip_hash      TEXT,                 -- pseudonimizado (LGPD)
    city         TEXT,                 -- "Porto Alegre"
    region       TEXT,                 -- "Rio Grande do Sul"
    country      TEXT,                 -- "BR"
    source       TEXT     DEFAULT 'form',  -- 'form' | 'kv_buffer'
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Waitlist: interessados no produto 2chat (beta closed)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS waitlist (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    email      TEXT     NOT NULL UNIQUE COLLATE NOCASE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- KV Buffer: leads salvos no Cloudflare KV quando o VPS estava offline
-- Drenados pelo script manual (v0) ou cron automático (v1)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kv_buffer (
    id           INTEGER  PRIMARY KEY AUTOINCREMENT,
    kv_key       TEXT     NOT NULL UNIQUE,
    payload      TEXT     NOT NULL,
    processed    BOOLEAN  DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME
);

-- -----------------------------------------------------------------------------
-- Índices de performance
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_leads_parceiro_form  ON leads(parceiro_id, form_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at      ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_country          ON leads(country);
CREATE INDEX IF NOT EXISTS idx_forms_parceiro_active  ON forms(parceiro_id, is_active);
CREATE INDEX IF NOT EXISTS idx_kv_buffer_pending      ON kv_buffer(processed) WHERE processed = 0;
