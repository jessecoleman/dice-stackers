<script lang="ts">
  // Renders a single played card's face as a flat plane lying on the table.
  // The plane sits just above the card body quad in CardStackSlot.
  import { T } from '@threlte/core';
  import * as THREE from 'three';
  import { createCardTexture } from '$lib/utils/cardTexture';
  import type { Card } from '$lib/gameStore.svelte';

  let {
    card,
    width,
    depth,
    surfaceY,
    // Extra Y rotation applied on top of the flat-laying -PI/2 X rotation.
    // Pass Math.PI/2 for top/bottom edge cards to align the portrait texture
    // with the board edge (X axis) instead of pointing toward the board.
    ox = 0,
    oz = 0,
    rotationZ = 0,
  }: {
    card: Card;
    width: number;
    depth: number;
    surfaceY: number;
    ox?: number;
    oz?: number;
    rotationZ?: number;
  } = $props();

  // Create the texture once in the browser; dispose on component teardown.
  let texture = $state<THREE.CanvasTexture | null>(null);

  $effect(() => {
    const t = createCardTexture(card);
    texture = t;
    return () => { t.dispose(); };
  });

  // The plane faces up (+Y) after rotating -PI/2 around X.
  // Small inset so the white card-body border shows around the face.
  const INSET = 0.05;
  const pw = $derived(width - INSET);
  const pd = $derived(depth - INSET);
</script>

{#if texture}
  <!-- Rotate -90° around X so the plane faces upward (+Y) -->
  <T.Mesh
    position={[ox, surfaceY + 0.001, oz]}
    rotation={[-Math.PI / 2, 0, rotationZ]}
  >
    <T.PlaneGeometry args={[pw, pd]} />
    <T.MeshBasicMaterial
      map={texture}
      transparent
    />
  </T.Mesh>
{/if}
