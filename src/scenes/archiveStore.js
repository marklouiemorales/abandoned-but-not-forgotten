// src/scenes/archiveStore.js
// -----------------------------------------------------------------------------
// Tiny persistent store for the Archive. It keeps TWO things in localStorage:
//   - explorer  : the user card  { name, id, rank, ... }  (whatever the registration scene gives you)
//   - equipment : one card per discovered equipment, keyed by its id (LUN-01, LUN-02, ...)
//
//   const archive = loadArchive({ name: 'osa', id: 'EXP-001', rank: 'Commander' });
//   saveEquipment(archive, EAGLE);        // adds the card (once) and writes to localStorage
//   Object.keys(archive.equipment).length // how many are saved
//   clearArchive();                       // wipe everything (handy while testing)
// -----------------------------------------------------------------------------

const KEY = 'abf:archive:v1';

export function loadArchive(explorer = {}) {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* ignore broken / blocked storage */ }
  const archive = { explorer: {}, equipment: {}, ...(data || {}) };
  if (explorer && Object.keys(explorer).length) archive.explorer = { ...archive.explorer, ...explorer };
  if (!archive.explorer.joinedAt) archive.explorer.joinedAt = Date.now();   // shown as the departure date
  persist(archive);
  return archive;
}

export function persist(archive) {
  try { localStorage.setItem(KEY, JSON.stringify(archive)); } catch { /* storage full / disabled: keep in memory */ }
}

// the small "equipment card" that is stored (not the whole entity)
export const snapshot = (e) => ({
  id: e.id,
  planet: e.planet,
  planetCode: e.planetCode,
  name: e.name,
  shortName: e.shortName,
  site: e.location?.site,
  coordinates: e.stats?.coordinates,
  savedAt: Date.now(),
});

export function saveEquipment(archive, entity) {
  if (!entity?.id) return false;
  const isNew = !archive.equipment[entity.id];
  if (isNew) archive.equipment[entity.id] = snapshot(entity);
  persist(archive);
  return isNew;
}

export function clearArchive() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}