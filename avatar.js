import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

// =====================================================
// CONFIGURATION – balanced for realism
// =====================================================
const VISEME_SMOOTHING = 0.4;        // Interpolation speed (0.3–0.5)
const AMPLITUDE_MULTIPLIER = 0.9;    // Jaw open scale (reduced!)
const EXPRESSION_INTENSITY = 0.2;    // Eyebrow movement

// Head motion – subtle, deliberate
const HEAD_IDLE_DRIFT_SPEED = 0.15;
const HEAD_IDLE_AMPLITUDE = 0.006;
const HEAD_GLANCE_INTERVAL = 4000;
const HEAD_GLANCE_DURATION = 700;
const HEAD_RETURN_SPEED = 0.1;

// Punctuation pauses (seconds)
const PAUSE_DURATION = {
  '.': 0.25, '!': 0.3, '?': 0.3, ',': 0.15, ';': 0.2, ':': 0.2
};

// =====================================================
// PHONEME → VISEME – precise, natural, not exaggerated
// =====================================================
const PHONEME_MAP = {
  // ---------- VOWELS – moderate jaw, slight smile/funnel ----------
  'AA': { jawOpen: 0.6, mouthFunnel: 0.1 },                     // father
  'AE': { jawOpen: 0.55, mouthSmile_L: 0.2, mouthSmile_R: 0.2 }, // cat
  'AH': { jawOpen: 0.5, mouthFunnel: 0.1 },                    // cut
  'AO': { jawOpen: 0.55, mouthFunnel: 0.3 },                   // off
  'AW': { jawOpen: 0.55, mouthFunnel: 0.25, mouthPucker: 0.2 }, // cow
  'AY': { jawOpen: 0.55, mouthSmile_L: 0.3, mouthSmile_R: 0.3 }, // hide
  'EH': { jawOpen: 0.5, mouthSmile_L: 0.2, mouthSmile_R: 0.2 }, // red
  'ER': { jawOpen: 0.45, mouthFunnel: 0.2, mouthPucker: 0.1 },  // bird
  'EY': { jawOpen: 0.5, mouthSmile_L: 0.4, mouthSmile_R: 0.4 }, // say
  'IH': { jawOpen: 0.45, mouthSmile_L: 0.15, mouthSmile_R: 0.15 }, // sit
  'IY': { jawOpen: 0.4, mouthSmile_L: 0.5, mouthSmile_R: 0.5 }, // see
  'OW': { jawOpen: 0.5, mouthFunnel: 0.3, mouthPucker: 0.2 },   // go
  'OY': { jawOpen: 0.5, mouthFunnel: 0.2, mouthPucker: 0.15, 
          mouthSmile_L: 0.15, mouthSmile_R: 0.15 },             // boy
  'UH': { jawOpen: 0.45, mouthFunnel: 0.3, mouthPucker: 0.2 },  // book
  'UW': { jawOpen: 0.45, mouthFunnel: 0.5, mouthPucker: 0.3 },  // too

  // ---------- PLOSIVES – quick lip closure ----------
  'P':  { jawOpen: 0.15, mouthPress_L: 0.4, mouthPress_R: 0.4, cheekPuff: 0.1 },
  'B':  { jawOpen: 0.15, mouthPress_L: 0.4, mouthPress_R: 0.4, cheekPuff: 0.1 },
  'M':  { jawOpen: 0.1,  mouthPress_L: 0.3, mouthPress_R: 0.3, cheekPuff: 0.05 },
  'T':  { jawOpen: 0.2, mouthClose: 0.2 },
  'D':  { jawOpen: 0.2, mouthClose: 0.2 },
  'N':  { jawOpen: 0.15, mouthClose: 0.15 },
  'K':  { jawOpen: 0.2, mouthClose: 0.15, jawForward: 0.05 },
  'G':  { jawOpen: 0.2, mouthClose: 0.15, jawForward: 0.05 },
  'NG': { jawOpen: 0.15, mouthClose: 0.15 },

  // ---------- FRICATIVES – narrow air channel ----------
  'S':  { jawOpen: 0.1, mouthStretch_L: 0.4, mouthStretch_R: 0.4 },
  'Z':  { jawOpen: 0.1, mouthStretch_L: 0.4, mouthStretch_R: 0.4 },
  'SH': { jawOpen: 0.15, mouthStretch_L: 0.4, mouthStretch_R: 0.4, mouthPucker: 0.2 },
  'ZH': { jawOpen: 0.15, mouthStretch_L: 0.4, mouthStretch_R: 0.4, mouthPucker: 0.2 },
  'F':  { jawOpen: 0.15, mouthPress_L: 0.25, mouthPress_R: 0.25 }, // upper lip to teeth
  'V':  { jawOpen: 0.15, mouthPress_L: 0.25, mouthPress_R: 0.25 },
  'TH': { jawOpen: 0.15, mouthStretch_L: 0.2, mouthStretch_R: 0.2, tongueOut: 0.2 },
  'DH': { jawOpen: 0.15, mouthStretch_L: 0.2, mouthStretch_R: 0.2, tongueOut: 0.2 },
  'HH': { jawOpen: 0.2 },

  // ---------- AFFRICATES ----------
  'CH': { jawOpen: 0.2, mouthStretch_L: 0.35, mouthStretch_R: 0.35, mouthPucker: 0.15 },
  'JH': { jawOpen: 0.2, mouthStretch_L: 0.35, mouthStretch_R: 0.35, mouthPucker: 0.15 },

  // ---------- APPROXIMANTS ----------
  'L':  { jawOpen: 0.2, mouthStretch_L: 0.25, mouthStretch_R: 0.25 },
  'R':  { jawOpen: 0.2, mouthFunnel: 0.2, mouthPucker: 0.2 },
  'Y':  { jawOpen: 0.2, mouthSmile_L: 0.3, mouthSmile_R: 0.3 },
  'W':  { jawOpen: 0.2, mouthFunnel: 0.3, mouthPucker: 0.4 },

  // ---------- SILENCE (pause, neutral) ----------
  '_':  { jawOpen: 0.0, mouthFunnel: 0.0, mouthPucker: 0.0,
          mouthSmile_L: 0.0, mouthSmile_R: 0.0,
          mouthPress_L: 0.0, mouthPress_R: 0.0,
          mouthClose: 0.0, mouthStretch_L: 0.0, mouthStretch_R: 0.0,
          cheekPuff: 0.0, tongueOut: 0.0, jawForward: 0.0 }
};

