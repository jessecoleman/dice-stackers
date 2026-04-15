import { json } from '@sveltejs/kit';
import { createInitialState } from '$lib/gameLogic';
import { saveGame, generateRoomId } from '$lib/server/storage';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ platform }) => {
  const roomId = generateRoomId();
  const state = createInitialState(roomId);
  await saveGame(platform!.env.GAME_STORE, state);
  return json({ roomId });
};
