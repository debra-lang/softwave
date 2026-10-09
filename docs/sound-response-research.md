# Sound Response — research and design notes

Internal engineering/research document for the Sound Response Lab ("Discover What Changes Your
Tinnitus"). Not linked from the consumer UI. Describes what V1 does and why, what is evidence, what
is an FMQS design decision, and what remains a hypothesis. **Nothing in this document changes the
implementation.** Where a future change is described it is a candidate for review, not a plan.

- Protocol: `RI-WEB-V1.0` · Algorithm: `RI-ADAPT-V1.1` · Code: `ri-protocol.js` (pure logic), `ri.js` (runtime)
- Last reviewed: 2026-09-26 (branch `ri-lab`, build v246)

The consumer promise this document serves: **Listen → Tell us what happened → We learn → Continue
another time.** Complexity belongs in the engine and the profile, not in the user's workflow.

---

## 0. Three categories, kept apart

Every statement below is tagged with one of:

| Tag | Meaning |
|---|---|
| **[E] Evidence-supported** | Reasonably supported by published research. |
| **[D] Design decision** | A choice FMQS makes for usability, safety, consistency or engineering reasons. Not a validated threshold. Never to be presented to users as science. |
| **[H] Hypothesis to test** | Something FMQS may investigate with future observations. Not established. |

The reason this matters: implementation constants drift into "facts" unless the boundary is written
down. Every number in `CONFIG` is **[D]** unless this document says otherwise.

---

## 1. Background: residual inhibition

- **[E]** Residual inhibition (RI) — a temporary reduction of tinnitus after a sound stops — is a
  well-documented phenomenon reported in a large share of people with tinnitus, typically lasting
  seconds to minutes and occasionally longer.
- **[E]** RI is more likely, and often deeper, when the sound has energy near the tinnitus pitch
  region, and it usually requires the sound to be presented above the level at which it just masks
  the tinnitus. **FMQS does not use masking-level or above-masking presentation** — see §4 — so V1
  should be expected to under-detect RI relative to clinic procedures. That is a deliberate safety
  trade-off **[D]**.
- **[E]** Some studies report more RI with amplitude-modulated sounds than with unmodulated noise;
  rates around 40 Hz and around 10 Hz have both been studied. The literature does not establish an
  optimal rate.
- **[E]** RI is temporary. Repeatedly inducing it has **not** been shown to change untreated
  tinnitus over time. Any longitudinal question is separate (§12).
- **[E]** Self-administered tinnitus pitch matching agrees with clinic matching only approximately
  (about half an octave in a majority of cases); octave confusion is common. FMQS's matcher includes
  an octave check and an optional three-match refinement for this reason.

---

## 2. What V1 measures, and why

| Measure | Why it exists | Tag |
|---|---|---|
| **Session baseline** (0–10 noticeability + "compared with usual") before any sound | RI is a change *from* something; the session-level baseline anchors the day and is the variable a future Phase II would track over time. | [E] for the need of a baseline; the 0–10 scale is [D] |
| **Trial baseline** (0–10) immediately before each sound | Tinnitus fluctuates within a session; a per-trial baseline lets each response be read against its own starting point, and gates the next trial (§4). | [E] fluctuation; gating rule [D] |
| **Immediate categorical response** (much quieter / a little quieter / about the same / louder / not sure) after a standardised 5 s silence | The primary observation. Categories are coarse on purpose: easy to answer once a minute, no forced precision, and "not sure" is a legitimate answer. | [D] |
| **Post-stimulus 0–10 rating** | Already collected (see §5 — this is *not* a future item), optional, preset to the trial baseline. Currently descriptive only; the engine does not use it. | [D] |
| **RI duration** (seconds from sound end to "back to my usual level"), timed silently | Duration is a standard RI dimension in the literature; hiding the clock avoids the user consciously extending it. | [E] dimension; hidden timer [D] |
| **Repeatability** (per candidate, across separate sessions) | One response can be fluctuation or expectation; the engine never optimises on a single response (§9). | [E] that single responses are unreliable; threshold [D] |
| **Adverse / worsening response** (louder; uncomfortable; "it became louder" during tracking) | Residual excitation exists; sounds that worsen tinnitus must be retired, never explored toward. | [E] existence; rules [D] |
| **Response across acoustic parameters** (frequency ratio, bandwidth, modulation) | Individual differences in which sounds produce RI are the whole point of an individualised search. | [E] individual differences; search grid [D] |
| **Comparison / control response** | Distinguishes a parameter-specific response from a general response to sound or from expectation (§10). | [D] |

**Why no composite "RI score" [D].** Magnitude, duration, repeatability and worsening are different
things. A person may show strong but unrepeatable responses, or repeatable but brief ones, or a
mixture with occasional worsening. Collapsing them into one number would hide exactly the pattern a
future analysis needs, and would invite a false sense of precision from a handful of self-reports.
V1 therefore reports the dimensions separately (`summarize()` in `ri-protocol.js` returns counts,
medians, ranges and a control outcome, never a score). If a composite is ever justified it must be
derived from real observations and documented here first.

---

## 3. Current acoustic search space (exact, from the implementation)

**Discovery candidates** (`discoverySet()`):

| Candidate id | Stimulus |
|---|---|
| `nbn\|1.00\|1/3\|0` | ⅓-octave narrow-band noise centred at 1.00 × matched pitch |
| `nbn\|0.80\|1/3\|0` | ⅓-octave narrow-band noise at 0.80 × |
| `nbn\|1.20\|1/3\|0` | ⅓-octave narrow-band noise at 1.20 × |
| `bbn` | broadband noise, 100 Hz – 12 000 Hz (upper edge capped at 0.45 × sample rate) |
| `nbn\|1.00\|1/3\|40` | ⅓-octave narrow-band noise at 1.00 ×, 100 % amplitude modulation at 40 Hz **[D]** — included as an exploratory condition based on prior modulated-sound studies; not an established optimal rate |

**First session** `FIRST_SESSION()`: 1.00 ×, 0.80 × and broadband, in a seeded counterbalanced order
(`seedFrom(anonId:sessionIndex)`, mulberry32). Three tests, not five **[D]** (usability). The
remaining discovery candidates (1.20 ×, 40 Hz AM) enter in later sessions.

**Stimulus construction**: seeded white noise → two cascaded band-pass biquads (Q = 1/(2^(b/2) −
2^(−b/2)); ⅓ octave → Q ≈ 4.32) or high-pass 100 Hz + low-pass 12 kHz for broadband → optional AM
(0.5 + 0.5·sin, identical in both ears — never binaural beats) → gain. Every stimulus is
**level-matched by equal RMS** to broadband at the user's chosen level (OfflineAudioContext
measurement), not equal loudness **[D]**. The level control tops out at `levelMaxGain` 0.6 before
matching and nothing in the engine ever raises it **[D, safety]**.

