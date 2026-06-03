import { json } from '@sveltejs/kit';
import { createInitialState } from '$lib/gameLogic';
import { saveGame, generateRoomId } from '$lib/server/storage';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
  const vsAI = await request.json()
    .then(b => !!(b as { vsAI?: boolean })?.vsAI)
    .catch(() => false);

  const roomId = generateRoomId();
  const state = createInitialState(roomId);
  if (vsAI) {
    // Seat 2 is the bot: mark it joined so the game starts immediately, no share link.
    state.vsAI = true;
    state.player2Joined = true;
    state.player2Name = 'Computer';
  }
  await saveGame(platform!.env.GAME_STORE, state);
  return json({ roomId });
};
