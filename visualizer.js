import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { PRESETS } from './settings.js';

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

varying vec3 vNormal;
varying float vDisplacement;
varying vec3 vPosition;

${NOISE_CHUNK}

void main() {
  vNormal = normal;

  // Capa orgánica continua (siempre viva, no se apaga con el beat)
  float baseNoise = snoise(position * 0.25 + uTime * 0.14);
  float breath = baseNoise * (0.12 + uMid * 0.38);

  // Estiramiento por bajos + punch rítmico encima
  float kickAccent = pow(max(0.0, 1.0 - uBeatPhase), 2.0) * uBeatPulse;
  float stretchIntensity = smoothstep(0.35, 0.9, uBass) * (0.32 + uBeat * 0.55);
  stretchIntensity += kickAccent * 0.55;

  // Torsión y anillos (patrones por medios)
  float twist = snoise(vec3(position.x * 0.7, position.y * 0.7 + uTime * 0.2, position.z)) * uMid * 0.22;
  float angle = atan(position.y, position.x);
  float rings = sin(angle * 5.0 + uTime * 0.6 + uMid * 4.0) * uMid * 0.1;

  vec3 stretchPos = position;
  stretchPos.y *= 1.0 + stretchIntensity * 0.85;
  stretchPos.x *= 1.0 - stretchIntensity * 0.16;
  stretchPos.z *= 1.0 - stretchIntensity * 0.16;

  float warpNoise = snoise(stretchPos * 0.6 - uTime * 0.38);
  float warp = warpNoise * (uEnergy * 0.48) * (1.0 + uBeat * 0.4 + kickAccent * 0.3);

  float trebleRipples = snoise(position * 1.5 + uTime * 2.4) * uTreble * 0.2;

  float totalDisp = breath + warp + trebleRipples + twist + rings;
  totalDisp = clamp(totalDisp, -0.75, 0.95);

  float globalScale = 1.0 + stretchIntensity * 0.12 + uEnergy * 0.08 + kickAccent * 0.1;

  vDisplacement = totalDisp;
  vPosition = position;

  vec3 newPosition = position * globalScale + normal * totalDisp;
  newPosition.y *= 1.0 + stretchIntensity * 0.38;
  newPosition.x *= 1.0 - stretchIntensity * 0.11;
  newPosition.z *= 1.0 - stretchIntensity * 0.11;

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

varying vec3 vNormal;
varying float vDisplacement;
varying vec3 vPosition;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  // Color vivo: deriva continua + patrones de deformación + acentos de beat
  float hue = fract(uTime * 0.05 + vDisplacement * 0.14 + uBeat * 0.18 + uBeatPhase * 0.06);
  float saturation = 0.82 + uMid * 0.12;
  float value = 0.12 + uBass * 0.22 + uEnergy * 0.1 + vDisplacement * 0.07 + uBeatPulse * 0.14;
  value = clamp(value, 0.05, 0.58);

  vec3 color = hsv2rgb(vec3(hue, saturation, value));

  // Bandas de patrón en la superficie
  float bands = sin(vDisplacement * 12.0 + uTime * 2.0) * 0.5 + 0.5;
  color *= 0.92 + bands * uMid * 0.18;

  float rim = 1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
  rim = smoothstep(0.6, 1.0, rim);
  color += color * rim * (0.35 + uTreble * 0.25 + uBeatPulse * 0.2);

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
      uBeatPulse: { value: 0 }
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
  let smoothBass = 0;
  let smoothMid = 0;
  let smoothTreble = 0;
  let smoothEnergy = 0;
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

  function updateUniforms(meshMat, time, bass, mid, treble, energy, beat) {
    meshMat.uniforms.uTime.value = time;
    meshMat.uniforms.uBass.value = bass;
    meshMat.uniforms.uMid.value = mid;
    meshMat.uniforms.uTreble.value = treble;
    meshMat.uniforms.uEnergy.value = energy;
    meshMat.uniforms.uBeat.value = beat.currentBeat;
    meshMat.uniforms.uBeatPhase.value = beat.beatPhase;
    meshMat.uniforms.uBeatPulse.value = beat.beatPulse;
  }

  function animate(audioEngine) {
    animationId = requestAnimationFrame(() => animate(audioEngine));

    const time = clock.getElapsedTime();
    const settings = settingsManager.get();
    const bands = audioEngine.getFrequencyBands();
    const isPlaying = audioEngine.getIsPlaying();

    // Suavizado por banda: fluido pero reactivo al volumen
    const bassLerp = isPlaying ? 0.28 : 0.15;
    smoothBass = THREE.MathUtils.lerp(smoothBass, bands.rawBass, bassLerp);
    smoothMid = THREE.MathUtils.lerp(smoothMid, bands.rawMid, 0.16);
    smoothTreble = THREE.MathUtils.lerp(smoothTreble, bands.rawTreble, 0.18);
    smoothEnergy = THREE.MathUtils.lerp(
      smoothEnergy,
      (bands.rawBass + bands.rawMid + bands.rawTreble) / 3,
      0.2
    );

    const beat = audioEngine.beatDetector.update(bands.rawBass, bands.rawTreble, time, isPlaying);

    // Mezcla: capa orgánica suave + punch instantáneo del kick/beat
    const displayBass = Math.max(smoothBass, beat.beatPulse * bands.rawBass * 0.85);
    const displayMid = smoothMid + beat.rhythmWave * 0.12 + beat.offbeatPulse * 0.2;
    const displayTreble = smoothTreble + beat.offbeatPulse * 0.15;
    const energy = Math.max(smoothEnergy, displayBass * 0.4 + displayMid * 0.35 + displayTreble * 0.25);

    if (beat.isBeat && settings.isStrobeEnabled) {
      const flashIntensity = THREE.MathUtils.clamp(bands.rawBass * 2.0, 0.5, 0.95);
      bgFlashOpacity = Math.max(bgFlashOpacity, flashIntensity);
      lastStrobeColor = Math.floor(Math.random() * STROBE_COLORS.length);
    }

    updateUniforms(material, time, displayBass, displayMid, displayTreble, energy, beat);
    updateUniforms(wireMaterial, time, displayBass, displayMid, displayTreble, energy, beat);
    wireMaterial.uniforms.uOpacity.value = 0.06 + displayTreble * 0.4 + beat.currentBeat * 0.15;

    // Escala: respuesta continua al volumen + golpe en el beat
    const targetScale =
      1.0 +
      displayBass * 0.48 +
      displayMid * 0.18 +
      smoothEnergy * 0.15 +
      beat.currentBeat * 0.42 +
      beat.beatPulse * 0.35;
    const scaleLerp = beat.currentBeat > 0.45 || beat.isBeat ? 0.52 : 0.16;
    const currentScale = visualizerMesh.scale.x;
    visualizerMesh.scale.setScalar(THREE.MathUtils.lerp(currentScale, targetScale, scaleLerp));
    wireMesh.scale.setScalar(visualizerMesh.scale.x * (1.03 + displayTreble * 0.18 + beat.beatPulse * 0.06));

    // Rotación fluida + empuje en beats
    const rTime = time * settings.cameraSpeedMult;
    visualizerMesh.rotation.x = rTime * 0.09 + displayBass * 0.35 + beat.beatRotation + beat.extraRotation;
    visualizerMesh.rotation.y = rTime * 0.13 + displayMid * 0.28 + beat.beatRotation * 1.25 + beat.extraRotation * 1.15;
    visualizerMesh.rotation.z = Math.sin(rTime * 0.07) * displayMid * 0.15 + beat.offbeatPulse * 0.08;
    wireMesh.rotation.x = rTime * 0.1 + displayBass * 0.32 + beat.beatRotation * 1.08;
    wireMesh.rotation.y = rTime * 0.12 + displayMid * 0.25 + beat.beatRotation * 1.35;

    particles.rotation.y = rTime * 0.035 + beat.beatRotation * 0.6;
    particles.rotation.x = Math.sin(rTime * 0.05) * displayBass * 0.2;
    const pScale = 1.0 + displayBass * 1.55 + smoothEnergy * 0.35 + beat.beatPulse * 0.25;
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

    const targetFov = 70 + displayBass * 11 + beat.beatPulse * 32 + beat.currentBeat * 38;
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.15);
    camera.updateProjectionMatrix();

    if (displayBass > 0.55) {
      const shake = (displayBass - 0.55) * (1.2 + beat.currentBeat);
      camera.position.x = (Math.random() - 0.5) * shake;
      camera.position.y = (Math.random() - 0.5) * shake;
    } else {
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, 0.1);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0, 0.1);
    }

    bloomPass.strength = settings.glowStrength + displayBass * 0.16 * (settings.glowStrength / 0.3) + smoothEnergy * 0.06;

    const targetShift = smoothTreble * 0.002 + (beat.trebleDelta > 0.03 ? beat.trebleDelta * 0.15 : 0);
    rgbShiftPass.uniforms.amount.value = THREE.MathUtils.lerp(
      rgbShiftPass.uniforms.amount.value, targetShift, 0.35
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

  return { applyPreset, start, onResize };
}
