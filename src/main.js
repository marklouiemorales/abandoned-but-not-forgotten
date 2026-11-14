import { createNameInputScene } from './scenes/nameInputScene.js';
import { createDialogueScene } from './scenes/dialogueScene.js';
import { createMoonScene } from './scenes/moonScene.js';
import { createMarsScene } from './scenes/marsScene.js';
import { setupPlanetRaycaster } from './interaction/raycaster.js';
import { createGameState, GAME_PHASES } from './state/gameState.js';

const planetContainer = document.getElementById('moon-container');
const query = new URLSearchParams(window.location.search);
const requestedPhase = query.get('phase') || query.get('planet');
const preferredPlanet = query.get('planet') === 'moon' ? 'moon' : 'mars';

function createPlanetPhase(createScene, label, modelUrl) {
  return {
    enter({ state }) {
      const planet = createScene(planetContainer, {
        modelUrl,
        fill: 2.0,
        rotationSpeed: 0.0008,
      });

      planet.ready.then(() => {
        console.log(`3D ${label} loaded and ready to explore!`, state.explorer);
      });

      const disposeRaycaster = setupPlanetRaycaster(planet, (targetObject) => {
        console.log('Target locked:', targetObject.name);
      });

      return { planet, disposeRaycaster };
    },
    exit({ scene }) {
      scene.disposeRaycaster();
      scene.planet.dispose();
    },
  };
}

const phases = {
  registration: {
    enter({ goTo }) {
      return createNameInputScene(
        document.getElementById('registration-overlay'),
        {
          onConfirm: (explorer) => goTo('briefing', { explorer }),
        }
      );
    },
    exit({ scene }) {
      scene.dispose();
    },
  },
  briefing: {
    enter({ state, goTo }) {
      return createDialogueScene(document.body, {
        explorer: state.explorer,
        onAccept: (explorer) => goTo(preferredPlanet, { explorer }),
      });
    },
    exit({ scene }) {
      scene.dispose();
    },
  },
  moon: createPlanetPhase(
    createMoonScene,
    'Moon',
    '/assets/models/moon/moon.glb'
  ),
  mars: createPlanetPhase(
    createMarsScene,
    'Mars',
    '/assets/models/mars/mars.glb'
  ),
};

const game = createGameState(phases);
const startPhase = requestedPhase || 'registration';

if (requestedPhase && !Object.prototype.hasOwnProperty.call(phases, startPhase)) {
  const knownPhase = GAME_PHASES.includes(startPhase);
  console.warn(
    knownPhase
      ? `The "${startPhase}" phase does not have a scene yet; starting registration.`
      : `Unknown game phase "${startPhase}"; starting registration.`
  );
  game.goTo('registration');
} else {
  game.goTo(startPhase);
}