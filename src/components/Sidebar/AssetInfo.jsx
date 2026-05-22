import { useEffect, useState } from 'react'
import { fetchTicker, isCrypto } from '../../services/api'

export default function AssetInfo({ symbol }) {
  const [price, setPrice] = useState(null)
  const [currency, setCurrency] = useState('USDT')
  const [eurRate, setEurRate] = useState(null)

  useEffect(() => {
    fetch('https://api.exchangerate-api.com/v4/latest/USD')
      .then(r => r.json())
      .then(d => setEurRate(d.rates.EUR))
      .catch(() => {})
  }, [])

  const isCoin = isCrypto(symbol)

  useEffect(() => {
    const pollInterval = isCoin ? 5000 : 30000
    const doFetch = () => {
      fetchTicker(symbol).then(({ price: p }) => setPrice(p)).catch(() => {})
    }
    doFetch()
    const interval = setInterval(doFetch, pollInterval)
    return () => clearInterval(interval)
  }, [symbol, isCoin])

  const displayPrice = currency === 'EUR' && eurRate ? price * eurRate : price
  const currencyLabel = currency === 'EUR' ? 'EUR' : isCoin ? 'USDT' : 'USD'
  const decimals = displayPrice >= 1000 ? 2 : displayPrice >= 1 ? 4 : 6

  return (
    <div className="flex items-center gap-3 px-3 border-l border-border ml-2">
      <span className="text-white font-bold text-sm">{symbol}</span>
      <span className="text-white font-mono text-sm">
        {displayPrice != null
          ? `${displayPrice.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${currencyLabel}`
          : '—'}
      </span>
      {eurRate && (
        <button onClick={() => setCurrency(c => c === 'USDT' ? 'EUR' : 'USDT')}
          className="text-xs text-accent hover:underline">
          {currency === 'USDT' ? 'EUR' : 'USDT'}
        </button>
      )}
    </div>
  )
}
