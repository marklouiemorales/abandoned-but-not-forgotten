// src/scenes/equipmentViewerScene.js
// -----------------------------------------------------------------------------
// Equipment page (Eagle, and later every other equipment) in the game's navy / blue HUD theme.
//
//   - Full-screen 3D viewport behind the HUD cards.
//   - The 3D equipment is FIXED (never moved by mouse drag or scroll).
//   - VIEW panel: X / Y + zoom control the CAMERA only. Defaults = VIEWER_CONFIG.view.
//   - The reticle frame FOLLOWS the equipment on screen, and so do the Read story / Analyze buttons
//     and the disclaimer card.
//   - Analyze: scans ONLY the equipment, counts 0 -> 100%, then asks "Wanna know my story...?".
//   - READ STORY: every card / panel fades away. Only the 3D object stays, and the story is told in a
//     visual-novel style dialogue box at the bottom (portrait + speaker + typed text + CONTINUE).
//   - The LUN / MRS minimap is a painted surface map of the planet with a marker on the site.
//   - TERRAIN: one shared terrain GLB per planet (VIEWER_CONFIG.terrain.urls) is loaded once, cached and
//     reused under every equipment. Equipment GLBs then contain ONLY the object (no terrain).
//     Legacy models that still include their own terrain: set  glb: { sharedTerrain: false }.
//
// USAGE
//   import { EAGLE } from '../entities/moon/eagle.js';
//   const viewer = createEquipmentViewer(document.body, { entity: EAGLE, onBack: () => viewer.dispose() });
//
// OPTIONAL entity field:  portrait: '/assets/images/moon/eagle-portrait.png'  (dialogue avatar).
// Without it a small drawn planet avatar is used.
// OPTIONAL entity.glb fields: sharedTerrain (false = model brings its own terrain), terrainScale, terrainSpot {x,z}.
// -----------------------------------------------------------------------------

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { createSpaceBackground } from './spaceBackground.js';
import { loadArchive, saveEquipment } from './archiveStore.js';
import { loadSharedTerrain, placeTerrainUnder } from './sharedTerrain.js';

export const VIEWER_CONFIG = {
  background: true,
  scenery: ['Curiosity Rover Path'],
  grid: true,
  backgroundStill: true,
  pager: { index: 1, total: 3 },
  archive: { saved: 1, total: 6 },
  footer: 'Placeholder scene · Moon surface',
  toastMs: 5000,
  typeSpeedMs: 22,
  view: { zoom: 2.1, rx: -10, ry: -151 },
  zoom: { min: 2.1, max: 3.5 },
  frame: { pad: 10, min: 90, gap: 18, margin: 16, top: 84 },
  // shared terrain, loaded once per planet and reused under every equipment
  terrain: {
    urls: { moon: '/assets/models/moon/moon_terrain_16x9.glb',
      mars: '/assets/models/mars/mars_terrain_16x9_lite.glb', },  // add  mars: '...'  later
    scale: 0.5,    // scene units per terrain metre (equipment is normalised to ~2.4 units)
    margin: 28,    // metres kept between the chosen spot and the tile edge
    fog: 0.09,     // fog density while the terrain is shown (hides the tile edge)
    shadows: true,
    hide: ['terrain', 'ground', 'landscape', 'moon surface', 'lunar surface'],   // node names of a terrain still baked into an old model: hidden when the shared one is used
  },
  text: {
    view: 'View', reset: 'Reset', zoom: 'Zoom', rotation: 'Camera', light: 'Light',
    day: 'Day', dusk: 'Dusk', night: 'Night',
    back: 'Back', archive: 'Archive',
    story: 'Read story', analyze: 'Analyze',
    analyzing: 'Analyzing', analyzed: 'Analysis 100%',
    scanning: 'Analyzing equipment…',
    prompt: 'Wanna know my story, Space Commander {name}?',
    data: 'Data', ready: 'Ready', loading: 'Loading', awaiting: 'Awaiting GLB',
    discovered: 'Equipment discovered', saved: '{saved} of {total} saved to your archive',
    next: 'Continue', done: 'Finish', close: 'Close', skip: 'Skip',
    archiveTitle: 'Archive', yourCard: 'Explorer card', equipmentCards: 'Equipment cards',
    commander: 'Space Commander', cardId: 'ID', cardRank: 'Rank', cardSaved: 'Cards saved', locked: 'Locked',
    placeholder: '3D model',
    statLabels: { coordinates: 'Coordinates', size: 'Size', mass: 'Mass', power: 'Power source', materials: 'Materials' },
  },
};

const LIGHTS = {
  day:   { amb: [0xffffff, 0.75], key: [0xfff4e0, 3.0, [4, 5, 3]],    rim: [0x7fb0ff, 0.8] },
  dusk:  { amb: [0xb89a9a, 0.4],  key: [0xff9a5a, 2.2, [-5, 1.2, 2]], rim: [0x6a7bff, 0.7] },
  night: { amb: [0x6f86c8, 0.14], key: [0x9ab4ff, 0.9, [3, 4, -2]],   rim: [0x4d6bff, 0.5] },
};

const ICON = {
  back: '<path d="M15 5l-7 7 7 7M8 12h12"/>',
  book: '<path d="M4 5.5C4 5 4.5 4.5 5 4.5H11v15H5c-.5 0-1-.5-1-1zM20 5.5c0-.5-.5-1-1-1h-6v15h6c.5 0 1-.5 1-1z"/>',
  prev: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  scan: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M4 12h16"/>',
  reset: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/>',
  sound: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
  mute: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM16 9.5l5 5M21 9.5l-5 5"/>',
};
const svg = (name, w = 2) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

// default dialogue portrait (planet + ring on a blue gradient), used when the entity has no `portrait`
const avatarSvg = (mars) => `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs><linearGradient id="eqAvG" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#050a1c"/><stop offset="1" stop-color="#1f4fb5"/></linearGradient></defs>
  <rect width="100" height="100" fill="url(#eqAvG)"/>
  <circle cx="50" cy="52" r="20" fill="${mars ? '#e0623f' : '#cfd3da'}"/>
  <circle cx="43" cy="46" r="4" fill="${mars ? '#b84a2c' : '#9ea4ae'}"/><circle cx="58" cy="58" r="5" fill="${mars ? '#b84a2c' : '#9ea4ae'}"/>
  <circle cx="56" cy="42" r="2.4" fill="${mars ? '#b84a2c' : '#9ea4ae'}"/>
  <ellipse cx="50" cy="54" rx="38" ry="9" fill="none" stroke="#fff" stroke-width="1.4" transform="rotate(-18 50 54)"/>
  <circle cx="82" cy="22" r="2.4" fill="#fff"/><circle cx="16" cy="26" r="1" fill="#fff"/>
</svg>`;

/* ---------------- Styles ---------------- */

