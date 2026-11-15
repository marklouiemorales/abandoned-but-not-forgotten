// src/scenes/planetHud.js
// -----------------------------------------------------------------------------
// On-screen details for a planet scene (Moon or Mars), styled like the equipment
// viewer (dark slate panels, thin blue borders, small blue caps labels).
//
//   top-left      : big planet title as plain text (no card) + location + short description
//   top-center    : drag hint
//   top-right     : Home / Journal buttons + signal radar
//   bottom-left   : scan readout strip (target, signals, recovered, status)
//   bottom-right  : explorer + objective, outline-only (transparent) panel
//
//   const hud = createPlanetHud(document.body, {
//     explorer, location, signals,
//     totalMissions: 6,     // Moon + Mars
//     baseFound: 0,         // equipment already found on OTHER planets
//     onHome, onJournal,
//   });
//   hud.markFound(signalId, 'Equipment name')
//   hud.hideHint()   hud.dim(true/false)   hud.dispose()
//
// Location statistics are intentionally NOT shown here (they live in the archive).
// -----------------------------------------------------------------------------

const escapeHtml = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createPlanetHud(parent, options = {}) {
  const {
    explorer = {},
    location = {},
    signals = [],
    totalMissions = 6,
    baseFound = 0,
    onHome = () => {},
    onJournal = () => {},
  } = options;

  let overallFound = baseFound;
  const found = new Set();

  const root = document.createElement('div');
  root.className = 'planet-hud';
   root.innerHTML = `
    <!-- TOP LEFT: title, objective, explorer, signal list -->
    <header class="hud-title">
      <div class="hud-kicker">Location</div>
      <h1 class="hud-name">${escapeHtml(location.name)}</h1>
      <p class="hud-objective">${escapeHtml(location.objective)}</p>
      <div class="hud-explorer-line" data-explorer-id></div>
      <ul class="hud-list">
        ${signals.map((s) => `<li data-id="${escapeHtml(s.id)}"><i></i><span>${escapeHtml(s.label)}</span></li>`).join('')}
      </ul>
    </header>

    <!-- TOP RIGHT: round icon buttons -->
    <div class="hud-top-right">
      <div class="hud-buttons">
        <button class="hud-btn" data-action="home" aria-label="Home">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>
        </button>
        <button class="hud-btn" data-action="journal" aria-label="Journal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5h7a3 3 0 013 3v12a2 2 0 00-2-2H2z"/><path d="M22 5h-7a3 3 0 00-3 3v12a2 2 0 012-2h8z"/></svg>
        </button>
      </div>
    </div>

    <!-- BOTTOM LEFT: readout -->
    <div class="hud-card hud-strip">
      <div><small>Recovered</small><b><span data-obj-found>0</span> / ${signals.length}</b></div>
      <div><small>Equipment</small><b><span data-total-found>${overallFound}</span> / ${totalMissions}</b></div>
      <div><small>Status</small><b class="hud-ok">Scanning</b></div>
    </div>

    <!-- BOTTOM RIGHT: explorer -->
    <aside class="hud-card hud-explorer-card">
      <span class="hud-avatar">
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <rect width="100" height="100" fill="#07123a"/>
          <circle cx="50" cy="52" r="20" fill="#e8643a"/>
          <ellipse cx="50" cy="52" rx="38" ry="11" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2" transform="rotate(-20 50 52)"/>
          <circle cx="80" cy="30" r="3" fill="#fff"/><circle cx="18" cy="24" r="1.6" fill="#fff" opacity=".7"/>
        </svg>
      </span>
      <b data-name></b>
    </aside>
  `;
  parent.appendChild(root);

  // Explorer text goes in as text (it is user input), never as HTML.
  root.querySelector('[data-name]').textContent = explorer.name || 'Explorer';
  root.querySelector('[data-explorer-id]').textContent =
    [explorer.id, explorer.rank].filter(Boolean).join(' · ');

  root.querySelector('[data-action="home"]').addEventListener('click', onHome);
  root.querySelector('[data-action="journal"]').addEventListener('click', onJournal);

  return {
    el: root,
    markFound(id, name) {
      if (found.has(id)) return;
      found.add(id);
      overallFound += 1;
      const li = [...root.querySelectorAll('li[data-id]')].find((n) => n.dataset.id === id);
      if (li) {
        li.classList.add('is-found');
        if (name) li.querySelector('span').textContent = name;
      }
      const seg = [...root.querySelectorAll('[data-seg]')].find((n) => n.dataset.seg === id);
      if (seg) seg.classList.add('is-found');
      root.querySelectorAll('[data-obj-found]').forEach((n) => { n.textContent = found.size; });
      root.querySelector('[data-total-found]').textContent = overallFound;
    },
    dim(on) {
      root.classList.toggle('is-dim', !!on);
    },
    hideHint() {},   // hint removed
    dispose() {
      root.remove();
    },
  };
}