import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const formatMoney = (amount, currency = 'USD') => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency,
}).format(amount)

export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const loadEvents = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/events`)
        const data = await response.json()
        if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load events.')
        if (!cancelled) setEvents(data.data?.events || [])
      } catch (loadError) {
        if (!cancelled) setError(loadError.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadEvents()
    return () => { cancelled = true }
  }, [])

  if (loading) return <main className="placeholder-page"><h1>Events</h1><p>Loading events…</p></main>

  return (
    <main className="events-page">
      <header className="page-header">
        <p className="eyebrow">KEANU REEVES FAN COMMUNITY</p>
        <h1>Community events</h1>
        <p className="muted">Meet fellow fans and enjoy exclusive experiences.</p>
      </header>
      {error && <p className="auth-error">{error}</p>}
      {!error && events.length === 0 && <div className="empty-state"><h2>No upcoming events</h2><p className="muted">Check back soon for new experiences.</p></div>}
      <section className="events-grid" aria-label="Community events">
        {events.map((event) => (
          <article className="event-card" key={event._id}>
            {event.image ? <img className="event-image" src={event.image} alt="" /> : <div className="event-image event-image-placeholder" aria-hidden="true">★</div>}
            <div className="event-card-content">
              <div className="event-meta"><span className="card-badge">{event.minimumMembershipTier}</span><span className="status-pill">{event.status}</span></div>
              <h2>{event.title}</h2>
              <p className="event-date">{new Date(event.startDate).toLocaleString()} – {new Date(event.endDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
              <p className="card-description">{event.description}</p>
              <p className="event-price">{event.price === 0 ? 'Free' : formatMoney(event.price, event.currency)}</p>
            </div>
          </article>
        ))}
      </section>
      <p className="muted back-link"><Link to="/">← Back to home</Link></p>
    </main>
  )
}
