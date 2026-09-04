import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/securityKey.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function AuthPage({ mode = 'login' }) {
  const isLogin = mode === 'login'
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated } = useAuth()
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' })
  const [securityKey, setSecurityKey] = useState('')
  const [generatedKey, setGeneratedKey] = useState('')
  const [rememberDevice, setRememberDevice] = useState(false)
  const [step, setStep] = useState('form')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pendingLogin, setPendingLogin] = useState(false)
  const [pendingToken, setPendingToken] = useState('')
  const [pendingUser, setPendingUser] = useState(null)
  const redirectTo = location.state?.from || '/dashboard'

  useEffect(() => { if (isAuthenticated) navigate(redirectTo, { replace: true }) }, [isAuthenticated, navigate, redirectTo])
  const handleChange = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  const completeLogin = (data) => { login(data.token, data.user); navigate(redirectTo, { replace: true }) }

  const submitRegistration = async () => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form) })
    const data = await response.json()
    if (!response.ok || !data.success) throw new Error(data.message || 'Unable to create your account.')
    setGeneratedKey(data.securityKey || '')
    setPendingToken(data.token || '')
    setPendingUser(data.user || null)
    setSecurityKey('')
    setPendingLogin(false)
    setStep('security-key')
  }

  const submitLogin = async () => {
    const payload = { email: form.email, password: form.password, securityKey: securityKey || undefined, rememberDevice }
    const response = await fetch(`${API_BASE_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
    const data = await response.json()
    if (data.requiresSecurityKey && data.securityKey) {
      setGeneratedKey(data.securityKey)
      setPendingToken(data.token || '')
      setPendingUser(data.user || null)
      setSecurityKey('')
      setPendingLogin(false)
      setStep('security-key')
      return
    }
    if (data.requiresSecurityKey) { setStep('security-key'); setPendingLogin(true); throw new Error(data.message || 'Enter your Personal Security Key to continue.') }
    if (!response.ok || !data.success) throw new Error(data.message || 'Authentication failed.')
    completeLogin(data)
  }

  const handleSubmit = async (event) => {
    event.preventDefault(); setError(''); setSubmitting(true)
    try { if (isLogin) await submitLogin(); else await submitRegistration() } catch (e) { setError(e.message) } finally { setSubmitting(false) }
  }

  const handleSecurityKeySubmit = async (event) => {
    event.preventDefault(); setError('')
    if (generatedKey && !pendingLogin) {
      if (!securityKey) return setError('Please confirm that you have saved your Security Key.')
      completeLogin({ token: pendingToken, user: pendingUser })
      return
    }
    setSubmitting(true)
    try { await submitLogin() } catch (e) { setError(e.message) } finally { setSubmitting(false) }
  }

  const copyKey = async () => { try { await navigator.clipboard.writeText(generatedKey) } catch { /* Clipboard may be unavailable. */ } }
  if (isAuthenticated) return <main className="placeholder-page"><p>Redirecting…</p></main>

  const showingKey = step === 'security-key'
  const setupKey = showingKey && Boolean(generatedKey) && !pendingLogin
  const title = isLogin ? (showingKey ? (setupKey ? 'Your Personal Security Key' : 'Enter your Security Key') : 'Welcome back') : (showingKey ? 'Your Personal Secret Key' : 'Join the community')
  const intro = setupKey ? 'This key protects your account. Save it somewhere safe before continuing.' : isLogin ? (showingKey ? 'Enter the secret key you received when your account was created.' : 'Sign in with your email or username and password.') : 'Create your fan account to access memberships, meetings and gifts.'

  return <main className="auth-page"><section className="auth-card">
    <p className="eyebrow">KEANU REEVES FAN COMMUNITY</p><h1>{title}</h1><p className="auth-intro">{intro}</p>
    {error && <div className="auth-error" role="alert">{error}</div>}
    {showingKey ? <form onSubmit={handleSecurityKeySubmit} className="auth-form">
      {generatedKey && <div className="security-key-panel"><span className="security-key-label">PERSONAL SECURITY KEY</span><strong className="security-key-value">{generatedKey}</strong><button type="button" className="auth-resend" onClick={copyKey}>Copy Security Key</button><p>Write it down or store it in a password manager. We do not display this key again after setup.</p></div>}
      {setupKey ? <label className="security-confirm"><input type="checkbox" checked={Boolean(securityKey)} onChange={(e) => setSecurityKey(e.target.checked ? generatedKey : '')} /> I have saved my Security Key and understand that I will need it to sign in on new devices.</label> : <><label>Personal Security Key<input value={securityKey} onChange={(e) => setSecurityKey(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10))} minLength={6} maxLength={10} autoComplete="one-time-code" required /></label><label className="security-confirm"><input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} /> Remember this device for 30 days</label></>}
      <button className="primary-button auth-submit" type="submit" disabled={submitting || (setupKey ? !securityKey : securityKey.length < 6)}>{submitting ? 'Please wait…' : setupKey ? 'Continue to My Account' : 'Verify & Sign In'}</button>
    </form> : <form onSubmit={handleSubmit} className="auth-form">
      {!isLogin && <><label>Full name<input name="name" value={form.name} onChange={handleChange} required autoComplete="name" /></label><label>Username<input name="username" value={form.username} onChange={handleChange} required autoComplete="username" /></label></>}
      <label>Email or username<input name="email" value={form.email} onChange={handleChange} required autoComplete="username" /></label><label>Password<input type="password" name="password" value={form.password} onChange={handleChange} required minLength={8} autoComplete={isLogin ? 'current-password' : 'new-password'} /></label>
      <button className="primary-button auth-submit" type="submit" disabled={submitting}>{submitting ? 'Please wait…' : isLogin ? 'Continue' : 'Create Account'}</button>
      {isLogin && <button type="button" className="auth-resend" onClick={() => navigate('/reset-password')}>Forgot your password?</button>}
    </form>}
    <p className="auth-switch">{isLogin ? "Don't have an account?" : 'Already have an account?'} <button type="button" onClick={() => navigate(isLogin ? '/register' : '/login', { state: { from: redirectTo } })}>{isLogin ? 'Create one' : 'Sign in'}</button></p>
  </section></main>
}
