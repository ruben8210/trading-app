import { useState, useEffect, useMemo } from 'react'

const PERIODS = [
  { key: 'day', label: 'Día' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'year', label: 'Año' },
  { key: 'all', label: 'Todo' },
]

function periodStart(period) {
  const now = new Date()
  if (period === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (period === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  if (period === 'year') return new Date(now.getFullYear(), 0, 1).getTime()
  return 0
}

function formatCurrency(n) {
  if (n == null) return '—'
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(d) {
  const dt = new Date(d)
  return dt.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function PortfolioPanel({ open, onClose }) {
  const [orders, setOrders] = useState([])
  const [period, setPeriod] = useState('all')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/v1/orders', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [open])

  const filtered = useMemo(() => {
    const start = periodStart(period)
    return orders.filter(o => {
      const t = new Date(o.closed_at || o.created_at).getTime()
      return t >= start
    })
  }, [orders, period])

  const closed = filtered.filter(o => o.status === 'closed' && o.pnl != null)
  const open_ = filtered.filter(o => o.status === 'filled')

  const stats = useMemo(() => {
    const totalPnl = closed.reduce((s, o) => s + (o.pnl || 0), 0)
    const wins = closed.filter(o => o.pnl > 0).length
    const losses = closed.filter(o => o.pnl < 0).length
    const total = closed.length
    const winRate = total > 0 ? (wins / total) * 100 : 0
    const avg = total > 0 ? totalPnl / total : 0
    const best = closed.reduce((m, o) => o.pnl > (m?.pnl || -Infinity) ? o : m, null)
    const worst = closed.reduce((m, o) => o.pnl < (m?.pnl || Infinity) ? o : m, null)

    const bySymbol = {}
    closed.forEach(o => {
      if (!bySymbol[o.symbol]) bySymbol[o.symbol] = { symbol: o.symbol, pnl: 0, count: 0 }
      bySymbol[o.symbol].pnl += o.pnl || 0
      bySymbol[o.symbol].count += 1
    })
    const top = Object.values(bySymbol).sort((a, b) => b.pnl - a.pnl)

    return { totalPnl, wins, losses, total, winRate, avg, best, worst, top }
  }, [closed])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface border-l border-border h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text">Portfolio / Operaciones</h2>
          <button onClick={onClose} className="text-text/60 hover:text-text text-lg">✕</button>
        </div>

        <div className="flex gap-1 p-2 border-b border-border">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                period === p.key ? 'bg-accent text-white' : 'bg-bg text-text/60 hover:text-text'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {loading && <p className="text-xs text-text/50 text-center">Cargando...</p>}

          {!loading && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-bg border border-border rounded p-2">
                  <p className="text-[10px] text-text/50 uppercase tracking-wider">P&L Total</p>
                  <p className={`text-lg font-bold ${stats.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${formatCurrency(stats.totalPnl)}
                  </p>
                </div>
                <div className="bg-bg border border-border rounded p-2">
                  <p className="text-[10px] text-text/50 uppercase tracking-wider">Operaciones</p>
                  <p className="text-lg font-bold text-text">{stats.total}</p>
                  <p className="text-[10px] text-text/50">{open_.length} abiertas</p>
                </div>
                <div className="bg-bg border border-border rounded p-2">
                  <p className="text-[10px] text-text/50 uppercase tracking-wider">% Aciertos</p>
                  <p className="text-lg font-bold text-text">{stats.winRate.toFixed(1)}%</p>
                  <p className="text-[10px] text-text/50">
                    <span className="text-green-400">{stats.wins}W</span> / <span className="text-red-400">{stats.losses}L</span>
                  </p>
                </div>
                <div className="bg-bg border border-border rounded p-2">
                  <p className="text-[10px] text-text/50 uppercase tracking-wider">Media / op</p>
                  <p className={`text-lg font-bold ${stats.avg >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${formatCurrency(stats.avg)}
                  </p>
                </div>
              </div>

              {stats.best && (
                <div className="bg-bg border border-border rounded p-2 text-xs">
                  <p className="text-[10px] text-text/50 uppercase tracking-wider mb-1">Mejor / Peor</p>
                  <div className="flex justify-between">
                    <span className="text-green-400">▲ {stats.best.symbol} +${formatCurrency(stats.best.pnl)}</span>
                    {stats.worst && stats.worst !== stats.best && (
                      <span className="text-red-400">▼ {stats.worst.symbol} ${formatCurrency(stats.worst.pnl)}</span>
                    )}
                  </div>
                </div>
              )}

              {stats.top.length > 0 && (
                <div>
                  <h3 className="text-[10px] text-text/50 uppercase tracking-wider mb-1 px-1">Por activo</h3>
                  <div className="bg-bg border border-border rounded divide-y divide-border">
                    {stats.top.map(t => (
                      <div key={t.symbol} className="flex justify-between items-center px-2 py-1.5 text-xs">
                        <div>
                          <span className="font-semibold text-text">{t.symbol}</span>
                          <span className="text-text/50 ml-2">({t.count})</span>
                        </div>
                        <span className={t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {t.pnl >= 0 ? '+' : ''}${formatCurrency(t.pnl)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-[10px] text-text/50 uppercase tracking-wider mb-1 px-1">Historial</h3>
                <div className="space-y-1">
                  {closed.length === 0 && (
                    <p className="text-xs text-text/50 text-center py-3">Sin operaciones cerradas</p>
                  )}
                  {closed.slice().reverse().map(o => (
                    <div key={o.id} className="bg-bg border border-border rounded p-2 text-xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className={`font-semibold ${o.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                            {o.side.toUpperCase()}
                          </span>
                          <span className="text-text ml-1 font-semibold">{o.symbol}</span>
                          <span className="text-text/60 ml-2">x{o.quantity}</span>
                        </div>
                        <span className="text-text/50">{formatDate(o.closed_at || o.created_at)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-text/60">
                          ${o.entry_price?.toFixed(2)} → ${o.exit_price?.toFixed(2)}
                        </span>
                        <div className="text-right">
                          <span className={o.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {o.pnl >= 0 ? '+' : ''}${formatCurrency(o.pnl)}
                          </span>
                          {o.pnl_percent != null && (
                            <span className={`ml-1 ${o.pnl_percent >= 0 ? 'text-green-400/60' : 'text-red-400/60'}`}>
                              ({o.pnl_percent >= 0 ? '+' : ''}{o.pnl_percent.toFixed(2)}%)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
