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
    const leadsCount     = db.prepare('SELECT count(*) as total FROM leads').get().total;
    const waitlistCount  = db.prepare('SELECT count(*) as total FROM waitlist').get().total;
    
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
        waitlistCount,
        recentLeads
    });
});

// =============================================================================
// GET /admin/parceiros (Lista Mestre de Parceiros)
// =============================================================================
router.get('/parceiros', requireAuth, (req, res) => {
    const list = db.prepare(`
        SELECT p.*, COUNT(f.id) as forms_count 
        FROM parceiros p 
        LEFT JOIN forms f ON f.parceiro_id = p.id 
        GROUP BY p.id 
        ORDER BY p.name ASC
    `).all();

    res.render('pages/admin/parceiros', {
        title: 'Gerenciar Parceiros',
        description: 'Lista de inquilinos e seus múltiplos links de formulário.',
        canonical: '/admin/parceiros',
        list
    });
});

// =============================================================================
// GET /admin/waitlist (Lista de Alfas/Waitlist)
// =============================================================================
router.get('/waitlist', requireAuth, (req, res) => {
    const list = db.prepare('SELECT * FROM waitlist ORDER BY created_at DESC').all();

    res.render('pages/admin/waitlist', {
        title: 'Waitlist',
        description: 'Interessados no Beta do 2chat',
        canonical: '/admin/waitlist',
        list
    });
});

// =============================================================================
// GET /admin/leads/:id (Detalhes do Lead)
// =============================================================================
router.get('/leads/:id', requireAuth, (req, res) => {
    const { id } = req.params;

    const lead = db.prepare(`
        SELECT l.*, p.name as parceiro_name, p.slug as parceiro_slug, 
               f.title as form_title, f.slug as form_slug, f.fields_json
        FROM leads l
        LEFT JOIN parceiros p ON l.parceiro_id = p.id
        LEFT JOIN forms f ON l.form_id = f.id
        WHERE l.id = ?
    `).get(id);

    if (!lead) {
        return res.status(404).send('Lead não encontrado.');
    }

    // Parse do JSON para exibição limpa
    const payload = JSON.parse(lead.payload_json);
    const formFields = lead.fields_json ? JSON.parse(lead.fields_json) : [];

    res.render('pages/admin/lead-detail', {
        title: `Detalhes do Lead #${id}`,
        description: `Visualização completa dos dados capturados no lead #${id}`,
        canonical: `/admin/leads/${id}`,
        lead,
        payload,
        formFields
    });
});

// =============================================================================
// GET /admin/parceiros/:id (Detalhes do Parceiro + Lista de Forms)
// =============================================================================
router.get('/parceiros/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    if (id === 'new') return next(); // Fallback para a rota /new

    const parceiro = db.prepare('SELECT * FROM parceiros WHERE id = ?').get(id);
    if (!parceiro) {
        req.session.error = 'Parceiro não encontrado.';
        return res.redirect('/admin/parceiros');
    }

    const forms = db.prepare('SELECT * FROM forms WHERE parceiro_id = ? ORDER BY id ASC').all(id);

    res.render('pages/admin/parceiro-detail', {
        title: `Parceiro: ${parceiro.name}`,
        description: 'Gerencie campos globais e links de qualificação',
        canonical: `/admin/parceiros/${id}`,
        parceiro,
        forms,
        errorMessage: req.session.error || null,
        successMessage: req.session.success || null
    });

    if (req.session) {
        req.session.error = null;
        req.session.success = null;
    }
});

// =============================================================================
// POST /admin/parceiros/:id/edit (Gravar Edição Básica)
// =============================================================================
router.post('/parceiros/:id/edit', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { parceiro_name, whatsapp, is_active } = req.body;
    const activeFlag = is_active ? 1 : 0;

    try {
        const parceiro = db.prepare('SELECT slug FROM parceiros WHERE id = ?').get(id);
        if (!parceiro) throw new Error('Parceiro não existe');

        db.prepare('UPDATE parceiros SET name = ?, whatsapp = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(parceiro_name, whatsapp, activeFlag, id);

        // Se atualizar algo master, empurra a árvore toda pro KV novamente
        await kvSync.publishParceiroToKV(parceiro.slug);

        req.session.success = 'Parceiro atualizado e sincronizado com Cloudflare.';
    } catch (err) {
        logger.error('Erro atualizar parceiro', err);
        req.session.error = err.message;
    }

    res.redirect(`/admin/parceiros/${id}`);
});

// =============================================================================
// POST /admin/parceiros/:slug/sync (Sync Force Manual)
// =============================================================================
router.post('/parceiros/:slug/sync', requireAuth, async (req, res) => {
    try {
        await kvSync.publishParceiroToKV(req.params.slug);
        logger.info(`Sincronia manual forçada para ${req.params.slug}`);
    } catch (err) {
        logger.error('Erro Forçar Sincronia', err);
    }
    // Independente do erro ou acerto, volta pra lista
    res.redirect('/admin/parceiros');
});

// =============================================================================
// GET /admin/parceiros/new (Formulário Visual de Criação DB Master)
// =============================================================================
router.get('/parceiros/new', requireAuth, (req, res) => {
    // Reutilizando view simplificada (que precisará ser editada depois para remover campos de form)
    res.render('pages/admin/new-parceiro', {
        title: 'Criar Parceiro',
        description: 'Adicionar nova empresa ao 2chat',
        canonical: '/admin/parceiros/new',
        errorMessage: req.session.error || null
    });
    if (req.session) req.session.error = null;
});

