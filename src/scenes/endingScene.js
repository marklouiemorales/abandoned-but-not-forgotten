import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clearArchive } from './archiveStore.js';
import { bgm } from '../audio/bgm.js';

/* ---- tweak here ---- */
const SHUTTLE_LENGTH = 1.8;                  // world units
const BASE_ROT = { x: 0, y: 0.06, z: 0.1 };  // roll, yaw, pitch: side profile, nose right, slight climb
const SPEED = 0.5;                           // overall animation speed
const STARS = true;
const END_MUSIC_URL = '/assets/audio/End_Credits.mp3';  // public/assets/audio/End_Credits.mp3
const END_MUSIC_VOLUME = 0.35;
const FLAME_X = 1.55;                        // x where the flame card starts in the model
const DEFAULT_OBJ_URL = '/assets/shuttle-fire.obj'; // public/assets/shuttle-fire.obj

const DEFAULT_TAGLINE = '“Every Mission Has a Story. Every Legacy Deserves To Be Remembered”';

// Edit the credits here (or pass `credits` in the options). {name} = the explorer's name.
const DEFAULT_CREDITS = [
  { title: 'Mission Complete', lines: ['Thank you for playing, {name}'] },
  { title: 'Created By', lines: ['The Trail Blazers'] },
  { title: 'Design & Development', lines: ['The Trail Blazers'] },
  { title: '3D Models', lines: ['Apollo 11 Lunar Module Eagle', 'Surveyor 3', 'Apollo 15 Lunar Roving Vehicle', 'Sojourner', 'Ingenuity', 'InSight'] },
  { title: 'Mission Archive', lines: ['NASA'] },
  { title: 'Built With', lines: ['Three.js'] },
];

// timings (seconds, real time)
const CREDITS_DELAY = 4;      // credits start rolling as the shuttle begins to leave
const CREDITS_DURATION = 28;  // time for the whole roll to pass
const TAGLINE_DELAY = CREDITS_DELAY + CREDITS_DURATION + 0.5; // tagline starts after the credits
const TAGLINE_FADE = 2.4;     // length of that fade
const TAGLINE_HOLD = 7;       // how long it stays on screen
const FADE_OUT = 1.6;         // fade to black, then back to the start
const ENTRY_FADE = 1400;      // ms, fade in from black when the ending opens
/* -------------------- */

