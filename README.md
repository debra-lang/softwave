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
- `lab.js`     — Experiments / The Lab: 29 optional experiments (adaptive journeys, living sound, morphing, frequency painting,
               sculpting, notched + modulated sound, mixing-point finder, discovery/A-B learning, spatial + moving sound, timelines,
               sleep journeys, eyes-closed mode…) with local feedback, history and a preference profile. See RESEARCH.md.
- `visuals.js` — audio-reactive background (waves, rings, particles, rain) and tone spectrum visualiser
- `app.js`    — UI, presets, Find My Sound wizard, local persistence (localStorage only), PWA install
- `sw.js`, `manifest.webmanifest`, `icons/` — offline support and installability

## Deep-link / dev flags
`#sounds #focus #mixer #frequency #match #sleep #learn`, `?welcomed` skips onboarding, `?theme=dark|light`, `?focus=<visual id>` opens Focus Mode directly, `?exp=<experiment id>` opens an experiment.

## Safety defaults
Master starts at 35% (never restored above 60%), all sounds fade in over ~1.2 s, tones are trimmed,
a soft limiter prevents spikes when layering, and a warning shows above 75% master.

Sources used for guidance copy: NIDCD, American Tinnitus Association, AAO-HNS Clinical Practice
Guideline: Tinnitus (2014), WHO-ITU safe-listening standard.

## SEO pages and measurement
- `site-content.js` + `build-site.js` generate the crawlable landing pages (`/tinnitus-sound-generator/` …), the Learn library (`/learn/...`),
  trust pages, `sitemap.xml`, `robots.txt`, `404.html` and `og-image.png`. Run `node build-site.js` after editing content, then commit.
- `SEO-AUDIT.md` — audit, keyword/intent map and competitor notes. `RESEARCH.md` — evidence notes for experiments.
- **Search Console / Bing Webmaster:** paste the verification tokens into `VERIFY` in `build-site.js`, rebuild, deploy, then submit
  `https://findmyquietsound.com/sitemap.xml` in both consoles. Bing: run `node indexnow.js` after each deploy (key file is committed).
- **Analytics:** none installed. To add cookie-free page stats, put the snippet in `ANALYTICS` in `build-site.js` (static pages) and in `index.html`;
  never log health information, tinnitus frequencies or matching results.
- **What to watch:** impressions/clicks/queries per page and CTR in Search Console; indexed pages (sitemap report); Core Web Vitals (CrUX);
  engagement with the tool (e.g. a single "sound played" event counter if analytics are added).
- Moving to a custom domain: change `SITE`/`BASE` in `build-site.js`, the canonical/OG URLs in `index.html`, `HOST`/`BASE` in `indexnow.js`, rebuild.
