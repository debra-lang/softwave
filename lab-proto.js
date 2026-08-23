/* Softwave Lab prototypes — Find My Sound · Frequency Painting · Sound Sculptor.
   Real audio (audio.js Engine) + the Softwave Sound Field language (field.js). Deeper atmosphere, tactile interaction. */
(function () {
  'use strict';
  const { Engine } = window.SoftwaveAudio; const F = window.SoftwaveField;
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const TAU = Math.PI * 2; const lerp = (a, b, t) => a + (b - a) * t; const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const hash = (i, k = 0) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };
  const store = { get(k, d) { try { const v = localStorage.getItem('softwave:' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem('softwave:' + k, JSON.stringify(v)); } catch (_) { } } };
  const engine = new Engine(); window.softwave = engine;
  const DEF = () => Engine.defaultSculpt();
  const isDark = () => document.documentElement.dataset.theme === 'dark';
  const reduced = () => F.reduced();
  const LOW = F.LOW;

  // ---------- theme / motion ----------
  const storedTheme = store.get('proto:theme', null); let dark = storedTheme ? storedTheme === 'dark' : true;
  const applyTheme = () => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; $('#theme-btn').textContent = dark ? '☀' : '☾'; $('#theme-btn').setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode'); $('meta[name=theme-color]').content = dark ? '#080a11' : '#efebe3'; };
  applyTheme(); $('#theme-btn').addEventListener('click', () => { dark = !dark; store.set('proto:theme', dark ? 'dark' : 'light'); applyTheme(); });
  const applyMotion = () => $('#motion-btn').setAttribute('aria-pressed', store.get('reduceMotion', false));
  applyMotion(); $('#motion-btn').addEventListener('click', () => { store.set('reduceMotion', !store.get('reduceMotion', false)); applyMotion(); });

  // ---------- shared helpers ----------
  let toastT; function toast(msg, ms = 2800) { const el = $('#toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), ms); }
  function paint(inp) { inp.style.setProperty('--p', inp.value + '%'); }
  async function ensure() { await engine.init(); }
  document.addEventListener('pointerdown', () => engine.prepare(), { once: true, passive: true });
  function bindVolume(ids) { ids.forEach(id => { const i = $('#' + id); i.value = Math.round(store.get('proto:vol', 30)); paint(i); i.addEventListener('input', () => { engine.setMasterVolume(+i.value / 100); store.set('proto:vol', +i.value); ids.forEach(o => { const x = $('#' + o); x.value = i.value; paint(x); }); }); }); engine.setMasterVolume(store.get('proto:vol', 30) / 100, true); }
  bindVolume(['find-vol', 'paint-vol', 'sculpt-vol']);
  const NATURES = ['none', 'rain', 'ocean', 'wind', 'forest', 'stream']; const NAME = { rain: 'Rain', ocean: 'Ocean', wind: 'Wind', forest: 'Forest', stream: 'Flowing water' };
  const words = (p, nature) => { const b = []; b.push(p.warm < -0.2 ? 'Warm' : p.warm > 0.2 ? 'Bright' : p.colour < 0.33 ? 'Deep' : p.colour > 0.66 ? 'Light' : 'Balanced'); if (p.deep < -0.2) b.push('Deep'); else if (p.deep > 0.2) b.push('Airy'); b.push(p.smooth > 0.2 ? 'Textured' : 'Smooth'); if (p.soft < -0.2) b.push('Soft'); else if (p.soft > 0.2) b.push('Crisp'); if (p.width > 0.6) b.push('Wide'); b.push(p.moving > 0.4 ? 'Moving' : p.moving > 0.12 ? 'Gentle movement' : 'Still'); if (nature && nature !== 'none') b.push('Nature: ' + NAME[nature]); return [...new Set(b)]; };
  const soundMix = (params, nature, vol = 0.55) => { const m = [{ id: 'sculpt', volume: vol, balance: 0, params }]; if (nature && nature !== 'none') m.push({ id: nature, volume: 0.32, balance: 0 }); return m; };
  // save sheet
  let saveCb = null; function askSave(defaultName, cb) { const sh = $('#saveform'); sh.hidden = false; const i = $('#save-name'); i.value = defaultName; saveCb = cb; i.focus(); }
  $('#save-ok').addEventListener('click', () => { const n = $('#save-name').value.trim() || 'My sound'; $('#saveform').hidden = true; saveCb && saveCb(n); }); $('#save-cancel').addEventListener('click', () => { $('#saveform').hidden = true; });
  $('#save-name').addEventListener('keydown', e => { if (e.key === 'Enter') $('#save-ok').click(); if (e.key === 'Escape') $('#save-cancel').click(); });
  function saveSound(snd) { const l = store.get('lab:sounds', []); l.push(snd); store.set('lab:sounds', l); }
  function handoff(snd, where) { saveSound(snd); toast(`Saved to My sounds. Opening ${where === '#focus' ? 'Visual Focus' : 'Sleep'} — pick it under My sounds.`, 3500); setTimeout(() => { location.href = './' + where; }, 1400); }

  // ---------- the sound object (Sound Field language, small scale, morphing) ----------
  const objects = new Map(); // canvas -> getter
  const liveObj = (c, get) => objects.set(c, get);
  function soundObject(ctx, w, h, s, t, lv, holder) {
    const c = holder; const p = s.p || {}; const nature = s.nature && s.nature !== 'none' ? s.nature : null;
    const target = nature ? F.blend([{ id: 'sculpt', params: p, volume: 0.6 }, { id: nature, volume: 0.35 }]) : F.personaFor('sculpt', p);
    if (!c._P) c._P = Object.assign({}, target); const P = c._P; const k = s.snap ? 1 : 0.05; for (const key in target) { if (Array.isArray(target[key])) P[key] = (P[key] || target[key]).map((v, i) => lerp(v, target[key][i], k)); else if (typeof target[key] === 'number') P[key] = lerp(P[key] == null ? target[key] : P[key], target[key], k); else P[key] = target[key]; }
    // morph pulse: contract → re-texture → expand
    c._pulse = Math.max(0, (c._pulse || 0) - 0.02); const pulse = 1 - 0.14 * Math.sin(c._pulse * Math.PI);
    const dk = isDark(), tint = dk ? P.tint : P.light; const R = Math.min(w, h) * (s.scale || 0.36) * pulse * (s.grow == null ? 1 : s.grow); const cx = w / 2, cy = h / 2; const life = s.live ? 1 : 0.45; const red = reduced();
    const o = { cx, cy, R, W: w, H: h, t: t * (s.speed || 1), life, alive: s.live ? 1 : 0.35, level: lv, low: lv * 0.6, vol: 0.4, P, tint, dark: dk, e: 0, rawMorph: 0, grow: 1, reduce: red, pts: R < 90 ? 64 : R < 200 ? 100 : 150 };
    let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6); g.addColorStop(0, rgba(tint, dk ? 0.13 : 0.15)); g.addColorStop(1, rgba(tint, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    F.drawRings(ctx, o);
    const layer = F.LAYERS[P.geo]; if (layer && P.geo !== 'rings') { ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R * 1.02, 0, TAU); ctx.clip(); layer(ctx, cx, cy, R, { t: o.t, life, alive: o.alive, level: lv, low: o.low, dark: dk, tint, P, reduce: red }, red ? 0.6 : 1); ctx.restore(); }
    if (s.signature) signature(ctx, cx, cy, R, p, tint, dk, o.t);
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.5); g.addColorStop(0, rgba(tint, (dk ? 0.2 : 0.22) * (0.5 + o.alive * 0.5))); g.addColorStop(1, rgba(tint, 0)); ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  }
  // fingerprint signature: a single line whose shape is a function of the preference vector — memorable, not clinical
  function signature(ctx, cx, cy, R, p, tint, dk, t) {
    const seed = Math.round((p.colour * 7 + (p.warm + 1) * 5 + (p.deep + 1) * 3 + p.width * 11 + p.moving * 13) * 100) / 100;
    ctx.beginPath(); const n = 220; for (let i = 0; i <= n; i++) { const th = i / n * TAU; const r = R * (1.12 + 0.07 * Math.sin(th * (2 + Math.round(p.colour * 4)) + seed) + 0.05 * Math.sin(th * (3 + Math.round(p.width * 5)) - seed * 2 + t * 0.2) + 0.04 * (p.smooth + 1) * Math.sin(th * 11 + seed) * 0.5 + 0.03 * p.moving * Math.sin(th * 7 + t * 0.6)); const x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r * (0.92 + 0.08 * (p.deep + 1) / 2); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath(); ctx.strokeStyle = rgba(mix3(tint, [255, 255, 255], dk ? 0.5 : -0.1), 0.55); ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = rgba(tint, 0.18); ctx.lineWidth = 7; ctx.stroke();
  }
  let objLast = 0, objT = 0; const spec = new Uint8Array(512);
  function objLoop(now) { requestAnimationFrame(objLoop); if (document.hidden || now - objLast < (LOW ? 66 : 33)) return; const dt = objLast ? Math.min(0.05, (now - objLast) / 1000) : 0.016; objLast = now; objT += dt * (reduced() ? 0.15 : 1); const lv = engine.isPlaying ? Math.min(1, engine.getLevels(spec) * 6) : 0;
    objects.forEach((get, c) => { if (!c.isConnected || c.offsetParent === null) return; const r = c.getBoundingClientRect(); if (!r.width) return; const dpr = Math.min(devicePixelRatio || 1, LOW ? 1 : 1.5); if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); } const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height); const s = get(); if (!s) return; soundObject(ctx, r.width, r.height, s, objT, s.live ? lv : 0.08, c); }); }
  requestAnimationFrame(objLoop);

  // ---------- the Lab atmosphere: deep, with a faint frequency texture ----------
  const bg = $('#lab-bg'), bgx = bg.getContext('2d'); let bgLast = 0;
  function bgLoop(now) { requestAnimationFrame(bgLoop); if (document.hidden || now - bgLast < 80) return; bgLast = now; const w = innerWidth, h = innerHeight; if (bg.width !== w) { bg.width = w; bg.height = h; } const dk = isDark(); const t = now / 1000 * (reduced() ? 0.15 : 1);
    let g = bgx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, Math.max(w, h) * 0.85); if (dk) { g.addColorStop(0, '#0f1424'); g.addColorStop(0.6, '#0a0d18'); g.addColorStop(1, '#06080e'); } else { g.addColorStop(0, '#f3efe7'); g.addColorStop(0.6, '#ebe6dc'); g.addColorStop(1, '#e0dacf'); } bgx.fillStyle = g; bgx.fillRect(0, 0, w, h);
    // spectral silhouettes, very low contrast
    for (let L = 0; L < 4; L++) { const z = L / 3; bgx.beginPath(); bgx.moveTo(0, h); for (let x = 0; x <= w; x += 10) { const u = x / w; const y = h * (1 - 0.08 - 0.22 * z) - h * 0.16 * (0.5 + 0.5 * Math.sin(u * 4.6 + t * 0.09 * (1 + z) + L * 1.9)) * (0.3 + 0.7 * Math.pow(Math.sin(u * Math.PI), 0.5)); bgx.lineTo(x, y); } bgx.lineTo(w, h); bgx.closePath(); bgx.fillStyle = dk ? `rgba(150,185,205,${0.022 + z * 0.03})` : `rgba(60,90,120,${0.02 + z * 0.03})`; bgx.fill(); }
    bgx.strokeStyle = dk ? 'rgba(190,215,230,0.035)' : 'rgba(40,70,100,0.05)'; for (let i = 1; i < 28; i++) { const x = w * Math.pow(i / 28, 1.5); bgx.beginPath(); bgx.moveTo(x, h * 0.62); bgx.lineTo(x, h); bgx.stroke(); } }
  requestAnimationFrame(bgLoop);

  // ---------- phases and experiments ----------
  const q = new URLSearchParams(location.search); const EXP = ['find', 'paint', 'sculpt'].find(k => q.has(k)) || 'find';
  document.body.dataset.exp = EXP; $$('.switch a').forEach(a => a.classList.toggle('on', a.dataset.exp === EXP)); $('#exp-' + EXP).hidden = false;
  function setPhase(p) { document.body.dataset.phase = p; $('#exit').hidden = p === 'entry'; scrollTo({ top: 0, behavior: 'smooth' }); }
  $('#exit').addEventListener('click', () => { leave(); setPhase('entry'); });
  let leave = () => { };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.dataset.phase !== 'entry') { leave(); setPhase('entry'); } });

  // =====================================================================
  // 1. FIND MY SOUND
  // =====================================================================
  const DIMS = ['colour', 'warm', 'deep', 'smooth', 'soft', 'width', 'moving', 'rich', 'mod'];
  const RANGE = { colour: [0, 1], warm: [-1, 1], deep: [-1, 1], smooth: [-1, 1], soft: [-1, 1], width: [0, 1], moving: [0, 1], rich: [0, 1], mod: [0, 1] };
  const prefs = () => store.get('lab:prefs2', { n: 0, sum: {}, natures: {} });
  function learn(p, nature) { const pr = prefs(); pr.n++; DIMS.forEach(d => { pr.sum[d] = (pr.sum[d] || 0) + p[d]; }); if (nature) pr.natures[nature] = (pr.natures[nature] || 0) + 1; store.set('lab:prefs2', pr); }
  function profileParams() { const pr = prefs(); if (!pr.n) return null; const o = {}; DIMS.forEach(d => o[d] = (pr.sum[d] || 0) / pr.n); return o; }
  const find = { sides: { A: { params: DEF(), nature: 'none' }, B: { params: DEF(), nature: 'none' } }, side: 'A', round: 0, rounds: 10, best: null, cand: null, result: null };
  if (EXP === 'find') {
    const objA = $('#obj-a canvas'), objB = $('#obj-b canvas');
    liveObj(objA, () => ({ p: find.sides.A.params, nature: find.sides.A.nature, live: find.side === 'A' && engine.isPlaying, scale: 0.34 }));
    liveObj(objB, () => ({ p: find.sides.B.params, nature: find.sides.B.nature, live: find.side === 'B' && engine.isPlaying, scale: 0.34 }));
    liveObj($('#fp-canvas'), () => find.result ? { p: find.result.params, nature: find.result.nature, live: true, scale: 0.33, signature: true, speed: 0.7 } : null);
    const perturb = (b) => { const p = Object.assign({}, b.params); const n = 1 + (Math.random() < 0.4 ? 1 : 0); const dims = DIMS.slice().sort(() => Math.random() - 0.5).slice(0, n); for (const d of dims) { const [lo, hi] = RANGE[d]; const span = (hi - lo) * (find.round < 4 ? 0.45 : 0.25); p[d] = clamp(p[d] + (Math.random() * 2 - 1) * span, lo, hi); } let nature = b.nature; if (Math.random() < (find.round < 3 ? 0.5 : 0.25)) nature = NATURES[Math.floor(Math.random() * NATURES.length)]; return { params: p, nature }; };
    const prep = async () => { const s = find.sides; engine.setSculpt(s.A.params, 'discoA'); engine.setSculpt(s.B.params, 'discoB'); if (!engine.isActive('discoA')) await engine.startSound('discoA', 0.55); if (!engine.isActive('discoB')) await engine.startSound('discoB', 0.55); for (const n of NATURES) if (n !== 'none') { const want = s.A.nature === n || s.B.nature === n; if (!want && engine.isActive(n)) engine.stopSound(n); } for (const n of NATURES) if (n !== 'none') { const want = s.A.nature === n || s.B.nature === n; if (want && !engine.isActive(n)) await engine.startSound(n, 0.001); } await engine.playAll(); };
    const switchTo = (side) => { find.side = side; $$('.obj').forEach(b => b.setAttribute('aria-pressed', b.dataset.side === side)); (side === 'A' ? objB : objA)._pulse = 1; (side === 'A' ? objA : objB)._pulse = 1; engine.crossfade(side === 'A' ? 'discoB' : 'discoA', side === 'A' ? 'discoA' : 'discoB', 0.25); for (const n of NATURES) if (n !== 'none' && engine.isActive(n)) { if (find.sides[side].nature === n) engine.rampVolume(n, 0.32, 0.3); else engine.muteQuick(n); } };
    const progress = () => { $('#find-progress').innerHTML = Array.from({ length: find.rounds }, (_, i) => `<i class="${i < find.round ? 'done' : i === find.round ? 'now' : ''}"></i>`).join('') + '<em>Exploring your preferences</em>'; };
    const next = async () => { find.sides.A = find.best; find.sides.B = find.cand; progress(); await prep(); engine.muteQuick('discoB'); for (const n of NATURES) if (n !== 'none' && engine.isActive(n)) { if (find.sides.A.nature === n) engine.rampVolume(n, 0.32, 0.5); else engine.muteQuick(n); } switchTo('A'); $$('.choice, .obj').forEach(b => b.disabled = false); };
    const finish = () => { const best = find.best; find.result = best; find.sides.A = best; find.sides.B = best; engine.setSculpt(best.params, 'discoA'); switchTo('A'); if (engine.isActive('discoB')) engine.stopSound('discoB'); for (const n of NATURES) if (n !== 'none' && engine.isActive(n) && best.nature !== n) engine.stopSound(n);
      const ws = words(best.params, best.nature); $('#find-words').textContent = ws.slice(0, 3).join(' · '); $('#find-chips').innerHTML = ws.map(x => `<span>${x}</span>`).join(''); setPhase('result'); };
    const answer = (pick) => { const winner = pick === 'B' ? find.cand : find.best; if (pick !== 'same') learn(winner.params, winner.nature); find.best = pick === 'same' ? find.best : winner; find.round++; if (find.round >= find.rounds) { finish(); return; } find.cand = perturb(find.best); next(); };
    $$('.obj').forEach(b => b.addEventListener('click', () => switchTo(b.dataset.side)));
    $$('.choice').forEach(b => b.addEventListener('click', () => { $$('.choice').forEach(x => x.disabled = true); answer(b.dataset.pick); }));
    $('[data-begin="find"]').addEventListener('click', async () => { await ensure(); find.round = 0; find.result = null; const saved = profileParams(); find.best = { params: saved ? Object.assign({}, saved) : Object.assign(DEF(), { colour: 0.35, width: 0.35 }), nature: 'none' }; find.cand = perturb(find.best); setPhase('run'); await next(); });
    const snd = () => ({ type: 'sculpt', params: find.result.params, nature: find.result.nature, natureVol: 0.32, name: 'My discovered sound' });
    $$('#exp-find [data-act]').forEach(b => b.addEventListener('click', async () => { const a = b.dataset.act; if (!find.result && a !== 'again') return;
      if (a === 'listen') { await ensure(); await engine.loadMix(soundMix(find.result.params, find.result.nature)); toast('Playing the sound you preferred'); }
      if (a === 'tune') { store.set('proto:sculpt', { params: find.result.params, nature: find.result.nature }); location.href = 'lab-prototype.html?sculpt&from=find'; }
      if (a === 'save') askSave('My discovered sound', n => { saveSound(Object.assign(snd(), { name: n })); toast('Saved to My sounds'); });
      if (a === 'visual') handoff(snd(), '#focus');
      if (a === 'sleep') handoff(Object.assign(snd(), { params: Object.assign({}, find.result.params, { moving: 0 }), name: 'My sleep sound' }), '#sleep');
      if (a === 'again') { engine.stopAll(); setPhase('entry'); } }));
    leave = () => { engine.stopAll(); };
  }

  // =====================================================================
  // 2. FREQUENCY PAINTING
  // =====================================================================
  if (EXP === 'paint') {
    const c = $('#paint-canvas'), cx = c.getContext('2d'); const N = 24;
    const P = { curve: (store.get('proto:paintcurve') || new Array(N).fill(0.5)).slice(), disp: null, hist: [], mode: 'paint', down: false, live: true, strands: [] };
    P.disp = P.curve.slice();
    const strandCount = LOW ? 90 : 170; for (let i = 0; i < strandCount; i++) P.strands.push({ u: hash(i), v: hash(i, 1), z: 0.3 + hash(i, 2) * 0.7, ph: hash(i, 3) * TAU });
    const spline = (arr, u) => { const x = clamp(u, 0, 1) * (N - 1); const i = Math.floor(x), f = x - i; const a = arr[Math.max(0, i - 1)], b = arr[i], c2 = arr[Math.min(N - 1, i + 1)], d = arr[Math.min(N - 1, i + 2)]; return clamp(b + 0.5 * f * (c2 - a + f * (2 * a - 5 * b + 4 * c2 - d + f * (3 * (b - c2) + d - a))), 0, 1); };
    let w = 0, h = 0, dpr = 1, last = 0;
    const resize = () => { const r = c.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, LOW ? 1 : 1.5); if (Math.round(r.width * dpr) !== c.width) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); } w = r.width; h = r.height; cx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const warm = () => isDark() ? [205, 165, 120] : [150, 105, 65], cool = () => isDark() ? [150, 185, 215] : [70, 115, 150], mid = () => isDark() ? [195, 170, 190] : [140, 100, 130];
    function draw(now) {
      resize(); const dk = isDark(); const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now; const red = reduced(); const t = now / 1000 * (red ? 0.15 : 1);
      for (let i = 0; i < N; i++) P.disp[i] = lerp(P.disp[i], P.curve[i], red ? 0.3 : 0.12);   // landscapes melt, never snap
      const top = u => h * (0.92 - 0.78 * spline(P.disp, u)); const pad = 0;
      let g = cx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, dk ? '#0b0f1a' : '#f4f1ea'); g.addColorStop(1, dk ? '#0e1422' : '#e7e2d8'); cx.fillStyle = g; cx.fillRect(0, 0, w, h);
      // depth haze behind the ridge
      g = cx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, rgba(cool(), 0)); g.addColorStop(1, rgba(warm(), dk ? 0.08 : 0.1)); cx.fillStyle = g; cx.fillRect(0, 0, w, h);
      // the landscape: layered depth (3 translucent ridges behind the main one)
      for (let L = 3; L >= 0; L--) { const off = L * 0.035; cx.beginPath(); cx.moveTo(0, h); for (let x = 0; x <= w; x += 3) { const u = x / w; const y = top(u) - h * off * (1 + 0.2 * Math.sin(u * 9 + t * 0.4 + L)); cx.lineTo(x, y); } cx.lineTo(w, h); cx.closePath();
        const gg = cx.createLinearGradient(0, 0, w, 0); const a = L ? 0.08 - L * 0.015 : (dk ? 0.42 : 0.4); gg.addColorStop(0, rgba(warm(), a)); gg.addColorStop(0.5, rgba(mid(), a * 0.9)); gg.addColorStop(1, rgba(cool(), a)); cx.fillStyle = gg; cx.fill();
        if (!L) { cx.lineJoin = 'round'; cx.strokeStyle = dk ? 'rgba(255,245,230,.22)' : 'rgba(60,40,20,.16)'; cx.lineWidth = 10; cx.stroke(); cx.strokeStyle = dk ? 'rgba(255,248,238,.9)' : 'rgba(40,30,20,.75)'; cx.lineWidth = 1.5; cx.stroke(); } }
      // strands of wind over the terrain: density follows energy; finer and quicker on the right
      cx.lineCap = 'round'; for (const s of P.strands) { const e = spline(P.disp, s.u); const speed = (0.03 + s.u * 0.05) * s.z * (red ? 0.2 : 1); s.u += dt * speed; if (s.u > 1.02) { s.u = -0.02; s.v = hash(s.ph + now); } if (s.v > 0.35 + e * 0.65) continue; const y = top(s.u) - 4 - s.v * h * 0.2 * (0.4 + e) + Math.sin(t * 1.2 + s.ph) * 2; const len = (6 + 26 * (1 - s.u)) * s.z; const tint = mix3(warm(), cool(), s.u); cx.strokeStyle = rgba(mix3(tint, [255, 255, 255], dk ? 0.45 : 0), (0.14 + s.z * 0.34) * Math.min(1, 0.3 + e * 1.2)); cx.lineWidth = 0.6 + s.z * (1.6 - s.u); cx.beginPath(); cx.moveTo(s.u * w - len, y + len * 0.04); cx.lineTo(s.u * w, y); cx.stroke(); }
      // brush position
      if (P.hover) { cx.strokeStyle = dk ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.2)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(P.hover * w, 0); cx.lineTo(P.hover * w, h); cx.stroke(); }
    }
    let raf; const loop = (now) => { raf = requestAnimationFrame(loop); if (document.hidden || document.body.dataset.phase === 'entry') return; if (LOW && now - last < 30) return; draw(now); }; raf = requestAnimationFrame(loop);
    const push = () => { P.hist.push(P.curve.slice()); if (P.hist.length > 40) P.hist.shift(); };
    const apply = () => { engine.setPaint(P.curve); store.set('proto:paintcurve', P.curve); syncAlt(); };
    const brush = (ev) => { const r = c.getBoundingClientRect(); const u = (ev.clientX - r.left) / r.width, v = 1 - (ev.clientY - r.top) / r.height; const i = clamp(Math.floor(u * N), 0, N - 1); const target = clamp((v - 0.08) / 0.78, 0, 1);
      if (P.mode === 'soften') { for (let k = -2; k <= 2; k++) { const j = i + k; if (j < 0 || j >= N) continue; P.curve[j] = Math.max(0, P.curve[j] - 0.035 * (1 - Math.abs(k) / 3)); } }
      else { P.curve[i] = lerp(P.curve[i], target, 0.7); if (i > 0) P.curve[i - 1] = lerp(P.curve[i - 1], target, 0.35); if (i < N - 1) P.curve[i + 1] = lerp(P.curve[i + 1], target, 0.35); }
      if (P.live) engine.setPaint(P.curve); };
    c.addEventListener('pointerdown', e => { P.down = true; push(); try { c.setPointerCapture(e.pointerId); } catch (_) { } brush(e); }); c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(); P.hover = (e.clientX - r.left) / r.width; if (P.down) brush(e); }); c.addEventListener('pointerleave', () => { P.hover = null; });
    addEventListener('pointerup', () => { if (P.down) { P.down = false; apply(); } });
    const tools = $$('.tool[data-tool]'); tools.forEach(b => b.addEventListener('click', () => { const tl = b.dataset.tool; if (tl === 'paint' || tl === 'soften') { P.mode = tl; tools.forEach(x => { if (x.dataset.tool === 'paint' || x.dataset.tool === 'soften') x.setAttribute('aria-pressed', x.dataset.tool === tl); }); return; }
      if (tl === 'smooth') { push(); P.curve = P.curve.map((v, i) => (P.curve[Math.max(0, i - 1)] + v * 2 + P.curve[Math.min(N - 1, i + 1)]) / 4); }
      if (tl === 'undo') { if (P.hist.length) P.curve = P.hist.pop(); }
      if (tl === 'reset') { push(); P.curve = new Array(N).fill(0.5); }
      apply(); }));
    const alt = $('#paint-alt'); const bands = [60, 120, 250, 500, 1000, 2000, 4000, 8000, 14000]; alt.innerHTML = bands.map((f, i) => `<label>${f >= 1000 ? f / 1000 + 'k' : f} Hz<input type="range" min="0" max="100" data-band="${Math.round(i * (N - 1) / 8)}" aria-label="Band ${f} hertz"></label>`).join('');
    const syncAlt = () => $$('[data-band]', alt).forEach(r => { r.value = Math.round(P.curve[+r.dataset.band] * 100); paint(r); }); syncAlt();
    $$('[data-band]', alt).forEach(r => r.addEventListener('input', () => { P.curve[+r.dataset.band] = +r.value / 100; paint(r); apply(); }));
    const live = $('#paint-live'); live.addEventListener('change', () => { P.live = live.checked; $('#paint-listen').hidden = P.live; if (P.live) engine.setPaint(P.curve); });
    const startSound = async () => { await ensure(); engine.setPaint(P.curve); if (!engine.isActive('paint')) await engine.startSound('paint', 0.6); await engine.playAll(); };
    $('#paint-listen').addEventListener('click', () => { engine.setPaint(P.curve); startSound(); });
    $('[data-begin="paint"]').addEventListener('click', async () => { setPhase('run'); await startSound(); });
    $$('#exp-paint [data-pact]').forEach(b => b.addEventListener('click', async () => { const a = b.dataset.pact; const snd = () => ({ type: 'paint', curve: P.curve.slice(), name: 'My painted sound' });
      if (a === 'listen') { if (engine.isActive('paint') && engine.isPlaying) { engine.pauseAll(); b.textContent = 'Listen'; } else { await startSound(); b.textContent = 'Pause'; } }
      if (a === 'save') askSave('My painted sound', n => { saveSound(Object.assign(snd(), { name: n })); toast('Saved — the painting and its sound together'); });
      if (a === 'visual') handoff(snd(), '#focus');
      if (a === 'continue') { c.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }));
    leave = () => { engine.stopAll(); };
  }

  // =====================================================================
  // 3. SOUND SCULPTOR
  // =====================================================================
  if (EXP === 'sculpt') {
    const from = store.get('proto:sculpt', null); const S = { p: Object.assign(DEF(), from && q.has('from') ? from.params : {}), nature: from && q.has('from') ? from.nature : 'none' };
    const obj = $('#sculpt-obj'), objC = $('#sculpt-obj canvas');
    liveObj(objC, () => ({ p: S.p, nature: S.nature, live: engine.isPlaying, scale: 0.36 }));
    const DIALS = [['warm', 'Warm', 'Bright', -1, 1], ['deep', 'Deep', 'Airy', -1, 1], ['smooth', 'Smooth', 'Textured', -1, 1], ['soft', 'Soft', 'Crisp', -1, 1], ['width', 'Centered', 'Wide', 0, 1], ['moving', 'Still', 'Moving', 0, 1]];
    const dials = $('#dials'); dials.innerHTML = DIALS.map(([k, a, b, lo, hi]) => `<div class="dial ${lo === 0 ? 'uni' : ''}"><div class="ends"><b data-end="${k}-a">${a}</b><b data-end="${k}-b">${b}</b></div><input type="range" id="dial-${k}" data-k="${k}" min="${lo * 100}" max="${hi * 100}" step="1" aria-label="${a} to ${b}"></div>`).join('');
    const sync = () => { DIALS.forEach(([k, a, b, lo]) => { const r = $('#dial-' + k); r.value = Math.round(S.p[k] * 100); if (lo === 0) paint(r); const v = S.p[k]; $(`[data-end="${k}-a"]`).style.color = v < (lo === 0 ? 0.33 : -0.2) ? 'var(--ink)' : 'var(--ink-3)'; $(`[data-end="${k}-b"]`).style.color = v > (lo === 0 ? 0.66 : 0.2) ? 'var(--ink)' : 'var(--ink-3)'; }); $('#sculpt-words').textContent = words(S.p, S.nature).join(' · '); $$('.tex').forEach(t => t.setAttribute('aria-pressed', t.dataset.n === S.nature)); };
    const applySound = async (restart) => { engine.setSculpt(S.p, 'sculpt'); if (restart && engine.ctx) { await engine.loadMix(soundMix(S.p, S.nature)); } };
    $$('#dials input').forEach(r => r.addEventListener('input', () => { S.p[r.dataset.k] = +r.value / 100; sync(); applySound(false); }));
    // textures
    const tex = $('#textures'); NATURES.forEach(n => { const b = document.createElement('button'); b.className = 'tex'; b.dataset.n = n; b.textContent = n === 'none' ? 'None' : NAME[n]; b.setAttribute('aria-pressed', n === S.nature); b.addEventListener('click', async () => { S.nature = n; sync(); if (engine.isPlaying) await applySound(true); }); tex.appendChild(b); });
    // direct manipulation: drag the sound itself — sideways = warm↔bright, vertical = deep↔airy
    let drag = null; obj.addEventListener('pointerdown', e => { if (e.target.closest('.core')) return; drag = { x: e.clientX, y: e.clientY, warm: S.p.warm, deep: S.p.deep }; try { obj.setPointerCapture(e.pointerId); } catch (_) { } });
    obj.addEventListener('pointermove', e => { if (!drag) return; const r = obj.getBoundingClientRect(); S.p.warm = clamp(drag.warm + (e.clientX - drag.x) / (r.width * 0.5), -1, 1); S.p.deep = clamp(drag.deep - (e.clientY - drag.y) / (r.height * 0.5), -1, 1); sync(); applySound(false); });
    addEventListener('pointerup', () => { drag = null; });
    obj.addEventListener('keydown', e => { const step = 0.08; let used = true; if (e.key === 'ArrowRight') S.p.warm = clamp(S.p.warm + step, -1, 1); else if (e.key === 'ArrowLeft') S.p.warm = clamp(S.p.warm - step, -1, 1); else if (e.key === 'ArrowUp') S.p.deep = clamp(S.p.deep + step, -1, 1); else if (e.key === 'ArrowDown') S.p.deep = clamp(S.p.deep - step, -1, 1); else used = false; if (used) { e.preventDefault(); sync(); applySound(false); } });
    const play = $('#sculpt-play'); const syncPlay = () => { const on = !!engine.isPlaying; play.setAttribute('aria-pressed', on); play.setAttribute('aria-label', on ? 'Pause' : 'Play'); }; engine.on(t => { if (t === 'state' || t === 'sounds') syncPlay(); });
    play.addEventListener('click', async () => { await ensure(); if (engine.isPlaying) await engine.pauseAll(); else { if (!engine.isActive('sculpt')) await engine.loadMix(soundMix(S.p, S.nature)); else await engine.playAll(); } syncPlay(); });
    $('[data-begin="sculpt"]').addEventListener('click', async () => { setPhase('run'); await ensure(); await engine.loadMix(soundMix(S.p, S.nature)); syncPlay(); });
    $$('#exp-sculpt [data-sact]').forEach(b => b.addEventListener('click', async () => { const a = b.dataset.sact; const snd = () => ({ type: 'sculpt', params: Object.assign({}, S.p), nature: S.nature, natureVol: 0.32, name: 'My sculpted sound' });
      if (a === 'save') askSave('My sculpted sound', n => { saveSound(Object.assign(snd(), { name: n })); toast('Saved to My sounds'); });
      if (a === 'visual') handoff(snd(), '#focus');
      if (a === 'sleep') handoff(Object.assign(snd(), { params: Object.assign({}, S.p, { moving: 0 }), name: 'My sleep sound' }), '#sleep');
      if (a === 'reset') { S.p = DEF(); S.nature = 'none'; sync(); if (engine.isPlaying) await applySound(true); } }));
    sync();
    leave = () => { engine.stopAll(); syncPlay(); };
  }

  // dev: ?phase=run|result (screenshots)
  if (q.get('phase')) { document.body.dataset.phase = q.get('phase'); $('#exit').hidden = false; if (EXP === 'find' && q.get('phase') === 'result') { find.result = { params: Object.assign(DEF(), { colour: 0.3, warm: -0.4, deep: -0.3, width: 0.6, moving: 0.2 }), nature: 'rain' }; const ws = words(find.result.params, find.result.nature); $('#find-words').textContent = ws.slice(0, 3).join(' · '); $('#find-chips').innerHTML = ws.map(x => `<span>${x}</span>`).join(''); } if (EXP === 'find' && q.get('phase') === 'run') { $('#find-progress').innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${i < 3 ? 'done' : i === 3 ? 'now' : ''}"></i>`).join('') + '<em>Exploring your preferences</em>'; find.sides.B = { params: Object.assign(DEF(), { colour: 0.75, warm: 0.4, moving: 0.5 }), nature: 'rain' }; } }
  window.labProto = { engine, find, setPhase };
})();
