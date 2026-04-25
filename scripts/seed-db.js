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
                id: 'nome',
                label: 'Qual é o seu nome?',
                type: 'text',
                required: true,
            },
            {
                id: 'whatsapp',
                label: 'Seu WhatsApp (com DDD)',
                type: 'tel',
                required: true,
            },
            {
                id: 'cidade',
                label: 'Para qual cidade é a entrega?',
                type: 'text',
                placeholder: 'Ex: Porto Alegre',
                required: true,
            },
            {
                id: 'finalidade',
                label: 'Qual a finalidade principal?',
                type: 'select',
                options: ['Uso em Obra', 'Armazenagem de Estoque', 'Outra Finalidade'],
                required: true,
            },
            {
                id: 'prazo',
                label: 'Por quanto tempo precisa?',
                type: 'select',
                options: ['1 a 2 meses', '3 a 6 meses', 'Mais de 6 meses', 'Indefinido'],
                required: true,
            }
        ]),
        'Olá! Vim pelo 2chat e gostaria de solicitar um orçamento de locação de container. 🏗️\n\n*Nome:* {{nome}}\n📍 *Local da entrega:* {{cidade}}\n⏳ *Tempo estimado:* {{prazo}}\n🎯 *Finalidade:* {{finalidade}}\n\nPoderiam me passar as opções e valores?'
    );

    // -------------------------------------------------------------------------
    // 2. Insere Violínha
    // -------------------------------------------------------------------------
    db.prepare(`
        INSERT OR IGNORE INTO parceiros (slug, name, whatsapp, plan)
        VALUES (?, ?, ?, ?)
    `).run('violinha', 'Violinha', '5551999966609', 'free');

    const parceiroV = db.prepare(`SELECT id FROM parceiros WHERE slug = ?`).get('violinha');

    db.prepare(`
        INSERT OR IGNORE INTO forms
            (parceiro_id, slug, title, description, fields_json, message_template)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        parceiroV.id,
        'reserva',
        'Faça sua Reserva',
        'Basta nos dizer o que você quer e quando deseja retirar. Nossa equipe prepara tudo e confirma direto no seu WhatsApp!',
        JSON.stringify([
            {
                id: 'nome',
                label: 'Qual o seu nome?',
                type: 'text',
                required: true
            },
            {
                id: 'whatsapp',
                label: 'Seu número de WhatsApp',
                type: 'tel',
                placeholder: '(51) 99999-9999',
                required: true
            },
            {
                id: 'retirada',
                label: 'Que dia e horário você pretende retirar na peixaria?',
                type: 'datetime-local',
                required: true
            },
            {
                id: 'pedido',
                label: 'O que você deseja encomendar?',
                type: 'textarea',
                placeholder: 'Ex: Quero 1kg de violinha empanada e 1 vinho tinto',
                required: true
            }
        ]),
        'Olá, equipe Violinha! 🐟\nGostaria de solicitar uma encomenda para retirada na loja.\n\n*Nome:* {{nome}}\n*Agendamento para:* {{retirada}}\n\n*Meu Pedido:*\n{{pedido}}\n\nPodem me confirmar os valores e a disponibilidade?'
    );

    return {
        zebraBox: db.prepare(`SELECT id FROM parceiros WHERE slug = ?`).get('zebra-box'),
        violinha: parceiroV
    };
});

try {
    const result = run();
    console.log(`\n🎉 Seed Finalizado com Sucesso!`);
    console.log(`✅ Zebra Box — ID: ${result.zebraBox.id} | Form: /zebra-box/container`);
    console.log(`✅ Violínha — ID: ${result.violinha.id} | Form: /violinha/reserva`);
} catch (err) {
    console.error('❌ Seed falhou:', err.message);
    process.exit(1);
}
