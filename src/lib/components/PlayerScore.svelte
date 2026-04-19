<script lang="ts">
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { gameStore, suits, type ScoreKey } from '$lib/gameStore.svelte';

  let { player }: { player: 1 | 2 } = $props();

  const SUIT_COLOR: Record<string, string> = {
    red: '#e53e3e', green: '#38a169', yellow: '#d69e2e', blue: '#3b82f6',
  };
  const SUIT_SYMBOL: Record<string, string> = {
    red: '♥', green: '♣', yellow: '★', blue: '♦',
  };

  const SCORE_KEYS: ScoreKey[] = [...suits, 'wild'];

  const scores = $derived(player === 1 ? gameStore.scores1 : gameStore.scores2);
  const total  = $derived(Math.min(...suits.map(s => scores[s])));

  // ── Flash + tween tracking ────────────────────────────────────────────────────
  type FlashDir = 'up' | 'down' | null;
  const TWEEN_OPTS = { duration: 600, easing: cubicOut };

  const tweens: Record<string, Tween<number>> = {};
  for (const key of SCORE_KEYS) tweens[key] = new Tween(0, TWEEN_OPTS);
  tweens['total'] = new Tween(0, TWEEN_OPTS);

  let flashStates = $state<Record<string, FlashDir>>({});
  let flashTotal  = $state<FlashDir>(null);
  let modalOpen   = $state(false);

  let prevScores: Record<string, number> | null = null;
  let prevTotal: number | null = null;

  $effect(() => {
    const cur   = scores;
    const curTotal = total;
    const isFirst = prevScores === null;

    for (const key of SCORE_KEYS) {
      const val = cur[key];
      if (isFirst) {
        tweens[key].set(val, { duration: 0 });
      } else if (val !== prevScores![key]) {
        flashStates[key] = val > prevScores![key] ? 'up' : 'down';
        setTimeout(() => { flashStates[key] = null; }, 900);
        tweens[key].set(val);
      }
    }

    if (isFirst) {
      tweens['total'].set(curTotal, { duration: 0 });
    } else if (curTotal !== prevTotal) {
      flashTotal = curTotal > prevTotal! ? 'up' : 'down';
      setTimeout(() => { flashTotal = null; }, 900);
      tweens['total'].set(curTotal);
    }

    prevScores = { ...cur };
    prevTotal  = curTotal;
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
  <div class="title">{gameStore.playerName(player)}</div>
  <table>
    <thead>
      <tr>
        <th></th>
        <th>Pts</th>
      </tr>
    </thead>
    <tbody>
      {#each suits as suit}
        <tr class:zero={scores[suit] === 0}>
          <td class="suit" style="color: {SUIT_COLOR[suit]}">{SUIT_SYMBOL[suit]}</td>
          <td class="score"
              class:flash-up={flashStates[suit] === 'up'}
              class:flash-down={flashStates[suit] === 'down'}
          >{Math.round(tweens[suit].current) || '—'}</td>
        </tr>
      {/each}
      <tr class:zero={scores.wild === 0}>
        <td class="suit wild">★</td>
        <td class="score"
            class:flash-up={flashStates['wild'] === 'up'}
            class:flash-down={flashStates['wild'] === 'down'}
        >{Math.round(tweens['wild'].current) || '—'}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td class="total-label">Total</td>
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
            <tr><th></th><th>Points</th></tr>
          </thead>
          <tbody>
            {#each suits as suit}
              <tr class:zero={scores[suit] === 0}>
                <td class="suit" style="color: {SUIT_COLOR[suit]}">{SUIT_SYMBOL[suit]}</td>
                <td class="score"
                    class:flash-up={flashStates[suit] === 'up'}
                    class:flash-down={flashStates[suit] === 'down'}
                >{Math.round(tweens[suit].current) || '—'}</td>
              </tr>
            {/each}
            <tr class:zero={scores.wild === 0}>
              <td class="suit wild">★</td>
              <td class="score"
                  class:flash-up={flashStates['wild'] === 'up'}
                  class:flash-down={flashStates['wild'] === 'down'}
              >{Math.round(tweens['wild'].current) || '—'}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td class="total-label">Total</td>
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
    min-width: 90px;
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

  th:first-child { text-align: left; }

  td {
    text-align: right;
    padding: 3px 4px;
    color: #aaa;
    border-radius: 3px;
  }

  td:first-child { text-align: left; }

  .suit { font-size: 13px; width: 16px; }
  .wild { color: #aaa; }

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

  .modal-body table { font-size: 13px; width: 100%; }
  .modal-body th { font-size: 11px; padding: 0 6px 6px; }
  .modal-body td { padding: 5px 6px; }
  .modal-body .total-score { font-size: 16px; }
  .modal-body .suit { font-size: 15px; }

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
