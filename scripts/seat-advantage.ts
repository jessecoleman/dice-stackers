// Seat-advantage probe: mirror matches (same strategy on both seats) so any skew
// in the win rate is purely positional (P1 leads the first trick).
import { createInitialState, applyAction, gameWinner } from '../src/lib/gameLogic.ts';
import { STRATEGIES, chooseMove, type StrategyName } from '../src/lib/ai.ts';

declare const process: { argv: string[] };
const N = Number(process.argv[2] ?? 1000);
const names = Object.keys(STRATEGIES) as StrategyName[];

function playSelf(w: typeof STRATEGIES[StrategyName]): 1 | 2 | null {
  let s = createInitialState('x');
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 2000) {
    const m = chooseMove(s, s.currentPlayer, w);
    if (!m) break;
    const r = applyAction(s, s.currentPlayer, m);
    if (r.error) break;
    s = r.state;
  }
  return s.phase === 'game-over' ? gameWinner(s.player1Score, s.player2Score) : null;
}

const pad = (s: string, n: number) => s.padStart(n);
console.log(`Mirror matches, ${N} games each (P1 = first to lead):\n`);
console.log(pad('strategy', 11) + pad('P1 win%', 9) + pad('P2 win%', 9) + pad('draw%', 8));

let tot1 = 0, tot2 = 0, totD = 0;
for (const n of names) {
  let p1 = 0, p2 = 0, d = 0;
  for (let g = 0; g < N; g++) {
    const w = playSelf(STRATEGIES[n]);
    if (w === 1) p1++; else if (w === 2) p2++; else d++;
  }
  tot1 += p1; tot2 += p2; totD += d;
  console.log(pad(n, 11) + pad((100 * p1 / N).toFixed(1), 9) + pad((100 * p2 / N).toFixed(1), 9) + pad((100 * d / N).toFixed(1), 8));
}
const T = N * names.length;
console.log('\n' + pad('ALL', 11) + pad((100 * tot1 / T).toFixed(1), 9) + pad((100 * tot2 / T).toFixed(1), 9) + pad((100 * totD / T).toFixed(1), 8));
