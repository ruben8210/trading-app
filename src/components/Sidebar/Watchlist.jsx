import { useEffect, useState, useRef, useCallback } from 'react'
import { fetchTicker, isCrypto } from '../../services/api'

const STORAGE_KEY = 'trading-watchlist'
const VERSION_KEY = 'trading-watchlist-v'
const LIST_VERSION = 2
const DEFAULT_LIST = ['BTCUSDT', 'ETHUSDT', 'AAPL', 'TSLA', 'NVDA']
const TWELVEDATA_TOKEN = import.meta.env.VITE_TWELVEDATA_TOKEN || ''

function loadList() {
  try {
    const version = localStorage.getItem(VERSION_KEY)
    if (version !== String(LIST_VERSION)) {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.setItem(VERSION_KEY, String(LIST_VERSION))
      return DEFAULT_LIST
    }
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : DEFAULT_LIST
  } catch { return DEFAULT_LIST }
}

function formatPrice(price) {
  if (price == null) return '—'
  const decimals = price >= 1000 ? 2 : price >= 1 ? 4 : 6
  return price.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function WatchlistItem({ name, onSelect, price, change, dead }) {
  const isPos = change != null && change >= 0
  if (dead) {
    return (
      <div className="flex items-center justify-between w-full px-3 py-2 text-xs text-left">
        <span className="text-white font-medium">{name}</span>
        <span className="text-red">N/A</span>
      </div>
    )
  }
  return (
    <button
      onClick={() => onSelect(name)}
      className="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-border/40 rounded transition-colors text-left"
    >
      <span className="text-white font-medium">{name}</span>
      <div className="text-right">
        <div className="font-mono">{formatPrice(price)}</div>
        {change != null && (
          <div className={isPos ? 'text-green' : 'text-red'}>
            {isPos ? '+' : ''}{change.toFixed(2)}%
          </div>
        )}
      </div>
    </button>
  )
}

function StockItem({ name, onSelect }) {
  const [price, setPrice] = useState(null)
  const [change, setChange] = useState(null)
  const [dead, setDead] = useState(false)
  const intervalRef = useRef(null)
  const retryTimerRef = useRef(null)

  useEffect(() => {
    if (dead) return
    const doFetch = () => {
      fetchTicker(name).then(({ price: p, changePercent: c }) => {
        setPrice(p); setChange(c)
      }).catch((err) => {
        const msg = err.message || ''
        if (msg.includes('404') || msg.includes('no encontrado') || msg.includes('Sin datos')) {
          setDead(true); if (intervalRef.current) clearInterval(intervalRef.current)
        } else if (msg.includes('429')) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          retryTimerRef.current = setTimeout(doFetch, 60000)
        }
      })
    }
    const timer = setTimeout(() => {
      doFetch()
      intervalRef.current = setInterval(doFetch, 5000)
    }, 0)
    return () => { clearTimeout(timer); if (intervalRef.current) clearInterval(intervalRef.current); if (retryTimerRef.current) clearTimeout(retryTimerRef.current) }
  }, [name, dead])

  return <WatchlistItem name={name} onSelect={onSelect} price={price} change={change} dead={dead} />
}

async function searchBinance(query) {
  try {
    const res = await fetch('https://api.binance.com/api/v3/exchangeInfo')
    if (!res.ok) return []
    const data = await res.json()
    return data.symbols
      .filter(s => s.symbol.includes(query) && s.status === 'TRADING')
      .slice(0, 5)
      .map(s => ({ symbol: s.symbol, name: s.baseAsset, type: 'CRIPTO' }))
  } catch { return [] }
}

