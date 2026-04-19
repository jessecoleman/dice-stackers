<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { RoundedBoxGeometry } from '@threlte/extras';
  import * as THREE from 'three';
  import Die3D from './Die3D.svelte';
  import { gameStore } from '$lib/gameStore.svelte';
  import type { Die, Suit } from '$lib/gameStore.svelte';

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
    return new THREE.ExtrudeGeometry(shape, { depth: TILE_H, bevelEnabled: false });
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

  // ── Eject animation ───────────────────────────────────────────────────────────

  const DIE_COLORS: Record<string, string> = {
    red: '#e53e3e', blue: '#3b82f6', green: '#38a169', yellow: '#d69e2e',
  };
  const DROP_IN_DURATION = 350; // ms — matches Die3D's 300ms tween + small buffer
  const EJECT_DURATION   = 0.75; // seconds
  const GRAVITY          = -14;

  interface EjectState {
    id: string;
    color: string;
    posX: number; posY: number; posZ: number;
    rotX: number; rotY: number; rotZ: number;
    opacity: number;
    startY: number;
    velX: number; velY: number; velZ: number;
    angVelX: number; angVelY: number; angVelZ: number;
    born: number;
    done: boolean;
  }

  // phantomStack: the previous 3 dice kept visible while the 4th die drops in.
  // phantomDie:  the 4th (clearing) die that plays its drop-in animation.
  let phantomStack = $state<Array<{ die: Die; idx: number }>>([]);
  let phantomDie   = $state<{ die: Die; posY: number } | null>(null);
  let ejecting     = $state<EjectState[]>([]);

  let prevStackData: Array<{ die: Die; idx: number }> = [];
  let pendingEjectTimer: ReturnType<typeof setTimeout> | null = null;

  function spawnEjects(dice: Array<{ die: Die; idx: number }>) {
    const now = performance.now() / 1000;
    for (const { die, idx } of dice) {
      const startY = 0.06 + DIE_SIZE / 2 + idx * STACK_STEP;
      const angle  = Math.random() * Math.PI * 2;
      const speed  = 2.5 + Math.random() * 2.5;
      ejecting.push({
        id: `eject-${die.id}-${Date.now()}-${idx}`,
        color: DIE_COLORS[die.color] ?? '#888',
        posX: 0, posY: startY, posZ: 0,
        rotX: 0, rotY: 0, rotZ: 0,
        opacity: 1,
        startY,
        velX: Math.cos(angle) * speed,
        velY: 3.5 + Math.random() * 2.5,
        velZ: Math.sin(angle) * speed,
        angVelX: (Math.random() - 0.5) * 18,
        angVelY: (Math.random() - 0.5) * 18,
        angVelZ: (Math.random() - 0.5) * 18,
        born: now,
        done: false,
      });
    }
  }

  $effect(() => {
    const cur = stack;

    if (prevStackData.length > 0 && cur.length === 0) {
      // Stack was fully cleared — find the die that caused it from the event log.
      const log = gameStore.eventLog;
      const lastEntry = log[log.length - 1];
      const isThisCell =
        lastEntry?.action === 'placed' &&
        lastEntry.cell?.row === row &&
        lastEntry.cell?.col === col;

      const snapshot = [...prevStackData];

      if (isThisCell && lastEntry.dieColor && lastEntry.dieValue != null) {
        // Keep the previous 3 dice visible and show the 4th dropping in.
        const clearingDie: Die = {
          id: lastEntry.dieId ?? `phantom-${Date.now()}`,
          color: lastEntry.dieColor as Suit,
          value: lastEntry.dieValue,
          player: lastEntry.player,
          edge: 'bottom',
        };
        phantomStack = snapshot;
        phantomDie   = { die: clearingDie, posY: 0.06 + DIE_SIZE / 2 + snapshot.length * STACK_STEP };

        if (pendingEjectTimer) clearTimeout(pendingEjectTimer);
        pendingEjectTimer = setTimeout(() => {
          phantomStack = [];
          phantomDie   = null;
          spawnEjects([...snapshot, { die: clearingDie, idx: snapshot.length }]);
          pendingEjectTimer = null;
        }, DROP_IN_DURATION);
      } else {
        // Fallback: no event log match, tumble immediately.
        spawnEjects(snapshot);
      }
    }

    prevStackData = cur.map((die, i) => ({ die, idx: i }));
  });

  useTask(() => {
    if (ejecting.length === 0) return;
    const now = performance.now() / 1000;
    let hasExpired = false;
    for (const ed of ejecting) {
      if (ed.done) continue;
      const t = now - ed.born;
      if (t >= EJECT_DURATION) { ed.done = true; hasExpired = true; continue; }
      ed.posX = ed.velX * t;
      ed.posY = ed.startY + ed.velY * t + 0.5 * GRAVITY * t * t;
      ed.posZ = ed.velZ * t;
      ed.rotX = ed.angVelX * t;
      ed.rotY = ed.angVelY * t;
      ed.rotZ = ed.angVelZ * t;
      const fadeStart = EJECT_DURATION * 0.6;
      ed.opacity = t > fadeStart
        ? Math.max(0, 1 - (t - fadeStart) / (EJECT_DURATION - fadeStart))
        : 1;
    }
    if (hasExpired) ejecting = ejecting.filter(ed => !ed.done);
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
      onclick={handleClick}
    >
      <T.MeshStandardMaterial color={tileColor} roughness={0.55} />
    </T.Mesh>
  {/if}

  <!-- Stacked dice -->
  {#each stack as die, i (die.id)}
    <Die3D
      {die}
      position={[0, 0.06 + DIE_SIZE / 2 + i * STACK_STEP, 0]}
      interactive={!isPendingTarget}
      highlighted={logHover !== null && (!logHover.dieId || logHover.dieId === die.id)}
    />
  {/each}

  <!-- Phantom stack: previous 3 dice held visible while the 4th drops in -->
  {#each phantomStack as { die, idx } (die.id)}
    <Die3D
      {die}
      position={[0, 0.06 + DIE_SIZE / 2 + idx * STACK_STEP, 0]}
      interactive={false}
      skipIntro={true}
    />
  {/each}

  <!-- Phantom 4th die: drops in before the tumble begins -->
  {#if phantomDie}
    <Die3D
      die={phantomDie.die}
      position={[0, phantomDie.posY, 0]}
      interactive={false}
    />
  {/if}

  <!-- Ejecting dice (tumble-away animation) -->
  {#each ejecting as ed (ed.id)}
    <T.Group position={[ed.posX, ed.posY, ed.posZ]} rotation={[ed.rotX, ed.rotY, ed.rotZ]}>
      <T.Mesh castShadow>
        <RoundedBoxGeometry args={[DIE_SIZE, DIE_SIZE, DIE_SIZE]} radius={DIE_SIZE * 0.08} smoothness={3} />
        <T.MeshPhysicalMaterial
          color={ed.color}
          transmission={0.55}
          roughness={0.4}
          thickness={DIE_SIZE}
          ior={1.45}
          transparent={true}
          opacity={ed.opacity}
          emissive={ed.color}
          emissiveIntensity={0.05}
          depthWrite={false}
        />
      </T.Mesh>
    </T.Group>
  {/each}

  <!-- No-placement warning ghost cube -->
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
