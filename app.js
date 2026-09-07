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
    // Corrupted storage must never break a renderer: a value that parses but has the wrong
    // SHAPE (a number where an array lived) falls back to the default just like invalid JSON.
    get(k, d) {
      try {
        const v = localStorage.getItem('softwave:' + k); if (v === null) return d;
        const p = JSON.parse(v);
        if (d !== undefined && d !== null) {
          if (p === null) return d;
          if (Array.isArray(d) !== Array.isArray(p)) return d;
          if (typeof p !== typeof d) return d;
        }
        return p;
      } catch (_) { return d; }
    },
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
  applyTheme(qTheme || store.get('theme', 'dark'));   // dark by default; the toggle (or ?theme=) overrides and is remembered
  $('#theme-toggle').addEventListener('click', () => applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));

  // ---------- views ----------
  const views = ['sounds', 'focus', 'lab', 'mixer', 'frequency', 'match', 'sleep', 'learn'];
  // The app owns all scroll positions (every navigation re-scrolls deliberately);
  // the browser's async restoration on Back would fight and override those scrolls.
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (_) { }
  // Layered surfaces (sheets, Immerse, sleep screen) each own one same-URL history
  // entry, so every kind of Back — the ← button, browser Back, and the iPhone edge
  // swipe — peels the topmost layer instead of navigating the page underneath.
  const layers = { stack: [], stale: 0, reconcile: 0, reconcileAt: 0 };
  window.softwaveLayers = layers;   // diagnostics
  // navDepth counts undoable in-app steps (pushes). Tab switches keep it at 0, so
  // Back stops — and hides — at every section's main page: Back undoes the user's
  // own steps inside a journey but never dumps them into another section.
  let navDepth = 0;
  function layerPush(closeFn) { layers.stack.push(closeFn); try { history.pushState({ swLayer: layers.stack.length, d: navDepth }, '', location.href); } catch (_) { } updateBackBtn(); }
  // Closing a layer is immediate and visible; the history entry it owns is reconciled
  // afterwards (Back stays consistent). If the browser never reports that step — seen
  // on iOS right after a form submit — the next Back swallows the stale entry instead.
  function layersClose() {
    if (!layers.stack.length) return;
    const fn = layers.stack.pop(); try { fn(); } catch (_) { }
    layers.reconcile = (layers.reconcile || 0) + 1; layers.reconcileAt = Date.now();
    try { history.back(); } catch (_) { }
    updateBackBtn();
  }
  // Tabs are for switching sections and never create a Back step; only push:false
  // (history/boot navigations) shares the replace path.
  function tabReplace(opts) { return opts.push === false || !!opts.tab; }
  function writeState(mode, hash) { if (mode === 'replace') history.replaceState({ d: navDepth }, '', hash); else { navDepth++; history.pushState({ d: navDepth }, '', hash); } }
  function showView(name, opts = {}) {
    // Any real navigation collapses open layers first (their history entries become
    // stale; the popstate handler swallows those silently on a later Back).
    if (layers.stack.length) { while (layers.stack.length) { try { layers.stack.pop()(); } catch (_) { } layers.stale++; } }
    // #find = the Find My Sound feature (lives in the Lab): show the Lab and open it directly
    if (name === 'find') { const wanted = tabReplace(opts) ? 'replace' : 'push'; showView('lab', { push: false, keepHash: true }); if (location.hash !== '#find') writeState(wanted, '#find'); $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.view === 'find')); ensureLab().then(() => { if (window.softwaveLab) softwaveLab.open('discovery'); }).catch(() => { }); updateBackBtn(); return; }
    if (!views.includes(name)) name = 'sounds';
    if (name === 'lab') {
      ensureLab();
      // Every arrival shows the list unless a protected state holds it (running, or —
      // for history/Back arrivals only — the completed Find My Sound result).
      if (window.softwaveLab && softwaveLab.showList) softwaveLab.showList(opts.push !== false);
    }
    views.forEach(v => { const el = $('#view-' + v); el.hidden = v !== name; el.classList.toggle('active', v === name); });
    $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.view === name));
    if (!opts.keepHash && location.hash !== '#' + name) writeState(tabReplace(opts) ? 'replace' : 'push', '#' + name);
    updateBackBtn();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    bg.setMode(name === 'lab' ? 'lab' : engine.isActive('rain') ? 'rain' : 'calm');
  }
  document.addEventListener('click', e => {
    const sc = e.target.closest('[data-scroll]'); if (sc) { e.preventDefault(); const tgt = $(sc.getAttribute('href')); tgt && tgt.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const a = e.target.closest('[data-view]'); if (!a) return;
    // only the top nav bar counts as tab-hopping; in-page links (Choose sounds,
    // My Custom Mix…) are forward steps and keep their history entry
    e.preventDefault(); showView(a.dataset.view, { tab: !!a.closest('.nav') });
  });
  addEventListener('hashchange', () => showView(location.hash.slice(1), { push: false }));
  addEventListener('popstate', e => {
    // the landed-on entry knows its depth; layer entries carry the depth beneath them
    const st = e.state; navDepth = st && typeof st.d === 'number' ? st.d : 0;
    // Our own reconcile step (a layer we already closed) arrives first — it must be
    // swallowed BEFORE the stack check, or a nested layer beneath it gets popped too.
    if (layers.reconcile > 0 && Date.now() - (layers.reconcileAt || 0) < 1500) { layers.reconcile--; updateBackBtn(); return; }
    // Back peels the topmost open layer (sheet/overlay) before any view navigation.
    if (layers.stack.length) { const fn = layers.stack.pop(); try { fn(); } catch (_) { } updateBackBtn(); return; }
    // a late reconcile means the user pressed Back onto a stale entry — skip past it
    if (layers.reconcile > 0) { layers.reconcile--; history.back(); return; }
    // A layer entry whose surface was already closed elsewhere: swallow it and keep going.
    if (layers.stale > 0) { layers.stale--; history.back(); return; }
    showView((location.hash || '#sounds').slice(1), { push: false });
  });
  // The ← button shows only when Back has a real step to undo: an open layer or
  // overlay, an in-section experiment step, or a pushed navigation (navDepth).
  // At a section's main page it hides — Back never crosses into another section.
  function updateBackBtn() {
    const b = $('#nav-back'); if (!b) return;
    const overlay = ['#now', '#sleep-screen', '#focus-screen', '#eyes-screen'].some(s => { const el = $(s); return el && !el.hidden; });
    const d = $('#lab-detail'), lv = $('#view-lab');
    const labStep = !!(d && !d.hidden && lv && !lv.hidden && (location.hash !== '#find' || d.querySelector('[data-back-result]') || (window.softwaveLab && softwaveLab.isRunning())));
    b.hidden = !(layers.stack.length || overlay || labStep || navDepth > 0);
  }
  // panel open/close and fine-tune states change outside showView — refresh shortly
  // after any tap (180ms clears the fine-tune button's own 100ms injection delay)
  document.addEventListener('click', () => setTimeout(updateBackBtn, 180));
  try { history.replaceState({ d: 0 }, '', location.href); } catch (_) { }

  // Lazy-load The Lab (experiments) only when needed, so the homepage stays light.
  let labPromise = null;
  function ensureLab() {
    if (window.softwaveLab) return Promise.resolve();
    if (labPromise) return labPromise;
    labPromise = new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = 'lab.js?v=70'; s.defer = true; s.onload = () => resolve(); s.onerror = () => { labPromise = null; reject(new Error('Could not load experiments')); }; document.body.appendChild(s); });
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
    { id: 'window', name: 'Rain on Window', desc: 'Close rain + deep bed', mix: [{ id: 'glassrain', volume: 0.55 }, { id: 'brown', volume: 0.22 }], master: 0.3 },
    { id: 'summernight', name: 'Summer Night', desc: 'Warm night air + soft crickets', mix: [{ id: 'summernight', volume: 0.6 }], master: 0.32 },
  ];
  const presetsSlot = () => $('#presets-slot');
  function mountPresets() {
    // real conditional rendering: the section exists in the DOM only when it has content
    let row = $('.presets-row');
    if (!row) { const tpl = $('#presets-template'); if (!tpl) return null; presetsSlot().appendChild(tpl.content.cloneNode(true)); row = $('.presets-row'); }
    return row;
  }
  // One-tap presets carry the user onward: a few seconds after a preset starts,
  // open the matching full-screen player (Immerse from Sounds, the Sleep Screen
  // from Sleep) — but only if the sound is still playing, they are still on that
  // page, and no full-screen view opened meanwhile. A new tap restarts the wait.
  // The wait counts QUIET time: any tap or scroll restarts it, so browsing and
  // layering sounds is never interrupted — the transition comes once hands are still.
  let autoAdvT = null, lastActivity = 0;
  const noteActivity = () => { lastActivity = Date.now(); };
  document.addEventListener('pointerdown', noteActivity, { passive: true, capture: true });
  addEventListener('scroll', noteActivity, { passive: true });
  addEventListener('wheel', noteActivity, { passive: true });
  function scheduleAutoAdvance(kind, ms) {
    clearTimeout(autoAdvT);
    const wait = ms || 5000, armed = Date.now(); const armedView = (document.querySelector('.view:not([hidden])') || {}).id;
    // the full wait since the sound started, extended by any later interaction
    const quietFor = () => Date.now() - Math.max(lastActivity, armed);
    const attempt = (retries) => {
      autoAdvT = setTimeout(() => {
        if (quietFor() < wait - 150) { attempt(retries); return; }   // still interacting — wait out the remainder
        if (!engine.isPlaying) {
          // iOS can report a non-running audio context for a moment even while
          // sounds are queued — retry briefly instead of silently giving up
          if (engine.activeList().length > 0 && retries > 0) attempt(retries - 1);
          return;
        }
        // an open Add-sound/Timer sheet means they're still choosing — check again later
        if ([...document.querySelectorAll('.addsound-sheet')].some(s => !s.hidden)) { scheduleAutoAdvance(kind, ms); return; }
        const fsOpen = !$('#now').hidden || !$('#focus-screen').hidden || !$('#sleep-screen').hidden;
        if (kind === 'immerse' && (document.querySelector('.view:not([hidden])') || {}).id === armedView && !fsOpen) openNow();
        if (kind === 'sleep' && !$('#view-sleep').hidden && $('#sleep-screen').hidden && $('#now').hidden && $('#focus-screen').hidden) $('#sleep-enter').click();
        if (kind === 'focus' && !$('#view-sounds').hidden && !fsOpen && window.softwaveFocus) softwaveFocus.enterFocus();
      }, retries === 3 ? Math.max(300, wait - quietFor()) : 1500);
    };
    attempt(3);
  }
  function renderPresets() {
    const make = (container, includeCustom) => {
      container.innerHTML = '';
      const list = [...PRESETS];
      const custom = store.get('mixes', []).filter(m => m && Array.isArray(m.mix) && m.mix.every(x => engine.def(x.id)));
      list.forEach(p => {
        const b = document.createElement('button'); b.className = 'chip'; b.setAttribute('role', 'listitem'); b.dataset.preset = p.id; b.dataset.chipName = p.name;
        b.innerHTML = `<strong>${p.name}</strong><span>${p.desc}</span>`;
        b.addEventListener('click', () => { loadPreset(p); scheduleAutoAdvance(container.id === 'sleep-presets' ? 'sleep' : 'immerse'); });
        container.appendChild(b);
      });
    };
    const anyPresets = PRESETS.length > 0 || store.get('mixes', []).length > 0;
    const ms = store.get('lab:sounds', []).filter(x => x && x.name);
    const prow = mountPresets();
    if (prow && !anyPresets && !ms.length) { prow.remove(); try { make($('#sleep-presets'), false); } catch (e) { console.error(e); } updateMixSaved(); return; }
    try { make($('#presets'), false); } catch (e) { console.error(e); } try { make($('#sleep-presets'), false); } catch (e) { console.error(e); }
    // My Saved Mixes: the user's own combinations — kept apart from the built-in presets
    const mixes = savedMixesOnly();
    const mrow = $('#my-mixes-row'), mhost = $('#my-mixes');
    if (!mhost && mixes.length) { renderPresetsRemount(); return; }
    if (mhost) {
      mhost.innerHTML = '';
      if (!mixes.length) { if (mrow) mrow.remove(); }
      else mixes.forEach(m => {
        const b = document.createElement('button'); b.className = 'chip chip-mine'; b.setAttribute('role', 'listitem'); b.dataset.chipName = m.name; b.dataset.mixId = m.id;
        b.innerHTML = `<strong>${SAVED_ICO}${m.name}</strong><span>${describeMix(m)}</span>`;
        b.addEventListener('click', () => { restoreMix(m); scheduleAutoAdvance('immerse'); });
        const more = document.createElement('button'); more.className = 'chip-del chip-more'; more.setAttribute('aria-label', 'Manage ' + m.name); more.textContent = '⋯';
        more.addEventListener('click', e => { e.stopPropagation(); openMixMenu(m); });
        b.appendChild(more); mhost.appendChild(b);
      });
    }
    // My Saved Sessions: creations with a visual — the same records Visual Focus lists
    const sessions = savedSessions();
    const srow = $('#my-sessions-row'), shost = $('#my-sessions');
    if (!shost && sessions.length) { renderPresetsRemount(); return; }
    if (shost) {
      shost.innerHTML = '';
      if (!sessions.length) { if (srow) srow.remove(); }
      else sessions.forEach(m => {
        const b = document.createElement('button'); b.className = 'chip chip-mine'; b.setAttribute('role', 'listitem'); b.dataset.chipName = m.name; b.dataset.mixId = m.id;
        b.innerHTML = `<strong>${SAVED_ICO}${m.name}</strong><span>${describeMix(m)}</span>`;
        b.addEventListener('click', () => restoreMix(m));
        const more = document.createElement('button'); more.className = 'chip-del chip-more'; more.setAttribute('aria-label', 'Manage ' + m.name); more.textContent = '⋯';
        more.addEventListener('click', e => { e.stopPropagation(); openMixMenu(m); });
        b.appendChild(more); shost.appendChild(b);
      });
    }
    if (window.softwaveFocus && softwaveFocus.refreshFavs) softwaveFocus.refreshFavs();   // Visual Focus lists the same sessions
    if (!$('#presets').children.length) { const pr2 = $('.presets-row'); const msRow = $('#my-sounds-row'); if (pr2 && msRow && !ms.length) { pr2.remove(); updateMixSaved(); return; } }
    const row = $('#my-sounds-row'); const host = $('#my-sounds');
    if (!ms.length) { if (row) row.remove(); updateMixSaved(); return; }
    if (!row || !host) { renderPresetsRemount(); return; }   // the row was removed earlier; rebuild the template
    host.innerHTML = '';
    ms.forEach((snd, i) => { const b = document.createElement('button'); b.className = 'chip chip-mine'; b.setAttribute('role', 'listitem'); b.dataset.chipName = snd.name; b.innerHTML = `<strong>${SAVED_ICO}${snd.name}</strong><span>${snd.type === 'paint' ? 'Painted sound' : 'Custom sound'}${snd.nature && snd.nature !== 'none' && engine.def(snd.nature) ? ' + ' + engine.def(snd.nature).name.toLowerCase() : ''}</span>`;
      b.addEventListener('click', async () => { const mix = [{ id: snd.type === 'paint' ? 'paint' : 'sculpt', volume: 0.55, balance: 0 }]; if (snd.type === 'paint') mix[0].curve = snd.curve; else mix[0].params = snd.params; if (snd.nature && snd.nature !== 'none') mix.push({ id: snd.nature, volume: snd.natureVol || 0.35, balance: 0 }); await loadPreset({ name: snd.name, mix, master: Math.min(engine.masterVolume, 0.45) }); scheduleAutoAdvance('immerse'); });
      const del = document.createElement('button'); del.className = 'chip-del'; del.setAttribute('aria-label', 'Delete ' + snd.name); del.textContent = '×'; del.addEventListener('click', e => { e.stopPropagation(); ms.splice(i, 1); store.set('lab:sounds', ms); renderPresetsRemount(); toast('Sound deleted'); }); b.appendChild(del); host.appendChild(b); });
    if (!host.children.length) row.remove();   // the section exists only with content
    updateMixSaved();
  }
  function renderPresetsRemount() { const r = $('.presets-row'); if (r) r.remove(); renderPresets(); }
  function updateMixSaved() {
    const saved = $('#saved-mixes'); if (!saved) return; saved.innerHTML = '';
    const custom = savedMixesOnly();
    if (!custom.length) saved.innerHTML = '<p class="muted">Nothing saved yet. Build a mix and tap "Save".</p>';
    custom.forEach((m, i) => {
      const b = document.createElement('button'); b.className = 'chip'; b.dataset.chipName = m.name;
      b.innerHTML = `<strong>${SAVED_ICO}${m.name}</strong><span>${describeMix(m, true)}</span>`;
      b.addEventListener('click', () => { restoreMix(m); scheduleAutoAdvance('immerse'); });
      const del = document.createElement('button'); del.className = 'btn btn-ghost btn-sm'; del.textContent = '⋯'; del.setAttribute('aria-label', 'Manage ' + m.name);
      del.addEventListener('click', e => { e.stopPropagation(); openMixMenu(m); });
      const wrap = document.createElement('div'); wrap.style.display = 'flex'; wrap.style.gap = '6px'; wrap.style.alignItems = 'center'; wrap.append(b, del); saved.appendChild(wrap);
    });
  }
  // Every playable card toggles like the sound tiles: tap to start, tap the same card to stop.
  let activeChipName = null;
  function markChips() { $$('[data-chip-name]').forEach(c => c.classList.toggle('chip-playing', !!c.dataset.chipName && c.dataset.chipName === activeChipName && engine.isPlaying)); }
  window.softwaveChips = {
    set(name) { activeChipName = name; markChips(); },
    toggleStop(name) { if (name && activeChipName === name && engine.isPlaying && engine.activeList().length) { engine.stopAll(); activeChipName = null; markChips(); return true; } return false; }
  };
  engine.on(type => { if (type === 'sounds' && !engine.activeList().length) activeChipName = null; if (type === 'sounds' || type === 'state') markChips(); });
  async function loadPreset(p) {
    if (window.softwaveChips.toggleStop(p.name)) { toast(`Stopped “${p.name}”`); return; }
    if (p.master !== undefined) setMaster(Math.min(p.master, engine.masterVolume || p.master));
    await engine.loadMix(p.mix);
    softwaveChips.set(p.name);
    toast(`Playing “${p.name}” — tap it again to stop`);
  }

  const openDiscovery = async () => { showView('lab'); try { await ensureLab(); window.softwaveLab.open('discovery'); } catch (e) { toast(e.message); } };
  $('#home-discover').addEventListener('click', openDiscovery); $('#home-tool-discover').addEventListener('click', openDiscovery);
  $('#home-start').addEventListener('click', async () => { if (engine.activeList().length) { await engine.playAll(); openNow(); return; } await loadPreset(PRESETS[0]); openNow(); });

  // ---------- Sound preference profile, available app-wide (read-only summary; the Lab owns the details) ----------
  const DIMS = ['colour', 'warm', 'deep', 'smooth', 'soft', 'width', 'moving', 'rich', 'mod'];
  function profileParams() { const p = store.get('lab:prefs2', { n: 0, sum: {}, natures: {} }); if (!p.n) return null; const out = {}; DIMS.forEach(d => out[d] = (p.sum[d] || 0) / p.n); const nat = Object.entries(p.natures || {}).sort((x, y) => y[1] - x[1])[0]; out.nature = nat ? nat[0] : 'none'; return out; }
  function profileMix(opts = {}) { const pp = profileParams(); if (!pp) return null; const params = Object.assign({}, pp); delete params.nature; if (opts.sleep) Object.assign(params, { colour: Math.min(params.colour, 0.45), soft: Math.min(params.soft, -0.2), moving: 0, mod: 0 }); const mix = [{ id: 'sculpt', volume: opts.sleep ? 0.5 : 0.55, balance: 0, params }]; const nature = pp.nature === 'none' ? (opts.sleep ? 'rain' : null) : pp.nature; if (nature) mix.push({ id: nature, volume: opts.sleep ? 0.25 : 0.3, balance: 0 }); return mix; }
  function profileVisual() { const pp = profileParams(); const motion = store.get('motion', 'low'); const dark = root.dataset.theme === 'dark'; if (pp && pp.nature === 'rain') return 'rainwindow'; if (pp && pp.nature === 'ocean') return 'ocean'; if (pp && pp.nature === 'forest') return 'forest'; if (pp && pp.nature === 'lapping') return 'ocean'; if (pp && (pp.nature === 'crickets')) return 'nightsky'; if (pp && pp.nature === 'leaves') return 'forest'; if (motion === 'still') return dark ? 'nightsky' : 'softlight'; return dark ? 'nightsky' : 'particles'; }
  function renderProfileHooks() {
    const pp = profileParams();
    const sleepRow = $('#sleep-profile-row'); if (sleepRow) sleepRow.hidden = !pp;
    const vs = $('#visual-profile-suggest'); if (vs) { if (pp) { const v = profileVisual(); const name = (window.softwaveFocus && softwaveFocus.allVisuals.find(x => x.id === v) || {}).name || v; vs.hidden = false; vs.innerHTML = `Based on your preferences, try <button class="linklike" data-pv="${v}">${name}</button>.`; $('[data-pv]', vs).addEventListener('click', () => { softwaveFocus.setVisual(v); toast(`Visual: ${name}`); }); } else vs.hidden = true; }
  }
  $('#sleep-from-profile').addEventListener('click', async () => { const mix = profileMix({ sleep: true }); if (!mix) return; toast('Building your sleep session from your Sound Profile…'); if (engine.masterVolume > 0.5) setMaster(0.4); await engine.loadMix(mix); engine.setTimer(60, true); toast('Sleep session ready — 60-minute timer with gentle fade. Opening your sleep screen…', 4200); scheduleAutoAdvance('sleep', 4000); });
  addEventListener('storage', renderProfileHooks); document.addEventListener('softwave:profile', renderProfileHooks);
  window.softwaveProfile = { params: profileParams, mix: profileMix, visual: profileVisual, refresh: renderProfileHooks };

  // One default for every normal single-sound start, then the user's own last level per sound
  // (tile slider or Mixer channel). Presets, moments, saved mixes and sessions keep their
  // explicit levels so they restore exactly as designed.
  const DEFAULT_VOL = 0.45;
  const soundVol = (id) => { const v = store.get('soundvol:' + id, null); return typeof v === 'number' && v >= 0 && v <= 1 ? v : DEFAULT_VOL; };
  const rememberVol = (id, v) => store.set('soundvol:' + id, Math.max(0, Math.min(1, v)));
  // ---------- sound cards ----------
  const tilePreviews = new Map();
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
        const FD = (window.SoftwaveField && window.SoftwaveField.DESC[d.id]) || d.desc;
        card.innerHTML = `
          <button class="card-btn" aria-pressed="false" aria-label="${d.name}: ${FD}"><span class="tile-preview" aria-hidden="true"><canvas class="tile-canvas"></canvas></span></button>
          <div class="vol"><button class="vol-pause" aria-label="Pause or resume playback"><svg class="vp-pause" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg><svg class="vp-play" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></button><label class="sr-only" for="vol-${d.id}">${d.name} volume</label><input id="vol-${d.id}" type="range" min="0" max="100" value="${Math.round(soundVol(d.id) * 100)}"><output>60%</output><button class="vol-stop" aria-label="Stop ${d.name}"><svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M6 6h12v12H6z" fill="currentColor"/></svg></button></div>
          <span class="name">${d.name}</span><span class="desc">${FD}</span>`;
        const btn = $('.card-btn', card);
        $$('.name, .desc', card).forEach(el => el.addEventListener('click', () => btn.click()));
        if (window.SoftwaveField) { const pv = new SoftwaveField.Preview($('.tile-canvas', card), d.id); tilePreviews.set(card, pv); }
        btn.addEventListener('click', async () => {
          const wasActive = engine.isActive(d.id);
          const ok = await engine.toggleSound(d.id, (+$('input', card).value) / 100);
          // Stay on the grid — no jump to the player — so more sounds can be added;
          // ~4s of quiet later the full-screen sound view opens on its own.
          if (!wasActive && ok !== false) scheduleAutoAdvance('immerse', 4000);
          if (ok === false) toast(`You can layer up to ${MAX_ACTIVE} sounds. Turn one off to add another.`);
        });
        const slider = $('input', card);
        slider.addEventListener('input', () => { engine.setVolume(d.id, +slider.value / 100); rememberVol(d.id, +slider.value / 100); $('output', card).textContent = slider.value + '%'; });
        $('.vol-pause', card).addEventListener('click', async () => { if (engine.ctx && engine.ctx.state === 'running') await engine.pauseAll(); else await engine.playAll(); });
        $('.vol-stop', card).addEventListener('click', () => engine.stopSound(d.id));
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
      v.addEventListener('input', () => { engine.setVolume(s.id, +v.value / 100); rememberVol(s.id, +v.value / 100); $('output', v.parentElement).textContent = v.value + '%'; syncCards(engine.activeList()); });
      p.addEventListener('input', () => { engine.setBalance(s.id, +p.value / 100); $('output', p.parentElement).textContent = panLabel(+p.value / 100); });
      p.addEventListener('dblclick', () => { p.value = 0; p.dispatchEvent(new Event('input')); });
      $('button', ch).addEventListener('click', () => engine.stopSound(s.id));
      host.appendChild(ch); $$('input', ch).forEach(paintRange);
    });
    const add = $('#mix-add-list'); add.innerHTML = '';
    const full = list.length >= MAX_ACTIVE; $('#mix-add-title').textContent = full ? `Up to ${MAX_ACTIVE} sounds — turn one off to add another` : 'Add a sound';
    engine.defs().filter(d => !engine.isActive(d.id)).forEach(d => { const b = document.createElement('button'); b.className = 'pane-sound add-pill'; b.style.setProperty('--hue', d.hue); b.disabled = full; b.innerHTML = `<span class="ico" aria-hidden="true">${d.icon}</span>${d.name}`; b.setAttribute('aria-label', 'Add ' + d.name); b.addEventListener('click', async () => { b.disabled = true; b.classList.add('adding'); await engine.startSound(d.id, soundVol(d.id)); }); add.appendChild(b); });
  }
  function panLabel(b) { if (Math.abs(b) < 0.05) return 'Centre'; return (b < 0 ? 'L ' : 'R ') + Math.round(Math.abs(b) * 100) + '%'; }
  $('#mix-pause').addEventListener('click', () => togglePlay());
  $('#mix-pick').addEventListener('click', () => { const l = $('#mix-add-list'); if (l) l.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('#mix-timer').addEventListener('click', () => openTimerSheet());
  $('#mix-vol').addEventListener('input', e => setMaster(+e.target.value / 100, true));
  $('#mix-stop').addEventListener('click', () => { stopEverything(); toast('All sounds stopped'); });
  $('#mix-reset').addEventListener('click', () => { engine.activeList().forEach(s => { engine.setVolume(s.id, 0.5); engine.setBalance(s.id, 0); }); setMaster(0.35); renderMixer(engine.activeList()); syncCards(engine.activeList()); toast('Levels reset'); });
  // ---------- the one Save system ----------
  // A saved mix is a complete, restorable setup: every active sound with its level and
  // balance, the FULL recipe of personalized sounds (sculpt/paint parameters — never
  // just the label), the master volume, and the timer. One store ('mixes'), shown in
  // "My Saved Mixes" on the Sounds page and in the Mixer's list.
  // ★ is reserved for Favourite experiments; saved creations carry a bookmark mark.
  const SAVED_ICO = '<svg class="ico-saved" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.2L5 21V4a1 1 0 0 1 1-1z" fill="currentColor"/></svg>';
  // ONE saved-creation store. A creation without a visual is a mix (My Saved Mixes);
  // with a visual it is a session (My Saved Sessions — also Visual Focus's list, and
  // where Build My Session saves land). Legacy "environments" migrate in once.
  const validMixes = () => {
    const all = store.get('mixes', []); let changed = false;
    const legacy = store.get('combos', null);
    if (Array.isArray(legacy) && legacy.length) {
      legacy.forEach((c, i) => { if (c && Array.isArray(c.mix)) all.push({ id: 'mx' + Date.now() + '_env' + i, name: c.name || 'My Focus', mix: c.mix, master: c.master, timer: { min: +c.timer || 0, fade: true }, visual: c.visual, motion: c.motion || 'low', source: 'env', saved: Date.now() }); });
      store.set('combos', []); changed = true;
    }
    all.forEach((m, i) => { if (m && !m.id) { m.id = 'mx' + (m.saved || Date.now()) + '_' + i; changed = true; } });
    if (changed) store.set('mixes', all);
    return all.filter(m => m && Array.isArray(m.mix) && m.mix.every(x => engine.def(x.id)));
  };
  function describeMix(m, levels) {
    const parts = m.mix.filter(x => engine.def(x.id)).map(x => engine.def(x.id).name + (levels ? ' ' + Math.round(x.volume * 100) + '%' : ''));
    if (m.visual) parts.push(visualName(m.visual));
    if (m.timer && m.timer.min) parts.push(`Timer ${m.timer.min} min`);
    return parts.join(' · ');
  }
  const savedSessions = () => validMixes().filter(m => m.visual);
  const savedMixesOnly = () => validMixes().filter(m => !m.visual);
  const visualName = (id) => { const F = window.softwaveFocus; const v = F && F.allVisuals ? F.allVisuals.find(x => x.id === id) : null; return v ? v.name : id; };
  // extra: { visual, motion, source } turns the creation into a session
  function saveCurrentMix(name, extra) {
    if (!engine.activeList().length) { toast('Add some sounds first'); return false; }
    const mixes = validMixes();
    const MZ = window.softwaveMonetization; if (MZ && !MZ.canCreateSavedItem(mixes.length)) { if (window.softwavePremium) softwavePremium.saveLimit('mixes'); return false; }
    const t = engine.timer;
    const now = Date.now(); mixes.push(Object.assign({ id: 'mx' + now + '_' + mixes.length, name, mix: engine.snapshot(), master: engine.masterVolume, timer: { min: t.durationMin || 0, fade: t.fade !== false }, saved: now }, extra || {}));
    store.set('mixes', mixes);
    // the save is done once it is stored — a rendering hiccup must never hide that
    try { renderPresetsRemount(); } catch (e) { console.error(e); }
    return true;
  }
  async function restoreMix(m) {
    if (m.visual && window.softwaveFocus && softwaveFocus.startSaved) { await softwaveFocus.startSaved(m); return; }
    await loadPreset({ name: m.name, mix: m.mix, master: m.master });
    // the timer is part of the setup — restored exactly (off if it was saved without one)
    if (engine.activeList().length && m.timer) engine.setTimer(m.timer.min || 0, m.timer.fade !== false);
  }
  // A useful default name from what is playing: "My Sound + Rain", "Pink Noise + Forest + 1 more"
  function suggestMixName() {
    const names = engine.activeList().map(x => engine.def(x.id).name);
    if (!names.length) return 'My Custom Mix';
    return names.length <= 2 ? names.join(' + ') : `${names[0]} + ${names[1]} + ${names.length - 2} more`;
  }
  // Every saved mix carries a stable id so rename/update/delete address the right entry
  // no matter how either list is rendered (both read the same store).
  function mixId(m) { return m.id; }
  function withMixes(fn) { const all = store.get('mixes', []); const r = fn(all); store.set('mixes', all); renderPresetsRemount(); return r; }
  let mixMenu = null;
  // One compact management sheet for every saved creation (mixes, environments, sessions):
  // Rename · Update to current setup (when the caller offers it) · Delete with a second tap.
  function openManageMenu(opts) {
    if (!mixMenu) {
      mixMenu = document.createElement('div'); mixMenu.className = 'addsound-sheet'; mixMenu.hidden = true;
      mixMenu.innerHTML = '<div class="addsound-card card mix-menu" role="dialog" aria-label="Manage saved item"><div class="addsound-head"><strong data-mm-title></strong><button type="button" class="btn btn-ghost btn-sm" data-mm-close>Close</button></div><p class="muted small" data-mm-desc></p><div class="btn-row mix-menu-actions"><button type="button" class="btn btn-ghost btn-sm" data-mm="rename">Rename</button><button type="button" class="btn btn-ghost btn-sm" data-mm="update">Update to current setup</button><button type="button" class="btn btn-ghost btn-sm" data-mm="delete">Delete</button></div><form data-mm-rename hidden style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px"><label class="sr-only" for="mix-rename">New name</label><input id="mix-rename" class="select" maxlength="40" style="flex:1;min-width:180px"><button type="submit" class="btn btn-primary btn-sm">Save name</button></form><p class="muted small" data-mm-note hidden></p></div>';
      document.body.appendChild(mixMenu);
      $('[data-mm-close]', mixMenu).addEventListener('click', () => layersClose());
      mixMenu.addEventListener('click', e => { if (e.target === mixMenu) layersClose(); });
      const note = (t) => { const n = $('[data-mm-note]', mixMenu); n.textContent = t; n.hidden = !t; };
      $('[data-mm="rename"]', mixMenu).addEventListener('click', () => { const f = $('[data-mm-rename]', mixMenu); f.hidden = !f.hidden; if (!f.hidden) { const i = $('#mix-rename', mixMenu); i.value = mixMenu._opts.title; setTimeout(() => { i.focus(); i.select(); }, 50); } });
      $('[data-mm-rename]', mixMenu).addEventListener('submit', e => {
        e.preventDefault(); const name = $('#mix-rename', mixMenu).value.trim(); if (!name) return;
        mixMenu._opts.rename(name); layersClose(); toast(`Renamed to “${name}”`, 3000);
      });
      $('[data-mm="update"]', mixMenu).addEventListener('click', () => {
        const o = mixMenu._opts; if (!o.update) return; const problem = o.update(); if (problem) { note(problem); return; }
        layersClose(); toast(`“${o.title}” now holds what is playing`, 3200);
      });
      $('[data-mm="delete"]', mixMenu).addEventListener('click', e => {
        const b = e.currentTarget;
        if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Tap again to delete'; b.classList.add('btn-danger'); note(mixMenu._opts.deleteNote || 'This removes it from every list it appears in.'); return; }
        mixMenu._opts.del(); layersClose(); toast('Deleted', 2600);
      });
    }
    mixMenu._opts = opts;
    $('[data-mm-title]', mixMenu).textContent = opts.title; $('[data-mm-desc]', mixMenu).textContent = opts.desc || '';
    $('[data-mm="update"]', mixMenu).hidden = !opts.update;
    const del = $('[data-mm="delete"]', mixMenu); delete del.dataset.armed; del.textContent = 'Delete'; del.classList.remove('btn-danger');
    $('[data-mm-rename]', mixMenu).hidden = true; const n = $('[data-mm-note]', mixMenu); n.hidden = true; n.textContent = '';
    if (mixMenu.hidden) { mixMenu.hidden = false; layerPush(() => { mixMenu.hidden = true; }); }
  }
  function openMixMenu(m) {
    openManageMenu({
      title: m.name, desc: describeMix(m, true) + (m.master != null ? ` · master ${Math.round(m.master * 100)}%` : ''),
      deleteNote: m.visual ? 'This removes the session from My Saved Sessions and Visual Focus.' : 'This removes the mix from My Saved Mixes and the Mixer.',
      rename: name => withMixes(all => { const x = all.find(y => y.id === m.id); if (x) x.name = name; }),
      update: () => {
        if (!engine.activeList().length) return 'Nothing is playing — start the sounds you want this mix to hold, then update.';
        const t = engine.timer;
        withMixes(all => { const x = all.find(y => y.id === m.id); if (x) { Object.assign(x, { mix: engine.snapshot(), master: engine.masterVolume, timer: { min: t.durationMin || 0, fade: t.fade !== false }, saved: Date.now() }); if (x.visual) { x.visual = store.get('visual', x.visual); x.motion = store.get('motion', x.motion); } } });
        return '';
      },
      del: () => withMixes(all => { const i = all.findIndex(y => y.id === m.id); if (i >= 0) all.splice(i, 1); })
    });
  }
  let saveSheet = null;
  function openSaveSheet(extra) {
    if (!engine.activeList().length) { toast('Add some sounds first'); return; }
    const asSession = !!(extra && extra.visual);
    if (!saveSheet) {
      saveSheet = document.createElement('div'); saveSheet.className = 'addsound-sheet'; saveSheet.hidden = true;
      saveSheet.innerHTML = '<div class="addsound-card card" role="dialog" aria-label="Save this mix"><div class="addsound-head"><strong>Save this mix</strong><button type="button" class="btn btn-ghost btn-sm" data-sv-close>Cancel</button></div><form data-sv-form style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><label class="sr-only" for="save-mix-name">Mix name</label><input id="save-mix-name" class="select" maxlength="40" value="My Custom Mix" style="flex:1;min-width:180px"><button type="submit" id="save-mix-submit" class="btn btn-primary btn-sm">Save</button></form><p class="muted small" data-sv-warn hidden></p><p class="muted small" data-sv-desc></p></div>';
      document.body.appendChild(saveSheet);
      $('[data-sv-close]', saveSheet).addEventListener('click', () => layersClose());
      saveSheet.addEventListener('click', e => { if (e.target === saveSheet) layersClose(); });
      const form = $('[data-sv-form]', saveSheet);
      $('#save-mix-name', saveSheet).addEventListener('input', () => { delete form.dataset.confirmed; $('[data-sv-warn]', saveSheet).hidden = true; $('#save-mix-submit', saveSheet).textContent = 'Save'; });
      form.addEventListener('submit', e => {
        e.preventDefault(); const name = $('#save-mix-name', saveSheet).value.trim() || 'My Custom Mix';
        const dup = validMixes().some(m => m.name.toLowerCase() === name.toLowerCase());
        if (dup && !form.dataset.confirmed) { form.dataset.confirmed = '1'; const w = $('[data-sv-warn]', saveSheet); w.textContent = `You already have a mix called “${name}”. Tap Save again to keep both.`; w.hidden = false; $('#save-mix-submit', saveSheet).textContent = 'Save anyway'; return; }
        const ex = saveSheet._extra; if (saveCurrentMix(name, ex)) { layersClose(); toast(`Saved — find “${name}” under ${ex && ex.visual ? 'My Saved Sessions' : 'My Saved Mixes'}`, 3600); }
      });
    }
    const t = engine.timer;
    saveSheet._extra = extra || null; $('.addsound-head strong', saveSheet).textContent = asSession ? 'Save this session' : 'Save this mix';
    $('[data-sv-desc]', saveSheet).textContent = 'Saves ' + describeMix({ mix: engine.snapshot(), timer: { min: t.durationMin || 0 }, visual: asSession ? extra.visual : undefined }, true) + ` · master ${Math.round(engine.masterVolume * 100)}%` + ' — exactly as it plays now, on this device.';
    const inp = $('#save-mix-name', saveSheet); inp.value = asSession ? `${suggestMixName()} + ${visualName(extra.visual)}` : suggestMixName(); delete $('[data-sv-form]', saveSheet).dataset.confirmed; $('[data-sv-warn]', saveSheet).hidden = true; $('#save-mix-submit', saveSheet).textContent = 'Save';
    if (saveSheet.hidden) { saveSheet.hidden = false; layerPush(() => { saveSheet.hidden = true; }); }
    setTimeout(() => { inp.focus(); inp.select(); }, 60);
  }
  $('#mix-save').addEventListener('click', openSaveSheet);

  // ---------- player bar ----------
  const masterEl = $('#master-vol');
  function setMaster(v, fromSlider) {
    engine.setMasterVolume(v);
    if (!fromSlider) { masterEl.value = Math.round(v * 100); paintRange(masterEl); }
    $('#master-out').textContent = Math.round(v * 100) + '%';
    $('.player-vol').classList.toggle('warn', v > 0.75);
    const fv = $('.field-vol'); if (fv) fv.classList.toggle('warn', v > 0.75);
    store.set('master', v);
  }
  let warned = false;
  masterEl.addEventListener('input', () => {
    const v = +masterEl.value / 100; setMaster(v, true);
    if (v > 0.75 && !warned) { warned = true; toast('High level. The lowest comfortable level that still helps is usually best — louder is not better masking.', 4000); }
    if (v <= 0.75) warned = false;
  });
  setMaster(clamp(store.get('master', 0.45), 0.1, 1)); // restore last-used level (floor avoids opening silent)
  // The phone's hardware volume multiplies with the app slider — when both are low the app seems
  // broken. That hardware level is unreadable from a web app, so a brief hint is the only bridge.
  let volHinted = false;
  engine.on(type => {
    if (type !== 'sounds' || volHinted || !engine.activeList().length) return;
    volHinted = true;
    const shown = store.get('volhint', 0);
    if (engine.masterVolume <= 0.4 && shown < 3) {
      store.set('volhint', shown + 1);
      setTimeout(() => toast('Quiet? Raise the volume slider here — and check your phone’s own volume buttons. Both work together.', 5200), 1400);
    }
  });
  async function togglePlay() {
    if (!engine.ctx) { if (!engine.activeList().length) return toast('Choose a sound to begin'); }
    // iOS also has a non-standard "interrupted" state — anything that isn't running
    // with sounds queued means "resume", or the first press does nothing.
    if (engine.ctx && engine.ctx.state === 'running' && engine.isPlaying) await engine.pauseAll();
    else if (engine.isPlaying || (engine.ctx && engine.ctx.state !== 'running' && engine.active.size)) await engine.playAll();
    else toast('Choose a sound to begin');
  }
  $('#player-toggle').addEventListener('click', togglePlay);
  function stopEverything() { if (window.softwaveLab && softwaveLab.isRunning()) softwaveLab.stop(); engine.stopAll(); }
  window.softwaveStopAll = stopEverything;
  $('#player-stop').addEventListener('click', stopEverything);
  function updatePlayer() {
    const list = engine.activeList();
    const playing = engine.isPlaying;
    const ln = $('.field-learn-note'); if (ln) ln.hidden = list.length > 0;   // the pre-play invitation retires once something plays
    const names = list.map(s => engine.def(s.id).name);
    if (engine.tone && engine.tone.playing) names.push(`Tone ${fmt(engine.tone.freq)} Hz`);
    $('#player').classList.toggle('player-hidden', !names.length);
    $('#player-title').textContent = names.length ? names.join(' + ') : 'Nothing playing';
    $('#player-sub').textContent = names.length ? (playing ? 'Playing · keep it low and comfortable' : 'Paused') : 'Choose a sound to begin';
    const t = $('#player-toggle'); t.setAttribute('aria-pressed', playing); t.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    $('#sleep-now-list').textContent = names.length ? names.join(' + ') : 'Nothing yet — pick a preset below or choose sounds.';
    $('#sleep-sounds').textContent = names.join(' · ');
    const fs = $('#focus-setup-sound'); if (fs) fs.textContent = names.length ? names.join(' + ') : 'No sound yet';
    if (!$('#view-lab').hidden) bg.setMode('lab'); else bg.setMode(engine.isActive('rain') ? 'rain' : 'calm');
    document.title = names.length ? `${names[0]}${names.length > 1 ? ' +' + (names.length - 1) : ''} — Find My Quiet Sound` : 'Find My Quiet Sound — Free Tinnitus Sound Generator & Masking Sounds';
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
    screen.hidden = false; document.body.style.overflow = 'hidden'; $('#sleep-pause').focus();
    layerPush(exitSleepUI);
    try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (_) { }
  });
  let wake = null;
  function exitSleepUI() { screen.hidden = true; document.body.style.overflow = ''; if (wake) { wake.release().catch(() => { }); wake = null; } }
  // exiting goes through history so the layer's Back entry is consumed with it
  function exitSleep() { if (!screen.hidden) layersClose(); }
  $('#sleep-exit').addEventListener('click', exitSleep);
  screen.addEventListener('keydown', e => { if (e.key === 'Escape') exitSleep(); });
  $('#sleep-pause').addEventListener('click', togglePlay);
  $('#sleep-save').addEventListener('click', () => openSaveSheet());
  $('#sleep-stop').addEventListener('click', () => { engine.stopAll(); toast('All sounds stopped'); });
  $('#sleep-timer').addEventListener('click', () => openTimerSheet());
  $('#sleep-vol').addEventListener('input', e => setMaster(+e.target.value / 100, true));
  function clockTick() { const d = new Date(); $('#sleep-clock').textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  setInterval(clockTick, 1000); clockTick();
  engine.on(type => { if (type === 'state') { const paused = !(engine.ctx && engine.ctx.state === 'running'); $$('.vol-pause').forEach(b => { b.classList.toggle('paused', paused); b.setAttribute('aria-label', paused ? 'Resume playback' : 'Pause playback'); }); } });
  function renderTimer(t) {
    // the Sleep page's timer choices mirror the real timer (Your Sleep = 60, Woke Up at Night = 30, none = Continuous)
    { const cur = t.endsAt ? (t.durationMin || 0) : 0; $$('.timer-seg [data-min]').forEach(x => x.setAttribute('aria-checked', String(+x.dataset.min === cur))); }
    // every timer button label follows the engine, no matter where the timer was set
    const nb = $('[data-now="timer"]'); if (nb) nb.textContent = t.durationMin ? `Timer · ${t.durationMin} min` : 'Timer';
    const el = $('#player-timer'), rem = $('#sleep-remaining');
    if (!t.endsAt) { el.hidden = true; rem.textContent = 'Continuous'; if (!t.durationMin) $$('.timer-seg [data-min]').forEach(x => x.setAttribute('aria-checked', x.dataset.min === '0')); return; }
    const left = Math.max(0, t.endsAt - Date.now()); const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    const txt = `${m}:${String(s).padStart(2, '0')}`;
    el.hidden = false; el.textContent = (t.fading ? 'Fading · ' : '⏾ ') + txt; rem.textContent = (t.fading ? 'Fading out · ' : 'Sound stops in ') + txt;
  }

  // ---------- add-sound sheet: choose more sounds without scrolling back to the library.
  // Reuses the Visual Focus sound-pane pattern; volumes and balance stay the Mixer's job.
  (function addSoundSheet() {
    const faRow = $('#field-controls .field-actions'); if (!faRow) return;
    // the controller renders the button in its standard slot; create one only for older markup
    let ab = $('#field-add');
    if (!ab) { ab = document.createElement('button'); ab.type = 'button'; ab.className = 'fa'; ab.id = 'field-add'; ab.textContent = '＋ Add sound'; faRow.insertBefore(ab, faRow.firstChild); }
    // the Immerse controller's ＋ Add sound opens the same sheet
    const nab = $('#now-add'); if (nab) nab.addEventListener('click', () => ab.click());
    const sheet = document.createElement('div'); sheet.id = 'addsound-sheet'; sheet.className = 'addsound-sheet'; sheet.hidden = true;
    sheet.innerHTML = `<div class="addsound-card card" role="dialog" aria-label="Add a sound"><div class="addsound-head"><strong>Add a sound</strong><button class="btn btn-ghost btn-sm" data-as-close>Done</button></div><div class="pane-sounds" data-as-grid></div><p class="muted small">Tap to add or remove — up to ${MAX_ACTIVE} at once. Fine volumes and balance live in the Mixer.</p></div>`;
    document.body.appendChild(sheet);
    const renderGrid = () => {
      const g = $('[data-as-grid]', sheet); g.innerHTML = '';
      engine.defs().forEach(d => {
        const on = engine.isActive(d.id);
        const b = document.createElement('button'); b.className = 'pane-sound' + (on ? ' on' : ''); b.setAttribute('aria-pressed', on);
        b.innerHTML = `<span class="ico">${d.icon}</span>${d.name}`;
        b.addEventListener('click', async () => { const wasOn = engine.isActive(d.id); const ok = await engine.toggleSound(d.id, soundVol(d.id)); if (ok === false) toast(`You can layer up to ${MAX_ACTIVE} sounds. Turn one off to add another.`); else if (!wasOn) scheduleAutoAdvance('immerse', 4000); });
        g.appendChild(b);
      });
    };
    ab.addEventListener('click', () => { if (!sheet.hidden) return; sheet.hidden = false; renderGrid(); layerPush(() => { sheet.hidden = true; }); });
    $('[data-as-close]', sheet).addEventListener('click', () => layersClose());
    sheet.addEventListener('click', e => { if (e.target === sheet) layersClose(); });
    engine.on(type => { if (type === 'sounds' && !sheet.hidden) renderGrid(); });
  })();

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

  // ---------- Softwave Sound Field (the active sound as the visual centrepiece) ----------
  const FIELD = window.SoftwaveField; const fieldMain = FIELD ? new FIELD.Field($('#field-canvas')) : null; const fieldBig = FIELD ? new FIELD.Field($('#now-canvas')) : null;
  if (fieldMain) { fieldMain.spot = $('#field'); fieldBig.fullscreen = true; }
  const fieldSpec = new Uint8Array(512); let fieldLast = 0; let fieldVisible = true;
  new IntersectionObserver(en => { fieldVisible = en[0].isIntersecting; }).observe($('#field'));
  const tileVisible = new Map(); const tileIO = new IntersectionObserver(ens => ens.forEach(en => tileVisible.set(en.target, en.isIntersecting)), { rootMargin: '80px' });
  let tileTick = 0;   // idle previews refresh staggered (1/3 per tick) so no frame redraws every tile at once
  function fieldIds() { return engine.activeList().map(sn => ({ id: sn.id, volume: sn.volume, params: (sn.id === 'sculpt' || sn.id.startsWith('disco')) ? engine.getSculpt(sn.id) : null })); }
  // Frame-time watchdog: on machines that cannot keep up (old GPUs, broken drivers), sustained
  // slow frames flip every LOW rendering path on — the visuals stay, with far less GPU work.
  let ftEma = 16, ftBadSince = 0, ftPrev = 0, fieldDrawLast = 0;
  function fieldLoop(now) { requestAnimationFrame(fieldLoop); if (!FIELD || document.hidden) { ftPrev = 0; return; } const playing = !!engine.isPlaying;
    if (ftPrev) { const ft = now - ftPrev; if (ft < 400) {   // frames >=400ms are throttling (occluded window, 2fps cap), not jank — counting them would flip LOW spuriously
      ftEma += (ft - ftEma) * 0.05; if (!FIELD.LOW) { if (ftEma > 90) { if (!ftBadSince) ftBadSince = now; if (now - ftBadSince > 4000) { FIELD.setLOW(true); console.info('Softwave: low-power visuals enabled (slow frames detected)'); try { dispatchEvent(new Event('resize')); } catch (_) { } } } else ftBadSince = 0; } } } ftPrev = now;
    // The field is a slow-breathing form: 30 fps playing / 20 fps idle is visually identical
    // and halves both script time and the GPU compositing of a large canvas.
    const drawDue = now - fieldDrawLast >= (transit.active ? 0 : window.softwaveMinimalActive ? (playing ? 200 : 500) : FIELD.LOW ? (playing ? 50 : 100) : (playing ? 33 : 50));
    const immersed = !$('#now').hidden; const focusOpen = !$('#focus-screen').hidden && !transit.active;
    if (drawDue) { fieldDrawLast = now; const lv = playing ? Math.min(1, engine.getLevels(fieldSpec) * 6) : 0; let lo = 0; if (playing) { for (let i = 1; i < 10; i++) lo += fieldSpec[i]; lo /= 9 * 255; } const bal = engine.activeList().reduce((acc, sn) => acc + sn.balance, 0);
    if (immersed) { fieldBig.setPlaying(playing); fieldBig.setLevel(lv, bal); fieldBig.setLow(lo); fieldBig.draw(now); } else if (!focusOpen && (transit.active || (fieldVisible && !$('#view-sounds').hidden))) { fieldMain.setPlaying(playing); fieldMain.setLevel(lv, bal); fieldMain.setLow(lo); fieldMain.draw(now); } }
    if (now - fieldLast > 80 && !$('#view-sounds').hidden && !immersed) { fieldLast = now; tileTick = (tileTick + 1) % 3; let ti = 0; tilePreviews.forEach((pv, card) => { ti++; if (!tileVisible.has(card)) { tileIO.observe(card); tileVisible.set(card, false); return; } if (!tileVisible.get(card)) return; const hot = card.classList.contains('active') || card.matches(':hover'); if (!hot && ti % 3 !== tileTick) return; if (!hot && FIELD.LOW && pv._once) return; pv._once = true; pv.setLevel(hot ? 0.5 : 0.15, 0); pv.draw(now); }); } }
  requestAnimationFrame(fieldLoop);

  // ---------- Minimal visuals (battery saver): near-zero continuous painting; sound untouched ----------
  const qsp = new URLSearchParams(location.search);
  if (qsp.get('minimal') === '1') store.set('minimal', true); else if (qsp.get('minimal') === '0') store.set('minimal', false);
  let MINIMAL = !!store.get('minimal', false);
  window.softwaveMinimalActive = MINIMAL;
  function applyMinimal(on) {
    MINIMAL = on; window.softwaveMinimalActive = on; store.set('minimal', on);
    if (FIELD) { try { FIELD.setLOW(on || localStorage.getItem('softwave:rasterSlow') === '1'); } catch (_) { } }
    if (window.softwaveBg) { softwaveBg._staticDrawn = false; if (!on && !document.hidden) { softwaveBg.running = true; softwaveBg.loop(); } }
    try { dispatchEvent(new Event('resize')); } catch (_) { }
  }
  if (MINIMAL) applyMinimal(true);
  // No visible toggle: minimal mode stays reachable via ?minimal=1 / ?minimal=0 as a support tool,
  // and slow machines are switched to low-power visuals automatically.
  // ---------- diagnostics overlay: open with ?diag=1 and read the machine's real state ----------
  if (qsp.get('diag') === '1') setTimeout(() => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;background:rgba(10,14,26,.94);color:#cfe0ff;font:12px/1.6 monospace;padding:10px 14px;border-radius:10px;border:1px solid rgba(160,180,255,.4);white-space:pre;pointer-events:none';
    const fc = $('#field-canvas'), bgc = $('#bg');
    let gl; try { gl = !!document.createElement('canvas').getContext('webgl', { failIfMajorPerformanceCaveat: true }); } catch (e) { gl = 'err'; }
    d.textContent = ['SOFTWAVE DIAG', 'LOW: ' + (FIELD && FIELD.LOW) + '   minimal: ' + MINIMAL,
      'rasterSlow: ' + localStorage.getItem('softwave:rasterSlow') + ' (' + (localStorage.getItem('softwave:rasterMs') || '?') + ' ms)',
      'hwWebGL: ' + gl + '   dpr: ' + devicePixelRatio, 'win: ' + innerWidth + 'x' + innerHeight,
      'field: ' + (fc ? fc.width + 'x' + fc.height : '-') + '   bg: ' + (bgc ? bgc.width + 'x' + bgc.height : '-'),
      'cores: ' + navigator.hardwareConcurrency + '   mem: ' + (navigator.deviceMemory || '?') + 'GB'].join('\n');
    document.body.appendChild(d);
  }, 4500);

  function syncField() {
    const ids = fieldIds(); if (fieldMain) { fieldMain.set(ids); fieldBig.set(ids); }
    const names = engine.activeList().map(sn => engine.def(sn.id).name); const playing = engine.isPlaying; const any = ids.length > 0;
    const top = engine.activeList().slice().sort((x, y) => y.volume - x.volume)[0]; const desc = any ? (ids.length > 1 ? names.slice(1).join(' + ') + ' layered' : (FIELD && FIELD.DESC[top.id]) || engine.def(top.id).desc) : '';
    $('#field-name').textContent = any ? names[0] : 'Ready when you are'; $('#field-desc').innerHTML = any ? desc : 'Tap any sound below — or <button class="linklike" id="field-discover">Help Me Find My Sound</button> <a class="linklike" href="learn/how-to-use-find-my-sound/">(how it works)</a><span class="field-desc-alt">Curious about the pitch you hear? <a class="linklike" href="#match" data-view="match">Find My Tinnitus Sound →</a></span>';
    const fd = $('#field-discover'); if (fd) fd.addEventListener('click', openDiscovery);
    $('#field-controls').hidden = !any; const core = $('#field-core'); core.classList.toggle('idle', !any); core.setAttribute('aria-pressed', playing); core.setAttribute('aria-label', !any ? 'Choose a sound to begin' : playing ? 'Pause' : 'Play');
    $('#field').dataset.state = !any ? 'idle' : playing ? 'playing' : 'paused';
    const v = $('#field-vol'); v.value = Math.round(engine.masterVolume * 100); paintRange(v); $('#field-vol-out').textContent = v.value + '%';
    const t = engine.timer; $$('.sound-controller [data-act="timer"] span').forEach(el => { el.textContent = t.endsAt ? `Timer · ${Math.max(1, Math.ceil((t.endsAt - Date.now()) / 60000))} min` : 'Timer'; });
    const atmo = !any ? '' : ['brown', 'fire', 'cabin', 'thunder', 'city'].includes(top.id) ? 'warm' : ['night'].includes(top.id) ? 'dark' : ['rain', 'waterfall', 'static', 'hiss', 'white'].includes(top.id) ? 'muted' : 'cool'; document.body.dataset.atmo = atmo;
  }
  engine.on(type => { if (['sounds', 'state', 'master', 'timer', 'tone'].includes(type)) syncField(); });
  // ---------- Sound → Visual → Environment (the signature transition) ----------
  const transit = { active: false, timer: null };
  const REDUCE = () => FIELD && FIELD.reduced();
  function transitionTo(visualId, done) {
    if (!fieldMain) { done && done(); return; }
    clearTimeout(transit.timer); transit.active = true; document.body.classList.add('transit'); const cv = $('#field-canvas'); cv.classList.add('fs'); fieldMain.fullscreen = true; fieldMain.spot = $('#field');
    fieldMain.setEnvironment(visualId); fieldMain.morph = 0; fieldMain.morphTarget = 1;
    transit.timer = setTimeout(() => { done && done(); requestAnimationFrame(() => requestAnimationFrame(() => { transit.active = false; document.body.classList.remove('transit'); cv.classList.remove('fs'); fieldMain.fullscreen = false; fieldMain.morph = 0; fieldMain.morphTarget = 0; })); }, REDUCE() ? 450 : 1700);
  }
  function transitionBack(visualId) {
    if (!fieldMain) return; clearTimeout(transit.timer); transit.active = true; document.body.classList.add('transit'); const cv = $('#field-canvas'); cv.classList.add('fs'); fieldMain.fullscreen = true;
    fieldMain.setEnvironment(visualId); fieldMain.morph = 1; fieldMain.morphTarget = 0; if (location.hash !== '#sounds') showView('sounds', { push: false }); scrollTo({ top: 0, behavior: 'instant' });
    transit.timer = setTimeout(() => { transit.active = false; document.body.classList.remove('transit'); cv.classList.remove('fs'); fieldMain.fullscreen = false; fieldMain.morph = 0; }, REDUCE() ? 450 : 1600);
  }
  function clearTransit() { clearTimeout(transit.timer); transit.active = false; transit.since = 0; document.body.classList.remove('transit'); const cv = $('#field-canvas'); if (cv) cv.classList.remove('fs'); if (fieldMain) { fieldMain.fullscreen = false; fieldMain.morph = 0; fieldMain.morphTarget = 0; } }
  // watchdog: a transition can never leave the interface hidden — whatever happens, it clears itself
  setInterval(() => { if (transit.active) { transit.since = transit.since || Date.now(); if (Date.now() - transit.since > 4000) clearTransit(); } else transit.since = 0; if (!transit.active && document.body.classList.contains('transit')) document.body.classList.remove('transit'); }, 1000);
  window.softwaveTransition = { to: transitionTo, back: transitionBack, clear: clearTransit, get active() { return transit.active; } };
  $('#field-core').addEventListener('click', async e => { const b = e.currentTarget; b.classList.add('pressed'); setTimeout(() => b.classList.remove('pressed'), 450); if (!engine.activeList().length) { $('#sound-groups').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; } await togglePlay(); syncField(); });
  $('#field-vol').addEventListener('input', e => setMaster(+e.target.value / 100, true));
  $('#field-pause').addEventListener('click', async () => { if (engine.ctx && engine.ctx.state === 'running') await engine.pauseAll(); else await engine.playAll(); });
  $('#field-stop').addEventListener('click', () => { engine.stopAll(); toast('All sounds stopped'); });
  // Timer: a small picker instead of cycling values on each press.
  let timerSheet = null;
  function openTimerSheet() {
    if (!timerSheet) {
      timerSheet = document.createElement('div'); timerSheet.className = 'addsound-sheet'; timerSheet.hidden = true;
      timerSheet.innerHTML = '<div class="addsound-card card" role="dialog" aria-label="Sleep timer"><div class="addsound-head"><strong>Timer</strong><button class="btn btn-ghost btn-sm" data-t-close>Close</button></div><div class="chips" data-t-opts></div><p class="muted small">The sound fades out gently before the timer ends.</p></div>';
      document.body.appendChild(timerSheet);
      $('[data-t-close]', timerSheet).addEventListener('click', () => layersClose());
      timerSheet.addEventListener('click', e => { if (e.target === timerSheet) layersClose(); });
    }
    const host = $('[data-t-opts]', timerSheet); host.innerHTML = '';
    const cur = engine.timer.durationMin || 0;
    [[15, '15 min'], [30, '30 min'], [60, '60 min'], [90, '90 min'], ['custom', 'Custom…'], [0, 'Off']].forEach(([v, l]) => {
      const b = document.createElement('button'); b.className = 'chip' + (v === cur ? ' active' : ''); b.textContent = l;
      b.addEventListener('click', () => {
        let m = v === 'custom' ? parseInt(prompt('Timer length in minutes (5–180):', '45'), 10) : v;
        if (v === 'custom' && (!m || m < 5 || m > 180)) return;
        engine.setTimer(m, true); toast(m ? `Timer: ${m} minutes with gentle fade` : 'Timer off');
        layersClose();
      });
      host.appendChild(b);
    });
    if (timerSheet.hidden) { timerSheet.hidden = false; layerPush(() => { timerSheet.hidden = true; }); }
  }
  $$('[data-fa]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.fa; if (k === 'timer') openTimerSheet(); if (k === 'visual') { showView('focus'); setTimeout(() => { const st = $('#env-stage'); st && st.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 250); } if (k === 'mixer') showView('mixer'); if (k === 'save') openSaveSheet(); if (k === 'immerse') openNow(); }));

  // ---------- sound environment, orb player and Now Playing ----------
  const SV = window.SoftwaveVisuals;
  function dominant() { const l = engine.activeList(); if (!l.length) return null; return l.slice().sort((x, y) => y.volume - x.volume)[0].id; }
  function dominantParams() { const l = engine.activeList(); if (!l.length) return SV.paramsFor('pink'); const top = l.slice().sort((x, y) => y.volume - x.volume); const base = SV.paramsFor(top[0].id, top[0].id === 'sculpt' || top[0].id.startsWith('disco') ? engine.getSculpt(top[0].id) : null); if (top[1]) { const p2 = SV.paramsFor(top[1].id); base.nature = base.nature !== 'none' ? base.nature : p2.nature; base.rich = Math.min(1, base.rich + 0.25); } return base; }
  window.softwaveSound = () => { const l = engine.activeList(); if (!l.length) return null; const top = l.slice().sort((x, y) => y.volume - x.volume)[0]; const p = SV.paramsFor(top.id, (top.id === 'sculpt' || top.id.startsWith('disco')) ? engine.getSculpt(top.id) : null); return { colour: p.colour, warm: p.warm, moving: p.moving, nature: p.nature }; };
  function describeSound(p) { const b = []; b.push(p.colour < 0.33 ? 'Deep' : p.colour < 0.67 ? 'Balanced' : 'Bright'); if (p.warm < -0.25) b.push('Warm'); if (p.warm > 0.25) b.push('Airy'); if (p.moving > 0.3 || p.mod > 0.3) b.push('Moving'); else b.push('Steady'); if (p.nature !== 'none') b.push(engine.def(p.nature) ? engine.def(p.nature).name : p.nature); return b.join(' · '); }
  const orbs = [['#player-orb', 0.44]]; let orbT = 0, orbLast = 0; const orbSpec = new Uint8Array(512);
  function orbLoop(now) { requestAnimationFrame(orbLoop); if (document.hidden || now - orbLast < (window.softwaveMinimalActive ? 250 : 50)) return; const dt = Math.min(0.3, (now - orbLast) / 1000); orbLast = now; orbT += dt * (engine.isPlaying ? 1 : 0.35);
    // cheap visibility first — dominantParams and getLevels only run when the orb will actually draw
    if ($('#player').classList.contains('player-hidden')) return;
    const lv = engine.isPlaying ? Math.min(1, engine.getLevels(orbSpec) * 6) : 0; const p = dominantParams();
    for (const [sel, scale] of orbs) { const c = $(sel); if (!c) continue; const r = c.getBoundingClientRect(); if (!r.width) continue; const dpr = Math.min(devicePixelRatio || 1, FIELD && FIELD.LOW ? 1 : 1.5); if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); } const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height); SV.soundShape(ctx, r.width, r.height, p, orbT, lv, { scale, glow: sel === '#now-canvas' }); } }
  requestAnimationFrame(orbLoop);
  function syncEnvironment() { const id = dominant(); bg.setEnv(id); document.body.dataset.sound = id || ''; const p = dominantParams(); const names = engine.activeList().map(s => engine.def(s.id).name); $('#now-name').textContent = names.length ? names.join(' + ') : 'Nothing playing'; $('#now-desc').textContent = names.length ? describeSound(p) : 'Choose a sound to begin'; }
  engine.on(type => { if (['sounds', 'state', 'tone', 'master'].includes(type)) syncEnvironment(); if (type === 'master') { for (const [vid, oid] of [['#now-vol', '#now-vol-out'], ['#sleep-vol', '#sleep-vol-out'], ['#mix-vol', '#mix-vol-out']]) { const v = $(vid); if (!v) continue; v.value = Math.round(engine.masterVolume * 100); paintRange(v); $(oid).textContent = v.value + '%'; } } });
  let nowHideT; function nowShowUI() { $('#now').classList.remove('idle'); clearTimeout(nowHideT); nowHideT = setTimeout(() => $('#now').classList.add('idle'), 5000); }
  function openNow() { if (!$('#now').hidden) return; $('#now').hidden = false; document.body.style.overflow = 'hidden'; syncEnvironment(); if (fieldBig) fieldBig.set(fieldIds()); nowShowUI(); const f = $('#now-pause'); if (f) f.focus(); layerPush(closeNowUI); }
  function closeNowUI() { $('#now').hidden = true; document.body.style.overflow = ''; }
  function closeNow() { if (!$('#now').hidden) layersClose(); }
  $('#now').addEventListener('pointermove', nowShowUI); $('#now').addEventListener('pointerdown', nowShowUI);
  $('#player-title').addEventListener('click', () => { if (engine.activeList().length) openNow(); });
  $('#player-title').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (engine.activeList().length) openNow(); } });
  $('#now-close').addEventListener('click', closeNow);
  $('#now').addEventListener('keydown', e => { if (e.key === 'Escape') closeNow(); });
  // Immerse controller: same functions as the Sounds player, wired for a full-screen layer
  $('#now-pause').addEventListener('click', async () => { if (engine.ctx && engine.ctx.state === 'running') await engine.pauseAll(); else await engine.playAll(); });
  $('#now-stop').addEventListener('click', () => { engine.stopAll(); toast('All sounds stopped'); });
  $('#now-timer').addEventListener('click', () => openTimerSheet());
  const leaveNow = (then) => { closeNow(); setTimeout(then, 80); };
  $('#now-visual').addEventListener('click', () => leaveNow(() => { if (window.softwaveFocus) softwaveFocus.openChooser(); else showView('focus'); }));
  $('#now-mixer').addEventListener('click', () => leaveNow(() => showView('mixer')));
  $('#now-save').addEventListener('click', () => openSaveSheet());
  $('#player-toggle').addEventListener('click', e => { const b = e.currentTarget; b.classList.add('pressed'); setTimeout(() => b.classList.remove('pressed'), 400); });
  $('#now-vol').addEventListener('input', e => setMaster(+e.target.value / 100, true));
  // navigating away from the Immerse overlay: consume its history entry first,
  // then move once the popstate has settled — keeps the stack clean for Back
  $$('[data-now]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.now; if (k === 'timer') { openTimerSheet(); return; } closeNow(); setTimeout(() => { if (k === 'change') { showView('sounds'); setTimeout(() => $('#sound-groups').scrollIntoView({ behavior: 'smooth', block: 'start' }), 150); } if (k === 'visual') { if (window.softwaveFocus) softwaveFocus.openChooser(); else showView('focus'); } }, 80); }));
  document.addEventListener('click', e => { if (e.target.closest('#fav-save, #mix-save, #save-mix-submit, [data-mm], [data-save], [data-save-session], [data-r="save"]')) { const b = e.target.closest('button'); b.classList.add('saved-pop'); setTimeout(() => b.classList.remove('saved-pop'), 520); } }, true);

  // ---------- Back: closes any open overlay first, then steps back through views ----------
  function goBack() {
    if (transit.active) { clearTransit(); }
    // 1. Topmost layered surface (sheet, Immerse, sleep screen) — one press, one layer.
    if (layers.stack.length) { layersClose(); return; }
    // 2. Full-screen surfaces that manage themselves.
    const overlays = [['#now', () => closeNowUI()], ['#sleep-screen', () => exitSleepUI()], ['#focus-screen', () => window.softwaveFocus && softwaveFocus.exitFocus()], ['#eyes-screen', () => window.softwaveLab && softwaveLab.stop()]];
    for (const [sel, close] of overlays) { const el = $(sel); if (el && !el.hidden) { close(); return; } }
    // 3. An open experiment panel — only when the Experiments view is actually on
    //    screen (a completed card parked in the hidden view must not swallow Back).
    const d = $('#lab-detail'), labView = $('#view-lab');
    if (d && !d.hidden && labView && !labView.hidden) {
      const lab = window.softwaveLab;
      // Fine-tune (Sound Sculptor opened from a completed result): Back does what its
      // own "← Back to your result" does — restore the card — never "stop and review".
      const br = d.querySelector('[data-back-result]');
      if (br) { br.click(); setTimeout(updateBackBtn, 120); return; }
      if (lab && lab.isRunning()) { lab.stop('Experiment stopped'); setTimeout(updateBackBtn, 120); return; }
      // On the Find My Sound tab the placard IS the page — it is the section's root.
      if (location.hash !== '#find') {
        const c = d.querySelector('[data-close]');
        if (c) { c.click(); setTimeout(updateBackBtn, 120); return; }
        d.hidden = true; d.innerHTML = ''; setTimeout(updateBackBtn, 120); return;
      }
    }
    // 4. A pushed step exists: undo it. At a section's main page there is none —
    //    Back stops here by design (the button hides itself via updateBackBtn).
    if (navDepth > 0 && location.hash) history.back();
  }
  $('#nav-back').addEventListener('click', goBack);
  document.addEventListener('keydown', e => { const tgt = e.target && e.target.matches ? e.target : document.body; if (e.key === 'Backspace' && !tgt.matches('input, textarea, select, [contenteditable]')) { e.preventDefault(); goBack(); } if (e.key === 'Escape' && transit.active) clearTransit(); });

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
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => { try { reg.update(); } catch (_) { } }).catch(() => { });
    // when a new version takes control, reload once so nobody is left on a stale shell (never while sound is playing)
    let reloaded = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloaded || !navigator.serviceWorker.controller) return; reloaded = true; if (!engine.isPlaying) location.reload(); });
  });

  window.softwaveApp = { renderPresetsRemount, loadPreset, saveCurrentMix, restoreMix, openSaveSheet, openManageMenu, openMixMenu, savedSessions, soundVol, SAVED_ICO, setMaster, togglePlay, toast, store, PRESETS, paintRange, showView, scheduleAutoAdvance, renderPresets: renderPresetsRemount };

  // ---------- init ----------
  renderSounds(); renderPresets(); renderMixer([]); updatePlayer(); renderProfileHooks(); if (window.SoftwaveField) syncField();
  showView((location.hash || '#sounds').slice(1), { push: false });
  // Deep links from the static pages: ?sound=<id> highlights a sound; ?preset=<id> highlights a preset.
  (function deepLinks() {
    const q = new URLSearchParams(location.search); const sid = q.get('sound'), pid = q.get('preset');
    if (q.get('exp')) { store.set('welcomed', true); welcome.hidden = true; showView('lab'); }
    if (q.get('snap') && fieldMain) { fieldMain.snap(); fieldBig.snap(); }
    if (q.get('demo') && fieldMain && engine.def(q.get('demo'))) { const id = q.get('demo'); store.set('welcomed', true); welcome.hidden = true; fieldMain.set([{ id, volume: 0.6 }]); fieldMain.snap(); fieldMain.playing = true; $('#field-name').textContent = engine.def(id).name; $('#field-desc').textContent = (FIELD.DESC[id] || ''); $('#field-controls').hidden = false; $('#field-core').classList.remove('idle'); $('#field-core').setAttribute('aria-pressed', 'true'); $('#field').dataset.state = 'playing'; document.body.dataset.atmo = ['brown', 'fire'].includes(id) ? 'warm' : id === 'night' ? 'dark' : ['rain', 'white'].includes(id) ? 'muted' : 'cool'; fieldMain.level = 0.3; }
    if (q.get('play') && engine.def(q.get('play'))) { store.set('welcomed', true); welcome.hidden = true; loadPreset({ name: engine.def(q.get('play')).name, mix: [{ id: q.get('play'), volume: 0.6 }], master: 0.35 }); }
    if (q.get('now')) { store.set('welcomed', true); welcome.hidden = true; openNow(); loadPreset(PRESETS.find(p => p.id === q.get('now')) || PRESETS[0]); }
    if (sid && engine.def(sid) && !engine.def(sid).lab) { store.set('welcomed', true); welcome.hidden = true; showView('sounds'); const card = $(`.sound-card[data-id="${sid}"]`); if (card) { card.classList.add('highlight'); setTimeout(() => { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('.card-btn', card).focus(); toast(`Tap ${engine.def(sid).name} to play it — it starts quietly.`, 4000); }, 250); } }
    if (pid) { const p = PRESETS.find(x => x.id === pid); if (p) { store.set('welcomed', true); welcome.hidden = true; showView('sounds'); setTimeout(() => { const chip = $(`#presets [data-preset="${pid}"]`); if (chip) { chip.classList.add('active'); chip.focus(); toast(`Tap “${p.name}” to start the preset.`, 4000); } }, 250); } }
  })();
})();
