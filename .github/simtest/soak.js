/* TEST-ONLY controlled soak (Nov 2026), injected into simulator builds. One sound at level 60 from launch, nothing else: no analyser, no counters, no taps.
   Reads the engine clock every 2 s and reports every 30 s. Then stops, waits, restarts, to see whether any cost survives a stop.
   Optional experiments, applied around the unchanged engine: gc = allocation pressure so the garbage collector runs; disc = disconnect each one-shot source when it ends.
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
  if (CFG.mode === 'disc') {
    var P = (window.BaseAudioContext || window.AudioContext || window.webkitAudioContext).prototype, o = P.createBufferSource;
    P.createBufferSource = function () { var n = o.apply(this, arguments); n.addEventListener('ended', function () { try { n.disconnect(); } catch (e) { } }); return n; };
  }
  var w = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  async function watch(label, secs) {
    var c = softwave.ctx, end = Date.now() + secs * 1000;
    while (Date.now() < end) {
      var t = Date.now(), ct = c.currentTime, t0 = t, ct0 = ct, min = 9, max = 0, stalls = 0, lag = 0, stop = Math.min(end, t + 30000);
      while (Date.now() < stop) {
        var a = Date.now(); await w(2000); var now = Date.now(), ct2 = c.currentTime, x = (ct2 - ct) / ((now - t) / 1000);
        lag = Math.max(lag, now - a - 2000); if (x < min) min = x; if (x > max) max = x; if (x < 0.8) stalls++; t = now; ct = ct2;
      }
      emit('clock', { label: label, rate: +((ct - ct0) / ((t - t0) / 1000)).toFixed(4), min: +min.toFixed(3), max: +max.toFixed(3), stalls: stalls, lagMs: lag, state: c.state, el: softwave.mediaOut ? (softwave.mediaOut.paused ? 'paused' : 'playing') : 'none' });
    }
  }
  var junk = [];
  function pressure() { return setInterval(function () { junk = []; for (var i = 0; i < 40; i++) { var a = new Array(50000); for (var k = 0; k < a.length; k += 1000) a[k] = { k: k }; junk.push(a); } }, 5000); }
  addEventListener('load', function () { setTimeout(async function () {
    emit('start', { cfg: CFG, ua: navigator.userAgent.slice(0, 60) });
    var gc = CFG.mode === 'gc' ? pressure() : 0;
    try {
      await softwave.startSound(CFG.sound, 0.6); softwave.setMasterVolume(0.45);
      await watch('play', CFG.minutes * 60);
      softwave.stopAll(); emit('stopped', {});
      await watch('idle', 120);
      await softwave.startSound(CFG.sound, 0.6);
      await watch('restart', 300);
      softwave.stopAll();
    } catch (e) { emit('error', { error: String(e && e.stack || e).slice(0, 300) }); }
    if (gc) clearInterval(gc);
    emit('done', {});
  }, 3000); });
})();
