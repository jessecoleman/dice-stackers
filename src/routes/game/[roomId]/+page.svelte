<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Canvas } from '@threlte/core';
  import Scene from '$lib/components/Scene.svelte';
  import PlayerHand from '$lib/components/PlayerHand.svelte';
  import DrawPile from '$lib/components/DrawPile.svelte';
  import PlayerScore from '$lib/components/PlayerScore.svelte';
  import EventLog from '$lib/components/EventLog.svelte';
  import RulesModal from '$lib/components/RulesModal.svelte';
  import NameModal from '$lib/components/NameModal.svelte';
  import { gameStore, suits } from '$lib/gameStore.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Derived so Svelte tracks accesses correctly; values are static per page load
  const roomId = $derived(data.roomId);
  const seat   = $derived(data.seat);

  // Initialise the store once on first render
  $effect.pre(() => {
    gameStore.init(data.roomId, data.seat, data.state);
  });

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') gameStore.deselectCard();
  }

  const SUIT_COLOR: Record<string, string> = {
    red: '#e53e3e', green: '#38a169', yellow: '#d69e2e', blue: '#3b82f6',
  };
  const SUIT_SYMBOL: Record<string, string> = {
    red: '♥', green: '♣', yellow: '★', blue: '♦',
  };

  function calcRows(player: 1 | 2) {
    return suits.map(suit => {
      const stacks = gameStore.grid.flat()
        .map(c => c.dice)
        .filter(stack => {
          const top = stack[stack.length - 1];
          return top && top.player === player && top.color === suit;
        });
      const numStacks    = stacks.length;
      const tallestStack = stacks.reduce((m, s) => Math.max(s.length, m), 0);
      const maxPips      = stacks.reduce((m, s) => Math.max(s[s.length - 1].value, m), 0);
      return { suit, numStacks, tallestStack, maxPips, score: numStacks * tallestStack * maxPips };
    });
  }

  const rows1  = $derived(calcRows(1));
  const rows2  = $derived(calcRows(2));
  const score1 = $derived(rows1.reduce((s, r) => s + r.score, 0));
  const score2 = $derived(rows2.reduce((s, r) => s + r.score, 0));
  const winner = $derived(
    score1 > score2 ? 1 : score2 > score1 ? 2 : null
  );

  let resultMinimized = $state(false);

  // ── Polling ────────────────────────────────────────────────────────────────
  // Poll every second when it's not our seat's turn.
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    const isMyTurn = seat !== null && gameStore.currentPlayer === seat;
    const isOver   = gameStore.gamePhase === 'game-over';

    if (!isMyTurn && !isOver) {
      if (!pollInterval) {
        pollInterval = setInterval(() => gameStore.poll(), 1000);
      }
    } else {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    }
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
  });

  // ── Layout helpers ─────────────────────────────────────────────────────────
  // My hand at bottom, opponent at top. Spectators (seat=null) see P1 at bottom.
  const myPlayer       = $derived<1 | 2>(seat ?? 1);
  const opponentPlayer = $derived<1 | 2>(myPlayer === 1 ? 2 : 1);
  // ── Camera controls ────────────────────────────────────────────────────────
  let resetSignal = $state(0);
  let topDown     = $state(false);

  function recenter() {
    topDown = false;
    resetSignal++;
  }

  // ── P2 join signal ─────────────────────────────────────────────────────────
  // Seat 2 calls joinGame() on mount so P1 gets notified via polling.
  $effect(() => {
    if (seat === 2) gameStore.joinGame();
  });

  // ── Name modal ────────────────────────────────────────────────────────────
  const RULES_KEY = 'rules-seen-v1';
  let showNameModal = $state(false);
  let showRules     = $state(false);
  let pendingRules  = false; // queued to show after name is saved

  $effect.pre(() => {
    if (typeof localStorage === 'undefined') return;
    const hasName  = !!localStorage.getItem('player-name');
    const hasRules = !!localStorage.getItem(RULES_KEY);

    if (seat !== null && !hasName) {
      // Seated player hasn't set a name — prompt first, rules after if needed
      showNameModal = true;
      if (!hasRules) pendingRules = true;
    } else if (!hasRules) {
      // Name already set (or spectator) — show rules directly
      showRules = true;
      localStorage.setItem(RULES_KEY, '1');
    }
  });

  async function handleNameSave(name: string) {
    showNameModal = false;
    await gameStore.setName(name);
    if (pendingRules) {
      pendingRules = false;
      showRules = true;
      if (typeof localStorage !== 'undefined') localStorage.setItem(RULES_KEY, '1');
    }
  }

  // ── Share link / join toast (seat 1 only) ──────────────────────────────────
  const p2Link = $derived(`${typeof window !== 'undefined' ? window.location.origin : ''}/game/${roomId}?seat=2`);
  let showShareLink = $state(false);
  let showJoinToast = $state(false);

  $effect.pre(() => { if (seat === 1) showShareLink = true; });

  let linkCopied = $state(false);
  async function shareOrCopy() {
    if (navigator.share) {
      await navigator.share({ title: 'Join my Dice Stackers game', url: p2Link });
    } else {
      await navigator.clipboard.writeText(p2Link);
      linkCopied = true;
      setTimeout(() => { linkCopied = false; }, 2000);
    }
  }

  // When P1 detects player2Joined flipping to true, replace share link with toast.
  $effect(() => {
    if (seat === 1 && gameStore.player2Joined) {
      showShareLink = false;
      showJoinToast = true;
      const t = setTimeout(() => { showJoinToast = false; }, 3000);
      return () => clearTimeout(t);
    }
  });
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="page">

  <!-- Share link banner (seat 1, before P2 joins) -->
  {#if showShareLink}
    <div class="share-banner">
      <span>Share with Player 2:</span>
      <code class="share-link">{p2Link}</code>
      <button class="share-btn" onclick={shareOrCopy}>{linkCopied ? '✓ Copied' : 'Share'}</button>
      <button class="dismiss-btn" onclick={() => showShareLink = false}>✕</button>
    </div>
  {/if}

  <!-- P2 joined toast (seat 1, auto-dismisses) -->
  {#if showJoinToast}
    <div class="join-toast">Player 2 has joined!</div>
  {/if}

  <!-- Last-turn banner -->
  {#if gameStore.gamePhase === 'last-turn'}
    <div class="phase-banner">Last turn for {gameStore.playerName(gameStore.currentPlayer)}!</div>
  {/if}

  <!-- Game-over overlay -->
  {#if gameStore.gamePhase === 'game-over'}
    {#if resultMinimized}
      <div class="result-minimized">
        <span class="minimized-title">
          {winner === null ? 'Draw!' : `${gameStore.playerName(winner)} wins!`}
        </span>
        <span class="minimized-scores">{score1} – {score2}</span>
        <button class="minimized-restore" onclick={() => resultMinimized = false}>View Results</button>
      </div>
    {:else}
      <div class="overlay">
        <div class="result-card">
          <button class="minimize-btn" onclick={() => resultMinimized = true} title="View board">⊟</button>
          <div class="result-title">
            {winner === null ? 'Draw!' : `${gameStore.playerName(winner)} wins!`}
          </div>

          <!-- Score tables side by side -->
          <div class="result-tables">
            {#each ([1, 2] as const) as p}
              {@const rows = p === 1 ? rows1 : rows2}
              {@const total = p === 1 ? score1 : score2}
              <div class="result-table-wrap" class:result-winner-col={winner === p}>
                <div class="result-table-name">{gameStore.playerName(p)}</div>
                <table class="result-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Pips</th>
                      <th class="op">×</th>
                      <th>Ht</th>
                      <th class="op">×</th>
                      <th>St</th>
                      <th class="op">=</th>
                      <th>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each rows as row}
                      <tr class:zero={row.score === 0}>
                        <td class="suit" style="color:{SUIT_COLOR[row.suit]}">{SUIT_SYMBOL[row.suit]}</td>
                        <td>{row.maxPips || '—'}</td>
                        <td class="op">×</td>
                        <td>{row.tallestStack || '—'}</td>
                        <td class="op">×</td>
                        <td>{row.numStacks || '—'}</td>
                        <td class="op">=</td>
                        <td class="pts">{row.score || '—'}</td>
                      </tr>
                    {/each}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="7" class="total-label">Total</td>
                      <td class="total-pts">{total}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            {/each}
          </div>

          <a href="/" class="new-game-btn">New Game</a>
        </div>
      </div>
    {/if}
  {/if}

  <!-- Name modal -->
  {#if showNameModal}
    <NameModal onSave={handleNameSave} />
  {/if}

  <!-- Rules modal -->
  {#if showRules}
    <RulesModal onClose={() => showRules = false} />
  {/if}

  <!-- Corner scoreboards + event log -->
  <div class="corner top-left"><PlayerScore player={opponentPlayer} /></div>
  <div class="corner top-right"><EventLog /></div>
  <div class="corner bottom-right"><PlayerScore player={myPlayer} /></div>
  <div class="corner bottom-left">
    <button class="rules-btn" onclick={() => showRules = true} title="How to play">?</button>
  </div>

  <!-- ── Opponent row (top) ──────────────────────────────────────── -->
  <div class="player-row">
    <PlayerHand player={opponentPlayer} showBacks={true} />
  </div>

  <!-- ── Board row (middle) ──────────────────────────────────────── -->
  <div class="board-row">
    <div class="left-panel">
      <DrawPile />
    </div>

    <div class="canvas-wrapper">
      <Canvas>
        <Scene {resetSignal} {topDown} />
      </Canvas>
      <button class="recenter-btn" onclick={recenter} title="Recenter camera">⊕</button>
      <button class="topdown-btn" class:active={topDown} onclick={() => topDown = !topDown} title="Toggle top-down view">⊞</button>
    </div>
  </div>

  <!-- ── My row (bottom) ─────────────────────────────────────────── -->
  <div class="player-row">
    <PlayerHand player={myPlayer} showBacks={false} />
  </div>

</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: #111827;
    font-family: 'Segoe UI', system-ui, sans-serif;
    overflow: hidden;
    height: 100vh;
    color: #ccc;
  }

  .page {
    height: 100vh;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 10px 0;
    box-sizing: border-box;
  }

  .corner {
    position: absolute;
    z-index: 10;
  }

  .top-left     { top: 12px; left: 12px; }
  .top-right    { top: 12px; right: 12px; }
  .bottom-right { bottom: 12px; right: 12px; }
  .bottom-left  { bottom: 12px; left: 12px; }

  .rules-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.4);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
  }

  .rules-btn:hover {
    background: rgba(255, 215, 0, 0.12);
    border-color: rgba(255, 215, 0, 0.3);
    color: #ffd700;
  }

  .player-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .board-row {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-shrink: 0;
  }

  .canvas-wrapper {
    position: relative;
    width: min(500px, calc(100vw - 16px));
    height: min(500px, calc(100vw - 16px));
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 0 50px rgba(0, 0, 0, 0.7);
  }

  .recenter-btn {
    position: absolute;
    bottom: 10px;
    right: 10px;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.45);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
    z-index: 5;
  }

  .recenter-btn:hover {
    background: rgba(255, 255, 255, 0.14);
    color: rgba(255, 255, 255, 0.8);
  }

  .topdown-btn {
    position: absolute;
    bottom: 10px;
    right: 44px;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.45);
    font-size: 15px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    z-index: 5;
  }

  .topdown-btn:hover {
    background: rgba(255, 255, 255, 0.14);
    color: rgba(255, 255, 255, 0.8);
  }

  .topdown-btn.active {
    background: rgba(255, 215, 0, 0.15);
    border-color: rgba(255, 215, 0, 0.4);
    color: #ffd700;
  }

  .left-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .share-banner {
    position: absolute;
    top: 12px;
    left: 50%;
    translate: -50% 0;
    background: rgba(30, 60, 100, 0.9);
    border: 1px solid rgba(100, 160, 255, 0.3);
    border-radius: 10px;
    padding: 8px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: #aac8ff;
    z-index: 20;
    max-width: 90vw;
  }

  .share-link {
    font-family: monospace;
    font-size: 11px;
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
    padding: 3px 8px;
    border-radius: 5px;
    user-select: all;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 320px;
  }

  .share-btn {
    background: rgba(100, 160, 255, 0.15);
    border: 1px solid rgba(100, 160, 255, 0.3);
    border-radius: 6px;
    color: #aac8ff;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 10px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }

  .share-btn:hover { background: rgba(100, 160, 255, 0.25); }

  .dismiss-btn {
    background: none;
    border: none;
    color: #667;
    cursor: pointer;
    font-size: 13px;
    padding: 2px 4px;
  }

  .dismiss-btn:hover { color: #aaa; }

  .join-toast {
    position: absolute;
    top: 12px;
    left: 50%;
    translate: -50% 0;
    background: rgba(20, 80, 40, 0.92);
    border: 1px solid rgba(80, 200, 120, 0.35);
    color: #6ee7a0;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 20px;
    border-radius: 10px;
    z-index: 20;
    pointer-events: none;
    animation: toast-in-out 3s ease forwards;
  }

  @keyframes toast-in-out {
    0%   { opacity: 0; translate: -50% -6px; }
    12%  { opacity: 1; translate: -50% 0; }
    75%  { opacity: 1; }
    100% { opacity: 0; }
  }

  .phase-banner {
    position: absolute;
    top: 50%;
    left: 50%;
    translate: -50% -50%;
    background: rgba(255, 180, 0, 0.15);
    border: 1px solid rgba(255, 180, 0, 0.4);
    color: #ffd700;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 8px 20px;
    border-radius: 20px;
    pointer-events: none;
    z-index: 20;
  }

  .overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    backdrop-filter: blur(4px);
  }

  .result-card {
    position: relative;
    background: rgba(15, 20, 35, 0.97);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 32px 40px 36px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    max-width: min(680px, 92vw);
    width: 100%;
  }

  .minimize-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    background: none;
    border: none;
    color: rgba(255,255,255,0.3);
    font-size: 18px;
    cursor: pointer;
    padding: 2px 6px;
    line-height: 1;
    transition: color 0.15s;
  }

  .minimize-btn:hover { color: rgba(255,255,255,0.7); }

  .result-title {
    font-size: 26px;
    font-weight: 700;
    color: #ffd700;
    letter-spacing: 0.05em;
  }

  /* Score tables */
  .result-tables {
    display: flex;
    gap: 24px;
    width: 100%;
  }

  .result-table-wrap {
    flex: 1;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px;
    padding: 10px 12px 12px;
  }

  .result-table-wrap.result-winner-col {
    border-color: rgba(255, 215, 0, 0.3);
    background: rgba(255, 215, 0, 0.04);
  }

  .result-table-name {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255,255,255,0.4);
    margin-bottom: 8px;
    text-align: center;
  }

  .result-winner-col .result-table-name { color: #ffd700; }

  .result-table {
    border-collapse: collapse;
    width: 100%;
    font-size: 11px;
  }

  .result-table th {
    color: #555;
    font-weight: 600;
    text-align: right;
    padding: 0 3px 4px;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .result-table td {
    text-align: right;
    padding: 3px;
    color: #aaa;
  }

  .result-table td:first-child { text-align: left; }
  .result-table th:first-child { text-align: left; }

  .result-table .op {
    color: #444;
    font-size: 8px;
    padding: 0 1px;
    text-align: center;
  }

  .result-table .suit { font-size: 13px; }
  .result-table .pts  { font-weight: 600; color: #ccc; }
  .result-table .zero td { opacity: 0.35; }

  .result-table tfoot tr { border-top: 1px solid rgba(255,255,255,0.1); }

  .total-label {
    color: #555;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding-top: 5px;
  }

  .total-pts {
    font-size: 15px;
    font-weight: 700;
    color: #ffd700;
    padding-top: 5px;
  }

  /* Minimized bar */
  .result-minimized {
    position: absolute;
    bottom: 16px;
    left: 50%;
    translate: -50% 0;
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(15, 20, 35, 0.95);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 30px;
    padding: 8px 10px 8px 18px;
    z-index: 100;
    white-space: nowrap;
  }

  .minimized-title {
    font-size: 13px;
    font-weight: 700;
    color: #ffd700;
  }

  .minimized-scores {
    font-size: 12px;
    color: rgba(255,255,255,0.45);
  }

  .minimized-restore {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 20px;
    color: #ccc;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 12px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .minimized-restore:hover { background: rgba(255,255,255,0.15); }

  .new-game-btn {
    padding: 11px 32px;
    background: #ffd700;
    border-radius: 30px;
    color: #111;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-decoration: none;
    transition: opacity 0.15s;
  }

  .new-game-btn:hover { opacity: 0.85; }

  @media (max-width: 600px) {
    .result-tables { flex-direction: column; gap: 12px; }
    .result-card   { padding: 28px 16px 28px; }
  }

  /* ── Mobile ──────────────────────────────────────────────────────────────── */
  @media (max-width: 600px) {
    :global(body) {
      overflow: auto;
      height: auto;
    }

    .page {
      height: auto;
      min-height: 100svh;
      justify-content: flex-start;
      gap: 4px;
      padding: 56px 0 10px; /* top clearance for corner overlays */
    }

    .board-row {
      gap: 0;
    }

    .left-panel {
      display: none;
    }

    .player-row {
      width: 100%;
      overflow-x: auto;
      padding: 0;
    }
  }
</style>
