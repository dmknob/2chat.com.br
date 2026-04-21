# 02. Design & UX Guidelines - 2chat.com.br

> **Objetivo:** Diretrizes de design visual, acessibilidade, responsividade e padrões de componentes para todas as páginas do 2chat.com.br.

---

## 1. Identidade Visual

### 1.1 Paleta de Cores
```
Primary:
  - 2chat Blue: #0066FF (CTA buttons, highlights)
  - Dark BG: #0a0a0a (body background)
  - Gray-900: #111111 (containers, cards)
  - Gray-800: #1f1f1f (borders, dividers)
  - White: #ffffff (text, highlights)
  - Gray-400: #a0a0a0 (secondary text)
  - Gray-200: #e5e5e5 (light text)

Accent:
  - Success Green: #10b981 (feedback positivo)
  - Error Red: #ef4444 (feedback negativo)
```

### 1.2 Typography
```
Font Family: Inter (400, 600, 800)

Headings:
  - h1: 32px / 40px (md: 40px / 48px) - Bold (800)
  - h2: 24px / 32px (md: 32px / 40px) - Semi-bold (600)
  - h3: 20px / 28px (md: 24px / 32px) - Semi-bold (600)

Body:
  - p:  14px / 20px (md: 16px / 24px) - Regular (400)
  - small: 12px / 16px - Regular (400)

Links:
  - text-decoration: underline
  - color: #0066FF (blue)
  - hover: opacity-80
```

### 1.3 Logo e Branding
```
Logo: "2chat."
  - Logotype: "2chat" + blue dot (.)
  - Tamanho mínimo: 32px altura
  - Espaçamento mínimo: 16px ao redor

Dark Mode (Padrão):
  - Text: #ffffff
  - Dot: #0066FF
```

---

## 2. Design Responsivo (Mobile-First)

### 2.1 Breakpoints
```
Base (Mobile):  0px - 639px   (375px iPhone SE2)
sm:             640px - 767px  (Tablets horizontais)
md:             768px - 1023px (Tablets)
lg:             1024px+        (Desktops)
```

### 2.2 Layout Padrão
```
Mobile (base):
  - max-width: 100%
  - padding: 16px (px-4)
  - container: max-w-sm (384px)

md+:
  - container: max-w-md (448px)
  - padding: 24px (px-6)
```

### 2.3 Touch Targets
```
Mínimo: 44x44px (Apple/Google recommendation)

Buttons:
  - Mobile: py-3 px-4 (48px height)
  - Inputs: py-3 px-4 (48px height)
  - Espaçamento entre elementos clicáveis: 8px mínimo
```

### 2.4 Exemplos de Responsive
```html
<!-- Heading responsivo -->
<h1 class="text-2xl md:text-4xl font-extrabold">

<!-- Button full-width mobile -->
<button class="w-full md:w-auto px-6 py-3">

<!-- Container fluido -->
<div class="max-w-sm md:max-w-md mx-auto px-4 md:px-6">
```

---

## 3. Componentes Reutilizáveis

### 3.1 Button (CTA Principal)
```html
<button class="w-full bg-white text-black font-bold py-3 px-4 rounded-xl 
              hover:bg-blue-500 hover:text-white transition-all duration-300
              md:w-auto focus:outline-none focus:ring-2 focus:ring-blue-500">
  Enviar para WhatsApp
</button>

<!-- Estados -->
.disabled { opacity-50; pointer-events: none; }
.loading::after { content: "..."; animation: pulse; }
```

### 3.2 Input / Textarea
```html
<input type="text" placeholder="Qual a sua cidade?"
       class="w-full bg-gray-950 border border-gray-700 text-white p-3 rounded-lg
              focus:outline-none focus:border-blue-500 transition-all
              placeholder-gray-500" />
```

### 3.3 Select Dropdown
```html
<select class="w-full bg-gray-950 border border-gray-700 text-white p-3 rounded-lg
              focus:outline-none focus:border-blue-500 transition-all">
  <option value="">Selecione...</option>
  <option value="curto">Curto</option>
  <option value="longo">Longo</option>
</select>
```

### 3.4 Card
```html
<div class="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg">
  <h2 class="text-lg font-semibold text-white mb-2">Título</h2>
  <p class="text-sm text-gray-400">Descrição</p>
</div>
```

### 3.5 Modal
```html
<div id="modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center
                       z-50 hidden">
  <div class="bg-gray-900 border border-gray-800 p-8 rounded-2xl max-w-sm mx-4 text-center">
    <h2 class="text-xl font-semibold text-white mb-4">Redirecionando...</h2>
    <p class="text-gray-400 mb-6">Aguarde, estamos abrindo o WhatsApp.</p>
    <div class="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
  </div>
</div>
```

