# Cloud accounts + sync — setup & architecture (Phase 1)

Status: **code complete, INERT in production** until you create the Supabase project and paste two
public values into `cloud-config.js`. Until then Find My Quiet Sound is exactly what it was:
free, anonymous, local-first, zero network calls for accounts.

## Why Supabase

Compared for this app against Firebase and Cloudflare (Workers + D1):
- One managed platform covers all Phase 1 + Phase 2 needs: **Auth (magic links), Postgres with Row-Level Security, auto REST API, Edge Functions (future Stripe webhooks), secrets storage** — no second vendor.
- **RLS is the security model this app needs**: user isolation enforced in the database itself, and a `billing` table clients can read but never write — server-authoritative entitlements without custom middleware.
- Free tier fits a small PWA (500 MB Postgres, 50k monthly active auth users); standard Postgres = no lock-in.
- Firebase: rules-based NoSQL, Google-centric, free tier reduced in 2026 (Cloud Storage removed from Spark plan). Cloudflare D1: excellent edge DB but no built-in auth/policies — more assembly for the same result.
- Sources: [Supabase vs Cloudflare D1 (2026)](https://www.devtoolreviews.com/reviews/supabase-vs-cloudflare-d1-comparison-2026), [DB free-tier comparison 2026](https://agentdeals.dev/database-free-tier-comparison-2026), [Supabase vs Cloudflare platform comparison](https://www.buildmvpfast.com/compare/supabase-vs-cloudflare).

## Activation steps (~15 minutes, done by the owner — requires creating the account)

1. Create a project at supabase.com (free tier). Region: closest to your users.
2. SQL editor → paste and run `supabase/schema.sql` (tables + RLS policies + read-only billing).
3. Authentication → Providers → Email: enable **magic link** (passwordless). Set the Site URL to
   `https://debra-lang.github.io/softwave/` (add localhost:8765 for testing) under URL configuration.
4. Settings → API: copy the **Project URL** and the **anon public key** into `cloud-config.js`, deploy.
   (The anon key is publishable by design; RLS is the protection. The service_role key must never
   leave the Supabase dashboard / server environment.)
5. Optional now, required in Phase 2: `supabase functions deploy me` (code in `supabase/functions/me/`).
   Phase 1 works without it — the client reads the read-only `billing` row directly, same authority.

When step 4 is deployed, a small **Sign in** appears in the header; nothing else changes.

## Architecture

- **Local-first**: anonymous users use localStorage only (unchanged). Signed-in users keep writing
  locally; a wrapped `localStorage.setItem` marks synced keys dirty and a debounced (4 s) push
  upserts them. Pull happens at start/sign-in. Offline: changes queue in `softwave:cloud:dirty`
  and flush on the `online` event. Backend down → status "saved on this device", app unaffected.
- **What syncs**: saved sounds (`lab:sounds`→items:sound), mixes (`mixes`→items:mix), environments
  (`combos`→items:environment), Sound Profile (`lab:prefs2`→state:profile), experiment feedback,
  favourites, spatial layout, and a small settings doc (theme, motion, visual, master).
  **Deliberately not synced** (data minimisation): the tinnitus-match result, play counts, local
  metrics, prototype keys, dev simulator.
- **Merge**: every item gets a uuid (`_cid`) + `_updated`; same id → newest `updated_at` wins;
  unknown ids → kept on both sides; loss is treated as worse than duplication.
- **Identity**: Supabase auth user id (uuid) — never email/localStorage values.
- **Sessions/tokens**: supabase-js default session handling (provider-recommended); nothing custom.
- **Entitlement authority**: signed-in → `monetization.setServerState()` from the read-only billing
  row (or `/me`); client devtools cannot forge it (no write policies). Anonymous → launch flags.
  Dev simulator now refuses to run outside localhost. Launch flags still override everything:
  `MONETIZATION_ENABLED=false`, `LAUNCH_ALL_ACCESS=true` — all features for everyone.
- **Service worker**: cross-origin requests (Supabase) are never intercepted; additionally any
  request with an Authorization header or `/auth/`//functions/` path is skipped — account state
  is never cached by the PWA.
- **Account UI**: one "Sign in"/"Account" pill + a sheet (email link, sync status, Sync now,
  Export my data (JSON), Sign out, Delete account with a separate, explicit choice about local data).
- **Deletion**: clears the user's rows in `user_items`, `user_state`, `profiles`; local data is
  removed only if the user separately confirms. Full auth-record deletion needs the service role →
  Phase 2 backend endpoint (documented limitation).

## Privacy-policy update (publish TOGETHER with activation, not before)

Add to /privacy/ when accounts go live: optional account = email + a random account id stored with
Supabase (processor); what syncs (list above) and why; local-first remains the default; how to
export and delete; analytics remain local-only counters; no health information is collected;
the tinnitus-match result stays on the device only.

## Phase 2 (NOT implemented): Stripe test mode

Requires: Stripe account; products/prices (monthly, annual, optional lifetime); Edge Functions
`checkout-session`, `stripe-webhook` (signature-verified, service-role writes to `billing`),
`portal-session`; Stripe Tax evaluation; test-card runs for checkout, cancel (access to period
end), failed payment → past_due grace, expiry → free with data intact, refunds; then and only then
flip `MONETIZATION_ENABLED=true`, `LAUNCH_ALL_ACCESS=false` (client + `me` function together).
