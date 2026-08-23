# Find My Quiet Sound — Monetization Readiness (internal)

Last updated: 2026-08-23. Owner: product. Status: **LAUNCH ALL-ACCESS — monetization OFF, nothing is charged, nothing is gated.**

---

## 1. Current launch state

- `monetization.js` is the single source of truth: flags, plans, entitlements, pricing config, subscription states, analytics stub.
- Flags now: `MONETIZATION_ENABLED = false`, `LAUNCH_ALL_ACCESS = true`, `SHOW_PRICING = false`, `SHOW_PREMIUM_LABELS = true`, `TRIALS_ENABLED = false`, `LIFETIME_ENABLED = false`, `PREVIEWS_ENABLED = false`.
- Every user (anonymous included) receives Premium entitlements. No account, no checkout, no locks, no interruptions.
- Premium-classified features carry a quiet tag: “Premium · free during launch” (text comes from `LABELS.premiumTag`).
- All feature access flows through `softwaveMonetization.canUse(featureKey)` / `hasEntitlement(key)` — no scattered `isPaid` checks. The Experiments gate (`lab.js → gate()`) already routes through it.

## 2. Plans and entitlements

- **FREE** → `core_sounds, nature_sounds, basic_mixer, frequency_generator, tinnitus_match, visual_focus_basic, sleep_basic, attention_focus, saved_sessions_basic`.
- **PREMIUM_MONTHLY / PREMIUM_ANNUAL / LIFETIME** → everything in Free plus `find_my_sound, sound_profile, frequency_painting, sound_sculptor, generative_sound, sound_morph, sound_space, adaptive_journeys, visual_journeys, session_builder, premium_visuals, premium_sound_environments, saved_sessions_unlimited, cross_device_sync`.
- Positioning rule: Premium sells **personalisation, discovery, experiments, adaptive experiences and saved personal environments** — never “more noises”. Free must stay genuinely useful (all core + nature sounds, mixer, Visual Focus, Sleep, frequency generator).
- Feature→entitlement map lives in `FEATURE_ENTITLEMENT` (experiments by id, saves, profile).
- Preview policy (inactive) in `PREVIEWS`: e.g. Frequency Painting 3-minute preview, one full Find My Sound session, short premium-visual previews. Enable later via `PREVIEWS_ENABLED`.

## 3. Subscription states

`none · trial · active · past_due · cancelled · expired · lifetime · launch_all_access`, mapped to entitlements in `currentPlan()`:
- `past_due` keeps Premium during billing recovery (grace period; no data loss).
- `cancelled` keeps Premium until period end, then falls to Free.
- `expired`/`none` → Free.
- Data policy (implemented in `canCreateSavedItem`): downgrades NEVER delete saved sounds, profiles, paintings, environments or history; a future Free limit only prevents creating new items past the limit.

## 4. Accounts (not yet built — architecture decided)

- No registration required to listen, focus, sleep or experiment. Accounts exist for: saved items, Sound Profile persistence, experiment history, cross-device sync, subscription ownership, billing portal access.
- Sign-up moments (value first, never at entry): “Save this sound”, “Save my Sound Profile”, “Save this environment”, “Sync across devices”, “Manage Premium”.
- Recommended: managed auth (e.g. Supabase Auth / Firebase Auth / Clerk) — email + OAuth, no passwords stored by us. Local data migrates to the account on first sign-in (upload local `softwave:*` keys, then sync).
- Early users: reserve a `founding_user` entitlement flag on account records so grandfathering (discounts / permanent bonuses / longer trials) stays possible. Not promised publicly.

## 5. Billing (Stripe — prepared, not connected)

- Products/prices: `premium_monthly`, `premium_annual`, optional `lifetime` (one-time). Prices configured only in Stripe + `PRICING` (currently null; UI must never show fake prices). Currency: USD first; Stripe Prices support multi-currency later.
- Flows: Stripe Checkout for purchase; **Stripe Customer Portal** for manage/cancel/update-card/invoices (do not build custom billing settings); Stripe Tax for VAT/GST/sales tax (depends on business registration — decide before launch of payments); Stripe handles receipts and refunds.
- Trial: `trialDays` in config + Stripe trial settings; states distinguish trial vs active vs launch users.
- Webhooks the backend must verify (signature-checked, idempotent): `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`, `charge.refunded`. Webhooks — not the browser — are the source of truth for entitlement state.

