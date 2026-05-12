# ADR-011: Buy-In and Payout System

## Status
Accepted

## Date
2026-05-12

## Context
The app is designed for friendly competition with real stakes. Users wanted to set a buy-in amount and see clear payout breakdowns, including optional payouts for 2nd and 3rd place.

## Decision
### Buy-In
- Party creator selects a buy-in: **€10**, **€20**, or **€30** (toggle buttons)
- Currency is EUR (hardcoded for MVP)
- Total pot = buy-in × number of party members

### Payout Structure
- **1st place**: Gets the remainder of the pot after other payouts
- **2nd place** (optional toggle): Gets buy-in × 2 (their money back + one other person's)
- **3rd place** (optional toggle, requires 2nd enabled): Gets their buy-in back

### Payout Calculator
- Shared `lib/payouts.ts` module used by both the create form and leaderboard
- Create party form shows a **live preview** with a 5-player example
- Party page header shows payout badges: `💰 €20 buy-in · 🏆 1st: €60 · 🥈 2nd: €40 · 🥉 3rd: €20`

### Winner Banner
- When tournament completes, a prominent gradient banner shows:
  - 🥇 Winner name, score, and payout amount
  - 🥈 2nd place (if enabled)
  - 🥉 3rd place (if enabled)

### Leaderboard
- Rank column shows 🏆/🥈/🥉 icons for podium positions
- Payout badges shown next to each winner's name (only after picks are revealed)

## Consequences
### Positive
- Clear, upfront payout structure before joining
- Live preview prevents confusion about payout math
- Winner banner creates a satisfying conclusion to the tournament

### Negative
- No actual money transfer — payouts are informational/honour-system
- Fixed buy-in options (€10/20/30) — no custom amounts
- EUR only — no currency selection
