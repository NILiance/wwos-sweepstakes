-- Scheduled draws + per-league timezone override
alter table sweepstakes add column if not exists draw_at timestamptz;
alter table sweepstakes add column if not exists timezone text;
alter table sweepstakes add column if not exists draw_scheduled_run_at timestamptz;

comment on column sweepstakes.draw_at is 'When the draw should auto-run (UTC). Null = manual only.';
comment on column sweepstakes.timezone is 'Display timezone override for this league. Null = platform default (America/New_York).';
comment on column sweepstakes.draw_scheduled_run_at is 'Set when the scheduler actually fired the draw, to prevent double-runs.';
