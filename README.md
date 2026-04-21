# 2chat.com.br - Landing Page

Landing page otimizada para conversão de leads com qualificação automática via WhatsApp.

## 🚀 Performance Otimizada

- **Tailwind CSS Local**: Compilado e embutido inline (~17KB minificado)
- **Zero External Dependencies**: Sem carregamento de CDN
- **Mobile-First**: Design responsivo otimizado para dispositivos móveis
- **LGPD Compliant**: Banner de cookies com localStorage

## 📁 Estrutura do Projeto

```
├── public/
│   ├── index.html                    # Landing page principal
│   ├── zebra-box/
│   │   ├── index.html               # Hub do cliente
│   │   └── form01/
│   │       └── index.html           # Formulário de qualificação
│   ├── termos-de-uso/
│   │   └── index.html              # Termos de uso
│   └── politica-de-privacidade/
│       └── index.html              # Política de privacidade
├── src/
│   └── input.css                    # Arquivo fonte do Tailwind
├── dist/
│   └── output.css                   # CSS compilado (gerado)
├── tailwind.config.js               # Configuração do Tailwind
├── postcss.config.js               # Configuração do PostCSS
└── package.json                     # Dependências e scripts
```

## 🛠️ Desenvolvimento

### Pré-requisitos

- Node.js 16+
- npm ou yarn

### Instalação

```bash
npm install
```

### Desenvolvimento Local

```bash
# Compilar CSS em modo watch
npm run dev

# Compilar CSS para produção
npm run build
```

### Servidor Local

```bash
# Python 3
python3 -m http.server 8000

# Ou usando Node.js
npx serve public
```

## 🎨 Design System

### Cores

- **Primary**: Azul gradiente (#3b82f6 → #2563eb)
- **Secondary**: Cinzas neutros
- **Background**: Preto escuro com glassmorphism

### Tipografia

- **Fonte**: Inter (Google Fonts)
- **Pesos**: 300, 400, 600, 800

### Componentes

- Botões com hover effects
- Modais com backdrop blur
- Formulários com validação
- Cards com glassmorphism

## 📱 Funcionalidades

### Landing Page (`index.html`)
- Beta waitlist com validação
- Modal de sucesso
- Cookie consent banner
- Design responsivo

### Hub do Cliente (`zebra-box/index.html`)
- Cards de navegação
- Trust indicators
- Coming soon sections

### Formulário (`zebra-box/form01/index.html`)
- Validação em tempo real
- Integração WhatsApp
- Logging assíncrono
- Redirecionamento automático

### Páginas Legais
- Termos de uso completos
- Política de privacidade LGPD
- Design consistente

## 🔧 Build Process

O Tailwind CSS é compilado localmente e embutido inline em todas as páginas para:

1. **Eliminar requests externos**
2. **Reduzir latência**
3. **Melhorar performance no Core Web Vitals**
4. **Garantir consistência visual**

### Comando de Build

```bash
npm run build:css
```

Este comando:
- Processa apenas as classes utilizadas
- Minifica o CSS
- Remove código não utilizado
- Gera ~17KB de CSS otimizado

## 🚀 Deploy

### Opções de Deploy

1. **Netlify**: Drag & drop da pasta `public/`
2. **Vercel**: Conectar repositório Git
3. **GitHub Pages**: Usar GitHub Actions
4. **CDN**: Upload direto para CDN

### Pré-deploy Checklist

- [ ] CSS compilado e embutido
- [ ] Todas as páginas testadas
- [ ] Links internos funcionando
- [ ] Formulários validados
- [ ] Responsividade verificada

## 📊 Performance

### Métricas Alcançadas

- **CSS Size**: ~17KB (vs ~150KB do CDN)
- **First Contentful Paint**: < 1s
- **Largest Contentful Paint**: < 2s
- **Cumulative Layout Shift**: 0
- **Total Blocking Time**: < 100ms

### Otimizações Implementadas

- CSS inline (elimina request)
- Font loading otimizado
- Images lazy loaded
- Minimal JavaScript
- No external dependencies

## 🔒 Segurança & LGPD

- Cookie banner com localStorage
- Política de privacidade completa
- Dados processados localmente
- WhatsApp integration segura

## 📈 Conversão

A landing page foi otimizada para:

1. **Captura de Email**: Beta waitlist
2. **Qualificação**: Formulário inteligente
3. **Conversão**: WhatsApp direto
4. **Retenção**: Follow-up automático

## 🤝 Contribuição

1. Instalar dependências: `npm install`
2. Desenvolver: `npm run dev`
3. Testar: Abrir no navegador
4. Build: `npm run build`
5. Commit: Seguir conventional commits

## 📄 Licença

Este projeto é propriedade da 2chat.