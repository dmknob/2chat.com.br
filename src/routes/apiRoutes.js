// src/routes/apiRoutes.js
const express        = require('express');
const router         = express.Router();
const apiController  = require('../controllers/apiController');
const { waitlistLimiter, leadsLimiter, apiLimiter } = require('../middleware/rateLimit');

// Health check — sem rate limit (monitoramento externo)
router.get('/health', apiController.getHealth);

// Waitlist: beta closed — 3 req/min por IP
router.post('/waitlist', waitlistLimiter, apiController.postWaitlist);

// Leads: receptor do Cloudflare Worker — 30 req/min por IP
router.post('/leads', leadsLimiter, apiController.postLead);

// Fallback API geral
router.use(apiLimiter);

module.exports = router;
