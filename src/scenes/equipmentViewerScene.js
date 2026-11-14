// src/scenes/equipmentViewerScene.js
// -----------------------------------------------------------------------------
// Equipment page (Eagle, and later every other equipment) in the same
// boarding-pass "paper" style as the registration card.
//
//   - TRANSPARENT UI layer: put your own background behind it.
//   - Full-screen 3D viewport behind the HUD cards.
//   - VIEW panel: camera zoom, orbit X/Y, camera roll Z, light (Day/Dusk/Night).
//   - Read story: opens the entity's monologue. Analyze: wireframe + scan line.
//
// USAGE
//   import { EAGLE } from '../entities/moon/eagle.js';
//   const viewer = createEquipmentViewer(document.body, { entity: EAGLE, onBack: () => viewer.dispose() });
// -----------------------------------------------------------------------------

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createSpaceBackground } from './spaceBackground.js';

export const VIEWER_CONFIG = {
  background: true,                   // same space background as the ID card. false = transparent (use your own)
  pager: { index: 1, total: 3 },      // 3 equipment per planet
  archive: { saved: 1, total: 6 },    // 3 on the Moon + 3 on Mars
  footer: 'Placeholder scene · Moon surface',
  toastMs: 5000,
  typeSpeedMs: 22,
  text: {
    view: 'View', reset: 'Reset', zoom: 'Zoom', rotation: 'Camera', light: 'Light',
    day: 'Day', dusk: 'Dusk', night: 'Night',
    story: 'Read story', analyze: 'Analyze',
    data: 'Data', ready: 'Ready', loading: 'Loading', awaiting: 'Awaiting GLB',
    discovered: 'Equipment discovered', saved: '{saved} of {total} saved to your archive',
    next: 'Continue', done: 'Finish', close: 'Close',
    placeholder: '3D model',
    statLabels: { coordinates: 'Coordinates', size: 'Size', mass: 'Mass', power: 'Power source', materials: 'Materials' },
  },
};

const LIGHTS = {
  day:   { amb: [0xffffff, 0.75], key: [0xfff4e0, 3.0, [4, 5, 3]],    rim: [0x7fb0ff, 0.8] },
  dusk:  { amb: [0xb89a9a, 0.4],  key: [0xff9a5a, 2.2, [-5, 1.2, 2]], rim: [0x6a7bff, 0.7] },
  night: { amb: [0x6f86c8, 0.14], key: [0x9ab4ff, 0.9, [3, 4, -2]],   rim: [0x4d6bff, 0.5] },
};

const HEX = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='56' height='97'><path d='M28 2 54 17v30L28 62 2 47V17z' fill='none' stroke='%230b1a3a' stroke-opacity='.07'/></svg>")`;

const ICON = {
  back: '<path d="M15 5l-7 7 7 7M8 12h12"/>',
  book: '<path d="M4 5.5C4 5 4.5 4.5 5 4.5H11v15H5c-.5 0-1-.5-1-1zM20 5.5c0-.5-.5-1-1-1h-6v15h6c.5 0 1-.5 1-1z"/>',
  prev: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  scan: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M4 12h16"/>',
  reset: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/>',
};
const svg = (name, w = 2) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

/* ---------------- Styles ---------------- */

