const { Connection, PublicKey } = require('@solana/web3.js');
const Config = require('./config/config');
const logger = require('./utils/logger');
const walletConfig = require('./services/wallet-config');
const transactionMonitor = require('./services/transaction-monitor');
const { logEnvironment } = require('./utils/env-logger');
const walletAssets = require('./services/wallet-assets');

class TradingBot {
    constructor() {
        // Log environment variables first
        logEnvironment();
        
        this.connection = new Connection(Config.SOLANA_RPC_URL);
        this.isRunning = false;
        this.userBalance = 0;
        this.monitoringInterval = null;

        logger.info('Trading Bot Initialized', {
            environment: process.env.NODE_ENV || 'development',
            network: Config.SOLANA_NETWORK,
            rpcUrl: Config.SOLANA_RPC_URL
        });
    }

    async updateUserBalance() {
        try {
            if (!Config.SOLANA_WALLET_ADDRESS) {
                logger.warn('No wallet address configured for balance tracking');
                return;
            }
            
            // Get SOL balance
            const pubKey = new PublicKey(Config.SOLANA_WALLET_ADDRESS);
            this.userBalance = await this.connection.getBalance(pubKey) / 1e9;
            
            // Get token balances
            await walletAssets.getAllTokenBalances(Config.SOLANA_WALLET_ADDRESS);
            
        } catch (error) {
            logger.logError(error, { context: 'TradingBot.updateUserBalance' });
        }
    }

    async monitorWallets() {
        const activeWallets = walletConfig.getActiveWallets();
        for (const wallet of activeWallets) {
            await transactionMonitor.monitorWalletTransactions(wallet.address);
        }
    }

    async start() {
        try {
            this.isRunning = true;
            logger.info('Connecting to Solana network...', {
                network: Config.SOLANA_NETWORK,
                rpcUrl: Config.SOLANA_RPC_URL
            });

            // Verify connection
            const version = await this.connection.getVersion();
            logger.info('Connected to Solana network', {
                version: version['solana-core'],
                network: Config.SOLANA_NETWORK,
                rpcUrl: Config.SOLANA_RPC_URL,
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

            // Set up periodic monitoring
            this.monitoringInterval = setInterval(async () => {
                await this.monitorWallets();
                await walletConfig.updateWalletBalances();
                await this.updateUserBalance();
            }, 10000); // Check every 10 seconds

            logger.info('Bot is running and monitoring wallets...');

        } catch (error) {
            logger.logError(error, { 
                context: 'Bot Startup',
                network: Config.SOLANA_NETWORK,
                rpcUrl: Config.SOLANA_RPC_URL
            });
            this.stop();
        }
    }

    stop() {
        this.isRunning = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        logger.info('Stopping bot...');
        process.exit(0);
    }
}

// Handle shutdown gracefully
process.on('SIGINT', () => {
    logger.info('Received SIGINT. Shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Received SIGTERM. Shutting down...');
    process.exit(0);
});

// Start the bot
const bot = new TradingBot();
bot.start().catch(error => {
    logger.logError(error, { context: 'Bot Main' });
    process.exit(1);
});