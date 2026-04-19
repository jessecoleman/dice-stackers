// ── Types ─────────────────────────────────────────────────────────────────────

export const suits = ['red', 'blue', 'green', 'yellow'] as const;
export type Suit = typeof suits[number];
export type ScoreKey = Suit | 'wild';
export type Scores = Record<ScoreKey, number>;

export interface Die {
  id: string;
  color: Suit;
  value: number;
  player: 1 | 2;
  edge: Edge;
}

export interface CellStack {
  row: number;
  col: number;
  dice: Die[];
}

export interface Card {
  id: string;
  suit: Suit;
  value: number;
}

export type Edge = 'top' | 'bottom' | 'left' | 'right';

export const PLAYER_EDGES: Record<1 | 2, Edge[]> = {
  1: ['bottom', 'right'],
  2: ['top', 'left'],
};

export interface EventLogEntry {
  player: 1 | 2;
  action: 'played' | 'placed' | 'drew' | 'cancelled';
  detail: string;
  timestamp: number;
  slot?: { edge: Edge; index: 0 | 1 | 2 };
  cell?: { row: number; col: number };
  dieId?: string;
  dieValue?: number;
  dieColor?: string;
  prevDieValue?: number;
  prevDieColor?: string;
  cardValue?: number;
  cardSuit?: string;
  prevCardValue?: number;
  prevCardSuit?: string;
  /** Points from placing the die (|new - prev| in die's suit). */
  diePts?: number;
  diePtsSuit?: ScoreKey;
  /** Points from clearing the opponent's stack (2 per card, by card suit). */
  stackPts?: Array<{ suit: ScoreKey; pts: number }>;
  /** Wild bonus from 4-color cell clear. */
  wildPts?: number;
}

export interface GameState {
  roomId: string;
  currentPlayer: 1 | 2;
  phase: 'playing' | 'last-turn' | 'game-over';
  grid: CellStack[][];
  player1Hand: Card[];
  player2Hand: Card[];
  drawPile: Card[];
  discardPile: Card[];
  cardSlots: Record<string, Card[]>;
  pendingDiePlacement: { card: Card; edge: Edge; index: 0 | 1 | 2; completesStack: boolean } | null;
  actionsRemaining: 1 | 2;
  usedSlotThisTurn: { edge: Edge; index: 0 | 1 | 2 } | null;
  player2Joined: boolean;
  player1Name: string;
  player2Name: string;
  eventLog: EventLogEntry[];
  scores1: Scores;
  scores2: Scores;
  rematchRequestedBy?: 1 | 2;
  rematchRoomId?: string;
  createdAt: number;
  updatedAt: number;
}

export type Action =
  | { type: 'PLAY_CARD'; card: Card; edge: Edge; index: 0 | 1 | 2 }
  | { type: 'PLACE_DIE'; row: number; col: number }
  | { type: 'DRAW_TO_SIX' }
  | { type: 'CANCEL_PLAY' };

// ── Helpers ───────────────────────────────────────────────────────────────────

export function slotKey(edge: Edge, index: 0 | 1 | 2): string {
  return `${edge}-${index}`;
}

const SUIT_VALUES: Record<string, number[]> = {
  red:    [1, 2, 3, 4],
  yellow: [2, 3, 4, 5],
  green:  [3, 4, 5, 6],
  blue:   [1, 2, 5, 6],
};

