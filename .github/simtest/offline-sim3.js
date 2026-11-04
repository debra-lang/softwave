/* TEST-ONLY: the offline comparison of the release candidate's engine against the original, for all 29 sounds in the simulator's WebKit, from a fresh page each round, with the original
   against itself as a control and the order changed each round. Simulator results are NOT proof of iPhone sound quality. */
(function () {
  if (location.pathname.replace(/\/index\.html$/, '/') !== '/') return;
  try { localStorage.setItem('softwave:welcomed', 'true'); localStorage.setItem('softwave:introSeen', '1'); localStorage.setItem('softwave:analytics', JSON.stringify({ choice: 'denied', at: new Date().toISOString() })); } catch (e) { }
  var SINK = 'http://127.0.0.1:8799/', ROUNDS = 4, ORDERS = [['same', 'rc'], ['rc', 'same']], FILE = { orig: 'orig', same: 'orig', rc: 'rc' };
  function emit(o) { return fetch(SINK, { method: 'POST', mode: 'no-cors', body: 'AUDIT ' + JSON.stringify(o) }).catch(function () { }); }
  function load(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  addEventListener('load', function () { setTimeout(async function () {
    var round = +(localStorage.getItem('offline:round') || 0);
    try {
      var E = {}, order = ['orig'].concat(ORDERS[round % 2]);
      for (var name of order) { await load('engine-' + FILE[name] + '.js'); E[name] = window.SoftwaveAudio; }
      await load('offline-compare.js');
      var ids = E.orig.SOUND_DEFS.map(function (d) { return d.id; });
      for (var id of ids) { var r = await offlineCompare(E, { seconds: 30, ids: [id] }); await emit({ tag: 'row', round: round, order: order, id: id, r: r[id] }); }
    } catch (e) { await emit({ tag: 'error', round: round, error: String(e && e.stack || e).slice(0, 400) }); }
    localStorage.setItem('offline:round', String(round + 1));
    if (round + 1 < ROUNDS) location.reload(); else await emit({ tag: 'done' });
  }, 4000); });
})();
