import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import { TIMES } from '../game/config';

export default function Environment({ timeKey, quality }) {
  const t = TIMES[timeKey];
  const follow = useRef();

  // Sky dome and stars travel with the camera so the horizon never ends.
  useFrame(({ camera }) => {
    if (follow.current) follow.current.position.copy(camera.position);
  });

  return (
    <>
      <color attach="background" args={[t.fog]} />
      <fog attach="fog" args={[t.fog, t.fogNear, t.fogFar]} />
      <ambientLight intensity={t.ambient} />
      <hemisphereLight args={[t.skyTint, t.water, t.hemi]} />
      {/* Kept outside the moving group so its direction never changes */}
      <directionalLight position={t.sun} intensity={t.sunIntensity} color={t.sunColor} />

      <group ref={follow}>
        <Sky
          distance={900}
          sunPosition={t.sun}
          turbidity={t.turbidity}
          rayleigh={t.rayleigh}
          mieCoefficient={t.mieCoefficient}
          mieDirectionalG={t.mieDirectionalG}
        />
        {t.night && (
          <>
            <Stars radius={300} depth={60} count={quality === 'high' ? 6000 : 2500} factor={5} fade speed={0.4} />
            <mesh position={[-120, 95, -380]}>
              <sphereGeometry args={[22, 32, 32]} />
              <meshBasicMaterial color="#eaf6ff" fog={false} toneMapped={false} />
            </mesh>
          </>
        )}
      </group>
    </>
  );
}
