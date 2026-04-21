// src/services/kvSync.js
// Publica configuração de tenant do SQLite → Cloudflare KV (TENANTS_KV)
// Chamado manualmente (CLI) ou pelo painel admin (v1)
const db     = require('../../database/db');
const logger = require('../logger');

/**
 * Lê tenant + forms do SQLite e publica no Cloudflare KV.
 * O Worker passa a responder /{slug}/* imediatamente após o publish.
 *
 * @param {string} slug - Slug do tenant ex: "zebra-box"
 * @returns {Object} - Config JSON publicada no KV
 */
async function publishTenantToKV(slug) {
    const CF_ACCOUNT_ID      = process.env.CF_ACCOUNT_ID;
    const CF_API_TOKEN       = process.env.CF_API_TOKEN;
    const KV_TENANTS_NS_ID   = process.env.KV_TENANTS_NAMESPACE_ID;

    if (!CF_ACCOUNT_ID || !CF_API_TOKEN || !KV_TENANTS_NS_ID) {
        throw new Error(
            'Variáveis CF_ACCOUNT_ID, CF_API_TOKEN e KV_TENANTS_NAMESPACE_ID são obrigatórias no .env'
        );
    }

    // Busca tenant ativo no banco
    const tenant = db.prepare(`
        SELECT * FROM tenants WHERE slug = ? AND is_active = 1
    `).get(slug);

    if (!tenant) throw new Error(`Tenant '${slug}' não encontrado ou inativo`);

    // Busca formulários ativos do tenant
    const forms = db.prepare(`
        SELECT * FROM forms WHERE tenant_id = ? AND is_active = 1
        ORDER BY id ASC
    `).all(tenant.id);

    // Monta o JSON de configuração que o Worker vai ler do KV
    const kvConfig = {
        slug:     tenant.slug,
        name:     tenant.name,
        whatsapp: tenant.whatsapp,          // sempre string (corpo-digital §1.4)
        forms:    Object.fromEntries(forms.map(f => [
            f.slug,
            {
                id:               f.slug,
                title:            f.title,
                description:      f.description ?? '',
                fields:           JSON.parse(f.fields_json),
                message_template: f.message_template,
            }
        ])),
    };

    // Publica no KV via API REST da Cloudflare
    // Chave: "tenant:{slug}" — prefixo evita colisão com outras chaves futuras
    const kvUrl = [
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}`,
        `/storage/kv/namespaces/${KV_TENANTS_NS_ID}`,
        `/values/tenant:${slug}`,
    ].join('');

    const res = await fetch(kvUrl, {
        method:  'PUT',
        headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
            'Content-Type':  'application/json',
        },
        body: JSON.stringify(kvConfig),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Cloudflare KV API respondeu ${res.status}: ${body}`);
    }

    logger.info(`☁️  Tenant '${slug}' publicado no KV (${forms.length} form(s))`);
    return kvConfig;
}

/**
 * Remove tenant do KV (quando desativado ou deletado)
 * @param {string} slug
 */
async function removeTenantFromKV(slug) {
    const CF_ACCOUNT_ID    = process.env.CF_ACCOUNT_ID;
    const CF_API_TOKEN     = process.env.CF_API_TOKEN;
    const KV_TENANTS_NS_ID = process.env.KV_TENANTS_NAMESPACE_ID;

    const kvUrl = [
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}`,
        `/storage/kv/namespaces/${KV_TENANTS_NS_ID}`,
        `/values/tenant:${slug}`,
    ].join('');

    await fetch(kvUrl, {
        method:  'DELETE',
        headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` },
    });

    logger.info(`🗑️  Tenant '${slug}' removido do KV`);
}

module.exports = { publishTenantToKV, removeTenantFromKV };
