<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';
  import type { Edge } from '$lib/gameStore.svelte';

  let { edge }: { edge: Edge } = $props();

  // left/right = ascending, top/bottom = descending
  const isAscending = $derived(edge === 'left' || edge === 'right');

  // Placed between board rim (~1.85) and card slots (~2.25)
  const DIST = 2.06;

  // The two gap positions between the 3 slots (slots sit at -1.18, 0, +1.18)
  const GAP_OFFSETS = [-0.59, 0.59];

  // ── Arrow geometry (shared) ─────────────────────────────────────────────────
  // Shape in XY plane, tip pointing +Y. After rotation the tip ends up pointing
  // outward from the board. Final tip direction = (-sin(rotZ), 0, -cos(rotZ))
  // for a mesh with rotation.x = -PI/2, rotation.z = rotZ.
  // Outward per edge:
  //   bottom (+Z): rotZ = PI    top (-Z): rotZ = 0
  //   right  (+X): rotZ = -PI/2  left (-X): rotZ = PI/2
  const rotZ = $derived(
    edge === 'top'    ?  0            :
    edge === 'bottom' ?  Math.PI      :
    edge === 'right'  ?  Math.PI / 2  :
                        -Math.PI / 2
  );

  const S  = 0.15;
  const SW = S * 0.28;
  const HW = S * 0.52;
  const SL = S * 0.52;
  const HL = S * 0.48;

  const geo = (() => {
    const shape = new THREE.Shape();
    shape.moveTo(-SW, 0);
    shape.lineTo(-SW, SL);
    shape.lineTo(-HW, SL);
    shape.lineTo(0,   SL + HL);
    shape.lineTo( HW, SL);
    shape.lineTo( SW, SL);
    shape.lineTo( SW, 0);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.007, bevelEnabled: false });
    g.translate(0, -S / 2, -0.0035);
    return g;
  })();

  const color    = $derived(isAscending ? '#4ade80' : '#fb923c');
  const emissive = $derived(isAscending ? '#166534' : '#7c2d12');
</script>

{#each GAP_OFFSETS as offset}
  {@const px = edge === 'left' ? -DIST : edge === 'right' ? DIST : offset}
  {@const pz = edge === 'top'  ? -DIST : edge === 'bottom' ? DIST : offset}
  <T.Mesh
    geometry={geo}
    position={[px, 0.01, pz]}
    rotation={[-Math.PI / 2, 0, rotZ]}
  >
    <T.MeshStandardMaterial
      {color}
      emissive={emissive}
      emissiveIntensity={0.4}
      roughness={0.4}
      metalness={0.1}
      transparent
      opacity={0.85}
    />
  </T.Mesh>
{/each}
