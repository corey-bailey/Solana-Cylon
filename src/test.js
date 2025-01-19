const { Connection } = require('@solana/web3.js');
const Config = require('./config/config');
const logger = require('./utils/logger');
const walletConfig = require('./services/wallet-config');

async function testConfiguration() {
    try {
        // Test different log levels
        logger.info('Starting configuration test');

        // Test wallet configuration loading
        await walletConfig.loadConfig();
        
        // Display active wallets
        const activeWallets = walletConfig.getActiveWallets();
        logger.info('Active wallets loaded', { activeWallets });

        // Test Solana connection
        const connection = new Connection(Config.SOLANA_RPC_URL);
        const version = await connection.getVersion();
        logger.info('Connected to Solana network', { version });

    } catch (error) {
        logger.logError(error, {
            context: 'Configuration Test',
            network: Config.SOLANA_NETWORK
        });
    }
}

// Start configuration watching
walletConfig.watchConfig().catch(error => {
    logger.logError(error, { context: 'Config Watcher' });
});

testConfiguration(); 