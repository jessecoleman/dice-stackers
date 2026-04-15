<script lang="ts">
  import { T, useTask } from '@threlte/core';
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

  let { resetSignal = 0, topDown = false }: { resetSignal?: number; topDown?: boolean } = $props();

  let cam   = $state<PerspectiveCamera | null>(null);
  let ctrl  = $state<OrbitControlsImpl | null>(null);

  // Goal camera position — initialised by the effect below on first run.
  let goalX = $state(0);
  let goalY = $state(CAM_Y);
  let goalZ = $state(0);

  const LERP       = 0.1;
  const EPSILON    = 0.005;
  const goalTarget = new Vector3(0, 0, 0);
  let   animating  = $state(false);

  useTask(() => {
    if (!cam || !ctrl) return;
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
  }, { running: () => animating });

  // Animate when topDown toggles — steepen angle by pulling XZ toward centre,
  // keeping Y (and therefore apparent zoom) roughly the same.
  $effect(() => {
    goalX = topDown ? camX * 0.4 : camX;
    goalY = topDown ? 10 : CAM_Y;
    goalZ = topDown ? camZ * 0.4 : camZ;
    if (cam && ctrl) animating = true;
  });

  // Animate when resetSignal fires.
  $effect(() => {
    if (resetSignal === 0 || !cam || !ctrl) return;
    goalX = camX;
    goalY = CAM_Y;
    goalZ = camZ;
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
/>
<T.DirectionalLight position={[-4, 6, -4]} intensity={0.4} color="#a0c0ff" />

<!-- Isometric camera -->
<T.PerspectiveCamera
  makeDefault
  position={[camX, CAM_Y, camZ]}
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

<!-- Ground shadow plane -->
<T.Mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.31, 0]} receiveShadow>
  <T.PlaneGeometry args={[20, 20]} />
  <T.MeshStandardMaterial color="#111827" roughness={1} />
</T.Mesh>
