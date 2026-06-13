-- Bracket (March Madness) game mode support.

-- The 64-team seeded field + round labels/points, configured per pool.
alter table sweepstakes
  add column if not exists bracket_field jsonb;

-- A "truth bracket" (actual results) has no entry; entrant brackets do.
alter table brackets
  alter column entry_id drop not null,
  add column if not exists is_truth boolean not null default false;

-- One truth bracket per sweepstakes
create unique index if not exists brackets_one_truth
  on brackets (sweepstakes_id) where is_truth;

-- bracket_picks already exists (slot, round, picked_team_id, result).
-- 'slot' is the game node id (1 = championship … 32–63 = round 1).
create index if not exists bracket_picks_bracket on bracket_picks (bracket_id);
