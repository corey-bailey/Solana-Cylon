import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import pkg from '@metaplex-foundation/mpl-token-metadata';
const { Metadata } = pkg;
import logger from '../utils/logger.js';
import config from '../config/config.js';
import walletConfig from './wallet-config.js';

class TransactionMonitor {
    constructor(options = {}) {
        this.isTestMode = options.isTestMode || false;
        this.connection = new Connection(config.SOLANA_RPC_URL);
        this.watchedTransactions = new Map();
        this.startTime = 0; // Initialize to 0
        this.lastRequestTime = 0;
        this.requestDelay = 60000;   // One request per minute
        this.maxRequestsPerMinute = 6;
        this.requestCount = 0;
        this.requestResetTime = Date.now();
        this.totalRequests = 0;
        this.requestsThisMinute = 0;
        this.lastCounterUpdate = Date.now();
        this.requestQueue = [];
        this.hasInitialCheck = false;  // Track if initial check is done
        
        logger.info('Transaction Monitor Started', {
            environment: process.env.NODE_ENV || 'development',
            network: config.SOLANA_NETWORK,
            rpcUrl: config.SOLANA_RPC_URL,
            startTime: new Date(this.startTime * 1000).toISOString(),
            checkInterval: '60 seconds'
        });

        // In test mode, we process requests immediately and don't start intervals
        if (this.isTestMode) {
            this.processRequest = this.processRequestImmediate;
        } else {
            this.processRequest = this.processRequestQueued;
            this.startRequestCounter();
            this.startRequestProcessor();
        }
    }

    // Add request counter display
    startRequestCounter() {
        if (this.isTestMode) return; // Don't start counter in test mode
        
        this.counterInterval = setInterval(() => {
            const now = Date.now();
            const timeWindow = ((now - this.lastCounterUpdate) / 1000).toFixed(0);
            
            process.stdout.write(`\r\x1b[K`);
            process.stdout.write(
                `RPC Requests - Total: ${this.totalRequests}, ` +
                `Last ${timeWindow}s: ${this.requestsThisMinute}, ` +
                `Rate: ${(this.requestsThisMinute / (timeWindow || 1)).toFixed(1)}/s, ` +
                `Queue: ${this.requestQueue.length}`
            );

            if (now - this.lastCounterUpdate >= 60000) {
                this.requestsThisMinute = 0;
                this.lastCounterUpdate = now;
            }
        }, 1000);
    }

    // Update request processor to handle initial check
    startRequestProcessor() {
        this.processorInterval = setInterval(async () => {
            if (this.requestQueue.length > 0) {
                const batch = this.requestQueue.splice(0, 1);
                for (const request of batch) {
                    try {
                        const result = await request.operation();
                        request.resolve(result);
                    } catch (error) {
                        request.reject(error);
                    }
                }
                this.totalRequests++;
                this.requestsThisMinute++;
            }
        }, this.hasInitialCheck ? this.requestDelay : 5000); // Faster processing for initial check
    }

    // Process request immediately (for tests)
    async processRequestImmediate(operation) {
        try {
            const result = await operation();
            this.totalRequests++;
            this.requestsThisMinute++;
            return result;
        } catch (error) {
            throw error;
        }
    }

