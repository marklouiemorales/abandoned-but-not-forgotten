// entities/mars/marsSignals.js   (project root, next to /src and /public)
// -----------------------------------------------------------------------------
// DATA ONLY. Same shape as entities/moon/moonSignals.js, so the same HUD, markers,
// controls and panel work on Mars.
//
// equipment.id MUST match the key in the ENTITIES registry in src/main.js:
//   'sojourner' -> entities/mars/sojourner.js
//   'ingenuity' -> entities/mars/ingenuity.js
//   'insight'   -> entities/mars/insight.js
//
// Signals:  lat -90..90 (north +), lon -180..180 (east +).
// lat/lon are the REAL landing coordinates. `pos: null` is a slot for an exact point picked on
// the model: open /?phase=mars&pick=1, double-click the spot, paste the printed `pos: [...]`
// over `null`. Pick ONE signal (two is best) and all the others line up automatically.
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
    id: 'mars-signal-1', index: 1, lat: 19.13, lon: -33.22, pos: null,   // Sojourner, Ares Vallis
    label: 'Unknown signal', hint: 'Select to investigate',
    equipment: {
      id: 'sojourner',
      name: 'Sojourner Rover',
      meta: [
        { label: 'Mission', value: 'Mars Pathfinder' },
        { label: 'Year', value: '1997' },
        { label: 'Type', value: 'Rover' },
      ],
      mount: null,
    },
  },
  {
    id: 'mars-signal-2', index: 2, lat: 18.44, lon: 77.45, pos: null,   // Ingenuity, Jezero Crater
    label: 'Unknown signal', hint: 'Select to investigate',
    equipment: {
      id: 'ingenuity',
      name: 'Ingenuity Helicopter',
      meta: [
        { label: 'Mission', value: 'Mars 2020' },
        { label: 'Year', value: '2021' },
        { label: 'Type', value: 'Helicopter' },
      ],
      mount: null,
    },
  },
  {
    id: 'mars-signal-3', index: 3, lat: 4.50, lon: 135.62, pos: null,   // InSight, Elysium Planitia
    label: 'Unknown signal', hint: 'Select to investigate',
    equipment: {
      id: 'insight',
      name: 'InSight Lander',
      meta: [
        { label: 'Mission', value: 'InSight' },
        { label: 'Year', value: '2018' },
        { label: 'Type', value: 'Robotic lander' },
      ],
      mount: null,
    },
  },
];