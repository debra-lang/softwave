/* Softwave — visuals
   Background: soft drifting waves + particles + rings that react gently to the
   master analyser level. Designed to be calm, not distracting. Respects
   prefers-reduced-motion and pauses when the tab is hidden.
*/
(function (global) {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  class Background {
    constructor(canvas, engine) {
      this.c = canvas; this.ctx = canvas.getContext('2d'); this.engine = engine;
      this.freq = new Uint8Array(512);
      this.level = 0; this.t = 0; this.mode = 'calm'; // calm | rain | ocean | night | fire | lab
      this.env = { amp: 1, speed: 1, hue: 0, vertical: 0, horizontal: 0, density: 1 }; this.envTarget = Object.assign({}, this.env);
      this.particles = Array.from({ length: 50 }, () => this._p(true));
      this.drops = Array.from({ length: 90 }, () => this._drop(true));
      this.resize(); addEventListener('resize', () => this.resize());
      this.running = true;
      document.addEventListener('visibilitychange', () => { this.running = !document.hidden; if (this.running) this.loop(); });
      this.loop();
    }
    _p(init) { return { x: Math.random(), y: init ? Math.random() : 1.05, r: 1 + Math.random() * 2.5, s: 0.0002 + Math.random() * 0.0005, o: 0.2 + Math.random() * 0.5, d: Math.random() * Math.PI * 2 }; }
    _drop(init) { return { x: Math.random(), y: init ? Math.random() : -0.05, l: 0.02 + Math.random() * 0.04, s: 0.006 + Math.random() * 0.008, o: 0.15 + Math.random() * 0.3 }; }
    resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      this.w = innerWidth; this.h = innerHeight;
      this.c.width = this.w * dpr; this.c.height = this.h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    setMode(m) { this.mode = m; }
    // The environment follows the dominant sound: deeper sounds → larger, slower waves; bright → finer; rain → vertical; ocean → horizontal flow.
    setEnv(id) {
      const P = (window.SoftwaveVisuals.paramsFor || (() => ({})))(id); const p = Object.assign({ colour: 0.4, warm: 0, moving: 0, nature: 'none' }, P || {});
      this.envTarget = { amp: id ? 1.15 + (1 - p.colour) * 0.9 : 1, speed: id ? 0.7 + p.colour * 0.5 + p.moving * 0.3 : 1, hue: id ? -p.warm * 30 + (p.colour - 0.5) * 12 : 0, vertical: p.nature === 'rain' || p.nature === 'stream' ? 1 : 0, horizontal: p.nature === 'ocean' || p.nature === 'wind' ? 1 : 0, density: id ? 0.6 + p.colour * 0.9 : 1 };
    }
    theme() {
      const dark = document.documentElement.dataset.theme === 'dark';
      return dark
        ? { a: 'hsla(226, 80%, 66%, ', b: 'hsla(190, 70%, 60%, ', p: 'rgba(200,215,255,', wave: 0.045, blob: 0.12 }
        : { a: 'hsla(226, 85%, 56%, ', b: 'hsla(190, 72%, 48%, ', p: 'rgba(63,108,240,', wave: 0.105, blob: 0.17 };
    }
    loop() {
      if (!this.running) return;
      requestAnimationFrame(() => this.loop());
      // The page atmosphere is slow-moving: 20 fps is plenty, and it leaves the frame budget to the Sound Field (audio first).
      const nowT = performance.now(); if (this._lastT && nowT - this._lastT < 48) return; this._lastT = nowT;
      const ctx = this.ctx, w = this.w, h = this.h;
      const lv = this.engine.isPlaying ? this.engine.getLevels(this.freq) : 0;
      this.level += (lv - this.level) * 0.06;
      const L = this.level;
      this.t += (reduced ? 0.002 : 0.006 + L * 0.01) * this.env.speed;
      const th = this.theme(); const E = this.env, T = this.envTarget; for (const k in T) E[k] += (T[k] - E[k]) * 0.02;   // slow, gradual environment shifts
      ctx.clearRect(0, 0, w, h);

      // soft gradient blobs
      const g1 = ctx.createRadialGradient(w * (0.2 + Math.sin(this.t * 0.5) * 0.05), h * 0.15, 0, w * 0.2, h * 0.15, w * 0.6);
      g1.addColorStop(0, th.a + (th.blob + L * 0.25) + ')'); g1.addColorStop(1, th.a + '0)');
      ctx.fillStyle = g1; ctx.fillRect(0, 0, w, h);
      const g2 = ctx.createRadialGradient(w * (0.85 + Math.cos(this.t * 0.4) * 0.05), h * 0.8, 0, w * 0.85, h * 0.8, w * 0.6);
      g2.addColorStop(0, th.b + (th.blob * 0.85 + L * 0.2) + ')'); g2.addColorStop(1, th.b + '0)');
      ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);

      // flowing waves — large, translucent, the Softwave signature; scale with the environment
      const hueShift = this.env.hue; const wA = (s) => s.replace(/hsla\((\d+)/, (m, d) => `hsla(${+d + hueShift}`);
      for (let k = 0; k < (this.mode === 'lab' ? 2 : 4); k++) {
        ctx.beginPath();
        const base = h * (0.42 + k * 0.14) - (this.env.horizontal ? 0 : 0);
        const amp = (16 + k * 10) * (1 + L * 2.2) * this.env.amp;
        for (let x = 0; x <= w; x += 8) {
          const y = base + Math.sin(x * (0.0035 / this.env.amp) + this.t * (1 + k * 0.3) + k + this.env.horizontal * this.t * 0.6) * amp + Math.sin(x * 0.011 - this.t * 0.7) * amp * 0.4;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
        ctx.fillStyle = wA(k % 2 ? th.b : th.a) + (Math.max(0.015, th.wave - k * 0.01) + L * 0.04) + ')';
        ctx.fill();
      }
      // rain / stream: faint vertical streaks; lab: frequency field
      if (this.env.vertical > 0.05 && !reduced) { ctx.strokeStyle = th.p + (0.08 * this.env.vertical) + ')'; ctx.lineWidth = 1; for (let i = 0; i < 40; i++) { const x = ((i * 131) % 1000) / 1000 * w; const y = (((i * 77) + this.t * 420) % 1000) / 1000 * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 26); ctx.stroke(); } }
      if (this.mode === 'lab') { ctx.lineWidth = 1.2; for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let x = 0; x <= w; x += 6) { const u = x / w; const y = h * 0.8 - Math.exp(-Math.pow((u - 0.25 - k * 0.22 + Math.sin(this.t * 0.3 + k) * 0.03) * 5.5, 2)) * h * 0.3 * (1 + L) - Math.sin(u * 24 + this.t * 2) * 3; ctx.lineTo(x, y); } ctx.strokeStyle = `hsla(${150 + k * 30},70%,65%,${0.18 - k * 0.04})`; ctx.stroke(); } }

      // pulsating rings when playing
      if (L > 0.01) {
        const cx = w * 0.5, cy = h * 0.42;
        for (let i = 0; i < 3; i++) {
          const ph = ((this.t * 0.6 + i / 3) % 1);
          ctx.beginPath(); ctx.arc(cx, cy, (60 + ph * 260) * (1 + L), 0, Math.PI * 2);
          ctx.strokeStyle = th.p + ((1 - ph) * 0.18 * (0.4 + L)) + ')'; ctx.lineWidth = 1.5; ctx.stroke();
        }
      }

      // particles
      if (!reduced) {
        for (const p of this.particles) {
          if (this.env.density < 0.8 && p.r > 2.2) continue;
          p.y -= p.s * (1 + L * 2) * this.env.speed; p.d += 0.01;
          const x = (p.x + Math.sin(p.d) * 0.01) * w, y = p.y * h;
          ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = th.p + (p.o * (0.3 + L)) + ')'; ctx.fill();
          if (p.y < -0.05) Object.assign(p, this._p(false));
        }
        // rain
        if (this.mode === 'rain') {
          ctx.strokeStyle = th.p + '0.35)'; ctx.lineWidth = 1;
          for (const d of this.drops) {
            d.y += d.s; const x = d.x * w, y = d.y * h;
            ctx.globalAlpha = d.o; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + d.l * h); ctx.stroke();
            if (d.y > 1.05) Object.assign(d, this._drop(false));
          }
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  // Spectrum / waveform visualiser for tone panels
  class ToneViz {
    constructor(canvas, engine, getFreq) {
      this.c = canvas; this.ctx = canvas.getContext('2d'); this.engine = engine; this.getFreq = getFreq;
      this.wave = new Uint8Array(1024); this.t = 0; this.resize();
      new ResizeObserver(() => this.resize()).observe(canvas);
      this.loop();
    }
    resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2); const r = this.c.getBoundingClientRect();
      this.w = r.width || 600; this.h = r.height || 150; this.c.width = this.w * dpr; this.c.height = this.h * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    loop() {
      requestAnimationFrame(() => this.loop());
      if (this.c.offsetParent === null) return; // hidden
      const ctx = this.ctx, w = this.w, h = this.h; this.t += 0.02;
      const dark = document.documentElement.dataset.theme === 'dark';
      ctx.clearRect(0, 0, w, h);
      const f = this.getFreq();
      const playing = this.engine.tone && this.engine.tone.playing;
      // bars: log-spaced spectrum of playing audio, with tone highlighted
      const freq = new Uint8Array(512); if (playing || this.engine.isPlaying) this.engine.getLevels(freq);
      const n = 64; const minF = 20, maxF = 16000; const nyq = (this.engine.ctx ? this.engine.ctx.sampleRate : 48000) / 2;
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, dark ? '#6fd1e0' : '#5fb8c9'); grad.addColorStop(1, dark ? '#7c9cff' : '#3f6cf0');
      const pos = Math.log(f / minF) / Math.log(maxF / minF);
      for (let i = 0; i < n; i++) {
        const fr = minF * Math.pow(maxF / minF, i / n);
        const bin = Math.min(511, Math.floor(fr / nyq * 512));
        let v = freq[bin] / 255;
        const dist = Math.abs(i / n - pos);
        const ghost = Math.max(0, 1 - dist * 14) * (playing ? 1 : 0.45);
        v = Math.max(v, ghost * (0.7 + Math.sin(this.t * 3 + i) * 0.08));
        const bh = Math.max(3, v * (h - 14));
        const bw = w / n;
        ctx.globalAlpha = 0.35 + v * 0.65;
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.roundRect(i * bw + 2, h - bh - 6, bw - 4, bh, 4); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // marker line
      const x = pos * w;
      ctx.strokeStyle = dark ? 'rgba(232,236,247,.5)' : 'rgba(19,26,46,.35)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, h - 4); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  global.SoftwaveVisuals = { Background, ToneViz };
})(window);

/* ===== The Softwave — a generative sound shape used across the product =====
   soundShape(ctx, w, h, p, t, level, opts)
   p: { colour 0..1 (deep→bright), warm -1..1, deep -1..1, smooth -1..1 (texture), soft -1..1, width 0..1,
        moving 0..1, rich 0..1, mod 0..1, nature: 'none'|'rain'|'ocean'|'wind'|'forest'|'stream' }
   Draws concentric organic rings whose hue, fineness, spread, wobble and drift come from the parameters,
   with a soft core that breathes with the audio level. Calm by design: no beats, no flashes. */
(function (global) {
  const TAU = Math.PI * 2;
  const SOUND_PARAMS = {
    white: { colour: 1, warm: 0.3, width: 0.5 }, pink: { colour: 0.5, width: 0.4 }, brown: { colour: 0.02, warm: -0.4, deep: -0.5, width: 0.3 },
    static: { colour: 0.75, smooth: 0.6 }, hiss: { colour: 0.95, soft: -0.5, deep: 0.6 }, rain: { colour: 0.55, nature: 'rain', smooth: 0.3 },
    ocean: { colour: 0.15, nature: 'ocean', moving: 0.5, mod: 0.3, warm: -0.2 }, stream: { colour: 0.5, nature: 'stream', smooth: 0.4 },
    waterfall: { colour: 0.55, nature: 'stream', rich: 0.5 }, forest: { colour: 0.4, nature: 'forest', moving: 0.3 }, wind: { colour: 0.3, nature: 'wind', moving: 0.7, mod: 0.4 },
    fan: { colour: 0.35, warm: -0.1, rich: 0.3 }, fire: { colour: 0.05, warm: -0.9, mod: 0.45, smooth: 0.5 }, night: { colour: 0.5, nature: 'forest', moving: 0.2, rich: 0.4 },
    chimes: { colour: 0.6, rich: 0.9, moving: 0.4 }, thunder: { colour: 0, warm: -0.3, mod: 0.6 }, city: { colour: 0.1, warm: -0.2 }, cabin: { colour: 0.1, deep: -0.5 },
  };
  const DEF = { colour: 0.4, warm: 0, deep: 0, smooth: 0, soft: 0, width: 0.35, moving: 0, rich: 0, mod: 0, nature: 'none' };
  function paramsFor(id, params) { return Object.assign({}, DEF, SOUND_PARAMS[id] || {}, params || {}); }
  function hueFor(p) { return 222 - p.warm * 48 + (p.colour - 0.5) * 24; }
  function soundShape(ctx, w, h, p0, t, level = 0, o = {}) {
    const p = Object.assign({}, DEF, p0); const dark = o.dark !== undefined ? o.dark : document.documentElement.dataset.theme === 'dark';
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * (o.scale || 0.36); const hue = hueFor(p); const L = dark ? 66 : 52; const lv = Math.min(1, level);
    const rings = 3 + Math.round(p.rich * 4) + Math.round(p.colour * 3);            // brighter/richer = more, finer lines
    const thick = 1 + (1 - p.colour) * 3.5 + Math.max(0, -p.soft) * 1.5;            // deeper/softer = thicker, softer lines
    const wob = 0.02 + Math.max(0, p.smooth) * 0.12 + lv * 0.03;                     // texture = wobble
    const spread = 0.55 + p.width * 0.45;                                            // width = spread of rings
    const drift = p.moving * 0.6; const breathe = 1 + (p.mod * 0.08 + lv * 0.08) * Math.sin(t * (0.6 + p.mod * 0.5));
    if (o.glow !== false) { const gr = Math.min(R * 1.6, Math.min(w, h) / 2 - 1); const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr); g.addColorStop(0, `hsla(${hue},80%,${L}%,${dark ? 0.28 : 0.22})`); g.addColorStop(1, `hsla(${hue},80%,${L}%,0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, gr, 0, TAU); ctx.fill(); }
    // nature hints behind the rings
    ctx.save(); ctx.globalAlpha = 0.5;
    if (p.nature === 'rain') { ctx.strokeStyle = `hsla(${hue + 10},70%,${L + 10}%,0.35)`; ctx.lineWidth = 1; for (let i = 0; i < 26; i++) { const x = cx + ((i * 37) % 100 - 50) / 50 * R * 1.5; const y = cy + (((i * 53 + t * 40 * (1 + (i % 3) * 0.3)) % 100) - 50) / 50 * R * 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + R * 0.12); ctx.stroke(); } }
    if (p.nature === 'ocean') { for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let x = -R * 1.6; x <= R * 1.6; x += 8) ctx.lineTo(cx + x, cy + R * (0.3 + k * 0.35) + Math.sin(x / R * 3 + t * 0.8 + k) * R * 0.08); ctx.strokeStyle = `hsla(${hue},70%,${L}%,${0.25 - k * 0.06})`; ctx.lineWidth = 2; ctx.stroke(); } }
    if (p.nature === 'wind') { for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(cx + Math.sin(t * 0.5 + k) * R * 0.4, cy, R * (0.9 + k * 0.25), Math.PI * 1.1 + k * 0.2, Math.PI * 1.6 + k * 0.2); ctx.strokeStyle = `hsla(${hue},60%,${L}%,0.2)`; ctx.lineWidth = 1.5; ctx.stroke(); } }
    if (p.nature === 'forest') { ctx.fillStyle = `hsla(130,45%,${L}%,0.45)`; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + t * 0.05; const r = R * (1.1 + (i % 3) * 0.15); ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3.5, 1.6, a, 0, TAU); ctx.fill(); } }
    if (p.nature === 'stream') { ctx.strokeStyle = `hsla(${hue + 5},70%,${L + 8}%,0.35)`; ctx.lineWidth = 1; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + t * 0.2; const r = R * (1.05 + ((t * 0.15 + i * 0.08) % 0.4)); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.5, 0, TAU); ctx.stroke(); } }
    ctx.restore();
    for (let k = 0; k < rings; k++) {
      const base = R * (0.3 + (k / rings) * spread) * breathe; const ph = t * (0.25 + k * 0.07) * (1 + drift) + k * 1.7; ctx.beginPath();
      for (let i = 0; i <= 96; i++) { const a = i / 96 * TAU; const r = base * (1 + wob * Math.sin(a * (3 + k % 3) + ph) + wob * 0.5 * Math.sin(a * (5 + k) - ph * 1.3)); const dx = Math.cos(a) * r * (1 + p.width * 0.25), dy = Math.sin(a) * r; ctx.lineTo(cx + dx + Math.sin(t * 0.3 + k) * drift * R * 0.08, cy + dy); }
      ctx.closePath(); ctx.strokeStyle = `hsla(${hue + k * 4},${70 + p.colour * 15}%,${L + k * 2}%,${0.55 - k * (0.4 / rings)})`; ctx.lineWidth = thick * (1 - k / rings * 0.5); ctx.stroke();
    }
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.28 * breathe); cg.addColorStop(0, `hsla(${hue},85%,${dark ? 80 : 70}%,0.95)`); cg.addColorStop(1, `hsla(${hue},85%,${L}%,0)`); ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, R * 0.28 * breathe, 0, TAU); ctx.fill();
  }
  global.SoftwaveVisuals.soundShape = soundShape; global.SoftwaveVisuals.paramsFor = paramsFor; global.SoftwaveVisuals.hueFor = hueFor;
})(window);
