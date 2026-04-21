module.exports = {
  apps: [
    {
      name: '2chat',
      script: 'server.js',
      instances: 1, // Em SQLite, manter 1 instância para evitar locks concorrentes pesados
      autorestart: true,
      watch: false,
      max_memory_restart: '120M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3010,
        DB_FILE: '2chat_prod.db',
        BASE_URL: 'https://2chat.com.br',
        LOG_LEVEL: 'info',
        MORGAN_FORMAT: 'combined'
      }
    }
  ]
};
