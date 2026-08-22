# Softwave — Tinnitus Sound Studio

A calm, installable web app (PWA) that helps people with tinnitus find comfortable
external sounds. Sound masking, relaxation and comfort — **not** a diagnosis, treatment or cure.

## Run it
Any static web server works (audio is generated in-browser; no audio files needed):

    python -m http.server 8765 --directory TinnitusSoundStudio
    # then open http://localhost:8765

Serve over HTTPS (or localhost) for the service worker / "Install app" to be available.

## Files
- `index.html` — structure and all copy (onboarding, Safe Listening, When to Talk to a Professional, disclaimer)
- `styles.css` — light/dark themes, responsive layout
- `audio.js`  — Web Audio engine: 14 synthesised sounds (seamless pre-roll-crossfaded noise loops + LFO/event textures),
               5-channel mixer with per-sound volume/balance, limiter, frequency/tone generator, sleep timer with fade
- `focus.js`   — Visual Focus: 32 procedural Canvas visuals (Nature / Abstract / Sound Reactive / Interactive / Focus Activities / Breathing),
               full-screen Focus Mode with auto-hiding controls, pairings, saved combinations, movement level + Reduce Motion
- `visuals.js` — audio-reactive background (waves, rings, particles, rain) and tone spectrum visualiser
- `app.js`    — UI, presets, Find My Sound wizard, local persistence (localStorage only), PWA install
- `sw.js`, `manifest.webmanifest`, `icons/` — offline support and installability

## Deep-link / dev flags
`#sounds #focus #mixer #frequency #match #sleep #learn`, `?welcomed` skips onboarding, `?theme=dark|light`, `?focus=<visual id>` opens Focus Mode directly.

## Safety defaults
Master starts at 35% (never restored above 60%), all sounds fade in over ~1.2 s, tones are trimmed,
a soft limiter prevents spikes when layering, and a warning shows above 75% master.

Sources used for guidance copy: NIDCD, American Tinnitus Association, AAO-HNS Clinical Practice
Guideline: Tinnitus (2014), WHO-ITU safe-listening standard.
