# ADR-004: Player Group Tiering System

## Status
Accepted

## Date
2026-05-12

## Context
To keep the game competitive, users cannot simply pick the world's top 6 golfers. We need a tiering system that forces diverse picks. Users select 6 players total:
- 1 from each of 4 skill-tier groups (A, B, C, D)
- 2 "wildcard" picks from any player not in groups A–D

## Decision
Group players based on the **Official World Golf Ranking (OWGR)**, with 6 players per group:

| Group | OWGR Rank | Players (as of May 2026) |
|-------|-----------|--------------------------|
| A | 1–6 | Scheffler, McIlroy, Young, Fitzpatrick, Morikawa, Fleetwood |
| B | 7–12 | Rose, Spaun, Henley, Gotterup, Schauffele, MacIntyre |
| C | 13–18 | Straka, Griffin, Åberg, Thomas, Matsuyama, Noren |
| D | 19–24 | Bridgeman, Rahm, English, Kim, Bhatia, Reed |
| Wildcard | 25+ | Any player ranked 25 or below (pick 2) |

Groups should be **refreshable** from the OWGR API / ESPN world rankings data so they stay current as rankings change between tournaments.

## Consequences

### Positive
- Forces strategic thinking — can't just stack the best players
- 4 groups + 2 wildcards = good balance of structure and freedom
- Wildcards allow users to pick dark horses or personal favourites
- Rankings-based grouping is objective and transparent

### Negative
- Rankings change weekly — groups may shift between when picks are made and tournament starts
- 6 players per group may feel restrictive; some groups may have multiple fan favourites
- Players not in the PGA Tour (e.g., LIV Golf) may not appear in ESPN data

### Mitigations
- Snapshot groups at party creation time — once a party is created, groups are frozen for that tournament
- Display the group assignment clearly in the pick UI so users understand the constraints
