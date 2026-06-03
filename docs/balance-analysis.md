# Balance Analysis — trick tension, seat advantage, scoring

Quantitative study of the current ruleset, run by replaying many headless games via
the pure `applyAction` reducer. Two move policies are used:

- **Random** — uniform over legal moves. Shows the *raw mechanic* with no strategy.
- **diceHeavy** — the strongest heuristic bot (see `src/lib/ai.ts`), self-play on both
  seats. Shows the mechanic under *competent* play.

Reproduce with `scripts/analyze.ts` (mechanic), `scripts/seat-advantage.ts` (mirror
matches), and `scripts/ai-sim.ts` (strategy tournament). Numbers below are from
3,000–10,000-game runs.

## 1. Seat advantage — large, and it favours the *second* player

Mirror matches (identical strategy on both seats, so any skew is purely positional;
P1 leads the first trick), 1,000 games each:

| strategy | P1 win% | P2 win% |
|---|---|---|
| dice | 26.7 | 72.7 |
| triplet | 53.1 | 45.7 |
| balanced | 31.0 | 68.4 |
| diceHeavy | 29.7 | 69.5 |
| pokerHeavy | 35.1 | 63.3 |
| **all** | **35.1** | **63.9** |

**Seat 2 wins ~64% overall**, up to ~70% for dice-oriented strategies. The lone
exception is the pure `triplet` strategy (~balanced), which tells us the advantage is
tied to the dice/colour race, not the poker triplets: the follower responds to the
lead with full information and, because the **loser places & scores the die**, the
second seat can steer die placement and choose to lose for points.

Implication: the live game seats the human as P1 and the AI as P2 (`AI_SEAT = 2`), so
the bot currently gets this positional edge on top of being the strongest profile.

## 2. The win/lose-trick tension is real but **inverted** under good play

| | trick-majority wins game | trick ties | winner avg tricks | loser avg tricks |
|---|---|---|---|---|
| Random | 48.3% | 18.4% | 8.8 / 18 | 9.0 / 18 |
| diceHeavy | **34.1%** | 5.5% | **7.4 / 18** | **10.4 / 18** |

Under random play, winning tricks is ~neutral (48%) — the healthy baseline. Under
competent play it flips: the game **winner deliberately loses more tricks than they
win** (7.4 vs 10.4), and winning the trick-majority predicts the game only 34% of the
time. The tension exists, but it's lopsided — the loser's die points outweigh the
winner's tempo/placement freedom, so "lose the trick for points" is usually correct.
This is the same force behind the seat-2 edge.

## 3. Both scoring channels are live; the big swings are real but rare

Under diceHeavy:

- **Points split ~50/50 dice vs poker** — neither channel is vestigial.
- **Game winner out-scores the loser in both** (dice 45.6 vs 28.2, poker 39.7 vs
  32.4); the dice gap is larger, i.e. dice is the more decisive/swingy channel.
- **Placements by height:** h1 54% (avg 3.3 pts), h2 33% (avg 6.8), **h3 12.5% (avg
  9.5 pts)**. A height-3 die is ~3× a height-1, but only ~1 in 8 placements reaches it.
- **~21% of tricks place no die at all** (the intersection cell already holds that
  colour). A meaningful chunk of "nothing happened."

## 4. Interpretation vs the design goals

1. **Win/lose tension** — present but mis-tuned: tempo is underpriced relative to the
   loser's points, so the choice usually has a correct answer rather than a live
   tradeoff. Fix by raising the winner's payoff or tempering the loser's.
2. **Even-fill vs planning** — likely the keystone problem. Tempo's value *is* "I lead
   next and pick the lane," but strict even-fill shrinks the pool of legal lanes
   (moves become near-forced late in each layer), which (a) cut planning depth and
   (b) drained value out of winning — the very counterweight that was meant to balance
   the loser's points. It hurts two goals at once.
3. **Transparency** — players track ~6 interacting systems, and dice vs poker are two
   co-equal (~50/50) subgames with different planning. The legibility cost comes from
   running two full scoring games of equal weight; making one primary and the other a
   modifier would help.

## 5. Levers to test (all measurable)

Measured against: **trick-majority-wins-game %** (→ 50% = balanced tension) and an
**agency proxy** (avg legal lanes per decision).

- **A. Loosen even-fill** — let a stack sit up to *N* above your shortest (0 = strict
  current, 3 = free). More open lanes → tempo worth more → tension toward 50%, and
  more planning room. Addresses #1 and #2 together, and reverses a recent change.
  *(Implemented as the `EVEN_FILL_SLACK` knob in `gameLogic.ts`.)*
- **B. Give the winner a stake** — e.g. the winner also scores a small fixed amount,
  so winning isn't purely tempo.
- **C. Temper the loser** — cap die value or flatten the height multiplier (but this
  shrinks the swingy moments, so likely not preferred).

## Lever A results — even-fill slack sweep