const CSS = `
.end-root { position: fixed; inset: 0; z-index: 100; background: #000; overflow: hidden; }
.end-root canvas { display: block; width: 100%; height: 100%; }
.end-loading { position: absolute; inset: 0; display: grid; place-items: center; color: #5b6676;
  font: 14px/1.4 system-ui, sans-serif; text-align: center; padding: 24px; transition: opacity .6s; pointer-events: none; }
.end-loading.done { opacity: 0; }
.end-fade { position: absolute; inset: 0; background: #000; opacity: 1; transition: opacity ${ENTRY_FADE}ms ease; pointer-events: none; z-index: 5; }
.end-credits { position: absolute; inset: 0; z-index: 6; overflow: hidden; pointer-events: none;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 14%, #000 80%, transparent 100%);
          mask-image: linear-gradient(to bottom, transparent 0, #000 14%, #000 80%, transparent 100%); }
.end-root { font-family: inherit; }
.end-credits-roll { position: absolute; left: 0; right: 0; top: 0; text-align: center; color: #fff;
  padding: 0 24px 12vh; box-sizing: border-box; transform: translateY(100vh);
  text-shadow: 0 0 14px rgba(255, 255, 255, .25), 0 2px 18px rgba(0, 0, 0, .85);
  animation: end-roll ${CREDITS_DURATION}s linear ${CREDITS_DELAY}s forwards; }
.end-credits-roll section { margin: 0 auto clamp(56px, 10vh, 110px); max-width: 760px; }
/* role titles: small, wide-spaced sans, like the "Start journey" button / footer */
.end-credits-roll h3 { margin: 0 0 clamp(12px, 2vh, 20px); font-family: inherit; font-size: clamp(10px, 1vw, 12px);
  font-weight: 500; letter-spacing: .4em; text-indent: .4em; text-transform: uppercase; color: #9aa7bf; }
/* names: thin, wide-spaced capitals like the "REMEMBER ME" title.
   Set --end-display-font to the title's font-family (see styles.css). */
.end-credits-roll p { margin: 0 0 .6em; font-family: var(--end-display-font, inherit); font-size: clamp(15px, 1.7vw, 22px);
  font-weight: 300; line-height: 1.6; letter-spacing: .28em; text-indent: .28em; text-transform: uppercase; }
.end-root:not(.is-live) .end-credits-roll,
.end-root:not(.is-live) .end-tagline { animation-play-state: paused; }
@keyframes end-roll { from { transform: translateY(100vh); } to { transform: translateY(-100%); } }
.end-final { position: absolute; inset: 0; z-index: 7; display: flex; align-items: center;
  justify-content: center; padding: 24px; text-align: center; pointer-events: none; }
.end-tagline { margin: 0; max-width: 640px; color: #fff; font: 400 clamp(12px, 1.4vw, 17px)/1.9 'Times New Roman', Times, serif;
  letter-spacing: .24em; text-transform: uppercase; text-shadow: 0 0 18px rgba(255, 255, 255, .3); opacity: 0;
  animation: end-in ${TAGLINE_FADE}s ease ${TAGLINE_DELAY}s forwards; }
.end-out { position: absolute; inset: 0; z-index: 8; background: #000; opacity: 0; pointer-events: none;
  transition: opacity ${FADE_OUT}s ease; }
@keyframes end-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.end-final { flex-direction: column; gap: clamp(28px, 6vh, 56px); }
.end-again { padding: 14px 26px; cursor: pointer; color: #fff; background: rgba(0, 0, 0, .25);
  border: 1px solid rgba(255, 255, 255, .75); font-family: "Inter", Arial, Helvetica, sans-serif;
  font-size: clamp(11px, 1.1vw, 13px); font-weight: 400; letter-spacing: .32em; text-indent: .32em; text-transform: uppercase;
  opacity: 0; pointer-events: none;
  transition: opacity 1.6s ease, background .25s, border-color .25s, box-shadow .25s; }
.end-again.show { opacity: 1; pointer-events: auto; }
.end-again:hover, .end-again:focus-visible { background: rgba(255, 255, 255, .12); border-color: #fff; box-shadow: 0 0 22px rgba(255, 255, 255, .25); }
.end-again:focus-visible { outline: 1px solid #fff; outline-offset: 4px; }
.end-again:disabled { cursor: default; }
`;

