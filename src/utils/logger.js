import winston from 'winston';
import 'winston-syslog';
import Config from '../config/config.js';

// Create custom format
const customFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata, null, 2)}`;
    }
    return msg;
});

// Create logger instance
const logger = winston.createLogger({
    level: Config.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
        customFormat
    ),
    transports: [
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: 'logs/combined.log' 
        })
    ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// Add specialized loggers for different types of transactions
logger.userWallet = logger.child({ 
    logType: 'user-wallet',
    filename: 'logs/user-wallet.log'
});

logger.watchedWallet = logger.child({ 
    logType: 'watched-wallet',
    filename: 'logs/watched-wallets.log'
});

export { logger as default };