`scripts/evenfill-ab.ts`, diceHeavy self-play, 2,000 games per level. All levels are
deadlock-free (3,000/3,000 under random play):

| slack | trick-majority → wins game | lanes / decision | P2 win% | ties |
|---|---|---|---|---|
| 0 (strict, current) | 34.3% | 2.75 | 68.8% | 5.9% |
| 1 | 40.4% | 2.87 | 63.5% | 6.8% |
| **2** | **40.8%** | **2.99** | **55.8%** | 6.5% |
| 3 (free) | 39.5% | 2.98 | 59.8% | 6.7% |

Loosening helps on all three axes, and **slack 2 is the sweet spot**: best trick
tension (34→41%), most planning room, and it nearly halves the seat-2 excess (68.8 →
55.8). Fully free (3) is slightly worse than slack 2 on tension and seat balance.

Caveats: this is one bot's self-play, so the *strategy ranking* could shift under
looser rules; and slack only *partially* fixes the inverted tension (41%, still <50%)
and the seat edge (55.8%, still >50%). Closing the rest likely needs lever B (give the
winner a scoring stake) on top of slack 2.

## Dice vs card scoring — what to actually smooth

The imbalance is **not magnitude**: under good play points split dice 50.5% / poker
49.5%, and the pure-dice (33%) and pure-triplet (34.5%) strategies lose to blends
*symmetrically* — neither system out-scores the other. What differs is the *feel*:

| | Dice | Cards (poker) |
|---|---|---|
| Rhythm | continuous — 18 small increments during play | one batch at the very end |
| Variance | high — height×value; ~12% big height-3 swings, ~21% blocked whiffs | low — deterministic once hands are set |
| Mental model | spatial/positional (grid, height, colour-cap) | combinatorial (hand ranks) |
| Feedback | immediate | deferred to game over |

So it's two subgames that feel unlike each other and resolve on opposite schedules —
that mismatch, not the totals, reads as "imbalanced."

### Smoothing options

1. **Give poker a pulse (rhythm).** Score lanes as each fill-layer completes, or score
   each card's value into its colour pool on placement with a small category bonus when
   a lane finishes. Both systems then tick continuously; no end-game lump. Lowest risk,
   biggest feel change. *(Recommended first.)*
2. **Couple the systems (model).** Make one feed the other — e.g. a completed
   flush/trips lets the owner place/upgrade a die, or a lane's hand-colour multiplies
   dice at its intersections. Fewer independent things to track; more combo payoff.
3. **Tame dice variance (variance).** `+height` instead of `×height` shrinks the swings
   toward poker's steadiness — but that removes the swingy moments we want, so probably
   not.
4. **Collapse to one currency.** Drop hand ranks; cards bank value×colour like dice.
   Fully legible, one model — but loses the poker depth the sims show is pulling weight.

## Flow & legibility assessment (qualitative)

Friction points, worst-first. The first two fight players' instincts and are the big
intuitiveness costs:

1. **"Must NOT follow the led suit" inverts the one rule every trick-taker knows.**
   Players arrive with "follow suit if you can" hardwired. Mechanically fine, but expect
   constant early mistakes. Consider framing it as "answer with a different colour"
   rather than as a follow rule, and/or a loud UI affordance.
2. **You usually want to *lose* the trick.** Winners deliberately lose 10.4 of 18
   tricks. A deep, satisfying inversion once understood, but invisible to newcomers who
   "play to win tricks." The win/lose tradeoff needs to be legible *at the moment of
   choosing* (e.g. "lose this → place a 6 on a height-2 stack → +12 blue").
3. **The win condition isn't visible on the board.** "Lead 2 of 3 colours, tiebreak on
   second-highest" can't be read at a glance. The corner "colours led" helps; a
   side-by-side R/G/B you-vs-them bar with the leader highlighted would make the actual
   objective glanceable. The tiebreak stays opaque.
4. **The colour-cap causes frequent invisible no-ops (~21%).** To predict whether your
   die lands you must remember each cell's colours. Surface "this cell is full for red"
   before committing.
5. **Even-fill height tracking** adds bookkeeping when planning; slack 2 makes "which
   lanes are legal" less obvious than strict layers (the UI gates targets, which mostly
   covers it).

Meta: that's ~6 interacting systems (RPS trick, dual-card orientation, even-fill,
colour-cap dice with height scoring, poker hands, colour-majority win). Each is fine
alone; together it's heavy to parse at a glance. Highest-leverage legibility wins are
making the **win condition** and the **win/lose-trick tradeoff** visible in-the-moment,
since those are where instincts actively mislead.

(Caveat: this is reasoned from rules + components, not from watching the rendered 3D
board — presentation/occlusion needs a real visual pass.)

## Status

Findings, lever-A results, smoothing options, and the flow assessment recorded. The
`EVEN_FILL_SLACK` knob is implemented (**slack 2 recommended**; live default still
strict 0). Smoothing #1 (incremental poker) and lever B (winner stake) not yet built.
