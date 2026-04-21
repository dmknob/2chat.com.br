# 04. Setup Cloudflare Workers — 2chat.com.br

> **Objetivo:** Colocar o Worker v0 (Zebra Box hardcoded) em produção.
> **Pré-requisito de tempo:** ~30 minutos.

---

## Passo 0 — Verificar se 2chat.com.br está na Cloudflare

Acesse [dash.cloudflare.com](https://dash.cloudflare.com) e veja se `2chat.com.br` aparece na lista de domínios.

### Está listado?

**Sim → Pule para o Passo 1.**

**Não → Adicionar domínio:**
1. No painel Cloudflare, clique em **"Add a site"**
2. Digite `2chat.com.br` e clique em **Continue**
3. Escolha o plano **Free** → Continue
4. A Cloudflare vai escanear seus DNS atuais. Confirme os registros (especialmente o `A` apontando para o IP do VPS)
5. Cloudflare vai te dar 2 nameservers (ex: `dave.ns.cloudflare.com`)
6. Vá ao seu registrador (registro.br, GoDaddy, etc.) e substitua os nameservers pelos da Cloudflare
7. Aguarde propagação: geralmente 5–30 minutos. Verificar em [whatsmydns.net](https://www.whatsmydns.net)

> ⚠️ **Importante:** O registro `A` do VPS deve estar com o ícone de **nuvem laranja** (proxied), não cinza. Se estiver cinza, clique nele e mude para "Proxied".

---

## Passo 1 — Instalar o Wrangler CLI

O Wrangler é a ferramenta de linha de comando da Cloudflare para Workers.

```bash
npm install -g wrangler
```

Verificar instalação:
```bash
wrangler --version
# Deve retornar: ⛅️ wrangler 3.x.x
```

---

## Passo 2 — Autenticar o Wrangler na sua conta Cloudflare

```bash
wrangler login
```

Isso vai abrir o navegador pedindo autorização. Clique em **"Allow"**. Pronto — suas credenciais ficam salvas localmente.

Verificar autenticação:
```bash
wrangler whoami
# Deve mostrar seu email e Account ID
```

> Anote o **Account ID** — você vai precisar dele no `wrangler.toml`.

---

## Passo 3 — Criar o KV Namespace para buffer de leads

O KV (Key-Value store) é o banco de dados de borda da Cloudflare. Ele vai guardar leads temporariamente se o VPS estiver offline.

```bash
# Criar namespace de produção
wrangler kv namespace create "2CHAT_LEADS_KV"
```

A saída vai ser algo assim:
```
✅ Successfully created namespace!
  Add the following to your wrangler.toml:

  [[kv_namespaces]]
  binding = "LEADS_KV"
  id = "abc123def456..."   ← Copie este ID!
```

**Copie o `id` retornado** e substitua no `worker/wrangler.toml` onde está `COLE_O_ID_AQUI`.

Opcional — criar namespace de preview para testes locais:
```bash
wrangler kv:namespace create "2CHAT_LEADS_KV" --preview
# Anote o preview_id também
```

---

## Passo 4 — Verificar o `wrangler.toml`

Abra `worker/wrangler.toml` e confirme:
- `account_id` → seu Account ID (do `wrangler whoami`)
- `id` do `LEADS_KV` → o id gerado no Passo 3
- `zone_name` → `2chat.com.br`

---

## Passo 5 — Testar localmente antes do deploy

Entre na pasta do worker:
```bash
cd worker
```

Rodar em modo local:
```bash
wrangler dev
```

Isso vai iniciar um servidor local em `http://localhost:8787`. Teste:
- `http://localhost:8787/zebra-box` → deve mostrar o hub
- `http://localhost:8787/zebra-box/form01` → deve mostrar o formulário
- `http://localhost:8787/` → deve passar para o VPS (ou dar erro se VPS não estiver acessível localmente — ok para teste)

> Durante `wrangler dev`, o KV é simulado localmente. Submits do formulário vão para o KV local e o redirect para WhatsApp vai funcionar.

---

## Passo 6 — Deploy em produção

```bash
wrangler deploy
```

Saída esperada:
```
Uploaded 2chat-worker (1.23 sec)
Published 2chat-worker (0.45 sec)
  https://2chat-worker.SEU_SUBDOMINIO.workers.dev
  2chat.com.br/*
```

---

## Passo 7 — Verificar no painel Cloudflare

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**
2. Clique no worker `2chat-worker`
3. Aba **Triggers** → confirme que a rota `2chat.com.br/*` está listada

---

## Passo 8 — Testar em produção

```
https://2chat.com.br/zebra-box
→ Deve mostrar o hub da Zebra Box

https://2chat.com.br/zebra-box/form01
→ Deve mostrar o formulário

Preencha e clique "Enviar para WhatsApp"
→ Deve redirecionar para wa.me/5551993668728 com a mensagem montada
```

---

## Comandos Úteis do Dia a Dia

```bash
# Ver logs em tempo real (requests e erros)
wrangler tail

# Inspecionar o buffer de leads no KV
wrangler kv:key list --namespace-id=SEU_LEADS_KV_ID --prefix=lead:

# Ler um lead específico do buffer
wrangler kv:key get --namespace-id=SEU_LEADS_KV_ID "lead:1713654321000:abc1234"

# Deletar uma chave do KV (após migrar para SQLite manualmente)
wrangler kv:key delete --namespace-id=SEU_LEADS_KV_ID "lead:1713654321000:abc1234"

# Rederploar após mudanças no worker.js
wrangler deploy
```

---

## Troubleshooting

### "Route already in use"
Significa que outra Worker ou Page Rule está usando `2chat.com.br/*`. Vá em Cloudflare → Workers → Triggers e remova conflitos.

### Landing page `/` parando de funcionar
O Worker está passando corretamente para o VPS os requests de `/`. Verifique:
1. O registro DNS do VPS está com o ícone laranja (proxied) no Cloudflare
2. O Nginx no VPS está rodando: `sudo systemctl status nginx`

### Formulário submete mas não redireciona para WhatsApp
Verifique se o WhatsApp `5551993668728` está correto:
```
https://wa.me/5551993668728
```
Se abrir o WhatsApp com esse contato, está correto.

### Ver o que está no KV buffer
```bash
wrangler kv:key list --namespace-id=SEU_ID --prefix=lead:
```
Se aparecerem entradas, significa que o VPS não está acessível. Isso é esperado no v0 enquanto o `/api/leads` não estiver implementado.
