// src/controllers/publicController.js
// Renderiza as páginas institucionais do 2chat via EJS

exports.getHome = (req, res) => {
    res.render('pages/home', {
        title:       '2chat | Qualifique leads em tempo real',
        description: 'A inteligência entre o seu link e a sua conversa. Qualifique leads automaticamente e converta mais no WhatsApp com formulários inteligentes.',
        ogTitle:     '2chat | Qualificação de Leads',
        ogDesc:      'Qualifique leads em tempo real com inteligência de dados. Automatize a triagem e converta mais no WhatsApp.',
        canonical:   '/',
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
