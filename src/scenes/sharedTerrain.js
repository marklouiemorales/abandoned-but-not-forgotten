// src/scenes/sharedTerrain.js
// -----------------------------------------------------------------------------
// One terrain GLB, loaded ONCE and reused under every piece of equipment.
//
//   loadSharedTerrain(url)            -> Promise<terrain>   (cached by url; safe to call early / repeatedly)
//   placeTerrainUnder(terrain, box, o) -> positions the terrain so the equipment sits on a flat,
//                                         boulder-free spot (a different spot per equipment id)
//   disposeSharedTerrain(url?)        -> frees GPU memory + cache (only needed when leaving for good)
//
// Expects the file made by the terrain generator: a regular vertex grid in a node/mesh whose name
// contains "terrain", and (optionally) a mesh whose name contains "boulder".
// -----------------------------------------------------------------------------

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const cache = new Map();            // url -> Promise<terrain>
const ROCK_CELL = 2;                // metres, for the boulder occupancy grid

/* ---------- world-space vertex positions (bakes node transforms) ---------- */
function worldPositions(mesh) {
  mesh.updateWorldMatrix(true, false);
  const pos = mesh.geometry.attributes.position;
  const out = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
  }
  return out;
}

/* ---------- height sampler for a regular grid mesh (handles x-fastest or z-fastest) ---------- */
function buildSampler(mesh) {
  const P = worldPositions(mesh);
  const n = P.length / 3;
  const X = (i) => P[i * 3], Y = (i) => P[i * 3 + 1], Z = (i) => P[i * 3 + 2];
  const eps = 1e-4;

  let nx = 1;
  while (nx < n && Math.abs(Z(nx) - Z(0)) < eps) nx++;
  let order = null;                       // null = x fastest; else remap from z-fastest
  if (nx < 2 || n % nx !== 0) {
    let nzf = 1;
    while (nzf < n && Math.abs(X(nzf) - X(0)) < eps) nzf++;   // z changes fastest
    if (nzf < 2 || n % nzf !== 0) throw new Error('Terrain mesh is not a regular grid');
    nx = n / nzf;
    order = (k) => { const i = Math.floor(k / nx), j = k % nx; return j * nzf + i; };
  }
  const nz = n / nx;
  if (nx < 2 || nz < 2) throw new Error('Terrain mesh is not a regular grid');

  const idx = (k) => (order ? order(k) : k);
  const hs = new Float32Array(n);
  for (let k = 0; k < n; k++) hs[k] = Y(idx(k));
  const x0 = X(idx(0)), x1 = X(idx(nx - 1)), zA = Z(idx(0)), zB = Z(idx(n - 1));
  const sx = (nx - 1) / (x1 - x0), sz = (nz - 1) / (zB - zA);

  const heightAt = (x, z) => {
    const fx = THREE.MathUtils.clamp((x - x0) * sx, 0, nx - 1.001);
    const fz = THREE.MathUtils.clamp((z - zA) * sz, 0, nz - 1.001);
    const j = fx | 0, i = fz | 0, tx = fx - j, tz = fz - i, k = i * nx + j;
    return hs[k] * (1 - tx) * (1 - tz) + hs[k + 1] * tx * (1 - tz) + hs[k + nx] * (1 - tx) * tz + hs[k + nx + 1] * tx * tz;
  };
  return {
    heightAt,
    bounds: { minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(zA, zB), maxZ: Math.max(zA, zB) },
  };
}

/* ---------- which 2 m cells contain boulder geometry ---------- */
function buildRockGrid(mesh) {
  const cells = new Set();
  if (!mesh) return cells;
  const P = worldPositions(mesh);
  for (let i = 0; i < P.length; i += 3) {
    cells.add(`${Math.floor(P[i] / ROCK_CELL)},${Math.floor(P[i + 2] / ROCK_CELL)}`);
  }
  return cells;
}

