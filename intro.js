/* Find My Quiet Sound — opening story.
   Plays once on the native app's first launch (then never again), and anywhere
   with ?intro=1 for previewing. Opens on a "Tap to begin" frame (the tap unlocks
   audio), then five scenes, ~29 s, soft generated soundscape, tap anywhere to skip,
   reduced-motion aware. Built from the app's own visual language. */
(function () {
  'use strict';
  const qs = new URLSearchParams(location.search);
  const preview = qs.get('intro') === '1';
  let firstRun = false;
  try {
    const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    firstRun = native && !localStorage.getItem('softwave:introSeen');
  } catch (_) { }
  if (!preview && !firstRun) return;
  if (firstRun) {
    // Mark the film as seen up front so it never replays, even if the app is
    // killed mid-film.
    try { localStorage.setItem('softwave:introSeen', '1'); } catch (_) { }
  }
  // The film IS the welcome, in every mode: without this, skipping the film on the
  // web drops the viewer onto the old welcome dialog waiting underneath it.
  try { localStorage.setItem('softwave:welcomed', 'true'); } catch (_) { }

  // ---- timeline (seconds) — tune freely ----
  const T = {
    s1: 0.0,   // the mark: ripple + logo bars + name
    s2: 4.2,   // "Everyone's tinnitus is different." — three distinct orbs
    s3: 10.0,  // A/B: "Better with A… or B?"
    s4f: 16.7, // the breadth: constellation of orbs — everything the app offers
    s4: 23.4,  // merge into the breathing circle: "Your sound. One tap away."
    end: 28.8,
  };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const boot = () => { if (!window.SoftwaveVisuals || !document.body) return setTimeout(boot, 80); run(); };
  boot();

  function run() {
    const SV = window.SoftwaveVisuals;
    const style = document.createElement('style');
    style.textContent = `
      #fmqs-intro { position: fixed; inset: 0; z-index: 400; background: #0b1020; overflow: hidden;
        opacity: 1; transition: opacity .9s ease; }
      #fmqs-intro.out { opacity: 0; pointer-events: none; }
      #fmqs-intro canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
      .fi-line { position: absolute; left: 50%; transform: translateX(-50%); width: min(86vw, 560px);
        text-align: center; color: #e8ecf6; opacity: 0; transition: opacity 1.1s ease;
        font-family: 'Fraunces', Georgia, serif; font-weight: 300; letter-spacing: .04em; text-wrap: balance; }
      .fi-line.on { opacity: 1; }
      .fi-title { top: 62%; font-size: clamp(1.625rem, 5.8vw, 2.325rem); letter-spacing: .12em; }
      .fi-big  { top: 16%; font-size: clamp(1.575rem, 6vw, 2.225rem); }
      .fi-sub  { top: 26%; font-size: clamp(1.125rem, 4vw, 1.375rem); color: #9aa7c4;
        font-family: Manrope, system-ui, sans-serif; font-weight: 500; letter-spacing: .02em; }
      .fi-green { color: #9fe0bb; }
      .fi-learn { font-size: clamp(1.25rem, 4.4vw, 1.5rem); }
      .fi-skip { position: absolute; right: 18px; bottom: calc(18px + env(safe-area-inset-bottom, 0px));
        color: #9aa7c4; font: 600 .85rem Manrope, system-ui, sans-serif; letter-spacing: .06em;
        background: none; border: 0; padding: 10px 14px; cursor: pointer; opacity: .7; }
      .fi-ab { position: absolute; inset: 0; color: #9aa7c4; font: 700 1.225rem Manrope, sans-serif;
        opacity: 0; transition: opacity 1s ease; pointer-events: none; }
      .fi-ab.on { opacity: 1; }
      .fi-ab span { position: absolute; top: 54%; transform: translateX(-50%); letter-spacing: .2em; }
      .fi-ab span:first-child { left: 30%; }
      .fi-ab span:last-child { left: 70%; }
      .fi-gate { position: absolute; left: 50%; top: 74%; transform: translateX(-50%);
        color: #9aa7c4; font: 600 .95rem Manrope, system-ui, sans-serif; letter-spacing: .14em;
        text-transform: uppercase; animation: fiGate 2.6s ease-in-out infinite; pointer-events: none; }
      #fmqs-intro.started .fi-gate { display: none; }
      @keyframes fiGate { 0%,100% { opacity: .35; } 50% { opacity: .85; } }
    `;
    document.head.appendChild(style);

    const w = document.getElementById('welcome'); if (w) w.hidden = true;
    const ov = document.createElement('div'); ov.id = 'fmqs-intro';
    ov.innerHTML = `
      <canvas></canvas>
      <div class="fi-line fi-title" data-at="0" data-off="3.6">FIND MY QUIET SOUND</div>
      <div class="fi-line fi-big" data-at="${T.s2 + 0.4}" data-off="${T.s3 - 0.6}">Everyone’s tinnitus is different.</div>
      <div class="fi-line fi-sub" data-at="${T.s2 + 2.2}" data-off="${T.s3 - 0.6}">Your comfortable sound should be too.</div>
      <div class="fi-line fi-big" data-at="${T.s3 + 0.4}" data-off="${T.s3 + 3.1}">Better with A… or B?</div>
      <div class="fi-line fi-sub fi-green fi-learn" data-at="${T.s3 + 3.3}" data-off="${T.s4f - 0.4}">It learns what you prefer.</div>
      <div class="fi-line fi-big" data-at="${T.s4f + 0.4}" data-off="${T.s4 - 0.5}">More ways to find quiet.</div>
      <div class="fi-line fi-sub" data-at="${T.s4f + 1.2}" data-off="${T.s4f + 3.7}">20 sounds &amp; environments · Sound Mixer</div>
      <div class="fi-line fi-sub" data-at="${T.s4f + 3.9}" data-off="${T.s4 - 0.4}">Visual Focus · Sleep sessions · Moments · Ask</div>
      <div class="fi-line fi-big" data-at="${T.s4 + 0.8}" data-off="${T.end - 1.2}">Your sound. <span class="fi-green">One tap away.</span></div>
      <div class="fi-ab" data-at="${T.s3 + 0.2}" data-off="${T.s4f - 0.2}"><span>A</span><span>B</span></div>
      <div class="fi-gate">Tap to begin</div>
      <button class="fi-skip" type="button">Skip</button>`;
    document.body.appendChild(ov);

    const cv = ov.querySelector('canvas');
    const ctx = cv.getContext('2d');
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const fit = () => { cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    fit(); addEventListener('resize', fit);

    const lines = [...ov.querySelectorAll('[data-at]')];
    const titleEl = ov.querySelector('.fi-title');
    const pBrown = SV.paramsFor('brown'), pBright = SV.paramsFor('hiss'), pOcean = SV.paramsFor('ocean');
    let raf = null, done = false, started = false, t0 = null;
    const tLoad = performance.now();
    const now = () => t0 === null ? 0 : (performance.now() - t0) / 1000;

    // ---- soundscape: warm pad + breathing noise bed + a soft chime per scene ----
    let ac = null, master = null;
    function startAudio() {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
        const t = ac.currentTime, endAt = t + T.end;
        // master envelope: slow bloom in, long exhale out
        master.gain.setValueAtTime(0, t);
        master.gain.linearRampToValueAtTime(0.9, t + 2.8);
        master.gain.setValueAtTime(0.9, endAt - 2.4);
        master.gain.linearRampToValueAtTime(0.0001, endAt - 0.1);
        // generated hall: 4.5 s of darkened decaying noise — the space everything sits in
        const irLen = Math.floor(ac.sampleRate * 4.5);
        const ir = ac.createBuffer(2, irLen, ac.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const d = ir.getChannelData(ch); let lp0 = 0;
          for (let i = 0; i < irLen; i++) {
            lp0 = lp0 * 0.75 + (Math.random() * 2 - 1) * 0.25;
            d[i] = lp0 * Math.pow(1 - i / irLen, 2.8);
          }
        }
        const hall = ac.createConvolver(); hall.buffer = ir;
        const wet = ac.createGain(); wet.gain.value = 1.0;
        const dry = ac.createGain(); dry.gain.value = 0.45;
        hall.connect(wet); wet.connect(master); dry.connect(master);
        // one warm shared filter, itself breathing very slowly
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 750; lp.Q.value = 0.3;
        lp.connect(dry); lp.connect(hall);
        const fLfo = ac.createOscillator(); fLfo.frequency.value = 0.045;
        const fLg = ac.createGain(); fLg.gain.value = 220; fLfo.connect(fLg); fLg.connect(lp.frequency); fLfo.start();
        // a pad voice: two barely-detuned sines + a whisper of triangle, its own slow
        // breath cycle, its own place in the stereo field
        const voice = (f, pan, amp, rate, ph) => {
          const g = ac.createGain(); g.gain.value = amp;
          if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(lp); }
          else g.connect(lp);
          const oscs = [['sine', -3, 1], ['sine', 3, 1], ['triangle', 0, 0.28]].map(([ty, det, w]) => {
            const o = ac.createOscillator(); o.type = ty; o.frequency.setValueAtTime(f, t); o.detune.value = det;
            const og = ac.createGain(); og.gain.value = w; o.connect(og); og.connect(g); o.start();
            return o;
          });
          const l = ac.createOscillator(); l.frequency.value = rate;
          const lg = ac.createGain(); lg.gain.value = amp * 0.6; l.connect(lg); lg.connect(g.gain); l.start(t + ph);
          return { oscs, g };
        };
        // one chord per scene — A Dorian: minor bones, warm light inside (the F# lift),
        // resolving home to a soft A major
        const chords = [
          [110.0, 164.81, 220.0, 329.63, 493.88],    // Am9
          [146.83, 220.0, 293.66, 369.99, 493.88],   // D6/9 (the Dorian warmth)
          [98.0, 246.94, 293.66, 440.0, 587.33],     // G add9
          [164.81, 246.94, 293.66, 369.99, 493.88],  // Em9 — gathering, anticipation
          [110.0, 164.81, 277.18, 440.0, 493.88],    // A major add9 — arrival
        ];
        const pans = [-0.15, 0.35, -0.4, 0.45, -0.25];
        const amps = [0.055, 0.05, 0.042, 0.03, 0.02];
        const rates = [0.05, 0.075, 0.06, 0.09, 0.11];
        const vs = chords[0].map((f, i) => voice(f, pans[i], amps[i], rates[i], i * 0.7));
        const sub = voice(55.0, 0, 0.035, 0.04, 0.3); // deep floor under everything
        const subRoots = [55.0, 73.42, 49.0, 82.41, 55.0];
        const moveTo = (ci, at, glide) => {
          chords[ci].forEach((f, i) => vs[i].oscs.forEach(o => o.frequency.setTargetAtTime(f, at, glide)));
          sub.oscs.forEach(o => o.frequency.setTargetAtTime(subRoots[ci], at, glide + 0.3));
        };
        moveTo(1, t + T.s2, 1.1);
        moveTo(2, t + T.s3, 1.1);
        moveTo(3, t + T.s4f, 1.1);
        moveTo(4, t + T.s4, 0.9);
        // the arrival opens slightly — upper voices bloom, filter lifts a touch
        vs[3].g.gain.setTargetAtTime(0.045, t + T.s4, 1.4);
        vs[4].g.gain.setTargetAtTime(0.032, t + T.s4, 1.4);
        lp.frequency.setTargetAtTime(950, t + T.s4, 1.6);
        // a slow, low singing line deep inside the hall — phrases with real rests,
        // felt-piano tone, dark register (this is the "voice" of the piece)
        const note = (at, f, amp, dur) => {
          [[1, 1], [2, 0.3], [3, 0.1]].forEach(([m, w]) => {
            const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
            const g = ac.createGain(); g.gain.setValueAtTime(0.0001, at);
            g.gain.exponentialRampToValueAtTime(amp * w, at + 0.04);
            g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
            o.connect(g); g.connect(lp); o.start(at); o.stop(at + dur + 0.2);
          });
        };
        note(t + 1.4, 220.0, 0.06, 3.0);             // A3 — the mark
        note(t + 3.2, 261.63, 0.05, 2.8);            // C4
        note(t + T.s2 + 0.7, 329.63, 0.055, 2.8);    // E4 — "everyone's different"
        note(t + T.s2 + 3.0, 369.99, 0.05, 3.0);     // F#4 — the Dorian warmth
        note(t + T.s3 + 0.7, 293.66, 0.05, 2.4);     // D4 — "A… or B?"
        note(t + T.s3 + 2.3, 329.63, 0.045, 2.4);    // E4 (the flip)
        note(t + T.s3 + 3.9, 392.0, 0.05, 3.0);      // G4 — "it learns"
        note(t + T.s4f + 0.8, 329.63, 0.05, 2.6);    // E4 — the world opens
        note(t + T.s4f + 2.7, 369.99, 0.045, 2.6);   // F#4
        note(t + T.s4f + 4.4, 493.88, 0.04, 2.6);    // B4 — rising, almost there
        note(t + T.s4 + 1.0, 440.0, 0.06, 3.6);      // A4 — arrival
        note(t + T.s4 + 3.0, 554.37, 0.032, 3.2);    // C#5, very soft — the smile
        note(t + T.end - 2.8, 329.63, 0.035, 2.6);   // E4 — breath out
      } catch (_) { }
    }
    function stopAudio() {
      try {
        if (ac && master) {
          master.gain.cancelScheduledValues(ac.currentTime);
          master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.12);
          setTimeout(() => { try { ac.close(); } catch (_) { } }, 700);
        }
      } catch (_) { }
    }

    function finish(skipped) {
      if (done) return; done = true;
      cancelAnimationFrame(raf);
      stopAudio();
      // Open the placard BENEATH the film first (film sits at a higher z-index), then
      // fade the film into it — the bare app is never visible in between.
      // A skip goes straight to the app — no offer screen after a "no thanks".
      // Web preview only for now: in the native app an offer without a real StoreKit
      // purchase behind it risks App Store rejection — reconnect when IAP ships.
      if (!skipped && preview) { try { window.softwavePremium && window.softwavePremium.placard('intro'); } catch (_) { } }
      ov.classList.add('out');
      setTimeout(() => { ov.remove(); style.remove(); }, 950);
    }
    function begin() {
      if (started || done) return; started = true;
      t0 = performance.now();
      ov.classList.add('started');
      startAudio();
    }
    ov.addEventListener('click', () => { started ? finish(true) : begin(); });
    ov.querySelector('.fi-skip').addEventListener('click', (e) => { e.stopPropagation(); finish(true); });
    if (reduced) {   // reduced motion: a calm 3-second title card, no sound, nothing moves
      ov.classList.add('started');
      titleEl.classList.add('on');
      setTimeout(finish, 3000);
    } else {
      titleEl.classList.add('on'); // title breathes with the gate until the first tap
    }

    const ease = (a, b, t) => Math.max(0, Math.min(1, (t - a) / (b - a)));
    const bars = [0, 1, 2];

    // the mark: slow ripple rings + the three-bar logo breathing
    function drawMark(t, a1, cx, cy, w, h) {
      for (let i = 0; i < 3; i++) {
        const ph = ((t * 0.175 + i / 3) % 1);
        ctx.beginPath(); ctx.arc(cx, cy, 40 + ph * Math.min(w, h) * 0.42, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(159,224,187,${(1 - ph) * 0.22 * a1})`; ctx.lineWidth = 1.5; ctx.stroke();
      }
      for (const i of bars) {
        const bh = (26 + Math.sin(t * 2.2 + i * 1.1) * 10) * a1;
        const x = cx - 20 + i * 16;
        ctx.fillStyle = `rgba(143,179,255,${0.95 * a1})`;
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, cy - bh / 2, 9, bh, 4); else ctx.rect(x, cy - bh / 2, 9, bh); ctx.fill();
      }
    }

    function frame() {
      if (done) return;
      raf = requestAnimationFrame(frame);
      if (reduced) return;
      const w = innerWidth, h = innerHeight, cx = w / 2, cy = h * 0.42;

      // waiting frame: the mark idles quietly until the first tap
      if (!started) {
        const ti = (performance.now() - tLoad) / 1000;
        ctx.clearRect(0, 0, w, h);
        drawMark(ti, 1, cx, cy, w, h);
        return;
      }

      const t = now();
      if (t >= T.end) return finish();
      // text lines on/off
      for (const el of lines) { const on = t >= +el.dataset.at && t < +el.dataset.off; el.classList.toggle('on', on); }
      ctx.clearRect(0, 0, w, h);

      // ---- scene 1: expanding ripples + the three-bar mark breathing ----
      if (t < T.s2 + 1) {
        const a1 = Math.min(1, 0.6 + t / 2) * (1 - ease(T.s2 - 0.8, T.s2 + 0.8, t));
        drawMark(t, a1, cx, cy, w, h);
      }
      // ---- scene 2: three different orbs drift — individuality ----
      if (t >= T.s2 && t < T.s3 + 0.8) {
        const a2 = ease(T.s2, T.s2 + 1, t) * (1 - ease(T.s3 - 0.6, T.s3 + 0.7, t));
        const orb = (p, ox, oy, box, ph) => {
          ctx.save(); ctx.globalAlpha = a2;
          ctx.translate(cx + ox - box / 2 + Math.sin(t * 0.5 + ph) * 8, cy + oy - box / 2 + Math.cos(t * 0.4 + ph) * 6);
          SV.soundShape(ctx, box, box, p, t * 0.7 + ph, 0.18, { scale: 0.42 });
          ctx.restore();
        };
        const u = Math.min(w, h);
        orb(pBrown, -w * 0.26, h * 0.02, u * 0.34, 0);
        orb(pBright, 0, h * 0.1, u * 0.28, 2.1);
        orb(pOcean, w * 0.26, h * 0.01, u * 0.37, 4.2);
      }
      // ---- scene 3: A and B alternate glow ----
      if (t >= T.s3 && t < T.s4f + 0.8) {
        const a3 = ease(T.s3, T.s3 + 0.8, t) * (1 - ease(T.s4f - 0.5, T.s4f + 0.7, t));
        const pulse = (Math.sin(t * 1.6) + 1) / 2;
        const box = Math.min(w, h) * 0.42;
        const orb = (p, ox, glow, ph) => {
          ctx.save(); ctx.globalAlpha = a3 * (0.45 + glow * 0.55);
          ctx.translate(cx + ox - box / 2, cy - box / 2);
          SV.soundShape(ctx, box, box, p, t * 0.7 + ph, 0.12 + glow * 0.25, { scale: 0.42 });
          ctx.restore();
        };
        orb(pBrown, -w * 0.2, 1 - pulse, 0);
        orb(pOcean, w * 0.2, pulse, 3.3);
      }
      // ---- scene 3b: the breadth — a constellation of small orbs, slowly turning ----
      if (t >= T.s4f && t < T.s4 + 0.8) {
        const a5 = ease(T.s4f, T.s4f + 1, t) * (1 - ease(T.s4 - 0.6, T.s4 + 0.7, t));
        const u = Math.min(w, h), R = u * 0.3;
        const ps = [pBrown, pBright, pOcean];
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2 + t * 0.06;
          const box = u * (0.09 + ((i * 37) % 5) * 0.012);
          const ox = Math.cos(ang) * R, oy = Math.sin(ang) * R * 0.72;
          ctx.save(); ctx.globalAlpha = a5 * (0.5 + 0.3 * Math.sin(t * 0.9 + i * 1.7));
          ctx.translate(cx + ox - box / 2, cy + oy - box / 2);
          SV.soundShape(ctx, box, box, ps[i % 3], t * 0.7 + i * 1.3, 0.1 + 0.08 * (1 + Math.sin(t * 0.9 + i)), { scale: 0.42 });
          ctx.restore();
        }
      }
      // ---- scene 4: one breathing circle — the hero is born ----
      if (t >= T.s4) {
        const a4 = ease(T.s4, T.s4 + 1.2, t) * (1 - ease(T.end - 1.1, T.end, t));
        const breathe = 1 + Math.sin(t * 1.1) * 0.045;
        const box4 = Math.min(w, h) * 0.6;
        ctx.save(); ctx.globalAlpha = a4; ctx.translate(cx - box4 / 2, cy - box4 / 2);
        SV.soundShape(ctx, box4, box4, pBrown, t * 0.6, 0.22, { scale: 0.42 * breathe });
        ctx.restore();
        for (let i = 0; i < 2; i++) {
          const ph = ((t * 0.125 + i / 2) % 1);
          ctx.beginPath(); ctx.arc(cx, cy, 70 + ph * 160, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(159,224,187,${(1 - ph) * 0.16 * a4})`; ctx.lineWidth = 1.2; ctx.stroke();
        }
      }
    }
    raf = requestAnimationFrame(frame);
  }
})();
