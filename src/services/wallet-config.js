import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { PublicKey } from '@solana/web3.js';
import logger from '../utils/logger.js';
import walletAssets from './wallet-assets.js';

class WalletConfig {
    constructor() {
        this.wallets = new Map();
        this.configPath = 'data/wallets.csv';
        this.lastBalanceUpdate = 0;
        this.balanceUpdateInterval = 60000; // Update balances every minute
        this.loadWallets();
    }

    loadWallets() {
        try {
            const csvData = fs.readFileSync(this.configPath, 'utf-8');
            const records = parse(csvData, {
                columns: true,
                skip_empty_lines: true
            });

            for (const record of records) {
                if (this.validateWallet(record)) {
                    this.wallets.set(record.address, {
                        name: record.name,
                        address: record.address,
                        active: record.active.toLowerCase() === 'true',
                        riskLevel: record.risk_level,
                        maxTradeSize: parseFloat(record.max_trade_size)
                    });
                }
            }

            logger.info('Wallets loaded successfully', {
                totalWallets: this.wallets.size,
                activeWallets: this.getActiveWallets().length
            });

        } catch (error) {
            logger.error('Failed to load wallets', {
                error: error.message,
                stack: error.stack
            });
        }
    }

    validateWallet(wallet) {
        try {
            if (!wallet.address || !wallet.name || wallet.active === undefined) {
                logger.warn('Invalid wallet record', { wallet });
                return false;
            }

            new PublicKey(wallet.address);
            return true;
        } catch (error) {
            logger.warn('Invalid wallet address', {
                address: wallet.address,
                error: error.message
            });
            return false;
        }
    }

    getActiveWallets() {
        return Array.from(this.wallets.values())
            .filter(wallet => wallet.active);
    }

    // Watch for config changes and reload
    async watchConfig() {
        try {
            const watcher = fs.watch(this.configPath);
            for await (const event of watcher) {
                if (event.eventType === 'change') {
                    logger.info('Wallet configuration file changed, reloading...');
                    await this.loadWallets();
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

export const walletConfig = new WalletConfig();
export default walletConfig; 