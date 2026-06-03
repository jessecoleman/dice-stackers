<script lang="ts">
  import { goto } from '$app/navigation';

  let creating = $state(false);
  let error = $state<string | null>(null);

  async function createGame(vsAI = false) {
    creating = true;
    error = null;
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vsAI }),
      });
      if (!res.ok) throw new Error('Failed to create game');
      const { roomId } = await res.json();
      await goto(`/game/${roomId}?seat=1`);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
      creating = false;
    }
  }
</script>

<div class="landing">
  <div class="card">
    <h1 class="title">Dice Game</h1>
    <p class="subtitle">A two-player strategy game</p>

    <button class="create-btn" onclick={() => createGame(false)} disabled={creating}>
      {creating ? 'Creating…' : 'New Game'}
    </button>

    <button class="create-btn secondary" onclick={() => createGame(true)} disabled={creating}>
      Play vs Computer
    </button>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <p class="hint">
      <strong>New Game</strong> creates a room to share with Player 2.
      <strong>Play vs Computer</strong> starts immediately against the AI.
    </p>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: #111827;
    font-family: 'Segoe UI', system-ui, sans-serif;
    color: #ccc;
  }

  .landing {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 56px 72px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    text-align: center;
  }

  .title {
    font-size: 36px;
    font-weight: 800;
    color: #ffd700;
    margin: 0;
    letter-spacing: 0.04em;
  }

  .subtitle {
    font-size: 14px;
    color: #666;
    margin: 0;
  }

  .create-btn {
    margin-top: 12px;
    padding: 14px 40px;
    background: #ffd700;
    border: none;
    border-radius: 30px;
    color: #111;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .create-btn:hover:not(:disabled) { opacity: 0.85; }
  .create-btn:disabled { opacity: 0.5; cursor: default; }

  .create-btn.secondary {
    margin-top: 4px;
    background: transparent;
    border: 1px solid #ffd700;
    color: #ffd700;
  }

  .hint {
    font-size: 12px;
    color: #555;
    max-width: 260px;
    line-height: 1.5;
    margin: 4px 0 0;
  }

  .error {
    font-size: 12px;
    color: #e57373;
  }
</style>
