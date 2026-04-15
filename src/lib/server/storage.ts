import type { GameState } from '$lib/gameLogic';

export async function loadGame(kv: KVNamespace, roomId: string): Promise<GameState | null> {
  const text = await kv.get(`game:${roomId}`);
  return text ? (JSON.parse(text) as GameState) : null;
}

export async function saveGame(kv: KVNamespace, state: GameState): Promise<void> {
  await kv.put(`game:${state.roomId}`, JSON.stringify(state));
}

export function generateRoomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}
