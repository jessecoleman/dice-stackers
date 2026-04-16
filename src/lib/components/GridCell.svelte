<script lang="ts">
  import { T } from '@threlte/core';
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
      : null
  );
  const isNoPlacementWarning = $derived(gameStore.isCellNoPlacementWarning(row, col));
  const seatCanPlace = $derived(
    gameStore.seat === null || gameStore.seat === gameStore.currentPlayer
  );

  const tileBaseColor = '#c8a96e';
  const tileAltColor  = '#b8905a';
  const isAlt = $derived((row + col) % 2 === 1);
  const tileColor = $derived(isAlt ? tileAltColor : tileBaseColor);

  function handleClick(e: any) {
    e.stopPropagation();
    if (isPendingTarget && seatCanPlace) gameStore.placeDieOnCell(row, col);
  }
</script>

<T.Group position={[worldX, 0, worldZ]}>
  <!-- Tile surface -->
  <T.Mesh receiveShadow position={[0, 0, 0]} onclick={handleClick}>
    <T.BoxGeometry args={[CELL_SIZE, 0.12, CELL_SIZE]} />
    <T.MeshStandardMaterial color={tileColor} roughness={0.8} />
  </T.Mesh>

  <!-- Tile border -->
  <T.Mesh position={[0, -0.02, 0]}>
    <T.BoxGeometry args={[CELL_SIZE + 0.04, 0.08, CELL_SIZE + 0.04]} />
    <T.MeshStandardMaterial color="#7a5c2e" roughness={1} />
  </T.Mesh>

  <!-- Stacked dice — non-interactive during die placement so clicks pass through -->
  {#each stack as die, i}
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
