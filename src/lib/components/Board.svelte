<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';
  import GridCell from './GridCell.svelte';
  import CardStackSlot from './CardStackSlot.svelte';
  import EdgeDirectionIndicator from './EdgeDirectionIndicator.svelte';
  import { createWoodTexture } from '$lib/utils/cardTexture';
  import type { Edge } from '$lib/gameStore.svelte';

  const EDGES: Edge[] = ['top', 'bottom', 'left', 'right'];

  const CELL_SIZE = 1.1;
  const GAP = 0.08;
  const STEP = CELL_SIZE + GAP;
  const OFFSET = -STEP; // center the 3x3 around origin

  function cellPos(i: number): number {
    return OFFSET + i * STEP;
  }

  // Rounded-rectangle extrusion: flat top/bottom, rounded XZ corners only.
  // Shape is in XY plane; mesh is rotated -π/2 on X so shape-Y maps to world-Z.
  function makeRoundedSlab(w: number, depth: number, h: number, r: number): THREE.ExtrudeGeometry {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + r, -depth / 2);
    shape.lineTo( w / 2 - r, -depth / 2);
    shape.quadraticCurveTo( w / 2, -depth / 2,  w / 2, -depth / 2 + r);
    shape.lineTo( w / 2,  depth / 2 - r);
    shape.quadraticCurveTo( w / 2,  depth / 2,  w / 2 - r,  depth / 2);
    shape.lineTo(-w / 2 + r,  depth / 2);
    shape.quadraticCurveTo(-w / 2,  depth / 2, -w / 2,  depth / 2 - r);
    shape.lineTo(-w / 2, -depth / 2 + r);
    shape.quadraticCurveTo(-w / 2, -depth / 2, -w / 2 + r, -depth / 2);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  }

  let boardGeo = $state<THREE.ExtrudeGeometry | null>(null);
  let trimGeo  = $state<THREE.ExtrudeGeometry | null>(null);

  $effect(() => {
    const bg = makeRoundedSlab(7.5, 7.5, 0.18, 0.5);
    const tg = makeRoundedSlab(7.2, 7.2, 0.06, 0.5);
    boardGeo = bg;
    trimGeo  = tg;
    return () => { bg.dispose(); tg.dispose(); };
  });

  let woodTex = $state<THREE.CanvasTexture | null>(null);
  $effect(() => {
    const t = createWoodTexture();
    woodTex = t;
    return () => t.dispose();
  });

  // ── Player-border corner geometry ────────────────────────────────────────────
  // Strips are 0.38 wide (h=0.19). The two mixed corners need 45° triangles.
  // Shape is defined in XY plane; rotation=[+π/2,0,0] maps shape-Y → world-Z
  // and extrudes downward in world-Y so the surface sits at position_y=-0.01.
  const h = 0.19;
  function makeCornerTri(
    v0: [number, number], v1: [number, number], v2: [number, number]
  ): THREE.ExtrudeGeometry {
    const shape = new THREE.Shape();
    shape.moveTo(v0[0], v0[1]);
    shape.lineTo(v1[0], v1[1]);
    shape.lineTo(v2[0], v2[1]);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
  }

  // near-left corner (cx=-3.56, cz=+3.56): near=white, left=black
  //   diagonal: inner(+h,-h) → outer(-h,+h)
  let nlWhiteGeo = $state<THREE.ExtrudeGeometry | null>(null);
  let nlBlackGeo = $state<THREE.ExtrudeGeometry | null>(null);
  // far-right corner (cx=+3.56, cz=-3.56): far=black, right=white
  //   diagonal: inner(-h,+h) → outer(+h,-h)
  let frWhiteGeo = $state<THREE.ExtrudeGeometry | null>(null);
  let frBlackGeo = $state<THREE.ExtrudeGeometry | null>(null);

  $effect(() => {
    const nlw = makeCornerTri([-h, h], [ h, h], [ h,-h]); // outer,near-right,inner
    const nlb = makeCornerTri([-h, h], [-h,-h], [ h,-h]); // outer,left-far,inner
    const frw = makeCornerTri([-h, h], [ h,-h], [ h, h]); // inner,outer,right-side
    const frb = makeCornerTri([-h, h], [ h,-h], [-h,-h]); // inner,outer,far-side
    nlWhiteGeo = nlw; nlBlackGeo = nlb;
    frWhiteGeo = frw; frBlackGeo = frb;
    return () => { nlw.dispose(); nlb.dispose(); frw.dispose(); frb.dispose(); };
  });
