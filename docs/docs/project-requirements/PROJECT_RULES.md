# Project Rules

## Project Identity

Name:
KEANU REEVES — The Official Fan Community Experience

## Architecture

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MongoDB + Mongoose
- Payment Provider: Paystack

## Structure

- frontend/ contains the React application.
- server/ contains the API and backend logic.
- database/ contains database tooling and seed scripts.
- docs/ contains project documentation.

## Development Rules

- Never expose secrets in frontend code.
- Never commit `.env`.
- Never trust payment amounts supplied by the frontend.
- Payment transactions must be verified server-side.
- Membership privileges must be verified server-side.
- Do not hard-code production credentials.
- Do not replace project content with generic template content.
- Preserve the established project requirements when modifying features.

## Platform Disclosure

The platform is an independently developed student project and fan-community concept.
It is not operated, sponsored, endorsed, or officially affiliated with Keanu Reeves,
his representatives, or any associated organization.

## Currency

- Default platform currency: USD
- Currency code: USD
- All prices are stored as numeric amounts alongside their ISO 4217 currency code.
- The backend is authoritative for product prices and currency.
- The frontend must never be trusted to determine payment amounts.
- Payment currency must be validated against the payment provider's supported currencies.
// Monetary values are stored in minor units.
// Example: $35.00 = 3500.