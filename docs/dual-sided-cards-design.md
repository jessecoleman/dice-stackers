# Dual-Sided Cards + RPS Suits — Design Notes

Ideation notes for a possible redesign. Nothing here is built yet.

## Core idea

Each card is **dual-sided**: two suits, two ranks (e.g. `R6/G4`). Built from the
3 colors (R, G, B) paired up.

- Color pairs: C(3,2) = **3** pairs — RG, RB, GB.
- Cards per pair: **6** (one per rank of the strong color).
- **Total: 3 × 6 = 18 cards.**

The count of 18 is locked by the structure (3 pairs × 6). The rank-pairing rule
(offset, skew, etc.) only changes *which faces are bound together*, not the count.
The number of cards per pairing is a free dial (the original sample used 7); it
trades off against board size.

## Rock-Paper-Scissors suit cycle

Cycle: **R ▸ G ▸ B ▸ R** (R beats G, G beats B, B beats R).

In each pairing, the suit that *wins that matchup* is the "strong" suit and skews
toward high ranks; the loser skews low:

| pairing | strong (skews high) | weak (skews low) |
|---------|---------------------|------------------|
| R/G     | R                   | G                |
| G/B     | G                   | B                |
| B/R     | B                   | R                |

No suit is globally strongest — it's a true cycle. Note each suit appears in 2 of
the 3 pairings: once as the strong (high) suit, once as the weak (low) suit. So a
suit's overall rank distribution spans low-to-high depending on which card it's on.

## Must-NOT-follow trick rule

New trick rule: the follower **must NOT** follow the led suit. Lead Red → follower
must play Green or Blue.

**Why this works with dual cards:** every card has two *distinct* suits, so at most
one face matches the led suit. "Forbid the led suit" still leaves ≥1 legal face on
every card in hand. Suit-playability can therefore **never deadlock** — this is the
structural fix for the old "column becomes unplayable" problem. The second face's
real job is "guaranteed escape from the led suit."

## The coax dynamic (and its subtlety)

The leader wants to *coax* a specific suit/value tier out of the follower.

**Subtlety:** each non-led suit can come from **two pairings with opposite skews.**
Lead Red → follower may play Green or Blue:

- Green from an R/G card = **low** (green is weak there)
- Green from a G/B card = **high** (green is strong there)
- Blue from a B/R card = **high** (blue strong)
- Blue from a G/B card = **low** (blue weak)

So leading a suit *pressures* but doesn't *force* a value tier — it depends on which
cards the follower actually holds. The coax only bites hard when the follower
responds from the pairing that contains the led suit. This is good (soft coax, not a
straitjacket).

## What wins the trick? (the keystone decision)

The coax only matters if **value** is part of the win condition. Recommended:

> **Higher face-value wins; RPS breaks ties.**

Then skew sets the stakes. Example with a Red lead (follower allowed G or B;
B ▸ R, G ◂ R):

- **B = cheap-win suit** (ties go to B, since B beats R).
- **G = cheap-concede suit** (ties go to leader, since R beats G).
- **Lead Red HIGH** → follower must spend a high card to win, else concede with a
  low one. Winning is made expensive.
- **Lead Red LOW** → follower wins almost for free → lead low when you *don't* want
  the trick.

This gives two levers at once:
1. *Which suit to lead* → picks the follower's available counter-suits.
2. *Which value tier to lead* → sets the price of winning.

**Rejected alternative:** pure RPS decides and value is cosmetic. This makes the
follower's win/lose choice free and throws away the skew. Avoid.

## Candidate rank mappings (6 cards/pairing, shown for R/G; mirror for G/B, B/R)

### Option A — "Clean Tiers" (max legibility)
Strong only ever 4–6, weak only 1–3:

```
R6/G1, R6/G2, R5/G1, R5/G3, R4/G2, R4/G3
```

- Each suit spans 1–6 overall (high from strong pairing, low from weak), mean 3.5,
  symmetric across suits.
- Trade-off: zero overlap → in a same-pairing clash the strong suit *always*
  outranks. Very predictable.

### Option B — "Skewed-Overlap" (more upsets, closer to original sample)
```
R6/G4, R6/G2, R5/G3, R5/G1, R4/G2, R3/G1
```

- Strong mean ≈ 4.8, weak mean ≈ 2.2, but ranges overlap (a strong-4 can lose to a
  weak-4 from another pairing).
- Keeps the skew while letting the weak suit occasionally ambush. Likely the
  livelier game.

(Mapping still TBD — these are starting points.)

## Open questions / downstream impacts

