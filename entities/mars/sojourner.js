// ../entities/mars/sojourner.js
// -----------------------------------------------------------------------------
// Mars Pathfinder (Carl Sagan Memorial Station) + Sojourner Rover, Ares Vallis. DATA ONLY + one helper.
// Same structure as eagle.js / lrv.js / ingenuity.js / insight.js:
//   1. metadata  : name, site coordinates, stats, data rows
//   2. glb       : where the 3D file goes + how to position it
//   3. analyze   : text + timing for the "Analyze" scan
//   4. monologue : what Sojourner says when the player taps "Read story"
//
// Drop your model at   public/assets/models/mars/sojourner-rover.glb
// (URL below has no "public"). Until the file exists, the viewer shows a "3D model" placeholder.
// Voice lines: mp3 files at the `audio` paths are optional, the text works without them.
// -----------------------------------------------------------------------------

import * as THREE from 'three';
import { moonSurfacePoint } from '../moon/eagle.js';   // generic lat/lon -> sphere point, works for Mars too

export const SOJOURNER = {
  id: 'MRS-03',
  planet: 'mars',
  planetCode: 'MRS',
  name: 'Sojourner Rover',
  shortName: 'Sojourner',
  disclaimer:
    'Disclaimer: This is only a visual representation of the Sojourner Rover.',

  /* ---------- Where it sits on Mars ---------- */
  location: {
    site: 'Ares Vallis, Mars',
    outcome: 'Successful airbag-cushioned landing on July 4, 1997. Deployed the Sojourner rover, the first rover to operate outside the Earth-Moon system, and returned 2.3 billion bits of information, including more than 16,500 images from the lander and 550 images from the rover, along with more than 15 chemical analyses of rocks and soil and extensive data on winds and other weather factors.',
    lat: 19.33,     // degrees North
    lon: 326.45,    // degrees East
  },

  /* ---------- Small stat strip (bottom-left card) ---------- */
  // coordinates come from your notes. size, mass, power and materials are filled from the commonly
  // published Sojourner figures, please double-check them against the NASA page.
  stats: {
    coordinates: '19.33° N\n326.45° E',
    size: '65 cm long\n48 cm wide',
    mass: '10.5 kg',
    power: 'Solar panel + lithium batteries',
    materials: 'Aluminum wheels, solar cells',
  },

  /* ---------- DATA panel rows (bottom-right card) ---------- */
  data: [
    { label: 'Equipment Name', value: 'Mars Pathfinder (Carl Sagan Memorial Station) & Sojourner Rover' },
    { label: 'Creator / Manufacturer', value: 'Designed, built, and managed by NASA\'s Jet Propulsion Laboratory (JPL)' },
    {
      label: 'Launch Date & Vehicle',
      value: 'December 4, 1996 aboard a Delta II rocket from Cape Canaveral Air Force Station, Florida',
    },
    { label: 'Mars Arrival & Landing', value: 'July 4, 1997 at Ares Vallis, Mars' },
    {
      label: 'Active Operations',
      value: 'Operated for 83 Martian days (sols), far outliving its planned design life (30 sols for the lander and 7 sols for the Sojourner rover)',
    },
    {
      label: 'Mission Conclusion',
      value: 'September 27, 1997 (Final data transmission received; mission officially ended after battery depletion and dropping temperatures)',
    },
    { label: 'Target Surface Location', value: 'Ares Vallis, Mars' },
    {
      label: 'Outcome',
      value: 'Successful airbag-cushioned landing on July 4, 1997. Deployed the Sojourner rover, the first rover to operate outside the Earth-Moon system, and returned 2.3 billion bits of information, including more than 16,500 images from the lander and 550 images from the rover, along with more than 15 chemical analyses of rocks and soil and extensive data on winds and other weather factors.',
    },
    {
      label: 'Official NASA Resources',
      links: [
        { label: 'NASA Science: Mars Pathfinder Overview', url: 'https://science.nasa.gov/mission/mars-pathfinder/' },
      ],
    },
  ],

  /* ---------- 3D model ---------- */
  glb: {
    // File on disk: public/assets/models/mars/sojourner-rover.glb  (rename to match your file)
    url: '/assets/models/mars/sojourner.glb',
    viewScale: 1,
    viewRotationDeg: [0, 0, 0],       // [x, y, z] extra rotation applied to the model
    // Starting camera for THIS equipment (Reset returns here). Tweak ry until the first view looks right.
    view: { zoom: 2.1, rx: 10, ry: -30 },

    // Mars scene (placing Sojourner on mars.glb at its real coordinates)
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
      speaker: 'Sojourner',
      text: 'Whirrr... Roll-roll... "The first little rover to roll across Mars!"',
      sfx: '/assets/audio/mars/rover-whirr.mp3',
      audio: '/assets/audio/mars/sojourner-1.mp3',
    },
    {
      speaker: 'Sojourner',
      text: 'Hi, Space Commander {name}! Welcome to the rocky floodplains of Ares Vallis! I am Sojourner, the microwave-sized robotic rover that rode to Mars inside the Mars Pathfinder lander (later named the Carl Sagan Memorial Station)! Designed, built, and managed by NASA\'s Jet Propulsion Laboratory (JPL), I was built to prove that a tiny mobile robot could explore the Red Planet!',
      audio: '/assets/audio/mars/sojourner-2.mp3',
    },
    {
      speaker: 'Sojourner',
      text: 'My adventure began on December 4, 1996, blasting off from Cape Canaveral Air Force Station aboard a Delta II rocket. Seven months later, on July 4, 1997, we bounced safely onto the Martian surface wrapped inside a cocoon of giant protective airbags! Soon after, I rolled down the lander\'s ramp and made history as the very FIRST rover to operate on another planet outside the Earth-Moon system!',
      audio: '/assets/audio/mars/sojourner-3.mp3',
    },
    {
      speaker: 'Sojourner',
      text: 'I was only designed to last 7 Martian days, or "sols", while my lander partner was planned for 30 sols, but together we kept exploring for an incredible 83 sols! Using my onboard cameras and Alpha Proton X-Ray Spectrometer, I drove from rock to rock, helping return 2.3 billion bits of science data, over 16,500 images from the lander, 550 images from my own cameras, and more than 15 chemical analyses of Martian rocks and soil!',
      audio: '/assets/audio/mars/sojourner-4.mp3',
    },
    {
      speaker: 'Sojourner',
      text: 'On September 27, 1997, as freezing Martian temperatures drained our batteries, we sent our final transmission back to Earth. Though I rest silently near the Carl Sagan Memorial Station today, I paved the way for every Mars rover that followed in my tire tracks!',
      audio: '/assets/audio/mars/sojourner-5.mp3',
    },
    {
      speaker: 'Sojourner',
      text: 'Thank you for scanning and visiting me, Space Commander {name}! Keep rolling forward, and never stop exploring!',
      audio: '/assets/audio/mars/sojourner-6.mp3',
    },
  ],

  sources: [
    'https://science.nasa.gov/mission/mars-pathfinder/',
  ],
};

/* ---------------- 3D coordinate positioning ---------------- */

// Puts a loaded Sojourner object on Mars at its real coordinates, standing "up" from the surface.
export function placeSojournerOnMars(object, marsRadius = 1) {
  const { lat, lon } = SOJOURNER.location;
  const g = SOJOURNER.glb;
  const p = moonSurfacePoint(lat, lon, marsRadius * (1 + g.surfaceOffset), g.lonOffsetDeg);
  object.position.copy(p);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
  object.rotateY(THREE.MathUtils.degToRad(g.headingDeg));
  object.scale.setScalar(g.marsScale * marsRadius);
  return object;
}

export default SOJOURNER;