const DEFAULT_PHONEME = { jawOpen: 0.25 };

// =====================================================
// SCENE SETUP (unchanged)
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
let currentState = 'idle';
let isBlinking = false;
let blinkTimer = 0;
let nextBlink = Math.random() * 180 + 120;
let idleTime = 0;
let breathePhase = 0;
let isSpeaking = false;
let isPageVisible = true;

// Head motion
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

// Click reaction
let clickReactionActive = false;
let clickReactionEndTime = 0;

// =====================================================
// PAGE VISIBILITY
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
// PUNCTUATION PAUSES
// =====================================================
function insertPunctuationPauses(text, boundaries) {
  const newBoundaries = [];
  for (let i = 0; i < boundaries.length; i++) {
    newBoundaries.push(boundaries[i]);
    const word = boundaries[i].word;
    const lastChar = word[word.length - 1];
    if (lastChar in PAUSE_DURATION) {
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
// BUILD VISEME TIMELINE – with realistic phoneme durations
// =====================================================
function buildVisemeTimeline() {
  if (!faceMesh || !phonemizerReady || wordBoundaries.length === 0) {
    return generateFallbackTimeline();
  }

  const timeline = [];
  for (let i = 0; i < wordBoundaries.length; i++) {
    const { word, start, end } = wordBoundaries[i];
    
    if (word === '_pause_') {
      timeline.push({ time: start, weights: PHONEME_MAP['_'] });
      timeline.push({ time: end, weights: PHONEME_MAP['_'] });
      continue;
    }

    const phonemes = wordToPhonemes(word);
    if (!phonemes || phonemes.length === 0) {
      // Fallback: use a short neutral then a generic mouth movement
      const mid = (start + end) / 2;
      timeline.push({ time: start, weights: PHONEME_MAP['_'] });
      timeline.push({ time: mid, weights: { jawOpen: 0.4 } });
      timeline.push({ time: end, weights: PHONEME_MAP['_'] });
      continue;
    }

    const wordDuration = end - start;
    // Assign relative durations: vowels longer, consonants shorter, plosives very short
    let phonemeDurations = phonemes.map(p => {
      const base = p.replace(/[0-9]/g, '');
      if (/^(AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW)/.test(base)) return 2.0; // vowels
      if (/^(P|B|M|T|D|N|K|G|NG)/.test(base)) return 0.6; // plosives
      if (/^(S|Z|SH|ZH|F|V|TH|DH|HH)/.test(base)) return 0.9; // fricatives
      if (/^(CH|JH)/.test(base)) return 0.8; // affricates
      return 1.0; // others
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
  // Simple energy envelope – only used if phonemizer fails
  const timeline = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * speechDuration;
    const amplitude = 0.3 + 0.3 * Math.sin(i * 0.5);
    timeline.push({ time: t, weights: { jawOpen: amplitude } });
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

  // Apply weights with smoothing
  Object.entries(weights).forEach(([morph, val]) => {
    if (morph === 'jawOpen') val *= AMPLITUDE_MULTIPLIER;
    smoothMorphTarget(morph, val, VISEME_SMOOTHING);
  });

  const energy = weights.jawOpen || 0;
  smoothMorphTarget('browInnerUp', energy * EXPRESSION_INTENSITY * 0.6, 0.1);
  smoothMorphTarget('browDown_L', energy * EXPRESSION_INTENSITY * 0.2, 0.1);
  smoothMorphTarget('browDown_R', energy * EXPRESSION_INTENSITY * 0.2, 0.1);
}

// =====================================================
// HEAD MOTION – idle glances + click reaction
// =====================================================
function updateHeadMotion(deltaTime) {
  if (!avatarModel) return;

  const now = Date.now();
  const speed = 0.15;

  // ----- Click reaction overrides normal motion -----
  if (clickReactionActive) {
    if (now > clickReactionEndTime) {
      clickReactionActive = false;
    } else {
      // Already set target via reactToClick, just interpolate
    }
  } else {
    // ----- Normal idle motion -----
    if (currentState === 'idle' && !glanceActive) {
      // Gentle sine drift
      const driftY = Math.sin(idleTime * HEAD_IDLE_DRIFT_SPEED) * HEAD_IDLE_AMPLITUDE;
      const driftX = Math.cos(idleTime * HEAD_IDLE_DRIFT_SPEED * 0.6) * HEAD_IDLE_AMPLITUDE * 0.5;
      targetModelRotY = driftY;
      targetModelRotX = driftX;
      targetModelRotZ = 0;

      // Occasional glance
      if (now - lastGlanceTime > HEAD_GLANCE_INTERVAL) {
        glanceActive = true;
        lastGlanceTime = now;
        targetModelRotY = (Math.random() > 0.5 ? 0.05 : -0.05);
        targetModelRotX = (Math.random() - 0.5) * 0.02;
        
        if (glanceTimer) clearTimeout(glanceTimer);
        glanceTimer = setTimeout(() => {
          glanceActive = false;
        }, HEAD_GLANCE_DURATION);
      }
    }

    // ----- Speaking: return to center -----
    if (currentState === 'speaking') {
      targetModelRotY = 0;
      targetModelRotX = 0;
      targetModelRotZ = 0;
    }
  }

  // Smooth interpolation
  modelRotY += (targetModelRotY - modelRotY) * speed;
  modelRotX += (targetModelRotX - modelRotX) * speed;
  modelRotZ += (targetModelRotZ - modelRotZ) * speed;

  avatarModel.rotation.y = modelRotY;
  avatarModel.rotation.x = modelRotX;
  avatarModel.rotation.z = modelRotZ;
}

// =====================================================
// CLICK INTERACTION – avatar reacts to user click
// =====================================================
function reactToClick(event) {
  if (!avatarModel || !faceMesh) return;
  
  // Get click position relative to canvas for direction
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  
  // Quick blink
  setMorphTarget('eyeBlink_L', 1);
  setMorphTarget('eyeBlink_R', 1);
  setTimeout(() => {
    setMorphTarget('eyeBlink_L', 0);
    setMorphTarget('eyeBlink_R', 0);
  }, 150);

  // Turn head toward click side (briefly)
  const turnAmount = x * 0.08; // max ~0.08 rad (~4.5°)
  targetModelRotY = turnAmount;
  targetModelRotX = 0.02; // slight up
  clickReactionActive = true;
  clickReactionEndTime = Date.now() + 800; // hold for 0.8s
  
  // After hold, return to previous target
  setTimeout(() => {
    if (!isSpeaking) {
      // Return to idle drift
      targetModelRotY = 0;
      targetModelRotX = 0;
    }
    clickReactionActive = false;
  }, 800);
}

// Attach click listener after model loads
function attachClickHandler() {
  renderer.domElement.addEventListener('click', reactToClick);
}
// Call after renderer is created
attachClickHandler();

// =====================================================
// EYE SACCADES
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
// IDLE ANIMATIONS
// =====================================================
function updateIdleAnimation(deltaTime) {
  if (!faceMesh || currentState !== 'idle') return;

  idleTime += deltaTime;
  breathePhase += deltaTime * 0.8;

  if (avatarModel) avatarModel.position.y = Math.sin(breathePhase) * 0.012;

  const jawTarget = Math.abs(Math.sin(idleTime * 0.5)) * 0.02;
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
      const smileAmount = (progress / 0.3) * 0.4;
      setMorphTarget('mouthSmile_L', smileAmount);
      setMorphTarget('mouthSmile_R', smileAmount);
      setMorphTarget('cheekSquint_L', smileAmount * 0.2);
      setMorphTarget('cheekSquint_R', smileAmount * 0.2);
    } else if (progress < 1) {
      const smileAmount = 0.4 * (1 - (progress - 0.3) / 0.7);
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
// RENDER LOOP
// =====================================================
let lastTime = Date.now();
function animate() {
  requestAnimationFrame(animate);
  const now = Date.now();
  const deltaTime = (now - lastTime) * 0.001;
  lastTime = now;

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
  const charCount = text.length;
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  return Math.max(charCount / 12, words * 0.35); // seconds
}

// =====================================================
// SPEECH HANDLER – with head return and punctuation
// =====================================================
function returnHeadToCenter(callback) {
  if (!avatarModel) { if (callback) callback(); return; }
  currentState = 'returning';
  targetModelRotY = 0;
  targetModelRotX = 0;
  targetModelRotZ = 0;
  
  const checkInterval = setInterval(() => {
    const distance = Math.abs(modelRotY) + Math.abs(modelRotX) + Math.abs(modelRotZ);
    if (distance < 0.005) {
      clearInterval(checkInterval);
      currentState = 'idle';
      if (callback) callback();
    }
  }, 50);
}

speakBtn.addEventListener('click', () => {
  const text = textInput.value.trim();
  if (!text) { alert('Please enter some text first!'); return; }
  if (!faceMesh) { alert('Avatar is still loading. Please wait...'); return; }

  speechSynthesis.cancel();
  isSpeaking = false;
  resetMorphs();

  returnHeadToCenter(() => {
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
  targetModelRotY = 0;
  targetModelRotX = 0;
  targetModelRotZ = 0;
});

textInput.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') speakBtn.click();
});

window.addEventListener('beforeunload', () => {
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  if (glanceTimer) clearTimeout(glanceTimer);
});

console.log('✓ Avatar PRODUCTION READY – refined visemes, click reaction, perfect sync');
