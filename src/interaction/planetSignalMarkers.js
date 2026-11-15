// src/interaction/planetSignalMarkers.js
// -----------------------------------------------------------------------------
//
// - Each signal is raycast onto the real mesh once the model has loaded.
// - Markers are children of the planet pivot, so they rotate with the planet.
// - The vector line is FITTED every frame so it ends inside the planet's disc: it
//   points toward the planet's centre and goes up or down, whichever has more room.
// - Signals on the FAR side show as dashed markers just inside the planet's edge.
//   Clicking one rotates the planet so the signal turns to face you.
// - Unknown signals are white. Once the equipment is found they turn green.
//
//   const markers = createSignalMarkers(planet, document.body, SIGNALS, {
//     controls,
//     onSelect: (signal, markerEl) => { ... },
//   });
//   markers.markFound(id, name)  markers.resume()  markers.dispose()
// -----------------------------------------------------------------------------

import * as THREE from 'three';
import { getPlanetPivot, measurePlanetRadius } from './planetControls.js';

function latLonToDirection(lat, lon) {
  const phi = THREE.MathUtils.degToRad(lat);
  const lam = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(
    Math.cos(phi) * Math.sin(lam),
    Math.sin(phi),
    Math.cos(phi) * Math.cos(lam)
  );
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
  let R = 0.58;
  let surfaceR = 0.58;  
  const items = signals.map((sig) => {
    const anchor = new THREE.Object3D();
    pivot.add(anchor);

    const el = document.createElement('div');
    el.className = 'signal signal--right';
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.dataset.id = sig.id;
    el.style.visibility = 'hidden';
    el.innerHTML = `
      <span class="signal__dot"><span class="signal__ring"></span></span>
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
        if (controls) controls.focusOn(anchor.position.clone().normalize());
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

  // ---- Snap every anchor onto the real surface (once the model exists) ----
  function snapToSurface() {
    R = measurePlanetRadius(pivot);
    pivot.updateMatrixWorld(true);

    const meshes = [];
    pivot.traverse((o) => { if (o.isMesh) meshes.push(o); });

    const centre = pivot.getWorldPosition(new THREE.Vector3());
    const ray = new THREE.Raycaster();

    items.forEach(({ sig, anchor }) => {
      const dir = latLonToDirection(sig.lat, sig.lon);
      const originWorld = pivot.localToWorld(dir.clone().multiplyScalar(R * 3));
      ray.set(originWorld, centre.clone().sub(originWorld).normalize());
      const hit = ray.intersectObjects(meshes, false)[0];
      anchor.position.copy(hit ? pivot.worldToLocal(hit.point.clone()) : dir.multiplyScalar(R * 0.99));
    });
    const total = items.reduce((sum, it) => sum + it.anchor.position.length(), 0);
    surfaceR = items.length ? total / items.length : R;
    console.log('[signals] box radius', R.toFixed(3), '| surface radius', surfaceR.toFixed(3), '| pivot scale', pivot.scale.x.toFixed(3));
    snapped = true;
  }
  planet.ready.then(() => { if (!disposed) snapToSurface(); });

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

  function update() {
    if (disposed || !snapped) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cam = planet.camera;

    // planet centre + silhouette radius on screen
    pivot.getWorldPosition(centreW);
    centreNdc.copy(centreW).project(cam);
    const cx = (centreNdc.x * 0.5 + 0.5) * w;
    const cy = (-centreNdc.y * 0.5 + 0.5) * h;
    pivot.getWorldScale(scaleV);
    const Rw = surfaceR * scaleV.x;   // surface radius at the planet's current scale
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
      items.forEach(({ anchor }) => anchor.removeFromParent());
      layer.remove();
    },
  };
}