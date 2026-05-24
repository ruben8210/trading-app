import os
import time
import httpx
from urllib.parse import quote
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, APIRouter, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
load_dotenv()
from trading_api.database import get_db, Base, engine
from trading_api.models import User
from trading_api.schemas import LoginRequest, TokenResponse, UserMe
from trading_api.auth import verify_password, create_access_token, get_current_user
from trading_api.routes import users, preferences, stocks, orders

Base.metadata.create_all(bind=engine)

def _ensure_order_columns():
    from sqlalchemy import text
    new_cols = [
        ("market_type", "VARCHAR(20) DEFAULT 'spot'"),
        ("leverage", "FLOAT DEFAULT 1.0"),
        ("stop_loss", "FLOAT"),
        ("take_profit", "FLOAT"),
        ("notes", "TEXT"),
    ]
    with engine.connect() as conn:
        for col_name, col_type in new_cols:
            try:
                conn.execute(text(f"ALTER TABLE orders ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
                conn.commit()
            except Exception:
                pass

_ensure_order_columns()

app = FastAPI(title="Trading API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://trading.rbonilla.com","http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === PROXY ROUTES ===
proxy_router = APIRouter(prefix="/proxy", tags=["proxy"])

BINANCE_BASE = "https://api.binance.com"
FINNHUB_BASE = "https://finnhub.io/api/v1"
FINNHUB_KEY = "d87ckf1r01ql0hsl7uigd87ckf1r01ql0hsl7uj0"

_cache = {}
CACHE_TTL = 15

@proxy_router.get("/binance/ticker/{symbol}")
async def binance_ticker(symbol: str):
    cache_key = f"binance_ticker_{symbol.upper()}"
    now = time.time()

    cached = _cache.get(cache_key)
    if cached and (now - cached["time"]) < CACHE_TTL:
        return cached["data"]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            ticker_symbol = symbol.upper()
            if not ticker_symbol.endswith('USDT'):
                ticker_symbol = ticker_symbol + 'USDT'
            url = f"{BINANCE_BASE}/api/v3/ticker/24hr"
            resp = await client.get(url, params={"symbol": ticker_symbol})
            resp.raise_for_status()
            data = resp.json()
            result = {
                "symbol": symbol.upper(),
                "price": float(data.get("lastPrice", 0)),
                "change": float(data.get("priceChange", 0)),
                "changePercent": float(data.get("priceChangePercent", 0)),
                "high": float(data.get("highPrice", 0)),
                "low": float(data.get("lowPrice", 0)),
                "volume": float(data.get("volume", 0)),
            }
            _cache[cache_key] = {"data": result, "time": now}
            return result
    except Exception as e:
        if cached:
            return cached["data"]
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@proxy_router.get("/binance/klines/{symbol}")
async def binance_klines(
    symbol: str,
    interval: str = Query("1d"),
    limit: int = Query(100, le=1000)
):
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            ticker_symbol = symbol.upper()
            if not ticker_symbol.endswith('USDT'):
                ticker_symbol = ticker_symbol + 'USDT'
            url = f"{BINANCE_BASE}/api/v3/klines"
            resp = await client.get(url, params={
                "symbol": ticker_symbol,
                "interval": interval.lower(),
                "limit": limit
            })
            resp.raise_for_status()
            data = resp.json()
            return {
                "symbol": symbol.upper(),
                "interval": interval,
                "candles": [
                    {
                        "time": candle[0],
                        "open": float(candle[1]),
                        "high": float(candle[2]),
                        "low": float(candle[3]),
                        "close": float(candle[4]),
                        "volume": float(candle[7]),
                    }
                    for candle in data
                ]
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

YAHOO_BASE = "https://query1.finance.yahoo.com"

INTERVAL_MAP = {
    "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "60m", "4h": "60m",
    "1d": "1d", "1w": "1wk", "1mo": "1mo",
}

@proxy_router.get("/yahoo/klines/{symbol}")
async def yahoo_klines(
    symbol: str,
    interval: str = Query("1d"),
    limit: int = Query(100, le=1000)
):
    symbol_upper = symbol.upper()
    iv = interval.lower()
    cache_key = f"yahoo_klines_{symbol_upper}_{iv}_{limit}"
    now = time.time()

    cached = _cache.get(cache_key)
    if cached and (now - cached["time"]) < CACHE_TTL:
        return cached["data"]

    yahoo_interval = INTERVAL_MAP.get(iv, "1d")
    if yahoo_interval in ("1m", "5m", "15m", "30m", "60m"):
        yahoo_range = "1mo"
    elif yahoo_interval == "1d":
        yahoo_range = "1y"
    elif yahoo_interval == "1wk":
        yahoo_range = "5y"
    else:
        yahoo_range = "10y"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"{YAHOO_BASE}/v8/finance/chart/{quote(symbol_upper, safe='')}"
            resp = await client.get(url, params={
                "interval": yahoo_interval,
                "range": yahoo_range,
            }, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
            data = resp.json()

            chart = data.get("chart", {})
            result_list = chart.get("result") or []
            if not result_list:
                raise HTTPException(status_code=404, detail="No data")
            r = result_list[0]
            timestamps = r.get("timestamp") or []
            quote = (r.get("indicators", {}).get("quote") or [{}])[0]
            opens = quote.get("open") or []
            highs = quote.get("high") or []
            lows = quote.get("low") or []
            closes = quote.get("close") or []
            volumes = quote.get("volume") or []

            candles = []
            for i, ts in enumerate(timestamps):
                if i >= len(closes) or closes[i] is None:
                    continue
                candles.append({
                    "time": ts * 1000,
                    "open": float(opens[i] or 0),
                    "high": float(highs[i] or 0),
                    "low": float(lows[i] or 0),
                    "close": float(closes[i] or 0),
                    "volume": float(volumes[i] or 0),
                })

            candles = candles[-limit:]
            result = {"symbol": symbol_upper, "interval": iv, "candles": candles}
            _cache[cache_key] = {"data": result, "time": now}
            return result
    except HTTPException:
        raise
    except Exception as e:
        if cached:
            return cached["data"]
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@proxy_router.get("/yahoo/quote/{symbol}")
async def yahoo_quote(symbol: str):
    symbol_upper = symbol.upper()
    cache_key = f"yahoo_quote_{symbol_upper}"
    now = time.time()

    cached = _cache.get(cache_key)
    if cached and (now - cached["time"]) < CACHE_TTL:
        return cached["data"]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"{YAHOO_BASE}/v8/finance/chart/{quote(symbol_upper, safe='')}"
            resp = await client.get(url, params={
                "interval": "1d",
                "range": "5d",
            }, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
            data = resp.json()

            chart = data.get("chart", {})
            result_list = chart.get("result") or []
            if not result_list:
                raise HTTPException(status_code=404, detail="No data")
            r = result_list[0]
            meta = r.get("meta", {})
            price = meta.get("regularMarketPrice")
            prev_close = meta.get("chartPreviousClose") or meta.get("previousClose")

            if price is None:
                q_data = (r.get("indicators", {}).get("quote") or [{}])[0]
                closes = [c for c in (q_data.get("close") or []) if c is not None]
                if closes:
                    price = closes[-1]
                    if prev_close is None and len(closes) >= 2:
                        prev_close = closes[-2]

            price = float(price or 0)
            prev_close = float(prev_close or price)
            change = price - prev_close
            change_percent = (change / prev_close * 100) if prev_close else 0

            result = {
                "symbol": symbol_upper,
                "price": price,
                "change": change,
                "changePercent": change_percent,
                "high": float(meta.get("regularMarketDayHigh") or 0),
                "low": float(meta.get("regularMarketDayLow") or 0),
            }
            _cache[cache_key] = {"data": result, "time": now}
            return result
    except HTTPException:
        raise
    except Exception as e:
        if cached:
            return cached["data"]
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@proxy_router.get("/finnhub/quote/{symbol}")
async def finnhub_quote(symbol: str):
    symbol_upper = symbol.upper()
    cache_key = f"finnhub_quote_{symbol_upper}"
    now = time.time()

    cached = _cache.get(cache_key)
    if cached and (now - cached["time"]) < CACHE_TTL:
        return cached["data"]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"{FINNHUB_BASE}/quote"
            resp = await client.get(url, params={
                "symbol": symbol_upper,
                "token": FINNHUB_KEY
            })
            resp.raise_for_status()
            data = resp.json()
            result = {
                "symbol": symbol_upper,
                "price": float(data.get("c", 0)),
                "change": float(data.get("d", 0)),
                "changePercent": float(data.get("dp", 0)),
                "high": float(data.get("h", 0)),
                "low": float(data.get("l", 0)),
                "open": float(data.get("o", 0)),
                "volume": float(data.get("v", 0)),
            }
            _cache[cache_key] = {"data": result, "time": now}
            return result
    except Exception as e:
        if cached:
            return cached["data"]
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.post("/api/v1/auth/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == request.username).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    access_token = create_access_token({"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/v1/auth/me", response_model=UserMe)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserMe(id=current_user.id, username=current_user.username, role=current_user.role)


app.include_router(users.router, prefix="/api/v1")
app.include_router(preferences.router, prefix="/api/v1")
app.include_router(stocks.router, prefix="/api/v1")
app.include_router(orders.router)
app.include_router(proxy_router, prefix="/api/v1")
