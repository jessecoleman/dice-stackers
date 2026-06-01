import {
  suits,
  isValidLead,
  isValidFollow,
  stackHasRoom,
  slotKey,
  edgeFor,
  intersectionCell,
  upFace,
  beats,
  finalScore,
  currentRound,
  type Suit,
  type Die,
  type CellStack,
  type Card,
  type PlacedCard,
  type Face,
  type Orientation,
  type Edge,
  type Axis,
  type ColorPoints,
  type GameState,
  type EventLogEntry,
  type Action,
  PLAYER_EDGES,
} from '$lib/gameLogic';

export { suits, PLAYER_EDGES, slotKey, edgeFor, upFace, beats, finalScore };
export type { Suit, Die, CellStack, Card, PlacedCard, Face, Orientation, Edge, Axis, ColorPoints, GameState, EventLogEntry };

// ── Store ─────────────────────────────────────────────────────────────────────

type HoverHighlight =
  | { type: 'cell'; row: number; col: number; dieId?: string }
  | { type: 'slot'; edge: Edge; index: 0 | 1 | 2 }
  | { type: 'cells'; cells: Array<{ row: number; col: number }> }
  | null;

function createGameStore() {
  let serverState = $state<GameState | null>(null);
  let selectedCard = $state<{ player: 1 | 2; card: Card; orientation: Orientation } | null>(null);
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
    get cardSlots() { return serverState?.cardSlots ?? {}; },
    get currentPlayer() { return serverState?.currentPlayer ?? 1; },
    get trick() { return serverState?.trick ?? null; },
    /** True when the current player must lead (no trick in progress). */
    get isLeading() { return (serverState?.trick ?? null) === null; },
    get gamePhase() { return serverState?.phase ?? 'playing'; },
    get round() { return serverState ? currentRound(serverState) : 1; },
    get player1Score() { return serverState?.player1Score ?? { red: 0, green: 0, blue: 0 }; },
    get player2Score() { return serverState?.player2Score ?? { red: 0, green: 0, blue: 0 }; },
    scoreOf(p: 1 | 2): ColorPoints { return p === 1 ? this.player1Score : this.player2Score; },
    finalScoreOf(p: 1 | 2): number { return finalScore(this.scoreOf(p)); },
    get player2Joined() { return serverState?.player2Joined ?? false; },
    get player1Name() { return serverState?.player1Name ?? 'Player 1'; },
    get player2Name() { return serverState?.player2Name ?? 'Player 2'; },
    playerName(p: 1 | 2) { return p === 1 ? (serverState?.player1Name ?? 'Player 1') : (serverState?.player2Name ?? 'Player 2'); },
    get eventLog() { return serverState?.eventLog ?? []; },
    get rematchRequestedBy() { return serverState?.rematchRequestedBy ?? null; },
    get rematchRoomId() { return serverState?.rematchRoomId ?? null; },
    get hoverHighlight() { return hoverHighlight; },
    setHoverHighlight(h: HoverHighlight) { hoverHighlight = h; },
    get tooltipText() { return tooltipText; },
    setTooltip(text: string | null) { tooltipText = text; },
    get selectedCard() { return selectedCard; },

    // ── Client-only selection ───────────────────────────────────────────────

    selectCard(player: 1 | 2, card: Card) {
      if (player !== serverState?.currentPlayer) return;
      // Toggle off if re-clicking the same card; default orientation 0 on select.
      selectedCard = selectedCard?.card.id === card.id ? null : { player, card, orientation: 0 };
    },

    /** Currently-chosen face of the selected card (which side is up). */
    get selectedOrientation(): Orientation { return selectedCard?.orientation ?? 0; },

    /** Flip which face of the selected card is up. */
    flipSelected() {
      if (selectedCard) selectedCard = { ...selectedCard, orientation: selectedCard.orientation === 0 ? 1 : 0 };
    },

    deselectCard() {
      selectedCard = null;
    },

    // ── Validation helpers (pure, use server state) ─────────────────────────

    /** Can the selected card (at its chosen orientation) legally be played into this axis-stack? */
    canPlayToStack(axis: Axis, line: 0 | 1 | 2): boolean {
      if (!selectedCard || !serverState) return false;
      const { card, orientation } = selectedCard;
      return serverState.trick
        ? isValidFollow(serverState, card, orientation, axis, line)
        : isValidLead(serverState, axis, line);
    },

    stackHasRoom(player: 1 | 2, axis: Axis, line: 0 | 1 | 2): boolean {
      if (!serverState) return false;
      return stackHasRoom(serverState, player, axis, line);
    },

    /** Cell where a follow play into (axis,line) would drop its die, or null when leading. */
    followCell(line: 0 | 1 | 2): { row: number; col: number } | null {
      if (!serverState?.trick) return null;
      return intersectionCell(serverState.trick.axis, serverState.trick.line, line);
    },

    // ── Actions (send to server) ────────────────────────────────────────────

    /** Play the selected card (at its chosen orientation) into an axis-stack. */
    async playCard(axis: Axis, line: 0 | 1 | 2) {
      if (!selectedCard) return;
      const { card, orientation } = selectedCard;
      selectedCard = null;
      await sendAction({ type: 'PLAY_CARD', card, orientation, axis, line });
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

    /** Legacy no-op: drawing is now automatic (hands refill after each trick). */
    drawCard() {},
  };
}

export const gameStore = createGameStore();
