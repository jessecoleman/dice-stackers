<script lang="ts">
  import { T } from '@threlte/core';
  import GridCell from './GridCell.svelte';
  import CardStackSlot from './CardStackSlot.svelte';
  import EdgeDirectionIndicator from './EdgeDirectionIndicator.svelte';
  import type { Edge } from '$lib/gameStore.svelte';

  const EDGES: Edge[] = ['top', 'bottom', 'left', 'right'];

  const CELL_SIZE = 1.1;
  const GAP = 0.08;
  const STEP = CELL_SIZE + GAP;
  const OFFSET = -STEP; // center the 3x3 around origin

  function cellPos(i: number): number {
    return OFFSET + i * STEP;
  }
</script>

<!-- Board base -->
<T.Mesh position={[0, -0.12, 0]} receiveShadow>
  <T.BoxGeometry args={[3.7, 0.18, 3.7]} />
  <T.MeshStandardMaterial color="#5c3d1a" roughness={0.9} />
</T.Mesh>

<!-- Board legs / base trim -->
<T.Mesh position={[0, -0.24, 0]}>
  <T.BoxGeometry args={[3.5, 0.06, 3.5]} />
  <T.MeshStandardMaterial color="#3d2608" roughness={1} />
</T.Mesh>

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
