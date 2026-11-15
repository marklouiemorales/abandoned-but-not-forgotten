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
// The lat/lon below are spread around the planet so the signals are easy to find.
// Edit them freely.
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
    id: 'mars-signal-1', index: 1, lat: 19, lon: -33,
    label: 'Unknown signal', hint: 'Click to investigate',
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
    id: 'mars-signal-2', index: 2, lat: 18, lon: 77,
    label: 'Unknown signal', hint: 'Click to investigate',
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
    id: 'mars-signal-3', index: 3, lat: 5, lon: 135,
    label: 'Unknown signal', hint: 'Click to investigate',
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