<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';
  import { gameStore, PLAYER_EDGES, type Edge } from '$lib/gameStore.svelte';
  import CardFace3D from './CardFace3D.svelte';

  let { edge, index }: { edge: Edge; index: 0 | 1 | 2 } = $props();

  // ── Layout constants (must match Board.svelte) ───────────────────────────────
  const STEP = 1.18;      // CELL_SIZE + GAP
  const OFFSET = -1.18;   // -STEP, centers the 3x3 at origin
  const EDGE_DIST = 2.25; // distance from world origin to slot center

  function cellPos(i: number) { return OFFSET + i * STEP; }

  // ── Card geometry: flat rect that lies on the table surface ─────────────────
  // Horizontal edges (top/bottom): width=0.7 along X (spans the column),
  //   depth=0.9 along Z (points toward board centre).
  // Vertical edges (left/right): width=0.9 along X (points toward board centre),
  //   depth=0.7 along Z (spans the row).
  const isHorizEdge = $derived(edge === 'top' || edge === 'bottom');
  // P2's edges (top, left) face away from the board — rotate face 180° so the
  // numeral reads outward rather than toward the board centre.
  const faceRotZ = $derived(
    (isHorizEdge ? 0 : Math.PI / 2) + (edge === 'top' || edge === 'left' ? Math.PI : 0)
  );
  const cardW = $derived(isHorizEdge ? 0.7 : 0.9);
  const cardD = $derived(isHorizEdge ? 0.9 : 0.7);

  // World position of the slot centre
  const px = $derived.by(() => {
    if (edge === 'left')   return -EDGE_DIST;
    if (edge === 'right')  return  EDGE_DIST;
    return cellPos(index); // top / bottom: aligned to column
  });
  const pz = $derived.by(() => {
    if (edge === 'bottom') return  EDGE_DIST;
    if (edge === 'top')    return -EDGE_DIST;
    return cellPos(index); // left / right: aligned to row
  });

  // ── Reactive state ───────────────────────────────────────────────────────────
  const key    = $derived(`${edge}-${index}`);
  const cards  = $derived(gameStore.cardSlots[key] ?? []);
  const isLogHovered = $derived(
    gameStore.hoverHighlight?.type === 'slot' &&
    gameStore.hoverHighlight.edge === edge &&
    gameStore.hoverHighlight.index === index
  );
  const sel    = $derived(gameStore.selectedCard);

  // This slot is a valid drop target when the seated player owns this edge,
  // has a card selected, and the play is legal.
  const seatOwnsEdge = $derived(
    gameStore.seat === null || PLAYER_EDGES[gameStore.seat].includes(edge)
  );
  const isValid = $derived(
    seatOwnsEdge &&
    sel !== null &&
    gameStore.canPlayToEdge(sel.player, edge) &&
    gameStore.isValidStackOrder(edge, index, sel.card)
  );

  let hovered = $state(false);

  // Owning-player accent colour for the empty-slot outline

  const CARD_H   = 0.020;  // card thickness (visible depth)
  const CARD_GAP = 0.026; // vertical spacing between stacked cards
  const CARD_SPREAD = 0.26; // offset per card away from board centre

  const SUIT_COLOR: Record<string, string> = {
    red:    '#e53e3e',
    green:  '#38a169',
    yellow: '#d69e2e',
    blue:   '#3b82f6',
  };

  // Unit vector pointing away from board centre for each edge
  const spreadX = $derived(edge === 'right' ? 1 : edge === 'left' ? -1 : 0);
  const spreadZ = $derived(edge === 'bottom' ? 1 : edge === 'top' ? -1 : 0);

  // Rounded-rectangle extruded geometry — corners match the canvas texture (r ≈ 12/128 of width)
  const CORNER_R = 0.065;
  function makeCardGeo(w: number, d: number): THREE.ExtrudeGeometry {
    const r = Math.min(CORNER_R, w / 2 - 0.001, d / 2 - 0.001);
    const hw = w / 2, hd = d / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-hw + r, -hd);
    shape.lineTo( hw - r, -hd);
    shape.quadraticCurveTo( hw, -hd,  hw, -hd + r);
    shape.lineTo( hw,  hd - r);
    shape.quadraticCurveTo( hw,  hd,  hw - r,  hd);
    shape.lineTo(-hw + r,  hd);
    shape.quadraticCurveTo(-hw,  hd, -hw,  hd - r);
    shape.lineTo(-hw, -hd + r);
    shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: CARD_H, bevelEnabled: false });
    geo.translate(0, 0, -CARD_H / 2); // centre along extrusion axis
    return geo;
  }

  // One shared geometry per card size (horiz vs vert edge)
  let horizCardGeo = $state<THREE.ExtrudeGeometry | null>(null);
  let vertCardGeo  = $state<THREE.ExtrudeGeometry | null>(null);
  $effect(() => {
    const hg = makeCardGeo(0.7, 0.9);
    const vg = makeCardGeo(0.9, 0.7);
    horizCardGeo = hg;
    vertCardGeo  = vg;
    return () => { hg.dispose(); vg.dispose(); };
  });


