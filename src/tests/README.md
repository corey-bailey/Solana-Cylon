# Test Suite Documentation

This directory contains test files for the Solana monitoring application. Each test file focuses on specific functionality and can be run individually or as part of the complete test suite.

## Running Tests

### Complete Test Suite
```bash
npm test
```

### Individual Test Files
```bash
# Run transaction monitor tests
npm run test:monitor

# Run setup tests
npm run test:setup

# Run token info tests
npm run test:token
```

## Test Files

### transaction-monitor.test.js
Tests the core transaction monitoring functionality.

**Key Test Cases:**
- Initialization and configuration
- Request queue management and rate limiting
- Wallet address validation
- Transaction processing and parsing
- Retry mechanism for failed operations
- Resource cleanup

**Run with:**
```bash
npm run test:monitor
```

### setup.test.js
Validates the application's setup and environment configuration.

**Key Test Cases:**
- Environment variable loading
- Test constants validation
- RPC connection verification
- Configuration file loading

**Run with:**
```bash
npm run test:setup
```

### token-info.test.js
Tests token-related functionality and information retrieval.

**Key Test Cases:**
- Token symbol resolution
- USDC token validation
- BONK token validation
- Cache functionality
- Invalid token handling

**Run with:**
```bash
npm run test:token
```

## Test Environment

Tests run against the following environment:
- Network: Mainnet Beta (for token tests) / Devnet (for transaction tests)
- RPC URL: Configurable via .env.test
- Test Wallet: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263

## Writing New Tests

When adding new tests:
1. Create a new test file with the `.test.js` extension
2. Add a new npm script in package.json to run the test
3. Update this README with the new test information
4. Ensure tests clean up after themselves

## Test Configuration

Tests use a separate environment configuration file (.env.test) to avoid interfering with production settings. Make sure to:
1. Copy .env.example to .env.test
2. Update the values in .env.test for your test environment
3. Never commit sensitive information in test files

## Debugging Tests

To run tests with debugger:
```bash
# Run specific test with node debugger
node --inspect-brk node_modules/.bin/mocha src/tests/your-test-file.test.js

# Run with increased timeout
npm run test:monitor -- --timeout 15000
``` 