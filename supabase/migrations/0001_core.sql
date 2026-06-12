-- WWOS Sweepstakes — core schema (SCOPE.md §6)
-- Tier 1: central sports data repository (sweepstakes-agnostic)
-- Tier 2: per-sweepstakes data referencing tier 1

create extension if not exists "uuid-ossp";

-- ============================================================
-- Profiles & roles
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  is_admin boolean not null default false,
  notification_prefs jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table payout_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  method text not null check (method in ('paypal', 'venmo', 'check')),
  identifier text not null, -- paypal email / venmo handle / mailing address
  is_preferred boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TIER 1 — Central sports data repository
-- Written only by ingestion jobs + admin manual-entry console.
-- ============================================================
create table sports (
  id text primary key, -- 'cfb','nfl','nba','wnba','nhl','cbb','pga','liv','mlb'
  name text not null,
  team_label text not null default 'team', -- 'team' | 'golfer'
  sort_order int not null default 0
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  sport_id text not null references sports(id),
  external_ref text, -- provider id
  name text not null,
  abbrev text not null,
  market text, -- city/school
  active boolean not null default true,
  unique (sport_id, abbrev)
);

create table league_seasons (
  id uuid primary key default gen_random_uuid(),
  sport_id text not null references sports(id),
  season_label text not null, -- '2026-27'
  starts_at date,
  ends_at date,
  source text not null default 'api' check (source in ('api', 'manual')),
  unique (sport_id, season_label)
);

create table games (
  id uuid primary key default gen_random_uuid(),
  sport_id text not null references sports(id),
  league_season_id uuid references league_seasons(id),
  external_ref text,
  starts_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled','live','final','postponed','suspended','canceled')),
  home_team_id uuid references teams(id),
  away_team_id uuid references teams(id),
  winner_team_id uuid references teams(id),
  event_type text not null default 'regular', -- 'regular','wildcard','divisional', bowl keys, etc.
  broadcast jsonb, -- { network, stream }
  line_score jsonb, -- per half/period; powers half scoring
  result_source text not null default 'api' check (result_source in ('api','manual')),
  meta jsonb,
  unique (sport_id, external_ref)
);

create table data_alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null
    check (type in ('missing_result','provider_error','conflict','stale_schedule')),
  game_id uuid references games(id),
  detail text,
  status text not null default 'open' check (status in ('open','resolved')),
  resolved_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ============================================================
