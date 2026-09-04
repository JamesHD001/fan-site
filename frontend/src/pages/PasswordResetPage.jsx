import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../styles/settings.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function PasswordResetPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ identifier: '', securityKey: '', newPassword: '', confirmPassword: '' })
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
      const response = await fetch(`${API_BASE_URL}/auth/password/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email: form.identifier, securityKey: form.securityKey, newPassword: form.newPassword }) })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to reset your password.')
      setMessage(data.message || 'Password reset successfully.')
      setTimeout(() => navigate('/login', { replace: true }), 1000)
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  return <main className="settings-page"><section className="settings-shell"><header className="settings-heading"><div><span className="eyebrow">ACCOUNT RECOVERY</span><h1>Reset your password.</h1><p>Use the Personal Security Key you received when you created your account.</p></div><Link className="settings-back" to="/login">← Sign in</Link></header>
    {message && <div className="settings-message" role="status">{message}</div>}{error && <div className="settings-error" role="alert">{error}</div>}
    <section className="settings-card password-settings-card"><div className="settings-card-heading"><span className="eyebrow">PASSWORD RECOVERY</span><span>No email required</span></div><h2>Verify your account</h2><p>This recovery method uses your account identifier and Personal Security Key. Keep your Security Key private.</p>
      <form onSubmit={submit}>
        <label>Email or username<input value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} autoComplete="username" required /></label>
        <label>Personal Security Key<input value={form.securityKey} onChange={(e) => setForm({ ...form, securityKey: e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10) })} minLength={6} maxLength={10} autoComplete="one-time-code" required /></label>
        <label>New password<input type={show ? 'text' : 'password'} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} minLength={8} maxLength={128} autoComplete="new-password" required /></label>
        <label>Confirm new password<input type={show ? 'text' : 'password'} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} minLength={8} maxLength={128} autoComplete="new-password" required /></label>
        <label className="security-confirm"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password</label>
        <button className="settings-primary" disabled={saving}>{saving ? 'Resetting password…' : 'Reset password'}</button>
      </form>
      <p className="password-recovery-note">Changing or resetting your password revokes all remembered devices. Your Personal Security Key stays unchanged.</p>
    </section>
  </section></main>
}
