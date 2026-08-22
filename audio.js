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
  ];

  const MAX_ACTIVE = 5;
  const FADE_IN = 1.2;    // seconds
  const FADE_OUT = 0.8;   // seconds

  // Per-sound loudness trim so the mixer feels balanced at equal slider values.
  const TRIM = {
    white: 0.16, pink: 0.32, brown: 0.9, static: 0.22, hiss: 0.26,
    rain: 0.45, ocean: 0.85, stream: 0.4, waterfall: 0.38, forest: 0.6,
    wind: 0.8, fan: 0.5, fire: 0.9, night: 0.7,
  };

  // ---------- buffer generators ----------
  // Seamless loops: generate `n` extra "pre-roll" samples before the loop start,
  // then equal-power crossfade the loop's tail into that pre-roll. The last
  // sample of the loop therefore flows naturally into the first one, with
  // continuous filter state — no click, no gap, even for brown noise.
  function makeLoop(ctx, seconds, n, gen) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const x = new Float32Array(len + n);
      gen(x);
      const y = buf.getChannelData(c);
      for (let i = 0; i < len - n; i++) y[i] = x[n + i];
      for (let i = 0; i < n; i++) {
        const t = i / n; const a = Math.cos(t * Math.PI / 2), b = Math.sin(t * Math.PI / 2);
        y[len - n + i] = x[len + i] * a + x[i] * b;
      }
    }
    return buf;
  }
  function whiteBuffer(ctx, seconds) {
    return makeLoop(ctx, seconds, 2048, x => { for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1; });
  }
  function pinkBuffer(ctx, seconds) {
    return makeLoop(ctx, seconds, 16384, x => {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < x.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        x[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    });
  }
  function brownBuffer(ctx, seconds) {
    return makeLoop(ctx, seconds, 65536, x => {
      let last = 0;
      for (let i = 0; i < x.length; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        x[i] = last * 3.5;
      }
      let mean = 0; for (let i = 0; i < x.length; i++) mean += x[i]; mean /= x.length;
      for (let i = 0; i < x.length; i++) x[i] -= mean;
    });
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
    }

    on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    emit(type, data) { this.listeners.forEach(fn => fn(type, data)); }

    get ready() { return !!this.ctx; }
    get isPlaying() { return this.ctx && this.ctx.state === 'running' && (this.active.size > 0 || (this.tone && this.tone.playing) || (this.matcher && this.matcher.playing)); }

    async init() {
      if (this.ctx) { await this.resume(); return; }
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

      this.master.connect(this.limiter);
      this.limiter.connect(this.analyser);
      this.analyser.connect(ctx.destination);

      this.buffers.white = whiteBuffer(ctx, 6);
      this.buffers.pink = pinkBuffer(ctx, 8);
      this.buffers.brown = brownBuffer(ctx, 10);

      ctx.onstatechange = () => {
        this.emit('state', ctx.state);
      };
      this._setupBackground();
      await this.resume();
      this.setMasterVolume(this.masterVolume, true);
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
    defs() { return SOUND_DEFS; }
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
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) { pan.pan.value = balance; gain.connect(pan); pan.connect(this.master); }
      else gain.connect(this.master);
      const entry = { gain, pan, nodes: [], timers: [], volume, balance, trim: TRIM[id] || 0.5 };
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

    stopAll() {
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

    // ---------- frequency generator ----------
    async toneStart(opts) {
      await this.init();
      if (this.tone && this.tone.playing) { this.toneUpdate(opts); return; }
      const ctx = this.ctx;
      const t = { playing: true, freq: opts.freq, type: opts.type || 'sine', volume: opts.volume ?? 0.3, balance: opts.balance ?? 0 };
      t.gain = ctx.createGain(); t.gain.gain.value = 0;
      t.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      t.out = ctx.createGain(); t.out.gain.value = 0.25; // tones are perceptually loud; trim hard
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
    }
    toneUpdate(opts) {
      const t = this.tone; if (!t) return;
      const now = this.ctx.currentTime;
      if (opts.type && opts.type !== t.type) { t.type = opts.type; this._toneSource(t); }
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
      setTimeout(() => { try { t.src.stop(); } catch (_) { } try { t.out.disconnect(); } catch (_) { } }, 450);
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
