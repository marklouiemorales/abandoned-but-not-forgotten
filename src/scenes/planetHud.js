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
    <div class="hud-rail"></div>

    <!-- TOP LEFT: title -->
    <header class="hud-title">
      <div class="hud-kicker hud-kicker--accent">${escapeHtml(location.eyebrow || 'Location')}</div>
      <h1 class="hud-name">${escapeHtml(location.name)}</h1>
      <div class="hud-sub"><i></i>${escapeHtml(location.subtitle)}</div>
      <p class="hud-desc">${escapeHtml(location.description)}</p>
      <div class="hud-chips">
        <span class="hud-chip hud-chip--live"><i></i>Scan active</span>
        <span class="hud-chip">${signals.length} signals detected</span>
        <span class="hud-chip">Surface survey</span>
      </div>
    </header>

    <!-- TOP CENTER: hint -->
    <div class="hud-hint" data-hint>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>
      <span>Drag to rotate</span><em></em><span>Select a signal</span>
    </div>

    <!-- TOP RIGHT: buttons + radar -->
    <div class="hud-top-right">
      <div class="hud-buttons">
        <button class="hud-btn" data-action="home" aria-label="Home">
          <span class="hud-btn__ico"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg></span>Home
        </button>
        <button class="hud-btn" data-action="journal" aria-label="Journal">
          <span class="hud-btn__ico"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5h7a3 3 0 013 3v12a2 2 0 00-2-2H2z"/><path d="M22 5h-7a3 3 0 00-3 3v12a2 2 0 012-2h8z"/></svg></span>Journal
        </button>
      </div>
      <div class="hud-panel hud-radar" aria-hidden="true">
        <div class="hud-radar__dial"><i class="hud-radar__sweep"></i><b></b><b></b><b></b></div>
        <div class="hud-radar__lbl"><span>Signal scan</span><em>${signals.length} contacts</em></div>
      </div>
    </div>

    <!-- BOTTOM LEFT: readout strip -->
    <div class="hud-panel hud-strip">
      <div><small>Target body</small><b>${escapeHtml(location.name)}</b></div>
      <div><small>Signals</small><b>${signals.length}</b></div>
      <div><small>Recovered</small><b><span data-obj-found>0</span> / ${signals.length}</b></div>
      <div><small>Status</small><b class="hud-ok">Scanning</b></div>
      <span class="hud-strip__cap">${escapeHtml(location.footer)}</span>
    </div>

    <!-- BOTTOM RIGHT: explorer + objective -->
    <aside class="hud-panel hud-data hud-outline">
      <div class="hud-data__head"><span>Explorer</span><b>Ready</b></div>
      <div class="hud-explorer">
        <span class="hud-explorer__who"><b data-name></b><small data-id></small></span>
        <span class="hud-explorer__total"><small>Equipment</small><b><span data-total-found>${overallFound}</span> / ${totalMissions}</b></span>
      </div>

      <div class="hud-data__head"><span>Objective</span><b><span data-obj-found>0</span> / ${signals.length}</b></div>
      <div class="hud-segments">
        ${signals.map((s) => `<i data-seg="${escapeHtml(s.id)}"></i>`).join('')}
      </div>
      <p class="hud-objective">${escapeHtml(location.objective)}</p>
      <ul class="hud-list">
        ${signals.map((s) => `<li data-id="${escapeHtml(s.id)}"><i></i><span>${escapeHtml(s.label)}</span></li>`).join('')}
      </ul>
    </aside>
  `;
  parent.appendChild(root);

  // Explorer text goes in as text (it is user input), never as HTML.
  root.querySelector('[data-name]').textContent = explorer.name || 'Explorer';
  root.querySelector('[data-id]').textContent =
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
    hideHint() {
      root.querySelector('[data-hint]').classList.add('is-hidden');
    },
    dispose() {
      root.remove();
    },
  };
}