</script>

<T.Group position={[px, 0, pz]}>

  <!-- Empty-slot outline ─────────────────────────────────────────────────── -->
  {#if cards.length === 0}
    <!-- Thin card silhouette, 70% the size of a real card -->
    <T.Mesh position={[0, 0.005, 0]}>
      <T.BoxGeometry args={[cardW * 0.7, 0.004, cardD * 0.7]} />
      <T.MeshStandardMaterial
        color="#ffffff"
        transparent
        opacity={isValid ? 0.22 : 0.08}
        roughness={1}
        depthWrite={false}
      />
    </T.Mesh>
    <!-- Wireframe border -->
    <T.Mesh position={[0, 0.005, 0]}>
      <T.BoxGeometry args={[cardW * 0.7 + 0.02, 0.003, cardD * 0.7 + 0.02]} />
      <T.MeshStandardMaterial
        color="#ffffff"
        transparent
        opacity={isValid ? 0.45 : 0.15}
        wireframe
        depthWrite={false}
      />
    </T.Mesh>
  {/if}

  <!-- Stacked card quads ─────────────────────────────────────────────────── -->
  {#each cards as card, i}
    {@const y = 0.008 + i * CARD_GAP}
    {@const ox = i * CARD_SPREAD * spreadX}
    {@const oz = i * CARD_SPREAD * spreadZ}
    <!-- Card body (suit-coloured sides give depth, rounded corners) -->
    {#if (isHorizEdge ? horizCardGeo : vertCardGeo)}
      <T.Mesh
        geometry={isHorizEdge ? horizCardGeo! : vertCardGeo!}
        position={[ox, y, oz]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <T.MeshStandardMaterial color={SUIT_COLOR[card.suit] ?? '#888'} roughness={0.45} metalness={0.05} />
      </T.Mesh>
    {/if}
    <!-- Card face texture (number + suit) -->
    <CardFace3D
      {card}
      width={isHorizEdge ? cardW : cardD}
      depth={isHorizEdge ? cardD : cardW}
      surfaceY={y + CARD_H / 2}
      {ox}
      {oz}
      rotationZ={faceRotZ}
    />
  {/each}

  <!-- Click / hover target — tall box so the steep isometric ray reliably hits it -->
  <T.Mesh
    position={[0, 0.2, 0]}
    onpointerenter={(e: any) => { e.stopPropagation(); if (isValid) hovered = true; }}
    onpointerleave={(e: any) => { e.stopPropagation(); hovered = false; }}
    onclick={(e: any) => { e.stopPropagation(); if (isValid) gameStore.playCardToSlot(edge, index as 0 | 1 | 2); }}
  >
    <T.BoxGeometry args={[cardW + 0.06, 0.4, cardD + 0.06]} />
    <T.MeshStandardMaterial
      transparent
      opacity={0}
      depthWrite={false}
    />
  </T.Mesh>

  <!-- Event log hover highlight -->
  {#if isLogHovered}
    <T.Mesh position={[0, 0.004, 0]}>
      <T.BoxGeometry args={[cardW + 0.1, 0.003, cardD + 0.1]} />
      <T.MeshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.2} transparent opacity={0.5} depthWrite={false} />
    </T.Mesh>
  {/if}

  <!-- Valid-target glow ring ──────────────────────────────────────────────── -->
  {#if isValid}
    {@const glowY = 0.004}
    <T.Mesh position={[0, glowY, 0]}>
      <T.BoxGeometry args={[cardW + 0.1, 0.003, cardD + 0.1]} />
      <T.MeshStandardMaterial
        color="#ffffff"
        emissive="#ffffff"
        emissiveIntensity={hovered ? 1.2 : 0.5}
        transparent
        opacity={hovered ? 0.6 : 0.3}
      />
    </T.Mesh>
  {/if}

</T.Group>
