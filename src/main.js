import './styles.css';

import { createNameInputScene } from './scenes/nameInputScene.js';
import { createBriefingScene, revealFromBlack, createDialogueScene, createShuttleStage, blackoutScreen } from './scenes/dialogueScene.js';
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

// The three below are imported as whole modules, then pick()ed, so it works whatever
// you named their export (SURVEYOR3, INSIGHT, SOJOURNER ... or a default export).
import * as surveyor3Mod from '../entities/moon/surveyor3.js';
import * as insightMod from '../entities/mars/insight.js';
import * as sojournerMod from '../entities/mars/sojourner.js';
import { MOON_LOCATION, MOON_SIGNALS } from '../entities/moon/moonSignals.js';
import { MARS_LOCATION, MARS_SIGNALS } from '../entities/mars/marsSignals.js';

// default export, else the first exported object that looks like an entity (has a `glb` field)
const pick = (mod) =>
  mod.default ?? Object.values(mod).find((v) => v && typeof v === 'object' && v.glb);

const SURVEYOR3 = pick(surveyor3Mod);
const INSIGHT = pick(insightMod);
const SOJOURNER = pick(sojournerMod);

[['surveyor3', SURVEYOR3], ['insight', INSIGHT], ['sojourner', SOJOURNER]].forEach(([id, entity]) => {
  if (!entity) {
    console.warn(`Equipment "${id}": no entity found in its file (needs a default export or an object with a glb field).`);
  }
});

const planetContainer = document.getElementById('moon-container');
const query = new URLSearchParams(window.location.search);

// DEV SHORTCUTS
//   /?view=eagle      -> jump straight to the Eagle equipment page
//   /?view=lrv        -> jump straight to the Moon Buggy equipment page
//   /?view=surveyor3  -> jump straight to the Surveyor 3 equipment page
//   /?view=ingenuity  -> jump straight to the Ingenuity equipment page
//   /?view=insight    -> jump straight to the InSight equipment page
//   /?view=sojourner  -> jump straight to the Sojourner equipment page
//   /?phase=moon      -> jump to a phase (registration, briefing, moon, mars, equipment)
const view = query.get('view');
const VIEW_ENTITIES = {
  eagle: EAGLE,
  surveyor3: SURVEYOR3,
  lrv: LRV,
  sojourner: SOJOURNER,
  ingenuity: INGENUITY,
  insight: INSIGHT,
};
const requestedEntity = VIEW_ENTITIES[view] || EAGLE;
const requestedPhase = VIEW_ENTITIES[view]
  ? 'equipment'
  : query.get('phase') || query.get('planet');

// ---------------------------------------------------------------------------
// Equipment pages. The key MUST match `equipment.id` in the signals data
// (moonSignals.js / marsSignals.js):
//   Moon: eagle, surveyor3, lrv        Mars: sojourner, ingenuity, insight
// A signal whose id is missing falls back to the dev-shortcut entity (Eagle by default).
// ---------------------------------------------------------------------------
const ENTITIES = {
  // Moon
  eagle: EAGLE,
  surveyor3: SURVEYOR3,
  lrv: LRV,
  lrv1: LRV, // old id, kept so nothing breaks
  // Mars
  sojourner: SOJOURNER,
  ingenuity: INGENUITY,
  insight: INSIGHT,
  pathfinder: SOJOURNER,
};

