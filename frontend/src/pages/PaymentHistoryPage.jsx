import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/payment-history.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const fromMinorUnits = (amount) => Number(amount || 0) / 100
const formatMoney = (amount, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(fromMinorUnits(amount))
const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
const statusLabel = (status = '') => status.replaceAll('_', ' ')
const paymentMethodLabel = (payment) => payment.paymentMethod === 'GIFTCARD' ? 'Gift card' : payment.paymentMethod === 'CRYPTO' ? 'Crypto' : 'Manual support'

export default function PaymentHistoryPage() {
  const { token } = useAuth()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const loadHistory = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/memberships/payments`, { headers: { Authorization: `Bearer ${token}` } })
        const data = await response.json()
        if (!response.ok || !data.success) throw new Error(data.message || 'Unable to retrieve payment history.')
        if (!cancelled) setPayments(data.payments || [])
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (token) loadHistory()
    return () => { cancelled = true }
  }, [token])

  if (loading) return <main className="payment-history-page"><section className="payment-history-shell"><span className="eyebrow">ACCOUNT</span><h1>Payment history</h1><p>Loading your transaction records…</p></section></main>

  return <main className="payment-history-page"><section className="payment-history-shell">
    <div className="payment-history-heading"><div><span className="eyebrow">ACCOUNT RECORDS</span><h1>Payment history</h1><p>Review your membership, meeting and gift payments made through the fan community.</p></div><Link className="payment-history-back" to="/membership">← Membership</Link></div>
    {error && <div className="payment-history-alert" role="alert">{error}</div>}
    {!error && payments.length === 0 && <div className="payment-history-empty"><span className="payment-history-empty-mark">₦</span><h2>No payments yet</h2><p>Your completed and pending transactions will appear here after you make a purchase.</p><Link className="primary-button" to="/membership">Explore membership</Link></div>}
    {payments.length > 0 && <div className="payment-history-list">{payments.map((payment) => { const plan = payment.membership?.plan; const successful = payment.status === 'SUCCESS'; return <article className="payment-history-item" key={payment._id}>
      <div className="payment-history-main"><div className="payment-history-icon">{payment.type === 'MEMBERSHIP' ? 'M' : payment.type === 'MEETING' ? '↗' : 'G'}</div><div><span className="payment-history-type">{payment.type}</span><h2>{plan?.name || payment.metadata?.description || payment.type.charAt(0) + payment.type.slice(1).toLowerCase() + ' payment'}</h2><p>{formatDate(payment.paidAt || payment.createdAt)} · Ref {payment.reference}</p></div></div>
      <div className="payment-history-amounts"><div><span>AMOUNT</span><strong>{formatMoney(payment.originalAmount, payment.originalCurrency || 'USD')}</strong></div><div><span>PAID VIA</span><strong>{paymentMethodLabel(payment)}</strong></div><span className={`payment-history-status status-${payment.status?.toLowerCase()}`}>{successful ? 'Paid' : statusLabel(payment.status || 'UNKNOWN')}</span></div>
    </article> })}</div>}
    <div className="payment-history-note"><strong>Payment security</strong><span>Transaction references are shown for your records. Sensitive payment details and payment proof are not displayed in the history list.</span></div>
  </section></main>
}
