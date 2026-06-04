import * as THREE from 'three';
import type { Face } from '$lib/gameStore.svelte';

const SUIT_SYMBOL: Record<string, string> = {
  red:    '♥',
  green:  '♣',
  yellow: '★',
  blue:   '♦',
};

// Light / dark shade palettes per colour (deeper than the 2D card for unlit 3D, so
// white text keeps contrast). faces[0] is the light face, faces[1] the dark one.
const LIGHT_BG: Record<string, string> = {
  red:    '#c85a5a',
  green:  '#3d8a62',
  yellow: '#c79a3a',
  blue:   '#4a78c8',
};
const DARK_BG: Record<string, string> = {
  red:    '#6e1818',
  green:  '#14402a',
  yellow: '#6e4a0c',
  blue:   '#163576',
};

/**
 * Renders a card onto a canvas and returns a CanvasTexture. The active (up) face
 * fills the upper region, the inactive (down) face the lower, split by a shallow
 * diagonal. Each region is tinted by its shade — `upIsLight` says whether the up
 * face is the light one (so the down face is the opposite shade).
 * Caller is responsible for calling texture.dispose() when done.
 */
export function createCardTexture(up: Face, down: Face, upIsLight: boolean): THREE.CanvasTexture {
  const W = 128;
  const H = 180;
  // Seam crosses the left edge at 70% height and the right edge at 30%.
  const yL = 0.70 * H;
  const yR = 0.30 * H;
  const GAP = 1.5; // half-thickness of the dark seam between the two halves

  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Dark base (shows through the seam)
  ctx.fillStyle = '#1a1a1a';
  roundRect(ctx, 0, 0, W, H, 12);
  ctx.fill();

  // Clip everything to the rounded-rect card outline
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 12);
  ctx.clip();

  function setShadow(blur: number, offsetY = 1) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = offsetY;
  }
  function clearShadow() {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  // Draw one triangular half filled with its shade colour + a corner label.
  function half(face: Face, region: [number, number][], corner: 'tl' | 'br', bg: string) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(region[0][0], region[0][1]);
    for (let i = 1; i < region.length; i++) ctx.lineTo(region[i][0], region[i][1]);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Corner label: value + suit symbol
    const val = String(face.value);
    setShadow(4, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.font = 'bold 30px Georgia, serif';
    if (corner === 'tl') {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(val, 11, 9);
      const w = ctx.measureText(val).width;
      ctx.font = '22px Georgia, serif';
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillText(SUIT_SYMBOL[face.suit], 11 + w + 3, 13);
    } else {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.font = '22px Georgia, serif';
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillText(SUIT_SYMBOL[face.suit], W - 11, H - 11);
      const w = ctx.measureText(SUIT_SYMBOL[face.suit]).width;
      ctx.font = 'bold 30px Georgia, serif';
      ctx.fillStyle = 'rgba(255,255,255,0.97)';
      ctx.fillText(val, W - 11 - w - 3, H - 9);
    }
    clearShadow();
    ctx.restore();
  }

  // Active (up) face: upper region; Inactive (down): lower region. GAP leaves a seam.
  // Tint each by its shade (up is light/dark per `upIsLight`; down is the opposite).
  const upBg   = (upIsLight ? LIGHT_BG : DARK_BG)[up.suit];
  const downBg = (upIsLight ? DARK_BG : LIGHT_BG)[down.suit];
  half(up,   [[0, 0], [W, 0], [W, yR - GAP], [0, yL - GAP]], 'tl', upBg);
  half(down, [[0, yL + GAP], [W, yR + GAP], [W, H], [0, H]], 'br', downBg);

  ctx.restore();

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
