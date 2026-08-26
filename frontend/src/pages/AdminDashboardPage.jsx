import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function AdminDashboardPage() {
  const { token, user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/admin/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
        const result = await response.json()
        if (!response.ok || !result.success) throw new Error(result.message || 'Unable to load dashboard.')
        if (!cancelled) setData(result.data)
      } catch (loadError) { if (!cancelled) setError(loadError.message) }
    }
    load()
    return () => { cancelled = true }
  }, [token])

  if (user?.role !== 'ADMIN') return <main className="placeholder-page"><h1>Access denied</h1><p>You need administrator access to view this page.</p><Link to="/">Return home</Link></main>
  if (error) return <main className="placeholder-page"><h1>Admin dashboard</h1><p className="auth-error">{error}</p></main>
  if (!data) return <main className="placeholder-page"><h1>Admin dashboard</h1><p>Loading dashboard…</p></main>

  const { stats, revenue } = data
  const cards = [['Users', stats.totalUsers], ['Active memberships', stats.activeMemberships], ['Pending bookings', stats.bookings.pendingPayment], ['Confirmed bookings', stats.bookings.confirmed], ['Completed gifts', stats.giftsCompleted], ['Posts awaiting review', stats.postsPendingApproval]]
  return <main className="admin-page"><header className="page-header"><p className="eyebrow">ADMINISTRATION</p><h1>Dashboard</h1><p className="muted">Platform overview and operational metrics.</p></header><section className="admin-stats-grid">{cards.map(([label, value]) => <article className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section><section className="admin-revenue"><h2>Revenue</h2><p className="admin-revenue-total">{new Intl.NumberFormat('en-NG', { style: 'currency', currency: revenue.currency }).format(revenue.total)}</p><p className="muted">{revenue.transactions} successful transactions</p><div className="revenue-types">{Object.entries(revenue.byType).map(([type, item]) => <div key={type}><span>{type}</span><strong>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: revenue.currency }).format(item.total)}</strong></div>)}</div></section><nav className="admin-links"><Link className="secondary-button" to="/admin/manage">Manage users &amp; operations</Link><Link className="secondary-button" to="/events">Manage events</Link><Link className="secondary-button" to="/notifications">Notifications</Link><Link className="secondary-button" to="/">Return home</Link></nav></main>
}
