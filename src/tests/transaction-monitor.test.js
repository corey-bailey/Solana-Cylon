import { expect } from 'chai';
import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { testMonitor as monitor } from '../services/transaction-monitor.js';
import config from '../config/config.js';

// Create mock data
const mockData = {
    TEST_WALLET: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    MAINNET_RPC: 'https://api.mainnet-beta.solana.com'
};

// Mock wallet config
const mockWalletConfig = {
    wallets: new Map([
        [mockData.TEST_WALLET, {
            name: 'Test Wallet',
            address: mockData.TEST_WALLET,
            active: true
        }]
    ]),
    getActiveWallets() {
        return Array.from(this.wallets.values());
    }
};

// Mock the wallet-config dependency
monitor.getWalletName = (address) => {
    const wallet = mockWalletConfig.wallets.get(address);
    return wallet ? wallet.name : 'Unknown Wallet';
};

describe('Transaction Monitor Service', () => {
    // Setup before all tests
    before(async () => {
        config.SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
        await monitor.initialize();
    });

    // Cleanup after each test
    afterEach(async () => {
        // Clear queues and reset counters
        monitor.requestQueue = [];
        monitor.requestsThisMinute = 0;
        monitor.totalRequests = 0;
        monitor.watchedTransactions.clear();
        
        // Wait for any pending operations
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Cleanup after all tests
    after(async () => {
        monitor.cleanup();
        // Wait for intervals to clear
        await new Promise(resolve => setTimeout(resolve, 200));
    });

    describe('initialization', () => {
        it('should initialize with correct configuration', () => {
            expect(monitor.connection).to.exist;
            expect(monitor.watchedTransactions).to.exist;
            expect(monitor.startTime).to.be.a('number');
        });
    });

    describe('request management', () => {
        it('should process requests in queue', async function() {
            this.timeout(5000);
            const result = await monitor.queueRequest(async () => 'test');
            expect(result).to.equal('test');
        });

        it('should handle multiple requests', async function() {
            this.timeout(5000);
            const results = await Promise.all([
                monitor.queueRequest(async () => 1),
                monitor.queueRequest(async () => 2),
                monitor.queueRequest(async () => 3)
            ]);
            expect(results).to.deep.equal([1, 2, 3]);
        });
    });

    describe('wallet monitoring', () => {
        const TEST_WALLET = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

        it('should validate wallet addresses', async () => {
            const isValid = await monitor.validateWalletAddress(TEST_WALLET);
            expect(isValid).to.be.true;
        });

        it('should reject invalid addresses', async () => {
            const isValid = await monitor.validateWalletAddress('invalid');
            expect(isValid).to.be.false;
        });
    });

    describe('transaction processing', () => {
        const TEST_TX = 'fZ3M4cXyAYvMtR1gt7ztaHeUGaRc64DAaaWKxaMBADoARKQFXLxBoh3E9YP2v5P9K8W4fv64VVwJG8Buxitii2C';

        beforeEach(async function() {
            this.timeout(10000);
            console.log('\nSetting up transaction test...');
            
            // Reset start time to ensure we catch historical transactions
            monitor.startTime = 0;
            console.log('Reset start time to:', monitor.startTime);
            
            // Use mainnet for transaction tests
            config.SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
            monitor.connection = new Connection(config.SOLANA_RPC_URL);
            console.log('Using RPC URL:', config.SOLANA_RPC_URL);
        });

        afterEach(async () => {
            console.log('\nCleaning up transaction test...');
            // Reset connection
            config.SOLANA_RPC_URL = mockData.MAINNET_RPC;
            monitor.connection = new Connection(config.SOLANA_RPC_URL);
            monitor.watchedTransactions.clear();
            console.log('Reset RPC URL:', config.SOLANA_RPC_URL);
        });

        it('should process valid transactions', async function() {
            this.timeout(15000);
            console.log('\nStarting transaction test...');
            console.log('Test transaction signature:', TEST_TX);
            
            const details = await monitor.queueRequest(async () => {
                console.log('\nMaking RPC request:');
                console.log('- Method: getParsedTransaction');
                console.log('- Signature:', TEST_TX);
                console.log('- Options:', JSON.stringify({
                    maxSupportedTransactionVersion: 0
                }, null, 2));

                // First get raw transaction
                const rawTx = await monitor.connection.getParsedTransaction(TEST_TX, {
                    maxSupportedTransactionVersion: 0
                });
                
                console.log('\nRaw Transaction Response:');
                console.log('- Found:', !!rawTx);
                if (rawTx) {
                    console.log('- Block Time:', rawTx.blockTime);
                    console.log('- Accounts:', rawTx.transaction?.message?.accountKeys?.length);
                    console.log('- Start Time:', monitor.startTime);
                    console.log('- Is Historical:', rawTx.blockTime < monitor.startTime);
                }

                const result = await monitor.getTransactionDetails(TEST_TX);
                
                console.log('\nProcessed Response:');
                if (result === null) {
                    console.log('Response: null (transaction not found or historical)');
                } else {
                    console.log('- Status: Success');
                    console.log('- Signature:', result.signature);
                    console.log('- Timestamp:', result.timestamp);
                    console.log('- SOL Amount:', result.solAmount);
                    console.log('- Token Transfers:', result.tokenTransfers?.length || 0);
                }
                return result;
            });

            console.log('\nTest Results:');
            console.log('Received details:', details ? 'yes' : 'no');
            
            expect(details, 'Transaction details should not be null').to.not.be.null;
            if (details) {
                console.log('\nValidating transaction details...');
                console.log('- Signature:', details.signature);
                console.log('- Timestamp:', details.timestamp);
                console.log('- SOL Amount:', details.solAmount);
                
                expect(details.signature, 'Transaction should have a signature').to.equal(TEST_TX);
                expect(details.timestamp, 'Transaction should have a timestamp').to.be.instanceOf(Date);
                expect(details.solAmount, 'Transaction should have a SOL amount').to.be.a('number');
            }
        });

        it('should handle invalid transactions', async () => {
            const details = await monitor.getTransactionDetails('invalid');
            expect(details).to.be.null;
        });
    });

    describe('retry mechanism', () => {
        it('should retry failed operations', async function() {
            this.timeout(5000);
            let attempts = 0;
            const result = await monitor.retryWithBackoff(async () => {
                attempts++;
                if (attempts === 1) throw new Error('First attempt');
                return 'success';
            }, 2, 100); // Shorter delay for tests
            expect(result).to.equal('success');
            expect(attempts).to.equal(2);
        });

        it('should handle permanent failures', async function() {
            this.timeout(5000);
            const error = await monitor.retryWithBackoff(async () => {
                throw new Error('Permanent error');
            }, 2, 100).catch(e => e);
            expect(error).to.be.an('error');
            expect(error.message).to.equal('Permanent error');
        });
    });

    describe('cleanup', () => {
        it('should clean up resources', async function() {
            this.timeout(5000);
            
            // First clear any existing intervals
            monitor.cleanup();
            
            // Start fresh intervals for testing
            monitor.startRequestProcessor();
            monitor.startRequestCounter();
            
            // Verify they're running
            expect(monitor.processorInterval).to.exist;
            
            // Perform cleanup
            monitor.cleanup();
            
            // Wait for cleanup
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Verify all intervals are cleared
            expect(monitor.processorInterval).to.be.undefined;
            expect(monitor.counterInterval).to.be.undefined;
            expect(monitor.monitoringInterval).to.be.undefined;
        });
    });
}); 