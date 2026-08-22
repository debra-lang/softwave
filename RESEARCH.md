# Softwave — Experiments research & gap analysis (August 2026)

This document records why each experiment exists, what field it comes from, the evidence level, and
what was deliberately *not* built. It is internal, but the "Why are we testing this?" text in the app is
derived from it.

Evidence scale used throughout
- **Established** — multiple RCTs / guideline support (for the underlying principle, not the app feature).
- **Promising** — at least one RCT or several controlled studies, effects modest or short-lived.
- **Exploratory** — small studies, pilots, mechanism papers, or strong evidence only in a neighbouring field.
- **Limited** — mostly theory, anecdote, or conflicting results.

## 1. What current tinnitus apps already do (audit)

| Feature | ReSound Relief | myNoise | Oto | Whist | Tonal Tinnitus Therapy | Tinnitus Balance | AudioNotch | BetterSleep / Calm-type |
|---|---|---|---|---|---|---|---|---|
| Sound library (noise + nature) | yes | 300+ scenes | 100+ | limited | noise colours | yes | — | large |
| Layering / mixing | up to 5 | 10 sliders per scene | basic | — | noise + tones | yes | — | yes |
| L/R balance | yes | some | — | yes | — | — | — | — |
| Sleep timer | yes | yes | yes | — | yes | yes | — | yes |
| Pitch matching | — | — | partial | yes (pitch + noisiness) | yes | — | yes | — |
| Notched sound / music | — | — | — | — | — | — | yes (core) | — |
| "Neuromodulation" tone patterns (ACRN) | — | — | — | — | yes (core) | — | — | — |
| Residual-inhibition mode | — | — | — | yes | — | — | — | — |
| Binaural beats / isochronic | — | yes | — | — | — | — | — | yes |
| CBT / mindfulness programme | coping skills | — | yes (core, RCT) | — | — | — | — | meditations |
| Breathing exercises | yes | — | yes | — | — | — | — | yes |
| Visuals while listening | minimal | minimal | — | — | — | — | — | video/scenes |
| Spatial / moving sound | — | some 3D scenes | — | — | — | — | — | — |
| Generative / non-looping sound | — | partly (layered loops) | — | — | — | — | — | — |
| Preference learning from feedback | — | — | partially | — | — | — | — | — |
| A/B comparison of settings | — | — | — | — | — | — | — | — |
| Time-evolving sessions (journeys) | — | animated scenes (slow mix drift) | guided sessions | — | — | — | — | sleep stories |
| Paint-your-own spectrum | — | 10 band sliders | — | — | — | — | — | — |
| Intermittent / near-silence modes | — | — | — | — | — | — | — | — |
| Attention / perceptual training | — | — | — | — | — | — | — | — |

**Common:** libraries, layering, timers, some CBT. **Rare:** pitch matching with octave check, notched sound, RI modes, spatial sound.
**Almost nowhere:** learning from the user's own comparisons, non-repeating generative sound, session designers that evolve over time,
mixing-point guidance (deliberately *not* masking), attention-training style visuals, sound you can draw, plain-language sound shaping.

**Problems competitors leave unsolved:** (1) loops become familiar and the brain re-notices tinnitus; (2) users are left to "try 300 sounds"
with no structured way to learn what they prefer; (3) volume guidance is generic — nobody helps find the *mixing point*; (4) visual/attention
side is an afterthought; (5) users who dislike constant masking have no minimal-sound options; (6) personalisation is marketing, not behaviour.

## 2. Research notes by field (what transferred into the product)

- **Residual inhibition** — temporary suppression after a sound stops; up to ~1/3 of people get complete RI briefly; duration scales with
  stimulus duration; amplitude-modulated sounds (10 Hz, 40 Hz) near the tinnitus pitch gave more suppression than unmodulated noise in
  exploratory studies (Neff et al. 2017/2019; Reavis et al. 2012 S-tones). → *Modulated Tone* experiment. Evidence: Exploratory. Short-lived by
  definition; clearly labelled.
- **Notched sound (TMNMT)** — Münster RCT: not superior to placebo on primary outcome, loudness reduction in secondary; 2022 RCT vs TRT:
  close to clinical significance; notch width (¼–1 octave) did not matter. → *Notched Sound*. Evidence: Limited/mixed.
- **Mixing point / partial masking (TRT)** — sound set just where it blends with tinnitus; mixing point and total masking were equally
  effective in one comparison, and the habituation rationale favours *not* masking. → *Mixing Point Finder*, *Near-Silence*. Evidence: Promising.
