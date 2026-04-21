// database/setup-db.js — npm run db:setup
// Padrão Corpo Digital (ref: brindaria/database/setup-db.js)
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const db   = require('./db');

const schemaPath = path.join(__dirname, 'schema.sql');
const schemaSql  = fs.readFileSync(schemaPath, 'utf8');

console.log('🔄 Verificando integridade e nomenclatura do banco...');

try {
    // 1. Mini-migration: Se existir a tabela antiga 'tenants', renomeia para 'parceiros'
    const oldTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tenants'").get();
    if (oldTable) {
        console.log('⚠️  Mantendo compatibilidade: Renomeando "tenants" para "parceiros"...');
        db.exec('ALTER TABLE tenants RENAME TO parceiros');
    }

    // 2. Mini-migration: Se a tabela 'forms' existir mas ainda tiver 'tenant_id'
    const tableForms = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='forms'").get();
    if (tableForms) {
        const columns = db.prepare("PRAGMA table_info(forms)").all();
        if (columns.find(c => c.name === 'tenant_id')) {
            console.log('⚠️  Mantendo compatibilidade: Renomeando coluna "tenant_id" para "parceiro_id" em forms...');
            db.exec('ALTER TABLE forms RENAME COLUMN tenant_id TO parceiro_id');
        }
    }

    // 3. Mini-migration: Se a tabela 'leads' existir mas ainda tiver 'tenant_slug' ou 'tenant_id'
    const tableLeads = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='leads'").get();
    if (tableLeads) {
        const columns = db.prepare("PRAGMA table_info(leads)").all();
        if (columns.find(c => c.name === 'tenant_slug')) {
            console.log('⚠️  Mantendo compatibilidade: Renomeando coluna "tenant_slug" para "parceiro_slug" em leads...');
            db.exec('ALTER TABLE leads RENAME COLUMN tenant_slug TO parceiro_slug');
        }
        if (columns.find(c => c.name === 'tenant_id')) {
            console.log('⚠️  Mantendo compatibilidade: Renomeando coluna "tenant_id" para "parceiro_id" em leads...');
            db.exec('ALTER TABLE leads RENAME COLUMN tenant_id TO parceiro_id');
        }
    }

    console.log('🔄 Criando/Atualizando tabelas e índices...');
    db.exec(schemaSql);

    console.log('✅ Schema aplicado com sucesso!');
    console.log(`📂 Arquivo: ${process.env.DB_FILE || '2chat_dev.db'}`);
} catch (error) {
    console.error('❌ Erro ao configurar banco:', error.message);
    process.exit(1);
}
