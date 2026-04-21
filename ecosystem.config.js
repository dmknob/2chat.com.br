module.exports = {
  apps: [
    {
      name: '2chat',
      script: 'server.js',
      instances: 1, // Em SQLite, manter 1 instância para evitar locks concorrentes pesados
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        DB_FILE: '2chat.db',
        BASE_URL: 'https://2chat.com.br',
        LOG_LEVEL: 'info',
        MORGAN_FORMAT: 'combined'
      }
    }
  ]
};
