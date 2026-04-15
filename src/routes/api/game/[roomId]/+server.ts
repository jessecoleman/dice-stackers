import { json, error } from '@sveltejs/kit';
import { loadGame } from '$lib/server/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
  const state = await loadGame(platform!.env.GAME_STORE, params.roomId);
  if (!state) error(404, 'Game not found');
  return json(state);
};
