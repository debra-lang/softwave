/* TEST-ONLY recovery check (Nov 2026), injected into simulator builds. Plays Rain and reports every 5 s while the runner breaks the audio system from outside.
   mode gpukill / cakill: the WebKit audio process or the host's coreaudiod is killed during playback, twice. Each time: 45 s with no action, to see whether audio recovers on its own,
   then Stop and Play, as a person would. mode castop: the host's coreaudiod is frozen while the app starts and asks for sound, then released, and sound is asked for again.
   mode castart: coreaudiod is frozen well before the first tap, the page waits 240 s so that the freeze is certainly on, the runner releases it 30 s after the page reports the tap (or after 300 s if it never does), and the page keeps reporting even if the start never returns.
   mode carelaunch: coreaudiod is killed during playback, and after Stop and Play the runner closes and reopens the app, to see whether a relaunch brings sound back.
   This measures the audio graph (clock, level before the output), not what reaches a speaker. Simulator results are NOT proof of iPhone behaviour. */
(function () {
  if (location.pathname.replace(/\/index\.html$/, '/') !== '/') return;
  var CFG = /*CFG*/{"sound":"rain","minutes":2,"mode":"gpukill"}/*END*/;
  try {
    localStorage.setItem('softwave:welcomed', 'true'); localStorage.setItem('softwave:introSeen', '1');
    localStorage.setItem('softwave:analytics', JSON.stringify({ choice: 'denied', at: new Date().toISOString() }));
  } catch (e) { }
  var T0 = Date.now(), SINK = 'http://127.0.0.1:8799/';
  function emit(tag, o) { var r = Object.assign({ tag: tag, at: Math.round((Date.now() - T0) / 1000) }, o || {}); try { console.log('SOAK ' + JSON.stringify(r)); } catch (e) { } try { fetch(SINK, { method: 'POST', mode: 'no-cors', body: 'SOAK ' + JSON.stringify(r) }).catch(function () { }); } catch (e) { } }
  var w = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  addEventListener('error', function (e) { emit('pageerror', { error: String(e.message).slice(0, 160) }); });
  addEventListener('unhandledrejection', function (e) { emit('pagerejection', { error: String(e.reason && (e.reason.name + ': ' + e.reason.message)).slice(0, 160) }); });
  function level() {
    var a = softwave.analyser; if (!a) return null;
    var b = new Float32Array(a.fftSize), s = 0; a.getFloatTimeDomainData(b); for (var i = 0; i < b.length; i++) s += b[i] * b[i];
    return s > 0 ? +(10 * Math.log10(s / b.length)).toFixed(1) : -200;
  }
  async function beat(label, secs) {
    var end = Date.now() + secs * 1000;
    while (Date.now() < end) {
      var c = softwave.ctx, t = Date.now(), ct = c ? c.currentTime : 0; await w(5000);
      var r = c ? (c.currentTime - ct) / ((Date.now() - t) / 1000) : null;
      emit('beat', { label: label, rate: r === null ? null : +r.toFixed(3), state: c ? c.state : 'none', sr: c ? c.sampleRate : null, db: level(), el: softwave.mediaOut ? (softwave.mediaOut.paused ? 'paused' : 'playing') : 'none', active: softwave.active.size, buffers: !!(softwave.buffers && softwave.buffers.white), playing: softwave.isPlaying });
    }
  }
  async function play(label) { try { await softwave.startSound('rain', 0.6); emit('play', { label: label, ok: true }); } catch (e) { emit('play', { label: label, ok: false, error: String(e && (e.name + ': ' + e.message)).slice(0, 160), sr: softwave.ctx ? softwave.ctx.sampleRate : null }); } }
  addEventListener('load', function () { setTimeout(async function () {
    emit('start', { cfg: CFG, proto: !!(softwave._voices) });
    if (CFG.mode === 'carelaunch' && localStorage.getItem('rec:first')) { await play('after a relaunch'); await beat('after a relaunch', 30); softwave.stopAll(); emit('done', {}); return; }
    if (CFG.mode === 'carelaunch') localStorage.setItem('rec:first', '1');
    if (CFG.mode === 'castart') {
      emit('breakreq', { n: 1 }); await w(240000);
      var settled = null; var pp = play('first, during freeze').then(function () { settled = Date.now(); emit('settled', {}); });
      await beat('frozen, then released, no action', 90); emit('state', { settled: settled !== null, ctx: softwave.ctx ? softwave.ctx.state : 'none', initPromise: !!softwave._initPromise });
      softwave.stopAll(); await w(1500); var p2 = play('Stop and Play'); await beat('after Stop and Play', 30);
      softwave.stopAll(); emit('done', {}); return;
    }
    if (CFG.mode === 'carelaunch') {
      await play('first'); await beat('before', 20);
      emit('breakreq', { n: 1 }); await beat('broken, no action', 30);
      softwave.stopAll(); await w(1500); await play('Stop and Play'); await beat('after Stop and Play', 15);
      emit('done', {}); return;
    }
    if (CFG.mode === 'castop') {
      emit('breakreq', { n: 1 }); await w(4000);
      await play('during freeze'); await beat('during freeze', 25);
      emit('releasereq', {}); await beat('released, no action', 30);
      await play('asked again'); await beat('after asking again', 30);
      softwave.stopAll(); await w(1500); await play('Stop and Play'); await beat('after Stop and Play', 30);
    } else {
      await play('first'); await beat('before', 40);
      for (var n = 1; n <= 2; n++) {
        emit('breakreq', { n: n }); await beat('broken ' + n + ', no action', 45);
        softwave.stopAll(); await w(1500); await play('Stop and Play ' + n); await beat('after Stop and Play ' + n, 30);
      }
    }
    softwave.stopAll(); emit('done', {});
  }, 3000); });
})();
