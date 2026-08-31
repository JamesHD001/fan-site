# Fan Site — Project TODO

## Current payment architecture
- [x] Replace automated gateway checkout with designated-support manual payment flow
- [x] Generate unique payment tokens for membership, meeting and gift requests
- [x] Require designated support administrator confirmation before settlement
- [x] Notify members in-site after successful payment confirmation
- [x] Remove wallet models, services, routes and UI
- [x] Remove saved payment-method UI and provider callbacks
- [x] Keep membership purchases, meeting booking and gift gifting intact
- [x] Add configurable crypto options and network-specific wallet destinations
- [x] Add gift-card payment method and configurable brands/instructions
- [x] Add payment-proof submission state
- [x] Add admin proof review and rejection flow
- [x] Prevent confirmation until proof is submitted
- [x] Preserve purchase-specific settlement
- [x] Implement real proof-file upload/storage using MongoDB GridFS
- [x] Add payment-proof file validation and 5 MB size limit
- [x] Add admin payment configuration UI
- [x] Seed initial crypto wallet/gift-card configuration
- [x] Allow purchase request creation before the member chooses a payment method
- [x] Require and persist the selected payment method with payment proof
- [ ] Run index migration locally
- [ ] Run backend/frontend tests after payment refactor
- [ ] Add manual payment integration tests
- [ ] Add payment request expiration/cleanup
- [ ] Add audit logging for administrative payment confirmations
- [ ] Future: replace manual flow with a production payment gateway

## Purchase settlement
- [x] Membership activation after admin confirmation
- [x] Membership number generation
- [x] Membership card availability after activation
- [x] Meeting confirmation after admin confirmation
- [x] Gift completion after admin confirmation
- [x] Purchase-specific in-site notifications

## Backend
- [x] Simplify environment validation after provider removal
- [x] Remove provider webhook/reconciliation startup dependencies
- [x] Add authenticated member profile photo update endpoint
- [x] Validate and size-limit stored profile photos
- [x] Add payment configuration model/API
- [x] Expose a recommended active membership plan with a safe fallback
- [ ] Centralize API error handling
- [ ] Add authentication/payment rate limiting
- [ ] Add stale pending-payment cleanup
- [ ] Add administrative audit log
- [x] Fix admin user deletion and associated-data cleanup
- [x] Allow deletion of other administrator/test accounts while protecting the current admin
- [x] Return populated author data when creating posts

## Frontend
- [x] Manual payment status page
- [x] Crypto/gift-card method selector
- [x] Crypto wallet display
- [x] Gift-card option display
- [x] Payment-proof submission UI
- [x] Persist payment proof files outside MongoDB documents
- [x] Remove wallet balance/add-funds UI
- [x] Remove saved payment methods UI
- [x] Remove payment gateway callback UI
- [x] Replace proof URL/data-URL persistence with protected stored-file retrieval
- [x] Add payment configuration management UI
- [x] Style and structure payment configuration administration page
- [x] Show payment-method choices after creating a purchase request
- [x] Prevent the payment page from auto-selecting a crypto method
- [x] Persist the selected payment method, crypto/network, or gift-card brand with proof submission
- [x] Add recommended membership-plan badge and styling
- [ ] Centralize API client
- [x] Complete responsive membership card layout
- [x] Harden membership card responsive layout and prevent detail overlap
- [x] Restore original membership card information layout
- [x] Apply distinct visual styling to all five membership tiers
- [x] Restrict celebrity signature to Elite and VIP cards
- [x] Use supplied Keanu Reeves signature asset on Elite and VIP cards
- [x] Keep member profile photo on card with initials fallback
- [x] Keep membership card print isolation and full-color print styling
- [x] Align membership-page card presentation with print-preview geometry
- [x] Make all five membership tiers available for purchase
- [x] Expand visitor landing page hero and navigation flow
- [x] Add visitor-facing About Keanu section
- [x] Add licensed Keanu Reeves imagery to hero and About sections
- [x] Add attribution for landing-page Keanu imagery
- [x] Add visitor-facing career/movies journey timeline
- [x] Expand visitor-facing five-tier membership preview
- [x] Add independent fan-project disclosure on landing page
- [x] Fix community post author identity display
- [x] Display post username alongside author name
- [x] Send authenticated requests when loading the community feed
- [ ] Accessibility review

## Product features
- [x] Membership dashboard and digital card UI
- [x] Five membership tiers: Supporter, Insider, Premier, Elite, VIP
- [x] Recommended membership plan: Insider
- [x] Meeting availability/calendar UI
- [x] Gift history and gifting UX
- [x] Notification center
- [x] Admin dashboard expansion
- [ ] Community moderation/reporting

## Repository hygiene
- [x] Remove unused Vite/React starter assets
- [x] Remove unused hero and legacy Keanu image assets
- [x] Remove unused public icon sprite
- [x] Remove duplicated nested project-rules document
- [x] Preserve active application assets and configuration files
- [ ] Re-run full frontend/backend tests after cleanup

## Quality & delivery
- [ ] Payment unit/integration test suite
- [ ] Full API integration test coverage
- [ ] GitHub Actions CI
- [ ] Expand README and API documentation
- [ ] Architecture diagram
- [ ] Terms of Use
- [ ] Privacy Policy
- [ ] Fan-project disclosure
- [ ] Production deployment
- [ ] Final school-project presentation flow
