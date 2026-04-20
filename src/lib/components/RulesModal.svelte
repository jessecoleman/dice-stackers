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
      <p>Two players compete on a 3×3 grid. You earn points by placing dice — and by completing sets of cards before your opponent. Your final score is your <em>lowest</em> suit total, so building evenly across all four suits matters as much as running up any one of them.</p>
    </section>

    <section>
      <h3>Your Edges</h3>
      <p>Each player owns two edges of the board:</p>
      <ul>
        <li><span class="player-dot black"></span> <strong>Player 1</strong> — dark edges</li>
        <li><span class="player-dot white"></span> <strong>Player 2</strong> — light edges</li>
      </ul>
      <p>Each edge has <strong>3 card slots</strong>, one aligned to each column or row of the grid.</p>
    </section>

    <section>
      <h3>Taking a Turn</h3>
      <p>Each turn you have <strong>2 actions</strong>. Each action is one of:</p>
      <ul>
        <li><strong>Play a card + place a die</strong> — play a card from your hand to one of your edge slots, then place a die on any valid cell in that slot's row or column.</li>
        <li><strong>Draw up to 6 cards</strong> — refill your hand from the draw pile. You may also <em>discard any number of cards first</em> by clicking them to select them (they glow red), then clicking <em>Discard &amp; Draw to 6</em>.</li>
      </ul>
      <p>You <em>cannot</em> play both actions to the same card slot in one turn.</p>
    </section>

    <section>
      <h3>Card Slot Rules</h3>
      <p>Each slot holds up to <strong>3 cards</strong>. Every card you add must keep the stack on track to complete one of these three patterns:</p>

      <div class="stack-diagrams">
        <!-- Set -->
        <div class="stack-example">
          <div class="stack-label">Set</div>
          <div class="card-stack">
            <div class="mini-card" style="--c:#e53e3e">
              <span class="mv">5</span><span class="ms">♥</span>
            </div>
            <div class="mini-card" style="--c:#3b82f6">
              <span class="mv">5</span><span class="ms">♦</span>
            </div>
            <div class="mini-card" style="--c:#38a169">
              <span class="mv">5</span><span class="ms">♣</span>
            </div>
          </div>
          <div class="stack-desc">Same value</div>
        </div>

        <!-- Run -->
        <div class="stack-example">
          <div class="stack-label">Run</div>
          <div class="card-stack">
            <div class="mini-card" style="--c:#e53e3e">
              <span class="mv">4</span><span class="ms">♥</span>
            </div>
            <div class="mini-card" style="--c:#3b82f6">
              <span class="mv">5</span><span class="ms">♦</span>
            </div>
            <div class="mini-card" style="--c:#38a169">
              <span class="mv">6</span><span class="ms">♣</span>
            </div>
          </div>
          <div class="stack-desc">Consecutive, in order</div>
        </div>

        <!-- Flush -->
        <div class="stack-example">
          <div class="stack-label">Flush</div>
          <div class="card-stack">
            <div class="mini-card" style="--c:#d69e2e">
              <span class="mv">2</span><span class="ms">★</span>
            </div>
            <div class="mini-card" style="--c:#d69e2e">
              <span class="mv">6</span><span class="ms">★</span>
            </div>
            <div class="mini-card" style="--c:#d69e2e">
              <span class="mv">4</span><span class="ms">★</span>
            </div>
          </div>
          <div class="stack-desc">Same suit, any values</div>
        </div>
      </div>

      <p>A stack may remain compatible with more than one pattern until it is full. Runs must be played in order — you cannot play 4, 6, 5.</p>
      <p class="example">Example: ♥6, ♥5 is both a valid same-color start and a run start — it can be completed with ♥4 (same color or run) or ♦4 (run only).</p>
    </section>

    <section>
      <h3>Stack Completion</h3>
      <p>When you play the third card to complete a slot, you must then place a die as normal. <em>After</em> the die lands:</p>
      <ul>
        <li>Your completed slot <strong>and</strong> the opponent's mirror slot (same position, opposite edge) are both cleared to the discard pile.</li>
        <li>You score <strong>2 points per card</strong> in the opponent's cleared mirror stack, in each card's suit.</li>
      </ul>

      <!-- Completion diagram: single row view -->
      <div class="row-diagram">

        <div class="rd-side opp">
          <div class="rd-side-label opp">Opponent</div>
          <div class="rd-cards">
            <div class="rd-card" style="--c:#e53e3e"><span class="rv">6</span><span class="rs">♥</span></div>
            <div class="rd-card" style="--c:#3b82f6"><span class="rv">6</span><span class="rs">♦</span></div>
            <div class="rd-card empty"></div>
          </div>
          <div class="rd-earn">
            <span class="rd-badge" style="--c:#e53e3e">+2♥</span>
            <span class="rd-badge" style="--c:#3b82f6">+2♦</span>
            <span class="rd-earn-note">you earn</span>
          </div>
        </div>

        <div class="rd-cells">
          <div class="rd-cell"></div>
          <div class="rd-cell has-die">
            <div class="rd-die" style="--c:#3b82f6">5</div>
          </div>
          <div class="rd-cell"></div>
        </div>

        <div class="rd-side you">
          <div class="rd-side-label you">You</div>
          <div class="rd-cards">
            <div class="rd-card" style="--c:#e53e3e"><span class="rv">3</span><span class="rs">♥</span></div>
            <div class="rd-card" style="--c:#38a169"><span class="rv">4</span><span class="rs">♣</span></div>
            <div class="rd-card" style="--c:#3b82f6"><span class="rv">5</span><span class="rs">♦</span></div>
          </div>
          <div class="rd-complete">✓ complete</div>
        </div>

      </div>

      <p class="example">Your completed run (♥3 ♣4 ♦5) clears both slots. The opponent had 2 cards — you earn +2♥ +2♦ = 4 points.</p>
    </section>

    <section>
      <h3>Die Placement Rules</h3>
      <p>After playing a card, place a die on any cell in that slot's aligned row or column. The die uses the card's suit and value. Restrictions:</p>
      <ul>
        <li>Each suit may appear <em>at most once</em> in a cell's stack.</li>
      </ul>
      <p>You score <strong>|new value − top value|</strong> points in the placed die's suit. The first die on an empty cell scores its own value.</p>

      <div class="score-diagram">

        <!-- Example 1: empty cell -->
        <div class="sd-example">
          <div class="sd-label">Empty cell</div>
          <div class="sd-placed">
            <div class="sd-die" style="--c:#9b1c1c">4</div>
            <span class="sd-suit" style="color:#9b1c1c">♥</span>
          </div>
          <div class="sd-arrow">↓</div>
          <div class="sd-cell sd-before">
            <span class="sd-empty">—</span>
          </div>
          <div class="sd-score" style="--c:#9b1c1c">+4 ♥</div>
          <div class="sd-note">scores face value</div>
        </div>

        <!-- Example 2: one die already there -->
        <div class="sd-example">
          <div class="sd-label">One die stacked</div>
          <div class="sd-placed">
            <div class="sd-die" style="--c:#1a5c38">3</div>
            <span class="sd-suit" style="color:#1a5c38">♣</span>
          </div>
          <div class="sd-arrow">↓</div>
          <div class="sd-cell sd-before">
            <div class="sd-die" style="--c:#1e429f">1</div>
          </div>
          <div class="sd-score" style="--c:#1a5c38">+2 ♣</div>
          <div class="sd-note">|3 − 1| = 2</div>
        </div>

        <!-- Example 3: two dice already there -->
        <div class="sd-example">
          <div class="sd-label">Two dice stacked</div>
          <div class="sd-placed">
            <div class="sd-die" style="--c:#92640a">4</div>
            <span class="sd-suit" style="color:#92640a">★</span>
          </div>
          <div class="sd-arrow">↓</div>
          <div class="sd-cell sd-before">
            <div class="sd-die" style="--c:#1e429f">5</div>
            <div class="sd-die" style="--c:#9b1c1c">2</div>
          </div>
          <div class="sd-score" style="--c:#92640a">+1 ★</div>
          <div class="sd-note">|4 − 5| = 1</div>
        </div>

      </div>

      <p class="example">The score is always based on the <em>top</em> die in the cell. Placing a low die onto a high die can score big — or small if values are close.</p>
    </section>

    <section>
      <h3>4-Color Bonus</h3>
      <p>If placing a die gives a single cell all four suits (red, blue, green, yellow), the entire stack is cleared and you may <strong>steal one card</strong> from your opponent's hand — click the back of any card in their hand to take it.</p>
    </section>

    <section>
      <h3>Scoring</h3>
      <p>Points accumulate per suit throughout the game (from die placement and stack clears). Your <strong>final score is the minimum across all four suits</strong> — a weak suit drags your total down, so spread your scoring evenly.</p>

      <div class="min-diagram">
        <div class="min-suits">
          <div class="min-suit">
            <span class="min-val" style="color:#9b1c1c">8</span>
            <div class="min-bar-wrap">
              <div class="min-bar" style="--h:64px; --c:#9b1c1c"></div>
            </div>
            <span class="min-sym" style="color:#9b1c1c">♥</span>
          </div>
          <div class="min-suit">
            <span class="min-val min-val-lowest" style="color:#1e429f">5</span>
            <div class="min-bar-wrap">
              <div class="min-bar min-bar-lowest" style="--h:40px; --c:#1e429f"></div>
            </div>
            <span class="min-sym" style="color:#1e429f">♦</span>
          </div>
          <div class="min-suit">
            <span class="min-val" style="color:#1a5c38">9</span>
            <div class="min-bar-wrap">
              <div class="min-bar" style="--h:72px; --c:#1a5c38"></div>
            </div>
            <span class="min-sym" style="color:#1a5c38">♣</span>
          </div>
          <div class="min-suit">
            <span class="min-val" style="color:#92640a">6</span>
            <div class="min-bar-wrap">
              <div class="min-bar" style="--h:48px; --c:#92640a"></div>
            </div>
            <span class="min-sym" style="color:#92640a">★</span>
          </div>
          <!-- floor line at the top of the lowest (40px) bar, above the 20px symbol row -->
          <div class="min-floor-line" style="bottom: calc(20px + 40px)">
            <span class="min-floor-label">lowest</span>
          </div>
        </div>
        <div class="min-result">
          <span class="min-eq">final score =</span>
          <span class="min-final">5</span>
        </div>
      </div>
    </section>

    <section>
      <h3>Game End</h3>
      <p>The game ends when either:</p>
      <ul>
        <li>A player has no valid moves, <strong>or</strong></li>
        <li>The draw deck has been cycled through <strong>3 times</strong> (the discard pile is shuffled into the draw pile at most twice).</li>
      </ul>
      <p>When the end condition is met, the other player takes one final turn. The player with the higher score wins.</p>
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

  .player-dot {
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    vertical-align: middle;
    margin-right: 2px;
  }
  .player-dot.black { background: #111; border: 1px solid rgba(255,255,255,0.25); }
  .player-dot.white { background: #fff; border: 1px solid rgba(255,255,255,0.5); }

  .arrow-green { color: #4ade80; font-weight: 600; }
  .arrow-amber { color: #fb923c; font-weight: 600; }
  em { color: #aaa; font-style: normal; font-weight: 600; }

  /* ── Completion diagram ── */
  .row-diagram {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    padding: 12px 10px;
    margin: 10px 0;
  }

  .rd-side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    flex: 0 0 auto;
    min-width: 44px;
    overflow: visible;
  }

  .rd-side-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .rd-side-label.opp { color: #f472b6; }
  .rd-side-label.you { color: #60a5fa; }

  .rd-cards {
    display: flex;
    flex-direction: row;
    gap: 0;
    align-items: center;
    overflow: visible;
  }

  .rd-side.opp .rd-card {
    transform: rotate(90deg);
  }

  .rd-side.you .rd-card {
    transform: rotate(-90deg);
  }

  /* Overlap cards horizontally — board-facing edge of each card peeks out */
  .rd-cards .rd-card:not(:last-child) {
    margin-right: -20px;
  }

  /* OPP: leftmost card on top so right cards' board-facing edges remain visible */
  .rd-side.opp .rd-cards .rd-card { position: relative; }
  .rd-side.opp .rd-cards .rd-card:nth-child(1) { z-index: 3; }
  .rd-side.opp .rd-cards .rd-card:nth-child(2) { z-index: 2; }
  .rd-side.opp .rd-cards .rd-card:nth-child(3) { z-index: 1; }

  /* YOU: rightmost card on top so left cards' board-facing edges remain visible */
  .rd-side.you .rd-cards .rd-card { position: relative; }
  .rd-side.you .rd-cards .rd-card:nth-child(1) { z-index: 1; }
  .rd-side.you .rd-cards .rd-card:nth-child(2) { z-index: 2; }
  .rd-side.you .rd-cards .rd-card:nth-child(3) { z-index: 3; }

  .rd-card {
    width: 32px;
    height: 44px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--c) 22%, #1a1f2e);
    border: 1px solid color-mix(in srgb, var(--c) 55%, transparent);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding-top: 5px;
    gap: 2px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  }

  .rd-card.empty {
    background: rgba(255,255,255,0.02);
    border: 1px dashed rgba(255,255,255,0.1);
    box-shadow: none;
  }

  .rv { font-size: 11px; font-weight: 700; color: var(--c); line-height: 1; }
  .rs { font-size: 9px; color: color-mix(in srgb, var(--c) 80%, white); line-height: 1; }

  .rd-earn {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 3px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .rd-badge {
    font-size: 9px;
    font-weight: 700;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--c) 35%, transparent);
    border-radius: 3px;
    padding: 1px 3px;
    line-height: 1.3;
  }

  .rd-earn-note {
    font-size: 8px;
    color: rgba(255,255,255,0.3);
    line-height: 1;
  }

  .rd-cells {
    display: flex;
    flex-direction: row;
    gap: 3px;
    flex: 1;
    align-items: center;
    justify-content: center;
  }

  .rd-cell {
    width: 36px;
    height: 44px;
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.015);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }

  .rd-cell.has-die {
    border-color: color-mix(in srgb, #3b82f6 50%, transparent);
    background: rgba(59,130,246,0.08);
  }

  .rd-die {
    width: 20px;
    height: 20px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--c) 30%, #1a1f2e);
    border: 1px solid color-mix(in srgb, var(--c) 60%, transparent);
    font-size: 11px;
    font-weight: 700;
    color: var(--c);
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .rd-die-note {
    font-size: 8px;
    color: rgba(255,255,255,0.3);
    line-height: 1;
  }

  .rd-complete {
    font-size: 9px;
    font-weight: 700;
    color: #4ade80;
  }

  /* ── Stack diagrams ── */
  .stack-diagrams {
    display: flex;
    gap: 12px;
    margin: 10px 0 10px;
    justify-content: space-between;
  }

  .stack-example {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px;
    padding: 10px 6px 8px;
  }

  .stack-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255,255,255,0.5);
  }

  .card-stack {
    display: flex;
    flex-direction: column;
    gap: 3px;
    align-items: center;
  }

  .mini-card {
    width: 42px;
    height: 30px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--c) 22%, #1a1f2e);
    border: 1px solid color-mix(in srgb, var(--c) 55%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  }

  .mv {
    font-size: 13px;
    font-weight: 700;
    color: var(--c);
    line-height: 1;
  }

  .ms {
    font-size: 11px;
    color: color-mix(in srgb, var(--c) 80%, white);
    line-height: 1;
  }

  .stack-desc {
    font-size: 10px;
    color: rgba(255,255,255,0.3);
    text-align: center;
  }

  /* ── Score diagram ── */
  .score-diagram {
    display: flex;
    gap: 10px;
    margin: 10px 0;
    justify-content: space-between;
  }

  .sd-example {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px;
    padding: 10px 6px 8px;
  }

  .sd-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: rgba(255,255,255,0.4);
    margin-bottom: 2px;
  }

  .sd-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 3px;
    min-height: 52px;
    width: 36px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 5px;
    padding: 4px 4px 4px;
  }

  .sd-empty {
    font-size: 14px;
    color: rgba(255,255,255,0.15);
    line-height: 1;
  }

  .sd-arrow {
    font-size: 14px;
    color: rgba(255,255,255,0.25);
    line-height: 1;
  }

  .sd-placed {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }

  .sd-die {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--c) 25%, #1a1f2e);
    border: 1px solid color-mix(in srgb, var(--c) 55%, transparent);
    font-size: 12px;
    font-weight: 700;
    color: color-mix(in srgb, var(--c) 90%, white);
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .sd-suit {
    font-size: 10px;
    line-height: 1;
  }

  .sd-score {
    font-size: 13px;
    font-weight: 700;
    color: var(--c);
    margin-top: 2px;
  }

  .sd-note {
    font-size: 9px;
    color: rgba(255,255,255,0.3);
    text-align: center;
  }

  /* ── Min score diagram ── */
  .min-diagram {
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    padding: 12px 16px 10px;
    margin: 10px 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .min-suits {
    position: relative;
    display: flex;
    gap: 16px;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 2px;
  }

  .min-suit {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .min-val {
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
  }

  .min-val-lowest {
    font-size: 14px;
    text-shadow: 0 0 8px currentColor;
  }

  .min-bar-wrap {
    display: flex;
    align-items: flex-end;
  }

  .min-bar {
    width: 28px;
    height: var(--h);
    border-radius: 3px 3px 0 0;
    background: color-mix(in srgb, var(--c) 35%, #1a1f2e);
    border: 1px solid color-mix(in srgb, var(--c) 55%, transparent);
    border-bottom: none;
    opacity: 0.7;
  }

  .min-bar-lowest {
    opacity: 1;
    box-shadow: 0 0 8px color-mix(in srgb, var(--c) 50%, transparent);
  }

  .min-sym {
    font-size: 13px;
    line-height: 1;
  }

  .min-floor-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: rgba(255,255,255,0.25);
    border-radius: 1px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 4px;
  }

  .min-floor-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255,255,255,0.35);
    white-space: nowrap;
    position: absolute;
    right: 0;
    top: 4px;
  }

  .min-result {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 8px;
  }

  .min-eq {
    font-size: 11px;
    color: rgba(255,255,255,0.4);
  }

  .min-final {
    font-size: 22px;
    font-weight: 700;
    color: #ffd700;
    text-shadow: 0 0 10px rgba(255,215,0,0.4);
  }

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

  @media (max-width: 600px) {
    .modal {
      padding: 20px 18px 18px;
      max-height: 90svh;
    }
  }
</style>
