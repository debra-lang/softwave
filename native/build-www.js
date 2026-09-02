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
  'monetization.js', 'premium.js', 'personal.js', 'assistant.js', 'intro.js',
  'cloud.js', 'cloud-config.js',
  'manifest.webmanifest', '404.html', 'og-image.png',
];
const DIRS = [
  'icons', 'learn', 'about', 'contact', 'privacy', 'terms', 'medical-disclaimer',
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
// The native shell's local asset server does not serve query-string URLs, so every
// `styles.css?v=NN`-style reference loads NOTHING on the device — the app renders
// completely unstyled. Cache-busting queries only matter on the web; strip them here.
function stripQueries(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { stripQueries(p); continue; }
    if (!/\.(html|js)$/.test(entry.name)) continue;
    const before = fs.readFileSync(p, 'utf8');
    const after = before.replace(/((?:href|src)=")(\/?[a-z0-9./-]+\.(?:css|js))\?v=\d+(")/g, '$1$2$3')
                        .replace(/'(lab\.js)\?v=\d+'/g, "'$1'");
    if (after !== before) fs.writeFileSync(p, after);
  }
}
stripQueries(OUT);

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
// Point every internal folder-style link at its index.html file explicitly.
function fixDirLinks(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { fixDirLinks(p); continue; }
    if (!/\.(html|js)$/.test(entry.name)) continue;
    const before = fs.readFileSync(p, 'utf8');
    const after = before.replace(/(href=")(?!https?:)([^"#]*?\/)(")/g, (m, a, u, c) => u === '/' ? m : a + u + 'index.html' + c);
    if (after !== before) fs.writeFileSync(p, after);
  }
}
fixDirLinks(OUT);

// Hard gate: every script index.html loads must exist in the bundle. A missing one ships a
// silently degraded app (this is how the entire personalization layer once went missing).
const idx = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
const refs = [...idx.matchAll(/src="([a-z0-9./-]+\.js)"/g)].map(m => m[1]).filter(s => !s.startsWith('http'));
refs.push('lab.js');   // lazy-loaded from app.js
let missing = false;
for (const r of refs) if (!fs.existsSync(path.join(OUT, r))) { console.error('FATAL: index.html needs missing file:', r); missing = true; }
if (missing) process.exit(1);
console.log('www built:', copied, 'entries copied to', OUT, '(queries stripped, CSS inlined, dir links resolved, all', refs.length, 'scripts verified present)');
