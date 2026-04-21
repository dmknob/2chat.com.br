# Configuração Nginx de Produção (Integrada com SSL/Certbot)

Este arquivo reflete a configuração real para o VPS, unindo o SSL existente com o Proxy Reverso para o app Node.

```nginx
server {
    server_name 2chat.com.br www.2chat.com.br;

    # Logs seguindo o padrão da agência
    access_log /var/log/nginx/2chat.com.br.access.log;
    error_log /var/log/nginx/2chat.com.br.error.log;

    # Redirecionamento de WWW para Non-WWW (Opcional, mas recomendado para SEO)
    if ($host = www.2chat.com.br) {
        return 301 https://2chat.com.br$request_uri;
    }

    location / {
        proxy_pass http://127.0.0.1:3010; # Porta definida no ecosystem.config.js
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Otimizações para uploads e buffers
        proxy_buffers 8 16k;
        proxy_buffer_size 32k;
        client_max_body_size 10M;
    }

    # Bloqueio de segurança para o banco de dados e arquivos sensíveis
    location ~ /\.(?!well-known) { deny all; }
    location ~ /\.db { deny all; }

    # === CONFIGURAÇÃO SSL (Gerenciada pelo Certbot) ===
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/2chat.com.br/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/2chat.com.br/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

# Redirecionamento HTTP -> HTTPS
server {
    if ($host = www.2chat.com.br) {
        return 301 https://2chat.com.br$request_uri;
    }
    if ($host = 2chat.com.br) {
        return 301 https://2chat.com.br$request_uri;
    }

    listen 80;
    server_name 2chat.com.br www.2chat.com.br;
    return 404; # managed by Certbot
}
```

### Notas Importantes para o Deploy:
1. **Porta**: Garanta que o `ecosystem.config.js` esteja rodando na porta `3010`.
2. **Root**: Removi a diretiva `root` do bloco principal, pois agora o Express gerencia todos os arquivos estáticos via middleware `express.static`.
3. **WWW**: Simplifiquei o redirect para concentrar todo o tráfego em `https://2chat.com.br` (sem www), que é o padrão moderno de SEO adotado na agência.

