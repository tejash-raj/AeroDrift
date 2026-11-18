import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RULES, SHIPS } from '../game/config';
import { game } from '../game/state';

const N = RULES.bulletPool;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

export default function Projectiles({ shipKey }) {
  const core = useRef();
  const glow = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geo = useMemo(
    () => ({
      core: new THREE.CapsuleGeometry(0.3, 7, 4, 8).rotateX(Math.PI / 2),
      glow: new THREE.CapsuleGeometry(0.9, 8, 4, 8).rotateX(Math.PI / 2),
    }),
    [],
  );
  const color = SHIPS[shipKey]?.laser ?? '#ffffff';

  useLayoutEffect(() => {
    for (let i = 0; i < N; i++) {
      core.current.setMatrixAt(i, HIDDEN);
      glow.current.setMatrixAt(i, HIDDEN);
    }
  }, []);

  useFrame(() => {
    for (let i = 0; i < N; i++) {
      const b = game.bullets[i];
      if (b.active) {
        dummy.position.copy(b.pos);
        dummy.updateMatrix();
        core.current.setMatrixAt(i, dummy.matrix);
        glow.current.setMatrixAt(i, dummy.matrix);
      } else {
        core.current.setMatrixAt(i, HIDDEN);
        glow.current.setMatrixAt(i, HIDDEN);
      }
    }
    core.current.instanceMatrix.needsUpdate = true;
    glow.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={core} args={[geo.core, undefined, N]} frustumCulled={false}>
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={glow} args={[geo.glow, undefined, N]} frustumCulled={false}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}
