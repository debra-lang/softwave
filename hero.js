/* Find My Quiet Sound — Sounds opening: places the field-of-sound artwork (hero-wave.webp, extracted
   from the approved reference) so that the artwork's cleared disc sits exactly under the real Start
   Listening control, at every viewport size. Layout only: no drawing, no audio, no pointer events. */
(function () {
  'use strict';
  const wrap = document.querySelector('#sf-stage .field-wrap'), box = wrap && wrap.querySelector('.hero-wave'), field = document.getElementById('field');
  if (!wrap || !box || !field) return;
  const ART_W = 850, ART_H = 495, DISC_X = 425 / 850, DISC_Y = 274 / 495, DISC_D = (2 * 163) / 850;   // the cleared disc inside the artwork
  const atmo = wrap.querySelector('.hero-atmo');
  let last = '';
  function fit(el, w, cx, cy) { const hgt = w * ART_H / ART_W; el.style.width = w + 'px'; el.style.height = hgt + 'px'; el.style.left = (cx - w * DISC_X) + 'px'; el.style.top = (cy - hgt * DISC_Y) + 'px'; }
  function place() {
    const wr = wrap.getBoundingClientRect(), fr = field.getBoundingClientRect(); if (!wr.width || !fr.width) return;
    const vw = document.documentElement.clientWidth;
    const cx = fr.left + fr.width / 2 - wr.left, cy = fr.top + fr.height / 2 - wr.top;
    // the artwork's disc must sit exactly under the real control, so its width follows the circle, not the viewport
    const w = fr.width / DISC_D;
    const key = [vw, Math.round(w), Math.round(cx), Math.round(cy)].join(','); if (key === last) return; last = key;
    fit(box, w, cx, cy);
    // wider screens: the same artwork once more, wide and faint, as the surrounding field
    if (atmo) { if (vw >= 720) { atmo.hidden = false; fit(atmo, Math.min(vw, 1280), cx, cy); } else atmo.hidden = true; }
  }
  let raf = 0; const schedule = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; place(); }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule); else schedule();
  addEventListener('resize', schedule); addEventListener('hashchange', () => setTimeout(schedule, 60));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  new MutationObserver(schedule).observe(field, { attributes: true, attributeFilter: ['data-state'] });
  setTimeout(schedule, 400); setTimeout(schedule, 1500);
})();
