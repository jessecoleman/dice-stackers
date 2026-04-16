<script lang="ts">
  import { T } from '@threlte/core';
  import { onMount } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import CardFace3D from './CardFace3D.svelte';
  import type { Card } from '$lib/gameStore.svelte';
  import type * as THREE from 'three';

  let {
    card,
    cardGeo,
    cardW,
    cardD,
    isHorizEdge,
    y,
    ox,
    oz,
    faceRotZ,
    cardH,
    suitColor,
    isLogHovered = false,
  }: {
    card: Card;
    cardGeo: THREE.ExtrudeGeometry | null;
    cardW: number;
    cardD: number;
    isHorizEdge: boolean;
    y: number;
    ox: number;
    oz: number;
    faceRotZ: number;
    cardH: number;
    suitColor: string;
    isLogHovered?: boolean;
  } = $props();

  const ANIM = { duration: 420, easing: cubicOut };
  // Flip-down: card starts standing upright and elevated, lands flat on the table.
  const flipRot = new Tween(-Math.PI / 2, { duration: 0 });
  const dropY   = new Tween(1.8,         { duration: 0 });
  onMount(() => {
    flipRot.set(0, ANIM);
    dropY.set(0,   ANIM);
  });
</script>

<T.Group position={[ox, y + dropY.current, oz]} rotation={[flipRot.current, 0, 0]}>
  {#if cardGeo}
    <T.Mesh geometry={cardGeo} rotation={[-Math.PI / 2, 0, 0]}>
      <T.MeshStandardMaterial
        color={suitColor}
        roughness={0.35}
        metalness={0.55}
        emissive={isLogHovered ? '#ffffff' : '#000000'}
        emissiveIntensity={isLogHovered ? 0.7 : 0}
      />
    </T.Mesh>
  {/if}
  <CardFace3D
    {card}
    width={isHorizEdge ? cardW : cardD}
    depth={isHorizEdge ? cardD : cardW}
    surfaceY={cardH / 2}
    ox={0}
    oz={0}
    rotationZ={faceRotZ}
  />
</T.Group>
