import { expect } from 'chai';
import dotenv from 'dotenv';
import { PublicKey } from '@solana/web3.js';

describe('Test Setup', () => {
    before(() => {
        // Load test environment
        dotenv.config({ path: '.env.development' });
    });

    describe('Environment Configuration', () => {
        it('should load environment variables', () => {
            expect(process.env.NODE_ENV).to.exist;
            expect(process.env.SOLANA_RPC_URL).to.exist;
        });
    });

    describe('Test Constants', () => {
        it('should validate TEST_WALLET address', () => {
            const TEST_WALLET = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
            expect(() => new PublicKey(TEST_WALLET)).to.not.throw();
        });

        it('should validate TEST_TX signature', () => {
            const TEST_TX = '4HPQh7qZgvvPajEirD6RwVNHwz5girhHCYLgY9DeXrZGXAGsUWmwXKigVwkwjqzMWTyEhQYbVwrNxHXPrHFCvXPu';
            expect(TEST_TX).to.match(/^[A-Za-z0-9]{88}$/);
        });
    });

    describe('RPC Connection', () => {
        it('should have valid mainnet RPC URL', () => {
            const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
            expect(MAINNET_RPC).to.be.a('string');
            expect(MAINNET_RPC).to.match(/^https?:\/\/.+/);
        });
    });
}); 