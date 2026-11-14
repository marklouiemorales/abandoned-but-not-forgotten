import { createNameInputScene } from './scenes/nameInputScene.js';
import { createDialogueScene } from './scenes/dialogueScene.js';
import { createMoonScene } from './scenes/moonScene.js';
import { createMarsScene } from './scenes/marsScene.js';
import { setupPlanetRaycaster } from './interaction/raycaster.js';

// Planet code, now wrapped so it only runs when you call it (before, it ran at page load)
function startPlanet(explorer) {
  const planetContainer = document.getElementById('moon-container');
  const useMoon = new URLSearchParams(window.location.search).get('planet') === 'moon';

  const planet = useMoon
    ? createMoonScene(planetContainer, { modelUrl: '/assets/models/moon/moon.glb', fill: 2.0, rotationSpeed: 0.0008 })
    : createMarsScene(planetContainer, { modelUrl: '/assets/models/mars/mars.glb', fill: 2.0, rotationSpeed: 0.0008 });

  planet.ready.then(() => {
    console.log(`3D ${useMoon ? 'Moon' : 'Mars'} loaded and ready to explore!`, explorer);
  });

  setupPlanetRaycaster(planet, (targetObject) => {
    console.log('Target locked:', targetObject.name);
  });
}

// Spaceship comes right after the mission is accepted
function startSpaceship(explorer) {
  console.log('Mission accepted by:', explorer); // { name, id, rank, issued }
  // TODO: createSpaceshipScene(document.getElementById('spaceship-container'), { modelUrl: '/assets/models/spaceship.glb' });
  startPlanet(explorer); // temporary: remove once the spaceship scene exists
}

// Dialogue: loading -> registration complete -> welcome -> briefing -> accept
function startDialogue(explorer) {
  const dialogue = createDialogueScene(document.body, {
    explorer,
    onAccept: (e) => {
      dialogue.dispose();
      startSpaceship(e);
    },
  });
}

// Registration comes first
const registration = createNameInputScene(
  document.getElementById('registration-overlay'),
  {
    onConfirm: (explorer) => {
      registration.dispose();
      startDialogue(explorer);
    },
  }
);