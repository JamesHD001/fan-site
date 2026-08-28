import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import FlutterwaveInline from '../components/FlutterwaveInline'
import '../styles/add-funds.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function AddFundsPage() {
  const { token } = useAuth()
  const [amount, setAmount] = useState('10')
  const [wallet, setWallet] = useState(null)
  const [methods, setMethods] = useState([])
  const [selectedMethod, setSelectedMethod] = useState('')
  const [saveCard, setSaveCard] = useState(true)
  const [payment, setPayment] = useState(null)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  const loadWallet = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/wallet`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await response.json()
    if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load your balance.')
    setWallet(data.wallet)
  }, [token])

  const loadMethods = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/payment-methods`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await response.json()
    if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load payment methods.')
    const available = data.paymentMethods || []
    setMethods(available)
    const defaultMethod = available.find((method) => method.isDefault) || available[0]
    if (defaultMethod) setSelectedMethod(defaultMethod._id)
  }, [token])

  useEffect(() => {
    if (!token) return
    Promise.all([loadWallet(), loadMethods()]).catch((error) => setStatus({ type: 'error', message: error.message })).finally(() => setLoading(false))
  }, [token, loadWallet, loadMethods])

  const saveCompletedCard = async (reference) => {
    if (!saveCard || !reference) return
    try {
      await fetch(`${API_BASE_URL}/payment-methods/cards/from-payment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ reference }),
      })
    } catch { /* Saving a card is optional and never changes payment success. */ }
  }

  const startSavedCardPayment = async (numericAmount) => {
    const response = await fetch(`${API_BASE_URL}/payments/flutterwave/deposits/saved-card`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount: Math.round(numericAmount * 100), paymentMethodId: selectedMethod }),
    })
    const data = await response.json()
    if (response.status === 202 && data.authorizationRequired && data.authorizationUrl) {
      // The bank/3DS can still require authentication. We only navigate when Flutterwave explicitly requires it.
      window.location.assign(data.authorizationUrl)
      return
    }
    if (!response.ok || !data.success) throw new Error(data.message || 'Transaction failed. Your balance has not been changed.')
    await loadWallet()
    setStatus({ type: 'success', message: 'Transaction successful. Your balance has been updated.' })
  }

  const startPayment = async (event) => {
    event.preventDefault()
    setStatus({ type: '', message: '' })
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount < 1) return setStatus({ type: 'error', message: 'Enter an amount of at least $1.' })
    setProcessing(true)
    try {
      if (selectedMethod) {
        await startSavedCardPayment(numericAmount)
        setProcessing(false)
        return
      }
      const response = await fetch(`${API_BASE_URL}/payments/flutterwave/deposits`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ amount: Math.round(numericAmount * 100) }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to start the transaction.')
      // providerAmount is NGN major units. The member-facing amount remains USD.
      setPayment(data.checkout ? { ...data.checkout, amount: data.providerAmount } : null)
      if (!data.checkout) throw new Error('The payment service did not return checkout details.')
    } catch (error) {
      setProcessing(false)
      setStatus({ type: 'error', message: error.message })
    }
  }

  const verifyPayment = async (result) => {
    try {
      setStatus({ type: 'pending', message: 'Transaction received. Verifying securely…' })
      const response = await fetch(`${API_BASE_URL}/payments/flutterwave/deposits/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ transactionId: result.transaction_id }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Transaction verification failed.')
      await saveCompletedCard(result.tx_ref || result.reference)
      await loadWallet()
      await loadMethods()
      setPayment(null)
      setStatus({ type: 'success', message: 'Transaction successful. Your balance has been updated.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Transaction failed. Your balance has not been changed.' })
    } finally { setProcessing(false) }
  }

  const handleClose = (incomplete) => {
    setPayment(null); setProcessing(false)
    if (incomplete) setStatus({ type: 'error', message: 'Transaction failed or was cancelled. Your balance has not been changed.' })
  }

  if (loading) return <main className="add-funds-page"><section className="add-funds-card"><p className="eyebrow">ACCOUNT BALANCE</p><h1>Loading balance…</h1></section></main>

  return <main className="add-funds-page"><section className="add-funds-card">
    <Link className="add-funds-back" to="/dashboard">← Dashboard</Link>
    <p className="eyebrow">ACCOUNT BALANCE</p><h1>Add funds</h1>
    <p className="add-funds-intro">Add credit to your account and use it for memberships, meetings, gifts and other community purchases.</p>
    <div className="balance-panel"><span>AVAILABLE BALANCE</span><strong>{wallet ? `$${(wallet.availableBalance / 100).toFixed(2)}` : '$0.00'}</strong></div>
    {status.message && <div className={`add-funds-message ${status.type}`} role="status">{status.message}</div>}
    <form onSubmit={startPayment} className="add-funds-form">
      <label htmlFor="fund-amount">Amount (USD)</label>
      <div className="amount-input"><span>$</span><input id="fund-amount" type="number" min="1" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={processing} /></div>
      <div className="quick-amounts">{[10, 25, 50, 100].map((value) => <button key={value} type="button" onClick={() => setAmount(String(value))} disabled={processing}>${value}</button>)}</div>
      <label htmlFor="fund-method">Payment method</label>
      <select id="fund-method" value={selectedMethod} onChange={(event) => setSelectedMethod(event.target.value)} disabled={processing}>
        <option value="">Add a new card</option>
        {methods.map((method) => <option key={method._id} value={method._id}>{method.brand || 'Card'} •••• {method.last4 || '••••'}{method.isDefault ? ' — Default' : ''}</option>)}
      </select>
      {!selectedMethod && <label className="save-card-option"><input type="checkbox" checked={saveCard} onChange={(event) => setSaveCard(event.target.checked)} /> Save this card for faster future payments</label>}
      <button className="add-funds-submit" type="submit" disabled={processing}>{processing ? 'Processing…' : selectedMethod ? 'Add funds securely' : 'Continue to payment'}</button>
    </form>
    <div className="add-funds-links"><Link to="/payment-methods">Manage saved payment methods →</Link></div>
    <p className="add-funds-note">Your wallet is denominated in USD. Provider currency conversion and fees are handled by the payment engine; your balance is updated only after server-side verification.</p>
  </section>{payment && <FlutterwaveInline payment={payment} onSuccess={verifyPayment} onClose={handleClose} onError={(message) => { setPayment(null); setProcessing(false); setStatus({ type: 'error', message }) }} />}</main>
}
