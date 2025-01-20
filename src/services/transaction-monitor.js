const { Connection, PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { Metadata } = require('@metaplex-foundation/mpl-token-metadata');
const logger = require('../utils/logger');
const Config = require('../config/config');
const walletConfig = require('./wallet-config');

class TransactionMonitor {
    constructor() {
        this.connection = new Connection(Config.SOLANA_RPC_URL);
        this.watchedTransactions = new Map();
        this.startTime = Date.now() / 1000;
        this.lastRequestTime = 0;  // Track last request time
        this.requestDelay = 1000;   // Base delay between requests (1000ms)
        
        logger.info('Transaction Monitor Started', {
            environment: process.env.NODE_ENV || 'development',
            network: Config.SOLANA_NETWORK,
            rpcUrl: Config.SOLANA_RPC_URL,
            startTime: new Date(this.startTime * 1000).toISOString()
        });
    }

    // Add delay between requests
    async throttleRequest() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.requestDelay) {
            await new Promise(resolve => 
                setTimeout(resolve, this.requestDelay - timeSinceLastRequest)
            );
        }
        
        this.lastRequestTime = Date.now();
    }

    // Retry with exponential backoff
    async retryWithBackoff(operation, maxRetries = 3, initialDelay = 4000) {
        let retries = 0;
        let delay = initialDelay;

        while (retries < maxRetries) {
            try {
                await this.throttleRequest();
                const result = await operation();
                return result;
            } catch (error) {
                retries++;
                if (error.message.includes('429')) {
                    const waitTime = delay * Math.pow(2, retries - 1);
                    logger.debug(`Rate limited, waiting ${waitTime}ms before retry ${retries}/${maxRetries}`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    delay = Math.min(delay * 2, 10000); // Cap maximum delay at 10 seconds
                } else if (retries === maxRetries) {
                    throw error;
                }
            }
        }
        return null; // Return null if all retries failed
    }

    async initialize() {
        try {
            const version = await this.connection.getVersion();
            logger.info('Transaction Monitor Connected', {
                version: version['solana-core'],
                network: Config.SOLANA_NETWORK,
                rpcUrl: Config.SOLANA_RPC_URL,
                featureSet: version['feature-set']
            });
        } catch (error) {
            logger.error('Failed to connect to Solana network', {
                error: error.message,
                network: Config.SOLANA_NETWORK,
                rpcUrl: Config.SOLANA_RPC_URL
            });
            throw error;
        }
    }

    getWalletName(address) {
        const wallet = walletConfig.wallets.get(address);
        return wallet ? wallet.name : 'Unknown Wallet';
    }

    async validateWalletAddress(address) {
        try {
            const pubKey = new PublicKey(address);
            const accountInfo = await this.connection.getAccountInfo(pubKey);
            const walletName = this.getWalletName(address);
            if (accountInfo === null) {
                logger.warn(`Wallet not found on ${Config.SOLANA_NETWORK}`, {
                    wallet: walletName,
                    address,
                    environment: process.env.NODE_ENV || 'development'
                });
            }
            return accountInfo !== null;
        } catch (error) {
            logger.warn(`Invalid wallet address`, {
                address,
                wallet: this.getWalletName(address),
                environment: process.env.NODE_ENV || 'development',
                error: error.message
            });
            return false;
        }
    }

    async getTokenInfo(tokenAddress, retries = 2) {
        return this.retryWithBackoff(async () => {
            try {
                // Get mint info with retry logic
                let mintInfo = null;
                let attempts = 0;
                
                while (attempts < retries && !mintInfo) {
                    try {
                        mintInfo = await this.connection.getParsedAccountInfo(new PublicKey(tokenAddress));
                        if (!mintInfo.value) {
                            throw new Error('No mint info found');
                        }
                    } catch (error) {
                        attempts++;
                        if (attempts === retries) {
                            logger.warn(`Failed to get mint info after ${retries} attempts`, {
                                tokenAddress,
                                error: error.message
                            });
                            return null;
                        }
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between retries
                    }
                }

                try {
                    // Get metadata PDA for token
                    const [metadataPDA] = PublicKey.findProgramAddressSync(
                        [
                            Buffer.from('metadata'),
                            Metadata.PROGRAM_ID.toBuffer(),
                            new PublicKey(tokenAddress).toBuffer(),
                        ],
                        Metadata.PROGRAM_ID
                    );

                    // Get metadata account info with retry logic
                    let metadata = null;
                    attempts = 0;

                    while (attempts < retries && !metadata) {
                        try {
                            metadata = await this.connection.getAccountInfo(metadataPDA);
                            if (metadata && metadata.data) {
                                const metadataData = Metadata.deserialize(metadata.data)[0];
                                return {
                                    address: tokenAddress,
                                    decimals: mintInfo.value.data.parsed.info.decimals,
                                    symbol: metadataData.data.symbol || 'Unknown',
                                    name: metadataData.data.name || `Token: ${tokenAddress}`,
                                    uri: metadataData.data.uri,
                                    verified: true
                                };
                            }
                        } catch (error) {
                            attempts++;
                            if (attempts === retries) {
                                logger.debug(`No metadata found for token ${tokenAddress}`, { 
                                    error: error.message,
                                    attempts 
                                });
                                break;
                            }
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                } catch (error) {
                    logger.debug(`Failed to fetch metadata for token ${tokenAddress}`, { 
                        error: error.message,
                        mintInfo: !!mintInfo
                    });
                }

                // Return basic info if metadata not available
                return {
                    address: tokenAddress,
                    decimals: mintInfo.value.data.parsed.info.decimals,
                    symbol: 'Unknown',
                    name: `Token: ${tokenAddress}`,
                    verified: false
                };

            } catch (error) {
                logger.warn(`Failed to get token info`, { 
                    tokenAddress,
                    error: error.message,
                    stack: error.stack
                });
                return {
                    address: tokenAddress,
                    decimals: 9, // Default to 9 decimals
                    symbol: 'ERROR',
                    name: `Failed to load: ${tokenAddress}`,
                    verified: false,
                    error: error.message
                };
            }
        });
    }

    async getTransactionDetails(signature) {
        try {
            const transaction = await this.connection.getParsedTransaction(signature, {
                maxSupportedTransactionVersion: 0
            });
            
            if (!transaction) return null;

            // Skip transactions that occurred before bot start
            if (transaction.blockTime < this.startTime) {
                return null;
            }

            // Look for token transfers in the transaction
            const tokenTransfers = [];
            if (transaction.meta && transaction.meta.postTokenBalances) {
                for (let i = 0; i < transaction.meta.postTokenBalances.length; i++) {
                    const postBalance = transaction.meta.postTokenBalances[i];
                    const preBalance = transaction.meta.preTokenBalances.find(
                        b => b.accountIndex === postBalance.accountIndex
                    );

                    if (preBalance) {
                        const tokenInfo = await this.getTokenInfo(postBalance.mint);
                        if (tokenInfo) {
                            const amount = (postBalance.uiTokenAmount.uiAmount - preBalance.uiTokenAmount.uiAmount);
                            tokenTransfers.push({
                                token: tokenInfo,
                                amount: amount,
                                type: amount > 0 ? 'RECEIVE' : 'SEND',
                                verified: tokenInfo.verified
                            });
                        }
                    }
                }
            }

            return {
                signature,
                timestamp: new Date(transaction.blockTime * 1000),
                sender: transaction.transaction.message.accountKeys[0].toString(),
                solAmount: transaction.meta.postBalances[0] - transaction.meta.preBalances[0],
                tokenTransfers,
                type: this.determineTransactionType(transaction),
                raw: transaction
            };
        } catch (error) {
            logger.logError(error, { 
                context: 'TransactionMonitor.getTransactionDetails',
                signature 
            });
            return null;
        }
    }

    determineTransactionType(transaction) {
        // This is a simple determination - you might want to add more sophisticated logic
        if (transaction.meta.postBalances[0] > transaction.meta.preBalances[0]) {
            return 'RECEIVE';
        } else {
            return 'SEND';
        }
    }

    async monitorWalletTransactions(address) {
        try {
            const walletName = this.getWalletName(address);
            const isValid = await this.validateWalletAddress(address);
            if (!isValid) return;

            // Add delay between monitoring different wallets
            await this.throttleRequest();

            // Get token balances with retry
            const walletAssets = require('./wallet-assets');
            const tokenBalances = await this.retryWithBackoff(async () => 
                walletAssets.getAllTokenBalances(address)
            );

            // Log wallet status
            if (address === Config.SOLANA_WALLET_ADDRESS) {
                logger.userWallet.info('Monitored Wallet Status', {
                    wallet: walletName,
                    address,
                    network: Config.SOLANA_NETWORK,
                    tokenHoldings: tokenBalances?.map(token => ({
                        name: token.name,
                        symbol: token.symbol,
                        tokenAddress: token.mint,
                        balance: token.balance
                    })) || []
                });
            } else {
                // Watched wallet logging
                logger.watchedWallet.info('Monitored Wallet Status', {
                    wallet: walletName,
                    address,
                    network: Config.SOLANA_NETWORK,
                    tokenHoldings: tokenBalances.map(token => ({
                        name: token.name,
                        symbol: token.symbol,
                        tokenAddress: token.mint,
                        balance: token.balance
                    }))
                });
            }

            const pubKey = new PublicKey(address);
            
            try {
                // Get recent transactions with retry and validation
                const signatures = await this.retryWithBackoff(async () => {
                    const response = await this.connection.getSignaturesForAddress(
                        pubKey,
                        { 
                            limit: 10,
                            until: this.startTime.toString()
                        }
                    );
                    
                    // Validate response
                    if (!response || !Array.isArray(response)) {
                        logger.warn('Invalid signature response format', {
                            wallet: walletName,
                            address,
                            responseType: typeof response
                        });
                        return [];
                    }
                    
                    return response;
                });

                // Increase delay if we got rate limited
                if (signatures.length === 0) {
                    this.requestDelay = Math.min(this.requestDelay * 2, 5000); // Max 5s delay
                    logger.debug(`Increased request delay to ${this.requestDelay}ms`);
                } else {
                    this.requestDelay = Math.max(500, this.requestDelay * 0.8); // Decrease delay but not below 500ms
                }

                // Process transactions with delay between each
                for (const sig of signatures) {
                    if (!sig || !sig.signature) {
                        logger.warn('Invalid signature object', { sig });
                        continue;
                    }

                    if (this.watchedTransactions.has(sig.signature)) continue;
                    
                    await this.throttleRequest();
                    const txDetails = await this.getTransactionDetails(sig.signature);
                    
                    if (txDetails) {
                        this.watchedTransactions.set(sig.signature, txDetails);
                        
                        const logData = {
                            wallet: walletName,
                            address,
                            network: Config.SOLANA_NETWORK,
                            signature: sig.signature,
                            type: txDetails.type,
                            solAmount: `${txDetails.solAmount / 1e9} SOL`,
                            timestamp: txDetails.timestamp,
                            timeSinceBotStart: `${((Date.now() / 1000) - this.startTime).toFixed(2)} seconds`,
                            tokenTransfers: txDetails.tokenTransfers.map(transfer => ({
                                token: transfer.token.name,
                                symbol: transfer.token.symbol,
                                tokenAddress: transfer.token.address,
                                amount: transfer.amount,
                                type: transfer.type,
                                verified: transfer.verified
                            }))
                        };

                        // Log to appropriate file based on wallet type
                        if (address === Config.SOLANA_WALLET_ADDRESS) {
                            logger.userWallet.info('New transaction detected', logData);
                        } else {
                            logger.watchedWallet.info('New transaction detected', logData);
                        }
                    }
                }
            } catch (error) {
                if (error.message.includes('Invalid param')) {
                    logger.warn(`No recent transactions found`, {
                        wallet: walletName,
                        network: Config.SOLANA_NETWORK
                    });
                } else {
                    throw error;
                }
            }
        } catch (error) {
            if (!error.message.includes('429')) {
                logger.logError(error, { 
                    context: 'TransactionMonitor.monitorWalletTransactions',
                    wallet: this.getWalletName(address),
                    address
                });
            }
        }
    }

    // Helper method to reset start time (useful for testing)
    resetStartTime() {
        this.startTime = Date.now() / 1000;
        this.watchedTransactions.clear();
        logger.info('Transaction monitor reset', { 
            newStartTime: new Date(this.startTime * 1000) 
        });
    }

    // Update the start method to add delay between wallet monitoring
    async start() {
        const wallets = walletConfig.getActiveWallets();
        for (const wallet of wallets) {
            await this.throttleRequest(); // Add delay between each wallet
            await this.monitorWalletTransactions(wallet.address);
        }
    }
}

// Create and initialize the monitor
const monitor = new TransactionMonitor();
monitor.initialize().catch(error => {
    logger.error('Failed to initialize Transaction Monitor', {
        error: error.message
    });
});

module.exports = monitor; 