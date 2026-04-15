import { json, error } from '@sveltejs/kit';
import { loadGame, saveGame } from '$lib/server/storage';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params }) => {
  const state = await loadGame(params.roomId);
  if (!state) error(404, 'Game not found');
  if (!state.player2Joined) {
    state.player2Joined = true;
    state.updatedAt = Date.now();
    await saveGame(state);
  }
  return json(state);
};
