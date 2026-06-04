// ── Heuristic AI ────────────────────────────────────────────────────────────
//
// A 1-ply greedy bot. Because `applyAction` is a pure reducer that returns the
// next state, "search" is just: enumerate every legal move, apply it, score the
// resulting state, keep the best. No separate game model needed.
//
// The evaluation is a weighted sum of features; swapping the `Weights` lets the
// same engine play very different strategies (see `STRATEGIES`), which is what the
// tournament harness in scripts/ai-sim.ts compares.
//
// `driveAI` is the server-side entry point: given a state whose turn belongs to
// the AI, it plays moves (following, then leading if it wins the trick) until
// control returns to the human or the game ends.

import {
  applyAction,
  isValidLead,
  isValidFollow,
  evaluateHand,
  compareHands,
  colorWins,
  gameWinner,
  suits,
  upFace,
  slotKey,
  type GameState,
  type Action,
  type Axis,
  type Edge,
  type Face,
  type ColorPoints,
} from '$lib/gameLogic';

/** The seat the AI controls. */
export const AI_SEAT: 1 | 2 = 2;

const AXES: Axis[] = ['row', 'col'];
const LINES = [0, 1, 2] as const;

/**
 * Feature weights for the evaluation. Each term is a heuristic the bot can care
 * about more or less:
 *  - `colorLead`      — colours currently led (the win condition: lead 2 of 3).
 *  - `margin`         — raw per-colour point margin (dice points), a gentle gradient.
 *  - `pokerRealized`  — expected card-stacks (poker lanes) won vs the opponent.
 *  - `buildPotential` — expected card-stack points (win-probability × hand value).
 *  - `dualFocus`      — margin in your best TWO colours, ignoring the third (commit to
 *                       two colours, concede one — directly targets "lead 2 of 3").
 */
export interface Weights {
  colorLead: number;
  margin: number;
  pokerRealized: number;
  buildPotential: number;
  dualFocus?: number;
}

/** Named strategies to pit against each other in simulation. */
export const STRATEGIES = {
  // Even blend of dice and triplets.
  balanced:   { colorLead: 6, margin: 0.1,  pokerRealized: 4, buildPotential: 0.8 },
  // Blend leaning toward dice/colour.
  diceHeavy:  { colorLead: 8, margin: 0.12, pokerRealized: 2, buildPotential: 0.4 },
  // Blend leaning toward triplets.
  pokerHeavy: { colorLead: 3, margin: 0.05, pokerRealized: 6, buildPotential: 1.2 },
  // Commit to two colours and concede the third (rather than spread across all three).
  dualColor:  { colorLead: 0, margin: 0,    pokerRealized: 3, buildPotential: 0.5, dualFocus: 0.5 },
} satisfies Record<string, Weights>;

export type StrategyName = keyof typeof STRATEGIES;

/** The strategy the live (server-driven) opponent uses — strongest in simulation
 *  (diceHeavy: 62.6% vs the field over 10k games, beats every other profile H2H). */
export const DEFAULT_WEIGHTS: Weights = STRATEGIES.diceHeavy;

/** Terminal dominance — fixed across strategies so every bot still plays to win. */
const WIN = 100_000;

// ── Move enumeration ──────────────────────────────────────────────────────────

/** Every legal Action for `player` in `state` (whether leading or following). */
export function legalMoves(state: GameState, player: 1 | 2): Action[] {
  const hand = player === 1 ? state.player1Hand : state.player2Hand;
  const moves: Action[] = [];

  if (!state.trick) {
    // Leading: legality is structural (slot room). The axis sets the shade/value, so
    // each open (axis, line) crossed with each card is a distinct lead.
    for (const axis of AXES) {
      for (const line of LINES) {
        if (!isValidLead(state, axis, line)) continue;
        for (const card of hand) {
          moves.push({ type: 'PLAY_CARD', card, axis, line });
        }
      }
    }
  } else {
    // Following: axis is fixed (opposite the lead); any card into an open line.
    const followAxis: Axis = state.trick.axis === 'row' ? 'col' : 'row';
    for (const line of LINES) {
      if (!isValidFollow(state, followAxis, line)) continue;
      for (const card of hand) {
        moves.push({ type: 'PLAY_CARD', card, axis: followAxis, line });
      }
    }
  }

  return moves;
}

// ── Evaluation ────────────────────────────────────────────────────────────────

function poolsFor(state: GameState, me: 1 | 2): { mine: ColorPoints; opp: ColorPoints } {
  return me === 1
    ? { mine: state.player1Score, opp: state.player2Score }
    : { mine: state.player2Score, opp: state.player1Score };
}

