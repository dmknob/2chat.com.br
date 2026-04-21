// src/routes/publicRoutes.js
const express          = require('express');
const router           = express.Router();
const publicController = require('../controllers/publicController');

// Landing page
router.get('/', publicController.getHome);

// Páginas institucionais
router.get('/termos-de-uso',          publicController.getTermos);
router.get('/politica-de-privacidade', publicController.getPrivacidade);

module.exports = router;
