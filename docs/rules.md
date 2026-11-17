# Remorse Chess rules v1

Each piece rolls once on its first capture. Promotion preserves its identity, roll and capture count.

| Roll | Condition | Effect |
| --- | --- | --- |
| 1 | Devastated | Immobilized until absolved. Disappears at the end of its owner's third subsequent turn if untreated. |
| 2–3 | Guilt-ridden | Can move without capturing until absolved. |
| 4–5 | Unaffected | Moves and captures normally. |
| 6 | Psychopath | When it captures on the first action of a turn it may move once more with that same piece. |

A friendly bishop already on one of the eight surrounding squares can spend a turn absolving one devastated or guilt-ridden piece. A devastated or bloodlust bishop cannot absolve. A bishop cannot absolve itself. Absolution preserves the original roll so that the piece never rolls a second time.

On its third capture, a psychopath immediately gains bloodlust. Bloodlust permits only captures but permits capturing friendly pieces. The same capture geometry applies. A bloodlust pawn still captures diagonally. Friendly captures count as captures. No king can be captured. A bonus move is optional, uses the same clock, and never grants a third action. If the piece has no legal bonus move the turn ends automatically.

Kings must always remain separated by at least one square. Devastated and guilt-ridden non-king pieces do not give check. The king's own restrictions also apply to its movements. Each action must leave its own king safe before automatic effects. The final turn position is evaluated for checkmate and stalemate after automatic removals. If a devastated king disappears, or a compulsory end-of-turn removal exposes its own king, the acting player loses.

Castling uses normal rights and safety, and requires both pieces to be able to make a noncapture. An en passant target stays valid for the next opposing turn as long as the double-stepping pawn remains on its square. Promotion choice is part of the move. Threefold repetition checks effective castling/en passant rights, the side on move, and all changeable piece conditions that affect legality or later dice rolls. The 50-move rule counts full turns and resets on pawn moves, captures, absolution and automatic removals.

Bare kings draw if neither is devastated. In other positions a flag fall is a loss unless the clock is untimed. Increment applies once per completed turn, including an absolution turn, and never between a capture and its bonus move.

Rating pools use base seconds plus 40 times increment seconds. Bullet is under three minutes, Blitz is three through just under ten minutes, and Rapid starts at ten minutes.
