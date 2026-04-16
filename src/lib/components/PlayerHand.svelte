<script lang="ts">
  import Card from './Card.svelte';
  import { gameStore, type Card as CardType } from '$lib/gameStore.svelte';
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';


  let { player, showBacks = false }: { player: 1 | 2; showBacks?: boolean } = $props();

  const rawHand = $derived(player === 1 ? gameStore.player1Hand : gameStore.player2Hand);
  const isActive = $derived(gameStore.currentPlayer === player);

  type SortMode = 'none' | 'suit-rank' | 'rank-suit';
  let sortMode = $state<SortMode>('none');

  const SUIT_ORDER: Record<string, number> = { red: 0, blue: 1, green: 2, yellow: 3 };

  const hand = $derived.by(() => {
    if (sortMode === 'suit-rank') {
      return [...rawHand].sort((a, b) =>
        SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || a.value - b.value
      );
    }
    if (sortMode === 'rank-suit') {
      return [...rawHand].sort((a, b) =>
        a.value - b.value || SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit]
      );
    }
    return rawHand;
  });

  function cardRotation(i: number, total: number): number {
    if (total <= 1) return 0;
    const mid = (total - 1) / 2;
    return (i - mid) * 4;
  }

  function cardTranslateY(i: number, total: number): number {
    if (total <= 1) return 0;
    const mid = (total - 1) / 2;
    return Math.abs(i - mid) * 3;
  }

  function handleSelect(card: CardType) {
    if (!isActive) return;
    gameStore.selectCard(player, card);
  }
</script>

<div class="hand-area" class:active={isActive} class:player2={player === 2}>
  <div class="label" class:p1={player === 1} class:p2={player === 2}>
    <span class="pip-die" class:pip-white={player === 2}>
      <span class="pip-dot"></span>
    </span>
    {gameStore.playerName(player)}
    {#if isActive}<span class="turn-dot"></span>{/if}
    {#if isActive && player === gameStore.seat && !gameStore.pendingDiePlacement && gameStore.drawPile.length > 0}
      <button class="draw-btn" onclick={() => gameStore.drawToSix()}>Draw to 6</button>
    {/if}
    {#if isActive && player === gameStore.seat && gameStore.pendingDiePlacement}
      <button class="cancel-btn" onclick={() => gameStore.cancelTurn()}>Cancel</button>
    {/if}
    {#if !showBacks}
      <button class="sort-btn" class:active={sortMode === 'suit-rank'} onclick={() => sortMode = sortMode === 'suit-rank' ? 'none' : 'suit-rank'}>S·R</button>
      <button class="sort-btn" class:active={sortMode === 'rank-suit'} onclick={() => sortMode = sortMode === 'rank-suit' ? 'none' : 'rank-suit'}>R·S</button>
    {/if}
  </div>

  <div class="fan">
    {#each hand as card, i (card.id)}
      {@const rot = cardRotation(i, hand.length)}
      {@const dy  = cardTranslateY(i, hand.length)}
      <div
        class="card-slot"
        style="transform: rotate({rot}deg) translateY({dy}px); z-index: {i}"
        animate:flip={{ duration: 280, easing: cubicOut }}
        in:fly={{ y: 40, duration: 240, easing: cubicOut }}
      >
        <Card
          {card}
          faceDown={showBacks}
          selected={!showBacks && gameStore.selectedCard?.card.id === card.id}
          onplay={handleSelect}
        />
      </div>
    {/each}

    {#if hand.length === 0}
      <div class="empty-hand">No cards</div>
    {/if}
  </div>

</div>

<style>
  .hand-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    transition: background 0.2s;
  }

  .hand-area.active {
    background: rgba(255, 215, 0, 0.06);
    border-radius: 12px;
  }

  .label {
    font-size: 12px;
    font-weight: 600;
    color: #888;
    display: flex;
    align-items: center;
    gap: 6px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .hand-area.player2 .label {
    flex-direction: row-reverse;
  }

  .pip-die {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: #e8e8e8;
    box-shadow: inset 0 -2px 0 rgba(0,0,0,0.25);
    flex-shrink: 0;
  }

  .pip-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #111;
  }

  .pip-die.pip-white {
    background: #1a1a1a;
    box-shadow: inset 0 -2px 0 rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.15);
  }

  .pip-die.pip-white .pip-dot {
    background: #fff;
  }

  .label.p1 { color: #c8c8c8; }
  .label.p2 { color: #888; }

  .turn-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #ffd700;
    box-shadow: 0 0 6px #ffd700;
    animation: pulse 1.2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }

  .fan {
    display: flex;
    align-items: flex-end;
    /* Negative margin makes cards overlap */
    gap: 0;
    padding: 12px 24px 4px;
    position: relative;
  }

  .card-slot {
    margin-right: -18px;
    transform-origin: bottom center;
    transition: z-index 0s;
  }

  .card-slot:last-child {
    margin-right: 0;
  }

  /* When a card in the fan is hovered, bring it above siblings */
  .card-slot:hover {
    z-index: 50 !important;
  }

  @media (max-width: 600px) {
    .hand-area {
      --card-w: 48px;
      --card-h: 70px;
      --card-val-size: 20px;
      --card-sym-size: 13px;
      padding: 6px 8px;
    }

    .fan {
      padding: 8px 12px 4px;
    }

    .card-slot {
      margin-right: -14px;
    }
  }

  .empty-hand {
    font-size: 12px;
    color: #555;
    font-style: italic;
    padding: 20px;
  }

  .draw-btn {
    margin-top: 4px;
    padding: 5px 16px;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 20px;
    color: #aaa;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .draw-btn:hover {
    background: rgba(255,255,255,0.13);
    color: #fff;
  }

  .cancel-btn {
    margin-top: 4px;
    padding: 5px 16px;
    background: rgba(229, 62, 62, 0.12);
    border: 1px solid rgba(229, 62, 62, 0.35);
    border-radius: 20px;
    color: #e57373;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .cancel-btn:hover {
    background: rgba(229, 62, 62, 0.25);
    color: #ff8a80;
  }

  .sort-btn {
    padding: 3px 8px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    color: #666;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .sort-btn:hover {
    background: rgba(255,255,255,0.1);
    color: #aaa;
  }

  .sort-btn.active {
    background: rgba(255,215,0,0.12);
    border-color: rgba(255,215,0,0.35);
    color: #ffd700;
  }
</style>
