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
  const isPendingTarget = $derived(gameStore.isCellValidForDiePlacement(row, col));
  const logHover = $derived(
    gameStore.hoverHighlight?.type === 'cell' &&
    gameStore.hoverHighlight.row === row &&
    gameStore.hoverHighlight.col === col
      ? gameStore.hoverHighlight
      : gameStore.hoverHighlight?.type === 'cells' &&
        gameStore.hoverHighlight.cells.some(c => c.row === row && c.col === col)
        ? { type: 'cell' as const, row, col }
        : null
  );
  const isNoPlacementWarning = $derived(gameStore.isCellNoPlacementWarning(row, col));
  const seatCanPlace = $derived(
    gameStore.seat === null || gameStore.seat === gameStore.currentPlayer
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

  function handleClick(e: any) {
    e.stopPropagation();
    if (isPendingTarget && seatCanPlace) gameStore.placeDieOnCell(row, col);
  }
</script>

<T.Group position={[worldX, 0, worldZ]}>
  <!-- Rounded tile surface -->
  {#if tileGeo}
    <T.Mesh
      receiveShadow
      geometry={tileGeo}
      position={[0, -0.06, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onclick={handleClick}
    >
      <T.MeshStandardMaterial color={tileColor} roughness={0.55} />
    </T.Mesh>
  {/if}

  <!-- Stacked dice — non-interactive during die placement so clicks pass through -->
  {#each stack as die, i (die.id)}
    <Die3D
      {die}
      position={[0, 0.06 + DIE_SIZE / 2 + i * STACK_STEP, 0]}
      interactive={!isPendingTarget}
      highlighted={logHover !== null && (!logHover.dieId || logHover.dieId === die.id)}
    />
  {/each}

  <!-- No-placement warning: ghost red die cube where the die would land -->
  {#if isNoPlacementWarning}
    {@const topY = 0.06 + DIE_SIZE / 2 + stack.length * STACK_STEP}
    <T.Mesh position={[0, topY, 0]}>
      <T.BoxGeometry args={[DIE_SIZE * 0.45, DIE_SIZE * 0.45, DIE_SIZE * 0.45]} />
      <T.MeshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={0.4} transparent opacity={0.75} depthWrite={false} />
    </T.Mesh>
  {/if}

  <!-- Pending die placement highlight -->
  {#if isPendingTarget}
    <T.Mesh position={[0, 0.07, 0]}>
      <T.BoxGeometry args={[CELL_SIZE - 0.05, 0.02, CELL_SIZE - 0.05]} />
      <T.MeshStandardMaterial color="#a0ff80" emissive="#a0ff80" emissiveIntensity={0.8} transparent opacity={0.55} />
    </T.Mesh>
  {/if}
</T.Group>
