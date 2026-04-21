// database/setup-db.js — npm run db:setup
// Padrão Corpo Digital (ref: brindaria/database/setup-db.js)
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const db   = require('./db');

const schemaPath = path.join(__dirname, 'schema.sql');
const schemaSql  = fs.readFileSync(schemaPath, 'utf8');

console.log('🔄 Criando tabelas do banco de dados...');

try {
    db.exec(schemaSql);
    console.log('✅ Schema aplicado com sucesso!');
    console.log(`📂 Arquivo: ${process.env.DB_FILE || '2chat_dev.db'}`);
} catch (error) {
    console.error('❌ Erro ao configurar banco:', error.message);
    process.exit(1);
}
