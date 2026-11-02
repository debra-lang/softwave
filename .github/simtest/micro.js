/* TEST-ONLY retention experiment (Nov 2026), injected into simulator builds. Plays Brown as a carrier, then fires droplet-shaped events at a high rate so that
   about 90 minutes of Rain's filter count is reached in a few minutes, then idles so that only what WebKit retained is left. Each variant changes one thing.
   Simulator results are NOT proof of iPhone sound quality. */
(function () {
  if (location.pathname.replace(/\/index\.html$/, '/') !== '/') return;
  var CFG = /*CFG*/{"variant":"base","rate":170,"run":270,"idle":240}/*END*/;
  try {
    localStorage.setItem('softwave:welcomed', 'true'); localStorage.setItem('softwave:introSeen', '1');
    localStorage.setItem('softwave:analytics', JSON.stringify({ choice: 'denied', at: new Date().toISOString() }));
  } catch (e) { }
  var T0 = Date.now(), SINK = 'http://127.0.0.1:8799/';
  function emit(tag, o) { var r = Object.assign({ tag: tag, at: Math.round((Date.now() - T0) / 1000) }, o || {}); try { fetch(SINK, { method: 'POST', mode: 'no-cors', body: 'MICRO ' + JSON.stringify(r) }).catch(function () { }); } catch (e) { } }
  var w = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  async function watch(label, secs, extra) {
    var c = softwave.ctx, end = Date.now() + secs * 1000;
    while (Date.now() < end) {
      var t0 = Date.now(), ct0 = c.currentTime; await w(10000);
      emit('clock', Object.assign({ label: label, rate: +((c.currentTime - ct0) / ((Date.now() - t0) / 1000)).toFixed(4) }, extra ? extra() : {}));
    }
  }
  var counts = { events: 0, filters: 0, ended: 0 };
  function mk(ctx, bus, B) {
    var R = Math.random, V = CFG.variant;
    var filt = function () { var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500 + R() * 5000; f.Q.value = 6; counts.filters++; return f; };
    var env = function (g, t) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.15 + R() * 0.25, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05 + R() * 0.08); };
    var src = function (buf) { var n = ctx.createBufferSource(); n.buffer = buf; counts.events++; return n; };
    var mono = ctx.createBuffer(1, B.white.length, ctx.sampleRate); mono.copyToChannel(B.white.getChannelData(0), 0);
    if (V === 'pool') {   // reusable voices: filter and envelope stay, only the source is new
      var N = Math.ceil(CFG.rate * 0.3), pool = [], i = 0;
      for (var k = 0; k < N; k++) { var f = filt(), g = ctx.createGain(); g.gain.value = 0; f.channelCountMode = 'explicit'; f.channelCount = 2; f.connect(g); g.connect(bus); pool.push({ f: f, g: g }); }
      return function (t) { var v = pool[i++ % N], n = src(B.white); v.f.frequency.setValueAtTime(1500 + R() * 5000, t); env(v.g, t); n.connect(v.f); n.start(t, R() * 5, 0.2); n.onended = function () { counts.ended++; try { n.disconnect(); } catch (e) { } }; };
    }
    if (V === 'bank') {   // fixed bank: sixteen fixed filters, a new source and envelope per event
      var M = 16, bank = [];
      for (var b = 0; b < M; b++) { var bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 1500 * Math.pow(6500 / 1500, b / (M - 1)); bf.Q.value = 6; bf.channelCountMode = 'explicit'; bf.channelCount = 2; bf.connect(bus); bank.push(bf); counts.filters++; }
      return function (t) { var n = src(B.white), g = ctx.createGain(); env(g, t); n.connect(g); g.connect(bank[Math.floor(R() * M)]); n.start(t, R() * 5, 0.2); n.onended = function () { counts.ended++; try { n.disconnect(); g.disconnect(); } catch (e) { } }; };
    }
    if (V === 'restart' || V === 'restartpin') {   // the shape of stopSound: a looped source and two filters torn down in one task
      return function (t) {
        var s = src(B.white); s.loop = true; var a = filt(), c = filt(), g = ctx.createGain(); g.gain.value = 0.02;
        if (V === 'restartpin') { [a, c].forEach(function (x) { x.channelCountMode = 'explicit'; x.channelCount = 2; }); }
        s.connect(a); a.connect(c); c.connect(g); g.connect(bus); s.start();
        setTimeout(function () { [s, a, c, g].forEach(function (x) { try { x.stop && x.stop(); } catch (e) { } try { x.disconnect(); } catch (e) { } }); counts.ended++; }, 1000);
      };
    }
    return function (t) {
      var n = src(V === 'mono' ? mono : B.white), f = V === 'gainonly' ? null : filt(), g = ctx.createGain();
      if (f && V === 'pin') { f.channelCountMode = 'explicit'; f.channelCount = 2; }
      env(g, t);
      if (f) { n.connect(f); f.connect(g); } else n.connect(g);
      g.connect(bus); n.start(t, R() * 5, 0.2);
      n.onended = function () {
        counts.ended++;
        if (V === 'nodisc') return;
        if (V === 'delay') { setTimeout(function () { try { f.disconnect(); g.disconnect(); } catch (e) { } }, 500); return; }
        try { if (f) f.disconnect(); g.disconnect(); } catch (e) { }
      };
    };
  }
  addEventListener('load', function () { setTimeout(async function () {
    emit('start', { cfg: CFG, ua: navigator.userAgent.slice(0, 60) });
    try {
      await softwave.startSound('brown', 0.6); softwave.setMasterVolume(0.45);
      var ctx = softwave.ctx, bus = ctx.createGain(); bus.gain.value = 0.2; bus.connect(softwave.master);
      await watch('before', 60);
      var fire = mk(ctx, bus, softwave.buffers), next = ctx.currentTime + 0.2, step = 1 / (CFG.variant.indexOf('restart') === 0 ? 5 : CFG.rate);
      var pump = setInterval(function () { var lim = ctx.currentTime + 1; while (next < lim) { fire(next); next += step; } }, 200);
      await watch('run', CFG.run, function () { return Object.assign({}, counts); });
      clearInterval(pump); emit('pumpstopped', counts);
      await watch('idle', CFG.idle, function () { return Object.assign({}, counts); });
    } catch (e) { emit('error', { error: String(e && e.stack || e).slice(0, 300) }); }
    emit('done', counts);
  }, 3000); });
})();
