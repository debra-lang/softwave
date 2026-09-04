/* Find My Quiet Sound — The Lab: personal sound discovery
   Ten experiments in four groups (Discover / Explore / Focus / Sessions), a preference profile,
   custom sounds that can be saved and reused anywhere, favourites, feedback and history.
   Everything is stored locally. Nothing here is a treatment; labels say so. */
(function () {
  'use strict';
  const engine = window.softwave, app = window.softwaveApp, focus = window.softwaveFocus;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = app.store;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const NAME = id => (engine.def(id) || { name: id }).name;
  const LIB = engine.defs().map(d => d.id);
  const VISUALS = focus.visuals;
  const DEF = () => engine.constructor.defaultSculpt();
  const SV = window.SoftwaveVisuals;
  // ===== LAB v3 — the Find My Quiet Sound language, deeper and more interactive =====
  const SF = () => window.SoftwaveField;
  const TAU = Math.PI * 2;
  const isDark = () => document.documentElement.dataset.theme === 'dark';
  const lerp = (a, b, t) => a + (b - a) * t;
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const hash = (i, k = 0) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };
  // A sound object: the Sound Field language at small scale (rings + personality layer), morphing as its parameters change.
  function soundObject(ctx, w, h, s, t, lv, holder) {
    const F = SF(); if (!F) return; const c = holder || ctx.canvas; const p = s.p || {}; const nature = p.nature && p.nature !== 'none' ? p.nature : null;
    const target = nature ? F.blend([{ id: 'sculpt', params: p, volume: 0.6 }, { id: nature, volume: 0.35 }]) : F.personaFor('sculpt', p);
    if (!c._P) c._P = Object.assign({}, target); const P = c._P; for (const k in target) { if (Array.isArray(target[k])) P[k] = (P[k] || target[k]).map((v, i) => lerp(v, target[k][i], 0.06)); else if (typeof target[k] === 'number') P[k] = lerp(P[k] == null ? target[k] : P[k], target[k], 0.06); else P[k] = target[k]; }
    const dark = isDark(), tint = dark ? P.tint : P.light; const R = Math.min(w, h) * (s.scale || 0.42); const cx = w / 2, cy = h / 2; const life = s.live ? 1 : 0.45;
    const red = F.reduced();
    const o = { cx, cy, R, W: w, H: h, t: t * (s.speed || 1), life, alive: s.live ? 1 : 0.35, level: lv, low: lv * 0.6, vol: 0.4, P, tint, dark, e: 0, rawMorph: 0, grow: 1, reduce: red, pts: R < 90 ? 64 : R < 180 ? 96 : 140 };
    let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5); g.addColorStop(0, rgba(tint, dark ? 0.12 : 0.14)); g.addColorStop(1, rgba(tint, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    F.drawRings(ctx, o);
    const layer = F.LAYERS[P.geo]; if (layer && P.geo !== 'rings') { ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R * 1.02, 0, TAU); ctx.clip(); layer(ctx, cx, cy, R, { t: o.t, life, alive: o.alive, level: lv, low: o.low, dark, tint, P, reduce: red }, red ? 0.6 : 1); ctx.restore(); }
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.5); g.addColorStop(0, rgba(tint, (dark ? 0.2 : 0.22) * (0.5 + o.alive * 0.5))); g.addColorStop(1, rgba(tint, 0)); ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  }
  // Frequency landscape behind the Lab heading: slow spectral silhouettes, the Lab's own texture.
  function labField(ctx, w, h, t) {
    const dark = isDark(); const F = SF(); const red = F && F.reduced(); const tt = red ? t * 0.15 : t;
    ctx.clearRect(0, 0, w, h); const layers = 5;
    for (let L = 0; L < layers; L++) { const z = L / (layers - 1); ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) { const u = x / w; const y = h * (0.92 - 0.5 * z) - h * 0.22 * (0.5 + 0.5 * Math.sin(u * 5.2 + tt * 0.18 * (1 + z) + L * 1.7)) * (0.35 + 0.65 * Math.pow(Math.sin(u * Math.PI), 0.6)) - h * 0.05 * Math.sin(u * 17 + tt * 0.3 + L); ctx.lineTo(x, y); }
      ctx.lineTo(w, h); ctx.closePath();
      const a = dark ? 0.035 + z * 0.05 : 0.04 + z * 0.05; ctx.fillStyle = dark ? `rgba(150,185,205,${a})` : `rgba(60,90,120,${a * 0.7})`; ctx.fill();
      ctx.strokeStyle = dark ? `rgba(190,215,230,${0.08 + z * 0.12})` : `rgba(40,70,100,${0.1 + z * 0.1})`; ctx.lineWidth = 1; ctx.stroke(); }
    // faint frequency ticks
    ctx.strokeStyle = dark ? 'rgba(190,215,230,0.06)' : 'rgba(40,70,100,0.06)'; for (let i = 1; i < 24; i++) { const x = w * Math.pow(i / 24, 1.6); ctx.beginPath(); ctx.moveTo(x, h * 0.55); ctx.lineTo(x, h); ctx.stroke(); }
  }
  // Per-experiment living previews — each experiment should look like what it is.
  const PREVIEW = {
    discovery(ctx, w, h, t, dark, tint) { const on = Math.floor(t / 2.5) % 2; for (const k of [0, 1]) { const x = w * (k ? 0.7 : 0.3); ctx.save(); ctx.translate(x - w / 2, 0); soundObjectAt(ctx, w, h, { p: k ? { colour: 0.7, warm: 0.3, moving: 0.4 } : { colour: 0.25, warm: -0.4, moving: 0 }, live: on === k, scale: Math.min(0.28, 0.2 * w / h) }, t, on === k ? 0.25 : 0.05, k); ctx.restore(); } ctx.fillStyle = dark ? 'rgba(255,255,255,.4)' : 'rgba(20,30,50,.45)'; ctx.font = '300 16px Fraunces, Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('A', w * 0.3, h * 0.5 + 6); ctx.fillText('B', w * 0.7, h * 0.5 + 6); ctx.textAlign = 'left'; },
    paint(ctx, w, h, t, dark, tint) { ctx.beginPath(); ctx.moveTo(0, h); for (let x = 0; x <= w; x += 4) { const u = x / w; const y = h * 0.96 - h * 0.72 * (0.45 + 0.55 * Math.sin(u * 4 + t * 0.4)) * (0.35 + 0.65 * Math.sin(u * Math.PI)); ctx.lineTo(x, y); } ctx.lineTo(w, h); ctx.closePath(); const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, rgba(mix3(tint, [220, 170, 120], 0.5), 0.55)); g.addColorStop(1, rgba(mix3(tint, [150, 190, 220], 0.5), 0.55)); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = dark ? 'rgba(255,255,255,.7)' : 'rgba(20,30,50,.6)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = dark ? 'rgba(255,255,255,.35)' : 'rgba(20,30,50,.4)'; ctx.font = '500 9px Inter, sans-serif'; ctx.fillText('LOW', 8, h - 8); ctx.textAlign = 'right'; ctx.fillText('HIGH', w - 8, h - 8); ctx.textAlign = 'left'; },
    sculptor(ctx, w, h, t, dark, tint) { const k = 0.5 + 0.5 * Math.sin(t * 0.35); soundObject(ctx, w, h, { p: { colour: 0.2 + 0.6 * k, warm: Math.sin(t * 0.27) * 0.6, moving: k * 0.6, width: 0.5 }, live: true, scale: 0.36 }, t, 0.15); },
    generative(ctx, w, h, t, dark, tint) { for (let i = 0; i < 26; i++) { const ph = (t * 0.05 * (0.5 + hash(i)) + hash(i, 1)) % 1; const x = (hash(i, 2) * 0.8 + 0.1) * w + Math.sin(t * 0.3 + i) * 6, y = h * (1.05 - ph * 1.1); const a = Math.sin(ph * Math.PI) * (0.3 + hash(i, 3) * 0.5); const r = 1 + hash(i, 4) * 2.5; const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, rgba(tint, a * 0.5)); g.addColorStop(1, rgba(tint, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, TAU); ctx.fill(); ctx.fillStyle = rgba(mix3(tint, [255, 255, 255], dark ? 0.5 : 0), a); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); } },
    morph(ctx, w, h, t, dark, tint) { const k = 0.5 + 0.5 * Math.sin(t * 0.3); soundObject(ctx, w, h, { p: { colour: 0.15 + 0.7 * k, warm: -0.5 + k, moving: 0 }, live: true, scale: 0.34 }, t, 0.12); ctx.fillStyle = dark ? 'rgba(255,255,255,.35)' : 'rgba(20,30,50,.45)'; ctx.font = '500 9px Inter, sans-serif'; ctx.fillText('BROWN', 8, h - 8); ctx.textAlign = 'right'; ctx.fillText('RAIN', w - 8, h - 8); ctx.textAlign = 'left'; ctx.fillStyle = rgba(tint, 0.6); ctx.fillRect(8, h - 4, (w - 16) * k, 1.5); },
    space(ctx, w, h, t, dark, tint) { const cx = w / 2, cy = h * 0.55; for (let r = 3; r >= 1; r--) { const rr = r / 3 * Math.min(w, h) * 0.46; const g = ctx.createRadialGradient(cx, cy, rr * 0.3, cx, cy, rr); g.addColorStop(0, rgba(tint, 0)); g.addColorStop(1, rgba(tint, 0.06)); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * 0.62, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = rgba(tint, 0.22); ctx.lineWidth = 1; ctx.stroke(); } const pts = [[0.22, 0.45], [0.5, 0.2], [0.8, 0.48], [0.5, 0.78]]; pts.forEach(([x, y], i) => { const px = x * w + Math.sin(t * 0.2 + i) * 3, py = y * h + Math.cos(t * 0.17 + i) * 2; const g = ctx.createRadialGradient(px, py, 0, px, py, 12); g.addColorStop(0, rgba(tint, 0.7)); g.addColorStop(1, rgba(tint, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 12, 0, TAU); ctx.fill(); }); ctx.fillStyle = dark ? '#eef0f4' : '#1f1d1a'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TAU); ctx.fill(); },
    attention(ctx, w, h, t, dark, tint) { const x = w * (0.5 + 0.32 * Math.sin(t * 0.25)), y = h * (0.5 + 0.22 * Math.sin(t * 0.37 + 1)); for (let i = 8; i > 0; i--) { const tx = w * (0.5 + 0.32 * Math.sin((t - i * 0.4) * 0.25)), ty = h * (0.5 + 0.22 * Math.sin((t - i * 0.4) * 0.37 + 1)); ctx.fillStyle = rgba(tint, 0.05 * (9 - i) / 9); ctx.beginPath(); ctx.arc(tx, ty, 6, 0, TAU); ctx.fill(); } const g = ctx.createRadialGradient(x, y, 0, x, y, 26); g.addColorStop(0, rgba(mix3(tint, [255, 255, 255], 0.5), 0.8)); g.addColorStop(0.3, rgba(tint, 0.35)); g.addColorStop(1, rgba(tint, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 26, 0, TAU); ctx.fill(); },
    svjourney(ctx, w, h, t, dark, tint) { const k = 0.5 + 0.5 * Math.sin(t * 0.12); const sky = ctx.createLinearGradient(0, 0, 0, h); const day = dark ? ['#2a3d5c', '#4a5f84'] : ['#cfe0ee', '#e9d8c8']; const night = dark ? ['#06080f', '#0e1426'] : ['#9aa6c0', '#6b7591']; sky.addColorStop(0, mixHex(day[0], night[0], k)); sky.addColorStop(1, mixHex(day[1], night[1], k)); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h); const lx = w * 0.66, ly = h * (0.25 + 0.3 * k); const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, w * 0.3); g.addColorStop(0, `rgba(240,220,190,${0.35 * (1 - k * 0.6)})`); g.addColorStop(1, 'rgba(240,220,190,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) { ctx.beginPath(); for (let x = 0; x <= w; x += 5) { const y = h * (0.62 + i * 0.1) + Math.sin(x / w * 4 + t * 0.3 + i) * 3; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fillStyle = `rgba(10,20,40,${0.25 + i * 0.12})`; ctx.fill(); } for (let i = 0; i < 14; i++) { ctx.fillStyle = `rgba(255,255,255,${0.7 * k * (0.5 + 0.5 * Math.sin(t + i))})`; ctx.beginPath(); ctx.arc(hash(i) * w, hash(i, 1) * h * 0.5, 0.8, 0, TAU); ctx.fill(); } },
    journey(ctx, w, h, t, dark, tint) { const n = 5; const y0 = h * 0.55; ctx.strokeStyle = rgba(tint, 0.35); ctx.lineWidth = 1.2; ctx.beginPath(); for (let x = 0; x <= w; x += 4) { const u = x / w; ctx.lineTo(x, y0 + Math.sin(u * 6 + t * 0.2) * h * 0.08 - u * h * 0.15); } ctx.stroke(); const ph = (t * 0.06) % 1; for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; const x = u * w, y = y0 + Math.sin(u * 6 + t * 0.2) * h * 0.08 - u * h * 0.15; const near = Math.max(0, 1 - Math.abs(u - ph) * 4); const g = ctx.createRadialGradient(x, y, 0, x, y, 10 + near * 10); g.addColorStop(0, rgba(tint, 0.5 + near * 0.4)); g.addColorStop(1, rgba(tint, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 10 + near * 10, 0, TAU); ctx.fill(); ctx.fillStyle = dark ? '#eef0f4' : '#1f1d1a'; ctx.beginPath(); ctx.arc(x, y, 2 + near * 1.5, 0, TAU); ctx.fill(); } ctx.fillStyle = dark ? 'rgba(255,255,255,.35)' : 'rgba(20,30,50,.45)'; ctx.font = '500 9px Inter, sans-serif'; ctx.fillText('NOW', 8, h - 8); ctx.textAlign = 'right'; ctx.fillText('40 MIN', w - 8, h - 8); ctx.textAlign = 'left'; },
    session(ctx, w, h, t, dark, tint) { const steps = 4; for (let i = 0; i < steps; i++) { const ph = ((t * 0.25) - i * 0.9) % 4; const on = ph > 0 && ph < 3.2; const a = on ? 0.9 : 0.25; const x = w * 0.16 + i * w * 0.2, y = h * 0.5 + (i % 2 ? 12 : -12); ctx.fillStyle = rgba(tint, a * 0.25); roundRect(ctx, x - 22, y - 9, 44, 18, 9); ctx.fill(); ctx.strokeStyle = rgba(tint, a * 0.7); ctx.lineWidth = 1; roundRect(ctx, x - 22, y - 9, 44, 18, 9); ctx.stroke(); if (i < steps - 1) { ctx.strokeStyle = rgba(tint, 0.25); ctx.beginPath(); ctx.moveTo(x + 22, y); ctx.lineTo(x + w * 0.2 - 22, y + (i % 2 ? -24 : 24)); ctx.stroke(); } } },
  };
  function mixHex(a, b, t) { const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16)); return rgba(mix3(pa, pb, t), 1); }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  const abState = [{}, {}];
  function soundObjectAt(ctx, w, h, s, t, lv, k) { soundObject(ctx, w, h, s, t, lv, abState[k]); }
  // Small canvas animator for sound objects (A/B, reveal, fingerprint, sculptor, featured)
  const liveShapes = new Map(); let shapeT = 0, shapeLast = 0; const shapeSpec = new Uint8Array(512);
  const shapeSeen = new Map(); const shapeIO = new IntersectionObserver(es => es.forEach(e => shapeSeen.set(e.target, e.isIntersecting)), { rootMargin: '60px' });
  // Geometry is cached by a ResizeObserver — reading getBoundingClientRect/offsetParent for every
  // canvas on every tick forces layout and was the single biggest CPU cost of the Experiments view.
  const shapeRect = new Map(); const shapeRO = new ResizeObserver(es => es.forEach(en => { const r = en.target.getBoundingClientRect(); shapeRect.set(en.target, { w: r.width, h: r.height }); }));
  function shapeLoop(now) { requestAnimationFrame(shapeLoop); if (document.hidden || now - shapeLast < (window.softwaveMinimalActive ? 300 : SF() && SF().LOW ? 150 : 100)) return; const labView = $('#view-lab'); if (!labView || labView.hidden) return; const dt = Math.min(0.12, (now - shapeLast) / 1000); shapeLast = now; shapeT += dt; const lv = engine.isPlaying ? Math.min(1, engine.getLevels(shapeSpec) * 6) : 0;
    liveShapes.forEach((get, c) => { if (!c.isConnected) { liveShapes.delete(c); shapeSeen.delete(c); shapeRect.delete(c); return; } if (!shapeSeen.has(c)) { shapeSeen.set(c, false); shapeIO.observe(c); shapeRO.observe(c); return; } if (!shapeSeen.get(c)) return; if (SF() && SF().LOW && c._drawnOnce && get().preview) return; c._drawnOnce = true; const r = shapeRect.get(c); if (!r || !r.w) return; const dpr = Math.min(devicePixelRatio || 1, SF() && SF().LOW ? 1 : 1.5); if (c.width !== Math.round(r.w * dpr)) { c.width = Math.round(r.w * dpr); c.height = Math.round(r.h * dpr); } const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.w, r.h); const s = get(); if (s.preview) { const P = SF() ? SF().PERSONA.brown : null; const tint = isDark() ? [190, 200, 215] : [70, 90, 120]; ctx.fillStyle = isDark() ? 'rgba(14,18,28,.9)' : 'rgba(236,232,224,.9)'; ctx.fillRect(0, 0, r.w, r.h); PREVIEW[s.preview] && PREVIEW[s.preview](ctx, r.w, r.h, shapeT, isDark(), s.tint || tint); } else if (s.field) labField(ctx, r.w, r.h, shapeT); else soundObject(ctx, r.w, r.h, s, shapeT, s.live ? lv : 0.15); }); }
  requestAnimationFrame(shapeLoop);
  const liveShape = (canvas, get) => liveShapes.set(canvas, get);
  let spaceHook = null; engine.on(t => { if (t === 'sounds' && spaceHook && running && running.exp.id === 'space') spaceHook(); });
  // Premium gate — OFF. When activated: every premium experiment still previews; Sound Discovery allows one full session free,
  // then saving the profile, repeated discoveries and premium experiments ask for Premium. Nothing already saved is ever removed.
  // Access control lives in monetization.js (entitlements). During launch all-access, everything passes.
  const M = () => window.softwaveMonetization;
  const PREMIUM_TAG = () => (M() && M().LABELS.premiumTag) || 'Premium · free during launch';
  function gate(exp) {
    if (!M()) return true;
    if (M().canUse('experiment:' + exp.id)) return true;
    if (window.softwavePremium) return softwavePremium.gate('experiment:' + exp.id);   // contextual prompt
    M().track('premium_feature_opened');
    app.toast('This experiment is part of Premium — see Free & Premium below.', 5000); return false;
  }

  // ---------- records ----------
  const fb = () => store.get('lab:feedback', {});
  const setFb = (id, patch) => { const all = fb(); all[id] = Object.assign({ tries: 0 }, all[id] || {}, patch); store.set('lab:feedback', all); };
  const favs = () => store.get('lab:favs', []);
  const mySounds = () => store.get('lab:sounds', []);
  const saveSound = (snd) => { const l = mySounds(); if (M() && !M().canCreateSavedItem(l.length)) { window.softwavePremium && softwavePremium.saveLimit('sounds'); return; } if (M()) M().track('sound_saved'); l.push(snd); store.set('lab:sounds', l); app.renderPresetsRemount ? app.renderPresetsRemount() : (app.renderPresets && app.renderPresets()); };
  // saving combos (environments/sessions) shares the same Free limit
  const canSaveCombo = () => { const n = store.get('combos', []).length; if (M() && !M().canCreateSavedItem(n)) { window.softwavePremium && softwavePremium.saveLimit('environments'); return false; } return true; };
  const EV = { established: 'Well-studied principle', promising: 'Promising research', exploratory: 'Experimental — research is limited', mixed: 'Experimental — evidence is mixed' };

  // ===== Personalized Notched Sound: configuration (admin-adjustable, see release report) =====
  // Everything a researcher might tune lives here; store.set('notch:config', {...}) overrides
  // any field without a code change. Evidence text is data, not hard-coded conclusions, so it
  // can be revised (or later fed from the central evidence database) as research changes.
  const NOTCH_DEF = {
    widths: { narrow: { oct: 0.25, label: 'Narrow' }, standard: { oct: 1, label: 'Standard' }, wide: { oct: 1.5, label: 'Wide' } },
    depths: { gentle: { db: 12, label: 'Gentle' }, standard: { db: 24, label: 'Standard' }, strong: { db: 36, label: 'Strong' } },
    fcMin: 200, fcMax: 12500,
    researchHz: 8000,    // Teismann 2011: effects were seen ≤8 kHz, not above
    hardwareHz: 10000,   // playback hardware varies widely up here
    sources: ['pink', 'white', 'static', 'hiss', 'brown', 'rain', 'glassrain', 'ocean', 'lapping', 'stream', 'waterfall', 'wind', 'forest', 'leaves', 'summernight'],
    timers: [10, 20, 30, 60],
    evidence: {
      tier: 'Mixed', updated: '2026-09-03',
      plain: 'Notched sound (and "tailor-made notched music") reduces a frequency band around a person’s selected tinnitus pitch, instead of adding sound there. Personalized notched sound has been studied as a possible approach to tinnitus management, but research findings are mixed: some studies have reported changes in tinnitus measures for certain participants, while other controlled studies have not found significant benefit on their primary outcomes. More research is needed to determine whether it is beneficial, for whom, and under what conditions. Find My Quiet Sound provides this feature as an experimental sound-exploration tool, not as a medical treatment.',
      studies: [
        { ref: 'Okamoto et al. 2010, PNAS', n: '39 (three groups)', found: 'After 12 months of tailor-made notched music (1-octave notch), reported tinnitus loudness and related auditory-cortex activity decreased versus placebo-notched music.', kind: 'positive', url: 'https://pubmed.ncbi.nlm.nih.gov/20080545/' },
        { ref: 'Teismann et al. 2011, PLoS ONE', n: '20', found: 'Five days of intensive notched-music listening reduced loudness and distress for tinnitus pitches up to 8 kHz — but not above 8 kHz. Effects faded after training stopped.', kind: 'positive with limits', url: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0024685' },
        { ref: 'Wunderlich et al. 2015, PLoS ONE', n: '31', found: 'Compared ¼-, ½- and 1-octave notch widths; notch width made no measurable difference to outcomes.', kind: 'neutral', url: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0138595' },
        { ref: 'Stein et al. 2016 (Münster RCT)', n: '100', found: 'The largest randomized trial: three months, about two hours daily. No significant benefit over placebo on its primary outcome measures.', kind: 'null primary', url: 'https://pubmed.ncbi.nlm.nih.gov/27838685/' },
        { ref: 'Sereda et al. 2018, Cochrane Review', n: '590 (8 trials, sound therapy broadly)', found: 'Across sound-therapy approaches generally, evidence quality is low and no approach is established as superior.', kind: 'context', url: 'https://www.cochranelibrary.com/cdsr/doi/10.1002/14651858.CD013094.pub2' },
      ],
      protocols: 'In research studies, participants typically listened 1–2 hours daily for months (Okamoto: ~12 months; Stein: 3 months), or intensively for a few days (Teismann: 6 h/day for 5 days). These are research protocols, not medical recommendations — there is no established "correct dose".',
      limitations: 'Self-matched tinnitus pitch is approximate and can drift between sessions. Effects above 8 kHz were not supported in the research. Studies measured loudness and distress separately, and results differ between them. A temporary quieting right after listening (residual inhibition) is a different phenomenon from any long-term change.',
    },
  };
  const NCFG = () => { const o = store.get('notch:config', {}); return Object.assign({}, NOTCH_DEF, o, { evidence: Object.assign({}, NOTCH_DEF.evidence, o.evidence || {}) }); };
  const hzLabel = (hz) => hz >= 1000 ? (hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1) + ' kHz' : Math.round(hz) + ' Hz';

  // ---------- runtime ----------
  let running = null; const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const every = (fn, ms) => { const t = setInterval(fn, ms); timers.add(t); return t; };
  const clearTimers = () => { timers.forEach(t => { clearTimeout(t); clearInterval(t); }); timers.clear(); };
  const safeMaster = () => { if (engine.masterVolume > 0.5) app.setMaster(0.4); };

  // Journey runner: segments [{ min, label, mix, visual?, tone? }]; long linear cross-fades, optional visual changes
  function runJourney(segments, o = {}) {
    const xf = o.crossfade || 90; const union = [...new Set(segments.flatMap(s => s.mix.map(m => m.id)))].slice(0, 5);
    engine.activeList().forEach(s => { if (!union.includes(s.id)) engine.stopSound(s.id); });
    const apply = async (seg, fade) => { for (const id of union) { const m = seg.mix.find(x => x.id === id); if (m) { if (m.params) engine.setSculpt(m.params, id); if (!engine.isActive(id)) await engine.startSound(id, 0.001); engine.rampVolume(id, m.volume, fade); } else if (engine.isActive(id)) engine.rampVolume(id, 0.0001, fade); } if (seg.visual && o.visuals && seg.visual !== store.get('visual')) focus.crossfadeTo(seg.visual); if (seg.tone !== undefined) engine.setMasterTone(seg.tone, fade); if (o.visuals) { for (const key of ['dim', 'slow', 'time']) if (seg[key] !== undefined) rampParam(key, seg[key], fade); } };
    let k = 0; const step = async () => { const seg = segments[k % segments.length]; timelineStep(k % segments.length); await apply(seg, k === 0 ? 3 : xf); if (seg.label) app.toast(`Journey: ${seg.label}`, 2500); k++; if (k >= segments.length && !o.loop) { later(() => o.onEnd && o.onEnd(), seg.min * 60000); return; } later(step, seg.min * 60000); };
    engine.playAll(); step();
  }

  // Visual timeline for journeys: a flowing path with one node per stage; the active node glows as the journey runs.
  function timeline(host, stages, total) { if (!host) return; host.innerHTML = `<div class="lab-timeline" role="list" aria-label="Journey stages">${stages.map((s, i) => `<div class="tl-node${i === 0 ? ' now' : ''}" role="listitem" data-i="${i}"><span class="tl-dot"></span><span class="tl-time">${i === 0 ? 'NOW' : Math.round(total * i / stages.length) + ' MIN'}</span><span class="tl-label">${s}</span></div>`).join('')}</div>`; }
  function timelineStep(k) { $$('.tl-node').forEach((n, i) => n.classList.toggle('now', i === k)); }
  // Ramp a Focus parameter (dim / slow / time) over `seconds` — visual changes are never abrupt
  function rampParam(key, to, seconds) { const from = focus.getParam()[key] || 0; const t0 = performance.now(); const id = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / (seconds * 1000)); const e = k * k * (3 - 2 * k); focus.setParam(key, from + (to - from) * e); if (k >= 1) { clearInterval(id); timers.delete(id); } }, 200); timers.add(id); }

  // ---------- settings renderer ----------
  function renderSettings(exp, ctx, host) {
    host.innerHTML = '';
    (exp.settings || []).forEach(st => {
      const row = document.createElement('div'); row.className = 'lab-setting'; const id = `st-${exp.id}-${st.key}`;
      if (st.type === 'select') {
        row.innerHTML = `<label for="${id}">${st.label}</label><select id="${id}" class="select">${st.options.map(o => `<option value="${o[0]}" ${String(ctx.s[st.key]) === String(o[0]) ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
        $('select', row).addEventListener('change', e => { ctx.s[st.key] = e.target.value; exp.onSetting && exp.onSetting(ctx, st.key); });
      } else if (st.type === 'buttons') {
        row.innerHTML = `<span class="label-sm">${st.label}</span><div class="seg wrap" role="radiogroup" aria-label="${st.label}">${st.options.map(o => `<button role="radio" aria-checked="${String(ctx.s[st.key]) === String(o[0])}" data-v="${o[0]}">${o[1]}</button>`).join('')}</div>`;
        $$('button', row).forEach(b => b.addEventListener('click', () => { ctx.s[st.key] = (b.dataset.v !== '' && !isNaN(+b.dataset.v)) ? +b.dataset.v : b.dataset.v; $$('button', row).forEach(x => x.setAttribute('aria-checked', x === b)); exp.onSetting && exp.onSetting(ctx, st.key); }));
      } else if (st.type === 'range' && st.ends) {
        row.className += ' ends'; row.innerHTML = `<label for="${id}"><span>${st.ends[0]}</span><span>${st.ends[1]}</span><output>${st.fmt ? st.fmt(ctx.s[st.key]) : ctx.s[st.key]}</output></label><input id="${id}" type="range" min="${st.min}" max="${st.max}" step="${st.step || 1}" value="${ctx.s[st.key]}" aria-label="${st.label}">`;
        const r = $('input', row); app.paintRange(r); r.addEventListener('input', () => { ctx.s[st.key] = +r.value; $('output', row).textContent = st.fmt ? st.fmt(+r.value) : r.value; exp.onSetting && exp.onSetting(ctx, st.key); });
      } else if (st.type === 'range') {
        row.innerHTML = `<label for="${id}">${st.label} <output>${st.fmt ? st.fmt(ctx.s[st.key]) : ctx.s[st.key]}</output></label><input id="${id}" type="range" min="${st.min}" max="${st.max}" step="${st.step || 1}" value="${ctx.s[st.key]}">${st.scale ? `<div class="scale">${st.scale.map(x => `<span>${x}</span>`).join('')}</div>` : ''}`;
        const r = $('input', row); app.paintRange(r); r.addEventListener('input', () => { ctx.s[st.key] = +r.value; $('output', row).textContent = st.fmt ? st.fmt(+r.value) : r.value; exp.onSetting && exp.onSetting(ctx, st.key); });
      } else if (st.type === 'toggle') {
        row.innerHTML = `<label class="switch"><input id="${id}" type="checkbox" ${ctx.s[st.key] ? 'checked' : ''}><span class="track" aria-hidden="true"></span><span>${st.label}</span></label>`;
        $('input', row).addEventListener('change', e => { ctx.s[st.key] = e.target.checked; exp.onSetting && exp.onSetting(ctx, st.key); });
      }
      host.appendChild(row);
    });
  }

  // ---------- custom-sound helpers ----------
  const DIMS = ['colour', 'warm', 'deep', 'smooth', 'soft', 'width', 'moving', 'rich', 'mod'];
  const DIM_RANGE = { colour: [0, 1], warm: [-1, 1], deep: [-1, 1], smooth: [-1, 1], soft: [-1, 1], width: [0, 1], moving: [0, 1], rich: [0, 1], mod: [0, 1] };
  const NATURES = ['none', 'rain', 'ocean', 'wind', 'forest', 'stream', 'crickets', 'lapping', 'leaves'];
  const describe = (p, nature) => { const b = []; b.push(p.colour < 0.33 ? 'deep noise' : p.colour < 0.67 ? 'balanced noise' : 'bright noise'); if (p.warm < -0.25) b.push('warmer'); if (p.warm > 0.25) b.push('brighter'); if (p.deep > 0.3) b.push('airy'); if (p.deep < -0.3) b.push('deep'); if (p.soft < -0.3) b.push('soft'); if (p.smooth > 0.3) b.push('textured'); if (p.width > 0.6) b.push('wide'); if (p.moving > 0.3) b.push('gently moving'); if (p.rich > 0.4) b.push('rich'); if (p.mod > 0.3) b.push('slow swells'); if (nature && nature !== 'none') b.push(NAME(nature).toLowerCase()); return b.join(' · '); };
  const soundMix = (snd, vol = 0.55) => { const m = [{ id: snd.type === 'paint' ? 'paint' : 'sculpt', volume: vol, balance: 0 }]; if (snd.type === 'paint') m[0].curve = snd.curve; else m[0].params = snd.params; if (snd.nature && snd.nature !== 'none') m.push({ id: snd.nature, volume: snd.natureVol || 0.35, balance: 0 }); return m; };
  function saveSoundForm(host, snd, afterSave) {
    let f = $('.inline-form', host); if (f) { f.remove(); return; }
    f = document.createElement('form'); f.className = 'inline-form'; f.innerHTML = `<label class="sr-only" for="snd-name">Sound name</label><input id="snd-name" class="select" maxlength="40" value="${snd.name || 'My sound'}" style="min-width:200px"><button class="btn btn-primary btn-sm" type="submit">Save</button><button class="btn btn-ghost btn-sm" type="button" data-cancel>Cancel</button>`;
    host.appendChild(f); const inp = $('input', f); inp.focus(); inp.select(); $('[data-cancel]', f).addEventListener('click', () => f.remove());
    f.addEventListener('submit', e => { e.preventDefault(); saveSound(Object.assign({}, snd, { name: inp.value.trim() || 'My sound', when: Date.now() })); f.remove(); app.toast('Saved on this device — it now appears under “My Saved Sounds” on the Sounds page.', 4000); afterSave && afterSave(); });
  }

  // ---------- profile (preferences only — never a hearing profile) ----------
  const prefs = () => store.get('lab:prefs2', { n: 0, sum: {}, natures: {} });
  function learn(winner, nature) { const p = prefs(); p.n++; DIMS.forEach(d => { p.sum[d] = (p.sum[d] || 0) + winner[d]; }); if (nature) p.natures[nature] = (p.natures[nature] || 0) + 1; store.set('lab:prefs2', p); document.dispatchEvent(new CustomEvent('softwave:profile')); }
  function profileParams() { const p = prefs(); if (!p.n) return null; const out = {}; DIMS.forEach(d => out[d] = (p.sum[d] || 0) / p.n); return out; }
  function profile() {
    const p = prefs(); const pp = profileParams(); const lines = []; const counts = store.get('playcounts', {}); const f = fb();
    if (pp) { lines.push(pp.warm < -0.15 ? 'Warmer sounds' : pp.warm > 0.15 ? 'Brighter sounds' : 'A neutral tone'); lines.push(pp.colour < 0.4 ? 'Less high-frequency energy' : pp.colour > 0.6 ? 'More high-frequency energy' : 'A balanced frequency mix'); lines.push(pp.moving > 0.25 || pp.mod > 0.25 ? 'Gentle sound movement' : 'Steady, unchanging sound'); if (pp.width > 0.55) lines.push('A wide, spacious sound'); if (pp.smooth > 0.2) lines.push('A little texture'); if (pp.soft < -0.2) lines.push('Soft edges'); }
    const nat = Object.entries(p.natures).sort((a, b) => b[1] - a[1])[0]; if (nat && nat[0] !== 'none') lines.push(`${NAME(nat[0])} textures`);
    const total = Object.values(counts).reduce((a, b) => a + b, 0); if (total >= 5) { const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]; lines.push(`${NAME(top[0])} is your most-played sound`); }
    const motion = store.get('motion', 'low'); lines.push(motion === 'still' || motion === 'low' ? 'Low visual movement' : 'More visual movement');
    return { lines, pp, nature: nat ? nat[0] : 'none', rounds: p.n };
  }
  function visualForProfile() { const motion = store.get('motion', 'low'); const dark = document.documentElement.dataset.theme === 'dark'; const pr = profile(); if (pr.nature === 'rain') return 'rainwindow'; if (pr.nature === 'ocean' || pr.nature === 'lapping') return 'ocean'; if (pr.nature === 'forest' || pr.nature === 'leaves') return 'forest'; if (pr.nature === 'crickets') return 'nightsky'; if (motion === 'still') return dark ? 'nightsky' : 'softlight'; return dark ? 'nightsky' : 'particles'; }
  function renderProfile() {
    const pr = profile(); const el = $('#lab-profile'); if (!el) return;
    let fp = $('.profile-fp', el.parentElement); if (!fp) { fp = document.createElement('div'); fp.className = 'profile-fp'; fp.innerHTML = '<canvas aria-label="Your sound fingerprint — an abstract picture of your preferences"></canvas>'; el.parentElement.insertBefore(fp, el); liveShape($('canvas', fp), () => { const pp = profileParams(); return { p: pp ? Object.assign({}, pp, { nature: profile().nature }) : Object.assign(DEF(), { colour: 0.45, width: 0.5 }), live: false, speed: 0.6, scale: 0.4 }; }); }
    if (!pr.rounds) {
      el.innerHTML = `<p class="muted">Complete Find My Sound to create your personal sound profile.</p><div class="btn-row"><button class="btn btn-primary btn-sm" data-p="find">Find My Sound</button></div>`;
      $('[data-p="find"]', el).addEventListener('click', () => openExperiment('discovery')); return;
    }
    el.innerHTML = `${pr.rounds ? `<p>You seem to prefer:</p><ul class="bullets">${pr.lines.map(l => `<li>${l}</li>`).join('')}</ul><p class="muted small">Learned from ${pr.rounds} comparison${pr.rounds === 1 ? '' : 's'} in Find My Sound.</p>` : `<p>Nothing learned yet. Run <strong>Help Me Find My Sound</strong> — about ten quick comparisons — and Find My Quiet Sound will summarise what you preferred here.</p>`}
      <div class="btn-row"><button class="btn btn-primary btn-sm" data-p="play" ${pr.rounds ? '' : 'disabled'}>Play my sound</button><button class="btn btn-secondary btn-sm" data-p="sound" ${pr.rounds ? '' : 'disabled'}>Fine tune</button><button class="btn btn-secondary btn-sm" data-p="visual" ${pr.rounds ? '' : 'disabled'}>Add visual</button><button class="btn btn-secondary btn-sm" data-p="sleep" ${pr.rounds ? '' : 'disabled'}>Build sleep session</button><button class="btn btn-ghost btn-sm" data-p="explore">Try another experiment</button></div>
      <p class="muted small">A sound preference profile — not a hearing profile, not a diagnosis. Built only from your own taps; stored only on this device. <button class="btn btn-ghost btn-sm" data-p="clear">Clear</button></p>`;
    $('[data-p="play"]', el).addEventListener('click', async () => { safeMaster(); await engine.loadMix(soundMix({ params: pr.pp, nature: pr.nature, natureVol: 0.3 })); app.toast('Playing the sound you preferred.'); });
    $('[data-p="sound"]', el).addEventListener('click', async () => { safeMaster(); await engine.loadMix(soundMix({ params: pr.pp, nature: pr.nature, natureVol: 0.3 })); store.set('lab:settings:sculptor', sculptSettingsFrom(pr.pp, pr.nature)); delete ctxs.sculptor; openExperiment('sculptor'); });
    $('[data-p="sleep"]', el).addEventListener('click', async () => { safeMaster(); const p = Object.assign({}, pr.pp, { colour: Math.min(pr.pp.colour, 0.45), soft: Math.min(pr.pp.soft, -0.2), moving: 0 }); await engine.loadMix(soundMix({ params: p, nature: pr.nature === 'none' ? 'rain' : pr.nature, natureVol: 0.25 }, 0.5)); engine.setTimer(60, true); app.showView('sleep'); app.toast('Sleep session ready: 60-minute timer with gentle fade.'); });
    $('[data-p="visual"]', el).addEventListener('click', async () => { if (!engine.activeList().length) { safeMaster(); await engine.loadMix(soundMix({ params: pr.pp, nature: pr.nature, natureVol: 0.3 })); } focus.setVisual(visualForProfile()); focus.enterFocus(); });
    $('[data-p="explore"]', el).addEventListener('click', () => $('#thelab').scrollIntoView({ behavior: 'smooth' }));
    $('[data-p="clear"]', el).addEventListener('click', () => { ['lab:prefs2', 'lab:feedback', 'playcounts'].forEach(k => store.del(k)); renderProfile(); renderLists(); document.dispatchEvent(new CustomEvent('softwave:profile')); app.toast('Profile cleared'); });
  }
  const sculptSettingsFrom = (p, nature) => ({ colour: p.colour, warm: Math.round(p.warm * 100), deep: Math.round(p.deep * 100), smooth: Math.round(p.smooth * 100), soft: Math.round(p.soft * 100), width: Math.round(p.width * 100), moving: Math.round(p.moving * 100), rich: Math.round(p.rich * 100), nature: nature || 'none' });

  // =====================================================================
  // EXPERIMENTS
  // =====================================================================
  const EXPERIMENTS = [
    // ---------- DISCOVER ----------
    {
      id: 'discovery', name: 'Find My Sound', cat: 'Discover', featured: true, premium: true, evidence: 'promising', from: 'Preference learning by pairwise comparison (also used to personalise hearing aids)',
      what: 'Two sounds, A and B. Switch between them as often as you like and say which feels more comfortable. The winner is kept and gently varied each round. After about ten rounds you have your preferred sound.',
      why: 'Everyone’s tinnitus is different, and so is the sound that feels comfortable next to it. Comparing two things at a time is the easiest way to find out what you actually prefer — no sliders, no jargon.',
      how: 'Press Start. Listen to A, tap B, listen again, then choose. “Comfortable” means easy to listen to — the sound you could leave on and forget about, not the most interesting one. "No difference" is a perfectly good answer. Keep the volume low.',
      guide: 'learn/how-to-use-find-my-sound/',
      whyTest: 'Pairwise comparison is a well-established way to learn preferences people cannot put into words; the same method is used to personalise hearing-aid settings. Answers are naturally a little noisy, so sounds change slowly and the winner is kept every round. This discovers what you prefer — it says nothing about your hearing or the cause of your tinnitus.',
      settings: [{ key: 'rounds', label: 'Rounds', type: 'buttons', options: [[8, '8 (quick)'], [12, '12'], [15, '15 (thorough)']] }],
      defaults: { rounds: 12 }, custom: true,
      buildUI(ctx, host) {
        host.innerHTML = `<div class="disc-wrap">
          <div class="disc-progress" data-progress aria-live="polite"></div>
          <div class="ab-switch"><button class="ab-obj" data-sw="A" aria-pressed="true" aria-label="Listen to sound A" disabled><canvas></canvas><span class="lbl">A</span></button><button class="ab-obj" data-sw="B" aria-pressed="false" aria-label="Listen to sound B" disabled><canvas></canvas><span class="lbl">B</span></button><div class="disc-round" data-round aria-hidden="true"></div></div>
          <p class="muted small" style="text-align:center" data-hint>Press Start Experiment to begin.</p>
          <div class="label-sm" style="text-align:center;margin-top:12px">Which feels more comfortable?</div>
          <div class="btn-row" style="justify-content:center"><button class="btn btn-ghost" data-pick="A" disabled>A</button><button class="btn btn-ghost" data-pick="same" disabled>No difference</button><button class="btn btn-ghost" data-pick="B" disabled>B</button></div>
          <div data-result></div></div>`;
        $$('[data-sw]', host).forEach(b => b.addEventListener('click', () => ctx.switchTo && ctx.switchTo(b.dataset.sw)));
        ctx.sides = { A: { params: DEF(), nature: 'none' }, B: { params: DEF(), nature: 'none' } }; ctx.side = 'A';
        $$('[data-sw]', host).forEach(b => liveShape($('canvas', b), () => { const isRun = running && running.exp.id === 'discovery'; return { p: Object.assign({}, ctx.sides[b.dataset.sw].params, b.dataset.sw === 'B' && !isRun ? { colour: 0.7, warm: 0.3, moving: 0.35 } : {}, { nature: ctx.sides[b.dataset.sw].nature }), live: isRun ? ctx.side === b.dataset.sw : true, speed: isRun ? 1 : 0.6, scale: 0.42 }; }));   // before Start both forms breathe quietly (B previews a contrasting character) so the stage is never empty
        $$('[data-pick]', host).forEach(b => b.addEventListener('click', () => ctx.answer && ctx.answer(b.dataset.pick)));
      },
      async start(ctx) {
        safeMaster(); engine.stopAll(); await engine.init(); ctx.finished = false;
        const host = ctx.host; const rounds = ctx.s.rounds; let round = 0;
        const saved = profileParams();
        let best = { params: saved ? Object.assign({}, saved) : Object.assign(DEF(), { colour: 0.35, width: 0.35 }), nature: 'none' };
        const perturb = (b) => { const p = Object.assign({}, b.params); const n = 1 + (Math.random() < 0.4 ? 1 : 0); const dims = DIMS.slice().sort(() => Math.random() - 0.5).slice(0, n); for (const d of dims) { const [lo, hi] = DIM_RANGE[d]; const span = (hi - lo) * (round < 4 ? 0.45 : 0.25); p[d] = clamp(p[d] + (Math.random() * 2 - 1) * span, lo, hi); } let nature = b.nature; if (Math.random() < (round < 3 ? 0.5 : 0.25)) nature = NATURES[Math.floor(Math.random() * NATURES.length)]; return { params: p, nature }; };
        let cand = perturb(best); const sides = ctx.sides; sides.A = best; sides.B = cand;
        const prep = async () => { try { engine.setSculpt(sides.A.params, 'discoA'); engine.setSculpt(sides.B.params, 'discoB'); if (!engine.isActive('discoA')) await engine.startSound('discoA', 0.55); if (!engine.isActive('discoB')) await engine.startSound('discoB', 0.55); for (const n of NATURES) if (n !== 'none') { const want = sides.A.nature === n || sides.B.nature === n; if (!want && engine.isActive(n)) engine.stopSound(n); } for (const n of NATURES) if (n !== 'none') { const want = sides.A.nature === n || sides.B.nature === n; if (want && !engine.isActive(n)) await engine.startSound(n, 0.001); } await engine.playAll(); } catch (e) { console.error(e); app.toast('Sound could not start — try again or press Stop.'); } };
        ctx.switchTo = (s) => { ctx.side = s; $$('[data-sw]', host).forEach(b => { const on = b.dataset.sw === s; b.setAttribute('aria-pressed', on); }); engine.crossfade(s === 'A' ? 'discoB' : 'discoA', s === 'A' ? 'discoA' : 'discoB', 0.18); for (const n of NATURES) if (n !== 'none' && engine.isActive(n)) { if (sides[s].nature === n) engine.rampVolume(n, 0.35, 0.25); else engine.muteQuick(n); } };
        const show = () => { $('[data-progress]', host).innerHTML = Array.from({ length: rounds }, (_, i) => `<span class="${i < round ? 'done' : i === round ? 'now' : ''}"></span>`).join('') + `<em>Round ${round + 1} of ${rounds}</em>`; $('[data-hint]', host).textContent = 'Tap A and B to compare, then choose below. Comfortable = easy to listen to — the one you could leave on and forget about.'; $$('[data-sw],[data-pick]', host).forEach(b => b.disabled = false); };
        // Keep the A/B comparison on screen. iOS scrolls to keep the tapped button (Start,
        // or a pick) in view, and as the round re-renders that parks the viewport BELOW the
        // orbs — the user had to scroll back up to find A and B every time.
        const ensureAbVisible = () => {
          const el = $('.disc-wrap', host); if (!el) return;
          // measure the sticky header on THIS device — safe-area padding makes it much
          // taller on notched iPhones than any fixed offset would guess
          const tb = document.querySelector('.topbar');
          const off = (tb ? tb.getBoundingClientRect().height : 60) + 10;
          const r = el.getBoundingClientRect();
          if (r.top < off - 6 || r.top > innerHeight * 0.45) window.scrollTo({ top: scrollY + r.top - off, behavior: 'smooth' });
        };
        const next = async () => { sides.A = best; sides.B = cand; show(); await prep(); engine.muteQuick('discoB'); for (const n of NATURES) if (n !== 'none' && engine.isActive(n)) { if (sides.A.nature === n) engine.rampVolume(n, 0.35, 0.5); else engine.muteQuick(n); } ctx.switchTo('A'); show(); ensureAbVisible(); };
        // Brief, calm interstitial so a first-time user notices a new round began —
        // the tiny progress dot alone is easy to miss.
        const roundNote = () => { const el = $('[data-round]', host); if (!el) return; el.textContent = `Round ${round + 1} of ${rounds}`; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); e2 = setTimeout(() => el.classList.remove('show'), 1600); };
        let e2 = null;
        ctx.answer = (pick) => { const winner = pick === 'B' ? cand : best; if (pick !== 'same') learn(winner.params, winner.nature); best = pick === 'same' ? best : winner; round++; if (round >= rounds) { finish(); return; } cand = perturb(best); clearTimeout(e2); roundNote(); next(); };
        const finish = async () => {
          clearTimers(); ctx.result = best; ctx.finished = true; store.set('lab:discoveries', store.get('lab:discoveries', 0) + 1); sides.A = best; sides.B = best;
          // The comparison audio ends here, cleanly (the normal fade/teardown): the user
          // should never wonder what they are hearing. Nothing auto-starts — the next
          // sound begins only when they choose "Listen to Your Quiet".
          ['discoA', 'discoB', ...NATURES.filter(n => n !== 'none')].forEach(id => { if (engine.isActive(id)) engine.stopSound(id); });
          $('[data-hint]', host).textContent = '';
          renderProfile(); stopRunning(null, true); if (M()) { M().track('find_my_sound_completed'); M().track('sound_profile_created'); }
          showDiscoveryResult(ctx);
        };
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // stop iOS from anchoring the viewport to the Start button
        compactForRun(host.closest('.lab-detail'));
        await next();
      },
      stop(ctx) { (ctx && ctx.finished ? ['discoB'] : ['discoA', 'discoB']).forEach(id => engine.isActive(id) && engine.stopSound(id)); }, keepsSound: true,
    },
    {
      id: 'paint', name: 'Frequency Painting', cat: 'Discover', premium: true, evidence: 'exploratory', from: 'Spectral shaping / equalisation',
      what: 'Paint the sound you want to hear. Left is low, right is high; higher means stronger. What you draw is what you hear, immediately.',
      why: 'Everyone’s comfortable noise has a different shape — some want the lows, some an airy hiss, some a dip right where the tinnitus sits.',
      how: 'Press Start, then draw with a finger or mouse. Reduce lowers an area, Smooth softens bumps, Undo steps back, Randomize gives ideas.',
      whyTest: 'Spectral shaping is standard audio practice; what we are learning is whether drawing finds a comfortable sound faster than choosing noise colours. Preference is the only outcome.',
      custom: true, defaults: {},
      buildUI(ctx, host) {
        host.innerHTML = `<p class="muted" style="margin:0 0 8px">Paint the sound you want to hear. Left is low, right is high; higher means more.</p><canvas class="paint-canvas" width="900" height="300" aria-label="Frequency painting canvas. Draw to shape the sound."></canvas><div class="scale"><span>60 Hz</span><span>500</span><span>2k</span><span>6k</span><span>14 kHz</span></div>
          <div class="btn-row"><button class="btn btn-secondary btn-sm" data-act="paint" aria-pressed="true">Paint</button><button class="btn btn-ghost btn-sm" data-act="reduce" aria-pressed="false">Reduce</button><button class="btn btn-ghost btn-sm" data-act="smooth">Smooth</button><button class="btn btn-ghost btn-sm" data-act="undo">Undo</button><button class="btn btn-ghost btn-sm" data-act="reset">Reset</button><button class="btn btn-ghost btn-sm" data-act="random">Randomize</button><button class="btn btn-ghost btn-sm" data-act="preview">Preview</button><button class="btn btn-secondary btn-sm" data-act="save">Save</button><button class="btn btn-ghost btn-sm" data-act="compare" aria-pressed="false">Compare with my preferred sound</button></div>
          <details class="kbd-alt"><summary class="muted small">Adjust without dragging</summary><div class="kbd-grid">${[60, 120, 250, 500, 1000, 2000, 4000, 8000, 14000].map((f, i) => `<label>${f >= 1000 ? f / 1000 + 'k' : f}<input type="range" min="0" max="100" data-band="${Math.round(i * 23 / 8)}" aria-label="Band ${f} hertz"></label>`).join('')}</div></details><div data-saveform></div><div class="lab-saved" data-saved></div>`;
        const c = $('canvas', host), cx = c.getContext('2d'); ctx.curve = (store.get('lab:paintcurve') || new Array(24).fill(0.5)).slice(); ctx.hist = []; let mode = 'paint', down = false;
        const draw = () => { const w = c.width, h = c.height; const dark = document.documentElement.dataset.theme === 'dark'; const bg = cx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, dark ? '#0c1019' : '#f4f1ea'); bg.addColorStop(1, dark ? '#10151f' : '#e9e4da'); cx.fillStyle = bg; cx.fillRect(0, 0, w, h);
          cx.strokeStyle = dark ? 'rgba(200,215,230,.05)' : 'rgba(40,60,90,.05)'; cx.lineWidth = 1; for (let i = 1; i < 24; i++) { const x = w * Math.pow(i / 24, 1.3); cx.beginPath(); cx.moveTo(x, h * 0.3); cx.lineTo(x, h); cx.stroke(); }
          const pt = i => [i / 23 * w, h - 10 - ctx.curve[i] * (h - 24)]; cx.beginPath(); cx.moveTo(0, h); cx.lineTo(...pt(0)); for (let i = 0; i < 23; i++) { const [x0, y0] = pt(i), [x1, y1] = pt(i + 1); cx.bezierCurveTo(x0 + (x1 - x0) / 2, y0, x0 + (x1 - x0) / 2, y1, x1, y1); } cx.lineTo(w, h); cx.closePath();
          const g = cx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, dark ? 'rgba(205,165,120,0.42)' : 'rgba(150,105,65,0.4)'); g.addColorStop(0.5, dark ? 'rgba(195,170,190,0.38)' : 'rgba(140,100,130,0.36)'); g.addColorStop(1, dark ? 'rgba(150,185,215,0.42)' : 'rgba(70,115,150,0.4)'); cx.fillStyle = g; cx.fill(); cx.lineJoin = 'round'; cx.strokeStyle = dark ? 'rgba(255,245,230,.25)' : 'rgba(60,40,20,.18)'; cx.lineWidth = 9; cx.stroke(); cx.strokeStyle = dark ? 'rgba(255,248,238,.9)' : 'rgba(40,30,20,.75)'; cx.lineWidth = 1.6; cx.stroke();
          cx.fillStyle = dark ? 'rgba(238,240,244,.45)' : 'rgba(31,29,26,.5)'; cx.font = '500 11px Inter, sans-serif'; cx.fillText('LOW', 12, h - 14); cx.textAlign = 'right'; cx.fillText('HIGH', w - 12, h - 14); cx.textAlign = 'left';
          $$('[data-band]', host).forEach(r => { r.value = Math.round(ctx.curve[+r.dataset.band] * 100); app.paintRange(r); }); };
        const push = () => { ctx.hist.push(ctx.curve.slice()); if (ctx.hist.length > 30) ctx.hist.shift(); };
        const paint = ev => { const r = c.getBoundingClientRect(); const x = (ev.clientX - r.left) / r.width, y = 1 - (ev.clientY - r.top) / r.height; const i = clamp(Math.floor(x * 24), 0, 23); const v = mode === 'reduce' ? Math.max(0, ctx.curve[i] - 0.06) : clamp(y, 0, 1); ctx.curve[i] = v; if (i > 0) ctx.curve[i - 1] = (ctx.curve[i - 1] * 2 + v) / 3; if (i < 23) ctx.curve[i + 1] = (ctx.curve[i + 1] * 2 + v) / 3; draw(); engine.setPaint(ctx.curve); };
        c.addEventListener('pointerdown', e => { down = true; push(); c.setPointerCapture(e.pointerId); paint(e); }); c.addEventListener('pointermove', e => { if (down) paint(e); }); addEventListener('pointerup', () => { if (down) store.set('lab:paintcurve', ctx.curve); down = false; });
        $$('[data-band]', host).forEach(r => r.addEventListener('input', () => { ctx.curve[+r.dataset.band] = +r.value / 100; draw(); engine.setPaint(ctx.curve); store.set('lab:paintcurve', ctx.curve); }));
        $$('[data-act]', host).forEach(b => b.addEventListener('click', async () => { const a = b.dataset.act;
          if (a === 'paint' || a === 'reduce') { mode = a; $$('[data-act="paint"],[data-act="reduce"]', host).forEach(x => { const on = x.dataset.act === a; x.setAttribute('aria-pressed', on); x.classList.toggle('btn-secondary', on); x.classList.toggle('btn-ghost', !on); }); return; }
          if (a === 'smooth') { push(); ctx.curve = ctx.curve.map((v, i) => (ctx.curve[Math.max(0, i - 1)] + v * 2 + ctx.curve[Math.min(23, i + 1)]) / 4); }
          if (a === 'undo') { if (ctx.hist.length) ctx.curve = ctx.hist.pop(); }
          if (a === 'reset') { push(); ctx.curve = new Array(24).fill(0.5); }
          if (a === 'random') { push(); const k = 0.4 + Math.random() * 0.5, ph = Math.random() * 6; ctx.curve = ctx.curve.map((_, i) => clamp(0.5 + 0.4 * Math.sin(i * k + ph) + (Math.random() - 0.5) * 0.15, 0.05, 1)); }
          if (a === 'preview') { if (!engine.isActive('paint')) { safeMaster(); engine.setPaint(ctx.curve); await engine.startSound('paint', 0.6); await engine.playAll(); b.textContent = 'Stop preview'; } else { engine.stopSound('paint'); b.textContent = 'Preview'; } return; }
          if (a === 'save') { saveSoundForm($('[data-saveform]', host), { type: 'paint', curve: ctx.curve.slice(), name: 'My painted sound' }, renderSaved); return; }
          if (a === 'compare') { const pp = profileParams(); if (!pp) return app.toast('Use Help Me Find My Sound first to have a preferred sound to compare with.'); const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); b.textContent = on ? 'Back to my painting' : 'Compare with my preferred sound'; if (on) { if (!engine.isActive('sculpt')) { engine.setSculpt(pp, 'sculpt'); await engine.startSound('sculpt', 0.6); engine.muteQuick('sculpt'); } if (!engine.isActive('paint')) { engine.setPaint(ctx.curve); await engine.startSound('paint', 0.6); engine.muteQuick('paint'); } engine.crossfade('paint', 'sculpt', 0.25); } else engine.crossfade('sculpt', 'paint', 0.25); await engine.playAll(); return; }
          draw(); engine.setPaint(ctx.curve); store.set('lab:paintcurve', ctx.curve); }));
        const renderSaved = () => { const h = $('[data-saved]', host); h.innerHTML = ''; mySounds().filter(s => s.type === 'paint').forEach(p => { const bt = document.createElement('button'); bt.className = 'chip'; bt.innerHTML = `<strong>${p.name}</strong>`; bt.addEventListener('click', () => { push(); ctx.curve = p.curve.slice(); draw(); engine.setPaint(ctx.curve); }); h.appendChild(bt); }); };
        renderSaved(); draw();
      },
      async start(ctx) { safeMaster(); engine.setPaint(ctx.curve); engine.stopAll(); await engine.startSound('paint', 0.6); await engine.playAll(); if (M()) M().track('frequency_painting_used'); },
      stop() { if (engine.isActive('sculpt')) engine.stopSound('sculpt'); },
    },
    {
      id: 'sculptor', name: 'Sound Sculptor', cat: 'Discover', premium: true, evidence: 'exploratory', from: 'Music-production macro controls, translated to plain words',
      what: 'Shape a sound with plain words: Warm ↔ Bright, Deep ↔ Airy, Smooth ↔ Textured, Soft ↔ Crisp, Centred ↔ Wide, Still ↔ Moving, Simple ↔ Rich. Everything changes smoothly while you listen.',
      why: 'You should not need to know what a filter is to make a sound that suits you.',
      how: 'Press Start, pick a base (deep, balanced or bright), move the sliders slowly, add a nature texture if you like, then Save.',
      whyTest: 'An interface experiment: do plain-language controls help people reach a comfortable sound faster than technical ones? No clinical claim.',
      settings: [
        { key: 'colour', label: 'Base', type: 'buttons', options: [[0.1, 'Deep'], [0.45, 'Balanced'], [0.85, 'Bright']] },
        { key: 'warm', label: 'Warm ↔ Bright', ends: ['Warm', 'Bright'], type: 'range', min: -100, max: 100, fmt: v => v < -20 ? 'Warm' : v > 20 ? 'Bright' : 'Neutral' },
        { key: 'deep', label: 'Deep ↔ Airy', ends: ['Deep', 'Airy'], type: 'range', min: -100, max: 100, fmt: v => v < -20 ? 'Deep' : v > 20 ? 'Airy' : 'Neutral' },
        { key: 'smooth', label: 'Smooth ↔ Textured', ends: ['Smooth', 'Textured'], type: 'range', min: -100, max: 100, fmt: v => v < -20 ? 'Smooth' : v > 20 ? 'Textured' : 'Neutral' },
        { key: 'soft', label: 'Soft ↔ Crisp', ends: ['Soft', 'Crisp'], type: 'range', min: -100, max: 100, fmt: v => v < -20 ? 'Soft' : v > 20 ? 'Crisp' : 'Neutral' },
        { key: 'width', label: 'Centred ↔ Wide', ends: ['Centred', 'Wide'], type: 'range', min: 0, max: 100, fmt: v => v < 25 ? 'Centred' : v > 65 ? 'Wide' : 'Medium' },
        { key: 'moving', label: 'Still ↔ Moving', ends: ['Still', 'Moving'], type: 'range', min: 0, max: 100, fmt: v => v < 15 ? 'Still' : v < 60 ? 'Gently moving' : 'Moving' },
        { key: 'rich', label: 'Simple ↔ Rich', ends: ['Simple', 'Rich'], type: 'range', min: 0, max: 100, fmt: v => v < 25 ? 'Simple' : v > 65 ? 'Rich' : 'Medium' },
        { key: 'nature', label: 'Nature texture', type: 'select', options: NATURES.map(n => [n, n === 'none' ? 'None' : NAME(n)]) }],
      defaults: () => sculptSettingsFrom(profileParams() || DEF(), 'none'), custom: true, customFirst: true,
      buildUI(ctx, host) {
        host.innerHTML = `<div class="sculpt-shape"><canvas aria-hidden="true"></canvas></div><p class="muted" data-desc style="text-align:center"></p><div class="btn-row" style="justify-content:center"><button class="btn btn-ghost btn-sm" data-from-profile>Start from My Sound Profile</button><button class="btn btn-ghost btn-sm" data-random>Randomize</button><button class="btn btn-ghost btn-sm" data-zero>Reset to neutral</button><button class="btn btn-secondary btn-sm" data-save>Save this sound</button><button class="btn btn-ghost btn-sm" data-journey>Use in Adaptive Journey</button></div><div data-saveform></div>`;
        const reopen = (settings) => { store.set('lab:settings:sculptor', settings); delete ctxs.sculptor; const wasRunning = running && running.exp.id === 'sculptor'; openExperiment('sculptor'); if (wasRunning) { running = { exp: byId.sculptor, ctx: ctxFor(byId.sculptor) }; running.ctx.host = $('#lab-detail'); byId.sculptor.start(running.ctx); updateRunningUI(); } };
        liveShape($('.sculpt-shape canvas', host), () => ({ p: Object.assign({}, this.params(ctx), { nature: ctx.s.nature }), live: true, scale: 0.42 }));
        $('[data-from-profile]', host).addEventListener('click', () => { const pp = profileParams(); if (!pp) return app.toast('Use Help Me Find My Sound first — then your profile can be a starting point.'); reopen(sculptSettingsFrom(pp, profile().nature)); });
        $('[data-random]', host).addEventListener('click', () => { const r = () => Math.round((Math.random() * 2 - 1) * 70); reopen({ colour: [0.1, 0.45, 0.85][Math.floor(Math.random() * 3)], warm: r(), deep: r(), smooth: r(), soft: r(), width: Math.round(Math.random() * 100), moving: Math.round(Math.random() * 60), rich: Math.round(Math.random() * 80), nature: NATURES[Math.floor(Math.random() * NATURES.length)] }); });
        $('[data-zero]', host).addEventListener('click', () => reopen(sculptSettingsFrom(DEF(), 'none')));
        $('[data-save]', host).addEventListener('click', () => saveSoundForm($('[data-saveform]', host), { type: 'sculpt', params: this.params(ctx), nature: ctx.s.nature, natureVol: 0.35, name: 'My sculpted sound' }));
        $('[data-journey]', host).addEventListener('click', () => { const js = Object.assign({ len: 20, var: 'gentle', sleep: false }, store.get('lab:settings:journey') || {}, { bed: 'custom' }); store.set('lab:journey-bed', { params: this.params(ctx), nature: ctx.s.nature }); store.set('lab:settings:journey', js); delete ctxs.journey; if (running) stopRunning(); openExperiment('journey'); app.toast('Adaptive Journey will use your sculpted sound as its bed.'); });
        this.onSetting(ctx);
      },
      params(ctx) { const s = ctx.s; return { colour: +s.colour, warm: s.warm / 100, deep: s.deep / 100, smooth: s.smooth / 100, soft: s.soft / 100, width: s.width / 100, moving: s.moving / 100, rich: s.rich / 100, mod: 0 }; },
      async start(ctx) { safeMaster(); engine.setSculpt(this.params(ctx), 'sculpt'); await engine.loadMix(soundMix({ params: this.params(ctx), nature: ctx.s.nature, natureVol: 0.35 }, 0.6)); },
      async onSetting(ctx, key) { const p = this.params(ctx); engine.setSculpt(p, 'sculpt'); const d = $('[data-desc]', ctx.host || document); if (d) d.textContent = 'Now: ' + describe(p, ctx.s.nature); if (key === 'nature' && running && running.exp.id === 'sculptor') { for (const n of NATURES) if (n !== 'none' && engine.isActive(n) && n !== ctx.s.nature) engine.stopSound(n); if (ctx.s.nature !== 'none' && !engine.isActive(ctx.s.nature)) await engine.startSound(ctx.s.nature, 0.35); } },
      keepsSound: true,
    },
    // ---------- EXPLORE ----------
    {
      id: 'notched', name: 'Personalized Notched Sound', cat: 'Discover', evidence: 'mixed', from: 'Tailor-made notched music research (Okamoto 2010; Teismann 2011; Stein 2016)',
      what: 'Explore broadband sounds with a narrow range of frequencies reduced around your selected tinnitus pitch — a personalized “notch”. Switch between Normal and Notched at any time to hear the difference.',
      why: 'Research on notched sound has produced mixed results, and it has not been established as an effective treatment for tinnitus. Some studies have reported benefits for certain participants, while others have not found meaningful improvements.',
      how: 'Choose the pitch you hear (your saved sound match is offered if you have one), pick a broadband sound, press Start, then switch between NORMAL and NOTCHED. This feature is provided for personal sound exploration and tinnitus-management support — it does not diagnose, treat, or cure tinnitus.',
      guide: 'learn/notched-sound-for-tinnitus/',
      whyTest: 'Research on notched sound is genuinely mixed — positive early studies, a null large trial, and a Cochrane review that calls sound-therapy evidence low-quality overall. We present it as an experiment with honest evidence, and your optional feedback helps us understand comfort, never medical outcomes.',
      custom: true, customFirst: true, defaults: {},
      buildUI(ctx, host) {
        const C = NCFG();
        const saved = store.get('match');                          // from the Sound Matching tool
        const measures = store.get('notch:measures', []);
        const lastM = measures[measures.length - 1];
        ctx.n = ctx.n || { hz: lastM ? lastM.hz : (saved && saved.freq ? Math.round(saved.freq) : 0), where: lastM ? lastM.where : 'both', conf: lastM ? lastM.conf : '', accepted: !!lastM, source: 'pink', width: 'standard', depth: 'standard', buf: null };
        const N = ctx.n;
        const srcDefs = C.sources.filter(id => engine.def(id));
        host.innerHTML = `
          <div class="nx card lab-result">
            <h3 class="nx-t">1 · Find your tinnitus pitch</h3>
            ${saved && saved.freq ? `<p class="muted small">You matched a tone of <strong>${hzLabel(saved.freq)}</strong> in Sound Matching${saved.when ? ' (' + new Date(saved.when).toLocaleDateString() + ')' : ''}. <button class="linklike" data-nx="usesaved">Use it</button></p>` : `<p class="muted small">Tip: the <button class="linklike" data-nx="gomatch">Sound Matching</button> tool gives a careful guided match you can reuse here.</p>`}
            <div class="nx-pitch">
              <label class="small">Adjust the tone until it sounds approximately similar to the pitch you hear <output data-nx="hzout">${N.hz ? hzLabel(N.hz) : '—'}</output></label>
              <input type="range" min="0" max="1000" value="${N.hz ? Math.round(1000 * Math.log(N.hz / C.fcMin) / Math.log(C.fcMax / C.fcMin)) : 620}" data-nx="slider" aria-label="Tinnitus pitch">
              <div class="btn-row">
                <button class="btn btn-secondary btn-sm" data-nx="play">▶ Play tone</button>
                <button class="btn btn-ghost btn-sm" data-nx="fdn">−2%</button>
                <button class="btn btn-ghost btn-sm" data-nx="fup">+2%</button>
                <button class="btn btn-ghost btn-sm" data-nx="helper">Narrow it down for me</button>
              </div>
              <div class="nx-helper" data-nx="helperbox" hidden></div>
            </div>
            <div class="nx-meta">
              <span class="label-sm">Where do you hear it?</span>
              <div class="chips">${[['left', 'Left ear'], ['right', 'Right ear'], ['both', 'Both ears'], ['head', 'In my head']].map(([v, l]) => `<button class="chip chip-sm" data-nxw="${v}" aria-pressed="${N.where === v}">${l}</button>`).join('')}</div>
              <span class="label-sm">How confident is the match?</span>
              <div class="chips">${[['low', 'Not sure'], ['mid', 'Fairly confident'], ['high', 'Very confident']].map(([v, l]) => `<button class="chip chip-sm" data-nxc="${v}" aria-pressed="${N.conf === v}">${l}</button>`).join('')}</div>
              <p class="muted small">This is your personal estimate, not a clinical measurement or hearing test. It’s normal for it to drift a little between sessions.</p>
            </div>
            <div class="nx-confirm" data-nx="confirm" ${N.hz ? '' : 'hidden'}>
              <p class="nx-big">Your selected pitch: <strong data-nx="hzbig">${N.hz ? hzLabel(N.hz) : ''}</strong></p>
              <div class="btn-row"><button class="btn btn-primary btn-sm" data-nx="accept">${N.accepted ? '✓ Accepted' : 'Accept'}</button><button class="btn btn-ghost btn-sm" data-nx="retest">Test again</button></div>
              <p class="muted small" data-nx="hzwarn"></p>
            </div>
          </div>
          <div class="nx card lab-result">
            <h3 class="nx-t">2 · Choose your sound &amp; notch</h3>
            <p class="muted small" style="margin-top:0">Notched sound reduces a narrow frequency region around your selected pitch. You can switch between Normal and Notched at any time to hear the difference.</p>
            <span class="label-sm">Sound</span>
            <div class="chips" data-nx="sources">${srcDefs.map(id => `<button class="chip chip-sm" data-nxs="${id}" aria-pressed="${N.source === id}">${engine.def(id).name}</button>`).join('')}<button class="chip chip-sm" data-nxs="myaudio" aria-pressed="false">🎵 My own audio…</button></div>
            <p class="muted small" data-nx="srcnote">Broadband sounds (noise, rain, water) carry energy around most tinnitus pitches, so the notch has something to remove. Your own music works too if it has energy near your pitch — it is processed on this device only and never uploaded.</p>
            <input type="file" accept="audio/*" data-nx="file" hidden>
            <span class="label-sm">Notch width</span>
            <div class="chips">${Object.entries(C.widths).map(([k, w]) => `<button class="chip chip-sm" data-nxwidth="${k}" aria-pressed="${N.width === k}">${w.label}</button>`).join('')}</div>
            <span class="label-sm">Notch strength</span>
            <div class="chips">${Object.entries(C.depths).map(([k, d]) => `<button class="chip chip-sm" data-nxdepth="${k}" aria-pressed="${N.depth === k}">${d.label}</button>`).join('')}</div>
            <p class="muted small">Width and strength set how wide and how deep the reduced band is. A stronger or wider notch is not more effective.</p>
            <details class="nx-adv"><summary class="muted small">Advanced details</summary><div class="muted small" data-nx="adv"></div></details>
            <p class="muted small">Keep the volume at a low, comfortable level. Stop if the sound causes discomfort or seems to make your tinnitus worse.</p>
          </div>
          <div class="nx card lab-result" data-nx="live" hidden>
            <h3 class="nx-t">3 · Listen &amp; compare</h3>
            <div class="seg nx-ab" role="radiogroup" aria-label="Normal or notched">
              <button role="radio" aria-checked="false" data-nxab="off">NORMAL</button>
              <button role="radio" aria-checked="true" data-nxab="on">NOTCHED</button>
            </div>
            <p class="muted small" style="text-align:center">NORMAL plays the original sound. NOTCHED reduces frequencies around your selected pitch. Both play at the same level — switch as often as you like.</p>
            <div class="nx-viz"><canvas height="150" aria-label="Live audio spectrum with your notch region marked"></canvas><div class="nx-vizlab" data-nx="vizlab"></div></div>
            <p class="muted small" data-nx="suit"></p>
            <span class="label-sm">Sleep-style timer (optional)</span>
            <div class="chips" data-nx="timers">${C.timers.map(m => `<button class="chip chip-sm" data-nxt="${m}">${m} min</button>`).join('')}<button class="chip chip-sm" data-nxt="custom">Custom…</button></div>
            <div class="btn-row">
              <button class="btn btn-secondary btn-sm" data-nx="saveprof">Save this as a profile</button>
              <button class="btn btn-ghost btn-sm" data-nx="recal">Recalibrate pitch</button>
            </div>
          </div>
          <div class="nx card lab-result" data-nx="feedback" hidden></div>
          <div class="nx" data-nx="profiles"></div>
          <details class="lab-why nx-about"><summary>About notched sound &amp; the evidence</summary>
            <p>${C.evidence.plain}</p>
            <p><strong>What the studies found</strong> (evidence status: <strong>${C.evidence.tier}</strong>, reviewed ${C.evidence.updated}):</p>
            <ul class="bullets">${C.evidence.studies.map(s => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.ref}</a> — ${s.found}</li>`).join('')}</ul>
            <p><strong>Listening schedules used in research.</strong> ${C.evidence.protocols}</p>
            <p><strong>Limitations.</strong> ${C.evidence.limitations}</p>
            <p><strong>Hearing loss.</strong> If you have hearing loss near your tinnitus pitch, the notched region may already be hard to hear, so the effect of notching may feel different. This tool does not test hearing and never boosts frequencies to compensate.</p>
            <p><strong>Headphones.</strong> Headphones usually reproduce the frequency range more consistently than phone speakers, especially above a few kHz — but any comfortable listening setup is fine.</p>
            <p class="muted small">Loudness and distress are tracked separately throughout, because research treats them as different outcomes. Nothing here diagnoses, treats or cures tinnitus.</p>
          </details>`;
        NotchedUI.wire(ctx, host);
      },
      async start(ctx) { await NotchedUI.start(ctx); },
      onSetting() { },
      stop(ctx) { NotchedUI.stopped(ctx); },
    },
    {
      id: 'generative', name: 'Generative Sound', cat: 'Explore', premium: true, evidence: 'exploratory', from: 'Generative audio / procedural sound design',
      what: 'Sounds that subtly evolve instead of repeating — rain, ocean, wind, forest, an abstract ambience or broadband noise — with one Stable ↔ Organic control.',
      why: 'Real rain never sounds the same twice. Small variation feels more natural and may be easier to stop noticing over a long session.',
      how: 'Pick a base, press Start, then set how alive you want it. Changes are always subtle.',
      whyTest: 'Sound-therapy research mostly tests steady sound. We are learning where on the stable ↔ organic scale people with tinnitus feel most at ease. Evidence comes from ambient sound design, not clinical trials.',
      settings: [{ key: 'base', label: 'Base', type: 'buttons', options: [['rain', 'Rain'], ['ocean', 'Ocean'], ['wind', 'Wind'], ['forest', 'Forest'], ['abstract', 'Abstract ambience'], ['noise', 'Broadband noise']] }, { key: 'organic', label: 'Stable ↔ Organic', type: 'range', min: 0, max: 100, scale: ['Stable', 'Gently alive', 'Organic'], fmt: v => v < 15 ? 'Stable' : v < 50 ? 'Gently alive' : 'Organic' }],
      defaults: { base: 'rain', organic: 35 },
      async start(ctx) { safeMaster(); const b = ctx.s.base; const mix = b === 'abstract' ? [{ id: 'chimes', volume: 0.45 }, { id: 'brown', volume: 0.35 }] : b === 'noise' ? [{ id: 'sculpt', volume: 0.55, params: Object.assign(DEF(), { colour: 0.4, moving: 0.4, mod: 0.3 }) }] : [{ id: b, volume: 0.5 }, { id: 'brown', volume: 0.2 }]; await engine.loadMix(mix); engine.setVariation(ctx.s.organic / 100, 8 - ctx.s.organic / 25); },
      onSetting(ctx, key) { if (!running || running.exp.id !== 'generative') return; if (key === 'base') { this.start(ctx); return; } engine.setVariation(ctx.s.organic / 100, 8 - ctx.s.organic / 25); },
      stop() { engine.setVariation(0); }, keepsSound: true,
    },
    {
      id: 'morph', name: 'Sound Morph', cat: 'Explore', evidence: 'exploratory', from: 'Synthesiser design',
      what: 'One control that glides through a continuum — Brown → Brown/Pink → Pink → Pink/Rain → Rain. Stop anywhere.',
      why: 'Sometimes the comfortable spot is between two sounds.',
      how: 'Press Start, drag slowly, stop where it feels best, then Save.',
      whyTest: 'A usability idea, not a clinical concept: does one dimension find a comfortable blend faster than a mixer?',
      settings: [{ key: 'pos', label: 'Continuum', type: 'range', min: 0, max: 100, scale: ['Brown', 'Pink', 'Rain'], fmt: v => v < 12 ? 'Brown noise' : v < 38 ? 'Brown + pink' : v < 62 ? 'Pink noise' : v < 88 ? 'Pink + rain' : 'Rain' }],
      defaults: { pos: 25 }, custom: true,
      buildUI(ctx, host) { host.innerHTML = `<div class="btn-row"><button class="btn btn-secondary btn-sm" data-save>Save this blend</button></div>`; $('[data-save]', host).addEventListener('click', () => { const mixes = store.get('mixes', []); mixes.push({ name: 'Morph blend', mix: engine.snapshot().filter(m => m.volume > 0.01), master: engine.masterVolume }); store.set('mixes', mixes); app.renderPresetsRemount ? app.renderPresetsRemount() : (app.renderPresets && app.renderPresets()); app.toast('Saved to your mixes.'); }); },
      async start(ctx) { safeMaster(); engine.stopAll(); for (const id of ['brown', 'pink', 'rain']) await engine.startSound(id, 0.001); this.onSetting(ctx); await engine.playAll(); },
      onSetting(ctx) { if (!running || running.exp.id !== 'morph') return; const p = ctx.s.pos / 100; const tri = (c, w) => clamp(1 - Math.abs(p - c) / w, 0, 1); engine.setVolume('brown', 0.6 * tri(0, 0.5)); engine.setVolume('pink', 0.55 * tri(0.5, 0.5)); engine.setVolume('rain', 0.55 * tri(1, 0.5)); },
    },
    {
      id: 'space', name: 'Sound Space', cat: 'Explore', premium: true, evidence: 'exploratory', from: 'Spatial-audio and relaxation research',
      what: 'Place sounds around you on a simple map: rain to the left, ocean in front, brown noise centred, wind far to the right. Stationary by default, with optional very slow movement.',
      why: 'Space gives each sound its own place, so a mix feels less crowded — and a 2024 study found slow spatial movement more relaxing than static sound.',
      how: 'Press Start (a starter mix is provided if nothing is playing), then drag the dots. Far from centre is quieter and softer. Headphones recommended.',
      whyTest: 'Exploratory evidence from one controlled study on spatially moving sound. Movement is capped to a very slow drift.',
      settings: [{ key: 'move', label: 'Movement', type: 'buttons', options: [['off', 'Stationary'], ['slow', 'Very slow movement']] }],
      defaults: { move: 'off' }, custom: true,
      buildUI(ctx, host) {
        host.innerHTML = `<canvas class="spatial-map" width="520" height="360" aria-label="Sound space map. Drag a sound to place it around you."></canvas><p class="muted small">You are the dot in the middle. Drag a sound; far away is quieter and softer.</p><details class="kbd-alt"><summary class="muted small">Adjust without dragging</summary><div class="kbd-grid" data-alt></div></details>`;
        const c = $('canvas', host), cx = c.getContext('2d'); ctx.pos = store.get('lab:spatial', {}); let drag = null;
        const items = () => engine.activeList().map(s => ({ id: s.id, p: ctx.pos[s.id] || (ctx.pos[s.id] = { x: 0.5 + (Math.random() - 0.5) * 0.6, y: 0.5 + (Math.random() - 0.5) * 0.6 }) }));
        const applyOne = it => { const dx = it.p.x - 0.5, dy = it.p.y - 0.5; const dist = Math.min(1, Math.hypot(dx, dy) / 0.5); engine.setBalance(it.id, clamp(dx * 2, -1, 1)); engine.setCutoff(it.id, 20000 * Math.pow(0.08, dist * dist) + 500, 0.4); };
        const draw = () => { const w = c.width, h = c.height; const dark = document.documentElement.dataset.theme === 'dark'; const bg = cx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7); bg.addColorStop(0, dark ? '#131a2a' : '#f2efe8'); bg.addColorStop(1, dark ? '#0a0d15' : '#e2ddd2'); cx.fillStyle = bg; cx.fillRect(0, 0, w, h); for (const r of [0.48, 0.36, 0.24, 0.12]) { const g = cx.createRadialGradient(w / 2, h / 2, r * w * 0.5, w / 2, h / 2, r * w); g.addColorStop(0, dark ? 'rgba(160,190,210,0)' : 'rgba(60,90,120,0)'); g.addColorStop(1, dark ? 'rgba(160,190,210,0.07)' : 'rgba(60,90,120,0.08)'); cx.fillStyle = g; cx.beginPath(); cx.ellipse(w / 2, h / 2, r * w, r * w * 0.72, 0, 0, Math.PI * 2); cx.fill(); cx.strokeStyle = dark ? 'rgba(190,215,230,.16)' : 'rgba(40,70,100,.16)'; cx.lineWidth = 1; cx.stroke(); } cx.fillStyle = dark ? '#e8ecf7' : '#131a2e'; cx.beginPath(); cx.arc(w / 2, h / 2, 5, 0, Math.PI * 2); cx.fill(); cx.font = '500 11px Inter, sans-serif'; cx.textAlign = 'center'; cx.fillStyle = dark ? 'rgba(238,240,244,.55)' : 'rgba(31,29,26,.55)'; cx.fillText('front', w / 2, 16); cx.fillText('behind', w / 2, h - 8); cx.fillText('left', 22, h / 2); cx.fillText('right', w - 24, h / 2);
          items().forEach(it => { const d = engine.def(it.id); const x = it.p.x * w, y = it.p.y * h; const P = SF() && SF().personaFor(it.id); const tint = P ? (dark ? P.tint : P.light) : [180, 180, 200]; const dist = Math.min(1, Math.hypot(it.p.x - 0.5, it.p.y - 0.5) / 0.5); const R = 22 - dist * 8; const g = cx.createRadialGradient(x, y, 0, x, y, R * 2.2); g.addColorStop(0, rgba(tint, 0.45)); g.addColorStop(1, rgba(tint, 0)); cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, R * 2.2, 0, Math.PI * 2); cx.fill(); cx.fillStyle = rgba(mix3(tint, [255, 255, 255], dark ? 0.25 : 0), 0.9); cx.beginPath(); cx.arc(x, y, R * 0.55, 0, Math.PI * 2); cx.fill(); cx.strokeStyle = rgba(tint, 0.6); cx.lineWidth = 1; cx.beginPath(); cx.arc(x, y, R, 0, Math.PI * 2); cx.stroke(); cx.fillStyle = dark ? 'rgba(238,240,244,.85)' : 'rgba(31,29,26,.85)'; cx.font = '500 12px Inter, sans-serif'; cx.fillText(d.name, x, y + R + 16); }); };
        const drawAlt = () => { const alt = $('[data-alt]', host); alt.innerHTML = items().map(it => `<label>${engine.def(it.id).name}: left–right<input type="range" min="-100" max="100" value="${Math.round((it.p.x - 0.5) * 200)}" data-sx="${it.id}" aria-label="${engine.def(it.id).name} left to right"></label>`).join(''); $$('[data-sx]', alt).forEach(r => { app.paintRange(r); r.addEventListener('input', () => { ctx.pos[r.dataset.sx].x = 0.5 + r.value / 200; applyOne({ id: r.dataset.sx, p: ctx.pos[r.dataset.sx] }); draw(); store.set('lab:spatial', ctx.pos); }); }); };
        const pick = ev => { const r = c.getBoundingClientRect(); const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height; return items().find(it => Math.hypot(it.p.x - x, it.p.y - y) < 0.09); };
        c.addEventListener('pointerdown', e => { drag = pick(e); if (drag) c.setPointerCapture(e.pointerId); });
        c.addEventListener('pointermove', e => { if (!drag) return; const r = c.getBoundingClientRect(); drag.p.x = clamp((e.clientX - r.left) / r.width, 0.04, 0.96); drag.p.y = clamp((e.clientY - r.top) / r.height, 0.04, 0.96); applyOne(drag); draw(); });
        addEventListener('pointerup', () => { if (drag) { store.set('lab:spatial', ctx.pos); drawAlt(); } drag = null; });
        ctx.draw = draw; ctx.drawAlt = drawAlt; ctx.applyAll = () => items().forEach(applyOne); draw(); drawAlt(); spaceHook = () => { ctx.applyAll(); draw(); drawAlt(); };
      },
      async start(ctx) { safeMaster(); if (!engine.activeList().length) { ctx.pos.rain = ctx.pos.rain || { x: 0.2, y: 0.45 }; ctx.pos.ocean = ctx.pos.ocean || { x: 0.5, y: 0.18 }; ctx.pos.brown = ctx.pos.brown || { x: 0.5, y: 0.5 }; ctx.pos.wind = ctx.pos.wind || { x: 0.9, y: 0.4 }; await engine.loadMix([{ id: 'rain', volume: 0.4 }, { id: 'ocean', volume: 0.45 }, { id: 'brown', volume: 0.3 }, { id: 'wind', volume: 0.25 }]); } else await engine.playAll(); ctx.applyAll(); ctx.draw(); ctx.drawAlt(); this.onSetting(ctx); },
      onSetting(ctx) { clearTimers(); if (ctx.s.move === 'slow' && running && running.exp.id === 'space') every(() => { Object.values(ctx.pos).forEach(p => { const a = 0.003; const dx = p.x - 0.5, dy = p.y - 0.5; p.x = 0.5 + dx * Math.cos(a) - dy * Math.sin(a); p.y = 0.5 + dx * Math.sin(a) + dy * Math.cos(a); }); ctx.applyAll(); ctx.draw(); }, 250); },
      stop() { engine.activeList().forEach(s => { engine.setBalance(s.id, 0); engine.setCutoff(s.id, 20000, 0.5); }); }, keepsSound: true,
    },
    // ---------- FOCUS ----------
    {
      id: 'attention', name: 'Attention Focus', cat: 'Focus', evidence: 'promising', from: 'Attention-training research',
      what: 'Gentle visual activities that give your attention somewhere to rest: Follow the Light, Floating Bubble, Ripple, Notice the Change. No scores, no timers, no failing.',
      why: 'Practising where attention goes is the idea behind attention-training studies for tinnitus. This is the quietest possible version.',
      how: 'Pick an activity and press Start. Focus Mode opens; exit whenever you like.',
      whyTest: 'A randomised trial of an attention-training game reduced tinnitus distress more than a control game; small multisensory-training trials showed modest effects. We removed every stressful element. Promising for distress, no claim about loudness.',
      settings: [{ key: 'act', label: 'Activity', type: 'buttons', options: [['followlight', 'Follow the Light'], ['bubble', 'Floating Bubble'], ['touchwater', 'Ripple'], ['noticechange', 'Notice the Change']] }, { key: 'sync', label: 'Let the sound follow the light (Follow the Light only)', type: 'toggle' }],
      defaults: { act: 'followlight', sync: true },
      async start(ctx) { safeMaster(); if (!engine.activeList().length) await engine.startSound('pink', 0.4); if (ctx.s.act === 'followlight' && ctx.s.sync) { focus.setParam('target', 'light'); focus.setParam('sync', true); focus.setVisual('target'); } else focus.setVisual(ctx.s.act); focus.setParam('soundTouch', ctx.s.act === 'touchwater'); focus.enterFocus(); },
      stop() { engine.resetMasterShape(); focus.setParam('soundTouch', false); }, keepsSound: true,
    },
    {
      id: 'svjourney', name: 'Sound + Visual Journey', cat: 'Focus', premium: true, evidence: 'promising', from: 'VR relaxation research (audio-visual coherence)',
      what: 'Sound and picture evolve together over 20–40 minutes: Ocean to Night, Rain to Sleep, or Forest Evening. Visuals cross-fade, the sound shifts gradually, and it ends soft.',
      why: 'Studies of virtual nature find audio and visuals together relax more than either alone. A journey also gives a session a natural ending.',
      how: 'Choose a journey and a length, press Start. Focus Mode opens and runs it; exit any time.',
      whyTest: 'Audio-visual coherence improves relaxation in lab studies; we are testing a slow, screen-based version. Relaxation only — no claim about tinnitus itself.',
      settings: [{ key: 'j', label: 'Journey', type: 'buttons', options: [['ocean', 'Ocean to Night'], ['rain', 'Rain to Sleep'], ['forest', 'Forest Evening']] }, { key: 'len', label: 'Length', type: 'buttons', options: [[20, '20 min'], [30, '30 min'], [40, '40 min']] }, { key: 'fade', label: 'Fade out at the end', type: 'toggle' }],
      defaults: { j: 'ocean', len: 30, fade: false }, custom: true, customFirst: true,
      buildUI(ctx, host) { host.innerHTML = '<div data-timeline></div>'; const plans = { ocean: ['daylight ocean', 'sunset', 'darker ocean', 'night sky', 'stars'], rain: ['rain on the window', 'dimmer room', 'slower rain', 'softer sound', 'rest'], forest: ['forest', 'sunset', 'evening', 'night ambience', 'stillness'] }; timeline($('[data-timeline]', host), plans[ctx.s.j] || plans.ocean, ctx.s.len); },
      onSetting(ctx) { if (ctx.host) this.buildUI(ctx, $('[data-custom]', ctx.host)); },
      start(ctx) {
        safeMaster(); const u = ctx.s.len / 5;
        const J = {
          ocean: [{ min: u, label: 'daylight ocean', visual: 'ocean', time: 0.05, dim: 0, slow: 0, mix: [{ id: 'ocean', volume: 0.6 }, { id: 'brown', volume: 0.2 }] }, { min: u, label: 'sunset', visual: 'ocean', time: 0.5, mix: [{ id: 'ocean', volume: 0.55 }, { id: 'brown', volume: 0.3 }], tone: 9000 }, { min: u, label: 'darker ocean', visual: 'ocean', time: 0.85, slow: 0.3, mix: [{ id: 'ocean', volume: 0.45 }, { id: 'brown', volume: 0.35 }], tone: 6000 }, { min: u, label: 'night sky', visual: 'ocean', time: 1, slow: 0.5, mix: [{ id: 'ocean', volume: 0.3 }, { id: 'brown', volume: 0.35 }, { id: 'night', volume: 0.2 }], tone: 5000 }, { min: u, label: 'stars', visual: 'nightsky', slow: 0.6, dim: 0.1, mix: [{ id: 'brown', volume: 0.3 }, { id: 'night', volume: 0.15 }], tone: 4000 }],
          rain: [{ min: u, label: 'rain on the window', visual: 'rainwindow', dim: 0, slow: 0, mix: [{ id: 'rain', volume: 0.55 }, { id: 'pink', volume: 0.2 }] }, { min: u, label: 'dimmer room', visual: 'rainwindow', dim: 0.3, mix: [{ id: 'rain', volume: 0.5 }, { id: 'brown', volume: 0.25 }], tone: 8000 }, { min: u, label: 'slower rain', visual: 'rainwindow', dim: 0.45, slow: 0.5, mix: [{ id: 'rain', volume: 0.3 }, { id: 'brown', volume: 0.35 }], tone: 6000 }, { min: u, label: 'softer sound', visual: 'rainwindow', dim: 0.6, slow: 0.7, mix: [{ id: 'brown', volume: 0.4 }, { id: 'rain', volume: 0.12 }], tone: 5000 }, { min: u, label: 'night', visual: 'nightsky', dim: 0.2, slow: 0.6, mix: [{ id: 'brown', volume: 0.3 }], tone: 4000 }],
          forest: [{ min: u, label: 'forest', visual: 'forest', dim: 0, slow: 0, mix: [{ id: 'forest', volume: 0.55 }, { id: 'pink', volume: 0.2 }] }, { min: u, label: 'sunset', visual: 'forest', dim: 0.2, mix: [{ id: 'forest', volume: 0.45 }, { id: 'wind', volume: 0.3 }], tone: 9000 }, { min: u, label: 'evening', visual: 'forest', dim: 0.45, slow: 0.4, mix: [{ id: 'wind', volume: 0.35 }, { id: 'brown', volume: 0.25 }], tone: 6000 }, { min: u, label: 'night ambience', visual: 'nightsky', dim: 0.1, slow: 0.5, mix: [{ id: 'night', volume: 0.35 }, { id: 'brown', volume: 0.3 }], tone: 5000 }, { min: u, label: 'softer', visual: 'nightsky', dim: 0.25, slow: 0.7, mix: [{ id: 'brown', volume: 0.3 }, { id: 'night', volume: 0.15 }], tone: 4000 }],
        }[ctx.s.j];
        focus.setParam('dim', 0); focus.setParam('slow', 0); focus.setParam('time', ctx.s.j === 'ocean' ? 0.05 : 0.5); focus.setVisual(J[0].visual); focus.enterFocus();
        runJourney(J, { crossfade: Math.min(120, u * 25), visuals: true, onEnd: () => { if (ctx.s.fade) { engine.setTimer(0.1, true); app.toast('Fading out. Rest well.'); } else app.toast('Journey finished — the last sound stays on.'); stopRunning(null, true); } });
      },
      stop() { engine.resetMasterShape(); focus.setParam('dim', 0); focus.setParam('slow', 0); focus.setParam('time', 0.5); }, keepsSound: true,
    },
    // ---------- SESSIONS ----------
    {
      id: 'journey', name: 'Adaptive Sound Journey', cat: 'Sessions', premium: true, evidence: 'exploratory', from: 'Generative audio / habituation research',
      what: 'A soundscape that evolves very slowly: brown noise + rain → less rain → ocean appears → the sound warms → it simplifies → optional fade toward sleep.',
      why: 'A loop becomes familiar and easy for the brain to set aside — which can let tinnitus back in. Slow change keeps sound gently interesting without asking for attention.',
      how: 'Pick a length and how much change you want, press Start. Transitions take a minute or more. Never sudden.',
      whyTest: 'Sound-therapy research mostly uses steady sound; we are checking whether a slowly evolving environment feels more comfortable over a long session. No direct trials yet.',
      settings: [{ key: 'bed', label: 'Sound bed', type: 'buttons', options: [['brown', 'Brown noise'], ['profile', 'From My Sound Profile'], ['custom', 'My sculpted sound']] }, { key: 'len', label: 'Length', type: 'buttons', options: [[10, '10 min'], [20, '20 min'], [30, '30 min'], [60, '60 min'], [0, 'Continuous']] }, { key: 'var', label: 'Variation', type: 'buttons', options: [['stable', 'Very stable'], ['gentle', 'Gentle changes'], ['dynamic', 'More dynamic']] }, { key: 'sleep', label: 'Fade toward sleep at the end', type: 'toggle' }],
      defaults: { bed: 'brown', len: 20, var: 'gentle', sleep: false }, custom: true, customFirst: true,
      buildUI(ctx, host) { host.innerHTML = '<div data-timeline></div>'; const bedName = ctx.s.bed === 'profile' ? 'your sound' : ctx.s.bed === 'custom' ? 'your sculpted sound' : 'brown noise'; timeline($('[data-timeline]', host), [`${bedName} + rain`, 'less rain', 'ocean appears', 'warmer', ctx.s.sleep ? 'simpler, fading' : 'simpler'], ctx.s.len || 60); },
      onSetting(ctx) { if (ctx.host) this.buildUI(ctx, $('[data-custom]', ctx.host)); },
      start(ctx) {
        safeMaster(); const L = ctx.s.len || 60; const u = L / 5; const k = ctx.s.var === 'stable' ? 0.4 : ctx.s.var === 'dynamic' ? 1.3 : 1;
        let bed = { id: 'brown' }; let bedName = 'brown noise';
        if (ctx.s.bed === 'profile') { const pp = profileParams(); if (pp) { bed = { id: 'sculpt', params: pp }; bedName = 'your sound'; } else app.toast('No profile yet — using brown noise.'); }
        if (ctx.s.bed === 'custom') { const c = store.get('lab:journey-bed'); if (c) { bed = { id: 'sculpt', params: c.params }; bedName = 'your sculpted sound'; } else app.toast('No sculpted sound yet — using brown noise.'); }
        const B = (v) => Object.assign({ volume: v }, bed);
        const segs = [
          { min: u, label: `${bedName} + rain`, mix: [B(0.55), { id: 'rain', volume: 0.35 * k }] },
          { min: u, label: 'less rain', mix: [B(0.55), { id: 'rain', volume: 0.15 * k }] },
          { min: u, label: 'ocean appears', mix: [B(0.45), { id: 'ocean', volume: 0.4 * k }, { id: 'rain', volume: 0.05 }] },
          { min: u, label: 'warmer', mix: [B(0.5), { id: 'ocean', volume: 0.3 * k }], tone: 6000 },
          { min: u, label: 'simpler', mix: [B(ctx.s.sleep ? 0.3 : 0.45), { id: 'ocean', volume: 0.12 * k }], tone: 5000 },
        ];
        runJourney(segs, { crossfade: Math.min(120, u * 30), loop: !ctx.s.len, onEnd: () => { if (ctx.s.sleep) { engine.setTimer(0.1, true); app.toast('Fading toward sleep.'); } stopRunning(null, true); } });
      },
      stop() { engine.resetMasterShape(); },
    },
    {
      id: 'session', name: 'Build My Session', cat: 'Sessions', evidence: 'exploratory', from: 'Product design',
      what: 'Four quick questions — what you are doing, what sound you prefer, visuals or not, how much variation — and a session is built for you.',
      why: 'When you are tired or busy you should not have to design anything.',
      how: 'Answer and press Start. Everything can be changed afterwards. This is a suggestion, not a recommendation about your health.',
      whyTest: 'A convenience experiment: we want to know whether a built session is used longer than a hand-picked sound.',
      settings: [{ key: 'doing', label: 'What are you doing?', type: 'buttons', options: [['sleep', 'Sleeping'], ['relax', 'Relaxing'], ['work', 'Working'], ['read', 'Reading'], ['quiet', 'Quiet time']] }, { key: 'pref', label: 'What sound do you prefer?', type: 'buttons', options: [['deep', 'Deep'], ['soft', 'Soft'], ['nature', 'Nature'], ['bright', 'Bright'], ['unsure', 'Not sure']] }, { key: 'vis', label: 'Visuals?', type: 'buttons', options: [['yes', 'Yes'], ['no', 'No'], ['surprise', 'Surprise me']] }, { key: 'var', label: 'How much variation?', type: 'buttons', options: [['stable', 'Stable'], ['some', 'Some movement'], ['explore', 'Exploratory']] }],
      defaults: { doing: 'relax', pref: 'unsure', vis: 'yes', var: 'some' }, custom: true,
      customFirst: true,
      buildUI(ctx, host) {
        const Q = this.settings; let step = 0; const answered = {};
        const render = () => { const q = Q[step]; if (!q) { host.innerHTML = `<div class="sess-wrap"><div class="sess-summary">${Q.map(s => `<button class="chip" data-edit="${s.key}"><strong>${(s.options.find(o => String(o[0]) === String(ctx.s[s.key])) || [])[1] || ''}</strong><span>${s.label.replace('?', '')}</span></button>`).join('')}</div><p class="muted small" style="text-align:center">Press <strong>Start Experiment</strong> to build it. Everything can be changed afterwards.</p><div class="btn-row" style="justify-content:center"><button class="btn btn-secondary btn-sm" data-save-session>Save this session</button></div></div>`; $$('[data-edit]', host).forEach(b => b.addEventListener('click', () => { step = Q.findIndex(s => s.key === b.dataset.edit); render(); })); $('[data-save-session]', host).addEventListener('click', saveSession); return; }
          host.innerHTML = `<div class="sess-wrap"><div class="sess-progress">${Q.map((_, i) => `<span class="${i < step ? 'done' : i === step ? 'now' : ''}"></span>`).join('')}</div><h3 class="sess-q">${q.label}</h3><div class="sess-options" role="radiogroup" aria-label="${q.label}">${q.options.map(o => `<button role="radio" aria-checked="${String(ctx.s[q.key]) === String(o[0])}" class="sess-opt" data-v="${o[0]}">${o[1]}</button>`).join('')}</div>${step > 0 ? '<button class="btn btn-ghost btn-sm" data-back>← Back</button>' : ''}</div>`;
          $$('.sess-opt', host).forEach(b => b.addEventListener('click', () => { ctx.s[q.key] = (b.dataset.v !== '' && !isNaN(+b.dataset.v)) ? +b.dataset.v : b.dataset.v; step++; render(); })); const bk = $('[data-back]', host); if (bk) bk.addEventListener('click', () => { step--; render(); }); };
        const saveSession = () => { if (!engine.activeList().length) return app.toast('Start the session first, then save it.'); if (!canSaveCombo()) return; const combos = store.get('combos', []); combos.push({ name: `My ${ctx.s.doing} session`, mix: engine.snapshot(), master: engine.masterVolume, visual: store.get('visual', 'ocean'), motion: store.get('motion', 'low'), timer: ctx.s.doing === 'sleep' ? 60 : 0 }); store.set('combos', combos); app.toast('Session saved (Visual Focus → My Saved Environments).'); };
        render();
      },
      buildUIOld(ctx, host) { host.innerHTML = `<div class="btn-row"><button class="btn btn-secondary btn-sm" data-save-session>Save this session</button></div>`; $('[data-save-session]', host).addEventListener('click', () => { if (!engine.activeList().length) return app.toast('Start the session first, then save it.'); const combos = store.get('combos', []); combos.push({ name: `My ${ctx.s.doing} session`, mix: engine.snapshot(), master: engine.masterVolume, visual: store.get('visual', 'ocean'), motion: store.get('motion', 'low'), timer: engine.timer.durationMin || 0 }); store.set('combos', combos); app.toast('Saved — find it under My experiences in Visual Focus.'); }); },
      async start(ctx) {
        safeMaster(); const s = ctx.s; const pp = profileParams();
        const params = pp ? Object.assign({}, pp) : DEF();
        if (s.pref === 'deep') Object.assign(params, { colour: 0.1, deep: -0.4, warm: -0.3 }); if (s.pref === 'soft') Object.assign(params, { colour: 0.4, soft: -0.6, warm: -0.2 }); if (s.pref === 'bright') Object.assign(params, { colour: 0.8, warm: 0.3 }); if (s.pref === 'nature') Object.assign(params, { colour: 0.4 });
        params.moving = s.var === 'stable' ? 0 : s.var === 'some' ? 0.3 : 0.6; params.mod = s.var === 'explore' ? 0.3 : 0;
        const nature = s.pref === 'nature' ? (s.doing === 'sleep' ? 'rain' : s.doing === 'work' ? 'forest' : 'ocean') : (s.doing === 'sleep' ? 'rain' : 'none');
        await engine.loadMix(soundMix({ params, nature, natureVol: 0.3 }, s.doing === 'sleep' ? 0.45 : 0.55));
        if (s.var === 'explore') engine.setVariation(0.45, 7);
        if (s.doing === 'sleep') engine.setTimer(60, true);
        if (s.vis !== 'no') { const v = s.vis === 'surprise' ? VISUALS[Math.floor(Math.random() * VISUALS.length)].id : s.doing === 'sleep' ? 'nightsky' : nature === 'rain' ? 'rainwindow' : nature === 'ocean' ? 'ocean' : nature === 'forest' ? 'forest' : visualForProfile(); focus.setVisual(v); focus.enterFocus(); } else if (s.doing === 'sleep') app.showView('sleep');
        app.toast(s.doing === 'sleep' ? 'Sleep session: 60-minute timer with gentle fade.' : 'Session ready — adjust anything you like.');
      },
      stop() { engine.setVariation(0); engine.resetMasterShape(); }, keepsSound: true,
    },
  ];
  const byId = Object.fromEntries(EXPERIMENTS.map(e => [e.id, e]));
  // ===== Personalized Notched Sound: controller =====
  const NotchedUI = (() => {
    const notchDesign = (f, w, d) => window.SoftwaveAudio.Engine.notchDesign(f, w, d);
    const sHz = (v) => { const c = NCFG(); return Math.round(c.fcMin * Math.pow(c.fcMax / c.fcMin, v / 1000)); };
    const hzS = (hz) => { const c = NCFG(); return Math.round(1000 * Math.log(hz / c.fcMin) / Math.log(c.fcMax / c.fcMin)); };
    let sessionStart = 0, vizRaf = 0, vizVisible = true, timerHooked = false;
    const runningThis = () => running && running.exp.id === 'notched';
    async function playTone(hz, ms = 900) {
      try {
        await engine.init(); const ac = engine.ctx; if (!ac) return;
        const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = hz;
        const g = ac.createGain(); const t = ac.currentTime;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.05);
        g.gain.setValueAtTime(0.06, t + ms / 1000 - 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
        o.connect(g); g.connect(ac.destination);   // matching tones bypass the notch on purpose
        o.start(t); o.stop(t + ms / 1000 + 0.05);
      } catch (_) { }
    }
    function widthOct(N) { return NCFG().widths[N.width].oct; }
    function depthDb(N) { return NCFG().depths[N.depth].db; }
    function wire(ctx, host) {
      const N = ctx.n, C = NCFG();
      const q = (s) => $(s, host), qq = (s) => $$(s, host);
      const el = ctx.nEl = {
        out: q('[data-nx="hzout"]'), slider: q('[data-nx="slider"]'), confirm: q('[data-nx="confirm"]'),
        hzbig: q('[data-nx="hzbig"]'), hzwarn: q('[data-nx="hzwarn"]'), accept: q('[data-nx="accept"]'),
        adv: q('[data-nx="adv"]'), live: q('[data-nx="live"]'), suit: q('[data-nx="suit"]'),
        viz: q('.nx-viz canvas'), vizlab: q('[data-nx="vizlab"]'), feedback: q('[data-nx="feedback"]'),
        profiles: q('[data-nx="profiles"]'), file: q('[data-nx="file"]'), helperbox: q('[data-nx="helperbox"]'),
      };
      const setHz = (hz, fromSlider) => {
        hz = Math.round(Math.min(Math.max(hz, C.fcMin), C.fcMax));
        N.hz = hz; el.out.textContent = hzLabel(hz);
        if (!fromSlider) el.slider.value = hzS(hz);
        el.confirm.hidden = false; el.hzbig.textContent = hzLabel(hz);
        let warn = '';
        if (hz > C.researchHz) warn += 'Research note: notched-sound studies found effects mainly for tinnitus pitches up to 8 kHz — above that, benefits were not supported (the music simply has little energy up there). ';
        if (hz > C.hardwareHz) warn += 'Very high-frequency pitch matching and notching may also be less accurate, because headphones and speakers differ in how well they reproduce high frequencies.';
        el.hzwarn.textContent = warn;
        updateAdv(); if (runningThis()) applyNotch(ctx);
      };
      const updateAdv = () => {
        if (!N.hz) { el.adv.textContent = 'Set a pitch first.'; return; }
        const w = widthOct(N), d = depthDb(N);
        const lo = N.hz * Math.pow(2, -w / 2), hi = N.hz * Math.pow(2, w / 2);
        const des = notchDesign(N.hz, w, d);
        el.adv.innerHTML = `Centre ${hzLabel(N.hz)} · band ${hzLabel(lo)} – ${hzLabel(hi)} (${w} octave${w === 1 ? '' : 's'}) · target depth −${d} dB at centre. The Standard width corresponds to the 1-octave band used in the published studies; Gentle/Standard/Strong are −12/−24/−36 dB at the centre.<br>` +
          `Three cascaded peaking cuts: ${des.map(p => `${Math.round(p.f)} Hz (Q ${p.Q.toFixed(1)}, ${p.g.toFixed(1)} dB)`).join(' · ')}.<br>` +
          `Measured response: centre within 0.8 dB of target, band edges ≈ −10 dB, outside the band flat within ~1 dB. All processing runs on this device.`;
      };
      el.slider.addEventListener('input', () => setHz(sHz(+el.slider.value), true));
      q('[data-nx="play"]').addEventListener('click', () => { if (N.hz) playTone(N.hz); });
      q('[data-nx="fdn"]').addEventListener('click', () => { if (N.hz) { setHz(N.hz * 0.98); playTone(N.hz); } });
      q('[data-nx="fup"]').addEventListener('click', () => { if (N.hz) { setHz(N.hz * 1.02); playTone(N.hz); } });
      const us = q('[data-nx="usesaved"]'); if (us) us.addEventListener('click', () => { const m = store.get('match'); if (m && m.freq) { setHz(m.freq); app.toast('Using your saved sound-match pitch. Fine-tune it if it has drifted.'); } });
      const gm = q('[data-nx="gomatch"]'); if (gm) gm.addEventListener('click', () => app.showView('match'));
      // progressive narrowing helper: two tones, pick the closer, range halves each round
      q('[data-nx="helper"]').addEventListener('click', () => {
        const st = { hz: N.hz || 4000, delta: 0.5, round: 1 };
        const render = () => {
          const a = Math.round(st.hz * Math.pow(2, -st.delta / 2)), b = Math.round(st.hz * Math.pow(2, st.delta / 2));
          el.helperbox.hidden = false;
          el.helperbox.innerHTML = `<p class="muted small" style="margin-top:0">This assistant helps you compare tones — it does not measure your tinnitus.</p>
            <p class="small">Round ${st.round}: which tone sounds closer to the pitch you hear?</p>
            <div class="btn-row"><button class="btn btn-secondary btn-sm" data-h="pa">▶ Tone A</button><button class="btn btn-secondary btn-sm" data-h="pb">▶ Tone B</button></div>
            <div class="btn-row"><button class="btn btn-ghost btn-sm" data-h="a">A is closer</button><button class="btn btn-ghost btn-sm" data-h="same">Can’t tell</button><button class="btn btn-ghost btn-sm" data-h="b">B is closer</button></div>`;
          $('[data-h="pa"]', el.helperbox).addEventListener('click', () => playTone(a));
          $('[data-h="pb"]', el.helperbox).addEventListener('click', () => playTone(b));
          const step = (dir) => {
            if (dir) st.hz = st.hz * Math.pow(2, (dir === 'b' ? 1 : -1) * st.delta / 4);
            st.delta *= 0.6; st.round++;
            if (st.delta < 0.1 || st.round > 6) { el.helperbox.innerHTML = '<p class="small">Done — pitch set below. Fine-tune with −2% / +2% if needed.</p>'; setHz(st.hz); return; }
            render();
          };
          $('[data-h="a"]', el.helperbox).addEventListener('click', () => step('a'));
          $('[data-h="b"]', el.helperbox).addEventListener('click', () => step('b'));
          $('[data-h="same"]', el.helperbox).addEventListener('click', () => step(null));
        };
        render();
      });
      qq('[data-nxw]').forEach(b => b.addEventListener('click', () => { N.where = b.dataset.nxw; qq('[data-nxw]').forEach(x => x.setAttribute('aria-pressed', x === b)); }));
      qq('[data-nxc]').forEach(b => b.addEventListener('click', () => { N.conf = b.dataset.nxc; qq('[data-nxc]').forEach(x => x.setAttribute('aria-pressed', x === b)); }));
      el.accept.addEventListener('click', () => {
        if (!N.hz) return; N.accepted = true; el.accept.textContent = '✓ Accepted';
        const ms = store.get('notch:measures', []);   // append-only history — never overwrite old measurements
        ms.push({ hz: N.hz, where: N.where, conf: N.conf, date: new Date().toISOString() });
        store.set('notch:measures', ms);
        app.toast('Pitch saved. Choose your sound in step 2, then press Start Experiment.');
      });
      q('[data-nx="retest"]').addEventListener('click', () => { N.accepted = false; el.accept.textContent = 'Accept'; el.helperbox.hidden = true; app.toast('Adjust the tone, or use “Narrow it down for me”.'); });
      qq('[data-nxs]').forEach(b => b.addEventListener('click', async () => {
        if (b.dataset.nxs === 'myaudio') { el.file.click(); return; }
        N.source = b.dataset.nxs; qq('[data-nxs]').forEach(x => x.setAttribute('aria-pressed', x === b));
        if (runningThis()) { await engine.loadMix([{ id: N.source, volume: 0.55 }]); applyNotch(ctx); setTimeout(() => suitability(ctx), 1200); }
      }));
      el.file.addEventListener('change', async () => {
        const f = el.file.files && el.file.files[0]; if (!f) return;
        if (f.size > 30 * 1024 * 1024) { app.toast('That file is over 30 MB — please choose a shorter track.', 4000); return; }
        try {
          await engine.init();
          const buf = await engine.ctx.decodeAudioData(await f.arrayBuffer());
          if (buf.duration > 20 * 60) { app.toast('Tracks up to 20 minutes are supported.', 4000); return; }
          N.buf = buf; N.source = 'myaudio';
          qq('[data-nxs]').forEach(x => x.setAttribute('aria-pressed', x.dataset.nxs === 'myaudio'));
          const chip = qq('[data-nxs]').find(x => x.dataset.nxs === 'myaudio'); if (chip) chip.textContent = '🎵 ' + (f.name.length > 26 ? f.name.slice(0, 24) + '…' : f.name);
          app.toast('Loaded. Your audio is processed on this device only — it is never uploaded.', 4200);
          if (runningThis()) startSource(ctx).then(() => { applyNotch(ctx); setTimeout(() => suitability(ctx), 1200); });
        } catch (_) { app.toast('Could not read that audio file.', 4000); }
      });
      qq('[data-nxwidth]').forEach(b => b.addEventListener('click', () => { N.width = b.dataset.nxwidth; qq('[data-nxwidth]').forEach(x => x.setAttribute('aria-pressed', x === b)); updateAdv(); if (runningThis()) applyNotch(ctx); }));
      qq('[data-nxdepth]').forEach(b => b.addEventListener('click', () => { N.depth = b.dataset.nxdepth; qq('[data-nxdepth]').forEach(x => x.setAttribute('aria-pressed', x === b)); updateAdv(); if (runningThis()) applyNotch(ctx); }));
      qq('[data-nxab]').forEach(b => b.addEventListener('click', () => {
        const on = b.dataset.nxab === 'on'; N.abOn = on; engine.notchEnable(on);
        qq('[data-nxab]').forEach(x => x.setAttribute('aria-checked', (x.dataset.nxab === 'on') === on));
      }));
      qq('[data-nxt]').forEach(b => b.addEventListener('click', () => {
        let m = b.dataset.nxt === 'custom' ? parseInt(prompt('Timer length in minutes (5–180):', '45'), 10) : +b.dataset.nxt;
        if (!m || m < 5 || m > 180) return;
        engine.setTimer(m, true); qq('[data-nxt]').forEach(x => x.classList.toggle('active', x === b));
        app.toast(`Timer set: ${m} minutes with gentle fade. No particular duration is a medical recommendation.`, 4200);
      }));
      q('[data-nx="saveprof"]').addEventListener('click', () => {
        const w = widthOct(N), d = depthDb(N);
        const srcName = N.source === 'myaudio' ? 'My audio' : (engine.def(N.source) || {}).name || N.source;
        const name = prompt('Name this profile:', `Notched ${srcName} · ${hzLabel(N.hz)}`); if (!name) return;
        const ps = store.get('notch:profiles', []);
        ps.push({
          id: Date.now(), name, created: new Date().toISOString(),
          hz: N.hz, where: N.where, conf: N.conf, source: N.source, width: N.width, depth: N.depth,
          // canonical cross-platform spec (§ shared audio specification)
          spec: { centerHz: N.hz, widthOct: w, lowHz: Math.round(N.hz * Math.pow(2, -w / 2)), highHz: Math.round(N.hz * Math.pow(2, w / 2)), attenuationDb: d, design: notchDesign(N.hz, w, d), master: engine.masterVolume, limiter: 'threshold -10 dB, knee 12, ratio 8', smoothing: 'setTargetAtTime tau 0.08 s', srAssumed: engine.ctx ? engine.ctx.sampleRate : 48000 },
        });
        store.set('notch:profiles', ps); renderProfiles(ctx); app.toast('Profile saved on this device.');
      });
      q('[data-nx="recal"]').addEventListener('click', () => {
        const sec = host.querySelector('.nx'); const tb = document.querySelector('.topbar');
        const off = (tb ? tb.getBoundingClientRect().height : 54) + 10;
        window.scrollTo({ top: scrollY + sec.getBoundingClientRect().top - off, behavior: 'smooth' });
      });
      try { new IntersectionObserver((es) => { vizVisible = es[0].isIntersecting; }, { threshold: 0.05 }).observe(el.viz); } catch (_) { vizVisible = true; }
      if (!timerHooked) { timerHooked = true; engine.on(type => { if (type === 'timerDone' && runningThis()) stopRunning('Session complete — rest well.', true); }); }
      if (N.hz) setHz(N.hz); else updateAdv();
      renderProfiles(ctx); renderHistory(ctx);
    }
    function applyNotch(ctx) {
      const N = ctx.n;
      const r = engine.notchSet(N.hz, widthOct(N), depthDb(N));
      if (!r.ok) { app.toast(r.reason, 5000); return false; }
      if (N.abOn !== false) engine.notchEnable(true);
      if (ctx.nEl && ctx.nEl.vizlab) ctx.nEl.vizlab.textContent = `Your selected pitch: ${hzLabel(N.hz)} — the shaded band is being reduced`;
      return true;
    }
    async function startSource(ctx) {
      const N = ctx.n;
      if (N.node) { try { N.node.stop(); } catch (_) { } N.node = null; }
      if (N.source === 'myaudio' && N.buf) {
        // a whisper of engine sound keeps the graph/master alive; the track rides through the same notch path
        await engine.loadMix([{ id: 'brown', volume: 0.001 }]);
        const src = engine.ctx.createBufferSource(); src.buffer = N.buf; src.loop = true;
        const g = engine.ctx.createGain(); g.gain.value = 0.85;
        src.connect(g); g.connect(engine.master); src.start();
        N.node = src;
      } else {
        await engine.loadMix([{ id: N.source === 'myaudio' ? 'pink' : N.source, volume: 0.55 }]);
      }
    }
    async function start(ctx) {
      const N = ctx.n || {};
      if (!N.hz || !N.accepted) throw new Error('set and accept your pitch first (step 1)');
      safeMaster();
      await startSource(ctx);
      const r = engine.notchSet(N.hz, widthOct(N), depthDb(N));
      if (!r.ok) throw new Error(r.reason);
      engine.notchEnable(false);            // begin in NORMAL for the suitability measurement…
      ctx.nEl.live.hidden = false; ctx.nEl.feedback.hidden = true;
      ctx.nEl.suit.textContent = '';
      sessionStart = Date.now();
      setTimeout(() => {
        suitability(ctx);
        if (runningThis() && N.abOn !== false) {   // …then land on NOTCHED
          N.abOn = true; engine.notchEnable(true);
          $$('[data-nxab]', ctx.host).forEach(x => x.setAttribute('aria-checked', x.dataset.nxab === 'on'));
        }
      }, 1400);
      if (ctx.nEl.vizlab) ctx.nEl.vizlab.textContent = `Your selected pitch: ${hzLabel(N.hz)} — the shaded band is being reduced`;
      startViz(ctx);
    }
    function suitability(ctx) {
      try {
        const N = ctx.n; if (!runningThis() || !engine.ctx) return;
        const bins = new Uint8Array(engine.analyser.frequencyBinCount);
        engine.analyser.getByteFrequencyData(bins);
        const binHz = engine.ctx.sampleRate / engine.analyser.fftSize;
        const w = widthOct(N), lo = N.hz * Math.pow(2, -w / 2), hi = N.hz * Math.pow(2, w / 2);
        const avg = (a, b) => { let s = 0, n = 0; for (let i = Math.max(1, Math.floor(a / binHz)); i <= Math.min(bins.length - 1, Math.ceil(b / binHz)); i++) { s += bins[i]; n++; } return n ? s / n : 0; };
        const band = avg(lo, hi), ref = avg(300, Math.min(10000, engine.ctx.sampleRate * 0.45));
        ctx.nEl.suit.textContent = (band < Math.max(10, ref * 0.18))
          ? `⚠ This sound may not contain enough energy around your selected pitch (${hzLabel(N.hz)}) for meaningful notching. A broadband sound — pink noise, rain, a waterfall — gives the notch more to work on.`
          : '';
      } catch (_) { }
    }
    function startViz(ctx) {
      cancelAnimationFrame(vizRaf);
      const cv = ctx.nEl.viz, c2 = cv.getContext('2d');
      const bins = new Uint8Array(512);
      const css = getComputedStyle(document.documentElement);
      const accent = css.getPropertyValue('--accent').trim() || '#7aa2ff';
      let last = 0;
      const FMIN = 150, FMAX = 14000;
      const loop = (ts) => {
        if (!runningThis()) return;                       // stops itself with the session
        vizRaf = requestAnimationFrame(loop);
        if (!vizVisible || document.hidden || ts - last < 66) return;   // ~15 fps, gated
        last = ts;
        if (!engine.ctx) return;
        const N = ctx.n, w = cv.clientWidth || 300;
        if (cv.width !== w * 2) { cv.width = w * 2; cv.height = 300; }
        engine.analyser.getByteFrequencyData(bins);
        const sr = engine.ctx.sampleRate, binHz = sr / engine.analyser.fftSize;
        c2.clearRect(0, 0, cv.width, cv.height);
        const X = (hz) => cv.width * Math.log(hz / FMIN) / Math.log(FMAX / FMIN);
        const wOct = widthOct(N), lo = N.hz * Math.pow(2, -wOct / 2), hi = N.hz * Math.pow(2, wOct / 2);
        c2.fillStyle = 'rgba(255,170,80,0.14)'; c2.fillRect(X(lo), 0, X(hi) - X(lo), cv.height);
        c2.beginPath(); c2.moveTo(0, cv.height);
        for (let px = 0; px <= cv.width; px += 4) {
          const hz = FMIN * Math.pow(FMAX / FMIN, px / cv.width);
          const v = bins[Math.min(bins.length - 1, Math.round(hz / binHz))] / 255;
          c2.lineTo(px, cv.height - v * cv.height * 0.92);
        }
        c2.lineTo(cv.width, cv.height); c2.closePath();
        c2.fillStyle = accent + '55'; c2.fill();
        c2.strokeStyle = accent; c2.lineWidth = 2; c2.stroke();
        c2.strokeStyle = 'rgba(255,170,80,0.9)'; c2.lineWidth = 2;
        c2.beginPath(); c2.moveTo(X(N.hz), 0); c2.lineTo(X(N.hz), cv.height); c2.stroke();
      };
      vizRaf = requestAnimationFrame(loop);
    }
    function stopped(ctx) {
      cancelAnimationFrame(vizRaf); vizRaf = 0;
      engine.notchClear();
      const N = ctx.n || {};
      if (N.node) { try { N.node.stop(); } catch (_) { } N.node = null; }
      if (ctx.nEl) {
        ctx.nEl.live.hidden = true;
        const mins = sessionStart ? Math.round((Date.now() - sessionStart) / 60000) : 0;
        if (mins >= 2) showFeedback(ctx, mins);
      }
      sessionStart = 0;
    }
    function showFeedback(ctx, mins) {
      const N = ctx.n, host = ctx.nEl.feedback;
      host.hidden = false;
      host.innerHTML = `<h3 class="nx-t">Optional: what did you notice?</h3>
        <span class="label-sm">Compared with before this session, how noticeable does your tinnitus feel right now?</span>
        <div class="chips">${[['much-less', 'Much less noticeable'], ['less', 'Slightly less noticeable'], ['same', 'No change'], ['more', 'Slightly more noticeable'], ['much-more', 'Much more noticeable'], ['unsure', 'Not sure']].map(([v, l]) => `<button class="chip" data-fl="${v}">${l}</button>`).join('')}</div>
        <span class="label-sm">And separately — compared with before this session, how bothersome does it feel?</span>
        <div class="chips">${[['less', 'Less bothersome'], ['same', 'About the same'], ['more', 'More bothersome'], ['unsure', 'Not sure']].map(([v, l]) => `<button class="chip" data-fd="${v}">${l}</button>`).join('')}</div>
        <div class="btn-row"><button class="btn btn-secondary btn-sm" data-f="save" disabled>Save note</button><button class="btn btn-ghost btn-sm" data-f="skip">Skip</button></div>
        <p class="muted small">Some people notice a temporary change in tinnitus after listening to certain sounds — sometimes called residual inhibition. If it occurs, it is generally temporary and should not be interpreted as evidence that the tinnitus itself has been treated or permanently changed. Noticeability and bothersomeness are recorded separately on purpose.</p>`;
      let fl = null, fd = null;
      const upd = () => { $('[data-f="save"]', host).disabled = !(fl || fd); };
      $$('[data-fl]', host).forEach(b => b.addEventListener('click', () => { fl = b.dataset.fl; $$('[data-fl]', host).forEach(x => x.classList.toggle('active', x === b)); upd(); }));
      $$('[data-fd]', host).forEach(b => b.addEventListener('click', () => { fd = b.dataset.fd; $$('[data-fd]', host).forEach(x => x.classList.toggle('active', x === b)); upd(); }));
      $('[data-f="skip"]', host).addEventListener('click', () => { host.hidden = true; });
      $('[data-f="save"]', host).addEventListener('click', () => {
        const ss = store.get('notch:sessions', []);
        ss.push({ date: new Date().toISOString(), mins, hz: N.hz, width: N.width, depth: N.depth, source: N.source, postChange: fl, distress: fd });
        store.set('notch:sessions', ss); host.hidden = true; renderHistory(ctx);
        app.toast('Noted — stored only on this device.');
      });
    }
    function renderProfiles(ctx) {
      const host = ctx.nEl && ctx.nEl.profiles; if (!host) return;
      const ps = store.get('notch:profiles', []);
      host.innerHTML = ps.length ? `<h3 class="nx-t">My notched profiles</h3><div class="chips">${ps.map(p => `<button class="chip chip-mine" data-pload="${p.id}"><strong>${p.name}</strong><span>${hzLabel(p.hz)} · ${NCFG().widths[p.width] ? NCFG().widths[p.width].label.split(' ·')[0] : p.width} · ${new Date(p.created).toLocaleDateString()}</span></button>`).join('')}</div><p class="muted small"><button class="linklike" data-pclear>Delete all profiles</button></p>` : '';
      $$('[data-pload]', host).forEach(b => b.addEventListener('click', async () => {
        const p = ps.find(x => x.id === +b.dataset.pload); if (!p) return;
        Object.assign(ctx.n, { hz: p.hz, where: p.where, conf: p.conf, source: p.source, width: p.width, depth: p.depth, accepted: true });
        ctx.nEl.slider.value = hzS(p.hz); ctx.nEl.out.textContent = hzLabel(p.hz);
        ctx.nEl.confirm.hidden = false; ctx.nEl.hzbig.textContent = hzLabel(p.hz); ctx.nEl.accept.textContent = '✓ Accepted';
        $$('[data-nxs]', ctx.host).forEach(x => x.setAttribute('aria-pressed', x.dataset.nxs === p.source));
        $$('[data-nxwidth]', ctx.host).forEach(x => x.setAttribute('aria-pressed', x.dataset.nxwidth === p.width));
        $$('[data-nxdepth]', ctx.host).forEach(x => x.setAttribute('aria-pressed', x.dataset.nxdepth === p.depth));
        if (runningThis()) { await startSource(ctx); applyNotch(ctx); }
        app.toast(`Loaded “${p.name}”. Press Start Experiment to listen.`);
      }));
      const pc = $('[data-pclear]', host); if (pc) pc.addEventListener('click', () => { if (confirm('Delete all saved notched profiles? Your measurement history is kept.')) { store.set('notch:profiles', []); renderProfiles(ctx); } });
    }
    function renderHistory(ctx) {
      const box = ctx.nEl && ctx.nEl.feedback; if (!box) return;
      const ss = store.get('notch:sessions', []);
      if (!ss.length || !box.hidden) return;
      const L = { 'much-less': 'much less noticeable', less: 'slightly less noticeable', same: 'no change', more: 'slightly more noticeable', 'much-more': 'much more noticeable', unsure: 'not sure', 'much-quieter': 'much quieter', quieter: 'slightly quieter', louder: 'slightly louder', 'much-louder': 'much louder' };
      const D = (v) => typeof v === 'number' ? ['not at all', 'slightly', 'moderately', 'very', 'extremely'][v] : ({ less: 'less bothersome', same: 'about the same', more: 'more bothersome', unsure: 'not sure' })[v];
      box.hidden = false;
      box.innerHTML = `<h3 class="nx-t">Your recent notes</h3><ul class="bullets small">${ss.slice(-6).reverse().map(s => `<li>${new Date(s.date).toLocaleDateString()} — ${s.mins} min of ${s.source === 'myaudio' ? 'my audio' : (engine.def(s.source) || {}).name || s.source} at ${hzLabel(s.hz)}: tinnitus ${L[s.postChange] || '—'}${s.distress != null ? `, ${D(s.distress) || ''}` : ''}</li>`).join('')}</ul><p class="muted small">Personal observations over time — not a measure of treatment effect.</p>`;
    }
    return { wire, start, stopped };
  })();

  const CATS = [['Discover', 'Find and shape the sound that suits you'], ['Explore', 'Ways of listening you will not find in a noise machine'], ['Focus', 'Something to rest your attention on while you listen'], ['Sessions', 'Let the app build the whole experience']];

  // ---------- runtime ----------
  function stopRunning(msg, finishedNaturally) {
    if (!running) return; const { exp, ctx } = running; clearTimers(); try { exp.stop && exp.stop(ctx); } catch (_) { } if (!exp.keepsSound) engine.stopAll(); engine.setVariation(0); engine.resetMasterShape();
    $$('.lab-detail.exp-compact').forEach(d => d.classList.remove('exp-compact', 'exp-peek'));   // restore the folded explanation
    const prev = running; running = null; updateRunningUI(); if (msg) app.toast(msg); showAfterFeedback(prev.exp, prev.ctx);
  }
  function updateRunningUI() { const lv = $('#view-lab'); if (lv) lv.classList.toggle('running', !!running); const det = $('#lab-detail'); if (det) det.classList.toggle('running', !!running); $$('.lab-tile').forEach(t => t.classList.toggle('running', !!running && t.dataset.id === running.exp.id)); const el = $('#player-exp'); if (el) { if (running) { el.hidden = false; el.textContent = `Experiment: ${running.exp.name}`; } else el.hidden = true; } $$('.lab-card').forEach(c => c.classList.toggle('running', !!running && c.dataset.id === running.exp.id)); $$('[data-exp-start]').forEach(b => { const on = running && b.dataset.expStart === running.exp.id; b.textContent = on ? 'Running…' : 'Start Experiment'; b.disabled = !!on; }); }
  $('#player-stop').addEventListener('click', () => { if (running) stopRunning(); });
  function showAfterFeedback(exp, ctx) {
    const host = ctx.host && $('[data-after]', ctx.host); if (!host) return;
    host.innerHTML = `<div class="card lab-result"><h3>How did this feel?</h3><div class="btn-row"><button class="btn btn-ghost btn-sm" data-c="more">More comfortable</button><button class="btn btn-ghost btn-sm" data-c="same">About the same</button><button class="btn btn-ghost btn-sm" data-c="less">Less comfortable</button></div><p>Would you use this again?</p><div class="btn-row"><button class="btn btn-ghost btn-sm" data-a="yes">Yes</button><button class="btn btn-ghost btn-sm" data-a="maybe">Maybe</button><button class="btn btn-ghost btn-sm" data-a="no">No</button></div><p class="muted small">Used only to personalise your suggestions; stored on this device.</p></div>`;
    $$('[data-c]', host).forEach(b => b.addEventListener('click', () => { setFb(exp.id, { comfort: b.dataset.c, rating: b.dataset.c === 'more' ? 'helpful' : b.dataset.c === 'less' ? 'not' : 'neutral' }); $$('[data-c]', host).forEach(x => x.classList.toggle('btn-secondary', x === b)); renderLists(); renderProfile(); }));
    $$('[data-a]', host).forEach(b => b.addEventListener('click', () => { setFb(exp.id, { again: b.dataset.a }); $$('[data-a]', host).forEach(x => x.classList.toggle('btn-secondary', x === b)); renderLists(); }));
  }

  // ---------- cards & detail ----------
  const ctxs = {};
  function ctxFor(exp) { if (ctxs[exp.id]) return ctxs[exp.id]; const d = typeof exp.defaults === 'function' ? exp.defaults() : Object.assign({}, exp.defaults); const saved = store.get('lab:settings:' + exp.id); if (saved) Object.assign(d, saved); ctxs[exp.id] = { s: d, host: null }; return ctxs[exp.id]; }
  const TINT = { discovery: [200, 175, 140], paint: [185, 170, 205], sculptor: [200, 165, 125], generative: [225, 200, 150], morph: [180, 175, 200], space: [150, 185, 200], attention: [225, 210, 180], svjourney: [140, 175, 200], journey: [170, 185, 200], session: [190, 180, 170] };
  const LIGHT_TINT = { discovery: [125, 90, 60], paint: [110, 90, 140], sculptor: [125, 90, 60], generative: [150, 120, 60], morph: [100, 95, 130], space: [60, 110, 140], attention: [150, 125, 70], svjourney: [60, 105, 140], journey: [90, 110, 135], session: [110, 100, 90] };
  function card(exp) {
    const f = fb()[exp.id] || {}; const el = document.createElement('button'); el.type = 'button'; el.className = 'lab-tile' + (exp.featured ? ' big' : '') + ((running && running.exp.id === exp.id) ? ' running' : ''); el.dataset.id = exp.id; el.setAttribute('aria-label', exp.name + ': ' + exp.what);
    el.innerHTML = `<span class="lab-pv"><canvas aria-hidden="true"></canvas></span><span class="lab-tile-body"><span class="lab-cat">${exp.cat}${exp.premium ? ' · ' + PREMIUM_TAG() : ''}${favs().includes(exp.id) ? ' · ★' : ''}</span><span class="lab-tile-name">${exp.name}</span><span class="lab-tile-what">${exp.what.split(/(?<=\.)\s/)[0]}</span>${f.rating ? `<span class="lab-tile-you">You said: ${f.rating === 'helpful' ? 'helpful' : f.rating === 'not' ? 'not for me' : 'neutral'}</span>` : ''}</span>`;
    liveShape($('.lab-pv canvas', el), () => ({ preview: exp.id, tint: isDark() ? TINT[exp.id] : LIGHT_TINT[exp.id] }));
    el.addEventListener('click', () => openExperiment(exp.id)); return el;
  }
  function cardOld(exp) {
    const f = fb()[exp.id] || {}; const el = document.createElement('article'); el.className = 'lab-card compact' + (exp.featured ? ' featured' : ''); el.dataset.id = exp.id;
    el.innerHTML = `${exp.featured ? '<div class="lab-orb"><canvas aria-hidden="true"></canvas></div><div class="lab-reco">Recommended starting point</div>' : ''}<div class="lab-card-head"><div><div class="lab-cat">${exp.cat}${exp.premium ? ' · <span class="tag tag-prem">Premium preview</span>' : ''}</div><h3>${exp.name}</h3></div><span class="ev ev-${exp.evidence}">${EV[exp.evidence]}</span></div><p class="lab-what">${exp.what}</p><div class="lab-actions"><button class="btn btn-primary" data-open="${exp.id}">Open</button>${f.rating ? `<span class="muted small">You said: ${f.rating === 'helpful' ? 'Helpful' : f.rating === 'not' ? 'Not for me' : 'Neutral'}</span>` : ''}${favs().includes(exp.id) ? '<span class="tag">★ Favourite</span>' : ''}</div>`;
    $('[data-open]', el).addEventListener('click', () => openExperiment(exp.id)); if (exp.featured) liveShape($('.lab-orb canvas', el), () => { const pp = profileParams(); return { p: pp ? Object.assign({}, pp, { nature: profile().nature }) : Object.assign(DEF(), { colour: 0.45, rich: 0.5, width: 0.5 }), live: true, speed: 0.7, scale: 0.42 }; }); return el;
  }
  // ---------- Find My Sound: the completed-result experience ----------
  // One renderer for the completion card, used at finish AND whenever the user returns
  // to a finished session (nav tab, back gesture, "Back to your result") — so the
  // completed state survives navigation until "Try Find My Sound again" clears it.
  function showDiscoveryResult(ctx) {
    const host = ctx.host || $('#lab-detail'); const best = ctx.result; if (!host || !best) return;
    const panel = host.closest('.lab-detail') || host;
    const snd = { type: 'sculpt', params: best.params, nature: best.nature, natureVol: 0.35, name: 'My discovered sound' };
    $$('[data-sw],[data-pick]', host).forEach(b => b.disabled = true);
    const pr = $('[data-progress]', host); if (pr) pr.innerHTML = '<em>Done</em>';
    $('[data-result]', host).innerHTML = `<div class="card lab-result disc-result disc-reveal"><div class="reveal-orb"><canvas></canvas></div><div class="label-sm">Find My Sound · Complete</div><h3>Your Sound Profile is ready</h3>
      <p class="disc-next">We learned the sound qualities you prefer. Your profile can now help personalize sounds throughout Find My Quiet Sound.</p>
      <div class="desc-chips">${describe(best.params, best.nature).split(' · ').map(s => `<span>${s}</span>`).join('')}</div>
      <p class="muted small">What you leaned toward — a preference, not a measurement of your hearing.</p>
      <div class="disc-primary"><button class="btn btn-primary btn-lg" data-r="quiet">Listen to Your Quiet</button><span class="muted small">Hear a sound created from your preferences.</span></div>
      <div class="btn-row"><button class="btn btn-secondary" data-r="moments">See Your Moments</button><button class="btn btn-secondary" data-r="tune">Fine-Tune Your Sound</button><button class="btn btn-secondary" data-r="save">Save This Sound</button></div>
      <div data-saveform></div></div>`;
    // The completed card is the END of the session: the active-experiment controls
    // (Start/Stop/Reset/Favourite, ratings) no longer apply and are hidden. The one
    // restart action sits at the bottom, just above the end-of-experiment marker;
    // "Explore More Experiments" lives OUTSIDE this placard (see setExploreHeading).
    const run = $('.lab-run', panel); if (run) run.hidden = true;
    const rate = $('.lab-rate', panel); if (rate) rate.hidden = true;
    const after = $('[data-after]', panel); if (after) {
      after.innerHTML = '<div class="btn-row" style="justify-content:center; margin-top:18px"><button class="btn btn-primary btn-lg" data-r-new>Start New Experiment</button></div><div class="lab-end-note"><span class="label-sm">End of Find My Sound</span></div>';
      $('[data-r-new]', after).addEventListener('click', () => { ctx.finished = false; ctx.result = null; setExploreHeading(false); stopRunning(); openExperiment('discovery'); });
    }
    setExploreHeading(true);
    const R = $('[data-result]', host); liveShape($('.reveal-orb canvas', R), () => ({ p: Object.assign({}, best.params, { nature: best.nature }), live: true, scale: 0.42 }));
    // Returning from the Sounds-page destinations uses the app's own back button —
    // normally hidden on Sounds, shown here because there is a real place to go back to.
    const backable = () => setTimeout(() => { const b = document.getElementById('nav-back'); if (b) b.hidden = false; }, 80);
    $('[data-r="quiet"]', R).addEventListener('click', () => {
      app.showView('sounds'); backable();
      setTimeout(() => {
        const chip = document.querySelector('#moments-slot [data-chip-name="Your Quiet"]');
        const row = document.querySelector('#moments-slot .moments-row');
        if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); row.classList.add('moments-hello'); setTimeout(() => row.classList.remove('moments-hello'), 2600); }
        if (chip) { chip.click(); setTimeout(() => app.toast('✦ Personalized from your Sound Profile', 4200), 1000); }
      }, 300);
    });
    $('[data-r="moments"]', R).addEventListener('click', () => {
      app.showView('sounds'); backable();
      setTimeout(() => {
        const row = document.querySelector('#moments-slot .moments-row');
        if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); row.classList.add('moments-hello'); setTimeout(() => row.classList.remove('moments-hello'), 2600); }
      }, 250);
    });
    $('[data-r="tune"]', R).addEventListener('click', async () => {
      await engine.loadMix(soundMix(snd)); store.set('lab:settings:sculptor', sculptSettingsFrom(best.params, best.nature)); delete ctxs.sculptor; openExperiment('sculptor');
      // a way home: same ghost-button style as the panel's own "← Experiments"
      setTimeout(() => {
        const p = $('#lab-detail'); const close = $('[data-close]', p);
        if (close && !$('[data-back-result]', p)) {
          const b = document.createElement('button'); b.className = 'btn btn-ghost btn-sm'; b.setAttribute('data-back-result', ''); b.textContent = '← Back to your result';
          close.after(b);
          b.addEventListener('click', () => { if (running) stopRunning(); openExperiment('discovery'); });
        }
      }, 100);
    });
    const savedNote = (html) => {
      let n = $('.disc-saved-note', R);
      if (!n) { n = document.createElement('p'); n.className = 'disc-next disc-saved-note'; const sf = $('[data-saveform]', R); sf.parentNode.insertBefore(n, sf); }
      n.innerHTML = html;
      $('[data-go]', n).addEventListener('click', (ev) => {
        const parts = ev.currentTarget.dataset.go.split('|');
        app.showView(parts[0]); backable();
        setTimeout(() => { const spot = document.querySelector(parts[1]); if (spot) { spot.scrollIntoView({ behavior: 'smooth', block: 'center' }); spot.classList.add('row-hello'); setTimeout(() => spot.classList.remove('row-hello'), 2600); } }, 250);
      });
    };
    $('[data-r="save"]', R).addEventListener('click', () => saveSoundForm($('[data-saveform]', R), snd, () => {
      savedNote('Saved. Find it any time under <strong>My Saved Sounds</strong> on the Sounds page. <button type="button" class="linklike" data-go="sounds|#my-sounds-row">Show me</button>');
    }));
    setTimeout(scrollToDiscResult, 150);
  }
  // Bring the completed card to just below the real (measured) header.
  function scrollToDiscResult() {
    const card = document.querySelector('#lab-detail .disc-reveal'); if (!card) return;
    const tb = document.querySelector('.topbar');
    const off = (tb ? tb.getBoundingClientRect().height : 54) + 10;
    const r = card.getBoundingClientRect();
    window.scrollTo({ top: scrollY + r.top - off, behavior: 'smooth' });
  }
  // "Explore More Experiments" — a centred section heading BETWEEN the completed
  // Find My Sound placard and the next experiment placards, never inside it.
  function setExploreHeading(on) {
    let hd = document.getElementById('lab-after-heading');
    if (on) {
      if (!hd) {
        hd = document.createElement('h2'); hd.id = 'lab-after-heading'; hd.className = 'row-title lab-explore-more';
        hd.textContent = 'Explore More Experiments';
        const panel = $('#lab-detail'); if (panel) panel.after(hd);
      }
      hd.hidden = false;
    } else if (hd) hd.hidden = true;
  }
  // Back (app back button, browser back, iPhone edge-swipe) into a finished session
  // must land ON the completed result, not at the top of the Experiments page —
  // the view switcher scrolls to top, so we re-position after it.
  const backToResult = () => {
    const h = location.hash;
    if (h !== '#lab' && h !== '#find') return;
    const ctx = ctxs.discovery;
    const panel = document.getElementById('lab-detail');
    if (ctx && ctx.finished && ctx.result && panel && !panel.hidden && panel.querySelector('.disc-reveal')) setTimeout(scrollToDiscResult, 300);
  };
  addEventListener('hashchange', backToResult); addEventListener('popstate', backToResult);

  // ---------- shared run-mode positioning (the pattern proven on Find My Sound) ----------
  // Phones: while an experiment runs, fold the explanation behind "ⓘ About this
  // experiment" so the live controls fit on screen. Desktop CSS ignores the class.
  function compactForRun(detailEl) {
    if (!detailEl) return;
    if (!detailEl.querySelector('.about-toggle')) {
      const t = document.createElement('button'); t.type = 'button'; t.className = 'about-toggle';
      t.textContent = 'ⓘ About this experiment';
      t.setAttribute('aria-expanded', 'false');
      t.addEventListener('click', () => { const on = detailEl.classList.toggle('exp-peek'); t.setAttribute('aria-expanded', on); });
      const dl = detailEl.querySelector('.lab-dl'); if (dl) dl.before(t);
    }
    detailEl.classList.add('exp-compact');
  }
  // Bring the topmost visible control block to just below the real (measured) header,
  // so a new user sees the experiment's adjustments without hunting for them.
  function scrollToRunControls(panel) {
    const el = ['[data-custom]', '[data-settings]', '.lab-run'].map(s => $(s, panel))
      .filter(x => x && !x.hidden && x.offsetHeight > 0)
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
    if (!el) return;
    const tb = document.querySelector('.topbar');
    const off = (tb ? tb.getBoundingClientRect().height : 54) + 10;
    const r = el.getBoundingClientRect();
    if (r.top < off - 6 || r.top > innerHeight * 0.45) window.scrollTo({ top: scrollY + r.top - off, behavior: 'smooth' });
  }

  function openExperiment(id) {
    const exp = byId[id]; if (!exp) return; const ctx = ctxFor(exp); const panel = $('#lab-detail'); panel.hidden = false;
    setExploreHeading(false);   // only the completed Find My Sound state shows it (restored below if so)
    const f = fb()[exp.id] || {}; const isFav = favs().includes(exp.id);
    panel.innerHTML = `<div class="lab-detail-inner"><button class="btn btn-ghost btn-sm" data-close>← Experiments</button>
      <div class="lab-card-head"><div><div class="lab-cat">${exp.cat} · from ${exp.from}${exp.premium ? ' · <span class="tag tag-prem">' + PREMIUM_TAG() + '</span>' : ''}</div><h2>${exp.name}</h2></div><span class="ev ev-${exp.evidence}">${EV[exp.evidence]}</span></div>
      <dl class="lab-dl"><dt>What it does</dt><dd>${exp.what}</dd><dt>Why try it</dt><dd>${exp.why}</dd><dt>How to use it</dt><dd>${exp.how}${exp.guide ? ` <a href="${exp.guide}">Full step-by-step guide →</a>` : ''}</dd></dl>
      <details class="lab-why"><summary>Why are we testing this?</summary><p>${exp.whyTest}</p><p class="muted small">Not a medical treatment. Stop at any time with the Stop button below or in the player bar.</p></details>
      ${exp.customFirst ? '<div data-custom></div><div class="lab-settings" data-settings></div>' : '<div class="lab-settings" data-settings></div><div data-custom></div>'}
      <div class="lab-run"><button class="btn btn-primary btn-lg" data-exp-start="${exp.id}">Start Experiment</button><button class="btn btn-ghost" data-stop>Stop</button><button class="btn btn-ghost" data-reset>Reset</button><button class="btn btn-secondary" data-fav aria-pressed="${isFav}">${isFav ? '★ Favourite' : '☆ Favourite'}</button></div>
      <div class="lab-rate"><span class="label-sm">Rate this experiment</span><div class="seg" role="radiogroup" aria-label="Rating"><button role="radio" aria-checked="${f.rating === 'helpful'}" data-rate="helpful">Helpful</button><button role="radio" aria-checked="${f.rating === 'neutral'}" data-rate="neutral">Neutral</button><button role="radio" aria-checked="${f.rating === 'not'}" data-rate="not">Not for me</button></div></div>
      <div data-after></div></div>`;
    ctx.host = panel; if (exp.id === 'session') $('[data-settings]', panel).hidden = true; renderSettings(exp, ctx, $('[data-settings]', panel)); if (exp.custom && exp.buildUI) exp.buildUI(ctx, $('[data-custom]', panel));
    $('[data-close]', panel).addEventListener('click', () => { if (running) stopRunning('Experiment stopped'); panel.hidden = true; panel.innerHTML = ''; });
    $('[data-exp-start]', panel).addEventListener('click', async () => { if (!gate(exp)) return; if (running && running.exp !== exp) stopRunning(); else if (running) return; if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); if (exp.id === 'discovery') store.set('lab:discoveries', store.get('lab:discoveries', 0) + 1); await engine.init(); running = { exp, ctx }; setFb(exp.id, { tries: ((fb()[exp.id] || {}).tries || 0) + 1, last: Date.now() }); store.set('lab:settings:' + exp.id, ctx.s); updateRunningUI(); try { await Promise.race([exp.start(ctx), new Promise((_, rej) => setTimeout(() => rej(new Error('timed out — check that sound is allowed in your browser')), 12000))]); } catch (e) { console.error(e); app.toast('Could not start: ' + e.message, 5000); if (running && running.exp === exp) { running = null; } updateRunningUI(); } if (running && running.exp === exp && exp.id !== 'discovery') { compactForRun(panel.closest('.lab-detail') || panel); setTimeout(() => scrollToRunControls(panel), 120); } renderLists(); });   // discovery positions itself (specialized A/B flow)
    $('[data-stop]', panel).addEventListener('click', () => { if (running && running.exp === exp) stopRunning('Stopped'); else { try { exp.stop && exp.stop(ctx); } catch (_) { } } engine.stopAll(); });   // Stop means stop: the experiment and its sound, in one press
    $('[data-reset]', panel).addEventListener('click', () => { if (running && running.exp === exp) stopRunning(); store.del('lab:settings:' + exp.id); delete ctxs[exp.id]; openExperiment(exp.id); app.toast('Settings reset'); });
    $('[data-fav]', panel).addEventListener('click', e => { const l = favs(); const i = l.indexOf(exp.id); if (i >= 0) l.splice(i, 1); else l.push(exp.id); store.set('lab:favs', l); const on = i < 0; e.currentTarget.setAttribute('aria-pressed', on); e.currentTarget.textContent = on ? '★ Favourite' : '☆ Favourite'; renderLists(); });
    $$('[data-rate]', panel).forEach(b => b.addEventListener('click', () => { setFb(exp.id, { rating: b.dataset.rate }); $$('[data-rate]', panel).forEach(x => x.setAttribute('aria-checked', x === b)); renderLists(); renderProfile(); }));
    updateRunningUI(); panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // A finished Find My Sound session survives navigation: any return to it shows the
    // completed result, until "Try Find My Sound again" starts a fresh one.
    if (id === 'discovery' && ctx.finished && ctx.result && !(running && running.exp === exp)) showDiscoveryResult(ctx);
  }

  // ---------- lists ----------
  function renderLists() {
    const host = $('#lab-list'); host.innerHTML = '';
    CATS.forEach(([cat, blurb]) => { const sec = document.createElement('section'); sec.className = 'lab-group'; sec.innerHTML = `<h3 class="lab-group-title">${cat}</h3><p class="muted small">${blurb}</p><div class="lab-grid"></div>`; EXPERIMENTS.filter(e => e.cat === cat).forEach(e => $('.lab-grid', sec).appendChild(card(e))); host.appendChild(sec); });
    // history: sections are rendered only when they contain data — no headings over blank space
    const f = fb();
    const groups = [
      ['Recently tried', Object.entries(f).filter(([k, v]) => v.last && byId[k]).sort((a, b) => b[1].last - a[1].last).slice(0, 8).map(([k]) => k)],
      ['Favourites', favs().filter(id => byId[id])],
      ['Worked well for me', Object.entries(f).filter(([k, v]) => byId[k] && (v.rating === 'helpful' || v.comfort === 'more')).map(([k]) => k)],
      ['Not for me', Object.entries(f).filter(([k, v]) => byId[k] && (v.rating === 'not' || v.comfort === 'less' || v.again === 'no')).map(([k]) => k)],
    ].filter(([, ids]) => ids.length);
    const hh = $('#lab-hist-host');
    if (hh) {
      hh.innerHTML = '';
      if (groups.length) {
        const title = document.createElement('h2'); title.className = 'row-title'; title.textContent = 'Your experiments'; hh.appendChild(title);
        const wrap = document.createElement('div'); wrap.className = 'lab-hist';
        groups.forEach(([name, ids]) => { const g = document.createElement('div'); g.innerHTML = `<h3>${name}</h3><div class="chips"></div>`; ids.forEach(id => { const e = byId[id]; const b = document.createElement('button'); b.className = 'chip'; b.innerHTML = `<strong>${e.name}</strong><span>${e.cat}</span>`; b.addEventListener('click', () => openExperiment(id)); $('.chips', g).appendChild(b); }); wrap.appendChild(g); });
        hh.appendChild(wrap);
      }
    }
    updateRunningUI();
  }
  $('#lab-start-discovery').addEventListener('click', () => openExperiment('discovery'));
  const lf = $('#lab-field'); if (lf) liveShape(lf, () => ({ field: true }));
  const flag = $('#lab-flagship canvas'); if (flag) liveShape(flag, () => { const pp = profileParams(); return { p: pp ? Object.assign({}, pp, { nature: profile().nature }) : Object.assign(DEF(), { colour: 0.4, width: 0.5, moving: 0.2 }), live: true, speed: 0.7, scale: 0.4 }; });

  window.softwaveLab = { open: openExperiment, stop: stopRunning, experiments: EXPERIMENTS, isRunning: () => !!running, mySounds, soundMix, onTap() { const p = focus.getParam && focus.getParam(); if (!p || !p.soundTouch) return; engine.setMasterTone(2200, 0.08); later(() => engine.setMasterTone(20000, 0.6), 350); } };
  addEventListener('unhandledrejection', e => { if (running) { console.error(e.reason); app.toast('Something went wrong in this experiment. Press Stop and try again.', 5000); } });
  renderLists(); renderProfile();
  const qe = new URLSearchParams(location.search).get('exp'); if (qe && byId[qe]) setTimeout(() => openExperiment(qe), 120);
  document.dispatchEvent(new CustomEvent('softwave:lab-ready'));
})();
