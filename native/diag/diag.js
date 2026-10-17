/* DIAGNOSTIC BUILD ONLY (TestFlight Build 73, branch ios-72-diag). Observation only: records, with timestamps, what the
   audio engine reports against what actually reaches the routed output, the phases of a speech-recognition session
   (event names only), slider and microphone taps (ids only), an analyser glitch detector (discontinuities, dropouts,
   level swings while no volume call was made), keyboard/focus/viewport events, user-gesture recovery and the native
   audio-session lines the app delegate forwards (category, mode, options, sample rate, buffer, route, interruptions).
   It never calls play, pause, resume, suspend, setTimer, start/stop recognition or any gain; every wrapper is a
   synchronous pass-through and the glitch detector only reads the analyser (no node is added to the audio graph).
   Privacy: no typed text, no input values, no microphone audio, no speech transcripts, no identifiers. The log stays in
   this device's localStorage until the user copies or shares it from the Diag panel. */
(function () {
  'use strict';
  var KEY = 'softwave:diag:log', MAX = 3000, T0 = Date.now();
  var buf = [], dirty = false, marks = 0, E = null, hooked = false, ctxHooked = false, elHooked = false;
  try { var prev = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(prev)) buf = prev.slice(-MAX); } catch (e) { buf = []; }
  var rmsBuf = null;
  function rms() { try { var a = E && E.analyser; if (!a) return null; var n = a.fftSize; if (!rmsBuf || rmsBuf.length !== n) rmsBuf = new Float32Array(n);
    a.getFloatTimeDomainData(rmsBuf); var s = 0; for (var i = 0; i < n; i++) s += rmsBuf[i] * rmsBuf[i]; return Math.round(Math.sqrt(s / n) * 100000) / 100000; } catch (e) { return null; } }
  function snap() {
    if (!E) return { engine: 'absent' };
    var c = E.ctx, m = E.mediaOut, t = E.timer || {};
    return { ctx: c ? c.state : null, ct: c ? Math.round(c.currentTime * 100) / 100 : null, el: m ? (m.paused ? 'PAUSED' : 'playing') : 'none', elT: m ? Math.round(m.currentTime * 100) / 100 : null,
      rms: rms(), master: E.master ? Math.round(E.master.gain.value * 10000) / 10000 : null, playing: !!E.isPlaying, up: !!E.userPaused, act: E.active ? E.active.size : null,
      gest: !!E._needsGesture, hold: E._external || 0, timer: t.durationMin || null, left: t.endsAt ? Math.round((t.endsAt - Date.now()) / 1000) : null, fading: !!t.fading,
      sr: c ? c.sampleRate : null, bl: c && typeof c.baseLatency === 'number' ? Math.round(c.baseLatency * 1000) : null, ol: c && typeof c.outputLatency === 'number' ? Math.round(c.outputLatency * 1000) : null,
      ms: ('mediaSession' in navigator) ? navigator.mediaSession.playbackState : null, focus: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null,
      vv: window.visualViewport ? Math.round(window.visualViewport.height) : null, hidden: document.hidden };
  }
  function log(tag, extra, withSnap) {
    var o = { t: Date.now() - T0, tag: tag };
    if (extra !== undefined) o.d = extra;
    if (withSnap !== false) o.s = snap();
    buf.push(o); if (buf.length > MAX) buf.splice(0, buf.length - MAX); dirty = true;
    try { console.log('SWDIAG ' + JSON.stringify(o)); } catch (e) { }
  }
  function persist() { if (!dirty) return; dirty = false; try { localStorage.setItem(KEY, JSON.stringify(buf)); } catch (e) { } }
  setInterval(persist, 5000); addEventListener('pagehide', persist); document.addEventListener('visibilitychange', function () { if (document.hidden) persist(); });
  window.__swDiagNative = function (o) { try { log('native:' + (o && o.type), o, true); } catch (e) { } };
  log('diag:start', { ua: navigator.userAgent.slice(0, 160), native: !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()), when: new Date().toISOString() }, false);

  // ---- engine hooks: pass-through wrappers (log, then call the original with the same this/arguments)
  var WRAP = ['pauseAll', 'playAll', 'resume', '_keepAlive', 'setTimer', 'clearTimer', '_scheduleTimerFade', '_timerFinish', '_timerFinalize', 'setMasterVolume', 'setVolume', 'setMasterTrim', 'setMasterTone', 'setVariation', 'holdOutput', 'startSound', 'stopSound', 'stopAll', 'loadMix'];
  var lastGainCallAt = 0;   // the glitch detector treats level movement within 1.5 s of these as explained
  var GAINCALLS = { setMasterVolume: 1, setVolume: 1, setMasterTrim: 1, setMasterTone: 1, setVariation: 1, pauseAll: 1, playAll: 1, startSound: 1, stopSound: 1, stopAll: 1, loadMix: 1, _scheduleTimerFade: 1, _timerFinish: 1 };
  function argStr(a) { return [].slice.call(a).map(function (x) { return (x && typeof x === 'object') ? (Array.isArray(x) ? '[' + x.length + ']' : '{}') : x; }); }
  var masterEvents = 0;
  function hookEngine() {
    if (hooked || !window.softwave) return; E = window.softwave; hooked = true;
    WRAP.forEach(function (n) { var o = E[n]; if (typeof o !== 'function') return;
      E[n] = function () { if (GAINCALLS[n]) lastGainCallAt = Date.now(); log('call:' + n, argStr(arguments)); return o.apply(this, arguments); }; });
    if (typeof E.on === 'function') { var lastTimerLog = 0; E.on(function (type, data) {
      if (type === 'timer') { var now = Date.now(); if (now - lastTimerLog < 10000) return; lastTimerLog = now; log('ev:timer', { left: data && data.endsAt ? Math.round((data.endsAt - Date.now()) / 1000) : null, fading: !!(data && data.fading) }); return; }
      if (type === 'master') { masterEvents++; return; }
      log('ev:' + type, typeof data === 'string' ? data : undefined); }); }
    log('diag:engine-hooked', { tag: (document.getElementById('build-tag') || {}).textContent || null }, false);
  }
  function hookCtx() {
    if (!E) return;
    if (!ctxHooked && E.ctx) { ctxHooked = true; E.ctx.addEventListener('statechange', function () { log('ctx:' + E.ctx.state); }); log('diag:ctx-hooked', { state: E.ctx.state, sr: E.ctx.sampleRate }); }
    if (!elHooked && E.mediaOut) { elHooked = true; ['play', 'playing', 'pause', 'waiting', 'stalled', 'suspend', 'emptied', 'ended', 'error', 'abort'].forEach(function (ev) { E.mediaOut.addEventListener(ev, function () { log('element:' + ev); }); }); log('diag:element-hooked'); }
  }
  var hookPoll = setInterval(function () { hookEngine(); hookCtx(); if (hooked && ctxHooked && elHooked) clearInterval(hookPoll); }, 200);

  // ---- UI steps of the timer flow (labels of app buttons only; never input values)
  function uiLabel(el) {
    var b = el.closest && el.closest('button, .chip, [data-fa], [data-act]'); if (!b) return null;
    if (b.id === 'sleep-timer' || b.getAttribute('data-fa') === 'timer' || b.getAttribute('data-act') === 'timer' || b.id === 'now-timer' || b.id === 'mix-timer') return 'timer-open';
    if (b.closest('[data-t-opts]')) return 'timer-chip:' + b.textContent.trim().slice(0, 24);
    if (b.closest('[data-custom-timer]')) return b.type === 'submit' ? 'custom-set' : (b.hasAttribute('data-cancel') ? 'custom-cancel' : 'custom-form-button');
    if (b.hasAttribute('data-t-close')) return 'timer-close';
    if (/^(sleep|field|now|mix|focus)-(pause|stop|enter|exit|add|save)$/.test(b.id) || b.id === 'player-toggle' || b.id === 'player-stop') return 'button:' + b.id;
    if (b.classList.contains('vol-pause')) return 'button:pause/play'; if (b.classList.contains('vol-stop')) return 'button:stop';
    if (b.id === 'ask-mic') return 'ask-mic'; if (b.closest('#ask-form') && b.type === 'submit') return 'ask-go'; if (b.id === 'ask-undo') return 'ask-undo';
    if (b.classList.contains('card-btn')) { var c = b.closest('.sound-card'); return 'sound-card:' + ((c && c.dataset && c.dataset.id) || '?'); }
    return null;
  }
  document.addEventListener('click', function (e) { var l = e.target && uiLabel(e.target); if (l) log('ui:' + l, { trusted: e.isTrusted }); }, true);
  document.addEventListener('submit', function (e) { if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-custom-timer')) log('ui:custom-submit', { trusted: e.isTrusted }); }, true);
  var sliderLast = {};
  document.addEventListener('input', function (e) { var t = e.target; if (!t || t.type !== 'range') return; var id = t.id || (t.closest('.sound-card') ? 'card-level' : 'range'); var now = Date.now(); if (now - (sliderLast[id] || 0) < 400) return; sliderLast[id] = now; log('ui:slider:' + id, { trusted: e.isTrusted }); }, true);
  document.addEventListener('submit', function (e) { if (e.target && e.target.id === 'ask-form') log('ui:ask-submit', { trusted: e.isTrusted }); }, true);
  // ---- speech recognition: phases only (event names, error codes, result counts) — never the audio or the transcript.
  // The constructor is wrapped so the recogniser the app creates reports its lifecycle; start/stop/abort pass through.
  ['webkitSpeechRecognition', 'SpeechRecognition'].forEach(function (name) {
    var Real = window[name]; if (typeof Real !== 'function') return;
    var Wrapped = function () {
      var r = new Real();
      var canListen = r && typeof r.addEventListener === 'function';   // (a test double without EventTarget is left alone)
      // WebKit can deliver result events continuously while listening (tens of thousands on a simulator without a
      // microphone): results are counted and reported at most once per 2 s and at the end of the session, so a
      // recogniser that keeps running after the app stopped listening stays visible without flooding the log.
      var resTotal = 0, resSince = 0, resLogAt = 0;
      var flushRes = function (why) { if (!resSince) return; log('sr:result', { since: resSince, total: resTotal, at: why }); resSince = 0; resLogAt = Date.now(); };
      if (canListen) ['start', 'audiostart', 'soundstart', 'speechstart', 'speechend', 'soundend', 'audioend', 'result', 'nomatch', 'error', 'end'].forEach(function (ev) {
        try { r.addEventListener(ev, function (e) {
          if (ev === 'result') { resTotal++; resSince++; if (Date.now() - resLogAt > 2000) flushRes('stream'); return; }
          if (ev === 'end' || ev === 'error') flushRes(ev);
          log('sr:' + ev, ev === 'error' ? { error: e && e.error, results: resTotal } : (ev === 'end' ? { results: resTotal } : undefined));
        }); } catch (e) { }
      });
      ['start', 'stop', 'abort'].forEach(function (m) { var o = r[m]; if (typeof o === 'function') r[m] = function () { log('sr:call:' + m); return o.apply(r, arguments); }; });
      log('sr:created', { events: canListen });
      return r;
    };
    Wrapped.prototype = Real.prototype;
    try { window[name] = Wrapped; } catch (e) { }
  });
  // ---- keyboard, focus, viewport, lifecycle
  document.addEventListener('focusin', function (e) { log('focusin', (e.target && (e.target.id || e.target.tagName)) || null); }, true);
  document.addEventListener('focusout', function (e) { log('focusout', (e.target && (e.target.id || e.target.tagName)) || null); }, true);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', function () { log('visualViewport:resize', Math.round(window.visualViewport.height)); });
  addEventListener('resize', function () { log('window:resize', innerHeight); });
  addEventListener('blur', function () { log('window:blur'); }); addEventListener('focus', function () { log('window:focus'); });
  document.addEventListener('visibilitychange', function () { log('visibility', document.hidden ? 'hidden' : 'visible'); });
  addEventListener('pagehide', function () { log('pagehide'); }); addEventListener('pageshow', function () { log('pageshow'); });
  // ---- user-gesture recovery: the engine's capture listeners on pointerdown/touchend resume an interrupted context and
  // restart a paused element. Snapshot before them (this script registers first) and again 150 ms later.
  ['pointerdown', 'touchend'].forEach(function (ev) { document.addEventListener(ev, function () { var before = snap(); setTimeout(function () { var after = snap(); if (before.ctx !== after.ctx || before.el !== after.el || before.gest !== after.gest) log('gesture:' + ev, { before: before, after: after }, false); }, 150); }, { capture: true, passive: true }); });

  // ---- automatic failure capture (no user action needed): every 250 ms, is the engine playing while nothing reaches the output?
  // Two classes: the context not running or the element paused (what a touch would restore) count after 0.75 s;
  // a silent analyser alone (the graph itself producing nothing while the engine expects sound) only after 5 s,
  // because sparse generative sounds such as Ambient Drift legitimately fall silent for a second or two.
  var hardRun = 0, silentRun = 0, okRun = 0, lost = false, lastBeat = 0, sampleN = 0;
  setInterval(function () {
    if (!E || !E.ctx) return; var s = snap(); sampleN++;
    var expectsSound = s.act > 0 && !s.up && s.master !== null && s.master > 0.01;
    var hard = s.ctx !== 'running' || s.el === 'PAUSED';
    var silent = s.ctx === 'running' && s.el !== 'PAUSED' && s.rms !== null && s.rms < 0.0005;
    if (expectsSound && hard) { hardRun++; okRun = 0; } else hardRun = 0;
    if (expectsSound && silent) { silentRun++; okRun = 0; } else silentRun = 0;
    if (!(expectsSound && (hard || silent))) okRun++;
    if (!lost && (hardRun >= 3 || silentRun >= 20)) { lost = true; log('AUTO:output-lost', { why: [s.ctx !== 'running' ? 'context ' + s.ctx : null, s.el === 'PAUSED' ? 'element paused' : null, silentRun >= 20 ? 'silent signal for 5 s' : null].filter(Boolean) }); }
    else if (lost && okRun >= 2) { lost = false; log('AUTO:output-restored'); }
    if (lost && Date.now() - lastBeat > 2000) { lastBeat = Date.now(); log('AUTO:still-lost'); }
    if (sampleN % 40 === 0) log('sample'); // a plain snapshot every 10 s while nothing is wrong
  }, 250);

  // ---- analyser glitch detector (observation only: reads the analyser's 1024-sample frame every 20 ms; nothing is added
  // to the graph). Per frame: RMS, peak, the largest sample-to-sample step, near-zero samples, and the master gain. A
  // step far above the frame's own median step AND above the largest steps of the surrounding frames is a discontinuity (a click); a frame far below the running level is a
  // dropout; a frame of zeros while sound is expected is a gap — both only when no level call (volume, start, stop, timer
  // fade) was made in the previous 1.5 s. Level swings are reported only when no level call was made in the previous 1.5 s and the master gain did not move — movement the user did not ask for. Broadband sounds
  // (pink/white noise, My Sound) have large natural steps, so thresholds are relative to each frame's median step.
  var gFrame = null, gWin = [], gLastGlitchAt = 0, gLastSummary = Date.now();
  setInterval(function () {
    try {
      var a = E && E.analyser, c = E && E.ctx; if (!a || !c || c.state !== 'running') return;
      var n = a.fftSize; if (!gFrame || gFrame.length !== n) gFrame = new Float32Array(n);
      a.getFloatTimeDomainData(gFrame);
      var s = 0, pk = 0, zeros = 0, i, steps = [];
      for (i = 0; i < n; i++) { var v = gFrame[i]; s += v * v; var av = v < 0 ? -v : v; if (av > pk) pk = av; if (av < 1e-4) zeros++; if (i) { var d = v - gFrame[i - 1]; steps.push(d < 0 ? -d : d); } }
      steps.sort(function (x, y) { return x - y; });
      var f = { t: Date.now(), rms: Math.sqrt(s / n), pk: pk, stepMed: steps[steps.length >> 1], stepMax: steps[steps.length - 1], zeros: zeros, g: E.master ? E.master.gain.value : null, expects: E.active && E.active.size > 0 && !E.userPaused && E.master && E.master.gain.value > 0.01 && (E.mediaOut ? !E.mediaOut.paused : true) };
      gWin.push(f); if (gWin.length > 120) gWin.shift();
      if (!f.expects) return;
      var recent = gWin.slice(-50).filter(function (x) { return x.expects; }); var rmsSorted = recent.map(function (x) { return x.rms; }).sort(function (x, y) { return x - y; }); var rmsMed = rmsSorted[rmsSorted.length >> 1] || 0;
      var smSorted = recent.slice(0, -1).map(function (x) { return x.stepMax; }).sort(function (x, y) { return x - y; }); var smMed = smSorted[smSorted.length >> 1] || 0;
      var click = recent.length >= 25 && f.stepMax > Math.max(0.03, f.stepMed * 14, smMed * 4) && f.pk > 0.002;
      var explained = Date.now() - lastGainCallAt < 1500;   // the user's own level change, a start, a stop or a timer fade is moving the level
      var dropout = !explained && recent.length >= 25 && rmsMed > 0.001 && f.rms < rmsMed * 0.15;
      var gap = !explained && zeros > n * 0.9 && rmsMed > 0.001;
      if ((click || dropout || gap) && Date.now() - gLastGlitchAt > 2000) { gLastGlitchAt = Date.now(); log('AUTO:glitch', { click: click, dropout: dropout, gap: gap, stepMax: +f.stepMax.toFixed(4), stepMed: +f.stepMed.toFixed(4), rms: +f.rms.toFixed(4), rmsMed: +rmsMed.toFixed(4), zeros: zeros, master: f.g, sinceGainCall_ms: Date.now() - lastGainCallAt }); }
      if (Date.now() - gLastSummary >= 4000) {
        gLastSummary = Date.now();
        var w = gWin.filter(function (x) { return x.expects && Date.now() - x.t <= 4000; }); if (w.length < 10) return;
        var r = w.map(function (x) { return x.rms; }), gs = w.map(function (x) { return x.g; });
        var rMin = Math.min.apply(null, r), rMax = Math.max.apply(null, r), gMin = Math.min.apply(null, gs), gMax = Math.max.apply(null, gs);
        var smAll = w.map(function (x) { return x.stepMax; }).sort(function (x, y) { return x - y; }); var smM = smAll[smAll.length >> 1] || 0;
        var clicks = w.filter(function (x) { return x.stepMax > Math.max(0.03, x.stepMed * 14, smM * 4) && x.pk > 0.002; }).length;
        var swing = rMin > 0 ? rMax / rMin : null; var unexplained = swing !== null && swing > 3 && gMax - gMin < 0.01 && Date.now() - lastGainCallAt > 1500;
        log('audio:4s', { frames: w.length, rmsMin: +rMin.toFixed(4), rmsMed: +r.sort(function (x, y) { return x - y; })[r.length >> 1].toFixed(4), rmsMax: +rMax.toFixed(4), swing: swing === null ? null : +swing.toFixed(2), unexplainedSwing: unexplained, clicks: clicks, gaps: w.filter(function (x) { return x.zeros > n * 0.9; }).length, masterMin: +gMin.toFixed(4), masterMax: +gMax.toFixed(4), masterEvents: masterEvents, sr: c.sampleRate, el: E.mediaOut ? (E.mediaOut.paused ? 'PAUSED' : 'playing') : 'none', act: E.active.size }, false);
        masterEvents = 0;
      }
    } catch (e) { }
  }, 20);

  // ---- panel: Diag button (top-left), log view, Copy / Share / Mark / Clear. Nothing here touches audio.
  function text() { return buf.map(function (o) { return o.t + ' ' + o.tag + (o.d !== undefined ? ' ' + JSON.stringify(o.d) : '') + (o.s ? ' ' + JSON.stringify(o.s) : ''); }).join('\n'); }
  function ui() {
    var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Diag'; btn.setAttribute('aria-label', 'Open the audio diagnostic log');
    btn.style.cssText = 'position:fixed;right:0;top:42%;z-index:2147483000;font:600 10px system-ui;padding:6px 5px;border-radius:8px 0 0 8px;border:1px solid rgba(255,255,255,.3);border-right:0;background:rgba(20,24,40,.7);color:#dfe6ff;opacity:.7;';
    var panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:2147483001;background:rgba(8,10,20,.96);color:#e8ecff;font:12px/1.35 ui-monospace,Menlo,monospace;display:none;flex-direction:column;box-sizing:border-box;padding:calc(env(safe-area-inset-top,0px) + 8px) 10px calc(env(safe-area-inset-bottom,0px) + 10px);';
    var bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;';
    var ta = document.createElement('textarea'); ta.readOnly = true; ta.setAttribute('aria-label', 'Diagnostic log'); ta.style.cssText = 'flex:1;width:100%;background:#0b0f1e;color:#cfd6ff;border:1px solid #334;border-radius:8px;padding:8px;font:11px/1.3 ui-monospace,Menlo,monospace;white-space:pre;';
    var status = document.createElement('div'); status.style.cssText = 'margin-top:6px;font:12px system-ui;color:#9fb0d8;min-height:1.2em;';
    var mk = function (label, fn) { var b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.style.cssText = 'font:600 13px system-ui;padding:8px 12px;border-radius:9px;border:1px solid #556;background:#1a2140;color:#eef;'; b.addEventListener('click', fn); bar.appendChild(b); return b; };
    var refresh = function () { var lines = text().split('\n'); ta.value = lines.slice(-600).join('\n'); ta.scrollTop = ta.scrollHeight; status.textContent = buf.length + ' entries · ' + Math.round(text().length / 1024) + ' KB'; };
    mk('Copy log', function () { persist(); var all = text();
      var done = function (how) { status.textContent = 'Copied (' + how + '): ' + all.length + ' characters, ' + buf.length + ' entries.'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(all).then(function () { done('clipboard'); }, function () { ta.focus(); ta.select(); try { document.execCommand('copy'); done('selection'); } catch (e) { status.textContent = 'Copy failed — use Share.'; } });
      else { ta.focus(); ta.select(); try { document.execCommand('copy'); done('selection'); } catch (e) { status.textContent = 'Copy failed — use Share.'; } } });
    if (navigator.share) mk('Share…', function () { persist(); navigator.share({ title: 'Find My Quiet Sound audio diagnostic', text: text() }).then(function () { status.textContent = 'Shared.'; }, function () { status.textContent = 'Share cancelled.'; }); });
    mk('Mark', function () { marks++; log('MARK ' + marks); refresh(); status.textContent = 'Marker ' + marks + ' added.'; });
    mk('Clear', function () { buf = []; dirty = true; persist(); log('diag:cleared', undefined, false); refresh(); });
    mk('Close', function () { panel.style.display = 'none'; });
    panel.appendChild(bar); panel.appendChild(ta); panel.appendChild(status);
    btn.addEventListener('click', function () { log('ui:diag-open', undefined, false); refresh(); panel.style.display = 'flex'; });
    document.body.appendChild(btn); document.body.appendChild(panel);
  }
  if (document.body) ui(); else addEventListener('DOMContentLoaded', ui);
})();
