# Ruleset — Dual-Sided RPS Trick-Taker (build spec)

Canonical rules for the current redesign. This supersedes the exploratory
`dual-sided-cards-design.md` (kept only for reasoning history). Target: implement
against the existing `src/lib/gameLogic.ts`, which already has the trick engine,
12 edge card-slots, and a 3×3 die grid.

## STATUS: implemented (v1). Items below were resolved as noted; flag any you want changed.

1. **Final aggregation.** Implemented as **`score = min(R, G, B)`** per player (both
   die-difference points and poker points feed the same three colour pools).
2. **Deck size.** Implemented as **18 unique dual-sided combos × 2 copies = 36 cards**
   (Skewed-Overlap mapping, `SKEW_PAIRS` in gameLogic.ts).
3. **3-card poker ranking** — implemented per the draft table below (straight flush >
   trips > straight > flush > pair > high; RPS breaks suit ties on the high card).
   Ties with equal category+ranks+RPS score for neither player. Revisit if desired.
4. **Deadlock** — FIXED via escape-valve placement (see Placement legality). Verified
   500/500 games finish with random play.

Not yet runtime-playtested in the browser; engine verified via headless simulation.

## Components

- **Colors / suits:** Red, Green, Blue.
- **RPS cycle:** **R ▸ G ▸ B ▸ R** (R beats G, G beats B, B beats R). No global
  strongest suit. Used for: trick tie-breaks AND poker suit tie-breaks.
- **Cards:** dual-sided. Each card shows two (color, rank) faces from two different
  colors. Orientation chosen at play time locks which face is "up" (active).
  - 3 color pairings (R/G, G/B, B/R), 6 cards each = **18 unique combos**.
  - In each pairing the RPS-winning color is the "strong" suit and skews high.
  - **Deck = 18 combos × 2 copies = 36 cards** (open item 2).
- **Board:**
  - **Card slots:** 12 edge stacks, 6 per player, each up to 3 cards.
    `edgeFor`: P1 row→right / col→bottom; P2 row→left / col→top. These are the
    **poker hands**.
  - **Die grid:** inner 3×3; each cell stacks dice (height 2 by game end — one per
    round). This is the **running-score** layer.

## Counts (why 36 cards)

- Grid = 9 cells × 2 layers = **18 dice** → **18 tricks** (1 die/trick).
- 18 tricks × 2 cards = **36 card-plays**; 6 slots/player × 3 = 18 cards/player = 36.
- Hand of 9 → **9 tricks/round** → **2 rounds** → 18 cards/player. Lazy refill to 9
  once a hand is emptied (existing behavior).
- End state: every card slot full (3 cards) AND every grid cell at height 2.

## A trick

1. **Leader** plays a card from hand into one of their own slots on a chosen axis
   (row or col) **that has room**, choosing the face-up = **led suit + value**. (No
   die placed by the leader.)
2. **Follower** plays into one of *their own* slots on the **opposite axis**, at an
   **un-filled grid intersection** (the cell where leader-line × follower-line
   cross must have room for this round's layer). **Must-NOT-follow:** the
   follower's up-face suit must **not** equal the led suit. (Always possible: dual
   faces guarantee a non-led face exists.)
3. **Winner** = higher up-face value; **ties broken by RPS** (e.g. tie R vs B → B).
4. **Loser places the die** = their own up-face (color + value) into the
   intersection cell, stacked on the current layer.
5. **Winner leads** the next trick.

### Placement legality (the anti-deadlock rules)

- **Round = which layer:** round 1 = first 9 dice (bottom layer, cells go empty→1),
  round 2 = next 9 (top layer, cells go 1→2). Determined by total dice placed.
- **Lead legality:** leader needs slot room AND the follower needs *some*
  opposite-axis slot with room. Cell availability is NOT a lead requirement.
- **Follow legality:** opposite axis, follower slot with room, must-NOT-follow suit.
  Cell availability is NOT a follow requirement either.
- **Die placement (escape valve):** the die normally lands at the row×col
  **intersection** cell. If that cell is already full for the round, it **spills to
  any cell with room** (engine picks deterministically: lowest row, then col).
- **No unique-color-per-cell constraint** (removed — it reintroduced deadlock).

**Why this is deadlock-free (verified):** the earlier design required the
intersection cell to have room for a lead/follow to be legal. But card-slot
capacity (3) and grid-cell capacity (2) desync — a leader could have an open slot
whose every reachable intersection cell was full → "no legal lead." Simulation:
random play deadlocked ~42% of games; even greedy deadlock-avoidance still failed
~50%, proving it was structural, not tactical. Dropping the cell requirement from
lead/follow legality and adding the spill-to-any-open-cell escape valve fixed it
completely: **500/500 random games finish, 0 deadlocks** (re-verified against the
real engine, not just a model). Over-stacking remains impossible (height cap
enforced at the cell); the escape valve guarantees no homeless die.

## Scoring

Both scoring sources feed three per-player pools: **R, G, B.**

### 1. Die-difference (running, round 2 only)
When a cell is **capped** in round 2, the **trick winner** scores:
- if the two dice in the cell are **different colors**: `|v_top − v_bottom|` points
  in the **third (omitted) color** (the color neither die is).
- if the two dice are the **same color**: **0 points**.

(Round 1 placements score nothing; they set up round 2.)

### 2. Poker hands (end of game)
After all dice are placed, compare each player's card slot against the **opposing**
slot across the board — 6 comparisons total:
- 3 row-pairs: P1 `right-i` vs P2 `left-i` (same row index).
- 3 col-pairs: P1 `bottom-j` vs P2 `top-j` (same col index).

Each comparison is a 3-card poker hand vs. the opposing 3-card hand. The **winner of
the comparison** scores **+1 point per card, in that card's color** (e.g. winning a
hand of R, R, G → +2 R, +1 G). Loser of the comparison scores nothing from it.

### Final
`score = min(R, G, B)` per player; higher wins (open item 1). Diversification is
forced: neglect any color and it caps your whole score.

## 3-card poker ranking (DRAFT — open item 3)

Hands are 3 cards (the slot's locked up-faces). Proposed order, high → low
(three-card-brag convention):

1. **Straight flush** — 3 consecutive ranks, one color (e.g. 2R 3R 4R).
2. **Three of a kind** — same rank ×3.
3. **Straight** — 3 consecutive ranks, mixed colors.
4. **Flush** — same color, non-consecutive.
5. **Pair** — two of one rank.
6. **High card** — none of the above.

Tie-breaks within a category: by rank(s); if still tied, by **RPS** on the relevant
color(s). Need to nail down: Ace/1 low only (ranks are 1–6 here, so straights are
plain consecutive); exact tiebreak chain per category; whether equal hands split or
both score nothing.

## Mapping (rank distribution within a pairing) — still TBD

Two candidates from ideation (shown R/G, strong=R; mirror for G/B, B/R):
- **Clean Tiers:** R6/G1 R6/G2 R5/G1 R5/G3 R4/G2 R4/G3 (strong always 4–6, weak 1–3).
- **Skewed-Overlap:** R6/G4 R6/G2 R5/G3 R5/G1 R4/G2 R3/G1 (skewed but overlapping).

Pick one and pressure-test the coax before locking.