</script>

<!-- Board base — extended to sit under the card slots -->
{#if boardGeo}
  <T.Mesh geometry={boardGeo} position={[0, -0.21, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <T.MeshStandardMaterial map={woodTex ?? undefined} color="#5c3d1a" roughness={0.85} />
  </T.Mesh>
{/if}

<!-- Board legs / base trim -->
{#if trimGeo}
  <T.Mesh geometry={trimGeo} position={[0, -0.27, 0]} rotation={[-Math.PI / 2, 0, 0]}>
    <T.MeshStandardMaterial color="#3d2608" roughness={1} />
  </T.Mesh>
{/if}

<!-- Player-side border strips (shortened to 6.74 so corners don't overlap) -->
<!-- P1 white: near + right -->
<T.Mesh position={[0, -0.03, 3.56]}>
  <T.BoxGeometry args={[6.74, 0.04, 0.38]} />
  <T.MeshStandardMaterial color="#e8e8e8" roughness={0.6} />
</T.Mesh>
<T.Mesh position={[3.56, -0.03, 0]}>
  <T.BoxGeometry args={[0.38, 0.04, 6.74]} />
  <T.MeshStandardMaterial color="#e8e8e8" roughness={0.6} />
</T.Mesh>
<!-- P2 black: far + left -->
<T.Mesh position={[0, -0.03, -3.56]}>
  <T.BoxGeometry args={[6.74, 0.04, 0.38]} />
  <T.MeshStandardMaterial color="#1a1a1a" roughness={0.6} />
</T.Mesh>
<T.Mesh position={[-3.56, -0.03, 0]}>
  <T.BoxGeometry args={[0.38, 0.04, 6.74]} />
  <T.MeshStandardMaterial color="#1a1a1a" roughness={0.6} />
</T.Mesh>

<!-- Same-colour corners: near-right (both white) and far-left (both black) -->
<T.Mesh position={[3.56, -0.03, 3.56]}>
  <T.BoxGeometry args={[0.38, 0.04, 0.38]} />
  <T.MeshStandardMaterial color="#e8e8e8" roughness={0.6} />
</T.Mesh>
<T.Mesh position={[-3.56, -0.03, -3.56]}>
  <T.BoxGeometry args={[0.38, 0.04, 0.38]} />
  <T.MeshStandardMaterial color="#1a1a1a" roughness={0.6} />
</T.Mesh>

<!-- Mixed corners with 45° diagonal cut -->
<!-- near-left (cx=-3.56, cz=+3.56): white near, black left -->
{#if nlWhiteGeo}
  <T.Mesh position={[-3.56, -0.01, 3.56]} rotation={[Math.PI / 2, 0, 0]} geometry={nlWhiteGeo}>
    <T.MeshStandardMaterial color="#e8e8e8" roughness={0.6} />
  </T.Mesh>
{/if}
{#if nlBlackGeo}
  <T.Mesh position={[-3.56, -0.01, 3.56]} rotation={[Math.PI / 2, 0, 0]} geometry={nlBlackGeo}>
    <T.MeshStandardMaterial color="#1a1a1a" roughness={0.6} />
  </T.Mesh>
{/if}
<!-- far-right (cx=+3.56, cz=-3.56): black far, white right -->
{#if frBlackGeo}
  <T.Mesh position={[3.56, -0.01, -3.56]} rotation={[Math.PI / 2, 0, 0]} geometry={frBlackGeo}>
    <T.MeshStandardMaterial color="#1a1a1a" roughness={0.6} />
  </T.Mesh>
{/if}
{#if frWhiteGeo}
  <T.Mesh position={[3.56, -0.01, -3.56]} rotation={[Math.PI / 2, 0, 0]} geometry={frWhiteGeo}>
    <T.MeshStandardMaterial color="#e8e8e8" roughness={0.6} />
  </T.Mesh>
{/if}

<!-- 3x3 grid cells -->
{#each [0, 1, 2] as row}
  {#each [0, 1, 2] as col}
    <GridCell
      {row}
      {col}
      worldX={cellPos(col)}
      worldZ={cellPos(row)}
    />
  {/each}
{/each}

<!-- Card slots — 3 per edge, 12 total -->
{#each EDGES as edge}
  {#each [0, 1, 2] as idx}
    <CardStackSlot {edge} index={idx as 0 | 1 | 2} />
  {/each}
  <EdgeDirectionIndicator {edge} />
{/each}
