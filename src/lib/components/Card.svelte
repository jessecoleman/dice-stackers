<script lang="ts">
  import { type Card, type Orientation } from '$lib/gameStore.svelte';

  let {
    card,
    orientation = 0,
    faceDown = false,
    selected = false,
    onplay,
  }: {
    card: Card;
    orientation?: Orientation;
    faceDown?: boolean;
    selected?: boolean;
    onplay?: (card: Card) => void;
  } = $props();

  const suitSymbol: Record<string, string> = {
    red:    '♥',
    green:  '♣',
    yellow: '★',
    blue:   '♦',
  };

  // faces[0] is the LIGHT face, faces[1] the DARK face (same colour, different value).
  const lightColor: Record<string, string> = {
    red:    '#e07a7a',
    green:  '#5cb88a',
    yellow: '#e3c069',
    blue:   '#74a6f0',
  };
  const darkColor: Record<string, string> = {
    red:    '#7a1c1c',
    green:  '#16472e',
    yellow: '#7d6410',
    blue:   '#1c3c84',
  };

</script>

<!-- A corner label: the face's rank + suit symbol. Both faces share a rank now, so
     there's no separate "other rank" shown. -->
{#snippet label(face: { suit: string; value: number })}
  <span class="corner-line">
    <span class="corner-value">{face.value}</span>
    <span class="corner-symbol">{suitSymbol[face.suit]}</span>
  </span>
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="card"
  class:face-down={faceDown}
  class:selected
  onclick={() => onplay?.(card)}
>
  {#if faceDown}
    <div class="card-back">
      <span class="back-symbol">★</span>
    </div>
  {:else}
    <!-- Point-symmetric dual card: face[0] fills the top-left end (upright),
         face[1] the bottom-right end (rotated 180°). Toggling orientation spins
         the whole card 180° on Z, swapping which end is active/upright. -->
    <div class="spinner" style="transform: rotate({orientation === 1 ? 180 : 0}deg)">
      <div class="card-face">
        <div class="half up" style="background: {lightColor[card.faces[0].suit]}">
          <span class="corner up-corner">{@render label(card.faces[0])}</span>
        </div>
        <div class="half down" style="background: {darkColor[card.faces[1].suit]}">
          <span class="corner down-corner">{@render label(card.faces[1])}</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .card {
    width: var(--card-w, 64px);
    height: var(--card-h, 92px);
    border-radius: 8px;
    cursor: pointer;
    flex-shrink: 0;
    user-select: none;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    position: relative;
  }

  /* In-plane spin wrapper: rotates 180° on Z to swap which end is active */
  .spinner {
    position: absolute;
    inset: 0;
    transition: transform 0.45s cubic-bezier(0.4, 0.1, 0.2, 1);
  }

  .card.face-down {
    cursor: default;
    pointer-events: none;
  }

  .card:not(.face-down):hover {
    transform: translateY(-12px) scale(1.05);
    z-index: 20;
  }

  .card.selected {
    transform: translateY(-16px) scale(1.08);
    z-index: 30;
    filter: drop-shadow(0 0 6px #ffd700) drop-shadow(0 0 12px #ffd700);
  }

  /* Dual-face: split by a shallow (~30°) diagonal running low-left → high-right.
     The seam crosses the left edge at 70% and the right edge at 30%. A thin gap
     between the two clipped halves reveals the dark card-face beneath as a seam. */
  .card-face {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(0,0,0,0.45);
    box-shadow: 0 2px 8px rgba(0,0,0,0.35), inset 0 0 0 2px rgba(0,0,0,0.2);
  }

  .half {
    position: absolute;
    inset: 0;
  }

  /* Active face: upper region (left edge down to 69%, right edge to 29%) */
  .half.up   { clip-path: polygon(0 0, 100% 0, 100% 29%, 0 69%); }
  /* Inactive face: lower region (left edge from 71%, right edge from 31%) */
  .half.down { clip-path: polygon(0 71%, 100% 31%, 100% 100%, 0 100%); }

  .corner {
    position: absolute;
    display: flex;
    align-items: baseline;
    gap: 1px;
  }

  /* Top-left end: the active face's label */
  .up-corner {
    top: 4px;
    left: 5px;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
  }
  /* Bottom-right end is the 180°-rotated face; its label is counter-rotated so it
     reads upright after the card is spun. */
  .down-corner {
    bottom: 4px;
    right: 5px;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    transform: rotate(180deg);
    transform-origin: center;
  }

  .corner-line {
    display: flex;
    align-items: baseline;
    gap: 1px;
  }

  .corner-value {
    font-size: var(--card-val-size, 19px);
    font-weight: 700;
    color: rgba(255,255,255,0.97);
    font-family: Georgia, serif;
    line-height: 1;
    text-shadow: 0 1px 3px rgba(0,0,0,0.5);
  }

  .corner-symbol {
    font-size: var(--card-sym-size, 16px);
    color: rgba(255,255,255,0.88);
    line-height: 1;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  }

  /* Back */
  .card-back {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 8px;
    background: #2a3550;
    box-shadow: 0 2px 8px rgba(0,0,0,0.35), inset 0 0 0 2px rgba(0,0,0,0.2);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .back-symbol {
    position: relative;
    z-index: 1;
    font-size: 26px;
    color: rgba(255,255,255,0.5);
    filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6));
  }

</style>
