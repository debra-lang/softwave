/* Softwave — static site builder for SEO pages.
   node build-site.js   → writes landing/learn/trust pages, sitemap.xml, robots.txt, 404.html, og-image.png
   Change SITE/BASE when moving to a custom domain. */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { PAGES, SRC, REVIEWED, disclaimer, tryBox } = require('./site-content');

const SITE = 'https://debra-lang.github.io';    // origin
const BASE = '/softwave/';                      // path prefix (set to '/' on a custom domain)
const ORIGIN = SITE + BASE.replace(/\/$/, '');  // https://debra-lang.github.io/softwave
const VERIFY = { google: '', bing: '' };        // paste verification tokens here when you have them
const ANALYTICS = '';                           // optional cookie-free analytics snippet (off)
const INDEXNOW_KEY = 'a7c3e9f1b2d4486a9e0c5f7d3b1a6e2c';
const LASTMOD = REVIEWED;

const abs = (href) => href.startsWith('/') ? BASE + href.slice(1) : href;
const fixLinks = (html) => html.replace(/href="\/(?!\/)/g, `href="${BASE}`);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const humanDate = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const NAV = [['Sounds', '/'], ['Frequency', '/#frequency'], ['Sleep', '/#sleep'], ['Learn', '/learn/'], ['About', '/about/']];
const FOOTER = [['About', '/about/'], ['How it works', '/how-it-works/'], ['Research & sources', '/research-and-sources/'], ['Safe listening', '/safe-listening/'], ['Medical disclaimer', '/medical-disclaimer/'], ['Privacy', '/privacy/'], ['Contact', '/contact/']];
const TOOLS = [['Tinnitus sound generator', '/tinnitus-sound-generator/'], ['Masking sounds', '/tinnitus-masking-sounds/'], ['White noise', '/white-noise-for-tinnitus/'], ['Pink noise', '/pink-noise-for-tinnitus/'], ['Brown noise', '/brown-noise-for-tinnitus/'], ['Frequency generator', '/tinnitus-frequency-generator/'], ['Sound matching', '/tinnitus-sound-matching/'], ['Sound mixer', '/tinnitus-sound-mixer/'], ['Sleep sounds', '/tinnitus-sleep-sounds/']];

const ORG = { '@type': 'Organization', '@id': ORIGIN + '/#org', name: 'Softwave', url: ORIGIN + '/', logo: ORIGIN + '/icons/icon-512.png', sameAs: ['https://github.com/debra-lang/softwave'] };
const WEBSITE = { '@type': 'WebSite', '@id': ORIGIN + '/#website', url: ORIGIN + '/', name: 'Softwave', description: 'Free tinnitus sound generator: masking sounds, mixer, frequency tools, sleep mode and calm visuals.', publisher: { '@id': ORIGIN + '/#org' }, inLanguage: 'en' };
const APP = { '@type': 'WebApplication', '@id': ORIGIN + '/#app', name: 'Softwave — Tinnitus Sound Studio', url: ORIGIN + '/', applicationCategory: 'HealthApplication', operatingSystem: 'Any (web browser)', browserRequirements: 'Requires JavaScript and Web Audio', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, isAccessibleForFree: true, description: 'A free tinnitus sound generator with white, pink and brown noise, nature sounds, a five-channel mixer, a frequency generator, guided sound matching, sleep timer with fade-out, and calm visuals. Sound masking and relaxation — not a medical treatment.', featureList: ['14 synthesised, seamless sounds', 'Mixer with up to 5 layers and L/R balance', 'Frequency generator 20 Hz – 16 kHz', 'Guided tinnitus sound matching', 'Sleep timer with gradual fade', 'Visual Focus mode', 'Works offline, installable, no account'], screenshot: ORIGIN + '/og-image.png', publisher: { '@id': ORIGIN + '/#org' } };

function layout(p, { bodyHtml, jsonld, crumbs }) {
  const url = ORIGIN + '/' + (p.path || '');
  const title = p.title;
  const theme = `<script>(function(){try{var t=localStorage.getItem('softwave:theme');t=t?JSON.parse(t):(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;}catch(e){}})();</script>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-image-preview:large">
${VERIFY.google ? `<meta name="google-site-verification" content="${VERIFY.google}">` : ''}${VERIFY.bing ? `<meta name="msvalidate.01" content="${VERIFY.bing}">` : ''}
<meta property="og:type" content="${p.type === 'article' ? 'article' : 'website'}">
<meta property="og:site_name" content="Softwave">
<meta property="og:title" content="${esc(p.ogTitle || title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ORIGIN}/og-image.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Softwave — free tinnitus sound generator">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.ogTitle || title)}">
<meta name="twitter:description" content="${esc(p.description)}">
<meta name="twitter:image" content="${ORIGIN}/og-image.png">
${p.type === 'article' ? `<meta property="article:published_time" content="${REVIEWED}"><meta property="article:modified_time" content="${LASTMOD}">` : ''}
<meta name="theme-color" content="#0b1020" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f4f6fb" media="(prefers-color-scheme: light)">
<link rel="icon" href="${BASE}icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${BASE}icons/icon-192.png">
<link rel="manifest" href="${BASE}manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${BASE}styles.css">
<link rel="stylesheet" href="${BASE}site.css">
${theme}
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': jsonld })}</script>
${ANALYTICS}
</head>
<body class="site-page">
<a class="skip-link" href="#content">Skip to content</a>
<header class="topbar">
  <a class="brand" href="${BASE}"><span class="logo-mark small" aria-hidden="true"><span></span><span></span><span></span></span><span>Softwave</span></a>
  <nav class="nav" aria-label="Main">${NAV.map(([l, h]) => `<a href="${abs(h)}"${(p.path || '').startsWith(h.replace(/^\//, '')) && h !== '/' ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
  <div class="topbar-actions"><a class="btn btn-primary btn-sm" href="${BASE}">Open the app</a></div>
</header>
<main id="content" class="site-main">
${crumbs ? `<nav class="crumbs" aria-label="Breadcrumb"><ol>${crumbs.map((c, i) => `<li>${i < crumbs.length - 1 ? `<a href="${abs(c[1])}">${c[0]}</a>` : `<span aria-current="page">${c[0]}</span>`}</li>`).join('')}</ol></nav>` : ''}
${fixLinks(bodyHtml)}
</main>
<footer class="site-footer">
  <div class="site-footer-grid">
    <div><div class="label-sm">Tools</div><ul>${TOOLS.map(([l, h]) => `<li><a href="${abs(h)}">${l}</a></li>`).join('')}</ul></div>
    <div><div class="label-sm">Learn</div><ul>${PAGES.filter(x => x.type === 'article').map(x => `<li><a href="${abs('/' + x.path)}">${x.h1}</a></li>`).join('')}</ul></div>
    <div><div class="label-sm">Softwave</div><ul>${FOOTER.map(([l, h]) => `<li><a href="${abs(h)}">${l}</a></li>`).join('')}</ul></div>
  </div>
  <p class="site-footer-note">Softwave is designed for sound masking, relaxation and tinnitus management support. It does not diagnose, treat or cure tinnitus and is not a substitute for professional medical care.</p>
</footer>
</body>
</html>
`;
}

function sourcesBlock(keys) {
  if (!keys || !keys.length) return '';
  return `<section class="sources" aria-labelledby="sources-h"><h2 id="sources-h">Sources</h2><ol>${keys.map(k => `<li><a href="${SRC[k].u}" rel="noopener">${SRC[k].t}</a></li>`).join('')}</ol></section>`;
}
function faqSchema(html) {
  const out = []; const re = /<h3>([^<]+)<\/h3><p>([\s\S]*?)<\/p>/g; let m;
  while ((m = re.exec(html))) out.push({ '@type': 'Question', name: stripTags(m[1]), acceptedAnswer: { '@type': 'Answer', text: stripTags(m[2]) } });
  return out.length ? { '@type': 'FAQPage', mainEntity: out } : null;
}

function renderPage(p) {
  const url = ORIGIN + '/' + p.path;
  const crumbs = [['Home', '/']];
  if (p.type === 'article') crumbs.push(['Learn', '/learn/']);
  crumbs.push([p.h1.replace(/&amp;/g, '&'), '/' + p.path]);
  const breadcrumb = { '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: ORIGIN + abs(c[1]).replace(BASE, '/') })) };
  const jsonld = [ORG, WEBSITE, breadcrumb];
  let body = '';
  if (p.type === 'index') {
    const arts = PAGES.filter(x => x.type === 'article');
    body = `<article class="prose"><header class="page-head"><h1>${p.h1}</h1><p class="lead">${p.intro}</p></header>
<div class="learn-cards">${arts.map(a => `<a class="learn-card" href="/${a.path}"><h2>${a.h1}</h2><p>${a.description}</p><span class="muted small">Last reviewed ${humanDate(REVIEWED)}</span></a>`).join('')}</div>
<h2>Tool pages</h2><ul class="link-list">${TOOLS.map(([l, h]) => `<li><a href="${h}">${l}</a></li>`).join('')}</ul>
${disclaimer}</article>`;
    jsonld.push({ '@type': 'CollectionPage', '@id': url, url, name: p.title, description: p.description, isPartOf: { '@id': ORIGIN + '/#website' } });
  } else if (p.type === 'trust') {
    body = `<article class="prose"><header class="page-head"><h1>${p.h1}</h1><p class="muted small">Last reviewed ${humanDate(REVIEWED)}</p></header>${p.body}${sourcesBlock(p.sources)}</article>`;
    jsonld.push({ '@type': 'WebPage', '@id': url, url, name: p.title, description: p.description, isPartOf: { '@id': ORIGIN + '/#website' }, dateModified: LASTMOD });
  } else {
    const isTool = p.type === 'tool';
    body = `<article class="prose"><header class="page-head"><p class="eyebrow">${isTool ? 'Free tool' : 'Learn'}</p><h1>${p.h1}</h1><p class="lead">${p.intro}</p><p class="muted small">Last reviewed ${humanDate(REVIEWED)} · Sources listed below · Not medical advice</p></header>
${isTool && p.try ? tryBox(p.try) : ''}
${p.body}
${!isTool ? tryBox(toolLinksFor(p)) : ''}
${sourcesBlock(p.sources)}
${disclaimer}
<p class="muted small">Written from the sources above by the Softwave project; no clinician has reviewed this page. See <a href="/research-and-sources/">Research &amp; Sources</a> and the <a href="/medical-disclaimer/">medical disclaimer</a>.</p>
</article>`;
    const wp = { '@type': isTool ? 'WebPage' : 'Article', '@id': url, url, name: p.title, headline: p.h1, description: p.description, isPartOf: { '@id': ORIGIN + '/#website' }, datePublished: REVIEWED, dateModified: LASTMOD, author: { '@id': ORIGIN + '/#org' }, publisher: { '@id': ORIGIN + '/#org' }, inLanguage: 'en', image: ORIGIN + '/og-image.png' };
    if (isTool) { wp.mainEntity = { '@id': ORIGIN + '/#app' }; jsonld.push(APP); }
    if (!isTool) wp.mainEntityOfPage = url;
    jsonld.push(wp);
    if (p.faq) { const f = faqSchema(p.body); if (f) jsonld.push(f); }
  }
  return layout(p, { bodyHtml: body, jsonld, crumbs });
}
function toolLinksFor(p) {
  const map = { 'tinnitus-sound-masking': [['/tinnitus-masking-sounds/', 'Try masking sounds']], 'how-tinnitus-sound-generators-work': [['/tinnitus-sound-generator/', 'Open the sound generator']], 'white-vs-pink-vs-brown-noise': [['/?sound=white', 'Play white noise'], ['/?sound=pink', 'Play pink noise'], ['/?sound=brown', 'Play brown noise']], 'find-a-comfortable-tinnitus-masking-sound': [['/#match', 'Find My Tinnitus Sound'], ['/?exp=mixpoint', 'Mixing Point Finder']], 'tinnitus-and-sleep': [['/#sleep', 'Try Sleep Mode']], 'tinnitus-frequency': [['/#frequency', 'Try the frequency generator']], 'tinnitus-frequency-matching': [['/#match', 'Find My Tinnitus Sound'], ['/?exp=explorer', 'Frequency Explorer']], 'nature-sounds-vs-noise-for-tinnitus': [['/?sound=rain', 'Play rain'], ['/#mixer', 'Open the mixer']], 'how-loud-should-tinnitus-masking-be': [['/?exp=mixpoint', 'Mixing Point Finder'], ['/?exp=nearsilence', 'Near-Silence']], 'speakers-vs-headphones-for-tinnitus-sounds': [['/', 'Open Softwave']] };
  return (map[p.slug] || [['/', 'Open Softwave']]).map(([href, label]) => ({ href, label }));
}

// ---------- write ----------
const root = __dirname;
const write = (rel, content) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };
for (const p of PAGES) write(p.path + 'index.html', renderPage(p));

// sitemap
const urls = [{ loc: ORIGIN + '/', pri: '1.0' }].concat(PAGES.map(p => ({ loc: ORIGIN + '/' + p.path, pri: p.type === 'tool' ? '0.9' : p.type === 'article' ? '0.7' : '0.4' })));
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${LASTMOD}</lastmod><priority>${u.pri}</priority></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
write(INDEXNOW_KEY + '.txt', INDEXNOW_KEY);
write('404.html', layout({ path: '404.html', title: 'Page not found — Softwave', description: 'That page does not exist. Open the Softwave tinnitus sound generator or browse the Learn library.', type: 'trust' }, { bodyHtml: `<article class="prose"><header class="page-head"><h1>Page not found</h1><p class="lead">That link does not go anywhere. Here are the places people usually want:</p></header><ul class="link-list"><li><a href="/">Open the sound generator</a></li><li><a href="/tinnitus-sound-generator/">About the tinnitus sound generator</a></li><li><a href="/learn/">Learn library</a></li></ul></article>`, jsonld: [ORG, WEBSITE], crumbs: null }).replace('<meta name="robots" content="index, follow, max-image-preview:large">', '<meta name="robots" content="noindex">'));

// OG image (1200x630): gradient ground with the three-bar mark, no text (title comes from OG tags)
function png(W, H, pix) {
  const crc = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let r = -1; for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ -1) >>> 0; }; })();
  const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc((W * 4 + 1) * H); for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; for (let x = 0; x < W; x++) { const [r, g, b] = pix(x, y); const o = y * (W * 4 + 1) + 1 + x * 4; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const inR = (x, y, rx, ry, w, h, r) => { const cx = Math.max(rx + r, Math.min(x, rx + w - r)), cy = Math.max(ry + r, Math.min(y, ry + h - r)); return (x - cx) ** 2 + (y - cy) ** 2 <= r * r; };
const bars = [[470, 300, 60, 130], [570, 200, 60, 330], [670, 250, 60, 230]];
write('og-image.png', png(1200, 630, (x, y) => {
  const t = x / 1200, u = y / 630; let c = [11 + 10 * t, 16 + 12 * u, 32 + 30 * t]; // deep navy gradient
  const glow = Math.exp(-(((x - 600) ** 2) / 160000 + ((y - 330) ** 2) / 60000)); c = [c[0] + 40 * glow, c[1] + 60 * glow, c[2] + 120 * glow];
  for (const [bx, by, bw, bh] of bars) if (inR(x, y, bx, by, bw, bh, 30)) { const k = (x + y) / 1830; c = [63 + (95 - 63) * k, 108 + (184 - 108) * k, 240 + (201 - 240) * k]; }
  return c.map(v => Math.max(0, Math.min(255, Math.round(v))));
}));

console.log(`Built ${PAGES.length} pages + sitemap, robots, 404, og-image at ${ORIGIN}`);
