import { useState } from 'react'
import { login, getMe } from '../services/auth'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      const user = await getMe()
      if (user) onLogin(user)
      else throw new Error('Error al verificar sesión')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-bg">
      <form onSubmit={handleSubmit}
        className="bg-surface border border-border rounded-lg p-8 w-80 shadow-xl">
        <h1 className="text-lg font-semibold text-white text-center mb-6">Trading App</h1>
        {error && (
          <div className="bg-red/10 border border-red text-red text-sm rounded px-3 py-2 mb-4 text-center">
            {error}
          </div>
        )}
        <input
          placeholder="Usuario"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text mb-3 outline-none focus:border-accent"
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text mb-4 outline-none focus:border-accent"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-accent text-white rounded py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
