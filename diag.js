/* TEMPORARY diagnostic panel — investigating the silent-sound-until-volume-touched bug.
   Active only behind ?diag=1 in the URL; otherwise this file does nothing.
   Read-only observation of engine state (plus one explicit "Force Resume" button that
   calls ctx.resume() synchronously) and a timestamped history log — including markers
   for every volume-slider touch — so a single on-device run captures the full
   before/after transition without needing hand-timed screenshots.
   Remove this file and its <script> tag once the investigation is done. */
(function () {
  if (!/[?&]diag=1(&|$)/.test(location.search)) return;

  function fmt(n) { return (typeof n === 'number' && isFinite(n)) ? n.toFixed(4) : String(n); }
  function engine() { return window.softwave; }
  const t0 = Date.now();
  function ts() { return ((Date.now() - t0) / 1000).toFixed(2) + 's'; }

  function analyserPeak(e) {
    if (!e.analyser) return null;
    const buf = new Float32Array(e.analyser.fftSize);
    e.analyser.getFloatTimeDomainData(buf);
    let max = 0; for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > max) max = a; }
    return max;
  }

  function snapshot() {
    const e = engine();
    if (!e || !e.ctx) return { text: 'ctx.state: (no AudioContext yet)', line: '(no AudioContext yet)' };
    const active = [...e.active.entries()];
    const soundBits = active.map(([id, a]) => {
      const target = Math.pow(a.volume, 1.45) * a.trim;
      return id + ' gain=' + fmt(a.gain.gain.value) + '/tgt=' + fmt(target);
    });
    const mg = fmt(e.master ? e.master.gain.value : NaN);
    const pk = fmt(analyserPeak(e));
    const text = [
      'ctx.state: ' + e.ctx.state,
      'active sounds: ' + (active.length ? active.map(([id]) => id).join(', ') : '(none)'),
      soundBits.map(s => '  ' + s).join('\n'),
      'master.gain: ' + mg,
      'analyser peak: ' + pk,
    ].filter(Boolean).join('\n');
    const line = 'ctx=' + e.ctx.state + (soundBits.length ? ' | ' + soundBits.join(', ') : ' | (none)') + ' | master=' + mg + ' | peak=' + pk;
    return { text, line };
  }

  const panel = document.createElement('div');
  panel.id = 'diag-panel';
  panel.style.cssText = 'position:fixed;left:8px;bottom:8px;right:8px;max-width:420px;z-index:99999;background:rgba(0,0,0,.9);color:#5f5;font:11px/1.45 ui-monospace,Menlo,Consolas,monospace;padding:10px 12px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.4);';
  panel.innerHTML =
    '<div style="color:#fff;font-weight:bold;margin-bottom:6px;">AUDIO DIAG (?diag=1)</div>' +
    '<div id="diag-lines" style="white-space:pre-wrap;">loading…</div>' +
    '<div style="display:flex;gap:6px;margin-top:8px;">' +
      '<button id="diag-resume" style="flex:2;padding:7px;font:11px ui-monospace,Menlo,Consolas,monospace;font-weight:bold;background:#c33;color:#fff;border:0;border-radius:5px;">FORCE RESUME</button>' +
      '<button id="diag-copy" style="flex:1;padding:7px;font:11px ui-monospace,Menlo,Consolas,monospace;background:#357;color:#fff;border:0;border-radius:5px;">Copy log</button>' +
      '<button id="diag-clear" style="flex:1;padding:7px;font:11px ui-monospace,Menlo,Consolas,monospace;background:#555;color:#fff;border:0;border-radius:5px;">Clear</button>' +
    '</div>' +
    '<div id="diag-copystatus" style="margin-top:4px;color:#ff5;min-height:14px;"></div>' +
    '<div id="diag-history" style="margin-top:6px;max-height:150px;overflow-y:auto;border-top:1px solid #333;padding-top:6px;white-space:pre-wrap;color:#8f8;"></div>';

  function mount() { if (document.body && !document.getElementById('diag-panel')) document.body.appendChild(panel); }
  mount();
  document.addEventListener('DOMContentLoaded', mount);

  const MAX_LOG = 300;
  const log = [];
  let lastLine = null;
  function pushLog(entry, force) {
    if (!force && entry === lastLine) return;   // collapse unchanged samples so the log stays readable
    lastLine = entry;
    log.push(ts() + '  ' + entry);
    if (log.length > MAX_LOG) log.shift();
    const hist = document.getElementById('diag-history');
    if (hist) { hist.textContent = log.join('\n'); hist.scrollTop = hist.scrollHeight; }
  }

  function update() {
    const lines = document.getElementById('diag-lines');
    const snap = snapshot();
    if (lines) lines.textContent = snap.text;
    pushLog(snap.line);
  }

  setInterval(update, 200);
  document.addEventListener('DOMContentLoaded', update);

  document.addEventListener('click', function (ev) {
    if (!ev.target) return;
    if (ev.target.id === 'diag-resume') {
      const e = engine();
      if (!e || !e.ctx) { pushLog('FORCE RESUME pressed — no AudioContext yet', true); return; }
      const before = e.ctx.state;
      try { e.ctx.resume(); } catch (err) { }
      pushLog('>>> FORCE RESUME pressed (ctx.resume(), synchronous). state before=' + before, true);
      update();
    } else if (ev.target.id === 'diag-clear') {
      log.length = 0; lastLine = null;
      const hist = document.getElementById('diag-history'); if (hist) hist.textContent = '';
      const st = document.getElementById('diag-copystatus'); if (st) st.textContent = '';
    } else if (ev.target.id === 'diag-copy') {
      const full = log.join('\n');
      const st = document.getElementById('diag-copystatus');
      const done = ok => { if (st) st.textContent = ok ? 'Copied ' + log.length + ' lines.' : 'Copy failed — select the log text manually.'; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(full).then(() => done(true), () => done(false));
      } else done(false);
    }
  }, true);

  // Mark every volume-slider touch directly in the log, without touching the app's own handlers.
  document.addEventListener('input', function (ev) {
    const el = ev.target;
    if (!el || el.tagName !== 'INPUT' || el.type !== 'range') return;
    const label = el.id || el.getAttribute('aria-label') || '(unlabeled slider)';
    pushLog('>>> SLIDER INPUT on "' + label + '" -> value=' + el.value, true);
    update();
  }, true);
  document.addEventListener('pointerdown', function (ev) {
    const el = ev.target;
    if (!el || el.tagName !== 'INPUT' || el.type !== 'range') return;
    const label = el.id || el.getAttribute('aria-label') || '(unlabeled slider)';
    pushLog('>>> pointerdown on slider "' + label + '"', true);
  }, true);
})();
