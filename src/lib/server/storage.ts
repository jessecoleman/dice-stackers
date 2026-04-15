import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { GameState } from '$lib/gameLogic';

const DATA_DIR = path.join(process.cwd(), 'data', 'games');

function gamePath(roomId: string): string {
  return path.join(DATA_DIR, `${roomId}.json`);
}

export async function loadGame(roomId: string): Promise<GameState | null> {
  try {
    const text = await readFile(gamePath(roomId), 'utf-8');
    return JSON.parse(text) as GameState;
  } catch {
    return null;
  }
}

export async function saveGame(state: GameState): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
  await writeFile(gamePath(state.roomId), JSON.stringify(state));
}

export function generateRoomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}
