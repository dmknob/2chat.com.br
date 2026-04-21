// src/services/leadDrainer.js
const logger = require('../logger');

/**
 * Consulta a API da Cloudflare para listar as chaves do namespace LEADS_KV.
 * Para cada chave encontrada, puxa o valor (JSON do lead) e o injeta no endpoint interno.
 * Em caso de sucesso da inserção interna, apaga a chave do KV.
 */
async function drainLeadsFromKV() {
    const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
    const CF_API_TOKEN  = process.env.CF_API_TOKEN;
    const KV_LEADS_NS_ID = process.env.KV_LEADS_NAMESPACE_ID;
    const PORT = process.env.PORT || 3000;

    if (!CF_ACCOUNT_ID || !CF_API_TOKEN || !KV_LEADS_NS_ID) {
        logger.warn('Drainer KV: Credenciais não configuradas. Pulando execução.');
        return;
    }

    try {
        // 1. Listar chaves com prefixo "lead:"
        const listUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_LEADS_NS_ID}/keys?prefix=lead:`;
        const listRes = await fetch(listUrl, {
            headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` }
        });

        if (!listRes.ok) {
            throw new Error(`CF List falhou: ${listRes.status} ${await listRes.text()}`);
        }

        const listData = await listRes.json();
        const keys = listData.result || [];

        if (keys.length === 0) {
            // Nenhum lead pendente
            return;
        }

        logger.info(`Drainer KV: Encontrados ${keys.length} lead(s) pendente(s). Iniciando resgate...`);

        // 2. Iterar sobre cada chave resgatando o conteúdo e inserindo no SQLite
        for (const keyObj of keys) {
            const keyName = keyObj.name;
            const itemUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_LEADS_NS_ID}/values/${keyName}`;

            // 2.1 Puxa valor
            const itemRes = await fetch(itemUrl, {
                headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` }
            });

            if (!itemRes.ok) {
                logger.error(`Drainer KV: Erro ao puxar lead ${keyName}. Status: ${itemRes.status}`);
                continue;
            }

            const leadData = await itemRes.json();

            // 2.2 Injeta no backend local via localhost
            const intRes = await fetch(`http://127.0.0.1:${PORT}/api/leads`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-2chat-Source': 'worker-v0' // Bypass simples no bloqueador do apiController
                },
                body: JSON.stringify(leadData)
            });

            if (!intRes.ok) {
                logger.error(`Drainer KV: Injeção falhou para ${keyName}. Status: ${intRes.status}`);
                continue;
            }

            // 2.3 Exclui a chave do KV
            const delRes = await fetch(itemUrl, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` }
            });

            if (delRes.ok) {
                logger.info(`Drainer KV: Lead ${keyName} resgatado com sucesso.`);
            } else {
                logger.warn(`Drainer KV: Falha ao deletar ${keyName} após resgate.`);
            }
        }
    } catch (err) {
        logger.error('Drainer KV: Erro geral na drenagem', { error: err.message });
    }
}

module.exports = { drainLeadsFromKV };
