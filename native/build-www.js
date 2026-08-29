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
  'monetization.js', 'cloud.js', 'cloud-config.js',
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
console.log('www built:', copied, 'entries copied to', OUT);
