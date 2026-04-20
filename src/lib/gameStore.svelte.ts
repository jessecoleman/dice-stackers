import {
  suits,
  canPlayToEdge,
  isValidStackOrder,
  isCellValidForDiePlacement,
  isCellNoPlacementWarning as _isCellNoPlacementWarning,
  type Suit,
  type Die,
  type CellStack,
  type Card,
  type Edge,
  type GameState,
  type EventLogEntry,
  type Action,
  type Scores,
  type ScoreKey,
  PLAYER_EDGES,
} from '$lib/gameLogic';

export { suits, PLAYER_EDGES };
export type { Suit, Die, CellStack, Card, Edge, GameState, EventLogEntry, Scores, ScoreKey };

const _emptyScores = (): Scores => ({ red: 0, blue: 0, green: 0, yellow: 0, wild: 0 });

// ── Store ─────────────────────────────────────────────────────────────────────

type HoverHighlight =
  | { type: 'cell'; row: number; col: number; dieId?: string }
  | { type: 'slot'; edge: Edge; index: 0 | 1 | 2 }
  | { type: 'cells'; cells: Array<{ row: number; col: number }> }
  | null;

function createGameStore() {
  let serverState = $state<GameState | null>(null);
  let selectedCard = $state<{ player: 1 | 2; card: Card } | null>(null);
  let roomId = $state<string | null>(null);
  let seat = $state<1 | 2 | null>(null);
  let hoverHighlight = $state<HoverHighlight>(null);
  let tooltipText    = $state<string | null>(null);

  // Empty fallbacks so components don't have to null-check
  const emptyGrid: CellStack[][] = Array.from({ length: 3 }, (_, r) =>
    Array.from({ length: 3 }, (_, c) => ({ row: r, col: c, dice: [] }))
  );

  async function sendAction(action: Action): Promise<void> {
    if (!roomId || seat === null || !serverState) return;
    const res = await fetch(`/api/game/${roomId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player: seat, action }),
    });
    if (res.ok) {
      serverState = await res.json();
    }
  }

  return {
    /** Initialise from the server-loaded data (called once from the page). */
    init(rid: string, s: 1 | 2 | null, state: GameState) {
      roomId = rid;
      seat = s;
      serverState = state;
    },

    /** Pull latest state from the server (used for polling). */
    async poll(): Promise<void> {
      if (!roomId) return;
      const res = await fetch(`/api/game/${roomId}`);
      if (res.ok) serverState = await res.json();
    },

    // ── Reactive getters ────────────────────────────────────────────────────

    get seat() { return seat; },
    get grid() { return serverState?.grid ?? emptyGrid; },
    get player1Hand() { return serverState?.player1Hand ?? []; },
    get player2Hand() { return serverState?.player2Hand ?? []; },
    get drawPile() { return serverState?.drawPile ?? []; },
    get discardPile() { return serverState?.discardPile ?? []; },
    get cardSlots() { return serverState?.cardSlots ?? {}; },
    get currentPlayer() { return serverState?.currentPlayer ?? 1; },
    get pendingDiePlacement() { return serverState?.pendingDiePlacement ?? null; },
    get pendingSteal() { return serverState?.pendingSteal ?? false; },
    get actionsRemaining(): 1 | 2 { return serverState?.actionsRemaining ?? 2; },
    get usedSlotThisTurn() { return serverState?.usedSlotThisTurn ?? null; },
    get gamePhase() { return serverState?.phase ?? 'playing'; },
    get player2Joined() { return serverState?.player2Joined ?? false; },
    get player1Name() { return serverState?.player1Name ?? 'Player 1'; },
    get player2Name() { return serverState?.player2Name ?? 'Player 2'; },
    playerName(p: 1 | 2) { return p === 1 ? (serverState?.player1Name ?? 'Player 1') : (serverState?.player2Name ?? 'Player 2'); },
    get eventLog() { return serverState?.eventLog ?? []; },
    get scores1(): Scores { return serverState?.scores1 ?? _emptyScores(); },
    get scores2(): Scores { return serverState?.scores2 ?? _emptyScores(); },
    get rematchRequestedBy() { return serverState?.rematchRequestedBy ?? null; },
    get rematchRoomId() { return serverState?.rematchRoomId ?? null; },
    get hoverHighlight() { return hoverHighlight; },
    setHoverHighlight(h: HoverHighlight) { hoverHighlight = h; },
    get tooltipText() { return tooltipText; },
    setTooltip(text: string | null) { tooltipText = text; },
    get selectedCard() { return selectedCard; },

    // ── Client-only selection ───────────────────────────────────────────────

    selectCard(player: 1 | 2, card: Card) {
      if (serverState?.pendingDiePlacement) return;
      if (player !== serverState?.currentPlayer) return;
      selectedCard = selectedCard?.card.id === card.id ? null : { player, card };
    },

    deselectCard() {
      selectedCard = null;
    },

    // ── Validation helpers (pure, use server state) ─────────────────────────

    canPlayToEdge(player: 1 | 2, edge: Edge): boolean {
      return canPlayToEdge(player, edge);
    },

    isValidStackOrder(edge: Edge, index: 0 | 1 | 2, card: Card): boolean {
      return isValidStackOrder(serverState?.cardSlots ?? {}, edge, index, card);
    },

    isCellValidForDiePlacement(row: number, col: number): boolean {
      const pending = serverState?.pendingDiePlacement;
      if (!pending) return false;
      return isCellValidForDiePlacement(serverState?.grid ?? emptyGrid, pending, row, col);
    },

    isCellNoPlacementWarning(row: number, col: number): boolean {
      if (!selectedCard || !serverState) return false;
      return _isCellNoPlacementWarning(
        serverState.grid,
        serverState.cardSlots,
        selectedCard.card,
        selectedCard.player,
        row,
        col,
      );
    },

    // ── Actions (send to server) ────────────────────────────────────────────

    async playCardToSlot(edge: Edge, index: 0 | 1 | 2) {
      if (!selectedCard || serverState?.pendingDiePlacement) return;
      const card = selectedCard.card;
      selectedCard = null;
      await sendAction({ type: 'PLAY_CARD', card, edge, index });
    },

    async placeDieOnCell(row: number, col: number) {
      await sendAction({ type: 'PLACE_DIE', row, col });
    },

    async drawToSix() {
      if (serverState?.pendingDiePlacement) return;
      selectedCard = null;
      await sendAction({ type: 'DRAW_TO_SIX' });
    },

    async cancelTurn() {
      await sendAction({ type: 'CANCEL_PLAY' });
    },

    async stealCard(cardId: string) {
      await sendAction({ type: 'STEAL_CARD', cardId });
    },

    async discardAndDraw(cardIds: string[]) {
      selectedCard = null;
      await sendAction({ type: 'DISCARD_AND_DRAW', cardIds });
    },

    /** Save the seated player's display name to the server. */
    async setName(name: string): Promise<void> {
      if (!roomId || seat === null) return;
      const res = await fetch(`/api/game/${roomId}/name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: seat, name }),
      });
      if (res.ok) serverState = await res.json();
    },

    /** Request or accept a rematch. Returns the new roomId if the rematch is ready. */
    async rematch(): Promise<string | null> {
      if (!roomId || seat === null) return null;
      const res = await fetch(`/api/game/${roomId}/rematch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: seat }),
      });
      if (res.ok) {
        serverState = await res.json();
        return serverState?.rematchRoomId ?? null;
      }
      return null;
    },

    /** Called by seat-2 page on mount to signal P2 has joined. */
    async joinGame(): Promise<void> {
      if (!roomId) return;
      const res = await fetch(`/api/game/${roomId}/join`, { method: 'POST' });
      if (res.ok) serverState = await res.json();
    },

    /** Legacy single-draw no longer used; kept so DrawPile doesn't break at compile time. */
    drawCard() {
      return this.drawToSix();
    },
  };
}

export const gameStore = createGameStore();
