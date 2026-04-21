// scripts/seed-zebra-box.js
// Popula o banco com o parceiro Zebra Box (MVP v0)
// Uso: node scripts/seed-zebra-box.js
require('dotenv').config();
const db = require('../database/db');

console.log('🌱 Seed: Zebra Box...');

const run = db.transaction(() => {
    // Insere parceiro (ignora se já existir)
    const parceiroId = db.prepare(`
        INSERT OR IGNORE INTO parceiros (slug, name, whatsapp, plan)
        VALUES (?, ?, ?, ?)
    `).run('zebra-box', 'Zebra Box', '5551993668728', 'free').lastInsertRowid;

    // Se já existia, busca o id
    const parceiro = db.prepare(`SELECT id FROM parceiros WHERE slug = ?`).get('zebra-box');

    // Insere formulário form01 → slug "container"
    db.prepare(`
        INSERT OR IGNORE INTO forms
            (parceiro_id, slug, title, description, fields_json, message_template)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        parceiro.id,
        'container',  // slug semântico (URL: /zebra-box/container)
        'Solicite aluguel de um Container',
        'Responda 3 perguntas rápidas e fale com o especialista.',
        JSON.stringify([
            {
                id: 'location',
                label: 'Para qual cidade?',
                type: 'text',
                placeholder: 'Ex: Porto Alegre',
                required: true,
            },
            {
                id: 'period',
                label: 'Por quanto tempo?',
                type: 'select',
                options: ['1 mês', '2 meses', '3 meses', '4 meses', '6 meses', 'Mais de 6 meses'],
                required: true,
            },
            {
                id: 'purpose',
                label: 'Qual a finalidade?',
                type: 'select',
                options: ['Obra', 'Armazenagem', 'Outro'],
                required: true,
            },
        ]),
        'Olá! Vim pelo 2chat. Tenho interesse em container para {{purpose}} em {{location}} por {{period}}.',
    );

    return db.prepare(`SELECT id FROM parceiros WHERE slug = ?`).get('zebra-box');
});

try {
    const result = run();
    console.log(`✅ Zebra Box seed OK — parceiro_id: ${result.id}`);
    console.log('   └─ Formulário slug: "container" (rota: /zebra-box/container)');
} catch (err) {
    console.error('❌ Seed falhou:', err.message);
    process.exit(1);
}
