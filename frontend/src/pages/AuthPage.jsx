import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function AuthPage({ mode = 'login' }) {
  const isLogin = mode === 'login'
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated } = useAuth()

  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) {
    navigate('/', { replace: true })
    return null
  }

  const redirectTo = location.state?.from || '/'

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register'
      const body = isLogin
        ? { email: form.email, password: form.password }
        : form

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Authentication failed.')
      }

      login(data.token, data.user)
      navigate(redirectTo, { replace: true })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">KEANU REEVES FAN COMMUNITY</p>
        <h1>{isLogin ? 'Welcome back' : 'Join the community'}</h1>
        <p className="auth-intro">
          {isLogin
            ? 'Sign in to continue to your fan community experience.'
            : 'Create your fan account to access memberships, meetings and gifts.'}
        </p>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <>
              <label>
                Full name
                <input name="name" value={form.name} onChange={handleChange} required autoComplete="name" />
              </label>
              <label>
                Username
                <input name="username" value={form.username} onChange={handleChange} required autoComplete="username" />
              </label>
            </>
          )}

          <label>
            Email
            <input type="email" name="email" value={form.email} onChange={handleChange} required autoComplete="email" />
          </label>

          <label>
            Password
            <input type="password" name="password" value={form.password} onChange={handleChange} required minLength={8} autoComplete={isLogin ? 'current-password' : 'new-password'} />
          </label>

          <button className="primary-button auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Please wait…' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="auth-switch">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button type="button" onClick={() => navigate(isLogin ? '/register' : '/login')}>
            {isLogin ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </section>
    </main>
  )
}
