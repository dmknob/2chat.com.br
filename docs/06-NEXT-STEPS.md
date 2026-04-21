# Próximos Passos (Next Steps) - 2chat.com.br

Este documento sumariza a direção técnica e de negócio estipuladas para a fase atual do projeto (**Beta Operacional**).

## 1. Monitoramento & Resiliência
- **[Concluído]** Roteamento distribuído via Cloudflare Workers ativado.
- **[Concluído]** Correção de Buffer no Worker e sistema de Drenagem (Drain) automático: o servidor backend consulta o buffer de edge de forma autônoma a cada 5 minutos (`server.js`).
- **[A Fazer]** Garantir rotina de backup (dump SQLite) contínua e exportação dos dados.

## 2. Comercial & SaaS (Painel de Administração)
O `2chat` caminha para uma oferta de SaaS estruturada. Atualmente administramos via o utilitário `add-tenant.js`.
- **Fase 2.1:** Dashboard Pessoal / Admin:
  - Rotas `/admin/login` e `/admin/hub`.
  - Visualização de painel com Tabela de Leads recebidos (consumindo os dados gerados pelo `drain-kv.js` ou localmente).
  - Listagem dos Tenants Ativos.
- **Fase 2.2:** Criação visual de Tenants.
  - Tela iterativa para configurar o "nome", o "slug" (ex: "perito-forense"), número de "whatsapp".
  - Campo gerador de form field types e custom tags para preencher o Worker JSON sem tocar em código.

## 4. Integrações
- Opção para disparar um webhook para o parceiro que usar um software CRM próprio (ex: RD Station, Pipiedrive), quando nós capturamos o Lead pelo nosso formulário Edge.

---
_Gerado e mantido pelo framework Corpo Digital._
