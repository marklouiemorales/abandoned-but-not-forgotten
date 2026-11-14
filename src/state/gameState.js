export const GAME_PHASES = Object.freeze([
  'registration',
  'briefing',
  'spaceship',
  'launch',
  'moon',
  'transit',
  'marsLanding',
  'mars',
  'return',
  'certificate',
]);

export function createGameState(phases) {
  const state = {
    explorer: null,
    phase: null,
    discovered: new Set(),
  };

  let activePhase = null;
  let activeScene = null;

  function exitActivePhase() {
    const previousPhase = activePhase;
    const previousScene = activeScene;
    activePhase = null;
    activeScene = null;
    previousPhase?.exit?.({ state, scene: previousScene });
  }

  function goTo(phase, context = {}) {
    const nextPhase = phases[phase];
    if (!GAME_PHASES.includes(phase) || !nextPhase) {
      throw new Error(`Game phase "${phase}" is not available.`);
    }

    exitActivePhase();
    if (Object.prototype.hasOwnProperty.call(context, 'explorer')) {
      state.explorer = context.explorer;
    }

    state.phase = phase;
    try {
      activeScene = nextPhase.enter({ ...context, state, goTo });
      activePhase = nextPhase;
    } catch (error) {
      state.phase = null;
      throw error;
    }
  }

  function dispose() {
    exitActivePhase();
    state.phase = null;
  }

  return { state, goTo, dispose };
}
