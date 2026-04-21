// src/routes/publicRoutes.js
const express          = require('express');
const router           = express.Router();
const publicController = require('../controllers/publicController');

// Landing page
router.get('/', publicController.getHome);

// Hub de Artigos SEO
router.get('/artigos', publicController.getArtigosHub);
router.get('/artigos/como-evitar-curiosos-whatsapp', publicController.getArtigoSintomas);
router.get('/artigos/armadilha-orcamentos-whatsapp', publicController.getArtigoOrcamentos);

// Páginas institucionais
router.get('/termos-de-uso',          publicController.getTermos);
router.get('/politica-de-privacidade', publicController.getPrivacidade);

// SEO: Sitemap
router.get('/sitemap.xml', publicController.getSitemap);

module.exports = router;
