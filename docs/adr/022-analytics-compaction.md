# ADR 022: Analytics Compaction on Tournament Completion

## Status
Accepted

## Context
Each page view and click creates a new document in the `analytics` Firestore collection. Over time, this collection grows without bound. While the current user base of 15-20 friends generates only about 100 events per day, the dashboard fetches up to 500 documents per load. To keep the live collection small and costs low, analytics events should be cleaned up after a tournament ends.

## Decision
When a party transitions to `complete` status in `syncPartyStatus` (`src/lib/partySync.ts`), the app calls a `compactAnalytics` function in `src/lib/firestore.ts` using a fire-and-forget pattern.

`compactAnalytics` reads all events in the `analytics` collection that fall within the lifetime of the party, from `createdAt` through the current time. It aggregates those events into a single summary document at `analytics_compacted/{partyId}` containing:
- `totalEvents`
- `byPage`
- `byBrowser`
- `byUser` (including views and clicks per user)
- period start and end
- metadata: `partyName`, `tournamentId`, `tournamentName`

After writing the summary document, the function batch-deletes the original event documents in chunks of 500, which matches the Firestore batch write limit.

The compaction is intentionally executed with `.catch()` so it does not block the party status transition. A message queue was considered, but it was deemed unnecessary for the current scale of roughly 100 events per tournament.

## Consequences
- The live `analytics` collection stays small after each tournament, reducing future read costs.
- Historical analytics are preserved in compact form in `analytics_compacted`.
- If compaction fails, it is silently logged; the original event documents remain intact and can be retried later.
- The dashboard currently reads only from the live `analytics` collection; compacted historical data could be surfaced later in a tournament history view.
