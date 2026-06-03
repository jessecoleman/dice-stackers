// ── Heuristic AI ────────────────────────────────────────────────────────────
//
// A 1-ply greedy bot for seat 2. Because `applyAction` is a pure reducer that
// returns the next state, "search" is just: enumerate every legal move, apply
// it, score the resulting state, keep the best. No separate game model needed.
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
 * Evaluation weights — the knobs to tune. The objective is to lead the majority of
 * colours, so `colorLead` (colours currently led) dominates, with `margin` as a
 * gentle per-colour point gradient. Poker terms are smaller (they resolve at end).
 */
const W = {
  win: 100_000,       // terminal: dominate everything by the actual win/loss/draw
  colorLead: 8.0,     // each colour you currently lead (lead 2 of 3 to win)
  margin: 0.1,        // per-colour point-margin gradient
  pokerRealized: 4.0, // each fully-formed slot matchup currently won/lost
  buildPotential: 0.5,// nudges its own slots toward pairs/flushes/straights
};

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

/** How favourable the colour pools are for the bot: colours led, plus a small margin. */
function colorAdvantage(mine: ColorPoints, opp: ColorPoints): number {
  const cw = colorWins(mine, opp);          // cw.p1 = colours `mine` leads, cw.p2 = `opp` leads
  let margin = 0;
  for (const s of suits) margin += mine[s] - opp[s];
  return W.colorLead * (cw.p1 - cw.p2) + W.margin * margin;
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

/** Reward the bot's own partial slots that are shaping into strong hands. */
function buildMargin(state: GameState, me: 1 | 2): number {
  const myEdges: Edge[] = me === 1 ? ['right', 'bottom'] : ['left', 'top'];
  let pot = 0;
  for (const edge of myEdges) {
    for (const i of LINES) {
      const faces = facesAt(state, edge, i);
      if (faces.length >= 2) pot += evaluateHand(faces).cat; // 0 high … 5 straight-flush
    }
  }
  return pot;
}

/** Score a state from `me`'s perspective; higher is better. */
export function evalState(state: GameState, me: 1 | 2): number {
  const { mine, opp } = poolsFor(state, me);

  if (state.phase === 'game-over') {
    // Pools include poker points — settle by the actual win condition, with the
    // colour advantage as a fine tiebreak among equally-won/lost lines.
    const w = gameWinner(state.player1Score, state.player2Score);
    const sign = w === null ? 0 : w === me ? 1 : -1;
    return W.win * sign + colorAdvantage(mine, opp);
  }

  return colorAdvantage(mine, opp)
    + W.pokerRealized * pokerRealizedMargin(state, me)
    + W.buildPotential * buildMargin(state, me);
}

// ── Move choice ───────────────────────────────────────────────────────────────

/** The best legal move for `player`, or null if none exists. */
export function chooseMove(state: GameState, player: 1 | 2): Action | null {
  let best: Action | null = null;
  let bestScore = -Infinity;
  for (const move of legalMoves(state, player)) {
    const res = applyAction(state, player, move);
    if (res.error) continue;
    const score = evalState(res.state, player);
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
export function stepAI(state: GameState): GameState {
  if (!aiToMove(state)) return state;
  const move = chooseMove(state, AI_SEAT);
  if (!move) return state;
  const res = applyAction(state, AI_SEAT, move);
  return res.error ? state : res.state;
}

/**
 * Play out the AI's turn(s) in one shot. Loops so the bot can follow a trick and
 * then keep leading whenever it wins. The guard bounds the loop well above the 36
 * total plays in a game.
 */
export function driveAI(state: GameState): GameState {
  let s = state;
  let guard = 0;
  while (aiToMove(s) && guard++ < 100) {
    const next = stepAI(s);
    if (next === s) break;
    s = next;
  }
  return s;
}
