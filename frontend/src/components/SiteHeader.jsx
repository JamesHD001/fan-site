import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function SiteHeader() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="site-header">
      <Link className="site-brand" to="/" onClick={closeMenu}>KEANU FAN COMMUNITY</Link>
      <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="site-navigation" onClick={() => setMenuOpen((open) => !open)}>
        <span className="sr-only">Toggle navigation</span>
        <span aria-hidden="true">{menuOpen ? '×' : '☰'}</span>
      </button>
      <nav id="site-navigation" className={`site-navigation${menuOpen ? ' navigation-open' : ''}`}>
        <NavLink to="/events" onClick={closeMenu}>Events</NavLink>
        <NavLink to="/community" onClick={closeMenu}>Community</NavLink>
        {user && <><NavLink to="/membership" onClick={closeMenu}>Membership</NavLink><NavLink to="/meetings" onClick={closeMenu}>Meetings</NavLink><NavLink to="/gifts" onClick={closeMenu}>Gifts</NavLink><NavLink to="/notifications" onClick={closeMenu}>Notifications</NavLink></>}
        {user?.role === 'ADMIN' && <NavLink to="/admin" onClick={closeMenu}>Admin</NavLink>}
        {user ? <button className="header-signout" type="button" onClick={() => { closeMenu(); logout() }}>Sign out</button> : <NavLink to="/login" onClick={closeMenu}>Sign in</NavLink>}
      </nav>
    </header>
  )
}
