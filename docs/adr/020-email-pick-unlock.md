# ADR 020: Email-Based Pick Unlock for Late Joiners

## Status

Accepted

## Context

When a tournament starts and the party transitions to "locked" status, members who haven't
submitted their picks are stuck — they can no longer access the picks page.

An earlier approach allowed the party owner to submit picks on behalf of members directly.
This raised trust and fairness concerns: the owner could manipulate another member's picks,
and there was no audit trail showing the member agreed to the selections.

## Decision

We replaced the "pick on behalf" approach with an **email-based unlock** system:

1. **Owner triggers**: When the party is locked, the owner sees a "📧 Send unlock" button
   next to members who haven't submitted picks.

2. **Email with time-limited link**: Clicking the button sends the member an email (via Resend)
   containing a unique unlock link. The link grants **1 hour** of access to submit picks.

3. **Member submits their own picks**: The member clicks the link, sees a countdown timer,
   and submits their own golfer selections. The owner cannot see or influence the picks.

4. **One-time use**: The unlock token is marked as used atomically when picks are saved
   (via a Firestore batch write). Previous unused tokens for the same member are invalidated
   when a new one is sent.

## Implementation Details

### Firestore Structure

Unlock tokens are stored at `parties/{partyId}/pickUnlocks/{token}`:

```typescript
interface PickUnlock {
  uid: string;           // member being granted access
  createdAt: string;     // ISO timestamp
  expiresAt: string;     // ISO timestamp (1 hour from creation)
  used: boolean;
  usedAt?: string;       // ISO timestamp when picks were saved
  createdBy: string;     // party owner UID
}
```

### API Routes

- `POST /api/send-pick-unlock` — validates caller is party creator, generates token, sends email
- `POST /api/submit-unlocked-picks` — validates token, saves picks + marks token used in one batch

### Security

- Tokens are UUIDs (unguessable)
- Token is validated server-side on save (not just on page load)
- Token must match the authenticated user's UID
- Token expires after 1 hour and is single-use
- Previous tokens are invalidated when a new one is sent
- Base URL for email links comes from `NEXT_PUBLIC_APP_URL` env var (not request Origin)

## Consequences

- **Positive**: Owner controls access timing but cannot influence pick selections
- **Positive**: Full audit trail via Firestore unlock documents
- **Positive**: Member retains agency over their own picks
- **Negative**: Requires the member to have email access and act within 1 hour
- **Negative**: Depends on Resend email delivery reliability
