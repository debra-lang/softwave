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
  const P = { target: 'light', sync: true, haptic: false, soundTouch: false, breathPeriod: 0, dim: 0, slow: 0, time: 0.5 };   // experiment parameters (dim/slow/time are ramped by journeys)

  // ===== NATURE =====
  // ===== Noise texture helper: fBm rendered at low resolution, drawn scaled (soft, fast) =====
  const PERM = (() => { const p = new Uint8Array(512); const a = []; for (let i = 0; i < 256; i++) a[i] = i; for (let i = 255; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } for (let i = 0; i < 512; i++) p[i] = a[i & 255]; return p; })();
  function vnoise(x, y, z) { // 3D value noise, smooth
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255, zi = Math.floor(z) & 255; const xf = x - Math.floor(x), yf = y - Math.floor(y), zf = z - Math.floor(z);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const h = (a, b, c) => PERM[(PERM[(PERM[a] + b) & 511] + c) & 511] / 255;
    const x1 = xi + 1, y1 = yi + 1, z1 = zi + 1;
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h(xi, yi, zi), h(x1, yi, zi), u), l(h(xi, y1, zi), h(x1, y1, zi), u), v), l(l(h(xi, yi, z1), h(x1, yi, z1), u), l(h(xi, y1, z1), h(x1, y1, z1), u), v), w);
  }
  function fbm(x, y, z, oct = 4) { let a = 0, amp = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { a += vnoise(x * f, y * f, z) * amp; n += amp; amp *= 0.5; f *= 2; } return a / n; }
  class NoiseTex {
    constructor(w, h) { this.w = w; this.h = h; this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h; this.ctx = this.c.getContext('2d'); this.img = this.ctx.createImageData(w, h); this.frame = 0; }
    render(fn, every = 1) { if ((this.frame++ % every) !== 0) return; const d = this.img.data; let i = 0; for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const p = fn(x / this.w, y / this.h); d[i++] = p[0]; d[i++] = p[1]; d[i++] = p[2]; d[i++] = p[3]; } this.ctx.putImageData(this.img, 0, 0); }
    draw(ctx, w, h, alpha = 1, op = 'source-over') { ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = op; ctx.imageSmoothingEnabled = true; ctx.drawImage(this.c, 0, 0, w, h); ctx.restore(); }
  }
  const mix = (a, b, t) => a + (b - a) * t;

  add({ id: 'clouds', name: 'Drifting Clouds', cat: 'Nature', desc: 'Soft clouds moving across a quiet sky.', make() {
    let t = 0; const tex = new NoiseTex(128, 72); return { draw(ctx, w, h, e) { t += e.dt * e.speed * 0.05; const d = isDark();
      sky(ctx, w, h, d ? '#0c1633' : '#7fb3ea', d ? '#1c2c57' : '#cfe3fa');
      if (!d) glow(ctx, w * 0.8, h * 0.15, w * 0.35, 'rgba(255,250,225,A)', 0.5);
      tex.render((u, v) => { const n1 = fbm(u * 3.2 + t * 2.4, v * 2.2 + 0.3, t * 0.4, 5); const n2 = fbm(u * 6 + t * 4 + 7, v * 5, t * 0.7, 3); const c = Math.max(0, (n1 - 0.42) * 2.6 + (n2 - 0.5) * 0.6); const dens = Math.min(1, c) * (1 - Math.pow(Math.abs(v - 0.45) * 1.4, 2)); const shade = 0.75 + 0.25 * n2; const base = d ? 150 : 255; return [base * shade, (d ? 165 : 255) * shade, (d ? 210 : 255) * Math.min(1, shade + 0.05), dens * (d ? 170 : 235)]; }, 2);
      tex.draw(ctx, w, h, 1);
      const tex2 = tex; // second, faster thin layer for depth
      ctx.save(); ctx.globalAlpha = 0.35; ctx.translate(-w * 0.1 * ((t * 3) % 1), h * 0.25); ctx.drawImage(tex2.c, 0, 0, w * 1.2, h * 0.9); ctx.restore();
    } }; } });

  add({ id: 'fireplace', name: 'Fireplace', cat: 'Nature', desc: 'Low flames and drifting embers.', make() {
    let t = 0; const tex = new NoiseTex(72, 96); const embers = Array.from({ length: 40 }, () => ({ x: rnd(0.62, 0.38), y: rnd(0.78, 0.3), s: rnd(0.14, 0.05), r: rnd(2.2, 0.8), ph: Math.random() * 6 }));
    return { draw(ctx, w, h, e) { t += e.dt * e.speed;
      sky(ctx, w, h, '#07040a', '#1a0c06'); const base = h * 0.8;
      // hearth stones
      ctx.fillStyle = '#1c1410'; ctx.fillRect(w * 0.22, h * 0.25, w * 0.56, h * 0.6); for (let i = 0; i < 30; i++) { const bx = w * 0.22 + (i % 6) * w * 0.0933, by = h * 0.25 + Math.floor(i / 6) * h * 0.12; ctx.fillStyle = `hsl(20 18% ${11 + (i * 7) % 6}%)`; ctx.fillRect(bx + 2, by + 2, w * 0.0933 - 4, h * 0.12 - 4); }
      ctx.fillStyle = '#050304'; ctx.fillRect(w * 0.28, h * 0.33, w * 0.44, h * 0.47);
      // glow on the room
      glow(ctx, w * 0.5, base - h * 0.1, w * 0.5, 'rgba(255,120,40,A)', 0.25 + e.level * 0.15 + Math.sin(t * 3) * 0.02);
      // logs (behind the flames), rounded with a glowing underside
      for (const [lx, ly, lw, a] of [[0.37, 0.775, 0.26, -0.07], [0.39, 0.75, 0.24, 0.09]]) { ctx.save(); ctx.translate(w * lx + w * lw / 2, h * ly); ctx.rotate(a); const lg = ctx.createLinearGradient(0, -h * 0.02, 0, h * 0.02); lg.addColorStop(0, '#3a1d0c'); lg.addColorStop(1, '#6a2c0a'); ctx.fillStyle = lg; ctx.beginPath(); ctx.roundRect(-w * lw / 2, -h * 0.02, w * lw, h * 0.04, h * 0.02); ctx.fill(); ctx.restore(); }
      glow(ctx, w * 0.5, base - h * 0.03, w * 0.14, 'rgba(255,140,40,A)', 0.7 + Math.sin(t * 2.1) * 0.1);
      // flames: noise-driven, rising; white-hot core → yellow → orange → transparent
      tex.render((u, v) => { const x = (u - 0.5) * 2; const vv = 1 - v; const n = fbm(u * 4 + Math.sin(t) * 0.2, v * 6 + t * 2.4, t * 0.5, 4); const n2 = fbm(u * 9 + 3, v * 12 + t * 3.5, t, 2); const shape = Math.max(0, 1 - Math.abs(x) * (1.0 + vv * 1.8)) * Math.pow(1 - vv, 0.6); const f = shape * (0.45 + n * 1.2 + (n2 - 0.5) * 0.5) - vv * 0.35; const i = Math.max(0, Math.min(1, f * 1.5)); const core = Math.max(0, i - 0.88) * 8; return [255, 40 + 150 * i + 40 * core, 10 + 25 * i * i + 120 * core, Math.pow(i, 1.3) * 255]; }, 1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = 'blur(8px)'; ctx.globalAlpha = 0.35; ctx.drawImage(tex.c, w * 0.28, base - h * 0.46, w * 0.44, h * 0.5); ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.drawImage(tex.c, w * 0.3, base - h * 0.44, w * 0.4, h * 0.47); ctx.restore();
      // embers, kept inside the firebox
      ctx.save(); ctx.beginPath(); ctx.rect(w * 0.28, h * 0.33, w * 0.44, h * 0.47); ctx.clip();
      for (const m of embers) { m.y -= m.s * e.dt * e.speed; m.x += Math.sin(t * 1.5 + m.ph + m.y * 8) * 0.0007; if (m.y < 0.3) { m.y = rnd(0.78, 0.7); m.x = rnd(0.6, 0.4); } const a = Math.max(0, 1 - (0.78 - m.y) * 2.2); ctx.fillStyle = `rgba(255,${120 + Math.floor(a * 110)},50,${a})`; ctx.beginPath(); ctx.arc(m.x * w, m.y * h, m.r * (0.6 + a * 0.6), 0, TAU); ctx.fill(); }
      ctx.restore();
    } }; } });

  add({ id: 'forest', name: 'Forest Breeze', cat: 'Nature', desc: 'Trees swaying gently in soft light.', make() {
    let t = 0; const tex = new NoiseTex(96, 54); const layers = [0, 1, 2, 3].map(L => ({ trees: Array.from({ length: 10 + L * 4 }, (_, i) => ({ x: (i + Math.random() * 0.6) / (10 + L * 4), hgt: rnd(0.5, 0.3) * (1 - L * 0.12), wdt: rnd(0.07, 0.04) * (1 - L * 0.1), seed: Math.random() * 10 })) })); const leaves = Array.from({ length: 20 }, () => ({ x: Math.random(), y: Math.random(), s: rnd(0.04, 0.015), ph: Math.random() * 6 }));
    const drawTree = (ctx, cx, top, ww, hh, col) => { ctx.fillStyle = col; const tiers = 5; for (let k = 0; k < tiers; k++) { const y = top + hh * k / tiers; const half = ww * (0.35 + k * 0.22); ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx - half, y + hh / tiers * 1.5); ctx.lineTo(cx + half, y + hh / tiers * 1.5); ctx.closePath(); ctx.fill(); } ctx.fillRect(cx - ww * 0.06, top + hh, ww * 0.12, hh * 0.25); };
    return { draw(ctx, w, h, e) { t += e.dt * e.speed; const d = isDark();
      sky(ctx, w, h, d ? '#0b1a16' : '#dfeecf', d ? '#06110d' : '#a9cf94');
      // light rays
      ctx.save(); ctx.globalCompositeOperation = d ? 'lighter' : 'source-over'; ctx.filter = 'blur(18px)'; for (let i = 0; i < 4; i++) { const x = w * (0.2 + i * 0.18) + Math.sin(t * 0.2 + i) * 15; const rg = ctx.createLinearGradient(x, 0, x + w * 0.12, h); rg.addColorStop(0, d ? 'rgba(120,200,150,0.10)' : 'rgba(255,250,215,0.35)'); rg.addColorStop(1, 'rgba(255,250,215,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w * 0.06, 0); ctx.lineTo(x + w * 0.22, h); ctx.lineTo(x + w * 0.04, h); ctx.fill(); } ctx.restore();
      // far → near tree layers with mist between them
      for (let L = 3; L >= 0; L--) { const lay = layers[L]; const L2 = L / 3; const light = d ? 9 + L2 * 12 : 20 + L2 * 26; const sat = d ? 28 : 32 + (1 - L2) * 10; const col = `hsl(${135 - L2 * 15} ${sat}% ${light}%)`;
        for (const tr of lay.trees) { const sway = Math.sin(t * 0.5 + tr.seed) * 6 * (1 - L2 * 0.6) + Math.sin(t * 1.3 + tr.seed * 2) * 2; const hh = tr.hgt * h; const top = h * 0.95 - hh - L2 * h * 0.12; drawTree(ctx, tr.x * w + sway, top, tr.wdt * w, hh, col); }
        if (L > 0) { tex.render((u, v) => { const n = fbm(u * 2.5 + t * 0.05 * (4 - L), v * 2 + L, t * 0.1, 4); const a = Math.pow(n, 2.2) * (0.4 + v * 0.8); return d ? [140, 190, 170, a * 120] : [235, 245, 230, a * 170]; }, 3); ctx.save(); ctx.filter = 'blur(10px)'; tex.draw(ctx, w, h, 0.9 - L2 * 0.3); ctx.restore(); } }
      ctx.fillStyle = d ? '#06100b' : '#3f6f3c'; ctx.fillRect(0, h * 0.95, w, h * 0.05);
      ctx.fillStyle = d ? 'rgba(180,230,190,0.45)' : 'rgba(255,255,240,0.7)'; for (const lf of leaves) { lf.x += lf.s * e.dt * e.speed; lf.y += (Math.sin(t * 1.2 + lf.ph) * 0.004 + 0.006) * e.dt * e.speed * 4; if (lf.x > 1.05 || lf.y > 1) { lf.x = -0.05; lf.y = Math.random() * 0.5; } ctx.beginPath(); ctx.ellipse(lf.x * w, lf.y * h, 3, 1.6, Math.sin(t + lf.ph), 0, TAU); ctx.fill(); }
    } }; } });

  add({ id: 'underwater', name: 'Underwater', cat: 'Nature', desc: 'Light rippling through deep blue water.', make() {
    let t = 0; const tex = new NoiseTex(112, 64); const bubbles = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), r: rnd(5, 1.5), s: rnd(0.08, 0.03), ph: Math.random() * 6 })); const motes = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), r: rnd(1.4, 0.5) })); const plants = Array.from({ length: 9 }, (_, i) => ({ x: (i + Math.random()) / 9, hgt: rnd(0.4, 0.18), w: rnd(9, 4) }));
    return { draw(ctx, w, h, e) { t += e.dt * e.speed;
      sky(ctx, w, h, '#0b4f86', '#03152b');
      // caustics: two moving noise fields, ridged
      tex.render((u, v) => { const n1 = fbm(u * 5 + t * 0.25, v * 5 - t * 0.15, t * 0.3, 3); const n2 = fbm(u * 5 - t * 0.2 + 9, v * 5 + t * 0.2, t * 0.25 + 4, 3); const r = 1 - Math.abs(n1 - n2) * 6; const a = Math.max(0, r) * (1 - v * 0.75); return [170, 230, 255, a * a * 200]; }, 2);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; tex.draw(ctx, w, h, 0.55, 'lighter'); ctx.restore();
      // god rays
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = 'blur(14px)'; for (let i = 0; i < 6; i++) { const x = w * (0.15 + i * 0.14) + Math.sin(t * 0.25 + i) * 30; const g = ctx.createLinearGradient(x, 0, x + 50, h); g.addColorStop(0, `rgba(150,215,255,${0.10 + Math.sin(t * 0.5 + i) * 0.03})`); g.addColorStop(1, 'rgba(150,215,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 50, 0); ctx.lineTo(x + 160, h); ctx.lineTo(x + 30, h); ctx.fill(); } ctx.restore();
      // plants
      for (const p of plants) { ctx.strokeStyle = 'rgba(18,80,62,0.85)'; ctx.lineWidth = p.w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x * w, h); for (let i = 1; i <= 10; i++) { const k = i / 10; ctx.lineTo(p.x * w + Math.sin(t * 0.7 + i * 0.5 + p.x * 6) * k * k * 28, h - p.hgt * h * k); } ctx.stroke(); }
      ctx.fillStyle = 'rgba(210,235,255,0.35)'; for (const m of motes) { m.y -= 0.01 * e.dt * e.speed; m.x += Math.sin(t * 0.5 + m.y * 10) * 0.0003; if (m.y < 0) m.y = 1; ctx.beginPath(); ctx.arc(m.x * w, m.y * h, m.r, 0, TAU); ctx.fill(); }
      for (const b of bubbles) { b.y -= b.s * e.dt * e.speed; b.x += Math.sin(t * 1.4 + b.ph) * 0.0006; if (b.y < -0.05) { b.y = 1.05; b.x = Math.random(); } const x = b.x * w, y = b.y * h; const g = ctx.createRadialGradient(x - b.r * 0.3, y - b.r * 0.3, 0, x, y, b.r); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.7, 'rgba(200,230,255,0.08)'); g.addColorStop(1, 'rgba(220,240,255,0.5)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, b.r, 0, TAU); ctx.fill(); }
      // depth vignette
      const vg = ctx.createRadialGradient(w / 2, h * 0.3, h * 0.3, w / 2, h * 0.5, h); vg.addColorStop(0, 'rgba(0,10,30,0)'); vg.addColorStop(1, 'rgba(0,10,30,0.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    } }; } });

  add({ id: 'waterfall', name: 'Waterfall', cat: 'Nature', desc: 'A curtain of falling water and soft mist.', make() {
    let t = 0; const tex = new NoiseTex(64, 128); const mist = new NoiseTex(80, 45); const drops = Array.from({ length: 60 }, () => ({ x: rnd(0.72, 0.28), y: Math.random(), s: rnd(1.1, 0.7), l: rnd(0.12, 0.04) }));
    return { draw(ctx, w, h, e) { t += e.dt * e.speed; const d = isDark();
      sky(ctx, w, h, d ? '#0b1a22' : '#d6e9ec', d ? '#0a2a30' : '#7fb0b5');
      // rock walls with noise texture
      for (const [rx, rw] of [[0, 0.28], [0.72, 0.28]]) { const g = ctx.createLinearGradient(rx * w, 0, (rx + rw) * w, 0); g.addColorStop(0, d ? '#0a1519' : '#4a6658'); g.addColorStop(1, d ? '#122228' : '#5f7d6c'); ctx.fillStyle = g; ctx.fillRect(rx * w, 0, rw * w, h); for (let i = 0; i < 40; i++) { const x = (rx + Math.random() * rw) * w, y = Math.random() * h; ctx.fillStyle = `rgba(${d ? '30,60,70' : '90,130,110'},${Math.random() * 0.35})`; ctx.beginPath(); ctx.ellipse(x, y, rnd(30, 8), rnd(12, 4), rnd(1), 0, TAU); ctx.fill(); } }
      // the water curtain: vertical streaked noise scrolling down
      tex.render((u, v) => { const n = fbm(u * 10, v * 3 - t * 2.5, 0, 3); const n2 = fbm(u * 30 + 5, v * 1.5 - t * 3.5, 1, 2); const edge = Math.min(1, Math.min(u, 1 - u) * 6); const a = (0.45 + n * 0.5) * edge * (0.7 + n2 * 0.5); return [225, 242, 250, Math.min(255, a * 255)]; }, 1);
      ctx.save(); ctx.globalAlpha = 0.92; ctx.drawImage(tex.c, w * 0.28, 0, w * 0.44, h); ctx.restore();
      for (const s of drops) { s.y += s.s * e.dt * e.speed * 0.8; if (s.y > 1.1) { s.y = -s.l; s.x = rnd(0.72, 0.28); } ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(s.x * w, s.y * h); ctx.lineTo(s.x * w + 1, (s.y + s.l) * h); ctx.stroke(); }
      // plunge pool mist rising
      mist.render((u, v) => { const n = fbm(u * 3 + t * 0.1, v * 2 - t * 0.35, t * 0.2, 3); const a = Math.max(0, n - 0.3) * 1.5 * Math.pow(v, 1.4); return [235, 248, 255, a * 200]; }, 2);
      ctx.save(); ctx.globalAlpha = 0.85; ctx.drawImage(mist.c, 0, h * 0.45, w, h * 0.55); ctx.restore();
      ctx.fillStyle = d ? 'rgba(150,210,230,0.18)' : 'rgba(230,250,255,0.35)'; ctx.fillRect(0, h * 0.9, w, h * 0.1);
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
        const deep = e.sound ? 1 - e.sound.colour : 0.5; const rate = 0.6 + (1 - deep) * 0.8; const size = Math.min(w, h) * (0.14 + deep * 0.1);
        for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += e.dt * Math.max(e.speed, 0.3) * rate; if (r.t > 7) { rings.splice(i, 1); continue; } for (let k = 0; k < 4; k++) { const rad = (r.t - k * 0.4) * size; if (rad <= 0) continue; ctx.beginPath(); ctx.arc(r.x * w, r.y * h, rad, 0, TAU); const a = Math.max(0, 0.55 - r.t * 0.08 - k * 0.1); ctx.strokeStyle = `rgba(${isDark() ? '180,220,255' : '255,255,255'},${a})`; ctx.lineWidth = (3.5 + deep * 3 - k * 0.7); ctx.stroke(); } }
        for (let k = 0; k < 4; k++) { ctx.beginPath(); for (let x = 0; x <= w; x += 10) ctx.lineTo(x, h * (0.2 + k * 0.2) + Math.sin(x * 0.008 + t * 0.5 + k) * 10); ctx.strokeStyle = `rgba(${isDark() ? '140,200,255' : '255,255,255'},0.08)`; ctx.lineWidth = 30; ctx.stroke(); }
        if (rings.length === 0 && opts.hint) { ctx.fillStyle = isDark() ? 'rgba(200,220,255,0.5)' : 'rgba(20,50,80,0.45)'; ctx.font = `500 ${Math.max(14, w * 0.018)}px Manrope, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('Touch the water', w / 2, h * 0.5); }
      } }; } };
  }

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
  add({ id: 'breathing', featured: true, name: 'Breathing Circle', cat: 'Breathing', desc: 'A circle that grows as you breathe in and settles as you breathe out.', make() {
    let t = 0; return { draw(ctx, w, h, e) { const k = P.breathPeriod ? P.breathPeriod / 12 : 1; const IN = 4 * k, HOLD = 1 * k, OUT = 6 * k, REST = 1 * k, CYC = IN + HOLD + OUT + REST; t += e.dt * (e.still ? 0 : Math.max(e.speed, 0.6)); const p = t % CYC; let s, label;
      if (p < IN) { const q = p / IN; s = q * q * (3 - 2 * q); label = 'Breathe in'; } else if (p < IN + HOLD) { s = 1; label = 'Breathe in'; } else if (p < IN + HOLD + OUT) { const q = (p - IN - HOLD) / OUT; s = 1 - q * q * (3 - 2 * q); label = 'Breathe out'; } else { s = 0; label = 'Breathe out'; }
      sky(ctx, w, h, isDark() ? '#090c1c' : '#f3f5fb', isDark() ? '#0e1332' : '#e3e8f6'); const cx = w / 2, cy = h / 2, R = Math.min(w, h) * (0.16 + s * 0.16);
      glow(ctx, cx, cy, R * 2.2, isDark() ? 'rgba(140,170,255,A)' : 'rgba(90,130,240,A)', 0.25 + s * 0.2); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fillStyle = isDark() ? 'rgba(150,180,255,0.25)' : 'rgba(90,130,240,0.22)'; ctx.fill(); ctx.strokeStyle = isDark() ? 'rgba(200,215,255,0.8)' : 'rgba(60,100,220,0.7)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * 0.34, 0, TAU); ctx.strokeStyle = isDark() ? 'rgba(200,215,255,0.12)' : 'rgba(60,100,220,0.12)'; ctx.lineWidth = 1; ctx.stroke();
      if (e.breathText) { ctx.fillStyle = isDark() ? 'rgba(230,236,255,0.9)' : 'rgba(20,30,60,0.8)'; ctx.font = `600 ${Math.max(18, Math.min(w, h) * 0.045)}px Manrope, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, cx, cy); ctx.textBaseline = 'alphabetic'; }
    } }; } });

  // ===== PREMIUM ENVIRONMENTS (Visual Focus redesign) =====
  // e.sound: { colour 0..1, warm, moving, nature } of the dominant sound — every environment reads it subtly.
  const sndColour = e => (e.sound ? e.sound.colour : 0.45);

  add({ id: 'flow', name: 'Abstract Flow', cat: 'Abstract', featured: true, desc: 'Liquid, silk-like forms that keep evolving without repeating.', make() {
    let t = 0; const tex = new NoiseTex(96, 54); const ribbons = Array.from({ length: 7 }, (_, i) => ({ ph: i * 0.9, y: 0.2 + i * 0.1, hue: i * 9 }));
    return { draw(ctx, w, h, e) { t += e.dt * e.speed * 0.25; const c = sndColour(e); const warm = e.sound ? e.sound.warm : 0;
      const base = isDark() ? [8, 11, 26] : [244, 242, 247]; ctx.fillStyle = `rgb(${base.join(',')})`; ctx.fillRect(0, 0, w, h);
      tex.render((u, v) => { const n = fbm(u * 2.2 + t * 0.35, v * 2.2 - t * 0.2, t * 0.15, 4); const n2 = fbm(u * 4 - t * 0.25 + 3, v * 3 + t * 0.3, t * 0.1 + 2, 3); const k = Math.pow(Math.max(0, n - 0.28) * 1.5, 1.4); const hue = 220 - warm * 40 + n2 * 50 + (c - 0.5) * 30; const s = isDark() ? 55 : 60, l = isDark() ? 45 + n2 * 20 : 75; const [r, g, b] = hsl(hue, s, l); return [r, g, b, k * (isDark() ? 170 : 120)]; }, 2);
      ctx.save(); ctx.filter = 'blur(14px)'; tex.draw(ctx, w, h, 1, isDark() ? 'lighter' : 'source-over'); ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = isDark() ? 'lighter' : 'multiply'; ctx.lineCap = 'round';
      for (const rb of ribbons) { ctx.beginPath(); for (let x = 0; x <= w; x += 8) { const u = x / w; const y = h * rb.y + Math.sin(u * 3 + t * 1.2 + rb.ph) * h * 0.12 * (1 + e.level * 0.5) + (fbm(u * 2 + rb.ph, t * 0.5, rb.ph, 3) - 0.5) * h * 0.22; ctx.lineTo(x, y); } ctx.strokeStyle = `hsla(${225 - warm * 40 + rb.hue},70%,${isDark() ? 70 : 55}%,${isDark() ? 0.16 : 0.12})`; ctx.lineWidth = 18 + (1 - c) * 22; ctx.stroke(); ctx.strokeStyle = `hsla(${225 + rb.hue},80%,${isDark() ? 85 : 45}%,${isDark() ? 0.25 : 0.18})`; ctx.lineWidth = 1.2; ctx.stroke(); }
      ctx.restore();
    } }; } });
  function hsl(h, s, l) { s /= 100; l /= 100; const k = n => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l); const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))]; }


  // ===== PREMIUM ENVIRONMENTS — shared with the Sound Field (SoftwaveField). Persona-adaptive, one instance per id. =====
  const SF = () => window.SoftwaveField;
  function sharedEnvironment(id) { return SF().sharedEnvironment(id); }
  let personaKey = '', personaCache = null;
  function currentPersona() { const l = engine.activeList(); const key = l.map(x => x.id + ':' + Math.round(x.volume * 10)).join(); if (key !== personaKey || !personaCache) { personaKey = key; personaCache = SF().blend(l.map(sn => ({ id: sn.id, volume: sn.volume, params: (sn.id === 'sculpt' || sn.id.startsWith('disco')) ? engine.getSculpt(sn.id) : null }))); } return personaCache; }
  const smoothP = {}; function smoothPersona() { const T = currentPersona(); for (const k in T) { if (Array.isArray(T[k])) smoothP[k] = (smoothP[k] || T[k]).map((v, i) => lerp(v, T[k][i], 0.03)); else if (typeof T[k] === 'number') smoothP[k] = lerp(smoothP[k] == null ? T[k] : smoothP[k], T[k], 0.03); else smoothP[k] = T[k]; } return smoothP; }
  let lowS = 0;
  function stateFrom(e) {
    const F = SF(); const P = smoothPersona(); let lo = 0; for (let i = 1; i < 10; i++) lo += e.spec[i]; lo /= 9 * 255; lowS += (lo - lowS) * 0.04;
    const rate = e.still ? 0 : e.speed * P.speed; const dt = F.tick(performance.now(), rate);
    return { t: F.clock.t, dt: dt * (e.still ? 0 : e.speed), dark: isDark(), P, tint: isDark() ? P.tint : P.light, level: e.level, low: lowS, alive: engine.isPlaying ? 1 : 0.6, reduce: e.reduced, speed: e.still ? 0 : e.speed, pointer: e.pointer, taps: e.taps, breathText: e.breathText };
  }
  const envVisual = (id, name, desc, cat) => ({ id, name, cat: cat || 'Nature', featured: true, desc, make() { return { draw(ctx, w, h, e) { if (!SF()) return; sharedEnvironment(id).draw(ctx, w, h, stateFrom(e)); } }; } });
  add(envVisual('ocean', 'Ocean', 'Broad, slow water under a low light. Deeper sounds make it larger and slower.'));
  add(envVisual('rainwindow', 'Rain Window', 'Translucent rain on glass, depth planes and an occasional ripple.'));
  add(envVisual('nightsky', 'Night Sky', 'Deep layered space, very slow lights, lots of room.'));
  add(envVisual('ripple', 'Ripple', 'A wide field of slow ripples. Tap to add your own; deep sounds make them larger.', 'Abstract'));
  add(envVisual('float', 'Float', 'Soft particles on several depth planes, drifting with a gentle parallax.', 'Abstract'));
  add({ id: 'soundfield', name: 'Sound Field', cat: 'Sound Reactive', featured: true, reactive: true, desc: 'The Sound Field itself, filling the screen.', make() {
    let field = null; return { draw(ctx, w, h, e) { const F = SF(); if (!F) return; if (!field || field.c !== ctx.canvas) { field = new F.Field(ctx.canvas); field.fullscreen = true; field.spot = null; }
      const ids = engine.activeList().map(sn => ({ id: sn.id, volume: sn.volume, params: (sn.id === 'sculpt' || sn.id.startsWith('disco')) ? engine.getSculpt(sn.id) : null })); field.set(ids); field.setPlaying(engine.isPlaying && !e.still); field.speedK = e.still ? 0 : e.speed / 0.4; field.setLevel(e.level, 0); let lo = 0; for (let i = 1; i < 10; i++) lo += e.spec[i]; field.setLow(lo / (9 * 255));
      field.resize = function () { this.w = w; this.h = h; this.rect = { left: 0, top: 0 }; return true; }; field.draw(performance.now()); } }; } });

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

  add({ id: 'synced', name: 'Synced Scene', cat: 'Sound Reactive', reactive: true, desc: 'Takes its form from what is playing: rain falls, ocean rolls, noise drifts; low sounds move large and slow, high sounds fine.', make() {
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
  const MOTION = { still: 0, low: 0.4, medium: 0.8, high: 5.4 };
  const S = {
    visual: app.store.get('visual', 'ocean'),
    motion: app.store.get('motion', 'medium'),
    reduced: app.store.get('reduceMotion', matchMedia('(prefers-reduced-motion: reduce)').matches),
    breathText: app.store.get('breathText', true),
    paused: false,
  };
  // stored enums must still be valid — old or damaged data falls back
  if (!['still', 'low', 'medium', 'high'].includes(S.motion)) S.motion = 'low';
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', ev => { if (ev.matches) { S.reduced = true; syncSettings(); } });
  const spec = new Uint8Array(512), wave = new Uint8Array(1024);
  let smoothLevel = 0;
  function makeEnv(pointer, taps, dtRaw) {
    const dt = Math.min(dtRaw, 0.05);
    const raw = engine.isPlaying ? engine.getLevels(spec) : 0; if (engine.isPlaying) engine.getWave(wave); else { spec.fill(0); wave.fill(128); }
    smoothLevel += (clamp(raw * 6, 0, 1) - smoothLevel) * 0.08;
    let speed = MOTION[S.motion]; if (S.reduced) speed = Math.min(speed, 0.25); if (S.paused) speed = 0; speed *= (1 - P.slow * 0.7);
    const SFg = window.SoftwaveField; if (SFg && SFg.LOW) speed = Math.min(speed, 0.8);   // struggling machines never run High's full speed
    const sound = window.softwaveSound ? softwaveSound() : null;
    return { dt, speed, level: smoothLevel, spec, wave, freq: engine.tone && engine.tone.playing ? engine.tone.freq : null, pointer, taps, breathText: S.breathText, reduced: S.reduced, still: S.motion === 'still' || S.paused, sound };
  }

  // ---------- preview cards ----------
  const previews = new Map(); // canvas -> { inst, visible }
  const io = new IntersectionObserver(entries => entries.forEach(en => { const p = previews.get(en.target); if (p) p.visible = en.isIntersecting; }), { rootMargin: '100px' });
  let lastPrev = 0;
  function previewLoop(now) {
    requestAnimationFrame(previewLoop);
    const vc = $('#visual-chooser'); const chooserOpen = !!vc && !vc.hidden;
    if (document.hidden || !$('#focus-screen').hidden || (!chooserOpen && (!$('#view-focus') || $('#view-focus').hidden))) return;
    if (now - lastPrev < 50) return; const dt = (now - lastPrev) / 1000; lastPrev = now;
    const env = makeEnv({ x: 0.5, y: 0.5, on: false, down: false }, [], dt);
    previews.forEach((p, c) => { if (!p.visible) return; p.inst.draw(c.getContext('2d'), c.width, c.height, env); });
    if (stage && stageInst && stage.offsetParent !== null) { const r = stage.getBoundingClientRect(); const dpr = 1; if (stage.width !== Math.round(r.width)) { stage.width = Math.round(r.width); stage.height = Math.round(r.height); } stageInst.draw(stage.getContext('2d'), stage.width, stage.height, env); }
  }
  requestAnimationFrame(previewLoop);

  const FEATURED = ['ocean', 'rainwindow', 'nightsky', 'float', 'ripple', 'flow', 'breathing', 'soundfield'];
  let stageInst = null, stageId = null; const stage = $('#env-stage-canvas');
  function renderStage() { if (!stage) return; const v = byId[S.visual]; if (!v) return; if (stageId !== v.id) { stageInst = v.make(); stageId = v.id; } $('#env-stage-name').textContent = v.name; $('#env-stage-desc').textContent = v.desc; const names = engine.activeList().map(s => engine.def(s.id).name); $('#env-stage-sound').textContent = (names.length ? 'with ' + names.join(' + ') : 'choose a sound, or enter and pick one inside') + ' · movement ' + S.motion; $$('.env-tile').forEach(t => t.classList.toggle('active', t.dataset.id === v.id)); }
  function renderMosaic() {
    const host = $('#env-mosaic'); if (!host) return; host.innerHTML = '';
    FEATURED.forEach((id, i) => { const v = byId[id]; if (!v) return; const t = document.createElement('button'); t.className = 'env-tile' + (i < 2 ? ' big' : '') + (v.id === S.visual ? ' active' : ''); t.dataset.id = id; t.setAttribute('aria-label', `${v.name}: ${v.desc}`);
      t.innerHTML = `<canvas width="360" height="240" aria-hidden="true"></canvas><span class="env-tile-name">${v.name}</span>`; const c = $('canvas', t); previews.set(c, { inst: v.make(), visible: false }); io.observe(c);
      t.addEventListener('click', () => { setVisual(id); renderStage(); $('#env-stage').scrollIntoView({ behavior: 'smooth', block: 'center' }); }); t.addEventListener('dblclick', () => { setVisual(id); enterFocus(); }); host.appendChild(t); });
  }
  // One selection system: "Add Visual" opens the Visual Focus chooser (the page itself). Sound keeps playing.
  function openChooser() { app.showView('focus'); setTimeout(() => { const st = $('#env-stage'); st && st.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 250); }
  function openChooserOld() {
    const ch = $('#visual-chooser'); ch.hidden = false; ch.style.display = ''; document.body.style.overflow = 'hidden'; const host = $('#chooser-list'); host.innerHTML = '';
    ['ocean', 'rainwindow', 'nightsky', 'float', 'ripple', 'flow'].forEach(id => { const v = byId[id]; const b = document.createElement('button'); b.className = 'chooser-tile'; b.innerHTML = `<canvas width="300" height="200" aria-hidden="true"></canvas><span>${v.name}</span>`; const c = $('canvas', b); previews.set(c, { inst: v.make(), visible: true }); b.addEventListener('click', () => { closeChooser(); setVisual(id); enterViaTransition(id); }); host.appendChild(b); });
    $('.chooser-tile', host).focus();
  }
  function closeChooser() { const ch = $('#visual-chooser'); if (!ch) return; ch.hidden = true; document.body.style.overflow = ''; }
  { const cc = $('#chooser-close'); if (cc) cc.addEventListener('click', closeChooser); const vc = $('#visual-chooser'); if (vc) vc.addEventListener('keydown', e => { if (e.key === 'Escape') closeChooser(); }); }
  $('#env-enter').addEventListener('click', () => enterFocus());
  function renderLibrary() {
    renderMosaic(); renderStage();
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
  function setVisual(id) { if (!byId[id]) return; const MZ = window.softwaveMonetization; if (MZ && !MZ.canUse('visual:' + id)) { if (window.softwavePremium && !softwavePremium.gate('visual:' + id)) return; } S.visual = id; app.store.set('visual', id); $$('.vis-card').forEach(c => c.classList.toggle('active', c.dataset.id === id)); const cv = $('#current-visual-name'); if (cv) cv.textContent = byId[id].name; if (focus.inst && focus.visualId !== id) focus.load(id); renderStage(); }

  // ---------- pairings ----------
  const PAIRINGS = [
    { id: 'deepocean', name: 'Deep Ocean', visual: 'ocean', mix: [{ id: 'brown', volume: 0.5 }, { id: 'ocean', volume: 0.35 }], blurb: 'Brown noise · Ocean' },
    { id: 'rainwindowp', name: 'Rain Window', visual: 'rainwindow', mix: [{ id: 'pink', volume: 0.45 }, { id: 'rain', volume: 0.35 }], blurb: 'Pink noise · Rain Window' },
    { id: 'nightfloat', name: 'Night Float', visual: 'nightsky', mix: [{ id: 'brown', volume: 0.5 }, { id: 'night', volume: 0.2 }], blurb: 'Brown noise · Night Sky' },
    { id: 'softripple', name: 'Soft Ripple', visual: 'ripple', mix: [{ id: 'pink', volume: 0.5 }], blurb: 'Pink noise · Ripple' },
    { id: 'deepfocus', name: 'Deep Focus', visual: 'flow', mix: null, blurb: 'Your personal sound · Abstract Flow' },
    { id: 'fireside', name: 'Fireside', visual: 'fireplace', mix: [{ id: 'fire', volume: 0.55 }, { id: 'brown', volume: 0.25 }], blurb: 'Fireplace · low flames' },
  ];
  function renderPairings() {
    const host = $('#pairings'); host.innerHTML = '';
    PAIRINGS.forEach(p => {
      const v = byId[p.visual]; const el = document.createElement('div'); el.className = 'pair-card';
      el.innerHTML = `<canvas width="320" height="180" aria-hidden="true"></canvas><div class="pair-body"><div class="pair-name">${p.name}</div><div class="pair-rows"><div><span class="lbl">Visual</span>${v.name}</div><div><span class="lbl">Sound</span>${p.mix ? p.mix.map(m => engine.def(m.id).name).join(' + ') : 'Your personal sound (from Sound Discovery)'}</div></div><button class="btn btn-primary btn-sm">Try this</button></div>`;
      const c = $('canvas', el); previews.set(c, { inst: v.make(), visible: false }); io.observe(c);
      $('button', el).addEventListener('click', async () => { setVisual(p.visual); const mix = p.mix || (window.softwaveProfile && softwaveProfile.mix()) || [{ id: 'pink', volume: 0.45 }]; await app.loadPreset({ name: p.name, mix, master: 0.35 }); enterFocus(true); });
      host.appendChild(el);
    });
  }

  // ---------- favourites (sound + visual + movement + timer) ----------
  function renderFavs() {
    const host = $('#fav-list'); host.innerHTML = ''; const favs = app.store.get('combos', []); const sec = $('#fav-section'); if (sec) sec.hidden = !favs.length;
    favs.forEach((f, i) => {
      const el = document.createElement('div'); el.className = 'fav-card';
      const lines = f.mix.map(m => `${m.params ? 'Custom sound' : m.curve ? 'Painted sound' : engine.def(m.id).name} — ${Math.round(m.volume * 100)}%`); lines.push(`Visual — ${byId[f.visual] ? byId[f.visual].name : f.visual}`); lines.push(`Movement — ${f.motion[0].toUpperCase() + f.motion.slice(1)}`); if (f.timer) lines.push(`Timer — ${f.timer} minutes`);
      el.innerHTML = `<div class="fav-name">${f.name}</div><div class="fav-lines">${lines.map(l => `<div>${l}</div>`).join('')}</div><div class="btn-row"><button class="btn btn-primary btn-sm" data-start>Start</button><button class="btn btn-ghost btn-sm" data-del aria-label="Delete ${f.name}">Delete</button></div>`;
      $('[data-start]', el).addEventListener('click', async () => { S.motion = f.motion; app.store.set('motion', f.motion); syncSettings(); setVisual(f.visual); await app.loadPreset({ name: f.name, mix: f.mix, master: f.master }); engine.setTimer(f.timer || 0, true); enterFocus(); });
      $('[data-del]', el).addEventListener('click', () => { favs.splice(i, 1); app.store.set('combos', favs); renderFavs(); });
      host.appendChild(el);
    });
  }
  document.addEventListener('softwave:profile', () => { if (window.softwaveProfile) softwaveProfile.refresh(); });
  $('#fav-save').addEventListener('click', () => { if (window.softwaveMonetization) softwaveMonetization.track('environment_saved');
    let form = $('#fav-form'); if (form) { form.remove(); return; }
    form = document.createElement('form'); form.id = 'fav-form'; form.className = 'inline-form';
    form.innerHTML = `<label class="sr-only" for="fav-name">Name</label><input id="fav-name" class="select" maxlength="40" value="My Focus" style="min-width:200px"><button type="submit" class="btn btn-primary btn-sm">Save</button><button type="button" class="btn btn-ghost btn-sm" data-cancel>Cancel</button>`;
    $('#env-stage').after(form); const inp = $('#fav-name', form); inp.focus(); inp.select(); $('[data-cancel]', form).addEventListener('click', () => form.remove());
    form.addEventListener('submit', e => { e.preventDefault(); const favs = app.store.get('combos', []); const MZ = window.softwaveMonetization; if (MZ && !MZ.canCreateSavedItem(favs.length)) { if (window.softwavePremium) softwavePremium.saveLimit('environments'); return; } favs.push({ name: inp.value.trim() || 'My Focus', mix: engine.snapshot(), master: engine.masterVolume, visual: S.visual, motion: S.motion, timer: engine.timer.durationMin || 0 }); app.store.set('combos', favs); form.remove(); renderFavs(); app.toast('Saved on this device'); });
  });

  // ---------- settings UI ----------
  function syncSettings() {
    $$('[data-motion]').forEach(b => b.setAttribute('aria-checked', b.dataset.motion === S.motion));
    $$('#reduce-motion, #focus-reduce').forEach(c => c.checked = S.reduced);
    $$('#breath-text, #focus-breath-text').forEach(c => c.checked = S.breathText);
    $('#current-visual-name').textContent = byId[S.visual].name;
    const ml = $('#focus-motion-label'); if (ml) ml.textContent = 'Movement: ' + (S.paused ? 'Paused' : S.motion.charAt(0).toUpperCase() + S.motion.slice(1)) + (S.reduced ? ' · Reduced' : '');
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-motion]'); if (!b) return; S.motion = b.dataset.motion; app.store.set('motion', S.motion); syncSettings(); });
  document.addEventListener('change', e => {
    if (e.target.matches('#reduce-motion, #focus-reduce')) { S.reduced = e.target.checked; app.store.set('reduceMotion', S.reduced); syncSettings(); }
    if (e.target.matches('#breath-text, #focus-breath-text')) { S.breathText = e.target.checked; app.store.set('breathText', S.breathText); syncSettings(); }
  });

  // ---------- FOCUS MODE ----------
  const screen = $('#focus-screen'), canvas = $('#focus-canvas'), ctx = canvas.getContext('2d', { alpha: false });   // opaque: every visual paints its own background; far cheaper to composite
  const focus = { inst: null, visualId: null, last: 0, hideT: null, raf: null, pointer: { x: 0.5, y: 0.5, on: false, down: false }, taps: [], tapId: 0, wake: null,
    load(id) { this.visualId = id; this.inst = byId[id].make(); this.taps = []; $('#focus-visual-name').textContent = byId[id].name; $('#focus-breath-row').hidden = id !== 'breathing'; } };
  function resize() { const w = innerWidth, h = innerHeight; const SFg = window.SoftwaveField; const cap = SFg && SFg.LOW ? 1.2e6 : 2.4e6; let dpr = Math.min(devicePixelRatio || 1, SFg && SFg.LOW ? 1 : 1.5); if (w * h * dpr * dpr > cap) dpr = Math.min(dpr, Math.max(0.75, Math.sqrt(cap / (w * h)))); canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); focus.w = w; focus.h = h; }
  addEventListener('resize', () => { if (!screen.hidden) resize(); });
  function loop(now) {
    if (screen.hidden) return; focus.raf = requestAnimationFrame(loop);
    const dt = (now - focus.last) / 1000 || 0.016; focus.last = now;
    if (document.hidden) return;
    focus.taps = focus.taps.filter(t => (t.age += dt) < 10);
    const env = makeEnv(focus.pointer, focus.taps, dt);
    focus.inst.draw(ctx, focus.w, focus.h, env);
    if (P.dim > 0.005) { ctx.fillStyle = `rgba(2,4,12,${Math.min(0.85, P.dim)})`; ctx.fillRect(0, 0, focus.w, focus.h); }
    // drift the pointer effect off when idle
  }
  function showControls() { screen.classList.remove('idle'); clearTimeout(focus.hideT); focus.hideT = setTimeout(() => { if (!$('#focus-panel').classList.contains('open')) screen.classList.add('idle'); }, 7500); }
  let enteredVia = null;
  function enterViaTransition(id) { if (window.softwaveTransition && !$('#view-sounds').hidden) { enteredVia = id; window.softwaveTransition.to(id, () => enterFocus(false, true)); } else enterFocus(true); }
  async function enterFocus(transition, fromTransition) {
    if (!fromTransition) enteredVia = null;
    if (!screen.hidden) return;
    if (transition) { document.body.classList.add('entering'); await new Promise(r => setTimeout(r, 520)); document.body.classList.remove('entering'); }
    focus.load(S.visual); screen.hidden = false; document.body.style.overflow = 'hidden'; resize(); focus.last = performance.now(); loop(focus.last);
    if (window.softwaveBg) window.softwaveBg.running = false;
    updateFocusBar(); showControls(); syncSettings(); syncFocusPlayer(); const fp = $('#focus-play'); if (fp) fp.focus();
    try { if (navigator.wakeLock) focus.wake = await navigator.wakeLock.request('screen'); } catch (_) { }
    if (engine.activeList().length && !engine.isPlaying) engine.playAll();
  }
  // Cross-fade to another visual (journeys): fade to black, switch, fade back
  function crossfadeTo(id) {
    if (!byId[id] || screen.hidden) { setVisual(id); return; }
    let veil = $('#focus-veil'); if (!veil) { veil = document.createElement('div'); veil.id = 'focus-veil'; veil.className = 'focus-veil'; screen.appendChild(veil); }
    veil.classList.add('on'); setTimeout(() => { setVisual(id); setTimeout(() => veil.classList.remove('on'), 120); }, 1600);
  }
  function exitFocus() {
    if (screen.hidden) return;   // double-exit (Escape + button) must be a no-op
    if (engine.ctx) engine.resetMasterShape(); P.dim = 0; P.slow = 0; P.time = 0.5;
    if (enteredVia && window.softwaveTransition) { const id = enteredVia; enteredVia = null; window.softwaveTransition.back(id); }
    screen.hidden = true; document.body.style.overflow = ''; cancelAnimationFrame(focus.raf); closePanel();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
    if (focus.wake) { focus.wake.release().catch(() => { }); focus.wake = null; }
    if (window.softwaveBg) { window.softwaveBg.running = true; window.softwaveBg.loop(); }
  }
  const fx = $('#focus-exit'); if (fx) fx.addEventListener('click', exitFocus);
  // Two of the three stops leave for the Visual Focus landing page; sound-only stays put.
  const goLanding = () => { exitFocus(); setTimeout(() => { if (window.softwaveApp) app.showView('focus'); }, 60); };
  // Stop visual: the sound is untouched. If it is still playing, land the user on the
  // Sounds page at the live player, so what they are hearing is immediately visible;
  // with nothing playing, return to the Visual Focus landing page as before.
  $('#focus-stop-visual').addEventListener('click', () => {
    const soundOn = engine.activeList().length > 0 && engine.isPlaying;
    exitFocus();
    setTimeout(() => {
      if (!window.softwaveApp) return;
      if (soundOn) {
        app.showView('sounds');
        setTimeout(() => { const f = document.getElementById('field-wrap'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 300);
      } else app.showView('focus');
    }, 60);
  });
  $('#focus-stop-all').addEventListener('click', () => { (window.softwaveStopAll || engine.stopAll.bind(engine))(); goLanding(); });
  // player-style bar: keep name, playing state and volume readout in sync with the engine
  function syncFocusPlayer() {
    const t = $('#focus-now-title'), s = $('#focus-now-sub'); if (!t) return;
    const list = engine.activeList(), playing = engine.isPlaying;
    t.textContent = list.length ? list.map(x => x.name).join(' · ') : 'Nothing playing';
    s.textContent = list.length ? (playing ? 'Playing' : 'Paused') : 'Choose a sound to begin';
    const pb = $('#focus-play'); if (pb) pb.setAttribute('aria-pressed', playing);
    // with no sound there is nothing to "change" — the same control invites adding one
    const sb = document.querySelector('.focus-panes-row [data-open-pane="sound"]');
    if (sb) sb.textContent = list.length ? 'Change sound' : '＋ Add sound';
  }
  engine.on(type => {
    if (type === 'sounds' || type === 'state') syncFocusPlayer();
    if (type === 'master') { const v = Math.round(engine.masterVolume * 100); const sl = $('#focus-vol'), o = $('#focus-vol-out'); if (sl) sl.value = v; if (o) o.textContent = v + '%'; }
  });
  const fe = $('#focus-enter'); if (fe) fe.addEventListener('click', () => enterFocus());
  $('#focus-fullscreen').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else screen.requestFullscreen && screen.requestFullscreen().catch(() => { }); });
  $('#focus-pause-visual').addEventListener('click', e => { S.paused = !S.paused; e.currentTarget.setAttribute('aria-pressed', S.paused); e.currentTarget.textContent = S.paused ? 'Resume visual' : 'Pause visual'; syncSettings(); });
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
  engine.on(type => { if (!screen.hidden && ['sounds', 'state', 'tone', 'timer', 'master'].includes(type)) updateFocusBar(); if (type === 'sounds') renderStage(); });
  $('#focus-play').addEventListener('click', () => {
    // With nothing chosen, "play" silently did nothing (the toast renders under this screen).
    // Now it opens the sound picker — the action the tap actually means.
    if (!engine.activeList().length && !(engine.tone && engine.tone.playing)) { openPanel('sound'); app.toast('Pick a sound to play here.'); return; }
    app.togglePlay();
  });
  $('#focus-vol').addEventListener('input', e => { app.setMaster(+e.target.value / 100, true); const o = $('#focus-vol-out'); if (o) o.textContent = e.target.value + '%'; });
  // Stop sound: one tap, without leaving the visual — sounds, experiments, tone and timer.
  $('#focus-stop').addEventListener('click', () => {
    (window.softwaveStopAll || engine.stopAll.bind(engine))();
    const pane = $('.focus-pane[data-pane="sound"]'); if (pane && !pane.hidden) renderSoundPane();
    app.toast('Sound stopped. The visual keeps running.');
  });

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
    const foot = document.createElement('div'); foot.className = 'btn-row'; foot.innerHTML = '<button class="btn btn-ghost btn-sm" id="pane-stop">Stop all</button>'; host.appendChild(foot); $('#pane-stop', foot).addEventListener('click', () => { (window.softwaveStopAll || engine.stopAll.bind(engine))(); renderSoundPane(); });
  }
  function renderVisualPane() {
    const host = $('[data-pane="visual"] .pane-body'); host.innerHTML = '';
    CATS.forEach(cat => { const h = document.createElement('div'); h.className = 'row-title'; h.textContent = cat; host.appendChild(h); const g = document.createElement('div'); g.className = 'pane-visuals'; V.filter(v => v.cat === cat && !v.hidden).forEach(v => { const b = document.createElement('button'); b.className = 'pane-visual' + (v.id === S.visual ? ' on' : ''); b.setAttribute('aria-pressed', v.id === S.visual); b.textContent = v.name; b.addEventListener('click', () => { setVisual(v.id); renderVisualPane(); }); g.appendChild(b); }); host.appendChild(g); });
  }
  $$('#focus-panel [data-min]').forEach(b => b.addEventListener('click', () => { engine.setTimer(+b.dataset.min, true); updateFocusBar(); if (+b.dataset.min) app.toast(`Timer: ${b.dataset.min} minutes, with gentle fade`); }));

  // Frequency page hook: open the Sound Visualizer with the generator
  $('#freq-visualizer').addEventListener('click', async () => { if (!(engine.tone && engine.tone.playing)) $('#freq-play').click(); setVisual('frequency'); enterFocus(); });

  // expose for app
  window.softwaveFocus = { enterFocus, exitFocus, enterViaTransition, setVisual, crossfadeTo, openChooser, refreshFavs: renderFavs, visuals: V.filter(v => !v.hidden), allVisuals: V, setParam: (k, v) => { P[k] = v; }, getParam: () => P };

  // ---------- init ----------
  if (!byId[S.visual]) S.visual = 'ocean';   // a stored visual id that no longer exists must not break init
  renderLibrary(); renderPairings(); renderFavs(); syncSettings(); if (window.softwaveProfile) softwaveProfile.refresh();
  const qf = new URLSearchParams(location.search).get('focus'); if (qf && byId[qf]) { setVisual(qf); setTimeout(enterFocus, 50); }
})();
