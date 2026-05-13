# ADR-017: Freeze Player Groups & Wildcards at Party Creation

## Status
Accepted

## Date
2026-05-13

## Context
Player groups (A–D) and wildcards are derived from live OWGR rankings. When a party was created without custom groups, the picks page fetched fresh rankings on every load. Even parties **with** custom groups still fetched wildcards dynamically.

This caused a bug where players shifted between groups and wildcards as OWGR rankings changed after party creation. For example, a player selected as a wildcard could later appear in Group D because their ranking improved, making them uneditable in the wildcard section.

**Reported issue:** "Kristoffer Reitan" was selected as a wildcard but moved to Group D after an OWGR ranking update.

## Decision
**Always snapshot both groups and wildcards at party creation time.** Once a party is created, player groupings are frozen and will not change regardless of future OWGR ranking updates.

### Changes

1. **New field on `Party` type:**
   ```typescript
   snapshotWildcards?: { id: string; displayName: string }[];
   ```

2. **Party creation (`create/page.tsx`):**
   - If the user customised groups → save those + compute and freeze wildcards
   - If the user did **not** customise → fetch current OWGR groups, save them as `customGroups`, and freeze wildcards as `snapshotWildcards`
   - Both paths now always populate `customGroups` and `snapshotWildcards`

3. **Picks page (`picks/page.tsx`):**
   - If `snapshotWildcards` exists → use the frozen wildcard list (no API call needed)
   - If not (legacy parties) → fall back to dynamic OWGR fetch (backward compatible)

4. **Reset All Picks button:**
   - Added a "Reset All" button to the picks page header (visible only when picks are unlocked)
   - Clears all 6 selections and the wildcard search field
   - Mobile-friendly: compact on small screens, scales up on `sm:`

### Backward Compatibility
Legacy parties created before this change may not have `customGroups` or `snapshotWildcards`. The picks page gracefully falls back to dynamic OWGR fetching for these parties.

## Consequences

### Positive
- Players no longer shift between groups/wildcards after party creation
- Picks page loads faster for new parties (no OWGR API call needed)
- Fair — all party members see the same groups that existed when the party was created
- Backward compatible with existing parties

### Negative
- Firestore documents are slightly larger (wildcard list can be 100+ entries)
- If the tournament field changes after party creation (e.g., late withdrawals), the snapshot won't reflect that — acceptable trade-off for stability
