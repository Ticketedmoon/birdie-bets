# ADR-016: Custom Player Group Assignment by Party Creator

## Status
Accepted

## Date
2026-05-12

## Context
The OWGR-based auto-grouping assigns players to Groups A–D based on world ranking. However, party creators may want to customise these groups — for example, moving a player they consider underrated into a higher group, or adjusting groups to match their friend group's knowledge of golf.

## Decision
Allow the party creator to **optionally customise player groups** during party creation.

### Flow
1. Creator selects a tournament
2. An optional "⚙️ Customise Player Groups" button appears
3. Clicking it loads the OWGR-suggested groups (filtered by tournament field if available)
4. Creator can click any player → choose which group to move them to (A/B/C/D/Wildcard)
5. Click "✓ Confirm Groups" to save
6. Custom groups are stored in Firestore on the `party.customGroups` field
7. All party members see the creator's custom groups when picking players

### Data Model
```typescript
party.customGroups?: {
  A: { id: string; displayName: string }[];
  B: { id: string; displayName: string }[];
  C: { id: string; displayName: string }[];
  D: { id: string; displayName: string }[];
}
```

### UI — Click-to-Move (not drag-and-drop)
- Groups displayed as coloured cards (A=red, B=blue, C=yellow, D=purple)
- Click a player → a toolbar appears with "Move to Group A/B/C/D/Wildcard" buttons
- Wildcard pool shown below with search
- Simple, fast, mobile-friendly

### Picks Page Behaviour
- `party.customGroups` is **always** populated at creation time (either manually customised or auto-snapshotted from OWGR — see ADR-017)
- `party.snapshotWildcards` freezes the wildcard pool at creation time (ADR-017)
- Groups and wildcards do not change after party creation, regardless of OWGR ranking updates
- Legacy parties without `customGroups` fall back to live OWGR-based auto-groups

## Consequences

### Positive
- Creator has full control over competitive balance
- Simple click-to-move UI works on desktop and mobile
- Optional — can skip and use OWGR defaults
- Custom groups persist with the party in Firestore
- Groups are always frozen at creation (ADR-017), preventing drift from ranking changes

### Negative
- Creator could make unfair groups (by design — it's their party)
- Groups are set at creation time and can't be changed later (could add editing later)
- If the tournament field isn't confirmed at creation time, some players in the snapshot may not actually enter — handled by the validation gate (ADR-018)
