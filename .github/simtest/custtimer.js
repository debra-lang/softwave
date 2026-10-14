/* TEST-ONLY diagnostic (simulator builds only; never shipped). Drives the real Sleep screen → Timer sheet → Custom… →
   45 → Set flow and records, every 100 ms and on every event, what the engine reports (playing / userPaused / master)
   against what actually reaches the routed output (context state, element paused, element clock, analyser RMS),
   plus focus / keyboard / viewport events. Prints "CT <ms> <tag> <json>"; "CTSHOT <name>" asks for a screenshot. */
(function () {
  if (location.pathname.replace(/\/index\.html$/, '/') !== '/') return;
  try { localStorage.setItem('softwave:introSeen', '1'); localStorage.setItem('softwave:welcomed', 'true'); localStorage.setItem('softwave:analytics', JSON.stringify({ choice: 'denied', at: new Date().toISOString(), v: 1 })); } catch (e) { }
  var SINK = 'http://127.0.0.1:8799/'; var T0 = Date.now();
  var out = function (l) { console.log(l); try { fetch(SINK, { method: 'POST', mode: 'no-cors', body: l, keepalive: l.length < 60000 }); } catch (e) { } };
  var L = function (tag, o) { var s; try { s = JSON.stringify(o); } catch (e) { s = '"(unserializable)"'; } out('CT ' + (Date.now() - T0) + ' ' + tag + ' ' + s); };
  var w = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var rmsBuf = null;
  var rms = function () { try { var a = softwave.analyser; if (!a) return -1; var n = a.fftSize; if (!rmsBuf || rmsBuf.length !== n) rmsBuf = new Float32Array(n);
    if (a.getFloatTimeDomainData) a.getFloatTimeDomainData(rmsBuf); else { var b = new Uint8Array(n); a.getByteTimeDomainData(b); for (var q = 0; q < n; q++) rmsBuf[q] = (b[q] - 128) / 128; }
    var s = 0; for (var i = 0; i < n; i++) s += rmsBuf[i] * rmsBuf[i]; return Math.sqrt(s / n); } catch (e) { return -1; } };
  var snap = function () { var E = window.softwave; if (!E || !E.ctx) return { noEngine: true }; var m = E.mediaOut;
    return { ctx: E.ctx.state, el: m ? (m.paused ? 'PAUSED' : 'playing') : 'none', elT: m ? Math.round(m.currentTime * 100) / 100 : null, rms: Math.round(rms() * 10000) / 10000, master: E.master ? Math.round(E.master.gain.value * 10000) / 10000 : null,
      playing: !!E.isPlaying, up: E.userPaused, act: E.active.size, timer: (E.timer && E.timer.durationMin) || null, focus: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null, vv: window.visualViewport ? Math.round(window.visualViewport.height) : null, hidden: document.hidden }; };
  var hooks = function () { var E = softwave;
    ['pauseAll', 'playAll', 'stopAll', 'resume', '_keepAlive', 'setTimer', 'clearTimer', '_scheduleTimerFade', 'setMasterVolume', 'holdOutput', 'startSound', 'stopSound', 'loadMix'].forEach(function (n) { var o = E[n]; if (typeof o !== 'function') return;
      E[n] = function () { var a = [].slice.call(arguments).map(function (x) { return (x && typeof x === 'object') ? '[obj]' : x; }); L('call:' + n, { args: a, s: snap() }); return o.apply(this, arguments); }; });
    E.on(function (t, d) { if (t === 'timer' || t === 'master') return; L('ev:' + t, { d: typeof d === 'string' ? d : undefined, s: snap() }); });
    if (E.ctx) E.ctx.addEventListener('statechange', function () { L('ctx:' + E.ctx.state, snap()); });
    if (E.mediaOut) ['play', 'pause', 'playing', 'waiting', 'stalled', 'suspend', 'emptied', 'ended', 'error', 'abort'].forEach(function (ev) { E.mediaOut.addEventListener(ev, function () { L('element:' + ev, snap()); }); });
    document.addEventListener('focusin', function (e) { L('focusin', { t: e.target && (e.target.id || e.target.tagName), s: snap() }); });
    document.addEventListener('focusout', function (e) { L('focusout', { t: e.target && (e.target.id || e.target.tagName), s: snap() }); });
    window.addEventListener('blur', function () { L('window:blur', snap()); }); window.addEventListener('focus', function () { L('window:focus', snap()); });
    document.addEventListener('visibilitychange', function () { L('visibility', { hidden: document.hidden, s: snap() }); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', function () { L('visualViewport:resize', { h: Math.round(visualViewport.height), s: snap() }); });
    window.addEventListener('resize', function () { L('window:resize', { h: innerHeight, s: snap() }); });
    var C = window.Capacitor; var K = C && C.Plugins && C.Plugins.Keyboard;
    if (K && K.addListener) { ['keyboardWillShow', 'keyboardDidShow', 'keyboardWillHide', 'keyboardDidHide'].forEach(function (ev) { try { K.addListener(ev, function (i) { L('Keyboard:' + ev, { info: i, s: snap() }); }); } catch (e) { } }); } else L('keyboardPlugin', 'absent');
  };
  var sample = async function (tag, ms, n) { var rows = []; for (var i = 0; i < n; i++) { rows.push(snap()); await w(ms); }
    var lost = rows.filter(function (r) { return r.playing && !r.up && (r.el === 'PAUSED' || r.ctx !== 'running' || r.rms < 0.002); }).length;
    var sil = rows.filter(function (r) { return r.rms < 0.002; }).length;
    var uniq = function (k) { return rows.map(function (r) { return r[k]; }).filter(function (v, i, a) { return a.indexOf(v) === i; }); };
    L('sample:' + tag, { n: rows.length, engineSaysPlayingButNoOutput: lost, silentSamples: sil, ctxStates: uniq('ctx'), elStates: uniq('el'), elClockAdvanced: rows[rows.length - 1].elT - rows[0].elT, first: rows[0], last: rows[rows.length - 1], every500ms: rows.filter(function (_, i) { return i % 5 === 0; }) });
    return rows; };
  var realTap = function (name, action) { return new Promise(function (res) {
    var ov = document.createElement('button'); ov.setAttribute('data-ct-overlay', ''); ov.setAttribute('aria-label', 'ct-overlay');
    ov.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2147483647;background:transparent;border:0;margin:0;padding:0;opacity:0.01;';
    var done = false; var fin = function (how) { if (done) return; done = true; try { ov.remove(); } catch (e) { } L('tap:' + name, { how: how, s: snap() }); try { action(); } catch (e) { L('tap-action-error', String(e)); } res(how); };
    ov.addEventListener('click', function () { fin('real'); }, { once: true });
    document.body.appendChild(ov); out('CTTAP ' + name);
    setTimeout(function () { fin('fallback-synthetic'); }, 20000); }); };
  async function run() {
    L('env', { ua: navigator.userAgent.slice(0, 140), tag: (document.getElementById('build-tag') || {}).textContent || null, native: !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) });
    location.hash = '#sleep'; await w(1500);
    var ov = document.querySelector('.fi-skip'); if (ov) { L('intro', 'shown'); ov.click(); await w(1500); }
    document.getElementById('sleep-enter').click(); await w(4500);
    if (!window.softwave || !softwave.ctx) { L('fatal', 'no engine'); out('CT done'); return; }
    hooks(); L('phase', 'baseline'); await sample('baseline', 100, 20);
    L('phase', 'open timer sheet'); document.getElementById('sleep-timer').click(); await sample('sheet-open', 100, 15);
    var chip = [].slice.call(document.querySelectorAll('[data-t-opts] .chip')).filter(function (c) { return /Custom/.test(c.textContent); })[0];
    L('phase', 'tap Custom'); out('CTSHOT before-custom'); await w(2000); await realTap('custom', function () { chip.click(); }); await w(400); out('CTSHOT after-custom'); await sample('custom-open', 100, 40);
    var inp = document.getElementById('custom-timer-min'); L('form', { present: !!inp, focused: document.activeElement === inp, vv: window.visualViewport ? Math.round(visualViewport.height) : null, inner: innerHeight });
    L('phase', 'type 45 and Set');
    if (inp) { inp.value = '45'; inp.dispatchEvent(new Event('input', { bubbles: true })); await w(300); await realTap('set', function () { var sb = document.querySelector('[data-custom-timer] button[type=submit]'); if (sb) sb.click(); else inp.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); }
    await w(250); out('CTSHOT after-set'); await sample('after-set', 100, 50);
    L('phase', 'one real touch anywhere (what the user does to restore playback)'); await realTap('touch', function () { }); await sample('after-touch', 100, 25);
    L('phase', 'blur any focused input'); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); await sample('after-blur', 100, 20);
    L('summary', { timer: softwave.timer.durationMin, s: snap() }); out('CT done');
  }
  window.addEventListener('load', function () { setTimeout(function () { run().catch(function (e) { L('error', String(e && e.stack || e).slice(0, 300)); out('CT done'); }); }, 5000); });
})();
