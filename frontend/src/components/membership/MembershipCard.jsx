import './MembershipCard.css'
import keanuSignature from '../../assets/Keanu_Reeves_Signature.svg'

const tierClass = (card = {}) => {
  const design = card.cardDesign || card.membershipType || 'supporter'
  return design.toLowerCase().replace(/\s+/g, '-')
}

const TIER_META = {
  supporter: { rank: 'I', label: 'SUPPORTER', accent: 'Supporter' },
  insider: { rank: 'II', label: 'INSIDER', accent: 'Insider' },
  premier: { rank: 'III', label: 'PREMIER', accent: 'Premier' },
  elite: { rank: 'IV', label: 'ELITE', accent: 'Elite' },
  vip: { rank: 'V', label: 'VIP', accent: 'VIP' },
}

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'CM'
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export default function MembershipCard({ card, onPrint }) {
  const tier = tierClass(card)
  const meta = TIER_META[tier] || TIER_META.supporter
  const status = card?.status || 'ACTIVE'
  const memberName = card?.memberName || 'Community Member'
  const membershipType = card?.membershipType || meta.accent
  const hasSignature = tier === 'elite' || tier === 'vip'

  return (
    <div className="membership-card-wrap">
      <article
        className={`digital-membership-card digital-card-${tier}`}
        aria-label={`${membershipType} digital membership card`}
      >
        <div className="digital-card-background" aria-hidden="true" />
        <div className="digital-card-watermark" aria-hidden="true">KR</div>

        <header className="digital-card-header">
          <div>
            <span className="digital-card-tier-label">TIER {meta.rank}</span>
            <h2>{meta.label}</h2>
            <p>MEMBER</p>
          </div>
          <div className="digital-card-brand">
            <strong>KEANU REEVES</strong>
            <span>OFFICIAL FAN COMMUNITY</span>
          </div>
        </header>

        <div className="digital-card-divider" aria-hidden="true" />

        <div className="digital-card-member">
          <div className="digital-card-member-avatar">
            {card?.profileImage ? <img src={card.profileImage} alt="" /> : getInitials(memberName)}
          </div>
          <div className="digital-card-member-details">
            <span>MEMBER NAME</span>
            <strong>{memberName}</strong>
            <span>MEMBERSHIP NUMBER</span>
            <strong>{card?.membershipNumber || 'KR-••••••'}</strong>
          </div>
        </div>

        <div className="digital-card-tier-watermark" aria-hidden="true">{meta.rank}</div>

        {tier === 'premier' && (
          <div className="digital-card-seal" aria-hidden="true">
            <span>KR</span>
            <small>III</small>
          </div>
        )}

        {hasSignature && (
          <div className="digital-card-celebrity-mark" aria-label="Keanu Reeves signature">
            <img src={keanuSignature} alt="Keanu Reeves signature" />
            <small>CELEBRITY EDITION</small>
          </div>
        )}

        <footer className="digital-card-footer">
          <div>
            <span>MEMBER SINCE</span>
            <strong>{formatDate(card?.startedAt)}</strong>
          </div>
          <div>
            <span>VALID THRU</span>
            <strong>{formatDate(card?.expiresAt)}</strong>
          </div>
          <div>
            <span>LEVEL</span>
            <strong>{membershipType}</strong>
          </div>
          <div className="digital-card-status">
            <span>STATUS</span>
            <strong><i />{status}</strong>
          </div>
        </footer>
      </article>

      <div className="digital-card-caption">
        <span>{meta.label} MEMBERSHIP • TIER {meta.rank}</span>
        <span>{card?.membershipNumber || 'MEMBER'}</span>
      </div>

      {onPrint && (
        <button type="button" className="digital-card-print-button button button-ghost" onClick={onPrint}>
          Print membership card
        </button>
      )}
    </div>
  )
}
