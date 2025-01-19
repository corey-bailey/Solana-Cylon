import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration class
class Config:
    SOLANA_NETWORK = os.getenv('SOLANA_NETWORK', 'devnet')
    SOLANA_RPC_URL = os.getenv('SOLANA_RPC_URL', 'https://api.devnet.solana.com')
    SOLANA_PRIVATE_KEY = os.getenv('SOLANA_PRIVATE_KEY')
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'debug') 