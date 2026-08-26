import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import MembershipCard from '../components/membership/MembershipCard'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const fromMinorUnits = (amount) => Number(amount || 0) / 100
const formatCurrency = (amount, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(fromMinorUnits(amount))
const tierClass = (name = '') => name.toLowerCase().replace(/\s+/g, '-')

export default function MembershipPage() {
  const { token, user } = useAuth()
  const [plans, setPlans] = useState([])
  const [membership, setMembership] = useState(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const plansResponse = await fetch(`${API_BASE_URL}/memberships/plans`)
        const plansData = await plansResponse.json()
        if (!cancelled && plansResponse.ok && plansData.success) setPlans(plansData.plans || [])
        if (token) {
          const membershipResponse = await fetch(`${API_BASE_URL}/memberships/me`, { headers: { Authorization: `Bearer ${token}` } })
          const membershipData = await membershipResponse.json()
          if (!cancelled && membershipResponse.ok && membershipData.success) setMembership(membershipData.membership)
          else if (!cancelled) setMembership(null)
        }
      } catch {
        if (!cancelled) setError('Unable to load membership information. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()
    return () => { cancelled = true }
  }, [token])

  const handlePurchase = async (planId) => {
    setError('')
    setPurchasing(planId)
    try {
      const response = await fetch(`${API_BASE_URL}/memberships/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to start checkout.')
      localStorage.setItem('pendingPaymentType', 'MEMBERSHIP')
      window.location.href = data.checkout.authorizationUrl
    } catch (err) {
      setError(err.message)
      setPurchasing(null)
    }
  }

  if (loading) return <main className="membership-experience"><section className="membership-loading"><span className="eyebrow">KEANU REEVES FAN COMMUNITY</span><div className="loading-orb" /><h1>Preparing your membership.</h1><p>Loading the community tiers…</p></section></main>

  const activePlan = membership?.plan && typeof membership.plan === 'object' ? membership.plan : plans.find((plan) => plan._id === membership?.plan)
  const memberName = user?.name || user?.fullName || user?.username || 'Community Member'
  const memberNumber = membership?.membershipNumber || membership?.number || 'KR-••••••'

  return (
    <main className="membership-experience">
      <section className="membership-hero page-container">
        <div><p className="eyebrow">THE INNER CIRCLE</p><h1>Choose your<br /><em>place</em> in the community.</h1><p className="membership-hero-copy">Membership is your gateway to a deeper fan experience—exclusive content, recognition, events and priority access.</p></div>
        <div className="membership-hero-mark" aria-hidden="true"><span>KR</span><small>EST. COMMUNITY</small></div>
      </section>

      {membership?.status === 'ACTIVE' && activePlan && (
        <section className="current-membership-section page-container">
          <div className="current-membership"><div><span className="eyebrow">YOUR MEMBERSHIP</span><h2>{activePlan.name || 'Fan Member'}</h2></div><div className="current-membership-meta"><span>STATUS<strong>{membership.status}</strong></span>{membership.expiresAt && <span>EXPIRES<strong>{new Date(membership.expiresAt).toLocaleDateString()}</strong></span>}<span>MEMBER<strong>{memberName}</strong></span></div></div>
          <div className="member-card-showcase"><div className="member-card-copy"><span className="eyebrow">YOUR DIGITAL MEMBERSHIP CARD</span><h2>A place that<br /><em>belongs to you.</em></h2><p>Your membership tier is represented by a digital card designed for your fan profile. Keep it as your visual mark inside the community.</p></div><MembershipCard plan={activePlan} memberName={memberName} memberNumber={memberNumber} /></div>
        </section>
      )}

      {error && <div className="membership-alert page-container" role="alert">{error}</div>}

      <section className="plans-section page-container">
        <div className="section-intro"><div><span className="eyebrow">MEMBERSHIP TIERS</span><h2>Three ways to belong.</h2></div><p>Every tier is designed around the same community—your level simply determines how much more of the experience opens up.</p></div>
        <div className="premium-plans">
          {plans.map((plan, index) => {
            const current = membership?.plan?._id === plan._id || membership?.plan === plan._id
            const featured = plan.name === 'Insider'
            return <article key={plan._id} className={`premium-plan premium-plan-${tierClass(plan.name)} ${featured ? 'is-featured' : ''} ${current ? 'is-current' : ''}`}>
              <div className="plan-topline"><span>0{index + 1}</span>{featured && <b>RECOMMENDED</b>}</div><div className="plan-symbol" aria-hidden="true">{plan.name.slice(0, 1)}</div><p className="plan-tier">{plan.badge || plan.name}</p><h3>{plan.name}</h3><p className="plan-price-large">{formatCurrency(plan.price, plan.currency || 'USD')}<small> / {(plan.durationUnit || 'YEAR').toLowerCase()}</small></p><p className="plan-description-large">{plan.description}</p><div className="plan-divider" /><ul>{plan.benefits?.map((benefit) => <li key={benefit}><span>✓</span>{benefit}</li>)}</ul><div className="plan-action">{current ? <button className="button button-ghost" disabled>Current membership</button> : <button className="button button-primary" disabled={purchasing === plan._id} onClick={() => handlePurchase(plan._id)}>{purchasing === plan._id ? 'Opening secure checkout…' : `Join ${plan.name}`}</button>}</div>
            </article>
          })}
        </div>
      </section>

      <section className="membership-note"><div className="page-container membership-note-inner"><span className="eyebrow">A DIGITAL MEMBERSHIP CARD</span><h2>Carry your place<br />with you.</h2><p>Once your membership is activated, your tier becomes part of your fan profile and digital membership experience.</p><Link className="text-link" to="/community">Enter the community <span>→</span></Link></div></section>
      {plans.length === 0 && !error && <section className="empty-membership page-container"><h2>Membership is being prepared.</h2><p>Check back soon for available community tiers.</p></section>}
      <div className="membership-back page-container"><Link to="/">← Back to home</Link></div>
    </main>
  )
}
