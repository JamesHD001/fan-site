import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/admin.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const MAX_QR_SIZE = 2 * 1024 * 1024
const emptyCrypto = () => ({ currency: '', network: '', walletAddress: '', qrCode: '', isActive: true })
const emptyGiftCard = () => ({ brand: '', instructions: '', isActive: true })

const readImage = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(new Error('Unable to read the QR code image.'))
  reader.readAsDataURL(file)
})

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
  const qrInputRef = useRef(null)

  useEffect(() => {
    if (!token || user?.role !== 'ADMIN') return
    let ignore = false
    fetch(`${API_BASE_URL}/payment-config/options`)
      .then(async response => {
        const data = await response.json()
        if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load payment configuration.')
        return data
      })
      .then(data => {
        if (ignore) return
        setCryptoOptions(data.cryptoOptions || [])
        setGiftCardOptions(data.giftCardOptions || [])
        setError('')
      })
      .catch(e => { if (!ignore) setError(e.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [token, user?.role])

  const persist = async (nextCrypto, nextGift) => {
    setSaving(true); setError(''); setMessage('')
    try {
      const response = await fetch(`${API_BASE_URL}/payment-config/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cryptoOptions: nextCrypto, giftCardOptions: nextGift })
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to save payment configuration.')
      setCryptoOptions(data.config.cryptoOptions || [])
      setGiftCardOptions(data.config.giftCardOptions || [])
      setMessage('Payment configuration saved successfully.')
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  const handleQrUpload = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setError('QR code must be a PNG, JPEG or WebP image.')
    if (file.size > MAX_QR_SIZE) return setError('QR code image must be 2 MB or smaller.')
    try {
      const qrCode = await readImage(file)
      setCryptoDraft(current => ({ ...current, qrCode }))
      setError('')
    } catch (e) { setError(e.message) }
  }

  const addCrypto = e => {
    e.preventDefault(); setError('')
    if (!cryptoDraft.currency.trim() || !cryptoDraft.network.trim() || !cryptoDraft.walletAddress.trim()) return setError('Currency, network and wallet address are required.')
    const item = { ...cryptoDraft, currency: cryptoDraft.currency.trim().toUpperCase(), network: cryptoDraft.network.trim(), walletAddress: cryptoDraft.walletAddress.trim() }
    const next = editingCrypto ? cryptoOptions.map(x => x._id === editingCrypto._id ? { ...x, ...item } : x) : [...cryptoOptions, item]
    setCryptoOptions(next); setCryptoDraft(emptyCrypto()); setEditingCrypto(null); persist(next, giftCardOptions)
  }

  const addGift = e => {
    e.preventDefault(); setError('')
    if (!giftDraft.brand.trim()) return setError('Gift-card brand is required.')
    const item = { ...giftDraft, brand: giftDraft.brand.trim(), instructions: giftDraft.instructions.trim() }
    const next = editingGift ? giftCardOptions.map(x => x._id === editingGift._id ? { ...x, ...item } : x) : [...giftCardOptions, item]
    setGiftCardOptions(next); setGiftDraft(emptyGiftCard()); setEditingGift(null); persist(cryptoOptions, next)
  }

  const removeCrypto = id => { if (!window.confirm('Remove this crypto payment option?')) return; const next = cryptoOptions.filter(x => x._id !== id); setCryptoOptions(next); persist(next, giftCardOptions) }
  const removeGift = id => { if (!window.confirm('Remove this gift-card payment option?')) return; const next = giftCardOptions.filter(x => x._id !== id); setGiftCardOptions(next); persist(cryptoOptions, next) }
  const toggleCrypto = id => { const next = cryptoOptions.map(x => x._id === id ? { ...x, isActive: !x.isActive } : x); setCryptoOptions(next); persist(next, giftCardOptions) }
  const toggleGift = id => { const next = giftCardOptions.map(x => x._id === id ? { ...x, isActive: !x.isActive } : x); setGiftCardOptions(next); persist(cryptoOptions, next) }

  if (user?.role !== 'ADMIN') return <main className="placeholder-page"><h1>Access denied</h1><p>You need administrator access to view this page.</p><Link to="/">Return home</Link></main>

  return (
    <main className="admin-page page-container admin-payment-config-page">
      <header className="page-header admin-config-header"><div><p className="eyebrow">ADMINISTRATION / PAYMENTS</p><h1>Payment configuration</h1><p className="muted">Control the payment methods and receiving instructions members see when they make a purchase.</p></div><div className="admin-management-nav"><Link className="secondary-button" to="/admin">Dashboard</Link><Link className="secondary-button" to="/admin/payments">Payment requests</Link></div></header>
      <section className="admin-config-status"><div className="admin-config-status-icon">PAY</div><div><p className="eyebrow">PAYMENT METHOD PRIORITY</p><h2>Crypto is the default</h2><p className="muted">Members will see active crypto options first. Gift cards remain available when configured.</p></div><div className="admin-config-stat"><strong>{cryptoOptions.filter(x => x.isActive).length}</strong><span>Active crypto</span></div><div className="admin-config-stat"><strong>{giftCardOptions.filter(x => x.isActive).length}</strong><span>Active gift cards</span></div></section>
      {error && <p className="auth-error admin-config-alert" role="alert">{error}</p>}{message && <p className="success-message admin-config-alert" role="status">{message}</p>}
      {loading ? <section className="admin-config-loading">Loading payment configuration…</section> : <section className="admin-config-sections">
        <article className="admin-config-panel"><div className="admin-config-panel-header"><div><p className="eyebrow">1 | CRYPTO</p><h2>Crypto wallets</h2><p className="muted">Configure the coin, network, receiving wallet and optional QR code members should use.</p></div><span className="admin-config-count">{cryptoOptions.length} configured</span></div><div className="admin-config-content">
          <form className="admin-config-form" onSubmit={addCrypto}><div className="admin-config-form-grid"><label>Currency<input value={cryptoDraft.currency} onChange={e => setCryptoDraft({...cryptoDraft,currency:e.target.value})} placeholder="BTC, USDT, BNB" /></label><label>Network / blockchain<input value={cryptoDraft.network} onChange={e => setCryptoDraft({...cryptoDraft,network:e.target.value})} placeholder="Bitcoin, TRC20, BSC" /></label><label className="admin-config-wide">Wallet address<input value={cryptoDraft.walletAddress} onChange={e => setCryptoDraft({...cryptoDraft,walletAddress:e.target.value})} placeholder="Receiving wallet address" /></label></div>
            <div className="admin-qr-upload"><div className="admin-qr-preview">{cryptoDraft.qrCode ? <img src={cryptoDraft.qrCode} alt="Crypto payment QR code preview" /> : <span>QR</span>}</div><div className="admin-qr-controls"><strong>Payment QR code</strong><p className="muted">Optional. Upload the QR code for this wallet so members can scan it instead of typing the address.</p><input ref={qrInputRef} className="admin-qr-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleQrUpload} /><div className="admin-qr-actions"><button type="button" className="button button-ghost" onClick={() => qrInputRef.current?.click()}>Choose QR image</button>{cryptoDraft.qrCode && <button type="button" className="button button-ghost" onClick={() => setCryptoDraft({...cryptoDraft,qrCode:''})}>Remove QR</button>}</div><small>PNG, JPEG or WebP · maximum 2 MB</small></div></div>
            <label className="admin-check"><input type="checkbox" checked={cryptoDraft.isActive} onChange={e => setCryptoDraft({...cryptoDraft,isActive:e.target.checked})} /> <span>Make this option active immediately</span></label><div className="admin-modal-actions"><button className="button button-primary" disabled={saving}>{editingCrypto ? 'Save crypto changes' : 'Add crypto option'}</button>{editingCrypto && <button type="button" className="button button-ghost" onClick={()=>{setEditingCrypto(null);setCryptoDraft(emptyCrypto())}}>Cancel</button>}</div>
          </form>
          <div className="admin-config-list">{cryptoOptions.length === 0 ? <div className="admin-config-empty"><strong>No crypto options configured</strong><span>Add a wallet above to make crypto available to members.</span></div> : cryptoOptions.map(x => <div className="admin-config-row" key={x._id || `${x.currency}-${x.network}`}><div className="admin-config-item-icon">{x.currency.slice(0,3)}</div>{x.qrCode && <img className="admin-config-qr-thumb" src={x.qrCode} alt={`${x.currency} QR code`} />}<div className="admin-config-item-main"><strong>{x.currency} <span>{x.network}</span></strong><small className="config-address">{x.walletAddress}</small></div><span className={`admin-status ${x.isActive?'good':'bad'}`}>{x.isActive?'ACTIVE':'DISABLED'}</span><div className="admin-actions"><button onClick={()=>{setEditingCrypto(x);setCryptoDraft({...emptyCrypto(),...x})}}>Edit</button><button onClick={()=>toggleCrypto(x._id)}>{x.isActive?'Disable':'Enable'}</button>{x._id && <button className="danger" onClick={()=>removeCrypto(x._id)}>Remove</button>}</div></div>)}</div>
        </div></article>
        <article className="admin-config-panel"><div className="admin-config-panel-header"><div><p className="eyebrow">2 | GIFT CARDS</p><h2>Gift-card payments</h2><p className="muted">Configure accepted brands and the instructions members receive.</p></div><span className="admin-config-count">{giftCardOptions.length} configured</span></div><div className="admin-config-content"><form className="admin-config-form" onSubmit={addGift}><div className="admin-config-form-grid"><label>Gift-card brand<input value={giftDraft.brand} onChange={e=>setGiftDraft({...giftDraft,brand:e.target.value})} placeholder="Apple, Steam, eBay, Razer Gold" /></label><label className="admin-config-wide">Instructions<textarea rows="4" value={giftDraft.instructions} onChange={e=>setGiftDraft({...giftDraft,instructions:e.target.value})} placeholder="Tell the member how to provide the gift card safely." /></label></div><label className="admin-check"><input type="checkbox" checked={giftDraft.isActive} onChange={e=>setGiftDraft({...giftDraft,isActive:e.target.checked})} /><span>Make this option active immediately</span></label><div className="admin-modal-actions"><button className="button button-primary" disabled={saving}>{editingGift?'Save gift-card changes':'Add gift-card option'}</button>{editingGift&&<button type="button" className="button button-ghost" onClick={()=>{setEditingGift(null);setGiftDraft(emptyGiftCard())}}>Cancel</button>}</div></form><div className="admin-config-list">{giftCardOptions.length===0?<div className="admin-config-empty"><strong>No gift-card options configured</strong><span>Add an accepted brand above to make it available to members.</span></div>:giftCardOptions.map(x=><div className="admin-config-row" key={x._id||x.brand}><div className="admin-config-item-icon">GC</div><div className="admin-config-item-main"><strong>{x.brand}</strong><small>{x.instructions||'No special instructions configured.'}</small></div><span className={`admin-status ${x.isActive?'good':'bad'}`}>{x.isActive?'ACTIVE':'DISABLED'}</span><div className="admin-actions"><button onClick={()=>{setEditingGift(x);setGiftDraft({...emptyGiftCard(),...x})}}>Edit</button><button onClick={()=>toggleGift(x._id)}>{x.isActive?'Disable':'Enable'}</button>{x._id&&<button className="danger" onClick={()=>removeGift(x._id)}>Remove</button>}</div></div>)}</div></div></article>
      </section>}
    </main>
  )
}
