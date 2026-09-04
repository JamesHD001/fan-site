import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/settings.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function SecurityKeyPage() {
  const { token, user, updateUser } = useAuth()
  const [currentKey, setCurrentKey] = useState('')
  const [newKey, setNewKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)

  const rotateKey = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setNewKey('')
    setCopied(false)

    if (user?.role !== 'ADMIN' && !/^[A-Z0-9]{6,10}$/i.test(currentKey.trim())) {
      setError('Enter your current Security Key (6–10 letters/numbers).')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me/security-key/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ currentSecurityKey: currentKey })
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to change your Security Key.')
      setNewKey(data.securityKey)
      setCurrentKey('')
      setMessage(data.message)
      updateUser({ ...(user || {}), securityKeyEnabled: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const copyKey = async () => {
    if (!newKey) return
    try {
      await navigator.clipboard.writeText(newKey)
      setCopied(true)
    } catch {
      setError('Unable to copy automatically. Select the key and copy it manually.')
    }
  }

  return <main className="settings-page"><section className="settings-shell"><header className="settings-heading"><div><span className="eyebrow">ACCOUNT SECURITY</span><h1>Personal Security Key.</h1><p>Change the private key used to protect your member account when you sign in on a new device.</p></div><Link className="settings-back" to="/settings">← Settings</Link></header>
    {message && <div className="settings-message" role="status">{message}</div>}
    {error && <div className="settings-error" role="alert">{error}</div>}

    {newKey && <section className="settings-card"><div className="settings-card-heading"><span className="eyebrow">NEW KEY</span><span>Shown once</span></div><h2>Save this key now.</h2><p>Your old key is no longer valid. This new key will not be displayed again after you leave this page.</p><div className="security-key-display" aria-label="New Personal Security Key">{newKey}</div><button className="settings-primary" type="button" onClick={copyKey}>{copied ? 'Copied ✓' : 'Copy Security Key'}</button><p className="settings-security-note">Store it somewhere private. Never share it with another person.</p></section>}

    <section className="settings-card"><div className="settings-card-heading"><span className="eyebrow">CHANGE KEY</span></div><h2>Generate a new Security Key</h2><p>Changing your key immediately invalidates the old key and revokes every remembered device. You will need the new key the next time you sign in from a device that is not remembered.</p>
      <form onSubmit={rotateKey}><label>Current Security Key<input type="password" value={currentKey} onChange={(e) => setCurrentKey(e.target.value.slice(0, 10))} placeholder="Enter your current key" autoComplete="off" maxLength="10" disabled={loading || user?.role === 'ADMIN'} />{user?.role === 'ADMIN' && <small>Administrators do not need to enter a current Security Key.</small>}</label><button className="settings-primary" disabled={loading}>{loading ? 'Changing key…' : 'Generate new Security Key'}</button></form>
    </section>

    <section className="settings-card"><div className="settings-card-heading"><span className="eyebrow">IMPORTANT</span></div><h2>How key changes affect your account</h2><ul className="settings-security-list"><li>Your old Security Key stops working immediately.</li><li>All trusted devices are revoked when the key changes.</li><li>The new key is generated securely on the server and only shown once.</li><li>The stored database value is a password-style hash, not the readable key.</li><li>If you lose your key, account recovery will require a verified recovery channel once that feature is available.</li></ul><Link className="settings-link" to="/settings/trusted-devices">Manage trusted devices →</Link></section>
  </section></main>
}
