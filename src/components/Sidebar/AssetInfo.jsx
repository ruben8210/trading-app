import { useEffect, useState, useRef } from 'react'
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
    <div className="bg-surface border-l border-border p-4 flex flex-col gap-4">
      <div>
        <div className="text-text text-xs uppercase tracking-wider mb-1">Símbolo</div>
        <div className="text-white font-bold text-lg">{symbol}</div>
      </div>
      <div>
        <div className="text-text text-xs uppercase tracking-wider mb-1">Precio</div>
        <div className="text-white font-mono text-base">
          {displayPrice != null
            ? `${displayPrice.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${currencyLabel}`
            : '—'}
        </div>
      </div>
      {eurRate && (
        <button onClick={() => setCurrency(c => c === 'USDT' ? 'EUR' : 'USDT')}
          className="text-xs text-accent hover:underline self-start">
          Mostrar en {currency === 'USDT' ? 'EUR' : 'USDT'}
        </button>
      )}
      <div className="text-text text-xs mt-auto">
        {isCoin ? 'Cada 5 seg.' : 'Cada 30 seg.'}
      </div>
    </div>
  )
}