/** Net colours led (mine − opp), range −3..3. */
function colorLeadFeature(mine: ColorPoints, opp: ColorPoints): number {
  const cw = colorWins(mine, opp);   // cw.p1 = colours `mine` leads, cw.p2 = `opp` leads
  return cw.p1 - cw.p2;
}

/** Net per-colour point margin (mine − opp) summed across colours. */
function marginFeature(mine: ColorPoints, opp: ColorPoints): number {
  let m = 0;
  for (const s of suits) m += mine[s] - opp[s];
  return m;
}

/** Margin in the best TWO colours (ignores the worst) — rewards committing to two. */
function dualFocusFeature(mine: ColorPoints, opp: ColorPoints): number {
  const margins = suits.map(s => mine[s] - opp[s]).sort((a, b) => b - a);
  return margins[0] + margins[1];
}

function facesAt(state: GameState, edge: Edge, index: 0 | 1 | 2): Face[] {
  return (state.cardSlots[slotKey(edge, index)] ?? []).map(upFace);
}

// ── Card-stack (poker lane) estimation ────────────────────────────────────────
// The 6 end-game lane matchups: a player's edge stack vs the opposing edge stack,
// by shared line index. Both stacks in a pair are the same shade — row pairs hold
// the dark (high) face values, col pairs the light (low) ones.
const POKER_PAIRS: { p1: Edge; p2: Edge; dark: boolean }[] = [
  { p1: 'right', p2: 'left', dark: true },   // row pairs → dark/high values
  { p1: 'bottom', p2: 'top', dark: false },  // col pairs → light/low values
];

// Mean face value a lane still draws (deck: dark ≈ 4.0, light ≈ 3.0).
const DARK_MEAN = 4.0;
const LIGHT_MEAN = 3.0;

/** Heuristic strength of a (partial or full) lane hand — higher = more likely to win. */
function handPotential(faces: Face[]): number {
  if (faces.length === 0) return 0;
  const values = faces.map(f => f.value);
  let q = values.reduce((a, b) => a + b, 0);                 // high cards: value + high-card wins
  if (faces.every(f => f.suit === faces[0].suit)) q += 4 * faces.length;  // flush building
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const maxRep = Math.max(...counts.values());
  if (maxRep >= 2) q += 6 * (maxRep - 1);                    // pair +6, trips +12
  const distinct = [...new Set(values)].sort((a, b) => a - b);
  if (distinct.length === values.length && distinct.length >= 2 &&
      distinct[distinct.length - 1] - distinct[0] <= 2) q += 3 * faces.length;  // straight building
  return q;
}

/** P(a lane filled from `myFaces` beats one filled from `oppFaces`) at game end. */
function laneWinProb(myFaces: Face[], oppFaces: Face[]): number {
  if (myFaces.length === 3 && oppFaces.length === 3) {
    const cmp = compareHands(evaluateHand(myFaces), evaluateHand(oppFaces));
    return cmp > 0 ? 1 : 0;                                  // exact tie scores for neither
  }
  // Partial: logistic on the strength gap, flattened toward 50/50 by unknown cards.
  const unknown = (3 - myFaces.length) + (3 - oppFaces.length);
  const k = 0.12 / (1 + 0.4 * unknown);
  return 1 / (1 + Math.exp(-k * (handPotential(myFaces) - handPotential(oppFaces))));
}

/** Expected final point value of a lane: current card values + expected remaining draws. */
function laneExpectedValue(faces: Face[], dark: boolean): number {
  const cur = faces.reduce((a, f) => a + f.value, 0);
  return cur + (3 - faces.length) * (dark ? DARK_MEAN : LIGHT_MEAN);
}

/**
 * Estimate the bot's card-stack advantage across the 6 lanes:
 *   winMargin  = Σ (P(me win) − P(opp win))            — expected lanes won
 *   pointMargin = Σ (P(me)·EV(me) − P(opp)·EV(opp))     — expected poker points
 */
function pokerEstimate(state: GameState, me: 1 | 2): { winMargin: number; pointMargin: number } {
  let winMargin = 0, pointMargin = 0;
  for (const { p1, p2, dark } of POKER_PAIRS) {
    for (const i of LINES) {
      const f1 = facesAt(state, p1, i), f2 = facesAt(state, p2, i);
      const mine = me === 1 ? f1 : f2, opp = me === 1 ? f2 : f1;
      const pMe = laneWinProb(mine, opp), pOpp = laneWinProb(opp, mine);
      winMargin += pMe - pOpp;
      pointMargin += pMe * laneExpectedValue(mine, dark) - pOpp * laneExpectedValue(opp, dark);
    }
  }
  return { winMargin, pointMargin };
}

