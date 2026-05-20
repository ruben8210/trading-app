import { useEffect, useState, useRef } from 'react'
import { fetchTicker, isCrypto } from '../../services/api'

const STORAGE_KEY = 'trading-watchlist'
const VERSION_KEY = 'trading-watchlist-v'
const LIST_VERSION = 2
const DEFAULT_LIST = ['BTCUSDT', 'ETHUSDT', 'AAPL', 'TSLA', 'NVDA']

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

export default function Watchlist({ onSelect }) {
  const [list, setList] = useState(loadList)
  const [input, setInput] = useState('')
  const [prices, setPrices] = useState({})

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

  const addSymbol = () => {
    const s = input.trim().toUpperCase()
    if (s && !list.includes(s)) {
      setList(prev => [...prev, s])
      setInput('')
    }
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
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-border hover:text-red text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
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
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-border hover:text-red text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-1 p-2 border-t border-border">
        <input value={input} onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && addSymbol()}
          placeholder="Añadir..."
          className="flex-1 bg-bg border border-border rounded px-2 py-1 text-xs text-text placeholder:text-border" />
        <button onClick={addSymbol}
          className="px-2 py-1 bg-accent text-white rounded text-xs font-medium hover:opacity-90">+</button>
      </div>
    </div>
  )
}
