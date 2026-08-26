const tierClass = (name = '') => name.toLowerCase().replace(/\s+/g, '-')

export default function MembershipCard({ plan, memberName = 'Community Member', memberNumber = 'KR-••••••' }) {
  const tier = tierClass(plan?.name || 'supporter')
  const benefits = plan?.benefits || []

  return (
    <article className={`digital-membership-card digital-card-${tier}`} aria-label={`${plan?.name || 'Fan'} digital membership card`}>
      <div className="digital-card-noise" aria-hidden="true" />
      <div className="digital-card-header">
        <span>KEANU REEVES</span>
        <span>FAN COMMUNITY</span>
      </div>
      <div className="digital-card-monogram" aria-hidden="true">KR</div>
      <div className="digital-card-content">
        <span className="digital-card-label">MEMBERSHIP</span>
        <h3>{plan?.name || 'Supporter'}</h3>
        <p>{plan?.badge || plan?.name || 'Community Member'}</p>
      </div>
      <div className="digital-card-footer">
        <div><span>MEMBER</span><strong>{memberName}</strong></div>
        <div><span>NUMBER</span><strong>{memberNumber}</strong></div>
        <div className="digital-card-mark">{benefits.length > 0 ? benefits.length.toString().padStart(2, '0') : '01'}</div>
      </div>
    </article>
  )
}
