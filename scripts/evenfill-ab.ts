// A/B test of the even-fill slack knob (lever A in docs/balance-analysis.md).
// For each slack level it measures, under diceHeavy self-play:
//   - trick-majority-wins-game %  (→ 50% = balanced win/lose tension)
//   - avg legal lanes per decision (agency / planning room)
//   - seat-2 win %                 (positional advantage)
import { createInitialState, applyAction, gameWinner, setEvenFillSlack } from '../src/lib/gameLogic.ts';
import { legalMoves, chooseMove, STRATEGIES } from '../src/lib/ai.ts';

declare const process: { argv: string[] };
const N = Number(process.argv[2] ?? 2000);
const SLACKS = [0, 1, 2, 3];

const pad = (s: string, n: number) => s.padStart(n);
console.log(`diceHeavy self-play, ${N} games per slack level:\n`);
console.log(pad('slack', 7) + pad('trickMaj→win', 14) + pad('lanes/dec', 12) + pad('P2 win%', 10) + pad('ties%', 8));

for (const slack of SLACKS) {
  setEvenFillSlack(slack);
  let finished = 0, decided = 0, trickMajWins = 0, ties = 0, p2 = 0;
  let laneSum = 0, decisions = 0;

  for (let g = 0; g < N; g++) {
    let s = createInitialState('g');
    let guard = 0;
    while (s.phase === 'playing' && guard++ < 2000) {
      const moves = legalMoves(s, s.currentPlayer);
      if (!moves.length) break;
      // agency proxy: distinct (axis,line) lanes available this decision
      laneSum += new Set(moves.map(m => `${m.axis}${m.line}`)).size;
      decisions++;
      const move = chooseMove(s, s.currentPlayer, STRATEGIES.diceHeavy);
      if (!move) break;
      const r = applyAction(s, s.currentPlayer, move);
      if (r.error) break;
      s = r.state;
    }
    if (s.phase !== 'game-over') continue;
    finished++;

    const t = { 1: 0, 2: 0 };
    for (const e of s.eventLog) if (e.action === 'won') t[e.player]++;
    const w = gameWinner(s.player1Score, s.player2Score);
    if (w === 2) p2++;
    if (t[1] === t[2]) ties++;
    else if (w !== null) { decided++; if ((t[1] > t[2] ? 1 : 2) === w) trickMajWins++; }
  }

  const pct = (x: number, d: number) => d ? (100 * x / d).toFixed(1) + '%' : '—';
  console.log(
    pad(String(slack) + (slack === 3 ? ' (free)' : ''), 7) +
    pad(pct(trickMajWins, decided), 14) +
    pad((laneSum / decisions).toFixed(2), 12) +
    pad(pct(p2, finished), 10) +
    pad(pct(ties, finished), 8)
  );
}
