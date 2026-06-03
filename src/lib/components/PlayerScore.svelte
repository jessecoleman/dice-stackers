<script lang="ts">
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { gameStore, suits, colorWins, colorLeader } from '$lib/gameStore.svelte';
  import { computePosition, offset, flip, shift } from '@floating-ui/dom';

  // Svelte action: positions a tooltip element relative to its anchor using Floating UI.
  function tooltip(anchor: HTMLElement, text: string) {
    const tip = document.createElement('div');
    tip.className = 'fl-tooltip';
    tip.textContent = text;
    tip.style.cssText = 'position:fixed;z-index:999;pointer-events:none;opacity:0;transition:opacity 0.15s;';
    document.body.appendChild(tip);

    async function position() {
      const { x, y } = await computePosition(anchor, tip, {
        placement: 'top',
        middleware: [offset(6), flip(), shift({ padding: 8 })],
      });
      tip.style.left = `${x}px`;
      tip.style.top  = `${y}px`;
    }

    function show() { position(); tip.style.opacity = '1'; }
    function hide() { tip.style.opacity = '0'; }

    anchor.addEventListener('mouseenter', show);
    anchor.addEventListener('mouseleave', hide);
    anchor.addEventListener('focus',      show);
    anchor.addEventListener('blur',       hide);

    return {
      update(newText: string) { tip.textContent = newText; },
      destroy() {
        anchor.removeEventListener('mouseenter', show);
        anchor.removeEventListener('mouseleave', hide);
        anchor.removeEventListener('focus',      show);
        anchor.removeEventListener('blur',       hide);
        tip.remove();
      },
    };
  }


  let { player }: { player: 1 | 2 } = $props();

  const SUIT_COLOR: Record<string, string> = {
    red: '#e53e3e', green: '#38a169', yellow: '#d69e2e', blue: '#3b82f6',
  };
  const SUIT_SYMBOL: Record<string, string> = {
    red: '♥', green: '♣', yellow: '★', blue: '♦',
  };

  // Per-colour point pools (die placement during play + poker at end). You win the
  // game by leading the majority in 2 of the 3 colours, so `total` tracks how many
  // colours this player currently leads, and led colours are highlighted.
  const pool = $derived(gameStore.scoreOf(player));
  const rows = $derived(suits.map(suit => ({ suit, points: pool[suit] })));
  const pools = $derived({ p1: gameStore.scoreOf(1), p2: gameStore.scoreOf(2) });
  const total = $derived(colorWins(pools.p1, pools.p2)[player === 1 ? 'p1' : 'p2']);
  const ledColors = $derived(suits.filter(s => colorLeader(pools.p1, pools.p2, s) === player));

  // ── Flash + tween tracking ────────────────────────────────────────────────────
  type FlashDir = 'up' | 'down' | null;

  const TWEEN_OPTS = { duration: 600, easing: cubicOut };

  const tweens: Record<string, Tween<number>> = {};
  for (const suit of suits) {
    tweens[`${suit}-points`] = new Tween(0, TWEEN_OPTS);
  }
  tweens['total'] = new Tween(0, TWEEN_OPTS);

  let flashStates = $state<Record<string, FlashDir>>({});
  let flashTotal  = $state<FlashDir>(null);
  let modalOpen   = $state(false);

  let prevRows:  { suit: string; points: number }[] | null = null;
  let prevTotal: number | null = null;

  $effect(() => {
    const currentRows  = rows;
    const currentTotal = total;
    const isFirst = prevRows === null;

    currentRows.forEach((row, i) => {
      const key = `${row.suit}-points`;
      if (isFirst) {
        tweens[key].set(row.points, { duration: 0 });
      } else if (row.points !== prevRows![i].points) {
        flashStates[key] = row.points > prevRows![i].points ? 'up' : 'down';
        setTimeout(() => { flashStates[key] = null; }, 900);
        tweens[key].set(row.points);
      }
    });

    if (isFirst) {
      tweens['total'].set(currentTotal, { duration: 0 });
    } else if (currentTotal !== prevTotal) {
      flashTotal = currentTotal > prevTotal! ? 'up' : 'down';
      setTimeout(() => { flashTotal = null; }, 900);
      tweens['total'].set(currentTotal);
    }

    prevRows  = currentRows.map(r => ({ ...r }));
    prevTotal = currentTotal;
  });

  // ── Score hover helpers ───────────────────────────────────────────────────
  // Highlight grid cells whose top die is this colour (where this colour's
  // running points come from).
  function suitCells(suit: string) {
    return gameStore.grid.flat().filter(c =>
      c.dice.some(d => d.color === suit)
    ).map(c => ({ row: c.row, col: c.col }));
  }

  function highlight(cells: Array<{ row: number; col: number }>) {
    if (cells.length) gameStore.setHoverHighlight({ type: 'cells', cells });
  }

  function clearHighlight() { gameStore.setHoverHighlight(null); }

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) modalOpen = false;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') modalOpen = false;
  }
