import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// Module-scope helper so the impure Date.now() call
// never happens during component render.
const getMinBookingDateTime = () =>
  new Date(Date.now() + 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16)

export default function MeetingsPage() {
  const { token, user } = useAuth()
  const [meetingTypes, setMeetingTypes] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState(null)
  const [scheduledFor, setScheduledFor] = useState('')
  const [notes, setNotes] = useState('')
  const [minDateTime, setMinDateTime] = useState('')
  const [bookingError, setBookingError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const requests = [
          fetch(`${API_BASE_URL}/meetings/types`),
        ]

        if (token) {
          requests.push(
            fetch(`${API_BASE_URL}/meetings/bookings`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          )
        }

        const [typesRes, bookingsRes] = await Promise.all(requests)

        if (cancelled) return
        const typesData = await typesRes.json()
        if (typesRes.ok && typesData.success) {
          setMeetingTypes(typesData.data?.meetingTypes || [])
        }

        if (bookingsRes) {
          const bookingsData = await bookingsRes.json()
          if (!cancelled && bookingsRes.ok && bookingsData.success) {
            setBookings(bookingsData.data?.bookings || [])
          }
        }
      } catch {
        if (!cancelled) {
          setBookingError('Unable to load meetings. Please try again.')
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

  const openBooking = (type) => {
    setSelectedType(type)
    // Minimum selectable datetime is 1 hour from now,
    // computed in this event handler via a module helper.
    setMinDateTime(getMinBookingDateTime())
    setScheduledFor('')
    setNotes('')
    setBookingError('')
  }

  const handleBooking = async (event) => {
    event.preventDefault()
    if (!selectedType) return

    setBookingError('')
    setSubmitting(true)

    try {
      const response = await fetch(`${API_BASE_URL}/meetings/bookings/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          meetingTypeId: selectedType._id,
          scheduledFor: new Date(scheduledFor).toISOString(),
          notes,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to start booking checkout.')
      }

      localStorage.setItem('pendingPaymentType', 'MEETING')
      window.location.href = data.checkout.authorizationUrl
    } catch (err) {
      setBookingError(err.message)
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="placeholder-page">
        <h1>Meetings</h1>
        <p>Loading meetings…</p>
      </main>
    )
  }

  return (
    <main className="meetings-page">
      <header className="page-header">
        <p className="eyebrow">KEANU REEVES FAN COMMUNITY</p>
        <h1>Meetings</h1>
        <p className="muted">
          Book a personal session. Some experiences require a higher membership tier.
        </p>
      </header>

      {!user && (
        <p className="form-error">
          <Link to="/login">Sign in</Link> and choose a membership to book a meeting.
        </p>
      )}

      <section className="cards-grid">
        {meetingTypes.map((type) => (
          <article key={type._id} className="info-card">
            <span className="card-badge">{type.minimumMembershipTier}</span>
            <h2>{type.name}</h2>
            <p className="card-price">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: type.currency || 'USD',
              }).format(type.price)}
              <span> · {type.duration} min</span>
            </p>
            <p className="card-description">{type.description}</p>
            {user ? (
              <button
                className="primary-button"
                type="button"
                onClick={() => openBooking(type)}
              >
                Book this session
              </button>
            ) : null}
          </article>
        ))}
      </section>

      {selectedType && (
        <form className="modal-backdrop" onSubmit={handleBooking}>
          <div className="modal-card" role="dialog" aria-modal="true">
            <h2>Book: {selectedType.name}</h2>
            <label>
              Preferred date &amp; time
              <input
                type="datetime-local"
                required
                min={minDateTime}
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
            </label>
            <label>
              Notes (optional)
              <textarea
                rows={3}
                maxLength={1000}
                placeholder="Anything you'd like to mention?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            {bookingError && <p className="auth-error">{bookingError}</p>}
            <div className="payment-actions">
              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? 'Redirecting to Paystack…' : 'Continue to payment'}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={submitting}
                onClick={() => setSelectedType(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {token && bookings.length > 0 && (
        <>
          <h2 className="section-title">Your bookings</h2>
          <ul className="booking-list">
            {bookings.map((booking) => (
              <li key={booking._id} className={`booking-item status-${booking.status.toLowerCase()}`}>
                <div>
                  <strong>{booking.meetingType?.name || 'Meeting'}</strong>
                  <span className="muted">
                    {' '}
                    · {new Date(booking.scheduledFor).toLocaleString()}
                  </span>
                </div>
                <span className="status-pill">{booking.status.replace('_', ' ')}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="muted back-link">
        <Link to="/">← Back to home</Link>
      </p>
    </main>
  )
}
