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
  /** Running per-colour point pools (die-difference during play + poker at end). */
  player1Score: ColorPoints;
  player2Score: ColorPoints;
  player2Joined: boolean;
  player1Name: string;
  player2Name: string;
  eventLog: EventLogEntry[];
  rematchRequestedBy?: 1 | 2;
  rematchRoomId?: string;
  createdAt: number;
  updatedAt: number;
}

export type Action =
  | { type: 'PLAY_CARD'; card: Card; orientation: Orientation; axis: Axis; line: 0 | 1 | 2 };

// ── Helpers ───────────────────────────────────────────────────────────────────

const HAND_SIZE = 9;
const ALL_EDGES: Edge[] = ['top', 'bottom', 'left', 'right'];
const LINES = [0, 1, 2] as const;

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

// Deck: 3 colour pairings × 6 cards × 2 copies = 36 cards (18 unique combos).
// Within a pairing the RPS-winning colour is "strong" and skews high.
const SKEW_PAIRS: [number, number][] = [[6, 4], [6, 2], [5, 3], [5, 1], [4, 2], [3, 1]];
const PAIRINGS: { strong: Suit; weak: Suit }[] = [
  { strong: 'red', weak: 'green' },   // R ▸ G
  { strong: 'green', weak: 'blue' },  // G ▸ B
  { strong: 'blue', weak: 'red' },    // B ▸ R
];

function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (const { strong, weak } of PAIRINGS) {
    for (const [sv, wv] of SKEW_PAIRS) {
      for (const copy of ['a', 'b'] as const) {
        cards.push({
          id: `${strong}${sv}-${weak}${wv}-${copy}`,
          faces: [{ suit: strong, value: sv }, { suit: weak, value: wv }],
        });
      }
    }
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

/** Room in the card stack a player would use for (axis, line). */
export function stackHasRoom(state: GameState, player: 1 | 2, axis: Axis, line: 0 | 1 | 2): boolean {
  return (state.cardSlots[slotKey(edgeFor(player, axis), line)] ?? []).length < 3;
}

/** Total dice placed so far across the grid. */
function totalDice(state: GameState): number {
  let n = 0;
  for (const row of state.grid) for (const cell of row) n += cell.dice.length;
  return n;
}

/** Current round: 1 = bottom layer (first 9 tricks), 2 = top layer (next 9). */
export function currentRound(state: GameState): 1 | 2 {
  return totalDice(state) < 9 ? 1 : 2;
}

/** The grid cell where a follow into `followLine` lands: intersection of the row- and col-lines. */
export function intersectionCell(axis: Axis, line: 0 | 1 | 2, followLine: 0 | 1 | 2): { row: number; col: number } {
  const rowLine = axis === 'row' ? line : followLine;
  const colLine = axis === 'col' ? line : followLine;
  return { row: rowLine, col: colLine };
}

/** A die can land in a cell iff its height equals (round − 1): R1 onto empty, R2 onto height-1. */
function cellHasRoomForRound(state: GameState, cell: { row: number; col: number }): boolean {
  return state.grid[cell.row][cell.col].dice.length === currentRound(state) - 1;
}

/** Every cell with room for this round's die — used for the escape-valve placement. */
function cellsWithRoom(state: GameState): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  for (const row of state.grid) for (const cell of row) {
    if (cell.dice.length === currentRound(state) - 1) out.push({ row: cell.row, col: cell.col });
  }
  return out;
}

/** True once every card stack holds 3 cards (equivalently, every grid cell is height 2). */
export function isBoardFull(cardSlots: Record<string, PlacedCard[]>): boolean {
  return ALL_EDGES.every(edge => LINES.every(i => (cardSlots[slotKey(edge, i)] ?? []).length === 3));
}

/**
 * Validate a lead: the current player has room in their own (axis, line) stack AND
 * the follower has at least one opposite-axis slot with room. Cell availability is
 * NOT required here — if the natural intersection cell is full, the die spills to
 * any open cell (escape valve), which keeps the game from deadlocking.
 */
export function isValidLead(state: GameState, axis: Axis, line: 0 | 1 | 2): boolean {
  const leader = state.currentPlayer;
  if (!stackHasRoom(state, leader, axis, line)) return false;
  const followAxis: Axis = axis === 'row' ? 'col' : 'row';
  const follower: 1 | 2 = leader === 1 ? 2 : 1;
  return LINES.some(l => stackHasRoom(state, follower, followAxis, l));
}

/**
 * Validate a follow. The follower must:
 *  - play on the axis opposite the lead, into their own stack with room,
 *  - play an up-face whose colour is NOT the led suit (must-NOT-follow).
 * The die's cell is resolved at placement time (intersection, or escape valve).
 */