</script>

<svelte:window onkeydown={onKeyDown} />

<!-- Desktop scoreboard -->
<div class="scoreboard desktop-only" class:p2={player === 2}>
  <div class="title">{gameStore.playerName(player)}</div>
  <table>
    <thead>
      <tr>
        <th></th>
        <th class="tip" use:tooltip={"Points in this colour, from dice you place during play (value × stack height) and won poker hands at the end"}>Points</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as row}
        <tr class:led-row={ledColors.includes(row.suit)}>
          <td class="suit" style="color: {SUIT_COLOR[row.suit]}"
              class:hoverable={row.points > 0}
              onmouseenter={() => highlight(suitCells(row.suit))}
              onmouseleave={clearHighlight}
          >{SUIT_SYMBOL[row.suit]}</td>
          <td class="score"
              class:flash-up={flashStates[`${row.suit}-points`] === 'up'}
              class:flash-down={flashStates[`${row.suit}-points`] === 'down'}
              class:hoverable={row.points > 0}
              onmouseenter={() => highlight(suitCells(row.suit))}
              onmouseleave={clearHighlight}
          >{Math.round(tweens[`${row.suit}-points`].current)}</td>
        </tr>
      {/each}
    </tbody>
    <tfoot>
      <tr>
        <td class="total-label tip" use:tooltip={"Colours you currently lead — take the majority in 2 of 3 to win"}>colors</td>
        <td class="total-score"
            class:flash-up={flashTotal === 'up'}
            class:flash-down={flashTotal === 'down'}
        >{Math.round(tweens['total'].current)}</td>
      </tr>
    </tfoot>
  </table>
</div>

<!-- Mobile compact badge -->
<button
  class="score-badge mobile-only"
  class:p2={player === 2}
  class:flash-up={flashTotal === 'up'}
  class:flash-down={flashTotal === 'down'}
  onclick={() => modalOpen = true}
>
  <span class="badge-label">{gameStore.playerName(player)}</span>
  <span class="badge-total">{Math.round(tweens['total'].current)}</span>
</button>

