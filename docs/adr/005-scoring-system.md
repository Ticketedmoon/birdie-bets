# ADR-005: Scoring System and Missed Cut Penalty

## Status
Accepted

## Date
2026-05-12

## Context
We need a scoring system that:
- Aggregates the performance of each user's 6 picked players
- Uses standard golf scoring (lowest score wins, under par is best)
- Penalises users for picking players who miss the cut

## Decision

### Scoring
- Each user's total score = sum of their 6 players' **score-to-par** values
- Lowest total wins (standard golf convention)
- Data source: `competitor.statistics[].name === "scoreToPar"` from ESPN API

### Missed Cut Penalty
- If a player's status is `STATUS_CUT`: add **+1** to their score-to-par (one bogey penalty)
- If a player withdraws (`STATUS_WD`): treat the same as a missed cut (+1 penalty)
- If a player is disqualified (`STATUS_DQ`): treat the same as a missed cut (+1 penalty)

### UI Treatment for Cut Players
- Cell background turns **red** (`bg-red-100` / `bg-red-200`)
- Display a **"CUT"** badge next to the player name
- Show the penalised score with annotation, e.g., "+4 (+1)" where +1 is the penalty
- Tooltip explaining: "Missed Cut — +1 penalty applied"

### Pick Locking
- Picks are locked once the tournament's first round starts (based on `event.date` from ESPN API)
- Locked picks cannot be changed; the UI shows a lock icon and disables the pick form

## Consequences

### Positive
- Simple, easy-to-understand scoring
- +1 penalty is meaningful but not devastating — encourages bold picks without extreme punishment
- Clear visual feedback (red cells) makes cut status immediately obvious
- Lock timing tied to actual tournament start prevents mid-tournament gaming

### Negative
- +1 penalty is relatively mild — a cut player's score might still be better than a player who made the cut but scored poorly
- WD/DQ treatment as same as cut may not feel fair in all cases

### Alternatives Considered
- **+5 penalty**: Too harsh; discourages picking anyone outside top 10
- **Use cut-line score**: More accurate but complex to calculate and explain
- **No penalty**: Removes strategic risk element from the game
