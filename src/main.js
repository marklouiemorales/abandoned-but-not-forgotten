import { createNameInputScene } from './scenes/nameInputScene.js';
import { createDialogueScene } from './scenes/dialogueScene.js';
import { createMoonScene } from './scenes/moonScene.js';
import { createMarsScene } from './scenes/marsScene.js';
import { createEquipmentViewer } from './scenes/equipmentViewerScene.js';
import { setupPlanetRaycaster } from './interaction/raycaster.js';
import { createGameState, GAME_PHASES } from './state/gameState.js';
import { EAGLE } from '../entities/moon/eagle.js';

const planetContainer = document.getElementById('moon-container');
const query = new URLSearchParams(window.location.search);
const requestedPhase = query.get('phase') || query.get('planet');
const preferredPlanet = query.get('planet') === 'moon' ? 'moon' : 'mars';

function startPlanet(explorer, forcePlanet) {
  const planetContainer = document.getElementById('moon-container');
  const useMoon = (forcePlanet || query.get('planet')) === 'moon';
  const targetPlanet = useMoon ? 'moon' : 'mars';
  const createScene = targetPlanet === 'moon' ? createMoonScene : createMarsScene;
  const modelUrl = targetPlanet === 'moon'
    ? '/assets/models/moon/moon.glb'
    : '/assets/models/mars/mars.glb';

  const planet = createScene(planetContainer, {
    modelUrl,
    fill: 2.0,
    rotationSpeed: 0.0008,
  });

  planet.ready.then(() => {
    console.log(`3D ${targetPlanet === 'moon' ? 'Moon' : 'Mars'} loaded and ready to explore!`, explorer);
  });

  const disposeRaycaster = setupPlanetRaycaster(planet, (targetObject) => {
    console.log('Target locked:', targetObject.name);
  });

  return { planet, disposeRaycaster };
}

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

// Equipment page: Apollo 11 Eagle (add public/assets/models/moon/eagle.glb to see the 3D model)
function startEagle(explorer) {
  const viewer = createEquipmentViewer(document.body, {
    entity: EAGLE,
    explorer,
    config: { pager: { index: 1, total: 3 }, archive: { saved: 1, total: 6 } },
    onBack: () => {
      viewer.dispose();
      startPlanet(explorer, 'moon');
    },
    onArchive: () => console.log('Open archive', explorer),
    onPrev: () => console.log('Previous equipment'),
    onNext: () => console.log('Next equipment'),
  });
}

// Spaceship comes right after the mission is accepted
function startSpaceship(explorer) {
  console.log('Mission accepted by:', explorer);
  startEagle(explorer);
}

// Dialogue: loading -> registration complete -> welcome -> briefing -> accept
function startDialogue(explorer) {
  const dialogue = createDialogueScene(document.body, {
    explorer,
    onAccept: (e) => {
      dialogue.dispose();
      startSpaceship(e);
      return { planet, disposeRaycaster };
    },
    exit({ scene }) {
      scene.disposeRaycaster();
      scene.planet.dispose();
    },
  });
}
// DEV SHORTCUT: open  http://localhost:5173/?view=eagle  to jump straight to the Eagle page
const view = new URLSearchParams(window.location.search).get('view');

if (view === 'eagle') {
  startEagle({ name: 'Commander', id: 'EX-0000', rank: 'Recruit' });
} else {
  const registration = createNameInputScene(
    document.getElementById('registration-overlay'),
    {
      onConfirm: (explorer) => {
        registration.dispose();
        startDialogue(explorer);
      },
    }
  );
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
