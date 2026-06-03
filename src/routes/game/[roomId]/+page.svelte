<script lang="ts">
  import { onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { crossfade, fade } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';

  // Continuously reads the parent element's computed transform and applies
  // the matrix inverse to `node`, so the child is visually unaffected by the
  // parent's crossfade squash while its own transition runs independently.
  function counterParentTransform(node: HTMLElement) {
    const parent = node.parentElement!;
    let rafId: number;

    function sync() {
      const t = getComputedStyle(parent).transform;
      if (t && t !== 'none') {
        const m = new DOMMatrix(t);
        const inv = m.inverse();
        node.style.transform = `matrix(${inv.a},${inv.b},${inv.c},${inv.d},${inv.e},${inv.f})`;
      } else {
        node.style.transform = '';
      }
      rafId = requestAnimationFrame(sync);
    }

    sync();
    return { destroy() { cancelAnimationFrame(rafId); } };
  }

  const [send, receive] = crossfade({ duration: 450, easing: cubicInOut });
  import { Canvas } from '@threlte/core';
  import Scene from '$lib/components/Scene.svelte';
  import PlayerHand from '$lib/components/PlayerHand.svelte';
  import DrawPile from '$lib/components/DrawPile.svelte';
  import PlayerScore from '$lib/components/PlayerScore.svelte';
  import EventLog from '$lib/components/EventLog.svelte';
  import RulesModal from '$lib/components/RulesModal.svelte';
  import NameModal from '$lib/components/NameModal.svelte';
  import { gameStore, suits, pokerLanes, colorWins, colorLeader, gameWinner, HAND_CATEGORY_NAMES, type ColorPoints, type PokerLane } from '$lib/gameStore.svelte';
  import { playYourTurnChime, playPlayerJoined } from '$lib/utils/sounds';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Derived so Svelte tracks accesses correctly; values are static per page load
  const roomId = $derived(data.roomId);
  const seat   = $derived(data.seat);

  // Initialise the store once on first render
  $effect.pre(() => {
    gameStore.init(data.roomId, data.seat, data.state);
  });

  // Chime when it becomes this player's turn (skip the very first render)
  let prevCurrentPlayer = $state<number | null>(null);
  $effect(() => {
    const cur = gameStore.currentPlayer;
    if (prevCurrentPlayer !== null && cur === seat && cur !== prevCurrentPlayer) {
      playYourTurnChime();
    }
    prevCurrentPlayer = cur;
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

  // ── Follower prompt ──────────────────────────────────────────────────────────
  // While a trick is in progress, tell the responding player which suit/axis the
  // leader committed to. Shown to the player whose turn it is (or to spectators).
  const lead          = $derived(gameStore.trick);
  const followAxis    = $derived(lead?.axis === 'row' ? 'column' : 'row');
  const showFollowBanner = $derived(
    lead !== null &&
    gameStore.gamePhase === 'playing' &&
    (seat === null || gameStore.currentPlayer === seat)
  );

  // Winner: majority in ≥2 colours, tiebroken by larger second-highest colour. Based
  // on the final pools; the expanded tables animate via the displayed pools below.
  const winner = $derived(gameWinner(gameStore.scoreOf(1), gameStore.scoreOf(2)));
  const finalColorsWon = $derived(colorWins(gameStore.scoreOf(1), gameStore.scoreOf(2)));

  let resultMinimized = $state(false);

  // ── Game-over entrance animation ───────────────────────────────────────────
  // Start minimized, then crossfade to the full card after a short delay.
  let expandTimer: ReturnType<typeof setTimeout> | null = null;
  let gameOverHandled = false;
  $effect(() => {
    if (gameStore.gamePhase === 'game-over' && !gameOverHandled) {
      gameOverHandled = true;
      resultMinimized = true;
      expandTimer = setTimeout(() => { resultMinimized = false; }, 1400);
    }
  });
  onDestroy(() => { if (expandTimer) clearTimeout(expandTimer); });

  // ── Game-over poker reveal: score the six lanes one at a time ────────────────
  const lanes = $derived(
    gameStore.gamePhase === 'game-over' ? pokerLanes(gameStore.cardSlots) : []
  );
  let revealedLanes = $state(0);
  let laneTimer: ReturnType<typeof setInterval> | null = null;
  let laneRevealStarted = false;

  // Once the expanded result card is shown, reveal/score the lanes on a cadence.
  $effect(() => {
    if (gameStore.gamePhase === 'game-over' && !resultMinimized && !laneRevealStarted) {
      laneRevealStarted = true;
      laneTimer = setInterval(() => {
        revealedLanes += 1;
        if (revealedLanes >= lanes.length && laneTimer) {
          clearInterval(laneTimer);
          laneTimer = null;
        }
      }, 850);
    }
  });
  onDestroy(() => { if (laneTimer) clearInterval(laneTimer); });

  // A player's pool as shown mid-reveal: the final pool minus points from lanes not
  // yet revealed, so each total climbs from die-only up to its final value.
  function displayedPool(p: 1 | 2): ColorPoints {
    const f = gameStore.scoreOf(p);
    const acc: ColorPoints = { red: f.red, green: f.green, blue: f.blue };
    for (let i = revealedLanes; i < lanes.length; i++) {
      if (lanes[i].winner === p) for (const s of suits) acc[s] -= lanes[i].points[s];
    }
    return acc;
  }

  const dispPool1 = $derived(displayedPool(1));
  const dispPool2 = $derived(displayedPool(2));
  const dispRows1 = $derived(suits.map(suit => ({ suit, points: dispPool1[suit] })));
  const dispRows2 = $derived(suits.map(suit => ({ suit, points: dispPool2[suit] })));
  const dispColorsWon = $derived(colorWins(dispPool1, dispPool2));

  /** Nonzero per-colour awards for a lane, for the verdict badges. */
  function laneAward(lane: PokerLane) {
    return suits.filter(s => lane.points[s] > 0).map(s => ({ suit: s, n: lane.points[s] }));
  }

  // ── Rematch ────────────────────────────────────────────────────────────────
  let rematchPending = $state(false);

  async function handleRematch() {
    rematchPending = true;
    const newRoomId = await gameStore.rematch();
    if (newRoomId) {
      // Seats swap: original P1 → seat 2, original P2 → seat 1
      const newSeat = seat === 1 ? 2 : seat === 2 ? 1 : null;
      const query = newSeat ? `?seat=${newSeat}` : '';
      goto(`/game/${newRoomId}${query}`);
    } else {
      rematchPending = false;
    }
  }

  // Redirect automatically when the other player accepts
  let rematchHandled = false;
  $effect(() => {
    const newRoomId = gameStore.rematchRoomId;
    if (newRoomId && gameStore.gamePhase === 'game-over' && !rematchHandled) {
      rematchHandled = true;
      playPlayerJoined();
      const newSeat = seat === 1 ? 2 : seat === 2 ? 1 : null;
      const query = newSeat ? `?seat=${newSeat}` : '';
      goto(`/game/${newRoomId}${query}`);
    }
  });

  // ── Polling ────────────────────────────────────────────────────────────────
  // Poll every second when it's not our seat's turn.
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    const isMyTurn       = seat !== null && gameStore.currentPlayer === seat;
    const isOver         = gameStore.gamePhase === 'game-over';
    const rematchPending = isOver && !gameStore.rematchRoomId;
    const needsPoll      = (!isMyTurn && !isOver) || rematchPending;

    if (needsPoll) {
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
  let flipped     = $state(false);

  // ── Tooltip ────────────────────────────────────────────────────────────────
  let mouseX = $state(0);
  let mouseY = $state(0);
  function onMouseMove(e: MouseEvent) { mouseX = e.clientX; mouseY = e.clientY; }

  function recenter() {
    topDown = false;
    flipped = false;
    resetSignal++;
  }

  // ── P2 join signal ─────────────────────────────────────────────────────────
  // Seat 2 calls joinGame() on mount so P1 gets notified via polling.
  $effect(() => {
    if (seat === 2) {
      gameStore.joinGame();
      playPlayerJoined();
    }
  });

  // ── Name modal ────────────────────────────────────────────────────────────
  const RULES_KEY = 'rules-seen-v1';
  let showNameModal = $state(false);
  let showRules     = $state(false);
  let pendingRules  = false; // queued to show after name is saved

  $effect.pre(() => {
    if (typeof localStorage === 'undefined') return;
    const savedName = localStorage.getItem('player-name');
    const hasRules  = !!localStorage.getItem(RULES_KEY);

    if (seat !== null && !savedName) {
      // Seated player hasn't set a name — prompt first, rules after if needed
      showNameModal = true;
      if (!hasRules) pendingRules = true;
    } else {
      // Name already saved — push it to the server so the opponent sees it
      if (seat !== null && savedName) gameStore.setName(savedName);
      if (!hasRules) {
        showRules = true;
        localStorage.setItem(RULES_KEY, '1');
      }
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
  let joinSoundPlayed = false;
  $effect(() => {
    if (seat === 1 && gameStore.player2Joined) {
      showShareLink = false;
      showJoinToast = true;
      if (!joinSoundPlayed) {
        joinSoundPlayed = true;
        playPlayerJoined();
      }
      const t = setTimeout(() => { showJoinToast = false; }, 3000);
      return () => clearTimeout(t);
    }
  });
</script>

<svelte:window onkeydown={onKeyDown} onmousemove={onMouseMove} />

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

  <!-- Follower prompt: which suit/axis the leader committed to -->
  {#if showFollowBanner && lead}
    <div class="follow-banner">
      <span class="follow-led">Leader played</span>
      <span class="follow-card" style:color={SUIT_COLOR[lead.suit]}>
        {lead.value} {SUIT_SYMBOL[lead.suit]}
      </span>
      <span class="follow-sep">·</span>
      <span class="follow-instr">
        Respond with a <strong>non-{lead.suit}</strong> face, into a <strong>{followAxis}</strong>
      </span>
    </div>
  {/if}

  <!-- Game-over overlay -->
  {#if gameStore.gamePhase === 'game-over'}
    {#if resultMinimized}
      <div
        class="result-minimized"
        in:receive={{ key: 'result' }}
        out:send={{ key: 'result' }}
      >
        <div class="counter-wrap" use:counterParentTransform>
          <span
            class="minimized-title"
            in:receive={{ key: 'result-title' }}
            out:send={{ key: 'result-title' }}
          >{winner === null ? 'Draw!' : `${gameStore.playerName(winner)} wins!`}</span>
        </div>
        <span class="minimized-scores">{finalColorsWon.p1} – {finalColorsWon.p2}</span>
        <button class="minimized-restore" onclick={() => resultMinimized = false}>View Results</button>
      </div>
    {:else}
      <div class="overlay" transition:fade={{ duration: 300 }}>
        <div
          class="result-card"
          in:receive={{ key: 'result' }}
          out:send={{ key: 'result' }}
        >
          <button class="minimize-btn" onclick={() => resultMinimized = true} title="View board">⊟</button>
          <div class="counter-wrap" use:counterParentTransform>
            <div
              class="result-title"
              in:receive={{ key: 'result-title' }}
              out:send={{ key: 'result-title' }}
            >{winner === null ? 'Draw!' : `${gameStore.playerName(winner)} wins!`}</div>
          </div>

          <!-- Score tables side by side (totals climb as lanes are scored) -->
          <div class="result-tables">
            {#each ([1, 2] as const) as p}
              {@const rows = p === 1 ? dispRows1 : dispRows2}
              {@const colorsWon = p === 1 ? dispColorsWon.p1 : dispColorsWon.p2}
              <div class="result-table-wrap" class:result-winner-col={winner === p}>
                <div class="result-table-name">{gameStore.playerName(p)}</div>
                <table class="result-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each rows as row}
                      <tr class:leads={colorLeader(dispPool1, dispPool2, row.suit) === p}>
                        <td class="suit" style="color:{SUIT_COLOR[row.suit]}">{SUIT_SYMBOL[row.suit]}</td>
                        <td class="pts">{row.points}</td>
                      </tr>
                    {/each}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td class="total-label">colors</td>
                      <td class="total-pts">{colorsWon}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            {/each}
          </div>

          <!-- Per-lane poker breakdown, revealed/scored one at a time -->
          <div class="lanes-title">Lane scoring</div>
          <div class="lanes">
            {#each lanes as lane, i (lane.id)}
              <div
                class="lane"
                class:revealed={i < revealedLanes}
                class:scoring={i === revealedLanes - 1}
                class:p1win={lane.winner === 1}
                class:p2win={lane.winner === 2}
              >
                <div class="hand p1-hand">
                  {#each lane.p1Faces as f}
                    <span class="chip" style="background:{SUIT_COLOR[f.suit]}">{f.value}<span class="chip-sym">{SUIT_SYMBOL[f.suit]}</span></span>
                  {/each}
                </div>
                <div class="verdict">
                  <span class="lane-id">{lane.id}</span>
                  {#if lane.winner}
                    {#if lane.category !== null}
                      <span class="lane-cat">{HAND_CATEGORY_NAMES[lane.category]}</span>
                    {/if}
                    <div class="award">
                      <span class="arrow">{lane.winner === 1 ? '◀' : '▶'}</span>
                      {#each laneAward(lane) as a}
                        <span class="award-pts" style="color:{SUIT_COLOR[a.suit]}">+{a.n}</span>
                      {/each}
                    </div>
                  {:else}
                    <span class="lane-tie">tie</span>
                  {/if}
                </div>
                <div class="hand p2-hand">
                  {#each lane.p2Faces as f}
                    <span class="chip" style="background:{SUIT_COLOR[f.suit]}">{f.value}<span class="chip-sym">{SUIT_SYMBOL[f.suit]}</span></span>
                  {/each}
                </div>
              </div>
            {/each}
          </div>

          <div class="result-actions">
            {#if seat !== null}
              {#if gameStore.rematchRequestedBy === null || gameStore.rematchRequestedBy === seat}
                <button
                  class="rematch-btn"
                  class:waiting={gameStore.rematchRequestedBy === seat}
                  disabled={rematchPending || gameStore.rematchRequestedBy === seat}
                  onclick={handleRematch}
                >
                  {#if gameStore.rematchRequestedBy === seat}
                    Rematch requested — waiting for opponent…
                  {:else}
                    Suggest Rematch
                  {/if}
                </button>
              {:else}
                <button class="rematch-btn accept" onclick={handleRematch} disabled={rematchPending}>
                  Accept Rematch
                </button>
              {/if}
            {/if}
            <a href="/" class="new-game-btn">New Game</a>
          </div>
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
      <Canvas shadows="soft">
        <Scene {resetSignal} {topDown} {flipped} />
      </Canvas>
      <button class="recenter-btn" onclick={recenter} title="Recenter camera">⊕</button>
      <button class="topdown-btn" class:active={topDown} onclick={() => topDown = !topDown} title="Toggle top-down view">⊞</button>
      <button class="flip-btn" class:active={flipped} onclick={() => flipped = !flipped} title="View from opponent's side">⇄</button>
    </div>
  </div>

  <!-- ── My row (bottom) ─────────────────────────────────────────── -->
  <div class="player-row">
    <PlayerHand player={myPlayer} showBacks={false} />
  </div>

  <!-- Tooltip -->
  {#if gameStore.tooltipText}
    <div
      class="tooltip"
      style="left: {mouseX + 14}px; top: {mouseY - 10}px"
    >{gameStore.tooltipText}</div>
  {/if}

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

  .flip-btn {
    position: absolute;
    bottom: 10px;
    right: 78px;
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

  .flip-btn:hover {
    background: rgba(255, 255, 255, 0.14);
    color: rgba(255, 255, 255, 0.8);
  }

  .flip-btn.active {
    background: rgba(100, 180, 255, 0.15);
    border-color: rgba(100, 180, 255, 0.4);
    color: #64b4ff;
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

  .follow-banner {
    position: absolute;
    top: 12px;
    left: 50%;
    translate: -50% 0;
    background: rgba(35, 28, 5, 0.95);
    border: 1px solid rgba(255, 215, 0, 0.45);
    color: #f5e7b0;
    font-size: 13px;
    padding: 9px 16px;
    border-radius: 10px;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 90vw;
    animation: toast-slide-in 0.3s ease;
  }

  @keyframes toast-slide-in {
    from { opacity: 0; translate: -50% -8px; }
    to   { opacity: 1; translate: -50% 0; }
  }

  .follow-led {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(245, 231, 176, 0.6);
  }

  .follow-card { font-weight: 800; font-size: 15px; }
  .follow-sep  { color: rgba(255, 215, 0, 0.4); }
  .follow-instr strong { text-transform: capitalize; }

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

  /* Wrapper that receives the counter-transform action — transparent to layout */
  .counter-wrap {
    display: inline-flex;
    align-items: center;
    justify-content: center;
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

  .result-table .suit { font-size: 13px; }
  .result-table .pts  { font-weight: 600; color: #ccc; }
  /* A colour this player currently leads (counts toward their majority). */
  .result-table .leads .pts  { color: #ffd700; }
  .result-table .leads .suit { font-weight: 700; }

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

  /* ── Per-lane poker reveal ─────────────────────────────────────────────── */
  .lanes-title {
    align-self: flex-start;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255, 255, 255, 0.35);
    margin: -4px 0 -8px;
  }

  .lanes {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 230px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
  }

  .lane {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 10px;
    padding: 4px 8px;
    border-radius: 8px;
    opacity: 0.18;
    transition: opacity 0.35s ease;
  }

  .lane.revealed { opacity: 1; }
  .lane.scoring.p1win { animation: laneFlashP1 0.85s ease; }
  .lane.scoring.p2win { animation: laneFlashP2 0.85s ease; }

  .hand { display: flex; gap: 3px; }
  .p1-hand { justify-content: flex-end; }
  .p2-hand { justify-content: flex-start; }
  /* Dim the losing hand once a lane is resolved */
  .lane.revealed.p2win .p1-hand,
  .lane.revealed.p1win .p2-hand { opacity: 0.35; }

  .chip {
    display: inline-flex;
    align-items: baseline;
    justify-content: center;
    min-width: 22px;
    padding: 2px 4px;
    border-radius: 4px;
    color: #fff;
    font: 700 13px Georgia, serif;
    box-shadow: 0 1px 2px rgba(0,0,0,0.4);
  }

  .chip-sym { font-size: 9px; margin-left: 1px; opacity: 0.9; }

  .verdict {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    min-width: 92px;
  }

  .lane-id {
    font-size: 9px;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.35);
  }

  .lane-cat {
    font-size: 9px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
    white-space: nowrap;
  }

  .award {
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 700;
    font-size: 12px;
  }

  .lane.p2win .award { flex-direction: row-reverse; }
  .arrow { color: #ffd700; font-size: 10px; }
  .lane-tie { font-size: 10px; color: rgba(255, 255, 255, 0.3); }

  @keyframes laneFlashP1 {
    0%   { background: rgba(96, 165, 250, 0); }
    35%  { background: rgba(96, 165, 250, 0.22); }
    100% { background: rgba(96, 165, 250, 0); }
  }
  @keyframes laneFlashP2 {
    0%   { background: rgba(244, 114, 182, 0); }
    35%  { background: rgba(244, 114, 182, 0.22); }
    100% { background: rgba(244, 114, 182, 0); }
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

  .result-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
  }

  .rematch-btn {
    padding: 11px 32px;
    background: rgba(100, 180, 255, 0.15);
    border: 1px solid rgba(100, 180, 255, 0.35);
    border-radius: 30px;
    color: #64b4ff;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    width: 100%;
    max-width: 320px;
  }

  .rematch-btn:hover:not(:disabled) { background: rgba(100, 180, 255, 0.25); }

  .rematch-btn.accept {
    background: rgba(56, 161, 105, 0.18);
    border-color: rgba(56, 161, 105, 0.45);
    color: #6ee7a0;
  }

  .rematch-btn.accept:hover:not(:disabled) { background: rgba(56, 161, 105, 0.3); }

  .rematch-btn.waiting,
  .rematch-btn:disabled { opacity: 0.55; cursor: default; }

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
  .tooltip {
    position: fixed;
    background: rgba(10, 14, 26, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 11px;
    padding: 5px 9px;
    pointer-events: none;
    white-space: nowrap;
    z-index: 200;
  }
</style>
