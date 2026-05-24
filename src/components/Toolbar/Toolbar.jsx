import { useState, useEffect, useRef, useCallback } from 'react'

async function searchYahoo(query) {
  const q = encodeURIComponent(query)
  const res = await fetch(`/api/search/v1/finance/search?q=${q}&quotesCount=8&newsCount=0`)
  if (!res.ok) return []
  const json = await res.json()
  return (json.quotes || [])
    .filter(q => q.symbol && (!q.symbol.includes('=') || q.symbol.endsWith('=X') || q.symbol.endsWith('=F')))
    .slice(0, 8)
    .map(q => ({ symbol: q.symbol, name: q.shortname || q.longname || '', type: q.quoteType || '' }))
}

const TIMEFRAME_GROUPS = [
  { label: 'MINUTOS', options: ['1m', '5m', '15m', '30m'] },
  { label: 'HORAS',   options: ['1h', '2h', '4h'] },
  { label: 'DÍAS',    options: ['1D'] },
  { label: 'SEMANAS', options: ['1W'] },
  { label: 'MESES',   options: ['1M'] },
]

const TF_LABELS = {
  '1m':'1m','5m':'5m','15m':'15m','30m':'30m',
  '1h':'1h','2h':'2h','4h':'4h',
  '1D':'1D','1W':'1S','1M':'1M'
}

const CHART_TYPES = [
  { key: 'candles',     label: 'Velas japonesas', icon: '📊' },
  { key: 'hollow',      label: 'Velas huecas',    icon: '🕯️' },
  { key: 'heikin-ashi', label: 'Heikin-Ashi',     icon: '🟢' },
  { key: 'bars',        label: 'Barras OHLC',     icon: '📏' },
  { key: 'line',        label: 'Línea',           icon: '📈' },
  { key: 'area',        label: 'Área',            icon: '🌊' },
]

export default function Toolbar({ symbol, onSymbolChange, timeframe, onTimeframeChange, indicators, onIndicatorToggle, onOpenIndicators, chartType = 'candles', onChartTypeChange }) {
  const [query, setQuery] = useState(symbol)
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [tfOpen, setTfOpen] = useState(false)
  const [ctOpen, setCtOpen] = useState(false)
  const wrapperRef = useRef(null)
  const tfWrapperRef = useRef(null)
  const ctWrapperRef = useRef(null)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => { setQuery(symbol) }, [symbol])

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
      if (tfWrapperRef.current && !tfWrapperRef.current.contains(e.target)) setTfOpen(false)
      if (ctWrapperRef.current && !ctWrapperRef.current.contains(e.target)) setCtOpen(false)
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

  const selectTimeframe = (tf) => {
    onTimeframeChange(tf)
    setTfOpen(false)
  }

  const activeCount = Object.values(indicators).filter(Boolean).length
  const currentChartType = CHART_TYPES.find(c => c.key === chartType) || CHART_TYPES[0]

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
      <div ref={tfWrapperRef} className="relative">
        <button
          onClick={() => setTfOpen(o => !o)}
          className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium bg-accent text-white hover:opacity-90"
        >
          {TF_LABELS[timeframe] || timeframe}
          <span className="text-[10px] opacity-70">▼</span>
        </button>
        {tfOpen && (
          <div className="absolute top-full left-0 mt-1 w-40 bg-[#1e222d] border border-border rounded shadow-lg z-50 overflow-y-auto max-h-80">
            {TIMEFRAME_GROUPS.map(group => (
              <div key={group.label}>
                <div className="px-3 py-1.5 text-[10px] text-text/40 font-semibold uppercase tracking-wider border-b border-border/40">
                  {group.label}
                </div>
                {group.options.map(tf => (
                  <button key={tf} onClick={() => selectTimeframe(tf)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-border/20 transition-colors
                      ${timeframe === tf ? 'text-accent font-semibold' : 'text-text'}`}>
                    {TF_LABELS[tf]}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="h-5 w-px bg-border" />
      <div ref={ctWrapperRef} className="relative">
        <button
          onClick={() => setCtOpen(o => !o)}
          title="Tipo de gráfica"
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-text hover:bg-border transition-colors"
        >
          <span>{currentChartType.icon}</span>
          <span className="hidden sm:inline">{currentChartType.label}</span>
          <span className="text-[10px] opacity-60">▼</span>
        </button>
        {ctOpen && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-[#1e222d] border border-border rounded shadow-lg z-50">
            {CHART_TYPES.map(c => (
              <button key={c.key}
                onClick={() => { onChartTypeChange?.(c.key); setCtOpen(false) }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-border/20 transition-colors flex items-center gap-2
                  ${chartType === c.key ? 'text-accent font-semibold' : 'text-text'}`}>
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="h-5 w-px bg-border" />
      <button onClick={onOpenIndicators}
        className="px-2 py-1 rounded text-xs font-medium text-text hover:bg-border transition-colors">
        Indicadores{activeCount > 0 && ` (${activeCount})`}
      </button>
    </div>
  )
}
