const fs = require('fs').promises;
const { parse } = require('csv-parse');
const logger = require('../utils/logger');
const { PublicKey } = require('@solana/web3.js');
const walletAssets = require('./wallet-assets');

class WalletConfig {
    constructor() {
        this.wallets = new Map();
        this.configPath = 'data/wallets.csv';
        this.lastBalanceUpdate = 0;
        this.balanceUpdateInterval = 60000; // Update balances every minute
    }

    // Validate Solana wallet address
    validateAddress(address) {
        try {
            new PublicKey(address);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Parse and validate CSV data
    async loadConfig() {
        try {
            const fileContent = await fs.readFile(this.configPath, 'utf-8');
            
            return new Promise((resolve, reject) => {
                parse(fileContent, {
                    columns: true,
                    skip_empty_lines: true,
                    trim: true
                }, (err, records) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    this.wallets.clear();
                    
                    records.forEach(record => {
                        if (!this.validateAddress(record.address)) {
                            logger.warn(`Invalid wallet address: ${record.address}`);
                            return;
                        }

                        this.wallets.set(record.address, {
                            name: record.name,
                            active: record.active.toLowerCase() === 'true',
                            riskLevel: record.risk_level,
                            maxTradeSize: parseFloat(record.max_trade_size)
                        });
                    });

                    logger.info(`Loaded ${this.wallets.size} wallet configurations`);
                    resolve(this.wallets);
                });
            });
        } catch (error) {
            logger.logError(error, { context: 'WalletConfig.loadConfig' });
            throw error;
        }
    }

    // Get active wallets
    getActiveWallets() {
        return Array.from(this.wallets.entries())
            .filter(([_, config]) => config.active)
            .map(([address, config]) => ({
                address,
                ...config
            }));
    }

    // Watch for config changes and reload
    async watchConfig() {
        try {
            const watcher = fs.watch(this.configPath);
            for await (const event of watcher) {
                if (event.eventType === 'change') {
                    logger.info('Wallet configuration file changed, reloading...');
                    await this.loadConfig();
                }
            }
        } catch (error) {
            logger.logError(error, { context: 'WalletConfig.watchConfig' });
        }
    }

    async updateWalletBalances() {
        const now = Date.now();
        if (now - this.lastBalanceUpdate < this.balanceUpdateInterval) {
            return;
        }

        const addresses = Array.from(this.wallets.keys());
        await walletAssets.updateWalletBalances(addresses);
        this.lastBalanceUpdate = now;
    }

    calculateProportionalTrade(sourceAddress, tradeAmount, targetBalance) {
        const ratio = walletAssets.calculateTradeRatio(sourceAddress, tradeAmount);
        if (!ratio) return null;

        const proportionalAmount = walletAssets.calculateProportionalTrade(ratio, targetBalance);
        
        // Apply risk level adjustments
        const wallet = this.wallets.get(sourceAddress);
        let riskMultiplier = 1;
        switch (wallet.riskLevel) {
            case 'high':
                riskMultiplier = 1;
                break;
            case 'medium':
                riskMultiplier = 0.75;
                break;
            case 'low':
                riskMultiplier = 0.5;
                break;
        }

        const adjustedAmount = proportionalAmount * riskMultiplier;
        
        // Ensure we don't exceed max trade size
        const finalAmount = Math.min(adjustedAmount, wallet.maxTradeSize);

        logger.info(`Calculated proportional trade`, {
            sourceAddress,
            tradeAmount: `${tradeAmount} SOL`,
            ratio: ratio.toFixed(4),
            riskLevel: wallet.riskLevel,
            riskMultiplier,
            proportionalAmount: `${proportionalAmount.toFixed(4)} SOL`,
            finalAmount: `${finalAmount.toFixed(4)} SOL`
        });

        return finalAmount;
    }
}

module.exports = new WalletConfig(); 