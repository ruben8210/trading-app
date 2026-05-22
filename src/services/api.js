const API_BASE = "http://127.0.0.1:8000/api/v1";

export const fetchTicker = async (symbol) => {
  try {
    const isCrypto = symbol.toUpperCase().endsWith("USDT") || ["BTC", "ETH"].includes(symbol.toUpperCase());
    
    if (isCrypto) {
      const response = await fetch(`${API_BASE}/proxy/binance/ticker/${symbol}`);
      const data = await response.json();
      return data;
    } else {
      const response = await fetch(`${API_BASE}/proxy/finnhub/quote/${symbol}`);
      const data = await response.json();
      return {
        symbol: data.symbol,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
      };
    }
  } catch (error) {
    console.error("Error fetching ticker:", error);
    throw error;
  }
};

export const fetchBars = async (symbol, interval = "1d") => {
  try {
    const response = await fetch(`${API_BASE}/proxy/binance/klines/${symbol}?interval=${interval}&limit=100`);
    const data = await response.json();
    return data.candles || [];
  } catch (error) {
    console.error("Error fetching bars:", error);
    throw error;
  }
};

export const isCrypto = (symbol) => {
  return symbol.toUpperCase().endsWith("USDT") || ["BTC", "ETH"].includes(symbol.toUpperCase());
};

export const fetchOHLCV = async (symbol, interval = "1d") => {
  return fetchBars(symbol, interval);
};

export const fetchMoreOHLCV = async (symbol, interval = "1d", limit = 100) => {
  try {
    const response = await fetch(`${API_BASE}/proxy/binance/klines/${symbol}?interval=${interval}&limit=${limit}`);
    const data = await response.json();
    return data.candles || [];
  } catch (error) {
    console.error("Error fetching more OHLCV:", error);
    throw error;
  }
};

export const fetchLatestCandle = async (symbol, interval = "1d") => {
  try {
    const candles = await fetchBars(symbol, interval);
    return candles[candles.length - 1] || null;
  } catch (error) {
    console.error("Error fetching latest candle:", error);
    throw error;
  }
};
