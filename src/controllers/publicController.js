// src/controllers/publicController.js
// Renderiza as páginas institucionais do 2chat via EJS

exports.getHome = (req, res) => {
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": "Como evitar curiosos no WhatsApp Business?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "A melhor forma é usar uma triagem inteligente via link na bio ou anúncio. O cliente clica, responde perguntas estruturadas e o 2chat direciona apenas quem for qualificado para o seu WhatsApp."
                }
            },
            {
                "@type": "Question",
                "name": "Como passar orçamentos rápidos pelo WhatsApp?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Ao invés de digitar textos longos, você pode automatizar a coleta das necessidades do cliente através de formulários dinâmicos. Quando a mensagem chegar no seu WhatsApp Business, todos os dados para o orçamento já estarão estruturados."
                }
            },
            {
                "@type": "Question",
                "name": "Como funciona o filtro de clientes no WhatsApp?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "O 2chat age como uma barreira de inteligência. Pessoas não engajadas desistem de preencher informações superficiais, garantindo que você gaste tempo apenas com clientes propensos à conversão."
                }
            }
        ]
    };

    const softwareSchema = {
        "@context":           "https://schema.org",
        "@type":              "SoftwareApplication",
        "name":               "2chat",
        "url":                "https://2chat.com.br",
        "applicationCategory":"BusinessApplication",
        "description":        "Filtre clientes curiosos e qualifique leads automaticamente antes deles chegarem no seu WhatsApp.",
        "operatingSystem":    "Web",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "BRL" }
    };

    res.render('pages/home', {
        title:       'Pare de perder tempo com curiosos no WhatsApp | 2chat',
        description: 'Chega de gastar 10 minutos com quem não vai comprar. Filtre, qualifique e atenda apenas clientes prontos para fechar negócio pelo WhatsApp.',
        ogTitle:     'Filtro Inteligente para WhatsApp | 2chat',
        ogDesc:      'Automatize a triagem de leads e nunca mais perca a paciência passando orçamentos para curiosos.',
        canonical:   '/',
        schemaJson:  JSON.stringify([softwareSchema, faqSchema]) 
    });
};

exports.getTermos = (req, res) => {
    res.render('pages/termos', {
        title:       'Termos de Uso | 2chat',
        description: 'Leia os termos de uso do serviço 2chat.com.br.',
        ogTitle:     'Termos de Uso | 2chat',
        ogDesc:      'Termos e condições de uso da plataforma 2chat.',
        canonical:   '/termos-de-uso',
    });
};

exports.getPrivacidade = (req, res) => {
    res.render('pages/privacidade', {
        title:       'Política de Privacidade | 2chat',
        description: 'Saiba como o 2chat coleta, utiliza e protege seus dados pessoais conforme a LGPD.',
        ogTitle:     'Política de Privacidade | 2chat',
        ogDesc:      'Política de privacidade e tratamento de dados da plataforma 2chat.',
        canonical:   '/politica-de-privacidade',
    });
};

/* =============================================================================
   HUB DE CONTEÚDO (ARTIGOS SEO)
============================================================================= */

exports.getArtigosHub = (req, res) => {
    res.render('pages/artigos/index', {
        title:       'Blog & Guias: Triagem e Vendas no WhatsApp | 2chat',
        description: 'Estratégias para parar de perder tempo com curiosos, qualificar leads e otimizar seu atendimento no WhatsApp Business.',
        ogTitle:     'Guias de Venda no WhatsApp | 2chat',
        ogDesc:      'Aumente a conversão sem aumentar o esforço. Guias práticos para pequenos negócios.',
        canonical:   '/artigos'
    });
};

exports.getArtigoSintomas = (req, res) => {
    res.render('pages/artigos/curiosos-whatsapp', {
        title:       'Como parar de perder tempo com curiosos no WhatsApp | 2chat',
        description: 'Descubra como estruturar filtros e formulários para evitar que clientes desalinhados monopolizem seu WhatsApp Business.',
        ogTitle:     'Curiosos no WhatsApp? Resolva de uma vez por todas',
        ogDesc:      'A tática ignorada pela maioria dos negócios locais para poupar horas de atendimento inútil no WhatsApp.',
        canonical:   '/artigos/como-evitar-curiosos-whatsapp'
    });
};

exports.getArtigoOrcamentos = (req, res) => {
    res.render('pages/artigos/orcamentos-whatsapp', {
        title:       'A armadilha de passar orçamentos pelo WhatsApp | 2chat',
        description: 'Por que o cliente pede preço e some? Veja como mudar sua estratégia de captura de leads e parar de dar orçamentos no escuro.',
        ogTitle:     'Por que os clientes pedem orçamento e somem?',
        ogDesc:      'A armadilha de passar preço pelo WhatsApp sem qualificar a urgência do lead antes.',
        canonical:   '/artigos/armadilha-orcamentos-whatsapp'
    });
};

/* =============================================================================
   SITEMAP.XML
============================================================================= */

exports.getSitemap = (req, res) => {
    // URL base da aplicação
    const baseUrl = 'https://2chat.com.br';

    // Lista estática de rotas públicas. Se no futuro houverem artigos dinâmicos no banco, 
    // basta fazer a query aqui e dar um .map() adicionando no array.
    const urls = [
        { url: '/', changefreq: 'weekly', priority: 1.0 },
        { url: '/artigos', changefreq: 'weekly', priority: 0.9 },
        { url: '/artigos/como-evitar-curiosos-whatsapp', changefreq: 'monthly', priority: 0.8 },
        { url: '/artigos/armadilha-orcamentos-whatsapp', changefreq: 'monthly', priority: 0.8 },
        { url: '/termos-de-uso', changefreq: 'yearly', priority: 0.3 },
        { url: '/politica-de-privacidade', changefreq: 'yearly', priority: 0.3 }
    ];

    let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    urls.forEach(item => {
        sitemap += '  <url>\n';
        sitemap += `    <loc>${baseUrl}${item.url}</loc>\n`;
        // Para uma aplicação real de maior escala, o ideal é pegar a data de modificação real (do DB ou fs.stat)
        // Aqui usamos a data atual simplificada para facilitar a indexação constante em MVP
        sitemap += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
        sitemap += `    <changefreq>${item.changefreq}</changefreq>\n`;
        sitemap += `    <priority>${item.priority}</priority>\n`;
        sitemap += '  </url>\n';
    });
    
    sitemap += '</urlset>';

    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
};

