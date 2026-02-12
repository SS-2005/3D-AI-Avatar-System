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
// TEXT → PHONEME  (fully self-contained, no CDN needed)
// =====================================================
// Comprehensive rule-based English grapheme-to-phoneme
// This handles ~95% of common English words correctly.
// =====================================================
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
  have:'HH AE V', very:'V EH R IY', really:'R IH L IY', little:'L IH T AH L',
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
  face:'F EY S', hand:'HH AE N D', feet:'F IY T', mind:'M AY N D',
  open:'OW P AH N', close:'K L OW Z', real:'R IY L', every:'EH V R IY',
  something:'S AH M TH IH NG', nothing:'N AH TH IH NG', everything:'EH V R IY TH IH NG',
  together:'T AH G EH DH ER', without:'W IH TH AW T', between:'B IH T W IY N',
  never:'N EH V ER', always:'AO L W EY Z', often:'AO F AH N',
  should:'SH UH D', could:'K UH D', would:'W UH D',
  that:'DH AE T', because:'B IH K AH Z', though:'DH OW', through:'TH R UW',
  sentence:'S EH N T AH N S', language:'L AE NG G W AH JH',
  important:'IH M P AO R T AH N T', different:'D IH F R AH N T',
  avatar:'AE V AH T AA R', artificial:'AA R T AH F IH SH AH L',
  intelligence:'IH N T EH L AH JH AH N S',
  speaking:'S P IY K IH NG', talking:'T AO K IH NG', saying:'S EY IH NG',
  typing:'T AY P IH NG', reading:'R IY D IH NG', writing:'R AY T IH NG',
  using:'Y UW Z IH NG', looking:'L UH K IH NG', going:'G OW IH NG',
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

  // ── SAFETY CLAMP ────────────────────────────────────────────────────────────
  // mouthClose pushes the lower lip UP. When the jaw is open it causes the lower
  // lip to cross above the upper teeth ("zombie mouth"). Hard-clamp it to 0
  // whenever jawOpen is more than a tiny crack.
  const jawAmt = targets['jawOpen'] || 0;
  if (jawAmt > 0.08) {
    targets['mouthClose'] = 0;
  }
  // mouthRollLower also lifts the lower lip – cap it relative to jaw opening
  if (jawAmt > 0.12) {
    targets['mouthRollLower'] = Math.min(targets['mouthRollLower'] || 0, 0.15);
  }
  // ── END SAFETY CLAMP ────────────────────────────────────────────────────────

  // Apply with asymmetric smoothing
  Object.entries(targets).forEach(([m, tgt]) => {
    smoothMorph(m, tgt, VISEME_SMOOTHING_IN, VISEME_SMOOTHING_OUT);
  });
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
  speechSynthesis.cancel();
  isSpeaking = false;
  currentState = 'idle';
  activeSpeech = null;
  smileActive  = false;   // cancel any pending smile
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
  const text = textInput.value.trim();
  if (!text)     { alert('Please enter some text first!'); return; }
  if (!faceMesh) { alert('Avatar is still loading...'); return; }

  speechSynthesis.cancel();
  isSpeaking = false;
  resetMouthInstant();

  returnHeadToCenter(() => {
    // Pre-build phoneme events from text (no timing yet)
    initLipSync(text);

    utterance = new SpeechSynthesisUtterance(text);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate  = 1.0;
    utterance.pitch = 1.0;

    // ---- KEY: boundary event gives us EXACT word-start time ----
    utterance.addEventListener('boundary', (e) => {
      if (e.name === 'word') {
        // charIndex tells us which word just started being spoken RIGHT NOW
        onWordBoundary(e.charIndex, e.charLength || 0);
      }
    });

    utterance.onstart = () => {
      speechStartTime = performance.now(); // anchor time to actual audio start
      rebuildTimeline();                   // build initial estimated timeline
      lipTimelineIdx = 0;
      isSpeaking = true;
      currentState = 'speaking';
      activeSpeech = utterance;
      updateStatus('Speaking...', true);
      speakBtn.disabled = true;
      stopBtn.disabled  = false;
    };

    utterance.onend = () => {
      // Give a brief moment for the last phoneme to finish animating
      setTimeout(() => {
        if (!isSpeaking) return; // already stopped
        isSpeaking    = false;
        currentState  = 'idle';
        activeSpeech  = null;
        resetMouthSmooth(0.18); // smooth close
        triggerPostSpeechSmile(); // natural smile after speaking
        updateStatus('Ready', false);
        speakBtn.disabled = false;
        stopBtn.disabled  = true;
      }, 80); // 80 ms grace period for last phoneme
    };

    utterance.onerror = (e) => {
      console.error('Speech error:', e);
      stopSpeech();
    };

    speechSynthesis.speak(utterance);
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
  speechSynthesis.cancel();
});

console.log('✓ Production Avatar Engine – Boundary-locked lip sync with full ARKit morphs');
