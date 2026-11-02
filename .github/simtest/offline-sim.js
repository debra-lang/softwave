/* TEST-ONLY: runs the offline engine comparison (offline-compare.js) inside the simulator's WebKit, with the same random sequence for each engine version.
   Simulator results are NOT proof of iPhone sound quality. */
(function () {
  if (location.pathname.replace(/\/index\.html$/, '/') !== '/') return;
  try { localStorage.setItem('softwave:welcomed', 'true'); localStorage.setItem('softwave:introSeen', '1'); localStorage.setItem('softwave:analytics', JSON.stringify({ choice: 'denied', at: new Date().toISOString() })); } catch (e) { }
  var SINK = 'http://127.0.0.1:8799/';
  function emit(o) { return fetch(SINK, { method: 'POST', mode: 'no-cors', body: 'AUDIT ' + JSON.stringify(o) }).catch(function () { }); }
  function load(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  addEventListener('load', function () { setTimeout(async function () {
    try {
      var E = {};
      for (var name of ['orig', 'pin', 'pool']) { await load('engine-' + name + '.js'); E[name] = window.SoftwaveAudio; }
      await load('offline-compare.js');
      var ids = E.orig.SOUND_DEFS.map(function (d) { return d.id; });
      for (var id of ids) { var r = await offlineCompare(E, { seconds: 30, ids: [id] }); await emit({ tag: 'row', id: id, r: r[id] }); }
    } catch (e) { await emit({ tag: 'error', error: String(e && e.stack || e).slice(0, 400) }); }
    await emit({ tag: 'done' });
  }, 4000); });
})();
