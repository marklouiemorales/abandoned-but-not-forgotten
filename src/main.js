import './styles.css';

import { createNameInputScene } from './scenes/nameInputScene.js';
import { createBriefingScene, revealFromBlack, createDialogueScene, createShuttleStage, blackoutScreen, DIALOGUE_CONFIG } from './scenes/dialogueScene.js';
import { createMoonScene } from './scenes/moonScene.js';
import { createPlanetHud } from './scenes/planetHud.js';
import { createMarsScene } from './scenes/marsScene.js';
import { createEquipmentViewer } from './scenes/equipmentViewerScene.js';
import { createEquipmentPanel } from './scenes/equipmentPanel.js';
import { createEndingScene } from './scenes/endingScene.js';
import { createCertificate } from './scenes/certificateModal.js';
import { createPlanetControls } from './interaction/planetControls.js';
import { createSignalMarkers } from './interaction/planetSignalMarkers.js';
import { createGameState, GAME_PHASES } from './state/gameState.js';
import { MARS_ENDING_PART_1, MARS_ENDING_PART_2, MARS_ENDING_PART_3 } from './scenes/marsEndingScript.js';
import { checkAudio } from './interaction/audioCheck.js';

// entities/ sits next to src/
import { EAGLE } from '../entities/moon/eagle.js';
import { LRV } from '../entities/moon/lrv.js';
import { INGENUITY } from '../entities/mars/ingenuity.js';

// The three below are imported as whole modules, then pick()ed, so it works whatever
// you named their export (SURVEYOR3, INSIGHT, NEAR_SHOEMAKER ... or a default export).
import * as surveyor3Mod from '../entities/moon/surveyor3.js';
import * as insightMod from '../entities/mars/insight.js';
import * as nearShoemakerMod from '../entities/mars/nearShoemaker.js';
import { MOON_LOCATION, MOON_SIGNALS } from '../entities/moon/moonSignals.js';
import { MARS_LOCATION, MARS_SIGNALS } from '../entities/mars/marsSignals.js';

// default export, else the first exported object that looks like an entity (has a `glb` field)
const pick = (mod) =>
  mod.default ?? Object.values(mod).find((v) => v && typeof v === 'object' && v.glb);

const SURVEYOR3 = pick(surveyor3Mod);
const INSIGHT = pick(insightMod);
const NEAR_SHOEMAKER = pick(nearShoemakerMod);

[['surveyor3', SURVEYOR3], ['insight', INSIGHT], ['nearShoemaker', NEAR_SHOEMAKER]].forEach(([id, entity]) => {
  if (!entity) {
    console.warn(`Equipment "${id}": no entity found in its file (needs a default export or an object with a glb field).`);
  }
});

const planetContainer = document.getElementById('moon-container');
const query = new URLSearchParams(window.location.search);

