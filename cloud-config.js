/* Cloud configuration — Supabase project credentials (PUBLIC values only).
   Leave both empty and every account/sync feature stays completely inert: no network calls,
   no sign-in UI, pure local-first behaviour. Fill them in (see CLOUD-SETUP.md) to activate
   optional accounts + sync. The anon key is a publishable client key protected by Row Level
   Security — it is NOT a secret. Never put the service_role key or any secret here. */
window.SOFTWAVE_CLOUD = {
  SUPABASE_URL: '',        // e.g. 'https://abcdefgh.supabase.co'
  SUPABASE_ANON_KEY: '',   // the "anon public" key from Supabase → Settings → API
};
