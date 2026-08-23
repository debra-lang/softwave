/* Softwave Sound Field v3 — the approved visual language, generalised.
   One coherent system:
   - PERSONA: shared parameters per sound (depth, speed, scale, texture, density, flow, softness, energy, warmth, geometry).
   - Field: the large generative Sound Field. Base rings (the Softwave signature) + one personality layer chosen by geometry.
     Life: idle = quietly breathing, playing = awake, paused = settling. Morphs into an environment (Add Visual).
   - Preview: compact living preview of a sound's personality (library tiles).
   - ENVIRONMENTS: Ocean, Rain Window, Night Sky, Ripple, Float — full-screen, persona-adaptive, used by Visual Focus.
   Audio has priority: capped DPR, 30 fps on modest devices, modest point counts, no blur filters in the hot path. */
(function (global) {
  'use strict';
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const isDark = () => document.documentElement.dataset.theme === 'dark';
  const reduced = () => { try { return (localStorage.getItem('softwave:reduceMotion') === 'true') || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
  const LOW = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  // deterministic pseudo-random per index (stable layouts, no Math.random in the hot path)
  const hash = (i, k = 0) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };

  // ---------- PERSONA: how each sound shapes the field ----------
  // geo: rings | ribbons | particles | trails | streams | embers | points | motes
  // flow: radial | lateral | down | up | drift | horizontal
  const BASE = { depth: 0.6, speed: 0.8, scale: 0.6, texture: 0.4, density: 0.5, flow: 'radial', softness: 0.8, energy: 0.5, warmth: 0.3, rings: 8, amp: 0.09, harm: [3, 5, 2], wave: 1.3, squash: 1, rotate: 0, mist: 0 };
  const PERSONA = {
    white:     { geo: 'particles', depth: 0.45, speed: 1.1, scale: 0.3, texture: 0.9, density: 0.8, flow: 'drift', softness: 0.7, energy: 0.5, warmth: 0.1, rings: 11, amp: 0.04, harm: [6, 9, 4], wave: 2.4, tint: [150, 170, 200], light: [90, 110, 150], words: 'Fine • Airy • Even' },
    pink:      { geo: 'ribbons', depth: 0.55, speed: 0.9, scale: 0.55, texture: 0.5, density: 0.5, flow: 'lateral', softness: 0.85, energy: 0.5, warmth: 0.45, rings: 8, amp: 0.12, harm: [3, 5, 2], wave: 1.6, tint: [205, 160, 185], light: [150, 90, 130], words: 'Balanced • Soft • Smooth' },
    brown:     { geo: 'rings', depth: 0.95, speed: 0.55, scale: 1, texture: 0.2, density: 0.3, flow: 'radial', softness: 0.9, energy: 0.6, warmth: 0.85, rings: 7, amp: 0.15, harm: [2, 3, 1], wave: 1.0, tint: [200, 165, 125], light: [125, 90, 60], words: 'Deep • Warm • Steady' },
    static:    { geo: 'particles', depth: 0.4, speed: 0.8, scale: 0.28, texture: 1, density: 0.7, flow: 'drift', softness: 0.6, energy: 0.45, warmth: 0.2, rings: 10, amp: 0.035, harm: [5, 8, 3], wave: 2.2, tint: [160, 170, 185], light: [95, 105, 125], words: 'Soft • Textured • Even' },
    hiss:      { geo: 'particles', depth: 0.35, speed: 0.7, scale: 0.22, texture: 0.7, density: 0.5, flow: 'drift', softness: 0.95, energy: 0.35, warmth: 0.05, rings: 12, amp: 0.03, harm: [7, 10, 4], wave: 2.6, tint: [170, 190, 210], light: [100, 120, 145], words: 'Airy • High • Smooth' },
    rain:      { geo: 'trails', depth: 0.6, speed: 1.0, scale: 0.4, texture: 0.6, density: 0.6, flow: 'down', softness: 0.8, energy: 0.5, warmth: 0.2, rings: 9, amp: 0.045, harm: [5, 8, 3], wave: 2.0, tint: [140, 175, 195], light: [70, 110, 140], words: 'Soft • Vertical • Steady' },
    ocean:     { geo: 'rings', depth: 0.85, speed: 0.6, scale: 1, texture: 0.2, density: 0.3, flow: 'horizontal', softness: 0.9, energy: 0.55, warmth: 0.3, rings: 6, amp: 0.13, harm: [2, 4, 3], wave: 0.9, squash: 0.66, tint: [120, 180, 200], light: [60, 120, 150], words: 'Wide • Slow • Spacious' },
    stream:    { geo: 'streams', depth: 0.5, speed: 1.0, scale: 0.5, texture: 0.5, density: 0.6, flow: 'lateral', softness: 0.8, energy: 0.55, warmth: 0.25, rings: 8, amp: 0.08, harm: [4, 6, 3], wave: 1.8, tint: [130, 185, 190], light: [60, 120, 130], words: 'Fluid • Light • Moving' },
    waterfall: { geo: 'trails', depth: 0.7, speed: 1.2, scale: 0.6, texture: 0.8, density: 1, flow: 'down', softness: 0.7, energy: 0.7, warmth: 0.15, rings: 8, amp: 0.04, harm: [5, 7, 3], wave: 2.2, mist: 0.8, tint: [165, 190, 205], light: [85, 120, 145], words: 'Full • Downward • Textured' },
    forest:    { geo: 'motes', depth: 0.7, speed: 0.5, scale: 0.6, texture: 0.4, density: 0.25, flow: 'drift', softness: 0.9, energy: 0.35, warmth: 0.45, rings: 7, amp: 0.09, harm: [3, 2, 5], wave: 1.2, tint: [150, 185, 150], light: [70, 110, 80], words: 'Organic • Quiet • Spacious' },
    wind:      { geo: 'ribbons', depth: 0.6, speed: 0.8, scale: 0.85, texture: 0.3, density: 0.4, flow: 'lateral', softness: 0.95, energy: 0.45, warmth: 0.15, rings: 7, amp: 0.11, harm: [2, 3, 4], wave: 1.1, tint: [170, 185, 200], light: [95, 115, 140], words: 'Airy • Drifting • Open' },
    fan:       { geo: 'rings', depth: 0.5, speed: 0.9, scale: 0.5, texture: 0.3, density: 0.3, flow: 'radial', softness: 0.7, energy: 0.5, warmth: 0.2, rings: 9, amp: 0.035, harm: [6, 12, 4], wave: 2.0, rotate: 0.12, tint: [165, 175, 190], light: [95, 105, 125], words: 'Steady • Even • Familiar' },
    fire:      { geo: 'embers', depth: 0.8, speed: 0.6, scale: 0.7, texture: 0.5, density: 0.35, flow: 'up', softness: 0.85, energy: 0.6, warmth: 1, rings: 6, amp: 0.1, harm: [3, 2, 5], wave: 1.4, tint: [225, 165, 110], light: [150, 85, 45], words: 'Warm • Organic • Intimate' },
    night:     { geo: 'points', depth: 0.95, speed: 0.3, scale: 0.9, texture: 0.1, density: 0.12, flow: 'drift', softness: 1, energy: 0.25, warmth: 0.2, rings: 5, amp: 0.06, harm: [2, 3, 1], wave: 0.8, tint: [150, 165, 205], light: [80, 95, 140], words: 'Still • Deep • Quiet' },
    thunder:   { geo: 'rings', depth: 0.9, speed: 0.5, scale: 1, texture: 0.3, density: 0.3, flow: 'radial', softness: 0.8, energy: 0.6, warmth: 0.4, rings: 6, amp: 0.12, harm: [2, 3, 1], wave: 1.0, tint: [160, 150, 175], light: [95, 85, 115], words: 'Deep • Distant • Rolling' },
    city:      { geo: 'rings', depth: 0.7, speed: 0.7, scale: 0.8, texture: 0.4, density: 0.4, flow: 'radial', softness: 0.8, energy: 0.45, warmth: 0.5, rings: 8, amp: 0.07, harm: [3, 5, 2], wave: 1.4, tint: [185, 170, 160], light: [115, 100, 90], words: 'Low • Distant • Steady' },
    cabin:     { geo: 'rings', depth: 0.7, speed: 0.8, scale: 0.6, texture: 0.3, density: 0.3, flow: 'radial', softness: 0.8, energy: 0.5, warmth: 0.3, rings: 8, amp: 0.05, harm: [6, 12, 3], wave: 1.8, rotate: 0.06, tint: [170, 175, 185], light: [100, 105, 120], words: 'Low • Steady • Enclosed' },
    chimes:    { geo: 'points', depth: 0.6, speed: 0.5, scale: 0.7, texture: 0.2, density: 0.15, flow: 'drift', softness: 0.9, energy: 0.35, warmth: 0.7, rings: 6, amp: 0.08, harm: [3, 5, 2], wave: 1.3, tint: [225, 200, 150], light: [150, 120, 60], words: 'Light • Sparse • Gentle' },
    paint:     { geo: 'ribbons', depth: 0.6, speed: 0.8, scale: 0.6, texture: 0.5, density: 0.5, flow: 'lateral', softness: 0.8, energy: 0.5, warmth: 0.4, rings: 8, amp: 0.1, harm: [3, 5, 2], wave: 1.5, tint: [190, 165, 200], light: [130, 95, 150], words: 'Shaped • Personal • Yours' },
  };
  for (const k in PERSONA) PERSONA[k] = Object.assign({}, BASE, PERSONA[k]);
  const NUM = ['depth', 'speed', 'scale', 'texture', 'density', 'softness', 'energy', 'warmth', 'rings', 'amp', 'wave', 'squash', 'rotate', 'mist'];
  // custom sounds (My Sound / Discovery): derive a persona from the sculpt parameters
  function personaFor(id, sp) {
    if (PERSONA[id]) return PERSONA[id];
    const p = sp || { colour: 0.4, warm: 0, moving: 0, rich: 0, width: 0.35, soft: 0, deep: 0, smooth: 0, mod: 0 };
    const c = clamp(p.colour, 0, 1); const a = c < 0.5 ? PERSONA.brown : PERSONA.pink, b = c < 0.5 ? PERSONA.pink : PERSONA.white, t = c < 0.5 ? c * 2 : (c - 0.5) * 2;
    const out = Object.assign({}, a);
    for (const k of NUM) out[k] = lerp(a[k], b[k], t);
    out.harm = a.harm.map((v, i) => lerp(v, b.harm[i], t)); out.tint = mix3(a.tint, b.tint, t); out.light = mix3(a.light, b.light, t);
    out.geo = p.moving > 0.3 ? 'ribbons' : c > 0.66 ? 'particles' : c > 0.33 ? 'ribbons' : 'rings';
    out.warmth = clamp(out.warmth - p.warm * 0.4, 0, 1); out.speed *= 1 + p.moving * 0.5; out.amp *= 1 + p.mod * 0.4; out.texture = clamp(out.texture + p.rich * 0.3, 0, 1);
    out.words = (c < 0.33 ? 'Deep' : c < 0.66 ? 'Balanced' : 'Bright') + (p.warm < -0.25 ? ' • Warm' : p.warm > 0.25 ? ' • Airy' : ' • Soft') + (p.moving > 0.3 ? ' • Moving' : ' • Steady');
    return out;
  }
  const DESC = {}; for (const k in PERSONA) DESC[k] = PERSONA[k].words;

  // blend a list of active sounds (weighted by volume) into one persona; the loudest decides the geometry
  function blend(list) {
    if (!list || !list.length) return Object.assign({}, PERSONA.brown);
    const ps = list.map(s => ({ p: personaFor(s.id, s.params), w: Math.max(0.05, s.volume || 0.5) })); const W = ps.reduce((a, x) => a + x.w, 0);
    const top = ps.slice().sort((a, b) => b.w - a.w)[0].p; const out = Object.assign({}, top);
    for (const k of NUM) out[k] = ps.reduce((a, x) => a + x.p[k] * x.w, 0) / W;
    out.harm = [0, 1, 2].map(i => ps.reduce((a, x) => a + x.p.harm[i] * x.w, 0) / W); out.tint = [0, 1, 2].map(i => ps.reduce((a, x) => a + x.p.tint[i] * x.w, 0) / W); out.light = [0, 1, 2].map(i => ps.reduce((a, x) => a + x.p.light[i] * x.w, 0) / W);
    return out;
  }

  // ---------- shared clock (field and focus stay in phase across the hand-off) ----------
  const clock = { t: 0, last: 0, frame: -1 };
  function tick(now, rate) { if (clock.frame === now) return 0.016; clock.frame = now; const dt = clock.last ? Math.min(0.05, (now - clock.last) / 1000) : 0.016; clock.last = now; clock.t += dt * rate; return dt; }

  // =====================================================================
  // PERSONALITY LAYERS (drawn inside the field disc, radius R, centre cx,cy)
  // st: { t, life, alive, level, low, dark, tint, P, reduce }
  // =====================================================================
  const LAYERS = {
    particles(ctx, cx, cy, R, st, m) {
      const P = st.P, n = Math.round((LOW ? 40 : 70) + P.density * (LOW ? 60 : 110)); const sz = 0.6 + P.scale * 2.2; const sp = 0.05 * P.speed * st.life;
      for (let i = 0; i < n; i++) { const a = hash(i) * TAU, r0 = Math.sqrt(hash(i, 1)); const z = 0.3 + hash(i, 2) * 0.7;
        const ang = a + st.t * sp * (0.5 + z) * (hash(i, 3) - 0.5) * 2, rr = r0 + Math.sin(st.t * 0.2 * P.speed + i) * 0.02 * st.life;
        const x = cx + Math.cos(ang) * rr * R * 0.96, y = cy + Math.sin(ang) * rr * R * 0.96; const al = (0.15 + z * 0.5) * (0.5 + st.life * 0.5) * (1 - rr * 0.35) * m;
        ctx.fillStyle = rgba(st.tint, al * (st.dark ? 0.8 : 0.6)); ctx.beginPath(); ctx.arc(x, y, sz * z * (1 + st.level * 0.3), 0, TAU); ctx.fill(); }
    },
    motes(ctx, cx, cy, R, st, m) {
      const P = st.P, n = Math.round(18 + P.density * 40);
      for (let i = 0; i < n; i++) { const z = 0.3 + hash(i, 2) * 0.7; const x0 = (hash(i) - 0.5) * 2, y0 = (hash(i, 1) - 0.5) * 2; const x = x0 + Math.sin(st.t * 0.12 * P.speed + i) * 0.08 * st.life, y = y0 - ((st.t * 0.012 * P.speed * z * st.life + hash(i, 4)) % 1.0) * 0.5 + 0.25; const d = Math.hypot(x, y); if (d > 0.98) continue;
        const al = (0.12 + z * 0.4) * (1 - d * 0.5) * (0.6 + 0.4 * Math.sin(st.t * 0.6 + i)) * m; ctx.fillStyle = rgba(st.tint, al * (st.dark ? 0.9 : 0.7)); ctx.beginPath(); ctx.arc(cx + x * R, cy + y * R, (0.8 + z * 2.2) * P.scale * 1.6, 0, TAU); ctx.fill(); }
      for (let k = 0; k < 2; k++) { const x = cx + Math.sin(st.t * 0.07 + k * 2) * R * 0.35, y = cy + Math.cos(st.t * 0.05 + k * 1.3) * R * 0.3; const g = ctx.createRadialGradient(x, y, 0, x, y, R * 0.5); g.addColorStop(0, rgba(st.tint, 0.07 * m)); g.addColorStop(1, rgba(st.tint, 0)); ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2); }
    },
    points(ctx, cx, cy, R, st, m) {
      const P = st.P, n = Math.round(8 + P.density * 50);
      for (let i = 0; i < n; i++) { const a = hash(i) * TAU, r0 = 0.15 + Math.sqrt(hash(i, 1)) * 0.8; const z = 0.3 + hash(i, 2) * 0.7; const ang = a + st.t * 0.01 * P.speed * st.life * (z - 0.5); const x = cx + Math.cos(ang) * r0 * R, y = cy + Math.sin(ang) * r0 * R;
        const tw = 0.55 + 0.45 * Math.sin(st.t * (0.3 + hash(i, 3) * 0.4) + i * 2); const al = (0.2 + z * 0.6) * tw * m; const r = (0.6 + z * 1.6) * (0.7 + P.scale * 0.6);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, rgba(st.tint, al * 0.5)); g.addColorStop(1, rgba(st.tint, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, TAU); ctx.fill();
        ctx.fillStyle = rgba(mix3(st.tint, [255, 255, 255], st.dark ? 0.5 : 0), al); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    },
    trails(ctx, cx, cy, R, st, m) {
      const P = st.P, n = Math.round((LOW ? 22 : 34) + P.density * (LOW ? 30 : 50)); const fall = 0.18 * P.speed * (0.35 + st.life * 0.65);
      ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) { const z = 0.3 + hash(i, 2) * 0.7; const x = (hash(i) - 0.5) * 1.9; const len = (0.08 + hash(i, 1) * 0.16) * (0.6 + P.scale) * z; const y = ((st.t * fall * z + hash(i, 3)) % 1.2) * 2 - 1.1; const span = Math.sqrt(Math.max(0, 1 - x * x)); if (y - len < -span || y > span) continue;
        ctx.strokeStyle = rgba(mix3(st.tint, [255, 255, 255], st.dark ? 0.3 : 0), (0.18 + z * 0.45) * m * (st.dark ? 1 : 0.8)); ctx.lineWidth = 0.7 + z * 1.5 * (0.6 + P.texture * 0.6); ctx.beginPath(); ctx.moveTo(cx + x * R, cy + (y - len) * R); ctx.lineTo(cx + x * R, cy + y * R); ctx.stroke(); }
      if (P.mist > 0.05) { const g = ctx.createLinearGradient(0, cy + R * 0.2, 0, cy + R); g.addColorStop(0, rgba(st.tint, 0)); g.addColorStop(1, rgba(st.tint, 0.16 * P.mist * m)); ctx.fillStyle = g; ctx.fillRect(cx - R, cy + R * 0.2, R * 2, R * 0.8); }
      else { for (let k = 0; k < 2; k++) { const seed = Math.floor(st.t * 0.25 + k * 0.5); const ph = (st.t * 0.25 + k * 0.5) % 1; const x = cx + (hash(seed + 20) - 0.5) * R * 1.2, y = cy + (hash(seed + 30) - 0.5) * R * 1.2; ctx.strokeStyle = rgba(st.tint, 0.25 * (1 - ph) * m); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, ph * R * 0.22, ph * R * 0.09, 0, 0, TAU); ctx.stroke(); } }
    },
    ribbons(ctx, cx, cy, R, st, m) {
      const P = st.P, n = 4 + Math.round(P.density * 4); ctx.lineCap = 'round';
      for (let k = 0; k < n; k++) { const yb = (k / (n - 1) - 0.5) * 1.3; const ph = k * 1.7; ctx.beginPath();
        for (let s = 0; s <= 40; s++) { const u = s / 40; const x = (u - 0.5) * 2; let y = yb * 0.8 + Math.sin(u * TAU * (0.6 + P.wave * 0.4) + st.t * 0.5 * P.speed * st.life + ph) * 0.12 * (0.6 + st.life * 0.6) * P.scale + Math.sin(u * TAU * 1.7 - st.t * 0.3 + ph) * 0.05;
          s ? ctx.lineTo(cx + x * R * 1.1, cy + y * R) : ctx.moveTo(cx + x * R * 1.1, cy + y * R); }
        ctx.strokeStyle = rgba(st.tint, (0.08 + 0.05 * (k % 2)) * m); ctx.lineWidth = (10 + P.scale * 22) * (st.dark ? 1 : 0.9); ctx.stroke(); ctx.strokeStyle = rgba(mix3(st.tint, [255, 255, 255], st.dark ? 0.4 : -0.2), 0.22 * m); ctx.lineWidth = 1; ctx.stroke(); }
    },
    streams(ctx, cx, cy, R, st, m) {
      const P = st.P, n = 5; ctx.lineCap = 'round';
      for (let k = 0; k < n; k++) { const yb = (k / (n - 1) - 0.5) * 1.2; ctx.beginPath(); const pts = [];
        for (let s = 0; s <= 40; s++) { const u = s / 40; const x = (u - 0.5) * 2; let y = yb * 0.8 + Math.sin(u * TAU * 0.8 + k * 1.3) * 0.1 + Math.sin(u * TAU * 2.1 + st.t * 0.6 * P.speed * st.life + k) * 0.035; pts.push([cx + x * R * 1.1, cy + y * R]); s ? ctx.lineTo(pts[s][0], pts[s][1]) : ctx.moveTo(pts[s][0], pts[s][1]); }
        ctx.strokeStyle = rgba(st.tint, 0.09 * m); ctx.lineWidth = 8 + P.scale * 14; ctx.stroke();
        for (let h = 0; h < 3; h++) { const u = ((st.t * 0.09 * P.speed * (0.5 + st.life * 0.7) + h / 3 + k * 0.13) % 1); const i = Math.min(39, Math.floor(u * 40)); const [x, y] = pts[i]; const g = ctx.createRadialGradient(x, y, 0, x, y, 10 + P.scale * 10); g.addColorStop(0, rgba(mix3(st.tint, [255, 255, 255], st.dark ? 0.5 : 0), 0.35 * m)); g.addColorStop(1, rgba(st.tint, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 10 + P.scale * 10, 0, TAU); ctx.fill(); } }
    },
    embers(ctx, cx, cy, R, st, m) {
      const P = st.P, n = Math.round(16 + P.density * 40); const rise = 0.06 * P.speed * (0.35 + st.life * 0.65);
      for (let k = 0; k < 3; k++) { const ph = (st.t * 0.05 * (0.35 + st.life * 0.65) + k / 3) % 1; const x = cx + Math.sin(st.t * 0.2 + k * 2.1) * R * 0.25, y = cy + (0.6 - ph * 1.3) * R; const r = R * (0.25 + 0.2 * (1 - ph)); const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(st.tint, 0.16 * (1 - ph) * m)); g.addColorStop(1, rgba(st.tint, 0)); ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2); }
      for (let i = 0; i < n; i++) { const z = 0.3 + hash(i, 2) * 0.7; const ph = (st.t * rise * z + hash(i, 3)) % 1; const x = (hash(i) - 0.5) * 1.2 + Math.sin(st.t * 0.8 + i) * 0.06 * ph; const y = 0.85 - ph * 1.7; if (Math.hypot(x, y) > 0.97) continue;
        const al = (0.3 + z * 0.6) * Math.sin(ph * Math.PI) * m; ctx.fillStyle = rgba(mix3(st.tint, [255, 230, 200], 0.3), al); ctx.beginPath(); ctx.arc(cx + x * R, cy + y * R, (0.9 + z * 1.9) * (0.7 + P.scale * 0.5), 0, TAU); ctx.fill(); }
    },
    rings() { },
  };

  // =====================================================================
  // RINGS ⇄ OCEAN BANDS (signature geometry shared by the field and the Ocean environment)
  // =====================================================================
  const PTS = LOW ? 110 : 160, MAX_RINGS = 12;
  function drawRings(ctx, o) {
    const { cx, cy, R, W, H, P, tint, dark } = o; const e = o.e;
    const breathe = 1 + (0.03 * Math.sin(o.t * 0.5) * o.life + o.low * 0.07) * (o.reduce ? 0.3 : 1);
    const ampK = (0.6 + 0.55 * o.alive) * (0.8 + o.vol * 0.4) * (1 + o.level * 0.6) * (o.reduce ? 0.5 : 1);
    const nR = Math.round(P.rings); const NP = o.pts || PTS;
    const far = dark ? [16, 32, 52] : [186, 208, 222], near = dark ? [5, 11, 20] : [104, 146, 176];
    const hz = H * 0.42; const sq = lerp(P.squash || 1, 1, e);
    const rot = (P.rotate || 0) * o.t * o.life;
    const H0 = Math.round(P.harm[0]), H1 = Math.round(P.harm[1]), H2 = Math.round(P.harm[2]);   // integer harmonics keep every ring a closed, seamless loop
    for (let i = 0; i < MAX_RINGS; i++) {
      const ringA = clamp(nR - i, 0, 1); if (ringA <= 0 && e < 0.01) continue;
      const rr = R * (0.16 + 0.84 * Math.pow(1 - i / Math.max(1, nR - 1), 0.85)) * breathe * o.grow * (1 + 0.035 * Math.sin(o.t * 0.33 + i * 1.9) * o.life);
      const dx = R * 0.045 * Math.sin(o.t * 0.3 + i * 1.7) * o.life, dy = R * 0.04 * Math.cos(o.t * 0.26 + i * 2.3) * o.life;
      const bi = i / Math.max(1, nR - 1); const yb = hz + (H - hz) * Math.pow(bi, 1.35) * 1.02 + 4;
      const bandAmp = H * (0.010 + 0.04 * bi) * (0.7 + o.alive * 0.5 + o.low * 0.6) * (0.6 + P.scale * 0.5) * (o.reduce ? 0.35 : 1);
      ctx.beginPath();
      for (let p = 0; p <= NP; p++) {
        const th = Math.PI + (p / NP) * TAU + rot;
        const d = 1 + P.amp * ampK * (0.5 * Math.sin(H0 * th + o.t * 0.5 + i * 1.3) + 0.32 * Math.sin(H1 * th - o.t * 0.37 + i * 2.1) + 0.25 * Math.sin(H2 * th + o.t * 0.23 - i * 0.7) + 0.22 * Math.sin(th + o.t * 0.15 + i * 2.9));
        const fx = cx + dx + Math.cos(th) * rr * d, fy = cy + dy + Math.sin(th) * rr * d * sq;
        let x = fx, y = fy;
        if (e > 0.001) {
          const top = p <= NP / 2; const u = top ? p / (NP / 2) : 1 - (p - NP / 2) / (NP / 2);
          const ox = top ? (-0.15 + 1.3 * u) * W : (-0.22 + 1.44 * u) * W; const ph = u * TAU * (0.9 + P.wave * 0.2);
          const wv = bandAmp * (Math.sin(ph * 1.2 + o.t * 0.35 * (1 + bi * 0.4) + i) + 0.5 * Math.sin(ph * 2.7 - o.t * 0.22 + i * 1.7) + 0.3 * Math.sin(ph * 0.6 + o.t * 0.12));
          const oy = top ? yb + wv : Math.min(H + 80, yb + (H - yb) * 0.55 + 90) + wv * 0.6;
          const ex = ease(clamp(o.rawMorph * 1.2, 0, 1)); x = lerp(fx, ox, ex); y = lerp(fy, oy, e);
        }
        p ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      const depth = 0.55 + 0.45 * bi;
      const geoK = P.geo === 'rings' ? 1 : 0.7;
      if (e < 0.999) { ctx.globalAlpha = 1 - e; ctx.fillStyle = rgba(tint, (dark ? 0.045 : 0.04) * ringA * depth * geoK); ctx.fill(); ctx.strokeStyle = rgba(dark ? mix3(tint, [255, 255, 255], 0.35) : tint, (dark ? 0.28 : 0.34) * (0.45 + 0.55 * depth) * ringA * geoK); ctx.lineWidth = 1.5 - i / MAX_RINGS; ctx.stroke(); }
      if (e > 0.001) { const wc = mix3(far, near, bi); ctx.globalAlpha = e * (0.82 + 0.18 * bi); ctx.fillStyle = rgba(wc, 1); ctx.fill(); ctx.globalAlpha = e; ctx.strokeStyle = dark ? `rgba(170,210,235,${0.10 + 0.1 * (1 - bi)})` : 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
  }
  function drawOceanAtmosphere(ctx, W, H, o, e) {
    const dark = o.dark; ctx.globalAlpha = e; const hz = H * 0.42;
    let g = ctx.createLinearGradient(0, 0, 0, hz * 1.1); if (dark) { g.addColorStop(0, '#070a13'); g.addColorStop(0.7, '#101a2e'); g.addColorStop(1, '#1a2a44'); } else { g.addColorStop(0, '#eef2f5'); g.addColorStop(0.7, '#dbe5ec'); g.addColorStop(1, '#c9d9e3'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz * 1.1);
    const lx = W * 0.66, ly = hz * 0.86; g = ctx.createRadialGradient(lx, ly, 0, lx, ly, W * 0.36); g.addColorStop(0, dark ? 'rgba(210,200,180,0.22)' : 'rgba(255,250,235,0.75)'); g.addColorStop(1, 'rgba(210,200,180,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz * 1.1);
    ctx.globalAlpha = 1;
  }
  function drawOceanLight(ctx, W, H, o, e) {
    const dark = o.dark; ctx.globalAlpha = e; const hz = H * 0.42, lx = W * 0.66; const sw = W * (0.16 + 0.06 * o.low);
    ctx.save(); ctx.translate(lx, hz); ctx.scale(1, 2.2 + o.low); let g = ctx.createRadialGradient(0, 0, 0, 0, 0, sw); g.addColorStop(0, dark ? 'rgba(225,210,185,0.20)' : 'rgba(255,250,235,0.55)'); g.addColorStop(0.55, dark ? 'rgba(225,210,185,0.06)' : 'rgba(255,250,235,0.2)'); g.addColorStop(1, 'rgba(225,210,185,0)'); ctx.fillStyle = g; ctx.fillRect(-sw, 0, sw * 2, sw); ctx.restore();
    g = ctx.createLinearGradient(0, hz - 40, 0, hz + 80); g.addColorStop(0, dark ? 'rgba(16,26,46,0)' : 'rgba(220,232,240,0)'); g.addColorStop(0.5, dark ? 'rgba(16,26,46,0.55)' : 'rgba(220,232,240,0.6)'); g.addColorStop(1, 'rgba(16,26,46,0)'); ctx.fillStyle = g; ctx.fillRect(0, hz - 40, W, 120);
    ctx.globalAlpha = 1;
  }

  // =====================================================================
  // THE FIELD
  // =====================================================================
  class Field {
    constructor(canvas) {
      this.c = canvas; this.ctx = canvas.getContext('2d'); this.ids = []; this.P = Object.assign({}, PERSONA.brown); this.target = this.P; this.level = 0; this.low = 0; this.bal = 0; this.alive = 0; this.playing = false;
      this.morph = 0; this.morphTarget = 0; this.envId = 'ocean'; this.envInst = null; this.dpr = 1; this.w = 0; this.h = 0; this.lastFrame = 0; this.fullscreen = false; this.spot = null; this.rect = { left: 0, top: 0 };
    }
    set(ids) { this.ids = ids || []; this.target = blend(this.ids); }
    setLevel(lv, bal) { this.level += (clamp(lv, 0, 1) - this.level) * 0.06; this.bal = bal || 0; }
    setLow(lo) { this.low += (clamp(lo, 0, 1) - this.low) * 0.04; }
    setPlaying(on) { this.playing = !!on; }
    snap() { this.alive = 1; this.morph = this.morphTarget; for (const k in this.target) this.P[k] = this.target[k]; }
    setEnvironment(id) { if (this.envId !== id) { this.envId = id; this.envInst = null; } }
    resize() {
      const r = this.c.getBoundingClientRect(); if (!r.width) return false;
      const w = Math.round(r.width), h = Math.round(r.height); let dpr = Math.min(LOW ? 1 : 1.5, devicePixelRatio || 1); if (w * h * dpr * dpr > 2.4e6) dpr = Math.min(dpr, Math.max(1, Math.sqrt(2.4e6 / (w * h))));   // big canvases render at a lower density — audio first
      if (this.w !== w || this.h !== h || this.dpr !== dpr) { this.w = w; this.h = h; this.dpr = dpr; this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr); }
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.rect = r; return true;
    }
    geometry() {
      if (this.spot) { const s = this.spot.getBoundingClientRect(); if (s.width) return { cx: s.left + s.width / 2 - this.rect.left, cy: s.top + s.height / 2 - this.rect.top, R: s.width / 2 }; }
      return { cx: this.w / 2, cy: this.h / 2, R: Math.min(this.w, this.h) * 0.42 };
    }
    draw(now, opts = {}) {
      if (LOW && now - this.lastFrame < 30) return; this.lastFrame = now;
      if (!this.resize()) return;
      const dark = isDark(), red = reduced();
      this.alive += ((this.playing ? 1 : 0) - this.alive) * (this.playing ? 0.02 : 0.008);
      const life = 0.38 + 0.62 * this.alive;
      const T = this.target; for (const k in T) { if (Array.isArray(T[k])) this.P[k] = (this.P[k] || T[k]).map((v, i) => lerp(v, T[k][i], 0.03)); else if (typeof T[k] === 'number') this.P[k] = lerp(this.P[k] == null ? T[k] : this.P[k], T[k], 0.03); else this.P[k] = T[k]; }
      const P = this.P; const tint = dark ? P.tint : P.light;
      this.morph += (this.morphTarget - this.morph) * (red ? 0.08 : 0.028); if (Math.abs(this.morphTarget - this.morph) < 0.002) this.morph = this.morphTarget;
      const motion = red ? 0.06 : (0.3 + 0.7 * this.alive);
      const dt = tick(now, motion * P.speed * (1 - this.low * 0.25));
      const t = clock.t, e = ease(this.morph), W = this.w, H = this.h, ctx = this.ctx;
      const { cx, cy, R } = this.geometry();
      const vol = (global.softwave && global.softwave.masterVolume) || 0.4;
      const o = { cx, cy, R, W, H, t, life, alive: this.alive, level: this.level, low: this.low, vol, P, tint, dark, e, rawMorph: this.morph, grow: 1 + 0.38 * ease(clamp(this.morph * 2.2, 0, 1)), reduce: red };
      ctx.clearRect(0, 0, W, H);
      if (this.fullscreen || opts.atmosphere) { const bgA = dark ? ['#12141c', '#0a0c12'] : ['#f6f3ec', '#ebe6dc']; const g0 = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, Math.max(W, H) * 0.9); g0.addColorStop(0, bgA[0]); g0.addColorStop(1, bgA[1]); ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H); }
      let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.0); g.addColorStop(0, rgba(tint, (dark ? 0.10 : 0.12) * (0.7 + 0.3 * this.alive))); g.addColorStop(1, rgba(tint, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const envIsOcean = this.envId === 'ocean';
      if (e > 0.001 && envIsOcean) drawOceanAtmosphere(ctx, W, H, o, e);
      const st = { t, life, alive: this.alive, level: this.level, low: this.low, dark, tint, P, reduce: red };
      const layer = LAYERS[P.geo] || LAYERS.rings; const layerAlpha = (1 - e) * (red ? 0.6 : 1);
      drawRings(ctx, o);
      if (P.geo !== 'rings' && layerAlpha > 0.01) { ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R * o.grow * 1.02, 0, TAU); ctx.clip(); layer(ctx, cx, cy, R * o.grow, st, layerAlpha); ctx.restore(); }
      if (e > 0.001 && envIsOcean) drawOceanLight(ctx, W, H, o, e);
      if (e > 0.001 && !envIsOcean) { if (!this.envInst) this.envInst = sharedEnvironment(this.envId); ctx.globalAlpha = e; this.envInst.draw(ctx, W, H, envState(this, dt, opts.env)); ctx.globalAlpha = 1; }
      if (e < 0.999) { ctx.globalAlpha = 1 - e; g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.5); g.addColorStop(0, rgba(tint, (dark ? 0.18 : 0.2) * (0.55 + this.alive * 0.45))); g.addColorStop(1, rgba(tint, 0)); ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2); ctx.globalAlpha = 1; }
    }
  }

  // ---------- compact living previews for the sound library ----------
  class Preview {
    constructor(canvas, id) { this.c = canvas; this.id = id; this.level = 0.15; this.t = hash(id.length) * 10; this.last = 0; }
    setLevel(lv) { this.level += (lv - this.level) * 0.1; }
    draw(now) {
      const c = this.c, r = c.getBoundingClientRect(); if (!r.width) return; const dpr = Math.min(devicePixelRatio || 1, 1.5); if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
      const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); const w = r.width, h = r.height; const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016; this.last = now; const mo = reduced() ? 0.1 : 1; this.t += dt * (0.5 + this.level) * mo;
      const P = personaFor(this.id, this.params), dark = isDark(), tint = dark ? P.tint : P.light, t = this.t;
      x.clearRect(0, 0, w, h); x.fillStyle = dark ? 'rgba(18,21,29,0.92)' : 'rgba(234,229,219,0.92)'; x.fillRect(0, 0, w, h);
      x.strokeStyle = rgba(tint, dark ? 0.6 : 0.7); x.fillStyle = rgba(tint, dark ? 0.6 : 0.7); x.lineWidth = 1.2;
      const geo = P.geo;
      if (geo === 'particles' || geo === 'motes' || geo === 'points') { const n = geo === 'points' ? 14 : geo === 'motes' ? 24 : 60; for (let i = 0; i < n; i++) { const px = ((hash(i) * w + t * 6 * (0.5 + hash(i, 2)) * (geo === 'points' ? 0.15 : 1)) % w), py = ((hash(i, 1) * h + Math.sin(t * 0.7 + i) * 5) % h + h) % h; x.globalAlpha = 0.3 + 0.5 * hash(i, 3); x.beginPath(); x.arc(px, py, geo === 'points' ? 0.9 + hash(i, 4) * 1.4 : geo === 'motes' ? 1.4 : 1.1, 0, TAU); x.fill(); } x.globalAlpha = 1; }
      else if (geo === 'ribbons' || geo === 'streams') { for (let r2 = 0; r2 < 4; r2++) { x.beginPath(); for (let px = 0; px <= w; px += 5) { const py = h / 2 + Math.sin(px / w * (geo === 'streams' ? 5 : 6) + t * 0.8 + r2) * h * 0.2 + (r2 - 1.5) * h * 0.16; px ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); } }
      else if (geo === 'trails') { for (let i = 0; i < 20; i++) { const px = (i * 29 + hash(i) * 10) % w, py = ((i * 41 + t * 50) % (h + 20)) - 10; x.globalAlpha = 0.35 + (i % 3) * 0.2; x.beginPath(); x.moveTo(px, py); x.lineTo(px, py + 8 + P.density * 6); x.stroke(); } x.globalAlpha = 1; }
      else if (geo === 'embers') { for (let i = 0; i < 16; i++) { const ph = (t * 0.15 + hash(i)) % 1; const px = w / 2 + (hash(i, 1) - 0.5) * w * 0.7 + Math.sin(t + i) * 3, py = h - ph * (h + 6); x.globalAlpha = Math.sin(ph * Math.PI) * 0.8; x.beginPath(); x.arc(px, py, 1 + hash(i, 2) * 1.5, 0, TAU); x.fill(); } x.globalAlpha = 1; }
      else if (P.flow === 'horizontal') { for (let r2 = 0; r2 < 4; r2++) { x.beginPath(); for (let px = 0; px <= w; px += 5) { const py = h * 0.3 + r2 * h * 0.17 + Math.sin(px / w * 3 + t * 0.35 + r2 * 1.3) * 4; px ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); } }
      else { for (let r2 = 0; r2 < 3; r2++) { x.beginPath(); const rr = h * 0.17 + r2 * h * 0.14 + Math.sin(t * 0.5 + r2) * 2; for (let p = 0; p <= 48; p++) { const th = p / 48 * TAU; const dd = 1 + P.amp * 0.6 * Math.sin(P.harm[0] * th + t * 0.4 + r2); const px = w / 2 + Math.cos(th) * rr * dd, py = h / 2 + Math.sin(th) * rr * dd * 0.78; p ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.stroke(); } }
    }
  }

  // =====================================================================
  // ENVIRONMENTS (Visual Focus) — persona-adaptive, full-screen
  // =====================================================================
  function envState(field, dt, extra) {
    const dark = isDark(); return Object.assign({ t: clock.t, dt, dark, P: field.P, tint: dark ? field.P.tint : field.P.light, level: field.level, low: field.low, alive: field.alive, reduce: reduced(), speed: 1, pointer: { x: 0.5, y: 0.5, on: false }, taps: [], breathText: true }, extra || {});
  }
  const ENV = {};
  ENV.ocean = () => ({ draw(ctx, w, h, st) {
    const P = st.P; const o = { cx: w / 2, cy: h / 2, R: Math.min(w, h) * 0.4, W: w, H: h, t: st.t, life: 1, alive: Math.max(0.6, st.alive), level: st.level, low: st.low, vol: 0.4, P, tint: st.tint, dark: st.dark, e: 1, rawMorph: 1, grow: 1, reduce: st.reduce };
    ctx.fillStyle = st.dark ? '#070a13' : '#eef2f5'; ctx.fillRect(0, 0, w, h); drawOceanAtmosphere(ctx, w, h, o, 1); drawRings(ctx, o); drawOceanLight(ctx, w, h, o, 1);
  } });
  ENV.rainwindow = () => {
    const drops = Array.from({ length: LOW ? 90 : 150 }, (_, i) => ({ x: hash(i), y: hash(i, 1), z: 0.25 + hash(i, 2) * 0.75, len: 0.03 + hash(i, 3) * 0.08, spd: 0.6 + hash(i, 4) * 0.8 }));
    const beads = Array.from({ length: 26 }, (_, i) => ({ x: hash(i + 300), y: hash(i + 301), r: 1.5 + hash(i + 302) * 3.5, ph: hash(i + 303) * TAU }));
    let ripples = [], lastTick = -1;
    return { draw(ctx, w, h, st) {
      const P = st.P, dark = st.dark, tint = st.tint; const sp = st.reduce ? 0.15 : (0.5 + P.speed * 0.6) * st.speed;
      let g = ctx.createLinearGradient(0, 0, 0, h); if (dark) { g.addColorStop(0, '#0a0e18'); g.addColorStop(0.6, '#121a2a'); g.addColorStop(1, '#0b1019'); } else { g.addColorStop(0, '#e6ebf0'); g.addColorStop(0.6, '#d3dce5'); g.addColorStop(1, '#c4cfd9'); } ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let k = 0; k < 2; k++) { const x = w * (0.3 + k * 0.42) + Math.sin(st.t * 0.05 + k) * w * 0.03, y = h * 0.38; g = ctx.createRadialGradient(x, y, 0, x, y, w * 0.3); g.addColorStop(0, dark ? 'rgba(200,190,170,0.12)' : 'rgba(255,250,240,0.5)'); g.addColorStop(1, 'rgba(200,190,170,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
      ctx.lineCap = 'round';
      const nAct = Math.max(30, Math.min(drops.length, Math.round(drops.length * (w * h) / (1100 * 700))));
      for (let di = 0; di < nAct; di++) { const d = drops[di]; d.y += st.dt * 0.09 * sp * d.spd * d.z * (0.6 + P.density * 0.6); if (d.y > 1.1) { d.y = -0.15; d.x = hash(d.y * 1000 + d.x * 77 + st.t); } const x = d.x * w, y = d.y * h, len = d.len * h * (0.6 + P.scale * 0.8) * d.z; ctx.strokeStyle = rgba(mix3(tint, [255, 255, 255], dark ? 0.4 : 0), (0.08 + d.z * 0.3) * (dark ? 1 : 0.7)); ctx.lineWidth = 0.6 + d.z * 1.6; ctx.beginPath(); ctx.moveTo(x, y - len); ctx.lineTo(x, y); ctx.stroke(); }
      for (const b of beads) { b.y += st.dt * 0.004 * sp * (0.5 + Math.sin(st.t * 0.3 + b.ph) * 0.5); if (b.y > 1.05) { b.y = -0.05; b.x = hash(b.ph + st.t); } const x = b.x * w, y = b.y * h; g = ctx.createRadialGradient(x - b.r * 0.3, y - b.r * 0.3, 0, x, y, b.r); g.addColorStop(0, dark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.9)'); g.addColorStop(1, rgba(tint, 0.12)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, b.r, 0, TAU); ctx.fill(); }
      const tk = Math.floor(st.t * 0.16); if (!st.reduce && tk !== lastTick) { lastTick = tk; ripples.push({ x: 0.1 + hash(tk) * 0.8, y: 0.45 + hash(tk, 1) * 0.5, a: 0 }); }
      for (const tp of st.taps) if (!tp._r) { tp._r = true; ripples.push({ x: tp.x, y: tp.y, a: 0 }); }
      ripples = ripples.filter(r => (r.a += st.dt * 0.25 * sp) < 1); for (const r of ripples) { ctx.strokeStyle = rgba(mix3(tint, [255, 255, 255], 0.3), 0.3 * (1 - r.a)); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(r.x * w, r.y * h, r.a * w * 0.08, r.a * w * 0.035, 0, 0, TAU); ctx.stroke(); }
      g = ctx.createLinearGradient(0, h * 0.7, 0, h); g.addColorStop(0, rgba(tint, 0)); g.addColorStop(1, rgba(tint, dark ? 0.14 : 0.2)); ctx.fillStyle = g; ctx.fillRect(0, h * 0.7, w, h * 0.3);
    } };
  };
  ENV.nightsky = () => {
    const stars = Array.from({ length: LOW ? 120 : 200 }, (_, i) => ({ x: hash(i + 500), y: hash(i + 501), z: 0.2 + hash(i + 502) * 0.8, ph: hash(i + 503) * TAU, r: 0.4 + hash(i + 504) * 1.3 }));
    return { draw(ctx, w, h, st) {
      const P = st.P, dark = st.dark; const sp = st.reduce ? 0.1 : (0.4 + P.speed * 0.4) * st.speed;
      let g = ctx.createLinearGradient(0, 0, 0, h); if (dark) { g.addColorStop(0, '#05070f'); g.addColorStop(0.55, '#0a1020'); g.addColorStop(1, '#0d1526'); } else { g.addColorStop(0, '#dfe4ee'); g.addColorStop(0.6, '#e9ecf2'); g.addColorStop(1, '#d6dce8'); } ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let k = 0; k < 2; k++) { const x = w * (0.35 + k * 0.3) + Math.sin(st.t * 0.02 + k * 2) * w * 0.08, y = h * (0.35 + k * 0.2); g = ctx.createRadialGradient(x, y, 0, x, y, w * 0.45); g.addColorStop(0, rgba(st.tint, dark ? 0.08 : 0.12)); g.addColorStop(1, rgba(st.tint, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
      const drift = st.t * 0.004 * sp;
      const nAct = Math.max(40, Math.min(stars.length, Math.round(stars.length * (w * h) / (1100 * 700))));
      for (let si = 0; si < nAct; si++) { const s = stars[si]; const x = ((s.x + drift * s.z * 0.3) % 1) * w, y = (s.y + Math.sin(st.t * 0.05 + s.ph) * 0.004 * s.z) * h; const tw = 0.6 + 0.4 * Math.sin(st.t * (0.2 + s.z * 0.3) + s.ph); const al = (0.25 + s.z * 0.7) * tw * (dark ? 1 : 0.55); const r = s.r * (0.7 + P.scale * 0.5);
        if (s.z > 0.7) { g = ctx.createRadialGradient(x, y, 0, x, y, r * 5); g.addColorStop(0, rgba(mix3(st.tint, [255, 255, 255], 0.5), al * 0.35)); g.addColorStop(1, rgba(st.tint, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 5, 0, TAU); ctx.fill(); }
        ctx.fillStyle = dark ? `rgba(235,240,255,${al})` : rgba(mix3(st.tint, [40, 50, 90], 0.5), al); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
      g = ctx.createLinearGradient(0, h * 0.82, 0, h); g.addColorStop(0, dark ? 'rgba(4,6,12,0)' : 'rgba(200,206,220,0)'); g.addColorStop(1, dark ? 'rgba(4,6,12,0.9)' : 'rgba(190,198,215,0.9)'); ctx.fillStyle = g; ctx.fillRect(0, h * 0.82, w, h * 0.18);
    } };
  };
  ENV.ripple = () => {
    let rings = []; let nextAmb = 0, lastPulse = -1;
    return { draw(ctx, w, h, st) {
      const P = st.P, dark = st.dark, tint = st.tint; const sp = st.reduce ? 0.2 : (0.6 + P.speed * 0.5) * st.speed; const big = 0.5 + P.depth * 0.8;
      let g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.8); if (dark) { g.addColorStop(0, '#0e1624'); g.addColorStop(1, '#070a12'); } else { g.addColorStop(0, '#e4ecf1'); g.addColorStop(1, '#cfdbe4'); } ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      nextAmb -= st.dt * sp; if (nextAmb <= 0 && !st.reduce) { rings.push({ x: 0.2 + hash(st.t) * 0.6, y: 0.2 + hash(st.t, 1) * 0.6, a: 0, k: 0.6 }); nextAmb = 2.5 + hash(st.t, 2) * 3; }
      for (const tp of st.taps) if (!tp._r) { tp._r = true; rings.push({ x: tp.x, y: tp.y, a: 0, k: 1 }); }
      const pulse = Math.floor(st.t * 3); if (st.pointer.on && st.pointer.down && pulse !== lastPulse) { lastPulse = pulse; rings.push({ x: st.pointer.x, y: st.pointer.y, a: 0, k: 0.5 }); }
      rings = rings.filter(r => (r.a += st.dt * 0.09 * sp / big) < 1); if (rings.length > 24) rings = rings.slice(-24);
      ctx.lineWidth = 1.2;
      for (const r of rings) { const R = r.a * Math.min(w, h) * 0.55 * big; for (let q = 0; q < 3; q++) { const rr = R * (1 - q * 0.12); if (rr <= 0) continue; const al = (1 - r.a) * (0.35 - q * 0.09) * r.k; ctx.strokeStyle = rgba(mix3(tint, [255, 255, 255], dark ? 0.35 : -0.1), al); ctx.beginPath(); ctx.ellipse(r.x * w, r.y * h, rr, rr * 0.82, 0, 0, TAU); ctx.stroke(); }
        if (R > 1) { g = ctx.createRadialGradient(r.x * w, r.y * h, 0, r.x * w, r.y * h, R); g.addColorStop(0, rgba(tint, 0.06 * (1 - r.a))); g.addColorStop(1, rgba(tint, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(r.x * w, r.y * h, R, R * 0.82, 0, 0, TAU); ctx.fill(); } }
      for (let i = 0; i < 6; i++) { const y = h * (0.15 + i * 0.14) + Math.sin(st.t * 0.2 + i) * 6; ctx.strokeStyle = rgba(tint, 0.05); ctx.beginPath(); for (let x = 0; x <= w; x += 12) { const yy = y + Math.sin(x / w * 5 + st.t * 0.3 * sp + i) * 3; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke(); }
    } };
  };
  ENV.float = () => {
    const ps = Array.from({ length: LOW ? 70 : 110 }, (_, i) => ({ x: hash(i + 700), y: hash(i + 701), z: 0.2 + hash(i + 702) * 0.8, ph: hash(i + 703) * TAU, s: 0.6 + hash(i + 704) * 0.9 }));
    let px = 0.5, py = 0.5;
    return { draw(ctx, w, h, st) {
      const P = st.P, dark = st.dark, tint = st.tint; const sp = st.reduce ? 0.1 : (0.5 + P.speed * 0.5) * st.speed; const fine = 0.5 + (1 - P.scale) * 0.9;
      let g = ctx.createLinearGradient(0, 0, 0, h); if (dark) { g.addColorStop(0, '#0a0d19'); g.addColorStop(1, '#111a33'); } else { g.addColorStop(0, '#f1f1f5'); g.addColorStop(1, '#e1e5f0'); } ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      g = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, w * 0.55); g.addColorStop(0, rgba(tint, dark ? 0.10 : 0.14)); g.addColorStop(1, rgba(tint, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      if (st.pointer.on) { px += (st.pointer.x - px) * 0.02; py += (st.pointer.y - py) * 0.02; } else { px += (0.5 - px) * 0.01; py += (0.5 - py) * 0.01; }
      const nAct = Math.max(24, Math.min(ps.length, Math.round(ps.length * (w * h) / (1100 * 700))));
      for (let pi = 0; pi < nAct; pi++) { const p = ps[pi]; p.y -= st.dt * 0.012 * sp * p.z * (0.6 + P.density * 0.5); p.x += Math.sin(st.t * 0.4 + p.ph) * 0.0006 * p.z * sp; if (p.y < -0.1) { p.y = 1.1; p.x = hash(p.ph + st.t); }
        const x = (p.x + (px - 0.5) * 0.06 * p.z) * w, y = (p.y + (py - 0.5) * 0.04 * p.z) * h; const r = (2 + p.z * 12) * p.s / fine * (1 + st.level * 0.3); const a = (0.12 + p.z * 0.35) * (0.7 + 0.3 * Math.sin(st.t + p.ph)) * (dark ? 1 : 0.75);
        g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4); g.addColorStop(0, rgba(mix3(tint, [255, 255, 255], dark ? 0.4 : -0.2), a * 0.5)); g.addColorStop(1, rgba(tint, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, TAU); ctx.fill();
        ctx.fillStyle = rgba(mix3(tint, [255, 255, 255], dark ? 0.5 : -0.3), a); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    } };
  };
  ENV.generic = () => ({ draw(ctx, w, h, st) { const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.8); if (st.dark) { g.addColorStop(0, '#0f1422'); g.addColorStop(1, '#070a12'); } else { g.addColorStop(0, '#eef0f4'); g.addColorStop(1, '#dfe3ea'); } ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); } });
  function makeEnvironment(id) { return (ENV[id] || ENV.generic)(); }
  const shared = {}; function sharedEnvironment(id) { return shared[id] || (shared[id] = makeEnvironment(id)); }

  global.SoftwaveField = { Field, Preview, PERSONA, DESC, LAYERS, personaFor, blend, clock, tick, makeEnvironment, sharedEnvironment, environments: Object.keys(ENV), drawRings, envState, LOW, isDark, reduced };
})(window);
