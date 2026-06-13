-- Waitlist: signups when a pool is full; first in line gets notified
-- automatically when a spot opens (refund/withdrawal).

create table waitlist (
  id uuid primary key default gen_random_uuid(),
  sweepstakes_id uuid not null references sweepstakes(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (sweepstakes_id, user_id)
);

alter table waitlist enable row level security;

create policy "own waitlist rows" on waitlist
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin read waitlist" on waitlist
  for select using (is_admin());
