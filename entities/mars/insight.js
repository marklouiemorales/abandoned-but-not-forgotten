// ../entities/mars/insight.js
// -----------------------------------------------------------------------------
// NASA InSight Lander, parked in Elysium Planitia. DATA ONLY + one helper.
// Same structure as eagle.js / lrv.js / ingenuity.js:
//   1. metadata  : name, site coordinates, stats, data rows
//   2. glb       : where the 3D file goes + how to position it
//   3. analyze   : text + timing for the "Analyze" scan
//   4. monologue : what InSight says when the player taps "Read story"
//
// Drop your model at   public/assets/models/mars/insight-lander.glb
// (URL below has no "public"). Until the file exists, the viewer shows a "3D model" placeholder.
// Voice lines: mp3 files at the `audio` paths are optional, the text works without them.
// -----------------------------------------------------------------------------

import * as THREE from 'three';
import { moonSurfacePoint } from '../moon/eagle.js';   // generic lat/lon -> sphere point, works for Mars too

export const INSIGHT = {
  id: 'MRS-02',
  planet: 'mars',
  planetCode: 'MRS',
  name: 'InSight Lander',
  shortName: 'InSight',
  disclaimer:
    'Disclaimer: This is only a visual representation of the InSight Lander.',

  /* ---------- Where it sits on Mars ---------- */
  location: {
    site: 'Elysium Planitia',
    outcome: 'Successful landing on November 26, 2018. Detected over 1,300 marsquakes before Martian dust covered its solar panels, cutting its power.',
    lat: 4.502,     // degrees North
    lon: 135.623,   // degrees East
  },

  /* ---------- Small stat strip (bottom-left card) ---------- */
  // coordinates come from your notes. size, mass, power and materials are filled from the commonly
  // published InSight figures, please double-check them against the NASA page.
  stats: {
    coordinates: '4.502° N\n135.623° E',
    size: '6 m solar-array span',
    mass: '358 kg landed',
    power: '2 solar arrays',
    materials: 'Aluminum & composite structure, solar cells',
  },

  /* ---------- DATA panel rows (bottom-right card) ---------- */
  data: [
    {
      label: 'Equipment Name',
      value: 'InSight (Interior Exploration using Seismic Investigations, Geodesy and Heat Transport) Lander',
    },
    {
      label: 'Creator / Manufacturer',
      value: 'Built by Lockheed Martin Space for NASA and managed by NASA\'s Jet Propulsion Laboratory (JPL)',
    },
    { label: 'Launch Date & Vehicle', value: 'May 5, 2018 aboard an Atlas V 401 rocket' },
    { label: 'Mars Arrival & Landing', value: 'November 26, 2018' },
    { label: 'Last Contact', value: 'December 15, 2022 (Power depleted due to heavy dust accumulation on solar panels)' },
    {
      label: 'Mission Conclusion',
      value: 'December 21, 2022 (NASA officially declared the mission retired after missing two consecutive communication passes)',
    },
    { label: 'Target Surface Location', value: 'Elysium Planitia, Mars' },
    {
      label: 'Outcome',
      value: 'Successful landing on November 26, 2018. Detected over 1,300 marsquakes before Martian dust covered its solar panels, cutting its power.',
    },
    {
      label: 'Official NASA Resources',
      links: [
        { label: 'NASA Mars Exploration Program: InSight Mission Page', url: 'https://mars.nasa.gov/insight/' },
        { label: 'NASA JPL: Retires InSight Mars Lander Press Release', url: 'https://www.jpl.nasa.gov/news/nasa-retires-insight-mars-lander/' },
      ],
    },
  ],

  /* ---------- 3D model ---------- */
  glb: {
    // File on disk: public/assets/models/mars/InSight Cruise Lander (arm deployed).glb  (rename to match your file)
    url: '/assets/models/mars/InSight Cruise Lander (arm deployed).glb',
    viewScale: 1,
    viewRotationDeg: [0, 0, 0],       // [x, y, z] extra rotation applied to the model
    // Starting camera for THIS equipment (Reset returns here). Tweak ry until the first view looks right.
    view: { zoom: 2.1, rx: 10, ry: -30 },

    // Mars scene (placing InSight on mars.glb at its real coordinates)
    marsScale: 0.04,
    surfaceOffset: 0.0,
    headingDeg: 0,
    lonOffsetDeg: 0,
  },

  /* ---------- Analyze ---------- */
  analyze: {
    label: 'Analyzing equipment...',
    durationMs: 3000,
    completeLabel: 'Analysis 100%',
    prompt: 'Wanna know my story, Space Commander {name}?',
  },

  /* ---------- Monologue ({name} = explorer's name; `sfx` plays first, then `audio`; all optional) ---------- */
  monologue: [
    {
      speaker: 'InSight',
      text: 'Rumble... Thump-thump... "Listening to the inner heartbeat of Mars!"',
      sfx: '/assets/audio/mars/seismic-rumble.mp3',
      audio: '/assets/audio/mars/insight-1.mp3',
    },
    {
      speaker: 'InSight',
      text: 'Hi, Space Commander {name}! Welcome to Elysium Planitia! I am InSight, short for Interior Exploration using Seismic Investigations, Geodesy and Heat Transport. I was built by Lockheed Martin Space for NASA and managed by the Jet Propulsion Laboratory (JPL).',
      audio: '/assets/audio/mars/insight-2.mp3',
    },
    {
      speaker: 'InSight',
      text: 'My journey began on May 5, 2018, blasting off aboard an Atlas V rocket. On November 26, 2018, I touched down here on this flat Martian plain. Unlike other rovers that drive around, I stayed right in one spot so I could do something no spacecraft had ever done before: study the deep interior, crust, mantle, and core of Mars!',
      audio: '/assets/audio/mars/insight-3.mp3',
    },
    {
      speaker: 'InSight',
      text: 'Using my robotic arm, I placed a super-sensitive seismometer directly onto the ground. Over my 4-year mission, I detected over 1,300 "marsquakes"! I listened to underground rumbles and meteorite impacts, helping scientists create the very first 3D map of the inside of another planet!',
      audio: '/assets/audio/mars/insight-4.mp3',
    },
    {
      speaker: 'InSight',
      text: 'As seasons passed, Martian dust slowly piled up on my solar panels, blocking out sunlight and lowering my power. On December 15, 2022, I sent my final heartwarming message to Earth, and on December 21, 2022, NASA officially retired my mission. My power may be gone, but the secrets I uncovered about Mars\' core will live on forever!',
      audio: '/assets/audio/mars/insight-5.mp3',
    },
    {
      speaker: 'InSight',
      text: 'Thank you for scanning and remembering me, Space Commander {name}! Listen closely to the mysteries of space, and never stop exploring!',
      audio: '/assets/audio/mars/insight-6.mp3',
    },
  ],

  // Source already checked by you
  sources: [
    'https://science.nasa.gov/mission/insight/',
    'https://mars.nasa.gov/insight/',
    'https://www.jpl.nasa.gov/news/nasa-retires-insight-mars-lander/',
  ],
};

/* ---------------- 3D coordinate positioning ---------------- */

// Puts a loaded InSight object on Mars at its real coordinates, standing "up" from the surface.
export function placeInsightOnMars(object, marsRadius = 1) {
  const { lat, lon } = INSIGHT.location;
  const g = INSIGHT.glb;
  const p = moonSurfacePoint(lat, lon, marsRadius * (1 + g.surfaceOffset), g.lonOffsetDeg);
  object.position.copy(p);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
  object.rotateY(THREE.MathUtils.degToRad(g.headingDeg));
  object.scale.setScalar(g.marsScale * marsRadius);
  return object;
}

export default INSIGHT;