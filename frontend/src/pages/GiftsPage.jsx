import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const formatMoney = (amount, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(Number(amount || 0) / 100)

export default function GiftsPage() {
  const { token, user } = useAuth()
  const [gifts, setGifts] = useState([])
  const [history, setHistory] = useState([])
  const [selectedGift, setSelectedGift] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const requests = [fetch(`${API_BASE_URL}/gifts`)]
        if (token) {
          requests.push(fetch(`${API_BASE_URL}/gifts/history`, {
            headers: { Authorization: `Bearer ${token}` },
          }))
        }

        const [giftsResponse, historyResponse] = await Promise.all(requests)
        const giftsData = await giftsResponse.json()

        if (!cancelled && giftsResponse.ok && giftsData.success) {
          setGifts(giftsData.data?.gifts || [])
        }

        if (historyResponse) {
          const historyData = await historyResponse.json()
          if (!cancelled && historyResponse.ok && historyData.success) {
            setHistory(historyData.data?.transactions || [])
          }
        }
      } catch {
        if (!cancelled) setError('Unable to load gifts. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [token])

  const openGiftModal = (gift) => {
    setSelectedGift(gift)
    setQuantity(1)
    setMessage('')
    setError('')
  }

  const closeGiftModal = () => {
    if (!submitting) setSelectedGift(null)
  }

  const handlePurchase = async (event) => {
    event.preventDefault()
    if (!selectedGift || !token) return
    setSubmitting(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/gifts/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          giftId: selectedGift._id,
          quantity,
          message,
        }),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to start gift checkout.')
      }

      window.location.href = data.checkout.authorizationUrl
    } catch (purchaseError) {
      setError(purchaseError.message)
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="placeholder-page">
        <h1>Gifts</h1>
        <p>Loading gifts…</p>
      </main>
    )
  }

  return (
    <main className="gifts-page">
      <header className="page-header">
        <p className="eyebrow">KEANU REEVES FAN COMMUNITY</p>
        <h1>Send a gift</h1>
        <p className="muted">Share a little appreciation with the community.</p>
      </header>

      {error && !selectedGift && <p className="auth-error">{error}</p>}

      {!user && (
        <p className="auth-error">
          <Link to="/login">Sign in</Link> to send a gift.
        </p>
      )}

      <section className="gifts-grid" aria-label="Gift catalog">
        {gifts.map((gift) => (
          <article className="gift-card" key={gift._id}>
            <div className="gift-image" aria-hidden="true">
              {gift.image ? <img src={gift.image} alt="" /> : '🎁'}
            </div>
            <div className="gift-card-content">
              <h2>{gift.name}</h2>
              <p className="gift-price">{formatMoney(gift.price, gift.currency)}</p>
              <p className="card-description">{gift.description}</p>
              {user && (
                <button className="primary-button" type="button" onClick={() => openGiftModal(gift)}>
                  Send this gift
                </button>
              )}
            </div>
          </article>
        ))}
      </section>

      {gifts.length === 0 && !error && <p>No gifts are available right now.</p>}

      {user && history.length > 0 && (
        <section className="gift-history">
          <h2 className="section-title">Your gift history</h2>
          <ul className="gift-history-list">
            {history.map((transaction) => (
              <li className="gift-history-item" key={transaction._id}>
                <div>
                  <strong>{transaction.gift?.name || 'Gift'}</strong>
                  <span className="muted"> × {transaction.quantity} · {new Date(transaction.createdAt).toLocaleDateString()}</span>
                </div>
                <span className={`status-pill gift-status-${transaction.status.toLowerCase()}`}>
                  {transaction.status.replace('_', ' ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selectedGift && (
        <form className="modal-backdrop" onSubmit={handlePurchase}>
          <div className="modal-card gift-modal" role="dialog" aria-modal="true" aria-labelledby="gift-dialog-title">
            <h2 id="gift-dialog-title">Send {selectedGift.name}</h2>
            <p className="muted">{formatMoney(selectedGift.price, selectedGift.currency)} each</p>
            <label>
              Quantity
              <input
                type="number"
                min="1"
                max="100"
                required
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Math.min(100, Number(event.target.value) || 1)))}
              />
            </label>
            <label>
              Message (optional)
              <textarea rows={4} maxLength={500} placeholder="Add a message of appreciation…" value={message} onChange={(event) => setMessage(event.target.value)} />
            </label>
            <p className="gift-total">
              Total: <strong>{formatMoney(selectedGift.price * quantity, selectedGift.currency)}</strong>
            </p>
            {error && <p className="auth-error">{error}</p>}
            <div className="payment-actions">
              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? 'Redirecting to Paystack…' : 'Continue to payment'}
              </button>
              <button className="secondary-button" type="button" disabled={submitting} onClick={closeGiftModal}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      <p className="muted back-link"><Link to="/">← Back to home</Link></p>
    </main>
  )
}
