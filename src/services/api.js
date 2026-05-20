const isProd = import.meta.env.PROD

const YAHOO_BASE = isProd
  ? 'https://yahoo.trading.rbonilla.com/v8/finance/chart'
  : '/api/yahoo/v8/finance/chart'

const BINANCE_BASE = isProd
  ? 'https://binance.trading.rbonilla.com'
  : '/api/binance'

const SEARCH_BASE = isProd
  ? 'https://yahoo.trading.rbonilla.com/v1/finance/search'
  : '/api/search/v1/finance/search'

const YAHOO_INITIAL = {
  '1m':  { interval: '1m',  range: '1d'  },
  '5m':  { interval: '5m',  range: '5d'  },
  '15m': { interval: '15m', range: '5d'  },
  '1h':  { interval: '1h',  range: '1mo' },
  '4h':  { interval: '4h',  range: '3mo' },
  '1D':  { interval: '1d',  range: '1y'  },
  '1W':  { interval: '1wk', range: '5y'  },
  '1M':  { interval: '1mo', range: '10y' },
}

const BINANCE_INITIAL = {
  '1m':  { interval: '1m', limit: 1000 },
  '5m':  { interval: '5m', limit: 1000 },
  '15m': { interval: '15m', limit: 1000 },
  '1h':  { interval: '1h', limit: 1000 },
  '4h':  { interval: '4h', limit: 1000 },
  '1D':  { interval: '1d', limit: 1000 },
  '1W':  { interval: '1w', limit: 500  },
  '1M':  { interval: '1M', limit: 240  },
}

const INTERVAL_SECONDS = {
  '1m': 60, '5m': 300, '15m': 900, '1h': 3600,
  '4h': 14400, '1D': 86400, '1W': 604800, '1M': 2592000,
}

const RANGE_MAP = {
  '1D':    { yahoo: '1d',   seconds: 86400 },
  '5D':    { yahoo: '5d',   seconds: 432000 },
  '1M':    { yahoo: '1mo',  seconds: 2592000 },
  '3M':    { yahoo: '3mo',  seconds: 7776000 },
  '6M':    { yahoo: '6mo',  seconds: 15552000 },
  'YTD':   { yahoo: 'ytd',  seconds: 0 },
  '1A':    { yahoo: '1y',   seconds: 31536000 },
  '5A':    { yahoo: '5y',   seconds: 157680000 },
  'Todos': { yahoo: 'max',  seconds: 315360000 },
}

const CRYPTO_SYMBOLS = new Set([
  'BTC','ETH','BNB','SOL','XRP','ADA','DOGE','AVAX','DOT','MATIC',
  'LTC','LINK','UNI','ATOM','ETC','HBAR','ALGO','VET','ICP','FIL',
  'THETA','XLM','TRX','EOS','AAVE','MKR','COMP','SNX','CRV','SUSHI',
])

export function isCrypto(symbol) {
  const upper = symbol.toUpperCase()
  if (upper.endsWith('USDT')) return true
  return CRYPTO_SYMBOLS.has(upper)
}

export function toFullSymbol(symbol) {
  const upper = symbol.toUpperCase()
  if (upper.endsWith('USDT')) return upper
  if (CRYPTO_SYMBOLS.has(upper)) return upper + 'USDT'
  return upper
}

function parseOHLC(json) {
  const result = json.chart.result?.[0]
  if (!result) throw new Error('Sin datos')
  const { timestamp, indicators } = result
  const { open, high, low, close, volume } = indicators.quote[0]
  return timestamp.map((time, i) => ({
    time, open: open[i], high: high[i], low: low[i], close: close[i], volume: volume[i],
  })).filter(d => d.open && d.high && d.low && d.close)
}

function parseBinanceKlines(json) {
  return json.map(k => ({
    time: Math.floor(k[0] / 1000) + 7200,
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }))
}

// --- Initial fetch ---

async function fetchYahooOHLCV(symbol, interval, rangeOverride, signal) {
  const cfg = YAHOO_INITIAL[interval] || YAHOO_INITIAL['1D']
  const range = rangeOverride ? RANGE_MAP[rangeOverride]?.yahoo || cfg.range : cfg.range
  const url = `${YAHOO_BASE}/${symbol}?interval=${cfg.interval}&range=${range}&includePrePost=false`
  const res = await fetch(url, { signal, headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`Error ${res.status}: ${symbol} no encontrado`)
  return parseOHLC(await res.json())
}

async function fetchBinanceOHLCV(symbol, interval, rangeOverride, signal) {
  const cfg = BINANCE_INITIAL[interval] || BINANCE_INITIAL['1D']
  const intervalSec = INTERVAL_SECONDS[interval] || 86400
  let limit = cfg.limit
  if (rangeOverride) {
    const sec = RANGE_MAP[rangeOverride]?.seconds
    if (sec) limit = Math.ceil(sec / intervalSec)
  }
  const url = `${BINANCE_BASE}/api/v3/klines?symbol=${symbol}&interval=${cfg.interval}&limit=${limit}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Error ${res.status}: ${symbol} no encontrado en Binance`)
  return parseBinanceKlines(await res.json())
}

