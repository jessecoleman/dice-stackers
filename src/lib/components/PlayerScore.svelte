<script lang="ts">
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { gameStore, suits } from '$lib/gameStore.svelte';

  let { player }: { player: 1 | 2 } = $props();

  const SUIT_COLOR: Record<string, string> = {
    red: '#e53e3e', green: '#38a169', yellow: '#d69e2e', blue: '#3b82f6',
  };
  const SUIT_SYMBOL: Record<string, string> = {
    red: '♥', green: '♣', yellow: '★', blue: '♦',
  };

  const diceStacks = $derived(gameStore.grid.flat().map(c => c.dice));

  const rows = $derived(suits.map(suit => {
    const stacks = diceStacks.filter(stack => {
      const top = stack[stack.length - 1];
      return top && top.player === player && top.color === suit;
    });
    const numStacks    = stacks.length;
    const tallestStack = stacks.reduce((m, s) => Math.max(s.length, m), 0);
    const maxPips      = stacks.reduce((m, s) => Math.max(s[s.length - 1].value, m), 0);
    return { suit, numStacks, tallestStack, maxPips, score: numStacks * tallestStack * maxPips };
  }));

  const total = $derived(rows.reduce((sum, r) => sum + r.score, 0));

  // ── Flash + tween tracking ────────────────────────────────────────────────────
  type FlashDir = 'up' | 'down' | null;
  type RowCol = 'maxPips' | 'tallestStack' | 'numStacks' | 'score';

  const COLS: RowCol[] = ['maxPips', 'tallestStack', 'numStacks', 'score'];
  const TWEEN_OPTS = { duration: 600, easing: cubicOut };

  const tweens: Record<string, Tween<number>> = {};
  for (const suit of suits) {
    for (const col of COLS) {
      tweens[`${suit}-${col}`] = new Tween(0, TWEEN_OPTS);
    }
  }
  tweens['total'] = new Tween(0, TWEEN_OPTS);

  let flashStates = $state<Record<string, FlashDir>>({});
  let flashTotal  = $state<FlashDir>(null);
  let modalOpen   = $state(false);

  let prevRows:  { suit: string; maxPips: number; tallestStack: number; numStacks: number; score: number }[] | null = null;
  let prevTotal: number | null = null;

  $effect(() => {
    const currentRows  = rows;
    const currentTotal = total;
    const isFirst = prevRows === null;

    currentRows.forEach((row, i) => {
      for (const col of COLS) {
        const key = `${row.suit}-${col}`;
        if (isFirst) {
          tweens[key].set(row[col], { duration: 0 });
        } else if (row[col] !== prevRows![i][col]) {
          flashStates[key] = row[col] > prevRows![i][col] ? 'up' : 'down';
          setTimeout(() => { flashStates[key] = null; }, 900);
          tweens[key].set(row[col]);
        }
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
  <div class="title">P{player}</div>
  <table>
    <thead>
      <tr>
        <th></th>
        <th class="tip" data-tip="The highest die value on top of any stack you own in this suit">Pips</th>
        <th class="op">×</th>
        <th class="tip" data-tip="The number of dice in your tallest stack of this suit">Height</th>
        <th class="op">×</th>
        <th class="tip" data-tip="How many stacks you own (top die) in this suit">Stacks</th>
        <th class="op">=</th>
        <th>Score</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as row}
        <tr class:zero={row.score === 0}>
          <td class="suit" style="color: {SUIT_COLOR[row.suit]}">{SUIT_SYMBOL[row.suit]}</td>
          <td class:flash-up={flashStates[`${row.suit}-maxPips`] === 'up'}
              class:flash-down={flashStates[`${row.suit}-maxPips`] === 'down'}
          >{Math.round(tweens[`${row.suit}-maxPips`].current) || '—'}</td>
          <td class="op">×</td>
          <td class:flash-up={flashStates[`${row.suit}-tallestStack`] === 'up'}
              class:flash-down={flashStates[`${row.suit}-tallestStack`] === 'down'}
          >{Math.round(tweens[`${row.suit}-tallestStack`].current) || '—'}</td>
          <td class="op">×</td>
          <td class:flash-up={flashStates[`${row.suit}-numStacks`] === 'up'}
              class:flash-down={flashStates[`${row.suit}-numStacks`] === 'down'}
          >{Math.round(tweens[`${row.suit}-numStacks`].current) || '—'}</td>
          <td class="op">=</td>
          <td class="score"
              class:flash-up={flashStates[`${row.suit}-score`] === 'up'}
              class:flash-down={flashStates[`${row.suit}-score`] === 'down'}
          >{Math.round(tweens[`${row.suit}-score`].current) || '—'}</td>
        </tr>
      {/each}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="7" class="total-label">Total</td>
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
  <span class="badge-label">P{player}</span>
  <span class="badge-total">{Math.round(tweens['total'].current)}</span>
</button>

<!-- Modal (mobile) -->
{#if modalOpen}
  <div class="modal-backdrop" role="presentation" onclick={onBackdropClick}>
    <div class="modal" role="dialog" aria-modal="true" aria-label="Player {player} Score">
      <div class="modal-header">
        <span class="modal-title">Player {player} Score</span>
        <button class="modal-close" onclick={() => modalOpen = false}>✕</button>
      </div>
      <div class="modal-body">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Pips</th>
              <th class="op">×</th>
              <th>Height</th>
              <th class="op">×</th>
              <th>Stacks</th>
              <th class="op">=</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as row}
              <tr class:zero={row.score === 0}>
                <td class="suit" style="color: {SUIT_COLOR[row.suit]}">{SUIT_SYMBOL[row.suit]}</td>
                <td class:flash-up={flashStates[`${row.suit}-maxPips`] === 'up'}
                    class:flash-down={flashStates[`${row.suit}-maxPips`] === 'down'}
                >{Math.round(tweens[`${row.suit}-maxPips`].current) || '—'}</td>
                <td class="op">×</td>
                <td class:flash-up={flashStates[`${row.suit}-tallestStack`] === 'up'}
                    class:flash-down={flashStates[`${row.suit}-tallestStack`] === 'down'}
                >{Math.round(tweens[`${row.suit}-tallestStack`].current) || '—'}</td>
                <td class="op">×</td>
                <td class:flash-up={flashStates[`${row.suit}-numStacks`] === 'up'}
                    class:flash-down={flashStates[`${row.suit}-numStacks`] === 'down'}
                >{Math.round(tweens[`${row.suit}-numStacks`].current) || '—'}</td>
                <td class="op">=</td>
                <td class="score"
                    class:flash-up={flashStates[`${row.suit}-score`] === 'up'}
                    class:flash-down={flashStates[`${row.suit}-score`] === 'down'}
                >{Math.round(tweens[`${row.suit}-score`].current) || '—'}</td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="7" class="total-label">Total</td>
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
    position: relative;
    cursor: default;
    text-decoration: underline dotted rgba(255,255,255,0.2);
    text-underline-offset: 2px;
  }

  th.tip::after {
    content: attr(data-tip);
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    translate: -50% 0;
    background: rgba(15, 20, 40, 0.96);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 6px;
    padding: 5px 8px;
    font-size: 10px;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: #ccc;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s;
    z-index: 100;
  }

  th.tip:hover::after { opacity: 1; }
  th:first-child { text-align: left; }

  td {
    text-align: right;
    padding: 3px 4px;
    color: #aaa;
    border-radius: 3px;
    transition: color 0.1s;
  }

  td:first-child { text-align: left; }

  .op {
    color: #444;
    font-size: 9px;
    padding: 0 1px;
    text-align: center;
    user-select: none;
  }

  .suit { font-size: 13px; width: 16px; }

  .score { font-weight: 600; color: #ccc; }

  .zero td { opacity: 0.35; }

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
