// src/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

/**
 * Waitlist: 3 tentativas por IP por minuto
 * Protege contra flood de bot tentando saturar a lista de emails
 */
const waitlistLimiter = rateLimit({
    windowMs:         60 * 1000, // 1 minuto
    max:              3,
    standardHeaders:  true,
    legacyHeaders:    false,
    message: {
        error: 'Muitas tentativas. Aguarde 1 minuto antes de tentar novamente.',
    },
    // Ignora IPs da rede local (dev)
    skip: (req) => process.env.NODE_ENV === 'development' &&
                   ['::1', '127.0.0.1', '::ffff:127.0.0.1'].includes(req.ip),
});

/**
 * Leads API: 30 req/min por IP
 * Volume gerado pelo Cloudflare Worker (pode haver picos legítimos em campanhas)
 */
const leadsLimiter = rateLimit({
    windowMs:         60 * 1000, // 1 minuto
    max:              30,
    standardHeaders:  true,
    legacyHeaders:    false,
    message: {
        error: 'Limite de requisições excedido.',
    },
});

/**
 * API geral: 60 req/min por IP (fallback para rotas /api/ não especificadas)
 */
const apiLimiter = rateLimit({
    windowMs:        60 * 1000,
    max:             60,
    standardHeaders: true,
    legacyHeaders:   false,
    message: {
        error: 'Limite de requisições excedido.',
    },
});

module.exports = { waitlistLimiter, leadsLimiter, apiLimiter };
