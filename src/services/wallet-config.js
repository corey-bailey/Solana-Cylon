import fs from 'fs';
import { parse } from 'csv-parse';
import { PublicKey } from '@solana/web3.js';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import walletAssets from './wallet-assets.js';

class WalletConfig {
    constructor() {
        this.wallets = new Map();
        this.csvPath = config.WALLETS_CSV_PATH;
        this.lastBalanceUpdate = 0;
        this.balanceUpdateInterval = 60000; // Update balances every minute
        this.loadConfig();
    }

    async loadConfig() {
        try {
            logger.info('Loading wallet configuration', { path: this.csvPath });

            const fileContent = fs.readFileSync(this.csvPath, 'utf-8');
            const records = await new Promise((resolve, reject) => {
                parse(fileContent, {
                    columns: true,
                    skip_empty_lines: true
                }, (err, records) => {
                    if (err) reject(err);
                    else resolve(records);
                });
            });

            this.wallets.clear();
            
            for (const record of records) {
                if (!record.address || !record.name) continue;
                
                try {
                    // Validate the address
                    new PublicKey(record.address);
                    
                    this.wallets.set(record.address, {
                        name: record.name,
                        address: record.address,
                        active: record.active === 'true',
                        riskLevel: record.risk_level || 'medium',
                        maxTradeSize: parseFloat(record.max_trade_size) || 1.0,
                        balance: 0
                    });
                } catch (error) {
                    logger.error('Invalid wallet address in config', {
                        address: record.address,
                        error: error.message
                    });
                }
            }

            logger.info('Wallet configuration loaded', {
                totalWallets: this.wallets.size,
                activeWallets: this.getActiveWallets().length
            });

        } catch (error) {
            logger.error('Failed to load wallet configuration', {
                error: error.message,
                path: this.csvPath
            });
            throw error;
        }
    }

    getActiveWallets() {
        return Array.from(this.wallets.values())
            .filter(wallet => wallet.active);
    }

    getWallet(address) {
        return this.wallets.get(address);
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

export default new WalletConfig(); 