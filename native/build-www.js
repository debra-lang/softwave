/* Builds the native web bundle: copies the production site into native/www.
   The app has no build step, so this is a curated copy — everything the app uses
   at runtime, minus the service worker (native shells don't use it; app.js only
   registers it on http/https), dev artifacts, and unlinked legal drafts. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'www');

const FILES = [
  'index.html', 'styles.css', 'site.css',
  'app.js', 'audio.js', 'field.js', 'visuals.js', 'focus.js', 'lab.js',
  'monetization.js', 'premium.js', 'personal.js', 'controller.js', 'assistant.js', 'intro.js',
  'cloud.js', 'cloud-config.js',
  'hero.js', 'hero-wave.avif', 'hero-wave.webp', 'ri.js', 'ri-protocol.js',
  'manifest.webmanifest', '404.html', 'og-image.png',
];
const DIRS = [
  'icons', 'fonts', 'learn', 'about', 'contact', 'privacy', 'terms', 'medical-disclaimer',
  'safe-listening', 'research-and-sources', 'how-it-works', 'premium',
  'brown-noise-for-tinnitus', 'pink-noise-for-tinnitus', 'white-noise-for-tinnitus',
  'tinnitus-frequency-generator', 'tinnitus-masking-sounds', 'tinnitus-sleep-sounds',
  'tinnitus-sound-generator', 'tinnitus-sound-matching', 'tinnitus-sound-mixer',
];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let copied = 0;
for (const f of FILES) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) { console.warn('missing file (skipped):', f); continue; }
  fs.cpSync(src, path.join(OUT, f)); copied++;
}
for (const d of DIRS) {
  const src = path.join(ROOT, d);
  if (!fs.existsSync(src)) { console.warn('missing dir (skipped):', d); continue; }
  fs.cpSync(src, path.join(OUT, d), { recursive: true }); copied++;
}
// Website-only elements stay out of the app: the App Store download line (badge + caption) and the
// Smart App Banner meta exist for website visitors only. (The website also hides the line inside the
// app shell with CSS; removing it here means the app never even references the badge file.)
{
  const ip = path.join(OUT, 'index.html');
  const before = fs.readFileSync(ip, 'utf8');
  const after = before.replace(/[ \t]*<meta name="apple-itunes-app"[^>]*>\r?\n?/g, '')
                      .replace(/[ \t]*<div class="appstore-line" id="appstore-line">[\s\S]*?<\/div>\r?\n?/g, '');
  if (/apple-itunes-app|id="appstore-line"|appstore-badge|apps\.apple\.com/.test(after)) { console.error('FATAL: website-only App Store element left in the app bundle'); process.exit(1); }
  fs.writeFileSync(ip, after);
}

// The native shell's local asset server does not serve query-string URLs, so every
// `styles.css?v=NN`-style reference loads NOTHING on the device — the app renders
// completely unstyled. Cache-busting queries only matter on the web; strip them here:
// in href/src/srcset attributes (stylesheets, scripts, images, fonts) and in the JS string
// literals that lazy-load scripts (lab.js, ri-protocol.js, ri.js). Then refuse to build if any survive.
const ASSET = String.raw`[a-z0-9./-]+\.(?:css|js|avif|webp|png|svg|jpg|woff2)`;
function stripQueries(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { stripQueries(p); continue; }
    if (!/\.(html|js)$/.test(entry.name)) continue;
    const before = fs.readFileSync(p, 'utf8');
    const after = before.replace(new RegExp(String.raw`((?:href|src|srcset)=")(\/?` + ASSET + String.raw`)\?v=\d+(")`, 'g'), '$1$2$3')
                        .replace(/'([a-z0-9./-]+\.(?:js|css))\?v=\d+'/g, "'$1'");
    if (after !== before) fs.writeFileSync(p, after);
  }
}
stripQueries(OUT);
const queriesLeft = [];
(function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { scan(p); continue; }
    if (!/\.(html|js)$/.test(entry.name)) continue;
    const m = fs.readFileSync(p, 'utf8').match(new RegExp(ASSET + String.raw`\?v=\d`, 'g'));
    if (m) queriesLeft.push(path.relative(OUT, p) + ' (' + m.slice(0, 3).join(', ') + ')');
  }
})(OUT);
if (queriesLeft.length) { console.error('FATAL: query-string asset URLs left (they load nothing in the app):', queriesLeft.join('; ')); process.exit(1); }

// Guide pages carry platform-specific sentences from one source (site-content.js): website-only text in
// <!--web-->…<!--/web-->, the iPhone wording hidden in <!--app:…:app-->. The app gets the iPhone wording.
// Unbalanced or leftover markers would show the wrong text, so they stop the build.
function resolveDocBlocks(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { resolveDocBlocks(p); continue; }
    if (!entry.name.endsWith('.html')) continue;
    const before = fs.readFileSync(p, 'utf8');
    const n = re => (before.match(re) || []).length;
    if (n(/<!--web-->/g) !== n(/<!--\/web-->/g) || n(/<!--app:/g) !== n(/:app-->/g)) { console.error('FATAL: unbalanced web/app markers in', path.relative(OUT, p)); process.exit(1); }
    const after = before.replace(/<!--web-->[\s\S]*?<!--\/web-->/g, '').replace(/<!--app:([\s\S]*?):app-->/g, '$1');
    if (/<!--\/?web-->|<!--app:|:app-->/.test(after)) { console.error('FATAL: web/app marker left in', path.relative(OUT, p)); process.exit(1); }
    if (after !== before) fs.writeFileSync(p, after);
  }
}
resolveDocBlocks(OUT);

// Belt and braces for the native shell: embed the stylesheets directly into every page.
// A <link> can fail for scheme/MIME/policy reasons that differ per iOS version; inline
// <style> cannot fail. Also inject a self-diagnostic: if, despite this, the app ever
// renders unstyled on a device, a banner reports exactly what the WebView sees.
const CSS = {
  'styles.css': fs.readFileSync(path.join(OUT, 'styles.css'), 'utf8'),
  'site.css': fs.readFileSync(path.join(OUT, 'site.css'), 'utf8'),
};
const DIAG = `<script>addEventListener('load',function(){try{var ff=getComputedStyle(document.body).fontFamily||'';if(ff.indexOf('Manrope')>=0)return;var d=document.createElement('div');d.style.cssText='position:fixed;left:4px;right:4px;bottom:4px;background:#111;color:#7CFC7C;font:11px Menlo,monospace;padding:8px;z-index:99999;white-space:pre-wrap;word-break:break-all;border-radius:8px';var info='STYLE DIAGNOSTIC\\nurl='+location.href+'\\nsheets='+document.styleSheets.length;for(var i=0;i<document.styleSheets.length;i++){var s=document.styleSheets[i],n;try{n=s.cssRules?s.cssRules.length:-1}catch(e){n=-2}info+='\\n '+(s.href||'inline')+' rules='+n}info+='\\nbodyFont='+ff.slice(0,50)+'\\nUA='+navigator.userAgent.slice(0,90);d.textContent=info;document.body.appendChild(d);}catch(e){}});</script>`;
function inlineCss(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { inlineCss(p); continue; }
    if (!entry.name.endsWith('.html')) continue;
    let html = fs.readFileSync(p, 'utf8');
    let changed = false;
    html = html.replace(/<link rel="stylesheet" href="\/?((?:styles|site)\.css)">/g, (m, file) => { changed = true; return '<style>\n' + CSS[file] + '\n</style>'; });
    if (changed && !html.includes('STYLE DIAGNOSTIC')) html = html.replace('</body>', DIAG + '</body>');
    if (changed) fs.writeFileSync(p, html);
  }
}
inlineCss(OUT);

// The native scheme does not resolve directory URLs ("learn/x/" -> index.html) the way a
// web server does: such navigations fail and Capacitor falls back to the start page.
// Point every internal folder-style link at its index.html file explicitly (keeping any #section, e.g. /privacy/#analytics).
function fixDirLinks(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { fixDirLinks(p); continue; }
    if (!/\.(html|js)$/.test(entry.name)) continue;
    const before = fs.readFileSync(p, 'utf8');
    const after = before.replace(/(href=")(?!https?:)([^"#]*?\/)(#[^"]*)?(")/g, (m, a, u, h, c) => u === '/' ? m : a + u + 'index.html' + (h || '') + c);
    if (after !== before) fs.writeFileSync(p, after);
  }
}
fixDirLinks(OUT);

// Google Analytics belongs to the public website only. The native app ships none of it: remove the
// GA4 snippet (the app page's and the info pages' forms) from every bundled page, then refuse to
// build if any trace survives — the App Store privacy answers depend on it.
function stripAnalytics(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { stripAnalytics(p); continue; }
    if (!entry.name.endsWith('.html')) continue;
    const before = fs.readFileSync(p, 'utf8');
    const after = before.replace(/[ \t]*<!-- Google tag \(gtag\.js\)[\s\S]*?-->\s*<script>[\s\S]*?<\/script>[ \t]*\r?\n?/g, '');
    if (after !== before) fs.writeFileSync(p, after);
  }
}
stripAnalytics(OUT);
// Scripts mark their website-only analytics with /* bundle:web-analytics:begin */ … /* bundle:web-analytics:end */;
// the app gets an empty track() in its place (removed before the unchanged gate below runs).
function stripAnalyticsBlocks(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { stripAnalyticsBlocks(p); continue; }
    if (!entry.name.endsWith('.js')) continue;
    const before = fs.readFileSync(p, 'utf8');
    const begins = (before.match(/bundle:web-analytics:begin/g) || []).length, ends = (before.match(/bundle:web-analytics:end/g) || []).length;
    if (begins !== ends) { console.error('FATAL: unbalanced bundle:web-analytics markers in', path.relative(OUT, p)); process.exit(1); }
    if (!begins) continue;
    const after = before.replace(/\/\* bundle:web-analytics:begin[\s\S]*?\/\* bundle:web-analytics:end \*\//g, 'function track() { }');
    if (/bundle:web-analytics/.test(after)) { console.error('FATAL: bundle:web-analytics marker left in', path.relative(OUT, p)); process.exit(1); }
    fs.writeFileSync(p, after);
  }
}
stripAnalyticsBlocks(OUT);
const gaLeft = [];
(function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { scan(p); continue; }
    if (!/\.(html|js)$/.test(entry.name)) continue;
    if (/googletagmanager|gtag\(|G-492Q4R9W97/.test(fs.readFileSync(p, 'utf8'))) gaLeft.push(path.relative(OUT, p));
  }
})(OUT);
if (gaLeft.length) { console.error('FATAL: Google Analytics code left in the app bundle:', gaLeft.join(', ')); process.exit(1); }

