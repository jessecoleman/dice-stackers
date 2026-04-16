let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** Play a short two-note "your turn" chime. */
export function playYourTurnChime() {
  try {
    const ac = getCtx();
    if (ac.state === 'suspended') ac.resume();

    const now = ac.currentTime;

    // Two ascending tones: C5 → E5
    const notes = [523.25, 659.25];
    notes.forEach((freq, i) => {
      const osc  = ac.createOscillator();
      const gain = ac.createGain();

      osc.connect(gain);
      gain.connect(ac.destination);

      osc.type      = 'sine';
      osc.frequency.value = freq;

      const start = now + i * 0.14;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);

      osc.start(start);
      osc.stop(start + 0.5);
    });
  } catch {
    // AudioContext blocked or unavailable — fail silently
  }
}
