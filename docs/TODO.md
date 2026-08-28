# Fan Site — Project TODO

## Critical stabilization
- [x] Replace automated gateway checkout with designated-support manual payment flow
- [x] Generate unique payment tokens for membership, meeting and gift requests
- [x] Require designated support administrator confirmation before settlement
- [x] Notify members in-site after successful admin payment confirmation
- [x] Remove wallet models, services, routes and UI
- [x] Remove saved payment-method UI and provider callbacks
- [x] Keep membership purchases, meeting booking and gift gifting intact
- [ ] Run index migration locally
- [ ] Run backend/frontend tests after payment refactor
- [ ] Add manual payment integration tests

## Payment architecture
- [x] Manual payment request record with immutable purchase snapshot
- [x] Designated payment-support administrator
- [x] Payment token lookup for the requesting member
- [x] Admin payment operations page
- [x] Domain settlement after manual confirmation
- [x] Membership activation and membership-card availability after confirmation
- [x] Meeting confirmation after payment confirmation
- [x] Gift completion after payment confirmation
- [ ] Add payment request expiration/cleanup
- [ ] Add audit logging for administrative payment confirmations
- [ ] Future: replace manual flow with a production payment gateway

## Backend
- [x] Simplify environment validation after provider removal
- [x] Remove provider webhook/reconciliation startup dependencies
- [x] Keep notification service for payment confirmation notices
- [ ] Centralize API error handling
- [ ] Add authentication/payment rate limiting
- [ ] Add stale pending-payment cleanup
- [ ] Add audit logging for administrative actions

## Frontend
- [x] Manual payment request status page
- [x] Remove wallet balance UI
- [x] Remove add-funds UI
- [x] Remove saved payment methods UI
- [x] Remove payment gateway callback page
- [ ] Centralize API client
- [ ] Refactor App.jsx into route/layout modules
- [ ] Add reusable currency/date formatters
- [ ] Complete responsive UI
- [ ] Accessibility review

## Product features
- [ ] Complete homepage
- [x] Membership dashboard and digital card UI
- [x] Meeting availability/calendar UI
- [x] Gift history and improved gifting UX
- [ ] Community moderation/reporting
- [x] Notification center
- [x] Admin dashboard expansion

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
