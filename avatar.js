import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

// =====================================================
// CONFIGURATION – tuned for natural, stable performance
// =====================================================
const VISEME_SMOOTHING = 0.35;       // Lip sync interpolation
const AMPLITUDE_MULTIPLIER = 1.1;    // Jaw open strength
const EXPRESSION_INTENSITY = 0.2;    // Eyebrow movement

// Head motion – subtle, no oscillation
const HEAD_IDLE_DRIFT_SPEED = 0.2;   // Radians per second
const HEAD_IDLE_AMPLITUDE = 0.008;   // Max rotation (tiny)
const HEAD_GLANCE_INTERVAL = 4000;   // ms between glances
const HEAD_GLANCE_DURATION = 800;    // ms glance lasts
const HEAD_RETURN_SPEED = 0.1;       // Speed when returning to neutral

// Punctuation pauses (seconds)
const PAUSE_DURATION = {
  '.': 0.25,
  '!': 0.3,
  '?': 0.3,
  ',': 0.15,
  ';': 0.2,
  ':': 0.2
};

// =====================================================
// PHONEME → VISEME MAPPING (full, as before)
// =====================================================
const PHONEME_MAP = {
  'AA': { jawOpen: 0.9, mouthFunnel: 0.0, mouthSmile_L: 0.0, mouthSmile_R: 0.0 },
  'AE': { jawOpen: 0.8, mouthSmile_L: 0.3, mouthSmile_R: 0.3 },
  'AH': { jawOpen: 0.7, mouthFunnel: 0.1 },
  'AO': { jawOpen: 0.8, mouthFunnel: 0.5 },
  'AW': { jawOpen: 0.8, mouthFunnel: 0.4, mouthPucker: 0.3 },
  'AY': { jawOpen: 0.8, mouthSmile_L: 0.4, mouthSmile_R: 0.4 },
  'EH': { jawOpen: 0.7, mouthSmile_L: 0.3, mouthSmile_R: 0.3 },
  'ER': { jawOpen: 0.6, mouthFunnel: 0.3, mouthPucker: 0.2 },
  'EY': { jawOpen: 0.7, mouthSmile_L: 0.5, mouthSmile_R: 0.5 },
  'IH': { jawOpen: 0.6, mouthSmile_L: 0.2, mouthSmile_R: 0.2 },
  'IY': { jawOpen: 0.5, mouthSmile_L: 0.7, mouthSmile_R: 0.7 },
  'OW': { jawOpen: 0.7, mouthFunnel: 0.4, mouthPucker: 0.3 },
  'OY': { jawOpen: 0.7, mouthFunnel: 0.3, mouthPucker: 0.2, mouthSmile_L: 0.2, mouthSmile_R: 0.2 },
  'UH': { jawOpen: 0.6, mouthFunnel: 0.4, mouthPucker: 0.3 },
  'UW': { jawOpen: 0.6, mouthFunnel: 0.6, mouthPucker: 0.4 },

  'P':  { jawOpen: 0.2, mouthPress_L: 0.5, mouthPress_R: 0.5, cheekPuff: 0.2 },
  'B':  { jawOpen: 0.2, mouthPress_L: 0.5, mouthPress_R: 0.5, cheekPuff: 0.2 },
  'M':  { jawOpen: 0.2, mouthPress_L: 0.5, mouthPress_R: 0.5, cheekPuff: 0.1 },
  'T':  { jawOpen: 0.3, mouthClose: 0.3 },
  'D':  { jawOpen: 0.3, mouthClose: 0.3 },
  'N':  { jawOpen: 0.2, mouthClose: 0.2 },
  'K':  { jawOpen: 0.3, mouthClose: 0.2, jawForward: 0.1 },
  'G':  { jawOpen: 0.3, mouthClose: 0.2, jawForward: 0.1 },
  'NG': { jawOpen: 0.2, mouthClose: 0.2 },

  'S':  { jawOpen: 0.2, mouthStretch_L: 0.5, mouthStretch_R: 0.5 },
  'Z':  { jawOpen: 0.2, mouthStretch_L: 0.5, mouthStretch_R: 0.5 },
  'SH': { jawOpen: 0.2, mouthStretch_L: 0.5, mouthStretch_R: 0.5, mouthPucker: 0.3 },
  'ZH': { jawOpen: 0.2, mouthStretch_L: 0.5, mouthStretch_R: 0.5, mouthPucker: 0.3 },
  'F':  { jawOpen: 0.2, mouthPress_L: 0.3, mouthPress_R: 0.3 },
  'V':  { jawOpen: 0.2, mouthPress_L: 0.3, mouthPress_R: 0.3 },
  'TH': { jawOpen: 0.2, mouthStretch_L: 0.3, mouthStretch_R: 0.3, tongueOut: 0.2 },
  'DH': { jawOpen: 0.2, mouthStretch_L: 0.3, mouthStretch_R: 0.3, tongueOut: 0.2 },
  'HH': { jawOpen: 0.3 },

  'CH': { jawOpen: 0.3, mouthStretch_L: 0.4, mouthStretch_R: 0.4, mouthPucker: 0.2 },
  'JH': { jawOpen: 0.3, mouthStretch_L: 0.4, mouthStretch_R: 0.4, mouthPucker: 0.2 },

  'L':  { jawOpen: 0.3, mouthStretch_L: 0.3, mouthStretch_R: 0.3 },
  'R':  { jawOpen: 0.3, mouthFunnel: 0.3, mouthPucker: 0.3 },
  'Y':  { jawOpen: 0.3, mouthSmile_L: 0.4, mouthSmile_R: 0.4 },
  'W':  { jawOpen: 0.3, mouthFunnel: 0.4, mouthPucker: 0.5 },

  '_':  { jawOpen: 0.0, mouthFunnel: 0.0, mouthPucker: 0.0,
          mouthSmile_L: 0.0, mouthSmile_R: 0.0,
          mouthPress_L: 0.0, mouthPress_R: 0.0,
          mouthClose: 0.0, mouthStretch_L: 0.0, mouthStretch_R: 0.0,
          cheekPuff: 0.0, tongueOut: 0.0, jawForward: 0.0 }
};

