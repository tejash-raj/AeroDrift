import React, { useRef, useEffect, useMemo, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sky, Stars, useGLTF, Center } from '@react-three/drei';
import * as THREE from 'three';

// --- GAME CONFIGURATIONS ---
const HERO_TYPES = {
  speedster: { type: 'speedster', name: "Interceptor", speed: 110, turn: 55, maxHealth: 3, fuelDrain: 45, ammoCost: 15, ammoRegen: 15, color: "#ff003c" },
  balanced:  { type: 'balanced', name: "Defender", speed: 65, turn: 75, maxHealth: 5, fuelDrain: 25, ammoCost: 20, ammoRegen: 20, color: "#ff5500" },
  tank:      { type: 'tank', name: "Juggernaut", speed: 45, turn: 95, maxHealth: 7, fuelDrain: 15, ammoCost: 25, ammoRegen: 25, color: "#00ffcc" }
};

const TIMELINES = {
  morning: { name: "Sunrise", sunPos: [100, 2, -100], rayleigh: 4, turbidity: 10, ambient: 0.6, directional: 0.8, waterColor: "#2a5298" },
  day: { name: "Daylight", sunPos: [50, 50, -100], rayleigh: 0.5, turbidity: 0.1, ambient: 0.8, directional: 1.0, waterColor: "#0077b6" },
  night: { name: "Midnight", sunPos: [0, -10, -100], rayleigh: 0.1, turbidity: 20, ambient: 0.3, directional: 0.2, waterColor: "#0f3b5f" }
};

const inputState = { left: false, right: false, up: false, down: false, fire: false, boost: false };

const sharedState = {
  projectiles: [],
  enemies: [],
  heroPosition: new THREE.Vector3(0, 15, 0),
  gameState: 'menu', 
  fuel: 100,
  ammo: 100,
  shakeIntensity: 0,
  isMuted: false 
};

// --- AUDIO ENGINE ---
const gameAudio = {
  laser: typeof Audio !== 'undefined' ? new Audio('/laser.mp3') : null,
  explosion: typeof Audio !== 'undefined' ? new Audio('/explosion.mp3') : null,
  bgMusic: typeof Audio !== 'undefined' ? new Audio('/bg-music.mp3') : null
};

if (gameAudio.bgMusic) {
  gameAudio.bgMusic.loop = true;
  gameAudio.bgMusic.volume = 0.3;
}
if (gameAudio.laser) gameAudio.laser.volume = 0.15;
if (gameAudio.explosion) gameAudio.explosion.volume = 0.4;

const safePlay = (audioObj) => {
  if (!audioObj || sharedState.isMuted) return;
  audioObj.currentTime = 0;
  audioObj.play().catch(() => {});
};

// 1. ENVIRONMENT, CLOUDS & OCEAN
function EnvironmentManager({ timeStats }) {
  const envRef = useRef();
  useFrame((state) => {
    if (envRef.current) envRef.current.position.copy(state.camera.position);
  });
  return (
    <group ref={envRef}>
      <ambientLight intensity={timeStats.ambient} />
      <directionalLight position={timeStats.sunPos} intensity={timeStats.directional} />
      <Sky sunPosition={timeStats.sunPos} turbidity={timeStats.turbidity} rayleigh={timeStats.rayleigh} />
      
      {timeStats.name === "Midnight" && (
        <>
          <Stars radius={150} depth={50} count={7000} factor={6} fade />
          <mesh position={[-100, 80, -300]}>
            <sphereGeometry args={[20, 32, 32]} />
            <meshBasicMaterial color="#e0f7fa" />
            <pointLight intensity={2} distance={500} color="#e0f7fa" />
          </mesh>
        </>
      )}
    </group>
  );
}

