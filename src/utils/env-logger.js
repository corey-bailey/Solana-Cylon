import logger from './logger.js';
import config from '../config/config.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function logEnvironment() {
    const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
    const envPath = path.resolve(__dirname, '../../', envFile);

    logger.info('Environment Configuration:', {
        NODE_ENV: process.env.NODE_ENV || 'development',
        CONFIG_FILE: envPath,
        SOLANA_NETWORK: config.SOLANA_NETWORK,
        SOLANA_RPC_URL: config.SOLANA_RPC_URL,
        LOG_LEVEL: config.LOG_LEVEL,
        WALLETS_CSV_PATH: config.WALLETS_CSV_PATH
    });
}

export default {
    logEnvironment
}; 