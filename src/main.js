import './styles.css';

import { createNameInputScene } from './scenes/nameInputScene.js';
import { createBriefingScene, revealFromBlack } from './scenes/dialogueScene.js';
import { createMoonScene } from './scenes/moonScene.js';
import { createPlanetHud } from './scenes/planetHud.js';
import { createMarsScene } from './scenes/marsScene.js';
import { createEquipmentViewer } from './scenes/equipmentViewerScene.js';
import { createEquipmentPanel } from './scenes/equipmentPanel.js';
import { createPlanetControls } from './interaction/planetControls.js';
import { createSignalMarkers } from './interaction/planetSignalMarkers.js';
import { createGameState, GAME_PHASES } from './state/gameState.js';

// entities/ sits next to src/
import { EAGLE } from '../entities/moon/eagle.js';
import { LRV } from '../entities/moon/lrv.js';
import { INGENUITY } from '../entities/mars/ingenuity.js';
import { MOON_LOCATION, MOON_SIGNALS } from '../entities/moon/moonSignals.js';
import { MARS_LOCATION, MARS_SIGNALS } from '../entities/mars/marsSignals.js';

const planetContainer = document.getElementById('moon-container');
const query = new URLSearchParams(window.location.search);

// DEV SHORTCUTS
//   /?view=eagle      -> jump straight to the Eagle equipment page
//   /?view=lrv        -> jump straight to the Moon Buggy equipment page
//   /?view=ingenuity  -> jump straight to the Ingenuity equipment page
//   /?phase=moon      -> jump to a phase (registration, briefing, moon, mars, equipment)
const view = query.get('view');
const VIEW_ENTITIES = { eagle: EAGLE, lrv: LRV, ingenuity: INGENUITY };
const requestedEntity = VIEW_ENTITIES[view] || EAGLE;
const requestedPhase = VIEW_ENTITIES[view]
  ? 'equipment'
  : query.get('phase') || query.get('planet');

// ---------------------------------------------------------------------------
// Equipment pages. The key MUST match `equipment.id` in the signals data
// (moonSignals.js / marsSignals.js). If your ids are different, rename the key here.
// A signal whose id is missing falls back to the dev-shortcut entity (Eagle by default).
// ---------------------------------------------------------------------------
const ENTITIES = {
  eagle: EAGLE,
  lrv1: LRV,
  lrv: LRV,
  ingenuity: INGENUITY,
  // surveyor3: SURVEYOR3,
  // 'mars-equipment-2': MARS_TWO,
};

// What the < / > pager walks through on each planet. Add new equipment here as you write it.
const PLANET_EQUIPMENT = {
  moon: [EAGLE, LRV],
  mars: [INGENUITY],
};

const TOTAL_MISSIONS = 6;      // 3 Moon + 3 Mars
const recovered = new Set();   // equipment ids already inspected (kept across planet <-> equipment trips)

function createPlanetPhase({ key, createScene, label, modelUrl, location, signals }) {
  return {
    enter({ state, goTo }) {
      const explorer = state.explorer || { name: 'Commander', id: 'EX-0000', rank: 'Recruit' };

      const planet = createScene(planetContainer, {
        modelUrl,
        fill: 2.0,
        rotationSpeed: 0.0008,
      });
      planet.ready.then(() => console.log(`3D ${label} loaded and ready to explore!`, explorer));

      // Equipment found on the OTHER planet counts toward the global total
      const thisPlanetIds = new Set(signals.map((s) => s.equipment.id));
      const baseFound = [...recovered].filter((id) => !thisPlanetIds.has(id)).length;

      let hud;
      const controls = createPlanetControls(planet, {
        onDragStart: () => hud?.hideHint(),
      });

      hud = createPlanetHud(document.body, {
        explorer,
        location,
        signals,
        totalMissions: TOTAL_MISSIONS,
        baseFound,
        onHome: () => goTo('registration'),
        onJournal: () => console.log('Open journal'),
      });

      let markers;
      const panel = createEquipmentPanel(document.body, {
        // "Inspect equipment" / "Open equipment": log it, then go to its page
        onOpen: (signal) => {
          recovered.add(signal.equipment.id);
          goTo('equipment', { explorer, planet: key, entityId: signal.equipment.id });
        },
        // closed without opening: hand the planet back to the user
        onClose: () => {
          markers.resume();
          hud.dim(false);
        },
      });

      markers = createSignalMarkers(planet, document.body, signals, {
        controls,
        onSelect: (signal, markerEl) => {
          hud.dim(true);
          panel.open(signal, markerEl, { found: recovered.has(signal.equipment.id) });
        },
      });

      // Restore progress when coming back from an equipment page
      signals.forEach((s) => {
        if (recovered.has(s.equipment.id)) {
          markers.markFound(s.id, s.equipment.name);
          hud.markFound(s.id, s.equipment.name);
        }
      });

      return { planet, controls, hud, markers, panel };
    },
    exit({ scene }) {
      scene.panel.dispose();
      scene.markers.dispose();
      scene.hud.dispose();
      scene.controls.dispose();
      scene.planet.dispose();
    },
  };
}

const introPhase = {
  enter({ goTo }) {
    return createBriefingScene(document.body, {
      stageContainer: planetContainer,          // the 3D canvas goes in #moon-container
      // name screen shows after the zoom; done(explorer) continues to the dialogue
      registerExplorer: (done) =>
        createNameInputScene(document.getElementById('registration-overlay'), {
          onConfirm: (explorer) => done(explorer),
        }),
      onEnd: (explorer) => {
        // screen is fully black here: build the Moon, then fade the black away
        goTo('moon', { explorer });
        revealFromBlack(1400, 400);
      },
    });
  },
  exit({ scene }) {
    scene.dispose();
  },
};

const phases = {
  // Ship intro ("Start journey") -> zoom on the cockpit -> explorer name -> dialogue
  // -> accept -> the ship launches -> fade to black -> Moon.
  registration: introPhase,
  briefing: introPhase,
  equipment: {
    enter({ state, goTo }) {
      const explorer = state.explorer || { name: 'Commander', id: 'EX-0000', rank: 'Recruit' };
      const entity = ENTITIES[state.entityId] || requestedEntity;
      const entities = PLANET_EQUIPMENT[entity.planet] || [entity];
      const backTo = (state.planet || entity.planet) === 'mars' ? 'mars' : 'moon';
      return createEquipmentViewer(document.body, {
        entities,                          // the < / > pager walks through these
        entity,                            // which one opens first
        explorer,
        config: {
          pager: { index: 1, total: 3 },   // 3 equipment per planet
          archive: { saved: recovered.size, total: TOTAL_MISSIONS },
        },
        onBack: () => goTo(backTo),
        // no onArchive / onPrev / onNext: the viewer handles them itself
      });
    },
    exit({ scene }) {
      scene.dispose();
    },
  },
  moon: createPlanetPhase({
    key: 'moon',
    createScene: createMoonScene,
    label: 'Moon',
    modelUrl: '/assets/models/moon/moon.glb',
    location: MOON_LOCATION,
    signals: MOON_SIGNALS,
  }),
  mars: createPlanetPhase({
    key: 'mars',
    createScene: createMarsScene,
    label: 'Mars',
    modelUrl: '/assets/models/mars/mars.glb',
    location: MARS_LOCATION,
    signals: MARS_SIGNALS,
  }),
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