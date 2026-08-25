import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function PaymentCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [state, setState] = useState({ status: 'loading', message: 'Verifying your payment…', membership: null })

  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref')
    const token = localStorage.getItem('token')

    if (!reference) {
      setState({ status: 'error', message: 'No payment reference was provided.', membership: null })
      return
    }

    if (!token) {
      setState({ status: 'error', message: 'Please sign in again so we can verify your payment.', membership: null })
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

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'We could not verify this payment.')
        }

        setState({
          status: 'success',
          message: data.message || 'Membership payment verified successfully.',
          membership: data.membership || null,
        })
      } catch (error) {
        if (!cancelled) {
          setState({ status: 'error', message: error.message, membership: null })
        }
      }
    }

    verifyPayment()

    return () => {
      cancelled = true
    }
  }, [searchParams])

  if (state.status === 'loading') {
    return (
      <main className="payment-page">
        <div className="payment-card">
          <div className="payment-icon spinner" aria-hidden="true" />
          <p className="eyebrow">KEANU REEVES FAN COMMUNITY</p>
          <h1>Verifying your payment</h1>
          <p>{state.message}</p>
          <p className="muted">Please don't close this page.</p>
        </div>
      </main>
    )
  }

  if (state.status === 'success') {
    return (
      <main className="payment-page">
        <div className="payment-card success-card">
          <div className="payment-icon success-icon" aria-hidden="true">✓</div>
          <p className="eyebrow">PAYMENT CONFIRMED</p>
          <h1>Welcome to the community.</h1>
          <p>{state.message}</p>

          {state.membership && (
            <div className="membership-summary">
              <span>Membership</span>
              <strong>{state.membership.plan || state.membership.name || 'Fan Membership'}</strong>
              <span>Status</span>
              <strong>{state.membership.status || 'ACTIVE'}</strong>
            </div>
          )}

          <div className="payment-actions">
            <Link className="primary-button" to="/membership">View Membership</Link>
            <button className="secondary-button" type="button" onClick={() => navigate('/')}>Return Home</button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="payment-page">
      <div className="payment-card error-card">
        <div className="payment-icon error-icon" aria-hidden="true">!</div>
        <p className="eyebrow">PAYMENT VERIFICATION</p>
        <h1>We couldn't verify the payment.</h1>
        <p>{state.message}</p>
        <p className="muted">Your account has not been shown as successfully activated by this page.</p>
        <div className="payment-actions">
          <button className="primary-button" type="button" onClick={() => window.location.reload()}>Try Again</button>
          <button className="secondary-button" type="button" onClick={() => navigate('/')}>Return Home</button>
        </div>
      </div>
    </main>
  )
}

function Home() {
  return (
    <main className="placeholder-page">
      <h1>Keanu Reeves Fan Community</h1>
      <p>Fan community frontend is ready for development.</p>
    </main>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/payment/callback" element={<PaymentCallback />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
