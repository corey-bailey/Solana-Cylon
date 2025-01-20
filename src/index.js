import { Connection, PublicKey } from '@solana/web3.js';
import { monitor } from './services/transaction-monitor.js';
import walletConfig from './services/wallet-config.js';
import logger from './utils/logger.js';
import config from './config/config.js';
import { logEnvironment } from './utils/env-logger.js';
import walletAssets from './services/wallet-assets.js';

class TradingBot {
    constructor() {
        // Log environment variables first
        logEnvironment();
        
        this.connection = new Connection(config.SOLANA_RPC_URL);
        this.isRunning = false;
        this.userBalance = 0;
        this.monitoringInterval = null;

        logger.info('Trading Bot Initialized', {
            environment: process.env.NODE_ENV || 'development',
            network: config.SOLANA_NETWORK,
            rpcUrl: config.SOLANA_RPC_URL
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
            logger.logError(error, { context: 'TradingBot.updateUserBalance' });
        }
    }

    async monitorWallets() {
        const activeWallets = walletConfig.getActiveWallets();
        for (const wallet of activeWallets) {
            await monitor.monitorWalletTransactions(wallet.address);
        }
    }

    async start() {
        try {
            this.isRunning = true;
            logger.info('Connecting to Solana network...', {
                network: config.SOLANA_NETWORK,
                rpcUrl: config.SOLANA_RPC_URL
            });

            // Verify connection
            const version = await this.connection.getVersion();
            logger.info('Connected to Solana network', {
                version: version['solana-core'],
                network: config.SOLANA_NETWORK,
                rpcUrl: config.SOLANA_RPC_URL,
                featureSet: version['feature-set']
            });

            // Load wallet configurations and initial balances
            await walletConfig.loadConfig();
            await walletConfig.updateWalletBalances();
            await this.updateUserBalance();

            const activeWallets = walletConfig.getActiveWallets();
            logger.info(`Monitoring ${activeWallets.length} wallets`);

            // Initial wallet monitoring
            await this.monitorWallets();

            // Start configuration and balance watchers
            walletConfig.watchConfig().catch(error => {
                logger.logError(error, { context: 'Config Watcher' });
            });

            // Set up periodic monitoring with one minute interval
            this.monitoringInterval = setInterval(async () => {
                await this.monitorWallets();
                await walletConfig.updateWalletBalances();
                await this.updateUserBalance();
            }, 60000); // Check every minute

            logger.info('Bot is running and monitoring wallets...');

        } catch (error) {
            logger.logError(error, { 
                context: 'Bot Startup',
                network: config.SOLANA_NETWORK,
                rpcUrl: config.SOLANA_RPC_URL
            });
            this.stop();
        }
    }

    stop() {
        this.isRunning = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        // Cleanup transaction monitor
        monitor.cleanup();
        logger.info('Stopping bot...');
        process.exit(0);
    }
}

async function main() {
    try {
        // Initialize the monitor
        await monitor.initialize();

        // Start monitoring
        await monitor.start();

        // Log active wallets
        const activeWallets = walletConfig.getActiveWallets();
        logger.info('Monitoring started', {
            activeWallets: activeWallets.length,
            network: config.SOLANA_NETWORK,
            rpcUrl: config.SOLANA_RPC_URL
        });

    } catch (error) {
        logger.error('Failed to start monitoring', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    logger.info('Shutting down...');
    monitor.cleanup();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Shutting down...');
    monitor.cleanup();
    process.exit(0);
});

// Start the application
main().catch(error => {
    logger.error('Unhandled error in main', {
        error: error.message,
        stack: error.stack
    });
    process.exit(1);
});