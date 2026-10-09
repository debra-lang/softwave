/* TEST-ONLY (simulator builds of the Build 63 candidate and of the unfixed Build 62; never in the TestFlight/App Store build).
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
    L('done', { mode: upgrade ? 'upgrade' : 'fresh', passed: res.length - failed.length, failed: failed.length, failures: failed, errors: errs.slice(0, 6) });
  }

  async function run() {
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
    // ---- v273–v276: colour identity and the starter guide (Build 62)
    var GREEN = /rgba\((159, 224, 187|62, 154, 114), 0\.45\)/;
    var bc = function (sel) { var e = document.querySelector(sel); return e ? getComputedStyle(e).borderTopColor : null; };
    location.hash = '#find'; await w(1500);
    ok('Find My Sound family cards carry the green frame; Sound Response keeps its cyan edge', GREEN.test(bc('#view-find .lab-flagship')) && GREEN.test(bc('#view-find .find-card:not(.find-card-ri)')) && !GREEN.test(bc('#view-find .find-card-ri')), [bc('#view-find .lab-flagship'), bc('#view-find .find-card-ri')]);
    location.hash = '#lab'; for (i = 0; i < 40 && !document.querySelector('.lab-tile'); i++) await w(200);
    var tb = getComputedStyle(document.querySelector('.lab-tile'));
    ok('Experiments tiles rest on the neutral 1 px frame (green only on interaction)', tb.borderTopWidth === '1px' && !/159, 224, 187|62, 154, 114|143, 224, 180|79, 185, 138/.test(tb.borderTopColor), tb.borderTopWidth + ' ' + tb.borderTopColor);
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
    ok('backgrounded during the sound: trial invalidated (backgrounded), shown as interrupted, no output hold left', sc === 'listen' && wentHidden && !document.hidden && tr1 && tr1.trial_valid === false && tr1.trial_invalid_reason === 'backgrounded' && screen() === 'interrupted' && hold() === 0, { screen: screen(), wentHidden: wentHidden, hidden: document.hidden, trial: tr1 && { valid: tr1.trial_valid, reason: tr1.trial_invalid_reason }, hold: hold(), outAtStart: o1 });
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
      ok('complete 60 s sound: routed output playing on every 0.5 s sample and signal present throughout (never paused under the countdown)', rows.length >= 110 && pausedRows.length === 0 && sigRows >= rows.length * 0.93, sum2);
      ok('complete 60 s sound: the output element\'s own clock advanced about 60 s (or is not reported by this WebKit — see info)', !ctMoves || advance >= 55, { elementTimeAdvanced_s: sum2.elementTimeAdvanced_s });
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
    var EXEMPT = ['softwave:master', 'softwave:rasterMs', 'softwave:rasterSlow'];
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
