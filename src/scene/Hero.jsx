import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Center, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SHIPS } from '../game/config';
import { game } from '../game/state';

const BASE = import.meta.env?.BASE_URL ?? './';
const MODEL_SCALE = 3;

function ShipModel({ file, onMeasure }) {
  const { scene } = useGLTF(BASE + file);
  // Clone once per model — not on every React render.
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const size = new THREE.Box3().setFromObject(clone).getSize(new THREE.Vector3());
    onMeasure(size.y * MODEL_SCALE); // models stand upright (+Y); that becomes ship length
    return clone;
  }, [scene, onMeasure]);
  return <primitive object={model} />;
}

export default function Hero({ shipKey }) {
  const ship = SHIPS[shipKey] ?? SHIPS.defender;
  const root = useRef();
  const visual = useRef();
  const flame = useRef();
  const length = useRef(3);
  const flameScale = useRef(0.6);
  const measure = useMemo(() => (len) => (length.current = len || 3), []);

  useFrame((_, delta) => {
    const h = game.hero;
    const t = game.ambientTime;
    if (!root.current) return;
    root.current.position.copy(h.pos);
    root.current.visible = !h.dead;

    const v = visual.current;
    if (game.phase === 'menu') {
      const sway = game.settings.reducedMotion ? 0 : 1;
      v.position.y = Math.sin(t * 1.4) * 0.35 * sway;
      v.rotation.set(Math.sin(t * 0.8) * 0.04 * sway, 0, Math.sin(t * 0.6) * 0.12 * sway);
      v.visible = true;
    } else {
      v.position.y = 0;
      v.rotation.set(h.pitch, 0, h.lean);
      // mercy-invulnerability blink after a hit
      v.visible = !(h.invuln > 0 && Math.floor(h.invuln * 14) % 2 === 1);
    }

    // engine flame grows with boost and flickers
    if (game.phase !== 'paused') {
      const target = h.boosting ? 1.7 : 0.7;
      flameScale.current += (target - flameScale.current) * (1 - Math.exp(-10 * Math.min(delta, 0.05)));
    }
    const s = flameScale.current * (0.9 + Math.sin(t * 60) * 0.06 + Math.random() * 0.05);
    flame.current.scale.set(0.8 + s * 0.2, s, 0.8 + s * 0.2);
    flame.current.position.z = length.current / 2 + 1.5 * s * 0.9;
  });

  return (
    <group ref={root}>
      <group ref={visual}>
        <Center key={ship.model}>
          <group rotation={[-Math.PI / 2, 0, 0]} scale={MODEL_SCALE}>
            <ShipModel file={ship.model} onMeasure={measure} />
          </group>
        </Center>
        <mesh ref={flame} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.55, 3, 14, 1, true]} />
          <meshBasicMaterial
            color={ship.color}
            transparent
            opacity={0.85}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <pointLight intensity={400} distance={120} decay={2} color={ship.color} />
      </group>
    </group>
  );
}

Object.values(SHIPS).forEach((s) => useGLTF.preload(BASE + s.model));
