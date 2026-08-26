import { Link } from 'react-router-dom'

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner section-shell">
        <div className="footer-brand"><Link to="/" className="footer-logo">KEANU<span>REEVES</span></Link><p>The Official Fan Community Experience.</p></div>
        <div className="footer-links"><div><span>EXPLORE</span><Link to="/community">Community</Link><Link to="/events">Events</Link><Link to="/membership">Membership</Link></div><div><span>EXPERIENCE</span><Link to="/meetings">Meetings</Link><Link to="/gifts">Gifts</Link><Link to="/login">Sign in</Link></div></div>
      </div>
      <div className="footer-bottom section-shell"><span>© {new Date().getFullYear()} Keanu Reeves Fan Community</span><span>Student project · All rights reserved.</span></div>
    </footer>
  )
}
