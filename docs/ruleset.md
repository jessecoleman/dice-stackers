# Ruleset — Dual-Sided RPS Trick-Taker (build spec)

Canonical rules for the current redesign. This supersedes the exploratory
`dual-sided-cards-design.md` (kept only for reasoning history). Target: implement
against the existing `src/lib/gameLogic.ts`, which already has the trick engine,
12 edge card-slots, and a 3×3 die grid.

## STATUS: implemented (v1). Items below were resolved as noted; flag any you want changed.

1. **Final aggregation.** Win by leading the **majority (≥2 of 3) colours**; ties
   broken by the larger **second-highest** colour total (both die-placement points
   and poker points feed the same three colour pools).
2. **Deck size.** Implemented as **9 unique dual-sided combos × 4 copies = 36 cards**
   (3 colour pairings × 3 split values; each card pits a high face against a low face).
3. **3-card poker ranking** — implemented per the draft table below (straight flush >
   trips > straight > flush > pair > high; RPS breaks suit ties on the high card).
   Ties with equal category+ranks+RPS score for neither player. Revisit if desired.
4. **Deadlock** — not possible: die placement never gates a lead/follow (a blocked
   die is just skipped), so only card-slot room gates the game. Verified 1000/1000.

Not yet runtime-playtested in the browser; engine verified via headless simulation.

## Components

- **Colors / suits:** Red, Green, Blue.
- **RPS cycle:** **R ▸ G ▸ B ▸ R** (R beats G, G beats B, B beats R). No global
  strongest suit. Used for: trick tie-breaks AND poker suit tie-breaks.
- **Cards:** dual-sided, with a **split** value: a high "strong" face vs a low
  "weak" face (the two values sum to 7). Orientation locks which face is "up" (active).
  - 3 color pairings, cycling **high ↔ low**: high R / low B, high B / low G, high
    G / low R. Each pairing has 3 cards: `6/1, 5/2, 4/3` → **9 unique combos**.
  - **Deck = 9 combos × 4 copies = 36 cards.**
- **Board:**
  - **Card slots:** 12 edge stacks, 6 per player, each up to 3 cards.
    `edgeFor`: P1 row→right / col→bottom; P2 row→left / col→top. These are the
    **poker hands**.
  - **Die grid:** inner 3×3; each cell stacks dice but holds **at most one die of
    each colour** (R/G/B), so a cell caps at **height 3**. This is the
    **running-score** layer.

## Counts (why 36 cards)

- 18 tricks total (≤1 die/trick: a die is placed only when the intersection cell
  has no die of that colour yet), so **up to 18 dice** land on the 3×3 grid, each
  cell capped at one die per colour (height ≤ 3).
- 18 tricks × 2 cards = **36 card-plays**; 6 slots/player × 3 = 18 cards/player = 36.
- **2 hands of 9.** Each player is dealt 9, plays them out, then draws a second 9
  (lazy refill once the hand empties). Each player plays one card per trick → 18
  tricks total.
- **Even-fill restriction:** stacks must fill evenly — every lane reaches height 1
  before any reaches 2, and 2 before any reaches 3. So a lane is open only when its
  height equals the current **fill layer** (0, 1, 2); each layer is 6 cards/player.
  This is independent of the 9-card hands (the hand boundary falls mid-layer). After
  3 layers every lane holds 3 cards.
- End state: every card slot full (3 cards) — this alone ends the game.

**No deadlock from the even-fill rule:** each trick spends one card from *each*
player on *opposite* axes, so every trick adds exactly one row-play and one col-play
across the two players. By parity a leader's only-open axis can never be one the
follower has already exhausted mid-layer. Verified 1000/1000 random games finish with
every lane at exactly 3.

## A trick

1. **Leader** plays a card from hand into one of their own slots on a chosen axis
   (row or col) that is **open under even-fill** (its height equals the current fill
   layer), choosing the face-up = **led suit + value**. (No die placed by the leader.)
2. **Follower** plays into one of *their own* slots on the **opposite axis** that is
   open under even-fill. **Must-NOT-follow:** the follower's up-face suit must
   **not** equal the led suit. (Always possible: dual faces guarantee a non-led face
   exists.)
3. **Winner** = higher up-face value; **ties broken by RPS** (e.g. tie R vs B → B).
4. **The LOSER places the die** = their own up-face (color + value) into the
   intersection cell **iff that cell holds no die of this colour yet**, stacked on
   top, and **scores `die value × new stack height`** in the die's color. If the cell
   already holds that colour, **no die is placed and no points are scored** — the
   trick still resolves normally.
5. **Winner leads** the next trick.

### Placement legality

- **Lead legality:** leader needs slot room AND the follower needs *some*
  opposite-axis slot with room.
- **Follow legality:** opposite axis, follower slot with room, must-NOT-follow suit.
- **Die placement:** the die lands at the row×col **intersection** cell only if that
  cell has no die of its colour; otherwise the die is simply skipped. Die placement
  is **never** a legality constraint on leading or following — the leader may freely
  leave the follower with no legal die placement.

**No deadlock:** the card slots (capacity 3 each) are the only finite resource and
the sole end condition. A lead/follow is gated only by slot room + the must-NOT-follow
suit (never by the grid), so a player can always move while they hold cards. The game
ends exactly when all card slots fill (36 cards / 18 tricks). Verified deadlock-free:
1000/1000 random games finish, max cell height 3.

## Scoring

Both scoring sources feed three per-player pools: **R, G, B.**

### 1. Die placement (running)
The die is the **loser's up-face** (color + value); it lands at the row×col
intersection, but a cell holds **at most one die per colour** (so it caps at height
3). The **loser** (who places it) scores **`die value × stack height`** (height
1-indexed) in the **die's color**. Example: a 6 placed onto a stack so it sits on the
second level scores `6 × 2 = 12`. If the intersection cell already holds the die's
colour, **no die is placed and no points are scored** that trick.

### 2. Poker hands (end of game)
After all dice are placed, compare each player's card slot against the **opposing**
slot across the board — 6 comparisons total:
- 3 row-pairs: P1 `right-i` vs P2 `left-i` (same row index).
- 3 col-pairs: P1 `bottom-j` vs P2 `top-j` (same col index).

Each comparison is a 3-card poker hand vs. the opposing 3-card hand. The **winner of
the comparison** scores, for **each card, its face value in that card's color** (e.g.
winning a hand of R5, R3, G2 → +8 R, +2 G). Loser of the comparison scores nothing.

### Final
Compare the two players' pools **per color**. Whoever has more points in a color
**leads** that color; the player leading the **majority (≥2 of 3)** colors **wins**.
If neither leads two (each leads one, or colors tie), break the tie by the larger
**second-highest** color total; if those are equal too, it's a **draw**. Winning a
single color outright matters less than spreading enough to lead two.

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

## Mapping (rank distribution within a pairing) — RESOLVED

Split values, cycling high ↔ low across the three colours:

- **high R / low B:** R6·B1, R5·B2, R4·B3
- **high B / low G:** B6·G1, B5·G2, B4·G3
- **high G / low R:** G6·R1, G5·R2, G4·R3

The strong/weak values always sum to 7. Each of these 9 combos appears ×4 → 36
cards. Orientation chooses which side is active, trading a high value in one colour
for a low value in another.
