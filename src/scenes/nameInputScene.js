// src/scenes/nameInputScene.js
// -----------------------------------------------------------------------------
// Registration scene = space background (Three.js) + futuristic ID-card name input.
// Same style as moonScene.js: a factory function that makes its OWN renderer,
// runs its OWN animation loop, and returns a dispose() for cleanup.
//
// USAGE (in main.js)
//   import { createNameInputScene } from './scenes/nameInputScene.js';
//
//   const registration = createNameInputScene(
//     document.getElementById('registration-overlay'),
//     { onConfirm: ({ name, id, rank, issued }) => { registration.dispose(); /* next scene */ } }
//   );
//
// No image assets needed. No CSS file changes needed (styles are injected here).
// -----------------------------------------------------------------------------

import * as THREE from 'three';

export const NAME_INPUT_CONFIG = {
  accentColor: '#6fb4ff',
  starCountFar: 1600,
  starCountNear: 350,
  parallaxStrength: 0.4,
  maxNameLength: 20,
  text: {
    eyebrow: 'Explorer registration',
    title: 'REGISTER AS AN EXPLORER',
    cardHeaderLeft: 'Explorer ID',
    cardHeaderRight: '',            // final project title goes here later (kept configurable)
    nameLabel: 'Your name',
    namePlaceholder: 'Enter your name',
    hint: 'Enter your name to receive your explorer ID.',
    emptyError: 'Please enter your name first.',
    button: 'Confirm identity',
    firstPlaceholder: 'FIRSTNAME',
    lastPlaceholder: 'LASTNAME',
    rank: 'Recruit',
    // ---- boarding-pass text (all placeholders, easy to change) ----
    agency: 'Space Exploration Program',   // top-left of the pass (no real agency logo/name used)
    passLabel: 'Boarding pass: explorer mission',
    stubText: 'Explorer mission',
    hashtag: '#SpaceJourney',  // bottom-right of the stub photo
    launchSite: 'Earth',
    launchSub: 'Mission control',
    arrivalSite: 'Moon - Mars',
    arrivalSub: 'Lunar surface',
    departureLabel: 'Scheduled departure',
    pointsLabel: 'Mission points',
    pointsValue: '0',
  },
};

/* ---------------- Shaders ---------------- */