const STYLES = `
  .eq-root {
    /* theme: deep navy panels, thin blue hairlines, blue accent (matches the Mission Control dialogue) */
    --panel: rgba(5,10,28,.74);
    --panel-hi: rgba(26,56,118,.62);
    --hair: rgba(90,150,235,.34);
    --line: rgba(120,175,255,.78);
    --accent: #5aa9ff;
    --blur: blur(8px);
    --ink: #fff;
    --ink2: rgba(255,255,255,.84);
    --ink3: rgba(170,200,245,.66);
    position: fixed; inset: 0; z-index: 70; overflow: hidden; pointer-events: none; background: transparent;
    font-family: 'Orbitron', 'Rajdhani', ui-sans-serif, system-ui, sans-serif; color: var(--ink);
    text-shadow: 0 1px 8px rgba(0,0,0,.45); }
  .eq-bg { position: absolute; inset: 0; background: #000; z-index: 0; }
  .eq-canvas { position: fixed; inset: 0; z-index: 1; pointer-events: none; }
  .eq-canvas canvas { width: 100%; height: 100%; display: block; }
  .eq-grid { position: fixed; inset: 0; z-index: 1; pointer-events: none; background-position: center; background-size: 64px 64px;
    background-image: linear-gradient(rgba(120,175,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(120,175,255,.06) 1px, transparent 1px); }
  .eq-tl, .eq-top, .eq-tr, .eq-bl, .eq-br, .eq-foot { z-index: 2; }
  .eq-root button { font: inherit; }
  .eq-root button:focus-visible, .eq-root input:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

  /* things that fade away while the story is told */
  .eq-grid, .eq-tl, .eq-top, .eq-tr, .eq-bl, .eq-br, .eq-foot, .eq-frame, .eq-follow { transition: opacity .35s ease, visibility 0s; }
  .eq-root.story-mode .eq-grid, .eq-root.story-mode .eq-tl, .eq-root.story-mode .eq-top, .eq-root.story-mode .eq-tr,
  .eq-root.story-mode .eq-bl, .eq-root.story-mode .eq-br, .eq-root.story-mode .eq-foot, .eq-root.story-mode .eq-frame,
  .eq-root.story-mode .eq-follow { opacity: 0; visibility: hidden; pointer-events: none; transition: opacity .35s ease, visibility 0s .35s; }

  /* ---------- panel: dark navy, hairline blue border ---------- */
  .eq-card { pointer-events: auto; }
  .eq-paper { position: relative; color: var(--ink); background: var(--panel); border: 1px solid var(--hair); border-radius: 2px;
    -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur); box-shadow: 0 6px 24px rgba(0,0,8,.35); }
  .eq-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; font-size: 10px; letter-spacing: .16em;
    text-transform: uppercase; color: var(--accent); border-bottom: 1px solid var(--hair); }
  .eq-head > span:first-child { display: flex; align-items: center; gap: 8px; }
  .eq-head .grow { margin-left: auto; }
  .eq-logo { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px var(--accent); }
  .eq-link { display: inline-flex; align-items: center; gap: 5px; padding: 0; margin-left: auto; font-size: 10px; letter-spacing: .14em;
    text-transform: uppercase; color: var(--ink2); background: none; border: 0; cursor: pointer; }
  .eq-link:hover { color: var(--accent); }
  .eq-link svg { width: 12px; height: 12px; }

  /* ---------- top-left: nav items + VIEW ---------- */
  .eq-tl { position: absolute; top: 20px; left: 20px; width: 224px; display: flex; flex-direction: column; gap: 16px; }
  .eq-round-row { display: flex; flex-direction: column; gap: 12px; }
  .eq-nav { pointer-events: auto; display: inline-flex; align-items: center; gap: 12px; width: fit-content; padding: 0; cursor: pointer;
    font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink2); background: none; border: 0; }
  .eq-circ { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; color: #fff;
    border: 1px solid var(--line); background: var(--panel); -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur);
    transition: background .2s, border-color .2s; }
  .eq-circ svg { width: 18px; height: 18px; }
  .eq-nav:hover { color: #fff; }
  .eq-nav:hover .eq-circ { background: var(--panel-hi); border-color: var(--accent); }
  .eq-vbody { padding: 12px 16px 14px 14px; display: grid; gap: 12px; }
  .eq-viewpanel.collapsed .eq-vbody { display: none; }
  .eq-viewpanel .eq-head { cursor: pointer; }
  .eq-sub { font-size: 9px; letter-spacing: .16em; text-transform: uppercase; color: var(--ink3); }
  .eq-row { display: grid; grid-template-columns: 40px 1fr 42px; align-items: center; gap: 10px; font-size: 10px; letter-spacing: .1em; color: var(--ink2); }
  .eq-row output { text-align: right; font-weight: 700; color: #fff; }
  .eq-row input[type=range] { -webkit-appearance: none; appearance: none; width: 100%; height: 2px; margin: 0; cursor: pointer;
    background: linear-gradient(90deg, var(--accent) var(--p, 50%), rgba(120,175,255,.25) var(--p, 50%)); }
  .eq-row input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 11px; height: 11px; border-radius: 50%;
    background: #fff; border: 0; box-shadow: 0 0 0 4px rgba(90,169,255,.28); }
  .eq-row input[type=range]::-moz-range-thumb { width: 11px; height: 11px; border-radius: 50%; background: #fff; border: 0; }
  .eq-seg { grid-column: 2 / 4; display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--hair); border-radius: 2px; overflow: hidden; }
  .eq-seg button { padding: 6px 0; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink2); background: transparent; border: 0; cursor: pointer; }
  .eq-seg button + button { border-left: 1px solid var(--hair); }
  .eq-seg button:hover { background: rgba(90,169,255,.12); }
  .eq-seg button.on { color: #fff; background: rgba(90,169,255,.32); box-shadow: inset 0 -2px 0 var(--accent); }

  /* ---------- top-centre: pager + toast ---------- */
  .eq-top { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .eq-pager { pointer-events: auto; display: flex; align-items: center; gap: 4px; padding: 4px; border-radius: 999px;
    background: var(--panel); border: 1px solid var(--line); -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur); }
  .eq-pager button { display: grid; place-items: center; width: 30px; height: 30px; padding: 0; color: #fff; background: transparent; border: 0; border-radius: 50%; cursor: pointer; }
  .eq-pager button:hover { background: var(--panel-hi); }
  .eq-pager svg { width: 16px; height: 16px; }
  .eq-pager b { min-width: 52px; text-align: center; font-size: 12px; letter-spacing: .12em; }
  .eq-toast { transition: opacity .4s, transform .4s; }
  .eq-toast.hide { opacity: 0; transform: translateY(-8px); pointer-events: none; }
  .eq-toast .eq-paper { display: flex; align-items: center; gap: 12px; padding: 10px 16px 10px 12px; }
  .eq-tick { display: grid; place-items: center; flex: none; width: 26px; height: 26px; color: #04101f; background: var(--accent); border-radius: 50%; text-shadow: none; }
  .eq-tick svg { width: 15px; height: 15px; }
  .eq-toast b { display: block; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
  .eq-toast small { display: block; margin-top: 2px; font-size: 9px; letter-spacing: .06em; color: var(--ink3); }

  /* ---------- top-right: surface minimap ---------- */
  .eq-tr { position: absolute; top: 20px; right: 20px; width: 160px; }
  .eq-tr .eq-paper { display: flex; flex-direction: column-reverse; border: 1px solid var(--line); border-radius: 2px; background: rgba(5,10,28,.85); }
  .eq-tr .eq-head { justify-content: center; padding: 7px 10px; border: 0; border-top: 1px solid var(--hair); background: rgba(5,10,28,.92);
    color: var(--accent); font-weight: 700; }
  .eq-map { position: relative; height: 80px; overflow: hidden; background: #777; }
  .eq-mapc { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .eq-map::before { content: ''; position: absolute; inset: 0; z-index: 1;
    background: linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px) 0 0 / 100% 25%, linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px) 0 0 / 20% 100%; }
  .eq-map::after { content: ''; position: absolute; inset: 0; z-index: 1; pointer-events: none; box-shadow: inset 0 0 16px rgba(0,0,10,.6); }
  .eq-dot { position: absolute; z-index: 2; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: var(--accent);
    border: 1.5px solid #fff; box-shadow: 0 0 8px rgba(90,169,255,.9); }
  .eq-dot::after { content: ''; position: absolute; inset: -6px; border: 1px solid #fff; border-radius: 50%; animation: eqPing 1.8s ease-out infinite; }
  @keyframes eqPing { from { transform: scale(.5); opacity: 1; } to { transform: scale(2.2); opacity: 0; } }

  /* ---------- reticle frame ---------- */
  .eq-frame { position: absolute; left: 0; top: 0; z-index: 2; pointer-events: none; will-change: transform, width, height;
    background:
      linear-gradient(#fff, #fff) top left / 22px 2px no-repeat, linear-gradient(#fff, #fff) top left / 2px 22px no-repeat,
      linear-gradient(#fff, #fff) top right / 22px 2px no-repeat, linear-gradient(#fff, #fff) top right / 2px 22px no-repeat,
      linear-gradient(#fff, #fff) bottom left / 22px 2px no-repeat, linear-gradient(#fff, #fff) bottom left / 2px 22px no-repeat,
      linear-gradient(#fff, #fff) bottom right / 22px 2px no-repeat, linear-gradient(#fff, #fff) bottom right / 2px 22px no-repeat; }
  .eq-ph { position: absolute; inset: 14%; display: grid; place-content: center; gap: 6px; text-align: center; pointer-events: none;
    color: rgba(255,255,255,.75); border: 1px dashed rgba(120,175,255,.5); }
  .eq-ph b { font-size: 12px; letter-spacing: .24em; text-transform: uppercase; }
  .eq-ph span { font-size: 9px; letter-spacing: .12em; opacity: .75; }
  .eq-ph[hidden] { display: none; }
  .eq-tag { position: absolute; left: 10px; top: 8px; font-size: 9px; letter-spacing: .16em; text-transform: uppercase; white-space: nowrap;
    color: var(--accent); text-shadow: 0 1px 8px #000; }
  .eq-tag[hidden] { display: none; }
  .eq-frame.scan::after { content: ''; position: absolute; left: 0; right: 0; height: 2px; pointer-events: none;
    background: linear-gradient(90deg, transparent, var(--accent), transparent); box-shadow: 0 0 16px var(--accent); animation: eqScan 2.2s linear infinite; }
  @keyframes eqScan { from { top: 0; } to { top: 100%; } }

  /* ---------- cards that FOLLOW the equipment ---------- */
  .eq-follow { position: absolute; left: 0; top: 0; z-index: 3; will-change: transform; }
  .eq-name { width: 220px; text-align: right; }
  .eq-name .eq-paper { padding: 10px 14px 12px; border-right: 2px solid var(--accent); }
  .eq-code { font-size: 9px; letter-spacing: .22em; color: var(--accent); margin-bottom: 6px; }
  .eq-ename { font-size: 13px; font-weight: 700; line-height: 1.4; letter-spacing: .08em; text-transform: uppercase; }

  .eq-actions { display: flex; flex-direction: column; width: 190px; pointer-events: auto; }
  .eq-actions .eq-btn { display: flex; align-items: center; width: 100%; padding: 14px 18px; font-size: 11px; font-weight: 700; letter-spacing: .14em;
    text-transform: uppercase; text-align: left; color: var(--ink); background: var(--panel); border: 1px solid var(--hair); border-radius: 0; cursor: pointer;
    -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur); transition: background .2s, border-color .2s; }
  .eq-actions .eq-btn + .eq-btn { border-top: 0; }
  .eq-actions .eq-btn svg { display: none; }
  .eq-actions .eq-btn:hover { background: var(--panel-hi); border-color: var(--line); }
  .eq-actions .eq-btn.on { background: rgba(90,169,255,.28); border-color: var(--accent); box-shadow: inset 3px 0 0 var(--accent); }
  .eq-prompt { position: absolute; top: 100%; left: 0; width: 100%; margin-top: 10px; animation: eqPop .35s ease-out; }
  .eq-prompt[hidden] { display: none; }
  .eq-prompt .eq-paper { padding: 12px 14px; font-size: 11px; font-weight: 700; line-height: 1.5; letter-spacing: .05em; border-color: var(--line); }
  @keyframes eqPop { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .eq-disc { width: 270px; }
  .eq-disc .eq-paper { padding: 7px 12px; font-size: 8px; line-height: 1.5; letter-spacing: .05em; text-align: center; color: var(--ink2); }

  /* ---------- bottom-left: stats | bottom-right: DATA ---------- */
  .eq-bl { position: absolute; bottom: 24px; left: 20px; max-width: calc(100vw - 360px); }
  .eq-stats { display: grid; grid-template-columns: repeat(5, auto); padding: 12px 18px 12px 4px; }
  .eq-stat { padding: 0 16px; min-width: 0; border-left: 1px solid var(--hair); }
  .eq-stat:first-child { border-left: 0; }
  .eq-stat label { display: block; font-size: 8px; letter-spacing: .16em; text-transform: uppercase; color: var(--accent); }
  .eq-stat b { display: block; margin-top: 5px; font-size: 11px; line-height: 1.45; letter-spacing: .04em; white-space: pre-line; }

  .eq-br { position: absolute; bottom: 24px; right: 20px; width: 310px; }
  .eq-br .eq-head em { margin-left: auto; font-style: normal; color: #fff; font-weight: 700; }
  .eq-dbody { max-height: min(34vh, 290px); overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--accent) rgba(120,175,255,.12); }
  .eq-drow { display: grid; grid-template-columns: 96px 1fr; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--hair); }
  .eq-drow:last-child { border-bottom: 0; }
  .eq-drow label { font-size: 9px; line-height: 1.5; letter-spacing: .08em; color: var(--ink3); }
  .eq-drow b a { display: block; margin-bottom: 5px; color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
  .eq-drow b { font-size: 10px; line-height: 1.55; letter-spacing: .03em; text-align: right; }

  .eq-foot { position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); font-size: 10px; letter-spacing: .12em; color: var(--ink3);
    text-shadow: 0 1px 8px #000; white-space: nowrap; }

  /* ---------- STORY MODE: only the object + a visual-novel style dialogue ---------- */
  .eq-story { position: absolute; inset: 0; z-index: 10; pointer-events: none; opacity: 0; visibility: hidden;
    background: linear-gradient(to top, rgba(0,0,6,.6), transparent 42%);
    transition: opacity .4s, visibility 0s .4s; }
  .eq-story.open { opacity: 1; visibility: visible; transition-delay: 0s; }
  .eq-snd { position: absolute; top: 20px; right: 20px; display: grid; place-items: center; width: 38px; height: 38px; padding: 0; color: #fff;
    background: var(--panel); border: 1px solid var(--line); border-radius: 50%; cursor: pointer; pointer-events: auto;
    -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur); }
  .eq-snd:hover { background: var(--panel-hi); border-color: var(--accent); }
  .eq-snd svg { width: 18px; height: 18px; }

  .eq-dlg { position: absolute; left: 50%; bottom: 28px; width: min(900px, calc(100vw - 32px)); display: flex; gap: 22px; padding: 22px;
    pointer-events: auto; border-top: 2px solid #fff; text-shadow: none;
    background: linear-gradient(180deg, rgba(3,6,18,.95), rgba(3,9,28,.97));
    clip-path: polygon(0 0, 100% 0, 100% calc(100% - 24px), calc(100% - 24px) 100%, 0 100%);
    transform: translate(-50%, 28px); transition: transform .45s ease; }
  .eq-story.open .eq-dlg { transform: translate(-50%, 0); }
  .eq-av { flex: none; width: 104px; height: 104px; overflow: hidden; border: 1px solid var(--line); background: #050a1c;
    clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%); }
  .eq-av svg, .eq-av img { width: 100%; height: 100%; display: block; object-fit: cover; }
  .eq-dbox { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .eq-dwho { display: flex; align-items: center; gap: 12px; font-size: 12px; letter-spacing: .1em; color: var(--accent); }
  .eq-dots { font-style: normal; letter-spacing: .2em; opacity: .35; }
  .eq-dots.typing { animation: eqBlink 1s steps(2, end) infinite; }
  @keyframes eqBlink { 50% { opacity: 1; } }
  .eq-dcount { margin-left: auto; font-size: 10px; color: var(--ink3); }
  .eq-story-text { margin: 10px 0 0; min-height: 3.3em; font-size: clamp(15px, 1.7vw, 19px); font-weight: 600; line-height: 1.55; letter-spacing: .02em; color: #fff; }
  .eq-story-actions { display: flex; justify-content: flex-end; align-items: center; gap: 22px; margin-top: auto; padding-top: 12px; }
  .eq-skip { padding: 0; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink3); background: none; border: 0; cursor: pointer; }
  .eq-skip:hover { color: #fff; }
  .eq-go { padding: 11px 30px; font-size: 13px; letter-spacing: .16em; text-transform: uppercase; color: #fff; background: transparent;
    border: 1px solid var(--line); border-radius: 999px; cursor: pointer; transition: background .2s, border-color .2s; }
  .eq-go:hover { background: rgba(90,169,255,.22); border-color: var(--accent); }

  /* ---------- ARCHIVE: boarding-pass cards (explorer card + saved equipment cards) ---------- */
  .eq-arch { position: absolute; inset: 0; z-index: 11; display: grid; place-items: center; padding: 20px; background: rgba(2,5,16,.82);
    -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); opacity: 0; visibility: hidden; pointer-events: none;
    transition: opacity .3s, visibility 0s .3s; }
  .eq-arch.open { opacity: 1; visibility: visible; pointer-events: auto; transition-delay: 0s; }
  .eq-arch > .eq-paper { width: min(790px, 96vw); max-height: 92vh; display: flex; flex-direction: column; background: rgba(4,9,26,.95); border-color: var(--line); }
  .eq-arch-body { display: grid; gap: 24px; padding: 20px; overflow: auto; }
  /* explorer card = 472px wide, each equipment card = 236px (exactly half) */
  .eq-arch-body .eq-sub { text-align: center; }
  .eq-ucard { margin-top: 12px; display: flex; justify-content: center; }
  .eq-ucard .eq-tk { width: min(472px, 100%); }
  .eq-egrid { margin-top: 12px; display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; }
  .eq-egrid .eq-tk { flex: none; width: 236px; }

  .eq-tk { container-type: inline-size; display: block; width: 100%; text-shadow: none; transition: transform .2s, filter .2s; }
  .eq-tk[data-id] { cursor: pointer; }
  .eq-tk[data-id]:hover { transform: translateY(-2px); filter: drop-shadow(0 0 10px rgba(90,169,255,.55)); }
  .eq-tk.cur { filter: drop-shadow(0 0 10px rgba(90,169,255,.9)); }
  .eq-tkc { display: grid; grid-template-columns: 31% 1fr 19%; aspect-ratio: 720 / 330; overflow: hidden; color: #0d1b3d; border-radius: 2.2cqw;
    background: linear-gradient(135deg, #f4f7fc, #dbe6f4);
    clip-path: polygon(0 0, calc(100% - 5cqw) 0, 100% 5cqw, 100% 100%, 0 100%); }
  /* left stub: barcode, vertical label, dark photo panel */
  .eq-tks { display: flex; gap: 1.4cqw; padding: 2.2cqw 2.2cqw 2.2cqw 2cqw; background: #cddcf0; border-right: 1.5px dashed #7f93b5; }
  .eq-bar { flex: none; width: 6.4cqw; background: repeating-linear-gradient(90deg, #0d1b3d 0 .5cqw, transparent .5cqw .9cqw, #0d1b3d .9cqw 1.2cqw, transparent 1.2cqw 1.9cqw, #0d1b3d 1.9cqw 2.7cqw, transparent 2.7cqw 3.1cqw); }
  .eq-vt { flex: none; writing-mode: vertical-rl; transform: rotate(180deg); font-size: max(6px, 1.2cqw); letter-spacing: .16em; text-transform: uppercase; color: #3f5580; white-space: nowrap; }
  .eq-pnl { position: relative; flex: 1; min-width: 0; border-radius: 1.6cqw; overflow: hidden; border: 1px solid #5a2f27;
    background: radial-gradient(ellipse at 50% 108%, rgba(224,98,63,.95), rgba(224,98,63,0) 62%), linear-gradient(#04061a, #080c26); }
  .eq-pnl.moon { border-color: #34466f; background: radial-gradient(ellipse at 50% 108%, rgba(150,185,255,.85), rgba(150,185,255,0) 62%), linear-gradient(#04061a, #080c26); }
  .eq-pnl.mars { border-color: #5a2f27; }
  .eq-pnl b { position: absolute; left: 0; right: 0; bottom: 1.2cqw; text-align: center; font-size: max(6px, 1.4cqw); letter-spacing: .04em; color: #fff; }
  /* main text */
  .eq-tkc.nostub { grid-template-columns: 1fr 23%; }
  .eq-tkc.nostub .eq-tkm { padding-left: 3.6cqw; }
  .eq-tkm { min-width: 0; padding: 2.6cqw 1.6cqw 2.4cqw 3cqw; display: flex; flex-direction: column;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='56' height='97'><path d='M28 2 54 17v30L28 62 2 47V17z' fill='none' stroke='%237f93b5' stroke-opacity='.25'/></svg>"); }
  .eq-tkh { display: flex; align-items: center; gap: 1.2cqw; padding-bottom: 1cqw; border-bottom: 1px solid #b9c7dc; font-size: max(8px, 1.9cqw); letter-spacing: .02em; }
  .eq-pdot { flex: none; width: 2.6cqw; height: 2.6cqw; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #6fa0ff, #1c3f9a); }
  .eq-pdot.moon { background: radial-gradient(circle at 35% 30%, #f1f1f3, #8d9099); }
  .eq-pdot.mars { background: radial-gradient(circle at 35% 30%, #ff9a73, #b04a2c); }
  .eq-tkk { margin-top: .9cqw; font-size: max(6px, 1.25cqw); letter-spacing: .14em; text-transform: uppercase; color: #6d83a8; }
  .eq-tkn { margin-top: 1.2cqw; font-size: 4.8cqw; font-weight: 700; line-height: 1.05; letter-spacing: .02em; text-transform: uppercase; overflow-wrap: anywhere; }
  .eq-tkn2 { margin-top: .4cqw; font-size: 3.4cqw; line-height: 1.15; text-transform: uppercase; overflow-wrap: anywhere; }
  .eq-tkn2.sm { font-size: max(7px, 1.7cqw); letter-spacing: .04em; color: #2a3d63; }
  .eq-tkf { margin-top: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 1.4cqw 2cqw; }
  .eq-tkf > div { min-width: 0; padding-top: .8cqw; border-top: 1px solid #b9c7dc; }
  .eq-tkf label { display: block; font-size: max(5.5px, 1.1cqw); letter-spacing: .14em; text-transform: uppercase; color: #6d83a8; }
  .eq-tkf b { display: block; margin-top: .3cqw; font-size: max(7px, 1.9cqw); font-weight: 600; line-height: 1.25; overflow-wrap: anywhere; }
  .eq-tkf small { display: block; font-size: max(5.5px, 1.05cqw); color: #6d83a8; }
  /* right: round planet badge */
  .eq-tkb { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .8cqw; padding: 1cqw 2cqw 1cqw 0; }
  .eq-badge { width: 13cqw; height: 13cqw; border-radius: 50%; overflow: hidden; border: .6cqw solid #34466f; box-shadow: 0 .6cqw 1.6cqw rgba(13,27,61,.35); }
  .eq-badge svg { width: 100%; height: 100%; display: block; }
  .eq-bl2 { margin-top: 1cqw; padding-top: .8cqw; width: 100%; text-align: center; border-top: 1px solid #b9c7dc; font-size: max(5.5px, 1.05cqw); letter-spacing: .14em; text-transform: uppercase; color: #6d83a8; }
  .eq-bv { font-size: max(7px, 1.7cqw); font-weight: 700; text-align: center; }
  /* compact equipment card (half the width of the explorer card, laid out as a small stacked card) */
  .eq-tk.sm .eq-tkc { display: block; position: relative; aspect-ratio: auto; min-height: 222px; border-radius: 10px;
    clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%); }
  .eq-tk.sm .eq-tkm { padding: 14px 14px 10px; }
  .eq-tk.sm .eq-tkh { gap: 6px; padding-bottom: 6px; font-size: 8px; }
  .eq-tk.sm .eq-pdot { width: 8px; height: 8px; }
  .eq-tk.sm .eq-tkk { margin-top: 6px; font-size: 6px; }
  .eq-tk.sm .eq-tkn { margin: 8px 48px 0 0; font-size: 19px; }
  .eq-tk.sm .eq-tkn2.sm { margin: 4px 48px 0 0; font-size: 7.5px; line-height: 1.35; }
  .eq-tk.sm .eq-tkf { margin-top: 10px; grid-template-columns: 1fr; gap: 0; }
  .eq-tk.sm .eq-tkf > div { display: flex; justify-content: space-between; gap: 8px; padding: 5px 0; }
  .eq-tk.sm .eq-tkf label { flex: none; width: 58px; font-size: 6px; }
  .eq-tk.sm .eq-tkf b { margin: 0; font-size: 8px; text-align: right; }
  .eq-tk.sm .eq-tkb { position: absolute; top: 34px; right: 12px; padding: 0; }
  .eq-tk.sm .eq-badge { width: 38px; height: 38px; border-width: 2px; box-shadow: none; }
  .eq-tk.sm .eq-bl2, .eq-tk.sm .eq-bv { display: none; }
  .eq-tk.sm.lock .eq-tkc { display: grid; height: 222px; font-size: 10px; }
  /* locked slot */
  .eq-tk.lock .eq-tkc { display: grid; place-items: center; background: rgba(255,255,255,.04); border: 1px dashed var(--hair); color: var(--ink3);
    font-size: max(10px, 2.2cqw); letter-spacing: .3em; text-transform: uppercase; }

  @media (max-width: 980px) {
    .eq-name { width: 170px; }
    .eq-disc { width: 220px; }
    .eq-tr { display: none; }
    .eq-tl { width: 200px; }
    .eq-bl { display: none; }
    .eq-br { width: min(300px, 56vw); }
  }
  @media (max-width: 640px) {
    .eq-dlg { gap: 14px; padding: 16px; bottom: 16px; }
    .eq-av { width: 72px; height: 72px; }
  }
  @media (prefers-reduced-motion: reduce) { .eq-root * { animation: none !important; transition: none !important; } }
`;