**Timing and recovery rules** (all **[D]**):

| Rule | Value | Where |
|---|---|---|
| Exposure | 60 s, fixed in V1 (0.3 s fades inside it) | `stimulusSeconds`, `fadeSeconds` |
| Quiet gap before the question | 5 s | `quietGapSeconds` |
| Pause allowed | up to 15 s cumulative; longer invalidates the trial | `pauseMaxSeconds` |
| Rest before the next baseline | 45 s minimum | `minRestSeconds` |
| Trial baseline tolerance | must be within ±2 of the session baseline; one wait, a second miss ends the session | `baselineTolerance` |
| Prolonged reduction | still present at 15 min → recorded, session ends | `prolongedRiSeconds` |
| No answer during tracking | 30 min → duration unknown, session ends | `riTimeoutSeconds` |
| Louder response | not repeated that day; two → candidate retired; one uncomfortable → session ends and candidate retired | `avoidAfterLouder`, runtime |
| Returning sessions | 1–3 sounds | `returningTrials` |

**Future refinement dimensions** (present in the engine as later stages; nothing new is activated):

| Dimension | Current grid | Stage |
|---|---|---|
| Centre frequency | ratios 0.70 … 1.30 in steps of 0.10; only the two neighbours of a confirmed ratio are tested | `refine_freq` |
| Bandwidth | ⅙, ⅓ (default), 1 octave | `refine_bw` |
| Modulation | 0, 10, 40 Hz | `refine_mod` |
| Exposure duration | **not explored in V1** — fixed at 60 s so frequency, bandwidth and modulation are never confounded with duration | later phase |

---

## 4. What V1 deliberately does not do [D]

- No masking-level or above-masking presentation, no loudness matching, no SPL claims: browser gain
  and device volume are unknown quantities and are stored only as metadata.
