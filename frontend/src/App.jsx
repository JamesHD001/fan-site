import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import './App.css'
import { AuthProvider, useAuth } from './context/AuthContext'
import AuthPage from './pages/AuthPage'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function ProtectedRoute({ children }) {
  const { loading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (loading) return <main className="placeholder-page"><p>Loading your account…</p></main>
  if (!isAuthenticated) return <NavigateToLogin from={location.pathname + location.search} />
  return children
}

function NavigateToLogin({ from }) {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/login', { replace: true, state: { from } })
  }, [navigate, from])

  return <main className="placeholder-page"><p>Redirecting to sign in…</p></main>
}

function PaymentCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { token, loading: authLoading, isAuthenticated } = useAuth()
  const [state, setState] = useState({ status: 'loading', message: 'Verifying your payment…', membership: null })

  useEffect(() => {
    if (authLoading) return

    const reference = searchParams.get('reference') || searchParams.get('trxref')

    if (!reference) {
      setState({ status: 'error', message: 'No payment reference was provided.', membership: null })
      return
    }

    if (!isAuthenticated || !token) {
      navigate('/login', {
        replace: true,
        state: { from: `/payment/callback?reference=${encodeURIComponent(reference)}` },
      })
      return
    }

    let cancelled = false

    const verifyPayment = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/membership/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reference }),
        })

        const data = await response.json()

        if (cancelled) return
        if (!response.ok || !data.success) throw new Error(data.message || 'We could not verify this payment.')

        setState({
          status: 'success',
          message: data.message || 'Membership payment verified successfully.',
          membership: data.membership || null,
        })
      } catch (error) {
        if (!cancelled) setState({ status: 'error', message: error.message, membership: null })
      }
    }

    verifyPayment()
    return () => { cancelled = true }
  }, [authLoading, isAuthenticated, navigate, searchParams, token])

  if (authLoading || (state.status === 'loading' && !isAuthenticated)) {
    return <main className="payment-page"><div className="payment-card"><div className="payment-icon spinner" /><p className="eyebrow">KEANU REEVES FAN COMMUNITY</p><h1>Checking your account</h1><p>Preparing secure payment verification…</p></div></main>
  }

  if (state.status === 'loading') {
    return <main className="payment-page"><div className="payment-card"><div className="payment-icon spinner" /><p className="eyebrow">KEANU REEVES FAN COMMUNITY</p><h1>Verifying your payment</h1><p>{state.message}</p><p className="muted">Please don't close this page.</p></div></main>
  }

  if (state.status === 'success') {
    return <main className="payment-page"><div className="payment-card success-card"><div className="payment-icon success-icon">✓</div><p className="eyebrow">PAYMENT CONFIRMED</p><h1>Welcome to the community.</h1><p>{state.message}</p>{state.membership && <div className="membership-summary"><span>Membership</span><strong>{state.membership.plan || state.membership.name || 'Fan Membership'}</strong><span>Status</span><strong>{state.membership.status || 'ACTIVE'}</strong></div>}<div className="payment-actions"><Link className="primary-button" to="/membership">View Membership</Link><button className="secondary-button" type="button" onClick={() => navigate('/')}>Return Home</button></div></div></main>
  }

  return <main className="payment-page"><div className="payment-card error-card"><div className="payment-icon error-icon">!</div><p className="eyebrow">PAYMENT VERIFICATION</p><h1>We couldn't verify the payment.</h1><p>{state.message}</p><p className="muted">Your account has not been shown as successfully activated by this page.</p><div className="payment-actions"><button className="primary-button" type="button" onClick={() => window.location.reload()}>Try Again</button><button className="secondary-button" type="button" onClick={() => navigate('/')}>Return Home</button></div></div></main>
}

function Home() {
  const { user, logout } = useAuth()
  return <main className="placeholder-page"><h1>Keanu Reeves Fan Community</h1><p>{user ? `Welcome, ${user.name}.` : 'Fan community frontend is ready for development.'}</p>{user ? <button className="secondary-button" onClick={logout}>Sign Out</button> : <p><Link to="/login">Sign in</Link> or <Link to="/register">create an account</Link>.</p>}</main>
}

function MembershipPlaceholder() {
  return <main className="placeholder-page"><h1>Membership</h1><p>Your membership dashboard will be built next.</p></main>
}

function App() {
  return <AuthProvider><BrowserRouter><Routes><Route path="/" element={<Home />} /><Route path="/login" element={<AuthPage mode="login" />} /><Route path="/register" element={<AuthPage mode="register" />} /><Route path="/payment/callback" element={<PaymentCallback />} /><Route path="/membership" element={<ProtectedRoute><MembershipPlaceholder /></ProtectedRoute>} /><Route path="*" element={<Home />} /></Routes></BrowserRouter></AuthProvider>
}

export default App
