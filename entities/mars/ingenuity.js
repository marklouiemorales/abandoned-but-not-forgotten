// ../entities/mars/ingenuity.js
// -----------------------------------------------------------------------------
// Ingenuity Mars Helicopter, parked at "Wright Brothers Field" in Jezero Crater.
// DATA ONLY + one helper. Same structure as eagle.js / lrv.js:
//   1. metadata  : name, site coordinates, stats, data rows
//   2. glb       : where the 3D file goes + how to position it
//   3. analyze   : text + timing for the "Analyze" scan
//   4. monologue : what Ingenuity says when the player taps "Read story"
//
// Drop your model at   public/models/mars/ingenuity-mars-helicopter.glb
// (URL below has no "public"). Until the file exists, the viewer shows a "3D model" placeholder.
// Voice lines: mp3 files at the `audio` paths are optional, the text works without them.
// -----------------------------------------------------------------------------

import * as THREE from 'three';
import { moonSurfacePoint } from '../moon/eagle.js';   // generic lat/lon -> sphere point, works for Mars too

export const INGENUITY = {
  id: 'MRS-01',
  planet: 'mars',
  planetCode: 'MRS',
  name: 'Ingenuity Mars Helicopter',
  shortName: 'Ingenuity',
  disclaimer:
    'Disclaimer: This is only a visual representation of the Ingenuity Mars Helicopter.',

  /* ---------- Where it sits on Mars ---------- */
  location: {
    site: 'Jezero Crater, Mars',
    airfield: 'Wright Brothers Field',
    outcome: 'Successfully completed 72 historic flights across nearly three years of aerial exploration (surpassing its original 30-day technology demonstration to serve as an operations and aerial scout demo), before concluding its mission on January 25, 2024 after sustaining rotor blade damage during landing.',
    lat: 18.4446,   // degrees North
    lon: 77.4509,   // degrees East
  },

  /* ---------- Small stat strip (bottom-left card) ---------- */
  // coordinates come from your notes. size, mass, power and materials are filled from the commonly
  // published Ingenuity figures, please double-check them against the NASA page.
  stats: {
    coordinates: '18.4446° N\n77.4509° E',
    size: '0.49 m tall\n1.2 m rotor span',
    mass: '1.8 kg',
    power: 'Solar panel + Li-ion batteries',
    materials: 'Carbon-fiber blades, lightweight composites',
  },

  /* ---------- DATA panel rows (bottom-right card) ---------- */
  data: [
    { label: 'Equipment Name', value: 'Ingenuity Mars Helicopter' },
    { label: 'Creator / Manufacturer', value: 'Designed, built, and managed by NASA\'s Jet Propulsion Laboratory (JPL)' },
    {
      label: 'Launch Date & Vehicle',
      value: 'July 30, 2020 aboard an Atlas V 541 rocket from Cape Canaveral Air Force Station, Florida (strapped beneath the Perseverance rover)',
    },
    { label: 'Mars Arrival & Landing', value: 'February 18, 2021 at Jezero Crater, Mars' },
    { label: 'First Flight', value: 'April 19, 2021 (Achieved the first powered, controlled flight on another planet)' },
    {
      label: 'Mission Operations & Highlights',
      value: 'Completed 128.8 total flying minutes, covering 10.5 miles (17.0 kilometers) and reaching altitudes up to 78.7 feet (24.0 meters), proving powered flight is possible in the extremely thin Martian atmosphere (less than 1 percent as dense as Earth\'s).',
    },
    {
      label: 'Mission Conclusion',
      value: 'January 25, 2024 (Mission officially ended following rotor blade damage sustained during Flight 72 on January 18, 2024)',
    },
    { label: 'Target Surface Location', value: 'Jezero Crater, Mars' },
    {
      label: 'Outcome',
      value: 'Successfully completed 72 historic flights across nearly three years of aerial exploration (surpassing its original 30-day technology demonstration to serve as an operations and aerial scout demo), before concluding its mission on January 25, 2024 after sustaining rotor blade damage during landing.',
    },
    {
      label: 'Official NASA Resources',
      links: [
        {
          label: 'NASA Science: Mars 2020 Perseverance, Ingenuity Mars Helicopter Profile',
          url: 'https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/',
        },
      ],
    },
  ],

  /* ---------- 3D model ---------- */
  glb: {
    // File on disk: public/models/mars/ingenuity-mars-helicopter.glb  (rename to match your file)
    url: '/models/mars/25043_Ingenuity_v3.glb',
    viewScale: 1,
    viewRotationDeg: [0, 0, 0],       // [x, y, z] extra rotation applied to the model
    // Starting camera for THIS equipment (Reset returns here). Tweak ry until the first view looks right.
    view: { zoom: 2.1, rx: 10, ry: -30 },

    // Mars scene (placing Ingenuity on mars.glb at its real coordinates)
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
      speaker: 'Ingenuity',
      text: 'Whirrr... Chop-chop-chop... "The first aircraft to fly on another world!"',
      sfx: '/assets/audio/mars/helicopter-whirr.mp3',
      audio: '/assets/audio/mars/ingenuity-1.mp3',
    },
    {
      speaker: 'Ingenuity',
      text: 'Hi, Space Commander {name}! Welcome to Jezero Crater, and Wright Brothers Field! I am Ingenuity, NASA\'s trailblazing Mars Helicopter! Designed, built, and managed by NASA\'s Jet Propulsion Laboratory (JPL), I was built to test if powered, controlled flight was possible in Mars\' super-thin atmosphere, which is less than 1 percent as dense as Earth\'s!',
      audio: '/assets/audio/mars/ingenuity-2.mp3',
    },
    {
      speaker: 'Ingenuity',
      text: 'My journey began on July 30, 2020, blasting off from Cape Canaveral Air Force Station aboard an Atlas V 541 rocket, tucked safely beneath the belly of the Perseverance rover! On February 18, 2021, we touched down right here in Jezero Crater. Two months later, on April 19, 2021, I spun up my carbon-fiber blades and lifted off, achieving humanity\'s very FIRST powered, controlled flight on another planet!',
      audio: '/assets/audio/mars/ingenuity-3.mp3',
    },
    {
      speaker: 'Ingenuity',
      text: 'I was only supposed to make up to five test flights in 30 days, but I kept soaring for nearly three years! Across 72 historic flights, I logged 128.8 minutes in the Martian sky, flew 10.5 miles (17.0 kilometers), climbed as high as 78.7 feet (24.0 meters), and acted as an aerial scout to help Perseverance navigate tricky terrain!',
      audio: '/assets/audio/mars/ingenuity-4.mp3',
    },
    {
      speaker: 'Ingenuity',
      text: 'On January 18, 2024, during Flight 72, my rotor blades sustained damage while landing, and on January 25, 2024, NASA officially concluded my mission. Though my flying days are over, I proved that the skies of Mars, and beyond, are open for future aerial explorers!',
      audio: '/assets/audio/mars/ingenuity-5.mp3',
    },
    {
      speaker: 'Ingenuity',
      text: 'Thank you for scanning and visiting me, Space Commander {name}! Keep soaring high, and never stop exploring!',
      audio: '/assets/audio/mars/ingenuity-6.mp3',
    },
  ],

  sources: [
    'https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/',
  ],
};

/* ---------------- 3D coordinate positioning ---------------- */

// Puts a loaded Ingenuity object on Mars at its real coordinates, standing "up" from the surface.
export function placeIngenuityOnMars(object, marsRadius = 1) {
  const { lat, lon } = INGENUITY.location;
  const g = INGENUITY.glb;
  const p = moonSurfacePoint(lat, lon, marsRadius * (1 + g.surfaceOffset), g.lonOffsetDeg);
  object.position.copy(p);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
  object.rotateY(THREE.MathUtils.degToRad(g.headingDeg));
  object.scale.setScalar(g.marsScale * marsRadius);
  return object;
}

export default INGENUITY;