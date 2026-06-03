// Mechanic analysis: replay many games and measure the win/lose-trick tension,
// where points come from (dice vs poker), and how dice scoring is distributed.
import { createInitialState, applyAction, gameWinner, pokerLanes, type GameState, type Action } from '../src/lib/gameLogic.ts';
import { legalMoves, chooseMove, STRATEGIES } from '../src/lib/ai.ts';

declare const process: { argv: string[] };
const N = Number(process.argv[2] ?? 3000);

type MoveFn = (s: GameState, p: 1 | 2) => Action | null;
const randomMove: MoveFn = (s, p) => { const m = legalMoves(s, p); return m.length ? m[Math.floor(Math.random() * m.length)] : null; };
const aiMove: MoveFn = (s, p) => chooseMove(s, p, STRATEGIES.diceHeavy);

function analyze(move: MoveFn, label: string) {
  let finished = 0;
  // trick/game tension
  let trickMajWinsGame = 0, trickTieGames = 0, decided = 0;
  let winnerTricks = 0, loserTricks = 0;
  // scoring sources
  let diceTotal = 0, pokerTotal = 0;
  let winnerDice = 0, winnerPoker = 0, loserDice = 0, loserPoker = 0;
  // die placement
  let placed = 0, blocked = 0;
  const heightCount = [0, 0, 0, 0];   // index = height 1..3
  const heightPts = [0, 0, 0, 0];

  for (let g = 0; g < N; g++) {
    let s = createInitialState('g');
    let guard = 0;
    while (s.phase === 'playing' && guard++ < 2000) {
      const m = move(s, s.currentPlayer); if (!m) break;
      const r = applyAction(s, s.currentPlayer, m); if (r.error) break;
      s = r.state;
    }
    if (s.phase !== 'game-over') continue;
    finished++;

    // Trick wins + dice points + heights, reconstructed from the event log in order.
    const tricks = { 1: 0, 2: 0 };
    const dice = { 1: 0, 2: 0 };
    const cellCount: Record<string, number> = {};
    for (const e of s.eventLog) {
      if (e.action !== 'won') continue;
      tricks[e.player]++;
      if (e.dieColor && e.cell) {                  // a die was placed
        const k = `${e.cell.row},${e.cell.col}`;
        const h = (cellCount[k] = (cellCount[k] ?? 0) + 1);
        const loser: 1 | 2 = e.player === 1 ? 2 : 1;
        const pts = (e.dieValue ?? 0) * h;
        dice[loser] += pts;
        placed++; heightCount[h]++; heightPts[h] += pts;
      } else {
        blocked++;
      }
    }

    // Poker points from the final board.
    const poker = { 1: 0, 2: 0 };
    for (const lane of pokerLanes(s.cardSlots)) {
      if (!lane.winner) continue;
      poker[lane.winner] += lane.points.red + lane.points.green + lane.points.blue;
    }

    const w = gameWinner(s.player1Score, s.player2Score);
    diceTotal += dice[1] + dice[2];
    pokerTotal += poker[1] + poker[2];

    if (w !== null) {
      const l: 1 | 2 = w === 1 ? 2 : 1;
      winnerTricks += tricks[w]; loserTricks += tricks[l];
      winnerDice += dice[w]; winnerPoker += poker[w];
      loserDice += dice[l]; loserPoker += poker[l];
      if (tricks[1] === tricks[2]) trickTieGames++;
      else { decided++; if ((tricks[1] > tricks[2] ? 1 : 2) === w) trickMajWinsGame++; }
    }
  }

  const pct = (x: number, d: number) => d ? (100 * x / d).toFixed(1) + '%' : '—';
  const f1 = (x: number, d: number) => d ? (x / d).toFixed(1) : '—';
  console.log(`\n── ${label}  (${finished}/${N} finished) ──`);
  console.log(`trick-majority player wins the game:   ${pct(trickMajWinsGame, decided)}   (${pct(trickTieGames, finished)} of games had a trick tie)`);
  console.log(`avg tricks won — game winner: ${f1(winnerTricks, finished)} / 18,  game loser: ${f1(loserTricks, finished)} / 18`);
  console.log(`points from dice vs poker:             dice ${pct(diceTotal, diceTotal + pokerTotal)}, poker ${pct(pokerTotal, diceTotal + pokerTotal)}`);
  console.log(`avg game-winner points — dice ${f1(winnerDice, finished)}, poker ${f1(winnerPoker, finished)}   |  loser — dice ${f1(loserDice, finished)}, poker ${f1(loserPoker, finished)}`);
  console.log(`dice placed vs blocked:                placed ${pct(placed, placed + blocked)}, blocked ${pct(blocked, placed + blocked)}`);
  console.log(`placements by height:   h1 ${pct(heightCount[1], placed)} (avg ${f1(heightPts[1], heightCount[1])} pts),  h2 ${pct(heightCount[2], placed)} (avg ${f1(heightPts[2], heightCount[2])}),  h3 ${pct(heightCount[3], placed)} (avg ${f1(heightPts[3], heightCount[3])})`);
}

analyze(randomMove, 'RANDOM play');
analyze(aiMove, 'diceHeavy self-play');