// =============================================================================
// POST /admin/parceiros/new (Processamento e Redirecionamento)
// =============================================================================
router.post('/parceiros/new', requireAuth, async (req, res) => {
    // Agora aceitamos apenas dados master na criação primária
    const { parceiro_name, parceiro_slug, whatsapp } = req.body;

    try {
        const insertInfo = db.prepare(`
            INSERT INTO parceiros (slug, name, whatsapp, plan)
            VALUES (?, ?, ?, 'free')
        `).run(parceiro_slug, parceiro_name, whatsapp);

        // Não faz Sync ainda pq não tem Form. Redireciona pra página dele.
        res.redirect(`/admin/parceiros/${insertInfo.lastInsertRowid}`);
    } catch (err) {
        logger.error('Erro ao salvar UI Parceiro', { error: err.message });
        req.session.error = 'Falha ao salvar. Verifique se o slug já existe. Erro: ' + err.message;
        res.redirect('/admin/parceiros/new');
    }
});

// =============================================================================
// GET /admin/parceiros/:id/forms/new
// =============================================================================
router.get('/parceiros/:id/forms/new', requireAuth, (req, res) => {
    const parceiro = db.prepare('SELECT id, name, slug FROM parceiros WHERE id = ?').get(req.params.id);
    if (!parceiro) return res.redirect('/admin/parceiros');

    res.render('pages/admin/form-edit', {
        title: 'Criar Novo Formulário',
        description: 'Adicionar canal de qualificação',
        canonical: '',
        parceiro,
        errorMessage: req.session.error || null
    });
    if (req.session) req.session.error = null;
});

// =============================================================================
// POST /admin/parceiros/:id/forms/new
// =============================================================================
router.post('/parceiros/:id/forms/new', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { title, slug, description, fields_json, message_template } = req.body;

    try {
        const parceiro = db.prepare('SELECT id, slug FROM parceiros WHERE id = ?').get(id);
        if (!parceiro) throw new Error('Parceiro pai não encontrado');

        // Validar Json
        let parsedFields;
        try {
            parsedFields = JSON.parse(fields_json);
            if (!Array.isArray(parsedFields)) throw new Error('O schema JSON precisa ser um Array válido [ ]');
        } catch(jsonErr) {
            req.session.error = 'Erro na sintaxe JSON: ' + jsonErr.message;
            return res.redirect(`/admin/parceiros/${id}/forms/new`);
        }

        db.prepare(`
            INSERT INTO forms (parceiro_id, slug, title, description, fields_json, message_template)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(parceiro.id, slug, title, description || '', JSON.stringify(parsedFields), message_template);

        // Sync automático de todo o parceiro (KV envia objeto completo)
        await kvSync.publishParceiroToKV(parceiro.slug);
        
        req.session.success = 'Formulário criado com sucesso e sincronizado no KV.';
        res.redirect(`/admin/parceiros/${id}`);
    } catch (err) {
        logger.error('Erro criar form', err);
        req.session.error = err.message;
        res.redirect(`/admin/parceiros/${id}/forms/new`);
    }
});

// =============================================================================
// GET /admin/parceiros/:id/forms/:form_id/edit
// =============================================================================
router.get('/parceiros/:id/forms/:form_id/edit', requireAuth, (req, res) => {
    const { id, form_id } = req.params;
    const parceiro = db.prepare('SELECT id, name, slug FROM parceiros WHERE id = ?').get(id);
    const form = db.prepare('SELECT * FROM forms WHERE id = ? AND parceiro_id = ?').get(form_id, id);

    if (!parceiro || !form) return res.redirect(`/admin/parceiros/${id}`);

    res.render('pages/admin/form-edit', {
        title: 'Editar Formulário',
        description: 'Alterar regras de qualificação de leads',
        canonical: '',
        parceiro,
        form: { ...form, fields_json: form.fields_json }, // Fields já é string JSON no banco
        errorMessage: req.session.error || null
    });
    if (req.session) req.session.error = null;
});

// =============================================================================
// POST /admin/parceiros/:id/forms/:form_id/edit
// =============================================================================
router.post('/parceiros/:id/forms/:form_id/edit', requireAuth, async (req, res) => {
    const { id, form_id } = req.params;
    const { title, description, fields_json, message_template, is_active } = req.body;
    let { slug } = req.body; // Slug *pode* vir caso não seja bloqueado

    try {
        const parceiro = db.prepare('SELECT id, slug FROM parceiros WHERE id = ?').get(id);
        const formTarget = db.prepare('SELECT slug_locked, slug FROM forms WHERE id = ?').get(form_id);
        
        if (!parceiro || !formTarget) throw new Error('Parceiro ou formulário inexistente');

        // Impede mudança de slug se ele estiver bloqueado (por já ter leads)
        if (formTarget.slug_locked) {
            slug = formTarget.slug;
        }

        let parsedFields;
        try {
            parsedFields = JSON.parse(fields_json);
            if (!Array.isArray(parsedFields)) throw new Error('O schema JSON precisa ser um Array válido [ ]');
        } catch(jsonErr) {
            req.session.error = 'Erro na sintaxe JSON: ' + jsonErr.message;
            return res.redirect(`/admin/parceiros/${id}/forms/${form_id}/edit`);
        }

        db.prepare(`
            UPDATE forms 
            SET title = ?, slug = ?, description = ?, fields_json = ?, message_template = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND parceiro_id = ?
        `).run(title, slug, description || '', JSON.stringify(parsedFields), message_template, is_active ? 1 : 0, form_id, id);

        // Sync Automático Edge
        await kvSync.publishParceiroToKV(parceiro.slug);

        req.session.success = 'Formulário atualizado e Edge Sincronizado.';
    } catch (err) {
        logger.error('Erro atualizar form', err);
        req.session.error = err.message;
        return res.redirect(`/admin/parceiros/${id}/forms/${form_id}/edit`);
    }
    
    res.redirect(`/admin/parceiros/${id}`);
});

module.exports = router;