// Hard gate: every script index.html loads must exist in the bundle. A missing one ships a
// silently degraded app (this is how the entire personalization layer once went missing).
const idx = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
const refs = [...idx.matchAll(/src="([a-z0-9./-]+\.js)"/g)].map(m => m[1]).filter(s => !s.startsWith('http'));
// Lazy-loaded scripts: every script app.js loads on demand (lab.js, ri-protocol.js, ri.js) must be bundled.
const appJs = fs.readFileSync(path.join(OUT, 'app.js'), 'utf8');
const lazy = [...appJs.matchAll(/\.src = '([a-z0-9./-]+\.js)'/g), ...appJs.matchAll(/load\('([a-z0-9./-]+\.js)'\)/g)].map(m => m[1]);
if (!['lab.js', 'ri-protocol.js', 'ri.js'].every(f => lazy.includes(f))) { console.error('FATAL: lazy-loaded scripts not found in app.js:', lazy.join(', ')); process.exit(1); }
refs.push(...lazy);
let missing = false;
for (const r of refs) if (!fs.existsSync(path.join(OUT, r))) { console.error('FATAL: index.html needs missing file:', r); missing = true; }
// Picture sources and images on the app page (hero artwork: AVIF source + WebP fallback).
const imgs = [...idx.matchAll(/(?:<img[^>]*\ssrc|<source[^>]*\ssrcset)="([^"]+)"/g)].map(m => m[1]).filter(s => !/^(https?:|data:)/.test(s));
for (const r of imgs) if (!fs.existsSync(path.join(OUT, r.replace(/^\//, '')))) { console.error('FATAL: index.html image/picture source missing:', r); missing = true; }
// Self-hosted fonts: every page's font stylesheet and every font file those stylesheets name.
const fontCss = new Set();
(function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { scan(p); continue; }
    if (!entry.name.endsWith('.html')) continue;
    for (const m of fs.readFileSync(p, 'utf8').matchAll(/href="(\/?(?:\.\.\/)*fonts\/[a-z0-9.-]+\.css)"/g)) {
      const target = m[1].startsWith('/') ? path.join(OUT, m[1].slice(1)) : path.resolve(path.dirname(p), m[1]);
      if (!fs.existsSync(target)) { console.error('FATAL: font stylesheet missing for', path.relative(OUT, p) + ':', m[1]); missing = true; }
      else fontCss.add(target);
    }
  }
})(OUT);
if (!fontCss.size) { console.error('FATAL: no page links the self-hosted fonts'); missing = true; }
let fontFiles = 0;
for (const css of fontCss) for (const m of fs.readFileSync(css, 'utf8').matchAll(/url\(([^)]+)\)/g)) {
  fontFiles++;
  if (!fs.existsSync(path.join(path.dirname(css), m[1].replace(/['"]/g, '')))) { console.error('FATAL: font file missing:', m[1], 'named in', path.relative(OUT, css)); missing = true; }
}
if (missing) process.exit(1);
console.log('www built:', copied, 'entries copied to', OUT, '(web-only App Store elements removed, queries stripped, guide blocks resolved, CSS inlined, dir links resolved, analytics removed; all', refs.length, 'scripts,', imgs.length, 'images,', fontCss.size, 'font stylesheets and', fontFiles, 'font files verified present)');
