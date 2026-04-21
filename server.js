// server.js — entrypoint separado do app.js (padrão Corpo Digital §2.2)
// Facilita testes unitários e futura migração serverless
require('dotenv').config();
const app    = require('./app');
const logger = require('./src/logger');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    logger.info(`🚀 2chat rodando em http://localhost:${PORT}`);
    logger.info(`🔧 Modo: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`📦 DB: ${process.env.DB_FILE || '2chat_dev.db'}`);
});

// PM2 graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM recebido — encerrando servidor...');
    process.exit(0);
});
