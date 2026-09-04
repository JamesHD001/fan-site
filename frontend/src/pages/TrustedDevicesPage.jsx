import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/settings.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const formatDate = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export default function TrustedDevicesPage() {
  const { token } = useAuth()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadDevices = async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me/trusted-devices`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load trusted devices.')
      setDevices(data.devices || [])
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  useEffect(() => { if (token) loadDevices() }, [token])

  const revoke = async (id) => {
    setBusy(id); setError(''); setMessage('')
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me/trusted-devices/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to revoke device.')
      setDevices((current) => current.filter((device) => device.id !== id))
      setMessage('Trusted device revoked.')
    } catch (err) { setError(err.message) } finally { setBusy('') }
  }

  const revokeAll = async () => {
    if (!window.confirm('Revoke all remembered devices? You will need your Security Key the next time you sign in on any device.')) return
    setBusy('all'); setError(''); setMessage('')
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me/trusted-devices`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to revoke devices.')
      setDevices([]); setMessage('All trusted devices have been revoked.')
    } catch (err) { setError(err.message) } finally { setBusy('') }
  }

  return <main className="settings-page"><section className="settings-shell"><header className="settings-heading"><div><span className="eyebrow">ACCOUNT SECURITY</span><h1>Trusted devices.</h1><p>Manage devices that can skip your Personal Security Key for up to 30 days.</p></div><Link className="settings-back" to="/settings">← Settings</Link></header>
    {message && <div className="settings-message" role="status">{message}</div>}{error && <div className="settings-error" role="alert">{error}</div>}
    <section className="settings-card"><div className="settings-card-heading"><span className="eyebrow">REMEMBERED DEVICES</span><span>{devices.length} active</span></div>
      {loading ? <p>Loading trusted devices…</p> : devices.length === 0 ? <p>No trusted devices are currently registered. Your Security Key will be required on your next new-device sign-in.</p> : <div className="settings-payments-list">{devices.map((device) => <div key={device.id}><div><b>{device.deviceName || 'Trusted device'} {device.current && '· Current device'}</b><small>Added {formatDate(device.createdAt)} · Last used {formatDate(device.lastUsedAt)} · Expires {formatDate(device.expiresAt)}</small></div><button className="settings-danger" type="button" disabled={busy === device.id} onClick={() => revoke(device.id)}>{busy === device.id ? 'Revoking…' : 'Revoke'}</button></div>)}</div>}
      {!loading && devices.length > 0 && <button className="settings-danger" type="button" disabled={busy === 'all'} onClick={revokeAll}>{busy === 'all' ? 'Revoking…' : 'Revoke all devices'}</button>}
    </section>
    <section className="settings-card"><div className="settings-card-heading"><span className="eyebrow">HOW IT WORKS</span></div><h2>Remember this device</h2><p>When you choose “Remember this device” after entering your Security Key, this browser receives a secure trusted-device token. The token is stored as a protected cookie and its server-side hash is stored in the database. Your Security Key itself is never stored in plain text.</p><Link className="settings-link" to="/settings">Return to security settings →</Link></section>
  </section></main>
}
