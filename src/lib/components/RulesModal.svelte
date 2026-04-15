<script lang="ts">
  let { onClose }: { onClose: () => void } = $props();

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="backdrop" role="presentation" onclick={onBackdropClick}>
  <div class="modal" role="dialog" aria-modal="true" aria-label="How to Play">
    <button class="close-btn" onclick={onClose} aria-label="Close">✕</button>

    <h2>How to Play</h2>

    <section>
      <h3>Overview</h3>
      <p>Two players compete on a 3×3 grid. You score points by owning the top die on stacks — the bigger the stack, the higher the die value, and the more stacks you control, the better.</p>
    </section>

    <section>
      <h3>Your Edges</h3>
      <p>Each player owns two edges of the board:</p>
      <ul>
        <li><strong>Player 1</strong> — bottom &amp; right edges</li>
        <li><strong>Player 2</strong> — top &amp; left edges</li>
      </ul>
      <p>Each edge has <strong>3 card slots</strong>, one aligned to each row or column of the grid.</p>
    </section>

    <section>
      <h3>Taking a Turn</h3>
      <p>Each turn, choose one action:</p>
      <ul>
        <li><strong>Play a card + place a die</strong> — play a card from your hand to one of your edge slots, then place a die on a valid cell in that slot's row or column.</li>
        <li><strong>Draw up to 6 cards</strong> — replenish your hand from the draw pile up to 6 cards.</li>
      </ul>
    </section>

    <section>
      <h3>Card Slot Rules</h3>
      <p>Each slot holds a stack of cards. When adding a card:</p>
      <ul>
        <li>No two cards in a slot may share the same suit.</li>
        <li>On <strong>left/right</strong> edges — each card played must have a <em>higher</em> value than the one below it.</li>
        <li>On <strong>top/bottom</strong> edges — each card played must have a <em>lower</em> value than the one below it.</li>
      </ul>
      <p class="example">Example: a bottom-edge slot holding a red 5 can only accept non-red cards valued 1–4.</p>
    </section>

    <section>
      <h3>Die Placement Rules</h3>
      <p>After playing a card you must place a die on a cell in that slot's <strong>row or column</strong>. The die inherits the card's suit and value. To stack onto an existing die:</p>
      <ul>
        <li>The new die's value must be <em>lower</em> than the top die.</li>
        <li>No two dice in a stack may share the same suit.</li>
      </ul>
      <p class="example">Example: a stack with a blue 4 on top can accept any non-blue die valued 1–3.</p>
    </section>

    <section>
      <h3>Scoring</h3>
      <p>Scores are calculated <em>per suit</em> across all stacks where you own the top die:</p>
      <div class="formula">Pips × Height × Stacks</div>
      <ul>
        <li><strong>Pips</strong> — highest top-die value among your stacks in that suit</li>
        <li><strong>Height</strong> — number of dice in your tallest stack of that suit</li>
        <li><strong>Stacks</strong> — how many stacks you control in that suit</li>
      </ul>
      <p class="example">Example: two red stacks (heights 3 and 1) with top values 5 and 2 → Pips 5 × Height 3 × Stacks 2 = <strong>30 pts</strong>.</p>
    </section>

    <section>
      <h3>Game End</h3>
      <p>When a player has no valid moves (no card can be played that leads to a legal die placement), the <em>other</em> player takes one final turn. The player with the higher total score wins.</p>
    </section>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .modal {
    background: rgba(12, 18, 32, 0.97);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 28px 32px 24px;
    width: min(560px, 90vw);
    max-height: 85vh;
    overflow-y: auto;
    position: relative;
    color: #bbb;
    font-size: 13px;
    line-height: 1.6;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
  }

  .close-btn {
    position: absolute;
    top: 14px;
    right: 14px;
    background: none;
    border: none;
    color: rgba(255,255,255,0.3);
    font-size: 14px;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 4px;
    line-height: 1;
  }

  .close-btn:hover { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.07); }

  h2 {
    margin: 0 0 18px;
    font-size: 17px;
    font-weight: 700;
    color: #ffd700;
    letter-spacing: 0.03em;
  }

  section {
    margin-bottom: 18px;
  }

  h3 {
    margin: 0 0 6px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255, 255, 255, 0.45);
  }

  p { margin: 0 0 6px; }

  ul {
    margin: 0 0 6px;
    padding-left: 18px;
  }

  li { margin-bottom: 3px; }

  strong { color: #ddd; }
  em { color: #aaa; font-style: normal; font-weight: 600; }

  .example {
    font-size: 11px;
    color: rgba(255,255,255,0.35);
    font-style: italic;
    background: rgba(255,255,255,0.03);
    border-left: 2px solid rgba(255,255,255,0.1);
    padding: 4px 8px;
    border-radius: 0 4px 4px 0;
    margin-top: 6px;
  }

  .formula {
    text-align: center;
    font-size: 15px;
    font-weight: 700;
    color: #ffd700;
    padding: 8px 0;
    letter-spacing: 0.05em;
  }

  @media (max-width: 600px) {
    .modal {
      padding: 20px 18px 18px;
      max-height: 90svh;
    }
  }
</style>
