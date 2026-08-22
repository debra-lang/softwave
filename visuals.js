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
      this.level = 0; this.t = 0; this.mode = 'calm'; // calm | rain | ocean | night | fire
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
    theme() {
      const dark = document.documentElement.dataset.theme === 'dark';
      return dark
        ? { a: 'hsla(226, 80%, 66%, ', b: 'hsla(190, 70%, 60%, ', p: 'rgba(200,215,255,', wave: 0.045 }
        : { a: 'hsla(226, 85%, 60%, ', b: 'hsla(190, 70%, 55%, ', p: 'rgba(63,108,240,', wave: 0.07 };
    }
    loop() {
      if (!this.running) return;
      requestAnimationFrame(() => this.loop());
      const ctx = this.ctx, w = this.w, h = this.h;
      const lv = this.engine.isPlaying ? this.engine.getLevels(this.freq) : 0;
      this.level += (lv - this.level) * 0.06;
      const L = this.level;
      this.t += reduced ? 0.002 : 0.006 + L * 0.01;
      const th = this.theme();
      ctx.clearRect(0, 0, w, h);

      // soft gradient blobs
      const g1 = ctx.createRadialGradient(w * (0.2 + Math.sin(this.t * 0.5) * 0.05), h * 0.15, 0, w * 0.2, h * 0.15, w * 0.6);
      g1.addColorStop(0, th.a + (0.12 + L * 0.25) + ')'); g1.addColorStop(1, th.a + '0)');
      ctx.fillStyle = g1; ctx.fillRect(0, 0, w, h);
      const g2 = ctx.createRadialGradient(w * (0.85 + Math.cos(this.t * 0.4) * 0.05), h * 0.8, 0, w * 0.85, h * 0.8, w * 0.6);
      g2.addColorStop(0, th.b + (0.10 + L * 0.2) + ')'); g2.addColorStop(1, th.b + '0)');
      ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);

      // flowing waves
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        const base = h * (0.55 + k * 0.13);
        const amp = (10 + k * 8) * (1 + L * 2.2);
        for (let x = 0; x <= w; x += 8) {
          const y = base + Math.sin(x * 0.004 + this.t * (1 + k * 0.3) + k) * amp + Math.sin(x * 0.011 - this.t * 0.7) * amp * 0.4;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
        ctx.fillStyle = (k % 2 ? th.b : th.a) + (Math.max(0.015, th.wave - k * 0.012) + L * 0.04) + ')';
        ctx.fill();
      }

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
          p.y -= p.s * (1 + L * 2); p.d += 0.01;
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