- **Deck vs. board size.** 18 cards = 9 tricks/deck = 18 placements, but the current
  board is 36 slots (12 stacks × 3). Options: shrink the board, redeal/multiple
  deals, or lean on the dual face doing double scoring duty (one card scores its R
  face on one axis and its G/B face on the other).
- **Who places the die — winner or follower?** Wide open again with dual cards +
  must-not-follow. Interacts with the die-color uniqueness rule. Decide before
  finalizing the mapping, because it determines whether high values are something
  you *want* to win or want to dump.
- **Which face is "active."** With two faces, does the player choose orientation when
  playing? Does the led face vs. the scoring face differ?

## Poker-hand scoring (end-game)

At game end, each **row and column scores via poker hands**: a player's 3-card
stack on a line is compared to the opponent's stack on the matching line across the
board. Best 3-card poker hand wins that line.

Example: `2R, 3R, 4R` (straight flush) beats `2B, 3R, 4B` (just a straight).

Standard 3-card hand categories apply (straight flush > three-of-a-kind > flush >
straight > pair > high card), evaluated on rank.

## RPS *is* the poker suit-ranking (the keystone insight)

Poker needs a tiebreaker between same-category hands of different suits. Traditional
poker uses an arbitrary order (spades > hearts > ...). **The RPS cycle already
provides a non-arbitrary one.** Two equal-category hands of different suits → the
cycle names the winner (e.g. straight flush in Red vs. straight flush in Blue →
B ▸ R, Blue wins). No new rule beyond the cycle already taught.

**Why a cycle is enough (and only works at 2 players):** a cycle (R▸G▸B▸R) can't
*totally* rank all three suits at once — but scoring is always **pairwise** (P1's
line vs. P2's line). Between any *two distinct* suits the cycle always names a
winner; if both stacks share a suit, the tie falls through to rank. So the cycle is
exactly as much ordering as a 2-player pairwise comparison can use. (Flag: this
breaks for 3+ players.)

## Why the trick mechanic and the scoring goal reinforce each other

The RPS/coax system is not a separate gimmick — it's the **tool for sabotaging the
opponent's poker hands.** Two reinforcements come for free:

- **Must-not-follow = anti-flush pressure.** Forcing the opponent off the led suit
  literally stops them completing a flush in that suit. "Lead the suit they're
  flushing, to deny it."
- **Skewed values = straight control.** Leading high vs. low coaxes which *ranks*
  the opponent must dump into their stack — feeding or starving their straights. The
  coax now has a concrete target: their poker hand.

## Where the dice fit — the unifying question

Cleanest framing: **dual-sided cards create an ambiguity (which face scores?), and
the die is what resolves it** — giving the die an organic role instead of a parallel
system. Two architectures:

### Architecture A — "Dice are the board; cards are ammo"
- Cards are pure trick currency; the dual face only matters for which suit/value you
  lead or follow with.
- Winning a trick lets you drop one die (copying your played face: color + value)
  onto a shared 3×3 grid. 9 tricks → 9 dice → grid fills exactly.
- Each die sits in one row **and** one column → scores double duty (this fixes the
  18-card board-fill shortage). Each of the 6 lines is a 3-die poker hand; the line
  scores for whoever owns >=2 of its 3 cells, valued by poker category, RPS breaking
  suit ties.
- **Pro:** every component does exactly one job; no parallel scoring tracks.
- **Con:** not literally "two stacks compared across the board" — it's
  majority-control of one shared line. A departure from the stated vision.

### Architecture B — "Cards build the hands; the die locks the face" (current lean)
- Keep the mirrored edge-stacks: you build a 3-card poker hand on your edge, the
  opponent builds the opposing one, compared per line. (Matches the stated vision;
  the `2R,3R,4R` example reads like *cards*, supporting this.)
- Because each card is dual-sided, a card sitting in a stack is ambiguous — **the
  trick winner places a die at the intersection that locks which face counts** for
  both the row and column hands passing through that cell.
- Winning tricks = dictating the orientation of contested cards = shaping whose
  flush/straight actually resolves. Double-duty falls out naturally (one die orients
  a card shared by a row and a column).
- **Pro:** matches "compare across the board" literally; dice have a sharp,
  non-redundant role (face-resolution + control).
- **Con:** two structures to track (card hands + control dice), though they
  interlock rather than run in parallel.

### The decision that unlocks the rest
Both hinge on one question: **do the cards become the poker hands (B), or do the
dice (A)?** Everything downstream — tempo, who places what, whether cards are spent
or kept — follows from that.

Current lean: **B**, because the dual-sided ambiguity *demands* a resolver and the
die becomes that resolver — the tightest fusion of all four mechanics (RPS + tricks
+ dice + poker). **A** is the more minimal ruleset if "no convolution" is the hard
constraint.

## RESOLVED DIRECTION — orientation-lock + dual-scoring (current working model)

Several constraints from later discussion supersede the A-vs-B framing above and
lock down the die's role:

1. **Orientation locks the face.** When you play a card you choose which side is up;
   that face is fixed for poker scoring. No ambiguity, so the die is NOT needed as a
   "resolver" (that job from Architecture B is gone).
2. **Dice must still stack.** Stacking is a keeper mechanic. Both earlier
   architectures implied non-stacking dice — rejected.
3. **Two scoring components:** a **running** one (dice, during the game) and an
   **end-game** one (poker hands).
4. **Win/lose tradeoff:** winning a trick = tempo/control; losing = you place the
   die and/or score points for it.

### The unlock: the die IS the card's *other* face

Orientation-lock frees the die to carry the card's off-face. A card `R6/G4` played
**R-up**:

- **R6** → your poker stack (the locked, scoring face).
- **G4** → the die it can produce (color G, value 4).

So dual-sidedness finally earns its keep: one face builds the poker hand, the other
becomes the die. Same card play feeds both scoring systems. Die stacks normally — no
conflict with the stacking mechanic.

### Two structures, linked by the face-split

- **Poker stacks** (edge stacks of 3 cards) — locked-orientation faces; scored at
  end vs. the opposing line. RPS breaks suit ties.
- **Dice grid** (3x3, stacked dice) — the loser drops a die; dice stack in cells;
  unique-color-per-cell rule still applies; running score throughout.

Stacking fully preserved on the dice side (where it mattered).

### Win/lose tradeoff — "weaken your hand" interpreted

The built-in tension: **a face you spend as a die is a face you don't get for
poker.** Two readings of which face the die pulls from:

- **Die = the played (poker) face** *(current lean).* Lose with R6 → a fat 6-point
  red die, but you've burned your best red rank on a *loss*. High cards become
  triple-desirable (win tricks + build poker hands + score big as dice) and you
  can't spend one three ways. That scarcity is the game. Directly "weakens your
  hand."
- **Die = the off face.** Die value decoupled from poker-card strength. Less tension,
  more control — probably too clean given a real tradeoff is wanted.

### The unifier: both scorings pour into the same R/G/B pools

Don't run dice-points and poker-points as separate ledgers — feed both into the
**same three color pools:**

- Dice give **running** color points (G4 die → +points to Green pool).
- A won poker line gives **end** color points in that line's suit (win a Red flush
  line → Red pool).
