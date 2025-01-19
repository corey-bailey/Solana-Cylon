const winston = require('winston');
const Config = require('../config/config');
const { createLogger, format, transports } = winston;
const Syslog = require('winston-syslog').Syslog;

// Create logs directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
}

// Custom format for macOS Console readability
const macOSFormat = format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});

const logger = createLogger({
    level: Config.LOG_LEVEL,
    format: format.combine(
        format.timestamp(),
        format.metadata(),
        macOSFormat
    ),
    transports: [
        // Console output
        new transports.Console({
            format: format.simple()
        }),
        // File output
        new transports.File({ 
            filename: 'logs/error.log', 
            level: 'error' 
        }),
        new transports.File({ 
            filename: 'logs/combined.log' 
        }),
        // macOS system log
        new Syslog({
            app_name: 'solana-trade-bot',
            facility: 'local0',
            protocol: 'unix',
            path: '/var/run/syslog',
            format: format.combine(
                format.timestamp(),
                format.json()
            )
        })
    ]
});

// Add error event handlers
logger.on('error', (error) => {
    console.error('Logger error:', error);
});

// Helper methods for structured logging
logger.logTrade = (action, data) => {
    logger.info(`Trade ${action}`, {
        type: 'TRADE',
        action,
        ...data
    });
};

logger.logWallet = (action, data) => {
    logger.info(`Wallet ${action}`, {
        type: 'WALLET',
        action,
        ...data
    });
};

logger.logError = (error, context = {}) => {
    logger.error(error.message, {
        type: 'ERROR',
        stack: error.stack,
        ...context
    });
};

module.exports = logger; 