# Configuração Nginx (Servidor de Origem)

Este arquivo deve ser colocado em `/etc/nginx/sites-available/2chat.com.br` no VPS e ativado com um link simbólico para `sites-enabled`.

```nginx
server {
    listen 80;
    server_name 2chat.com.br;

    # Logs customizados seguindo o padrão da agência
    access_log /var/log/nginx/2chat_access.log;
    error_log /var/log/nginx/2chat_error.log;

    # Otimizações de buffer para Express
    proxy_buffers 8 16k;
    proxy_buffer_size 32k;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # Headers necessários para o Express trust proxy e websockets
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Bypass cache para API se necessário (o Worker já gerencia cache)
        proxy_cache_bypass $http_upgrade;
    }

    # Bloqueio de acesso a arquivos de configuração e git
    location ~ /\.(?!well-known) {
        deny all;
    }

    location ~ /\.db {
        deny all;
    }
}
```

### Comandos de Ativação no VPS:

1. **Testar configuração:** `sudo nginx -t`
2. **Reload:** `sudo systemctl reload nginx`
3. **Iniciar via PM2:** `pm2 start ecosystem.config.js --env production`
4. **Salvar lista do PM2:** `pm2 save`