/* ---------------- Surface minimap painter ---------------- */
// Paints a small equirectangular surface map (maria + craters). Seeded, so it looks the same every time.
function paintSurfaceMap(canvas, planet) {
  const g = canvas.getContext('2d');
  if (!g) return;
  const W = canvas.width, H = canvas.height, mars = planet === 'mars';
  let s = mars ? 91 : 7;
  const rnd = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  g.fillStyle = mars ? '#a65a3b' : '#9b9b9d';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {                                    // regolith grain
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.09)';
    g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  // dark plains: [lon, lat, radius lon, radius lat] in degrees (Procellarum, Imbrium, Serenitatis, Tranquillitatis, ...)
  const maria = mars
    ? [[-60, 10, 34, 20], [40, -10, 40, 22], [100, 20, 30, 18], [-120, -20, 36, 18]]
    : [[-57, 18, 40, 26], [-17, 33, 28, 16], [18, 28, 14, 11], [23, 8, 18, 12], [51, -3, 12, 9], [59, 17, 9, 7], [-15, -21, 16, 11], [-38, -14, 12, 9]];
  maria.forEach(([lon, lat, rx, ry]) => {
    const x = ((lon + 180) / 360) * W, y = ((90 - lat) / 180) * H;
    const rX = (rx / 360) * W, rY = (ry / 180) * H;
    g.save(); g.translate(x, y); g.scale(1, rY / rX);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rX);
    gr.addColorStop(0, mars ? 'rgba(60,25,15,.58)' : 'rgba(40,42,50,.66)');
    gr.addColorStop(0.7, mars ? 'rgba(60,25,15,.36)' : 'rgba(40,42,50,.4)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rX, 0, Math.PI * 2); g.fill();
    g.restore();
  });
  for (let i = 0; i < 110; i++) {                                     // craters: dark bowl, lit rim, shadow rim
    const x = rnd() * W, y = rnd() * H, r = 1.5 + Math.pow(rnd(), 3) * 9;
    g.fillStyle = 'rgba(0,0,0,.16)';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.lineWidth = Math.max(0.8, r * 0.18);
    g.strokeStyle = 'rgba(255,255,255,.32)';
    g.beginPath(); g.arc(x, y, r, Math.PI * 0.75, Math.PI * 1.75); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.28)';
    g.beginPath(); g.arc(x, y, r, -Math.PI * 0.25, Math.PI * 0.75); g.stroke();
  }
}

