// src/scenes/shuttleScene.js
// -----------------------------------------------------------------------------
// Three.js space shuttle scene (renders into a full-screen canvas).
// Timeline:
//   idle      shuttle floats behind the intro title
//   launch()  thrust + slight drift, camera zooms in on the cockpit and holds
//             -> calls onZoomDone() when the camera has stopped
//   depart()  (called after the mission is accepted) extra thrust, camera pulls
//             back, the ship accelerates off to the right
//
// Model: public/assets/shuttle-fire.obj  (served at /assets/shuttle-fire.obj)
// -----------------------------------------------------------------------------
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const SHUTTLE_CONFIG = {
  model: '/assets/shuttle-fire.obj',
  length: 1.5,                                   // world units
  baseRot: { x: -0.6, y: 0.14, z: 0.1 },         // roll (negative = belly toward camera), yaw, pitch
  y: 0,                                          // height above screen centre, fraction of view height
  speed: 0.5,                                    // overall animation speed
  stars: true,
  flameX: 1.55,                                  // x where the flame card starts in the model
  departDist: 70,                                // how far the ship flies off (world units)
};

/**
 * @param {object} options
 *   container   element the canvas is added to (default document.body)
 *   config      overrides for SHUTTLE_CONFIG
 *   onLoaded()  model is ready
 *   onError(msg) model failed to load / build
 *   onZoomDone() cockpit zoom finished (launch timeline complete)
 * @returns {{ launch(), depart(), dispose() }}
 */
