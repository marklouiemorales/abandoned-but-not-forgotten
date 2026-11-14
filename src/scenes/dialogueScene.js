// src/scenes/dialogueScene.js
// -----------------------------------------------------------------------------
// Dialogue scene = TRANSPARENT UI layer (no background of its own).
// Flow:  loading -> "registration complete" -> "welcome" -> mission briefing
//        (3 lines, with the 2 tasks shown) -> "Do you accept?" -> onAccept()
//
// Put your own background behind it (CSS background on <body>, or any element
// under #dialogue-overlay). This file only draws text, the dialogue box and
// buttons. A soft dark gradient at the bottom keeps the text readable on any
// background; turn it off with config.scrim = false.
//
// USAGE (in main.js)
//   import { createDialogueScene } from './scenes/dialogueScene.js';
//
//   const dialogue = createDialogueScene(document.body, {
//     explorer,                       // { name, id, rank, issued } from nameInputScene
//     onAccept: (explorer) => { dialogue.dispose(); /* start spaceship */ },
//   });
//
// VOICE: every step has an `audio` path. Drop your mp3 files at those paths.
// If a file is missing (or null), the step still works: text types out and
// intro panels auto-advance on a timer. Placeholders: {name} {id} {rank} {issued}
// -----------------------------------------------------------------------------

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

/* ---------------- Styles (injected, styles.css stays untouched) ---------------- */

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

/* ---------------- Factory ---------------- */

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