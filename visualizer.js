import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { PRESETS } from './settings.js';
import { logger } from './logger.js';

const NOISE_CHUNK = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
    i.z+vec4(0.0,i1.z,i2.z,1.0))
    +i.y+vec4(0.0,i1.y,i2.y,1.0))
    +i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

const VERTEX_SHADER = `
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uBeatPulse;
uniform float uDrop;
uniform float uImpact;

varying vec3 vNormal;
varying float vDisplacement;
varying vec3 vPosition;

${NOISE_CHUNK}

void main() {
  vNormal = normal;

  // Respiración orgánica continua (medios + energía)
  float baseNoise = snoise(position * 0.25 + uTime * 0.12);
  float breath = baseNoise * (0.14 + uMid * 0.42);

  // Kick + drop: estiramiento vertical (prioridad a golpes fuertes)
  float kickAccent = pow(max(0.0, 1.0 - uBeatPhase), 2.2) * uBeatPulse;
  float dropAccent = uDrop * (0.85 + uImpact * 0.4);
  float stretchIntensity = smoothstep(0.32, 0.88, uBass) * (0.28 + uBeat * 0.5);
  stretchIntensity += kickAccent * 0.65 + dropAccent * 0.95;

  // Medios: torsión y anillos (patrones vivos)
  float twist = snoise(vec3(position.x * 0.7, position.y * 0.7 + uTime * 0.18, position.z)) * uMid * 0.28;
  float rings = sin((position.x * 2.8 + position.y * 3.2) + uTime * 0.55 + uMid * 5.0) * uMid * 0.16;

  vec3 stretchPos = position;
  stretchPos.y *= 1.0 + stretchIntensity * 0.9;
  stretchPos.x *= 1.0 - stretchIntensity * 0.17;
  stretchPos.z *= 1.0 - stretchIntensity * 0.17;

  float warpNoise = snoise(stretchPos * 0.55 - uTime * 0.32);
  float warp = warpNoise * (uEnergy * 0.52) * (1.0 + uBeat * 0.45 + dropAccent * 0.5);

  // Agudos: textura fina en superficie
  float trebleRipples = snoise(position * 1.6 + uTime * 2.6) * uTreble * 0.24;

  float totalDisp = breath + warp + trebleRipples + twist + rings;
  totalDisp = clamp(totalDisp, -0.8, 1.05);

  float globalScale = 1.0 + stretchIntensity * 0.14 + uEnergy * 0.1 + dropAccent * 0.18;

  vDisplacement = totalDisp;
  vPosition = position;

  vec3 newPosition = position * globalScale + normal * totalDisp;
  newPosition.y *= 1.0 + stretchIntensity * 0.42 + dropAccent * 0.15;
  newPosition.x *= 1.0 - stretchIntensity * 0.12;
  newPosition.z *= 1.0 - stretchIntensity * 0.12;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

const FRAGMENT_SHADER = `
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uEnergy;
uniform float uOpacity;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uBeatPulse;
uniform float uDrop;
uniform float uImpact;

