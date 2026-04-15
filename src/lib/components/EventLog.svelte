<script lang="ts">
  import { gameStore, type EventLogEntry } from '$lib/gameStore.svelte';

  const SUIT_COLORS: Record<string, string> = {
    red: '#f87171',
    blue: '#60a5fa',
    green: '#4ade80',
    yellow: '#facc15',
  };

  function suitColor(detail: string): string {
    for (const suit of ['red', 'blue', 'green', 'yellow']) {
      if (detail.startsWith(suit)) return SUIT_COLORS[suit];
    }
    return '#ccc';
  }

  function actionLabel(entry: EventLogEntry): string {
    switch (entry.action) {
      case 'played':    return 'played';
      case 'placed':    return 'placed';
      case 'drew':      return 'drew';
      case 'cancelled': return 'cancelled';
    }
  }

  function formatTime(ts: number): string {
    const d = new Date(ts);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    const s = d.getSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  let listEl       = $state<HTMLUListElement | null>(null);
  let modalListEl  = $state<HTMLUListElement | null>(null);
  let modalOpen    = $state(false);

  $effect(() => {
    gameStore.eventLog.length;
    if (listEl)      listEl.scrollTop      = listEl.scrollHeight;
    if (modalListEl) modalListEl.scrollTop = modalListEl.scrollHeight;
  });

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) modalOpen = false;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') modalOpen = false;
  }
</script>

<svelte:window onkeydown={onKeyDown} />

<!-- Desktop widget -->
<div class="event-log desktop-only">
  <div class="log-title">Event Log</div>
  <ul class="log-list" bind:this={listEl}>
    {#each gameStore.eventLog as entry, i (i)}
      {@const hasTarget = !!(entry.slot || entry.cell)}
      <li
        class="log-entry"
        class:p1={entry.player === 1}
        class:p2={entry.player === 2}
        class:highlightable={hasTarget}
        onmouseenter={() => {
          if (entry.slot) gameStore.setHoverHighlight({ type: 'slot', edge: entry.slot.edge, index: entry.slot.index });
          else if (entry.cell) gameStore.setHoverHighlight({ type: 'cell', row: entry.cell.row, col: entry.cell.col });
        }}
        onmouseleave={() => gameStore.setHoverHighlight(null)}
      >
        <span class="timestamp">{formatTime(entry.timestamp)}</span>
        <span class="player-tag">P{entry.player}</span>
        <span class="action">{actionLabel(entry)}</span>
        <span class="detail" style:color={entry.action === 'played' || entry.action === 'cancelled' ? suitColor(entry.detail) : 'inherit'}>
          {entry.detail}
        </span>
      </li>
    {/each}
    {#if gameStore.eventLog.length === 0}
      <li class="log-empty">No actions yet</li>
    {/if}
  </ul>
</div>

<!-- Mobile collapsed button -->
<button class="log-pill mobile-only" onclick={() => modalOpen = true}>
  Log
  {#if gameStore.eventLog.length > 0}
    <span class="pill-count">{gameStore.eventLog.length}</span>
  {/if}
</button>

<!-- Modal (mobile) -->
{#if modalOpen}
  <div class="modal-backdrop" role="presentation" onclick={onBackdropClick}>
    <div class="modal" role="dialog" aria-modal="true" aria-label="Event Log">
      <div class="modal-header">
        <span class="modal-title">Event Log</span>
        <button class="modal-close" onclick={() => modalOpen = false}>✕</button>
      </div>
      <ul class="log-list modal-list" bind:this={modalListEl}>
        {#each gameStore.eventLog as entry, i (i)}
          <li
            class="log-entry"
            class:p1={entry.player === 1}
            class:p2={entry.player === 2}
          >
            <span class="timestamp">{formatTime(entry.timestamp)}</span>
            <span class="player-tag">P{entry.player}</span>
            <span class="action">{actionLabel(entry)}</span>
            <span class="detail" style:color={entry.action === 'played' || entry.action === 'cancelled' ? suitColor(entry.detail) : 'inherit'}>
              {entry.detail}
            </span>
          </li>
        {/each}
        {#if gameStore.eventLog.length === 0}
          <li class="log-empty">No actions yet</li>
        {/if}
      </ul>
    </div>
  </div>
{/if}

<style>
  /* ── Desktop widget ────────────────────────────────────────────────────── */
  .event-log {
    width: 220px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    max-height: 460px;
  }

  .log-title {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.3);
    padding: 8px 10px 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }

  .log-list {
    list-style: none;
    margin: 0;
    padding: 4px 0;
    overflow-y: auto;
    flex: 1;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
  }

  .log-entry {
    display: flex;
    align-items: baseline;
    gap: 5px;
    padding: 3px 10px;
    font-size: 11px;
    line-height: 1.4;
    border-left: 2px solid transparent;
  }

  .log-entry.p1 { border-left-color: #60a5fa; }
  .log-entry.p2 { border-left-color: #f472b6; }

  .player-tag {
    font-weight: 700;
    font-size: 10px;
    flex-shrink: 0;
  }

  .log-entry.highlightable { cursor: crosshair; }
  .log-entry.highlightable:hover { background: rgba(255, 255, 255, 0.05); }

  .p1 .player-tag { color: #60a5fa; }
  .p2 .player-tag { color: #f472b6; }

  .timestamp {
    color: rgba(255, 255, 255, 0.25);
    font-size: 9px;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }

  .action {
    color: rgba(255, 255, 255, 0.45);
    flex-shrink: 0;
  }

  .detail {
    color: #ccc;
    word-break: break-word;
  }

  .log-empty {
    padding: 10px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.2);
    text-align: center;
  }

  /* ── Mobile pill button ────────────────────────────────────────────────── */
  .log-pill {
    display: none;
    align-items: center;
    gap: 5px;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    color: rgba(255, 255, 255, 0.55);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 5px 10px;
    cursor: pointer;
  }

  .pill-count {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    padding: 1px 6px;
    font-size: 10px;
    color: #fff;
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
    padding: 0;
  }

  .modal {
    background: rgba(12, 18, 32, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px 16px 0 0;
    width: 100%;
    max-height: 60svh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    flex-shrink: 0;
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

  .modal-list {
    max-height: none;
    flex: 1;
    overflow-y: auto;
  }

  /* ── Responsive ────────────────────────────────────────────────────────── */
  @media (max-width: 600px) {
    .desktop-only { display: none; }
    .log-pill     { display: flex; }
  }
</style>
