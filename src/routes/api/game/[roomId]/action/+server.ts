import { json, error } from '@sveltejs/kit';
import { applyAction, type Action } from '$lib/gameLogic';
import { loadGame, saveGame } from '$lib/server/storage';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
  const body = await request.json() as { player: 1 | 2; action: Action };
  const { player, action } = body;

  const state = await loadGame(params.roomId);
  if (!state) error(404, 'Game not found');

  const result = applyAction(state, player, action);
  if (result.error) error(400, result.error);

  await saveGame(result.state);
  return json(result.state);
};
