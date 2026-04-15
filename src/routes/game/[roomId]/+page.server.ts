import { error } from '@sveltejs/kit';
import { loadGame } from '$lib/server/storage';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, platform }) => {
  const state = await loadGame(platform!.env.GAME_STORE, params.roomId);
  if (!state) error(404, 'Game not found');

  const seatParam = url.searchParams.get('seat');
  const seat = (seatParam === '1' ? 1 : seatParam === '2' ? 2 : null) as 1 | 2 | null;

  return { state, seat, roomId: params.roomId };
};