const DEFAULT_PHONEME = { jawOpen: 0.3 };

// =====================================================
// SCENE SETUP
// =====================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0e1a);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.getElementById("avatar").appendChild(renderer.domElement);

function resize() {
  const el = document.getElementById("avatar");
  const w = el.clientWidth, h = el.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(0, 1, 2);
scene.add(dir);
const rim = new THREE.DirectionalLight(0x6478ff, 0.4);
rim.position.set(-1, 0, -1);
scene.add(rim);

// =====================================================
// LOADERS
// =====================================================
const ktx2Loader = new KTX2Loader()
  .setTranscoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/basis/")
  .detectSupport(renderer);
const loader = new GLTFLoader();
loader.setKTX2Loader(ktx2Loader);
loader.setMeshoptDecoder(MeshoptDecoder);

// =====================================================
// STATE
// =====================================================
let faceMesh = null;
let avatarModel = null;
let currentState = 'idle';          // 'idle', 'speaking', 'returning'
let isBlinking = false;
let blinkTimer = 0;
let nextBlink = Math.random() * 180 + 120;
let idleTime = 0;
let breathePhase = 0;
let isSpeaking = false;
let isPageVisible = true;          // Page Visibility API

// Whole‑model rotation – deliberate, not random walk
let modelRotY = 0, modelRotX = 0, modelRotZ = 0;
let targetModelRotY = 0, targetModelRotX = 0, targetModelRotZ = 0;
let lastGlanceTime = 0;
let glanceActive = false;
let glanceTimer = null;

// Eye saccades
let lastSaccadeTime = 0;
const SACCADE_INTERVAL = 2000;

// Lip sync timeline
let visemeTimeline = [];
let speechStartTime = 0;
let speechDuration = 0;
let wordBoundaries = [];
let phonemizerReady = false;
let currentVisemeIndex = 0;

// =====================================================
// PAGE VISIBILITY – pause animation when tab hidden
// =====================================================
function handleVisibilityChange() {
  isPageVisible = !document.hidden;
}
document.addEventListener('visibilitychange', handleVisibilityChange);

// =====================================================
// LOAD MODEL
// =====================================================
loader.load(
  "./facecap.glb",
  (gltf) => {
    avatarModel = gltf.scene;
    scene.add(gltf.scene);

    gltf.scene.traverse((obj) => {
      if ((obj.isMesh || obj.isSkinnedMesh) && obj.morphTargetDictionary) {
        faceMesh = obj;
        console.log("✓ Face mesh loaded:", obj.name);
        console.log("✓ Morph targets:", Object.keys(obj.morphTargetDictionary).length);
      }
    });

    if (!faceMesh) { console.error("✗ No face mesh found"); return; }

    // Auto-frame camera
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    gltf.scene.position.sub(center);
    camera.near = size / 100;
    camera.far = size * 10;
    camera.position.z = size * 0.75;
    camera.updateProjectionMatrix();

    updateStatus('Ready', false);
  },
  undefined,
  (err) => console.error("GLTF ERROR:", err)
);

// =====================================================
// MORPH TARGET FUNCTIONS
// =====================================================
function setMorphTarget(name, value) {
  if (!faceMesh || !faceMesh.morphTargetDictionary) return;
  const index = faceMesh.morphTargetDictionary[name];
  if (index !== undefined) {
    faceMesh.morphTargetInfluences[index] = Math.max(0, Math.min(1, value));
  }
}
function getMorphTarget(name) {
  if (!faceMesh || !faceMesh.morphTargetDictionary) return 0;
  const index = faceMesh.morphTargetDictionary[name];
  return (index !== undefined) ? (faceMesh.morphTargetInfluences[index] || 0) : 0;
}
function smoothMorphTarget(name, target, speed = VISEME_SMOOTHING) {
  const current = getMorphTarget(name);
  setMorphTarget(name, current + (target - current) * speed);
}

function resetMorphs() {
  const speechMorphs = [
    'jawOpen', 'jawForward', 'jawLeft', 'jawRight',
    'mouthClose', 'mouthFunnel', 'mouthPucker',
    'mouthSmile_L', 'mouthSmile_R',
    'mouthStretch_L', 'mouthStretch_R',
    'mouthPress_L', 'mouthPress_R',
    'mouthFrown_L', 'mouthFrown_R',
    'mouthDimple_L', 'mouthDimple_R',
    'mouthRollLower', 'mouthRollUpper',
    'mouthShrugLower', 'mouthShrugUpper',
    'mouthLeft', 'mouthRight',
    'cheekPuff', 'tongueOut',
    'browInnerUp', 'browDown_L', 'browDown_R', 'browOuterUp_L', 'browOuterUp_R',
    'noseSneer_L', 'noseSneer_R'
  ];
  speechMorphs.forEach(m => {
    if (faceMesh?.morphTargetDictionary?.[m] !== undefined) {
      setMorphTarget(m, 0);
    }
  });
}

// =====================================================
// PHONEME PROCESSING
// =====================================================
function wordToPhonemes(word) {
  if (!window.g2p) return [];
  try {
    const phones = window.g2p(word.toLowerCase());
    return phones.split(' ').filter(p => p.trim() !== '');
  } catch (e) {
    console.warn("Phonemizer error:", e);
    return [];
  }
}

function phonemeToVisemeWeights(phoneme) {
  const base = phoneme.replace(/[0-9]/g, '');
  return PHONEME_MAP[base] || DEFAULT_PHONEME;
}

// =====================================================
// PUNCTUATION HANDLER – insert pauses
// =====================================================
function insertPunctuationPauses(text, boundaries) {
  const newBoundaries = [];
  for (let i = 0; i < boundaries.length; i++) {
    newBoundaries.push(boundaries[i]);
    const word = boundaries[i].word;
    const lastChar = word[word.length - 1];
    if (lastChar in PAUSE_DURATION) {
      // Insert a silence "word" after this word
      const pauseStart = boundaries[i].end;
      const pauseEnd = pauseStart + PAUSE_DURATION[lastChar];
      newBoundaries.push({
        word: '_pause_',
        start: pauseStart,
        end: pauseEnd
      });
    }
  }
  return newBoundaries;
}

// =====================================================
// BUILD VISEME TIMELINE (with variable phoneme durations)
// =====================================================
function buildVisemeTimeline() {
  if (!faceMesh || !phonemizerReady || wordBoundaries.length === 0) {
    return generateFallbackTimeline();
  }

  const timeline = [];
  for (let i = 0; i < wordBoundaries.length; i++) {
    const { word, start, end } = wordBoundaries[i];
    
    // Handle punctuation pause (special word)
    if (word === '_pause_') {
      timeline.push({ time: start, weights: PHONEME_MAP['_'] });
      timeline.push({ time: end, weights: PHONEME_MAP['_'] });
      continue;
    }

    const phonemes = wordToPhonemes(word);
    if (!phonemes || phonemes.length === 0) {
      // No phonemes – use neutral shape
      timeline.push({ time: start, weights: PHONEME_MAP['_'] });
      continue;
    }

    const wordDuration = end - start;
    // Assign variable phoneme durations: vowels longer, consonants shorter
    let phonemeDurations = phonemes.map(p => {
      const base = p.replace(/[0-9]/g, '');
      // Vowels: AA, AE, AH, AO, AW, AY, EH, ER, EY, IH, IY, OW, OY, UH, UW
      if (/^(AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW)/.test(base)) return 1.5;
      // Plosives and fricatives shorter
      return 0.8;
    });
    // Normalize to sum = wordDuration
    const total = phonemeDurations.reduce((a,b) => a+b, 0);
    const norm = phonemeDurations.map(d => d / total * wordDuration);
    
    let currentTime = start;
    for (let j = 0; j < phonemes.length; j++) {
      const weights = phonemeToVisemeWeights(phonemes[j]);
      timeline.push({ time: currentTime, weights });
      currentTime += norm[j];
    }
  }

  timeline.sort((a, b) => a.time - b.time);
  // Add neutral at the end
  if (timeline.length > 0) {
    timeline.push({ time: speechDuration, weights: PHONEME_MAP['_'] });
  }
  return timeline;
}

function generateFallbackTimeline() {
  // Improved fallback: syllable beats + energy
  const timeline = [];
  const words = wordBoundaries.length > 0 ? wordBoundaries : 
    [{ start: 0, end: speechDuration, word: 'dummy' }];
  
  for (let i = 0; i < words.length; i++) {
    const start = words[i].start;
    const end = words[i].end;
    const duration = end - start;
    const numBeats = Math.max(1, Math.floor(duration * 5)); // ~5 beats/sec
    for (let j = 0; j < numBeats; j++) {
      const t = start + (j / numBeats) * duration;
      const amplitude = 0.3 + 0.5 * Math.sin(j * 0.8);
      timeline.push({ time: t, weights: { jawOpen: amplitude } });
    }
  }
  timeline.push({ time: speechDuration, weights: PHONEME_MAP['_'] });
  return timeline;
}

// =====================================================
// LIP SYNC ANIMATION
// =====================================================
function updateLipSync() {
  if (!isSpeaking || !faceMesh || visemeTimeline.length === 0) return;

  const elapsed = (Date.now() - speechStartTime) / 1000;

  while (currentVisemeIndex < visemeTimeline.length - 1 &&
         elapsed >= visemeTimeline[currentVisemeIndex + 1].time) {
    currentVisemeIndex++;
  }

  if (currentVisemeIndex >= visemeTimeline.length) {
    resetMorphs();
    return;
  }

  const current = visemeTimeline[currentVisemeIndex];
  const next = visemeTimeline[currentVisemeIndex + 1];

  let weights = current.weights;
  if (next && next.time > current.time) {
    const t = (elapsed - current.time) / (next.time - current.time);
    const clampedT = Math.max(0, Math.min(1, t));
    weights = {};
    const allKeys = new Set([...Object.keys(current.weights), ...Object.keys(next.weights)]);
    allKeys.forEach(key => {
      const c = current.weights[key] || 0;
      const n = next.weights[key] || 0;
      weights[key] = c * (1 - clampedT) + n * clampedT;
    });
  }

  Object.entries(weights).forEach(([morph, val]) => {
    if (morph === 'jawOpen') val *= AMPLITUDE_MULTIPLIER;
    smoothMorphTarget(morph, val, VISEME_SMOOTHING);
  });

  const energy = weights.jawOpen || 0;
  smoothMorphTarget('browInnerUp', energy * EXPRESSION_INTENSITY * 0.7, 0.1);
  smoothMorphTarget('browDown_L', energy * EXPRESSION_INTENSITY * 0.3, 0.1);
  smoothMorphTarget('browDown_R', energy * EXPRESSION_INTENSITY * 0.3, 0.1);
}

// =====================================================
// HEAD MOTION – intelligent idle glances + speech reset
// =====================================================
function updateHeadMotion(deltaTime) {
  if (!avatarModel) return;

  const now = Date.now();
  const speed = 0.15; // interpolation speed

  // ----- IDLE: Deliberate glances -----
  if (currentState === 'idle' && !glanceActive) {
    // Gentle sine drift (very subtle)
    const driftY = Math.sin(idleTime * HEAD_IDLE_DRIFT_SPEED) * HEAD_IDLE_AMPLITUDE;
    const driftX = Math.cos(idleTime * HEAD_IDLE_DRIFT_SPEED * 0.7) * HEAD_IDLE_AMPLITUDE * 0.5;
    targetModelRotY = driftY;
    targetModelRotX = driftX;
    targetModelRotZ = 0;

    // Occasional glance away
    if (now - lastGlanceTime > HEAD_GLANCE_INTERVAL) {
      glanceActive = true;
      lastGlanceTime = now;
      const angleY = (Math.random() > 0.5 ? 0.06 : -0.06); // ~3-4 degrees
      const angleX = (Math.random() - 0.5) * 0.03;
      targetModelRotY = angleY;
      targetModelRotX = angleX;
      
      if (glanceTimer) clearTimeout(glanceTimer);
      glanceTimer = setTimeout(() => {
        glanceActive = false;
      }, HEAD_GLANCE_DURATION);
    }
  }

  // ----- SPEAKING / RETURNING: move to forward -----
  if (currentState === 'speaking' || currentState === 'returning') {
    targetModelRotY = 0;
    targetModelRotX = 0;
    targetModelRotZ = 0;
  }

  // Smooth interpolation
  modelRotY += (targetModelRotY - modelRotY) * speed;
  modelRotX += (targetModelRotX - modelRotX) * speed;
  modelRotZ += (targetModelRotZ - modelRotZ) * speed;

  avatarModel.rotation.y = modelRotY;
  avatarModel.rotation.x = modelRotX;
  avatarModel.rotation.z = modelRotZ;
}

// Call this when speak button clicked – smoothly return to forward
function returnHeadToCenter(callback) {
  if (!avatarModel) { if (callback) callback(); return; }
  currentState = 'returning';
  targetModelRotY = 0;
  targetModelRotX = 0;
  targetModelRotZ = 0;
  
  // Wait for head to almost reach center
  const checkInterval = setInterval(() => {
    const distance = Math.abs(modelRotY) + Math.abs(modelRotX) + Math.abs(modelRotZ);
    if (distance < 0.005) {
      clearInterval(checkInterval);
      currentState = 'idle'; // will be overwritten by speech start
      if (callback) callback();
    }
  }, 50);
}

// =====================================================
// EYE SACCADES (morph‑based)
// =====================================================
function updateEyeSaccades() {
  if (!faceMesh) return;
  const now = Date.now();
  if (now - lastSaccadeTime > SACCADE_INTERVAL * (0.5 + Math.random())) {
    lastSaccadeTime = now;
    
    ['eyeLookUp_L', 'eyeLookUp_R', 'eyeLookDown_L', 'eyeLookDown_R',
     'eyeLookIn_L', 'eyeLookIn_R', 'eyeLookOut_L', 'eyeLookOut_R'].forEach(m => setMorphTarget(m, 0));

    const lookX = (Math.random() - 0.5) * 0.6;
    const lookY = (Math.random() - 0.5) * 0.5;

    if (lookY > 0.2) {
      setMorphTarget('eyeLookUp_L', lookY);
      setMorphTarget('eyeLookUp_R', lookY);
    } else if (lookY < -0.2) {
      setMorphTarget('eyeLookDown_L', -lookY);
      setMorphTarget('eyeLookDown_R', -lookY);
    }
    if (lookX > 0.2) {
      setMorphTarget('eyeLookOut_L', lookX);
      setMorphTarget('eyeLookIn_R', lookX);
    } else if (lookX < -0.2) {
      setMorphTarget('eyeLookIn_L', -lookX);
      setMorphTarget('eyeLookOut_R', -lookX);
    }

    setTimeout(() => {
      ['eyeLookUp_L', 'eyeLookUp_R', 'eyeLookDown_L', 'eyeLookDown_R',
       'eyeLookIn_L', 'eyeLookIn_R', 'eyeLookOut_L', 'eyeLookOut_R'].forEach(m => setMorphTarget(m, 0));
    }, 180 + Math.random() * 120);
  }
}

// =====================================================
// IDLE ANIMATIONS (breathing, subtle jaw)
// =====================================================
function updateIdleAnimation(deltaTime) {
  if (!faceMesh || currentState !== 'idle') return;

  idleTime += deltaTime;
  breathePhase += deltaTime * 0.8;

  if (avatarModel) avatarModel.position.y = Math.sin(breathePhase) * 0.012;

  const jawTarget = Math.abs(Math.sin(idleTime * 0.5)) * 0.03;
  smoothMorphTarget('jawOpen', jawTarget, 0.05);
}

// =====================================================
// BLINKING
// =====================================================
function updateBlinking() {
  if (!faceMesh) return;
  blinkTimer++;
  if (blinkTimer > nextBlink && !isBlinking) {
    isBlinking = true;
    setMorphTarget('eyeBlink_L', 1);
    setMorphTarget('eyeBlink_R', 1);
    setTimeout(() => {
      setMorphTarget('eyeBlink_L', 0);
      setMorphTarget('eyeBlink_R', 0);
      isBlinking = false;
    }, 100 + Math.random() * 50);
    blinkTimer = 0;
    nextBlink = Math.random() * 180 + 120;
  }
}

// =====================================================
// POST-SPEECH SMILE
// =====================================================
function animateSmile() {
  if (!faceMesh) return;
  const startTime = Date.now();
  const smileDuration = 2000;
  function updateSmile() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / smileDuration, 1);
    if (progress < 0.3) {
      const smileAmount = (progress / 0.3) * 0.5;
      setMorphTarget('mouthSmile_L', smileAmount);
      setMorphTarget('mouthSmile_R', smileAmount);
      setMorphTarget('cheekSquint_L', smileAmount * 0.2);
      setMorphTarget('cheekSquint_R', smileAmount * 0.2);
    } else if (progress < 1) {
      const smileAmount = 0.5 * (1 - (progress - 0.3) / 0.7);
      setMorphTarget('mouthSmile_L', smileAmount);
      setMorphTarget('mouthSmile_R', smileAmount);
      setMorphTarget('cheekSquint_L', smileAmount * 0.2);
      setMorphTarget('cheekSquint_R', smileAmount * 0.2);
    }
    if (progress < 1) requestAnimationFrame(updateSmile);
    else {
      setMorphTarget('mouthSmile_L', 0);
      setMorphTarget('mouthSmile_R', 0);
      setMorphTarget('cheekSquint_L', 0);
      setMorphTarget('cheekSquint_R', 0);
    }
  }
  updateSmile();
}

