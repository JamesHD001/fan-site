import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/admin.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const emptyCrypto = () => ({ currency: '', network: '', walletAddress: '', isActive: true })
const emptyGiftCard = () => ({ brand: '', instructions: '', isActive: true })

export default function AdminPaymentConfigPage() {
  const { token, user } = useAuth()
  const [cryptoOptions, setCryptoOptions] = useState([])
  const [giftCardOptions, setGiftCardOptions] = useState([])
  const [cryptoDraft, setCryptoDraft] = useState(emptyCrypto())
  const [giftDraft, setGiftDraft] = useState(emptyGiftCard())
  const [editingCrypto, setEditingCrypto] = useState(null)
  const [editingGift, setEditingGift] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/payment/options`)
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load payment configuration.')
      setCryptoOptions(data.cryptoOptions || [])
      setGiftCardOptions(data.giftCardOptions || [])
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  useEffect(() => { if (token && user?.role === 'ADMIN') load() }, [token, user?.role])

  const persist = async (nextCrypto, nextGift) => {
    setSaving(true); setError(''); setMessage('')
    try {
      const response = await fetch(`${API_BASE_URL}/payment/config`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cryptoOptions: nextCrypto, giftCardOptions: nextGift })
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to save payment configuration.')
      setCryptoOptions(data.config.cryptoOptions || []); setGiftCardOptions(data.config.giftCardOptions || [])
      setMessage('Payment configuration saved successfully.')
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  const addCrypto = (e) => {
    e.preventDefault(); setError('')
    if (!cryptoDraft.currency.trim() || !cryptoDraft.network.trim() || !cryptoDraft.walletAddress.trim()) return setError('Currency, network and wallet address are required.')
    const item = { ...cryptoDraft, currency: cryptoDraft.currency.trim().toUpperCase(), network: cryptoDraft.network.trim(), walletAddress: cryptoDraft.walletAddress.trim() }
    const next = editingCrypto ? cryptoOptions.map(x => x._id === editingCrypto._id ? { ...x, ...item } : x) : [...cryptoOptions, item]
    setCryptoOptions(next); setCryptoDraft(emptyCrypto()); setEditingCrypto(null); persist(next, giftCardOptions)
  }

  const addGift = (e) => {
    e.preventDefault(); setError('')
    if (!giftDraft.brand.trim()) return setError('Gift-card brand is required.')
    const item = { ...giftDraft, brand: giftDraft.brand.trim(), instructions: giftDraft.instructions.trim() }
    const next = editingGift ? giftCardOptions.map(x => x._id === editingGift._id ? { ...x, ...item } : x) : [...giftCardOptions, item]
    setGiftCardOptions(next); setGiftDraft(emptyGiftCard()); setEditingGift(null); persist(cryptoOptions, next)
  }

  const removeCrypto = (id) => { const next = cryptoOptions.filter(x => x._id !== id); setCryptoOptions(next); persist(next, giftCardOptions) }
  const removeGift = (id) => { const next = giftCardOptions.filter(x => x._id !== id); setGiftCardOptions(next); persist(cryptoOptions, next) }
  const toggleCrypto = (id) => { const next = cryptoOptions.map(x => x._id === id ? { ...x, isActive: !x.isActive } : x); setCryptoOptions(next); persist(next, giftCardOptions) }
  const toggleGift = (id) => { const next = giftCardOptions.map(x => x._id === id ? { ...x, isActive: !x.isActive } : x); setGiftCardOptions(next); persist(cryptoOptions, next) }

  if (user?.role !== 'ADMIN') return <main className="placeholder-page"><h1>Access denied</h1><p>You need administrator access to view this page.</p><Link to="/">Return home</Link></main>

  return <main className="admin-page page-container">
    <header className="page-header"><p className="eyebrow">PAYMENT OPERATIONS</p><h1>Payment Configuration</h1><p className="muted">Configure the crypto wallets and gift-card payment methods shown to members before they submit payment proof.</p><div className="admin-management-nav"><Link className="secondary-button" to="/admin">Dashboard</Link><Link className="secondary-button" to="/admin/payments">Payment requests</Link><Link className="secondary-button" to="/">Return home</Link></div></header>
    {error && <p className="auth-error" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}
    {loading ? <p>Loading payment configuration…</p> : <>
      <section className="admin-announcement"><div><p className="eyebrow">DEFAULT PAYMENT METHOD</p><h2>Crypto first</h2><p className="muted">Members will see crypto as the default payment method. Only active options are presented publicly.</p></div></section>
      <section className="admin-config-grid">
        <article className="admin-config-card"><h2>Crypto wallets</h2><p className="muted">Add supported coins and the wallet/network members should use.</p>
          <form className="admin-config-form" onSubmit={addCrypto}><label>Currency<input value={cryptoDraft.currency} onChange={e => setCryptoDraft({...cryptoDraft,currency:e.target.value})} placeholder="BTC, USDT, BNB" /></label><label>Network / blockchain<input value={cryptoDraft.network} onChange={e => setCryptoDraft({...cryptoDraft,network:e.target.value})} placeholder="Bitcoin, TRC20, BSC" /></label><label>Wallet address<input value={cryptoDraft.walletAddress} onChange={e => setCryptoDraft({...cryptoDraft,walletAddress:e.target.value})} placeholder="Receiving wallet address" /></label><label className="admin-check"><input type="checkbox" checked={cryptoDraft.isActive} onChange={e => setCryptoDraft({...cryptoDraft,isActive:e.target.checked})} /> Active</label><div className="admin-modal-actions"><button className="button button-primary" disabled={saving}>{editingCrypto ? 'Update crypto' : 'Add crypto'}</button>{editingCrypto && <button type="button" className="button button-ghost" onClick={()=>{setEditingCrypto(null);setCryptoDraft(emptyCrypto())}}>Cancel</button>}</div></form>
          <div className="admin-config-list">{cryptoOptions.length===0 ? <p className="muted">No crypto options configured.</p> : cryptoOptions.map(x=><div className="admin-config-row" key={x._id||`${x.currency}-${x.network}`}><div><strong>{x.currency}</strong><small>{x.network}</small><small className="config-address">{x.walletAddress}</small></div><span>{x.isActive?'ACTIVE':'DISABLED'}</span><div className="admin-actions"><button onClick={()=>{setEditingCrypto(x);setCryptoDraft({...x})}}>Edit</button><button onClick={()=>toggleCrypto(x._id)}> {x.isActive?'Disable':'Enable'} </button>{x._id && <button onClick={()=>removeCrypto(x._id)}>Remove</button>}</div></div>)}</div>
        </article>
        <article className="admin-config-card"><h2>Gift cards</h2><p className="muted">Configure brands and the instructions members receive for gift-card payments.</p>
          <form className="admin-config-form" onSubmit={addGift}><label>Gift-card brand<input value={giftDraft.brand} onChange={e => setGiftDraft({...giftDraft,brand:e.target.value})} placeholder="Apple, Steam, eBay, Razer Gold" /></label><label>Instructions<textarea rows="4" value={giftDraft.instructions} onChange={e => setGiftDraft({...giftDraft,instructions:e.target.value})} placeholder="Tell the member how to provide the gift card safely." /></label><label className="admin-check"><input type="checkbox" checked={giftDraft.isActive} onChange={e => setGiftDraft({...giftDraft,isActive:e.target.checked})} /> Active</label><div className="admin-modal-actions"><button className="button button-primary" disabled={saving}>{editingGift ? 'Update gift card' : 'Add gift card'}</button>{editingGift && <button type="button" className="button button-ghost" onClick={()=>{setEditingGift(null);setGiftDraft(emptyGiftCard())}}>Cancel</button>}</div></form>
          <div className="admin-config-list">{giftCardOptions.length===0 ? <p className="muted">No gift-card options configured.</p> : giftCardOptions.map(x=><div className="admin-config-row" key={x._id||x.brand}><div><strong>{x.brand}</strong><small>{x.instructions}</small></div><span>{x.isActive?'ACTIVE':'DISABLED'}</span><div className="admin-actions"><button onClick={()=>{setEditingGift(x);setGiftDraft({...x})}}>Edit</button><button onClick={()=>toggleGift(x._id)}> {x.isActive?'Disable':'Enable'} </button>{x._id && <button onClick={()=>removeGift(x._id)}>Remove</button>}</div></div>)}</div>
        </article>
      </section>
    </>}
  </main>
}
