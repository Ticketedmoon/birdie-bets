# ADR-018: Field Validation Gate Before Tournament Lock

## Status
Accepted

## Date
2026-05-13

## Context
Parties can be created before the ESPN tournament field is confirmed (usually 1–2 days before the event). The frozen player snapshot (ADR-017) captures the OWGR top-200 field at creation time, but some of those players may not actually enter the tournament. If a member picks a player who isn't in the confirmed field, their picks become invalid.

Previously, the system would auto-lock the party when ESPN reported the tournament as "in progress", regardless of pick validity.

## Decision
Add a **validation gate** in `syncPartyStatus()` that checks all members' picks against the confirmed ESPN field before allowing the `picking → locked` transition.

### Flow
1. Party is created (possibly before field is confirmed) — groups/wildcards are frozen (ADR-017)
2. Members make their picks from the frozen pool
3. When ESPN reports the tournament starting (`status: "in"`), `syncPartyStatus` triggers
4. Before locking, **validate all picks** against the ESPN leaderboard competitors
5. If all picks are valid → lock the party as normal
6. If any picks are invalid → **block the lock**, store invalid picks on the party doc, and email affected members

### Validation Logic (`src/lib/pickValidation.ts`)
- Fetches the ESPN leaderboard for the tournament (confirmed competitors)
- For each member's 6 picks, checks if the player name matches a competitor
- Uses normalised name matching (lowercase, accent-stripped) per ADR-014
- Returns a list of `{ uid, playerName, slot }` for invalid picks

### Email Notifications (`/api/notify-invalid-picks`)
- Sends a Resend email to each affected member listing their invalid players
- Includes a direct link to the picks page
- Rate-limited: only re-sends if >1 hour since last notification (`lastInvalidNotifiedAt`)

### UI Changes
- **Picks page**: Warning banner for users with invalid picks; affected selections highlighted in red with "⚠️ Not in field" labels
- **Party page**: Amber banner showing which members have invalid picks and that the game is waiting for them to update

### Data Model
```typescript
interface Party {
  // ... existing fields
  invalidPicks?: { uid: string; playerName: string; slot: string }[];
  lastInvalidNotifiedAt?: string;
}
```

### Re-validation Cycle
Each time any page triggers `syncPartyStatus()`:
1. If picks are now all valid → clear `invalidPicks`, lock the party
2. If still invalid → update `invalidPicks` list, re-notify if cooldown expired
3. Party stays in `picking` status until resolved

## Consequences

### Positive
- Parties can still be created early (before field confirmed) — no friction
- Members are proactively emailed when their picks become invalid
- The game won't start with broken picks — fair for all members
- Self-healing: each page load re-validates, so fixes are detected immediately

### Negative
- If ESPN field data is delayed or incorrect, the lock could be blocked unnecessarily
- Members who don't check email promptly could delay the game for everyone
- Additional ESPN API call during the lock transition (leaderboard fetch for validation)
- Late tournament withdrawals after locking are not caught (acceptable — same as real golf)
