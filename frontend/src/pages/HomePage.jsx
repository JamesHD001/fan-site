import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const highlights = [
  { number: '01', title: 'Connect', text: 'Join a respectful fan community built around conversation, shared moments and genuine appreciation.' },
  { number: '02', title: 'Experience', text: 'Explore membership, events, digital gifts and opportunities designed to make your fan journey memorable.' },
  { number: '03', title: 'Meet', text: 'Book a virtual meeting experience and choose the access level that fits your membership.' },
]

const membershipPreview = [
  { name: 'Supporter', price: '$1,000', description: 'A recognized place in the community with a digital membership card and exclusive updates.' },
  { name: 'Insider', price: '$3,500', description: 'Deeper access with premium content, priority selected events and an enhanced membership card.' },
  { name: 'VIP', price: '$10,000', description: 'The premium fan experience with priority access, VIP events and premium recognition.' },
]

export default function HomePage() {
  const { isAuthenticated } = useAuth()

  return (
    <main className="home-page">
      <section className="hero-section">
        <div className="hero-art" aria-hidden="true"><div className="hero-glow hero-glow-one" /><div className="hero-glow hero-glow-two" /><div className="hero-grid" /></div>
        <div className="hero-content page-container">
          <p className="hero-kicker">THE OFFICIAL FAN COMMUNITY EXPERIENCE</p>
          <h1><span>KEANU</span> REEVES</h1>
          <p className="hero-lead">Connect. Engage. Experience.</p>
          <p className="hero-copy">A premium fan community celebrating the career, work and enduring legacy of Keanu Reeves.</p>
          <div className="hero-actions"><Link className="button button-primary" to={isAuthenticated ? '/community' : '/register'}>{isAuthenticated ? 'Enter the Community' : 'Join the Community'}</Link><Link className="button button-ghost" to="/membership">Explore Membership</Link></div>
          <div className="hero-meta"><span>Community</span><i /><span>Membership</span><i /><span>Meetings</span><i /><span>Gifts</span></div>
        </div>
        <div className="hero-scroll" aria-hidden="true">SCROLL <span>↓</span></div>
      </section>

      <section className="intro-section section-shell">
        <div className="section-heading split-heading"><div><p className="eyebrow">WELCOME</p><h2>A place for fans to experience more.</h2></div><p>Built as a dedicated digital home for fans who want more than a profile page: conversation, events, membership experiences and meaningful ways to engage.</p></div>
        <div className="highlight-grid">{highlights.map((item) => <article className="highlight-card" key={item.number}><span>{item.number}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section className="about-strip"><div className="about-visual" aria-hidden="true"><span>KR</span></div><div className="about-copy"><p className="eyebrow">THE PERSON BEHIND THE LEGACY</p><h2>More than a screen presence.</h2><p>From iconic performances to a career defined by range, humility and cultural impact, Keanu Reeves has built a body of work that continues to connect with audiences around the world.</p><Link className="text-link" to="/events">Explore the experience <span>→</span></Link></div></section>

      <section className="experience-section section-shell">
        <div className="section-heading centered-heading"><p className="eyebrow">THE FAN EXPERIENCE</p><h2>Choose how you want to engage.</h2><p>Every part of the platform is designed around participation, from community conversations to premium fan experiences.</p></div>
        <div className="experience-grid"><Link className="experience-card experience-community" to="/community"><span>COMMUNITY</span><strong>Share the moment.</strong><small>Posts, reactions and fan conversations.</small><b>→</b></Link><Link className="experience-card experience-meeting" to="/meetings"><span>MEETINGS</span><strong>Make it personal.</strong><small>Explore virtual meeting experiences.</small><b>→</b></Link><Link className="experience-card experience-gifts" to="/gifts"><span>GIFTS</span><strong>Send appreciation.</strong><small>Choose a digital gift for the experience.</small><b>→</b></Link></div>
      </section>

      <section className="membership-preview section-shell"><div className="section-heading centered-heading"><p className="eyebrow">MEMBERSHIP</p><h2>Your place in the community.</h2><p>Three tiers. Different levels of access. One community.</p></div><div className="membership-preview-grid">{membershipPreview.map((plan, index) => <article className={`membership-preview-card ${index === 2 ? 'featured' : ''}`} key={plan.name}><span className="membership-index">0{index + 1}</span><p className="membership-tier">{plan.name}</p><h3>{plan.price}<small>/ year</small></h3><p>{plan.description}</p><Link className="text-link" to="/membership">View membership <span>→</span></Link></article>)}</div></section>

      <section className="meeting-cta"><div className="meeting-cta-content section-shell"><p className="eyebrow">A PREMIUM EXPERIENCE</p><h2>Make the community feel closer.</h2><p>Explore meeting opportunities and choose an experience based on your membership tier.</p><Link className="button button-light" to="/meetings">Explore Meetings</Link></div></section>

      <section className="final-cta section-shell"><p className="eyebrow">YOUR EXPERIENCE STARTS HERE</p><h2>Welcome to the community.</h2><p>Discover the stories, people and experiences that make being a fan worth sharing.</p><div className="hero-actions"><Link className="button button-primary" to={isAuthenticated ? '/community' : '/register'}>{isAuthenticated ? 'Enter the Community' : 'Create Your Account'}</Link><Link className="button button-ghost" to="/events">View Events</Link></div></section>
    </main>
  )
}
