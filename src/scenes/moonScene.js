// moonScene.js
// -----------------------------------------------------------------------------
// Black space background (lots of stars) + centered, slowly rotating moon.
//
// Requires: three  ->  npm i three
// Model:    put the moon in /public/models/moon.glb (or change modelUrl)
//
// USAGE
//   import { createMoonScene } from './moonScene.js';
//
//   const moon = createMoonScene(document.getElementById('moon-container'), {
//     modelUrl: '/models/moon.glb',   // .glb / .gltf (recommended) or .obj
//   });
//
//   moon.ready.then(() => { /* model is loaded; safe to raycast / add clicks */ });
//
// The container needs a real size, e.g. width: 100vw; height: 100vh; position: relative.
//
// FOR THE CLICK FEATURE
//   moon.scene / moon.camera / moon.renderer  -> standard three.js objects
//   moon.moonPivot                            -> Group at the origin that spins; raycast against its children
//   moon.state.autoRotate = false             -> pause spinning (e.g. while navigating)
//   moon.onUpdate((dt) => { ... })            -> run your own code every frame
//   moon.dispose()                            -> cleanup (call on unmount)
// -----------------------------------------------------------------------------

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export function createMoonScene(container, options = {}) {
  const {
    modelUrl = '/models/moon.glb',
    textureUrl = null,        // only used for .obj
    fill = 2.0,               // moon size vs screen height (raise to zoom in more)
    rotationSpeed = 0.0008,   // radians per frame
    starsDim = 9000,          // tiny faint stars
    starsMid = 2500,          // medium stars
    starsBright = 300,        // few bright stars
    forceMatte = true,        // moon has no shine
    fov = 45,
  } = options;

  const state = { autoRotate: true, rotationSpeed };

  // ---------- Core ----------
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 300);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000); // pure black
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  // ---------- Stars ----------
  const spriteCanvas = document.createElement('canvas');
  spriteCanvas.width = spriteCanvas.height = 64;
  const sg = spriteCanvas.getContext('2d');
  const sgrad = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
  sgrad.addColorStop(0, 'rgba(255,255,255,1)');
  sgrad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  sgrad.addColorStop(1, 'rgba(255,255,255,0)');
  sg.fillStyle = sgrad;
  sg.fillRect(0, 0, 64, 64);
  const starSprite = new THREE.CanvasTexture(spriteCanvas);

  const PALETTE = [
    [0.72, 0.82, 1.0],  // blue-white
    [1.0, 1.0, 1.0],    // white
    [1.0, 0.9, 0.76],   // warm
    [1.0, 0.74, 0.58],  // orange (rare)
  ];

  function starLayer({ count, size, minB, power }) {
    const R = 120;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      pos.set([R * s * Math.cos(t), R * u, R * s * Math.sin(t)], i * 3);

      const b = minB + Math.pow(Math.random(), power) * (1 - minB);
      const r = Math.random();
      const p = r < 0.3 ? PALETTE[0] : r < 0.75 ? PALETTE[1] : r < 0.95 ? PALETTE[2] : PALETTE[3];
      col.set([p[0] * b, p[1] * b, p[2] * b], i * 3);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size,
        sizeAttenuation: false,
        map: starSprite,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      })
    );
    pts.frustumCulled = false;
    return pts;
  }

  const stars = new THREE.Group();
  stars.add(
    starLayer({ count: starsDim, size: 1.5, minB: 0.2, power: 2 }),
    starLayer({ count: starsMid, size: 2.4, minB: 0.35, power: 2 }),
    starLayer({ count: starsBright, size: 3.8, minB: 0.7, power: 1.2 })
  );
  scene.add(stars);

  // ---------- Lights: hard sun + faint fill ----------
  const sun = new THREE.DirectionalLight(0xfff6ea, 3.2);
  sun.position.set(4, 2, 6);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x1a2233, 0.8));

  // ---------- Moon ----------
  // moonPivot spins at the origin. Its child is the model, scaled so radius = 1.
  const moonPivot = new THREE.Group();
  scene.add(moonPivot);
  const moonMat = new THREE.MeshStandardMaterial({ color: 0xbfbfbf, roughness: 1, metalness: 0 });

  function addModel(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    obj.position.sub(sphere.center);
    const holder = new THREE.Group();
    holder.add(obj);
    holder.scale.setScalar(1 / sphere.radius);
    moonPivot.add(holder);
    return holder;
  }

  function placeholderMoon() {
    console.warn(`[moonScene] Could not load ${modelUrl} - showing placeholder moon.`);
    const geo = new THREE.IcosahedronGeometry(1, 60);
    const p = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const n = Math.sin(v.x * 9) * Math.sin(v.y * 9) * Math.sin(v.z * 9);
      v.multiplyScalar(1 + n * 0.015);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return addModel(new THREE.Mesh(geo, moonMat));
  }

  const ext = modelUrl.split('?')[0].split('.').pop().toLowerCase();

  const ready = new Promise((resolve) => {
    if (ext === 'glb' || ext === 'gltf') {
      new GLTFLoader().load(
        modelUrl,
        (gltf) => {
          gltf.scene.traverse((c) => {
            if (!c.isMesh) return;
            if (!c.geometry.attributes.normal) c.geometry.computeVertexNormals();
            if (forceMatte && c.material) {
              c.material.roughness = 1;
              c.material.metalness = 0;
            }
          });
          resolve(addModel(gltf.scene));
        },
        undefined,
        () => resolve(placeholderMoon())
      );
    } else {
      if (textureUrl) {
        new THREE.TextureLoader().load(textureUrl, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          moonMat.map = tex;
          moonMat.color.set(0xffffff);
          moonMat.needsUpdate = true;
        });
      }
      new OBJLoader().load(
        modelUrl,
        (obj) => {
          obj.traverse((c) => {
            if (!c.isMesh) return;
            if (!c.geometry.attributes.normal) c.geometry.computeVertexNormals();
            c.material = moonMat;
          });
          resolve(addModel(obj));
        },
        undefined,
        () => resolve(placeholderMoon())
      );
    }
  });

  // ---------- Fixed camera: moon centered, sized by `fill` ----------
  function fitCamera() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const tanV = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const tanFit = Math.min(tanV, tanV * camera.aspect) * fill;
    const dist = 1 / Math.sin(Math.atan(tanFit)); // moon radius is 1
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
  }
  fitCamera();

  const resizeObserver = new ResizeObserver(fitCamera);
  resizeObserver.observe(container);

  // ---------- Loop ----------
  const updaters = [];
  const clock = new THREE.Clock();

  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    if (state.autoRotate) moonPivot.rotation.y += state.rotationSpeed;
    stars.rotation.y += 0.00003; // very slow star drift
    updaters.forEach((fn) => fn(dt));
    renderer.render(scene, camera);
  });

  // ---------- Public API ----------
  return {
    scene,
    camera,
    renderer,
    moonPivot,
    ready,
    state,
    onUpdate(fn) {
      updaters.push(fn);
    },
    dispose() {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}