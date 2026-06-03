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
  type Orientation,
  type Axis,
  type Edge,
  type Face,
  type ColorPoints,
} from '$lib/gameLogic';

/** The seat the AI controls. */
export const AI_SEAT: 1 | 2 = 2;

const ORIENTATIONS: Orientation[] = [0, 1];
const AXES: Axis[] = ['row', 'col'];
const LINES = [0, 1, 2] as const;

/**
 * Feature weights for the evaluation. Each term is a heuristic the bot can care
 * about more or less:
 *  - `colorLead`      — colours currently led (the win condition: lead 2 of 3).
 *  - `margin`         — raw per-colour point margin (dice points), a gentle gradient.
 *  - `pokerRealized`  — fully-formed lane triplets currently won vs the opponent.
 *  - `buildPotential` — own lanes shaping toward strong triplets vs the opponent's.
 */
export interface Weights {
  colorLead: number;
  margin: number;
  pokerRealized: number;
  buildPotential: number;
}

/** Named strategies to pit against each other in simulation. */
export const STRATEGIES = {
  // Greedy on the running colour pools (dice points → colour majority); ignores triplets.
  dice:       { colorLead: 8, margin: 0.15, pokerRealized: 0, buildPotential: 0 },
  // Focuses entirely on the 3-card lane triplets; ignores the dice/colour race.
  triplet:    { colorLead: 0, margin: 0,    pokerRealized: 6, buildPotential: 1.5 },
  // Even blend of both.
  balanced:   { colorLead: 6, margin: 0.1,  pokerRealized: 4, buildPotential: 0.8 },
  // Blend leaning toward dice/colour.
  diceHeavy:  { colorLead: 8, margin: 0.12, pokerRealized: 2, buildPotential: 0.4 },
  // Blend leaning toward triplets.
  pokerHeavy: { colorLead: 3, margin: 0.05, pokerRealized: 6, buildPotential: 1.2 },
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
    // Leading: legality is structural (slot room only), independent of the card, but
    // the card+orientation decide the led suit/value, so cross them all.
    for (const axis of AXES) {
      for (const line of LINES) {
        if (!isValidLead(state, axis, line)) continue;
        for (const card of hand) {
          for (const orientation of ORIENTATIONS) {
            moves.push({ type: 'PLAY_CARD', card, orientation, axis, line });
          }
        }
      }
    }
  } else {
    // Following: axis is fixed (opposite the lead); filter by the full follow rule.
    const followAxis: Axis = state.trick.axis === 'row' ? 'col' : 'row';
    for (const line of LINES) {
      for (const card of hand) {
        for (const orientation of ORIENTATIONS) {
          if (!isValidFollow(state, card, orientation, followAxis, line)) continue;
          moves.push({ type: 'PLAY_CARD', card, orientation, axis: followAxis, line });
        }
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

function facesAt(state: GameState, edge: Edge, index: 0 | 1 | 2): Face[] {
  return (state.cardSlots[slotKey(edge, index)] ?? []).map(upFace);
}

// The 6 opposing slot matchups: P1 edge vs P2 edge, by shared line index.
const SLOT_PAIRS: { p1: Edge; p2: Edge }[] = [
  { p1: 'right', p2: 'left' },   // row pairs
  { p1: 'bottom', p2: 'top' },   // col pairs
];

/** +1 per fully-formed slot matchup the bot currently wins, −1 per loss. */
function pokerRealizedMargin(state: GameState, me: 1 | 2): number {
  let margin = 0;
  for (const { p1, p2 } of SLOT_PAIRS) {
    for (const i of LINES) {
      const f1 = facesAt(state, p1, i);
      const f2 = facesAt(state, p2, i);
      if (f1.length < 3 || f2.length < 3) continue; // only realized matchups
      const cmp = compareHands(evaluateHand(f1), evaluateHand(f2)); // >0 favours P1
      const favoursMe = me === 1 ? cmp : -cmp;
      margin += Math.sign(favoursMe);
    }
  }
  return margin;
}

/** Sum of partial-hand strength (category) across a player's two edges. */
function buildPotentialOf(state: GameState, edges: Edge[]): number {
  let pot = 0;
  for (const edge of edges) {
    for (const i of LINES) {
      const faces = facesAt(state, edge, i);
      if (faces.length >= 2) pot += evaluateHand(faces).cat; // 0 high … 5 straight-flush
    }
  }
  return pot;
}

/** How much better the bot's lanes are shaping into strong triplets than the opponent's. */
function buildFeature(state: GameState, me: 1 | 2): number {
  const mine: Edge[]  = me === 1 ? ['right', 'bottom'] : ['left', 'top'];
  const opp:  Edge[]  = me === 1 ? ['left', 'top'] : ['right', 'bottom'];
  return buildPotentialOf(state, mine) - buildPotentialOf(state, opp);
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

  return w.colorLead      * colorLeadFeature(mine, opp)
    +    w.margin         * marginFeature(mine, opp)
    +    w.pokerRealized  * pokerRealizedMargin(state, me)
    +    w.buildPotential * buildFeature(state, me);
}

// ── Move choice ───────────────────────────────────────────────────────────────

/** The best legal move for `player` under `w`, or null if none exists. */
export function chooseMove(state: GameState, player: 1 | 2, w: Weights = DEFAULT_WEIGHTS): Action | null {
  let best: Action | null = null;
  let bestScore = -Infinity;
  for (const move of legalMoves(state, player)) {
    const res = applyAction(state, player, move);
    if (res.error) continue;
    const score = evalState(res.state, player, w);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
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
