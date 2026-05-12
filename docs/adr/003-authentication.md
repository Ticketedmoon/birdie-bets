# ADR-003: Authentication Strategy

## Status
Accepted

## Date
2026-05-12

## Context
Users need to sign in to create/join parties and submit player picks. We need an authentication method that is:
- Simple to implement
- Free
- Trusted by users
- Low friction (no password management)

## Decision
Use **Firebase Authentication with Google sign-in only**.

## Consequences

### Positive
- Single click sign-in — lowest friction for users
- No password storage or reset flows to implement
- Google handles account security (2FA, etc.)
- Firebase Auth integrates natively with Firestore security rules

### Negative
- Users without Google accounts cannot sign in
- Single identity provider creates a dependency on Google

### Alternatives Considered
- **Email/password**: Higher friction, requires password reset flows, security burden
- **Both Google + email/password**: More work to implement, marginal benefit for a hobby app
- **Magic link (email)**: Good UX but requires email sending infrastructure