/* ---------------- Factory ---------------- */

export function createEquipmentViewer(container = document.body, options = {}) {
  const config = { ...VIEWER_CONFIG, ...(options.config || {}) };
  config.text = { ...VIEWER_CONFIG.text, ...(options.config?.text || {}) };
  config.pager = { ...VIEWER_CONFIG.pager, ...(options.config?.pager || {}) };
  config.archive = { ...VIEWER_CONFIG.archive, ...(options.config?.archive || {}) };
  config.view = { ...VIEWER_CONFIG.view, ...(options.config?.view || {}) };
  config.zoom = { ...VIEWER_CONFIG.zoom, ...(options.config?.zoom || {}) };
  config.view.zoom = Math.min(config.zoom.max, Math.max(config.zoom.min, config.view.zoom));
  config.frame = { ...VIEWER_CONFIG.frame, ...(options.config?.frame || {}) };
  config.terrain = {
    ...VIEWER_CONFIG.terrain, ...(options.config?.terrain || {}),
    urls: { ...VIEWER_CONFIG.terrain.urls, ...(options.config?.terrain?.urls || {}) },
  };
  const t = config.text;
  let V = config.view;   // replaced per entity (entity.glb.view) in setEntity
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // one entity, or a list: the < / > pager walks through the list (wraps around)
  const entities = options.entities?.length ? options.entities : [options.entity];
  // the pager always shows config.pager.total (3 per planet); slots without an entity yet are just skipped
  const pagerTotal = Math.max(config.pager.total, entities.length);
  let idx = Math.max(0, entities.indexOf(options.entity));
  let entity = entities[idx];
  const explorer = options.explorer || {};
  const fill = (str = '') => str.replace(/\{(\w+)\}/g, (_, k) => explorer[k] ?? (k === 'name' ? 'Explorer' : ''));

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  /* ----- DOM ----- */
  const styleEl = el('style');
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);

  const root = el('div', 'eq-root');
  root.innerHTML = `
    <div class="eq-bg" data-eq="bg"></div>
    <div class="eq-canvas" data-eq="canvas"></div>
    <div class="eq-grid" data-eq="grid"></div>

    <div class="eq-frame" data-eq="frame">
      <div class="eq-ph" data-eq="ph"><b>${t.placeholder}</b><span data-eq="glbname"></span></div>
      <div class="eq-tag" data-eq="tag" hidden></div>
    </div>

    <div class="eq-tl">
      <div class="eq-round-row">
        <button class="eq-nav" data-eq="back" type="button" aria-label="Back"><span class="eq-circ">${svg('back')}</span><span>${t.back}</span></button>
        <button class="eq-nav" data-eq="archive" type="button" aria-label="Archive"><span class="eq-circ">${svg('book')}</span><span>${t.archive}</span></button>
      </div>
      <div class="eq-card eq-viewpanel" data-eq="viewpanel"><div class="eq-paper">
        <div class="eq-head" data-eq="viewhead"><span><i class="eq-logo"></i>${t.view}</span>
          <button class="eq-link" data-eq="reset" type="button">${svg('reset')}${t.reset}</button></div>
        <div class="eq-vbody">
          <div class="eq-row"><label>${t.zoom}</label><input type="range" data-eq="zoom" min="${config.zoom.min}" max="${config.zoom.max}" step="0.05" value="${V.zoom}"><output data-eq="zoomOut"></output></div>
          <div class="eq-sub">${t.rotation}</div>
          <div class="eq-row"><label>X</label><input type="range" data-eq="rx" min="-10" max="80" step="1" value="${V.rx}"><output data-eq="rxOut"></output></div>
          <div class="eq-row"><label>Y</label><input type="range" data-eq="ry" min="-180" max="180" step="1" value="${V.ry}"><output data-eq="ryOut"></output></div>
          <div class="eq-row"><label>${t.light}</label>
            <div class="eq-seg" data-eq="light">
              <button type="button" data-light="day" class="on">${t.day}</button>
              <button type="button" data-light="dusk">${t.dusk}</button>
              <button type="button" data-light="night">${t.night}</button>
            </div></div>
        </div>
      </div></div>
    </div>

    <div class="eq-top">
      <div class="eq-pager">
        <button type="button" data-eq="prev" aria-label="Previous">${svg('prev')}</button>
        <b data-eq="pagerText"></b>
        <button type="button" data-eq="next" aria-label="Next">${svg('next')}</button>
      </div>
      <div class="eq-card eq-toast" data-eq="toast"><div class="eq-paper">
        <span class="eq-tick">${svg('check', 2.4)}</span>
        <div><b>${t.discovered}</b><small data-eq="toastSub"></small></div>
      </div></div>
    </div>

    <div class="eq-tr eq-card"><div class="eq-paper">
      <div class="eq-head"><span data-eq="mapCode"></span></div>
      <div class="eq-map"><canvas class="eq-mapc" data-eq="mapc" width="320" height="160"></canvas><i class="eq-dot" data-eq="dot"></i></div>
    </div></div>

    <div class="eq-card eq-follow eq-name" data-eq="namecard"><div class="eq-paper">
      <div class="eq-code" data-eq="code"></div><div class="eq-ename" data-eq="name"></div>
    </div></div>

    <div class="eq-follow eq-actions" data-eq="actions">
      <button class="eq-btn" type="button" data-eq="story">${svg('chat')}<span>${t.story}</span></button>
      <button class="eq-btn" type="button" data-eq="analyze">${svg('scan')}<span data-eq="analyzeLabel">${t.analyze}</span></button>
      <div class="eq-card eq-prompt" data-eq="prompt" hidden><div class="eq-paper"><span data-eq="promptText"></span></div></div>
    </div>

    <div class="eq-card eq-follow eq-disc" data-eq="discwrap"><div class="eq-paper"><span data-eq="disc"></span></div></div>

    <div class="eq-bl eq-card"><div class="eq-paper"><div class="eq-stats" data-eq="stats"></div></div></div>

    <div class="eq-br eq-card"><div class="eq-paper sheen">
      <div class="eq-head"><span>${t.data}</span><em data-eq="status"></em></div>
      <div class="eq-dbody" data-eq="data"></div>
    </div></div>

    <div class="eq-foot">${config.footer}</div>

    <div class="eq-arch" data-eq="arch"><div class="eq-paper">
      <div class="eq-head"><span><i class="eq-logo"></i>${t.archiveTitle}</span><span class="grow" data-eq="archCount"></span>
        <button class="eq-link" type="button" data-eq="archClose" style="margin-left:14px">${t.close}</button></div>
      <div class="eq-arch-body">
        <div><div class="eq-sub">${t.yourCard}</div><div class="eq-ucard" data-eq="ucard"></div></div>
        <div><div class="eq-sub">${t.equipmentCards}</div><div class="eq-egrid" data-eq="egrid"></div></div>
      </div>
    </div></div>

    <div class="eq-story" data-eq="storywrap">
      <button class="eq-snd" type="button" data-eq="snd" aria-label="Sound" aria-pressed="false">${svg('sound')}</button>
      <div class="eq-dlg">
        <div class="eq-av" data-eq="av"></div>
        <div class="eq-dbox">
          <div class="eq-dwho"><span data-eq="storyWho"></span><i class="eq-dots" data-eq="dots">····</i><span class="eq-dcount" data-eq="storyCount"></span></div>
          <p class="eq-story-text" data-eq="storyText" aria-live="polite"></p>
          <div class="eq-story-actions">
            <button class="eq-skip" type="button" data-eq="storyClose">${t.skip}</button>
            <button class="eq-go" type="button" data-eq="storyNext"></button>
          </div>
        </div>
      </div>
    </div>
  `;
  container.appendChild(root);
  const q = (k) => root.querySelector(`[data-eq="${k}"]`);
  const ui = Object.fromEntries(
    ['back','archive','viewpanel','viewhead','reset','zoom','zoomOut','rx','rxOut','ry','ryOut','light','prev','next',
     'pagerText','toast','toastSub','mapCode','mapc','dot','code','name','frame','canvas','ph','glbname','tag','actions','discwrap','namecard','grid','story','analyze','analyzeLabel',
     'prompt','promptText','disc','stats','data','status','arch','archCount','archClose','ucard','egrid','storywrap','snd','av','dots','storyWho','storyCount','storyClose','storyText','storyNext'
    ].map((k) => [k, q(k)])
  );
  if (!config.grid) ui.grid.remove();
  if (window.innerWidth < 980) ui.viewpanel.classList.add('collapsed');
  const bgEl = q('bg');
  const spaceBg = config.background ? createSpaceBackground(bgEl, { still: config.backgroundStill }) : null;
  if (!config.background) bgEl.style.background = 'transparent';

  /* ----- Three.js ----- */
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050811, 0.045);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const BASE_DIST = 3.2;
  const TARGET = new THREE.Vector3(0, 0.25, 0);
  camera.position.set(0, 0.5, BASE_DIST);
  camera.lookAt(TARGET);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !!config.terrain.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  ui.canvas.appendChild(renderer.domElement);

  const amb = new THREE.AmbientLight();
  const key = new THREE.DirectionalLight();
  const rim = new THREE.DirectionalLight();
  rim.position.set(-4, 1, -4);
  // key light casts the equipment's shadow onto the shared terrain
  key.castShadow = !!config.terrain.shadows;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 30 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(amb, key, key.target, rim);

  // plain fallback ground: used only when no shared terrain applies (legacy models / planets without a terrain yet)
  const groundGeo = new THREE.CircleGeometry(80, 64);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.95, metalness: 0.05 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.35;
  ground.receiveShadow = true;
  scene.add(ground);

  const pivot = new THREE.Group();
  const holder = new THREE.Group();
  pivot.add(holder);
  scene.add(pivot);

  function setLight(name) {
    const L = LIGHTS[name];
    amb.color.set(L.amb[0]); amb.intensity = L.amb[1];
    key.color.set(L.key[0]); key.intensity = L.key[1]; key.position.set(...L.key[2]);
    rim.color.set(L.rim[0]); rim.intensity = L.rim[1];
    ui.light.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.light === name));
  }
  setLight('day');

  /* ----- Camera View controls ----- */
  const sliders = {
    zoom: [ui.zoom, ui.zoomOut, (v) => `${(+v).toFixed(1)}×`],
    rx: [ui.rx, ui.rxOut, (v) => `${Math.round(v)}°`],
    ry: [ui.ry, ui.ryOut, (v) => `${Math.round(v)}°`],
  };
  const paint = (k) => {
    const [inp, out, fmt] = sliders[k];
    const pct = ((Number(inp.value) - Number(inp.min)) / (Number(inp.max) - Number(inp.min))) * 100;
    inp.style.setProperty('--p', `${pct}%`);
    out.textContent = fmt(inp.value);
  };
  const applyView = () => {
    pivot.rotation.set(0, 0, 0);

    const pitch = THREE.MathUtils.degToRad(+ui.rx.value);
    const yaw   = THREE.MathUtils.degToRad(+ui.ry.value);
    const dist  = BASE_DIST / +ui.zoom.value;

    const basePhi = THREE.MathUtils.degToRad(80);
    const phi = THREE.MathUtils.clamp(basePhi - pitch, THREE.MathUtils.degToRad(10), THREE.MathUtils.degToRad(86));

    const spherical = new THREE.Spherical(dist, phi, yaw);
    const offset = new THREE.Vector3().setFromSpherical(spherical);

    camera.position.copy(TARGET).add(offset);
    camera.up.set(0, 1, 0);
    camera.lookAt(TARGET);
  };
  const setSlider = (k, v) => { sliders[k][0].value = v; paint(k); applyView(); };
  const resetView = () => {
    setSlider('zoom', V.zoom); setSlider('rx', V.rx); setSlider('ry', V.ry);
  };
  Object.keys(sliders).forEach((k) => {
    paint(k);
    sliders[k][0].addEventListener('input', () => { paint(k); applyView(); });
  });
  applyView();
  const onReset = (e) => { e.stopPropagation(); resetView(); setLight('day'); };
  const onLight = (e) => { const b = e.target.closest('button[data-light]'); if (b) setLight(b.dataset.light); };
  const onViewHead = (e) => { if (!e.target.closest('button')) ui.viewpanel.classList.toggle('collapsed'); };
  ui.reset.addEventListener('click', onReset);
  ui.light.addEventListener('click', onLight);
  ui.viewhead.addEventListener('click', onViewHead);

  /* ----- Reticle frame + cards follow the equipment ----- */
  let modelPoints = null;
  let equipMeshes = [];
  const _m = new THREE.Matrix4();
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const place = (elm, x, y) => { elm.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; };

  function updateFrame() {
    const w = ui.canvas.clientWidth || window.innerWidth;
    const h = ui.canvas.clientHeight || window.innerHeight;
    const { pad, min, gap, margin, top } = config.frame;
    let x, y, bw, bh, tracked = false;

    if (modelPoints) {
      camera.updateMatrixWorld();
      _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const e = _m.elements, P = modelPoints;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < P.length; i += 3) {
        const px = P[i], py = P[i + 1], pz = P[i + 2];
        const cw = e[3] * px + e[7] * py + e[11] * pz + e[15];
        if (cw <= 0.001) continue;
        const sx = (((e[0] * px + e[4] * py + e[8] * pz + e[12]) / cw) * 0.5 + 0.5) * w;
        const sy = (1 - (((e[1] * px + e[5] * py + e[9] * pz + e[13]) / cw) * 0.5 + 0.5)) * h;
        if (sx < minX) minX = sx; if (sx > maxX) maxX = sx;
        if (sy < minY) minY = sy; if (sy > maxY) maxY = sy;
      }
      const l = Math.max(minX - pad, 8), r = Math.min(maxX + pad, w - 8);
      const t0 = Math.max(minY - pad, 8), b0 = Math.min(maxY + pad, h - 8);
      if (r > l && b0 > t0) {
        bw = Math.max(min, r - l);
        bh = Math.max(min, b0 - t0);
        x = (l + r) / 2 - bw / 2;
        y = (t0 + b0) / 2 - bh / 2;
        tracked = true;
      }
    }
    if (!tracked) {
      bw = bh = Math.min(h * 0.42, 380);
      x = (w - bw) / 2;
      y = (h - bh) / 2;
    }
    const fs = ui.frame.style;
    fs.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    fs.width = `${bw.toFixed(1)}px`;
    fs.height = `${bh.toFixed(1)}px`;

    const A = ui.actions, D = ui.discwrap;
    const aw = A.offsetWidth, ah0 = A.offsetHeight;
    const ah = ah0 + (ui.prompt.hidden ? 0 : ui.prompt.offsetHeight + 12);
    let ax = x + bw + gap;
    if (ax + aw > w - margin) { const lx = x - gap - aw; ax = lx >= margin ? lx : w - margin - aw; }
    const ay = clamp(y + bh / 2 - ah0 / 2, top, Math.max(top, h - margin - ah));
    place(A, ax, ay);

    const N = ui.namecard;
    const nw = N.offsetWidth, nh = N.offsetHeight;
    const menuOnLeft = ax < x;
    let nx = menuOnLeft ? x + bw + gap : x - gap - nw;
    nx = clamp(nx, margin, Math.max(margin, w - margin - nw));
    const ny = clamp(y + bh / 2 - nh / 2, top, Math.max(top, h - margin - nh - 70));
    place(N, nx, ny);

    const dw = D.offsetWidth, dh = D.offsetHeight, footer = 30;
    let dy = y + bh + gap;
    if (dy + dh > h - footer) { const uy = y - gap - dh; dy = uy >= top ? uy : h - footer - dh; }
    const dx = clamp(x + bw / 2 - dw / 2, margin, w - margin - dw);
    place(D, dx, dy);
  }

  /* ----- Analyze: scans ONLY the equipment, 0 -> 100%, then STAYS in its analyzed form ----- */
  let analyzing = false, analyzed = false, aStart = 0, aPct = 0;
  let storyOpen = false;   // while the story is told the object is shown solid (no wireframe)
  const setWire = (on) => equipMeshes.forEach((o) => [].concat(o.material).forEach((m) => { if (m) m.wireframe = on && !storyOpen; }));
  const az = () => ({
    label: t.scanning, durationMs: 3000, completeLabel: t.analyzed, prompt: t.prompt,
    ...(entity?.analyze || {}),
  });
  const plain = (str = '') => str.replace(/…/g, '...');

  function resetAnalyze() {
    analyzing = false; analyzed = false; aPct = 0;
    setWire(false);
    ui.analyze.classList.remove('on');
    ui.frame.classList.remove('scan');
    ui.tag.hidden = true;
    ui.prompt.hidden = true;
    ui.analyzeLabel.textContent = t.analyze;
  }
  function startAnalyze() {
    if (analyzing) return;
    if (analyzed) { resetAnalyze(); return; }
    analyzing = true;
    aStart = performance.now();
    ui.analyze.classList.add('on');
    ui.frame.classList.add('scan');
    setWire(true);
    paintAnalyze(0);
  }
  function paintAnalyze(pct) {
    ui.analyzeLabel.textContent = `${t.analyzing} ${pct}%`;
    ui.tag.hidden = false;
    ui.tag.textContent = `${plain(az().label)} ${pct}%`;
  }
  function finishAnalyze() {
    analyzing = false;
    analyzed = true;
    setWire(true);
    ui.frame.classList.remove('scan');
    ui.tag.hidden = false;
    ui.tag.textContent = plain(az().completeLabel);
    ui.analyzeLabel.textContent = az().completeLabel;
    ui.promptText.textContent = fill(az().prompt);
    ui.prompt.hidden = false;
  }
  function tickAnalyze() {
    if (!analyzing) return;
    const pct = Math.min(100, Math.floor(((performance.now() - aStart) / az().durationMs) * 100));
    if (pct !== aPct) { aPct = pct; if (pct < 100) paintAnalyze(pct); }
    if (pct >= 100) finishAnalyze();
  }
  const onAnalyze = () => startAnalyze();
  ui.analyze.addEventListener('click', onAnalyze);

  /* ----- Entity (text, stats, GLB) ----- */
  let loadToken = 0;
  let sharedTerrain = null;   // the cached terrain currently placed in the scene (never disposed per equipment)
  const disposeModel = () => {
    modelPoints = null;
    equipMeshes = [];
    holder.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.isMesh) [].concat(o.material).forEach((m) => { Object.values(m).forEach((v) => v?.isTexture && v.dispose()); m.dispose?.(); });
    });
    holder.clear();
  };
  const setStatus = (s) => { ui.status.textContent = s; };

  function loadModel(e) {
    console.log('[terrain] loadModel called', e.id, e.planet, e.glb);
    const my = ++loadToken;
    disposeModel();
    const url = e.glb?.url;
    ui.ph.hidden = false;
    ui.glbname.textContent = url ? url.split('/').pop() : '';
    setStatus(t.loading);
    const miss = (err) => { console.error('[terrain] equipment GLB failed to load:', url, err); if (my === loadToken) { ui.ph.hidden = false; setStatus(t.awaiting); } };
    if (!url) { miss(); return; }

    // shared terrain: starts downloading in parallel with the model, then comes from cache for every other equipment
    const planetKey = String(e.planet || '').toLowerCase();
    const tUrl = e.glb.sharedTerrain === false ? null : config.terrain.urls[planetKey];
    if (e.glb.sharedTerrain !== false && !tUrl) {
      console.warn(`[terrain] no shared terrain url for planet "${e.planet}" (config.terrain.urls has: ${Object.keys(config.terrain.urls).join(', ') || 'nothing'}) - using the plain ground`);
    }
    const terrainReq = tUrl ? loadSharedTerrain(tUrl) : null;
    const useShared = !!terrainReq;

    const glbLoader = new GLTFLoader();
    glbLoader.setMeshoptDecoder(MeshoptDecoder);
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    glbLoader.setDRACOLoader(dracoLoader);
    glbLoader.load(url, (gltf) => {
      console.log('[terrain] equipment GLB loaded, token ok:', my === loadToken);
      if (my !== loadToken) return;
      const obj = gltf.scene;
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const s = (0.5 / (Math.max(size.x, size.y, size.z) || 1)) * (e.glb.viewScale || 1);
      obj.scale.setScalar(s);
      obj.position.copy(center.multiplyScalar(-s));

      holder.add(obj);
      const r = e.glb.viewRotationDeg || [0, 0, 0];
      holder.rotation.set(...r.map((d) => THREE.MathUtils.degToRad(d)));
      holder.updateMatrixWorld(true);

      const norm = (n = '') => n.replace(/[\s_]+/g, ' ').trim().toLowerCase();
      const sceneryNames = (e.glb.scenery || config.scenery).map(norm);
      const hideNames = (e.glb.hide || config.terrain.hide).map(norm);
      const nameHit = (o, list, exact) => {
        for (let n = o; n && n !== holder; n = n.parent) {
          const nm = norm(n.name);
          if (nm && list.some((x) => (exact ? nm === x || nm.startsWith(x + ' ') : nm.includes(x)))) return true;
        }
        return false;
      };
      const isScenery = (o) => nameHit(o, sceneryNames, false);
      const isOldTerrain = (o) => nameHit(o, hideNames, true);   // a terrain the model brought along with it
      const skip = (o) => isScenery(o) || (useShared && isOldTerrain(o));

      const meshes = [];
      holder.traverse((o) => { if (o.isMesh && o.geometry?.attributes?.position && !skip(o)) meshes.push(o); });

      // ---- ground: shared terrain under the equipment (or the plain fallback ground) ----
      const footBox = new THREE.Box3();
      if (useShared && meshes.length) meshes.forEach((o) => footBox.expandByObject(o));   // equipment only
      else footBox.setFromObject(holder);                                                  // legacy: whole model
      const useGround = () => {
        if (sharedTerrain) sharedTerrain.root.visible = false;
        ground.visible = true;
        ground.position.y = footBox.min.y - 0.005;
        groundMat.color.set(e.planet === 'mars' ? 0xb55a3c : 0xcfcfcf);
        scene.fog.density = 0.045;
      };
      if (!useShared) useGround();
      else {
        ground.visible = false;
        terrainReq.then((terr) => {
          if (my !== loadToken) return;
          if (terr.root.parent !== scene) scene.add(terr.root);
          terr.root.visible = true;
          sharedTerrain = terr;
          const placed = placeTerrainUnder(terr, footBox, {
            scale: e.glb.terrainScale ?? config.terrain.scale,
            margin: config.terrain.margin,
            key: e.id,
            spot: e.glb.terrainSpot,
          });
          // the model's own terrain (if it still has one) would cover the shared one: hide it
          holder.traverse((o) => { if (o.isMesh && isOldTerrain(o) && !meshes.includes(o)) o.visible = false; });
          scene.fog.density = config.terrain.fog;
          console.info('[terrain] placed', { equipment: e.id, spotMetres: [placed.cx, placed.cz], rootPosition: terr.root.position.toArray(), scale: terr.root.scale.x, equipmentBottomY: footBox.min.y });
        }).catch((err) => {
          console.warn('[terrain] failed to load/place, using the plain ground instead:', err);
          if (my === loadToken) useGround();
        });
      }

      const total = meshes.reduce((n, o) => n + o.geometry.attributes.position.count, 0);
      const step = Math.max(1, Math.floor(total / 6000));
      const pts = [];
      const _p = new THREE.Vector3();
      const lo = new THREE.Vector3(Infinity, Infinity, Infinity);
      const hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
      for (const o of meshes) {
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i += step) {
          _p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
          pts.push(_p.x, _p.y, _p.z);
          lo.min(_p); hi.max(_p);
        }
      }
      modelPoints = pts.length ? new Float32Array(pts) : null;
      equipMeshes = meshes;
      meshes.forEach((o) => { o.castShadow = true; o.receiveShadow = true; });

      if (modelPoints) TARGET.copy(lo).add(hi).multiplyScalar(0.5);
      key.target.position.copy(TARGET);
      key.target.updateMatrixWorld();
      applyView();

      if (analyzing || analyzed) setWire(true);
      ui.ph.hidden = true;
      setStatus(t.ready);
    }, undefined, miss);
  }

  function setEntity(e) {
    entity = e;
    V = { ...config.view, ...(e.glb?.view || {}) };
    V.zoom = Math.min(config.zoom.max, Math.max(config.zoom.min, V.zoom));
    resetAnalyze();
    ui.code.textContent = e.id;
    ui.name.textContent = e.name;
    ui.disc.textContent = e.disclaimer || '';
    ui.mapCode.textContent = e.planetCode || '';
    paintSurfaceMap(ui.mapc, e.planet);
    ui.dot.style.left = `${(((e.location.lon + 180) / 360) * 100) % 100}%`;
    ui.dot.style.top = `${((90 - e.location.lat) / 180) * 100}%`;
    // dialogue portrait
    ui.av.replaceChildren();
    if (e.portrait) {
      const img = el('img');
      img.src = e.portrait; img.alt = '';
      ui.av.appendChild(img);
    } else ui.av.innerHTML = avatarSvg(e.planet === 'mars');
    ui.stats.replaceChildren(...Object.entries(t.statLabels).map(([k, label]) => {
      const cell = el('div', 'eq-stat');
      cell.append(el('label', null, label), el('b', null, e.stats?.[k] ?? '—'));
      return cell;
    }));
    ui.data.replaceChildren(...(e.data || []).map((row) => {
      const r = el('div', 'eq-drow');
      const val = el('b');
      if (row.links) {
        row.links.forEach((l) => {
          const a = el('a', null, l.label);
          a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
          val.appendChild(a);
        });
      } else val.textContent = fill(row.value);
      r.append(el('label', null, row.label), val);
      return r;
    }));
    resetView();
    loadModel(e);
    discover(e);
  }

  function setPager(index, total) {
    config.pager = { index, total };
    ui.pagerText.textContent = `${index} / ${total}`;
  }
  let toastTimer = null;
  function showToast(saved = config.archive.saved, total = config.archive.total) {
    ui.toastSub.textContent = t.saved.replace('{saved}', saved).replace('{total}', total);
    ui.toast.classList.remove('hide');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.add('hide'), config.toastMs);
  }

  /* ----- Archive: stores the explorer card + every equipment card that was discovered ----- */
  const archive = loadArchive(explorer);
  function discover(e) {
    if (!e?.id) return;
    const isNew = saveEquipment(archive, e);
    if (isNew) showToast(Object.keys(archive.equipment).length, config.archive.total);
    else { clearTimeout(toastTimer); ui.toast.classList.add('hide'); }   // already in the archive
    if (ui.arch.classList.contains('open')) renderArchive();
  }
  const esc = (v = '') => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (ts) => new Date(ts || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  // one boarding-pass ticket (same look as the registration card)
  function ticketHTML({ stub, tag, glow, kind, title, sub, subSmall, fields, avatar, dot, badgeLabel, badgeValue }) {
    // no `stub` = no barcode / photo panel on the left (equipment cards), so they differ from the explorer card
    return `<div class="eq-tkc${stub ? '' : ' nostub'}">
      ${stub ? `<div class="eq-tks"><i class="eq-bar"></i><span class="eq-vt">${esc(stub)}</span><div class="eq-pnl ${glow}"><b>${esc(tag)}</b></div></div>` : ''}
      <div class="eq-tkm">
        <div class="eq-tkh"><i class="eq-pdot ${dot || ''}"></i>Space Exploration Program</div>
        <div class="eq-tkk">${esc(kind)}</div>
        <div class="eq-tkn">${esc(title)}</div>
        ${sub ? `<div class="eq-tkn2${subSmall ? ' sm' : ''}">${esc(sub)}</div>` : ''}
        <div class="eq-tkf">${fields.map(([l, v, sm]) => `<div><label>${esc(l)}</label><b>${esc(v).replace(/\n/g, '<br>')}</b>${sm ? `<small>${esc(sm)}</small>` : ''}</div>`).join('')}</div>
      </div>
      <div class="eq-tkb"><div class="eq-badge">${avatar}</div><div class="eq-bl2">${esc(badgeLabel)}</div><div class="eq-bv">${esc(badgeValue)}</div></div>
    </div>`;
  }
  function renderArchive() {
    const saved = Object.values(archive.equipment).sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0));
    const total = Math.max(config.archive.total, saved.length);
    ui.archCount.textContent = `${saved.length} / ${total}`;

    // explorer card
    const u = archive.explorer || {};
    const parts = String(u.name || 'Explorer').trim().split(/\s+/);
    const userTk = el('div', 'eq-tk');
    userTk.innerHTML = ticketHTML({
      stub: `Explorer mission · ${u.id || ''}`, tag: '#SPACEJOURNEY', glow: 'mars', dot: '',
      kind: 'Boarding pass: Explorer mission',
      title: parts[0], sub: parts.slice(1).join(' '),
      fields: [
        ['Launch site', 'Earth', 'Mission control'],
        ['Arrival site', 'Moon - Mars', 'Lunar surface'],
        ['Scheduled departure', u.departure || fmtDate(u.joinedAt)],
        ['Explorer ID · Rank', `${u.id || '—'} · ${u.rank || '—'}`],
      ],
      avatar: avatarSvg(true), badgeLabel: 'Cards saved', badgeValue: `${saved.length} / ${total}`,
    });
    ui.ucard.replaceChildren(userTk);

    // equipment cards
    const cards = saved.map((c) => {
      const mars = c.planet === 'mars';
      const tk = el('div', 'eq-tk sm' + (c.id === entity?.id ? ' cur' : ''));
      tk.dataset.id = c.id;
      tk.tabIndex = 0;
      tk.setAttribute('role', 'button');
      tk.innerHTML = ticketHTML({
        stub: null, dot: mars ? 'mars' : 'moon',
        kind: 'Equipment card: Discovered',
        title: c.shortName || c.name, sub: c.name, subSmall: true,
        fields: [
          ['Site', c.site || '—'],
          ['Coordinates', c.coordinates || '—'],
          ['Discovered', fmtDate(c.savedAt)],
          ['ID · Planet', `${c.id} · ${mars ? 'Mars' : 'Moon'}`],
        ],
        avatar: avatarSvg(mars), badgeLabel: 'Status', badgeValue: 'Saved',
      });
      return tk;
    });
    for (let i = saved.length; i < total; i++) {
      const lk = el('div', 'eq-tk lock sm');
      lk.innerHTML = `<div class="eq-tkc">${esc(t.locked)}</div>`;
      cards.push(lk);
    }
    ui.egrid.replaceChildren(...cards);
  }
  function openArchive() { renderArchive(); ui.arch.classList.add('open'); }
  function closeArchive() { ui.arch.classList.remove('open'); }
  ui.archClose.addEventListener('click', closeArchive);
  ui.arch.addEventListener('click', (e) => { if (e.target === ui.arch) closeArchive(); });
  ui.egrid.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.target.click?.(); } });
  ui.egrid.addEventListener('click', (e) => {
    const b = e.target.closest('.eq-tk[data-id]');
    if (!b) return;
    const i = entities.findIndex((x) => x.id === b.dataset.id);
    closeArchive();
    if (i >= 0 && i !== idx) goTo(i);
  });

  /* ----- Top buttons ----- */
  const onBack = () => options.onBack?.();
  function goTo(i) {
    if (entities.length < 2) return;
    closeStory();
    closeArchive();
    idx = (i + entities.length) % entities.length;
    setPager(idx + 1, pagerTotal);
    setEntity(entities[idx]);
    options.onChange?.(entities[idx], idx);
  }
  const onArchive = () => { if (options.onArchive) options.onArchive(); else openArchive(); };
  const onPrev = () => { goTo(idx - 1); options.onPrev?.(); };
  const onNext = () => { goTo(idx + 1); options.onNext?.(); };
  ui.back.addEventListener('click', onBack);
  ui.archive.addEventListener('click', onArchive);
  ui.prev.addEventListener('click', onPrev);
  ui.next.addEventListener('click', onNext);

  /* ----- Story (dialogue, visual-novel style) ----- */
  let si = 0, typeId = null, finishType = null, audio = null, lineToken = 0, muted = false;
  const stopAudio = () => { lineToken++; if (audio) { audio.pause(); audio = null; } };
  const stopType = () => { clearInterval(typeId); typeId = null; finishType = null; ui.dots.classList.remove('typing'); };
  function typeText(full) {
    ui.storyText.textContent = '';
    if (reduceMotion || !config.typeSpeedMs) { ui.storyText.textContent = full; return; }
    let n = 0;
    ui.dots.classList.add('typing');
    finishType = () => { stopType(); ui.storyText.textContent = full; };
    typeId = setInterval(() => { n++; ui.storyText.textContent = full.slice(0, n); if (n >= full.length) finishType(); }, config.typeSpeedMs);
  }
  function showLine(i) {
    const lines = entity.monologue || [];
    if (!lines[i]) return closeStory();
    stopAudio(); stopType();
    si = i;
    ui.storyWho.textContent = fill(lines[i].speaker || entity.shortName || '');
    ui.storyCount.textContent = `${i + 1} / ${lines.length}`;
    ui.storyNext.textContent = i === lines.length - 1 ? t.done : t.next;
    typeText(fill(lines[i].text));
    const my = ++lineToken;
    const play = (src, onEnd) => {
      let done = false;
      const end = () => { if (!done) { done = true; if (my === lineToken) onEnd?.(); } };
      const a = new Audio(src);
      a.muted = muted;
      audio = a;
      a.addEventListener('ended', end);
      a.addEventListener('error', end);
      a.play().catch(end);
    };
    const voice = () => { if (lines[i].audio) play(lines[i].audio); };
    if (lines[i].sfx) play(lines[i].sfx, voice); else voice();
  }
  function openStory() {
    storyOpen = true;
    root.classList.add('story-mode');      // every card fades out, only the 3D object stays
    setWire(false);                        // object is shown solid while it talks
    ui.storywrap.classList.add('open');
    showLine(0);
    ui.storyNext.focus({ preventScroll: true });
  }
  function closeStory() {
    stopAudio(); stopType();
    if (!storyOpen) return;
    storyOpen = false;
    root.classList.remove('story-mode');
    ui.storywrap.classList.remove('open');
    setWire(analyzing || analyzed);        // bring the analyzed look back if it was on
  }
  const onStoryNext = () => {
    if (finishType) finishType();
    else if (si >= (entity.monologue?.length || 0) - 1) closeStory();
    else showLine(si + 1);
  };
  const onSnd = () => {
    muted = !muted;
    if (audio) audio.muted = muted;
    ui.snd.innerHTML = svg(muted ? 'mute' : 'sound');
    ui.snd.setAttribute('aria-pressed', String(muted));
  };
  const onKey = (e) => { if (e.key === 'Escape') { closeStory(); closeArchive(); } };
  ui.story.addEventListener('click', openStory);
  ui.storyNext.addEventListener('click', onStoryNext);
  ui.storyClose.addEventListener('click', closeStory);
  ui.snd.addEventListener('click', onSnd);
  window.addEventListener('keydown', onKey);

  /* ----- Resize + loop ----- */
  function fit() {
    const w = ui.canvas.clientWidth || window.innerWidth;
    const h = ui.canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    updateFrame();
  }
  const resizeObserver = new ResizeObserver(fit);
  resizeObserver.observe(ui.canvas);
  fit();
  renderer.setAnimationLoop(() => {
    tickAnalyze();
    updateFrame();
    renderer.render(scene, camera);
  });

  /* ----- Start ----- */
  setPager(idx + 1, pagerTotal);
  setEntity(entity);   // also saves it to the archive + shows the toast when it is new

  return {
    root, scene, camera, renderer,
    setEntity, setPager, showToast, goTo, openArchive, closeArchive,
    dispose() {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      clearTimeout(toastTimer);
      closeStory();
      loadToken++;
      disposeModel();
      if (sharedTerrain) scene.remove(sharedTerrain.root);   // stays cached for the next open; see disposeSharedTerrain()
      groundGeo.dispose();
      groundMat.dispose();
      window.removeEventListener('keydown', onKey);
      renderer.dispose();
      spaceBg?.dispose();
      root.remove();
      styleEl.remove();
    },
  };
}