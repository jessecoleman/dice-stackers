<script lang="ts">
  import { gameStore } from '$lib/gameStore.svelte';
  import Card from './Card.svelte';
  import emptyStackUrl from '$lib/assets/empty-stack.svg?url';
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';

  const drawRemaining  = $derived(gameStore.drawPile.length);
  const discardCount   = $derived(gameStore.discardPile.length);
  const topDiscard     = $derived(gameStore.discardPile[discardCount - 1] ?? null);

  const myHand  = $derived(gameStore.seat === 2 ? gameStore.player2Hand : gameStore.player1Hand);
  const handFull = $derived(myHand.length >= 6);
  const canDraw  = $derived(
    (drawRemaining > 0 || discardCount > 0) && !handFull
  );

  const STACK_LAYERS = 6;
  const topCards = $derived(gameStore.drawPile.slice(0, STACK_LAYERS));

  let showDiscardModal = $state(false);

  type SortMode = 'none' | 'suit-rank' | 'rank-suit';
  let discardSortMode = $state<SortMode>('none');
  const SUIT_ORDER: Record<string, number> = { red: 0, blue: 1, green: 2, yellow: 3 };

  const sortedDiscard = $derived.by(() => {
    const pile = [...gameStore.discardPile].reverse();
    if (discardSortMode === 'suit-rank') {
      return pile.sort((a, b) => SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || a.value - b.value);
    }
    if (discardSortMode === 'rank-suit') {
      return pile.sort((a, b) => a.value - b.value || SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit]);
    }
    return pile;
  });

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) showDiscardModal = false;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') showDiscardModal = false;
  }
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="piles-row">
  <!-- Draw pile -->
  <div class="pile-area">
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
    <div class="pile-label">Draw</div>
  </div>

  <!-- Discard pile -->
  <div class="pile-area">
    <button
      class="pile"
      class:empty={!discardCount}
      onclick={() => { if (discardCount) showDiscardModal = true; }}
      title={discardCount ? 'View discard pile' : 'Discard pile is empty'}
    >
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
    </button>
    <div class="pile-label">Discard</div>
  </div>
</div>

{#if showDiscardModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={onBackdropClick}>
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Discard Pile ({discardCount})</span>
        <div class="modal-header-right">
          <div class="sort-row">
            <button class="sort-btn" class:active={discardSortMode === 'suit-rank'} onclick={() => discardSortMode = discardSortMode === 'suit-rank' ? 'none' : 'suit-rank'}>Suit</button>
            <button class="sort-btn" class:active={discardSortMode === 'rank-suit'} onclick={() => discardSortMode = discardSortMode === 'rank-suit' ? 'none' : 'rank-suit'}>Rank</button>
          </div>
          <button class="close-btn" onclick={() => showDiscardModal = false}>✕</button>
        </div>
      </div>
      <div class="card-grid">
        {#each sortedDiscard as card (card.id)}
          <div class="card-no-hover" animate:flip={{ duration: 280, easing: cubicOut }}>
            <Card {card} faceDown={false} />
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

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
    overflow: visible;
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
    overflow: visible;
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
    transform-origin: bottom center;
    transition: transform 0.25s cubic-bezier(0.34, 1.2, 0.64, 1);
  }

  /* Hover splay: spread cards upward vertically */
  .pile:not(.empty):not(.disabled):hover .pile-card:nth-child(1) {
    transform: translateY(0px);
  }
  .pile:not(.empty):not(.disabled):hover .pile-card:nth-child(2) {
    transform: translateY(-22px);
  }
  .pile:not(.empty):not(.disabled):hover .pile-card:nth-child(3) {
    transform: translateY(-44px);
  }
  .pile:not(.empty):not(.disabled):hover .pile-card:nth-child(4) {
    transform: translateY(-66px);
  }
  .pile:not(.empty):not(.disabled):hover .pile-card:nth-child(5) {
    transform: translateY(-88px);
  }
  .pile:not(.empty):not(.disabled):hover .pile-card:nth-child(6) {
    transform: translateY(-110px);
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

  /* Discard modal */
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .modal {
    background: rgba(12, 18, 32, 0.97);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 14px;
    padding: 20px;
    width: min(480px, 90vw);
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sort-row {
    display: flex;
    gap: 4px;
  }

  .sort-btn {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.4);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .sort-btn:hover {
    background: rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.7);
  }

  .sort-btn.active {
    background: rgba(255,215,0,0.12);
    border-color: rgba(255,215,0,0.35);
    color: #ffd700;
  }

  .card-no-hover {
    pointer-events: none;
  }

  .modal-title {
    font-size: 13px;
    font-weight: 700;
    color: #ccc;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .close-btn {
    background: none;
    border: none;
    color: rgba(255,255,255,0.3);
    font-size: 14px;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 4px;
    line-height: 1;
  }

  .close-btn:hover {
    color: rgba(255,255,255,0.7);
    background: rgba(255,255,255,0.07);
  }

  .card-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    overflow-y: auto;
    padding: 4px 2px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
  }
</style>
