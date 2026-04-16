<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';
  import { gameStore, type Edge } from '$lib/gameStore.svelte';
  import ascUrl from '$lib/assets/ascending.svg?url';
  import descUrl from '$lib/assets/descending.svg?url';

  let { edge }: { edge: Edge } = $props();

  const isAscending = $derived(edge === 'left' || edge === 'right');

  const DIST        = 2.06;
  const GAP_OFFSETS = [-0.59, 0.59];

  // Plane orientation: tip points outward from the board per edge
  const rotZ = $derived(
    edge === 'top'    ?  0            :
    edge === 'bottom' ?  Math.PI      :
    edge === 'right'  ?  Math.PI / 2  :
                        -Math.PI / 2
  );

  // Both SVGs share the same 53×47 viewBox
  const W = 0.22;
  const H = W * (47 / 53);

  let ascTex  = $state<THREE.Texture | null>(null);
  let descTex = $state<THREE.Texture | null>(null);

  $effect(() => {
    const loader = new THREE.TextureLoader();
    const a = loader.load(ascUrl);
    a.colorSpace = THREE.SRGBColorSpace;
    a.center.set(0.5, 0.5);
    a.rotation = Math.PI;
    ascTex = a;
    const d = loader.load(descUrl);
    d.colorSpace = THREE.SRGBColorSpace;
    descTex = d;
    return () => { a.dispose(); d.dispose(); };
  });

  // Green always uses ascending.svg; orange always uses descending.svg
  const color       = $derived(isAscending ? '#4ade80' : '#fb923c');
  const tex         = $derived(isAscending ? ascTex   : descTex);
  const tooltipText = $derived(
    isAscending
      ? 'This stack must be ordered ascending'
      : 'This stack must be ordered descending'
  );
</script>

{#if tex}
  {#each GAP_OFFSETS as offset}
    {@const px = edge === 'left' ? -DIST : edge === 'right' ? DIST : offset}
    {@const pz = edge === 'top'  ? -DIST : edge === 'bottom' ? DIST : offset}

    <!-- Visual icon -->
    <T.Mesh position={[px, 0.012, pz]} rotation={[-Math.PI / 2, 0, rotZ]}>
      <T.PlaneGeometry args={[W, H]} />
      <T.MeshBasicMaterial map={tex} {color} transparent opacity={0.85} depthWrite={false} />
    </T.Mesh>
    <!-- Enlarged hit area (invisible) -->
    <T.Mesh
      position={[px, 0.013, pz]}
      rotation={[-Math.PI / 2, 0, rotZ]}
      onpointerenter={() => gameStore.setTooltip(tooltipText)}
      onpointerleave={() => gameStore.setTooltip(null)}
    >
      <T.PlaneGeometry args={[W * 2, H * 2]} />
      <T.MeshBasicMaterial transparent opacity={0} depthWrite={false} />
    </T.Mesh>
  {/each}
{/if}
