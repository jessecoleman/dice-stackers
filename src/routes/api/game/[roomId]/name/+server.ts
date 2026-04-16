import { json, error } from '@sveltejs/kit';
import { loadGame, saveGame } from '$lib/server/storage';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, platform }) => {
  const { player, name } = await request.json() as { player: 1 | 2; name: string };
  const kv = platform!.env.GAME_STORE;
  const state = await loadGame(kv, params.roomId);
  if (!state) error(404, 'Game not found');

  if (player === 1) state.player1Name = name.trim() || 'Player 1';
  else              state.player2Name = name.trim() || 'Player 2';
  state.updatedAt = Date.now();

  await saveGame(kv, state);
  return json(state);
};
