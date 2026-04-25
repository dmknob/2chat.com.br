# Documentação: Schema JSON dos Formulários (2chat)

O núcleo da captura dinâmica do 2chat acontece dentro da Cloudflare (Worker), que lê um Schema JSON definido no painel Admin e o transforma em HTML otimizado de altíssima conversão.

## 1. Estrutura Base do Campo

Todo formulário (`fields_json`) deve ser um Array de objetos JSON contendo os seguintes atributos primários:

```json
[
  {
    "id": "nome",
    "label": "Qual o seu nome?",
    "type": "text",
    "placeholder": "Seu nome completo",
    "required": true
  }
]
```

- **id**: Identificador único do campo. Será usado no `name` e `id` do HTML, e também como a variável na mensagem de template (ex: `{{nome}}`).
- **label**: Texto que aparece acima do input para o usuário.
- **type**: Tipo do campo. Suportados nativamente pelo worker: `text`, `tel`, `email`, `select`, `textarea`, `date`, `time`, `datetime-local`.
- **placeholder** *(opcional)*: Dica de preenchimento.
- **required** *(opcional)*: Booleano (`true` ou `false`).

## 2. Autocomplete e Precedência de Conversão Mobile

Para elevar a taxa de conversão em dispositivos móveis, o Worker do 2chat injeta automaticamente atributos `autocomplete` da W3C nos inputs gerados. Isso permite que o teclado do iPhone/Android sugira os dados do usuário com 1 toque.

### Ordem de Precedência (Como o Worker decide)

1. **Prioridade Máxima (Manual via JSON):**
   Se o objeto do campo contiver explicitamente a chave `"autocomplete": "valor"`, o Worker a obedecerá de forma absoluta, ignorando a inferência mágica.
   *Exemplo:*
   ```json
   {
     "id": "cargo",
     "label": "Qual o seu cargo?",
     "type": "text",
     "autocomplete": "organization-title"
   }
   ```

2. **Inferência Mágica Automática (Fallback):**
   Caso a chave `autocomplete` **não** seja declarada no JSON, o Worker analisará o `id` e o `type` do campo em busca de termos comuns, e injetará os atributos silenciosamente:
   - ID `nome` ou `name` ➔ `autocomplete="name"`
   - ID `whatsapp`, `telefone`, `phone` ou type `tel` ➔ `autocomplete="tel"` + forçará type="tel"
   - ID `email` ou type `email` ➔ `autocomplete="email"` + forçará type="email"
   - ID `cidade` ou `city` ➔ `autocomplete="address-level2"`

## 3. Lista Extensiva da W3C para uso Manual

Caso deseje especificar atributos complexos no seu JSON (usando a Prioridade Máxima descrita acima), consulte a lista de tags oficiais HTML5:

### Nomes e Contato
- `name`: Nome completo.
- `given-name`: Primeiro nome.
- `family-name`: Sobrenome.
- `email`: Endereço de e-mail.
- `tel`: Número de telefone completo (incluindo DDI e DDD).

### Dados B2B e Profissionais
- `organization`: Nome da empresa do usuário.
- `organization-title`: Cargo ou função na empresa (ex: CEO).

### Endereços Físicos
- `street-address`: Endereço de rua completo.
- `address-line1`: Apenas a primeira linha do endereço (ex: Rua das Flores, 123).
- `address-line2`: Complemento (apto, bloco).
- `address-level1`: Estado ou Província (ex: SP, RJ).
- `address-level2`: Cidade (ex: São Paulo, Porto Alegre).
- `address-level3`: Bairro.
- `postal-code`: CEP.
- `country`: País (código ou nome).

### Informações Demográficas
- `bday`: Data de nascimento completa (pode invocar date-picker no mobile).
- `bday-day`: Apenas o dia do nascimento.
- `bday-month`: Apenas o mês.
- `bday-year`: Apenas o ano.
- `sex`: Gênero biológico.

### E-commerce e Financeiro
- `cc-name`: Nome impresso no cartão de crédito.
- `cc-number`: Número do cartão (muitos mobiles oferecem escanear via câmera ao ver isso).
- `cc-exp`: Vencimento (MM/AA).
- `cc-csc`: Código de segurança (CVC).
- `transaction-currency`: Moeda.
- `transaction-amount`: Valor financeiro.

### Utilidades Web
- `url`: Site, homepage ou link de rede social do usuário.
- `username`: Nome de login / usuário em sistemas.
- `current-password`: Senha atual (para logins).
- `new-password`: Senha nova (para cadastros, muitas vezes invoca o gerador de senhas seguras do iOS/Google).
- `one-time-code`: Código OTP enviado via SMS (o iOS preenche o código de confirmação no input automaticamente se ver esta tag).

---
*Para ver como o construtor roda por debaixo dos panos, verifique o loop `renderForm()` dentro de `worker/worker.js`.*