- No automatic volume escalation, ever — including when a sound produces no response.
- No stimulus outside the predefined candidate space; no generated or AI-chosen sounds.
- No treatment, cure, improvement or "works for you" language anywhere in the product.

---

## 5. FUTURE CANDIDATE — quantitative post-sound rating (requires UX and protocol review)

**Status of what exists today.** V1 already asks a 0–10 noticeability rating right after the
categorical response (`post_stimulus_rating`), **preset to the trial baseline** and skippable
(`null` when skipped). It is stored on every trial but is *not* used by the engine and is not
summarised anywhere.

**The candidate.** Treat the pair as a quantitative measurement:

```
Pre  (trial_baseline):        7
Post (post_stimulus_rating):  3
Observed change:             −4
Return to usual level:        63 s
```

**Open questions before adoption:**
1. Burden — a second scale on every trial, sessions of up to three trials, sessions repeated for
   weeks. Manual testing should judge whether it is answered honestly or tapped through.
2. Anchoring — the current preset (the trial baseline) biases toward "no change". An unset slider
   would be more honest but adds a required interaction (the same "move the slider" gate as the
   baselines). Changing the preset is a protocol change and needs a version bump.
3. Interpretation — a change of −4 on an 11-point self-report is not a measurement of tinnitus
   loudness; it is a change in reported noticeability. Wording in any profile must say so.
4. Relationship to the categorical answer — the two can disagree ("a little quieter" with pre 7 /
   post 7). Neither should overwrite the other; both are raw observations.

**Categorical response stays [D].** Even with a quantitative rating, *much quieter / a little
quieter / about the same / louder / not sure* remain the primary answer: they are fast, they carry
direction and certainty in one tap, and **"not sure" must remain a legitimate response that is never
converted into a number.**

**Architecture check.** Nothing blocks this: the field exists, `finishTrial()` already writes it,
and `summarize()` can add a derived change without touching stored rows. The only change with
protocol implications is the preset.

---

## 6. Tinnitus-character-aware exploration [H]

**Hypothesis.** Different starting search spaces may suit different percepts:

| Percept (as captured) | Possible future starting emphasis |
|---|---|
| Predominantly tonal ("Ringing (pure tone)", "Whistling / narrow hiss") | frequency-centred exploration (ratio grid first) |
| Predominantly noise-like ("Hissing") | bandwidth / noise-shape exploration first |
| "Humming / buzzing" | unclear; treat as its own group until observations say otherwise |

**This is not a current rule.** V1 chooses the same discovery set for everyone.

**Is the information already available?** Partly, yes:

- The Find My Tinnitus Sound record (`softwave:match`) stores `freq`, `type` ∈ {`sine`, `narrow`,
  `hiss`, `soft`}, `balance` (−1 / 0 / 1 = left / both / right), `when`, and — after the optional
  three-match refinement — `matches[3]`, `estimate`, `spread` (octaves). **No schema change is
  needed** to read the character.
- Sound Response already copies `type` into every trial as `tinnitus_characteristics` and into the
  session as `tinnitus.type`, and `balance` as `tinnitus_location`.
- Gap: when the pitch comes from Personalized Notched Sound instead (`notch:measures`), there is no
  character field, so `tinnitus_characteristics` is `null`. Match `spread` (how consistent the three
  matches were) is not copied into trials.

**What a future selection rule would need** (not built): `planSession(profile, opts)` takes only
`tinnitusHz`, `sampleRate` and `exclude`; the first-session list is a constant; candidate ids carry
no "search-space variant" tag. Adding a character input is a small, contained change — but it is an
algorithm change and would require `RI-ADAPT-V1.2` and this document to be updated together.

---

## 7. Data model — raw observations are preserved

Storage is local only (`localStorage`, keys `softwave:ri:*`), per the FMQS privacy architecture. No
server transmission; analytics carries product-funnel events only, never ratings, responses or
parameters. Records are append-only: `ri:trials` and `ri:sessions` are never rewritten by the
engine; `ri:profile` is derived state that could be rebuilt from the trials.

### 7.1 Fields stored on every trial (`ri:trials[]`)