const STYLES = `
  .eq-root { position: fixed; inset: 0; z-index: 70; overflow: hidden; pointer-events: none; background: transparent;
    font-family: 'Orbitron', 'Rajdhani', ui-sans-serif, system-ui, sans-serif; color: #0b1a3a; }
  .eq-bg { position: absolute; inset: 0; background: #000; z-index: 0; }
  .eq-canvas { position: fixed; inset: 0; z-index: 1; pointer-events: auto; cursor: grab; touch-action: none; }
  .eq-canvas:active { cursor: grabbing; }
  .eq-canvas canvas { width: 100%; height: 100%; display: block; }
  .eq-tl, .eq-top, .eq-tr, .eq-stage, .eq-bl, .eq-br, .eq-foot { z-index: 2; }
  .eq-root button { font: inherit; }
  .eq-root button:focus-visible, .eq-root input:focus-visible { outline: 2px solid #4d8cff; outline-offset: 3px; }

  /* ---------- paper card (same family as the boarding pass) ---------- */
  .eq-card { pointer-events: auto; filter: drop-shadow(0 0 16px rgba(60,120,255,.25)) drop-shadow(0 8px 20px rgba(0,0,0,.55)); }
  .eq-paper { position: relative; overflow: hidden; color: #0b1a3a; border-radius: 10px;
    background: ${HEX}, linear-gradient(180deg, #f4f8fd, #dce6f3);
    clip-path: polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 0 100%); }
  .eq-paper.sheen::after { content: ''; position: absolute; inset: -40%; pointer-events: none;
    background: linear-gradient(115deg, transparent 42%, rgba(255,255,255,.6) 50%, transparent 58%);
    animation: eqSheen 6s ease-in-out infinite; }
  @keyframes eqSheen { 0% { transform: translateX(-60%); } 60%, 100% { transform: translateX(60%); } }
  .eq-head { display: flex; align-items: center; gap: 8px; padding: 9px 30px 9px 14px; font-size: 10px; letter-spacing: .18em;
    text-transform: uppercase; color: #31456b; border-bottom: 1px solid rgba(11,26,58,.18); }
  .eq-head > span:first-child { display: flex; align-items: center; gap: 8px; }
  .eq-head .grow { margin-left: auto; }
  .eq-logo { width: 14px; height: 14px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #4d8cff, #0b1a3a); }
  .eq-link { display: inline-flex; align-items: center; gap: 5px; padding: 0; margin-left: auto; font-size: 10px; letter-spacing: .14em;
    text-transform: uppercase; color: #31456b; background: none; border: 0; cursor: pointer; }
  .eq-link:hover { color: #0b1a3a; }
  .eq-link svg { width: 12px; height: 12px; }

  /* ---------- top-left: buttons + VIEW ---------- */
  .eq-tl { position: absolute; top: 20px; left: 20px; width: 232px; display: flex; flex-direction: column; gap: 12px; }
  .eq-round-row { display: flex; gap: 10px; }
  .eq-round { pointer-events: auto; display: grid; place-items: center; width: 44px; height: 44px; padding: 0; color: #0b1a3a; cursor: pointer;
    background: linear-gradient(180deg, #f4f8fd, #dce6f3); border: 0; border-radius: 50%;
    box-shadow: 0 0 14px rgba(60,120,255,.3), 0 6px 14px rgba(0,0,0,.5); transition: transform .15s; }
  .eq-round:hover { transform: translateY(-1px); }
  .eq-round svg { width: 20px; height: 20px; }
  .eq-vbody { padding: 10px 16px 14px 14px; display: grid; gap: 10px; }
  .eq-viewpanel.collapsed .eq-vbody { display: none; }
  .eq-viewpanel .eq-head { cursor: pointer; }
  .eq-sub { font-size: 9px; letter-spacing: .16em; text-transform: uppercase; color: #6b7a96; }
  .eq-row { display: grid; grid-template-columns: 40px 1fr 42px; align-items: center; gap: 10px; font-size: 10px; letter-spacing: .1em; color: #31456b; }
  .eq-row output { text-align: right; font-weight: 700; color: #0b1a3a; }
  .eq-row input[type=range] { -webkit-appearance: none; appearance: none; width: 100%; height: 3px; margin: 0; border-radius: 2px; cursor: pointer;
    background: linear-gradient(90deg, #0b1a3a var(--p, 50%), rgba(11,26,58,.22) var(--p, 50%)); }
  .eq-row input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%;
    background: #0b1a3a; border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(11,26,58,.6); }
  .eq-row input[type=range]::-moz-range-thumb { width: 10px; height: 10px; border-radius: 50%; background: #0b1a3a; border: 2px solid #fff; }
  .eq-seg { grid-column: 2 / 4; display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid rgba(11,26,58,.45); border-radius: 6px; overflow: hidden; }
  .eq-seg button { padding: 6px 0; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: #31456b; background: transparent; border: 0; cursor: pointer; }
  .eq-seg button + button { border-left: 1px solid rgba(11,26,58,.3); }
  .eq-seg button.on { color: #fff; background: #0b1a3a; }

  /* ---------- top-centre: pager + toast ---------- */
  .eq-top { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .eq-pager { pointer-events: auto; display: flex; align-items: center; gap: 4px; padding: 4px; border-radius: 999px;
    background: linear-gradient(180deg, #f4f8fd, #dce6f3); box-shadow: 0 0 14px rgba(60,120,255,.3), 0 6px 14px rgba(0,0,0,.5); }
  .eq-pager button { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; color: #0b1a3a; background: transparent; border: 0; border-radius: 50%; cursor: pointer; }
  .eq-pager button:hover { background: rgba(11,26,58,.1); }
  .eq-pager svg { width: 16px; height: 16px; }
  .eq-pager b { min-width: 52px; text-align: center; font-size: 12px; letter-spacing: .12em; }
  .eq-toast { transition: opacity .4s, transform .4s; }
  .eq-toast.hide { opacity: 0; transform: translateY(-8px); pointer-events: none; }
  .eq-toast .eq-paper { display: flex; align-items: center; gap: 12px; padding: 10px 28px 10px 12px; }
  .eq-tick { display: grid; place-items: center; flex: none; width: 28px; height: 28px; color: #fff; background: #2d6be0; border-radius: 50%; }
  .eq-tick svg { width: 16px; height: 16px; }
  .eq-toast b { display: block; font-size: 11px; letter-spacing: .06em; }
  .eq-toast small { display: block; margin-top: 2px; font-size: 9px; letter-spacing: .06em; color: #6b7a96; }

  /* ---------- top-right: minimap ---------- */
  .eq-tr { position: absolute; top: 20px; right: 20px; width: 136px; }
  .eq-map { position: relative; height: 70px; margin: 8px 12px 12px 12px; border-radius: 4px; overflow: hidden;
    background: linear-gradient(#0b1a3a, #0b1a3a); box-shadow: inset 0 0 0 1px rgba(11,26,58,.6); }
  .eq-map::before { content: ''; position: absolute; inset: 0;
    background: linear-gradient(rgba(111,180,255,.22) 1px, transparent 1px) 0 0 / 100% 25%, linear-gradient(90deg, rgba(111,180,255,.22) 1px, transparent 1px) 0 0 / 20% 100%; }
  .eq-dot { position: absolute; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: #e8643a; box-shadow: 0 0 8px #e8643a; }
  .eq-dot::after { content: ''; position: absolute; inset: -5px; border: 1px solid #e8643a; border-radius: 50%; animation: eqPing 1.8s ease-out infinite; }
  @keyframes eqPing { from { transform: scale(.5); opacity: 1; } to { transform: scale(2.2); opacity: 0; } }

  /* ---------- centre: name | reticle frame | actions ---------- */
  .eq-stage { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
  .eq-mid { display: flex; flex-direction: column; align-items: center; gap: 18px; }
  .eq-mid-row { display: flex; align-items: center; gap: 22px; }
  .eq-name { width: 232px; }
  .eq-name .eq-paper { padding: 14px 30px 16px 18px; }
  .eq-code { font-size: 10px; letter-spacing: .24em; color: #6b7a96; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid rgba(11,26,58,.18); }
  .eq-ename { font-size: 15px; font-weight: 700; line-height: 1.35; letter-spacing: .03em; }

  .eq-frame { position: relative; pointer-events: none; width: min(42vh, 380px); aspect-ratio: 1;
    background:
      linear-gradient(#fff, #fff) top left / 22px 2px no-repeat, linear-gradient(#fff, #fff) top left / 2px 22px no-repeat,
      linear-gradient(#fff, #fff) top right / 22px 2px no-repeat, linear-gradient(#fff, #fff) top right / 2px 22px no-repeat,
      linear-gradient(#fff, #fff) bottom left / 22px 2px no-repeat, linear-gradient(#fff, #fff) bottom left / 2px 22px no-repeat,
      linear-gradient(#fff, #fff) bottom right / 22px 2px no-repeat, linear-gradient(#fff, #fff) bottom right / 2px 22px no-repeat; }
  .eq-ph { position: absolute; inset: 14%; display: grid; place-content: center; gap: 6px; text-align: center; pointer-events: none;
    color: #b9cbe6; border: 1px dashed rgba(185,203,230,.55); }
  .eq-ph b { font-size: 12px; letter-spacing: .24em; text-transform: uppercase; }
  .eq-ph span { font-size: 9px; letter-spacing: .12em; opacity: .75; }
  .eq-ph[hidden] { display: none; }
  .eq-frame.scan::after { content: ''; position: absolute; left: 0; right: 0; height: 2px; pointer-events: none;
    background: linear-gradient(90deg, transparent, #6fb4ff, transparent); box-shadow: 0 0 16px #6fb4ff; animation: eqScan 2.2s linear infinite; }
  @keyframes eqScan { from { top: 0; } to { top: 100%; } }

  .eq-actions { display: flex; flex-direction: column; gap: 12px; pointer-events: auto; }
  .eq-btn { display: inline-flex; align-items: center; gap: 10px; padding: 11px 20px; font-size: 11px; font-weight: 700; letter-spacing: .14em;
    text-transform: uppercase; white-space: nowrap; color: #05070d; background: #fff; border: 0; border-radius: 999px; cursor: pointer;
    box-shadow: 0 0 22px rgba(111,180,255,.35); transition: transform .15s, box-shadow .2s, background .2s, color .2s; }
  .eq-btn:hover { transform: translateY(-1px); box-shadow: 0 0 32px rgba(111,180,255,.6); }
  .eq-btn.on { color: #fff; background: #0b1a3a; box-shadow: 0 0 0 1px #6fb4ff, 0 0 22px rgba(111,180,255,.5); }
  .eq-btn svg { width: 16px; height: 16px; flex: none; }
  .eq-disc { max-width: min(430px, 80vw); }
  .eq-disc .eq-paper { padding: 9px 28px 9px 14px; font-size: 9px; line-height: 1.5; letter-spacing: .06em; text-align: center; color: #31456b; }

  /* ---------- bottom-left: stats | bottom-right: DATA ---------- */
  .eq-bl { position: absolute; bottom: 24px; left: 20px; max-width: calc(100vw - 360px); }
  .eq-stats { display: grid; grid-template-columns: repeat(5, auto); padding: 10px 30px 12px 6px; }
  .eq-stat { padding: 0 14px; min-width: 0; border-left: 2px dashed rgba(11,26,58,.25); }
  .eq-stat:first-child { border-left: 0; }
  .eq-stat label { display: block; font-size: 8px; letter-spacing: .16em; text-transform: uppercase; color: #6b7a96; }
  .eq-stat b { display: block; margin-top: 4px; font-size: 10px; line-height: 1.45; letter-spacing: .04em; white-space: pre-line; }

  .eq-br { position: absolute; bottom: 24px; right: 20px; width: 310px; }
  .eq-br .eq-head em { margin-left: auto; font-style: normal; color: #0b1a3a; font-weight: 700; }
  .eq-dbody { max-height: min(34vh, 290px); overflow-y: auto; scrollbar-width: thin; scrollbar-color: #0b1a3a rgba(11,26,58,.12); }
  .eq-drow { display: grid; grid-template-columns: 96px 1fr; gap: 12px; padding: 10px 14px; border-bottom: 1px solid rgba(11,26,58,.14); }
  .eq-drow:last-child { border-bottom: 0; }
  .eq-drow label { font-size: 9px; line-height: 1.5; letter-spacing: .08em; color: #6b7a96; }
  .eq-drow b a { display: block; margin-bottom: 5px; color: #1d4fb8; text-decoration: underline; text-underline-offset: 2px; }
  .eq-drow b { font-size: 10px; line-height: 1.55; letter-spacing: .03em; text-align: right; }

  .eq-foot { position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); font-size: 10px; letter-spacing: .12em; color: #8fa6c8;
    text-shadow: 0 1px 8px #000; white-space: nowrap; }

  /* ---------- story overlay ---------- */
  .eq-story { position: absolute; inset: 0; z-index: 10; display: grid; place-items: center; padding: 20px; background: rgba(2,5,14,.55);
    opacity: 0; visibility: hidden; transition: opacity .3s, visibility 0s .3s; }
  .eq-story.open { opacity: 1; visibility: visible; pointer-events: auto; transition-delay: 0s; }
  .eq-story .eq-card { width: min(640px, 94vw); }
  .eq-story-text { margin: 0; padding: 22px 30px 8px 22px; min-height: 8.5em; font-size: clamp(13px, 1.5vw, 16px); line-height: 1.7; letter-spacing: .02em; }
  .eq-story-actions { display: flex; justify-content: flex-end; padding: 6px 30px 18px 22px; }

  @media (max-width: 980px) {
    .eq-mid-row { flex-direction: column; gap: 14px; }
    .eq-name { width: min(320px, 86vw); }
    .eq-actions { flex-direction: row; }
    .eq-frame { width: min(30vh, 280px); }
    .eq-tr { display: none; }
    .eq-tl { width: 200px; }
    .eq-bl { display: none; }
    .eq-br { width: min(300px, 56vw); }
  }
  @media (prefers-reduced-motion: reduce) { .eq-root * { animation: none !important; transition: none !important; } }
`;

