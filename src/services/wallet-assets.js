const { Connection, PublicKey } = require('@solana/web3.js');
const Config = require('../config/config');
const logger = require('../utils/logger');

class WalletAssets {
    constructor() {
        this.connection = new Connection(Config.SOLANA_RPC_URL);
        this.walletBalances = new Map();
    }

    async getWalletBalance(address) {
        try {
            const pubKey = new PublicKey(address);
            const balance = await this.connection.getBalance(pubKey);
            return balance / 1e9; // Convert lamports to SOL
        } catch (error) {
            logger.logError(error, { 
                context: 'WalletAssets.getWalletBalance', 
                address 
            });
            return 0;
        }
    }

    async updateWalletBalances(addresses) {
        for (const address of addresses) {
            const balance = await this.getWalletBalance(address);
            this.walletBalances.set(address, balance);
            logger.info(`Updated wallet balance`, {
                address,
                balance: `${balance} SOL`
            });
        }
    }

    calculateTradeRatio(sourceAddress, tradeAmount) {
        const sourceBalance = this.walletBalances.get(sourceAddress);
        if (!sourceBalance) {
            logger.warn(`No balance found for source wallet`, { sourceAddress });
            return null;
        }

        const ratio = tradeAmount / sourceBalance;
        logger.info(`Calculated trade ratio`, {
            sourceAddress,
            sourceBalance: `${sourceBalance} SOL`,
            tradeAmount: `${tradeAmount} SOL`,
            ratio: ratio.toFixed(4)
        });

        return ratio;
    }

    calculateProportionalTrade(ratio, targetBalance) {
        if (!ratio) return 0;
        const proportionalAmount = targetBalance * ratio;
        return proportionalAmount;
    }
}

module.exports = new WalletAssets(); 