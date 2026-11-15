// ../entities/mars/nearShoemaker.js
// -----------------------------------------------------------------------------
// NEAR Shoemaker (Near Earth Asteroid Rendezvous - Shoemaker), asteroid 433 Eros. DATA ONLY + one helper.
// Same structure as eagle.js / lrv.js / ingenuity.js / insight.js:
//   1. metadata  : name, site coordinates, stats, data rows
//   2. glb       : where the 3D file goes + how to position it
//   3. analyze   : text + timing for the "Analyze" scan
//   4. monologue : what Shoemaker says when the player taps "Read story"
//
// Model file at   public/models/mars/NEAR Shoemaker.glb
// (URL below has no "public"). Until the file exists, the viewer shows a "3D model" placeholder.
// Voice lines: mp3 files at the `audio` paths are optional, the text works without them.
// -----------------------------------------------------------------------------

import * as THREE from 'three';
import { moonSurfacePoint } from '../moon/eagle.js';   // generic lat/lon -> sphere point

export const NEAR_SHOEMAKER = {
  id: 'MRS-04',                 // change to match your numbering
  planet: 'mars',
  planetCode: 'MRS',
  name: 'NEAR Shoemaker',
  shortName: 'Shoemaker',
  disclaimer:
    'Disclaimer: This is only a visual representation of the NEAR Shoemaker spacecraft.',

  /* ---------- Where it sits ---------- */
  location: {
    site: 'Just south of Himeros crater, asteroid 433 Eros',
    outcome:
      'Became the first spacecraft to orbit an asteroid (February 14, 2000) and the first to land on one (February 12, 2001). Although it was not designed as a lander, it survived the touchdown and kept transmitting data from the surface of Eros until its final signal was received on February 28, 2001.',
    lat: -35.78,    // degrees (35.78° S)
    lon: 80.42,     // degrees East  (279.58° W = 360 - 279.58 = 80.42° E)
  },

  /* ---------- Small stat strip (bottom-left card) ---------- */
  // coordinates come from your notes. size, mass, power and materials are commonly published
  // figures, please double-check them against the NASA / APL pages before publishing.
  stats: {
    coordinates: '35.78° S\n279.58° W',
    size: '1.7 m body\n(approx.)',
    mass: '487 kg dry\n805 kg at launch',
    power: 'Solar panels + battery',
    materials: 'Aluminum structure, solar cells',
  },

  /* ---------- DATA panel rows (bottom-right card) ---------- */
  data: [
    { label: 'Equipment Name', value: 'NEAR Shoemaker (Near Earth Asteroid Rendezvous – Shoemaker)' },
    {
      label: 'Creator / Manufacturer',
      value: 'Developed and managed by The Johns Hopkins University Applied Physics Laboratory (APL) for NASA',
    },
    {
      label: 'Launch Date & Vehicle',
      value: 'February 17, 1996 aboard a Delta II 7925-8 rocket',
    },
    { label: 'Asteroid Orbit', value: 'February 14, 2000, entered orbit around the asteroid Eros' },
    {
      label: 'Asteroid Landing',
      value: 'February 12, 2001, the first spacecraft to land on the surface of an asteroid',
    },
    {
      label: 'Mission Conclusion',
      value: 'February 28, 2001 (NASA\'s Deep Space Network received its final data signals; a later attempt to contact it on December 10, 2002 received no response)',
    },
    { label: 'Target Surface Location', value: 'Just south of Himeros crater, Eros (35.78° S, 279.58° W)' },
    {
      label: 'Outcome',
      value: 'Survived a gentle touchdown it was not strictly designed for, and transmitted high-resolution images and scientific data from the surface of Eros before its systems were deactivated.',
    },
    {
      label: 'Official NASA Resources',
      links: [
        { label: 'NASA Science: NEAR Shoemaker', url: 'https://science.nasa.gov/mission/near-shoemaker/' },   // verify this link
      ],
    },
  ],

  /* ---------- 3D model ---------- */
  glb: {
    // File on disk: public/models/mars/NEAR Shoemaker.glb
    url: '/models/mars/NEAR Shoemaker.glb',
    viewScale: 1,
    viewRotationDeg: [0, 0, 0],       // [x, y, z] extra rotation applied to the model
    // Starting camera for THIS equipment (Reset returns here). Tweak ry until the first view looks right.
    view: { zoom: 2.1, rx: 10, ry: -30 },

    // Planet scene (only used if you place it on a sphere)
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
      speaker: 'Shoemaker',
      text: 'Hi, Space Commander {name}! Welcome to the region just south of the Himeros crater—floating out in deep space on a tumbling space rock! I am the NEAR Shoemaker (Near Earth Asteroid Rendezvous – Shoemaker) spacecraft, developed and managed by The Johns Hopkins University Applied Physics Laboratory (APL) for NASA.',
      audio: '/assets/audio/mars/shoemaker-1.mp3',
    },
    {
      speaker: 'Shoemaker',
      text: 'My record-breaking journey began on February 17, 1996, launching into the cosmos aboard a powerful Delta II 7925-8 rocket. After years of chasing space rocks through the solar system, I officially entered orbit around the asteroid Eros on February 14, 2000. But orbiting wasn\'t enough—on February 12, 2001, I made history by becoming the very FIRST spacecraft ever to safely land on the surface of an asteroid!',
      audio: '/assets/audio/mars/shoemaker-2.mp3',
    },
    {
      speaker: 'Shoemaker',
      text: 'Right down there at coordinates 35.78° S, 279.58° W, I survived a gentle touchdown that I wasn\'t even strictly designed to survive! Working tirelessly on the surface, I transmitted valuable, high-resolution images and crucial scientific data all the way back home to Earth before my systems were finally deactivated.',
      audio: '/assets/audio/mars/shoemaker-3.mp3',
    },
    {
      speaker: 'Shoemaker',
      text: 'My mission officially concluded on February 28, 2001, when NASA\'s Deep Space Network received my final data signals. Though a later attempt to ping me on December 10, 2002, couldn\'t wake me from the extreme cold, I had already done what no machine had ever done before. Though I am silent today, I proved that human ingenuity could reach out and touch the stars—one asteroid at a time!',
      audio: '/assets/audio/mars/shoemaker-4.mp3',
    },
    {
      speaker: 'Shoemaker',
      text: 'Thank you for scanning and remembering me, Space Commander {name}! Keep aiming high, and never stop exploring!',
      audio: '/assets/audio/mars/shoemaker-5.mp3',
    },
  ],

  sources: [
    'https://science.nasa.gov/mission/near-shoemaker/',
  ],
};

/* ---------------- 3D coordinate positioning ---------------- */

// Puts a loaded Shoemaker object on a sphere at its landing coordinates, standing "up" from the surface.
// NOTE: the coordinates are for asteroid Eros, so only use this on an Eros model, not on mars.glb.
export function placeShoemakerOnSphere(object, radius = 1) {
  const { lat, lon } = NEAR_SHOEMAKER.location;
  const g = NEAR_SHOEMAKER.glb;
  const p = moonSurfacePoint(lat, lon, radius * (1 + g.surfaceOffset), g.lonOffsetDeg);
  object.position.copy(p);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
  object.rotateY(THREE.MathUtils.degToRad(g.headingDeg));
  object.scale.setScalar(g.marsScale * radius);
  return object;
}

export default NEAR_SHOEMAKER;