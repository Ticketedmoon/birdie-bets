# ADR-001: Golf Data API Selection

## Status
Accepted

## Date
2026-05-12

## Context
We need a golf data API that provides:
- Live tournament leaderboards with score-to-par data
- Missed cut (STATUS_CUT) detection for penalty scoring
- Player info (names, headshots, country flags)
- Tournament schedules
- Round-by-round scoring

We evaluated several options:

| API | Free Tier | Auth Required | Rate Limit |
|-----|-----------|---------------|------------|
| ESPN Hidden API | Unlimited | None | None (unofficial) |
| Slash Golf (RapidAPI) | 250 calls/month | API key | Hard limit |
| SportsData.io | 1,000 calls/month | API key | Hard limit |
| Data Sports Group | Trial only | API key | Commercial pricing |
| Sportbex Golf API | Trial only | API key | Commercial pricing |

## Decision
Use the **ESPN Hidden API** as the primary data source.

**Base URL**: `https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard`

Key query patterns:
- All events: `GET /leaderboard` (returns current/recent tournaments)
- Specific event: `GET /leaderboard?event={eventId}`

The API returns rich data including:
- `competitor.status.type.name` — `STATUS_FINISH`, `STATUS_CUT`, etc.
- `competitor.statistics[].name === "scoreToPar"` — numeric score to par
- `competitor.athlete` — displayName, headshot, country flag
- `competitor.linescores[]` — round-by-round scores

## Consequences

### Positive
- **No API key or signup required** — zero friction for development and deployment
- **No rate limits** — can refresh leaderboards frequently during live tournaments
- **Rich data** — headshots, flags, round scores, cut status all included
- **Proven stability** — widely used by hobby/open-source projects for years

### Negative
- **Unofficial/undocumented** — ESPN could change or remove endpoints at any time
- **No SLA or support** — if it breaks, we fix it ourselves
- **PGA Tour focus** — may not cover LIV Golf or other tours

### Mitigations
- Cache all API responses in Firestore to reduce dependency on live calls
- Design the API service layer with an interface so we can swap to a paid API (e.g., Slash Golf on RapidAPI) as a fallback with minimal code changes
- Monitor for breaking changes by checking response structure on each call
