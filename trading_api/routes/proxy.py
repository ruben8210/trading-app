import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/proxy", tags=["proxy"])

BINANCE_BASE = "https://api.binance.com"
FINNHUB_BASE = "https://finnhub.io/api/v1"
FINNHUB_KEY = "d87ckf1r01ql0hsl7uigd87ckf1r01ql0hsl7uj0"

@router.get("/binance/ticker/{symbol}")
async def binance_ticker(symbol: str):
    """Proxy para ticker de Binance"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            ticker_symbol = symbol.upper()
            if not ticker_symbol.endswith('USDT'):
                ticker_symbol = ticker_symbol + 'USDT'
            
            url = f"{BINANCE_BASE}/api/v3/ticker/24hr"
            resp = await client.get(url, params={"symbol": ticker_symbol})
            resp.raise_for_status()
            data = resp.json()
            
            return {
                "symbol": symbol.upper(),
                "price": float(data.get("lastPrice", 0)),
                "change": float(data.get("priceChangePercent", 0)),
                "high": float(data.get("highPrice", 0)),
                "low": float(data.get("lowPrice", 0)),
                "volume": float(data.get("volume", 0)),
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.get("/binance/klines/{symbol}")
async def binance_klines(
    symbol: str,
    interval: str = Query("1d"),
    limit: int = Query(100, le=1000)
):
    """Proxy para velas de Binance"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            ticker_symbol = symbol.upper()
            if not ticker_symbol.endswith('USDT'):
                ticker_symbol = ticker_symbol + 'USDT'
            
            url = f"{BINANCE_BASE}/api/v3/klines"
            resp = await client.get(url, params={
                "symbol": ticker_symbol,
                "interval": interval,
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

@router.get("/finnhub/quote/{symbol}")
async def finnhub_quote(symbol: str):
    """Proxy para quote de Finnhub (acciones)"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"{FINNHUB_BASE}/quote"
            resp = await client.get(url, params={
                "symbol": symbol.upper(),
                "token": FINNHUB_KEY
            })
            resp.raise_for_status()
            data = resp.json()
            
            return {
                "symbol": symbol.upper(),
                "price": float(data.get("c", 0)),
                "change": float(data.get("d", 0)),
                "changePercent": float(data.get("dp", 0)),
                "high": float(data.get("h", 0)),
                "low": float(data.get("l", 0)),
                "open": float(data.get("o", 0)),
                "volume": float(data.get("v", 0)),
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
