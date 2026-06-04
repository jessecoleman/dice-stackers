// ── Types ─────────────────────────────────────────────────────────────────────

export const suits = ['red', 'green', 'blue'] as const;
export type Suit = typeof suits[number];

export type Axis = 'row' | 'col';
export type Edge = 'top' | 'bottom' | 'left' | 'right';
export type Orientation = 0 | 1;

/** One side of a dual-sided card: a colour + rank. */
export interface Face {
  suit: Suit;
  value: number;
}

/** A dual-sided card: two faces of different colours. */
export interface Card {
  id: string;
  faces: [Face, Face];
}

/** A card committed to a slot with its orientation locked (which face scores). */
export interface PlacedCard {
  id: string;
  faces: [Face, Face];
  orientation: Orientation;
}

export interface Die {
  id: string;
  color: Suit;
  value: number;
  player: 1 | 2;
}

export interface CellStack {
  row: number;
  col: number;
  dice: Die[];
}

/** Per-colour point pools; final score is the minimum across colours. */
export interface ColorPoints {
  red: number;
  green: number;
  blue: number;
}

/**
 * Each player owns six card stacks across their two edges:
 *   axis 'row' → P1 right / P2 left  (indexed by row)
 *   axis 'col' → P1 bottom / P2 top  (indexed by col)
 * Opposing slots (P1 right-i vs P2 left-i, P1 bottom-j vs P2 top-j) form the
 * end-game poker comparisons.
 */
export const PLAYER_EDGES: Record<1 | 2, Edge[]> = {
  1: ['bottom', 'right'],
  2: ['top', 'left'],
};

export function edgeFor(player: 1 | 2, axis: Axis): Edge {
  if (axis === 'row') return player === 1 ? 'right' : 'left';
  return player === 1 ? 'bottom' : 'top';
}

export interface EventLogEntry {
  player: 1 | 2;
  action: 'led' | 'followed' | 'won';
  detail: string;
  timestamp: number;
  axis?: Axis;
  line?: 0 | 1 | 2;
  cell?: { row: number; col: number };
  cardValue?: number;
  cardSuit?: string;
  dieValue?: number;
  dieColor?: string;
}

/** The lead card awaiting a response (stores the locked up-face), or null when the current player must lead. */
export interface TrickLead {
  player: 1 | 2;
  axis: Axis;
  line: 0 | 1 | 2;
  suit: Suit;    // up-face colour = the led suit
  value: number; // up-face rank
}

export interface GameState {
  roomId: string;
  currentPlayer: 1 | 2;
  phase: 'playing' | 'game-over';
  grid: CellStack[][];
  player1Hand: Card[];
  player2Hand: Card[];
  drawPile: Card[];
  /** 12 stacks keyed `${edge}-${index}` (six per player), each holding up to 3 placed cards. */
  cardSlots: Record<string, PlacedCard[]>;
  /** The lead awaiting a response, or null when the current player must lead. */
  trick: TrickLead | null;
  /** Running per-colour point pools (die value × stack height during play + poker at end). */
  player1Score: ColorPoints;
  player2Score: ColorPoints;
  player2Joined: boolean;
  /** When true, seat 2 is driven by the server-side heuristic AI (see ai.ts). */
  vsAI?: boolean;
  player1Name: string;
  player2Name: string;
  eventLog: EventLogEntry[];
  rematchRequestedBy?: 1 | 2;
  rematchRoomId?: string;
  createdAt: number;
  updatedAt: number;
}

// Orientation (which value is live) is derived from the axis, not chosen: a card
// played on a col lane shows its LIGHT face, on a row lane its DARK face.
export type Action =
  | { type: 'PLAY_CARD'; card: Card; axis: Axis; line: 0 | 1 | 2 };

// ── Helpers ───────────────────────────────────────────────────────────────────

const HAND_SIZE = 6;            // 3 hands of 6, played out then refilled (no per-turn redraw)
const ALL_EDGES: Edge[] = ['top', 'bottom', 'left', 'right'];
const LINES = [0, 1, 2] as const;

/**
 * Even-fill slack: how far a lane may rise above the player's *shortest* lane.
 *   0 = strict even-fill (fill every lane to N before any reaches N+1)
 *   1 = a lane may be up to 1 ahead of the shortest
 *   2 = up to 2 ahead
 *   3 = free (no even-fill; any lane with room)
 * Tunable knob for balancing tempo/planning vs front-loading (see docs/balance-analysis.md).
 */