export async function fetchOHLCV(symbol, interval, rangeOverride, signal) {
  const fullSymbol = toFullSymbol(symbol)
  if (isCrypto(symbol)) return fetchBinanceOHLCV(fullSymbol, interval, rangeOverride, signal)
  return fetchYahooOHLCV(fullSymbol, interval, rangeOverride, signal)
}

// --- Real-time update (latest candle) ---

export async function fetchLatestCandle(symbol, interval) {
  const fullSymbol = toFullSymbol(symbol)
  if (isCrypto(symbol)) {
    const cfg = BINANCE_INITIAL[interval] || BINANCE_INITIAL['1D']
    const url = `${BINANCE_BASE}/api/v3/klines?symbol=${fullSymbol}&interval=${cfg.interval}&limit=2`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    const candles = parseBinanceKlines(json)
    return candles.at(-1)
  }
  const cfg = YAHOO_INITIAL[interval] || YAHOO_INITIAL['1D']
  const url = `${YAHOO_BASE}/${fullSymbol}?interval=${cfg.interval}&range=${cfg.range}&includePrePost=false`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) return null
  const data = parseOHLC(await res.json())
  return data.at(-1)
}

// --- Pagination (load more older data) ---

async function fetchMoreYahoo(symbol, interval, oldestTime) {
  const cfg = YAHOO_INITIAL[interval] || YAHOO_INITIAL['1D']
  const intervalSec = INTERVAL_SECONDS[interval] || 86400
  const count = 500
  const period2 = oldestTime
  const period1 = oldestTime - count * intervalSec
  const url = `${YAHOO_BASE}/${symbol}?interval=${cfg.interval}&period1=${period1}&period2=${period2}&includePrePost=false`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) return []
  const data = parseOHLC(await res.json())
  return data.filter(d => d.time < oldestTime)
}

async function fetchMoreBinance(symbol, interval, oldestTime) {
  const cfg = BINANCE_INITIAL[interval] || BINANCE_INITIAL['1D']
  const endMs = oldestTime * 1000 - 1
  const url = `${BINANCE_BASE}/api/v3/klines?symbol=${symbol}&interval=${cfg.interval}&limit=500&endTime=${endMs}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = parseBinanceKlines(await res.json())
  return data.filter(d => d.time < oldestTime)
}

export async function fetchMoreOHLCV(symbol, interval, oldestTime) {
  const fullSymbol = toFullSymbol(symbol)
  if (isCrypto(symbol)) return fetchMoreBinance(fullSymbol, interval, oldestTime)
  return fetchMoreYahoo(fullSymbol, interval, oldestTime)
}

// --- Ticker (price + 24h change) ---

const cache = {}
const CACHE_TTL = 30000

async function cached(key, fetcher) {
  const now = Date.now()
  if (cache[key] && now - cache[key].ts < CACHE_TTL) return cache[key].data
  const data = await fetcher()
  cache[key] = { data, ts: now }
  return data
}

async function fetchBinanceTicker(symbol) {
  return cached(`binance:${symbol}`, async () => {
    const res = await fetch(`${BINANCE_BASE}/api/v3/ticker/24hr?symbol=${symbol}`)
    if (!res.ok) throw new Error(`Error ${res.status}: ${symbol}`)
    const json = await res.json()
    return { price: parseFloat(json.lastPrice), changePercent: parseFloat(json.priceChangePercent) }
  })
}

async function fetchYahooTicker(symbol) {
  return cached(`yahoo:${symbol}`, async () => {
    const res = await fetch(`${YAHOO_BASE}/${symbol}?interval=1d&range=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    if (!res.ok) throw new Error(`Error ${res.status}: ${symbol}`)
    const json = await res.json()
    const result = json.chart.result?.[0]
    if (!result) throw new Error('Sin datos')
    const meta = result.meta || {}
    const price = meta.regularMarketPrice
    const prevClose = meta.chartPreviousClose || meta.previousClose
    if (price == null) throw new Error('Sin precio')
    const changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0
    return { price, changePercent }
  })
}

export async function fetchTicker(symbol) {
  const fullSymbol = toFullSymbol(symbol)
  if (isCrypto(symbol)) return fetchBinanceTicker(fullSymbol)
  return fetchYahooTicker(fullSymbol)
}

export async function fetchCurrentPrice(symbol) {
  const { price } = await fetchTicker(symbol)
  return price
}

export async function fetch24hrChange(symbol) {
  const { changePercent } = await fetchTicker(symbol)
  return changePercent
}
