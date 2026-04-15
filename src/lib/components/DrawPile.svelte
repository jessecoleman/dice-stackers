<script lang="ts">
  import { gameStore } from '$lib/gameStore.svelte';

  const remaining = $derived(gameStore.drawPile.length);
  const canDraw   = $derived(remaining > 0);

  // Stack visual offsets for the top few cards
  const STACK_LAYERS = 4;
</script>

<div class="draw-pile-area">
  <div class="pile-label">Draw Pile</div>

  <button
    class="pile"
    class:empty={!canDraw}
    onclick={() => gameStore.drawToSix()}
    disabled={!canDraw}
    title={canDraw ? 'Draw a card' : 'Pile is empty'}
  >
    <!-- Stacked card backs for depth -->
    {#each Array.from({ length: Math.min(STACK_LAYERS, remaining) }) as _, i}
      <div
        class="pile-card"
        style="bottom: {i * 2.5}px; left: {i * -1}px;"
      >
        <div class="back-pattern"></div>
      </div>
    {/each}

    {#if canDraw}
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

  .pile-card {
    position: absolute;
    width: 64px;
    height: 92px;
    border-radius: 8px;
    background: #1e3a5f;
    border: 1px solid #2d5a8e;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    overflow: hidden;
    transition: transform 0.15s;
  }

  .pile:not(.empty):hover .pile-card:last-of-type {
    transform: translateY(-4px);
  }

  .back-pattern {
    width: 100%;
    height: 100%;
    background-image:
      repeating-linear-gradient(
        45deg,
        rgba(255,255,255,0.05) 0px,
        rgba(255,255,255,0.05) 2px,
        transparent 2px,
        transparent 8px
      ),
      repeating-linear-gradient(
        -45deg,
        rgba(255,255,255,0.05) 0px,
        rgba(255,255,255,0.05) 2px,
        transparent 2px,
        transparent 8px
      );
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
