-- Per-sweepstakes draw pool override. When rows exist for a (sweepstakes,
-- sport), the live draw uses exactly those teams/golfers; otherwise it falls
-- back to all active teams for that sport (the auto-derived pool).

create table if not exists sweepstakes_pool (
  sweepstakes_id uuid not null references sweepstakes(id) on delete cascade,
  sport_id text not null references sports(id),
  team_id uuid not null references teams(id),
  primary key (sweepstakes_id, team_id)
);

alter table sweepstakes_pool enable row level security;
create policy "public read sweepstakes_pool" on sweepstakes_pool
  for select using (true);

create index if not exists sweepstakes_pool_by_sport
  on sweepstakes_pool (sweepstakes_id, sport_id);