- **Final score = min(R, G, B)** — diversification pressure governs every decision,
  not just a side rule. Must-not-follow shoves you off colors; RPS decides poker
  ties; `min` punishes neglect. All four mechanics push on the same three numbers.

### Open tensions to resolve before this is solid

1. **Two boards = how much weight?** Poker stacks AND a dice grid is a lot of
   simultaneous structure. Could the poker stacks and the dice be the *same* stacks
   (a 3-card stack scoring as running color-points during play AND as a poker hand at
   the end)? Collapses to one board; loses the literal die object but keeps stacking
   + both phases.
2. **Does the winner place anything?** If only the loser places a die, the winner's
   reward is purely tempo. Is tempo alone enough to *want* to win — or should winning
   also commit your card to a poker stack (winning builds your hand, losing builds
   your dice)? This symmetry question decides whether poker hands are built by
   winners, losers, or both.
3. **`min` can feel brutal.** One starved color zeroes the whole game — swingy,
   possibly demoralizing. Compare vs. "sum of the two lowest" or `min + small bonus
   for the rest`: keeps diversification, softens the cliff.
4. **High-card triple-bind needs a release valve.** If high cards are wanted for
   tempo *and* poker *and* dice, low cards risk feeling like dead weight. Skewed R/G
   distribution helps (a low card is someone's strong-suit denial), but verify low
   cards have a real job.

## Next step

- Resolve the four open tensions above (esp. #1 one-board-vs-two and #2 winner
  symmetry — they define the turn structure).
- Then fully spec: exact turn sequence, what a trick produces for winner vs. loser,
  how dice points are computed, and a worked 3-line endgame with poker comparison +
  R/G/B pool totals + `min`.
- Separately: game out sample tricks with Option A vs. Option B *mapping* to
  pressure-test the coax.
