// src/interaction/planetControls.js
// -----------------------------------------------------------------------------
// Grab and spin ANY planet (Moon or Mars) with mouse or touch, with inertia.
//
// Works with any planet scene that exposes:
//   planet.renderer, planet.camera, planet.ready, planet.state.autoRotate,
//   planet.onUpdate(fn), and a pivot group: planet.pivot (preferred) or
//   planet.moonPivot / planet.marsPivot.
//
// Listeners live on `window` in the CAPTURE phase so dragging works even if an
// invisible overlay sits on top of the canvas. Presses that start on real UI
// (buttons, inputs, signal markers, the equipment panel) are ignored.
//
//   const controls = createPlanetControls(planet, { onDragStart: () => {...} });
//   controls.hold('key')      -> keep auto-rotation off
//   controls.release('key')
//   While hold('selected') is active (a signal is open) dragging is disabled.
//   controls.dispose()
//
// Drag direction feels inverted? pass { invert: true }.
// -----------------------------------------------------------------------------

import * as THREE from 'three';

// The group that holds the planet model (and the signal anchors).
export function getPlanetPivot(planet) {
  return planet.pivot ?? planet.moonPivot ?? planet.marsPivot;
}

// True radius of the planet in pivot space. The scenes normalise the model with a
// bounding sphere, so the real surface may sit below 1 (Moon ~0.58).
export function measurePlanetRadius(pivot, fallback = 0.58) {
  const saved = pivot.rotation.clone();
  pivot.rotation.set(0, 0, 0);
  pivot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(pivot);
  pivot.rotation.copy(saved);
  pivot.updateMatrixWorld(true);
  if (box.isEmpty()) return fallback;
  const s = box.getSize(new THREE.Vector3());
  return (s.x + s.y + s.z) / 6;
}

const UI_SELECTOR = 'button, a, input, textarea, select, label, [data-no-drag], .signal, .eq-overlay';

export function createPlanetControls(planet, options = {}) {
  const {
    idleResumeMs = 6000,   // 0 = resume right away, Infinity = never auto-rotate again
    maxPitch = 1.4,        // radians the user can tilt toward the poles
    friction = 0.93,       // inertia decay per frame (closer to 1 = longer glide)
    invert = false,
    onDragStart = () => {},
  } = options;

  const canvas = planet.renderer.domElement;
  const pivot = getPlanetPivot(planet);
  if (!pivot) throw new Error('createPlanetControls: planet needs a pivot (planet.pivot / moonPivot / marsPivot)');
  const sign = invert ? -1 : 1;
  const body = document.body;

  const prevTouchAction = document.documentElement.style.touchAction;
  document.documentElement.style.touchAction = 'none';
  canvas.style.touchAction = 'none';
  body.classList.add('planet-draggable');

  let R = 0.58;
  planet.ready.then(() => { R = measurePlanetRadius(pivot); });

  const holds = new Set();
  let idleUntil = 0;
  let dragging = false;
  let started = false;
  let activeId = null;
  let moved = 0;
  let lastX = 0, lastY = 0, lastT = 0;
  let vx = 0, vy = 0;           // radians per frame (pitch, yaw)
  let suppressClick = false;
  let disposed = false;

  function pxPerRad() {
    const h = canvas.clientHeight || window.innerHeight;
    const tanV = Math.tan(THREE.MathUtils.degToRad(planet.camera.fov / 2));
    const d = planet.camera.position.length();
    return ((h / 2) / tanV) * (R / Math.max(d - R, 0.05));
  }
  const clampPitch = (x) => Math.max(-maxPitch, Math.min(maxPitch, x));

  function onDown(e) {
    if (dragging || holds.has('selected')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest(UI_SELECTOR)) return;
    dragging = true;
    started = false;
    activeId = e.pointerId;
    moved = 0;
    vx = vy = 0;
    lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
    try { e.target.setPointerCapture(e.pointerId); } catch (_) { /* not critical */ }
  }

  function onMove(e) {
    if (!dragging || e.pointerId !== activeId) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    const now = performance.now();
    moved += Math.abs(dx) + Math.abs(dy);
    if (!started && moved > 4) {
      started = true;
      body.classList.add('planet-dragging');
      onDragStart();
    }
    if (!started) return;

    const k = 1 / pxPerRad();
    const dYaw = dx * k * sign;
    const dPitch = dy * k * sign;
    pivot.rotation.y += dYaw;
    pivot.rotation.x = clampPitch(pivot.rotation.x + dPitch);

    const frames = Math.max(now - lastT, 8) / 16.67;
    vy = 0.6 * vy + 0.4 * (dYaw / frames);
    vx = 0.6 * vx + 0.4 * (dPitch / frames);
    lastX = e.clientX; lastY = e.clientY; lastT = now;
  }

  function endDrag(e) {
    if (!dragging || (e && e.pointerId !== activeId)) return;
    dragging = false;
    activeId = null;
    body.classList.remove('planet-dragging');
    if (performance.now() - lastT > 80) vx = vy = 0;   // held still before release: no glide
    idleUntil = performance.now() + idleResumeMs;
    if (started) {                                      // a drag must not count as a click
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
    }
  }

  function onClickCapture(e) {
    if (!suppressClick) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    suppressClick = false;
  }

  const onBlur = () => endDrag(null);

  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', endDrag, true);
  window.addEventListener('pointercancel', endDrag, true);
  window.addEventListener('blur', onBlur);
  window.addEventListener('click', onClickCapture, true);

  planet.onUpdate((dt) => {
    if (disposed) return;
    if (!dragging && (Math.abs(vx) > 1e-5 || Math.abs(vy) > 1e-5)) {
      pivot.rotation.y += vy * dt * 60;
      pivot.rotation.x = clampPitch(pivot.rotation.x + vx * dt * 60);
      const f = Math.pow(friction, dt * 60);
      vx *= f; vy *= f;
    }
    const gliding = Math.abs(vx) + Math.abs(vy) > 1e-4;
    planet.state.autoRotate = !dragging && !gliding && holds.size === 0 && performance.now() >= idleUntil;
  });

  return {
    hold(key) { holds.add(key); },
    release(key) { holds.delete(key); },
    dispose() {
      disposed = true;
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', endDrag, true);
      window.removeEventListener('pointercancel', endDrag, true);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('click', onClickCapture, true);
      body.classList.remove('planet-draggable', 'planet-dragging');
      document.documentElement.style.touchAction = prevTouchAction;
    },
  };
}