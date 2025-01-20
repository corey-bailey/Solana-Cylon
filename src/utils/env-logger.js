import logger from './logger.js';
import config from '../config/config.js';

export function logEnvironment() {
    logger.info('Environment Configuration:', {
        NODE_ENV: process.env.NODE_ENV || 'development',
        SOLANA_NETWORK: config.SOLANA_NETWORK,
        SOLANA_RPC_URL: config.SOLANA_RPC_URL,
        LOG_LEVEL: config.LOG_LEVEL
    });
}

export default {
    logEnvironment
}; 