- **Intermittent masking** — theoretical/desensitisation rationale for sound that lets tinnitus "reappear" briefly in a relaxed state; sparse
  direct data. → *Minimal Sound*. Evidence: Limited — labelled.
- **Attention training** — RCT of a perceptual training game ("Terrain", Searchfield lab) gave clinically significant TFI reduction vs Tetris;
  multisensory attention training showed small but significant effects. → *Attention Activities*, *Attention Target*. Evidence: Promising.
- **Mindfulness / MBCT** — RCT (MBCT vs relaxation) both reduced tinnitus severity; mechanism is attention and appraisal, not loudness. → breathing
  and attention tools framed as relaxation, no loudness claims. Evidence: Established for distress.
- **Slow breathing ~6 breaths/min** — maximises HRV, reduces anxiety/arousal (meta-analyses). → *Breath-Synced Sound* (sound swells with the
  breathing guide). Evidence: Established for relaxation; novel pairing.
- **Spatially moving sound** — PLOS One 2024: panning / moving sounds improved relaxation and sustained attention more than control, and the
  effect came from the *spatial* attribute, not "beating". → *Spatial Sound*, *Moving Sound*. Evidence: Exploratory.
- **Binaural beats** — 2023 systematic review inconclusive (5 for / 8 against). Many apps sell them. **Deliberately not built** — low novelty,
  weak evidence.
- **Acoustic CR neuromodulation** — RESET2 inconclusive; proprietary. **Not built.**
- **Bimodal (tongue) stimulation (Lenire)** — device-based, FDA De Novo; not reproducible in a browser. Gentle optional haptics are offered
  *without* any claim. → *Sound + Touch* (haptics off by default).
- **Fractal tones (Widex Zen)** — chime-like non-repeating tones designed not to become memorised; controlled study showed large THI/TFI
  reductions as part of a full programme. → *Gentle Chimes* (a generative, never-repeating soft-tone layer). Evidence: Promising (as part of
  counselling programme); Exploratory alone.
- **VR nature relaxation** — audio + visual together relaxes more than either alone; beach/forest preferred; a VR tinnitus study found severity
  ratings fell during masking in virtual environments. → supports Visual Focus and *Sound Environments*. Evidence: Promising.
- **Stochastic resonance / noise and attention** — evidence for white/pink noise helping attention in ADHD; none specifically for brown. Copy
  avoids "brown noise helps focus" claims.
- **Closed-loop pink-noise pulses during slow-wave sleep** — real effect but requires EEG timing; **not built** (would be fake without EEG).
- **Self-administered pitch matching** — ~70% within half an octave of clinical matching *when octave confusion is checked*. → *Frequency Explorer*
  includes an octave check step. Evidence: Promising for the method; explicitly not a hearing test.
- **Hyperacusis** — gradual, low-level exposure; never push levels. → all experiments start quiet, *Near-Silence* exists for sensitive users.
- **Flicker / vestibular safety** — avoid 3–70 Hz flicker, rapid zoom, parallax; respect reduced motion. Applied to every visual.
- **What other industries taught us** — music production: macro knobs (one control moves many parameters) → *Sound Sculpting*, *Sound Morphing*;
  games: low-stakes attention loops without scores → *Attention Activities*; generative art: seeded slow variation → *Living Sound*; sleep tech:
  staged wind-down → *Sleep Journey*; accessibility: "still mode", eyes-closed mode; A/B testing from UX research → *A/B Sound Test*;
  recommender systems → *Sound Discovery* (pairwise preference learning, stored locally only).

## 3. Concept scoring (1–5; higher is better; "Exists" = already common in tinnitus apps)

