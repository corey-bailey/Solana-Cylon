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

    async scanInitialAssets() {
        logger.info('Performing initial asset scan...');

        try {
            // Get user wallet assets
            if (config.SOLANA_WALLET_ADDRESS) {
                logger.info('Scanning user wallet assets...');
                const userAssets = await walletAssets.getAllTokenBalances(config.SOLANA_WALLET_ADDRESS);
                logger.info('User wallet assets:', {
                    address: config.SOLANA_WALLET_ADDRESS,
                    solBalance: userAssets.solBalance,
                    tokens: userAssets.tokens.map(t => ({
                        symbol: t.symbol,
                        balance: t.balance
                    }))
                });
            }

            // Get watched wallet assets
            const activeWallets = walletConfig.getActiveWallets();
            logger.info(`Scanning ${activeWallets.length} watched wallets...`);

            for (const wallet of activeWallets) {
                const assets = await walletAssets.getAllTokenBalances(wallet.address);
                logger.info('Watched wallet assets:', {
                    name: wallet.name,
                    address: wallet.address,
                    solBalance: assets.solBalance,
                    tokens: assets.tokens.map(t => ({
                        symbol: t.symbol,
                        balance: t.balance
                    }))
                });
            }

            logger.info('Initial asset scan complete');
        } catch (error) {
            logger.error('Failed to complete initial asset scan', {
                error: error.message,
                stack: error.stack
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

            // Perform initial asset scan
            await this.scanInitialAssets();

            // Start transaction monitoring
            await monitor.start();

            logger.info('Bot is running and monitoring transactions');

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