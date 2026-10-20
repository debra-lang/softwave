/* DIAGNOSTIC BUILD ONLY — guided device self-test (Build 80). Unlike diag.js, which only observes, this script DRIVES
   the app through a fixed listening script on the phone and asks the tester one Yes/No question per step: start Rain,
   add Pink Noise, Pause (then stray taps), Play, a short timer, the Sleep screen, one spoken request, Stop. Every step
   records what the engine and the routed output report (context state, element state, analyser RMS, master gain,
   native session lines) next to the tester's answer, and writes a PASS/FAIL table into the diagnostic log, which the
   Diag panel can share. It uses only public app controls (the same buttons a finger would tap) and the engine's own
   setTimer/stopAll; it never changes the engine. Nothing here ships in a release bundle (build-www.js injects it only
   with SOFTWAVE_DIAG=1). Privacy: no transcripts, no audio, no identifiers — the spoken request is judged by what
   started playing, never by what was heard. */
(function () {
  'use strict';
  var D = window.__swDiag;   // { log(tag, data), find(tag), snap() } exposed by diag.js in diagnostic bundles
  if (!D) return;
  var E = function () { return window.softwave; };
  var $ = function (s) { return document.querySelector(s); };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var rms = function () { try { var a = E().analyser; if (!a) return null; var n = a.fftSize, b = new Float32Array(n); a.getFloatTimeDomainData(b); var s = 0; for (var i = 0; i < n; i++) s += b[i] * b[i]; return Math.round(Math.sqrt(s / n) * 100000) / 100000; } catch (e) { return null; } };
  var state = function () { var e = E(); var c = e && e.ctx, m = e && e.mediaOut; return { ctx: c ? c.state : null, el: m ? (m.paused ? 'PAUSED' : 'playing') : 'none', rms: rms(), master: e && e.master ? Math.round(e.master.gain.value * 1000) / 1000 : null, active: e ? e.activeList().map(function (s) { return s.id; }) : [], paused: !!(e && e.userPaused), playing: !!(e && e.isPlaying), timer: !!(e && e.timer && e.timer.endsAt) }; };
  var click = function (sel) { var el = $(sel); if (!el) return false; el.click(); return true; };
  var closeNow = function () { var n = $('#now'); if (n && !n.hidden) { var c = $('#now-close'); if (c) c.click(); else n.hidden = true; } };
  var until = function (pred, ms, step) { return new Promise(function (r) { var t0 = Date.now(); (function poll() { var v = false; try { v = pred(); } catch (e) { } if (v) return r(true); if (Date.now() - t0 > ms) return r(false); setTimeout(poll, step || 200); })(); }); };
  var lastNative = function (type) { var o = D.find(function (x) { return x.tag === 'native:' + type; }); return o && o.d; };

  // ---- overlay: instructions and one Yes/No question per listening step
  var ov, msg, yes, no, okb, prog, answerer = null;
  function ui() {
    ov = document.createElement('div'); ov.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483002;background:rgba(8,10,20,.97);color:#e8ecff;font:15px/1.4 system-ui;padding:14px 16px calc(14px + env(safe-area-inset-bottom));box-sizing:border-box;border-top:1px solid #345;display:none;';
    prog = document.createElement('div'); prog.style.cssText = 'font:600 12px system-ui;color:#9fb0d8;margin-bottom:6px;';
    msg = document.createElement('div'); msg.style.cssText = 'margin-bottom:12px;white-space:pre-wrap;';
    var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px;';
    var mk = function (label, bg) { var b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.style.cssText = 'flex:1;font:600 16px system-ui;padding:12px;border-radius:10px;border:1px solid #556;background:' + bg + ';color:#fff;'; row.appendChild(b); return b; };
    yes = mk('Yes', '#1f6b3a'); no = mk('No', '#7a2a2a'); okb = mk('OK', '#1a2140');
    ov.appendChild(prog); ov.appendChild(msg); ov.appendChild(row); document.body.appendChild(ov);
    var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Check'; btn.setAttribute('aria-label', 'Run the guided device check');
    btn.style.cssText = 'position:fixed;right:0;top:calc(42% + 34px);z-index:2147483000;font:600 10px system-ui;padding:6px 5px;border-radius:8px 0 0 8px;border:1px solid rgba(255,255,255,.3);border-right:0;background:rgba(20,40,24,.75);color:#dfe6ff;opacity:.75;';
    btn.addEventListener('click', function () { if (running) return; run(); });
    document.body.appendChild(btn);
    var ib = document.createElement('button'); ib.type = 'button'; ib.textContent = 'Int.'; ib.setAttribute('aria-label', 'Record an interruption test');
    ib.style.cssText = btn.style.cssText.replace('42% + 34px', '42% + 62px');
    ib.addEventListener('click', function () { if (running) return; interruptionTest(); });
    document.body.appendChild(ib);
  }
  function show(text, buttons) { prog.textContent = progress; msg.textContent = text; yes.style.display = buttons === 'yn' ? '' : 'none'; no.style.display = buttons === 'yn' ? '' : 'none'; okb.style.display = buttons === 'ok' ? '' : 'none'; ov.style.display = 'block'; }
  function hide() { ov.style.display = 'none'; }
  function ask(text) {   // Yes/No from the tester (or from an automated answerer in a harness)
    if (answerer) return Promise.resolve(!!answerer(text));
    return new Promise(function (r) { show(text, 'yn'); var done = function (v) { return function () { yes.onclick = no.onclick = null; r(v); }; }; yes.onclick = done(true); no.onclick = done(false); });
  }
  function tell(text) { if (answerer) return Promise.resolve(); return new Promise(function (r) { show(text, 'ok'); okb.onclick = function () { okb.onclick = null; r(); }; }); }

  // ---- the script
  var running = false, progress = '', results = [];
  function record(step, measured, expected, answer, note) {
    var pass = expected && (answer === null || answer === true);
    results.push({ step: step, pass: !!pass, measured: measured, answer: answer, note: note || null });
    D.log('selftest:step', { step: step, pass: !!pass, measuredOk: !!expected, answer: answer, note: note || null, m: measured });
  }
  async function run(opts) {
    if (running) return; running = true; results = []; answerer = opts && opts.answer ? opts.answer : null;
    D.log('selftest:begin', { ua: navigator.userAgent.slice(0, 80) });
    try {
      var e = E(); if (!e) { D.log('selftest:abort', 'no engine'); running = false; return; }
      progress = 'Device check · preparing';
      await tell('This check takes about three minutes. Keep the phone unlocked and the volume at a comfortable level.\nTap OK to start.');
      location.hash = '#sounds'; await wait(900); closeNow(); e.stopAll(); await wait(1200);
      // 1. Rain
      progress = 'Step 1 of 8 · Rain'; show('Starting Rain…', 'none');
      click('#view-sounds .sound-card[data-id="rain"] .card-btn'); await wait(3000); closeNow();
      var s1 = state(); var ok1 = s1.active.join() === 'rain' && s1.ctx === 'running' && s1.el !== 'PAUSED' && s1.rms !== null && s1.rms > 0.002;
      record('rain-start', s1, ok1, await ask('Can you hear Rain?'));
      // 2. Pink added
      progress = 'Step 2 of 8 · add Pink Noise'; show('Adding Pink Noise…', 'none');
      click('#view-sounds .sound-card[data-id="pink"] .card-btn'); await wait(3000); closeNow();
      var s2 = state(); var ok2 = s2.active.slice().sort().join() === 'pink,rain' && s2.ctx === 'running' && s2.rms > 0.002;
      record('pink-add', s2, ok2, await ask('Can you hear both Rain and Pink Noise?'));
      // 3. Pause, then stray taps
      progress = 'Step 3 of 8 · Pause'; show('Pausing, then tapping around the app…', 'none');
      click('#player-toggle'); await wait(1500);
      var s3a = state();
      try { document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); document.body.dispatchEvent(new Event('touchend', { bubbles: true })); } catch (x) { }
      var navSleep = $('.nav a[href="#sleep"]'); if (navSleep) navSleep.click(); await wait(900); var navSounds = $('.nav a[href="#sounds"]'); if (navSounds) navSounds.click(); await wait(900);
      var s3 = state(); var ok3 = s3a.paused && s3a.master !== null && s3a.master < 0.001 && s3.paused && s3.master < 0.001 && s3.ctx !== 'running' && s3.el === 'PAUSED';
      record('pause-holds', { atPause: s3a, afterTaps: s3 }, ok3, await ask('Is it completely silent now?'));
      // 4. Play
      progress = 'Step 4 of 8 · Play'; show('Resuming…', 'none');
      click('#player-toggle'); await wait(2500);
      var s4 = state(); var ok4 = !s4.paused && s4.playing && s4.ctx === 'running' && s4.el !== 'PAUSED' && s4.rms > 0.002;
      record('play-resumes', s4, ok4, await ask('Is the sound back, at the same level as before?'));
      // 5. Short timer
      progress = 'Step 5 of 8 · timer'; show('A 9-second timer with fade is running. Listen for the fade and the stop…', 'none');
      e.setTimer(0.15, true); var ended = await until(function () { return state().active.length === 0 && !state().timer; }, 16000, 250); await wait(800);
      var s5 = state(); var ok5 = ended && s5.active.length === 0 && (s5.rms === null || s5.rms < 0.0008);
      record('timer-stops', s5, ok5, await ask('Did the sound fade out and stop by itself?'));
      // 6. Sleep screen in and out
      progress = 'Step 6 of 8 · Sleep screen'; show('Opening the Sleep screen…', 'none');
      location.hash = '#sleep'; await wait(1000); click('#sleep-enter'); await wait(1800);
      var open = !($('#sleep-screen') || { hidden: true }).hidden; click('#sleep-exit'); await wait(1000); var closed = ($('#sleep-screen') || { hidden: true }).hidden;
      record('sleep-screen', { opened: open, closed: closed }, open && closed, null);
      location.hash = '#sounds'; await wait(900);
      // 7. One spoken request (judged by what started playing; the words are never read)
      progress = 'Step 7 of 8 · spoken request';
      await tell('Next: a spoken request. After you tap OK, the microphone opens. Wait for the button to pulse (and the tap), then say: "play ocean".');
      var mic = $('#ask-mic'); var s7 = null, ok7 = false, note7 = null;
      if (!mic) { note7 = 'no microphone button'; }
      else {
        show('Wait for the pulse, then say: play ocean', 'none');
        mic.click();
        var started = await until(function () { return mic.classList.contains('listening'); }, 8000, 100);
        var finished = await until(function () { return mic.getAttribute('aria-pressed') === 'false'; }, 25000, 200);
        await wait(1500); s7 = state();
        var sp = lastNative('speechNative');
        var stopped = D.find(function (x) { return x.tag === 'native:speechNative' && x.d && x.d.status === 'stopped'; });
        var snapN = lastNative('snapshot');
        s7.started = started; s7.finished = finished; s7.restored = !!(stopped && stopped.d.restored); s7.inputs = stopped && stopped.d.inputs; s7.outLatencyMs = snapN && typeof snapN.outLatency === 'number' ? Math.round(snapN.outLatency * 10000) / 10 : null;
        ok7 = started && finished && s7.active.indexOf('ocean') >= 0 && s7.restored && (!s7.inputs || s7.inputs.length === 0);
        if (!started) note7 = 'capture never reported started'; else if (!finished) note7 = 'session did not end within 25 s'; else if (s7.active.indexOf('ocean') < 0) note7 = 'Ocean did not start (see the Heard line on screen)';
      }
      record('spoken-request', s7, ok7, mic ? await ask('Did Ocean start playing?') : null, note7);
      // 8. Stop
      progress = 'Step 8 of 8 · Stop'; show('Stopping everything…', 'none');
      click('#player-stop'); var released = await until(function () { var s = state(); return s.active.length === 0 && s.el === 'PAUSED'; }, 6000, 200); await wait(500);
      var s8 = state(); var ok8 = s8.active.length === 0 && (s8.rms === null || s8.rms < 0.0008) && released;
      record('stop-releases', s8, ok8, await ask('Is everything silent now?'));
    } catch (err) { D.log('selftest:error', String(err && err.message || err)); }
    var passed = results.filter(function (r) { return r.pass; }).length;
    var table = results.map(function (r) { return (r.pass ? 'PASS ' : 'FAIL ') + r.step + (r.answer === null ? '' : (r.answer ? ' (heard: yes)' : ' (heard: NO)')) + (r.note ? ' — ' + r.note : ''); }).join('\n');
    D.log('selftest:summary', { passed: passed, total: results.length, steps: results.map(function (r) { return { step: r.step, pass: r.pass, answer: r.answer, note: r.note }; }) });
    if (D.persist) D.persist();
    window.__swSelfTestResult = { passed: passed, total: results.length, results: results };
    running = false; answerer = null;
    if (!(opts && opts.answer)) { progress = 'Device check · done'; await tell('Result: ' + passed + ' of ' + results.length + ' steps passed.\n\n' + table + '\n\nOpen the Diag panel and tap Share to send the log.'); hide(); }
    return window.__swSelfTestResult;
  }
  // ---- interruption test: a snapshot before, the tester makes a call / sets an alarm, a snapshot after, one question
  async function interruptionTest() {
    running = true;
    try {
      progress = 'Interruption test';
      await tell('Start a sound first if nothing is playing. Then tap OK, lock the phone or leave it unlocked, and let a phone call or an alarm interrupt the sound. When the call or alarm has ended, come back and tap OK again.');
      D.log('selftest:interruption-before', state());
      await tell('Now press Play ONCE (on the player bar or the lock screen). Then tap OK.');
      await wait(1500); var after = state(); D.log('selftest:interruption-after', after);
      var ans = await ask('Did that single press bring the sound back?');
      var okI = after.playing && after.ctx === 'running' && !after.paused;
      D.log('selftest:interruption', { pass: okI && ans, measured: after, answer: ans });
      if (D.persist) D.persist();
      await tell('Recorded: ' + ((okI && ans) ? 'PASS' : 'FAIL') + '. Open the Diag panel and tap Share to send the log.'); hide();
    } catch (err) { D.log('selftest:error', String(err && err.message || err)); }
    running = false;
  }
  window.__swSelfTest = { run: run, interruptionTest: interruptionTest };
  if (document.body) ui(); else addEventListener('DOMContentLoaded', ui);
})();