// What the < / > pager walks through on each planet (same order as the signals).
const PLANET_EQUIPMENT = {
  moon: [EAGLE, SURVEYOR3, LRV].filter(Boolean),
  mars: [SOJOURNER, INGENUITY, INSIGHT].filter(Boolean),
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
        // "Inspect equipment" / "Open equipment": log it, then go to ITS page
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

      if (key === 'moon' && !moonToMarsDone && MOON_SIGNALS.every((s) => recovered.has(s.equipment.id))) {
        moonToMarsDone = true;
        setTimeout(() => playMoonToMars({ explorer, hud, controls, goTo, planet }), 900);
      }

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

/* Moon -> Mars transition */
const MARS_TRANSITION_SCRIPT = [
  {
    type: 'say',
    text: 'Space Commander {name}! Come in, mission control! Our Deep Space Network tracking shows you’ve successfully visited the Apollo 11 Lunar Module Eagle, Surveyor 3, and Apollo 15 Lunar Roving Vehicle (LRV-1). You’ve officially honored these silent pioneers, and your lunar mission is complete!',
  },
  {
    type: 'say',
    text: 'Hold on, Space Commander {name}, don’t head back to Earth just yet! We’ve just received an urgent directive from Mission Control. Your stellar work on the Moon proved you’re ready for a much bigger challenge.',
  },
  {
    type: 'ask',
    text: 'Deep across interplanetary space lies the Red Planet—Mars! There are iconic hardware heroes waiting to be discovered on its dusty plains. Re-board your vessel and set a direct course for Mars, we’ll transmit your exact mission targets as soon as you touch down!',
    acceptLabel: 'Set course for Mars',
    declineLabel: 'Hear it again',
  },
];

const SHUTTLE_OBJ_URLS = [
  '/assets/shuttle-fire.obj',
  '/assets/models/shuttle-fire.obj',
  '/assets/models/shuttle/shuttle-fire.obj',
  '/shuttle-fire.obj',
];

const PLANET_CONTAINER_CSS = 'width: 100vw; height: 100vh; position: relative; overflow: hidden; background: #000;';

const MARS_TRANSITION_CSS = `
  .planet-hud > * { transition: opacity .6s ease; }
  .planet-hud.mt-fade > *:not(.hud-top-right) { opacity: 0; pointer-events: none; }
  .planet-hud.mt-fade .hud-radar,
  .planet-hud.mt-fade [data-action="journal"] { opacity: 0; pointer-events: none; }
  .planet-hud.mt-fade .hud-top-right { pointer-events: auto; }
  .signal-layer { transition: opacity .6s ease; }
  .planet-hud::before, .planet-hud::after { transition: opacity .6s ease; }
  .planet-hud.mt-fade::before, .planet-hud.mt-fade::after { opacity: 0; }
  .signal-layer.mt-fade { opacity: 0; pointer-events: none; }
  .rm-canvas { position: fixed; inset: 0; width: 100%; height: 100%; display: block; z-index: 55; }
`;

let moonToMarsDone = false;

function ensureMarsTransitionStyles() {
  if (document.getElementById('mt-styles')) return;
  const s = document.createElement('style');
  s.id = 'mt-styles';
  s.textContent = MARS_TRANSITION_CSS;
  document.head.appendChild(s);
}

function playMoonToMars({ explorer, hud, controls, goTo, planet }) {
  ensureMarsTransitionStyles();
  controls.hold('transition');

  // 1. border UI fades out (Home stays)
  hud.el.classList.add('mt-fade');
  document.querySelector('.signal-layer')?.classList.add('mt-fade');

  // 2. the Moon recedes to the upper right, then the dialogue starts
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    runMarsDialogue({ explorer, goTo });
  };

  // safety net: start the dialogue even if the recede never resolves
  setTimeout(start, 3000);

  planet.recedeTo({ screenX: 0.75, screenY: 0.25, size: 0.3, depth: 1.7, dim: 0.3, duration: 1400 })
    .then(start)
    .catch((err) => {
      console.error('[recede] failed', err);
      start();
    });
}

function runMarsDialogueLEGACY({ explorer, goTo }) {
  ensureMarsTransitionStyles();
  controls.hold('transition');

  // 1. border UI fades out (Home stays)
  hud.el.classList.add('mt-fade');
  document.querySelector('.signal-layer')?.classList.add('mt-fade');

  // 2. the Moon recedes to the upper right (see step 9)

  // 3. mission control dialogue, starts once the Moon has settled
  let startedDialogue = false;
  const startDialogue = () => {
    if (startedDialogue) return;
    startedDialogue = true;
    runMarsDialogue();
  };
  setTimeout(startDialogue, 3000);
  try {
    planet.recedeTo({ screenX: 0.75, screenY: 0.25, size: 0.3, depth: 1.7, dim: 0.3, duration: 1400 }).then(startDialogue);
  } catch (err) {
    console.error('[recede] failed', err);
    startDialogue();
  }
}

function runMarsDialogue({ explorer, goTo }) {
  {
    let stage = null;
    const dlg = createDialogueScene(document.body, {
      explorer,
      config: { script: MARS_TRANSITION_SCRIPT, tasks: [] },
      onAccept: () => {
        // 4. rocket animation (placeholder: intro shuttle)
        dlg.root.style.transition = 'opacity .8s';
        dlg.root.style.opacity = '0';
        dlg.root.style.pointerEvents = 'none';
        stage = createShuttleStage(document.body, {
          objUrls: SHUTTLE_OBJ_URLS,
          onLoaded: () => {
            stage.launch();
            setTimeout(() => stage.depart(), 2400);
          },
          onError: (e) => console.error(e),
        });
        setTimeout(() => blackoutScreen(1400), 3800);

        // 5. fade into the Mars scene
        setTimeout(() => {
          dlg.dispose();
          stage?.dispose();
          goTo('mars');
          revealFromBlack(1400, 300);
        }, 5200);
      },
    });
  }
}

const introPhase = {
  enter({ goTo }) {
    return createBriefingScene(document.body, {
      stageContainer: planetContainer, // the 3D canvas goes in #moon-container
      // name screen shows after the zoom; done(explorer) continues to the dialogue
      registerExplorer: (done) =>
        createNameInputScene(document.getElementById('registration-overlay'), {
          transparent: true,
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
      // planet comes from where you clicked (state.planet), else from the entity itself
      const planetKey = (state.planet || entity.planet) === 'mars' ? 'mars' : 'moon';
      const entities = PLANET_EQUIPMENT[planetKey].includes(entity) ? PLANET_EQUIPMENT[planetKey] : [entity];
      if (state.entityId) recovered.add(state.entityId); // not for /?view= dev shortcuts
      return createEquipmentViewer(document.body, {
        entities, // the < / > pager walks through these
        entity,   // which one opens first
        explorer,
        config: {
          pager: { index: Math.max(entities.indexOf(entity), 0) + 1, total: entities.length },
          archive: { saved: recovered.size, total: TOTAL_MISSIONS },
        },
        onBack: () => goTo(planetKey),
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