| # | Concept | Novelty | Safety | Plausibility | Ease | Feasible | Value | Exists? | Decision |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Adaptive Sound Journey (slow evolving mix) | 4 | 5 | 4 | 5 | 5 | 5 | rare | build |
| 2 | Living Sound (generative micro-variation, predictability control) | 5 | 5 | 4 | 5 | 5 | 5 | rare | build |
| 3 | Frequency Explorer with octave check | 3 | 5 | 4 | 4 | 5 | 5 | some | build |
| 4 | Sound Morphing (one control across a continuum) | 5 | 5 | 3 | 5 | 5 | 4 | no | build |
| 5 | Frequency Painting (draw your spectrum) | 5 | 5 | 3 | 4 | 4 | 5 | no | build |
| 6 | Sound Sculpting (plain-language macro controls) | 4 | 5 | 3 | 5 | 5 | 4 | no | build |
| 7 | Attention Target (follow a slow object, sound follows it) | 4 | 5 | 4 | 5 | 5 | 4 | no | build |
| 8 | Sound + Touch (ripple + soft sound change + optional haptic) | 4 | 4 | 2 | 5 | 4 | 3 | no | build (haptics off) |
| 9 | Spatial Sound map | 4 | 5 | 3 | 4 | 4 | 4 | rare | build |
| 10 | Moving Sound (slow orbit) | 4 | 4 | 3 | 5 | 5 | 4 | no | build |
| 11 | Visual–Sound Synchronisation scene | 4 | 5 | 3 | 5 | 4 | 4 | no | build |
| 12 | Attention Activities (follow one, notice the change, count pulses) | 4 | 5 | 4 | 5 | 5 | 4 | no | build |
| 13 | Sound Discovery (Better/Same/Worse) | 5 | 5 | 3 | 5 | 5 | 5 | no | build |
| 14 | Personal Sound Profile (local) | 4 | 5 | 3 | 5 | 5 | 4 | no | build |
| 15 | A/B Sound Test | 5 | 5 | 4 | 5 | 5 | 5 | no | build |
| 16 | Surprise Me | 3 | 5 | 2 | 5 | 5 | 3 | rare | build |
| 17 | Sound Environments with intensity | 2 | 5 | 4 | 5 | 5 | 4 | common | build (cheap) |
| 18 | Minimal Sound (intermittent swells) | 4 | 4 | 2 | 5 | 5 | 3 | no | build, labelled limited |
| 19 | Near-Silence mode | 4 | 5 | 4 | 5 | 5 | 4 | no | build |
| 20 | Sound Recipes (ingredient blocks) | 3 | 5 | 3 | 5 | 5 | 3 | no | build |
| 21 | Sound Timeline editor | 4 | 5 | 4 | 3 | 4 | 5 | no | build |
| 22 | Dynamic Sleep Journey | 3 | 5 | 4 | 5 | 5 | 5 | rare | build |
| 23 | Depth Focus (slow flight through clouds/stars) | 3 | 4 | 3 | 5 | 5 | 3 | no | build with Motion Off |
| 24 | Eyes-Closed mode | 3 | 5 | 4 | 5 | 5 | 4 | no | build |
| 25 | One-Tap Session Builder | 3 | 5 | 3 | 5 | 5 | 5 | rare | build |
| 26 | Modulated Tone (residual-inhibition explorer, 10/40 Hz AM) | 4 | 4 | 3 | 4 | 5 | 4 | rare | build, labelled exploratory |
| 27 | Notched Sound (band-reject around region) | 3 | 5 | 2 | 4 | 5 | 3 | rare | build, labelled mixed |
| 28 | Mixing Point Finder | 5 | 5 | 4 | 5 | 5 | 5 | no | build |
| 29 | Breath-Synced Sound | 5 | 5 | 4 | 5 | 5 | 5 | no | build |
| 30 | Gentle Chimes (fractal-style generative tones) | 4 | 5 | 3 | 5 | 4 | 4 | rare | build |
| 31 | Binaural beats | 1 | 4 | 2 | 5 | 5 | 2 | common | **not built** |
| 32 | Acoustic CR-style tone patterns | 2 | 4 | 2 | 4 | 5 | 2 | exists | **not built** |
| 33 | Closed-loop sleep pulses | 5 | 3 | 4 | 2 | 1 (no EEG) | 3 | no | **not built** |
| 34 | Tongue/ear electrical stimulation | 5 | 1 | 4 | 1 | 0 | — | device | **not built** |
| 35 | Gamma-flicker visual entrainment | 3 | 1 | 2 | 3 | 5 | 1 | no | **not built** (flicker risk) |
| 36 | Voice-recorded tinnitus diary with mood | 2 | 4 | 3 | 4 | 3 | 3 | some | later |
| 37 | Heart-rate-adaptive audio (wearable) | 4 | 4 | 3 | 3 | 2 (no sensor API) | 3 | no | later |

Built first (highest novelty × usability): 2, 4, 5, 13, 15, 28, 29, 1, 21, 6, 3, 7, 9, 12 — then the rest of the "build" column.

## 4. Safety rules applied to every experiment
Start-up level ≤ 35 % master; every change is ramped (≥ 0.5 s; journeys ≥ 60 s); no experiment raises master volume; modulation never
exceeds audible-flutter rates chosen deliberately (4/10/40 Hz) and stays low-level; no flicker, strobe or rapid motion; Reduce Motion and
Still Mode honoured; Stop is always one tap away in the player bar and in every card; haptics off by default; nothing is uploaded — feedback
and profiles live in localStorage only.
