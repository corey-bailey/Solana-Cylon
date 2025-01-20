import { expect } from 'chai';
import { Connection, PublicKey } from '@solana/web3.js';
import TokenInfo from '../services/token-info.js';
import Config from '../config/config.js';

describe('Token Info Service', () => {
    let originalRpcUrl;
    
    before(async () => {
        // Store original RPC URL
        originalRpcUrl = Config.SOLANA_RPC_URL;
        // Use mainnet for tests
        Config.SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
        // Create new instance with mainnet connection
        TokenInfo.connection = new Connection(Config.SOLANA_RPC_URL);
    });

    after(() => {
        Config.SOLANA_RPC_URL = originalRpcUrl;
        TokenInfo.connection = new Connection(Config.SOLANA_RPC_URL);
    });

    // Known tokens for testing
    const USDC_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const BONK_ADDRESS = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
    const INVALID_ADDRESS = 'invalid_address';

    describe('getTokenSymbol', () => {
        it('should return USDC for USDC token address', async function() {
            this.timeout(5000);
            const symbol = await TokenInfo.getTokenSymbol(USDC_ADDRESS);
            expect(symbol).to.equal('USDC');
        });

        it('should return BONK for BONK token address', async function() {
            this.timeout(5000);
            const symbol = await TokenInfo.getTokenSymbol(BONK_ADDRESS);
            expect(symbol).to.equal('BONK');
        });

        it('should return cached result for repeated queries', async function() {
            this.timeout(5000);
            await TokenInfo.getTokenSymbol(USDC_ADDRESS);
            
            const startTime = Date.now();
            const symbol = await TokenInfo.getTokenSymbol(USDC_ADDRESS);
            const duration = Date.now() - startTime;
            
            expect(symbol).to.equal('USDC');
            expect(duration).to.be.lessThan(10);
        });

        it('should return Unknown for invalid token address', async () => {
            const symbol = await TokenInfo.getTokenSymbol(INVALID_ADDRESS);
            expect(symbol).to.equal('Unknown');
        });

        it('should handle null or undefined input', async () => {
            const symbol1 = await TokenInfo.getTokenSymbol(null);
            const symbol2 = await TokenInfo.getTokenSymbol(undefined);
            
            expect(symbol1).to.equal('Unknown');
            expect(symbol2).to.equal('Unknown');
        });
    });
}); 