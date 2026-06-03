import { json, error } from '@sveltejs/kit';
import { applyAction, type Action } from '$lib/gameLogic';
import { loadGame, saveGame } from '$lib/server/storage';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, platform }) => {
  const body = await request.json() as { player: 1 | 2; action: Action };
  const { player, action } = body;

  const kv = platform!.env.GAME_STORE;
  const state = await loadGame(kv, params.roomId);
  if (!state) error(404, 'Game not found');

  const result = applyAction(state, player, action);
  if (result.error) error(400, result.error);

  // The human's move returns immediately. In an AI game the client paces the bot's
  // reply via /ai-step so each move is delayed/visible, rather than resolving here.
  await saveGame(kv, result.state);
  return json(result.state);
};
