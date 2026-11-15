// src/interaction/audioCheck.js
// -----------------------------------------------------------------------------
// DEBUG HELPER. Finds out which voice / sound files the browser can NOT load.
//
// Why: on the Vite dev server a missing file does not give a 404. It gives your
// index.html with status 200, so the audio fails silently and only the text shows.
// This checks every `audio` / `sfx` path and prints a table in the console.
//
// Usage (temporary, put at the bottom of src/main.js):
//
//   import { checkAudio } from './interaction/audioCheck.js';
//   import { DIALOGUE_CONFIG } from './scenes/dialogueScene.js';
//   checkAudio(DIALOGUE_CONFIG, MARS_TRANSITION_SCRIPT, EAGLE, LRV, SURVEYOR3, INSIGHT, INGENUITY, SOJOURNER);
//
// Then open the browser console (F12). You get a table:
//   OK        the file exists and is served as audio
//   MISSING   wrong path / wrong name / wrong folder (or the file is not in public/)
//   NOT AUDIO the file exists but is not an audio type (broken or renamed file)
// Remove the two lines again when everything says OK.
// -----------------------------------------------------------------------------

// Walks any object / array and collects every string stored under an `audio` or `sfx` key.
function collect(node, found = new Set()) {
  if (!node || typeof node !== 'object') return found;
  if (Array.isArray(node)) {
    node.forEach((n) => collect(n, found));
    return found;
  }
  for (const [key, value] of Object.entries(node)) {
    if ((key === 'audio' || key === 'sfx') && typeof value === 'string') found.add(value);
    else if (value && typeof value === 'object') collect(value, found);
  }
  return found;
}

async function checkOne(url) {
  try {
    const res = await fetch(url);
    const type = res.headers.get('content-type') || '';
    res.body?.cancel?.();                        // we only need the headers
    if (!res.ok) return { url, result: 'MISSING', detail: `HTTP ${res.status}` };
    if (type.includes('text/html')) return { url, result: 'MISSING', detail: 'got index.html (file not found)' };
    if (type && !type.startsWith('audio') && !type.includes('octet-stream')) {
      return { url, result: 'NOT AUDIO', detail: type };
    }
    return { url, result: 'OK', detail: type || 'audio (no content-type header)' };
  } catch (err) {
    return { url, result: 'ERROR', detail: String(err) };
  }
}

export async function checkAudio(...sources) {
  const urls = [...collect(sources)];
  const rows = await Promise.all(urls.map(checkOne));
  const bad = rows.filter((r) => r.result !== 'OK');

  console.log(`[audio check] ${urls.length} files checked, ${bad.length} problem(s)`);
  console.table(rows);
  if (bad.length) {
    console.warn('[audio check] Fix these first (check folder, spelling and capital letters):',
      bad.map((r) => r.url));
  }
  return rows;
}

// also callable from the browser console: window.checkAudio({ audio: '/assets/audio/x.mp3' })
window.checkAudio = checkAudio;