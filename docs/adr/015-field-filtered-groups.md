# ADR-015: Tournament Field-Filtered Player Groups

## Status
Accepted

## Date
2026-05-12

## Context
Players were being shown in the pick selection UI even if they weren't playing in the chosen tournament. For example, Scottie Scheffler would appear in Group A for the Truist Championship even though he didn't enter that event. This led to picks that could never score.

Additionally, the OWGR top 24 might not all be playing the same event — some skip certain tournaments. Showing absent players wastes pick slots and confuses users.

## Decision
Filter the OWGR top 200 against the **ESPN tournament field** before building groups.

### How It Works
1. The `/api/rankings` endpoint accepts an optional `?eventId=` parameter
2. If provided, it fetches the tournament's competitor list from ESPN
3. The OWGR top 200 is filtered to only include players **in the field**
4. Groups are re-built from the filtered list:
   - Group A = highest 6 ranked players **in the field**
   - Group B = next 6
   - Group C = next 6
   - Group D = next 6
   - Wildcards = remaining ranked players in the field
5. If the field is not yet available (ESPN populates it 1–2 days before), all 200 OWGR players are shown with a warning

### UI Indicators
- ✅ "Groups filtered to confirmed tournament field" — when field is available
- ⏳ "Field not yet announced — showing all ranked players" — when field is pending

### Caching
- Results cached per tournament ID for 30 minutes (server-side)
- Different tournaments get separate cache entries

## Consequences

### Positive
- Users only see players who are actually competing
- Groups are more meaningful — Group A is truly the best players in *this* tournament
- No more picks that can never score
- Works for any tournament, past or future

### Negative
- Groups may have fewer than 6 players if fewer than 24 ranked players enter a small event
- Groups shift depending on who enters — the same player could be Group A in one tournament and Group B in another
- Field not available until 1-2 days before the event
