import { createMoonScene } from './scenes/moonScene.js';
import { createMarsScene } from './scenes/marsScene.js';
import { setupPlanetRaycaster } from './interaction/raycaster.js';

const planetContainer = document.getElementById('moon-container');
const useMoon = new URLSearchParams(window.location.search).get('planet') === 'moon';

const planet = useMoon
  ? createMoonScene(planetContainer, {
    modelUrl: '/assets/models/moon/moon.glb',
    fill: 2.0,
    rotationSpeed: 0.0008,
  })
  : createMarsScene(planetContainer, {
    modelUrl: '/assets/models/mars/mars.glb',
    fill: 2.0,
    rotationSpeed: 0.0008,
  });

planet.ready.then(() => {
  console.log(`3D ${useMoon ? 'Moon' : 'Mars'} loaded and ready to explore!`);
});

setupPlanetRaycaster(planet, (targetObject) => {
  console.log('Target locked:', targetObject.name);
});