// TEST-ONLY (App Store screenshots, branch appstore-shots-89; never shipped). Injected into a simulator build of the
// Build 89 release bundle. Walks the app to ten screens; after each one it prints "B89SHOT <name>" and holds the screen
// until shots.sh has saved the simulator screenshot (asked through the sink: GET /taken?n=<name>). Draws nothing itself: the screenshots show only the app's own UI.
(function () {
  const STEPS = [
    ['01-sounds', 'sounds'], ['02-find-my-sound-ab', 'find'], ['03-visual-focus', 'focus'], ['04-sleep', 'sleep'],
    ['05-mixer-three-sounds', 'mixer'], ['06-experiments', 'lab'], ['07-frequency-painting', 'lab'],
    ['08-visual-focus-fullscreen', 'focus'], ['09-more-visuals', 'focus'], ['10-ask', 'sounds']];
  const say = (m) => { try { console.log(m); } catch (_) { } try { fetch('http://127.0.0.1:8799/', { method: 'POST', body: m }).catch(() => { }); } catch (_) { } };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const $ = (s) => document.querySelector(s);
  const click = (s) => { const e = $(s); if (!e) { say('B89NOTE missing ' + s); return; } e.click(); };
  const clickText = (t) => { const e = [...document.querySelectorAll('button,a,[role=button]')].find(b => b.offsetParent && b.textContent.trim().replace(/\s+/g, ' ').includes(t)); if (!e) { say('B89NOTE missing ' + t); return; } e.click(); };
  const prime = () => {
    localStorage.clear();
    localStorage.setItem('softwave:welcomed', 'true'); localStorage.setItem('softwave:introSeen', '1'); localStorage.setItem('softwave:volhint', '3');
    localStorage.setItem('softwave:journey', JSON.stringify({ step: 5, done: true, dismissed: true }));
  };
  const go = (i) => { sessionStorage.setItem('b89shot', String(i)); prime(); location.hash = '#' + (STEPS[i] ? STEPS[i][1] : 'sounds'); location.reload(); };
  // while a screen waits for its screenshot: the full-screen visual hides its controls when idle, so keep "moving"
  // over it the way a hand would (the app's own pointermove handler shows them)
  const KEEP = { '08-visual-focus-fullscreen': () => { const f = $('#focus-screen'); if (f) f.dispatchEvent(new PointerEvent('pointermove', { bubbles: true })); } };
  const ACT = {
    '02-find-my-sound-ab': async () => { clickText('Help Me Find My Sound'); await sleep(1500); click('[data-exp-start]'); await sleep(2500);
      const e = [...document.querySelectorAll('#lab-detail *')].find(x => x.children.length === 0 && /Round 1 of/.test(x.textContent));
      if (e) { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -170); } await sleep(800); },
    '04-sleep': async () => { const b = [...document.querySelectorAll('#sleep-presets button')].find(x => /^Sleep/.test(x.textContent.trim())); if (b) b.click(); else say('B89NOTE missing sleep preset');
      await sleep(1000); clickText('30 min'); await sleep(5500); },
    '05-mixer-three-sounds': async () => { for (const s of ['rain', 'brown', 'ocean']) await window.softwave.startSound(s, 0.45); await sleep(2500); },
    '07-frequency-painting': async () => { clickText('Frequency Painting'); await sleep(1500); click('[data-exp-start]'); await sleep(2500);
      const c = $('#lab-detail canvas'); if (c) c.scrollIntoView({ block: 'center' }); await sleep(500); clickText('Randomize'); await sleep(1500); },
    '08-visual-focus-fullscreen': async () => { await window.softwave.startSound('rain', 0.45); click('#env-enter'); await sleep(3000); },
    '09-more-visuals': async () => { click('.env-tile-more'); await sleep(1500); },
    '10-ask': async () => { const s = $('#assistant-slot'); s.scrollIntoView({ block: 'start' }); window.scrollBy(0, -90);
      const i = $('#ask-input'); i.value = 'Rain with ocean waves, a bit warmer'; i.dispatchEvent(new Event('input', { bubbles: true }));
      $('#ask-form').requestSubmit(); await sleep(3500); if (document.activeElement) document.activeElement.blur(); },
  };
  window.addEventListener('load', async () => {
    await sleep(3500);
    const at = sessionStorage.getItem('b89shot');
    if (at === null) { say('B89NOTE start'); go(0); return; }
    const i = +at; if (i >= STEPS.length) { say('B89SHOT done'); return; }
    const [name] = STEPS[i];
    try { window.scrollTo(0, 0); if (ACT[name]) await ACT[name](); } catch (e) { say('B89NOTE error ' + name + ' ' + (e && e.message)); }
    if (KEEP[name]) KEEP[name]();
    say('B89SHOT ' + name); await sleep(1500);
    let ok = false;
    for (let k = 0; k < 300 && !ok; k++) { if (KEEP[name]) KEEP[name](); try { ok = (await (await fetch('http://127.0.0.1:8799/taken?n=' + name)).text()) === '1'; } catch (_) { if (k === 0) say('B89NOTE no ack channel'); } if (!ok) await sleep(1000); }
    if (!ok) say('B89NOTE no screenshot confirmed for ' + name);
    await sleep(500);
    try { window.softwave && window.softwave.stopAll && window.softwave.stopAll(); } catch (_) { }
    go(i + 1);
  });
})();
