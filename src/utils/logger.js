import winston from 'winston';
import config from '../config/config.js';

const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
);

const logger = winston.createLogger({
    level: config.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        // Write all logs to console
        new winston.transports.Console(),
        
        // Write all logs to their respective files
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: 'logs/system.log' 
        }),
        new winston.transports.File({ 
            filename: 'logs/combined.log' 
        })
    ]
});

// Add specialized loggers for wallet monitoring
logger.userWallet = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
        new winston.transports.File({ 
            filename: 'logs/user-wallet.log' 
        }),
        new winston.transports.Console()
    ]
});

logger.watchedWallet = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
        new winston.transports.File({ 
            filename: 'logs/watched-wallets.log' 
        }),
        new winston.transports.Console()
    ]
});

export default logger;