/* Find My Quiet Sound — static page content for the SEO build (build-site.js).
   Every page here is real, reviewed text; tool pages link into the app, Learn pages cite sources.
   Dates are "last reviewed" dates; update them when content changes. */
'use strict';

const REVIEWED = '2026-08-28';
const SRC = {
  nidcd: { t: 'NIDCD — Tinnitus (National Institute on Deafness and Other Communication Disorders)', u: 'https://www.nidcd.nih.gov/health/tinnitus' },
  ata: { t: 'American Tinnitus Association — Sound Therapy', u: 'https://www.ata.org/about-tinnitus/sound-therapy/' },
  aao: { t: 'AAO-HNSF Clinical Practice Guideline: Tinnitus (2014)', u: 'https://www.entnet.org/quality-practice/quality-products/clinical-practice-guidelines/tinnitus/' },
  who: { t: 'WHO-ITU standard: Safe listening devices and systems', u: 'https://www.who.int/publications/i/item/9789241515276' },
  cochrane: { t: 'Sound therapy (masking) in the management of tinnitus in adults — Cochrane Review (2018)', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7390392/' },
  mixing: { t: 'Tinnitus retraining therapy: mixing point and total masking are equally effective (JAAA, 2012)', u: 'https://pubmed.ncbi.nlm.nih.gov/22609540/' },
  bbn: { t: 'A mixed-methods trial of broad band noise and nature sounds for tinnitus therapy (2017)', u: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5343046/' },
  pitch: { t: 'Self-administered tinnitus pitch matching versus a conventional audiometric procedure (2017)', u: 'https://www.ncbi.nlm.nih.gov/pubmed/28423381' },
  okamoto: { t: 'Listening to tailor-made notched music reduces tinnitus loudness — Okamoto et al., PNAS (2010)', u: 'https://pubmed.ncbi.nlm.nih.gov/20080545/' },
  teismann: { t: 'Short and intense tailor-made notched music training against tinnitus — Teismann et al., PLoS ONE (2011)', u: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0024685' },
  wunderlich: { t: 'Impact of spectral notch width on plasticity and clinical effect — Wunderlich et al., PLoS ONE (2015)', u: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0138595' },
  stein: { t: 'Clinical trial on tonal tinnitus with tailor-made notched music training — Stein et al. (2016)', u: 'https://pubmed.ncbi.nlm.nih.gov/27838685/' },
  ipod: { t: 'Evaluation of iPod-based automated tinnitus pitch matching (2015)', u: 'https://pubmed.ncbi.nlm.nih.gov/25690779/' },
  ri: { t: 'Systematic review of sound stimulation to elicit tinnitus residual inhibition (ASHA Evidence Maps)', u: 'https://apps.asha.org/EvidenceMaps/Articles/ArticleSummary/92f96cdd-cf44-ed11-8139-005056834e2b' },
  sleepf: { t: 'Sleep Foundation — How to sleep with tinnitus', u: 'https://www.sleepfoundation.org/physical-health/how-to-sleep-with-tinnitus' },
  harvard: { t: 'Harvard Health — Sound therapy is one option for tinnitus (2021)', u: 'https://www.health.harvard.edu/blog/tinnitus-ringing-or-humming-in-your-ears-sound-therapy-is-one-option-202112082654' },
  mbct: { t: 'Mindfulness-based cognitive therapy for chronic tinnitus: RCT (2017)', u: 'https://karger.com/pps/article/86/6/351/283035/' },
  tmnmt: { t: 'Clinical trial on tonal tinnitus with tailor-made notched music training (BMC Neurology, 2016)', u: 'https://bmcneurol.biomedcentral.com/articles/10.1186/s12883-016-0558-7' },
  vr: { t: 'Auditory and visual inputs for relaxation during VR stimulation (2022)', u: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9560033/' },
  informed: { t: 'InformedHealth.org — Chronic tinnitus: what helps and what doesn’t', u: 'https://www.ncbi.nlm.nih.gov/books/NBK395563/' },
};

// ---------- shared snippets ----------
const disclaimer = `<p class="disclaimer-line"><strong>Important:</strong> Find My Quiet Sound is designed for sound masking, relaxation and tinnitus management support. It does not diagnose, treat or cure tinnitus and is not a substitute for professional medical care. If your tinnitus is new, in one ear only, pulsing with your heartbeat, or comes with hearing loss or dizziness, see a doctor or audiologist.</p>`;
const tryBox = (items) => `<aside class="try-box" aria-label="Try it in the app"><h2>Try it now — free, no account</h2><ul>${items.map(i => `<li><a class="btn btn-primary" href="${i.href}">${i.label}</a>${i.note ? `<span>${i.note}</span>` : ''}</li>`).join('')}</ul><p class="muted small">Opens Find My Quiet Sound in this browser. Sound starts only when you tap play, always at a low level.</p></aside>`;

// ---------- pages ----------
const PAGES = [];

// ===== TOOL LANDING PAGES =====
PAGES.push({
  path: 'tinnitus-sound-generator/', type: 'tool', updated: '2026-09-27',
  title: 'Tinnitus Sound Generator: Play Free Noise & Nature Sounds',
  description: 'Free tinnitus sound and noise generator in your browser: white, pink and brown noise, rain, ocean and more. Layer up to five sounds at a low level. No account.',
  h1: 'Free online tinnitus sound generator',
  intro: 'Find My Quiet Sound is a free tinnitus sound generator you can use right now in your browser — no download, no account. It plays steady, seamless sounds — broadband noise and natural ambience — that can make ringing, buzzing or hissing in the ears less noticeable while you work, rest or sleep.',
  try: [{ href: '/', label: 'Open the tinnitus sound generator' }, { href: '/?sound=brown', label: 'Try brown noise' }, { href: '/?sound=rain', label: 'Try rain' }],
  body: `
<h2>What the generator includes</h2>
<ul>
<li><strong>Broadband noise:</strong> <a href="/white-noise-for-tinnitus/">white</a>, <a href="/pink-noise-for-tinnitus/">pink</a> and <a href="/brown-noise-for-tinnitus/">brown</a> noise, gentle static and a soft hiss — all synthesised live, so they loop without clicks or gaps.</li>
<li><strong>Nature and indoor sounds:</strong> rain, rain on window, ocean waves, lapping water, flowing water, waterfall, forest, rustling leaves, wind, crickets, cicadas, night sounds, summer night, fan and fireplace. See how they compare with noise in <a href="/learn/nature-sounds-vs-noise-for-tinnitus/">nature sounds for tinnitus</a>.</li>
<li><strong>A <a href="/tinnitus-sound-mixer/">mixer</a></strong> to layer up to five sounds with individual levels and left/right balance, plus one-tap presets (Gentle Relief, Sleep, Focus, Ocean, Rainy Night, Rain on Window, Summer Night).</li>
<li><strong>A <a href="/tinnitus-frequency-generator/">frequency generator</a></strong> and a guided <a href="/tinnitus-sound-matching/">sound-matching</a> tool for people who want to explore the pitch of their tinnitus.</li>
<li><strong><a href="/tinnitus-sleep-sounds/">Sleep Mode</a></strong> with 15/30/60/90-minute timers and a gradual fade-out.</li>
<li><strong>Visual Focus</strong> — calm, slow visuals to watch while you listen, with a Reduce Motion option.</li>
</ul>
<h2>How to use a tinnitus sound generator</h2>
<ol>
<li><strong>Choose a sound.</strong> Try several. There is no single sound that works best for everyone; the most comfortable one is the right one for you. <a href="/learn/white-vs-pink-vs-brown-noise/">White vs pink vs brown noise for tinnitus</a> explains how the noise colours differ, and <a href="/tinnitus-masking-sounds/">tinnitus masking sounds</a> covers which sounds tend to blend with which kind of tinnitus.</li>
<li><strong>Keep it low.</strong> Start at a low level and adjust only until the sound feels comfortable and useful. You do not need to completely cover the tinnitus — louder is not better masking, and a low level is kinder to your hearing.</li>
<li><strong>Personalise it.</strong> Layer two or three sounds, nudge the balance, or save a mix you like. Use a timer at night.</li>
</ol>
<h2>Who it is for</h2>
<p>People with tinnitus who want an easy, free way to add a comfortable background sound — at a desk, at night, or in a quiet room where the ringing feels loudest. It works with speakers, headphones or a pillow speaker, on phones, tablets and computers. It is not for diagnosing tinnitus, and it does not make tinnitus go away.</p>
<h2>Why the sounds are generated, not recorded</h2>
<p>Recorded loops have a seam the brain learns to expect. Find My Quiet Sound synthesises every sound in real time with the Web Audio API, so noise never repeats and nature scenes drift slowly — which some people find easier to leave in the background over long sessions. Everything runs on your device; nothing is uploaded. For the wider picture — wearable devices, bedside machines and apps — read <a href="/learn/how-tinnitus-sound-generators-work/">how tinnitus sound generators work</a>.</p>
<h2>Frequently asked questions</h2>
<div class="faq">
<h3>Is this a treatment for tinnitus?</h3><p>No. Sound generators are a management tool. Clinical guidelines say sound therapy may be offered for bothersome tinnitus as a way to make it less noticeable and to support relaxation and sleep, alongside education and, where needed, counselling or hearing aids.</p>
<h3>Which sound is best for tinnitus?</h3><p>Studies comparing noise colours and nature sounds have not found one clear winner; comfort and preference matter more. Start with pink or brown noise if you find white noise too sharp, and add rain or ocean if pure noise feels clinical.</p>
<h3>How loud should it be?</h3><p>As low as still helps. The sound should blend with the tinnitus, not overpower it. Prolonged loud listening — especially on headphones — can harm hearing.</p>
<h3>Does it work offline?</h3><p>Yes. Once opened, Find My Quiet Sound can be installed to your home screen and runs without a connection.</p>
</div>`,
  faq: true,
  sources: ['nidcd', 'ata', 'aao', 'cochrane', 'bbn'],
});

PAGES.push({
  path: 'tinnitus-masking-sounds/', type: 'tool', updated: '2026-09-14',
  title: 'Tinnitus Masking Sounds for Ringing in the Ears',
  description: 'Masking sounds that blend with ringing, buzzing or hissing in the ears: which sounds to try, how low to set them, and free players that run in your browser.',
  h1: 'Tinnitus masking sounds',
  intro: 'Masking means adding an external sound so that the ringing or hissing in your ears is partly covered and easier to ignore. These are the sounds people most often use for it — and how to set them so they help without being loud.',
  try: [{ href: '/?sound=pink', label: 'Try pink noise' }, { href: '/?sound=rain', label: 'Try rain' }, { href: '/?preset=gentle', label: 'Gentle Relief preset' }],
  body: `
<h2>Which sounds mask ringing in the ears?</h2>
<p>Ringing is usually high-pitched, so sounds with energy across the higher frequencies tend to blend with it best: <a href="/white-noise-for-tinnitus/">white noise</a>, a soft hiss, <a href="/pink-noise-for-tinnitus/">pink noise</a>, steady rain and waterfall. Lower, deeper tinnitus (humming, buzzing) often pairs better with <a href="/brown-noise-for-tinnitus/">brown noise</a>, ocean waves, wind or a fan. The guided <a href="/tinnitus-sound-matching/">tinnitus frequency finder</a> can suggest a starting point from the rough pitch of your tinnitus. To compare the noise colours directly, see <a href="/learn/white-vs-pink-vs-brown-noise/">white vs pink vs brown noise for tinnitus</a>; for rain, ocean and forest, see <a href="/learn/nature-sounds-vs-noise-for-tinnitus/">nature sounds for tinnitus</a>. All of them play in the free <a href="/tinnitus-sound-generator/">tinnitus sound generator</a>.</p>
<h2>Partial masking is usually the goal</h2>
<p>Tinnitus retraining therapy uses the idea of a <em>mixing point</em>: the level at which the sound just starts to blend with the tinnitus without hiding it completely. In one study, setting sound at the mixing point worked as well as full masking — and it avoids loud listening. Find My Quiet Sound starts every sound quietly and fades it in for that reason. For the fuller explanation, see <a href="/learn/tinnitus-sound-masking/">what tinnitus masking is</a>.</p>
<h2>A simple routine</h2>
<ol><li>Pick one sound and play it at a low level.</li><li>Raise it slowly until the tinnitus feels blended, not gone.</li><li>Leave it there. If it still bothers you after a few minutes, try another sound instead of turning up.</li></ol>
<h2>Masking is not the only option</h2>
<p>Guidelines also support hearing aids when there is hearing loss, and cognitive behavioural therapy for persistent, bothersome tinnitus. Sound is the easiest thing to try at home, and it combines well with the others.</p>`,
  sources: ['ata', 'mixing', 'aao', 'cochrane'],
});

const COLOUR_PAGES = [
  { id: 'white', name: 'White noise', tname: 'White Noise', meta: 'Free white noise player for tinnitus, in your browser. When white noise tends to blend with high-pitched ringing, how low to set it, and when to try pink.', slug: 'white-noise-for-tinnitus', desc: 'equal energy at every frequency, so it sounds bright and hissy, like a detuned radio', best: 'high-pitched ringing or hissing, and for people who find it clean rather than harsh', caution: 'Some people find the high frequencies sharp or tiring; pink noise is the usual next step.', hz: 'all frequencies equally' },
  { id: 'pink', name: 'Pink noise', tname: 'Pink Noise', meta: 'Free pink noise player for tinnitus, in your browser. Why pink noise is a good first sound to try, what it tends to blend with, and how low to set it.', slug: 'pink-noise-for-tinnitus', desc: 'energy that falls by 3 dB per octave, so it sounds balanced and natural — like steady rainfall', best: 'mid-range ringing, and as a first sound to try because it is the least divisive', caution: 'If your tinnitus is very high-pitched, white noise or a soft hiss may blend better.', hz: 'more low than high energy (−3 dB per octave)' },
  { id: 'brown', name: 'Brown noise', tname: 'Brown Noise', meta: 'Free brown noise player for tinnitus, in your browser. Why deep brown noise suits sleep and low humming, how low to set it, and when to add pink noise.', slug: 'brown-noise-for-tinnitus', desc: 'energy that falls by 6 dB per octave, so it is deep and soft, like distant surf or a low rumble', best: 'people who find white and pink noise harsh, for sleep, and for low-pitched humming or buzzing', caution: 'It has little high-frequency energy, so it may not blend with a very high-pitched ring — try layering a little pink noise on top.', hz: 'mostly low energy (−6 dB per octave)' },
];
for (const c of COLOUR_PAGES) {
  PAGES.push({
    path: c.slug + '/', type: 'tool', updated: '2026-09-14',
    title: `${c.tname} for Tinnitus: Free Player & How to Use It`,
    description: c.meta,
    h1: `${c.name} for tinnitus`,
    intro: `${c.name} is one of the most-used sounds for making tinnitus less noticeable: at a low level it blends with the tinnitus so it is easier to ignore, though it does not stop tinnitus. It has ${c.desc}. It is often chosen for ${c.best}. You can play it free right below — it starts quietly.`,
    try: [{ href: `/?sound=${c.id}`, label: `Play ${c.name.toLowerCase()}` }, { href: '/tinnitus-sound-mixer/', label: 'Layer it with other sounds' }],
    body: `
<h2>What ${c.name.toLowerCase()} sounds like</h2>
<p>${c.name} is broadband noise — every frequency is present — with ${c.hz}. Compared with white noise it is ${c.id === 'white' ? 'the reference: flat and bright' : c.id === 'pink' ? 'noticeably softer, with the high end pulled back' : 'much softer and deeper, with very little high end'}.</p>
<h2>When ${c.name.toLowerCase()} helps with tinnitus</h2>
<p>It tends to suit ${c.best}. ${c.caution}</p>
<h2>Is it better than the other noise colours?</h2>
<p>Probably not in general. Controlled comparisons of noise and nature sounds for tinnitus have not found a reliably superior sound; comfort over a long session is what matters. The honest advice is to try all three — <a href="/white-noise-for-tinnitus/">white</a>, <a href="/pink-noise-for-tinnitus/">pink</a> and <a href="/brown-noise-for-tinnitus/">brown</a> — at the same low level and keep the one you notice least. Our comparison article, <a href="/learn/white-vs-pink-vs-brown-noise/">white vs pink vs brown noise for tinnitus</a>, goes deeper. For more options, see <a href="/tinnitus-masking-sounds/">other tinnitus masking sounds</a> and <a href="/learn/nature-sounds-vs-noise-for-tinnitus/">nature sounds for tinnitus</a>.</p>
<h2>How loud?</h2>
<p>Low. Raise it slowly until it just blends with your tinnitus, then stop. If you need it loud to get any effect, it is probably not the right sound for you. See <a href="/learn/how-loud-should-tinnitus-masking-be/">how loud should tinnitus masking be?</a></p>
<h2>At night</h2>
<p>${c.name} is a common bedtime choice because it is steady and has no events to wake you. Use the <a href="/tinnitus-sleep-sounds/">sleep timer</a> with a gradual fade, or leave it on all night at a very low level.</p>
<h2>About the player</h2>
<p>Find My Quiet Sound generates ${c.name.toLowerCase()} live with the Web Audio API, so there is no loop seam and no file to download. The level starts low, fades in over about a second, and never jumps. It is one of 20 sounds in the free <a href="/tinnitus-sound-generator/">tinnitus sound generator</a>, so you can try it alongside rain, ocean waves and other sounds.</p>`,
    sources: ['bbn', 'cochrane', 'nidcd', 'who'],
  });
}

PAGES.push({
  path: 'tinnitus-frequency-generator/', type: 'tool', updated: '2026-09-27',
  title: 'Tinnitus Frequency Generator: Free Online Tone, 20 Hz–16 kHz',
  description: 'Manual tinnitus frequency generator: a continuous tone adjustable by 1 Hz, pure tone or narrow noise, and a low default level. Free, for careful exploration.',
  h1: 'Tinnitus frequency generator',
  intro: 'A manual tone generator built for tinnitus: a continuous tone from 20 Hz to 16,000 Hz with coarse, fine and 1 Hz steps, a choice of pure tone, soft tone, triangle, narrow noise band or hiss band, left/right balance, and a volume that starts low. If you would rather be guided step by step, with an octave check, use the <a href="/tinnitus-sound-matching/">guided tinnitus frequency finder</a>.',
  try: [{ href: '/#frequency', label: 'Open the frequency generator' }, { href: '/#match', label: 'Guided: Find My Tinnitus Sound' }],
  body: `
<h2>What a frequency generator is for</h2>
<p>Many people with tonal tinnitus want to know roughly what pitch they hear. A frequency generator lets you sweep a tone up and down until it sounds similar. That rough pitch is useful in two ways: it helps choose masking sounds with energy in the same region, and it lets you try the frequency-centred experiments in Find My Quiet Sound (see <a href="/learn/tinnitus-frequency-matching/">how tinnitus pitch matching works</a>). It is not a hearing test and it does not change the tinnitus itself.</p>
<h2>How to use it safely</h2>
<ol>
<li>Tones feel louder than noise at the same setting, so Find My Quiet Sound caps the tone level lower than other sounds and fades it in. Keep it at the lowest comfortable level.</li>
<li>Sweep slowly with the slider, then refine with +/−10 Hz and +/−1 Hz.</li>
<li>Check one octave up and down. Pitch matching often lands an octave off; compare the tone with double and half its frequency before you settle.</li>
<li>Stop if anything feels uncomfortable. A few minutes is plenty.</li>
</ol>
<h2>Typical ranges</h2>
<p>Most people place their tinnitus between about 3,000 and 8,000 Hz, but lower and higher pitches are common. If yours sounds more like a hiss than a ring, the narrow-band and hiss-band tone types will feel closer than a pure tone. More in <a href="/learn/tinnitus-frequency/">what tinnitus frequency means and typical ranges</a>.</p>
<h2>Sound Visualizer (Frequency Bloom)</h2>
<p>The <em>Open Sound Visualizer</em> button opens Frequency Bloom, a live visual whose pattern changes with the frequency and level you set — a calm way to see what you are hearing. It is decorative, not diagnostic.</p>`,
  sources: ['pitch', 'ipod', 'nidcd', 'who'],
});

PAGES.push({
  path: 'tinnitus-sound-matching/', type: 'tool', updated: '2026-09-14',
  title: 'Tinnitus Frequency Finder: Find a Tone Like Your Tinnitus',
  description: 'Find your approximate tinnitus frequency with a free guided tool: compare tones quietly, check the octave, then get masking sounds to try. Not a hearing test.',
  h1: 'Tinnitus frequency finder',
  intro: 'Find your approximate tinnitus frequency with this free guided tool. Find My Tinnitus Sound walks you through choosing an ear, a sound type (ringing, whistling, hissing, humming) and a pitch at a low level, then suggests masking sounds to try around that region. It is an experimental personalisation feature, not a hearing test.',
  try: [{ href: '/#match', label: 'Start Find My Tinnitus Sound' }, { href: '/#frequency', label: 'Frequency generator' }],
  body: `
<h2>What you get at the end</h2>
<p>A rough frequency and a short list of sounds worth trying first — for example, a high ring often pairs with white noise, soft hiss or rain; a mid ring with pink noise, a stream or a fan; a low hum with brown noise, ocean or wind. You can save the result on your device or forget it.</p>
<h2>Why "approximate" is the honest word</h2>
<p>Self-administered pitch matching agrees with clinic matching within half an octave about 70% of the time, and octave confusion is the usual reason for larger differences. Find My Tinnitus Sound includes an octave-check step for that reason. Neither tool determines the cause of tinnitus — only a professional can. More on <a href="/learn/tinnitus-frequency-matching/">how accurate tinnitus pitch matching is</a>.</p>
<h2>What to do with your region</h2>
<ul><li>Pick masking sounds with energy near it (the tool suggests some).</li><li>Try <a href="/?exp=paint">Frequency Painting</a> in Experiments and draw a dip or a bump around your region.</li><li>Sweep a tone by hand with the <a href="/tinnitus-frequency-generator/">tinnitus frequency generator</a>, or read <a href="/learn/tinnitus-frequency/">what tinnitus frequency means</a>.</li><li>Keep the level low throughout.</li></ul>`,
  sources: ['pitch', 'ipod', 'ri', 'aao'],
});

PAGES.push({
  path: 'tinnitus-sound-mixer/', type: 'tool',
  title: 'Tinnitus Sound Mixer: Layer Up to Five Sounds | Find My Quiet Sound',
  description: 'Mix up to five tinnitus sounds — rain, brown noise, ocean — each with its own level and left/right balance. Save custom mixes locally. Free.',
  h1: 'Tinnitus sound mixer',
  intro: 'Layer up to five sounds, set each one’s level and balance, and save the combinations you like. A mix of a steady noise bed with one or two natural textures is the most common way people build a background that is easy to forget.',
  try: [{ href: '/#mixer', label: 'Open the mixer' }, { href: '/?preset=sleep', label: 'Sleep preset: brown + rain' }, { href: '/?preset=rainy', label: 'Rainy Night preset' }],
  body: `
<h2>Why layer sounds?</h2>
<p>A single noise can feel flat; a single nature recording can feel too eventful. Layering a broadband bed (pink or brown noise) under a natural texture (rain, ocean, wind) gives a sound with no gaps and no surprises. Balance lets you shift a sound toward the ear where the tinnitus is stronger.</p>
<h2>Mixes people start with</h2>
<ul>
<li><strong>Gentle Relief</strong> — pink noise alone, low.</li>
<li><strong>Sleep</strong> — brown noise 60%, rain 35%.</li>
<li><strong>Focus</strong> — pink noise 50%, forest 30%.</li>
<li><strong>Ocean</strong> — ocean 60%, brown noise 25%.</li>
<li><strong>Rainy Night</strong> — rain 55%, wind 30%, brown noise 20%.</li>
</ul>
<h2>Tips</h2>
<ul><li>Set the master volume first, low, then shape the mix with the channel sliders.</li><li>Double-click a balance slider to re-centre it.</li><li>Saved mixes stay on your device; nothing is uploaded.</li><li>For a mix that changes slowly over time, see the Adaptive Sound Journey in Experiments.</li></ul>`,
  sources: ['ata', 'bbn'],
});

PAGES.push({
  path: 'tinnitus-sleep-sounds/', updated: '2026-09-27', type: 'tool',
  title: 'Sleep Sounds for Tinnitus with Timer & Fade-Out | Find My Quiet Sound',
  description: 'Tinnitus sounds for sleeping: brown noise and rain, a 15–90 minute timer, slow fade-out and a dark sleep screen. How to use sound when ringing feels loudest.',
  h1: 'Sleep sounds for tinnitus',
  intro: 'Tinnitus often feels loudest in a quiet bedroom. A soft, steady sound gives the brain something else to rest on. Find My Quiet Sound’s Sleep Mode adds a timer, a gradual fade-out, and a dark screen that shows the clock, the time remaining and the sounds you are playing, with the same simple controls.',
  try: [{ href: '/#sleep', label: 'Open Sleep Mode' }, { href: '/?preset=sleep', label: 'Sleep preset: brown noise + rain' }, { href: '/?exp=journey', label: 'Experiments: Adaptive Sound Journey with sleep fade' }],
  body: `
<h2>Why tinnitus seems worse at night</h2>
<p>During the day, room noise partly masks tinnitus without you noticing. At night the contrast between silence and the ringing is at its greatest. Earplugs make that worse; a low-level sound makes it smaller.</p>
<h2>Good bedtime sounds</h2>
<ul><li><a href="/brown-noise-for-tinnitus/">Brown noise</a> — deep and eventless; the most common sleep choice.</li><li>Rain, ocean or a fan — natural and steady; avoid sounds with sudden events (thunder, birds) unless they are very distant.</li><li>A mix: brown noise with a little rain is the Sleep preset.</li></ul>
<h2>Settings that matter</h2>
<ul><li><strong>Level:</strong> lower than you think. It should fade into the background within a minute.</li><li><strong>Timer:</strong> 30–60 minutes with the gradual fade if you only need help falling asleep; continuous if you wake in the night.</li><li><strong>Speaker or pillow speaker</strong> rather than earbuds for all-night use.</li><li><strong>Dark screen:</strong> the sleep screen shows the clock, the time remaining and your sounds, with volume, pause, stop, timer and save close at hand.</li></ul>
<h2>Beyond sound</h2>
<p>Sleep guidance for tinnitus also stresses a regular schedule, limiting caffeine and alcohol late in the day, and getting help for persistent insomnia — CBT for insomnia is well supported. If tinnitus is keeping you awake most nights, talk to a professional.</p>`,
  sources: ['sleepf', 'nidcd', 'aao'],
});

// ===== LEARN ARTICLES =====
const learn = (o) => PAGES.push(Object.assign({ type: 'article' }, o, { path: 'learn/' + o.slug + '/' }));

learn({
  slug: 'tinnitus-sound-masking',
  title: 'What Is Tinnitus Masking? How It Works and How to Use It',
  description: 'Tinnitus masking in plain language: what it does, partial vs total masking, the mixing point, what the evidence says, and how to try it safely at home.',
  h1: 'What is tinnitus masking?',
  intro: 'Tinnitus masking is using an external sound — noise, nature sounds, music or a fan — so that the ringing or hissing in your ears is partly covered and easier to ignore. It is a way of managing the experience, not a cure, and it is one of the simplest things to try.',
  body: `
<h2>The short answer</h2>
<p>Masking adds sound so the tinnitus signal has competition. Your auditory system is always comparing what it hears against the background; in silence, tinnitus is the only thing there. Add a steady sound and the ringing becomes one sound among several — less prominent, easier to tune out.</p>
<h2>Partial versus total masking</h2>
<p><strong>Total masking</strong> sets the sound loud enough that you cannot hear the tinnitus at all. <strong>Partial masking</strong> sets it where the two blend — the "mixing point" in tinnitus retraining therapy. A study comparing the two found them equally effective, and partial masking avoids loud listening and is thought to support habituation (the brain learning to treat the tinnitus as unimportant). Most guidance, and Find My Quiet Sound’s defaults, favour partial masking.</p>
<h2>What the evidence says</h2>
<p>A Cochrane review of sound therapy (2018) found the research too limited to say that sound alone reduces tinnitus severity more than other care, but also found no harm, and noted that sound is widely used and valued by patients. The AAO-HNSF guideline says clinicians <em>may</em> offer sound therapy to patients with persistent, bothersome tinnitus. In other words: a reasonable, low-risk tool for comfort, not an established treatment.</p>
<h2>Which sounds?</h2>
<p>Broadband noise (white, pink, brown) and nature sounds are the most used. One trial found broadband noise reduced tinnitus symptom scores more than nature sounds over eight weeks, while many people simply prefer nature sounds — and preference predicts whether you will keep using it. Read <a href="/learn/white-vs-pink-vs-brown-noise/">white vs pink vs brown noise</a> and <a href="/learn/nature-sounds-vs-noise-for-tinnitus/">nature sounds vs noise</a>.</p>
<h2>How to try it at home</h2>
<ol><li>Open the <a href="/tinnitus-sound-generator/">sound generator</a> and pick one sound.</li><li>Raise the level slowly until it just blends with the tinnitus.</li><li>Use it in the situations where tinnitus bothers you most — quiet rooms, bedtime, concentration.</li><li>Give a sound a few days before judging it; change sound rather than turning up.</li></ol>
<h2>When masking is not enough</h2>
<p>If tinnitus is persistent and distressing, ask a professional about counselling approaches such as cognitive behavioural therapy (the best-supported option for tinnitus distress), hearing aids if you have hearing loss, and a hearing evaluation if you have not had one.</p>`,
  sources: ['cochrane', 'mixing', 'aao', 'bbn', 'ata', 'nidcd'],
});

learn({
  slug: 'how-tinnitus-sound-generators-work', updated: '2026-09-14',
  title: 'How Tinnitus Sound Generators Work: Devices, Apps, Web Tools',
  description: 'How tinnitus sound generators work: wearable maskers, bedside machines, apps and browser tools; how noise is made; why looping and low levels matter.',
  h1: 'How tinnitus sound generators work',
  intro: 'A tinnitus sound generator is any device or app that produces a steady, pleasant sound to make tinnitus less noticeable. They range from tiny in-ear maskers fitted by an audiologist to bedside machines, phone apps and web tools like Find My Quiet Sound. If you want to use one now, the free <a href="/tinnitus-sound-generator/">online tinnitus sound generator</a> runs in your browser.',
  body: `
<h2>Types of sound generator</h2>
<ul><li><strong>Wearable ear-level generators</strong> — small devices (often combined with hearing aids) that play soft noise all day; fitted and set by a hearing professional.</li><li><strong>Tabletop / bedside machines</strong> — loop recordings or synthesise noise; used for sleep.</li><li><strong>Phone apps</strong> — libraries of recordings, often with mixing and timers.</li><li><strong>Browser tools</strong> — run in a web page with no install; Find My Quiet Sound is one of these.</li></ul>
<h2>How the sound is made</h2>
<p>White noise is random samples with equal energy at every frequency. Pink and brown noise are white noise filtered so that energy falls with frequency (−3 dB and −6 dB per octave). Nature sounds are either recordings or, in Find My Quiet Sound, layers of filtered noise with slow modulation and small random events (droplets, crackles, gusts) so they never repeat exactly.</p>
<h2>Why seamless looping matters</h2>
<p>A loop with an audible seam gives the brain a landmark to anticipate, which pulls attention back to the sound — and to the tinnitus. Generated sound has no seam. If you use recordings, choose long ones with cross-faded ends.</p>
<h2>Why level control matters more than the sound</h2>
<p>The most useful features are the ones that keep you at a low, comfortable level: a quiet default, smooth fade-ins, fine volume steps, a timer with a gradual fade, and a limiter so layering sounds never produces a spike. Headphone use should follow safe-listening guidance (the WHO suggests keeping personal audio around 80 dB or less for no more than 40 hours a week).</p>
<h2>What to look for</h2>
<ul><li>Sounds you actually like — you will use them longer.</li><li>Mixing and balance.</li><li>Sleep timer with fade.</li><li>Works offline, no account, no tracking of your hearing.</li><li>Honest wording: no promises of cures.</li></ul>
<p>Try the <a href="/tinnitus-sound-generator/">free tinnitus sound generator</a>.</p>`,
  sources: ['nidcd', 'ata', 'who', 'harvard'],
});

learn({
  slug: 'notched-sound-for-tinnitus', updated: '2026-09-27',
  title: 'Notched Sound for Tinnitus: What It Is and What the Evidence Says',
  description: 'Personalized notched sound explained in plain language: how it differs from masking, what the mixed research actually found, and how to try it carefully with a free tool.',
  h1: 'Notched sound for tinnitus',
  intro: 'Notched sound takes a broadband sound — noise, rain, or music — and reduces a narrow band of frequencies around the pitch you associate with your tinnitus. It has been studied as a possible approach to tinnitus management, but research findings are mixed, and it has not been established as an effective treatment. Here is what it is, what the studies found, and how to explore it carefully.',
  body: `
<h2>How it differs from masking</h2>
<p>Ordinary <a href="/learn/tinnitus-sound-masking/">masking</a> adds sound so the tinnitus has competition. Notched sound does something different: it <em>removes</em> sound in a narrow region around your selected tinnitus pitch, while everything around that region keeps playing. The idea studied in research — sometimes called "tailor-made notched music" — is that listening to sound with your tinnitus frequency missing might, over time, change how the brain responds around that frequency. Whether that translates into real-world benefit is exactly what the research disagrees about.</p>
<h2>What the research actually found</h2>
<p>The findings are genuinely mixed, and it matters to say so plainly:</p>
<ul>
<li>An early trial (Okamoto and colleagues, 2010) reported that about a year of daily listening to music with a notch at the tinnitus frequency was followed by lower reported tinnitus loudness than placebo-notched music, in a small group.</li>
<li>A short intensive study (Teismann and colleagues, 2011) reported changes for participants whose tinnitus pitch was below about 8&nbsp;kHz — but not above it — and the effects faded after listening stopped.</li>
<li>A comparison of different notch widths (Wunderlich and colleagues, 2015) found the width of the notch made no measurable difference.</li>
<li>The largest randomized trial (Stein and colleagues, 2016 — 100 participants, three months, about two hours daily) found <strong>no significant benefit over placebo on its primary outcome measures</strong>.</li>
<li>A Cochrane review of sound therapy broadly (2018) rated the overall evidence quality as low.</li>
</ul>
<p>In short: some studies have reported changes in tinnitus measures for certain participants, while other controlled studies have not found significant benefit. More research is needed to determine whether notched sound is beneficial, for whom, and under what conditions.</p>
<h2>Trying it in Find My Quiet Sound</h2>
<p>The <strong>Personalized Notched Sound</strong> experiment lives in the <a href="/#lab">Experiments</a> section, labelled honestly as experimental with mixed evidence. It works like this:</p>
<ol>
<li><strong>Choose your pitch.</strong> Adjust a tone until it sounds approximately similar to the pitch you hear, or tap <em>Narrow it down for me</em> and answer a few comparisons. This is your personal estimate, not a clinical measurement or hearing test.</li>
<li><strong>Choose a sound.</strong> Broadband sounds — pink noise, rain, a waterfall — carry energy around most pitches, so the notch has something to remove. You can also use your own audio; it is processed on your device and never uploaded.</li>
<li><strong>Listen and compare.</strong> A NORMAL / NOTCHED switch lets you hear the original and the notched version at the same level, any time. A live spectrum shows the band being reduced.</li>
<li><strong>Keep the volume low and comfortable.</strong> Stop if the sound causes discomfort or seems to make your tinnitus worse.</li>
</ol>
<h2>Sensible expectations</h2>
<p>Some people notice a temporary change in tinnitus after listening to certain sounds — sometimes called residual inhibition. If it occurs, it is generally temporary and should not be interpreted as evidence that the tinnitus itself has been treated or permanently changed. If you have hearing loss near your tinnitus pitch, the notched region may already be hard to hear, and the experience may feel different. And if your tinnitus pitch is very high, note both the research finding above 8&nbsp;kHz and the fact that headphones and speakers differ in how accurately they reproduce high frequencies.</p>
<p>Find My Quiet Sound provides this feature as an experimental sound-exploration tool, not as a medical treatment. It does not diagnose, treat or cure tinnitus. If tinnitus is persistent or distressing, a hearing professional can evaluate it properly — counselling approaches such as CBT currently have the strongest evidence for reducing tinnitus distress.</p>`,
  sources: ['okamoto', 'teismann', 'wunderlich', 'stein', 'cochrane', 'nidcd', 'ata'],
});

learn({
  slug: 'white-vs-pink-vs-brown-noise', updated: '2026-09-14',
  title: 'White vs Pink vs Brown Noise for Tinnitus: Which Is Best?',
  description: 'White, pink and brown noise compared for tinnitus: how each sounds, which pitch each blends with, what studies found, and how to choose — with free players.',
  h1: 'White vs pink vs brown noise for tinnitus',
  intro: 'Short answer: no colour of noise has been shown to be best for tinnitus in general. White is brightest, pink is balanced, brown is deepest. The right one is the one that blends with your tinnitus at the lowest level and that you can forget about. Here is how to choose — and you can play <a href="/?sound=white">white</a>, <a href="/?sound=pink">pink</a> and <a href="/?sound=brown">brown</a> noise free in your browser to compare them.',
  body: `
<h2>What the colours mean</h2>
<table><thead><tr><th>Noise</th><th>Spectrum</th><th>Sounds like</th><th>Often suits</th></tr></thead><tbody>
<tr><td><a href="/white-noise-for-tinnitus/">White</a></td><td>Equal energy per frequency</td><td>Bright hiss, radio static</td><td>High-pitched ringing; people who like a clean sound</td></tr>
<tr><td><a href="/pink-noise-for-tinnitus/">Pink</a></td><td>−3 dB per octave</td><td>Steady rain, balanced</td><td>Mid-range ringing; a good first try</td></tr>
<tr><td><a href="/brown-noise-for-tinnitus/">Brown</a></td><td>−6 dB per octave</td><td>Distant surf, low rumble</td><td>Low humming; sleep; anyone who finds white noise harsh</td></tr>
</tbody></table>
<h2>What studies found</h2>
<p>Comparisons of masking sounds have not produced a consistent winner; reviews note that the evidence for sound therapy overall is limited and that patient preference is central. One eight-week trial found broadband noise more effective than nature sounds on symptom scores — but it did not separate white from pink from brown. Claims that a particular colour "treats" tinnitus are not supported.</p>
<h2>A practical way to choose</h2>
<ol><li>Play each colour at the same low level for a minute.</li><li>Notice which one lets you stop listening to it soonest.</li><li>If white feels sharp, go pink; if pink still feels bright, go brown; if brown does not reach a high ring, layer a little pink over brown in the <a href="/tinnitus-sound-mixer/">mixer</a>.</li></ol>
<p>For more ways to choose, see <a href="/tinnitus-masking-sounds/">tinnitus masking sounds</a>, or open the free <a href="/tinnitus-sound-generator/">tinnitus sound generator</a>.</p>
<h2>Don’t forget nature sounds</h2>
<p>Rain is pink-ish noise with texture; ocean is brown-ish noise with slow swells. Many people find those easier to live with than pure noise. See <a href="/learn/nature-sounds-vs-noise-for-tinnitus/">nature sounds vs noise</a>.</p>`,
  sources: ['bbn', 'cochrane', 'ata'],
});

learn({
  slug: 'find-a-comfortable-tinnitus-masking-sound', updated: '2026-09-27',
  title: 'How to Find a Comfortable Tinnitus Masking Sound',
  description: 'A step-by-step way to find a tinnitus masking sound you can live with: start quiet, compare at equal level, match your tinnitus’s character, give it days.',
  h1: 'How to find a comfortable tinnitus masking sound',
  intro: 'The most common mistake is turning a sound up until it covers the tinnitus. The more useful approach is to find the sound that blends at the lowest level. This is a simple procedure for doing that.',
  body: `
<h2>1. Describe your tinnitus first</h2>
<p>Ringing (a pure tone), whistling (narrow), hissing (broad and high), or humming/buzzing (low)? High sounds blend with white noise, hiss, rain and waterfall; mid sounds with pink noise, streams and fans; low sounds with brown noise, ocean and wind. The <a href="/tinnitus-sound-matching/">sound matching</a> tool does this for you.</p>
<h2>2. Compare at the same low level</h2>
<p>Set the master volume low and leave it there. Switch between sounds rather than adjusting volume. <a href="/?exp=discovery">Help Me Find My Sound</a>, in the Find My Sound section, turns this into a guided A/B comparison.</p>
<h2>3. Find the mixing point</h2>
<p>With your chosen sound, raise the level slowly until the tinnitus just starts to blend. That is your level.</p>
<h2>4. Add texture if pure noise feels clinical</h2>
<p>Layer one nature sound under the noise. Keep it lower than the noise bed so there are no sudden events.</p>
<h2>5. Give it a few days</h2>
<p>Comfort grows with familiarity. If after several days a sound still draws your attention, change the sound, not the volume.</p>
<h2>6. Watch for these signs</h2>
<ul><li>You need it loud — wrong sound.</li><li>It tires your ears — too bright; move toward pink or brown.</li><li>You notice the loop — use generated sound or longer recordings.</li><li>It makes the tinnitus feel worse — stop, rest, and consider talking to an audiologist, especially if you also have sound sensitivity.</li></ul>`,
  sources: ['mixing', 'ata', 'nidcd'],
});

learn({
  slug: 'tinnitus-and-sleep',
  title: 'Using Sound at Night When You Have Tinnitus',
  description: 'Using sound at night with tinnitus: why it feels louder in bed, which sounds help, how loud, timer or all night, speakers or earbuds, and when to get help.',
  h1: 'Using sound at night when you have tinnitus',
  intro: 'Bedtime is when tinnitus is most noticeable for many people, and poor sleep makes tinnitus feel worse the next day. A low, steady sound is the simplest thing that helps, and a few settings make the difference between "soothing" and "another thing keeping me awake".',
  body: `
<h2>Why it feels louder at night</h2>
<p>Daytime sound partly masks tinnitus without effort. In a silent bedroom the contrast is at its maximum and there is nothing else to attend to. Earplugs increase the contrast; a soft sound reduces it.</p>
<h2>What to play</h2>
<p>Steady, eventless sounds: brown or pink noise, rain without thunder, ocean, a fan. Avoid music with structure and recordings with birds or surprises. If you like a more interesting sound to fall asleep to, let it simplify over time — the Adaptive Sound Journey in Experiments can end with a fade toward sleep.</p>
<h2>How loud</h2>
<p>Quieter than you expect. It should fade into the background within about a minute. If you wake in the night and the sound is the first thing you notice, lower it.</p>
<h2>Timer or all night?</h2>
<ul><li>Trouble <em>falling</em> asleep: a 30–60-minute timer with a gradual fade.</li><li>Waking in the night: continuous at a very low level.</li></ul>
<h2>Speakers, pillow speakers or earbuds?</h2>
<p>A small speaker or a pillow speaker is better for all-night use: no pressure on the ears, no risk of hours of headphone listening, and the level stays low. If you share a bed, a pillow speaker keeps the sound local.</p>
<h2>If sleep is the real problem</h2>
<p>Persistent insomnia with tinnitus responds well to cognitive behavioural therapy for insomnia, and sleep foundations recommend regular schedules, less late caffeine and alcohol, and a dark, cool room. Talk to a professional if most nights are difficult.</p>
<p>Try <a href="/tinnitus-sleep-sounds/">Sleep Mode</a>.</p>`,
  sources: ['sleepf', 'nidcd', 'aao', 'who'],
});

learn({
  slug: 'tinnitus-frequency', updated: '2026-09-14',
  title: 'What Is Tinnitus Frequency? Meaning and Typical Ranges',
  description: 'What tinnitus frequency means, why it is often 3–8 kHz, how it relates to hearing loss, and what knowing it can and cannot do.',
  h1: 'What is tinnitus frequency?',
  intro: 'Tinnitus frequency (or pitch) is the frequency of an external tone that sounds most like your tinnitus. Most people match it somewhere between about 3,000 and 8,000 Hz, often near the edge of a hearing loss. Knowing it roughly is useful; treating it as a precise number is not. To find yours, use the <a href="/tinnitus-sound-matching/">guided tinnitus frequency finder</a>.',
  body: `
<h2>What the number means</h2>
<p>Hearing is measured in hertz (Hz). Speech sits mostly below 4,000 Hz; "ringing" tinnitus is commonly higher. When you match a tone to your tinnitus you are finding the external frequency that feels most similar — not measuring something inside the ear.</p>
<h2>Why it is often high</h2>
<p>Tinnitus frequently accompanies high-frequency hearing loss, and the matched pitch often falls in or near the region of loss. That is one reason a hearing evaluation is the standard first step when tinnitus is persistent: it puts the pitch in context.</p>
<h2>Octave confusion</h2>
<p>A tone and the tone an octave higher (double the frequency) sound similar in character. People matching their own tinnitus frequently choose the wrong octave; clinic procedures include an "octave check" for this reason, and Find My Quiet Sound’s Find My Tinnitus Sound does too.</p>
<h2>Noise-like tinnitus</h2>
<p>If your tinnitus is a hiss rather than a ring, a pure tone will never feel right. Narrow bands of noise are used instead, and the matched region is wider.</p>
<h2>What you can do with it</h2>
<ul><li>Choose masking sounds with energy in the same region (see <a href="/tinnitus-masking-sounds/">masking sounds</a>).</li><li>Read <a href="/learn/tinnitus-frequency-matching/">how tinnitus pitch matching works, and its limits</a> for what the number can and cannot do.</li><li>Bring the rough number to an audiologist as a conversation starter — not as a diagnosis.</li></ul>
<p>Explore with the <a href="/tinnitus-frequency-generator/">frequency generator</a>.</p>`,
  sources: ['nidcd', 'pitch', 'ipod', 'aao'],
});

learn({
  slug: 'tinnitus-frequency-matching', updated: '2026-09-22',
  title: 'Tinnitus Pitch Matching: How It Works, Accuracy & Limits',
  description: 'How tinnitus pitch matching is done, how accurate self-matching is, what notched sound and residual inhibition are, and what the evidence supports.',
  h1: 'What is tinnitus pitch matching?',
  intro: 'Tinnitus pitch matching, also called frequency matching, means finding the external tone that sounds most like your tinnitus. Clinics do it with a two-alternative procedure; apps do it with sliders. The matched pitch is then used to choose sounds or to centre experimental approaches such as notched noise. Here is what that can and cannot do. To try it yourself at a low level, use the <a href="/tinnitus-sound-matching/">guided tinnitus frequency finder</a>.',
  body: `
<h2>How matching is done</h2>
<p>You compare tones and say which is closer, narrowing down step by step, then check an octave above and below. Self-administered matching with a slider agrees with the clinic within half an octave about 70% of the time; an automated two-interval method on a music player was as reliable as the conventional procedure and easier for participants.</p>
<p>Because tinnitus pitch can vary from one attempt to the next, repeating the match and keeping the middle value gives a more stable estimate than a single attempt. Find My Tinnitus Sound offers this as an optional step: one match is enough to continue; if you choose to match twice more, the pitch number is hidden during the repeats so each attempt starts fresh, and the three results are combined by keeping the middle one. The octave check stays part of every attempt.</p>
<h2>What people do with the matched frequency</h2>
<ul>
<li><strong>Choose masking sounds</strong> with energy near the region — the simplest, safest use.</li>
<li><strong>Notched sound</strong> — broadband noise or music with a gap around the pitch. Trials of "tailor-made notched music" are mixed: one large randomised trial found no advantage over placebo on its main outcome, a later one found it comparable to an established therapy. Notch width did not matter. Find My Quiet Sound includes an experimental <a href="/learn/notched-sound-for-tinnitus/">Personalized Notched Sound</a> mode, labelled with this mixed evidence, and you can also paint a dip yourself in Frequency Painting.</li>
<li><strong>Residual inhibition</strong> — a temporary quieting of tinnitus after a sound stops. Well documented, short-lived, and more likely with sounds near the tinnitus pitch; small studies found amplitude-modulated tones produced more of it than plain noise. Find My Quiet Sound’s <a href="/learn/how-sound-response-works/">Sound Response</a> lets you observe whether this happens for you, at a comfortable level, and records what you notice — it is an observation tool, not a treatment.</li>
<li><strong>"Neuromodulation" tone patterns</strong> sold by some apps — a controlled trial was inconclusive.</li>
</ul>
<h2>What matching cannot do</h2>
<p>It does not identify the cause of tinnitus, does not replace a hearing test, and does not by itself change the tinnitus. Find My Quiet Sound keeps tone levels low and labels the tool as exploratory. For what the number means and typical ranges, see <a href="/learn/tinnitus-frequency/">what tinnitus frequency means</a>; to sweep a tone by hand, use the <a href="/tinnitus-frequency-generator/">tinnitus frequency generator</a>.</p>
<p>Try <a href="/tinnitus-sound-matching/">Find My Tinnitus Sound</a>.</p>`,
  sources: ['pitch', 'ipod', 'tmnmt', 'ri', 'aao'],
});

learn({
  slug: 'nature-sounds-vs-noise-for-tinnitus', updated: '2026-09-14',
  title: 'Nature Sounds for Tinnitus: Rain, Ocean & Forest vs Noise',
  description: 'Nature sounds for tinnitus (rain, ocean, forest, wind) compared with white, pink and brown noise: what one trial found, and free players to try.',
  h1: 'Nature sounds for tinnitus: rain, ocean and forest vs noise',
  intro: 'Nature sounds such as rain, ocean waves and forest ambience are a common choice for making tinnitus less noticeable, and many people find them easier to leave on than plain noise. Noise is consistent and covers the most frequencies; nature sounds are more pleasant and easier to live with. One trial found broadband noise reduced symptom scores more over eight weeks, yet most people choose nature sounds. The usual answer is both: a noise bed with a natural texture on top. Play <a href="/?sound=rain">rain</a>, <a href="/?sound=ocean">ocean waves</a>, <a href="/?sound=forest">forest</a> or <a href="/?sound=wind">wind</a> free in your browser; each starts quietly.',
  body: `
<h2>What noise does well</h2>
<p>Broadband noise has no gaps and no events, so it blends with tinnitus continuously. It is also adjustable in character (white, pink, brown). Its weakness is that it can feel clinical or tiring.</p>
<h2>What nature sounds do well</h2>
<p>Rain, waves and wind are noise-like but with slow movement the brain accepts as natural. They are relaxing in their own right; virtual-nature studies find audio-visual nature scenes reduce perceived stress. Their weakness is variability — surf that swells and falls can let the tinnitus peek through, and recordings with birds or thunder can be alerting at night.</p>
<h2>What the trial found</h2>
<p>In a mixed-methods trial, broadband noise produced a larger reduction in tinnitus scores than nature sounds after eight weeks, but individual responses varied widely and many participants preferred nature sounds. Preference matters because it predicts continued use.</p>
<h2>Practical combinations</h2>
<ul><li>Pink noise + forest for daytime focus.</li><li>Brown noise + rain for sleep.</li><li>Ocean + a little brown noise for relaxation.</li></ul>
<p>Build one in the <a href="/tinnitus-sound-mixer/">mixer</a>, or open the free <a href="/tinnitus-sound-generator/">tinnitus sound generator</a> to try each sound on its own. For which sounds suit which kind of tinnitus, see <a href="/tinnitus-masking-sounds/">tinnitus masking sounds</a>.</p>`,
  sources: ['bbn', 'vr', 'ata'],
});

learn({
  slug: 'how-loud-should-tinnitus-masking-be',
  title: 'How Loud Should Tinnitus Masking Sound Be?',
  description: 'How loud to set tinnitus masking: the mixing point, why partial masking beats total masking, safe-listening limits for headphones, and signs it is too loud.',
  h1: 'How loud should tinnitus masking sound be?',
  intro: 'Start low and raise it only until the sound feels comfortable and useful; you do not need to cover the tinnitus. In tinnitus retraining therapy this blend level is called the "mixing point", and in one direct comparison it worked as well as total masking — at a far lower level.',
  body: `
<h2>The mixing point</h2>
<p>Raise the sound slowly from silence. The moment it begins to blend with the tinnitus — without hiding it and without being annoying — is the mixing point. Stop there. Find My Quiet Sound starts every sound quietly and fades it in so you can stop at that point.</p>
<h2>Why not just cover it?</h2>
<p>Total masking is louder and more tiring, and clinicians who use tinnitus retraining therapy generally prefer a level where the sound blends with the tinnitus rather than covers it. One study found mixing-point and total-masking settings similarly effective, so the quieter setting is the sensible default. Individual experiences vary.</p>
<h2>Safe-listening limits</h2>
<p>The WHO-ITU safe-listening standard suggests personal audio around 80 dB or less for no more than 40 hours a week (75 dB for children). Masking sound set where it just blends is far below that; hours of loud headphone masking may not be. Device volume percentages do not map reliably to decibels — phones and headphones differ a lot — so the practical rule is: use the lowest comfortable level that gives you the experience you want, and take breaks.</p>
<h2>Signs the level is too high</h2>
<ul><li>You can hear it clearly over speech in the room.</li><li>Your ears feel tired or full afterwards.</li><li>The tinnitus seems louder when the sound stops.</li><li>You keep reaching for the volume — usually a sign the sound is wrong, not too quiet.</li></ul>`,
  sources: ['mixing', 'who', 'ata'],
});

learn({
  slug: 'speakers-vs-headphones-for-tinnitus-sounds',
  title: 'Speakers vs Headphones for Tinnitus Sounds',
  description: 'Speakers, pillow speakers, earbuds, over-ear and bone-conduction headphones for tinnitus masking: pros, cons, safety and which to use by situation.',
  h1: 'Speakers vs headphones for tinnitus sounds',
  intro: 'Both work. Speakers are safer and more comfortable for long and overnight use; headphones are private and deliver high frequencies more precisely. Most people end up using a speaker at night and headphones, at low volume, when they need privacy.',
  body: `
<h2>Speakers</h2>
<p><strong>Pros:</strong> nothing in or on your ears; natural room sound; easy to keep the level low; fine for all night. <strong>Cons:</strong> audible to others; room absorbs high frequencies, so a high ring may blend less precisely.</p>
<h2>Pillow speakers</h2>
<p>A small flat speaker under the pillow: private, low-level, no ear pressure. The best option for a shared bed.</p>
<h2>Earbuds and over-ear headphones</h2>
<p><strong>Pros:</strong> private; accurate high-frequency delivery; noise-cancelling models let you keep the level lower in noisy places. <strong>Cons:</strong> easy to listen too long or too loud; uncomfortable for sleep; some people with tinnitus find headphone use aggravating. Follow safe-listening guidance — around 80 dB or less, 40 hours a week — and take breaks.</p>
<h2>Bone-conduction headphones</h2>
<p>Leave the ear canal open, so room sound mixes naturally with the masking sound. Comfortable for long daytime use; weaker at very high frequencies.</p>
<h2>By situation</h2>
<ul><li>Sleep: speaker or pillow speaker.</li><li>Office or travel: noise-cancelling headphones at low volume, or bone conduction.</li><li>Frequency exploration: headphones, so left and right can be set separately — briefly and quietly.</li></ul>`,
  sources: ['who', 'ata', 'harvard'],
});

learn({
  slug: 'ask-find-my-quiet-sound', updated: '2026-09-27',
  title: 'Ask Find My Quiet Sound — Voice & Text Sound Control',
  description: 'A tinnitus sound app you can control by voice or text. Say "something gentle for sleep" or "add a little rain" — hands-free masking sounds, with the microphone on only when you tap it.',
  h1: 'Ask Find My Quiet Sound',
  intro: 'Just say what you want. Ask Find My Quiet Sound lets you control your sound environment using everyday language. Type your request, or tap the microphone and speak.',
  body: `
<h2>Try things like</h2>
<ul>
<li>“Something gentle for sleep.”</li>
<li>“Add a little rain.”</li>
<li>“Make it warmer.”</li>
<li>“Set a timer for 30 minutes.”</li>
<li>“Give me something for focus.”</li>
<li>“Make it softer.”</li>
<li>“Save this.”</li>
</ul>
<p>Find My Quiet Sound turns your request into controls you could otherwise adjust yourself.</p>
<h2>Your choices stay in your control</h2>
<p>You can always use the normal controls, and you can undo changes made through Ask Find My Quiet Sound. Volume increases through Ask are always gradual — for larger changes, the volume slider is yours.</p>
<h2>About voice</h2>
<p>Voice recognition may be processed by your browser or device provider. Find My Quiet Sound does not store your voice or send My Sound Profile or tinnitus information with your request. The microphone listens only when you tap it, one request at a time — never in the background.</p>
<p><a href="/">Try it now — it lives just under the main controls on the Sounds page →</a></p>`,
  sources: [],
});

learn({
  slug: 'how-to-use-find-my-sound', updated: '2026-09-27',
  title: 'How to Use Help Me Find My Sound',
  description: 'Help Me Find My Sound works like the eye test at the optician — "better with one, or two?" — but with sound. A plain guide to using it, and what to do with your result.',
  h1: 'How to use Help Me Find My Sound',
  intro: 'You know the test at the eye doctor: they flip a lens and ask, "Better with one… or two?" You do not need to know anything about eyes — you just say which looks clearer, and the right glasses come out at the end. Help Me Find My Sound is exactly that, for your ears. It plays two sounds, you say which one feels nicer, and after a handful of these questions it hands you your sound.',
  body: `
<h2>Before you start</h2>
<ul><li>Headphones help, but are not required.</li><li>Keep the volume <strong>low and comfortable</strong>. You are choosing which sound feels nicer — never which is louder.</li></ul>
<h2>How to do it</h2>
<ol>
<li><strong>Open it.</strong> Tap <strong>Find My Sound</strong> in the top menu, then the big <strong>Help Me Find My Sound</strong> button (or the <em>"Help Me Find My Sound"</em> link under the big circle on the Sounds page), and press <strong>Start Experiment</strong>.</li>
<li><strong>Listen to both.</strong> You will see two circles, <strong>A</strong> and <strong>B</strong>. Tap A to hear one, tap B to hear the other. Go back and forth as many times as you like — there is no clock and no score.</li>
<li><strong>Say which feels nicer.</strong> Tap <strong>A</strong>, <strong>B</strong>, or <strong>No difference</strong>. "Nicer" simply means the one you could leave on and forget about — the one your ears relax into. If you honestly cannot tell, <strong>No difference</strong> is a perfectly good answer.</li>
</ol>
<p>That is the whole skill. A soft green note tells you when a new round begins, and the same question comes back with a slightly different pair — about twelve times in all (you can choose 8 or 15 rounds in the settings). There are no wrong answers, and nothing about your hearing is being tested or measured. It only learns what you <em>like</em>.</p>
<h2>What to do when it finishes</h2>
<p>After the last round, the app shows you the sound you chose most often. Two things are worth doing right away:</p>
<ul>
<li><strong>Tap "See Your Moments."</strong> Your first choices in Help Me Find My Sound unlock <strong>Your Moments</strong> at the top of the Sounds page — one-tap buttons that build your personal quiet, sleep or focus sound. This is the real reward: from now on, your sound is always one tap away.</li>
<li><strong>Save your sound</strong> if you like it. Give it a name and it appears under <em>My Saved Sounds</em> on the Sounds page.</li>
</ul>
<p>The other buttons are extras for whenever you want them: <em>Listen to Your Quiet</em> plays your sound now, <em>Fine-Tune Your Sound</em> opens it in Sound Sculptor, and <em>Start New Experiment</em> runs the whole thing again. Adding a calm visual or building a 60-minute sleep session from your sound is done from My Sound Profile.</p>
<h2>What the app remembers</h2>
<p>Your choices build a simple picture of your taste — warmer or brighter, steady or moving, rain or ocean. The app quietly uses that picture everywhere: Your Moments, sleep suggestions, a recommended visual, and a gentle <em>"Tuned to you"</em> touch on whatever you play. It all stays on your device, and it gets a little smarter every time you use Help Me Find My Sound. You can see it any time under <strong>My Sound Profile</strong> in the Find My Sound section, alongside your <a href="/learn/how-sound-response-works/">Sound Response</a> summary.</p>
<h2>Good to know</h2>
<ul><li>Your taste can change with the time of day — running it again at night may find a softer sound than in the morning. Run it again whenever you feel like it.</li><li>If the two sounds start feeling the same near the end, that is a good sign: you have found your sound. Finish, save it, and enjoy it.</li><li>This tool explores what you find comfortable. It does not diagnose or treat anything.</li></ul>
<p><a href="/?exp=discovery">Try Help Me Find My Sound now →</a></p>`,
  sources: [],
});

learn({
  slug: 'how-sound-response-works', updated: '2026-09-27',
  title: 'How Sound Response Works — Discover What Changes Your Tinnitus',
  description: 'Sound Response plays short, level-matched sounds and asks what your tinnitus did afterwards. How a session runs, which sounds it tries, how it decides what to test next, what your Sound Response Profile shows, and what it cannot tell you.',
  h1: 'How Sound Response works',
  intro: 'Some people notice that their tinnitus is briefly quieter after a sound stops. Researchers call that <em>residual inhibition</em>. Sound Response — “Discover What Changes Your Tinnitus” in the app — is a careful, step-by-step way to find out whether that happens for you, and whether one kind of sound does it more reliably than another. It is an observation tool, not a treatment: a temporary change after a sound says nothing about the tinnitus itself changing.',
  body: `
<h2>What it is — and what it is not</h2>
<p>Residual inhibition is well documented: for many people with tinnitus a sound can be followed by seconds to minutes of quieter tinnitus, more often when the sound has energy near the tinnitus pitch. It is short-lived, and repeating it has not been shown to change tinnitus over time. Sound Response simply records what <em>you</em> notice after each sound, in your own words (“a little quieter”, “about the same”, “louder”), and looks for a pattern that repeats. It does not diagnose anything, does not treat anything, and never raises the volume to try to force a change.</p>
<h2>Before you start</h2>
<ul>
<li><strong>Your tinnitus pitch comes first.</strong> The sounds are chosen around the pitch you hear, so the app sends you through <a href="/tinnitus-sound-matching/">Find My Tinnitus Sound</a> if you have not done it yet — a couple of minutes, and you come straight back. A pitch you accepted in Personalized Notched Sound counts too.</li>
<li><strong>Headphones or earbuds, somewhere reasonably quiet.</strong> Use the same ones for the whole session if you can.</li>
<li><strong>A comfortable level, never more.</strong> You set the level yourself with a sample sound. It does not need to cover your tinnitus, and nothing in the experiment ever turns it up.</li>
<li><strong>When not to use it.</strong> Do not continue — and get a medical evaluation — if your tinnitus is sudden or new and has not been evaluated, if you have sudden hearing loss, ear pain, fluid from an ear, sudden or severe dizziness, pain from ordinary sounds, or a sudden major change in your tinnitus. The app asks you to confirm this before the first session.</li>
</ul>
<h2>What a session looks like</h2>
<ol>
<li><strong>A quiet start.</strong> If something is playing in the app, you are asked to stop it first, so every test begins from silence.</li>
<li><strong>How noticeable is it right now?</strong> You rate your tinnitus from 0 to 10 and say whether today is quieter, louder or about usual. This is the day’s starting point.</li>
<li><strong>Set the level.</strong> Start low and raise a sample sound until it is clear and comfortable.</li>
<li><strong>Each sound test.</strong> A quick 0–10 rating, then the sound plays for one minute — just listen normally. It stops, there are five seconds of silence, and the app asks <em>What happened to your tinnitus?</em> — much quieter, a little quieter, about the same, louder, or not sure. You can add a 0–10 rating or skip it.</li>
<li><strong>If it became quieter,</strong> the app waits with you. Tap the button when your tinnitus is back to its usual level; the time is measured silently, with no clock on screen, so you are not tempted to stretch it. You can also say it became louder instead, or that you are not sure.</li>
<li><strong>A short rest,</strong> at least 45 seconds, then the next sound. The first session tries three sounds; later sessions try one to three, and from the second session on the app tells you roughly how long today will take before you begin. You can pause a sound for up to 15 seconds in total; a longer pause, switching apps or leaving the screen marks that test as interrupted, and leaving Sound Response ends the session. The test sounds have their own level control: the app’s volume slider does not affect them, but your device’s volume does.</li>
</ol>
<p>Every question is short on purpose, and “not sure” is always an honest answer. There are no right or wrong results.</p>
<h2>Which sounds it tries</h2>
<p>All of them are noise, never tones, and each plays for the same one minute at the same matched level:</p>
<ul>
<li><strong>Narrow-band noise around your pitch</strong> — a third of an octave wide, centred on your matched pitch, and versions centred a little below and a little above it.</li>
<li><strong>Broadband noise</strong> — the whole range, roughly 100 Hz to 12 kHz, as a comparison.</li>
<li><strong>A pulsing version</strong> of the narrow band (40 pulses per second) in later sessions. Small studies found pulsing sounds produced more residual inhibition than steady noise, so it is included as an exploratory condition — no rate has been shown to be best.</li>
</ul>
<p>Sounds are matched to each other by measured energy at the level you chose, so a narrow band is never louder than the broadband noise. If a sound is followed by a repeatable change, later sessions gently vary its centre, width and pulsing to see what matters.</p>
<h2>How it decides what to test next</h2>
<ul>
<li><strong>One quieter response is only “promising”.</strong> Tinnitus fluctuates and expectation is real, so nothing is concluded from a single answer.</li>
<li><strong>Repeatable</strong> means quieter after at least two of the first three separate tests of that sound, in different sessions. That threshold is a design choice of the app, not a medical one.</li>
<li><strong>Then a comparison.</strong> A repeatable sound is paired with a comparison sound — same length, same level, unnamed on screen — in three to six pairs over separate sessions. The only question is whether the quieter response goes with that sound more often than with the comparison. The profile then says one of three things: the response appeared more consistently with that sound; several different sounds were followed by reductions, so it does not look specific to one; or the results are not consistent enough yet to tell.</li>
<li><strong>Louder responses are respected.</strong> A sound followed by “louder” is not repeated that day; twice, and it is set aside for good. If an increase feels uncomfortable, the session ends there, that sound is set aside, and the app suggests giving your tinnitus time to settle.</li>
<li><strong>Nothing to find is a valid result.</strong> If ten valid tests produce no repeatable change, the app says so and stops testing. Your records are kept.</li>
</ul>
<h2>Why a session sometimes ends early</h2>
<p>The app stops rather than muddle the next test: when your tinnitus has not settled back to where the day started, when a change lasts fifteen minutes or more, when it does not hear back from you within half an hour, when an increase felt uncomfortable, or when sound could not start on the device. Switching apps or letting the screen sleep during a test marks that one test as interrupted and it is simply tried again another time — nothing from it is recorded as a result.</p>
<h2>Your Sound Response Profile</h2>
<p>After every session the profile shows the plain counts: sessions, sounds tested, temporary reductions, and — once there is enough to say — the most consistent response, the typical (middle) duration, the observed range and the longest change. A progress line shows which stage you are at, and <em>View experiment details</em> lists every sound with its exact band, what happened each time and the protocol version. There is deliberately no single score: how often a change appears, how long it lasts and whether anything made things louder are different questions, and one number would hide the pattern.</p>
<p>Once a sound is repeatable you can <strong>listen to your response sound</strong> at any time from the profile. It plays for the same fixed minute and nothing is recorded — it is there so you can hear it, not to treat anything.</p>
<h2>Where the results live</h2>
<p>Sound Response is part of the <strong>Find My Sound</strong> section, next to Help Me Find My Sound and Find My Tinnitus Sound. <strong>My Sound Profile</strong> shows the sound preferences learned by Help Me Find My Sound and the Sound Response summary; your tinnitus match stays with Find My Tinnitus Sound. Everything stays on your device — nothing is uploaded — and <em>Delete my Sound Response data</em> in the experiment details removes every session, test and the profile in one step.</p>
<h2>What it cannot tell you</h2>
<ul>
<li>Whether any sound <strong>treats</strong> your tinnitus, or whether a change will last. Residual inhibition is temporary by definition.</li>
<li>Whether you show residual inhibition “at all”. Clinics test at and above the level that masks the tinnitus; Sound Response stays at a comfortable level on purpose, so it will miss some responses that a clinic would find.</li>
<li>Anything statistical. Three to six self-reported pairs cannot carry statistics, and none are attempted.</li>
</ul>
<p>Read it as a diary of what you noticed, kept carefully. If you want to talk it over, the experiment details are written so an audiologist can follow exactly what was played and when.</p>
<p><a href="/#ri">Open Sound Response →</a></p>`,
  sources: ['ri', 'pitch', 'aao', 'nidcd'],
});

learn({
  slug: 'experiments-explained', updated: '2026-09-27',
  title: 'The Experiments in Find My Quiet Sound, Explained',
  description: 'What each Experiment in Find My Quiet Sound does, where the idea comes from, how strong the evidence is, and the safety rules they all share — Frequency Painting, Sound Sculptor, Generative Sound, Sound Space, Attention Focus, journeys and more.',
  h1: 'The Experiments, explained',
  intro: 'The Experiments section is where Find My Quiet Sound tries ideas that go beyond pressing play on a sound: drawing the shape of a noise, describing a sound in plain words, letting a soundscape evolve, or giving your attention somewhere calm to rest. Each one carries a short “why are we testing this?” note and an honest evidence label. This page gathers them in one place so you know what you are trying before you tap Start.',
  body: `
<h2>The evidence labels</h2>
<p>Every experiment shows one of four labels. <strong>Well-studied principle</strong> means the idea itself is established. <strong>Promising research</strong> means controlled studies exist and point the right way, but not for this exact tool. <strong>Experimental — research is limited</strong> means the idea comes from sound design or interface design rather than clinical work. <strong>Experimental — evidence is mixed</strong> means studies disagree. None of the labels claims a treatment effect; the only outcome any experiment measures is your comfort and preference.</p>
<h2>Rules every experiment follows</h2>
<ul><li>Everything starts quiet and fades in; nothing starts abruptly.</li><li>No experiment ever raises your volume on its own.</li><li>Every experiment stops instantly with <em>Stop</em>.</li><li>Feedback you give (“more comfortable”, “no difference”) stays on your device and is about comfort, never medical outcomes.</li></ul>
<h2>Discover — find a sound that suits you</h2>
<h3>Help Me Find My Sound</h3><p><em>Promising research.</em> It lives in the Find My Sound section rather than in the Experiments list, but it is built the same way. Two sounds at a time, “which feels more comfortable?”, about twelve rounds, and the app hands you your sound. It learns what you prefer and says nothing about your hearing. Full guide: <a href="/learn/how-to-use-find-my-sound/">How to use Help Me Find My Sound</a>.</p>
<h3>Frequency Painting</h3><p><em>Experimental — research is limited.</em> Paint the noise you want to hear: left is low, right is high, higher means stronger, and what you draw is what you hear straight away. Some people want the lows, some an airy hiss, some a dip where the tinnitus sits. Shaping a sound’s spectrum is ordinary audio practice; what the app is learning is whether drawing gets people to a comfortable sound faster than picking a noise colour.</p>
<h3>Sound Sculptor</h3><p><em>Experimental — research is limited.</em> Shape a sound with words instead of controls: Warm ↔ Bright, Deep ↔ Airy, Smooth ↔ Textured, Soft ↔ Crisp, Centred ↔ Wide, Still ↔ Moving, Simple ↔ Rich. An interface experiment — you should not need to know what a filter is to make a sound that suits you.</p>
<h3>Personalized Notched Sound</h3><p><em>Experimental — evidence is mixed.</em> Broadband sound (or your own audio) with a gap around your matched tinnitus pitch — one octave wide as standard, narrower or wider if you choose — switchable between normal and notched. Early studies were positive, a large trial found no advantage over placebo, and reviews rate the evidence as low quality. Full guide: <a href="/learn/notched-sound-for-tinnitus/">Notched sound for tinnitus</a>.</p>
<h2>Explore — sounds that move and blend</h2>
<h3>Generative Sound</h3><p><em>Experimental — research is limited.</em> Rain, ocean, wind, forest, an abstract ambience, broadband noise, or <strong>Ambient Drift</strong> — slowly evolving music that never plays exactly the same way twice — with one Stable ↔ Organic control. Real rain never repeats; small variation feels natural and may be easier to stop noticing over a long session. Sound-therapy research mostly tests steady sound, so this comes from ambient sound design, not trials.</p>
<h3>Sound Morph</h3><p><em>Experimental — research is limited.</em> One slider that glides from brown noise through pink to rain. Sometimes the comfortable spot is between two sounds; this asks whether one dimension finds it faster than a mixer.</p>
<h3>Sound Space</h3><p><em>Experimental — research is limited.</em> Place sounds around you on a simple map — rain to the left, ocean in front, wind far right — stationary by default, with optional very slow movement (about nine minutes per circle). Moving a sound changes where it sits and how distant it feels in tone; it does not change its level. Space gives each sound its own place so a mix feels less crowded, and one controlled study found slow spatial movement more relaxing than static sound.</p>
<h2>Focus — somewhere for attention to rest</h2>
<h3>Attention Focus</h3><p><em>Promising research.</em> Gentle visual activities — Follow the Light, Floating Bubble, Ripple, Notice the Change — with no scores, no timers and no failing. Practising where attention goes is the idea behind attention-training studies for tinnitus; a randomised trial of an attention-training game reduced tinnitus distress more than a control game. Promising for distress; no claim about loudness.</p>
<h3>Sound + Visual Journey</h3><p><em>Promising research.</em> Sound and picture evolve together over 20–40 minutes — Ocean to Night, Rain to Sleep, Forest Evening. With the fade option on, it ends soft; otherwise the last sound stays on until you stop it. Studies of virtual nature find audio and visuals together relax more than either alone. Relaxation only.</p>
<h2>Sessions — built for you</h2>
<h3>Adaptive Sound Journey</h3><p><em>Experimental — research is limited.</em> A soundscape that changes very slowly: brown noise and rain, then less rain, an ocean appears, the sound warms, simplifies, and — with the sleep option on — fades away at the end. A loop becomes familiar and easy for the brain to set aside — which can let tinnitus back in; slow change keeps sound gently interesting without asking for attention.</p>
<h3>Build My Session</h3><p><em>Experimental — research is limited.</em> Four quick questions — what you are doing, which sound you prefer, visuals or not, how much variation — and a session is built for you. A convenience experiment: when you are tired you should not have to design anything.</p>
<h2>Where Sound Response fits</h2>
<p><strong>Sound Response</strong> — Discover What Changes Your Tinnitus — lives in the Find My Sound section rather than in Experiments, because it follows a fixed protocol and records observations over several sessions. It has its own guide: <a href="/learn/how-sound-response-works/">How Sound Response works</a>.</p>
<h2>Free and Premium</h2>
<p>Everything is free to use today. The experiments marked <em>Premium · free during launch</em> are the personalisation layer that may become an optional Premium plan later; any change will be announced clearly first and nothing you have saved will be deleted. See <a href="/premium/">Free and Premium</a>.</p>
<p><a href="/#lab">Open Experiments →</a></p>`,
  sources: ['cochrane', 'okamoto', 'stein', 'vr', 'bbn', 'ata'],
});

learn({
  slug: 'visual-focus-explained', updated: '2026-09-27',
  title: 'Visual Focus, Explained — Calm Visuals to Pair with Tinnitus Sounds',
  description: 'What Visual Focus in Find My Quiet Sound is for, how to choose an environment, what the movement and reduce-motion settings do, how Enter Focus and saved sessions work, and what the evidence says about sound and picture together.',
  h1: 'Visual Focus, explained',
  intro: 'Visual Focus gives your eyes something slow and calm to rest on while a sound plays: an ocean, rain on a window, drifting clouds, a breathing circle, or a pattern that moves with the sound itself. Nothing flashes, nothing scores you, and every visual can be slowed down or stilled. This page explains what is in it and how to use it.',
  body: `
<h2>What it is for</h2>
<p>Attention is part of how loud tinnitus feels. A calm picture paired with a comfortable sound gives attention somewhere else to go, and studies of virtual nature scenes found that sound and visuals together relax people more than either alone. That is the whole claim: relaxation and a place to rest your attention. Visual Focus does not treat tinnitus, and it is not a substitute for a dark, quiet room when you want one.</p>
<h2>Suggested environments</h2>
<p>The quickest way in is a suggested environment. One tap sets both the sound and the picture, and you can change either afterwards:</p>
<ul>
<li><strong>Deep Ocean</strong> — brown noise with ocean waves.</li>
<li><strong>Rain Window</strong> — pink noise and rain, with the rain-on-a-window visual.</li>
<li><strong>Night Float</strong> — brown noise with night sounds under a night sky.</li>
<li><strong>Soft Ripple</strong> — pink noise with slow ripples.</li>
<li><strong>Deep Focus</strong> — your personal sound from Help Me Find My Sound, with Abstract Flow.</li>
<li><strong>Fireside</strong> — a fireplace over a low bed of brown noise.</li>
</ul>
<h2>All visuals</h2>
<p>Below the suggestions the whole library is grouped by what the visual does:</p>
<ul>
<li><strong>Nature</strong> — Underwater (the starting visual), Deep Ocean, Rain Window, Forest Breeze, Waterfall, Flowing River, clouds, a night sky, a fireplace.</li>
<li><strong>Abstract</strong> — Abstract Flow, Slow Geometry, Slow Waves, Flowing Colours, Soft Light, Expanding Circles, Floating Particles, Gentle Tunnel.</li>
<li><strong>Sound Reactive</strong> — visuals that move with the sound you are playing: Audio Spectrum, Moving Waveform, Sound Ripples, Reactive Particles, Pulsating Rings, Sound Field, Synced Scene, and Frequency Bloom, which blooms around the tone of the frequency generator.</li>
<li><strong>Interactive</strong> — visuals that respond to a touch or a slow drag, such as touch circles and gentle followers.</li>
<li><strong>Breathing</strong> — a breathing circle that expands and contracts in a steady rhythm, with optional “Breathe in / out” text. Its pace follows the Movement setting: about 15 seconds a breath at Medium, slower at Low, much faster at High, and still at Still.</li>
<li><strong>Focus Activities</strong> — Follow the Light, Floating Bubble, Ripple, Colour Flow and Living Pattern: gentle things to rest attention on, with no scores or timers. The <a href="/learn/experiments-explained/">Attention Focus experiment</a> uses the first three plus Notice the Change.</li>
</ul>
<h2>Movement and motion settings</h2>
<ul>
<li><strong>Movement</strong> — Still, Low, Medium or High sets how much every visual moves. Still keeps a picture almost completely static; it is a good choice at night or if movement tires your eyes.</li>
<li><strong>Reduce motion</strong> — a switch that calms all movement further. It starts from your device’s own reduce-motion setting; once you change it here, your choice is kept.</li>
<li><strong>“Breathe in / out” text</strong> — on or off for the breathing visual.</li>
</ul>
<p>Nothing in Visual Focus flashes, and everything eases in and out rather than jumping.</p>
<h2>Enter Focus</h2>
<p><strong>Enter Focus</strong> opens the chosen environment full screen (tapping a visual tile also opens it after a moment). The controls fade away; tap anywhere to bring them back, change the sound or visual, pause the visual, set a timer, or adjust movement. On a computer you can also go truly full screen. To leave, use <em>Stop visual</em>, which keeps the sound playing and returns you to the Sounds page, or <em>Stop everything</em>; Escape and Back also close it.</p>
<h2>Saving and coming back</h2>
<p><strong>Save environment</strong> keeps the current sound and visual together under <em>My Saved Sessions</em>, so a combination you like is one tap away next time. If you have completed Help Me Find My Sound, the app also recommends a visual that suits your taste, and the <strong>Your Focus</strong> Moment on the Sounds page starts your personal sound with the visual you last used here (Underwater until you pick one). Saved sessions stay on your device.</p>
<h2>Visual Focus and Sleep Mode</h2>
<p>Visual Focus is for when you are awake and looking at the screen. For bedtime, <a href="/tinnitus-sleep-sounds/">Sleep Mode</a> is the better fit: a darker, simpler screen with a timer that fades the sound out gently. The <a href="/learn/experiments-explained/">Sound + Visual Journey</a> experiment sits between the two — a picture and a sound that evolve together over twenty to forty minutes and end soft.</p>
<p><a href="/#focus">Open Visual Focus →</a></p>`,
  sources: ['vr', 'ata'],
});

learn({
  slug: 'getting-around-find-my-quiet-sound', updated: '2026-09-27',
  title: 'Getting Around Find My Quiet Sound — Sounds, Moments, Presets and Everyday Controls',
  description: 'A plain tour of Find My Quiet Sound: the sound library, the play circle and its controls, Your Moments, Tuned to You, one-tap presets, saved mixes and sessions, Sleep Mode, installing the app, working offline, and where every tool lives.',
  h1: 'Getting around Find My Quiet Sound',
  intro: 'Find My Quiet Sound is built so that the first tap does something useful: pick a sound, and it starts low and fades in. Everything else — personal Moments, presets, saved mixes, sleep timers, the finder tools and the experiments — is there when you want it. This page walks through the app once, so you know what each part is for and where to find it.',
  body: `
<h2>The Sounds page</h2>
<p>The library is grouped so you can browse by character rather than by name: <strong>Noise</strong> (white, pink, brown, gentle static, soft hiss), <strong>Water</strong> (rain, rain on a window, ocean, lapping water, flowing water, waterfall), <strong>Nature</strong> (forest, rustling leaves, wind, crickets, cicadas, night sounds, summer night), and <strong>Environment</strong> (fan, fireplace). A few sounds live only inside the experiments: Generative Sound offers Ambient Drift, slowly evolving music that never plays exactly the same way twice, and Gentle Chimes; the sounds you make in Frequency Painting or Sound Sculptor appear under <em>My Saved Sounds</em> once you save them. Every sound is generated live in the browser, so nothing loops with a click and nothing has to download; read <a href="/learn/how-tinnitus-sound-generators-work/">how the sounds are made</a>.</p>
<h2>The circle and its controls</h2>
<p>Tap any sound and the big circle starts it, quietly. Under it sit <strong>Volume</strong>, <strong>Pause</strong> and <strong>Stop all sounds</strong>, plus <strong>Add sound</strong>, <strong>Timer</strong>, <strong>Add Visual</strong>, <strong>Mixer</strong> and <strong>Save</strong>, and on the Sounds page <strong>Immerse</strong>, which opens a full-screen player with nothing else on screen. The same volume control appears on every screen that plays sound, with a smaller set of actions that fits the place. The volume starts at 35% on first use and remembers your last level, never above 60% when you come back; every sound fades in and out; a warning appears if you go above 75% on any volume slider; and no feature ever raises the volume on its own. If you would rather talk than tap, <a href="/learn/ask-find-my-quiet-sound/">Ask Find My Quiet Sound</a> takes plain requests such as “something gentle for sleep”.</p>
<h2>Your Moments</h2>
<p>From your first choices in <a href="/learn/how-to-use-find-my-sound/">Help Me Find My Sound</a>, four one-tap Moments appear at the top of the Sounds page, each built from your own preferences (they get better as you complete more rounds):</p>
<ul>
<li><strong>Your Quiet</strong> — your sound, ready now.</li>
<li><strong>Your Sleep</strong> — a 60-minute session with a gentle fade at the end.</li>
<li><strong>Your Focus</strong> — your sound with the visual you last used in Visual Focus (Underwater until you pick one).</li>
<li><strong>Woke Up at Night</strong> — an extra-gentle 30-minute version for the middle of the night.</li>
</ul>
<h2>Tuned to You</h2>
<p>After a few comparisons in Help Me Find My Sound, a small <em>Tuned to you</em> chip appears beside the controls. It applies two gentle, reversible touches to whatever you play: people who consistently chose warmer sounds get the very top of the sound softened, and people who chose moving sounds get a little of the engine’s slow variation. It never rewrites a sound’s character — hiss stays hissy, cicadas stay bright — and it never touches the frequency generator or Find My Tinnitus Sound, which must always play exactly as set. One tap turns it off.</p>
<h2>One-tap presets and saved items</h2>
<p><strong>One-tap presets</strong> are ready-made blends: Gentle Relief (soft broadband sound, low), Sleep (brown noise and gentle rain), Focus (pink noise and subtle nature), Ocean, Rainy Night, Rain on Window and Summer Night. Below them the app keeps what you make yourself: <strong>My Saved Mixes</strong> (Save on the Sounds page, in Immerse, on the sleep screen, in the <a href="/tinnitus-sound-mixer/">mixer</a>, or a Sound Morph blend), <strong>My Saved Sessions</strong> (Save environment in Visual Focus, Save on the Focus screen, or Build My Session), and <strong>My Saved Sounds</strong> from Frequency Painting, Sound Sculptor and Help Me Find My Sound. All of it stays on this device.</p>
<h2>Sleep Mode</h2>
<p><a href="/tinnitus-sleep-sounds/">Sleep Mode</a> is a darker, simpler screen for bedtime. Choose 15, 30, 60 or 90 minutes or leave it continuous, keep <em>gradual fade-out</em> on so the sound eases away before the timer ends, and pick a preset or build a session from your profile. The sleep screen shows the clock, the time remaining and your sounds, with volume, pause, stop, timer and save close at hand. The Timer control on any screen also takes a custom length from 5 to 180 minutes, always with the fade. Practical advice on levels, speakers versus earbuds and night-time listening is in <a href="/learn/tinnitus-and-sleep/">using sound at night</a>.</p>
<h2>Find My Sound</h2>
<p>The <strong>Find My Sound</strong> section holds the three tools that learn something about you, and the one place they report to. <a href="/learn/how-to-use-find-my-sound/">Help Me Find My Sound</a> discovers the sound you prefer; <a href="/learn/tinnitus-frequency-matching/">Find My Tinnitus Sound</a> explores the pitch and character of the sound you hear; <a href="/learn/how-sound-response-works/">Sound Response</a> records whether your tinnitus is temporarily quieter after particular sounds. <strong>My Sound Profile</strong> shows your sound preferences and your Sound Response summary, on this device. <em>Clear</em> on the preferences card removes the preferences, your experiment ratings and play counts; Sound Response records are deleted from <em>View experiment details</em> in Sound Response; a saved tinnitus match is forgotten from Find My Tinnitus Sound itself.</p>
<h2>Mixer, Frequency Generator, Visual Focus and Experiments</h2>
<p>The <a href="/tinnitus-sound-mixer/">Mixer</a> layers up to five sounds with their own level and left–right balance. The <a href="/tinnitus-frequency-generator/">Frequency Generator</a> plays a continuous tone from 20 Hz to 16 kHz at a lower level cap than other sounds. <a href="/learn/visual-focus-explained/">Visual Focus</a> pairs a calm picture with your sound. <a href="/learn/experiments-explained/">Experiments</a> is where the app tries ideas that go beyond pressing play, each with an evidence label.</p>
<h2>The first time you open it</h2>
<p>A short welcome explains the three ideas the app is built on (choose a sound, keep it comfortable, personalise it) and ends with <em>Start Listening</em>. On the website a small card asks whether we may count your visit; <em>No thanks</em> is a full answer and can be changed later on the Privacy page. Below the sound library a five-step starter guide (<em>New here? Get comfortable with sound</em>) is there if you want it and can be dismissed. Your Moments, the profile suggestions in Visual Focus and Sleep, and the <em>Tuned to you</em> chip only appear once Help Me Find My Sound has something to work from, so on a first visit those spots are simply empty.</p>
<h2>Install, offline and privacy</h2>
<p>An <strong>Install app</strong> button appears in the top bar on browsers that offer installation (Chrome and Edge; on iPhone and iPad use Safari’s Share → Add to Home Screen instead). The app keeps its own files in the browser after your first visit, so the sounds keep working without a connection; Ask, Your Moments and Tuned to you become available offline from your second online visit. There is no account. Your settings, saved items, profile and experiment records live in your browser’s storage on this device and are not uploaded; see <a href="/privacy/">Privacy</a> for exactly what is kept and how to clear it.</p>
<h2>Small things that help</h2>
<ul>
<li><strong>Back</strong> — the ← Back button in the top bar, your browser’s back button, or the Backspace key all step back through the app; Escape closes the sleep screen and Immerse; Space plays or pauses.</li>
<li><strong>Light or dark</strong> — the moon and sun button in the top bar.</li>
<li><strong>Learn</strong> — the Learn tab has safe-listening basics, when to see a professional, and links to every guide.</li>
</ul>
<p><a href="/">Open Find My Quiet Sound →</a></p>`,
  sources: ['who', 'ata', 'nidcd'],
});

// ===== TRUST PAGES =====
const trust = (o) => PAGES.push(Object.assign({ type: 'trust' }, o));
trust({
  path: 'about/', title: 'About Find My Quiet Sound', description: 'Find My Quiet Sound is a free, privacy-first tinnitus sound studio: masking sounds, a mixer, frequency tools, sleep mode and calm visuals. Independent, no account.',
  h1: 'About Find My Quiet Sound',
  body: `
<p>Find My Quiet Sound is a free web app for people with tinnitus who want comfortable background sound. It is built around one idea: <strong>everyone experiences tinnitus differently, so everyone’s comfortable sound is different too.</strong> Find My Quiet Sound makes trying, comparing and shaping sounds easy, keeps every level low, and helps you keep what you find.</p>
<h2>What it is</h2>
<ul><li>A <a href="/tinnitus-sound-generator/">sound generator</a> with twenty synthesised sounds that loop seamlessly.</li><li>A <a href="/tinnitus-sound-mixer/">mixer</a>, a <a href="/tinnitus-frequency-generator/">frequency generator</a>, a guided <a href="/tinnitus-sound-matching/">sound-matching</a> tool and <a href="/tinnitus-sleep-sounds/">Sleep Mode</a>.</li><li>Visual Focus — calm visuals to watch while listening.</li><li>Experiments — personal sound discovery: compare sounds two at a time, paint or sculpt your own, and build sessions; each experiment carries a plain-English "why are we testing this?" note and an evidence label.</li><li>Sound Response — <a href="/learn/how-sound-response-works/">Discover What Changes Your Tinnitus</a>: short, level-matched sound tests that record whether your tinnitus is temporarily quieter afterwards, kept in My Sound Profile on your device.</li></ul>
<h2>What it is not</h2>
<p>It is not a medical device, a hearing test or a treatment. It does not diagnose, treat or cure tinnitus. See the <a href="/medical-disclaimer/">medical disclaimer</a>.</p>
<h2>How it is made</h2>
<p>Everything is generated on your device with the Web Audio API and HTML Canvas. There are no audio files to download and no server; your favourites and settings stay in your browser. The source is open at <a href="https://github.com/debra-lang/softwave" rel="noopener">github.com/debra-lang/softwave</a>.</p>
<h2>Independence</h2>
<p>Find My Quiet Sound does not sell hearing aids, supplements, courses or "neuromodulation" programmes, and it has no affiliate links. Guidance on this site is written from the sources listed on <a href="/research-and-sources/">Research &amp; Sources</a>; where evidence is limited, the page says so.</p>
<p><a href="/contact/">Contact</a> · <a href="/privacy/">Privacy</a> · <a href="/safe-listening/">Safe listening</a></p>`,
});
trust({
  path: 'how-it-works/', title: 'How Find My Quiet Sound Works — Sounds, Mixing, Frequency Tools and Safety',
  updated: '2026-09-27',
  description: 'How Find My Quiet Sound generates tinnitus sounds in the browser, how mixing and the frequency tools work, and the safety rules every feature follows.',
  h1: 'How Find My Quiet Sound works',
  body: `
<h2>Sound generation</h2>
<p>White noise is random samples; pink and brown noise are white noise passed through filters so that energy falls with frequency. Loops are generated with a pre-roll cross-fade so the last sample flows into the first — no click, no gap. Nature sounds are layers of filtered noise with slow modulation and small random events (rain droplets, fire crackles, bird calls, crickets), so they never repeat exactly.</p>
<h2>Mixing</h2>
<p>Up to five sounds run at once, each with a gain, a low-pass filter and a stereo panner, into a master chain with a gentle limiter. Per-sound loudness trims keep the sliders feeling balanced. Everything ramps — nothing starts abruptly.</p>
<h2>Frequency tools</h2>
<p>The frequency generator uses an oscillator (or a filtered noise band for hiss-like tinnitus) with 1 Hz resolution from 20 Hz to 16 kHz and a lower level cap than other sounds. Find My Tinnitus Sound is a guided version with an octave check.</p>
<h2>Sound Response</h2>
<p>Discover What Changes Your Tinnitus plays one-minute test sounds built from seeded noise: a third-octave band-pass around your matched pitch (or broadband noise, 100 Hz to 12 kHz), optionally amplitude-modulated, faded in and out. Every test sound is matched to the others by measured energy at the level you chose, that level is capped, and nothing in the experiment raises it. Five seconds of silence follow each sound before the question, at least 45 seconds of rest separate tests, and a change is timed silently until you say your tinnitus is back to usual. The protocol and the adaptive rules are versioned (RI-WEB-V1.0, RI-ADAPT-V1.1) and shown in the experiment details. <a href="/learn/how-sound-response-works/">How Sound Response works</a>.</p>
<h2>Visuals</h2>
<p>All visuals are procedural Canvas drawings with a global movement level (Still / Low / Medium / High), a Reduce Motion switch that starts from your device setting (once you change it in the app, your choice is kept), and nothing that flashes.</p>
<h2>Accessibility</h2>
<p>A skip-to-content link, visible focus rings and labelled controls throughout. On a keyboard, Space plays or pauses, Backspace steps back, and Escape closes the sleep screen and Immerse. Frequency Painting has a slider alternative to drawing, and the Sound Response 0–10 scale can be set with the arrow keys. Every visual can be stilled, and Reduce Motion starts from your device setting.</p>
<h2>Safety rules</h2>
<ul><li>Master volume starts at 35% and is never restored above 60%.</li><li>Every sound fades in (about 1.2 s) and out; journeys cross-fade over a minute or more.</li><li>A limiter prevents spikes when layering.</li><li>A warning appears above 75% master.</li><li>No feature raises the volume on its own.</li></ul>
<h2>Privacy</h2>
<p>No account is required. Your settings, results and creations — including saved mixes, experiment feedback, your Find My Tinnitus Sound result and your Sound Response sessions and profile — stay in local storage on your device. Website visitors can choose to allow limited Google Analytics, which counts visits and pages and, for Sound Response, which steps of the experiment were reached (opened, safety accepted, session started or completed, profile viewed) — never ratings, responses, sounds, results or anything you enter. The current iPhone app does not use Google Analytics. See <a href="/privacy/">Privacy</a>.</p>`,
});
trust({
  path: 'research-and-sources/', title: 'Research & Sources Behind Find My Quiet Sound',
  description: 'The guidelines, reviews and studies that inform Find My Quiet Sound’s guidance and experiments, with evidence levels and what each source does and does not support.',
  h1: 'Research &amp; sources',
  body: `
<p>Find My Quiet Sound’s guidance is written from the sources below. The app does not claim to treat tinnitus; each experiment shows its own evidence level. Last reviewed ${REVIEWED}.</p>
<h2>In plain English</h2>
<ul>
<li><strong>What sound masking is.</strong> Adding a steady, pleasant external sound so that tinnitus is partly covered and easier to ignore. It manages the experience; it does not change the tinnitus itself.</li>
<li><strong>What is reasonably established.</strong> Tinnitus is common and usually linked to the hearing system; a hearing evaluation is the standard first step. Sound at a low level is widely used, low-risk, and valued by many people; clinical guidelines say it <em>may</em> be offered for bothersome tinnitus. Counselling approaches such as CBT have the best evidence for reducing distress. Slow breathing is well supported for relaxation.</li>
<li><strong>What is still uncertain.</strong> Whether any particular sound (white, pink, brown, nature) is better than another; whether sound alone reduces tinnitus severity over the long term; notched sound, pulsed tones and "neuromodulation" patterns (mixed or inconclusive trials); and everything we label experimental here.</li>
<li><strong>Why individual preference matters.</strong> In the studies that compared sounds, responses varied widely between people and preference predicted whether someone kept using a sound. That is why Find My Quiet Sound is built around discovery and comparison rather than one recommended sound.</li>
<li><strong>Why experiments are labelled experimental.</strong> When the evidence for an idea is limited, mixed, or borrowed from another field, the label says so, and the experiment asks only how it felt to you. That feedback stays on your device.</li>
</ul>
<h2>Guidelines and organisations</h2>
<ul>${['nidcd', 'ata', 'aao', 'who', 'informed'].map(k => `<li><a href="${SRC[k].u}" rel="noopener">${SRC[k].t}</a></li>`).join('')}</ul>
<h2>Reviews and trials on sound</h2>
<ul>${['cochrane', 'mixing', 'bbn', 'tmnmt', 'ri', 'harvard'].map(k => `<li><a href="${SRC[k].u}" rel="noopener">${SRC[k].t}</a></li>`).join('')}</ul>
<h2>Pitch matching</h2>
<ul>${['pitch', 'ipod'].map(k => `<li><a href="${SRC[k].u}" rel="noopener">${SRC[k].t}</a></li>`).join('')}</ul>
<h2>Attention, relaxation and sleep</h2>
<ul>${['mbct', 'vr', 'sleepf'].map(k => `<li><a href="${SRC[k].u}" rel="noopener">${SRC[k].t}</a></li>`).join('')}</ul>
<h2>How to read the evidence labels in Experiments</h2>
<ul><li><strong>Well-studied principle</strong> — multiple trials or guideline support for the underlying idea (not necessarily for the app feature).</li><li><strong>Promising research</strong> — at least one controlled trial, modest or short-lived effects.</li><li><strong>Experimental — research is limited</strong> — pilots, mechanism papers, or evidence only from a neighbouring field.</li><li><strong>Experimental — evidence is mixed or limited</strong> — conflicting or sparse results.</li></ul>
<p>A fuller internal write-up, including ideas that were deliberately not built, is in the project’s <a href="https://github.com/debra-lang/softwave/blob/main/RESEARCH.md" rel="noopener">RESEARCH.md</a>.</p>`,
});
trust({
  path: 'safe-listening/', title: 'Safe Listening with Tinnitus Sounds',
  description: 'Safe listening with tinnitus sounds: the lowest helpful level, WHO headphone limits, breaks, speakers at night, and how Find My Quiet Sound’s defaults protect hearing.',
  h1: 'Safe listening',
  body: `
<ul>
<li><strong>Start low.</strong> Use the lowest comfortable listening level that gives you the experience you want. You do not need to completely cover your tinnitus. Louder is not necessarily better. Find My Quiet Sound starts every sound low and fades it in.</li>
<li><strong>Take breaks.</strong> Pause during longer listening sessions. If a sound causes discomfort or seems to make your tinnitus worse, stop using it and lower the volume before trying again.</li>
<li><strong>Headphone time.</strong> The WHO-ITU safe-listening standard suggests personal audio around 80 dB or less for no more than 40 hours a week (75 dB for children). A device’s volume percentage does not reliably correspond to decibels, so the practical rule stays the lowest comfortable level.</li>
<li><strong>Speakers are fine</strong> — often better for all-night use.</li>
<li><strong>Sound sensitivity (hyperacusis):</strong> stay at the quietest setting, and seek a clinician’s plan if everyday sounds hurt.</li>
</ul>
<h2>How the app protects you</h2>
<p>35% default level, never restored above 60%; fade-ins and fade-outs on everything; a limiter on the mix; a warning above 75%; tones capped lower than noise; nothing raises the volume by itself.</p>
${disclaimer}`,
  sources: ['who', 'nidcd', 'ata'],
});
trust({
  path: 'medical-disclaimer/', title: 'Medical Disclaimer — Find My Quiet Sound',
  description: 'Find My Quiet Sound is a sound-masking and relaxation tool, not a medical device. It does not diagnose, treat or cure tinnitus. When to see a professional.',
  h1: 'Medical disclaimer',
  body: `
<p>This app is designed for sound masking, relaxation, and tinnitus management support. It does not diagnose, treat, or cure tinnitus and is not a substitute for professional medical care.</p>
<p>Nothing on this site is medical advice. Experimental features are exploratory tools for relaxation, attention, sound personalisation and tinnitus management support; they are not proven treatments and may not work for everyone. The frequency and matching tools are not hearing tests.</p>
<h2>When to talk to a professional</h2>
<p>See a doctor, audiologist or ENT specialist if your tinnitus is new or changed suddenly; is persistent, getting worse, or distressing; is in one ear only; comes with hearing difficulty, fullness or dizziness; pulses with your heartbeat; started after an injury; or is affecting sleep, mood or concentration. A hearing evaluation is the usual first step.</p>
<p>Find My Quiet Sound has no medical staff and makes no claims of clinical review. Sources used for guidance are listed on <a href="/research-and-sources/">Research &amp; Sources</a>.</p>`,
  sources: ['aao', 'nidcd'],
});
trust({
  path: 'terms/', title: 'Terms of Use — Find My Quiet Sound',
  updated: '2026-09-27',
  description: 'The plain-language terms for using Find My Quiet Sound: personal use, no medical claims, safe listening, your data stays yours, and the service is provided as-is.',
  h1: 'Terms of Use',
  body: `
<p>These terms are short on purpose. By using Find My Quiet Sound you agree to them.</p>
<h2>What the service is</h2>
<p>Find My Quiet Sound is a sound generator for masking, relaxation and tinnitus management support. It is provided for personal, non-commercial use. It is currently free to use; as the app evolves, some features may become part of an optional Premium plan, and any pricing or access changes will be communicated clearly before they take effect.</p>
<h2>Not medical advice</h2>
<p>Find My Quiet Sound does not diagnose, treat or cure tinnitus or any condition, and nothing in the app or on this site is medical advice. The <a href="/medical-disclaimer/">medical disclaimer</a> is part of these terms. If your tinnitus is persistent, getting worse, or bothering you significantly, talk to a doctor or audiologist.</p>
<h2>Listen safely</h2>
<p>You are responsible for your listening levels. Keep the volume low and comfortable and follow the guidance on the <a href="/safe-listening/">safe listening</a> page. Do not use the app in situations that require your full attention, such as driving.</p>
<h2>Your data</h2>
<p>No account is required. What you save stays in local storage on your device; your saved sounds and preferences are yours, and nothing you save will be deleted by us. If you allow it, the website uses limited Google Analytics to count visits, as described on the <a href="/privacy/">privacy page</a>, which is part of these terms; it records page views and, for Sound Response, which steps of the experiment were reached — never your sounds, ratings, responses or results. The current iPhone app does not use Google Analytics.</p>
<h2>Provided as-is</h2>
<p>The service is provided "as is" and "as available", without warranties of any kind, express or implied. To the maximum extent permitted by law, the Find My Quiet Sound project is not liable for any damages arising from use of, or inability to use, the service. Sound preferences vary from person to person; the app may not work for everyone.</p>
<h2>Fair use</h2>
<p>Do not copy, resell or misrepresent the app or its sounds, attempt to disrupt the service, or use it in any unlawful way. The app's name, design and generated sounds remain the property of the Find My Quiet Sound project.</p>
<h2>Changes</h2>
<p>We may update the app and these terms. Meaningful changes will be reflected on this page with an updated review date, and pricing or access changes will always be communicated clearly before they take effect.</p>
<h2>Contact</h2>
<p>Questions about these terms: see the <a href="/contact/">contact page</a>.</p>`,
});
trust({
  path: 'privacy/', title: 'Privacy — Find My Quiet Sound',
  description: 'What Find My Quiet Sound stores on your device, what the website sends to Google Analytics only if you allow it, and how to change or clear either.',
  updated: '2026-09-27',
  h1: 'Privacy',
  body: `
<h2>What is stored on your device</h2>
<p>The website and the iPhone app keep your settings, preferences and creations in local storage on your device: theme, master volume, saved mixes and sessions, favourites, visual settings, Experiments settings, experiment feedback and session history, Notched Sound profiles, your Find My Tinnitus Sound result and your sound preference profile. This local app data is not sent to us or to Google Analytics.</p>
<p>If you use Discover What Changes Your Tinnitus (Sound Response), your session baselines, sound-test records and Sound Response Profile — with a random identifier that only labels these records on this device and is never sent — are also kept in local storage on this device only, and can be deleted from “View experiment details” on that profile. <a href="/learn/how-sound-response-works/">How Sound Response works</a> describes what is recorded. The “Clear” button on My Sound Profile removes your sound preference profile (including the sound play counts it draws on) and your latest experiment feedback and ratings. Other locally stored information — such as saved mixes and sessions, favourites, settings, Notched Sound profiles, your Find My Tinnitus Sound result and your experiment session history — stays on this device. To remove all locally stored data, clear this website’s data in your browser settings; in the iPhone app, deleting the app removes it.</p>
<p>On the website, your analytics choice is also stored on your device, together with two Google Analytics cookies if — and only if — you allow website analytics (see below).</p>
<h2 id="analytics">Website analytics</h2>
<p>The website findmyquietsound.com can use Google Analytics, but only if you choose Allow. Until you choose, and if you choose No thanks, Google Analytics is not loaded and nothing is sent to it. If your browser sends a Global Privacy Control signal, website analytics stays off.</p>
<p>If you allow it, the website sends Google Analytics basic information about each page you open: the page’s standard title and address (without app settings; campaign tags such as utm_source are kept), the page you came from, your browser and operating system, general device and screen information, your language, basic engagement such as how long the page was in use, and your country and region, which Google works out from your IP address. It does not send what you play, save, measure or type. The only events beyond page views come from Sound Response, and they say which step you reached: opened, welcome and safety completed, baseline completed, session started (and whether it was your first) or completed, a sound test completed, profile viewed, response sound played. No ratings, responses, sounds, tinnitus characteristics, results or preferences are ever sent.</p>
<p>Google Analytics then sets two first-party cookies, _ga and _ga_492Q4R9W97, holding a random identifier and visit counters. They last at most 13 months from your first visit. Google Analytics is set to keep user-level and event-level data for 2 months; its aggregated visit reports are kept longer. Google Signals and ads personalization are off, and the website is not linked to Google Ads. <a href="https://policies.google.com/technologies/partner-sites" rel="noopener">How Google uses information from sites that use its services</a>.</p>
<p>You can change your choice here at any time. Turning website analytics off stops anything further being sent and removes the Google Analytics cookies from this site.</p>
<div class="analytics-choice" data-analytics-control aria-live="polite" hidden></div>
<h2>The iPhone app</h2>
<p>The current iPhone app does not use Google Analytics and does not show this website analytics choice.</p>
<h2>Other services</h2>
<p>The website’s fonts are served from findmyquietsound.com itself; the website makes no Google Fonts requests. The currently submitted iPhone app still loads its fonts from Google Fonts until a later iPhone build, so the app requests the font files from Google.</p>
<p>The website is hosted on GitHub Pages; GitHub’s own server logs apply to that hosting (see <a href="https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages#data-collection" rel="noopener">GitHub Pages data collection</a>). On the website, if you tap the microphone in Ask, your browser or device provider may process your spoken request (Google on Chrome, Edge and Android; Apple on Safari). Voice input is not available in the iPhone app. No other third-party resources load; links to research sources open other websites only when you follow them.</p>
<h2>What we do not collect</h2>
<p>There is no account. We don’t ask for or store your email address, hearing records or health records on our servers. Your tinnitus pitch result, experiment feedback, preferences and saved creations stay on your device, as described above; we don’t receive them.</p>`,
});
trust({
  path: 'contact/', title: 'Contact — Find My Quiet Sound',
  description: 'How to report a problem, suggest a sound or experiment, or ask about Find My Quiet Sound.',
  h1: 'Contact',
  body: `
<p>Find My Quiet Sound is an independent project. The best place for bug reports and suggestions is the open-source repository:</p>
<p><a class="btn btn-primary" href="https://github.com/debra-lang/softwave/issues" rel="noopener">Open an issue on GitHub</a></p>
<p>Please do not include personal health information in public issues. For medical questions, talk to a doctor or audiologist — see <a href="/medical-disclaimer/">when to talk to a professional</a>.</p>`,
});

trust({
  path: 'premium/', updated: '2026-09-27', title: 'Find My Quiet Sound Premium — Personal Sound Discovery',
  description: 'Find My Quiet Sound is currently free to use. What the optional Premium plan is expected to include: Help Me Find My Sound, My Sound Profile, Frequency Painting, Sound Sculptor, generative sound, Sound Space and journeys.',
  h1: 'Free and Premium',
  body: `
<p><strong>Find My Quiet Sound is currently free to use.</strong> As the app evolves, some features may become part of an optional Premium plan. Any pricing or access changes will be communicated clearly before they take effect. This page explains what the personalisation layer — Find My Quiet Sound Premium — is expected to include.</p>
<h2>Free today</h2>
<ul><li>White, pink and brown noise, gentle static and soft hiss</li><li>Rain, ocean, flowing water, waterfall, forest, wind, fan, fireplace and night sounds</li><li>The mixer (up to five layers, balance, saved mixes)</li><li>The frequency generator and Find My Tinnitus Sound</li><li>Visual Focus, the breathing circle, Attention Focus</li><li>Sleep Mode with timers and fade-out</li><li>Sound Morph and Build My Session</li><li>Works offline, no account, no tracking of your hearing</li></ul>
<h2>Find My Quiet Sound Premium — discover and build your personal sound experience</h2>
<ul><li><strong>Help Me Find My Sound</strong> — the guided A/B journey to your preferred sound, and the My Sound Profile it builds</li><li><strong>Sound Sculptor</strong> and <strong>Frequency Painting</strong> — shape your own sounds and keep them</li><li><strong>Generative Sound</strong> — sounds that never quite repeat</li><li><strong>Sound Space</strong> — place sounds around you</li><li><strong>Adaptive Sound Journeys</strong> and <strong>Sound + Visual Journeys</strong></li><li>Unlimited saved sounds and experiences, and recommendations built from your own preferences</li></ul>
<p>Premium is about personalisation, not "more noise". Nothing you save will be deleted.</p>
<h2>Accounts</h2>
<p>You do not need an account to use Find My Quiet Sound; everything is kept on your device. An optional free account to keep your sounds across devices is planned; it will never ask for hearing or health information.</p>`,
});

// Learn index
PAGES.push({
  path: 'learn/', type: 'index',
  title: 'Learn: Tinnitus Sounds, Masking, Frequency & Sleep | Find My Quiet Sound',
  description: 'Plain-language, sourced guides to tinnitus masking, noise colours, sound generators, tinnitus frequency and matching, sleep, volume and headphones.',
  h1: 'Learn',
  intro: 'Short, sourced answers to the questions people ask about sound and tinnitus. Each article is dated, cites its sources, and links to the tool it describes. None of it is medical advice.',
});

module.exports = { PAGES, SRC, REVIEWED, disclaimer, tryBox };