/* ---------------- Factory ---------------- */

export function createEquipmentViewer(container = document.body, options = {}) {
  const config = { ...VIEWER_CONFIG, ...(options.config || {}) };
  config.text = { ...VIEWER_CONFIG.text, ...(options.config?.text || {}) };
  config.pager = { ...VIEWER_CONFIG.pager, ...(options.config?.pager || {}) };
  config.archive = { ...VIEWER_CONFIG.archive, ...(options.config?.archive || {}) };
  const t = config.text;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let entity = options.entity;
  const explorer = options.explorer || {};
  // {name}, {id}, {rank} in any entity text are filled from the explorer
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
    <div class="eq-tl">
      <div class="eq-round-row">
        <button class="eq-round" data-eq="back" type="button" aria-label="Back">${svg('back')}</button>
        <button class="eq-round" data-eq="archive" type="button" aria-label="Archive">${svg('book')}</button>
      </div>
      <div class="eq-card eq-viewpanel" data-eq="viewpanel"><div class="eq-paper">
        <div class="eq-head" data-eq="viewhead"><span><i class="eq-logo"></i>${t.view}</span>
          <button class="eq-link" data-eq="reset" type="button">${svg('reset')}${t.reset}</button></div>
        <div class="eq-vbody">
          <div class="eq-row"><label>${t.zoom}</label><input type="range" data-eq="zoom" min="0.6" max="3" step="0.05" value="1"><output data-eq="zoomOut">1.0×</output></div>
          <div class="eq-sub">${t.rotation}</div>
          <div class="eq-row"><label>X</label><input type="range" data-eq="rx" min="-10" max="80" step="1" value="0"><output data-eq="rxOut">0°</output></div>
          <div class="eq-row"><label>Y</label><input type="range" data-eq="ry" min="-180" max="180" step="1" value="0"><output data-eq="ryOut">0°</output></div>
          <div class="eq-row"><label>Z</label><input type="range" data-eq="rz" min="-180" max="180" step="1" value="0"><output data-eq="rzOut">0°</output></div>
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
      <div class="eq-map"><i class="eq-dot" data-eq="dot"></i></div>
    </div></div>

    <div class="eq-stage"><div class="eq-mid">
      <div class="eq-mid-row">
        <div class="eq-card eq-name"><div class="eq-paper sheen">
          <div class="eq-code" data-eq="code"></div><div class="eq-ename" data-eq="name"></div>
        </div></div>
        <div class="eq-frame" data-eq="frame">
          <div class="eq-ph" data-eq="ph"><b>${t.placeholder}</b><span data-eq="glbname"></span></div>
        </div>
        <div class="eq-actions">
          <button class="eq-btn" type="button" data-eq="story">${svg('chat')}${t.story}</button>
          <button class="eq-btn" type="button" data-eq="analyze">${svg('scan')}${t.analyze}</button>
        </div>
      </div>
      <div class="eq-card eq-disc"><div class="eq-paper"><span data-eq="disc"></span></div></div>
    </div></div>

    <div class="eq-bl eq-card"><div class="eq-paper"><div class="eq-stats" data-eq="stats"></div></div></div>

    <div class="eq-br eq-card"><div class="eq-paper sheen">
      <div class="eq-head"><span>${t.data}</span><em data-eq="status"></em></div>
      <div class="eq-dbody" data-eq="data"></div>
    </div></div>

    <div class="eq-foot">${config.footer}</div>

    <div class="eq-story" data-eq="storywrap"><div class="eq-card"><div class="eq-paper">
      <div class="eq-head"><span><i class="eq-logo"></i><span data-eq="storyWho"></span></span>
        <span class="grow" data-eq="storyCount"></span>
        <button class="eq-link" type="button" data-eq="storyClose" style="margin-left:14px">${t.close}</button></div>
      <p class="eq-story-text" data-eq="storyText" aria-live="polite"></p>
      <div class="eq-story-actions"><button class="eq-btn" type="button" data-eq="storyNext"></button></div>
    </div></div></div>
  `;
  container.appendChild(root);
  const q = (k) => root.querySelector(`[data-eq="${k}"]`);
  const ui = Object.fromEntries(
    ['back','archive','viewpanel','viewhead','reset','zoom','zoomOut','rx','rxOut','ry','ryOut','rz','rzOut','light','prev','next',
     'pagerText','toast','toastSub','mapCode','dot','code','name','frame','canvas','ph','glbname','story','analyze','disc','stats',
     'data','status','storywrap','storyWho','storyCount','storyClose','storyText','storyNext'].map((k) => [k, q(k)])
  );
  if (window.innerWidth < 980) ui.viewpanel.classList.add('collapsed');
  const bgEl = q('bg');
  const spaceBg = config.background ? createSpaceBackground(bgEl) : null;
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
  ui.canvas.appendChild(renderer.domElement);

  const amb = new THREE.AmbientLight();
  const key = new THREE.DirectionalLight();
  const rim = new THREE.DirectionalLight();
  rim.position.set(-4, 1, -4);
  scene.add(amb, key, rim);

  // Wide planetary surface plane underneath the equipment so it doesn't float in empty space
  const groundGeo = new THREE.CircleGeometry(80, 64);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.95, metalness: 0.05 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.35;
  scene.add(ground);

  const pivot = new THREE.Group();   // stays stationary on the surface
  const holder = new THREE.Group();  // entity.glb.viewRotationDeg
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
    rz: [ui.rz, ui.rzOut, (v) => `${Math.round(v)}°`],
  };
  const paint = (k) => {
    const [inp, out, fmt] = sliders[k];
    const pct = ((Number(inp.value) - Number(inp.min)) / (Number(inp.max) - Number(inp.min))) * 100;
    inp.style.setProperty('--p', `${pct}%`);
    out.textContent = fmt(inp.value);
  };
  const applyView = () => {
    // Keep the 3D equipment & ground completely stationary; orbit and roll the camera around TARGET
    pivot.rotation.set(0, 0, 0);

    const pitch = THREE.MathUtils.degToRad(+ui.rx.value);
    const yaw   = THREE.MathUtils.degToRad(+ui.ry.value);
    const roll  = THREE.MathUtils.degToRad(+ui.rz.value);
    const dist  = BASE_DIST / +ui.zoom.value;

    const basePhi = THREE.MathUtils.degToRad(80);
    const phi = THREE.MathUtils.clamp(basePhi - pitch, THREE.MathUtils.degToRad(10), THREE.MathUtils.degToRad(86));

    const spherical = new THREE.Spherical(dist, phi, yaw);
    const offset = new THREE.Vector3().setFromSpherical(spherical);

    camera.position.copy(TARGET).add(offset);
    camera.up.set(0, 1, 0);
    camera.lookAt(TARGET);
    camera.rotateZ(roll);
  };
  const setSlider = (k, v) => { sliders[k][0].value = v; paint(k); applyView(); };
  Object.keys(sliders).forEach((k) => {
    paint(k);
    sliders[k][0].addEventListener('input', () => { paint(k); applyView(); });
  });
  const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
  const onReset = (e) => {
    e.stopPropagation();
    setSlider('zoom', 1); setSlider('rx', 0); setSlider('ry', 0); setSlider('rz', 0); setLight('day');
  };
  const onLight = (e) => { const b = e.target.closest('button[data-light]'); if (b) setLight(b.dataset.light); };
  const onViewHead = (e) => { if (!e.target.closest('button')) ui.viewpanel.classList.toggle('collapsed'); };
  ui.reset.addEventListener('click', onReset);
  ui.light.addEventListener('click', onLight);
  ui.viewhead.addEventListener('click', onViewHead);

  // drag to orbit camera, wheel to zoom
  let drag = null;
  const onDown = (e) => { drag = { x: e.clientX, y: e.clientY }; ui.canvas.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => {
    if (!drag) return;
    setSlider('ry', wrap(+ui.ry.value - (e.clientX - drag.x) * 0.5));
    setSlider('rx', Math.min(80, Math.max(-10, +ui.rx.value - (e.clientY - drag.y) * 0.5)));
    drag = { x: e.clientX, y: e.clientY };
  };
  const onUp = () => { drag = null; };
  const onWheel = (e) => {
    e.preventDefault();
    setSlider('zoom', Math.min(3, Math.max(0.6, +ui.zoom.value - e.deltaY * 0.001)));
  };
  ui.canvas.addEventListener('pointerdown', onDown);
  ui.canvas.addEventListener('pointermove', onMove);
  ui.canvas.addEventListener('pointerup', onUp);
  ui.canvas.addEventListener('pointercancel', onUp);
  ui.canvas.addEventListener('wheel', onWheel, { passive: false });

  /* ----- Analyze (wireframe + scan line) ----- */
  let analyzing = false;
  const eachMaterial = (fn) => holder.traverse((o) => {
    if (o.isMesh) [].concat(o.material).forEach((m) => m && fn(m));
  });
  const onAnalyze = () => {
    analyzing = !analyzing;
    ui.analyze.classList.toggle('on', analyzing);
    ui.frame.classList.toggle('scan', analyzing);
    eachMaterial((m) => { m.wireframe = analyzing; });
  };
  ui.analyze.addEventListener('click', onAnalyze);

  /* ----- Entity (text, stats, GLB) ----- */
  let loadToken = 0;
  const disposeModel = () => {
    holder.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.isMesh) [].concat(o.material).forEach((m) => { Object.values(m).forEach((v) => v?.isTexture && v.dispose()); m.dispose?.(); });
    });
    holder.clear();
  };
  const setStatus = (s) => { ui.status.textContent = s; };

  function loadModel(e) {
    const my = ++loadToken;
    disposeModel();
    const url = e.glb?.url;
    ui.ph.hidden = false;
    ui.glbname.textContent = url ? url.split('/').pop() : '';
    setStatus(t.loading);
    const miss = () => { if (my === loadToken) { ui.ph.hidden = false; setStatus(t.awaiting); } };
    if (!url) { miss(); return; }
    new GLTFLoader().load(url, (gltf) => {
      if (my !== loadToken) return;
      const obj = gltf.scene;
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const s = (2.4 / (Math.max(size.x, size.y, size.z) || 1)) * (e.glb.viewScale || 1);
      obj.scale.setScalar(s);
      obj.position.copy(center.multiplyScalar(-s));
      // Align the extended ground plane right underneath the loaded model's bottom
      const scaledBox = new THREE.Box3().setFromObject(obj);
      ground.position.y = scaledBox.min.y - 0.005;
      groundMat.color.set(e.planet === 'mars' ? 0xb55a3c : 0xcfcfcf);

      holder.add(obj);
      const r = e.glb.viewRotationDeg || [0, 0, 0];
      holder.rotation.set(...r.map((d) => THREE.MathUtils.degToRad(d)));
      if (analyzing) eachMaterial((m) => { m.wireframe = true; });
      ui.ph.hidden = true;
      setStatus(t.ready);
    }, undefined, miss);
  }

  function setEntity(e) {
    entity = e;
    ui.code.textContent = e.id;
    ui.name.textContent = e.name;
    ui.disc.textContent = e.disclaimer || '';
    ui.mapCode.textContent = e.planetCode || '';
    ui.dot.style.left = `${(((e.location.lon + 180) / 360) * 100) % 100}%`;
    ui.dot.style.top = `${((90 - e.location.lat) / 180) * 100}%`;
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
    onResetSilent();
    loadModel(e);
  }
  function onResetSilent() { setSlider('zoom', 1); setSlider('rx', 0); setSlider('ry', 0); setSlider('rz', 0); }

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

  /* ----- Top buttons ----- */
  const onBack = () => options.onBack?.();
  const onArchive = () => options.onArchive?.();
  const onPrev = () => options.onPrev?.();
  const onNext = () => options.onNext?.();
  ui.back.addEventListener('click', onBack);
  ui.archive.addEventListener('click', onArchive);
  ui.prev.addEventListener('click', onPrev);
  ui.next.addEventListener('click', onNext);

  /* ----- Story (monologue) ----- */
  let si = 0, typeId = null, finishType = null, audio = null, lineToken = 0;
  const stopAudio = () => { lineToken++; if (audio) { audio.pause(); audio = null; } };
  const stopType = () => { clearInterval(typeId); typeId = null; finishType = null; };
  function typeText(full) {
    ui.storyText.textContent = '';
    if (reduceMotion || !config.typeSpeedMs) { ui.storyText.textContent = full; return; }
    let n = 0;
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
    // optional sound effect first, then the voice. Missing mp3 files are fine, the text still shows.
    const my = ++lineToken;
    const play = (src, onEnd) => {
      let done = false;
      const end = () => { if (!done) { done = true; if (my === lineToken) onEnd?.(); } };
      const a = new Audio(src);
      audio = a;
      a.addEventListener('ended', end);
      a.addEventListener('error', end);
      a.play().catch(end);
    };
    const voice = () => { if (lines[i].audio) play(lines[i].audio); };
    if (lines[i].sfx) play(lines[i].sfx, voice); else voice();
  }
  function openStory() { ui.storywrap.classList.add('open'); showLine(0); ui.storyNext.focus({ preventScroll: true }); }
  function closeStory() { stopAudio(); stopType(); ui.storywrap.classList.remove('open'); }
  const onStoryNext = () => {
    if (finishType) finishType();
    else if (si >= (entity.monologue?.length || 0) - 1) closeStory();
    else showLine(si + 1);
  };
  const onKey = (e) => { if (e.key === 'Escape') closeStory(); };
  ui.story.addEventListener('click', openStory);
  ui.storyNext.addEventListener('click', onStoryNext);
  ui.storyClose.addEventListener('click', closeStory);
  window.addEventListener('keydown', onKey);

  /* ----- Resize + loop ----- */
  function fit() {
    const w = ui.canvas.clientWidth || window.innerWidth;
    const h = ui.canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(fit);
  resizeObserver.observe(ui.canvas);
  fit();
  renderer.setAnimationLoop(() => renderer.render(scene, camera));

  /* ----- Start ----- */
  setPager(config.pager.index, config.pager.total);
  setEntity(entity);
  showToast();

  return {
    root, scene, camera, renderer,
    setEntity, setPager, showToast,
    dispose() {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      clearTimeout(toastTimer);
      closeStory();
      loadToken++;
      disposeModel();
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