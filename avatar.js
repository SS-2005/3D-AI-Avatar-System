import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

// =====================================================
// CONFIGURATION
// =====================================================
const VISEME_SMOOTHING = 0.3; // Mouth movement smoothness (0.1 = slow, 0.5 = fast)
const AMPLITUDE_MULTIPLIER = 1.4; // How much mouth opens
const EXPRESSION_INTENSITY = 0.15; // Eyebrow movement intensity

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
  const w = el.clientWidth;
  const h = el.clientHeight;
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
let currentState = 'idle';
let isBlinking = false;
let blinkTimer = 0;
let nextBlink = Math.random() * 180 + 120;
let idleTime = 0;
let breathePhase = 0;
let isSpeaking = false;

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

    if (!faceMesh) {
      console.error("✗ No face mesh found");
      return;
    }

    // Auto-frame model
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
  if (index !== undefined) {
    return faceMesh.morphTargetInfluences[index] || 0;
  }
  return 0;
}

function smoothMorphTarget(name, target, speed = VISEME_SMOOTHING) {
  const current = getMorphTarget(name);
  const newValue = current + (target - current) * speed;
  setMorphTarget(name, newValue);
}

// =====================================================
// LIP SYNC ANIMATION (Text-Based Timing)
// =====================================================
let lipSyncInterval = null;
let speechStartTime = 0;
let speechDuration = 0;

function estimateSpeechDuration(text, rate = 1.0) {
  const wordsPerMinute = 150 / rate;
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  const durationSeconds = (words / wordsPerMinute) * 60;
  return durationSeconds * 1000; // Convert to milliseconds
}

function startLipSync(text) {
  if (lipSyncInterval) {
    clearInterval(lipSyncInterval);
  }

  speechStartTime = Date.now();
  speechDuration = estimateSpeechDuration(text, 1.0);
  
  console.log(`Estimated speech duration: ${(speechDuration/1000).toFixed(1)}s for ${text.split(/\s+/).length} words`);

  const updateInterval = 33; // ~30 FPS for mouth animation
  
  lipSyncInterval = setInterval(() => {
    if (!isSpeaking) {
      clearInterval(lipSyncInterval);
      closeMouth();
      return;
    }

    const elapsed = Date.now() - speechStartTime;
    const progress = elapsed / speechDuration;

    if (progress >= 1) {
      clearInterval(lipSyncInterval);
      closeMouth();
      return;
    }

    const timePhase = progress * Math.PI * 8; // Multiple cycles
    const amplitude = Math.sin(progress * Math.PI); // Envelope: starts/ends quiet
    const rand = Math.random();
    const noise = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;

    const baseJaw = (0.3 + Math.sin(timePhase) * 0.2) * amplitude * AMPLITUDE_MULTIPLIER;
    smoothMorphTarget('jawOpen', baseJaw, VISEME_SMOOTHING);

    if (rand < 0.3) {
      smoothMorphTarget('mouthSmile_L', 0.3 * amplitude, VISEME_SMOOTHING);
      smoothMorphTarget('mouthSmile_R', 0.3 * amplitude, VISEME_SMOOTHING);
      smoothMorphTarget('mouthFunnel', 0, VISEME_SMOOTHING);
      smoothMorphTarget('mouthPucker', 0, VISEME_SMOOTHING);
    } else if (rand < 0.6) {
      smoothMorphTarget('mouthFunnel', 0.4 * amplitude, VISEME_SMOOTHING);
      smoothMorphTarget('mouthPucker', 0.3 * amplitude, VISEME_SMOOTHING);
      smoothMorphTarget('mouthSmile_L', 0, VISEME_SMOOTHING);
      smoothMorphTarget('mouthSmile_R', 0, VISEME_SMOOTHING);
    } else if (rand < 0.8) {
      smoothMorphTarget('mouthClose', noise * 0.3 * amplitude, VISEME_SMOOTHING);
      smoothMorphTarget('mouthPress_L', noise * 0.2 * amplitude, VISEME_SMOOTHING);
      smoothMorphTarget('mouthPress_R', noise * 0.2 * amplitude, VISEME_SMOOTHING);
    } else {
      smoothMorphTarget('mouthStretch_L', 0.3 * amplitude, VISEME_SMOOTHING);
      smoothMorphTarget('mouthStretch_R', 0.3 * amplitude, VISEME_SMOOTHING);
      smoothMorphTarget('jawOpen', baseJaw * 0.5, VISEME_SMOOTHING);
    }

    const browMove = Math.sin(timePhase * 0.5) * EXPRESSION_INTENSITY * amplitude;
    smoothMorphTarget('browInnerUp', Math.abs(browMove), 0.1);

    if (faceMesh && Math.random() > 0.95) {
      faceMesh.rotation.y = (Math.random() - 0.5) * 0.008;
    }

  }, updateInterval);
}