// DEV SHORTCUTS
//   /?view=eagle         -> jump straight to the Eagle equipment page
//   /?view=lrv           -> jump straight to the Moon Buggy equipment page
//   /?view=surveyor3     -> jump straight to the Surveyor 3 equipment page
//   /?view=ingenuity     -> jump straight to the Ingenuity equipment page
//   /?view=insight       -> jump straight to the InSight equipment page
//   /?view=nearShoemaker -> jump straight to the NEAR Shoemaker equipment page
//   /?phase=moon         -> jump to a phase (registration, briefing, moon, mars, equipment, ending)
const view = query.get('view');
const VIEW_ENTITIES = {
  eagle: EAGLE,
  surveyor3: SURVEYOR3,
  lrv: LRV,
  sojourner: NEAR_SHOEMAKER,
  nearShoemaker: NEAR_SHOEMAKER,
  'near-shoemaker': NEAR_SHOEMAKER,
  shoemaker: NEAR_SHOEMAKER,
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
//   Moon: eagle, surveyor3, lrv        Mars: nearShoemaker (or shoemaker/sojourner), ingenuity, insight
// A signal whose id is missing falls back to the dev-shortcut entity (Eagle by default).
// ---------------------------------------------------------------------------
const ENTITIES = {
  // Moon
  eagle: EAGLE,
  surveyor3: SURVEYOR3,
  lrv: LRV,
  lrv1: LRV, // old id, kept so nothing breaks
  // Mars
  sojourner: NEAR_SHOEMAKER,
  nearShoemaker: NEAR_SHOEMAKER,
  'near-shoemaker': NEAR_SHOEMAKER,
  shoemaker: NEAR_SHOEMAKER,
  ingenuity: INGENUITY,
  insight: INSIGHT,
  pathfinder: NEAR_SHOEMAKER,
};

// What the < / > pager walks through on each planet (same order as the signals).
const PLANET_EQUIPMENT = {
  moon: [EAGLE, SURVEYOR3, LRV].filter(Boolean),
  mars: [NEAR_SHOEMAKER, INGENUITY, INSIGHT].filter(Boolean),
};

const TOTAL_MISSIONS = 6;      // 3 Moon + 3 Mars
const recovered = new Set();   // equipment ids already inspected (kept across planet <-> equipment trips)

function createPlanetPhase({ key, createScene, label, modelUrl, location, signals }) {
  return {
    enter({ state, goTo }) {
      const explorer = state.explorer || { name: 'Commander', id: 'EX-0000', rank: 'Recruit' };

      const planet = createScene(planetContainer, {
        modelUrl,
        fill: 1.5,
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

      // Every Mars signal inspected -> the ending
      if (key === 'mars' && !marsToEndingDone && MARS_SIGNALS.every((s) => recovered.has(s.equipment.id))) {
        marsToEndingDone = true;
        setTimeout(() => playMarsToEnding({ explorer, hud, controls, goTo, planet }), 900);
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
    audio: '/assets/audio/Moon_to_Mars-1.mp3',
  },
  {
    type: 'say',
    text: 'Hold on, Space Commander {name}, don’t head back to Earth just yet! We’ve just received an urgent directive from Mission Control. Your stellar work on the Moon proved you’re ready for a much bigger challenge.',
    audio: '/assets/audio/Moon_to_Mars-2.mp3',
  },
  {
    type: 'ask',
    text: 'Deep across interplanetary space lies the Red Planet—Mars! There are iconic hardware heroes waiting to be discovered on its dusty plains. Re-board your vessel and set a direct course for Mars, we’ll transmit your exact mission targets as soon as you touch down!',
    audio: '/assets/audio/Moon_to_Mars-3.mp3',
    acceptLabel: 'Set course for Mars',
    declineLabel: 'Hear it again',
  },
];

const SHUTTLE_OBJ_URLS = [
  '/assets/shuttle-fire.obj',
  '/models/shuttle-fire.obj',
  '/models/shuttle/shuttle-fire.obj',
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
let marsToEndingDone = false;

function ensureMarsTransitionStyles() {
  if (document.getElementById('mt-styles')) return;
  const s = document.createElement('style');
  s.id = 'mt-styles';
  s.textContent = MARS_TRANSITION_CSS;
  document.head.appendChild(s);
}

/* Mars -> Ending: fade the HUD, Mars recedes to the upper right (same look as the
   Moon -> Mars dialogue), mission control dialogue + two certificates,
   then black, then the shuttle + credits */
function playMarsToEnding({ explorer, hud, controls, goTo, planet }) {
  ensureMarsTransitionStyles();
  controls.hold('transition');
  hud.el.classList.add('mt-fade');
  document.querySelector('.signal-layer')?.classList.add('mt-fade');

  // run one dialogue part, call next() when the player presses the button.
  // certText = shows the "Certificate processing" screen after the button;
  // without it the part ends instantly (used for the last thank-you part).
  const runPart = (script, next, certText) => {
    const dlg = createDialogueScene(document.body, {
      explorer,
      config: certText
        ? { script, tasks: [], text: certText }
        : { script, tasks: [], instantAccept: true },
      onAccept: () => {
        dlg.root.style.display = 'none';
        dlg.dispose();
        next();
      },
    });
  };

  const PIONEER_PROCESSING = { accepted: 'Certificate processing', acceptedSub: 'Preparing your Lunar & Mars Pioneer Certificate' };
  const KEEPER_PROCESSING = { accepted: 'Certificate processing', acceptedSub: 'Preparing your Ultimate Space History Keeper honor' };

  const showCert = (variant, next) =>
    createCertificate(document.body, { variant, explorer, onClose: next });

  const FADE_MS = 1400;
  const finish = () => {
    blackoutScreen(FADE_MS);          // fade dialogue + Mars to black
    setTimeout(() => {                // screen is fully black now
      goTo('ending', { explorer });   // swap scenes behind the black
      document.getElementById('rm-blackout')?.remove();
    }, FADE_MS + 50);
  };

  const startDialogue = () => {
    // Part 1 -> Pioneer cert -> Part 2 -> Keeper cert -> Part 3 -> ending
    runPart(MARS_ENDING_PART_1, () =>
      showCert('pioneer', () =>
        runPart(MARS_ENDING_PART_2, () =>
          showCert('keeper', () =>
            runPart(MARS_ENDING_PART_3, finish)), KEEPER_PROCESSING)), PIONEER_PROCESSING);
  };

  // Mars recedes to the upper right, then the dialogue starts
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    startDialogue();
  };
  setTimeout(start, 3000); // safety net if the recede never resolves

  planet.recedeTo({ screenX: 0.75, screenY: 0.25, size: 0.3, depth: 1.7, dim: 0.3, duration: 1400 })
    .then(start)
    .catch((err) => {
      console.error('[recede] failed', err);
      start();
    });
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

function runMarsDialogue({ explorer, goTo }) {
  let stage = null;
  const dlg = createDialogueScene(document.body, {
    explorer,
    config: { script: MARS_TRANSITION_SCRIPT, tasks: [] },
    onAccept: () => {
      const FADE_MS = 1400;

      // fade to black, run the swap while fully black
      const cover = (swap) => {
        blackoutScreen(FADE_MS);
        setTimeout(swap, FADE_MS);
      };

      // rocket -> Mars: cover, swap scenes, reveal Mars
      const toMars = () => cover(() => {
        stage?.dispose();
        goTo('mars');
        revealFromBlack(FADE_MS, 300);
      });

      dlg.root.style.pointerEvents = 'none';

      // 1. cover the dialogue, then swap it for the rocket
      cover(() => {
        dlg.dispose();
        stage = createShuttleStage(document.body, {
          objUrls: SHUTTLE_OBJ_URLS,
          onLoaded: () => {
            // 2. rocket fades in from black
            revealFromBlack(FADE_MS);

            // 3. launch once the reveal is done
            setTimeout(() => {
              stage.launch();
              setTimeout(() => stage.depart(), 2400);
              setTimeout(toMars, 3400);
            }, FADE_MS);
          },
          onError: (e) => {
            // no rocket model: still fade in, then continue to Mars
            console.error(e);
            revealFromBlack(FADE_MS);
            setTimeout(toMars, FADE_MS);
          },
        });
      });
    },
  });
}

/* ---------- Start-scene background music ----------
   Starts on "Start journey" (browsers only allow audio started by a click),
   plays through the name screen and mission briefing, fades out when the
   mission is accepted, and is gone before the Moon scene loads. */
const START_MUSIC_URL = '/assets/audio/Start_Scene.mp3';
const START_MUSIC_VOLUME = 0.35;
const START_MUSIC_FADE_MS = 2200;   // matches the ship's departure fade

let startMusic = null;

function stopStartMusic(fadeMs = 0) {
  const a = startMusic;
  startMusic = null;
  if (!a) return;
  if (!fadeMs) { a.pause(); return; }
  const from = a.volume;
  const steps = Math.max(1, Math.round(fadeMs / 50));
  let n = 0;
  const id = setInterval(() => {
    n++;
    a.volume = Math.max(0, from * (1 - n / steps));
    if (n >= steps) { clearInterval(id); a.pause(); }
  }, fadeMs / steps);
}

function playStartMusic() {
  stopStartMusic(0);
  const a = new Audio(START_MUSIC_URL);
  a.loop = true;
  a.volume = START_MUSIC_VOLUME;
  a.addEventListener('error', () => console.warn('[music] could not load', START_MUSIC_URL));
  startMusic = a;
  a.play().catch((err) => console.warn('[music] playback blocked:', err));
}

const introPhase = {
  enter({ goTo }) {
    const onLaunch = () => playStartMusic();                          // "Start journey" clicked
    const onDepart = () => stopStartMusic(START_MUSIC_FADE_MS);       // mission accepted, ship leaves
    document.addEventListener('remember-me:launch', onLaunch);
    document.addEventListener('remember-me:depart', onDepart);

    const briefing = createBriefingScene(document.body, {
      stageContainer: planetContainer,
      // name screen shows after the zoom; done(explorer) continues to the dialogue
      registerExplorer: (done) =>
        createNameInputScene(document.getElementById('registration-overlay'), {
          transparent: true,
          onConfirm: (explorer) => done(explorer),
        }),
      onEnd: (explorer) => {
        // screen is fully black here: build the Moon, then fade the black away
        stopStartMusic(0); goTo('moon', { explorer });
        revealFromBlack(1400, 400);
      },
    });

    return {
      ...briefing,
      dispose() {
        document.removeEventListener('remember-me:launch', onLaunch);
        document.removeEventListener('remember-me:depart', onDepart);
        stopStartMusic(0);            // safety: never let it leak into the Moon scene
        briefing.dispose();
      },
    };
  },
  exit({ scene }) {
    scene.dispose();
  },
};

// Ending: shuttle launch/departure loop + credits + closing tagline.
// The .obj lives in public/assets/shuttle-fire.obj  ->  served at /assets/shuttle-fire.obj
const endingPhase = {
  enter({ state, goTo }) {
    const explorer = state.explorer || { name: 'Commander', id: 'EX-0000', rank: 'Recruit' };
    return createEndingScene(document.body, {
      explorer,
      objUrl: '/assets/shuttle-fire.obj',
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
    enter({ state, goTo, planet, entityId }) {
      const explorer = state.explorer || { name: 'Commander', id: 'EX-0000', rank: 'Recruit' };
      const entity = ENTITIES[entityId] || requestedEntity;
      // planet comes from where you clicked (context.planet), else from the entity itself
      const planetKey = (planet || entity.planet) === 'mars' ? 'mars' : 'moon';
      const entities = PLANET_EQUIPMENT[planetKey].includes(entity) ? PLANET_EQUIPMENT[planetKey] : [entity];
      if (entityId) recovered.add(entityId); // not for /?view= dev shortcuts
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
    modelUrl: '/models/moon/moon.glb',
    location: MOON_LOCATION,
    signals: MOON_SIGNALS,
  }),
  mars: createPlanetPhase({
    key: 'mars',
    createScene: createMarsScene,
    label: 'Mars',
    modelUrl: '/models/mars/mars.glb',
    location: MARS_LOCATION,
    signals: MARS_SIGNALS,
  }),
  ending: endingPhase,
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

// Temporary audio check (safe to run here after all entities and scripts are initialized)
checkAudio(
  DIALOGUE_CONFIG,
  MARS_TRANSITION_SCRIPT,
  MARS_ENDING_PART_1,
  MARS_ENDING_PART_2,
  MARS_ENDING_PART_3,
  EAGLE,
  LRV,
  SURVEYOR3,
  INSIGHT,
  INGENUITY,
  NEAR_SHOEMAKER
);
