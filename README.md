# ⛳ Golf Tourney Player Bet Tracker

A web app for friends to compete by picking PGA Tour golfers and tracking their scores during tournaments. Create a party, pick 6 players from skill-tiered groups, and watch the leaderboard update live.

## Features

- **Google sign-in** via Firebase Authentication
- **Create & join parties** with invite codes or email invitations
- **Player groups from live OWGR** — Groups A–D (top 24) + 2 wildcard picks from rank 25–200
- **Live leaderboard** powered by ESPN's golf API (free, unlimited)
- **Missed cut penalty** — +1 to score, red highlighted cells with 🔒 CUT badge
- **Hidden picks** — other players' picks are hidden until the tournament starts
- **Email invitations** via Resend (3,000/month free)
- **Mobile responsive** — works on phones, tablets, and desktop
- **Tournament schedule** — browse upcoming PGA Tour events for the full season

## Tech Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** v4
- **Firebase** (Authentication + Firestore)
- **ESPN Hidden API** — live leaderboard data
- **OWGR API** — official world golf rankings for player grouping
- **Resend** — transactional email invites

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Google Auth + Firestore enabled
- A Resend API key (optional, for email invites)

### Setup

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Copy the environment template and fill in your values:
   ```bash
   cp .env.local.example .env.local
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Architecture Decisions

See [`docs/adr/`](docs/adr/) for all design decisions:

| ADR | Topic |
|-----|-------|
| [001](docs/adr/001-golf-data-api.md) | ESPN Hidden API as primary data source |
| [002](docs/adr/002-tech-stack.md) | Next.js + Firebase + Tailwind stack |
| [003](docs/adr/003-authentication.md) | Google sign-in only |
| [004](docs/adr/004-player-groups.md) | OWGR-based player tiering system |
| [005](docs/adr/005-scoring-system.md) | Scoring rules and missed cut penalty |
| [006](docs/adr/006-party-system.md) | Party invite system (code + email) |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── invite/route.ts       # Email invite API (Resend)
│   │   └── rankings/route.ts     # OWGR proxy (avoids CORS)
│   ├── dashboard/page.tsx        # Party list (active + past)
│   ├── login/page.tsx            # Google sign-in
│   └── party/
│       ├── create/page.tsx       # Create party + select tournament
│       ├── join/page.tsx         # Join via invite code
│       └── [partyId]/
│           ├── page.tsx          # Leaderboard with live scores
│           └── picks/page.tsx    # Pick 6 players (groups + wildcards)
├── components/                   # Navbar, Providers, ProtectedRoute
├── contexts/AuthContext.tsx       # Firebase auth state
├── lib/
│   ├── espn.ts                   # ESPN + OWGR API integration
│   ├── firebase.ts               # Firebase config (lazy init)
│   ├── firestore.ts              # Firestore CRUD operations
│   └── playerGroups.ts           # Fallback player group config
└── types/index.ts                # TypeScript interfaces
```

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
