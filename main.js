import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';

// ==========================================
// 1. AUDIO & APP STATE
// ==========================================
// Settings State
let isStrobeEnabled = true;
let isBlackAndWhite = true;
let flashDecay = 0.88;
let bassSensMult = 1.0;
let glowStrength = 0.1;
let cameraSpeedMult = 1.0;

// Performance Presets
const isMobile = /Android|iPhone|iPad|iPod|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
let currentPreset = 'high';

const PRESETS = {
  low:   { pixelRatio: 1.0,  geoDetail: 16, particles: 500,  bloom: false, wireframe: false, rgbShift: false },
  mid:   { pixelRatio: Math.min(window.devicePixelRatio, 1.5), geoDetail: 32, particles: 1200, bloom: true,  wireframe: true,  rgbShift: true },
  high:  { pixelRatio: Math.min(window.devicePixelRatio, 2),   geoDetail: 48, particles: 2000, bloom: true,  wireframe: true,  rgbShift: true },
  ultra: { pixelRatio: window.devicePixelRatio,                geoDetail: 64, particles: 4000, bloom: true,  wireframe: true,  rgbShift: true }
};

const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
let analyser;
let source;
let dataArray;

let isPlaying = false;
let currentTrackIndex = -1;
let tracks = [];
const audioElement = new Audio();
audioElement.addEventListener('error', (e) => {
  console.error("Audio playback error:", e);
  alert("Error al cargar la canción.");
  isPlaying = false;
  btnPlay.innerHTML = playIcon;
});

// UI Elements
const uiContainer = document.getElementById('ui-container');
const btnPlay = document.getElementById('btn-play');
const btnNext = document.getElementById('btn-next');
const btnPrev = document.getElementById('btn-prev');
const trackNameEl = document.getElementById('track-name');
const uploadInput = document.getElementById('audio-upload');
const playlistEl = document.getElementById('playlist');
const progressBar = document.getElementById('progress-bar');
const currentTimeEl = document.getElementById('current-time');
const totalTimeEl = document.getElementById('total-time');

