import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TIMES } from '../game/config';
import { game } from '../game/state';

const CLOUDS = 36;
const PUFFS = 4; // each cloud is a cluster of puffs — one draw call for all of them

export default function Clouds({ timeKey }) {
  const t = TIMES[timeKey];
  const ref = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const clouds = useMemo(
    () =>
      Array.from({ length: CLOUDS }, () => ({
        pos: new THREE.Vector3((Math.random() - 0.5) * 900, 45 + Math.random() * 55, -Math.random() * 950),
        scale: 8 + Math.random() * 14,
        puffs: Array.from({ length: PUFFS }, (_, j) => ({
          offset: new THREE.Vector3(
            (j - 1.5) * 1.1 + (Math.random() - 0.5) * 0.6,
            (Math.random() - 0.3) * 0.5,
            (Math.random() - 0.5) * 0.8,
          ),
          s: 0.7 + Math.random() * 0.6,
        })),
      })),
    [],
  );

  useFrame(({ camera }, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = game.phase === 'paused' ? 0 : Math.min(delta, 0.05);
    const cam = camera.position;

    for (let i = 0; i < CLOUDS; i++) {
      const c = clouds[i];
      c.pos.x += dt * 1.5; // gentle wind
      if (c.pos.z > cam.z + 60 || Math.abs(c.pos.x - cam.x) > 520) {
        c.pos.z = cam.z - 650 - Math.random() * 300;
        c.pos.x = cam.x + (Math.random() - 0.5) * 900;
      }
      for (let j = 0; j < PUFFS; j++) {
        const p = c.puffs[j];
        dummy.position.copy(c.pos).addScaledVector(p.offset, c.scale);
        dummy.scale.setScalar(c.scale * p.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i * PUFFS + j, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, CLOUDS * PUFFS]} frustumCulled={false}>
      <dodecahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color={t.cloud} transparent opacity={0.6} roughness={1} depthWrite={false} flatShading />
    </instancedMesh>
  );
}