### 3.6 Banner GTAG4
```html
<div id="cookieBanner" class="fixed bottom-0 left-0 right-0 bg-black bg-opacity-80 
                              backdrop-blur-md border-t border-gray-700 p-4 z-40 hidden">
  <div class="max-w-md mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
    <p class="text-sm text-gray-300">
      Este site utiliza cookies analíticos para melhorar sua experiência. 
      Leia nossa <a href="/politica-de-privacidade" class="text-blue-500 underline">Política de Privacidade</a>.
    </p>
    <div class="flex gap-2 w-full md:w-auto">
      <button id="cookieReject" class="flex-1 md:flex-none px-4 py-2 bg-gray-800 text-white rounded-lg
                                       hover:bg-gray-700 transition-all">
        Recusar
      </button>
      <button id="cookieAccept" class="flex-1 md:flex-none px-4 py-2 bg-blue-500 text-white rounded-lg
                                       hover:bg-blue-600 transition-all">
        Aceitar
      </button>
    </div>
  </div>
</div>
```

---

## 4. Acessibilidade (WCAG AA)

### 4.1 Contraste
```
✅ Texto normal (< 18px): 4.5:1 mínimo
   white (#fff) + dark gray (#0a0a0a) = ~21:1 ✓
   
✅ Texto grande (≥ 18px bold): 3:1 mínimo
   
✅ Links: blue (#0066FF) + white (#fff) = ~8:1 ✓
```

### 4.2 Labels e ARIA
```html
<!-- ❌ Ruim -->
<input type="email" placeholder="Email">

<!-- ✅ Bom -->
<label for="email" class="block text-sm font-medium text-white mb-2">
  Seu melhor e-mail
</label>
<input id="email" type="email" placeholder="exemplo@mail.com" required>

<!-- ✅ Bom com ARIA -->
<div role="alert" aria-live="polite" class="text-green-500">
  Obrigado! Redirecionando...
</div>
```

### 4.3 Focus States
```css
/* Todos os elementos interativos devem ter focus visível */
button:focus,
input:focus,
select:focus,
a:focus {
  outline: 2px solid #0066FF;
  outline-offset: 2px;
}
```

### 4.4 Alt Text e Semântica
```html
<!-- Logo com alt -->
<h1 class="text-2xl font-bold">
  <span aria-label="2chat, qualificação de leads para WhatsApp">2chat.</span>
</h1>

<!-- Estrutura semântica -->
<header>...</header>
<main>...</main>
<footer>...</footer>
```

---

## 5. Performance e Otimizações

### 5.1 CSS
```
- Usar Tailwind CSS (build local antes do deploy, otimização máxima)
- Evitar inline styles complexos
- Prefixar animations com @supports para fallback
```

### 5.2 JavaScript
```
- Vanilla JS apenas (sem jQuery, framework externo para MVP)
- Defer scripts: <script defer src="...">
- Lazy load images se necessário (futuro)
- Comprimir antes de deploy
```

### 5.3 Imagens
```
- WebP com fallback PNG
- Resoluções: 1x e 2x (mobile-first)
- Max-width: 100% sempre
- aspect-ratio para evitar CLS (Cumulative Layout Shift)
```

### 5.4 SEO Meta Tags
```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Qualifique leads em tempo real...">
<meta property="og:title" content="2chat | Qualificação de Leads">
<meta property="og:description" content="...">
<meta property="og:image" content="https://2chat.com.br/og-image.png">
```

---

## 6. Padrões de Página

### 6.1 Landing Page (`/`)
```
Layout:
  ├─ Header (logo + nav)
  ├─ Hero Section
  │  ├─ h1: "2chat."
  │  └─ p: "A inteligência entre..."
  ├─ Value Proposition Card
  │  ├─ h2: "Qualifique leads..."
  │  └─ Bullets dos benefícios
  ├─ Waitlist Form
  │  ├─ Email input
  │  ├─ Honeypot
  │  └─ CTA button
  ├─ Footer (links + copyright)
  └─ Cookie Banner (bottom)

Max Width: 384px (sm: 448px, md: 512px)
Padding: 16px (md: 24px)
Spacing: 32px entre seções (md: 48px)
```

### 6.2 Hub do Tenant `/{slug}`
```
Layout:
  ├─ Header (logo)
  ├─ Nome do negócio (h1)
  ├─ Lista de formulários (cards clicáveis)
  │  └─ Card: título + descrição + seta →
  └─ Footer ("Powered by 2chat.")

Propósito: Fallback para link genérico.
Link principal sempre aponta para o form direto.

Regra: sem bio, sem redes sociais, sem links externos.
Grid Columns: 1 (mobile), 2 (md+)
Gap: 16px
```

