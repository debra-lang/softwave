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
      ['rain', 'rain', 'storm', 'rainstorm', 'drizzle'], ['ocean', 'ocean', 'waves', 'sea', 'beach', 'seaside'], ['lapping', 'lapping water', 'lapping', 'lake', 'shore'],
      ['stream', 'flowing water', 'stream', 'river', 'creek', 'brook', 'running water'], ['waterfall', 'waterfall'],
      ['forest', 'forest', 'woods', 'birds', 'jungle'], ['leaves', 'rustling leaves', 'leaves', 'leaf'],
      ['crickets', 'crickets', 'cricket', 'insects', 'bugs'], ['cicadas', 'cicadas', 'cicada'],
      ['summernight', 'summer night', 'summer evening'], ['night', 'night sounds', 'night', 'nighttime'],
      ['wind', 'wind', 'breeze'], ['fan', 'fan', 'air conditioner', 'air con'], ['fire', 'fireplace', 'fire', 'campfire', 'bonfire'],
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
      async stop_all() { (window.softwaveStopAll || engine.stopAll.bind(engine))(); ok.push('Stopped everything'); },
      async now_playing() { const l = engine.activeList().map(s => engine.def(s.id).name); ok.push(l.length ? 'Playing: ' + l.join(' + ') + ' · volume ' + Math.round(engine.masterVolume * 100) + '%' : 'Nothing is playing right now'); },
      async pause_all() { await engine.pauseAll(); ok.push('Paused — say “resume” to continue'); },
      async resume_all() { await engine.playAll(); ok.push('Resumed'); },
      async master_volume(p) {
        // Conservative volume policy for assistant-driven changes (manual sliders are unrestricted):
        // - out-of-range or "maximum" requests are REJECTED, never converted to 100%
        // - explicit increases move at most +30 points per command
        // - relative increases are gradual (+5, "much louder" +10) and stop at 90%
        // - decreases are always honoured in full
        const cur = engine.masterVolume;
        if (p.reject) { ok.push(p.reject); return; }
        if (p.set != null) {
          if (p.set < 0 || p.set > 1) { ok.push('That level isn’t available — try “volume 80%” or lower.'); return; }
          if (p.set > cur + 0.30) { const to = Math.min(1, cur + 0.30); app.setMaster(to); ok.push('Raised to ' + Math.round(to * 100) + '% — for a bigger increase, please use the volume slider.'); return; }
          app.setMaster(p.set); ok.push('Volume ' + Math.round(p.set * 100) + '%'); return;
        }
        let d = p.delta || 0;
        if (d > 0) {
          if (cur >= 0.90) { ok.push('Already at a high level — please use the volume slider for more.'); return; }
          const v = Math.min(0.90, cur + Math.min(d, 0.10));
          app.setMaster(v); ok.push('A little louder — ' + Math.round(v * 100) + '%'); return;
        }
        const v = Math.max(0, cur + d);
        app.setMaster(v); ok.push('Softer — ' + Math.round(v * 100) + '%');
      },
      async warmer() { toneStep(1); ok.push('Made it warmer'); },
      async brighter() { toneStep(-1); ok.push('Made it brighter'); },
      async steadier() { engine.setVariation(0); ok.push('Made it steadier'); },
      async more_movement() { engine.setVariation(0.22, 9); ok.push('Added gentle movement'); },
      async set_timer(p) { const m = Math.max(1, Math.min(720, p.minutes)); engine.setTimer(m, true); ok.push('Timer set for ' + m + ' min with gentle fade'); },
      async clear_timer() { engine.clearTimer(); ok.push('Timer cleared'); },
      async start_moment(p) { const P = window.softwavePersonal; if (P && P.hasProfile()) { const r = await P.runMoment(p.id); ok.push(r ? 'Started ' + ({ quiet: 'Your Quiet', sleep: 'Your Sleep', focus: 'Your Focus', night: 'Woke Up at Night' })[p.id] : 'Could not start that Moment'); } else { const fallback = { quiet: [{ id: 'brown', volume: 0.5 }], sleep: [{ id: 'brown', volume: 0.5 }, { id: 'rain', volume: 0.3 }], focus: [{ id: 'pink', volume: 0.5 }, { id: 'forest', volume: 0.3 }], night: [{ id: 'brown', volume: 0.4 }] }[p.id]; if (engine.masterVolume > (p.id === 'night' ? 0.22 : 0.35)) app.setMaster(p.id === 'night' ? 0.22 : 0.35); await engine.loadMix(fallback); if (p.id === 'sleep') { engine.setTimer(60, true); app.showView('sleep'); } if (p.id === 'night') engine.setTimer(30, true); ok.push('Started a gentle ' + p.id + ' mix — run Find My Sound and this becomes personal'); } },
      async change_visual(p) { const F = window.softwaveFocus; if (!F) return; if (p.calmer) { store.set('motion', 'low'); ok.push('Visual set calmer'); return; } const all = F.visuals; const cur = store.get('visual', 'underwater'); const idx = all.findIndex(v => v.id === cur); const next = all[(idx + 1) % all.length]; F.setVisual(next.id); ok.push('Visual: ' + next.name); },
      async save_environment() { if (!engine.activeList().length) return ok.push('Start some sounds first, then say save'); const combos = store.get('combos', []); if (M() && !M().canCreateSavedItem(combos.length)) { if (window.softwavePremium) softwavePremium.saveLimit('environments'); return ok.push('Save limit reached'); } combos.push({ name: 'My saved environment', mix: engine.snapshot(), master: engine.masterVolume, visual: store.get('visual', 'ocean'), motion: store.get('motion', 'low'), timer: engine.timer.durationMin || 0 }); store.set('combos', combos); track('environment_saved'); ok.push('Saved (Visual Focus → My Saved Environments)'); },
      async help_find() { app.showView('find'); ok.push('Opening Find My Sound — it learns what you prefer'); },
      async play_character(p) {
        // "something warm / deep and steady / bright with movement": sculpt a sound to the asked
        // character, starting from the user's learned profile when one exists.
        const base = (profile && profile.params()) ? Object.assign({}, profile.params()) : { colour: 0.4, warm: 0, deep: 0, smooth: 0, soft: 0, width: 0.4, moving: 0.15, rich: 0.2, mod: 0 };
        delete base.nature;
        const T = p.traits, adj = (k, d) => { base[k] = Math.max(k === 'colour' ? 0 : -1, Math.min(1, (base[k] || 0) + d)); };
        if (T.includes('warm')) { adj('warm', -0.5); base.colour = Math.min(base.colour, 0.35); }
        if (T.includes('bright')) { adj('warm', 0.45); base.colour = Math.max(base.colour, 0.7); }
        if (T.includes('deep') || T.includes('dark') || T.includes('low')) { base.colour = Math.min(base.colour, 0.18); adj('deep', -0.4); }
        if (T.includes('airy') || T.includes('high') || T.includes('light')) { adj('deep', 0.5); base.colour = Math.max(base.colour, 0.6); }
        if (T.includes('soft') || T.includes('gentle')) adj('soft', -0.5);
        if (T.includes('moving') || T.includes('alive')) base.moving = Math.max(base.moving, 0.5);
        if (T.includes('steady') || T.includes('calm')) { base.moving = 0; base.mod = 0; }
        if (T.includes('rich') || T.includes('full')) base.rich = Math.max(base.rich, 0.6);
        engine.setSculpt(base, 'sculpt');
        await engine.loadMix([{ id: 'sculpt', volume: 0.55, balance: 0, params: base }]);
        if (app.noteAskBed) app.noteAskBed();   // a sound chosen on the Sounds page replaces this bed instead of layering on it
        ok.push('Playing My Sound — a ' + T.join(', ') + ' noise blend' + ((profile && profile.params()) ? ', shaped from your preferences' : '') + '. You can stop it anytime using Stop, or say “warmer”, “softer” or “more movement” to adjust');
      },
      async something_different() {
        // With a profile: keep the user's learned sound, swap the texture to one they haven't
        // just had — a meaningful variation, not a lottery. Without one: a fresh library sound.
        const act = new Set(engine.activeList().map(s => s.id));
        if (profile && profile.params()) {
          const textures = ['rain', 'ocean', 'wind', 'forest', 'stream', 'crickets', 'lapping', 'leaves', 'glassrain', 'fire'].filter(id => !act.has(id));
          const tx = textures[Math.floor(Math.random() * textures.length)];
          const mix = profile.mix() || [];
          const base = mix.filter(s => s.id === 'sculpt');
          await engine.loadMix(base.concat([{ id: tx, volume: 0.32, balance: 0 }]));
          ok.push('Your sound with ' + engine.def(tx).name.toLowerCase() + ' instead');
        } else {
          const pool = engine.defs().map(d => d.id).filter(id => !act.has(id));
          const id = pool[Math.floor(Math.random() * pool.length)];
          await engine.loadMix([{ id, volume: 0.55 }]);
          ok.push('Trying ' + engine.def(id).name);
        }
      },
    };

    // ---------- the local parser: text → validated actions ----------
    const MEDICAL = /\b(cure|treat|diagnos|prescri|hearing loss|therapy for|medical|what frequency is my|why do i have|is my tinnitus|getting worse|damage)\b/;
    // Spoken numbers arrive as words on some platforms — normalize the common ones.
    const NUMWORDS = [['forty five', '45'], ['forty-five', '45'], ['an hour and a half', '90 minutes'], ['half an hour', '30 minutes'], ['one', '1'], ['five', '5'], ['ten', '10'], ['fifteen', '15'], ['twenty', '20'], ['thirty', '30'], ['forty', '40'], ['fifty', '50'], ['sixty', '60'], ['ninety', '90']];
    function normalizeNumbers(t) { for (const [w, d] of NUMWORDS) t = t.replace(new RegExp('\\b' + w + '\\b', 'g'), d); return t; }
    function parse(raw) {
      // Common typos and speech-to-text slips: "ply/plying" for "play/playing".
      const t = normalizeNumbers(' ' + raw.toLowerCase().replace(/[.,!?;]/g, ' ').replace(/\bplying\b/g, 'playing').replace(/\bply\b/g, 'play').replace(/\s+/g, ' ').trim() + ' ');
      if (/^\s*(undo( that| it| last)?|go back|put it back)\s*$/.test(t.trim())) return { undo: true };
      if (/^\s*(help|what can (i say|you do)|show examples|examples)\s*\??\s*$/.test(t.trim())) return { help: true };
      if (MEDICAL.test(t)) return { medical: true };
      const acts = [];
      // moments / situations first (they set the base environment)
      if (/(for sleep|to sleep|sleepy|my sleep|going to bed|bedtime|for a nap|can'?t sleep|fall asleep)/.test(t)) acts.push(['start_moment', { id: 'sleep' }]);
      else if (/(woke up|middle of the night|wake at night|very gentle|extra gentle)/.test(t)) acts.push(['start_moment', { id: 'night' }]);
      else if (/(for focus|to focus|for work|concentrat|my focus|studying|for reading|while i work|for background)/.test(t)) acts.push(['start_moment', { id: 'focus' }]);
      else if (/(my quiet|something for me|to relax|for relax|calm (me )?down|to unwind|meditat)/.test(t)) acts.push(['start_moment', { id: 'quiet' }]);
      if (/(help me find|find (me )?a sound|find my sound|don'?t know what|not sure what|discover)/.test(t)) return { actions: [['help_find', {}]] };
      // character requests: "play something warm", "something deep and steady", "give me something bright"
      if (!acts.length && /\b(something|a sound|anything)\b/.test(t) && !findSound(t)) {
        const tt = t.replace(/\b(cozy|cosy|mellow)\b/g, 'warm').replace(/\bcrisp\b/g, 'bright').replace(/\bsmooth\b/g, 'soft').replace(/\b(relaxing|peaceful|soothing|calming)\b/g, 'soft steady').replace(/\bdarker\b/g, 'dark').replace(/\blighter\b/g, 'light');
        const traits = ['warm', 'bright', 'deep', 'dark', 'low', 'airy', 'high', 'light', 'soft', 'gentle', 'moving', 'alive', 'steady', 'calm', 'rich', 'full'].filter(w => new RegExp('\\b' + w + '\\b').test(tt));
        if (traits.length) acts.push(['play_character', { traits }]);
      }
      // timers
      const tm = t.match(/(\d+)\s*(minutes|minute|min|mins)\b/); const th = t.match(/(\d+|an|one)\s*(hours|hour|hr)\b/);
      const tb = t.match(/\btimer\s*(?:to|for|at)?\s*(\d{1,3})\b/);   // "timer 30"
      if (/(stop|cancel|clear).{0,8}timer/.test(t)) acts.push(['clear_timer', {}]);
      else if (tm) acts.push(['set_timer', { minutes: +tm[1] }]);
      else if (th) acts.push(['set_timer', { minutes: (th[1] === 'an' || th[1] === 'one' ? 1 : +th[1]) * 60 }]);
      else if (tb) acts.push(['set_timer', { minutes: +tb[1] }]);
      else if (/\bsleep timer\b/.test(t)) acts.push(['set_timer', { minutes: 60 }]);
      // per-sound verbs — detected independently so "give me ocean with crickets" plays ocean AND adds crickets
      const light = /(a little|a bit of|light|some|a touch of|slight)/.test(t);
      // volume verbs work in both orders: "lower the rain" and "make the rain quieter"
      let lessM = matchSound(t, /(?:less|quieter|lower|turn down|softer)\s+(?:the\s+)?/);
      let moreM = matchSound(t, /(?:more|louder|raise|turn up)\s+(?:the\s+)?/);
      if (!lessM && !moreM) for (const [id, ...names] of LEX) {
        for (const n of names) {
          const nn = n.replace(/ /g, '\\s+');
          if (new RegExp('\\b' + nn + '\\b.{0,12}\\b(quieter|softer|lower|down)\\b').test(t)) { lessM = { id }; break; }
          if (new RegExp('\\b' + nn + '\\b.{0,12}\\b(louder|up|stronger)\\b').test(t)) { moreM = { id }; break; }
        }
        if (lessM || moreM) break;
      }
      const remM = matchSound(t, /(?:remove|without|take out|take away|drop|no more|stop(?:\s+playing)?|turn off|don'?t want|do not want|get rid of|enough with)\s+(?:the\s+)?/);
      const addM = matchSound(t, /(?:add|with|include|put in|layer)\s+(?:a little |a bit of |some |a touch of |light |the |an |a )?/);
      const playM = matchSound(t, /(?:play|start|put on|give me|i want|hear|listen to|have)\s+(?:the sound of a |the sound of |a little |the |some |an |a )?/);
      if (lessM) acts.push(['layer_volume', { id: lessM.id, delta: -0.15 }]);
      else if (moreM) acts.push(['layer_volume', { id: moreM.id, delta: 0.15 }]);
      if (playM && (!addM || addM.id !== playM.id) && (!remM || remM.id !== playM.id) && (!lessM || lessM.id !== playM.id)) {
        if (!acts.some(a => a[0] === 'start_moment')) acts.push(['play_sound', { id: playM.id }]);
        else acts.push(['add_layer', { id: playM.id, level: light ? 0.25 : 0.35 }]);
      }
      if (addM && (!remM || remM.id !== addM.id) && (!lessM || lessM.id !== addM.id)) acts.push(['add_layer', { id: addM.id, level: light ? 0.25 : 0.35 }]);
      if (remM) acts.push(['remove_layer', { id: remM.id }]);
      let m;
      if (!acts.length && (m = findSound(t)) && t.trim().split(' ').length <= 4 && !/(louder|softer|quieter|warmer|brighter|steadier|too )/.test(t)) acts.push(['play_sound', { id: m.id }]);   // bare "rain on window"
      // character
      if (/(warmer|more warm|less bright|too bright|less sharp|too sharp|softer sound|mellow|more bass|\bdeeper\b|more deep|too thin)/.test(t)) acts.push(['warmer', {}]);
      if (/(brighter|more bright|crisper|less muffled|too muffled|too dull)/.test(t)) acts.push(['brighter', {}]);
      if (/(steadier|more steady|less movement|too busy|calmer sound|more constant)/.test(t)) acts.push(['steadier', {}]);
      if (/(more movement|more alive|more dynamic|more variation|less static\b)/.test(t)) acts.push(['more_movement', {}]);
      // visual
      if (/(calmer|slower).{0,12}visual|visual.{0,12}(calmer|slower)/.test(t)) acts.push(['change_visual', { calmer: true }]);
      else if (/(change|different|another|new).{0,12}visual|visual.{0,12}(change|different)/.test(t)) acts.push(['change_visual', {}]);
      // per-sound "too loud/sharp" — a comfort complaint about a layer lowers THAT layer, never the whole mix
      for (const [id, ...names] of LEX) {
        if (acts.some(a => a[0] === 'layer_volume')) break;
        for (const n of names) if (new RegExp('\\b' + n.replace(/ /g, '\\s+') + '\\b.{0,14}too (loud|sharp|strong|much|bright)').test(t)) { acts.push(['layer_volume', { id, delta: -0.15 }]); break; }
      }
      // globals
      if (/^\s*(stop( playing| the sounds?| the music| the sound| it| everything| all)?|silence|quiet please|be quiet|turn (it |the sound |everything )?off)\s*$/.test(t.trim()) || /\bstop everything\b/.test(t)) acts.push(['stop_all', {}]);
      else if (/^\s*(pause( it| playing| the sound)?|hold on)\s*$/.test(t.trim())) acts.push(['pause_all', {}]);
      else if (/^\s*(resume|continue|unpause|keep going|play again|keep playing|start again)\s*$/.test(t.trim())) acts.push(['resume_all', {}]);
      if (/(what'?s playing|what is playing|what am i (listening to|hearing)|what is this( sound)?|what sound is (this|playing)|which sounds? (is|are) (this|playing|on))/.test(t)) acts.push(['now_playing', {}]);
      if (/(maximum volume|full volume|max volume|loudest|as loud as)/.test(t)) acts.push(['master_volume', { reject: 'For comfort, I only make gradual increases — the volume slider is there for large changes.' }]);
      else {
        const vp = t.match(/volume\s*(?:to\s*)?(-?\s?\d{1,3})\s*(?:%|percent)?/);
        const negWords = /volume\s+(?:to\s+)?(negative|minus)/.test(t);
        if (negWords) acts.push(['master_volume', { reject: 'That level isn’t available — try “volume 20%”.' }]);
        else if (vp) { const n = +vp[1].replace(/\s/g, ''); acts.push(['master_volume', n < 0 || n > 100 ? { reject: 'That level isn’t available — try “volume 80%” or lower.' } : { set: n / 100 }]); }
        else if (/(much softer|much quieter|way too loud)/.test(t) && !acts.some(a => a[0] === 'layer_volume')) acts.push(['master_volume', { delta: -0.15 }]);
        else if (/(volume down|turn (it|this) down|lower the volume|lower it\b|quiet it down|bring it down|more quiet|quieter overall|softer overall|too loud|\bsofter\b(?!.{0,12}sound))/.test(t) && !acts.some(a => a[0] === 'layer_volume')) acts.push(['master_volume', { delta: -0.1 }]);
        else if (/(much louder|a lot louder)/.test(t)) acts.push(['master_volume', { delta: 0.1 }]);
        else if (/(\blouder\b|volume up|turn (it|this) up|raise the volume|can'?t hear|too quiet)/.test(t) && !acts.some(a => a[0] === 'layer_volume')) acts.push(['master_volume', { delta: 0.05 }]);
      }
      if (/\bsave( this| it| environment)?\b/.test(t) && !/\bsaved\b/.test(t)) acts.push(['save_environment', {}]);
      if (/(something (else|different|new)|surprise me|change it up)/.test(t) && !acts.some(a => a[0] === 'play_sound' || a[0] === 'start_moment')) acts.push(['something_different', {}]);
      if (/(make it better|improve|nicer)/.test(t) && !acts.length) return { clarify: true };
      // a sound verb with a name we don't recognise deserves a specific answer, not a generic one
      if (!acts.length && /\b(add|play|put on|give me|start)\b/.test(t) && !findSound(t) && !/\b(something|anything|music)\b/.test(t)) return { unknownSound: true };
      return { actions: acts };
      function matchSound(text, verbRe) {
        for (const [id, ...names] of LEX) for (const n of names) { const re = new RegExp(verbRe.source + n.replace(/ /g, '\\s+') + '\\b'); if (re.test(text)) return { id }; }
        // One-typo tolerance: the word right after the verb may be a slightly misspelled sound
        // name ("cickets", "ran"). Only single-word aliases of 4+ letters, edit distance 1.
        const mm = new RegExp(verbRe.source + '([a-z]+)').exec(text);
        if (mm) {
          const w = mm[1];
          if (w.length >= 3) for (const [id, ...names] of LEX) for (const n of names) { if (n.includes(' ') || n.length < 4) continue; if (ed1(w, n)) return { id }; }
        }
        return null;
      }
      function ed1(a, b) {
        if (a === b) return true; const la = a.length, lb = b.length; if (Math.abs(la - lb) > 1) return false;
        let i = 0, j = 0, edits = 0;
        while (i < la && j < lb) {
          if (a[i] === b[j]) { i++; j++; continue; }
          if (++edits > 1) return false;
          if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
        }
        return edits + (la - i) + (lb - j) <= 1;
      }
    }

    // ---------- run a command ----------
    async function run(raw) {
      const req = raw.trim(); if (!req) return;
      const parsed = parse(req);
      if (parsed.undo) { await undo(); return; }
      if (parsed.help) { confirmLines(['You can ask for sounds (“play rain”, “add a little ocean”), character (“something warm and steady”), purpose (“something for sleep”), changes (“softer”, “more movement”, “less rain”), timers (“for 30 minutes”), plus “save this”, “stop” and “undo”.'], false); return; }
      if (parsed.medical) { confirmLines(['I can adjust sounds and settings, but I can’t give medical advice. The Learn section covers sound and tinnitus carefully — and for symptoms, a doctor or audiologist is the right person.'], false); return; }
      if (parsed.clarify) { confirmLines(['Try being specific: “warmer”, “softer”, “more movement”, or “something different”.'], false); return; }
      if (parsed.unknownSound) { track('ai_command_failed'); confirmLines(['I don’t recognise that sound. The library has: rain, rain on window, ocean, lapping water, flowing water, waterfall, white/pink/brown noise, static, hiss, forest, leaves, crickets, cicadas, summer night, night sounds, wind, fan and fireplace.'], false); return; }
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
      <section class="ask-section section-block" aria-labelledby="ask-title">
        <h2 class="row-title" id="ask-title">✨ Ask Find My Quiet Sound</h2>
        <p class="muted small ask-tagline">Tell me what you want to hear. Type it or say it. <a class="linklike" href="learn/ask-find-my-quiet-sound/">How it works</a></p>
        <form id="ask-form">
          <label class="sr-only" for="ask-input">Tell Find My Quiet Sound what you would like</label>
          <input id="ask-input" type="text" maxlength="140" placeholder="Something warm for sleep…" autocomplete="off">
          <button class="btn btn-primary btn-sm" type="submit">Go</button>
        </form>
        <div id="ask-out" role="status" aria-live="polite"></div>
        <p class="muted small ask-bridge">or choose a sound below</p>
      </section>`;
    const form = $('#ask-form'), input = $('#ask-input'), out = $('#ask-out');
    let openedOnce = false;
    input.addEventListener('focus', () => { if (!openedOnce) { openedOnce = true; track('ai_assistant_opened'); } });
    form.addEventListener('submit', async e => { e.preventDefault(); const v = input.value; input.value = ''; await run(v); });
    input.addEventListener('keydown', e => { if (e.key === 'Escape') { out.innerHTML = ''; input.blur(); } });

    // ---------- Phase 2: tap-to-talk (speech becomes text; the SAME pipeline runs it) ----------
    // Web Speech API only — no cloud LLM, no always-on listening, one-shot per tap.
    // NOTE: recognition itself may be processed by the browser/device provider
    // (Google on Chrome/Edge/Android, Apple on Safari/iOS). We send only audio the
    // user chose to speak — never app data. Firefox has no support: mic is hidden.
    // The iPhone app shows it too: WKWebView implements this API with Apple's Speech framework, and
    // the app declares the microphone and speech-recognition usage descriptions (Info.plist), so iOS
    // asks for both permissions on the first tap. Nothing starts until the microphone is tapped.
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    // MIC_MODE — iPhone app: 'native' (Apple speech recognition through the app's own plugin, which restores the audio
    // session to playback-only after every session), 'webkit' (the browser recogniser, which leaves the microphone in
    // the route — Build 73/74 diagnostics) or 'hidden' (no microphone button; typing stays). Website: always 'webkit'.
    const IS_SHELL = !!(window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'ios');
    const MIC_MODE = IS_SHELL ? 'native' : 'webkit';
    const nativeSR = () => (IS_SHELL && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SoftwaveSpeech) || null;
    const useNative = MIC_MODE === 'native' && !!nativeSR();      // 'native' without the plugin (an older shell) hides the button
    const useWebkit = MIC_MODE === 'webkit' && !!SR;
    const diagNative = (phase, extra) => { try { if (window.__swDiagNative) window.__swDiagNative(Object.assign({ type: 'speechNative', phase: phase }, extra || {})); } catch (_) { } };
    // the plugin reports every session end with the restored session's category and route — the line that proves
    // the microphone left the route on a device (visible only in the diagnostic build's log)
    let nativeStateHook = null;   // set below: the page's "getting ready" → "Listening" → "I can hear you" indication follows these events
    try { const P0 = useNative && nativeSR(); if (P0 && P0.addListener) P0.addListener('listeningState', e => { diagNative('state', e); try { if (nativeStateHook) nativeStateHook(e); } catch (_) { } }); } catch (_) { }
    // Contextual strings for Apple's recognizer (iPhone app): every sound name and alias plus the command words the
    // parser understands, so "pink" is favoured over "ping". Words only — nothing about the user.
    const NATIVE_VOCAB = useNative ? Array.from(new Set(LEX.reduce((a, e) => a.concat(e.slice(1)), []).concat(['play', 'stop', 'pause', 'resume', 'add', 'remove', 'louder', 'softer', 'quieter', 'warmer', 'brighter', 'more movement', 'steadier', 'my sound', 'sleep timer', 'timer', 'undo', 'save']))) : null;
    // Build 78: the single-word sound names, for the plugin's alternative-transcript rule (a candidate transcript is used only
    // when it is the same utterance with one word swapped for one of these)
    const NATIVE_SOUNDS = useNative ? NATIVE_VOCAB.filter(w => w.indexOf(' ') < 0 && LEX.some(e => e.slice(1).indexOf(w) >= 0)) : null;
    // Build 78: Apple's music vocabulary writes the artist "P!nk" for "pink" (Build 77 device log, 19 Oct 2026)
    const normaliseHeard = (t) => t.replace(/\bP!nk\b/gi, 'pink');
    // Build 79: "add" is a one-syllable first word and comes back as "and", "ad", "had", "an" or "at" (Build 78 device log:
    // "and some rain" replaced the mix instead of adding to it). While something is playing, a result that begins with one
    // of these and is followed by a known sound name is read as "add …". Conservative: "and", "ad" and "had" may carry
    // the parser's own qualifiers ("a little", "some", "the", …); "at" and "an" only directly before a sound name. Nothing
    // else about the text changes, and a request with a real verb ("play", "with", "stop", …) is never touched.
    const SOUND_ALIASES = useNative ? LEX.reduce((a, e) => a.concat(e.slice(1)), []).map(w => w.replace(/ /g, '\\s+')).sort((a, b) => b.length - a.length) : null;
    const normaliseAdd = (t) => {
      if (!useNative || !(engine.active && engine.active.size > 0)) return t;
      const names = '(?:' + SOUND_ALIASES.join('|') + ')\\b';
      const loose = new RegExp('^(and|ad|had)\\s+((?:a little |a bit of |some |a touch of |light |the |an |a )?' + names + ')', 'i');
      const strict = new RegExp('^(at|an)\\s+(' + names + ')', 'i');
      const m = loose.exec(t) || strict.exec(t);
      return m ? 'add ' + t.slice(m[0].length - m[2].length) : t;
    };
    const escapeHtml = (t) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    if (useNative || useWebkit) {
      const mic = document.createElement('button');
      mic.type = 'button'; mic.id = 'ask-mic'; mic.className = 'btn btn-ghost btn-sm ask-mic';
      mic.setAttribute('aria-label', 'Speak your request'); mic.setAttribute('aria-pressed', 'false');
      mic.title = 'Speak your request — voice recognition may be processed by your browser or device provider';
      mic.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" fill="currentColor"/><path d="M18 11a6 6 0 0 1-12 0M12 17v3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      form.appendChild(mic);
      if (useNative) {   // iPhone app only: the "getting ready" look (dimmed, steady ring) and the "hearing you" ring
        const st = document.createElement('style');
        st.textContent = '.ask-mic.preparing{color:var(--muted);opacity:.65;box-shadow:0 0 0 2px var(--ring)}.ask-mic.listening.hearing{box-shadow:0 0 0 4px var(--accent);animation:none}';
        document.head.appendChild(st);
      }
      // ONE persistent recognition instance, reused across taps — recreating per tap can wedge
      // Chrome's speech service so the second session never returns. Handlers attach once.
      let rec = null, listening = false, firstUse = true, listenGuard = null, sessionHadOutcome = false, duckPrev = null, duckRestoreVal = null, duckRestoreAt = 0;
      // iPhone app: WebKit keeps the microphone in the audio route after a recognition session has ended, for as long
      // as the recogniser object lives (Build 73 diagnostic, 18 Oct 2026: the route held the built-in microphone from
      // the tap to the end of the run, and the speaker then played through the voice-processing path — hiss, a level
      // that drifted on its own, breaks on volume changes). There, every finished session releases its recogniser:
      // handlers detached, abort() called, reference dropped, so the next tap builds a fresh one. The website keeps
      // its single persistent instance above (recreating per tap can wedge Chrome's speech service).
      const SHELL = !!(window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'ios');
      function releaseRec() {
        if (!SHELL || !rec) return;
        const r = rec; rec = null;
        r.onresult = r.onerror = r.onend = null;   // nothing more from this instance reaches the UI
        try { r.abort(); } catch (_) { }
      }
      const setListening = (on) => {
        listening = on;
        mic.classList.toggle('listening', on);
        mic.setAttribute('aria-pressed', on);
        input.placeholder = on ? 'Listening… tap again to cancel' : 'Something warm for sleep…';
        // Playing audio drowns speech recognition (echo cancellation swallows the voice), so the
        // sound is quietened to near-silence while listening and restored to exactly its previous
        // level afterward. masterVolume, mixer layers and timers are never touched.
        if (on && engine.isPlaying && engine.trim) {
          if (duckPrev == null) {
            // A restore ramp takes ~1.5s to settle; reading the live gain during it captures a
            // mid-ramp value and each quick voice command would ratchet the volume further down.
            duckPrev = (performance.now() < duckRestoreAt && duckRestoreVal != null) ? duckRestoreVal : engine.trim.gain.value;
          }
          engine.setMasterTrim(0.005, 0.08);
        }
        else if (!on && duckPrev != null) { engine.setMasterTrim(duckPrev, 0.3); duckRestoreVal = duckPrev; duckRestoreAt = performance.now() + 1800; duckPrev = null; }
        const wasDucked = on && duckPrev != null;
        if (useNative) { mic.classList.remove('preparing', 'hearing'); mic.removeAttribute('aria-busy'); nativeDucked = wasDucked; }
        if (on) out.innerHTML = '<div class="ask-line">Listening…' + (wasDucked ? ' (sound paused while you speak)' : '') + '</div>'; else if (out.textContent.trim().indexOf('Listening…') === 0 || (useNative && out.querySelector('.ask-mic-state'))) out.innerHTML = '';
        // iPhone app: 30 s from the tap covers the permission prompts and the hardware switch; the guard is re-armed to
        // 14 s when capture starts (the plugin's own 12 s guard then acts first and keeps the text heard so far)
        armGuard(on, useNative ? 30000 : 10000);
      };
      let nativeDucked = false;
      function armGuard(on, ms) {
        clearTimeout(listenGuard);
        if (on) listenGuard = setTimeout(() => {   // hard guarantee: "Listening…" can never get stuck
          try { if (useNative) { const P = nativeSR(); if (P) P.stop(); } else if (rec) rec.abort(); } catch (_) { }
          setListening(false);
          confirmLines(['I didn’t hear anything. Tap the microphone and try again, or type your request.'], false);
        }, ms);
      }
      // iPhone app: what the button and the line under it say follows the plugin's own events — "getting ready" from
      // the tap (the sound is already quietened; the hardware switch and engine start take ~1.7 s on a device, and a word
      // spoken then is lost), "Listening… speak now" only once capture has actually started, "I can hear you" on the
      // first partial result. The website keeps its immediate "Listening…" (WebKit starts at once).
      function nativePhase(phase) {
        if (!useNative || !listening) return;
        if (phase === 'preparing') {
          mic.classList.remove('listening', 'hearing'); mic.classList.add('preparing'); mic.setAttribute('aria-busy', 'true');
          input.placeholder = 'Getting the microphone ready… tap again to cancel';
          out.innerHTML = '<div class="ask-line ask-mic-state">Getting the microphone ready… speak when the button pulses</div>';
        } else if (phase === 'listening') {
          mic.classList.remove('preparing'); mic.classList.add('listening'); mic.removeAttribute('aria-busy');
          input.placeholder = 'Listening… tap again to cancel';
          out.innerHTML = '<div class="ask-line ask-mic-state">Listening… speak now' + (nativeDucked ? ' (sound paused while you speak)' : '') + '</div>';
          armGuard(true, 14000);
        } else if (phase === 'hearing') {
          if (!mic.classList.contains('listening')) return;
          mic.classList.add('hearing');
          out.innerHTML = '<div class="ask-line ask-mic-state">Listening… I can hear you</div>';
        }
      }
      if (useNative) nativeStateHook = (e) => { if (!e) return; if (e.status === 'started') nativePhase('listening'); else if (e.status === 'partial') nativePhase('hearing'); };
      function ensureRec() {
        if (rec) return rec;
        rec = new SR();
        rec.lang = document.documentElement.lang || 'en';
        rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 1;
        rec.onresult = async (e) => {
          sessionHadOutcome = true;
          setListening(false);
          const text = e.results && e.results[0] && e.results[0][0] ? e.results[0][0].transcript.trim() : '';
          if (!text) { track('voice_command_failed'); confirmLines(['I didn’t catch that. Try again or type your request.'], false); return; }
          input.value = text;                       // transparency: show exactly what was heard
          track('voice_command_completed');
          await run(text);
          input.value = '';
        };
        rec.onerror = (e) => {
          sessionHadOutcome = true;
          setListening(false);
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { track('voice_permission_denied'); confirmLines(['Microphone access isn’t available. You can still type your request.'], false); }
          else if (e.error === 'aborted') { /* user cancelled or superseded — quiet */ }
          else if (e.error === 'no-speech') { track('voice_command_failed'); confirmLines(['I didn’t catch that. Try again or type your request.'], false); }
          else { track('voice_command_failed'); confirmLines(['Voice didn’t work just now (' + (e.error || 'unknown') + '). You can still type your request.'], false); }
        };
        rec.onend = () => {   // fires after every session, success or not
          const silent = listening && !sessionHadOutcome;
          setListening(false);
          if (silent) { track('voice_command_failed'); confirmLines(['I didn’t catch that. Tap the microphone and try again, or type your request.'], false); }
          releaseRec();   // iPhone app only: let WebKit release the microphone (see above)
        };
        return rec;
      }
      // iPhone app: one native session per tap; the plugin stops capture and restores the playback-only session on
      // every ending (result, error, cancel, its 12 s guard, a new tap), and the promise settles exactly once.
      async function nativeTap() {
        const P = nativeSR();
        if (listening) { try { await P.stop(); } catch (_) { } setListening(false); return; }   // tap again = cancel (the pending start rejects as 'aborted')
        track('voice_opened');
        if (firstUse) { firstUse = false; app.toast('Voice recognition may be processed by your browser or device provider. Find My Quiet Sound does not store your voice and does not send your Sound Profile or tinnitus information with the request.', 5600); }
        sessionHadOutcome = false;
        const wasPlaying = engine.isPlaying;
        setListening(true);   // ducks the sound first…
        nativePhase('preparing');   // …and says so: "Listening" waits for the plugin's started event
        await new Promise(r => setTimeout(r, wasPlaying ? 350 : 0));
        if (!listening) return;   // cancelled during the quiet-down
        diagNative('start', { vocabulary: NATIVE_VOCAB.length });
        let res = null, failure = null;
        if (engine.holdRemote) engine.holdRemote(true);   // iOS's own lock-screen pause/play during capture are not the user's
        try { res = await P.start({ language: document.documentElement.lang || 'en', vocabulary: NATIVE_VOCAB, sounds: NATIVE_SOUNDS }); } catch (e) { failure = (e && (e.code || e.message)) || 'unknown'; }
        if (engine.holdRemote) engine.holdRemote(false);
        sessionHadOutcome = true;
        setListening(false);   // …and restores it once the session has ended
        // Switching the shared hardware session for capture interrupts WebKit's audio context; it comes back only on a
        // touch. The session has fully ended here (the promise settles after the plugin's restore), so the engine's own
        // resume() is called — but only when sound is meant to be playing: a mix the user paused or stopped stays silent.
        if (engine.ctx && engine.ctx.state !== 'running' && engine.active && engine.active.size > 0 && !engine.userPaused) { try { diagNative('resume'); engine.resume(); } catch (_) { } }
        // iOS can also interrupt the audio a moment AFTER the session has ended (seen on device, Build 82): for 2.5 s an
        // interruption of sound that is meant to be playing is resumed the same way. A pause or Stop ends the watch.
        if (engine.active && engine.active.size > 0 && !engine.userPaused) {
          const until = Date.now() + 2500;
          const off = engine.on(type => {
            if (type !== 'state') return;
            if (Date.now() > until || engine.userPaused || !engine.active.size) { off(); return; }
            if (engine.ctx && engine.ctx.state !== 'running') { try { diagNative('resume-late'); engine.resume(); } catch (_) { } }
          });
          setTimeout(off, 2600);
        }
        if (failure !== null) {
          diagNative('error', { code: failure });
          if (failure === 'not-allowed') { track('voice_permission_denied'); confirmLines(['Microphone access isn’t available. You can still type your request.'], false); }
          else if (failure === 'aborted') { /* user cancelled or superseded — quiet */ }
          else if (failure === 'no-speech') { track('voice_command_failed'); confirmLines(['I didn’t catch that. Try again or type your request.'], false); }
          else { track('voice_command_failed'); confirmLines(['Voice didn’t work just now (' + failure + '). You can still type your request.'], false); }
          return;
        }
        const heard = (res && typeof res.text === 'string' ? res.text : '').trim();
        const text = normaliseAdd(normaliseHeard(heard));
        diagNative('result', { chars: text.length });   // length only — never the words
        if (!text) { track('voice_command_failed'); confirmLines(['I didn’t catch that. Try again or type your request.'], false); return; }
        input.value = text;                       // transparency: show exactly what was heard
        track('voice_command_completed');
        await run(text);
        input.value = '';
        // Build 78: when Ask could not act on the words, show them — on screen only; the diagnostic log and analytics never
        // receive the transcript (the analytics events above carry no text)
        if (/I don’t recognise that sound|I didn’t catch that/.test(out.textContent)) { const d = document.createElement('div'); d.className = 'ask-line ask-heard'; d.innerHTML = 'Heard “' + escapeHtml(heard) + '”'; out.appendChild(d); }
      }
      mic.addEventListener('click', () => {
        if (useNative) { nativeTap(); return; }
        if (listening) { try { rec && rec.abort(); } catch (_) { } setListening(false); return; }   // tap again = cancel
        track('voice_opened');
        if (firstUse) { firstUse = false; app.toast('Voice recognition may be processed by your browser or device provider. Find My Quiet Sound does not store your voice and does not send your Sound Profile or tinnitus information with the request.', 5600); }
        sessionHadOutcome = false;
        const wasPlaying = engine.isPlaying;
        setListening(true);   // ducks the sound first…
        const r = ensureRec();
        const begin = () => {
          if (!listening) return;   // cancelled during the quiet-down
          try {
            r.start();              // permission prompt happens here, on the deliberate tap
          } catch (err) {
            // InvalidStateError: a previous session is still winding down — reset and retry once shortly
            try { r.abort(); } catch (_) { }
            setTimeout(() => { if (!listening) return; try { r.start(); } catch (e2) { rec = null; setListening(false); track('voice_command_failed'); confirmLines(['Voice isn’t available right now. You can still type your request.'], false); } }, 300);
          }
        };
        // …then start recognition in near-silence, so its noise calibration hears you, not the sound
        setTimeout(begin, wasPlaying ? 350 : 0);
      });
    } else {
      track('voice_unsupported');   // no mic button rendered; typing is fully functional
    }
    function confirmLines(lines, withUndo) {
      out.innerHTML = lines.map(l => `<div class="ask-line">${l}</div>`).join('') + (withUndo ? '<button class="btn btn-ghost btn-sm" id="ask-undo">Undo</button>' : '');
      const u = $('#ask-undo', out); if (u) u.addEventListener('click', undo);
      clearTimeout(confirmLines._t); confirmLines._t = setTimeout(() => { if (!out.contains(document.activeElement)) out.innerHTML = ''; }, 14000);
    }

    window.softwaveAssistant = { run, undo, parse };   // parse exposed for testing; run for future voice tier
  };
  boot();
})();
