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
  PLAYER_EDGES,
} from '$lib/gameLogic';

export { suits, PLAYER_EDGES };
export type { Suit, Die, CellStack, Card, Edge, GameState, EventLogEntry };

// ── Store ─────────────────────────────────────────────────────────────────────

type HoverHighlight =
  | { type: 'cell'; row: number; col: number }
  | { type: 'slot'; edge: Edge; index: 0 | 1 | 2 }
  | null;

function createGameStore() {
  let serverState = $state<GameState | null>(null);
  let selectedCard = $state<{ player: 1 | 2; card: Card } | null>(null);
  let roomId = $state<string | null>(null);
  let seat = $state<1 | 2 | null>(null);
  let hoverHighlight = $state<HoverHighlight>(null);

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
    get cardSlots() { return serverState?.cardSlots ?? {}; },
    get currentPlayer() { return serverState?.currentPlayer ?? 1; },
    get pendingDiePlacement() { return serverState?.pendingDiePlacement ?? null; },
    get gamePhase() { return serverState?.phase ?? 'playing'; },
    get player2Joined() { return serverState?.player2Joined ?? false; },
    get eventLog() { return serverState?.eventLog ?? []; },
    get hoverHighlight() { return hoverHighlight; },
    setHoverHighlight(h: HoverHighlight) { hoverHighlight = h; },
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
