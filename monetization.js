/* Find My Quiet Sound — monetization layer (single source of truth).
   LAUNCH STATE: monetization OFF, all-access ON — every user gets Premium entitlements for free.
   Later, charging is enabled mainly by flipping FLAGS and connecting the billing backend described
   in MONETIZATION.md. Nothing in this file talks to a payment provider; no secrets belong here — ever.

   IMPORTANT SECURITY NOTE (static hosting): on GitHub Pages there is no backend, so everything in this
   layer is client-side and can be edited by any user in devtools. That is acceptable ONLY while
   everything is free. Before real charging, entitlement state MUST come from a secure backend
   (see MONETIZATION.md → "Before enabling real payments"). */
(function (global) {
  'use strict';

  // ---------------- feature flags (the only switches that matter) ----------------
  const FLAGS = {
    MONETIZATION_ENABLED: false,   // master switch — false = nothing is ever gated or sold
    LAUNCH_ALL_ACCESS: true,       // true = everyone receives Premium entitlements
    SHOW_PRICING: false,           // future pricing UI stays hidden until true
    SHOW_PREMIUM_LABELS: true,     // subtle "Premium · free during launch" tags
    TRIALS_ENABLED: false,
    LIFETIME_ENABLED: false,
    PREVIEWS_ENABLED: false,       // future: let Free users preview Premium features
  };

  // ---------------- pricing configuration (placeholders — no fake prices in UI) ----------------
  const PRICING = {
    currency: 'USD',               // launch currency; architecture is not tied to one currency
    monthlyPrice: null,            // set real numbers only when monetization is turned on
    annualPrice: null,
    lifetimePrice: null,
    annualSavingsText: null,       // e.g. "2 months free"
    trialDays: 0,                  // e.g. 7 or 14 when TRIALS_ENABLED
  };

  // ---------------- entitlements ----------------
  const FREE_ENTITLEMENTS = [
    'core_sounds',                 // white / pink / brown + core noise family
    'nature_sounds',               // rain, ocean, wind, forest, stream, waterfall, fan, fire, night
    'basic_mixer',
    'frequency_generator',
    'tinnitus_match',              // Find My Tinnitus Sound
    'visual_focus_basic',          // the visual library + focus mode
    'sleep_basic',
    'attention_focus',
    'saved_sessions_basic',        // a reasonable number of saved items (limit enforced only post-launch)
  ];
  const PREMIUM_ENTITLEMENTS = FREE_ENTITLEMENTS.concat([
    'find_my_sound',               // full discovery experience
    'sound_profile',
    'frequency_painting',
    'sound_sculptor',
    'generative_sound',
    'sound_morph',
    'sound_space',
    'adaptive_journeys',           // Adaptive Sound Journey
    'visual_journeys',             // Sound + Visual Journey
    'session_builder',
    'premium_visuals',             // future premium visual environments
    'premium_sound_environments',
    'saved_sessions_unlimited',
    'cross_device_sync',           // requires accounts + backend
  ]);

  // ---------------- plans ----------------
  const PLANS = {
    FREE:            { id: 'free',            entitlements: FREE_ENTITLEMENTS },
    PREMIUM_MONTHLY: { id: 'premium_monthly', entitlements: PREMIUM_ENTITLEMENTS, billing: 'monthly' },
    PREMIUM_ANNUAL:  { id: 'premium_annual',  entitlements: PREMIUM_ENTITLEMENTS, billing: 'annual' },
    LIFETIME:        { id: 'lifetime',        entitlements: PREMIUM_ENTITLEMENTS, billing: 'one_time' },
  };

  // Map product features → entitlement keys (experiments by id; other features by name).
  const FEATURE_ENTITLEMENT = {
    'experiment:discovery': 'find_my_sound',
    'experiment:paint': 'frequency_painting',
    'experiment:sculptor': 'sound_sculptor',
    'experiment:generative': 'generative_sound',
    'experiment:morph': 'sound_morph',
    'experiment:space': 'sound_space',
    'experiment:attention': 'attention_focus',
    'experiment:svjourney': 'visual_journeys',
    'experiment:journey': 'adaptive_journeys',
    'experiment:session': 'session_builder',
    'sound_profile': 'sound_profile',
    'save_sound': 'saved_sessions_basic',
    'save_environment': 'saved_sessions_basic',
  };

  // Future preview policy (inactive until PREVIEWS_ENABLED): how a Free user may sample Premium.
  const PREVIEWS = {
    frequency_painting: { kind: 'time', minutes: 3 },
    find_my_sound: { kind: 'sessions', count: 1 },
    premium_visuals: { kind: 'time', minutes: 2 },
  };

  // ---------------- subscription state ----------------
  // none | trial | active | past_due | cancelled | expired | lifetime | launch_all_access
  // Post-launch this MUST be set from the backend (webhook-verified). The dev simulator below is for
  // local testing only and is ignored the moment a backend-signed state exists.
  const store = { get(k, d) { try { const v = localStorage.getItem('softwave:' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem('softwave:' + k, JSON.stringify(v)); } catch (_) { } } };

  function subscriptionState() {
    if (!FLAGS.MONETIZATION_ENABLED || FLAGS.LAUNCH_ALL_ACCESS) return 'launch_all_access';
    const dev = store.get('dev:plan', null);           // test-only simulator (see simulate())
    if (dev) return dev.state || 'active';
    // Real implementation: read the backend-issued, server-verified subscription state here.
    return 'none';
  }
  function currentPlan() {
    const state = subscriptionState();
    if (state === 'launch_all_access') return PLANS.PREMIUM_MONTHLY;   // launch: everyone effectively Premium
    const dev = store.get('dev:plan', null);
    if (dev && PLANS[dev.plan]) {
      // cancelled/expired fall back to Free at period end; past_due keeps access during recovery
      if (dev.state === 'expired' || dev.state === 'none') return PLANS.FREE;
      if (dev.state === 'cancelled' && dev.periodEnded) return PLANS.FREE;
      return PLANS[dev.plan];
    }
    return PLANS.FREE;
  }
  function effectiveEntitlements() { return currentPlan().entitlements.slice(); }
  function hasEntitlement(key) { return effectiveEntitlements().includes(key); }
  function canUse(featureKey) {
    if (!FLAGS.MONETIZATION_ENABLED || FLAGS.LAUNCH_ALL_ACCESS) return true;
    const ent = FEATURE_ENTITLEMENT[featureKey]; if (!ent) return true;   // unclassified features stay open
    return hasEntitlement(ent);
  }

  // Data policy: subscription changes never delete user-created data (sounds, profiles, paintings,
  // environments, history). Free-plan limits, when they exist, only prevent NEW creation past the limit.
  function canCreateSavedItem(currentCount) {
    if (!FLAGS.MONETIZATION_ENABLED || FLAGS.LAUNCH_ALL_ACCESS) return true;
    if (hasEntitlement('saved_sessions_unlimited')) return true;
    return currentCount < 10;   // Free limit applies only after monetization is on; existing data always kept
  }

  // ---------------- labels (UI copy comes from here, not scattered strings) ----------------
  const LABELS = {
    premiumTag: FLAGS.MONETIZATION_ENABLED && !FLAGS.LAUNCH_ALL_ACCESS ? 'Premium' : 'Premium · free during launch',
    launchNotice: 'All features are free during our launch period.',
  };

  // ---------------- privacy-conscious analytics stub ----------------
  // Counts events locally only; sends NOTHING anywhere until an endpoint is configured post-launch.
  // Never pass free-text or health information — event names + coarse counts only.
  const ANALYTICS_EVENTS = ['pricing_viewed', 'premium_feature_opened', 'premium_preview_started', 'checkout_started', 'checkout_completed', 'trial_started', 'subscription_cancelled', 'subscription_reactivated', 'find_my_sound_completed', 'sound_profile_created', 'frequency_painting_used', 'environment_saved', 'sound_saved'];
  function track(event) {
    if (!ANALYTICS_EVENTS.includes(event)) return;
    const c = store.get('metrics', {}); c[event] = (c[event] || 0) + 1; store.set('metrics', c);
    // Future: POST { event, ts } to the analytics endpoint (no user text, no health data, no identifiers beyond the account id where consented).
  }

  // ---------------- dev-only plan simulator (test future paid mode without charging) ----------------
  // softwaveMonetization.simulate('free' | 'premium_monthly' | 'premium_annual' | 'lifetime' | 'trial' | 'cancelled' | 'past_due' | 'expired' | null)
  function simulate(kind) {
    if (kind === null) { localStorage.removeItem('softwave:dev:plan'); return 'cleared'; }
    const map = {
      free: { plan: 'FREE', state: 'none' },
      premium_monthly: { plan: 'PREMIUM_MONTHLY', state: 'active' },
      premium_annual: { plan: 'PREMIUM_ANNUAL', state: 'active' },
      lifetime: { plan: 'LIFETIME', state: 'lifetime' },
      trial: { plan: 'PREMIUM_MONTHLY', state: 'trial' },
      cancelled: { plan: 'PREMIUM_MONTHLY', state: 'cancelled', periodEnded: false },
      cancelled_ended: { plan: 'PREMIUM_MONTHLY', state: 'cancelled', periodEnded: true },
      past_due: { plan: 'PREMIUM_MONTHLY', state: 'past_due' },
      expired: { plan: 'PREMIUM_MONTHLY', state: 'expired' },
    };
    if (!map[kind]) return 'unknown kind';
    store.set('dev:plan', map[kind]); return map[kind];
  }

  global.softwaveMonetization = { FLAGS, PRICING, PLANS, FREE_ENTITLEMENTS, PREMIUM_ENTITLEMENTS, FEATURE_ENTITLEMENT, PREVIEWS, LABELS, subscriptionState, currentPlan, effectiveEntitlements, hasEntitlement, canUse, canCreateSavedItem, track, simulate };
})(window);
