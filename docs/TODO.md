# Fan Site — Project TODO

## Critical stabilization
- [x] Associate meeting payments with bookings
- [x] Fix meeting Paystack amount verification to use minor units directly
- [x] Fix membership, meeting and gift frontend price formatting
- [x] Centralize successful payment settlement
- [x] Add generic authenticated payment verification endpoint
- [x] Make payment callback server-authoritative
- [x] Add database-level active meeting-slot uniqueness
- [x] Remove insecure default admin seed credentials
- [x] Declare Mongoose as a server dependency
- [x] Add request body-size limits
- [x] Add provider-independent Payment model foundation
- [x] Add platform Wallet model
- [x] Add wallet transaction ledger model
- [x] Add wallet credit/debit service with idempotent references
- [x] Add authenticated wallet and transaction endpoints
- [x] Add provider registry/contract for payment-provider migration
- [ ] Run index migration locally
- [ ] Run backend/frontend tests after refactor
- [ ] Complete payment integration tests

## Payment architecture
- [x] Implement Flutterwave provider
- [x] Implement Flutterwave initialization and verification
- [x] Implement Flutterwave webhook handling
- [x] Implement wallet funding/deposit flow
- [x] Add deposit UI
- [ ] Migrate membership purchases to platform credits
- [ ] Migrate meeting purchases to platform credits
- [ ] Migrate gifts to platform credits
- [ ] Apply platform-credit protection to all purchasable items
- [ ] Implement refunds/reversals
- [x] Add payment reconciliation tools
- [ ] Investigate Bybit Pay merchant/API integration
- [ ] Implement crypto funding (BTC/USDT/USDC/BNB)
- [ ] Retire Paystack after successful Flutterwave migration

## Backend
- [ ] Centralize API error handling
- [ ] Add authentication/payment rate limiting
- [ ] Add environment configuration validation
- [ ] Add stale pending-payment cleanup
- [x] Improve exchange-rate timeout/caching and lock the Flutterwave reference-rate snapshot per payment
- [x] Record provider fee/tax/settlement details without reducing customer payment validation
- [x] Acknowledge Flutterwave `REQUIRES_REVIEW` webhook outcomes with HTTP 200
- [x] Guard against provider transaction IDs being claimed by another payment
- [ ] Add audit logging for administrative actions

## Frontend
- [x] Authentication context
- [x] Protected routes
- [x] Generic payment callback
- [ ] Wallet balance UI
- [x] Add-funds UI
- [ ] Wallet transaction history UI
- [ ] Centralize API client
- [ ] Refactor App.jsx into route/layout modules
- [ ] Add reusable currency/date formatters
- [ ] Complete responsive UI
- [ ] Accessibility review

## Product features
- [ ] Complete homepage
- [ ] Membership dashboard and digital card UI
- [ ] Meeting availability/calendar UI
- [ ] Gift history and improved gifting UX
- [ ] Community moderation/reporting
- [ ] Notification center polish
- [ ] Admin dashboard expansion

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
