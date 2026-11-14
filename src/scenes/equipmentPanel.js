// src/scenes/equipmentPanel.js
// -----------------------------------------------------------------------------
// The panel a signal expands into (Moon or Mars). It grows out of the clicked
// marker and shrinks back into it on close. The primary button opens the
// equipment's own page (its .js entity, e.g. entities/moon/eagle.js).
//
//   const panel = createEquipmentPanel(document.body, {
//     onOpen:  (signal) => {...},   // "Inspect equipment" / "Open equipment" pressed
//     onClose: (signal) => {...},   // closed WITHOUT opening (X, outside click, Esc)
//   });
//   panel.open(signal, markerEl, { found: false });
//   panel.close();   panel.dispose();
//
// Optional: equipment.mount(slotEl, equipment) in the signals data fills the slot
// with your own UI and may return a cleanup function.
// -----------------------------------------------------------------------------

export function createEquipmentPanel(parent, options = {}) {
  const { onClose = () => {}, onOpen = () => {} } = options;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DUR = reduceMotion ? 1 : 560;
  const EASE_OUT = 'cubic-bezier(0.22, 0.9, 0.24, 1)';
  const EASE_IN = 'cubic-bezier(0.5, 0, 0.75, 0.2)';

  const overlay = document.createElement('div');
  overlay.className = 'eq-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="eq-wrap" data-card>
      <section class="hud-panel eq-panel" role="dialog" aria-modal="true" aria-label="Equipment details">
        <div class="eq-panel__inner" data-inner>
          <div class="hud-data__head"><span data-stub></span><b>Signal</b></div>
          <header class="eq-panel__head">
            <div>
              <div class="hud-kicker hud-kicker--accent" data-kicker></div>
              <h3 data-title></h3>
            </div>
            <button class="eq-panel__close" data-close aria-label="Close">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
            </button>
          </header>
          <dl class="hud-meta eq-panel__meta" data-meta></dl>
          <div class="eq-panel__slot" data-slot></div>
          <footer class="eq-panel__foot">
            <span class="eq-panel__status" data-status></span>
            <button class="eq-btn" data-open></button>
          </footer>
        </div>
      </section>
    </div>`;
  parent.appendChild(overlay);

  const card = overlay.querySelector('[data-card]');
  const inner = overlay.querySelector('[data-inner]');
  const slot = overlay.querySelector('[data-slot]');
  const openBtn = overlay.querySelector('[data-open]');
  const closeBtn = overlay.querySelector('[data-close]');

  let isOpen = false;
  let closing = false;
  let current = null;
  let originEl = null;
  let cleanup = null;
  let anims = [];

  const text = (sel, value) => { overlay.querySelector(sel).textContent = value; };

  function originPoint() {
    if (!originEl || originEl.style.visibility === 'hidden') return null;
    const dot = originEl.querySelector('.signal__dot') || originEl;
    const r = dot.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function offsetToOrigin() {
    const r = card.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const o = originPoint() || { x: cx, y: cy + 40 };
    return { dx: o.x - cx, dy: o.y - cy };
  }

  function run(el, frames, opts) {
    const a = el.animate(frames, { fill: 'both', ...opts });
    anims.push(a);
    return a;
  }
  function cancelAnims() { anims.forEach((a) => a.cancel()); anims = []; }

  function fill(signal, found) {
    const eq = signal.equipment || {};
    const index = String(signal.index ?? '').padStart(2, '0');
    text('[data-stub]', 'EQUIPMENT RECORD');
    text('[data-kicker]', `Equipment${signal.index ? ' · Signal ' + index : ''}`);
    text('[data-title]', eq.name || 'Unidentified equipment');

    const meta = overlay.querySelector('[data-meta]');
    meta.replaceChildren();
    (eq.meta || []).forEach((m) => {
      const d = document.createElement('div');
      const dt = document.createElement('dt'); dt.textContent = m.label;
      const dd = document.createElement('dd'); dd.textContent = m.value;
      d.append(dt, dd);
      meta.appendChild(d);
    });

    text('[data-status]', found ? 'Status · Recovered' : 'Status · Not logged');
    openBtn.textContent = found ? 'Open equipment' : 'Inspect equipment';

    slot.replaceChildren();
    if (typeof eq.mount === 'function') {
      const result = eq.mount(slot, eq);
      cleanup = typeof result === 'function' ? result : null;
    } else {
      slot.innerHTML = '<span>Signal locked · inspect to analyze</span>';
    }
  }

  function open(signal, el, { found = false } = {}) {
    if (isOpen) return;
    isOpen = true;
    current = signal;
    originEl = el;
    cancelAnims();
    fill(signal, found);

    overlay.hidden = false;
    const { dx, dy } = offsetToOrigin();

    run(overlay, [{ opacity: 0 }, { opacity: 1 }], { duration: DUR * 0.7, easing: 'ease-out' });
    run(card, [
      { transform: `translate(${dx}px, ${dy}px) scale(0.05)`, opacity: 0 },
      { transform: `translate(${dx * 0.25}px, ${dy * 0.25}px) scale(0.7)`, opacity: 1, offset: 0.45 },
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    ], { duration: DUR, easing: EASE_OUT });
    run(inner, [{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }], { duration: DUR, easing: 'ease-out' });

    openBtn.focus({ preventScroll: true });
  }

  async function close({ silent = false } = {}) {
    if (!isOpen || closing) return;
    closing = true;
    const { dx, dy } = offsetToOrigin();
    cancelAnims();

    const d = DUR * 0.75;
    const finished = [
      run(overlay, [{ opacity: 1 }, { opacity: 0 }], { duration: d, easing: 'ease-in' }),
      run(card, [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.05)`, opacity: 0 },
      ], { duration: d, easing: EASE_IN }),
      run(inner, [{ opacity: 1 }, { opacity: 0 }], { duration: d * 0.4, easing: 'ease-in' }),
    ].map((a) => a.finished.catch(() => {}));
    await Promise.all(finished);

    cancelAnims();
    overlay.hidden = true;
    if (cleanup) { cleanup(); cleanup = null; }
    slot.replaceChildren();
    const signal = current;
    current = null;
    originEl = null;
    isOpen = false;
    closing = false;
    if (!silent) onClose(signal);
  }

  closeBtn.addEventListener('click', () => close());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  // Primary action: hand the signal to the caller (which navigates to the equipment page).
  openBtn.addEventListener('click', () => {
    if (!current) return;
    const signal = current;
    onOpen(signal);
  });

  const onKey = (e) => { if (e.key === 'Escape' && isOpen) close(); };
  window.addEventListener('keydown', onKey);

  return {
    slot,
    get isOpen() { return isOpen; },
    open,
    close,
    dispose() {
      window.removeEventListener('keydown', onKey);
      cancelAnims();
      if (cleanup) cleanup();
      overlay.remove();
    },
  };
}