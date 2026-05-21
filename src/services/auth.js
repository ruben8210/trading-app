const BASE = import.meta.env.VITE_API_URL || '/api/v1'

export async function login(username, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error('Usuario o contraseña incorrectos')
  const data = await res.json()
  localStorage.setItem('trading_token', data.access_token)
  return data
}

export function logout() {
  localStorage.removeItem('trading_token')
  window.location.reload()
}

export async function getMe() {
  const token = localStorage.getItem('trading_token')
  if (!token) return null
  const res = await fetch(`${BASE}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    localStorage.removeItem('trading_token')
    return null
  }
  return res.json()
}

export function isAuthenticated() {
  return !!localStorage.getItem('trading_token')
}
