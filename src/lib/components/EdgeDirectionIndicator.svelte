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

  // ── Rotation per edge (arrow tip points outward) ────────────────────────────
  const rotZ = $derived(
    edge === 'top'    ?  0            :
    edge === 'bottom' ?  Math.PI      :
    edge === 'right'  ?  Math.PI / 2  :
                        -Math.PI / 2
  );

  // ── Shared dimensions ───────────────────────────────────────────────────────
  const S  = 0.15;
  const HW = S * 0.52;  // head half-width

  // ── Arrow geometry: chevron only, sitting in the outer half ─────────────────
  // Ascending: base at y=0, tip at y=+S/2 (centered coords after translate).
  // Descending: base pushed up to y=+S*0.15 so it sits higher above the bars.
  function makeChevronGeo(baseY: number): THREE.ExtrudeGeometry {
    // baseY is in centered coords; convert to pre-translate by adding S/2.
    const preBase = baseY + S / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-HW, preBase);
    shape.lineTo(  0, S);
    shape.lineTo( HW, preBase);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: false });
    g.translate(0, -S / 2, -0.004);
    return g;
  }

  const ascArrowGeo  = makeChevronGeo(0);
  const descArrowGeo = makeChevronGeo(S * 0.18);
  const arrowGeo = $derived(isAscending ? ascArrowGeo : descArrowGeo);

  // ── Bar geometry: 3 bars in the inner half, flush with the head base ─────────
  // Bars span y = -S/2 to ~0 in centered space, left edge at HW + small gap.
  // ascending  → top bar shortest, bottom bar longest (sort-asc convention)
  // descending → top bar longest, bottom bar shortest
  const BAR_H     = S * 0.10;
  const BAR_MIN_W = S * 0.25;
  const BAR_MAX_W = S * 0.75;
  // Bars are left-aligned; all share the same left edge, right edges are graduated.
  // The longest bar's right edge sits just left of the chevron base (x ≈ -HW),
  // so the graduated right side of the stack steps into the chevron's negative space.
  const BAR_LEFT  = -(BAR_MAX_W + S * 0.08);
  // Y centres in centered coords, top-to-bottom (i=0 near arrowhead base, i=2 innermost)
  const BAR_Y = [-S * 0.08, -S * 0.25, -S * 0.42];

  function makeBarGeo(ascending: boolean): THREE.ExtrudeGeometry {
    const shapes: THREE.Shape[] = BAR_Y.map((yc, i) => {
      // ascending: long at top (i=0), short at bottom — opposite of descending
      const frac  = ascending ? 1 - i / (BAR_Y.length - 1) : i / (BAR_Y.length - 1);
      const width = BAR_MIN_W + frac * (BAR_MAX_W - BAR_MIN_W);
      const s = new THREE.Shape();
      s.moveTo(BAR_LEFT,         yc - BAR_H / 2);
      s.lineTo(BAR_LEFT + width, yc - BAR_H / 2);
      s.lineTo(BAR_LEFT + width, yc + BAR_H / 2);
      s.lineTo(BAR_LEFT,         yc + BAR_H / 2);
      s.closePath();
      return s;
    });
    const g = new THREE.ExtrudeGeometry(shapes, { depth: 0.008, bevelEnabled: false });
    g.translate(0, 0, -0.004);
    return g;
  }

  const ascBarGeo  = makeBarGeo(true);
  const descBarGeo = makeBarGeo(false);
  const barGeo     = $derived(isAscending ? ascBarGeo : descBarGeo);

  const color    = $derived(isAscending ? '#4ade80' : '#fb923c');
  const emissive = $derived(isAscending ? '#166534' : '#7c2d12');
</script>

{#each GAP_OFFSETS as offset}
  {@const px = edge === 'left' ? -DIST : edge === 'right' ? DIST : offset}
  {@const pz = edge === 'top'  ? -DIST : edge === 'bottom' ? DIST : offset}

  <!-- Chevron head -->
  <T.Mesh
    geometry={arrowGeo}
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

  <!-- Stacked bars -->
  <T.Mesh
    geometry={barGeo}
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
