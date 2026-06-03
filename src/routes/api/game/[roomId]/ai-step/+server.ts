import { json, error } from '@sveltejs/kit';
import { stepAI } from '$lib/ai';
import { loadGame, saveGame } from '$lib/server/storage';
import type { RequestHandler } from './$types';

// Advance an AI game by a single bot move. The client polls this on a delay so
// each move is paced; a no-op (returns state unchanged) when it's not the AI's turn.
export const POST: RequestHandler = async ({ params, platform }) => {
  const kv = platform!.env.GAME_STORE;
  const state = await loadGame(kv, params.roomId);
  if (!state) error(404, 'Game not found');

  const next = stepAI(state);
  if (next !== state) await saveGame(kv, next);
  return json(next);
};
