# ADR-008: Resend for Transactional Email Invites

## Status
Accepted

## Date
2026-05-12

## Context
Users need to invite friends to their party. While invite codes and shareable links work, email invites provide a more direct notification. We needed an email service that is:
- Free or very cheap
- Simple to integrate with Next.js API routes
- Reliable deliverability

## Decision
Use **Resend** for transactional email invites.

- **Free tier**: 3,000 emails/month
- **Integration**: `resend` npm package, called from `/api/invite` server-side route
- **Domain verification**: Required for sending to arbitrary recipients (DNS records: DKIM TXT, SPF MX + TXT, DMARC TXT)
- **From address**: `Golf Tourney Tracker <invites@skybreak.app>` (custom verified domain)
- **Fallback**: If email fails, party creation still succeeds — invite code always works
- **Email content**: Branded HTML email with party name, inviter name, join button, and invite code

## Consequences
### Positive
- Professional branded emails from a custom domain
- Non-blocking — email failure doesn't break party creation
- 3,000 emails/month is more than sufficient

### Negative
- Requires DNS domain verification setup (DKIM, SPF, DMARC records)
- Resend free tier limited to one sending domain
- Email is a secondary invite method — link sharing is primary and more reliable
