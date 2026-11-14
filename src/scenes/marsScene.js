import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export function createMarsScene(container, options = {}) {
  const {
    modelUrl = '/assets/models/mars/mars.glb',
    textureUrl = null,
    fill = 2.0,
    rotationSpeed = 0.0008,
    starsDim = 9000,
    starsMid = 2500,
    starsBright = 300,
    forceMatte = true,
    fov = 45,
  } = options;

  const state = { autoRotate: true, rotationSpeed };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 300);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000);
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const spriteCanvas = document.createElement('canvas');
  spriteCanvas.width = spriteCanvas.height = 64;
  const spriteContext = spriteCanvas.getContext('2d');
  const gradient = spriteContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  spriteContext.fillStyle = gradient;
  spriteContext.fillRect(0, 0, 64, 64);
  const starSprite = new THREE.CanvasTexture(spriteCanvas);

  const starPalette = [
    [0.72, 0.82, 1.0],
    [1.0, 1.0, 1.0],
    [1.0, 0.86, 0.7],
    [1.0, 0.68, 0.48],
  ];

  function starLayer({ count, size, minB, power }) {
    const radius = 120;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const horizontal = Math.sqrt(1 - u * u);
      positions.set([
        radius * horizontal * Math.cos(theta),
        radius * u,
        radius * horizontal * Math.sin(theta),
      ], i * 3);

      const brightness = minB + Math.pow(Math.random(), power) * (1 - minB);
      const colorChoice = Math.random();
      const color = colorChoice < 0.3 ? starPalette[0]
        : colorChoice < 0.75 ? starPalette[1]
          : colorChoice < 0.95 ? starPalette[2]
            : starPalette[3];
      colors.set(color.map((channel) => channel * brightness), i * 3);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(
      geometry,
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
    points.frustumCulled = false;
    return points;
  }

  const stars = new THREE.Group();
  stars.add(
    starLayer({ count: starsDim, size: 1.5, minB: 0.2, power: 2 }),
    starLayer({ count: starsMid, size: 2.4, minB: 0.35, power: 2 }),
    starLayer({ count: starsBright, size: 3.8, minB: 0.7, power: 1.2 })
  );
  scene.add(stars);

  const sun = new THREE.DirectionalLight(0xffdfc2, 3.2);
  sun.position.set(4, 2, 6);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x39251d, 0.8));

  const marsPivot = new THREE.Group();
  scene.add(marsPivot);
  const marsMaterial = new THREE.MeshStandardMaterial({
    color: 0xa84c32,
    roughness: 1,
    metalness: 0,
  });

  function addModel(object) {
    const bounds = new THREE.Box3().setFromObject(object);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    object.position.sub(sphere.center);
    const holder = new THREE.Group();
    holder.add(object);
    holder.scale.setScalar(1 / sphere.radius);
    marsPivot.add(holder);
    return holder;
  }

  function placeholderMars() {
    console.warn(`[marsScene] Could not load ${modelUrl} - showing placeholder Mars.`);
    const geometry = new THREE.IcosahedronGeometry(1, 60);
    const positions = geometry.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i).normalize();
      const terrain =
        Math.sin(vertex.x * 8.5) * Math.sin(vertex.y * 11) * Math.sin(vertex.z * 9) * 0.012 +
        Math.sin(vertex.x * 23 + vertex.z * 17) * 0.003;
      vertex.multiplyScalar(1 + terrain);
      positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    geometry.computeVertexNormals();
    return addModel(new THREE.Mesh(geometry, marsMaterial));
  }

  const extension = modelUrl.split('?')[0].split('.').pop().toLowerCase();
  const ready = new Promise((resolve) => {
    if (extension === 'glb' || extension === 'gltf') {
      new GLTFLoader().load(
        modelUrl,
        (gltf) => {
          gltf.scene.traverse((child) => {
            if (!child.isMesh) return;
            if (!child.geometry.attributes.normal) child.geometry.computeVertexNormals();
            if (forceMatte && child.material) {
              child.material.roughness = 1;
              child.material.metalness = 0;
            }
          });
          resolve(addModel(gltf.scene));
        },
        undefined,
        () => resolve(placeholderMars())
      );
    } else {
      if (textureUrl) {
        new THREE.TextureLoader().load(textureUrl, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          marsMaterial.map = texture;
          marsMaterial.color.set(0xffffff);
          marsMaterial.needsUpdate = true;
        });
      }
      new OBJLoader().load(
        modelUrl,
        (object) => {
          object.traverse((child) => {
            if (!child.isMesh) return;
            if (!child.geometry.attributes.normal) child.geometry.computeVertexNormals();
            child.material = marsMaterial;
          });
          resolve(addModel(object));
        },
        undefined,
        () => resolve(placeholderMars())
      );
    }
  });

  function fitCamera() {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const tanV = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const tanFit = Math.min(tanV, tanV * camera.aspect) * fill;
    const distance = 1 / Math.sin(Math.atan(tanFit));
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);
  }
  fitCamera();

  const resizeObserver = new ResizeObserver(fitCamera);
  resizeObserver.observe(container);

  const updaters = [];
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const deltaTime = clock.getDelta();
    if (state.autoRotate) marsPivot.rotation.y += state.rotationSpeed;
    stars.rotation.y += 0.00003;
    updaters.forEach((update) => update(deltaTime));
    renderer.render(scene, camera);
  });

  return {
    scene,
    camera,
    renderer,
    pivot: marsPivot,
    marsPivot,
    ready,
    state,
    onUpdate(update) {
      updaters.push(update);
    },
    dispose() {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => {
            if (material.map) material.map.dispose();
            material.dispose();
          });
        }
      });
      starSprite.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}