## 6. Backend & hosting requirements (before any real charge)

GitHub Pages is static and stays for the free product/marketing. **No secret key, checkout-session creation, webhook handling or entitlement grant may live on it.** Required before charging:
1. Serverless backend (e.g. Cloudflare Workers / Vercel / Netlify functions): `POST /checkout-session`, `POST /stripe-webhook`, `GET /me` (auth’d: subscription state + entitlements, signed), `POST /portal-session`.
2. Managed database for accounts + subscription state (e.g. Supabase/Firestore). Client caches the signed entitlement state; server re-verifies.
3. Custom domain + HTTPS for app and API (findmyquietsound.com is reserved; connect when going commercial).
4. The client’s `monetization.js` then reads state from `GET /me` instead of local simulation. The flag flip is real only when this is in place.

## 7. Security checklist (standing rules)

- Stripe SECRET keys: never in client JS/HTML/repo/browser storage/frontend env. Publishable key only in the client.
- Payment success reported by the browser is never trusted — webhook-verified state only.
- Entitlements must come signed from the backend once monetization is on (client-side state is dev-only; trivially editable in devtools).
- Webhook signature verification mandatory; endpoints idempotent; no billing data exposed beyond need; HTTPS everywhere.
- Repo scan before enabling: no secrets committed (none exist today).

## 8. Legal & tax before charging (placeholders exist, content pending review)

Routes prepared (noindex drafts, not linked in navigation): `/terms/`, `/subscription-terms/`, `/refunds/`. Already live: `/privacy/`, `/medical-disclaimer/`, `/contact/`.
Before real payments: complete Terms of Service, Subscription Terms (price, billing frequency, auto-renewal, trial terms, cancellation rules, what Premium includes), Refund/Cancellation policy, support contact; configure Stripe Tax per business registration/jurisdictions. No dark patterns: no hidden renewal, no preselected expensive options, clear cancellation.

## 9. Privacy rules

- Billing/account data, sound preferences and optional personalisation data stay separate. Tinnitus preferences are not marketing data.
- Analytics (`softwaveMonetization.track`): named events only, counted locally today, sent nowhere. Post-launch endpoint may receive event name + timestamp (+ account id where consented). Never free-text or health details. Event list: pricing_viewed, premium_feature_opened, premium_preview_started, checkout_started, checkout_completed, trial_started, subscription_cancelled, subscription_reactivated, find_my_sound_completed, sound_profile_created, frequency_painting_used, environment_saved, sound_saved.

## 10. Future pricing UI

`/premium/` page exists and stays informational. When `SHOW_PRICING = true`: two-column Free vs Premium using `PRICING` values only (if a price is null, show “Free during launch” instead — never a fake number). Disclosures per §8.

---

# TURN ON MONETIZATION — checklist (in order)

1. Confirm final prices, currency, trial length → fill `PRICING`.
2. Stand up backend (checkout-session, webhook, /me, portal-session) + database + auth (§6).
3. Create Stripe products/prices (test mode); configure Customer Portal + Stripe Tax.
4. Point `monetization.js` at `GET /me`; remove/disable the dev simulator path.
5. Complete legal pages (§8) and link them from footer/checkout.
6. Implement account sign-in at the save/sync moments (§4); migrate local data on first sign-in.
7. Test in Stripe test mode: checkout (monthly/annual/lifetime), cancellation (access until period end), failed payment → past_due grace, expiry → Free with data preserved, trial start/end, refund, portal, entitlement changes, Free limits (creation-only, nothing deleted), mobile + desktop, account recovery.
8. Verify analytics events fire; verify no secrets in the client; verify webhook signatures.
9. Decide grandfathering for existing users (`founding_user`).
10. Flip flags: `MONETIZATION_ENABLED = true`, `LAUNCH_ALL_ACCESS = false` (optionally `SHOW_PRICING = true`, `TRIALS_ENABLED`, `PREVIEWS_ENABLED`).
11. Switch Stripe to live mode. Monitor closely (webhook failures, involuntary churn, support inbox).

Rollback at any time: set `LAUNCH_ALL_ACCESS = true` — everyone returns to full access; no data was ever deleted.
