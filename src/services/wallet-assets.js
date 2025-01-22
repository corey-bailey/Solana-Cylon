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
            // Get SOL balance
            const pubKey = new PublicKey(walletAddress);
            const solBalance = await this.connection.getBalance(pubKey) / 1e9;

            // Get token accounts
            const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
                pubKey,
                { programId: TOKEN_PROGRAM_ID }
            );

            // Process token balances - filter non-zero balances and fetch metadata
            const tokens = await Promise.all(
                tokenAccounts.value
                    .map(account => account.account.data.parsed.info)
                    .filter(tokenData => tokenData.tokenAmount.uiAmount > 0)
                    .map(async tokenData => {
                        const metadata = await this.getTokenMetadata(tokenData.mint);
                        return {
                            mint: tokenData.mint,
                            symbol: metadata?.symbol || `UNK-${tokenData.mint.slice(0, 4)}`,
                            name: metadata?.name || `Unknown Token (${tokenData.mint.slice(0, 8)}...)`,
                            balance: tokenData.tokenAmount.uiAmount,
                            decimals: tokenData.tokenAmount.decimals
                        };
                    })
            );

            logger.debug('Retrieved wallet balances', {
                wallet: walletAddress,
                solBalance,
                tokenCount: tokens.length
            });

            return {
                solBalance,
                tokens: tokens || [] // Ensure we always return an array
            };

        } catch (error) {
            logger.error('Failed to get wallet balances', {
                wallet: walletAddress,
                error: error.message
            });
            
            // Return a default structure on error
            return {
                solBalance: 0,
                tokens: []
            };
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
        try {
            for (const address of addresses) {
                await this.getAllTokenBalances(address);
            }
        } catch (error) {
            logger.error('Failed to update wallet balances', {
                error: error.message
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