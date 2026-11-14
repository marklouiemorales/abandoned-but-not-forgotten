import { createNameInputScene } from './scenes/nameInputScene.js';
import { createDialogueScene } from './scenes/dialogueScene.js';
import { createMoonScene } from './scenes/moonScene.js';
import { createMarsScene } from './scenes/marsScene.js';
import { createEquipmentViewer } from './scenes/equipmentViewerScene.js';
import { setupPlanetRaycaster } from './interaction/raycaster.js';
import { createGameState, GAME_PHASES } from './state/gameState.js';
import { EAGLE } from '../entities/moon/eagle.js';
import { LRV } from '../entities/moon/lrv.js';

const planetContainer = document.getElementById('moon-container');
const query = new URLSearchParams(window.location.search);

// DEV SHORTCUTS
//   /?view=eagle  -> jump straight to the Eagle equipment page
//   /?view=lrv    -> jump straight to the Moon Buggy equipment page
//   /?phase=moon  -> jump to a phase (registration, briefing, moon, mars, equipment)
const view = query.get('view');
const requestedEntity = view === 'lrv' ? LRV : EAGLE;
const requestedPhase =
  view === 'eagle' || view === 'lrv' ? 'equipment' : query.get('phase') || query.get('planet');

// The story starts on the Moon, so Moon is the default
const preferredPlanet = query.get('planet') === 'mars' ? 'mars' : 'moon';

function createPlanetPhase(createScene, label, modelUrl, onTarget) {
  return {
    enter({ state, goTo }) {
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
        onTarget?.(goTo);
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
        // Spaceship/launch phases don't exist yet, so go to the Moon for now
        onAccept: (explorer) => goTo('moon', { explorer }),
      });
    },
    exit({ scene }) {
      scene.dispose();
    },
  },
  equipment: {
    enter({ state, goTo }) {
      const explorer = state.explorer || { name: 'Commander', id: 'EX-0000', rank: 'Recruit' };
      return createEquipmentViewer(document.body, {
        entities: [EAGLE, LRV],           // the < / > pager walks through these
        entity: requestedEntity,          // which one opens first
        explorer,
        config: { pager: { index: 1, total: 3 }, archive: { saved: 1, total: 6 } },
        onBack: () => goTo('moon'),
        // no onArchive / onPrev / onNext: the viewer handles them itself
      });
    },
    exit({ scene }) {
      scene.dispose();
    },
  },
  moon: createPlanetPhase(createMoonScene, 'Moon', '/assets/models/moon/moon.glb', (goTo) =>
    goTo('equipment')
  ),
  mars: createPlanetPhase(createMarsScene, 'Mars', '/assets/models/mars/mars.glb'),
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