export function isValidFollow(
  state: GameState,
  card: Card,
  orientation: Orientation,
  axis: Axis,
  line: 0 | 1 | 2
): boolean {
  const lead = state.trick;
  if (!lead) return false;
  const follower = state.currentPlayer;
  const followAxis: Axis = lead.axis === 'row' ? 'col' : 'row';
  if (axis !== followAxis) return false;
  if (!stackHasRoom(state, follower, axis, line)) return false;
  // Must-NOT-follow: the up-face colour must differ from the led suit.
  if (card.faces[orientation].suit === lead.suit) return false;
  return true;
}

/** Draw a fresh hand of 9, but only once the previous one is fully played out. */
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

/** Compare two 3-card hands: +1 a wins, −1 b wins, 0 true tie. RPS breaks rank ties. */
export function compareHands(a: HandRank, b: HandRank): number {
  if (a.cat !== b.cat) return a.cat > b.cat ? 1 : -1;
  const len = Math.max(a.ranks.length, b.ranks.length);
  for (let i = 0; i < len; i++) {
    const av = a.ranks[i] ?? 0, bv = b.ranks[i] ?? 0;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  // Identical categories and ranks → break by RPS on the highest card's colour.
  if (beats(a.hiSuit, b.hiSuit)) return 1;
  if (beats(b.hiSuit, a.hiSuit)) return -1;
  return 0;
}

function slotFaces(state: GameState, edge: Edge, index: 0 | 1 | 2): Face[] {
  return (state.cardSlots[slotKey(edge, index)] ?? []).map(upFace);
}

/** Award end-game poker points: each of the 6 opposing slot-pairs goes to the winner (+1 per card in its colour). */
function awardPokerScores(s: GameState): void {
  const pairs: { p1Edge: Edge; p2Edge: Edge }[] = [
    { p1Edge: 'right', p2Edge: 'left' },   // row pairs (indexed by row)
    { p1Edge: 'bottom', p2Edge: 'top' },   // col pairs (indexed by col)
  ];
  for (const { p1Edge, p2Edge } of pairs) {
    for (const i of LINES) {
      const f1 = slotFaces(s, p1Edge, i);
      const f2 = slotFaces(s, p2Edge, i);
      if (f1.length < 3 || f2.length < 3) continue;
      const cmp = compareHands(evaluateHand(f1), evaluateHand(f2));
      if (cmp === 0) continue;
      const winnerFaces = cmp > 0 ? f1 : f2;
      const pool = cmp > 0 ? s.player1Score : s.player2Score;
      for (const f of winnerFaces) addPoints(pool, f.suit, 1);
    }
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
  const { card, orientation, axis, line } = action;
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
  if (!isValidFollow(s, card, orientation, axis, line)) return { state, error: 'Invalid follow play' };
  hand.splice(idx, 1);
  s.cardSlots[slotKey(edgeFor(player, axis), line)].push({ id: card.id, faces: card.faces, orientation });

  s.eventLog.push({
    player, action: 'followed', detail: '', timestamp: Date.now(),
    axis, line, cardSuit: face.suit, cardValue: face.value,
  });

  // Resolve the trick: higher up-face wins; RPS breaks ties (up-face suits always differ).
  let followerWins: boolean;
  if (face.value > lead.value) followerWins = true;
  else if (face.value < lead.value) followerWins = false;
  else followerWins = beats(face.suit, lead.suit);

  const winner: 1 | 2 = followerWins ? player : lead.player;
  const loser: 1 | 2 = followerWins ? lead.player : player;
  // The loser's up-face becomes the die.
  const loserFace: Face = followerWins ? { suit: lead.suit, value: lead.value } : face;

  // Die lands at the row/col intersection; if that cell is already full for this
  // round (escape valve), it spills to any cell with room — chosen deterministically
  // (lowest row, then col) so client and server agree.
  let target = intersectionCell(lead.axis, lead.line, line);
  if (!cellHasRoomForRound(s, target)) {
    const open = cellsWithRoom(s);
    if (open.length === 0) return { state, error: 'No cell available for the die' };
    target = open[0];
  }
  const { row, col } = target;
  const cell = s.grid[row][col];
  cell.dice.push({
    id: `die-${loserFace.suit}-${loserFace.value}-${Date.now()}`,
    color: loserFace.suit,
    value: loserFace.value,
    player: loser,
  });

  // Round-2 cap: the trick winner scores |difference| in the third colour (0 if same colour).
  if (cell.dice.length === 2) {
    const [bottom, top] = cell.dice;
    const third = thirdColor(bottom.color, top.color);
    if (third) addPoints(poolOf(s, winner), third, Math.abs(top.value - bottom.value));
  }

  s.eventLog.push({
    player: winner, action: 'won', detail: '', timestamp: Date.now(),
    cell: { row, col }, dieColor: loserFace.suit, dieValue: loserFace.value,
  });

  s.trick = null;
  s.currentPlayer = winner;

  // Each player draws a fresh hand of 9 once their previous one is played out.
  refillIfEmpty(s, 1);
  refillIfEmpty(s, 2);

  if (isBoardFull(s.cardSlots)) {
    awardPokerScores(s);
    s.phase = 'game-over';
  }
  s.updatedAt = Date.now();
  return { state: s };
}
