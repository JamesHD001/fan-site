import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/settings.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function PasswordSettingsPage() {
  const { token, user, logout } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ currentPassword: '', securityKey: '', newPassword: '', confirmPassword: '' })
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const submit = async (event) => {
    event.preventDefault(); setError(''); setMessage('')
    if (form.newPassword !== form.confirmPassword) return setError('New password and confirmation do not match.')
    if (form.newPassword.length < 8) return setError('Password must be at least 8 characters.')
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me/password/change`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, credentials: 'include', body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword, securityKey: form.securityKey || undefined }) })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to change your password.')
      setMessage(data.message || 'Password changed successfully.')
      setForm({ currentPassword: '', securityKey: '', newPassword: '', confirmPassword: '' })
      setTimeout(async () => { await logout(); navigate('/login', { replace: true }) }, 900)
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const isAdmin = user?.role === 'ADMIN'
  return <main className="settings-page"><section className="settings-shell"><header className="settings-heading"><div><span className="eyebrow">ACCOUNT SECURITY</span><h1>Change password.</h1><p>Update the password used to sign in to your account. Changing it signs out remembered devices.</p></div><Link className="settings-back" to="/settings">← Settings</Link></header>
    {message && <div className="settings-message" role="status">{message}</div>}{error && <div className="settings-error" role="alert">{error}</div>}
    <section className="settings-card password-settings-card"><div className="settings-card-heading"><span className="eyebrow">PASSWORD</span><span>Protected</span></div><h2>Change your password</h2><p>Enter your current password and choose a new one. For normal members, your Personal Security Key is also required for this sensitive action.</p>
      <form onSubmit={submit}>
        <label>Current password<input type={show ? 'text' : 'password'} value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} autoComplete="current-password" required /></label>
        {!isAdmin && <label>Personal Security Key<input value={form.securityKey} onChange={(e) => setForm({ ...form, securityKey: e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10) })} minLength={6} maxLength={10} autoComplete="one-time-code" required /><small>Your Security Key is not changed when you change your password.</small></label>}
        <label>New password<input type={show ? 'text' : 'password'} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} minLength={8} maxLength={128} autoComplete="new-password" required /></label>
        <label>Confirm new password<input type={show ? 'text' : 'password'} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} minLength={8} maxLength={128} autoComplete="new-password" required /></label>
        <label className="security-confirm"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords</label>
        <button className="settings-primary" disabled={saving}>{saving ? 'Changing password…' : 'Change password'}</button>
      </form>
    </section>
    <section className="settings-card"><div className="settings-card-heading"><span className="eyebrow">RECOVERY</span></div><h2>Forgot your password?</h2><p>If you cannot sign in, use your email or username together with your Personal Security Key to reset the password.</p><Link className="settings-secondary" to="/reset-password">Reset password →</Link></section>
  </section></main>
}
