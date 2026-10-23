/* TEST-ONLY (simulator builds of the Build 86 candidate — Build 84 + held iPhone pause, controls withdrawal, clock check — diagnostic and release bundles; never in the TestFlight/App Store build).
   Injected as the first script of www/index.html. Snapshots saved data before any app code runs, then checks the
   running app and prints results through console.log, which the Debug build's Capacitor bridge sends to stdout:
   "B61TEST <tag> <json>". "B61SHOT <name>" asks the CI script for a simulator screenshot; "B61BG" asks it to send
   the app to the background and bring it back. */
(function () {
  if (location.pathname.replace(/\/index\.html$/, '/') !== '/') return;          // app page only
  var PRE = {}, n = 0;
  try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf('softwave:') === 0) { PRE[k] = localStorage.getItem(k); n++; } } } catch (e) { }
  var SINK = 'http://127.0.0.1:8799/';   // CI host (the simulator shares its network); console output reaches CI late
  var out = function (line) { console.log(line); try { fetch(SINK, { method: 'POST', mode: 'no-cors', body: line, keepalive: line.length < 60000 }); } catch (e) { } };
  var L = function (tag, o) { var s; try { s = JSON.stringify(o); } catch (e) { s = '"(unserializable)"'; } out('B61TEST ' + tag + ' ' + s); };
  L('pre', { keys: n, data: PRE });
  var errs = []; window.addEventListener('error', function (e) { errs.push(String(e.message).slice(0, 200)); });
  window.addEventListener('unhandledrejection', function (e) { errs.push('rejection: ' + String(e.reason && e.reason.message || e.reason).slice(0, 200)); });
  var upgrade = !!PRE['softwave:mixes'];
  var res = [], ok = function (name, pass, info) { res.push([name, !!pass]); L(pass ? 'PASS' : 'FAIL', { name: name, info: info === undefined ? null : info }); };
  var w = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var shot = async function (name) { out('B61SHOT ' + name); await w(3500); };
  var screen = function () { return window.softwaveRI ? softwaveRI._state.screen : null; };
  var act = function (a) { var b = document.querySelector('#ri-root [data-act="' + a + '"]'); if (b) b.click(); return !!b; };
  var ids = function () { return window.softwave.activeList().map(function (s) { return s.id; }).sort().join(','); };
  var KA = function () { var c = window.Capacitor; return (c && c.Plugins && c.Plugins.KeepAwake) || null; };
  var FIXED = function () { return !!(window.softwave && typeof window.softwave.holdOutput === 'function'); };
  var DIAG = false;   // diagnostic bundle (observer + self-test) or release bundle — decided when the checks start (this script loads before diag.js)
  var skips = [], skip = function (name, why) { skips.push(name); L('SKIP', { name: name, why: why }); };
  var okOrDevice = function (name, blocked, pass, info) { if (blocked) skip(name, 'device-only: the simulator left the session at the permission prompt'); else ok(name, pass, info); };
  var IPAD = /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || Math.min(screen.width, screen.height) >= 700;
  var hold = function () { return (window.softwave && window.softwave._external) || 0; };
  var rmsBuf = null;
  // signal level at the engine's analyser (the last node before the routed output element)
  var rms = function () { try { var a = softwave.analyser; if (!a) return -1; var n = a.fftSize; if (!rmsBuf || rmsBuf.length !== n) rmsBuf = new Float32Array(n);
    if (a.getFloatTimeDomainData) a.getFloatTimeDomainData(rmsBuf); else { var b = new Uint8Array(n); a.getByteTimeDomainData(b); for (var q = 0; q < n; q++) rmsBuf[q] = (b[q] - 128) / 128; }
    var sum = 0; for (var q2 = 0; q2 < n; q2++) sum += rmsBuf[q2] * rmsBuf[q2]; return Math.sqrt(sum / n); } catch (e) { return -1; } };
  var meter = function () { var m = softwave.mediaOut; return { out: m ? (m.paused ? 'PAUSED' : 'playing') : 'none', ct: m ? Math.round(m.currentTime * 10) / 10 : null, rms: Math.round(rms() * 10000) / 10000, ctx: softwave.ctx ? softwave.ctx.state : null, count: (document.getElementById('ri-count') || {}).textContent || null }; };
  // the trial still in progress (the record is only filed after the follow-up rating), else the last one filed
  var lastTrial = function () { try { var a = JSON.parse(localStorage.getItem('softwave:ri:active') || 'null'); if (a && a.trial) return a.trial; var t = JSON.parse(localStorage.getItem('softwave:ri:trials') || '[]'); return t[t.length - 1] || null; } catch (e) { return null; } };
  var SIG = 0.002;
  async function sampleTests() {
    var sb = document.querySelector('[data-act="sample"]'); if (!sb) { ok('sample button present on the level screen', false, null); return; }
    sb.click(); var rows = []; for (var k = 0; k < 14; k++) { await w(500); var m = meter(); m.pressed = sb.getAttribute('aria-pressed'); rows.push(m); }
    await shot('ri-sample');
    var paused = rows.filter(function (r) { return r.out === 'PAUSED'; }), sig = rows.filter(function (r) { return r.rms > SIG; }).length, firstP = rows.findIndex(function (r) { return r.out === 'PAUSED'; });
    var sum = { samples: rows.length, pausedSamples: paused.length, firstPausedAt_s: firstP < 0 ? null : (firstP + 1) * 0.5, signalSamples: sig, rows: rows.filter(function (_, i) { return i % 4 === 0; }) };
    if (FIXED()) ok('Play sample sound: routed output playing and signal present on every 0.5 s sample for 7 s, button reads Stop throughout', paused.length === 0 && sig >= 12 && rows.every(function (r) { return r.pressed === 'true'; }), sum);
    else ok('UNFIXED Build 62: the sample\'s routed output paused within 7 s while the button still read "Stop sample" (defect reproduced on WKWebView; signal still generated behind the paused output)', paused.length > 0 && rows[rows.length - 1].pressed === 'true', sum);
    sb.click(); await w(1500); var m2 = meter();
    ok('second press: button back to "Play sample sound", no output hold, signal gone (no stuck or overlapping audio)', sb.getAttribute('aria-pressed') === 'false' && hold() === 0 && m2.rms < SIG, m2);
    sb.click(); await w(3000); var m3 = meter(); m3.pressed = sb.getAttribute('aria-pressed');
    if (FIXED()) ok('third press (replay): audible again after 3 s', m3.out === 'playing' && m3.rms > SIG && m3.pressed === 'true', m3); else L('unfixed-replay', m3);
    sb.click(); await w(1000);
    for (k = 0; k < 7; k++) { sb.click(); await w(120); } await w(1500); var m4 = meter(); var pr = sb.getAttribute('aria-pressed') === 'true';
    ok('7 rapid taps: button state consistent with the engine (pressed ⇔ hold held, signal ⇔ pressed), at most one stimulus', (!FIXED() || (pr === (hold() === 1) && hold() <= 1)) && (pr ? m4.rms > SIG : m4.rms < SIG), { pressed: pr, hold: hold(), m: m4 });
    if (pr) { sb.click(); await w(1000); }
    ok('sample stopped cleanly before continuing (no hold, no signal)', sb.getAttribute('aria-pressed') === 'false' && hold() === 0 && meter().rms < SIG, meter());
  }
  var kept = async function () { try { return (await KA().isKeptAwake()).isKeptAwake; } catch (e) { return 'err ' + e.message; } };
  window.addEventListener('load', function () { setTimeout(function () { run().catch(function (e) { ok('harness ran to the end', false, String(e && e.stack || e).slice(0, 300)); finish(); }); }, 5000); });

  function finish() {
    var failed = res.filter(function (r) { return !r[1]; }).map(function (r) { return r[0]; });
    L('done', { mode: upgrade ? 'upgrade' : (DIAG ? 'fresh' : 'release'), bundle: DIAG ? 'diagnostic' : 'release', ipad: IPAD, passed: res.length - failed.length, failed: failed.length, skipped: skips.length, failures: failed, skips: skips, errors: errs.slice(0, 6) });
  }

  async function run() {
    DIAG = !!window.__swDiag;
    var ua = navigator.userAgent, ios = (ua.match(/OS (\d+)_(\d+)/) || []).slice(1).join('.');
    L('env', { ios: ios, ua: ua.slice(0, 140), has: CSS.supports('selector(:has(*))'), colorMix: CSS.supports('color', 'color-mix(in srgb, red, blue)'), mode: upgrade ? 'upgrade' : 'fresh' });
    // first launch of the app: the opening film ("Tap to begin", ~29 s, then the app). Let it play through like a user.
    var ov = document.querySelector('.fi-skip') && document.querySelector('.fi-skip').parentElement;
    if (ov && !upgrade) {
      await shot('intro-tap-to-begin'); ov.click(); await w(12000); await shot('intro-playing');
      for (var q = 0; q < 50 && document.querySelector('.fi-skip'); q++) await w(500);
      await w(1500); ok('opening film plays through and hands over to the app', !document.querySelector('.fi-skip'), null);
      await shot('intro-handover');
    } else L('intro', { shown: !!ov, introSeen: localStorage.getItem('softwave:introSeen') });
    if (upgrade) ok('opening film does not replay for an existing 1.0 user', !ov, localStorage.getItem('softwave:introSeen'));
    var C = window.Capacitor;
    ok('runs in the native iOS shell', C && C.isNativePlatform && C.isNativePlatform() && C.getPlatform() === 'ios', C && C.getPlatform && C.getPlatform());
    ok('html.native-shell is set', document.documentElement.classList.contains('native-shell'));
    ok('website-only App Store line and Smart App Banner are absent', !document.getElementById('appstore-line') && !document.querySelector('meta[name="apple-itunes-app"]'));
    ok('no analytics globals', typeof window.gtag === 'undefined' && typeof window.dataLayer === 'undefined');
    await document.fonts.ready;
    ok('self-hosted Manrope renders (no system fallback, no style diagnostic)', document.fonts.check('16px Manrope') && /Manrope/.test(getComputedStyle(document.body).fontFamily) && document.body.innerText.indexOf('STYLE DIAGNOSTIC') < 0, getComputedStyle(document.body).fontFamily.slice(0, 40));
    var img = document.querySelector('.hero-wave img');
    ok('hero artwork loaded', img && img.complete && img.naturalWidth > 0, img && (img.currentSrc || '').split('/').pop());

    if (upgrade) await upgradeChecks(); else await freshChecks();

    var ext = performance.getEntriesByType('resource').map(function (e) { return e.name; }).filter(function (u) { return u.indexOf(location.origin + '/') !== 0 && u.indexOf(SINK) !== 0 && !/^(data:|blob:)/.test(u); });
    ok('no request leaves the device (all resources local)', ext.length === 0, ext.slice(0, 5));
    ok('no runtime errors', errs.length === 0, errs.slice(0, 4));
    finish();
  }

  async function freshChecks() {
    location.hash = '#sounds'; await w(1500); await shot('fresh-sounds');
    // keep-awake plugin reachable and really toggles the idle timer
    var P = KA();
    ok('KeepAwake plugin reachable as Capacitor.Plugins.KeepAwake', !!P, { registerPlugin: typeof (window.Capacitor && Capacitor.registerPlugin) });
    if (P) {
      var sup = await P.isSupported(); await P.keepAwake(); var on = await kept(); await P.allowSleep(); var off = await kept();
      ok('KeepAwake toggles the native idle timer (supported, on, off)', sup.isSupported === true && on === true && off === false, { sup: sup, on: on, off: off });
    }
    // Ambient Drift in Generative Sound
    location.hash = '#lab'; for (var i = 0; i < 40 && !document.querySelector('.lab-tile[data-id="generative"]'); i++) await w(200);
    document.querySelector('.lab-tile[data-id="generative"]').click(); await w(1200);
    var d = document.getElementById('lab-detail');
    var opts = [].map.call(d.querySelectorAll('[data-settings] button'), function (b) { return b.textContent.trim(); });
    ok('Generative Sound offers Ambient Drift (all seven bases)', ['Rain', 'Ocean', 'Wind', 'Forest', 'Abstract ambience', 'Ambient Drift', 'Broadband noise'].every(function (o) { return opts.indexOf(o) >= 0; }), opts);
    ok('the description names Ambient Drift', /Ambient Drift/.test((d.querySelector('.lab-dl dd') || {}).textContent || ''));
    var base = function (v) { return d.querySelector('[data-settings] button[data-v="' + v + '"]'); };
    base('drift').click(); await w(300); document.querySelector('[data-exp-start="generative"]').click(); await w(4000);
    var ctx = window.softwave.ctx;
    ok('Ambient Drift plays (drift alone, audio running)', ids() === 'drift' && (!ctx || ctx.state === 'running'), { ids: ids(), ctx: ctx && ctx.state });
    await shot('drift-playing');
    var r = d.querySelector('[data-settings] input[type="range"]'); r.value = 90; r.dispatchEvent(new Event('input', { bubbles: true })); await w(800);
    ok('Stable ↔ Organic drives the variation and drift keeps playing', ids() === 'drift' && window.softwave.variation.amount === 0.9, window.softwave.variation.amount);
    // background and return (the CI script switches to Settings and back)
    var hid = false, back = false; document.addEventListener('visibilitychange', function () { if (document.hidden) hid = true; else if (hid) back = true; });
    out('B61BG'); for (var t = 0; t < 480 && !back; t++) await w(500);
    await w(2500);
    ok('after background and return, drift still plays and audio runs', hid && back && ids() === 'drift' && (!ctx || ctx.state === 'running'), { hid: hid, back: back, ids: ids(), ctx: ctx && ctx.state });
    base('rain').click(); await w(2500); var toRain = ids(); base('drift').click(); await w(2500); var backDrift = ids();
    ok('switching drift → Rain → drift is clean', toRain === 'brown,rain' && backDrift === 'drift', { toRain: toRain, backDrift: backDrift });
    location.hash = '#sounds'; await w(2000); var away = ids();
    ok('leaving the experiment keeps the sound, as on the website', away === 'drift', away);
    var stop = document.getElementById('player-stop'); if (stop) stop.click(); await w(1500);
    ok('Stop silences drift (cleanup)', ids() === '', ids());
    // ---- Build 66: the Ask microphone button is back in the app; it acts only on a tap
    // ---- Ask "My Sound" bed (fix): a sound chosen on the Sounds page replaces the bed Ask started; everything else layers as before
    // (runs before the microphone test: a speech-recognition session left open on the simulator can deliver a late
    // result that re-runs Ask with noise and overwrites the reply under test)
    location.hash = '#sounds'; await w(1200);
    var askI = document.getElementById('ask-input'), askF = document.getElementById('ask-form');
    var askRun = async function (t) { askI.value = t; if (askF.requestSubmit) askF.requestSubmit(); else askF.dispatchEvent(new Event('submit', { cancelable: true })); await w(2500); };
    var actIds = function () { return softwave.activeList().map(function (s) { return s.id; }).sort().join(','); };
    var askOut = function () { return (document.getElementById('ask-out') || {}).innerText || ''; };
    var ptitle = function () { return document.getElementById('player-title').textContent; };
    await askRun('play something relaxing');
    ok('Ask "play something relaxing": My Sound alone, player bar visible with the title "My Sound", reply names My Sound and Stop', actIds() === 'sculpt' && ptitle() === 'My Sound' && !document.getElementById('player').classList.contains('player-hidden') && /Playing My Sound — a soft, steady noise blend\. You can stop it anytime using Stop/.test(askOut()), { active: actIds(), title: ptitle(), out: askOut().slice(0, 90) });
    await shot('ask-mysound');
    var nowEl = document.getElementById('now'); if (nowEl && !nowEl.hidden) { var nc = nowEl.querySelector('[data-now="close"], #now-close, .now-close, button[aria-label="Close"]'); if (nc) nc.click(); else nowEl.hidden = true; await w(400); }
    var rainBtn = document.querySelector('#view-sounds .sound-card[data-id="rain"] .card-btn'); if (rainBtn) rainBtn.click(); await w(2500);
    ok('Rain tapped on the Sounds page replaces the Ask bed: only Rain active, title "Rain" (before the fix: "My Sound + Rain")', actIds() === 'rain' && ptitle() === 'Rain', { active: actIds(), title: ptitle() });
    await shot('ask-rain-replaced');
    nowEl = document.getElementById('now'); if (nowEl && !nowEl.hidden) { var nc2 = nowEl.querySelector('[data-now="close"], #now-close, .now-close, button[aria-label="Close"]'); if (nc2) nc2.click(); else nowEl.hidden = true; await w(400); }
    var oceanBtn = document.querySelector('#view-sounds .sound-card[data-id="ocean"] .card-btn'); if (oceanBtn) oceanBtn.click(); await w(1500);
    ok('a second Sounds-page sound layers normally (Ocean + Rain); My Sound does not return', actIds() === 'ocean,rain', actIds());
    await askRun('play rain'); ok('Ask "play rain" still replaces the whole mix', actIds() === 'rain', actIds());
    softwave.setSculpt({ colour: 0.3 }, 'sculpt'); await softwave.loadMix([{ id: 'sculpt', volume: 0.5, balance: 0 }]); await w(1200);
    nowEl = document.getElementById('now'); if (nowEl && !nowEl.hidden) { var nc3 = nowEl.querySelector('[data-now="close"], #now-close, .now-close, button[aria-label="Close"]'); if (nc3) nc3.click(); else nowEl.hidden = true; await w(400); }
    rainBtn = document.querySelector('#view-sounds .sound-card[data-id="rain"] .card-btn'); if (rainBtn) rainBtn.click(); await w(1500);
    ok('a My Sound started outside Ask is NOT replaced by a Sounds-page tap (Rain layers on it)', actIds() === 'rain,sculpt', actIds());
    if (window.softwaveStopAll) softwaveStopAll(); else softwave.stopAll(); await w(1200);
    ok('Stop clears everything (no hidden layer left)', actIds() === '', actIds());
    location.hash = '#sounds'; await w(1500);
    var mic = document.getElementById('ask-mic'), input = document.getElementById('ask-input');
    ok('Ask: "Speak your request" microphone button present, idle; Web Speech API exposed by WKWebView', !!mic && mic.getAttribute('aria-label') === 'Speak your request' && mic.getAttribute('aria-pressed') === 'false' && !!window.webkitSpeechRecognition, { mic: !!mic, api: !!window.webkitSpeechRecognition });
    input.value = 'add a little rain'; input.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('ask-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await w(2500);   // (requestSubmit() does not exist on iOS 15)
    ok('Ask: typing works — Go runs a typed request (rain added)', ids().indexOf('rain') >= 0, ids());
    await shot('ask-mic');
    mic.click();
    // stage 3: on the shell the tap enters "getting ready" (pressed, aria-busy, preparing look, placeholder says so) and the
    // button may say "Listening" only once the plugin has reported started — on a simulator the permission alert usually
    // holds the session at 'starting', so the button must still be "getting ready" 300 ms later
    var listening = mic.getAttribute('aria-pressed') === 'true' && /Getting the microphone ready/.test(input.placeholder) && mic.classList.contains('preparing') && !mic.classList.contains('listening') && mic.getAttribute('aria-busy') === 'true';   // set synchronously by the tap
    await w(300); var stillListening = mic.getAttribute('aria-pressed') === 'true'; await shot('ask-listening');
    var dlogR = []; try { dlogR = JSON.parse(localStorage.getItem('softwave:diag:log') || '[]'); } catch (e) { }
    var startedSeen = dlogR.some(function (o) { return o.tag === 'native:speechNative' && o.d && o.d.status === 'started'; });
    var claimsListening = mic.classList.contains('listening') || /^Listening/.test(input.placeholder);
    ok('Native speech stage 3: the button never claims "Listening" before the plugin reports that capture started (300 ms after the tap: ' + (startedSeen ? 'started seen, listening look' : 'not started, still getting ready') + ')', stillListening && (claimsListening === startedSeen), { startedSeen: startedSeen, cls: mic.className, ph: input.placeholder, out: (document.getElementById('ask-out') || {}).textContent });
    var outText = (document.getElementById('ask-out') || {}).textContent || '';
    // second tap cancels; the wait is measured, up to 8 s: on a simulator the first speech permission alert can stall the app's
    // main thread for several seconds (stage 3 run 39196328010, iOS 18.7: 3.5 s), which delays every bridge call including stop
    var cancelMs = null;
    if (stillListening) { var tC = Date.now(); mic.click(); for (var kC = 0; kC < 40 && mic.getAttribute('aria-pressed') === 'true'; kC++) await w(200); cancelMs = Date.now() - tC; }
    ok('Ask: a tap enters "Listening…"; it then either keeps listening until a second tap cancels, or ends with the app’s own message when the simulator has no microphone (real recognition needs a physical device)', listening && mic.getAttribute('aria-pressed') === 'false' && (stillListening || /didn.t catch that|Microphone access|Voice (didn|isn)/.test(outText)), { listening: listening, stillListening: stillListening, after: mic.getAttribute('aria-pressed'), cancelMs: cancelMs, out: outText.slice(0, 120) });
    ok('Native speech: the cancel tap ended the session' + (cancelMs === null ? ' (no cancel needed: the session had already ended)' : ' in ' + cancelMs + ' ms (simulator permission alert included)'), cancelMs === null || mic.getAttribute('aria-pressed') === 'false', { cancelMs: cancelMs, pressed: mic.getAttribute('aria-pressed') });
    if (window.softwaveStopAll) softwaveStopAll(); await w(500);
    // ---- Build 66: the Sleep timer's per-second gain re-assertion no longer interrupts pause, resume, volume and
    // timer changes (web v281). Measured on the real Sleep screen with the engine's master gain.
    location.hash = '#sleep'; await w(1200); document.getElementById('sleep-enter').click(); await w(3500);
    var E = window.softwave, tgt = function () { return Math.pow(E.masterVolume, 1.45) * 1.5; }, mg = function () { return Math.round(E.master.gain.value * 10000) / 10000; };
    var onTick = function () { return new Promise(function (r) { var off = E.on(function (t) { if (t === 'timer') { off(); r(Date.now()); } }); }); };
    ok('Sleep screen: the sleep preset plays through the routed output', ids() === 'brown,rain' && meter().out === 'playing' && meter().rms > SIG, meter());
    // ---- Build 70: Pause releases the routed output before the graph suspends, so the element never plays a stream
    // that receives no samples (the repeated clicks heard on Pause in Build 66). Stop and timer completion unchanged.
    var order = []; var hS = function () { if (E.ctx.state === 'suspended') order.push('ctx-suspended@' + Date.now()); }; E.ctx.addEventListener('statechange', hS);
    var hP = function () { order.push('element-paused@' + Date.now()); }; E.mediaOut.addEventListener('pause', hP);
    document.getElementById('sleep-pause').click(); var stalled = 0;
    for (var k = 0; k < 40; k++) { await w(50); var mm = meter(); if (mm.ctx === 'suspended' && mm.out === 'playing') stalled++; }
    E.ctx.removeEventListener('statechange', hS); E.mediaOut.removeEventListener('pause', hP);
    var iP = order.findIndex(function (x) { return x.indexOf('element') === 0; }), iS = order.findIndex(function (x) { return x.indexOf('ctx') === 0; });
    var msOk = !('mediaSession' in navigator) || navigator.mediaSession.playbackState === 'paused';
    // Build 86: on the iPhone app the pause is held (graph and element running at level 0) — the element still never
    // plays against a suspended graph; otherwise the ordinary release order applies
    var held70 = !!E._softPaused, m70 = meter();
    ok('Build 70/86: Pause holds (element and graph running, silent) or releases the element before the context suspends; the element never plays against a suspended graph (2 s sampled); Media Session paused', stalled === 0 && E.userPaused && msOk && (held70 ? (m70.out === 'playing' && m70.ctx === 'running' && m70.rms < 0.0008) : (iP >= 0 && iS >= 0 && iP <= iS && m70.out === 'PAUSED' && m70.ctx === 'suspended')), { held: held70, order: order, stalled: stalled, end: m70 });
    await shot('sleep-paused-67');
    document.getElementById('sleep-pause').click(); await w(1500); var mR = meter();
    ok('Build 70: Play after the pause restarts the routed element and sound returns', mR.out === 'playing' && mR.ctx === 'running' && mR.rms > SIG && !E.userPaused, mR);
    var gaps = [150, 300, 700, 1500], cyc = [];
    for (var gi = 0; gi < gaps.length; gi++) { var gap = gaps[gi], st = 0, lateSus = 0; var hS2 = function () { if (E.ctx.state === 'suspended' && !E.userPaused) lateSus++; }; E.ctx.addEventListener('statechange', hS2);
      for (var i2 = 0; i2 < 6; i2++) { document.getElementById('sleep-pause').click(); var tt = Date.now(); while (Date.now() - tt < gap) { await w(25); var m2 = meter(); if (m2.ctx === 'suspended' && m2.out === 'playing') st++; } }
      for (var i3 = 0; i3 < 60; i3++) { await w(25); var m3 = meter(); if (m3.ctx === 'suspended' && m3.out === 'playing') st++; }
      E.ctx.removeEventListener('statechange', hS2); var me = meter(); var consistent = E.userPaused ? (E._softPaused ? (me.ctx === 'running' && me.out === 'playing' && me.rms < 0.0008) : (me.ctx === 'suspended' && me.out === 'PAUSED')) : (me.ctx === 'running' && me.out === 'playing' && me.rms > SIG);
      cyc.push({ gap: gap, stalled: st, lateSuspensions: lateSus, consistent: consistent, paused: E.userPaused, end: me });
      if (E.userPaused) { document.getElementById('sleep-pause').click(); await w(1500); } }
    ok('Build 70: 6 Pause/Play presses at 150, 300, 700 and 1500 ms: element never stalled, no suspension after a Play, consistent end state, Play restores output', cyc.every(function (c) { return c.stalled === 0 && c.lateSuspensions === 0 && c.consistent; }) && meter().out === 'playing' && meter().rms > SIG, cyc);
    var rel = E.holdOutput(); document.getElementById('sleep-pause').click(); await w(1200); var mH = meter();
    ok('Build 70: a Sound Response output hold keeps the routed element playing through a Pause (context suspended, element not released)', mH.ctx === 'suspended' && mH.out === 'playing' && E.userPaused, mH);
    document.getElementById('sleep-pause').click(); await w(1200); rel(); await w(300);
    ok('Build 70: after Play and the hold\'s release, output plays normally', meter().out === 'playing' && meter().ctx === 'running' && meter().rms > SIG && hold() === 0, meter());
    E.setTimer(0.2, true); await w(10500); var faded = mg(); E.setTimer(5, true); await w(1500); var after = mg();
    ok('Build 66: re-setting the timer during its fade-out restores the selected level (Build 66 left it at the faded level)', faded < tgt() * 0.9 && Math.abs(after - tgt()) < 0.003 && E.timer.durationMin === 5, { faded: faded, after: after, target: tgt(), m: meter() });
    await onTick(); await w(800);
    var atSus = null; var hSus = function () { if (E.ctx.state === 'suspended' && atSus === null) atSus = mg(); }; E.ctx.addEventListener('statechange', hSus);
    document.getElementById('sleep-pause').click(); await w(1300); E.ctx.removeEventListener('statechange', hSus);
    var held66 = !!E._softPaused, mg66 = mg();
    ok('Build 66: pausing 800 ms after a timer tick fades to silence before the context suspends — or, held (Build 86), fades to silence', E.userPaused && (held66 ? mg66 < 0.002 : (atSus !== null && atSus < 0.002)), { held: held66, masterAtSuspend: atSus, master: mg66, ctx: E.ctx.state });
    await shot('sleep-paused');
    await onTick(); await w(880); document.getElementById('sleep-pause').click(); await w(2200);
    ok('Build 66: one Play press 880 ms after a tick resumes at the selected level (Build 66 held the master low)', !E.userPaused && !!E.isPlaying && Math.abs(mg() - tgt()) < 0.003 && meter().out === 'playing' && meter().rms > SIG, { master: mg(), target: tgt(), m: meter() });
    var vol = document.getElementById('sleep-vol'); E.setTimer(0.1, true); var endAt = E.timer.endsAt; await w(5700);
    vol.value = 50; vol.dispatchEvent(new Event('input', { bubbles: true }));
    while (Date.now() < endAt + 350) await w(25); var atEnd = meter(); await w(1800);
    ok('Build 66: a volume change 0.3 s before the deadline still ends in silence at the deadline, and the timer finishes and stops', atEnd.rms < SIG && ids() === '' && !E.timer.endsAt, { atDeadline: atEnd, ids: ids(), timer: E.timer.durationMin });
    await shot('sleep-timer-done');
    document.getElementById('sleep-exit').click(); await w(800); if (window.softwaveStopAll) softwaveStopAll(); location.hash = '#sounds'; await w(800);
    // ---- Build 73 diagnostic: the observer recorded the flow above; native session lines reached the page; detector quiet
    if (DIAG) {
    var dlog = []; try { dlog = JSON.parse(localStorage.getItem('softwave:diag:log') || '[]'); } catch (e) { }
    var dtags = dlog.map(function (o) { return o.tag; }); var dhas = function (p) { return dtags.some(function (t) { return t.indexOf(p) === 0; }); };
    ok('Build 73 diagnostic: web observer recorded engine hooks, context and element events, calls, UI steps and 4 s audio summaries', dhas('diag:engine-hooked') && dhas('diag:ctx-hooked') && dhas('diag:element-hooked') && dhas('call:startSound') && dhas('ctx:') && dhas('element:') && dhas('ui:') && dhas('audio:4s'), { entries: dlog.length, last: dtags.slice(-8) });
    var nat = dlog.filter(function (o) { return o.tag.indexOf('native:') === 0; });
    ok('Build 73 diagnostic: native observer lines arrive (diagStart first, 2 s snapshots carrying category, mode, sample rate, route port types, record permission)', dhas('native:diagStart') && nat.length > 1 && nat[0].tag === 'native:diagStart' && nat.some(function (o) { return o.d && o.d.category && o.d.outputs && typeof o.d.sampleRate === 'number' && 'recordPermission' in o.d; }), nat.slice(-1).map(function (o) { return o.d; }));
    var sumsOK = dlog.filter(function (o) { return o.tag === 'audio:4s'; }).every(function (o) { return o.d && typeof o.d.sr === 'number' && 'clicks' in o.d; });
    ok('Build 73 diagnostic: audio summaries carry sample rate, click/gap counts and master range; Diag button present', sumsOK && !!document.querySelector('button[aria-label="Open the audio diagnostic log"]'), dlog.filter(function (o) { return o.tag === 'audio:4s'; }).slice(-1).map(function (o) { return o.d; }));
    var sr = dtags.filter(function (t) { return t.indexOf('sr:') === 0; });
    ok('Build 73 diagnostic: speech phases observed from the microphone test (native adapter: start, then result or error)', dlog.some(function (o) { return o.tag === 'native:speechNative' && o.d && o.d.phase === 'start'; }) && dlog.some(function (o) { return o.tag === 'native:speechNative' && o.d && (o.d.phase === 'result' || o.d.phase === 'error'); }), dlog.filter(function (o) { return o.tag === 'native:speechNative'; }).map(function (o) { return o.d && o.d.phase; }));
    ok('Build 73 diagnostic: privacy — log holds no transcript, input value or typed text', !/"transcript"|"value"|"text":/.test(JSON.stringify(dlog)), dlog.length);
    // the flow above backgrounds the app (Settings), which really does stop the output on some simulators: automatic loss
    // markers must have been recorded only while the page was hidden
    var lostE = dlog.filter(function (o) { return o.tag === 'AUTO:output-lost'; });
    var sampled = dlog.some(function (o) { return o.tag === 'audio:4s'; });
    ok('Build 73 diagnostic: no automatic output-loss marker during visible playback (detector sampled)', sampled && lostE.every(function (o) { return o.s && o.s.hidden === true; }), { markers: lostE.length, detail: lostE.map(function (o) { return { t: o.t, hidden: o.s && o.s.hidden, why: o.d && o.d.why }; }) });
    var gl = dlog.filter(function (o) { return o.tag === 'AUTO:glitch'; });
    ok('Build 73 diagnostic: glitch detector reports nothing while the simulator plays normally (detector sampled)', sampled && gl.filter(function (o) { return !(o.s && o.s.hidden); }).length === 0, { glitches: gl.length, detail: gl.slice(0, 4).map(function (o) { return o.d; }) });
    } else {
      skip('Build 73 diagnostic checks (observer, summaries, privacy, detector)', 'release bundle: no observer');
      var hasBtn = function (t) { return !!Array.prototype.slice.call(document.querySelectorAll('button')).find(function (b) { return b.textContent === t; }); };
      ok('Release bundle: no Diag/Check/Int. buttons, no diagnostic API, no diagnostic log key, no diag.js/selftest.js resource', !hasBtn('Diag') && !hasBtn('Check') && !hasBtn('Int.') && !window.__swDiag && !window.__swSelfTest && localStorage.getItem('softwave:diag:log') === null && !performance.getEntriesByType('resource').some(function (r) { return /diag\.js|selftest\.js/.test(r.name); }), null);
    }
    // ---- Native speech (iPhone app): the app-local plugin is registered, the adapter uses it, and every session end restores
    // the playback-only session (the simulator may have no usable input: then the session ends as audio-capture and the
    // app shows its own message — the restore line must still arrive).
    var NS = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SoftwaveSpeech;
    ok('Native speech: the SoftwaveSpeech plugin is registered (Capacitor.Plugins.SoftwaveSpeech with start/stop/available)', !!NS && typeof NS.start === 'function' && typeof NS.stop === 'function' && typeof NS.available === 'function', NS ? Object.keys(NS) : null);
    var avail = null; try { avail = await NS.available(); } catch (e) { avail = { error: String(e) }; }
    ok('Native speech: available() answers (recognizer present; input may be absent on a simulator)', !!avail && typeof avail.available === 'boolean' && avail.recognizer === true, avail);
    var perm = null; try { perm = await NS.checkPermissions(); } catch (e) { perm = { error: String(e) }; }
    ok('Native speech: checkPermissions() reports speechRecognition and microphone states', !!perm && ['granted', 'denied', 'prompt'].indexOf(perm.speechRecognition) >= 0 && ['granted', 'denied', 'prompt'].indexOf(perm.microphone) >= 0, perm);
    if (DIAG) {
    var dlog3 = []; try { dlog3 = JSON.parse(localStorage.getItem('softwave:diag:log') || '[]'); } catch (e) { }
    var nsLines = dlog3.filter(function (o) { return o.tag === 'native:speechNative'; }).map(function (o) { return o.d; });
    var phases = nsLines.map(function (d) { return d.phase + (d.status ? ':' + d.status : '') + (d.code ? ':' + d.code : '') + (d.reason ? ':' + d.reason : ''); });
    ok('Native speech: the microphone test above went through the native adapter (start phase, then a result or an error, then the plugin\'s stopped state)', phases.indexOf('start') >= 0 && phases.some(function (p) { return p.indexOf('result') === 0 || p.indexOf('error') === 0; }) && phases.some(function (p) { return p.indexOf('state:stopped') === 0; }), phases);
    var stopped = nsLines.filter(function (d) { return d.phase === 'state' && d.status === 'stopped'; });
    ok('Native speech: every session end restored the playback session (restored true, category Playback, no input in the route)', stopped.length > 0 && stopped.every(function (d) { return d.restored === true && /Playback$/.test(d.category || '') && (!d.inputs || d.inputs.length === 0); }), stopped);
    ok('Native speech: no WebKit recogniser was created on the shell (webkit path inert)', !dlog3.some(function (o) { return o.tag === 'sr:created'; }), dlog3.filter(function (o) { return o.tag.indexOf('sr:') === 0; }).map(function (o) { return o.tag; }));
    var nsAll = dlog3.filter(function (o) { return o.tag === 'native:speechNative'; }).map(function (o) { return o.d || {}; });
    var lvl = nsAll.filter(function (d) { return d.phase === 'state' && (d.status === 'level' || d.status === 'started' || d.status === 'stopped'); });
    // simulators show the speech/microphone permission alerts, which the harness cannot answer: a session that never left
    // 'starting' (no format, no buffers, aborted by the second tap) is the expected outcome there; capture telemetry is a device check
    var promptBlocked = nsAll.some(function (d) { return d.status === 'stopped' && d.reason === 'aborted' && d.buffers === 0 && (!d.format || d.format === ''); });
    okOrDevice('Native speech stage 2: capture telemetry present (input format, buffers)', promptBlocked, lvl.some(function (d) { return typeof d.buffers === 'number' && d.buffers > 0 && typeof d.format === 'string' && d.format.length > 0; }), lvl.slice(-3));
    ok('Native speech stage 2: the session end carries the transcript length and timing fields (chars, seconds)', nsAll.some(function (d) { return d.status === 'stopped' && 'chars' in d && 'seconds' in d; }), nsAll.filter(function (d) { return d.status === 'stopped'; }).slice(-1));
    var startLine = nsAll.filter(function (d) { return d.phase === 'start'; }).slice(-1)[0];
    ok('Native speech stage 3: the page passes the recognizer vocabulary (sound names and command words; count logged, never the words)', !!startLine && typeof startLine.vocabulary === 'number' && startLine.vocabulary >= 40 && startLine.vocabulary <= 100, startLine);
    var startedAll = nsAll.filter(function (d) { return d.status === 'started'; });
    okOrDevice('Native speech stage 3: a started event carries the vocabulary count', promptBlocked, (startedAll.length > 0 && startedAll.every(function (d) { return typeof d.vocabulary === 'number' && d.vocabulary >= 40; })), startedAll.slice(-1));
    ok('Native speech stage 3: level/stopped events carry the quiet-time field (seconds since the last speech-level buffer)', nsAll.some(function (d) { return (d.status === 'stopped' || d.status === 'level') && 'quiet' in d; }), nsAll.filter(function (d) { return d.status === 'stopped'; }).slice(-1));
    ok('Native speech stage 3: after the session the "getting ready"/"listening" indication is fully cleared (no preparing/listening/hearing class, aria-busy gone, placeholder restored)', !mic.classList.contains('preparing') && !mic.classList.contains('listening') && !mic.classList.contains('hearing') && mic.getAttribute('aria-busy') === null && /Something warm/.test(input.placeholder), { cls: mic.className, ph: input.placeholder });
    okOrDevice('Build 78: the page passes the single-word sound list to the plugin (start options are not logged — checked through the started/stopped events carrying the alternative flag)', promptBlocked, nsAll.some(function (d) { return d.status === 'stopped' && 'alternative' in d; }), nsAll.filter(function (d) { return d.status === 'stopped'; }).slice(-1));
    ok('Build 78: no transcript text in any diagnostic line (speechNative payloads carry counts and flags only)', nsAll.every(function (d) { return !('text' in d) && !('heard' in d) && !('transcript' in d); }), Object.keys(nsAll[nsAll.length - 1] || {}));
    ok('Build 79: the parser itself is unchanged — "and rain" is still a bare sound name (play), "add rain" a layer, "with rain" a layer (the iPhone-only rewrite happens before the parser and only while something plays)', (function () { var P = window.softwaveAssistant && softwaveAssistant.parse; if (!P) return false; var a = P('and rain'), b = P('add rain'), c = P('with rain'), d = P('play rain'); return a.actions && a.actions[0] && a.actions[0][0] === 'play_sound' && b.actions[0][0] === 'add_layer' && c.actions[0][0] === 'add_layer' && d.actions[0][0] === 'play_sound'; })(), null);
    } else skip('Native speech log-based checks (phases, session restore, telemetry, vocabulary, alternative flag)', 'release bundle: no observer log');
    // ---- Build 80: iOS 15 visuals (roundRect guard) — Fireplace, Audio Spectrum and the frequency visualiser draw without errors
    var errBefore = errs.length;
    location.hash = '#focus'; await w(1200);
    var visuals = ['fireplace', 'spectrum']; for (var vi = 0; vi < visuals.length; vi++) {
      var tile = document.querySelector('[data-visual="' + visuals[vi] + '"], [data-id="' + visuals[vi] + '"], [data-v="' + visuals[vi] + '"]'); if (tile) tile.click(); await w(1200);
      var en = document.getElementById('env-enter'); if (en) en.click(); await w(2500);
      var ex = document.getElementById('focus-exit') || document.querySelector('[data-focus-exit], #focus-stop-visual'); if (ex) ex.click(); await w(800);
    }
    location.hash = '#frequency'; await w(1200); var fp = document.getElementById('freq-play'); if (fp) { fp.click(); await w(2500); fp.click(); await w(400); }
    ok('Build 80: Fireplace, Audio Spectrum and the frequency visualiser raise no errors (roundRect guarded for iOS 15: ' + (typeof CanvasRenderingContext2D.prototype.roundRect === 'function' ? 'native roundRect present' : 'native roundRect absent') + ')', errs.length === errBefore, errs.slice(errBefore, errBefore + 3));
    if (window.softwaveStopAll) softwaveStopAll(); await w(600);
    // ---- Build 80: stabilisation flows (B2 interruption → first press resumes; B3 pause integrity; S2 experiment ends with the timer;
    // S3 the Focus timer button binds once; S4 Space on a focused control). B4 is covered with a mocked wake lock.
    location.hash = '#sounds'; await w(1200);
    var E80 = window.softwave, card = function (id) { var b = document.querySelector('#view-sounds .sound-card[data-id="' + id + '"] .card-btn'); if (b) b.click(); return !!b; };
    var closeNow80 = function () { var n = document.getElementById('now'); if (n && !n.hidden) { var cl = document.getElementById('now-close'); if (cl) cl.click(); else n.hidden = true; } };
    var st80 = function () { return { ctx: E80.ctx ? E80.ctx.state : null, paused: !!E80.userPaused, playing: !!E80.isPlaying, master: E80.master ? Math.round(E80.master.gain.value * 1000) / 1000 : null, active: ids(), rms: Math.round(rms() * 10000) / 10000, sub: (document.getElementById('player-sub') || {}).textContent }; };
    card('rain'); await w(2500); closeNow80();
    ok('Build 80 setup: Rain playing', st80().playing && ids() === 'rain', st80());
    await E80.ctx.suspend(); await w(600);
    var tg = document.getElementById('player-toggle'); tg.click(); await w(1800);
    var b2 = st80(); ok('Build 80 B2: after a simulated interruption (context suspended, not user-paused) the first press of Play RESUMES', b2.ctx === 'running' && !b2.paused && b2.playing && b2.rms > SIG, b2);
    tg.click(); await w(1200); var b2p = st80(); ok('Build 80 B2: the next press pauses normally', b2p.paused && b2p.master < 0.001, b2p);
    try { document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); } catch (e) { } document.body.dispatchEvent(new Event('touchend', { bubbles: true }));
    var nav = document.querySelector('.nav a[href="#sleep"]'); if (nav) nav.click(); await w(800); nav = document.querySelector('.nav a[href="#sounds"]'); if (nav) nav.click(); await w(800);
    var b3 = st80(); ok('Build 80 B3: taps and navigation while paused keep the pause (context not running, or held — Build 86; master 0, player says Paused)', (b3.ctx !== 'running' || !!E80._softPaused) && b3.paused && b3.master < 0.001 && /Paused/.test(b3.sub), b3);
    var mv = document.getElementById('mix-vol'); if (mv) { mv.value = 55; mv.dispatchEvent(new Event('input', { bubbles: true })); } await w(600);
    var b3v = st80(); ok('Build 80 B3: moving the master slider while paused stays silent; the level is remembered', b3v.master < 0.001 && b3v.paused && Math.abs(E80.masterVolume - 0.55) < 0.02, b3v);
    tg.click(); await w(2000); var b3r = st80(); ok('Build 80 B3: Play restores sound at the remembered level', !b3r.paused && b3r.playing && b3r.master > 0.3 && b3r.rms > SIG, b3r);
    // B4: mocked wake lock released when the timer ends while the Sleep screen is open
    var WL = { requests: 0, released: 0 }; try { Object.defineProperty(navigator, 'wakeLock', { value: { request: function () { WL.requests++; return Promise.resolve({ release: function () { WL.released++; return Promise.resolve(); } }); } }, configurable: true }); } catch (e) { }
    location.hash = '#sleep'; await w(1000); var se = document.getElementById('sleep-enter'); if (se) se.click(); await w(1800);
    var sleepOpen = !(document.getElementById('sleep-screen') || { hidden: true }).hidden; var rel0 = WL.released;
    E80.setTimer(0.05, false); var t80 = 0; while (t80 < 60 && (ids() !== '' || E80.timer.endsAt)) { await w(250); t80++; } await w(800);
    ok('Build 80 B4: the Sleep screen requested a wake lock and released it when the timer ended, with the screen still open', WL.requests >= 1 && WL.released > rel0 && sleepOpen && !(document.getElementById('sleep-screen') || { hidden: true }).hidden && ids() === '', { wl: WL, sleepOpen: sleepOpen });
    var lbl81 = function () { return (document.getElementById('sleep-remaining') || {}).textContent; };
    ok('Build 81: after the sleep timer ends with nothing playing, the Sleep page reads "Timer finished" (not "Continuous")', lbl81() === 'Timer finished', lbl81());
    var sx = document.getElementById('sleep-exit'); if (sx) sx.click(); await w(800);
    // S3: the Focus panel's timer button sets the timer once
    var calls = 0, origSet = E80.setTimer; E80.setTimer = function () { calls++; return origSet.apply(E80, arguments); };
    location.hash = '#focus'; await w(1000); var fb = document.querySelector('#view-focus .timer-seg [data-min="15"], #focus-screen .timer-seg [data-min="15"]'); if (fb) fb.click(); await w(500);
    ok('Build 80 S3: one Focus-panel timer button press calls setTimer once', fb && calls === 1 && !!E80.timer.endsAt, { calls: calls, found: !!fb }); E80.setTimer = origSet; E80.clearTimer();
    // S2: an experiment ends when the engine timer ends
    location.hash = '#lab'; await w(1500); softwaveLab.open('morph'); await w(1200); var sb = document.querySelector('[data-exp-start]'); if (sb) sb.click(); await w(2500);
    var s2a = softwaveLab.isRunning() && ids() !== '';
    E80.setTimer(0.05, false); t80 = 0; while (t80 < 60 && (ids() !== '' || E80.timer.endsAt)) { await w(250); t80++; } await w(800);
    ok('Build 80 S2: Sound Morph ran, and the engine timer\'s end ended the experiment (no "Experiment" left over silence)', s2a && !softwaveLab.isRunning() && !/Experiment/.test((document.getElementById('player-title') || {}).textContent) && ids() === '', { ran: s2a, running: softwaveLab.isRunning(), title: (document.getElementById('player-title') || {}).textContent });
    // S4: Space on a focused control
    location.hash = '#sounds'; await w(1200); card('rain'); await w(2000); closeNow80();
    ok('Build 81: once a sound starts again the Sleep page reads "Continuous"', lbl81() === 'Continuous', lbl81());
    var link = document.querySelector('.nav a[href="#learn"]'); if (link) { link.focus(); link.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); } await w(600);
    ok('Build 80 S4: Space on a focused nav link does not pause playback', !E80.userPaused && E80.isPlaying, st80());
    if (document.activeElement) document.activeElement.blur(); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); await w(800);
    ok('Build 80 S4: Space with nothing focused still pauses', E80.userPaused, st80());
    if (window.softwaveStopAll) softwaveStopAll(); await w(600);
    // ---- Build 81: Tuned to You applies only on its own change and stays out of experiments
    var T81 = window.softwave, hz81 = function () { return Math.round(T81.masterFilter.frequency.value); }, va81 = function () { return T81.variation.amount; };
    var stop81 = function () { if (window.softwaveStopAll) softwaveStopAll(); else T81.stopAll(); };
    var g81 = function (id) { var e = T81.active.get(id); return e ? e.gain.gain.value : 0; };
    var dB81 = function (a, b) { return (a > 0 && b > 0) ? Math.round(2000 * Math.log10(b / a)) / 100 : null; };
    var KEYS81 = ['softwave:lab:prefs2', 'softwave:tuned:on', 'softwave:lab:discoveries'], SAVED81 = {};
    KEYS81.forEach(function (k) { SAVED81[k] = localStorage.getItem(k); });
    var MOVING81 = { n: 6, sum: { colour: 2.4, warm: 0, deep: 0, smooth: 0, soft: 0, width: 2.4, moving: 4.8, rich: 1.2, mod: 1.8 }, natures: { rain: 3 } };
    var WARM81 = { n: 6, sum: { colour: 1.2, warm: -4.8, deep: 0, smooth: 0, soft: 0, width: 1.2, moving: 4.8, rich: 0, mod: 0 }, natures: { rain: 3 } };
    try {
      localStorage.removeItem('softwave:lab:prefs2'); localStorage.removeItem('softwave:tuned:on');
      // no profile: a 90 s fade in progress survives a sound starting and a sound being removed
      await T81.startSound('brown', 0.55); await T81.startSound('rain', 0.35); await T81.startSound('pink', 0.3); await w(3000);
      T81.rampVolume('rain', 0.05, 90); T81.rampVolume('brown', 0.45, 90); await w(2000);
      var f0 = { rain: g81('rain'), brown: g81('brown') }; T81.startSound('ocean', 0.001); await w(400); var f1 = { rain: g81('rain'), brown: g81('brown') };
      ok('Build 81: no profile — 90 s fades keep going when a sound starts (≤0.6 dB in 0.4 s)', Math.abs(dB81(f0.rain, f1.rain)) <= 0.6 && Math.abs(dB81(f0.brown, f1.brown)) <= 0.6, { rain: dB81(f0.rain, f1.rain), brown: dB81(f0.brown, f1.brown) });
      f0 = { rain: g81('rain'), brown: g81('brown') }; T81.stopSound('pink'); await w(400); f1 = { rain: g81('rain'), brown: g81('brown') };
      ok('Build 81: no profile — 90 s fades keep going when a sound is removed', Math.abs(dB81(f0.rain, f1.rain)) <= 0.6 && Math.abs(dB81(f0.brown, f1.brown)) <= 0.6, { rain: dB81(f0.rain, f1.rain), brown: dB81(f0.brown, f1.brown) });
      stop81(); await w(1000);
      // no profile: Ask "warmer" and "more movement" survive a sound change
      await T81.startSound('pink', 0.45); await w(2000);
      await softwaveAssistant.run('warmer'); await w(1500); var tw81 = hz81();
      await softwaveAssistant.run('more movement'); await w(800); var vw81 = va81();
      T81.startSound('rain', 0.3); await w(2500);
      ok('Build 81: Ask "warmer" and "more movement" survive adding a sound', tw81 < 16000 && Math.abs(hz81() - tw81) < 300 && vw81 > 0 && va81() === vw81, { before: [tw81, vw81], after: [hz81(), va81()] });
      stop81(); await w(1000);
      // Find My Sound with a confident moving profile: side B stays muted, no movement, neutral tone
      localStorage.setItem('softwave:lab:prefs2', JSON.stringify(MOVING81));
      location.hash = '#lab'; await w(1500); softwaveLab.open('discovery'); await w(1500);
      var ds = document.querySelector('[data-exp-start]'); if (ds) ds.click(); await w(4000);
      var dv = va81(), dh = hz81(), maxB = 0; for (var di = 0; di < 6; di++) { maxB = Math.max(maxB, g81('discoB')); await w(1500); }
      ok('Build 81: Find My Sound with a moving profile — side B stays muted, no movement, neutral tone', softwaveLab.isRunning() && maxB < 0.01 && dv === 0 && dh > 19000, { maxB: maxB, A: g81('discoA'), variation: dv, hz: dh });
      softwaveLab.stop(); stop81(); await w(1200);
      // Tuned to You on (warm + moving profile): applies from silence, kept on a sound change, chip off → neutral, on → back
      localStorage.setItem('softwave:lab:prefs2', JSON.stringify(WARM81));
      location.hash = '#sounds'; await w(1200);
      await T81.startSound('pink', 0.45); await w(2500);
      var on1 = [hz81(), va81()]; T81.startSound('rain', 0.3); await w(1500); var on2 = [hz81(), va81()];
      ok('Build 81: Tuned to You on — 11000 Hz and movement 0.25 from silence, kept when a sound is added', Math.abs(on1[0] - 11000) < 600 && on1[1] === 0.25 && Math.abs(on2[0] - 11000) < 600 && on2[1] === 0.25, { on1: on1, on2: on2 });
      var chip81 = document.querySelector('.fa-tuned'); if (chip81) chip81.click(); await w(2500); var off81 = [hz81(), va81()];
      chip81 = document.querySelector('.fa-tuned'); if (chip81) chip81.click(); await w(2500); var back81 = [hz81(), va81()];
      ok('Build 81: Tuned to You chip — off gives 20000 Hz and no movement, on restores 11000 Hz and 0.25', !!chip81 && off81[0] > 19500 && off81[1] === 0 && Math.abs(back81[0] - 11000) < 600 && back81[1] === 0.25, { off: off81, on: back81 });
    } catch (e) { ok('Build 81: Tuned to You checks ran without an exception', false, String(e && e.message || e).slice(0, 200)); }
    stop81(); await w(1000);
    KEYS81.forEach(function (k) { if (SAVED81[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, SAVED81[k]); });
    location.hash = '#sounds'; await w(1000);
    // ---- Build 82: lock-screen pause/play are held only while Ask's capture runs and for 1 s after (device-only: real remote commands)
    var E82 = window.softwave;
    if (E82 && typeof E82.holdRemote === 'function') {
      var h0 = E82._remoteHeld(); E82.holdRemote(true); var h1 = E82._remoteHeld(); await w(1500); var h2 = E82._remoteHeld();
      E82.holdRemote(false); var h3 = E82._remoteHeld(); await w(1300); var h4 = E82._remoteHeld();
      ok('Build 82: lock-screen commands are held during a capture and for about 1 s after it, then handled again', !h0 && h1 && h2 && h3 && !h4, [h0, h1, h2, h3, h4]);
    } else ok('Build 82: engine.holdRemote present', false, null);
    skip('Build 82: iOS lock-screen pause/play during a spoken request', 'device-only: the simulator sends no remote commands and has no microphone session');
    // ---- Build 83: a sound started on a "running" context whose clock has stopped restarts the audio (simulated freeze on real WebKit)
    var E83 = window.softwave;
    try {
      var stop83 = function () { if (window.softwaveStopAll) softwaveStopAll(); else E83.stopAll(); };
      var realCt = function () { return Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'currentTime').get.call(E83.ctx); };
      stop83(); await w(1500); if (E83.ctx.state !== 'running') { await E83.resume(); await w(500); }
      var sus83 = 0, origSus = E83.ctx.suspend.bind(E83.ctx), frozen83 = false, frozenAt83 = 0;
      E83.ctx.suspend = function () { sus83++; frozen83 = false; return origSus(); };
      E83._clockOkAt = 0; E83._clockMark = null;
      await E83.startSound('pink', 0.45); await w(2500);
      var okHealthy = sus83 === 0 && E83.ctx.state === 'running' && rms() > SIG;
      ok('Build 83: healthy clock — a started sound plays with no extra suspend/resume cycle', okHealthy, { suspends: sus83, ctx: E83.ctx.state, rms: Math.round(rms() * 10000) / 10000 });
      stop83(); await w(1500);
      frozenAt83 = realCt(); frozen83 = true; E83._clockOkAt = 0; E83._clockMark = null; sus83 = 0;
      Object.defineProperty(E83.ctx, 'currentTime', { configurable: true, get: function () { return frozen83 ? frozenAt83 : realCt(); } });
      await E83.startSound('pink', 0.45); await w(2500);
      var a83 = realCt(); await w(300); var b83 = realCt();
      ok('Build 83: clock frozen while "running" — starting a sound runs one suspend/resume cycle and the sound plays', sus83 === 1 && !frozen83 && E83.ctx.state === 'running' && b83 > a83 && rms() > SIG, { suspends: sus83, frozen: frozen83, ctx: E83.ctx.state, moved: b83 > a83, rms: Math.round(rms() * 10000) / 10000 });
      delete E83.ctx.currentTime; E83.ctx.suspend = origSus; stop83(); await w(1200);
    } catch (e) { ok('Build 83: frozen-clock checks ran without an exception', false, String(e && e.message || e).slice(0, 200)); }
    skip('Build 83: iOS interrupts the audio just after a spoken request ends — the sound resumes by itself', 'device-only: the simulator has no microphone session');
    // ---- Build 86: the iPhone pause is held (graph and routed output running at level 0), released after its limit with the
    //      lock-screen controls withdrawn, and one Play restores everything (real WebKit; the lock screen itself is device-only)
    var E86 = window.softwave, MS86 = navigator.mediaSession;
    try {
      var st86 = function () { var m = E86.mediaOut; return { held: !!E86._softPaused, det: !!E86._outDetached, ctx: E86.ctx.state, out: m ? (m.paused ? 'PAUSED' : 'playing') : 'none', src: !!(m && m.srcObject), ms: MS86 ? MS86.playbackState : null, meta: !!(MS86 && MS86.metadata), playing: !!E86.isPlaying, paused: !!E86.userPaused, rms: Math.round(rms() * 10000) / 10000 }; };
      if (window.softwaveStopAll) softwaveStopAll(); else E86.stopAll(); await w(1500);
      await E86.startSound('pink', 0.45); await w(2500);
      var lim86 = E86._softPauseMs();
      ok('Build 86: the hold lasts 10 minutes by default', lim86 === 600000, lim86);
      await E86.pauseAll(); await w(1500); var p86 = st86();
      ok('Build 86: Pause holds — still paused for the app, silent, context running, output playing, lock screen "paused"', p86.held && p86.paused && !p86.playing && p86.ctx === 'running' && p86.out === 'playing' && p86.ms === 'paused' && p86.rms < 0.0008, p86);
      await E86.playAll(); await w(2000); var r86 = st86();
      ok('Build 86: Play from the held pause — sound at the output at once', !r86.held && r86.playing && r86.rms > SIG && r86.ms === 'playing', r86);
      if (DIAG) {
        localStorage.setItem('softwave:diag:pauseLimit', '4');
        await E86.pauseAll(); await w(6500); var x86 = st86();
        ok('Build 86: after its limit (4 s here) the held pause is released and the lock-screen controls withdrawn', !x86.held && x86.det && x86.paused && x86.ctx === 'suspended' && x86.out === 'PAUSED' && !x86.src && !x86.meta, x86);   // playbackState: WebKit relabels it "paused" itself when the element pauses (MediaSession::willPausePlayback); the controls stayed hidden on device (A3)
        await w(2500); var y86 = st86();
        ok('Build 86: the withdrawn controls stay withdrawn (no metadata, stream detached)', !y86.meta && y86.det && !y86.src, y86);
        await E86.playAll(); await w(2500); var z86 = st86();
        ok('Build 86: one Play after the release reattaches the output and the controls, and the sound plays', !z86.det && z86.src && z86.meta && z86.playing && z86.out === 'playing' && z86.rms > SIG && z86.ms === 'playing', z86);
        localStorage.removeItem('softwave:diag:pauseLimit');
      } else skip('Build 86: release after the limit (diagnostic bundle shortens it to 4 s)', 'release bundle: the 10-minute limit is not shortened');
      if (window.softwaveStopAll) softwaveStopAll(); else E86.stopAll(); await w(1500);
      ok('Build 86: Stop leaves nothing held', !E86._softPaused, st86());
    } catch (e) { ok('Build 86: pause checks ran without an exception', false, String(e && e.message || e).slice(0, 200)); }
    skip('Build 86: lock-screen and AirPods Play after a held pause; controls disappearing from the lock screen', 'device-only: needs the real lock screen');
    // ---- Build 80: the guided self-test (diagnostic bundle only) with scripted answers; the spoken step is device-only here
    if (DIAG && window.__swSelfTest) {
      var R80 = await window.__swSelfTest.run({ answer: function () { return true; } });
      var steps = {}; (R80 && R80.results || []).forEach(function (r) { steps[r.step] = r; });
      var expectPass = ['rain-start', 'pink-add', 'pause-holds', 'play-resumes', 'timer-stops', 'sleep-screen', 'stop-releases'];
      ok('Build 80 self-test: ' + expectPass.length + ' non-speech steps pass with scripted answers', !!R80 && expectPass.every(function (k) { return steps[k] && steps[k].pass; }), R80 && R80.results.map(function (r) { return r.step + ':' + (r.pass ? 'ok' : 'FAIL') + (r.note ? ' ' + r.note : ''); }));
      if (steps['spoken-request'] && steps['spoken-request'].pass) ok('Build 80 self-test: spoken step passed', true, null); else skip('Build 80 self-test: spoken-request step', 'device-only: no microphone or permission answer on the simulator');
      var slog = []; try { slog = JSON.parse(localStorage.getItem('softwave:diag:log') || '[]'); } catch (e) { }
      ok('Build 80 self-test: summary and 8 step lines in the diagnostic log, no transcript text', slog.some(function (o) { return o.tag === 'selftest:summary'; }) && slog.filter(function (o) { return o.tag === 'selftest:step'; }).length === 8 && !/"text"|play ocean/.test(localStorage.getItem('softwave:diag:log') || ''), null);
    } else skip('Build 80 self-test run', DIAG ? 'self-test script absent' : 'release bundle: no self-test');
    // ---- iPad: layout sanity on every view (no horizontal overflow, nav visible)
    if (IPAD) {
      var views = ['sounds', 'find', 'lab', 'sleep', 'focus', 'mixer', 'learn'], overflow = [];
      for (var vv = 0; vv < views.length; vv++) { location.hash = '#' + views[vv]; await w(900); if (document.documentElement.scrollWidth > window.innerWidth + 2) overflow.push(views[vv] + ':' + document.documentElement.scrollWidth + '>' + window.innerWidth); }
      ok('Build 80 iPad: no view overflows horizontally and the navigation is visible', overflow.length === 0 && !!(document.querySelector('.nav') && document.querySelector('.nav').offsetHeight), { overflow: overflow, w: window.innerWidth, h: window.innerHeight });
      await shot('ipad-sounds'); location.hash = '#sounds'; await w(900);
    }
    // ---- v273–v276: colour identity and the starter guide (Build 62)
    var GREEN = /rgba\((159, 224, 187|62, 154, 114), 0\.45\)/;
    var bc = function (sel) { var e = document.querySelector(sel); return e ? getComputedStyle(e).borderTopColor : null; };
    location.hash = '#find'; await w(1500);
    ok('Find My Sound family cards carry the green frame; Sound Response keeps its cyan edge', GREEN.test(bc('#view-find .lab-flagship')) && GREEN.test(bc('#view-find .find-card:not(.find-card-ri)')) && !GREEN.test(bc('#view-find .find-card-ri')), [bc('#view-find .lab-flagship'), bc('#view-find .find-card-ri')]);
    location.hash = '#lab'; for (i = 0; i < 40 && !document.querySelector('.lab-tile'); i++) await w(200);
    var tb = getComputedStyle(document.querySelector('.lab-tile'));
    ok('Experiments tiles rest on the neutral 1 px frame (green only on interaction)', tb.borderTopWidth === '1px' && !/159, 224, 187|62, 154, 114|143, 224, 180|79, 185, 138/.test(tb.borderTopColor), tb.borderTopWidth + ' ' + tb.borderTopColor);
    // ---- Experiments Back fix: this arrival at Experiments came from the Find My Sound view (the path on which Build 70's
    // header Back did nothing). One tap must close an open experiment; a running one stops first, then closes.
    var nb = function () { return document.getElementById('nav-back'); }, det = function () { return document.getElementById('lab-detail'); };
    var listShown = function () { var l = document.getElementById('lab-list'); return !!(l && l.offsetHeight > 0); };
    await w(1500);   // let the hash change's view switch land first (a tap cannot precede it); the tiles were already rendered at #find
    var tileM = document.querySelector('.lab-tile[data-id="morph"]'); if (tileM) tileM.click(); await w(900);
    ok('Experiments Back: Sound Morph opens from the list after a Find My Sound arrival; header Back shown; tile and panel carry the Premium launch tag', !!tileM && det() && !det().hidden && nb() && !nb().hidden && /Premium · free during launch/i.test(det().innerText) && /Premium · free during launch/i.test(tileM.innerText), { backHidden: nb() && nb().hidden, head: det() && det().innerText.slice(0, 80) });
    await shot('exp-back-open');
    if (nb()) nb().click(); await w(900);
    ok('Experiments Back: ONE header Back tap closes the panel and shows the list (Build 70: nothing happened here)', det() && det().hidden && listShown() && nb() && nb().hidden, { panelHidden: det() && det().hidden, list: listShown(), backHidden: nb() && nb().hidden });
    await shot('exp-back-list');
    tileM = document.querySelector('.lab-tile[data-id="morph"]'); if (tileM) tileM.click(); await w(900);
    var stb = document.querySelector('#lab-detail [data-exp-start]'); if (stb) stb.click(); await w(3000);
    var wasRunning = !!(window.softwaveLab && softwaveLab.isRunning()), hadSound = softwave.activeList().length > 0;
    if (nb()) nb().click(); await w(1200);
    var stopped = !(window.softwaveLab && softwaveLab.isRunning()), cardShown = !!document.querySelector('#lab-detail [data-after] .lab-result');
    await shot('exp-back-stopped');
    if (nb()) nb().click(); await w(900);
    ok('Experiments Back while Sound Morph runs: first tap stops it and shows "How did this feel?", second tap returns to the list; sound stopped', wasRunning && hadSound && stopped && cardShown && det().hidden && listShown() && softwave.activeList().length === 0, { wasRunning: wasRunning, hadSound: hadSound, stopped: stopped, cardShown: cardShown, panelHidden: det().hidden, list: listShown(), active: softwave.activeList().length });
    tileM = document.querySelector('.lab-tile[data-id="session"]'); if (tileM) tileM.click(); await w(900);
    var cl = document.querySelector('#lab-detail [data-close]'); if (cl) cl.click(); await w(700);
    ok('Experiments Back: "← Experiments" in the Build My Session panel returns to the list in one tap', !!cl && det().hidden && listShown(), { panelHidden: det().hidden, list: listShown() });
    // ---- Free and Premium wording (descriptions only; the monetization layer still grants everything)
    var pn = document.querySelector('#view-lab .premium-note'); var pt = pn ? pn.innerText : '';
    ok('Free and Premium card: launch all-access stated; Free three sounds at once; Premium five, Sound Morph, Build My Session; no five-layer Free claim', /every feature is free for everyone/.test(pt) && /up to three sounds at once/.test(pt) && /up to five sounds at once/.test(pt) && /Sound Morph/.test(pt) && /Build My Session/.test(pt) && !/mixer \(up to five layers/.test(pt), pt.slice(0, 160));
    var ph = ''; try { ph = await (await fetch('premium/index.html')).text(); } catch (e) { ph = 'fetch failed ' + e; }
    ok('premium/ page in the app bundle: comparison table (Mixer 3 / 5 sounds at once, Sound Morph No / Yes), no "Free today" list', /<td>Mixer<\/td><td>3 sounds at once<\/td><td>5 sounds at once<\/td>/.test(ph) && /<td>Sound Morph<\/td><td>No<\/td><td>Yes<\/td>/.test(ph) && !/Free today/.test(ph) && !/Sound Morph and Build My Session/.test(ph), ph.length);
    var MZ = window.softwaveMonetization;
    ok('monetization unchanged: launch all-access, every experiment usable, 5 mixer layers, unlimited saves, no paywall element', !!MZ && MZ.FLAGS.MONETIZATION_ENABLED === false && MZ.FLAGS.LAUNCH_ALL_ACCESS === true && MZ.FLAGS.SHOW_PRICING === false && MZ.subscriptionState() === 'launch_all_access' && MZ.activeLayerLimit() === 5 && MZ.canCreateSavedItem(99) && ['experiment:morph', 'experiment:session', 'experiment:sculptor', 'experiment:paint', 'experiment:discovery', 'mixer_layers'].every(function (k) { return MZ.canUse(k); }) && !document.getElementById('premium-veil'), MZ && { state: MZ.subscriptionState(), layers: MZ.activeLayerLimit() });
    location.hash = '#sounds'; await w(1500);
    var card = document.getElementById('journey-open');
    ok('starter card for a new user: "New here?…" with the green frame', !!card && /New here\?/.test(card.innerText) && GREEN.test(getComputedStyle(card).borderTopColor), card && card.innerText.slice(0, 60));
    await shot('starter-card');
    card.click(); await w(500); document.querySelector('[data-j-next]').click(); await w(400);
    var pb = document.querySelector('[data-j-play="brown"]'); pb.click(); await w(2500);
    ok('starter guide: Play Brown Noise → "Stop Brown Noise", pressed, brown playing', pb.getAttribute('aria-pressed') === 'true' && pb.textContent === 'Stop Brown Noise' && ids() === 'brown', [pb.textContent, ids()]);
    await shot('starter-playing');
    document.querySelector('[data-j-play="rain"]').click(); await w(2500);
    ok('switching to Rain stops Brown (one demo sound at a time)', ids() === 'rain' && pb.textContent === 'Play Brown Noise' && document.querySelector('[data-j-play="rain"]').textContent === 'Stop Rain', ids());
    document.querySelector('[data-j-later]').click(); await w(600);
    ok('Continue later: sound stopped, step 2 saved, card reads "Continue … Step 2 of 5"', ids() === '' && JSON.parse(localStorage.getItem('softwave:journey')).step === 1 && /Continue getting comfortable/.test(document.getElementById('journey-open').innerText) && /Step 2 of 5/.test(document.getElementById('journey-open').innerText), document.getElementById('journey-open').innerText);
    localStorage.setItem('softwave:journey', JSON.stringify({ step: 4, done: false, dismissed: false })); location.hash = '#find'; await w(700); location.hash = '#sounds'; await w(1200);
    document.getElementById('journey-open').click(); await w(500); document.querySelector('[data-j-next]').click(); await w(500);
    var nx = document.querySelector('[data-j-next]'), ch = document.querySelector('[data-j-choice]'), jc = document.querySelector('.journey-card').getBoundingClientRect();
    ok('step 5 without a profile: choice shown, primary hidden, Continue later kept, not done; dialog starts inside the viewport', ch && !ch.hidden && nx.hidden && !!document.querySelector('[data-j-later]').offsetParent && !JSON.parse(localStorage.getItem('softwave:journey')).done && jc.top >= 0, { top: Math.round(jc.top) });
    await shot('step5-choice');
    document.querySelector('[data-j-finish]').click(); await w(600);
    ok('"Finish without a profile" completes and removes the card', JSON.parse(localStorage.getItem('softwave:journey')).done && !document.getElementById('journey-open'), localStorage.getItem('softwave:journey'));
    location.hash = '#learn'; await w(900);
    ok('Learn page has the "Getting started" replay entry', !!document.getElementById('journey-reopen'), null);
    document.getElementById('journey-reopen').click(); await w(600);
    ok('replay from Learn opens step 1 for a completed user, card stays hidden', /step 1 of 5/.test((document.querySelector('.journey-card .muted') || {}).textContent || '') && !document.getElementById('journey-open'), null);
    document.querySelector('[data-j-later]').click(); await w(300); localStorage.removeItem('softwave:journey'); location.hash = '#sounds'; await w(900);
    // Sound Response: one full trial with the real 60 s sound; the screen is kept awake only while needed
    localStorage.setItem('softwave:match', JSON.stringify({ freq: 4000, type: 'sine', balance: 0, when: new Date().toISOString() }));
    location.hash = '#sounds'; await w(1200); document.querySelector('#view-sounds [data-ri-card]').click();
    for (i = 0; i < 40 && !window.softwaveRI; i++) await w(250);
    ok('Sound Response opens (ri-protocol.js + ri.js loaded)', !!window.softwaveRI && !!window.RIProtocol, { ri: !!window.softwaveRI });
    ok('Sound Response uses the real 60 s protocol in the app (no test timings)', window.RIProtocol && RIProtocol.CONFIG.stimulusSeconds === 60 && !/-test/.test(RIProtocol.version()), window.RIProtocol && RIProtocol.version());
    var setScale = function (id, v) { var x = document.querySelector('[data-scale="' + id + '"] input'); if (x) { x.value = v; x.dispatchEvent(new Event('input', { bubbles: true })); } };
    for (i = 0; i < 20 && screen() !== 'trialBaseline'; i++) {
      var s = screen();
      if (s === 'safety') { var so = document.getElementById('ri-safety-ok'); if (so) so.click(); act('next'); }
      else if (s === 'quiet') act('stop');
      else if (s === 'baseline') { setScale('b', 5); var u = document.querySelector('[data-vs="usual"]'); if (u) u.click(); act('next'); }
      else if (s === 'level') { await sampleTests(); act('next'); }
      else if (s === 'rest') { for (var j = 0; j < 60; j++) { var nb = document.querySelector('#ri-root [data-act="next"]'); if (nb && !nb.disabled) break; await w(500); } act('next'); }
      else if (!act('next')) { if (!act('start')) act('continue'); }
      await w(700);
    }
    await shot('ri-before-trial');
    var before = await kept();
    // ---- trial 1: the app is sent to the background during the sound (Settings for 8 s, then back) → never a valid trial
    setScale('t', 5); act('start'); await w(3000);
    var during = await kept(), sc = screen(); var o1 = meter();
    await shot('ri-listening');
    out('B61BGRI'); var t; for (t = 0; t < 160 && !document.hidden; t++) await w(250);
    var wentHidden = document.hidden; for (t = 0; t < 240 && document.hidden; t++) await w(250);
    await w(1500); var tr1 = lastTrial();
    ok('backgrounded during the sound: trial invalidated (backgrounded, or audio_interrupted where iOS stops the audio first), shown as interrupted, no output hold left', sc === 'listen' && wentHidden && !document.hidden && tr1 && tr1.trial_valid === false && (tr1.trial_invalid_reason === 'backgrounded' || tr1.trial_invalid_reason === 'audio_interrupted') && screen() === 'interrupted' && hold() === 0, { screen: screen(), wentHidden: wentHidden, hidden: document.hidden, trial: tr1 && { valid: tr1.trial_valid, reason: tr1.trial_invalid_reason }, hold: hold(), outAtStart: o1 });
    ok('…and the screen wake lock was released by the interruption', (await kept()) === false, null);
    act('next'); for (i = 0; i < 40 && screen() !== 'trialBaseline'; i++) { var s2 = screen(); if (s2 === 'rest') { for (var j = 0; j < 120; j++) { var nb2 = document.querySelector('#ri-root [data-act="next"]'); if (nb2 && !nb2.disabled) break; await w(500); } act('next'); } else if (s2 !== 'trialBaseline') act('next'); await w(700); }
    ok('after the interruption the session continues to the next sound', screen() === 'trialBaseline', screen());
    // ---- trial 2: one complete 60 s sound, the routed output measured every 0.5 s
    setScale('t', 5); act('start'); await w(1000);
    var rows = [], t0 = Date.now();
    for (i = 0; i < 160 && screen() === 'listen'; i++) { rows.push(meter()); await w(500); }
    var listenSecs = Math.round((Date.now() - t0) / 100) / 10;
    for (i = 0; i < 40 && screen() !== 'response'; i++) await w(500);
    var atResp = await kept();
    var pausedRows = rows.filter(function (r) { return r.out === 'PAUSED'; }), sigRows = rows.filter(function (r) { return r.rms > SIG; }).length;
    var firstP = rows.findIndex(function (r) { return r.out === 'PAUSED'; }); var ctMoves = rows.some(function (r) { return r.ct !== rows[0].ct; }); var advance = rows.length ? Math.round((rows[rows.length - 1].ct - rows[0].ct) * 10) / 10 : null;
    var sum2 = { samples: rows.length, listenSeconds: listenSecs, pausedSamples: pausedRows.length, firstPausedAt_s: firstP < 0 ? null : (firstP + 1) * 0.5, signalSamples: sigRows, elementTimeAdvanced_s: ctMoves ? advance : 'not reported', countAtEnd: rows.length ? rows[rows.length - 1].count : null, every10s: rows.filter(function (_, k) { return k % 20 === 0; }) };
    L('ri-output', sum2);
    if (FIXED()) {
      // ≥ 100 samples: an emulated audio clock can run ~10 % fast (iOS 15.0 simulator: 60 s of context time in ~55 s wall time), see listenSeconds
      ok('complete 60 s sound: routed output playing on every 0.5 s sample and signal present throughout (never paused under the countdown)', rows.length >= 100 && pausedRows.length === 0 && sigRows >= rows.length * 0.93, sum2);
      ok('complete 60 s sound: the output element\'s own clock advanced about 60 s (or is not reported by this WebKit — see info)', !ctMoves || advance >= Math.min(55, listenSecs - 2), { elementTimeAdvanced_s: sum2.elementTimeAdvanced_s, listenSeconds: listenSecs });
    } else {
      ok('UNFIXED Build 62: routed output paused within 6 s of Start while the countdown ran on to the question (defect reproduced on WKWebView)', pausedRows.length > 0 && firstP >= 0 && (firstP + 1) * 0.5 <= 6 && screen() === 'response', sum2);
    }
    var resp = document.querySelector('[data-resp="same"]'); if (resp) resp.click(); await w(1500);
    var after = await kept(); var tr2 = lastTrial();
    if (FIXED()) ok('the complete trial is recorded valid with about 60 s played', tr2 && tr2.trial_valid === true && Math.abs(tr2.stimulus_played_seconds - 60) <= 1, tr2 && { valid: tr2.trial_valid, played: tr2.stimulus_played_seconds, reason: tr2.trial_invalid_reason });
    else ok('UNFIXED Build 62: the mostly silent trial was still recorded as VALID (the data defect)', tr2 && tr2.trial_valid === true, tr2 && { valid: tr2.trial_valid, played: tr2.stimulus_played_seconds });
    ok('screen kept awake from Start through the answer, released after it', before === false && sc === 'listen' && during === true && atResp === true && after === false, { before: before, screen: sc, during: during, atResp: atResp, after: after, now: screen() });
    var rel = false, relM = null; for (i = 0; i < 16; i++) { await w(500); relM = meter(); if (hold() === 0 && relM.out === 'PAUSED') { rel = true; break; } }
    if (FIXED()) ok('after the answer: no hold left and the routed output released as idle within 8 s', rel, { hold: hold(), m: relM });
    L('ua', navigator.userAgent);
    // guides carry the app wording
    var g = await (await fetch('learn/getting-around-find-my-quiet-sound/index.html')).text();
    ok('Getting Around guide shows the iPhone wording and Ambient Drift', /Offline and privacy/.test(g) && /Generative Sound offers Ambient Drift/.test(g) && !/Install app/.test(g) && !/<!--(web|app:)/.test(g), null);
  }

  async function upgradeChecks() {
    var post = {}; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf('softwave:') === 0) post[k] = localStorage.getItem(k); }
    // unchanged, or (for JSON objects such as usage counters) every 1.0 field kept with its value: additive only
    // usage counters (softwave:metrics) only count up, as they do in 1.0 on every launch
    var keeps = function (a, b, k) { try { var x = JSON.parse(a), y = JSON.parse(b); if (x && typeof x === 'object' && !Array.isArray(x) && y && typeof y === 'object') return Object.keys(x).every(function (f) { return JSON.stringify(x[f]) === JSON.stringify(y[f]) || (k === 'softwave:metrics' && typeof x[f] === 'number' && y[f] >= x[f]); }); } catch (e) { } return false; };
    var lost = [], changed = [], added = [];
    Object.keys(PRE).forEach(function (k) { if (!(k in post)) lost.push(k); else if (post[k] !== PRE[k]) (keeps(PRE[k], post[k], k) ? added : changed).push(k); });
    L('additive', added);
    L('post', { keys: Object.keys(post).length, data: post });
    ok('every saved 1.0 key is still present after the upgrade', lost.length === 0, lost);
    // master: approved 60 % restore rule. rasterMs/rasterSlow: graphics-speed measurement the app (1.0 and 1.1 alike, field.js) re-takes on every launch.
    var EXEMPT = ['softwave:master', 'softwave:rasterMs', 'softwave:rasterSlow', 'softwave:diag:log'];   // diag:log: the diagnostic's own log, which grows between the seed and the upgrade run
    ok('saved values unchanged (only the volume restore rule and the per-launch graphics measurement differ)', changed.filter(function (k) { return EXEMPT.indexOf(k) < 0; }).length === 0, changed);
    var m = JSON.parse(post['softwave:master'] || 'null'), m0 = JSON.parse(PRE['softwave:master'] || 'null');
    ok('master volume above 60 % reopens at 60 % (approved restore cap)', m0 > 0.6 && Math.abs(m - 0.6) < 1e-9 && Math.abs(window.softwave.masterVolume - 0.6) < 0.01, { before: m0, after: m, engine: window.softwave.masterVolume });
    ok('theme kept (light)', document.documentElement.dataset.theme === 'light', document.documentElement.dataset.theme);
    location.hash = '#sounds'; await w(2500);
    var txt = document.body.innerText;
    ok('saved mix and saved session appear', txt.indexOf('My rain + brown') >= 0 && txt.indexOf('Ocean evening') >= 0, null);
    ok('saved sound appears under My Saved Sounds', txt.indexOf('Soft hush') >= 0, null);
    var jcard = document.getElementById('journey-open');
    ok('upgrade: partial starter-guide progress kept — card reads "Continue … Step 3 of 5"', !!jcard && /Continue getting comfortable/.test(jcard.innerText) && /Step 3 of 5/.test(jcard.innerText), jcard && jcard.innerText.slice(0, 80));
    ok('upgrade: sound profile kept — Your Moments present', document.querySelectorAll('#moments .chip').length > 0, document.querySelectorAll('#moments .chip').length);
    await shot('upgrade-sounds');
    location.hash = '#match'; await w(2500);
    var f = document.getElementById('view-match'); var ft = f ? f.textContent : '';
    ok('saved tinnitus match (6,200 Hz) is shown in Find My Tinnitus Sound', /6,200/.test(ft), ft.replace(/\s+/g, ' ').slice(0, 160));
    await shot('upgrade-match');
    location.hash = '#lab'; for (i = 0; i < 40 && !document.querySelector('.lab-tile[data-id="notched"]'); i++) await w(200);
    ok('Experiments favourite kept (Generative Sound)', JSON.parse(post['softwave:lab:favs'] || '[]').indexOf('generative') >= 0, post['softwave:lab:favs']);
    document.querySelector('.lab-tile[data-id="notched"]').click();
    var pf = null; for (i = 0; i < 40; i++) { await w(250); pf = document.querySelector('#lab-detail [data-nx="profiles"]'); if (pf && pf.textContent.indexOf('Evening notch') >= 0) break; }
    ok('Notched Sound profile listed', pf && pf.textContent.indexOf('Evening notch') >= 0, pf && pf.textContent.trim().slice(0, 120));
    await shot('upgrade-notched');
  }
})();
