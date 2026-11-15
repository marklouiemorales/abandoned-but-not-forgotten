// ../entities/moon/eagle.js
// -----------------------------------------------------------------------------
// Apollo 11 Lunar Module "Eagle" (LM-5), descent stage. DATA ONLY + one helper.
//   1. metadata  : name, site coordinates, stats, data rows
//   2. glb       : where the 3D file goes + how to position it on the Moon
//   3. analyze   : text + timing for the "Analyze" scan
//   4. monologue : what Eagle says when the player taps "Read story"
//
// Drop your model at   public/models/moon/eagle.glb   (URL below has no "public").
// Until the file exists, the viewer shows a "3D model" placeholder box.
// Voice lines: put mp3 files at the `audio` paths (optional, text works without).
// -----------------------------------------------------------------------------

import * as THREE from 'three';

export const EAGLE = {
  id: 'LUN-01',
  planet: 'moon',
  planetCode: 'LUN',
  name: 'Apollo 11 Lunar Module (Eagle) Descent Stage',
  shortName: 'Eagle',
  disclaimer:
    'Disclaimer: This is only a visual representation of Apollo 11 Lunar Module (Eagle) Descent Stage.',

  /* ---------- Where it sits on the Moon ---------- */
  location: {
    site: 'Sea of Tranquility (Statio Tranquillitatis)',
    outcome: 'Successful landing on July 20, 1969. The Descent Stage remains on the lunar surface as humanity\'s first moon landing site.',
    lat: 0.67408,   // degrees North
    lon: 23.47297,  // degrees East
  },

  /* ---------- Small stat strip (bottom-left card) ---------- */
  stats: {
    coordinates: '0.67408° N\n23.47297° E',
    size: '7.0 m tall\n9.1 m gear span', // whole lander, landing legs extended
    mass: '2,034 kg dry',                 // descent stage, empty
    power: '2 silver-zinc batteries',
    materials: 'Aluminum, titanium, Mylar & Kapton foil',
  },

  /* ---------- DATA panel rows (bottom-right card) ---------- */
  data: [
    { label: 'Equipment Name', value: 'Apollo 11 Lunar Module (Eagle) Descent Stage' },
    { label: 'Creator / Manufacturer', value: 'Built by Grumman Aircraft Engineering Corporation for NASA' },
    { label: 'Launch Date & Vehicle', value: 'July 16, 1969 aboard a Saturn V rocket' },
    { label: 'Moon Arrival & Landing', value: 'July 20, 1969' },
    {
      label: 'Ascent & Departure',
      value: 'July 21, 1969 (Astronauts Neil Armstrong and Buzz Aldrin launched back to orbit using the Ascent Stage, leaving the Descent Stage behind)',
    },
    {
      label: 'Mission Conclusion',
      value: 'July 24, 1969 (Crew returned safely to Earth; Descent Stage remains permanently on the Moon)',
    },
    { label: 'Target Surface Location', value: 'Sea of Tranquility, Moon' },
    { label: 'Outcome', value: 'Successful landing on July 20, 1969. The Descent Stage remains on the lunar surface as humanity\'s first moon landing site.' },
    {
      label: 'Official NASA Resources',
      links: [
        { label: 'NASA Apollo 11 Mission Overview', url: 'https://www.nasa.gov/mission_pages/apollo/missions/apollo11.html' },
        { label: 'NASA NSSDCA: Apollo 11 Lunar Module', url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1969-059C' },
      ],
    },
  ],

  /* ---------- 3D model ---------- */
  glb: {
    // Vite serves the "public" folder from the site root, so DO NOT write "public/" here.
    // File on disk: public/models/moon/eagle.glb
    url: '/models/moon/Apollo Lunar Module.glb',  // URL to the GLB file (no "public" prefix)
    // Viewer (the "equipment page"): tweak if your model faces the wrong way
    viewScale: 1,
    viewRotationDeg: [0, 0, 0],       // [x, y, z] extra rotation applied to the model

    // Moon scene (placing Eagle on moon.glb at its real coordinates)
    moonScale: 0.04,                  // x moon radius. Exaggerated on purpose: real Eagle is ~1e-6 of the Moon
    surfaceOffset: 0.0,               // x moon radius, lift/sink the model into the surface
    headingDeg: 0,                    // spin around the local "up" axis
    lonOffsetDeg: 0,                  // if your moon.glb texture has longitude 0 somewhere else, correct it here
  },

  /* ---------- Analyze (the "ANALYZE" button) ----------
     The scan should only look at the equipment (the Eagle model), not the moon surface.
     When progress reaches 100%, show `prompt`. The READ STORY button always stays on screen.
     {name} is replaced by the explorer's name. */
  analyze: {
    label: 'Analyzing equipment…',     // shown while the scan runs
    durationMs: 3000,                  // how long the scan takes
    completeLabel: 'Analysis 100%',    // shown when the scan finishes
    prompt: 'Wanna know my story, Space Commander {name}?',
  },

  /* ---------- Monologue (Eagle speaks in the first person) ----------
     {name} is replaced by the explorer's name. `sfx` plays first, then `audio` (all optional mp3). */
  monologue: [
    {
      speaker: 'Eagle',
      text: 'Bzzt…. The Eagle has landed!!!',
      sfx: '/assets/audio/moon/device-static.mp3',   // the device sound effect
      audio: '/assets/audio/Eagle-1.mp3',
    },
    {
      speaker: 'Eagle',
      text: 'Hi, Space Commander {name}! Welcome to the Sea of Tranquility! I am the Descent Stage of the Apollo 11 Lunar Module, "Eagle"! Grumman Aircraft Engineering Corporation built me for NASA.',
      audio: '/assets/audio/Eagle-2.mp3',
    },
    {
      speaker: 'Eagle',
      text: 'My journey began on July 16, 1969, riding into space aboard a giant Saturn V rocket. Four days later, on July 20, 1969, Commander Neil Armstrong and Lunar Module Pilot Edwin "Buzz" Aldrin rode atop me as we descended through the pitch-black sky to make humanity\'s very first touchdown on the Moon!',
      audio: '/assets/audio/Eagle-3.mp3',
    },
    {
      speaker: 'Eagle',
      text: 'While my top half, the Ascent Stage, blasted back into lunar orbit on July 21, 1969 to start Neil and Buzz\'s journey safely home to Earth, I stayed behind. I served as the launchpad for their liftoff, and now I stand right here at Statio Tranquillitatis as a permanent monument to one giant leap for mankind.',
      audio: '/assets/audio/Eagle-4.mp3',
    },
    {
      speaker: 'Eagle',
      text: 'Even though I rest silently in the lunar dust today, my metallic gold insulation still shines in the sunlight, marking the spot where humans first walked on another world. Thank you for scanning and finding me, Space Commander {name}! I hope everyone on your planet remembers me! Keep exploring!!!',
      audio: '/assets/audio/Eagle-5.mp3',
    },
  ],

  // Sources already checked by you
  sources: [
    'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1969-059C',
    'https://www.nasa.gov/mission_pages/apollo/missions/apollo11.html',
  ],
};

/* ---------------- 3D coordinate positioning ---------------- */

// lat/lon (degrees) -> point on a sphere. Assumes longitude 0 faces +Z and +Y is north.
export function moonSurfacePoint(latDeg, lonDeg, radius = 1, lonOffsetDeg = 0) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg + lonOffsetDeg);
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lon)
  );
}

// Puts a loaded Eagle object on the Moon at its real coordinates, standing "up" from the surface.
//   const eagle = (await new GLTFLoader().loadAsync(EAGLE.glb.url)).scene;
//   placeEagleOnMoon(eagle, moonRadius);  moonMesh.add(eagle);
export function placeEagleOnMoon(object, moonRadius = 1) {
  const { lat, lon } = EAGLE.location;
  const g = EAGLE.glb;
  const p = moonSurfacePoint(lat, lon, moonRadius * (1 + g.surfaceOffset), g.lonOffsetDeg);
  object.position.copy(p);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
  object.rotateY(THREE.MathUtils.degToRad(g.headingDeg));
  object.scale.setScalar(g.moonScale * moonRadius);
  return object;
}

export default EAGLE;