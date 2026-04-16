<script lang="ts">
  import type { Card } from '$lib/gameStore.svelte';

  let {
    card,
    flipped = false,
    faceDown = false,
    selected = false,
    onplay,
  }: {
    card: Card;
    flipped?: boolean;
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

  const suitColor: Record<string, string> = {
    red:    '#e53e3e',
    green:  '#38a169',
    yellow: '#d69e2e',
    blue:   '#3b82f6',
  };

  const symbol = $derived(suitSymbol[card.suit]);
  const color  = $derived(suitColor[card.suit]);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="card"
  class:flipped
  class:face-down={faceDown}
  class:selected
  onclick={() => onplay?.(card)}
  style="--suit-color: {color}"
>
  {#if faceDown}
    <div class="card-back" style="background: {color}">
      <span class="back-symbol">{symbol}</span>
    </div>
  {:else}
    <div class="card-face">
      <span class="center-value">{card.value}</span>
      <span class="center-symbol">{symbol}</span>
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

  .card.flipped {
    transform: rotate(180deg);
  }

  .card.flipped:hover {
    transform: rotate(180deg) translateY(-12px) scale(1.05);
  }

  .card.flipped.selected {
    transform: rotate(180deg) translateY(-16px) scale(1.08);
  }

  /* Face */
  .card-face {
    width: 100%;
    height: 100%;
    border-radius: 8px;
    background: var(--suit-color);
    box-shadow: 0 2px 8px rgba(0,0,0,0.35), inset 0 0 0 2px rgba(0,0,0,0.2);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }

  .center-value {
    font-size: var(--card-val-size, 28px);
    font-weight: 700;
    color: rgba(255,255,255,0.95);
    font-family: Georgia, serif;
    line-height: 1;
    text-shadow: 0 2px 6px rgba(0,0,0,0.45);
  }

  .center-symbol {
    font-size: var(--card-sym-size, 18px);
    color: rgba(255,255,255,0.85);
    line-height: 1;
    text-shadow: 0 1px 4px rgba(0,0,0,0.45);
  }

  /* Back */
  .card-back {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 8px;
    background: var(--suit-color);
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
    filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6));
  }

</style>
