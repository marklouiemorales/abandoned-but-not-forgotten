// entities/moon/moonSignals.js   (project root, next to /src and /public)
// -----------------------------------------------------------------------------
// DATA ONLY. Text shown in the Moon HUD + the 3 equipment signals on the surface.
//
// Signals:  lat -90..90 (north +), lon -180..180 (east +).
//   lat 0 / lon 0 faces the camera when the scene loads. The user can drag the
//   planet freely, so signals can be anywhere.
//
// Each signal carries its equipment:
//   equipment.id     key used by main.js (ENTITIES registry) to open its page
//   equipment.name   full name shown in the expanded panel / objective list
//   equipment.meta   small label/value chips in the panel header
//   equipment.mount  OPTIONAL. mount(slotElement, equipment) -> optional cleanup fn
// -----------------------------------------------------------------------------

export const MOON_LOCATION = {
  eyebrow: 'Location · Arrival site',
  stubText: 'ARRIVAL SITE · LUNAR SURFACE',
  name: 'The Moon',
  subtitle: 'Lunar surface',
  description: 'Earth\u2019s airless, cratered natural satellite.',
  stats: [
    { label: 'Distance', value: '384,400 km', note: 'From Earth' },
    { label: 'Gravity', value: '1.62 m/s\u00B2', note: '16.5% of Earth' },
    { label: 'Surface temp', value: '\u2212173 / 127 \u00B0C', note: 'Night / day' },
    { label: 'Lunar day', value: '29.5 days', note: 'Earth time' },
  ],
  objective: 'Find 3 pieces of equipment on the Moon',
  footer: 'Moon surface · Signal scan active',
};

export const MOON_SIGNALS = [
  {
    id: 'moon-signal-1', index: 1, lat: 6, lon: -15,
    label: 'Unknown signal', hint: 'Click to Investigate',
    equipment: {
      id: 'eagle',
      name: 'Apollo 11 Lunar Module \u201CEagle\u201D',
      meta: [
        { label: 'Mission', value: 'Apollo 11' },
        { label: 'Year', value: '1969' },
        { label: 'Type', value: 'Crewed lander' },
      ],
      mount: null,
    },
  },
  {
    id: 'moon-signal-2', index: 2, lat: -24, lon: 105,
    label: 'Unknown signal', hint: 'Click to Investigate',
    equipment: {
      id: 'surveyor3',
      name: 'Surveyor 3 Lunar Lander',
      meta: [
        { label: 'Mission', value: 'Surveyor 3' },
        { label: 'Year', value: '1967' },
        { label: 'Type', value: 'Robotic lander' },
      ],
      mount: null,
    },
  },
  {
    id: 'moon-signal-3', index: 3, lat: 22, lon: -135,
    label: 'Unknown signal', hint: 'Click to Investigate',
    equipment: {
      id: 'lrv',
      name: 'Lunar Roving Vehicle 1 (LRV-1)',
      meta: [
        { label: 'Mission', value: 'Apollo 15' },
        { label: 'Year', value: '1971' },
        { label: 'Type', value: 'Rover' },
      ],
      mount: null,
    },
  },
];