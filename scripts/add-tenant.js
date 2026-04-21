#!/usr/bin/env node
require('dotenv').config();
const db = require('../database/db');

// CONFIGURAÇÃO DO NOVO TENANT — EDITE AQUI
const newTenant = {
    slug: 'perito-forense',
    name: 'Perito Forense',
    whatsapp: '5551988887777', // Formato DDI+DDD+Numero
    forms: [
        {
            slug: 'contato',
            title: 'Fale com um Perito',
            description: 'Preencha os dados para iniciar seu atendimento pericial.',
            fields: [
                { id: 'nome', label: 'Seu Nome', type: 'text', placeholder: 'Nome Completo', required: true },
                { id: 'assunto', label: 'Tipo de Perícia', type: 'select', options: ['Grafotécnica', 'Digital', 'Imobiliária', 'Outro'], required: true }
            ],
            message_template: 'Olá! Vim pelo 2chat. Desejo atendimento para perícia {{assunto}}. Meu nome é {{nome}}.'
        }
    ]
};

async function run() {
    try {
        console.log(`🌱 Adicionando tenant: ${newTenant.name}...`);

        db.transaction(() => {
            // 1. Inserir Tenant
            const tenantStmt = db.prepare(`
                INSERT OR IGNORE INTO tenants (slug, name, whatsapp, plan)
                VALUES (?, ?, ?, 'free')
            `);
            tenantStmt.run(newTenant.slug, newTenant.name, newTenant.whatsapp);

            const tenant = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(newTenant.slug);

            // 2. Inserir Formulários
            const formStmt = db.prepare(`
                INSERT OR IGNORE INTO forms
                (tenant_id, slug, title, description, fields_json, message_template)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            for (const form of newTenant.forms) {
                formStmt.run(
                    tenant.id,
                    form.slug,
                    form.title,
                    form.description,
                    JSON.stringify(form.fields),
                    form.message_template
                );
            }
        })();

        console.log(`✅ Tenant '${newTenant.slug}' adicionado ao banco.`);
        console.log(`👉 Agora rode: npm run kv:sync ${newTenant.slug}`);

    } catch (err) {
        console.error('❌ Erro ao adicionar:', err.message);
    } finally {
        process.exit();
    }
}

run();
