/* TEST-ONLY: repeats the offline comparison in the simulator's WebKit from a freshly loaded page each round, with the original engine against itself as a control and the
   engines in a different order each round, and counts the random numbers each render draws, to tell engine differences from run-to-run differences.
   Simulator results are NOT proof of iPhone sound quality. */
(function () {
  if (location.pathname.replace(/\/index\.html$/, '/') !== '/') return;
  try { localStorage.setItem('softwave:welcomed', 'true'); localStorage.setItem('softwave:introSeen', '1'); localStorage.setItem('softwave:analytics', JSON.stringify({ choice: 'denied', at: new Date().toISOString() })); } catch (e) { }
  var SINK = 'http://127.0.0.1:8799/', ROUNDS = 18, ORDERS = [['same', 'pin', 'pool'], ['pin', 'pool', 'same'], ['pool', 'same', 'pin']], FILE = { orig: 'orig', same: 'orig', pin: 'pin', pool: 'pool' };
  function emit(o) { return fetch(SINK, { method: 'POST', mode: 'no-cors', body: 'AUDIT ' + JSON.stringify(o) }).catch(function () { }); }
  function load(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  addEventListener('load', function () { setTimeout(async function () {
    var round = +(localStorage.getItem('offline:round') || 0);
    try {
      var E = {}, order = ['orig'].concat(ORDERS[round % 3]);
      for (var name of order) { await load('engine-' + FILE[name] + '.js'); E[name] = window.SoftwaveAudio; }
      await load('offline-compare.js');
      for (var id of ['cicadas', 'rain', 'fire', 'glassrain', 'lapping', 'thunder', 'leaves']) { var r = await offlineCompare(E, { seconds: 30, ids: [id] }); await emit({ tag: 'row', round: round, order: order, id: id, r: r[id] }); }
    } catch (e) { await emit({ tag: 'error', round: round, error: String(e && e.stack || e).slice(0, 400) }); }
    localStorage.setItem('offline:round', String(round + 1));
    if (round + 1 < ROUNDS) location.reload(); else await emit({ tag: 'done' });
  }, 4000); });
})();
