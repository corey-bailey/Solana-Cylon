import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment variables
dotenv.config({ path: '.env.development' });

// Global test setup
globalThis.testSetup = {
    MAINNET_RPC: 'https://api.mainnet-beta.solana.com',
    TEST_WALLET: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    TEST_TX: '4HPQh7qZgvvPajEirD6RwVNHwz5girhHCYLgY9DeXrZGXAGsUWmwXKigVwkwjqzMWTyEhQYbVwrNxHXPrHFCvXPu'
}; 