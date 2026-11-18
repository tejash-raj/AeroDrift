import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RULES } from '../game/config';
import { game } from '../game/state';

const N = RULES.enemyPool;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

// Deterministic per-vertex jitter: shared corners get the same offset,
// so the faceted rock stays watertight.
function makeRockGeometry() {
  const g = new THREE.IcosahedronGeometry(3, 1);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 12.9898 + v.y * 78.233 + v.z * 37.719) * 43758.5453;
    const k = 0.8 + (n - Math.floor(n)) * 0.35;
    v.multiplyScalar(k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function makeSaucerGeometry() {
  const pts = [
    [0, -0.6],
    [2.2, -0.55],
    [3.6, -0.2],
    [4.2, 0],
    [3.6, 0.22],
    [2.2, 0.45],
    [0, 0.5],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 28);
}

export default function Enemies() {
  const rock = useRef();
  const rockGlow = useRef();
  const disc = useRef();
  const dome = useRef();
  const ring = useRef();

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geo = useMemo(() => {
    const rockGeo = makeRockGeometry();
    const domeGeo = new THREE.SphereGeometry(1.7, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.35, 0);
    const ringGeo = new THREE.TorusGeometry(4.25, 0.14, 6, 40).rotateX(Math.PI / 2);
    return { rock: rockGeo, saucer: makeSaucerGeometry(), dome: domeGeo, ring: ringGeo };
  }, []);

  const colors = useMemo(
    () => ({
      rock: new THREE.Color('#4b505d'),
      flash: new THREE.Color('#ffffff'),
      dome: new THREE.Color('#5ee1ff'),
      domeHurt: new THREE.Color('#ff4d5e'),
      domeCharge: new THREE.Color('#ffb547'),
    }),
    [],
  );

  // Seed instance colours before the first render so the shaders compile with them.
  useLayoutEffect(() => {
    for (let i = 0; i < N; i++) {
      for (const m of [rock, rockGlow, disc, dome, ring]) m.current.setMatrixAt(i, HIDDEN);
      rock.current.setColorAt(i, colors.rock);
      dome.current.setColorAt(i, colors.dome);
    }
    rock.current.instanceColor.needsUpdate = true;
    dome.current.instanceColor.needsUpdate = true;
  }, [colors]);

  useFrame(() => {
    const t = game.ambientTime;
    for (let i = 0; i < N; i++) {
      const e = game.enemies[i];
      const show = e.inPlay && e.alive;

      if (show && e.type === 'asteroid') {
        dummy.position.copy(e.pos);
        dummy.rotation.set(e.rx, e.ry, 0);
        dummy.scale.setScalar(e.scale);
        dummy.updateMatrix();
        rock.current.setMatrixAt(i, dummy.matrix);
        dummy.scale.setScalar(e.scale * 1.05);
        dummy.updateMatrix();
        rockGlow.current.setMatrixAt(i, dummy.matrix);
        rock.current.setColorAt(i, e.flash > 0 ? colors.flash : colors.rock);
      } else {
        rock.current.setMatrixAt(i, HIDDEN);
        rockGlow.current.setMatrixAt(i, HIDDEN);
      }

      if (show && e.type === 'ufo') {
        dummy.position.set(e.pos.x, e.pos.y + Math.sin(t * 2 + e.seed) * 0.8, e.pos.z);
        dummy.rotation.set(Math.sin(t * 1.3 + e.seed) * 0.15, e.ry, 0);
        dummy.scale.setScalar(e.scale);
        dummy.updateMatrix();
        disc.current.setMatrixAt(i, dummy.matrix);
        dome.current.setMatrixAt(i, dummy.matrix);
        ring.current.setMatrixAt(i, dummy.matrix);
        // amber flicker = "about to fire" warning; red = damaged
        const charging = e.charge > 0 && Math.floor(e.charge * 16) % 2 === 0;
        dome.current.setColorAt(
          i,
          e.flash > 0
            ? colors.flash
            : charging
              ? colors.domeCharge
              : e.hp < e.maxHp
                ? colors.domeHurt
                : colors.dome,
        );
      } else {
        disc.current.setMatrixAt(i, HIDDEN);
        dome.current.setMatrixAt(i, HIDDEN);
        ring.current.setMatrixAt(i, HIDDEN);
      }
    }
    for (const m of [rock, rockGlow, disc, dome, ring]) m.current.instanceMatrix.needsUpdate = true;
    rock.current.instanceColor.needsUpdate = true;
    dome.current.instanceColor.needsUpdate = true;
  });

  // 5 draw calls for up to 90 enemies (was ~3 per enemy before instancing)
  return (
    <group>
      <instancedMesh ref={rock} args={[geo.rock, undefined, N]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.92} metalness={0.05} flatShading />
      </instancedMesh>
      <instancedMesh ref={rockGlow} args={[geo.rock, undefined, N]} frustumCulled={false}>
        <meshBasicMaterial
          color="#ff7a1a"
          wireframe
          transparent
          opacity={0.38}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh ref={disc} args={[geo.saucer, undefined, N]} frustumCulled={false}>
        <meshStandardMaterial color="#1b202c" metalness={0.9} roughness={0.25} />
      </instancedMesh>
      <instancedMesh ref={dome} args={[geo.dome, undefined, N]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={ring} args={[geo.ring, undefined, N]} frustumCulled={false}>
        <meshBasicMaterial color="#ffb547" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
