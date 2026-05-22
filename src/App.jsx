import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { getMe, logout } from './services/auth'
import ChartContainer from './components/Chart/ChartContainer'
import Toolbar from './components/Toolbar/Toolbar'
import AssetInfo from './components/Sidebar/AssetInfo'
import Watchlist from './components/Sidebar/Watchlist'
import IndicatorPanel from './components/Indicators/IndicatorPanel'
import OrdersPanel from './components/Orders/OrdersPanel'
import AlertsPanel from './components/Orders/AlertsPanel'
import Login from './components/Login'
import Admin from './pages/Admin'

function AppContent({ user, onLogout }) {
  const location = useLocation()
  const [symbol, setSymbol] = useState('BTC')
  const [timeframe, setTimeframe] = useState('1D')
  const [indicators, setIndicators] = useState({
    sma20: true, sma50: false, ema20: false, rsi: true, macd: true,
    bollinger: false, sr: false,
  })
  const [indicatorPanelOpen, setIndicatorPanelOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [rightPanelTab, setRightPanelTab] = useState('orders')

  const handleIndicatorToggle = (key) => {
    setIndicators(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setFullscreen(false)
    }
  }

  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setFullscreen(false)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-bg">
      <header className={`h-14 bg-surface border-b border-border flex items-center px-4 shrink-0 ${fullscreen ? 'hidden' : ''}`}>
        <Link to="/" className="text-lg font-bold text-white hover:text-accent mr-6">
          📈 Trading
        </Link>
        <AssetInfo symbol={symbol} />
        <div className="flex items-center gap-4 ml-auto">
          <button onClick={toggleFullscreen} title="Pantalla completa"
            className="text-text/60 hover:text-white text-lg px-2 transition">⛶</button>
          {user?.role === 'admin' && location.pathname !== '/admin' && (
            <Link to="/admin" className="text-xs text-accent hover:text-accent/80 font-medium">Admin</Link>
          )}
          <button onClick={onLogout} className="text-xs text-text/60 hover:text-text">Salir</button>
        </div>
      </header>

      <Routes>
        <Route path="/" element={
          <>
            {!fullscreen && <Toolbar
              symbol={symbol}
              onSymbolChange={setSymbol}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              indicators={indicators}
              onIndicatorToggle={handleIndicatorToggle}
              onOpenIndicators={() => setIndicatorPanelOpen(true)}
            />}
            <main className="flex-1 flex min-h-0 relative">
              {!fullscreen && (
                <div className="w-48 border-r border-border overflow-y-auto">
                  <Watchlist onSelect={setSymbol} />
                </div>
              )}
              <div className="flex-1 flex flex-col min-h-0">
                {fullscreen && (
                  <button onClick={toggleFullscreen}
                    className="absolute top-2 right-2 z-50 text-text/40 hover:text-white text-xs bg-surface/80 px-2 py-1 rounded">
                    ✕ Salir
                  </button>
                )}
                <ChartContainer symbol={symbol} timeframe={timeframe} indicators={indicators} />
              </div>
              {!fullscreen && (
                <div className="w-72 border-l border-border flex flex-col">
                  <div className="flex border-b border-border">
                    <button
                      onClick={() => setRightPanelTab('orders')}
                      className={`flex-1 py-2 text-xs font-medium transition ${
                        rightPanelTab === 'orders'
                          ? 'bg-accent text-white'
                          : 'bg-surface text-text/60 hover:text-text'
                      }`}
                    >
                      Órdenes
                    </button>
                    <button
                      onClick={() => setRightPanelTab('alerts')}
                      className={`flex-1 py-2 text-xs font-medium transition ${
                        rightPanelTab === 'alerts'
                          ? 'bg-accent text-white'
                          : 'bg-surface text-text/60 hover:text-text'
                      }`}
                    >
                      Alertas
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {rightPanelTab === 'orders' && <OrdersPanel symbol={symbol} />}
                    {rightPanelTab === 'alerts' && <AlertsPanel symbol={symbol} />}
                  </div>
                </div>
              )}
            </main>
          </>
        } />
        <Route path="/admin" element={<Admin />} />
      </Routes>

      {indicatorPanelOpen && (
        <IndicatorPanel
          indicators={indicators}
          onToggle={handleIndicatorToggle}
          onClose={() => setIndicatorPanelOpen(false)}
        />
      )}
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMe().then(u => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const handleLogin = (user) => setUser(user)
  const handleLogout = () => logout()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg">
        <span className="text-text animate-pulse">Cargando...</span>
      </div>
    )
  }

  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <BrowserRouter>
      <AppContent user={user} onLogout={handleLogout} />
    </BrowserRouter>
  )
}
