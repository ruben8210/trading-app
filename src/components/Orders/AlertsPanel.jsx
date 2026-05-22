import { useState, useEffect } from 'react'

export default function AlertsPanel({ symbol }) {
  const [alerts, setAlerts] = useState([])
  const [formData, setFormData] = useState({ alertType: 'above', price: 0 })
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    loadAlerts()
    const interval = setInterval(loadAlerts, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadAlerts = async () => {
    try {
      const res = await fetch(`/api/v1/alerts`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setAlerts(data.filter(a => a.symbol === symbol.toUpperCase()))
      }
    } catch (err) {
      console.error('Error loading alerts:', err)
    }
  }

  const handleCreateAlert = async () => {
    if (!formData.price) {
      alert('Ingresa el precio')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/v1/alerts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          alert_type: formData.alertType,
          price: parseFloat(formData.price)
        })
      })
      if (res.ok) {
        setFormData({ alertType: 'above', price: 0 })
        setShowForm(false)
        loadAlerts()
      }
    } catch (err) {
      alert('Error creando alerta')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAlert = async (alertId) => {
    try {
      await fetch(`/api/v1/alerts/${alertId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      loadAlerts()
    } catch (err) {
      alert('Error eliminando alerta')
    }
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-text">Alertas {symbol}</h3>
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
              onClick={() => setFormData({ ...formData, alertType: 'above' })}
              className={`flex-1 py-1 rounded text-xs font-medium ${
                formData.alertType === 'above' ? 'bg-green-500 text-white' : 'bg-surface text-text'
              }`}
            >
              ARRIBA
            </button>
            <button
              onClick={() => setFormData({ ...formData, alertType: 'below' })}
              className={`flex-1 py-1 rounded text-xs font-medium ${
                formData.alertType === 'below' ? 'bg-red-500 text-white' : 'bg-surface text-text'
              }`}
            >
              ABAJO
            </button>
          </div>
          <input
            type="number"
            placeholder="Precio alerta"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            className="w-full bg-bg border border-border rounded px-2 py-1 text-sm text-text placeholder-text/50"
          />
          <button
            onClick={handleCreateAlert}
            disabled={loading}
            className="w-full bg-accent hover:bg-accent/80 disabled:opacity-50 text-white text-xs py-1 rounded font-medium"
          >
            {loading ? 'Creando...' : 'Crear Alerta'}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2">
        {alerts.length === 0 ? (
          <p className="text-xs text-text/50 text-center py-4">Sin alertas configuradas</p>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="bg-bg border border-border rounded p-2 text-xs flex justify-between items-center">
              <div>
                <p className="font-semibold">
                  {alert.alert_type === 'above' ? '🔺' : '🔻'} ${alert.price.toFixed(2)}
                </p>
                <p className="text-text/60">{alert.is_active ? 'Activa' : 'Inactiva'}</p>
              </div>
              <button
                onClick={() => handleDeleteAlert(alert.id)}
                className="bg-red-500/20 hover:bg-red-500/40 text-red-400 px-2 py-0.5 rounded text-xs"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