| Requested | Stored as | Notes |
|---|---|---|
| anonymous experiment/session id | `anonymous_user_id`, `session_id`, `trial_id` | random local ids; no personal data |
| protocol version | `protocol_version` | `RI-WEB-V1.0`; `-test` suffix under localhost timing overrides |
| algorithm version | `algorithm_version` | `RI-ADAPT-V1.1` |
| trial number | **derivable, not stored as a field** — `ri:sessions[].trials` is the ordered list of trial ids; `timestamp` orders trials globally | gap noted in §7.3 |
| timestamp | `timestamp` (start), `ended` (record written) | ISO strings |
| tinnitus-match frequency | `tinnitus_frequency` | Hz, copied at session start |
| tinnitus character | `tinnitus_characteristics` (`sine`/`narrow`/`hiss`/`soft` or `null`), `tinnitus_location` | see §6 |
| stimulus family | `stimulus_type` (`narrowband_noise`, `narrowband_noise_am`, `broadband_noise`), `candidate_id`, `candidate_params` | |
| centre frequency | `center_frequency_hz` (`null` for broadband) | |
| ratio to tinnitus | `frequency_ratio_to_tinnitus` | |
| bandwidth | `bandwidth_parameters {octaves, q, stages}`, `filter_edges {lo_hz, hi_hz}` | exact filter parameters |
| modulation | `modulation_type`, `modulation_frequency_hz` | |
| exposure duration | `stimulus_duration_seconds` (planned), `stimulus_played_seconds` (measured), `paused_seconds`, `quiet_gap_seconds` | |
| pre-trial baseline | `trial_baseline`; also `session_baseline {rating, vs_usual, at}` on every row | |
| categorical response | `immediate_response_category` | |
| post rating | `post_stimulus_rating` (`null` if skipped) | |
| RI duration | `ri_duration_seconds` (`null` when not sure / no answer), `returned_to_baseline` | |
| adverse / worsening | `adverse_response` (uncomfortable), `residual_excitation` ("it became louder" during tracking); `louder` is in the category | |
| validity / exclusion | `trial_valid`, `trial_invalid_reason` (`backgrounded`, `audio_interrupted`, `other_audio`, `paused_too_long`, `reload`, `stopped`, `audio_failed`, `left`) | invalid rows are kept, never counted |
| candidate / control identity | `candidate_role` (`discovery`, `refine_freq`, `refine_bw`, `refine_mod`, `control`), `control_pair {candidate, control}` | |
| session progression / stage | **on the session record**, not the trial row: `ri:sessions[].plan {stage, kind, queue, pair, isFirst}` | gap noted in §7.3 |
| level and device context | `level_matched` (`equal_rms_to_broadband`), `stimulus_gain`, `sample_rate`, `available_volume_metadata {level, gain, master_volume}`, `output_device_metadata_if_available {ua, touch, platform}` | metadata only; no SPL claim |
| uncertainty | `user_uncertain` | true for "not sure" and for "I'm not sure" during tracking |
| placeholders | `known_tinnitus_duration`, `somatic_modulation_if_known` (always `null`), `session_stopped`, `stop_reason` (always `false`/`null` on the trial row — the session record holds the real `stop_reason`) | reserved by the brief; not collected |

### 7.2 Session record (`ri:sessions[]`) and profile (`ri:profile`)

- Session: `session_id`, `started`, `ended`, `level`, `baseline {rating, vs_usual, at}`,
  `tinnitus {hz, source, type, location}`, `plan {stage, kind, queue, pair, isFirst}`, `qi`,
  `trials[]` (ordered ids), `avoid_today[]`, `stop_reason` (`done`, `user_stop`,
  `adverse_uncomfortable`, `prolonged_ri`, `ri_timeout`, `baseline_not_reestablished`,
  `audio_failed`, `left`, `no_trials`), `valid_trials`, `protocol_version`, `algorithm_version`.
- Profile: per-candidate `exposures[] {trial_id, session_id, outcome, ri, adverse, magnitude}` and
  `status`; `primary`; `locked {ratio, bw, mod}`; `controlPairs[] {session_id, candidate, control,
  results, ri, complete}`; `control` (evaluated outcome, counts, descriptive medians, rule text,
  algorithm version); `concluded`; `counts`.

### 7.3 Gaps found (reported, not changed)

1. **Rejected trial baselines are not recorded.** When a pre-sound rating falls outside ±2 of the
   session baseline, the app waits or ends the session, but the out-of-tolerance rating itself is
   discarded. It is an observation about within-session fluctuation that future analysis might want.
2. **No explicit trial index / session index on the trial row.** Both are derivable (session
   `trials[]` order; `profile.counts.sessions` at the time is *not* stored — session order is by
   `started`). A `trial_index` and `session_index` field would make rows self-describing.
