import './MembershipCard.css'

const tierClass = (name = '') => name.toLowerCase().replace(/\s+/g, '-')

const formatDate = (value) => {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'CM'
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export default function MembershipCard({ card }) {
  const tier = tierClass(card?.membershipType || 'supporter')
  const status = card?.status || 'ACTIVE'
  const memberName = card?.memberName || 'Community Member'

  return (
    <div className="membership-card-wrap">
      <article
        className={`digital-membership-card digital-card-${tier}`}
        aria-label={`${card?.membershipType || 'Fan'} digital membership card`}
      >
        <div className="digital-card-glow" aria-hidden="true" />
        <div className="digital-card-noise" aria-hidden="true" />

        <div className="digital-card-header">
          <div className="digital-card-brand">
            <span className="digital-card-brand-mark">KR</span>
            <span>KEANU REEVES<br /><b>FAN COMMUNITY</b></span>
          </div>
          <span className="digital-card-edition">MEMBER / 2026</span>
        </div>

        <div className="digital-card-chip" aria-hidden="true">
          <span /><span /><span />
        </div>

        <div className="digital-card-monogram" aria-hidden="true">KR</div>

        <div className="digital-card-content">
          <span className="digital-card-label">DIGITAL MEMBERSHIP</span>
          <h3>{card?.membershipType || 'Supporter'}</h3>
          <p>{card?.badge || card?.membershipType || 'Community Member'}</p>
        </div>

        <div className="digital-card-member-avatar" aria-hidden="true">
          {card?.profileImage ? <img src={card.profileImage} alt="" /> : getInitials(memberName)}
        </div>

        <div className="digital-card-footer">
          <div>
            <span>MEMBER</span>
            <strong>{memberName}</strong>
          </div>
          <div>
            <span>MEMBERSHIP NO.</span>
            <strong>{card?.membershipNumber || 'KR-••••••'}</strong>
          </div>
          <div>
            <span>ISSUED</span>
            <strong>{formatDate(card?.startedAt)}</strong>
          </div>
          <div>
            <span>EXPIRES</span>
            <strong>{formatDate(card?.expiresAt)}</strong>
          </div>
          <div className="digital-card-status" aria-label={`Membership status: ${status}`}>
            <span>STATUS</span>
            <strong><i />{status}</strong>
          </div>
        </div>
      </article>

      <div className="digital-card-caption">
        <span>AUTHENTIC DIGITAL MEMBERSHIP</span>
        <span>{card?.membershipNumber || 'MEMBER'}</span>
      </div>
    </div>
  )
}
