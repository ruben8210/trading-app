import os
import time
import httpx
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
                "change": float(data.get("priceChangePercent", 0)),
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
