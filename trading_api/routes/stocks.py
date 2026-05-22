import os
import time
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/stocks", tags=["stocks"])

ALPACA_KEY_ID     = os.getenv("ALPACA_KEY_ID")
ALPACA_SECRET_KEY = os.getenv("ALPACA_SECRET_KEY")
FINNHUB_TOKEN     = os.getenv("FINNHUB_TOKEN")
TTL_OPEN          = int(os.getenv("CACHE_TTL_SECONDS", 60))
TTL_CLOSED        = int(os.getenv("CACHE_TTL_CLOSED", 3600))

_cache: dict = {}

def _is_market_open() -> bool:
    now = datetime.now(timezone.utc)
    if now.weekday() >= 5:
        return False
    return 13 * 60 + 30 <= now.hour * 60 + now.minute < 20 * 60

def _get_ttl() -> int:
    return TTL_OPEN if _is_market_open() else TTL_CLOSED

def _cache_get(key: str):
    entry = _cache.get(key)
    if not entry:
        return None
    if time.time() - entry["ts"] > entry["ttl"]:
        del _cache[key]
        return None
    return entry

def _cache_set(key: str, data: dict, ttl: int):
    _cache[key] = {"data": data, "ts": time.time(), "ttl": ttl}

class CircuitBreaker:
    def __init__(self, threshold=5, cooldown=900):
        self.failures = 0
        self.threshold = threshold
        self.cooldown = cooldown
        self.opened_at = None

    def is_open(self) -> bool:
        if self.opened_at and time.time() - self.opened_at < self.cooldown:
            return True
        if self.opened_at:
            self.reset()
        return False

    def record_failure(self):
        self.failures += 1
        if self.failures >= self.threshold:
            self.opened_at = time.time()

    def reset(self):
        self.failures = 0
        self.opened_at = None

alpaca_cb = CircuitBreaker()

async def _fetch_alpaca(ticker: str) -> dict:
    url = f"https://data.alpaca.markets/v2/stocks/{ticker}/quotes/latest"
    headers = {
        "APCA-API-KEY-ID": ALPACA_KEY_ID,
        "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
    }
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.get(url, headers=headers)
        r.raise_for_status()
        q = r.json().get("quote", {})

    snap_url = f"https://data.alpaca.markets/v2/stocks/{ticker}/snapshot"
    async with httpx.AsyncClient(timeout=5) as client:
        rs = await client.get(snap_url, headers=headers)
        rs.raise_for_status()
        snap = rs.json().get("snapshot", {})

    daily = snap.get("dailyBar", {})
    prev  = snap.get("prevDailyBar", {})
    price = q.get("ap", daily.get("c", 0))
    prev_close = prev.get("c", price)
    change = round(price - prev_close, 4)
    change_pct = round((change / prev_close) * 100, 4) if prev_close else 0

    return {
        "ticker": ticker.upper(),
        "price": price,
        "currency": "USD",
        "change": change,
        "change_percent": change_pct,
        "volume": daily.get("v", 0),
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }

async def _fetch_finnhub(ticker: str) -> dict:
    url = "https://finnhub.io/api/v1/quote"
    params = {"symbol": ticker, "token": FINNHUB_TOKEN}
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        d = r.json()

    if d.get("c", 0) == 0:
        raise ValueError(f"Finnhub no encontró datos para {ticker}")

    price = d["c"]
    prev  = d.get("pc", price)
    change = round(price - prev, 4)
    change_pct = round((change / prev) * 100, 4) if prev else 0

    return {
        "ticker": ticker.upper(),
        "price": price,
        "currency": "USD",
        "change": change,
        "change_percent": change_pct,
        "volume": d.get("v", 0),
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }

@router.get("/quote")
async def get_quote(ticker: str):
    ticker = ticker.upper().strip()
    cache_key = f"stock:{ticker}"
    ttl = _get_ttl()

    cached = _cache_get(cache_key)
    if cached:
        return {
            "status": "success",
            "data": cached["data"],
            "cache": {
                "hit": True,
                "ttl_remaining_seconds": int(ttl - (time.time() - cached["ts"]))
            }
        }

    if not alpaca_cb.is_open():
        try:
            data = await _fetch_alpaca(ticker)
            alpaca_cb.reset()
            _cache_set(cache_key, data, ttl)
            return {
                "status": "success",
                "data": data,
                "cache": {"hit": False, "ttl_remaining_seconds": ttl}
            }
        except Exception:
            alpaca_cb.record_failure()

    try:
        data = await _fetch_finnhub(ticker)
        _cache_set(cache_key, data, ttl)
        return {
            "status": "success",
            "data": {**data, "stale_data": alpaca_cb.is_open()},
            "cache": {"hit": False, "ttl_remaining_seconds": ttl}
        }
    except Exception as e:
        stale = _cache.get(cache_key)
        if stale:
            return {
                "status": "success",
                "data": {**stale["data"], "stale_data": True},
                "cache": {"hit": True, "ttl_remaining_seconds": 0}
            }
        raise HTTPException(503, f"Todos los proveedores fallaron para {ticker}: {e}")


# ─── Barras OHLCV via Twelve Data ────────────────────────────
TWELVEDATA_TOKEN = os.getenv("TWELVEDATA_TOKEN")

TWELVE_INTERVAL_MAP = {
    "1m": "1min", "5m": "5min", "15m": "15min",
    "1h": "1h", "4h": "4h", "1D": "1day",
    "1W": "1week", "1M": "1month"
}

TWELVE_LIMIT_MAP = {
    "1m": 1000, "5m": 1000, "15m": 1000,
    "1h": 1000, "4h": 1000, "1D": 365,
    "1W": 260, "1M": 120
}

@router.get("/bars")
async def get_bars(ticker: str, interval: str = "1D", limit: int = None):
    ticker = ticker.upper().strip()
    td_interval = TWELVE_INTERVAL_MAP.get(interval, "1day")
    bars_limit = limit or TWELVE_LIMIT_MAP.get(interval, 365)
    cache_key = f"bars:{ticker}:{interval}"
    ttl = _get_ttl()

    cached = _cache_get(cache_key)
    if cached:
        return {"status": "success", "data": cached["data"], "cache": {"hit": True}}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://api.twelvedata.com/time_series",
                params={
                    "symbol": ticker,
                    "interval": td_interval,
                    "outputsize": bars_limit,
                    "apikey": TWELVEDATA_TOKEN,
                    "order": "ASC"
                }
            )
            r.raise_for_status()
            json_data = r.json()

        if "values" not in json_data:
            raise ValueError(json_data.get("message", "Sin datos"))

        data = []
        for v in json_data["values"]:
            if interval in ["1D", "1W", "1M"]:
                t = int(v["datetime"].replace("-", ""))
            else:
                import datetime
                t = int(datetime.datetime.fromisoformat(v["datetime"]).timestamp())
            data.append({
                "time": t,
                "open": float(v["open"]),
                "high": float(v["high"]),
                "low": float(v["low"]),
                "close": float(v["close"]),
                "volume": int(v["volume"])
            })

        _cache_set(cache_key, data, ttl)
        return {"status": "success", "data": data, "cache": {"hit": False}}

    except Exception as e:
        raise HTTPException(503, f"Error obteniendo barras para {ticker}: " + str(e))
