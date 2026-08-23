/* Softwave Sound Field — the active sound as a visual environment.
   One renderer, many personalities. Every sound maps to a vector of layer weights and motion
   parameters; the live vector eases toward the target, so switching sounds morphs instead of cutting.
   Layers: rings (circular waves), flow (horizontal layers), fall (vertical trails), mist (fine particles),
   ribbons (thin flowing lines), ember (warm organic blobs), stars (slow points), swirl (circular airflow). */
(function (global) {
  'use strict';
  const TAU = Math.PI * 2;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduce';
  // personality vectors — weights 0..1 per layer, plus amp (size), speed, density, hue shift, weight (line thickness), warmth
  const P = {
    idle:      { rings: .7, flow: .15, fall: 0, mist: .25, ribbons: .15, ember: 0, stars: .15, swirl: 0, amp: 1.05, speed: .3, density: .45, hue: 0, weight: .9, warm: 0 },
    white:     { rings: .1, flow: 0, fall: 0, mist: 1, ribbons: 0, ember: 0, stars: 0, swirl: 0, amp: .6, speed: 1, density: 1, hue: 10, weight: .5, warm: .1 },
    pink:      { rings: .35, flow: .2, fall: 0, mist: .2, ribbons: 1, ember: 0, stars: 0, swirl: 0, amp: .8, speed: .7, density: .6, hue: 40, weight: .7, warm: .2 },
    brown:     { rings: 1, flow: 0, fall: 0, mist: 0, ribbons: 0, ember: 0, stars: 0, swirl: 0, amp: 1.3, speed: .35, density: .3, hue: -20, weight: 1.6, warm: .5 },
    static:    { rings: .15, flow: 0, fall: 0, mist: .8, ribbons: .3, ember: 0, stars: 0, swirl: 0, amp: .7, speed: .9, density: .9, hue: -10, weight: .5, warm: 0 },
    hiss:      { rings: .1, flow: 0, fall: 0, mist: .9, ribbons: .2, ember: 0, stars: 0, swirl: 0, amp: .6, speed: .8, density: .7, hue: -30, weight: .4, warm: 0 },
    rain:      { rings: .15, flow: 0, fall: 1, mist: .3, ribbons: 0, ember: 0, stars: 0, swirl: 0, amp: .8, speed: .8, density: .8, hue: -15, weight: .7, warm: 0 },
    ocean:     { rings: .15, flow: 1, fall: 0, mist: 0, ribbons: .2, ember: 0, stars: 0, swirl: 0, amp: 1.2, speed: .45, density: .5, hue: -20, weight: 1.2, warm: .1 },
    stream:    { rings: .1, flow: .8, fall: .2, mist: .3, ribbons: .4, ember: 0, stars: 0, swirl: 0, amp: .8, speed: .9, density: .7, hue: -25, weight: .7, warm: 0 },
    waterfall: { rings: .1, flow: 0, fall: .9, mist: .6, ribbons: 0, ember: 0, stars: 0, swirl: 0, amp: 1, speed: 1, density: .9, hue: -25, weight: .8, warm: 0 },
    forest:    { rings: .2, flow: .1, fall: 0, mist: .5, ribbons: .2, ember: 0, stars: .1, swirl: 0, amp: .8, speed: .35, density: .5, hue: -90, weight: .7, warm: .15 },
    wind:      { rings: .1, flow: .5, fall: 0, mist: .1, ribbons: 1, ember: 0, stars: 0, swirl: .2, amp: 1.1, speed: .6, density: .4, hue: -5, weight: .8, warm: 0 },
    night:     { rings: .2, flow: 0, fall: 0, mist: .1, ribbons: 0, ember: 0, stars: 1, swirl: 0, amp: .9, speed: .2, density: .6, hue: 30, weight: .6, warm: 0 },
    fan:       { rings: .4, flow: 0, fall: 0, mist: .2, ribbons: 0, ember: 0, stars: 0, swirl: 1, amp: .9, speed: .7, density: .5, hue: 10, weight: .8, warm: 0 },
    fire:      { rings: .3, flow: 0, fall: 0, mist: .1, ribbons: 0, ember: 1, stars: 0, swirl: 0, amp: .9, speed: .5, density: .6, hue: -150, weight: 1, warm: 1 },
    chimes:    { rings: .5, flow: 0, fall: 0, mist: .3, ribbons: .4, ember: 0, stars: .4, swirl: 0, amp: .8, speed: .4, density: .5, hue: 40, weight: .7, warm: .3 },
    thunder:   { rings: .9, flow: .2, fall: 0, mist: 0, ribbons: 0, ember: 0, stars: 0, swirl: 0, amp: 1.3, speed: .3, density: .3, hue: 20, weight: 1.6, warm: .2 },
    city:      { rings: .6, flow: .3, fall: 0, mist: .2, ribbons: 0, ember: .2, stars: .2, swirl: 0, amp: 1, speed: .35, density: .4, hue: 30, weight: 1, warm: .4 },
    cabin:     { rings: .8, flow: .2, fall: 0, mist: .1, ribbons: 0, ember: 0, stars: 0, swirl: .3, amp: 1.1, speed: .4, density: .3, hue: 0, weight: 1.3, warm: .2 },
  };
  const DESC = { white: 'Bright • Airy • Fine', pink: 'Balanced • Soft • Flowing', brown: 'Deep • Warm • Steady', static: 'Soft • Textured • Even', hiss: 'Airy • Smooth • Light', rain: 'Soft • Natural • Steady', ocean: 'Slow • Natural • Spacious', stream: 'Fluid • Moving • Clear', waterfall: 'Full • Constant • Misty', forest: 'Organic • Calm • Drifting', wind: 'Long • Flowing • Open', night: 'Still • Dark • Quiet', fan: 'Circular • Even • Familiar', fire: 'Warm • Slow • Organic', chimes: 'Gentle • Tonal • Wandering', thunder: 'Deep • Distant • Rolling', city: 'Low • Distant • Hum', cabin: 'Steady • Low • Enclosed', sculpt: 'Custom • Yours', discoA: 'Sound A', discoB: 'Sound B', paint: 'Painted • Yours' };
  function vectorFor(ids, custom) {
    // blend personalities of the active sounds, weighted by volume; custom sculpt params map onto the space
    if (!ids || !ids.length) return Object.assign({}, P.idle);
    const out = {}; let tot = 0;
    for (const { id, volume, params } of ids) { let v = P[id]; if (!v && params) v = fromParams(params); if (!v) v = P.pink; const wgt = Math.max(0.05, volume); tot += wgt; for (const k in P.idle) out[k] = (out[k] || 0) + (v[k] || 0) * wgt; }
    for (const k in out) out[k] /= tot; return out;
  }
  function fromParams(p) { const c = p.colour; const nat = P[p.nature] || null; const base = { rings: 1 - c, flow: 0, fall: 0, mist: c, ribbons: p.rich * 0.6, ember: Math.max(0, -p.warm) * 0.4, stars: 0, swirl: p.moving * 0.5, amp: 0.8 + (1 - c) * 0.5 + p.width * 0.3, speed: 0.4 + c * 0.5 + p.moving * 0.3, density: 0.3 + c * 0.6, hue: -p.warm * 40 + (c - 0.5) * 20, weight: 0.5 + (1 - c) * 1.1, warm: Math.max(0, -p.warm) }; if (nat) for (const k in base) base[k] = base[k] * 0.6 + nat[k] * 0.4; return base; }

  class Field {
    constructor(canvas) {
      this.c = canvas; this.ctx = canvas.getContext('2d'); this.cur = Object.assign({}, P.idle); this.target = Object.assign({}, P.idle); this.t = 0; this.last = 0; this.level = 0; this.balance = 0;
      this.mist = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), s: 0.2 + Math.random() * 0.8, ph: Math.random() * TAU }));
      this.drops = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), l: 0.04 + Math.random() * 0.08, s: 0.5 + Math.random() * 0.7 }));
      this.stars = Array.from({ length: 110 }, () => ({ a: Math.random() * TAU, r: 0.15 + Math.random() * 0.85, sz: 0.5 + Math.random() * 1.6, ph: Math.random() * TAU }));
      this.blobs = Array.from({ length: 7 }, (_, i) => ({ ph: i * 0.9, r: 0.12 + Math.random() * 0.14 }));
      this.dpr = Math.min(devicePixelRatio || 1, 1.75); this.low = navigator.hardwareConcurrency ? navigator.hardwareConcurrency <= 4 : false; this.fps = this.low ? 30 : 60; this.dark = true; this.alpha = 1;
    }
    set(ids) { this.target = vectorFor(ids); if (this.snapNext) { this.cur = Object.assign({}, this.target); this.snapNext = false; } }
    snap() { this.snapNext = true; }
    setLevel(l, bal) { this.level += (l - this.level) * 0.08; this.balance += ((bal || 0) - this.balance) * 0.05; }
    resize() { const r = this.c.getBoundingClientRect(); if (!r.width) return false; const W = Math.round(r.width * this.dpr), H = Math.round(r.height * this.dpr); if (this.c.width !== W || this.c.height !== H) { this.c.width = W; this.c.height = H; } this.w = r.width; this.h = r.height; this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); return true; }
    draw(now) {
      if (!this.resize()) return; const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016); this.last = now;
      const red = reduced(); const k = red ? 0.08 : 0.07; for (const key in this.target) this.cur[key] += (this.target[key] - this.cur[key]) * k;   // the morph
      const v = this.cur; const motion = red ? 0.12 : 1; this.t += dt * v.speed * motion * (0.6 + this.level * 0.4);
      const ctx = this.ctx, w = this.w, h = this.h, cx = w / 2 + this.balance * w * 0.04, cy = h / 2; const R = Math.min(w, h) * 0.46 * v.amp; const t = this.t; const L = this.level;
      const dark = document.documentElement.dataset.theme === 'dark'; const hue = 222 + v.hue; const lum = dark ? 72 : 48; const sat = (dark ? 62 : 50) + v.warm * 20; const col = (a, dh = 0, dl = 0) => `hsla(${hue + dh},${sat}%,${lum + dl}%,${a})`;
      ctx.clearRect(0, 0, w, h);
      // soft ground glow
      const gr = Math.min(R * 1.25, Math.min(w, h) * 0.5 - 1); const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr); g.addColorStop(0, col(dark ? 0.3 : 0.2, 0, dark ? -10 : 10)); g.addColorStop(1, col(0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, gr, 0, TAU); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * 0.5, 0, TAU); ctx.clip();
      // RINGS — circular waves breathing outward
      if (v.rings > 0.02) { const n = 4 + Math.round(v.density * 4); for (let i = 0; i < n; i++) { const p = ((t * 0.12 + i / n) % 1); const r = R * (0.18 + p * 0.95); const wob = 0.015 + (1 - v.density) * 0.02 + L * 0.02; ctx.beginPath(); for (let j = 0; j <= 110; j++) { const a = j / 110 * TAU; const rr = r * (1 + wob * Math.sin(a * 3 + t * 0.7 + i) + wob * 0.6 * Math.sin(a * 5 - t * 0.5)); ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } ctx.closePath(); ctx.strokeStyle = col(v.rings * (1 - p) * 0.95 * (0.7 + L * 0.5)); ctx.lineWidth = (1.2 + (1 - p) * 3) * v.weight; ctx.stroke(); } }
      // FLOW — horizontal layered waves moving sideways
      if (v.flow > 0.02) { const n = 5; for (let i = 0; i < n; i++) { const y0 = cy + (i - (n - 1) / 2) * R * 0.28; const amp = R * (0.06 + i * 0.015) * (1 + L * 0.8); ctx.beginPath(); for (let x = cx - R * 1.1; x <= cx + R * 1.1; x += 6) { const u = (x - cx) / R; ctx.lineTo(x, y0 + Math.sin(u * 2.6 + t * (0.9 + i * 0.12) + i * 1.1) * amp + Math.sin(u * 6 - t * 0.6) * amp * 0.35); } ctx.strokeStyle = col(v.flow * (0.85 - i * 0.1)); ctx.lineWidth = (2.8 - i * 0.25) * v.weight; ctx.lineCap = 'round'; ctx.stroke(); } }
      // FALL — vertical trails and droplets
      if (v.fall > 0.02) { ctx.lineCap = 'round'; for (const d of this.drops) { d.y += d.s * dt * 0.35 * motion * v.speed; if (d.y > 1.05) { d.y = -0.1; d.x = Math.random(); } const x = cx + (d.x - 0.5) * R * 2.1, y = cy + (d.y - 0.5) * R * 2.1; const a = v.fall * 0.9 * (1 - Math.abs(d.y - 0.5) * 1.4); if (a <= 0) continue; ctx.strokeStyle = col(a, 0, 8); ctx.lineWidth = 1.5 * v.weight; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + d.l * R * 2); ctx.stroke(); } }
      // MIST — fine particles (airy / bright)
      if (v.mist > 0.02) { const n = Math.round(this.mist.length * (this.low ? 0.5 : 1) * (0.4 + v.density * 0.6)); for (let i = 0; i < n; i++) { const m = this.mist[i]; m.y -= m.s * dt * 0.05 * motion * (0.5 + v.speed); m.x += Math.sin(t * 0.7 + m.ph) * 0.0008 * motion; if (m.y < 0) m.y = 1; const x = cx + (m.x - 0.5) * R * 2.1, y = cy + (m.y - 0.5) * R * 2.1; const d = Math.hypot(x - cx, y - cy) / R; if (d > 1.05) continue; const a = v.mist * (1.1 - d * 0.7) * (0.6 + 0.4 * Math.sin(t * 1.3 + m.ph)); ctx.fillStyle = col(Math.min(1, Math.max(0, a)), 0, 14); ctx.beginPath(); ctx.arc(x, y, 1.3 + m.s * 2.2 * v.weight, 0, TAU); ctx.fill(); } }
      // RIBBONS — thin flowing lines
      if (v.ribbons > 0.02) { for (let i = 0; i < 6; i++) { ctx.beginPath(); for (let x = cx - R * 1.1; x <= cx + R * 1.1; x += 5) { const u = (x - cx) / R; const y = cy + Math.sin(u * 1.8 + t * 0.5 + i * 1.3) * R * 0.32 + Math.sin(u * 4.2 - t * 0.35 + i) * R * 0.1 + (i - 2.5) * R * 0.07; ctx.lineTo(x, y); } ctx.strokeStyle = col(v.ribbons * 0.6, i * 6); ctx.lineWidth = 1.4 * v.weight; ctx.stroke(); } }
      // EMBER — warm organic blobs rising slowly
      if (v.ember > 0.02) { ctx.save(); ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over'; for (const b of this.blobs) { const ph = t * 0.25 + b.ph; const x = cx + Math.sin(ph * 1.3) * R * 0.35, y = cy + R * 0.25 - ((ph * 0.35) % 1.4) * R * 0.9; const r = R * b.r * (1 + L * 0.4); const gg = ctx.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, `hsla(${28 - v.warm * 10},95%,${dark ? 62 : 58}%,${v.ember * 0.55})`); gg.addColorStop(1, 'hsla(28,95%,60%,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); } ctx.restore(); }
      // STARS — very slow points
      if (v.stars > 0.02) { for (const s of this.stars) { const a = s.a + t * 0.02; const x = cx + Math.cos(a) * s.r * R, y = cy + Math.sin(a) * s.r * R; const tw = 0.5 + 0.5 * Math.sin(t * 0.5 + s.ph); ctx.fillStyle = col(Math.min(1, v.stars * (0.5 + tw * 0.7)), 10, 22); ctx.beginPath(); ctx.arc(x, y, s.sz * 1.5, 0, TAU); ctx.fill(); } }
      // SWIRL — circular airflow
      if (v.swirl > 0.02) { for (let i = 0; i < 5; i++) { const r = R * (0.3 + i * 0.16); const a0 = t * (0.5 + i * 0.08) + i; ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + 1.6 + L); ctx.strokeStyle = col(v.swirl * (0.7 - i * 0.08)); ctx.lineWidth = 2.4 * v.weight; ctx.lineCap = 'round'; ctx.stroke(); } }
      ctx.restore();
    }
  }

  // Tiny preview variant for tiles: same renderer, lower fps, fixed personality
  class Preview extends Field { constructor(c, id) { super(c); this.cur = Object.assign({}, P[id] || P.pink); this.target = this.cur; this.dpr = 1; this.fps = 12; } }

  global.SoftwaveField = { Field, Preview, P, DESC, vectorFor };
})(window);
