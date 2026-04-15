import { json } from '@sveltejs/kit';
import { createInitialState } from '$lib/gameLogic';
import { saveGame, generateRoomId } from '$lib/server/storage';

export async function POST() {
  const roomId = generateRoomId();
  const state = createInitialState(roomId);
  await saveGame(state);
  return json({ roomId });
}
