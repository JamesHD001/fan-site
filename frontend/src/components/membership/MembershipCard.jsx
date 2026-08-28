import './MembershipCard.css'
import keanuSignature from '../../assets/Keanu_Reeves_Signature.svg'

const tierClass = (card = {}) => {
  const design = card.cardDesign || card.membershipType || 'supporter'
  return design.toLowerCase().replace(/\s+/g, '-')
}

const TIER_META = {
  supporter: { rank: 'I', label: 'COMMUNITY', tagline: 'A place to belong', accent: 'Supporter' },
  insider: { rank: 'II', label: 'INSIDER', tagline: 'Closer to the experience', accent: 'Insider' },
  premier: { rank: 'III', label: 'PREMIER', tagline: 'A more exclusive experience', accent: 'Premier' },
  elite: { rank: 'IV', label: 'ELITE', tagline: 'Reserved for dedicated members', accent: 'Elite' },
  vip: { rank: 'V', label: 'VIP', tagline: 'The highest community tier', accent: 'VIP' },
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

  return (
    <div className="membership-card-wrap" style={{ width: 'min(100%, 900px)', justifySelf: 'center' }}>
      <article
        className={`digital-membership-card digital-card-${tier}`}
        aria-label={`${membershipType} digital membership card`}
      >
        <div className="digital-card-atmosphere" aria-hidden="true" />
        <div className="digital-card-noise" aria-hidden="true" />
        <div className="digital-card-tier-watermark" aria-hidden="true">{meta.rank}</div>

        <div className="digital-card-header">
          <div className="digital-card-brand">
            <span className="digital-card-brand-mark">KR</span>
            <span>KEANU REEVES<br /><b>FAN COMMUNITY</b></span>
          </div>
          <div className="digital-card-tier-badge">
            <span>TIER {meta.rank}</span>
            <strong>{meta.label}</strong>
          </div>
        </div>

        <div className="digital-card-chip" aria-hidden="true">
          <span /><span /><span />
        </div>

        <div className="digital-card-content">
          <span className="digital-card-label">DIGITAL MEMBERSHIP</span>
          <h3>{membershipType}</h3>
          <p>{card?.badge || meta.tagline}</p>
        </div>

        <div className="digital-card-member-avatar" aria-hidden="true">
          {card?.profileImage ? <img src={card.profileImage} alt="" /> : getInitials(memberName)}
        </div>

        {tier === 'premier' && <div className="digital-card-seal" aria-hidden="true"><span>KR</span><small>PREMIER</small></div>}
        {tier === 'elite' && <div className="digital-card-elite-stripe" aria-hidden="true" />}
        {tier === 'vip' && (
          <div
            className="digital-card-celebrity-mark"
            aria-label="Keanu Reeves signature"
            style={{
              position: 'absolute',
              right: '7%',
              top: '25%',
              width: 'clamp(115px, 20%, 180px)',
              zIndex: 4,
              transform: 'rotate(-6deg)',
            }}
          >
            <img
              className="digital-card-signature"
              src={keanuSignature}
              alt="Keanu Reeves signature"
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                filter: 'brightness(0) saturate(100%) invert(76%) sepia(38%) saturate(670%) hue-rotate(359deg) brightness(91%) contrast(87%)',
              }}
            />
            <small style={{ display: 'block', marginTop: '3px', textAlign: 'center', color: '#d5b26d', fontSize: '5px', letterSpacing: '.2em' }}>
              CELEBRITY EDITION
            </small>
          </div>
        )}

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
