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
      <p>A trick-taking game for two on a 3×3 grid. Win tricks to place your color dice on the board, then score the most points. Play continues until every card stack is full.</p>
    </section>

    <section>
      <h3>Your Edges</h3>
      <p>Each player owns two edges of the board, holding six card stacks in all:</p>
      <ul>
        <li><strong>Player 1</strong> — bottom &amp; right edges</li>
        <li><strong>Player 2</strong> — top &amp; left edges</li>
      </ul>
      <p>Each edge has <strong>3 stacks</strong>, one per row or column, and each stack holds up to 3 cards.</p>
    </section>

    <section>
      <h3>Leading a Trick</h3>
      <p>The leader plays one card from hand into any of their own stacks — on a <strong>row</strong> or a <strong>column</strong> — that still has room. There is no ordering restriction, and <em>no die is placed</em> when leading.</p>
    </section>

    <section>
      <h3>Following</h3>
      <p>The opponent must respond on the <strong>opposite axis</strong>: if the leader played a row, the follower plays a column, and vice-versa. You must <strong>follow the led suit</strong> if you hold it. The follower places a die matching their card's color and value where the two stacks' row and column cross, stacked on whatever is already there.</p>
    </section>

    <section>
      <h3>Winning the Trick</h3>
      <p>The highest card of the <strong>led suit</strong> wins the trick. A follower who can't follow suit can play any card but cannot win. The trick winner leads the next trick. Once your hand is used up you draw a fresh one.</p>
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
      <p>The game ends when every card stack is full (three cards each). The player with the higher total score wins.</p>
    </section>

    <section>
      <h3>Strategic Tips</h3>
      <ul class="tips">
        <li><strong>Hold your high cards of each suit.</strong> Only the led suit can win a trick, so a top card is your key to seizing the lead — and the lead is what lets you dictate which axis the next die lands on.</li>
        <li><strong>Watch where the die falls.</strong> The follower's die always lands at the intersection of the two stacks. Plan which row and column you commit to so your dice build tall stacks in your own color rather than burying them under the opponent's.</li>
        <li><strong>Losing a trick isn't always bad.</strong> Only the follower places a die, so deliberately following low can plant a die exactly where you want it while letting the opponent keep a lead they may not want.</li>
      </ul>
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
  ul.tips li { margin-bottom: 10px; }

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
