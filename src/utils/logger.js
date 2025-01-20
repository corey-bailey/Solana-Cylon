const winston = require('winston');
const Config = require('../config/config');
const { createLogger, format, transports } = winston;
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
}

// Custom format for all outputs
const logFormat = format.printf(({ level, message, timestamp, ...args }) => {
    const metadata = { ...args };
    delete metadata.metadata; // Remove nested metadata
    return `${timestamp} [${level}]: ${message} ${JSON.stringify(metadata, null, 2)}`;
});

// Create separate loggers for different purposes
const createCustomLogger = (filename, level = 'info') => {
    return createLogger({
        level: Config.LOG_LEVEL,
        format: format.combine(
            format.timestamp(),
            format.splat(),
            logFormat
        ),
        transports: [
            // Console output
            new transports.Console({
                format: format.combine(
                    format.timestamp(),
                    format.colorize(),
                    logFormat
                )
            }),
            // File output
            new transports.File({ 
                filename: path.join('logs', filename),
                format: format.combine(
                    format.timestamp(),
                    logFormat
                )
            })
        ]
    });
};

// Create specific loggers
const userWalletLogger = createCustomLogger('user-wallet.log');
const watchedWalletLogger = createCustomLogger('watched-wallets.log');
const systemLogger = createCustomLogger('system.log');

// Helper methods for structured logging
const logger = {
    // System-level logging
    info: (message, metadata) => {
        systemLogger.info(message, metadata);
    },
    warn: (message, metadata) => {
        systemLogger.warn(message, metadata);
    },
    error: (message, metadata) => {
        systemLogger.error(message, metadata);
    },
    debug: (message, metadata) => {
        systemLogger.debug(message, metadata);
    },

    // User wallet specific logging
    userWallet: {
        info: (message, metadata) => {
            userWalletLogger.info(message, metadata);
            systemLogger.info(message, { ...metadata, context: 'UserWallet' });
        },
        error: (message, metadata) => {
            userWalletLogger.error(message, metadata);
            systemLogger.error(message, { ...metadata, context: 'UserWallet' });
        }
    },

    // Watched wallet specific logging
    watchedWallet: {
        info: (message, metadata) => {
            watchedWalletLogger.info(message, metadata);
            systemLogger.info(message, { ...metadata, context: 'WatchedWallet' });
        },
        error: (message, metadata) => {
            watchedWalletLogger.error(message, metadata);
            systemLogger.error(message, { ...metadata, context: 'WatchedWallet' });
        }
    },

    // Error logging with stack traces
    logError: (error, context = {}) => {
        const errorLog = {
            message: error.message,
            stack: error.stack,
            ...context
        };
        systemLogger.error('Error occurred', errorLog);
        
        // Log to specific files based on context
        if (context.context?.includes('UserWallet')) {
            userWalletLogger.error('Error occurred', errorLog);
        }
        if (context.context?.includes('WatchedWallet')) {
            watchedWalletLogger.error('Error occurred', errorLog);
        }
    }
};

module.exports = logger;