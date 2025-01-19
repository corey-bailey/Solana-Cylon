require('dotenv').config();

class Config {
    static SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'devnet';
    static SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    static SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY;
    static LOG_LEVEL = process.env.LOG_LEVEL || 'debug';
}

module.exports = Config; 