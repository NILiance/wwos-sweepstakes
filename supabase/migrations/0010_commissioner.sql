-- Commissioner (league-leader) layer: a paying tenant who runs their own
-- leagues on the platform without collecting funds through it.

-- Extend role + add per-user timezone (platform default Eastern)
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles
  add constraint profiles_role_check
  check (role in ('user', 'staff', 'admin', 'commissioner'));
alter table profiles
  add column if not exists timezone text not null default 'America/New_York';

-- Yearly subscription that grants commissioner access
create table if not exists commissioner_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'past_due', 'canceled')),
  paid_through timestamptz,
  amount_cents int,
  stripe_session_id text,
  renewal_notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id)
);
alter table commissioner_subscriptions enable row level security;
create policy "own subscription" on commissioner_subscriptions
  for select using (user_id = auth.uid() or is_admin());

-- Commissioners record entry payments manually (off-platform money)
create table if not exists league_payments (
  id uuid primary key default gen_random_uuid(),
  sweepstakes_id uuid not null references sweepstakes(id) on delete cascade,
  entry_id uuid references entries(id) on delete set null,
  payer_name text,
  amount_cents int not null default 0,
  method text,
  note text,
  status text not null default 'received'
    check (status in ('received', 'pending', 'refunded')),
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table league_payments enable row level security;
create policy "league owner reads payments" on league_payments
  for select using (
    is_admin()
    or exists (
      select 1 from sweepstakes w
      where w.id = sweepstakes_id and w.created_by = auth.uid()
    )
  );
