/* Master Sound Controller — the one reusable sound-control block used everywhere.
   Reference: the Sounds page player. Structure, top to bottom:
     control row   [Play/Pause] [speaker + VOLUME] [slider] [%] [Stop]
     action row    [＋ Add sound] [Timer] [Add Visual] [Mixer] [Save]   (configurable)
     status line   ✦ Tuned to you · on                                   (when personalized)
     bottom action [IMMERSE]                                             (when relevant)
   Every location renders through render() with a config that only switches
   functions on or off — never a different look. */
(function () {
  const SVG = {
    pause: '<svg class="vp-pause" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg><svg class="vp-play" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    stop: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M6 6h12v12H6z" fill="currentColor"/></svg>'
  };
  // The standard action vocabulary — label and position are fixed per key so the
  // same function always looks and sits the same wherever it appears.
  const ACTIONS = {
    add:    { label: '＋ Add sound' },
    timer:  { label: 'Timer', fa: 'timer', timerLabel: true },
    reset:  { label: 'Reset' },
    visual: { label: 'Add Visual', fa: 'visual' },
    mixer:  { label: 'Mixer', fa: 'mixer' },
    save:   { label: 'Save', fa: 'save' }
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /**
   * render(host, cfg)
   *   prefix   id prefix for the control row: `${prefix}-pause|-vol|-vol-out|-stop`
   *   pause    show the play/pause circle (default true)
   *   stop     show the stop circle (default true)
   *   volume   initial slider value 0–100 (default 35)
   *   actions  array of keys from ACTIONS, or {key,label,fa} objects (default none)
   *            every action renders as #<prefix>-<key> with data-act="<key>"
   *   hooks    also emit data-fa hooks for the app's global action bindings (default false)
   *            an action may carry spanId (label wrapped in <span id>) and data {name:value}
   *            (rendered as data-* attributes) so a section's own bindings keep working
   *   status   reserve the personalization status line (default false)
   *   immerse  show the IMMERSE bottom action (default false)
   *   max      slider maximum (default 100); bare: skip the .field-controls block styling
   * Returns the host. Callers bind behavior to the ids / data-fa hooks.
   */
  function render(host, cfg = {}) {
    if (!host) return null;
    const p = cfg.prefix || 'ctrl';
    const parts = [];
    parts.push('<div class="field-vol">');
    if (cfg.pause !== false) parts.push(`<button id="${p}-pause" class="vol-pause" aria-label="Pause playback">${SVG.pause}</button>`);
    parts.push(`<label for="${p}-vol" class="field-vol-label">${SVG.speaker}<span>Volume</span></label>`);
    parts.push(`<input id="${p}-vol" type="range" min="0" max="${cfg.max || 100}" value="${cfg.volume ?? 35}">`);
    parts.push(`<output id="${p}-vol-out">${cfg.volume ?? 35}%</output>`);
    if (cfg.stop !== false) parts.push(`<button id="${p}-stop" class="vol-stop" aria-label="Stop all sounds">${SVG.stop}</button>`);
    parts.push('</div>');
    const actions = (cfg.actions || []).map(a => typeof a === 'string' ? Object.assign({ key: a }, ACTIONS[a]) : a).filter(a => a && a.label);
    if (actions.length) {
      parts.push('<div class="field-actions">');
      for (const a of actions) {
        const id = ` id="${p}-${esc(a.key)}"`;
        const fa = cfg.hooks && a.fa ? ` data-fa="${esc(a.fa)}"` : '';
        const spanId = a.spanId || (a.timerLabel ? `${p}-timer-label` : null);
        const label = spanId ? `<span id="${esc(spanId)}">${esc(a.label)}</span>` : esc(a.label);
        const data = Object.entries(a.data || {}).map(([k, v]) => ` data-${esc(k)}="${esc(v)}"`).join('');
        parts.push(`<button type="button" class="fa"${id} data-act="${esc(a.key)}"${fa}${data}>${label}</button>`);
      }
      parts.push('</div>');
    }
    if (cfg.status) parts.push('<div class="field-status" data-slot="status"></div>');
    if (cfg.immerse) parts.push('<button class="fa fa-immerse" data-fa="immerse">Immerse</button>');
    host.innerHTML = parts.join('');
    host.classList.add('sound-controller'); if (!cfg.bare) host.classList.add('field-controls');
    return host;
  }

  window.SoundController = { render, ACTIONS };

  // The reference location: the Sounds page player, rendered before app.js binds to it.
  render(document.getElementById('field-controls'), {
    prefix: 'field', pause: true, stop: true, volume: 35,
    actions: ['add', 'timer', 'visual', 'mixer', 'save'],
    status: true, immerse: true, hooks: true
  });
  // The full sound view (Immerse): the same controller minus IMMERSE (you are in it).
  render(document.getElementById('now-controls'), {
    prefix: 'now', pause: true, stop: true, volume: 35,
    actions: ['add', 'timer', 'visual', 'mixer', 'save'],
    status: true, immerse: false
  });
  // Sleep screen: the session's own functions — Timer and Save; Exit stays its own button.
  render(document.getElementById('sleep-controls'), {
    prefix: 'sleep', pause: true, stop: true, volume: 35,
    actions: ['timer', 'save'], status: true
  });
  // Visual Focus: its specific controls are kept, in the standard language.
  // Stop sound is the row's stop circle; the rest are actions.
  render(document.getElementById('focus-controls'), {
    prefix: 'focus', pause: true, stop: true, volume: 35,
    actions: [
      { key: 'sound', label: 'Change sound', data: { 'open-pane': 'sound' } },
      { key: 'visual', label: 'Change visual', data: { 'open-pane': 'visual' } },
      { key: 'timer', label: 'Timer', timerLabel: true, data: { 'open-pane': 'timer' } },
      { key: 'motion', label: 'Movement: Medium', spanId: 'focus-motion-label', data: { 'open-pane': 'motion' } },
      { key: 'stopall', label: 'Stop everything' },
      { key: 'stopvisual', label: 'Stop visual' }
    ],
    status: true
  });
  // Mixer: master row above the per-sound channels; Reset is the Mixer's own action.
  render(document.getElementById('mix-controls'), {
    prefix: 'mix', pause: true, stop: true, volume: 35,
    actions: ['timer', 'reset', 'save'], status: true
  });
  // Frequency generator and Find My Tinnitus Sound: the volume row only — they keep
  // their own Play tone / Stop controls, and tones are never personalized.
  render(document.getElementById('freq-controls'), { prefix: 'freq', pause: false, stop: false, volume: 25, bare: true });
  render(document.getElementById('match-controls'), { prefix: 'match', pause: false, stop: false, volume: 15, max: 60, bare: true });
})();
