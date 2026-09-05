import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/admin.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const money = (amount, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount || 0) / 100)
const formatDate = (value) => (value ? new Date(value).toLocaleString() : '—')

const statusLabel = {
  PENDING_PAYMENT: 'AWAITING PAYMENT',
  PROOF_SUBMITTED: 'PROOF SUBMITTED',
  SUCCESS: 'COMPLETED',
  REJECTED: 'REJECTED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
}

export default function AdminPaymentsPage() {
  const { token, user } = useAuth()
  const [payments, setPayments] = useState([])
  const [support, setSupport] = useState(null)
  const [filter, setFilter] = useState('ACTION_REQUIRED')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [preview, setPreview] = useState(null)
  const [proofLoading, setProofLoading] = useState(false)
  const [note, setNote] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [paymentsResponse, supportResponse] = await Promise.all([
        fetch(`${API}/admin/payments?limit=100`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/payments/support`),
      ])
      const paymentsData = await paymentsResponse.json()
      const supportData = await supportResponse.json()
      if (!paymentsResponse.ok || !paymentsData.success) throw new Error(paymentsData.message || 'Unable to load payment requests.')
      setPayments(paymentsData.data?.payments || [])
      if (supportData.success) setSupport(supportData.support)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token && user?.role === 'ADMIN') load()
  }, [token, user?.role])

  const visiblePayments = useMemo(() => {
    if (filter === 'ACTION_REQUIRED') return payments.filter((payment) => ['PENDING_PAYMENT', 'PROOF_SUBMITTED', 'REJECTED'].includes(payment.status))
    if (filter === 'PROOF_SUBMITTED') return payments.filter((payment) => payment.status === 'PROOF_SUBMITTED')
    if (filter === 'COMPLETED') return payments.filter((payment) => payment.status === 'SUCCESS')
    if (filter === 'REJECTED') return payments.filter((payment) => payment.status === 'REJECTED')
    return payments
  }, [payments, filter])

  const openPreview = async (payment) => {
    setError('')
    setNote(payment.adminNote || '')
    if (!payment.proof?.fileUrl && !payment.proof?.fileId) {
      setPreview({ ...payment, proofPreviewUrl: '' })
      return
    }
    setPreview({ ...payment, proofPreviewUrl: '' })
    setProofLoading(true)
    try {
      if (payment.proof.fileUrl?.startsWith('data:')) {
        setPreview({ ...payment, proofPreviewUrl: payment.proof.fileUrl })
        return
      }
      const response = await fetch(`${API}/payments/proof/${payment._id}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) throw new Error('Unable to retrieve the stored payment proof.')
      const blob = await response.blob()
      setPreview({ ...payment, proofPreviewUrl: URL.createObjectURL(blob) })
    } catch (e) {
      setPreview(null)
      setError(e.message)
    } finally {
      setProofLoading(false)
    }
  }

  const closePreview = () => {
    if (preview?.proofPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(preview.proofPreviewUrl)
    setPreview(null)
    setNote('')
  }

  const action = async (id, type) => {
    const payment = payments.find((item) => item._id === id)
    if (type === 'confirm' && !payment?.proof?.fileUrl && !payment?.proof?.fileId) {
      setError('A payment cannot be confirmed until payment proof has been submitted.')
      return
    }
    if (type === 'confirm' && !window.confirm('Confirm that you have verified this payment receipt and received the payment?')) return
    if (type === 'reject' && !window.confirm('Reject this payment proof? The member will be allowed to submit replacement proof.')) return

    setBusy(id)
    setError('')
    try {
      const response = await fetch(`${API}/payments/admin/${id}/${type}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          adminNote: note.trim() || (type === 'reject' ? 'Payment proof was rejected.' : 'Payment receipt verified and payment received.'),
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to update payment.')
      closePreview()
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  if (user?.role !== 'ADMIN') return <main className="placeholder-page"><h1>Access denied</h1><Link to="/">Return home</Link></main>

  const actionRequiredCount = payments.filter((payment) => ['PENDING_PAYMENT', 'PROOF_SUBMITTED', 'REJECTED'].includes(payment.status)).length
  const proofCount = payments.filter((payment) => payment.status === 'PROOF_SUBMITTED').length
  const completedCount = payments.filter((payment) => payment.status === 'SUCCESS').length

  return (
    <main className="admin-page page-container">
      <header className="page-header">
        <p className="eyebrow">PAYMENT OPERATIONS</p>
        <h1>Payment review console</h1>
        <p className="muted">Open every request, inspect submitted receipts, verify the payment, and complete the associated purchase.</p>
        <div className="admin-links">
          <Link className="secondary-button" to="/admin">Dashboard</Link>
          <Link className="secondary-button" to="/admin/manage">Management</Link>
          <Link className="secondary-button" to="/admin/payment-config">Payment configuration</Link>
        </div>
      </header>

      {support && <section className="admin-revenue"><span className="eyebrow">DESIGNATED PAYMENT SUPPORT</span><h2>{support.name}</h2><p>{support.email} · @{support.username}</p><p className="muted">Only the designated payment-support administrator can confirm or reject a payment.</p></section>}

      <section className="admin-stats-grid">
        <button className="stat-card" onClick={() => setFilter('ACTION_REQUIRED')}><span>Action required</span><strong>{actionRequiredCount}</strong></button>
        <button className="stat-card" onClick={() => setFilter('PROOF_SUBMITTED')}><span>Receipts to verify</span><strong>{proofCount}</strong></button>
        <button className="stat-card" onClick={() => setFilter('COMPLETED')}><span>Completed</span><strong>{completedCount}</strong></button>
      </section>

      <div className="admin-toolbar">
        <select aria-label="Payment status filter" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="ACTION_REQUIRED">Action required</option>
          <option value="PROOF_SUBMITTED">Receipts to verify</option>
          <option value="COMPLETED">Completed</option>
          <option value="REJECTED">Rejected</option>
          <option value="ALL">All payment requests</option>
        </select>
        <button className="secondary-button" onClick={load} disabled={loading}>Refresh</button>
      </div>

      {error && <p className="auth-error" role="alert">{error}</p>}

      {loading ? <p>Loading payment requests…</p> : visiblePayments.length === 0 ? <section className="dashboard-panel"><h2>No payment requests in this view</h2><p className="muted">New payment requests and submitted receipts will appear here automatically.</p></section> : (
        <section className="admin-table-wrap">
          <table>
            <thead><tr><th>Member</th><th>Purchase</th><th>Method</th><th>Amount</th><th>Submitted</th><th>Status</th><th>Receipt</th><th>Actions</th></tr></thead>
            <tbody>{visiblePayments.map((payment) => {
              const hasProof = Boolean(payment.proof?.fileUrl || payment.proof?.fileId)
              const isSupport = String(payment.supportAdmin?._id || payment.supportAdmin) === String(user?._id)
              return <tr key={payment._id}>
                <td><strong>{payment.user?.name || payment.user?.username || '—'}</strong><small>{payment.user?.email}</small></td>
                <td>{payment.metadata?.description || payment.type}<small>{payment.paymentToken}</small></td>
                <td>{payment.paymentMethod === 'CRYPTO' ? `${payment.crypto?.currency || 'Crypto'} · ${payment.crypto?.network || '—'}` : payment.paymentMethod === 'GIFTCARD' ? `Gift card · ${payment.giftCard?.brand || '—'}` : 'Not selected'}</td>
                <td>{money(payment.originalAmount, payment.originalCurrency)}</td>
                <td>{formatDate(payment.proof?.uploadedAt || payment.createdAt)}</td>
                <td><span className={`admin-status ${payment.status === 'SUCCESS' ? 'good' : payment.status === 'PROOF_SUBMITTED' ? 'good' : payment.status === 'REJECTED' ? 'bad' : ''}`}>{statusLabel[payment.status] || payment.status}</span></td>
                <td>{hasProof ? <button className="text-button" onClick={() => openPreview(payment)}>View receipt</button> : <span className="muted">Not submitted</span>}</td>
                <td><div className="admin-actions">
                  <button onClick={() => openPreview(payment)}>View details</button>
                  {payment.status === 'PROOF_SUBMITTED' && <><button disabled={busy === payment._id || !isSupport} onClick={() => { setNote(''); openPreview(payment) }}>{isSupport ? 'Review & verify' : 'Awaiting support admin'}</button><button className="secondary-button" disabled={busy === payment._id || !isSupport} onClick={() => action(payment._id, 'confirm')}>Confirm payment</button><button className="danger" disabled={busy === payment._id || !isSupport} onClick={() => action(payment._id, 'reject')}>Reject</button></>}
                  {payment.status === 'PENDING_PAYMENT' && <span className="muted">Awaiting member payment</span>}
                  {payment.status === 'REJECTED' && <span className="muted">Awaiting replacement proof</span>}
                  {payment.status === 'SUCCESS' && <span className="admin-status good">PAYMENT COMPLETE</span>}
                </div></td>
              </tr>
            })}</tbody>
          </table>
        </section>
      )}

      {preview && <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-label="Payment review" onClick={closePreview}>
        <section className="admin-modal admin-proof-modal" onClick={(event) => event.stopPropagation()}>
          <div className="proof-modal-header"><div><p className="eyebrow">PAYMENT REVIEW</p><h2>{preview.user?.name || preview.user?.username || 'Member'}</h2><p className="muted">{preview.metadata?.description || preview.type} · {preview.paymentToken}</p></div><button className="text-button" onClick={closePreview}>Close</button></div>
          <div className="proof-review-meta">
            <span><strong>Amount</strong>{money(preview.originalAmount, preview.originalCurrency)}</span>
            <span><strong>Status</strong>{statusLabel[preview.status] || preview.status}</span>
            <span><strong>Requested</strong>{formatDate(preview.createdAt)}</span>
            <span><strong>Receipt</strong>{preview.proof?.originalName || 'Not submitted'}</span>
          </div>
          <div className="proof-review-meta">
            <span><strong>Method</strong>{preview.paymentMethod === 'CRYPTO' ? `${preview.crypto?.currency || 'Crypto'} · ${preview.crypto?.network || '—'}` : `Gift card · ${preview.giftCard?.brand || '—'}`}</span>
            {preview.paymentMethod === 'CRYPTO' && <span><strong>Wallet</strong><code>{preview.crypto?.walletAddress || '—'}</code></span>}
            {preview.paymentMethod === 'GIFTCARD' && <span><strong>Instructions</strong>{preview.giftCard?.instructions || '—'}</span>}
          </div>
          {proofLoading ? <div className="proof-preview-frame"><p>Loading secure receipt…</p></div> : preview.proofPreviewUrl?.startsWith('data:image/') || (preview.proofPreviewUrl?.startsWith('blob:') && preview.proof?.fileType?.startsWith('image/')) ? <div className="proof-preview-frame"><img src={preview.proofPreviewUrl} alt="Submitted payment receipt" /></div> : preview.proofPreviewUrl?.startsWith('data:application/pdf') || (preview.proofPreviewUrl?.startsWith('blob:') && preview.proof?.fileType === 'application/pdf') ? <iframe className="proof-preview-frame proof-pdf" src={preview.proofPreviewUrl} title="Submitted payment receipt PDF" /> : <div className="proof-preview-frame"><p className="muted">No receipt is currently available to preview.</p></div>}
          <label>Administrator note<textarea rows="3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional verification or rejection note" /></label>
          <div className="admin-modal-actions">
            {preview.proofPreviewUrl && <a className="secondary-button" href={preview.proofPreviewUrl} target="_blank" rel="noreferrer">Open full receipt</a>}
            {preview.status === 'PROOF_SUBMITTED' && <><button className="danger" disabled={busy === preview._id} onClick={() => action(preview._id, 'reject')}>Reject proof</button><button className="button button-primary" disabled={busy === preview._id} onClick={() => action(preview._id, 'confirm')}>{busy === preview._id ? 'Confirming…' : 'Verify & complete payment'}</button></>}
            <button className="button button-ghost" onClick={closePreview}>Close</button>
          </div>
        </section>
      </div>}
    </main>
  )
}
