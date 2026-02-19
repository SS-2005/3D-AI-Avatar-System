import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

// =====================================================
// CONFIGURATION
// =====================================================
const VISEME_SMOOTHING_IN  = 0.35;   // Speed morphs animate TO target
const VISEME_SMOOTHING_OUT = 0.22;   // Speed morphs animate back to rest
const AMPLITUDE_MULTIPLIER = 1.0;
const EXPRESSION_INTENSITY = 0.22;

// Head motion
const HEAD_IDLE_DRIFT_SPEED = 0.15;
const HEAD_IDLE_AMPLITUDE   = 0.006;
const HEAD_GLANCE_INTERVAL  = 4000;
const HEAD_GLANCE_DURATION  = 700;

// =====================================================
// COMPLETE ARKit MORPH TARGET INDICES (from your list)
// =====================================================
// We use names not indices – Three.js resolves by name via morphTargetDictionary.
// These are all the available morphs for reference; we use them in viseme shapes.

// =====================================================
// VISEME DEFINITIONS – full ARKit blend shapes
// Each viseme is a map of morph-name → weight (0–1)
// Morphs NOT listed in a shape are smoothly driven to 0.
// =====================================================
const VISEME_SHAPES = {
  // --------------------------------------------------
  // REST / SILENCE
  // --------------------------------------------------
  sil: {
    jawOpen: 0.0,
    mouthFunnel: 0.0, mouthPucker: 0.0,
    mouthSmile_L: 0.04, mouthSmile_R: 0.04,
    // mouthClose intentionally 0 – never lift the lower lip at rest
  },

  // --------------------------------------------------
  // BILABIAL – P, B, M  (lips together / puff)
  // --------------------------------------------------
  PP: {
    jawOpen: 0.03, mouthClose: 0.55,
    mouthPress_L: 0.65, mouthPress_R: 0.65,
    mouthRollLower: 0.15,
    cheekPuff: 0.08,
  },
  BB: {
    jawOpen: 0.04, mouthClose: 0.5,
    mouthPress_L: 0.6, mouthPress_R: 0.6,
    mouthRollLower: 0.12,
    cheekPuff: 0.1,
  },
  MM: {
    jawOpen: 0.0, mouthClose: 0.65,
    mouthPress_L: 0.55, mouthPress_R: 0.55,
    mouthRollLower: 0.18,
    cheekPuff: 0.06,
  },

  // --------------------------------------------------
  // LABIODENTAL – F, V  (upper teeth on lower lip)
  // --------------------------------------------------
  FF: {
    jawOpen: 0.12, mouthClose: 0.0,
    mouthLowerDown_L: 0.45, mouthLowerDown_R: 0.45,
    mouthPress_L: 0.25, mouthPress_R: 0.25,
    mouthShrugUpper: 0.12,
  },

  // --------------------------------------------------
  // DENTAL / INTERDENTAL – TH, DH
  // --------------------------------------------------
  TH: {
    jawOpen: 0.18, mouthClose: 0.0,
    tongueOut: 0.45, mouthStretch_L: 0.3, mouthStretch_R: 0.3,
    mouthLowerDown_L: 0.2, mouthLowerDown_R: 0.2,
    mouthUpperUp_L: 0.1, mouthUpperUp_R: 0.1,
  },

  // --------------------------------------------------
  // ALVEOLAR STOP – T, D
  // --------------------------------------------------
  DD: {
    jawOpen: 0.22,
    mouthStretch_L: 0.18, mouthStretch_R: 0.18,
    mouthUpperUp_L: 0.08, mouthUpperUp_R: 0.08,
    // no mouthClose – jaw is open, closing lip here causes the crossover bug
  },

  // --------------------------------------------------
  // ALVEOLAR NASAL – N
  // --------------------------------------------------
  NN: {
    jawOpen: 0.18,
    mouthStretch_L: 0.15, mouthStretch_R: 0.15,
    // no mouthClose – same crossover issue
  },

  // --------------------------------------------------
  // SIBILANT – S, Z
  // --------------------------------------------------
  SS: {
    jawOpen: 0.10, mouthClose: 0.0,
    mouthStretch_L: 0.65, mouthStretch_R: 0.65,
    mouthSmile_L: 0.25, mouthSmile_R: 0.25,
    mouthUpperUp_L: 0.08, mouthUpperUp_R: 0.08,
  },

  // --------------------------------------------------
  // POSTALVEOLAR – SH, ZH, CH, JH
  // --------------------------------------------------
  SH: {
    jawOpen: 0.14, mouthClose: 0.0,
    mouthFunnel: 0.45, mouthPucker: 0.35,
    mouthStretch_L: 0.3, mouthStretch_R: 0.3,
  },
  CH: {
    jawOpen: 0.2,
    mouthFunnel: 0.4, mouthPucker: 0.3,
    mouthStretch_L: 0.35, mouthStretch_R: 0.35,
  },

  // --------------------------------------------------
  // LATERAL – L
  // --------------------------------------------------
  LL: {
    jawOpen: 0.28, mouthClose: 0.0,
    mouthStretch_L: 0.4, mouthStretch_R: 0.4,
    mouthSmile_L: 0.2, mouthSmile_R: 0.2,
    mouthLowerDown_L: 0.12, mouthLowerDown_R: 0.12,
  },

  // --------------------------------------------------
  // RHOTIC – R
  // --------------------------------------------------
  RR: {
    jawOpen: 0.24,
    mouthFunnel: 0.35, mouthPucker: 0.28,
    mouthRollLower: 0.12,  // was 0.28 – caused lower lip to ride up
    mouthShrugLower: 0.06,
  },

  // --------------------------------------------------
  // VELAR – K, G, NG
  // --------------------------------------------------
  KK: {
    jawOpen: 0.28,
    jawForward: 0.08,
    mouthShrugLower: 0.08,
    // no mouthClose – jaw is open
  },
  NN_velar: {
    jawOpen: 0.18,
    jawForward: 0.06,
    // no mouthClose
  },

  // --------------------------------------------------
  // GLOTTAL – H
  // --------------------------------------------------
  HH: {
    jawOpen: 0.26, mouthFunnel: 0.12,
    mouthShrugLower: 0.08,
  },

  // --------------------------------------------------
  // APPROXIMANTS – W, Y
  // --------------------------------------------------
  WW: {
    jawOpen: 0.22, mouthClose: 0.0,
    mouthFunnel: 0.65, mouthPucker: 0.55,
    mouthRollUpper: 0.2, mouthRollLower: 0.18,
  },
  YY: {
    jawOpen: 0.28, mouthClose: 0.0,
    mouthSmile_L: 0.45, mouthSmile_R: 0.45,
    mouthStretch_L: 0.3, mouthStretch_R: 0.3,
  },

  // --------------------------------------------------
  // VOWELS – front
  // --------------------------------------------------
  IY: { // "bEEt"
    jawOpen: 0.28, mouthClose: 0.0,
    mouthSmile_L: 0.65, mouthSmile_R: 0.65,
    mouthStretch_L: 0.35, mouthStretch_R: 0.35,
    mouthUpperUp_L: 0.12, mouthUpperUp_R: 0.12,
    cheekSquint_L: 0.12, cheekSquint_R: 0.12,
  },
  IH: { // "bIt"
    jawOpen: 0.34, mouthClose: 0.0,
    mouthSmile_L: 0.45, mouthSmile_R: 0.45,
    mouthStretch_L: 0.28, mouthStretch_R: 0.28,
    mouthUpperUp_L: 0.08, mouthUpperUp_R: 0.08,
  },
  EY: { // "bAte"
    jawOpen: 0.38, mouthClose: 0.0,
    mouthSmile_L: 0.52, mouthSmile_R: 0.52,
    mouthStretch_L: 0.32, mouthStretch_R: 0.32,
    mouthUpperUp_L: 0.1, mouthUpperUp_R: 0.1,
    mouthLowerDown_L: 0.08, mouthLowerDown_R: 0.08,
  },
  EH: { // "bEt"
    jawOpen: 0.44, mouthClose: 0.0,
    mouthSmile_L: 0.3, mouthSmile_R: 0.3,
    mouthStretch_L: 0.25, mouthStretch_R: 0.25,
    mouthLowerDown_L: 0.18, mouthLowerDown_R: 0.18,
  },
  AE: { // "bAt"
    jawOpen: 0.55, mouthClose: 0.0,
    mouthSmile_L: 0.28, mouthSmile_R: 0.28,
    mouthLowerDown_L: 0.3, mouthLowerDown_R: 0.3,
    mouthStretch_L: 0.15, mouthStretch_R: 0.15,
    mouthShrugLower: 0.08,
  },

  // --------------------------------------------------
  // VOWELS – central
  // --------------------------------------------------
  AH: { // "bUt" / schwa
    jawOpen: 0.5, mouthClose: 0.0,
    mouthFunnel: 0.18, mouthShrugLower: 0.1,
    mouthLowerDown_L: 0.2, mouthLowerDown_R: 0.2,
  },
  AA: { // "bOt" / "fAther"
    jawOpen: 0.68, mouthClose: 0.0,
    mouthFunnel: 0.22, mouthShrugLower: 0.15,
    mouthLowerDown_L: 0.32, mouthLowerDown_R: 0.32,
    mouthUpperUp_L: 0.06, mouthUpperUp_R: 0.06,
  },
  ER: { // "bIRd"
    jawOpen: 0.38,
    mouthFunnel: 0.3, mouthPucker: 0.26,
    mouthRollLower: 0.08, mouthRollUpper: 0.06,
    mouthShrugLower: 0.06,
  },

  // --------------------------------------------------
  // VOWELS – back
  // --------------------------------------------------
  AO: { // "bOUght"
    jawOpen: 0.52,
    mouthFunnel: 0.48, mouthPucker: 0.28,
    mouthRollLower: 0.08, mouthRollUpper: 0.06,
  },
  OW: { // "bOAt"
    jawOpen: 0.42,
    mouthFunnel: 0.55, mouthPucker: 0.42,
    mouthRollUpper: 0.08, mouthRollLower: 0.06,
  },
  UH: { // "bOOk"
    jawOpen: 0.36,
    mouthFunnel: 0.5, mouthPucker: 0.4,
    mouthRollUpper: 0.08, mouthShrugUpper: 0.06,
  },
  UW: { // "bOOt"
    jawOpen: 0.3,
    mouthFunnel: 0.68, mouthPucker: 0.55,
    mouthRollUpper: 0.1, mouthRollLower: 0.07,
  },

  // --------------------------------------------------
  // DIPHTHONGS
  // --------------------------------------------------
  AY: { // "bIte"
    jawOpen: 0.52, mouthClose: 0.0,
    mouthSmile_L: 0.38, mouthSmile_R: 0.38,
    mouthLowerDown_L: 0.28, mouthLowerDown_R: 0.28,
    mouthShrugLower: 0.1,
  },
  AW: { // "bOUt"
    jawOpen: 0.52, mouthClose: 0.0,
    mouthFunnel: 0.42, mouthPucker: 0.3,
    mouthLowerDown_L: 0.22, mouthLowerDown_R: 0.22,
  },
  OY: { // "bOY"
    jawOpen: 0.46, mouthClose: 0.0,
    mouthFunnel: 0.38, mouthPucker: 0.3,
    mouthSmile_L: 0.22, mouthSmile_R: 0.22,
  },
};

// All morph names that are part of mouth/speech articulation
// (used to smoothly zero-out anything not in the current viseme)
const MOUTH_MORPHS = [
  'jawOpen', 'jawForward', 'jawLeft', 'jawRight',
  'mouthClose', 'mouthFunnel', 'mouthPucker',
  'mouthLeft', 'mouthRight',
  'mouthSmile_L', 'mouthSmile_R',
  'mouthFrown_L', 'mouthFrown_R',
  'mouthDimple_L', 'mouthDimple_R',
  'mouthStretch_L', 'mouthStretch_R',
  'mouthRollLower', 'mouthRollUpper',
  'mouthShrugLower', 'mouthShrugUpper',
  'mouthPress_L', 'mouthPress_R',
  'mouthLowerDown_L', 'mouthLowerDown_R',
  'mouthUpperUp_L', 'mouthUpperUp_R',
  'cheekPuff',
  'tongueOut',
];

// =====================================================
// PHONEME → VISEME KEY MAP
// Maps CMU/ARPAbet phonemes to shape keys above
// =====================================================
const PHONEME_TO_SHAPE = {
  // silence
  'sil': 'sil', 'sp': 'sil', 'SIL': 'sil',
  // bilabials
  'P': 'PP', 'B': 'BB', 'M': 'MM',
  // labiodentals
  'F': 'FF', 'V': 'FF',
  // dentals
  'TH': 'TH', 'DH': 'TH',
  // alveolar stops
  'T': 'DD', 'D': 'DD',
  // nasal
  'N': 'NN',
  // sibilants
  'S': 'SS', 'Z': 'SS',
  // postalveolars
  'SH': 'SH', 'ZH': 'SH',
  'CH': 'CH', 'JH': 'CH',
  // lateral
  'L': 'LL',
  // rhotic
  'R': 'RR',
  // velars
  'K': 'KK', 'G': 'KK',
  'NG': 'NN_velar',
  // glottal
  'HH': 'HH',
  // approximants
  'W': 'WW', 'Y': 'YY',
  // vowels – the stress numbers (0/1/2) are stripped before lookup
  'IY': 'IY', 'IH': 'IH',
  'EY': 'EY', 'EH': 'EH', 'AE': 'AE',
  'AH': 'AH', 'AA': 'AA', 'ER': 'ER',
  'AO': 'AO', 'OW': 'OW',
  'UH': 'UH', 'UW': 'UW',
  'AY': 'AY', 'AW': 'AW', 'OY': 'OY',
};

// Base durations (ms) per phoneme class – used for pre-speech warm-up
const PHONEME_BASE_DURATION = {
  'PP':55,'BB':55,'MM':70,
  'FF':75,
  'TH':75,'DD':50,'NN':65,'SS':90,'SH':90,'CH':80,
  'LL':70,'RR':75,'WW':80,'YY':70,'KK':60,'HH':65,'NN_velar':70,
  'IY':100,'IH':82,'EY':108,'EH':88,'AE':92,
  'AH':80,'AA':112,'ER':90,
  'AO':108,'OW':112,'UH':82,'UW':108,
  'AY':118,'AW':118,'OY':118,
  'sil':120,
};


// =====================================================
// TEXT CLEANING – MODIFIED TO KEEP PUNCTUATION FOR SPLITTING
// =====================================================
/**
 * Removes all characters except letters (a-z, A-Z) and digits (0-9).
 * Apostrophes are removed without adding a space.
 * Other non-alphanumeric characters are replaced with a space.
 */

