// src/logger.js — padrão Brindaria / Corpo Digital
const winston = require('winston');
const path    = require('path');
const fs      = require('fs');

// Garante que o diretório de logs existe
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Formato legível para dev
const devFormat = combine(
    colorize(),
    timestamp({ format: 'HH:mm:ss' }),
    errors({ stack: true }),
    printf(({ level, message, timestamp, ...meta }) => {
        const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level}] ${message}${extra}`;
    })
);

// Formato JSON para produção (máquina-legível)
const prodFormat = combine(
    timestamp(),
    errors({ stack: true }),
    winston.format.json()
);

const logger = winston.createLogger({
    level:  process.env.LOG_LEVEL || 'info',
    format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level:    'error',
            maxsize:  5_242_880, // 5MB
            maxFiles: 3,
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize:  10_485_760, // 10MB
            maxFiles: 5,
        }),
    ],
});

// Stream para Morgan (rotas HTTP principais)
logger.stream = {
    write: (msg) => logger.http(msg.trim()),
};

// Stream para Morgan (assets estáticos — log separado, menos verboso)
logger.assetsStream = {
    write: (msg) => logger.debug(msg.trim()),
};

module.exports = logger;