-- TIER 2 — Sweepstakes
-- ============================================================
create table themes (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'sweepstakes' check (scope in ('site','sweepstakes')),
  logo_url text,
  favicon_url text,
  hero_url text,
  og_url text,
  colors jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table series (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  recurrence_rule text, -- 'annual' etc.
  renewal_window_days int not null default 30,
  created_at timestamptz not null default now()
);

create table sweepstakes (
  id uuid primary key default gen_random_uuid(),
  series_id uuid references series(id),
  name text not null,
  slug text not null unique,
  description text,
  season_label text,
  game_mode text not null default 'draw_roster'
    check (game_mode in ('draw_roster','bracket')),
  status text not null default 'draft'
    check (status in ('draft','enrolling','full','drawing','active','completed','archived')),
  visibility text not null default 'public' check (visibility in ('public','private')),
  pool_size int not null default 15,
  entry_price_cents int not null default 100000,
  house_cut_pct numeric(5,2) not null default 0,
  house_cut_flat_cents int not null default 0,
  enrollment_opens_at timestamptz,
  enrollment_closes_at timestamptz,
  draw_at timestamptz,
  tiebreaker_rules jsonb not null default '[]',
  theme_id uuid references themes(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table access_grants (
  id uuid primary key default gen_random_uuid(),
  sweepstakes_id uuid not null references sweepstakes(id) on delete cascade,
  type text not null check (type in ('code','email','link')),
  value text not null,
  uses_remaining int, -- null = unlimited
  created_at timestamptz not null default now()
);

create table sweepstakes_sports (
  sweepstakes_id uuid not null references sweepstakes(id) on delete cascade,
  sport_id text not null references sports(id),
  picks_per_entry int not null,
  pool_source text not null default 'all' check (pool_source in ('all','top_n','curated')),
  top_n int,
  primary key (sweepstakes_id, sport_id)
);

create table scoring_rules (
  id uuid primary key default gen_random_uuid(),
  sweepstakes_id uuid references sweepstakes(id) on delete cascade, -- null = platform default
  sport_id text not null references sports(id),
  rule_key text not null, -- matches games.event_type ('regular','wildcard','sugar_bowl',…)
  label text not null,
  points int not null,
  scope text not null default 'full_game'
    check (scope in ('full_game','half1','half2','period')),
  unique (sweepstakes_id, sport_id, rule_key, scope)
);

-- ============================================================
-- Commerce & entries
-- ============================================================
create table products (
  id uuid primary key default gen_random_uuid(),
  sweepstakes_id uuid not null references sweepstakes(id) on delete cascade,
  name text not null,
  description text,
  price_cents int not null,
  inventory int,
  requires_shipping boolean not null default false,
  images jsonb not null default '[]',
  active boolean not null default true
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  product_id uuid not null references products(id),
  stripe_session_id text unique,
  status text not null default 'pending'
    check (status in ('pending','paid','refunded','failed')),
  amount_cents int not null,
  shipping jsonb,
  created_at timestamptz not null default now()
);

create table entries (
  id uuid primary key default gen_random_uuid(),
  sweepstakes_id uuid not null references sweepstakes(id) on delete cascade,
  owner_user_id uuid not null references profiles(id),
  order_id uuid references orders(id),
  display_name text not null,
  status text not null default 'active'
    check (status in ('active','refunded','withdrawn')),
  created_at timestamptz not null default now()
);

create table entry_shares (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references entries(id) on delete cascade,
  user_id uuid references profiles(id),
  invited_email text,
  percent numeric(5,2),
  status text not null default 'invited' check (status in ('invited','accepted','declined')),
  created_at timestamptz not null default now()
);

create table renewals (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references series(id),
  prior_entry_id uuid not null references entries(id),
  user_id uuid not null references profiles(id),
  next_sweepstakes_id uuid references sweepstakes(id),
  status text not null default 'reserved'
    check (status in ('reserved','renewed','lapsed','declined')),
  deadline timestamptz,
  renewed_order_id uuid references orders(id)
);

-- ============================================================
-- Draw & rosters
-- ============================================================
create table draws (
  id uuid primary key default gen_random_uuid(),
  sweepstakes_id uuid not null references sweepstakes(id) on delete cascade,
  version int not null default 1,
  seed_hash text, -- published before draw
  seed text,      -- revealed after draw
  status text not null default 'pending'
    check (status in ('pending','running','completed','voided')),
  started_at timestamptz,
  completed_at timestamptz
);

create table draw_picks (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references draws(id) on delete cascade,
  entry_id uuid not null references entries(id),
  team_id uuid not null references teams(id),
  sequence int not null,
  revealed_at timestamptz,
  unique (draw_id, sequence),
  unique (draw_id, team_id)
);

create table rosters (
  entry_id uuid not null references entries(id) on delete cascade,
  team_id uuid not null references teams(id),
  sport_id text not null references sports(id),
  primary key (entry_id, team_id)
);

-- ============================================================
-- Bracket mode (Phase 6)
-- ============================================================
create table brackets (
  id uuid primary key default gen_random_uuid(),
  sweepstakes_id uuid not null references sweepstakes(id) on delete cascade,
  entry_id uuid not null references entries(id) on delete cascade,
  tiebreaker_total int,
  locked_at timestamptz,
  unique (entry_id)
);

create table bracket_picks (
  bracket_id uuid not null references brackets(id) on delete cascade,
  slot int not null, -- bracket position
  round int not null,
  picked_team_id uuid not null references teams(id),
  result text not null default 'pending' check (result in ('pending','hit','miss')),
  primary key (bracket_id, slot)
);

-- ============================================================
-- Scoring ledger & standings
-- ============================================================
create table point_events (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references entries(id) on delete cascade,
  team_id uuid references teams(id),
  game_id uuid references games(id),
  rule_key text not null,
  scope text not null default 'full_game',
  points int not null,
  reversal_of uuid references point_events(id), -- corrections are compensating entries
  note text,
  created_at timestamptz not null default now(),
  unique (entry_id, game_id, rule_key, scope, reversal_of) -- idempotent ingestion
);

create table standings_snapshots (
  id uuid primary key default gen_random_uuid(),
  sweepstakes_id uuid not null references sweepstakes(id) on delete cascade,
  entry_id uuid not null references entries(id) on delete cascade,
  week int not null,
  rank int not null,
  total_points int not null,
  taken_at timestamptz not null default now(),
  unique (sweepstakes_id, entry_id, week)
);

create table accolades (
  id uuid primary key default gen_random_uuid(),
  sweepstakes_id uuid not null references sweepstakes(id) on delete cascade,
  entry_id uuid not null references entries(id) on delete cascade,
  type text not null, -- 'weekly_high','biggest_climber','hottest_team',…
  week int,
  value jsonb,
  created_at timestamptz not null default now()
);

create table disputes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  entry_id uuid not null references entries(id),
  game_id uuid references games(id),
  point_event_id uuid references point_events(id),
  reason text not null
    check (reason in ('wrong_winner','missing_game','wrong_points','duplicate','other')),
  note text,
  status text not null default 'open'
    check (status in ('open','under_review','fixed_central','adjusted_pool','rejected')),
  resolution_note text,
  resolved_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ============================================================
-- Money: payouts & ledgers
-- ============================================================
create table payouts (
  id uuid primary key default gen_random_uuid(),
  sweepstakes_id uuid not null references sweepstakes(id) on delete cascade,
  pot_type text not null default 'place'
    check (pot_type in ('place','lowest_score','weekly_high','top_team')),
  place int, -- for pot_type = 'place'
  entry_id uuid references entries(id),
  amount_cents int not null,
  status text not null default 'pending'
    check (status in ('pending','approved','sent','unclaimed','failed','canceled')),
  tax_doc_status text not null default 'not_required'
    check (tax_doc_status in ('not_required','requested','received')),
  paypal_batch_id text,
  paypal_item_id text,
  created_at timestamptz not null default now()
);

create table pot_ledger (
  id uuid primary key default gen_random_uuid(),
  sweepstakes_id uuid not null references sweepstakes(id) on delete cascade,
  type text not null check (type in ('entry','refund','house_cut','payout','adjustment')),
  amount_cents int not null, -- signed
  ref_order_id uuid references orders(id),
  ref_payout_id uuid references payouts(id),
  recorded_at timestamptz not null default now()
);

-- ============================================================
-- Community & misc
-- ============================================================
create table posts (
  id uuid primary key default gen_random_uuid(),
  sweepstakes_id uuid not null references sweepstakes(id) on delete cascade,
  user_id uuid references profiles(id), -- null = system message
  parent_id uuid references posts(id),
  body text not null,
  attachments jsonb not null default '[]',
  pinned boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table reactions (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  emoji text not null,
  primary key (post_id, user_id, emoji)
);

create table media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket_path text not null,
  kind text not null default 'image',
  sweepstakes_id uuid references sweepstakes(id),
  uploaded_by uuid references profiles(id),
  meta jsonb,
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid references profiles(id),
  action text not null,
  target text,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================
create index on games (sport_id, starts_at);
create index on games (status) where status in ('scheduled','live');
create index on point_events (entry_id);
create index on point_events (game_id);
create index on entries (sweepstakes_id);
create index on posts (sweepstakes_id, created_at desc);
create index on data_alerts (status) where status = 'open';
create index on disputes (status) where status in ('open','under_review');

-- ============================================================
-- Row Level Security
-- ============================================================
alter table profiles enable row level security;
alter table payout_accounts enable row level security;
alter table sports enable row level security;
alter table teams enable row level security;
alter table league_seasons enable row level security;
alter table games enable row level security;
alter table data_alerts enable row level security;
alter table themes enable row level security;
alter table series enable row level security;
alter table sweepstakes enable row level security;
alter table access_grants enable row level security;
alter table sweepstakes_sports enable row level security;
alter table scoring_rules enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table entries enable row level security;
alter table entry_shares enable row level security;
alter table renewals enable row level security;
alter table draws enable row level security;
alter table draw_picks enable row level security;
alter table rosters enable row level security;
alter table brackets enable row level security;
alter table bracket_picks enable row level security;
alter table point_events enable row level security;
alter table standings_snapshots enable row level security;
alter table accolades enable row level security;
alter table disputes enable row level security;
alter table payouts enable row level security;
alter table pot_ledger enable row level security;
alter table posts enable row level security;
alter table reactions enable row level security;
alter table media_assets enable row level security;
alter table audit_log enable row level security;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false)
$$;

-- Membership helper: user participates in a sweepstakes
create or replace function is_member(p_sweepstakes uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from entries e
    left join entry_shares s on s.entry_id = e.id and s.user_id = auth.uid()
    where e.sweepstakes_id = p_sweepstakes
      and (e.owner_user_id = auth.uid() or s.user_id is not null)
  )
$$;

-- Public reference data: anyone can read
create policy "public read" on sports for select using (true);
create policy "public read" on teams for select using (true);
create policy "public read" on league_seasons for select using (true);
create policy "public read" on games for select using (true);
create policy "public read" on themes for select using (true);

-- Profiles: read all (display names in standings), edit own
create policy "read profiles" on profiles for select using (true);
create policy "update own profile" on profiles for update using (id = auth.uid());
create policy "insert own profile" on profiles for insert with check (id = auth.uid());

-- Payout accounts: own only
create policy "own payout accounts" on payout_accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Sweepstakes: public ones visible to all; private to members/admin
create policy "read sweepstakes" on sweepstakes for select
  using (visibility = 'public' or is_member(id) or is_admin());

create policy "read sweepstakes config" on sweepstakes_sports for select using (true);
create policy "read scoring rules" on scoring_rules for select using (true);
create policy "read products" on products for select using (true);
create policy "read series" on series for select using (true);

-- Orders: own only
create policy "own orders" on orders for select using (user_id = auth.uid());

-- Entries & downstream: members of the pool can read
create policy "read entries" on entries for select
  using (is_member(sweepstakes_id) or is_admin()
         or exists (select 1 from sweepstakes w
                    where w.id = sweepstakes_id and w.visibility = 'public'));
create policy "read shares" on entry_shares for select
  using (user_id = auth.uid()
         or exists (select 1 from entries e
                    where e.id = entry_id and e.owner_user_id = auth.uid())
         or is_admin());
create policy "read renewals" on renewals for select
  using (user_id = auth.uid() or is_admin());
create policy "read draws" on draws for select using (true);
create policy "read draw picks" on draw_picks for select using (true);
create policy "read rosters" on rosters for select using (true);
create policy "read brackets" on brackets for select using (true);
create policy "read bracket picks" on bracket_picks for select using (true);
create policy "read point events" on point_events for select using (true);
create policy "read snapshots" on standings_snapshots for select using (true);
create policy "read accolades" on accolades for select using (true);

-- Disputes: create own, read own (admin sees all via service role / is_admin)
create policy "create dispute" on disputes for insert
  with check (user_id = auth.uid());
create policy "read own disputes" on disputes for select
  using (user_id = auth.uid() or is_admin());

-- Payouts: winners see their own; pot ledger members-only
create policy "read own payouts" on payouts for select
  using (is_admin() or exists
    (select 1 from entries e where e.id = entry_id and e.owner_user_id = auth.uid()));
create policy "read pot ledger" on pot_ledger for select
  using (is_member(sweepstakes_id) or is_admin());

-- Smack talk: members read/write within their pools
create policy "read posts" on posts for select
  using (is_member(sweepstakes_id) or is_admin());
create policy "write posts" on posts for insert
  with check (user_id = auth.uid() and is_member(sweepstakes_id));
create policy "react" on reactions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Media: read all, admin writes (entrant uploads via storage policies later)
create policy "read media" on media_assets for select using (true);

-- Admin-only mutations happen via service-role key in server code;
-- explicit admin policies for dashboard convenience:
create policy "admin all sweepstakes" on sweepstakes for all using (is_admin());
create policy "admin all alerts" on data_alerts for all using (is_admin());
create policy "admin all audit" on audit_log for all using (is_admin());