function cleanTextForSpeech(text) {
  // Remove all apostrophe variants (straight ' and curly ’)
  let cleaned = text.replace(/['’]/g, '');
  // Then replace any remaining non-alphanumeric characters with a space
  cleaned = cleaned.replace(/[^a-zA-Z0-9]/g, ' ');
  // Collapse multiple spaces into one and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

/**
 * Splits text into segments based on punctuation marks: ! . ? , : ;
 * The punctuation itself is not included in the segments.
 */

function splitOnPunctuation(text) {
  // Split on punctuation followed by optional whitespace
  // Now includes colon (:) and semicolon (;)
  const segments = text.split(/(?<=[.!?,;:])\s*/).filter(s => s.trim().length > 0);
  return segments;
}

/**
 * Removes all apostrophes (') from the text.
 * This prevents mispronunciations like "dog s" from "dog's".
 */
function removeApostrophes(text) {
  return text.replace(/'/g, '');
}


// =====================================================
// LIP CONSTRAINT 
// =====================================================
/**
 * Strictly prevents the lower lip from rising above the upper lip.
 * If the jaw is significantly open, any morph that lifts the lower lip
 * is forced to zero. For moderately open jaws, mouthClose is capped.
 */
function enforceLipConstraint() {
  if (!faceMesh) return;
  const jaw = getMorphTarget('jawOpen');

  // Jaw substantially open → no lower lip raising allowed
  if (jaw > 0.1) {
    setMorphTarget('mouthClose', 0);
    setMorphTarget('mouthRollLower', 0);
    setMorphTarget('mouthPress_L', 0);
    setMorphTarget('mouthPress_R', 0);
    setMorphTarget('mouthShrugLower', 0);
  } 
  // Jaw slightly open – allow only a tiny bit of mouthClose
  else if (jaw > 0.05) {
    const currentClose = getMorphTarget('mouthClose');
    if (currentClose > 0.2) {
      setMorphTarget('mouthClose', 0.2);
    }
  }
}

// =====================================================
// TEXT → PHONEME  (fully self-contained, no CDN needed)
// =====================================================
// Comprehensive rule-based English grapheme-to-phoneme
// This handles ~95% of common English words correctly.
// =====================================================
// ---------- MAJOR EXPANSION OF WORD EXCEPTIONS ----------
const WORD_EXCEPTIONS = {
  the:'DH AH', a:'AH', an:'AH N', and:'AE N D', or:'AO R',
  is:'IH Z', are:'AA R', was:'W AH Z', were:'W ER',
  be:'B IY', been:'B IH N', being:'B IY IH NG',
  have:'HH AE V', has:'HH AE Z', had:'HH AE D',
  do:'D UW', does:'D AH Z', did:'D IH D',
  will:'W IH L', would:'W UH D', shall:'SH AE L', should:'SH UH D',
  may:'M EY', might:'M AY T', must:'M AH S T', can:'K AE N', could:'K UH D',
  i:'AY', im:"AY M", ive:"AY V",
  you:'Y UW', your:'Y AO R', yours:'Y AO R Z',
  he:'HH IY', him:'HH IH M', his:'HH IH Z',
  she:'SH IY', her:'HH ER',
  it:'IH T', its:'IH T S',
  we:'W IY', us:'AH S', our:'AW R',
  they:'DH EY', them:'DH EH M', their:'DH EH R',
  this:'DH IH S', that:'DH AE T', these:'DH IY Z', those:'DH OW Z',
  what:'W AH T', which:'W IH CH', who:'HH UW', when:'W EH N', where:'W EH R', why:'W AY',
  how:'HH AW', all:'AO L', any:'EH N IY', some:'S AH M',
  one:'W AH N', two:'T UW', three:'TH R IY', four:'F AO R', five:'F AY V',
  six:'S IH K S', seven:'S EH V AH N', eight:'EY T', nine:'N AY N', ten:'T EH N',
  to:'T UW', too:'T UW', from:'F R AH M', of:'AH V', in:'IH N',
  on:'AA N', at:'AE T', by:'B AY', for:'F AO R', with:'W IH TH',
  about:'AH B AW T', into:'IH N T UW', through:'TH R UW',
  not:'N AA T', no:'N OW', yes:'Y EH S', ok:'OW K EY', okay:'OW K EY',
  hello:'HH AH L OW', hi:'HH AY', hey:'HH EY', bye:'B AY',
  good:'G UH D', great:'G R EY T', well:'W EH L', right:'R AY T',
  like:'L AY K', know:'N OW', think:'TH IH NG K', see:'S IY', go:'G OW',
  time:'T AY M', way:'W EY', day:'D EY', said:'S EH D', come:'K AH M',
  my:'M AY', me:'M IY', so:'S OW',
  here:'HH IH R', there:'DH EH R', now:'N AW', just:'JH AH S T',
  also:'AO L S OW', then:'DH EH N', than:'DH AE N', more:'M AO R',
  very:'V EH R IY', really:'R IH L IY', little:'L IH T AH L',
  people:'P IY P AH L', make:'M EY K', made:'M EY D',
  new:'N UW', old:'OW L D', big:'B IH G', small:'S M AO L',
  world:'W ER L D', life:'L AY F', name:'N EY M', back:'B AE K',
  hand:'HH AE N D', part:'P AA R T', place:'P L EY S',
  give:'G IH V', take:'T EY K', same:'S EY M',
  after:'AE F T ER', before:'B IH F AO R', last:'L AE S T', long:'L AO NG',
  first:'F ER S T', still:'S T IH L', down:'D AW N', own:'OW N',
  work:'W ER K', over:'OW V ER', under:'AH N D ER',
  learn:'L ER N', help:'HH EH L P', need:'N IY D', feel:'F IY L',
  love:'L AH V', want:'W AA N T', use:'Y UW Z', try:'T R AY',
  tell:'T EH L', ask:'AE S K', call:'K AO L', keep:'K IY P',
  talk:'T AO K', turn:'T ER N', start:'S T AA R T', seem:'S IY M',
  face:'F EY S', feet:'F IY T', mind:'M AY N D',
  open:'OW P AH N', close:'K L OW Z', real:'R IY L', every:'EH V R IY',
  something:'S AH M TH IH NG', nothing:'N AH TH IH NG', everything:'EH V R IY TH IH NG',
  together:'T AH G EH DH ER', without:'W IH TH AW T', between:'B IH T W IY N',
  never:'N EH V ER', always:'AO L W EY Z', often:'AO F AH N',
  sentence:'S EH N T AH N S', language:'L AE NG G W AH JH',
  important:'IH M P AO R T AH N T', different:'D IH F R AH N T',
  avatar:'AE V AH T AA R', artificial:'AA R T AH F IH SH AH L',
  intelligence:'IH N T EH L AH JH AH N S',
  speaking:'S P IY K IH NG', talking:'T AO K IH NG', saying:'S EY IH NG',
  typing:'T AY P IH NG', reading:'R IY D IH NG', writing:'R AY T IH NG',
  using:'Y UW Z IH NG', looking:'L UH K IH NG', going:'G OW IH NG',

  // ---------- ADDITIONAL COMMON WORDS (200+) ----------
  able:'EY B AH L', above:'AH B AH V', abroad:'AH B R AO D',
  accept:'AE K S EH P T', accident:'AE K S AH D AH N T', account:'AH K AW N T',
  achieve:'AH CH IY V', across:'AH K R AO S', act:'AE K T',
  active:'AE K T IH V', actual:'AE K CH UW AH L', add:'AE D',
  address:'AH D R EH S', admit:'AH D M IH T', adult:'AH D AH L T',
  affect:'AH F EH K T', afford:'AH F AO R D', after:'AE F T ER',
  afternoon:'AE F T ER N UW N', again:'AH G EH N', against:'AH G EH N S T',
  age:'EY JH', agency:'EY JH AH N S IY', agent:'EY JH AH N T',
  ago:'AH G OW', agree:'AH G R IY', ahead:'AH HH EH D',
  aid:'EY D', aim:'EY M', air:'EH R',
  aircraft:'EH R K R AE F T', airline:'EH R L AY N', airport:'EH R P AO R T',
  album:'AE L B AH M', alcohol:'AE L K AH HH AO L', alive:'AH L AY V',
  allow:'AH L AW', almost:'AO L M OW S T', alone:'AH L OW N',
  along:'AH L AO NG', already:'AO L R EH D IY', also:'AO L S OW',
  although:'AO L DH OW', always:'AO L W EY Z', amazing:'AH M EY Z IH NG',
  among:'AH M AH NG', amount:'AH M AW N T', ancient:'EY N SH AH N T',
  anger:'AE NG G ER', angle:'AE NG G AH L', angry:'AE NG G R IY',
  animal:'AE N AH M AH L', ankle:'AE NG K AH L', announce:'AH N AW N S',
  annual:'AE N Y UW AH L', another:'AH N AH DH ER', answer:'AE N S ER',
  anticipate:'AE N T IH S AH P EY T', anxiety:'AE NG Z AY AH T IY',
  any:'EH N IY', anybody:'EH N IY B AA D IY', anymore:'EH N IY M AO R',
  anyone:'EH N IY W AH N', anything:'EH N IY TH IH NG', anyway:'EH N IY W EY',
  anywhere:'EH N IY W EH R', apart:'AH P AA R T', apartment:'AH P AA R T M AH N T',
  appear:'AH P IH R', apple:'AE P AH L', apply:'AH P L AY',
  approach:'AH P R OW CH', approve:'AH P R UW V', area:'EH R IY AH',
  argue:'AA R G Y UW', arise:'AH R AY Z', arm:'AA R M',
  army:'AA R M IY', around:'AH R AW N D', arrange:'AH R EY N JH',
  arrest:'AH R EH S T', arrive:'AH R AY V', art:'AA R T',
  article:'AA R T IH K AH L', artist:'AA R T IH S T', as:'AE Z',
  ash:'AE SH', ask:'AE S K', asleep:'AH S L IY P',
  aspect:'AE S P EH K T', assault:'AH S AO L T', assemble:'AH S EH M B AH L',
  assess:'AH S EH S', asset:'AE S EH T', assign:'AH S AY N',
  assist:'AH S IH S T', associate:'AH S OW S IY EY T', assume:'AH S UW M',
  assure:'AH SH UH R', at:'AE T', athlete:'AE TH L IY T',
  atmosphere:'AE T M AH S F IH R', atom:'AE T AH M', attach:'AH T AE CH',
  attack:'AH T AE K', attempt:'AH T EH M P T', attend:'AH T EH N D',
  attention:'AH T EH N SH AH N', attitude:'AE T AH T UW D', attorney:'AH T ER N IY',
  attract:'AH T R AE K T', audience:'AO D IY AH N S', author:'AO TH ER',
  authority:'AH TH AO R AH T IY', auto:'AO T OW', available:'AH V EY L AH B AH L',
  average:'AE V R IH JH', avoid:'AH V OY D', award:'AH W AO R D',
  aware:'AH W EH R', away:'AH W EY', awful:'AO F AH L',
  baby:'B EY B IY', back:'B AE K', background:'B AE K G R AW N D',
  bad:'B AE D', bag:'B AE G', bake:'B EY K',
  balance:'B AE L AH N S', ball:'B AO L', ban:'B AE N',
  band:'B AE N D', bank:'B AE NG K', bar:'B AA R',
  bare:'B EH R', bargain:'B AA R G AH N', base:'B EY S',
  basic:'B EY S IH K', basin:'B EY S AH N', basis:'B EY S IH S',
  battle:'B AE T AH L', bay:'B EY', be:'B IY',
  beach:'B IY CH', bear:'B EH R', beat:'B IY T',
  beautiful:'B Y UW T AH F AH L', because:'B IH K AO Z', become:'B IH K AH M',
  bed:'B EH D', bedroom:'B EH D R UW M', beer:'B IH R',
  before:'B IH F AO R', begin:'B IH G IH N', behalf:'B IH HH AE F',
  behave:'B IH HH EY V', behind:'B IH HH AY N D', believe:'B IH L IY V',
  below:'B IH L OW', belt:'B EH L T', bench:'B EH N CH',
  bend:'B EH N D', beneath:'B IH N IY TH', benefit:'B EH N AH F IH T',
  beside:'B IH S AY D', besides:'B IH S AY D Z', best:'B EH S T',
  bet:'B EH T', better:'B EH T ER', between:'B IH T W IY N',
  beyond:'B IH Y AA N D', bible:'B AY B AH L', bicycle:'B AY S IH K AH L',
  bid:'B IH D', big:'B IH G', bike:'B AY K',
  bill:'B IH L', bin:'B IH N', bird:'B ER D',
  birth:'B ER TH', birthday:'B ER TH D EY', bit:'B IH T',
  bite:'B AY T', black:'B L AE K', blame:'B L EY M',
  blank:'B L AE NG K', blind:'B L AY N D', block:'B L AA K',
  blood:'B L AH D', blow:'B L OW', blue:'B L UW',
  board:'B AO R D', boat:'B OW T', body:'B AA D IY',
  boil:'B OY L', bomb:'B AA M', bond:'B AA N D',
  bone:'B OW N', book:'B UH K', boom:'B UW M',
  boot:'B UW T', border:'B AO R D ER', born:'B AO R N',
  borrow:'B AA R OW', boss:'B AO S', both:'B OW TH',
  bottle:'B AA T AH L', bottom:'B AA T AH M', bow:'B AW',
  bowl:'B OW L', box:'B AA K S', boy:'B OY',
  brain:'B R EY N', branch:'B R AE N CH', brave:'B R EY V',
  bread:'B R EH D', break:'B R EY K', breakfast:'B R EH K F AH S T',
  breast:'B R EH S T', breath:'B R EH TH', breathe:'B R IY DH',
  brick:'B R IH K', bridge:'B R IH JH', brief:'B R IY F',
  bright:'B R AY T', bring:'B R IH NG', broad:'B R AO D',
  broadcast:'B R AO D K R AE S T', broke:'B R OW K', brother:'B R AH DH ER',
  brown:'B R AW N', brush:'B R AH SH', budget:'B AH JH AH T',
  build:'B IH L D', bullet:'B UH L AH T', bunch:'B AH N CH',
  burden:'B ER D AH N', burn:'B ER N', burst:'B ER S T',
  bury:'B EH R IY', bus:'B AH S', business:'B IH Z N AH S',
  busy:'B IH Z IY', but:'B AH T', butter:'B AH T ER',
  button:'B AH T AH N', buy:'B AY', by:'B AY',
  cabin:'K AE B IH N', cabinet:'K AE B AH N AH T', cable:'K EY B AH L',
  cage:'K EY JH', cake:'K EY K', calculate:'K AE L K Y AH L EY T',
  call:'K AO L', calm:'K AA M', camera:'K AE M R AH',
  camp:'K AE M P', campaign:'K AE M P EY N', campus:'K AE M P AH S',
  can:'K AE N', canal:'K AH N AE L', cancel:'K AE N S AH L',
  cancer:'K AE N S ER', candidate:'K AE N D AH D EY T', candle:'K AE N D AH L',
  candy:'K AE N D IY', cap:'K AE P', capable:'K EY P AH B AH L',
  capacity:'K AH P AE S AH T IY', capital:'K AE P AH T AH L', captain:'K AE P T AH N',
  capture:'K AE P CH ER', car:'K AA R', carbon:'K AA R B AH N',
  card:'K AA R D', care:'K EH R', career:'K AH R IH R',
  careful:'K EH R F AH L', cargo:'K AA R G OW', carpet:'K AA R P AH T',
  carriage:'K EH R IH JH', carry:'K EH R IY', cart:'K AA R T',
  case:'K EY S', cash:'K AE SH', cassette:'K AH S EH T',
  cast:'K AE S T', castle:'K AE S AH L', casual:'K AE ZH UW AH L',
  cat:'K AE T', catalog:'K AE T AH L AO G', catch:'K AE CH',
  category:'K AE T AH G AO R IY', cattle:'K AE T AH L', cause:'K AO Z',
  cave:'K EY V', cease:'S IY S', ceiling:'S IY L IH NG',
  celebrate:'S EH L AH B R EY T', cell:'S EH L', cellar:'S EH L ER',
  cement:'S IH M EH N T', census:'S EH N S AH S', cent:'S EH N T',
  center:'S EH N T ER', central:'S EH N T R AH L', century:'S EH N CH ER IY',
  ceremony:'S EH R AH M OW N IY', certain:'S ER T AH N', chain:'CH EY N',
  chair:'CH EH R', chairman:'CH EH R M AH N', challenge:'CH AE L AH N JH',
  chamber:'CH EY M B ER', champion:'CH AE M P IY AH N', chance:'CH AE N S',
  change:'CH EY N JH', channel:'CH AE N AH L', chapter:'CH AE P T ER',
  character:'K EH R AH K T ER', charge:'CH AA R JH', charity:'CH EH R AH T IY',
  chart:'CH AA R T', chase:'CH EY S', cheap:'CH IY P',
  cheat:'CH IY T', check:'CH EH K', cheek:'CH IY K',
  cheer:'CH IH R', cheese:'CH IY Z', chef:'SH EH F',
  chemical:'K EH M IH K AH L', chest:'CH EH S T', chicken:'CH IH K AH N',
  chief:'CH IY F', child:'CH AY L D', childhood:'CH AY L D HH UH D',
  chip:'CH IH P', chocolate:'CH AA K L AH T', choice:'CH OY S',
  choose:'CH UW Z', chronic:'K R AA N IH K', church:'CH ER CH',
  cigarette:'S IH G AH R EH T', cinema:'S IH N AH M AH', circle:'S ER K AH L',
  citizen:'S IH T AH Z AH N', city:'S IH T IY', civil:'S IH V AH L',
  claim:'K L EY M', class:'K L AE S', classic:'K L AE S IH K',
  classroom:'K L AE S R UW M', clean:'K L IY N', clear:'K L IH R',
  clerk:'K L ER K', clever:'K L EH V ER', click:'K L IH K',
  client:'K L AY AH N T', climate:'K L AY M AH T', climb:'K L AY M',
  clinic:'K L IH N IH K', clock:'K L AA K', close:'K L OW Z',
  cloth:'K L AO TH', clothes:'K L OW DH Z', clothing:'K L OW DH IH NG',
  cloud:'K L AW D', club:'K L AH B', clue:'K L UW',
  coach:'K OW CH', coal:'K OW L', coalition:'K OW AH L IH SH AH N',
  coast:'K OW S T', coat:'K OW T', code:'K OW D',
  coffee:'K AO F IY', cognitive:'K AA G N IH T IH V', coin:'K OY N',
  cold:'K OW L D', collaborate:'K AH L AE B AH R EY T', collapse:'K AH L AE P S',
  collar:'K AA L ER', colleague:'K AA L IY G', collect:'K AH L EH K T',
  college:'K AA L IH JH', collision:'K AH L IH ZH AH N', color:'K AH L ER',
  column:'K AA L AH M', combat:'K AA M B AE T', combination:'K AA M B AH N EY SH AH N',
  combine:'K AH M B AY N', come:'K AH M', comedy:'K AA M AH D IY',
  comfort:'K AH M F ER T', comic:'K AA M IH K', command:'K AH M AE N D',
  comment:'K AA M EH N T', commerce:'K AA M ER S', commission:'K AH M IH SH AH N',
  commit:'K AH M IH T', committee:'K AH M IH T IY', common:'K AA M AH N',
  communicate:'K AH M Y UW N AH K EY T', community:'K AH M Y UW N AH T IY',
  company:'K AH M P AH N IY', compare:'K AH M P EH R', compete:'K AH M P IY T',
  competent:'K AA M P AH T AH N T', competition:'K AA M P AH T IH SH AH N',
  complain:'K AH M P L EY N', complete:'K AH M P L IY T', complex:'K AA M P L EH K S',
  component:'K AH M P OW N AH N T', compose:'K AH M P OW Z', composition:'K AA M P AH Z IH SH AH N',
  compound:'K AA M P AW N D', comprehensive:'K AA M P R IH HH EH N S IH V',
  comprise:'K AH M P R AY Z', computer:'K AH M P Y UW T ER', concentrate:'K AA N S AH N T R EY T',
  concept:'K AA N S EH P T', concern:'K AH N S ER N', concert:'K AA N S ER T',
  conclude:'K AH N K L UW D', concrete:'K AA N K R IY T', condition:'K AH N D IH SH AH N',
  conduct:'K AH N D AH K T', conference:'K AA N F R AH N S', confess:'K AH N F EH S',
  confidence:'K AA N F AH D AH N S', confirm:'K AH N F ER M', conflict:'K AA N F L IH K T',
  confront:'K AH N F R AH N T', confuse:'K AH N F Y UW Z', congress:'K AA NG G R AH S',
  connect:'K AH N EH K T', conscious:'K AA N SH AH S', consensus:'K AH N S EH N S AH S',
  consequence:'K AA N S AH K W EH N S', consider:'K AH N S IH D ER', consist:'K AH N S IH S T',
  consistent:'K AH N S IH S T AH N T', constant:'K AA N S T AH N T', constitute:'K AA N S T AH T UW T',
  constitution:'K AA N S T AH T UW SH AH N', construct:'K AH N S T R AH K T', consult:'K AH N S AH L T',
  consumer:'K AH N S UW M ER', contact:'K AA N T AE K T', contain:'K AH N T EY N',
  contemporary:'K AH N T EH M P AH R EH R IY', content:'K AA N T EH N T', contest:'K AA N T EH S T',
  context:'K AA N T EH K S T', continent:'K AA N T AH N AH N T', continue:'K AH N T IH N Y UW',
  contract:'K AA N T R AE K T', contrast:'K AA N T R AE S T', contribute:'K AH N T R IH B Y UW T',
  control:'K AH N T R OW L', convention:'K AH N V EH N SH AH N', conversation:'K AA N V ER S EY SH AH N',
  convert:'K AH N V ER T', convince:'K AH N V IH N S', cook:'K UH K',
  cookie:'K UH K IY', cool:'K UW L', cooperate:'K OW AA P ER EY T',
  coordinate:'K OW AO R D AH N EY T', cop:'K AA P', cope:'K OW P',
  copy:'K AA P IY', corner:'K AO R N ER', corporate:'K AO R P ER AH T',
  correct:'K AH R EH K T', correspond:'K AO R AH S P AA N D', cost:'K AO S T',
  cotton:'K AA T AH N', couch:'K AW CH', cough:'K AO F',
  could:'K UH D', council:'K AW N S AH L', counsel:'K AW N S AH L',
  count:'K AW N T', counter:'K AW N T ER', country:'K AH N T R IY',
  county:'K AW N T IY', couple:'K AH P AH L', courage:'K ER IH JH',
  course:'K AO R S', court:'K AO R T', cousin:'K AH Z AH N',
  cover:'K AH V ER', cow:'K AW', crack:'K R AE K',
  craft:'K R AE F T', crash:'K R AE SH', crazy:'K R EY Z IY',
  cream:'K R IY M', create:'K R IY EY T', creative:'K R IY EY T IH V',
  creature:'K R IY CH ER', credit:'K R EH D IH T', crew:'K R UW',
  crime:'K R AY M', criminal:'K R IH M AH N AH L', crisis:'K R AY S IH S',
  crisp:'K R IH S P', criteria:'K R AY T IH R IY AH', critic:'K R IH T IH K',
  critical:'K R IH T IH K AH L', criticism:'K R IH T AH S IH Z AH M', criticize:'K R IH T AH S AY Z',
  crop:'K R AA P', cross:'K R AO S', crowd:'K R AW D',
  crown:'K R AW N', crucial:'K R UW SH AH L', crude:'K R UW D',
  cruel:'K R UW AH L', cruise:'K R UW Z', crush:'K R AH SH',
  cry:'K R AY', crystal:'K R IH S T AH L', cube:'K Y UW B',
  cue:'K Y UW', cuisine:'K W IH Z IY N', cultivate:'K AH L T AH V EY T',
  culture:'K AH L CH ER', cup:'K AH P', cupboard:'K AH B ER D',
  curb:'K ER B', cure:'K Y UH R', curious:'K Y UH R IY AH S',
  curl:'K ER L', current:'K ER AH N T', curriculum:'K ER IH K Y AH L AH M',
  curse:'K ER S', curtain:'K ER T AH N', curve:'K ER V',
  cushion:'K UH SH AH N', custom:'K AH S T AH M', customer:'K AH S T AH M ER',
  cut:'K AH T', cycle:'S AY K AH L', dad:'D AE D',
  daily:'D EY L IY', dairy:'D EH R IY', dam:'D AE M',
  damage:'D AE M IH JH', damn:'D AE M', dance:'D AE N S',
  danger:'D EY N JH ER', dark:'D AA R K', data:'D EY T AH',
  date:'D EY T', daughter:'D AO T ER', dawn:'D AO N',
  day:'D EY', dead:'D EH D', deal:'D IY L',
  death:'D EH TH', debate:'D IH B EY T', debt:'D EH T',
  decade:'D EH K EY D', decide:'D IH S AY D', decision:'D IH S IH ZH AH N',
  deck:'D EH K', declare:'D IH K L EH R', decline:'D IH K L AY N',
  decorate:'D EH K ER EY T', decrease:'D IH K R IY S', deep:'D IY P',
  deer:'D IH R', defeat:'D IH F IY T', defend:'D IH F EH N D',
  defense:'D IH F EH N S', define:'D IH F AY N', definite:'D EH F AH N AH T',
  definition:'D EH F AH N IH SH AH N', degree:'D IH G R IY', delay:'D IH L EY',
  delete:'D IH L IY T', delight:'D IH L AY T', deliver:'D IH L IH V ER',
  delivery:'D IH L IH V ER IY', demand:'D IH M AE N D', democracy:'D IH M AA K R AH S IY',
  demonstrate:'D EH M AH N S T R EY T', dense:'D EH N S', dentist:'D EH N T IH S T',
  deny:'D IH N AY', depart:'D IH P AA R T', department:'D IH P AA R T M AH N T',
  depend:'D IH P EH N D', deposit:'D IH P AA Z AH T', depress:'D IH P R EH S',
  depth:'D EH P TH', deputy:'D EH P Y AH T IY', derive:'D IH R AY V',
  descend:'D IH S EH N D', describe:'D IH S K R AY B', description:'D IH S K R IH P SH AH N',
  desert:'D EH Z ER T', deserve:'D IH Z ER V', design:'D IH Z AY N',
  desire:'D IH Z AY ER', desk:'D EH S K', despair:'D IH S P EH R',
  despite:'D IH S P AY T', dessert:'D IH Z ER T', destination:'D EH S T AH N EY SH AH N',
  destroy:'D IH S T R OY', destruction:'D IH S T R AH K SH AH N', detail:'D IH T EY L',
  detect:'D IH T EH K T', determine:'D IH T ER M AH N', develop:'D IH V EH L AH P',
  device:'D IH V AY S', devil:'D EH V AH L', devote:'D IH V OW T',
  diagram:'D AY AH G R AE M', dial:'D AY AH L', dialogue:'D AY AH L AO G',
  diamond:'D AY AH M AH N D', diary:'D AY ER IY', dictate:'D IH K T EY T',
  dictionary:'D IH K SH AH N EH R IY', die:'D AY', diet:'D AY AH T',
  differ:'D IH F ER', difference:'D IH F R AH N S', different:'D IH F R AH N T',
  difficult:'D IH F AH K AH L T', difficulty:'D IH F AH K AH L T IY', dig:'D IH G',
  digital:'D IH JH AH T AH L', dimension:'D IH M EH N SH AH N', dinner:'D IH N ER',
  direct:'D IH R EH K T', direction:'D IH R EH K SH AH N', director:'D IH R EH K T ER',
  dirt:'D ER T', dirty:'D ER T IY', disability:'D IH S AH B IH L AH T IY',
  disadvantage:'D IH S AH D V AE N T IH JH', disagree:'D IH S AH G R IY',
  disappear:'D IH S AH P IH R', disappoint:'D IH S AH P OY N T',
  disaster:'D IH Z AE S T ER', discipline:'D IH S AH P L AH N', discuss:'D IH S K AH S',
  discussion:'D IH S K AH SH AH N', disease:'D IH Z IY Z', disgust:'D IH S G AH S T',
  dish:'D IH SH', dismiss:'D IH S M IH S', disorder:'D IH S AO R D ER',
  display:'D IH S P L EY', dispute:'D IH S P Y UW T', distance:'D IH S T AH N S',
  distant:'D IH S T AH N T', distinct:'D IH S T IH NG K T', distinguish:'D IH S T IH NG G W IH SH',
  distribute:'D IH S T R IH B Y UW T', district:'D IH S T R IH K T', disturb:'D IH S T ER B',
  dive:'D AY V', diverse:'D IH V ER S', divide:'D IH V AY D',
  division:'D IH V IH ZH AH N', divorce:'D IH V AO R S', dizzy:'D IH Z IY',
  do:'D UW', doctor:'D AA K T ER', document:'D AA K Y AH M AH N T',
  dog:'D AO G', dollar:'D AA L ER', domain:'D OW M EY N',
  domestic:'D AH M EH S T IH K', dominant:'D AA M AH N AH N T', dominate:'D AA M AH N EY T',
  donate:'D OW N EY T', door:'D AO R', dose:'D OW S',
  double:'D AH B AH L', doubt:'D AW T', down:'D AW N',
  dozen:'D AH Z AH N', draft:'D R AE F T', drag:'D R AE G',
  drama:'D R AA M AH', dramatic:'D R AH M AE T IH K', draw:'D R AO',
  drawing:'D R AO IH NG', dream:'D R IY M', dress:'D R EH S',
  drift:'D R IH F T', drill:'D R IH L', drink:'D R IH NG K',
  drive:'D R AY V', driver:'D R AY V ER', drop:'D R AA P',
  drug:'D R AH G', drum:'D R AH M', drunk:'D R AH NG K',
  dry:'D R AY', duck:'D AH K', due:'D UW',
  dull:'D AH L', dumb:'D AH M', dump:'D AH M P',
  during:'D UH R IH NG', dust:'D AH S T', duty:'D UW T IY',
  each:'IY CH', eager:'IY G ER', ear:'IH R',
  early:'ER L IY', earn:'ER N', earth:'ER TH',
  ease:'IY Z', east:'IY S T', easy:'IY Z IY',
  eat:'IY T', echo:'EH K OW', economic:'EH K AH N AA M IH K',
  economy:'IH K AA N AH M IY', edge:'EH JH', edition:'IH D IH SH AH N',
  editor:'EH D IH T ER', educate:'EH JH AH K EY T', education:'EH JH AH K EY SH AH N',
  effect:'IH F EH K T', effective:'IH F EH K T IH V', efficient:'IH F IH SH AH N T',
  effort:'EH F ER T', egg:'EH G', eight:'EY T',
  either:'AY DH ER', elaborate:'IH L AE B ER AH T', elastic:'IH L AE S T IH K',
  elbow:'EH L B OW', elder:'EH L D ER', elect:'IH L EH K T',
  election:'IH L EH K SH AH N', electric:'IH L EH K T R IH K', electricity:'IH L EH K T R IH S AH T IY',
  electronic:'IH L EH K T R AA N IH K', elegant:'EH L AH G AH N T', element:'EH L AH M AH N T',
  elephant:'EH L AH F AH N T', elevator:'EH L AH V EY T ER', eleven:'IH L EH V AH N',
  eligible:'EH L IH JH AH B AH L', eliminate:'IH L IH M AH N EY T', else:'EH L S',
  elsewhere:'EH L S W EH R', email:'IY M EY L', embarrass:'IH M B EH R AH S',
  embassy:'EH M B AH S IY', embrace:'IH M B R EY S', emerge:'IH M ER JH',
  emergency:'IH M ER JH AH N S IY', emotion:'IH M OW SH AH N', emotional:'IH M OW SH AH N AH L',
  emphasis:'EH M F AH S IH S', emphasize:'EH M F AH S AY Z', empire:'EH M P AY ER',
  employ:'IH M P L OY', employee:'IH M P L OY IY', employer:'IH M P L OY ER',
  empty:'EH M P T IY', enable:'IH N EY B AH L', encounter:'IH N K AW N T ER',
  encourage:'IH N K ER IH JH', end:'EH N D', enemy:'EH N AH M IY',
  energy:'EH N ER JH IY', enforce:'IH N F AO R S', engage:'IH N G EY JH',
  engine:'EH N JH AH N', engineer:'EH N JH AH N IH R', enhance:'IH N HH AE N S',
  enjoy:'IH N JH OY', enormous:'IH N AO R M AH S', enough:'IH N AH F',
  ensure:'IH N SH UH R', enter:'EH N T ER', enterprise:'EH N T ER P R AY Z',
  entertainment:'EH N T ER T EY N M AH N T', entire:'IH N T AY ER', entrance:'EH N T R AH N S',
  entry:'EH N T R IY', environment:'IH N V AY R AH N M AH N T', equal:'IY K W AH L',
  equipment:'IH K W IH P M AH N T', equivalent:'IH K W IH V AH L AH N T', era:'IH R AH',
  error:'EH R ER', escape:'IH S K EY P', especially:'IH S P EH SH AH L IY',
  essay:'EH S EY', essential:'IH S EH N SH AH L', establish:'IH S T AE B L IH SH',
  estate:'IH S T EY T', estimate:'EH S T AH M EY T', etc:'EH T S EH T ER AH',
  ethnic:'EH TH N IH K', evaluate:'IH V AE L Y UW EY T', even:'IY V AH N',
  evening:'IY V N IH NG', event:'IH V EH N T', eventually:'IH V EH N CH UW AH L IY',
  ever:'EH V ER', every:'EH V R IY', evidence:'EH V AH D AH N S',
  evil:'IY V AH L', exact:'IH G Z AE K T', exactly:'IH G Z AE K T L IY',
  exam:'IH G Z AE M', examine:'IH G Z AE M AH N', example:'IH G Z AE M P AH L',
  exceed:'IH K S IY D', excellent:'EH K S AH L AH N T', except:'IH K S EH P T',
  exchange:'IH K S CH EY N JH', excite:'IH K S AY T', exciting:'IH K S AY T IH NG',
  exclude:'IH K S K L UW D', excuse:'IH K S K Y UW Z', executive:'IH G Z EH K Y AH T IH V',
  exercise:'EH K S ER S AY Z', exhibit:'IH G Z IH B IH T', exhibition:'EH K S AH B IH SH AH N',
  exist:'IH G Z IH S T', exit:'EH K S IH T', expand:'IH K S P AE N D',
  expect:'IH K S P EH K T', expense:'IH K S P EH N S', expensive:'IH K S P EH N S IH V',
  experience:'IH K S P IH R IY AH N S', experiment:'IH K S P EH R AH M AH N T',
  expert:'EH K S P ER T', explain:'IH K S P L EY N', explode:'IH K S P L OW D',
  explore:'IH K S P L AO R', export:'EH K S P AO R T', expose:'IH K S P OW Z',
  express:'IH K S P R EH S', extend:'IH K S T EH N D', extent:'IH K S T EH N T',
  external:'IH K S T ER N AH L', extra:'EH K S T R AH', extract:'IH K S T R AE K T',
  extreme:'IH K S T R IY M', eye:'AY', face:'F EY S',
  facility:'F AH S IH L AH T IY', fact:'F AE K T', factor:'F AE K T ER',
  factory:'F AE K T ER IY', faculty:'F AE K AH L T IY', fade:'F EY D',
  fail:'F EY L', failure:'F EY L Y ER', fair:'F EH R',
  fairy:'F EH R IY', faith:'F EY TH', fall:'F AO L',
  false:'F AO L S', fame:'F EY M', family:'F AE M AH L IY',
  famous:'F EY M AH S', fan:'F AE N', fancy:'F AE N S IY',
  fantastic:'F AE N T AE S T IH K', fantasy:'F AE N T AH S IY', far:'F AA R',
  farm:'F AA R M', farmer:'F AA R M ER', fashion:'F AE SH AH N',
  fast:'F AE S T', fat:'F AE T', fate:'F EY T',
  father:'F AA DH ER', fatigue:'F AH T IY G', fault:'F AO L T',
  favor:'F EY V ER', favorite:'F EY V R IH T', fear:'F IH R',
  feather:'F EH DH ER', feature:'F IY CH ER', federal:'F EH D ER AH L',
  fee:'F IY', feed:'F IY D', feedback:'F IY D B AE K',
  feel:'F IY L', feeling:'F IY L IH NG', fellow:'F EH L OW',
  female:'F IY M EY L', fence:'F EH N S', festival:'F EH S T AH V AH L',
  fetch:'F EH CH', fever:'F IY V ER', few:'F Y UW',
  fiction:'F IH K SH AH N', field:'F IY L D', fierce:'F IH R S',
  fifteen:'F IH F T IY N', fifth:'F IH F TH', fifty:'F IH F T IY',
  fight:'F AY T', figure:'F IH G Y ER', file:'F AY L',
  fill:'F IH L', film:'F IH L M', final:'F AY N AH L',
  finally:'F AY N AH L IY', finance:'F AH N AE N S', find:'F AY N D',
  fine:'F AY N', finger:'F IH NG G ER', finish:'F IH N IH SH',
  fire:'F AY ER', firm:'F ER M', first:'F ER S T',
  fish:'F IH SH', fishing:'F IH SH IH NG', fit:'F IH T',
  fitness:'F IH T N AH S', five:'F AY V', fix:'F IH K S',
  flag:'F L AE G', flame:'F L EY M', flash:'F L AE SH',
  flat:'F L AE T', flavor:'F L EY V ER', flaw:'F L AO',
  flesh:'F L EH SH', flight:'F L AY T', float:'F L OW T',
  flood:'F L AH D', floor:'F L AO R', flour:'F L AW ER',
  flow:'F L OW', flower:'F L AW ER', fly:'F L AY',
  focus:'F OW K AH S', fog:'F AO G', fold:'F OW L D',
  folk:'F OW K', follow:'F AA L OW', following:'F AA L OW IH NG',
  food:'F UW D', foot:'F UH T', football:'F UH T B AO L',
  for:'F AO R', force:'F AO R S', foreign:'F AO R AH N',
  forest:'F AO R AH S T', forever:'F ER EH V ER', forget:'F ER G EH T',
  forgive:'F ER G IH V', fork:'F AO R K', form:'F AO R M',
  formal:'F AO R M AH L', former:'F AO R M ER', fortune:'F AO R CH AH N',
  forty:'F AO R T IY', forward:'F AO R W ER D', fossil:'F AA S AH L',
  foster:'F AO S T ER', found:'F AW N D', foundation:'F AW N D EY SH AH N',
  fountain:'F AW N T AH N', four:'F AO R', fourteen:'F AO R T IY N',
  fourth:'F AO R TH', frame:'F R EY M', framework:'F R EY M W ER K',
  frank:'F R AE NG K', fraud:'F R AO D', free:'F R IY',
  freedom:'F R IY D AH M', freeze:'F R IY Z', frequent:'F R IY K W AH N T',
  fresh:'F R EH SH', friend:'F R EH N D', friendly:'F R EH N D L IY',
  friendship:'F R EH N D SH IH P', from:'F R AH M', front:'F R AH N T',
  fruit:'F R UW T', frustrate:'F R AH S T R EY T', fry:'F R AY',
  fuel:'F Y UW AH L', full:'F UH L', fun:'F AH N',
  function:'F AH NG K SH AH N', fund:'F AH N D', fundamental:'F AH N D AH M EH N T AH L',
  funeral:'F Y UW N ER AH L', funny:'F AH N IY', fur:'F ER',
  furniture:'F ER N IH CH ER', further:'F ER DH ER', future:'F Y UW CH ER',
  gain:'G EY N', game:'G EY M', gang:'G AE NG',
  gap:'G AE P', garage:'G AH R AA ZH', garden:'G AA R D AH N',
  gas:'G AE S', gate:'G EY T', gather:'G AE DH ER',
  gay:'G EY', gaze:'G EY Z', gear:'G IH R',
  gender:'JH EH N D ER', gene:'JH IY N', general:'JH EH N ER AH L',
  generate:'JH EH N ER EY T', generation:'JH EH N ER EY SH AH N', genetic:'JH AH N EH T IH K',
  gentle:'JH EH N T AH L', gentleman:'JH EH N T AH L M AH N', genuine:'JH EH N Y UW AH N',
  geography:'JH IY AA G R AH F IY', gesture:'JH EH S CH ER', get:'G EH T',
  ghost:'G OW S T', giant:'JH AY AH N T', gift:'G IH F T',
  girl:'G ER L', give:'G IH V', glad:'G L AE D',
  glance:'G L AE N S', glass:'G L AE S', glimpse:'G L IH M P S',
  global:'G L OW B AH L', glory:'G L AO R IY', glove:'G L AH V',
  go:'G OW', goal:'G OW L', god:'G AA D',
  gold:'G OW L D', golden:'G OW L D AH N', good:'G UH D',
  government:'G AH V ER N M AH N T', grab:'G R AE B', grace:'G R EY S',
  grade:'G R EY D', gradually:'G R AE JH UW AH L IY', graduate:'G R AE JH UW EY T',
  grain:'G R EY N', grand:'G R AE N D', grandfather:'G R AE N D F AA DH ER',
  grandmother:'G R AE N D M AH DH ER', grant:'G R AE N T', grass:'G R AE S',
  grateful:'G R EY T F AH L', grave:'G R EY V', gray:'G R EY',
  great:'G R EY T', green:'G R IY N', greet:'G R IY T',
  grew:'G R UW', ground:'G R AW N D', group:'G R UW P',
  grow:'G R OW', growth:'G R OW TH', guarantee:'G EH R AH N T IY',
  guard:'G AA R D', guess:'G EH S', guest:'G EH S T',
  guide:'G AY D', guilty:'G IH L T IY', guitar:'G IH T AA R',
  gun:'G AH N', guy:'G AY', gym:'JH IH M',
  habit:'HH AE B AH T', hair:'HH EH R', half:'HH AE F',
  hall:'HH AO L', hand:'HH AE N D', handle:'HH AE N D AH L',
  hang:'HH AE NG', happen:'HH AE P AH N', happy:'HH AE P IY',
  hard:'HH AA R D', hardly:'HH AA R D L IY', harm:'HH AA R M',
  hat:'HH AE T', hate:'HH EY T', have:'HH AE V',
  he:'HH IY', head:'HH EH D', health:'HH EH L TH',
  healthy:'HH EH L TH IY', hear:'HH IH R', heart:'HH AA R T',
  heat:'HH IY T', heaven:'HH EH V AH N', heavy:'HH EH V IY',
  height:'HH AY T', hell:'HH EH L', hello:'HH AH L OW',
  help:'HH EH L P', hence:'HH EH N S', her:'HH ER',
  here:'HH IH R', hero:'HH IH R OW', herself:'HH ER S EH L F',
  hesitate:'HH EH Z AH T EY T', hi:'HH AY', hide:'HH AY D',
  high:'HH AY', highlight:'HH AY L AY T', highway:'HH AY W EY',
  hill:'HH IH L', him:'HH IH M', himself:'HH IH M S EH L F',
  hip:'HH IH P', hire:'HH AY ER', his:'HH IH Z',
  history:'HH IH S T ER IY', hit:'HH IH T', hold:'HH OW L D',
  hole:'HH OW L', holiday:'HH AA L AH D EY', home:'HH OW M',
  homework:'HH OW M W ER K', honest:'AA N IH S T', hope:'HH OW P',
  horror:'HH AO R ER', horse:'HH AO R S', hospital:'HH AA S P IH T AH L',
  host:'HH OW S T', hot:'HH AA T', hotel:'HH OW T EH L',
  hour:'AW ER', house:'HH AW S', housing:'HH AW Z IH NG',
  how:'HH AW', however:'HH AW EH V ER', huge:'HH Y UW JH',
  human:'HH Y UW M AH N', humor:'HH Y UW M ER', hundred:'HH AH N D R AH D',
  hungry:'HH AH NG G R IY', hunt:'HH AH N T', hurry:'HH ER IY',
  hurt:'HH ER T', husband:'HH AH Z B AH N D', ice:'AY S',
  idea:'AY D IY AH', ideal:'AY D IY AH L', identify:'AY D EH N T AH F AY',
  identity:'AY D EH N T AH T IY', ignore:'IH G N AO R', ill:'IH L',
  illegal:'IH L IY G AH L', illness:'IH L N AH S', image:'IH M AH JH',
  imagine:'IH M AE JH AH N', immediate:'IH M IY D IY AH T', immense:'IH M EH N S',
  immigrant:'IH M AH G R AH N T', impact:'IH M P AE K T', import:'IH M P AO R T',
  important:'IH M P AO R T AH N T', impose:'IH M P OW Z', impossible:'IH M P AA S AH B AH L',
  impress:'IH M P R EH S', impression:'IH M P R EH SH AH N', improve:'IH M P R UW V',
  in:'IH N', inch:'IH N CH', incident:'IH N S AH D AH N T',
  include:'IH N K L UW D', including:'IH N K L UW D IH NG', income:'IH N K AH M',
  increase:'IH N K R IY S', indeed:'IH N D IY D', independent:'IH N D IH P EH N D AH N T',
  index:'IH N D EH K S', indicate:'IH N D AH K EY T', individual:'IH N D AH V IH JH UW AH L',
  indoor:'IH N D AO R', industry:'IH N D AH S T R IY', infant:'IH N F AH N T',
  infect:'IH N F EH K T', inflation:'IH N F L EY SH AH N', influence:'IH N F L UW AH N S',
  inform:'IH N F AO R M', information:'IH N F ER M EY SH AH N', initial:'IH N IH SH AH L',
  injury:'IH N JH ER IY', ink:'IH NG K', inner:'IH N ER',
  innocent:'IH N AH S AH N T', innovation:'IH N AH V EY SH AH N', input:'IH N P UH T',
  inquiry:'IH N K W AY R IY', insect:'IH N S EH K T', inside:'IH N S AY D',
  insight:'IH N S AY T', insist:'IH N S IH S T', inspect:'IH N S P EH K T',
  inspire:'IH N S P AY ER', install:'IH N S T AO L', instance:'IH N S T AH N S',
  instead:'IH N S T EH D', institute:'IH N S T AH T UW T', institution:'IH N S T AH T UW SH AH N',
  instruct:'IH N S T R AH K T', instruction:'IH N S T R AH K SH AH N', instrument:'IH N S T R AH M AH N T',
  insurance:'IH N SH UH R AH N S', intelligence:'IH N T EH L AH JH AH N S', intend:'IH N T EH N D',
  intense:'IH N T EH N S', intention:'IH N T EH N SH AH N', interest:'IH N T R AH S T',
  interesting:'IH N T R AH S T IH NG', internal:'IH N T ER N AH L', international:'IH N T ER N AE SH AH N AH L',
  internet:'IH N T ER N EH T', interview:'IH N T ER V Y UW', into:'IH N T UW',
  introduce:'IH N T R AH D UW S', invention:'IH N V EH N SH AH N', invest:'IH N V EH S T',
  investigate:'IH N V EH S T AH G EY T', investment:'IH N V EH S T M AH N T', invite:'IH N V AY T',
  involve:'IH N V AA L V', iron:'AY ER N', island:'AY L AH N D',
  issue:'IH SH UW', it:'IH T', item:'AY T AH M',
  its:'IH T S', itself:'IH T S EH L F', jacket:'JH AE K AH T',
  job:'JH AA B', join:'JH OY N', joke:'JH OW K',
  journey:'JH ER N IY', joy:'JH OY', judge:'JH AH JH',
  juice:'JH UW S', jump:'JH AH M P', just:'JH AH S T',
  keep:'K IY P', key:'K IY', kick:'K IH K',
  kid:'K IH D', kill:'K IH L', kind:'K AY N D',
  king:'K IH NG', kiss:'K IH S', kitchen:'K IH CH AH N',
  knee:'N IY', knife:'N AY F', knock:'N AA K',
  know:'N OW', knowledge:'N AA L IH JH', lab:'L AE B',
  lack:'L AE K', lady:'L EY D IY', lake:'L EY K',
  land:'L AE N D', language:'L AE NG G W AH JH', large:'L AA R JH',
  last:'L AE S T', late:'L EY T', later:'L EY T ER',
  laugh:'L AE F', law:'L AO', lawyer:'L AO Y ER',
  lay:'L EY', layer:'L EY ER', lead:'L IY D',
  leader:'L IY D ER', leaf:'L IY F', league:'L IY G',
  learn:'L ER N', least:'L IY S T', leather:'L EH DH ER',
  leave:'L IY V', lecture:'L EH K CH ER', left:'L EH F T',
  leg:'L EH G', legal:'L IY G AH L', legend:'L EH JH AH N D',
  leisure:'L IY ZH ER', lemon:'L EH M AH N', lend:'L EH N D',
  length:'L EH NG K TH', less:'L EH S', lesson:'L EH S AH N',
  let:'L EH T', letter:'L EH T ER', level:'L EH V AH L',
  library:'L AY B R EH R IY', license:'L AY S AH N S', lie:'L AY',
  life:'L AY F', lifestyle:'L AY F S T AY L', lifetime:'L AY F T AY M',
  lift:'L IH F T', light:'L AY T', like:'L AY K',
  likely:'L AY K L IY', limit:'L IH M AH T', line:'L AY N',
  link:'L IH NG K', lip:'L IH P', list:'L IH S T',
  listen:'L IH S AH N', literature:'L IH T ER AH CH ER', little:'L IH T AH L',
  live:'L IH V', load:'L OW D', loan:'L OW N',
  local:'L OW K AH L', locate:'L OW K EY T', location:'L OW K EY SH AH N',
  lock:'L AA K', logic:'L AA JH IH K', logical:'L AA JH IH K AH L',
  lonely:'L OW N L IY', long:'L AO NG', look:'L UH K',
  loose:'L UW S', lord:'L AO R D', lose:'L UW Z',
  loss:'L AO S', lost:'L AO S T', lot:'L AA T',
  loud:'L AW D', love:'L AH V', lovely:'L AH V L IY',
  low:'L OW', luck:'L AH K', lucky:'L AH K IY',
  lunch:'L AH N CH', lung:'L AH NG', machine:'M AH SH IY N',
  mad:'M AE D', magazine:'M AE G AH Z IY N', magic:'M AE JH IH K',
  mail:'M EY L', main:'M EY N', maintain:'M EY N T EY N',
  major:'M EY JH ER', majority:'M AH JH AO R AH T IY', make:'M EY K',
  male:'M EY L', mall:'M AO L', man:'M AE N',
  manage:'M AE N IH JH', manager:'M AE N IH JH ER', manner:'M AE N ER',
  manufacturer:'M AE N Y AH F AE K CH ER ER', many:'M EH N IY', map:'M AE P',
  march:'M AA R CH', mark:'M AA R K', market:'M AA R K AH T',
  marriage:'M EH R IH JH', marry:'M EH R IY', mask:'M AE S K',
  mass:'M AE S', master:'M AE S T ER', match:'M AE CH',
  material:'M AH T IH R IY AH L', math:'M AE TH', matter:'M AE T ER',
  maximum:'M AE K S AH M AH M', may:'M EY', maybe:'M EY B IY',
  mayor:'M EY ER', me:'M IY', meal:'M IY L',
  mean:'M IY N', meaning:'M IY N IH NG', means:'M IY N Z',
  measure:'M EH ZH ER', meat:'M IY T', media:'M IY D IY AH',
  medical:'M EH D IH K AH L', medicine:'M EH D AH S AH N', medium:'M IY D IY AH M',
  meet:'M IY T', meeting:'M IY T IH NG', member:'M EH M B ER',
  memory:'M EH M ER IY', mental:'M EH N T AH L', mention:'M EH N SH AH N',
  menu:'M EH N Y UW', mere:'M IH R', message:'M EH S IH JH',
  metal:'M EH T AH L', method:'M EH TH AH D', middle:'M IH D AH L',
  might:'M AY T', mile:'M AY L', military:'M IH L AH T EH R IY',
  milk:'M IH L K', mind:'M AY N D', mine:'M AY N',
  mineral:'M IH N ER AH L', minimum:'M IH N AH M AH M', minister:'M IH N AH S T ER',
  minor:'M AY N ER', minority:'M AH N AO R AH T IY', minute:'M IH N AH T',
  mirror:'M IH R ER', miss:'M IH S', mission:'M IH SH AH N',
  mistake:'M IH S T EY K', mix:'M IH K S', mixture:'M IH K S CH ER',
  mobile:'M OW B AH L', mode:'M OW D', model:'M AA D AH L',
  modern:'M AA D ER N', modest:'M AA D AH S T', mom:'M AA M',
  moment:'M OW M AH N T', money:'M AH N IY', monitor:'M AA N AH T ER',
  month:'M AH N TH', mood:'M UW D', moon:'M UW N',
  moral:'M AO R AH L', more:'M AO R', morning:'M AO R N IH NG',
  mortgage:'M AO R G IH JH', most:'M OW S T', mother:'M AH DH ER',
  motion:'M OW SH AH N', motivation:'M OW T AH V EY SH AH N', motor:'M OW T ER',
  mountain:'M AW N T AH N', mouse:'M AW S', mouth:'M AW TH',
  move:'M UW V', movement:'M UW V M AH N T', movie:'M UW V IY',
  much:'M AH CH', multiple:'M AH L T AH P AH L', multiply:'M AH L T AH P L AY',
  muscle:'M AH S AH L', museum:'M Y UW Z IY AH M', music:'M Y UW Z IH K',
  musical:'M Y UW Z IH K AH L', must:'M AH S T', my:'M AY',
  myself:'M AY S EH L F', mystery:'M IH S T ER IY', myth:'M IH TH',
  nail:'N EY L', name:'N EY M', narrow:'N EH R OW',
  nation:'N EY SH AH N', national:'N AE SH AH N AH L', native:'N EY T IH V',
  natural:'N AE CH ER AH L', nature:'N EY CH ER', near:'N IH R',
  nearly:'N IH R L IY', necessary:'N EH S AH S EH R IY', neck:'N EH K',
  need:'N IY D', negative:'N EH G AH T IH V', neighbor:'N EY B ER',
  neither:'N IY DH ER', nervous:'N ER V AH S', net:'N EH T',
  network:'N EH T W ER K', never:'N EH V ER', new:'N UW',
  news:'N UW Z', newspaper:'N UW Z P EY P ER', next:'N EH K S T',
  nice:'N AY S', night:'N AY T', no:'N OW',
  nobody:'N OW B AA D IY', noise:'N OY Z', none:'N AH N',
  nor:'N AO R', normal:'N AO R M AH L', north:'N AO R TH',
  nose:'N OW Z', not:'N AA T', note:'N OW T',
  nothing:'N AH TH IH NG', notice:'N OW T IH S', novel:'N AA V AH L',
  now:'N AW', nowhere:'N OW W EH R', nuclear:'N UW K L IY ER',
  number:'N AH M B ER', numerous:'N UW M ER AH S', nurse:'N ER S',
  nut:'N AH T', object:'AA B JH EH K T', objective:'AH B JH EH K T IH V',
  obligation:'AA B L AH G EY SH AH N', observation:'AA B Z ER V EY SH AH N', observe:'AH B Z ER V',
  obtain:'AH B T EY N', obvious:'AA B V IY AH S', occasion:'AH K EY ZH AH N',
  occupation:'AA K Y AH P EY SH AH N', occur:'AH K ER', ocean:'OW SH AH N',
  odd:'AA D', of:'AH V', off:'AO F',
  offense:'AH F EH N S', offer:'AO F ER', office:'AO F AH S',
  officer:'AO F AH S ER', official:'AH F IH SH AH L', often:'AO F AH N',
  oil:'OY L', okay:'OW K EY', old:'OW L D',
  on:'AA N', once:'W AH N S', one:'W AH N',
  only:'OW N L IY', onto:'AA N T UW', open:'OW P AH N',
  operate:'AA P ER EY T', operation:'AA P ER EY SH AH N', opinion:'AH P IH N Y AH N',
  opportunity:'AA P ER T UW N AH T IY', oppose:'AH P OW Z', option:'AA P SH AH N',
  or:'AO R', orange:'AO R AH N JH', order:'AO R D ER',
  ordinary:'AO R D AH N EH R IY', organization:'AO R G AH N AH Z EY SH AH N',
  organize:'AO R G AH N AY Z', origin:'AO R AH JH AH N', other:'AH DH ER',
  otherwise:'AH DH ER W AY Z', ought:'AO T', our:'AW R',
  ourselves:'AW R S EH L V Z', out:'AW T', outcome:'AW T K AH M',
  outside:'AW T S AY D', over:'OW V ER', overall:'OW V ER AO L',
  own:'OW N', owner:'OW N ER', pace:'P EY S',
  pack:'P AE K', package:'P AE K IH JH', page:'P EY JH',
  pain:'P EY N', paint:'P EY N T', painting:'P EY N T IH NG',
  pair:'P EH R', palace:'P AE L AH S', pale:'P EY L',
  palm:'P AA M', pan:'P AE N', panel:'P AE N AH L',
  panic:'P AE N IH K', paper:'P EY P ER', parent:'P EH R AH N T',
  park:'P AA R K', part:'P AA R T', particular:'P ER T IH K Y AH L ER',
  partly:'P AA R T L IY', partner:'P AA R T N ER', party:'P AA R T IY',
  pass:'P AE S', passage:'P AE S IH JH', passenger:'P AE S AH N JH ER',
  passion:'P AE SH AH N', past:'P AE S T', path:'P AE TH',
  patient:'P EY SH AH N T', pattern:'P AE T ER N', pause:'P AO Z',
  pay:'P EY', payment:'P EY M AH N T', peace:'P IY S',
  peak:'P IY K', pedestrian:'P AH D EH S T R IY AH N', pen:'P EH N',
  penalty:'P EH N AH L T IY', pencil:'P EH N S AH L', people:'P IY P AH L',
  pepper:'P EH P ER', per:'P ER', percent:'P ER S EH N T',
  perfect:'P ER F EH K T', perform:'P ER F AO R M', performance:'P ER F AO R M AH N S',
  perhaps:'P ER HH AE P S', period:'P IH R IY AH D', permanent:'P ER M AH N AH N T',
  permission:'P ER M IH SH AH N', person:'P ER S AH N', personal:'P ER S AH N AH L',
  personality:'P ER S AH N AE L AH T IY', perspective:'P ER S P EH K T IH V', persuade:'P ER S W EY D',
  pet:'P EH T', phase:'F EY Z', phenomenon:'F AH N AA M AH N AA N',
  philosophy:'F AH L AA S AH F IY', phone:'F OW N', photo:'F OW T OW',
  phrase:'F R EY Z', physical:'F IH Z IH K AH L', piano:'P IY AE N OW',
  pick:'P IH K', picture:'P IH K CH ER', piece:'P IY S',
  pig:'P IH G', pile:'P AY L', pilot:'P AY L AH T',
  pin:'P IH N', pink:'P IH NG K', pipe:'P AY P',
  pitch:'P IH CH', place:'P L EY S', plain:'P L EY N',
  plan:'P L AE N', plane:'P L EY N', planet:'P L AE N AH T',
  plant:'P L AE N T', plastic:'P L AE S T IH K', plate:'P L EY T',
  platform:'P L AE T F AO R M', play:'P L EY', player:'P L EY ER',
  pleasant:'P L EH Z AH N T', please:'P L IY Z', pleasure:'P L EH ZH ER',
  plenty:'P L EH N T IY', plot:'P L AA T', poem:'P OW AH M',
  poet:'P OW AH T', poetry:'P OW AH T R IY', point:'P OY N T',
  police:'P AH L IY S', policy:'P AA L AH S IY', political:'P AH L IH T AH K AH L',
  politics:'P AA L AH T IH K S', pollution:'P AH L UW SH AH N', pool:'P UW L',
  poor:'P UH R', pop:'P AA P', popular:'P AA P Y AH L ER',
  population:'P AA P Y AH L EY SH AH N', port:'P AO R T', portion:'P AO R SH AH N',
  portrait:'P AO R T R AH T', position:'P AH Z IH SH AH N', positive:'P AA Z AH T IH V',
  possess:'P AH Z EH S', possible:'P AA S AH B AH L', possibly:'P AA S AH B L IY',
  post:'P OW S T', pot:'P AA T', potato:'P AH T EY T OW',
  potential:'P AH T EH N SH AH L', pound:'P AW N D', pour:'P AO R',
  poverty:'P AA V ER T IY', powder:'P AW D ER', power:'P AW ER',
  powerful:'P AW ER F AH L', practical:'P R AE K T IH K AH L', practice:'P R AE K T IH S',
  praise:'P R EY Z', pray:'P R EY', prayer:'P R EH R',
  predict:'P R IH D IH K T', prefer:'P R IH F ER', pregnancy:'P R EH G N AH N S IY',
  pregnant:'P R EH G N AH N T', preparation:'P R EH P ER EY SH AH N', prepare:'P R IH P EH R',
  presence:'P R EH Z AH N S', present:'P R EH Z AH N T', preserve:'P R IH Z ER V',
  president:'P R EH Z AH D AH N T', press:'P R EH S', pressure:'P R EH SH ER',
  pretend:'P R IH T EH N D', pretty:'P R IH T IY', prevent:'P R IH V EH N T',
  previous:'P R IY V IY AH S', price:'P R AY S', pride:'P R AY D',
  priest:'P R IY S T', primarily:'P R AY M EH R AH L IY', primary:'P R AY M EH R IY',
  prime:'P R AY M', prince:'P R IH N S', princess:'P R IH N S EH S',
  principal:'P R IH N S AH P AH L', principle:'P R IH N S AH P AH L', print:'P R IH N T',
  prior:'P R AY ER', priority:'P R AY AO R AH T IY', prison:'P R IH Z AH N',
  prisoner:'P R IH Z AH N ER', private:'P R AY V AH T', prize:'P R AY Z',
  probably:'P R AA B AH B L IY', problem:'P R AA B L AH M', procedure:'P R AH S IY JH ER',
  process:'P R AA S EH S', produce:'P R AH D UW S', product:'P R AA D AH K T',
  production:'P R AH D AH K SH AH N', profession:'P R AH F EH SH AH N', professional:'P R AH F EH SH AH N AH L',
  professor:'P R AH F EH S ER', profile:'P R OW F AY L', profit:'P R AA F IH T',
  program:'P R OW G R AE M', progress:'P R AA G R EH S', project:'P R AA JH EH K T',
  promise:'P R AA M IH S', promote:'P R AH M OW T', prompt:'P R AA M P T',
  proof:'P R UW F', proper:'P R AA P ER', property:'P R AA P ER T IY',
  proposal:'P R AH P OW Z AH L', propose:'P R AH P OW Z', protect:'P R AH T EH K T',
  protection:'P R AH T EH K SH AH N', protein:'P R OW T IY N', protest:'P R AH T EH S T',
  proud:'P R AW D', prove:'P R UW V', provide:'P R AH V AY D',
  provider:'P R AH V AY D ER', province:'P R AA V AH N S', provision:'P R AH V IH ZH AH N',
  psychological:'S AY K AH L AA JH IH K AH L', public:'P AH B L IH K', publication:'P AH B L IH K EY SH AH N',
  publish:'P AH B L IH SH', pull:'P UH L', pulse:'P AH L S',
  pump:'P AH M P', punch:'P AH N CH', punish:'P AH N IH SH',
  punishment:'P AH N IH SH M AH N T', purchase:'P ER CH AH S', pure:'P Y UH R',
  purpose:'P ER P AH S', purse:'P ER S', push:'P UH S',
  put:'P UH T', qualify:'K W AA L AH F AY', quality:'K W AA L AH T IY',
  quantity:'K W AA N T AH T IY', quarter:'K W AO R T ER', queen:'K W IY N',
  question:'K W EH S CH AH N', quick:'K W IH K', quiet:'K W AY AH T',
  quit:'K W IH T', quite:'K W AY T', quote:'K W OW T',
  race:'R EY S', radio:'R EY D IY OW', rail:'R EY L',
  railway:'R EY L W EY', rain:'R EY N', raise:'R EY Z',
  range:'R EY N JH', rank:'R AE NG K', rapid:'R AE P IH D',
  rare:'R EH R', rate:'R EY T', rather:'R AE DH ER',
  ratio:'R EY SH IY OW', raw:'R AO', reach:'R IY CH',
  react:'R IY AE K T', reaction:'R IY AE K SH AH N', read:'R IY D',
  reader:'R IY D ER', reading:'R IY D IH NG', ready:'R EH D IY',
  real:'R IY L', reality:'R IY AE L AH T IY', realize:'R IY AH L AY Z',
  really:'R IH L IY', reason:'R IY Z AH N', reasonable:'R IY Z AH N AH B AH L',
  recall:'R IH K AO L', receive:'R IH S IY V', recent:'R IY S AH N T',
  recipe:'R EH S AH P IY', recognize:'R EH K AH G N AY Z', recommend:'R EH K AH M EH N D',
  record:'R EH K ER D', recover:'R IH K AH V ER', red:'R EH D',
  reduce:'R IH D UW S', refer:'R IH F ER', reference:'R EH F ER AH N S',
  reflect:'R IH F L EH K T', reform:'R IH F AO R M', refresh:'R IH F R EH SH',
  refrigerator:'R IH F R IH JH ER EY T ER', refuse:'R IH F Y UW Z', regard:'R IH G AA R D',
  region:'R IY JH AH N', register:'R EH JH IH S T ER', regret:'R IH G R EH T',
  regular:'R EH G Y AH L ER', regulation:'R EH G Y AH L EY SH AH N', reject:'R IH JH EH K T',
  relate:'R IH L EY T', relation:'R IH L EY SH AH N', relationship:'R IH L EY SH AH N SH IH P',
  relative:'R EH L AH T IH V', relax:'R IH L AE K S', release:'R IH L IY S',
  relevant:'R EH L AH V AH N T', relief:'R IH L IY F', religion:'R IH L IH JH AH N',
  religious:'R IH L IH JH AH S', rely:'R IH L AY', remain:'R IH M EY N',
  remember:'R IH M EH M B ER', remind:'R IH M AY N D', remove:'R IH M UW V',
  rent:'R EH N T', repair:'R IH P EH R', repeat:'R IH P IY T',
  replace:'R IH P L EY S', reply:'R IH P L AY', report:'R IH P AO R T',
  represent:'R EH P R IH Z EH N T', republic:'R IH P AH B L IH K', reputation:'R EH P Y AH T EY SH AH N',
  request:'R IH K W EH S T', require:'R IH K W AY ER', rescue:'R EH S K Y UW',
  research:'R IY S ER CH', reserve:'R IH Z ER V', resident:'R EH Z AH D AH N T',
  resist:'R IH Z IH S T', resolve:'R IH Z AA L V', resort:'R IH Z AO R T',
  resource:'R IY S AO R S', respect:'R IH S P EH K T', respond:'R IH S P AA N D',
  response:'R IH S P AA N S', responsibility:'R IH S P AA N S AH B IH L AH T IY', rest:'R EH S T',
  restaurant:'R EH S T R AH AA N T', restore:'R IH S T AO R', restrict:'R IH S T R IH K T',
  result:'R IH Z AH L T', retain:'R IH T EY N', retire:'R IH T AY ER',
  return:'R IH T ER N', reveal:'R IH V IY L', revenue:'R EH V AH N UW',
  reverse:'R IH V ER S', review:'R IH V Y UW', revolution:'R EH V AH L UW SH AH N',
  reward:'R IH W AO R D', rhythm:'R IH DH AH M', rice:'R AY S',
  rich:'R IH CH', ride:'R AY D', ridiculous:'R IH D IH K Y AH L AH S',
  right:'R AY T', ring:'R IH NG', ripe:'R AY P',
  rise:'R AY Z', risk:'R IH S K', river:'R IH V ER',
  road:'R OW D', rob:'R AA B', rock:'R AA K',
  role:'R OW L', roll:'R OW L', roof:'R UW F',
  room:'R UW M', root:'R UW T', rope:'R OW P',
  rose:'R OW Z', rough:'R AH F', round:'R AW N D',
  route:'R UW T', routine:'R UW T IY N', row:'R OW',
  royal:'R OY AH L', rub:'R AH B', rubber:'R AH B ER',
  rude:'R UW D', rule:'R UW L', ruler:'R UW L ER',
  run:'R AH N', rural:'R UH R AH L', rush:'R AH SH',
  sad:'S AE D', safe:'S EY F', safety:'S EY F T IY',
  sail:'S EY L', sake:'S EY K', salad:'S AE L AH D',
  salary:'S AE L ER IY', sale:'S EY L', salt:'S AO L T',
  same:'S EY M', sample:'S AE M P AH L', sand:'S AE N D',
  satellite:'S AE T AH L AY T', satisfaction:'S AE T IH S F AE K SH AH N', satisfy:'S AE T IH S F AY',
  save:'S EY V', say:'S EY', scale:'S K EY L',
  scan:'S K AE N', scandal:'S K AE N D AH L', scene:'S IY N',
  schedule:'S K EH JH UW L', scheme:'S K IY M', school:'S K UW L',
  science:'S AY AH N S', scientific:'S AY AH N T IH F IH K', scientist:'S AY AH N T IH S T',
  score:'S K AO R', scream:'S K R IY M', screen:'S K R IY N',
  screw:'S K R UW', script:'S K R IH P T', sea:'S IY',
  search:'S ER CH', season:'S IY Z AH N', seat:'S IY T',
  second:'S EH K AH N D', secret:'S IY K R IH T', secretary:'S EH K R AH T EH R IY',
  section:'S EH K SH AH N', sector:'S EH K T ER', security:'S IH K Y UH R AH T IY',
  see:'S IY', seed:'S IY D', seek:'S IY K',
  seem:'S IY M', segment:'S EH G M AH N T', select:'S AH L EH K T',
  selection:'S AH L EH K SH AH N', self:'S EH L F', sell:'S EH L',
  senate:'S EH N AH T', send:'S EH N D', senior:'S IY N Y ER',
  sense:'S EH N S', sensitive:'S EH N S AH T IH V', sentence:'S EH N T AH N S',
  separate:'S EH P ER EY T', sequence:'S IY K W AH N S', series:'S IH R IY Z',
  serious:'S IH R IY AH S', servant:'S ER V AH N T', serve:'S ER V',
  service:'S ER V AH S', session:'S EH SH AH N', set:'S EH T',
  settle:'S EH T AH L', settlement:'S EH T AH L M AH N T', seven:'S EH V AH N',
  several:'S EH V R AH L', severe:'S AH V IH R', sex:'S EH K S',
  sexual:'S EH K SH UW AH L', shade:'SH EY D', shadow:'SH AE D OW',
  shake:'SH EY K', shall:'SH AE L', shape:'SH EY P',
  share:'SH EH R', sharp:'SH AA R P', she:'SH IY',
  sheet:'SH IY T', shelf:'SH EH L F', shell:'SH EH L',
  shelter:'SH EH L T ER', shift:'SH IH F T', shine:'SH AY N',
  ship:'SH IH P', shirt:'SH ER T', shock:'SH AA K',
  shoe:'SH UW', shoot:'SH UW T', shop:'SH AA P',
  shopping:'SH AA P IH NG', shore:'SH AO R', short:'SH AO R T',
  shot:'SH AA T', should:'SH UH D', shoulder:'SH OW L D ER',
  shout:'SH AW T', show:'SH OW', shower:'SH AW ER',
  shut:'SH AH T', sick:'S IH K', side:'S AY D',
  sight:'S AY T', sign:'S AY N', signal:'S IH G N AH L',
  signature:'S IH G N AH CH ER', silence:'S AY L AH N S', silent:'S AY L AH N T',
  silk:'S IH L K', silly:'S IH L IY', silver:'S IH L V ER',
  similar:'S IH M AH L ER', simple:'S IH M P AH L', simply:'S IH M P L IY',
  since:'S IH N S', sincere:'S IH N S IH R', sing:'S IH NG',
  singer:'S IH NG ER', single:'S IH NG G AH L', sink:'S IH NG K',
  sir:'S ER', sister:'S IH S T ER', sit:'S IH T',
  site:'S AY T', situation:'S IH CH UW EY SH AH N', six:'S IH K S',
  size:'S AY Z', skill:'S K IH L', skin:'S K IH N',
  sky:'S K AY', slave:'S L EY V', sleep:'S L IY P',
  slice:'S L AY S', slide:'S L AY D', slight:'S L AY T',
  slip:'S L IH P', slope:'S L OW P', slow:'S L OW',
  small:'S M AO L', smart:'S M AA R T', smell:'S M EH L',
  smile:'S M AY L', smoke:'S M OW K', smooth:'S M UW DH',
  snake:'S N EY K', snow:'S N OW', so:'S OW',
  soap:'S OW P', social:'S OW SH AH L', society:'S AH S AY AH T IY',
  sock:'S AA K', soft:'S AO F T', software:'S AO F T W EH R',
  soil:'S OY L', solar:'S OW L ER', soldier:'S OW L JH ER',
  solid:'S AA L IH D', solution:'S AH L UW SH AH N', solve:'S AA L V',
  some:'S AH M', somebody:'S AH M B AA D IY', somehow:'S AH M HH AW',
  someone:'S AH M W AH N', something:'S AH M TH IH NG', sometimes:'S AH M T AY M Z',
  somewhat:'S AH M W AH T', somewhere:'S AH M W EH R', son:'S AH N',
  song:'S AO NG', soon:'S UW N', sorry:'S AA R IY',
  sort:'S AO R T', soul:'S OW L', sound:'S AW N D',
  soup:'S UW P', source:'S AO R S', south:'S AW TH',
  southern:'S AH DH ER N', space:'S P EY S', speak:'S P IY K',
  speaker:'S P IY K ER', special:'S P EH SH AH L', species:'S P IY SH IY Z',
  specific:'S P AH S IH F IH K', speech:'S P IY CH', speed:'S P IY D',
  spell:'S P EH L', spend:'S P EH N D', spirit:'S P IH R AH T',
  spiritual:'S P IH R IH CH UW AH L', split:'S P L IH T', sport:'S P AO R T',
  spot:'S P AA T', spread:'S P R EH D', spring:'S P R IH NG',
  square:'S K W EH R', stable:'S T EY B AH L', staff:'S T AE F',
  stage:'S T EY JH', stair:'S T EH R', stamp:'S T AE M P',
  stand:'S T AE N D', standard:'S T AE N D ER D', star:'S T AA R',
  stare:'S T EH R', start:'S T AA R T', state:'S T EY T',
  statement:'S T EY T M AH N T', station:'S T EY SH AH N', status:'S T EY T AH S',
  stay:'S T EY', steady:'S T EH D IY', steal:'S T IY L',
  steam:'S T IY M', steel:'S T IY L', steep:'S T IY P',
  stem:'S T EH M', step:'S T EH P', stick:'S T IH K',
  still:'S T IH L', stock:'S T AA K', stomach:'S T AH M AH K',
  stone:'S T OW N', stop:'S T AA P', store:'S T AO R',
  storm:'S T AO R M', story:'S T AO R IY', straight:'S T R EY T',
  strange:'S T R EY N JH', stranger:'S T R EY N JH ER', strategy:'S T R AE T AH JH IY',
  stream:'S T R IY M', street:'S T R IY T', strength:'S T R EH NG K TH',
  stress:'S T R EH S', stretch:'S T R EH CH', strike:'S T R AY K',
  string:'S T R IH NG', strip:'S T R IH P', stroke:'S T R OW K',
  strong:'S T R AO NG', structure:'S T R AH K CH ER', struggle:'S T R AH G AH L',
  student:'S T UW D AH N T', studio:'S T UW D IY OW', study:'S T AH D IY',
  stuff:'S T AH F', stupid:'S T UW P AH D', style:'S T AY L',
  subject:'S AH B JH EH K T', substance:'S AH B S T AH N S', succeed:'S AH K S IY D',
  success:'S AH K S EH S', successful:'S AH K S EH S F AH L', such:'S AH CH',
  sudden:'S AH D AH N', suffer:'S AH F ER', sugar:'SH UH G ER',
  suggest:'S AH G JH EH S T', suggestion:'S AH G JH EH S CH AH N', suit:'S UW T',
  summer:'S AH M ER', sun:'S AH N', supper:'S AH P ER',
  supply:'S AH P L AY', support:'S AH P AO R T', suppose:'S AH P OW Z',
  sure:'SH UH R', surface:'S ER F AH S', surprise:'S ER P R AY Z',
  surround:'S ER AW N D', survey:'S ER V EY', survive:'S ER V AY V',
  suspect:'S AH S P EH K T', sweet:'S W IY T', swim:'S W IH M',
  switch:'S W IH CH', symbol:'S IH M B AH L', sympathy:'S IH M P AH TH IY',
  system:'S IH S T AH M', table:'T EY B AH L', tail:'T EY L',
  take:'T EY K', tale:'T EY L', talent:'T AE L AH N T',
  talk:'T AO K', tall:'T AO L', tank:'T AE NG K',
  tape:'T EY P', target:'T AA R G AH T', task:'T AE S K',
  taste:'T EY S T', tax:'T AE K S', tea:'T IY',
  teach:'T IY CH', teacher:'T IY CH ER', team:'T IY M',
  tear:'T IH R', technical:'T EH K N IH K AH L', technique:'T EH K N IY K',
  technology:'T EH K N AA L AH JH IY', telephone:'T EH L AH F OW N', television:'T EH L AH V IH ZH AH N',
  tell:'T EH L', temperature:'T EH M P ER AH CH ER', temporary:'T EH M P ER EH R IY',
  ten:'T EH N', tend:'T EH N D', tendency:'T EH N D AH N S IY',
  tennis:'T EH N IH S', tension:'T EH N SH AH N', tent:'T EH N T',
  term:'T ER M', terrible:'T EH R AH B AH L', test:'T EH S T',
  text:'T EH K S T', than:'DH AE N', thank:'TH AE NG K',
  that:'DH AE T', the:'DH AH', theater:'TH IY AH T ER',
  their:'DH EH R', them:'DH EH M', theme:'TH IY M',
  themselves:'DH EH M S EH L V Z', then:'DH EH N', theory:'TH IH R IY',
  therapy:'TH EH R AH P IY', there:'DH EH R', therefore:'DH EH R F AO R',
  these:'DH IY Z', they:'DH EY', thick:'TH IH K',
  thin:'TH IH N', thing:'TH IH NG', think:'TH IH NG K',
  third:'TH ER D', thirsty:'TH ER S T IY', thirteen:'TH ER T IY N',
  thirty:'TH ER T IY', this:'DH IH S', those:'DH OW Z',
  though:'DH OW', thought:'TH AO T', thousand:'TH AW Z AH N D',
  threat:'TH R EH T', three:'TH R IY', throat:'TH R OW T',
  through:'TH R UW', throughout:'TH R UW AW T', throw:'TH R OW',
  thus:'DH AH S', ticket:'T IH K AH T', tide:'T AY D',
  tie:'T AY', tight:'T AY T', till:'T IH L',
  time:'T AY M', tiny:'T AY N IY', tip:'T IH P',
  tire:'T AY ER', title:'T AY T AH L', to:'T UW',
  today:'T AH D EY', together:'T AH G EH DH ER', tomorrow:'T AH M AO R OW',
  tone:'T OW N', tongue:'T AH NG', tonight:'T AH N AY T',
  too:'T UW', took:'T UH K', tool:'T UW L',
  tooth:'T UW TH', top:'T AA P', total:'T OW T AH L',
  touch:'T AH CH', tour:'T UH R', tourist:'T UH R IH S T',
  toward:'T AO R D', towards:'T AO R D Z', tower:'T AW ER',
  town:'T AW N', toy:'T OY', track:'T R AE K',
  trade:'T R EY D', tradition:'T R AH D IH SH AH N', traffic:'T R AE F IH K',
  tragedy:'T R AE JH AH D IY', trail:'T R EY L', train:'T R EY N',
  training:'T R EY N IH NG', transfer:'T R AE N S F ER', transform:'T R AE N S F AO R M',
  transition:'T R AE N Z IH SH AH N', translate:'T R AE N Z L EY T', transport:'T R AE N S P AO R T',
  travel:'T R AE V AH L', treat:'T R IY T', treatment:'T R IY T M AH N T',
  tree:'T R IY', trial:'T R AY AH L', tribe:'T R AY B',
  trick:'T R IH K', trip:'T R IH P', trouble:'T R AH B AH L',
  truck:'T R AH K', true:'T R UW', trust:'T R AH S T',
  truth:'T R UW TH', try:'T R AY', tube:'T UW B',
  tune:'T UW N', tunnel:'T AH N AH L', turn:'T ER N',
  twelve:'T W EH L V', twenty:'T W EH N T IY', twice:'T W AY S',
  twin:'T W IH N', two:'T UW', type:'T AY P',
  typical:'T IH P IH K AH L', ugly:'AH G L IY', ultimate:'AH L T AH M AH T',
  unable:'AH N EY B AH L', uncle:'AH NG K AH L', under:'AH N D ER',
  understand:'AH N D ER S T AE N D', understanding:'AH N D ER S T AE N D IH NG', undertake:'AH N D ER T EY K',
  underwear:'AH N D ER W EH R', undo:'AH N D UW', unfortunately:'AH N F AO R CH AH N AH T L IY',
  uniform:'Y UW N AH F AO R M', union:'Y UW N Y AH N', unique:'Y UW N IY K',
  unit:'Y UW N IH T', unite:'Y UW N AY T', universal:'Y UW N AH V ER S AH L',
  universe:'Y UW N AH V ER S', university:'Y UW N AH V ER S AH T IY', unknown:'AH N N OW N',
  unless:'AH N L EH S', unlike:'AH N L AY K', unlikely:'AH N L AY K L IY',
  until:'AH N T IH L', unusual:'AH N Y UW ZH UW AH L', up:'AH P',
  upon:'AH P AA N', upper:'AH P ER', urban:'ER B AH N',
  urge:'ER JH', urgent:'ER JH AH N T', us:'AH S',
  use:'Y UW Z', used:'Y UW Z D', useful:'Y UW S F AH L',
  user:'Y UW Z ER', usual:'Y UW ZH UW AH L', usually:'Y UW ZH UW AH L IY',
  vacation:'V EY K EY SH AH N', valley:'V AE L IY', valuable:'V AE L Y UW AH B AH L',
  value:'V AE L Y UW', variety:'V ER AY AH T IY', various:'V EH R IY AH S',
  vegetable:'V EH JH T AH B AH L', vehicle:'V IY AH K AH L', venture:'V EH N CH ER',
  version:'V ER ZH AH N', versus:'V ER S AH S', vertical:'V ER T IH K AH L',
  very:'V EH R IY', vessel:'V EH S AH L', veteran:'V EH T ER AH N',
  via:'V AY AH', victim:'V IH K T IH M', victory:'V IH K T ER IY',
  video:'V IH D IY OW', view:'V Y UW', viewer:'V Y UW ER',
  village:'V IH L IH JH', violate:'V AY AH L EY T', violence:'V AY AH L AH N S',
  violent:'V AY AH L AH N T', virtual:'V ER CH UW AH L', virtue:'V ER CH UW',
  virus:'V AY R AH S', visible:'V IH Z AH B AH L', vision:'V IH ZH AH N',
  visit:'V IH Z AH T', visitor:'V IH Z AH T ER', visual:'V IH ZH UW AH L',
  vital:'V AY T AH L', voice:'V OY S', volume:'V AA L Y UW M',
  volunteer:'V AA L AH N T IH R', vote:'V OW T', wage:'W EY JH',
  wait:'W EY T', walk:'W AO K', wall:'W AO L',
  want:'W AA N T', war:'W AO R', warm:'W AO R M',
  warn:'W AO R N', wash:'W AA SH', waste:'W EY S T',
  watch:'W AA CH', water:'W AO T ER', wave:'W EY V',
  way:'W EY', we:'W IY', weak:'W IY K',
  wealth:'W EH L TH', weapon:'W EH P AH N', wear:'W EH R',
  weather:'W EH DH ER', web:'W EH B', wedding:'W EH D IH NG',
  week:'W IY K', weekend:'W IY K EH N D', weight:'W EY T',
  welcome:'W EH L K AH M', welfare:'W EH L F EH R', well:'W EH L',
  west:'W EH S T', western:'W EH S T ER N', wet:'W EH T',
  what:'W AH T', whatever:'W AH T EH V ER', wheel:'W IY L',
  when:'W EH N', whenever:'W EH N EH V ER', where:'W EH R',
  whereas:'W EH R AE Z', wherever:'W EH R EH V ER', whether:'W EH DH ER',
  which:'W IH CH', while:'W AY L', whilst:'W AY L S T',
  whisper:'W IH S P ER', white:'W AY T', who:'HH UW',
  whole:'HH OW L', whom:'HH UW M', whose:'HH UW Z',
  why:'W AY', wide:'W AY D', wife:'W AY F',
  wild:'W AY L D', will:'W IH L', win:'W IH N',
  wind:'W IH N D', window:'W IH N D OW', wine:'W AY N',
  wing:'W IH NG', winner:'W IH N ER', winter:'W IH N T ER',
  wire:'W AY ER', wise:'W AY Z', wish:'W IH SH',
  with:'W IH DH', within:'W IH DH IH N', without:'W IH DH AW T',
  witness:'W IH T N AH S', woman:'W UH M AH N', wonder:'W AH N D ER',
  wonderful:'W AH N D ER F AH L', wood:'W UH D', wooden:'W UH D AH N',
  word:'W ER D', work:'W ER K', worker:'W ER K ER',
  world:'W ER L D', worry:'W ER IY', worth:'W ER TH',
  would:'W UH D', write:'R AY T', writer:'R AY T ER',
  writing:'R AY T IH NG', wrong:'R AO NG', yard:'Y AA R D',
  yeah:'Y EH', year:'Y IH R', yell:'Y EH L',
  yellow:'Y EH L OW', yes:'Y EH S', yesterday:'Y EH S T ER D EY',
  yet:'Y EH T', yield:'Y IY L D', you:'Y UW',
  young:'Y AH NG', your:'Y AO R', yours:'Y AO R Z',
  yourself:'Y AO R S EH L F', youth:'Y UW TH', zero:'Z IH R OW',
  zone:'Z OW N',
};


// Suffix rules applied after exception lookup
const SUFFIX_RULES = [
  [/tion$/,      'SH AH N'],
  [/sion$/,      'ZH AH N'],
  [/ious$/,      'IY AH S'],
  [/ous$/,       'AH S'],
  [/ious$/,      'IY AH S'],
  [/ment$/,      'M AH N T'],
  [/ness$/,      'N AH S'],
  [/less$/,      'L AH S'],
  [/ful$/,       'F UH L'],
  [/ly$/,        'L IY'],
  [/ing$/,       'IH NG'],
  [/ed$/,        'D'],
  [/es$/,        'IH Z'],
  [/er$/,        'ER'],
  [/est$/,       'AH S T'],
  [/tion$/,      'SH AH N'],
  [/ty$/,        'T IY'],
  [/ity$/,       'IH T IY'],
  [/al$/,        'AH L'],
  [/ial$/,       'IY AH L'],
  [/ic$/,        'IH K'],
  [/ical$/,      'IH K AH L'],
  [/ive$/,       'IH V'],
  [/ize$/,       'AY Z'],
  [/ise$/,       'AY Z'],
  [/ify$/,       'IH F AY'],
  [/able$/,      'AH B AH L'],
  [/ible$/,      'IH B AH L'],
  [/age$/,       'IH JH'],
  [/ate$/,       'EY T'],
  [/ure$/,       'Y UH R'],
  [/ance$/,      'AH N S'],
  [/ence$/,      'AH N S'],
  [/ism$/,       'IH Z AH M'],
  [/ist$/,       'AH S T'],
  [/ology$/,     'AO L AH JH IY'],
];

// Vowel cluster → phoneme mapping (longest match first)
const VOWEL_MAP = [
  ['ough','AO F'], ['augh','AO'],
  ['igh','AY'], ['ight','AY T'],
  ['ought','AO T'], ['aughter','AO T ER'],
  ['eight','EY T'], ['eigh','EY'],
  ['tion','SH AH N'], ['sion','ZH AH N'],
  ['ture','CH ER'], ['sure','SH ER'],
  ['our','AW ER'], ['our','AO R'],
  ['oo','UW'], ['oe','OW'],
  ['oa','OW'], ['ou','AW'],
  ['ow','OW'], ['oi','OY'], ['oy','OY'],
  ['au','AO'], ['aw','AO'],
  ['ai','EY'], ['ay','EY'], ['ae','EY'],
  ['ea','IY'], ['ee','IY'], ['ie','IY'], ['ei','IY'],
  ['eu','Y UW'], ['ew','Y UW'],
  ['ue','Y UW'], ['ui','W IH'],
  ['io','IY OW'],
  ['ia','IY AH'],
];

// Consonant cluster → phoneme mapping
const CONSONANT_MAP = [
  ['tch','CH'], ['dge','JH'],
  ['sch','S K'], ['spl','S P L'], ['spr','S P R'], ['str','S T R'],
  ['scr','S K R'], ['shr','SH R'], ['thr','TH R'],
  ['ph','F'], ['gh','G'], ['ch','CH'], ['sh','SH'],
  ['th','TH'], ['wh','W'], ['ck','K'], ['ng','NG'],
  ['qu','K W'], ['x','K S'], ['y','Y'],
  ['b','B'], ['c','K'], ['d','D'], ['f','F'], ['g','G'],
  ['h','HH'], ['j','JH'], ['k','K'], ['l','L'], ['m','M'],
  ['n','N'], ['p','P'], ['r','R'], ['s','S'], ['t','T'],
  ['v','V'], ['w','W'], ['z','Z'],
];

function graphemeToPhonemes(word) {
  const lw = word.toLowerCase().replace(/[^a-z]/g,'');
  if (!lw) return [];
  if (WORD_EXCEPTIONS[lw]) return WORD_EXCEPTIONS[lw].split(' ');

  // Try suffix rules on the word
  for (const [re, ph] of SUFFIX_RULES) {
    if (re.test(lw)) {
      const stem = lw.replace(re, '');
      if (stem.length > 0) {
        const stemPhs = WORD_EXCEPTIONS[stem]
          ? WORD_EXCEPTIONS[stem].split(' ')
          : convertByRules(stem);
        return [...stemPhs, ...ph.split(' ')];
      }
    }
  }
  return convertByRules(lw);
}

function convertByRules(word) {
  const phones = [];
  let i = 0;
  while (i < word.length) {
    // Try vowel clusters
    let matched = false;
    for (const [cluster, ph] of VOWEL_MAP) {
      if (word.slice(i, i + cluster.length).toLowerCase() === cluster) {
        phones.push(...ph.split(' '));
        i += cluster.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Try consonant clusters
    for (const [cluster, ph] of CONSONANT_MAP) {
      if (word.slice(i, i + cluster.length).toLowerCase() === cluster) {
        phones.push(...ph.split(' '));
        i += cluster.length;
        matched = true;
        break;
      }
    }
    if (!matched) i++;
  }

  // Simple vowel letters if nothing matched
  if (phones.length === 0) {
    for (const ch of word) {
      const vmap = {a:'AE',e:'EH',i:'IH',o:'AO',u:'AH'};
      const cmap = {b:'B',c:'K',d:'D',f:'F',g:'G',h:'HH',j:'JH',k:'K',l:'L',
                    m:'M',n:'N',p:'P',q:'K',r:'R',s:'S',t:'T',v:'V',w:'W',x:'K',y:'Y',z:'Z'};
      phones.push(vmap[ch] || cmap[ch] || 'AH');
    }
  }
  return phones;
}

function textToPhonemeEvents(text) {
  // Returns [{word, phonemes:[string], charStart, charEnd}]
  const events = [];
  const wordRe = /([a-zA-Z']+)|([^a-zA-Z'\s]+)/g;
  let match;
  while ((match = wordRe.exec(text)) !== null) {
    if (match[1]) {
      const phones = graphemeToPhonemes(match[1]);
      events.push({
        word: match[1],
        phonemes: phones.filter(p => p),
        charStart: match.index,
        charEnd: match.index + match[1].length,
      });
    }
  }
  return events;
}

// =====================================================
// TIMELINE BUILDER
// Given word events with timing, produce a flat per-frame
// schedule of { time_ms, visemeKey, duration_ms }
// =====================================================
function buildTimeline(wordEvents) {
  // wordEvents: [{word, phonemes, wordStartMs, wordDurationMs}]
  const frames = [];
  for (const ev of wordEvents) {
    const { phonemes, wordStartMs, wordDurationMs } = ev;
    if (!phonemes.length) continue;

    const totalUnits = phonemes.reduce((s, p) => {
      const shapeKey = PHONEME_TO_SHAPE[p.replace(/[0-9]/g,'')] || 'AH';
      return s + (PHONEME_BASE_DURATION[shapeKey] || 80);
    }, 0);

    let t = wordStartMs;
    for (const p of phonemes) {
      const rawPhone = p.replace(/[0-9]/g,'');
      const shapeKey = PHONEME_TO_SHAPE[rawPhone] || 'AH';
      const baseDur  = PHONEME_BASE_DURATION[shapeKey] || 80;
      const scaledDur = (baseDur / totalUnits) * wordDurationMs;
      frames.push({ timeMs: t, shapeKey, durationMs: Math.max(30, scaledDur) });
      t += scaledDur;
    }
  }
  frames.sort((a,b) => a.timeMs - b.timeMs);
  return frames;
}

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
let pauseTimeout = null; // for punctuation delays
let faceMesh = null;
let avatarModel = null;
let currentState = 'idle';
let isBlinking = false, blinkTimer = 0, nextBlink = Math.random() * 180 + 120;
let idleTime = 0, breathePhase = 0;
let isSpeaking = false, isPageVisible = true;

// Head motion
let modelRotY = 0, modelRotX = 0, modelRotZ = 0;
let targetModelRotY = 0, targetModelRotX = 0, targetModelRotZ = 0;
let lastGlanceTime = 0, glanceActive = false, glanceTimer = null;

// Eye saccades
let lastSaccadeTime = 0;
const SACCADE_INTERVAL = 2000;

// Click reaction
let clickReactionActive = false;

// User drag control
let isUserControlling = false;

// Post-speech smile
let smileActive = false;
let smileStartTime = 0;
const SMILE_DURATION_MS = 1800;  // how long the smile holds
const SMILE_FADE_MS     = 600;   // how long it fades in/out

// =====================================================
// LIP SYNC ENGINE STATE
// =====================================================
// The key innovation: we use SpeechSynthesis boundary events to
// get the EXACT time each word starts in the audio, then map
// phonemes proportionally within that word's window.
// =====================================================
let activeSpeech = null;           // current SpeechSynthesisUtterance

// Per-frame viseme target (blended from timeline)
let currentVisemeShape = 'sil';
let currentVisemeWeight = 0;       // 0–1 progress within the shape
let nextVisemeShape    = 'sil';

// The flat timeline: [{timeMs, shapeKey, durationMs}]
// timeMs is RELATIVE to speechStartTime
let lipTimeline = [];
let lipTimelineIdx = 0;
let speechStartTime = 0;           // performance.now() when speech began

// Word boundary events give us actual spoken word timings.
// We store them and rebuild the timeline as we go.
let wordBoundaryLog = [];          // [{wordIndex, charIndex, elapsedMs}]
let wordPhonemeEvents = [];        // pre-built from text

// Smooth current morph weights (the actual rendered values)
let smoothWeights = {};            // morphName → current weight

// =====================================================
// PAGE VISIBILITY
// =====================================================
document.addEventListener('visibilitychange', () => {
  isPageVisible = !document.hidden;
});

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
        console.log("✓ Morph count:", Object.keys(obj.morphTargetDictionary).length);
        // Init smooth weights to 0
        Object.keys(obj.morphTargetDictionary).forEach(k => smoothWeights[k] = 0);
      }
    });

    if (!faceMesh) { console.error("✗ No face mesh"); return; }

    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    gltf.scene.position.sub(center);
    camera.near = size / 100;
    camera.far  = size * 10;
    camera.position.z = size * 0.75;
    camera.updateProjectionMatrix();

    updateStatus('Ready', false);
  },
  undefined,
  (err) => console.error("GLTF ERROR:", err)
);

// =====================================================
// MORPH TARGET HELPERS
// =====================================================
function setMorphTarget(name, value) {
  if (!faceMesh?.morphTargetDictionary) return;
  const idx = faceMesh.morphTargetDictionary[name];
  if (idx !== undefined) faceMesh.morphTargetInfluences[idx] = Math.max(0, Math.min(1, value));
}

function getMorphTarget(name) {
  if (!faceMesh?.morphTargetDictionary) return 0;
  const idx = faceMesh.morphTargetDictionary[name];
  return (idx !== undefined) ? (faceMesh.morphTargetInfluences[idx] || 0) : 0;
}

// Smooth a single morph toward target using different in/out speeds
function smoothMorph(name, target, inSpeed, outSpeed) {
  const current = getMorphTarget(name);
  const speed = target > current ? inSpeed : outSpeed;
  setMorphTarget(name, current + (target - current) * speed);
}

// Zero out all mouth morphs – hard reset
function resetMouthInstant() {
  MOUTH_MORPHS.forEach(m => setMorphTarget(m, 0));
}

// Smooth decay mouth morphs to zero
function resetMouthSmooth(speed = 0.2) {
  MOUTH_MORPHS.forEach(m => smoothMorph(m, 0, speed, speed));
}

// =====================================================
// APPLY VISEME SHAPE – blended from two shapes
// =====================================================
function applyBlendedViseme(shapeKeyA, shapeKeyB, blendFactor, amplitudeScale) {
  const shapeA = VISEME_SHAPES[shapeKeyA] || VISEME_SHAPES.sil;
  const shapeB = VISEME_SHAPES[shapeKeyB] || VISEME_SHAPES.sil;

  // Build target map for all mouth morphs (default 0)
  const targets = {};
  MOUTH_MORPHS.forEach(m => targets[m] = 0);

  // Blend A into targets
  Object.entries(shapeA).forEach(([m, v]) => {
    targets[m] = (targets[m] || 0) + v * (1 - blendFactor);
  });
  // Blend B into targets
  Object.entries(shapeB).forEach(([m, v]) => {
    targets[m] = (targets[m] || 0) + v * blendFactor;
  });

  // Scale by amplitude
  Object.keys(targets).forEach(m => { targets[m] *= amplitudeScale * AMPLITUDE_MULTIPLIER; });

  // ========== UPDATED SAFETY CLAMP (STRICT) ==========
  // Prevent lower lip from rising above upper lip by clamping the *combined*
  // effect of all morphs that raise the lower lip.
  const jawAmt = targets['jawOpen'] || 0;

  // List of morphs that primarily raise the lower lip (move it upward)
  const lowerLipRaisers = ['mouthClose', 'mouthRollLower', 'mouthPress_L', 'mouthPress_R', 'mouthShrugLower'];

  // Compute total raise from these morphs
  let totalRaise = 0;
  lowerLipRaisers.forEach(m => totalRaise += targets[m] || 0);

  // Maximum allowed raise based on jaw opening.
  // When jaw is fully closed (0), we allow full raise (1.0).
  // As jaw opens, allowed raise decreases linearly, reaching 0 at jawOpen = 0.15.
  const maxRaise = Math.max(0, 1 - (jawAmt / 0.15));

  if (totalRaise > maxRaise && maxRaise >= 0) {
    // Scale down all raising morphs proportionally so total does not exceed maxRaise
    const scale = maxRaise / totalRaise;
    lowerLipRaisers.forEach(m => {
      if (targets[m]) targets[m] *= scale;
    });
  }
  // ========== END SAFETY CLAMP ==========

  // Apply with asymmetric smoothing
  Object.entries(targets).forEach(([m, tgt]) => {
    smoothMorph(m, tgt, VISEME_SMOOTHING_IN, VISEME_SMOOTHING_OUT);
  });

  // Final runtime constraint (already present in your code)
  enforceLipConstraint();
}


// =====================================================
// BLINKING
// =====================================================
function updateBlinking() {
  if (isBlinking) {
    blinkTimer++;
    const p = blinkTimer / 8;
    const v = p < 0.5 ? p * 2 : 2 - p * 2;
    setMorphTarget('eyeBlink_L', v);
    setMorphTarget('eyeBlink_R', v);
    if (blinkTimer >= 8) {
      isBlinking = false; blinkTimer = 0;
      setMorphTarget('eyeBlink_L', 0);
      setMorphTarget('eyeBlink_R', 0);
      nextBlink = Math.random() * 180 + 120;
    }
  } else {
    if (++blinkTimer >= nextBlink) { isBlinking = true; blinkTimer = 0; }
  }
}

// =====================================================
// EYE SACCADES
// =====================================================
function updateEyeSaccades() {
  const now = Date.now();
  if (now - lastSaccadeTime < SACCADE_INTERVAL || clickReactionActive) return;
  lastSaccadeTime = now;

  const sx = (Math.random() - 0.5) * 0.3;
  const sy = (Math.random() - 0.5) * 0.2;

  if (sx > 0) {
    smoothMorph('eyeLookOut_L', Math.abs(sx), 0.15, 0.15);
    smoothMorph('eyeLookIn_R',  Math.abs(sx), 0.15, 0.15);
    smoothMorph('eyeLookIn_L',  0, 0.15, 0.15);
    smoothMorph('eyeLookOut_R', 0, 0.15, 0.15);
  } else {
    smoothMorph('eyeLookIn_L',  Math.abs(sx), 0.15, 0.15);
    smoothMorph('eyeLookOut_R', Math.abs(sx), 0.15, 0.15);
    smoothMorph('eyeLookOut_L', 0, 0.15, 0.15);
    smoothMorph('eyeLookIn_R',  0, 0.15, 0.15);
  }
  if (sy > 0) {
    smoothMorph('eyeLookUp_L',   Math.abs(sy), 0.15, 0.15);
    smoothMorph('eyeLookUp_R',   Math.abs(sy), 0.15, 0.15);
    smoothMorph('eyeLookDown_L', 0, 0.15, 0.15);
    smoothMorph('eyeLookDown_R', 0, 0.15, 0.15);
  } else {
    smoothMorph('eyeLookDown_L', Math.abs(sy), 0.15, 0.15);
    smoothMorph('eyeLookDown_R', Math.abs(sy), 0.15, 0.15);
    smoothMorph('eyeLookUp_L',   0, 0.15, 0.15);
    smoothMorph('eyeLookUp_R',   0, 0.15, 0.15);
  }
  setTimeout(() => {
    ['eyeLookIn_L','eyeLookIn_R','eyeLookOut_L','eyeLookOut_R',
     'eyeLookUp_L','eyeLookUp_R','eyeLookDown_L','eyeLookDown_R'].forEach(m =>
      smoothMorph(m, 0, 0.1, 0.1));
  }, 400);
}

// =====================================================
// HEAD MOTION
// =====================================================
function updateHeadMotion(deltaTime) {
  if (!avatarModel) return;

  if (!isUserControlling) {
    if (currentState === 'idle' && !glanceActive) {
      idleTime += deltaTime;
      targetModelRotY = Math.sin(idleTime * HEAD_IDLE_DRIFT_SPEED) * HEAD_IDLE_AMPLITUDE;
      targetModelRotX = Math.cos(idleTime * HEAD_IDLE_DRIFT_SPEED * 0.7) * HEAD_IDLE_AMPLITUDE * 0.5;
      targetModelRotZ = Math.sin(idleTime * HEAD_IDLE_DRIFT_SPEED * 0.5) * HEAD_IDLE_AMPLITUDE * 0.3;

      const now = Date.now();
      if (now - lastGlanceTime > HEAD_GLANCE_INTERVAL) {
        lastGlanceTime = now;
        glanceActive = true;
        targetModelRotY = (Math.random() - 0.5) * 0.15;
        targetModelRotX = (Math.random() - 0.5) * 0.08;
        if (glanceTimer) clearTimeout(glanceTimer);
        glanceTimer = setTimeout(() => {
          glanceActive = false;
          targetModelRotY = targetModelRotX = targetModelRotZ = 0;
        }, HEAD_GLANCE_DURATION);
      }
    } else if (currentState === 'speaking') {
      const t = (performance.now() - speechStartTime) * 0.001;
      targetModelRotY = Math.sin(t * 0.5) * 0.025;
      targetModelRotX = Math.cos(t * 0.3) * 0.012;
      targetModelRotZ = Math.sin(t * 0.4) * 0.008;
    }
  }

  const lerp = 0.08;
  modelRotY += (targetModelRotY - modelRotY) * lerp;
  modelRotX += (targetModelRotX - modelRotX) * lerp;
  modelRotZ += (targetModelRotZ - modelRotZ) * lerp;
  avatarModel.rotation.y = modelRotY;
  avatarModel.rotation.x = modelRotX;
  avatarModel.rotation.z = modelRotZ;
}

// =====================================================
// IDLE ANIMATION
// =====================================================
function updateIdleAnimation(deltaTime) {
  breathePhase += deltaTime * 0.8;
  const b = Math.sin(breathePhase) * 0.012 + 0.012;
  // Only animate jawOpen for breathing – never mouthClose alongside it
  smoothMorph('jawOpen',    b,   0.03, 0.03);
  smoothMorph('mouthClose', 0,   0.03, 0.03);
  const brow = Math.sin(breathePhase * 0.5) * EXPRESSION_INTENSITY * 0.3;
  smoothMorph('browInnerUp', Math.max(0, brow), 0.05, 0.05);

  // Post-speech smile overlay
  if (smileActive) {
    const elapsed = performance.now() - smileStartTime;
    const total   = SMILE_DURATION_MS + SMILE_FADE_MS * 2;
    let weight = 0;
    if (elapsed < SMILE_FADE_MS) {
      weight = elapsed / SMILE_FADE_MS;                           // fade in
    } else if (elapsed < SMILE_FADE_MS + SMILE_DURATION_MS) {
      weight = 1.0;                                                // hold
    } else if (elapsed < total) {
      weight = 1.0 - (elapsed - SMILE_FADE_MS - SMILE_DURATION_MS) / SMILE_FADE_MS; // fade out
    } else {
      weight = 0;
      smileActive = false;
    }
    const s = weight * 0.52;
    smoothMorph('mouthSmile_L',   s,        0.08, 0.06);
    smoothMorph('mouthSmile_R',   s,        0.08, 0.06);
    smoothMorph('cheekSquint_L',  s * 0.5,  0.08, 0.06);
    smoothMorph('cheekSquint_R',  s * 0.5,  0.08, 0.06);
    smoothMorph('browOuterUp_L',  s * 0.3,  0.06, 0.05);
    smoothMorph('browOuterUp_R',  s * 0.3,  0.06, 0.05);
    smoothMorph('mouthDimple_L',  s * 0.4,  0.07, 0.05);
    smoothMorph('mouthDimple_R',  s * 0.4,  0.07, 0.05);
  }
}

// =====================================================
// POST-SPEECH SMILE TRIGGER
// =====================================================
function triggerPostSpeechSmile() {
  smileActive    = true;
  smileStartTime = performance.now();
}

// =====================================================
// LIP SYNC CORE
// =====================================================

/**
 * Called once at speech start with the full text.
 * Pre-builds the word phoneme list.
 * Actual timing will be filled in via boundary events.
 */
function initLipSync(text) {
  wordPhonemeEvents = textToPhonemeEvents(text);
  wordBoundaryLog = [];
  lipTimeline = [];
  lipTimelineIdx = 0;
  speechStartTime = performance.now();
}

/**
 * Called on each 'boundary' event from SpeechSynthesisUtterance.
 * Locks in timing for each spoken word.
 */
function onWordBoundary(charIndex, charLength) {
  const elapsedMs = performance.now() - speechStartTime;

  // Find the word in our phoneme event list by charIndex match
  const wordIdx = wordPhonemeEvents.findIndex(ev =>
    charIndex >= ev.charStart && charIndex < ev.charEnd
  );
  if (wordIdx < 0) return;

  wordBoundaryLog.push({ wordIdx, charIndex, elapsedMs });

  // Rebuild timeline for all words we have timing for
  rebuildTimeline();
}

/**
 * Rebuild the full phoneme timeline after each new word boundary event.
 * Words with known start times use exact timing.
 * Words after the last known word are estimated forward.
 */
function rebuildTimeline() {
  const newFrames = [];

  for (let wi = 0; wi < wordPhonemeEvents.length; wi++) {
    const wev = wordPhonemeEvents[wi];
    if (!wev.phonemes.length) continue;

    let wordStartMs, wordDurationMs;

    // Find this word in boundary log
    const logged = wordBoundaryLog.find(b => b.wordIdx === wi);
    const nextLogged = wordBoundaryLog.find(b => b.wordIdx > wi);

    if (logged) {
      wordStartMs = logged.elapsedMs;
      // Duration = time until next word, or estimate
      if (nextLogged) {
        wordDurationMs = nextLogged.elapsedMs - logged.elapsedMs;
      } else {
        // Estimate based on phoneme count
        wordDurationMs = estimateWordDuration(wev.phonemes);
      }
    } else if (wordBoundaryLog.length > 0) {
      // Estimate based on last known word
      const lastLog = wordBoundaryLog[wordBoundaryLog.length - 1];
      const gapWords = wi - lastLog.wordIdx;
      let offsetMs = 0;
      for (let j = lastLog.wordIdx; j < wi; j++) {
        if (wordPhonemeEvents[j]) {
          offsetMs += estimateWordDuration(wordPhonemeEvents[j].phonemes);
        }
      }
      wordStartMs = lastLog.elapsedMs + offsetMs;
      wordDurationMs = estimateWordDuration(wev.phonemes);
    } else {
      // No boundary data yet – use pure estimate from start
      let offsetMs = 0;
      for (let j = 0; j < wi; j++) {
        if (wordPhonemeEvents[j]) offsetMs += estimateWordDuration(wordPhonemeEvents[j].phonemes);
      }
      wordStartMs = offsetMs;
      wordDurationMs = estimateWordDuration(wev.phonemes);
    }

    // Build phoneme frames for this word
    const phones = wev.phonemes;
    const totalUnits = phones.reduce((s, p) => {
      const sk = PHONEME_TO_SHAPE[p.replace(/[0-9]/g,'')] || 'AH';
      return s + (PHONEME_BASE_DURATION[sk] || 80);
    }, 0);

    let t = wordStartMs;
    for (const p of phones) {
      const rawPhone = p.replace(/[0-9]/g,'');
      const shapeKey = PHONEME_TO_SHAPE[rawPhone] || 'AH';
      const baseDur  = PHONEME_BASE_DURATION[shapeKey] || 80;
      const dur      = Math.max(28, (baseDur / totalUnits) * wordDurationMs);
      newFrames.push({ timeMs: t, shapeKey, durationMs: dur });
      t += dur;
    }
  }

  newFrames.sort((a,b) => a.timeMs - b.timeMs);
  lipTimeline = newFrames;
  // Don't reset index – keep playing from current position
}

function estimateWordDuration(phonemes) {
  return phonemes.reduce((s, p) => {
    const sk = PHONEME_TO_SHAPE[p.replace(/[0-9]/g,'')] || 'AH';
    return s + (PHONEME_BASE_DURATION[sk] || 80);
  }, 0);
}

/**
 * Per-frame lip sync update.
 * Reads current elapsed time, finds active phoneme + next phoneme,
 * blends between them, applies to morphs.
 */
function updateLipSync() {
  if (!isSpeaking) {
    resetMouthSmooth(0.25);
    return;
  }

  const elapsedMs = performance.now() - speechStartTime;

  // Advance index to current frame
  while (lipTimelineIdx < lipTimeline.length - 1 &&
         elapsedMs >= lipTimeline[lipTimelineIdx + 1].timeMs) {
    lipTimelineIdx++;
  }

  const frame = lipTimeline[lipTimelineIdx];
  if (!frame) {
    // No frame data yet – animate generic mouth movement
    const t = elapsedMs * 0.001;
    const amp = 0.4 + Math.sin(t * 6) * 0.2;
    smoothMorph('jawOpen',    amp * 0.5, VISEME_SMOOTHING_IN, VISEME_SMOOTHING_OUT);
    smoothMorph('mouthClose', 0,         VISEME_SMOOTHING_IN, VISEME_SMOOTHING_OUT);
    return;
  }

  // How far through this phoneme are we? (0–1)
  const frameEnd = frame.timeMs + frame.durationMs;
  const progress = Math.max(0, Math.min(1,
    (elapsedMs - frame.timeMs) / frame.durationMs
  ));

  // Coarticulation: blend with next phoneme in last 35% of current frame
  let blendShapeKey = frame.shapeKey;
  let blendFactor   = 0;

  if (progress > 0.65 && lipTimelineIdx + 1 < lipTimeline.length) {
    blendShapeKey = lipTimeline[lipTimelineIdx + 1].shapeKey;
    blendFactor   = (progress - 0.65) / 0.35;
  }

  // Amplitude envelope: ramp up at start, ramp down at end of each phoneme
  // This prevents sudden hard transitions and looks natural
  let amp = 1.0;
  if (progress < 0.12) amp = progress / 0.12;
  else if (progress > 0.88) amp = (1.0 - progress) / 0.12;

  applyBlendedViseme(frame.shapeKey, blendShapeKey, blendFactor, amp);

  // Expressive brows during speech
  const speakT = elapsedMs * 0.001;
  const browUp = Math.max(0, Math.sin(speakT * 2.2) * EXPRESSION_INTENSITY * 0.5);
  smoothMorph('browInnerUp', browUp, 0.1, 0.08);
  smoothMorph('browDown_L',  Math.max(0, -Math.sin(speakT * 1.8) * 0.15), 0.1, 0.08);
  smoothMorph('browDown_R',  Math.max(0, -Math.sin(speakT * 1.8) * 0.15), 0.1, 0.08);

  // Subtle cheek squint
  const cheekAct = Math.max(0, Math.sin(speakT * 1.5) * 0.08);
  smoothMorph('cheekSquint_L', cheekAct, 0.06, 0.05);
  smoothMorph('cheekSquint_R', cheekAct, 0.06, 0.05);
}

// =====================================================
// RENDER LOOP
// =====================================================
let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt  = (now - lastTime) * 0.001;
  lastTime  = now;

  if (!isPageVisible) { renderer.render(scene, camera); return; }

  if (faceMesh) {
    updateBlinking();
    updateEyeSaccades();
    updateHeadMotion(dt);

    if (currentState === 'idle' && !isSpeaking) {
      updateIdleAnimation(dt);
    } else if (isSpeaking || currentState === 'speaking') {
      updateLipSync();
    }
  }
  renderer.render(scene, camera);
}
animate();

