/* Submit all sitemap URLs to IndexNow (Bing, Yandex, etc.) after a deploy:  node indexnow.js */
'use strict';
const https = require('https'), fs = require('fs');
const KEY = fs.readdirSync(__dirname).find(f => /^[0-9a-f]{32}\.txt$/.test(f)).replace('.txt', '');
const HOST = 'debra-lang.github.io', BASE = '/softwave';
const urls = [...fs.readFileSync('sitemap.xml', 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const body = JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}${BASE}/${KEY}.txt`, urlList: urls });
const req = https.request({ hostname: 'api.indexnow.org', path: '/indexnow', method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) } }, res => { console.log('IndexNow response:', res.statusCode, `(${urls.length} URLs)`); res.resume(); });
req.on('error', e => console.error('IndexNow failed:', e.message)); req.end(body);
