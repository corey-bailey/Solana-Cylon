# Solana-Cylon Trading Bot

A macOS-based trading bot that automatically copies trades from specified Solana blockchain wallets in real-time. The bot monitors selected wallets for trading activity and replicates their trades on your account using configurable strategies.

## Features

- Real-time monitoring of specified Solana wallets
- Automated trade replication with configurable risk levels
- CSV-based wallet configuration
- Secure API key storage using macOS Keychain
- Comprehensive logging with macOS Console integration
- Automatic error detection and trading halt mechanisms

## Prerequisites

- macOS 10.15 or later
- Node.js 16.x or later
- npm 8.x or later
- A Solana wallet with funds
- Solana RPC endpoint (default: devnet)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/corey-bailey/solana-cylon.git
cd solana-cylon
```

2. Install dependencies:
```bash
npm install
```

3. Create and configure your environment variables:
```bash
cp .env.example .env
```
Edit `.env` with your settings:
```env
SOLANA_NETWORK=devnet  # Use mainnet-beta for live trading
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PRIVATE_KEY=your_private_key_here
LOG_LEVEL=debug
```

4. Configure wallets to track in `data/wallets.csv`:
```csv
address,name,active,risk_level,max_trade_size
9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin,Wallet1,true,high,1000
HSfwVfB6Xw1m7edbEm5TU7JGgXkPXXzB5pz4y4aFvKKd,Wallet2,true,medium,500
```

## Usage

1. Validate your wallet configuration:
```bash
npm run validate-csv
```

2. Run the bot in development mode (with auto-reload):
```bash
npm run dev
```

3. Run the bot in production mode:
```bash
npm start
```

## Monitoring Logs

View logs using macOS Console.app:
```bash
# View recent logs
log show --predicate 'processImagePath contains "solana-trade-bot"' --last 1h

# Stream logs in real-time
log stream --predicate 'processImagePath contains "solana-trade-bot"'
```

Or check log files directly:
```bash
tail -f logs/combined.log  # All logs
tail -f logs/error.log    # Error logs only
```

## Configuration

### Wallet Configuration (wallets.csv)
- `address`: Solana wallet address to monitor
- `name`: Identifier for the wallet
- `active`: true/false to enable/disable monitoring
- `risk_level`: high/medium/low affects trade sizing
- `max_trade_size`: Maximum trade size in SOL

### Environment Variables
- `SOLANA_NETWORK`: Solana network to use (devnet/mainnet-beta)
- `SOLANA_RPC_URL`: RPC endpoint URL
- `SOLANA_PRIVATE_KEY`: Your wallet's private key
- `LOG_LEVEL`: Logging detail level (debug/info/warn/error)

## Security Considerations

- Store your private key securely
- Start with small trade sizes on devnet
- Monitor logs regularly for unusual activity
- Use different wallets for testing and production

## Development

```bash
# Run tests
npm test

# Validate CSV configuration
npm run validate-csv

# Run with auto-reload (development)
npm run dev
```

## Project Structure
```
solana-trade-bot/
├── src/                     # Source code
│   ├── config/             # Configuration files
│   ├── services/           # Core services
│   ├── utils/              # Utility functions
│   └── index.js            # Main bot file
├── data/                   # Data files
├── logs/                   # Log files
└── tests/                  # Test files
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

[MIT License](LICENSE)

## Disclaimer

This bot is for educational purposes only. Trading cryptocurrencies carries significant risks. Always test thoroughly on devnet before using real funds.

   