/** Score a state from `me`'s perspective under `w`; higher is better. */
export function evalState(state: GameState, me: 1 | 2, w: Weights = DEFAULT_WEIGHTS): number {
  const { mine, opp } = poolsFor(state, me);

  if (state.phase === 'game-over') {
    // Pools include poker points — settle by the actual win condition (all strategies
    // play to win), with the point margin as a fine tiebreak among equal outcomes.
    const winner = gameWinner(state.player1Score, state.player2Score);
    const sign = winner === null ? 0 : winner === me ? 1 : -1;
    return WIN * sign + 0.01 * marginFeature(mine, opp);
  }

  const poker = pokerEstimate(state, me);
  return w.colorLead         * colorLeadFeature(mine, opp)
    +    w.margin            * marginFeature(mine, opp)
    +    w.pokerRealized     * poker.winMargin     // expected lanes won
    +    w.buildPotential    * poker.pointMargin   // expected poker points
    +    (w.dualFocus ?? 0)  * dualFocusFeature(mine, opp);
}

// ── Move choice (minimax) ───────────────────────────────────────────────────────

/** Plies of lookahead: 2 = my move + the opponent's best reply. */
export const SEARCH_DEPTH = 2;

/**
 * Alpha-beta minimax scored from `me`'s fixed perspective. Nodes alternate max/min
 * by whose turn it is (`state.currentPlayer`) — the trick flow drives that, since
 * the leader, follower, and next-trick leader aren't a simple strict alternation.
 */
function search(state: GameState, me: 1 | 2, depth: number, alpha: number, beta: number, w: Weights): number {
  if (depth === 0 || state.phase === 'game-over') return evalState(state, me, w);
  const player = state.currentPlayer;
  const moves = legalMoves(state, player);
  if (moves.length === 0) return evalState(state, me, w);

  const maximizing = player === me;
  let best = maximizing ? -Infinity : Infinity;
  for (const move of moves) {
    const res = applyAction(state, player, move);
    if (res.error) continue;
    const v = search(res.state, me, depth - 1, alpha, beta, w);
    if (maximizing) {
      if (v > best) best = v;
      if (best > alpha) alpha = best;
    } else {
      if (v < best) best = v;
      if (best < beta) beta = best;
    }
    if (beta <= alpha) break;  // prune
  }
  return best;
}

/** The best legal move for `player` under `w`, searching `depth` plies ahead. */
export function chooseMove(
  state: GameState,
  player: 1 | 2,
  w: Weights = DEFAULT_WEIGHTS,
  depth: number = SEARCH_DEPTH,
): Action | null {
  let best: Action | null = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  for (const move of legalMoves(state, player)) {
    const res = applyAction(state, player, move);
    if (res.error) continue;
    const score = search(res.state, player, depth - 1, alpha, Infinity, w);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
    if (bestScore > alpha) alpha = bestScore;
  }
  return best;
}

// ── Driver ────────────────────────────────────────────────────────────────────

/** True when it's the AI's move in an AI game still in progress. */
export function aiToMove(state: GameState): boolean {
  return !!state.vsAI && state.phase === 'playing' && state.currentPlayer === AI_SEAT;
}

/**
 * Apply exactly one AI move and return the resulting state (unchanged if it's
 * not the AI's turn). The client calls this once per tick so each move can be
 * paced/animated; `driveAI` below resolves a whole turn at once for headless use.
 */
export function stepAI(state: GameState, w: Weights = DEFAULT_WEIGHTS): GameState {
  if (!aiToMove(state)) return state;
  const move = chooseMove(state, AI_SEAT, w);
  if (!move) return state;
  const res = applyAction(state, AI_SEAT, move);
  return res.error ? state : res.state;
}

/**
 * Play out the AI's turn(s) in one shot. Loops so the bot can follow a trick and
 * then keep leading whenever it wins. The guard bounds the loop well above the 36
 * total plays in a game.
 */
export function driveAI(state: GameState, w: Weights = DEFAULT_WEIGHTS): GameState {
  let s = state;
  let guard = 0;
  while (aiToMove(s) && guard++ < 100) {
    const next = stepAI(s, w);
    if (next === s) break;
    s = next;
  }
  return s;
}
