import { useState, useEffect, useRef, useCallback } from 'react'

async function searchYahoo(query) {
  const q = encodeURIComponent(query)
  console.log('buscando:', query)
  const res = await fetch(`/api/search/v1/finance/search?q=${q}&quotesCount=8&newsCount=0`)
  if (!res.ok) { console.log('error fetch:', res.status); return [] }
  const json = await res.json()
  return (json.quotes || [])
    .filter(q => q.symbol && !q.symbol.includes('='))
    .slice(0, 8)
    .map(q => ({
      symbol: q.symbol,
      name: q.shortname || q.longname || '',
      type: q.quoteType || '',
    }))
}

export default function Toolbar({ symbol, onSymbolChange, timeframe, onTimeframeChange, indicators, onIndicatorToggle, onOpenIndicators }) {
  const [query, setQuery] = useState(symbol)
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => { setQuery(symbol) }, [symbol])

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const doSearch = useCallback(async (q) => {
    if (q.length < 2) { setResults([]); setOpen(false); return }
    const data = await searchYahoo(q)
    setResults(data)
    setOpen(true)
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(val), 300)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
    if (e.key === 'Enter') { onSymbolChange(query.toUpperCase()); setOpen(false) }
  }

  const selectSymbol = (sym) => {
    onSymbolChange(sym)
    setQuery(sym)
    setOpen(false)
  }

  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1D', '1W', '1M']
  const activeCount = Object.values(indicators).filter(Boolean).length

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-surface border-b border-border">
      <div ref={wrapperRef} className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="bg-bg border border-border rounded px-3 py-1 text-text text-sm w-40 uppercase outline-none focus:border-accent"
          placeholder="Buscar símbolo..."
        />
        {open && (
          <div className="absolute top-full left-0 mt-1 w-72 bg-[#1e222d] border border-border rounded shadow-lg z-50 max-h-80 overflow-y-auto">
            {results.length === 0 ? (
              <div className="px-3 py-2 text-xs text-text/60">Sin resultados</div>
            ) : (
              results.map(r => (
                <button key={r.symbol} onClick={() => selectSymbol(r.symbol)}
                  className="flex items-center justify-between w-full px-3 py-2 hover:bg-border/20 text-left">
                  <div className="min-w-0">
                    <div className="text-sm text-white font-semibold">{r.symbol}</div>
                    <div className="text-xs text-text/60 truncate">{r.name}</div>
                  </div>
                  <span className="text-[10px] text-text/40 shrink-0 ml-2">{r.type}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <div className="h-5 w-px bg-border" />
      <div className="flex gap-1">
        {timeframes.map(tf => (
          <button key={tf} onClick={() => onTimeframeChange(tf)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors
              ${timeframe === tf ? 'bg-accent text-white' : 'text-text hover:bg-border'}`}>
            {tf}
          </button>
        ))}
      </div>
      <div className="h-5 w-px bg-border" />
      <button onClick={onOpenIndicators}
        className="px-2 py-1 rounded text-xs font-medium text-text hover:bg-border transition-colors">
        Indicadores{activeCount > 0 && ` (${activeCount})`}
      </button>
    </div>
  )
}
