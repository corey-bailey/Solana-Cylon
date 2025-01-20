import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const env = process.env.NODE_ENV || 'development';
const envPath = path.resolve(__dirname, `../../.env.${env}`);
dotenv.config({ path: envPath });

export const config = {
    SOLANA_NETWORK: process.env.SOLANA_NETWORK || 'mainnet-beta',
    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    SOLANA_WALLET_ADDRESS: process.env.SOLANA_WALLET_ADDRESS,
    LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};

export default config; 