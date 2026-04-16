<script lang="ts">
  import { gameStore } from '$lib/gameStore.svelte';
  import Card from './Card.svelte';

  const remaining  = $derived(gameStore.drawPile.length);
  const myHand     = $derived(gameStore.seat === 2 ? gameStore.player2Hand : gameStore.player1Hand);
  const handFull   = $derived(myHand.length >= 6);
  const canDraw    = $derived(remaining > 0 && !handFull);

  const STACK_LAYERS = 4;
  const topCards = $derived(gameStore.drawPile.slice(0, STACK_LAYERS));
</script>

<div class="draw-pile-area">
  <div class="pile-label">Draw Pile</div>

  <button
    class="pile"
    class:empty={!remaining}
    class:disabled={!canDraw}
    onclick={() => gameStore.drawToSix()}
    disabled={!canDraw}
    title={!remaining ? 'Pile is empty' : handFull ? 'Hand is full' : 'Draw up to 6 cards'}
  >
    <!-- Stacked card backs for depth -->
    {#each topCards as card, i}
      <div class="pile-card" style="bottom: {i * 2.5}px; left: {i * -1}px;">
        <Card {card} faceDown={true} />
      </div>
    {/each}

    {#if remaining}
      <div class="count-badge">{remaining}</div>
    {:else}
      <div class="empty-label">Empty</div>
    {/if}
  </button>
</div>

<style>
  .draw-pile-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .pile-label {
    font-size: 11px;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .pile {
    position: relative;
    width: 64px;
    height: 92px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .pile.empty {
    cursor: default;
    opacity: 0.4;
  }

  .pile.disabled:not(.empty) {
    cursor: default;
    opacity: 0.6;
  }

  .pile-card {
    position: absolute;
    width: 64px;
    height: 92px;
    transition: transform 0.15s;
  }

  .pile:not(.empty):not(.disabled):hover .pile-card:last-of-type {
    transform: translateY(-4px);
  }


  .count-badge {
    position: absolute;
    bottom: -8px;
    right: -8px;
    background: #ffd700;
    color: #1a1a1a;
    font-size: 11px;
    font-weight: 700;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    z-index: 10;
  }

  .empty-label {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: #555;
  }
</style>
