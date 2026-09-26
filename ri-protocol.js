/* Find My Quiet Sound — Sound Response Lab ("Discover What Changes Your Tinnitus")
   Protocol + adaptive decision engine. PURE LOGIC: no DOM, no audio, no storage.
   Everything a trial needs to be reconstructed later is decided here and stamped with
   PROTOCOL_VERSION / ALGORITHM_VERSION. Change a number below → bump the version.

   What the user experiences: listen → say what happened → we learn.
   What this file does underneath: controlled candidates around the tinnitus pitch plus
   broadband / modulated comparisons, seeded counterbalanced order, replication before any
   optimisation (2 of 3 — a design decision, not a validated cutoff), one variable at a
   time (frequency → bandwidth → modulation), a matched control challenge, and rules for
   when to stop. Nothing here claims treatment; it only decides what is worth testing next. */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.RIProtocol = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PROTOCOL_VERSION = 'RI-WEB-V1.0';
  const ALGORITHM_VERSION = 'RI-ADAPT-V1.1';   // V1.1: the control challenge is EVALUATED (candidate vs control), not concluded by pair count

  const CONFIG = {
    stimulusSeconds: 60,            // fixed in V1 — frequency/bandwidth/modulation are explored, never duration
    quietGapSeconds: 5,             // standardised silence between the sound stopping and the question
    fadeSeconds: 0.3,               // click-free edges; part of the 60 s
    pauseMaxSeconds: 15,            // a longer pause invalidates the trial
    minRestSeconds: 45,             // rest after a trial before the next baseline is asked
    baselineTolerance: 2,           // the next trial baseline must sit within ±2 of the session baseline
    prolongedRiSeconds: 900,        // a reduction still present after 15 min ends the session (kept as data)
    riTimeoutSeconds: 1800,         // no answer for 30 min → duration unknown, session ends
    replication: { positiveOf: 2, outOf: 3 },   // DESIGN DECISION, not a validated medical cutoff
    avoidAfterLouder: 2,            // two "louder" responses retire a sound; one uncomfortable one retires it at once
    maxValidExposuresNoResponder: 10,   // the brief's 8–12 range; after this with no repeatable response, stop searching
    firstSessionTrials: 3,
    returningTrials: 3,             // returning sessions: 1–3 sounds
    defaultBandwidthOct: 1 / 3,     // one-third-octave narrow-band noise
    bandwidthGrid: [1 / 6, 1 / 3, 1],
    modulationGrid: [0, 10, 40],    // Hz; 0 = unmodulated
    discoveryAmHz: 40,              // 40 Hz included as an exploratory AM condition based on prior modulated-sound tinnitus studies; not an established optimal rate
    ratioGrid: [0.70, 0.80, 0.90, 1.00, 1.10, 1.20, 1.30],   // centre frequency ÷ tinnitus frequency
    broadband: { lo: 100, hi: 12000 },
    controlPairsRequired: 3,        // candidate-vs-control pairs across separate sessions before the comparison is evaluated
    controlPairsMax: 6,             // an inconclusive comparison with the candidate ahead may keep testing up to this many pairs
    controlRatioForBroadResponder: 0.50,   // when broadband itself is the candidate, the control is a distant narrow band
    minCentreHz: 100,
    maxCentreFraction: 0.45,        // of the sample rate
    levelMaxGain: 0.6,              // the level slider's top, before RMS matching — never escalated by the algorithm
  };
  let testMode = false;

  // ---------- candidates ----------
  const BW_KEY = { [1 / 6]: '1/6', [1 / 3]: '1/3', [1]: '1' };
  const bwKey = bw => BW_KEY[bw] || String(bw);
  function cid(p) { return p.type === 'bbn' ? 'bbn' : `nbn|${p.ratio.toFixed(2)}|${bwKey(p.bw)}|${p.mod || 0}`; }
  function parse(id) {
    if (id === 'bbn') return { type: 'bbn', ratio: null, bw: null, mod: 0 };
    const [, r, b, m] = id.split('|'); const bw = b === '1/6' ? 1 / 6 : b === '1/3' ? 1 / 3 : +b;
    return { type: 'nbn', ratio: +r, bw, mod: +m };
  }
  const NBN = (ratio, bw = CONFIG.defaultBandwidthOct, mod = 0) => ({ type: 'nbn', ratio, bw, mod });
  function discoverySet() {
    return [NBN(1.00), NBN(0.80), NBN(1.20), { type: 'bbn', ratio: null, bw: null, mod: 0 }, NBN(1.00, CONFIG.defaultBandwidthOct, CONFIG.discoveryAmHz)].map(p => ({ id: cid(p), params: p, role: 'discovery' }));
  }
  const FIRST_SESSION = () => [cid(NBN(1.00)), cid(NBN(0.80)), 'bbn'];   // pitch-centred, slightly below, and a broadband comparison

  // Concrete stimulus parameters for a candidate at tinnitus frequency F (Hz).
  function stimulus(params, F, sampleRate = 48000) {
    const sec = CONFIG.stimulusSeconds;
    if (params.type === 'bbn') {
      return { stimulus_type: 'broadband_noise', center_frequency_hz: null, frequency_ratio_to_tinnitus: null, bandwidth_oct: null, filter_lo_hz: CONFIG.broadband.lo, filter_hi_hz: Math.min(CONFIG.broadband.hi, sampleRate * CONFIG.maxCentreFraction), q: null, modulation_type: 'none', modulation_frequency_hz: 0, stimulus_duration_seconds: sec };
    }
    const fc = F * params.ratio, bw = params.bw;
    const lo = fc * Math.pow(2, -bw / 2), hi = fc * Math.pow(2, bw / 2);
    const q = 1 / (Math.pow(2, bw / 2) - Math.pow(2, -bw / 2));   // Q = fc / (hi − lo)
    return { stimulus_type: params.mod ? 'narrowband_noise_am' : 'narrowband_noise', center_frequency_hz: round(fc), frequency_ratio_to_tinnitus: params.ratio, bandwidth_oct: bw, filter_lo_hz: round(lo), filter_hi_hz: round(hi), q: Math.round(q * 100) / 100, modulation_type: params.mod ? 'amplitude' : 'none', modulation_frequency_hz: params.mod || 0, stimulus_duration_seconds: sec };
  }
  function feasible(params, F, sampleRate = 48000) {
    if (params.type === 'bbn') return true;
    const s = stimulus(params, F, sampleRate);
    return s.filter_lo_hz >= CONFIG.minCentreHz && s.filter_hi_hz <= sampleRate * CONFIG.maxCentreFraction;
  }
  const round = x => Math.round(x * 10) / 10;

  // ---------- seeded, reproducible order ----------
  function seedFrom(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(list, seed) { const r = rng(seed); const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- profile state ----------
  function newProfile(anonId, now) {
    return { protocol_version: PROTOCOL_VERSION, algorithm_version: ALGORITHM_VERSION, anonymous_user_id: anonId, created: now, stage: 'discovery',
      candidates: {}, locked: { ratio: null, bw: null, mod: null }, primary: null, controlPairs: [], concluded: null,
      counts: { sessions: 0, trials: 0, valid: 0, reductions: 0 } };
  }
  function ensureCandidate(profile, params, role) {
    const id = cid(params);
    if (!profile.candidates[id]) profile.candidates[id] = { id, params, role, exposures: [], status: 'untested' };
    return profile.candidates[id];
  }
  const outcomeOf = t => t.trial_valid === false ? 'invalid' : t.residual_excitation ? 'neg' : ({ 'much-quieter': 'pos', 'quieter': 'pos', 'same': 'same', 'louder': 'neg', 'unsure': 'unsure' })[t.immediate_response_category] || 'unsure';

  // status from the FIRST `outOf` valid exposures (later exposures come from refinement/control and never re-open a decision)
  function evalCandidate(c) {
    const valid = c.exposures.filter(e => e.outcome !== 'invalid');
    const uncomfortable = c.exposures.some(e => e.adverse);
    const neg = valid.filter(e => e.outcome === 'neg').length;
    if (uncomfortable || neg >= CONFIG.avoidAfterLouder) return 'avoid';
    const { positiveOf, outOf } = CONFIG.replication;
    const first = valid.slice(0, outOf); const pos = first.filter(e => e.outcome === 'pos').length;
    if (first.length >= outOf) return pos >= positiveOf ? 'confirmed' : 'inactive';
    if (pos + (outOf - first.length) < positiveOf) return 'inactive';   // cannot reach 2 of 3 any more
    if (valid.length === 0) return 'untested';
    return pos >= 1 ? 'promising' : 'testing';
  }
  const posRate = c => { const v = c.exposures.filter(e => e.outcome !== 'invalid'); return v.length ? v.filter(e => e.outcome === 'pos').length / v.length : 0; };
  const decided = c => ['confirmed', 'inactive', 'avoid'].includes(c.status);

  function neighbours(ratio) { const g = CONFIG.ratioGrid; const i = g.indexOf(ratio); return [g[i - 1], g[i + 1]].filter(x => x !== undefined); }
  function gridFor(profile) {
    const p = profile.primary && profile.candidates[profile.primary]; if (!p) return [];
    if (profile.stage === 'refine_freq') return neighbours(p.params.ratio).map(r => NBN(r, p.params.bw, p.params.mod));
    if (profile.stage === 'refine_bw') return CONFIG.bandwidthGrid.filter(b => b !== profile.locked.bw).map(b => NBN(profile.locked.ratio, b, 0));
    if (profile.stage === 'refine_mod') return CONFIG.modulationGrid.filter(m => m !== profile.locked.mod).map(m => NBN(profile.locked.ratio, profile.locked.bw, m));
    return [];
  }
  function controlFor(profile) {
    const best = bestCandidate(profile); if (!best) return null;
    return best.params.type === 'bbn' ? NBN(CONFIG.controlRatioForBroadResponder) : { type: 'bbn', ratio: null, bw: null, mod: 0 };
  }
  // Control challenge — a simple, predefined, deterministic comparison of positive-response COUNTS across the
  // completed pairs. No statistics (three pairs cannot carry them), no composite score; durations are
  // descriptive only and never decide anything. A tie on counts is never read as candidate superiority.
  const CONTROL_OUTCOMES = ['candidate_specific_response', 'broad_or_nonspecific_response', 'control_better_or_inconclusive'];
  const CONTROL_RULE = 'control ahead → inconclusive; candidate ≥2 and ≥2 ahead → specific; both ≥2 → nonspecific; else inconclusive';
  function evaluateControl(profile) {
    const done = profile.controlPairs.filter(p => p.complete);
    const candPos = done.filter(p => p.results[p.candidate] === 'pos').length, ctrlPos = done.filter(p => p.results[p.control] === 'pos').length;
    let outcome;
    if (ctrlPos > candPos) outcome = 'control_better_or_inconclusive';
    else if (candPos >= 2 && candPos - ctrlPos >= 2) outcome = 'candidate_specific_response';
    else if (candPos >= 2 && ctrlPos >= 2) outcome = 'broad_or_nonspecific_response';
    else outcome = 'control_better_or_inconclusive';
    const durs = k => done.map(p => p.ri && p.ri[k]).filter(x => typeof x === 'number');
    return { outcome, pairs: done.length, candidate_pos: candPos, control_pos: ctrlPos, candidate_median_ri: median(durs('candidate')), control_median_ri: median(durs('control')), rule: CONTROL_RULE, algorithm_version: ALGORITHM_VERSION };
  }
  function bestCandidate(profile) {
    if (profile.locked.ratio != null) { const id = cid(NBN(profile.locked.ratio, profile.locked.bw != null ? profile.locked.bw : CONFIG.defaultBandwidthOct, profile.locked.mod || 0)); if (profile.candidates[id]) return profile.candidates[id]; }
    return profile.primary ? profile.candidates[profile.primary] : null;
  }

  // Recompute statuses, primary candidate, locks and stage from the exposures. Idempotent.
  function recompute(profile) {
    const cs = Object.values(profile.candidates);
    cs.forEach(c => { c.status = evalCandidate(c); });
    profile.counts.valid = cs.reduce((n, c) => n + c.exposures.filter(e => e.outcome !== 'invalid').length, 0);
    profile.counts.reductions = cs.reduce((n, c) => n + c.exposures.filter(e => e.outcome === 'pos').length, 0);
    if (profile.concluded) { profile.stage = profile.concluded.kind; return profile; }
    const disc = discoverySet().map(d => profile.candidates[d.id]).filter(Boolean);
    const confirmedDisc = disc.filter(c => c.status === 'confirmed');
    if (!profile.primary && confirmedDisc.length) {
      // the primary is the most consistent confirmed discovery candidate; ties → first confirmed
      profile.primary = confirmedDisc.slice().sort((a, b) => posRate(b) - posRate(a))[0].id;
    }
    if (!profile.primary) {
      const allDecided = discoverySet().every(d => profile.candidates[d.id] && decided(profile.candidates[d.id]));
      if (allDecided || profile.counts.valid >= CONFIG.maxValidExposuresNoResponder) { profile.concluded = { kind: 'concluded_none', at: profile.counts.valid }; profile.stage = 'concluded_none'; return profile; }
      profile.stage = cs.some(c => c.status === 'promising') ? 'replication' : 'discovery';
      return profile;
    }
    const primary = profile.candidates[profile.primary];
    if (primary.params.type === 'bbn') {
      // a broadband responder has no frequency to refine: straight to the control challenge
      profile.locked = { ratio: null, bw: null, mod: null }; profile.stage = 'control';
    } else {
      // one variable at a time; a stage completes when every grid point is decided
      if (profile.locked.ratio == null) {
        profile.stage = 'refine_freq';
        const ring = neighbours(primary.params.ratio).map(r => profile.candidates[cid(NBN(r, primary.params.bw, primary.params.mod))]);
        if (ring.every(c => c && decided(c))) {
          const pool = [primary, ...ring.filter(c => c.status === 'confirmed')];
          const best = pool.slice().sort((a, b) => posRate(b) - posRate(a))[0];   // moves only for a CONFIRMED, more consistent neighbour
          profile.locked.ratio = (best !== primary && posRate(best) > posRate(primary)) ? best.params.ratio : primary.params.ratio;
        }
      }
      if (profile.locked.ratio != null && profile.locked.bw == null) {
        profile.stage = 'refine_bw';
        const grid = CONFIG.bandwidthGrid.map(b => profile.candidates[cid(NBN(profile.locked.ratio, b, 0))]);
        const others = grid.filter((c, i) => CONFIG.bandwidthGrid[i] !== CONFIG.defaultBandwidthOct);
        if (others.every(c => c && decided(c))) {
          const base = profile.candidates[cid(NBN(profile.locked.ratio, CONFIG.defaultBandwidthOct, 0))];
          const pool = [base, ...others.filter(c => c.status === 'confirmed')].filter(Boolean);
          const best = pool.slice().sort((a, b) => posRate(b) - posRate(a))[0];
          profile.locked.bw = best && best !== base && posRate(best) > posRate(base || { exposures: [] }) ? best.params.bw : CONFIG.defaultBandwidthOct;
        }
      }
      if (profile.locked.bw != null && profile.locked.mod == null) {
        profile.stage = 'refine_mod';
        const others = CONFIG.modulationGrid.filter(m => m !== 0).map(m => profile.candidates[cid(NBN(profile.locked.ratio, profile.locked.bw, m))]);
        if (others.every(c => c && decided(c))) {
          const base = profile.candidates[cid(NBN(profile.locked.ratio, profile.locked.bw, 0))];
          const pool = [base, ...others.filter(c => c.status === 'confirmed')].filter(Boolean);
          const best = pool.slice().sort((a, b) => posRate(b) - posRate(a))[0];
          profile.locked.mod = best && best !== base && posRate(best) > posRate(base || { exposures: [] }) ? best.params.mod : 0;
        }
      }
      if (profile.locked.mod != null) profile.stage = 'control';
    }
    if (profile.stage === 'control') {
      const done = profile.controlPairs.filter(p => p.complete);
      if (done.length >= CONFIG.controlPairsRequired) {
        const c = evaluateControl(profile); profile.control = c;
        // a directional or clearly non-specific result concludes; "inconclusive with the candidate ahead"
        // may keep testing (more pairs) up to controlPairsMax, then concludes as inconclusive
        const keepTesting = c.outcome === 'control_better_or_inconclusive' && c.candidate_pos > c.control_pos && done.length < CONFIG.controlPairsMax;
        if (!keepTesting) { profile.concluded = { kind: 'concluded_control', outcome: c.outcome, at: profile.counts.valid }; profile.stage = 'concluded_control'; }
      }
    }
    return profile;
  }

  // ---------- session planning ----------
  // Returns the ordered candidate ids for today's session. Deterministic for (profile, sessionIndex).
  function planSession(profile, opts) {
    const F = opts.tinnitusHz, sr = opts.sampleRate || 48000, exclude = new Set(opts.exclude || []);
    const seed = seedFrom(`${profile.anonymous_user_id}:${profile.counts.sessions}`);
    const ok = c => !exclude.has(c.id) && c.status !== 'avoid' && feasible(c.params, F, sr);
    if (profile.counts.sessions === 0) {
      const ids = FIRST_SESSION().filter(id => { const p = parse(id); return feasible(p, F, sr); });
      ids.forEach(id => ensureCandidate(profile, parse(id), 'discovery'));
      return { stage: 'discovery', isFirst: true, queue: shuffle(ids, seed), kind: 'discovery' };
    }
    recompute(profile);
    const stage = profile.stage;
    if (stage.startsWith('concluded')) return { stage, isFirst: false, queue: [], kind: 'none' };
    if (stage === 'discovery' || stage === 'replication') {
      discoverySet().forEach(d => ensureCandidate(profile, d.params, 'discovery'));
      const disc = discoverySet().map(d => profile.candidates[d.id]).filter(ok);
      const replicate = disc.filter(c => c.status === 'promising');           // never optimise on one good response
      const fresh = disc.filter(c => c.status === 'untested');
      const open = disc.filter(c => c.status === 'testing');
      const queue = [...shuffle(replicate.map(c => c.id), seed), ...shuffle(fresh.map(c => c.id), seed + 1), ...shuffle(open.map(c => c.id), seed + 2)].slice(0, CONFIG.returningTrials);
      return { stage, isFirst: false, queue, kind: replicate.length ? 'replication' : 'discovery' };
    }
    if (stage === 'refine_freq' || stage === 'refine_bw' || stage === 'refine_mod') {
      const grid = gridFor(profile).map(p => ensureCandidate(profile, p, stage)).filter(ok).filter(c => !decided(c));
      return { stage, isFirst: false, queue: shuffle(grid.map(c => c.id), seed).slice(0, CONFIG.returningTrials), kind: 'refinement' };
    }
    if (stage === 'control') {
      const best = bestCandidate(profile), ctrl = controlFor(profile);
      if (!best || !ctrl) return { stage, isFirst: false, queue: [], kind: 'none' };
      const c = ensureCandidate(profile, ctrl, 'control');
      if (!ok(best) || !ok(c)) return { stage, isFirst: false, queue: [], kind: 'none' };
      return { stage, isFirst: false, queue: shuffle([best.id, c.id], seed), kind: 'control', pair: { candidate: best.id, control: c.id } };
    }
    return { stage, isFirst: false, queue: [], kind: 'none' };
  }

  // Apply a finished trial (valid or not) to the profile.
  function recordTrial(profile, trial) {
    const c = ensureCandidate(profile, trial.candidate_params, trial.candidate_role || 'discovery');
    c.exposures.push({ trial_id: trial.trial_id, session_id: trial.session_id, outcome: outcomeOf(trial), ri: trial.ri_duration_seconds, adverse: !!trial.adverse_response, magnitude: trial.immediate_response_category });
    profile.counts.trials++;
    if (trial.control_pair) {
      let pair = profile.controlPairs.find(p => p.session_id === trial.session_id);
      if (!pair) { pair = { session_id: trial.session_id, candidate: trial.control_pair.candidate, control: trial.control_pair.control, results: {}, complete: false }; profile.controlPairs.push(pair); }
      if (trial.trial_valid !== false) { pair.results[c.id] = outcomeOf(trial); pair.ri = pair.ri || {}; pair.ri[c.id === pair.candidate ? 'candidate' : 'control'] = typeof trial.ri_duration_seconds === 'number' ? trial.ri_duration_seconds : null; }
      pair.complete = !!(pair.results[pair.candidate] && pair.results[pair.control]);   // an invalid trial never completes a pair
    }
    return recompute(profile);
  }
  function closeSession(profile) { profile.counts.sessions++; return recompute(profile); }

  // ---------- summaries (kept as separate dimensions — no composite score in V1) ----------
  function median(xs) { if (!xs.length) return null; const s = xs.slice().sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function summarize(profile) {
    const cs = Object.values(profile.candidates);
    const validEx = cs.flatMap(c => c.exposures.filter(e => e.outcome !== 'invalid'));
    const pos = validEx.filter(e => e.outcome === 'pos');
    const durs = pos.map(e => e.ri).filter(x => typeof x === 'number');
    const tested = cs.filter(c => c.exposures.some(e => e.outcome !== 'invalid')).length;
    const mostConsistent = cs.filter(c => c.exposures.filter(e => e.outcome !== 'invalid').length >= 2).slice().sort((a, b) => posRate(b) - posRate(a) || b.exposures.length - a.exposures.length)[0] || null;
    const stageIndex = profile.stage === 'discovery' ? 0 : (profile.stage === 'replication' ? 1 : 2);
    const patterns = [];
    if (profile.concluded && profile.concluded.kind === 'concluded_none') patterns.push('no_reproducible_ri_detected');
    const confirmed = cs.filter(c => c.status === 'confirmed');
    if (confirmed.length) {
      const bbn = profile.candidates.bbn;
      if (profile.control) { if (profile.control.outcome === 'candidate_specific_response') patterns.push('parameter_specific_responder'); else if (profile.control.outcome === 'broad_or_nonspecific_response') patterns.push('broad_ri_responder'); }
      else if (bbn && bbn.status === 'confirmed' && confirmed.some(c => c.params.type === 'nbn')) patterns.push('broad_ri_responder');
      else if (confirmed.some(c => c.params.type === 'nbn') && bbn && bbn.status === 'inactive') patterns.push('parameter_specific_responder');
      if (pos.length && pos.filter(e => e.magnitude === 'much-quieter').length / pos.length >= 0.5) patterns.push('strong_ri_responder');
      if (durs.length && median(durs) >= 300) patterns.push('prolonged_ri_responder');
    }
    if (validEx.length >= 3 && validEx.filter(e => e.outcome === 'neg').length / validEx.length >= 0.3) patterns.push('residual_excitation_tendency');
    return { sessions: profile.counts.sessions, tested, reductions: pos.length, valid: validEx.length, worsening: validEx.filter(e => e.outcome === 'neg').length,
      longestRi: durs.length ? Math.max(...durs) : null, medianRi: median(durs), durCount: durs.length, durRange: durs.length >= 2 ? [Math.min(...durs), Math.max(...durs)] : null,
      control: profile.control || null,
      mostConsistent: mostConsistent ? { id: mostConsistent.id, pos: mostConsistent.exposures.filter(e => e.outcome === 'pos').length, valid: mostConsistent.exposures.filter(e => e.outcome !== 'invalid').length } : null,
      stage: profile.stage, stageIndex, patterns, concluded: profile.concluded ? profile.concluded.kind : null };
  }

  // Plain words for a candidate (used only in Experiment Details, never during testing)
  function describe(params, F) {
    if (params.type === 'bbn') return 'Broadband noise (a wide, even hiss)';
    const where = params.ratio === 1 ? 'at your matched pitch' : params.ratio < 1 ? `${Math.round((1 - params.ratio) * 100)}% below your matched pitch` : `${Math.round((params.ratio - 1) * 100)}% above your matched pitch`;
    const band = bwKey(params.bw) === '1/6' ? 'very narrow' : bwKey(params.bw) === '1' ? 'wide' : 'narrow';
    return `${params.mod ? `Pulsing (${params.mod}×/s) ` : ''}${band} band of noise ${where}${F ? ` (${Math.round(F * params.ratio).toLocaleString('en-US')} Hz)` : ''}`;
  }

  // Test-only overrides (the runtime allows them on localhost only). Trials recorded under them
  // are stamped "-test" so they can never be mistaken for protocol data.
  function configure(overrides) { Object.assign(CONFIG, overrides); testMode = true; }
  const version = () => PROTOCOL_VERSION + (testMode ? '-test' : '');

  return { PROTOCOL_VERSION, ALGORITHM_VERSION, CONFIG, CONTROL_OUTCOMES, CONTROL_RULE, version, configure, cid, parse, NBN, discoverySet, FIRST_SESSION, stimulus, feasible, newProfile, ensureCandidate, evalCandidate, recompute, planSession, recordTrial, closeSession, summarize, describe, bestCandidate, controlFor, evaluateControl, shuffle, seedFrom, outcomeOf, isTestMode: () => testMode };
});