let evenFillSlack = 3;  // alt-scoring: free fill — any lane with room (no even-fill restriction)
export function setEvenFillSlack(n: number): void { evenFillSlack = n; }
export function getEvenFillSlack(): number { return evenFillSlack; }

export function slotKey(edge: Edge, index: 0 | 1 | 2): string {
  return `${edge}-${index}`;
}

export function upFace(pc: PlacedCard): Face {
  return pc.faces[pc.orientation];
}

/** RPS cycle: red ▸ green ▸ blue ▸ red. True when `a` beats `b`. */
export function beats(a: Suit, b: Suit): boolean {
  return (a === 'red' && b === 'green')
    || (a === 'green' && b === 'blue')
    || (a === 'blue' && b === 'red');
}

/** The colour that is neither `a` nor `b`, or null when they match. */
export function thirdColor(a: Suit, b: Suit): Suit | null {
  if (a === b) return null;
  return suits.find(s => s !== a && s !== b) ?? null;
}

function addPoints(pool: ColorPoints, suit: Suit, n: number): void {
  pool[suit] += n;
}

/** Final score for a pool: the minimum across the three colours. */
export function finalScore(pool: ColorPoints): number {
  return Math.min(pool.red, pool.green, pool.blue);
}

/** Per-colour majority counts: how many of R/G/B each pool strictly leads. */
export function colorWins(p1: ColorPoints, p2: ColorPoints): { p1: number; p2: number } {
  let a = 0, b = 0;
  for (const s of suits) {
    if (p1[s] > p2[s]) a++;
    else if (p2[s] > p1[s]) b++;
  }
  return { p1: a, p2: b };
}

/** Which player leads colour `suit`, or null when tied. */
export function colorLeader(p1: ColorPoints, p2: ColorPoints, suit: Suit): 1 | 2 | null {
  if (p1[suit] > p2[suit]) return 1;
  if (p2[suit] > p1[suit]) return 2;
  return null;
}

/**
 * Final winner: the player holding the majority in **≥2 of the three colours**. If
 * neither does (each leads one, or colours tie), break the tie by the larger
 * **second-highest** colour total; if those tie too, it's a draw.
 */
export function gameWinner(p1: ColorPoints, p2: ColorPoints): 1 | 2 | null {
  const { p1: a, p2: b } = colorWins(p1, p2);
  if (a >= 2) return 1;
  if (b >= 2) return 2;
  const secondHighest = (p: ColorPoints) => [p.red, p.green, p.blue].sort((x, y) => y - x)[1];
  const s1 = secondHighest(p1), s2 = secondHighest(p2);
  if (s1 !== s2) return s1 > s2 ? 1 : 2;
  return null;
}

// Deck: 3 colours × 6 light/dark value pairs × 2 copies = 36 cards. Each card is one
// colour with a LIGHT face (faces[0]) and a DARK face (faces[1]); the value played is
// the light one on a col lane, the dark one on a row lane. Dark skews high / light low
// with deliberate overlap (~22% of light-vs-dark tricks are upsets).
const SHADE_PAIRS: [number, number][] = [  // [light, dark]
  [1, 6], [2, 5], [3, 4], [3, 4], [4, 3], [5, 2],
];
const COLORS: Suit[] = ['red', 'green', 'blue'];
const COPIES = ['a', 'b'] as const;  // 2 copies → 36 cards

function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (const color of COLORS) {
    SHADE_PAIRS.forEach(([light, dark], i) => {
      for (const copy of COPIES) {
        cards.push({
          id: `${color}-${i}${copy}`,
          faces: [{ suit: color, value: light }, { suit: color, value: dark }],
        });
      }
    });
  }
  return cards;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function emptySlots(): Record<string, PlacedCard[]> {
  return Object.fromEntries(
    ALL_EDGES.flatMap(edge => LINES.map(i => [slotKey(edge, i), [] as PlacedCard[]]))
  );
}

function zeroPoints(): ColorPoints {
  return { red: 0, green: 0, blue: 0 };
}

// ── State creation ────────────────────────────────────────────────────────────

