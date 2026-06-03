// AI strategy tournament: round-robin between the named STRATEGIES in src/lib/ai.ts.
//
//   pnpm sim:ai            # default 200 games per seating
//   pnpm sim:ai 500        # 500 games per seating
//
// Each strategy pair plays `GAMES` games on each seating (to cancel first-move
// advantage), both seats driven by chooseMove with that strategy's weights.

import { createInitialState, applyAction, gameWinner } from '../src/lib/gameLogic.ts';
import { STRATEGIES, chooseMove, type StrategyName, type Weights } from '../src/lib/ai.ts';

// This script runs under tsx, not the SvelteKit build (whose tsconfig only pulls in
// Cloudflare Worker globals), so declare the Node bits we use.
declare const process: { argv: string[] };

const GAMES = Number(process.argv[2] ?? 200);
const names = Object.keys(STRATEGIES) as StrategyName[];

/** Play one full game; seat 1 uses `w1`, seat 2 uses `w2`. Returns the winning seat. */
function playGame(w1: Weights, w2: Weights): 1 | 2 | null {
  let s = createInitialState('sim');
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 2000) {
    const move = chooseMove(s, s.currentPlayer, s.currentPlayer === 1 ? w1 : w2);
    if (!move) break;
    const res = applyAction(s, s.currentPlayer, move);
    if (res.error) break;
    s = res.state;
  }
  return s.phase === 'game-over' ? gameWinner(s.player1Score, s.player2Score) : null;
}

interface Tally { wins: number; losses: number; draws: number; }
const blank = (): Tally => ({ wins: 0, losses: 0, draws: 0 });

// cell[a][b] = how strategy a fared vs b (seat-averaged over 2*GAMES games)
const cell: Record<string, Record<string, Tally>> = {};
const overall: Record<string, Tally> = {};
for (const a of names) { cell[a] = {}; overall[a] = blank(); for (const b of names) cell[a][b] = blank(); }

function record(a: string, b: string, aWon: boolean, draw: boolean) {
  const ca = cell[a][b], cb = cell[b][a];
  if (draw) { ca.draws++; cb.draws++; overall[a].draws++; overall[b].draws++; }
  else if (aWon) { ca.wins++; cb.losses++; overall[a].wins++; overall[b].losses++; }
  else { ca.losses++; cb.wins++; overall[a].losses++; overall[b].wins++; }
}

console.log(`Running ${GAMES} games per seating for each of ${names.length} strategies…\n`);

for (let i = 0; i < names.length; i++) {
  for (let j = i + 1; j < names.length; j++) {
    const a = names[i], b = names[j];
    for (let g = 0; g < GAMES; g++) {
      // a as seat 1
      const r1 = playGame(STRATEGIES[a], STRATEGIES[b]);
      record(a, b, r1 === 1, r1 === null);
      // a as seat 2
      const r2 = playGame(STRATEGIES[b], STRATEGIES[a]);
      record(a, b, r2 === 2, r2 === null);
    }
  }
}

// ── Head-to-head win-rate matrix (row strategy's win% vs column strategy) ──────
const pad = (s: string, n: number) => s.padStart(n);
const COL = 11;
const winPct = (t: Tally) => {
  const total = t.wins + t.losses + t.draws;
  return total ? (100 * t.wins / total) : 0;
};

console.log('Head-to-head win% (row vs column):\n');
console.log(pad('', COL) + names.map(n => pad(n, COL)).join(''));
for (const a of names) {
  let line = pad(a, COL);
  for (const b of names) {
    line += pad(a === b ? '—' : winPct(cell[a][b]).toFixed(0) + '%', COL);
  }
  console.log(line);
}

// ── Overall ranking ───────────────────────────────────────────────────────────
console.log('\nOverall (vs the whole field):\n');
const ranked = [...names].sort((x, y) => winPct(overall[y]) - winPct(overall[x]));
console.log(pad('strategy', COL) + pad('win%', 8) + pad('W', 7) + pad('L', 7) + pad('D', 7));
for (const n of ranked) {
  const t = overall[n];
  console.log(pad(n, COL) + pad(winPct(t).toFixed(1), 8) + pad(String(t.wins), 7) + pad(String(t.losses), 7) + pad(String(t.draws), 7));
}