3. **Stage at the time of the trial is on the session, not the trial.** Joinable via `session_id`;
   `candidate_role` gives the stage for refinement/control trials but discovery trials during the
   `replication` stage read as `discovery`.
4. **Timestamps inside the trial are not all preserved.** `stimulus_ended_at` and the moment of the
   response tap are used at runtime but only `timestamp` (start), `ended` and `ri_duration_seconds`
   survive. Recovery time after a "louder" answer ("It's back to usual") is not stored at all.
5. **Match refinement quality (`spread`, `matches`) is not copied into trials** — only `freq`.
6. **Pitch from Notched Sound carries no character** (`tinnitus_characteristics = null`).
7. **`session_stopped` / `stop_reason` on trial rows are constant placeholders**; the real values
   live on the session record.

None of these prevents analysis of what V1 collects; items 1 and 4 are the only ones where an
observation is actually lost. Any addition is a schema change and should be decided explicitly.

### 7.4 Calculated but not preserved as raw data

- Candidate `status` and `posRate` (recomputed from exposures — recoverable).
- Control comparison medians (`candidate_median_ri`, `control_median_ri`) — recoverable from
  pairs/trials.
- The seeded first-session order (recoverable from `anonymous_user_id` and session index, and
  visible in `plan.queue`).
- Nothing irrecoverable except the items in §7.3 (1) and (4).

---

## 8. Version integrity

- Every trial, session and the profile carry both `protocol_version` and `algorithm_version`.
- Test-timing overrides (localhost only) stamp `protocol_version` with `-test`, so they can never be
  mistaken for protocol data.
- `RI-ADAPT-V1.0` → `V1.1` changed only how the control challenge is *concluded*; because no real
  user data existed, profiles built under V1.0 are cleared on load rather than reinterpreted (see
  `ri.js`). **Rule for the future:** once real observations exist, a version bump must come with a
  written migration decision in this document — reinterpret, freeze, or keep separate — never a
  silent change.
- A future rule of thumb: bump `RI-WEB-` when the stimulus, timing, questions or safety wording
  change (what the person experienced); bump `RI-ADAPT-` when the choice of what to test next or how
  results are concluded changes.

---

## 9. Replication is a separate concept [D]

- **One positive response** makes a candidate *promising*. It is never optimised on.
- **A repeatable response** requires **2 positive responses in the first 3 valid exposures** of that
  candidate, across separate sessions (`replication: { positiveOf: 2, outOf: 3 }`). A candidate is
  decided *inactive* as soon as 2-of-3 becomes unreachable (e.g. two non-reductions).
- **This threshold is an FMQS design rule, not a clinically validated diagnostic threshold.** It
  balances the number of one-minute exposures a person will tolerate against the risk of chasing a
  single good day. One inactive candidate says nothing about whether the person shows RI at all.

---

## 10. The comparison / control challenge [D]

**Purpose.** Once a candidate is repeatable and its frequency, bandwidth and modulation have been
refined, the engine compares it with a matched comparison sound (broadband; or a distant 0.50 ×
narrow band when broadband itself is the candidate) in randomised pairs across separate sessions —
same duration, same level matching, generic labels. The question is only: *does the temporary
response appear more associated with the refined candidate, or do similar responses occur with the
comparison sound?*

**Rule (exact, `evaluateControl`)**, applied after ≥ 3 complete pairs and re-applied after each
further pair:

1. control positives > candidate positives → `control_better_or_inconclusive`
2. candidate positives ≥ 2 **and** candidate − control ≥ 2 → `candidate_specific_response`
3. candidate positives ≥ 2 and control positives ≥ 2 → `broad_or_nonspecific_response`
4. otherwise → `control_better_or_inconclusive`

Counts only. Durations are descriptive and never break a tie. An inconclusive result with the
candidate ahead may continue up to 6 pairs. A pair with an invalid trial is never complete.

**What it does not show:** treatment efficacy, placebo control, clinical benefit, mechanism, lasting
improvement. Three to six self-reported pairs cannot carry statistics and none are attempted.

---

## 11. Future Sound Response Profile — internal specification (not built)

A mature profile could communicate, in observational language only:

