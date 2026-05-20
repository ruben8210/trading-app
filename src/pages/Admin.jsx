import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMe } from '../services/auth'

const BASE = '/api/trading'

async function getUsers(token) {
  const res = await fetch(`${BASE}/users`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error al obtener usuarios')
  return res.json()
}

async function createUser(token, data) {
  const res = await fetch(`${BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Error al crear usuario')
  }
  return res.json()
}

async function deleteUser(token, id) {
  const res = await fetch(`${BASE}/users/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error al eliminar usuario')
}

export default function Admin() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'user' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const token = localStorage.getItem('trading_token')

  const fetchUsers = useCallback(async () => {
    try {
      const data = await getUsers(token)
      setUsers(data)
    } catch { setError('Error al cargar usuarios') }
  }, [token])

  useEffect(() => {
    if (!token) { navigate('/'); return }
    getMe().then(u => {
      setUser(u)
      if (u.role !== 'admin') { navigate('/'); return }
      fetchUsers()
    }).catch(() => navigate('/'))
  }, [token, navigate, fetchUsers])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      await createUser(token, form)
      setSuccess('Usuario creado correctamente')
      setForm({ username: '', email: '', password: '', role: 'user' })
      fetchUsers()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (id, username) => {
    if (!window.confirm(`¿Eliminar usuario "${username}"?`)) return
    try {
      await deleteUser(token, id)
      fetchUsers()
    } catch { setError('Error al eliminar usuario') }
  }

  if (!user) return null

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <h1 className="text-xl font-semibold text-white mb-6">Panel de Administración</h1>

      {error && <div className="bg-red/10 border border-red text-red text-sm rounded px-4 py-2 mb-4">{error}</div>}
      {success && <div className="bg-green/10 border border-green text-green text-sm rounded px-4 py-2 mb-4">{success}</div>}

      <div className="flex gap-6 flex-wrap">
        <div className="bg-surface border border-border rounded p-4 flex-1 min-w-[300px]">
          <h2 className="text-sm font-semibold text-white mb-3">Crear Usuario</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <input placeholder="Username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              className="bg-bg border border-border rounded px-3 py-2 text-sm text-text" required />
            <input type="email" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="bg-bg border border-border rounded px-3 py-2 text-sm text-text" required />
            <input type="password" placeholder="Password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="bg-bg border border-border rounded px-3 py-2 text-sm text-text" required />
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="bg-bg border border-border rounded px-3 py-2 text-sm text-text">
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
            <button type="submit" className="bg-accent text-white rounded px-4 py-2 text-sm font-medium hover:opacity-90">
              Crear usuario
            </button>
          </form>
        </div>

        <div className="bg-surface border border-border rounded p-4 flex-[2] min-w-[400px]">
          <h2 className="text-sm font-semibold text-white mb-3">Usuarios ({users.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-text">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4">Username</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Rol</th>
                  <th className="py-2 pr-4">Creado</th>
                  <th className="py-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-border/20">
                    <td className="py-2 pr-4 text-white">{u.username}</td>
                    <td className="py-2 pr-4">{u.email}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${u.role === 'admin' ? 'bg-accent/20 text-accent' : 'bg-border/40 text-text'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    <td className="py-2">
                      <button onClick={() => handleDelete(u.id, u.username)}
                        className="text-red hover:text-red/80 text-xs">Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
