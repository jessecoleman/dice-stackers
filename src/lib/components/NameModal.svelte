<script lang="ts">
  let { onSave }: { onSave: (name: string) => void } = $props();

  const LS_KEY = 'player-name';

  let name = $state(
    typeof localStorage !== 'undefined' ? (localStorage.getItem(LS_KEY) ?? '') : ''
  );

  function submit() {
    const trimmed = name.trim();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_KEY, trimmed);
    }
    onSave(trimmed);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') submit();
  }
</script>

<div class="backdrop">
  <div class="modal" role="dialog" aria-modal="true" aria-label="Enter your name">
    <h2>What's your name?</h2>
    <p>This will be shown to your opponent.</p>
    <input
      class="name-input"
      type="text"
      placeholder="Your name"
      maxlength="20"
      bind:value={name}
      onkeydown={onKeyDown}
      autofocus
    />
    <button class="save-btn" onclick={submit}>
      Start Playing
    </button>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .modal {
    background: rgba(12, 18, 32, 0.97);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 36px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    width: min(360px, 90vw);
  }

  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #ffd700;
  }

  p {
    margin: 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.35);
  }

  .name-input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 16px;
    color: #fff;
    outline: none;
    text-align: center;
    transition: border-color 0.15s;
  }

  .name-input:focus {
    border-color: rgba(255, 215, 0, 0.5);
  }

  .name-input::placeholder {
    color: rgba(255, 255, 255, 0.2);
  }

  .save-btn {
    margin-top: 4px;
    padding: 12px 36px;
    background: #ffd700;
    border: none;
    border-radius: 30px;
    color: #111;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .save-btn:hover { opacity: 0.85; }
</style>
