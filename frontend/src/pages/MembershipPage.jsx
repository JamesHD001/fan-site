import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function MembershipPage() {
  const { token } = useAuth()
  const [plans, setPlans] = useState([])
  const [membership, setMembership] = useState(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const [plansRes, membershipRes] = await Promise.all([
          fetch(`${API_BASE_URL}/memberships/plans`),
          fetch(`${API_BASE_URL}/memberships/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ])

        if (cancelled) return
        const plansData = await plansRes.json()
        if (!cancelled && plansRes.ok && plansData.success) {
          setPlans(plansData.plans || [])
        }

        if (cancelled) return
        const membershipData = await membershipRes.json()
        if (!cancelled && membershipRes.ok && membershipData.success) {
          setMembership(membershipData.membership)
        } else if (!cancelled) {
          setMembership(null)
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load membership information. Please try again.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [token])

  const handlePurchase = async (planId) => {
    setError('')
    setPurchasing(planId)

    try {
      const response = await fetch(`${API_BASE_URL}/memberships/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to start checkout.')
      }

      // Preserve the payment type for the generic callback page.
      localStorage.setItem('pendingPaymentType', 'MEMBERSHIP')
      window.location.href = data.checkout.authorizationUrl
    } catch (err) {
      setError(err.message)
      setPurchasing(null)
    }
  }

  const formatPrice = (plan) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: plan.currency || 'USD',
    }).format(plan.price)

  if (loading) {
    return (
      <main className="placeholder-page">
        <h1>Membership</h1>
        <p>Loading your membership…</p>
      </main>
    )
  }

  return (
    <main className="membership-page">
      <header className="page-header">
        <p className="eyebrow">KEANU REEVES FAN COMMUNITY</p>
        <h1>Membership</h1>

        {membership ? (
          <div className="membership-status">
            <span>Status</span>
            <strong className={membership.status === 'ACTIVE' ? 'status-active' : ''}>
              {membership.status}
            </strong>
            {membership.expiresAt && (
              <>
                <span>Renews / expires</span>
                <strong>{new Date(membership.expiresAt).toLocaleDateString()}</strong>
              </>
            )}
          </div>
        ) : (
          <p>You don&apos;t have an active membership yet. Pick a plan below to join.</p>
        )}
      </header>

      {error && <p className="form-error">{error}</p>}

      <section className="plans-grid">
        {plans.map((plan) => (
          <article
            key={plan._id}
            className={`plan-card${membership?.plan?._id === plan._id ? ' current-plan' : ''}`}
          >
            {plan.badge && <span className="plan-badge">{plan.badge}</span>}
            <h2>{plan.name}</h2>
            <p className="plan-price">
              {formatPrice(plan)}
              <span>/{(plan.durationUnit || 'YEAR').toLowerCase()}</span>
            </p>
            <p className="plan-description">{plan.description}</p>

            {plan.benefits?.length > 0 && (
              <ul className="plan-benefits">
                {plan.benefits.map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
            )}

            {membership?.status === 'ACTIVE' ? (
              <button className="secondary-button" type="button" disabled>
                Current plan
              </button>
            ) : (
              <button
                className="primary-button"
                type="button"
                disabled={purchasing === plan._id}
                onClick={() => handlePurchase(plan._id)}
              >
                {purchasing === plan._id ? 'Redirecting to Paystack…' : `Choose ${plan.name}`}
              </button>
            )}
          </article>
        ))}
      </section>

      {plans.length === 0 && !error && (
        <p>No membership plans are available right now. Check back soon.</p>
      )}

      <p className="muted">
        <Link to="/">← Back to home</Link>
      </p>
    </main>
  )
}
