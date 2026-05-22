import { useState, useEffect } from 'react'

export default function OrdersPanel({ symbol }) {
  const [orders, setOrders] = useState([])
  const [formData, setFormData] = useState({ side: 'buy', quantity: 1, entryPrice: 0 })
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    loadOrders()
    const interval = setInterval(loadOrders, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadOrders = async () => {
    try {
      const res = await fetch(`/api/v1/orders`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setOrders(data.filter(o => o.symbol === symbol.toUpperCase()))
      }
    } catch (err) {
      console.error('Error loading orders:', err)
    }
  }

  const handleCreateOrder = async () => {
    if (!formData.entryPrice || !formData.quantity) {
      alert('Completa cantidad y precio')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/v1/orders`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          side: formData.side,
          quantity: parseFloat(formData.quantity),
          entry_price: parseFloat(formData.entryPrice)
        })
      })
      if (res.ok) {
        setFormData({ side: 'buy', quantity: 1, entryPrice: 0 })
        setShowForm(false)
        loadOrders()
      }
    } catch (err) {
      alert('Error creando orden')
    } finally {
      setLoading(false)
    }
  }

  const handleCloseOrder = async (orderId, exitPrice) => {
    try {
      const res = await fetch(`/api/v1/orders/${orderId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exit_price: parseFloat(exitPrice), status: 'closed' })
      })
      if (res.ok) loadOrders()
    } catch (err) {
      alert('Error cerrando orden')
    }
  }

  const handleCancelOrder = async (orderId) => {
    try {
      await fetch(`/api/v1/orders/${orderId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      loadOrders()
    } catch (err) {
      alert('Error cancelando orden')
    }
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-text">Órdenes {symbol}</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs bg-accent hover:bg-accent/80 text-white px-2 py-1 rounded"
        >
          {showForm ? 'Cerrar' : 'Nueva'}
        </button>
      </div>

      {showForm && (
        <div className="bg-bg border border-border rounded p-3 mb-4 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => setFormData({ ...formData, side: 'buy' })}
              className={`flex-1 py-1 rounded text-xs font-medium ${
                formData.side === 'buy' ? 'bg-green-500 text-white' : 'bg-surface text-text'
              }`}
            >
              COMPRAR
            </button>
            <button
              onClick={() => setFormData({ ...formData, side: 'sell' })}
              className={`flex-1 py-1 rounded text-xs font-medium ${
                formData.side === 'sell' ? 'bg-red-500 text-white' : 'bg-surface text-text'
              }`}
            >
              VENDER
            </button>
          </div>
          <input
            type="number"
            placeholder="Cantidad"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            className="w-full bg-bg border border-border rounded px-2 py-1 text-sm text-text placeholder-text/50"
          />
          <input
            type="number"
            placeholder="Precio entrada"
            value={formData.entryPrice}
            onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
            className="w-full bg-bg border border-border rounded px-2 py-1 text-sm text-text placeholder-text/50"
          />
          <button
            onClick={handleCreateOrder}
            disabled={loading}
            className="w-full bg-accent hover:bg-accent/80 disabled:opacity-50 text-white text-xs py-1 rounded font-medium"
          >
            {loading ? 'Enviando...' : 'Crear Orden'}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2">
        {orders.length === 0 ? (
          <p className="text-xs text-text/50 text-center py-4">Sin órdenes abiertas</p>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="bg-bg border border-border rounded p-2 text-xs space-y-1">
              <div className="flex justify-between items-start">
                <div>
                  <span className={`font-semibold ${order.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                    {order.side.toUpperCase()} {order.quantity}
                  </span>
                  <p className="text-text/60">@ ${order.entry_price.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  {order.pnl !== null ? (
                    <>
                      <p className={order.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                        ${order.pnl.toFixed(2)}
                      </p>
                      <p className={order.pnl_percent >= 0 ? 'text-green-400/60' : 'text-red-400/60'}>
                        {order.pnl_percent.toFixed(2)}%
                      </p>
                    </>
                  ) : (
                    <p className="text-text/50">Abierta</p>
                  )}
                </div>
              </div>
              {order.status === 'filled' && (
                <div className="flex gap-1 mt-2">
                  <input
                    type="number"
                    placeholder="Precio salida"
                    className="flex-1 bg-surface border border-border rounded px-1 py-0.5 text-xs"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && e.target.value) {
                        handleCloseOrder(order.id, e.target.value)
                      }
                    }}
                  />
                  <button
                    onClick={() => handleCancelOrder(order.id)}
                    className="bg-red-500/20 hover:bg-red-500/40 text-red-400 px-1 rounded text-xs"
                  >
                    X
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
