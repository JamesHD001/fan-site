import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/dashboard.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'

export default function DashboardPage() {
  const { token, user } = useAuth()
  const [membership, setMembership] = useState(null)
  const [card, setCard] = useState(null)
  const [payments, setPayments] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const headers = { Authorization: `Bearer ${token}` }

    const loadDashboard = async () => {
      try {
        const [membershipResponse, cardResponse, paymentsResponse, notificationsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/memberships/me`, { headers }),
          fetch(`${API_BASE_URL}/memberships/card`, { headers }),
          fetch(`${API_BASE_URL}/memberships/payments`, { headers }),
          fetch(`${API_BASE_URL}/notifications?limit=5`, { headers }),
        ])

        const [membershipData, cardData, paymentsData, notificationsData] = await Promise.all([
          membershipResponse.json(), cardResponse.json(), paymentsResponse.json(), notificationsResponse.json(),
        ])

        if (!cancelled) {
          setMembership(membershipData.membership || null)
          setCard(cardData.card || null)
          setPayments(paymentsData.payments || [])
          setNotifications(notificationsData.notifications || [])
          if (!membershipResponse.ok && membershipResponse.status !== 404) setError(membershipData.message || 'Unable to load membership.')
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unable to load your dashboard.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (token) loadDashboard()
    return () => { cancelled = true }
  }, [token])

  if (loading) return <main className="dashboard-page"><section className="dashboard-shell dashboard-loading"><span className="eyebrow">KEANU REEVES FAN COMMUNITY</span><h1>Preparing your dashboard…</h1><p>Loading your member experience.</p></section></main>

  const name = user?.name || user?.fullName || user?.username || 'Member'
  const planName = membership?.plan?.name || membership?.plan || card?.membershipType || 'No membership'
  const status = membership?.status || card?.status || 'NOT ACTIVE'
  const memberNumber = card?.membershipNumber || membership?.membershipNumber || 'Not assigned'
  const expiresAt = card?.expiresAt || membership?.expiresAt

  return (
    <main className="dashboard-page">
      <section className="dashboard-shell">
        <header className="dashboard-heading">
          <div><span className="eyebrow">MEMBER DASHBOARD</span><h1>Welcome back, {name}.</h1><p>Your community membership, activity and account information in one place.</p></div>
          <div className="dashboard-heading-actions"><Link className="dashboard-button secondary" to="/settings">Settings</Link><Link className="dashboard-button primary" to="/notifications">Notifications</Link></div>
        </header>

        {error && <div className="dashboard-alert" role="alert">{error}</div>}

        <section className="dashboard-grid dashboard-overview">
          <article className="dashboard-card dashboard-membership-card">
            <div className="dashboard-card-heading"><span className="eyebrow">MEMBERSHIP</span><Link to="/membership">View →</Link></div>
            <div className="dashboard-membership-tier"><span>{planName}</span><b className={`dashboard-status status-${String(status).toLowerCase()}`}>{String(status).replaceAll('_', ' ')}</b></div>
            <div className="dashboard-stats"><span>MEMBER NUMBER<strong>{memberNumber}</strong></span><span>EXPIRES<strong>{formatDate(expiresAt)}</strong></span></div>
          </article>

          <article className="dashboard-card">
            <div className="dashboard-card-heading"><span className="eyebrow">DIGITAL CARD</span><Link to="/membership">Open →</Link></div>
            <h2>{card ? 'Your card is active.' : 'No active card yet.'}</h2>
            <p>{card ? 'Your membership card is linked to your current membership record.' : 'Activate a membership to receive your digital card.'}</p>
            <Link className="dashboard-text-link" to="/membership">{card ? 'View membership card →' : 'Explore memberships →'}</Link>
          </article>
        </section>

        <section className="dashboard-grid dashboard-lower">
          <article className="dashboard-card">
            <div className="dashboard-card-heading"><span className="eyebrow">RECENT PAYMENTS</span><Link to="/membership/payments">View all →</Link></div>
            {payments.length === 0 ? <p className="dashboard-empty">No payment activity yet.</p> : <div className="dashboard-list">{payments.slice(0, 4).map((payment) => <div className="dashboard-list-row" key={payment._id}><div><b>{payment.membership?.plan?.name || payment.type}</b><small>{formatDate(payment.paidAt || payment.createdAt)}</small></div><strong>{payment.status === 'SUCCESS' ? 'Paid' : String(payment.status || '').replaceAll('_', ' ')}</strong></div>)}</div>}
          </article>

          <article className="dashboard-card">
            <div className="dashboard-card-heading"><span className="eyebrow">RECENT NOTIFICATIONS</span><Link to="/notifications">View all →</Link></div>
            {notifications.length === 0 ? <p className="dashboard-empty">You're all caught up.</p> : <div className="dashboard-list">{notifications.map((notification) => <Link className={`dashboard-list-row notification-row ${notification.read ? '' : 'is-unread'}`} to="/notifications" key={notification._id}><div><b>{notification.title}</b><small>{notification.message}</small></div><span>→</span></Link>)}</div>}
          </article>
        </section>

        <section className="dashboard-quick-actions"><span className="eyebrow">QUICK ACCESS</span><div><Link to="/meetings">Book a meeting <span>→</span></Link><Link to="/gifts">Send a gift <span>→</span></Link><Link to="/community">Visit community <span>→</span></Link><Link to="/settings">Manage account <span>→</span></Link></div></section>
      </section>
    </main>
  )
}
