// ../entities/moon/lrv.js
// -----------------------------------------------------------------------------
// Apollo 15 Lunar Roving Vehicle (LRV-1), the "Moon Buggy". DATA ONLY + one helper.
// Same structure as eagle.js:
//   1. metadata  : name, site coordinates, stats, data rows
//   2. glb       : where the 3D file goes + how to position it
//   3. analyze   : text + timing for the "Analyze" scan
//   4. monologue : what the Moon Buggy says when the player taps "Read story"
//
// Drop your model at   public/assets/models/moon/apollo-15-lunar-roving-vehicle.glb
// (URL below has no "public"). Until the file exists, the viewer shows a "3D model" placeholder.
// Voice lines: mp3 files at the `audio` paths are optional, the text works without them.
// -----------------------------------------------------------------------------

import * as THREE from 'three';
import { moonSurfacePoint } from './eagle.js';

export const LRV = {
  id: 'LUN-02',
  planet: 'moon',
  planetCode: 'LUN',
  name: 'Apollo 15 Lunar Roving Vehicle (LRV-1)',
  shortName: 'Moon Buggy',
  disclaimer:
    'Disclaimer: This is only a visual representation of Apollo 15 Lunar Roving Vehicle (LRV-1).',

  /* ---------- Where it sits on the Moon ---------- */
  location: {
    site: 'Hadley-Apennine',
    outcome: 'Successful deployment on July 31, 1971. Driven 27.9 km across the Moon by astronauts David Scott and James Irwin before being parked permanently.',
    lat: 26.1322,   // degrees North
    lon: 3.6339,    // degrees East
  },

  /* ---------- Small stat strip (bottom-left card) ---------- */
  // coordinates / power come from your notes. size, mass and materials are filled from the commonly
  // published LRV figures, please double-check them against the NASA pages below.
  stats: {
    coordinates: '26.1322° N\n3.6339° E',
    size: '3.1 m long\n2.3 m wheelbase',
    mass: '210 kg empty',
    power: '2 silver-zinc batteries',
    materials: 'Aluminum tubing, woven steel-wire wheels',
  },

  /* ---------- DATA panel rows (bottom-right card) ---------- */
  data: [
    { label: 'Equipment Name', value: 'Apollo 15 Lunar Roving Vehicle (LRV) / "Moon Buggy"' },
    { label: 'Creator / Manufacturer', value: 'Built by Boeing under contract to NASA Marshall Space Flight Center' },
    { label: 'Launch Date & Vehicle', value: 'July 26, 1971 aboard a Saturn V rocket' },
    { label: 'Moon Arrival & First Drive', value: 'July 30, 1971 (Landed); July 31, 1971 (First lunar drive)' },
    { label: 'Active Operations', value: 'July 31 - August 2, 1971 (Logged 3 hours and 2 minutes of total driving time)' },
    {
      label: 'Mission Conclusion',
      value: 'August 2, 1971 (Parked away from the Lunar Module to film the lift-off of the ascent stage; remains parked on the Moon)',
    },
    { label: 'Target Surface Location', value: 'Hadley-Apennine, Moon' },
    {
      label: 'Outcome',
      value: 'Successful deployment on July 31, 1971. Driven 27.9 km across the Moon by astronauts David Scott and James Irwin before being parked permanently.',
    },
    {
      label: 'Official NASA Resources',
      links: [
        { label: 'NASA Marshall Space Flight Center: LRV Overview', url: 'https://www.nasa.gov/centers/marshall/history/lunar_roving_vehicle.html' },
        { label: 'NASA Apollo 15 Lunar Surface Journal', url: 'https://www.hq.nasa.gov/alsj/a15/a15.rover.html' },
      ],
    },
  ],

  /* ---------- 3D model ---------- */
  glb: {
    // File on disk: public/assets/models/moon/apollo-15-lunar-roving-vehicle.glb  (rename to match your file)
    url: '/assets/models/moon/LRV02_che02_nurColor.glb',
    viewScale: 1,
    viewRotationDeg: [0, 0, 0],       // [x, y, z] extra rotation applied to the model
    // Starting camera for THIS equipment (Reset returns here). A rover is long and low, so tweak ry
    // until the first view looks right. Falls back to VIEWER_CONFIG.view when left out.
    view: { zoom: 2.1, rx: 8, ry: -35 },

    // Moon scene (placing the rover on moon.glb at its real coordinates)
    moonScale: 0.04,
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
      speaker: 'Moon Buggy',
      text: 'Vroom... Beep-beep! "Humanity\'s first lunar road trip!"',
      sfx: '/assets/audio/moon/buggy-engine.mp3',
      audio: '/assets/audio/moon/lrv-1.mp3',
    },
    {
      speaker: 'Moon Buggy',
      text: 'Hi, Space Commander {name}! Welcome to the mountainous region of Hadley-Apennine! I am the Apollo 15 Lunar Roving Vehicle, but everyone lovingly calls me the "Moon Buggy"! Boeing built me for NASA under the direction of the Marshall Space Flight Center.',
      audio: '/assets/audio/moon/lrv-2.mp3',
    },
    {
      speaker: 'Moon Buggy',
      text: 'My journey began on July 26, 1971, riding aboard a giant Saturn V rocket. After landing on July 30, astronauts David Scott and James Irwin unfolded me from the Lunar Module, and on July 31, 1971, I went on my very first drive, becoming the first crewed electric vehicle ever driven on another world!',
      audio: '/assets/audio/moon/lrv-3.mp3',
    },
    {
      speaker: 'Moon Buggy',
      text: 'I was powered by special silver-zinc batteries and designed with woven steel wire tires so I wouldn\'t sink into the soft moon dust. Across 3 total drives, I logged over 3 hours of driving time and carried Dave and Jim across 27.9 kilometers of craters and mountain slopes, allowing them to collect heavy moon rocks and explore far beyond their landing site!',
      audio: '/assets/audio/moon/lrv-4.mp3',
    },
    {
      speaker: 'Moon Buggy',
      text: 'On August 2, 1971, my driving days ended. The astronauts carefully parked me a safe distance away so my mounted color TV camera could film their upper spacecraft lifting off into lunar orbit. Today, I am still parked right here in Hadley-Apennine, proud to have been the ultimate road trip companion in space history!',
      audio: '/assets/audio/moon/lrv-5.mp3',
    },
    {
      speaker: 'Moon Buggy',
      text: 'Thank you for scanning and visiting me, Space Commander {name}! Keep rolling forward, and never stop exploring!',
      audio: '/assets/audio/moon/lrv-6.mp3',
    },
  ],

  // Source already checked by you
  sources: [
    'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1971-063C',
    'https://www.nasa.gov/centers/marshall/history/lunar_roving_vehicle.html',
    'https://www.hq.nasa.gov/alsj/a15/a15.rover.html',
  ],
};

/* ---------------- 3D coordinate positioning ---------------- */

// Puts a loaded LRV object on the Moon at its real coordinates, standing "up" from the surface.
export function placeLrvOnMoon(object, moonRadius = 1) {
  const { lat, lon } = LRV.location;
  const g = LRV.glb;
  const p = moonSurfacePoint(lat, lon, moonRadius * (1 + g.surfaceOffset), g.lonOffsetDeg);
  object.position.copy(p);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
  object.rotateY(THREE.MathUtils.degToRad(g.headingDeg));
  object.scale.setScalar(g.moonScale * moonRadius);
  return object;
}

export default LRV;