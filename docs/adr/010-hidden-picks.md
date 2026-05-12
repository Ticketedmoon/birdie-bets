# ADR-010: Hidden Picks Until Tournament Starts

## Status
Accepted

## Date
2026-05-12

## Context
If players can see each other's picks before the tournament starts, it undermines the strategic element of the game. Users could copy strong picks or adjust their strategy based on others' selections.

## Decision
- **Before tournament starts** (party status `picking`):
  - Each user can only see **their own picks** in the leaderboard table
  - Other users' pick cells show a **🔒 Hidden** placeholder
  - Other users' total score is hidden
  - A yellow banner explains: "Picks are hidden until the tournament starts"
  - Next to each user's name, show "✓ Picks submitted" or "Waiting..." so members know who's ready

- **After tournament starts** (party status `locked` or `complete`):
  - All picks are revealed
  - Full leaderboard with scores visible

## Consequences
### Positive
- Preserves strategic element — no copying picks
- Users can still see who has/hasn't submitted picks
- Clean reveal moment when tournament starts

### Negative
- Users can't discuss/compare picks before the tournament (by design)
- No option for "public picks" parties (could be added as a toggle later)
