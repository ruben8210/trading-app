const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

const handleFetchError = (error, context) => {
  const message = error?.message || 'Error desconocido';
  console.error(`${context}:`, error);
  throw new Error(`${context}: ${message}`);
};

// lightweight-charts expects UNIX timestamps in seconds; APIs return milliseconds
const toSeconds = (t) => (t > 1e11 ? Math.floor(t / 1000) : t);
const normalizeCandle = (c) => ({ ...c, time: toSeconds(c.time) });

export const isCrypto = (symbol) => {
  return symbol.toUpperCase().endsWith("USDT") || ["BTC", "ETH"].includes(symbol.toUpperCase());
};

export const isForex = (symbol) => symbol.toUpperCase().endsWith("=X");

export const isCommodity = (symbol) => symbol.toUpperCase().endsWith("=F");

const tickerEndpoint = (symbol) => {
  const s = symbol.toUpperCase();
  if (isCrypto(s)) return `${API_BASE}/proxy/binance/ticker/${encodeURIComponent(s)}`;
  if (isForex(s) || isCommodity(s)) return `${API_BASE}/proxy/yahoo/quote/${encodeURIComponent(s)}`;
  return `${API_BASE}/proxy/finnhub/quote/${encodeURIComponent(s)}`;
};

export const fetchTicker = async (symbol) => {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Symbol debe ser una cadena válida');
  }

  try {
    const sym = symbol.toUpperCase();
    const response = await fetch(tickerEndpoint(sym));

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data) {
      throw new Error('Respuesta vacía del servidor');
    }

    return {
      symbol: data.symbol || sym,
      price: data.price ?? null,
      change: data.change ?? 0,
      changePercent: data.changePercent ?? 0,
    };
  } catch (error) {
    handleFetchError(error, `Error al obtener ticker para ${symbol}`);
  }
};

export const fetchBars = async (symbol, interval = "1d", limit = 100) => {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Symbol debe ser una cadena válida');
  }
  if (!interval || typeof interval !== 'string') {
    throw new Error('Interval debe ser una cadena válida');
  }

  try {
    const normalizedInterval = interval.toLowerCase();
    const safeLimit = Math.min(Math.max(limit, 1), 1000);
    const provider = isCrypto(symbol) ? 'binance' : 'yahoo';
    const url = `${API_BASE}/proxy/${provider}/klines/${encodeURIComponent(symbol)}?interval=${normalizedInterval}&limit=${safeLimit}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data?.candles)) {
      console.warn(`No se encontraron candles para ${symbol} en intervalo ${interval}`);
      return [];
    }

    return data.candles.map(normalizeCandle);
  } catch (error) {
    handleFetchError(error, `Error al obtener barras para ${symbol}`);
  }
};

export const fetchOHLCV = async (symbol, interval = "1d") => {
  return fetchBars(symbol, interval, 100);
};

export const fetchMoreOHLCV = async (symbol, interval = "1d", limit = 100, beforeTime = null) => {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Symbol debe ser una cadena válida');
  }

  try {
    const params = new URLSearchParams({
      interval: (interval || '1d').toLowerCase(),
      limit: Math.min(Math.max(limit, 1), 1000),
    });

    if (beforeTime) {
      params.append('before', beforeTime);
    }

    const provider = isCrypto(symbol) ? 'binance' : 'yahoo';
    const url = `${API_BASE}/proxy/${provider}/klines/${encodeURIComponent(symbol)}?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data?.candles)) {
      return [];
    }

    return data.candles.map(normalizeCandle);
  } catch (error) {
    handleFetchError(error, `Error al obtener más datos para ${symbol}`);
  }
};

export const fetchLatestCandle = async (symbol, interval = "1d") => {
  try {
    const candles = await fetchBars(symbol, interval, 1);
    return candles?.[0] ?? null;
  } catch (error) {
    console.warn(`No se pudo obtener la vela más reciente para ${symbol}:`, error.message);
    return null;
  }
};
