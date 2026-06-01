<script lang="ts">
  import { T } from '@threlte/core';
  import { onMount } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import CardFace3D from './CardFace3D.svelte';
  import { upFace, type PlacedCard } from '$lib/gameStore.svelte';
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
    isLead = false,
  }: {
    card: PlacedCard;
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
    isLead?: boolean;
  } = $props();

  const up   = $derived(upFace(card));
  const down = $derived(card.faces[card.orientation === 0 ? 1 : 0]);

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
  <!-- Lead-card halo: gold frame peeking out beneath the card so the follower
       can see which suit/axis they must respond to. -->
  {#if isLead}
    <T.Mesh position={[0, -0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <T.PlaneGeometry args={[(isHorizEdge ? cardW : cardD) + 0.16, (isHorizEdge ? cardD : cardW) + 0.16]} />
      <T.MeshBasicMaterial color="#ffd700" transparent opacity={0.95} depthWrite={false} />
    </T.Mesh>
  {/if}
  {#if cardGeo}
    <T.Mesh geometry={cardGeo} rotation={[-Math.PI / 2, 0, 0]}>
      <T.MeshStandardMaterial
        color={suitColor}
        roughness={0.95}
        metalness={0}
        emissive={isLead ? '#ffd700' : isLogHovered ? '#ffffff' : '#000000'}
        emissiveIntensity={isLead ? 0.55 : isLogHovered ? 0.7 : 0}
      />
    </T.Mesh>
  {/if}
  <CardFace3D
    {up}
    {down}
    width={isHorizEdge ? cardW : cardD}
    depth={isHorizEdge ? cardD : cardW}
    surfaceY={cardH / 2}
    ox={0}
    oz={0}
    rotationZ={faceRotZ}
  />
</T.Group>