    // Process request via queue (for production)
    async processRequestQueued(operation) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ operation, resolve, reject });
        });
    }

    // Update queueRequest to use the appropriate process method
    async queueRequest(operation) {
        return this.processRequest(operation);
    }

    // Update retry with queued requests
    async retryWithBackoff(operation, maxRetries = 3, initialDelay = 5000) {
        let retries = 0;
        let delay = initialDelay;

        while (retries < maxRetries) {
            try {
                return await this.queueRequest(operation);
            } catch (error) {
                retries++;
                if (error.message.includes('429')) {
                    const waitTime = delay * Math.pow(2, retries);
                    logger.debug(`Rate limited, waiting ${waitTime}ms before retry ${retries}/${maxRetries}`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    delay = Math.min(delay * 2, 15000);
                } else if (retries === maxRetries) {
                    throw error;
                }
            }
        }
        return null;
    }

    async initialize() {
        this.startTime = Date.now() / 1000;
        
        try {
            const version = await this.connection.getVersion();
            logger.info('Transaction Monitor Connected', {
                version: version['solana-core'],
                network: config.SOLANA_NETWORK,
                rpcUrl: config.SOLANA_RPC_URL,
                featureSet: version['feature-set']
            });
        } catch (error) {
            logger.error('Failed to connect to Solana network', {
                error: error.message,
                network: config.SOLANA_NETWORK,
                rpcUrl: config.SOLANA_RPC_URL
            });
            throw error;
        }

        return this;
    }

    getWalletName(address) {
        const wallet = walletConfig.wallets.get(address);
        return wallet ? wallet.name : 'Unknown Wallet';
    }

    async validateWalletAddress(address) {
        try {
            // First validate the address format
            if (!address || typeof address !== 'string') {
                logger.warn('Invalid wallet address format', { address });
                return false;
            }

            try {
                const pubKey = new PublicKey(address);
                if (!PublicKey.isOnCurve(pubKey.toBuffer())) {
                    logger.warn('Invalid wallet address: not on ed25519 curve', { address });
                    return false;
                }
            } catch (error) {
                logger.warn('Invalid wallet address format', { 
                    address,
                    error: error.message 
                });
                return false;
            }

            // Then check if account exists
            const pubKey = new PublicKey(address);
            const accountInfo = await this.connection.getAccountInfo(pubKey);
            const walletName = this.getWalletName(address);
            
            if (accountInfo === null) {
                logger.warn(`Wallet not found on ${config.SOLANA_NETWORK}`, {
                    wallet: walletName,
                    address,
                    network: config.SOLANA_NETWORK
                });
                return false;
            }
            
            return true;
        } catch (error) {
            logger.warn(`Failed to validate wallet address`, {
                address,
                wallet: this.getWalletName(address),
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
            logger.debug('Fetching transaction details', {
                signature,
                rpcUrl: config.SOLANA_RPC_URL,
                options: {
                    maxSupportedTransactionVersion: 0
                }
            });

            const transaction = await this.connection.getParsedTransaction(signature, {
                maxSupportedTransactionVersion: 0
            });
            
            logger.debug('Raw transaction response', {
                signature,
                found: !!transaction,
                blockTime: transaction?.blockTime,
                numAccounts: transaction?.transaction?.message?.accountKeys?.length
            });

            if (!transaction) {
                logger.debug('Transaction not found', { signature });
                return null;
            }

            // Skip transactions that occurred before bot start
            if (transaction.blockTime < this.startTime) {
                logger.debug('Transaction occurred before bot start', {
                    signature,
                    txTime: transaction.blockTime,
                    botStartTime: this.startTime
                });
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

            // Process transaction details...
            const details = {
                signature,
                timestamp: new Date(transaction.blockTime * 1000),
                sender: transaction.transaction.message.accountKeys[0].toString(),
                solAmount: transaction.meta.postBalances[0] - transaction.meta.preBalances[0],
                tokenTransfers,
                type: this.determineTransactionType(transaction),
                raw: transaction
            };

            logger.debug('Processed transaction details', {
                signature,
                timestamp: details.timestamp,
                sender: details.sender,
                solAmount: details.solAmount,
                type: details.type
            });

            return details;

        } catch (error) {
            logger.error('Failed to get transaction details', { 
                context: 'TransactionMonitor.getTransactionDetails',
                signature,
                error: error.message,
                stack: error.stack
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
            
            // Validate address before proceeding
            const isValid = await this.validateWalletAddress(address);
            if (!isValid) return;

            // Get recent transactions
            await this.queueRequest(async () => {
                try {
                    const pubKey = new PublicKey(address);
                    
                    // Get signatures without the until parameter first
                    const signatures = await this.connection.getSignaturesForAddress(
                        pubKey,
                        { 
                            limit: 5,
                            commitment: 'confirmed'
                        }
                    );

                    if (!signatures || !Array.isArray(signatures)) {
                        logger.debug('No recent transactions found', {
                            wallet: walletName,
                            address
                        });
                        return;
                    }

                    // Filter signatures by timestamp after fetching
                    const validSignatures = signatures.filter(sig => 
                        sig.blockTime && sig.blockTime >= this.startTime
                    );

                    // Process valid signatures
                    for (const sig of validSignatures.slice(0, 3)) {
                        if (!sig || !sig.signature) {
                            logger.debug('Invalid signature object', { sig });
                            continue;
                        }

                        if (this.watchedTransactions.has(sig.signature)) continue;

                        const txDetails = await this.getTransactionDetails(sig.signature);
                        if (txDetails) {
                            this.watchedTransactions.set(sig.signature, txDetails);
                            
                            const logData = {
                                wallet: walletName,
                                address,
                                network: config.SOLANA_NETWORK,
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

                            if (address === config.SOLANA_WALLET_ADDRESS) {
                                logger.userWallet.info('New transaction detected', logData);
                            } else {
                                logger.watchedWallet.info('New transaction detected', logData);
                            }
                        }
                    }
                } catch (error) {
                    logger.warn('Error fetching transactions', {
                        wallet: walletName,
                        address,
                        error: error.message,
                        stack: error.stack
                    });
                }
            });

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

    // Add method for initial check
    async performInitialCheck(wallets) {
        logger.info('Performing initial wallet check...');
        
        for (const wallet of wallets) {
            await this.queueRequest(async () => {
                await this.monitorWalletTransactions(wallet.address);
            });
        }

        this.hasInitialCheck = true;
        logger.info('Initial wallet check completed');
        
        // Reset processor interval to one minute
        if (this.processorInterval) {
            clearInterval(this.processorInterval);
        }
        this.startRequestProcessor();
    }

    // Update start method to handle initial check
    async start() {
        const wallets = walletConfig.getActiveWallets();
        
        // Perform initial check
        await this.performInitialCheck(wallets);

        // Then set up regular monitoring
        return new Promise((resolve) => {
            this.monitoringInterval = setInterval(async () => {
                for (const wallet of wallets) {
                    await this.queueRequest(async () => {
                        await this.monitorWalletTransactions(wallet.address);
                    });
                }
            }, this.requestDelay);
            resolve();
        });
    }

    cleanup() {
        // Clear all intervals
        const intervals = [
            'counterInterval',
            'processorInterval',
            'monitoringInterval'
        ];

        intervals.forEach(interval => {
            if (this[interval]) {
                clearInterval(this[interval]);
                this[interval] = undefined;
            }
        });

        // Clear queues and counters
        this.requestQueue = [];
        this.requestsThisMinute = 0;
        this.totalRequests = 0;
        this.watchedTransactions.clear();

        // Clear any console output
        if (!this.isTestMode) {
            process.stdout.write('\r\x1b[K');
        }
    }
}

// Create and export instances
export const monitor = new TransactionMonitor();
export const testMonitor = new TransactionMonitor({ isTestMode: true });
export default monitor; 