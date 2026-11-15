// Certificate popup, styled after the registration boarding pass.
// createCertificate(document.body, { variant: 'pioneer' | 'keeper', explorer, onClose })

const CERT_CSS = `
.cert-overlay {
  position: fixed; inset: 0; z-index: 200;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px;
  background: transparent;
  opacity: 0; transition: opacity .5s ease; font-family: inherit;
}
.cert-overlay.is-open { opacity: 1; }
.cert-card {
  position: relative; width: min(680px, 92vw); padding: 28px 36px 0; overflow: hidden;
  text-align: center; color: #0c1b3d;
  background: linear-gradient(135deg, #c9d8ee 0%, #f2f6fc 35%, #e3ebf7 100%);
  border-radius: 18px;
  clip-path: polygon(0 0, calc(100% - 44px) 0, 100% 44px, 100% 100%, 0 100%);
  box-shadow: 0 0 60px rgba(90, 150, 255, .35);
  transform: translateY(20px) scale(.96); transition: transform .5s ease;
}
.cert-overlay.is-open .cert-card { transform: none; }
.cert-hex {
  position: absolute; inset: 0; opacity: .35; pointer-events: none;
  background-image:
    linear-gradient(60deg,  transparent 48%, #9fb3d3 49%, #9fb3d3 51%, transparent 52%),
    linear-gradient(-60deg, transparent 48%, #9fb3d3 49%, #9fb3d3 51%, transparent 52%);
  background-size: 60px 104px;
}
.cert-card > * { position: relative; }
.cert-head { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: #5f77a6; }
.cert-dot { width: 14px; height: 14px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #a9c0ff, #4a6fd0); }
.cert-title { margin: 10px 0 0; font-size: 11px; letter-spacing: .25em; text-transform: uppercase; color: #7d90b5; }
.cert-small { margin: 22px 0 4px; font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: #7d90b5; }
.cert-name { margin: 0; font-size: clamp(30px, 6vw, 52px); letter-spacing: .04em; text-transform: uppercase;
  background: linear-gradient(90deg, #5d6f94, #0c1b3d 45%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.cert-award { margin: 10px 0 6px; font-size: clamp(16px, 3vw, 24px); letter-spacing: .14em; text-transform: uppercase; color: #1c3f8f; }
.cert-text { max-width: 480px; margin: 0 auto; font-size: 13px; line-height: 1.6; color: #44547a; }

.cert-badge {
  width: 96px; height: 96px; margin: 20px auto 18px; border-radius: 50%; padding: 6px;
  background: radial-gradient(circle at 30% 25%, #2e61c9, #0b2a6b); box-shadow: 0 0 0 3px #0c1b3d;
  display: grid; place-items: center;
}
.cert-planet { width: 36px; height: 36px; border-radius: 50%; background: #ee6a3c; box-shadow: 0 0 0 10px rgba(255,255,255,.12); }
.cert-keeper .cert-badge { background: radial-gradient(circle at 30% 25%, #f5d77a, #a8741a); }
.cert-keeper .cert-award { color: #9a6a0a; }

.cert-stub {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  margin: 0 -36px; padding: 14px 36px; text-align: left;
  border-top: 2px dashed #a9b9d6; background: rgba(255,255,255,.55);
}
.cert-field span { display: block; font-size: 9px; letter-spacing: .16em; text-transform: uppercase; color: #7d90b5; }
.cert-field b { font-size: 14px; letter-spacing: .04em; }
.cert-qr { width: 104px; height: 104px; margin-left: auto; padding: 6px; box-sizing: border-box; background: #fff; border: 2px solid #0c1b3d; border-radius: 6px;
  line-height: 0; }
.cert-qr img { display: block; width: 100%; height: 100%; object-fit: contain; }
.cert-qr i { position: absolute; width: 16px; height: 16px; border: 3px solid #0c1b3d; background: #fff; }
.cert-qr i:nth-child(1) { top: 3px; left: 3px; }
.cert-qr i:nth-child(2) { top: 3px; right: 3px; }
.cert-qr i:nth-child(3) { bottom: 3px; left: 3px; }
.cert-qr em { position: absolute; right: 4px; bottom: 4px; font-style: normal; font-size: 9px; background: #fff; padding: 0 3px; }

.cert-continue {
  padding: 12px 34px; border-radius: 999px; border: 1px solid rgba(120,170,255,.5);
  background: rgba(8,14,32,.8); color: #e8f0ff; letter-spacing: .18em; cursor: pointer; font: inherit;
}
.cert-continue:hover { background: rgba(30,60,130,.6); }
`;

function ensureCertificateStyles() {
  if (document.getElementById('cert-styles')) return;
  const s = document.createElement('style');
  s.id = 'cert-styles';
  s.textContent = CERT_CSS;
  document.head.appendChild(s);
}

const VARIANTS = {
  pioneer: {
    kicker: 'Space Exploration Program',
    title: 'Certificate of Accomplishment',
    award: 'Lunar & Mars Pioneer',
    text: 'has answered the call and completed both missions on the Moon and Mars, honoring every silent pioneer left behind.',
    rank: 'Pioneer',
  },
  keeper: {
    kicker: 'NASA’s Highest Honor',
    title: 'Certificate of Distinction',
    award: 'Ultimate Space History Keeper',
    text: 'has recovered every silent hero across the Moon and Mars, so that their stories are never forgotten.',
    rank: 'Space History Keeper',
  },
};

export function createCertificate(parent, { variant = 'pioneer', explorer = {}, onClose } = {}) {
  ensureCertificateStyles();
  const v = VARIANTS[variant] || VARIANTS.pioneer;
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const root = document.createElement('div');
  root.className = `cert-overlay cert-${variant}`;
  root.innerHTML = `
    <div class="cert-card" role="dialog" aria-modal="true">
      <div class="cert-hex"></div>
      <div class="cert-head">
        <span class="cert-dot"></span><span class="cert-kicker"></span>
      </div>
      <p class="cert-title"></p>
      <p class="cert-small">This certifies that</p>
      <h2 class="cert-name"></h2>
      <p class="cert-award"></p>
      <p class="cert-text"></p>

      <div class="cert-badge"><div class="cert-planet"></div></div>

      <div class="cert-stub">
        <div class="cert-field"><span>Date</span><b class="cert-date"></b></div>
        <div class="cert-field"><span>Explorer ID · Rank</span><b class="cert-id"></b></div>
        <!-- QR PLACEHOLDER: replace this div with a real QR image/canvas later -->
        <div class="cert-qr"><img src="/assets/qr.png" alt="QR code"></div>
      </div>
    </div>
    <button class="cert-continue" type="button">CONTINUE</button>
  `;

  // textContent keeps names safe (no HTML injection)
  root.querySelector('.cert-kicker').textContent = v.kicker;
  root.querySelector('.cert-title').textContent = v.title;
  root.querySelector('.cert-name').textContent = explorer.name || 'Commander';
  root.querySelector('.cert-award').textContent = v.award;
  root.querySelector('.cert-text').textContent = v.text;
  root.querySelector('.cert-date').textContent = date;
  root.querySelector('.cert-id').textContent = `${explorer.id || 'EX-0000'} · ${v.rank}`;

  parent.appendChild(root);
  requestAnimationFrame(() => root.classList.add('is-open'));

  const close = () => {
    root.classList.remove('is-open');
    setTimeout(() => { dispose(); onClose?.(); }, 500);
  };
  root.querySelector('.cert-continue').addEventListener('click', close, { once: true });

  function dispose() { root.remove(); }
  return { root, dispose };
}