// New UI Elements
const btnFullscreen = document.getElementById('btn-fullscreen');
const mobilePlaylistBtn = document.getElementById('mobile-playlist-btn');
const mobileSettingsBtn = document.getElementById('mobile-settings-btn');
const closePlaylistBtn = document.getElementById('close-playlist-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const sidebar = document.getElementById('sidebar');
const settingsSidebar = document.getElementById('settings-sidebar');

// Settings DOM
const toggleBwMode = document.getElementById('toggle-bw-mode');
const sliderFlash = document.getElementById('slider-flash');
const sliderBass = document.getElementById('slider-bass');
const sliderGlow = document.getElementById('slider-glow');
const sliderCam = document.getElementById('slider-cam');
const valFlash = document.getElementById('val-flash');
sliderFlash.addEventListener('input', (e) => {
  flashDecay = parseFloat(e.target.value);
  valFlash.textContent = flashDecay.toFixed(2);
});

const sliderBass = document.getElementById('slider-bass');
const valBass = document.getElementById('val-bass');
sliderBass.addEventListener('input', (e) => {
  bassSensMult = parseFloat(e.target.value);
  valBass.textContent = bassSensMult.toFixed(1);
});

const sliderGlow = document.getElementById('slider-glow');
const valGlow = document.getElementById('val-glow');
sliderGlow.addEventListener('input', (e) => {
  glowStrength = parseFloat(e.target.value);
  valGlow.textContent = glowStrength.toFixed(2);
});

const sliderCam = document.getElementById('slider-cam');
const valCam = document.getElementById('val-cam');
sliderCam.addEventListener('input', (e) => {
  cameraSpeedMult = parseFloat(e.target.value);
  valCam.textContent = cameraSpeedMult.toFixed(1);
});

document.getElementById('btn-reset-settings').addEventListener('click', () => {
  isStrobeEnabled = true; toggleStrobe.checked = true;
  isBlackAndWhite = true; toggleBw.checked = true;
  flashDecay = 0.88; sliderFlash.value = 0.88; valFlash.textContent = "0.88";
  bassSensMult = 1.0; sliderBass.value = 1.0; valBass.textContent = "1.0";
  glowStrength = 0.1; sliderGlow.value = 0.1; valGlow.textContent = "0.10";
  cameraSpeedMult = 1.0; sliderCam.value = 1.0; valCam.textContent = "1.0";
  applyPreset('high');
});;

// --- Quality Preset Logic ---
const presetBtns = {
  low: document.getElementById('preset-low'),
  mid: document.getElementById('preset-mid'),
  high: document.getElementById('preset-high'),
  ultra: document.getElementById('preset-ultra')
};

function applyPreset(name) {
  currentPreset = name;
  const p = PRESETS[name];

  // Pixel ratio
  renderer.setPixelRatio(p.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);

  // Geometry detail
  const newGeo = new THREE.IcosahedronGeometry(3, p.geoDetail);
  visualizerMesh.geometry.dispose();
  visualizerMesh.geometry = newGeo;
  wireMesh.geometry.dispose();
  wireMesh.geometry = newGeo;

  // Particles
  rebuildParticles(p.particles);

  // Wireframe visibility
  wireMesh.visible = p.wireframe;

  // Post-processing toggles
  bloomPass.enabled = p.bloom;
  rgbShiftPass.enabled = p.rgbShift;

  // Update button UI
  Object.entries(presetBtns).forEach(([key, btn]) => {
    btn.classList.toggle('active', key === name);
  });
}

Object.entries(presetBtns).forEach(([key, btn]) => {
  btn.addEventListener('click', () => applyPreset(key));
});

const playIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
const pauseIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';

// ==========================================
// 2. UI IDLE HIDING LOGIC
// ==========================================
let idleTimeout;
const resetIdleTimer = () => {
  uiContainer.classList.remove('hidden');
  clearTimeout(idleTimeout);
  idleTimeout = setTimeout(() => {
    if (isPlaying) uiContainer.classList.add('hidden');
  }, 3000);
};
['mousemove', 'mousedown', 'keydown', 'touchstart'].forEach(evt => {
  document.addEventListener(evt, resetIdleTimer);
});
resetIdleTimer();

// ==========================================
// 2.5 UI ACTIONS & MOBILE SIDEBARS
// ==========================================
btnFullscreen.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.log(`Error attempting to enable fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
});

mobilePlaylistBtn.addEventListener('click', () => {
  sidebar.classList.add('open');
  mobilePlaylistBtn.style.display = 'none';
});
mobileSettingsBtn.addEventListener('click', () => {
  settingsSidebar.classList.add('open');
  mobileSettingsBtn.style.display = 'none';
});
function closePlaylist(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  sidebar.classList.remove('open');
  mobilePlaylistBtn.style.display = '';
}

function closeSettings(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  settingsSidebar.classList.remove('open');
  mobileSettingsBtn.style.display = '';
}

closePlaylistBtn.addEventListener('click', closePlaylist);
closePlaylistBtn.addEventListener('touchstart', closePlaylist, {passive: false});

closeSettingsBtn.addEventListener('click', closeSettings);
closeSettingsBtn.addEventListener('touchstart', closeSettings, {passive: false});

document.getElementById('canvas-container').addEventListener('click', () => {
  sidebar.classList.remove('open');
  settingsSidebar.classList.remove('open');
  mobilePlaylistBtn.style.display = '';
  mobileSettingsBtn.style.display = '';
});

// ==========================================
// 3. AUDIO LOGIC & CONTROLS
// ==========================================
function initAudio() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    // Lowered smoothing for "Zero Latency Attack". The visualizer will handle decay manually.
    analyser.smoothingTimeConstant = 0.4;
    source = audioCtx.createMediaElementSource(audioElement);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function loadTrack(index) {
  if (index < 0 || index >= tracks.length) return;
  currentTrackIndex = index;
  const file = tracks[index];
  audioElement.src = URL.createObjectURL(file);
  audioElement.load();
  audioElement.play();
  isPlaying = true;
  btnPlay.innerHTML = pauseIcon;
  trackNameEl.textContent = file.name.replace(/\.[^/.]+$/, "");
  updatePlaylistUI();
}

function togglePlay() {
  if (tracks.length === 0) { uploadInput.click(); return; }
  initAudio();
  if (isPlaying) {
    audioElement.pause(); isPlaying = false;
    btnPlay.innerHTML = playIcon; resetIdleTimer();
  } else {
    audioElement.play(); isPlaying = true;
    btnPlay.innerHTML = pauseIcon; resetIdleTimer();
  }
}

btnPlay.addEventListener('click', togglePlay);
btnNext.addEventListener('click', () => { if (tracks.length > 0) loadTrack((currentTrackIndex + 1) % tracks.length); });
btnPrev.addEventListener('click', () => { if (tracks.length > 0) loadTrack((currentTrackIndex - 1 + tracks.length) % tracks.length); });
audioElement.addEventListener('ended', () => { if (tracks.length > 0) loadTrack((currentTrackIndex + 1) % tracks.length); });

uploadInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;
  
  // Duplicate detection
  const existingNames = tracks.map(t => t.name);
  const duplicates = files.filter(f => existingNames.includes(f.name));
  const newFiles = files.filter(f => !existingNames.includes(f.name));
  
  if (duplicates.length > 0) {
    const dupeNames = duplicates.map(f => f.name.replace(/\.[^/.]+$/, '')).join(', ');
    const addAnyway = confirm(`⚠️ Estas canciones ya están en la playlist:\n\n${dupeNames}\n\n¿Quieres duplicarlas?`);
    if (addAnyway) {
      newFiles.push(...duplicates);
    }
  }
  
  if (newFiles.length === 0) { uploadInput.value = ''; return; }
  if (tracks.length === 0) playlistEl.innerHTML = '';
  tracks.push(...newFiles);
  renderPlaylist();
  if (currentTrackIndex === -1) { initAudio(); loadTrack(0); }
  uploadInput.value = ''; // Reset so same file can be selected again
});

// --- PROGRESS BAR LOGIC ---
function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

audioElement.addEventListener('loadedmetadata', () => {
  totalTimeEl.textContent = formatTime(audioElement.duration);
  progressBar.max = audioElement.duration;
});

let isSeeking = false;
audioElement.addEventListener('timeupdate', () => {
  if (!isSeeking) {
    progressBar.value = audioElement.currentTime;
    currentTimeEl.textContent = formatTime(audioElement.currentTime);
  }
});

progressBar.addEventListener('input', () => {
  isSeeking = true;
  currentTimeEl.textContent = formatTime(progressBar.value);
});

progressBar.addEventListener('change', () => {
  audioElement.currentTime = progressBar.value;
  isSeeking = false;
});

// Playlist specific DOM
const trackCountEl = document.getElementById('track-count');
const btnShuffle = document.getElementById('btn-shuffle');
const btnClearPlaylist = document.getElementById('btn-clear-playlist');

btnShuffle.addEventListener('click', shufflePlaylist);
btnClearPlaylist.addEventListener('click', clearPlaylist);

// Drag reorder state
let dragFromIndex = null;

function renderPlaylist() {
  playlistEl.innerHTML = '';
  if (tracks.length === 0) {
    playlistEl.innerHTML = '<li class="empty-state">Playlist empty</li>';
    trackCountEl.textContent = '0 tracks';
    return;
  }
  trackCountEl.textContent = `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`;
  
  tracks.forEach((file, index) => {
    const li = document.createElement('li');
    li.draggable = true;
    
    // Track number
    const numSpan = document.createElement('span');
    numSpan.className = 'track-number';
    numSpan.textContent = `${index + 1}`;
    li.appendChild(numSpan);
    
    // Track name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'track-name-text';
    nameSpan.textContent = file.name.replace(/\.[^/.]+$/, '');
    li.appendChild(nameSpan);
    
    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'track-delete-btn';
    delBtn.innerHTML = '&times;';
    delBtn.title = 'Eliminar';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeTrack(index);
    });
    li.appendChild(delBtn);
    
    // Click to play
    li.addEventListener('click', () => { initAudio(); loadTrack(index); });
    if (index === currentTrackIndex) li.classList.add('active');
    
    // Drag events for reordering
    li.addEventListener('dragstart', (e) => {
      dragFromIndex = index;
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      dragFromIndex = null;
    });
    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      li.classList.add('drag-over');
    });
    li.addEventListener('dragleave', () => {
      li.classList.remove('drag-over');
    });
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      li.classList.remove('drag-over');
      if (dragFromIndex !== null && dragFromIndex !== index) {
        reorderTrack(dragFromIndex, index);
      }
    });
    
    playlistEl.appendChild(li);
  });
}

function removeTrack(index) {
  // If deleting the currently playing track, stop or skip
  if (index === currentTrackIndex) {
    audioElement.pause();
    isPlaying = false;
    btnPlay.innerHTML = playIcon;
    if (tracks.length > 1) {
      tracks.splice(index, 1);
      currentTrackIndex = index >= tracks.length ? 0 : index;
      renderPlaylist();
      loadTrack(currentTrackIndex);
      return;
    } else {
      tracks.splice(index, 1);
      currentTrackIndex = -1;
      trackNameEl.textContent = 'No track';
      renderPlaylist();
      return;
    }
  }
  // Adjust currentTrackIndex if needed
  if (index < currentTrackIndex) currentTrackIndex--;
  tracks.splice(index, 1);
  renderPlaylist();
}

function reorderTrack(from, to) {
  const [movedTrack] = tracks.splice(from, 1);
  tracks.splice(to, 0, movedTrack);
  // Update currentTrackIndex to follow the playing track
  if (currentTrackIndex === from) {
    currentTrackIndex = to;
  } else if (from < currentTrackIndex && to >= currentTrackIndex) {
    currentTrackIndex--;
  } else if (from > currentTrackIndex && to <= currentTrackIndex) {
    currentTrackIndex++;
  }
  renderPlaylist();
}

function shufflePlaylist() {
  // Fisher-Yates shuffle, keep the current track at position 0
  const currentFile = tracks[currentTrackIndex];
  for (let i = tracks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
  }
  currentTrackIndex = tracks.indexOf(currentFile);
  renderPlaylist();
}

function clearPlaylist() {
  if (tracks.length === 0) return;
  if (!confirm('¿Limpiar toda la playlist?')) return;
  audioElement.pause();
  audioElement.src = '';
  isPlaying = false;
  btnPlay.innerHTML = playIcon;
  tracks = [];
  currentTrackIndex = -1;
  trackNameEl.textContent = 'No track';
  renderPlaylist();
}

function updatePlaylistUI() {
  playlistEl.querySelectorAll('li').forEach((item, index) => {
    item.classList.toggle('active', index === currentTrackIndex);
  });
}

// ==========================================
// 4. THREE.JS SETUP
// ==========================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 20;

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(PRESETS[currentPreset].pixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
container.appendChild(renderer.domElement);

// --- Post-Processing ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.3,   // strength - VERY low base
  0.6,   // radius
  0.9    // threshold - only bright things glow
);
composer.addPass(bloomPass);

const rgbShiftPass = new ShaderPass(RGBShiftShader);
rgbShiftPass.uniforms['amount'].value = 0.0;
composer.addPass(rgbShiftPass);

// --- Simplex Noise ---
const noiseChunk = `
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

// --- Visualizer Geometry ---
let geometry = new THREE.IcosahedronGeometry(3, PRESETS[currentPreset].geoDetail);

const vertexShader = `
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uEnergy;
uniform float uBeat;

varying vec3 vNormal;
varying float vDisplacement;
varying vec3 vPosition;

${noiseChunk}

void main() {
  vNormal = normal;
  
  // 1. Base Low-Frequency Breathing (Fluidity)
  float baseNoise = snoise(position * 0.25 + uTime * 0.1);
  float breath = baseNoise * (0.1 + uMid * 0.3);
  
  // 2. Directional Stretching & Squishing (Beat Impact)
  // More fluid, less spiky. Uses a smoother curve for bass impact.
  float stretchIntensity = smoothstep(0.4, 0.9, uBass) * (0.3 + uBeat * 0.6);
  vec3 stretchPos = position;
  stretchPos.y *= 1.0 + stretchIntensity * 0.8;
  stretchPos.x *= 1.0 - stretchIntensity * 0.15;
  stretchPos.z *= 1.0 - stretchIntensity * 0.15;
  
  // 3. Mid-Frequency Warping (Torsion/Twist)
  // Smoother warp that feels like water
  float warpNoise = snoise(stretchPos * 0.6 - uTime * 0.3);
  float warp = warpNoise * (uEnergy * 0.4) * (1.0 + uBeat * 0.3);
  
  // 4. High-Frequency Ripples (Treble Detail)
  // Significantly reduced so it doesn't look like ugly thorns on drops
  float trebleRipples = snoise(position * 1.5 + uTime * 2.0) * uTreble * 0.15;
  
  // Combine all deformations (clamped to prevent extreme breaking of geometry)
  float totalDisp = breath + warp + trebleRipples;
  totalDisp = clamp(totalDisp, -0.6, 0.8);
  
  // 5. Global Scale (Volume/Bass Impact)
  float globalScale = 1.0 + stretchIntensity * 0.1 + (uEnergy * 0.05);
  
  vDisplacement = totalDisp;
  vPosition = position;
  
  // Apply global scale to base position, then add normal displacement
  vec3 newPosition = position * globalScale + normal * totalDisp;
  
  // Apply extra non-uniform scaling on the final vertex for the stretch effect
  newPosition.y *= 1.0 + stretchIntensity * 0.3;
  newPosition.x *= 1.0 - stretchIntensity * 0.1;
  newPosition.z *= 1.0 - stretchIntensity * 0.1;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

const fragmentShader = `
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uEnergy;
uniform float uOpacity;
uniform float uBeat;

varying vec3 vNormal;
varying float vDisplacement;
varying vec3 vPosition;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  // Hue cycles over time and jumps on beats
  float hue = fract(uTime * 0.04 + vDisplacement * 0.08 + uBeat * 0.15);
  
  // High saturation always for vivid colors
  float saturation = 0.85;
  
  // Brightness: dark base, brightens with energy but NEVER goes white
  // Max value ~0.55 so bloom doesn't blow it out (Reduced brightness)
  float value = 0.12 + uBass * 0.2 + vDisplacement * 0.04;
  value = clamp(value, 0.05, 0.55);
  
  vec3 color = hsv2rgb(vec3(hue, saturation, value));
  
  // Subtle rim lighting
  float rim = 1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
  rim = smoothstep(0.65, 1.0, rim);
  color += color * rim * 0.4;
  
  gl_FragColor = vec4(color, uOpacity);
}
`;

const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    uTime: { value: 0 },
    uBass: { value: 0 },
    uMid: { value: 0 },
    uTreble: { value: 0 },
    uEnergy: { value: 0 },
    uOpacity: { value: 1.0 },
    uBeat: { value: 0 }
  },
  transparent: true
});

const visualizerMesh = new THREE.Mesh(geometry, material);
scene.add(visualizerMesh);

// --- Addictive Wireframe Ghost ---
// A secondary shell that reacts heavily to treble
const wireMaterial = material.clone();
wireMaterial.wireframe = true;
wireMaterial.uniforms.uOpacity.value = 0.15; // Semi-transparent
const wireMesh = new THREE.Mesh(geometry, wireMaterial);
scene.add(wireMesh);

// --- Background Particles ---
let particleCount = PRESETS[currentPreset].particles;
let particleGeom = new THREE.BufferGeometry();
let particlePos = new Float32Array(particleCount * 3);
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

function rebuildParticles(count) {
  scene.remove(particles);
  particleGeom.dispose();
  particleCount = count;
  particleGeom = new THREE.BufferGeometry();
  particlePos = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount * 3; i++) {
    particlePos[i] = (Math.random() - 0.5) * 120;
  }
  particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
  particles = new THREE.Points(particleGeom, particleMat);
  scene.add(particles);
}

// --- Background flash plane (fullscreen quad behind everything) ---
const bgPlaneGeom = new THREE.PlaneGeometry(1000, 1000);
const bgPlaneMat = new THREE.MeshBasicMaterial({
  color: 0x000000, transparent: true, opacity: 0
});
const bgPlane = new THREE.Mesh(bgPlaneGeom, bgPlaneMat);
bgPlane.position.z = -50;
scene.add(bgPlane);

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// Apply initial preset (after all objects are created)
applyPreset(currentPreset);

// ==========================================
// 5. ANIMATION & AUDIO ANALYSIS
// ==========================================
const clock = new THREE.Clock();

let smoothBass = 0, smoothMid = 0, smoothTreble = 0;
let bgFlashOpacity = 0;
let bgFlashHue = 0;

// Palette of techno-appropriate colors (neon cyans, magentas, electric blues, acid greens)
const strobeColors = [
  new THREE.Color(0xffffff), // White flash (for pure energy)
  new THREE.Color(0xffffff), // Add it twice to make it slightly more common
  new THREE.Color(0xff0055), // Hot pink
  new THREE.Color(0x00ffcc), // Cyan
  new THREE.Color(0x8800ff), // Purple
  new THREE.Color(0x00aaff), // Electric blue
  new THREE.Color(0xff6600), // Orange
  new THREE.Color(0xaaff00), // Acid green
  new THREE.Color(0xff00ff), // Magenta
  new THREE.Color(0x00ff66), // Green
];
let lastStrobeColor = 0;
let prevBass = 0; // For precise delta beat detection
let prevTreble = 0; // For snare/clap detection (glitch)
let currentBeat = 0; // Fast decaying beat pulse
let extraRotation = 0; // For mechanical spin
let historyBass = 0; // Moving average of bass for adaptive detection
let lastBeatTime = 0; // Cooldown timer for beat detection

function getAvg(arr, start, end) {
  let sum = 0;
  for (let i = start; i < end; i++) sum += arr[i];
  return (sum / (end - start)) / 255.0; // Normalize to 0-1
}

function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();

  let bass = 0, mid = 0, treble = 0;

  if (analyser && isPlaying) {
    analyser.getByteFrequencyData(dataArray);
    // Bins are ~86Hz each. 0-3 covers 0-250Hz (Pure Sub/Kick)
    bass = getAvg(dataArray, 0, 3) * bassSensMult;
    // 4-40 covers 250Hz to 3.4kHz (Synths, Vocals, Snares)
    mid = getAvg(dataArray, 4, 40) * bassSensMult;
    // 40-128 covers 3.4kHz to 11kHz (Hi-hats, Air)
    treble = getAvg(dataArray, 40, 128) * bassSensMult;
  }

  // Smooth values
  smoothBass = THREE.MathUtils.lerp(smoothBass, bass, 0.18);
  smoothMid = THREE.MathUtils.lerp(smoothMid, mid, 0.12);
  smoothTreble = THREE.MathUtils.lerp(smoothTreble, treble, 0.14);

  const energy = (smoothBass + smoothMid + smoothTreble) / 3;

  // --- FOOLPROOF PEAK-DECAY BEAT DETECTION ---
  // The threshold slowly falls. When bass breaks the threshold, it triggers a beat
  // and pushes the threshold up, preventing double-triggers on the tail.
  let isBeat = false;
  if (bass > historyBass && bass > 0.45 && (time - lastBeatTime > 0.12)) {
      isBeat = true;
      historyBass = bass + 0.08; // Jump threshold up (adapt to volume)
      if (historyBass > 1.0) historyBass = 1.0;
  }
  
  // Decay the threshold continuously down to a minimum floor
  historyBass = Math.max(0.4, historyBass - 0.015);

  if (isBeat) {
      lastBeatTime = time;
      currentBeat = 1.0; // Trigger the visual spike pulse
      extraRotation += bass * 1.5; // Trigger mechanical spin
      
      // Trigger Background Strobe
      const flashIntensity = THREE.MathUtils.clamp(bass * 2.0, 0.5, 0.95);
      bgFlashOpacity = Math.max(bgFlashOpacity, flashIntensity);
      lastStrobeColor = Math.floor(Math.random() * strobeColors.length);
  }

  // Faster decay for the visual beat pulse so it retracts quickly between kicks
  currentBeat = THREE.MathUtils.lerp(currentBeat, 0.0, 0.15);

  // --- Treble Delta for Snares/Claps (Glitch Effect) ---
  const trebleDelta = treble - prevTreble;
  prevTreble = treble;

  // --- Update Shader ---
  material.uniforms.uTime.value = time;
  material.uniforms.uBass.value = smoothBass;
  material.uniforms.uMid.value = smoothMid;
  material.uniforms.uTreble.value = smoothTreble;
  material.uniforms.uEnergy.value = energy;
  material.uniforms.uBeat.value = currentBeat;
  
  wireMaterial.uniforms.uTime.value = time;
  wireMaterial.uniforms.uBass.value = smoothBass;
  wireMaterial.uniforms.uMid.value = smoothMid;
  wireMaterial.uniforms.uTreble.value = smoothTreble;
  wireMaterial.uniforms.uEnergy.value = energy;
  wireMaterial.uniforms.uBeat.value = currentBeat;
  
  // The wireframe ghost becomes more visible when treble is high (snares/claps)
  wireMaterial.uniforms.uOpacity.value = 0.05 + (smoothTreble * 0.35);

  // --- Dynamic Mesh Scaling (Grows/Shrinks with Rhythm) ---
  // Base scale + bass boost + instant punch from currentBeat
  const targetScale = 1.0 + (smoothBass * 0.4) + (currentBeat * 0.4);
  const currentScale = visualizerMesh.scale.x;
  // Fast attack, smooth decay
  const newScale = THREE.MathUtils.lerp(currentScale, targetScale, currentBeat > 0.5 ? 0.5 : 0.15);
  visualizerMesh.scale.setScalar(newScale);
  
  // Wireframe scales slightly larger and reacts more to treble
  const wireScale = newScale * (1.02 + smoothTreble * 0.15);
  wireMesh.scale.setScalar(wireScale);

  // --- Object Rotation (Mechanical Spin) ---
  // Slowly rotates naturally, but jerks forward violently on heavy beats
  const rTime = time * cameraSpeedMult;
  visualizerMesh.rotation.x = rTime * 0.08 + smoothBass * 0.3 + extraRotation;
  visualizerMesh.rotation.y = rTime * 0.12 + smoothMid * 0.2 + extraRotation * 1.2;
  
  wireMesh.rotation.x = rTime * 0.09 + smoothBass * 0.3 + extraRotation * 1.1; 
  wireMesh.rotation.y = rTime * 0.11 + smoothMid * 0.2 + extraRotation * 1.3;

  // --- Particles ---
  particles.rotation.y = rTime * 0.03;
  const pScale = 1.0 + smoothBass * 1.5;
  particles.scale.set(pScale, pScale, pScale);

  // --- BACKGROUND STROBE DECAY & APPLY ---
  if (isStrobeEnabled) {
    if (isBlackAndWhite) {
      bgPlaneMat.color.setHex(0xffffff);
    } else {
      bgPlaneMat.color.copy(strobeColors[lastStrobeColor]);
    }
    bgPlaneMat.opacity = bgFlashOpacity;
  } else {
    bgPlaneMat.opacity = 0;
  }
  
  bgFlashOpacity *= flashDecay; // Decay based on slider (0.75 fast - 0.99 slow)
  if (bgFlashOpacity < 0.01) bgFlashOpacity = 0;

  // Also tint the scene background slightly
  const bgColor = new THREE.Color(0x000000);
  if (bgFlashOpacity > 0.05 && isStrobeEnabled) {
    if (isBlackAndWhite) {
      bgColor.setHex(0xffffff).multiplyScalar(bgFlashOpacity * 0.3);
    } else {
      bgColor.copy(strobeColors[lastStrobeColor]).multiplyScalar(bgFlashOpacity * 0.3);
    }
  }
  scene.background = bgColor;

  // --- Camera PUMPING & Shake ---
  // The Field of View (FOV) expands on bass hits to create a "pumping" sensation
  const targetFov = 70 + (smoothBass * 10) + (currentBeat * 40);
  camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.15);
  camera.updateProjectionMatrix();

  // Subtle shake only on very strong hits
  if (smoothBass > 0.7) {
    const shake = (smoothBass - 0.7) * 1.5;
    camera.position.x = (Math.random() - 0.5) * shake;
    camera.position.y = (Math.random() - 0.5) * shake;
  } else {
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, 0.1);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0, 0.1);
  }

  // --- Post Processing ---
  // Bloom: controlled by slider + reduced bass boost to prevent blinding flashes
  bloomPass.strength = glowStrength + smoothBass * 0.15 * (glowStrength / 0.3);

  // RGB shift: EXTREME glitch effect ONLY on sharp treble hits (claps/snares)
  const targetShift = (smoothTreble * 0.002) + (trebleDelta > 0.03 ? trebleDelta * 0.15 : 0.0);
  rgbShiftPass.uniforms['amount'].value = THREE.MathUtils.lerp(
    rgbShiftPass.uniforms['amount'].value, targetShift, 0.35
  );

  composer.render();
}

animate();
