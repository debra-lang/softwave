// TEST-ONLY: inject a script as the very first element of <head> in a built native/www/index.html (simulator builds only).
const fs = require('fs'), path = require('path');
const [www, script] = process.argv.slice(2);
const name = path.basename(script); fs.copyFileSync(script, path.join(www, name));
const p = path.join(www, 'index.html'); const h = fs.readFileSync(p, 'utf8');
if (!/<head>/.test(h)) { console.error('no <head>'); process.exit(1); }
fs.writeFileSync(p, h.replace('<head>', `<head>\n<script src="${name}"></script>`, 1));
console.log('injected', name, 'into', p);