export function createShuttleScene(options = {}) {
  const cfg = { ...SHUTTLE_CONFIG, ...(options.config || {}) };
  const { container = document.body, onLoaded, onError, onZoomDone } = options;
  const SHUTTLE_LENGTH = cfg.length, BASE_ROT = cfg.baseRot, FLAME_X = cfg.flameX;
  const SPEED = cfg.speed, DEPART_DIST = cfg.departDist;

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const amp = calm ? 0.25 : 1;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.75;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(envScene, 0.02).texture;

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
  tilt.rotation.set(BASE_ROT.x, BASE_ROT.y, BASE_ROT.z);

  // Stars
  if (cfg.stars) {
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
    sCol.set([0, 0, 0, 0.22, 0.3, 0.5], i * 6); // dark tail -> bright head (additive = fade)
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
      }`
  });

  // Material look by name (no .mtl supplied)
  function styleMat(name) {
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
  let flame = null, shuttleObj = null;
  new OBJLoader().load(cfg.model, obj => { try {
    obj.traverse(m => {
      if (!m.isMesh) return;
      if (m.name === 'Plane') { m.material = flameMat; m.renderOrder = 2; flame = m; return; }
      m.material = Array.isArray(m.material) ? m.material.map(x => styleMat(x.name)) : styleMat(m.material.name);
      m.castShadow = m.receiveShadow = true;
    });
    const hull = new THREE.Box3();
    obj.traverse(m => { if (m.isMesh && m !== flame) hull.expandByObject(m); });
    const c = hull.getCenter(new THREE.Vector3());
    obj.position.set(-c.x, -c.y, -c.z);
    const pivot = new THREE.Group(); pivot.add(obj);
    pivot.scale.setScalar(SHUTTLE_LENGTH / (hull.max.x - hull.min.x));
    tilt.add(pivot);
    shuttleObj = obj;
    // engine light sits just behind the nozzle, in tilt space
    engineLight.userData.local = new THREE.Vector3(FLAME_X - c.x - 0.5, 0.84 - c.y, 0).multiplyScalar(pivot.scale.x);
    onLoaded?.();
  } catch (e) {
    console.error(e);
    onError?.('Could not build the model.');
  }
  }, undefined, err => {
    console.error(err);
    onError?.(`Could not load ${cfg.model} (put it in public/assets and run from a server).`);
  });

  // Pointer parallax
  const mouse = new THREE.Vector2(), smooth = new THREE.Vector2();
  const onPointer = e => { mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight * 2 - 1)); };
  addEventListener('pointermove', onPointer);

  let dist = 9.5, shuttleY = 0;
  function resize() {
    const w = innerWidth, h = innerHeight, aspect = w / h;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = aspect; camera.updateProjectionMatrix();
    dist = 9.5 * Math.max(1, 1.1 / aspect);
    shuttleY = cfg.y * 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    rig.position.x = 0;
  }
  addEventListener('resize', resize); resize();

  /* ---------------- Timelines ---------------- */
  const COCKPIT = new THREE.Vector3(2.55, 0.92, 0.22);    // zoom target near the nose, in model coordinates
  const ZOOM_OFFSET = new THREE.Vector3(0.3, -0.15, 0.7); // where the camera ends up, relative to the cockpit
  const SHIP_K = SHUTTLE_LENGTH / 1.8;                    // launch distances were tuned at length 1.8
  const L = { on: false, t: 0, done: false };             // 1) launch + cockpit zoom
  const D = { on: false, t: 0 };                          // 2) departure after the mission is accepted
  const clamp01 = x => Math.min(1, Math.max(0, x));
  const ease = x => x * x * (3 - 2 * x);
  const cockpitW = new THREE.Vector3(), basePos = new THREE.Vector3(), endPos = new THREE.Vector3(), look = new THREE.Vector3();

  const clock = new THREE.Clock(), tmp = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime * SPEED;
    flameMat.uniforms.uTime.value = t;

    if (L.on) L.t += dt;
    if (D.on) D.t += dt;
    // launch (seconds since launch()): thrust 0-1.6, zoom 1.1-3.3, then the camera holds on the cockpit
    const boost  = calm ? 0 : ease(clamp01(L.t / 1.6));
    const drift  = calm ? 0 : 1.1 * SHIP_K * ease(clamp01(L.t / 2.2));
    const zoomIn = calm ? 0 : ease(clamp01((L.t - 1.1) / 2.2));
    // departure (seconds since depart()): extra thrust, camera pulls back, ship accelerates away
    const dUp  = calm ? 0 : ease(clamp01(D.t / 1.2));
    const dGo  = calm ? 0 : Math.pow(clamp01((D.t - 0.6) / 2.4), 2.2);
    const pull = calm ? 0 : ease(clamp01((D.t - 0.3) / 1.8));
    const zoom = zoomIn * (1 - pull);
    const thrust = boost + 1.6 * dUp;

    if (flame) {
      const s = (1 + 0.05 * Math.sin(t * 23) + 0.04 * Math.sin(t * 37.3) + 0.03 * Math.sin(t * 61)) * (1 + 1.4 * thrust);
      flame.scale.x = s; flame.position.x = FLAME_X * (1 - s);
    }
    if (engineLight.userData.local) {
      tmp.copy(engineLight.userData.local); tilt.localToWorld(tmp); engineLight.position.copy(tmp);
    }
    engineLight.intensity = (3.5 + 0.9 * Math.sin(t * 31) + 0.6 * Math.sin(t * 53)) * (1 + 2.2 * thrust);

    rig.position.x = drift + dGo * DEPART_DIST;
    rig.position.y = shuttleY + Math.sin(t * 0.9) * 0.1 * amp + 0.25 * SHIP_K * boost;
    tilt.rotation.set(
        BASE_ROT.x + Math.sin(t * 0.55) * 0.05 * amp + Math.sin(t * 40) * 0.0015 * amp,
        BASE_ROT.y + Math.sin(t * 0.37) * 0.04 * amp,
        BASE_ROT.z + Math.sin(t * 0.7 + 1) * 0.03 * amp + 0.07 * boost);

    for (let i = 0; i < N; i++) {
      const k = streaks[i];
      k.x -= k.spd * dt * SPEED * amp * (1 + 5 * thrust); if (k.x < -16) k.x += 32;
      sPos.set([k.x, k.y, k.z, k.x + k.len, k.y, k.z], i * 6);
    }
    sGeo.attributes.position.needsUpdate = true;

    smooth.lerp(mouse, 1 - Math.pow(0.001, dt));
    basePos.set(smooth.x * 0.8 * amp, 0.15 + smooth.y * 0.45 * amp, dist);
    if (zoom > 0 && shuttleObj) {
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
    if (L.on && !L.done && L.t >= (calm ? 0.3 : 3.3)) { L.done = true; onZoomDone?.(); }
    composer.render();
  });

  return {
    launch() { L.on = true; },
    depart() { D.on = true; },
    dispose() {
      renderer.setAnimationLoop(null);
      removeEventListener('pointermove', onPointer);
      removeEventListener('resize', resize);
      composer.dispose?.();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}