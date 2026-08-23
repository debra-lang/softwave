-- Find My Quiet Sound — cloud schema (Phase 1: accounts + sync foundation, NO billing activity)
-- Run this in Supabase → SQL editor. Everything is protected by Row Level Security:
-- a user can only ever touch rows where user_id = auth.uid(). Billing state is READ-ONLY
-- for clients (no insert/update policies) so entitlements cannot be forged from a browser.

-- ============ profiles: one row per account (non-sensitive) ============
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  founding_user boolean not null default true,          -- early users; future grandfathering
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles select own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles insert own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles update own" on public.profiles for update using (auth.uid() = user_id);
create policy "profiles delete own" on public.profiles for delete using (auth.uid() = user_id);

-- ============ billing: server-authoritative plan state (Phase 2 writes via service role ONLY) ============
create table if not exists public.billing (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',                    -- free | premium_monthly | premium_annual | lifetime
  subscription_state text not null default 'none',      -- none | trial | active | past_due | cancelled | expired | lifetime
  stripe_customer_id text,                              -- Phase 2 (no fake values now)
  stripe_subscription_id text,
  current_period_end timestamptz,
  entitlements jsonb,                                   -- optional server-computed override
  updated_at timestamptz not null default now()
);
alter table public.billing enable row level security;
create policy "billing select own" on public.billing for select using (auth.uid() = user_id);
-- Deliberately NO insert/update/delete policies for authenticated users:
-- only the service role (server / future Stripe webhook) can write billing state.

-- ============ user_items: saved objects (sounds, mixes, environments, paintings) ============
create table if not exists public.user_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('sound','mix','environment','painting')),
  name text not null default '',
  data jsonb not null,                                  -- the object exactly as the app uses it
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_items_user_kind on public.user_items (user_id, kind);
alter table public.user_items enable row level security;
create policy "items select own" on public.user_items for select using (auth.uid() = user_id);
create policy "items insert own" on public.user_items for insert with check (auth.uid() = user_id);
create policy "items update own" on public.user_items for update using (auth.uid() = user_id);
create policy "items delete own" on public.user_items for delete using (auth.uid() = user_id);

-- ============ user_state: single-document keys (profile, feedback, favourites, settings, …) ============
create table if not exists public.user_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (key in ('profile','feedback','favs','settings','spatial','labsettings')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.user_state enable row level security;
create policy "state select own" on public.user_state for select using (auth.uid() = user_id);
create policy "state insert own" on public.user_state for insert with check (auth.uid() = user_id);
create policy "state update own" on public.user_state for update using (auth.uid() = user_id);
create policy "state delete own" on public.user_state for delete using (auth.uid() = user_id);

-- Data-minimisation note: the app deliberately does NOT sync the tinnitus-match result,
-- play counts, analytics counters, prototype keys or the dev simulator. Sound preferences only.
