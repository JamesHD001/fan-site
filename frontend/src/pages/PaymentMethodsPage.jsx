import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/payment-methods.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function PaymentMethodsPage() {
  const { token } = useAuth()
  const [methods, setMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/payment-methods`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await response.json()
    if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load payment methods.')
    setMethods(data.paymentMethods || [])
  }, [token])

  useEffect(() => { if (token) load().catch((error) => setMessage(error.message)).finally(() => setLoading(false)) }, [token, load])

  const makeDefault = async (id) => {
    setMessage('')
    const response = await fetch(`${API_BASE_URL}/payment-methods/${id}/default`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
    const data = await response.json()
    if (!response.ok || !data.success) return setMessage(data.message || 'Unable to update the default card.')
    await load()
  }

  const remove = async (id) => {
    if (!window.confirm('Remove this saved payment method?')) return
    const response = await fetch(`${API_BASE_URL}/payment-methods/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    const data = await response.json()
    if (!response.ok || !data.success) return setMessage(data.message || 'Unable to remove the payment method.')
    await load()
  }

  return <main className="payment-methods-page">
    <section className="payment-methods-card">
      <Link className="payment-methods-back" to="/settings">← Settings</Link>
      <p className="eyebrow">PAYMENT METHODS</p>
      <h1>Your cards</h1>
      <p className="payment-methods-intro">Saved cards are represented by secure Flutterwave tokens. We never store your card number or security code.</p>
      {message && <div className="payment-methods-message">{message}</div>}
      {loading ? <p>Loading payment methods…</p> : methods.length === 0 ? <div className="payment-method-empty"><strong>No saved cards yet.</strong><span>Your first successful card payment can be saved for faster wallet funding.</span><Link className="primary-button" to="/wallet/add-funds">Add funds</Link></div> : <div className="payment-method-list">{methods.map((method) => <article className="payment-method-item" key={method._id}><div><strong>{method.brand || 'Card'} •••• {method.last4 || '••••'}</strong><span>{method.expiryMonth && method.expiryYear ? `Expires ${String(method.expiryMonth).padStart(2, '0')}/${String(method.expiryYear).slice(-2)}` : 'Saved securely'}</span></div><div className="payment-method-actions">{method.isDefault ? <span className="payment-method-default">Default</span> : <button type="button" onClick={() => makeDefault(method._id)}>Make default</button>}<button type="button" onClick={() => remove(method._id)}>Remove</button></div></article>)}</div>}
    </section>
  </main>
}
