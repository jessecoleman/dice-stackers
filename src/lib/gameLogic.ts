// ── Types ─────────────────────────────────────────────────────────────────────

export const suits = ['red', 'blue', 'green', 'yellow'] as const;
export type Suit = typeof suits[number];

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
}

export interface GameState {
  roomId: string;
  currentPlayer: 1 | 2;
  phase: 'playing' | 'last-turn' | 'game-over';
  grid: CellStack[][];
  player1Hand: Card[];
  player2Hand: Card[];
  drawPile: Card[];
  cardSlots: Record<string, Card[]>;
  pendingDiePlacement: { card: Card; edge: Edge; index: 0 | 1 | 2 } | null;
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
  | { type: 'PLAY_CARD'; card: Card; edge: Edge; index: 0 | 1 | 2 }
  | { type: 'PLACE_DIE'; row: number; col: number }
  | { type: 'DRAW_TO_SIX' }
  | { type: 'CANCEL_PLAY' };

// ── Helpers ───────────────────────────────────────────────────────────────────

export function slotKey(edge: Edge, index: 0 | 1 | 2): string {
  return `${edge}-${index}`;
}

function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of suits) {
    for (let v = 1; v <= 6; v++) {
      cards.push({ id: `${suit}-${v}`, suit, value: v });
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
    cardSlots: emptySlots,
    pendingDiePlacement: null,
    player2Joined: false,
    player1Name: 'Player 1',
    player2Name: 'Player 2',
    eventLog: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ── Pure game logic ───────────────────────────────────────────────────────────

export function canPlayToEdge(player: 1 | 2, edge: Edge): boolean {
  return PLAYER_EDGES[player].includes(edge);
}

export function isValidStackOrder(
  cardSlots: Record<string, Card[]>,
  edge: Edge,
  index: 0 | 1 | 2,
  card: Card
): boolean {
  const stack = cardSlots[slotKey(edge, index)] ?? [];
  if (stack.length === 0) return true;
  if (stack.some(c => c.suit === card.suit)) return false;
  const topValue = stack[stack.length - 1].value;
  return (edge === 'left' || edge === 'right')
    ? card.value > topValue
    : card.value < topValue;
}

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
  if (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (card.value >= top.value) return false;
    if (stack.some(d => d.color === card.suit)) return false;
  }
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
      if (stack.length === 0) { anyValid = true; break; }
      const top = stack[stack.length - 1];
      if (card.value < top.value && !stack.some(d => d.color === card.suit)) {
        anyValid = true;
        break;
      }
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
  if (state.drawPile.length > 0 && hand.length < 6) return true;
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
  const next: 1 | 2 = s.currentPlayer === 1 ? 2 : 1;
  let out = { ...s, currentPlayer: next };
  if (out.phase === 'last-turn') {
    out = { ...out, phase: 'game-over' };
  } else if (!hasValidMoves(out, next)) {
    const bonusPlayer = s.currentPlayer;
    if (!hasValidMoves(out, bonusPlayer)) {
      // Both players are stuck — end immediately
      out = { ...out, phase: 'game-over' };
    } else {
      out = { ...out, phase: 'last-turn', currentPlayer: bonusPlayer };
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

      const hand = player === 1 ? s.player1Hand : s.player2Hand;
      const idx = hand.findIndex(c => c.id === card.id);
      if (idx === -1) return { state, error: 'Card not in hand' };
      hand.splice(idx, 1);

      const prevCard = s.cardSlots[slotKey(edge, index)].at(-1);
      s.cardSlots[slotKey(edge, index)].push(card);
      s.pendingDiePlacement = { card, edge, index };
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
      const { card, edge: dieEdge } = s.pendingDiePlacement;
      const prevDie = s.grid[row][col].dice.at(-1);
      s.grid[row][col].dice.push({
        id: `die-${card.suit}-${card.value}-${Date.now()}`,
        color: card.suit,
        value: card.value,
        player,
        edge: dieEdge,
      });
      const placedDieId = s.grid[row][col].dice[s.grid[row][col].dice.length - 1].id;
      s.pendingDiePlacement = null;
      s.eventLog.push({ player, action: 'placed', detail: '', timestamp: Date.now(), cell: { row, col }, dieId: placedDieId, dieColor: card.suit, dieValue: card.value, prevDieValue: prevDie?.value, prevDieColor: prevDie?.color });
      s.updatedAt = Date.now();
      return { state: advanceTurn(s) };
    }

    case 'DRAW_TO_SIX': {
      if (s.pendingDiePlacement) return { state, error: 'Die placement still pending' };
      const hand = player === 1 ? s.player1Hand : s.player2Hand;
      const count = Math.min(Math.max(0, 6 - hand.length), s.drawPile.length);
      for (let i = 0; i < count; i++) hand.push(s.drawPile.pop()!);
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
      s.eventLog.push({ player, action: 'cancelled', detail: '', timestamp: Date.now(), cardSuit: card.suit, cardValue: card.value });
      s.updatedAt = Date.now();
      return { state: s };
    }

    default:
      return { state, error: 'Unknown action' };
  }
}
