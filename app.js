// app.js — Express config (sem app.listen — separado no server.js)
// Padrão Corpo Digital (ref: brindaria/app.js)
require('dotenv').config();

const express     = require('express');
const path        = require('path');
const fs          = require('fs');
const compression = require('compression');
const helmet      = require('helmet');
const morgan      = require('morgan');
const session     = require('express-session');
const logger      = require('./src/logger');

const app  = express();
const PORT = process.env.PORT || 3000;

// Configuração de Sessão para a Admin Area
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-12345',
    resave: false,
    saveUninitialized: false,
    name: '2chat.sid',
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 // 24 Horas
    }
}));

// =============================================================================
// 1. Configurações de proxy e segurança básica
// =============================================================================
app.set('trust proxy', 1);   // Atrás do Nginx (X-Forwarded-For confiável)
app.disable('x-powered-by'); // Não expõe que usa Express

// =============================================================================
// 2. View Engine (EJS)
// =============================================================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// Cache de views em produção: templates compilados uma vez e mantidos na RAM
app.set('view cache', process.env.NODE_ENV === 'production');

// =============================================================================
// 3. CSS embutido (inline no <head> — sem request extra)
// Lido do arquivo compilado pelo Tailwind (npm run build:css)
// Padrão: app.locals disponível em todos os templates EJS
// =============================================================================
const cssPath = path.join(__dirname, 'public', 'css', 'style.css');
try {
    app.locals.inlineCSS = fs.readFileSync(cssPath, 'utf8');
} catch {
    // Em dev antes do primeiro build, usa string vazia (Tailwind CDN é fallback no head.ejs)
    app.locals.inlineCSS = '';
    logger.warn('⚠️  public/css/style.css não encontrado — rode npm run build:css');
}

// =============================================================================
// 4. Variáveis globais disponíveis em todos os templates
// =============================================================================
app.locals.BASE_URL    = process.env.BASE_URL    || 'http://localhost:3000';
app.locals.GA_ID       = process.env.GA_ID       || null;
app.locals.SITE_NAME   = '2chat';
app.locals.NODE_ENV    = process.env.NODE_ENV    || 'development';

// =============================================================================
// 5. Middlewares de performance e segurança (Padrão Ouro Corpo Digital)
// =============================================================================
// Compressão GZIP (vital para velocidade)
app.use(compression());

// HSTS: força HTTPS por 1 ano com includeSubDomains e preload
app.use(helmet.hsts({
    maxAge:            31536000,
    includeSubDomains: true,
    preload:           true,
}));

// Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '50kb' })); // Limite no JSON: previne payloads absurdos

// =============================================================================
// 6. Logging HTTP (Morgan + Winston — padrão Brindaria)
// =============================================================================
// Regex para detectar requests de assets estáticos
const assetsRegex = /\.(?:css|js|map|png|jpe?g|webp|svg|ico|woff2?|ttf)(?:[?#].*)?$/i;

// Rotas (logs completos — combined format)
app.use(morgan(
    process.env.MORGAN_FORMAT || 'combined',
    {
        stream: logger.stream,
        skip:   (req) => assetsRegex.test(req.path),
    }
));

// Assets (log compacto separado)
app.use(morgan(
    ':method :url :status :res[content-length] - :response-time ms',
    {
        stream: logger.assetsStream,
        skip:   (req) => !assetsRegex.test(req.path),
    }
));

// =============================================================================
// 7. Arquivos Estáticos (CSS compilado, JS, imagens)
// =============================================================================
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',     // Cache de 1 dia no navegador
    etag:   true,     // ETag para revalidação eficiente
}));

// =============================================================================
// 8. Rotas
// =============================================================================
const publicRoutes = require('./src/routes/publicRoutes');
const apiRoutes    = require('./src/routes/apiRoutes');
const adminRoutes  = require('./src/routes/adminRoutes');

app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);
app.use('/', publicRoutes);

// =============================================================================
// 9. Handlers de erro (404 e 500)
// =============================================================================
app.use((req, res) => {
    res.status(404).render('pages/404', {
        title:       'Página não encontrada',
        description: 'A página que você procura não existe.',
        canonical:   '/404',
    });
});

app.use((err, req, res, next) => {
    logger.error('Erro não tratado', {
        message: err.message,
        stack:   err.stack,
        method:  req.method,
        url:     req.originalUrl,
    });
    res.status(500).render('pages/500', {
        title:       'Erro interno',
        description: 'Algo deu errado. Tente novamente em instantes.',
        canonical:   '/500',
    });
});

module.exports = app;
