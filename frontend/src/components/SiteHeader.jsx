import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const NOTIFICATION_POLL_MS = 10000

const links = [
  { to: '/events', label: 'Events' },
  { to: '/community', label: 'Community' },
  { to: '/membership', label: 'Membership', auth: true },
  { to: '/meetings', label: 'Meetings', auth: true },
  { to: '/gifts', label: 'Gifts', auth: true },
]

export default function SiteHeader() {
  const { user, token } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const closeMenu = () => setMenuOpen(false)

  const loadUnreadCount = useCallback(async () => {
    if (!token) { setUnreadCount(0); return }
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) return
      const data = await response.json()
      if (data.success) setUnreadCount(Math.max(0, Number(data.unreadCount) || 0))
    } catch { /* Notification polling must never block navigation. */ }
  }, [token])

  useEffect(() => {
    if (!token) { setUnreadCount(0); return undefined }
    let cancelled = false
    const refresh = async () => { if (!cancelled) await loadUnreadCount() }
    refresh()
    const interval = window.setInterval(refresh, NOTIFICATION_POLL_MS)
    const handleFocus = () => refresh()
    const handleVisibility = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('notifications:changed', refresh)
    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('notifications:changed', refresh)
    }
  }, [loadUnreadCount, token])

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="site-brand" to="/" onClick={closeMenu}><span>KEANU</span> REEVES</Link>
        <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="site-navigation" onClick={() => setMenuOpen((open) => !open)}><span className="sr-only">Toggle navigation</span><span aria-hidden="true">{menuOpen ? '×' : '☰'}</span></button>
        <nav id="site-navigation" className={`site-navigation${menuOpen ? ' navigation-open' : ''}`}>
          {user && <NavLink to="/dashboard" onClick={closeMenu}>Dashboard</NavLink>}
          {links.map((link) => (!link.auth || user) && <NavLink key={link.to} to={link.to} onClick={closeMenu}>{link.label}</NavLink>)}
          {user && <NavLink className="notification-nav-link" to="/notifications" onClick={closeMenu}>Notifications{unreadCount > 0 && <span className="notification-badge" aria-label={`${unreadCount} unread notifications`}>{unreadCount > 99 ? '99+' : unreadCount}</span>}</NavLink>}
          {user?.role === 'ADMIN' && <NavLink to="/admin" onClick={closeMenu}>Admin</NavLink>}
          {user ? <NavLink to="/settings" onClick={closeMenu}>Settings</NavLink> : <NavLink className="header-cta" to="/register" onClick={closeMenu}>Join</NavLink>}
        </nav>
      </div>
    </header>
  )
}
