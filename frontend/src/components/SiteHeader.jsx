import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

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

  useEffect(() => {
    if (!token) { setUnreadCount(0); return undefined }
    let cancelled = false
    const loadUnreadCount = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } })
        if (!response.ok) return
        const data = await response.json()
        if (!cancelled) setUnreadCount(Number(data.unreadCount ?? data.count ?? 0))
      } catch { /* Notifications should never block navigation. */ }
    }
    loadUnreadCount()
    const interval = window.setInterval(loadUnreadCount, 30000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [token])

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
