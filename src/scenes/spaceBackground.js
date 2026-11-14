// src/scenes/spaceBackground.js
// -----------------------------------------------------------------------------
// The same space background as the registration ID card scene: dark nebula +
// twinkling stars + soft mouse parallax. Own renderer, own loop, own dispose().
//
//   const bg = createSpaceBackground(someDiv);   // someDiv should be position:absolute/fixed, sized
//   bg.dispose();
// -----------------------------------------------------------------------------

import * as THREE from 'three';

const NEBULA_VERT = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
`;
const NEBULA_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), u.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.0; a *= 0.5; }
    return v;
  }
  void main(){
    vec2 p = vUv * 2.0 - 1.0;
    float n  = fbm(p * 1.4 + vec2(uTime * 0.008, -uTime * 0.006));
    float n2 = fbm(p * 2.8 - vec2(uTime * 0.012, 0.0));
    vec3 col = mix(uColorA, uColorB, n) * pow(n2, 2.4) * 0.8;
    float vignette = smoothstep(1.6, 0.25, length(p));
    gl_FragColor = vec4(col * vignette, 1.0);
  }
`;
const STAR_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vTwinkle;
  void main(){
    vTwinkle = 0.55 + 0.45 * sin(uTime * 1.4 + aPhase);
    gl_PointSize = aSize * uPixelRatio * vTwinkle;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const STAR_FRAG = /* glsl */ `
  varying float vTwinkle;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vTwinkle;
    gl_FragColor = vec4(vec3(0.85, 0.92, 1.0), a);
  }
`;

export function createSpaceBackground(container, options = {}) {
  const { starCountFar = 1600, starCountNear = 350, parallaxStrength = 0.4 } = options;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(0, 0, 6);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000);
  const canvas = renderer.domElement;
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
  container.appendChild(canvas);

  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };

  const nebulaMat = track(new THREE.ShaderMaterial({
    vertexShader: NEBULA_VERT, fragmentShader: NEBULA_FRAG,
    depthTest: false, depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color('#0a1a45') },
      uColorB: { value: new THREE.Color('#34195a') },
    },
  }));
  const nebula = new THREE.Mesh(track(new THREE.PlaneGeometry(2, 2)), nebulaMat);
  nebula.frustumCulled = false;
  nebula.renderOrder = -10;
  scene.add(nebula);

  function makeStars(count, rMin, rMax, sMin, sMax) {
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = rMin + Math.random() * (rMax - rMin);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi) - 10;
      size[i] = sMin + Math.random() * (sMax - sMin);
      phase[i] = Math.random() * Math.PI * 2;
    }
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    const mat = track(new THREE.ShaderMaterial({
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: pixelRatio } },
    }));
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    return points;
  }
  const farStars = makeStars(starCountFar, 40, 100, 1, 3);
  const nearStars = makeStars(starCountNear, 12, 30, 1.5, 4.5);

  const pointer = new THREE.Vector2();
  const targetPointer = new THREE.Vector2();
  const onPointerMove = (e) => {
    targetPointer.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  };
  window.addEventListener('pointermove', onPointerMove);

  function fit() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(fit);
  resizeObserver.observe(container);
  fit();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    const time = clock.elapsedTime;
    nebulaMat.uniforms.uTime.value = time;
    farStars.material.uniforms.uTime.value = time;
    nearStars.material.uniforms.uTime.value = time;
    pointer.lerp(targetPointer, 1 - Math.pow(0.001, dt));
    camera.position.set(pointer.x * parallaxStrength, pointer.y * parallaxStrength * 0.6, 6);
    camera.lookAt(0, 0, -4);
    farStars.rotation.y = time * 0.004;
    nearStars.rotation.y = time * 0.009;
    renderer.render(scene, camera);
  });

  return {
    dispose() {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      disposables.forEach((d) => d.dispose?.());
      renderer.dispose();
      canvas.remove();
    },
  };
}