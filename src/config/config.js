import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment-specific config
const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
const envPath = path.resolve(__dirname, '../../', envFile);

const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error(`Error loading ${envFile}:`, result.error);
    process.exit(1);
}

const config = {
    SOLANA_NETWORK: process.env.SOLANA_NETWORK,
    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL,
    SOLANA_WALLET_ADDRESS: process.env.SOLANA_WALLET_ADDRESS,
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    WALLETS_CSV_PATH: process.env.WALLETS_CSV_PATH || 'data/wallets.csv'
};

// Validate required configuration
const requiredConfig = [
    'SOLANA_NETWORK',
    'SOLANA_RPC_URL',
    'SOLANA_WALLET_ADDRESS'
];

const missingConfig = requiredConfig.filter(key => !config[key]);

if (missingConfig.length > 0) {
    console.error('Missing required configuration:', missingConfig);
    console.error('Current environment:', process.env.NODE_ENV);
    console.error('Config file path:', envPath);
    process.exit(1);
}

export default config; 