const walletConfig = require('../services/wallet-config');
const logger = require('./logger');

async function validateCSV() {
    try {
        await walletConfig.loadConfig();
        const activeWallets = walletConfig.getActiveWallets();
        
        logger.info('CSV Validation Results:', {
            totalWallets: walletConfig.wallets.size,
            activeWallets: activeWallets.length
        });

        return true;
    } catch (error) {
        logger.logError(error, { context: 'CSV Validation' });
        return false;
    }
}

if (require.main === module) {
    validateCSV().then(isValid => {
        process.exit(isValid ? 0 : 1);
    });
}

module.exports = validateCSV; 