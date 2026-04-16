import { json, error } from '@sveltejs/kit';
import { loadGame, saveGame, generateRoomId } from '$lib/server/storage';
import { createInitialState } from '$lib/gameLogic';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, platform }) => {
  const kv = platform!.env.GAME_STORE;
  const { player } = await request.json() as { player: 1 | 2 };

  const state = await loadGame(kv, params.roomId);
  if (!state) error(404, 'Game not found');
  if (state.phase !== 'game-over') error(400, 'Game is not over');

  // Already paired — nothing to do
  if (state.rematchRoomId) return json(state);

  // This player already voted — nothing to do
  if (state.rematchRequestedBy === player) return json(state);

  if (!state.rematchRequestedBy) {
    // First request: record and wait for the other player
    state.rematchRequestedBy = player;
    state.updatedAt = Date.now();
    await saveGame(kv, state);
    return json(state);
  }

  // Both players have now requested — create the rematch room
  // Swap seats: old P1 → new P2, old P2 → new P1 (fairness)
  const newRoomId = generateRoomId();
  const newState = createInitialState(newRoomId);
  newState.player1Name = state.player2Name;
  newState.player2Name = state.player1Name;
  await saveGame(kv, newState);

  state.rematchRoomId = newRoomId;
  state.updatedAt = Date.now();
  await saveGame(kv, state);

  return json(state);
};
