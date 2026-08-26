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

export default function MembershipCard({ card }) {
  const tier = tierClass(card?.membershipType || 'supporter')
  const status = card?.status || 'ACTIVE'
  const benefitsCount = Array.isArray(card?.benefits) ? card.benefits.length : null

  return (
    <article
      className={`digital-membership-card digital-card-${tier}`}
      aria-label={`${card?.membershipType || 'Fan'} digital membership card`}
    >
      <div className="digital-card-noise" aria-hidden="true" />

      <div className="digital-card-header">
        <span>KEANU REEVES</span>
        <span>FAN COMMUNITY</span>
      </div>

      <div className="digital-card-monogram" aria-hidden="true">KR</div>

      <div className="digital-card-content">
        <span className="digital-card-label">MEMBERSHIP</span>
        <h3>{card?.membershipType || 'Supporter'}</h3>
        <p>{card?.badge || card?.membershipType || 'Community Member'}</p>
      </div>

      <div className="digital-card-footer">
        <div>
          <span>MEMBER</span>
          <strong>{card?.memberName || 'Community Member'}</strong>
        </div>
        <div>
          <span>NUMBER</span>
          <strong>{card?.membershipNumber || 'KR-••••••'}</strong>
        </div>
        <div>
          <span>VALID UNTIL</span>
          <strong>{formatDate(card?.expiresAt)}</strong>
        </div>
        <div className="digital-card-status" aria-label={`Membership status: ${status}`}>
          <span>STATUS</span>
          <strong>{status}</strong>
        </div>
        <div className="digital-card-mark" aria-hidden="true">
          {benefitsCount ? benefitsCount.toString().padStart(2, '0') : '01'}
        </div>
      </div>
    </article>
  )
}
