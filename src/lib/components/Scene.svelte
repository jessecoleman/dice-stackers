<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { untrack } from 'svelte';
  import { OrbitControls, interactivity } from '@threlte/extras';
  import Board from './Board.svelte';
  import { Vector3, type PerspectiveCamera } from 'three';
  import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';

  import { gameStore } from '$lib/gameStore.svelte';

  interactivity();

  const CAM_X = 6;
  const CAM_Y = 7;
  const CAM_Z = 6;

  // Seat 2 sits on the opposite side of the table
  const camX = $derived(gameStore.seat === 2 ? -CAM_X : CAM_X);
  const camZ = $derived(gameStore.seat === 2 ? -CAM_Z : CAM_Z);

  let { resetSignal = 0, topDown = false, flipped = false }: { resetSignal?: number; topDown?: boolean; flipped?: boolean } = $props();

  let cam   = $state<PerspectiveCamera | null>(null);
  let ctrl  = $state<OrbitControlsImpl | null>(null);

  // When flipped, view from the opponent's side (negate XZ).
  const effectiveCamX = $derived(flipped ? -camX : camX);
  const effectiveCamZ = $derived(flipped ? -camZ : camZ);

  // Goal camera position — initialised by the effect below on first run.
  let goalX = $state(0);
  let goalY = $state(CAM_Y);
  let goalZ = $state(0);

  const LERP          = 0.1;
  const EPSILON       = 0.005;
  const FLIP_DURATION = 0.7;   // seconds for the 180° orbit
  const goalTarget    = new Vector3(0, 0, 0);
  let   animating     = $state(false);

  // Flip orbit state
  let isFlipping      = $state(false);
  let flipT           = $state(0);
  let flipRadius      = 0;
  let flipStartAngle  = 0;
  let flipEndAngle    = 0;

  function easeInOut(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  useTask((delta) => {
    if (!cam || !ctrl) return;

    if (isFlipping) {
      flipT = Math.min(1, flipT + delta / FLIP_DURATION);
      const angle = flipStartAngle + (flipEndAngle - flipStartAngle) * easeInOut(flipT);
      cam.position.set(flipRadius * Math.cos(angle), goalY, flipRadius * Math.sin(angle));
      ctrl.target.lerp(goalTarget, LERP);
      ctrl.update();
      if (flipT >= 1) { isFlipping = false; animating = false; }
    } else {
      const gp = new Vector3(goalX, goalY, goalZ);
      cam.position.lerp(gp, LERP);
      ctrl.target.lerp(goalTarget, LERP);
      ctrl.update();
      if (cam.position.distanceTo(gp) < EPSILON && ctrl.target.distanceTo(goalTarget) < EPSILON) {
        cam.position.copy(gp);
        ctrl.target.copy(goalTarget);
        ctrl.update();
        animating = false;
      }
    }
  }, { running: () => animating });

  // Track previous flipped value to detect changes (plain variable, not reactive).
  let prevFlipped = false;

  // Start orbit animation when flipped toggles.
  $effect(() => {
    const f = flipped; // reactive dependency
    if (f !== prevFlipped) {
      prevFlipped = f;
      const sx = cam ? cam.position.x : goalX;
      const sz = cam ? cam.position.z : goalZ;
      flipRadius     = Math.sqrt(sx * sx + sz * sz);
      flipStartAngle = Math.atan2(sz, sx);
      flipEndAngle   = flipStartAngle + Math.PI;
      goalX = topDown ? effectiveCamX * 0.4 : effectiveCamX;
      goalY = topDown ? 10 : CAM_Y;
      goalZ = topDown ? effectiveCamZ * 0.4 : effectiveCamZ;
      flipT = 0;
      isFlipping = true;
      animating  = true;
    }
  });

  // Animate when topDown changes (normal lerp, no arc needed).
  $effect(() => {
    if (untrack(() => isFlipping)) return; // flip effect handles it; don't track isFlipping
    goalX = topDown ? effectiveCamX * 0.4 : effectiveCamX;
    goalY = topDown ? 10 : CAM_Y;
    goalZ = topDown ? effectiveCamZ * 0.4 : effectiveCamZ;
    if (cam && ctrl) animating = true;
  });

  // Animate when resetSignal fires.
  $effect(() => {
    if (resetSignal === 0 || !cam || !ctrl) return;
    isFlipping = false;
    goalX = effectiveCamX;
    goalY = CAM_Y;
    goalZ = effectiveCamZ;
    animating = true;
  });
</script>

<!-- Ambient + directional lighting -->
<T.AmbientLight intensity={0.6} />
<T.DirectionalLight
  position={[5, 10, 5]}
  intensity={1.5}
  castShadow
  shadow.mapSize.width={1024}
  shadow.mapSize.height={1024}
  shadow.radius={8}
  shadow.blurSamples={16}
/>
<T.DirectionalLight position={[-4, 6, -4]} intensity={0.4} color="#a0c0ff" />

<!-- Isometric camera -->
<T.PerspectiveCamera
  makeDefault
  position={[effectiveCamX, CAM_Y, effectiveCamZ]}
  fov={40}
  oncreate={(c) => { cam = c; c.lookAt(0, 0, 0); }}
>
  <OrbitControls
    enablePan={false}
    enableZoom={true}
    minPolarAngle={Math.PI / 6}
    maxPolarAngle={Math.PI / 2.5}
    minDistance={8}
    maxDistance={18}
    target={[0, 0, 0]}
    oncreate={(c) => { ctrl = c as unknown as OrbitControlsImpl; }}
  />
</T.PerspectiveCamera>

<!-- Game board -->
<Board />