function closeMouth() {
  const mouthMorphs = [
    'jawOpen', 'mouthFunnel', 'mouthPucker', 
    'mouthSmile_L', 'mouthSmile_R',
    'mouthClose', 'mouthPress_L', 'mouthPress_R',
    'mouthStretch_L', 'mouthStretch_R',
    'browInnerUp'
  ];
  
  for (const morph of mouthMorphs) {
    smoothMorphTarget(morph, 0, 0.2);
  }
}

// =====================================================
// IDLE ANIMATIONS
// =====================================================
function updateIdleAnimation(deltaTime) {
  if (!faceMesh || currentState !== 'idle') return;

  idleTime += deltaTime;
  breathePhase += deltaTime * 0.8;

  const breathe = Math.sin(breathePhase) * 0.012;
  if (avatarModel) {
    avatarModel.position.y = breathe;
  }

  if (faceMesh) {
    faceMesh.rotation.x = Math.sin(idleTime * 0.12) * 0.002;
    faceMesh.rotation.y = Math.sin(idleTime * 0.10) * 0.0015;
    faceMesh.rotation.z = Math.sin(idleTime * 0.08) * 0.001;
  }

  const jawTarget = Math.abs(Math.sin(idleTime * 0.5)) * 0.05;
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

  const dict = faceMesh.morphTargetDictionary;
  for (const key in dict) {
    if (key.startsWith('eyeLook') || key.startsWith('eyeWide') || key.startsWith('eyeSquint')) {
      setMorphTarget(key, 0);
    }
  }
}

// =====================================================
// POST-SPEECH SMILE
// =====================================================
function animateSmile() {
  if (!faceMesh) return;

  const smileDuration = 2000;
  const startTime = Date.now();

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

    if (progress < 1) {
      requestAnimationFrame(updateSmile);
    } else {
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

  if (faceMesh) {
    updateBlinking();
    
    if (currentState === 'idle') {
      updateIdleAnimation(deltaTime);
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
  
  if (voices.length === 0) {
    setTimeout(loadVoices, 100);
    return;
  }

  voiceSelect.innerHTML = '';
  
  const englishVoices = voices.filter(v => v.lang.startsWith('en'));
  const voicesToShow = englishVoices.length > 0 ? englishVoices : voices;

  voicesToShow.forEach((voice, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = `${voice.name} (${voice.lang})`;
    if (voice.default) {
      option.selected = true;
      selectedVoice = voice;
    }
    voiceSelect.appendChild(option);
  });

  if (!selectedVoice && voicesToShow.length > 0) {
    selectedVoice = voicesToShow[0];
  }
}

if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = loadVoices;
}
loadVoices();

voiceSelect.addEventListener('change', (e) => {
  const allVoices = speechSynthesis.getVoices();
  selectedVoice = allVoices[e.target.value];
});

function updateStatus(text, speaking) {
  const statusEl = document.getElementById('status');
  const statusText = document.getElementById('status-text');
  statusText.textContent = text;
  
  if (speaking) {
    statusEl.classList.add('speaking');
  } else {
    statusEl.classList.remove('speaking');
  }
}

// =====================================================
// SPEECH HANDLER
// =====================================================
speakBtn.addEventListener('click', () => {
  const text = textInput.value.trim();
  
  if (!text) {
    alert('Please enter some text first!');
    return;
  }

  if (!faceMesh) {
    alert('Avatar is still loading. Please wait...');
    return;
  }

  // Cancel any ongoing speech
  speechSynthesis.cancel();
  if (lipSyncInterval) {
    clearInterval(lipSyncInterval);
  }

  // Create utterance
  utterance = new SpeechSynthesisUtterance(text);
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  utterance.onstart = () => {
    console.log('🎤 Speech started');
    updateStatus('Speaking...', true);
    speakBtn.disabled = true;
    stopBtn.disabled = false;
    currentState = 'speaking';
    isSpeaking = true;
    
    // Start lip sync animation
    startLipSync(text);
  };

  utterance.onend = () => {
    console.log('🎤 Speech ended');
    isSpeaking = false;
    
    // Clean up
    if (lipSyncInterval) {
      clearInterval(lipSyncInterval);
    }
    closeMouth();
    
    // Smile after brief pause
    setTimeout(() => {
      currentState = 'idle';
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
    if (lipSyncInterval) {
      clearInterval(lipSyncInterval);
    }
    closeMouth();
    updateStatus('Error', false);
    speakBtn.disabled = false;
    stopBtn.disabled = true;
  };

  // Start speech
  speechSynthesis.speak(utterance);
});

stopBtn.addEventListener('click', () => {
  speechSynthesis.cancel();
  isSpeaking = false;
  currentState = 'idle';
  if (lipSyncInterval) {
    clearInterval(lipSyncInterval);
  }
  closeMouth();
  updateStatus('Idle', false);
  speakBtn.disabled = false;
  stopBtn.disabled = true;
});

// Keyboard shortcut
textInput.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') {
    speakBtn.click();
  }
});

console.log('✓ Avatar initialized');
console.log('✓ Lip sync system ready');
console.log('✓ Press Ctrl+Enter to speak');
