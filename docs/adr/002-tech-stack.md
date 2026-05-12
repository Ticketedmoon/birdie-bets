# ADR-002: Tech Stack Selection

## Status
Accepted

## Date
2026-05-12

## Context
We need a web application stack that supports:
- Server-side rendering for SEO and fast initial load
- Real-time data updates (leaderboard refresh)
- User authentication (Google sign-in)
- Database for parties, picks, and cached API data
- Free or low-cost hosting for a hobby project

## Decision
- **Framework**: Next.js 14 (App Router) — SSR, API routes, modern React
- **Styling**: Tailwind CSS — utility-first, fast prototyping
- **Auth + Database**: Firebase (Authentication + Firestore)
- **Hosting**: Vercel (free tier)

## Consequences

### Positive
- Next.js App Router provides server components, API routes, and SSR out of the box
- Firebase free tier (Spark plan) covers our needs: 50K reads/day, 20K writes/day, 1 GiB storage
- Firebase Auth handles Google sign-in with minimal code
- Vercel has first-class Next.js support and a generous free tier
- Tailwind enables rapid UI development without custom CSS

### Negative
- Firebase vendor lock-in (Firestore is not a standard SQL database)
- Vercel free tier has limits on serverless function execution time (10s) and bandwidth (100 GB/month)
- Firestore's query model is more limited than SQL (no JOINs, limited aggregations)

### Alternatives Considered
- **React (Vite) + Firebase**: No SSR, worse initial load, no built-in API routes
- **Vue + Firebase**: Smaller ecosystem, less community support for Firebase integration
- **Supabase (PostgreSQL)**: More powerful queries but more complex setup; Firebase is simpler for auth + real-time
