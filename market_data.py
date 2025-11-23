"""
Market data module - integrates multiple cryptocurrency APIs with intelligent fallback.
Supports: Binance, CoinGecko, CoinCap, CryptoCompare, CoinMarketCap
"""
import os
import time
import json
import random
from datetime import datetime, time as dt_time
from typing import Dict, List, Optional, Tuple

import requests
from requests.exceptions import SSLError, RequestException, ProxyError, ConnectionError

try:
    import config as app_config
except ImportError:  # pragma: no cover
    import config_example as app_config


class MarketDataFetcher:
    """Fetch real-time market data from multiple cryptocurrency APIs with intelligent fallback"""

    def __init__(self, db, jq_username: str = None, jq_password: str = None):
        self.db = db
        self._cache = {}
        self._cache_time = {}
        self._cache_duration = getattr(app_config, 'MARKET_API_CACHE', 5)
        
        self._last_market_open_state: bool = False
        self._last_live_prices: Dict[str, Dict] = {}
        self._last_live_date: Optional[datetime.date] = None

        # Multiple API providers configuration (must be defined before _init_sessions)
        self.api_providers = {
            'binance': {
                'base_url': 'https://api.binance.com/api/v3',
                'enabled': True,
                'priority': 1,  # Highest priority
                'min_interval': 0.1,  # 100ms between requests
                'last_request_time': 0,
                'timeout': 8,
                'max_retries': 2
            },
            'coingecko': {
                'base_url': 'https://api.coingecko.com/api/v3',
                'enabled': True,
                'priority': 2,
                'min_interval': 1.5,  # 1.5 seconds (40 req/min)
                'last_request_time': 0,
                'timeout': 15,
                'max_retries': 2
            },
            'coincap': {
                'base_url': 'https://api.coincap.io/v2',
                'enabled': True,
                'priority': 3,
                'min_interval': 0.5,  # 0.5 seconds
                'last_request_time': 0,
                'timeout': 10,
                'max_retries': 2
            },
            'cryptocompare': {
                'base_url': 'https://min-api.cryptocompare.com/data',
                'enabled': True,
                'priority': 4,
                'min_interval': 0.2,  # 0.2 seconds
                'last_request_time': 0,
                'timeout': 10,
                'max_retries': 2
            },
            'coinmarketcap': {
                'base_url': 'https://pro-api.coinmarketcap.com/v1',
                'enabled': False,  # Requires API key, disabled by default
                'priority': 5,
                'min_interval': 1.0,
                'last_request_time': 0,
                'timeout': 10,
                'max_retries': 2,
                'api_key': os.getenv('COINMARKETCAP_API_KEY', '')
            }
        }
        
        # Historical data cache
        self._historical_cache = {}
        self._historical_cache_duration = 300  # 5 minutes
        
        # API health tracking
        self._api_health = {name: {'success_count': 0, 'fail_count': 0, 'last_success': 0} 
                           for name in self.api_providers.keys()}
        
        # Create separate sessions for each API to avoid connection issues (after api_providers is defined)
        self.sessions = {}
        self._init_sessions()

    def _init_sessions(self):
        """Initialize HTTP sessions for each API provider"""
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
        }
        
        for api_name in self.api_providers.keys():
            session = requests.Session()
            session.headers.update(headers)
            # Disable proxy to avoid connection issues
            session.proxies = {
                'http': None,
                'https': None
            }
            self.sessions[api_name] = session

    def _get_configured_coins(self) -> List[Dict]:
        """Get configured coins from database"""
        coins = self.db.get_coin_configs()
        if not coins:
            print('[WARN] No coins configured. Please add coins via configuration UI.')
        return coins

    def _parse_time_setting(self, value: str) -> dt_time:
        """Parse time setting string to time object"""
        try:
            parts = [int(p) for p in value.split(':')]
            while len(parts) < 3:
                parts.append(0)
            return dt_time(parts[0], parts[1], parts[2])
        except Exception:
            return dt_time(0, 0, 0)

    def _get_trading_window_bounds(self) -> (dt_time, dt_time):
        """Get trading window bounds from settings"""
        settings = self.db.get_settings()
        start_str = settings.get('auto_trading_start', '00:00:00')
        end_str = settings.get('auto_trading_end', '23:59:59')
        return self._parse_time_setting(start_str), self._parse_time_setting(end_str)

    def is_within_trading_window(self, current_dt: Optional[datetime] = None) -> bool:
        """Check if current time is within trading window"""
        now = current_dt or datetime.now()
        now_time = now.time()
        start_time, end_time = self._get_trading_window_bounds()
        if start_time <= end_time:
            return start_time <= now_time <= end_time
        return now_time >= start_time or now_time <= end_time

    def _format_stored_prices(self, stored_prices: Dict[str, Dict], symbols: Optional[List[str]] = None) -> Dict[str, Dict]:
        """Format stored prices for display"""
        coin_map = {coin['symbol']: coin for coin in self._get_configured_coins()}
        target_symbols = symbols or list(coin_map.keys()) or list(stored_prices.keys())
        formatted: Dict[str, Dict] = {}

        for symbol in target_symbols:
            stored = stored_prices.get(symbol)
            coin = coin_map.get(symbol, {})
            if not stored:
                continue

            formatted[symbol] = {
                'price': stored.get('price', 0),
                'name': coin.get('name', symbol),
                'exchange': coin.get('exchange', ''),
                'change_24h': 0,
                'price_date': stored.get('price_date'),
                'source': 'closing'
            }

        return formatted

    def _persist_closing_prices(self):
        """Persist closing prices to database"""
        if not self._last_live_prices or not self._last_live_date:
            return

        price_date = self._last_live_date.strftime('%Y-%m-%d')
        for symbol, payload in self._last_live_prices.items():
            price = payload.get('price')
            if price is None:
                continue
            try:
                self.db.upsert_daily_price(symbol, float(price), price_date)
            except Exception as err:
                print(f'[WARN] Failed to persist closing price for {symbol}: {err}')

    def get_prices(self, symbols: Optional[List[str]] = None) -> Dict[str, Dict]:
        """Return prices respecting configured trading hours"""
        now = datetime.now()
        market_open = self.is_within_trading_window(now)

        if not market_open and self._last_market_open_state:
            self._persist_closing_prices()

        self._last_market_open_state = market_open

        if market_open:
            live_prices = self.get_current_prices(symbols)
            if live_prices:
                for payload in live_prices.values():
                    payload['source'] = 'live'
                    payload['price_date'] = now.strftime('%Y-%m-%d')
                self._last_live_prices = live_prices
                self._last_live_date = now.date()
            return live_prices

        stored_prices = self.db.get_latest_daily_prices(symbols)
        formatted = self._format_stored_prices(stored_prices, symbols)

        target_symbols = symbols or [coin['symbol'] for coin in self._get_configured_coins()]
        missing_symbols = [sym for sym in target_symbols if sym not in formatted]

        if missing_symbols:
            live_prices = self.get_current_prices(missing_symbols)
            if live_prices:
                price_date = now.strftime('%Y-%m-%d')
                if not self._last_live_prices:
                    self._last_live_prices = {}
                for symbol, payload in live_prices.items():
                    payload['source'] = 'live_fallback'
                    payload['price_date'] = price_date
                    formatted[symbol] = payload
                    self._last_live_prices[symbol] = payload.copy()
                    try:
                        self.db.upsert_daily_price(symbol, float(payload.get('price', 0)), price_date)
                    except Exception as err:
                        print(f'[WARN] Failed to persist fallback price for {symbol}: {err}')
                self._last_live_date = now.date()

        # Fallback to most recent live snapshot if still no data
        if not formatted and self._last_live_prices:
            fallback: Dict[str, Dict] = {}
            for symbol, payload in self._last_live_prices.items():
                if symbols and symbol not in symbols:
                    continue
                fallback[symbol] = {
                    **payload,
                    'source': payload.get('source', 'previous_live'),
                    'price_date': payload.get('price_date') or (self._last_live_date.strftime('%Y-%m-%d') if self._last_live_date else None)
                }
            return fallback

        return formatted

    def _wait_for_rate_limit(self, api_name: str):
        """Wait if necessary to respect rate limits"""
        api_config = self.api_providers[api_name]
        current_time = time.time()
        time_since_last = current_time - api_config['last_request_time']
        
        if time_since_last < api_config['min_interval']:
            sleep_time = api_config['min_interval'] - time_since_last
            time.sleep(sleep_time)
        
        api_config['last_request_time'] = time.time()

    def _update_api_health(self, api_name: str, success: bool):
        """Update API health tracking"""
        health = self._api_health[api_name]
        if success:
            health['success_count'] += 1
            health['last_success'] = time.time()
        else:
            health['fail_count'] += 1

    def _get_binance_symbol(self, coin: Dict) -> str:
        """Get Binance trading symbol for coin"""
        symbol = coin.get('symbol', '').upper()
        return f"{symbol}USDT"

    def _get_coingecko_id(self, coin: Dict) -> str:
        """Get CoinGecko coin ID"""
        return coin.get('coingecko_id', coin.get('symbol', '').lower())

    def _fetch_from_binance(self, coins: List[Dict]) -> Dict[str, Dict]:
        """Fetch prices from Binance API"""
        prices = {}
        api_name = 'binance'
        api_config = self.api_providers[api_name]
        
        if not api_config['enabled']:
            return prices

        try:
            binance_symbols = [self._get_binance_symbol(coin) for coin in coins]
            session = self.sessions[api_name]
            
            for binance_symbol in binance_symbols:
                try:
                    self._wait_for_rate_limit(api_name)
                    
                    response = session.get(
                        f"{api_config['base_url']}/ticker/24hr",
                        params={'symbol': binance_symbol},
                        timeout=api_config['timeout'],
                        verify=True
                    )
                    response.raise_for_status()
                    item = response.json()
                    
                    # Find corresponding coin
                    for coin in coins:
                        if self._get_binance_symbol(coin) == binance_symbol:
                            prices[coin['symbol']] = {
                                'price': float(item['lastPrice']),
                                'name': coin.get('name', coin['symbol']),
                                'exchange': coin.get('exchange', 'CRYPTO'),
                                'change_24h': float(item['priceChangePercent'])
                            }
                            self._update_api_health(api_name, True)
                            break
                except (SSLError, ConnectionError, ProxyError) as e:
                    print(f'[WARN] Binance connection error for {binance_symbol}: {str(e)[:100]}')
                    self._update_api_health(api_name, False)
                    continue
                except Exception as e:
                    print(f'[WARN] Binance error for {binance_symbol}: {str(e)[:100]}')
                    self._update_api_health(api_name, False)
                    continue
        except Exception as e:
            print(f'[WARN] Binance API failed: {str(e)[:100]}')
            self._update_api_health(api_name, False)

        return prices

    def _fetch_from_coingecko(self, coins: List[Dict]) -> Dict[str, Dict]:
        """Fetch prices from CoinGecko API"""
        prices = {}
        api_name = 'coingecko'
        api_config = self.api_providers[api_name]
        
        if not api_config['enabled']:
            return prices

        try:
            self._wait_for_rate_limit(api_name)
            
            coin_ids = [self._get_coingecko_id(coin) for coin in coins]
            session = self.sessions[api_name]
            
            response = session.get(
                f"{api_config['base_url']}/simple/price",
                params={
                    'ids': ','.join(coin_ids),
                    'vs_currencies': 'usd',
                    'include_24hr_change': 'true'
                },
                timeout=api_config['timeout']
            )
            
            if response.status_code == 429:
                print(f'[WARN] CoinGecko rate limit hit')
                self._update_api_health(api_name, False)
                return prices
            
            response.raise_for_status()
            data = response.json()
            self._update_api_health(api_name, True)

            for coin in coins:
                coin_id = self._get_coingecko_id(coin)
                if coin_id in data:
                    prices[coin['symbol']] = {
                        'price': data[coin_id]['usd'],
                        'name': coin.get('name', coin['symbol']),
                        'exchange': coin.get('exchange', 'CRYPTO'),
                        'change_24h': data[coin_id].get('usd_24h_change', 0)
                    }
        except (RequestException, ProxyError, ConnectionError) as e:
            print(f'[WARN] CoinGecko error: {str(e)[:100]}')
            self._update_api_health(api_name, False)
        except Exception as e:
            print(f'[WARN] CoinGecko failed: {str(e)[:100]}')
            self._update_api_health(api_name, False)

        return prices

    def _fetch_from_coincap(self, coins: List[Dict]) -> Dict[str, Dict]:
        """Fetch prices from CoinCap API"""
        prices = {}
        api_name = 'coincap'
        api_config = self.api_providers[api_name]
        
        if not api_config['enabled']:
            return prices

        try:
            session = self.sessions[api_name]
            
            # CoinCap uses asset IDs (e.g., 'bitcoin', 'ethereum')
            symbol_map = {
                'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana',
                'BNB': 'binance-coin', 'XRP': 'ripple', 'DOGE': 'dogecoin',
                'ADA': 'cardano', 'DOT': 'polkadot', 'MATIC': 'polygon',
                'AVAX': 'avalanche', 'LINK': 'chainlink', 'UNI': 'uniswap'
            }
            
            for coin in coins:
                try:
                    self._wait_for_rate_limit(api_name)
                    
                    symbol = coin['symbol'].upper()
                    asset_id = symbol_map.get(symbol, symbol.lower())
                    
                    response = session.get(
                        f"{api_config['base_url']}/assets/{asset_id}",
                        timeout=api_config['timeout']
                    )
                    
                    if response.status_code == 429:
                        continue
                    
                    response.raise_for_status()
                    data = response.json()
                    
                    if 'data' in data and data['data']:
                        asset = data['data']
                        prices[coin['symbol']] = {
                            'price': float(asset.get('priceUsd', 0)),
                            'name': coin.get('name', coin['symbol']),
                            'exchange': coin.get('exchange', 'CRYPTO'),
                            'change_24h': float(asset.get('changePercent24Hr', 0))
                        }
                        self._update_api_health(api_name, True)
                except Exception as e:
                    self._update_api_health(api_name, False)
                    continue
        except Exception as e:
            print(f'[WARN] CoinCap failed: {str(e)[:100]}')
            self._update_api_health(api_name, False)

        return prices

    def _fetch_from_cryptocompare(self, coins: List[Dict]) -> Dict[str, Dict]:
        """Fetch prices from CryptoCompare API"""
        prices = {}
        api_name = 'cryptocompare'
        api_config = self.api_providers[api_name]
        
        if not api_config['enabled']:
            return prices

        try:
            self._wait_for_rate_limit(api_name)
            
            session = self.sessions[api_name]
            symbols = [coin['symbol'].upper() for coin in coins]
            fsyms = ','.join(symbols)
            
            response = session.get(
                f"{api_config['base_url']}/pricemultifull",
                params={'fsyms': fsyms, 'tsyms': 'USD'},
                timeout=api_config['timeout']
            )
            
            if response.status_code == 429:
                print(f'[WARN] CryptoCompare rate limit hit')
                self._update_api_health(api_name, False)
                return prices
            
            response.raise_for_status()
            data = response.json()
            self._update_api_health(api_name, True)

            raw_data = data.get('RAW', {})
            for coin in coins:
                symbol = coin['symbol'].upper()
                if symbol in raw_data and 'USD' in raw_data[symbol]:
                    usd_data = raw_data[symbol]['USD']
                    prices[coin['symbol']] = {
                        'price': float(usd_data.get('PRICE', 0)),
                        'name': coin.get('name', coin['symbol']),
                        'exchange': coin.get('exchange', 'CRYPTO'),
                        'change_24h': float(usd_data.get('CHANGEPCT24HOUR', 0))
                    }
        except (RequestException, ProxyError, ConnectionError) as e:
            print(f'[WARN] CryptoCompare error: {str(e)[:100]}')
            self._update_api_health(api_name, False)
        except Exception as e:
            print(f'[WARN] CryptoCompare failed: {str(e)[:100]}')
            self._update_api_health(api_name, False)

        return prices

    def get_current_prices(self, symbols: List[str] = None) -> Dict[str, Dict]:
        """Get current prices using multiple API providers with intelligent fallback"""
        coins = self._get_configured_coins()
        if not coins:
            return {}

        if symbols:
            coins = [c for c in coins if c['symbol'] in symbols]

        if not coins:
            return {}

        cache_key = 'prices_' + '_'.join(sorted([c['symbol'] for c in coins]))
        if cache_key in self._cache:
            if time.time() - self._cache_time[cache_key] < self._cache_duration:
                return self._cache[cache_key]

        prices = {}
        missing_coins = coins.copy()

        # Try APIs in priority order
        api_order = sorted(
            [name for name, config in self.api_providers.items() if config['enabled']],
            key=lambda x: self.api_providers[x]['priority']
        )

        for api_name in api_order:
            if not missing_coins:
                break

            try:
                if api_name == 'binance':
                    api_prices = self._fetch_from_binance(missing_coins)
                elif api_name == 'coingecko':
                    api_prices = self._fetch_from_coingecko(missing_coins)
                elif api_name == 'coincap':
                    api_prices = self._fetch_from_coincap(missing_coins)
                elif api_name == 'cryptocompare':
                    api_prices = self._fetch_from_cryptocompare(missing_coins)
                else:
                    continue

                # Update prices and remove successfully fetched coins
                for symbol, price_data in api_prices.items():
                    if symbol not in prices and price_data.get('price', 0) > 0:
                        prices[symbol] = price_data
                        missing_coins = [c for c in missing_coins if c['symbol'] != symbol]

            except Exception as e:
                print(f'[WARN] {api_name} fetch failed: {str(e)[:100]}')
                continue

        # Set default values for failed coins (use last known price if available)
        for coin in missing_coins:
            if coin['symbol'] not in prices:
                # Try to use last known price
                last_price = self._last_live_prices.get(coin['symbol'], {}).get('price', 0)
                prices[coin['symbol']] = {
                    'price': last_price if last_price > 0 else 0,
                    'name': coin.get('name', coin['symbol']),
                    'exchange': coin.get('exchange', 'CRYPTO'),
                    'change_24h': 0
                }

        self._cache[cache_key] = prices
        self._cache_time[cache_key] = time.time()
        return prices

    def get_market_data(self, symbol: str) -> Dict:
        """Get detailed market data for a coin"""
        coins = {coin['symbol']: coin for coin in self._get_configured_coins()}
        if symbol not in coins:
            return {}

        try:
            prices = self.get_prices([symbol])
            if symbol not in prices:
                return {}
            price_info = prices[symbol]

            return {
                'current_price': price_info.get('price', 0),
                'high_24h': price_info.get('price', 0),
                'low_24h': price_info.get('price', 0)
            }
        except Exception as e:
            print(f'[ERROR] Failed to get market data for {symbol}: {e}')
            return {}

    def get_historical_prices(self, symbol: str, count: int = 60) -> List[Dict]:
        """Get historical prices with caching and multiple API fallback"""
        coins = {coin['symbol']: coin for coin in self._get_configured_coins()}
        if symbol not in coins:
            return []

        coin = coins[symbol]
        coin_id = self._get_coingecko_id(coin)

        # Check cache first
        cache_key = f"{symbol}_{count}"
        if cache_key in self._historical_cache:
            cached_data = self._historical_cache[cache_key]
            if time.time() - cached_data['time'] < self._historical_cache_duration:
                return cached_data['data']

        # Try CoinGecko for historical data (most reliable)
        api_name = 'coingecko'
        api_config = self.api_providers[api_name]
        
        if api_config['enabled']:
            try:
                self._wait_for_rate_limit(api_name)
                
                days = max(1, min(365, count // 24))
                session = self.sessions[api_name]
                
                response = session.get(
                    f"{api_config['base_url']}/coins/{coin_id}/market_chart",
                    params={'vs_currency': 'usd', 'days': days},
                    timeout=api_config['timeout']
                )
                
                if response.status_code == 429:
                    print(f'[WARN] CoinGecko rate limit for {symbol}, using cache if available')
                    if cache_key in self._historical_cache:
                        return self._historical_cache[cache_key]['data']
                    return []
                
                response.raise_for_status()
                data = response.json()
                self._update_api_health(api_name, True)

                prices = []
                for price_data in data.get('prices', [])[-count:]:
                    prices.append({
                        'timestamp': price_data[0],
                        'price': price_data[1]
                    })

                self._historical_cache[cache_key] = {
                    'data': prices,
                    'time': time.time()
                }

                return prices
            except (RequestException, ProxyError, ConnectionError) as e:
                print(f'[WARN] CoinGecko historical error for {symbol}: {str(e)[:100]}')
                self._update_api_health(api_name, False)
                # Return cached data if available
                if cache_key in self._historical_cache:
                    return self._historical_cache[cache_key]['data']
            except Exception as e:
                print(f'[WARN] CoinGecko historical failed for {symbol}: {str(e)[:100]}')
                if cache_key in self._historical_cache:
                    return self._historical_cache[cache_key]['data']

        return []

    def calculate_technical_indicators(self, symbol: str) -> Dict:
        """Calculate technical indicators for a coin"""
        history = self.get_historical_prices(symbol, count=336)
        if not history:
            return {}

        prices = [item['price'] for item in history]
        if len(prices) < 14:
            return {}

        sma_5 = sum(prices[-5:]) / 5 if len(prices) >= 5 else prices[-1]
        sma_20 = sum(prices[-20:]) / 20 if len(prices) >= 20 else sum(prices) / len(prices)

        changes = [prices[i] - prices[i - 1] for i in range(1, len(prices))]
        gains = [change if change > 0 else 0 for change in changes]
        losses = [-change if change < 0 else 0 for change in changes]
        avg_gain = sum(gains[-14:]) / 14 if len(gains) >= 14 else (sum(gains) / len(gains) if gains else 0)
        avg_loss = sum(losses[-14:]) / 14 if len(losses) >= 14 else (sum(losses) / len(losses) if losses else 0)

        if avg_loss == 0:
            rsi = 100
        else:
            rs = avg_gain / avg_loss
            rsi = 100 - (100 / (1 + rs))

        pct_change_5 = ((prices[-1] - prices[-5]) / prices[-5]) * 100 if len(prices) >= 5 and prices[-5] else 0
        pct_change_20 = ((prices[-1] - prices[-20]) / prices[-20]) * 100 if len(prices) >= 20 and prices[-20] else 0

        return {
            'sma_5': sma_5,
            'sma_20': sma_20,
            'rsi_14': rsi,
            'change_5d': pct_change_5,
            'change_20d': pct_change_20,
            'current_price': prices[-1]
        }
