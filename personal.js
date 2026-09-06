/* Find My Quiet Sound — the intelligence connecting the features.
   One system: Find My Sound learns preferences → "Tuned to You" applies them gently
   across playback → Personalized Moments turn them into one-tap experiences
   (Your Quiet · Your Sleep · Your Focus · Woke Up at Night), plus an optional
   5-step starter journey for new users. Comfort and preference only — never a
   hearing test, never a medical claim. Everything stays on this device. */
(function () {
  'use strict';
  const boot = () => {
    const app = window.softwaveApp, profile = window.softwaveProfile, engine = window.softwave;
    if (!app || !profile || !engine) { setTimeout(boot, 150); return; }
    const $ = (s, r = document) => r.querySelector(s);
    const store = app.store;
    const M = () => window.softwaveMonetization;
    const gate = (key) => !M() || M().canUse(key) || (window.softwavePremium ? softwavePremium.gate(key) : true);
    const prefs = () => store.get('lab:prefs2', { n: 0, sum: {} });
    const confident = () => prefs().n >= 5;   // tuning waits until the profile has real signal

    // ================= TUNED TO YOU =================
    // Two gentle, reversible master-level touches derived from learned preferences:
    // warmth (people who consistently chose warmer sounds get a soft high-frequency easing)
    // and aliveness (people who chose moving sounds get the engine's subtle variation).
    // Never per-sound rewrites — sound identity is untouched; one tap turns it off.
    const tunedOn = () => store.get('tuned:on', true);
    function applyTuning() {
      if (!engine.ctx) return;
      const pp = profile.params();
      // The frequency generator and tinnitus matcher must always play untouched —
      // personalization never shapes deliberate tones.
      const toneActive = (engine.tone && engine.tone.playing) || (engine.matcher && engine.matcher.playing);
      if (!pp || !confident() || !tunedOn() || toneActive || !gateQuiet('sound_profile')) { engine.setMasterTone(20000, 0.6); engine.setVariation(0); syncChip(); return; }
      const warm = pp.warm || 0;      // -1 warmer … +1 brighter (from A/B choices)
      const moving = pp.moving || 0;  // 0 steady … 1 moving
      // A gentle easing, never a rewrite: the strongest setting only softens the very top —
      // every sound's character (hiss stays hissy, cicadas stay bright) must survive it.
      engine.setMasterTone(warm < -0.45 ? 11000 : warm < -0.2 ? 14000 : 20000, 0.8);
      engine.setVariation(moving > 0.35 ? Math.min(0.25, moving * 0.4) : 0, 9);
      syncChip();
    }
    const gateQuiet = (key) => !M() || M().canUse(key);   // tuning silently pauses if the profile ever becomes premium-gated
    engine.on(type => { if ((type === 'sounds' && engine.activeList().length) || type === 'tone') applyTuning(); });

    // The quiet indicator: a small chip beside the field actions, only when tuning is possible.
    function syncChip() {
      const hostRow = $('#field-controls .field-actions'); if (!hostRow) return;
      let chip = $('#tuned-chip');
      const eligible = confident() && profile.params();
      if (!eligible) { if (chip) chip.remove(); return; }
      if (!chip) {
        chip = document.createElement('button'); chip.id = 'tuned-chip'; chip.className = 'fa fa-tuned';
        chip.addEventListener('click', () => {
          const now = !tunedOn(); store.set('tuned:on', now);
          if (M()) M().track(now ? 'tuning_on' : 'tuning_off');
          applyTuning();
          app.toast(now ? 'Tuned to you: your learned preferences gently shape what plays.' : 'Tuned to you is off — sounds play exactly as designed.', 3600);
        });
        hostRow.appendChild(chip);
      }
      chip.textContent = 'Tuned to you · ' + (tunedOn() ? 'on' : 'off');
      chip.setAttribute('aria-pressed', tunedOn());
    }

    // ================= PERSONALIZED MOMENTS =================
    // Built fresh from the current profile at every tap, so they get smarter as the
    // profile does. The row exists in the DOM only when a profile exists.
    const MOMENTS = [
      { id: 'quiet', name: 'Your Quiet', desc: 'Your sound, ready now', run: async () => {
          safeMaster(0.35); await engine.loadMix(profile.mix());
          // carry the listener onward to the sound image, like the one-tap presets
          if (app.scheduleAutoAdvance) app.scheduleAutoAdvance('immerse'); } },
      { id: 'sleep', name: 'Your Sleep', desc: '60 min · gentle fade', run: async () => {
          safeMaster(0.3); await engine.loadMix(profile.mix({ sleep: true })); engine.setTimer(60, true); app.showView('sleep');
          if (app.scheduleAutoAdvance) app.scheduleAutoAdvance('sleep', 4000); } },
      { id: 'focus', name: 'Your Focus', desc: 'Sound + your visual', run: async () => {
          safeMaster(0.35); await engine.loadMix(profile.mix()); const F = window.softwaveFocus; if (F) { F.setVisual(profile.visual()); F.enterFocus(); } } },
      { id: 'night', name: 'Woke Up at Night', desc: 'Extra gentle · 30 min', run: async () => {
          safeMaster(0.22); const m = profile.mix({ sleep: true }); (m || []).forEach(s => s.volume = Math.min(s.volume, 0.45)); await engine.loadMix(m); engine.setTimer(30, true); } },
    ];
    function safeMaster(v) { if (engine.masterVolume > v) app.setMaster(v); }
    function renderMoments() {
      const slot = $('#moments-slot'); if (!slot) return;
      const pp = profile.params();
      if (!pp) { slot.innerHTML = ''; syncChip(); return; }    // true conditional rendering: no profile, no section (and no tuned chip)
      if (!slot.firstChild) {
        slot.innerHTML = `<section class="section-block moments-row" aria-labelledby="moments-title">
          <h2 class="row-title" id="moments-title">Your Moments</h2>
          <p class="muted small moments-note">One-tap experiences built from what Find My Sound learned about your preferences. They keep improving as you use it.</p>
          <div class="chips" id="moments" role="list"></div></section>`;
      }
      const host = $('#moments', slot); host.innerHTML = '';
      MOMENTS.forEach(mo => {
        const b = document.createElement('button'); b.className = 'chip chip-mine'; b.setAttribute('role', 'listitem'); b.dataset.chipName = mo.name;
        b.addEventListener('click', async () => {
          if (window.softwaveChips && softwaveChips.toggleStop(mo.name)) { app.toast(`Stopped “${mo.name}”`); return; }
          if (!gate('sound_profile')) return; if (M()) M().track('moment_used'); await mo.run();
          if (window.softwaveChips) softwaveChips.set(mo.name);
          if (mo.id !== 'sleep' && mo.id !== 'focus') app.toast(`${mo.name} — tap it again to stop.`); journeyMomentDone();
        });
        b.innerHTML = `<strong>✦ ${mo.name}</strong><span>${mo.desc}</span>`;
        host.appendChild(b);
      });
      syncChip();
    }
    document.addEventListener('softwave:profile', renderMoments);
    addEventListener('storage', renderMoments);

    // ================= GETTING COMFORTABLE WITH SOUND =================
    // Optional 5-step starter journey. Educational only; no claims; dismiss forever with one tap.
    const J = () => store.get('journey', { step: 0, done: false, dismissed: false });
    const setJ = (patch) => { store.set('journey', Object.assign(J(), patch)); renderJourneyCard(); };
    const STEPS = [
      { t: 'Sounds are different tools', b: 'Broadband noise (white, pink, brown) blends steadily. Nature sounds add life and character. Neither is “correct” — comfort is personal, and quieter usually works better than louder.', a: 'Next' },
      { t: 'Compare two sounds', b: 'Listen to each for a few seconds at the same volume. Notice which one your ears relax into — that reaction is the whole method.', a: 'Next', demo: true },
      { t: 'Find your level', b: 'Using the volume under the big circle, start low and adjust to a comfortable level — one where the sound sits beside your tinnitus rather than fighting it.', a: 'Next' },
      { t: 'Let it learn your preferences', b: 'Find My Sound plays pairs of sounds and learns from your choices — about ten quick comparisons. “No difference” is a perfectly good answer.', a: 'Start Find My Sound', discover: true },
      { t: 'Your first Moment', b: 'Your preferences are learned. “Your Moments” now sit at the top of the Sounds page — one tap builds your personal quiet, sleep or focus environment.', a: 'Try Your Quiet', moment: true },
    ];
    function renderJourneyCard() {
      const slot = $('#journey-slot'); if (!slot) return;
      const j = J();
      if (j.done || j.dismissed) { slot.innerHTML = ''; return; }
      if (!slot.firstChild) {
        slot.innerHTML = `<div class="journey-chip"><button class="chip" id="journey-open"><strong>New here? Get comfortable with sound</strong><span>5 short steps · about 3 minutes · optional</span></button><button class="chip-del" id="journey-x" aria-label="Dismiss the starter guide">×</button></div>`;
        $('#journey-open', slot).addEventListener('click', openJourney);
        $('#journey-x', slot).addEventListener('click', () => { setJ({ dismissed: true }); app.toast('Okay — you can always learn more under Learn.'); });
      }
    }
    let veil = null;
    function openJourney() {
      const j = J(); const i = Math.min(j.step, STEPS.length - 1); const s = STEPS[i];
      if (!veil) {
        veil = document.createElement('div'); veil.className = 'welcome journey-veil'; veil.setAttribute('role', 'dialog'); veil.setAttribute('aria-modal', 'true');
        veil.addEventListener('keydown', e => { if (e.key === 'Escape') closeJourney(); });
        document.body.appendChild(veil);
      }
      veil.hidden = false;
      veil.innerHTML = `<div class="welcome-card journey-card" aria-labelledby="j-title">
        <p class="muted small">Getting comfortable with sound · step ${i + 1} of ${STEPS.length}</p>
        <h2 class="h1" id="j-title">${s.t}</h2>
        <p class="lead">${s.b}</p>
        ${s.demo ? '<div class="btn-row" style="justify-content:center"><button class="btn btn-secondary" data-j-play="brown">Play Brown Noise</button><button class="btn btn-secondary" data-j-play="rain">Play Rain</button></div>' : ''}
        <div class="btn-row" style="justify-content:center;margin-top:14px"><button class="btn btn-primary btn-xl" data-j-next>${s.a}</button><button class="btn btn-ghost" data-j-later>Continue later</button></div>
        <p class="fineprint">Educational only — nothing here diagnoses or treats tinnitus.</p></div>`;
      veil.querySelectorAll('[data-j-play]').forEach(b => b.addEventListener('click', async () => { await engine.loadMix([{ id: b.dataset.jPlay, volume: 0.5 }]); }));
      $('[data-j-later]', veil).addEventListener('click', closeJourney);
      $('[data-j-next]', veil).addEventListener('click', async () => {
        if (s.discover) { setJ({ step: 4 }); closeJourney(); app.showView('find'); return; }
        if (s.moment) { closeJourney(); const q = document.querySelector('#moments .chip'); if (q) q.click(); else app.toast('Run Find My Sound first — then Your Moments appear here.'); finishJourney(); return; }
        setJ({ step: i + 1 }); openJourney();
      });
      const fb = $('[data-j-next]', veil); if (fb) fb.focus();
    }
    function closeJourney() { if (veil) { veil.hidden = true; engine.stopAll(); } }
    function finishJourney() { if (!J().done) { setJ({ done: true }); if (M()) M().track('journey_completed'); } }
    function journeyMomentDone() { const j = J(); if (!j.done && j.step >= 4) finishJourney(); }
    // Discovery completion moves the journey to its final step and celebrates once.
    document.addEventListener('softwave:profile', () => {
      const j = J();
      if (!j.done && !j.dismissed && j.step === 4 && profile.params()) {
        setJ({ step: 4 });
        setTimeout(() => { if (!veil || veil.hidden) app.toast('Your Moments are ready — see the top of the Sounds page. ✦', 4600); }, 1200);
      }
    });

    renderMoments(); renderJourneyCard();
    // Small public surface for other layers (the assistant): run a Moment by id, list them.
    window.softwavePersonal = {
      moments: () => MOMENTS.map(m => ({ id: m.id, name: m.name })),
      hasProfile: () => !!profile.params(),
      runMoment: async (id) => { const m = MOMENTS.find(x => x.id === id); if (!m) return false; if (!gate('sound_profile')) return false; if (M()) M().track('moment_used'); await m.run(); journeyMomentDone(); return true; },
    };
  };
  boot();
})();
