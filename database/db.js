// database/db.js — singleton better-sqlite3
// Padrão Corpo Digital (ref: brindaria/database/db.js)
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', process.env.DB_FILE);

const db = new Database(dbPath, {
    // Loga queries apenas em dev (útil para debug de consultas)
    verbose: process.env.NODE_ENV !== 'production' ? console.log : null,
});

// WAL mode: melhor concorrência em leitura (múltiplas conexões simultâneas)
db.pragma('journal_mode = WAL');

// Garante integridade referencial nas foreign keys
db.pragma('foreign_keys = ON');

console.log(`📦 Banco de dados conectado: ${dbPath}`);

module.exports = db;