function ensureStyles() {
  if (document.getElementById('ending-styles')) return;
  const s = document.createElement('style');
  s.id = 'ending-styles';
  s.textContent = CSS;
  document.head.appendChild(s);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * Ending: shuttle launch -> departure with the credits rolling as it leaves,
 * then the closing tagline, then back to the start.
 *
 * createEndingScene(document.body, {
 *   explorer,            // { name } fills {name} in the credits
 *   objUrl,              // default '/assets/shuttle-fire.obj'
 *   credits, tagline,    // optional overrides
 *   onRestart,           // called automatically after the tagline, to go back to the start
 * })
 * returns { root, dispose }
 */
export function createEndingScene(parent = document.body, options = {}) {
  ensureStyles();
  const {
    explorer = { name: 'Commander' },
    objUrl = DEFAULT_OBJ_URL,
    credits = DEFAULT_CREDITS,
    tagline = DEFAULT_TAGLINE,
    onRestart,
  } = options;

  // ---- DOM ----
  const root = document.createElement('div');
  root.className = 'end-root';
  root.innerHTML = `
    <div class="end-credits"><div class="end-credits-roll">
      ${credits.map((c) => `<section><h3>${esc(c.title)}</h3>${c.lines.map((l) => `<p>${esc(l.replace('{name}', explorer?.name || 'Commander'))}</p>`).join('')}</section>`).join('')}
    </div></div>
    <div class="end-final"><p class="end-tagline">${esc(tagline)}</p><button type="button" class="end-again">Play again</button></div>
    <div class="end-fade"></div>
    <div class="end-out"></div>`;
  parent.appendChild(root);
  const fadeEl = root.querySelector('.end-fade');
  const outEl = root.querySelector('.end-out');
  const againBtn = root.querySelector('.end-again');
  let leaving = false;
  againBtn.addEventListener('click', () => {
    if (leaving) return;
    leaving = true;
    againBtn.disabled = true;
    clearArchive();
    bgm.stop(FADE_OUT * 1000);   // music fades out with the screen
    outEl.style.opacity = 1;
    setTimeout(() => location.assign(location.pathname), FADE_OUT * 1000 + 200);
  });

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const amp = calm ? 0.25 : 1;
  let disposed = false;
  const timeouts = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timeouts.delete(id); fn(); }, ms); timeouts.add(id); };

  // fades in from black, then starts the credits, tagline and restart timer
  let revealed = false;
  function reveal() {
    if (revealed || disposed) return;
    revealed = true;
    bgm.play(END_MUSIC_URL, { volume: END_MUSIC_VOLUME, fadeInMs: ENTRY_FADE });   // End_Credits music
    fadeEl.style.opacity = 0;      // black -> transparent over ENTRY_FADE
    root.classList.add('is-live'); // un-pauses credits + tagline
    later(() => againBtn.classList.add('show'), (TAGLINE_DELAY + TAGLINE_FADE) * 1000);
  }

  // ---- renderer ----
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.65;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  root.insertBefore(renderer.domElement, root.firstChild);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 1000, 2000);

  // Space environment for reflections
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
  const envRT = pmrem.fromScene(envScene, 0.02);
  scene.environment = envRT.texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 600);

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.4, 0.65, 0.9));
  composer.addPass(new OutputPass());

  // Lighting
  scene.add(new THREE.AmbientLight(0x141c30, 0.12));
  const key = new THREE.DirectionalLight(0xfff1dc, 1.0); key.position.set(4, 5, 6); scene.add(key);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 1, far: 20 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  const earthshine = new THREE.DirectionalLight(0x3a72ff, 0.5); earthshine.position.set(-2, -6, 3); scene.add(earthshine);
  const backRim = new THREE.DirectionalLight(0x6f94ff, 0.4); backRim.position.set(-6, 2, -5); scene.add(backRim);
  const engineLight = new THREE.PointLight(0xff8a3a, 2.5, 9, 2); scene.add(engineLight);
  scene.add(key.target);

  // Rig: float -> tilt (orientation) -> pivot (scale/center)
  const rig = new THREE.Group(); scene.add(rig);
  const tilt = new THREE.Group(); rig.add(tilt);
  tilt.rotation.set(BASE_ROT.x, BASE_ROT.y, BASE_ROT.z);

  // Stars
  if (STARS) {
    const p = new Float32Array(2000 * 3);
    for (let i = 0; i < 2000; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(90);
      p.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, color: 0xffffff, transparent: true, opacity: 0.75, fog: false })));
  }

  // Speed streaks
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

  // Flame shader
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
  function styleMat(matName = '') {
    const k = matName.toLowerCase();
    const o = { color: 0x2a2e36, roughness: 0.42, metalness: 0.3, envMapIntensity: 0.45 };
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
  let flame = null;
  fetch(objUrl)
    .then((r) => { if (!r.ok) throw new Error(r.status + ' ' + objUrl); return r.text(); })
    .then((text) => {
      if (disposed) return;
      const obj = new OBJLoader().parse(text);
      obj.traverse((m) => {
        if (!m.isMesh) return;
        if (m.name === 'Plane') { m.material = flameMat; m.renderOrder = 2; flame = m; return; }
        m.material = Array.isArray(m.material) ? m.material.map((x) => styleMat(x.name)) : styleMat(m.material.name);
        m.castShadow = m.receiveShadow = true;
      });
      const hull = new THREE.Box3();
      obj.traverse((m) => { if (m.isMesh && m !== flame) hull.expandByObject(m); });
      const c = hull.getCenter(new THREE.Vector3());
      obj.position.set(-c.x, -c.y, -c.z);
      const pivot = new THREE.Group(); pivot.add(obj);
      pivot.scale.setScalar(SHUTTLE_LENGTH / (hull.max.x - hull.min.x));
      tilt.add(pivot);
      engineLight.userData.local = new THREE.Vector3(FLAME_X - c.x - 0.5, 0.84 - c.y, 0).multiplyScalar(pivot.scale.x);      engineLight.userData.local = new THREE.Vector3(FLAME_X - c.x - 0.5, 0.84 - c.y, 0).multiplyScalar(pivot.scale.x);
      reveal();    })
    .catch((e) => {
      console.error(e);
      console.error(`Could not load ${objUrl}`);
      reveal();
    });

  // Pointer parallax
  const mouse = new THREE.Vector2(), smooth = new THREE.Vector2();
  const onPointer = (e) => { mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight * 2 - 1)); };
  addEventListener('pointermove', onPointer);

  let dist = 9.5;
  function resize() {
    const w = innerWidth, h = innerHeight, aspect = w / h;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = aspect; camera.updateProjectionMatrix();
    dist = 9.5 * Math.max(1, 1.1 / aspect);
    rig.position.x = 0;
  }
  addEventListener('resize', resize); resize();

  const ui = { phase: 'launch', mt: -1 };   // loops forever: launch -> departure -> launch ...
  let busy = false;
  let rocketDone = false;   // the rocket plays once, then stays gone
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const pp = new THREE.Vector3();           // launch: ship offset from its resting spot

  const YAW_END = 1.3, TURN_TIME = 2.5, V_MAX = 8, LAUNCH_END = 12.5;
  const CROSS = 16, DEPART_END = 16.5, SMALL = 1 / 3;

  function setShadow(b) {
    Object.assign(key.shadow.camera, { left: -b, right: b, top: b, bottom: -b }); key.shadow.camera.updateProjectionMatrix();
  }
  function next(phase) {                    // fade out, switch, fade in
    if (busy) return;
    busy = true; fadeEl.style.opacity = 1;
    later(() => {
      ui.phase = phase; ui.mt = phase === 'launch' ? -1 : -0.3; pp.set(0, 0, 0);
      rig.scale.setScalar(phase === 'launch' ? 1 : SMALL); setShadow(phase === 'launch' ? 3.5 : 1.1);
      fadeEl.style.opacity = 0; busy = false;
    }, 450);
  }

  const clock = new THREE.Clock(), tmp = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05), el = clock.elapsedTime, t = el * SPEED;
    const T = ui.mt; ui.mt += dt;
    const launching = ui.phase === 'launch';

    let camZ = dist, fm = 1, fa = 1, flameFade = 1, streakOp = 0, fogNear = 1000, fogFar = 2000, lightK = 1;

    if (launching) {
      const zi = ease(T / 2.4), zo = ease((T - 2.9) / 2.7);
      camZ = dist + (dist * 0.44 - dist) * zi * (1 - zo);
      const wob = 1 - ease(T / 1.2);
      fm = 1 + 0.35 * ease(T / 2.4) + 0.3 * ease((T - 4.6) / 1.5);
      fa = 0.4;
      streakOp = 1 - ease(T / 1.0);
      let yaw = BASE_ROT.y, pitch = BASE_ROT.z;
      const L = T - 4.6;
      if (L > 0) {
        const k = ease(L / TURN_TIME);
        yaw = BASE_ROT.y + (YAW_END - BASE_ROT.y) * k;
        pitch = BASE_ROT.z + (0.08 - BASE_ROT.z) * k;
        const v = V_MAX * ease((L - 0.3) / 3.0);
        pp.x += v * dt * Math.cos(pitch) * Math.cos(yaw);
        pp.y += v * dt * Math.sin(pitch);
        pp.z -= v * dt * Math.cos(pitch) * Math.sin(yaw);
      }
      flameFade = 1 - ease((camZ - pp.z - 30) / 50);
      fogNear = 12; fogFar = 95;
      rig.position.set(pp.x, pp.y + Math.sin(t * 0.9) * 0.1 * amp * wob, pp.z);
      tilt.rotation.set(
        BASE_ROT.x + Math.sin(t * 0.55) * 0.05 * amp * wob,
        yaw + Math.sin(t * 0.37) * 0.04 * amp * wob,
        pitch + Math.sin(t * 0.7 + 1) * 0.03 * amp * wob);
      if (T > LAUNCH_END) next('depart');
    } else {
      const u = clamp01(T / CROSS), z = -2 - 8 * u;
      const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (dist - z) * camera.aspect;
      rig.position.set((1.15 - 2.3 * u) * halfW, 0.35 + 0.5 * u + Math.sin(el * 0.6) * 0.03 * amp, z);
      tilt.rotation.set(Math.sin(el * 0.5) * 0.02 * amp, Math.PI - 0.25, 0.04 + Math.sin(el * 0.7) * 0.01 * amp);
      flameFade = 1 - 0.6 * u;
      fogNear = 6; fogFar = 30;
      lightK = SMALL * SMALL;
      if (T > DEPART_END && !rocketDone) { rocketDone = true; rig.visible = false; engineLight.visible = false; }
    }

    const ft = launching ? t : t * 1.5;
    const fl = 1 + fa * (0.05 * Math.sin(ft * 23) + 0.04 * Math.sin(ft * 37.3) + 0.03 * Math.sin(ft * 61));
    const s = fm * fl;
    flameMat.uniforms.uTime.value = ft; flameMat.uniforms.uFade.value = flameFade;
    if (flame) { flame.scale.x = s; flame.position.x = FLAME_X * (1 - s); }

    rig.updateMatrixWorld(true);
    if (engineLight.userData.local) {
      tmp.copy(engineLight.userData.local); tilt.localToWorld(tmp); engineLight.position.copy(tmp);
    }
    engineLight.intensity = lightK * fm * flameFade * (2.5 + fa * (0.65 * Math.sin(ft * 31) + 0.45 * Math.sin(ft * 53)));

    scene.fog.near = fogNear; scene.fog.far = fogFar;
    key.target.position.copy(rig.position);
    key.position.set(rig.position.x + 4, rig.position.y + 5, rig.position.z + 6);

    streakMesh.visible = streakOp > 0.01; streakMesh.material.opacity = streakOp;
    for (let i = 0; i < N; i++) {
      const k = streaks[i];
      k.x -= k.spd * dt * SPEED * amp; if (k.x < -16) k.x += 32;
      sPos.set([k.x, k.y, k.z, k.x + k.len, k.y, k.z], i * 6);
    }
    sGeo.attributes.position.needsUpdate = true;

    smooth.lerp(mouse, 1 - Math.pow(0.001, dt));
    const pz = camZ / dist;
    camera.position.set(smooth.x * 0.8 * amp * pz, 0.15 + smooth.y * 0.45 * amp * pz, camZ);
    camera.lookAt(0, 0, 0);
    composer.render();
  });

  function dispose() {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    bgm.stop(0);
    removeEventListener('resize', resize);
    removeEventListener('pointermove', onPointer);
    timeouts.forEach(clearTimeout); timeouts.clear();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    envRT.dispose();
    composer.dispose?.();
    renderer.dispose();
    root.remove();
  }

  return { root, dispose };
}