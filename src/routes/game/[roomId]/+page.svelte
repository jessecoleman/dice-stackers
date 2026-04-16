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

  function calcScore(player: 1 | 2): number {
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
      return numStacks * tallestStack * maxPips;
    }).reduce((a: number, b: number) => a + b, 0);
  }

  const score1 = $derived(calcScore(1));
  const score2 = $derived(calcScore(2));
  const winner = $derived(
    score1 > score2 ? 1 : score2 > score1 ? 2 : null
  );

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
  let showNameModal = $state(false);
  $effect.pre(() => {
    if (seat !== null && typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('player-name');
      if (!saved) showNameModal = true;
    }
  });

  async function handleNameSave(name: string) {
    showNameModal = false;
    await gameStore.setName(name);
  }

  // ── Rules modal ───────────────────────────────────────────────────────────
  const RULES_KEY = 'rules-seen-v1';
  let showRules = $state(false);
  $effect.pre(() => {
    if (typeof localStorage !== 'undefined' && !localStorage.getItem(RULES_KEY)) {
      showRules = true;
      localStorage.setItem(RULES_KEY, '1');
    }
  });

  // ── Share link / join toast (seat 1 only) ──────────────────────────────────
  const p2Link = $derived(`${typeof window !== 'undefined' ? window.location.origin : ''}/game/${roomId}?seat=2`);
  let showShareLink = $state(false);
  let showJoinToast = $state(false);

  $effect.pre(() => { if (seat === 1) showShareLink = true; });

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
    <div class="overlay">
      <div class="result-card">
        <div class="result-title">
          {winner === null ? 'Draw!' : `${gameStore.playerName(winner)} wins!`}
        </div>
        <div class="result-scores">
          <div class:result-winner={winner === 1}>{gameStore.player1Name} — {score1}</div>
          <div class:result-winner={winner === 2}>{gameStore.player2Name} — {score2}</div>
        </div>
        <a href="/" class="new-game-btn">New Game</a>
      </div>
    </div>
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
    background: rgba(15, 20, 35, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 40px 56px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }

  .result-title {
    font-size: 28px;
    font-weight: 700;
    color: #ffd700;
    letter-spacing: 0.05em;
  }

  .result-scores {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    color: #888;
  }

  .result-winner {
    color: #fff;
    font-weight: 700;
  }

  .new-game-btn {
    margin-top: 8px;
    padding: 12px 36px;
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
