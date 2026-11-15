// src/scenes/dialogueScene.js
// -----------------------------------------------------------------------------
// MERGED FILE: ship intro (three.js) + dialogue UI + launch + fade to black.
//
// Flow (createBriefingScene):
//   logo + "Start journey"  ->  thrust + zoom on the cockpit  ->  explorer name screen
//   -> dialogue (loading -> registration -> welcome -> mission briefing -> "Do you accept?")
//   -> accept -> the ship keeps going and launches away -> fade to black
//   -> onEnd()  (you start the next scene, then call revealFromBlack())
//
// Assets (public/assets):
//   /assets/shuttle-fire.obj
//   /assets/remember-me-logo.svg
//
// Also still exported (unchanged): DIALOGUE_CONFIG, createDialogueScene,
// initDialogueFlow, so nothing else in your project breaks.
//
// VOICE: every dialogue step has an `audio` path. Drop mp3 files at those paths
// (public/assets/audio/dialogue/). If a file is missing the text still types out
// and panels auto-advance on a timer.
// Placeholders in text: {name} {id} {rank} {issued}
// -----------------------------------------------------------------------------

import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const DIALOGUE_CONFIG = {
  accentColor: '#6fb4ff',
  typeSpeedMs: 24,            // typewriter speed per character (0 = instant)
  scrim: true,                // soft gradient behind the dialogue box (not a background)
  portraitImage: null,        // e.g. '/assets/images/mission-control.png'; null = placeholder emblem
  speaker: 'Mission Control',

  text: {
    skip: 'Skip intro',
    voiceOn: 'Voice on',
    voiceOff: 'Voice off',
    next: 'Continue',
    accepted: 'Mission accepted',
    acceptedSub: 'Preparing your spaceship',
    tasksTitle: 'Mission orders',
    tasksStub: 'Mission orders',
    voiceLabel: 'Voice',
  },

  // Shown as two cards while the mission is explained
  tasks: [
    { planet: 'Moon', text: 'Learn the story of 3 pieces of lunar equipment.', total: 3 },
    { planet: 'Mars', text: 'Learn the story of 3 pieces of Mars equipment.', total: 3 },
  ],

  // The whole conversation. Edit text / audio paths freely.
  //   loading : progress bar + cycling status messages
  //   panel   : centered text, auto-advances (after audio ends, or after `hold` ms)
  //   say     : dialogue box, player clicks Continue
  //   ask     : dialogue box with Accept / Hear it again
  script: [
    {
      type: 'loading',
      duration: 3000,
      messages: [
        'Creating your explorer profile',
        'Connecting to mission control',
        'Calibrating flight systems',
      ],
    },
    {
      type: 'panel',
      title: 'Your registration is complete.',
      sub: 'Explorer ID {id}, rank {rank}.',
      audio: '/assets/audio/dialogue/registration-complete.mp3',
      hold: 3400,
    },
    {
      type: 'panel',
      title: 'Welcome, Space Commander {name}!',
      sub: 'Explorer ID {id}',
      audio: '/assets/audio/dialogue/welcome.mp3',
      hold: 3600,
    },
    {
      type: 'say',
      text: 'Commander {name}, mission control has been waiting for you.',
      audio: '/assets/audio/dialogue/brief-1.mp3',
    },
    {
      type: 'say',
      text: 'Your assignment covers two worlds: the Moon and Mars. On each one, three pieces of equipment are waiting to be explored.',
      audio: '/assets/audio/dialogue/brief-2.mp3',
    },
    {
      type: 'say',
      showTasks: true,
      text: 'You have two tasks. First, learn the story behind each of the 3 pieces of equipment on the Moon. Then do the same on Mars. Six stories in total.',
      audio: '/assets/audio/dialogue/brief-3.mp3',
    },
    {
      type: 'ask',
      showTasks: true,
      text: 'Will you accept this mission, Commander {name}?',
      audio: '/assets/audio/dialogue/ask-accept.mp3',
      acceptLabel: 'Accept mission',
      declineLabel: 'Hear it again',
    },
  ],
};

/* ---------------- Shared black overlay (survives scene changes) ---------------- */

const BLACK_ID = 'rm-blackout';

export function blackoutScreen(fadeMs) {
  document.getElementById(BLACK_ID)?.remove();
  const f = document.createElement('div');
  f.id = BLACK_ID;
  Object.assign(f.style, {
    position: 'fixed', inset: '0', zIndex: '100', background: '#000',
    opacity: '0', pointerEvents: 'none', transition: `opacity ${fadeMs}ms ease`,
  });
  document.body.appendChild(f);
  f.getBoundingClientRect();                   // force reflow so the transition runs
  f.style.opacity = '1';
}

// Call this once the NEXT scene is ready. Fades the black away, then removes it.
export function revealFromBlack(ms = 1200, delayMs = 0) {
  setTimeout(() => {
    const f = document.getElementById(BLACK_ID);
    if (!f) return;
    f.style.transition = `opacity ${ms}ms ease`;
    f.style.opacity = '0';
    setTimeout(() => f.remove(), ms + 100);
  }, delayMs);
}

/* ---------------- Dialogue styles (injected, styles.css stays untouched) ---------------- */

