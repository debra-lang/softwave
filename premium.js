/* Find My Quiet Sound — contextual Premium UI (built ahead of monetization; inert during launch).
   Principles: never interrupt onboarding, appear only when the user intentionally opens a gated
   feature, always offer "Continue with Free" prominently, never oversell, never delete data.
   While MONETIZATION_ENABLED=false / LAUNCH_ALL_ACCESS=true, gate() always returns true and no
   dialog can ever appear. Billing is provider-neutral: startTrial() routes to window.softwaveBilling
   (web/Apple/Google adapter, added later) and falls back to the dev simulator on dev hosts. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const M = () => window.softwaveMonetization;
  const store = { get(k, d) { try { const v = localStorage.getItem('softwave:' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem('softwave:' + k, JSON.stringify(v)); } catch (_) { } } };
  const DISMISS_HOURS = 24;   // after a dismissal, the same feature shows a quiet toast instead of the dialog

  // Short, accurate, feature-specific copy (no cure/treat language, no urgency).
  const COPY = {
    'experiment:sculptor': { title: 'Explore Sound Sculptor with Premium', line: 'Shape and explore sound interactively, in a completely different way.' },
    'experiment:paint': { title: 'Explore Frequency Painting with Premium', line: 'Paint across frequencies and create a sound landscape that’s uniquely yours.' },
    'experiment:discovery': { title: 'Continue discovering with Premium', line: 'Run Find My Sound as often as you like and build a Sound Profile that remembers what you prefer.' },
    'experiment:generative': { title: 'Explore Generative Sound with Premium', line: 'Sound that gently evolves and never repeats.' },
    'experiment:morph': { title: 'Explore Sound Morph with Premium', line: 'Drift between two sounds and stop where it feels best.' },
    'experiment:space': { title: 'Explore Sound Space with Premium', line: 'Place sounds around you and shape the space they live in.' },
    'experiment:svjourney': { title: 'Explore Sound + Visual Journeys with Premium', line: 'Guided sessions that pair sound with a slowly changing visual.' },
    'experiment:journey': { title: 'Explore Adaptive Journeys with Premium', line: 'Longer sessions that change gradually — never suddenly.' },
    'experiment:session': { title: 'Explore the Session Builder with Premium', line: 'Build multi-step listening sessions around what works for you.' },
    'sound_profile': { title: 'Keep your Sound Profile with Premium', line: 'Remember and build on your sound preferences over time.' },
    'visual': { title: 'Explore more with Premium', line: 'Unlock the full Visual Focus collection and create more personalised sound + visual environments.' },
    'saves': { title: 'You’ve saved 5 quiet environments', line: 'Your existing saves are safe. Premium gives you unlimited saves — and, when accounts arrive, cloud backup and cross-device sync.' },
    'mixer_layers': { title: 'Layer more sounds with Premium', line: 'Mix up to five sounds at once with advanced controls.' },
  };
  const copyFor = k => COPY[k] || (k && k.indexOf('visual:') === 0 ? COPY.visual : { title: 'Explore more with Premium', line: 'This feature is part of Premium.' });
  const trackKey = k => k && k.indexOf('visual:') === 0 ? 'visual' : k;

  // ---------- gate: the single entry point features call ----------
  // Returns true when the feature may open. When gated: shows the contextual dialog (or, if the
  // user dismissed this feature recently, a quiet toast) and returns false.
  function gate(featureKey) {
    const m = M(); if (!m) return true;
    if (m.canUse(featureKey)) return true;
    m.track('premium_feature_opened', trackKey(featureKey));
    const dis = store.get('prem:dismiss', {});
    if (dis[trackKey(featureKey)] && Date.now() - dis[trackKey(featureKey)] < DISMISS_HOURS * 3600000) {
      quiet(copyFor(featureKey));
      return false;
    }
    show(featureKey);
    return false;
  }

  // Save-limit variant (never blocks a dialog on ordinary saves — callers use this when the count is reached).
  function saveLimit(kind) {
    const m = M(); if (m) m.track('save_limit_reached', 'saves');
    show('saves', { manageLabel: 'Manage My Saves' });
    return false;
  }

  function quiet(c) {
    const app = window.softwaveApp; const msg = c.title + ' — free trial available under Free & Premium.';
    if (app && app.toast) app.toast(msg, 3600); else console.info(msg);
  }

  // ---------- dialog ----------
  let host = null, lastFocus = null, currentKey = null;
  function ensureHost() {
    if (host) return host;
    host = document.createElement('div');
    host.id = 'premium-veil'; host.className = 'premium-veil'; host.hidden = true;
    host.innerHTML = '<div class="premium-card" role="dialog" aria-modal="true" aria-labelledby="prem-title"></div>';
    host.addEventListener('click', e => { if (e.target === host) dismiss(); });
    host.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); dismiss(); }
      if (e.key === 'Tab') {   // focus trap
        const f = [...host.querySelectorAll('button, a[href]')].filter(el => el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    document.body.appendChild(host);
    return host;
  }
  const money = n => '$' + n.toFixed(2);

  function show(featureKey, opts = {}) {
    const m = M(); const c = copyFor(featureKey); const P = m.PRICING;
    currentKey = trackKey(featureKey);
    m.track('premium_prompt_shown', currentKey);
    ensureHost();
    const card = $('.premium-card', host);
    card.innerHTML = `
      <p class="prem-eyebrow">Premium</p>
      <h2 id="prem-title">${c.title}</h2>
      <p class="prem-line">${c.line}</p>
      <p class="prem-terms">Try Premium free for ${P.trialDays} days. Then ${money(P.annualPrice)}/year (${P.annualSavingsText}) unless cancelled. Cancel anytime.</p>
      <div class="prem-actions">
        <button class="btn btn-primary btn-xl" data-prem="trial">Start Free Trial</button>
        <button class="btn btn-ghost btn-xl" data-prem="free">${opts.manageLabel ? 'Manage My Saves' : 'Continue with Free'}</button>
      </div>
      <p class="prem-links"><button class="linklike" data-prem="plans">See all plans</button></p>`;
    $('[data-prem="trial"]', card).addEventListener('click', () => startTrial('PREMIUM_ANNUAL'));
    $('[data-prem="free"]', card).addEventListener('click', () => { if (opts.manageLabel && window.softwaveApp && softwaveApp.showView) { dismiss(); softwaveApp.showView('sounds'); } else dismiss(); });
    $('[data-prem="plans"]', card).addEventListener('click', () => plans(currentKey));
    open();
  }

  function plans(entryFeature) {
    const m = M(); const P = m.PRICING;
    m.track('pricing_viewed', entryFeature || 'plans');
    ensureHost();
    const card = $('.premium-card', host);
    card.innerHTML = `
      <p class="prem-eyebrow">Find My Quiet Sound Premium</p>
      <h2 id="prem-title">Go deeper with the sounds and experiences that work for you.</h2>
      <div class="prem-plans">
        <div class="prem-plan">
          <h3>Free</h3>
          <p class="prem-price">$0 <span>forever</span></p>
          <ul><li>Core sound library — all 20 sounds</li><li>Find My Tinnitus Sound</li><li>Basic Find My Sound</li><li>Mixer (3 layers)</li><li>Visual Focus core collection</li><li>Sleep with timer</li><li>Selected Experiments</li><li>5 saves per category</li></ul>
        </div>
        <div class="prem-plan prem-plan-best">
          <p class="prem-badge">${P.annualBadge}</p>
          <h3>Premium</h3>
          <p class="prem-price">${money(P.annualPrice)}<span>/year · ${P.annualSavingsText}</span></p>
          <p class="prem-trial-note">${P.trialDays} days free</p>
          <ul><li>Everything in Free</li><li>Full Find My Sound + Sound Profile</li><li>Frequency Painting</li><li>Sound Sculptor</li><li>Advanced Experiments</li><li>Mixer up to 5 layers</li><li>Full Visual Focus collection</li><li>Unlimited saves</li><li>Cloud backup &amp; sync — coming with account sync</li></ul>
          <p class="prem-alt">or ${money(P.monthlyPrice)}/month, no annual commitment</p>
        </div>
      </div>
      <p class="prem-terms">${P.trialDays} days free, then ${money(P.annualPrice)}/year (or ${money(P.monthlyPrice)}/month) unless cancelled. Cancel anytime.</p>
      <div class="prem-actions">
        <button class="btn btn-primary btn-xl" data-prem="trial">Try Premium Free for ${P.trialDays} Days</button>
        <button class="btn btn-ghost btn-xl" data-prem="free">Continue with Free</button>
      </div>`;
    $('[data-prem="trial"]', card).addEventListener('click', () => { m.track('plan_selected', entryFeature || 'plans'); startTrial('PREMIUM_ANNUAL'); });
    $('[data-prem="free"]', card).addEventListener('click', dismiss);
    open();
  }

  function open() {
    lastFocus = document.activeElement;
    host.hidden = false; document.body.style.overflow = 'hidden';
    const first = host.querySelector('button'); if (first) first.focus();
  }
  function dismiss() {
    if (!host || host.hidden) return;
    const m = M(); if (m && currentKey) { m.track('premium_prompt_dismissed', currentKey); const dis = store.get('prem:dismiss', {}); dis[currentKey] = Date.now(); store.set('prem:dismiss', dis); }
    host.hidden = true; document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (_) { }
    currentKey = null;
  }

  // ---------- billing integration point (provider-neutral) ----------
  // Real billing (web / App Store / Google Play) plugs in as window.softwaveBilling = { startTrial(planId) }.
  // Entitlement authority stays server-side (cloud.js setServerState) — this layer never grants Premium itself.
  function startTrial(planId) {
    const m = M();
    m.track('trial_started', currentKey || 'plans');
    if (window.softwaveBilling && softwaveBilling.startTrial) { softwaveBilling.startTrial(planId); return; }
    const sim = m.simulate('trial');
    dismiss();
    const app = window.softwaveApp;
    const msg = typeof sim === 'string' ? 'Trials open when Premium launches — everything is free for now.' : 'Test trial started (development simulator): 7 days of Premium.';
    if (app && app.toast) app.toast(msg, 4200);
  }

  window.softwavePremium = { gate, saveLimit, show, plans, dismiss };
})();
