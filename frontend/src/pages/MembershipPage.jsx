import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MembershipCard from '../components/membership/MembershipCard';
import '../styles/membership.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const TIER_META = {
  supporter: { rank: 'I', label: 'COMMUNITY' },
  insider: { rank: 'II', label: 'INSIDER' },
  premier: { rank: 'III', label: 'PREMIER' },
  elite: { rank: 'IV', label: 'ELITE' },
  vip: { rank: 'V', label: 'VIP' },
};

const getTierMeta = (plan) => {
  const key = String(plan?.cardDesign || plan?.slug || plan?.name || 'supporter').toLowerCase().replace(/\s+/g, '-');
  return TIER_META[key] || TIER_META.supporter;
};

const money = (amount, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(amount || 0) / 100);

export default function MembershipPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [membership, setMembership] = useState(null);
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [purchasing, setPurchasing] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const plansResponse = await fetch(`${API}/memberships/plans`);
        const plansData = await plansResponse.json();
        if (mounted && plansResponse.ok && plansData.success) setPlans(plansData.plans || []);
        if (!token) return;
        const membershipResponse = await fetch(`${API}/memberships/me`, { headers: { Authorization: `Bearer ${token}` } });
        const membershipData = await membershipResponse.json();
        if (!mounted) return;
        setMembership(membershipData.membership || null);
        if (membershipData.success && membershipData.membership?.status === 'ACTIVE') {
          const cardResponse = await fetch(`${API}/memberships/card`, { headers: { Authorization: `Bearer ${token}` } });
          const cardData = await cardResponse.json();
          if (mounted && cardResponse.ok && cardData.success) setCard(cardData.card);
        }
      } catch {
        if (mounted) setError('Unable to load membership information.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [token]);

  const printMembershipCard = () => {
    document.body.classList.add('printing-membership-card');
    const cleanup = () => {
      document.body.classList.remove('printing-membership-card');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.setTimeout(() => window.print(), 50);
  };

  const startPurchase = async (planId) => {
    if (!token) { navigate('/login'); return; }
    setPurchasing(planId); setError('');
    try {
      const response = await fetch(`${API}/memberships/initialize`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ planId }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to create payment request.');
      navigate(`/payment/pending/${encodeURIComponent(data.payment.token)}`);
    } catch (err) { setError(err.message); } finally { setPurchasing(null); }
  };

  const activePlan = membership?.plan && typeof membership.plan === 'object' ? membership.plan : plans.find((plan) => plan._id === membership?.plan);
  const active = membership?.status === 'ACTIVE';

  if (loading) return <main className="dashboard-page"><section className="dashboard-hero"><p>Loading your community access…</p></section></main>;

  return (
    <main className="dashboard-page">
      <header className="dashboard-hero page-container"><div><span className="eyebrow">MEMBERSHIP HUB</span><h1>{active ? 'Your membership.' : 'Find your place in the community.'}</h1><p>{active ? 'Manage your tier, card and renewal from one place.' : 'Compare the available tiers and choose the level of access that fits you.'}</p></div></header>
      {error && <div className="membership-alert page-container">{error}</div>}
      {active && activePlan && <section className="dashboard-section page-container"><div className="dashboard-grid">
        <article className="dashboard-panel"><span className="eyebrow">CURRENT TIER</span><h2>{activePlan.name}</h2><p>{activePlan.description}</p><div className="metric-row"><div><span>EXPIRES</span><strong>{membership.expiresAt ? new Date(membership.expiresAt).toLocaleDateString() : '—'}</strong></div><div><span>MEMBER</span><strong>{card?.memberName || user?.name || user?.username || 'Member'}</strong></div></div><Link className="text-link" to="/settings">Manage account →</Link></article>
        {card && <article className="dashboard-panel card-panel" style={{ gridColumn: '1 / -1' }}><div><span className="eyebrow">DIGITAL CARD</span><h2>Carry your membership.</h2></div><MembershipCard card={card} onPrint={printMembershipCard} /></article>}
      </div></section>}
      <section className="dashboard-section page-container"><div className="section-heading"><div><span className="eyebrow">{active ? 'CHANGE OR RENEW' : 'MEMBERSHIP TIERS'}</span><h2>{active ? 'Choose your next tier.' : 'Choose your level of access.'}</h2></div><Link className="text-link" to="/membership/payments">Payment history →</Link></div>
        {plans.length === 0 ? <div className="membership-alert">No membership tiers are currently available.</div> : <div className="dashboard-plans">{plans.map((plan) => { const tier = getTierMeta(plan); return <article className={`dashboard-plan tier-${tier.rank.toLowerCase()} ${plan.name === 'Insider' ? 'featured' : ''}`} key={plan._id}><div className="membership-plan-heading"><span className="eyebrow">TIER {tier.rank}</span><span className="membership-plan-label">{tier.label}</span></div><h3>{plan.name}</h3><strong>{money(plan.price, plan.currency || 'USD')}</strong><small> / {(plan.durationUnit || 'YEAR').toLowerCase()}</small><p>{plan.description}</p><ul>{(plan.benefits || []).slice(0, 5).map((benefit) => <li key={benefit}>✓ {benefit}</li>)}</ul><button className="button button-primary" disabled={purchasing === plan._id || ((activePlan?._id === plan._id) && active)} onClick={() => startPurchase(plan._id)}>{purchasing === plan._id ? 'Creating payment request…' : activePlan?._id === plan._id ? 'Current membership' : active ? `Renew ${plan.name}` : 'Continue to payment'}</button></article>; })}</div>}
      </section>
      <div className="dashboard-links page-container"><Link to="/meetings">Explore private meetings →</Link><Link to="/community">Enter the community →</Link></div>
    </main>
  );
}
