/* DIAGNOSTIC BUILD ONLY (TestFlight Build 67, branch ios-66-diag). Observation only: records, with timestamps, what the
   audio engine reports against what actually reaches the routed output, plus the UI steps of the Sleep timer flow,
   keyboard/focus/viewport events, user-gesture recovery and the native audio-session lines the app delegate forwards.
   It never calls play, pause, resume, suspend, setTimer or any gain; every engine wrapper is a synchronous pass-through.
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
  var WRAP = ['pauseAll', 'playAll', 'resume', '_keepAlive', 'setTimer', 'clearTimer', '_scheduleTimerFade', '_timerFinish', '_timerFinalize', 'setMasterVolume', 'holdOutput', 'startSound', 'stopSound', 'stopAll', 'loadMix'];
  function argStr(a) { return [].slice.call(a).map(function (x) { return (x && typeof x === 'object') ? (Array.isArray(x) ? '[' + x.length + ']' : '{}') : x; }); }
  function hookEngine() {
    if (hooked || !window.softwave) return; E = window.softwave; hooked = true;
    WRAP.forEach(function (n) { var o = E[n]; if (typeof o !== 'function') return;
      E[n] = function () { log('call:' + n, argStr(arguments)); return o.apply(this, arguments); }; });
    if (typeof E.on === 'function') { var lastTimerLog = 0; E.on(function (type, data) {
      if (type === 'timer') { var now = Date.now(); if (now - lastTimerLog < 10000) return; lastTimerLog = now; log('ev:timer', { left: data && data.endsAt ? Math.round((data.endsAt - Date.now()) / 1000) : null, fading: !!(data && data.fading) }); return; }
      if (type === 'master') return;
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
    return null;
  }
  document.addEventListener('click', function (e) { var l = e.target && uiLabel(e.target); if (l) log('ui:' + l, { trusted: e.isTrusted }); }, true);
  document.addEventListener('submit', function (e) { if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-custom-timer')) log('ui:custom-submit', { trusted: e.isTrusted }); }, true);
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
  var lostRun = 0, okRun = 0, lost = false, lastBeat = 0, sampleN = 0;
  setInterval(function () {
    if (!E || !E.ctx) return; var s = snap(); sampleN++;
    var expectsSound = s.act > 0 && !s.up && s.master !== null && s.master > 0.01;
    var noOutput = s.ctx !== 'running' || s.el === 'PAUSED' || (s.rms !== null && s.rms < 0.0015);
    if (expectsSound && noOutput) { lostRun++; okRun = 0; } else { okRun++; lostRun = 0; }
    if (!lost && lostRun >= 3) { lost = true; log('AUTO:output-lost', { why: [s.ctx !== 'running' ? 'context ' + s.ctx : null, s.el === 'PAUSED' ? 'element paused' : null, (s.rms !== null && s.rms < 0.0015) ? 'silent signal' : null].filter(Boolean) }); }
    else if (lost && okRun >= 2) { lost = false; log('AUTO:output-restored'); }
    if (lost && Date.now() - lastBeat > 2000) { lastBeat = Date.now(); log('AUTO:still-lost'); }
    if (sampleN % 40 === 0) log('sample'); // a plain snapshot every 10 s while nothing is wrong
  }, 250);

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
