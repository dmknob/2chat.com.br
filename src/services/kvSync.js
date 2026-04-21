// src/services/kvSync.js
// Publica configuração de parceiro do SQLite → Cloudflare KV (TENANTS_KV)
// Chamado manualmente (CLI) ou pelo painel admin (v1)
const db     = require('../../database/db');
const logger = require('../logger');

/**
 * Lê parceiro + forms do SQLite e publica no Cloudflare KV.
 * O Worker passa a responder /{slug}/* imediatamente após o publish.
 *
 * @param {string} slug - Slug do parceiro ex: "zebra-box"
 * @returns {Object} - Config JSON publicada no KV
 */
async function publishParceiroToKV(slug) {
    const CF_ACCOUNT_ID      = process.env.CF_ACCOUNT_ID;
    const CF_API_TOKEN       = process.env.CF_API_TOKEN;
    const KV_TENANTS_NS_ID   = process.env.KV_TENANTS_NAMESPACE_ID;

    if (!CF_ACCOUNT_ID || !CF_API_TOKEN || !KV_TENANTS_NS_ID) {
        throw new Error(
            'Variáveis CF_ACCOUNT_ID, CF_API_TOKEN e KV_TENANTS_NAMESPACE_ID são obrigatórias no .env'
        );
    }

    // Busca parceiro ativo no banco
    const parceiro = db.prepare(`
        SELECT * FROM parceiros WHERE slug = ? AND is_active = 1
    `).get(slug);

    if (!parceiro) throw new Error(`Parceiro '${slug}' não encontrado ou inativo`);

    // Busca formulários ativos do parceiro
    const forms = db.prepare(`
        SELECT * FROM forms WHERE parceiro_id = ? AND is_active = 1
        ORDER BY id ASC
    `).all(parceiro.id);

    // Monta o JSON de configuração que o Worker vai ler do KV
    const kvConfig = {
        slug:     parceiro.slug,
        name:     parceiro.name,
        whatsapp: parceiro.whatsapp,          // sempre string (corpo-digital §1.4)
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

    // Publica no KV via API REST da Cloudflare com Retry Linear (anti-429)
    const kvUrl = [
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}`,
        `/storage/kv/namespaces/${KV_TENANTS_NS_ID}`,
        `/values/parceiro:${slug}`,
    ].join('');

    let res;
    let retries = 3;
    let delayMs = 1500;

    while (retries > 0) {
        res = await fetch(kvUrl, {
            method:  'PUT',
            headers: {
                'Authorization': `Bearer ${CF_API_TOKEN}`,
                'Content-Type':  'application/json',
            },
            body: JSON.stringify(kvConfig),
        });

        if (res.ok) break;

        if (res.status === 429) {
            logger.warn(`KV Sync Rate Limited (429) para '${slug}'. Retentando em ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            retries--;
            delayMs *= 2; // backoff exponencial simples (1.5s, 3s, 6s)
        } else {
            // Em caso de 400, 401 ou 500, não retentamos e abortamos imediatamente
            break;
        }
    }

    if (!res.ok) {
        const bodyText = await res.text();
        if (res.status === 429) {
             throw new Error(`Cloudflare Rate Limit (Erro 1015). Limite global da sua conta Cloudflare estourou. Os dados foram salvos no banco local SQLite, mas a sincronia falhou. Aguarde 5 minutos e edite o parceiro para retentar.`);
        }
        throw new Error(`Cloudflare KV API respondeu ${res.status}: ${bodyText.substring(0, 150)}...`);
    }

    logger.info(`☁️  Parceiro '${slug}' publicado no KV (${forms.length} form(s))`);
    return kvConfig;
}

/**
 * Remove parceiro do KV (quando desativado ou deletado)
 * @param {string} slug
 */
async function removeParceiroFromKV(slug) {
    const CF_ACCOUNT_ID    = process.env.CF_ACCOUNT_ID;
    const CF_API_TOKEN     = process.env.CF_API_TOKEN;
    const KV_TENANTS_NS_ID = process.env.KV_TENANTS_NAMESPACE_ID;

    const kvUrl = [
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}`,
        `/storage/kv/namespaces/${KV_TENANTS_NS_ID}`,
        `/values/parceiro:${slug}`,
    ].join('');

    await fetch(kvUrl, {
        method:  'DELETE',
        headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` },
    });

    logger.info(`🗑️  Parceiro '${slug}' removido do KV`);
}

module.exports = { publishParceiroToKV, removeParceiroFromKV };