const buildStyles = (accent, scrim) => `
  .dl-root { position: fixed; inset: 0; z-index: 60; overflow: hidden; background: transparent;
    font-family: 'Orbitron', 'Rajdhani', ui-sans-serif, system-ui, sans-serif; color: #e8f1ff; }
  .dl-root button { font: inherit; }
  .dl-root button:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }

  /* legibility gradient, only behind the dialogue box */
  .dl-scrim { position: absolute; left: 0; right: 0; bottom: 0; height: 48%; pointer-events: none;
    background: linear-gradient(to top, rgba(2,5,14,.78), rgba(2,5,14,0)); opacity: 0; transition: opacity .5s; }
  ${scrim ? `.dl-root.mode-say .dl-scrim, .dl-root.mode-ask .dl-scrim { opacity: 1; }` : ''}

  /* top-right tools */
  .dl-tools { position: absolute; top: 18px; right: 18px; display: flex; gap: 8px; z-index: 3; }
  .dl-tool { padding: 8px 14px; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: #a9bddb;
    background: rgba(8,12,24,.55); border: 1px solid rgba(111,180,255,.28); border-radius: 999px; cursor: pointer;
    transition: border-color .2s, color .2s; }
  .dl-tool:hover { border-color: ${accent}; color: #fff; }
  .dl-tool.icon { display: grid; place-items: center; width: 38px; height: 38px; padding: 0; }
  .dl-tool.icon svg { width: 18px; height: 18px; display: block; }
  .dl-tool .dl-slash { display: none; }
  .dl-tool.is-off .dl-slash { display: block; }
  .dl-tool.is-off .dl-wave { display: none; }
  .dl-root:not(.mode-loading):not(.mode-panel) [data-dl="skip"] { display: none; }

  /* centered stages: loading / panel / accepted */
  .dl-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 16px; padding: 24px; text-align: center; text-shadow: 0 2px 20px rgba(0,0,0,.85); }
  .dl-center > * { animation: dlIn .6s both; }
  @keyframes dlIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .dl-center.is-panel { cursor: pointer; }
  .dl-title { margin: 0; font-size: clamp(20px, 3.4vw, 36px); font-weight: 600; letter-spacing: .06em; line-height: 1.3; }
  .dl-sub { margin: 0; font-size: clamp(13px, 1.6vw, 18px); letter-spacing: .1em; color: ${accent}; }
  .dl-status { margin: 0; font-size: 13px; letter-spacing: .16em; color: #b9cbe6; min-height: 1.2em; }
  .dl-bar { position: relative; width: min(360px, 70vw); height: 3px; overflow: hidden; border-radius: 2px;
    background: rgba(111,180,255,.2); }
  .dl-bar i { position: absolute; inset: 0; transform-origin: left; transform: scaleX(0); background: ${accent};
    box-shadow: 0 0 14px ${accent}; }

  /* dialogue box (say / ask) */
  .dl-stack { position: absolute; left: 50%; bottom: 4vh; width: min(900px, 94vw); display: flex; flex-direction: column; gap: 12px;
    transform: translate(-50%, 12px); opacity: 0; visibility: hidden; pointer-events: none;
    transition: opacity .4s, transform .4s, visibility 0s .4s; }
  .dl-root.mode-say .dl-stack, .dl-root.mode-ask .dl-stack { transform: translate(-50%, 0); opacity: 1; visibility: visible;
    pointer-events: auto; transition-delay: 0s; }

  /* mission list = futuristic paper, same family as the boarding pass */
  .dl-tasks { display: none; filter: drop-shadow(0 0 18px rgba(60,120,255,.28)) drop-shadow(0 10px 22px rgba(0,0,0,.6)); }
  .dl-root.show-tasks .dl-tasks { display: block; }
  .dl-paper { position: relative; display: grid; grid-template-columns: 76px 1fr; overflow: hidden; color: #0b1a3a;
    background: linear-gradient(180deg, #f4f8fd, #dce6f3); border-radius: 10px; animation: dlIn .5s both;
    clip-path: polygon(0 0, calc(100% - 28px) 0, 100% 28px, 100% 100%, 0 100%); }
  .dl-paper::after { content: ''; position: absolute; inset: -40%; pointer-events: none;
    background: linear-gradient(115deg, transparent 42%, rgba(255,255,255,.65) 50%, transparent 58%);
    animation: dlSheen 6s ease-in-out infinite; }
  @keyframes dlSheen { 0% { transform: translateX(-60%); } 60%, 100% { transform: translateX(60%); } }
  .dl-pstub { display: grid; grid-template-columns: 22px 1fr; gap: 8px; padding: 12px 10px; background: #cddbee;
    border-right: 2px dashed rgba(11,26,58,.4); }
  .dl-pbar svg { width: 100%; height: 100%; display: block; }
  .dl-pstub-text { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 9px; letter-spacing: .2em;
    text-transform: uppercase; color: #31456b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; }
  .dl-pmain { padding: 12px 40px 14px 20px;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='56' height='97'><path d='M28 2 54 17v30L28 62 2 47V17z' fill='none' stroke='%230b1a3a' stroke-opacity='.07'/></svg>"); }
  .dl-phead { display: flex; align-items: center; gap: 10px; padding-bottom: 8px; margin-bottom: 10px;
    font-size: 11px; letter-spacing: .1em; color: #31456b; border-bottom: 1px solid rgba(11,26,58,.18); }
  .dl-plogo { width: 18px; height: 18px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #4d8cff, #0b1a3a); }
  .dl-phead em { margin-left: auto; font-style: normal; font-weight: 700; color: #0b1a3a; }
  .dl-plist { display: grid; grid-template-columns: 1fr 1fr; }
  .dl-ptask { display: grid; align-content: start; gap: 4px; padding: 0 18px; }
  .dl-ptask:first-child { padding-left: 0; border-right: 2px dashed rgba(11,26,58,.25); }
  .dl-ptask small { font-size: 9px; letter-spacing: .16em; text-transform: uppercase; color: #6b7a96; }
  .dl-ptask b { font-size: 20px; letter-spacing: .06em; line-height: 1.1; }
  .dl-ptask span { font-size: 12px; line-height: 1.45; color: #1d2f55; }
  .dl-pips { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
  .dl-pips i { width: 22px; height: 6px; border: 1px solid #0b1a3a; border-radius: 2px; }
  .dl-pips em { margin-left: 6px; font-style: normal; font-size: 11px; color: #6b7a96; }

  .dl-box { display: grid; grid-template-columns: 104px 1fr; gap: 20px; padding: 22px 28px 20px 22px; cursor: pointer;
    background: rgba(5,9,22,.8); border-top: 2px solid #fff;
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    clip-path: polygon(0 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%); }
  .dl-portrait { width: 104px; height: 104px; background-size: cover; background-position: center;
    background: radial-gradient(110% 80% at 50% 110%, #2d6be0 0%, #14285a 55%, #080d1e 100%);
    box-shadow: inset 0 0 0 1px rgba(111,180,255,.45);
    clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%); }
  .dl-portrait svg { width: 100%; height: 100%; display: block; }
  .dl-body { min-width: 0; display: flex; flex-direction: column; }
  .dl-name { display: flex; align-items: center; margin-bottom: 8px; font-size: 12px; font-weight: 600; letter-spacing: .14em;
    color: ${accent}; }
  .dl-voice { display: inline-flex; align-items: flex-end; gap: 2px; height: 12px; margin-left: 12px; }
  .dl-voice i { width: 2px; height: 3px; background: ${accent}; opacity: .45; }
  .dl-root.speaking .dl-voice i, .dl-root.typing .dl-voice i { opacity: 1; animation: dlBar .7s ease-in-out infinite alternate; }
  .dl-voice i:nth-child(2) { animation-delay: .12s; } .dl-voice i:nth-child(3) { animation-delay: .24s; } .dl-voice i:nth-child(4) { animation-delay: .06s; }
  @keyframes dlBar { to { height: 12px; } }
  .dl-text { margin: 0; min-height: 4.8em; max-width: 62ch; font-size: clamp(14px, 1.6vw, 18px); line-height: 1.6; letter-spacing: .02em; }
  .dl-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px; min-height: 40px; }
  .dl-btn { padding: 11px 26px; font-size: 12px; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; cursor: pointer;
    border-radius: 999px; border: 1px solid transparent; transition: transform .15s, box-shadow .2s, border-color .2s; }
  .dl-btn.primary { color: #05070d; background: #fff; box-shadow: 0 0 24px rgba(111,180,255,.35); }
  .dl-btn.primary:hover { transform: translateY(-1px); box-shadow: 0 0 34px rgba(111,180,255,.6); }
  .dl-btn.ghost { color: #dbe8ff; background: transparent; border-color: rgba(111,180,255,.5); }
  .dl-btn.ghost:hover { border-color: #fff; }

  @media (max-width: 640px) {
    .dl-box { grid-template-columns: 1fr; padding: 18px 20px; }
    .dl-portrait { display: none; }
    .dl-paper { grid-template-columns: 1fr; }
    .dl-pstub { display: none; }
    .dl-pmain { padding: 12px 36px 14px 16px; }
    .dl-plist { grid-template-columns: 1fr; gap: 12px; }
    .dl-ptask, .dl-ptask:first-child { padding: 0; border-right: 0; }
    .dl-actions { justify-content: stretch; }
    .dl-btn { flex: 1; padding-inline: 12px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .dl-root * { animation: none !important; transition: none !important; }
  }
`;

