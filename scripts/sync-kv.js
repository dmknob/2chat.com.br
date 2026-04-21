#!/usr/bin/env node
require('dotenv').config();
const { publishTenantToKV } = require('../src/services/kvSync');
const logger = require('../src/logger');

const slug = process.argv[2] || 'zebra-box';

console.log(`🚀 Iniciando sincronização KV para: ${slug}...`);

publishTenantToKV(slug)
    .then((config) => {
        console.log('✅ Sincronização concluída com sucesso!');
        console.log('JSON publicado:', JSON.stringify(config, null, 2));
    })
    .catch((err) => {
        console.error('❌ Falha na sincronização:', err.message);
        if (err.message.includes('CF_API_TOKEN')) {
            console.log('\nDICA: Verifique se você preencheu o .env com seu TOKEN da Cloudflare.');
        }
        process.exit(1);
    });
