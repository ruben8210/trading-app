import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { getMe, logout } from './services/auth'
import ChartContainer from './components/Chart/ChartContainer'
import Toolbar from './components/Toolbar/Toolbar'
import AssetInfo from './components/Sidebar/AssetInfo'
import Watchlist from './components/Sidebar/Watchlist'
import IndicatorPanel from './components/Indicators/IndicatorPanel'
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
    <div className="h-screen flex flex-col">
      <header className={`h-12 bg-surface border-b border-border flex items-center px-4 shrink-0 ${fullscreen ? 'hidden' : ''}`}>
        <Link to="/" className="text-lg font-semibold text-text hover:text-white mr-4">Trading App</Link>
        <AssetInfo symbol={symbol} />
        <div className="flex items-center gap-4 ml-auto">
          <button onClick={toggleFullscreen} title="Pantalla completa"
            className="text-text/60 hover:text-white text-sm px-1">⛶</button>
          {user?.role === 'admin' && location.pathname !== '/admin' && (
            <Link to="/admin" className="text-xs text-accent hover:underline">Admin</Link>
          )}
          <button onClick={onLogout} className="text-xs text-text hover:text-white">Salir</button>
        </div>
      </header>
      <Routes>
        <Route path="/" element={
          <>
            <div className={fullscreen ? 'hidden' : ''}>
              <Toolbar
                symbol={symbol}
                onSymbolChange={setSymbol}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                indicators={indicators}
                onIndicatorToggle={handleIndicatorToggle}
                onOpenIndicators={() => setIndicatorPanelOpen(true)}
              />
            </div>
            <main className="flex-1 flex min-h-0 relative">
              <div className={fullscreen ? 'hidden' : ''}>
                <Watchlist onSelect={setSymbol} />
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                {fullscreen && (
                  <button onClick={toggleFullscreen}
                    className="absolute top-2 right-2 z-50 text-text/40 hover:text-white text-xs bg-surface/80 px-2 py-1 rounded">
                    ✕ Salir
                  </button>
                )}
                <ChartContainer symbol={symbol} timeframe={timeframe} indicators={indicators} />
              </div>
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
        <span className="text-text">Cargando...</span>
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
