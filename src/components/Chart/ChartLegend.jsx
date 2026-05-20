export default function ChartLegend({ symbol, data }) {
  const last = data.at(-1)
  if (!last) return null
  const change = last.close - last.open
  const changePct = ((change / last.open) * 100).toFixed(2)
  const isPositive = change >= 0
  return (
    <div className="flex items-center gap-4 px-4 py-1 text-xs font-mono border-b border-border bg-bg">
      <span className="text-white font-bold">{symbol}</span>
      <span className="text-text">O: {last.open?.toFixed(2)}</span>
      <span className="text-text">H: {last.high?.toFixed(2)}</span>
      <span className="text-text">L: {last.low?.toFixed(2)}</span>
      <span className="text-white">C: {last.close?.toFixed(2)}</span>
      <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
        {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePct}%)
      </span>
    </div>
  )
}