varying vec3 vNormal;
varying float vDisplacement;
varying vec3 vPosition;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  float hue = fract(uTime * 0.04 + vDisplacement * 0.16 + uBeat * 0.2 + uDrop * 0.12);
  float saturation = 0.8 + uMid * 0.15 + uTreble * 0.05;
  float value = 0.13 + uBass * 0.24 + uEnergy * 0.1 + vDisplacement * 0.08;
  value += uBeatPulse * 0.16 + uDrop * 0.22 + uImpact * 0.1;
  value = clamp(value, 0.06, 0.6);

  vec3 color = hsv2rgb(vec3(hue, saturation, value));

  float bands = sin(vDisplacement * 14.0 + uTime * 1.8 + uMid * 2.0) * 0.5 + 0.5;
  color *= 0.9 + bands * uMid * 0.22;

  float rim = 1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
  rim = smoothstep(0.58, 1.0, rim);
  color += color * rim * (0.3 + uTreble * 0.3 + uDrop * 0.35);

  gl_FragColor = vec4(color, uOpacity);
}
`;

const STROBE_COLORS = [
  new THREE.Color(0xffffff),
  new THREE.Color(0xffffff),
  new THREE.Color(0xff0055),
  new THREE.Color(0x00ffcc),
  new THREE.Color(0x8800ff),
  new THREE.Color(0x00aaff),
  new THREE.Color(0xff6600),
  new THREE.Color(0xaaff00),
  new THREE.Color(0xff00ff),
  new THREE.Color(0x00ff66)
];

export function createVisualizer(container, settingsManager) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 20;

  const preset = settingsManager.get().preset;
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(PRESETS[preset].pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.6;
  container.appendChild(renderer.domElement);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.3, 0.6, 0.9
  );
  composer.addPass(bloomPass);

  const rgbShiftPass = new ShaderPass(RGBShiftShader);
  rgbShiftPass.uniforms.amount.value = 0.0;
  composer.addPass(rgbShiftPass);

  const geometry = new THREE.IcosahedronGeometry(3, PRESETS[preset].geoDetail);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uEnergy: { value: 0 },
      uOpacity: { value: 1.0 },
      uBeat: { value: 0 },
      uBeatPhase: { value: 0 },
      uBeatPulse: { value: 0 },
      uDrop: { value: 0 },
      uImpact: { value: 0 }
    },
    transparent: true
  });

  const visualizerMesh = new THREE.Mesh(geometry, material);
  scene.add(visualizerMesh);

  const wireMaterial = material.clone();
  wireMaterial.wireframe = true;
  wireMaterial.uniforms.uOpacity.value = 0.15;
  const wireMesh = new THREE.Mesh(geometry, wireMaterial);
  scene.add(wireMesh);

  let particleCount = PRESETS[preset].particles;
  let particleGeom = new THREE.BufferGeometry();
  const particlePos = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount * 3; i++) {
    particlePos[i] = (Math.random() - 0.5) * 120;
  }
  particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
  const particleMat = new THREE.PointsMaterial({
    size: 0.12, color: 0xffffff, transparent: true,
    opacity: 0.4, blending: THREE.AdditiveBlending
  });
  let particles = new THREE.Points(particleGeom, particleMat);
  scene.add(particles);

  const bgPlaneMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 });
  const bgPlane = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), bgPlaneMat);
  bgPlane.position.z = -50;
  scene.add(bgPlane);

  const clock = new THREE.Clock();
  let envBass = 0;
  let envMid = 0;
  let envTreble = 0;
  let bgFlashOpacity = 0;
  let lastStrobeColor = 0;
  let animationId = null;

  function rebuildParticles(count) {
    scene.remove(particles);
    particleGeom.dispose();
    particleCount = count;
    particleGeom = new THREE.BufferGeometry();
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) {
      pos[i] = (Math.random() - 0.5) * 120;
    }
    particleGeom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    particles = new THREE.Points(particleGeom, particleMat);
    scene.add(particles);
  }

  function applyPreset(name) {
    const p = PRESETS[name];
    settingsManager.set('preset', name);

    renderer.setPixelRatio(p.pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);

    const newGeo = new THREE.IcosahedronGeometry(3, p.geoDetail);
    visualizerMesh.geometry.dispose();
    visualizerMesh.geometry = newGeo;
    wireMesh.geometry.dispose();
    wireMesh.geometry = newGeo;

    rebuildParticles(p.particles);
    wireMesh.visible = p.wireframe;
    bloomPass.enabled = p.bloom;
    rgbShiftPass.enabled = p.rgbShift;
  }

  function envelope(current, target, attack, release) {
    const rate = target > current ? attack : release;
    return THREE.MathUtils.lerp(current, target, rate);
  }

  function updateUniforms(meshMat, time, bass, mid, treble, energy, beat) {
    meshMat.uniforms.uTime.value = time;
    meshMat.uniforms.uBass.value = bass;
    meshMat.uniforms.uMid.value = mid;
    meshMat.uniforms.uTreble.value = treble;
    meshMat.uniforms.uEnergy.value = energy;
    meshMat.uniforms.uBeat.value = beat.currentBeat;
    meshMat.uniforms.uBeatPhase.value = beat.beatPhase;
    meshMat.uniforms.uBeatPulse.value = beat.beatPulse;
    meshMat.uniforms.uDrop.value = beat.dropPulse ?? 0;
    meshMat.uniforms.uImpact.value = beat.impactLevel ?? 0;
  }

  function animate(audioEngine) {
    animationId = requestAnimationFrame(() => animate(audioEngine));

    const delta = clock.getDelta();
    const time = clock.getElapsedTime();
    const settings = settingsManager.get();
    const bands = audioEngine.getFrequencyBands();
    const isPlaying = audioEngine.getIsPlaying();

    const idlePulse = 0.2 + Math.sin(time * 0.9) * 0.08;

    // Envelopes: MEJORADOS — ataque muy rápido, release medio (más tight)
    if (isPlaying) {
      envBass = envelope(envBass, bands.rawBass, 0.52, 0.18);      // Ataque + rápido, release más rápido
      envMid = envelope(envMid, bands.rawMid, 0.45, 0.14);          // Más responsive
      envTreble = envelope(envTreble, bands.rawTreble, 0.48, 0.20); // Agudos más rápidos
    } else {
      envBass = envelope(envBass, idlePulse * 0.28, 0.1, 0.08);
      envMid = envelope(envMid, idlePulse * 0.5, 0.1, 0.08);
      envTreble = envelope(envTreble, idlePulse * 0.18, 0.1, 0.08);
    }

    const beat = audioEngine.beatDetector.update(
      bands.rawBass, bands.rawMid, bands.rawTreble, time, isPlaying, delta
    );

    const drop = beat.dropPulse ?? 0;
    const impact = beat.impactLevel ?? 0;
    const snare = beat.snarePulse ?? 0;
    const midHit = beat.midPulse ?? 0;

    // Capas mezcladas MEJORADO: prioritize beats, drops y bass
    const displayBass = isPlaying
      ? Math.max(envBass, beat.beatPulse * bands.rawBass * 1.1, drop * bands.rawBass * 1.0)
      : envBass;
    
    const displayMid = envMid + beat.rhythmWave * 0.18 + midHit * 0.4 + snare * 0.15;
    const displayTreble = envTreble + snare * 0.32 + (beat.trebleDelta > 0.03 ? beat.trebleDelta * 0.5 : 0);
    const energy = displayBass * 0.55 + displayMid * 0.30 + displayTreble * 0.15;

    const hitFlash = beat.isBeat || beat.isDrop;
    if (hitFlash && settings.isStrobeEnabled) {
      const flashIntensity = THREE.MathUtils.clamp(
        (beat.isDrop ? 1.0 : bands.rawBass * 2.2), 0.6, 1.0
      );
      bgFlashOpacity = Math.max(bgFlashOpacity, flashIntensity);
      lastStrobeColor = Math.floor(Math.random() * STROBE_COLORS.length);
    }

    updateUniforms(material, time, displayBass, displayMid, displayTreble, energy, beat);
    updateUniforms(wireMaterial, time, displayBass, displayMid, displayTreble, energy, beat);
    wireMaterial.uniforms.uOpacity.value = 0.08 + displayTreble * 0.5 + snare * 0.28 + drop * 0.18;

    // Escala MEJORADA: más agresiva en drops y kicks
    let targetScale =
      1.0 +
      displayBass * 0.5 +          // Bajos más dominantes
      displayMid * 0.16 +
      displayTreble * 0.07 +
      beat.beatPulse * 0.52 +      // Kicks más visibles
      drop * 0.85 +                 // Drops mucho más visibles
      impact * 0.42;
    if (!Number.isFinite(targetScale)) targetScale = 1.0;

    // Lerp MEJORADO: más rápido en beats/drops para seguir el ritmo
    const scaleLerp = drop > 0.4 ? 0.68 : (beat.beatPulse > 0.6 ? 0.58 : 0.22);
    visualizerMesh.scale.setScalar(
      THREE.MathUtils.lerp(visualizerMesh.scale.x, targetScale, scaleLerp)
    );
    wireMesh.scale.setScalar(visualizerMesh.scale.x * (1.025 + displayTreble * 0.14 + snare * 0.06));

    // Orientación MEJORADA: responde más rápido y precisamente a beats
    const cam = settings.cameraSpeedMult;
    if (isPlaying) {
      // Tilt impulsivo (beat tilt es el más importante)
      const beatTilt = beat.beatPulse > 0.3 ? beat.beatPulse * 0.45 : beat.tiltX * 0.9;
      const phaseWobble = Math.sin(beat.beatPhase * Math.PI * 2) * displayMid * 0.042;
      
      visualizerMesh.rotation.x = beatTilt + phaseWobble + time * 0.012 * cam;
      visualizerMesh.rotation.y = beat.tiltY * 0.9 + time * 0.015 * cam + drop * 0.12;
      visualizerMesh.rotation.z = snare * 0.08 + midHit * 0.05 + drop * 0.06;
    } else {
      visualizerMesh.rotation.x = Math.sin(time * 0.35) * 0.06;
      visualizerMesh.rotation.y = Math.sin(time * 0.28) * 0.05;
      visualizerMesh.rotation.z = 0;
    }
    wireMesh.rotation.x = visualizerMesh.rotation.x * 1.04;
    wireMesh.rotation.y = visualizerMesh.rotation.y * 1.04;
    wireMesh.rotation.z = visualizerMesh.rotation.z * 1.02;

    particles.rotation.y = time * 0.008 * cam + beat.tiltY * 0.35;
    particles.rotation.x = Math.sin(time * 0.04) * displayBass * 0.1 + drop * 0.08;
    const pScale = 1.0 + displayBass * 1.5 + drop * 0.55 + energy * 0.28;
    particles.scale.set(pScale, pScale, pScale);

    if (settings.isStrobeEnabled) {
      bgPlaneMat.color.copy(settings.isBlackAndWhite ? STROBE_COLORS[0] : STROBE_COLORS[lastStrobeColor]);
      bgPlaneMat.opacity = bgFlashOpacity;
    } else {
      bgPlaneMat.opacity = 0;
    }

    bgFlashOpacity *= settings.flashDecay;
    if (bgFlashOpacity < 0.01) bgFlashOpacity = 0;

    const bgColor = new THREE.Color(0x000000);
    if (bgFlashOpacity > 0.05 && settings.isStrobeEnabled) {
      const tint = settings.isBlackAndWhite ? STROBE_COLORS[0] : STROBE_COLORS[lastStrobeColor];
      // Tinte suave para no tapar el visual central
      bgColor.copy(tint).multiplyScalar(bgFlashOpacity * 0.22);
    }
    scene.background = bgColor;

    const targetFov = 70 + displayBass * 11 + beat.beatPulse * 32 + drop * 52 + impact * 22;
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, drop > 0.25 ? 0.32 : (beat.beatPulse > 0.4 ? 0.24 : 0.16));
    camera.updateProjectionMatrix();

    // Camera shake MEJORADO: más fuerte en drops y beats
    if (displayBass > 0.45 && (beat.beatPulse > 0.25 || drop > 0.2)) {
      const shake = (displayBass - 0.45) * (impact + drop * 0.6) * 2.2;
      camera.position.x = (Math.random() - 0.5) * shake * 1.15;
      camera.position.y = (Math.random() - 0.5) * shake * 1.15;
    } else {
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, 0.12);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0, 0.12);
    }

    bloomPass.strength = settings.glowStrength + displayBass * 0.14 + drop * 0.12 + energy * 0.05;

    const targetShift = displayTreble * 0.0025 + (beat.isDrop ? 0.012 : 0);
    const trebleHit = beat.trebleDelta > 0.03 ? beat.trebleDelta * 0.18 : 0;
    rgbShiftPass.uniforms.amount.value = THREE.MathUtils.lerp(
      rgbShiftPass.uniforms.amount.value, targetShift + trebleHit, 0.35
    );

    composer.render();
  }

  function start(audioEngine) {
    if (animationId) cancelAnimationFrame(animationId);
    animate(audioEngine);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener('resize', onResize);

  applyPreset(settingsManager.get().preset);

  renderer.debug.checkShaderErrors = true;

  return { 
    applyPreset, 
    start, 
    onResize,
    
    /**
     * Destruir el visualizador y limpiar recursos Three.js
     */
    destroy() {
      try {
        if (animationId) {
          cancelAnimationFrame(animationId);
          animationId = null;
        }
        
        // Remover event listeners
        window.removeEventListener('resize', onResize);
        
        // Dispose Three.js objects
        geometry?.dispose?.();
        material?.dispose?.();
        wireMaterial?.dispose?.();
        wireMeshGeo?.dispose?.();
        bgPlaneMat?.dispose?.();
        
        // Dispose composer y passes
        composer?.passes?.forEach(pass => pass.dispose?.());
        composer?.dispose?.();
        
        // Renderer
        renderer?.dispose?.();
        container?.removeChild?.(renderer.domElement);
        
        // Particle buffers
        particleGeo?.dispose?.();
        particleMat?.dispose?.();
        
        logger.info('visualizer', 'Visualizer destruido correctamente');
      } catch (err) {
        logger.error('visualizer', err, { action: 'destroy' });
      }
    }
  };
}
