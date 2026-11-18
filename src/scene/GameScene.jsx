import { memo, Suspense, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { step } from '../game/simulation';
import Environment from './Environment';
import Ocean from './Ocean';
import Clouds from './Clouds';
import Enemies from './Enemies';
import Projectiles from './Projectiles';
import Particles from './Particles';
import Pickups from './Pickups';
import EnemyFire from './EnemyFire';
import Hero from './Hero';

// Mounted first so the simulation runs before every renderer each frame.
function SimulationDriver() {
  useFrame((state, delta) => step(delta, state.camera, state.size));
  return null;
}

const maxDpr = (quality) =>
  Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, quality === 'high' ? 2 : 1.25);

function GameScene({ shipKey, timeKey, quality }) {
  const [dpr, setDpr] = useState(() => maxDpr(quality));
  useEffect(() => setDpr(maxDpr(quality)), [quality]);

  return (
    <Canvas
      className="game-canvas"
      dpr={dpr}
      gl={{ antialias: quality === 'high', powerPreference: 'high-performance' }}
      camera={{ position: [9, 20.5, 13], fov: 52, near: 0.5, far: 1000 }}
      aria-hidden="true"
    >
      {/* Drops resolution automatically if the device can't hold its frame rate */}
      <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(0.75, d - 0.25))} />
      <SimulationDriver />
      <Environment timeKey={timeKey} quality={quality} />
      <Ocean timeKey={timeKey} quality={quality} />
      <Clouds timeKey={timeKey} />
      <Enemies />
      <Projectiles shipKey={shipKey} />
      <Pickups />
      <EnemyFire />
      <Particles />
      <Suspense fallback={null}>
        <Hero shipKey={shipKey} />
      </Suspense>
    </Canvas>
  );
}

export default memo(GameScene);
