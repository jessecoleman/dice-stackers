<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import * as THREE from 'three';
  import { gameStore, PLAYER_EDGES, type Edge, type Card } from '$lib/gameStore.svelte';
  import CardSlotCard from './CardSlotCard.svelte';
  import emptyStackUrl from '$lib/assets/empty-stack.svg?url';

  let { edge, index }: { edge: Edge; index: 0 | 1 | 2 } = $props();

  // ── Layout constants (must match Board.svelte) ───────────────────────────────
  const STEP = 1.18;
  const OFFSET = -1.18;
  const EDGE_DIST = 2.25;

  function cellPos(i: number) { return OFFSET + i * STEP; }

  const isHorizEdge = $derived(edge === 'top' || edge === 'bottom');
  const faceRotZ = $derived(
    (isHorizEdge ? 0 : Math.PI / 2) + (edge === 'top' || edge === 'left' ? Math.PI : 0)
  );
  const cardW = $derived(isHorizEdge ? 0.7 : 0.9);
  const cardD = $derived(isHorizEdge ? 0.9 : 0.7);

  const px = $derived.by(() => {
    if (edge === 'left')   return -EDGE_DIST;
    if (edge === 'right')  return  EDGE_DIST;
    return cellPos(index);
  });
  const pz = $derived.by(() => {
    if (edge === 'bottom') return  EDGE_DIST;
    if (edge === 'top')    return -EDGE_DIST;
    return cellPos(index);
  });

  const key    = $derived(`${edge}-${index}`);
  const cards  = $derived(gameStore.cardSlots[key] ?? []);
  const isLogHovered = $derived(
    gameStore.hoverHighlight?.type === 'slot' &&
    gameStore.hoverHighlight.edge === edge &&
    gameStore.hoverHighlight.index === index
  );
  const sel = $derived(gameStore.selectedCard);

  const seatOwnsEdge = $derived(
    gameStore.seat === null || PLAYER_EDGES[gameStore.seat].includes(edge)
  );
  const usedSlot = $derived(gameStore.usedSlotThisTurn);
  const isValid = $derived(
    seatOwnsEdge &&
    sel !== null &&
    gameStore.canPlayToEdge(sel.player, edge) &&
    gameStore.isValidStackOrder(edge, index, sel.card) &&
    !(usedSlot?.edge === edge && usedSlot?.index === index)
  );

  let hovered = $state(false);

  const CARD_H      = 0.020;
  const CARD_GAP    = 0.026;
  const CARD_SPREAD = 0.26;

  const SUIT_COLOR: Record<string, string> = {
    red: '#e53e3e', green: '#38a169', yellow: '#d69e2e', blue: '#3b82f6',
  };

  const spreadX = $derived(edge === 'right' ? 1 : edge === 'left' ? -1 : 0);
  const spreadZ = $derived(edge === 'bottom' ? 1 : edge === 'top' ? -1 : 0);

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
    geo.translate(0, 0, -CARD_H / 2);
    return geo;
  }

  let horizCardGeo = $state<THREE.ExtrudeGeometry | null>(null);
  let vertCardGeo  = $state<THREE.ExtrudeGeometry | null>(null);
  $effect(() => {
    const hg = makeCardGeo(0.7, 0.9);
    const vg = makeCardGeo(0.9, 0.7);
    horizCardGeo = hg;
    vertCardGeo  = vg;
    return () => { hg.dispose(); vg.dispose(); };
  });

  let emptyTex = $state<THREE.Texture | null>(null);
  $effect(() => {
    const t = new THREE.TextureLoader().load(emptyStackUrl);
    t.colorSpace = THREE.SRGBColorSpace;
    emptyTex = t;
    return () => t.dispose();
  });

  // ── Card eject animation ──────────────────────────────────────────────────────

  const EJECT_DURATION = 0.85;
  const GRAVITY        = -11;

  interface CardEjectState {
    id: string;
    suit: string;
    posX: number; posY: number; posZ: number;
    rotX: number; rotY: number; rotZ: number;
    opacity: number;
    startX: number; startY: number; startZ: number;
    startRotX: number; startRotZ: number;
    velX: number; velY: number; velZ: number;
    angVelX: number; angVelY: number; angVelZ: number;
    born: number;
    done: boolean;
  }

  let ejectingCards = $state<CardEjectState[]>([]);
  let prevCards: Card[] = [];

  $effect(() => {
    const cur = cards;

    if (prevCards.length > 0 && cur.length === 0) {
      const now = performance.now() / 1000;

      for (let i = 0; i < prevCards.length; i++) {
        const card = prevCards[i];
        const startX = i * CARD_SPREAD * spreadX;
        const startY = 0.008 + i * CARD_GAP;
        const startZ = i * CARD_SPREAD * spreadZ;

        // Primary velocity: outward from board along this edge's axis.
        // Secondary (perpendicular) axis gets a small random spread so cards fan out.
        const outSpeed = 3 + Math.random() * 2;
        const sideJitter = (Math.random() - 0.5) * 1.5;
        const velX = spreadX !== 0 ? spreadX * outSpeed : sideJitter;
        const velZ = spreadZ !== 0 ? spreadZ * outSpeed : sideJitter;

        ejectingCards.push({
          id: `eject-card-${card.id}-${Date.now()}-${i}`,
          suit: card.suit,
          posX: startX, posY: startY, posZ: startZ,
          rotX: -Math.PI / 2, rotY: 0, rotZ: faceRotZ,
          opacity: 1,
          startX, startY, startZ,
          startRotX: -Math.PI / 2,
          startRotZ: faceRotZ,
          velX,
          velY: 2.5 + Math.random() * 2,
          velZ,
          angVelX: (Math.random() - 0.5) * 10,
          angVelY: (Math.random() - 0.5) * 10,
          angVelZ: (Math.random() - 0.5) * 10,
          born: now,
          done: false,
        });
      }
    }

    prevCards = [...cur];
  });

  useTask(() => {
    if (ejectingCards.length === 0) return;
    const now = performance.now() / 1000;
    let hasExpired = false;
    for (const ec of ejectingCards) {
      if (ec.done) continue;
      const t = now - ec.born;
      if (t >= EJECT_DURATION) { ec.done = true; hasExpired = true; continue; }
      ec.posX = ec.startX + ec.velX * t;
      ec.posY = ec.startY + ec.velY * t + 0.5 * GRAVITY * t * t;
      ec.posZ = ec.startZ + ec.velZ * t;
      ec.rotX = ec.startRotX + ec.angVelX * t;
      ec.rotY = ec.angVelY * t;
      ec.rotZ = ec.startRotZ + ec.angVelZ * t;
      const fadeStart = EJECT_DURATION * 0.65;
      ec.opacity = t > fadeStart
        ? Math.max(0, 1 - (t - fadeStart) / (EJECT_DURATION - fadeStart))
        : 1;
    }
    if (hasExpired) ejectingCards = ejectingCards.filter(ec => !ec.done);
  });
