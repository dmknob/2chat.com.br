// src/controllers/apiController.js
const db     = require('../../database/db');
const logger = require('../logger');

// =============================================================================
// GET /api/health
// Monitoramento: uptime, status do banco, versão
// =============================================================================
exports.getHealth = (req, res) => {
    try {
        // Testa conexão com o banco (query simples, < 1ms)
        db.prepare('SELECT 1').get();
        res.json({
            status:  'ok',
            uptime:  Math.floor(process.uptime()),
            db:      'connected',
            version: process.env.npm_package_version || '1.0.0',
            env:     process.env.NODE_ENV || 'development',
        });
    } catch (err) {
        logger.error('Health check: DB falhou', { message: err.message });
        res.status(503).json({ status: 'degraded', db: 'error' });
    }
};

// =============================================================================
// POST /api/waitlist
// Recebe: { email }
// Retorna: 201 (criado) | 409 (duplicado) | 400 (inválido) | 429 (rate limit)
// =============================================================================
exports.postWaitlist = (req, res) => {
    const { email } = req.body || {};

    // Validação server-side (não confiar no client)
    if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Campo email é obrigatório.' });
    }

    const emailClean = email.trim().toLowerCase();

    // Validação básica de formato
    if (!emailClean.includes('@') || emailClean.length < 5 || emailClean.length > 254) {
        return res.status(400).json({ error: 'E-mail inválido.' });
    }

    try {
        db.prepare(`
            INSERT INTO waitlist (email) VALUES (?)
        `).run(emailClean);

        logger.info('Waitlist: novo email', { email: emailClean });
        return res.status(201).json({ success: true, message: 'Cadastrado com sucesso!' });

    } catch (err) {
        // UNIQUE constraint: email já cadastrado
        if (err.message.includes('UNIQUE constraint')) {
            return res.status(409).json({
                success: true,
                message: 'E-mail já cadastrado na lista de espera.',
            });
        }
        logger.error('Waitlist: erro ao inserir', { message: err.message });
        return res.status(500).json({ error: 'Erro interno. Tente novamente.' });
    }
};

// =============================================================================
// POST /api/leads
// Receptor do Cloudflare Worker — armazena lead qualificado no SQLite
// Payload: { parceiro, form_id, payload_json, ip_hash, city, region, country, created_at }
// =============================================================================
exports.postLead = (req, res) => {
    // Validação mínima de origem: header enviado pelo Worker
    const source = req.headers['x-2chat-source'];
    if (!source || !source.startsWith('worker-')) {
        return res.status(403).json({ error: 'Origem não autorizada.' });
    }

    const {
        parceiro,
        form_id,
        payload_json,
        ip_hash,
        city     = null,
        region   = null,
        country  = null,
        created_at,
    } = req.body || {};

    // Valida campos obrigatórios
    if (!parceiro || !form_id || !payload_json) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes: parceiro, form_id, payload_json' });
    }

    try {
        // Resolve IDs relacionais (parceiro_id e form_id numérico)
        const parceiroRow = db.prepare(`
            SELECT id FROM parceiros WHERE slug = ? AND is_active = 1
        `).get(parceiro);

        let dbParceiroId = parceiroRow?.id ?? null;
        let dbFormId   = null;

        if (dbParceiroId) {
            const formRow = db.prepare(`
                SELECT id, slug_locked FROM forms
                WHERE parceiro_id = ? AND slug = ? AND is_active = 1
            `).get(dbParceiroId, form_id);

            if (formRow) {
                dbFormId = formRow.id;

                // Bloqueia o slug após o 1° lead (imutável para evitar links quebrados)
                if (!formRow.slug_locked) {
                    db.prepare(`
                        UPDATE forms SET slug_locked = 1, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).run(formRow.id);
                }
            }
        }

        // Insere o lead (mesmo sem parceiro/form resolvidos — graceful degradation)
        db.prepare(`
            INSERT INTO leads
                (parceiro_id, form_id, payload_json, ip_hash, city, region, country, source, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            dbParceiroId,
            dbFormId,
            typeof payload_json === 'string' ? payload_json : JSON.stringify(payload_json),
            ip_hash   || null,
            city,
            region,
            country,
            source,
            created_at || new Date().toISOString(),
        );

        logger.info('Lead capturado', {
            parceiro,
            form_id,
            city:    city    || 'n/a',
            country: country || 'n/a',
        });

        return res.status(201).json({ success: true });

    } catch (err) {
        logger.error('Leads API: erro ao inserir', { message: err.message, parceiro, form_id });
        return res.status(500).json({ error: 'Erro interno.' });
    }
};
