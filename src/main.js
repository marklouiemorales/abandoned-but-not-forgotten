import { createNameInputScene } from './scenes/nameInputScene.js';
import { createDialogueScene } from './scenes/dialogueScene.js';
import { createMoonScene } from './scenes/moonScene.js';
import { createMarsScene } from './scenes/marsScene.js';
import { createEquipmentViewer } from './scenes/equipmentViewerScene.js';
import { setupPlanetRaycaster } from './interaction/raycaster.js';
import { EAGLE } from '../entities/moon/eagle.js';

// Planet code, wrapped so it only runs when you call it
function startPlanet(explorer, forcePlanet) {
  const planetContainer = document.getElementById('moon-container');
  const useMoon = (forcePlanet || new URLSearchParams(window.location.search).get('planet')) === 'moon';

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

// Equipment page: Apollo 11 Eagle (add public/assets/models/moon/eagle.glb to see the 3D model)
function startEagle(explorer) {
  const viewer = createEquipmentViewer(document.body, {
    entity: EAGLE,
    explorer, // fills {name} in Eagle's story
    config: { pager: { index: 1, total: 3 }, archive: { saved: 1, total: 6 } },
    onBack: () => {
      viewer.dispose();
      startPlanet(explorer, 'moon'); // back from the Eagle page = the Moon
    },
    onArchive: () => console.log('Open archive', explorer),
    onPrev: () => console.log('Previous equipment'),
    onNext: () => console.log('Next equipment'),
  });
}

// Spaceship comes right after the mission is accepted
function startSpaceship(explorer) {
  console.log('Mission accepted by:', explorer); // { name, id, rank, issued }
  // TODO: createSpaceshipScene(document.getElementById('spaceship-container'), { modelUrl: '/assets/models/spaceship.glb' });
  startEagle(explorer); // temporary: goes straight to the first Moon equipment (Eagle). Later: spaceship -> Moon -> Eagle
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

// DEV SHORTCUT: open  http://localhost:5173/?view=eagle  to jump straight to the Eagle page
const view = new URLSearchParams(window.location.search).get('view');

if (view === 'eagle') {
  startEagle({ name: 'Commander', id: 'EX-0000', rank: 'Recruit' }); // fake explorer for testing
} else {
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
}