// src/interaction/planetSignalMarkers.js
// -----------------------------------------------------------------------------
//
// FIXED POSITIONS
//   Every signal is pinned to a fixed point in the planet MESH's own coordinates, so it
//   can never drift: no raycast per frame, no per-load guessing. The marker is a child of
//   the planet mesh itself, so it turns with whatever turns the planet.
//
//   Give each signal ONE of these in moonSignals.js / marsSignals.js:
//     pos: [x, y, z]      <- exact point (a direction from the planet's centre). Preferred.
//     lat: 0.67, lon: 23.47   <- the REAL coordinates. Rotated into the model's frame using
//                                any signal that has both a pos and a lat/lon (see computeFrame).
//   Best practice: give EVERY signal its real lat/lon, and add a picked `pos` to ONE of them
//   (two for a full guarantee). Then all of them land on their exact locations.
//
// FINDING THE COORDINATES
//   Open the page with  ?pick=1  (e.g. /?phase=moon&pick=1), DOUBLE-CLICK a spot on the
//   planet, and read the console. It prints a line like
//        pos: [0.412, 0.103, 0.905]   (lat 5.91, lon 24.48)
//   and copies the  pos: [...]  part to your clipboard. Paste it into that signal.
//
// STAYING ON THE COORDINATE
//   The screen position of each marker is recomputed RIGHT AFTER every render of the
//   planet camera, from the same matrices that were just drawn. So the circle can never
//   lag a frame behind the surface while you drag, glide or auto-rotate. Positions are
//   mapped through the canvas's own on-screen rectangle (not the window), so they stay
//   right even if the canvas is not exactly the full window.
//
// RANDOM SPOTS (default)
//   Each signal is placed at a random point on the planet: spread at least 50 degrees apart,
//   away from the poles, with the first one starting in view. The spots are kept while the
//   page stays open (leaving and coming back keeps them) and change on a reload.
//   Pass { randomize: false } to use the fixed pos / lat,lon from the signals data instead.
//
// OTHER BEHAVIOUR
//   - A signal on the FAR side is NOT visible. It fades out before it reaches the planet's
//     edge and shows again when the user rotates the planet toward it.
//     (Pass { showBehind: true } to show far-side signals as dashed markers on the edge.)
//   - Unknown signals are white. Once the equipment is found they turn green.
//   - Each marker has THREE pulse rings plus rotating targeting brackets (see styles.css).
//
//   const markers = createSignalMarkers(planet, document.body, SIGNALS, {
//     controls,
//     onSelect: (signal, markerEl) => { ... },
//   });
//   markers.markFound(id, name)  markers.resume()  markers.dispose()
// -----------------------------------------------------------------------------

import * as THREE from 'three';
import { getPlanetPivot } from './planetControls.js';

function latLonToDirection(lat, lon) {
  const phi = THREE.MathUtils.degToRad(lat);
  const lam = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(
    Math.cos(phi) * Math.sin(lam),
    Math.sin(phi),
    Math.cos(phi) * Math.cos(lam)
  );
}

function directionToLatLon(v) {
  const n = v.clone().normalize();
  return {
    lat: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(n.y, -1, 1))),
    lon: THREE.MathUtils.radToDeg(Math.atan2(n.x, n.z)),
  };
}

// ---- direction of a signal ----
//   1. `pos: [x,y,z]` (or {x,y,z}) is exact and always wins.
//   2. otherwise the REAL lat/lon is used, rotated into the model's own frame.
// The rotation is learned from the signals that have BOTH a `pos` (picked on the model) and a
// real lat/lon:  one such signal  = fixes the longitude offset (turn around the poles)
//                two or more      = fixes the full orientation of the model
// So pick ONE signal's pos (?pick=1) and every other lat/lon signal lines up with it.
const posVector = (sig) => {
  const p = sig.pos;
  if (Array.isArray(p) && p.length >= 3 && p.every(Number.isFinite)) return new THREE.Vector3(p[0], p[1], p[2]).normalize();
  if (p && typeof p === 'object' && [p.x, p.y, p.z].every(Number.isFinite)) return new THREE.Vector3(p.x, p.y, p.z).normalize();
  return null;
};
const hasLatLon = (sig) => Number.isFinite(sig.lat) && Number.isFinite(sig.lon);