function ProceduralClouds() {
  const cloudGroup = useRef();
  const clouds = useMemo(() => Array.from({ length: 40 }).map(() => ({
    position: [(Math.random() - 0.5) * 800, Math.random() * 50 + 40, -Math.random() * 3000 - 500],
    scale: Math.random() * 15 + 5
  })), []);

  useFrame((state) => {
    if (sharedState.gameState !== 'playing' || !cloudGroup.current) return;
    cloudGroup.current.children.forEach((cloud) => {
      cloud.position.z += 0.5; 
      if (cloud.position.z > state.camera.position.z + 100) {
        cloud.position.z = state.camera.position.z - 2000 - Math.random() * 1000;
        cloud.position.x = state.camera.position.x + (Math.random() - 0.5) * 800;
      }
    });
  });

  return (
    <group ref={cloudGroup}>
      {clouds.map((c, i) => (
        <mesh key={i} position={c.position} scale={c.scale}>
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.6} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Terrain({ timeStats }) {
  const meshRef = useRef();
  const geometry = useMemo(() => new THREE.PlaneGeometry(1600, 1600, 128, 128), []); 

  useFrame((state) => {
    if (sharedState.gameState !== 'playing' || !meshRef.current) return;
    const snap = 5; 
    meshRef.current.position.z = Math.floor(state.camera.position.z / snap) * snap - 300;
    meshRef.current.position.x = Math.floor(state.camera.position.x / snap) * snap;

    const time = state.clock.elapsedTime * 2.0; 
    const positions = geometry.attributes.position.array;

    for (let i = 0; i < positions.length; i += 3) {
      const worldX = positions[i] + meshRef.current.position.x;
      const worldZ = positions[i + 1] + meshRef.current.position.z;
      let z = Math.sin(worldX * 0.01 + time) * Math.cos(worldZ * 0.015 + time) * 10; 
      z += Math.sin(worldX * 0.04 - time * 1.2 + worldZ * 0.04) * 3;                 
      positions[i + 2] = z; 
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals(); 
  });

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -25, 0]}>
      <meshPhysicalMaterial 
        color={timeStats.waterColor} 
        emissive={timeStats.waterColor} emissiveIntensity={0.05}
        roughness={0.2} metalness={0.8} transmission={0.5} transparent={true} opacity={0.85}
      />
    </mesh>
  );
}

// 2. ENEMIES (Procedural Asteroids + UFOs)
function Enemies({ stats, onTakeDamage }) {
  const groupRef = useRef();

  const enemyCount = stats.type === 'speedster' ? 120 : stats.type === 'balanced' ? 70 : 35;

  const initialEnemies = useMemo(() => Array.from({ length: enemyCount }).map(() => {
    const isUfo = Math.random() > 0.5; 
    return {
      type: isUfo ? 'ufo' : 'asteroid',
      active: true,
      hp: isUfo ? 2 : 1, 
      scale: isUfo ? Math.random() * 1.5 + 1 : Math.random() * 2 + 1.5,
      position: new THREE.Vector3((Math.random() - 0.5) * 600, Math.random() * 60 + 10, -Math.random() * 4000 - 300)
    };
  }), [stats.type]); 

  useEffect(() => { sharedState.enemies = initialEnemies; }, [initialEnemies]);

  useFrame((state) => {
    if (sharedState.gameState !== 'playing' || !groupRef.current) return;

    groupRef.current.children.forEach((mesh, i) => {
      const e = sharedState.enemies[i];
      if (!e.active) { mesh.visible = false; return; }
      mesh.visible = true;

      if (e.type === 'asteroid') {
        mesh.rotation.x += 0.02; 
        mesh.rotation.y += 0.03; 
      } else {
        mesh.rotation.y += 0.05; 
        mesh.position.x += Math.sin(state.clock.elapsedTime * 2 + i) * 0.5; 
      }
      mesh.position.copy(e.position);

      if (e.position.distanceTo(sharedState.heroPosition) < 6 * e.scale) {
        e.active = false; 
        sharedState.shakeIntensity = 6; 
        
        safePlay(gameAudio.explosion); // PLAY COLLISION AUDIO

        const flash = document.getElementById('damage-flash');
        if(flash) { flash.style.opacity = '1'; setTimeout(() => flash.style.opacity = '0', 200); }
        onTakeDamage();           
      }

      if (e.position.z > state.camera.position.z + 50 || Math.abs(e.position.x - sharedState.heroPosition.x) > 400) {
        e.position.z = state.camera.position.z - 1000 - Math.random() * 2000;
        e.position.x = sharedState.heroPosition.x + (Math.random() - 0.5) * 600;
        e.position.y = Math.random() * 60 + 10;
        e.active = true; 
        e.hp = e.type === 'ufo' ? 2 : 1; 
      }
    });
  });

  return (
    <group ref={groupRef}>
      {initialEnemies.map((e, i) => (
        <group key={i} scale={e.scale}>
          {e.type === 'ufo' ? (
            <group>
              <mesh><cylinderGeometry args={[4, 4, 0.8, 24]} /><meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} /></mesh>
              <mesh position={[0, 0.8, 0]}><sphereGeometry args={[1.8, 16, 16]} /><meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={2} /></mesh>
            </group>
          ) : (
            <mesh>
              <dodecahedronGeometry args={[3, 0]} />
              <meshStandardMaterial color="#333" roughness={0.9} />
              <mesh>
                 <dodecahedronGeometry args={[3.2, 0]} />
                 <meshBasicMaterial color="#ff5500" wireframe={true} transparent opacity={0.3} />
              </mesh>
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

// 3. PROJECTILES
function Projectiles({ onScore }) {
  const groupRef = useRef();
  useFrame((state, delta) => {
    if (sharedState.gameState !== 'playing' || !groupRef.current) return;
    groupRef.current.children.forEach((mesh, i) => {
      const bullet = sharedState.projectiles[i];
      if (bullet && bullet.active) {
        mesh.visible = true;
        bullet.position.z -= 1000 * delta; 
        mesh.position.copy(bullet.position);

        for (let j = 0; j < sharedState.enemies.length; j++) {
          const enemy = sharedState.enemies[j];
          if (enemy.active && bullet.position.distanceTo(enemy.position) < 12) {
            enemy.hp -= 1; 
            bullet.active = false; 
            if (enemy.hp <= 0) {
              enemy.active = false; 
              safePlay(gameAudio.explosion); // PLAY DESTRUCTION AUDIO
              onScore(); 
            } else {
              enemy.scale *= 0.7; 
            }
            break; 
          }
        }
        if (bullet.position.distanceTo(sharedState.heroPosition) > 1500) bullet.active = false;
      } else mesh.visible = false;
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh key={i} visible={false}>
          <capsuleGeometry args={[0.8, 8, 4, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#00ffff" emissiveIntensity={10} />
        </mesh>
      ))}
    </group>
  );
}

// 4. EXTERNAL HERO MODEL & PHYSICS
function Hero({ stats }) {
  const heroRef = useRef();
  const visualRef = useRef(); 
  const { camera } = useThree();
  const velocity = useRef(new THREE.Vector2(0, 0));
  const lastShot = useRef(0);
  const bulletIndex = useRef(0);

  const speedsterModel = useGLTF('/rocket_topA.glb');
  const balancedModel = useGLTF('/rocket_baseA.glb');
  const tankModel = useGLTF('/rocket_baseB.glb');

  useFrame((state, delta) => {
    if (sharedState.gameState !== 'playing' || !heroRef.current) return;

    let currentSpeed = stats.speed;
    const isBoosting = inputState.boost && sharedState.fuel > 0;
    
    if (isBoosting) {
      currentSpeed = stats.speed * 2.0; 
      sharedState.fuel = Math.max(0, sharedState.fuel - stats.fuelDrain * delta);
    } else {
      sharedState.fuel = Math.min(100, sharedState.fuel + (stats.fuelDrain * 0.3) * delta);
    }

    const isShooting = inputState.fire;
    if (isShooting && sharedState.ammo >= stats.ammoCost && state.clock.elapsedTime - lastShot.current > 0.15) {
      lastShot.current = state.clock.elapsedTime;
      sharedState.ammo -= stats.ammoCost;
      sharedState.projectiles[bulletIndex.current] = { active: true, position: heroRef.current.position.clone().add(new THREE.Vector3(0, 0, -3)) };
      bulletIndex.current = (bulletIndex.current + 1) % 20;
      
      safePlay(gameAudio.laser); // PLAY SHOOTING AUDIO

    } else if (!isShooting) {
      sharedState.ammo = Math.min(100, sharedState.ammo + (stats.ammoCost * 0.25 * 60) * delta);
    }

    const fuelBar = document.getElementById('fuel-fill');
    const ammoBar = document.getElementById('ammo-fill');
    if (fuelBar) fuelBar.style.width = `${sharedState.fuel}%`;
    if (ammoBar) ammoBar.style.width = `${sharedState.ammo}%`;

    heroRef.current.position.z -= currentSpeed * delta;
    const accel = stats.turn * delta;
    
    let targetVx = 0, targetVy = 0;
    if (inputState.left) targetVx = -accel;
    if (inputState.right) targetVx = accel;
    if (inputState.up) targetVy = accel;
    if (inputState.down) targetVy = -accel;

    velocity.current.x = THREE.MathUtils.lerp(velocity.current.x, targetVx, 0.08);
    velocity.current.y = THREE.MathUtils.lerp(velocity.current.y, targetVy, 0.08);
    
    heroRef.current.position.x += velocity.current.x;
    heroRef.current.position.y += velocity.current.y;
    heroRef.current.position.y = Math.max(5, Math.min(heroRef.current.position.y, 80));

    sharedState.heroPosition.copy(heroRef.current.position);

    if (sharedState.shakeIntensity > 0) {
      visualRef.current.position.x = (Math.random() - 0.5) * sharedState.shakeIntensity;
      visualRef.current.position.y = (Math.random() - 0.5) * sharedState.shakeIntensity;
      sharedState.shakeIntensity -= delta * 15; 
    } else {
      visualRef.current.position.set(0,0,0);
    }

    const leanAngle = (velocity.current.x / accel) * -0.6; 
    visualRef.current.rotation.z = THREE.MathUtils.lerp(visualRef.current.rotation.z, leanAngle, 0.1);

    const targetFov = isBoosting ? 85 : 65;
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.1);
    camera.updateProjectionMatrix();

    const zOffset = isBoosting ? 22 : 15;
    const baseCamPos = heroRef.current.position.clone().add(new THREE.Vector3(0, 4, zOffset));
    if(sharedState.shakeIntensity > 0) {
       baseCamPos.x += (Math.random() - 0.5) * sharedState.shakeIntensity;
       baseCamPos.y += (Math.random() - 0.5) * sharedState.shakeIntensity;
    }
    camera.position.lerp(baseCamPos, 0.1);
    camera.lookAt(heroRef.current.position);
  });

  return (
    <group ref={heroRef} position={[0, 15, 0]}>
      <group ref={visualRef}>
        <Center>
          <group rotation={[-Math.PI / 2, 0, 0]} scale={3}>
            {stats.type === 'speedster' && <primitive object={speedsterModel.scene.clone()} />}
            {stats.type === 'balanced' && <primitive object={balancedModel.scene.clone()} />}
            {stats.type === 'tank' && <primitive object={tankModel.scene.clone()} />}
          </group>
        </Center>
        <pointLight intensity={400} distance={120} color={stats.color} decay={2} />
      </group>
    </group>
  );
}

// 5. MAIN APP & UI OVERLAY
export default function App() {
  const [activeHero, setActiveHero] = useState('balanced');
  const [activeTime, setActiveTime] = useState('day');
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(HERO_TYPES['balanced'].maxHealth);
  const [gameState, setGameState] = useState('menu'); 
  const [isMobile, setIsMobile] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [controlMode, setControlMode] = useState('pc');
  
  // Audio State
  const [isMuted, setIsMuted] = useState(false);

  // Sync mute state securely to HTML elements
  useEffect(() => {
    sharedState.isMuted = isMuted;
    if (gameAudio.bgMusic) gameAudio.bgMusic.muted = isMuted;
    if (gameAudio.laser) gameAudio.laser.muted = isMuted;
    if (gameAudio.explosion) gameAudio.explosion.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsBooting(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => { 
    sharedState.gameState = gameState; 
    setControlMode(window.innerWidth < 768 ? 'mobile' : 'pc');

    // Handle background music lifecycle
    if (gameAudio.bgMusic) {
      if (gameState === 'playing') {
        gameAudio.bgMusic.play().catch(() => {});
      } else {
        gameAudio.bgMusic.pause();
        gameAudio.bgMusic.currentTime = 0;
      }
    }
  }, [gameState]);

  const startGame = () => {
    setScore(0); setHealth(HERO_TYPES[activeHero].maxHealth);
    sharedState.fuel = 100; sharedState.ammo = 100; sharedState.shakeIntensity = 0;
    sharedState.enemies.forEach(e => { e.active = true; e.position.z -= Math.random() * 2000; });
    
    // Trigger BGM on user interaction
    if (!isMuted && gameAudio.bgMusic) {
      gameAudio.bgMusic.play().catch(() => console.warn("Browser blocked autoplay."));
    }
    setGameState('playing');
  };

  const handleTakeDamage = () => {
    setHealth(prev => {
      const newHealth = prev - 1;
      if (newHealth <= 0) setGameState('gameover');
      return newHealth;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'w' || e.key === 'W') inputState.up = true;
      if (e.key === 'a' || e.key === 'A') inputState.left = true;
      if (e.key === 's' || e.key === 'S') inputState.down = true;
      if (e.key === 'd' || e.key === 'D') inputState.right = true;
      if (e.key === ' ') inputState.fire = true;
      if (e.key === 'Shift') inputState.boost = true;
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        setGameState(c => c === 'playing' ? 'paused' : (c === 'paused' ? 'playing' : c));
      }
    };
    const handleKeyUp = (e) => {
      if (e.key === 'w' || e.key === 'W') inputState.up = false;
      if (e.key === 'a' || e.key === 'A') inputState.left = false;
      if (e.key === 's' || e.key === 'S') inputState.down = false;
      if (e.key === 'd' || e.key === 'D') inputState.right = false;
      if (e.key === ' ') inputState.fire = false;
      if (e.key === 'Shift') inputState.boost = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, []);

  const mobBtnStyle = { 
    width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', 
    border: '2px solid rgba(255,255,255,0.5)', color: '#fff', fontSize: '20px', display: 'flex', 
    justifyContent: 'center', alignItems: 'center', userSelect: 'none', touchAction: 'none' 
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000', overflow: 'hidden' }}>
      
      {/* GLOBAL MUTE TOGGLE */}
      {!isBooting && (
        <button 
          onClick={() => setIsMuted(!isMuted)}
          style={{
            position: 'absolute', top: '20px', right: '20px', zIndex: 50,
            background: 'rgba(0,0,0,0.5)', border: '1px solid #00ffcc', color: '#00ffcc',
            borderRadius: '50%', width: '45px', height: '45px', fontSize: '20px',
            cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center',
            backdropFilter: 'blur(5px)', outline: 'none'
          }}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      )}

      {/* CUSTOM BOOT SCREEN */}
      {isBooting && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: '#0a0a0f', zIndex: 9999, display: 'flex', flexDirection: 'column', 
          justifyContent: 'center', alignItems: 'center', overflow: 'hidden'
        }}>
          <div style={{ animation: 'slideIn 2.5s cubic-bezier(0.25, 1, 0.5, 1) forwards', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h1 style={{ 
              color: '#00ffcc', fontSize: 'clamp(40px, 8vw, 80px)', fontFamily: 'monospace', 
              letterSpacing: '15px', margin: 0, textShadow: '0 0 20px rgba(0,255,204,0.5)'
            }}>
              AERODRIFT
            </h1>
            <div style={{
              color: '#00ffcc', fontSize: '14px', fontFamily: 'monospace',
              fontWeight: 'normal', letterSpacing: '2px', marginTop: '10px',
              textShadow: '0 0 10px rgba(0,255,204,0.5)'
            }}>
              made by Tejash Raj
            </div>
          </div>
          <style>{`
            @keyframes slideIn {
              0% { transform: translateX(-100vw); opacity: 0; }
              30% { transform: translateX(0); opacity: 1; }
              70% { transform: translateX(0); opacity: 1; }
              100% { transform: translateX(100vw); opacity: 0; }
            }
          `}</style>
        </div>
      )}

      {/* DAMAGE FLASH */}
      <div id="damage-flash" style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none',
        boxShadow: 'inset 0 0 150px rgba(255, 0, 0, 0.8)', opacity: 0, transition: 'opacity 0.1s', zIndex: 15
      }}></div>

      {gameState === 'playing' && health === 1 && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none',
          boxShadow: 'inset 0 0 80px rgba(255, 0, 0, 0.5)', zIndex: 5, animation: 'pulse 1s infinite'
        }}>
          <style>{`@keyframes pulse { 0% { opacity: 0.3; } 50% { opacity: 1; } 100% { opacity: 0.3; } }`}</style>
        </div>
      )}

      {/* CROSSHAIR */}
      {gameState === 'playing' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          color: 'rgba(0, 255, 255, 0.5)', fontSize: '24px', pointerEvents: 'none', zIndex: 10, fontWeight: '100'
        }}>+</div>
      )}

      {/* --- HUD --- */}
      {gameState === 'playing' && (
        <div style={{ position: 'absolute', top: 30, left: 40, zIndex: 10, color: 'white', fontFamily: 'sans-serif', textShadow: '0px 2px 4px rgba(0,0,0,0.8)' }}>
          <h1 style={{ fontSize: '42px', margin: 0, fontWeight: 900, letterSpacing: '2px' }}>{score}</h1>
          <h2 style={{ fontSize: '24px', margin: '5px 0 20px 0', color: '#ff003c', textShadow: '0 0 10px rgba(255,0,60,0.5)' }}>
            {'❤'.repeat(health)}
          </h2>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ width: '150px', height: '4px', background: 'rgba(255,255,255,0.2)' }}>
              <div id="fuel-fill" style={{ width: '100%', height: '100%', background: '#fff' }}></div>
            </div>
          </div>
          <div>
            <div style={{ width: '150px', height: '4px', background: 'rgba(255,255,255,0.2)' }}>
              <div id="ammo-fill" style={{ width: '100%', height: '100%', background: '#00ffff' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* --- PC CONTROLS BAR --- */}
      {gameState === 'playing' && controlMode === 'pc' && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, width: '100%',
          background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(8px)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '40px',
          padding: '12px 0', zIndex: 10, fontFamily: 'sans-serif'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ background: 'rgba(0, 255, 204, 0.1)', color: '#00ffcc', border: '1px solid rgba(0,255,204,0.3)', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', marginRight: '8px' }}>W A S D</span> 
            <span style={{ color: '#aaa', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Steer</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ background: 'rgba(0, 255, 204, 0.1)', color: '#00ffcc', border: '1px solid rgba(0,255,204,0.3)', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', marginRight: '8px' }}>SHIFT</span> 
            <span style={{ color: '#aaa', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Warp Boost</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ background: 'rgba(0, 255, 204, 0.1)', color: '#00ffcc', border: '1px solid rgba(0,255,204,0.3)', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', marginRight: '8px' }}>SPACE</span> 
            <span style={{ color: '#aaa', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Fire Lasers</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ background: 'rgba(0, 255, 204, 0.1)', color: '#00ffcc', border: '1px solid rgba(0,255,204,0.3)', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', marginRight: '8px' }}>P</span> 
            <span style={{ color: '#aaa', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Pause</span>
          </div>
        </div>
      )}

      {/* --- MOBILE TOUCH CONTROLS --- */}
      {gameState === 'playing' && controlMode === 'mobile' && (
        <div style={{ position: 'absolute', bottom: 30, left: 0, width: '100%', zIndex: 20, display: 'flex', justifyContent: 'space-between', padding: '0 20px', boxSizing: 'border-box', touchAction: 'none' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '50px 50px 50px', gridTemplateRows: '50px 50px', gap: '10px', alignItems: 'center', justifyItems: 'center' }}>
            <div />
            <button onPointerDown={(e) => { e.preventDefault(); inputState.up = true; }} onPointerUp={(e) => { e.preventDefault(); inputState.up = false; }} style={mobBtnStyle}>↑</button>
            <div />
            <button onPointerDown={(e) => { e.preventDefault(); inputState.left = true; }} onPointerUp={(e) => { e.preventDefault(); inputState.left = false; }} style={mobBtnStyle}>←</button>
            <button onPointerDown={(e) => { e.preventDefault(); inputState.down = true; }} onPointerUp={(e) => { e.preventDefault(); inputState.down = false; }} style={mobBtnStyle}>↓</button>
            <button onPointerDown={(e) => { e.preventDefault(); inputState.right = true; }} onPointerUp={(e) => { e.preventDefault(); inputState.right = false; }} style={mobBtnStyle}>→</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
            <button 
              onPointerDown={(e) => { e.preventDefault(); inputState.boost = true; }} 
              onPointerUp={(e) => { e.preventDefault(); inputState.boost = false; }} 
              style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '2px solid #fff', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>BOOST</button>
            <button 
              onPointerDown={(e) => { e.preventDefault(); inputState.fire = true; }} 
              onPointerUp={(e) => { e.preventDefault(); inputState.fire = false; }} 
              style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(0,255,255,0.3)', border: '2px solid #00ffff', color: '#00ffff', fontSize: '14px', fontWeight: 'bold' }}>FIRE</button>
          </div>
        </div>
      )}

      {/* --- MENU --- */}
      {gameState === 'menu' && !isBooting && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 20, background: 'rgba(10, 10, 15, 0.9)', backdropFilter: 'blur(15px)', padding: '40px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center', width: '90%', maxWidth: '500px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          {showStory ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <h2 style={{ color: '#00ffcc', margin: '0 0 15px 0' }}>MISSION BRIEFING</h2>
              <p style={{ color: '#ddd', lineHeight: '1.6', textAlign: 'center', marginBottom: '25px', fontSize: '14px' }}>
                Earth is under attack. Alien forces have shattered our moon, sending a massive asteroid shower toward the ocean. Pilot our experimental ships, destroy the UFOs, blast the rocks. Manage fuel, laser energy, and save the planet!
              </p>
              <button onClick={() => setShowStory(false)} style={{ padding: '10px 20px', background: '#333', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>BACK TO MENU</button>
            </div>
          ) : (
            <>
              <h1 style={{ color: '#fff', margin: '0 0 5px 0', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 900, letterSpacing: '2px' }}>AERODRIFT</h1>
              <p style={{ color: '#00ffcc', margin: '0 0 20px 0', fontSize: '14px', letterSpacing: '1px' }}>DEFEND THE OCEAN. SAVE THE PLANET.</p>
              
              <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                <button onClick={() => setShowStory(true)} style={{ background: 'transparent', border: '1px solid #00ffcc', color: '#00ffcc', padding: '8px 20px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                  WHAT'S HAPPENING?
                </button>
                <button onClick={() => setControlMode(prev => prev === 'pc' ? 'mobile' : 'pc')} style={{ background: 'transparent', border: '1px solid #aaa', color: '#aaa', padding: '8px 20px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                  MODE: {controlMode === 'pc' ? '🖥️ KEYBOARD' : '📱 TOUCH'}
                </button>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap', width: '100%' }}>
                {Object.keys(HERO_TYPES).map((key) => (
                  <button key={key} onClick={() => setActiveHero(key)} style={{ flex: '1 1 auto', padding: '15px 10px', borderRadius: '8px', cursor: 'pointer', background: activeHero === key ? HERO_TYPES[key].color : 'transparent', color: activeHero === key ? '#000' : '#fff', border: `1px solid ${HERO_TYPES[key].color}`, fontWeight: 'bold' }}>
                    {HERO_TYPES[key].name} <br/><span style={{ fontSize: '12px', fontWeight: 'normal', opacity: 0.8 }}>HP: {HERO_TYPES[key].maxHealth}</span>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '30px', flexWrap: 'wrap', width: '100%' }}>
                {Object.keys(TIMELINES).map((key) => (
                  <button key={key} onClick={() => setActiveTime(key)} style={{ flex: '1 1 auto', padding: '10px', background: activeTime === key ? '#fff' : 'transparent', color: activeTime === key ? '#000' : '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', textTransform: 'uppercase' }}>
                    {TIMELINES[key].name}
                  </button>
                ))}
              </div>

              <button onClick={startGame} style={{ width: '100%', padding: '20px', fontSize: '20px', fontWeight: 'bold', letterSpacing: '2px', cursor: 'pointer', background: '#fff', color: '#000', border: 'none', borderRadius: '8px' }}>INITIATE LAUNCH</button>
            </>
          )}
        </div>
      )}

      {/* --- PAUSED / GAMEOVER MENUS --- */}
      {gameState === 'paused' && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 30, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
          <h1 style={{ color: '#fff', fontSize: '48px', letterSpacing: '10px', margin: 0 }}>PAUSED</h1>
          <button onClick={() => setGameState('playing')} style={{ padding: '15px 40px', fontSize: '20px', cursor: 'pointer', background: '#00ffcc', color: '#000', border: 'none', borderRadius: '8px', marginTop: '30px', fontWeight: 'bold' }}>RESUME FLIGHT</button>
          <button onClick={() => setGameState('menu')} style={{ padding: '10px 30px', fontSize: '14px', cursor: 'pointer', background: 'transparent', color: '#aaa', border: 'none', marginTop: '20px' }}>ABORT MISSION</button>
        </div>
      )}

      {gameState === 'gameover' && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 30, background: 'rgba(255, 0, 60, 0.3)', backdropFilter: 'blur(15px)', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
          <h1 style={{ color: '#fff', fontSize: 'clamp(48px, 8vw, 64px)', textShadow: '0 0 30px #ff003c', margin: 0, fontWeight: 900 }}>MISSION FAILED</h1>
          <h2 style={{ color: '#fff', fontSize: '32px', margin: '20px 0' }}>SCORE: {score}</h2>
          <button onClick={() => setGameState('menu')} style={{ padding: '20px 50px', fontSize: '20px', cursor: 'pointer', background: '#fff', color: '#ff003c', border: 'none', borderRadius: '8px', marginTop: '20px', fontWeight: 'bold', letterSpacing: '1px' }}>RETURN TO BASE</button>
        </div>
      )}

      {(gameState === 'menu' || gameState === 'gameover') && !isBooting && (
        <div style={{
          position: 'absolute', bottom: '20px', width: '100%', zIndex: 40,
          display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '15px',
          color: '#aaa', fontSize: '12px', fontFamily: 'sans-serif', padding: '0 20px', textAlign: 'center'
        }}>
          <span>Developed and Designed by <strong>Tejash Raj</strong> (from IIT Guwahati)</span>
          <a href="https://www.behance.net/tejashraj" target="_blank" rel="noopener noreferrer" style={{
            padding: '8px 16px', background: '#00ffcc', color: '#000', textDecoration: 'none',
            borderRadius: '4px', fontWeight: 'bold', letterSpacing: '1px', transition: 'background 0.2s'
          }}>
            SEE MORE WORK
          </a>
        </div>
      )}

      {/* --- 3D ENGINE --- */}
      <Canvas camera={{ position: [0, 5, 10], fov: 65 }}>
        <Suspense fallback={null}>
          <EnvironmentManager timeStats={TIMELINES[activeTime]} />
          <ProceduralClouds />
          <Terrain timeStats={TIMELINES[activeTime]} />
          <Hero stats={HERO_TYPES[activeHero]} />
          <Enemies stats={HERO_TYPES[activeHero]} onTakeDamage={handleTakeDamage} />
          <Projectiles onScore={() => setScore(s => s + 100)} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload('/rocket_topA.glb');
useGLTF.preload('/rocket_baseA.glb');
useGLTF.preload('/rocket_baseB.glb');