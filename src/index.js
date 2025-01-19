const { Connection, PublicKey } = require('@solana/web3.js');
const Config = require('./config/config');
const logger = require('./utils/logger');
const walletConfig = require('./services/wallet-config');

class TradingBot {
    constructor() {
        this.connection = new Connection(Config.SOLANA_RPC_URL);
        this.isRunning = false;
        this.userBalance = 0;
    }

    async updateUserBalance() {
        try {
            const userPubKey = new PublicKey(Config.SOLANA_PRIVATE_KEY);
            this.userBalance = await this.connection.getBalance(userPubKey) / 1e9;
            logger.info(`Updated user balance`, { balance: `${this.userBalance} SOL` });
        } catch (error) {
            logger.logError(error, { context: 'TradingBot.updateUserBalance' });
        }
    }

    async start() {
        try {
            this.isRunning = true;
            logger.info('Starting Solana Trading Bot...');

            // Load wallet configurations and initial balances
            await walletConfig.loadConfig();
            await walletConfig.updateWalletBalances();
            await this.updateUserBalance();

            const activeWallets = walletConfig.getActiveWallets();
            logger.info(`Monitoring ${activeWallets.length} wallets`);

            // Example of calculating a proportional trade
            const exampleTrade = {
                sourceWallet: activeWallets[0].address,
                tradeAmount: 1.5 // SOL
            };

            const proportionalAmount = walletConfig.calculateProportionalTrade(
                exampleTrade.sourceWallet,
                exampleTrade.tradeAmount,
                this.userBalance
            );

            logger.info(`Example proportional trade calculation`, {
                sourceWallet: exampleTrade.sourceWallet,
                tradeAmount: `${exampleTrade.tradeAmount} SOL`,
                proportionalAmount: proportionalAmount ? `${proportionalAmount.toFixed(4)} SOL` : 'N/A'
            });

            // Start configuration and balance watchers
            walletConfig.watchConfig().catch(error => {
                logger.logError(error, { context: 'Config Watcher' });
            });

            // Update balances periodically
            setInterval(async () => {
                await walletConfig.updateWalletBalances();
                await this.updateUserBalance();
            }, 60000); // Every minute

            logger.info('Bot is running and monitoring wallets...');

        } catch (error) {
            logger.logError(error, { context: 'Bot Startup' });
            this.stop();
        }
    }

    stop() {
        this.isRunning = false;
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