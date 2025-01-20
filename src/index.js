import { Connection, PublicKey } from '@solana/web3.js';
import { monitor } from './services/transaction-monitor.js';
import walletConfig from './services/wallet-config.js';
import logger from './utils/logger.js';
import config from './config/config.js';
import { logEnvironment } from './utils/env-logger.js';
import walletAssets from './services/wallet-assets.js';
import { setupLogDirectories } from './utils/setup-logs.js';

// Ensure log directories exist
setupLogDirectories();

class TradingBot {
    constructor() {
        // Log environment variables first
        logEnvironment();
        
        this.connection = new Connection(config.SOLANA_RPC_URL);
        this.isRunning = false;
        this.userBalance = 0;
        this.monitoringInterval = null;

        // Log initialization
        logger.info('Trading Bot initialized', {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV
        });
    }

    async updateUserBalance() {
        try {
            if (!config.SOLANA_WALLET_ADDRESS) {
                logger.warn('No wallet address configured for balance tracking');
                return;
            }
            
            // Get SOL balance
            const pubKey = new PublicKey(config.SOLANA_WALLET_ADDRESS);
            this.userBalance = await this.connection.getBalance(pubKey) / 1e9;
            
            // Get token balances
            await walletAssets.getAllTokenBalances(config.SOLANA_WALLET_ADDRESS);
            
        } catch (error) {
            logger.error('Failed to update balance', { 
                error: error.message,
                context: 'TradingBot.updateUserBalance'
            });
        }
    }

    async start() {
        try {
            this.isRunning = true;
            logger.info('Starting Trading Bot...');

            // Initialize monitor
            await monitor.initialize();

            // Load wallet configurations
            await walletConfig.loadConfig();
            const activeWallets = walletConfig.getActiveWallets();
            
            logger.info('Configuration loaded', {
                activeWallets: activeWallets.length,
                network: config.SOLANA_NETWORK,
                rpcUrl: config.SOLANA_RPC_URL
            });

            // Get initial balances
            await walletConfig.updateWalletBalances();
            await this.updateUserBalance();

            // Start transaction monitoring
            await monitor.start();

            // Set up periodic monitoring
            this.monitoringInterval = setInterval(async () => {
                await walletConfig.updateWalletBalances();
                await this.updateUserBalance();
            }, 60000); // Check every minute

            logger.info('Bot is running and monitoring wallets');

        } catch (error) {
            logger.error('Failed to start bot', {
                error: error.message,
                stack: error.stack
            });
            this.stop();
        }
    }

    stop() {
        this.isRunning = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        monitor.cleanup();
        logger.info('Bot stopped');
    }
}

// Create bot instance
const bot = new TradingBot();

// Start the bot with more verbose logging
logger.info('Starting bot application...', {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV
});

// Handle process termination
process.on('SIGINT', () => {
    logger.info('Received SIGINT signal');
    bot.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Received SIGTERM signal');
    bot.stop();
    process.exit(0);
});

// Start the bot
bot.start().catch(error => {
    logger.error('Unhandled error in main', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
    process.exit(1);
});