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
      <p>A trick-taking game for two on a 3×3 grid. Each trick, the loser drops a colored die onto the board; meanwhile both players build poker hands along their edges. When every card stack is full, the higher score wins.</p>
    </section>

    <section>
      <h3>Colors &amp; Cards</h3>
      <p>Three suits — <strong>Red</strong>, <strong>Green</strong>, <strong>Blue</strong> — form a rock-paper-scissors cycle: <strong>Red beats Green, Green beats Blue, Blue beats Red</strong>. No color is strongest overall.</p>
      <p>Every card is <strong>dual-sided</strong> with a <strong>split</strong> value: a high face in one color against a low face in another (the two add to 7), cycling so high red sits opposite low blue, high blue opposite low green, and high green opposite low red. When you play a card you choose which face is up — picking both its suit <em>and</em> its value.</p>
    </section>

    <section>
      <h3>Your Edges</h3>
      <p>Each player owns two edges, holding six card stacks in all:</p>
      <ul>
        <li><strong>Player 1</strong> — bottom &amp; right edges</li>
        <li><strong>Player 2</strong> — top &amp; left edges</li>
      </ul>
      <p>Each edge has <strong>3 stacks</strong> (one per row or column), each holding up to 3 cards. These stacks become your <strong>poker hands</strong> at the end.</p>
    </section>

    <section>
      <h3>Hands &amp; Even Fill</h3>
      <p>You play <strong>2 hands of 9 cards</strong> over the game. Stacks must <strong>fill evenly</strong>: every one of your six lanes (3 rows + 3 columns) must reach height 1 before any reaches 2, and 2 before any reaches 3. So a lane is open only when it's at the current fill level — you can't load up one stack early.</p>
    </section>

    <section>
      <h3>Leading a Trick</h3>
      <p>The leader plays a card into one of their own stacks on a chosen <strong>row</strong> or <strong>column</strong> that's still open under even-fill, choosing which color is up — this sets the <strong>led suit</strong> and value. <em>No die is placed when leading.</em></p>
    </section>

    <section>
      <h3>Following</h3>
      <p>The follower responds in one of their own stacks on the <strong>opposite axis</strong> (leader played a row → follower plays a column, and vice-versa) that's still open under even-fill. Key rule — <strong>you must NOT follow the led suit</strong>: the color you play up must differ from the led color. (Your card's second color always makes this possible.)</p>
    </section>

    <section>
      <h3>Winning the Trick</h3>
      <p>The <strong>higher value</strong> wins. On a tie, rock-paper-scissors breaks it (e.g. Red vs Blue → <strong>Blue</strong>, since Blue beats Red). The winner leads the next trick. When your hand runs out, you draw a fresh one.</p>
    </section>

    <section>
      <h3>Placing the Die</h3>
      <p>The <strong>loser</strong> drops a die of their own card's color and value where the two stacks' row and column cross — but only if that cell holds <em>no die of that color yet</em>. Each cell keeps at most one die per color, so stacks cap at <strong>height 3</strong>. If that color is already there, no die is placed. The loser <strong>scores</strong> the die they place.</p>
    </section>

    <section>
      <h3>Scoring</h3>
      <p>Two sources feed three color pools (R / G / B):</p>
      <p><strong>Dice (during play)</strong> — the loser scores the die they place, in the die's color:</p>
      <div class="formula">die value × stack height</div>
      <p class="example">A 6 landing on the second level of a stack → 6 × 2 = <strong>12 pts</strong> in that color.</p>
      <p><strong>Poker (at the end)</strong> — each of your 6 edge lanes is compared to the opposing stack as a 3-card hand (straight flush &gt; three of a kind &gt; straight &gt; flush &gt; pair &gt; high card; ties broken by RPS). Win a lane to score <strong>each card's value</strong> in its own color (e.g. 5♥ 3♥ 2♣ → +8 red, +2 green).</p>
      <p>To win, compare pools <strong>color by color</strong> and take the <strong>majority — lead 2 of the 3 colors</strong>:</p>
      <div class="formula">win = lead 2 of 3 colors</div>
      <p>If neither player leads two colors, the tie goes to whoever has the larger <strong>second-highest</strong> color total. Spread your points — winning one color big but losing the other two loses the game.</p>
    </section>

    <section>
      <h3>Game End</h3>
      <p>The game ends when every card stack is full (three cards each). Whoever leads the majority — <strong>2 of the 3 colors</strong> — wins.</p>
    </section>

    <section>
      <h3>Strategic Tips</h3>
      <ul class="tips">
        <li><strong>Losing a trick scores the points.</strong> The loser places the die and banks value × height, so deliberately losing — especially a high die onto a tall stack in a color you're short on — is often the right play.</li>
        <li><strong>Fight for two colors.</strong> You win by leading 2 of the 3 colors, so contest the color matchups you can flip rather than running up a single color you already lead.</li>
        <li><strong>Each face is a trade-off.</strong> A card's two faces split a high value in one color against a low value in another — orientation picks both the suit and the value you commit, for the trick, the die's color, and your poker hands.</li>
        <li><strong>Watch the intersection.</strong> The die lands where the two stacks cross, and a color already sitting there blocks it (no die, no points) — handy for denying the opponent.</li>
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
