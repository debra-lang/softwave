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
    add:    { label: '＋ Add sound', id: 'add-sound-btn' },
    timer:  { label: 'Timer', fa: 'timer', labelId: 'field-timer-label' },
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
   *   actions  array of keys from ACTIONS, or {key,label,fa,id} objects (default none)
   *   status   reserve the personalization status line (default false)
   *   immerse  show the IMMERSE bottom action (default false)
   * Returns the host. Callers bind behavior to the ids / data-fa hooks.
   */
  function render(host, cfg = {}) {
    if (!host) return null;
    const p = cfg.prefix || 'ctrl';
    const parts = [];
    parts.push('<div class="field-vol">');
    if (cfg.pause !== false) parts.push(`<button id="${p}-pause" class="vol-pause" aria-label="Pause playback">${SVG.pause}</button>`);
    parts.push(`<label for="${p}-vol" class="field-vol-label">${SVG.speaker}<span>Volume</span></label>`);
    parts.push(`<input id="${p}-vol" type="range" min="0" max="100" value="${cfg.volume ?? 35}">`);
    parts.push(`<output id="${p}-vol-out">${cfg.volume ?? 35}%</output>`);
    if (cfg.stop !== false) parts.push(`<button id="${p}-stop" class="vol-stop" aria-label="Stop all sounds">${SVG.stop}</button>`);
    parts.push('</div>');
    const actions = (cfg.actions || []).map(a => typeof a === 'string' ? Object.assign({ key: a }, ACTIONS[a]) : a).filter(a => a && a.label);
    if (actions.length) {
      parts.push('<div class="field-actions">');
      for (const a of actions) {
        const id = a.id ? ` id="${esc(a.id)}"` : '';
        const fa = a.fa ? ` data-fa="${esc(a.fa)}"` : '';
        const label = a.labelId ? `<span id="${esc(a.labelId)}">${esc(a.label)}</span>` : esc(a.label);
        parts.push(`<button type="button" class="fa"${id}${fa}>${label}</button>`);
      }
      parts.push('</div>');
    }
    if (cfg.status) parts.push('<div class="field-status" data-slot="status"></div>');
    if (cfg.immerse) parts.push('<button class="fa fa-immerse" data-fa="immerse">Immerse</button>');
    host.innerHTML = parts.join('');
    host.classList.add('field-controls', 'sound-controller');
    return host;
  }

  window.SoundController = { render, ACTIONS };

  // The reference location: the Sounds page player, rendered before app.js binds to it.
  render(document.getElementById('field-controls'), {
    prefix: 'field', pause: true, stop: true, volume: 35,
    actions: ['add', 'timer', 'visual', 'mixer', 'save'],
    status: true, immerse: true
  });
})();