export function createInitialState(roomId: string): GameState {
  const deck = shuffle(buildDeck());
  return {
    roomId,
    currentPlayer: 1,
    phase: 'playing',
    grid: Array.from({ length: 3 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) => ({ row: r, col: c, dice: [] as Die[] }))
    ),
    player1Hand: deck.slice(0, HAND_SIZE),
    player2Hand: deck.slice(HAND_SIZE, HAND_SIZE * 2),
    drawPile: deck.slice(HAND_SIZE * 2),
    cardSlots: emptySlots(),
    trick: null,
    player1Score: zeroPoints(),
    player2Score: zeroPoints(),
    player2Joined: false,
    player1Name: 'Player 1',
    player2Name: 'Player 2',
    eventLog: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ── Pure game logic ───────────────────────────────────────────────────────────

function handOf(state: GameState, player: 1 | 2): Card[] {
  return player === 1 ? state.player1Hand : state.player2Hand;
}

function poolOf(state: GameState, player: 1 | 2): ColorPoints {
  return player === 1 ? state.player1Score : state.player2Score;
}

/** The height of a player's shortest lane (0–3). */
function minStackHeight(state: GameState, player: 1 | 2): number {
  let m = 3;
  for (const axis of ['row', 'col'] as Axis[])
    for (const line of LINES) {
      const len = (state.cardSlots[slotKey(edgeFor(player, axis), line)] ?? []).length;
      if (len < m) m = len;
    }
  return m;
}

/**
 * Whether a player may play into (axis, line) right now. Lanes fill toward height 3
 * under the **even-fill** rule: a lane is open only while its height stays within
 * `evenFillSlack` of the player's shortest lane. Slack 0 = strict layer-by-layer
 * fill; slack 3 = unconstrained. Driven purely by the board (independent of hands).
 */
export function stackHasRoom(state: GameState, player: 1 | 2, axis: Axis, line: 0 | 1 | 2): boolean {
  const stack = state.cardSlots[slotKey(edgeFor(player, axis), line)] ?? [];
  return stack.length < 3 && stack.length <= minStackHeight(state, player) + evenFillSlack;
}

/** The grid cell where a follow into `followLine` lands: intersection of the row- and col-lines. */
export function intersectionCell(axis: Axis, line: 0 | 1 | 2, followLine: 0 | 1 | 2): { row: number; col: number } {
  const rowLine = axis === 'row' ? line : followLine;
  const colLine = axis === 'col' ? line : followLine;
  return { row: rowLine, col: colLine };
}

/** True once every card stack holds 3 cards. */
export function isBoardFull(cardSlots: Record<string, PlacedCard[]>): boolean {
  return ALL_EDGES.every(edge => LINES.every(i => (cardSlots[slotKey(edge, i)] ?? []).length === 3));
}

/** Who wins a trick: the follower wins on a higher OR equal value (ties go to the follower). */
function followerWinsTrick(lead: TrickLead, followFace: Face): boolean {
  return followFace.value >= lead.value;
}

/** A die may enter a cell only if no die of that colour is already there (caps height at 3). */
export function cellAcceptsColor(state: GameState, cell: { row: number; col: number }, color: Suit): boolean {
  return !state.grid[cell.row][cell.col].dice.some(d => d.color === color);
}

/**
 * Validate a lead: the leader has room in their own (axis, line) stack and the
 * follower has at least one opposite-axis slot with room. Die placement is never a
 * legality constraint — if the loser's die can't be placed, the trick just resolves
 * without one (see applyAction), so a lead can never leave the follower stuck.
 */
export function isValidLead(state: GameState, axis: Axis, line: 0 | 1 | 2): boolean {
  const leader = state.currentPlayer;
  if (!stackHasRoom(state, leader, axis, line)) return false;
  const followAxis: Axis = axis === 'row' ? 'col' : 'row';
  const follower: 1 | 2 = leader === 1 ? 2 : 1;
  return LINES.some(l => stackHasRoom(state, follower, followAxis, l));
}

/**
 * Validate a follow: the follower plays on the axis opposite the lead, into their
 * own stack with room. No suit/orientation constraint — the shade (hence value) is
 * forced by the axis, and any card is legal.
 */
export function isValidFollow(state: GameState, axis: Axis, line: 0 | 1 | 2): boolean {
  const lead = state.trick;
  if (!lead) return false;
  const followAxis: Axis = lead.axis === 'row' ? 'col' : 'row';
  if (axis !== followAxis) return false;
  return stackHasRoom(state, state.currentPlayer, axis, line);
}

/** Which face is live for an axis: col → light (faces[0]), row → dark (faces[1]). */
export function orientationFor(axis: Axis): Orientation {
  return axis === 'col' ? 0 : 1;
}

/** Draw a fresh hand of HAND_SIZE, but only once the previous one is fully played out. */
function refillIfEmpty(state: GameState, player: 1 | 2): void {
  const hand = handOf(state, player);
  if (hand.length > 0) return;
  while (hand.length < HAND_SIZE && state.drawPile.length > 0) hand.push(state.drawPile.pop()!);
}

// ── Poker scoring (end game) ────────────────────────────────────────────────────

interface HandRank {
  cat: number;      // 5 straight-flush … 0 high card
  ranks: number[];  // tiebreak ranks, high → low (pair/trip rank first)
  hiSuit: Suit;     // colour of the highest card, for RPS tiebreak
}

/** Evaluate a 3-card poker hand from the slot's locked up-faces. */
export function evaluateHand(faces: Face[]): HandRank {
  const sorted = [...faces].sort((a, b) => b.value - a.value);
  const values = sorted.map(f => f.value);
  const isFlush = faces.every(f => f.suit === faces[0].suit);
  const distinct = [...new Set(values)];
  const isStraight = distinct.length === 3 && values[0] - values[2] === 2;

  // Rank-count groupings
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const tripRank = groups.find(g => g[1] === 3)?.[0];
  const pairRank = groups.find(g => g[1] === 2)?.[0];

  let cat: number;
  let ranks: number[];
  if (isStraight && isFlush) { cat = 5; ranks = values; }
  else if (tripRank !== undefined) { cat = 4; ranks = [tripRank]; }
  else if (isStraight) { cat = 3; ranks = values; }
  else if (isFlush) { cat = 2; ranks = values; }
  else if (pairRank !== undefined) { cat = 1; ranks = [pairRank, ...values.filter(v => v !== pairRank)]; }
  else { cat = 0; ranks = values; }

  return { cat, ranks, hiSuit: sorted[0].suit };
}

/** Compare two 3-card hands: +1 a wins, −1 b wins, 0 tie (equal category+ranks → neither scores). */
export function compareHands(a: HandRank, b: HandRank): number {
  if (a.cat !== b.cat) return a.cat > b.cat ? 1 : -1;
  const len = Math.max(a.ranks.length, b.ranks.length);
  for (let i = 0; i < len; i++) {
    const av = a.ranks[i] ?? 0, bv = b.ranks[i] ?? 0;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  return 0;  // identical category + ranks → tie, neither player scores the lane
}

export type LaneId = 'R0' | 'R1' | 'R2' | 'C0' | 'C1' | 'C2';

/** Poker category names indexed by HandRank.cat (0 high card … 5 straight flush). */
export const HAND_CATEGORY_NAMES = [
  'High card', 'Pair', 'Flush', 'Straight', 'Three of a kind', 'Straight flush',
] as const;

/** One end-game poker matchup: a player's edge stack vs the opposing stack. */
export interface PokerLane {
  id: LaneId;
  axis: Axis;
  index: 0 | 1 | 2;
  p1Faces: Face[];
  p2Faces: Face[];
  winner: 1 | 2 | null;     // null when tied or not yet full
  category: number | null;  // winning hand's HandRank.cat (index into HAND_CATEGORY_NAMES)
  points: ColorPoints;      // what the winner earns: each card's value in its colour
}

const LANE_PAIRS: { axis: Axis; p1Edge: Edge; p2Edge: Edge; prefix: 'R' | 'C' }[] = [
  { axis: 'row', p1Edge: 'right',  p2Edge: 'left', prefix: 'R' },  // rows: R0–R2
  { axis: 'col', p1Edge: 'bottom', p2Edge: 'top',  prefix: 'C' },  // cols: C0–C2
];

/**
 * Break down the six end-game poker lanes. For each, the winning 3-card hand earns
 * its owner points equal to **each card's value in that card's colour**. Used both
 * to award the final scores and to drive the game-over lane-by-lane reveal.
 */
export function pokerLanes(cardSlots: Record<string, PlacedCard[]>): PokerLane[] {
  const lanes: PokerLane[] = [];
  for (const { axis, p1Edge, p2Edge, prefix } of LANE_PAIRS) {
    for (const i of LINES) {
      const p1Faces = (cardSlots[slotKey(p1Edge, i)] ?? []).map(upFace);
      const p2Faces = (cardSlots[slotKey(p2Edge, i)] ?? []).map(upFace);
      const points = zeroPoints();
      let winner: 1 | 2 | null = null;
      let category: number | null = null;
      if (p1Faces.length === 3 && p2Faces.length === 3) {
        const h1 = evaluateHand(p1Faces), h2 = evaluateHand(p2Faces);
        const cmp = compareHands(h1, h2);
        if (cmp !== 0) {
          winner = cmp > 0 ? 1 : 2;
          category = (cmp > 0 ? h1 : h2).cat;
          for (const f of cmp > 0 ? p1Faces : p2Faces) addPoints(points, f.suit, f.value);
        }
      }
      lanes.push({ id: `${prefix}${i}` as LaneId, axis, index: i, p1Faces, p2Faces, winner, category, points });
    }
  }
  return lanes;
}

/** Award end-game poker points from the lane breakdown into each player's pool. */
function awardPokerScores(s: GameState): void {
  for (const lane of pokerLanes(s.cardSlots)) {
    if (!lane.winner) continue;
    const pool = lane.winner === 1 ? s.player1Score : s.player2Score;
    for (const suit of suits) addPoints(pool, suit, lane.points[suit]);
  }
}

// ── Action reducer ────────────────────────────────────────────────────────────

export function applyAction(
  state: GameState,
  player: 1 | 2,
  action: Action
): { state: GameState; error?: string } {
  if (state.phase === 'game-over') return { state, error: 'Game is over' };
  if (player !== state.currentPlayer) return { state, error: 'Not your turn' };
  if (action.type !== 'PLAY_CARD') return { state, error: 'Unknown action' };

  const s = structuredClone(state);
  const { card, axis, line } = action;
  const orientation = orientationFor(axis);   // shade (hence value) is set by the axis
  const hand = handOf(s, player);
  const idx = hand.findIndex(c => c.id === card.id);
  if (idx === -1) return { state, error: 'Card not in hand' };
  const face = card.faces[orientation];

  if (!s.trick) {
    // ── Leading the trick ──────────────────────────────────────────────────
    if (!isValidLead(s, axis, line)) return { state, error: 'No legal response to that lead' };
    hand.splice(idx, 1);
    s.cardSlots[slotKey(edgeFor(player, axis), line)].push({ id: card.id, faces: card.faces, orientation });
    s.trick = { player, axis, line, suit: face.suit, value: face.value };
    s.eventLog.push({
      player, action: 'led', detail: '', timestamp: Date.now(),
      axis, line, cardSuit: face.suit, cardValue: face.value,
    });
    s.currentPlayer = player === 1 ? 2 : 1;
    s.updatedAt = Date.now();
    return { state: s };
  }

  // ── Following the trick ────────────────────────────────────────────────────
  const lead = s.trick;
  if (!isValidFollow(s, axis, line)) return { state, error: 'Invalid follow play' };
  hand.splice(idx, 1);
  s.cardSlots[slotKey(edgeFor(player, axis), line)].push({ id: card.id, faces: card.faces, orientation });

  s.eventLog.push({
    player, action: 'followed', detail: '', timestamp: Date.now(),
    axis, line, cardSuit: face.suit, cardValue: face.value,
  });

  // Resolve the trick: higher up-face value wins, follower takes ties. The winner
  // leads next; the loser places & scores the die.
  const followerWins = followerWinsTrick(lead, face);
  const winner: 1 | 2 = followerWins ? player : lead.player;
  const loser: 1 | 2 = followerWins ? lead.player : player;
  // The die is the LOSER's up-face (colour + value).
  const dieFace: Face = followerWins ? { suit: lead.suit, value: lead.value } : face;

  // The die lands at the row/col intersection — but only if that cell holds no die
  // of this colour yet (each cell caps at the 3 colours → height 3). If it already
  // does, the trick still resolves but no die is placed and no points are scored.
  const target = intersectionCell(lead.axis, lead.line, line);
  const placedDie = cellAcceptsColor(s, target, dieFace.suit);
  if (placedDie) {
    const cell = s.grid[target.row][target.col];
    cell.dice.push({
      id: `die-${dieFace.suit}-${dieFace.value}-${Date.now()}`,
      color: dieFace.suit,
      value: dieFace.value,
      player: loser,
    });
    // The loser scores the die's value × its height in the stack (1-indexed), in the
    // die's colour: e.g. a 6 on the second level scores 12.
    addPoints(poolOf(s, loser), dieFace.suit, dieFace.value * cell.dice.length);
  }

  s.eventLog.push({
    player: winner, action: 'won', detail: '', timestamp: Date.now(),
    ...(placedDie
      ? { cell: target, dieColor: dieFace.suit, dieValue: dieFace.value }
      : {}),
  });

  s.trick = null;
  s.currentPlayer = winner;

  // Each player draws a fresh hand of 6 once their previous one is played out.
  refillIfEmpty(s, 1);
  refillIfEmpty(s, 2);

  if (isBoardFull(s.cardSlots)) {
    awardPokerScores(s);
    s.phase = 'game-over';
  }
  s.updatedAt = Date.now();
  return { state: s };
}