/* ---------- load (cached) ---------- */
export function loadSharedTerrain(url) {
  if (cache.has(url)) return cache.get(url);
  const p = new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(draco);
    loader.load(url, (gltf) => {
      try {
        const root = new THREE.Group();
        root.name = 'SharedTerrain';
        root.add(gltf.scene);

        let ground = null, rocks = null;
        const cameras = [];
        gltf.scene.traverse((o) => {
          if (o.isCamera) cameras.push(o);
          if (!o.isMesh) return;
          if (/boulder|rock/i.test(o.name)) { rocks = o; o.castShadow = true; o.receiveShadow = true; }
          else if (!ground || /terrain/i.test(o.name)) { ground = o; o.receiveShadow = true; o.castShadow = false; }
        });
        root.updateMatrixWorld(true);
        cameras.forEach((c) => c.parent?.remove(c));          // the embedded 16:9 camera isn't needed here
        if (!ground) throw new Error('No terrain mesh found in ' + url);

        resolve({ url, root, ground, rocks: buildRockGrid(rocks), ...buildSampler(ground) });
      } catch (err) { reject(err); }
    }, undefined, (err) => { console.error('[terrain] load failed:', url, err); reject(err); });
  });
  p.catch(() => cache.delete(url));
  cache.set(url, p);
  return p;
}

export function disposeSharedTerrain(url) {
  const urls = url ? [url] : [...cache.keys()];
  urls.forEach((u) => {
    cache.get(u)?.then((t) => {
      t.root.parent?.remove(t.root);
      t.root.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.isMesh) [].concat(o.material).forEach((m) => { Object.values(m).forEach((v) => v?.isTexture && v.dispose()); m.dispose?.(); });
      });
    }).catch(() => {});
    cache.delete(u);
  });
}

const hash = (s = '') => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/* ---------- put the terrain under the equipment ----------
   box   : THREE.Box3 of the equipment in WORLD space (already scaled / rotated, centred on the origin)
   opts  : { scale, margin, key, spot, embed }
             scale  scene units per terrain metre
             margin metres to keep between the chosen spot and the tile edge
             key    stable string (equipment id) -> each equipment gets its own patch of ground
             spot   {x, z} in terrain metres to force a specific patch
             embed  how far the lowest point sinks into the ground (scene units)            */
export function placeTerrainUnder(terrain, box, opts = {}) {
  const { scale = 0.5, margin = 28, key = '', spot = null, embed = 0.015 } = opts;
  const { heightAt, bounds: b, root, rocks } = terrain;
  root.scale.setScalar(scale);
  root.rotation.set(0, 0, 0);

  // footprint in world units, relative to the origin
  const wcx = (box.max.x + box.min.x) / 2, wcz = (box.max.z + box.min.z) / 2;
  const whx = (box.max.x - box.min.x) / 2,  whz = (box.max.z - box.min.z) / 2;

  // heights under the footprint (5x5 grid, optionally enlarged) if the terrain spot (cx,cz) sits at the origin
  const heights = (cx, cz, grow = 1) => {
    const out = [];
    for (let a = -2; a <= 2; a++) for (let c = -2; c <= 2; c++) {
      out.push(heightAt(cx + (wcx + (a / 2) * whx * grow) / scale, cz + (wcz + (c / 2) * whz * grow) / scale));
    }
    return out;
  };
  const rockBlocked = (cx, cz) => {
    if (!rocks.size) return false;
    const ex = (whx / scale) + 1.2, ez = (whz / scale) + 1.2;
    const lx = cx + wcx / scale, lz = cz + wcz / scale;
    for (let i = Math.floor((lx - ex) / ROCK_CELL); i <= Math.floor((lx + ex) / ROCK_CELL); i++)
      for (let j = Math.floor((lz - ez) / ROCK_CELL); j <= Math.floor((lz + ez) / ROCK_CELL); j++)
        if (rocks.has(`${i},${j}`)) return true;
    return false;
  };

  let cx, cz;
  if (spot) { cx = spot.x; cz = spot.z; }
  else {
    const cands = [];
    for (let x = b.minX + margin; x <= b.maxX - margin; x += 3)
      for (let z = b.minZ + margin; z <= b.maxZ - margin; z += 3) {
        const h = heights(x, z, 1.5);
        const rough = Math.max(...h) - Math.min(...h);
        cands.push({ x, z, score: rough + (rockBlocked(x, z) ? 1 : 0) + 0.0004 * Math.hypot(x, z) });
      }
    cands.sort((p, q) => p.score - q.score);
    const pick = cands[hash(key) % Math.max(1, Math.min(10, cands.length))] || { x: 0, z: 0 };
    cx = pick.x; cz = pick.z;
  }

  const hmax = Math.max(...heights(cx, cz, 1));
  root.position.set(-cx * scale, box.min.y - hmax * scale + embed, -cz * scale);
  root.updateMatrixWorld(true);
  return { cx, cz };
}