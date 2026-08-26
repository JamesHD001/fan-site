import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const links = [
  { to: '/events', label: 'Events' },
  { to: '/community', label: 'Community' },
  { to: '/membership', label: 'Membership', auth: true },
  { to: '/meetings', label: 'Meetings', auth: true },
  { to: '/gifts', label: 'Gifts', auth: true },
]

export default function SiteHeader() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="site-brand" to="/" onClick={closeMenu}><span>KEANU</span> REEVES</Link>
        <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="site-navigation" onClick={() => setMenuOpen((open) => !open)}><span className="sr-only">Toggle navigation</span><span aria-hidden="true">{menuOpen ? '×' : '☰'}</span></button>
        <nav id="site-navigation" className={`site-navigation${menuOpen ? ' navigation-open' : ''}`}>
          {links.map((link) => (!link.auth || user) && <NavLink key={link.to} to={link.to} onClick={closeMenu}>{link.label}</NavLink>)}
          {user && <NavLink to="/notifications" onClick={closeMenu}>Notifications</NavLink>}
          {user?.role === 'ADMIN' && <NavLink to="/admin" onClick={closeMenu}>Admin</NavLink>}
          {user ? <button className="header-signout" type="button" onClick={() => { closeMenu(); logout() }}>Sign out</button> : <NavLink className="header-cta" to="/register" onClick={closeMenu}>Join</NavLink>}
        </nav>
      </div>
    </header>
  )
}