function frameBasis(u, v) {
  const cross = u.clone().cross(v);
  if (cross.length() < 1e-3) return null;                 // too close together to tell the orientation
  const t1 = u.clone().normalize();
  const t2 = cross.normalize();
  const t3 = t1.clone().cross(t2);
  return new THREE.Matrix4().makeBasis(t1, t2, t3);
}

// rotation that takes "real lat/lon directions" into the model's frame (null = none needed)
function computeFrame(signals) {
  const refs = signals
    .filter((s) => posVector(s) && hasLatLon(s))
    .map((s) => ({ a: latLonToDirection(s.lat, s.lon), b: posVector(s) }));
  if (refs.length >= 2) {
    const A = frameBasis(refs[0].a, refs[1].a);
    const B = frameBasis(refs[0].b, refs[1].b);
    if (A && B) return { kind: 'full', m: new THREE.Matrix4().multiplyMatrices(B, A.clone().transpose()) };
  }
  if (refs.length >= 1) {
    const lonA = Math.atan2(refs[0].a.x, refs[0].a.z);
    const lonB = Math.atan2(refs[0].b.x, refs[0].b.z);
    return { kind: 'longitude', deg: THREE.MathUtils.radToDeg(lonB - lonA), m: new THREE.Matrix4().makeRotationY(lonB - lonA) };
  }
  return null;
}

function signalDirection(sig, frame) {
  const exact = posVector(sig);
  if (exact) return exact;
  const d = latLonToDirection(sig.lat ?? 0, sig.lon ?? 0);
  return (frame ? d.applyMatrix4(frame.m) : d).normalize();
}

// the planet itself = the biggest TEXTURED, solid mesh under the pivot.
// (glow / atmosphere / shadow shells are bigger but have no texture or are transparent,
//  and they must not be mistaken for the planet)
function findPlanetMesh(root) {
  const cands = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const bs = o.geometry.boundingSphere;
    if (!bs) return;
    const s = o.getWorldScale(new THREE.Vector3());
    const r = bs.radius * Math.max(s.x, s.y, s.z);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const solid = mats.every((m) => m && !m.transparent && m.depthWrite !== false && m.side !== THREE.BackSide);
    const textured = mats.some((m) => m && m.map);
    cands.push({ o, r, solid, textured });
  });
  const pool = cands.filter((c) => c.solid && c.textured).length ? cands.filter((c) => c.solid && c.textured)
    : cands.filter((c) => c.solid).length ? cands.filter((c) => c.solid) : cands;
  pool.sort((x, y) => y.r - x.r);
  return pool[0]?.o || null;
}

// typical distance of the vertices from the centre (median = ignores stray vertices)
function medianRadius(geometry, centre) {
  const pos = geometry.attributes.position;
  const step = Math.max(1, Math.floor(pos.count / 4000));
  const d = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += step) d.push(v.fromBufferAttribute(pos, i).distanceTo(centre));
  d.sort((a, b) => a - b);
  return d[Math.floor(d.length / 2)] || 1;
}

// random spots, remembered per signal id so leaving and re-entering a planet keeps them.
// They change when the page is reloaded.
const sessionDirs = new Map();

