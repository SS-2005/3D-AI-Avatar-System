# 3D AI Avatar System :

PipeLine with Real time and zero latency for AI Avatar.

---


## To Run:

1. Run "start.bat"
2. Open URL in Browswer: http://localhost:8000
3. Type Text and click speak

---

## 📁 AI-TALKING-AVATAR PROJECT STRUCTURE

═══════════════════════════════════════════════════════════════
```
3D AI Avatar System/
│ 
│
├── 📱 CORE APPLICATION FILES (Required)
│   ├── index.html                Main app with UI 
│   ├── avatar.js                 Animation engine 
│   └── facecap.glb               3D model 
│
├── 📖 DOCUMENTATION
│   └── README.md                 Main documentation 
│
├── 🚀 DEPLOYMENT TOOLS
│   └── start.bat                 Windows startup script
│
└── 📊 PROJECT INFO
    └── FILE_STRUCTURE.txt        This file
```
---


═══════════════════════════════════════════════════════════════

QUICK START GUIDE

═══════════════════════════════════════════════════════════════

LOCAL TESTING :

───────────────────────────────────────────────────────────────
```
  Windows:   Double-click start.bat
  Manual:    python -m http.server 8000
  
  Then open: http://localhost:8000
```


═══════════════════════════════════════════════════════════════

## FILE PURPOSES

═══════════════════════════════════════════════════════════════
```
index.html
  • Beautiful UI with gradient backgrounds
  • Text input and control buttons
  • Responsive grid layout
  • Status indicator
  • Voice selection dropdown

avatar.js
  • Three.js 3D rendering engine
  • Viseme-based lip sync system (40+ phonemes)
  • Natural idle animations (breathing, blinking)
  • Expressive speaking animations
  • Post-speech smile
  • Web Speech API integration

facecap.glb
  • 3D face model with 52 morph targets
  • ARKit-compatible topology
  • KTX2 texture compression
  • Optimized for web performance

README.md
  • Project Feature overview
```
---

## MORPH TARGETS of "face.glb" :

```
browDown_L: 1
browDown_R: 2
browInnerUp:0
browOuterUp_L: 3
browOuterUp_R: 4
cheekPuff: 19
cheekSquint_L: 20
cheekSquint_R: 21
eyeBlink_L: 13
eyeBlink_R: 14
eyeLookDown_L: 7
eyeLookDown_R: 8
eyeLookIn_L: 9
eyeLookIn_R: 10
eyeLookOut_L: 11
eyeLookOut_R: 12
eyeLookUp_L: 5
eyeLookUp_R: 6
eyeSquint_L: 15
eyeSquint_R: 16
eyeWide_L: 17
eyeWide_R: 18
jawForward: 25
jawLeft: 26
jawOpen: 24
jawRight: 27
mouthClose: 36
mouthDimple_L: 41
mouthDimple_R: 42
mouthFrown_L: 39
mouthFrown_R: 40
mouthFunnel: 28
mouthLeft: 30
mouthLowerDown_L: 45
mouthLowerDown_R: 46
mouthPress_L: 47
mouthPress_R: 48
mouthPucker: 29
mouthRight: 31
mouthRollLower: 33
mouthRollUpper: 32
mouthShrugLower: 35
mouthShrugUpper: 34
mouthSmile_L: 37
mouthSmile_R: 38
mouthStretch_L: 49
mouthStretch_R: 50
mouthUpperUp_L: 43
mouthUpperUp_R: 44
noseSneer_L: 22
noseSneer_R: 23
tongueOut: 51

[[Prototype]]: Object
constructor: ƒ Object()
hasOwnProperty: ƒ hasOwnProperty()
isPrototypeOf: ƒ isPrototypeOf()
propertyIsEnumerable: ƒ propertyIsEnumerable()
toLocaleString: ƒ toLocaleString()
toString: ƒ toString()
valueOf: ƒ valueOf()
__defineGetter__: ƒ __defineGetter__()
__defineSetter__:ƒ __defineSetter__()
__lookupGetter__:ƒ __lookupGetter__()
__lookupSetter__: ƒ __lookupSetter__()
__proto__:(...)
get __proto__:ƒ __proto__()
set __proto__:ƒ __proto__()
﻿
```

---


═══════════════════════════════════════════════════════════════
  
  Ultra-lightweight and optimized for web! 🚀

═══════════════════════════════════════════════════════════════

---
## Sources :

3D Face Model :https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/facecap.glb
