/* Softwave — Audio engine
   All sounds are synthesised in real time with the Web Audio API, so there are
   no files to download and no loop points to click. Noise beds use long
   looping buffers with cross-faded ends; textures (rain drops, waves, crackle,
   crickets, birds) are layered on top with LFOs and scheduled micro-events.
*/
(function (global) {
  'use strict';

  const SOUND_DEFS = [
    { id: 'white',     name: 'White Noise',    group: 'Broadband', desc: 'Bright, even hiss across all frequencies.',          icon: '▦', hue: 210 },
    { id: 'pink',      name: 'Pink Noise',     group: 'Broadband', desc: 'Balanced and natural — like steady rainfall.',       icon: '◍', hue: 330 },
    { id: 'brown',     name: 'Brown Noise',    group: 'Broadband', desc: 'Deep, soft rumble. Many find it easiest to sleep to.', icon: '◉', hue: 25 },
    { id: 'static',    name: 'Gentle Static',  group: 'Broadband', desc: 'Soft, slightly textured static.',                    icon: '⁘', hue: 190 },
    { id: 'hiss',      name: 'Soft Hiss',      group: 'Broadband', desc: 'Airy, high and very smooth.',                        icon: '≋', hue: 170 },
    { id: 'rain',      name: 'Rain',           group: 'Nature',    desc: 'Steady rain with soft droplets.',                    icon: '☂', hue: 215 },
    { id: 'ocean',     name: 'Ocean Waves',    group: 'Nature',    desc: 'Slow, rolling waves on a quiet shore.',              icon: '〰', hue: 200 },
    { id: 'stream',    name: 'Flowing Water',  group: 'Nature',    desc: 'A gentle stream moving over stones.',                icon: '≈', hue: 185 },
    { id: 'waterfall', name: 'Waterfall',      group: 'Nature',    desc: 'Full, constant rush of falling water.',             icon: '⫶', hue: 195 },
    { id: 'forest',    name: 'Forest',         group: 'Nature',    desc: 'Soft breeze in leaves with distant birds.',          icon: '❧', hue: 130 },
    { id: 'wind',      name: 'Wind',           group: 'Nature',    desc: 'Slow gusts moving across open land.',                icon: '༄', hue: 230 },
    { id: 'fan',       name: 'Fan',            group: 'Indoor',    desc: 'A familiar, steady room fan.',                       icon: '✣', hue: 250 },
    { id: 'fire',      name: 'Fireplace',      group: 'Indoor',    desc: 'Low, warm glow with gentle crackles.',               icon: '♨', hue: 20 },
    { id: 'night',     name: 'Night Sounds',   group: 'Nature',    desc: 'Crickets and a light night breeze.',                 icon: '☾', hue: 265 },
    // Lab-only sources (not shown in the main library)
    { id: 'thunder',   name: 'Distant Thunder', group: 'Lab', lab: true, desc: 'Occasional far-off rumbles.',                      icon: '⛈', hue: 240 },
    { id: 'city',      name: 'Distant City',    group: 'Lab', lab: true, desc: 'A faraway urban hum.',                            icon: '⌂', hue: 280 },
    { id: 'cabin',     name: 'Cabin Hum',       group: 'Lab', lab: true, desc: 'Steady low aircraft-cabin ambience.',             icon: '✈', hue: 220 },
    { id: 'chimes',    name: 'Gentle Chimes',   group: 'Lab', lab: true, desc: 'Soft, never-repeating tones.',                    icon: '♪', hue: 45 },
    { id: 'paint',     name: 'Painted Noise',   group: 'Lab', lab: true, desc: 'Noise shaped by your drawing.',                   icon: '✎', hue: 300 },
    { id: 'sculpt',    name: 'Sculpted Noise',  group: 'Lab', lab: true, desc: 'Noise shaped by plain-language controls.',        icon: '◈', hue: 160 },
    { id: 'notched',   name: 'Notched Noise',   group: 'Lab', lab: true, desc: 'Broadband noise with a gap around one region.',   icon: '⊘', hue: 10 },
  ];

  const MAX_ACTIVE = 5;
  const FADE_IN = 1.2;    // seconds
  const FADE_OUT = 0.8;   // seconds

  // Per-sound loudness trim so the mixer feels balanced at equal slider values.
  const TRIM = {
    white: 0.16, pink: 0.32, brown: 0.9, static: 0.22, hiss: 0.26,
    rain: 0.45, ocean: 0.85, stream: 0.4, waterfall: 0.38, forest: 0.6,
    wind: 0.8, fan: 0.5, fire: 0.9, night: 0.7,
    thunder: 1.0, city: 0.9, cabin: 0.8, chimes: 0.5, paint: 0.3, sculpt: 0.32, notched: 0.32,
  };

  // ---------- buffer generators (run in a Web Worker so the UI never stalls) ----------
  // Seamless loops: generate `n` extra "pre-roll" samples before the loop start, then equal-power
  // crossfade the loop's tail into that pre-roll, so the last sample flows into the first with
  // continuous filter state — no click, no gap, even for brown noise.
  const GEN_SRC = `
    function makeLoop(sr, seconds, n, gen) {
      const len = Math.floor(sr * seconds); const out = [];
      for (let c = 0; c < 2; c++) {
        const x = new Float32Array(len + n); gen(x); const y = new Float32Array(len);
        for (let i = 0; i < len - n; i++) y[i] = x[n + i];
        for (let i = 0; i < n; i++) { const t = i / n, a = Math.cos(t * Math.PI / 2), b = Math.sin(t * Math.PI / 2); y[len - n + i] = x[len + i] * a + x[i] * b; }
        out.push(y);
      }
      return out;
    }
    function white(x) { for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1; }
    function pink(x) { let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0; for (let i = 0; i < x.length; i++) { const w = Math.random()*2-1; b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759; b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856; b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980; x[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6=w*0.115926; } }
    function brown(x) { let last = 0; for (let i = 0; i < x.length; i++) { const w = Math.random()*2-1; last = (last + 0.02*w)/1.02; x[i] = last*3.5; } let m = 0; for (let i = 0; i < x.length; i++) m += x[i]; m /= x.length; for (let i = 0; i < x.length; i++) x[i] -= m; }
    self.onmessage = e => { const sr = e.data.sr; const res = { white: makeLoop(sr, 6, 2048, white), pink: makeLoop(sr, 8, 16384, pink), brown: makeLoop(sr, 10, 65536, brown) };
      const transfer = []; Object.values(res).forEach(ch => ch.forEach(b => transfer.push(b.buffer))); self.postMessage(res, transfer); };
  `;
  function generateBuffers(ctx) {
    const toBuffer = (chs) => { const b = ctx.createBuffer(2, chs[0].length, ctx.sampleRate); b.copyToChannel(chs[0], 0); b.copyToChannel(chs[1], 1); return b; };
    return new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(new Blob([GEN_SRC], { type: 'application/javascript' }));
        const wk = new Worker(url);
        wk.onmessage = e => { const r = e.data; resolve({ white: toBuffer(r.white), pink: toBuffer(r.pink), brown: toBuffer(r.brown) }); wk.terminate(); URL.revokeObjectURL(url); };
        wk.onerror = () => { wk.terminate(); resolve(generateInline(ctx)); };
        wk.postMessage({ sr: ctx.sampleRate });
      } catch (_) { resolve(generateInline(ctx)); }
    });
  }
  function generateInline(ctx) {
    // Fallback (no Worker support): same code on the main thread.
    const self = {}; new Function('self', GEN_SRC)(self);
    const toBuffer = (chs) => { const b = ctx.createBuffer(2, chs[0].length, ctx.sampleRate); b.copyToChannel(chs[0], 0); b.copyToChannel(chs[1], 1); return b; };
    let out = null; self.postMessage = r => { out = { white: toBuffer(r.white), pink: toBuffer(r.pink), brown: toBuffer(r.brown) }; }; self.onmessage({ data: { sr: ctx.sampleRate } });
    return out;
  }

  // ---------- engine ----------
  class Engine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.analyser = null;
      this.active = new Map();      // id -> { gain, pan, nodes[], timers[], volume, balance }
      this.masterVolume = 0.35;
      this.tone = null;             // frequency generator
      this.matcher = null;          // tinnitus matcher
      this.buffers = {};
      this.listeners = new Set();
      this.silentEl = null;
      this._timerId = null;
      this.timer = { endsAt: null, fade: true, durationMin: null };
      this.lab = { paint: null, sculpt: { warm: 0, soft: 0, smooth: 0, deep: 0, moving: 0 }, notch: { freq: 4000, width: 1 } };
      this.variation = { amount: 0, rate: 1, timer: null };
    }

    on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    emit(type, data) { this.listeners.forEach(fn => fn(type, data)); }

    get ready() { return !!this.ctx; }
    get isPlaying() { return this.ctx && this.ctx.state === 'running' && (this.active.size > 0 || (this.tone && this.tone.playing) || (this.matcher && this.matcher.playing)); }

    async init() {
      if (this.ctx) { await this.resume(); await this._ready; return; }
      if (this._initPromise) { await this._initPromise; await this.resume(); return; }
      this._initPromise = this._init(); await this._initPromise;
    }
    // Warm up early (e.g. on the first touch) so the first sound starts instantly.
    prepare() { if (!this.ctx && !this._initPromise) { this._initPromise = this._init(); } }
    async _init() {
      const AC = global.AudioContext || global.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'playback' });
      const ctx = this.ctx;

      this.master = ctx.createGain();
      this.master.gain.value = 0;          // ramps up on first play — never loud on start
      // Gentle limiter so layered sounds can never spike.
      this.limiter = ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -10;
      this.limiter.knee.value = 12;
      this.limiter.ratio.value = 8;
      this.limiter.attack.value = 0.005;
      this.limiter.release.value = 0.25;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.85;

      this.trim = ctx.createGain(); this.trim.gain.value = 1;           // experiments modulate this (breath sync etc.)
      this.masterFilter = ctx.createBiquadFilter(); this.masterFilter.type = 'lowpass'; this.masterFilter.frequency.value = 20000; this.masterFilter.Q.value = 0.5;
      this.masterPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      this.master.connect(this.trim); this.trim.connect(this.masterFilter);
      if (this.masterPan) { this.masterFilter.connect(this.masterPan); this.masterPan.connect(this.limiter); } else this.masterFilter.connect(this.limiter);
      this.limiter.connect(this.analyser);
      this.analyser.connect(ctx.destination);

      this._ready = generateBuffers(ctx).then(b => { Object.assign(this.buffers, b); });

      ctx.onstatechange = () => {
        this.emit('state', ctx.state);
      };
      this._setupBackground();
      await this.resume();
      this.setMasterVolume(this.masterVolume, true);
      await this._ready;
    }

    async resume() {
      if (!this.ctx) return;
      if (this.ctx.state !== 'running') {
        try { await this.ctx.resume(); } catch (e) { /* needs gesture */ }
      }
    }

    _setupBackground() {
      // iOS/Safari keep Web Audio alive in the background only while an HTML
      // media element is playing. A silent looping clip + Media Session does it.
      try {
        const el = document.createElement('audio');
        el.loop = true; el.volume = 0.01; el.setAttribute('playsinline', '');
        el.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
        this.silentEl = el;
      } catch (e) { }
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({ title: 'Softwave', artist: 'Sound for tinnitus comfort', album: 'Softwave' });
          navigator.mediaSession.setActionHandler('play', () => this.playAll());
          navigator.mediaSession.setActionHandler('pause', () => this.pauseAll());
          navigator.mediaSession.setActionHandler('stop', () => this.stopAll());
        } catch (e) { }
      }
    }
    _keepAlive(on) {
      if (!this.silentEl) return;
      if (on) { this.silentEl.play().catch(() => { }); }
      else { this.silentEl.pause(); }
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = on ? 'playing' : 'paused';
    }

    // ---------- master ----------
    setMasterVolume(v, immediate) {
      this.masterVolume = Math.max(0, Math.min(1, v));
      if (!this.ctx) return;
      const target = this._curve(this.masterVolume);
      const g = this.master.gain; const t = this.ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(target, t + (immediate ? 0.05 : 0.12));
      this.emit('master', this.masterVolume);
    }
    _curve(v) { return v * v; } // perceptual-ish taper; 100% slider = unity gain (pre-limiter)

    // ---------- sounds ----------
    defs(includeLab) { return includeLab ? SOUND_DEFS : SOUND_DEFS.filter(d => !d.lab); }
    def(id) { return SOUND_DEFS.find(d => d.id === id); }
    isActive(id) { return this.active.has(id); }
    activeList() { return [...this.active.entries()].map(([id, a]) => ({ id, volume: a.volume, balance: a.balance, name: this.def(id).name })); }

    async toggleSound(id, volume) {
      if (this.active.has(id)) this.stopSound(id);
      else await this.startSound(id, volume);
    }

    async startSound(id, volume = 0.6, balance = 0) {
      await this.init();
      if (this.active.has(id)) { this.setVolume(id, volume); return true; }
      if (this.active.size >= MAX_ACTIVE) { this.emit('limit', MAX_ACTIVE); return false; }
      const ctx = this.ctx;
      const gain = ctx.createGain(); gain.gain.value = 0;
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 20000; filt.Q.value = 0.4;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      gain.connect(filt);
      if (pan) { pan.pan.value = balance; filt.connect(pan); pan.connect(this.master); }
      else filt.connect(this.master);
      const entry = { gain, filt, pan, nodes: [], timers: [], volume, balance, trim: TRIM[id] || 0.5, cutoff: 20000 };
      this.active.set(id, entry);
      this._build(id, entry, gain);
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(this._curve(volume) * entry.trim, t + FADE_IN);
      this._keepAlive(true);
      this.emit('sounds', this.activeList());
      return true;
    }

    stopSound(id) {
      const e = this.active.get(id); if (!e) return;
      const t = this.ctx.currentTime;
      e.gain.gain.cancelScheduledValues(t);
      e.gain.gain.setValueAtTime(e.gain.gain.value, t);
      e.gain.gain.linearRampToValueAtTime(0, t + FADE_OUT);
      e.timers.forEach(clearTimeout);
      const nodes = e.nodes;
      setTimeout(() => { nodes.forEach(n => { try { n.stop && n.stop(); } catch (_) { } try { n.disconnect(); } catch (_) { } }); try { e.gain.disconnect(); } catch (_) { } }, FADE_OUT * 1000 + 60);
      this.active.delete(id);
      if (!this.isPlaying) this._keepAlive(false);
      this.emit('sounds', this.activeList());
    }

    setVolume(id, v) {
      const e = this.active.get(id); if (!e) return;
      e.volume = v;
      const t = this.ctx.currentTime;
      e.gain.gain.cancelScheduledValues(t);
      e.gain.gain.setValueAtTime(e.gain.gain.value, t);
      e.gain.gain.linearRampToValueAtTime(this._curve(v) * e.trim, t + 0.1);
    }
    setBalance(id, b) {
      const e = this.active.get(id); if (!e) return;
      e.balance = b;
      if (e.pan) e.pan.pan.setTargetAtTime(b, this.ctx.currentTime, 0.05);
    }
    // Long, linear volume ramp (journeys / timelines). seconds may be minutes long.
    rampVolume(id, v, seconds = 1) {
      const e = this.active.get(id); if (!e) return;
      e.volume = v; const t = this.ctx.currentTime; const g = e.gain.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(this._curve(v) * e.trim, t + Math.max(0.05, seconds));
    }
    setCutoff(id, hz, tc = 0.2) { const e = this.active.get(id); if (!e) return; e.cutoff = hz; e.filt.frequency.setTargetAtTime(Math.max(120, Math.min(20000, hz)), this.ctx.currentTime, tc); }
    setMasterTone(hz, tc = 0.3) { if (this.masterFilter) this.masterFilter.frequency.setTargetAtTime(Math.max(300, Math.min(20000, hz)), this.ctx.currentTime, tc); }
    setMasterPan(p, tc = 0.3) { if (this.masterPan) this.masterPan.pan.setTargetAtTime(Math.max(-1, Math.min(1, p)), this.ctx.currentTime, tc); }
    setMasterTrim(m, tc = 0.5) { if (this.trim) this.trim.gain.setTargetAtTime(Math.max(0, Math.min(1, m)), this.ctx.currentTime, tc); }
    resetMasterShape() { this.setMasterTone(20000, 0.3); this.setMasterPan(0, 0.3); this.setMasterTrim(1, 0.3); }

    // Micro-variation: tiny slow random walks on level, brightness and width of every active sound.
    // amount 0..1 (0 = stable), rate = how often targets change (seconds).
    setVariation(amount, rate = 6) {
      this.variation.amount = amount; this.variation.rate = rate;
      if (this.variation.timer) { clearInterval(this.variation.timer); this.variation.timer = null; }
      if (!amount) { this.active.forEach((e, id) => { this.setVolume(id, e.volume); this.setBalance(id, e.balance); this.setCutoff(id, e.cutoff, 0.5); }); return; }
      const tick = () => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime; const tc = Math.max(1, rate * 0.6);
        this.active.forEach((e) => {
          const a = this.variation.amount;
          const gTarget = this._curve(e.volume) * e.trim * (1 + (Math.random() * 2 - 1) * 0.22 * a);
          e.gain.gain.cancelScheduledValues(t); e.gain.gain.setTargetAtTime(Math.max(0, gTarget), t, tc);
          if (e.pan) e.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, e.balance + (Math.random() * 2 - 1) * 0.35 * a)), t, tc);
          const base = Math.min(e.cutoff, 20000); const f = base * Math.pow(2, (Math.random() * 2 - 1) * 1.2 * a);
          e.filt.frequency.setTargetAtTime(Math.max(400, Math.min(20000, f)), t, tc);
        });
      };
      tick(); this.variation.timer = setInterval(tick, rate * 1000);
    }

    stopAll() {
      if (this.variation.timer) this.setVariation(0);
      if (this.ctx) this.resetMasterShape();
      [...this.active.keys()].forEach(id => this.stopSound(id));
      if (this.tone) this.toneStop();
      if (this.matcher) this.matcherStop();
      this.clearTimer();
    }
    async pauseAll() {
      if (!this.ctx) return;
      // Fade master to zero then suspend for a clean pause.
      const g = this.master.gain; const t = this.ctx.currentTime;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.4);
      await new Promise(r => setTimeout(r, 420));
      await this.ctx.suspend();
      this._keepAlive(false);
      this.emit('state', 'suspended');
    }
    async playAll() {
      if (!this.ctx) return;
      await this.resume();
      this.setMasterVolume(this.masterVolume);
      if (this.isPlaying) this._keepAlive(true);
      this.emit('state', 'running');
    }

    // Replace whole mix (presets)
    async loadMix(mix) {
      await this.init();
      const keep = new Set(mix.map(m => m.id));
      [...this.active.keys()].forEach(id => { if (!keep.has(id)) this.stopSound(id); });
      for (const m of mix) {
        if (this.active.has(m.id)) { this.setVolume(m.id, m.volume); this.setBalance(m.id, m.balance || 0); }
        else await this.startSound(m.id, m.volume, m.balance || 0);
      }
      await this.playAll();
    }

    // ---------- sound builders ----------
    _src(buffer, rate = 1) {
      const s = this.ctx.createBufferSource();
      s.buffer = buffer; s.loop = true; s.playbackRate.value = rate;
      s.start();
      return s;
    }
    _filter(type, freq, q = 1) {
      const f = this.ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q; return f;
    }
    _lfo(freq, depth, target, offset) {
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
      const g = this.ctx.createGain(); g.gain.value = depth;
      o.connect(g); g.connect(target);
      if (offset !== undefined) target.value = offset;
      o.start();
      return [o, g];
    }
    _chain(entry, nodes, out) {
      for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
      nodes[nodes.length - 1].connect(out);
      entry.nodes.push(...nodes);
    }

    _build(id, e, out) {
      const ctx = this.ctx, B = this.buffers;
      const d = this.def(id); if (d && d.lab) return this._buildLab(id, e, out);
      switch (id) {
        case 'white': this._chain(e, [this._src(B.white)], out); break;
        case 'pink': this._chain(e, [this._src(B.pink)], out); break;
        case 'brown': this._chain(e, [this._src(B.brown)], out); break;
        case 'static': {
          const s = this._src(B.white); const bp = this._filter('bandpass', 2500, 0.5); const lp = this._filter('lowpass', 6000, 0.7);
          const g = ctx.createGain(); g.gain.value = 0.9;
          e.nodes.push(...this._lfo(0.7, 0.08, g.gain, 0.9));
          this._chain(e, [s, bp, lp, g], out); break;
        }
        case 'hiss': {
          const s = this._src(B.pink); const hp = this._filter('highpass', 3000, 0.5); const sh = this._filter('highshelf', 8000); sh.gain.value = -6;
          this._chain(e, [s, hp, sh], out); break;
        }
        case 'rain': {
          // bed: pink noise high-passed with slow variation
          const s = this._src(B.pink); const hp = this._filter('highpass', 900, 0.6); const lp = this._filter('lowpass', 9000, 0.5);
          const g = ctx.createGain(); g.gain.value = 0.8;
          e.nodes.push(...this._lfo(0.13, 0.12, g.gain, 0.8));
          this._chain(e, [s, hp, lp, g], out);
          // droplets: short filtered bursts
          const dropGain = ctx.createGain(); dropGain.gain.value = 0.5; dropGain.connect(out); e.nodes.push(dropGain);
          const tick = () => {
            if (!this.active.has(id)) return;
            const n = this.ctx.createBufferSource(); n.buffer = B.white;
            const f = this._filter('bandpass', 1500 + Math.random() * 5000, 6);
            const gg = ctx.createGain(); const t = ctx.currentTime;
            gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(0.15 + Math.random() * 0.25, t + 0.004); gg.gain.exponentialRampToValueAtTime(0.001, t + 0.05 + Math.random() * 0.08);
            n.connect(f); f.connect(gg); gg.connect(dropGain);
            n.start(t, Math.random() * 5, 0.2); n.onended = () => { try { f.disconnect(); gg.disconnect(); } catch (_) { } };
            e.timers.push(setTimeout(tick, 40 + Math.random() * 160));
          };
          tick(); break;
        }
        case 'ocean': {
          const s = this._src(B.brown); const lp = this._filter('lowpass', 900, 0.8);
          const g = ctx.createGain(); g.gain.value = 0.55;
          e.nodes.push(...this._lfo(0.09, 0.35, g.gain, 0.55));      // slow swell
          e.nodes.push(...this._lfo(0.06, 400, lp.frequency, 900));  // brightness moves with swell
          this._chain(e, [s, lp, g], out);
          // foam/wash layer
          const s2 = this._src(B.pink); const hp = this._filter('highpass', 1200, 0.5);
          const g2 = ctx.createGain(); g2.gain.value = 0.12;
          e.nodes.push(...this._lfo(0.09, 0.11, g2.gain, 0.12));
          this._chain(e, [s2, hp, g2], out); break;
        }
        case 'stream': {
          const s = this._src(B.pink, 1.1); const bp = this._filter('bandpass', 1800, 0.7); const hp = this._filter('highpass', 500);
          const g = ctx.createGain(); g.gain.value = 1;
          e.nodes.push(...this._lfo(0.5, 0.15, g.gain, 1));
          e.nodes.push(...this._lfo(0.31, 500, bp.frequency, 1800));
          this._chain(e, [s, hp, bp, g], out);
          // bubbling layer
          const s2 = this._src(B.white, 0.9); const bp2 = this._filter('bandpass', 4000, 3); const g2 = ctx.createGain(); g2.gain.value = 0.25;
          e.nodes.push(...this._lfo(1.7, 0.15, g2.gain, 0.25));
          e.nodes.push(...this._lfo(0.9, 1500, bp2.frequency, 4000));
          this._chain(e, [s2, bp2, g2], out); break;
        }
        case 'waterfall': {
          const s = this._src(B.pink); const lp = this._filter('lowpass', 5000, 0.4); const hp = this._filter('highpass', 150);
          const g = ctx.createGain(); g.gain.value = 1;
          e.nodes.push(...this._lfo(0.21, 0.06, g.gain, 1));
          this._chain(e, [s, hp, lp, g], out);
          const s2 = this._src(B.brown); const lp2 = this._filter('lowpass', 250); const g2 = ctx.createGain(); g2.gain.value = 0.35;
          this._chain(e, [s2, lp2, g2], out); break;
        }
        case 'wind': {
          const s = this._src(B.pink); const bp = this._filter('bandpass', 500, 0.9); const lp = this._filter('lowpass', 2200, 0.5);
          const g = ctx.createGain(); g.gain.value = 0.6;
          e.nodes.push(...this._lfo(0.05, 0.4, g.gain, 0.6));
          e.nodes.push(...this._lfo(0.07, 350, bp.frequency, 500));
          e.nodes.push(...this._lfo(0.023, 0.25, g.gain, 0.6));
          this._chain(e, [s, bp, lp, g], out); break;
        }
        case 'forest': {
          const s = this._src(B.pink); const bp = this._filter('bandpass', 1200, 0.6); const lp = this._filter('lowpass', 4000, 0.5);
          const g = ctx.createGain(); g.gain.value = 0.45;
          e.nodes.push(...this._lfo(0.08, 0.25, g.gain, 0.45));
          e.nodes.push(...this._lfo(0.11, 500, bp.frequency, 1200));
          this._chain(e, [s, bp, lp, g], out);
          // distant birds
          const birdGain = ctx.createGain(); birdGain.gain.value = 0.05; birdGain.connect(out); e.nodes.push(birdGain);
          const chirp = () => {
            if (!this.active.has(id)) return;
            const t = ctx.currentTime; const n = 2 + Math.floor(Math.random() * 4); const base = 2500 + Math.random() * 2500;
            for (let i = 0; i < n; i++) {
              const o = ctx.createOscillator(); o.type = 'sine'; const gg = ctx.createGain();
              const st = t + i * (0.12 + Math.random() * 0.08);
              o.frequency.setValueAtTime(base, st); o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), st + 0.06); o.frequency.exponentialRampToValueAtTime(base * 0.9, st + 0.12);
              gg.gain.setValueAtTime(0, st); gg.gain.linearRampToValueAtTime(1, st + 0.02); gg.gain.exponentialRampToValueAtTime(0.001, st + 0.13);
              o.connect(gg); gg.connect(birdGain); o.start(st); o.stop(st + 0.15);
            }
            e.timers.push(setTimeout(chirp, 4000 + Math.random() * 9000));
          };
          e.timers.push(setTimeout(chirp, 2000 + Math.random() * 3000)); break;
        }
        case 'fan': {
          const s = this._src(B.pink); const bp = this._filter('bandpass', 700, 0.5); const lp = this._filter('lowpass', 3500, 0.6);
          const g = ctx.createGain(); g.gain.value = 1;
          e.nodes.push(...this._lfo(13, 0.05, g.gain, 1)); // blade flutter
          this._chain(e, [s, bp, lp, g], out);
          const hum = ctx.createOscillator(); hum.type = 'triangle'; hum.frequency.value = 110; const hg = ctx.createGain(); hg.gain.value = 0.03; hum.start();
          this._chain(e, [hum, hg], out); break;
        }
        case 'fire': {
          const s = this._src(B.brown); const lp = this._filter('lowpass', 400, 0.8);
          const g = ctx.createGain(); g.gain.value = 0.8;
          e.nodes.push(...this._lfo(0.3, 0.25, g.gain, 0.8));
          this._chain(e, [s, lp, g], out);
          const crackGain = ctx.createGain(); crackGain.gain.value = 0.25; crackGain.connect(out); e.nodes.push(crackGain);
          const crackle = () => {
            if (!this.active.has(id)) return;
            const t = ctx.currentTime; const n = ctx.createBufferSource(); n.buffer = B.white;
            const f = this._filter('bandpass', 2000 + Math.random() * 4000, 2); const gg = ctx.createGain();
            gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(0.3 + Math.random() * 0.5, t + 0.003); gg.gain.exponentialRampToValueAtTime(0.001, t + 0.02 + Math.random() * 0.05);
            n.connect(f); f.connect(gg); gg.connect(crackGain); n.start(t, Math.random() * 5, 0.1);
            e.timers.push(setTimeout(crackle, 60 + Math.random() * 700));
          };
          crackle(); break;
        }
        case 'night': {
          const s = this._src(B.pink); const bp = this._filter('bandpass', 600, 0.8); const g = ctx.createGain(); g.gain.value = 0.25;
          e.nodes.push(...this._lfo(0.04, 0.12, g.gain, 0.25));
          this._chain(e, [s, bp, g], out);
          // crickets: AM-modulated high tones
          const mk = (freq, rate, level) => {
            const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
            const am = ctx.createGain(); am.gain.value = 0;
            const l = ctx.createOscillator(); l.type = 'square'; l.frequency.value = rate; const lg = ctx.createGain(); lg.gain.value = 0.5; l.connect(lg); lg.connect(am.gain); am.gain.value = 0.5;
            const env = ctx.createGain(); env.gain.value = level;
            e.nodes.push(...this._lfo(0.15 + Math.random() * 0.1, level * 0.9, env.gain, level));
            o.start(); l.start();
            e.nodes.push(l, lg);
            this._chain(e, [o, am, env], out);
          };
          mk(4200, 28, 0.02); mk(4700, 31, 0.015); mk(3900, 22, 0.012);
          break;
        }
      }
    }

    // ---------- lab sound builders ----------
    _buildLab(id, e, out) {
      const ctx = this.ctx, B = this.buffers;
      switch (id) {
        case 'thunder': {
          const g = ctx.createGain(); g.gain.value = 0; g.connect(out); e.nodes.push(g);
          const rumble = () => {
            if (!this.active.has(id)) return;
            const s = this._src(B.brown); const lp = this._filter('lowpass', 90 + Math.random() * 60, 0.9); const gg = ctx.createGain();
            const t = ctx.currentTime, len = 4 + Math.random() * 5; gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(0.5 + Math.random() * 0.5, t + len * 0.35); gg.gain.linearRampToValueAtTime(0, t + len);
            s.connect(lp); lp.connect(gg); gg.connect(g); setTimeout(() => { try { s.stop(); s.disconnect(); lp.disconnect(); gg.disconnect(); } catch (_) { } }, len * 1000 + 100);
            e.timers.push(setTimeout(rumble, 15000 + Math.random() * 45000));
          };
          g.gain.setTargetAtTime(1, ctx.currentTime, 0.5); e.timers.push(setTimeout(rumble, 3000 + Math.random() * 8000)); break;
        }
        case 'city': {
          const s = this._src(B.brown); const lp = this._filter('lowpass', 220, 0.7); const g = ctx.createGain(); g.gain.value = 0.7;
          e.nodes.push(...this._lfo(0.03, 0.2, g.gain, 0.7)); this._chain(e, [s, lp, g], out);
          const s2 = this._src(B.pink); const bp = this._filter('bandpass', 500, 1.2); const g2 = ctx.createGain(); g2.gain.value = 0.08;
          e.nodes.push(...this._lfo(0.11, 0.05, g2.gain, 0.08)); this._chain(e, [s2, bp, g2], out);
          const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 60; const hg = ctx.createGain(); hg.gain.value = 0.04; hum.start(); this._chain(e, [hum, hg], out); break;
        }
        case 'cabin': {
          const s = this._src(B.brown); const lp = this._filter('lowpass', 400, 0.6); const g = ctx.createGain(); g.gain.value = 0.8; this._chain(e, [s, lp, g], out);
          const s2 = this._src(B.pink); const bp = this._filter('bandpass', 900, 0.6); const g2 = ctx.createGain(); g2.gain.value = 0.25; this._chain(e, [s2, bp, g2], out);
          const hum = ctx.createOscillator(); hum.type = 'triangle'; hum.frequency.value = 95; const hg = ctx.createGain(); hg.gain.value = 0.05; hum.start();
          e.nodes.push(...this._lfo(0.4, 0.015, hg.gain, 0.05)); this._chain(e, [hum, hg], out); break;
        }
        case 'chimes': {
          // Fractal-style: a random walk over a pentatonic set, slow attacks, long releases, never the same twice.
          const g = ctx.createGain(); g.gain.value = 1; g.connect(out); e.nodes.push(g);
          const scale = [0, 2, 4, 7, 9, 12, 14, 16]; let idx = 3; const base = 220 * Math.pow(2, (Math.random() * 5 | 0) / 12);
          const note = () => {
            if (!this.active.has(id)) return;
            idx = Math.max(0, Math.min(scale.length - 1, idx + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.8 ? 1 : 2)));
            const f = base * Math.pow(2, scale[idx] / 12) * (Math.random() < 0.3 ? 2 : 1);
            const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.01; const g2 = ctx.createGain(); g2.gain.value = 0.15;
            const env = ctx.createGain(); const t = ctx.currentTime; const a = 0.8 + Math.random() * 1.2, r = 4 + Math.random() * 5;
            env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.25 + Math.random() * 0.15, t + a); env.gain.exponentialRampToValueAtTime(0.0005, t + a + r);
            o.connect(env); o2.connect(g2); g2.connect(env); env.connect(g); o.start(t); o2.start(t); o.stop(t + a + r + 0.1); o2.stop(t + a + r + 0.1);
            e.timers.push(setTimeout(note, 2500 + Math.random() * 6000));
          };
          note(); break;
        }
        case 'paint': {
          // 24 log-spaced bands over white noise; gains come from the drawn curve (0..1 each).
          const curve = this.lab.paint || new Array(24).fill(0.5); const s = this._src(B.white); e.nodes.push(s);
          const sum = ctx.createGain(); sum.gain.value = 0.35; sum.connect(out); e.nodes.push(sum); e.bands = [];
          for (let i = 0; i < 24; i++) { const f = 60 * Math.pow(14000 / 60, (i + 0.5) / 24); const bp = this._filter('bandpass', f, 2.2); const g = ctx.createGain(); g.gain.value = Math.pow(curve[i], 1.6) * (0.6 + i / 24); s.connect(bp); bp.connect(g); g.connect(sum); e.nodes.push(bp, g); e.bands.push(g); }
          break;
        }
        case 'sculpt': {
          const p = this.lab.sculpt; const s = this._src(B.pink);
          const low = this._filter('lowshelf', 250); const high = this._filter('highshelf', 3500); const lp = this._filter('lowpass', 20000, 0.5); const hp = this._filter('highpass', 40, 0.5);
          const g = ctx.createGain(); g.gain.value = 1; e.sculpt = { low, high, lp, hp, g, lfo: null };
          this._chain(e, [s, hp, low, high, lp, g], out); this._applySculpt(e); break;
        }
        case 'notched': {
          const n = this.lab.notch; const s = this._src(B.pink); const q = n.width >= 1 ? 0.7 : n.width >= 0.5 ? 1.4 : 2.8;
          const a = this._filter('notch', n.freq, q); const b = this._filter('notch', n.freq, q); const c = this._filter('notch', n.freq, q); e.notches = [a, b, c];
          this._chain(e, [s, a, b, c], out); break;
        }
      }
    }
    _applySculpt(e) {
      const p = this.lab.sculpt, t = this.ctx.currentTime, k = e.sculpt; if (!k) return;
      k.low.gain.setTargetAtTime(p.warm * -1 * 8 + p.deep * 7, t, 0.2);          // warmer = more low shelf (warm is -1..1, negative = warmer)
      k.high.gain.setTargetAtTime(p.warm * 8 - p.deep * 5, t, 0.2);              // brighter = more high shelf
      k.lp.frequency.setTargetAtTime(p.soft < 0 ? 20000 * Math.pow(2, p.soft * 2.5) : 20000, t, 0.2);   // softer = lower cutoff
      k.hp.frequency.setTargetAtTime(p.deep < 0 ? 40 : 40 * Math.pow(2, p.deep * 3), t, 0.2);          // airy = remove lows
      if (k.lfo) { try { k.lfo[0].stop(); k.lfo[0].disconnect(); k.lfo[1].disconnect(); } catch (_) { } k.lfo = null; }
      if (p.moving > 0.05) { k.lfo = this._lfo(0.05 + p.moving * 0.12, p.moving * 0.25, k.g.gain, 1); e.nodes.push(...k.lfo); } else k.g.gain.setTargetAtTime(1, t, 0.2);
      // texture: smooth <0 keeps it steady; textured >0 adds micro-variation handled by setVariation on this sound only
      if (p.smooth > 0.05) { e._tex = setInterval(() => { if (!this.active.has('sculpt')) return clearInterval(e._tex); k.g.gain.setTargetAtTime(1 + (Math.random() * 2 - 1) * 0.25 * p.smooth, this.ctx.currentTime, 0.6); }, 900); e.timers.push(e._tex); }
      else if (e._tex) { clearInterval(e._tex); e._tex = null; }
    }
    setSculpt(params) { Object.assign(this.lab.sculpt, params); const e = this.active.get('sculpt'); if (e) this._applySculpt(e); }
    setPaint(curve) { this.lab.paint = curve.slice(); const e = this.active.get('paint'); if (e && e.bands) e.bands.forEach((g, i) => g.gain.setTargetAtTime(Math.pow(curve[i], 1.6) * (0.6 + i / 24), this.ctx.currentTime, 0.15)); }
    setNotch(freq, width) { Object.assign(this.lab.notch, { freq, width }); const e = this.active.get('notched'); if (e && e.notches) { const q = width >= 1 ? 0.7 : width >= 0.5 ? 1.4 : 2.8; e.notches.forEach(n => { n.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1); n.Q.setTargetAtTime(q, this.ctx.currentTime, 0.1); }); } }

    // ---------- frequency generator ----------
    async toneStart(opts) {
      await this.init();
      if (this.tone && this.tone.playing) { this.toneUpdate(opts); return; }
      const ctx = this.ctx;
      const t = { playing: true, freq: opts.freq, type: opts.type || 'sine', volume: opts.volume ?? 0.3, balance: opts.balance ?? 0, am: opts.am || 0 };
      t.gain = ctx.createGain(); t.gain.gain.value = 0;
      t.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      t.out = ctx.createGain(); t.out.gain.value = 0.5; // tones are perceptually loud; trimmed
      t.gain.connect(t.pan || t.out); if (t.pan) t.pan.connect(t.out);
      t.out.connect(this.master);
      this._toneSource(t);
      const now = ctx.currentTime;
      t.gain.gain.setValueAtTime(0, now); t.gain.gain.linearRampToValueAtTime(this._curve(t.volume), now + 0.6);
      this.tone = t; this._keepAlive(true);
      this.emit('tone', { playing: true });
    }
    _toneSource(t) {
      const ctx = this.ctx;
      if (t.src) { try { t.src.stop(); } catch (_) { } try { t.src.disconnect(); } catch (_) { } if (t.filt) try { t.filt.disconnect(); } catch (_) { } }
      t.filt = null;
      if (t.type === 'narrow' || t.type === 'hiss') {
        const s = ctx.createBufferSource(); s.buffer = this.buffers.white; s.loop = true;
        const f = this._filter('bandpass', t.freq, t.type === 'narrow' ? 30 : 4);
        const g = ctx.createGain(); g.gain.value = t.type === 'narrow' ? 6 : 1.5;
        s.connect(f); f.connect(g); g.connect(t.gain); s.start();
        t.src = s; t.filt = f; t.preGain = g;
      } else {
        const o = ctx.createOscillator(); o.type = t.type === 'soft' ? 'triangle' : t.type; o.frequency.value = t.freq;
        if (t.type === 'soft') { const lp = this._filter('lowpass', t.freq * 1.5, 0.5); o.connect(lp); lp.connect(t.gain); t.filt = lp; }
        else o.connect(t.gain);
        o.start(); t.src = o;
      }
      if (t.pan) t.pan.pan.value = t.balance;
      this._toneAM(t);
    }
    _toneAM(t) {
      if (t.amNodes) { try { t.amNodes[0].stop(); t.amNodes.forEach(n => n.disconnect()); } catch (_) { } t.amNodes = null; t.out.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.05); }
      if (!t.am) return;
      // out gain oscillates between ~0 and 0.25 at the AM rate (full-depth sinusoidal AM, as in the RI studies)
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = t.am; const g = this.ctx.createGain(); g.gain.value = 0.25;
      o.connect(g); g.connect(t.out.gain); t.out.gain.setTargetAtTime(0.25, this.ctx.currentTime, 0.05); o.start(); t.amNodes = [o, g];
    }
    toneUpdate(opts) {
      const t = this.tone; if (!t) return;
      const now = this.ctx.currentTime;
      if (opts.type && opts.type !== t.type) { t.type = opts.type; this._toneSource(t); }
      if (opts.am !== undefined && opts.am !== t.am) { t.am = opts.am; this._toneAM(t); }
      if (opts.freq !== undefined) {
        t.freq = opts.freq;
        if (t.src.frequency) t.src.frequency.setTargetAtTime(opts.freq, now, 0.02);
        if (t.filt && t.filt.frequency) t.filt.frequency.setTargetAtTime(t.type === 'soft' ? opts.freq * 1.5 : opts.freq, now, 0.02);
      }
      if (opts.volume !== undefined) { t.volume = opts.volume; t.gain.gain.setTargetAtTime(this._curve(opts.volume), now, 0.05); }
      if (opts.balance !== undefined) { t.balance = opts.balance; if (t.pan) t.pan.pan.setTargetAtTime(opts.balance, now, 0.05); }
      if (opts.freq !== undefined || opts.type) this.emit('tone', { playing: true });
    }
    toneStop() {
      const t = this.tone; if (!t || !t.playing) return;
      t.playing = false;
      const now = this.ctx.currentTime;
      t.gain.gain.cancelScheduledValues(now); t.gain.gain.setValueAtTime(t.gain.gain.value, now); t.gain.gain.linearRampToValueAtTime(0, now + 0.4);
      setTimeout(() => { try { t.src.stop(); } catch (_) { } try { if (t.amNodes) t.amNodes[0].stop(); } catch (_) { } try { t.out.disconnect(); } catch (_) { } }, 450);
      this.tone = null;
      if (!this.isPlaying) this._keepAlive(false);
      this.emit('tone', { playing: false });
    }

    // ---------- sleep timer ----------
    setTimer(minutes, fade = true) {
      this.clearTimer();
      if (!minutes) { this.emit('timer', this.timer); return; }
      this.timer = { endsAt: Date.now() + minutes * 60000, fade, durationMin: minutes, fading: false };
      const tick = () => {
        const left = this.timer.endsAt - Date.now();
        if (left <= 0) { this._timerFinish(); return; }
        const fadeMs = Math.min(5 * 60000, this.timer.durationMin * 60000 * 0.25);
        if (this.timer.fade && left <= fadeMs && !this.timer.fading && this.ctx) {
          this.timer.fading = true;
          const g = this.master.gain; const t = this.ctx.currentTime;
          g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + left / 1000);
        }
        this.emit('timer', this.timer);
        this._timerId = setTimeout(tick, 1000);
      };
      tick();
    }
    _timerFinish() {
      this.stopAll();
      this.timer = { endsAt: null, fade: this.timer.fade, durationMin: null };
      if (this.ctx) { const g = this.master.gain; g.cancelScheduledValues(this.ctx.currentTime); this.setMasterVolume(this.masterVolume, true); }
      this.emit('timer', this.timer); this.emit('timerDone');
    }
    clearTimer() {
      if (this._timerId) clearTimeout(this._timerId); this._timerId = null;
      const wasFading = this.timer.fading;
      this.timer = { endsAt: null, fade: this.timer.fade, durationMin: null };
      if (wasFading && this.ctx) this.setMasterVolume(this.masterVolume);
      this.emit('timer', this.timer);
    }

    // ---------- analyser data for visuals ----------
    getLevels(out) {
      if (!this.analyser) return 0;
      this.analyser.getByteFrequencyData(out);
      let sum = 0; for (let i = 0; i < out.length; i++) sum += out[i];
      return sum / (out.length * 255);
    }
    getWave(out) { if (this.analyser) this.analyser.getByteTimeDomainData(out); }
  }

  global.SoftwaveAudio = { Engine, SOUND_DEFS, MAX_ACTIVE };
})(window);
