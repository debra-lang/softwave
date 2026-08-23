# Softwave — SEO audit (22 August 2026)

Site: https://debra-lang.github.io/softwave/ (GitHub Pages, static). Audit before changes, then what was done.

## Critical issues (found)
1. **Every feature lived behind `#hash` routes** (`#frequency`, `#sleep`, `#match` …). Google and Bing strip fragments, so the site had exactly one indexable URL and one title. *Fixed:* real, crawlable landing pages per tool + a Learn library, each with its own URL, title, description, canonical and structured data; the app keeps its hash views for in-app navigation.
2. **No robots.txt, sitemap.xml or canonical tags.** *Fixed:* all three, plus IndexNow key for Bing.
3. **Nothing crawlable described the product**: the homepage's visible text was "Find Your Sound" and card labels rendered by JavaScript; no static statement of what the tool is, who it is for, or how it works. *Fixed:* a semantic "About this tool" section on the homepage, plus tool pages that explain each feature in plain HTML.
4. **No structured data, no Open Graph / Twitter cards**, so shares showed a bare link. *Fixed:* WebSite + WebApplication + Organization on the homepage, Article/BreadcrumbList/FAQPage where visible, OG/Twitter tags and a share image on every page.
5. **Health topic with no trust pages**: no About, Research & Sources, Medical disclaimer, Privacy or Contact pages; articles undated. *Fixed:* trust pages, "Last reviewed" dates and source lists on every Learn article and tool page.

## High-priority opportunities
- **"tinnitus sound generator" / "tinnitus noise generator" / "free tinnitus sound generator" (tool intent).** Competing results are myNoise (strong but dated UI, one generator per page), tinnitusreliefapp, checkhearing. None combine a modern mixer, frequency tools and honest guidance. → `/tinnitus-sound-generator/`, `/tinnitus-sound-mixer/`.
- **"tinnitus frequency generator", "find my tinnitus frequency", "tinnitus tone generator", "tinnitus frequency matching" (frequency intent).** Results are generic tone generators (szynalski, tonetool) or neuromodulation sellers. A purpose-built, safety-first matcher with an octave check is differentiated. → `/tinnitus-frequency-generator/`, `/tinnitus-sound-matching/`, `/learn/tinnitus-frequency/`, `/learn/tinnitus-frequency-matching/`.
- **"white/pink/brown noise for tinnitus" and "white vs pink vs brown noise" (comparison intent).** Articles (WebMD, Soundly, audiology blogs) rank with no player. A page that explains *and* plays the sound, with the honest finding that studies show no clear winner, is better for the searcher. → three colour pages + `/learn/white-vs-pink-vs-brown-noise/`.
- **"sleep sounds for tinnitus", "how to sleep with tinnitus", "ringing in ears at night" (sleep intent).** Large informational demand (Sleep Foundation, Medical News Today) with no integrated timer/fade tool. → `/tinnitus-sleep-sounds/`, `/learn/tinnitus-and-sleep/`.
- **"ringing in ears" phrasing (14.8k/mo; people who do not use the word tinnitus).** → used naturally in titles/headings of masking and sleep pages.

## Medium-priority improvements (done)
- Unique titles/descriptions per page; H1/H2 hierarchy; alt text on images; descriptive link text ("Try brown noise", not "click here").
- Internal linking both ways: tool page → app deep link (`/?sound=brown`, `#frequency`, `#sleep`); app → "Learn about this sound →" links; Learn articles cross-link and link to the relevant tool.
- Performance: scripts `defer`red, fonts preconnected with `display=swap`, no images above the fold, fixed-height player bar (no CLS), noise synthesis moved to a Worker earlier (INP). Static pages carry no app JavaScript.
- 404 page, `theme-color`, `lang`, viewport, skip-link for keyboard users.

## Long-term opportunities (not done yet — need the owner)
- **Custom domain.** A `github.io` sub-path caps authority and shares reputation with every other GitHub Pages site. Moving to e.g. `softwave.app` is the single biggest long-term lever; all links here are relative to a `BASE` constant in `build-site.js` so the move is a one-line change.
- **Search Console / Bing Webmaster verification** need the owner's accounts: add the verification `<meta>` in `build-site.js` (`VERIFY` constants) and submit `sitemap.xml`. IndexNow key is ready (`indexnow-key`), submit with `node indexnow.js` after deploys.
- **Privacy-respecting analytics** (Plausible / GoatCounter style, no cookies, no health data) — snippet slot is in the template, off by default.
- **Earned mentions** from tinnitus communities and audiology blogs; AI answer engines weight third-party corroboration heavily. Never buy links.
- **Programmatic pages were considered and rejected**: per-frequency pages ("4000 Hz tinnitus") would be thin; per-sound pages exist only for the three noise colours where there is enough to say.

## Keyword & intent map (research summary)
| Intent | Queries | Page |
|---|---|---|
| Tool | tinnitus sound generator, tinnitus noise generator, online/free tinnitus sound generator, tinnitus masker, tinnitus sound app | `/tinnitus-sound-generator/`, homepage |
| Tool (mix) | tinnitus sound mixer, layer sounds for tinnitus, background noise for tinnitus | `/tinnitus-sound-mixer/` |
| Problem | sounds to mask ringing in ears, tinnitus masking sounds, how to cover ringing in ears, tinnitus relief sounds | `/tinnitus-masking-sounds/`, `/learn/tinnitus-sound-masking/` |
| Comparison | white noise for tinnitus, pink noise for tinnitus, brown noise for tinnitus, white vs pink vs brown noise tinnitus, best noise colour for tinnitus | colour pages, `/learn/white-vs-pink-vs-brown-noise/` |
| Frequency | tinnitus frequency generator, tinnitus tone generator, find my tinnitus frequency, what frequency is my tinnitus, tinnitus frequency matching, tinnitus pitch | `/tinnitus-frequency-generator/`, `/tinnitus-sound-matching/`, two Learn articles |
| Sleep | sleep sounds for tinnitus, tinnitus sounds for sleeping, how to sleep with tinnitus, ringing in ears at night | `/tinnitus-sleep-sounds/`, `/learn/tinnitus-and-sleep/` |
| Educational | what is tinnitus masking, how do tinnitus sound generators work, nature sounds vs white noise tinnitus, how loud should tinnitus masking be, headphones vs speakers tinnitus | Learn library |
| Non-"tinnitus" phrasing | ringing in ears sound, buzzing in ears noise machine, hissing in ears background sound | woven into headings of masking/sleep pages |

## Competitor notes
- **myNoise** — best-in-class generators, many pages rank; weaknesses: dense 2010s UI, little guidance on level/safety, no sleep journey, no matching with octave check.
- **szynalski / tonetool / uwarp tone generators** — rank for "tinnitus frequency" by accident; no tinnitus guidance, no safety caps.
- **checkhearing.org** — frequency finder and CR tone generator; promotes neuromodulation with thin evidence.
- **WebMD / Sleep Foundation / Healthline / MNT** — authority and breadth, zero interactivity; colour-noise articles are generic.
- **ReSound Relief / Oto** — app-store products; web pages are marketing, not tools.
- **Opportunity:** every "…for tinnitus" query where the top results are articles without a player, and every "…generator" query where the tool has no honest guidance.
