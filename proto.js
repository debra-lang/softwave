/* Softwave prototype — one generative environment.
   The Sound Field (rings) and the Ocean (bands) are the SAME geometry: each ring becomes a band.
   "Add Visual" eases a morph parameter from 0 → 1, so the sound stretches into the environment. */
(function () {
  'use strict';
  const { Engine } = window.SoftwaveAudio;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const engine = new Engine(); window.softwave = engine;
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const store = { get(k, d) { try { const v = localStorage.getItem('softwave:' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem('softwave:' + k, JSON.stringify(v)); } catch (_) { } } };

  // ---------- sound personalities (how each sound shapes the field) ----------
  const SOUNDS = {
    white: { name: 'White Noise', tags: 'Fine • Bright • Even', preview: 'fine particles', rings: 12, amp: 0.05, speed: 1.25, harm: [7, 11, 4], wave: 2.4, tint: [150, 170, 200], light: [90, 110, 150] },
    pink:  { name: 'Pink Noise',  tags: 'Soft • Balanced • Flowing', preview: 'flowing ribbons', rings: 8, amp: 0.12, speed: 0.9, harm: [3, 5, 2], wave: 1.6, tint: [205, 160, 185], light: [150, 90, 130] },
    brown: { name: 'Brown Noise', tags: 'Deep • Warm • Steady', preview: 'large waves', rings: 7, amp: 0.15, speed: 0.55, harm: [2, 3, 1], wave: 1.0, tint: [200, 165, 125], light: [125, 90, 60] },
    rain:  { name: 'Rain',        tags: 'Cool • Textured • Steady', preview: 'vertical trails', rings: 10, amp: 0.07, speed: 1.1, harm: [9, 5, 13], wave: 2.0, tint: [140, 175, 195], light: [70, 110, 140] },
    ocean: { name: 'Ocean Waves', tags: 'Broad • Rolling • Slow', preview: 'horizontal flow', rings: 6, amp: 0.13, speed: 0.62, harm: [2, 4, 3], wave: 0.9, tint: [120, 180, 200], light: [60, 120, 150] },
  };
  const ORDER = ['white', 'pink', 'brown', 'rain', 'ocean'];
  const MAX_RINGS = 12;

  // ---------- state ----------
  const S = {
    sound: 'brown', mode: 'field',          // field | immerse | ocean
    morph: 0, morphTarget: 0,               // 0 = field, 1 = ocean
    alive: 0,                               // eases toward 1 when playing
    low: 0, lowS: 0, level: 0,              // audio energy (smoothed)
    t: 0, last: 0, lastFrame: 0,
    P: Object.assign({}, SOUNDS.brown),     // current (interpolated) personality
    reduce: false, lowPower: false, dark: true,
    idleTimer: null,
  };
  const spec = new Uint8Array(512);

  // ---------- theme / motion ----------
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const storedTheme = store.get('proto:theme', null);
  S.dark = storedTheme ? storedTheme === 'dark' : true;   // dark first
  const applyTheme = () => { document.documentElement.dataset.theme = S.dark ? 'dark' : 'light'; $('#theme-btn').textContent = S.dark ? '☀' : '☾'; $('#theme-btn').setAttribute('aria-label', S.dark ? 'Switch to light mode' : 'Switch to dark mode'); $('meta[name=theme-color]').content = S.dark ? '#0a0c12' : '#f3efe7'; };
  applyTheme();
  $('#theme-btn').addEventListener('click', () => { S.dark = !S.dark; store.set('proto:theme', S.dark ? 'dark' : 'light'); applyTheme(); });
  const rmq = matchMedia('(prefers-reduced-motion: reduce)');
  S.reduce = store.get('reduceMotion', rmq.matches);
  const applyMotion = () => $('#motion-btn').setAttribute('aria-pressed', S.reduce);
  applyMotion();
  $('#motion-btn').addEventListener('click', () => { S.reduce = !S.reduce; store.set('reduceMotion', S.reduce); applyMotion(); });
  S.lowPower = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4) || matchMedia('(max-width: 480px)').matches;

  // ---------- canvas ----------
  const cv = $('#env'), ctx = cv.getContext('2d', { alpha: false });
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(S.lowPower ? 1 : 1.5, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  addEventListener('resize', resize); resize();

  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  // Field geometry: where the rings live (centre of #field-spot), radius from its size.
  function fieldRect() { const r = $('#field-spot').getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, R: r.width / 2 }; }

  // ---------- one frame ----------
  const PTS = 160;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { S.last = now; return; }
    if (S.lowPower && now - S.lastFrame < 30) return;          // ~30 fps on modest devices
    const dt = Math.min(0.05, (now - (S.last || now)) / 1000); S.last = now; S.lastFrame = now;

    // audio energy → subtle motion (lows drive size/slowness; level drives amplitude)
    const playing = engine.isPlaying;
    if (playing && !S.reduce) { engine.getLevels(spec); let lo = 0; for (let i = 1; i < 10; i++) lo += spec[i]; lo /= 9 * 255; let all = 0; for (let i = 0; i < 200; i++) all += spec[i]; all /= 200 * 255; S.low += (lo - S.low) * 0.04; S.level += (all - S.level) * 0.06; }
    else { S.low *= 0.98; S.level *= 0.98; }
    S.alive += ((playing ? 1 : 0) - S.alive) * (playing ? 0.02 : 0.008);   // wake quickly-ish, settle slowly
    S.morph += (S.morphTarget - S.morph) * (S.reduce ? 0.08 : 0.028);
    if (Math.abs(S.morphTarget - S.morph) < 0.002) S.morph = S.morphTarget;
    // personality follows the selected sound smoothly
    const T = SOUNDS[S.sound]; for (const k of ['rings', 'amp', 'speed', 'harm', 'wave', 'tint', 'light']) { if (Array.isArray(T[k])) S.P[k] = S.P[k].map((v, i) => lerp(v, T[k][i], 0.03)); else S.P[k] = lerp(S.P[k], T[k], 0.03); }

    const life = 0.38 + 0.62 * S.alive;                         // idle breathes quietly; playing is clearly more awake
    const motion = S.reduce ? 0.06 : (0.3 + 0.7 * S.alive);
    S.t += dt * motion * S.P.speed * (1 - S.low * 0.25);       // deeper sound → slower
    const e = ease(S.morph), P = S.P, vol = engine.masterVolume;
    const { cx, cy, R } = fieldRect();
    const dark = S.dark, tint = dark ? P.tint : P.light;

    // --- background: warm-dark atmosphere ⇄ deep sky over water
    const bgA = dark ? ['#12141c', '#0a0c12'] : ['#f6f3ec', '#ebe6dc'];
    let g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, Math.max(W, H) * 0.9); g.addColorStop(0, bgA[0]); g.addColorStop(1, bgA[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // sound tint, very low
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.2); g.addColorStop(0, rgba(tint, dark ? 0.10 : 0.12)); g.addColorStop(1, rgba(tint, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (e > 0.001) {
      ctx.globalAlpha = e;
      const hz = H * 0.42;
      g = ctx.createLinearGradient(0, 0, 0, hz * 1.1); if (dark) { g.addColorStop(0, '#070a13'); g.addColorStop(0.7, '#101a2e'); g.addColorStop(1, '#1a2a44'); } else { g.addColorStop(0, '#eef2f5'); g.addColorStop(0.7, '#dbe5ec'); g.addColorStop(1, '#c9d9e3'); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz * 1.1);
      // low light near the horizon
      const lx = W * 0.66, ly = hz * 0.86; g = ctx.createRadialGradient(lx, ly, 0, lx, ly, W * 0.36); g.addColorStop(0, dark ? 'rgba(210,200,180,0.22)' : 'rgba(255,250,235,0.75)'); g.addColorStop(1, 'rgba(210,200,180,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz * 1.1);
      ctx.globalAlpha = 1;
    }

    // --- rings ⇄ bands
    const breathe = 1 + (0.03 * Math.sin(S.t * 0.5) * life + S.low * 0.07) * (S.reduce ? 0.3 : 1);
    const ampK = (0.6 + 0.55 * S.alive) * (0.8 + vol * 0.4) * (1 + S.level * 0.6);
    const grow = 1 + 0.38 * ease(clamp(S.morph * 2.2, 0, 1));      // the field expands first, then transforms
    const nR = Math.round(P.rings);
    const far = dark ? [16, 32, 52] : [186, 208, 222], near = dark ? [5, 11, 20] : [104, 146, 176];
    for (let i = 0; i < MAX_RINGS; i++) {
      const ringA = clamp(nR - i, 0, 1); if (ringA <= 0 && e < 0.01) continue;
      const f = (i + 1) / Math.max(1, nR);                          // 0..1 outer→inner index share
      const idx = MAX_RINGS - 1 - i;                                // draw order: outer first
      const k = MAX_RINGS - 1 - idx; // = i
      const rr = R * (0.16 + 0.84 * Math.pow(1 - i / Math.max(1, nR - 1), 0.85)) * breathe * grow * (1 + 0.035 * Math.sin(S.t * 0.33 + i * 1.9) * life);  // ring i: large → small, each breathing slightly apart
      const dx = R * 0.045 * Math.sin(S.t * 0.3 + i * 1.7) * life, dy = R * 0.04 * Math.cos(S.t * 0.26 + i * 2.3) * life;   // slow drift separates the layers (depth)
      // band geometry for this ring (ocean): far (high) for large rings, near (low) for small rings
      const bi = i / Math.max(1, nR - 1);                           // 0 far → 1 near
      const hz = H * 0.42, yb = hz + (H - hz) * Math.pow(bi, 1.35) * 1.02 + 4;
      const bandAmp = H * (0.010 + 0.04 * bi) * (0.7 + S.alive * 0.5 + S.low * 0.6) * (S.reduce ? 0.35 : 1);
      ctx.beginPath();
      for (let p = 0; p <= PTS; p++) {
        const th = Math.PI + (p / PTS) * TAU;   // start at the left so the upper arc becomes the band's top edge
        // field point: organic ring
        const d = 1 + P.amp * ampK * (0.5 * Math.sin(P.harm[0] * th + S.t * 0.5 + i * 1.3) + 0.32 * Math.sin(P.harm[1] * th - S.t * 0.37 + i * 2.1) + 0.25 * Math.sin(P.harm[2] * th + S.t * 0.23 - i * 0.7) + 0.22 * Math.sin(th + S.t * 0.15 + i * 2.9));
        const fx = cx + dx + Math.cos(th) * rr * d, fy = cy + dy + Math.sin(th) * rr * d;
        let x = fx, y = fy;
        if (e > 0.001) {
          // ocean point: first half of the ring becomes the wavy top edge, second half closes below the screen
          // ribbon: wavy top edge left→right, then a wavy bottom edge right→left (covered by the next band)
          const top = p <= PTS / 2; const u = top ? p / (PTS / 2) : 1 - (p - PTS / 2) / (PTS / 2);
          const ox = top ? (-0.15 + 1.3 * u) * W : (-0.22 + 1.44 * u) * W; const ph = u * TAU * P.wave;
          const wv = bandAmp * (Math.sin(ph * 1.2 + S.t * 0.35 * (1 + bi * 0.4) + i) + 0.5 * Math.sin(ph * 2.7 - S.t * 0.22 + i * 1.7) + 0.3 * Math.sin(ph * 0.6 + S.t * 0.12));
          const oy = top ? yb + wv : Math.min(H + 80, yb + (H - yb) * 0.55 + 90) + wv * 0.6;
          const ex = ease(clamp(S.morph * 1.2, 0, 1)), ey = e;   // width stretches slightly ahead of height
          x = lerp(fx, ox, ex); y = lerp(fy, oy, ey);
        }
        p ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      // colour: translucent tinted ring ⇄ solid layered water
      const depth = 0.55 + 0.45 * (i / Math.max(1, nR - 1));    // inner rings nearer
      const fieldFill = rgba(tint, (dark ? 0.045 : 0.04) * ringA * depth), fieldStroke = rgba(dark ? mix3(tint, [255, 255, 255], 0.35) : tint, (dark ? 0.28 : 0.34) * (0.45 + 0.55 * depth) * ringA);
      const wc = mix3(far, near, bi);
      if (e < 0.999) { ctx.fillStyle = fieldFill; ctx.globalAlpha = 1 - e; ctx.fill(); ctx.strokeStyle = fieldStroke; ctx.lineWidth = 1.5 - i / MAX_RINGS; ctx.stroke(); }
      if (e > 0.001) { ctx.globalAlpha = e * (0.82 + 0.18 * bi); ctx.fillStyle = rgba(wc, 1); ctx.fill(); ctx.globalAlpha = e; ctx.strokeStyle = dark ? `rgba(170,210,235,${0.10 + 0.1 * (1 - bi)})` : `rgba(255,255,255,${0.35})`; ctx.lineWidth = 1; ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    // --- ocean: light on the water + haze
    if (e > 0.001) {
      ctx.globalAlpha = e;
      const hz = H * 0.42, lx = W * 0.66; const sw = W * (0.16 + 0.06 * S.low);
      ctx.save(); ctx.translate(lx, hz); ctx.scale(1, 2.2 + S.low); g = ctx.createRadialGradient(0, 0, 0, 0, 0, sw); g.addColorStop(0, dark ? 'rgba(225,210,185,0.20)' : 'rgba(255,250,235,0.55)'); g.addColorStop(0.55, dark ? 'rgba(225,210,185,0.06)' : 'rgba(255,250,235,0.2)'); g.addColorStop(1, 'rgba(225,210,185,0)'); ctx.fillStyle = g; ctx.fillRect(-sw, 0, sw * 2, sw); ctx.restore();
      g = ctx.createLinearGradient(0, hz - 40, 0, hz + 80); g.addColorStop(0, dark ? 'rgba(16,26,46,0)' : 'rgba(220,232,240,0)'); g.addColorStop(0.5, dark ? 'rgba(16,26,46,0.55)' : 'rgba(220,232,240,0.6)'); g.addColorStop(1, 'rgba(16,26,46,0)'); ctx.fillStyle = g; ctx.fillRect(0, hz - 40, W, 120);
      ctx.globalAlpha = 1;
    }
    // --- centre glow behind the play control (field only)
    if (e < 0.999) { ctx.globalAlpha = 1 - e; g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.5); g.addColorStop(0, rgba(tint, (dark ? 0.18 : 0.2) * (0.55 + S.alive * 0.45))); g.addColorStop(1, rgba(tint, 0)); ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2); ctx.globalAlpha = 1; }

    // previews (15 fps)
    if (now - prevLast > 66) { prevLast = now; drawPreviews(now / 1000); }
  }
  requestAnimationFrame(frame);

  // ---------- selector previews: five small living pictures ----------
  let prevLast = 0; const previews = [];
  function buildSelector() {
    const host = $('#selector');
    for (const id of ORDER) {
      const d = SOUNDS[id]; const el = document.createElement('button'); el.className = 'sel'; el.setAttribute('role', 'radio'); el.dataset.id = id; el.setAttribute('aria-checked', id === S.sound);
      el.innerHTML = `<canvas width="168" height="112" aria-hidden="true"></canvas><b>${d.name.replace(' Noise', '').replace(' Waves', '')}</b><small>${d.preview}</small>`;
      el.addEventListener('click', () => selectSound(id)); host.appendChild(el); previews.push({ id, c: el.querySelector('canvas'), el });
    }
  }
  function drawPreviews(t) {
    for (const pv of previews) {
      const c = pv.c, x = c.getContext('2d'), w = c.width, h = c.height, d = SOUNDS[pv.id], dark = S.dark, tint = dark ? d.tint : d.light; const mo = S.reduce ? 0.1 : 1;
      x.fillStyle = dark ? '#12151d' : '#eae5db'; x.fillRect(0, 0, w, h);
      x.strokeStyle = rgba(tint, dark ? 0.6 : 0.7); x.fillStyle = rgba(tint, dark ? 0.6 : 0.7); x.lineWidth = 1.5;
      if (pv.id === 'white') { for (let i = 0; i < 60; i++) { const px = ((i * 37.3 + t * 9 * mo) % w), py = ((i * 53.7 + Math.sin(t * 0.7 * mo + i) * 6) % h + h) % h; x.globalAlpha = 0.3 + 0.5 * ((i * 7) % 10) / 10; x.beginPath(); x.arc(px, py, 1.2, 0, TAU); x.fill(); } x.globalAlpha = 1; }
      else if (pv.id === 'pink') { for (let r = 0; r < 4; r++) { x.beginPath(); for (let px = 0; px <= w; px += 6) { const py = h / 2 + Math.sin(px / w * 6 + t * 0.8 * mo + r) * 12 + (r - 1.5) * 10; px ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); } }
      else if (pv.id === 'brown') { for (let r = 0; r < 3; r++) { x.beginPath(); const rr = 16 + r * 14 + Math.sin(t * 0.5 * mo + r) * 3; for (let p = 0; p <= 48; p++) { const th = p / 48 * TAU; const dd = 1 + 0.08 * Math.sin(2 * th + t * 0.4 * mo + r); const px = w / 2 + Math.cos(th) * rr * dd, py = h / 2 + Math.sin(th) * rr * dd * 0.75; p ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.stroke(); } }
      else if (pv.id === 'rain') { for (let i = 0; i < 22; i++) { const px = (i * 29) % w + Math.sin(i) * 4, py = ((i * 41 + t * 60 * mo) % (h + 20)) - 10; x.globalAlpha = 0.35 + (i % 3) * 0.2; x.beginPath(); x.moveTo(px, py); x.lineTo(px, py + 10); x.stroke(); } x.globalAlpha = 1; }
      else { for (let r = 0; r < 4; r++) { x.beginPath(); for (let px = 0; px <= w; px += 6) { const py = 30 + r * 18 + Math.sin(px / w * 3 + t * 0.35 * mo + r * 1.3) * 5; px ? x.lineTo(px, py) : x.moveTo(px, py); } x.lineTo(w, h); x.lineTo(0, h); x.closePath(); x.globalAlpha = 0.25 + r * 0.12; x.fill(); } x.globalAlpha = 1; }
    }
  }

  // ---------- sound control ----------
  let layers = new Set();   // extra mixer layers
  async function ensure() { engine.setMasterVolume(+$('#vol').value / 100, true); await engine.init(); }
  async function selectSound(id) {
    if (id === S.sound) { return; }
    const prev = S.sound; S.sound = id; document.body.dataset.sound = id;
    $('#sound-name').textContent = SOUNDS[id].name; $('#sound-tags').textContent = SOUNDS[id].tags; $('#ocean-sound').textContent = SOUNDS[id].name;
    for (const pv of previews) pv.el.setAttribute('aria-checked', pv.id === id);
    $$('#ocean-sound-chips .chip').forEach(c => c.classList.toggle('active', c.dataset.id === id));
    if (engine.ctx && (engine.isActive(prev) || engine.isPlaying)) { await ensure(); await engine.startSound(id, 0.6); engine.stopSound(prev); if (!engine.isPlaying) await engine.playAll(); }
    syncPlay();
  }
  async function togglePlay() {
    await ensure();
    if (engine.isPlaying) { await engine.pauseAll(); }
    else { if (!engine.isActive(S.sound)) await engine.startSound(S.sound, 0.6); for (const l of layers) if (!engine.isActive(l)) await engine.startSound(l, 0.3); await engine.playAll(); }
    syncPlay();
  }
  function syncPlay() { const on = !!engine.isPlaying; for (const b of [$('#play'), $('#ocean-play')]) { b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Pause' : 'Play'); } }
  engine.on(t => { if (t === 'state' || t === 'sounds') syncPlay(); if (t === 'timer') syncTimer(); });
  $('#play').addEventListener('click', togglePlay); $('#ocean-play').addEventListener('click', togglePlay);
  document.addEventListener('pointerdown', () => engine.prepare(), { once: true, passive: true });

  // volume (both sliders mirror each other)
  function paint(inp) { inp.style.setProperty('--p', inp.value + '%'); }
  function setVol(v) { engine.setMasterVolume(v / 100); for (const i of [$('#vol'), $('#ocean-vol')]) { i.value = v; paint(i); } $('#vol-out').textContent = v + '%'; store.set('proto:vol', v); }
  for (const i of [$('#vol'), $('#ocean-vol')]) i.addEventListener('input', () => setVol(+i.value));
  setVol(store.get('proto:vol', 35));

  // timer
  function syncTimer() { const t = engine.timer; const label = t.endsAt ? `Timer · ${Math.max(1, Math.ceil((t.endsAt - Date.now()) / 60000))} min` : 'Timer'; $('#act-timer').textContent = label; $('#ocean-timer').textContent = label; }
  setInterval(syncTimer, 15000);
  $$('[data-act="timer"]').forEach(b => b.addEventListener('click', () => { const sh = $('#timer-sheet'); sh.hidden = !sh.hidden; if (!sh.hidden) { const r = b.getBoundingClientRect(); sh.style.position = 'fixed'; sh.style.left = clamp(r.left + r.width / 2 - 150, 8, innerWidth - 308) + 'px'; sh.style.top = (S.mode === 'ocean' ? r.top - 110 : r.bottom + 8) + 'px'; sh.style.width = '300px'; sh.style.zIndex = 8; } }));
  $$('#timer-sheet .chip').forEach(c => c.addEventListener('click', () => { const m = +c.dataset.min; if (m) { engine.setTimer(m, true); toast(`Fading out in ${m} minutes`); } else { engine.clearTimer(); toast('Timer off'); } $('#timer-sheet').hidden = true; syncTimer(); }));

  // mixer: layer a second sound under the main one (real, minimal)
  const mixChips = $('#mixer-chips');
  for (const id of ['rain', 'ocean', 'pink', 'white']) { const c = document.createElement('button'); c.className = 'chip'; c.dataset.id = id; c.textContent = SOUNDS[id].name; c.addEventListener('click', async () => { if (id === S.sound) return toast('That is the main sound'); await ensure(); if (layers.has(id)) { layers.delete(id); engine.stopSound(id); c.classList.remove('active'); } else { layers.add(id); await engine.startSound(id, 0.3); if (!engine.isActive(S.sound)) await engine.startSound(S.sound, 0.6); await engine.playAll(); c.classList.add('active'); } }); mixChips.appendChild(c); }
  $('[data-act="mixer"]').addEventListener('click', () => { const sh = $('#mixer-sheet'); sh.hidden = !sh.hidden; });
  $('[data-act="save"]').addEventListener('click', () => { const saved = store.get('proto:saved', []); saved.unshift({ sound: S.sound, layers: [...layers], vol: engine.masterVolume, visual: S.mode === 'ocean' ? 'ocean' : 'field', at: Date.now() }); store.set('proto:saved', saved.slice(0, 20)); toast(`${SOUNDS[S.sound].name}${S.mode === 'ocean' ? ' + Ocean' : ''} saved on this device`); });

  // ---------- modes ----------
  function setMode(m) { S.mode = m; document.body.dataset.mode = m; $('#exit-immerse').hidden = m !== 'immerse'; $('#ocean-ui').hidden = false; resetIdle(); if (m === 'field') { document.body.classList.remove('idle'); } }
  $('#immerse').addEventListener('click', () => setMode('immerse'));
  $('#exit-immerse').addEventListener('click', () => setMode('field'));

  // Brown Noise → Ocean: the field stretches into the environment; sound never stops
  async function enterOcean() {
    if (!engine.isPlaying && !engine.isActive(S.sound)) { await togglePlay(); }   // arriving silent feels wrong; start gently
    document.body.classList.add('transit'); $('#ocean-ui').hidden = false;
    S.morphTarget = 1; setTimeout(() => { setMode('ocean'); document.body.classList.remove('transit'); }, S.reduce ? 200 : 900);
  }
  function exitOcean() {
    S.morphTarget = 0; $$('#ocean-sounds, #ocean-visuals').forEach(s => s.hidden = true);
    setMode(S.mode === 'ocean' && wasImmersed ? 'immerse' : 'field');
  }
  let wasImmersed = false;
  $$('[data-act="visual"]').forEach(b => b.addEventListener('click', () => { if (S.mode === 'ocean') { const sh = $('#ocean-visuals'); sh.hidden = !sh.hidden; $('#ocean-sounds').hidden = true; } else { wasImmersed = S.mode === 'immerse'; enterOcean(); } }));
  $('#ocean-exit').addEventListener('click', exitOcean);
  $$('#ocean-visuals .chip').forEach(c => c.addEventListener('click', () => { if (c.dataset.vis === 'field') { wasImmersed = true; exitOcean(); } else $('#ocean-visuals').hidden = true; }));
  $('[data-act="sound"]').addEventListener('click', () => { const sh = $('#ocean-sounds'); sh.hidden = !sh.hidden; $('#ocean-visuals').hidden = true; });
  const osc = $('#ocean-sound-chips');
  for (const id of ORDER) { const c = document.createElement('button'); c.className = 'chip' + (id === S.sound ? ' active' : ''); c.dataset.id = id; c.textContent = SOUNDS[id].name; c.addEventListener('click', () => { selectSound(id); $('#ocean-sounds').hidden = true; }); osc.appendChild(c); }

  // idle: controls fade after 5 s in immerse / ocean; any movement brings them back
  function resetIdle() { document.body.classList.remove('idle'); clearTimeout(S.idleTimer); if (S.mode !== 'field' && !location.search.includes('snap')) S.idleTimer = setTimeout(() => document.body.classList.add('idle'), 5000); }
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'touchstart']) addEventListener(ev, resetIdle, { passive: true });
  document.addEventListener('keydown', e => { if (e.target.matches('input, button')) return; if (e.key === ' ') { e.preventDefault(); togglePlay(); } if (e.key === 'Escape') { if (S.mode === 'ocean') exitOcean(); else if (S.mode === 'immerse') setMode('field'); } });

  // ---------- toast ----------
  let toastT; function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600); }

  // ---------- boot ----------
  buildSelector(); syncPlay(); syncTimer();
  requestAnimationFrame(() => { const sel = $('.sel[aria-checked="true"]'); if (sel) sel.scrollIntoView({ inline: 'center', block: 'nearest' }); scrollTo(0, 0); });
  const q = new URLSearchParams(location.search);
  if (q.has('light')) { S.dark = false; applyTheme(); }
  if (q.has('ocean')) { S.morph = S.morphTarget = 1; setMode('ocean'); }
  if (q.has('immerse')) setMode('immerse');
  if (q.has('alive')) S.alive = 1;     // screenshots: show the field awake without audio
  window.softwaveProto = { S, enterOcean, exitOcean, selectSound, togglePlay, setMode };
})();
