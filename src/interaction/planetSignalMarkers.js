// src/interaction/planetSignalMarkers.js
// -----------------------------------------------------------------------------
//
// FIXED POSITIONS
//   Every signal is pinned to a fixed point in the planet MESH's own coordinates, so it
//   can never drift: no raycast, no per-load guessing. The marker is a child of the
//   planet mesh itself, so it turns with whatever turns the planet.
//
//   Give each signal ONE of these in moonSignals.js / marsSignals.js:
//     pos: [x, y, z]      <- exact point (a direction from the planet's centre). Preferred.
//     lat: 0.67, lon: 23.47   <- still works (same mapping as before)
//
// FINDING THE COORDINATES
//   Open the page with  ?pick=1  (e.g. /?phase=moon&pick=1), DOUBLE-CLICK a spot on the
//   planet, and read the console. It prints a line like
//        pos: [0.412, 0.103, 0.905]   (lat 5.91, lon 24.48)
//   and copies the  pos: [...]  part to your clipboard. Paste it into that signal.
//
// OTHER BEHAVIOUR
//   - Signals on the FAR side show as dashed markers just inside the planet's edge.
//     Clicking one rotates the planet so the signal turns to face you.
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

// a signal's fixed direction: `pos: [x,y,z]` (or {x,y,z}) wins, else lat/lon
function signalDirection(sig) {
  const p = sig.pos;
  if (Array.isArray(p) && p.length >= 3) return new THREE.Vector3(p[0], p[1], p[2]).normalize();
  if (p && typeof p === 'object') return new THREE.Vector3(p.x, p.y, p.z).normalize();
  return latLonToDirection(sig.lat ?? 0, sig.lon ?? 0);
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

export function createSignalMarkers(planet, container, signals, options = {}) {
  const {
    onSelect = () => {},
    controls = null,
    minFacing = 0.12,    // below this the signal counts as "behind the planet"
    fadeRange = 0.18,    // front markers fade in over this range above minFacing
    edgeMargin = 40,     // px outside the screen before hiding
    behindDepth = 0.84,
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

  // ---- Pin every anchor to its fixed point on the planet mesh ----
  function pinToPlanet() {
    planetMesh = findPlanetMesh(pivot);
    if (!planetMesh) { console.warn('[signals] no planet mesh found under the pivot'); return; }
    const geo = planetMesh.geometry;
    geo.computeBoundingBox();
    geo.boundingBox.getCenter(centreL);
    radiusL = medianRadius(geo, centreL);

    planetMesh.updateWorldMatrix(true, false);
    const centreWorld = planetMesh.localToWorld(centreL.clone());
    const ray = new THREE.Raycaster();
    let misses = 0;
    items.forEach((it) => {
      it.dir = signalDirection(it.sig);
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
    const ndcP = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
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
    planet.camera.updateMatrixWorld();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cam = planet.camera;

    // planet centre + silhouette radius on screen
    planetMesh.updateWorldMatrix(true, false);
    planetMesh.localToWorld(centreW.copy(centreL));
    centreNdc.copy(centreW).project(cam);
    const cx = (centreNdc.x * 0.5 + 0.5) * w;
    const cy = (-centreNdc.y * 0.5 + 0.5) * h;
    planetMesh.getWorldScale(scaleV);
    const Rw = radiusL * Math.max(scaleV.x, scaleV.y, scaleV.z);   // surface radius at the planet's current scale
    const d = Math.max(cam.position.distanceTo(centreW), Rw * 1.01);
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const radiusPx = ((h / 2) / tanV) * (Rw / Math.sqrt(d * d - Rw * Rw));

    for (const it of items) {
      const { anchor, el } = it;
      anchor.getWorldPosition(world);
      normal.copy(world).sub(centreW).normalize();
      toCam.copy(cam.position).sub(world).normalize();
      const facing = normal.dot(toCam);

      ndc.copy(world).project(cam);
      let x = (ndc.x * 0.5 + 0.5) * w;
      let y = (-ndc.y * 0.5 + 0.5) * h;

      const behind = facing <= minFacing;
      setBehind(it, behind);

      if (behind) {
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

      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.style.opacity = behind ? '0.9' : String(Math.min(1, (facing - minFacing) / fadeRange));
      el.style.pointerEvents = 'auto';
      el.style.visibility = 'visible';
    }
  }
  planet.onUpdate(update);

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
      items.forEach(({ anchor }) => anchor.removeFromParent());
      layer.remove();
    },
  };
}