### 6.3 Formulário `/{slug}/{form-id}`
```
Layout:
  ├─ Header (logo)
  ├─ Form Section
  │  ├─ Title: "Solicite um Container"
  │  ├─ Description
  │  ├─ Field: Cidade (text)
  │  ├─ Field: Período (select)
  │  ├─ Field: Finalidade (select)
  │  ├─ Honeypot (hidden)
  │  └─ CTA: "Enviar para WhatsApp" (full-width)
  ├─ Mensagem de erro inline (p#msg, hidden por padrão)
  ├─ Modal "Redirecionando..." (overlay)
  └─ Cookie Banner

Nota: campo de email REMOVIDO dos formulários operacionais.
Email é coletado apenas na landing page (waitlist 2chat).

Form Height: ~420px (mobile, expansível)
Field Spacing: 16px
CTA Button: Full-width
```

### 6.4 Políticas (Termos + Privacidade)
```
Layout:
  ├─ Header
  ├─ Content
  │  ├─ h1: Título
  │  ├─ Última atualização
  │  ├─ Seções (h2)
  │  ├─ Parágrafos (p)
  │  └─ Listas (ul/ol)
  └─ Footer

Max Width: 384px (md: 640px)
Line Height: 1.6 (melhor legibilidade)
Sem cookie banner (não necessário nesta página)
```

---

## 7. Estados e Feedbacks

### 7.1 Validação de Campos
```javascript
// Email (sem validação rigorosa, apenas @ presence)
const email = field.value;
if (!email.includes('@')) {
  field.classList.add('border-red-500');
  showError('Email inválido');
}

// Campos obrigatórios
if (!field.value.trim()) {
  showError('Campo obrigatório');
}
```

### 7.2 Estados do Botão
```
Default:     white bg, black text, cursor-pointer
Hover:       blue bg, white text
Active:      darker blue
Disabled:    opacity-50, pointer-events-none
Loading:     spinning animation, disabled
```

### 7.3 Mensagens de Feedback
```
Success:  Green (#10b981), ✓ icon, "Obrigado! Redirecionando..."
Error:    Red (#ef4444), ✗ icon, "Erro ao enviar. Tente novamente."
Info:     Blue (#0066FF), ℹ icon, "Mensagem informativa"
Loading:  Spinner + "Aguarde..."
```

---

## 8. Dark Mode (Padrão)

Todas as páginas usam dark mode:
- Background: #0a0a0a
- Cards: #111111 / #1f1f1f
- Text: #ffffff / #e5e5e5
- Borders: #333333 / #555555

Considerar suporte a `prefers-color-scheme: light` no futuro.

---

## 9. Checklist de Qualidade

### Antes de Deploy

- [ ] Responsivo (375px, 768px, 1024px testados)
- [ ] Contraste WCAG AA (4.5:1 texto normal, 3:1 grande)
- [ ] Touch targets 44x44px mínimo
- [ ] Focus states visíveis em todos os inputs
- [ ] Honeypot escondido (display: none)
- [ ] Modal overlay com z-index (50+)
- [ ] Cookie banner respeita localStorage
- [ ] Links para /termos-de-uso e /politica-de-privacidade funcionam
- [ ] Meta tags presentes e corretas
- [ ] Images otimizadas (<100KB por imagem)
- [ ] Console sem erros (DevTools)
- [ ] Lighthouse score > 85 (Performance)

---

## 10. Exemplo de Estrutura HTML Base

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>2chat | Qualificação de Leads</title>
    <meta name="description" content="Qualifique leads em tempo real...">
    <meta property="og:title" content="2chat">
    <meta property="og:description" content="...">
    <meta property="og:image" content="/og-image.png">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        body { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body class="bg-[#0a0a0a] text-gray-200 min-h-screen flex flex-col">
    
    <header class="border-b border-gray-800 py-4 px-4">
        <div class="max-w-md mx-auto">
            <h1 class="text-2xl font-bold text-white">2chat<span class="text-blue-500">.</span></h1>
        </div>
    </header>

    <main class="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <!-- Conteúdo aqui -->
    </main>

    <footer class="border-t border-gray-800 py-4 px-4 text-center text-sm text-gray-500">
        <div class="max-w-md mx-auto">
            <p>&copy; 2026 2chat. Todos os direitos reservados.</p>
        </div>
    </footer>

    <!-- Cookie Banner -->
    <div id="cookieBanner" class="fixed bottom-0 left-0 right-0 bg-black bg-opacity-80 
                                  backdrop-blur-md border-t border-gray-700 p-4 z-40 hidden">
        <!-- Conteúdo do banner aqui -->
    </div>

    <script defer src="/js/main.js"></script>
</body>
</html>
```
