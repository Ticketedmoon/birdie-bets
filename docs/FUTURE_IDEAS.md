# 🏌️ BirdieBets — Future Improvement Ideas

A brainstorm of features and technical improvements to consider for future development.

---

## 🎮 Gameplay & Features

### Push Notifications / Live Alerts
- Notify users when a picked player makes a birdie/eagle, gets cut, or takes the lead
- Could use Firebase Cloud Messaging (FCM) or web push notifications
- "Your player Rory McIlroy just eagled hole 15! 🦅"

### Historical Stats & Season Leaderboard
- Track results across multiple tournaments per season
- Show win/loss record, total earnings, and all-time stats per user
- "Season 2025: 3 wins, 2 podiums, €240 earned"

### Tiebreaker System
- Currently unclear what happens when two players tie on score
- Options: head-to-head record, total birdies, last-round score, or manual owner decision

### Draft Mode (Live Pick Order)
- Snake draft: members take turns picking players in real-time
- Adds a social/competitive element to the picking phase
- Would need WebSocket or Firestore real-time listeners

### Trade / Swap Window
- Allow a brief window (e.g. before Round 2) to swap one pick
- Adds strategy — do you drop a player who had a bad R1?

### Side Bets / Prop Bets
- "Which group will have the lowest combined score?"
- "Will any picked player finish top 5?"
- "Hole-in-one bonus: -3 if any of your picks makes one"

### Multi-Tournament Series
- Link multiple tournaments into a series (e.g. "The Majors 2025")
- Cumulative scoring across all four majors
- Season-long party that tracks points across events

---

## 💰 Payments & Money

### Integrated Payments
- Stripe or Revolut integration for buy-in collection and payout distribution
- Removes the "who owes who" friction after a tournament
- Escrow model: money held until tournament completes

### Flexible Payout Structures
- Custom payout splits (e.g. 60/25/15 or top-half gets money back)
- "Last place pays double" punishment mode 😈

---

## 📱 UX / UI Improvements

### Progressive Web App (PWA)
- Add service worker + manifest for installable mobile experience
- Offline support for viewing last-known leaderboard state

### Dark Mode
- Tailwind dark mode support — many users browse at night during tournaments

### Animated Score Updates
- Subtle animations when scores change on auto-refresh
- Highlight cells that changed since last refresh (green flash for improvement, red for worse)

### Share Results Card
- Generate a shareable image/card with final standings
- "Share to WhatsApp/Twitter" after tournament completes
- Good for driving organic growth

### Accessibility Audit
- Ensure WCAG 2.1 AA compliance
- Screen reader support for leaderboard tables
- Keyboard navigation for pick selection

---

## 🔒 Security & Reliability

### Firebase Admin SDK for API Auth
- Current API routes trust client-provided UIDs
- Adding `firebase-admin` would allow server-side ID token verification
- Priority for any route that modifies data (picks, unlocks, invites)

### Firestore Security Rules
- Currently no Firestore security rules — all reads/writes are client-gated
- Add rules to enforce: only party members can read party data, only the owner can modify party settings, users can only write their own picks

### Rate Limiting
- Add rate limiting to email-sending API routes (send-pick-unlock, invite, notify-invalid-picks)
- Prevents abuse of Resend API quota
- Could use Vercel Edge Config or simple in-memory/Redis rate limiter

---

## 🧪 Testing & Quality

### Expand Test Coverage
- Add tests for `calculatePayouts` (pure function, easy to test)
- Add tests for `pickValidation.ts` (name normalisation edge cases)
- Add tests for `partySync.ts` status transitions
- Integration tests with Firebase emulator for Firestore operations

### E2E Tests
- Playwright or Cypress for critical user flows:
  - Create party → invite → pick → lock → leaderboard
  - Unlock email flow end-to-end
- Run in CI on PRs

### CI/CD Pipeline
- GitHub Actions: lint + type-check + test on every PR
- Vercel preview deployments already work, but adding test gates would increase confidence

---

## 🏗️ Technical Debt

### Extract Shared API Helpers
- `getResend()` is duplicated across 3 API routes
- Create `src/lib/resend.ts` with shared initialisation and email templates

### Consolidate Email Templates
- Move HTML email templates to shared components/functions
- Ensure consistent branding and HTML escaping across all emails

### Firestore Batch Reads
- `getUsersInfo` fetches users one-by-one in a loop
- Could batch with Firestore `getAll()` or `in` queries (max 30 per batch)

### Environment Variable Validation
- Add startup validation for required env vars (Firebase config, Resend key, etc.)
- Fail fast with clear error messages instead of runtime crashes
