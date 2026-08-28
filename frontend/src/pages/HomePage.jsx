import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const highlights = [
  { number: '01', title: 'Connect', text: 'Join a respectful fan community built around conversation, shared moments and genuine appreciation.' },
  { number: '02', title: 'Experience', text: 'Explore membership, events, digital gifts and opportunities designed to make your fan journey memorable.' },
  { number: '03', title: 'Meet', text: 'Book a virtual meeting experience and choose the access level that fits your membership.' },
]

const careerMilestones = [
  { year: '1986', title: 'A career begins', work: 'River’s Edge', text: 'An early dramatic performance that marked the beginning of a screen career.' },
  { year: '1989', title: 'A breakout duo', work: 'Bill & Ted’s Excellent Adventure', text: 'Ted Logan became one of the roles that introduced Keanu to a much wider audience.' },
  { year: '1994', title: 'Action breakthrough', work: 'Speed', text: 'Jack Traven established a new action-hero chapter and became a defining role of the 1990s.' },
  { year: '1999', title: 'A cultural landmark', work: 'The Matrix', text: 'Neo transformed his career and became one of modern cinema’s most recognizable characters.' },
  { year: '2014', title: 'A new action era', work: 'John Wick', text: 'The role of John Wick launched a celebrated action franchise built around physical performance and disciplined craft.' },
  { year: 'Today', title: 'Still evolving', work: 'Film, stage & beyond', text: 'A career spanning decades continues through acting, creative work and new projects.' },
]

const membershipPreview = [
  { name: 'Supporter', price: '$1,000', description: 'A recognized place in the community with a digital membership card and exclusive updates.' },
  { name: 'Insider', price: '$3,500', description: 'Deeper access with premium content, priority selected events and an enhanced membership card.' },
  { name: 'Premier', price: '$5,000', description: 'A distinguished tier with expanded content, event priority and Premier recognition.' },
  { name: 'Elite', price: '$7,500', description: 'Elevated access, premium recognition and priority experiences for dedicated members.' },
  { name: 'VIP', price: '$10,000', description: 'The highest tier with VIP experiences, priority access and an exclusive celebrity-edition card.' },
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
          <div className="hero-actions"><Link className="button button-primary" to={isAuthenticated ? '/community' : '/register'}>{isAuthenticated ? 'Enter the Community' : 'Join the Community'}</Link><Link className="button button-ghost" to="#about">Discover Keanu</Link></div>
          <div className="hero-meta"><span>Career</span><i /><span>Community</span><i /><span>Membership</span><i /><span>Experiences</span></div>
        </div>
        <div className="hero-scroll" aria-hidden="true">SCROLL <span>↓</span></div>
      </section>

      <section id="about" className="intro-section section-shell">
        <div className="section-heading split-heading"><div><p className="eyebrow">ABOUT KEANU REEVES</p><h2>An actor. A body of work. A lasting connection.</h2></div><p>From early dramatic roles to some of cinema’s most recognizable characters, Keanu Reeves has built a career defined by range, persistence and an ability to make very different stories feel personal.</p></div>
        <div className="highlight-grid">{highlights.map((item) => <article className="highlight-card" key={item.number}><span>{item.number}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section className="about-strip"><div className="about-visual" aria-hidden="true"><span>KR</span></div><div className="about-copy"><p className="eyebrow">THE PERSON BEHIND THE LEGACY</p><h2>More than a screen presence.</h2><p>Known for memorable performances in dramas, comedies and action films, Reeves has remained a distinctive presence across generations of audiences. His work includes cult favorites, blockbuster franchises and character-driven stories.</p><p className="about-note">This fan community celebrates the work and career of Keanu Reeves. It is an independent fan project and is not the official website of Keanu Reeves.</p></div></section>

      <section className="career-section section-shell" id="career">
        <div className="section-heading split-heading career-heading"><div><p className="eyebrow">THE JOURNEY</p><h2>A career measured in chapters.</h2></div><p>Explore a selection of milestones that shaped an unusually varied screen career—from early dramatic work to defining franchises.</p></div>
        <div className="career-timeline">{careerMilestones.map((item, index) => <article className="career-milestone" key={`${item.year}-${item.title}`}><div className="career-marker"><span>{String(index + 1).padStart(2, '0')}</span><i /></div><div className="career-year">{item.year}</div><div className="career-copy"><p className="eyebrow">{item.work}</p><h3>{item.title}</h3><p>{item.text}</p></div></article>)}</div>
      </section>

      <section className="experience-section section-shell">
        <div className="section-heading centered-heading"><p className="eyebrow">THE FAN EXPERIENCE</p><h2>Choose how you want to engage.</h2><p>Every part of the platform is designed around participation, from community conversations to premium fan experiences.</p></div>
        <div className="experience-grid"><Link className="experience-card experience-community" to="/community"><span>COMMUNITY</span><strong>Share the moment.</strong><small>Posts, reactions and fan conversations.</small><b>→</b></Link><Link className="experience-card experience-meeting" to="/meetings"><span>MEETINGS</span><strong>Make it personal.</strong><small>Explore virtual meeting experiences.</small><b>→</b></Link><Link className="experience-card experience-gifts" to="/gifts"><span>GIFTS</span><strong>Send appreciation.</strong><small>Choose a digital gift for the experience.</small><b>→</b></Link></div>
      </section>

      <section className="membership-preview section-shell" id="membership"><div className="section-heading centered-heading"><p className="eyebrow">MEMBERSHIP</p><h2>Five levels. One community.</h2><p>Choose the level of access that fits your fan experience, from Supporter to VIP.</p></div><div className="membership-preview-grid">{membershipPreview.map((plan, index) => <article className={`membership-preview-card tier-preview-${index + 1} ${index === 4 ? 'featured' : ''}`} key={plan.name}><span className="membership-index">0{index + 1}</span><p className="membership-tier">{plan.name}</p><h3>{plan.price}<small>/ year</small></h3><p>{plan.description}</p><Link className="text-link" to="/membership">View membership <span>→</span></Link></article>)}</div></section>

      <section className="meeting-cta"><div className="meeting-cta-content section-shell"><p className="eyebrow">A PREMIUM EXPERIENCE</p><h2>Make the community feel closer.</h2><p>Explore meeting opportunities and choose an experience based on your membership tier.</p><Link className="button button-light" to="/meetings">Explore Meetings</Link></div></section>

      <section className="final-cta section-shell"><p className="eyebrow">YOUR EXPERIENCE STARTS HERE</p><h2>Welcome to the community.</h2><p>Discover the stories, people and experiences that make being a fan worth sharing.</p><div className="hero-actions"><Link className="button button-primary" to={isAuthenticated ? '/community' : '/register'}>{isAuthenticated ? 'Enter the Community' : 'Create Your Account'}</Link><Link className="button button-ghost" to="/events">View Events</Link></div></section>
    </main>
  )
}
