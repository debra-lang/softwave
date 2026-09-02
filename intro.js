/* Find My Quiet Sound — opening story (PROTOTYPE).
   Active ONLY with ?intro=1 — not part of the product until approved.
   Opens on a "Tap to begin" frame (the tap unlocks audio), then four scenes,
   ~22 s, soft generated soundscape, tap anywhere to skip, reduced-motion aware.
   Built from the app's own visual language: ripple rings, sound-orbs, the breathing circle. */
(function () {
  'use strict';
  const qs = new URLSearchParams(location.search);
  if (qs.get('intro') !== '1') return;

  // ---- timeline (seconds) — tune freely ----
  const T = {
    s1: 0.0,   // the mark: ripple + logo bars + name
    s2: 4.2,   // "Everyone's tinnitus is different." — three distinct orbs
    s3: 10.0,  // A/B: "Better with A… or B?"
    s4: 16.7,  // merge into the breathing circle: "Your sound. One tap away."
    end: 22.0,
  };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const boot = () => { if (!window.SoftwaveVisuals || !document.body) return setTimeout(boot, 80); run(); };
  boot();

  function run() {
    const SV = window.SoftwaveVisuals;
    const style = document.createElement('style');
    style.textContent = `
      #fmqs-intro { position: fixed; inset: 0; z-index: 200; background: #0b1020; overflow: hidden;
        opacity: 1; transition: opacity .9s ease; }
      #fmqs-intro.out { opacity: 0; pointer-events: none; }
      #fmqs-intro canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
      .fi-line { position: absolute; left: 50%; transform: translateX(-50%); width: min(86vw, 560px);
        text-align: center; color: #e8ecf6; opacity: 0; transition: opacity 1.1s ease;
        font-family: 'Fraunces', Georgia, serif; font-weight: 300; letter-spacing: .04em; text-wrap: balance; }
      .fi-line.on { opacity: 1; }
      .fi-title { top: 62%; font-size: clamp(1.5rem, 5.4vw, 2.2rem); letter-spacing: .12em; }
      .fi-big  { top: 16%; font-size: clamp(1.45rem, 5.6vw, 2.1rem); }
      .fi-sub  { top: 26%; font-size: clamp(1rem, 3.6vw, 1.25rem); color: #9aa7c4;
        font-family: Manrope, system-ui, sans-serif; font-weight: 500; letter-spacing: .02em; }
      .fi-green { color: #9fe0bb; }
      .fi-skip { position: absolute; right: 18px; bottom: calc(18px + env(safe-area-inset-bottom, 0px));
        color: #9aa7c4; font: 600 .85rem Manrope, system-ui, sans-serif; letter-spacing: .06em;
        background: none; border: 0; padding: 10px 14px; cursor: pointer; opacity: .7; }
      .fi-ab { position: absolute; inset: 0; color: #9aa7c4; font: 700 1.1rem Manrope, sans-serif;
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

    const ov = document.createElement('div'); ov.id = 'fmqs-intro';
    ov.innerHTML = `
      <canvas></canvas>
      <div class="fi-line fi-title" data-at="0" data-off="3.6">FIND MY QUIET SOUND</div>
      <div class="fi-line fi-big" data-at="${T.s2 + 0.4}" data-off="${T.s3 - 0.6}">Everyone’s tinnitus is different.</div>
      <div class="fi-line fi-sub" data-at="${T.s2 + 2.2}" data-off="${T.s3 - 0.6}">Your comfortable sound should be too.</div>
      <div class="fi-line fi-big" data-at="${T.s3 + 0.4}" data-off="${T.s3 + 3.1}">Better with A… or B?</div>
      <div class="fi-line fi-sub fi-green" data-at="${T.s3 + 3.3}" data-off="${T.s4 - 0.4}">It learns what you prefer.</div>
      <div class="fi-line fi-big" data-at="${T.s4 + 0.8}" data-off="${T.end - 1.2}">Your sound. <span class="fi-green">One tap away.</span></div>
      <div class="fi-ab" data-at="${T.s3 + 0.2}" data-off="${T.s4 - 0.2}"><span>A</span><span>B</span></div>
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
        // warm pad: three detuned triangles through a gentle lowpass
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.4; lp.connect(master);
        const padG = ac.createGain(); padG.gain.value = 0.15; padG.connect(lp);
        [[110, 0.11], [164.81, 0.1], [220, 0.05]].forEach(([f, g0], i) => {
          const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = (i - 1) * 4;
          const g = ac.createGain(); g.gain.value = g0; o.connect(g); g.connect(padG); o.start();
        });
        // breathing noise bed (very quiet, slow swell)
        const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
        const nlp = ac.createBiquadFilter(); nlp.type = 'lowpass'; nlp.frequency.value = 420;
        const ng = ac.createGain(); ng.gain.value = 0.04;
        src.connect(nlp); nlp.connect(ng); ng.connect(master); src.start();
        const lfo = ac.createOscillator(); lfo.frequency.value = 0.07;
        const lg = ac.createGain(); lg.gain.value = 0.02; lfo.connect(lg); lg.connect(ng.gain); lfo.start();
        // master envelope: fade in over 2.5 s, fade out over the final 2 s
        const t = ac.currentTime, endAt = t + T.end;
        master.gain.setValueAtTime(0, t);
        master.gain.linearRampToValueAtTime(0.85, t + 2.5);
        master.gain.setValueAtTime(0.85, endAt - 2.1);
        master.gain.linearRampToValueAtTime(0.0001, endAt - 0.1);
        // soft chimes at scene changes; twin detuned pair at s4 for a faint shimmer
        const bell = (at, f, amp) => {
          const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f;
          const g = ac.createGain(); g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(amp, at + 0.07);
          g.gain.exponentialRampToValueAtTime(0.0001, at + 2.4);
          o.connect(g); g.connect(master); o.start(at); o.stop(at + 2.6);
        };
        bell(t + T.s2 + 0.3, 440, 0.06);
        bell(t + T.s3 + 0.3, 550, 0.06);
        bell(t + T.s4 + 0.6, 660, 0.08); bell(t + T.s4 + 0.63, 662, 0.05);
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

    function finish() {
      if (done) return; done = true;
      cancelAnimationFrame(raf);
      stopAudio();
      ov.classList.add('out');
      setTimeout(() => { ov.remove(); style.remove(); }, 950);
    }
    function begin() {
      if (started || done) return; started = true;
      t0 = performance.now();
      ov.classList.add('started');
      startAudio();
    }
    ov.addEventListener('click', () => { started ? finish() : begin(); });
    ov.querySelector('.fi-skip').addEventListener('click', (e) => { e.stopPropagation(); finish(); });
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
      if (t >= T.s3 && t < T.s4 + 0.8) {
        const a3 = ease(T.s3, T.s3 + 0.8, t) * (1 - ease(T.s4 - 0.5, T.s4 + 0.7, t));
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