</script>

<T.Group position={[px, 0, pz]}>

  <!-- Empty-slot placeholder -->
  {#if cards.length === 0 && emptyTex}
    <T.Mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, faceRotZ]}>
      <T.PlaneGeometry args={[Math.min(cardW, cardD), Math.max(cardW, cardD)]} />
      <T.MeshBasicMaterial
        map={emptyTex}
        color="#ffffff"
        transparent
        opacity={isValid ? 0.45 : 0.15}
        depthWrite={false}
      />
    </T.Mesh>
  {/if}

  <!-- Stacked cards -->
  {#each cards as card, i (card.id)}
    <CardSlotCard
      {card}
      cardGeo={isHorizEdge ? horizCardGeo : vertCardGeo}
      {cardW}
      {cardD}
      {isHorizEdge}
      y={0.008 + i * CARD_GAP}
      ox={i * CARD_SPREAD * spreadX}
      oz={i * CARD_SPREAD * spreadZ}
      {faceRotZ}
      cardH={CARD_H}
      suitColor={SUIT_COLOR[card.suit] ?? '#888'}
      {isLogHovered}
    />
  {/each}

  <!-- Ejecting cards (fly-away animation on stack clear) -->
  {#each ejectingCards as ec (ec.id)}
    {@const geo = isHorizEdge ? horizCardGeo : vertCardGeo}
    {#if geo}
      <T.Group position={[ec.posX, ec.posY, ec.posZ]} rotation={[ec.rotX, ec.rotY, ec.rotZ]}>
        <T.Mesh castShadow geometry={geo}>
          <T.MeshStandardMaterial
            color={SUIT_COLOR[ec.suit] ?? '#888'}
            roughness={0.35}
            metalness={0.1}
            transparent={true}
            opacity={ec.opacity}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </T.Mesh>
      </T.Group>
    {/if}
  {/each}

  <!-- Click / hover target -->
  <T.Mesh
    position={[0, 0.2, 0]}
    onpointerenter={(e: any) => { e.stopPropagation(); if (isValid) hovered = true; }}
    onpointerleave={(e: any) => { e.stopPropagation(); hovered = false; }}
    onclick={(e: any) => { e.stopPropagation(); if (isValid) gameStore.playCardToSlot(edge, index as 0 | 1 | 2); }}
  >
    <T.BoxGeometry args={[cardW + 0.06, 0.4, cardD + 0.06]} />
    <T.MeshStandardMaterial transparent opacity={0} depthWrite={false} />
  </T.Mesh>

  <!-- Valid-target glow ring -->
  {#if isValid}
    <T.Mesh position={[0, 0.004, 0]}>
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
