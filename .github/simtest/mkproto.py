#!/usr/bin/env python3
# Applies the two engine prototypes to clean copies of audio.js, asserting that every replacement lands exactly once.
import sys
src, pin_out, pool_out = sys.argv[1:4]
h = open(src, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in h else '\n'
def rep(s, a, b):
    a = a.replace('\n', nl); b = b.replace('\n', nl)
    assert s.count(a) == 1, ('not exactly once', s.count(a), a[:90])
    return s.replace(a, b)

# ---- prototype 1: every noise-fed filter stays in stereo, nothing else changes
pin = rep(h, """    _filter(type, freq, q = 1) {
      const f = this.ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q; return f;
    }""", """    // A filter stays in stereo for life (mono = true only for one fed by a mono oscillator on its way to a panner, whose level depends on the channel count).
    // Left to follow its input, a filter falls to one channel when its last stereo source ends. WebKit then rebuilds it with an unknown (infinite) tail, and
    // one disconnected before the next render keeps that tail for good: it stays on a list the audio thread walks every 3 ms until the app restarts.
    _filter(type, freq, q = 1, mono = false) {
      const f = this.ctx.createBiquadFilter();
      if (!mono) { f.channelCountMode = 'explicit'; f.channelCount = 2; }
      f.type = type; f.frequency.value = freq; f.Q.value = q; return f;
    }""")
pin = rep(pin, "const lp = this._filter('lowpass', t.freq * 1.5, 0.5); o.connect(lp);", "const lp = this._filter('lowpass', t.freq * 1.5, 0.5, true); o.connect(lp);")

# ---- prototype 2: prototype 1 plus reusable voices, so event sounds stop creating filters altogether
pool = rep(pin, """    _chain(entry, nodes, out) {""", """    // Reusable voices for scheduled events, taken in turn: each sound keeps a few filters and envelopes for its whole life instead of making new ones per event.
    // count must cover the longest possible overlap of events, so that a voice is free again when its turn returns.
    _voices(e, count, make) {
      const v = []; for (let i = 0; i < count; i++) { const x = make(); e.nodes.push(...Object.values(x)); v.push(x); }
      let i = 0; return () => v[i++ % count];
    }
    _chain(entry, nodes, out) {""")
# rain
pool = rep(pool, """          const tick = (t) => {
            const n = this.ctx.createBufferSource(); n.buffer = B.white;
            const f = this._filter('bandpass', 1500 + Math.random() * 5000, 6);
            const gg = ctx.createGain();
            gg.gain.setValueAtTime(0, t);""", """          // gaps are at least 0.04 s and a droplet lasts 0.2 s, so six voices never overlap
          const voice = this._voices(e, 6, () => { const f = this._filter('bandpass', 4000, 6); const gg = ctx.createGain(); gg.gain.value = 0; f.connect(gg); gg.connect(dropGain); return { f, gg }; });
          const tick = (t) => {
            const n = this.ctx.createBufferSource(); n.buffer = B.white;
            const { f, gg } = voice();
            f.frequency.setValueAtTime(1500 + Math.random() * 5000, t);
            gg.gain.setValueAtTime(0, t);""")
pool = rep(pool, """            n.connect(f); f.connect(gg); gg.connect(dropGain);
            n.start(t, Math.random() * 5, 0.2); n.onended = () => { try { f.disconnect(); gg.disconnect(); } catch (_) { } };""", """            n.connect(f);
            n.start(t, Math.random() * 5, 0.2); n.onended = () => { try { n.disconnect(); } catch (_) { } };""")
# fire
pool = rep(pool, """          const one = (t, kind) => {
            const n = ctx.createBufferSource(); n.buffer = B.white;
            const f = kind === 'pop' ? this._filter('bandpass', 500 + Math.random() * 1100, 1.6) : this._filter('bandpass', 2000 + Math.random() * 4000, 2);
            const gg = ctx.createGain();
""", """          const voice = this._voices(e, 8, () => { const f = this._filter('bandpass', 2000, 2); const gg = ctx.createGain(); gg.gain.value = 0; f.connect(gg); gg.connect(crackGain); return { f, gg }; });
          const one = (t, kind) => {
            const n = ctx.createBufferSource(); n.buffer = B.white;
            const { f, gg } = voice();
            f.frequency.setValueAtTime(kind === 'pop' ? 500 + Math.random() * 1100 : 2000 + Math.random() * 4000, t); f.Q.setValueAtTime(kind === 'pop' ? 1.6 : 2, t);
""")
pool = rep(pool, """            n.connect(f); f.connect(gg); gg.connect(crackGain); n.start(t, Math.random() * 5, dur + 0.05);
            n.onended = () => { try { f.disconnect(); gg.disconnect(); } catch (_) { } };""", """            n.connect(f); n.start(t, Math.random() * 5, dur + 0.05);
            n.onended = () => { try { n.disconnect(); } catch (_) { } };""")
# glass rain: taps
pool = rep(pool, """          let ph = Math.random() * 100;
          const tap = (t) => {""", """          let ph = Math.random() * 100;
          const tapVoice = this._voices(e, 4, () => { const f = this._filter('bandpass', 1500, 8); const gg = ctx.createGain(); gg.gain.value = 0; const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null; f.connect(gg); if (p) { gg.connect(p); p.connect(tapGain); return { f, gg, p }; } gg.connect(tapGain); return { f, gg }; });
          const tap = (t) => {""")
pool = rep(pool, """              const f = this._filter('bandpass', 850 + Math.random() * 1700, 8);
              const gg = ctx.createGain(); const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
              gg.gain.setValueAtTime(0, t);""", """              const { f, gg, p } = tapVoice();
              f.frequency.setValueAtTime(850 + Math.random() * 1700, t);
              gg.gain.setValueAtTime(0, t);""")
pool = rep(pool, """              n.connect(f); f.connect(gg);
              if (p) { p.pan.value = (Math.random() * 2 - 1) * 0.7; gg.connect(p); p.connect(tapGain); } else gg.connect(tapGain);
              n.start(t, Math.random() * 5, 0.2); n.onended = () => { try { f.disconnect(); gg.disconnect(); if (p) p.disconnect(); } catch (_) { } };""", """              n.connect(f);
              if (p) p.pan.setValueAtTime((Math.random() * 2 - 1) * 0.7, t);
              n.start(t, Math.random() * 5, 0.2); n.onended = () => { try { n.disconnect(); } catch (_) { } };""")
# glass rain: runs (at least 4 s apart, at most 1.15 s long: one voice)
pool = rep(pool, """          const run = (t) => {
            const n = ctx.createBufferSource(); n.buffer = B.white;
            const f = this._filter('bandpass', 1900, 10); const gg = ctx.createGain();
""", """          const runVoice = this._voices(e, 1, () => { const f = this._filter('bandpass', 1900, 10); const gg = ctx.createGain(); gg.gain.value = 0; f.connect(gg); gg.connect(tapGain); return { f, gg }; });
          const run = (t) => {
            const n = ctx.createBufferSource(); n.buffer = B.white;
            const { f, gg } = runVoice();
""")
pool = rep(pool, """            n.connect(f); f.connect(gg); gg.connect(tapGain);
            n.start(t, Math.random() * 5, dur + 0.05); n.onended = () => { try { f.disconnect(); gg.disconnect(); } catch (_) { } };""", """            n.connect(f);
            n.start(t, Math.random() * 5, dur + 0.05); n.onended = () => { try { n.disconnect(); } catch (_) { } };""")
# Lapping and Thunder keep their own per-event nodes: their looped sources start when scheduled and pass at full gain until the event begins, which is part of how they sound today.
open(pin_out, 'w', encoding='utf-8', newline='').write(pin)
open(pool_out, 'w', encoding='utf-8', newline='').write(pool)
print('ok')
