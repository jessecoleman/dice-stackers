<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';
  import Die3D from './Die3D.svelte';
  import { gameStore } from '$lib/gameStore.svelte';

  let {
    row,
    col,
    worldX,
    worldZ,
  }: {
    row: number;
    col: number;
    worldX: number;
    worldZ: number;
  } = $props();

  const CELL_SIZE = 1.1;
  const DIE_SIZE = 0.544;
  const STACK_STEP = 0.58;

  const stack = $derived(gameStore.grid[row][col].dice);
  const logHover = $derived(
    gameStore.hoverHighlight?.type === 'cell' &&
    gameStore.hoverHighlight.row === row &&
    gameStore.hoverHighlight.col === col
  );

  const tileBaseColor = '#9a7040';
  const tileAltColor  = '#7a5c2e';
  const isAlt = $derived((row + col) % 2 === 1);
  const tileColor = $derived(isAlt ? tileAltColor : tileBaseColor);

  // Rounded-rectangle tile geometry (shape in XY plane, rotated flat onto XZ)
  const TILE_H      = 0.12;
  const CORNER_R    = 0.14;
  function makeRoundedTile(): THREE.ExtrudeGeometry {
    const s = CELL_SIZE / 2;
    const r = CORNER_R;
    const shape = new THREE.Shape();
    shape.moveTo(-s + r, -s);
    shape.lineTo( s - r, -s);
    shape.quadraticCurveTo( s, -s,  s, -s + r);
    shape.lineTo( s,  s - r);
    shape.quadraticCurveTo( s,  s,  s - r,  s);
    shape.lineTo(-s + r,  s);
    shape.quadraticCurveTo(-s,  s, -s,  s - r);
    shape.lineTo(-s, -s + r);
    shape.quadraticCurveTo(-s, -s, -s + r, -s);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: TILE_H, bevelEnabled: false });
    // Extrusion goes in -Z after rotating -90° around X, so top face ends up at Y=0
    return geo;
  }

  let tileGeo = $state<THREE.ExtrudeGeometry | null>(null);
  $effect(() => {
    const g = makeRoundedTile();
    tileGeo = g;
    return () => g.dispose();
  });
</script>

<T.Group position={[worldX, 0, worldZ]}>
  <!-- Rounded tile surface -->
  {#if tileGeo}
    <T.Mesh
      receiveShadow
      geometry={tileGeo}
      position={[0, -0.06, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <T.MeshStandardMaterial color={tileColor} roughness={0.55} />
    </T.Mesh>
  {/if}

  <!-- Stacked dice (placed automatically by the follower) -->
  {#each stack as die, i (die.id)}
    <Die3D
      {die}
      position={[0, 0.06 + DIE_SIZE / 2 + i * STACK_STEP, 0]}
      interactive={true}
      highlighted={logHover}
    />
  {/each}
</T.Group>
