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
    $('[data-prem="plans"]', card).addEventListener('click', () => placard(currentKey));
    open();
  }

  // ---------- the trial placard: benefit-led, honest, single CTA ----------
  // Outcomes over features; risk reversal stated three ways (no payment today, cancel anytime,
  // saves always kept); verifiable trust badges instead of fabricated social proof; the free
  // path stays visible. Full comparison one tap away for rational readers.
  const ICO = {
    moon: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    spark: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    slider: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><g stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h13"/><circle cx="16" cy="7" r="2" fill="none"/><circle cx="10" cy="12" r="2" fill="none"/><circle cx="19" cy="17" r="2" fill="none"/></g></svg>',
    eye: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    shield: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  function placard(entryFeature) {
    const m = M(); const P = m.PRICING;
    m.track('pricing_viewed', entryFeature || 'placard');
    ensureHost();
    const card = $('.premium-card', host);
    card.innerHTML = `
      <p class="prem-eyebrow">Premium</p>
      <h2 id="prem-title">Hear what Premium feels like — free for ${P.trialDays} days</h2>
      <ul class="prem-benefits">
        <li>${ICO.moon}<div><strong>Your Sleep &amp; Your Focus</strong><span>One-tap Moments built from your own preferences.</span></div></li>
        <li>${ICO.spark}<div><strong>Find My Sound — unlimited</strong><span>Re-discover anytime; your profile keeps learning as your taste changes.</span></div></li>
        <li>${ICO.slider}<div><strong>Sculpt your own sound</strong><span>And keep unlimited saves.</span></div></li>
        <li>${ICO.eye}<div><strong>The full visual collection</strong><span>Calm environments for focus and sleep.</span></div></li>
        <li>${ICO.shield}<div><strong>Cancel anytime — everything you saved stays yours</strong><span>Nothing you keep is ever taken away.</span></div></li>
      </ul>
      <p class="prem-badges">No account · No ads · Nothing leaves your device</p>
      <p class="prem-check">✓ No payment due today</p>
      <div class="prem-actions">
        <button class="btn btn-primary btn-xl" data-prem="trial">Start my free week</button>
        <button class="btn btn-ghost btn-xl" data-prem="free">Continue with Free</button>
      </div>
      <p class="prem-terms">Then ${money(P.annualPrice)}/year (${P.annualSavingsText}) or ${money(P.monthlyPrice)}/month unless cancelled. Cancel anytime.</p>
      <p class="prem-links"><button class="linklike" data-prem="compare">See full comparison</button> · <button class="linklike" data-prem="restore">Restore purchases</button> · <a class="linklike" href="terms/">Terms</a> · <a class="linklike" href="privacy/">Privacy</a></p>`;
    $('[data-prem="trial"]', card).addEventListener('click', () => { m.track('plan_selected', entryFeature || 'placard'); startTrial('PREMIUM_ANNUAL'); });
    $('[data-prem="free"]', card).addEventListener('click', dismiss);
    $('[data-prem="compare"]', card).addEventListener('click', () => plans(entryFeature));
    $('[data-prem="restore"]', card).addEventListener('click', () => {
      if (window.softwaveBilling && softwaveBilling.restore) { softwaveBilling.restore(); return; }
      const app = window.softwaveApp; if (app && app.toast) app.toast('Purchases can be restored here once Premium launches.', 3600);
    });
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

  window.softwavePremium = { gate, saveLimit, show, plans, placard, dismiss };
  // Preview flag (like ?intro=1): lets the owner view the dormant placard on any device.
  try { if (new URLSearchParams(location.search).get('placard') === '1') setTimeout(() => { try { placard('preview'); } catch (_) { } }, 700); } catch (_) { }
})();
