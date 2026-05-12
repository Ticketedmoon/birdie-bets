# ADR-006: Party System and Invite Mechanism

## Status
Accepted

## Date
2026-05-12

## Context
Users need to create groups ("parties") to compete against friends. We need a way for:
- A user to create a party and select a tournament
- Other users to join that party
- Invitations to be sent or shared

## Decision
Support **two invite mechanisms**:

### 1. Invite Code / Shareable Link
- Each party gets a unique 6-character alphanumeric invite code (e.g., `GF4K9X`)
- A shareable link is generated: `https://{domain}/party/join?code=GF4K9X`
- Users can share this link via any messaging platform
- Anyone with the link/code who is signed in can join

### 2. Email Invitations
- Party creator can enter email addresses of people to invite
- Invites are stored in Firestore (`parties/{id}/invites/{email}`)
- When an invited user signs in, they see pending invitations on their dashboard
- **MVP approach**: No email sending — just match on sign-in. Future enhancement could add email notifications via Resend or Firebase Cloud Functions

### Party Lifecycle
- `picking` — party created, members can submit picks
- `locked` — tournament has started, picks frozen
- `complete` — tournament finished, final scores shown

## Consequences

### Positive
- Invite code is frictionless — works via any messaging app
- Email matching ensures invited users see the party without needing the code
- No email sending infrastructure needed for MVP (reduces complexity and cost)
- Party lifecycle states make it clear what actions are available

### Negative
- Without email notifications, invited users must independently visit the app to discover invites
- Invite codes could be shared beyond intended recipients (no access control)

### Future Enhancements
- Add email notifications using Resend or Firebase Cloud Functions
- Add party admin controls (remove members, close party)
- Add party privacy settings (public vs invite-only)
