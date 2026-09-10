/* TEMPORARY diagnostic panel — investigating the silent-restart-after-Stop audio bug.
   Active only behind ?diag=1 in the URL; otherwise this file does nothing.
   Read-only observation of engine state, plus one explicit "Force Resume" button that
   calls ctx.resume() synchronously so the fix candidate can be tested by hand.
   Remove this file and its <script> tag once the investigation is done. */
(function () {
  if (!/[?&]diag=1(&|$)/.test(location.search)) return;

  function fmt(n) { return (typeof n === 'number' && isFinite(n)) ? n.toFixed(4) : String(n); }
  function engine() { return window.softwave; }

  function analyserPeak(e) {
    if (!e.analyser) return null;
    const buf = new Float32Array(e.analyser.fftSize);
    e.analyser.getFloatTimeDomainData(buf);
    let max = 0; for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > max) max = a; }
    return max;
  }

  const panel = document.createElement('div');
  panel.id = 'diag-panel';
  panel.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;background:rgba(0,0,0,.88);color:#5f5;font:11px/1.45 ui-monospace,Menlo,Consolas,monospace;padding:10px 12px;border-radius:8px;max-width:280px;white-space:pre-wrap;box-shadow:0 2px 12px rgba(0,0,0,.4);';
  panel.innerHTML =
    '<div style="color:#fff;font-weight:bold;margin-bottom:6px;">AUDIO DIAG (?diag=1)</div>' +
    '<div id="diag-lines">loading…</div>' +
    '<button id="diag-resume" style="margin-top:8px;width:100%;padding:7px;font:11px ui-monospace,Menlo,Consolas,monospace;font-weight:bold;background:#c33;color:#fff;border:0;border-radius:5px;">FORCE RESUME (ctx.resume)</button>' +
    '<div id="diag-log" style="margin-top:6px;color:#ff5;"></div>';

  function mount() { if (document.body && !document.getElementById('diag-panel')) document.body.appendChild(panel); }
  mount();
  document.addEventListener('DOMContentLoaded', mount);

  function update() {
    const lines = document.getElementById('diag-lines');
    if (!lines) return;
    const e = engine();
    if (!e || !e.ctx) { lines.textContent = 'ctx.state: (no AudioContext yet)'; return; }
    const active = [...e.active.entries()];
    const rows = [
      'ctx.state: ' + e.ctx.state,
      'active sounds: ' + (active.length ? active.map(([id]) => id).join(', ') : '(none)'),
    ];
    active.forEach(([id, a]) => {
      const target = Math.pow(a.volume, 1.45) * a.trim;
      rows.push('  ' + id + ': node=yes gain=' + fmt(a.gain.gain.value) + ' target=' + fmt(target));
    });
    rows.push('master.gain: ' + fmt(e.master ? e.master.gain.value : NaN));
    rows.push('analyser peak: ' + fmt(analyserPeak(e)));
    lines.textContent = rows.join('\n');
  }

  setInterval(update, 300);
  document.addEventListener('DOMContentLoaded', update);

  document.addEventListener('click', function (ev) {
    if (!ev.target || ev.target.id !== 'diag-resume') return;
    const e = engine();
    const log = document.getElementById('diag-log');
    if (!e || !e.ctx) { if (log) log.textContent = 'no AudioContext yet'; return; }
    const before = e.ctx.state;
    try { e.ctx.resume(); } catch (err) { }
    if (log) log.textContent = 'Force Resume pressed — state before: ' + before + ' (state updates above within ~0.3s)';
    console.log('[diag] Force Resume pressed. ctx.state before:', before);
    update();
  }, true);
})();
