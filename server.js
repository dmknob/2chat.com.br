// server.js — entrypoint separado do app.js (padrão Corpo Digital §2.2)
// Facilita testes unitários e futura migração serverless
require('dotenv').config();
const app    = require('./app');
const logger = require('./src/logger');

const PORT = process.env.PORT || 3000;
const { drainLeadsFromKV } = require('./src/services/leadDrainer');

app.listen(PORT, () => {
    logger.info(`🚀 2chat rodando em http://localhost:${PORT}`);
    logger.info(`🔧 Modo: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`📦 DB: ${process.env.DB_FILE || '2chat_dev.db'}`);

    // Inicia drenagem agendada (Buffer Worker -> VPS SQLite)
    if (process.env.KV_LEADS_NAMESPACE_ID) {
        // Roda a cada 5 minutos (exigência de alta frequência)
        const FIVE_MINUTES = 5 * 60 * 1000;
        setInterval(() => {
            drainLeadsFromKV().catch(err => 
                logger.error('Erro na rotina de drenagem KV', { error: err.message })
            );
        }, FIVE_MINUTES);
        
        // Dispara uma vez logo no boot (com atraso para não engarrafar o startup)
        setTimeout(() => drainLeadsFromKV().catch(() => {}), 3000);
    }
});

// PM2 graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM recebido — encerrando servidor...');
    process.exit(0);
});
