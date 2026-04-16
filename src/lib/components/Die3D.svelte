<script lang="ts">
  import { T } from '@threlte/core';
  import { useCursor, RoundedBoxGeometry } from '@threlte/extras';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { createDieLabelTexture } from '$lib/utils/cardTexture';
  import type { Die } from '$lib/gameStore.svelte';

  let {
    die,
    position = [0, 0, 0],
    interactive = true,
    highlighted = false,
  }: {
    die: Die;
    position?: [number, number, number];
    interactive?: boolean;
    highlighted?: boolean;
  } = $props();

  const { onPointerEnter, onPointerLeave } = useCursor();

  const colors: Record<string, string> = {
    red:    '#e53e3e',
    blue:   '#3b82f6',
    green:  '#38a169',
    yellow: '#d69e2e',
  };

  const DIE_SIZE  = 0.544;
  const DIE_HALF  = DIE_SIZE / 2;
  const LABEL_Y   = DIE_HALF + 0.001; // just above the top face

  const color     = $derived(colors[die.color] ?? '#888');
  const textColor = $derived(die.player === 1 ? '#111111' : '#ffffff');

  let labelTex = $state<ReturnType<typeof createDieLabelTexture> | null>(null);
  $effect(() => {
    const t = createDieLabelTexture(die.value, textColor);
    labelTex = t;
    return () => t.dispose();
  });

  let hovered = $state(false);

  // Drop-in animation
  const ANIM = { duration: 300, easing: cubicOut };
  const dropY   = new Tween(1.0, { duration: 0 });
  const opacity = new Tween(0,   { duration: 0 });
  $effect(() => {
    dropY.set(0,   ANIM);
    opacity.set(1, ANIM);
  });
</script>

<T.Group position={[position[0], position[1] + dropY.current, position[2]]}>
  <!-- Die body -->
  <T.Mesh
    castShadow
    onpointerenter={(e: any) => {
      if (!interactive) return;
      e.stopPropagation();
      onPointerEnter();
      hovered = true;
    }}
    onpointerleave={(e: any) => {
      if (!interactive) return;
      e.stopPropagation();
      onPointerLeave();
      hovered = false;
    }}
  >
    <RoundedBoxGeometry args={[DIE_SIZE, DIE_SIZE, DIE_SIZE]} radius={DIE_SIZE * 0.08} smoothness={3} />
    <T.MeshPhysicalMaterial
      color={color}
      transmission={0.55}
      roughness={0.4}
      thickness={DIE_SIZE}
      ior={1.45}
      transparent={true}
      opacity={opacity.current}
      emissive={color}
      emissiveIntensity={hovered && interactive ? 0.35 : highlighted ? 0.4 : 0.05}
    />
  </T.Mesh>

  <!-- Numerals on all faces -->
  {#if labelTex}
    {@const labelRotZ = die.edge === 'top' ? Math.PI : die.edge === 'right' ? Math.PI / 2 : die.edge === 'left' ? 3 * Math.PI / 2 : 0}
    <!-- Top face -->
    <T.Mesh position={[0, LABEL_Y, 0]} rotation={[-Math.PI / 2, 0, labelRotZ]}>
      <T.PlaneGeometry args={[DIE_SIZE * 0.8, DIE_SIZE * 0.8]} />
      <T.MeshBasicMaterial map={labelTex} transparent={true} opacity={opacity.current} depthWrite={false} />
    </T.Mesh>
    <!-- Front face (+Z) -->
    <T.Mesh position={[0, 0, DIE_HALF + 0.001]} rotation={[0, 0, 0]}>
      <T.PlaneGeometry args={[DIE_SIZE * 0.8, DIE_SIZE * 0.8]} />
      <T.MeshBasicMaterial map={labelTex} transparent={true} opacity={opacity.current} depthWrite={false} />
    </T.Mesh>
    <!-- Back face (-Z) -->
    <T.Mesh position={[0, 0, -(DIE_HALF + 0.001)]} rotation={[0, Math.PI, 0]}>
      <T.PlaneGeometry args={[DIE_SIZE * 0.8, DIE_SIZE * 0.8]} />
      <T.MeshBasicMaterial map={labelTex} transparent={true} opacity={opacity.current} depthWrite={false} />
    </T.Mesh>
    <!-- Right face (+X) -->
    <T.Mesh position={[DIE_HALF + 0.001, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      <T.PlaneGeometry args={[DIE_SIZE * 0.8, DIE_SIZE * 0.8]} />
      <T.MeshBasicMaterial map={labelTex} transparent={true} opacity={opacity.current} depthWrite={false} />
    </T.Mesh>
    <!-- Left face (-X) -->
    <T.Mesh position={[-(DIE_HALF + 0.001), 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
      <T.PlaneGeometry args={[DIE_SIZE * 0.8, DIE_SIZE * 0.8]} />
      <T.MeshBasicMaterial map={labelTex} transparent={true} opacity={opacity.current} depthWrite={false} />
    </T.Mesh>
  {/if}
</T.Group>
