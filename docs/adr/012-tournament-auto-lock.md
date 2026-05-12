# ADR-012: Auto-Lock Parties When Tournament Starts

## Status
Accepted

## Date
2026-05-12

## Context
Picks must be locked once a tournament starts to prevent mid-tournament changes. We needed an automatic mechanism rather than relying on a manual admin action or cron job.

## Decision
Implement **lazy auto-sync** — check the ESPN tournament status on every page load and update the party status in Firestore if needed.

### Transition Rules
| Current Status | ESPN Status | New Status |
|---------------|-------------|------------|
| `picking` | `in` (tournament live) | `locked` |
| `picking` | `post` (tournament over) | `complete` |
| `locked` | `post` (tournament over) | `complete` |

### Implementation
- `lib/partySync.ts` — `syncPartyStatus(party)` function
- Called on **every party page load** and **every leaderboard refresh**
- Called on the **picks page load** — so users visiting a stale picks page see it's locked
- **Stale page protection**: When saving picks, the app re-fetches the party and re-checks ESPN status before writing. If the tournament has started, the save is rejected with a clear error message.

### Where It's Called
1. Party leaderboard page — on initial load and every 5-minute auto-refresh
2. Picks page — on initial load
3. Picks page — at save time (double-check before writing to Firestore)

## Consequences
### Positive
- Zero manual intervention — fully automatic
- No cron jobs or background workers needed
- Stale page protection prevents cheating via cached pages
- Works with Vercel's serverless model (no persistent process needed)

### Negative
- Relies on at least one user visiting the page to trigger the sync
- If no one visits between tournament start and end, the status won't update until someone does (acceptable for this use case)
- Each page load makes an ESPN API call (mitigated by the fact ESPN has no rate limits)
