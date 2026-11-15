// ../entities/moon/surveyor3.js
// -----------------------------------------------------------------------------
// Surveyor 3 lander, inside a crater in the Ocean of Storms. DATA ONLY + one helper.
// Same structure as eagle.js / lrv.js:
//   1. metadata  : name, site coordinates, stats, data rows
//   2. glb       : where the 3D file goes + how to position it
//   3. analyze   : text + timing for the "Analyze" scan
//   4. monologue : what Surveyor 3 says when the player taps "Read story"
//
// Drop your model at   public/models/moon/surveyor-3.glb
// (URL below has no "public"). Until the file exists, the viewer shows a "3D model" placeholder.
// Voice lines: mp3 files at the `audio` paths are optional, the text works without them.
// -----------------------------------------------------------------------------

import * as THREE from 'three';
import { moonSurfacePoint } from './eagle.js';

export const SURVEYOR3 = {
  id: 'LUN-03',
  planet: 'moon',
  planetCode: 'LUN',
  name: 'Surveyor 3',
  shortName: 'Surveyor 3',
  disclaimer:
    'Disclaimer: This is only a visual representation of Surveyor 3.',

  /* ---------- Where it sits on the Moon ---------- */
  location: {
    site: 'Ocean of Storms (Oceanus Procellarum)',
    outcome: 'Successful landing on April 20, 1967. Transmitted 6,315 TV images and dug into lunar soil before going silent during the lunar night.',
    lat: -3.01562,   // degrees South (negative)
    lon: -23.41824,  // degrees West (negative)
  },

  /* ---------- Small stat strip (bottom-left card) ---------- */
  // coordinates come from your notes. size, mass, power and materials are filled from the commonly
  // published Surveyor figures, please double-check them against the NASA page.
  stats: {
    coordinates: '3.01562° S\n23.41824° W',
    size: '3.0 m tall\nthree-legged lander',
    mass: '295 kg landed',
    power: 'Solar panel + silver-zinc battery',
    materials: 'Aluminum frame, TV camera, soil scoop',
  },

  /* ---------- DATA panel rows (bottom-right card) ---------- */
  data: [
    { label: 'Equipment Name', value: 'Surveyor 3' },
    {
      label: 'Creator / Manufacturer',
      value: 'Built by Hughes Aircraft Company for NASA and managed by NASA\'s Jet Propulsion Laboratory (JPL)',
    },
    { label: 'Launch Date & Vehicle', value: 'April 17, 1967 aboard an Atlas-Centaur rocket' },
    { label: 'Moon Arrival & Landing', value: 'April 20, 1967' },
    {
      label: 'Apollo 12 Astronaut Visit',
      value: 'November 19, 1969 (Apollo 12 landed nearby; astronauts Pete Conrad and Alan Bean visited Surveyor 3 and retrieved its camera to bring back to Earth)',
    },
    { label: 'Mission Conclusion', value: 'May 3, 1967 (Last transmission received after surviving its first lunar night)' },
    { label: 'Target Surface Location', value: 'Inside a crater in Ocean of Storms, Moon' },
    {
      label: 'Outcome',
      value: 'Successful landing on April 20, 1967. Transmitted 6,315 TV images and dug into lunar soil before going silent during the lunar night.',
    },
    {
      label: 'Official NASA Resources',
      links: [
        { label: 'NASA Science: Surveyor 3 Profile', url: 'https://science.nasa.gov/mission/surveyor-3/' },
        {
          label: 'NASA LRO: Apollo 12 & Surveyor 3 Site',
          url: 'https://www.nasa.gov/mission_pages/LRO/multimedia/lroimages/lroc-20091104-apollo12.html',
        },
      ],
    },
  ],

  /* ---------- 3D model ---------- */
  glb: {
    // File on disk: public/models/moon/surveyor-3.glb  (rename to match your file)
    url: '/models/moon/surveyor-3.glb',
    viewScale: 1,
    viewRotationDeg: [0, 0, 0],       // [x, y, z] extra rotation applied to the model
    // Starting camera for THIS equipment (Reset returns here). Tweak ry until the first view looks right.
    view: { zoom: 2.1, rx: 10, ry: -30 },

    // Moon scene (placing Surveyor 3 on moon.glb at its real coordinates)
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
      speaker: 'Surveyor 3',
      text: 'Snap... Click... "Scavenger hunt in the Ocean of Storms!"',
      sfx: '/assets/audio/moon/camera-click.mp3',
      audio: '/assets/audio/Surveyor-1.mp3',
    },
    {
      speaker: 'Surveyor 3',
      text: 'Hi, Space Commander {name}! Welcome to the Ocean of Storms! I am Surveyor 3, a robotic lander built by Hughes Aircraft Company and managed by NASA\'s Jet Propulsion Laboratory (JPL).',
      audio: '/assets/audio/Surveyor-2.mp3',
    },
    {
      speaker: 'Surveyor 3',
      text: 'My journey began on April 17, 1967, riding atop an Atlas-Centaur rocket. Three days later, on April 20, 1967, I safely landed right inside this moon crater! I was equipped with a television camera and a motorized surface-sampler scoop, making me the very first probe to dig into the lunar soil!',
      audio: '/assets/audio/Surveyor-3.mp3',
    },
    {
      speaker: 'Surveyor 3',
      text: 'Before my batteries went dark during the freezing lunar night, I scooped up moon dust and beamed back 6,315 television images to help NASA engineers confirm that the Moon\'s surface was solid enough for humans to land on.',
      audio: '/assets/audio/Surveyor-4.mp3',
    },
    {
      speaker: 'Surveyor 3',
      text: 'But my story gets even cooler! In November 1969, Apollo 12 astronauts Pete Conrad and Alan Bean landed nearby, and on November 19, they walked right over to visit me inside my crater! They carefully detached my TV camera and soil scoop to bring them back home for scientists to study. To this day, parts of me are displayed at the Smithsonian National Air and Space Museum on Earth.',
      audio: '/assets/audio/Surveyor-5.mp3',
    },
    {
      speaker: 'Surveyor 3',
      text: 'Thank you for visiting me inside my crater, Space Commander {name}! Keep digging for knowledge, and never stop exploring!',
      audio: '/assets/audio/Surveyor-6.mp3',
    },
  ],

  // Source already checked by you
  sources: [
    'https://science.nasa.gov/mission/surveyor-3/',
    'https://www.nasa.gov/mission_pages/LRO/multimedia/lroimages/lroc-20091104-apollo12.html',
  ],
};

/* ---------------- 3D coordinate positioning ---------------- */

// Puts a loaded Surveyor 3 object on the Moon at its real coordinates, standing "up" from the surface.
export function placeSurveyor3OnMoon(object, moonRadius = 1) {
  const { lat, lon } = SURVEYOR3.location;
  const g = SURVEYOR3.glb;
  const p = moonSurfacePoint(lat, lon, moonRadius * (1 + g.surfaceOffset), g.lonOffsetDeg);
  object.position.copy(p);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
  object.rotateY(THREE.MathUtils.degToRad(g.headingDeg));
  object.scale.setScalar(g.moonScale * moonRadius);
  return object;
}

export default SURVEYOR3;