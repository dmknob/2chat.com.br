// src/routes/adminRoutes.js
const express = require('express');
const router  = express.Router();
const db      = require('../../database/db');
const logger  = require('../logger');
const kvSync  = require('../services/kvSync');

// Hardcoded Password Helper (MD5/Bcrypt seria melhor na V2, mas simples na V1 basta se seguro via SSL)
const ADMIN_PASS = process.env.ADMIN_PASSWORD || '2chat2026';

// Middleware de autenticação
function requireAuth(req, res, next) {
    if (req.session && req.session.isAdmin) {
        res.locals.isAdmin = true;
        return next();
    }
    // Salva a página que o usuário tentou acessar
    req.session.returnTo = req.originalUrl;
    return res.redirect('/admin/login');
}

// =============================================================================
// GET /admin ou /admin/
// =============================================================================
router.get('/', (req, res) => {
    res.redirect('/admin/hub');
});

// =============================================================================
// GET /admin/login
// =============================================================================
router.get('/login', (req, res) => {
    // Se logado, manda pro hub direto
    if (req.session && req.session.isAdmin) {
        return res.redirect('/admin/hub');
    }
    res.render('pages/admin/login', {
        title: 'Login Admin',
        description: 'Painel administrativo do 2chat',
        canonical: '/admin/login',
        errorMessage: req.session.error || null
    });
    // Limpa erro da sessão
    if (req.session) req.session.error = null;
});

// =============================================================================
// POST /admin/login
// =============================================================================
router.post('/login', (req, res) => {
    const { password } = req.body;
    
    if (password === ADMIN_PASS) {
        req.session.isAdmin = true;
        logger.info('Admin login efetuado via Hub', { ip: req.ip });
        
        // Puxa a URL salva (se houver) e limpa
        const returnTo = req.session.returnTo || '/admin/hub';
        delete req.session.returnTo;
        
        return res.redirect(returnTo);
    }
    
    req.session.error = 'Senha incorreta. Tente novamente.';
    logger.warn('Tentativa de login falha no Admin Hub', { ip: req.ip });
    return res.redirect('/admin/login');
});

// =============================================================================
// GET /admin/logout
// =============================================================================
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// =============================================================================
// GET /admin/hub (Dashboard principal)
// =============================================================================
router.get('/hub', requireAuth, (req, res) => {
    // Busca dados analíticos rápidos
    const parceirosCount = db.prepare('SELECT count(*) as total FROM parceiros WHERE is_active = 1').get().total;
    const leadsCount   = db.prepare('SELECT count(*) as total FROM leads').get().total;
    
    // Busca últimos 50 leads
    const recentLeads = db.prepare(`
        SELECT l.*, p.name as parceiro_name, f.title as form_title 
        FROM leads l
        LEFT JOIN parceiros p ON l.parceiro_id = p.id
        LEFT JOIN forms f ON l.form_id = f.id
        ORDER BY l.created_at DESC LIMIT 50
    `).all();

    res.render('pages/admin/dashboard', {
        title: 'Admin Hub',
        description: 'Gerenciamento estrutural do 2chat',
        canonical: '/admin/hub',
        parceirosCount,
        leadsCount,
        recentLeads
    });
});

// =============================================================================
// GET /admin/parceiros/new (Formulário Visual de Criação)
// =============================================================================
router.get('/parceiros/new', requireAuth, (req, res) => {
    res.render('pages/admin/new-parceiro', {
        title: 'Criar Parceiro',
        description: 'Adicionar nova empresa ao 2chat',
        canonical: '/admin/parceiros/new',
        errorMessage: req.session.error || null
    });
    if (req.session) req.session.error = null;
});

// =============================================================================
// POST /admin/parceiros/new (Processamento e Sync CF)
// =============================================================================
router.post('/parceiros/new', requireAuth, async (req, res) => {
    const { parceiro_name, parceiro_slug, whatsapp, form_title, form_slug, form_description, message_template, fields_json } = req.body;

    try {
        // Valida JSON
        let parsedFields;
        try {
            parsedFields = JSON.parse(fields_json);
            if (!Array.isArray(parsedFields)) throw new Error('Schema de campos precisa ser um Array [ ]');
        } catch (jErr) {
            req.session.error = 'Erro no Schema JSON dos Campos: ' + jErr.message;
            return res.redirect('/admin/parceiros/new');
        }

        // Transação no SQLite
        db.transaction(() => {
            // Insere Parceiro
            const parceiroStmt = db.prepare(`
                INSERT OR IGNORE INTO parceiros (slug, name, whatsapp, plan)
                VALUES (?, ?, ?, 'free')
            `);
            parceiroStmt.run(parceiro_slug, parceiro_name, whatsapp);

            const parceiro = db.prepare('SELECT id FROM parceiros WHERE slug = ?').get(parceiro_slug);

            // Insere Form
            const formStmt = db.prepare(`
                INSERT OR IGNORE INTO forms
                (parceiro_id, slug, title, description, fields_json, message_template)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            formStmt.run(
                parceiro.id,
                form_slug,
                form_title,
                form_description || '',
                JSON.stringify(parsedFields),
                message_template
            );
        })();

        // Sincroniza com a Cloudflare (Worker)
        await kvSync.publishParceiroToKV(parceiro_slug);

        logger.info(`Novo Parceiro Criado & Sincronizado: ${parceiro_slug}`);
        res.redirect('/admin/hub');

    } catch (err) {
        logger.error('Erro ao salvar UI Parceiro', { error: err.message });
        req.session.error = 'Falha ao salvar. Verifique se o slug já existe. Erro: ' + err.message;
        res.redirect('/admin/parceiros/new');
    }
});

module.exports = router;
