// src/routes/adminRoutes.js
const express = require('express');
const router  = express.Router();
const db      = require('../../database/db');
const logger  = require('../logger');

// Hardcoded Password Helper (MD5/Bcrypt seria melhor na V2, mas simples na V1 basta se seguro via SSL)
const ADMIN_PASS = process.env.ADMIN_PASSWORD || '2chat2026';

// Middleware de autenticação
function requireAuth(req, res, next) {
    if (req.session && req.session.isAdmin) {
        res.locals.isAdmin = true;
        return next();
    }
    return res.redirect('/admin/login');
}

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
        return res.redirect('/admin/hub');
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
    res.redirect('/admin/login');
});

// =============================================================================
// GET /admin/hub (Dashboard principal)
// =============================================================================
router.get('/hub', requireAuth, (req, res) => {
    // Busca dados analíticos rápidos
    const tenantsCount = db.prepare('SELECT count(*) as total FROM tenants WHERE is_active = 1').get().total;
    const leadsCount   = db.prepare('SELECT count(*) as total FROM leads').get().total;
    
    // Busca últimos 50 leads
    const recentLeads = db.prepare(`
        SELECT l.*, t.name as tenant_name, f.title as form_title 
        FROM leads l
        LEFT JOIN tenants t ON l.tenant_id = t.id
        LEFT JOIN forms f ON l.form_id = f.id
        ORDER BY l.created_at DESC LIMIT 50
    `).all();

    res.render('pages/admin/dashboard', {
        title: 'Admin Hub',
        description: 'Gerenciamento estrutural do 2chat',
        canonical: '/admin/hub',
        tenantsCount,
        leadsCount,
        recentLeads
    });
});

module.exports = router;
