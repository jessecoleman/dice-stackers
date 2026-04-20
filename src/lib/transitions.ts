import { crossfade } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';

const [_send, _receive] = crossfade({
  duration: 480,
  easing: cubicOut,
  fallback(_node: Element, _params: object, intro: boolean): TransitionConfig {
    return {
      duration: 240,
      easing: cubicOut,
      css: (t: number) =>
        intro
          ? `opacity: ${t}; transform: translateY(${(1 - t) * 40}px)`
          : `opacity: ${t}`
    };
  }
});

export { _send as send };

/** receive with a rotateY arc so the card appears to flip face-up on arrival */
export function receive(
  node: Element,
  params: { key: unknown }
): TransitionConfig | (() => TransitionConfig) {
  const result = _receive(node, params);

  function wrapConfig(config: TransitionConfig): TransitionConfig {
    const origCss = config.css;
    if (!origCss) return config;
    return {
      ...config,
      css(t: number, u: number): string {
        const base = origCss(t, u);
        // Arc through 90° at midpoint — card briefly goes edge-on then faces up
        const flip = Math.sin(u * Math.PI) * 90;
        // Insert rotateY into the transform already set by crossfade
        return base.replace(/(transform:[^;]+)/, `$1 rotateY(${flip}deg)`);
      }
    };
  }

  if (typeof result === 'function') {
    return () => wrapConfig((result as () => TransitionConfig)());
  }
  return wrapConfig(result);
}
