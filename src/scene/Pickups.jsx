import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RULES } from '../game/config';
import { game } from '../game/state';

const N = RULES.pickupPool;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

// Health = green cross-shaped crystal, ammo = cyan crystal.
// Both spin, bob and carry a ring so they read as "collect me" from far away.
export default function Pickups() {
  const core = useRef();
  const ring = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geo = useMemo(
    () => ({
      core: new THREE.OctahedronGeometry(1.6, 0),
      ring: new THREE.TorusGeometry(3, 0.18, 6, 32),
    }),
    [],
  );
  const colors = useMemo(() => ({ health: new THREE.Color('#7dffb0'), ammo: new THREE.Color('#5ee1ff') }), []);

  useLayoutEffect(() => {
    for (let i = 0; i < N; i++) {
      core.current.setMatrixAt(i, HIDDEN);
      ring.current.setMatrixAt(i, HIDDEN);
      core.current.setColorAt(i, colors.health);
      ring.current.setColorAt(i, colors.health);
    }
    core.current.instanceColor.needsUpdate = true;
    ring.current.instanceColor.needsUpdate = true;
  }, [colors]);

  useFrame(() => {
    const t = game.ambientTime;
    for (let i = 0; i < N; i++) {
      const p = game.pickups[i];
      if (!p.active) {
        core.current.setMatrixAt(i, HIDDEN);
        ring.current.setMatrixAt(i, HIDDEN);
        continue;
      }
      const c = colors[p.type];
      dummy.position.set(p.pos.x, p.pos.y + Math.sin(t * 2.4 + p.seed) * 0.6, p.pos.z);
      dummy.rotation.set(0, t * 2 + p.seed, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      core.current.setMatrixAt(i, dummy.matrix);
      core.current.setColorAt(i, c);
      dummy.rotation.set(Math.PI / 2 + Math.sin(t + p.seed) * 0.4, 0, t * 1.5);
      dummy.scale.setScalar(1 + Math.sin(t * 4 + p.seed) * 0.08);
      dummy.updateMatrix();
      ring.current.setMatrixAt(i, dummy.matrix);
      ring.current.setColorAt(i, c);
    }
    core.current.instanceMatrix.needsUpdate = true;
    ring.current.instanceMatrix.needsUpdate = true;
    core.current.instanceColor.needsUpdate = true;
    ring.current.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={core} args={[geo.core, undefined, N]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={ring} args={[geo.ring, undefined, N]} frustumCulled={false}>
        <meshBasicMaterial
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}
