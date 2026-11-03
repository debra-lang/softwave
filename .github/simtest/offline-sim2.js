/* TEST-ONLY: repeats the offline comparison in the simulator's WebKit with the original engine compared against itself as a control, to tell engine differences from run-to-run differences.
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
      for (var pair of [['orig', 'orig'], ['same', 'orig'], ['pin', 'pin'], ['pool', 'pool']]) { await load('engine-' + pair[1] + '.js'); E[pair[0]] = window.SoftwaveAudio; }
      await load('offline-compare.js');
      for (var round = 0; round < 8; round++) for (var id of ['cicadas', 'rain', 'fire', 'glassrain', 'lapping', 'thunder', 'leaves']) { var r = await offlineCompare(E, { seconds: 30, ids: [id] }); await emit({ tag: 'row', round: round, id: id, r: r[id] }); }
    } catch (e) { await emit({ tag: 'error', error: String(e && e.stack || e).slice(0, 400) }); }
    await emit({ tag: 'done' });
  }, 4000); });
})();