export function createSignalMarkers(planet, container, signals, options = {}) {
  const {
    onSelect = () => {},
    controls = null,
    minFacing = 0.28,    // below this the marker is hidden (keeps it off the planet's edge)
    fadeRange = 0.22,    // markers fade in over this range above minFacing
    edgeMargin = 40,     // px outside the screen before hiding
    behindDepth = 0.84,
    showBehind = false,  // false = a signal on the far side is NOT visible; rotate the planet to find it
    randomize = true,    // true = every signal gets a random spot (kept for this page visit)
    minSeparationDeg = 50, // random signals stay at least this far apart
    maxLatDeg = 60,      // ...and away from the poles
  } = options;

  const pivot = getPlanetPivot(planet);
  const hold = (k) => (controls ? controls.hold(k) : (planet.state.autoRotate = false));
  const release = (k) => (controls ? controls.release(k) : (planet.state.autoRotate = true));

  const layer = document.createElement('div');
  layer.className = 'signal-layer';
  container.appendChild(layer);

  let disposed = false;
  let snapped = false;
  let activeId = null;
  let planetMesh = null;
  let frame = null;                     // lat/lon -> model rotation, learned from signals that have a pos
  const centreL = new THREE.Vector3();  // planet centre in the mesh's own coordinates
  let radiusL = 1;                      // planet radius in the mesh's own coordinates

  const items = signals.map((sig) => {
    const anchor = new THREE.Object3D();
    pivot.add(anchor);                  // moved onto the planet mesh once it exists

    const el = document.createElement('div');
    el.className = 'signal signal--right';
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.dataset.id = sig.id;
    el.style.visibility = 'hidden';
    el.innerHTML = `
      <span class="signal__dot"><span class="signal__ring"></span><span class="signal__ring signal__ring--2"></span><span class="signal__ring signal__ring--3"></span></span>
      <span class="signal__tag">
        <strong></strong>
      </span>`;
    el.querySelector('strong').textContent = sig.label;
    layer.appendChild(el);

    const it = {
      sig, anchor, el, side: 'right', up: false, behind: false, found: false,
    };

    const select = (e) => {
      e.stopPropagation();
      if (it.behind) {                                   // far side: turn the planet to it
        if (controls) controls.focusOn(pivotDirection(anchor));
        return;
      }
      activeId = sig.id;
      hold('selected');
      items.forEach((o) => o.el.classList.toggle('is-active', o.sig.id === activeId));
      onSelect(sig, el);
    };
    el.addEventListener('click', select);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') select(e); });
    el.addEventListener('pointerdown', (e) => e.stopPropagation());   // don't start a planet drag
    el.addEventListener('mouseenter', () => hold('hover'));
    el.addEventListener('mouseleave', () => release('hover'));

    return it;
  });

  // direction (planet centre -> anchor) in the PIVOT's coordinates, for controls.focusOn
  const _a = new THREE.Vector3();
  const _c = new THREE.Vector3();
  function pivotDirection(anchor) {
    anchor.getWorldPosition(_a);
    planetMesh.localToWorld(_c.copy(centreL));
    return pivot.worldToLocal(_a.clone()).sub(pivot.worldToLocal(_c.clone())).normalize();
  }

  // ---- Random spots: spread out, off the poles, and the first one starts in view ----
  function assignRandomDirections() {
    const rad = Math.PI / 180;
    const centreWorld = planetMesh.localToWorld(centreL.clone());
    const camDir = planet.camera.position.clone().sub(centreWorld).normalize();
    // how much a mesh-local direction faces the camera right now (1 = dead centre, <0 = far side)
    const faceOf = (dir) => planetMesh.localToWorld(centreL.clone().add(dir)).sub(centreWorld).normalize().dot(camDir);
    const sinMax = Math.sin(maxLatDeg * rad);
    const chosen = [];
    items.forEach((it, i) => {
      const cached = sessionDirs.get(it.sig.id);
      if (cached) { it.randomDir = cached; chosen.push(cached); return; }
      let dir = null;
      for (let tries = 0; tries < 400; tries++) {
        const y = (Math.random() * 2 - 1) * sinMax;
        const lon = Math.random() * Math.PI * 2;
        const r = Math.sqrt(1 - y * y);
        const cand = new THREE.Vector3(r * Math.sin(lon), y, r * Math.cos(lon));
        const minCos = Math.cos((tries < 250 ? minSeparationDeg : 20) * rad);   // relax if it is hard to fit
        if (chosen.some((c) => c.dot(cand) > minCos)) continue;                  // too close to another signal
        if (i === 0 && faceOf(cand) < 0.6) continue;                             // first one starts in view
        dir = cand;
        break;
      }
      dir = dir || new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.8, Math.random() - 0.5).normalize();
      it.randomDir = dir;
      sessionDirs.set(it.sig.id, dir);
      chosen.push(dir);
    });
  }

  // ---- Pin every anchor to its fixed point on the planet mesh ----
  function pinToPlanet() {
    planetMesh = findPlanetMesh(pivot);
    if (!planetMesh) { console.warn('[signals] no planet mesh found under the pivot'); return; }
    const geo = planetMesh.geometry;
    geo.computeBoundingBox();
    geo.boundingBox.getCenter(centreL);
    radiusL = medianRadius(geo, centreL);
    frame = computeFrame(signals);
    console.log('[signals] lat/lon calibration:', frame ? (frame.kind === 'full' ? 'full orientation (2+ picked signals)' : `longitude offset ${frame.deg.toFixed(2)}° (1 picked signal)`) : 'none (no signal has both pos and lat/lon, using lat/lon as-is)');

    planetMesh.updateWorldMatrix(true, false);
    if (randomize) assignRandomDirections();
    const centreWorld = planetMesh.localToWorld(centreL.clone());
    const ray = new THREE.Raycaster();
    let misses = 0;
    items.forEach((it) => {
      it.dir = randomize && it.randomDir ? it.randomDir : signalDirection(it.sig, frame);
      // fire from outside toward the centre and land on the planet's real surface...
      const originW = planetMesh.localToWorld(centreL.clone().addScaledVector(it.dir, radiusL * 3));
      ray.set(originW, centreWorld.clone().sub(originW).normalize());
      const hit = ray.intersectObject(planetMesh, false)[0];
      if (!hit) misses++;
      // ...then store the point in the MESH's own coordinates: fixed from now on
      it.anchor.position.copy(hit ? planetMesh.worldToLocal(hit.point.clone())
                                  : centreL.clone().addScaledVector(it.dir, radiusL));
      planetMesh.add(it.anchor);        // child of the mesh: it can't drift off the surface
    });
    console.log('[signals] pinned', items.length, 'signals to mesh', planetMesh.name || '(unnamed)', '| local radius', radiusL.toFixed(3), '| misses', misses);
    snapped = true;
  }
  planet.ready.then(() => { if (!disposed) pinToPlanet(); });

  // ---- Dev: double-click the planet to read its coordinates (?pick=1) ----
  const pickEnabled = new URLSearchParams(window.location.search).has('pick');
  const onPick = (e) => {
    if (disposed || !snapped) return;
    if (e.target.closest && e.target.closest('.signal, .planet-hud, .eq-overlay')) return;
    const rect = planet.renderer.domElement.getBoundingClientRect();
    const ndcP = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndcP, planet.camera);
    const hit = rc.intersectObject(planetMesh, false)[0];
    if (!hit) { console.log('[pick] no planet under the cursor'); return; }
    const local = planetMesh.worldToLocal(hit.point.clone()).sub(centreL).normalize();
    const { lat, lon } = directionToLatLon(local);
    const pos = `pos: [${local.x.toFixed(3)}, ${local.y.toFixed(3)}, ${local.z.toFixed(3)}]`;
    console.log(`[pick] ${pos}   (lat ${lat.toFixed(2)}, lon ${lon.toFixed(2)})`);
    navigator.clipboard?.writeText(pos).catch(() => {});
  };
  if (pickEnabled) window.addEventListener('dblclick', onPick);

  function setBehind(it, behind) {
    if (it.behind === behind) return;
    it.behind = behind;
    it.el.classList.toggle('is-behind', behind);
  }

  // ---- Per-frame projection ----
  const world = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  const ndc = new THREE.Vector3();
  const centreW = new THREE.Vector3();
  const centreNdc = new THREE.Vector3();
  const scaleV = new THREE.Vector3();

  // the scene can swap or rebuild the Moon mesh after "ready" (e.g. a sharper model loads).
  // If the mesh we pinned to is no longer the visible planet, pin again to the new one.
  const isUnderPivot = (o) => { for (let n = o; n; n = n.parent) if (n === pivot) return true; return false; };
  let tick = 0;
  function ensurePinned() {
    if (planetMesh && isUnderPivot(planetMesh) && (++tick % 45 !== 0 || findPlanetMesh(pivot) === planetMesh)) return;
    console.log('[signals] planet mesh changed, re-pinning signals');
    pinToPlanet();
  }

  function update() {
    if (disposed || !snapped) return;
    ensurePinned();
    if (!planetMesh) return;
    const cam = planet.camera;
    cam.updateMatrixWorld();

    // the canvas's real rectangle on screen: all projection goes through this
    const rect = planet.renderer.domElement.getBoundingClientRect();
    const W = rect.width || window.innerWidth;
    const H = rect.height || window.innerHeight;
    const ox = rect.left || 0;
    const oy = rect.top || 0;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // planet centre + silhouette radius on screen
    planetMesh.updateWorldMatrix(true, false);
    planetMesh.localToWorld(centreW.copy(centreL));
    centreNdc.copy(centreW).project(cam);
    const cx = ox + (centreNdc.x * 0.5 + 0.5) * W;
    const cy = oy + (-centreNdc.y * 0.5 + 0.5) * H;
    planetMesh.getWorldScale(scaleV);
    const Rw = radiusL * Math.max(scaleV.x, scaleV.y, scaleV.z);   // surface radius at the planet's current scale
    const d = Math.max(cam.position.distanceTo(centreW), Rw * 1.01);
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const radiusPx = ((H / 2) / tanV) * (Rw / Math.sqrt(d * d - Rw * Rw));

    for (const it of items) {
      const { anchor, el } = it;
      anchor.getWorldPosition(world);
      normal.copy(world).sub(centreW).normalize();
      toCam.copy(cam.position).sub(world).normalize();
      const facing = normal.dot(toCam);

      ndc.copy(world).project(cam);
      let x = ox + (ndc.x * 0.5 + 0.5) * W;
      let y = oy + (-ndc.y * 0.5 + 0.5) * H;

      const behind = facing <= minFacing;
      setBehind(it, behind);

      if (behind) {
        if (!showBehind) {
          el.style.visibility = 'hidden';
          el.style.pointerEvents = 'none';
          continue;
        }
        // keep it INSIDE the disc, near the edge, in the direction of the hidden signal
        let dx = x - cx, dy = y - cy;
        const len = Math.hypot(dx, dy);
        if (len < 1) { dx = 0; dy = -1; } else { dx /= len; dy /= len; }
        x = cx + dx * radiusPx * behindDepth;
        y = cy + dy * radiusPx * behindDepth;
      }

      const onScreen = x > -edgeMargin && x < w + edgeMargin && y > -edgeMargin && y < h + edgeMargin;
      if (!onScreen) {
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
        continue;
      }

      // the tag sits toward the planet's centre, sideways and up/down
      const side = x < cx ? 'right' : 'left';
      const up = y >= cy;           // point below centre -> tag goes up
      if (side !== it.side) {
        el.classList.replace(`signal--${it.side}`, `signal--${side}`);
        it.side = side;
      }
      if (up !== it.up) {
        it.up = up;
        el.classList.toggle('is-up', up);
      }

      el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
      el.style.opacity = behind ? '0.9' : String(Math.min(1, (facing - minFacing) / fadeRange));
      el.style.pointerEvents = 'auto';
      el.style.visibility = 'visible';
    }
  }

  // ---- Stay glued to the surface: update right AFTER each planet render ----
  // Wrapping renderer.render means the markers use the very matrices that were just drawn,
  // whatever order the scene runs its own loop in. (onUpdate is only a fallback.)
  const renderer = planet.renderer;
  const hadOwnRender = Object.prototype.hasOwnProperty.call(renderer, 'render');
  const originalRender = renderer.render;
  let viaRender = false;
  let inHook = false;
  renderer.render = function patchedRender(scene, camera, ...rest) {
    const out = originalRender.call(this, scene, camera, ...rest);
    if (!disposed && !inHook && camera === planet.camera) {
      inHook = true;
      viaRender = true;
      try { update(); } finally { inHook = false; }
    }
    return out;
  };
  planet.onUpdate(() => { if (!viaRender) update(); });

  return {
    items,
    markFound(id, name) {
      const it = items.find((i) => i.sig.id === id);
      if (!it) return;
      it.found = true;
      it.el.classList.add('is-found');
      it.el.querySelector('strong').textContent = name || (it.sig.equipment && it.sig.equipment.name) || it.sig.label;
    },
    resume() {
      activeId = null;
      items.forEach((it) => it.el.classList.remove('is-active'));
      release('selected');
    },
    dispose() {
      disposed = true;
      window.removeEventListener('dblclick', onPick);
      if (hadOwnRender) renderer.render = originalRender; else delete renderer.render;
      items.forEach(({ anchor }) => anchor.removeFromParent());
      layer.remove();
    },
  };
}