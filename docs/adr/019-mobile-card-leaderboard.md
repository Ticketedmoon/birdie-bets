# ADR-019: Mobile Card Layout for Leaderboard

## Status
Accepted

## Date
2026-05-13

## Context
The leaderboard table has 9 columns (#, Player, Group A–D, Wild 1–2, Total) which requires horizontal scrolling on mobile. While functional with a "← Scroll →" hint, this is a suboptimal mobile UX — users must scroll sideways to see all picks.

## Decision
Implement a **dual-view leaderboard**: card layout on mobile, table on desktop.

### Mobile Card Layout
Each party member is rendered as a stacked card:
- **Header row**: Rank (with emoji for podium), avatar, name, total score
- **Body**: 6 pick rows (A, B, C, D, W1, W2) with player name and score
- **Styling**: Own card highlighted green, CUT/WD/DQ in red with badge, hidden picks show 🔒
- **Payout badges**: Shown on podium cards when tournament is complete

### View Toggle
A **Cards / Table** toggle appears on mobile only (`sm:hidden`). Users can switch between the card layout (default) and the full horizontal-scroll table if they prefer the dense view.

### Desktop
The existing table is always shown on `sm:` and above. The toggle is hidden on desktop.

### Visibility Logic
- Cards: `mobileView === "cards" ? "sm:hidden" : "hidden"`
- Table: `mobileView === "table" ? "sm:block" : "hidden sm:block"`
- Both views use the same `showPicks = picksRevealed || isOwnRow` logic

## Other Mobile Fixes (bundled)
- **GroupEditor**: Action buttons wrap with `flex-wrap`, 44px min tap targets
- **Dashboard**: Delete button always visible on mobile (hover-only on desktop), larger tap area
- **Navbar**: Sign Out button taller on mobile (`py-2.5`)
- **Party page**: Share link row stacks vertically on narrow screens (`flex-col sm:flex-row`)

## Consequences

### Positive
- No horizontal scrolling needed on mobile (card view)
- Users who prefer the table can still access it via toggle
- Same data and logic — no duplication of business rules
- All touch targets meet 44px minimum

### Negative
- Two leaderboard renderings to maintain (cards + table)
- Slightly more JSX in the party page component
