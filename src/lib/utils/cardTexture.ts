import * as THREE from 'three';
import type { Card } from '$lib/gameStore.svelte';

const SUIT_SYMBOL: Record<string, string> = {
  red:    '♥',
  green:  '♣',
  yellow: '★',
  blue:   '♦',
};

const SUIT_BG: Record<string, string> = {
  red:    '#e53e3e',
  green:  '#38a169',
  yellow: '#d69e2e',
  blue:   '#3b82f6',
};

/**
 * Renders a playing-card face onto a canvas and returns a CanvasTexture.
 * Caller is responsible for calling texture.dispose() when done.
 */
export function createCardTexture(card: Card): THREE.CanvasTexture {
  const W = 128;
  const H = 180;

  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d')!;
  const bg  = SUIT_BG[card.suit];
  const sym = SUIT_SYMBOL[card.suit];
  const val = String(card.value);

  // Solid colour fill
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 12);
  ctx.fill();

  // Shadow helper
  function setShadow(blur: number, offsetY = 1) {
    ctx.shadowColor  = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur   = blur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = offsetY;
  }
  function clearShadow() {
    ctx.shadowColor  = 'transparent';
    ctx.shadowBlur   = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // Large number
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = 'bold 72px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  setShadow(6, 2);
  ctx.fillText(val, W / 2, H / 2 - 16);

  // Suit symbol below the number
  ctx.font = '38px Georgia, serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  setShadow(5, 2);
  ctx.fillText(sym, W / 2, H / 2 + 38);
  clearShadow();

  // Top-left corner label (value + suit side by side)
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = 'bold 30px Georgia, serif';
  ctx.textAlign = 'left';
  setShadow(4, 1);
  ctx.fillText(val, 10, 8);
  const valWidth = ctx.measureText(val).width;
  ctx.font = '24px Georgia, serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(sym, 10 + valWidth + 3, 11);
  clearShadow();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Renders a single bold numeral onto a square canvas and returns a CanvasTexture.
 * Used for the top face of 3D dice so the font matches the card faces exactly.
 */
export function createDieLabelTexture(value: number, textColor: string): THREE.CanvasTexture {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width  = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  // Transparent background — the die body colour shows through
  ctx.clearRect(0, 0, S, S);

  const isLight = textColor === '#ffffff' || textColor.toLowerCase() === '#fff';
  ctx.shadowColor   = isLight ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.4)';
  ctx.shadowBlur    = 4;
  ctx.shadowOffsetY = isLight ? 1 : -1;

  ctx.fillStyle = textColor;
  ctx.font = 'bold 80px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), S / 2, S / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type Radii = number | { tl: number; tr: number; br: number; bl: number };

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  radii: Radii,
) {
  const r = typeof radii === 'number'
    ? { tl: radii, tr: radii, br: radii, bl: radii }
    : radii;

  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.quadraticCurveTo(x + w, y,         x + w,     y + r.tr);
  ctx.lineTo(x + w,         y + h - r.br);
  ctx.quadraticCurveTo(x + w, y + h,     x + w - r.br, y + h);
  ctx.lineTo(x + r.bl,      y + h);
  ctx.quadraticCurveTo(x,   y + h,       x,         y + h - r.bl);
  ctx.lineTo(x,             y + r.tl);
  ctx.quadraticCurveTo(x,   y,           x + r.tl,  y);
  ctx.closePath();
}
