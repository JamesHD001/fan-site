import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/settings.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function SettingsPage() {
  const { token, user, logout } = useAuth()
  const [profile, setProfile] = useState({ name: '', username: '', email: '' })
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system')
  const [payments, setPayments] = useState([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { if (user) setProfile({ name: user.name || '', username: user.username || '', email: user.email || '' }) }, [user])
  useEffect(() => { const resolved = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme; localStorage.setItem('theme', theme); document.documentElement.dataset.theme = resolved }, [theme])
  useEffect(() => { if (!token) return; fetch(`${API_BASE_URL}/memberships/payments`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then((d) => setPayments(d.payments || [])).catch(() => {}) }, [token])

  const handleSave = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(profile) })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to update your profile.')
      setMessage('Profile updated successfully.')
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  return <main className="settings-page"><section className="settings-shell"><header className="settings-heading"><div><span className="eyebrow">ACCOUNT SETTINGS</span><h1>Manage your account.</h1><p>Update your profile, choose your appearance, review payments and manage your session.</p></div><Link className="settings-back" to="/dashboard">← Dashboard</Link></header>
    {message && <div className="settings-message" role="status">{message}</div>}{error && <div className="settings-error" role="alert">{error}</div>}
    <div className="settings-grid">
      <section className="settings-card settings-profile"><div className="settings-card-heading"><span className="eyebrow">PROFILE</span></div><form onSubmit={handleSave}><label>Full name<input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required minLength="2" /></label><label>Username<input value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })} required minLength="3" /></label><label>Email<input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} required /></label><button className="settings-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></form></section>
      <section className="settings-card"><div className="settings-card-heading"><span className="eyebrow">APPEARANCE</span></div><h2>Theme</h2><p>Choose how the community looks on your device.</p><div className="theme-options">{['system', 'light', 'dark'].map((option) => <button key={option} type="button" className={theme === option ? 'selected' : ''} onClick={() => setTheme(option)}>{option[0].toUpperCase() + option.slice(1)}{theme === option && <span>✓</span>}</button>)}</div></section>
      <section className="settings-card settings-payments"><div className="settings-card-heading"><span className="eyebrow">PAYMENT HISTORY</span><span>{payments.length} record{payments.length === 1 ? '' : 's'}</span></div>{payments.length === 0 ? <p>No payment history yet.</p> : <div className="settings-payments-list">{payments.slice(0, 8).map((payment) => <div key={payment._id}><div><b>{payment.membership?.plan?.name || payment.type || 'Payment'}</b><small>{new Date(payment.paidAt || payment.createdAt).toLocaleDateString()}</small></div><strong>{payment.status || '—'}</strong></div>)}</div>}<Link className="settings-link" to="/membership/payments">Open full payment history →</Link></section>
      <section className="settings-card settings-security"><div className="settings-card-heading"><span className="eyebrow">SECURITY</span></div><h2>Account security</h2><p>Password changes and verification controls will live here as the account security system expands.</p><button className="settings-danger" type="button" onClick={logout}>Sign out</button></section>
    </div>
  </section></main>
}