function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of suits) {
    for (const v of SUIT_VALUES[suit]) {
      cards.push({ id: `${suit}-${v}-a`, suit, value: v });
      cards.push({ id: `${suit}-${v}-b`, suit, value: v });
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

function emptyScores(): Scores {
  return { red: 0, blue: 0, green: 0, yellow: 0, wild: 0 };
}

function oppositeEdge(edge: Edge): Edge {
  if (edge === 'top')    return 'bottom';
  if (edge === 'bottom') return 'top';
  if (edge === 'left')   return 'right';
  return 'left';
}

// ── Stack pattern helpers ─────────────────────────────────────────────────────

// Returns true if cards could still complete as a set (all same value).
function canBeSet(cards: Card[]): boolean {
  return cards.every(c => c.value === cards[0].value);
}

// Returns true if cards could still complete as a run (3 consecutive values in strictly
// ascending or strictly descending order; suits are irrelevant).
function canBeRun(cards: Card[]): boolean {
  if (cards.length === 1) return true;
  const vals = cards.map(c => c.value);
  const dir = Math.sign(vals[1] - vals[0]); // +1 ascending, -1 descending, 0 = duplicate
  if (dir === 0) return false;
  for (let i = 1; i < vals.length; i++) {
    if (Math.sign(vals[i] - vals[i - 1]) !== dir) return false; // direction changed
    if (Math.abs(vals[i] - vals[i - 1]) !== 1) return false;    // gap > 1
  }
  return true;
}

// Returns true if cards could still complete as same-color (all same suit).
function canBeSameColor(cards: Card[]): boolean {
  return cards.every(c => c.suit === cards[0].suit);
}

// ── State creation ────────────────────────────────────────────────────────────

export function createInitialState(roomId: string): GameState {
  const deck = shuffle(buildDeck());
  const emptySlots = Object.fromEntries(
    (['top', 'bottom', 'left', 'right'] as Edge[]).flatMap(edge =>
      ([0, 1, 2] as const).map(i => [slotKey(edge, i), [] as Card[]])
    )
  );
  return {
    roomId,
    currentPlayer: 1,
    phase: 'playing',
    grid: Array.from({ length: 3 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) => ({ row: r, col: c, dice: [] as Die[] }))
    ),
    player1Hand: deck.slice(0, 6),
    player2Hand: deck.slice(6, 12),
    drawPile: deck.slice(12),
    discardPile: [],
    cardSlots: emptySlots,
    pendingDiePlacement: null,
    actionsRemaining: 2,
    usedSlotThisTurn: null,
    player2Joined: false,
    player1Name: 'Player 1',
    player2Name: 'Player 2',
    eventLog: [],
    scores1: emptyScores(),
    scores2: emptyScores(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ── Pure game logic ───────────────────────────────────────────────────────────

export function canPlayToEdge(player: 1 | 2, edge: Edge): boolean {
  return PLAYER_EDGES[player].includes(edge);
}

// A stack is valid as long as adding the card keeps at least one pattern (set / run / same-color) viable.
export function isValidStackOrder(
  cardSlots: Record<string, Card[]>,
  edge: Edge,
  index: 0 | 1 | 2,
  card: Card
): boolean {
  const stack = cardSlots[slotKey(edge, index)] ?? [];
  if (stack.length === 0) return true;
  if (stack.length >= 3) return false; // stack already full
  const newStack = [...stack, card];
  return canBeSet(newStack) || canBeRun(newStack) || canBeSameColor(newStack);
}

// A die may be placed on any aligned cell where that color doesn't already appear in the stack.
export function isCellValidForDiePlacement(
  grid: CellStack[][],
  pending: { card: Card; edge: Edge; index: 0 | 1 | 2 },
  row: number,
  col: number
): boolean {
  const { edge, index, card } = pending;
  const aligned = (edge === 'top' || edge === 'bottom') ? col === index : row === index;
  if (!aligned) return false;
  const stack = grid[row][col].dice;
  if (stack.some(d => d.color === card.suit)) return false; // each color appears at most once
  return true;
}

export function isCellNoPlacementWarning(
  grid: CellStack[][],
  cardSlots: Record<string, Card[]>,
  card: Card,
  player: 1 | 2,
  row: number,
  col: number
): boolean {
  for (const edge of PLAYER_EDGES[player]) {
    const isHoriz = edge === 'top' || edge === 'bottom';
    const slotIndex = (isHoriz ? col : row) as 0 | 1 | 2;
    if (!isValidStackOrder(cardSlots, edge, slotIndex, card)) continue;
    let anyValid = false;
    for (let i = 0; i < 3; i++) {
      const r = isHoriz ? i : slotIndex;
      const c = isHoriz ? slotIndex : i;
      const stack = grid[r][c].dice;
      if (!stack.some(d => d.color === card.suit)) { anyValid = true; break; }
    }
    if (!anyValid) return true;
  }
  return false;
}

/** Returns true if `card` played to `edge-index` would leave at least one valid die cell. */
function cardPlayHasDieCells(
  state: GameState,
  card: Card,
  edge: Edge,
  index: 0 | 1 | 2
): boolean {
  if (!isValidStackOrder(state.cardSlots, edge, index, card)) return false;
  const pending = { card, edge, index };
  const isHoriz = edge === 'top' || edge === 'bottom';
  for (let i = 0; i < 3; i++) {
    const r = isHoriz ? i : index;
    const c = isHoriz ? index : i;
    if (isCellValidForDiePlacement(state.grid, pending, r, c)) return true;
  }
  return false;
}

function hasValidMoves(state: GameState, player: 1 | 2): boolean {
  const hand = player === 1 ? state.player1Hand : state.player2Hand;
  if ((state.drawPile.length > 0 || state.discardPile.length > 0) && hand.length < 6) return true;
  for (const card of hand) {
    for (const edge of PLAYER_EDGES[player]) {
      for (let i = 0; i < 3; i++) {
        if (cardPlayHasDieCells(state, card, edge, i as 0 | 1 | 2)) return true;
      }
    }
  }
  return false;
}

function advanceTurn(s: GameState): GameState {
  // Player still has actions left this turn — just decrement.
  if (s.actionsRemaining > 1) {
    return { ...s, actionsRemaining: (s.actionsRemaining - 1) as 1 | 2 };
  }

  // All actions used — switch to next player with a full 2-action turn.
  const next: 1 | 2 = s.currentPlayer === 1 ? 2 : 1;
  let out = { ...s, currentPlayer: next, actionsRemaining: 2 as const, usedSlotThisTurn: null };
  if (out.phase === 'last-turn') {
    out = { ...out, phase: 'game-over' };
  } else if (!hasValidMoves(out, next)) {
    const bonusPlayer = s.currentPlayer;
    if (!hasValidMoves(out, bonusPlayer)) {
      out = { ...out, phase: 'game-over' };
    } else {
      out = { ...out, phase: 'last-turn', currentPlayer: bonusPlayer, actionsRemaining: 2, usedSlotThisTurn: null };
    }
  }
  return out;
}

// ── Action reducer ────────────────────────────────────────────────────────────

export function applyAction(
  state: GameState,
  player: 1 | 2,
  action: Action
): { state: GameState; error?: string } {
  if (state.phase === 'game-over') return { state, error: 'Game is over' };
  if (player !== state.currentPlayer) return { state, error: 'Not your turn' };

  const s = structuredClone(state);

  switch (action.type) {
    case 'PLAY_CARD': {
      if (s.pendingDiePlacement) return { state, error: 'Die placement still pending' };
      const { card, edge, index } = action;
      if (!canPlayToEdge(player, edge)) return { state, error: 'Cannot play to that edge' };
      if (!isValidStackOrder(s.cardSlots, edge, index, card)) return { state, error: 'Invalid stack order' };
      const used = s.usedSlotThisTurn;
      if (used && used.edge === edge && used.index === index) return { state, error: 'Cannot play to the same stack twice in one turn' };

      const hand = player === 1 ? s.player1Hand : s.player2Hand;
      const idx = hand.findIndex(c => c.id === card.id);
      if (idx === -1) return { state, error: 'Card not in hand' };
      hand.splice(idx, 1);

      const prevCard = s.cardSlots[slotKey(edge, index)].at(-1);
      s.cardSlots[slotKey(edge, index)].push(card);
      const completesStack = s.cardSlots[slotKey(edge, index)].length === 3;
      s.pendingDiePlacement = { card, edge, index, completesStack };
      s.usedSlotThisTurn = { edge, index };
      s.eventLog.push({ player, action: 'played', detail: '', timestamp: Date.now(), slot: { edge, index }, cardSuit: card.suit, cardValue: card.value, prevCardSuit: prevCard?.suit, prevCardValue: prevCard?.value });

      s.updatedAt = Date.now();
      return { state: s };
    }

    case 'PLACE_DIE': {
      if (!s.pendingDiePlacement) return { state, error: 'No die placement pending' };
      const { row, col } = action;
      if (!isCellValidForDiePlacement(s.grid, s.pendingDiePlacement, row, col)) {
        return { state, error: 'Invalid cell for die placement' };
      }
      const { card, edge: dieEdge, completesStack } = s.pendingDiePlacement;
      const prevDie = s.grid[row][col].dice.at(-1);
      const newDie: Die = {
        id: `die-${card.suit}-${card.value}-${Date.now()}`,
        color: card.suit,
        value: card.value,
        player,
        edge: dieEdge,
      };
      s.grid[row][col].dice.push(newDie);

      // Score: |new_value - prev_value| points in the color of the die being placed.
      // On an empty cell (no prev die) treat prev_value as 0, so score = card.value.
      const points = Math.abs(card.value - (prevDie?.value ?? 0));
      if (player === 1) s.scores1[card.suit] += points;
      else s.scores2[card.suit] += points;

      // 4-die bonus: if all 4 dice on this cell are different colors, clear and award 1 wild point.
      let wildPts = 0;
      const cellDice = s.grid[row][col].dice;
      if (cellDice.length === 4) {
        const colorSet = new Set(cellDice.map(d => d.color));
        if (colorSet.size === 4) {
          s.grid[row][col].dice = [];
          if (player === 1) s.scores1.wild += 1;
          else s.scores2.wild += 1;
          wildPts = 1;
        }
      }

      // Stack completion: clear own slot and mirror slot, score 2 pts per card color in mirror.
      const stackPtsMap = new Map<ScoreKey, number>();
      if (completesStack) {
        const ownKey    = slotKey(dieEdge, s.pendingDiePlacement.index);
        const mirrorKey = slotKey(oppositeEdge(dieEdge), s.pendingDiePlacement.index);
        const mirrorCards = s.cardSlots[mirrorKey];
        for (const c of mirrorCards) {
          if (player === 1) s.scores1[c.suit] += 2;
          else s.scores2[c.suit] += 2;
          stackPtsMap.set(c.suit, (stackPtsMap.get(c.suit) ?? 0) + 2);
        }
        s.discardPile.push(...s.cardSlots[ownKey], ...mirrorCards);
        s.cardSlots[ownKey]    = [];
        s.cardSlots[mirrorKey] = [];
      }

      const stackPts = stackPtsMap.size > 0
        ? [...stackPtsMap.entries()].map(([suit, pts]) => ({ suit, pts }))
        : undefined;
      const placedDieId = newDie.id;
      s.pendingDiePlacement = null;
      s.eventLog.push({ player, action: 'placed', detail: '', timestamp: Date.now(), cell: { row, col }, dieId: placedDieId, dieColor: card.suit, dieValue: card.value, prevDieValue: prevDie?.value, prevDieColor: prevDie?.color, diePts: points > 0 ? points : undefined, diePtsSuit: points > 0 ? card.suit : undefined, stackPts, wildPts: wildPts > 0 ? wildPts : undefined });
      s.updatedAt = Date.now();
      return { state: advanceTurn(s) };
    }

    case 'DRAW_TO_SIX': {
      if (s.pendingDiePlacement) return { state, error: 'Die placement still pending' };
      const hand = player === 1 ? s.player1Hand : s.player2Hand;
      let count = 0;
      while (hand.length < 6) {
        if (s.drawPile.length === 0) {
          if (s.discardPile.length === 0) break;
          s.drawPile = shuffle(s.discardPile);
          s.discardPile = [];
        }
        hand.push(s.drawPile.pop()!);
        count++;
      }
      s.eventLog.push({ player, action: 'drew', detail: `${count} card${count !== 1 ? 's' : ''}`, timestamp: Date.now() });
      s.updatedAt = Date.now();
      return { state: advanceTurn(s) };
    }

    case 'CANCEL_PLAY': {
      if (!s.pendingDiePlacement) return { state, error: 'No pending play to cancel' };
      const { card, edge, index } = s.pendingDiePlacement;
      const slot = s.cardSlots[slotKey(edge, index)];
      const cardIdx = slot.findLastIndex(c => c.id === card.id);
      if (cardIdx !== -1) slot.splice(cardIdx, 1);
      const hand = player === 1 ? s.player1Hand : s.player2Hand;
      hand.push(card);
      s.pendingDiePlacement = null;
      s.usedSlotThisTurn = null; // refund: cancelled action frees the slot restriction
      s.eventLog.push({ player, action: 'cancelled', detail: '', timestamp: Date.now(), cardSuit: card.suit, cardValue: card.value });
      s.updatedAt = Date.now();
      return { state: s };
    }

    default:
      return { state, error: 'Unknown action' };
  }
}
