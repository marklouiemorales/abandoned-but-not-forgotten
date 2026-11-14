import { createNameInputScene } from './scenes/nameInputScene.js';
import { createMoonScene } from './scenes/moonScene.js';
import { setupMoonRaycaster } from './interaction/raycaster.js';

// Your existing moon code, now wrapped so it starts AFTER registration
function startMoon(explorer) {
  console.log('Explorer registered:', explorer); // { name, id, rank, issued }

  const moonContainer = document.getElementById('moon-container');

  const moon = createMoonScene(moonContainer, {
    modelUrl: '/assets/models/moon/moon.glb',
    fill: 2.0,
    rotationSpeed: 0.0008,
  });

  moon.ready.then(() => {
    console.log('3D Moon loaded. Ready to position Lunar hardware!');
  });

  setupMoonRaycaster(moon, (targetObject) => {
    console.log('Target locked:', targetObject.name);
  });
}

// Registration comes first
const registration = createNameInputScene(
  document.getElementById('registration-overlay'),
  {
    onConfirm: (explorer) => {
      registration.dispose();
      startMoon(explorer);
    },
  }
);