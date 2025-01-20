const { Connection } = import ('@solana/web3.js');
const connection = new Connection('https://api.mainnet-beta.solana.com');
const tokenInfo = await connection.getParsedAccountInfo(new PublicKey(USDC_ADDRESS));
console.log(tokenInfo);