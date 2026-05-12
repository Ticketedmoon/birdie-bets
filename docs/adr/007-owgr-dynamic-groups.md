# ADR-007: Dynamic Player Groups from Live OWGR API

## Status
Accepted

## Date
2026-05-12

## Context
The initial implementation used hardcoded player groups based on a snapshot of the OWGR. Rankings shift weekly, so groups would become stale. We also needed a wildcard player list for future tournaments where ESPN has no competitor data yet.

The OWGR public API (`apiweb.owgr.com`) returns the top 200 players but has **no CORS headers**, so it cannot be called directly from the browser.

## Decision
- Fetch the top 200 players dynamically from the **OWGR API**
- Proxy the request through a **Next.js API route** (`/api/rankings`) to bypass CORS
- Cache results server-side for **1 hour** to avoid hammering the API
- Groups A–D are sliced from the rankings (1–6, 7–12, 13–18, 19–24)
- Wildcards are ranks 25–200
- The hardcoded `playerGroups.ts` is kept as a **fallback** if the OWGR API is unreachable

## Consequences
### Positive
- Groups always reflect the latest world rankings
- 200 wildcard options available even for future tournaments
- Server-side caching minimises API calls

### Negative
- OWGR API is unofficial and could change
- Groups may shift between when a user views the picks page and when they submit
