# ADR-013: Vercel Serverless Hosting

## Status
Accepted

## Date
2026-05-12

## Context
The app needs to be hosted on a platform that is:
- Free or very low cost for a hobby project
- Zero-ops (no server management, scaling, or restarts)
- Fast globally
- Natively supports Next.js
- Auto-deploys from GitHub

## Decision
Host on **Vercel** (free Hobby tier).

- **URL**: [birdie-bets.vercel.app](https://birdie-bets.vercel.app/)
- **Auto-deploy**: Every push to `main` triggers a production deploy
- **Environment variables**: Configured in Vercel dashboard (Firebase config, Resend API key)
- **Firebase authorised domain**: `birdie-bets.vercel.app` added to Firebase Auth settings

### Why Vercel
- Built by the creators of Next.js — first-class support
- **Serverless architecture**: Static pages served from global CDN, API routes run as serverless functions on-demand
- No pods, containers, or VMs to manage
- Auto-scaling from 0 to thousands of users
- Instant rollback if a deploy breaks
- Preview deployments for every PR

### Free Tier Limits
| Resource | Limit |
|----------|-------|
| Bandwidth | 100 GB/month |
| Serverless function timeout | 10 seconds |
| Builds | 1,000/month |
| Team members | 1 (Hobby) |

All limits are well within the needs of this app.

## Consequences
### Positive
- Zero ops — push code, it's live
- Global edge network — fast for users anywhere
- Free for hobby/personal use
- Preview deploys for testing changes before merging

### Negative
- Vendor lock-in to Vercel's serverless model (mitigated: standard Next.js, can move to any Node.js host)
- 10-second function timeout may be tight if ESPN API is slow (unlikely)
- Hobby tier limited to 1 team member (upgrade to Pro at $20/month if needed)

## Alternatives Considered
- **DigitalOcean App Platform**: More control but requires container management, not free
- **Netlify**: Good but Next.js support is less mature than Vercel
- **Self-hosted on a VPS**: Maximum control but significant ops burden for a hobby project
