/* Find My Quiet Sound — Sounds opening: places the field-of-sound artwork (hero-wave.webp, extracted
   from the approved reference) so that the artwork's cleared disc sits exactly under the real Start
   Listening control, at every viewport size. Layout only: no drawing, no audio, no pointer events. */
(function () {
  'use strict';
  const wrap = document.querySelector('#sf-stage .field-wrap'), box = wrap && wrap.querySelector('.hero-wave'), field = document.getElementById('field');
  if (!wrap || !box || !field) return;
  const ART_W = 850, ART_H = 495, DISC_X = 425 / 850, DISC_Y = 274 / 495;   // the disc centre inside the artwork
  let last = '';
  function place() {
    const wr = wrap.getBoundingClientRect(), fr = field.getBoundingClientRect(); if (!wr.width || !fr.width) return;
    const vw = document.documentElement.clientWidth;
    // the artwork spans the viewport on phones; on wider screens it is capped and centred, never stretched
    const w = Math.min(Math.max(vw, 320), 1180) * (vw >= 720 ? 1 : 1.02), hgt = w * ART_H / ART_W;
    const cx = fr.left + fr.width / 2 - wr.left, cy = fr.top + fr.height / 2 - wr.top;
    const left = cx - w * DISC_X, top = cy - hgt * DISC_Y;
    const key = [w, hgt, left, top].map(v => Math.round(v)).join(','); if (key === last) return; last = key;
    box.style.width = w + 'px'; box.style.height = hgt + 'px'; box.style.left = left + 'px'; box.style.top = top + 'px';
  }
  let raf = 0; const schedule = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; place(); }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule); else schedule();
  addEventListener('resize', schedule); addEventListener('hashchange', () => setTimeout(schedule, 60));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  new MutationObserver(schedule).observe(field, { attributes: true, attributeFilter: ['data-state'] });
  setTimeout(schedule, 400); setTimeout(schedule, 1500);
})();
