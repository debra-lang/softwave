/* TEST-ONLY (simulator builds of Build 61; never in the TestFlight/App Store build).
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
      else if (s === 'rest') { for (var j = 0; j < 60; j++) { var nb = document.querySelector('#ri-root [data-act="next"]'); if (nb && !nb.disabled) break; await w(500); } act('next'); }
      else if (!act('next')) { if (!act('start')) act('continue'); }
      await w(700);
    }
    await shot('ri-before-trial');
    var before = await kept();
    setScale('t', 5); act('start'); await w(2500);
    var during = await kept(), sc = screen();
    await shot('ri-listening');
    for (i = 0; i < 180 && screen() !== 'response'; i++) await w(500);
    var atResp = await kept();
    var resp = document.querySelector('[data-resp="same"]'); if (resp) resp.click(); await w(1500);
    var after = await kept();
    ok('screen kept awake from Start through the answer, released after it', before === false && sc === 'listen' && during === true && atResp === true && after === false, { before: before, screen: sc, during: during, atResp: atResp, after: after, now: screen() });
    act('stopx'); await w(800);
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