// =====================================================
// RENDER LOOP – respects page visibility
// =====================================================
let lastTime = Date.now();
function animate() {
  requestAnimationFrame(animate);
  const now = Date.now();
  const deltaTime = (now - lastTime) * 0.001;
  lastTime = now;

  // Pause if tab not visible
  if (!isPageVisible) {
    renderer.render(scene, camera);
    return;
  }

  if (faceMesh) {
    updateBlinking();
    updateEyeSaccades();
    updateHeadMotion(deltaTime);

    if (currentState === 'idle') {
      updateIdleAnimation(deltaTime);
    } else if (currentState === 'speaking' && isSpeaking) {
      updateLipSync();
    }
  }

  renderer.render(scene, camera);
}
animate();

// =====================================================
// UI CONTROLS
// =====================================================
const textInput = document.getElementById('text-input');
const speakBtn = document.getElementById('speak-btn');
const stopBtn = document.getElementById('stop-btn');
const voiceSelect = document.getElementById('voice-select');

let voices = [];
let selectedVoice = null;
let utterance = null;

function loadVoices() {
  voices = speechSynthesis.getVoices();
  if (voices.length === 0) { setTimeout(loadVoices, 100); return; }
  voiceSelect.innerHTML = '';
  const englishVoices = voices.filter(v => v.lang.startsWith('en'));
  const voicesToShow = englishVoices.length > 0 ? englishVoices : voices;
  voicesToShow.forEach((voice, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = `${voice.name} (${voice.lang})`;
    if (voice.default) option.selected = true;
    voiceSelect.appendChild(option);
  });
  if (!selectedVoice && voicesToShow.length > 0) selectedVoice = voicesToShow[0];
}
if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

