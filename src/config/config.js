const { PublicKey } = require('@solana/web3.js');
const path = require('path');
const fs = require('fs');

class Config {
    static loadEnvironment() {
        const env = process.env.NODE_ENV || 'development';
        const envPath = path.resolve(process.cwd(), `.env.${env}`);
        
        // Clear any existing env variables
        Object.keys(process.env).forEach(key => {
            if (key.startsWith('SOLANA_') || key === 'LOG_LEVEL') {
                delete process.env[key];
            }
        });

        // Load environment-specific variables
        if (fs.existsSync(envPath)) {
            require('dotenv').config({
                path: envPath,
                override: true
            });
        } else {
            throw new Error(`Environment file not found: ${envPath}`);
        }

        // Debug log to verify environment loading
        console.log('\nEnvironment Loading:');
        console.log('-------------------');
        console.log(`Current NODE_ENV: ${env}`);
        console.log(`Loading from path: ${envPath}`);
        console.log('\nEnvironment Variables Loaded:');
        console.log('----------------------------');
        console.log({
            NODE_ENV: process.env.NODE_ENV,
            SOLANA_NETWORK: process.env.SOLANA_NETWORK,
            SOLANA_RPC_URL: process.env.SOLANA_RPC_URL,
            SOLANA_WALLET_ADDRESS: process.env.SOLANA_WALLET_ADDRESS,
            LOG_LEVEL: process.env.LOG_LEVEL
        });
        console.log('----------------------------\n');
    }

    static initialize() {
        this.loadEnvironment();
    }

    static get SOLANA_NETWORK() {
        const network = process.env.SOLANA_NETWORK;
        if (!network) {
            console.warn('SOLANA_NETWORK not found in environment, using default: devnet');
            return 'devnet';
        }
        return network;
    }

    static get SOLANA_RPC_URL() {
        const url = process.env.SOLANA_RPC_URL;
        if (!url) {
            console.warn('SOLANA_RPC_URL not found in environment, using default: https://api.devnet.solana.com2');
            return 'https://api.devnet.solana.com2';
        }
        return url;
    }
    
    static validateAddress(address) {
        try {
            new PublicKey(address);
            return true;
        } catch (error) {
            return false;
        }
    }

    static get SOLANA_WALLET_ADDRESS() {
        const address = process.env.SOLANA_WALLET_ADDRESS;
        if (!address || !this.validateAddress(address)) {
            throw new Error('Invalid wallet address in configuration');
        }
        return address;
    }

    static get LOG_LEVEL() {
        return process.env.LOG_LEVEL || 'debug';
    }
}

// Initialize configuration
Config.initialize();

module.exports = Config; 