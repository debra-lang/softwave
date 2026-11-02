/* TEST-ONLY audio audit (Nov 2026). Runs unchanged in local Chrome (softwave-tests) and in iOS simulator builds (injected as the
   first script of www/index.html). It drives the real engine through its public methods and only observes: counters around node
   creation/connection and a parallel analyser for short audio windows. Long windows read the clock only, so the audit itself adds
   next to no load. window.__AUDIT_CFG = { scale, sink, autorun }. Every result: emit(tag, object) -> window.__auditLog, console, sink.
   Simulator or Chrome success is NOT proof of iPhone sound quality. */
(function () {
  if (location.pathname.replace(/\/index\.html$/, '/') !== '/') return;
  var CFG = window.__AUDIT_CFG || { scale: 1, sink: 'http://127.0.0.1:8799/', autorun: true };
  try {
    localStorage.setItem('softwave:welcomed', 'true'); localStorage.setItem('softwave:introSeen', '1');
    localStorage.setItem('softwave:analytics', JSON.stringify({ choice: 'denied', at: new Date().toISOString() }));
  } catch (e) { }
  var N = window.__n = { src: 0, ended: 0, conn: 0, disc: 0, made: {}, liveById: 0 };
  var P = (window.BaseAudioContext || window.AudioContext || window.webkitAudioContext).prototype;
  ['createBufferSource', 'createOscillator', 'createGain', 'createBiquadFilter', 'createStereoPanner', 'createConvolver', 'createDynamicsCompressor', 'createDelay', 'createWaveShaper', 'createMediaStreamDestination'].forEach(function (m) {
    var o = P[m]; if (!o) return;
    P[m] = function () { var n = o.apply(this, arguments); N.made[m] = (N.made[m] || 0) + 1; if (m === 'createBufferSource' || m === 'createOscillator') { N.src++; n.addEventListener('ended', function () { N.ended++; }); } return n; };
  });
  var AN = AudioNode.prototype, cn = AN.connect, dn = AN.disconnect;
  AN.connect = function () { N.conn++; return cn.apply(this, arguments); }; AN.disconnect = function () { N.disc++; return dn.apply(this, arguments); };

  var LOG = window.__auditLog = [], T0 = Date.now();
  function emit(tag, o) { var r = Object.assign({ tag: tag, at: Math.round((Date.now() - T0) / 1000) }, o || {}); LOG.push(r); var s = 'AUDIT ' + JSON.stringify(r); try { console.log(s); } catch (e) { } if (CFG.sink) { try { fetch(CFG.sink, { method: 'POST', mode: 'no-cors', body: s }); } catch (e) { } } }
  var errs = []; addEventListener('error', function (e) { errs.push(String(e.message).slice(0, 160)); }); addEventListener('unhandledrejection', function (e) { errs.push('rej: ' + String(e.reason && e.reason.message || e.reason).slice(0, 160)); });
  var w = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var S = function (x) { return Math.max(1, Math.round(x * (CFG.scale || 1))); };
  var db = function (x) { return x > 0 ? +(10 * Math.log10(x)).toFixed(1) : -120; };
  var seed = 42; var rnd = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  var pick = function (a) { return a[Math.floor(rnd() * a.length)]; };

  // clock only: engine clock against wall clock, every 2 s; stalls (<0.8x) and jumps (>1.3x); event-loop lag
  async function clock(secs) {
    var e = softwave, c = e.ctx, r = [], stalls = 0, jumps = 0, lagMax = 0, t = Date.now(), ct = c.currentTime, t0 = t, ct0 = ct, end = t + secs * 1000;
    while (Date.now() < end) {
      var a = Date.now(); await w(2000); var now = Date.now(); lagMax = Math.max(lagMax, now - a - 2000);
      var ct2 = c.currentTime, x = (ct2 - ct) / ((now - t) / 1000); r.push(x); if (x < 0.8) stalls++; if (x > 1.3) jumps++; t = now; ct = ct2;
    }
    r.sort(function (a, b) { return a - b; });
    return { rate: +((ct - ct0) / ((t - t0) / 1000)).toFixed(4), med: +r[r.length >> 1].toFixed(3), min: +r[0].toFixed(3), max: +r[r.length - 1].toFixed(3), stalls: stalls, jumps: jumps, lagMs: lagMax, state: c.state, el: e.mediaOut ? (e.mediaOut.paused ? 'paused' : 'playing') : 'none', live: N.src - N.ended };
  }
  // short audio window (a parallel analyser after the limiter), plus the limiter's own reduction
  var tap = null, tapBuf = null;
  function ensureTap() { var e = softwave; if (tap && tap.context === e.ctx) return; tap = e.ctx.createAnalyser(); tap.fftSize = 8192; tap.smoothingTimeConstant = 0; e.limiter.connect(tap); tapBuf = new Float32Array(tap.fftSize); }
  async function audio(secs) {
    ensureTap(); var e = softwave, sum = 0, n = 0, pk = 0, clip = 0, step = 0, red = 0, sr = e.ctx.sampleRate, frames = Math.floor(secs * sr / tap.fftSize);
    for (var f = 0; f < frames; f++) {
      await w(tap.fftSize / sr * 1000); tap.getFloatTimeDomainData(tapBuf); var p = 0, s = 0;
      for (var i = 0; i < tapBuf.length; i++) { var v = tapBuf[i], av = v < 0 ? -v : v; s += v * v; if (av > p) p = av; if (av >= 0.999) clip++; if (i) { var d = Math.abs(v - tapBuf[i - 1]); if (d > step) step = d; } }
      sum += s / tapBuf.length; n++; if (p > pk) pk = p; red = Math.max(red, -e.limiter.reduction);
    }
    return { rmsDb: db(sum / Math.max(n, 1)), peak: +pk.toFixed(3), clip: clip, step: +step.toFixed(3), limDb: +red.toFixed(1) };
  }
  var stopAll = async function (ms) { softwave.stopAll(); await w(ms || 1300); };
  var mine = function () { return { src: N.src, ended: N.ended, conn: N.conn, disc: N.disc, gain: N.made.createGain || 0, biq: N.made.createBiquadFilter || 0, osc: N.made.createOscillator || 0 }; };
  var askRun = async function (t) { try { await softwaveAssistant.run(t); } catch (e) { errs.push('ask ' + t + ': ' + e.message); } };

  async function baseline(label) {
    await stopAll(); await softwave.startSound('rain', 0.6); await w(2500);
    var a = await audio(3), c = await clock(S(60)); emit('rain60', Object.assign({ label: label }, a, c)); await stopAll();
  }

  // ---------- every sound: start, level, stop, restart, cleanup ----------
  async function everySound() {
    var LAB = ['thunder', 'city', 'cabin', 'drift', 'chimes', 'paint', 'sculpt', 'discoA', 'discoB'], ids = softwave.defs().map(function (d) { return d.id; }).concat(LAB.filter(function (x) { return !!softwave.def(x); }));
    emit('inventory', { ids: ids, lab: LAB });
    softwave.setMasterVolume(0.45);
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i], o = { id: id };
      try {
        await stopAll(600); var before = mine();
        var ok = await softwave.startSound(id, 0.6); o.started = ok !== false && softwave.isActive(id);
        await w(1500); var a1 = await audio(4); o.rms60 = a1.rmsDb; o.peak60 = a1.peak; o.clip60 = a1.clip; o.step = a1.step; o.limDb60 = a1.limDb;
        var m1 = mine(); await w(6000); var m2 = mine(); o.ratePerS = +((m2.src - m1.src) / 6).toFixed(2);
        o.nodesAt = m2.gain + m2.biq - before.gain - before.biq;
        softwave.setVolume(id, 1); await w(300); var a2 = await audio(3); o.rms100 = a2.rmsDb; o.peak100 = a2.peak; o.clip100 = a2.clip; o.limDb100 = a2.limDb;
        softwave.stopSound(id); await w(1500); var a3 = await audio(1); o.rmsAfterStop = a3.rmsDb; var m3 = mine(); await w(2000); var m4 = mine(); o.madeAfterStop = m4.src - m3.src; o.active = softwave.activeList().length;
        for (var k = 0; k < 3; k++) { await softwave.startSound(id, 0.6); await w(250); softwave.stopSound(id); await w(250); }
        await softwave.startSound(id, 0.6); await w(1500); var a4 = await audio(2); o.rmsRestart = a4.rmsDb;
        var m5 = mine(); await w(6000); var m6 = mine(); o.ratePerSRestart = +((m6.src - m5.src) / 6).toFixed(2);
        softwave.stopSound(id); await w(1300); o.live = N.src - N.ended;
      } catch (e) { o.error = String(e.message).slice(0, 160); }
      emit('sound', o);
    }
    await stopAll(); await w(S(25) * 1000); emit('cleanup', { live: N.src - N.ended, src: N.src, conn: N.conn, disc: N.disc, made: N.made });
  }

  // ---------- repeated switching, mixing, Ask, Mixer-style level changes ----------
  async function stress() {
    var lib = softwave.defs().filter(function (d) { return !d.lab; }).map(function (d) { return d.id; });
    var said = ['add wind', 'go back', 'rain louder', 'rain softer', 'play rain and ocean', 'stop', 'play rain', 'add ocean', 'louder', 'softer', 'warmer', 'brighter', 'more movement', 'steadier', 'Edwin'];
    var n = S(250), counts = {}, m0 = mine(), maxLive = 0;
    for (var i = 0; i < n; i++) {
      var r = rnd(), act = softwave.activeList(), op;
      try {
        if (r < 0.2) { op = 'start'; await softwave.startSound(pick(lib), 0.2 + rnd() * 0.6); }
        else if (r < 0.35 && act.length) { op = 'stop'; softwave.stopSound(pick(act).id); }
        else if (r < 0.5) { op = 'mix'; var k = 1 + Math.floor(rnd() * 3), mix = []; while (mix.length < k) { var d = pick(lib); if (!mix.some(function (x) { return x.id === d; })) mix.push(d); } await softwave.loadMix(mix.map(function (x) { return { id: x, volume: 0.2 + rnd() * 0.6, balance: 0 }; })); }
        else if (r < 0.7 && act.length) { op = 'level'; var q = pick(act); softwave.setVolume(q.id, 0.05 + rnd() * 0.95); softwave.setBalance(q.id, rnd() * 2 - 1); }
        else if (r < 0.78) { op = 'master'; softwave.setMasterVolume(0.2 + rnd() * 0.6); }
        else if (r < 0.83) { op = 'pause'; await softwave.pauseAll(); await w(300); await softwave.playAll(); }
        else { op = 'ask'; await askRun(pick(said)); }
      } catch (e) { errs.push(op + ': ' + e.message); }
      counts[op] = (counts[op] || 0) + 1; maxLive = Math.max(maxLive, N.src - N.ended);
      await w(250 + rnd() * 700);
    }
    softwave.setVariation(0); if (softwave.resetMasterShape) softwave.resetMasterShape(); softwave.setMasterVolume(0.45);
    await stopAll(); var m1 = mine(); await w(S(25) * 1000);
    emit('stress', { ops: n, counts: counts, maxLive: maxLive, liveAfter: N.src - N.ended, connAdded: m1.conn - m0.conn, discAdded: m1.disc - m0.disc, active: softwave.activeList().length, masterGain: +softwave.master.gain.value.toFixed(3), errs: errs.length });
    // the heaviest allowed mix, level check
    var loud = ['fire', 'crickets', 'forest', 'ocean', 'rain'];
    for (var j = 0; j < loud.length; j++) await softwave.startSound(loud[j], 0.6);
    await w(2500); var a = await audio(5), c = await clock(S(30)); emit('fivemix', Object.assign({ level: 60, n: softwave.activeList().length }, a, c));
    softwave.activeList().forEach(function (s) { softwave.setVolume(s.id, 1); }); softwave.setMasterVolume(1); await w(800); var a2 = await audio(5); emit('fivemix', Object.assign({ level: 100, master: 100 }, a2));
    softwave.setMasterVolume(0.45); await stopAll();
  }

  // ---------- output detach / reattach, the way the app does it when nothing is playing ----------
  async function detach() {
    var e = softwave; if (!e.mediaOut || !e._withdrawControls) { emit('detach', { skipped: 'no routed output or no detach code here' }); return; }
    await stopAll(); await w(1800); var ev = 0, off = e.on(function (t, d) { if (t === 'softpause' && d === 'controls-withdrawn') ev++; });
    var nat = S(30); for (var i = 0; i < nat; i++) { document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await w(5200); }
    emit('detach', { kind: 'natural', touches: nat, withdrawn: ev, det: !!e._outDetached }); await baseline('after ' + nat + ' natural detach cycles');
    var fast = S(300); for (var j = 0; j < fast; j++) { e._restoreControls(); try { await Promise.race([e.mediaOut.play(), w(400)]); } catch (x) { } await w(120); e._withdrawControls(); await w(80); }
    emit('detach', { kind: 'fast', cycles: fast, withdrawn: ev }); await baseline('after ' + fast + ' fast detach cycles');
    if (off) off();
  }

  // ---------- extended stability, one sound per processing category ----------
  async function extended() {
    var cats = { noise: 'brown', 'filtered+LFO': 'ocean', 'scheduled events': 'rain', 'oscillators+events': 'crickets', 'many layers': 'summernight', 'noise+crackle': 'fire' };
    for (var cat in cats) {
      var id = cats[cat]; await stopAll(); await softwave.startSound(id, 0.6); await w(2500); var mins = S(3);
      for (var m = 0; m < mins; m++) { var a = await audio(5), c = await clock(52); emit('ext', Object.assign({ cat: cat, id: id, minute: m + 1 }, a, c)); }
      await stopAll();
    }
  }

  // ---------- full-screen view: the stall on the phone began seconds after it opened ----------
  async function visual() {
    await stopAll(); var card = document.querySelector('#sound-groups .sound-card[data-id="rain"] .card-btn');
    if (!card) { emit('visual', { skipped: 'no card' }); return; }
    if (window.softwaveApp && softwaveApp.showView) { try { softwaveApp.showView('sounds'); } catch (e) { } } await w(500);
    card.click(); await w(6500); var n = document.getElementById('now'); var open = !!(n && !n.hidden);
    var c = await clock(S(60)); emit('visual', Object.assign({ open: open }, c));
    if (window.softwaveApp && softwaveApp.closeNow) { try { softwaveApp.closeNow(); } catch (e) { } } await stopAll();
  }

  // ---------- the two local fixes, where the code has them ----------
  async function fixes() {
    if (!(window.softwaveApp && softwaveApp.syncLevels)) { emit('fixes', { skipped: 'code before the fixes' }); return; }
    await stopAll(); localStorage.setItem('softwave:soundvol:rain', '0.6'); await askRun('play rain'); await w(1200);
    var read = function () { var e = softwave.active.get('rain'), c = document.querySelector('#sound-groups .sound-card[data-id="rain"]'), m = document.getElementById('chv-rain'); return [e ? Math.round(e.volume * 100) : null, +c.querySelector('input').value, m ? +m.value : null]; };
    await askRun('rain louder'); await w(500); var a = read(); await askRun('go back'); await w(800); var b = read();
    await askRun('Edwin'); await w(300); var q = !!document.getElementById('ask-did-mean'), keep = softwave.activeList().length; var btn = document.getElementById('ask-did-mean'); if (btn) btn.click(); await w(900); var ids = softwave.activeList().map(function (s) { return s.id + ':' + Math.round(s.volume * 100); }).join();
    emit('fixes', { louder: a, goBack: b, edwinAsks: q, unchangedBeforeTap: keep === 1, afterTap: ids }); await stopAll();
  }

  async function run() {
    var t = 0; while (!(window.softwave && window.softwaveAssistant) && t++ < 200) await w(100);
    emit('start', { ua: navigator.userAgent.slice(0, 120), scale: CFG.scale, build: (document.getElementById('build-tag') || {}).textContent || null, shell: !!window.Capacitor, diag: !!window.__swDiag });
    try { await softwave.init(); } catch (e) { }
    emit('ctx', { state: softwave.ctx && softwave.ctx.state, sr: softwave.ctx && softwave.ctx.sampleRate, routed: !!softwave.mediaOut });
    var phases = [['fresh', function () { return baseline('fresh'); }], ['every', everySound], ['afterEvery', function () { return baseline('after every sound'); }], ['stress', stress], ['afterStress', function () { return baseline('after stress'); }], ['detach', detach], ['visual', visual], ['fixes', fixes], ['extended', extended], ['soak', async function () {
      await stopAll(); await softwave.startSound('rain', 0.6); await w(2500); var blocks = S(6);
      for (var b = 0; b < blocks; b++) { var a = await audio(5), c = await clock(295); emit('soak', Object.assign({ minute: (b + 1) * 5 }, a, c)); }
      await stopAll();
    }], ['final', function () { return baseline('end of session'); }]];
    for (var i = 0; i < phases.length; i++) {
      emit('phase', { name: phases[i][0] });
      try { await phases[i][1](); } catch (e) { emit('phase-error', { name: phases[i][0], error: String(e && e.stack || e).slice(0, 300) }); }
    }
    emit('end', { errs: errs.slice(0, 20), errCount: errs.length, live: N.src - N.ended, conn: N.conn, disc: N.disc, made: N.made, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, minutes: Math.round((Date.now() - T0) / 60000) });
    emit('done', {});
  }
  window.__audit = { run: run, log: LOG };
  if (CFG.autorun) addEventListener('load', function () { setTimeout(run, 3000); });
})();
