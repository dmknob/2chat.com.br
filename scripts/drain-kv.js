#!/usr/bin/env node
require('dotenv').config();
const { drainLeadsFromKV } = require('../src/services/leadDrainer');
const logger = require('../src/logger');

console.log('🚀 Iniciando drenagem manual do KV (recuperação de leads pendentes)...');

drainLeadsFromKV()
    .then(() => {
        console.log('✅ Drenagem concluída! Verifique os logs para detalhes.');
    })
    .catch((err) => {
        console.error('❌ Falha na drenagem:', err.message);
    })
    .finally(() => {
        // Aguarda 1 seg para dar tempo dos logs do Winston flusharem
        setTimeout(() => process.exit(), 1000);
    });
