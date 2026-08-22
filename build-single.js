// Bundles the app into one self-contained HTML file (for hosting as a single page, e.g. claude.ai Artifacts).
const fs=require("fs");
let h=fs.readFileSync("index.html","utf8");
const css=fs.readFileSync("styles.css","utf8"), a=fs.readFileSync("audio.js","utf8"), v=fs.readFileSync("visuals.js","utf8"), app=fs.readFileSync("app.js","utf8");
const svg=Buffer.from(fs.readFileSync("icons/icon.svg","utf8")).toString("base64");
h=h.replace(/<!doctype html>\s*<html lang="en">\s*<head>/i,"").replace(/<\/head>\s*<body>/,"").replace(/<\/body>\s*<\/html>\s*$/,"");
h=h.replace(/\s*<link rel="manifest"[^>]*>/,"").replace(/\s*<link rel="apple-touch-icon"[^>]*>/,"");
h=h.replace(/<link rel="icon" href="icons\/icon.svg" type="image\/svg\+xml">/,`<link rel="icon" href="data:image/svg+xml;base64,${svg}">`);
h=h.replace(/<link rel="stylesheet" href="styles.css">/,"<style>\n"+css+"\n</style>");
h=h.replace(/<script src="audio.js"><\/script>\s*<script src="visuals.js"><\/script>\s*<script src="app.js"><\/script>/,"<script>\n"+a+"\n</script>\n<script>\n"+v+"\n</script>\n<script>\n"+app.replace("navigator.serviceWorker.register('sw.js')","Promise.resolve()")+"\n</script>");
const out=process.argv[2]||"softwave-single.html"; fs.writeFileSync(out,h); console.log("wrote",out,h.length);
