/* Softwave — Visual Focus
   A library of slow, procedural Canvas visuals, a full-screen Focus Mode, a
   breathing guide, pairings and saved combinations. Every visual is driven by
   a shared `env` (audio level, spectrum, tone frequency, pointer, taps, motion
   level) and a per-instance clock `t`, so movement can be slowed, stilled or
   paused at any time. Nothing flashes; everything eases.
*/
(function () {
  'use strict';
  const engine = window.softwave;
  const app = window.softwaveApp;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a = 1, b = 0) => b + Math.random() * (a - b);
  const isDark = () => document.documentElement.dataset.theme === 'dark';

  // Seeded-looking but cheap value noise for organic motion
  function noise2(x, y) {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s);
  }
  function smoothNoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(noise2(xi, yi), noise2(xi + 1, yi), u), lerp(noise2(xi, yi + 1), noise2(xi + 1, yi + 1), u), v);
  }

  // ---------- palette helpers ----------
  function sky(ctx, w, h, top, bottom) { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(1, bottom); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  function glow(ctx, x, y, r, color, a = 1) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color.replace('A)', a + ')')); g.addColorStop(1, color.replace('A)', '0)')); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }

  // ---------- VISUALS ----------
  // Each: { id, name, cat, desc, make() -> { draw(ctx, w, h, env) } }
  // env: { dt, speed, t(global), level, spec, wave, freq, pointer:{x,y,on}, taps:[{x,y,age}], breathText, reduced, still }
  const V = [];
  const add = (d) => V.push(d);
  const P = { target: 'light', sync: true, haptic: false, soundTouch: false, breathPeriod: 0 };   // experiment parameters

  // ===== NATURE =====
  add({ id: 'ocean', name: 'Ocean Waves', cat: 'Nature', desc: 'Slow rolling swells at dusk.', make() {
    let t = 0; return { draw(ctx, w, h, e) { t += e.dt * e.speed * 0.5;
      sky(ctx, w, h, isDark() ? '#0a1330' : '#dfe9f7', isDark() ? '#123a5c' : '#7fb0d8');
      glow(ctx, w * 0.7, h * 0.22, w * 0.25, isDark() ? 'rgba(255,220,170,A)' : 'rgba(255,240,200,A)', 0.35);
      for (let k = 0; k < 6; k++) { const base = h * (0.45 + k * 0.1); const amp = 6 + k * 5; ctx.beginPath();
        for (let x = 0; x <= w; x += 6) { const y = base + Math.sin(x * 0.006 + t * (0.8 + k * 0.15) + k * 1.7) * amp + Math.sin(x * 0.017 - t * 0.5 + k) * amp * 0.35 + Math.sin(t * 0.25 + k) * 8; ctx.lineTo(x, y); }
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
        const l = isDark() ? 18 + k * 5 : 52 + k * 5; ctx.fillStyle = `hsla(${205 + k * 3},55%,${l}%,0.85)`; ctx.fill();
        ctx.strokeStyle = `hsla(200,60%,${l + 30}%,${0.18 - k * 0.02})`; ctx.lineWidth = 2; ctx.stroke(); }
    } }; } });

  add({ id: 'rainwindow', name: 'Rain on a Window', cat: 'Nature', desc: 'Drops gathering and sliding down glass.', make() {
    let t = 0; const drops = Array.from({ length: 55 }, () => ({ x: Math.random(), y: Math.random(), r: rnd(5, 2), v: 0, w: 0 })); const dots = Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), r: rnd(1.6, 0.5) })); const bokeh = Array.from({ length: 12 }, () => ({ x: Math.random(), y: rnd(0.8, 0.1), r: rnd(0.14, 0.05), h: rnd(60, 20) })); const trails = [];
    return { draw(ctx, w, h, e) { t += e.dt * e.speed; const sc = Math.max(1, Math.min(w, h) / 420);
      sky(ctx, w, h, isDark() ? '#0f1424' : '#8a99b3', isDark() ? '#070a14' : '#4c5d7c');
      for (const b of bokeh) glow(ctx, b.x * w + Math.sin(t * 0.1 + b.h) * 10, b.y * h, b.r * w, `hsla(${b.h + 180},60%,70%,A)`, isDark() ? 0.22 : 0.28);
      // fine mist of droplets that never move
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; for (const d of dots) { ctx.beginPath(); ctx.arc(d.x * w, d.y * h, d.r, 0, TAU); ctx.fill(); }
      // wet trails left by sliding drops, fading slowly
      for (let i = trails.length - 1; i >= 0; i--) { const tr = trails[i]; tr.a -= e.dt * 0.04 * Math.max(e.speed, 0.2); if (tr.a <= 0) { trails.splice(i, 1); continue; } ctx.strokeStyle = `rgba(255,255,255,${tr.a * 0.35})`; ctx.lineWidth = tr.w * sc; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tr.x * w, tr.y0 * h); ctx.lineTo(tr.x * w, tr.y1 * h); ctx.stroke(); }
      for (const d of drops) {
        if (d.v === 0 && Math.random() < 0.0035 * e.speed) { d.v = rnd(0.22, 0.08); d.w = d.r * 0.9; trails.push({ x: d.x, y0: d.y, y1: d.y, w: d.w, a: 1, ref: d }); }
        if (d.v > 0) { d.y += d.v * e.dt * e.speed; d.v *= (1 - 0.35 * e.dt * e.speed); const tr = trails.find(q => q.ref === d); if (tr) tr.y1 = d.y; if (d.v < 0.02) { d.v = 0; } }
        if (d.y > 1.05) { d.y = rnd(0.3, -0.05); d.x = Math.random(); d.v = 0; trails.forEach(q => { if (q.ref === d) q.ref = null; }); }
        const x = d.x * w, y = d.y * h; const r = d.r * sc; const len = r * (1.2 + d.v * 12);
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r * 1.2); g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(0.5, 'rgba(220,235,255,0.35)'); g.addColorStop(1, 'rgba(200,220,255,0.08)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r, len, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.8; ctx.stroke();
      }
    } }; } });

  add({ id: 'river', name: 'Flowing River', cat: 'Nature', desc: 'Water gliding past, glints drifting by.', make() {
    let t = 0; const glints = Array.from({ length: 60 }, () => ({ x: Math.random(), y: rnd(0.95, 0.35), l: rnd(60, 15), s: rnd(0.25, 0.08) }));
    return { draw(ctx, w, h, e) { t += e.dt * e.speed;
      sky(ctx, w, h, isDark() ? '#0f1c2e' : '#cfe2ee', isDark() ? '#15384a' : '#5d9db5');
      ctx.fillStyle = isDark() ? '#08121c' : '#3c6b3e'; ctx.beginPath(); ctx.moveTo(0, h * 0.3); for (let x = 0; x <= w; x += 40) ctx.lineTo(x, h * 0.3 + smoothNoise(x * 0.01, 3) * 30 - 15); ctx.lineTo(w, 0); ctx.lineTo(0, 0); ctx.fill();
      for (let k = 0; k < 10; k++) { const y0 = h * (0.38 + k * 0.065); ctx.beginPath(); for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y0 + Math.sin(x * 0.02 - t * (1.2 + k * 0.1) + k) * 3 + Math.sin(x * 0.005 - t * 0.4) * 5); ctx.strokeStyle = `hsla(195,50%,${isDark() ? 45 : 85}%,${0.12})`; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.strokeStyle = isDark() ? 'rgba(220,240,255,0.35)' : 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5;
      for (const g of glints) { g.x += g.s * e.dt * e.speed * 0.6; if (g.x > 1.1) g.x = -0.1; ctx.beginPath(); ctx.moveTo(g.x * w, g.y * h); ctx.lineTo(g.x * w + g.l, g.y * h + Math.sin(t + g.y * 9) * 2); ctx.stroke(); }
    } }; } });

  add({ id: 'waterfall', name: 'Waterfall', cat: 'Nature', desc: 'A curtain of falling water and soft mist.', make() {
    let t = 0; const streaks = Array.from({ length: 90 }, () => ({ x: rnd(0.72, 0.28), y: Math.random(), l: rnd(0.18, 0.05), s: rnd(0.9, 0.5), a: rnd(0.5, 0.15) })); const mist = Array.from({ length: 40 }, () => ({ x: rnd(0.9, 0.1), y: rnd(1, 0.7), r: rnd(50, 15), s: rnd(0.05, 0.01) }));
    return { draw(ctx, w, h, e) { t += e.dt * e.speed;
      sky(ctx, w, h, isDark() ? '#0b1a22' : '#d9ecef', isDark() ? '#0a2a30' : '#86b9bc');
      ctx.fillStyle = isDark() ? '#0a1519' : '#4d6a5a'; ctx.fillRect(0, 0, w * 0.26, h); ctx.fillRect(w * 0.74, 0, w * 0.26, h);
      for (const s of streaks) { s.y += s.s * e.dt * e.speed * 0.7; if (s.y > 1.1) { s.y = -s.l; s.x = rnd(0.72, 0.28); } ctx.strokeStyle = `rgba(235,248,255,${s.a})`; ctx.lineWidth = rnd(2, 1); ctx.beginPath(); ctx.moveTo(s.x * w, s.y * h); ctx.lineTo(s.x * w + 1, (s.y + s.l) * h); ctx.stroke(); }
      for (const m of mist) { m.y -= m.s * e.dt * e.speed; if (m.y < 0.6) m.y = 1.05; glow(ctx, m.x * w, m.y * h, m.r, 'rgba(230,245,255,A)', 0.12); }
    } }; } });

  add({ id: 'fireplace', name: 'Fireplace', cat: 'Nature', desc: 'Low flames and drifting embers.', make() {
    let t = 0; const embers = Array.from({ length: 30 }, () => ({ x: rnd(0.6, 0.4), y: Math.random(), s: rnd(0.12, 0.04), r: rnd(2.5, 1) }));
    return { draw(ctx, w, h, e) { t += e.dt * e.speed;
      sky(ctx, w, h, '#090605', '#1c0e07'); glow(ctx, w * 0.5, h * 0.8, w * 0.45, 'rgba(255,120,40,A)', 0.25 + e.level * 0.1);
      const flame = (cx, base, fh, fw, hue, a, ph) => { ctx.beginPath(); ctx.moveTo(cx - fw, base); for (let i = 0; i <= 20; i++) { const p = i / 20; const wob = Math.sin(t * 2.2 + p * 6 + ph) * fw * 0.25 * p + Math.sin(t * 3.1 + ph * 2) * fw * 0.1 * p; ctx.lineTo(cx + wob - fw * (1 - p), base - fh * p); } for (let i = 20; i >= 0; i--) { const p = i / 20; const wob = Math.sin(t * 2.2 + p * 6 + ph) * fw * 0.25 * p; ctx.lineTo(cx + wob + fw * (1 - p), base - fh * p); } ctx.closePath(); const g = ctx.createLinearGradient(0, base, 0, base - fh); g.addColorStop(0, `hsla(${hue},100%,60%,${a})`); g.addColorStop(1, `hsla(${hue + 20},100%,70%,0)`); ctx.fillStyle = g; ctx.fill(); };
      const base = h * 0.82; for (let i = 0; i < 5; i++) { const cx = w * (0.38 + i * 0.06); flame(cx, base, h * (0.22 + Math.sin(t * 1.3 + i) * 0.03), w * 0.05, 18 + i * 4, 0.75, i); flame(cx, base, h * (0.13 + Math.sin(t * 1.7 + i) * 0.02), w * 0.03, 45, 0.8, i + 3); }
      ctx.fillStyle = '#241008'; ctx.fillRect(w * 0.3, base, w * 0.4, h * 0.03);
      for (const m of embers) { m.y -= m.s * e.dt * e.speed; m.x += Math.sin(t + m.y * 10) * 0.0008; if (m.y < 0.1) { m.y = 0.82; m.x = rnd(0.6, 0.4); } ctx.fillStyle = `rgba(255,${150 + Math.floor(m.y * 80)},60,${0.8 - (0.82 - m.y)})`; ctx.beginPath(); ctx.arc(m.x * w, m.y * h, m.r, 0, TAU); ctx.fill(); }
    } }; } });

  add({ id: 'clouds', name: 'Drifting Clouds', cat: 'Nature', desc: 'Soft clouds moving across a quiet sky.', make() {
    let t = 0; const cl = Array.from({ length: 9 }, (_, i) => ({ x: Math.random() * 1.4 - 0.2, y: rnd(0.7, 0.1), r: rnd(0.22, 0.1), s: rnd(0.02, 0.008), n: 3 + (i % 3) }));
    return { draw(ctx, w, h, e) { t += e.dt * e.speed;
      sky(ctx, w, h, isDark() ? '#101a3a' : '#9ec8f0', isDark() ? '#1b2b55' : '#e6f1fb');
      for (const c of cl) { c.x += c.s * e.dt * e.speed; if (c.x > 1.3) c.x = -0.3; for (let i = 0; i < c.n; i++) glow(ctx, (c.x + i * c.r * 0.5) * w, c.y * h + Math.sin(i + t * 0.1) * 6, c.r * w * (0.8 + (i % 2) * 0.3), isDark() ? 'rgba(170,185,230,A)' : 'rgba(255,255,255,A)', isDark() ? 0.25 : 0.8); }
    } }; } });

  add({ id: 'forest', name: 'Forest Breeze', cat: 'Nature', desc: 'Trees swaying gently in soft light.', make() {
    let t = 0; const trees = Array.from({ length: 14 }, (_, i) => ({ x: i / 13, hgt: rnd(0.55, 0.35), wdt: rnd(0.09, 0.05), d: i % 3 })); const leaves = Array.from({ length: 25 }, () => ({ x: Math.random(), y: Math.random(), s: rnd(0.05, 0.02) }));
    return { draw(ctx, w, h, e) { t += e.dt * e.speed;
      sky(ctx, w, h, isDark() ? '#0a1a14' : '#e8f2d8', isDark() ? '#06100b' : '#9cc48a');
      glow(ctx, w * 0.3, h * 0.1, w * 0.5, isDark() ? 'rgba(120,200,150,A)' : 'rgba(255,250,210,A)', 0.35);
      for (let layer = 2; layer >= 0; layer--) for (const tr of trees) { if (tr.d !== layer) continue; const sway = Math.sin(t * 0.6 + tr.x * 8) * 8 * (1 - layer * 0.3); const cx = tr.x * w + sway, top = h * (1 - tr.hgt) + layer * h * 0.08; const ww = tr.wdt * w; const l = isDark() ? 8 + layer * 6 : 22 + layer * 12; ctx.fillStyle = `hsl(${130 - layer * 10},35%,${l}%)`;
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(cx, top + k * ww * 0.9); ctx.lineTo(cx - ww * (0.6 + k * 0.3), top + ww * (1.6 + k * 0.9)); ctx.lineTo(cx + ww * (0.6 + k * 0.3), top + ww * (1.6 + k * 0.9)); ctx.closePath(); ctx.fill(); }
        ctx.fillRect(cx - ww * 0.08, top + ww * 3, ww * 0.16, h); }
      ctx.fillStyle = isDark() ? 'rgba(140,220,160,0.35)' : 'rgba(255,255,255,0.5)';
      for (const lf of leaves) { lf.x += lf.s * e.dt * e.speed; lf.y += Math.sin(t + lf.x * 20) * 0.0006 * e.speed + 0.004 * e.dt * e.speed; if (lf.x > 1.05) { lf.x = -0.05; lf.y = Math.random() * 0.6; } ctx.beginPath(); ctx.arc(lf.x * w, lf.y * h, 1.8, 0, TAU); ctx.fill(); }
    } }; } });

  add({ id: 'nightsky', name: 'Night Sky', cat: 'Nature', desc: 'Stars turning very slowly overhead.', make() {
    let t = 0; const stars = Array.from({ length: 260 }, () => ({ a: Math.random() * TAU, r: Math.random(), sz: rnd(1.6, 0.4), ph: Math.random() * TAU })); let shoot = null;
    return { draw(ctx, w, h, e) { t += e.dt * e.speed;
      sky(ctx, w, h, '#03061a', '#0c1538'); const cx = w * 0.5, cy = h * 1.1, R = Math.hypot(w, h);
      const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0.3, 'rgba(120,140,220,0)'); g.addColorStop(0.5, 'rgba(150,170,240,0.12)'); g.addColorStop(0.7, 'rgba(120,140,220,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (const s of stars) { const a = s.a + t * 0.004; const x = cx + Math.cos(a) * s.r * R, y = cy + Math.sin(a) * s.r * R; if (y > h || x < 0 || x > w) continue; const tw = 0.55 + Math.sin(t * 0.4 + s.ph) * 0.25; ctx.fillStyle = `rgba(235,240,255,${tw})`; ctx.beginPath(); ctx.arc(x, y, s.sz, 0, TAU); ctx.fill(); }
      if (!e.reduced && !shoot && Math.random() < 0.0015 * e.speed) shoot = { x: rnd(0.8, 0.2), y: rnd(0.4, 0.05), p: 0 };
      if (shoot) { shoot.p += e.dt * e.speed * 0.35; const x = shoot.x * w + shoot.p * 120, y = shoot.y * h + shoot.p * 60; ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - shoot.p)})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 40, y - 20); ctx.lineTo(x, y); ctx.stroke(); if (shoot.p > 1) shoot = null; }
      ctx.fillStyle = '#05081c'; ctx.beginPath(); ctx.moveTo(0, h); for (let x = 0; x <= w; x += 30) ctx.lineTo(x, h * 0.88 + smoothNoise(x * 0.008, 1) * 40); ctx.lineTo(w, h); ctx.fill();
    } }; } });

  add({ id: 'underwater', name: 'Underwater', cat: 'Nature', desc: 'Light rippling through deep blue water.', make() {
    let t = 0; const bubbles = Array.from({ length: 35 }, () => ({ x: Math.random(), y: Math.random(), r: rnd(5, 1.5), s: rnd(0.08, 0.03) })); const plants = Array.from({ length: 8 }, (_, i) => ({ x: i / 7, hgt: rnd(0.35, 0.15) }));
    return { draw(ctx, w, h, e) { t += e.dt * e.speed;
      sky(ctx, w, h, '#0a3a66', '#031428');
      ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let x = 0; x <= w; x += 10) { const y = h * 0.12 + Math.sin(x * 0.01 + t * 0.6 + k * 2) * 25 + Math.sin(x * 0.023 - t * 0.4 + k) * 12 + k * 40; ctx.lineTo(x, y); } ctx.strokeStyle = 'rgba(140,210,255,0.07)'; ctx.lineWidth = 18; ctx.stroke(); } ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 5; i++) { const x = w * (0.2 + i * 0.15) + Math.sin(t * 0.2 + i) * 20; const g = ctx.createLinearGradient(x, 0, x + 60, h); g.addColorStop(0, 'rgba(160,220,255,0.12)'); g.addColorStop(1, 'rgba(160,220,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x + 140, h); ctx.lineTo(x + 20, h); ctx.fill(); }
      for (const p of plants) { ctx.strokeStyle = 'rgba(20,90,70,0.8)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(p.x * w, h); for (let i = 1; i <= 8; i++) ctx.lineTo(p.x * w + Math.sin(t * 0.8 + i * 0.6 + p.x * 5) * i * 3, h - p.hgt * h * i / 8); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(200,235,255,0.45)'; ctx.lineWidth = 1; for (const b of bubbles) { b.y -= b.s * e.dt * e.speed; b.x += Math.sin(t * 1.2 + b.y * 12) * 0.0005; if (b.y < -0.05) { b.y = 1.05; b.x = Math.random(); } ctx.beginPath(); ctx.arc(b.x * w, b.y * h, b.r, 0, TAU); ctx.stroke(); }
    } }; } });

  // ===== ABSTRACT =====
  add({ id: 'slowwaves', name: 'Slow Waves', cat: 'Abstract', desc: 'Ribbons of light drifting across.', make() {
    let t = 0; return { draw(ctx, w, h, e) { t += e.dt * e.speed * 0.4; sky(ctx, w, h, isDark() ? '#0b1020' : '#f2f4fb', isDark() ? '#121a36' : '#dde4f7');
      for (let k = 0; k < 7; k++) { ctx.beginPath(); for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * (0.25 + k * 0.08) + Math.sin(x * 0.004 + t + k * 0.9) * 40 + Math.sin(x * 0.009 - t * 0.7 + k) * 18); ctx.strokeStyle = `hsla(${210 + k * 12},70%,${isDark() ? 65 : 55}%,${0.35 - k * 0.03})`; ctx.lineWidth = 14 - k; ctx.lineCap = 'round'; ctx.stroke(); }
    } }; } });

  add({ id: 'flowingcolors', name: 'Flowing Colours', cat: 'Abstract', desc: 'Soft colour fields melting into each other.', make() {
    let t = 0; const blobs = Array.from({ length: 6 }, (_, i) => ({ h: 190 + i * 28, ph: i * 1.1, r: rnd(0.5, 0.3) }));
    return { draw(ctx, w, h, e) { t += e.dt * e.speed * 0.25; const dirx = e.pointer.on ? (e.pointer.x - 0.5) : 0, diry = e.pointer.on ? (e.pointer.y - 0.5) : 0;
      ctx.fillStyle = isDark() ? '#0a0d1c' : '#f6f4fb'; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = isDark() ? 'lighter' : 'multiply';
      for (const b of blobs) { const x = w * (0.5 + Math.sin(t + b.ph) * 0.35 + dirx * 0.3), y = h * (0.5 + Math.cos(t * 0.8 + b.ph * 1.3) * 0.35 + diry * 0.3); glow(ctx, x, y, b.r * Math.max(w, h), `hsla(${b.h + Math.sin(t + b.ph) * 15},70%,${isDark() ? 45 : 80}%,A)`, isDark() ? 0.35 : 0.5); }
      ctx.globalCompositeOperation = 'source-over';
    } }; } });

  function particleField(opts) {
    return { id: opts.id, name: opts.name, cat: opts.cat, desc: opts.desc, interactive: opts.follow, make() {
      let t = 0; const ps = Array.from({ length: opts.n || 90 }, () => ({ x: Math.random(), y: Math.random(), r: rnd(3, 1), vx: rnd(0.01, -0.01), vy: rnd(0.01, -0.01), ph: Math.random() * TAU }));
      return { draw(ctx, w, h, e) { t += e.dt * e.speed; sky(ctx, w, h, isDark() ? '#090d1c' : '#f4f6fc', isDark() ? '#111735' : '#e3e8f7');
        const lv = opts.reactive ? e.level : 0;
        for (const p of ps) { let ax = Math.sin(t * 0.3 + p.ph) * 0.002, ay = Math.cos(t * 0.25 + p.ph) * 0.002;
          if (opts.follow && e.pointer.on) { const dx = e.pointer.x - p.x, dy = e.pointer.y - p.y; const d = Math.hypot(dx, dy) + 0.05; ax += dx / d * 0.01; ay += dy / d * 0.01; }
          p.vx = (p.vx + ax * e.dt) * 0.995; p.vy = (p.vy + ay * e.dt) * 0.995; const sp = e.speed * (1 + lv * 2); p.x += p.vx * e.dt * 6 * sp; p.y += p.vy * e.dt * 6 * sp; if (p.x < -0.05) p.x = 1.05; if (p.x > 1.05) p.x = -0.05; if (p.y < -0.05) p.y = 1.05; if (p.y > 1.05) p.y = -0.05;
          const r = p.r * (1 + lv * 1.5) + Math.sin(t + p.ph) * 0.5; glow(ctx, p.x * w, p.y * h, r * 6, isDark() ? 'rgba(160,190,255,A)' : 'rgba(80,120,240,A)', 0.25 + lv * 0.3); ctx.fillStyle = isDark() ? 'rgba(220,230,255,0.9)' : 'rgba(60,100,220,0.8)'; ctx.beginPath(); ctx.arc(p.x * w, p.y * h, r, 0, TAU); ctx.fill(); }
      } }; } };
  }
  add(particleField({ id: 'particles', name: 'Floating Particles', cat: 'Abstract', desc: 'Tiny lights drifting without hurry.' }));

  add({ id: 'circles', name: 'Expanding Circles', cat: 'Abstract', desc: 'Rings growing outward and fading.', make() {
    let t = 0; return { draw(ctx, w, h, e) { t += e.dt * e.speed * 0.18; sky(ctx, w, h, isDark() ? '#0a0e1e' : '#f5f6fb', isDark() ? '#0d1430' : '#e9edf8'); const cx = w / 2, cy = h / 2, R = Math.hypot(w, h) * 0.55;
      for (let i = 0; i < 9; i++) { const p = ((t + i / 9) % 1); ctx.beginPath(); ctx.arc(cx, cy, p * R, 0, TAU); ctx.strokeStyle = `hsla(${215 + i * 8},75%,${isDark() ? 70 : 55}%,${(1 - p) * 0.5})`; ctx.lineWidth = 2 + (1 - p) * 6; ctx.stroke(); }
      glow(ctx, cx, cy, R * 0.12, isDark() ? 'rgba(160,190,255,A)' : 'rgba(80,120,240,A)', 0.35);
    } }; } });

  add({ id: 'softlight', name: 'Soft Light', cat: 'Abstract', desc: 'Warm light slowly wandering.', make() {
    let t = 0; return { draw(ctx, w, h, e) { t += e.dt * e.speed * 0.3; sky(ctx, w, h, isDark() ? '#0c0a14' : '#fbf8f3', isDark() ? '#15102a' : '#f1eae0');
      for (let i = 0; i < 4; i++) { const x = w * (0.5 + Math.sin(t + i * 1.6) * 0.3), y = h * (0.5 + Math.cos(t * 0.7 + i * 2.1) * 0.3); glow(ctx, x, y, Math.max(w, h) * 0.35, `hsla(${30 + i * 20},90%,${isDark() ? 60 : 75}%,A)`, isDark() ? 0.22 : 0.35); }
    } }; } });

  function rippleVisual(opts) {
    return { id: opts.id, name: opts.name, cat: opts.cat, desc: opts.desc, interactive: true, make() {
      let t = 0, auto = 0; const rings = []; let lastTap = 0, lastLevelBurst = 0;
      return { draw(ctx, w, h, e) { t += e.dt * e.speed; sky(ctx, w, h, isDark() ? '#071526' : '#dcecf5', isDark() ? '#0b2238' : '#a9cde3');
        if (!opts.noAuto) { auto += e.dt * e.speed; if (auto > 4) { auto = 0; rings.push({ x: Math.random(), y: Math.random(), t: 0 }); } }
        for (const tp of e.taps) if (tp.id > lastTap) { lastTap = tp.id; rings.push({ x: tp.x, y: tp.y, t: 0 }); }
        if (opts.reactive && e.level > 0.55 && t - lastLevelBurst > 1.2) { lastLevelBurst = t; rings.push({ x: rnd(0.8, 0.2), y: rnd(0.8, 0.2), t: 0 }); }
        for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += e.dt * Math.max(e.speed, 0.3); if (r.t > 6) { rings.splice(i, 1); continue; } for (let k = 0; k < 3; k++) { const rad = (r.t - k * 0.35) * Math.min(w, h) * 0.12; if (rad <= 0) continue; ctx.beginPath(); ctx.arc(r.x * w, r.y * h, rad, 0, TAU); ctx.strokeStyle = `rgba(${isDark() ? '180,220,255' : '255,255,255'},${Math.max(0, 0.6 - r.t * 0.1 - k * 0.12)})`; ctx.lineWidth = 2.5 - k * 0.6; ctx.stroke(); } }
        for (let k = 0; k < 4; k++) { ctx.beginPath(); for (let x = 0; x <= w; x += 10) ctx.lineTo(x, h * (0.2 + k * 0.2) + Math.sin(x * 0.008 + t * 0.5 + k) * 10); ctx.strokeStyle = `rgba(${isDark() ? '140,200,255' : '255,255,255'},0.08)`; ctx.lineWidth = 30; ctx.stroke(); }
        if (rings.length === 0 && opts.hint) { ctx.fillStyle = isDark() ? 'rgba(200,220,255,0.5)' : 'rgba(20,50,80,0.45)'; ctx.font = `500 ${Math.max(14, w * 0.018)}px Manrope, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('Touch the water', w / 2, h * 0.5); }
      } }; } };
  }
  add(rippleVisual({ id: 'ripple', name: 'Liquid Ripples', cat: 'Abstract', desc: 'Ripples spreading across still water. Tap to add your own.' }));

  add({ id: 'geometric', name: 'Slow Geometry', cat: 'Abstract', desc: 'Shapes turning and transforming.', make() {
    let t = 0; return { draw(ctx, w, h, e) { t += e.dt * e.speed * 0.12; sky(ctx, w, h, isDark() ? '#0b0f1f' : '#f7f7fb', isDark() ? '#0b0f1f' : '#f7f7fb'); const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.38;
      for (let layer = 0; layer < 6; layer++) { const sides = 3 + ((Math.floor(t + layer * 0.5) % 5)); const nextSides = 3 + ((Math.floor(t + layer * 0.5) + 1) % 5); const f = (t + layer * 0.5) % 1; const fe = f * f * (3 - 2 * f); const r = R * (1 - layer * 0.14); ctx.beginPath();
        for (let i = 0; i <= 60; i++) { const a = i / 60 * TAU + t * (layer % 2 ? 1 : -1) + layer; const pr = (n) => { const k = Math.PI / n; return Math.cos(k) / Math.cos(((a * n) % (2 * k)) - k); }; const rr = r * lerp(pr(sides), pr(nextSides), fe); ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        ctx.closePath(); ctx.strokeStyle = `hsla(${220 + layer * 15},70%,${isDark() ? 70 : 50}%,${0.5 - layer * 0.05})`; ctx.lineWidth = 1.5; ctx.stroke(); }
    } }; } });

  add({ id: 'tunnel', name: 'Gentle Tunnel', cat: 'Abstract', desc: 'Rings drifting toward you, endlessly.', make() {
    let t = 0; return { draw(ctx, w, h, e) { t += e.dt * e.speed * 0.12; sky(ctx, w, h, isDark() ? '#07091a' : '#eef0fa', isDark() ? '#07091a' : '#eef0fa'); const cx = w / 2 + Math.sin(t * 2) * 20, cy = h / 2 + Math.cos(t * 1.5) * 15; const R = Math.hypot(w, h) * 0.7;
      for (let i = 0; i < 14; i++) { const p = ((t + i / 14) % 1); const rad = Math.pow(p, 2.2) * R; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.strokeStyle = `hsla(${230 + i * 6},70%,${isDark() ? 65 : 55}%,${p * (1 - p) * 1.6})`; ctx.lineWidth = 1 + p * 10; ctx.stroke(); }
    } }; } });

  // ===== SOUND REACTIVE =====
  function bands(e, n, out) { const nyq = (engine.ctx ? engine.ctx.sampleRate : 48000) / 2; const minF = 40, maxF = 12000; for (let i = 0; i < n; i++) { const f0 = minF * Math.pow(maxF / minF, i / n), f1 = minF * Math.pow(maxF / minF, (i + 1) / n); let b0 = Math.floor(f0 / nyq * 512), b1 = Math.max(b0 + 1, Math.floor(f1 / nyq * 512)); let s = 0; for (let b = b0; b < b1 && b < 512; b++) s += e.spec[b]; const v = s / ((b1 - b0) * 255); out[i] += (v - out[i]) * (v > out[i] ? 0.25 : 0.06); } }

  add({ id: 'spectrum', name: 'Audio Spectrum', cat: 'Sound Reactive', reactive: true, desc: 'A soft spectrum of whatever is playing.', make() {
    let t = 0; const n = 48, vals = new Float32Array(n); return { draw(ctx, w, h, e) { t += e.dt * e.speed; bands(e, n, vals); sky(ctx, w, h, isDark() ? '#0a0e1f' : '#f4f6fc', isDark() ? '#0f1430' : '#e6eaf7'); const bw = w / n, mid = h * 0.5;
      for (let i = 0; i < n; i++) { const v = Math.max(0.02, vals[i] * 1.4 + Math.sin(t * 0.8 + i * 0.4) * 0.015); const bh = v * h * 0.42; const x = i * bw + bw * 0.2; ctx.fillStyle = `hsla(${200 + i * 2.5},75%,${isDark() ? 65 : 55}%,0.75)`; ctx.beginPath(); ctx.roundRect(x, mid - bh, bw * 0.6, bh * 2, bw * 0.3); ctx.fill(); }
    } }; } });

  add({ id: 'waveform', name: 'Moving Waveform', cat: 'Sound Reactive', reactive: true, desc: 'The sound itself, drawn as a slow line.', make() {
    let t = 0; const sm = new Float32Array(256); return { draw(ctx, w, h, e) { t += e.dt * e.speed; sky(ctx, w, h, isDark() ? '#090c1c' : '#f5f6fb', isDark() ? '#0c1330' : '#e9edf8');
      for (let i = 0; i < 256; i++) { const v = (e.wave[i * 4] - 128) / 128; sm[i] += (v - sm[i]) * 0.12; }
      for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let i = 0; i < 256; i++) { const x = i / 255 * w; const y = h / 2 + sm[i] * h * 0.3 * (1 - k * 0.25) + Math.sin(i * 0.05 + t + k) * 8; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.strokeStyle = `hsla(${200 + k * 25},80%,${isDark() ? 70 : 55}%,${0.6 - k * 0.15})`; ctx.lineWidth = 3 - k * 0.7; ctx.lineJoin = 'round'; ctx.stroke(); }
    } }; } });

  add({ id: 'rings', name: 'Pulsating Rings', cat: 'Sound Reactive', reactive: true, desc: 'Rings breathing with the sound level.', make() {
    let t = 0, lv = 0; return { draw(ctx, w, h, e) { t += e.dt * e.speed; lv += (e.level - lv) * 0.05; sky(ctx, w, h, isDark() ? '#0a0d1e' : '#f5f6fb', isDark() ? '#101738' : '#e7ebf8'); const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.3;
      glow(ctx, cx, cy, R * (0.6 + lv), isDark() ? 'rgba(140,170,255,A)' : 'rgba(80,120,240,A)', 0.3 + lv * 0.3);
      for (let i = 0; i < 6; i++) { const r = R * (0.35 + i * 0.18) * (1 + lv * 0.5 + Math.sin(t * 0.7 + i) * 0.04); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.strokeStyle = `hsla(${215 + i * 10},75%,${isDark() ? 72 : 52}%,${0.55 - i * 0.08})`; ctx.lineWidth = 2 + lv * 3; ctx.stroke(); }
    } }; } });

  add(particleField({ id: 'reactiveparticles', name: 'Reactive Particles', cat: 'Sound Reactive', desc: 'Particles drifting a little faster as sound rises.', reactive: true, n: 80 }));

  add({ id: 'frequency', name: 'Frequency Bloom', cat: 'Sound Reactive', reactive: true, desc: 'A pattern shaped by the tone you generate.', make() {
    let t = 0, lv = 0, petals = 6, hue = 220; const n = 36, vals = new Float32Array(n); return { draw(ctx, w, h, e) { t += e.dt * e.speed * 0.3; lv += (e.level - lv) * 0.05; bands(e, n, vals); sky(ctx, w, h, isDark() ? '#090b1c' : '#f6f6fc', isDark() ? '#0e1230' : '#e8eaf8'); const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.34;
      const f = e.freq || 1000; const pos = clamp(Math.log(f / 20) / Math.log(800), 0, 1); petals += ((3 + Math.round(pos * 9)) - petals) * 0.05; hue += ((190 + pos * 130) - hue) * 0.05;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let i = 0; i <= 240; i++) { const a = i / 240 * TAU; const n1 = Math.floor(petals), n2 = n1 + 1, fr = petals - n1; const ph = t * (k % 2 ? 1 : -1) * 2; const shape = lerp(Math.cos(n1 * a + ph), Math.cos(n2 * a + ph), fr); const rr = R * (0.55 + k * 0.18) * (0.7 + 0.3 * shape) * (1 + lv * 0.25); ctx.lineTo(cx + Math.cos(a + t) * rr, cy + Math.sin(a + t) * rr); } ctx.closePath(); ctx.strokeStyle = `hsla(${hue + k * 18},80%,${isDark() ? 70 : 50}%,${0.6 - k * 0.15})`; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = `hsla(${hue + k * 18},80%,${isDark() ? 60 : 70}%,0.05)`; ctx.fill(); }
      for (let i = 0; i < n; i++) { const a = i / n * TAU - Math.PI / 2; const r0 = R * 1.15, r1 = r0 + vals[i] * R * 0.5 + 3; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.strokeStyle = `hsla(${hue},70%,${isDark() ? 75 : 50}%,0.5)`; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke(); }
      glow(ctx, cx, cy, R * 0.3, `hsla(${hue},90%,70%,A)`, 0.35 + lv * 0.3);
      if (e.freq) { ctx.fillStyle = isDark() ? 'rgba(230,235,255,0.8)' : 'rgba(20,30,60,0.7)'; ctx.font = `800 ${Math.max(18, w * 0.03)}px Manrope, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(Math.round(e.freq).toLocaleString() + ' Hz', cx, cy + R * 1.6); }
    } }; } });

  add(rippleVisual({ id: 'audioripples', name: 'Sound Ripples', cat: 'Sound Reactive', desc: 'Ripples appearing as the sound swells.', reactive: true, noAuto: true }));

  // ===== INTERACTIVE / FOCUS ACTIVITIES =====
  add(rippleVisual({ id: 'touchwater', name: 'Ripple', cat: 'Focus Activities', desc: 'Touch different places on the water and watch slow ripples spread.', noAuto: true, hint: true }));
  add(particleField({ id: 'followparticles', name: 'Gentle Followers', cat: 'Interactive', desc: 'Particles slowly gather toward your pointer.', follow: true, n: 70 }));

  add({ id: 'touchcircles', name: 'Touch Circles', cat: 'Interactive', desc: 'Tap anywhere to release a slow expanding circle.', interactive: true, make() {
    let t = 0, last = 0; const cs = []; return { draw(ctx, w, h, e) { t += e.dt * e.speed; sky(ctx, w, h, isDark() ? '#0b0e1e' : '#f6f6fb', isDark() ? '#11163a' : '#e8ebf8');
      for (const tp of e.taps) if (tp.id > last) { last = tp.id; cs.push({ x: tp.x, y: tp.y, t: 0, h: rnd(300, 190) }); }
      for (let i = cs.length - 1; i >= 0; i--) { const c = cs[i]; c.t += e.dt * Math.max(e.speed, 0.3) * 0.25; if (c.t > 1) { cs.splice(i, 1); continue; } const r = c.t * Math.min(w, h) * 0.6; ctx.beginPath(); ctx.arc(c.x * w, c.y * h, r, 0, TAU); ctx.strokeStyle = `hsla(${c.h},75%,${isDark() ? 70 : 55}%,${(1 - c.t) * 0.7})`; ctx.lineWidth = 3 + (1 - c.t) * 8; ctx.stroke(); glow(ctx, c.x * w, c.y * h, r * 0.5, `hsla(${c.h},80%,70%,A)`, (1 - c.t) * 0.2); }
      if (!cs.length) { ctx.fillStyle = isDark() ? 'rgba(200,210,255,0.5)' : 'rgba(30,40,80,0.45)'; ctx.font = `500 ${Math.max(14, w * 0.018)}px Manrope, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('Tap anywhere', w / 2, h / 2); }
    } }; } });

  add({ id: 'bubble', name: 'Floating Bubble', cat: 'Focus Activities', desc: 'Keep a drifting bubble gently moving with your pointer.', interactive: true, make() {
    let t = 0; const b = { x: 0.5, y: 0.5, vx: 0.02, vy: -0.01 }; return { draw(ctx, w, h, e) { t += e.dt * e.speed; sky(ctx, w, h, isDark() ? '#0a1226' : '#e6f1fb', isDark() ? '#0c1d3a' : '#bfd9f2');
      b.vy += 0.004 * e.dt; b.vx += Math.sin(t * 0.5) * 0.002 * e.dt;
      if (e.pointer.on) { const dx = b.x - e.pointer.x, dy = b.y - e.pointer.y; const d = Math.hypot(dx, dy); if (d < 0.22) { const f = (0.22 - d) * 0.8; b.vx += dx / (d + 0.01) * f * e.dt; b.vy += dy / (d + 0.01) * f * e.dt; } }
      b.vx *= 0.995; b.vy *= 0.995; const sp = Math.hypot(b.vx, b.vy), mx = 0.09; if (sp > mx) { b.vx *= mx / sp; b.vy *= mx / sp; }
      b.x += b.vx * e.dt * Math.max(e.speed, 0.4) * 2.5; b.y += b.vy * e.dt * Math.max(e.speed, 0.4) * 2.5; if (b.x < 0.08) { b.x = 0.08; b.vx = Math.abs(b.vx) * 0.6; } if (b.x > 0.92) { b.x = 0.92; b.vx = -Math.abs(b.vx) * 0.6; } if (b.y < 0.1) { b.y = 0.1; b.vy = Math.abs(b.vy) * 0.6; } if (b.y > 0.9) { b.y = 0.9; b.vy = -Math.abs(b.vy) * 0.5; }
      const r = Math.min(w, h) * 0.09, x = b.x * w, y = b.y * h; const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.7, 'rgba(200,225,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0.55)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.18, r * 0.1, -0.7, 0, TAU); ctx.fill();
      ctx.fillStyle = isDark() ? 'rgba(200,220,255,0.4)' : 'rgba(20,50,90,0.4)'; ctx.font = `500 ${Math.max(13, w * 0.016)}px Manrope, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('Move near the bubble to nudge it', w / 2, h - 36);
    } }; } });

  add({ id: 'zensand', name: 'Zen Sand', cat: 'Interactive', desc: 'Draw slow lines in the sand; they fade with time.', interactive: true, make() {
    let t = 0; const strokes = []; let cur = null; return { draw(ctx, w, h, e) { t += e.dt;
      sky(ctx, w, h, isDark() ? '#1a1713' : '#efe6d6', isDark() ? '#14110d' : '#e3d7c2');
      for (let y = 0; y < h; y += 14) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.strokeStyle = isDark() ? 'rgba(255,240,210,0.04)' : 'rgba(120,90,50,0.07)'; ctx.lineWidth = 6; ctx.stroke(); }
      if (e.pointer.on && e.pointer.down) { if (!cur) { cur = { pts: [], t: 0 }; strokes.push(cur); } const lp = cur.pts[cur.pts.length - 1]; if (!lp || Math.hypot(lp.x - e.pointer.x, lp.y - e.pointer.y) > 0.004) cur.pts.push({ x: e.pointer.x, y: e.pointer.y }); } else cur = null;
      for (let i = strokes.length - 1; i >= 0; i--) { const s = strokes[i]; if (s !== cur) s.t += e.dt; const a = clamp(1 - s.t / 40, 0, 1); if (a <= 0) { strokes.splice(i, 1); continue; } if (s.pts.length < 2) continue; for (let k = -2; k <= 2; k++) { ctx.beginPath(); for (let j = 0; j < s.pts.length; j++) { const p = s.pts[j]; j ? ctx.lineTo(p.x * w + k * 7, p.y * h + k * 5) : ctx.moveTo(p.x * w + k * 7, p.y * h + k * 5); } ctx.strokeStyle = k ? (isDark() ? `rgba(0,0,0,${0.25 * a})` : `rgba(120,90,50,${0.18 * a})`) : (isDark() ? `rgba(255,240,210,${0.15 * a})` : `rgba(255,250,235,${0.8 * a})`); ctx.lineWidth = k ? 3 : 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); } }
      if (!strokes.length) { ctx.fillStyle = isDark() ? 'rgba(255,240,210,0.4)' : 'rgba(100,70,40,0.45)'; ctx.font = `500 ${Math.max(14, w * 0.018)}px Manrope, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('Drag slowly to rake the sand', w / 2, h / 2); }
    } }; } });

  add({ id: 'followlight', name: 'Follow the Light', cat: 'Focus Activities', desc: 'A soft light wanders; simply follow it with your eyes.', make() {
    let t = 0; return { draw(ctx, w, h, e) { t += e.dt * e.speed * 0.35; sky(ctx, w, h, isDark() ? '#06081a' : '#f3f4fb', isDark() ? '#0a0d24' : '#e6e9f6'); const x = w * (0.5 + Math.sin(t * 0.9) * 0.36 + Math.sin(t * 0.23) * 0.06), y = h * (0.5 + Math.sin(t * 0.6 + 1.3) * 0.32 + Math.cos(t * 0.31) * 0.05);
      glow(ctx, x, y, Math.min(w, h) * 0.25, isDark() ? 'rgba(255,225,170,A)' : 'rgba(255,190,90,A)', 0.5); glow(ctx, x, y, Math.min(w, h) * 0.06, 'rgba(255,255,255,A)', 0.9);
    } }; } });

  add({ id: 'colorflow', name: 'Colour Flow', cat: 'Focus Activities', desc: 'Move slowly and the colours follow your direction.', interactive: true, make() {
    let t = 0, dx = 0, dy = 0; const bands_ = Array.from({ length: 8 }, (_, i) => ({ h: 180 + i * 22, off: i / 8 })); return { draw(ctx, w, h, e) { t += e.dt * e.speed * 0.2; const tx = e.pointer.on ? (e.pointer.x - 0.5) * 2 : Math.sin(t * 0.5) * 0.5, ty = e.pointer.on ? (e.pointer.y - 0.5) * 2 : Math.cos(t * 0.4) * 0.5; dx += (tx - dx) * 0.02; dy += (ty - dy) * 0.02; ctx.fillStyle = isDark() ? '#07091a' : '#f8f6fb'; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = isDark() ? 'lighter' : 'multiply';
      for (const b of bands_) { const p = (b.off + t) % 1; const x = w * (0.5 + dx * 0.6 * (p - 0.5) * 2), y = h * (0.5 + dy * 0.6 * (p - 0.5) * 2); glow(ctx, x, y, Math.max(w, h) * (0.25 + p * 0.25), `hsla(${b.h + t * 20},70%,${isDark() ? 45 : 82}%,A)`, (1 - Math.abs(p - 0.5) * 2) * (isDark() ? 0.35 : 0.45)); }
      ctx.globalCompositeOperation = 'source-over';
    } }; } });

  add({ id: 'pattern', name: 'Living Pattern', cat: 'Focus Activities', desc: 'A mandala that slowly changes while you watch.', make() {
    let t = 0; return { draw(ctx, w, h, e) { t += e.dt * e.speed * 0.08; sky(ctx, w, h, isDark() ? '#0a0914' : '#faf7f4', isDark() ? '#0a0914' : '#faf7f4'); const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.42; const sym = 8;
      for (let ring = 1; ring <= 6; ring++) { const r = R * ring / 6; const n = sym * ring; for (let i = 0; i < n; i++) { const a = i / n * TAU + t * (ring % 2 ? 1 : -1) * 0.5; const s = r * 0.12 * (1 + 0.3 * Math.sin(t * 3 + ring + i)); const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.5, a, 0, TAU); ctx.fillStyle = `hsla(${(t * 60 + ring * 30) % 360},55%,${isDark() ? 60 : 60}%,${0.35})`; ctx.fill(); } ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.strokeStyle = isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1; ctx.stroke(); }
    } }; } });

  // ===== BREATHING =====
  add({ id: 'breathing', name: 'Breathing Circle', cat: 'Breathing', desc: 'A circle that grows as you breathe in and settles as you breathe out.', make() {
    let t = 0; return { draw(ctx, w, h, e) { const k = P.breathPeriod ? P.breathPeriod / 12 : 1; const IN = 4 * k, HOLD = 1 * k, OUT = 6 * k, REST = 1 * k, CYC = IN + HOLD + OUT + REST; t += e.dt * (e.still ? 0 : Math.max(e.speed, 0.6)); const p = t % CYC; let s, label;
      if (p < IN) { const q = p / IN; s = q * q * (3 - 2 * q); label = 'Breathe in'; } else if (p < IN + HOLD) { s = 1; label = 'Breathe in'; } else if (p < IN + HOLD + OUT) { const q = (p - IN - HOLD) / OUT; s = 1 - q * q * (3 - 2 * q); label = 'Breathe out'; } else { s = 0; label = 'Breathe out'; }
      sky(ctx, w, h, isDark() ? '#090c1c' : '#f3f5fb', isDark() ? '#0e1332' : '#e3e8f6'); const cx = w / 2, cy = h / 2, R = Math.min(w, h) * (0.16 + s * 0.16);
      glow(ctx, cx, cy, R * 2.2, isDark() ? 'rgba(140,170,255,A)' : 'rgba(90,130,240,A)', 0.25 + s * 0.2); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fillStyle = isDark() ? 'rgba(150,180,255,0.25)' : 'rgba(90,130,240,0.22)'; ctx.fill(); ctx.strokeStyle = isDark() ? 'rgba(200,215,255,0.8)' : 'rgba(60,100,220,0.7)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * 0.34, 0, TAU); ctx.strokeStyle = isDark() ? 'rgba(200,215,255,0.12)' : 'rgba(60,100,220,0.12)'; ctx.lineWidth = 1; ctx.stroke();
      if (e.breathText) { ctx.fillStyle = isDark() ? 'rgba(230,236,255,0.9)' : 'rgba(20,30,60,0.8)'; ctx.font = `600 ${Math.max(18, Math.min(w, h) * 0.045)}px Manrope, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, cx, cy); ctx.textBaseline = 'alphabetic'; }
    } }; } });

  // ===== EXPERIMENT VISUALS (opened from The Lab) =====
  add({ id: 'target', name: 'Attention Target', cat: 'Lab', hidden: true, desc: 'Follow one slow object; the sound follows it too.', make() {
    let t = 0, lastSync = 0; return { draw(ctx, w, h, e) { t += e.dt * e.speed * 0.3;
      const kind = P.target; const x = w * (0.5 + Math.sin(t * 0.9) * 0.36 + Math.sin(t * 0.23) * 0.06), y = h * (0.5 + Math.sin(t * 0.6 + 1.3) * 0.3 + Math.cos(t * 0.31) * 0.05);
      if (kind === 'bubble') { sky(ctx, w, h, '#0a3a66', '#031428'); const r = Math.min(w, h) * 0.07; const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(0.7, 'rgba(200,225,255,0.1)'); g.addColorStop(1, 'rgba(255,255,255,0.5)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      else if (kind === 'star') { sky(ctx, w, h, '#03061a', '#0c1538'); glow(ctx, x, y, Math.min(w, h) * 0.12, 'rgba(220,230,255,A)', 0.6); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill(); }
      else if (kind === 'leaf') { sky(ctx, w, h, isDark() ? '#0a1a14' : '#e8f2d8', isDark() ? '#06100b' : '#c5dcb0'); ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2) * 0.6 + t); const r = Math.min(w, h) * 0.045; ctx.fillStyle = isDark() ? '#6fbf7a' : '#4f9a5a'; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.6, r * 0.8, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r * 1.4, 0); ctx.lineTo(r * 1.4, 0); ctx.stroke(); ctx.restore(); }
      else if (kind === 'orb') { sky(ctx, w, h, isDark() ? '#0c0a14' : '#f7f3ee', isDark() ? '#15102a' : '#ede4d8'); glow(ctx, x, y, Math.min(w, h) * 0.2, 'rgba(255,180,120,A)', 0.55); glow(ctx, x, y, Math.min(w, h) * 0.05, 'rgba(255,240,220,A)', 0.95); }
      else { sky(ctx, w, h, isDark() ? '#06081a' : '#f3f4fb', isDark() ? '#0a0d24' : '#e6e9f6'); glow(ctx, x, y, Math.min(w, h) * 0.25, isDark() ? 'rgba(255,225,170,A)' : 'rgba(255,190,90,A)', 0.5); glow(ctx, x, y, Math.min(w, h) * 0.06, 'rgba(255,255,255,A)', 0.9); }
      if (P.sync && engine.ctx && t - lastSync > 0.02) { lastSync = t; engine.setMasterPan((x / w - 0.5) * 0.5, 0.4); engine.setMasterTone(3000 * Math.pow(6, 1 - y / h), 0.4); }
    } }; } });

  add({ id: 'synced', name: 'Synced Scene', cat: 'Lab', hidden: true, desc: 'The scene takes its form from the sounds playing.', make() {
    let t = 0; const drops = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random(), s: rnd(0.5, 0.25), l: rnd(0.05, 0.02) })); const ps = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), ph: Math.random() * TAU, r: rnd(2.5, 1) })); const n = 32, vals = new Float32Array(n); let centroid = 0.5;
    return { draw(ctx, w, h, e) { t += e.dt * e.speed; bands(e, n, vals);
      let num = 0, den = 0; for (let i = 0; i < n; i++) { num += vals[i] * i; den += vals[i]; } centroid += ((den ? num / den / n : 0.5) - centroid) * 0.03;   // 0 = low-heavy, 1 = high-heavy
      const act = new Set(engine.activeList().map(a => a.id)); const hasRain = act.has('rain') || act.has('waterfall') || act.has('stream'); const hasOcean = act.has('ocean') || act.has('wind'); const hasNoise = act.has('white') || act.has('pink') || act.has('brown') || act.has('static') || act.has('hiss') || act.has('fan') || act.has('paint') || act.has('sculpt') || act.has('notched');
      sky(ctx, w, h, isDark() ? '#090d1e' : '#eef2fb', isDark() ? '#0f1634' : '#dbe3f6');
      const size = 1.8 - centroid * 1.3, spd = 0.5 + centroid * 0.9;   // low = bigger/slower, high = finer/faster
      if (hasOcean || (!hasRain && !hasNoise)) for (let k = 0; k < 5; k++) { ctx.beginPath(); const base = h * (0.5 + k * 0.1); const amp = (14 + k * 6) * size * (1 + e.level); for (let x = 0; x <= w; x += 8) ctx.lineTo(x, base + Math.sin(x * 0.004 / size + t * spd * (0.6 + k * 0.1) + k) * amp); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fillStyle = `hsla(${205 + k * 6},60%,${isDark() ? 22 + k * 4 : 60 + k * 5}%,0.6)`; ctx.fill(); }
      if (hasNoise) for (const p of ps) { p.y -= 0.02 * e.dt * spd * e.speed; p.x += Math.sin(t + p.ph) * 0.0004; if (p.y < -0.02) p.y = 1.02; glow(ctx, p.x * w, p.y * h, p.r * 5 * size, isDark() ? 'rgba(170,195,255,A)' : 'rgba(80,120,240,A)', 0.2 + e.level * 0.3); }
      if (hasRain) { ctx.strokeStyle = isDark() ? 'rgba(200,225,255,0.5)' : 'rgba(60,100,180,0.45)'; ctx.lineWidth = 1.2 * size; for (const d of drops) { d.y += d.s * e.dt * spd * e.speed * 1.2; if (d.y > 1.05) { d.y = -0.05; d.x = Math.random(); } ctx.beginPath(); ctx.moveTo(d.x * w, d.y * h); ctx.lineTo(d.x * w - 1, (d.y + d.l * size) * h); ctx.stroke(); } }
    } }; } });

  add({ id: 'followone', name: 'Follow One Particle', cat: 'Lab', hidden: true, desc: 'Keep track of the one that glows at the start.', make() {
    let t = 0; const ps = Array.from({ length: 14 }, () => ({ x: Math.random(), y: Math.random(), ph: Math.random() * TAU, a: Math.random() * TAU })); const chosen = 3; return { draw(ctx, w, h, e) { t += e.dt * e.speed; sky(ctx, w, h, isDark() ? '#090d1c' : '#f4f6fc', isDark() ? '#111735' : '#e3e8f7');
      const reveal = (t % 40) < 6 || (t % 40) > 36;   // glows for the first seconds of each 40 s cycle, and again near the end
      ps.forEach((p, i) => { p.a += Math.sin(t * 0.3 + p.ph) * 0.01; p.x += Math.cos(p.a) * 0.025 * e.dt; p.y += Math.sin(p.a) * 0.025 * e.dt; if (p.x < 0.05 || p.x > 0.95) p.a = Math.PI - p.a; if (p.y < 0.05 || p.y > 0.95) p.a = -p.a; const x = p.x * w, y = p.y * h; glow(ctx, x, y, 26, isDark() ? 'rgba(160,190,255,A)' : 'rgba(80,120,240,A)', i === chosen && reveal ? 0.6 : 0.22); ctx.fillStyle = i === chosen && reveal ? '#ffd27a' : (isDark() ? 'rgba(220,230,255,0.9)' : 'rgba(60,100,220,0.85)'); ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); });
      ctx.fillStyle = isDark() ? 'rgba(200,210,255,0.5)' : 'rgba(30,40,80,0.5)'; ctx.font = `500 ${Math.max(13, w * 0.016)}px Manrope, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(reveal ? 'Follow the golden one' : 'Keep following it… it will glow again soon', w / 2, h - 36);
    } }; } });

  add({ id: 'noticechange', name: 'Notice the Change', cat: 'Lab', hidden: true, desc: 'The background shifts very slowly. Notice when it has.', make() {
    let t = 0, hue = 215, target = 215, lastShift = 0; return { draw(ctx, w, h, e) { t += e.dt * e.speed; if (t - lastShift > 25) { lastShift = t; target = 180 + Math.random() * 120; } hue += (target - hue) * 0.002;
      sky(ctx, w, h, `hsl(${hue} 40% ${isDark() ? 9 : 92}%)`, `hsl(${hue + 30} 45% ${isDark() ? 14 : 84}%)`); glow(ctx, w * 0.5, h * 0.5, Math.min(w, h) * 0.4, `hsla(${hue + 60},70%,${isDark() ? 55 : 75}%,A)`, 0.25);
      ctx.fillStyle = isDark() ? 'rgba(230,236,255,0.5)' : 'rgba(30,40,80,0.5)'; ctx.font = `500 ${Math.max(13, w * 0.016)}px Manrope, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('Just watch. Notice when the colour has changed.', w / 2, h - 36);
    } }; } });

  add({ id: 'countpulses', name: 'Count Slow Pulses', cat: 'Lab', hidden: true, desc: 'A soft pulse every few seconds. Count them, lose count, start again.', make() {
    let t = 0; return { draw(ctx, w, h, e) { t += e.dt * e.speed; const period = 5; const p = (t % period) / period; const s = Math.exp(-Math.pow((p - 0.15) * 4, 2)); sky(ctx, w, h, isDark() ? '#0a0d1e' : '#f5f6fb', isDark() ? '#0f1538' : '#e7ebf8'); const R = Math.min(w, h) * (0.12 + s * 0.1); glow(ctx, w / 2, h / 2, R * 2.5, isDark() ? 'rgba(140,170,255,A)' : 'rgba(80,120,240,A)', 0.15 + s * 0.35); ctx.beginPath(); ctx.arc(w / 2, h / 2, R, 0, TAU); ctx.fillStyle = isDark() ? `rgba(160,185,255,${0.2 + s * 0.3})` : `rgba(90,130,240,${0.2 + s * 0.3})`; ctx.fill();
      ctx.fillStyle = isDark() ? 'rgba(230,236,255,0.5)' : 'rgba(30,40,80,0.5)'; ctx.font = `500 ${Math.max(13, w * 0.016)}px Manrope, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('Count the pulses. If you lose count, simply begin again at one.', w / 2, h - 36);
    } }; } });

  add({ id: 'starflight', name: 'Among Stars', cat: 'Lab', hidden: true, desc: 'Very slow drift forward through a star field.', make() {
    let t = 0; const st = Array.from({ length: 220 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() })); return { draw(ctx, w, h, e) { t += e.dt; sky(ctx, w, h, '#03061a', '#0a0f2e'); const cx = w / 2, cy = h / 2; const sp = 0.035 * e.speed;
      for (const s of st) { s.z -= sp * e.dt; if (s.z <= 0.02) { s.z = 1; s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; } const k = 0.5 / s.z; const x = cx + s.x * k * w * 0.5, y = cy + s.y * k * h * 0.5; if (x < 0 || x > w || y < 0 || y > h) continue; const r = (1 - s.z) * 2.2 + 0.3; ctx.fillStyle = `rgba(235,240,255,${0.25 + (1 - s.z) * 0.65})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    } }; } });

  add({ id: 'cloudflight', name: 'Through Clouds', cat: 'Lab', hidden: true, desc: 'Drifting slowly forward through soft cloud.', make() {
    let t = 0; const cl = Array.from({ length: 18 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random(), r: rnd(0.3, 0.15) })); return { draw(ctx, w, h, e) { t += e.dt; sky(ctx, w, h, isDark() ? '#121a3a' : '#a9cdf0', isDark() ? '#1b2b55' : '#e9f2fb'); const cx = w / 2, cy = h / 2; const sp = 0.03 * e.speed;
      cl.sort((a, b) => b.z - a.z); for (const c of cl) { c.z -= sp * e.dt; if (c.z <= 0.05) { c.z = 1; c.x = Math.random() * 2 - 1; c.y = Math.random() * 2 - 1; } const k = 0.4 / c.z; const x = cx + c.x * k * w * 0.5, y = cy + c.y * k * h * 0.5; const rad = c.r * k * w * 0.5; for (let i = 0; i < 3; i++) glow(ctx, x + (i - 1) * rad * 0.5, y + Math.sin(t * 0.1 + i) * rad * 0.1, rad * (0.7 + (i % 2) * 0.3), isDark() ? 'rgba(180,195,235,A)' : 'rgba(255,255,255,A)', (isDark() ? 0.18 : 0.55) * Math.min(1, (1 - c.z) * 2)); }
    } }; } });

  const byId = Object.fromEntries(V.map(v => [v.id, v]));
  const CATS = ['Nature', 'Abstract', 'Sound Reactive', 'Interactive', 'Focus Activities', 'Breathing'];
  const CAT_DESC = { Nature: 'Slow scenes from the natural world.', Abstract: 'Soft shapes and colour, nothing to figure out.', 'Sound Reactive': 'Visuals that gently respond to what you are hearing.', Interactive: 'Optional touch and pointer play — no goals, no pressure.', 'Focus Activities': 'Just enough to hold your attention, and nothing more.', Breathing: 'An optional breathing rhythm to settle into.' };

  // ---------- shared state ----------
  const MOTION = { still: 0, low: 0.4, medium: 0.75, high: 1.15 };
  const S = {
    visual: app.store.get('visual', 'ocean'),
    motion: app.store.get('motion', 'low'),
    reduced: app.store.get('reduceMotion', matchMedia('(prefers-reduced-motion: reduce)').matches),
    breathText: app.store.get('breathText', true),
    paused: false,
  };
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', ev => { if (ev.matches) { S.reduced = true; syncSettings(); } });
  const spec = new Uint8Array(512), wave = new Uint8Array(1024);
  let smoothLevel = 0;
  function makeEnv(pointer, taps, dtRaw) {
    const dt = Math.min(dtRaw, 0.05);
    const raw = engine.isPlaying ? engine.getLevels(spec) : 0; if (engine.isPlaying) engine.getWave(wave); else { spec.fill(0); wave.fill(128); }
    smoothLevel += (clamp(raw * 6, 0, 1) - smoothLevel) * 0.08;
    let speed = MOTION[S.motion]; if (S.reduced) speed = Math.min(speed, 0.25); if (S.paused) speed = 0;
    return { dt, speed, level: smoothLevel, spec, wave, freq: engine.tone && engine.tone.playing ? engine.tone.freq : null, pointer, taps, breathText: S.breathText, reduced: S.reduced, still: S.motion === 'still' || S.paused };
  }

  // ---------- preview cards ----------
  const previews = new Map(); // canvas -> { inst, visible }
  const io = new IntersectionObserver(entries => entries.forEach(en => { const p = previews.get(en.target); if (p) p.visible = en.isIntersecting; }), { rootMargin: '100px' });
  let lastPrev = 0;
  function previewLoop(now) {
    requestAnimationFrame(previewLoop);
    if (document.hidden || !$('#view-focus') || $('#view-focus').hidden || !$('#focus-screen').hidden) return;
    if (now - lastPrev < 66) return; const dt = (now - lastPrev) / 1000; lastPrev = now;
    const env = makeEnv({ x: 0.5, y: 0.5, on: false, down: false }, [], dt);
    previews.forEach((p, c) => { if (!p.visible) return; p.inst.draw(c.getContext('2d'), c.width, c.height, env); });
  }
  requestAnimationFrame(previewLoop);

  function renderLibrary() {
    const host = $('#visual-library'); host.innerHTML = '';
    CATS.forEach(cat => {
      const sec = document.createElement('section'); sec.className = 'vis-cat';
      sec.innerHTML = `<h2 class="group-title">${cat}</h2><p class="muted vis-cat-desc">${CAT_DESC[cat]}</p><div class="vis-grid" role="list"></div>`;
      const grid = $('.vis-grid', sec);
      V.filter(v => v.cat === cat && !v.hidden).forEach(v => {
        const card = document.createElement('div'); card.className = 'vis-card' + (v.id === S.visual ? ' active' : ''); card.dataset.id = v.id; card.setAttribute('role', 'listitem');
        card.innerHTML = `<canvas width="320" height="200" aria-hidden="true"></canvas><div class="vis-meta"><div class="vis-name">${v.name}${v.interactive ? ' <span class="tag">Touch</span>' : ''}${v.reactive ? ' <span class="tag">Sound</span>' : ''}</div><div class="vis-desc">${v.desc}</div></div><div class="vis-actions"><button class="btn btn-secondary btn-sm" data-select>Use this visual</button><button class="btn btn-primary btn-sm" data-open>Open in Focus</button></div>`;
        const c = $('canvas', card); previews.set(c, { inst: v.make(), visible: false }); io.observe(c);
        $('[data-select]', card).addEventListener('click', () => { setVisual(v.id); app.toast(`Visual: ${v.name}`); });
        $('[data-open]', card).addEventListener('click', () => { setVisual(v.id); enterFocus(); });
        grid.appendChild(card);
      });
      host.appendChild(sec);
    });
  }
  function setVisual(id) { if (!byId[id]) return; S.visual = id; app.store.set('visual', id); $$('.vis-card').forEach(c => c.classList.toggle('active', c.dataset.id === id)); $('#current-visual-name').textContent = byId[id].name; if (focus.inst && focus.visualId !== id) focus.load(id); }

  // ---------- pairings ----------
  const PAIRINGS = [
    { id: 'oceanescape', name: 'Ocean Escape', visual: 'ocean', mix: [{ id: 'ocean', volume: 0.6 }, { id: 'brown', volume: 0.25 }], blurb: 'Slow waves · Ocean + soft brown noise' },
    { id: 'rainwindowp', name: 'Rain Window', visual: 'rainwindow', mix: [{ id: 'rain', volume: 0.55 }, { id: 'pink', volume: 0.25 }], blurb: 'Rain on glass · Rain + gentle pink noise' },
    { id: 'fireside', name: 'Fireplace', visual: 'fireplace', mix: [{ id: 'fire', volume: 0.6 }, { id: 'pink', volume: 0.2 }], blurb: 'Low flames · Fireplace + soft broadband' },
    { id: 'floating', name: 'Floating', visual: 'particles', mix: [{ id: 'brown', volume: 0.55 }], blurb: 'Drifting particles · Brown noise' },
    { id: 'deepfocus', name: 'Deep Focus', visual: 'circles', mix: [{ id: 'pink', volume: 0.5 }], blurb: 'Expanding circles · Pink noise' },
    { id: 'night', name: 'Night', visual: 'nightsky', mix: [{ id: 'night', volume: 0.45 }, { id: 'brown', volume: 0.4 }], blurb: 'Slow stars · Night ambience + brown noise' },
  ];
  function renderPairings() {
    const host = $('#pairings'); host.innerHTML = '';
    PAIRINGS.forEach(p => {
      const v = byId[p.visual]; const el = document.createElement('div'); el.className = 'pair-card';
      el.innerHTML = `<canvas width="320" height="180" aria-hidden="true"></canvas><div class="pair-body"><div class="pair-name">${p.name}</div><div class="pair-rows"><div><span class="lbl">Visual</span>${v.name}</div><div><span class="lbl">Sound</span>${p.mix.map(m => engine.def(m.id).name).join(' + ')}</div></div><button class="btn btn-primary btn-sm">Start</button></div>`;
      const c = $('canvas', el); previews.set(c, { inst: v.make(), visible: false }); io.observe(c);
      $('button', el).addEventListener('click', async () => { setVisual(p.visual); await app.loadPreset({ name: p.name, mix: p.mix, master: 0.35 }); enterFocus(); });
      host.appendChild(el);
    });
  }

  // ---------- favourites (sound + visual + movement + timer) ----------
  function renderFavs() {
    const host = $('#fav-list'); host.innerHTML = ''; const favs = app.store.get('combos', []);
    if (!favs.length) host.innerHTML = '<p class="muted">Nothing saved yet. Set up a sound and a visual, then tap "Save this combination".</p>';
    favs.forEach((f, i) => {
      const el = document.createElement('div'); el.className = 'fav-card';
      const lines = f.mix.map(m => `${engine.def(m.id).name} — ${Math.round(m.volume * 100)}%`); lines.push(`Visual — ${byId[f.visual] ? byId[f.visual].name : f.visual}`); lines.push(`Movement — ${f.motion[0].toUpperCase() + f.motion.slice(1)}`); if (f.timer) lines.push(`Timer — ${f.timer} minutes`);
      el.innerHTML = `<div class="fav-name">${f.name}</div><div class="fav-lines">${lines.map(l => `<div>${l}</div>`).join('')}</div><div class="btn-row"><button class="btn btn-primary btn-sm" data-start>Start</button><button class="btn btn-ghost btn-sm" data-del aria-label="Delete ${f.name}">Delete</button></div>`;
      $('[data-start]', el).addEventListener('click', async () => { S.motion = f.motion; app.store.set('motion', f.motion); syncSettings(); setVisual(f.visual); await app.loadPreset({ name: f.name, mix: f.mix, master: f.master }); engine.setTimer(f.timer || 0, true); enterFocus(); });
      $('[data-del]', el).addEventListener('click', () => { favs.splice(i, 1); app.store.set('combos', favs); renderFavs(); });
      host.appendChild(el);
    });
  }
  $('#fav-save').addEventListener('click', () => {
    let form = $('#fav-form'); if (form) { form.remove(); return; }
    form = document.createElement('form'); form.id = 'fav-form'; form.className = 'inline-form';
    form.innerHTML = `<label class="sr-only" for="fav-name">Name</label><input id="fav-name" class="select" maxlength="40" value="My Focus" style="min-width:200px"><button type="submit" class="btn btn-primary btn-sm">Save</button><button type="button" class="btn btn-ghost btn-sm" data-cancel>Cancel</button>`;
    $('#fav-save').after(form); const inp = $('#fav-name', form); inp.focus(); inp.select(); $('[data-cancel]', form).addEventListener('click', () => form.remove());
    form.addEventListener('submit', e => { e.preventDefault(); const favs = app.store.get('combos', []); favs.push({ name: inp.value.trim() || 'My Focus', mix: engine.activeList().map(s => ({ id: s.id, volume: s.volume, balance: s.balance })), master: engine.masterVolume, visual: S.visual, motion: S.motion, timer: engine.timer.durationMin || 0 }); app.store.set('combos', favs); form.remove(); renderFavs(); app.toast('Saved on this device'); });
  });

  // ---------- settings UI ----------
  function syncSettings() {
    $$('[data-motion]').forEach(b => b.setAttribute('aria-checked', b.dataset.motion === S.motion));
    $$('#reduce-motion, #focus-reduce').forEach(c => c.checked = S.reduced);
    $$('#breath-text, #focus-breath-text').forEach(c => c.checked = S.breathText);
    $('#current-visual-name').textContent = byId[S.visual].name;
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-motion]'); if (!b) return; S.motion = b.dataset.motion; app.store.set('motion', S.motion); syncSettings(); });
  document.addEventListener('change', e => {
    if (e.target.matches('#reduce-motion, #focus-reduce')) { S.reduced = e.target.checked; app.store.set('reduceMotion', S.reduced); syncSettings(); }
    if (e.target.matches('#breath-text, #focus-breath-text')) { S.breathText = e.target.checked; app.store.set('breathText', S.breathText); syncSettings(); }
  });

  // ---------- FOCUS MODE ----------
  const screen = $('#focus-screen'), canvas = $('#focus-canvas'), ctx = canvas.getContext('2d');
  const focus = { inst: null, visualId: null, last: 0, hideT: null, raf: null, pointer: { x: 0.5, y: 0.5, on: false, down: false }, taps: [], tapId: 0, wake: null,
    load(id) { this.visualId = id; this.inst = byId[id].make(); this.taps = []; $('#focus-visual-name').textContent = byId[id].name; $('#focus-breath-row').hidden = id !== 'breathing'; } };
  function resize() { const dpr = Math.min(devicePixelRatio || 1, 1.5); const w = innerWidth, h = innerHeight; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); focus.w = w; focus.h = h; }
  addEventListener('resize', () => { if (!screen.hidden) resize(); });
  function loop(now) {
    if (screen.hidden) return; focus.raf = requestAnimationFrame(loop);
    const dt = (now - focus.last) / 1000 || 0.016; focus.last = now;
    if (document.hidden) return;
    focus.taps = focus.taps.filter(t => (t.age += dt) < 10);
    const env = makeEnv(focus.pointer, focus.taps, dt);
    focus.inst.draw(ctx, focus.w, focus.h, env);
    // drift the pointer effect off when idle
  }
  function showControls() { screen.classList.remove('idle'); clearTimeout(focus.hideT); focus.hideT = setTimeout(() => { if (!$('#focus-panel').classList.contains('open')) screen.classList.add('idle'); }, 4500); }
  async function enterFocus() {
    if (!screen.hidden) return;
    focus.load(S.visual); screen.hidden = false; document.body.style.overflow = 'hidden'; resize(); focus.last = performance.now(); loop(focus.last);
    if (window.softwaveBg) window.softwaveBg.running = false;
    updateFocusBar(); showControls(); syncSettings(); $('#focus-exit').focus();
    try { if (navigator.wakeLock) focus.wake = await navigator.wakeLock.request('screen'); } catch (_) { }
    if (engine.activeList().length && !engine.isPlaying) engine.playAll();
  }
  function exitFocus() {
    if (engine.ctx) engine.resetMasterShape();
    screen.hidden = true; document.body.style.overflow = ''; cancelAnimationFrame(focus.raf); closePanel();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
    if (focus.wake) { focus.wake.release().catch(() => { }); focus.wake = null; }
    if (window.softwaveBg) { window.softwaveBg.running = true; window.softwaveBg.loop(); }
  }
  $('#focus-exit').addEventListener('click', exitFocus);
  $('#focus-enter').addEventListener('click', enterFocus);
  $('#focus-fullscreen').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else screen.requestFullscreen && screen.requestFullscreen().catch(() => { }); });
  $('#focus-pause-visual').addEventListener('click', e => { S.paused = !S.paused; e.currentTarget.setAttribute('aria-pressed', S.paused); e.currentTarget.textContent = S.paused ? 'Resume visual' : 'Pause visual'; });
  screen.addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('#focus-panel').classList.contains('open')) closePanel(); else exitFocus(); } });
  // pointer / touch interactions on the canvas
  const toNorm = ev => ({ x: ev.clientX / focus.w, y: ev.clientY / focus.h });
  canvas.addEventListener('pointermove', ev => { const p = toNorm(ev); focus.pointer.x = p.x; focus.pointer.y = p.y; focus.pointer.on = true; showControls(); });
  canvas.addEventListener('pointerdown', ev => { const p = toNorm(ev); focus.pointer.x = p.x; focus.pointer.y = p.y; focus.pointer.on = true; focus.pointer.down = true; focus.taps.push({ x: p.x, y: p.y, age: 0, id: ++focus.tapId }); showControls(); if (window.softwaveLab) window.softwaveLab.onTap(); });
  addEventListener('pointerup', () => { focus.pointer.down = false; });
  canvas.addEventListener('pointerleave', () => { focus.pointer.on = false; focus.pointer.down = false; });
  screen.addEventListener('pointermove', showControls); screen.addEventListener('touchstart', showControls, { passive: true });

  // focus bar: play/pause, volume, change sound, change visual, timer
  function updateFocusBar() {
    const playing = engine.isPlaying; const b = $('#focus-play'); b.setAttribute('aria-pressed', playing); b.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    const names = engine.activeList().map(s => engine.def(s.id).name); if (engine.tone && engine.tone.playing) names.push(`Tone ${Math.round(engine.tone.freq).toLocaleString()} Hz`);
    $('#focus-sound-name').textContent = names.length ? names.join(' + ') : 'No sound';
    const v = $('#focus-vol'); v.value = Math.round(engine.masterVolume * 100); app.paintRange(v);
    const t = engine.timer; $('#focus-timer-label').textContent = t.endsAt ? `${Math.max(0, Math.ceil((t.endsAt - Date.now()) / 60000))} min` : 'Timer';
    $$('#focus-panel [data-min]').forEach(x => x.setAttribute('aria-checked', String(+x.dataset.min === (t.durationMin || 0))));
  }
  engine.on(type => { if (!screen.hidden && ['sounds', 'state', 'tone', 'timer', 'master'].includes(type)) updateFocusBar(); });
  $('#focus-play').addEventListener('click', () => app.togglePlay());
  $('#focus-vol').addEventListener('input', e => app.setMaster(+e.target.value / 100, true));

  // panels
  function openPanel(which) {
    const panel = $('#focus-panel'); panel.classList.add('open'); panel.hidden = false; screen.classList.remove('idle'); $$('.focus-pane', panel).forEach(p => p.hidden = p.dataset.pane !== which);
    if (which === 'sound') renderSoundPane(); if (which === 'visual') renderVisualPane(); if (which === 'timer') updateFocusBar();
    $('.focus-pane:not([hidden]) button', panel)?.focus();
  }
  function closePanel() { const panel = $('#focus-panel'); panel.classList.remove('open'); panel.hidden = true; showControls(); }
  $$('[data-open-pane]').forEach(b => b.addEventListener('click', () => { const p = $('#focus-panel'); (!p.hidden && $(`.focus-pane[data-pane="${b.dataset.openPane}"]`, p).hidden === false) ? closePanel() : openPanel(b.dataset.openPane); }));
  $('#focus-panel-close').addEventListener('click', closePanel);
  function renderSoundPane() {
    const host = $('[data-pane="sound"] .pane-body'); host.innerHTML = '';
    const pre = document.createElement('div'); pre.className = 'chips'; app.PRESETS.forEach(p => { const b = document.createElement('button'); b.className = 'chip'; b.innerHTML = `<strong>${p.name}</strong><span>${p.desc}</span>`; b.addEventListener('click', () => { app.loadPreset(p); renderSoundPane(); }); pre.appendChild(b); }); host.appendChild(pre);
    const h = document.createElement('div'); h.className = 'row-title'; h.textContent = 'Layer sounds (up to 5)'; host.appendChild(h);
    const grid = document.createElement('div'); grid.className = 'pane-sounds';
    engine.defs().forEach(d => { const on = engine.isActive(d.id); const b = document.createElement('button'); b.className = 'pane-sound' + (on ? ' on' : ''); b.setAttribute('aria-pressed', on); b.innerHTML = `<span class="ico">${d.icon}</span>${d.name}`; b.addEventListener('click', async () => { const ok = await engine.toggleSound(d.id, 0.5); if (ok === false) app.toast('Up to 5 sounds at once'); renderSoundPane(); }); grid.appendChild(b); });
    host.appendChild(grid);
    const foot = document.createElement('div'); foot.className = 'btn-row'; foot.innerHTML = '<button class="btn btn-ghost btn-sm" id="pane-stop">Stop all</button>'; host.appendChild(foot); $('#pane-stop', foot).addEventListener('click', () => { engine.stopAll(); renderSoundPane(); });
  }
  function renderVisualPane() {
    const host = $('[data-pane="visual"] .pane-body'); host.innerHTML = '';
    CATS.forEach(cat => { const h = document.createElement('div'); h.className = 'row-title'; h.textContent = cat; host.appendChild(h); const g = document.createElement('div'); g.className = 'pane-visuals'; V.filter(v => v.cat === cat && !v.hidden).forEach(v => { const b = document.createElement('button'); b.className = 'pane-visual' + (v.id === S.visual ? ' on' : ''); b.setAttribute('aria-pressed', v.id === S.visual); b.textContent = v.name; b.addEventListener('click', () => { setVisual(v.id); renderVisualPane(); }); g.appendChild(b); }); host.appendChild(g); });
  }
  $$('#focus-panel [data-min]').forEach(b => b.addEventListener('click', () => { engine.setTimer(+b.dataset.min, true); updateFocusBar(); if (+b.dataset.min) app.toast(`Timer: ${b.dataset.min} minutes, with gentle fade`); }));

  // Frequency page hook: open the Sound Visualizer with the generator
  $('#freq-visualizer').addEventListener('click', async () => { if (!(engine.tone && engine.tone.playing)) $('#freq-play').click(); setVisual('frequency'); enterFocus(); });

  // expose for app
  window.softwaveFocus = { enterFocus, exitFocus, setVisual, visuals: V.filter(v => !v.hidden), allVisuals: V, setParam: (k, v) => { P[k] = v; }, getParam: () => P };

  // ---------- init ----------
  renderLibrary(); renderPairings(); renderFavs(); syncSettings();
  const qf = new URLSearchParams(location.search).get('focus'); if (qf && byId[qf]) { setVisual(qf); setTimeout(enterFocus, 50); }
})();
