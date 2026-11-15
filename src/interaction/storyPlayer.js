// src/utils/storyPlayer.js
// -----------------------------------------------------------------------------
// Plays an equipment's monologue ("Read story") line by line:
//   1. the sound effect (sfx) plays first, no text yet
//   2. the voice (audio) starts and the text is typed AT THE SAME TIME,
//      at a speed that makes the text finish together with the voice
//   3. a short pause, then the next line
//
// Works for every equipment (Eagle, InSight, ...). Missing audio files are
// skipped, so the text still works without any mp3.
//
// Usage:
//   import { playStory, stopStory } from '../utils/storyPlayer.js';
//
//   readStoryBtn.addEventListener('click', () => {
//     playStory(EAGLE.monologue, {
//       playerName,                 // replaces {name} in the text
//       textEl: storyTextEl,        // the element the text is typed into
//       onLine: (line, text, timing, index) => {},   // optional (speaker label, etc.)
//       onDone: () => {},           // optional (show "next" button, etc.)
//     });
//   });
//
//   closeBtn.addEventListener('click', stopStory);  // ALSO call this when leaving the viewer
// -----------------------------------------------------------------------------

const MS_PER_CHAR = 71;   // measured from Eagle-4.mp3, used only if a line has no known length
const MIN_MS_PER_CHAR = 15;
const FINISH_EARLY = 0.95; // text finishes at 95% of the voice length

let currentAudio = null;    // the clip that is playing right now
let cancelToken = 0;        // bumped by stopStory() to cancel a running story
let cancelTyping = null;    // stops the running typewriter

/* ---------------- Timing ---------------- */

// Works out how fast to type so the text ends with the voice.
//   line    : one monologue entry
//   text    : the text AFTER {name} was replaced (the name changes its length)
//   realMs  : real clip length from the browser (best), or null
// Priority for the voice length: realMs  >  line.durationMs  >  estimate from text length
export function getLineTiming(line, text = line.text, realMs = null) {
  const voiceMs = realMs ?? line.durationMs ?? text.length * MS_PER_CHAR;
  const typeMs = voiceMs * FINISH_EARLY;
  return {
    voiceMs,
    msPerChar: Math.max(MIN_MS_PER_CHAR, typeMs / Math.max(text.length, 1)),
    pauseAfterMs: line.pauseAfterMs ?? 500,
  };
}

/* ---------------- Helpers ---------------- */

// Types `text` into `el`. Returns a promise that resolves when typing is done
// (or when stopStory() cancels it).
function typeText(el, text, msPerChar) {
  return new Promise((resolve) => {
    el.textContent = '';
    let i = 0;
    const timer = setInterval(() => {
      el.textContent += text[i++];
      if (i >= text.length) finish();
    }, msPerChar);

    function finish() {
      clearInterval(timer);
      cancelTyping = null;
      resolve();
    }
    cancelTyping = finish;
  });
}

// Plays one audio file. Resolves when it ends (or fails / is blocked).
// onStart(durationMs | null) is called once, as soon as the clip starts
// (or immediately if there is no file), so the text can start with the voice.
function playClip(url, onStart) {
  return new Promise((resolve) => {
    let started = false;
    const start = (audio) => {
      if (started) return;
      started = true;
      const ms = audio && isFinite(audio.duration) ? audio.duration * 1000 : null;
      onStart?.(ms);
    };

    if (!url) {
      start(null);
      return resolve();
    }

    const audio = new Audio(url);
    currentAudio = audio;
    audio.addEventListener('playing', () => start(audio), { once: true });
    audio.addEventListener('ended', resolve, { once: true });
    audio.addEventListener('error', () => { start(null); resolve(); }, { once: true }); // file missing
    audio.play().catch(() => { start(null); resolve(); });                              // autoplay blocked
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- Public API ---------------- */

export function stopStory() {
  cancelToken++;                        // cancels the running playStory loop
  if (cancelTyping) cancelTyping();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

export async function playStory(monologue, { playerName = 'Explorer', textEl, onLine, onDone } = {}) {
  stopStory();                          // never let two stories overlap
  const myToken = cancelToken;
  const cancelled = () => myToken !== cancelToken;

  for (let i = 0; i < monologue.length; i++) {
    if (cancelled()) return;

    const line = monologue[i];
    const text = line.text.replaceAll('{name}', playerName);

    // 1) sound effect first (no text yet)
    await playClip(line.sfx);
    if (cancelled()) return;

    // 2) voice + text together
    let typing = Promise.resolve();
    await playClip(line.audio, (realMs) => {
      const timing = getLineTiming(line, text, realMs);
      const custom = onLine?.(line, text, timing, i);   // optional hook (can return a promise)
      if (textEl) typing = typeText(textEl, text, timing.msPerChar);
      else if (custom) typing = Promise.resolve(custom);
    });
    await typing;                       // make sure the text is fully typed
    if (cancelled()) return;

    // 3) short pause before the next line
    await wait(getLineTiming(line, text).pauseAfterMs);
  }

  if (!cancelled()) onDone?.();
}