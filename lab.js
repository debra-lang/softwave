/* Softwave — Experiments & The Lab
   Optional, clearly-labelled experimental tools. Every experiment declares what it does, why someone
   might try it, how to use it, its settings, and an evidence note (see RESEARCH.md). Feedback, history
   and the preference profile are stored locally only. Nothing here changes the simple main flow.
*/
(function () {
  'use strict';
  const engine = window.softwave, app = window.softwaveApp, focus = window.softwaveFocus;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = app.store;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmtHz = f => Math.round(f).toLocaleString('en-US') + ' Hz';
  const SOUND_NAME = id => (engine.def(id) || { name: id }).name;
  const LIB = engine.defs().map(d => d.id);
  const ALL_VISUALS = focus.visuals;

  // ---------- local records ----------
  const fb = () => store.get('lab:feedback', {});          // id -> { rating, comfort, again, tries, last }
  const setFb = (id, patch) => { const all = fb(); all[id] = Object.assign({ tries: 0 }, all[id] || {}, patch); store.set('lab:feedback', all); };
  const favs = () => store.get('lab:favs', []);
  const EVIDENCE_LABEL = { established: 'Well-studied principle', promising: 'Promising research', exploratory: 'Experimental — research is limited', limited: 'Experimental — evidence is mixed or limited' };

  // ---------- timers / runtime ----------
  let running = null;           // { exp, ctx }
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const every = (fn, ms) => { const t = setInterval(fn, ms); timers.add(t); return t; };
  function clearTimers() { timers.forEach(t => { clearTimeout(t); clearInterval(t); }); timers.clear(); }

  // Journey runner: segments [{ min, mix: [{id, volume}] }], crossfade in seconds
  function runJourney(segments, opts = {}) {
    const xf = opts.crossfade || 90; const union = [...new Set(segments.flatMap(s => s.mix.map(m => m.id)))].slice(0, 5);
    const apply = async (seg, fade) => {
      for (const id of union) { const m = seg.mix.find(x => x.id === id); if (m) { if (!engine.isActive(id)) await engine.startSound(id, 0.001); engine.rampVolume(id, m.volume, fade); } else if (engine.isActive(id)) engine.rampVolume(id, 0.0001, fade); }
    };
    let k = 0; const total = segments.reduce((a, s) => a + s.min, 0);
    const step = async () => {
      const seg = segments[k % segments.length]; await apply(seg, k === 0 ? 3 : xf); app.toast(`Journey: ${seg.label || ('part ' + (k % segments.length + 1))}`, 2500);
      k++; if (k >= segments.length && !opts.loop) { later(() => { if (opts.onEnd) opts.onEnd(); }, seg.min * 60000); return; }
      later(step, seg.min * 60000);
    };
    engine.playAll(); step(); return { total };
  }

  // ---------- settings renderer ----------
  function renderSettings(exp, ctx, host) {
    host.innerHTML = '';
    (exp.settings || []).forEach(st => {
      const row = document.createElement('div'); row.className = 'lab-setting';
      const id = `st-${exp.id}-${st.key}`;
      if (st.type === 'select' || st.type === 'sound' || st.type === 'visual') {
        const opts = st.type === 'sound' ? LIB.map(i => [i, SOUND_NAME(i)]) : st.type === 'visual' ? ALL_VISUALS.map(v => [v.id, v.name]) : st.options;
        row.innerHTML = `<label for="${id}">${st.label}</label><select id="${id}" class="select">${opts.map(o => `<option value="${o[0]}" ${String(ctx.s[st.key]) === String(o[0]) ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
        $('select', row).addEventListener('change', e => { ctx.s[st.key] = e.target.value; exp.onSetting && exp.onSetting(ctx, st.key); });
      } else if (st.type === 'buttons') {
        row.innerHTML = `<span class="label-sm">${st.label}</span><div class="seg" role="radiogroup" aria-label="${st.label}">${st.options.map(o => `<button role="radio" aria-checked="${String(ctx.s[st.key]) === String(o[0])}" data-v="${o[0]}">${o[1]}</button>`).join('')}</div>`;
        $$('button', row).forEach(b => b.addEventListener('click', () => { ctx.s[st.key] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; $$('button', row).forEach(x => x.setAttribute('aria-checked', x === b)); exp.onSetting && exp.onSetting(ctx, st.key); }));
      } else if (st.type === 'range') {
        row.innerHTML = `<label for="${id}">${st.label} <output>${st.fmt ? st.fmt(ctx.s[st.key]) : ctx.s[st.key]}</output></label><input id="${id}" type="range" min="${st.min}" max="${st.max}" step="${st.step || 1}" value="${ctx.s[st.key]}">${st.scale ? `<div class="scale">${st.scale.map(x => `<span>${x}</span>`).join('')}</div>` : ''}`;
        const r = $('input', row); app.paintRange(r);
        r.addEventListener('input', () => { ctx.s[st.key] = +r.value; $('output', row).textContent = st.fmt ? st.fmt(+r.value) : r.value; exp.onSetting && exp.onSetting(ctx, st.key); });
      } else if (st.type === 'toggle') {
        row.innerHTML = `<label class="switch"><input id="${id}" type="checkbox" ${ctx.s[st.key] ? 'checked' : ''}><span class="track" aria-hidden="true"></span><span>${st.label}</span></label>`;
        $('input', row).addEventListener('change', e => { ctx.s[st.key] = e.target.checked; exp.onSetting && exp.onSetting(ctx, st.key); });
      }
      host.appendChild(row);
    });
  }

  // ---------- helpers shared by experiments ----------
  const regionFreq = () => (store.get('lab:region') || store.get('match') || {}).freq || 4000;
  const REGION_LABEL = () => { const r = store.get('lab:region'); return r ? `${fmtHz(r.lo)} – ${fmtHz(r.hi)} (about ${fmtHz(r.freq)})` : (store.get('match') ? `about ${fmtHz(store.get('match').freq)} (from Find My Sound)` : 'not set yet'); };
  const safeMaster = () => { if (engine.masterVolume > 0.5) app.setMaster(0.4); };
  const ENVS = {
    cabinrain: { name: 'Cabin During Rain', mix: [{ id: 'rain', volume: 0.55 }, { id: 'thunder', volume: 0.5 }, { id: 'fire', volume: 0.45 }, { id: 'pink', volume: 0.2 }] },
    nightbeach: { name: 'Night Beach', mix: [{ id: 'ocean', volume: 0.6 }, { id: 'wind', volume: 0.3 }, { id: 'brown', volume: 0.3 }] },
    airplane: { name: 'Airplane Cabin', mix: [{ id: 'cabin', volume: 0.6 }, { id: 'brown', volume: 0.25 }] },
    stream: { name: 'Mountain Stream', mix: [{ id: 'stream', volume: 0.55 }, { id: 'wind', volume: 0.3 }, { id: 'forest', volume: 0.3 }] },
    cityrain: { name: 'Quiet City Rain', mix: [{ id: 'rain', volume: 0.5 }, { id: 'city', volume: 0.35 }, { id: 'pink', volume: 0.15 }] },
  };

  // =====================================================================
  // EXPERIMENTS
  // =====================================================================
  const EXPERIMENTS = [
    // ---------------- SOUND ----------------
    {
      id: 'journey', name: 'Adaptive Sound Journey', cat: 'Sound', tags: ['changing', 'nature', 'noise'], evidence: 'exploratory', from: 'Generative audio / habituation research',
      what: 'A soundscape that evolves very slowly instead of looping the same thing: brown noise and rain, rain thinning out, ocean drifting in, the balance shifting.',
      why: 'A loop becomes familiar, and a familiar sound is easier for the brain to tune out — which can let the tinnitus back in. Slow change keeps the sound gently interesting without demanding attention.',
      how: 'Pick a length and press Start. Transitions take about a minute and a half each. Use the main volume as usual.',
      whyTest: 'Sound-therapy research mostly tests steady sounds; we are checking whether a slowly evolving environment feels more comfortable over a long session. Evidence: no direct trials; the idea comes from generative ambient audio and from habituation research on novelty.',
      limits: 'Some people prefer a perfectly steady sound. Try Living Sound "Very stable" if change bothers you.',
      settings: [{ key: 'len', label: 'Length', type: 'buttons', options: [[10, '10 min'], [20, '20 min'], [30, '30 min'], [60, '60 min'], [0, 'Infinite']] }],
      defaults: { len: 20 },
      start(ctx) {
        safeMaster(); const L = ctx.s.len || 60; const u = L / 4;
        const segs = [
          { min: u, label: 'brown noise + soft rain', mix: [{ id: 'brown', volume: 0.55 }, { id: 'rain', volume: 0.4 }] },
          { min: u, label: 'rain easing off', mix: [{ id: 'brown', volume: 0.55 }, { id: 'rain', volume: 0.15 }] },
          { min: u, label: 'ocean drifting in', mix: [{ id: 'brown', volume: 0.4 }, { id: 'ocean', volume: 0.45 }, { id: 'rain', volume: 0.05 }] },
          { min: u, label: 'softer balance', mix: [{ id: 'pink', volume: 0.3 }, { id: 'ocean', volume: 0.35 }, { id: 'brown', volume: 0.25 }] },
        ];
        runJourney(segs, { crossfade: Math.min(90, u * 30), loop: !ctx.s.len, onEnd: () => { stopRunning('Journey finished'); } });
      },
    },
    {
      id: 'living', name: 'Living Sound', cat: 'Sound', tags: ['changing', 'noise'], evidence: 'exploratory', from: 'Generative art / procedural audio',
      what: 'Adds tiny, continuous variations to whatever is playing — level, brightness and width drift like a real environment — so the sound never repeats exactly.',
      why: 'Real rain and real wind never sound the same twice. Small variation may feel more natural and less "machine-like" than a perfect loop.',
      how: 'Start any sounds first (or use the preset below), then set how much change you want. "Very stable" is almost a loop; "Constantly changing" is clearly alive.',
      whyTest: 'We want to learn where on the stable ↔ changing scale people with tinnitus feel most at ease. Evidence: none specific to tinnitus; borrowed from ambient sound design.',
      limits: 'Variation is intentionally subtle; turn it up if you cannot hear any change.',
      settings: [{ key: 'amount', label: 'Predictability', type: 'range', min: 0, max: 100, value: 35, scale: ['Very stable', 'Gently alive', 'Constantly changing'], fmt: v => v < 15 ? 'Very stable' : v < 45 ? 'Slight variation' : v < 75 ? 'Organic' : 'Constantly changing' }, { key: 'base', label: 'If nothing is playing, start with', type: 'select', options: [['rain', 'Rain'], ['brown', 'Brown noise'], ['ocean', 'Ocean'], ['wind', 'Wind'], ['forest', 'Forest'], ['none', 'Nothing — I have my own mix']] }],
      defaults: { amount: 35, base: 'rain' },
      async start(ctx) { safeMaster(); if (!engine.activeList().length && ctx.s.base !== 'none') await engine.startSound(ctx.s.base, 0.5); await engine.playAll(); engine.setVariation(ctx.s.amount / 100, 8 - ctx.s.amount / 25); },
      onSetting(ctx) { if (running && running.exp.id === 'living') engine.setVariation(ctx.s.amount / 100, 8 - ctx.s.amount / 25); },
      stop() { engine.setVariation(0); }, keepsSound: true,
    },
    {
      id: 'morph', name: 'Sound Morphing', cat: 'Sound', tags: ['noise', 'nature'], evidence: 'exploratory', from: 'Music-production macro controls',
      what: 'One slider that glides through a continuum: Brown → Brown+Pink → Pink → Pink+Rain → Rain. No separate volume sliders.',
      why: 'Sometimes the comfortable spot is "between" two sounds. A single control makes that easy to find by feel.',
      how: 'Press Start, then drag the slider slowly and stop where it feels best.',
      whyTest: 'A test of whether a one-dimensional control finds a comfortable blend faster than a mixer. Evidence: usability idea from synthesiser design, not a clinical concept.',
      settings: [{ key: 'pos', label: 'Continuum', type: 'range', min: 0, max: 100, scale: ['Brown', 'Pink', 'Rain'], fmt: v => v < 12 ? 'Brown noise' : v < 38 ? 'Brown + pink' : v < 62 ? 'Pink noise' : v < 88 ? 'Pink + rain' : 'Rain' }],
      defaults: { pos: 25 },
      async start(ctx) { safeMaster(); engine.stopAll(); for (const id of ['brown', 'pink', 'rain']) await engine.startSound(id, 0.001); this.onSetting(ctx); await engine.playAll(); },
      onSetting(ctx) { if (!running || running.exp.id !== 'morph') return; const p = ctx.s.pos / 100; const tri = (c, w) => clamp(1 - Math.abs(p - c) / w, 0, 1); engine.setVolume('brown', 0.6 * tri(0, 0.5)); engine.setVolume('pink', 0.55 * tri(0.5, 0.5)); engine.setVolume('rain', 0.55 * tri(1, 0.5)); },
    },
    {
      id: 'paint', name: 'Frequency Painting', cat: 'Sound', tags: ['noise', 'creative'], evidence: 'exploratory', from: 'Spectral shaping / equalisation',
      what: 'Draw the shape of your noise. Left is low, right is high; higher means stronger. The noise you hear matches the curve you draw.',
      why: 'Everyone’s comfortable noise is different — some want the lows, some want an airy hiss, some want a dip right where the tinnitus sits.',
      how: 'Press Start, then draw across the canvas with a finger or mouse. Use Smooth to soften bumps, Erase to lower areas, Randomize for ideas.',
      whyTest: 'Does a drawn spectrum find a comfortable sound faster than picking colours of noise? Evidence: spectral shaping is standard audio practice; personal preference is the only outcome we measure.',
      custom: true, defaults: {},
      buildUI(ctx, host) {
        host.innerHTML = `<canvas class="paint-canvas" width="720" height="240" aria-label="Frequency painting canvas"></canvas><div class="scale"><span>60 Hz</span><span>500</span><span>2k</span><span>6k</span><span>14 kHz</span></div><div class="btn-row"><button class="btn btn-ghost btn-sm" data-act="smooth">Smooth</button><button class="btn btn-ghost btn-sm" data-act="erase" aria-pressed="false">Erase</button><button class="btn btn-ghost btn-sm" data-act="reset">Reset</button><button class="btn btn-ghost btn-sm" data-act="random">Randomize</button><button class="btn btn-secondary btn-sm" data-act="save">Save curve</button></div><div class="lab-saved" data-saved></div>`;
        const c = $('canvas', host), cx = c.getContext('2d'); ctx.curve = (store.get('lab:paintcurve') || new Array(24).fill(0.5)).slice(); let erase = false, down = false;
        const draw = () => { const w = c.width, h = c.height; cx.clearRect(0, 0, w, h); const dark = document.documentElement.dataset.theme === 'dark'; cx.fillStyle = dark ? '#0f1430' : '#eef1fa'; cx.fillRect(0, 0, w, h); const bw = w / 24; const g = cx.createLinearGradient(0, h, 0, 0); g.addColorStop(0, '#5fb8c9'); g.addColorStop(1, '#3f6cf0'); for (let i = 0; i < 24; i++) { const v = ctx.curve[i]; cx.fillStyle = g; cx.globalAlpha = 0.5 + v * 0.5; cx.beginPath(); cx.roundRect(i * bw + 3, h - v * (h - 10) - 5, bw - 6, v * (h - 10) + 2, 5); cx.fill(); } cx.globalAlpha = 1; };
        const paint = ev => { const r = c.getBoundingClientRect(); const x = (ev.clientX - r.left) / r.width, y = 1 - (ev.clientY - r.top) / r.height; const i = clamp(Math.floor(x * 24), 0, 23); const v = erase ? Math.max(0, ctx.curve[i] - 0.08) : clamp(y, 0, 1); ctx.curve[i] = v; if (i > 0) ctx.curve[i - 1] = (ctx.curve[i - 1] * 2 + v) / 3; if (i < 23) ctx.curve[i + 1] = (ctx.curve[i + 1] * 2 + v) / 3; draw(); engine.setPaint(ctx.curve); };
        c.addEventListener('pointerdown', e => { down = true; c.setPointerCapture(e.pointerId); paint(e); }); c.addEventListener('pointermove', e => { if (down) paint(e); }); addEventListener('pointerup', () => down = false);
        $$('[data-act]', host).forEach(b => b.addEventListener('click', () => {
          const a = b.dataset.act;
          if (a === 'smooth') { const n = ctx.curve.map((v, i) => (ctx.curve[Math.max(0, i - 1)] + v * 2 + ctx.curve[Math.min(23, i + 1)]) / 4); ctx.curve = n; }
          if (a === 'erase') { erase = !erase; b.setAttribute('aria-pressed', erase); b.classList.toggle('btn-secondary', erase); return; }
          if (a === 'reset') ctx.curve = new Array(24).fill(0.5);
          if (a === 'random') { const k = 0.4 + Math.random() * 0.5, ph = Math.random() * 6; ctx.curve = ctx.curve.map((_, i) => clamp(0.5 + 0.4 * Math.sin(i * k + ph) + (Math.random() - 0.5) * 0.15, 0.05, 1)); }
          if (a === 'save') { const list = store.get('lab:paints', []); list.push({ name: 'Curve ' + (list.length + 1), curve: ctx.curve.slice() }); store.set('lab:paints', list); renderSaved(); app.toast('Curve saved on this device'); }
          draw(); engine.setPaint(ctx.curve); store.set('lab:paintcurve', ctx.curve);
        }));
        const renderSaved = () => { const h = $('[data-saved]', host); h.innerHTML = ''; store.get('lab:paints', []).forEach((p, i) => { const b = document.createElement('button'); b.className = 'chip'; b.innerHTML = `<strong>${p.name}</strong>`; b.addEventListener('click', () => { ctx.curve = p.curve.slice(); draw(); engine.setPaint(ctx.curve); }); h.appendChild(b); }); };
        renderSaved(); draw(); ctx.redraw = draw;
      },
      async start(ctx) { safeMaster(); engine.setPaint(ctx.curve); engine.stopAll(); await engine.startSound('paint', 0.6); await engine.playAll(); },
    },
    {
      id: 'sculpt', name: 'Sound Sculpting', cat: 'Sound', tags: ['noise'], evidence: 'exploratory', from: 'Audio engineering, translated to plain words',
      what: 'Shape a noise with five plain-language controls: Warmer ↔ Brighter, Softer ↔ Sharper, Smooth ↔ Textured, Deep ↔ Airy, Stable ↔ Moving.',
      why: 'You should not need to know what a "low-shelf filter" is to make a sound that suits you.',
      how: 'Press Start and move the sliders slowly. The centre position is neutral.',
      whyTest: 'Testing whether plain-language macro controls help people find a comfortable sound faster than technical ones. Evidence: interface idea from music-production software; no clinical claim.',
      settings: [
        { key: 'warm', label: 'Warmer ↔ Brighter', type: 'range', min: -100, max: 100, fmt: v => v < -20 ? 'Warmer' : v > 20 ? 'Brighter' : 'Neutral' },
        { key: 'soft', label: 'Softer ↔ Sharper', type: 'range', min: -100, max: 100, fmt: v => v < -20 ? 'Softer' : v > 20 ? 'Sharper' : 'Neutral' },
        { key: 'smooth', label: 'Smooth ↔ Textured', type: 'range', min: -100, max: 100, fmt: v => v < -20 ? 'Smooth' : v > 20 ? 'Textured' : 'Neutral' },
        { key: 'deep', label: 'Deep ↔ Airy', type: 'range', min: -100, max: 100, fmt: v => v < -20 ? 'Deep' : v > 20 ? 'Airy' : 'Neutral' },
        { key: 'moving', label: 'Stable ↔ Moving', type: 'range', min: 0, max: 100, fmt: v => v < 15 ? 'Stable' : v < 60 ? 'Gently moving' : 'Moving' }],
      defaults: { warm: 0, soft: 0, smooth: 0, deep: 0, moving: 0 },
      async start(ctx) { safeMaster(); this.onSetting(ctx); engine.stopAll(); await engine.startSound('sculpt', 0.6); await engine.playAll(); },
      onSetting(ctx) { engine.setSculpt({ warm: ctx.s.warm / 100, soft: ctx.s.soft / 100 * (ctx.s.soft < 0 ? 1 : 0.3), smooth: ctx.s.smooth / 100, deep: -ctx.s.deep / 100, moving: ctx.s.moving / 100 }); },
    },
    {
      id: 'notched', name: 'Notched Sound', cat: 'Sound', tags: ['noise', 'region'], evidence: 'limited', from: 'Tinnitus research (tailor-made notched music)',
      what: 'Broadband noise with a "gap" carved out around your approximate tinnitus region.',
      why: 'One theory says leaving a gap around the tinnitus pitch lets neighbouring neurons calm the region (lateral inhibition). Some people also simply find the gap more comfortable.',
      how: 'Set your region first with the Frequency Explorer (or Find My Sound). Choose a gap width, press Start and keep the level low.',
      whyTest: 'Randomised trials of notched music are mixed: one large trial found no advantage over placebo on its main outcome, another found it comparable to an established therapy. Gap width did not matter in studies. We include it as an honest experiment, not a treatment.',
      limits: 'Mixed evidence. Not a treatment. Effects, if any, were measured over months of daily listening in studies.',
      settings: [{ key: 'width', label: 'Gap width', type: 'buttons', options: [[0.25, '¼ octave'], [0.5, '½ octave'], [1, '1 octave']] }, { key: 'freq', label: 'Centre frequency (Hz)', type: 'range', min: 200, max: 12000, step: 10, fmt: v => fmtHz(v) }],
      defaults: () => ({ width: 1, freq: regionFreq() }),
      async start(ctx) { safeMaster(); engine.setNotch(ctx.s.freq, ctx.s.width); engine.stopAll(); await engine.startSound('notched', 0.55); await engine.playAll(); },
      onSetting(ctx) { engine.setNotch(ctx.s.freq, ctx.s.width); },
    },
    {
      id: 'modtone', name: 'Modulated Tone', cat: 'Sound', tags: ['tone', 'region'], evidence: 'exploratory', from: 'Tinnitus research (residual inhibition)',
      what: 'A quiet tone near your tinnitus region that pulses gently (10 or 40 times a second) for two or three minutes. Afterwards, you note whether your tinnitus seemed briefly quieter.',
      why: 'Many people notice their tinnitus fades for a few seconds to minutes after a sound stops — "residual inhibition". Small studies found pulsing tones near the tinnitus pitch produced more of this than plain noise.',
      how: 'Set your region first. Keep the level low — it should never be uncomfortable. Press Start, wait for the tone to end, then answer the question.',
      whyTest: 'Residual inhibition is well documented but short-lived and varies a lot between people (complete suppression in up to about a third). The modulated-tone finding comes from small exploratory studies. We only ask what you noticed.',
      limits: 'Any effect is temporary by definition. Stop immediately if the tone is unpleasant. Not for people with sound sensitivity.',
      risks: 'Tonal sounds can be tiring; the level is capped low and the tone fades in and out.',
      settings: [{ key: 'rate', label: 'Pulse rate', type: 'buttons', options: [[10, '10 / second'], [40, '40 / second'], [4, '4 / second (slow)']] }, { key: 'dur', label: 'Duration', type: 'buttons', options: [[60, '1 min'], [120, '2 min'], [180, '3 min']] }, { key: 'freq', label: 'Frequency (Hz)', type: 'range', min: 200, max: 12000, step: 10, fmt: v => fmtHz(v) }, { key: 'vol', label: 'Level', type: 'range', min: 2, max: 30, fmt: v => v + '%' }],
      defaults: () => ({ rate: 10, dur: 120, freq: regionFreq(), vol: 12 }),
      async start(ctx) { safeMaster(); engine.stopAll(); await engine.toneStart({ freq: ctx.s.freq, type: 'sine', volume: ctx.s.vol / 100, am: ctx.s.rate }); await engine.playAll(); ctx.countdown(ctx.s.dur, () => { engine.toneStop(); ctx.ask('Did your tinnitus seem quieter for a moment after the tone stopped?', ['Yes, briefly', 'Not sure', 'No']); }); },
      onSetting(ctx) { if (engine.tone) engine.toneUpdate({ freq: ctx.s.freq, volume: ctx.s.vol / 100, am: ctx.s.rate }); },
      stop() { engine.toneStop(); },
    },
    {
      id: 'mixpoint', name: 'Mixing Point Finder', cat: 'Sound', tags: ['level', 'noise', 'nature'], evidence: 'promising', from: 'Tinnitus retraining therapy',
      what: 'The sound rises from silence very slowly. You tap the moment it just begins to blend with your tinnitus — not cover it. That level is your "mixing point".',
      why: 'Clinicians often set sound just where it blends with the tinnitus rather than masking it. In one comparison, this partial level worked as well as full masking — and it is gentler on your ears.',
      how: 'Choose a sound, press Start, sit quietly and tap "It just blends now". The app remembers the level for that sound.',
      whyTest: 'The mixing point comes from tinnitus retraining therapy. We want to see whether an app can help people find that level on their own. This is guidance for comfort, not a treatment.',
      settings: [{ key: 'sound', label: 'Sound', type: 'sound' }],
      defaults: { sound: 'pink' },
      custom: true,
      buildUI(ctx, host) { host.innerHTML = `<div class="lab-big" data-level>—</div><button class="btn btn-primary btn-lg" data-blend disabled>It just blends now</button><p class="muted small" data-result></p>`; $('[data-blend]', host).addEventListener('click', () => { const v = ctx.level; ctx.found = v; clearTimers(); const pts = store.get('lab:mixpoints', {}); pts[ctx.s.sound] = v; store.set('lab:mixpoints', pts); $('[data-result]', host).textContent = `Your mixing point for ${SOUND_NAME(ctx.s.sound)} is about ${Math.round(v * 100)}% at the current main volume. Saved. Use it as your everyday starting level.`; $('[data-blend]', host).disabled = true; }); },
      async start(ctx) { safeMaster(); engine.stopAll(); await engine.startSound(ctx.s.sound, 0.001); await engine.playAll(); ctx.level = 0.01; $('[data-blend]', ctx.host).disabled = false; every(() => { ctx.level = Math.min(0.9, ctx.level + 0.008); engine.setVolume(ctx.s.sound, ctx.level); $('[data-level]', ctx.host).textContent = Math.round(ctx.level * 100) + '%'; if (ctx.level >= 0.9) { clearTimers(); $('[data-result]', ctx.host).textContent = 'Reached the top of the range. Try again with a quieter main volume or a different sound.'; } }, 1500); },
    },
    {
      id: 'minimal', name: 'Minimal Sound', cat: 'Sound', tags: ['quiet', 'changing'], evidence: 'limited', from: 'Intermittent masking theory',
      what: 'Instead of constant sound: soft swells every few seconds, or short textures with long silences.',
      why: 'Some people dislike constant masking. A sound that comes and goes lets the tinnitus reappear briefly while you are relaxed, which one theory suggests may help the brain get used to it.',
      how: 'Choose a sound and a rhythm. Sound fades in and out gently; it never starts suddenly.',
      whyTest: 'Evidence for intermittent sound is mostly theoretical (desensitisation) with very little direct data, so this is strictly an experiment in comfort.',
      limits: 'Experimental — research is limited. If the gaps make the tinnitus more noticeable in an unpleasant way, stop.',
      settings: [{ key: 'sound', label: 'Sound', type: 'sound' }, { key: 'pattern', label: 'Pattern', type: 'buttons', options: [['swell', 'Slow swells'], ['pulse', 'Soft sound every few seconds'], ['texture', 'Short textures, long fades']] }, { key: 'gap', label: 'Space between', type: 'buttons', options: [[8, '8 s'], [20, '20 s'], [45, '45 s']] }],
      defaults: { sound: 'ocean', pattern: 'swell', gap: 20 },
      async start(ctx) { safeMaster(); engine.stopAll(); await engine.startSound(ctx.s.sound, 0.001); await engine.playAll(); const cycle = () => { const on = ctx.s.pattern === 'texture' ? 3 : ctx.s.pattern === 'pulse' ? 2 : ctx.s.gap * 0.6; const fade = ctx.s.pattern === 'swell' ? on * 0.5 : 1.2; engine.rampVolume(ctx.s.sound, 0.5, fade); later(() => engine.rampVolume(ctx.s.sound, 0.0005, ctx.s.pattern === 'texture' ? 6 : fade), on * 1000); later(cycle, (on + ctx.s.gap) * 1000); }; cycle(); },
    },
    {
      id: 'nearsilence', name: 'Near-Silence', cat: 'Sound', tags: ['quiet', 'level'], evidence: 'promising', from: 'Sound-enrichment guidance / hyperacusis care',
      what: 'A very fine volume control from silence to moderate, for exploring whether barely-there sound suits you better than obvious masking.',
      why: 'Low-level sound enrichment is what many clinicians recommend; more is not better. People with sound sensitivity in particular may prefer the quietest end.',
      how: 'Pick a sound and move the slider slowly. Stay at the lowest point that still feels helpful.',
      whyTest: 'We want to learn how many people settle on very low levels when given a control fine enough to find them. Evidence: consistent with guidance that the lowest helpful level is best.',
      settings: [{ key: 'sound', label: 'Sound', type: 'sound' }, { key: 'lvl', label: 'Level', type: 'range', min: 0, max: 100, scale: ['Silence', 'Very subtle', 'Soft', 'Moderate'], fmt: v => v === 0 ? 'Silence' : v < 33 ? 'Very subtle' : v < 66 ? 'Soft' : 'Moderate' }],
      defaults: { sound: 'brown', lvl: 20 },
      async start(ctx) { safeMaster(); engine.stopAll(); await engine.startSound(ctx.s.sound, 0.001); await engine.playAll(); this.onSetting(ctx); },
      onSetting(ctx) { if (running && running.exp.id === 'nearsilence') { if (engine.isActive(ctx.s.sound)) engine.setVolume(ctx.s.sound, Math.pow(ctx.s.lvl / 100, 1.8) * 0.5 + (ctx.s.lvl ? 0.01 : 0)); } },
    },
    {
      id: 'chimes', name: 'Gentle Chimes', cat: 'Sound', tags: ['tone', 'changing', 'music'], evidence: 'promising', from: 'Fractal-tone sound therapy used in some hearing aids',
      what: 'Soft, slow tones that wander through a calm scale and never repeat — like distant wind chimes — optionally over a bed of noise.',
      why: 'Tones that are familiar but never predictable cannot be memorised, so they stay relaxing over time. Fractal-tone programmes in hearing aids are built on this idea.',
      how: 'Press Start. Add a bed of noise if you like. Keep it quiet — the chimes are meant to sit in the background.',
      whyTest: 'Fractal tones have shown good results as part of a full counselling programme; alone, the evidence is thinner. Here we only ask whether the sound is comfortable.',
      settings: [{ key: 'bed', label: 'Background bed', type: 'select', options: [['none', 'None'], ['brown', 'Brown noise'], ['pink', 'Pink noise'], ['rain', 'Rain'], ['wind', 'Wind']] }],
      defaults: { bed: 'brown' },
      async start(ctx) { safeMaster(); engine.stopAll(); await engine.startSound('chimes', 0.45); if (ctx.s.bed !== 'none') await engine.startSound(ctx.s.bed, 0.35); await engine.playAll(); },
    },
    {
      id: 'environments', name: 'Sound Environments', cat: 'Sound', tags: ['nature', 'immersive'], evidence: 'promising', from: 'VR relaxation research',
      what: 'Whole places instead of single sounds: a cabin in the rain with distant thunder, a night beach, an airplane cabin, a mountain stream, quiet city rain.',
      why: 'Studies of virtual nature suggest a believable environment relaxes more than an isolated sound. Each environment has an intensity control.',
      how: 'Pick a place and set how intense you want it.',
      whyTest: 'Audio + visual environments outperform isolated stimuli in relaxation studies. We are checking whether that holds for tinnitus comfort.',
      settings: [{ key: 'env', label: 'Environment', type: 'select', options: Object.entries(ENVS).map(([k, v]) => [k, v.name]) }, { key: 'intensity', label: 'Intensity', type: 'range', min: 30, max: 120, fmt: v => v < 60 ? 'Gentle' : v < 95 ? 'Natural' : 'Full' }],
      defaults: { env: 'cabinrain', intensity: 80 },
      async start(ctx) { safeMaster(); const e = ENVS[ctx.s.env]; await engine.loadMix(e.mix.map(m => ({ id: m.id, volume: clamp(m.volume * ctx.s.intensity / 100, 0.02, 1) }))); },
      onSetting(ctx) { if (running && running.exp.id === 'environments') this.start(ctx); },
    },
    {
      id: 'recipes', name: 'Sound Recipes', cat: 'Sound', tags: ['creative', 'noise', 'nature'], evidence: 'exploratory', from: 'Product design',
      what: 'Combine ingredients like a recipe: a few sounds plus modifiers such as Slow frequency drift, Organic variation, Gentle movement or Distant.',
      why: 'Thinking in ingredients is friendlier than mixer channels, and modifiers add character you cannot get from volume alone.',
      how: 'Tap ingredients and modifiers, press Start, then name and save the recipe if you like it.',
      whyTest: 'An interface experiment — does an ingredient metaphor lead to more varied, more comfortable mixes? No clinical claim.',
      custom: true, defaults: {},
      buildUI(ctx, host) {
        ctx.ing = new Set(store.get('lab:recipe-draft', ['rain', 'brown'])); ctx.mods = new Set();
        const render = () => { host.innerHTML = `<div class="label-sm">Ingredients (up to 5)</div><div class="pane-sounds">${LIB.map(i => `<button class="pane-sound ${ctx.ing.has(i) ? 'on' : ''}" data-ing="${i}" aria-pressed="${ctx.ing.has(i)}"><span class="ico">${engine.def(i).icon}</span>${SOUND_NAME(i)}</button>`).join('')}</div><div class="label-sm" style="margin-top:12px">Modifiers</div><div class="pane-sounds">${[['drift', 'Slow frequency drift'], ['organic', 'Organic variation'], ['move', 'Gentle movement'], ['distant', 'Distant']].map(m => `<button class="pane-sound ${ctx.mods.has(m[0]) ? 'on' : ''}" data-mod="${m[0]}" aria-pressed="${ctx.mods.has(m[0])}">${m[1]}</button>`).join('')}</div><form class="inline-form" data-save><input class="select" maxlength="40" placeholder="Recipe name" value="My recipe"><button class="btn btn-secondary btn-sm" type="submit">Save recipe</button></form><div class="lab-saved" data-saved></div>`;
          $$('[data-ing]', host).forEach(b => b.addEventListener('click', () => { const id = b.dataset.ing; if (ctx.ing.has(id)) ctx.ing.delete(id); else if (ctx.ing.size < 5) ctx.ing.add(id); else app.toast('Up to 5 ingredients'); store.set('lab:recipe-draft', [...ctx.ing]); render(); if (running && running.exp.id === 'recipes') this.start(ctx); }));
          $$('[data-mod]', host).forEach(b => b.addEventListener('click', () => { const m = b.dataset.mod; ctx.mods.has(m) ? ctx.mods.delete(m) : ctx.mods.add(m); render(); if (running && running.exp.id === 'recipes') this.applyMods(ctx); }));
          $('[data-save]', host).addEventListener('submit', e => { e.preventDefault(); const list = store.get('lab:recipes', []); list.push({ name: $('input', e.target).value.trim() || 'My recipe', ing: [...ctx.ing], mods: [...ctx.mods] }); store.set('lab:recipes', list); render(); app.toast('Recipe saved on this device'); });
          const sv = $('[data-saved]', host); store.get('lab:recipes', []).forEach((r, i) => { const b = document.createElement('button'); b.className = 'chip'; b.innerHTML = `<strong>${r.name}</strong><span>${r.ing.map(SOUND_NAME).join(' + ')}${r.mods.length ? ' · ' + r.mods.join(', ') : ''}</span>`; b.addEventListener('click', () => { ctx.ing = new Set(r.ing); ctx.mods = new Set(r.mods); render(); if (running && running.exp.id === 'recipes') this.start(ctx); }); sv.appendChild(b); });
        };
        render();
      },
      async start(ctx) { safeMaster(); await engine.loadMix([...ctx.ing].map(id => ({ id, volume: 0.5 }))); this.applyMods(ctx); },
      applyMods(ctx) { clearTimers(); engine.setVariation(ctx.mods.has('organic') ? 0.45 : 0, 7); engine.activeList().forEach(s => { engine.setCutoff(s.id, ctx.mods.has('distant') ? 1800 : 20000, 0.5); engine.setBalance(s.id, 0); }); if (ctx.mods.has('drift')) { let ph = 0; every(() => { ph += 0.05; engine.activeList().forEach((s, i) => engine.setCutoff(s.id, (ctx.mods.has('distant') ? 1800 : 9000) * Math.pow(2, Math.sin(ph + i) * 0.8), 1)); }, 1000); } if (ctx.mods.has('move')) { let t = 0; every(() => { t += 0.1; engine.activeList().forEach((s, i) => engine.setBalance(s.id, Math.sin(t / 6 + i * 2) * 0.4)); }, 100); } },
      stop() { engine.setVariation(0); },
    },

    // ---------------- VISUAL ----------------
    {
      id: 'target', name: 'Attention Target', cat: 'Visual', tags: ['visual', 'attention', 'lowmotion'], evidence: 'promising', from: 'Attention-training research',
      what: 'A slowly drifting object — light, bubble, star, leaf or orb — that you simply follow with your eyes. The sound follows it too: a little to the left when it drifts left, a little softer when it sinks.',
      why: 'Attention-training studies suggest practising where attention goes can make tinnitus less intrusive. Following one gentle thing is the simplest possible version.',
      how: 'Choose an object and press Start. Focus Mode opens; just watch. Exit whenever you like.',
      whyTest: 'A randomised trial of an attention-training game reduced tinnitus distress more than a control game. Our version removes all scoring. Evidence: promising for distress, not for loudness.',
      settings: [{ key: 'obj', label: 'Object', type: 'buttons', options: [['light', 'Floating light'], ['bubble', 'Underwater bubble'], ['star', 'Moving star'], ['leaf', 'Drifting leaf'], ['orb', 'Glowing orb']] }, { key: 'sync', label: 'Sound follows the object', type: 'toggle' }],
      defaults: { obj: 'light', sync: true },
      async start(ctx) { safeMaster(); if (!engine.activeList().length) await engine.startSound('pink', 0.4); focus.setParam('target', ctx.s.obj); focus.setParam('sync', ctx.s.sync); focus.setVisual('target'); focus.enterFocus(); },
      stop() { engine.resetMasterShape(); }, keepsSound: true,
    },
    {
      id: 'sync', name: 'Visual–Sound Synchronisation', cat: 'Visual', tags: ['visual', 'noise', 'nature'], evidence: 'exploratory', from: 'Multisensory research / generative art',
      what: 'A scene that takes its form from what is playing: rain becomes falling particles, ocean becomes slow horizontal waves, broadband noise becomes a soft particle field. Low sounds move large and slow; high sounds move small and fine.',
      why: 'When what you see matches what you hear, the whole experience feels more coherent — and there is nothing to "work out".',
      how: 'Start some sounds, then press Start. Change the mix in Focus Mode and watch the scene change.',
      whyTest: 'Audio-visual coherence improves relaxation in VR studies; we are checking whether a subtle version does the same on a phone. No clinical claim.',
      defaults: {},
      async start() { safeMaster(); if (!engine.activeList().length) await engine.loadMix([{ id: 'rain', volume: 0.45 }, { id: 'brown', volume: 0.3 }]); focus.setVisual('synced'); focus.enterFocus(); }, keepsSound: true,
    },
    {
      id: 'activities', name: 'Attention Activities', cat: 'Visual', tags: ['visual', 'attention'], evidence: 'promising', from: 'Perceptual-training research',
      what: 'Three very light activities: follow one particle among several; notice when the background slowly changes; count slow pulses. No scores, no timers, no failing.',
      why: 'Just enough attention to redirect it — the same idea behind tinnitus attention-training games, minus the game.',
      how: 'Pick an activity and press Start. When you lose the thread, just pick it up again.',
      whyTest: 'Small randomised trials of attention training showed modest but real reductions in tinnitus distress. We removed every stressful element.',
      settings: [{ key: 'act', label: 'Activity', type: 'buttons', options: [['followone', 'Follow one particle'], ['noticechange', 'Notice the change'], ['countpulses', 'Count slow pulses']] }],
      defaults: { act: 'followone' },
      async start(ctx) { focus.setVisual(ctx.s.act); focus.enterFocus(); }, keepsSound: true,
    },
    {
      id: 'depth', name: 'Depth Focus', cat: 'Visual', tags: ['visual', 'immersive'], evidence: 'exploratory', from: 'VR relaxation',
      what: 'Extremely slow movement through depth: drifting through clouds, or among stars. Motion Off turns it into a still scene.',
      why: 'Slow forward drift can feel calming and "away from here". The speed is deliberately far below anything that causes motion discomfort.',
      how: 'Choose a scene. If you are sensitive to motion, set Visual Movement to Still first.',
      whyTest: 'Borrowed from VR relaxation; we keep it to a flat screen and very low speed.', risks: 'Motion-sensitive users should use Still or Reduce Motion.',
      settings: [{ key: 'scene', label: 'Scene', type: 'buttons', options: [['cloudflight', 'Through clouds'], ['starflight', 'Among stars'], ['tunnel', 'Abstract tunnel'], ['underwater', 'Slow underwater']] }],
      defaults: { scene: 'starflight' },
      async start(ctx) { focus.setVisual(ctx.s.scene); focus.enterFocus(); }, keepsSound: true,
    },
    {
      id: 'breathsync', name: 'Breath-Synced Sound', cat: 'Visual', tags: ['breathing', 'relax', 'changing'], evidence: 'established', from: 'Slow-breathing / HRV research',
      what: 'A slow breathing rhythm (about six breaths a minute) where the sound itself breathes with you: brighter and fuller as you breathe in, softer and warmer as you breathe out.',
      why: 'Slow breathing near six breaths a minute is one of the best-supported ways to settle the nervous system. Letting the sound carry the rhythm means you can close your eyes.',
      how: 'Choose a pace, press Start and breathe with the sound. Open the breathing visual if you prefer to watch.',
      whyTest: 'The breathing rate is well supported for relaxation; coupling it to sound is our addition and is untested. Relaxation only — no claim about tinnitus loudness.',
      settings: [{ key: 'bpm', label: 'Breaths per minute', type: 'buttons', options: [[5, '5'], [6, '6'], [7, '7']] }, { key: 'depth', label: 'How much the sound breathes', type: 'range', min: 10, max: 60, fmt: v => v + '%' }, { key: 'visual', label: 'Open the breathing visual', type: 'toggle' }],
      defaults: { bpm: 6, depth: 30, visual: false },
      async start(ctx) { safeMaster(); if (!engine.activeList().length) await engine.startSound('ocean', 0.5); await engine.playAll(); const period = 60 / ctx.s.bpm; let t0 = performance.now(); every(() => { const p = ((performance.now() - t0) / 1000) % period / period; const inhale = p < 0.45; const x = inhale ? p / 0.45 : 1 - (p - 0.45) / 0.55; const e = x * x * (3 - 2 * x); const d = ctx.s.depth / 100; engine.setMasterTrim(1 - d * (1 - e), 0.25); engine.setMasterTone(2500 * Math.pow(8, e), 0.25); }, 100); if (ctx.s.visual) { focus.setParam('breathPeriod', period); focus.setVisual('breathing'); focus.enterFocus(); } },
      stop() { engine.resetMasterShape(); }, keepsSound: true,
    },

    // ---------------- IMMERSIVE ----------------
    {
      id: 'spatial', name: 'Spatial Sound', cat: 'Immersive', tags: ['immersive', 'nature', 'noise'], evidence: 'exploratory', from: 'Spatial-audio and relaxation research',
      what: 'Place each sound around you on a simple map: rain above, ocean in front, brown noise centred, wind far to the left. Optional very slow drift.',
      why: 'A 2024 study found that the spatial quality of sound — where it seems to come from, and slow movement — improved relaxation more than steady sound. Space also gives each sound its own place, so a mix feels less crowded.',
      how: 'Start a few sounds, then drag the dots. Far from centre is quieter and softer. Stationary is the default; turn on Slow drift if you like.',
      whyTest: 'Exploratory evidence from one controlled study; best with headphones. No clinical claim.',
      settings: [{ key: 'drift', label: 'Slow drift (otherwise stationary)', type: 'toggle' }],
      defaults: { drift: false }, custom: true,
      buildUI(ctx, host) {
        host.innerHTML = `<canvas class="spatial-map" width="520" height="360" aria-label="Spatial sound map"></canvas><p class="muted small">Drag a sound. You are the dot in the middle. Headphones recommended.</p>`;
        const c = $('canvas', host), cx = c.getContext('2d'); ctx.pos = store.get('lab:spatial', {}); let drag = null;
        const items = () => engine.activeList().map(s => ({ id: s.id, p: ctx.pos[s.id] || (ctx.pos[s.id] = { x: 0.5 + (Math.random() - 0.5) * 0.6, y: 0.5 + (Math.random() - 0.5) * 0.6 }) }));
        const draw = () => { const w = c.width, h = c.height; const dark = document.documentElement.dataset.theme === 'dark'; cx.clearRect(0, 0, w, h); cx.fillStyle = dark ? '#0f1430' : '#eef1fa'; cx.fillRect(0, 0, w, h); cx.strokeStyle = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)'; for (const r of [0.15, 0.3, 0.45]) { cx.beginPath(); cx.arc(w / 2, h / 2, r * w, 0, Math.PI * 2); cx.stroke(); } cx.fillStyle = dark ? '#e8ecf7' : '#131a2e'; cx.beginPath(); cx.arc(w / 2, h / 2, 7, 0, Math.PI * 2); cx.fill(); cx.font = '12px Manrope, sans-serif'; cx.textAlign = 'center'; cx.fillStyle = dark ? '#97a2c4' : '#5d6785'; cx.fillText('above / front', w / 2, 16); cx.fillText('behind', w / 2, h - 8); cx.fillText('left', 22, h / 2); cx.fillText('right', w - 24, h / 2);
          items().forEach(it => { const d = engine.def(it.id); const x = it.p.x * w, y = it.p.y * h; cx.fillStyle = `hsl(${d.hue} 80% 60% / .9)`; cx.beginPath(); cx.arc(x, y, 16, 0, Math.PI * 2); cx.fill(); cx.fillStyle = '#fff'; cx.font = '700 12px Manrope, sans-serif'; cx.fillText(d.name, x, y + 32); }); };
        const applyOne = it => { const dx = it.p.x - 0.5, dy = it.p.y - 0.5; const dist = Math.min(1, Math.hypot(dx, dy) / 0.5); engine.setBalance(it.id, clamp(dx * 2, -1, 1)); engine.setCutoff(it.id, 20000 * Math.pow(0.08, dist * dist) + 500, 0.4); };
        const pick = ev => { const r = c.getBoundingClientRect(); const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height; return items().find(it => Math.hypot(it.p.x - x, it.p.y - y) < 0.06); };
        c.addEventListener('pointerdown', e => { drag = pick(e); if (drag) c.setPointerCapture(e.pointerId); });
        c.addEventListener('pointermove', e => { if (!drag) return; const r = c.getBoundingClientRect(); drag.p.x = clamp((e.clientX - r.left) / r.width, 0.03, 0.97); drag.p.y = clamp((e.clientY - r.top) / r.height, 0.03, 0.97); applyOne(drag); draw(); store.set('lab:spatial', ctx.pos); });
        addEventListener('pointerup', () => drag = null);
        ctx.draw = draw; ctx.applyAll = () => items().forEach(applyOne); draw(); engine.on(t => { if (t === 'sounds' && running && running.exp.id === 'spatial') { ctx.applyAll(); draw(); } });
      },
      async start(ctx) { safeMaster(); if (!engine.activeList().length) await engine.loadMix([{ id: 'rain', volume: 0.4 }, { id: 'ocean', volume: 0.45 }, { id: 'brown', volume: 0.3 }]); else await engine.playAll(); ctx.applyAll(); ctx.draw(); this.onSetting(ctx); },
      onSetting(ctx) { clearTimers(); if (ctx.s.drift && running && running.exp.id === 'spatial') every(() => { Object.values(ctx.pos).forEach((p, i) => { const a = 0.004; const dx = p.x - 0.5, dy = p.y - 0.5; p.x = 0.5 + dx * Math.cos(a) - dy * Math.sin(a); p.y = 0.5 + dx * Math.sin(a) + dy * Math.cos(a); }); ctx.applyAll(); ctx.draw(); }, 250); },
      stop() { engine.activeList().forEach(s => { engine.setBalance(s.id, 0); engine.setCutoff(s.id, 20000, 0.5); }); }, keepsSound: true,
    },
    {
      id: 'moving', name: 'Moving Sound', cat: 'Immersive', tags: ['immersive', 'changing'], evidence: 'exploratory', from: 'Spatial-audio research',
      what: 'One sound glides very slowly from side to side, or around you. Never fast.',
      why: 'Slow spatial movement improved relaxation and attention in a recent controlled study — and it gives the mind something gentle to track with eyes closed.',
      how: 'Choose the sound, a speed and a range. Works best with headphones.',
      whyTest: 'One study, exploratory. Speeds are capped so it can never feel disorienting.',
      settings: [{ key: 'sound', label: 'Sound to move', type: 'sound' }, { key: 'speed', label: 'Movement speed', type: 'buttons', options: [[60, 'Very slow (1 min per pass)'], [30, 'Slow (30 s per pass)']] }, { key: 'range', label: 'Movement range', type: 'buttons', options: [[0.35, 'Narrow'], [0.8, 'Wide']] }],
      defaults: { sound: 'wind', speed: 60, range: 0.35 },
      async start(ctx) { safeMaster(); if (!engine.isActive(ctx.s.sound)) await engine.startSound(ctx.s.sound, 0.45); await engine.playAll(); let t0 = performance.now(); every(() => { const ph = (performance.now() - t0) / 1000 / ctx.s.speed * Math.PI * 2; engine.setBalance(ctx.s.sound, Math.sin(ph) * ctx.s.range); }, 120); },
      stop(ctx) { if (engine.isActive(ctx.s.sound)) engine.setBalance(ctx.s.sound, 0); }, keepsSound: true,
    },
    {
      id: 'touch', name: 'Sound + Touch', cat: 'Immersive', tags: ['interactive', 'visual'], evidence: 'exploratory', from: 'Multisensory interaction',
      what: 'Touch the water: a ripple spreads, the sound briefly softens and warms in response, and — only if you turn it on — the phone gives a very light tap.',
      why: 'Linking touch, sight and sound into one small event can be oddly satisfying and gives attention a gentle anchor.',
      how: 'Press Start, then tap or click anywhere on the water. Haptics are off by default and only work on phones that support them.',
      whyTest: 'Multisensory experiences feel more engaging in lab studies; we make no therapeutic claim for the touch itself.',
      settings: [{ key: 'haptic', label: 'Gentle haptic tap (phones only)', type: 'toggle' }],
      defaults: { haptic: false },
      async start(ctx) { safeMaster(); if (!engine.activeList().length) await engine.startSound('stream', 0.45); focus.setParam('haptic', ctx.s.haptic); focus.setParam('soundTouch', true); focus.setVisual('touchwater'); focus.enterFocus(); },
      stop() { focus.setParam('soundTouch', false); engine.resetMasterShape(); }, keepsSound: true,
    },
    {
      id: 'eyesclosed', name: 'Eyes-Closed Mode', cat: 'Immersive', tags: ['quiet', 'sleep', 'relax'], evidence: 'exploratory', from: 'Accessibility / sleep design',
      what: 'An almost black screen with only Pause, Timer and Exit. Optional gentle cues: the sound slowly breathes every few minutes so you know it is still there.',
      why: 'Not every feature needs graphics. Some people want to close their eyes and know nothing will light up.',
      how: 'Start some sounds, choose a cue setting and press Start. Tap anywhere to reveal the three controls.',
      whyTest: 'Design experiment for people who prefer no visuals at all.',
      settings: [{ key: 'cues', label: 'Gentle audio cues', type: 'buttons', options: [['none', 'None'], ['soft', 'Every 3 minutes'], ['rare', 'Every 10 minutes']] }],
      defaults: { cues: 'none' },
      async start(ctx) { safeMaster(); if (!engine.activeList().length) await engine.startSound('brown', 0.5); await engine.playAll(); openEyesClosed(); if (ctx.s.cues !== 'none') every(() => { engine.setMasterTrim(0.8, 2); later(() => engine.setMasterTrim(1, 3), 4000); }, (ctx.s.cues === 'soft' ? 3 : 10) * 60000); },
      stop() { closeEyesClosed(); engine.resetMasterShape(); }, keepsSound: true,
    },

    // ---------------- DISCOVERY ----------------
    {
      id: 'explorer', name: 'Tinnitus Frequency Explorer', cat: 'Discovery', tags: ['tone', 'region'], evidence: 'promising', from: 'Audiology pitch-matching methods',
      what: 'Sweep slowly through pitch with coarse, fine and extremely fine steps. Mark tones as lower, close, or higher than your tinnitus; the app estimates a rough region and runs an octave check.',
      why: 'Knowing roughly where your tinnitus sits lets the other experiments (notched sound, modulated tone, painting) centre on it.',
      how: 'Keep the level low. Play, adjust, mark. After a few marks, tap Estimate, then do the octave check. This is not a hearing test.',
      whyTest: 'Self-administered matching agrees with clinical matching within half an octave about 70% of the time when an octave check is included — so we include one. This is a rough personal estimate, never a diagnosis.',
      custom: true, defaults: {},
      buildUI(ctx, host) {
        ctx.f = regionFreq(); ctx.marks = store.get('lab:marks', []); ctx.vol = 0.12;
        host.innerHTML = `<div class="freq-readout"><span data-f>${Math.round(ctx.f).toLocaleString()}</span><span class="unit">Hz</span></div>
          <div class="fine-row" role="group" aria-label="Coarse"><span class="label-sm">Coarse</span><button class="btn btn-ghost btn-sm" data-step="-4">− ⅓ octave</button><button class="btn btn-ghost btn-sm" data-step="4">+ ⅓ octave</button></div>
          <div class="fine-row" role="group" aria-label="Fine"><span class="label-sm">Fine</span><button class="btn btn-ghost btn-sm" data-step="-1">− semitone</button><button class="btn btn-ghost btn-sm" data-step="1">+ semitone</button></div>
          <div class="fine-row" role="group" aria-label="Extremely fine"><span class="label-sm">Extremely fine</span><button class="btn btn-ghost btn-sm" data-step="-0.15">− 1%</button><button class="btn btn-ghost btn-sm" data-step="0.15">+ 1%</button></div>
          <div class="control"><label>Level <output data-vol>12%</output> — keep it low</label><input type="range" min="2" max="30" value="12" data-volr></div>
          <div class="btn-row"><button class="btn btn-secondary" data-play aria-pressed="false">Play tone</button></div>
          <div class="label-sm" style="margin-top:14px">This tone sounds…</div>
          <div class="btn-row"><button class="btn btn-ghost" data-mark="lower">Lower than my tinnitus</button><button class="btn btn-primary" data-mark="close">Close to my tinnitus</button><button class="btn btn-ghost" data-mark="higher">Higher than my tinnitus</button></div>
          <p class="muted small" data-marks></p>
          <div class="btn-row"><button class="btn btn-secondary" data-est>Estimate my region</button><button class="btn btn-ghost btn-sm" data-clear>Clear marks</button></div>
          <div data-result></div>`;
        const show = () => { $('[data-f]', host).textContent = Math.round(ctx.f).toLocaleString(); if (engine.tone) engine.toneUpdate({ freq: ctx.f }); const m = ctx.marks; $('[data-marks]', host).textContent = m.length ? `${m.filter(x => x.k === 'lower').length} lower · ${m.filter(x => x.k === 'close').length} close · ${m.filter(x => x.k === 'higher').length} higher` : 'No marks yet.'; };
        $$('[data-step]', host).forEach(b => b.addEventListener('click', () => { ctx.f = clamp(ctx.f * Math.pow(2, +b.dataset.step / 12), 100, 16000); show(); }));
        $('[data-volr]', host).addEventListener('input', e => { ctx.vol = +e.target.value / 100; $('[data-vol]', host).textContent = e.target.value + '%'; if (engine.tone) engine.toneUpdate({ volume: ctx.vol }); });
        $('[data-play]', host).addEventListener('click', async e => { if (engine.tone) { engine.toneStop(); e.currentTarget.textContent = 'Play tone'; e.currentTarget.setAttribute('aria-pressed', false); } else { safeMaster(); await engine.toneStart({ freq: ctx.f, type: 'sine', volume: ctx.vol }); await engine.playAll(); e.currentTarget.textContent = 'Stop tone'; e.currentTarget.setAttribute('aria-pressed', true); } });
        $$('[data-mark]', host).forEach(b => b.addEventListener('click', () => { ctx.marks.push({ f: ctx.f, k: b.dataset.mark }); store.set('lab:marks', ctx.marks); show(); app.toast(`Marked ${fmtHz(ctx.f)} as ${b.dataset.mark}`); }));
        $('[data-clear]', host).addEventListener('click', () => { ctx.marks = []; store.set('lab:marks', []); show(); $('[data-result]', host).innerHTML = ''; });
        $('[data-est]', host).addEventListener('click', () => {
          const lo = Math.max(100, ...ctx.marks.filter(m => m.k === 'lower').map(m => m.f)); const hi = Math.min(16000, ...ctx.marks.filter(m => m.k === 'higher').map(m => m.f)); const close = ctx.marks.filter(m => m.k === 'close').map(m => m.f);
          if (!close.length && !(isFinite(lo) && isFinite(hi))) return app.toast('Mark at least one tone as close, or one lower and one higher.');
          const centre = close.length ? Math.exp(close.reduce((a, f) => a + Math.log(f), 0) / close.length) : Math.sqrt(lo * hi);
          const region = { freq: centre, lo: Math.max(lo === Infinity ? centre / 1.4 : lo, centre / 1.6), hi: Math.min(hi === -Infinity ? centre * 1.4 : hi, centre * 1.6), when: new Date().toISOString() };
          store.set('lab:region', region);
          $('[data-result]', host).innerHTML = `<div class="card lab-result"><h3>Rough region: ${fmtHz(region.lo)} – ${fmtHz(region.hi)}</h3><p>Centre about <strong>${fmtHz(centre)}</strong>. This is a personal estimate, not a hearing test or a diagnosis.</p><h3>Octave check</h3><p>Pitch matching often lands exactly one octave off. Which of these sounds closer to your tinnitus?</p><div class="btn-row"><button class="btn btn-ghost" data-oct="0.5">Lower one (${fmtHz(centre / 2)})</button><button class="btn btn-secondary" data-oct="1">This one (${fmtHz(centre)})</button><button class="btn btn-ghost" data-oct="2">Higher one (${fmtHz(centre * 2)})</button></div><div class="btn-row"><button class="btn btn-ghost btn-sm" data-hear="0.5">Hear lower</button><button class="btn btn-ghost btn-sm" data-hear="1">Hear centre</button><button class="btn btn-ghost btn-sm" data-hear="2">Hear higher</button></div><h3>Try around this region</h3><div class="btn-row"><button class="btn btn-primary btn-sm" data-go="notched">Notched Sound</button><button class="btn btn-primary btn-sm" data-go="modtone">Modulated Tone</button><button class="btn btn-primary btn-sm" data-go="paint">Frequency Painting</button><button class="btn btn-secondary btn-sm" data-go="suggest">Masking sounds to try</button></div></div>`;
          $$('[data-hear]', host).forEach(b => b.addEventListener('click', async () => { const f = centre * +b.dataset.hear; if (!engine.tone) { await engine.toneStart({ freq: f, type: 'sine', volume: ctx.vol }); await engine.playAll(); } else engine.toneUpdate({ freq: f }); }));
          $$('[data-oct]', host).forEach(b => b.addEventListener('click', () => { const k = +b.dataset.oct; region.freq = centre * k; region.lo *= k; region.hi *= k; store.set('lab:region', region); ctx.f = region.freq; show(); app.toast(`Region updated to about ${fmtHz(region.freq)}`); }));
          $$('[data-go]', host).forEach(b => b.addEventListener('click', () => { engine.toneStop(); if (b.dataset.go === 'suggest') { app.store.set('match', { freq: region.freq, type: 'sine', balance: 0, when: new Date().toISOString() }); app.showView('match'); return; } openExperiment(b.dataset.go); }));
        });
        show();
      },
      start() { }, stop() { engine.toneStop(); }, keepsSound: true, noRun: true,
    },
    {
      id: 'discovery', name: 'Sound Discovery', cat: 'Discovery', tags: ['learning'], evidence: 'exploratory', from: 'Preference-learning / recommender design',
      what: 'You hear a series of short, quiet sound environments. After each one, you say Better, Same or Worse than the one before. The app gradually learns what you prefer.',
      why: 'Choosing from 300 sounds is hard. Comparing two things at a time is easy, and the pattern of your answers says a lot.',
      how: 'Press Start and listen to each round for a little while before answering. Ten rounds is plenty. Stop any time.',
      whyTest: 'A learning experiment: pairwise choices are a standard way to learn preferences. Results stay on this device and only shape what we suggest to you.',
      custom: true, defaults: {},
      buildUI(ctx, host) { host.innerHTML = `<div class="lab-big" data-round>Ready</div><p data-desc class="muted"></p><div class="btn-row"><button class="btn btn-ghost" data-ans="worse" disabled>Worse</button><button class="btn btn-ghost" data-ans="same" disabled>Same</button><button class="btn btn-primary" data-ans="better" disabled>Better</button></div><div data-summary></div>`; $$('[data-ans]', host).forEach(b => b.addEventListener('click', () => ctx.answer(b.dataset.ans))); },
      async start(ctx) {
        safeMaster(); const prefs = store.get('lab:prefs', {}); const feats = { colour: ['brown', 'pink', 'white'], nature: ['none', 'rain', 'ocean', 'forest', 'wind', 'stream'], change: ['stable', 'organic'], bright: ['warm', 'neutral', 'bright'] };
        const score = c => Object.entries(c).reduce((a, [k, v]) => a + (prefs[k + ':' + v] || 0), 0);
        const randomCand = () => Object.fromEntries(Object.entries(feats).map(([k, v]) => [k, v[Math.floor(Math.random() * v.length)]]));
        let prev = null, round = 0; const hist = [];
        const play = async c => { const mix = [{ id: c.colour, volume: 0.45 }]; if (c.nature !== 'none') mix.push({ id: c.nature, volume: 0.4 }); await engine.loadMix(mix); engine.setVariation(c.change === 'organic' ? 0.5 : 0, 6); engine.setMasterTone(c.bright === 'warm' ? 2500 : c.bright === 'bright' ? 20000 : 8000, 0.5); };
        const describe = c => `${SOUND_NAME(c.colour)}${c.nature !== 'none' ? ' + ' + SOUND_NAME(c.nature) : ''} · ${c.change === 'organic' ? 'gently changing' : 'steady'} · ${c.bright}`;
        const next = async () => { round++; let cand = randomCand(); if (prev && round > 3) { const alts = Array.from({ length: 6 }, randomCand); alts.sort((a, b) => score(b) - score(a)); cand = Math.random() < 0.6 ? alts[0] : cand; } ctx.cur = cand; $('[data-round]', ctx.host).textContent = `Round ${round}`; $('[data-desc]', ctx.host).textContent = describe(cand); $$('[data-ans]', ctx.host).forEach(b => b.disabled = !prev); await play(cand); if (!prev) { prev = cand; later(next, 12000); } };
        ctx.answer = ans => { const d = ans === 'better' ? 1 : ans === 'worse' ? -1 : 0; Object.entries(ctx.cur).forEach(([k, v]) => { prefs[k + ':' + v] = (prefs[k + ':' + v] || 0) + d; if (prev) prefs[k + ':' + prev[k]] = (prefs[k + ':' + prev[k]] || 0) - d * 0.5; }); store.set('lab:prefs', prefs); hist.push({ c: ctx.cur, ans }); prev = ans === 'worse' ? prev : ctx.cur; if (round >= 10) { finish(); return; } next(); };
        const finish = () => { clearTimers(); const best = Object.entries(feats).map(([k, vals]) => [k, vals.slice().sort((a, b) => (prefs[k + ':' + b] || 0) - (prefs[k + ':' + a] || 0))[0]]); const fav = Object.fromEntries(best); $('[data-summary]', ctx.host).innerHTML = `<div class="card lab-result"><h3>What you tended to prefer</h3><p>${describe(fav)}</p><div class="btn-row"><button class="btn btn-primary btn-sm" data-playfav>Play it</button><button class="btn btn-secondary btn-sm" data-savefav>Save as a mix</button></div></div>`; $('[data-playfav]', ctx.host).addEventListener('click', () => play(fav)); $('[data-savefav]', ctx.host).addEventListener('click', () => { const mixes = store.get('mixes', []); mixes.push({ name: 'Discovered mix', mix: [{ id: fav.colour, volume: 0.45, balance: 0 }].concat(fav.nature !== 'none' ? [{ id: fav.nature, volume: 0.4, balance: 0 }] : []), master: engine.masterVolume }); store.set('mixes', mixes); app.toast('Saved to your mixes'); }); $('[data-round]', ctx.host).textContent = 'Done'; $$('[data-ans]', ctx.host).forEach(b => b.disabled = true); renderProfile(); };
        next();
      },
      stop() { engine.setVariation(0); engine.resetMasterShape(); },
    },
    {
      id: 'ab', name: 'A/B Sound Test', cat: 'Discovery', tags: ['learning'], evidence: 'exploratory', from: 'UX research',
      what: 'Two sound set-ups, A and B. Switch between them instantly, as often as you like, then say which feels more comfortable. Repeat with new pairs.',
      why: 'Subtle preferences are easiest to notice side by side.',
      how: 'Choose A and B from the presets (or use your current mix as A), press Start, switch, decide.',
      whyTest: 'Pairwise comparison is the most reliable way people report subtle preferences. Stored locally to shape suggestions.',
      custom: true, defaults: {},
      buildUI(ctx, host) {
        const opts = [['current', 'My current mix']].concat(app.PRESETS.map(p => [p.id, p.name])).concat(Object.entries(ENVS).map(([k, v]) => ['env:' + k, v.name]));
        host.innerHTML = `<div class="grid-2"><div class="control"><label>Sound A</label><select class="select" data-a>${opts.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select></div><div class="control"><label>Sound B</label><select class="select" data-b>${opts.map((o, i) => `<option value="${o[0]}" ${i === 2 ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div></div><div class="ab-switch"><button class="btn btn-primary btn-xl" data-sw="A" aria-pressed="true">A</button><button class="btn btn-ghost btn-xl" data-sw="B" aria-pressed="false">B</button></div><div class="label-sm" style="text-align:center;margin-top:10px">Which feels more comfortable?</div><div class="btn-row" style="justify-content:center"><button class="btn btn-ghost" data-pick="A">A</button><button class="btn btn-ghost" data-pick="same">About the same</button><button class="btn btn-ghost" data-pick="B">B</button></div><p class="muted small" data-tally style="text-align:center"></p>`;
        ctx.snapshot = engine.activeList().map(s => ({ id: s.id, volume: s.volume, balance: s.balance }));
        const mixFor = v => v === 'current' ? (ctx.snapshot.length ? ctx.snapshot : [{ id: 'pink', volume: 0.45 }]) : v.startsWith('env:') ? ENVS[v.slice(4)].mix : app.PRESETS.find(p => p.id === v).mix;
        ctx.sw = async which => { $$('[data-sw]', host).forEach(b => { const on = b.dataset.sw === which; b.setAttribute('aria-pressed', on); b.classList.toggle('btn-primary', on); b.classList.toggle('btn-ghost', !on); }); await engine.loadMix(mixFor($(which === 'A' ? '[data-a]' : '[data-b]', host).value)); };
        $$('[data-sw]', host).forEach(b => b.addEventListener('click', () => running && ctx.sw(b.dataset.sw)));
        ctx.tally = store.get('lab:ab', []);
        $$('[data-pick]', host).forEach(b => b.addEventListener('click', () => { const a = $('[data-a]', host).value, bb = $('[data-b]', host).value; ctx.tally.push({ a, b: bb, pick: b.dataset.pick, when: Date.now() }); store.set('lab:ab', ctx.tally); const win = b.dataset.pick === 'same' ? 'about the same' : (b.dataset.pick === 'A' ? a : bb); $('[data-tally]', host).textContent = `Noted: ${win}. ${ctx.tally.length} comparisons so far. Change A or B and go again.`; renderProfile(); }));
      },
      async start(ctx) { safeMaster(); await ctx.sw('A'); },
    },
    {
      id: 'surprise', name: 'Surprise Me', cat: 'Discovery', tags: ['visual', 'nature', 'noise'], evidence: 'exploratory', from: 'Serendipity / recommender design',
      what: 'A safe random combination of sound, visual, movement and subtle variation. Volume stays conservative.',
      why: 'You might like something you would never have picked.',
      how: 'Press Start. Save it if you like it; press again for another.',
      whyTest: 'Serendipity helps people discover preferences outside their habits. No clinical claim.',
      defaults: {},
      async start() { safeMaster(); const pool = LIB.slice(); const n = 1 + Math.floor(Math.random() * 3); const mix = []; for (let i = 0; i < n; i++) { const id = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; mix.push({ id, volume: 0.3 + Math.random() * 0.3 }); } await engine.loadMix(mix); engine.setVariation(Math.random() < 0.5 ? 0.3 : 0, 7); const vis = ALL_VISUALS[Math.floor(Math.random() * ALL_VISUALS.length)]; focus.setVisual(vis.id); app.toast(`Surprise: ${mix.map(m => SOUND_NAME(m.id)).join(' + ')} with ${vis.name}`); focus.enterFocus(); },
      stop() { engine.setVariation(0); }, keepsSound: true,
    },
    {
      id: 'builder', name: 'One-Tap Session Builder', cat: 'Discovery', tags: ['learning'], evidence: 'exploratory', from: 'Product design',
      what: 'Three quick questions — what you are doing, how noticeable your tinnitus is right now, what kind of experience you want — and a session is built for you.',
      why: 'When you are tired or busy, you should not have to design anything.',
      how: 'Answer, press Start. Everything can be changed afterwards.',
      whyTest: 'A convenience experiment; the session is a suggestion, not a recommendation about your health.',
      settings: [{ key: 'doing', label: 'What are you doing?', type: 'buttons', options: [['sleep', 'Sleep'], ['relax', 'Relax'], ['work', 'Work'], ['read', 'Read'], ['quiet', 'Quiet time']] }, { key: 'level', label: 'How noticeable is your tinnitus right now?', type: 'buttons', options: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']] }, { key: 'kind', label: 'What type of experience?', type: 'buttons', options: [['simple', 'Simple'], ['nature', 'Nature'], ['immersive', 'Immersive'], ['experimental', 'Experimental']] }],
      defaults: { doing: 'relax', level: 'medium', kind: 'nature' },
      async start(ctx) {
        safeMaster(); const s = ctx.s; const prefs = store.get('lab:prefs', {}); const colour = ['brown', 'pink', 'white'].sort((a, b) => (prefs['colour:' + b] || 0) - (prefs['colour:' + a] || 0))[0];
        const base = s.level === 'high' ? 0.55 : s.level === 'medium' ? 0.45 : 0.35;
        let mix = [{ id: colour, volume: base }]; let visual = 'particles';
        if (s.kind === 'nature' || s.kind === 'immersive') { mix.push({ id: s.doing === 'sleep' ? 'rain' : s.doing === 'work' ? 'forest' : 'ocean', volume: base * 0.8 }); visual = s.doing === 'sleep' ? 'rainwindow' : s.doing === 'work' ? 'forest' : 'ocean'; }
        if (s.kind === 'immersive') { mix.push({ id: 'wind', volume: 0.25 }); }
        if (s.kind === 'simple') visual = 'circles';
        if (s.doing === 'sleep') { await engine.loadMix(mix); engine.setTimer(60, true); focus.setVisual(visual); if (s.kind !== 'simple') focus.enterFocus(); app.toast('Sleep session: 60-minute timer with fade'); return; }
        if (s.kind === 'experimental') { await engine.loadMix(mix); engine.setVariation(0.4, 7); focus.setVisual('synced'); focus.enterFocus(); return; }
        await engine.loadMix(mix); if (s.doing === 'work' || s.doing === 'read') engine.setMasterTone(6000, 0.5); focus.setVisual(visual); if (s.doing === 'relax' || s.doing === 'quiet') focus.enterFocus();
      },
      stop() { engine.setVariation(0); engine.resetMasterShape(); }, keepsSound: true,
    },

    // ---------------- SLEEP ----------------
    {
      id: 'sleepjourney', name: 'Dynamic Sleep Journey', cat: 'Sleep', tags: ['sleep', 'changing', 'nature', 'noise'], evidence: 'promising', from: 'Sleep-technology wind-down design',
      what: 'A session that becomes simpler and quieter as you drift off: rain + ocean + brown noise → rain + brown → brown → very soft brown → optional fade-out, or stay on all night.',
      why: 'Falling asleep and staying asleep want different things: some interest at first, then as little as possible.',
      how: 'Choose how long the wind-down takes and what happens at the end.',
      whyTest: 'Staged wind-downs are common in sleep apps; we test the tinnitus-specific version (keeping a soft bed all night if wanted).',
      settings: [{ key: 'len', label: 'Wind-down length', type: 'buttons', options: [[20, '20 min'], [40, '40 min'], [60, '60 min']] }, { key: 'end', label: 'At the end', type: 'buttons', options: [['stay', 'Keep soft brown noise on all night'], ['fade', 'Fade out completely']] }],
      defaults: { len: 40, end: 'stay' },
      start(ctx) { safeMaster(); const u = ctx.s.len / 4; runJourney([
        { min: u, label: 'rain + ocean + brown', mix: [{ id: 'rain', volume: 0.4 }, { id: 'ocean', volume: 0.4 }, { id: 'brown', volume: 0.45 }] },
        { min: u, label: 'rain + brown', mix: [{ id: 'rain', volume: 0.3 }, { id: 'brown', volume: 0.45 }] },
        { min: u, label: 'brown noise', mix: [{ id: 'brown', volume: 0.45 }] },
        { min: u, label: 'very soft brown', mix: [{ id: 'brown', volume: 0.22 }] },
      ], { crossfade: Math.min(120, u * 30), onEnd: () => { if (ctx.s.end === 'fade') { engine.setTimer(0.1, true); app.toast('Fading out. Sleep well.'); } else app.toast('Soft brown noise will stay on.'); } }); },
    },
    {
      id: 'timeline', name: 'Sound Timeline', cat: 'Sleep', tags: ['sleep', 'changing', 'creative'], evidence: 'exploratory', from: 'Sleep-technology / music sequencing',
      what: 'Design what happens over time: 0–10 min rain + brown, 10–20 brown fades, 20–30 ocean rises, 30–45 very soft noise only. Up to six parts, each with up to three sounds.',
      why: 'Your night (or your work session) has a shape. The sound can follow it.',
      how: 'Edit the parts, press Start. Save timelines you like.',
      whyTest: 'A design experiment; the value is personal fit.',
      custom: true, defaults: {},
      buildUI(ctx, host) {
        ctx.tl = store.get('lab:timeline-draft', [{ min: 10, mix: [{ id: 'rain', volume: 0.4 }, { id: 'brown', volume: 0.45 }] }, { min: 10, mix: [{ id: 'brown', volume: 0.4 }] }, { min: 10, mix: [{ id: 'ocean', volume: 0.4 }, { id: 'brown', volume: 0.25 }] }, { min: 15, mix: [{ id: 'pink', volume: 0.18 }] }]);
        const render = () => {
          host.innerHTML = `<div class="tl-bar">${ctx.tl.map((p, i) => `<div class="tl-seg" style="flex:${p.min}" title="${p.min} min">${p.min}m</div>`).join('')}</div><div class="tl-list">${ctx.tl.map((p, i) => `<div class="tl-row"><div class="tl-head"><strong>Part ${i + 1}</strong><select class="select" data-min="${i}">${[5, 10, 15, 20, 30, 45, 60].map(m => `<option ${p.min === m ? 'selected' : ''}>${m}</option>`).join('')}</select><span class="muted small">min</span><button class="btn btn-ghost btn-sm" data-del="${i}" aria-label="Remove part ${i + 1}">Remove</button></div>${[0, 1, 2].map(j => { const m = p.mix[j]; return `<div class="tl-sound"><select class="select" data-sel="${i}:${j}"><option value="">— none —</option>${LIB.map(id => `<option value="${id}" ${m && m.id === id ? 'selected' : ''}>${SOUND_NAME(id)}</option>`).join('')}</select><input type="range" min="0" max="100" value="${m ? Math.round(m.volume * 100) : 40}" data-vol="${i}:${j}" aria-label="Level"><output>${m ? Math.round(m.volume * 100) : 40}%</output></div>`; }).join('')}</div>`).join('')}</div><div class="btn-row"><button class="btn btn-ghost btn-sm" data-add ${ctx.tl.length >= 6 ? 'disabled' : ''}>+ Add part</button><form class="inline-form" data-save><input class="select" maxlength="40" placeholder="Timeline name" value="My timeline"><button class="btn btn-secondary btn-sm" type="submit">Save timeline</button></form></div><div class="lab-saved" data-saved></div>`;
          $$('input[type=range]', host).forEach(app.paintRange);
          $$('[data-min]', host).forEach(s => s.addEventListener('change', () => { ctx.tl[+s.dataset.min].min = +s.value; save(); render(); }));
          $$('[data-del]', host).forEach(b => b.addEventListener('click', () => { ctx.tl.splice(+b.dataset.del, 1); save(); render(); }));
          $$('[data-sel]', host).forEach(s => s.addEventListener('change', () => { const [i, j] = s.dataset.sel.split(':').map(Number); const vol = +$(`[data-vol="${i}:${j}"]`, host).value / 100; ctx.tl[i].mix = ctx.tl[i].mix.filter((_, k) => k !== j); if (s.value) ctx.tl[i].mix.splice(j, 0, { id: s.value, volume: vol }); save(); render(); }));
          $$('[data-vol]', host).forEach(r => r.addEventListener('input', () => { const [i, j] = r.dataset.vol.split(':').map(Number); if (ctx.tl[i].mix[j]) ctx.tl[i].mix[j].volume = +r.value / 100; r.nextElementSibling.textContent = r.value + '%'; save(); }));
          $('[data-add]', host).addEventListener('click', () => { ctx.tl.push({ min: 10, mix: [{ id: 'brown', volume: 0.3 }] }); save(); render(); });
          $('[data-save]', host).addEventListener('submit', e => { e.preventDefault(); const list = store.get('lab:timelines', []); list.push({ name: $('input', e.target).value.trim() || 'My timeline', tl: JSON.parse(JSON.stringify(ctx.tl)) }); store.set('lab:timelines', list); render(); app.toast('Timeline saved'); });
          const sv = $('[data-saved]', host); store.get('lab:timelines', []).forEach(t => { const b = document.createElement('button'); b.className = 'chip'; b.innerHTML = `<strong>${t.name}</strong><span>${t.tl.reduce((a, p) => a + p.min, 0)} min · ${t.tl.length} parts</span>`; b.addEventListener('click', () => { ctx.tl = JSON.parse(JSON.stringify(t.tl)); save(); render(); }); sv.appendChild(b); });
        };
        const save = () => store.set('lab:timeline-draft', ctx.tl); render();
      },
      start(ctx) { safeMaster(); const segs = ctx.tl.filter(p => p.mix.length).map((p, i) => ({ min: p.min, label: `part ${i + 1}`, mix: p.mix })); if (!segs.length) return app.toast('Add at least one sound'); runJourney(segs, { crossfade: 60, onEnd: () => stopRunning('Timeline finished') }); },
    },
  ];
  const byId = Object.fromEntries(EXPERIMENTS.map(e => [e.id, e]));
  const NEW_IDS = ['breathsync', 'mixpoint', 'paint', 'discovery', 'living', 'sync'];

  // ---------- eyes-closed screen ----------
  function openEyesClosed() { const el = $('#eyes-screen'); el.hidden = false; document.body.style.overflow = 'hidden'; el.classList.remove('show'); $('#eyes-toggle').focus(); }
  function closeEyesClosed() { const el = $('#eyes-screen'); el.hidden = true; document.body.style.overflow = ''; }
  $('#eyes-screen').addEventListener('pointerdown', e => { if (!e.target.closest('button')) { const el = $('#eyes-screen'); el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 5000); } });
  $('#eyes-toggle').addEventListener('click', () => app.togglePlay());
  $('#eyes-timer').addEventListener('click', () => { const order = [0, 15, 30, 60, 90]; const cur = engine.timer.durationMin || 0; const nxt = order[(order.indexOf(cur) + 1) % order.length]; engine.setTimer(nxt, true); $('#eyes-timer').textContent = nxt ? `Timer ${nxt} min` : 'Timer off'; });
  $('#eyes-exit').addEventListener('click', () => stopRunning());
  engine.on(t => { if (t === 'state') $('#eyes-toggle').textContent = engine.isPlaying ? 'Pause' : 'Play'; });

  // ---------- runtime ----------
  function stopRunning(msg) {
    if (!running) return; const { exp, ctx } = running; clearTimers(); if (exp.countdownEl) exp.countdownEl.textContent = '';
    try { exp.stop && exp.stop(ctx); } catch (_) { } if (!exp.keepsSound) engine.stopAll(); engine.setVariation(0); engine.resetMasterShape();
    const prev = running; running = null; updateRunningUI(); if (msg) app.toast(msg);
    if (!prev.exp.noRun) showAfterFeedback(prev.exp, prev.ctx);
  }
  function updateRunningUI() { const el = $('#player-exp'); if (running) { el.hidden = false; el.textContent = `Experiment: ${running.exp.name}`; } else el.hidden = true; $$('.lab-card').forEach(c => c.classList.toggle('running', !!running && c.dataset.id === running.exp.id)); $$('[data-exp-start]').forEach(b => { const on = running && b.dataset.expStart === running.exp.id; b.textContent = on ? 'Running…' : 'Start Experiment'; b.disabled = !!on; }); }
  $('#player-stop').addEventListener('click', () => { if (running) stopRunning(); });

  function showAfterFeedback(exp, ctx) {
    const host = ctx.host && $('[data-after]', ctx.host); if (!host) return;
    host.innerHTML = `<div class="card lab-result"><h3>How was that?</h3><p>Did this make your experience more comfortable?</p><div class="btn-row"><button class="btn btn-ghost btn-sm" data-c="helpful">Helpful</button><button class="btn btn-ghost btn-sm" data-c="none">No difference</button><button class="btn btn-ghost btn-sm" data-c="less">Less comfortable</button></div><p>Would you use this again?</p><div class="btn-row"><button class="btn btn-ghost btn-sm" data-a="yes">Yes</button><button class="btn btn-ghost btn-sm" data-a="maybe">Maybe</button><button class="btn btn-ghost btn-sm" data-a="no">No</button></div><p class="muted small">Stored only on this device, only to personalise your suggestions.</p></div>`;
    $$('[data-c]', host).forEach(b => b.addEventListener('click', () => { setFb(exp.id, { comfort: b.dataset.c, rating: b.dataset.c === 'helpful' ? 'helpful' : b.dataset.c === 'less' ? 'not' : 'neutral' }); $$('[data-c]', host).forEach(x => x.classList.toggle('btn-secondary', x === b)); renderLists(); }));
    $$('[data-a]', host).forEach(b => b.addEventListener('click', () => { setFb(exp.id, { again: b.dataset.a }); $$('[data-a]', host).forEach(x => x.classList.toggle('btn-secondary', x === b)); renderLists(); }));
  }

  // ---------- card / detail rendering ----------
  const ctxs = {};
  function ctxFor(exp) {
    if (ctxs[exp.id]) return ctxs[exp.id];
    const d = typeof exp.defaults === 'function' ? exp.defaults() : Object.assign({}, exp.defaults); (exp.settings || []).forEach(st => { if (d[st.key] === undefined && st.value !== undefined) d[st.key] = st.value; });
    const saved = store.get('lab:settings:' + exp.id); if (saved) Object.assign(d, saved);
    const c = { s: d, host: null, countdown(sec, done) { const el = $('[data-countdown]', this.host); let left = sec; const tick = () => { el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} remaining`; if (left-- <= 0) { el.textContent = ''; done(); return; } later(tick, 1000); }; tick(); }, ask(q, opts) { const el = $('[data-after]', this.host); el.innerHTML = `<div class="card lab-result"><h3>${q}</h3><div class="btn-row">${opts.map(o => `<button class="btn btn-ghost btn-sm" data-q="${o}">${o}</button>`).join('')}</div></div>`; $$('[data-q]', el).forEach(b => b.addEventListener('click', () => { const log = store.get('lab:answers', []); log.push({ id: running ? running.exp.id : null, q, a: b.dataset.q, when: Date.now() }); store.set('lab:answers', log); stopRunning('Thanks — noted on this device only.'); })); } };
    ctxs[exp.id] = c; return c;
  }
  function renderCard(exp, compact) {
    const f = fb()[exp.id] || {}; const isFav = favs().includes(exp.id);
    const card = document.createElement('article'); card.className = 'lab-card' + (compact ? ' compact' : ''); card.dataset.id = exp.id;
    card.innerHTML = `<div class="lab-card-head"><div><div class="lab-cat">${exp.cat}${NEW_IDS.includes(exp.id) ? ' · <span class="tag tag-new">New</span>' : ''}</div><h3>${exp.name}</h3></div><span class="ev ev-${exp.evidence}">${EVIDENCE_LABEL[exp.evidence]}</span></div><p class="lab-what">${exp.what}</p>${compact ? '' : `<dl class="lab-dl"><dt>Why try it</dt><dd>${exp.why}</dd><dt>How to use it</dt><dd>${exp.how}</dd></dl>`}<div class="lab-actions"><button class="btn btn-primary" data-open="${exp.id}">${compact ? 'Open' : 'Open experiment'}</button>${f.rating ? `<span class="muted small">You said: ${f.rating === 'helpful' ? 'Helpful' : f.rating === 'not' ? 'Not for me' : 'Neutral'}</span>` : ''}${isFav ? '<span class="tag">★ Favourite</span>' : ''}</div>`;
    $('[data-open]', card).addEventListener('click', () => openExperiment(exp.id)); return card;
  }
  function openExperiment(id) {
    const exp = byId[id]; if (!exp) return; const ctx = ctxFor(exp); const panel = $('#lab-detail'); panel.hidden = false; panel.innerHTML = '';
    const f = fb()[exp.id] || {}; const isFav = favs().includes(exp.id);
    panel.innerHTML = `<div class="lab-detail-inner"><button class="btn btn-ghost btn-sm" data-close>← Back to experiments</button>
      <div class="lab-card-head"><div><div class="lab-cat">${exp.cat} · from ${exp.from}</div><h2>${exp.name}</h2></div><span class="ev ev-${exp.evidence}">${EVIDENCE_LABEL[exp.evidence]}</span></div>
      <dl class="lab-dl"><dt>What it does</dt><dd>${exp.what}</dd><dt>Why you might try it</dt><dd>${exp.why}</dd><dt>How to use it</dt><dd>${exp.how}</dd></dl>
      <details class="lab-why"><summary>Why are we testing this?</summary><p>${exp.whyTest}</p>${exp.limits ? `<p><strong>Known limitations:</strong> ${exp.limits}</p>` : ''}${exp.risks ? `<p><strong>Potential risks:</strong> ${exp.risks}</p>` : ''}<p class="muted small">Not a medical treatment. Stop at any time with the Stop button below or in the player bar.</p></details>
      <div class="lab-settings" data-settings></div><div data-custom></div><div class="lab-countdown" data-countdown></div>
      <div class="lab-run">${exp.noRun ? '' : `<button class="btn btn-primary btn-lg" data-exp-start="${exp.id}">Start Experiment</button>`}<button class="btn btn-ghost" data-stop>Stop</button><button class="btn btn-ghost" data-reset>Reset</button><button class="btn btn-secondary" data-fav aria-pressed="${isFav}">${isFav ? '★ Saved as favourite' : '☆ Save as favourite'}</button></div>
      <div class="lab-rate"><span class="label-sm">Rate this experiment</span><div class="seg" role="radiogroup" aria-label="Rating"><button role="radio" aria-checked="${f.rating === 'helpful'}" data-rate="helpful">Helpful</button><button role="radio" aria-checked="${f.rating === 'neutral'}" data-rate="neutral">Neutral</button><button role="radio" aria-checked="${f.rating === 'not'}" data-rate="not">Not for me</button></div></div>
      <div data-after></div></div>`;
    ctx.host = panel; renderSettings(exp, ctx, $('[data-settings]', panel)); if (exp.custom && exp.buildUI) exp.buildUI(ctx, $('[data-custom]', panel));
    $('[data-close]', panel).addEventListener('click', () => { panel.hidden = true; panel.innerHTML = ''; });
    const sb = $('[data-exp-start]', panel); if (sb) sb.addEventListener('click', async () => { if (running && running.exp !== exp) stopRunning(); else if (running) return; await engine.init(); running = { exp, ctx }; setFb(exp.id, { tries: ((fb()[exp.id] || {}).tries || 0) + 1, last: Date.now() }); store.set('lab:settings:' + exp.id, ctx.s); updateRunningUI(); try { await exp.start(ctx); } catch (e) { console.error(e); app.toast('Could not start: ' + e.message); running = null; updateRunningUI(); } renderLists(); });
    $('[data-stop]', panel).addEventListener('click', () => { if (running && running.exp === exp) stopRunning('Stopped'); else { exp.stop && exp.stop(ctx); engine.stopAll(); } });
    $('[data-reset]', panel).addEventListener('click', () => { if (running && running.exp === exp) stopRunning(); store.del('lab:settings:' + exp.id); delete ctxs[exp.id]; openExperiment(exp.id); app.toast('Settings reset'); });
    $('[data-fav]', panel).addEventListener('click', e => { const list = favs(); const i = list.indexOf(exp.id); if (i >= 0) list.splice(i, 1); else list.push(exp.id); store.set('lab:favs', list); const on = i < 0; e.currentTarget.setAttribute('aria-pressed', on); e.currentTarget.textContent = on ? '★ Saved as favourite' : '☆ Save as favourite'; renderLists(); });
    $$('[data-rate]', panel).forEach(b => b.addEventListener('click', () => { setFb(exp.id, { rating: b.dataset.rate }); $$('[data-rate]', panel).forEach(x => x.setAttribute('aria-checked', x === b)); renderLists(); renderProfile(); }));
    updateRunningUI(); panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- profile & recommendations ----------
  function profile() {
    const prefs = store.get('lab:prefs', {}); const counts = store.get('playcounts', {}); const f = fb(); const lines = [];
    const top = (k, vals) => vals.slice().sort((a, b) => (prefs[k + ':' + b] || 0) - (prefs[k + ':' + a] || 0))[0];
    const totalPlays = Object.values(counts).reduce((a, b) => a + b, 0);
    if (Object.keys(prefs).length) { const c = top('colour', ['brown', 'pink', 'white']); lines.push(c === 'brown' ? 'lower-frequency noise' : c === 'white' ? 'brighter noise' : 'balanced (pink) noise'); const n = top('nature', ['none', 'rain', 'ocean', 'forest', 'wind', 'stream']); lines.push(n === 'none' ? 'noise on its own' : 'nature sounds (' + SOUND_NAME(n) + ')'); lines.push(top('change', ['stable', 'organic']) === 'organic' ? 'slowly changing sound' : 'steady, predictable sound'); }
    if (totalPlays >= 5) { const fav = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]; lines.push(`${SOUND_NAME(fav[0])} is your most-played sound`); }
    const motion = store.get('motion', 'low'); lines.push(motion === 'still' || motion === 'low' ? 'low visual movement' : 'more visual movement'); lines.push(document.documentElement.dataset.theme === 'dark' ? 'darker visuals' : 'lighter visuals');
    const liked = Object.entries(f).filter(([, v]) => v.rating === 'helpful').map(([k]) => byId[k]).filter(Boolean); if (liked.length) lines.push('experiments you found helpful: ' + liked.map(e => e.name).join(', '));
    return { lines, prefs, liked };
  }
  function recommend() {
    const p = profile(); const f = fb(); const likedTags = {}; p.liked.forEach(e => e.tags.forEach(t => likedTags[t] = (likedTags[t] || 0) + 1));
    const prefs = p.prefs; if ((prefs['change:organic'] || 0) > (prefs['change:stable'] || 0)) likedTags.changing = (likedTags.changing || 0) + 1; if (store.get('motion') === 'still') likedTags.lowmotion = (likedTags.lowmotion || 0) + 1; if (store.get('lab:region')) likedTags.region = (likedTags.region || 0) + 2;
    return EXPERIMENTS.filter(e => !(f[e.id] && (f[e.id].rating === 'not' || f[e.id].again === 'no'))).map(e => ({ e, score: e.tags.reduce((a, t) => a + (likedTags[t] || 0), 0) + (f[e.id] ? 0 : 0.5) + (NEW_IDS.includes(e.id) ? 0.3 : 0) })).sort((a, b) => b.score - a.score).slice(0, 4).map(x => x.e);
  }
  function renderProfile() { const p = profile(); const el = $('#lab-profile'); el.innerHTML = `<p>${p.lines.length > 2 ? 'You tend to prefer:' : 'Not much known yet — try Sound Discovery or rate a few experiments.'}</p><ul class="bullets">${p.lines.map(l => `<li>${l}</li>`).join('')}</ul><p class="muted small">Built only from your own taps, stored only on this device. <button class="btn btn-ghost btn-sm" id="profile-clear">Clear profile</button></p>`; $('#profile-clear').addEventListener('click', () => { ['lab:prefs', 'lab:feedback', 'lab:ab', 'lab:answers', 'playcounts'].forEach(k => store.del(k)); renderLists(); renderProfile(); app.toast('Profile cleared'); }); const rec = $('#lab-recommended'); rec.innerHTML = ''; recommend().forEach(e => rec.appendChild(renderCard(e, true))); }

  // ---------- lists ----------
  let labCat = 'All';
  function renderLists() {
    const host = $('#lab-list'); host.innerHTML = '';
    const list = EXPERIMENTS.filter(e => labCat === 'All' || (labCat === 'New' ? NEW_IDS.includes(e.id) : e.cat === labCat));
    list.forEach(e => host.appendChild(renderCard(e, true)));
    const f = fb(); const fv = favs();
    const mk = (sel, ids, empty) => { const h = $(sel); h.innerHTML = ''; if (!ids.length) { h.innerHTML = `<p class="muted small">${empty}</p>`; return; } ids.forEach(id => { const e = byId[id]; if (!e) return; const b = document.createElement('button'); b.className = 'chip'; b.innerHTML = `<strong>${e.name}</strong><span>${e.cat}</span>`; b.addEventListener('click', () => openExperiment(id)); h.appendChild(b); }); };
    mk('#hist-recent', Object.entries(f).filter(([, v]) => v.last).sort((a, b) => b[1].last - a[1].last).slice(0, 8).map(([k]) => k), 'Nothing tried yet.');
    mk('#hist-favs', fv, 'No favourites yet.');
    mk('#hist-good', Object.entries(f).filter(([, v]) => v.rating === 'helpful' || v.comfort === 'helpful').map(([k]) => k), 'Nothing rated helpful yet.');
    mk('#hist-bad', Object.entries(f).filter(([, v]) => v.rating === 'not' || v.comfort === 'less' || v.again === 'no').map(([k]) => k), 'Nothing marked "not for me".');
    updateRunningUI();
  }
  $$('#lab-cats button').forEach(b => b.addEventListener('click', () => { labCat = b.dataset.cat; $$('#lab-cats button').forEach(x => x.setAttribute('aria-checked', x === b)); renderLists(); }));

  window.softwaveLab = { open: openExperiment, stop: stopRunning, experiments: EXPERIMENTS, isRunning: () => !!running, onTap() { const p = focus.getParam && focus.getParam(); if (!p || !p.soundTouch) return; engine.setMasterTone(2200, 0.08); later(() => engine.setMasterTone(20000, 0.6), 350); if (p.haptic && navigator.vibrate) navigator.vibrate(12); } };
  renderLists(); renderProfile();
  const qe = new URLSearchParams(location.search).get('exp'); if (qe && byId[qe]) setTimeout(() => { app.showView('lab'); openExperiment(qe); }, 120);
})();
