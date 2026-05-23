const BASE = import.meta.env.VITE_API_URL || '/api/v1'
const TOKEN_KEY = 'trading_token'

export async function login(username, password) {
  if (!username || !password) {
    throw new Error('Usuario y contraseña son requeridos')
  }

  try {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Usuario o contraseña incorrectos')
      }
      throw new Error(`Error de autenticación: ${res.status}`)
    }

    const data = await res.json()

    if (!data?.access_token) {
      throw new Error('Token de acceso no recibido')
    }

    localStorage.setItem(TOKEN_KEY, data.access_token)
    return data
  } catch (error) {
    console.error('Error en login:', error)
    throw error
  }
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  window.location.href = '/'
}

export async function getMe() {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return null

  try {
    const res = await fetch(`${BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      localStorage.removeItem(TOKEN_KEY)
      return null
    }

    const data = await res.json()
    return data
  } catch (error) {
    console.warn('Error obteniendo usuario actual:', error)
    localStorage.removeItem(TOKEN_KEY)
    return null
  }
}

export function isAuthenticated() {
  return !!localStorage.getItem(TOKEN_KEY)
}
