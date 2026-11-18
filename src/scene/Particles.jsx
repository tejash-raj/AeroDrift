import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RULES } from '../game/config';
import { FX, game } from '../game/state';

const N = RULES.particlePool;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

// Explosion debris, sparks and ocean splashes — one draw call.
export default function Particles() {
  const ref = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(0.7, 0), []);

  useLayoutEffect(() => {
    for (let i = 0; i < N; i++) {
      ref.current.setMatrixAt(i, HIDDEN);
      ref.current.setColorAt(i, FX.spark);
    }
    ref.current.instanceColor.needsUpdate = true;
  }, []);

  useFrame(() => {
    const mesh = ref.current;
    for (let i = 0; i < N; i++) {
      const p = game.particles[i];
      if (!p.active) {
        mesh.setMatrixAt(i, HIDDEN);
        continue;
      }
      const life = p.life / p.maxLife;
      dummy.position.copy(p.pos);
      dummy.rotation.set(life * 6 + i, life * 4, 0);
      dummy.scale.setScalar(p.size * Math.pow(life, 0.7));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, p.color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, N]} frustumCulled={false}>
      <meshBasicMaterial transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}
