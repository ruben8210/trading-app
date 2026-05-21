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

  const handleIndicatorToggle = (key) => {
    setIndicators(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="h-12 bg-surface border-b border-border flex items-center px-4 shrink-0">
        <Link to="/" className="text-lg font-semibold text-text hover:text-white mr-6">Trading App</Link>
        <div className="flex items-center gap-4 ml-auto">
          {user?.role === 'admin' && location.pathname !== '/admin' && (
            <Link to="/admin" className="text-xs text-accent hover:underline">Admin</Link>
          )}
          <span className="text-xs text-text/60">{user?.username}</span>
          <button onClick={onLogout} className="text-xs text-text hover:text-white">Salir</button>
        </div>
      </header>

      <Routes>
        <Route path="/" element={
          <>
            <Toolbar
              symbol={symbol}
              onSymbolChange={setSymbol}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              indicators={indicators}
              onIndicatorToggle={handleIndicatorToggle}
              onOpenIndicators={() => setIndicatorPanelOpen(true)}
            />
            <main className="flex-1 flex min-h-0 relative">
              <Watchlist onSelect={setSymbol} />
              <div className="flex-1 flex flex-col min-h-0">
                <ChartContainer symbol={symbol} timeframe={timeframe} indicators={indicators} />
              </div>
              <AssetInfo symbol={symbol} />
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