// =====================================================
// UI CONTROLS
// =====================================================
const textInput  = document.getElementById('text-input');
const speakBtn   = document.getElementById('speak-btn');
const stopBtn    = document.getElementById('stop-btn');
const voiceSelect= document.getElementById('voice-select');

let voices = [], selectedVoice = null, utterance = null;

function loadVoices() {
  voices = speechSynthesis.getVoices();
  if (!voices.length) { setTimeout(loadVoices, 100); return; }
  voiceSelect.innerHTML = '';
  const engVoices = voices.filter(v => v.lang.startsWith('en'));
  const toShow    = engVoices.length ? engVoices : voices;
  toShow.forEach((v, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${v.name} (${v.lang})`;
    if (v.default) opt.selected = true;
    voiceSelect.appendChild(opt);
  });
  if (!selectedVoice && toShow.length) selectedVoice = toShow[0];
}
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = loadVoices;
}
loadVoices();

voiceSelect.addEventListener('change', (e) => {
  const all = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
  const toShow = all.length ? all : speechSynthesis.getVoices();
  selectedVoice = toShow[parseInt(e.target.value, 10)];
});

function updateStatus(text, speaking) {
  document.getElementById('status').classList.toggle('speaking', speaking);
  document.getElementById('status-text').textContent = text;
}

function returnHeadToCenter(cb) {
  if (!avatarModel) { cb?.(); return; }
  currentState = 'returning';
  targetModelRotY = targetModelRotX = targetModelRotZ = 0;
  const chk = setInterval(() => {
    if (Math.abs(modelRotY) + Math.abs(modelRotX) + Math.abs(modelRotZ) < 0.005) {
      clearInterval(chk);
      currentState = 'idle';
      cb?.();
    }
  }, 50);
}

function stopSpeech() {
  if (pauseTimeout) clearTimeout(pauseTimeout);
  speechSynthesis.cancel();
  isSpeaking = false;
  currentState = 'idle';
  activeSpeech = null;
  smileActive  = false;
  resetMouthInstant();
  updateStatus('Ready', false);
  speakBtn.disabled = false;
  stopBtn.disabled  = true;
  targetModelRotY = targetModelRotX = targetModelRotZ = 0;
}

// =====================================================
// MAIN SPEAK HANDLER
// =====================================================
speakBtn.addEventListener('click', () => {
  const rawText = textInput.value.trim();
  if (!rawText)     { alert('Please enter some text first!'); return; }
  if (!faceMesh) { alert('Avatar is still loading...'); return; }

  
  // Split on punctuation (! . ? , : ;) and keep segments
  const segments = splitOnPunctuation(rawText);
  if (segments.length === 0) { alert('No valid text after cleaning.'); return; }

  speechSynthesis.cancel();
  isSpeaking = false;
  resetMouthInstant();

  returnHeadToCenter(() => {
    let currentSegment = 0;

    function speakNextSegment() {
      if (currentSegment >= segments.length) {
        // All done – brief pause then smile
        setTimeout(() => {
          if (!isSpeaking) return;
          isSpeaking = false;
          currentState = 'idle';
          activeSpeech = null;
          resetMouthSmooth(0.18);
          triggerPostSpeechSmile();
          updateStatus('Ready', false);
          speakBtn.disabled = false;
          stopBtn.disabled = true;
        }, 80);
        return;
      }

      const segmentRaw = segments[currentSegment];
      const cleanedSegment = cleanTextForSpeech(segmentRaw);
      if (!cleanedSegment.trim()) {
        // Empty segment – skip and move to next (no pause)
        currentSegment++;
        speakNextSegment();
        return;
      }

      // Initialize lip sync for this segment
      initLipSync(cleanedSegment);

      utterance = new SpeechSynthesisUtterance(cleanedSegment);
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.rate  = 1.0;
      utterance.pitch = 1.0;

      utterance.addEventListener('boundary', (e) => {
        if (e.name === 'word') {
          onWordBoundary(e.charIndex, e.charLength || 0);
        }
      });

      utterance.onstart = () => {
        speechStartTime = performance.now();
        rebuildTimeline();
        lipTimelineIdx = 0;
        isSpeaking = true;
        currentState = 'speaking';
        activeSpeech = utterance;
        updateStatus('Speaking...', true);
        speakBtn.disabled = true;
        stopBtn.disabled = false;
      };

      utterance.onend = () => {
        // Segment finished – schedule next with second pause
        currentSegment++;
        if (currentSegment < segments.length) {
          // Pause for second before next segment
          pauseTimeout = setTimeout(speakNextSegment, 150);
        } else {
          // Last segment – end speech after a short grace
          setTimeout(() => {
            if (!isSpeaking) return;
            isSpeaking = false;
            currentState = 'idle';
            activeSpeech = null;
            resetMouthSmooth(0.18);
            triggerPostSpeechSmile();
            updateStatus('Ready', false);
            speakBtn.disabled = false;
            stopBtn.disabled = true;
          }, 80);
        }
      };

      utterance.onerror = (e) => {
        console.error('Speech error:', e);
        stopSpeech();
      };

      speechSynthesis.speak(utterance);
    }

    speakNextSegment();
  });
});

stopBtn.addEventListener('click', stopSpeech);

textInput.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') speakBtn.click();
});

// =====================================================
// CLICK REACTION
// =====================================================
function triggerRandomReaction() {
  if (!faceMesh || isSpeaking || clickReactionActive) return;
  const reactions = [
    { browInnerUp:0.6, browOuterUp_L:0.5, browOuterUp_R:0.5, eyeWide_L:0.7, eyeWide_R:0.7, jawOpen:0.3, mouthFunnel:0.2 },
    { mouthSmile_L:0.7, mouthSmile_R:0.7, cheekSquint_L:0.4, cheekSquint_R:0.4, browInnerUp:0.2, eyeSquint_L:0.2, eyeSquint_R:0.2 },
    { browDown_L:0.4, browDown_R:0.4, mouthFrown_L:0.5, mouthFrown_R:0.5, browInnerUp:0.1 },
    { browDown_L:0.7, browDown_R:0.7, mouthPress_L:0.5, mouthPress_R:0.5, noseSneer_L:0.4, noseSneer_R:0.4, jawOpen:0.1 },
  ];
  const r = reactions[Math.floor(Math.random() * reactions.length)];
  Object.entries(r).forEach(([m,v]) => smoothMorph(m, v, 0.3, 0.3));
  clickReactionActive = true;
  setTimeout(() => {
    Object.keys(r).forEach(m => smoothMorph(m, 0, 0.2, 0.2));
    clickReactionActive = false;
  }, 1500);
}

// =====================================================
// DRAG TO ROTATE
// =====================================================
let isDragging = false, lastMouseX = 0, lastMouseY = 0;
const ROT_SPEED = 0.005;

renderer.domElement.addEventListener('mousedown', (e) => {
  if (!avatarModel) return;
  const mouse = new THREE.Vector2(
    (e.clientX / renderer.domElement.clientWidth) * 2 - 1,
    -(e.clientY / renderer.domElement.clientHeight) * 2 + 1
  );
  const rc = new THREE.Raycaster();
  rc.setFromCamera(mouse, camera);
  if (rc.intersectObject(faceMesh || avatarModel, true).length) triggerRandomReaction();
  isDragging = true;
  isUserControlling = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging || !avatarModel) return;
  targetModelRotY += (e.clientX - lastMouseX) * ROT_SPEED;
  targetModelRotX += (e.clientY - lastMouseY) * ROT_SPEED * 0.5;
  targetModelRotX  = Math.max(-0.5, Math.min(0.5, targetModelRotX));
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

window.addEventListener('mouseup', () => {
  isDragging = false;
  isUserControlling = false;
});

// =====================================================
// CLEANUP
// =====================================================
window.addEventListener('beforeunload', () => {
  if (glanceTimer) clearTimeout(glanceTimer);
  if (pauseTimeout) clearTimeout(pauseTimeout);
  speechSynthesis.cancel();
});

console.log('✓ Production Avatar Engine – Boundary-locked lip sync with full ARKit morphs (v7.2 - Stable)');
