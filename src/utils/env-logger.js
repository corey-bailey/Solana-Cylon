const logger = require('./logger');
const Config = require('../config/config');

function logEnvironment() {
    logger.info('Environment Configuration', {
        NODE_ENV: process.env.NODE_ENV || 'development',
        SOLANA_NETWORK: Config.SOLANA_NETWORK,
        SOLANA_RPC_URL: Config.SOLANA_RPC_URL,
        SOLANA_WALLET_ADDRESS: Config.SOLANA_WALLET_ADDRESS,
        LOG_LEVEL: Config.LOG_LEVEL,
        CONFIG_PATH: `.env.${process.env.NODE_ENV || 'development'}`
    });
}

module.exports = { logEnvironment }; 