async function searchTwelveData(query) {
  try {
    const res = await fetch(`https://api.twelvedata.com/symbol_search?symbol=${query}&apikey=${TWELVEDATA_TOKEN}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.data || [])
      .filter(s => s.instrument_type === 'Common Stock' || s.instrument_type === 'ETF')
      .slice(0, 5)
      .map(s => ({ symbol: s.symbol, name: s.instrument_name, type: s.instrument_type === 'ETF' ? 'ETF' : 'ACCION' }))
  } catch { return [] }
}

export default function Watchlist({ onSelect }) {
  const [list, setList] = useState(loadList)
  const [input, setInput] = useState('')
  const [prices, setPrices] = useState({})
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef(null)
  const wrapperRef = useRef(null)

  const cryptos = list.filter(n => isCrypto(n))
  const stocks = list.filter(n => !isCrypto(n))

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  }, [list])

  useEffect(() => {
    if (cryptos.length === 0) return
    const fetchAll = () => {
      cryptos.forEach(name => {
        fetchTicker(name).then(({ price, changePercent }) => {
          setPrices(prev => ({ ...prev, [name]: { price, change: changePercent } }))
        }).catch(() => {})
      })
    }
    fetchAll()
    const id = setInterval(fetchAll, 5000)
    return () => clearInterval(id)
  }, [list, cryptos.length])

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleInput = useCallback((val) => {
    setInput(val.toUpperCase())
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (val.length < 1) { setSuggestions([]); setShowSuggestions(false); return }
    setSearching(true)
    setShowSuggestions(true)
    searchTimer.current = setTimeout(async () => {
      const [cryptoResults, stockResults] = await Promise.all([
        searchBinance(val.toUpperCase()),
        searchTwelveData(val.toUpperCase())
      ])
      setSuggestions([...cryptoResults, ...stockResults])
      setSearching(false)
    }, 400)
  }, [])

  const addSymbol = (symbol) => {
    const s = (symbol || input).trim().toUpperCase()
    if (s && !list.includes(s)) setList(prev => [...prev, s])
    setInput('')
    setSuggestions([])
    setShowSuggestions(false)
  }

  const removeSymbol = (e, name) => {
    e.stopPropagation()
    setList(prev => prev.filter(x => x !== name))
  }

  return (
    <div className="bg-surface border-l border-border flex flex-col">
      <div className="px-3 py-2 text-xs text-text font-semibold uppercase tracking-wider border-b border-border">
        Watchlist
      </div>
      <div className="flex-1 overflow-y-auto">
        {cryptos.length > 0 && (
          <div>
            <div className="px-3 py-1.5 text-xs text-text/50 uppercase tracking-wider font-semibold">CRIPTO</div>
            {cryptos.map(name => {
              const p = prices[name]
              return (
                <div key={name} className="group relative">
                  <WatchlistItem name={name} onSelect={onSelect} price={p?.price} change={p?.change} />
                  <button onClick={e => removeSymbol(e, name)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-border hover:text-red text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity">x</button>
                </div>
              )
            })}
          </div>
        )}
        {stocks.length > 0 && (
          <div>
            <div className="px-3 py-1.5 text-xs text-text/50 uppercase tracking-wider font-semibold">ACCIONES</div>
            {stocks.map(name => (
              <div key={name} className="group relative">
                <StockItem name={name} onSelect={onSelect} />
                <button onClick={e => removeSymbol(e, name)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-border hover:text-red text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity">x</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="relative p-3 border-t border-border bg-surface z-20 shrink-0" ref={wrapperRef}>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSymbol()}
            onFocus={() => input.length > 0 && setShowSuggestions(true)}
            placeholder="Buscar símbolo..."
            className="flex-1 min-w-0 bg-bg border border-border rounded px-3 py-1.5 text-xs text-text placeholder:text-border focus:outline-none focus:border-accent transition-colors"
          />
          <button onClick={() => addSymbol()}
            className="shrink-0 px-3 py-1.5 bg-accent text-white rounded text-sm font-bold hover:opacity-90 transition-opacity">+</button>
        </div>
        {showSuggestions && (
          <div className="absolute bottom-full left-3 right-3 mb-2 bg-surface border border-border rounded shadow-lg z-50 max-h-48 overflow-y-auto">
            {searching && (
              <div className="px-3 py-2 text-xs text-text/50">Buscando...</div>
            )}
            {!searching && suggestions.length === 0 && input.length > 0 && (
              <div className="px-3 py-2 text-xs text-text/50">Sin resultados — pulsa + para añadir igualmente</div>
            )}
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => addSymbol(s.symbol)}
                className="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-border/40 text-left">
                <div>
                  <span className="text-white font-medium">{s.symbol}</span>
                  <span className="text-text/50 ml-2 truncate max-w-[120px] inline-block align-bottom">{s.name}</span>
                </div>
                <span className="text-text/40 text-[10px]">{s.type}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
