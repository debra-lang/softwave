// GET /functions/v1/me — server-authoritative account state (Phase 1).
// Deploy with: supabase functions deploy me   (JWT verification stays ON — default)
// Returns only what the client needs; nothing sensitive. Launch all-access is reported
// so the client can render honestly, but entitlement AUTHORITY lives here + in the
// read-only `billing` table (clients cannot write it — no RLS write policies).
import { createClient } from "jsr:@supabase/supabase-js@2";

const FREE = ["core_sounds","nature_sounds","basic_mixer","frequency_generator","tinnitus_match","visual_focus_basic","sleep_basic","attention_focus","saved_sessions_basic"];
const PREMIUM = FREE.concat(["find_my_sound","sound_profile","frequency_painting","sound_sculptor","generative_sound","sound_morph","sound_space","adaptive_journeys","visual_journeys","session_builder","premium_visuals","premium_sound_environments","saved_sessions_unlimited","cross_device_sync"]);
const LAUNCH_ALL_ACCESS = true;   // flip in Phase 2+ together with the client flags

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Cache-Control": "no-store, private",           // never cache account state
    "Content-Type": "application/json",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });

  // billing is server-written only; a missing row means the free default
  const { data: billing } = await supabase.from("billing").select("plan,subscription_state,current_period_end,entitlements").eq("user_id", user.id).maybeSingle();
  const plan = billing?.plan ?? "free";
  const state = billing?.subscription_state ?? "none";
  const premium = LAUNCH_ALL_ACCESS || ["active","trial","past_due","lifetime"].includes(state) || (state === "cancelled" && billing?.current_period_end && new Date(billing.current_period_end) > new Date());
  const entitlements = Array.isArray(billing?.entitlements) ? billing!.entitlements : (premium ? PREMIUM : FREE);

  return new Response(JSON.stringify({
    user: { id: user.id, email: user.email },
    plan, subscription_state: LAUNCH_ALL_ACCESS ? "launch_all_access" : state,
    entitlements, launch_all_access: LAUNCH_ALL_ACCESS,
  }), { headers: cors });
});