| Field | Source | Example (concept only) |
|---|---|---|
| Tinnitus match | `softwave:match` | "Match: 4,100 Hz, both ears (three matches within a quarter octave)" |
| Strongest repeated response | candidate with best pos-rate among confirmed | "Strongest repeated response: narrowband noise near your tinnitus match." |
| Stimulus family / frequency relationship | `candidate_params` | "Narrow band, about 20 % below your matched pitch" |
| Typical temporary change | median of (post − pre) where both exist | "Typically 2 points less noticeable right after the sound" (only if §5 is adopted) |
| Typical RI duration / observed range | median; min–max (3+ / 2+ observations) | "Typical duration 1:05 · observed 0:42–1:18" |
| Repeatability | pos / valid for that candidate | "Temporary reduction observed in 3 of 4 valid exposures." |
| Broadband response | `bbn` exposures | "Broadband noise: no repeatable change so far." |
| Modulation response | mod-stage candidates | "40-Hz modulation has not shown a clear advantage so far." |
| Comparison result | `profile.control.outcome` | "Comparison testing suggests the response may be more specific to the frequency-centred sound." / "…does not appear specific to one sound pattern." / "…isn't consistent enough yet." |
| Valid observations, last tested | trials | "12 valid observations · last tested 3 days ago" |
| Protocol / algorithm | versions | footer line |

**Persistent explanation (always shown):** *These results describe temporary responses you've observed
after sound. They do not show that a sound treats tinnitus or will produce lasting improvement.*

**Forbidden wording:** treatment found · therapeutic sound · effective treatment · optimal
treatment · tinnitus cure · clinically proven for you · works for you.

**Architecture check.** `summarize()` already exposes counts, medians, ranges, the most consistent
candidate, the control outcome and internal patterns; per-family roll-ups, "last tested" and a
typical-change figure would be new derived fields computed from existing rows — no schema change.
The current profile screen would need re-templating, not re-plumbing.

---

## 12. Phase II — longitudinal baseline (separate; not implemented)

- **Phase I question:** which controlled sounds are followed by repeatable temporary changes?
- **Phase II question:** does the person's *untreated* pre-session baseline change over weeks or
  months? This is a different question with a different design, and repeated RI is **not** evidence
  that it will.
- Variables already preserved that Phase II would need: `session_baseline {rating, vs_usual, at}`
  on every session and trial; accumulated valid exposures (from trials); response pattern over time
  (from exposures). Not collected and not to be added without separate review: contextual factors
  such as sleep or stress.
- Any Phase II display must graph the immediate post-sound response and the untreated pre-session
  baseline **separately**; a person may have excellent RI and no baseline change, which is a valid
  and important result.

---

## 13. No AI optimisation [D]

The adaptive engine is deterministic and auditable: every decision is a rule in `ri-protocol.js`
with a seed for ordering. No machine-learning stimulus generation, no unrestricted generated sounds,
no predictive treatment claims, no automatic clinical classification. Statistical modelling can be
considered only after sufficient real observations exist, and then as a documented, versioned rule.

---

## 14. Landscape: what already exists

Residual-inhibition testing is an established clinical and research procedure; FMQS did not invent
it, and FMQS is not the first adaptive or app-based RI system. Categories that already exist:

- simple RI tests (one sound, "is it quieter?");
- tinnitus-pitch-centred RI tests;
- RI-duration tracking;
- repeated RI assessment across sessions;
- frequency-dependent RI mapping (which frequency regions produce RI);
- amplitude-modulated versus unmodulated comparisons;
- individualised RI stimuli built from a person's tinnitus characteristics;
- adaptive spectral-weighting research;
- longitudinal repeated-RI research.

FMQS's differentiation is only what the product actually does: it lives inside a free sound app the
person already uses, reuses the existing pitch match, keeps every observation local, presents nothing
technical during testing, requires replication before any refinement, challenges its own conclusion
with a comparison sound, and is versioned and deterministic end to end.

---

## 15. Product principle

**Sound Response should become more scientifically informative as the user contributes observations,
without becoming more difficult to use.** The consumer experience stays *Listen → Tell us what
happened → We learn → Continue another time.* New measurement, richer profiles and later phases add
work for the engine and the profile — not steps for the user. Any proposal that adds a question to
the per-trial loop must justify its burden against the value of the observation.

---

## 16. Change log for this document

- 2026-09-26 — first version, alongside build v246 (`RI-WEB-V1.0`, `RI-ADAPT-V1.1`). No
  implementation changes.