const PORTRAIT_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="52" r="20" fill="#e8643a" opacity=".92"/>
  <ellipse cx="50" cy="52" rx="38" ry="11" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="2" transform="rotate(-20 50 52)"/>
  <circle cx="80" cy="30" r="3" fill="#fff"/><circle cx="18" cy="24" r="1.6" fill="#fff" opacity=".7"/>
</svg>`;

// Barcode drawn from the explorer ID (same ID = same bars), like the boarding pass
function makeBarcode(seed) {
  let n = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => (n = (n * 1664525 + 1013904223) >>> 0) / 4294967296;
  let x = 0, bars = '';
  while (x < 56) {
    const w = 1 + Math.floor(rnd() * 3.2);
    bars += `<rect x="${x}" y="0" width="${w}" height="100"/>`;
    x += w + 1 + Math.floor(rnd() * 2.2);
  }
  return `<svg viewBox="0 0 56 100" preserveAspectRatio="none" fill="#0b1a3a">${bars}</svg>`;
}

/* ---------------- Dialogue factory ---------------- */

export function createDialogueScene(container = document.body, options = {}) {
  const config = { ...DIALOGUE_CONFIG, ...(options.config || {}) };
  config.text = { ...DIALOGUE_CONFIG.text, ...(options.config?.text || {}) };
  const explorer = options.explorer || {};
  const onAccept = options.onAccept || (() => {});
  const steps = config.script;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const t = config.text;

  const fill = (s = '') => s.replace(/\{(\w+)\}/g, (_, k) => explorer[k] ?? '');
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text; // textContent keeps typed names safe
    return n;
  };

  /* ----- DOM ----- */
  const styleEl = document.createElement('style');
  styleEl.textContent = buildStyles(config.accentColor, config.scrim);
  document.head.appendChild(styleEl);

  const root = el('div', 'dl-root');
  root.innerHTML = `
    <div class="dl-scrim"></div>
    <div class="dl-tools">
      <button class="dl-tool" data-dl="skip" type="button"></button>
      <button class="dl-tool icon" data-dl="mute" type="button" aria-pressed="false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" fill-opacity=".25"/>
          <path class="dl-wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>
          <path class="dl-slash" d="M16 9.5l5 5M21 9.5l-5 5"/>
        </svg>
      </button>
    </div>
    <div class="dl-center" data-dl="center"></div>
    <div class="dl-stack">
      <div class="dl-tasks" data-dl="tasks"></div>
      <div class="dl-box" data-dl="box">
        <div class="dl-portrait" data-dl="portrait">${PORTRAIT_SVG}</div>
        <div class="dl-body">
          <div class="dl-name"><span data-dl="speaker"></span>
            <span class="dl-voice" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div>
          <p class="dl-text" data-dl="text" aria-live="polite"></p>
          <div class="dl-actions" data-dl="actions"></div>
        </div>
      </div>
    </div>
  `;
  container.appendChild(root);

  const q = (k) => root.querySelector(`[data-dl="${k}"]`);
  const center = q('center'), tasksEl = q('tasks'), box = q('box');
  const portrait = q('portrait'), speakerEl = q('speaker'), textEl = q('text'), actions = q('actions');
  const skipBtn = q('skip'), muteBtn = q('mute');

  skipBtn.textContent = t.skip;
  speakerEl.textContent = config.speaker;
  if (config.portraitImage) {
    portrait.innerHTML = '';
    portrait.style.backgroundImage = `url('${config.portraitImage}')`;
  }
  // Paper-style mission list
  const paper = el('div', 'dl-paper');
  const stub = el('div', 'dl-pstub');
  const bars = el('div', 'dl-pbar');
  bars.innerHTML = makeBarcode(String(explorer.id || 'EX'));
  stub.append(bars, el('div', 'dl-pstub-text', `${t.tasksStub} \u00b7 ${explorer.id || ''}`));
  const pmain = el('div', 'dl-pmain');
  const head = el('div', 'dl-phead');
  head.append(el('i', 'dl-plogo'), el('span', null, t.tasksTitle), el('em', null, explorer.id || ''));
  const list = el('div', 'dl-plist');
  config.tasks.forEach((task, i) => {
    const col = el('div', 'dl-ptask');
    const pips = el('div', 'dl-pips');
    for (let p = 0; p < task.total; p++) pips.appendChild(el('i'));
    pips.appendChild(el('em', null, `0/${task.total}`));
    col.append(el('small', null, `Task ${i + 1}`), el('b', null, task.planet), el('span', null, task.text), pips);
    list.appendChild(col);
  });
  pmain.append(head, list);
  paper.append(stub, pmain);
  tasksEl.appendChild(paper);

  /* ----- State ----- */
  let index = -1, token = 0, timers = [], typingId = null, finishTyping = null;
  let audio = null, muted = false;

  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const stopVoice = () => { if (audio) { audio.pause(); audio = null; } root.classList.remove('speaking'); };
  const stopTyping = () => { clearInterval(typingId); typingId = null; finishTyping = null; };
  const refreshMute = () => {
    const label = muted ? t.voiceOff : t.voiceOn;
    muteBtn.setAttribute('aria-label', label);
    muteBtn.title = label;
    muteBtn.classList.toggle('is-off', muted);
    muteBtn.setAttribute('aria-pressed', String(muted));
  };
  refreshMute();

  // Plays one mp3. If there is no file / it fails / voice is muted, waits `fallbackMs` instead.
  // `onDone` runs when the voice ends (or the fallback wait is over).
  function speak(src, fallbackMs, onDone) {
    const my = token;
    let finished = false;
    const finish = (delay) => {
      if (finished || my !== token) return;
      finished = true;
      later(() => { if (my === token) onDone?.(); }, delay);
    };
    if (!src || muted) { finish(fallbackMs); return; }
    const a = new Audio(src);
    audio = a;
    const fail = () => { root.classList.remove('speaking'); finish(fallbackMs); };
    a.addEventListener('playing', () => { if (my === token) root.classList.add('speaking'); });
    a.addEventListener('ended', () => { root.classList.remove('speaking'); finish(500); });
    a.addEventListener('error', fail);
    a.play().catch(fail);
  }

  function type(full, done) {
    textEl.textContent = '';
    if (reduceMotion || !config.typeSpeedMs) { textEl.textContent = full; done(); return; }
    let n = 0;
    root.classList.add('typing');
    finishTyping = () => {
      stopTyping();
      textEl.textContent = full;
      root.classList.remove('typing');
      done();
    };
    typingId = setInterval(() => {
      n++;
      textEl.textContent = full.slice(0, n);
      if (n >= full.length) finishTyping();
    }, config.typeSpeedMs);
  }

  const firstSay = () => Math.max(0, steps.findIndex((s) => s.type === 'say'));
  const next = () => go(index + 1);

  /* ----- Steps ----- */
  function go(i) {
    token++;
    clearTimers();
    stopVoice();
    stopTyping();
    const s = steps[i];
    if (!s) return;
    index = i;
    root.className = `dl-root mode-${s.type}${s.showTasks ? ' show-tasks' : ''}`;
    center.className = `dl-center${s.type === 'panel' ? ' is-panel' : ''}`;
    center.replaceChildren();
    actions.replaceChildren();

    if (s.type === 'loading') {
      const status = el('p', 'dl-status', s.messages?.[0] || '');
      const bar = el('div', 'dl-bar');
      const fillBar = el('i');
      bar.appendChild(fillBar);
      center.append(status, bar);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        fillBar.style.transition = `transform ${s.duration}ms linear`;
        fillBar.style.transform = 'scaleX(1)';
      }));
      const msgs = s.messages || [];
      msgs.forEach((m, k) => later(() => { status.textContent = m; }, (s.duration / msgs.length) * k));
      later(next, s.duration + 300);
      return;
    }

    if (s.type === 'panel') {
      center.append(el('h2', 'dl-title', fill(s.title)), el('p', 'dl-sub', fill(s.sub)));
      speak(s.audio, s.hold ?? 3200, next);
      return;
    }

    // say / ask
    type(fill(s.text), () => {
      if (s.type === 'say') {
        const btn = el('button', 'dl-btn ghost', t.next);
        btn.type = 'button';
        btn.addEventListener('click', (e) => { e.stopPropagation(); next(); });
        actions.appendChild(btn);
      } else {
        const decline = el('button', 'dl-btn ghost', s.declineLabel || 'Hear it again');
        const accept = el('button', 'dl-btn primary', s.acceptLabel || 'Accept mission');
        decline.type = accept.type = 'button';
        decline.addEventListener('click', (e) => { e.stopPropagation(); go(firstSay()); });
        accept.addEventListener('click', (e) => { e.stopPropagation(); acceptMission(); });
        actions.append(decline, accept);
        accept.focus({ preventScroll: true });
      }
    });
    speak(s.audio, 0);
  }

  function acceptMission() {
    token++;
    clearTimers();
    stopVoice();
    stopTyping();
    root.className = 'dl-root mode-accepted';
    center.className = 'dl-center';
    const bar = el('div', 'dl-bar');
    const fillBar = el('i');
    bar.appendChild(fillBar);
    center.replaceChildren(el('h2', 'dl-title', t.accepted), el('p', 'dl-sub', t.acceptedSub), bar);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fillBar.style.transition = 'transform 1.4s linear';
      fillBar.style.transform = 'scaleX(1)';
    }));
    later(() => onAccept({ ...explorer }), 1600);
  }

  /* ----- Input ----- */
  const advance = () => {
    const type_ = steps[index]?.type;
    if (finishTyping) finishTyping();            // first click completes the typing
    else if (type_ === 'say' || type_ === 'panel') next();
  };
  const onBoxClick = (e) => { if (!e.target.closest('button')) advance(); };
  const onCenterClick = () => { if (steps[index]?.type === 'panel') next(); };
  const onKey = (e) => {
    if (e.target.closest?.('button')) return;
    if (['Enter', ' ', 'ArrowRight'].includes(e.key)) { e.preventDefault(); advance(); }
  };
  const onSkip = () => go(firstSay());
  const onMute = () => {
    muted = !muted;
    refreshMute();
    if (muted) {
      stopVoice();
      if (steps[index]?.type === 'panel') go(index); // no audio to wait for, use the timer
    }
  };
  box.addEventListener('click', onBoxClick);
  center.addEventListener('click', onCenterClick);
  window.addEventListener('keydown', onKey);
  skipBtn.addEventListener('click', onSkip);
  muteBtn.addEventListener('click', onMute);

  go(0);

  /* ----- Public API ----- */
  return {
    root,
    goTo: go,
    dispose() {
      token++;
      clearTimers();
      stopVoice();
      stopTyping();
      box.removeEventListener('click', onBoxClick);
      center.removeEventListener('click', onCenterClick);
      window.removeEventListener('keydown', onKey);
      skipBtn.removeEventListener('click', onSkip);
      muteBtn.removeEventListener('click', onMute);
      root.remove();
      styleEl.remove();
    },
  };
}

/* =============================================================================
   SHIP STAGE (three.js): shuttle + stars + flame + launch / zoom / depart
   ============================================================================= */

// Tweak here
const SHIP = {
  length: 1.5,                              // world units
  baseRot: { x: -0.6, y: 0.14, z: 0.1 },    // roll (negative = belly toward camera), yaw, pitch
  y: 0,                                     // height above screen centre (fraction of view height)
  speed: 0.5,                               // overall animation speed
  stars: true,
  flameX: 1.55,                             // x where the flame card starts in the model
  zoomDoneAt: 3.3,                          // seconds after Start when the dialogue begins
};
// Launch after "Mission accepted"
const DEPART_SECONDS = 3.4;                 // length of the smooth fly-away
const DEPART_DISTANCE = 11;                 // how far the ship travels (world units)
const PULLBACK = { x: 0.6, y: 0.15, z: 2.4 }; // how far the camera eases back

// Tries each url in turn. A missing file on the Vite dev server comes back as index.html (HTTP 200),
// so the content is checked too instead of trusting the status code.
async function loadObj(urls) {
  const tried = [];
  for (const url of [].concat(urls)) {
    tried.push(url);
    try {
      const res = await fetch(url);
      const text = res.ok ? await res.text() : '';
      if (text && !text.trimStart().startsWith('<') && /^v\s/m.test(text)) return new OBJLoader().parse(text);
    } catch (e) { /* try the next one */ }
  }
  throw new Error('Shuttle OBJ not found. Tried: ' + tried.join(', '));
}

export function createShuttleStage(container, { objUrls, onLoaded, onError, onZoomed }) {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const amp = calm ? 0.25 : 1;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.75;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'rm-canvas';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 1000, 2000);

  // Space environment for reflections: hard sun panel, blue earthshine below, faint rim
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 16, 8), new THREE.MeshBasicMaterial({ color: 0x03050a, side: THREE.BackSide })));
  const panel = (w, h, color, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); envScene.add(m);
  };
  panel(14, 14, 0xfff4e0, 12, [25, 30, 30]);
  panel(70, 40, 0x2f6bff, 1.6, [0, -40, 10]);
  panel(30, 20, 0x8fb0ff, 0.5, [-40, 10, -20]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(envScene, 0.02).texture;
  pmrem.dispose();
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);

  // Post: HDR render target (MSAA) + bloom for flame and window glow
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.5, 0.9));
  composer.addPass(new OutputPass());

  // Lighting: hard sun with shadows, blue earthshine from below, warm engine glow
  scene.add(new THREE.AmbientLight(0x141c30, 0.25));
  const key = new THREE.DirectionalLight(0xfff1dc, 1.8); key.position.set(4, 5, 6); scene.add(key);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 1, far: 20 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  const earthshine = new THREE.DirectionalLight(0x3a72ff, 0.7); earthshine.position.set(-2, -6, 3); scene.add(earthshine);
  const backRim = new THREE.DirectionalLight(0x6f94ff, 0.5); backRim.position.set(-6, 2, -5); scene.add(backRim);
  const engineLight = new THREE.PointLight(0xff8a3a, 3.5, 9, 2); scene.add(engineLight);

  // Rig: float -> tilt (orientation) -> pivot (scale/center)
  const rig = new THREE.Group(); scene.add(rig);
  const tilt = new THREE.Group(); rig.add(tilt);
  tilt.rotation.set(SHIP.baseRot.x, SHIP.baseRot.y, SHIP.baseRot.z);

  // Stars
  if (SHIP.stars) {
    const p = new Float32Array(2000 * 3);
    for (let i = 0; i < 2000; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(90);
      p.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, color: 0xffffff, transparent: true, opacity: 0.75, fog: false })));
  }

  // Speed streaks (live in tilt space so they run parallel to the exhaust)
  const N = 26, streaks = [];
  const sPos = new Float32Array(N * 6), sCol = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = 2.2 + Math.random() * 6;
    streaks.push({ x: (Math.random() - 0.5) * 30, y: Math.cos(a) * r, z: Math.sin(a) * r, len: 0.6 + Math.random() * 1.2, spd: 5 + Math.random() * 6 });
    sCol.set([0, 0, 0, 0.22, 0.3, 0.5], i * 6);
  }
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage));
  sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  const streakMesh = new THREE.LineSegments(sGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  streakMesh.frustumCulled = false; tilt.add(streakMesh);

  // Flame shader (uv.x across the card, uv.y from engine -> tip)
  const flameMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFade: { value: 1 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime, uFade; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*n(p); p*=2.03; a*=.5; } return v; }
      void main(){
        float t = vUv.y, x = (vUv.x - 0.5) * 2.0;
        float a1 = fbm(vec2(vUv.x*3.0, t*5.0 - uTime*3.2));
        float a2 = fbm(vec2(vUv.x*6.0 + 7.0, t*9.0 - uTime*5.5));
        float width = mix(0.6, 0.1, pow(t, 0.7));
        float d = abs(x + (a1 - 0.5) * 0.6 * t) / width;
        float body = smoothstep(1.0, 0.0, d);
        float core = smoothstep(0.5, 0.0, d) * (1.0 - t * 0.85);
        float fade = smoothstep(1.0, 0.2, t) * smoothstep(0.0, 0.04, t);
        float al = body * fade * (0.7 + 0.6 * a2) * uFade;
        vec3 c = mix(vec3(1.0,0.97,0.85), vec3(1.0,0.6,0.18), smoothstep(0.0, 0.3, t + (1.0 - core) * 0.25));
        c = mix(c, vec3(1.0,0.27,0.1), smoothstep(0.3, 0.65, t + d * 0.2));
        c = mix(c, vec3(0.3,0.28,0.95), smoothstep(0.62, 1.0, t + d * 0.15));
        c += core * vec3(1.0,0.9,0.7) * 0.7;
        gl_FragColor = vec4(c * 1.0, al);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  // Material look by name (no .mtl supplied)
  function styleMat(name = '') {
    const k = name.toLowerCase();
    const o = { color: 0x2a2e36, roughness: 0.42, metalness: 0.3, envMapIntensity: 0.7 };
    if (k.includes('whi')) { o.color = 0x0a1114; o.emissive = 0x8fe8ff; o.emissiveIntensity = 1.3; }
    else if (k.includes('winodws_top_blac')) o.color = 0x040506;
    else if (k.includes('bay-win-ins')) { o.emissive = 0x6fdcff; o.emissiveIntensity = 1.4; o.color = 0x06090c; }
    else if (k.includes('bay-win')) o.color = 0x06080a;
    else if (k.includes('glass')) { o.color = 0x04070b; o.metalness = 0.9; o.roughness = 0.12; o.envMapIntensity = 0.9; }
    else if (k.includes('handrail')) { o.color = 0x6a707a; o.metalness = 0.8; o.roughness = 0.35; }
    else if (k.includes('arrows')) { o.emissive = 0xff7a2a; o.emissiveIntensity = 1.5; }
    else if (k.includes('bay')) o.color = 0x2b2f36;
    else if (k.includes('oms') || k.includes('rcs')) o.color = 0x2a2e35;
    else if (k.includes('nose')) o.color = 0x17191d;
    else if (k.includes('belly') || k.includes('wingtop') || k.includes('flap')) o.color = 0x1d2025;
    else if (k.includes('material')) { o.color = 0x23262c; o.metalness = 0.6; }
    return new THREE.MeshPhysicalMaterial({ ...o, clearcoat: k.includes('glass') ? 1 : 0.3, clearcoatRoughness: 0.3 });
  }

  // Load + build
  let flame = null, shuttleObj = null, disposed = false;
  loadObj(objUrls).then((obj) => {
    if (disposed) return;
    try {
      obj.traverse((m) => {
        if (!m.isMesh) return;
        if (m.name === 'Plane') { m.material = flameMat; m.renderOrder = 2; flame = m; return; }
        m.material = Array.isArray(m.material) ? m.material.map((x) => styleMat(x.name)) : styleMat(m.material.name);
        m.castShadow = m.receiveShadow = true;
      });
      const hull = new THREE.Box3();
      obj.traverse((m) => { if (m.isMesh && m !== flame) hull.expandByObject(m); });
      if (hull.isEmpty()) throw new Error('The OBJ file has no meshes');
      const c = hull.getCenter(new THREE.Vector3());
      obj.position.set(-c.x, -c.y, -c.z);
      const pivot = new THREE.Group(); pivot.add(obj);
      pivot.scale.setScalar(SHIP.length / (hull.max.x - hull.min.x));
      tilt.add(pivot);
      shuttleObj = obj;
      // engine light sits just behind the nozzle, in tilt space
      engineLight.userData.local = new THREE.Vector3(SHIP.flameX - c.x - 0.5, 0.84 - c.y, 0).multiplyScalar(pivot.scale.x);
      onLoaded?.();
    } catch (e) {
      console.error(e);
      onError?.(e);
    }
  }).catch((err) => {
    console.error(err);
    onError?.(err);
  });

  // Pointer parallax
  const mouse = new THREE.Vector2(), smooth = new THREE.Vector2();
  const onPointer = (e) => { mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight * 2 - 1)); };
  addEventListener('pointermove', onPointer);

  let dist = 9.5, shuttleY = 0;
  function resize() {
    const w = innerWidth, h = innerHeight, aspect = w / h;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = aspect; camera.updateProjectionMatrix();
    dist = 9.5 * Math.max(1, 1.1 / aspect);
    shuttleY = SHIP.y * 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    rig.position.x = 0;
  }
  addEventListener('resize', resize); resize();

  // Timelines
  const COCKPIT = new THREE.Vector3(2.55, 0.92, 0.22);    // zoom target near the nose, in model coordinates
  const ZOOM_OFFSET = new THREE.Vector3(0.3, -0.15, 0.7); // camera end position relative to the cockpit
  const SHIP_K = SHIP.length / 1.8;                       // launch distances were tuned at length 1.8
  const L = { on: false, t: 0, done: false };             // Start button: thrust + zoom
  const D = { on: false, t: 0, cam: null, look: null };   // Mission accepted: depart
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const ease = (x) => x * x * (3 - 2 * x);
  const cockpitW = new THREE.Vector3(), basePos = new THREE.Vector3(), endPos = new THREE.Vector3(), look = new THREE.Vector3();
  const clock = new THREE.Clock(), tmp = new THREE.Vector3();

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime * SHIP.speed;
    flameMat.uniforms.uTime.value = t;

    if (L.on) L.t += dt;
    if (D.on) D.t += dt;

    // launch timeline (seconds since Start): thrust 0-1.6, zoom 1.1-3.3, then hold on the cockpit
    const boost = calm ? 0 : ease(clamp01(L.t / 1.6));
    const drift = calm ? 0 : 1.1 * SHIP_K * ease(clamp01(L.t / 2.2));
    const zoom = calm ? 0 : ease(clamp01((L.t - 1.1) / 2.2));
    // depart timeline (seconds since "Mission accepted"): the burn builds gently, the ship
    // accelerates smoothly (no sudden jumps), the camera pulls back and follows a little
    const dep = calm ? 0 : ease(clamp01(D.t / 1.8));                  // 0 -> 1 engine build-up
    const thrust = boost + 1.2 * dep;
    const dU = clamp01(D.t / DEPART_SECONDS);
    const uT = D.t / DEPART_SECONDS;
    const departX = calm ? 0 : DEPART_DISTANCE * uT * uT;            // starts at rest, keeps accelerating
    const calmFx = 1 - 0.85 * dep;                                    // damp wobble/flicker while flying

    if (flame) {
      const s = (1 + (0.05 * Math.sin(t * 23) + 0.04 * Math.sin(t * 37.3) + 0.03 * Math.sin(t * 61)) * calmFx) * (1 + 1.4 * thrust);
      flame.scale.x = s; flame.position.x = SHIP.flameX * (1 - s);
    }
    if (engineLight.userData.local) {
      tmp.copy(engineLight.userData.local); tilt.localToWorld(tmp); engineLight.position.copy(tmp);
    }
    engineLight.intensity = 3.5 * (1 + 2.2 * thrust) + (0.9 * Math.sin(t * 31) + 0.6 * Math.sin(t * 53)) * calmFx;

    rig.position.x = drift + departX;
    rig.position.y = shuttleY + Math.sin(t * 0.9) * 0.1 * amp * calmFx + 0.25 * SHIP_K * boost;
    tilt.rotation.set(
      SHIP.baseRot.x + Math.sin(t * 0.55) * 0.05 * amp * calmFx + Math.sin(t * 40) * 0.0015 * amp * calmFx,
      SHIP.baseRot.y + Math.sin(t * 0.37) * 0.04 * amp * calmFx,
      SHIP.baseRot.z + Math.sin(t * 0.7 + 1) * 0.03 * amp * calmFx + 0.07 * boost);

    for (let i = 0; i < N; i++) {
      const k = streaks[i];
      k.x -= k.spd * dt * SHIP.speed * amp * (1 + 4 * thrust); if (k.x < -16) k.x += 32;
      sPos.set([k.x, k.y, k.z, k.x + k.len, k.y, k.z], i * 6);
    }
    sGeo.attributes.position.needsUpdate = true;

    smooth.lerp(mouse, 1 - Math.pow(0.001, dt));
    basePos.set(smooth.x * 0.8 * amp, 0.15 + smooth.y * 0.45 * amp, dist);

    if (D.on) {
      // smooth: the camera eases back from the cockpit shot while its aim follows the ship a little
      if (!D.cam) { D.cam = camera.position.clone(); D.look = look.clone(); }
      const pull = calm ? 0 : ease(clamp01(D.t / DEPART_SECONDS));
      camera.position.set(
        D.cam.x + PULLBACK.x * pull,
        D.cam.y + PULLBACK.y * pull,
        D.cam.z + PULLBACK.z * pull);
      look.set(D.look.x + departX * 0.5, D.look.y, D.look.z);
      camera.lookAt(look);
    } else if (zoom > 0 && shuttleObj) {
      scene.updateMatrixWorld(true);
      cockpitW.copy(COCKPIT); shuttleObj.localToWorld(cockpitW);
      endPos.copy(cockpitW).addScaledVector(ZOOM_OFFSET, SHIP_K);
      camera.position.lerpVectors(basePos, endPos, zoom);
      look.lerpVectors(tmp.set(0, 0, 0), cockpitW, zoom);
      camera.lookAt(look);
    } else {
      camera.position.copy(basePos);
      camera.lookAt(0, 0, 0);
    }

    if (L.on && !L.done && L.t >= (calm ? 0.3 : SHIP.zoomDoneAt)) { L.done = true; onZoomed?.(); }
    composer.render();
  });

  return {
    launch() { L.on = true; },
    depart() { D.on = true; },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      removeEventListener('pointermove', onPointer);
      removeEventListener('resize', resize);
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        const m = o.material;
        (Array.isArray(m) ? m : [m]).forEach((x) => x?.dispose?.());
      });
      envTex.dispose();
      composer.dispose?.();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

/* ---------------- Intro overlay styles (logo + Start journey) ---------------- */

const INTRO_STYLES = `
  .rm-canvas { position: fixed; inset: 0; display: block; width: 100%; height: 100%; }
  .rm-loading { position: fixed; inset: 0; z-index: 2; display: grid; place-items: end center; padding-bottom: 14vh; color: #5b6676;
    font: 14px/1.4 system-ui, sans-serif; transition: opacity .6s; pointer-events: none; }
  .rm-loading.done { opacity: 0; }

  .rm-intro { position: fixed; inset: 0; z-index: 2; display: flex; align-items: center; justify-content: center;
    pointer-events: none; transition: opacity .8s ease, visibility .8s;
    font-family: "Inter", Arial, Helvetica, sans-serif; color: #fff; }
  .rm-intro.leaving { opacity: 0; visibility: hidden; }

  .rm-stack { position: relative; display: flex; flex-direction: column; align-items: center; max-width: 94vw; }
  .rm-logo { margin: 0; line-height: 0; text-align: center;
    font: 300 clamp(1.6rem, 6vw, 5rem)/1 "Inter", Arial, sans-serif; letter-spacing: .2em; text-transform: uppercase;
    animation: rmRise 1.8s .3s cubic-bezier(.2, .7, .2, 1) both; }
  .rm-logo img { display: block; width: clamp(280px, 59vw, 960px); max-width: 92vw; height: auto;
    filter: drop-shadow(0 0 14px rgba(255, 255, 255, .25)); }

  .rm-below { position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
    margin-top: clamp(44px, 13vh, 110px); }
  .rm-start { pointer-events: auto; padding: 15px 22px; cursor: pointer; color: #fff;
    font: 400 clamp(.8rem, 1.3vw, .95rem)/1 "Inter", Arial, Helvetica, sans-serif; letter-spacing: .08em; text-transform: uppercase;
    white-space: nowrap; background: rgba(0, 0, 0, .25); border: 1px solid rgba(255, 255, 255, .75);
    transition: background .25s, border-color .25s, box-shadow .25s, opacity .25s;
    animation: rmRise 1.8s .9s cubic-bezier(.2, .7, .2, 1) both; }
  .rm-start:hover:not(:disabled), .rm-start:focus-visible { background: rgba(255, 255, 255, .12); border-color: #fff;
    box-shadow: 0 0 22px rgba(255, 255, 255, .25); }
  .rm-start:focus-visible { outline: 1px solid #fff; outline-offset: 4px; }
  .rm-start:disabled { cursor: default; opacity: .55; }

  .rm-intro footer { position: fixed; left: 0; right: 0; bottom: max(18px, env(safe-area-inset-bottom)); text-align: center;
    font: 400 11px/1.4 "Inter", Arial, Helvetica, sans-serif; letter-spacing: .02em; color: rgba(255, 255, 255, .88);
    padding: 0 16px; animation: rmRise 1.8s 1.4s cubic-bezier(.2, .7, .2, 1) both; }

  @keyframes rmRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  .rm-below { animation: none; }
  @media (prefers-reduced-motion: reduce) { .rm-logo, .rm-start, .rm-intro footer { animation: none; } }
`;

// Makes the name/ID screen (#registration-overlay) float on top of the shuttle:
// raised above the 3D canvas, transparent background, plus a soft dark vignette for legibility.
function liftRegistrationLayer() {
  const ov = document.getElementById('registration-overlay');
  const parent = ov?.parentElement;
  const saved = [];
  const set = (node, props) => {
    if (!node) return;
    const prev = {};
    for (const k of Object.keys(props)) { prev[k] = node.style[k]; node.style[k] = props[k]; }
    saved.push([node, prev]);
  };
  if (parent && getComputedStyle(parent).position === 'static') set(parent, { position: 'relative' });
  set(parent, { zIndex: '50' });
  set(ov, { zIndex: '50', background: 'transparent', pointerEvents: 'auto' });

  const scrim = document.createElement('div');
  Object.assign(scrim.style, {
    position: 'fixed', inset: '0', zIndex: '49', pointerEvents: 'none', opacity: '0', transition: 'opacity .8s',
    background: 'radial-gradient(ellipse at center, rgba(2,5,14,.55) 0%, rgba(2,5,14,.25) 55%, rgba(2,5,14,0) 100%)',
  });
  document.body.appendChild(scrim);
  requestAnimationFrame(() => { scrim.style.opacity = '1'; });

  return {
    restore() {
      saved.forEach(([node, prev]) => Object.assign(node.style, prev));
      scrim.remove();
    },
  };
}

/* =============================================================================
   BRIEFING SCENE = intro -> (explorer name) -> dialogue -> launch -> black
   =============================================================================
   createBriefingScene(document.body, {
     stageContainer,                 // where the 3D canvas goes (default: container)
     registerExplorer: (done) => scene,   // optional name screen. Call done(explorer)
                                          // when confirmed; return the scene (it gets .dispose())
     explorer,                       // used when there is no registerExplorer
     onEnd: (explorer) => { ... },   // screen is fully black: start next scene,
                                     // then call revealFromBlack()
     // optional: onAccept, config (dialogue overrides), assets, fadeDelayMs, fadeMs
   });
   Events on `document`:
     'remember-me:launch'  Start journey pressed
     'remember-me:start'   zoom finished (name screen / dialogue begins)
     'remember-me:depart'  mission accepted, ship launches
     'remember-me:end'     screen is fully black
   ============================================================================= */

export function createBriefingScene(container = document.body, options = {}) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const assets = {
    // first one that exists wins
    obj: ['/assets/shuttle-fire.obj', '/assets/models/shuttle-fire.obj', '/assets/models/shuttle/shuttle-fire.obj', '/shuttle-fire.obj'],
    logo: '/assets/remember-me-logo.svg',
    ...(options.assets || {}),
  };
  const {
    stageContainer = container,
    registerExplorer,
    config,
    onAccept,
    onEnd,
    fadeDelayMs = reduce ? 200 : 2200,   // accepted -> start of the black fade (ship is leaving)
    fadeMs = reduce ? 300 : 1400,
  } = options;

  let me = {
    name: 'Explorer', id: 'EX-0001', rank: 'Cadet',
    issued: new Date().toISOString().slice(0, 10),
    ...(options.explorer || {}),
  };

  const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));
  const timers = [];
  let dialogue = null, registration = null, liftHandle = null;
  let disposed = false;

  /* ----- DOM ----- */
  const styleEl = document.createElement('style');
  styleEl.textContent = INTRO_STYLES;
  document.head.appendChild(styleEl);

  const loadingEl = document.createElement('div');
  loadingEl.className = 'rm-loading';
  loadingEl.textContent = 'Loading shuttle\u2026';
  container.appendChild(loadingEl);

  const intro = document.createElement('main');
  intro.className = 'rm-intro';
  intro.innerHTML = `
    <div class="rm-stack">
      <h1 class="rm-logo"><img alt="Remember Me"></h1>
      <div class="rm-below"><button class="rm-start" type="button" disabled>Start journey</button></div>
    </div>
    <footer>NASA Space Apps Challenge 2026. By The Trail Blazers.</footer>
  `;
  container.appendChild(intro);

  const logoImg = intro.querySelector('.rm-logo img');
  logoImg.addEventListener('error', () => logoImg.replaceWith(document.createTextNode('Remember Me')));
  logoImg.src = assets.logo;
  const startBtn = intro.querySelector('.rm-start');

  /* ----- after the zoom: name screen (if any), then the dialogue ----- */
  function startDialogue() {
    if (disposed || dialogue) return;
    dialogue = createDialogueScene(container, { explorer: me, config, onAccept: handleAccept });
  }

  function onZoomed() {
    if (disposed || dialogue || registration) return;
    emit('remember-me:start');
    if (!registerExplorer) { startDialogue(); return; }
    const lift = liftHandle = liftRegistrationLayer();
    let finished = false;
    registration = registerExplorer((explorer) => {
      if (finished) return;
      finished = true;
      me = { ...me, ...(explorer || {}) };
      // wait a tick so `registration` is assigned even if done() ran synchronously
      queueMicrotask(() => {
        registration?.dispose?.();
        lift.restore();
        startDialogue();
      });
    }) || {};
  }

  /* ----- 3D stage ----- */
  const stage = createShuttleStage(stageContainer, {
    objUrls: assets.obj,
    onLoaded: () => {
      loadingEl.classList.add('done');
      startBtn.disabled = false;
    },
    onError: (err) => {
      loadingEl.classList.remove('done');
      loadingEl.style.color = '#ff8a8a';
      loadingEl.textContent = err?.message || 'Could not load the shuttle model (check public/assets).';
    },
    onZoomed,
  });

  /* ----- Start journey ----- */
  startBtn.addEventListener('click', () => {
    startBtn.disabled = true;
    intro.classList.add('leaving');
    emit('remember-me:launch');
    stage.launch();
  });

  /* ----- Mission accepted: launch away, fade dialogue, go black ----- */
  function handleAccept(ex) {
    emit('remember-me:depart', ex);
    onAccept?.(ex);
    stage.depart();

    const r = dialogue?.root;
    if (r) {
      r.style.pointerEvents = 'none';
      r.style.transition = 'opacity .8s';
      r.style.opacity = '0';
    }
    timers.push(setTimeout(() => blackoutScreen(fadeMs), fadeDelayMs));
    timers.push(setTimeout(() => { emit('remember-me:end', ex); onEnd?.(ex); }, fadeDelayMs + fadeMs));
  }

  return {
    root: intro,
    // Does NOT remove the black overlay: call revealFromBlack() after the next scene is up.
    dispose() {
      disposed = true;
      timers.forEach(clearTimeout);
      registration?.dispose?.();
      liftHandle?.restore();
      dialogue?.dispose();
      stage.dispose();
      intro.remove();
      loadingEl.remove();
      styleEl.remove();
    },
  };
}

/* ---------------- Event-driven flow (still available, unchanged behavior) ---------------- */
// Starts the dialogue when `startEvent` fires, and when the mission is accepted:
//   1. fires 'remember-me:depart' (your three.js code continues the launch animation)
//   2. fades the dialogue out
//   3. after `fadeDelayMs` fades the screen to black over `fadeMs`
//   4. fires 'remember-me:end'
export function initDialogueFlow(options = {}) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const {
    container = document.body,
    startEvent = 'remember-me:start',
    explorer = {},
    config,
    onAccept,
    onEnd,                               // called when the screen is fully black
    fadeDelayMs = reduce ? 200 : 1500,
    fadeMs = reduce ? 300 : 1400,
  } = options;

  const me = {
    name: 'Explorer', id: 'EX-0001', rank: 'Cadet',
    issued: new Date().toISOString().slice(0, 10),
    ...explorer,
  };
  let scene = null;
  const timers = [];
  const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));

  const handleAccept = (ex) => {
    emit('remember-me:depart', ex);
    onAccept?.(ex);
    const r = scene.root;
    r.style.pointerEvents = 'none';
    r.style.transition = 'opacity .8s';
    r.style.opacity = '0';
    timers.push(setTimeout(() => scene?.dispose(), 900));
    timers.push(setTimeout(() => blackoutScreen(fadeMs), fadeDelayMs));
    timers.push(setTimeout(() => { emit('remember-me:end', ex); onEnd?.(ex); }, fadeDelayMs + fadeMs));
  };

  const onStart = () => {
    if (scene) return;                         // only once
    scene = createDialogueScene(container, { explorer: me, config, onAccept: handleAccept });
  };
  document.addEventListener(startEvent, onStart);

  return {
    start: onStart,
    reveal: (ms = 1200) => revealFromBlack(ms),
    dispose() {
      document.removeEventListener(startEvent, onStart);
      timers.forEach(clearTimeout);
      scene?.dispose();
      document.getElementById(BLACK_ID)?.remove();
      scene = null;
    },
  };
}