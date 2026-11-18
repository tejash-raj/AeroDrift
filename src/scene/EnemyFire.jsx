import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RULES } from '../game/config';
import { game } from '../game/state';

const N = RULES.boltPool;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

// Saucer bolts: a hot core plus a big soft glow, so they're easy to see
// coming and clearly different from your own lasers.
export default function EnemyFire() {
  const core = useRef();
  const glow = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geo = useMemo(
    () => ({ core: new THREE.SphereGeometry(0.9, 12, 8), glow: new THREE.SphereGeometry(2.4, 12, 8) }),
    [],
  );

  useLayoutEffect(() => {
    for (let i = 0; i < N; i++) {
      core.current.setMatrixAt(i, HIDDEN);
      glow.current.setMatrixAt(i, HIDDEN);
    }
  }, []);

  useFrame(() => {
    const t = game.ambientTime;
    for (let i = 0; i < N; i++) {
      const b = game.bolts[i];
      if (!b.active) {
        core.current.setMatrixAt(i, HIDDEN);
        glow.current.setMatrixAt(i, HIDDEN);
        continue;
      }
      dummy.position.copy(b.pos);
      dummy.scale.setScalar(1 + Math.sin(t * 30 + i) * 0.12);
      dummy.updateMatrix();
      core.current.setMatrixAt(i, dummy.matrix);
      glow.current.setMatrixAt(i, dummy.matrix);
    }
    core.current.instanceMatrix.needsUpdate = true;
    glow.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={core} args={[geo.core, undefined, N]} frustumCulled={false}>
        <meshBasicMaterial color="#fff0e0" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={glow} args={[geo.glow, undefined, N]} frustumCulled={false}>
        <meshBasicMaterial
          color="#ff4a2a"
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}
