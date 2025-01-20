import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import logger from '../utils/logger.js';
import Config from '../config/config.js';

// Known token symbols
const KNOWN_TOKENS = {
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
    // Add more known tokens as needed
};

class TokenInfo {
    constructor() {
        this.connection = new Connection(Config.SOLANA_RPC_URL);
        this.cache = new Map();
    }

    async getTokenSymbol(tokenAddress) {
        try {
            if (!tokenAddress) return 'Unknown';
            
            // Check cache first
            if (this.cache.has(tokenAddress)) {
                return this.cache.get(tokenAddress);
            }

            // Check known tokens
            if (KNOWN_TOKENS[tokenAddress]) {
                this.cache.set(tokenAddress, KNOWN_TOKENS[tokenAddress]);
                return KNOWN_TOKENS[tokenAddress];
            }

            try {
                const mintPubkey = new PublicKey(tokenAddress);
                const accountInfo = await this.connection.getParsedAccountInfo(mintPubkey);

                if (!accountInfo?.value) {
                    logger.debug(`No account info found for token ${tokenAddress}`);
                    return 'Unknown';
                }

                const parsedData = accountInfo.value.data.parsed;
                if (parsedData.type !== 'mint') {
                    logger.debug(`Not a token mint: ${tokenAddress}`);
                    return 'Unknown';
                }

                // For now, just use a shortened version of the address as symbol
                const symbol = `${tokenAddress.slice(0, 4)}...${tokenAddress.slice(-4)}`;
                this.cache.set(tokenAddress, symbol);
                return symbol;

            } catch (error) {
                logger.debug(`Error processing token ${tokenAddress}:`, error.message);
                return 'Unknown';
            }

        } catch (error) {
            logger.debug(`Failed to fetch symbol for token ${tokenAddress}`, { 
                error: error.message 
            });
            return 'Unknown';
        }
    }
}

export default new TokenInfo();