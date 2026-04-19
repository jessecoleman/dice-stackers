<script lang="ts">
  import { gameStore } from '$lib/gameStore.svelte';
  import Card from './Card.svelte';
  import emptyStackUrl from '$lib/assets/empty-stack.svg?url';

  const drawRemaining  = $derived(gameStore.drawPile.length);
  const discardCount   = $derived(gameStore.discardPile.length);
  const topDiscard     = $derived(gameStore.discardPile[discardCount - 1] ?? null);

  const myHand  = $derived(gameStore.seat === 2 ? gameStore.player2Hand : gameStore.player1Hand);
  const handFull = $derived(myHand.length >= 6);
  const canDraw  = $derived(
    (drawRemaining > 0 || discardCount > 0) && !handFull
  );

  const STACK_LAYERS = 4;
  const topCards = $derived(gameStore.drawPile.slice(0, STACK_LAYERS));
</script>

<div class="piles-row">
  <!-- Draw pile -->
  <div class="pile-area">
    <div class="pile-label">Draw</div>
    <button
      class="pile"
      class:empty={!drawRemaining && !discardCount}
      class:disabled={!canDraw}
      onclick={() => gameStore.drawToSix()}
      disabled={!canDraw}
      title={!drawRemaining && !discardCount ? 'No cards left' : handFull ? 'Hand is full' : 'Draw up to 6 cards'}
    >
      {#each topCards as card, i}
        <div class="pile-card" style="bottom: {i * 2.5}px; left: {i * -1}px; z-index: {i};">
          <Card {card} faceDown={true} />
        </div>
      {/each}

      {#if drawRemaining}
        <div class="count-badge">{drawRemaining}</div>
      {:else}
        <img class="empty-placeholder" src={emptyStackUrl} alt="Empty" />
      {/if}
    </button>
  </div>

  <!-- Discard pile -->
  <div class="pile-area">
    <div class="pile-label">Discard</div>
    <div class="pile non-interactive" class:empty={!discardCount}>
      {#if topDiscard}
        <div class="pile-card" style="bottom: 0; left: 0; z-index: 1;">
          <Card card={topDiscard} faceDown={false} />
        </div>
        {#if discardCount > 1}
          <div class="count-badge">{discardCount}</div>
        {/if}
      {:else}
        <img class="empty-placeholder" src={emptyStackUrl} alt="Empty" />
      {/if}
    </div>
  </div>
</div>

<style>
  .piles-row {
    display: flex;
    flex-direction: row;
    gap: 10px;
    align-items: flex-start;
  }

  .pile-area {
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

  .pile.non-interactive {
    cursor: default;
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

  .pile:not(.empty):not(.disabled):not(.non-interactive):hover .pile-card:last-of-type {
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

  .empty-placeholder {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0.3;
  }
</style>
