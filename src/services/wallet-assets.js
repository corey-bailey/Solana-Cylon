import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import pkg from '@metaplex-foundation/mpl-token-metadata';
const { Metadata } = pkg;
import Config from '../config/config.js';
import logger from '../utils/logger.js';

class WalletAssets {
    constructor() {
        this.connection = new Connection(Config.SOLANA_RPC_URL);
        this.walletBalances = new Map();
        this.tokenBalances = new Map();
    }

    async getTokenMetadata(mintAddress) {
        try {
            const [metadataPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('metadata'),
                    Metadata.PROGRAM_ID.toBuffer(),
                    new PublicKey(mintAddress).toBuffer(),
                ],
                Metadata.PROGRAM_ID
            );

            const metadata = await this.connection.getAccountInfo(metadataPDA);
            if (metadata && metadata.data) {
                const metadataData = Metadata.deserialize(metadata.data)[0];
                return {
                    name: metadataData.data.name,
                    symbol: metadataData.data.symbol,
                    uri: metadataData.data.uri
                };
            }
        } catch (error) {
            logger.debug(`Failed to fetch metadata for token ${mintAddress}`, { error: error.message });
        }
        return null;
    }

    async getAllTokenBalances(walletAddress) {
        try {
            const pubKey = new PublicKey(walletAddress);
            
            // Get all token accounts for this wallet
            const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
                pubKey,
                { programId: TOKEN_PROGRAM_ID }
            );

            const balances = [];
            
            // Process each token account
            for (const { account } of tokenAccounts.value) {
                const parsedInfo = account.data.parsed.info;
                const tokenBalance = parsedInfo.tokenAmount;

                // Only include tokens with non-zero balance
                if (tokenBalance.uiAmount > 0) {
                    const mintAddress = parsedInfo.mint;
                    const metadata = await this.getTokenMetadata(mintAddress);
                    
                    balances.push({
                        mint: mintAddress,
                        balance: tokenBalance.uiAmount,
                        decimals: tokenBalance.decimals,
                        name: metadata?.name || `Token: ${mintAddress.slice(0, 8)}...`,
                        symbol: metadata?.symbol || 'UNKNOWN'
                    });
                }
            }

            // Sort by balance value
            balances.sort((a, b) => b.balance - a.balance);

            logger.info('Wallet Token Balances', {
                wallet: walletAddress,
                solBalance: await this.getWalletBalance(walletAddress),
                tokens: balances.map(b => ({
                    name: b.name,
                    symbol: b.symbol,
                    balance: b.balance
                }))
            });

            return balances;
        } catch (error) {
            logger.error('Failed to fetch token balances', {
                wallet: walletAddress,
                error: error.message
            });
            return [];
        }
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

export const walletAssets = new WalletAssets();
export default walletAssets; 