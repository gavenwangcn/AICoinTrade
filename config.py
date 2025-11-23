# Configuration Example

# Server
HOST = '0.0.0.0'
PORT = 5002
DEBUG = False

# Database
DATABASE_PATH = 'trading_bot.db'

# Trading
AUTO_TRADING = True
TRADING_INTERVAL = 180  # seconds

# Initial Coin Universe (symbol, name, exchange, coingecko_id)
INITIAL_COINS = [
    ('BTC', 'Bitcoin', 'CRYPTO', 'bitcoin'),
    ('ETH', 'Ethereum', 'CRYPTO', 'ethereum'),
    ('SOL', 'Solana', 'CRYPTO', 'solana'),
    ('BNB', 'Binance Coin', 'CRYPTO', 'binancecoin'),
    ('XRP', 'Ripple', 'CRYPTO', 'ripple')
]

# Market Data
MARKET_API_CACHE = 5  # seconds

# Refresh Rates (frontend)
MARKET_REFRESH = 5000  # ms
PORTFOLIO_REFRESH = 10000  # ms
TRADE_FEE_RATE = 0.001  # 交易费率：0.1%（双向收费）

# Logging Configuration
# 日志级别: DEBUG, INFO, WARNING, ERROR, CRITICAL
# 默认级别为 INFO
LOG_LEVEL = 'INFO'  # 可选值: DEBUG, INFO, WARNING, ERROR, CRITICAL
LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
LOG_DATE_FORMAT = '%Y-%m-%d %H:%M:%S'

