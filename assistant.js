/* Find My Quiet Sound — "Ask Find My Quiet Sound" (Phase 1: typed, fully local).
   An intelligent control layer, not a chatbot: natural requests become validated
   actions executed by the existing product. Architecture:
   - Deterministic local parser (no network, works offline, zero privacy impact).
   - Strict allowlisted actions; the app validates and executes — never the parser.
   - Every entitlement path goes through the existing systems (engine layer limits,
     save limits, premium gates, Moments gate) — this is an interface, not authority.
   - Undo snapshots the whole environment before each command group.
   - A future cloud tier (window.softwaveIntent) may translate harder phrasings into
     THE SAME action schema via a serverless proxy — never with a client-side key,
     never sending profile or health data. Until that backend exists, unknown
     phrasings get a gentle local fallback. No medical output is possible by
     construction: the parser only maps to product actions and fixed safe copy. */
(function () {
  'use strict';
  const boot = () => {
    const app = window.softwaveApp, engine = window.softwave, profile = window.softwaveProfile;
    if (!app || !engine || !document.getElementById('assistant-slot')) { setTimeout(boot, 200); return; }
    const $ = (s, r = document) => r.querySelector(s);
    const store = app.store;
    const M = () => window.softwaveMonetization;
    const track = (e) => { if (M()) M().track(e); };

    // ---------- sound lexicon (ids must exist in the engine) ----------
    const LEX = [
      ['white', 'white noise', 'white'], ['pink', 'pink noise', 'pink'], ['brown', 'brown noise', 'brown'],
      ['static', 'gentle static', 'static'], ['hiss', 'soft hiss', 'hiss'],
      ['glassrain', 'rain on window', 'rain on the window', 'window rain', 'rain on glass'],
      ['rain', 'rain'], ['ocean', 'ocean', 'waves', 'sea'], ['lapping', 'lapping water', 'lapping', 'lake', 'shore'],
      ['stream', 'flowing water', 'stream', 'river', 'creek'], ['waterfall', 'waterfall'],
      ['forest', 'forest', 'woods'], ['leaves', 'rustling leaves', 'leaves', 'leaf'],
      ['crickets', 'crickets', 'cricket'], ['cicadas', 'cicadas', 'cicada'],
      ['summernight', 'summer night'], ['night', 'night sounds', 'night'],
      ['wind', 'wind', 'breeze'], ['fan', 'fan'], ['fire', 'fireplace', 'fire', 'campfire'],
    ];
    const findSound = (t) => { for (const [id, ...names] of LEX) for (const n of names) if (t.includes(n)) return { id, name: engine.def(id).name }; return null; };

    // ---------- warmth ladder (shared with Tuned to You's range; always reversible) ----------
    const TONES = [20000, 14000, 11000, 8500];
    const toneStep = (dir) => {
      const cur = engine.masterFilter ? engine.masterFilter.frequency.value : 20000;
      let i = TONES.reduce((best, v, idx) => Math.abs(v - cur) < Math.abs(TONES[best] - cur) ? idx : best, 0);
      i = Math.max(0, Math.min(TONES.length - 1, i + dir));
      engine.setMasterTone(TONES[i], 0.5);
    };

    // ---------- undo ----------
    let undoState = null;
    function snapshot() {
      undoState = { mix: engine.snapshot(), master: engine.masterVolume, timerMin: engine.timer.durationMin, visual: store.get('visual', null), variation: engine.variation.amount };
    }
    async function undo() {
      if (!undoState) return app.toast('Nothing to undo yet.');
      const u = undoState; undoState = null;
      if (u.mix.length) await engine.loadMix(u.mix); else engine.stopAll();
      app.setMaster(u.master);
      if (u.timerMin) engine.setTimer(u.timerMin, true); else engine.clearTimer();
      if (u.visual && window.softwaveFocus) softwaveFocus.setVisual(u.visual);
      engine.setVariation(u.variation || 0);
      track('ai_command_undone');
      confirmLines(['✓ Undone — back to how it was'], false);
    }

    // ---------- the strict action executor (validates everything) ----------
    const ok = [];
    const A = {
      async play_sound(p) { if (!engine.def(p.id)) return; await engine.loadMix([{ id: p.id, volume: 0.55 }]); ok.push('Playing ' + engine.def(p.id).name); },
      async add_layer(p) { if (!engine.def(p.id)) return; const v = Math.max(0.1, Math.min(0.7, p.level || 0.35)); const r = await engine.startSound(p.id, v); ok.push(r === false ? 'Could not add ' + engine.def(p.id).name + ' (layer limit)' : 'Added ' + engine.def(p.id).name + (v <= 0.28 ? ' (light)' : '')); },
      async remove_layer(p) { if (engine.isActive(p.id)) { engine.stopSound(p.id); ok.push('Removed ' + engine.def(p.id).name); } else ok.push(engine.def(p.id).name + ' is not playing'); },
      async layer_volume(p) { if (!engine.isActive(p.id)) return ok.push(engine.def(p.id).name + ' is not playing'); const s = engine.activeList().find(x => x.id === p.id); const v = Math.max(0.05, Math.min(1, s.volume + p.delta)); engine.setVolume(p.id, v); ok.push((p.delta < 0 ? 'Lowered ' : 'Raised ') + engine.def(p.id).name + ' to ' + Math.round(v * 100) + '%'); },
      async stop_all() { engine.stopAll(); ok.push('Stopped everything'); },
      async master_volume(p) { const v = p.set != null ? p.set : engine.masterVolume + p.delta; app.setMaster(Math.max(0, Math.min(1, v))); ok.push('Volume ' + Math.round(Math.max(0, Math.min(1, v)) * 100) + '%'); },
      async warmer() { toneStep(1); ok.push('Made it warmer'); },
      async brighter() { toneStep(-1); ok.push('Made it brighter'); },
      async steadier() { engine.setVariation(0); ok.push('Made it steadier'); },
      async more_movement() { engine.setVariation(0.22, 9); ok.push('Added gentle movement'); },
      async set_timer(p) { const m = Math.max(1, Math.min(720, p.minutes)); engine.setTimer(m, true); ok.push('Timer set for ' + m + ' min with gentle fade'); },
      async clear_timer() { engine.clearTimer(); ok.push('Timer cleared'); },
      async start_moment(p) { const P = window.softwavePersonal; if (P && P.hasProfile()) { const r = await P.runMoment(p.id); ok.push(r ? 'Started ' + ({ quiet: 'Your Quiet', sleep: 'Your Sleep', focus: 'Your Focus', night: 'Woke Up at Night' })[p.id] : 'Could not start that Moment'); } else { const fallback = { quiet: [{ id: 'brown', volume: 0.5 }], sleep: [{ id: 'brown', volume: 0.5 }, { id: 'rain', volume: 0.3 }], focus: [{ id: 'pink', volume: 0.5 }, { id: 'forest', volume: 0.3 }], night: [{ id: 'brown', volume: 0.4 }] }[p.id]; if (engine.masterVolume > (p.id === 'night' ? 0.22 : 0.35)) app.setMaster(p.id === 'night' ? 0.22 : 0.35); await engine.loadMix(fallback); if (p.id === 'sleep') { engine.setTimer(60, true); app.showView('sleep'); } if (p.id === 'night') engine.setTimer(30, true); ok.push('Started a gentle ' + p.id + ' mix — run Find My Sound and this becomes personal'); } },
      async change_visual(p) { const F = window.softwaveFocus; if (!F) return; if (p.calmer) { store.set('motion', 'low'); ok.push('Visual set calmer'); return; } const all = F.visuals; const cur = store.get('visual', 'ocean'); const idx = all.findIndex(v => v.id === cur); const next = all[(idx + 1) % all.length]; F.setVisual(next.id); ok.push('Visual: ' + next.name); },
      async save_environment() { if (!engine.activeList().length) return ok.push('Start some sounds first, then say save'); const combos = store.get('combos', []); if (M() && !M().canCreateSavedItem(combos.length)) { if (window.softwavePremium) softwavePremium.saveLimit('environments'); return ok.push('Save limit reached'); } combos.push({ name: 'My saved environment', mix: engine.snapshot(), master: engine.masterVolume, visual: store.get('visual', 'ocean'), motion: store.get('motion', 'low'), timer: engine.timer.durationMin || 0 }); store.set('combos', combos); track('environment_saved'); ok.push('Saved (Visual Focus → My environments)'); },
      async help_find() { app.showView('find'); ok.push('Opening Find My Sound — it learns what you prefer'); },
      async something_different() { const act = new Set(engine.activeList().map(s => s.id)); const pool = engine.defs().map(d => d.id).filter(id => !act.has(id)); const id = pool[Math.floor(Math.random() * pool.length)]; await engine.loadMix([{ id, volume: 0.55 }]); ok.push('Trying ' + engine.def(id).name); },
    };

    // ---------- the local parser: text → validated actions ----------
    const MEDICAL = /\b(cure|treat|diagnos|prescri|hearing loss|therapy for|medical|what frequency is my|why do i have|is my tinnitus|getting worse|damage)\b/;
    function parse(raw) {
      const t = ' ' + raw.toLowerCase().replace(/[.,!?;]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
      if (/^\s*(undo|go back|put it back)\s*$/.test(t.trim())) return { undo: true };
      if (MEDICAL.test(t)) return { medical: true };
      const acts = [];
      // moments / situations first (they set the base environment)
      if (/(for sleep|to sleep|sleepy|my sleep|going to bed|bedtime)/.test(t)) acts.push(['start_moment', { id: 'sleep' }]);
      else if (/(woke up|middle of the night|wake at night|very gentle|extra gentle)/.test(t)) acts.push(['start_moment', { id: 'night' }]);
      else if (/(for focus|to focus|for work|concentrat|my focus|studying|for reading)/.test(t)) acts.push(['start_moment', { id: 'focus' }]);
      else if (/(my quiet|something for me)/.test(t)) acts.push(['start_moment', { id: 'quiet' }]);
      if (/(help me find|find (me )?a sound|find my sound|don'?t know what|not sure what|discover)/.test(t)) return { actions: [['help_find', {}]] };
      // timers
      const tm = t.match(/(\d+)\s*(minutes|minute|min|mins)\b/); const th = t.match(/(\d+|an|one)\s*(hours|hour|hr)\b/);
      if (/(stop|cancel|clear).{0,8}timer/.test(t)) acts.push(['clear_timer', {}]);
      else if (tm) acts.push(['set_timer', { minutes: +tm[1] }]);
      else if (th) acts.push(['set_timer', { minutes: (th[1] === 'an' || th[1] === 'one' ? 1 : +th[1]) * 60 }]);
      // per-sound verbs
      const light = /(a little|a bit of|light|some|a touch of|slight)/.test(t);
      let m;
      if ((m = matchSound(t, /(?:less|quieter|lower|turn down|softer)\s+(?:the\s+)?/))) acts.push(['layer_volume', { id: m.id, delta: -0.15 }]);
      else if ((m = matchSound(t, /(?:more|louder|raise|turn up)\s+(?:the\s+)?/))) acts.push(['layer_volume', { id: m.id, delta: 0.15 }]);
      if ((m = matchSound(t, /(?:remove|without|take out|take away|drop|no more|stop the)\s+(?:the\s+)?/))) acts.push(['remove_layer', { id: m.id }]);
      else if ((m = matchSound(t, /(?:add|with|include|put in|layer)\s+(?:a little |a bit of |some |a touch of |light |the )?/))) acts.push(['add_layer', { id: m.id, level: light ? 0.25 : 0.35 }]);
      else if ((m = matchSound(t, /(?:play|start|put on|give me|i want)\s+(?:the |some |a little )?/))) { if (!acts.some(a => a[0] === 'start_moment')) acts.push(['play_sound', { id: m.id }]); else acts.push(['add_layer', { id: m.id, level: light ? 0.25 : 0.35 }]); }
      else if (!acts.length && (m = findSound(t)) && t.trim().split(' ').length <= 4) acts.push(['play_sound', { id: m.id }]);   // bare "rain on window"
      // character
      if (/(warmer|less bright|too bright|less sharp|too sharp|softer sound|mellow)/.test(t)) acts.push(['warmer', {}]);
      if (/(brighter|more bright|crisper|less muffled|too muffled|too dull)/.test(t)) acts.push(['brighter', {}]);
      if (/(steadier|more steady|less movement|too busy|calmer sound|more constant)/.test(t)) acts.push(['steadier', {}]);
      if (/(more movement|more alive|more dynamic|more variation|less static\b)/.test(t)) acts.push(['more_movement', {}]);
      // visual
      if (/(calmer|slower).{0,12}visual|visual.{0,12}(calmer|slower)/.test(t)) acts.push(['change_visual', { calmer: true }]);
      else if (/(change|different|another|new).{0,12}visual|visual.{0,12}(change|different)/.test(t)) acts.push(['change_visual', {}]);
      // globals
      if (/^\s*(stop|silence|quiet please|turn (it )?off)\s*$/.test(t.trim()) || /\bstop everything\b/.test(t)) acts.push(['stop_all', {}]);
      const vp = t.match(/volume\s*(?:to\s*)?(\d{1,3})\s*%?/);
      if (vp) acts.push(['master_volume', { set: Math.min(100, +vp[1]) / 100 }]);
      else if (/(volume down|quieter overall|softer overall|too loud|\bsofter\b(?!.{0,12}sound))/.test(t) && !acts.some(a => a[0] === 'layer_volume')) acts.push(['master_volume', { delta: -0.1 }]);
      else if (/(volume up|louder overall|can'?t hear|too quiet)/.test(t)) acts.push(['master_volume', { delta: 0.1 }]);
      if (/\bsave (this|it|environment)?\b/.test(t)) acts.push(['save_environment', {}]);
      if (/(something (else|different|new)|surprise me|change it up)/.test(t) && !acts.some(a => a[0] === 'play_sound' || a[0] === 'start_moment')) acts.push(['something_different', {}]);
      if (/(make it better|improve|nicer)/.test(t) && !acts.length) return { clarify: true };
      return { actions: acts };
      function matchSound(text, verbRe) {
        for (const [id, ...names] of LEX) for (const n of names) { const re = new RegExp(verbRe.source + n.replace(/ /g, '\\s+') + '\\b'); if (re.test(text)) return { id }; }
        return null;
      }
    }

    // ---------- run a command ----------
    async function run(raw) {
      const req = raw.trim(); if (!req) return;
      const parsed = parse(req);
      if (parsed.undo) { await undo(); return; }
      if (parsed.medical) { confirmLines(['I can adjust sounds and settings, but I can’t give medical advice. The Learn section covers sound and tinnitus carefully — and for symptoms, a doctor or audiologist is the right person.'], false); return; }
      if (parsed.clarify) { confirmLines(['Try being specific: “warmer”, “softer”, “more movement”, or “something different”.'], false); return; }
      if (!parsed.actions || !parsed.actions.length) { track('ai_command_failed'); confirmLines(['I didn’t catch that. Try things like “play rain”, “make it warmer”, “add a little ocean”, “set a timer for 30 minutes”, or “give me something for sleep”.'], false); return; }
      snapshot();
      ok.length = 0;
      for (const [type, params] of parsed.actions) { try { await A[type](params); } catch (e) { console.error('assistant action failed', type, e); } }
      track('ai_command_completed');
      confirmLines(ok.map(l => '✓ ' + l), true);
    }

    // ---------- UI ----------
    const slot = $('#assistant-slot');
    slot.innerHTML = `
      <div class="ask-wrap">
        <button id="ask-open" class="linklike ask-opener">✨ Ask Find My Quiet Sound</button>
        <form id="ask-form" hidden>
          <label class="sr-only" for="ask-input">Tell Find My Quiet Sound what you would like</label>
          <input id="ask-input" type="text" maxlength="140" placeholder="What would you like? — e.g. “something warm for sleep, 45 minutes”" autocomplete="off">
          <button class="btn btn-primary btn-sm" type="submit">Go</button>
        </form>
        <div id="ask-out" role="status" aria-live="polite"></div>
      </div>`;
    const form = $('#ask-form'), input = $('#ask-input'), out = $('#ask-out'), opener = $('#ask-open');
    opener.addEventListener('click', () => { form.hidden = false; opener.hidden = true; input.focus(); track('ai_assistant_opened'); });
    form.addEventListener('submit', async e => { e.preventDefault(); const v = input.value; input.value = ''; await run(v); });
    input.addEventListener('keydown', e => { if (e.key === 'Escape') { form.hidden = true; opener.hidden = false; out.innerHTML = ''; opener.focus(); } });
    function confirmLines(lines, withUndo) {
      out.innerHTML = lines.map(l => `<div class="ask-line">${l}</div>`).join('') + (withUndo ? '<button class="btn btn-ghost btn-sm" id="ask-undo">Undo</button>' : '');
      const u = $('#ask-undo', out); if (u) u.addEventListener('click', undo);
      clearTimeout(confirmLines._t); confirmLines._t = setTimeout(() => { if (!out.contains(document.activeElement)) out.innerHTML = ''; }, 14000);
    }

    window.softwaveAssistant = { run, undo, parse };   // parse exposed for testing; run for future voice tier
  };
  boot();
})();