<!-- Modal (mobile) -->
{#if modalOpen}
  <div class="modal-backdrop" role="presentation" onclick={onBackdropClick}>
    <div class="modal" role="dialog" aria-modal="true" aria-label="Player {player} Score">
      <div class="modal-header">
        <span class="modal-title">{gameStore.playerName(player)}</span>
        <button class="modal-close" onclick={() => modalOpen = false}>✕</button>
      </div>
      <div class="modal-body">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as row}
              <tr class:led-row={ledColors.includes(row.suit)}>
                <td class="suit" style="color: {SUIT_COLOR[row.suit]}">{SUIT_SYMBOL[row.suit]}</td>
                <td class="score"
                    class:flash-up={flashStates[`${row.suit}-points`] === 'up'}
                    class:flash-down={flashStates[`${row.suit}-points`] === 'down'}
                >{Math.round(tweens[`${row.suit}-points`].current)}</td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr>
              <td class="total-label">colors</td>
              <td class="total-score"
                  class:flash-up={flashTotal === 'up'}
                  class:flash-down={flashTotal === 'down'}
              >{Math.round(tweens['total'].current)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Desktop scoreboard ────────────────────────────────────────────────── */
  .scoreboard {
    background: rgba(15, 20, 35, 0.85);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 8px 10px;
    backdrop-filter: blur(6px);
    min-width: 150px;
  }

  .title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #666;
    margin-bottom: 6px;
    text-align: center;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 11px;
  }

  th {
    color: #555;
    font-weight: 600;
    text-align: right;
    padding: 0 4px 4px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  th.tip {
    cursor: default;
    text-decoration: underline dotted rgba(255,255,255,0.2);
    text-underline-offset: 2px;
  }

  th:first-child { text-align: left; }

  :global(.fl-tooltip) {
    background: rgba(15, 20, 40, 0.96);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 6px;
    padding: 5px 8px;
    font-size: 10px;
    font-weight: 400;
    color: #ccc;
    white-space: normal;
    max-width: 180px;
    line-height: 1.4;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }

  td {
    text-align: right;
    padding: 3px 4px;
    color: #aaa;
    border-radius: 3px;
    transition: color 0.1s;
  }

  td:first-child { text-align: left; }
  td.hoverable { cursor: crosshair; }

  .suit { font-size: 13px; width: 16px; }

  .score { font-weight: 600; color: #ccc; }

  /* A colour this player currently leads (counts toward their majority). */
  .led-row .score { color: #ffd700; }
  .led-row .suit  { opacity: 1; }

  tfoot tr { border-top: 1px solid rgba(255,255,255,0.1); }

  .total-label {
    color: #666;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding-top: 5px;
  }

  .total-score {
    font-size: 14px;
    font-weight: 700;
    color: #ffd700;
    padding-top: 5px;
  }

  /* ── Mobile badge ──────────────────────────────────────────────────────── */
  .score-badge {
    display: none;
    align-items: center;
    gap: 6px;
    background: rgba(15, 20, 35, 0.85);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 5px 10px 5px 8px;
    cursor: pointer;
    backdrop-filter: blur(6px);
  }

  .badge-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #60a5fa;
  }

  .score-badge.p2 .badge-label { color: #f472b6; }

  .badge-total {
    font-size: 16px;
    font-weight: 700;
    color: #ffd700;
    font-variant-numeric: tabular-nums;
  }

  /* ── Modal ─────────────────────────────────────────────────────────────── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 300;
  }

  .modal {
    background: rgba(12, 18, 32, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px 16px 0 0;
    width: 100%;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .modal-title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255, 255, 255, 0.4);
  }

  .modal-close {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.3);
    font-size: 14px;
    cursor: pointer;
    padding: 2px 6px;
  }

  .modal-body {
    padding: 12px 16px 20px;
    overflow-x: auto;
  }

  .modal-body table {
    font-size: 13px;
    width: 100%;
  }

  .modal-body th {
    font-size: 11px;
    padding: 0 6px 6px;
  }

  .modal-body td {
    padding: 5px 6px;
  }

  .modal-body .total-score {
    font-size: 16px;
  }

  .modal-body .suit {
    font-size: 15px;
  }

  /* ── Responsive ────────────────────────────────────────────────────────── */
  @media (max-width: 600px) {
    .desktop-only { display: none; }
    .score-badge  { display: flex; }
  }

  /* ── Flash animations ──────────────────────────────────────────────────── */
  @keyframes flash-up {
    0%   { background: rgba(56, 161, 105, 0.7); color: #fff; }
    60%  { background: rgba(56, 161, 105, 0.25); }
    100% { background: transparent; }
  }

  @keyframes flash-down {
    0%   { background: rgba(229, 62, 62, 0.7); color: #fff; }
    60%  { background: rgba(229, 62, 62, 0.25); }
    100% { background: transparent; }
  }

  .flash-up   { animation: flash-up   0.9s ease-out forwards; }
  .flash-down { animation: flash-down 0.9s ease-out forwards; }
</style>
