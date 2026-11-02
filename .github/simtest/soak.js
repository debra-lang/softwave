/* TEST-ONLY controlled soak (Nov 2026), injected into simulator builds. One sound or a mix at level 60 from launch: no analyser and no taps, only node counters.
   Reads the engine clock every 2 s and reports every 30 s. Then stops, waits, restarts, to see whether any cost survives a stop.
   cycle = repeated stopping, restarting and switching across the event sounds. Optional experiments, applied around the unchanged engine: gc = allocation pressure so the
   garbage collector runs; disc = disconnect each one-shot source when it ends.
   Simulator results are NOT proof of iPhone sound quality. */
(function () {
  if (location.pathname.replace(/\/index\.html$/, '/') !== '/') return;
  var CFG = /*CFG*/{"sound":"rain","minutes":2,"mode":"plain"}/*END*/;
  try {
    localStorage.setItem('softwave:welcomed', 'true'); localStorage.setItem('softwave:introSeen', '1');
    localStorage.setItem('softwave:analytics', JSON.stringify({ choice: 'denied', at: new Date().toISOString() }));
  } catch (e) { }
  var T0 = Date.now(), SINK = 'http://127.0.0.1:8799/';
  function emit(tag, o) { var r = Object.assign({ tag: tag, at: Math.round((Date.now() - T0) / 1000) }, o || {}); try { console.log('SOAK ' + JSON.stringify(r)); } catch (e) { } try { fetch(SINK, { method: 'POST', mode: 'no-cors', body: 'SOAK ' + JSON.stringify(r) }).catch(function () { }); } catch (e) { } }
  var P = (window.BaseAudioContext || window.AudioContext || window.webkitAudioContext).prototype, C = { filters: 0, sources: 0, ended: 0 };
  var oF = P.createBiquadFilter; P.createBiquadFilter = function () { C.filters++; return oF.apply(this, arguments); };
  var o = P.createBufferSource;
  P.createBufferSource = function () { var n = o.apply(this, arguments); C.sources++; n.addEventListener('ended', function () { C.ended++; if (CFG.mode === 'disc') { try { n.disconnect(); } catch (e) { } } }); return n; };
  var w = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var heap = function () { return performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : undefined; };
  async function watch(label, secs) {
    var c = softwave.ctx, end = Date.now() + secs * 1000;
    while (Date.now() < end) {
      var t = Date.now(), ct = c.currentTime, t0 = t, ct0 = ct, min = 9, max = 0, stalls = 0, lag = 0, stop = Math.min(end, t + 30000);
      while (Date.now() < stop) {
        var a = Date.now(); await w(2000); var now = Date.now(), ct2 = c.currentTime, x = (ct2 - ct) / ((now - t) / 1000);
        lag = Math.max(lag, now - a - 2000); if (x < min) min = x; if (x > max) max = x; if (x < 0.8) stalls++; t = now; ct = ct2;
      }
      emit('clock', Object.assign({ label: label, rate: +((ct - ct0) / ((t - t0) / 1000)).toFixed(4), min: +min.toFixed(3), max: +max.toFixed(3), stalls: stalls, lagMs: lag, state: c.state, el: softwave.mediaOut ? (softwave.mediaOut.paused ? 'paused' : 'playing') : 'none', active: softwave.active.size }, C));
    }
  }
  var junk = [];
  function pressure() { return setInterval(function () { junk = []; for (var i = 0; i < 40; i++) { var a = new Array(50000); for (var k = 0; k < a.length; k += 1000) a[k] = { k: k }; junk.push(a); } }, 5000); }
  var list = String(CFG.sound).split(',');
  async function startAll(ids) { for (var i = 0; i < ids.length; i++) await softwave.startSound(ids[i], 0.6); }
  async function goTo(ids) { Array.from(softwave.active.keys()).forEach(function (id) { if (ids.indexOf(id) < 0) softwave.stopSound(id); }); await startAll(ids); }
  // One pass takes about five minutes and covers every kind of stop: the filter sounds, a mix, bands, a custom sound, oscillators, reverb, and quick restarts.
  var STEPS = [[['rain'], 90], [['rain', 'fire'], 30], [['glassrain', 'lapping'], 30], [[], 5], [['thunder', 'leaves'], 20], [['paint'], 15], [['sculpt'], 15], [['forest', 'crickets', 'chimes'], 20], [['drift'], 15], [['fire'], 20]];
  async function cycle(secs) {
    var end = Date.now() + secs * 1000, pass = 0;
    while (Date.now() < end) {
      pass++;
      for (var i = 0; i < STEPS.length && Date.now() < end; i++) { await goTo(STEPS[i][0]); await watch('cycle', STEPS[i][1]); }
      for (var q = 0; q < 8 && Date.now() < end; q++) { await softwave.startSound('rain', 0.6); await w(2500); softwave.setVolume('rain', q % 2 ? 0.6 : 1); await w(500); softwave.stopAll(); await w(1000); }
      emit('pass', { pass: pass });
    }
    softwave.stopAll();
  }
  addEventListener('load', function () { setTimeout(async function () {
    emit('start', { cfg: CFG, ua: navigator.userAgent.slice(0, 60), proto: !!(softwave._voices), heap: heap() });
    var gc = CFG.mode === 'gc' ? pressure() : 0;
    try {
      await softwave.startSound(CFG.mode === 'cycle' ? 'rain' : list[0], 0.6); softwave.setMasterVolume(0.45);
      if (CFG.mode === 'cycle') await cycle(CFG.minutes * 60);
      else { await startAll(list); await watch('play', CFG.minutes * 60); softwave.stopAll(); }
      emit('stopped', {});
      await watch('idle', 120);
      await startAll(list);
      await watch('restart', 300);
      softwave.stopAll();
      await watch('idle2', 60);
    } catch (e) { emit('error', { error: String(e && e.stack || e).slice(0, 300) }); }
    if (gc) clearInterval(gc);
    emit('done', C);
  }, 3000); });
})();
