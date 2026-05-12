# ADR-009: Auto-Refresh Leaderboard Every 5 Minutes

## Status
Accepted

## Date
2026-05-12

## Context
During a live tournament, users want to see updated scores without manually refreshing the page. The ESPN API provides near-real-time data, but we need to balance freshness with API usage and user experience.

## Decision
- **Auto-refresh every 5 minutes** (300 seconds) via a client-side `setInterval`
- Display a visible **countdown timer** on the refresh button (e.g. `🔄 Refresh (3:42)`)
- Show **"Last updated"** timestamp with countdown below the party header
- Manual refresh button resets the timer
- Each refresh also **re-syncs the party status** from ESPN (checking if tournament has started/ended)

## Consequences
### Positive
- Users always see reasonably fresh scores during live tournaments
- Countdown timer manages expectations (no wondering "is this current?")
- Manual override available for impatient users
- Party status transitions happen automatically

### Negative
- 5-minute interval means scores can be up to 5 minutes stale
- Multiple users viewing the same party each make independent API calls (no shared cache)
- Timer runs even when tournament isn't live (minor wasted calls)