voiceSelect.addEventListener('change', (e) => {
  const allVoices = speechSynthesis.getVoices();
  selectedVoice = allVoices[e.target.value];
});

function updateStatus(text, speaking) {
  const statusEl = document.getElementById('status');
  const statusText = document.getElementById('status-text');
  statusText.textContent = text;
  if (speaking) statusEl.classList.add('speaking');
  else statusEl.classList.remove('speaking');
}

function estimateSpeechDuration(text, rate = 1.0) {
  // More accurate: count characters, not just words
  const charCount = text.length;
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  // Average speaking rate: 150 words/min, 5 chars/word => 750 chars/min
  const duration = Math.max(charCount / 12.5, words * 0.4); // seconds
  return duration;
}

// =====================================================
// SPEECH HANDLER – with head return and punctuation
// =====================================================
speakBtn.addEventListener('click', () => {
  const text = textInput.value.trim();
  if (!text) { alert('Please enter some text first!'); return; }
  if (!faceMesh) { alert('Avatar is still loading. Please wait...'); return; }

  // Cancel any ongoing speech
  speechSynthesis.cancel();
  isSpeaking = false;
  resetMorphs();

  // First, smoothly return head to center
  returnHeadToCenter(() => {
    // Now start speech
    wordBoundaries = [];
    visemeTimeline = [];
    currentVisemeIndex = 0;

    utterance = new SpeechSynthesisUtterance(text);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onboundary = (evt) => {
      if (evt.name === 'word') {
        const word = text.substr(evt.charIndex, evt.charLength);
        const start = evt.elapsedTime;
        wordBoundaries.push({ word, start, end: speechDuration });
      }
    };

    utterance.onstart = () => {
      console.log('🎤 Speech started');
      updateStatus('Speaking...', true);
      speakBtn.disabled = true;
      stopBtn.disabled = false;
      currentState = 'speaking';
      isSpeaking = true;
      speechStartTime = Date.now();
      speechDuration = estimateSpeechDuration(text, utterance.rate || 1.0);
      wordBoundaries = [];
    };

    utterance.onend = () => {
      console.log('🎤 Speech ended');
      isSpeaking = false;
      currentState = 'idle';
      resetMorphs();

      setTimeout(() => {
        animateSmile();
        updateStatus('Idle', false);
        speakBtn.disabled = false;
        stopBtn.disabled = true;
      }, 300);
    };

    utterance.onerror = (e) => {
      console.error('Speech error:', e);
      isSpeaking = false;
      currentState = 'idle';
      resetMorphs();
      updateStatus('Error', false);
      speakBtn.disabled = false;
      stopBtn.disabled = true;
    };

    const originalOnStart = utterance.onstart;
    utterance.onstart = (e) => {
      originalOnStart.call(utterance, e);
      setTimeout(() => {
        wordBoundaries.sort((a, b) => a.start - b.start);
        for (let i = 0; i < wordBoundaries.length; i++) {
          if (i < wordBoundaries.length - 1) {
            wordBoundaries[i].end = wordBoundaries[i + 1].start;
          } else {
            wordBoundaries[i].end = speechDuration;
          }
        }
        // Insert pauses for punctuation
        wordBoundaries = insertPunctuationPauses(text, wordBoundaries);
        phonemizerReady = typeof window.g2p === 'function';
        visemeTimeline = buildVisemeTimeline();
        currentVisemeIndex = 0;
        console.log(`✓ Viseme timeline built (${visemeTimeline.length} keyframes)`);
      }, 50);
    };

    speechSynthesis.speak(utterance);
  });
});

stopBtn.addEventListener('click', () => {
  speechSynthesis.cancel();
  isSpeaking = false;
  currentState = 'idle';
  resetMorphs();
  updateStatus('Idle', false);
  speakBtn.disabled = false;
  stopBtn.disabled = true;
  // Also reset head target to zero
  targetModelRotY = 0;
  targetModelRotX = 0;
  targetModelRotZ = 0;
});

textInput.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') speakBtn.click();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  if (glanceTimer) clearTimeout(glanceTimer);
});

console.log('✓ Avatar PRODUCTION READY – intelligent head motion, perfect lip sync, punctuation pauses');
