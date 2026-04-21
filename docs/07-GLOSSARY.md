# Glossário e Nomenclaturas Oficiais (2chat.com.br)

Para mantermos a coesão do código e das discussões enquanto o software cresce, estas são as nomenclaturas oficiais do ecossistema **2chat**.

| Termo | Significado de Negócio | Onde é usado no código |
| --- | --- | --- |
| **Parceiro** | A empresa ou agência cliente B2B que assina o 2chat. Cada Parceiro possui um `slug` único e representa a raiz de faturamento e configuração (Ex: Zebra Box). | Tabela `parceiros`, `parceiro_slug`, `/admin/parceiros/new` |
| **Formulário (Form)** | A porta de entrada do funil de conversão atrelada a um Parceiro. Determina *quais perguntas* serão feitas e *qual será a mensagem* final enviada pelo WhatsApp. Um Parceiro pode ter vários Forms (Ex: "Orcamento Geral" e "Contato Rápido"). | Tabela `forms`, `form_slug`, *Schema JSON* |
| **Lead (Contato)** | O usuário final, prospécto do Parceiro, que preenche os dados no formulário na rede de Edge (CF Workers). | Tabela `leads`, `LEADS_KV` |
| **Edge Buffer (KV)** | A rede distribuída de servidores da Cloudflare que armazena temporalmente e de forma ultrarrápida os dados do Formulário para tolerância a falhas. | `worker.js`, `LEADS_KV` |
| **Push / Sync** | O ato de ler a configuração do SQLite e escrever essas regras na Cloudflare (fazendo o Edge saber como o formulário deve ser desenhado). | `kvSync.js`, `publishParceiroToKV` |
| **Drain (Drenagem)** | O ato autônomo do servidor SQLite pescar os Leads perdidos que ficaram no *Edge Buffer* pra dentro do painel do Admin e esvaziá-los de lá. | `leadDrainer.js`, `kv:drain` |

## Boas Práticas Adotadas
- Nunca chamamos um "Parceiro" de "Cliente" (para não confundir com o cliente final B2B2C).
- O Código e a Interface Visual refletem o termo `Parceiro`.
