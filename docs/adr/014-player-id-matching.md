# ADR-014: Player ID Matching — Name-Based Fallback

## Status
Accepted

## Date
2026-05-12

## Context
Player picks are stored with IDs from the **OWGR API** (e.g. `owgr_18417` for Scottie Scheffler), but the leaderboard data comes from the **ESPN API** which uses its own IDs (e.g. `9478` for Scheffler). These IDs are completely different and cannot be mapped automatically.

This means when calculating leaderboard scores, looking up a pick by player ID against ESPN data returns no match — scores show as "-" for all players.

## Decision
Implement a **dual-lookup strategy** when matching picks to leaderboard scores:

1. **Primary**: Look up by player ID (works when both systems use the same ID, e.g. if picks were made from ESPN data)
2. **Fallback**: Look up by **normalized player name** (case-insensitive exact match)

```typescript
const findScore = (playerId: string, playerName: string): PlayerScore | undefined => {
  return scoreByIdMap.get(playerId) || scoreByNameMap.get(playerName.toLowerCase());
};
```

Both maps are built once per leaderboard refresh from the ESPN data.

## Consequences

### Positive
- Works regardless of which ID system the picks use (OWGR or ESPN)
- Player names are consistent across both APIs (both use full official names)
- Zero additional API calls — just a second Map lookup

### Negative
- Name matching could fail if APIs use slightly different name formats (e.g. "Ludvig Åberg" vs "Ludvig Aberg")
- If two players share the same name (extremely unlikely in pro golf), the wrong one could match
- Does not handle name changes (e.g. marriage)

### Future Improvement
- Build a persistent OWGR→ESPN ID mapping table by cross-referencing names once, then use IDs for all subsequent lookups
