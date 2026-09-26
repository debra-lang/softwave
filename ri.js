/* Find My Quiet Sound — Sound Response Lab: "Discover What Changes Your Tinnitus" (web V1).
   Runtime: screens, controlled stimulus playback, trial/session records, safety and
   interruption handling. Every decision about WHAT to test comes from ri-protocol.js;
   this file only runs the protocol and talks to the user in plain words.
   What the user does: listen → say what happened → we learn. Nothing here is a treatment. */
(function () {
  'use strict';
  const P = window.RIProtocol; const engine = window.softwave, app = window.softwaveApp; const store = app.store;
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.getElementById('ri-root'); if (!root || !P) return;
  const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  // Test-only timing overrides, localhost only; trials made under them are stamped "-test" by the protocol.
  try { const o = LOCAL ? JSON.parse(localStorage.getItem('softwave:ri:test') || 'null') : null; if (o) P.configure(o); } catch (_) { }
  const C = P.CONFIG;
  const SAFETY_VERSION = 'RI-SAFETY-V1';
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const mmss = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const minutes = s => { const m = Math.round(s / 60); return m < 1 ? 'under a minute' : m === 1 ? 'about 1 minute' : `about ${m} minutes`; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // ---------- analytics: product funnel only — never ratings, responses or parameters ----------
  function track(name, params) { try { if (typeof window.gtag === 'function') window.gtag('event', name, Object.assign({ feature: 'sound_response_lab' }, params || {})); } catch (_) { } }

  // ---------- storage (all local, softwave:ri:* — see the Privacy page) ----------
  const uid = () => 'ri_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function anonId() { let a = store.get('ri:anon'); if (!a) { a = uid(); store.set('ri:anon', a); } return a; }
  function profile() { return store.get('ri:profile') || P.newProfile(anonId(), new Date().toISOString()); }
  function saveProfile(p) { store.set('ri:profile', p); writeSummary(p); }
  const trials = () => store.get('ri:trials', []); const sessions = () => store.get('ri:sessions', []);
  function writeSummary(p) { const s = P.summarize(p); store.set('ri:summary', { sessions: s.sessions, tested: s.tested, reductions: s.reductions, concluded: s.concluded, stageIndex: s.stageIndex }); if (app.syncRiCards) app.syncRiCards(); }
  function wipe() { ['ri:profile', 'ri:trials', 'ri:sessions', 'ri:active', 'ri:summary', 'ri:safety', 'ri:level', 'ri:anon'].forEach(k => store.del(k)); if (app.syncRiCards) app.syncRiCards(); }
  // RI-ADAPT-V1.1 changed how the control challenge is concluded. Nothing has reached production, so a
  // profile built under an older algorithm version (private-preview test data) is cleared rather than
  // reinterpreted. A future bump with real user data needs an explicit migration decision instead.
  try { const p0 = store.get('ri:profile'); if (p0 && p0.algorithm_version !== P.ALGORITHM_VERSION) wipe(); } catch (_) { }
  // reuse what Find My Quiet Sound already knows — never invent a pitch
  function knownMatch() {
    const m = store.get('match'); if (m && m.freq) return { hz: m.freq, source: 'Find My Tinnitus Sound', type: m.type, balance: m.balance, when: m.when, refined: !!m.matches };
    const ms = store.get('notch:measures', []); const last = ms[ms.length - 1]; if (last && last.hz) return { hz: last.hz, source: 'Personalized Notched Sound', where: last.where, when: last.date };
    return null;
  }
  const locationWord = m => !m ? null : m.balance != null ? (m.balance < 0 ? 'left' : m.balance > 0 ? 'right' : 'both') : (m.where || null);

  // ---------- stimulus generator (controlled, reproducible, RMS-matched) ----------
  const Stim = {
    buf: null, rmsCache: new Map(),
    noise(ctx) {
      if (this.buf && this.buf.sampleRate === ctx.sampleRate) return this.buf;
      const n = ctx.sampleRate * 4, b = ctx.createBuffer(2, n, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let x = 0x9E3779B9 + ch * 7919; for (let i = 0; i < n; i++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; d[i] = (x / 4294967296) * 2 - 1; } }   // seeded white noise: the same stimulus every time
      this.buf = b; return b;
    },
    graph(ctx, spec, out) {
      const src = ctx.createBufferSource(); src.buffer = this.noise(ctx); src.loop = true;
      const bq = (type, f, q) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
      const nodes = [src]; let last = src;
      if (spec.stimulus_type === 'broadband_noise') { for (const n of [bq('highpass', spec.filter_lo_hz, 0.707), bq('lowpass', spec.filter_hi_hz, 0.707)]) { last.connect(n); last = n; nodes.push(n); } }
      else { for (const n of [bq('bandpass', spec.center_frequency_hz, spec.q), bq('bandpass', spec.center_frequency_hz, spec.q)]) { last.connect(n); last = n; nodes.push(n); } }
      if (spec.modulation_type === 'amplitude') {
        // 100 % depth: gain = 0.5 + 0.5·sin. The SAME modulated signal goes to both ears (no interaural beating — not binaural beats).
        const mg = ctx.createGain(); mg.gain.value = 0.5; const osc = ctx.createOscillator(); osc.frequency.value = spec.modulation_frequency_hz; const og = ctx.createGain(); og.gain.value = 0.5;
        osc.connect(og); og.connect(mg.gain); osc.start(); last.connect(mg); last = mg; nodes.push(osc, og, mg);
      }
      const gain = ctx.createGain(); gain.gain.value = 0; last.connect(gain); gain.connect(out); nodes.push(gain);
      return { src, gain, nodes };
    },
    async rms(spec) {
      const key = JSON.stringify(spec); if (this.rmsCache.has(key)) return this.rmsCache.get(key);
      const sr = engine.ctx.sampleRate; const off = new OfflineAudioContext(1, sr, sr);
      const g = this.graph(off, spec, off.destination); g.gain.gain.value = 1; g.src.start(0);
      const buf = await off.startRendering(); const d = buf.getChannelData(0); const skip = Math.floor(sr * 0.2); let s = 0;
      for (let i = skip; i < d.length; i++) s += d[i] * d[i];
      const r = Math.sqrt(s / (d.length - skip)) || 1e-6; this.rmsCache.set(key, r); return r;
    },
    // every stimulus is level-matched (equal RMS) to broadband noise at the user's level; the level
    // control tops out at levelMaxGain and nothing here ever raises it
    async gainFor(spec, level) { const ref = await this.rms(P.stimulus({ type: 'bbn' }, 1000, engine.ctx.sampleRate)); const r = await this.rms(spec); return C.levelMaxGain * level * level * (ref / r); },
    tearDown(g) { try { g.src.stop(); } catch (_) { } g.nodes.forEach(n => { try { n.disconnect(); } catch (_) { } }); }
  };

  // ---------- runtime state ----------
  const S = { screen: null, session: null, trial: null, audio: null, timers: [], sample: null, waitCount: 0 };
  const later = (fn, ms) => { const t = setTimeout(fn, ms); S.timers.push(t); return t; };
  const clearTimers = () => { S.timers.forEach(clearTimeout); S.timers = []; if (S.tick) { clearInterval(S.tick); S.tick = null; } };
  function persist() { if (S.session) store.set('ri:active', { session: S.session, trial: S.trial ? Object.assign({}, S.trial, { audio: undefined }) : null, screen: S.screen }); else store.del('ri:active'); }
  const stopReasons = { done: null, user_stop: 'You stopped the session.', adverse_uncomfortable: 'We stopped because an increase felt uncomfortable.', prolonged_ri: 'That change lasted a while, so we stopped today’s session there to keep the next test clean.', ri_timeout: 'We didn’t hear back about the change, so today’s session ended there.', baseline_not_reestablished: 'Your tinnitus didn’t settle back to where today started, so we stopped rather than muddle the next test.', audio_failed: 'Sound couldn’t start on this device, so today’s session ended.', left: null, no_trials: null };

  // ---------- screens ----------
  const SCREENS = {};
  function show(name, data) {
    clearTimers(); S.screen = name; persist();
    const s = SCREENS[name](data || {});
    root.innerHTML = `<section class="ri-screen ri-${name}" aria-live="polite">${s.html}</section>`;
    if (s.wire) s.wire(root.firstElementChild);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const h = $('h2', root); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  const eyebrow = t => `<div class="ri-eyebrow">${t}</div>`;
  const btn = (id, label, cls = 'btn-primary', extra = '') => `<button type="button" class="btn ${cls} ri-btn" data-act="${id}" ${extra}>${label}</button>`;
  const scale = (id, value) => `<div class="ri-scale" data-scale="${id}"><div class="ri-scale-num" aria-hidden="true">${value == null ? '—' : value}</div>
      <input type="range" min="0" max="10" step="1" value="${value == null ? 5 : value}" aria-label="How noticeable, 0 barely to 10 extremely" ${value == null ? 'data-untouched' : ''}>
      <div class="ri-scale-ends"><span>0 — Barely noticeable</span><span>10 — Extremely noticeable</span></div></div>`;
  function wireScale(host, id, onChange) {
    const box = $(`[data-scale="${id}"]`, host), r = $('input', box), num = $('.ri-scale-num', box);
    const paint = () => { app.paintRange(r); num.textContent = r.value; r.setAttribute('aria-valuetext', r.value + ' of 10'); };
    if (!r.hasAttribute('data-untouched')) paint(); else app.paintRange(r);
    r.addEventListener('input', () => { r.removeAttribute('data-untouched'); paint(); onChange(+r.value); });
    r.addEventListener('change', () => { r.removeAttribute('data-untouched'); paint(); onChange(+r.value); });
    return () => r.hasAttribute('data-untouched') ? null : +r.value;
  }
  const on = (host, id, fn) => { const b = $(`[data-act="${id}"]`, host); if (b) b.addEventListener('click', fn); return b; };

  SCREENS.welcome = () => ({
    html: `${eyebrow('Discover What Changes Your Tinnitus')}<h2 class="ri-h">Let’s learn how your tinnitus responds</h2>
      <p class="ri-p">We’ll play a few carefully selected sounds.</p>
      <p class="ri-p">After each one stops, simply tell us whether your tinnitus became quieter, stayed about the same, or became louder.</p>
      <p class="ri-p">There are no right or wrong results.</p>
      <div class="ri-actions">${btn('next', 'Continue →')}</div>
      <details class="ri-details"><summary>What are we testing?</summary><p>Some people experience a temporary change in tinnitus after a sound stops. Researchers call this <em>residual inhibition</em> when tinnitus temporarily becomes quieter.</p><p>This experiment explores whether that happens for you and whether particular types of sound produce a repeatable response.</p></details>`,
    wire(h) { on(h, 'next', () => { track('ri_welcome_completed'); afterWelcome(); }); }
  });
  SCREENS.safety = () => ({
    html: `<h2 class="ri-h">Before we begin</h2>
      <p class="ri-p">This experiment uses sound at a comfortable listening level. Never increase the volume to an uncomfortable level to try to change your tinnitus.</p>
      <details class="ri-details"><summary>When you shouldn’t use this experiment</summary>
        <p>Please don’t continue, and seek appropriate medical evaluation, if you have:</p>
        <ul class="bullets"><li>sudden or new tinnitus that hasn’t been evaluated yet</li><li>sudden hearing loss</li><li>significant ear pain</li><li>fluid or discharge from an ear</li><li>sudden or severe dizziness</li><li>ordinary sounds that cause pain, or a strong intolerance of sound</li><li>a sudden, major, unexplained change in your tinnitus</li></ul>
        <p class="muted small">This is general guidance, not a diagnosis. An audiologist or doctor can advise on your situation.</p></details>
      <label class="ri-check"><input type="checkbox" id="ri-safety-ok"> <span>I understand and want to continue.</span></label>
      <div class="ri-actions">${btn('next', 'Continue →', 'btn-primary', 'disabled')}</div>`,
    wire(h) { const cb = $('#ri-safety-ok', h), b = $('[data-act="next"]', h); cb.addEventListener('change', () => { b.disabled = !cb.checked; }); on(h, 'next', () => { if (!cb.checked) return; store.set('ri:safety', { version: SAFETY_VERSION, at: new Date().toISOString() }); track('ri_safety_accepted'); afterSafety(); }); }
  });
  SCREENS.needmatch = () => ({
    html: `<h2 class="ri-h">First, let’s find your tinnitus pitch</h2>
      <p class="ri-p">The sounds in this experiment are chosen around the pitch you hear, so your tinnitus match comes first. It takes a couple of minutes, and you’ll come straight back here.</p>
      <div class="ri-actions">${btn('match', 'Find My Tinnitus Sound →')}${btn('later', 'Not now', 'btn-ghost')}</div>`,
    wire(h) { on(h, 'match', () => { S.resumeAfterMatch = true; app.showView('match'); }); on(h, 'later', () => leaveView()); }
  });
  SCREENS.quiet = () => ({
    html: `<h2 class="ri-h">The experiment needs a quiet starting point</h2>
      <p class="ri-p">Sounds are playing in Find My Quiet Sound. We’ll stop them so each sound test starts from silence. They won’t restart on their own afterwards.</p>
      <div class="ri-actions">${btn('stop', 'Stop sounds and continue')}${btn('later', 'Not now', 'btn-ghost')}</div>`,
    wire(h) { on(h, 'stop', () => { engine.stopAll(); afterQuiet(); }); on(h, 'later', () => leaveView()); }
  });
  SCREENS.setup = () => ({
    html: `<h2 class="ri-h">Find a comfortable place to listen</h2>
      <p class="ri-p">Use headphones or earbuds in a reasonably quiet place. Use the same headphones or earbuds throughout today’s session if possible.</p>
      <div class="ri-actions">${btn('next', 'I’m ready →')}</div>`,
    wire(h) { on(h, 'next', () => show('baseline')); }
  });
  SCREENS.baseline = () => ({
    html: `<h2 class="ri-h">How noticeable is your tinnitus right now?</h2>${scale('b', null)}
      <h3 class="ri-h3">Compared with usual today?</h3>
      <div class="seg wrap ri-seg" role="radiogroup" aria-label="Compared with usual"><button role="radio" aria-checked="false" data-vs="quieter">Quieter than usual</button><button role="radio" aria-checked="false" data-vs="usual">About usual</button><button role="radio" aria-checked="false" data-vs="louder">Louder than usual</button></div>
      <div class="ri-actions">${btn('next', 'Continue →', 'btn-primary', 'disabled')}</div>`,
    wire(h) {
      let vs = null; const b = $('[data-act="next"]', h); const val = wireScale(h, 'b', () => sync()); const sync = () => { b.disabled = !(val() != null && vs); };
      $$('[data-vs]', h).forEach(x => x.addEventListener('click', () => { vs = x.dataset.vs; $$('[data-vs]', h).forEach(y => y.setAttribute('aria-checked', y === x)); sync(); }));
      on(h, 'next', () => { if (val() == null || !vs) return; S.session.baseline = { rating: val(), vs_usual: vs, at: new Date().toISOString() }; persist(); track('ri_baseline_completed'); show('level'); });
    }
  });
  SCREENS.level = () => ({
    html: `<h2 class="ri-h">Set a comfortable listening level</h2>
      <p class="ri-p">Start low. Slowly raise the sound until it is clear and comfortable.</p><p class="ri-p">It does not need to cover your tinnitus.</p>
      <div class="ri-level"><button type="button" class="btn btn-secondary ri-btn" data-act="sample" aria-pressed="false">▶ Play sample sound</button>
        <label class="ri-level-label" for="ri-level">Level <output id="ri-level-out">${Math.round((S.session.level || 0.3) * 100)}%</output></label>
        <input type="range" id="ri-level" min="2" max="100" step="1" value="${Math.round((S.session.level || 0.3) * 100)}" aria-label="Listening level"></div>
      <p class="muted small">Your device’s own volume also applies. Keep everything comfortable — louder is never better here.</p>
      <div class="ri-actions">${btn('next', 'This level is comfortable →')}</div>`,
    wire(h) {
      const r = $('#ri-level', h), out = $('#ri-level-out', h), sb = $('[data-act="sample"]', h); app.paintRange(r);
      r.addEventListener('input', () => { app.paintRange(r); out.textContent = r.value + '%'; S.session.level = +r.value / 100; if (S.sample) setSampleLevel(); });
      on(h, 'sample', async () => { if (S.sample) { stopSample(); sb.textContent = '▶ Play sample sound'; sb.setAttribute('aria-pressed', 'false'); return; } const ok = await startSample(); if (ok) { sb.textContent = '■ Stop sample'; sb.setAttribute('aria-pressed', 'true'); } });
      on(h, 'next', () => { stopSample(); S.session.level = +r.value / 100; store.set('ri:level', S.session.level); persist(); beginTrials(); });
    }
  });
  SCREENS.ready = () => {
    const p = profile(); const plan = P.planSession(JSON.parse(JSON.stringify(p)), { tinnitusHz: (knownMatch() || {}).hz || 1000, sampleRate: 48000 });
    const n = plan.queue.length; const est = n ? `${Math.max(2, Math.round(n * 1.4))}–${Math.max(3, Math.round(n * 2.2))} minutes` : '';
    if (!n) return SCREENS.nothing();
    return {
      html: `${eyebrow('Discover What Changes Your Tinnitus')}<h2 class="ri-h">Ready to continue?</h2>
        <p class="ri-p">Today’s session should take about ${est}.</p>
        <div class="ri-actions">${btn('start', 'Start today’s session →')}${btn('profile', 'View my Sound Response Profile', 'btn-ghost')}</div>`,
      wire(h) { on(h, 'start', () => { track('ri_returning_session_started'); afterWelcome(); }); on(h, 'profile', () => show('profile')); }
    };
  };
  SCREENS.nothing = () => ({
    html: `<h2 class="ri-h">Nothing more to test for now</h2><p class="ri-p">We’ve completed the sounds this version explores. Your Sound Response Profile keeps everything we learned.</p><div class="ri-actions">${btn('profile', 'View my Sound Response Profile →')}</div>`,
    wire(h) { on(h, 'profile', () => show('profile')); }
  });
  SCREENS.trialBaseline = () => ({
    html: `${eyebrow(`Sound ${S.session.qi + 1} of ${S.session.plan.queue.length}`)}<h2 class="ri-h">Right now, before this sound — how noticeable is your tinnitus?</h2>${scale('t', null)}
      <div class="ri-actions">${btn('start', 'Start the sound →', 'btn-primary', 'disabled')}${btn('stop', 'Stop for today', 'btn-ghost btn-sm')}</div>`,
    wire(h) { const b = $('[data-act="start"]', h); const val = wireScale(h, 't', () => { b.disabled = val() == null; }); on(h, 'start', () => { if (val() == null) return; trialBaselineGiven(val()); }); on(h, 'stop', () => endSession('user_stop')); }
  });
  SCREENS.wait = ({ seconds }) => ({
    html: `<h2 class="ri-h">Let’s wait a moment</h2><p class="ri-p">Your tinnitus is still different from where today’s session started. We’ll check again shortly — nothing will play until then.</p>
      <div class="ri-actions">${btn('check', `Check again in ${mmss(seconds)}`, 'btn-primary', 'disabled')}${btn('stop', 'Stop for today', 'btn-ghost btn-sm')}</div>`,
    wire(h) { const b = $('[data-act="check"]', h); let left = seconds; S.tick = setInterval(() => { left--; if (left <= 0) { clearInterval(S.tick); S.tick = null; b.disabled = false; b.textContent = 'Check again'; } else b.textContent = `Check again in ${mmss(left)}`; }, 1000); on(h, 'check', () => { if (b.disabled) return; show('trialBaseline'); }); on(h, 'stop', () => endSession('user_stop')); }
  });
  SCREENS.listen = () => ({
    html: `${eyebrow(`Sound ${S.session.qi + 1} of ${S.session.plan.queue.length}`)}<h2 class="ri-h">Just listen normally.</h2>
      <div class="ri-count" id="ri-count" aria-live="off">${mmss(C.stimulusSeconds)}</div><p class="muted small ri-center">The sound stops on its own.</p>
      <div class="ri-actions ri-row">${btn('pause', 'Pause', 'btn-secondary')}${btn('stopx', 'Stop experiment', 'btn-ghost')}</div>`,
    wire(h) { const pb = $('[data-act="pause"]', h); on(h, 'pause', () => { if (!S.audio) return; if (S.audio.pausedAt == null) { pauseStim(); pb.textContent = 'Resume'; } else { resumeStim(); pb.textContent = 'Pause'; } }); on(h, 'stopx', () => { stopAudio(); invalidateTrial('stopped'); endSession('user_stop', 'stopped'); }); }
  });
  SCREENS.gap = () => ({ html: `<div class="ri-quiet"><div class="ri-dot" aria-hidden="true"></div><p class="muted">The sound has stopped.</p></div>` });
  SCREENS.response = () => ({
    html: `<h2 class="ri-h">What happened to your tinnitus?</h2>
      <div class="ri-cards" role="group" aria-label="What happened">${[['much-quieter', 'Much quieter'], ['quieter', 'A little quieter'], ['same', 'About the same'], ['louder', 'Louder'], ['unsure', 'Not sure']].map(([v, l]) => `<button type="button" class="ri-card" data-resp="${v}">${l}</button>`).join('')}</div>`,
    wire(h) { $$('[data-resp]', h).forEach(b => b.addEventListener('click', () => responseGiven(b.dataset.resp))); }
  });
  SCREENS.rating = () => ({
    html: `<h2 class="ri-h">How noticeable is it right now?</h2>${scale('r', S.trial.trial_baseline)}
      <div class="ri-actions">${btn('next', 'Continue →')}${btn('skip', 'Skip', 'btn-ghost btn-sm')}</div>`,
    wire(h) { const val = wireScale(h, 'r', () => { }); on(h, 'next', () => ratingGiven(val())); on(h, 'skip', () => ratingGiven(null)); }
  });
  SCREENS.brief = ({ text, next }) => ({ html: `<h2 class="ri-h ri-center">${text}</h2>`, wire() { later(next, 1400); } });
  SCREENS.louder = () => ({
    html: `<h2 class="ri-h">Thanks for telling us.</h2><p class="ri-p">We won’t repeat this sound today.</p>
      <h3 class="ri-h3">Is the increase uncomfortable or concerning?</h3>
      <div class="ri-actions ri-row">${btn('no', 'No', 'btn-secondary')}${btn('yes', 'Yes', 'btn-secondary')}</div>`,
    wire(h) { on(h, 'no', () => { S.trial.adverse_response = false; finishTrial(); show('recover'); }); on(h, 'yes', () => { S.trial.adverse_response = true; finishTrial(); endSession('adverse_uncomfortable', 'adverse'); }); }
  });
  SCREENS.adverseEnd = () => ({
    html: `<h2 class="ri-h">We’ll stop here today.</h2><p class="ri-p">Thank you for telling us. Give your tinnitus time to settle at a comfortable, quiet level. If the increase continues or concerns you, consider speaking with an audiologist or doctor.</p>
      <div class="ri-actions">${btn('profile', 'View my Sound Response Profile →')}</div>`,
    wire(h) { on(h, 'profile', () => show('profile')); }
  });
  SCREENS.recover = () => ({
    html: `<h2 class="ri-h">We’ll wait until your tinnitus is back to about its usual level.</h2><p class="ri-p">Take your time. Nothing else will play until you say so.</p>
      <div class="ri-actions">${btn('back', 'It’s back to usual')}${btn('stop', 'Stop for today', 'btn-ghost btn-sm')}</div>`,
    wire(h) { on(h, 'back', () => { S.lastTrialEnd = Date.now(); nextTrial(); }); on(h, 'stop', () => endSession('user_stop')); }
  });
  SCREENS.track = () => ({
    html: `<h2 class="ri-h">Your tinnitus became quieter</h2><p class="ri-p">Let’s see how long the change lasts.</p>
      <div class="ri-actions">${btn('back', 'Back to my usual level')}<div class="ri-row">${btn('louder', 'It became louder', 'btn-ghost btn-sm')}${btn('unsure', 'I’m not sure', 'btn-ghost btn-sm')}</div></div>
      <p class="muted small ri-center" id="ri-track-note" hidden>Still quieter? That’s fine — we’ll finish today’s session when you’re back to usual.</p>`,
    wire(h) {
      // the duration is measured silently from the moment the sound stopped; no running clock on screen
      const t0 = S.trial.stimulus_ended_at; const secs = () => (Date.now() - t0) / 1000;
      const note = $('#ri-track-note', h); S.tick = setInterval(() => { if (secs() >= C.prolongedRiSeconds) note.hidden = false; if (secs() >= C.riTimeoutSeconds) { clearInterval(S.tick); S.tick = null; S.trial.ri_duration_seconds = null; S.trial.returned_to_baseline = false; S.trial.user_uncertain = true; finishTrial(); endSession('ri_timeout'); } }, 1000);
      on(h, 'back', () => { const d = Math.round(secs()); S.trial.ri_duration_seconds = d; S.trial.returned_to_baseline = true; finishTrial(); if (d >= C.prolongedRiSeconds) endSession('prolonged_ri'); else show('brief', { text: 'Recorded.', next: () => { S.lastTrialEnd = Date.now(); nextTrial(); } }); });
      on(h, 'louder', () => { S.trial.residual_excitation = true; S.trial.ri_duration_seconds = Math.round(secs()); S.trial.returned_to_baseline = false; show('louder'); });
      on(h, 'unsure', () => { S.trial.user_uncertain = true; S.trial.ri_duration_seconds = null; S.trial.returned_to_baseline = null; finishTrial(); show('brief', { text: 'Recorded.', next: () => { S.lastTrialEnd = Date.now(); nextTrial(); } }); });
    }
  });
  SCREENS.rest = ({ seconds }) => ({
    html: `<h2 class="ri-h">Ready for the next sound?</h2><p class="ri-p">Take a short break first.</p>
      <div class="ri-actions">${btn('next', `Ready in ${mmss(seconds)}`, 'btn-primary', 'disabled')}${btn('stop', 'Stop for today', 'btn-ghost btn-sm')}</div>`,
    wire(h) { const b = $('[data-act="next"]', h); let left = seconds; const done = () => { b.disabled = false; b.textContent = 'Ready for the next sound →'; }; if (left <= 0) done(); else S.tick = setInterval(() => { left--; if (left <= 0) { clearInterval(S.tick); S.tick = null; done(); } else b.textContent = `Ready in ${mmss(left)}`; }, 1000); on(h, 'next', () => { if (b.disabled) return; show('trialBaseline'); }); on(h, 'stop', () => endSession('user_stop')); }
  });
  SCREENS.interrupted = () => ({
    html: `<h2 class="ri-h">This sound test was interrupted.</h2><p class="ri-p">We’ll try it again another time. Nothing from it was recorded as a result.</p>
      <div class="ri-actions">${btn('next', 'Continue →')}${btn('stop', 'Stop for today', 'btn-ghost btn-sm')}</div>`,
    wire(h) { on(h, 'next', () => { S.lastTrialEnd = Date.now(); nextTrial(); }); on(h, 'stop', () => endSession('user_stop')); }
  });
  SCREENS.audioFailed = () => ({
    html: `<h2 class="ri-h">We couldn’t start sound on this device.</h2><p class="ri-p">Check that the device isn’t muted and that another app isn’t holding the audio, then try again another time. Nothing was recorded.</p>
      <div class="ri-actions">${btn('profile', 'Back to my Sound Response Profile', 'btn-secondary')}</div>`,
    wire(h) { on(h, 'profile', () => show('profile')); }
  });
  SCREENS.complete = ({ session }) => {
    const sum = P.summarize(profile()); const mine = trials().filter(t => t.session_id === session.session_id && t.trial_valid !== false);
    const reds = mine.filter(t => P.outcomeOf(t) === 'pos'); const longest = Math.max(0, ...reds.map(t => t.ri_duration_seconds || 0));
    const first = sum.sessions <= 1; const note = stopReasons[session.stop_reason];
    const body = reds.length
      ? `<p class="ri-p">We found a response worth checking again.</p><p class="ri-p">At least one sound was followed by a temporary reduction in your tinnitus. Another session will help us learn whether that response is repeatable.</p>`
      : `<p class="ri-p">Your tinnitus didn’t noticeably become quieter after today’s sounds.</p><p class="ri-p">That’s useful information too. We’ll use today’s results to decide what is worth testing next.</p>`;
    return {
      html: `<h2 class="ri-h">${first ? 'Your first session is complete' : 'Today’s session is complete'}</h2>${body}${note ? `<p class="muted small">${note}</p>` : ''}
        <div class="ri-stats"><div><strong>${mine.length}</strong><span>sound${mine.length === 1 ? '' : 's'} tested</span></div><div><strong>${reds.length}</strong><span>temporary reduction${reds.length === 1 ? '' : 's'}</span></div>${longest ? `<div><strong>${mmss(longest)}</strong><span>longest change</span></div>` : ''}</div>
        <div class="ri-actions">${btn('profile', 'View my Sound Response Profile →')}</div>`,
      wire(h) { on(h, 'profile', () => show('profile')); }
    };
  };
  SCREENS.stopped = () => ({
    html: `<h2 class="ri-h">Stopped.</h2><p class="ri-p">Nothing from that sound was recorded as a result. You can come back any time.</p><div class="ri-actions">${btn('profile', 'View my Sound Response Profile →')}</div>`,
    wire(h) { on(h, 'profile', () => show('profile')); }
  });
  SCREENS.profile = () => {
    track('ri_profile_viewed');
    const p = profile(), sum = P.summarize(p), m = knownMatch();
    const steps = ['Finding responsive sounds', 'Checking repeatability', 'Refining your response'];
    const ctl = sum.control;   // the evaluated comparison, once three pairs are complete (may still be running if inconclusive)
    const learning = sum.concluded === 'concluded_none' ? 'We haven’t detected a repeatable temporary reduction from the sounds tested so far. That is a valid result, and your records are kept.'
      : ctl && ctl.outcome === 'candidate_specific_response' ? 'Certain sounds have repeatedly been followed by temporary reductions in your tinnitus. The response also appeared more consistently with this sound than with the comparison sound.'
      : ctl && ctl.outcome === 'broad_or_nonspecific_response' ? 'Several different sounds have been followed by temporary reductions in your tinnitus. So far, the response does not appear specific to one sound pattern.'
      : ctl ? 'We’ve seen temporary changes, but the comparison results aren’t consistent enough yet to show whether one sound pattern is more reliable than another.'
      : sum.stageIndex === 0 ? (sum.valid ? 'We’re trying a small set of carefully chosen sounds to see whether any are followed by a temporary change.' : 'Your first session will try three carefully chosen sounds.')
      : sum.stageIndex === 1 ? 'A sound was followed by a temporary reduction once. We’re checking whether that repeats before reading anything into it.'
      : 'Certain sounds have repeatedly been followed by temporary reductions in your tinnitus. We’re now checking how specific that response is.';
    const canContinue = !sum.concluded;
    const mc = sum.mostConsistent && sum.mostConsistent.pos >= 2 ? `<div class="ri-stat-row"><span class="label-sm">Most consistent response</span><strong>Quieter in ${sum.mostConsistent.pos} of ${sum.mostConsistent.valid} repeat tests</strong></div>` : '';
    // durations: the median is "typical" (3+ observations); min–max is the "observed range" (2+ distinct); longest always
    const row = (l, v) => `<div class="ri-stat-row"><span class="label-sm">${l}</span><strong>${v}</strong></div>`;
    const dur = (sum.durCount >= 3 ? row('Typical duration', mmss(sum.medianRi)) : '')
      + (sum.durRange && sum.durRange[0] !== sum.durRange[1] ? row('Observed range', `${mmss(sum.durRange[0])}–${mmss(sum.durRange[1])}`) : '')
      + (sum.longestRi ? row('Longest observed', mmss(sum.longestRi)) : '');
    const rows = Object.values(p.candidates).filter(c => c.exposures.length).map(c => {
      const ex = c.exposures.map(e => e.outcome === 'invalid' ? 'interrupted' : e.outcome === 'pos' ? `quieter${e.ri ? ' (' + mmss(e.ri) + ')' : ''}` : e.outcome === 'neg' ? 'louder' : e.outcome === 'unsure' ? 'not sure' : 'same').join(' · ');
      const sp = P.stimulus(c.params, m ? m.hz : 1000);
      return `<li><strong>${esc(P.describe(c.params, m ? m.hz : null))}</strong><br><span class="muted small">${sp.stimulus_type === 'broadband_noise' ? `${fmt(sp.filter_lo_hz)}–${fmt(sp.filter_hi_hz)} Hz` : `centre ${fmt(sp.center_frequency_hz)} Hz · band ${fmt(sp.filter_lo_hz)}–${fmt(sp.filter_hi_hz)} Hz (${c.params.bw === 1 ? '1 octave' : c.params.bw > 0.3 ? '1/3 octave' : '1/6 octave'})${sp.modulation_frequency_hz ? ` · ${sp.modulation_frequency_hz} Hz amplitude modulation` : ''}`} · ${C.stimulusSeconds} s · ${c.status === 'confirmed' ? 'repeatable' : c.status === 'avoid' ? 'set aside (louder)' : c.status === 'inactive' ? 'no repeatable change' : c.status}</span><br><span class="small">Responses: ${ex}</span></li>`;
    }).join('');
    return {
      html: `${eyebrow('Your Sound Response Profile')}<h2 class="ri-h">${sum.sessions ? 'What we’re learning' : 'Discover What Changes Your Tinnitus'}</h2>
        <div class="ri-stats"><div><strong>${sum.sessions}</strong><span>session${sum.sessions === 1 ? '' : 's'}</span></div><div><strong>${sum.tested}</strong><span>sound${sum.tested === 1 ? '' : 's'} tested</span></div><div><strong>${sum.reductions}</strong><span>temporary reduction${sum.reductions === 1 ? '' : 's'}</span></div></div>
        ${mc}${dur}
        <ol class="ri-progress" aria-label="Progress">${steps.map((s, i) => `<li class="${i < sum.stageIndex ? 'is-done' : i === sum.stageIndex ? 'is-now' : ''}"><span></span>${s}</li>`).join('')}</ol>
        <p class="ri-p">${learning}</p>
        <div class="ri-actions">${canContinue ? btn('continue', sum.sessions ? 'Continue discovering →' : 'Start exploring →') : ''}${btn('home', 'Back to Sounds', 'btn-ghost')}</div>
        <details class="ri-details ri-tech"><summary>View experiment details</summary>
          <p class="small">${m ? `Tinnitus match: ${fmt(m.hz)} Hz${locationWord(m) ? ', ' + locationWord(m) + (locationWord(m) === 'both' ? ' ears' : ' ear') : ''} (from ${m.source}${m.when ? ', ' + new Date(m.when).toLocaleDateString() : ''}).` : 'No tinnitus match yet.'} Each sound plays for ${C.stimulusSeconds} seconds at your chosen level, level-matched across sounds, followed by ${C.quietGapSeconds} seconds of silence before the question. A sound counts as repeatable when it is followed by a reduction in at least ${C.replication.positiveOf} of ${C.replication.outOf} separate tests — a design choice, not a medical threshold.</p>
          ${rows ? `<ul class="bullets small ri-rows">${rows}</ul>` : '<p class="muted small">No sounds tested yet.</p>'}
          <p class="muted small">Protocol ${esc(P.version())} · algorithm ${esc(P.ALGORITHM_VERSION)} · stored only on this device. <button type="button" class="linklike" data-act="wipe">Delete my Sound Response data</button></p><div data-wipe-box></div></details>`,
      wire(h) {
        on(h, 'continue', () => { if (sum.sessions) show('ready'); else afterWelcome(); }); on(h, 'home', () => leaveView());
        on(h, 'wipe', () => { const box = $('[data-wipe-box]', h); if (box.children.length) return; box.innerHTML = `<div class="inline-form" role="group" aria-label="Confirm deletion"><span style="flex-basis:100%">Delete every session, sound test and this profile from this device? This cannot be undone.</span><button type="button" class="btn btn-ghost btn-sm btn-danger" data-act="wipe-yes">Delete everything</button><button type="button" class="btn btn-ghost btn-sm" data-act="wipe-no">Cancel</button></div>`; on(h, 'wipe-no', () => { box.innerHTML = ''; }); on(h, 'wipe-yes', () => { wipe(); app.toast('Sound Response data deleted.'); show('profile'); }); });
      }
    };
  };

  // ---------- flow ----------
  function open() {
    track('ri_opened');
    const act = store.get('ri:active');
    if (act && act.session && !act.session.ended) { recover(act); return; }
    if (S.resumeAfterMatch) { S.resumeAfterMatch = false; if (knownMatch()) { afterSafety(); return; } }
    const p = profile();
    if (!p.counts.sessions && !trials().length) show('welcome'); else show('ready');
  }
  function afterWelcome() { const s = store.get('ri:safety'); if (!s || s.version !== SAFETY_VERSION) show('safety'); else afterSafety(); }
  function afterSafety() {
    if (!knownMatch()) { show('needmatch'); return; }
    if (engine.activeList().length || (engine.tone && engine.tone.playing)) { show('quiet'); return; }
    afterQuiet();
  }
  function afterQuiet() {
    S.session = { session_id: uid(), started: new Date().toISOString(), level: store.get('ri:level', 0.3), baseline: null, plan: null, qi: 0, trials: [], avoid_today: [], ended: null, stop_reason: null, protocol_version: P.version(), algorithm_version: P.ALGORITHM_VERSION };
    S.waitCount = 0; S.lastTrialEnd = 0; persist(); show('setup');
  }
  function beginTrials() {
    const m = knownMatch(); const p = profile(); const sr = engine.ctx ? engine.ctx.sampleRate : 48000;
    const plan = P.planSession(p, { tinnitusHz: m.hz, sampleRate: sr, exclude: S.session.avoid_today });
    saveProfile(p);   // planSession may have created candidate entries
    S.session.plan = { stage: plan.stage, kind: plan.kind, queue: plan.queue, pair: plan.pair || null, isFirst: plan.isFirst };
    S.session.tinnitus = { hz: m.hz, source: m.source, type: m.type || null, location: locationWord(m) };
    persist(); track('ri_session_started', { first: plan.isFirst ? 1 : 0 });
    if (!plan.queue.length) { endSession('no_trials'); return; }
    show('trialBaseline');
  }
  function nextTrial() {
    if (!S.session || S.session.ended) return;
    if (S.session.qi >= S.session.plan.queue.length) { endSession('done'); return; }
    const rest = Math.max(0, C.minRestSeconds - Math.round((Date.now() - (S.lastTrialEnd || 0)) / 1000));
    show('rest', { seconds: rest });
  }
  function trialBaselineGiven(rating) {
    const base = S.session.baseline.rating;
    if (Math.abs(rating - base) > C.baselineTolerance) {
      S.waitCount++;
      if (S.waitCount >= 2) { endSession('baseline_not_reestablished'); return; }
      show('wait', { seconds: C.minRestSeconds }); return;
    }
    S.waitCount = 0;
    const id = S.session.plan.queue[S.session.qi]; const params = P.parse(id); const spec = P.stimulus(params, S.session.tinnitus.hz, engine.ctx ? engine.ctx.sampleRate : 48000);
    S.trial = { trial_id: uid(), session_id: S.session.session_id, candidate_id: id, candidate_params: params, candidate_role: (profile().candidates[id] || {}).role || 'discovery', control_pair: S.session.plan.kind === 'control' ? S.session.plan.pair : null,
      trial_baseline: rating, spec, started: new Date().toISOString(), paused_seconds: 0, trial_valid: true, trial_invalid_reason: null };
    persist(); startListening();
  }

  // ---------- audio ----------
  async function ensureAudio() { try { await engine.init(); } catch (_) { } return !!(engine.ctx && engine.ctx.state === 'running'); }
  async function startSample() {
    if (!(await ensureAudio())) { app.toast('Sound couldn’t start. Tap again, or check the device volume.'); return false; }
    engine.notchClear(); engine.resetMasterShape();
    const spec = P.stimulus({ type: 'bbn' }, 1000, engine.ctx.sampleRate); const g = await Stim.gainFor(spec, S.session.level);
    const node = Stim.graph(engine.ctx, spec, engine.trim); const t = engine.ctx.currentTime; node.src.start(t); node.gain.gain.setTargetAtTime(g, t, 0.15);
    S.sample = { node, spec }; return true;
  }
  async function setSampleLevel() { if (!S.sample) return; const g = await Stim.gainFor(S.sample.spec, S.session.level); if (S.sample) S.sample.node.gain.gain.setTargetAtTime(g, engine.ctx.currentTime, 0.08); }
  function stopSample() { if (!S.sample) return; const s = S.sample; S.sample = null; try { s.node.gain.gain.setTargetAtTime(0, engine.ctx.currentTime, 0.08); } catch (_) { } setTimeout(() => Stim.tearDown(s.node), 400); }
  async function startListening() {
    show('listen');
    if (!(await ensureAudio())) { invalidateTrial('audio_failed'); endSession('audio_failed', 'audioFailed'); return; }
    engine.notchClear(); engine.resetMasterShape();
    const t = S.trial; let g; try { g = await Stim.gainFor(t.spec, S.session.level); } catch (_) { invalidateTrial('audio_failed'); endSession('audio_failed', 'audioFailed'); return; }
    if (S.screen !== 'listen' || !S.trial) return;   // left while the level was being prepared
    const ctx = engine.ctx; const node = Stim.graph(ctx, t.spec, engine.trim); const t0 = ctx.currentTime + 0.05;
    node.src.start(t0); node.gain.gain.setValueAtTime(0, t0); node.gain.gain.linearRampToValueAtTime(g, t0 + C.fadeSeconds);
    t.stimulus_gain = g; t.sample_rate = ctx.sampleRate; t.available_volume_metadata = { level: S.session.level, gain: Math.round(g * 1000) / 1000, master_volume: engine.masterVolume, note: 'browser gain only; device volume and output level unknown' };
    t.output_device_metadata = { ua: navigator.userAgent.slice(0, 120), touch: 'ontouchstart' in window, platform: navigator.platform || null };
    S.audio = { node, ctx, t0, g, pausedAt: null, pausedTotal: 0, ending: false };
    armGuards();
    const el = $('#ri-count');
    S.tick = setInterval(() => {
      const A = S.audio; if (!A) return;
      const active = A.pausedAt == null ? ctx.currentTime - A.t0 - A.pausedTotal : A.pausedActive;
      const left = C.stimulusSeconds - active; if (el) el.textContent = mmss(Math.ceil(left));
      if (!A.ending && left <= C.fadeSeconds) { A.ending = true; A.node.gain.gain.cancelScheduledValues(ctx.currentTime); A.node.gain.gain.setValueAtTime(A.node.gain.gain.value, ctx.currentTime); A.node.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + Math.max(0.05, left)); }
      if (left <= 0) stimulusEnded();
    }, 200);
  }
  function pauseStim() { const A = S.audio; if (!A || A.pausedAt != null) return; A.pausedAt = A.ctx.currentTime; A.pausedActive = A.ctx.currentTime - A.t0 - A.pausedTotal; A.node.gain.gain.setTargetAtTime(0, A.ctx.currentTime, 0.05); }
  function resumeStim() { const A = S.audio; if (!A || A.pausedAt == null) return; const p = A.ctx.currentTime - A.pausedAt; A.pausedTotal += p; A.pausedAt = null; S.trial.paused_seconds = Math.round(A.pausedTotal); if (A.pausedTotal > C.pauseMaxSeconds) { stopAudio(); invalidateTrial('paused_too_long'); show('interrupted'); return; } A.node.gain.gain.setTargetAtTime(A.g, A.ctx.currentTime, 0.05); }
  function stopAudio() { disarmGuards(); if (S.tick) { clearInterval(S.tick); S.tick = null; } const A = S.audio; S.audio = null; if (!A) return; try { A.node.gain.gain.cancelScheduledValues(A.ctx.currentTime); A.node.gain.gain.setTargetAtTime(0, A.ctx.currentTime, 0.03); } catch (_) { } setTimeout(() => Stim.tearDown(A.node), 200); }
  function stimulusEnded() {
    const A = S.audio; if (!A) return; if (S.tick) { clearInterval(S.tick); S.tick = null; }
    S.audio = null; disarmGuards(); setTimeout(() => Stim.tearDown(A.node), 300);
    S.trial.stimulus_ended_at = Date.now(); S.trial.stimulus_played_seconds = Math.round((A.ctx.currentTime - A.t0 - A.pausedTotal) * 10) / 10;
    persist(); show('gap'); S.gapGuard = true;
    later(() => { S.gapGuard = false; if (S.trial) show('response'); }, C.quietGapSeconds * 1000);
  }
  // interruptions: anything that means the sound was not heard as intended invalidates the trial
  function armGuards() {
    disarmGuards();
    const vis = () => { if (document.hidden && (S.audio || S.gapGuard)) interrupted('backgrounded'); };
    const st = () => { if (engine.ctx && engine.ctx.state !== 'running' && S.audio) interrupted('audio_interrupted'); };
    const snd = (type) => { if (type === 'sounds' && S.audio && engine.activeList().length) interrupted('other_audio'); };
    document.addEventListener('visibilitychange', vis); if (engine.ctx) engine.ctx.addEventListener('statechange', st); const off = engine.on(snd);
    S.guards = () => { document.removeEventListener('visibilitychange', vis); if (engine.ctx) engine.ctx.removeEventListener('statechange', st); off(); };
  }
  function disarmGuards() { if (S.guards) { S.guards(); S.guards = null; } }
  function interrupted(reason) { stopAudio(); S.gapGuard = false; clearTimers(); invalidateTrial(reason); show('interrupted'); }
  function invalidateTrial(reason) { if (!S.trial) return; S.trial.trial_valid = false; S.trial.trial_invalid_reason = reason; finishTrial(); }

  // ---------- responses → records ----------
  function responseGiven(cat) {
    const t = S.trial; if (!t) return; t.immediate_response_category = cat; t.responded_at = new Date().toISOString();
    if (cat === 'louder' && S.session) { S.session.avoid_today.push(t.candidate_id); }
    persist(); show('rating');
  }
  function ratingGiven(v) {
    const t = S.trial; if (!t) return; t.post_stimulus_rating = v; const cat = t.immediate_response_category;
    if (cat === 'much-quieter' || cat === 'quieter') { show('track'); return; }
    if (cat === 'louder') { show('louder'); return; }
    finishTrial();
    show('brief', { text: cat === 'unsure' ? 'That’s completely fine.' : 'Got it.', next: () => { S.lastTrialEnd = Date.now(); nextTrial(); } });
  }
  function finishTrial() {
    const t = S.trial; if (!t) return; S.trial = null;
    const sess = S.session; const m = sess && sess.tinnitus;
    const rec = {
      anonymous_user_id: anonId(), session_id: t.session_id, trial_id: t.trial_id, timestamp: t.started, ended: new Date().toISOString(),
      tinnitus_frequency: m ? m.hz : null, tinnitus_characteristics: m ? m.type : null, tinnitus_location: m ? m.location : null, known_tinnitus_duration: null, somatic_modulation_if_known: null,
      session_baseline: sess ? sess.baseline : null, trial_baseline: t.trial_baseline,
      candidate_id: t.candidate_id, candidate_params: t.candidate_params, candidate_role: t.candidate_role, control_pair: t.control_pair,
      stimulus_type: t.spec.stimulus_type, center_frequency_hz: t.spec.center_frequency_hz, frequency_ratio_to_tinnitus: t.spec.frequency_ratio_to_tinnitus, bandwidth_parameters: { octaves: t.spec.bandwidth_oct, q: t.spec.q, stages: 2 }, filter_edges: { lo_hz: t.spec.filter_lo_hz, hi_hz: t.spec.filter_hi_hz },
      modulation_type: t.spec.modulation_type, modulation_frequency_hz: t.spec.modulation_frequency_hz, stimulus_duration_seconds: t.spec.stimulus_duration_seconds, stimulus_played_seconds: t.stimulus_played_seconds || null, quiet_gap_seconds: C.quietGapSeconds, paused_seconds: t.paused_seconds || 0,
      level_matched: 'equal_rms_to_broadband', stimulus_gain: t.stimulus_gain || null, sample_rate: t.sample_rate || null, available_volume_metadata: t.available_volume_metadata || null, output_device_metadata_if_available: t.output_device_metadata || null,
      immediate_response_category: t.immediate_response_category || null, post_stimulus_rating: t.post_stimulus_rating == null ? null : t.post_stimulus_rating, ri_duration_seconds: t.ri_duration_seconds == null ? null : t.ri_duration_seconds,
      returned_to_baseline: t.returned_to_baseline == null ? null : t.returned_to_baseline, adverse_response: !!t.adverse_response, residual_excitation: !!t.residual_excitation, user_uncertain: !!t.user_uncertain || t.immediate_response_category === 'unsure',
      trial_valid: t.trial_valid !== false, trial_invalid_reason: t.trial_invalid_reason || null, session_stopped: false, stop_reason: null,
      protocol_version: P.version(), algorithm_version: P.ALGORITHM_VERSION };
    const all = trials(); all.push(rec); store.set('ri:trials', all);
    const p = profile(); P.recordTrial(p, rec); saveProfile(p);
    if (sess) { sess.trials.push(rec.trial_id); sess.qi++; persist(); }
    track('ri_trial_completed', { valid: rec.trial_valid ? 1 : 0 });
  }
  function endSession(reason, screen) {
    stopAudio(); clearTimers(); S.gapGuard = false;
    if (S.trial) { if (S.trial.immediate_response_category && !S.trial.trial_invalid_reason) finishTrial(); else invalidateTrial(reason === 'user_stop' ? 'stopped' : reason); }
    const sess = S.session; if (!sess) { show(screen || 'profile'); return; }
    sess.ended = new Date().toISOString(); sess.stop_reason = reason; sess.valid_trials = trials().filter(t => t.session_id === sess.session_id && t.trial_valid !== false).length;
    const all = sessions(); all.push(sess); store.set('ri:sessions', all);
    const p = profile(); P.closeSession(p); saveProfile(p);
    S.session = null; S.trial = null; persist(); track('ri_session_completed', { reason });
    if (reason === 'left') return;
    if (screen === 'stopped') { show('stopped'); return; }
    if (screen === 'adverse') { show('adverseEnd'); return; }
    if (screen === 'audioFailed') { show('audioFailed'); return; }
    show('complete', { session: sess });
  }
  // a reload or crash mid-session: the interrupted trial is never a result; the session can go on
  function recover(act) {
    S.session = act.session; S.trial = act.trial || null; S.waitCount = 0; S.lastTrialEnd = 0;
    if (!S.trial && act.screen === 'interrupted') { show('interrupted'); return; }   // the page went away right after an interruption: say so, then continue
    if (S.trial) { if (S.trial.immediate_response_category && S.trial.post_stimulus_rating !== undefined && !['track'].includes(act.screen)) finishTrial(); else invalidateTrial('reload'); show('interrupted'); return; }
    if (!S.session.baseline) { show('setup'); return; }
    if (!S.session.plan) { show('level'); return; }
    nextTrial();
  }
  // leaving the view (Back, menu, another tab): no sound continues, nothing partial counts
  function leaveView() { app.leaveTool ? app.leaveTool('ri') : app.showView('sounds'); }
  function leave() {
    stopSample(); if (!S.session) { clearTimers(); return; }
    if (S.audio || S.gapGuard || (S.trial && !S.trial.immediate_response_category)) { stopAudio(); S.gapGuard = false; }
    endSession('left');
  }

  window.softwaveRI = { open, leave, show, version: () => P.version(), _state: S };
})();
