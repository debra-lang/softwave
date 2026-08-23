/* Softwave — The Lab: personal sound discovery
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
  // Premium gate — OFF. When activated: every premium experiment still previews; Sound Discovery allows one full session free,
  // then saving the profile, repeated discoveries and premium experiments ask for Premium. Nothing already saved is ever removed.
  const PREMIUM = { active: false, hasPremium: () => store.get('premium', false), freeDiscoveries: 1 };
  function gate(exp) { if (!PREMIUM.active || !exp.premium || PREMIUM.hasPremium()) return true; if (exp.id === 'discovery' && (store.get('lab:discoveries', 0) < PREMIUM.freeDiscoveries)) return true; app.toast('Continue discovering your personalised sound with Premium — see Free & Premium below.', 5000); return false; }

  // ---------- records ----------
  const fb = () => store.get('lab:feedback', {});
  const setFb = (id, patch) => { const all = fb(); all[id] = Object.assign({ tries: 0 }, all[id] || {}, patch); store.set('lab:feedback', all); };
  const favs = () => store.get('lab:favs', []);
  const mySounds = () => store.get('lab:sounds', []);
  const saveSound = (snd) => { const l = mySounds(); l.push(snd); store.set('lab:sounds', l); app.renderPresets && app.renderPresets(); };
  const EV = { established: 'Well-studied principle', promising: 'Promising research', exploratory: 'Experimental — research is limited' };

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
    let k = 0; const step = async () => { const seg = segments[k % segments.length]; await apply(seg, k === 0 ? 3 : xf); if (seg.label) app.toast(`Journey: ${seg.label}`, 2500); k++; if (k >= segments.length && !o.loop) { later(() => o.onEnd && o.onEnd(), seg.min * 60000); return; } later(step, seg.min * 60000); };
    engine.playAll(); step();
  }

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
  const NATURES = ['none', 'rain', 'ocean', 'wind', 'forest', 'stream'];
  const describe = (p, nature) => { const b = []; b.push(p.colour < 0.33 ? 'deep noise' : p.colour < 0.67 ? 'balanced noise' : 'bright noise'); if (p.warm < -0.25) b.push('warmer'); if (p.warm > 0.25) b.push('brighter'); if (p.deep > 0.3) b.push('airy'); if (p.deep < -0.3) b.push('deep'); if (p.soft < -0.3) b.push('soft'); if (p.smooth > 0.3) b.push('textured'); if (p.width > 0.6) b.push('wide'); if (p.moving > 0.3) b.push('gently moving'); if (p.rich > 0.4) b.push('rich'); if (p.mod > 0.3) b.push('slow swells'); if (nature && nature !== 'none') b.push(NAME(nature).toLowerCase()); return b.join(' · '); };
  const soundMix = (snd, vol = 0.55) => { const m = [{ id: snd.type === 'paint' ? 'paint' : 'sculpt', volume: vol, balance: 0 }]; if (snd.type === 'paint') m[0].curve = snd.curve; else m[0].params = snd.params; if (snd.nature && snd.nature !== 'none') m.push({ id: snd.nature, volume: snd.natureVol || 0.35, balance: 0 }); return m; };
  function saveSoundForm(host, snd, afterSave) {
    let f = $('.inline-form', host); if (f) { f.remove(); return; }
    f = document.createElement('form'); f.className = 'inline-form'; f.innerHTML = `<label class="sr-only" for="snd-name">Sound name</label><input id="snd-name" class="select" maxlength="40" value="${snd.name || 'My sound'}" style="min-width:200px"><button class="btn btn-primary btn-sm" type="submit">Save</button><button class="btn btn-ghost btn-sm" type="button" data-cancel>Cancel</button>`;
    host.appendChild(f); const inp = $('input', f); inp.focus(); inp.select(); $('[data-cancel]', f).addEventListener('click', () => f.remove());
    f.addEventListener('submit', e => { e.preventDefault(); saveSound(Object.assign({}, snd, { name: inp.value.trim() || 'My sound', when: Date.now() })); f.remove(); app.toast('Saved on this device — it now appears under “My sounds” on the Sounds page.', 4000); afterSave && afterSave(); });
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
  function visualForProfile() { const motion = store.get('motion', 'low'); const dark = document.documentElement.dataset.theme === 'dark'; const pr = profile(); if (pr.nature === 'rain') return 'rainwindow'; if (pr.nature === 'ocean') return 'ocean'; if (pr.nature === 'forest') return 'forest'; if (motion === 'still') return dark ? 'nightsky' : 'softlight'; return dark ? 'nightsky' : 'particles'; }
  function renderProfile() {
    const pr = profile(); const el = $('#lab-profile'); if (!el) return;
    el.innerHTML = `${pr.rounds ? `<p>You seem to prefer:</p><ul class="bullets">${pr.lines.map(l => `<li>${l}</li>`).join('')}</ul><p class="muted small">Learned from ${pr.rounds} comparison${pr.rounds === 1 ? '' : 's'} in Sound Discovery.</p>` : `<p>Nothing learned yet. Run <strong>Sound Discovery</strong> — about ten quick comparisons — and Softwave will summarise what you preferred here.</p>`}
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
      id: 'discovery', name: 'Sound Discovery', cat: 'Discover', featured: true, premium: true, evidence: 'promising', from: 'Preference learning by pairwise comparison (also used to personalise hearing aids)',
      what: 'Two sounds, A and B. Switch between them as often as you like and say which feels more comfortable. The winner is kept and gently varied each round. After about ten rounds you have your preferred sound.',
      why: 'Everyone’s tinnitus is different, and so is the sound that feels comfortable next to it. Comparing two things at a time is the easiest way to find out what you actually prefer — no sliders, no jargon.',
      how: 'Press Start. Listen to A, tap B, listen again, then choose. "No difference" is a perfectly good answer. Keep the volume low.',
      whyTest: 'Pairwise comparison is a well-established way to learn preferences people cannot put into words; the same method is used to personalise hearing-aid settings. Answers are naturally a little noisy, so sounds change slowly and the winner is kept every round. This discovers what you prefer — it says nothing about your hearing or the cause of your tinnitus.',
      settings: [{ key: 'rounds', label: 'Rounds', type: 'buttons', options: [[8, '8 (quick)'], [12, '12'], [15, '15 (thorough)']] }],
      defaults: { rounds: 12 }, custom: true,
      buildUI(ctx, host) {
        host.innerHTML = `<div class="disc-wrap">
          <div class="disc-progress" data-progress aria-live="polite"></div>
          <div class="ab-switch"><button class="btn btn-primary btn-xl" data-sw="A" aria-pressed="true" disabled>A</button><button class="btn btn-ghost btn-xl" data-sw="B" aria-pressed="false" disabled>B</button></div>
          <p class="muted small" style="text-align:center" data-hint>Press Start Experiment to begin.</p>
          <div class="label-sm" style="text-align:center;margin-top:12px">Which feels more comfortable?</div>
          <div class="btn-row" style="justify-content:center"><button class="btn btn-ghost" data-pick="A" disabled>A</button><button class="btn btn-ghost" data-pick="same" disabled>No difference</button><button class="btn btn-ghost" data-pick="B" disabled>B</button></div>
          <div data-result></div></div>`;
        $$('[data-sw]', host).forEach(b => b.addEventListener('click', () => ctx.switchTo && ctx.switchTo(b.dataset.sw)));
        $$('[data-pick]', host).forEach(b => b.addEventListener('click', () => ctx.answer && ctx.answer(b.dataset.pick)));
      },
      async start(ctx) {
        safeMaster(); engine.stopAll(); await engine.init(); ctx.finished = false;
        const host = ctx.host; const rounds = ctx.s.rounds; let round = 0;
        const saved = profileParams();
        let best = { params: saved ? Object.assign({}, saved) : Object.assign(DEF(), { colour: 0.35, width: 0.35 }), nature: 'none' };
        const perturb = (b) => { const p = Object.assign({}, b.params); const n = 1 + (Math.random() < 0.4 ? 1 : 0); const dims = DIMS.slice().sort(() => Math.random() - 0.5).slice(0, n); for (const d of dims) { const [lo, hi] = DIM_RANGE[d]; const span = (hi - lo) * (round < 4 ? 0.45 : 0.25); p[d] = clamp(p[d] + (Math.random() * 2 - 1) * span, lo, hi); } let nature = b.nature; if (Math.random() < (round < 3 ? 0.5 : 0.25)) nature = NATURES[Math.floor(Math.random() * NATURES.length)]; return { params: p, nature }; };
        let cand = perturb(best); const sides = { A: best, B: cand };
        const prep = async () => { engine.setSculpt(sides.A.params, 'discoA'); engine.setSculpt(sides.B.params, 'discoB'); if (!engine.isActive('discoA')) await engine.startSound('discoA', 0.55); if (!engine.isActive('discoB')) await engine.startSound('discoB', 0.55); for (const n of NATURES) if (n !== 'none') { const want = sides.A.nature === n || sides.B.nature === n; if (want && !engine.isActive(n)) await engine.startSound(n, 0.001); if (!want && engine.isActive(n)) engine.stopSound(n); } await engine.playAll(); };
        ctx.switchTo = (s) => { $$('[data-sw]', host).forEach(b => { const on = b.dataset.sw === s; b.setAttribute('aria-pressed', on); b.classList.toggle('btn-primary', on); b.classList.toggle('btn-ghost', !on); }); engine.crossfade(s === 'A' ? 'discoB' : 'discoA', s === 'A' ? 'discoA' : 'discoB', 0.18); for (const n of NATURES) if (n !== 'none' && engine.isActive(n)) { if (sides[s].nature === n) engine.rampVolume(n, 0.35, 0.25); else engine.muteQuick(n); } };
        const show = () => { $('[data-progress]', host).innerHTML = Array.from({ length: rounds }, (_, i) => `<span class="${i < round ? 'done' : i === round ? 'now' : ''}"></span>`).join('') + `<em>Round ${round + 1} of ${rounds}</em>`; $('[data-hint]', host).textContent = 'Tap A and B to compare, then choose below.'; $$('[data-sw],[data-pick]', host).forEach(b => b.disabled = false); };
        const next = async () => { sides.A = best; sides.B = cand; await prep(); engine.muteQuick('discoB'); for (const n of NATURES) if (n !== 'none' && engine.isActive(n)) { if (sides.A.nature === n) engine.rampVolume(n, 0.35, 0.5); else engine.muteQuick(n); } ctx.switchTo('A'); show(); };
        ctx.answer = (pick) => { const winner = pick === 'B' ? cand : best; if (pick !== 'same') learn(winner.params, winner.nature); best = pick === 'same' ? best : winner; round++; if (round >= rounds) { finish(); return; } cand = perturb(best); next(); };
        const finish = async () => {
          clearTimers(); ctx.result = best; ctx.finished = true; sides.A = best; sides.B = best; engine.setSculpt(best.params, 'discoA'); ctx.switchTo('A'); if (engine.isActive('discoB')) engine.stopSound('discoB'); for (const n of NATURES) if (n !== 'none' && engine.isActive(n) && best.nature !== n) engine.stopSound(n);
          $$('[data-sw],[data-pick]', host).forEach(b => b.disabled = true); $('[data-progress]', host).innerHTML = '<em>Done</em>'; $('[data-hint]', host).textContent = '';
          const snd = { type: 'sculpt', params: best.params, nature: best.nature, natureVol: 0.35, name: 'My discovered sound' };
          $('[data-result]', host).innerHTML = `<div class="card lab-result disc-result"><div class="label-sm">Your preferred sound</div><h3>${describe(best.params, best.nature)}</h3><p class="muted small">This is what you chose most often. It is a preference, not a measurement of your hearing.</p>
            <div class="btn-row"><button class="btn btn-primary" data-r="listen">Listen</button><button class="btn btn-secondary" data-r="tune">Fine tune in Sound Sculptor</button><button class="btn btn-secondary" data-r="save">Save</button><button class="btn btn-ghost" data-r="fav">Add to favourites</button><button class="btn btn-ghost" data-r="sleep">Use for sleep</button><button class="btn btn-ghost" data-r="visual">Add visual</button><button class="btn btn-ghost" data-r="again">Try again</button></div><div data-saveform></div></div>`;
          const R = $('[data-result]', host);
          $('[data-r="listen"]', R).addEventListener('click', async () => { await engine.loadMix(soundMix(snd)); });
          $('[data-r="tune"]', R).addEventListener('click', async () => { await engine.loadMix(soundMix(snd)); store.set('lab:settings:sculptor', sculptSettingsFrom(best.params, best.nature)); delete ctxs.sculptor; openExperiment('sculptor'); });
          $('[data-r="save"]', R).addEventListener('click', () => saveSoundForm($('[data-saveform]', R), snd));
          $('[data-r="fav"]', R).addEventListener('click', async () => { await engine.loadMix(soundMix(snd)); const combos = store.get('combos', []); combos.push({ name: 'My discovered sound', mix: engine.snapshot(), master: engine.masterVolume, visual: store.get('visual', 'ocean'), motion: store.get('motion', 'low'), timer: 0 }); store.set('combos', combos); app.toast('Added to favourites (Visual Focus → My experiences).'); });
          $('[data-r="sleep"]', R).addEventListener('click', async () => { await engine.loadMix(soundMix(Object.assign({}, snd, { params: Object.assign({}, best.params, { moving: 0 }) }), 0.5)); engine.setTimer(60, true); app.showView('sleep'); app.toast('Sleep: 60-minute timer with gentle fade.'); });
          $('[data-r="visual"]', R).addEventListener('click', async () => { await engine.loadMix(soundMix(snd)); focus.setVisual(visualForProfile()); focus.enterFocus(); });
          $('[data-r="again"]', R).addEventListener('click', () => { stopRunning(); openExperiment('discovery'); });
          renderProfile(); stopRunning(null, true);
        };
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
        host.innerHTML = `<canvas class="paint-canvas" width="720" height="240" aria-label="Frequency painting canvas. Draw to shape the sound."></canvas><div class="scale"><span>60 Hz</span><span>500</span><span>2k</span><span>6k</span><span>14 kHz</span></div>
          <div class="btn-row"><button class="btn btn-secondary btn-sm" data-act="paint" aria-pressed="true">Paint</button><button class="btn btn-ghost btn-sm" data-act="reduce" aria-pressed="false">Reduce</button><button class="btn btn-ghost btn-sm" data-act="smooth">Smooth</button><button class="btn btn-ghost btn-sm" data-act="undo">Undo</button><button class="btn btn-ghost btn-sm" data-act="reset">Reset</button><button class="btn btn-ghost btn-sm" data-act="random">Randomize</button><button class="btn btn-ghost btn-sm" data-act="preview">Preview</button><button class="btn btn-secondary btn-sm" data-act="save">Save</button><button class="btn btn-ghost btn-sm" data-act="compare" aria-pressed="false">Compare with my preferred sound</button></div>
          <details class="kbd-alt"><summary class="muted small">Adjust without dragging</summary><div class="kbd-grid">${[60, 120, 250, 500, 1000, 2000, 4000, 8000, 14000].map((f, i) => `<label>${f >= 1000 ? f / 1000 + 'k' : f}<input type="range" min="0" max="100" data-band="${Math.round(i * 23 / 8)}" aria-label="Band ${f} hertz"></label>`).join('')}</div></details><div data-saveform></div><div class="lab-saved" data-saved></div>`;
        const c = $('canvas', host), cx = c.getContext('2d'); ctx.curve = (store.get('lab:paintcurve') || new Array(24).fill(0.5)).slice(); ctx.hist = []; let mode = 'paint', down = false;
        const draw = () => { const w = c.width, h = c.height; const dark = document.documentElement.dataset.theme === 'dark'; cx.fillStyle = dark ? '#0f1430' : '#eef1fa'; cx.fillRect(0, 0, w, h); const bw = w / 24; const g = cx.createLinearGradient(0, h, 0, 0); g.addColorStop(0, '#5fb8c9'); g.addColorStop(1, '#3f6cf0'); for (let i = 0; i < 24; i++) { const v = ctx.curve[i]; cx.fillStyle = g; cx.globalAlpha = 0.5 + v * 0.5; cx.beginPath(); cx.roundRect(i * bw + 3, h - v * (h - 10) - 5, bw - 6, v * (h - 10) + 2, 5); cx.fill(); } cx.globalAlpha = 1; $$('[data-band]', host).forEach(r => { r.value = Math.round(ctx.curve[+r.dataset.band] * 100); app.paintRange(r); }); };
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
          if (a === 'compare') { const pp = profileParams(); if (!pp) return app.toast('Run Sound Discovery first to have a preferred sound to compare with.'); const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); b.textContent = on ? 'Back to my painting' : 'Compare with my preferred sound'; if (on) { if (!engine.isActive('sculpt')) { engine.setSculpt(pp, 'sculpt'); await engine.startSound('sculpt', 0.6); engine.muteQuick('sculpt'); } if (!engine.isActive('paint')) { engine.setPaint(ctx.curve); await engine.startSound('paint', 0.6); engine.muteQuick('paint'); } engine.crossfade('paint', 'sculpt', 0.25); } else engine.crossfade('sculpt', 'paint', 0.25); await engine.playAll(); return; }
          draw(); engine.setPaint(ctx.curve); store.set('lab:paintcurve', ctx.curve); }));
        const renderSaved = () => { const h = $('[data-saved]', host); h.innerHTML = ''; mySounds().filter(s => s.type === 'paint').forEach(p => { const bt = document.createElement('button'); bt.className = 'chip'; bt.innerHTML = `<strong>${p.name}</strong>`; bt.addEventListener('click', () => { push(); ctx.curve = p.curve.slice(); draw(); engine.setPaint(ctx.curve); }); h.appendChild(bt); }); };
        renderSaved(); draw();
      },
      async start(ctx) { safeMaster(); engine.setPaint(ctx.curve); engine.stopAll(); await engine.startSound('paint', 0.6); await engine.playAll(); },
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
        { key: 'warm', label: 'Warm ↔ Bright', type: 'range', min: -100, max: 100, fmt: v => v < -20 ? 'Warm' : v > 20 ? 'Bright' : 'Neutral' },
        { key: 'deep', label: 'Deep ↔ Airy', type: 'range', min: -100, max: 100, fmt: v => v < -20 ? 'Deep' : v > 20 ? 'Airy' : 'Neutral' },
        { key: 'smooth', label: 'Smooth ↔ Textured', type: 'range', min: -100, max: 100, fmt: v => v < -20 ? 'Smooth' : v > 20 ? 'Textured' : 'Neutral' },
        { key: 'soft', label: 'Soft ↔ Crisp', type: 'range', min: -100, max: 100, fmt: v => v < -20 ? 'Soft' : v > 20 ? 'Crisp' : 'Neutral' },
        { key: 'width', label: 'Centred ↔ Wide', type: 'range', min: 0, max: 100, fmt: v => v < 25 ? 'Centred' : v > 65 ? 'Wide' : 'Medium' },
        { key: 'moving', label: 'Still ↔ Moving', type: 'range', min: 0, max: 100, fmt: v => v < 15 ? 'Still' : v < 60 ? 'Gently moving' : 'Moving' },
        { key: 'rich', label: 'Simple ↔ Rich', type: 'range', min: 0, max: 100, fmt: v => v < 25 ? 'Simple' : v > 65 ? 'Rich' : 'Medium' },
        { key: 'nature', label: 'Nature texture', type: 'select', options: NATURES.map(n => [n, n === 'none' ? 'None' : NAME(n)]) }],
      defaults: () => sculptSettingsFrom(profileParams() || DEF(), 'none'), custom: true,
      buildUI(ctx, host) {
        host.innerHTML = `<p class="muted" data-desc></p><div class="btn-row"><button class="btn btn-ghost btn-sm" data-from-profile>Start from My Sound Profile</button><button class="btn btn-ghost btn-sm" data-random>Randomize</button><button class="btn btn-ghost btn-sm" data-zero>Reset to neutral</button><button class="btn btn-secondary btn-sm" data-save>Save this sound</button><button class="btn btn-ghost btn-sm" data-journey>Use in Adaptive Journey</button></div><div data-saveform></div>`;
        const reopen = (settings) => { store.set('lab:settings:sculptor', settings); delete ctxs.sculptor; const wasRunning = running && running.exp.id === 'sculptor'; openExperiment('sculptor'); if (wasRunning) { running = { exp: byId.sculptor, ctx: ctxFor(byId.sculptor) }; running.ctx.host = $('#lab-detail'); byId.sculptor.start(running.ctx); updateRunningUI(); } };
        $('[data-from-profile]', host).addEventListener('click', () => { const pp = profileParams(); if (!pp) return app.toast('Run Sound Discovery first — then your profile can be a starting point.'); reopen(sculptSettingsFrom(pp, profile().nature)); });
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
      buildUI(ctx, host) { host.innerHTML = `<div class="btn-row"><button class="btn btn-secondary btn-sm" data-save>Save this blend</button></div>`; $('[data-save]', host).addEventListener('click', () => { const mixes = store.get('mixes', []); mixes.push({ name: 'Morph blend', mix: engine.snapshot().filter(m => m.volume > 0.01), master: engine.masterVolume }); store.set('mixes', mixes); app.renderPresets && app.renderPresets(); app.toast('Saved to your mixes.'); }); },
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
        const draw = () => { const w = c.width, h = c.height; const dark = document.documentElement.dataset.theme === 'dark'; cx.fillStyle = dark ? '#0f1430' : '#eef1fa'; cx.fillRect(0, 0, w, h); cx.strokeStyle = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)'; for (const r of [0.15, 0.3, 0.45]) { cx.beginPath(); cx.arc(w / 2, h / 2, r * w, 0, Math.PI * 2); cx.stroke(); } cx.fillStyle = dark ? '#e8ecf7' : '#131a2e'; cx.beginPath(); cx.arc(w / 2, h / 2, 7, 0, Math.PI * 2); cx.fill(); cx.font = '12px Manrope, sans-serif'; cx.textAlign = 'center'; cx.fillStyle = dark ? '#97a2c4' : '#5d6785'; cx.fillText('front', w / 2, 16); cx.fillText('behind', w / 2, h - 8); cx.fillText('left', 22, h / 2); cx.fillText('right', w - 24, h / 2);
          items().forEach(it => { const d = engine.def(it.id); const x = it.p.x * w, y = it.p.y * h; cx.fillStyle = `hsl(${d.hue} 80% 60% / .9)`; cx.beginPath(); cx.arc(x, y, 18, 0, Math.PI * 2); cx.fill(); cx.fillStyle = '#fff'; cx.font = '700 12px Manrope, sans-serif'; cx.fillText(d.name, x, y + 34); }); };
        const drawAlt = () => { const alt = $('[data-alt]', host); alt.innerHTML = items().map(it => `<label>${engine.def(it.id).name}: left–right<input type="range" min="-100" max="100" value="${Math.round((it.p.x - 0.5) * 200)}" data-sx="${it.id}" aria-label="${engine.def(it.id).name} left to right"></label>`).join(''); $$('[data-sx]', alt).forEach(r => { app.paintRange(r); r.addEventListener('input', () => { ctx.pos[r.dataset.sx].x = 0.5 + r.value / 200; applyOne({ id: r.dataset.sx, p: ctx.pos[r.dataset.sx] }); draw(); store.set('lab:spatial', ctx.pos); }); }); };
        const pick = ev => { const r = c.getBoundingClientRect(); const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height; return items().find(it => Math.hypot(it.p.x - x, it.p.y - y) < 0.09); };
        c.addEventListener('pointerdown', e => { drag = pick(e); if (drag) c.setPointerCapture(e.pointerId); });
        c.addEventListener('pointermove', e => { if (!drag) return; const r = c.getBoundingClientRect(); drag.p.x = clamp((e.clientX - r.left) / r.width, 0.04, 0.96); drag.p.y = clamp((e.clientY - r.top) / r.height, 0.04, 0.96); applyOne(drag); draw(); });
        addEventListener('pointerup', () => { if (drag) { store.set('lab:spatial', ctx.pos); drawAlt(); } drag = null; });
        ctx.draw = draw; ctx.drawAlt = drawAlt; ctx.applyAll = () => items().forEach(applyOne); draw(); drawAlt(); engine.on(t => { if (t === 'sounds' && running && running.exp.id === 'space') { ctx.applyAll(); draw(); drawAlt(); } });
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
      defaults: { j: 'ocean', len: 30, fade: false },
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
      defaults: { bed: 'brown', len: 20, var: 'gentle', sleep: false },
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
      buildUI(ctx, host) { host.innerHTML = `<div class="btn-row"><button class="btn btn-secondary btn-sm" data-save-session>Save this session</button></div>`; $('[data-save-session]', host).addEventListener('click', () => { if (!engine.activeList().length) return app.toast('Start the session first, then save it.'); const combos = store.get('combos', []); combos.push({ name: `My ${ctx.s.doing} session`, mix: engine.snapshot(), master: engine.masterVolume, visual: store.get('visual', 'ocean'), motion: store.get('motion', 'low'), timer: engine.timer.durationMin || 0 }); store.set('combos', combos); app.toast('Saved — find it under My experiences in Visual Focus.'); }); },
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
  const CATS = [['Discover', 'Find and shape the sound that suits you'], ['Explore', 'Ways of listening you will not find in a noise machine'], ['Focus', 'Something to rest your attention on while you listen'], ['Sessions', 'Let the app build the whole experience']];

  // ---------- runtime ----------
  function stopRunning(msg, finishedNaturally) {
    if (!running) return; const { exp, ctx } = running; clearTimers(); try { exp.stop && exp.stop(ctx); } catch (_) { } if (!exp.keepsSound) engine.stopAll(); engine.setVariation(0); engine.resetMasterShape();
    const prev = running; running = null; updateRunningUI(); if (msg) app.toast(msg); showAfterFeedback(prev.exp, prev.ctx);
  }
  function updateRunningUI() { const el = $('#player-exp'); if (el) { if (running) { el.hidden = false; el.textContent = `Experiment: ${running.exp.name}`; } else el.hidden = true; } $$('.lab-card').forEach(c => c.classList.toggle('running', !!running && c.dataset.id === running.exp.id)); $$('[data-exp-start]').forEach(b => { const on = running && b.dataset.expStart === running.exp.id; b.textContent = on ? 'Running…' : 'Start Experiment'; b.disabled = !!on; }); }
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
  function card(exp) {
    const f = fb()[exp.id] || {}; const el = document.createElement('article'); el.className = 'lab-card compact' + (exp.featured ? ' featured' : ''); el.dataset.id = exp.id;
    el.innerHTML = `${exp.featured ? '<div class="lab-reco">Recommended starting point</div>' : ''}<div class="lab-card-head"><div><div class="lab-cat">${exp.cat}${exp.premium ? ' · <span class="tag tag-prem">Premium preview</span>' : ''}</div><h3>${exp.name}</h3></div><span class="ev ev-${exp.evidence}">${EV[exp.evidence]}</span></div><p class="lab-what">${exp.what}</p><div class="lab-actions"><button class="btn btn-primary" data-open="${exp.id}">Open</button>${f.rating ? `<span class="muted small">You said: ${f.rating === 'helpful' ? 'Helpful' : f.rating === 'not' ? 'Not for me' : 'Neutral'}</span>` : ''}${favs().includes(exp.id) ? '<span class="tag">★ Favourite</span>' : ''}</div>`;
    $('[data-open]', el).addEventListener('click', () => openExperiment(exp.id)); return el;
  }
  function openExperiment(id) {
    const exp = byId[id]; if (!exp) return; const ctx = ctxFor(exp); const panel = $('#lab-detail'); panel.hidden = false; const f = fb()[exp.id] || {}; const isFav = favs().includes(exp.id);
    panel.innerHTML = `<div class="lab-detail-inner"><button class="btn btn-ghost btn-sm" data-close>← Back to experiments</button>
      <div class="lab-card-head"><div><div class="lab-cat">${exp.cat} · from ${exp.from}${exp.premium ? ' · <span class="tag tag-prem">Premium preview — free during beta</span>' : ''}</div><h2>${exp.name}</h2></div><span class="ev ev-${exp.evidence}">${EV[exp.evidence]}</span></div>
      <dl class="lab-dl"><dt>What it does</dt><dd>${exp.what}</dd><dt>Why try it</dt><dd>${exp.why}</dd><dt>How to use it</dt><dd>${exp.how}</dd></dl>
      <details class="lab-why"><summary>Why are we testing this?</summary><p>${exp.whyTest}</p><p class="muted small">Not a medical treatment. Stop at any time with the Stop button below or in the player bar.</p></details>
      <div class="lab-settings" data-settings></div><div data-custom></div>
      <div class="lab-run"><button class="btn btn-primary btn-lg" data-exp-start="${exp.id}">Start Experiment</button><button class="btn btn-ghost" data-stop>Stop</button><button class="btn btn-ghost" data-reset>Reset</button><button class="btn btn-secondary" data-fav aria-pressed="${isFav}">${isFav ? '★ Favourite' : '☆ Save as favourite'}</button></div>
      <div class="lab-rate"><span class="label-sm">Rate this experiment</span><div class="seg" role="radiogroup" aria-label="Rating"><button role="radio" aria-checked="${f.rating === 'helpful'}" data-rate="helpful">Helpful</button><button role="radio" aria-checked="${f.rating === 'neutral'}" data-rate="neutral">Neutral</button><button role="radio" aria-checked="${f.rating === 'not'}" data-rate="not">Not for me</button></div></div>
      <div data-after></div></div>`;
    ctx.host = panel; renderSettings(exp, ctx, $('[data-settings]', panel)); if (exp.custom && exp.buildUI) exp.buildUI(ctx, $('[data-custom]', panel));
    $('[data-close]', panel).addEventListener('click', () => { panel.hidden = true; panel.innerHTML = ''; });
    $('[data-exp-start]', panel).addEventListener('click', async () => { if (!gate(exp)) return; if (running && running.exp !== exp) stopRunning(); else if (running) return; if (exp.id === 'discovery') store.set('lab:discoveries', store.get('lab:discoveries', 0) + 1); await engine.init(); running = { exp, ctx }; setFb(exp.id, { tries: ((fb()[exp.id] || {}).tries || 0) + 1, last: Date.now() }); store.set('lab:settings:' + exp.id, ctx.s); updateRunningUI(); try { await exp.start(ctx); } catch (e) { console.error(e); app.toast('Could not start: ' + e.message); running = null; updateRunningUI(); } renderLists(); });
    $('[data-stop]', panel).addEventListener('click', () => { if (running && running.exp === exp) stopRunning('Stopped'); else { exp.stop && exp.stop(ctx); engine.stopAll(); } });
    $('[data-reset]', panel).addEventListener('click', () => { if (running && running.exp === exp) stopRunning(); store.del('lab:settings:' + exp.id); delete ctxs[exp.id]; openExperiment(exp.id); app.toast('Settings reset'); });
    $('[data-fav]', panel).addEventListener('click', e => { const l = favs(); const i = l.indexOf(exp.id); if (i >= 0) l.splice(i, 1); else l.push(exp.id); store.set('lab:favs', l); const on = i < 0; e.currentTarget.setAttribute('aria-pressed', on); e.currentTarget.textContent = on ? '★ Favourite' : '☆ Save as favourite'; renderLists(); });
    $$('[data-rate]', panel).forEach(b => b.addEventListener('click', () => { setFb(exp.id, { rating: b.dataset.rate }); $$('[data-rate]', panel).forEach(x => x.setAttribute('aria-checked', x === b)); renderLists(); renderProfile(); }));
    updateRunningUI(); panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- lists ----------
  function renderLists() {
    const host = $('#lab-list'); host.innerHTML = '';
    CATS.forEach(([cat, blurb]) => { const sec = document.createElement('section'); sec.className = 'lab-group'; sec.innerHTML = `<h3 class="lab-group-title">${cat}</h3><p class="muted small">${blurb}</p><div class="lab-grid"></div>`; EXPERIMENTS.filter(e => e.cat === cat).forEach(e => $('.lab-grid', sec).appendChild(card(e))); host.appendChild(sec); });
    const f = fb(); const mk = (sel, ids, empty) => { const h = $(sel); if (!h) return; h.innerHTML = ''; if (!ids.length) { h.innerHTML = `<p class="muted small">${empty}</p>`; return; } ids.forEach(id => { const e = byId[id]; if (!e) return; const b = document.createElement('button'); b.className = 'chip'; b.innerHTML = `<strong>${e.name}</strong><span>${e.cat}</span>`; b.addEventListener('click', () => openExperiment(id)); h.appendChild(b); }); };
    mk('#hist-recent', Object.entries(f).filter(([k, v]) => v.last && byId[k]).sort((a, b) => b[1].last - a[1].last).slice(0, 8).map(([k]) => k), 'Nothing tried yet.');
    mk('#hist-favs', favs().filter(id => byId[id]), 'No favourites yet.');
    mk('#hist-good', Object.entries(f).filter(([k, v]) => byId[k] && (v.rating === 'helpful' || v.comfort === 'more')).map(([k]) => k), 'Nothing rated helpful yet.');
    mk('#hist-bad', Object.entries(f).filter(([k, v]) => byId[k] && (v.rating === 'not' || v.comfort === 'less' || v.again === 'no')).map(([k]) => k), 'Nothing marked "not for me".');
    updateRunningUI();
  }
  $('#lab-start-discovery').addEventListener('click', () => openExperiment('discovery'));

  window.softwaveLab = { open: openExperiment, stop: stopRunning, experiments: EXPERIMENTS, isRunning: () => !!running, mySounds, soundMix, onTap() { const p = focus.getParam && focus.getParam(); if (!p || !p.soundTouch) return; engine.setMasterTone(2200, 0.08); later(() => engine.setMasterTone(20000, 0.6), 350); } };
  renderLists(); renderProfile();
  const qe = new URLSearchParams(location.search).get('exp'); if (qe && byId[qe]) setTimeout(() => openExperiment(qe), 120);
  document.dispatchEvent(new CustomEvent('softwave:lab-ready'));
})();
