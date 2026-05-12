# 🏌️ BirdieBets

**Pick your golfers. Track the tournament. Win the pot.**

🌐 **Live at [birdie-bets.vercel.app](https://birdie-bets.vercel.app/)**

BirdieBets is a golf tournament pool tracker where you and your friends each pick 6 PGA Tour players from skill-tiered groups, then watch the leaderboard update live as the tournament unfolds. The lowest combined score wins the pot.

![Next.js](https://img.shields.io/badge/Next.js_16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?logo=firebase&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-black?logo=vercel)

---

## How It Works

1. **Create a party** — pick a PGA Tour tournament and set a buy-in (€10/€20/€30)
2. **Invite friends** — share an invite link or send email invitations
3. **Pick 6 players** — 1 from each skill tier (A–D) + 2 wildcards
4. **Tournament starts** — picks lock, everyone's selections are revealed
5. **Watch the leaderboard** — scores auto-refresh every 5 minutes from live ESPN data
6. **Lowest score wins** — missed the cut? That's a +1 penalty 🔴

## Features

### 🎯 Smart Player Tiers
Players are grouped by the **Official World Golf Ranking** (updated live):
- **Group A** — Elite (World #1–6): Scheffler, McIlroy, etc.
- **Group B** — Contenders (#7–12)
- **Group C** — Rising Stars (#13–18)
- **Group D** — Dark Horses (#19–24)
- **Wildcards** — Any 2 players from #25–200

You pick 1 from each group + 2 wildcards. No stacking the world's best!

### 📊 Live Leaderboard
- Auto-refreshes every 5 minutes with visible countdown timer
- Missed cut players highlighted in **red** with 🔒 CUT badge and +1 penalty
- Your row highlighted in green
- Hidden picks until the tournament starts (no peeking!)

### 💰 Buy-in & Payouts
- Set a buy-in: **€10**, **€20**, or **€30**
- Optional **2nd place** payout (gets buy-in × 2)
- Optional **3rd place** payout (gets buy-in back)
- Winner banner with payout breakdown when tournament completes

### 🤝 Party System
- **Invite code** — 6-character code to share anywhere
- **Invite link** — one-click join URL
- **Email invites** — sends a branded email via Resend
- Invite more people anytime, even after the party is created

### 🔒 Fair Play
- Picks lock automatically when the tournament starts (synced with ESPN)
- Other players' picks are hidden until lock
- Stale page protection — saving picks re-checks tournament status server-side

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) + TypeScript |
| Styling | [Tailwind CSS](https://tailwindcss.com/) v4 |
| Auth & DB | [Firebase](https://firebase.google.com/) (Authentication + Firestore) |
| Golf Data | [ESPN Hidden API](docs/adr/001-golf-data-api.md) — live leaderboards, free & unlimited |
| Rankings | [OWGR API](https://www.owgr.com/) — Official World Golf Ranking for player tiers |
| Email | [Resend](https://resend.com/) — transactional invite emails |
| Hosting | [Vercel](https://vercel.com/) — free tier |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Firebase](https://console.firebase.google.com) project (Google Auth + Firestore enabled)
- A [Resend](https://resend.com) API key *(optional — for email invites)*

### Setup

```bash
# Clone the repo
git clone https://github.com/Ticketedmoon/birdie-bets.git
cd birdie-bets

# Install dependencies
npm install

# Copy env template and fill in your values
cp .env.local.example .env.local

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with Google.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | ✅ | Firebase project API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | ✅ | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ✅ | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | ✅ | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ✅ | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | ✅ | Firebase app ID |
| `RESEND_API_KEY` | Optional | Resend API key for email invites |
| `RESEND_FROM_EMAIL` | Optional | Custom from address (requires verified domain) |

### Deploy to Vercel

1. Push to GitHub
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Add the environment variables above
4. Deploy — done!

> **Important:** Add your Vercel deployment URL to Firebase → Authentication → Settings → Authorized domains.

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── invite/route.ts        # Email invite API (Resend)
│   │   └── rankings/route.ts      # OWGR proxy (avoids CORS)
│   ├── dashboard/page.tsx         # Party list (active + past)
│   ├── login/page.tsx             # Google sign-in
│   └── party/
│       ├── create/page.tsx        # Create party + tournament + buy-in
│       ├── join/page.tsx          # Join via invite code
│       └── [partyId]/
│           ├── page.tsx           # Leaderboard with live scores
│           └── picks/page.tsx     # Pick 6 players (groups + wildcards)
├── components/                    # Navbar, Providers, ProtectedRoute
├── contexts/AuthContext.tsx        # Firebase auth state
├── lib/
│   ├── espn.ts                    # ESPN + OWGR API integration
│   ├── firebase.ts                # Firebase config (lazy init, SSR-safe)
│   ├── firestore.ts               # Firestore CRUD operations
│   ├── partySync.ts               # Auto-lock parties when tournament starts
│   ├── payouts.ts                 # Payout calculator (1st/2nd/3rd)
│   └── playerGroups.ts            # Fallback player group config
├── types/index.ts                 # TypeScript interfaces
└── docs/adr/                      # Architecture Decision Records
```

## Architecture Decisions

All major design decisions are documented as ADRs:

| ADR | Decision |
|-----|----------|
| [001](docs/adr/001-golf-data-api.md) | ESPN Hidden API as primary data source |
| [002](docs/adr/002-tech-stack.md) | Next.js + Firebase + Tailwind stack |
| [003](docs/adr/003-authentication.md) | Google sign-in only |
| [004](docs/adr/004-player-groups.md) | OWGR-based player tiering system |
| [005](docs/adr/005-scoring-system.md) | Scoring rules and missed cut penalty |
| [006](docs/adr/006-party-system.md) | Party invite system (code + email) |
| [007](docs/adr/007-owgr-dynamic-groups.md) | Dynamic groups from live OWGR API |
| [008](docs/adr/008-email-invites.md) | Resend for transactional email invites |
| [009](docs/adr/009-auto-refresh-leaderboard.md) | Auto-refresh leaderboard every 5 minutes |
| [010](docs/adr/010-hidden-picks.md) | Hidden picks until tournament starts |
| [011](docs/adr/011-buy-in-payouts.md) | Buy-in and payout system (1st/2nd/3rd) |
| [012](docs/adr/012-tournament-auto-lock.md) | Auto-lock parties when tournament starts |
| [013](docs/adr/013-hosting-vercel.md) | Vercel serverless hosting |
| [014](docs/adr/014-player-id-matching.md) | Player ID matching — name-based fallback |

---

## License

This project is licensed under the [Apache License 2.0](LICENSE).
