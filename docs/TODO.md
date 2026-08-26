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
- [ ] Run index migration locally
- [ ] Run backend/frontend tests after refactor
- [ ] Complete payment integration tests

## Backend
- [ ] Centralize API error handling
- [ ] Add authentication/payment rate limiting
- [ ] Add environment configuration validation
- [ ] Add stale pending-payment cleanup
- [ ] Improve exchange-rate timeout/caching
- [ ] Add audit logging for administrative actions

## Frontend
- [x] Authentication context
- [x] Protected routes
- [x] Generic payment callback
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