const NEBULA_VERT = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
`;
const NEBULA_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), u.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.0; a *= 0.5; }
    return v;
  }
  void main(){
    vec2 p = vUv * 2.0 - 1.0;
    float n  = fbm(p * 1.4 + vec2(uTime * 0.008, -uTime * 0.006));
    float n2 = fbm(p * 2.8 - vec2(uTime * 0.012, 0.0));
    vec3 col = mix(uColorA, uColorB, n) * pow(n2, 2.4) * 0.8;
    float vignette = smoothstep(1.6, 0.25, length(p));
    gl_FragColor = vec4(col * vignette, 1.0);
  }
`;
const STAR_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vTwinkle;
  void main(){
    vTwinkle = 0.55 + 0.45 * sin(uTime * 1.4 + aPhase);
    gl_PointSize = aSize * uPixelRatio * vTwinkle;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const STAR_FRAG = /* glsl */ `
  varying float vTwinkle;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vTwinkle;
    gl_FragColor = vec4(vec3(0.85, 0.92, 1.0), a);
  }
`;

/* ---------------- Styles (injected, so styles.css stays untouched) ---------------- */

const buildStyles = (accent) => `
  .ni-root { position: fixed; inset: 0; z-index: 50; overflow: hidden; background: #000;
    pointer-events: auto; font-family: 'Orbitron', 'Rajdhani', ui-sans-serif, system-ui, sans-serif; color: #e8f1ff; }
  .ni-root canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .ni-ui { position: relative; z-index: 1; height: 100%; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 22px; padding: 24px; box-sizing: border-box; }
  .ni-eyebrow { font-size: 11px; letter-spacing: .35em; text-transform: uppercase; color: ${accent}; opacity: .8; }
  .ni-title { margin: 0; font-size: clamp(20px, 3vw, 28px); font-weight: 600; letter-spacing: .08em; }

  /* ---------- Boarding pass card ---------- */
  .ni-card { position: relative; width: min(720px, 94vw); font-size: calc(min(720px, 94vw) / 46);
    filter: drop-shadow(0 0 2em rgba(60,120,255,.28)) drop-shadow(0 1.2em 2.4em rgba(0,0,0,.65)); }
  .ni-ticket { position: relative; display: grid; grid-template-columns: 31% 1fr; aspect-ratio: 2.2; overflow: hidden;
    color: #0b1a3a; background: linear-gradient(180deg, #f4f8fd, #dce6f3); border-radius: .9em;
    clip-path: polygon(0 0, calc(100% - 2.6em) 0, 100% 2.6em, 100% 100%, 0 100%); }
  .ni-ticket::after { content: ''; position: absolute; inset: -40%; pointer-events: none;
    background: linear-gradient(115deg, transparent 42%, rgba(255,255,255,.65) 50%, transparent 58%);
    animation: niSheen 6s ease-in-out infinite; }
  @keyframes niSheen { 0% { transform: translateX(-60%); } 60%,100% { transform: translateX(60%); } }

  /* left stub */
  .ni-stub { display: grid; grid-template-columns: 2.2em 1.1em 1fr; gap: .6em; padding: .9em; background: #cddbee;
    border-right: .14em dashed rgba(11,26,58,.4); }
  .ni-barcode svg { width: 100%; height: 100%; display: block; }
  .ni-stub-text { writing-mode: vertical-rl; transform: rotate(180deg); font-size: .5em; letter-spacing: .2em;
    text-transform: uppercase; color: #31456b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; }
  .ni-photo { position: relative; border-radius: .5em; overflow: hidden;
    background: radial-gradient(120% 70% at 50% 112%, #e0702f 0%, #8a3324 34%, #1c1428 68%, #070a18 100%);
    box-shadow: inset 0 0 0 .12em rgba(11,26,58,.55); background-size: cover; background-position: center; }
  .ni-photo-tag { position: absolute; left: .6em; bottom: .5em; font-size: .62em; font-weight: 700;
    letter-spacing: .08em; text-transform: uppercase; color: #fff; text-shadow: 0 0 .6em rgba(0,0,0,.6); }

  /* main body */
  .ni-main { position: relative; display: grid; grid-template-columns: 1fr 8em; grid-template-rows: auto 1fr; column-gap: 1em;
    padding: 1em 1.6em 1em 1.2em;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='56' height='97'><path d='M28 2 54 17v30L28 62 2 47V17z' fill='none' stroke='%230b1a3a' stroke-opacity='.07'/></svg>"); }
  .ni-agency { grid-column: 1 / -1; display: flex; align-items: center; gap: .6em; padding-bottom: .5em; margin-bottom: .6em;
    font-size: .6em; letter-spacing: .08em; color: #31456b; border-bottom: .08em solid rgba(11,26,58,.18); }
  .ni-logo { width: 1.8em; height: 1.8em; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #4d8cff, #0b1a3a); }
  .ni-left { min-width: 0; }
  .ni-pass-label { font-size: .5em; letter-spacing: .16em; text-transform: uppercase; color: #6b7a96;
    padding-bottom: .5em; border-bottom: .1em solid rgba(11,26,58,.15); margin-bottom: .5em; }
  .ni-first { font-size: 2.4em; font-weight: 700; line-height: 1.05; letter-spacing: .03em; white-space: nowrap; overflow: hidden; }
  .ni-last { font-size: 1.5em; font-weight: 500; line-height: 1.2; letter-spacing: .06em; min-height: 1.2em; white-space: nowrap; overflow: hidden; color: #1d2f55; }
  .ni-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .6em 1em; margin-top: .8em; }
  .ni-grid > div { border-top: .08em solid rgba(11,26,58,.22); padding-top: .3em; min-width: 0; }
  .ni-grid label { display: block; font-size: .5em; letter-spacing: .14em; text-transform: uppercase; color: #6b7a96; }
  .ni-grid b { display: block; font-size: .8em; letter-spacing: .05em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ni-grid small { display: block; font-size: .5em; color: #6b7a96; letter-spacing: .06em; }
  .ni-right { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .8em; }
  .ni-badge { width: 7em; height: 7em; filter: drop-shadow(0 .2em .4em rgba(11,26,58,.35)); }
  .ni-badge svg { width: 100%; height: 100%; display: block; }
  .ni-points { width: 100%; text-align: center; border-top: .08em solid rgba(11,26,58,.22); padding-top: .3em; }
  .ni-points label { display: block; font-size: .5em; letter-spacing: .14em; text-transform: uppercase; color: #6b7a96; }
  .ni-points b { font-size: .8em; }

  .ni-form { width: min(360px, 88vw); display: flex; flex-direction: column; gap: 8px; }
  .ni-form label { font-size: 10px; letter-spacing: .22em; text-transform: uppercase; color: #8fa6c8; }
  .ni-input { width: 100%; box-sizing: border-box; padding: 12px 14px; font: inherit; font-size: 14px; letter-spacing: .06em;
    color: #fff; background: rgba(8,12,24,.7); border: 1px solid rgba(111,180,255,.3); border-radius: 8px; outline: none;
    transition: border-color .2s, box-shadow .2s; }
  .ni-input::placeholder { color: #4b5d7e; }
  .ni-input:focus { border-color: ${accent}; box-shadow: 0 0 0 3px rgba(111,180,255,.15), 0 0 20px rgba(111,180,255,.25); }
  .ni-hint { font-size: 11px; color: #6b7fa3; min-height: 14px; }
  .ni-hint.error { color: #ff8a8a; }
  .ni-btn { margin-top: 6px; align-self: center; padding: 12px 28px; font: inherit; font-size: 12px; font-weight: 600;
    letter-spacing: .2em; text-transform: uppercase; color: #05070d; background: #fff; border: 0; border-radius: 999px;
    cursor: pointer; box-shadow: 0 0 24px rgba(111,180,255,.35); transition: transform .15s, box-shadow .2s; }
  .ni-btn:hover { transform: translateY(-1px); box-shadow: 0 0 34px rgba(111,180,255,.6); }
  .ni-shake { animation: niShake .35s; }
  @keyframes niShake { 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
`;

/* ---------------- Boarding pass helpers ---------------- */

// Placeholder mission badge (swap for a real logo later via your assets config)
const BADGE_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="niG" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#2d6be0"/><stop offset="1" stop-color="#0b1a3a"/></linearGradient></defs>
  <circle cx="50" cy="50" r="46" fill="url(#niG)" stroke="#0b1a3a" stroke-width="3"/>
  <circle cx="50" cy="50" r="38" fill="none" stroke="#fff" stroke-opacity=".5"/>
  <circle cx="50" cy="54" r="16" fill="#e8643a"/>
  <ellipse cx="50" cy="54" rx="34" ry="10" fill="none" stroke="#fff" stroke-width="2" transform="rotate(-20 50 54)"/>
  <circle cx="76" cy="40" r="3" fill="#fff"/>
</svg>`;

// Barcode drawn from the explorer ID, so the same ID always gives the same bars
function makeBarcode(seed) {
  let s = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  let x = 0;
  let bars = '';
  while (x < 56) {
    const w = 1 + Math.floor(rnd() * 3.2);
    const gap = 1 + Math.floor(rnd() * 2.2);
    bars += `<rect x="${x}" y="0" width="${w}" height="100"/>`;
    x += w + gap;
  }
  return `<svg viewBox="0 0 56 100" preserveAspectRatio="none" fill="#0b1a3a">${bars}</svg>`;
}

/* ---------------- Factory ---------------- */

export function createNameInputScene(container = document.body, options = {}) {
  const config = { ...NAME_INPUT_CONFIG, ...(options.config || {}) };
  config.text = { ...NAME_INPUT_CONFIG.text, ...(options.config?.text || {}) };
  const t = config.text;
  const onConfirm = options.onConfirm || (() => {});

  // Generated once per visit
  const explorerId = `EX-${Math.floor(1000 + Math.random() * 9000)}`;
  const issued = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  /* ----- DOM: root > canvas + ui ----- */
  const styleEl = document.createElement('style');
  styleEl.textContent = buildStyles(config.accentColor);
  document.head.appendChild(styleEl);

  const root = document.createElement('div');
  root.className = 'ni-root';
  root.innerHTML = `
    <div class="ni-ui">
      <div class="ni-eyebrow">${t.eyebrow}</div>
      <h1 class="ni-title">${t.title}</h1>

      <div class="ni-card">
        <div class="ni-ticket">
          <div class="ni-stub">
            <div class="ni-barcode">${makeBarcode(explorerId)}</div>
            <div class="ni-stub-text">${t.stubText} · ${explorerId}</div>
            <div class="ni-photo"${config.stubImage ? ` style="background-image:url('${config.stubImage}')"` : ''}>
              <div class="ni-photo-tag">${t.hashtag}</div>
            </div>
          </div>
          <div class="ni-main">
            <div class="ni-agency"><i class="ni-logo"></i><span>${t.agency}</span></div>
            <div class="ni-left">
              <div class="ni-pass-label">${t.passLabel}</div>
              <div class="ni-first" data-ni="first">${t.firstPlaceholder}</div>
              <div class="ni-last" data-ni="last">${t.lastPlaceholder}</div>
              <div class="ni-grid">
                <div><label>Launch site</label><b>${t.launchSite}</b><small>${t.launchSub}</small></div>
                <div><label>Arrival site</label><b>${t.arrivalSite}</b><small>${t.arrivalSub}</small></div>
                <div><label>${t.departureLabel}</label><b>${issued}</b></div>
                <div><label>Explorer ID · Rank</label><b>${explorerId} · ${t.rank}</b></div>
              </div>
            </div>
            <div class="ni-right">
              <div class="ni-badge">${BADGE_SVG}</div>
              <div class="ni-points"><label>${t.pointsLabel}</label><b>${t.pointsValue}</b></div>
            </div>
          </div>
        </div>
      </div>

      <div class="ni-form">
        <label for="ni-name">${t.nameLabel}</label>
        <input id="ni-name" class="ni-input" type="text" autocomplete="off"
               maxlength="${config.maxNameLength}" placeholder="${t.namePlaceholder}" />
        <div class="ni-hint" data-ni="hint">${t.hint}</div>
        <button class="ni-btn" type="button">${t.button}</button>
      </div>
    </div>
  `;
  container.appendChild(root);

  const input = root.querySelector('.ni-input');
  const firstOut = root.querySelector('[data-ni="first"]');
  const lastOut = root.querySelector('[data-ni="last"]');
  const hint = root.querySelector('[data-ni="hint"]');
  const button = root.querySelector('.ni-btn');
  const form = root.querySelector('.ni-form');

  /* ----- Three.js core ----- */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(0, 0, 6);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000);
  root.insertBefore(renderer.domElement, root.firstChild); // canvas sits behind the UI

  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };
  const pixelRatio = Math.min(window.devicePixelRatio, 2);

  // Nebula
  const nebulaMat = track(new THREE.ShaderMaterial({
    vertexShader: NEBULA_VERT, fragmentShader: NEBULA_FRAG,
    depthTest: false, depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color('#0a1a45') },
      uColorB: { value: new THREE.Color('#34195a') },
    },
  }));
  const nebula = new THREE.Mesh(track(new THREE.PlaneGeometry(2, 2)), nebulaMat);
  nebula.frustumCulled = false;
  nebula.renderOrder = -10;
  scene.add(nebula);

  // Stars
  function makeStars(count, rMin, rMax, sMin, sMax) {
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = rMin + Math.random() * (rMax - rMin);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi) - 10;
      size[i] = sMin + Math.random() * (sMax - sMin);
      phase[i] = Math.random() * Math.PI * 2;
    }
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    const mat = track(new THREE.ShaderMaterial({
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: pixelRatio } },
    }));
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    return points;
  }
  const farStars = makeStars(config.starCountFar, 40, 100, 1, 3);
  const nearStars = makeStars(config.starCountNear, 12, 30, 1.5, 4.5);

  /* ----- Mouse parallax ----- */
  const pointer = new THREE.Vector2();
  const targetPointer = new THREE.Vector2();
  const onPointerMove = (e) => {
    targetPointer.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -((e.clientY / window.innerHeight) * 2 - 1)
    );
  };
  window.addEventListener('pointermove', onPointerMove);

  /* ----- Card interaction ----- */
  // Splits "Juan Dela Cruz" -> FIRST: JUAN, LAST: DELA CRUZ, and shrinks long names to fit
  const updateName = () => {
    const parts = input.value.trim().split(/\s+/).filter(Boolean);
    const first = (parts[0] || t.firstPlaceholder).toUpperCase();
    const last = (parts.length ? parts.slice(1).join(' ') : t.lastPlaceholder).toUpperCase();
    firstOut.textContent = first;
    lastOut.textContent = last;
    firstOut.style.fontSize = `${Math.min(2.4, 26 / Math.max(first.length, 1))}em`;
    lastOut.style.fontSize = `${Math.min(1.5, 30 / Math.max(last.length, 1))}em`;
  };
  updateName();

  const onInput = () => {
    updateName();
    hint.classList.remove('error');
    hint.textContent = t.hint;
  };
  const submit = () => {
    const name = input.value.trim();
    if (!name) {
      hint.textContent = t.emptyError;
      hint.classList.add('error');
      form.classList.remove('ni-shake');
      void form.offsetWidth; // restart the shake animation
      form.classList.add('ni-shake');
      return;
    }
    onConfirm({ name, id: explorerId, rank: t.rank, issued });
  };
  const onKey = (e) => { if (e.key === 'Enter') submit(); };
  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKey);
  button.addEventListener('click', submit);
  setTimeout(() => input.focus(), 50);

  /* ----- Resize ----- */
  function fit() {
    const w = root.clientWidth || window.innerWidth;
    const h = root.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); // CSS already sizes the canvas
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(fit);
  resizeObserver.observe(root);
  fit();

  /* ----- Loop ----- */
  const clock = new THREE.Clock();
  const updaters = [];

  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    const time = clock.elapsedTime;

    nebulaMat.uniforms.uTime.value = time;
    farStars.material.uniforms.uTime.value = time;
    nearStars.material.uniforms.uTime.value = time;

    pointer.lerp(targetPointer, 1 - Math.pow(0.001, dt));
    camera.position.set(
      pointer.x * config.parallaxStrength,
      pointer.y * config.parallaxStrength * 0.6,
      6
    );
    camera.lookAt(0, 0, -4);

    farStars.rotation.y = time * 0.004;
    nearStars.rotation.y = time * 0.009; // different speed = depth

    updaters.forEach((fn) => fn(dt));
    renderer.render(scene, camera);
  });

  /* ----- Public API ----- */
  return {
    scene,
    camera,
    renderer,
    data: { id: explorerId, issued },
    onUpdate(fn) { updaters.push(fn); },
    dispose() {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      input.removeEventListener('input', onInput);
      input.removeEventListener('keydown', onKey);
      button.removeEventListener('click', submit);
      disposables.forEach((d) => d.dispose?.());
      renderer.dispose();
      root.remove();
      styleEl.remove();
    },
  };
}