/* Softwave — app UI */
(function () {
  'use strict';
  const { Engine, SOUND_DEFS, MAX_ACTIVE } = window.SoftwaveAudio;
  const { Background, ToneViz } = window.SoftwaveVisuals;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const engine = new Engine();
  window.softwave = engine; // for debugging

  // ---------- storage ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('softwave:' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem('softwave:' + k, JSON.stringify(v)); } catch (_) { } },
    del(k) { try { localStorage.removeItem('softwave:' + k); } catch (_) { } },
  };

  // ---------- helpers ----------
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const MINF = 20, MAXF = 16000;
  const sliderToHz = v => MINF * Math.pow(MAXF / MINF, v / 1000);
  const hzToSlider = f => Math.round(1000 * Math.log(f / MINF) / Math.log(MAXF / MINF));
  function paintRange(el) {
    const min = +el.min || 0, max = +el.max || 100; const pct = ((+el.value - min) / (max - min)) * 100;
    el.style.setProperty('--pct', pct + '%');
  }
  $$('input[type=range]').forEach(paintRange);
  document.addEventListener('input', e => { if (e.target.type === 'range') paintRange(e.target); });

  let toastT;
  function toast(msg, ms = 2600) {
    const el = $('#toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), ms);
  }

  // ---------- theme ----------
  const root = document.documentElement;
  function applyTheme(t) { root.dataset.theme = t; store.set('theme', t); }
  const qTheme = new URLSearchParams(location.search).get('theme');
  applyTheme(qTheme || store.get('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  $('#theme-toggle').addEventListener('click', () => applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));

  // ---------- views ----------
  const views = ['sounds', 'focus', 'lab', 'mixer', 'frequency', 'match', 'sleep', 'learn'];
  function showView(name) {
    if (!views.includes(name)) name = 'sounds';
    if (name === 'lab') ensureLab();
    views.forEach(v => { const el = $('#view-' + v); el.hidden = v !== name; el.classList.toggle('active', v === name); });
    $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.view === name));
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    bg.setMode(name === 'lab' ? 'lab' : engine.isActive('rain') ? 'rain' : 'calm');
  }
  document.addEventListener('click', e => {
    const sc = e.target.closest('[data-scroll]'); if (sc) { e.preventDefault(); const tgt = $(sc.getAttribute('href')); tgt && tgt.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const a = e.target.closest('[data-view]'); if (!a) return;
    e.preventDefault(); showView(a.dataset.view);
  });
  addEventListener('hashchange', () => showView(location.hash.slice(1)));

  // Lazy-load The Lab (experiments) only when needed, so the homepage stays light.
  let labPromise = null;
  function ensureLab() {
    if (window.softwaveLab) return Promise.resolve();
    if (labPromise) return labPromise;
    labPromise = new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = 'lab.js?v=19'; s.defer = true; s.onload = () => resolve(); s.onerror = () => { labPromise = null; reject(new Error('Could not load experiments')); }; document.body.appendChild(s); });
    return labPromise;
  }
  window.softwaveEnsureLab = ensureLab;

  // ---------- background ----------
  const bg = new Background($('#bg'), engine); window.softwaveBg = bg;

  // ---------- presets ----------
  const PRESETS = [
    { id: 'gentle', name: 'Gentle Relief', desc: 'Soft broadband sound, low volume', mix: [{ id: 'pink', volume: 0.45 }], master: 0.3 },
    { id: 'sleep', name: 'Sleep', desc: 'Brown noise + gentle rain', mix: [{ id: 'brown', volume: 0.6 }, { id: 'rain', volume: 0.35 }], master: 0.3 },
    { id: 'focus', name: 'Focus', desc: 'Pink noise + subtle nature', mix: [{ id: 'pink', volume: 0.5 }, { id: 'forest', volume: 0.3 }], master: 0.35 },
    { id: 'ocean', name: 'Ocean', desc: 'Soft waves + broadband bed', mix: [{ id: 'ocean', volume: 0.6 }, { id: 'brown', volume: 0.25 }], master: 0.35 },
    { id: 'rainy', name: 'Rainy Night', desc: 'Rain + low ambience', mix: [{ id: 'rain', volume: 0.55 }, { id: 'wind', volume: 0.3 }, { id: 'brown', volume: 0.2 }], master: 0.35 },
  ];
  function renderPresets() {
    const make = (container, includeCustom) => {
      container.innerHTML = '';
      const list = [...PRESETS];
      const custom = store.get('mixes', []);
      if (includeCustom) custom.forEach((m, i) => list.push({ id: 'custom-' + i, name: m.name, desc: m.mix.map(x => engine.def(x.id).name).join(' + '), mix: m.mix, master: m.master, custom: true, index: i }));
      list.forEach(p => {
        const b = document.createElement('button'); b.className = 'chip'; b.setAttribute('role', 'listitem'); b.dataset.preset = p.id;
        b.innerHTML = `<strong>${p.name}</strong><span>${p.desc}</span>`;
        b.addEventListener('click', () => loadPreset(p));
        container.appendChild(b);
      });
      if (includeCustom && !custom.length) {
        const b = document.createElement('a'); b.className = 'chip'; b.href = '#mixer'; b.dataset.view = 'mixer';
        b.innerHTML = '<strong>My Custom Mix</strong><span>Build one in the Mixer and save it</span>'; container.appendChild(b);
      }
    };
    make($('#presets'), true); make($('#sleep-presets'), false);
    const ms = store.get('lab:sounds', []); const row = $('#my-sounds-row'); const host = $('#my-sounds'); host.innerHTML = ''; row.hidden = !ms.length;
    ms.forEach((snd, i) => { const b = document.createElement('button'); b.className = 'chip chip-mine'; b.setAttribute('role', 'listitem'); b.innerHTML = `<strong>★ ${snd.name}</strong><span>${snd.type === 'paint' ? 'Painted sound' : 'Custom sound'}${snd.nature && snd.nature !== 'none' ? ' + ' + engine.def(snd.nature).name.toLowerCase() : ''}</span>`;
      b.addEventListener('click', async () => { const mix = [{ id: snd.type === 'paint' ? 'paint' : 'sculpt', volume: 0.55, balance: 0 }]; if (snd.type === 'paint') mix[0].curve = snd.curve; else mix[0].params = snd.params; if (snd.nature && snd.nature !== 'none') mix.push({ id: snd.nature, volume: snd.natureVol || 0.35, balance: 0 }); await loadPreset({ name: snd.name, mix, master: Math.min(engine.masterVolume, 0.45) }); });
      const del = document.createElement('button'); del.className = 'chip-del'; del.setAttribute('aria-label', 'Delete ' + snd.name); del.textContent = '×'; del.addEventListener('click', e => { e.stopPropagation(); ms.splice(i, 1); store.set('lab:sounds', ms); renderPresets(); toast('Sound deleted'); }); b.appendChild(del); host.appendChild(b); });
    const saved = $('#saved-mixes'); saved.innerHTML = '';
    const custom = store.get('mixes', []);
    if (!custom.length) saved.innerHTML = '<p class="muted">Nothing saved yet. Build a mix and tap "Save as My Custom Mix".</p>';
    custom.forEach((m, i) => {
      const b = document.createElement('button'); b.className = 'chip';
      b.innerHTML = `<strong>${m.name}</strong><span>${m.mix.map(x => engine.def(x.id).name + ' ' + Math.round(x.volume * 100) + '%').join(' · ')}</span>`;
      b.addEventListener('click', () => loadPreset({ name: m.name, mix: m.mix, master: m.master }));
      const del = document.createElement('button'); del.className = 'btn btn-ghost btn-sm'; del.textContent = 'Delete'; del.setAttribute('aria-label', 'Delete ' + m.name);
      del.addEventListener('click', e => { e.stopPropagation(); custom.splice(i, 1); store.set('mixes', custom); renderPresets(); toast('Mix deleted'); });
      const wrap = document.createElement('div'); wrap.style.display = 'flex'; wrap.style.gap = '6px'; wrap.style.alignItems = 'center'; wrap.append(b, del); saved.appendChild(wrap);
    });
  }
  async function loadPreset(p) {
    if (p.master !== undefined) setMaster(Math.min(p.master, engine.masterVolume || p.master));
    await engine.loadMix(p.mix);
    toast(`Playing “${p.name}” — adjust anything you like`);
  }

  const openDiscovery = async () => { showView('lab'); try { await ensureLab(); window.softwaveLab.open('discovery'); } catch (e) { toast(e.message); } };
  $('#home-discover').addEventListener('click', openDiscovery); $('#home-tool-discover').addEventListener('click', openDiscovery);
  $('#home-start').addEventListener('click', async () => { if (engine.activeList().length) { await engine.playAll(); openNow(); return; } await loadPreset(PRESETS[0]); openNow(); });

  // ---------- Sound preference profile, available app-wide (read-only summary; the Lab owns the details) ----------
  const DIMS = ['colour', 'warm', 'deep', 'smooth', 'soft', 'width', 'moving', 'rich', 'mod'];
  function profileParams() { const p = store.get('lab:prefs2', { n: 0, sum: {}, natures: {} }); if (!p.n) return null; const out = {}; DIMS.forEach(d => out[d] = (p.sum[d] || 0) / p.n); const nat = Object.entries(p.natures || {}).sort((x, y) => y[1] - x[1])[0]; out.nature = nat ? nat[0] : 'none'; return out; }
  function profileMix(opts = {}) { const pp = profileParams(); if (!pp) return null; const params = Object.assign({}, pp); delete params.nature; if (opts.sleep) Object.assign(params, { colour: Math.min(params.colour, 0.45), soft: Math.min(params.soft, -0.2), moving: 0, mod: 0 }); const mix = [{ id: 'sculpt', volume: opts.sleep ? 0.5 : 0.55, balance: 0, params }]; const nature = pp.nature === 'none' ? (opts.sleep ? 'rain' : null) : pp.nature; if (nature) mix.push({ id: nature, volume: opts.sleep ? 0.25 : 0.3, balance: 0 }); return mix; }
  function profileVisual() { const pp = profileParams(); const motion = store.get('motion', 'low'); const dark = root.dataset.theme === 'dark'; if (pp && pp.nature === 'rain') return 'rainwindow'; if (pp && pp.nature === 'ocean') return 'ocean'; if (pp && pp.nature === 'forest') return 'forest'; if (motion === 'still') return dark ? 'nightsky' : 'softlight'; return dark ? 'nightsky' : 'particles'; }
  function renderProfileHooks() {
    const pp = profileParams();
    const sleepRow = $('#sleep-profile-row'); if (sleepRow) sleepRow.hidden = !pp;
    const vs = $('#visual-profile-suggest'); if (vs) { if (pp) { const v = profileVisual(); const name = (window.softwaveFocus && softwaveFocus.allVisuals.find(x => x.id === v) || {}).name || v; vs.hidden = false; vs.innerHTML = `Based on your preferences, try <button class="linklike" data-pv="${v}">${name}</button>.`; $('[data-pv]', vs).addEventListener('click', () => { softwaveFocus.setVisual(v); toast(`Visual: ${name}`); }); } else vs.hidden = true; }
  }
  $('#sleep-from-profile').addEventListener('click', async () => { const mix = profileMix({ sleep: true }); if (!mix) return; if (engine.masterVolume > 0.5) setMaster(0.4); await engine.loadMix(mix); engine.setTimer(60, true); toast('Sleep session from your profile: 60-minute timer with gentle fade.'); });
  addEventListener('storage', renderProfileHooks); document.addEventListener('softwave:profile', renderProfileHooks);
  window.softwaveProfile = { params: profileParams, mix: profileMix, visual: profileVisual, refresh: renderProfileHooks };

  // ---------- sound cards ----------
  function renderSounds() {
    const host = $('#sound-groups'); host.innerHTML = '';
    const groups = [...new Set(engine.defs().map(d => d.group))];
    groups.forEach(g => {
      const h = document.createElement('h2'); h.className = 'group-title'; h.textContent = g; host.appendChild(h);
      if (g === 'Broadband') { const l = document.createElement('p'); l.className = 'group-learn muted small'; l.innerHTML = 'Not sure which to pick? <a href="learn/white-vs-pink-vs-brown-noise/">White vs pink vs brown noise for tinnitus →</a>'; host.appendChild(l); }
      if (g === 'Nature') { const l = document.createElement('p'); l.className = 'group-learn muted small'; l.innerHTML = '<a href="learn/nature-sounds-vs-noise-for-tinnitus/">Nature sounds vs noise — which should you use? →</a>'; host.appendChild(l); }
      const grid = document.createElement('div'); grid.className = 'sound-grid'; grid.setAttribute('role', 'list');
      engine.defs().filter(d => d.group === g).forEach(d => {
        const card = document.createElement('div'); card.className = 'sound-card'; card.style.setProperty('--hue', d.hue); card.dataset.id = d.id; card.setAttribute('role', 'listitem');
        card.innerHTML = `
          <div class="art"></div>
          <div class="waves"><span></span><span></span></div>
          <span class="state">Playing</span>
          <button class="card-btn" aria-pressed="false" aria-label="${d.name}: ${d.desc}"><span class="icon" aria-hidden="true">${d.icon}</span><span class="name">${d.name}</span><span class="desc">${d.desc}</span></button>
          <div class="vol"><label class="sr-only" for="vol-${d.id}">${d.name} volume</label><input id="vol-${d.id}" type="range" min="0" max="100" value="60"><output>60%</output></div>`;
        const btn = $('.card-btn', card);
        Object.assign(btn.style, { all: 'unset', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer', flex: '1', position: 'relative' });
        btn.addEventListener('click', async () => {
          const ok = await engine.toggleSound(d.id, (+$('input', card).value) / 100);
          if (ok === false) toast(`You can layer up to ${MAX_ACTIVE} sounds. Turn one off to add another.`);
        });
        const slider = $('input', card);
        slider.addEventListener('input', () => { engine.setVolume(d.id, +slider.value / 100); $('output', card).textContent = slider.value + '%'; });
        grid.appendChild(card);
      });
      host.appendChild(grid);
    });
  }
  function syncCards(list) {
    const ids = new Set(list.map(s => s.id));
    $$('#sound-groups .sound-card').forEach(c => {
      const on = ids.has(c.dataset.id); c.classList.toggle('active', on); $('.card-btn', c).setAttribute('aria-pressed', on);
      if (on) { const s = list.find(x => x.id === c.dataset.id); const r = $('input', c); r.value = Math.round(s.volume * 100); paintRange(r); $('output', c).textContent = r.value + '%'; }
    });
  }

  // ---------- mixer ----------
  function renderMixer(list) {
    const host = $('#mixer-channels'); host.innerHTML = '';
    $('#mixer-empty').hidden = list.length > 0;
    list.forEach(s => {
      const d = engine.def(s.id);
      const ch = document.createElement('div'); ch.className = 'channel'; ch.style.setProperty('--hue', d.hue);
      ch.innerHTML = `
        <div class="ch-head"><span class="ch-icon" aria-hidden="true">${d.icon}</span><span class="ch-name">${d.name}</span></div>
        <div class="ch-controls">
          <div class="control"><label for="chv-${s.id}">Volume <output>${Math.round(s.volume * 100)}%</output></label><input id="chv-${s.id}" type="range" min="0" max="100" value="${Math.round(s.volume * 100)}"></div>
          <div class="control"><label for="chp-${s.id}">Balance <output>${panLabel(s.balance)}</output></label><input id="chp-${s.id}" type="range" min="-100" max="100" value="${Math.round(s.balance * 100)}"></div>
        </div>
        <div class="ch-actions"><button class="btn btn-ghost btn-sm" aria-label="Remove ${d.name}">Off</button></div>`;
      const [v, p] = $$('input', ch);
      v.addEventListener('input', () => { engine.setVolume(s.id, +v.value / 100); $('output', v.parentElement).textContent = v.value + '%'; syncCards(engine.activeList()); });
      p.addEventListener('input', () => { engine.setBalance(s.id, +p.value / 100); $('output', p.parentElement).textContent = panLabel(+p.value / 100); });
      p.addEventListener('dblclick', () => { p.value = 0; p.dispatchEvent(new Event('input')); });
      $('button', ch).addEventListener('click', () => engine.stopSound(s.id));
      host.appendChild(ch); $$('input', ch).forEach(paintRange);
    });
    const add = $('#mix-add-list'); add.innerHTML = '';
    const full = list.length >= MAX_ACTIVE; $('#mix-add-title').textContent = full ? `Up to ${MAX_ACTIVE} sounds — turn one off to add another` : 'Add a sound';
    engine.defs().filter(d => !engine.isActive(d.id)).forEach(d => { const b = document.createElement('button'); b.className = 'pane-sound add-pill'; b.style.setProperty('--hue', d.hue); b.disabled = full; b.innerHTML = `<span class="ico" aria-hidden="true">${d.icon}</span>${d.name}`; b.setAttribute('aria-label', 'Add ' + d.name); b.addEventListener('click', async () => { b.disabled = true; b.classList.add('adding'); await engine.startSound(d.id, 0.5); }); add.appendChild(b); });
  }
  function panLabel(b) { if (Math.abs(b) < 0.05) return 'Centre'; return (b < 0 ? 'L ' : 'R ') + Math.round(Math.abs(b) * 100) + '%'; }
  $('#mix-play').addEventListener('click', () => togglePlay());
  $('#mix-stop').addEventListener('click', () => { engine.stopAll(); toast('All sounds stopped'); });
  $('#mix-reset').addEventListener('click', () => { engine.activeList().forEach(s => { engine.setVolume(s.id, 0.5); engine.setBalance(s.id, 0); }); setMaster(0.35); renderMixer(engine.activeList()); syncCards(engine.activeList()); toast('Levels reset'); });
  $('#mix-save').addEventListener('click', () => {
    const list = engine.activeList(); if (!list.length) return toast('Add some sounds first');
    let form = $('#mix-name-form');
    if (form) { form.remove(); return; }
    form = document.createElement('form'); form.id = 'mix-name-form'; form.className = 'add-row'; form.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap';
    form.innerHTML = '<label class="sr-only" for="mix-name">Mix name</label><input id="mix-name" class="select" maxlength="40" value="My Custom Mix" style="min-width:220px"><button type="submit" class="btn btn-primary btn-sm">Save</button><button type="button" class="btn btn-ghost btn-sm" data-cancel>Cancel</button>';
    $('.mixer-toolbar').after(form); const inp = $('#mix-name', form); inp.focus(); inp.select();
    $('[data-cancel]', form).addEventListener('click', () => form.remove());
    form.addEventListener('submit', e => {
      e.preventDefault(); const name = inp.value.trim() || 'My Custom Mix';
      const mixes = store.get('mixes', []); mixes.push({ name, mix: engine.activeList().map(s => ({ id: s.id, volume: s.volume, balance: s.balance })), master: engine.masterVolume });
      store.set('mixes', mixes); renderPresets(); form.remove(); toast(`Saved “${name}” on this device`);
    });
  });

  // ---------- player bar ----------
  const masterEl = $('#master-vol');
  function setMaster(v, fromSlider) {
    engine.setMasterVolume(v);
    if (!fromSlider) { masterEl.value = Math.round(v * 100); paintRange(masterEl); }
    $('#master-out').textContent = Math.round(v * 100) + '%';
    $('.player-vol').classList.toggle('warn', v > 0.75);
    store.set('master', v);
  }
  let warned = false;
  masterEl.addEventListener('input', () => {
    const v = +masterEl.value / 100; setMaster(v, true);
    if (v > 0.75 && !warned) { warned = true; toast('High level. The lowest comfortable level that still helps is usually best — louder is not better masking.', 4000); }
    if (v <= 0.75) warned = false;
  });
  setMaster(clamp(store.get('master', 0.35), 0, 0.6)); // never restore above a moderate level
  async function togglePlay() {
    if (!engine.ctx) { if (!engine.activeList().length) return toast('Choose a sound to begin'); }
    if (engine.ctx && engine.ctx.state === 'running' && engine.isPlaying) await engine.pauseAll();
    else if (engine.isPlaying || (engine.ctx && engine.ctx.state === 'suspended' && engine.active.size)) await engine.playAll();
    else toast('Choose a sound to begin');
  }
  $('#player-toggle').addEventListener('click', togglePlay);
  $('#player-stop').addEventListener('click', () => engine.stopAll());
  function updatePlayer() {
    const list = engine.activeList();
    const playing = engine.isPlaying;
    const names = list.map(s => engine.def(s.id).name);
    if (engine.tone && engine.tone.playing) names.push(`Tone ${fmt(engine.tone.freq)} Hz`);
    $('#player-title').textContent = names.length ? names.join(' + ') : 'Nothing playing';
    $('#player-sub').textContent = names.length ? (playing ? 'Playing · keep it low and comfortable' : 'Paused') : 'Choose a sound to begin';
    const t = $('#player-toggle'); t.setAttribute('aria-pressed', playing); t.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    $('#mix-play').textContent = playing ? 'Pause' : 'Play';
    $('#sleep-now-list').textContent = names.length ? names.join(' + ') : 'Nothing yet — pick a preset below or choose sounds.';
    $('#sleep-sounds').textContent = names.join(' · ');
    const fs = $('#focus-setup-sound'); if (fs) fs.textContent = names.length ? names.join(' + ') : 'No sound yet';
    if (!$('#view-lab').hidden) bg.setMode('lab'); else bg.setMode(engine.isActive('rain') ? 'rain' : 'calm');
    document.title = names.length ? `${names[0]}${names.length > 1 ? ' +' + (names.length - 1) : ''} — Softwave` : 'Softwave — Free Tinnitus Sound Generator & Masking Sounds';
  }
  let lastIds = new Set();
  engine.on((type, data) => {
    if (type === 'sounds') { syncCards(data); renderMixer(data); updatePlayer(); const now = new Set(data.map(s => s.id)); const pc = store.get('playcounts', {}); now.forEach(id => { if (!lastIds.has(id)) pc[id] = (pc[id] || 0) + 1; }); store.set('playcounts', pc); lastIds = now; }
    if (type === 'state' || type === 'tone') updatePlayer();
    if (type === 'timer') renderTimer(data);
    if (type === 'timerDone') { toast('Sleep timer finished. Rest well.'); }
    if (type === 'limit') toast(`You can layer up to ${data} sounds at once.`);
  });

  // ---------- frequency generator ----------
  const F = { freq: 4000, type: 'sine', volume: 0.25, balance: 0 };
  const fSlider = $('#freq-slider'), fInput = $('#freq-input');
  function setFreq(hz, from) {
    F.freq = clamp(Math.round(hz), MINF, MAXF);
    $('#freq-value').textContent = fmt(F.freq);
    if (from !== 'slider') { fSlider.value = hzToSlider(F.freq); paintRange(fSlider); }
    fSlider.setAttribute('aria-valuetext', F.freq + ' hertz');
    if (from !== 'input') fInput.value = F.freq;
    if (engine.tone) engine.toneUpdate({ freq: F.freq });
  }
  fSlider.addEventListener('input', () => setFreq(sliderToHz(+fSlider.value), 'slider'));
  fInput.addEventListener('change', () => setFreq(+fInput.value || 1000, 'input'));
  fInput.addEventListener('keydown', e => { if (e.key === 'Enter') fInput.blur(); });
  $$('.fine-row [data-step]').forEach(b => b.addEventListener('click', () => setFreq(F.freq + +b.dataset.step)));
  $('#freq-type').addEventListener('change', e => { F.type = e.target.value; if (engine.tone) engine.toneUpdate({ type: F.type }); });
  $('#freq-vol').addEventListener('input', e => { F.volume = +e.target.value / 100; $('#freq-vol-out').textContent = e.target.value + '%'; if (engine.tone) engine.toneUpdate({ volume: F.volume }); });
  $('#freq-pan').addEventListener('input', e => { F.balance = +e.target.value / 100; $('#freq-pan-out').textContent = panLabel(F.balance); if (engine.tone) engine.toneUpdate({ balance: F.balance }); });
  $('#freq-play').addEventListener('click', async () => {
    if (engine.tone && engine.tone.playing) engine.toneStop();
    else { matchStop(); await engine.toneStart(F); await engine.playAll(); }
  });
  engine.on(type => { if (type === 'tone') { const on = !!(engine.tone && engine.tone.playing && toneOwner === 'freq'); const b = $('#freq-play'); b.textContent = on ? 'Stop tone' : 'Play tone'; b.setAttribute('aria-pressed', on); } });
  let toneOwner = 'freq';
  const origToneStart = engine.toneStart.bind(engine);
  engine.toneStart = (o) => { toneOwner = o === M ? 'match' : 'freq'; return origToneStart(o); };
  new ToneViz($('#freq-viz'), engine, () => F.freq);
  setFreq(4000);

  // ---------- find my sound ----------
  const M = { freq: 4000, type: 'sine', volume: 0.15, balance: 0 };
  const mSlider = $('#match-slider');
  let mStep = 1;
  function mShow(n) {
    mStep = n; $$('.match-step').forEach(s => s.hidden = +s.dataset.step !== n);
    if (n !== 3 && engine.tone && toneOwner === 'match') matchStop();
    if (n === 4) renderSuggestions();
    $('#view-match .card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function matchStop() { if (engine.tone && toneOwner === 'match') engine.toneStop(); }
  $$('#view-match [data-next]').forEach(b => b.addEventListener('click', () => mShow(mStep + 1)));
  $$('#view-match [data-prev]').forEach(b => b.addEventListener('click', () => mShow(mStep - 1)));
  $$('#view-match [data-ear]').forEach(b => b.addEventListener('click', () => { $$('#view-match [data-ear]').forEach(x => x.setAttribute('aria-checked', x === b)); M.balance = +b.dataset.ear; if (engine.tone) engine.toneUpdate({ balance: M.balance }); }));
  $$('#view-match [data-type]').forEach(b => b.addEventListener('click', () => { $$('#view-match [data-type]').forEach(x => x.setAttribute('aria-checked', x === b)); M.type = b.dataset.type; if (engine.tone) engine.toneUpdate({ type: M.type }); }));
  function setMFreq(hz, fromSlider) {
    M.freq = clamp(Math.round(hz), MINF, MAXF); $('#match-freq-value').textContent = fmt(M.freq);
    if (!fromSlider) { mSlider.value = hzToSlider(M.freq); paintRange(mSlider); }
    mSlider.setAttribute('aria-valuetext', M.freq + ' hertz');
    if (engine.tone && toneOwner === 'match') engine.toneUpdate({ freq: M.freq });
  }
  mSlider.addEventListener('input', () => setMFreq(sliderToHz(+mSlider.value), true));
  $$('[data-mstep]').forEach(b => b.addEventListener('click', () => setMFreq(M.freq * Math.pow(2, +b.dataset.mstep / 1200))));
  $('#match-vol').addEventListener('input', e => { M.volume = +e.target.value / 100; $('#match-vol-out').textContent = e.target.value + '%'; if (engine.tone) engine.toneUpdate({ volume: M.volume }); });
  $('#match-play').addEventListener('click', async () => {
    if (engine.tone && toneOwner === 'match') engine.toneStop();
    else { if (engine.tone) engine.toneStop(); await engine.toneStart(M); await engine.playAll(); }
  });
  engine.on(type => { if (type === 'tone') { const on = !!(engine.tone && engine.tone.playing && toneOwner === 'match'); const b = $('#match-play'); b.textContent = on ? 'Stop tone' : 'Play tone'; b.setAttribute('aria-pressed', on); } });
  new ToneViz($('#match-viz'), engine, () => M.freq);
  setMFreq(4000);

  function suggestionsFor(hz, type) {
    // Broad, low-commitment guidance: sounds with energy in the same region tend
    // to blend with a tone; softer/lower options for people who find hiss tiring.
    const s = [];
    if (hz >= 6000) s.push('white', 'hiss', 'rain', 'waterfall', 'static');
    else if (hz >= 2500) s.push('pink', 'rain', 'stream', 'fan', 'white');
    else if (hz >= 800) s.push('pink', 'fan', 'stream', 'forest', 'ocean');
    else s.push('brown', 'ocean', 'wind', 'fire', 'fan');
    if (type === 'hiss' && !s.includes('hiss')) s.splice(1, 0, 'hiss');
    return s.slice(0, 5);
  }
  function renderSuggestions() {
    const earTxt = M.balance < 0 ? 'left ear' : M.balance > 0 ? 'right ear' : 'both ears';
    const typeTxt = { sine: 'ringing', narrow: 'whistling', hiss: 'hissing', soft: 'humming' }[M.type];
    $('#match-summary').textContent = `You chose a ${typeTxt} sound around ${fmt(M.freq)} Hz in your ${earTxt}. Here are sounds worth trying first. Tap to play, then adjust the level until the tinnitus feels less noticeable.`;
    const host = $('#match-suggestions'); host.innerHTML = '';
    suggestionsFor(M.freq, M.type).forEach((id, i) => {
      const d = engine.def(id); const card = document.createElement('button'); card.className = 'sound-card'; card.style.setProperty('--hue', d.hue);
      card.innerHTML = `<div class="art"></div><span class="icon" aria-hidden="true">${d.icon}</span><span class="name">${d.name}</span><span class="desc">${i === 0 ? 'Start here · ' : ''}${d.desc}</span>`;
      card.addEventListener('click', async () => { matchStop(); await engine.loadMix([{ id, volume: 0.5 }]); toast(`Playing ${d.name}. Try others too — comfort is what matters.`); });
      host.appendChild(card);
    });
    const saved = store.get('match'); $('#match-clear').hidden = !saved;
    const oct = $('#match-octave'); oct.innerHTML = ''; const centre = M.freq;
    [[0.5, 'Hear an octave lower'], [1, 'Hear my tone'], [2, 'Hear an octave higher']].forEach(([k, label]) => { const b = document.createElement('button'); b.className = 'btn btn-ghost btn-sm'; b.textContent = `${label} (${fmt(centre * k)} Hz)`; b.addEventListener('click', async () => { if (!(engine.tone && toneOwner === 'match')) { await engine.toneStart(Object.assign({}, M, { freq: centre * k })); await engine.playAll(); } else engine.toneUpdate({ freq: centre * k }); }); oct.appendChild(b); });
    [[0.5, 'Lower is closer'], [2, 'Higher is closer']].forEach(([k, label]) => { const b = document.createElement('button'); b.className = 'btn btn-secondary btn-sm'; b.textContent = label; b.addEventListener('click', () => { setMFreq(centre * k); matchStop(); renderSuggestions(); toast(`Updated to about ${fmt(M.freq)} Hz`); }); oct.appendChild(b); });
  }
  $('#match-save').addEventListener('click', () => { store.set('match', { freq: M.freq, type: M.type, balance: M.balance, when: new Date().toISOString() }); $('#match-clear').hidden = false; toast('Saved on this device only. Nothing is sent anywhere.'); });
  $('#match-clear').addEventListener('click', () => { store.del('match'); $('#match-clear').hidden = true; toast('Saved result removed'); });
  (function restoreMatch() { const m = store.get('match'); if (!m) return; M.freq = m.freq; M.type = m.type; M.balance = m.balance; setMFreq(m.freq); $$('#view-match [data-type]').forEach(x => x.setAttribute('aria-checked', x.dataset.type === m.type)); $$('#view-match [data-ear]').forEach(x => x.setAttribute('aria-checked', +x.dataset.ear === m.balance)); })();

  // ---------- sleep ----------
  const sleep = { minutes: 0, fade: true };
  $$('.timer-seg [data-min]').forEach(b => b.addEventListener('click', () => { $$('.timer-seg [data-min]').forEach(x => x.setAttribute('aria-checked', x === b)); sleep.minutes = +b.dataset.min; engine.setTimer(sleep.minutes, sleep.fade); if (sleep.minutes) toast(`Timer set: ${sleep.minutes} minutes${sleep.fade ? ' with gentle fade-out' : ''}`); }));
  $('#sleep-fade').addEventListener('change', e => { sleep.fade = e.target.checked; if (engine.timer.endsAt) engine.timer.fade = sleep.fade; });
  const screen = $('#sleep-screen');
  $('#sleep-enter').addEventListener('click', async () => {
    if (!engine.activeList().length) await loadPreset(PRESETS[1]);
    else await engine.playAll();
    screen.hidden = false; document.body.style.overflow = 'hidden'; $('#sleep-toggle').focus();
    try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (_) { }
  });
  let wake = null;
  function exitSleep() { screen.hidden = true; document.body.style.overflow = ''; if (wake) { wake.release().catch(() => { }); wake = null; } }
  $('#sleep-exit').addEventListener('click', exitSleep);
  screen.addEventListener('keydown', e => { if (e.key === 'Escape') exitSleep(); });
  $('#sleep-toggle').addEventListener('click', togglePlay);
  $('#sleep-vol-down').addEventListener('click', () => setMaster(clamp(engine.masterVolume - 0.05, 0, 1)));
  $('#sleep-vol-up').addEventListener('click', () => setMaster(clamp(engine.masterVolume + 0.05, 0, 1)));
  function clockTick() { const d = new Date(); $('#sleep-clock').textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  setInterval(clockTick, 1000); clockTick();
  engine.on(type => { if (type === 'state') $('#sleep-toggle').textContent = engine.isPlaying ? '❚❚' : '▶'; });
  function renderTimer(t) {
    const el = $('#player-timer'), rem = $('#sleep-remaining');
    if (!t.endsAt) { el.hidden = true; rem.textContent = 'Continuous'; if (!t.durationMin) $$('.timer-seg [data-min]').forEach(x => x.setAttribute('aria-checked', x.dataset.min === '0')); return; }
    const left = Math.max(0, t.endsAt - Date.now()); const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    const txt = `${m}:${String(s).padStart(2, '0')}`;
    el.hidden = false; el.textContent = (t.fading ? 'Fading · ' : '⏾ ') + txt; rem.textContent = (t.fading ? 'Fading out · ' : 'Sound stops in ') + txt;
  }

  // ---------- welcome ----------
  const welcome = $('#welcome');
  if (new URLSearchParams(location.search).has('welcomed')) store.set('welcomed', true);
  if (!store.get('welcomed')) { welcome.hidden = false; $('#start-listening').focus(); }
  $('#start-listening').addEventListener('click', async () => {
    store.set('welcomed', true); welcome.hidden = true;
    await engine.init(); // unlock audio on the user gesture (important for iOS)
    showView('sounds');
  });

  // Pre-warm the audio engine on the first touch so the first sound starts without a stall.
  const warm = () => { engine.prepare(); document.removeEventListener('pointerdown', warm); document.removeEventListener('keydown', warm); };
  document.addEventListener('pointerdown', warm, { passive: true }); document.addEventListener('keydown', warm);

  // ---------- sound environment, orb player and Now Playing ----------
  const SV = window.SoftwaveVisuals;
  function dominant() { const l = engine.activeList(); if (!l.length) return null; return l.slice().sort((x, y) => y.volume - x.volume)[0].id; }
  function dominantParams() { const l = engine.activeList(); if (!l.length) return SV.paramsFor('pink'); const top = l.slice().sort((x, y) => y.volume - x.volume); const base = SV.paramsFor(top[0].id, top[0].id === 'sculpt' || top[0].id.startsWith('disco') ? engine.getSculpt(top[0].id) : null); if (top[1]) { const p2 = SV.paramsFor(top[1].id); base.nature = base.nature !== 'none' ? base.nature : p2.nature; base.rich = Math.min(1, base.rich + 0.25); } return base; }
  function describeSound(p) { const b = []; b.push(p.colour < 0.33 ? 'Deep' : p.colour < 0.67 ? 'Balanced' : 'Bright'); if (p.warm < -0.25) b.push('Warm'); if (p.warm > 0.25) b.push('Airy'); if (p.moving > 0.3 || p.mod > 0.3) b.push('Moving'); else b.push('Steady'); if (p.nature !== 'none') b.push(engine.def(p.nature) ? engine.def(p.nature).name : p.nature); return b.join(' · '); }
  const orbs = [['#player-orb', 0.44], ['#now-canvas', 0.4]]; let orbT = 0, orbLast = 0; const orbSpec = new Uint8Array(512);
  function orbLoop(now) { requestAnimationFrame(orbLoop); if (document.hidden || now - orbLast < 33) return; const dt = Math.min(0.05, (now - orbLast) / 1000); orbLast = now; orbT += dt * (engine.isPlaying ? 1 : 0.35); const lv = engine.isPlaying ? Math.min(1, engine.getLevels(orbSpec) * 6) : 0; const p = dominantParams();
    for (const [sel, scale] of orbs) { const c = $(sel); if (!c || c.offsetParent === null) continue; const r = c.getBoundingClientRect(); if (!r.width) continue; const dpr = Math.min(devicePixelRatio || 1, 2); if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); } const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height); SV.soundShape(ctx, r.width, r.height, p, orbT, lv, { scale, glow: sel === '#now-canvas' }); } }
  requestAnimationFrame(orbLoop);
  function syncEnvironment() { const id = dominant(); bg.setEnv(id); document.body.dataset.sound = id || ''; const p = dominantParams(); const names = engine.activeList().map(s => engine.def(s.id).name); $('#now-name').textContent = names.length ? names.join(' + ') : 'Nothing playing'; $('#now-desc').textContent = names.length ? describeSound(p) : 'Choose a sound to begin'; const on = engine.isPlaying; $('#now-orb').setAttribute('aria-pressed', on); $('#now-orb').setAttribute('aria-label', on ? 'Pause' : 'Play'); }
  engine.on(type => { if (['sounds', 'state', 'tone', 'master'].includes(type)) syncEnvironment(); if (type === 'master') { const v = $('#now-vol'); v.value = Math.round(engine.masterVolume * 100); paintRange(v); $('#now-vol-out').textContent = v.value + '%'; } });
  function openNow() { $('#now').hidden = false; syncEnvironment(); $('#now-orb').focus(); }
  function closeNow() { $('#now').hidden = true; }
  $('#player-title').addEventListener('click', () => { if (engine.activeList().length) openNow(); });
  $('#player-title').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (engine.activeList().length) openNow(); } });
  $('#now-close').addEventListener('click', closeNow);
  $('#now').addEventListener('keydown', e => { if (e.key === 'Escape') closeNow(); });
  $('#now-orb').addEventListener('click', async e => { const b = e.currentTarget; b.classList.add('pressed'); setTimeout(() => b.classList.remove('pressed'), 400); await togglePlay(); syncEnvironment(); });
  $('#player-toggle').addEventListener('click', e => { const b = e.currentTarget; b.classList.add('pressed'); setTimeout(() => b.classList.remove('pressed'), 400); });
  $('#now-vol').addEventListener('input', e => setMaster(+e.target.value / 100, true));
  $$('[data-now]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.now; closeNow(); if (k === 'timer') showView('sleep'); if (k === 'visual') { showView('focus'); } if (k === 'mixer') showView('mixer'); if (k === 'save') { showView('mixer'); setTimeout(() => { const s = $('#mix-save'); s.classList.add('saved-pop'); s.click(); s.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 200); } }));
  document.addEventListener('click', e => { if (e.target.closest('#fav-save, #mix-save, [data-save], [data-save-session], [data-r="save"]')) { const b = e.target.closest('button'); b.classList.add('saved-pop'); setTimeout(() => b.classList.remove('saved-pop'), 520); } }, true);

  // ---------- keyboard shortcuts ----------
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    if (e.key === 'Escape' && !screen.hidden) exitSleep();
  });

  // ---------- audio interruptions (calls, Safari backgrounding) ----------
  document.addEventListener('visibilitychange', () => { if (!document.hidden && engine.ctx && engine.active.size && engine.ctx.state === 'interrupted') engine.resume(); });
  document.addEventListener('touchend', () => { if (engine.ctx && engine.ctx.state === 'interrupted') engine.resume(); }, { passive: true });

  // ---------- PWA ----------
  let deferredPrompt = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $('#install-btn').hidden = false; });
  $('#install-btn').addEventListener('click', async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('#install-btn').hidden = true; });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));

  window.softwaveApp = { loadPreset, setMaster, togglePlay, toast, store, PRESETS, paintRange, showView, renderPresets };

  // ---------- init ----------
  renderSounds(); renderPresets(); renderMixer([]); updatePlayer(); renderProfileHooks();
  showView((location.hash || '#sounds').slice(1));
  // Deep links from the static pages: ?sound=<id> highlights a sound; ?preset=<id> highlights a preset.
  (function deepLinks() {
    const q = new URLSearchParams(location.search); const sid = q.get('sound'), pid = q.get('preset');
    if (q.get('exp')) { store.set('welcomed', true); welcome.hidden = true; showView('lab'); }
    if (q.get('now')) { store.set('welcomed', true); welcome.hidden = true; openNow(); loadPreset(PRESETS.find(p => p.id === q.get('now')) || PRESETS[0]); }
    if (sid && engine.def(sid) && !engine.def(sid).lab) { store.set('welcomed', true); welcome.hidden = true; showView('sounds'); const card = $(`.sound-card[data-id="${sid}"]`); if (card) { card.classList.add('highlight'); setTimeout(() => { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('.card-btn', card).focus(); toast(`Tap ${engine.def(sid).name} to play it — it starts quietly.`, 4000); }, 250); } }
    if (pid) { const p = PRESETS.find(x => x.id === pid); if (p) { store.set('welcomed', true); welcome.hidden = true; showView('sounds'); setTimeout(() => { const chip = $(`#presets [data-preset="${pid}"]`); if (chip) { chip.classList.add('active'); chip.focus(); toast(`Tap “${p.name}” to start the preset.`, 4000); } }, 250); } }
  })();
})();
