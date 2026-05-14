# ADR 021: Client-Side Analytics Dashboard

## Status
Accepted

## Context
The app needed analytics to track page views, click events, and user activity. An initial server-side API route approach (`/api/analytics`) used the Firebase client SDK on Node.js, which caused gRPC connection failures. The Firebase client SDK uses gRPC on the server side, which does not work reliably in serverless environments like Vercel. As a result, analytics events were silently dropped and no data was persisted.

## Decision
Analytics writes were moved to the client-side Firebase SDK in `usePageView` and `useTrackClick` hooks (`src/lib/usePageView.ts`). Events are now written directly from the browser to the `analytics` Firestore collection, where the Firebase SDK uses REST/WebSocket transports that work reliably in this environment.

Each analytics event stores:
- `type` (`page_view` or `click`)
- `page`
- `action`
- `uid`
- `email`
- `browser` (parsed from `navigator.userAgent`)
- `timestamp`

On each page view, the app also upserts an `analytics_last_visit/{uid}` document to track the user's most recent visit time.

The analytics dashboard in `src/app/analytics/page.tsx` reads directly from Firestore client-side and is gated by `NEXT_PUBLIC_ANALYTICS_ADMIN_EMAIL`. To reduce read volume, dashboard results are cached in `sessionStorage` with a 10-minute TTL, and a manual **Refresh** button bypasses the cache.

The dashboard provides:
- total events
- unique users
- page views
- clicks
- visit frequency for the last hour, day, and week
- per-user breakdowns with frequency
- user × page breakdown
- last active users

The broken server-side API route was removed entirely.

## Consequences
- Analytics writes now reliably persist to Firestore.
- No server-side infrastructure is needed for analytics.
- Country detection from Vercel headers (`x-vercel-ip-country`) is no longer available because writes happen client-side.
- Admin access control moved from a server-side environment variable check to a client-side check using `NEXT_PUBLIC_ANALYTICS_ADMIN_EMAIL`; Firestore security rules should be configured for production hardening.
- `sessionStorage` caching keeps Firestore read costs minimal.
