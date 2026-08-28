# Fan Site — Project TODO

## Current payment architecture
- [x] Replace automated gateway checkout with designated-support manual payment flow
- [x] Generate unique payment tokens for membership, meeting and gift requests
- [x] Require designated support administrator confirmation before settlement
- [x] Notify members in-site after successful payment confirmation
- [x] Remove wallet models, services, routes and UI
- [x] Remove saved payment-method UI and provider callbacks
- [x] Keep membership purchases, meeting booking and gift gifting intact
- [x] Add Crypto as the default payment method
- [x] Add configurable crypto options and network-specific wallet destinations
- [x] Add gift-card payment method and configurable brands/instructions
- [x] Add payment-proof submission state
- [x] Add admin proof review and rejection flow
- [x] Prevent confirmation until proof is submitted
- [x] Preserve purchase-specific settlement
- [ ] Implement real proof-file upload/storage (current endpoint accepts a proof URL)
- [ ] Add proof-file validation and size limits
- [ ] Add admin payment configuration UI
- [ ] Seed initial crypto wallet/gift-card configuration
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
- [x] Add payment configuration model/API
- [x] Add authenticated member profile photo update endpoint
- [x] Validate and size-limit stored profile photos
- [ ] Centralize API error handling
- [ ] Add authentication/payment rate limiting
- [ ] Add stale pending-payment cleanup
- [ ] Add administrative audit log

## Frontend
- [x] Manual payment status page
- [x] Crypto/gift-card method selector
- [x] Crypto wallet display
- [x] Gift-card option display
- [x] Proof submission UI
- [x] Remove wallet balance/add-funds UI
- [x] Remove saved payment methods UI
- [x] Remove payment gateway callback UI
- [ ] Replace proof URL field with integrated file uploader
- [ ] Add payment configuration management UI
- [ ] Centralize API client
- [ ] Complete responsive UI
- [x] Harden membership card responsive layout and prevent detail overlap
- [x] Add member profile photo upload, client-side crop and resize
- [x] Show uploaded member photo on membership card while retaining initials fallback
- [x] Fix membership card print isolation and full-color print styling
- [ ] Accessibility review

## Product features
- [x] Membership dashboard and digital card UI
- [x] Meeting availability/calendar UI
- [x] Gift history and gifting UX
- [x] Notification center
- [x] Admin dashboard expansion
- [ ] Community moderation/reporting

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
