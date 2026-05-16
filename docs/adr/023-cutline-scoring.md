# ADR-023: Cut Line Scoring — Cap Cut Players at CutLine + 1

## Status
Accepted

## Date
2026-05-16

## Context
ADR-005 introduced a flat +1 penalty for players who miss the cut, are withdrawn, or are disqualified.
In practice this produced misleading scores: a player who missed the cut at +7 would display as +8,
even though the actual cut line was +4. This made cut players appear far worse than they should,
distorting the leaderboard and making the penalty feel arbitrary rather than standardised.

The ESPN API exposes `tournament.cutScore` on the leaderboard endpoint, giving us the official
cut line value without any need for derivation or guesswork.

## Decision

### Cut players (status = `cut`)
- When `tournament.cutScore` is available from the ESPN API, a cut player's effective score is
  **cutLine + 1**, regardless of their actual score-to-par.
- Example: if the cut line is +4, every cut player scores +5.
- When the cut line is not yet available (pre-cut or missing from the API), fall back to the
  existing ADR-005 behaviour (actual score + 1).

### WD / DQ players
- Unchanged from ADR-005: flat +1 penalty on their actual score-to-par.
- Rationale: withdrawals and disqualifications happen at arbitrary points in the tournament and
  are not related to the cut line.

### Data flow
1. `fetchLeaderboard()` now returns a `LeaderboardResult` object containing `scores`, `cutLine`
   (from `event.tournament.cutScore`), and `cutRound` (from `event.tournament.cutRound`).
2. `calculateEffectiveScore()` accepts an optional `cutLine` parameter and applies the cap when
   the player status is `cut` and the cut line is available.
3. `buildLeaderboardEntries()` accepts the `cutLine` and threads it through to the score
   calculation.

### No-cut tournaments
Some PGA Tour events have no cut (e.g., The Sentry, AT&T Pebble Beach). The ESPN API signals
this with `tournament.cutRound === 0`. When this is the case, the UI shows a
"No cut this tournament" badge and no cut penalty is applied.

### UI treatment
- Cut players continue to show the red background and "CUT" badge (unchanged from ADR-005).
- The displayed score reflects the capped value (cutLine + 1).
- After the cut has been made (round 3+), a badge shows the cut line and the capped score,
  e.g., "✂️ Cut line: +4 (cut players score +5)".
- For no-cut tournaments, a "No cut this tournament" badge is shown instead.

## Consequences

### Positive
- All cut players receive a uniform, fair penalty based on the official cut line.
- Eliminates the confusing situation where a cut player at +10 showed a higher score than a
  player who made the cut but played poorly on the weekend.
- Uses a reliable, API-provided value rather than deriving the cut line from player data.

### Negative
- Adds a dependency on ESPN providing `tournament.cutScore`. If the field is absent,
  we fall back to the ADR-005 flat +1 penalty, which is a safe degradation.

### Supersedes
- ADR-005 (cut penalty section only). The rest of ADR-005 (scoring formula, pick locking,
  WD/DQ treatment) remains in effect.
