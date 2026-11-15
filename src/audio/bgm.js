// src/audio/bgm.js
// -----------------------------------------------------------------------------
// One background-music player for the whole game. Only one track plays at a time.
//   bgm.play(url, { volume, fadeInMs })  start a track (same url = keep playing)
//   bgm.stop(fadeMs)                     stop, optionally fading out
//   bgm.duck(true | false)               lower / restore volume (story audio)
// The equipment story also sends 'bgm:duck' and 'bgm:unduck' document events,
// so the viewer does not need to import this file.
// -----------------------------------------------------------------------------

const DEFAULT_VOLUME = 0.35;
const DUCK_RATIO = 0.35;      // while a story plays, music drops to 35% of its normal volume
const FADE_STEP_MS = 50;

let current = null;          // { url, audio, volume }
let ducked = false;
const fades = new WeakMap(); // audio -> interval id

function fadeTo(audio, to, ms, onDone) {
  clearInterval(fades.get(audio));
  if (!ms) {
    audio.volume = to;
    fades.delete(audio);
    onDone?.();
    return;
  }
  const from = audio.volume;
  const steps = Math.max(1, Math.round(ms / FADE_STEP_MS));
  let n = 0;
  const id = setInterval(() => {
    n++;
    audio.volume = Math.min(1, Math.max(0, from + (to - from) * (n / steps)));
    if (n >= steps) {
      clearInterval(id);
      fades.delete(audio);
      onDone?.();
    }
  }, ms / steps);
  fades.set(audio, id);
}

function targetVolume() {
  if (!current) return 0;
  return ducked ? current.volume * DUCK_RATIO : current.volume;
}

function play(url, { volume = DEFAULT_VOLUME, fadeInMs = 1200 } = {}) {
  if (current && current.url === url) return;       // already playing: keep going
  const old = current?.audio;
  if (old) fadeTo(old, 0, 800, () => old.pause());  // crossfade the old track out

  const audio = new Audio(url);
  audio.loop = true;
  audio.volume = 0;
  audio.addEventListener('error', () => console.warn('[bgm] could not load', url));
  current = { url, audio, volume };
  audio.play()
    .then(() => {
      if (current?.audio === audio) fadeTo(audio, targetVolume(), fadeInMs);
    })
    .catch((err) => {
      console.warn('[bgm] playback blocked:', err);
      if (current?.audio === audio) current = null;
    });
}

function stop(fadeMs = 0) {
  const old = current?.audio;
  current = null;
  ducked = false;
  if (!old) return;
  fadeTo(old, 0, fadeMs, () => old.pause());
}

function duck(on) {
  ducked = !!on;
  if (current) fadeTo(current.audio, targetVolume(), 400);
}

document.addEventListener('bgm:duck', () => duck(true));
document.addEventListener('bgm:unduck', () => duck(false));

export const bgm = { play, stop, duck };