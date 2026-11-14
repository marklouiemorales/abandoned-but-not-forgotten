// src/scenes/planetHud.js
// -----------------------------------------------------------------------------
// On-screen details for a planet scene (Moon or Mars), styled like the explorer
// boarding pass:
//   top-left   : home + journal buttons, then a "site pass" card (description + stats)
//   top-right  : explorer chip (name, id · rank, equipment count) + objective card
//   bottom     : drag hint + footer caption
//
//   const hud = createPlanetHud(document.body, {
//     explorer, location, signals,
//     totalMissions: 6,     // Moon + Mars
//     baseFound: 0,         // equipment already found on OTHER planets
//     onHome, onJournal,
//   });
//   hud.markFound(signalId, 'Equipment name')   -> updates objective + counters
//   hud.hideHint()                              -> call on the first drag
//   hud.dim(true/false)                         -> fade the HUD while a panel is open
//   hud.dispose()
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

  const stats = location.stats || [];
  let overallFound = baseFound;
  const found = new Set();

  const root = document.createElement('div');
  root.className = 'planet-hud';
  root.innerHTML = `
    <div class="hud-left">
      <div class="hud-buttons">
        <button class="hud-icon" data-action="home" aria-label="Home">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>
        </button>
        <button class="hud-icon" data-action="journal" aria-label="Journal">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5h7a3 3 0 013 3v12a2 2 0 00-2-2H2z"/><path d="M22 5h-7a3 3 0 00-3 3v12a2 2 0 012-2h8z"/></svg>
        </button>
      </div>

      <div class="pass-wrap">
        <section class="pass pass--site">
          <aside class="pass__stub">
            <span class="pass__barcode"></span>
            <span class="pass__stub-text">${escapeHtml(location.stubText)}</span>
          </aside>
          <div class="pass__body">
            <div class="pass__brand"><i class="pass__orb"></i>Space Exploration Program</div>
            <div class="pass__kicker">${escapeHtml(location.eyebrow || 'Location')}</div>
            <h1>${escapeHtml(location.name)}</h1>
            <h2>${escapeHtml(location.subtitle)}</h2>
            <p>${escapeHtml(location.description)}</p>
            <dl class="pass__stats">
              ${stats.map((s) => `
                <div>
                  <dt>${escapeHtml(s.label)}</dt>
                  <dd>${escapeHtml(s.value)}</dd>
                  <small>${escapeHtml(s.note)}</small>
                </div>`).join('')}
            </dl>
          </div>
        </section>
      </div>
    </div>

    <div class="hud-right">
      <div class="hud-explorer">
        <span class="hud-explorer__who">
          <b data-name></b>
          <small data-id></small>
        </span>
        <span class="hud-explorer__total">
          <small>Equipment</small>
          <b><span data-total-found>${overallFound}</span> / ${totalMissions}</b>
        </span>
      </div>

      <div class="pass-wrap">
        <section class="pass pass--objective">
          <div class="pass__body">
            <div class="pass__row">
              <span class="pass__kicker pass__kicker--bare">Objective</span>
              <span class="pass__count"><span data-obj-found>0</span> / ${signals.length}</span>
            </div>
            <div class="pass__segments">
              ${signals.map((s) => `<i data-seg="${escapeHtml(s.id)}"></i>`).join('')}
            </div>
            <p class="pass__objective">${escapeHtml(location.objective)}</p>
            <ul class="pass__list">
              ${signals.map((s) => `<li data-id="${escapeHtml(s.id)}"><i></i><span>${escapeHtml(s.label)}</span></li>`).join('')}
            </ul>
          </div>
        </section>
      </div>
    </div>

    <div class="hud-hint" data-hint>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>
      <span>Drag to rotate the planet</span>
      <em></em>
      <span>Select a signal to investigate</span>
    </div>

    <footer class="hud-footer">${escapeHtml(location.footer)}</footer>
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
      root.querySelector('[data-obj-found]').textContent = found.size;
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