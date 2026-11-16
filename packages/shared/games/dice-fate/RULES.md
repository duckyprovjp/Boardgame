# Xúc Xắc Định Mệnh — Rules & Confirmed Defaults (A1–A11)

- **Players**: 3–8 players.
- **Deck**: 50 function cards (25 Green, 25 Red). Each player is dealt 1 face-down card at setup; unused cards are removed (no draw pile).
- **Lethal faces**: Determined by `aliveCount` via `rules.json` (`>=6: [1]`, `5: [1,6]`, `4: [1,5,6]`, `3: [1,4,5,6]`, `2: [1,3,5]`).
- **A1 (Modifier Priority)**: Base table first → REPLACE effects (`rule_lock`, `odds_shift`, last activated wins) → ADD effects (`hazard_boost`) on top.
- **A2 & A3 (Nullify)**: Playable in any reaction window; destroys target's hidden card with no effect (no-op if target has no card).
- **A4 (Forced Reroll)**: Playable only on another player's roll, once per roll; second roll is binding.
- **A5 (Counter Detonator)**: Triggers in `ON_RECEIVE_DIE` on any pass; the passer enters `ON_ELIMINATED_WINDOW` before elimination.
- **A6 (Triple Verdict)**: Playable in `START_OF_TURN_WINDOW` when `aliveCount === 3`. If the current die holder explodes, they choose next holder; otherwise current holder keeps the die.
- **A7 (Chain Reaction)**: Victim does not get their own `ON_ELIMINATED_WINDOW`. Original exploder is eliminated first, then victim.
- **A8 (Blast Shield)**: Cancels only own lethal-roll explosion and resolves as safe pass (if `dieValue === 1`, passes to adjacent player in chosen direction).
- **A9 (Secret Swap)**: True exchange — player takes target's card and target receives the played Secret Swap card face-down (unusable until their next valid window).
- **A10 (Evade & Hot Potato)**: Skip `ROLL_DIE` and `AFTER_ROLL_WINDOW`; receiver still gets `ON_RECEIVE_DIE_WINDOW`.
- **A11**: Cards cannot be played during `CHOOSE_DIRECTION` or `CHOOSE_NEXT_HOLDER`.
