// src/interaction/planetSignalMarkers.js
// -----------------------------------------------------------------------------
// Pins clickable HTML markers (with a futuristic guide line) to lat/lon points ON
// the surface of any planet (Moon or Mars).
//
// Each signal's direction is raycast against the real planet mesh once the model
// has loaded, so the marker sits exactly on the terrain. Markers are children of
// the planet pivot, so they rotate with the planet (auto-rotation or user drag).
// Markers fade out before the limb and hide on the far side. Labels flip toward
// the planet's centre so they never hang off into space.
//
//   const markers = createSignalMarkers(planet, document.body, SIGNALS, {
//     controls,                       // from createPlanetControls (optional)
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
    minFacing = 0.28,   // markers are fully hidden below this (keeps them inside the disc)
    fadeRange = 0.22,   // ...and fade in over this range
    edgeMargin = 40,    // px outside the screen before hiding
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

  const items = signals.map((sig) => {
    const anchor = new THREE.Object3D();
    pivot.add(anchor);

    const el = document.createElement('div');
    el.className = 'signal signal--right';
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.dataset.id = sig.id;
    el.style.visibility = 'hidden';
    // Vector leader: starts at the dot (bottom-left of the svg), angles up, then runs long.
    el.innerHTML = `
      <svg class="signal__vector" viewBox="0 0 220 64" width="220" height="64" aria-hidden="true">
        <path class="v-base" d="M0 64 L48 16 L220 16"/>
        <path class="v-flow" d="M48 16 L220 16"/>
        <path class="v-tick" d="M96 11v10M136 11v10M176 11v10"/>
        <path class="v-node" d="M220 11l5 5-5 5-5-5z"/>
      </svg>
      <span class="signal__dot"><i></i></span>
      <span class="signal__text">
        <strong></strong>
        <small></small>
      </span>`;
    el.querySelector('strong').textContent = sig.label;
    el.querySelector('small').textContent = sig.hint;
    layer.appendChild(el);

    const select = (e) => {
      e.stopPropagation();
      activeId = sig.id;
      hold('selected');
      items.forEach((it) => it.el.classList.toggle('is-active', it.sig.id === activeId));
      onSelect(sig, el);
    };
    el.addEventListener('click', select);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') select(e); });
    el.addEventListener('pointerdown', (e) => e.stopPropagation());   // don't start a planet drag
    el.addEventListener('mouseenter', () => hold('hover'));
    el.addEventListener('mouseleave', () => release('hover'));

    return { sig, anchor, el, side: 'right' };
  });

  // ---- Snap every anchor onto the real surface (once the model exists) ----
  function snapToSurface() {
    const R = measurePlanetRadius(pivot);
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
    snapped = true;
  }
  planet.ready.then(() => { if (!disposed) snapToSurface(); });

  // ---- Per-frame projection ----
  const world = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  const ndc = new THREE.Vector3();

  function update() {
    if (disposed || !snapped) return;
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (const it of items) {
      const { anchor, el } = it;
      anchor.getWorldPosition(world);
      normal.copy(world).normalize();                         // planet is centred on the origin
      toCam.copy(planet.camera.position).sub(world).normalize();
      const facing = normal.dot(toCam);

      ndc.copy(world).project(planet.camera);
      const x = (ndc.x * 0.5 + 0.5) * w;
      const y = (-ndc.y * 0.5 + 0.5) * h;
      const onScreen = x > -edgeMargin && x < w + edgeMargin && y > -edgeMargin && y < h + edgeMargin;

      if (facing > minFacing && onScreen) {
        const side = x < w * 0.5 ? 'right' : 'left';          // label points toward the planet's centre
        if (side !== it.side) {
          el.classList.replace(`signal--${it.side}`, `signal--${side}`);
          it.side = side;
        }
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        el.style.opacity = String(Math.min(1, (facing - minFacing) / fadeRange));
        el.style.pointerEvents = 'auto';
        el.style.visibility = 'visible';
      } else {
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
      }
    }
  }
  planet.onUpdate(update);

  return {
    items,
    markFound(id, name) {
      const it = items.find((i) => i.sig.id === id);
      if (!it) return;
      it.el.classList.add('is-found');
      it.el.querySelector('strong').textContent = name || (it.sig.equipment && it.sig.equipment.name) || it.sig.label;
      it.el.querySelector('small').textContent = 'Equipment recovered';
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