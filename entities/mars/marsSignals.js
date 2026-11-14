// entities/mars/marsSignals.js   (project root, next to /src and /public)
// -----------------------------------------------------------------------------
// DATA ONLY. Same shape as entities/moon/moonSignals.js, so the exact same HUD,
// markers, controls and panel work on Mars.
//
// The equipment below is PLACEHOLDER. Replace names / ids / meta / lat / lon with
// your real three Mars pieces, and add each entity to the ENTITIES registry in
// src/main.js (equipment.id must match the registry key).
//
// Signals:  lat -90..90 (north +), lon -180..180 (east +).
// -----------------------------------------------------------------------------

export const MARS_LOCATION = {
  eyebrow: 'Location · Arrival site',
  stubText: 'ARRIVAL SITE · MARTIAN SURFACE',
  name: 'Mars',
  subtitle: 'Martian surface',
  description: 'The cold, dusty red planet, home to the largest volcano in the solar system.',
  stats: [
    { label: 'Distance', value: '225M km', note: 'Average from Earth' },
    { label: 'Gravity', value: '3.71 m/s\u00B2', note: '38% of Earth' },
    { label: 'Surface temp', value: '\u2212125 / 20 \u00B0C', note: 'Night / day' },
    { label: 'Martian day', value: '24h 37m', note: 'One sol' },
  ],
  objective: 'Find 3 pieces of equipment on Mars',
  footer: 'Mars surface · Signal scan active',
};

export const MARS_SIGNALS = [
  {
    id: 'mars-signal-1', index: 1, lat: 10, lon: -10,
    label: 'Unknown signal', hint: 'Select to investigate',
    equipment: {
      id: 'mars-equipment-1',
      name: 'Mars equipment 1 (placeholder)',
      meta: [
        { label: 'Mission', value: 'TBD' },
        { label: 'Year', value: 'TBD' },
        { label: 'Type', value: 'TBD' },
      ],
      mount: null,
    },
  },
  {
    id: 'mars-signal-2', index: 2, lat: -20, lon: 100,
    label: 'Unknown signal', hint: 'Select to investigate',
    equipment: {
      id: 'mars-equipment-2',
      name: 'Mars equipment 2 (placeholder)',
      meta: [
        { label: 'Mission', value: 'TBD' },
        { label: 'Year', value: 'TBD' },
        { label: 'Type', value: 'TBD' },
      ],
      mount: null,
    },
  },
  {
    id: 'mars-signal-3', index: 3, lat: 25, lon: -130,
    label: 'Unknown signal', hint: 'Select to investigate',
    equipment: {
      id: 'mars-equipment-3',
      name: 'Mars equipment 3 (placeholder)',
      meta: [
        { label: 'Mission', value: 'TBD' },
        { label: 'Year', value: 'TBD' },
        { label: 'Type', value: 'TBD' },
      ],
      mount: null,
    },
  },
];