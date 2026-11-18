import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RULES, TIMES } from '../game/config';
import { game } from '../game/state';

const SIZE = 1800;
const AHEAD = 250; // centre the plane in front of the camera — more ocean where you look

// Waves are computed on the GPU. The height function and its analytic
// derivatives (for lighting normals) run per-vertex in GLSL, so the CPU
// does zero work per frame beyond updating one uniform.
// Sampling world-space coordinates means the plane can follow the camera
// without the waves sliding — the mesh snaps to whole grid cells.
const WAVE_GLSL = /* glsl */ `
uniform float uTime;
varying float vWaveH;
vec3 aeroWave(vec2 p, float t) {
  float a1 = p.x * 0.010 + t;
  float b1 = p.y * 0.015 + t;
  float a2 = p.x * 0.040 + p.y * 0.040 - t * 1.2;
  float a3 = p.x * 0.110 + p.y * 0.070 + t * 2.1;
  float h  = sin(a1) * cos(b1) * 10.0 + sin(a2) * 3.0 + sin(a3) * 0.8;
  float dx = 0.10 * cos(a1) * cos(b1) + 0.12 * cos(a2) + 0.088 * cos(a3);
  float dz = -0.15 * sin(a1) * sin(b1) + 0.12 * cos(a2) + 0.056 * cos(a3);
  return vec3(h, dx, dz);
}
`;

export default function Ocean({ timeKey, quality }) {
  const t = TIMES[timeKey];
  const mesh = useRef();
  const segments = quality === 'high' ? 160 : 72;
  const cell = SIZE / segments;

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, segments, segments);
    g.rotateX(-Math.PI / 2); // bake orientation: local Y is up, no mesh rotation needed
    return g;
  }, [segments]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.55 });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${WAVE_GLSL}`)
        .replace(
          '#include <beginnormal_vertex>',
          `vec3 adWorld = (modelMatrix * vec4(position, 1.0)).xyz;
           vec3 adWave = aeroWave(adWorld.xz, uTime);
           vWaveH = adWave.x;
           vec3 objectNormal = normalize(vec3(-adWave.y, 1.0, -adWave.z));
           #ifdef USE_TANGENT
             vec3 objectTangent = vec3(tangent.xyz);
           #endif`,
        )
        .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position);\ntransformed.y += adWave.x;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vWaveH;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           float crest = smoothstep(6.0, 12.5, vWaveH);
           diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.7 + 0.07, crest);`,
        );
    };
    return m;
  }, [uniforms]);

  useEffect(() => {
    material.color.set(t.water);
    material.emissive.set(t.water);
    material.emissiveIntensity = t.waterGlow;
  }, [material, t]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera }) => {
    uniforms.uTime.value = game.ambientTime * 2;
    if (!mesh.current) return;
    mesh.current.position.set(
      Math.round(camera.position.x / cell) * cell,
      RULES.oceanY,
      Math.round((camera.position.z - AHEAD) / cell) * cell,
    );
  });

  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} />;
}
