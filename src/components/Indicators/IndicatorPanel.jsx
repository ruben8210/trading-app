import { useEffect, useRef } from 'react'

const overlayIndicators = [
  { key: 'sma20', label: 'SMA 20', color: '#2962ff' },
  { key: 'sma50', label: 'SMA 50', color: '#ff6d00' },
  { key: 'ema20', label: 'EMA 20', color: '#ab47bc' },
  { key: 'bollinger', label: 'Bandas de Bollinger', color: '#fdd835' },
  { key: 'sr', label: 'Soporte/Resistencia automático', color: '#66bb6a' },
]

const panelIndicators = [
  { key: 'rsi', label: 'RSI (14)', color: '#e040fb' },
  { key: 'macd', label: 'MACD', color: '#00bcd4' },
]

export default function IndicatorPanel({ indicators, onToggle, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div ref={ref} className="fixed right-0 top-0 h-full w-72 bg-surface border-l border-border z-50 flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold text-white">Indicadores</span>
          <button onClick={onClose} className="text-text hover:text-white text-lg leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-3">
            <div className="text-xs text-text/60 uppercase tracking-wider font-semibold mb-2">SOBRE EL GRÁFICO</div>
            {overlayIndicators.map(({ key, label, color }) => (
              <button key={key} onClick={() => onToggle(key)}
                className="flex items-center gap-3 w-full px-2 py-2 rounded hover:bg-border/40 text-left">
                <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0
                  ${indicators[key] ? 'bg-accent border-accent text-white' : 'border-border'}`}>
                  {indicators[key] ? '✓' : ''}
                </span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                <span className={`text-xs ${indicators[key] ? 'text-white' : 'text-text'}`}>{label}</span>
              </button>
            ))}
          </div>

          <div className="px-4 py-3 border-t border-border">
            <div className="text-xs text-text/60 uppercase tracking-wider font-semibold mb-2">PANELES SEPARADOS</div>
            {panelIndicators.map(({ key, label, color }) => (
              <button key={key} onClick={() => onToggle(key)}
                className="flex items-center gap-3 w-full px-2 py-2 rounded hover:bg-border/40 text-left">
                <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0
                  ${indicators[key] ? 'bg-accent border-accent text-white' : 'border-border'}`}>
                  {indicators[key] ? '✓' : ''}
                </span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                <span className={`text-xs ${indicators[key] ? 'text-white' : 'text-text'}`}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
