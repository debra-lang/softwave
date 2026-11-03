/* TEST-ONLY objective comparison of engine versions (Nov 2026). Renders every sound offline with the same random sequence from each engine's real builder code and
   compares: null residual, loudness, peak, band spectrum, stereo balance and correlation, and event timing. Runs unchanged in Chrome and in WebKit. */
window.offlineCompare = async function (Engines, opts) {
  opts = Object.assign({ seconds: 30, sr: 48000, ids: null }, opts || {});
  const realRandom = Math.random, realTimeout = window.setTimeout;
  const seeded = (s) => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const refEngine = Object.values(Engines)[0];
  const ids = opts.ids || refEngine.SOUND_DEFS.map(d => d.id);

  async function render(api, id, seed) {
    const sr0 = seeded(seed); let calls = 0; Math.random = () => { calls++; return sr0(); };
    const ctx = new OfflineAudioContext(2, opts.seconds * opts.sr, opts.sr);
    const e = new api.Engine(); e.ctx = ctx;
    // the same three buffers for every engine and sound
    const mk = (secs, fn) => { const b = ctx.createBuffer(2, secs * opts.sr, opts.sr); [0, 1].forEach(c => { const d = b.getChannelData(c), r = seeded(seed * 7 + c + secs); let y = 0; for (let i = 0; i < d.length; i++) { y = fn(r() * 2 - 1, y); d[i] = y; } }); return b; };
    e.buffers = { white: mk(6, w => w), pink: mk(8, (w, y) => 0.97 * y + 0.12 * w), brown: mk(10, (w, y) => (y + 0.02 * w) / 1.02) };
    // Offline time does not advance before rendering, so the lookahead pump fills the whole render at once.
    e._pump = function (entry, sid, first, gap, fire) { let next = first; while (next < opts.seconds) { const g = fire(next); next += (typeof g === 'number' && g > 0) ? g : gap(); } };
    const out = ctx.createGain(); out.connect(ctx.destination);
    const entry = { nodes: [], timers: [], volume: 0.6, balance: 0, trim: 1, cutoff: 20000 };
    e.active.set(id, entry);
    e._build(id, entry, out);
    const buf = await ctx.startRendering();
    Math.random = realRandom;
    const res = [buf.getChannelData(0), buf.getChannelData(1)]; res.calls = calls; return res;
  }
  const db = x => x > 1e-12 ? 10 * Math.log10(x) : -120;
  function measure(ch, sr) {
    const [L, R] = ch, n = L.length; let sl = 0, sr2 = 0, slr = 0, peak = 0;
    for (let i = 0; i < n; i++) { sl += L[i] * L[i]; sr2 += R[i] * R[i]; slr += L[i] * R[i]; peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
    const blocks = [], hop = Math.round(sr * 0.01);   // short-time energy for event timing
    for (let b = 0; b + hop <= n; b += hop) { let s = 0; for (let i = b; i < b + hop; i++) s += L[i] * L[i] + R[i] * R[i]; blocks.push(s / hop); }
    const on = []; for (let b = 3; b < blocks.length; b++) { const pre = (blocks[b - 1] + blocks[b - 2] + blocks[b - 3]) / 3; if (blocks[b] > pre * 1.6 && blocks[b] > 1e-7 && blocks[b] >= blocks[b + 1 < blocks.length ? b + 1 : b]) on.push(b * 0.01); }
    // band energy in octaves (one-pole differences of the mono signal are enough to compare two renders of the same sound)
    const edges = [62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000], bands = []; const mono = new Float32Array(n); for (let i = 0; i < n; i++) mono[i] = 0.5 * (L[i] + R[i]);
    let prev = 0, prevLow = new Float32Array(n);
    for (let k = 0; k < edges.length; k++) {
      const a = 1 - Math.exp(-2 * Math.PI * edges[k] / sr); let y = 0, sum = 0;
      for (let i = 0; i < n; i++) { y += a * (mono[i] - y); const d = y - prevLow[i]; prevLow[i] = y; sum += d * d; }
      bands.push(+db(sum / n).toFixed(2));
    }
    const corr = slr / Math.max(1e-12, Math.sqrt(sl * sr2));
    return { rms: +db((sl + sr2) / (2 * n)).toFixed(2), peak: +peak.toFixed(4), balance: +(db(sl / n) - db(sr2 / n)).toFixed(2), corr: +corr.toFixed(4), bands, onsets: on };
  }
  const results = {};
  const names = Object.keys(Engines), base = names[0];
  for (const id of ids) {
    const row = results[id] = {}; let ref = null, refM = null;
    for (const name of names) {
      const ch = await render(Engines[name], id, 1234567);
      const m = measure(ch, opts.sr); row['calls_' + name] = ch.calls;
      if (!ref) { ref = ch; refM = m; row[name] = { rms: m.rms, peak: m.peak, balance: m.balance, corr: m.corr, events: m.onsets.length }; continue; }
      let dd = 0, rr = 0; for (let c = 0; c < 2; c++) for (let i = 0; i < ch[c].length; i++) { const d = ch[c][i] - ref[c][i]; dd += d * d; rr += ref[c][i] * ref[c][i]; }
      const maxBand = Math.max(...m.bands.map((b, i) => Math.abs(b - refM.bands[i])).filter((_, i) => refM.bands[i] > -90).concat(0));
      // each onset in the original against the closest one here, in ms
      let matched = 0, off = 0; for (const t of refM.onsets) { let best = 1e9; for (const u of m.onsets) best = Math.min(best, Math.abs(u - t)); if (best <= 0.02) { matched++; off = Math.max(off, best); } }
      row[name] = { rms: m.rms, peak: m.peak, balance: m.balance, corr: m.corr, events: m.onsets.length, nullDb: rr > 0 ? +(dd > 0 ? db(dd / rr) : -200).toFixed(1) : null, dRms: +(m.rms - refM.rms).toFixed(2), maxBandDiff: +maxBand.toFixed(2), onsetsMatched: refM.onsets.length ? +(matched / refM.onsets.length).toFixed(3) : null };
    }
  }
  return results;
};
