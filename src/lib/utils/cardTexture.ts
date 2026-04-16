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

  // Radial gradient overlay: lighter centre for dark text, darker centre for light text
  const isLight = textColor === '#ffffff' || textColor.toLowerCase() === '#fff';
  const grad = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.6);
  if (isLight) {
    grad.addColorStop(0, 'rgba(0,0,0,0.18)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
  } else {
    grad.addColorStop(0, 'rgba(255,255,255,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  ctx.fillStyle = textColor;
  ctx.font = 'bold 92px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), S / 2, S / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Generates a procedural wood-grain canvas texture for the board surface.
 */
export function createWoodTexture(): THREE.CanvasTexture {
  const W = 1024, H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Base warm brown
  ctx.fillStyle = '#5c3d1a';
  ctx.fillRect(0, 0, W, H);

  // Grain lines — wavy horizontals varying in brightness, width, and amplitude
  const lineCount = 140;
  for (let i = 0; i < lineCount; i++) {
    const baseY = (i / lineCount) * H;

    // Pseudo-random variation seeded from i
    const seed1 = (i * 73)  % 100 / 100;
    const seed2 = (i * 137) % 100 / 100;
    const isLight = (i * 31) % 7 > 3;

    const r = isLight ? Math.round(105 + seed1 * 35) : Math.round(35 + seed1 * 22);
    const g = isLight ? Math.round(68  + seed1 * 22) : Math.round(22 + seed1 * 14);
    const b = isLight ? Math.round(24  + seed1 * 10) : Math.round(7  + seed1 * 6);
    const a = isLight ? 0.15 + seed2 * 0.18 : 0.18 + seed2 * 0.22;

    ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
    ctx.lineWidth   = 0.5 + (i % 4) * 0.35;
    ctx.beginPath();

    const freq1  = 1 + (i % 5) * 0.28;
    const freq2  = 2.3 + (i % 3) * 0.6;
    const amp1   = 2 + (i % 7);
    const amp2   = 1 + (i % 3) * 0.6;
    const phase  = (i * 1.618) % (Math.PI * 2);

    for (let x = 0; x <= W; x += 3) {
      const t = x / W;
      const wave = Math.sin(t * Math.PI * 2 * freq1 + phase) * amp1
                 + Math.sin(t * Math.PI * 2 * freq2 + phase * 1.4) * amp2;
      if (x === 0) ctx.moveTo(x, baseY + wave);
      else          ctx.lineTo(x, baseY + wave);
    }
    ctx.stroke();
  }

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
